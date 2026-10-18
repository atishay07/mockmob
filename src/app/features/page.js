import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { PublicHeroArt, PUBLIC_HERO_CSS } from '@/components/landing/PublicHeroArt';

// What MockMob does, one plain row per part of the product, each with what it is for and where it lives.
// The names are the ones students meet signed in. No eyebrows, orbs, badges, numbered circles or sample
// numbers dressed as results: a student reads the list and picks where to start.
export const metadata = seoMetadata({
  title: 'CUET Practice Features, Chapter Review & Admission Compass | MockMob',
  description: 'What MockMob does for CUET UG: timed practice marked +5 / −1, the NTA-style screen, mistake review, chapter review, saved questions, Ask Mobi and the free DU cutoff calculator.',
  path: '/features',
});

const PARTS = [
  {
    title: 'Practice',
    body: 'Quick practice of 5 to 20 questions, or a 50-question Full mock in 60 minutes, timed and marked +5 / −1 the way CUET marks it. Close the tab mid-test and pick up where you left off.',
    href: '/signup', link: 'Start free',
  },
  {
    title: 'NTA mode',
    body: 'The exam-style screen, so the real paper does not feel new on the day. With Pro.',
    href: '/pricing', link: 'See Pro',
  },
  {
    title: 'Review and Mistake Repair',
    body: 'Every miss from a session lands in Review with its explanation. Repair one, then a fresh question on the same idea comes back later to check the fix held.',
    href: '/signup', link: 'Create a free account',
  },
  {
    title: 'Chapter review',
    body: 'Your misses traced back to their chapters, built only from questions you attempted. Free after every mock; Pro adds pace and changed-answer detail.',
    href: '/signup', link: 'Create a free account',
  },
  {
    title: 'Saved questions',
    body: 'Keep the questions that deserve another go and practise their chapter from the same row. 25 on Free.',
    href: '/signup', link: 'Create a free account',
  },
  {
    title: 'Ask Mobi',
    body: 'One next step from your own practice record, sized to the time you have. Questions about your record are free; written replies use credits from your one balance, 1 a reply, and everyone gets 50 free a month.',
    href: '/pricing/ai-credits', link: 'How credits work',
  },
  {
    title: 'DU cutoff calculator',
    body: 'Which DU programmes your CUET subjects open under the 2026 Bulletin rules, and the published 2026 cutoffs by category and round. Free for everyone, no account needed.',
    href: '/cuet-cutoff-calculator', link: 'Open the calculator',
  },
  {
    title: 'Subject combination planner',
    body: 'Pick the courses you want and the subjects you could take; it ranks the combinations that keep those courses open.',
    href: '/cuet-subject-combination', link: 'Plan your subjects',
  },
  {
    title: 'Your standing',
    body: 'Your own rank among MockMob students, from your recorded mocks. You see your rank and your average; no other student’s name is shown. It is separate from your CUET exam rank.',
    href: '/signup', link: 'Create a free account',
  },
];

export default function FeaturesPage() {
  return (
    <div className="mm">
      <JsonLd
        id="features-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
        ])}
      />
      <NavBar />

      <main>
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap mm-wrap--tight pub-hero">
            <div>
              <h1 className="mm-h1">What MockMob does</h1>
              <p className="mm-lead" style={{ marginTop: '1rem' }}>
                CUET UG practice that shows where your marks went and what to do next, plus free tools for DU admissions.
              </p>
            </div>
            <PublicHeroArt kind="subjects" />
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <ul className="ft-list">
              {PARTS.map((part) => (
                <li key={part.title}>
                  <h2>{part.title}</h2>
                  <p>{part.body}</p>
                  <Link href={part.href} className="mm-link">{part.link}</Link>
                </li>
              ))}
            </ul>
            <p style={{ marginTop: '2rem' }}>
              <Link href="/signup" className="mm-btn mm-btn--primary">Start free</Link>
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <style>{`${PUBLIC_HERO_CSS}
        .ft-list { list-style: none; margin: 0; padding: 0; border-bottom: 1px solid var(--line); }
        .ft-list li { display: grid; gap: 0.375rem; padding: 1.25rem 0; border-top: 1px solid var(--line); }
        .ft-list h2 { margin: 0; font: 700 1.1875rem/1.3 var(--font-display); letter-spacing: -0.01em; color: var(--ink); }
        .ft-list p { margin: 0; max-width: 64ch; font-size: 1rem; line-height: 1.6; color: var(--ink-2); }
        .ft-list .mm-link { justify-self: start; display: inline-flex; align-items: center; min-height: 44px; }
      `}</style>
    </div>
  );
}
