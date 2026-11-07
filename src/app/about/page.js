import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { PublicHeroArt, PUBLIC_HERO_CSS } from '@/components/landing/PublicHeroArt';

export const metadata = seoMetadata({
  title: 'About MockMob — The CUET-First Mock Test Platform',
  description:
    'Why MockMob exists: one exam, obsessive focus, machine-validated questions, and honest analytics for CUET aspirants targeting DU and beyond.',
  path: '/about',
});

const BELIEFS = [
  {
    title: 'One exam, all the way down',
    body: 'MockMob focuses on CUET UG, from practice and review to sourced DU eligibility and historical cutoff tools. CUET is the product’s only exam focus.',
  },
  {
    title: 'Receipts over reviews',
    // R8 PUB-14: confident, true statements; no defensive notes (owner rule 6).
    body: 'Live counts instead of testimonials. The bank size on this site is counted from the bank itself, and every result shows exactly where its marks went.',
  },
  {
    title: 'The question bank is engineered, not scraped',
    body: 'Every question passes schema, answer-key, duplicate and difficulty checks before it reaches you, and anything uncertain is held back. If a key looks wrong, report it from your result and we recheck it.',
  },
  {
    title: 'A score should tell you what to do next',
    body: 'Every mock ends with a next move. Chapter review ranks the chapters costing you marks, and Admission Compass checks your DU programmes against sourced eligibility rules and historical cutoffs.',
  },
];

export default function AboutPage() {
  return (
    <div className="mm">
      <JsonLd
        id="about-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />
      <NavBar />

      <main id="main-content">
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap mm-wrap--tight pub-hero">
            <div>
              <h1 className="mm-h1">Built for one exam: CUET.</h1>
              <p className="mm-lead" style={{ marginTop: '1rem', maxWidth: '52ch' }}>
                CUET preparation brings subject practice, review, and university requirements into
                one demanding season. We are a small independent team, founded by Atishay Jain,
                building the platform we wished existed.
              </p>
            </div>
            <PublicHeroArt kind="campus" />
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">What we hold to.</h2>
            <dl className="mm-beliefs">
              {BELIEFS.map((belief) => (
                <div key={belief.title} className="mm-belief">
                  <dt>{belief.title}</dt>
                  <dd>{belief.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mm-section mm-section--sunken">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Payments and refunds.</h2>
            <p className="mm-body" style={{ marginTop: '1rem' }}>
              Payments are processed by Razorpay, and our refund policy is written in plain
              language on the{' '}
              <Link href="/refunds" className="mm-link mm-link--inline">
                refunds page
              </Link>
              .
            </p>
            <div className="mm-actions" style={{ marginTop: '2rem' }}>
              <Link href="/signup" className="mm-btn mm-btn--primary">
                Start free
              </Link>
              <Link href="/contact" className="mm-btn mm-btn--secondary">
                Talk to us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <PublicDock />
      <style>{PUBLIC_HERO_CSS}</style>
    </div>
  );
}
