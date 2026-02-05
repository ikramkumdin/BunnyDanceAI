import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - WaifuDance AI',
  description: 'Privacy Policy for WaifuDance AI - AI Dance Video Generator',
};

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: February 4, 2025</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Overview</h2>
            <p className="text-gray-300 leading-relaxed">
              This Privacy Notice for WaifuDance AI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), operated by ASMRTTS, describes how we might collect, store, and use your personal information when you use our services, including when you visit our website <strong>www.waifudance.com</strong> or engage with us through sales, marketing, or events.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Table of Contents</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li><a href="#information-collect" className="text-primary hover:underline">What Information Do We Collect?</a></li>
              <li><a href="#process-information" className="text-primary hover:underline">How Do We Process Your Information?</a></li>
              <li><a href="#legal-bases" className="text-primary hover:underline">What Legal Bases Do We Rely On?</a></li>
              <li><a href="#share-information" className="text-primary hover:underline">When and With Whom Do We Share Your Information?</a></li>
              <li><a href="#cookies" className="text-primary hover:underline">Do We Use Cookies and Tracking Technologies?</a></li>
              <li><a href="#social-logins" className="text-primary hover:underline">How Do We Handle Your Social Logins?</a></li>
              <li><a href="#keep-information" className="text-primary hover:underline">How Long Do We Keep Your Information?</a></li>
              <li><a href="#keep-safe" className="text-primary hover:underline">How Do We Keep Your Information Safe?</a></li>
              <li><a href="#minors" className="text-primary hover:underline">Do We Collect Information from Minors?</a></li>
              <li><a href="#privacy-rights" className="text-primary hover:underline">What Are Your Privacy Rights?</a></li>
            </ol>
          </section>

          <section id="information-collect">
            <h2 className="text-2xl font-semibold mb-4">1. What Information Do We Collect?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We collect personal information that you voluntarily provide to us when you register on the Services or when you participate in activities on the Services.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong>Personal Information Provided by You:</strong> This includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Name and email address (when you create an account)</li>
              <li>Payment data (processed securely through Creem.io - we do not store full payment card details)</li>
              <li>Social media login details (if you sign in with Google)</li>
              <li>Uploaded images and generated videos (stored securely in our cloud storage)</li>
              <li>Account preferences and settings</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4 mb-4">
              <strong>Automatically Collected Information:</strong> This includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>IP address and location data</li>
              <li>Browser type and device information</li>
              <li>Usage data (pages visited, features used, generation history)</li>
              <li>Cookies and similar tracking technologies (see section 5)</li>
              <li>Analytics data (via Firebase Analytics)</li>
            </ul>
          </section>

          <section id="process-information">
            <h2 className="text-2xl font-semibold mb-4">2. How Do We Process Your Information?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We process your information to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Provide our Services:</strong> Process your image uploads, generate videos, manage your account and credits</li>
              <li><strong>Process Payments:</strong> Handle subscription purchases and manage billing through Creem.io</li>
              <li><strong>Improve our Services:</strong> Analyze usage patterns to enhance features and user experience</li>
              <li><strong>Communicate with You:</strong> Send service updates, respond to support requests, and send marketing communications (with your consent)</li>
              <li><strong>Secure our Services:</strong> Detect and prevent fraud, abuse, and security threats</li>
              <li><strong>Comply with Legal Obligations:</strong> Meet legal requirements and respond to legal requests</li>
            </ul>
          </section>

          <section id="legal-bases">
            <h2 className="text-2xl font-semibold mb-4">3. What Legal Bases Do We Rely On?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We process your information in accordance with applicable legal bases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Consent:</strong> When you provide explicit consent (e.g., marketing communications)</li>
              <li><strong>Performance of Contract:</strong> To fulfill our Terms of Service and provide the services you requested</li>
              <li><strong>Legal Obligations:</strong> To comply with applicable laws and regulations</li>
              <li><strong>Legitimate Interests:</strong> To improve our services, prevent fraud, and ensure security</li>
            </ul>
          </section>

          <section id="share-information">
            <h2 className="text-2xl font-semibold mb-4">4. When and With Whom Do We Share Your Information?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Payment Processors:</strong> Creem.io processes your payment information securely. We do not store your full payment card details.</li>
              <li><strong>Cloud Storage Providers:</strong> Google Cloud Storage (Firebase) stores your uploaded images and generated videos</li>
              <li><strong>Analytics Providers:</strong> Firebase Analytics helps us understand how our services are used</li>
              <li><strong>AI Service Providers:</strong> Kie.ai processes your images to generate videos (images are deleted after processing)</li>
              <li><strong>Legal Authorities:</strong> When required by law or to protect our rights and safety</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              We do not sell your personal information to third parties. We only share information as necessary to provide our services or as required by law.
            </p>
          </section>

          <section id="cookies">
            <h2 className="text-2xl font-semibold mb-4">5. Do We Use Cookies and Tracking Technologies?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Yes, we use cookies and similar tracking technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Remember your login session and preferences</li>
              <li>Analyze how you use our services (via Firebase Analytics)</li>
              <li>Improve user experience and personalize content</li>
              <li>Track conversion events (e.g., subscription purchases)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of our services.
            </p>
          </section>

          <section id="social-logins">
            <h2 className="text-2xl font-semibold mb-4">6. How Do We Handle Your Social Logins?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you register using a social media account (e.g., Google Sign-In), we collect:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Profile information (name, email address, profile picture) as permitted by the social media provider</li>
              <li>Authentication tokens to maintain your login session</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              We use this information to create and manage your account. You can revoke access at any time through your social media account settings.
            </p>
          </section>

          <section id="keep-information">
            <h2 className="text-2xl font-semibold mb-4">7. How Long Do We Keep Your Information?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We keep your information only as long as necessary to fulfill the purposes outlined in this policy:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Account Information:</strong> Retained while your account is active and for a reasonable period after account closure</li>
              <li><strong>Generated Content:</strong> Stored until you delete it or close your account</li>
              <li><strong>Payment Records:</strong> Retained as required by law (typically 7 years for tax purposes)</li>
              <li><strong>Analytics Data:</strong> Aggregated and anonymized data may be retained indefinitely</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              You can request deletion of your account and associated data at any time by contacting us at <a href="mailto:support@waifudance.com" className="text-primary hover:underline">support@waifudance.com</a>.
            </p>
          </section>

          <section id="keep-safe">
            <h2 className="text-2xl font-semibold mb-4">8. How Do We Keep Your Information Safe?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We have technical and organizational measures in place to protect your data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Secure authentication and authorization (Firebase Auth)</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and employee training</li>
              <li>Secure cloud storage (Google Cloud Platform)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              However, we cannot guarantee complete security against unauthorized access. No method of transmission over the internet is 100% secure. If you become aware of any security breach, please contact us immediately.
            </p>
          </section>

          <section id="minors">
            <h2 className="text-2xl font-semibold mb-4">9. Do We Collect Information from Minors?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We do not knowingly collect personal information from children under 18 years of age. Our services are intended for users who are 18 years or older.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at <a href="mailto:support@waifudance.com" className="text-primary hover:underline">support@waifudance.com</a>. We will delete such information promptly.
            </p>
            <p className="text-gray-300 leading-relaxed">
              If you are under 18, you must have parental permission to use our services.
            </p>
          </section>

          <section id="privacy-rights">
            <h2 className="text-2xl font-semibold mb-4">10. What Are Your Privacy Rights?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Objection:</strong> Object to processing of your information for certain purposes</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              To exercise your rights, please contact us at <a href="mailto:support@waifudance.com" className="text-primary hover:underline">support@waifudance.com</a>. We will respond to your request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
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
