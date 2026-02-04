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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-rose-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-12 border border-white/20">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <CheckCircle className="relative w-20 h-20 text-green-400" strokeWidth={2} />
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Payment Successful! 🎉
          </h1>

          <p className="text-xl text-white/80 text-center mb-8">
            Thank you for your purchase. Your transaction has been completed successfully.
          </p>

          {/* Confirmation Box */}
          <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-pink-400" />
              Receipt Confirmation
            </h2>
            <p className="text-white/70 leading-relaxed">
              A receipt for your purchase has been emailed to you. Please check your inbox (and spam folder) for the transaction details and confirmation from Creem.
            </p>
          </div>

          {/* Transaction Details */}
          {txId && (
            <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4">Transaction Details</h2>
              <div className="space-y-3">
                {item && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Item:</span>
                    <span className="text-white font-medium">{item}</span>
                  </div>
                )}
                {amount && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Amount:</span>
                    <span className="text-white font-medium">${amount} USD</span>
                  </div>
                )}
                {txId && (
                  <div className="flex justify-between items-start">
                    <span className="text-white/60">Transaction ID:</span>
                    <span className="text-white font-mono text-sm break-all ml-4">{txId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Creem Link */}
          <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-xl p-6 mb-8 border border-blue-400/30">
            <p className="text-white/80 mb-4">
              To view full transaction details, manage your subscription, or download your receipt, log into your Creem account.
            </p>
            <a
              href="https://www.creem.io/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              View on Creem
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <Link
              href="/generate"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-2xl"
            >
              Start Creating Videos
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/assets"
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 border border-white/20"
            >
              View My Assets
            </Link>
          </div>

          {/* Auto Redirect Notice */}
          <div className="mt-6 text-center">
            <p className="text-white/50 text-sm">
              Redirecting to generation page in {countdown} seconds...
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-sm">
            Need help? Contact us at{' '}
            <a href="mailto:support@waifudance.com" className="text-pink-400 hover:text-pink-300 underline">
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-rose-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-12 border border-white/20">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <CheckCircle className="relative w-20 h-20 text-green-400" strokeWidth={2} />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
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
