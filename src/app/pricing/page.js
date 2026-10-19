export const dynamic = "force-dynamic";
import React from 'react';
import { newOfferReleased, RECOVERY_PACKAGING_ROWS } from '@/../data/capabilities';
import { priceHeadline, priceTag, publicOffer } from '@/lib/payments/offer';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { Icon } from '@/components/ui/Icons';
import { PricingCard } from '@/components/ui/PricingCard';
import { RazorpayPaymentButton } from '@/components/billing/RazorpayPaymentButton';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { countStepOnce } from '@/lib/server/funnelOnceStore';
import { Database } from '@/../data/db';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';
import { publicInventory } from '@/lib/server/inventory';
import { pricingBankFaq, pricingBankLine, pricingSubjectLine } from '@/lib/paperCopy.mjs';
import { practiceBankSize } from '@/lib/practiceBank.mjs';
import { ONE_CREDIT_LINE, PRACTICE_PRICE_LINE } from '@/lib/creditCopy.mjs';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_ON } from '@/../data/first_full_mock';
import './pro-page.css';

// The free first full mock (C-dec 1), listed only while its switch is on (FIRST_FULL_MOCK_ENABLED, data/first_full_mock.js).
const FIRST_FREE_ITEMS = FIRST_FULL_MOCK_ON ? [FIRST_FULL_MOCK_COPY.planItem] : [];

export function generateMetadata() {
  const offer = publicOffer();
  const monthly = offer.purchasable === 'monthly';
  return seoMetadata({
    title: monthly ? `MockMob Pro Pricing: ₹${offer.monthly.rupees} a month` : `MockMob Pro Pricing: ₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}`,
    description: monthly
      ? `Start free. MockMob Pro is ₹${offer.monthly.rupees} a month: unlimited Quick practice and Full mock, Smart practice, NTA mode and full chapter review. Cancel anytime.`
      : `Start free. MockMob Pro is ₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}, with no renewal: unlimited Quick practice and Full mock, Smart practice, NTA mode and full chapter review. Monthly Pro at ₹${offer.monthly.rupees} a month opens soon.`,
    path: '/pricing',
  });
}

const buildPlans = (offer) => [
  {
    name: 'Free',
    price: '₹0',
    cycle: 'forever',
    description: 'Enough to see whether MockMob suits you. No card needed.',
    ctaLabel: 'Create a free account',
    terms: [
      ['Renewal', 'None, and no card needed'],
      ['Credits', `100 to start, plus 50 free every month: 1 a question in Quick practice, 50 a Full mock, 1 an Ask Mobi reply, 3 a deeper analysis.${FIRST_FULL_MOCK_ON ? ' Your first Full mock in each subject is free.' : ''}`],
    ],
    features: newOfferReleased() ? ['One five-question baseline per launch subject', 'One included daily 10-question practice set', ...FIRST_FREE_ITEMS, 'One new complete recovery episode per week', 'Delayed checks for every started episode', '25 saved questions', 'Free DU eligibility and historical cutoffs'] : [
      'Quick practice, 5 to 20 questions, 1 credit a question',
      'Full mock, 50 questions in 60 minutes, 50 credits a mock',
      // The first full mock in each subject is free (data/first_full_mock.js), said right under the price it changes.
      ...FIRST_FREE_ITEMS,
      'Every paper built fresh from the live question bank',
      'Weekly progress tracking',
      '25 saved questions',
      'Your standing',
    ],
  },
  {
    name: offer.purchasable === 'monthly' ? 'Pro' : 'Pro access',
    // One framing everywhere (release 9): the tag is what a buyer is charged today, like the H1 and the landing trust row.
    ...priceTag(offer),
    description: offer.purchasable === 'monthly'
      ? `Every mode, no limits. ₹${offer.monthly.rupees} is charged when you start, then every month on the same date until you cancel.`
      : `Every mode, no limits. The ₹${offer.oneTime.rupees} you pay today is one payment: it covers you through ${offer.oneTime.expires} and does not renew.`,
    terms: [
      ['Renewal', offer.purchasable === 'monthly' ? 'Every month on the same date until you cancel in Account' : `None on this payment, which runs through ${offer.oneTime.expires}`],
      ['Credits', 'Practice needs none: every mode is included. 50 free a month for Ask Mobi.'],
    ],
    ctaLabel: offer.purchasable === 'monthly' ? `Start Pro for ₹${offer.monthly.rupees}/month` : `Get access for ₹${offer.oneTime.rupees}`,
    planId: offer.purchasable === 'monthly' ? offer.monthly.planId : offer.oneTime.planId,
    billing: offer.purchasable === 'monthly' ? 'monthly' : 'once',
    amount: (offer.purchasable === 'monthly' ? offer.monthly.rupees : offer.oneTime.rupees) * 100,
    featured: true,
    footnote: offer.purchasable === 'monthly'
      ? 'Cancel any time in Account. You keep Pro to the end of the month you paid for.'
      : `Access ends ${offer.oneTime.expires}. No auto-renewal on this payment.`,
    features: newOfferReleased() ? ['All available recovery pathways', 'Fresh delayed checks and full recovery history', 'Unlimited available practice and reattempts', 'Full, Smart and NTA access', 'Full priorities and playbook', 'Unlimited saved questions'] : [
      'Unlimited Quick practice and Full mocks, each a fresh paper',
      'NTA mode: the exam-day screen, 50 questions in 60 minutes, as many papers as you take',
      'Smart practice: every set aimed at your weak chapters',
      'Full chapter review: every ranked chapter, pace and changed-answer detail',
      'Compass Pro: your practice projected paper by paper, against your DU shortlist',
      'Compass Pro next move: the paper and chapter that can move your total most',
      'DU eligibility and published cutoffs',
      'Difficulty selector: easy, medium, hard or auto',
      'Unlimited saved questions',
    ],
  },
];

