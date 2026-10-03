export const dynamic = "force-dynamic";
import React from 'react';
import { CAPABILITIES, newOfferReleased, RECOVERY_PACKAGING_ROWS } from '@/../data/capabilities';
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
      ? `Start free. MockMob Pro is ₹${offer.monthly.rupees} a month: unlimited Quick Practice and Full Mock, Smart Practice, NTA Mode and full Radar. Cancel anytime.`
      : `Start free. MockMob Pro access is ₹${offer.oneTime.rupees} once through ${offer.oneTime.expires}: unlimited Quick Practice and Full Mock, Smart Practice, NTA Mode and full Radar. Monthly Pro opens soon.`,
    path: '/pricing',
  });
}

const buildPlans = (offer) => [
  {
    name: 'Free',
    price: '₹0',
    cycle: 'forever',
    description: 'Enough to find out whether MockMob is for you, with no card involved.',
    ctaLabel: 'Create a free account',
    features: newOfferReleased() ? ['One five-question baseline per launch subject', 'One included daily 10-question practice set', 'One new complete recovery episode per week', 'Delayed checks for every started episode', '25 saved questions', 'Free DU eligibility and historical cutoffs'] : [
      'Quick Practice, 5 to 20 questions — credit-gated',
      'Full Mock, 50 questions in 60 minutes — credit-gated',
      'Weekly progress tracking',
      '25 saved questions',
      'Community leaderboard',
    ],
  },
  {
    name: offer.purchasable === 'monthly' ? 'Pro' : 'Pro access',
    price: `₹${offer.purchasable === 'monthly' ? offer.monthly.rupees : offer.oneTime.rupees}`,
    cycle: offer.purchasable === 'monthly' ? '/month' : 'once',
    description: offer.purchasable === 'monthly'
      ? 'Everything unlocked. Renews every month, cancel whenever you like.'
      : `One payment covers you through ${offer.oneTime.expires}. Monthly Pro at ₹${offer.monthly.rupees} opens soon.`,
    ctaLabel: offer.purchasable === 'monthly' ? `Start Pro for ₹${offer.monthly.rupees}/month` : `Get access for ₹${offer.oneTime.rupees}`,
    planId: offer.purchasable === 'monthly' ? offer.monthly.planId : offer.oneTime.planId,
    billing: offer.purchasable === 'monthly' ? 'monthly' : 'once',
    amount: (offer.purchasable === 'monthly' ? offer.monthly.rupees : offer.oneTime.rupees) * 100,
    featured: true,
    footnote: offer.purchasable === 'monthly'
      ? 'Auto-renews monthly. Cancel in Account; access continues to the end of the paid month.'
      : `Access ends ${offer.oneTime.expires}. No auto-renewal on this payment.`,
    features: newOfferReleased() ? ['All available recovery pathways', 'Fresh delayed checks and full recovery history', 'Unlimited available practice and reattempts', 'Full, Smart and NTA access', 'Full priorities and playbook', 'Unlimited saved questions'] : [
      'Unlimited Quick Practice and Full Mocks',
      'NTA Mode — 2026-format baseline, 50 Q / 60 min; 2027 rules provisional',
      'Smart Practice — adaptive, targets your weak chapters',
      'Full Radar: every ranked chapter, pace and changed-answer detail',
      'Compass Pro: your practice projected paper by paper, against your DU shortlist',
      'Compass Pro next move: the paper and chapter that can move your total most',
      'Free DU eligibility and sourced historical cutoffs',
      'Difficulty selector: easy, medium, hard or auto',
      'Unlimited bookmarks',
    ],
  },
];

