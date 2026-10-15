import Link from 'next/link';
import { Check } from 'lucide-react';
import { publicOffer } from '@/lib/payments/offer';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { LandingActions } from '@/components/LandingActions';
import { SampleStage } from '@/components/landing/SampleStage';
import HowItWorks from '@/components/landing/HowItWorks';
import { SubjectGrid } from '@/components/landing/SubjectGrid';
import { FreeTools } from '@/components/landing/FreeTools';
import { LiveStatsBand, HeroLine } from '@/components/landing/LiveStatsBand';
import CreatorReels from '@/components/landing/CreatorReels';
import { MascotSeat } from '@/components/brand/Mascot';
import { INSTAGRAM, STATS_AS_OF, CREATOR_REELS, creatorReach, rankedReels } from '@/lib/social';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { BRAND_FLAGS, HERO_COPY } from '@/../data/brand_flags.mjs';
import { PLAN_FACTS, freePlanLines, proPlanLines } from '@/../data/plan_facts.mjs';
import { PUBLIC_SUBJECTS } from '@/../data/subject_art.mjs';
import { listWords } from '@/components/landing/words';
import './landing.css';
import './home-refinements.css';
import './social-proof.css';
import '@/components/landing/home.css';

// The landing (web IA plan section 4): 7 sections and the footer. One job per screen: the hero's
// sample is the first action, Start free sits in the header. Every number comes from plan_facts,
// publicOffer() or the live stats route. Nothing on this page plays by itself, and it never links
// into a signed-in page (the closing button for a signed-in student is the exception: Open MockMob).

const OFFER = publicOffer();
const MONTHLY = OFFER.purchasable === 'monthly';
// The owner's line (heroCopy 'owner') may ship only once the fresh check is live (N8).
const HERO = HERO_COPY[BRAND_FLAGS.heroCopy] || HERO_COPY.a;
const FREE_LINES = freePlanLines();
const PRO_LINES = proPlanLines();
const REPAIR_COST = PLAN_FACTS.aiCredits.repairCost.value;
// The creator band drops the smallest accounts (plan 4.2, section 6).
const REELS = rankedReels(CREATOR_REELS.filter((c) => creatorReach(c) >= 1000));

const faqs = [
  {
    question: 'What is MockMob?',
    answer: 'A CUET mock test and practice site for CUET UG 2027, in your own subjects. Take a timed mock, see which answers and chapters cost you marks, repair each mistake, then practise the weak chapter before your next mock.',
  },
  {
    question: 'Which subjects can I practise?',
    answer: `All ${PLAN_FACTS.subjects.count.value}: ${listWords(PUBLIC_SUBJECTS.map((s) => s.name))}.`,
  },
  {
    question: 'What is free?',
    answer: `The 5 sample questions on this page need no account. With a free account: ${FREE_LINES.join(' ')}`,
  },
  {
    question: 'What does Mistake Repair do, and what does it cost?',
    answer: `After a mock it takes your wrong answers one at a time: why your pick was tempting, why the key is right, what the other options mean, and a rule to remember. Explain it another way is included. Each mistake uses ${REPAIR_COST} AI credit. Free accounts get ${PLAN_FACTS.aiCredits.freeMonthly.value} AI credits a month, Pro gets ${PLAN_FACTS.aiCredits.proMonthly.value}.`,
  },
  {
    question: 'Is the NTA-style screen like the real one?',
    answer: `It follows the published CUET layout: the question palette, Mark for Review & Next, Save & Next, and +${PLAN_FACTS.marking.right.value} right, ${PLAN_FACTS.marking.wrong.value} wrong. It is NTA-style and independent of NTA, and the official 2027 screen may change. NTA mode comes with Pro; the preview on this page is free.`,
  },
  {
    question: 'Are you linked to NTA or DU?',
    answer: 'No. MockMob is independent and is not affiliated with NTA or DU.',
  },
];

