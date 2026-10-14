import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { PublicHero, PageClose } from '@/components/PublicPage';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';

export const metadata = seoMetadata({
  title: 'About MockMob: the CUET-first mock test platform',
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
    body: 'We show product counters when they are available and describe the checks behind our content. We do not use testimonials or score outcomes as proof.',
  },
  {
    title: 'The question bank is engineered, not scraped',
    body: 'Our content pipeline uses schema checks, answer-key checks, duplicate detection, and difficulty tagging. These checks help catch defects; they are not proof that every question is correct.',
  },
  {
    title: 'A score should tell you what to do next',
    body: 'A mock should help you choose what to do next. Weak chapters (Radar) organizes practice history by subject and chapter, while DU Compass (Admission Compass) checks programme eligibility and sourced historical cutoffs separately from practice marks.',
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
        <PublicHero
          enter
          title="Built for one exam."
          lead="CUET preparation brings subject practice, review, and university requirements into one demanding season. We are a small independent team, founded by Atishay Jain, building the platform we wished existed."
        />

        <section className="pp-section pp-section--sunken" aria-labelledby="about-hold">
          <div className="mm-wrap">
            <div className="pp-split">
              <div className="pp-split__head">
                <h2 id="about-hold" className="pp-h2">What we hold to.</h2>
              </div>
              <dl className="pp-defs">
                {BELIEFS.map((belief) => (
                  <div key={belief.title} className="pp-def">
                    <dt>{belief.title}</dt>
                    <dd>{belief.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="pp-section" aria-labelledby="about-independent">
          <div className="mm-wrap">
            <div className="pp-split">
              <div className="pp-split__head">
                <h2 id="about-independent" className="pp-h2">Independent, and clear about it.</h2>
              </div>
              <div className="pp-stack">
                <p className="pp-body">
                  MockMob is not affiliated with NTA, Delhi University, or any exam body. We are an
                  independent practice platform. Payments are processed by Razorpay, and our refund
                  policy is written in plain language on the{' '}
                  <Link href="/refunds" className="pp-link">refunds page</Link>.
                </p>
                <p className="pp-body">
                  Spotted something wrong or unclear? <Link href="/contact" className="pp-link">Tell us</Link>.
                </p>
              </div>
            </div>
          </div>
        </section>

        <PageClose
          title="See it on your own questions."
          body="Create a free account and sit a timed mock on your subjects tonight. No card needed."
          secondary={[{ href: '/contact', label: 'Talk to us' }]}
        />
      </main>

      <MarketingFooter />
      <MobileDock note="One exam. Done properly." />
    </div>
  );
}