const COMPARISON_GROUPS = newOfferReleased() ? [{ heading: 'Practice and recovery', rows: RECOVERY_PACKAGING_ROWS }] : [
  {
    heading: 'Core test modes',
    rows: [
      ['Quick Practice (5 to 20 Qs)', 'Credit-gated · 10 credits each', 'Unlimited with Pro'],
      ['Full Mock (50 Qs · 60 min)', 'Credit-gated · 50 credits each', 'Unlimited with Pro'],
    ],
  },
  {
    heading: 'Platform basics',
    rows: [
      ['Saved questions', '25 saves', 'Unlimited saves'],
      ['Community leaderboard', true, true],
      ['Weekly progress tracking', true, true],
    ],
  },
  {
    heading: 'Advanced features',
    rows: [
      ['DU eligibility and historical cutoffs', true, true],
      ['Compass Pro: practice projection, DU shortlist and next move', false, true, 'popular'],
      ['Difficulty selector', false, 'Easy, medium, hard, auto'],
      ['Radar: marks ledger, top three chapters, weekly summary', true, true],
      ['Radar: every ranked chapter, pace and changed-answer detail', false, true],
    ],
  },
  {
    heading: 'Advanced test modes',
    rows: [
      ['Smart Practice — adaptive', false, 'Unlimited'],
      ['NTA Mode — CUET exam simulation', false, 'Unlimited'],
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
      ? `Yes. Pro is ₹${offer.monthly.rupees} a month and renews automatically until you cancel. Cancel in Account at any time; you keep Pro until the end of the month you already paid for.`
      : `Monthly Pro at ₹${offer.monthly.rupees} a month is opening soon. Until then you can pay ₹${offer.oneTime.rupees} once for access through ${offer.oneTime.expires}, with no auto-renewal. That payment keeps its full term when monthly billing opens.`,
  },
  {
    q: 'What happens when I cancel?',
    a: 'Renewals stop. Pro stays active until the end of the period you paid for, then your account drops to Free. Your history, saved questions and credits stay.',
  },
  {
    q: 'What does Admission Compass compare?',
    a: 'Compass uses official DU programme rules and published historical allocation scores, free for everyone. Compass Pro adds a practice projection: what each CUET paper would be worth if exam day went like your own practice, with a range, checked against the 2026 cutoffs of the colleges on your shortlist. It is labelled as a projection, not a prediction or an admission chance.',
  },
  {
    q: 'Is Compass the same as Radar?',
    a: 'Radar describes your practice history. Compass checks sourced eligibility and historical cutoffs; with Pro, it also maps your practice to your DU shortlist and names the paper with the most marks open.',
  },
  {
    q: 'Are the community mocks reliable?',
    a: 'New recovery content must pass source, answer-key, family and independent calibration gates. Uncertain content is withheld. The ordinary legacy bank remains under audit; software checks alone do not establish academic accuracy.',
  },
  {
    q: 'How does the leaderboard work?',
    a: 'Every mock you take earns XP based on your speed, accuracy, and the difficulty of the questions. Your XP sets your rank on the global leaderboard, and the daily Mock Sprint carries a multiplier.',
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
        <section className="mm-section mm-section--flush" style={{ paddingTop: '2.5rem' }}>
          <div className="mm-wrap">
            <h1 className="mm-h1">{offer.purchasable === 'monthly' ? `Pro is ₹${offer.monthly.rupees} a month.` : `₹${offer.oneTime.rupees} gets you in.`}</h1>
            <p className="mm-lead" style={{ marginTop: '1rem' }}>
              {offer.purchasable === 'monthly'
                ? 'Start free and stay free if that is enough. Go Pro when you want unlimited practice, every mode and the full Radar. Cancel any month.'
                : `Start free and stay free if that is enough. For everything, one payment of ₹${offer.oneTime.rupees} covers access through ${offer.oneTime.expires}. Monthly Pro at ₹${offer.monthly.rupees} opens soon, and nobody who paid now loses a day.`}
            </p>
          </div>
        </section>

        <section className="mm-section">
          <div className="mm-wrap">
            <div className="mm-plans">
              {PLANS.map((plan) => (
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
              ))}
            </div>
          </div>
        </section>

        <section className="mm-section mm-section--sunken">
          <div className="mm-wrap">
            <h2 className="mm-h2">Free and Pro, line by line.</h2>
            <p className="mm-body mm-section__intro">
              Free is genuinely usable: credits gate how often you can generate, not what you can
              see.
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
            <h2 className="mm-h2">PrepOS, and its own credits.</h2>
            <p className="mm-body mm-section__intro">
              PrepOS reads your own practice record and shows your next step, your leaks and your weekly report. The basics are free for everyone and use no credits. Pro adds every ranked chapter, pace and changed-answer detail.
            </p>
            <p className="mm-body">
              Optional model replies use a separate PrepOS wallet: 10 credits a month on Free and 50 on Pro, never mixed with practice credits.
              Those replies are switched off while spending checks finish, so no credits are being used, and purchased credits you already hold are preserved.
            </p>
            <p style={{ marginTop: '1rem' }}>
              <Link href="/pricing/prepos" className="mm-btn mm-btn--secondary">See your PrepOS wallet</Link>
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
      {CAPABILITIES.recovery.state !== 'available' && <section className="container-std px-5 pb-12"><h2 className="display-md">Recovery is still in development</h2><p>{CAPABILITIES.recovery.reason} Planned recovery capabilities are excluded from the live paid comparison.</p></section>}
      <p className="container-std px-5 pb-8">Unlimited access covers available content and reattempts. It does not promise unlimited unique questions.</p>
      <MobileDock note={offer.purchasable === 'monthly' ? `Pro ₹${offer.monthly.rupees} a month. Cancel anytime.` : `₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}.`} label="Start free" href="/signup" />
    </div>
  );
}
