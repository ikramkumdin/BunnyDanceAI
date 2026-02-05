import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - WaifuDance AI',
  description: 'Terms of Service for WaifuDance AI - AI Dance Video Generator',
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-gray-400">Last updated: February 4, 2025</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Agreement to Our Legal Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We are WaifuDance AI (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), operated by ASMRTTS. By accessing or using our services at <strong>www.waifudance.com</strong>, you agree to be bound by these Terms of Service. If you do not agree with these terms, you must discontinue use immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Table of Contents</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li><a href="#services" className="text-primary hover:underline">Our Services</a></li>
              <li><a href="#intellectual-property" className="text-primary hover:underline">Intellectual Property Rights</a></li>
              <li><a href="#user-representations" className="text-primary hover:underline">User Representations</a></li>
              <li><a href="#purchases" className="text-primary hover:underline">Purchases and Payment</a></li>
              <li><a href="#user-contributions" className="text-primary hover:underline">User Contributions</a></li>
              <li><a href="#prohibited" className="text-primary hover:underline">Prohibited Activities</a></li>
              <li><a href="#credits" className="text-primary hover:underline">Credits and Subscription Plans</a></li>
              <li><a href="#liability" className="text-primary hover:underline">Limitation of Liability</a></li>
              <li><a href="#termination" className="text-primary hover:underline">Termination</a></li>
            </ol>
          </section>

          <section id="services">
            <h2 className="text-2xl font-semibold mb-4">1. Our Services</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              WaifuDance AI is an AI-powered service that generates dance videos from uploaded images. Our Services include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>AI-powered image-to-video generation</li>
              <li>Multiple dance templates and effects</li>
              <li>Credit-based subscription plans (Starter, Standard, Pro)</li>
              <li>Free tier with limited credits</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.
            </p>
          </section>

          <section id="intellectual-property">
            <h2 className="text-2xl font-semibold mb-4">2. Intellectual Property Rights</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the &quot;Content&quot;), as well as the trademarks, service marks, and logos contained therein (the &quot;Marks&quot;).
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties in the United States and around the world. The Content and Marks are provided in or through the Services &quot;AS IS&quot; for your personal, non-commercial use only.
            </p>
            <p className="text-gray-300 leading-relaxed">
              <strong>Generated Content:</strong> You retain ownership of videos and images generated using our Services. However, you grant us a non-exclusive, worldwide, royalty-free license to use, store, and display generated content for the purpose of providing and improving our Services.
            </p>
          </section>

          <section id="user-representations">
            <h2 className="text-2xl font-semibold mb-4">3. User Representations</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              By using the Services, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>All registration information you submit will be true, accurate, current, and complete;</li>
              <li>You will maintain the accuracy of such information and promptly update such registration information as necessary;</li>
              <li>You have the legal capacity and agree to comply with these Legal Terms;</li>
              <li>You are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services;</li>
              <li>You are at least 18 years of age (or the age of majority in your jurisdiction) to use Services that generate adult-oriented content;</li>
              <li>You will not access the Services through automated or non-human means, whether through a bot, script, or otherwise;</li>
              <li>You will not use the Services for any illegal or unauthorized purpose;</li>
              <li>Your use of the Services will not violate any applicable law or regulation;</li>
              <li>You have the right to use any images you upload, and such images do not infringe on the rights of any third party;</li>
              <li>You will not upload images of individuals without their consent or images that violate privacy rights.</li>
            </ul>
          </section>

          <section id="purchases">
            <h2 className="text-2xl font-semibold mb-4">4. Purchases and Payment</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We offer subscription plans with the following pricing:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4 mb-4">
              <li><strong>Starter Plan:</strong> $9/month or $86/year (200 image credits + 200 video credits per month)</li>
              <li><strong>Standard Plan:</strong> $24/month or $230/year (800 image credits + 800 video credits per month)</li>
              <li><strong>Pro Plan:</strong> $48/month or $461/year (2,500 image credits + 2,500 video credits per month)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mb-4">
              We may provide paid products and/or services within the Services. In that case, we will provide you with pricing information before any transaction is completed. You agree to pay all charges at the prices then in effect for your purchases, and you authorize us to charge your chosen payment provider for any such amounts upon placing your order.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong>Payment Processing:</strong> Payments are processed through Creem.io. By making a purchase, you agree to Creem&apos;s terms and conditions. We are not responsible for payment processing errors or issues with third-party payment providers.
            </p>
            <p className="text-gray-300 leading-relaxed">
              <strong>Refunds:</strong> All sales are final. We do not offer refunds for subscription fees. Credits are non-transferable and non-refundable. If you cancel your subscription, you will retain access to your remaining credits until the end of your billing period.
            </p>
          </section>

          <section id="user-contributions">
            <h2 className="text-2xl font-semibold mb-4">5. User Contributions</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              The Services allow you to upload images and generate videos. Any content you create, submit, post, display, transmit, perform, publish, distribute, or broadcast using our Services is considered a &quot;User Contribution.&quot;
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              You are solely responsible for your User Contributions. You represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>You own or have the necessary rights to use any images you upload;</li>
              <li>Your User Contributions do not violate any third-party rights, including copyright, trademark, privacy, or publicity rights;</li>
              <li>Your User Contributions do not contain illegal, harmful, or offensive content;</li>
              <li>You will not use the Services to generate content that violates applicable laws or regulations.</li>
            </ul>
          </section>

          <section id="prohibited">
            <h2 className="text-2xl font-semibold mb-4">6. Prohibited Activities</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You may not access or use the Services for any purpose other than that for which we make the Services available. As a user of the Services, you agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us;</li>
              <li>Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses;</li>
              <li>Use the Services to advertise or offer to sell goods and services;</li>
              <li>Upload images of minors or individuals without their consent;</li>
              <li>Generate content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable;</li>
              <li>Attempt to reverse engineer, decompile, or disassemble any part of the Services;</li>
              <li>Use the Services to generate content for commercial purposes without appropriate licensing or rights;</li>
              <li>Share, sell, or transfer your account or credits to another user;</li>
              <li>Use automated scripts, bots, or other means to generate content or consume credits;</li>
              <li>Interfere with or disrupt the Services or servers connected to the Services.</li>
            </ul>
          </section>

          <section id="credits">
            <h2 className="text-2xl font-semibold mb-4">7. Credits and Subscription Plans</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong>Free Tier:</strong> New users receive 3 free image credits and 3 free video credits. Free credits cannot be transferred or refunded.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong>Subscription Plans:</strong> Subscriptions are billed monthly or annually based on your selected plan. Credits are granted at the beginning of each billing cycle and do not roll over to the next period. Unused credits expire at the end of each billing cycle.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong>Cancellation:</strong> You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. You will retain access to your remaining credits until the end of the billing period.
            </p>
            <p className="text-gray-300 leading-relaxed">
              <strong>Credit Refunds:</strong> Credits are only refunded in cases where video generation fails due to technical errors on our part. Credits used for successful generations are non-refundable.
            </p>
          </section>

          <section id="liability">
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              In no event will we or our directors, employees, or agents be liable to you or any third party for any indirect, consequential, exemplary, incidental, special, or punitive damages, including lost profit, lost revenue, loss of data, or other damages arising from your use of the Services, even if we have been advised of the possibility of such damages.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Our total liability to you for all claims arising from or related to the Services shall not exceed the amount you paid to us in the twelve (12) months preceding the claim.
            </p>
            <p className="text-gray-300 leading-relaxed">
              We do not guarantee that the Services will be available at all times, error-free, or that generated content will meet your expectations. The Services are provided &quot;AS IS&quot; without warranties of any kind.
            </p>
          </section>

          <section id="termination">
            <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We may terminate or suspend your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Services will cease immediately.
            </p>
            <p className="text-gray-300 leading-relaxed">
              If you wish to terminate your account, you may do so by canceling your subscription and contacting us at <a href="mailto:support@waifudance.com" className="text-primary hover:underline">support@waifudance.com</a>. Upon termination, all remaining credits will be forfeited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
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
