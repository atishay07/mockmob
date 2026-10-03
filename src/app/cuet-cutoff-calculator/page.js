import Link from 'next/link';
import { Check, ExternalLink } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { JsonLd } from '@/components/JsonLd';
import { CutoffCalculator } from '@/components/du/CutoffCalculator';
import { DU_SOURCES } from '@/lib/du/sources';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';
import '@/app/landing.css';

export const metadata = seoMetadata({
  title: 'DU Eligibility & Cutoff Calculator for CUET | MockMob',
  description:
    'Free tool: pick your CUET subjects, see every Delhi University programme you are eligible for, and compare the previous year’s college-wise cutoffs for your category.',
  path: '/cuet-cutoff-calculator',
});

const faqs = [
  {
    question: 'Is the DU eligibility and cutoff calculator free?',
    answer: 'Yes. It is free for everyone and needs no account. Your selections stay in your browser and in the link you share.',
  },
  {
    question: 'Where do the eligibility rules and cutoffs come from?',
    answer:
      'Eligibility comes from the University of Delhi UG Bulletin of Information 2026-27. Cutoffs are the minimum allocation scores DU published for Round I, Round II and Round III of CSAS UG 2026. The sources are linked on this page.',
  },
  {
    question: 'Will the 2027 cutoffs be the same as these?',
    answer:
      'No. Cutoffs change every year with the number of applicants, difficulty and seats. Treat them as a reference for the 2026 cycle, not a prediction. Rules for 2027 stay provisional until DU publishes its next Bulletin.',
  },
  {
    question: 'What score should I enter?',
    answer:
      'DU ranks candidates on a programme-specific CUET score and shows it on the CSAS dashboard after results. Before results, enter a target score to compare it with published 2026 cutoffs. Your MockMob mock score is not the same scale.',
  },
  {
    question: 'Why does a reserved-category candidate see the lower of two cutoffs?',
    answer:
      'DU states that the Unreserved merit list includes every candidate whatever their category. So a candidate can clear on the Unreserved cutoff or on their own category cutoff. This tool compares your score with the lower of the two and marks the seats where the Unreserved cutoff applies.',
  },
  {
    question: 'What does "considered only if seats remain" mean?',
    answer:
      'For some language Honours programmes the Bulletin ranks candidates who use the general combinations after candidates who meet the language-specific ones. You are eligible, but you are considered only if seats are left.',
  },
  {
    question: 'Does MockMob guarantee admission?',
    answer:
      'No. MockMob is an independent preparation platform and is not affiliated with DU or NTA. This tool helps you plan. Admission depends on your score, your category, seat availability and DU’s rules.',
  },
];

export default function CutoffCalculatorPage() {
  return (
    <div className="mm lp du-page">
      <JsonLd id="du-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'DU eligibility and cutoff calculator', path: '/cuet-cutoff-calculator' }])} />
      <JsonLd id="du-faq-json-ld" data={faqJsonLd(faqs)} />
      <NavBar />
      <main id="main-content">
        <section className="du-hero">
          <div className="lp-bg lp-bg--static" aria-hidden="true">
            <div className="lp-bg__aurora" />
            <div className="lp-bg__grid" />
            <div className="lp-bg__dots" />
          </div>
          <div className="mm-wrap du-hero__inner">
            <h1 className="du-title">
              Which DU courses can you get?
              <span> Check eligibility and published 2026 cutoffs.</span>
            </h1>
            <p className="lp-lead">
              Pick your CUET subjects. See every Delhi University programme you can apply to, then open any one for the
              previous year’s college-wise cutoffs in your category.
            </p>
            <ul className="lp-trust du-hero__facts">
              <li><Check size={16} aria-hidden="true" />Free, no signup</li>
              <li><Check size={16} aria-hidden="true" />DU’s official 2026 documents</li>
              <li><Check size={16} aria-hidden="true" />Every cutoff checked against the source</li>
            </ul>
          </div>
        </section>

        <section className="du-tool">
          <div className="mm-wrap">
            <CutoffCalculator />
          </div>
        </section>

        <section className="du-info" aria-labelledby="du-how">
          <div className="mm-wrap du-info__grid">
            <div>
              <h2 id="du-how" className="lp-h2">How to read this</h2>
              <p className="lp-sub">
                A cutoff is the lowest score DU allocated a seat at, in one round. These records describe 2026. They do not
                predict a future allocation or promise a seat.
              </p>
            </div>
            <ol className="du-steps">
              <li>
                <h3 className="lp-h4">Eligibility is exact</h3>
                <p>
                  Each programme lists the subject combinations DU accepts. You are eligible if any combination fits the
                  subjects you tick. Taking extra subjects never hurts.
                </p>
              </li>
              <li>
                <h3 className="lp-h4">Cutoffs come in three rounds</h3>
                <p>
                  Round I is usually the highest. Rounds II and III show how far cutoffs fell as seats stayed vacant. Round
                  III scores are independent of the earlier rounds.
                </p>
              </li>
              <li>
                <h3 className="lp-h4">Plan from the range, not one number</h3>
                <p>
                  A seat you would have cleared in Round I is a strong sign. A seat you clear only in Round III is a reach
                  that depends on vacancies.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="du-info du-info--band" aria-labelledby="du-sources">
          <div className="mm-wrap du-info__grid">
            <div>
              <h2 id="du-sources" className="lp-h2">Built from DU’s own documents</h2>
              <p className="lp-sub">
                We extracted the published tables, then checked every score against the source files. If DU corrects a list,
                the source documents win.
              </p>
            </div>
            <ul className="du-sources">
              {DU_SOURCES.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    <span>
                      <strong>{s.title}</strong>
                      <em>{s.use}</em>
                    </span>
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="du-info" aria-labelledby="du-faq">
          <div className="mm-wrap mm-wrap--tight">
            <h2 id="du-faq" className="lp-h2">Questions students ask</h2>
            <div className="mm-faqs">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="mm-faq">
                  <summary>{question}</summary>
                  <div className="mm-faq__body">{answer}</div>
                </details>
              ))}
            </div>
            <p className="du-disclaimer">
              MockMob is an independent exam preparation platform and is not affiliated with the University of Delhi or NTA.
              Read the official documents before you decide. <Link href="/cuet-2027" className="lp-link">CUET 2027 guide</Link>
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
