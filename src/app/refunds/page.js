import React from 'react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Refund Policy | MockMob',
  description: 'Read MockMob cancellation and refund guidance for Pro subscriptions and payment issues.',
  path: '/refunds',
});

export default function RefundsPage() {
  return (
    <div className="view min-h-screen">
      <NavBar />
      <main className="container-narrow px-5 pb-20 pt-32">
        <div className="eyebrow mb-3">{'// Legal'}</div>
        <h1 className="display-lg mb-5">Refund Policy</h1>
        <p className="mb-10 text-zinc-400">Last updated: April 27, 2026</p>

        <div className="legal-copy">
          <section>
            <h2>Cancellations</h2>
            <p>You can cancel MockMob Pro anytime. Cancellation stops future renewal charges, while access generally remains active until the end of the paid billing period.</p>
          </section>
          <section>
            <h2>Refund window</h2>
            <p>If you were charged by mistake or could not access Pro after payment, contact us within 7 days of the charge. We will review the payment status, account access, and usage history.</p>
          </section>
          <section>
            <h2>When refunds may not apply</h2>
            <p>Refunds may not be available after substantial premium usage, repeated refund requests, account misuse, or when the subscription period has already been consumed.</p>
          </section>
          <section>
            <h2>Failed or duplicate payments</h2>
            <p>Duplicate charges, failed payment deductions, or gateway settlement issues will be checked against Razorpay records and handled according to the payment provider timeline.</p>
          </section>
          <section>
            <h2>How to request help</h2>
            <p>Share your registered email, payment date, amount, and transaction reference through the support or contact channel available on the site.</p>
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
