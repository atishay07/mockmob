import Link from 'next/link';
import { Check } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import ComboPlanner from '@/components/du/ComboPlanner';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';
import '@/components/du/du.css';
import './combo-planner.css';

export const metadata = seoMetadata({
  title: 'CUET Subject Combination Planner for DU | MockMob',
  description:
    'Free planner: choose the DU programmes you want and the subjects you could take. See which CUET subject combination unlocks the most, checked against DU’s published eligibility rules.',
  path: '/cuet-subject-combination',
});

const faqs = [
  {
    question: 'How many subjects can I choose in CUET?',
    answer: 'In the CUET UG 2026 cycle a candidate could choose up to five subjects, counting languages and the General Aptitude Test. The 2027 limit is provisional until NTA publishes its information bulletin, so the planner lets you test three, four or five.',
  },
  {
    question: 'How does the planner choose the best combination?',
    answer: 'It tries every combination of the subjects you ticked, up to your paper limit, and checks each one against the subject rules in the University of Delhi UG Bulletin 2026-27. Combinations are ranked by how many of your target programmes they meet, then by how many DU programmes they open in total, then by fewer papers.',
  },
  {
    question: 'Does meeting the subject rules mean I will get admission?',
    answer: 'No. Subject eligibility only means you may apply. Admission depends on your CUET score, your category, seats and DU’s rules for that year. Use the free cutoff calculator to compare published 2026 cutoffs.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. It needs no account, and your choices stay in your browser.',
  },
];

export default function ComboPlannerPage() {
  return (
    <div className="mm du-page">
      <JsonLd id="cp-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'CUET subject combination planner', path: '/cuet-subject-combination' }])} />
      <JsonLd id="cp-faq-json-ld" data={faqJsonLd(faqs)} />
      <NavBar />
      <main id="main-content">
        <section className="du-hero">
          <div className="mm-wrap du-hero__inner">
            <h1 className="du-title">
              CUET subject combination planner
              <span>Pick the subjects that open the most DU doors, before you fill the form.</span>
            </h1>
            <p className="du-lead">
              Choose the programmes you want and the subjects you could take. We check every possible combination against
              DU’s published subject rules and show the ones that get you there.
            </p>
            <ul className="du-trust du-hero__facts">
              <li><Check size={16} aria-hidden="true" />Free, no signup</li>
              <li><Check size={16} aria-hidden="true" />Every combination checked, not guessed</li>
              <li><Check size={16} aria-hidden="true" />DU UG Bulletin 2026-27 rules</li>
            </ul>
          </div>
        </section>

        <section className="du-tool">
          <div className="mm-wrap">
            <ComboPlanner />
          </div>
        </section>

        <section className="du-info" aria-labelledby="cp-faq">
          <div className="mm-wrap mm-wrap--tight">
            <h2 id="cp-faq" className="du-h2">Questions students ask</h2>
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
              Confirm the 2027 bulletins before you register. <Link href="/cuet-cutoff-calculator" className="du-link">Cutoff calculator</Link>
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <MobileDock note="Free. No signup." />
    </div>
  );
}
