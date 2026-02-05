import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Return & Refund Policy - WaifuDance AI',
  description: 'Return and Refund Policy for WaifuDance AI - AI Dance Video Generator',
};

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link 
            href="/"
            className="text-primary hover:text-primary-light text-sm mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-2">Return & Refund Policy</h1>
          <p className="text-gray-400">Last updated: February 4, 2025</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Return Policy Overview</h2>
            <p className="text-gray-300 leading-relaxed">
              Thank you for your purchase. We hope you are happy with your subscription to WaifuDance AI. However, if you are not completely satisfied with your purchase for any reason, please review our refund policy below.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong>Important:</strong> Since we provide digital services (AI video generation), our refund policy differs from physical product returns. Please read this policy carefully.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Subscription Refunds</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong>All subscription sales are final.</strong> We do not offer refunds for subscription fees once payment has been processed. This policy applies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Monthly subscriptions (Starter, Standard, Pro plans)</li>
              <li>Annual subscriptions (Starter, Standard, Pro plans)</li>
              <li>Any subscription upgrades or downgrades</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong>Cancellation:</strong> You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. You will retain access to your remaining credits until the end of the billing period. No refunds will be issued for the remaining period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Credit Refunds</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Credits are generally non-refundable. However, we will refund credits in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Technical Failures:</strong> If video generation fails due to a technical error on our part, we will automatically refund the credit used</li>
              <li><strong>Service Outages:</strong> If our service is unavailable for an extended period (more than 24 hours), we may issue credit refunds or extensions</li>
              <li><strong>Duplicate Charges:</strong> If you are charged multiple times for the same transaction, we will refund the duplicate charges</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong>Non-Refundable Credits:</strong> Credits used for successful video generations are non-refundable, even if you are not satisfied with the generated content. We recommend using free credits to test our service before subscribing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Refund Process</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you believe you are entitled to a refund:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 ml-4">
              <li>Contact us at <a href="mailto:support@waifudance.com" className="text-primary hover:underline">support@waifudance.com</a> with your request</li>
              <li>Include your account email and transaction ID (if applicable)</li>
              <li>Provide details about why you believe you are entitled to a refund</li>
              <li>We will review your request and respond within 7 business days</li>
            </ol>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong>Processing Time:</strong> If your refund is approved, it will be processed within 7-14 business days. Refunds will be issued to the original payment method used for the purchase. Refunds may take 1-2 billing cycles to appear on your credit card statement, depending on your credit card company.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Exceptions</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We may make exceptions to our refund policy in the following cases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Unauthorized Charges:</strong> If your account was charged without authorization, we will issue a full refund</li>
              <li><strong>Billing Errors:</strong> If you were charged incorrectly (e.g., wrong plan or amount), we will correct the error and issue a refund if necessary</li>
              <li><strong>Service Defects:</strong> If our service does not function as advertised and we cannot resolve the issue, we may offer a partial or full refund</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              All exceptions are evaluated on a case-by-case basis at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Free Credits</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Free credits provided to new users are non-refundable and cannot be exchanged for cash or other credits. Free credits expire if not used within a reasonable time period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Subscription Cancellation</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You may cancel your subscription at any time through your account settings or by contacting us. When you cancel:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Your subscription will remain active until the end of the current billing period</li>
              <li>You will retain access to all remaining credits until the period ends</li>
              <li>You will not be charged for the next billing cycle</li>
              <li>No refunds will be issued for the remaining period</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              After cancellation, your account will revert to the free tier, and you will lose access to subscription features.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Disputes</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you have a dispute regarding a charge or refund, please contact us first at <a href="mailto:support@waifudance.com" className="text-primary hover:underline">support@waifudance.com</a>. We are committed to resolving disputes fairly and promptly.
            </p>
            <p className="text-gray-300 leading-relaxed">
              If you are unable to resolve a dispute with us, you may contact your payment provider (Creem.io) or your credit card company to file a chargeback. However, we reserve the right to dispute chargebacks that violate our Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Questions</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions concerning our return and refund policy, please contact us at:
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Email: <a href="mailto:support@waifudance.com" className="text-primary hover:underline">support@waifudance.com</a>
              <br />
              Website: <a href="https://www.waifudance.com" className="text-primary hover:underline">www.waifudance.com</a>
            </p>
          </section>

          <div className="border-t border-gray-800 pt-8 mt-12">
            <p className="text-gray-400 text-sm text-center">
              © 2025 WaifuDance AI (ASMRTTS). All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
