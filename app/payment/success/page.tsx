'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Mail, ExternalLink, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { paymentTiers, payAsYouGoPacks } from '@/lib/payment';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(10);
  const { refreshUser, user } = useUser();

  // Get transaction details from URL params (Creem may send different params).
  // If a historical link still carries the un-substituted {CHECKOUT_ID} literal
  // in position 1, prefer the next real-looking checkout id in the query string.
  const checkoutIds = searchParams.getAll('checkout_id');
  const realCheckoutId = checkoutIds.find((v) => v && !v.startsWith('{')) || null;
  const txId = realCheckoutId || searchParams.get('tx') || searchParams.get('txn_id') || searchParams.get('session_id');
  const amount = searchParams.get('amount') || searchParams.get('amt') || searchParams.get('mc_gross');
  const customerId = searchParams.get('customer_id') || searchParams.get('payer_id');
  const planId = searchParams.get('plan_id');
  const billingCycle = searchParams.get('billing_cycle');
  const signature = searchParams.get('signature');
  const orderId = searchParams.get('order_id');
  const productId = searchParams.get('product_id');

  // Heuristic for a real Creem redirect: Creem appends order_id + product_id
  // + signature to the success URL. Any URL that lacks all three (e.g. a
  // hand-crafted /payment/success?checkout_id=fake_123) shouldn't display the
  // confirmation UI, since that would make the success page spoofable.
  // We still verify payment server-side via the webhook + manual-grant
  // de-dup, so this is a UX guard, not a security control.
  const looksLikeRealCreemRedirect =
    !!txId && !!signature && !!orderId && !!productId;

  // Prefer the pack / tier name over whatever Creem puts in the URL — Creem does
  // not send product_name, and we don't want a one-time pack labeled "Subscription".
  const plan = planId
    ? [...paymentTiers, ...payAsYouGoPacks].find((p) => p.id === planId)
    : null;
  const isPayAsYouGo =
    plan?.type === 'pay-as-you-go' ||
    (!plan && (planId?.startsWith('pack-') || billingCycle === 'one-time'));
  const item =
    plan?.name ||
    searchParams.get('product_name') ||
    searchParams.get('item_name') ||
    (billingCycle === 'one-time' ? 'Credit Pack' : 'Subscription');

  // Show the "subscription active" banner once the purchase is reflected on the user.
  // NOTE: this is display-only. It must NOT gate the grant fallback below — a free user
  // starts with 20 credits, so any credit-count heuristic here would wrongly conclude the
  // purchase was already applied and skip the grant.
  const [creditsGranted, setCreditsGranted] = useState(false);

  // Guard against firing the grant more than once from the overlapping timers below.
  const grantAttempted = useRef(false);

  // Automatically grant credits if the webhook didn't process (silent fallback).
  // The server endpoint is idempotent (de-dups by checkoutId), so we always attempt it
  // rather than guessing from the current credit balance.
  const autoGrantCreditsIfNeeded = async () => {
    if (!user?.id || !txId || grantAttempted.current) {
      return; // Missing info, or a grant is already in flight / done
    }
    // Don't fire the client-side fallback on a hand-crafted URL — the webhook
    // is still the primary path, and this would otherwise let anyone trigger
    // a grant by visiting /payment/success?checkout_id=anything.
    if (!looksLikeRealCreemRedirect) {
      return;
    }

    try {
      const { auth } = await import('@/lib/firebase');
      const { getIdToken } = await import('firebase/auth');
      const idToken = auth?.currentUser ? await getIdToken(auth.currentUser) : null;

      if (!idToken) {
        return; // Token not ready yet — let the next timer retry.
      }

      // Only latch once we actually have a token and are about to call the server,
      // so a token-not-ready first attempt doesn't block the retry.
      grantAttempted.current = true;

      console.log('🔄 Auto-granting credits as fallback...');
      const response = await fetch('/api/creem/manual-grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ checkoutId: txId, planId, billingCycle }),
      });

      if (response.ok) {
        console.log('✅ Credits auto-granted successfully');
        setCreditsGranted(true);
        await refreshUser();
      }
    } catch (error) {
      console.error('Error auto-granting credits:', error);
    }
  };

  // Lets an explicit navigation (e.g. "View My Assets") cancel the auto-redirect
  // so the countdown doesn't yank the user to /generate after they've clicked away.
  const autoRedirectCancelled = useRef(false);

  // Refresh credits + run the grant fallback. Keyed on user?.id (not the whole user
  // object) and guarded so it runs once — otherwise each refreshUser() would change
  // `user` and re-trigger this effect.
  const creditFlowStarted = useRef(false);
  useEffect(() => {
    if (!user?.id || creditFlowStarted.current) return;
    creditFlowStarted.current = true;

    const checkAndRefreshCredits = async () => {
      // First refresh immediately (webhook may have already granted)
      await refreshUser();

      // Give the webhook a moment, then run the idempotent grant fallback.
      // The server de-dups by checkoutId, so a webhook-granted purchase won't double-count.
      setTimeout(async () => {
        await refreshUser();
        await autoGrantCreditsIfNeeded();
      }, 2000);

      // Retry once more in case the first attempt raced the auth token.
      setTimeout(async () => {
        await autoGrantCreditsIfNeeded();
        await refreshUser();
      }, 5000);
    };

    checkAndRefreshCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, txId]);

  // Countdown redirect — isolated so credit refreshes don't reset the timer.
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!autoRedirectCancelled.current) {
            router.push('/generate');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-slate-900 rounded-lg shadow-lg p-6 md:p-8 border border-slate-800">
          {/* Status icon — green check only when the URL carries Creem's
              signed params; otherwise an amber info icon so the page doesn't
              read as "success" at a glance. */}
          <div className="flex justify-center mb-4">
            {looksLikeRealCreemRedirect ? (
              <CheckCircle className="w-12 h-12 text-green-500" strokeWidth={2} />
            ) : (
              <AlertCircle className="w-12 h-12 text-amber-400" strokeWidth={2} />
            )}
          </div>

          {/* Main Heading */}
          <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
            {looksLikeRealCreemRedirect ? 'Payment Successful' : 'Checkout status'}
          </h1>

          <p className="text-gray-400 text-center mb-6">
            {looksLikeRealCreemRedirect
              ? 'Your transaction has been completed successfully.'
              : 'This page is reached after Creem completes a checkout. If you arrived here directly, no transaction will be recorded — please start a purchase from the Get More menu.'}
          </p>

          {/* Confirmation Box — only rendered when we're sure a real
              transaction completed. Otherwise claiming a receipt was emailed
              would be false. */}
          {looksLikeRealCreemRedirect && (
            <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Receipt
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                A receipt has been emailed to you. Check your inbox for transaction details.
              </p>
            </div>
          )}

          {/* Transaction Details — same gate. Showing "Item: Subscription"
              on a hand-crafted URL would misrepresent a non-event. */}
          {looksLikeRealCreemRedirect && txId && (
            <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-white mb-3">Transaction Details</h2>
              <div className="space-y-2 text-sm">
                {item && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Item:</span>
                    <span className="text-white">{item}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white">${amount}</span>
                  </div>
                )}
                {txId && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400">Transaction ID:</span>
                    <span className="text-gray-300 font-mono text-xs break-all ml-4">{txId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Creem Link */}
          {looksLikeRealCreemRedirect && (
            <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
              <p className="text-gray-400 text-sm mb-3">
                {isPayAsYouGo
                  ? 'View your receipt or past purchases in your Creem account.'
                  : 'View full transaction details or manage your subscription in your Creem account.'}
              </p>
              <a
                href="https://www.creem.io/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary-light text-sm font-medium transition-colors"
              >
                {isPayAsYouGo ? 'View receipts' : 'Manage Subscription'}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Status message — only when (a) the URL looks like a real
              Creem redirect, so we're not green-ticking on a crafted URL,
              AND (b) we have evidence credits actually landed (fallback
              granted them, or the user already has a paid tier). */}
          {looksLikeRealCreemRedirect &&
            (creditsGranted || user?.tier === 'starter' || user?.tier === 'standard' || user?.tier === 'pro') && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                <p className="text-green-300 text-sm">
                  {isPayAsYouGo
                    ? `✅ ${plan?.credits ?? 'Your'} credits have been added to your account — they never expire.`
                    : '✅ Your subscription is active! Credits have been added to your account.'}
                </p>
              </div>
            )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/generate"
              onClick={() => { autoRedirectCancelled.current = true; }}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start Creating Videos
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/assets"
              onClick={() => { autoRedirectCancelled.current = true; }}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-6 rounded-lg transition-colors border border-slate-700"
            >
              View My Assets
            </Link>
          </div>

          {/* Auto Redirect Notice */}
          <div className="mt-4 text-center">
            <p className="text-gray-500 text-xs">
              Redirecting in {countdown} seconds...
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-4 text-center">
          <p className="text-gray-500 text-xs">
            Need help?{' '}
            <a href="mailto:support@waifudance.com" className="text-primary hover:text-primary-light">
              support@waifudance.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-slate-900 rounded-lg shadow-lg p-6 md:p-8 border border-slate-800">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-gray-500" strokeWidth={2} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
              Loading...
            </h1>
          </div>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
