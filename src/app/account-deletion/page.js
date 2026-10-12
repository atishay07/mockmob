import React from 'react';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Delete your MockMob account',
  description: 'How to ask MockMob to delete your account and study records, what is deleted, what is kept, and how long it takes.',
  path: '/account-deletion',
});

export default function AccountDeletionPage() {
  return (
    <div className="mm">
      <NavBar />
      <main className="container-narrow px-5 pb-20 pt-10">
        <div className="eyebrow mb-3">Account</div>
        <h1 className="display-lg mb-5">Delete your MockMob account</h1>
        <p className="mb-10 text-zinc-400">Last updated: 12 October 2026</p>

        <div className="legal-copy">
          <section>
            <h2>Two ways to ask</h2>
            <p>Signed in on the website or the Android app: open Profile, then Delete account, type DELETE to confirm and send the request. You will see the date of your request and that it is pending.</p>
            <p>Cannot sign in: email <a className="mm-link" href="mailto:support@mockmob.in">support@mockmob.in</a> from the email address your account uses, and say you want the account deleted. We use that address to check the request is yours.</p>
          </section>
          <section>
            <h2>What we delete</h2>
            <ul>
              <li>Your account and sign-in details.</li>
              <li>Your study records: mock attempts, saved and uploaded questions, bookmarks, votes, subjects and plans.</li>
              <li>App data: push notification tokens, notification preferences and study goal.</li>
              <li>Any usage data collected, if you had allowed it.</li>
            </ul>
          </section>
          <section>
            <h2>What we keep</h2>
            <p>Payment records that the law requires us to keep, such as invoices and payment references. We do not hold full card, UPI or bank credentials; Razorpay handles those.</p>
          </section>
          <section>
            <h2>How long it takes</h2>
            <p>We delete your account and study records within 30 days of your request. Deletion cannot be undone once complete. To cancel a pending request, email support@mockmob.in before it finishes.</p>
          </section>
          <section>
            <h2>More</h2>
            <p>Read the <Link className="mm-link" href="/privacy">Privacy Policy</Link> for everything we collect and why.</p>
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
        .legal-copy ul {
          list-style: disc;
          padding-left: 20px;
          display: grid;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}
