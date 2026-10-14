import React from 'react';
import { LegalPage } from '@/components/LegalPage';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Refund Policy | MockMob',
  description: 'Read MockMob no-refund and cancellation guidance for Pro subscriptions.',
  path: '/refunds',
});

const SECTIONS = [
  {
    heading: 'No refunds',
    body: ['MockMob does not allow refunds for completed payments, subscriptions, PrepOS credit packs, or consumed billing periods. Please review the plan, price, and feature details before purchase.'],
  },
  {
    heading: 'Cancellations',
    body: ['Current CUET 2027 access is a one-time payment ending 31 July 2027, with no auto-renewal. Historical recurring subscriptions, if still active, can be cancelled to stop future renewals while preserving their paid period.'],
  },
  {
    heading: 'How to cancel',
    body: ['For historical recurring subscriptions only, cancel from your auto-payment or Razorpay mandate screen before the next billing date. If you need help, mail us from your registered email with your payment reference and cancellation request.'],
  },
  {
    heading: 'Failed or duplicate payments',
    body: ['Failed, duplicate, or gateway-side settlement issues are not treated as voluntary refunds. We will check Razorpay records and help resolve payment-provider errors according to their timeline.'],
  },
  {
    heading: 'Support details',
    body: ['When mailing us, include your registered email, payment date, amount, and transaction reference so we can identify the subscription or payment quickly.'],
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      current="refunds"
      title="Refund policy"
      updated="2 October 2026"
      updatedIso="2026-10-02"
      sections={SECTIONS}
    />
  );
}
