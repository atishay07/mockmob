import React from 'react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { seoMetadata } from '@/lib/seo';
import { APP_STREAM_AND_REPORT_LIVE } from '@/lib/appReleaseGates.mjs';
import { MobPrivacySection, mobEnabledForLegal } from '@/components/mob/MobLegal';

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
        <p className="mb-10 text-zinc-400">Last updated: {mobEnabledForLegal() ? '17 October 2026' : '16 October 2026'}</p>

        <div className="legal-copy">
          <section>
            <h2>What we collect</h2>
            <p>We collect account details you provide, login information, selected subjects, mock attempts, saved questions, uploaded questions, votes, bookmarks, and payment status needed to run MockMob.</p>
          </section>
          <section>
            <h2>How we use it</h2>
            <p>We use your data to deliver mocks, track progress, power chapter review, provide sourced DU eligibility and historical comparisons, prevent abuse, moderate community questions, process payments, and improve the product.</p>
          </section>
          <section>
            <h2>Optional usage data (from 12 October 2026)</h2>
            <p>If you confirm you are 18 or older, you can choose Allow usage data to improve MockMob in Profile. It is off by default and stays off for people under 18 or who have not said. When on, we record which screens and steps were used, such as starting a session or opening a result, with the app version. We never collect answers, marks, free text or contacts. It is first-party only: no third-party tracking and no advertising. We keep it for 180 days. You can withdraw at any time, and withdrawing deletes what was collected.</p>
          </section>
          {/* Held until the app build with the stream events and the Report this reply button is live (appReleaseGates.mjs). */}
          {APP_STREAM_AND_REPORT_LIVE ? (<>
          <section>
            <h2>Question stream activity (required in the app)</h2>
            <p>When you are signed in, the Android app sends three kinds of event about the questions in the question stream: seen (a question was shown to you), attempted (you picked an answer; the event carries the option you picked and whether it was right) and skip (you moved on without answering). Each event carries your account, the question, how you were using the stream and how long the question was on screen. We need these to run the app: they update your learning progress, and they let us check that a like or a save comes from someone who actually saw the question. They are a required part of using the stream, separate from the optional usage data above, so turning that off does not stop them. They are first-party only, never used for advertising and never shared with anyone else. They are kept with your account and deleted with it, within 30 days of a deletion request.</p>
          </section>
          <section>
            <h2>Reporting an AI reply</h2>
            <p>Replies written by AI in the app have a Report this reply button. When you use it, we keep the reason you chose (from a short list), the text of that reply, and the date, linked to your account, so we can check the reply and improve it. You can only report a reply you were sent. We read reports to check replies; we do not use them for advertising. They are deleted with your account.</p>
          </section>
          </>) : null}
          {/* The Mob (SOCIAL-SPEC P12): shown in the same change that turns the Mob on. */}
          {mobEnabledForLegal() ? <MobPrivacySection /> : null}
          <section>
            <h2>Android app</h2>
            <p>The Android app stores your push notification token so we can send reminders, plus your notification preferences and study goal. These are linked to your account and removed when your account is deleted. You can turn notifications off in the app or in your phone settings.</p>
          </section>
          <section>
            <h2>Deleting your account</h2>
            <p>Open Profile, then Delete account, or email support@mockmob.in from your account email. We delete your account and study records within 30 days. Payment records required by law are kept. Details are on the <a href="/account-deletion">account deletion page</a>.</p>
          </section>
          <section>
            <h2>Practice events and optional AI</h2><p>New sessions may record answers, answer changes, visits and elapsed times. These are device observations and are not assumed to explain why a question was skipped. Session snapshots, learning observations and corrections preserve history. Core recovery does not require paid AI. Ask Mobi answers questions about your own record on the spot. Any other question you ask, with a short summary of your record, is sent to an AI service that writes the reply for MockMob; it uses 1 credit for a Mobi job (a doubt with its follow-up, or a mistake fixed for good), shown before you send it, and can be wrong. It does not need your full raw attempt history.</p></section><section><h2>Retention and requests</h2><p>Account and practice records remain while your account is active. Payment and fraud-prevention records may remain after a deletion request where reconciliation or legal obligations require them. Usage data is kept for 180 days. Deletion requests are handled within 30 days as described below. Request an export at support@mockmob.in.</p></section><section><h2>Payments</h2>
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
