'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Mail, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(10);
  const { refreshUser } = useUser();

  // Get transaction details from URL params (Creem may send different params)
  const txId = searchParams.get('checkout_id') || searchParams.get('tx') || searchParams.get('txn_id');
  const amount = searchParams.get('amount') || searchParams.get('amt') || searchParams.get('mc_gross');
  const item = searchParams.get('product_name') || searchParams.get('item_name') || 'Pro Weekly Subscription';
  const customerId = searchParams.get('customer_id') || searchParams.get('payer_id');

  useEffect(() => {
    // Refresh user credits when payment success page loads
    // This ensures credits are updated after PayPal payment
    refreshUser();
    
    // Countdown redirect to generate page
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/generate');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, refreshUser]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-slate-900 rounded-lg shadow-lg p-6 md:p-8 border border-slate-800">
          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-green-500" strokeWidth={2} />
          </div>

          {/* Main Heading */}
          <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
            Payment Successful
          </h1>

          <p className="text-gray-400 text-center mb-6">
            Your transaction has been completed successfully.
          </p>

          {/* Confirmation Box */}
          <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
            <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              Receipt
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              A receipt has been emailed to you. Check your inbox for transaction details.
            </p>
          </div>

          {/* Transaction Details */}
          {txId && (
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
          <div className="bg-slate-800 rounded-lg p-4 mb-4 border border-slate-700">
            <p className="text-gray-400 text-sm mb-3">
              View full transaction details or manage your subscription in your Creem account.
            </p>
            <a
              href="https://www.creem.io/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-primary-light text-sm font-medium transition-colors"
            >
              View on Creem
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/generate"
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start Creating Videos
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/assets"
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
