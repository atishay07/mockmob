import React from 'react';
import { LegalPage } from '@/components/LegalPage';
import { seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'Terms of Service | MockMob',
  description: 'Read the terms for using MockMob mock tests, community questions, premium features, and accounts.',
  path: '/terms',
});

const SECTIONS = [
  {
    heading: 'Using MockMob',
    body: ['MockMob is an exam preparation platform. You agree to use it for lawful study, practice, and community contribution purposes only.'],
  },
  {
    heading: 'Accounts',
    body: ['You are responsible for the accuracy of your account information and for activity under your account. Do not share login access, abuse credits, scrape content, or bypass premium restrictions.'],
  },
  {
    heading: 'Community submissions',
    body: ['When you upload questions or explanations, you confirm you have the right to share them and allow MockMob to review, edit, display, rank, remove, or use them to improve the question pool.'],
  },
  {
    heading: 'Premium access',
    body: ['Pro access unlocks premium features such as unlimited mocks, Radar, difficulty controls, bookmarks, and Admission Compass. Current season access ends 31 July 2027. Available inventory and reattempts are included; unlimited unique questions are not promised. Existing purchases keep their recorded expiry and rights. DU eligibility and historical cutoffs are free. Recovery is unavailable until its content and journey gates pass.'],
  },
  {
    heading: 'Exam affiliation',
    body: ['MockMob is not affiliated with NTA, DU, CUET, or any government exam body. Scores, bands, recommendations, and analysis are practice guidance, not official admission decisions.'],
  },
  {
    heading: 'Misuse',
    body: ['We may restrict or terminate access for spam, cheating, harassment, reverse engineering, payment abuse, harmful uploads, or attempts to compromise the platform.'],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      current="terms"
      title="Terms of service"
      updated="2 October 2026"
      updatedIso="2026-10-02"
      sections={SECTIONS}
    />
  );
}