const COMPARISON_GROUPS = newOfferReleased() ? [{ heading: 'Practice and recovery', rows: RECOVERY_PACKAGING_ROWS }] : [
  {
    heading: 'Core test modes',
    rows: [
      ['Quick practice (5 to 20 questions)', '1 credit a question', 'Unlimited'],
      ['Full mock (50 questions, 60 minutes)', 'First one free in each subject, then 50 credits each', 'Unlimited'],
      ['A fresh paper each time, questions you have not answered first', true, true],
    ],
  },
  {
    heading: 'Platform basics',
    rows: [
      ['Saved questions', '25 saves', 'Unlimited saves'],
      ['Your standing', true, true],
      ['Weekly progress tracking', true, true],
    ],
  },
  {
    heading: 'Advanced features',
    rows: [
      ['DU eligibility and published cutoffs', true, true],
      ['Compass Pro: practice projection, DU shortlist and next move', false, true, 'popular'],
      ['Difficulty selector', false, 'Easy, medium, hard, auto'],
      ['Chapter review: marks ledger, top three chapters, weekly summary', true, true],
      ['Chapter review: every ranked chapter, pace and changed-answer detail', false, true],
    ],
  },
  {
    heading: 'Advanced test modes',
    rows: [
      ['Smart practice, aimed at your weak chapters', false, 'Unlimited'],
      ['NTA mode, the exam-day screen', false, 'Unlimited'],
    ],
  },
];

const FREE_NOTES = [
  PRACTICE_PRICE_LINE,
  'New accounts start with 100 credits.',
  'Credits decide how often you practise, never what you can see: results, explanations, DU eligibility and published cutoffs stay open.',
  'Practice and Ask Mobi replies share one credits balance: 50 free a month, used first.',
];

