import React from 'react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';

export const metadata = {
  title: 'Terms of Service | MockMob',
  description: 'Terms for using MockMob.',
};

export default function TermsPage() {
  return (
    <div className="view min-h-screen">
      <NavBar />
      <main className="container-narrow px-5 pb-20 pt-32">
        <div className="eyebrow mb-3">{'// Legal'}</div>
        <h1 className="display-lg mb-5">Terms of Service</h1>
        <p className="mb-10 text-zinc-400">Last updated: April 27, 2026</p>

        <div className="legal-copy">
          <section>
            <h2>Using MockMob</h2>
            <p>MockMob is an exam preparation platform. You agree to use it for lawful study, practice, and community contribution purposes only.</p>
          </section>
          <section>
            <h2>Accounts</h2>
            <p>You are responsible for the accuracy of your account information and for activity under your account. Do not share login access, abuse credits, scrape content, or bypass premium restrictions.</p>
          </section>
          <section>
            <h2>Community submissions</h2>
            <p>When you upload questions or explanations, you confirm you have the right to share them and allow MockMob to review, edit, display, rank, remove, or use them to improve the question pool.</p>
          </section>
          <section>
            <h2>Premium access</h2>
            <p>Pro access unlocks premium features such as unlimited mocks, Radar, difficulty controls, bookmarks, and Admission Compass. Feature availability can evolve as we improve the product.</p>
          </section>
          <section>
            <h2>Exam affiliation</h2>
            <p>MockMob is not affiliated with NTA, DU, CUET, or any government exam body. Scores, bands, recommendations, and analysis are practice guidance, not official admission decisions.</p>
          </section>
          <section>
            <h2>Misuse</h2>
            <p>We may restrict or terminate access for spam, cheating, harassment, reverse engineering, payment abuse, harmful uploads, or attempts to compromise the platform.</p>
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
