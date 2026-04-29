import React from 'react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Privacy Policy | MockMob',
  description: 'Read how MockMob collects, uses, and protects student account, practice, and payment data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="view min-h-screen">
      <NavBar />
      <main className="container-narrow px-5 pb-20 pt-32">
        <div className="eyebrow mb-3">{'// Legal'}</div>
        <h1 className="display-lg mb-5">Privacy Policy</h1>
        <p className="mb-10 text-zinc-400">Last updated: April 27, 2026</p>

        <div className="legal-copy">
          <section>
            <h2>What we collect</h2>
            <p>We collect account details you provide, login information, selected subjects, mock attempts, saved questions, uploaded questions, votes, bookmarks, and payment status needed to run MockMob.</p>
          </section>
          <section>
            <h2>How we use it</h2>
            <p>We use your data to deliver mocks, track progress, power Radar analytics, generate Admission Compass recommendations, prevent abuse, moderate community questions, process payments, and improve the product.</p>
          </section>
          <section>
            <h2>Payments</h2>
            <p>Payments are handled by Razorpay. MockMob stores subscription and access status, but does not store full card, UPI, or bank credentials on our servers.</p>
          </section>
          <section>
            <h2>Community content</h2>
            <p>Questions, explanations, votes, and other community contributions may be reviewed by automated systems, moderators, or trusted reviewers before they appear publicly.</p>
          </section>
          <section>
            <h2>Your choices</h2>
            <p>You can stop using the service, request account help, or ask us to review account-related information. Some records may be retained where needed for fraud prevention, legal compliance, or payment reconciliation.</p>
          </section>
          <section>
            <h2>Contact</h2>
            <p>For privacy questions, contact the MockMob team through the support or contact channel available on the site.</p>
          </section>
        </div>
      </main>
      <MarketingFooter />
      <style>{`
        .legal-copy {
          display: grid;
          gap: 22px;
          color: #a1a1aa;
          line-height: 1.8;
        }
        .legal-copy h2 {
          color: #fff;
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