export default function LandingPage() {
  return (
    <div className="mm lp lp-ia">
      <JsonLd id="home-breadcrumb-json-ld" data={breadcrumbJsonLd([{ name: 'Home', path: '/' }])} />
      <JsonLd id="home-faq-json-ld" data={faqJsonLd(faqs)} />
      <NavBar />
      <main id="main-content">
        {/* 1. Hero: what MockMob is, and question 1 ready to answer. */}
        <section className="lp-top" aria-labelledby="lp-title">
          <div className="mm-wrap lp-top__grid">
            <div className="lp-top__copy">
              <h1 className="lp-title" id="lp-title">{HERO.title}</h1>
              <p className="lp-lead">{HERO.lead}</p>
              <HeroLine />
            </div>
            <SampleStage />
          </div>
        </section>

        {/* 2. How it works: the loop, one real screen per step. */}
        <section className="lp-sec lp-sec--how" id="how-it-works" aria-labelledby="how-title">
          {/* The old exam preview anchor (/#exam-experience) lands on step 1, which holds it now. */}
          <span id="exam-experience" className="lp-anchor" aria-hidden="true" />
          <div className="mm-wrap">
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2" id="how-title">How it works</h2>
              <p className="lp-sub">Every mock ends with the next thing to fix. Choose a step to see its screen.</p>
            </div>
            <HowItWorks />
          </div>
        </section>

        {/* 3. Subjects: all 15. */}
        <section className="lp-sec" id="subjects" aria-labelledby="subjects-title">
          <div className="mm-wrap">
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2" id="subjects-title">{`All ${PLAN_FACTS.subjects.count.value} CUET subjects`}</h2>
              <p className="lp-sub">Pick up to 5 when you start. Mocks and practice sets use only your subjects.</p>
            </div>
            <SubjectGrid />
          </div>
        </section>

        {/* 4. Free DU tools, no sign-up. */}
        <section className="lp-sec lp-sec--tools" id="free-tools" aria-labelledby="tools-title">
          <div className="mm-wrap">
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2" id="tools-title">Free DU tools</h2>
              <p className="lp-sub">No account needed. Built on the published 2026 DU rules and cutoffs; recheck when the 2027 rules arrive.</p>
            </div>
            <FreeTools />
          </div>
        </section>

        {/* 5. Pricing, in numbers. */}
        <section className="lp-sec" id="pricing" aria-labelledby="pricing-title">
          <div className="mm-wrap">
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2" id="pricing-title">Start free. Pro when you want more room.</h2>
              <p className="lp-sub">Credits pay for mocks, practice and Mistake Repair. Nothing is spent until you press Start.</p>
            </div>
            <div className="lp-plans lp-plans--ia">
              <div className="lp-plan">
                <h3 className="lp-h4">Free</h3>
                <p className="lp-plan__price mm-measure">₹0</p>
                <ul className="lp-ticks">
                  {FREE_LINES.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}
                </ul>
                <Link href="/signup" className="mm-btn mm-btn--secondary">Start free</Link>
              </div>
              <div className="lp-plan lp-plan--pro">
                <h3 className="lp-h4">Pro</h3>
                <p className="lp-plan__price mm-measure">₹{MONTHLY ? OFFER.monthly.rupees : OFFER.oneTime.rupees}<span>{MONTHLY ? ' a month' : ' once'}</span></p>
                <p className="lp-plan__note">
                  {MONTHLY ? 'Renews monthly. Cancel any time in Account.' : `Access through ${OFFER.oneTime.expires}. This payment does not renew. Monthly Pro at ₹${OFFER.monthly.rupees} opens soon.`}
                </p>
                <ul className="lp-ticks">
                  <li><Check size={16} aria-hidden="true" />Everything in Free</li>
                  {PRO_LINES.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}
                </ul>
                <Link href="/pricing" className="mm-btn mm-btn--primary">See Pro</Link>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Proof: the live bank and the creators who featured MockMob. */}
        <section className="lp-sec lp-sec--proof" id="proof" aria-labelledby="proof-title">
          <div className="mm-wrap">
            <LiveStatsBand />
            <div className="lp-head lp-head--left">
              <h2 className="lp-h2" id="proof-title">Featured by CUET creators</h2>
              <p className="lp-sub">DU seniors and admissions creators have shown MockMob to their audiences. Choose a card to watch it here.</p>
            </div>
            <CreatorReels items={REELS} profileUrl={INSTAGRAM.url} handle={INSTAGRAM.handle} asOf={STATS_AS_OF} />
          </div>
        </section>

        {/* 7. FAQ and close. */}
        <section className="lp-sec lp-sec--band" id="faq" aria-labelledby="faq-title">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="lp-h2" id="faq-title">Questions before your first mock</h2>
            <div className="mm-faqs">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="mm-faq">
                  <summary>{question}</summary>
                  <div className="mm-faq__body">{answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-end" aria-labelledby="end-title">
          <div className="mm-wrap lp-end__inner">
            <MascotSeat pose="greeting" label="Mobi" note="reads every mock with you." className="lp-end__mobi" />
            <div className="lp-end__copy">
              <h2 className="lp-h2" id="end-title">Try 5 questions. See where your marks go.</h2>
              <p className="lp-sub">The sample needs no account. Save it when you sign up.</p>
              <LandingActions />
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <MobileDock />
    </div>
  );
}
