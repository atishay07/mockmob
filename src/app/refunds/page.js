import React from 'react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Refund Policy | MockMob',
  description: 'Read MockMob no-refund and cancellation guidance for Pro subscriptions.',
  path: '/refunds',
});

export default function RefundsPage() {
  return (
    <div className="mm">
      <NavBar />
      <main className="container-narrow px-5 pb-20 pt-10">
        <div className="eyebrow mb-3">{'// Legal'}</div>
        <h1 className="display-lg mb-5">Refund Policy</h1>
        <p className="mb-10 text-zinc-400">Last updated: 2 October 2026</p>

        <div className="legal-copy">
          <section>
            <h2>No refunds</h2>
            <p>MockMob does not allow refunds for completed payments, subscriptions, PrepOS credit packs, or consumed billing periods. Please review the plan, price, and feature details before purchase.</p>
          </section>
          <section>
            <h2>Cancellations</h2>
            <p>Current CUET 2027 access is a one-time payment ending 31 July 2027, with no auto-renewal. Historical recurring subscriptions, if still active, can be cancelled to stop future renewals while preserving their paid period.</p>
          </section>
          <section>
            <h2>How to cancel</h2>
            <p>For historical recurring subscriptions only, cancel from your auto-payment or Razorpay mandate screen before the next billing date. If you need help, mail us from your registered email with your payment reference and cancellation request.</p>
          </section>
          <section>
            <h2>Failed or duplicate payments</h2>
            <p>Failed, duplicate, or gateway-side settlement issues are not treated as voluntary refunds. We will check Razorpay records and help resolve payment-provider errors according to their timeline.</p>
          </section>
          <section>
            <h2>Support details</h2>
            <p>When mailing us, include your registered email, payment date, amount, and transaction reference so we can identify the subscription or payment quickly.</p>
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
