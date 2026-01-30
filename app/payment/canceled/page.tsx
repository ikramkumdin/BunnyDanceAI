'use client';

import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function PaymentCanceledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Canceled Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-12 border border-white/20">
          {/* Canceled Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500 rounded-full blur-xl opacity-30"></div>
              <XCircle className="relative w-20 h-20 text-yellow-400" strokeWidth={2} />
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Payment Canceled
          </h1>

          <p className="text-xl text-white/80 text-center mb-8">
            Your payment was not completed. No charges were made to your account.
          </p>

          {/* Info Box */}
          <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              What happened?
            </h2>
            <ul className="space-y-2 text-white/70">
              <li>• You clicked "Cancel" during checkout</li>
              <li>• You closed the PayPal window before completing payment</li>
              <li>• The payment session timed out</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <Link
              href="/generate"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-2xl"
            >
              Try Again
            </Link>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 border border-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </Link>
          </div>

          {/* Use Free Credits */}
          <div className="mt-6 p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-400/30">
            <p className="text-white/80 text-center">
              💡 <strong>Did you know?</strong> You can still use your free credits to create videos!
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