const buildFaqs = (offer, bankSize = null) => [
  {
    q: 'Is Pro a monthly subscription?',
    a: offer.purchasable === 'monthly'
      ? `Yes. Pro is ₹${offer.monthly.rupees} a month. The first payment is taken when you start, and it renews on the same date each month until you cancel. Cancel in Account at any time; you keep Pro until the end of the month you already paid for.`
      : `Not yet. Today Pro is one payment of ₹${offer.oneTime.rupees} for access through ${offer.oneTime.expires}, with no auto-renewal. A ₹${offer.monthly.rupees} monthly plan opens soon, and whoever pays now keeps the full term.`,
  },
  {
    q: 'What happens when I cancel?',
    a: offer.purchasable === 'monthly'
      ? 'Renewals stop. Pro stays active until the end of the month you already paid for, then your account moves to Free. Your history, saved questions and credits stay.'
      : `There is nothing to cancel. Pro is one payment with no renewal. It stays active until ${offer.oneTime.expires}, then your account moves to Free. Your history, saved questions and credits stay.`,
  },
  pricingBankFaq(bankSize),
  ...(offer.purchasable === 'monthly' ? [
    {
      q: 'What if a renewal payment fails?',
      a: 'Razorpay retries the charge a few times and emails you. Pro stays active until the end of the month you already paid for. If the payment still fails, the plan stops and your account moves to Free. You can start Pro again at any time.',
    },
    {
      q: `I already paid ₹${offer.oneTime.rupees} once. What happens to it?`,
      a: `Nothing changes. Your access runs through ${offer.oneTime.expires} with no renewal, and you do not need monthly Pro until it ends.`,
    },
  ] : []),
  {
    q: 'What does Admission Compass compare?',
    a: 'Compass uses official DU programme rules and published historical allocation scores, free for everyone. Compass Pro adds a practice projection: what each CUET paper would be worth if exam day went like your own practice, with a range, checked against the 2026 cutoffs of the colleges on your shortlist.',
  },
  {
    q: 'Is Compass the same as chapter review?',
    a: 'Chapter review describes your practice history. Compass checks sourced eligibility and historical cutoffs; with Pro, it also maps your practice to your DU shortlist and names the paper with the most marks open.',
  },
  {
    q: 'How do you check the questions?',
    a: 'New questions pass source and answer-key checks before they reach you, and anything uncertain is held back. If a key looks wrong, report it from your result and we recheck it.',
  },
  {
    q: 'What is Your standing?',
    a: 'Your standing is your own rank among MockMob students, worked out from the points your recorded mocks earn. You see your rank, how many students are ranked and your average. No other student’s name is shown, and it is separate from your CUET exam rank.',
  },
];

function ComparisonValue({ value, pro = false }) {
  if (value === true) {
    return (
      <span className="mm-cmp__yes">
        <Icon name="check" aria-hidden="true" />
        Included
      </span>
    );
  }
  if (value === false) {
    return <span className="mm-cmp__no">Not included</span>;
  }
  return <span data-pro={pro ? 'true' : 'false'}>{value}</span>;
}

// What Pro opens, outcome first (owner I6, 20 Oct 2026: "If you are buying even a basic subscription, it should be like you are
// getting everything in the world"). Every line is a fact the comparison table below also states; nothing here is a new promise.
const PRO_OUTCOMES = newOfferReleased() ? null : [
  { title: 'Unlimited mocks, every one new', body: 'Quick practice and Full mocks, as many as you take. Each paper is built when you start it from one central question bank, questions you have not answered first.' },
  { title: 'The exam-day screen', body: 'NTA mode: 50 questions in 60 minutes on the screen you will sit on exam day, as many papers as you take.' },
  { title: 'Practice aimed at you', body: 'Smart practice points every set at your weak chapters, and the difficulty selector lets you pick easy, medium, hard or auto.' },
  { title: 'Every chapter, ranked', body: 'Full chapter review: every ranked chapter, with your pace and the answers you changed.' },
  { title: 'Compass Pro', body: 'Your practice projected paper by paper against your DU shortlist, and the paper and chapter that can move your total most.' },
  { title: 'No credits for practice', body: 'Practice never uses a credit on Pro, so your 50 free credits a month all go to Ask Mobi.' },
];

// Development only: /pricing?offer=monthly shows the page as the live site sells it (pro_monthly_99), and &pro=1 a signed-in Pro
// student, with no sign-in and no plan env. Production ignores both.
function previewOverrides(params) {
  if (process.env.NODE_ENV === 'production' || !params) return {};
  const base = publicOffer();
  const offer = params.offer === 'monthly'
    ? Object.freeze({ ...base, monthly: Object.freeze({ ...base.monthly, ready: true }), oneTime: Object.freeze({ ...base.oneTime, onSale: false }), purchasable: 'monthly' })
    : null;
  return { offer, pro: params.pro === '1' };
}

