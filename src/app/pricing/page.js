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
      ['Credits', `100 to start, plus 50 free every month: 1 a question in Quick practice, 50 a Full mock, 1 a Mobi job (a mistake fixed for good, or a doubt answered and tested). Answers from your record are free.${FIRST_FULL_MOCK_ON ? ' Your first Full mock in each subject is free.' : ''}`],
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

export default async function PricingPage() {
  const session = await auth();
  // Aggregate funnel: a signed-in student viewed pricing (once per person; no-op while FUNNEL_ENABLED is off).
  if (session?.user?.id) countStepOnce(session.user.id, 'pricing_viewed', await headers().catch(() => null));
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const isCurrentUserPremium = Boolean(currentUser?.isPremium);
  const offer = publicOffer();
  // The stored daily count only (never a bank read on a request); without it the sentence names no number.
  const inventory = await publicInventory().catch(() => null);
  // Summed over the subjects Practice offers: the stored bankSize also holds subjects that are not offered or retired.
  const bankSize = practiceBankSize(inventory);
  const PLANS = buildPlans(offer);
  const FAQS = buildFaqs(offer, bankSize);

  return (
    <div className="mm">
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
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem', paddingBottom: '2rem' }}>
          <div className="mm-wrap">
            <h1 className="mm-h1">{priceHeadline(offer)}</h1>
            <p className="mm-lead" style={{ marginTop: '1rem' }}>
              {offer.purchasable === 'monthly'
                ? 'Start free and stay free if that is enough. Go Pro when you want unlimited practice, every mode and full chapter review. Cancel any time in Account.'
                : `Start free and stay free if that is enough. One payment covers every mode to that date, and it never renews. Monthly Pro at ₹${offer.monthly.rupees} a month opens soon.`}
            </p>
            <p className="mm-body" style={{ marginTop: '0.875rem', maxWidth: '60ch', fontVariantNumeric: 'tabular-nums' }}>{pricingBankLine(bankSize)} {pricingSubjectLine()}</p>
          </div>
        </section>

        <section className="mm-section" style={{ paddingTop: '1.5rem' }}>
          <div className="mm-wrap">
            <div className="mm-plans" id="plans">
              {PLANS.map((plan) => {
                const card = (
                  <PricingCard
                    key={plan.name}
                    {...plan}
                    ctaElement={
                      plan.planId ? (
                        <RazorpayPaymentButton
                          planId={plan.planId}
                          amount={plan.amount}
                          label={plan.ctaLabel}
                          billing={plan.billing}
                          initialIsPremium={isCurrentUserPremium}
                        />
                      ) : null
                    }
                  />
                );
                if (plan.planId) return card;
                // Side by side, the Free card is far shorter than Pro: how Free works fills that column with
                // facts from the table below, instead of an empty band.
                return (
                  <div className="mm-plans__col" key={plan.name}>
                    {card}
                    <aside className="mm-plans__note" aria-label="How Free works">
                      <h3>How Free works</h3>
                      <ul>
                        {FREE_NOTES.map((line) => <li key={line}>{line}</li>)}
                      </ul>
                      <a className="mm-link" href="#compare">Free and Pro, line by line</a>
                    </aside>
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
                );
              })}
            </div>
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
                <div>Free</div>
                <div>Pro</div>
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
          </div>
        </section>

        <section className="mm-section">
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

        <section className="mm-section mm-section--sunken">
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
