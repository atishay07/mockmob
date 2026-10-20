import React from 'react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { seoMetadata } from '@/lib/seo';
import { publicOffer } from '@/lib/payments/offer';

// Reads the plan setting on each request, so the page never describes a monthly plan that is not on sale.
export const dynamic = 'force-dynamic';

export const metadata = seoMetadata({
  title: 'Refund Policy | MockMob',
  description: 'Read how MockMob handles refunds, monthly Pro cancellation and failed payments.',
  path: '/refunds',
});

export default function RefundsPage() {
  const monthlyOpen = publicOffer().purchasable === 'monthly';
  return (
    <div className="mm">
      <NavBar />
      <main className="container-narrow px-5 pb-20 pt-10">
        <div className="eyebrow mb-3">{'// Legal'}</div>
        <h1 className="display-lg mb-5">Refund Policy</h1>
        <p className="mb-10 text-zinc-400">Last updated: 20 October 2026</p>

        <div className="legal-copy">
          <section>
            <h2>No refunds on the website</h2>
            <p>For payments made on the MockMob website (mockmob.in), MockMob does not allow refunds for completed payments, monthly Pro renewals, one-time Pro access, credit packs, or billing periods you have already used. Please review the plan, price, and feature details before you pay.</p>
          </section>
          <section>
            <h2>Buying in the Android app (Google Play)</h2>
            <p>Purchases in the Android app are billed by Google Play, not by Razorpay. Pro is a monthly subscription. It renews every month until you cancel it in Google Play: open the Play Store, then Payments and subscriptions, then Subscriptions, choose MockMob and cancel. Uninstalling the app does not cancel it. After you cancel, you keep Pro until the end of the period you have already paid for. Play shows its own price before you buy, and your Google account holds the payment method.</p>
            <p style={{ marginTop: '0.75rem' }}>Refunds for purchases made in the app follow Google Play&apos;s refund policy, and you ask Google for them through Google Play. The website rules do not apply to them. If Google refunds a purchase, we take back what it gave: Pro from a refunded subscription ends unless you have other paid access, and credits from a refunded credit pack are removed, down to zero and never below it. If you think a Google Play charge is wrong, email support@mockmob.in with your Google order number and we will check it.</p>
            <p style={{ marginTop: '0.75rem' }}>If a renewal payment fails, Google retries it and tells us. Pro stays on while Google keeps the subscription in its grace period, and stops if Google puts the subscription on hold or ends it.</p>
            <p style={{ marginTop: '0.75rem' }}>Credit packs bought in the app are one-time purchases, and their credits do not expire.</p>
            <p style={{ marginTop: '0.75rem' }}>If you delete your MockMob account, we cancel the renewal of your Play subscription with Google before the account is deleted, so no further payment is taken. Deleting your account does not refund the month you already paid for, and any credits left in your wallet are removed with the account.</p>
          </section>
          {monthlyOpen ? (
            <>
              <section>
                <h2>Monthly Pro and cancelling</h2>
                <p>On the website, monthly Pro is ₹99 a month and renews automatically until you cancel. You can cancel at any time in Account, under Plan, with Cancel renewal. Cancelling stops the next charge. You keep Pro until the end of the month you already paid for, then your account moves to Free. Your history and saved questions stay.</p>
                <p style={{ marginTop: '0.75rem' }}>A month that has been charged is not refunded when you cancel. To avoid the next charge, cancel before the paid-through date shown in Account, under Plan.</p>
              </section>
              <section>
                <h2>One-time Pro access</h2>
                <p>Pro access bought as a single payment ends 31 July 2027, with no auto-renewal and nothing to cancel. It keeps its full term, including now that monthly Pro is on sale.</p>
              </section>
              <section>
                <h2>If a renewal payment fails</h2>
                <p>On the website, if a monthly charge does not go through, Razorpay retries it a few times and emails you. Pro stays active until the end of the month you paid for. If the payment still fails, the plan stops and your account moves to Free. You can start Pro again from the pricing page.</p>
              </section>
            </>
          ) : (
            <section>
              <h2>Cancellations</h2>
              <p>Current CUET 2027 access is a one-time payment ending 31 July 2027, with no auto-renewal and nothing to cancel.</p>
              <p style={{ marginTop: '0.75rem' }}>On the website, monthly Pro at ₹99 a month is not on sale yet. When it opens, it will renew automatically until you cancel. You will be able to cancel at any time in Account, under Plan. Cancelling will stop the next charge and you will keep Pro until the end of the month you already paid for. A month that has been charged is not refunded. Your one-time access keeps its full term.</p>
            </section>
          )}
          <section>
            <h2>Failed or duplicate payments on the website</h2>
            <p>Failed, duplicate, or gateway-side settlement issues are not treated as voluntary refunds. We will check Razorpay records and help resolve payment-provider errors according to their timeline.</p>
          </section>
          <section>
            <h2>Support details</h2>
            <p>When mailing us, include your registered email, payment date, amount, and transaction reference (for the app, your Google order number) so we can identify the subscription or payment quickly.</p>
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
