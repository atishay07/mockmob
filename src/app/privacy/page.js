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
    <div className="mm">
      <NavBar />
      <main className="container-narrow px-5 pb-20 pt-10">
        <div className="eyebrow mb-3">{'// Legal'}</div>
        <h1 className="display-lg mb-5">Privacy Policy</h1>
        <p className="mb-10 text-zinc-400">Last updated: 2 October 2026</p>

        <div className="legal-copy">
          <section>
            <h2>What we collect</h2>
            <p>We collect account details you provide, login information, selected subjects, mock attempts, saved questions, uploaded questions, votes, bookmarks, and payment status needed to run MockMob.</p>
          </section>
          <section>
            <h2>How we use it</h2>
            <p>We use your data to deliver mocks, track progress, power Radar analytics, provide sourced DU eligibility and historical comparisons, prevent abuse, moderate community questions, process payments, and improve the product.</p>
          </section>
          <section>
            <h2>Practice events and optional AI</h2><p>New sessions may record answers, answer changes, visits and elapsed times. These are device observations and are not assumed to explain why a question was skipped. Session snapshots, learning observations and corrections preserve history. Core recovery does not require paid AI. Optional AI, when enabled, sends your prompt and a compact study summary to the configured provider; it does not need your full raw attempt history. PrepOS currently explains the shared plan without a paid model call.</p></section><section><h2>Retention and requests</h2><p>Account and practice records remain while your account is active. Payment and fraud-prevention records may remain after a deletion request where reconciliation or legal obligations require them. We have not promised an automatic deletion schedule. Request an export or deletion at support@mockmob.in.</p></section><section><h2>Payments</h2>
            <p>Payments are handled by Razorpay. MockMob stores subscription and access status, but does not store full card, UPI, or bank credentials on our servers.</p>
          </section>
          <section>
            <h2>Community content</h2>
            <p>Questions, explanations, votes, and other community contributions are checked by automated systems. Uncertain recovery content is withheld; routine human review is not promised.</p>
          </section>
          <section>
            <h2>Your choices</h2>
            <p>You can stop using the service, request account help, or ask us to review account-related information. Some records may be retained where needed for fraud prevention, legal compliance, or payment reconciliation.</p>
          </section>
          <section>
            <h2>Contact</h2>
            <p>For privacy, export or account-deletion requests, email support@mockmob.in from your registered address. Include a payment reference for billing issues; do not send card or bank credentials.</p>
          </section>
        </div>
      </main>
      <MarketingFooter />
      <style>{`
        .legal-copy {
          display: grid;
          gap: 22px;
          color: var(--ink-2);
          line-height: 1.8;
        }
        .legal-copy h2 {
          color: var(--ink);
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
