import React from 'react';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Privacy Policy | MockMob',
  description: 'Read how MockMob collects, uses, and protects student account, practice, and payment data.',
  path: '/privacy',
});

const SECTIONS = [
  {
    heading: 'What we collect',
    body: ['We collect account details you provide, login information, selected subjects, mock attempts, saved questions, uploaded questions, votes, bookmarks, and payment status needed to run MockMob.'],
  },
  {
    heading: 'How we use it',
    body: ['We use your data to deliver mocks, track progress, power Radar analytics, provide sourced DU eligibility and historical comparisons, prevent abuse, moderate community questions, process payments, and improve the product.'],
  },
  {
    heading: 'Optional usage data (from 12 October 2026)',
    body: ['If you confirm you are 18 or older, you can choose Allow usage data to improve MockMob in Profile. It is off by default and stays off for people under 18 or who have not said. When on, we record which screens and steps were used, such as starting a session or opening a result, with the app version. We never collect answers, marks, free text or contacts. It is first-party only: no third-party tracking and no advertising. We keep it for 180 days. You can withdraw at any time, and withdrawing deletes what was collected.'],
  },
  {
    heading: 'Android app',
    body: ['The Android app stores your push notification token so we can send reminders, plus your notification preferences and study goal. These are linked to your account and removed when your account is deleted. You can turn notifications off in the app or in your phone settings.'],
  },
  {
    heading: 'Deleting your account',
    body: [
      <>
        Open Profile, then Delete account, or email support@mockmob.in from your account email. We delete your account and study records within 30 days. Payment records required by law are kept. Details are on the{' '}
        <Link href="/account-deletion">account deletion page</Link>.
      </>,
    ],
  },
  {
    heading: 'Practice events and optional AI',
    body: ['New sessions may record answers, answer changes, visits and elapsed times. These are device observations and are not assumed to explain why a question was skipped. Session snapshots, learning observations and corrections preserve history. Core recovery does not require paid AI. Optional AI, when enabled, sends your prompt and a compact study summary to the configured provider; it does not need your full raw attempt history. PrepOS currently explains the shared plan without a paid model call.'],
  },
  {
    heading: 'Retention and requests',
    body: ['Account and practice records remain while your account is active. Payment and fraud-prevention records may remain after a deletion request where reconciliation or legal obligations require them. Usage data is kept for 180 days. Deletion requests are handled within 30 days as described below. Request an export at support@mockmob.in.'],
  },
  {
    heading: 'Payments',
    body: ['Payments are handled by Razorpay. MockMob stores subscription and access status, but does not store full card, UPI, or bank credentials on our servers.'],
  },
  {
    heading: 'Community content',
    body: ['Questions, explanations, votes, and other community contributions are checked by automated systems. Uncertain recovery content is withheld; routine human review is not promised.'],
  },
  {
    heading: 'Your choices',
    body: ['You can stop using the service, request account help, or ask us to review account-related information. Some records may be retained where needed for fraud prevention, legal compliance, or payment reconciliation.'],
  },
  {
    heading: 'Contact',
    body: ['For privacy, export or account-deletion requests, email support@mockmob.in from your registered address. Include a payment reference for billing issues; do not send card or bank credentials.'],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      current="privacy"
      title="Privacy policy"
      updated="12 October 2026"
      updatedIso="2026-10-12"
      sections={SECTIONS}
    />
  );
}