export default async function PricingPage({ searchParams }) {
  const preview = previewOverrides(await searchParams);
  const session = await auth();
  // Aggregate funnel: a signed-in student viewed pricing (once per person; no-op while FUNNEL_ENABLED is off).
  if (session?.user?.id) countStepOnce(session.user.id, 'pricing_viewed', await headers().catch(() => null));
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const isCurrentUserPremium = Boolean(currentUser?.isPremium) || preview.pro === true;
  const offer = preview.offer || publicOffer();
  // The stored daily count only (never a bank read on a request); without it the sentence names no number.
  const inventory = await publicInventory().catch(() => null);
  // Summed over the subjects Practice offers: the stored bankSize also holds subjects that are not offered or retired.
  const bankSize = practiceBankSize(inventory);
  const PLANS = buildPlans(offer);
  const FAQS = buildFaqs(offer, bankSize);
  const [FREE_PLAN, PRO_PLAN] = PLANS;
  const monthly = offer.purchasable === 'monthly';
  const proOutcomes = PRO_OUTCOMES || PRO_PLAN.features.map((feature) => ({ title: feature, body: null }));

  return (
    <div className="mm mm-pro">
      <JsonLd
        id="pricing-breadcrumb-json-ld"
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
        ])}
      />
      <JsonLd
        id="pricing-faq-json-ld"
        data={faqJsonLd(FAQS.map((faq) => ({ question: faq.q, answer: faq.a })))}
      />
      <NavBar />

      <main>
        {/* The Pro page (owner I6): the outcome, the real price and its terms, and one checkout, on the night band. */}
        <section className="pro-hero" aria-labelledby="pro-price">
          <div className="mm-wrap pro-hero__grid">
            <div className="pro-hero__copy">
              <p className="pro-hero__promise">
                Unlimited mocks. <span>Every one a new paper.</span>
              </p>
              <div id="pro-price" className="pro-hero__price">
                <h1 className="mm-h1">{priceHeadline(offer)}</h1>
              </div>
              <p className="pro-hero__lead">
                {monthly
                  ? 'Start free and stay free if that is enough. Go Pro when you want unlimited practice, every mode and full chapter review. Cancel any time in Account.'
                  : `Start free and stay free if that is enough. One payment covers every mode to that date, and it never renews. Monthly Pro at ₹${offer.monthly.rupees} a month opens soon.`}
              </p>
              <ul className="pro-hero__facts">
                {PRO_PLAN.terms.map(([label, value]) => (
                  <li key={label}>
                    <Icon name="check" aria-hidden="true" />
                    <span><b>{label}.</b> {value}{/[.]$/.test(value) ? '' : '.'}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pro-hero__card" id="plans">
              <PricingCard
                {...PRO_PLAN}
                terms={[]}
                features={[]}
                ctaElement={
                  <RazorpayPaymentButton
                    planId={PRO_PLAN.planId}
                    amount={PRO_PLAN.amount}
                    label={PRO_PLAN.ctaLabel}
                    billing={PRO_PLAN.billing}
                    initialIsPremium={isCurrentUserPremium}
                  />
                }
              />
            </div>
            <p className="pro-hero__bank">{pricingBankLine(bankSize)} {pricingSubjectLine()}</p>
          </div>
        </section>

        <section className="mm-section pro-opens" aria-labelledby="pro-opens-h">
          <div className="mm-wrap">
            <h2 className="mm-h2" id="pro-opens-h">Everything Pro opens.</h2>
            <p className="mm-body mm-section__intro">MockMob is free to start. Pro is the paid plan, and this is what it adds.</p>
            <ul className="pro-opens__rows">
              {proOutcomes.map((row) => (
                <li key={row.title} className="pro-opens__row">
                  <h3>{row.title}</h3>
                  {row.body ? <p>{row.body}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mm-section mm-section--sunken" id="compare">
          <div className="mm-wrap">
            <h2 className="mm-h2">Free and Pro, line by line.</h2>
            <p className="mm-body mm-section__intro">
              Free is a real plan. Credits decide how often you practise, never what you can see.
            </p>

            <div className="mm-cmp">
              <div className="mm-cmp__head" role="presentation">
                <div>Feature</div>
                <div>Free <span className="pro-cmp__price">{FREE_PLAN.price}</span></div>
                <div>Pro <span className="pro-cmp__price">{PRO_PLAN.price} {PRO_PLAN.cycle}</span></div>
              </div>
              {COMPARISON_GROUPS.map((group) => (
                <React.Fragment key={group.heading}>
                  <h3 className="mm-cmp__group">{group.heading}</h3>
                  {group.rows.map(([feature, free, pro, marker]) => (
                    <div
                      key={feature}
                      className="mm-cmp__row"
                      data-popular={marker === 'popular' ? 'true' : 'false'}
                    >
                      <div className="mm-cmp__feature">{feature}</div>
                      <div className="mm-cmp__cell" data-label="Free">
                        <ComparisonValue value={free} />
                      </div>
                      <div className="mm-cmp__cell" data-label="Pro">
                        <ComparisonValue value={pro} pro />
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            {isCurrentUserPremium ? null : (
              <p className="pro-cmp__cta">
                <a className="mm-btn mm-btn--primary" href="#plans">{PRO_PLAN.ctaLabel}</a>
                <span>{PRO_PLAN.footnote}</span>
              </p>
            )}
          </div>
        </section>

        <section className="mm-section" aria-labelledby="free-plan-h">
          <div className="mm-wrap">
            <h2 className="mm-h2" id="free-plan-h">Or start free.</h2>
            <p className="mm-body mm-section__intro">No card needed. Stay on Free as long as it is enough.</p>
            <div className="mm-plans pro-free">
              <div className="mm-plans__col">
                <PricingCard {...FREE_PLAN} />
                <details className="mm-plans__fold mm-faq">
                  <summary>How Free works</summary>
                  <div className="mm-faq__body">
                    <ul>
                      {FREE_NOTES.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                    <a className="mm-link" href="#compare">Free and Pro, line by line</a>
                  </div>
                </details>
              </div>
              {/* Side by side, how Free works fills the second column with facts from the table above. */}
              <aside className="mm-plans__note" aria-label="How Free works">
                <h3>How Free works</h3>
                <ul>
                  {FREE_NOTES.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <a className="mm-link" href="#compare">Free and Pro, line by line</a>
              </aside>
            </div>
          </div>
        </section>

        <section className="mm-section mm-section--sunken">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Ask Mobi, on the same credits.</h2>
            <p className="mm-body mm-section__intro">
              Ask Mobi reads your own practice record and shows your next step, your leaks and your weekly report. The basics are free for everyone and use no credits. Pro adds every ranked chapter, pace and changed-answer detail.
            </p>
            <p className="mm-body">
              One credits balance pays for practice and Ask Mobi. {ONE_CREDIT_LINE} Everyone gets 50 free credits a month, used first. On Pro, practice needs no credits, so they all go to Ask Mobi.
              Credits you have already bought stay in your account.
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link href="/pricing/ai-credits" className="mm-btn mm-btn--secondary">See your credits</Link>
            </p>
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Questions people actually ask.</h2>
            <div className="mm-faqs">
              {FAQS.map((faq) => (
                <details key={faq.q} className="mm-faq">
                  <summary>{faq.q}</summary>
                  <div className="mm-faq__body">{faq.a}</div>
                </details>
              ))}
            </div>
            <p className="mm-small" style={{ marginTop: '2rem', lineHeight: 1.5 }}>
              Need team or institute pricing?{' '}
              <a
                className="mm-link mm-link--inline"
                href="mailto:support@mockmob.in?subject=Team%20%2F%20institute%20pricing"
              >
                Email us
              </a>{' '}
              and we will set it up.
            </p>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <MobileDock note={offer.purchasable === 'monthly' ? `Pro ₹${offer.monthly.rupees} a month. Cancel anytime.` : `₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}.`} label={offer.purchasable === 'monthly' ? `Start Pro for ₹${offer.monthly.rupees}/month` : `Get access for ₹${offer.oneTime.rupees}`} href="#plans" checkoutAware isPremium={isCurrentUserPremium} hideAtFooter />
    </div>
  );
}
