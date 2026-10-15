import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import MobiReact from '@/components/brand/MobiReact';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import '@/app/public-polish.css';

export const metadata = seoMetadata({
  title: 'About MockMob: The CUET-First Mock Test Platform',
  description:
    'Why MockMob exists: one exam, automated answer-key checks, and an honest record of which chapters cost you marks, for CUET aspirants targeting DU and beyond.',
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
    body: 'A mock should help you choose what to do next. Your record organizes practice history by subject and chapter, Mistake Repair explains the answers you got wrong, and the Cutoff calculator checks programme eligibility and sourced historical cutoffs separately from practice marks.',
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
          <div className="mm-wrap mm-wrap--tight">
            <h1 className="mm-h1">Built for one exam.</h1>
            <p className="mm-lead" style={{ marginTop: '1rem', maxWidth: '52ch' }}>
              CUET preparation brings subject practice, review, and university requirements into
              one demanding season. We are a small independent team, founded by Atishay Jain,
              building the platform we wished existed. MockMob is a Score Recovery platform: it finds the
              marks you lost, helps you fix each mistake, and points you at the chapter to practise next.
            </p>
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
            <div className="mm-about-mobi">
              <div className="mm-about-mobi__art" aria-hidden="true">
                <MobiReact act="idle" size={104} still />
              </div>
              <div>
                <h2 className="mm-h2">Meet Mobi.</h2>
                <p className="mm-body" style={{ marginTop: '1rem' }}>
                  Mobi is the small mascot who keeps you company between questions. He reacts when you
                  finish a session, and he stays out of the way during a timed mock.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Independent, and clear about it.</h2>
            <p className="mm-body" style={{ marginTop: '1rem' }}>
              MockMob is not affiliated with NTA, Delhi University, or any exam body. We are an
              independent practice platform. Payments are processed by Razorpay, and our refund
              policy is written in plain language on the{' '}
              <Link href="/refunds" className="mm-link">
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
      <MobileDock note="One exam. Done properly." />
    </div>
  );
}
