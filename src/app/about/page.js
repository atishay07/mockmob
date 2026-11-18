import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { CORRECTIONS_LISTED } from '@/../data/corrections_listed.mjs';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { PublicDock } from '@/components/PublicDock';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { PublicHeroArt, PUBLIC_HERO_CSS } from '@/components/landing/PublicHeroArt';
import { Marked } from '@/components/doodle/Doodle';
import { PUBLIC_MARKS } from '@/lib/publicMarks.mjs';
import { PUBLIC_SUBJECT_COUNT } from '@/../data/subject_claim';
import { publicInventory } from '@/lib/server/inventory';
import { publicStatsView } from '@/lib/server/publicStats';
import DU_RULES from '@/../public/du/2026/rules.json';
import '@/app/pub-pages.css';

export const metadata = seoMetadata({
  title: 'About MockMob — The CUET-First Mock Test Platform',
  description:
    'Why MockMob exists: one exam, obsessive focus, machine-validated questions, and honest analytics for CUET aspirants targeting DU and beyond.',
  path: '/about',
});

// The bank's question count is the stored daily inventory row (one small read, the same publicInventory the subject pages and
// /api/stats read), so the page is rebuilt at most hourly, as the subject pages are.
export const revalidate = 3600;

// Each principle leads with the live figure that backs it, when the code holds one (19 Nov 2026, lane pub-c): the public bank's
// question count (publicStatsView, the home page's /api/stats figure; unknown is no figure, never zero), the 15 CUET subjects
// (data/subject_claim.js) and the DU courses the 2026 rules cover (public/du/2026/rules.json, the file the home page's DU
// calculator counts). `figure` names which one; a principle without one keeps only its words.
async function liveBankSize() {
  try {
    const view = publicStatsView(await publicInventory());
    return view?.state === 'available' && Number.isFinite(view.bankSize) && view.bankSize > 0 ? view.bankSize : null;
  } catch {
    return null;
  }
}

const DU_COURSES = Array.isArray(DU_RULES?.groups) && DU_RULES.groups.length > 0 ? DU_RULES.groups.length : null;
const figureOf = (key, bank) => {
  const value = { subjects: PUBLIC_SUBJECT_COUNT, bank, courses: DU_COURSES }[key];
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value: value.toLocaleString('en-IN'), unit: { subjects: 'CUET subjects', bank: 'questions', courses: 'DU courses' }[key] };
};

const BELIEFS = [
  {
    figure: 'subjects',
    title: 'One exam, all the way down',
    body: 'MockMob focuses on CUET UG, from practice and review to sourced DU eligibility and historical cutoff tools. CUET is the product’s only exam focus.',
  },
  {
    figure: 'bank',
    title: 'Receipts over reviews',
    // R8 PUB-14: confident, true statements; no defensive notes (owner rule 6).
    body: 'Live counts instead of testimonials. The bank size on this site is counted from the bank itself, and every result shows exactly where its marks went.',
  },
  {
    title: 'The question bank is engineered, not scraped',
    body: 'Every question passes schema, answer-key, duplicate and difficulty checks before it reaches you, and anything uncertain is held back. If a key looks wrong, report it from your result and we recheck it.',
    // 16 Nov 2026: every mistake we have found and what we did, dated (src/app/corrections).
    ...(CORRECTIONS_LISTED ? { link: { href: '/corrections', label: 'See every correction we have made' } } : {}),
  },
  {
    figure: 'courses',
    title: 'A score should tell you what to do next',
    body: 'Every mock ends with a next move. Chapter review ranks the chapters costing you marks, and Admission Compass checks your DU courses against sourced eligibility rules and historical cutoffs.',
  },
];

export default async function AboutPage() {
  const bank = await liveBankSize();
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
              <h1 className="mm-h1"><Marked text="Built for one exam: CUET." marks={[PUBLIC_MARKS.about.head]} /></h1>
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
            <dl className="ab-tiles">
              {BELIEFS.map((belief) => {
                const fig = belief.figure ? figureOf(belief.figure, bank) : null;
                return (
                <div key={belief.title} className="ab-tile" data-fig={fig ? 'true' : undefined}>
                  <dt>{belief.title}</dt>
                  {fig ? <dd className="ab-fig"><b>{fig.value}</b> <span>{fig.unit}</span></dd> : null}
                  <dd className="ab-body">
                    {belief.body}
                    {belief.link ? (
                      <>
                        {' '}
                        <Link href={belief.link.href} className="mm-link mm-link--inline">{belief.link.label}</Link>.
                      </>
                    ) : null}
                  </dd>
                </div>
                );
              })}
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
                Sign up free
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
