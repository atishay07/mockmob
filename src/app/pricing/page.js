export const dynamic = "force-dynamic";
import React from 'react';
import { newOfferReleased, RECOVERY_PACKAGING_ROWS } from '@/../data/capabilities';
import { publicOffer } from '@/lib/payments/offer';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { JsonLd } from '@/components/JsonLd';
import { Icon } from '@/components/ui/Icons';
import { PricingCard } from '@/components/ui/PricingCard';
import { RazorpayPaymentButton } from '@/components/billing/RazorpayPaymentButton';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';

export function generateMetadata() {
  const offer = publicOffer();
  const monthly = offer.purchasable === 'monthly';
  return seoMetadata({
    title: monthly ? `MockMob Pro Pricing: ₹${offer.monthly.rupees} a month` : `MockMob Pro Pricing: ₹${offer.oneTime.rupees} to start`,
    description: monthly
      ? `Start free. MockMob Pro is ₹${offer.monthly.rupees} a month: unlimited Quick practice and Full mock, Smart practice, NTA mode and full chapter review. Cancel anytime.`
      : `Start free. MockMob Pro access is ₹${offer.oneTime.rupees} once through ${offer.oneTime.expires}: unlimited Quick practice and Full mock, Smart practice, NTA mode and full chapter review. No renewal.`,
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
    features: newOfferReleased() ? ['One five-question baseline per launch subject', 'One included daily 10-question practice set', 'One new complete recovery episode per week', 'Delayed checks for every started episode', '25 saved questions', 'Free DU eligibility and historical cutoffs'] : [
      'Quick practice, 5 to 20 questions, on credits',
      'Full mock, 50 questions in 60 minutes, on credits',
      'Weekly progress tracking',
      '25 saved questions',
      'Leaderboard',
    ],
  },
  {
    name: offer.purchasable === 'monthly' ? 'Pro' : 'Pro access',
    price: `₹${offer.purchasable === 'monthly' ? offer.monthly.rupees : offer.oneTime.rupees}`,
    cycle: offer.purchasable === 'monthly' ? '/month' : 'once',
    description: offer.purchasable === 'monthly'
      ? `Every mode, no limits. ₹${offer.monthly.rupees} is charged when you start, then every month on the same date until you cancel.`
      : `One payment covers you through ${offer.oneTime.expires}. It does not renew.`,
    ctaLabel: offer.purchasable === 'monthly' ? `Start Pro for ₹${offer.monthly.rupees}/month` : `Get access for ₹${offer.oneTime.rupees}`,
    planId: offer.purchasable === 'monthly' ? offer.monthly.planId : offer.oneTime.planId,
    billing: offer.purchasable === 'monthly' ? 'monthly' : 'once',
    amount: (offer.purchasable === 'monthly' ? offer.monthly.rupees : offer.oneTime.rupees) * 100,
    featured: true,
    footnote: offer.purchasable === 'monthly'
      ? 'Cancel any time in Account. You keep Pro to the end of the month you paid for.'
      : `Access ends ${offer.oneTime.expires}. No auto-renewal on this payment.`,
    features: newOfferReleased() ? ['All available recovery pathways', 'Fresh delayed checks and full recovery history', 'Unlimited available practice and reattempts', 'Full, Smart and NTA access', 'Full priorities and playbook', 'Unlimited saved questions'] : [
      'Unlimited Quick practice and Full mocks',
      'NTA mode: the exam-day screen, 50 questions in 60 minutes',
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
      ['Quick practice (5 to 20 questions)', '10 credits a session', 'Unlimited'],
      ['Full mock (50 questions, 60 minutes)', '50 credits a mock', 'Unlimited'],
    ],
  },
  {
    heading: 'Platform basics',
    rows: [
      ['Saved questions', '25 saves', 'Unlimited saves'],
      ['Leaderboard', true, true],
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

const AI_PACKS = [
  {
    name: 'AI Boost',
    price: '₹10',
    credits: '50 AI credits',
    desc: 'New purchases paused. Existing credit balances are preserved.',
  },
  {
    name: 'Prep Pack',
    price: '₹20',
    credits: '150 AI credits',
    desc: 'Shared learning plans and core recovery do not require paid model calls.',
  },
  {
    name: 'Power Pack',
    price: '₹50',
    credits: '400 AI credits',
    desc: 'Paid AI remains gated on durable spending and wallet checks.',
    popular: true,
    flag: 'Most credits per rupee',
  },
];

const buildFaqs = (offer) => [
  {
    q: 'Is Pro a monthly subscription?',
    a: offer.purchasable === 'monthly'
      ? `Yes. Pro is ₹${offer.monthly.rupees} a month. The first payment is taken when you start, and it renews on the same date each month until you cancel. Cancel in Account at any time; you keep Pro until the end of the month you already paid for.`
      : `Not yet. Right now Pro is one payment of ₹${offer.oneTime.rupees} for access through ${offer.oneTime.expires}, with no auto-renewal. A monthly plan is planned, and this payment keeps its full term when it opens.`,
  },
  {
    q: 'What happens when I cancel?',
    a: 'Renewals stop. Pro stays active until the end of the period you paid for, then your account drops to Free. Your history, saved questions and credits stay.',
  },
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
    q: 'How does the leaderboard work?',
    a: 'Every mock you take adds points for speed, accuracy and the difficulty of the questions. Your points set your place on the leaderboard, which is separate from your CUET exam rank.',
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
  const currentUser = session?.user?.id ? await Database.getUserById(session.user.id) : null;
  const isCurrentUserPremium = Boolean(currentUser?.isPremium);
  const offer = publicOffer();
  const PLANS = buildPlans(offer);
  const FAQS = buildFaqs(offer);

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
            <h1 className="mm-h1">{offer.purchasable === 'monthly' ? `Pro is ₹${offer.monthly.rupees} a month.` : `₹${offer.oneTime.rupees} gets you in.`}</h1>
            <p className="mm-lead" style={{ marginTop: '1rem' }}>
              {offer.purchasable === 'monthly'
                ? 'Start free and stay free if that is enough. Go Pro when you want unlimited practice, every mode and full chapter review. Cancel any time in Account.'
                : `Start free and stay free if that is enough. For everything, one payment of ₹${offer.oneTime.rupees} covers access through ${offer.oneTime.expires}, with no renewal.`}
            </p>
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
                        <li>Quick practice uses 10 practice credits a session. A Full mock uses 50.</li>
                        <li>Credits decide how often you practise, never what you can see: results, explanations, DU eligibility and published cutoffs stay open.</li>
                        <li>Written replies from Ask Mobi use AI credits: 10 a month on Free.</li>
                      </ul>
                      <a className="mm-link" href="#compare">Free and Pro, line by line</a>
                    </aside>
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
            <h2 className="mm-h2">Ask Mobi, and its own credits.</h2>
            <p className="mm-body mm-section__intro">
              Ask Mobi reads your own practice record and shows your next step, your leaks and your weekly report. The basics are free for everyone and use no credits. Pro adds every ranked chapter, pace and changed-answer detail.
            </p>
            <p className="mm-body">
              Model replies use AI credits: 10 a month on Free and 50 on Pro, kept apart from Practice credits.
              AI credits you have already bought stay in your account.
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link href="/pricing/ai-credits" className="mm-btn mm-btn--secondary">See your AI credits</Link>
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
            <p className="mm-small" style={{ marginTop: '2rem' }}>
              Need team or institute pricing?{' '}
              <a
                className="mm-link"
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
      <MobileDock note={offer.purchasable === 'monthly' ? `Pro ₹${offer.monthly.rupees} a month. Cancel anytime.` : `₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}.`} label={offer.purchasable === 'monthly' ? `Start Pro for ₹${offer.monthly.rupees}/month` : `Get access for ₹${offer.oneTime.rupees}`} href="#plans" checkoutAware isPremium={isCurrentUserPremium} />
    </div>
  );
}
