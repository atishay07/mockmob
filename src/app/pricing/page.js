export const dynamic = "force-dynamic";
import React from 'react';
import { newOfferReleased, RECOVERY_PACKAGING_ROWS } from '@/../data/capabilities';
import { priceHeadline, priceTag, publicOffer } from '@/lib/payments/offer';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MobileDock } from '@/components/MobileDock';
import { AppViewNotice } from '@/components/AppViewNotice';
import { JsonLd } from '@/components/JsonLd';
import { PricingCard } from '@/components/ui/PricingCard';
import { RazorpayPaymentButton } from '@/components/billing/RazorpayPaymentButton';
import { NtaArt, PapersArt, ProHeroArt, SmartArt, Tick } from '@/components/pricing/ProShowcase';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { countStepOnce } from '@/lib/server/funnelOnceStore';
import { Database } from '@/../data/db';
import { breadcrumbJsonLd, faqJsonLd, seoMetadata } from '@/lib/seo';
import { publicInventory } from '@/lib/server/inventory';
import { pricingBankFaq } from '@/lib/paperCopy.mjs';
import { practiceBankSize } from '@/lib/practiceBank.mjs';
import { ONE_CREDIT_LINE, PRACTICE_PRICE_LINE } from '@/lib/creditCopy.mjs';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_ON } from '@/../data/first_full_mock';
import { playBillingEnabled } from '@/lib/payments/playBilling';
import { REFERRAL_COPY, referralsLive } from '@/lib/referrals/friendInvite.mjs';
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

// The Pro page's words, mirrored from the app's Pro page (flutter_app/lib/features/billing/billing_copy.dart; owner I6, and
// 20 Oct 11:20 pm: "built like how it is on the app"). One idea per line. The price lives in the plan card, the line beside the
// key and the dock, never inside a key (D185: the key always says Get Pro).
const PRO_COPY = Object.freeze({
  label: 'MockMob Pro',
  title: 'Practise without limits',
  lede: 'Unlimited mocks from one central bank, every one new. Smart practice on the chapters you miss. The exam-day screen, as you will meet it.',
  unlocks: 'Everything Pro unlocks',
  also: 'Also in Pro',
  compare: 'Free and Pro, side by side',
  plan: 'One plan, everything in it',
  key: 'Get Pro',
  moments: [
    {
      key: 'mocks',
      eyebrow: 'Unlimited mocks',
      title: 'Sit as many mocks as you want',
      // D175 on the app; on the web the free first full mock in each subject (C-dec 1) is said while its switch is on.
      line: `Each Full mock is built fresh from one central question bank, so every paper is new. ${FIRST_FULL_MOCK_ON ? 'On Free, your first in each subject is free, then each costs 50 credits.' : 'On Free, each one costs 50 credits.'}`,
    },
    {
      key: 'smart',
      eyebrow: 'Smart practice',
      title: 'Every set aims at what you miss',
      line: 'Smart practice reads your record and leans each set toward the chapters you miss, so every set fixes something.',
    },
    {
      key: 'exam',
      eyebrow: 'NTA mode',
      title: 'Rehearse on the exam-day screen',
      line: '50 questions in 60 minutes, on the screen you will meet on the day: the clock, the palette, Mark for Review.',
    },
  ],
  badge: 'A new paper every time',
  smart: { plain: 'Plain set', smart: 'Smart set', legend: 'Chapters you miss', caption: 'An example set in Accountancy' },
  nta: { mode: 'NTA mode', clock: '59:12', question: 'Question 14 of 50', mark: 'Mark for Review & Next', save: 'Save & Next', palette: 'Question palette' },
  alsoTiles: [
    { key: 'difficulty', title: 'Easy, Medium and Hard', line: 'Choose how hard each set is, then step up.', art: '/art/pro/hybrid-metronome.webp', w: 126, h: 176 },
    { key: 'insights', title: 'Insights in detail', line: 'Your answer-change habit and pace across every paper.', art: '/art/pro/mobi-read.webp', w: 131, h: 176 },
  ],
  alsoMob: { key: 'mob', title: 'Host your Mob', line: 'Start as many games as you like, and up to 3 Mobs of your own.', art: '/art/pro/group-desk.webp', w: 240, h: 160 },
  onPro: 'You are on Pro',
  onProLine: 'Everything Pro includes is open.',
  manage: 'Manage your plan in Account',
});

/** The plan card's one line of terms, the dock's note and, while only one-time access is on sale, the monthly line. */
function planTerms(offer) {
  return offer.purchasable === 'monthly'
    ? { renew: 'Renews every month. Cancel any time.', dock: `₹${offer.monthly.rupees} a month. Cancel any time.`, soon: null }
    : {
      renew: `One payment, through ${offer.oneTime.expires}. It does not renew.`,
      dock: `₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}.`,
      soon: `Monthly Pro at ₹${offer.monthly.rupees} a month opens soon.`,
    };
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
      ['Credits', `50 free every month: 1 a question in Quick practice, 50 a Full mock, 1 a Mobi job (a mistake fixed for good, or a doubt answered and tested). Answers from your record are free.${FIRST_FULL_MOCK_ON ? ' Your first Full mock in each subject is free.' : ''}`],
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
    name: 'Pro',
    // One framing everywhere (release 9): the tag is what a buyer is charged today, like the landing trust row.
    ...priceTag(offer),
    // D185: the key says Get Pro, always; the price sits beside it.
    ctaLabel: PRO_COPY.key,
    planId: offer.purchasable === 'monthly' ? offer.monthly.planId : offer.oneTime.planId,
    billing: offer.purchasable === 'monthly' ? 'monthly' : 'once',
    amount: (offer.purchasable === 'monthly' ? offer.monthly.rupees : offer.oneTime.rupees) * 100,
  },
];

// Free and Pro, side by side: the app's rows (BillingCopy.compareRows), in the website's own true terms. A true cell is a tick,
// false a dash (not included), and text says the rest. Short, so the table reads at a glance.
const COMPARE_ROWS = newOfferReleased() ? RECOVERY_PACKAGING_ROWS : [
  ['A new paper every time', true, true],
  ['Full mocks', FIRST_FULL_MOCK_ON ? 'First one free, then 50 credits each' : '50 credits each', 'Unlimited'],
  ['Quick practice', '1 credit a question', 'Unlimited'],
  ['Smart practice', false, true],
  ['Exam-day screen', false, true],
  ['Easy, Medium, Hard', false, true],
  ['Insights in detail', 'Top three chapters', true],
];

// The Mob's rows and its "Also in Pro" tile, only while it is live (MOB_ENABLED and MOB_V3_ENABLED, the switches its route and
// API read), in the Mob's own Free and Pro terms (src/lib/mob/v3/denCopy.mjs, "Free and Pro in the Mob"): playing is free on
// every plan; Pro adds hosting. While Play billing is off, anyone can start a game (src/lib/mob/starts.mjs), and the row says so.
function mobRows(env = process.env) {
  if (newOfferReleased() || env.MOB_ENABLED !== 'true' || env.MOB_V3_ENABLED !== 'true') return null;
  return [
    ['Play Mob games', true, true],
    ['Start Mob games', playBillingEnabled(env) ? 'One a week in each Mob' : 'As many as you like', 'Unlimited'],
  ];
}

// D165 (owner, 20 Oct 2026): a new account starts with this month's 50 free credits only (no one-time 100), and an invited
// friend and the inviter each get 100 once the friend finishes a practice, said only while invites are on (REFERRALS_ENABLED).
const FREE_NOTES = [
  PRACTICE_PRICE_LINE,
  REFERRAL_COPY.pricingWelcome,
  ...(referralsLive() ? [REFERRAL_COPY.pricingInvite()] : []),
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

function CompareCell({ value, pro = false }) {
  if (value === true) return <><Tick className="pro-cmp__tick" /><span className="pro-sr">Included</span></>;
  if (value === false) return <><span className="pro-cmp__dash" aria-hidden="true" /><span className="pro-sr">Not included</span></>;
  return <span className={pro ? 'pro-cmp__word' : undefined}>{value}</span>;
}

/** One "Also in Pro" tile: the object, its name and one line. */
function AlsoTile({ tile, wide = false }) {
  return (
    <li className="pro-also__tile" data-wide={wide ? '' : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pro-also__art" src={tile.art} alt="" width={tile.w} height={tile.h} decoding="async" />
      <div>
        <h3>{tile.title}</h3>
        <p>{tile.line}</p>
      </div>
    </li>
  );
}

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
  // The stored daily count only (never a bank read on a request); without it the FAQ names no number.
  const inventory = await publicInventory().catch(() => null);
  // Summed over the subjects Practice offers: the stored bankSize also holds subjects that are not offered or retired.
  const bankSize = practiceBankSize(inventory);
  const PLANS = buildPlans(offer);
  const FAQS = buildFaqs(offer, bankSize);
  const [FREE_PLAN, PRO_PLAN] = PLANS;
  const terms = planTerms(offer);
  const mob = mobRows();
  const rows = mob ? [...COMPARE_ROWS, ...mob] : COMPARE_ROWS;
  const [moment1, moment2, moment3] = PRO_COPY.moments;

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

      {/* Opened from the Android app (?from=app): no plans or prices, a plain notice (src/app/app-view.css). */}
      <AppViewNotice />
      <main data-commerce-page>
        {/* The Pro page (version 16), section by section as the app draws it: the seal, the promise, what Pro unlocks, what
            else is in it, Free and Pro side by side, then the one plan with its one key. */}
        <section className="pro-hero" aria-labelledby="pro-title">
          <div className="pro-wrap pro-hero__grid">
            <ProHeroArt label={PRO_COPY.label} />
            <div className="pro-hero__copy">
              <h1 className="pro-hero__title" id="pro-title">{PRO_COPY.title}</h1>
              <p className="pro-hero__lede">{PRO_COPY.lede}</p>
              {isCurrentUserPremium ? null : (
                <p className="pro-hero__go" data-commerce="">
                  <a className="mm-btn mm-btn--primary" href="#plans">{PRO_COPY.key}</a>
                  <span className="pro-hero__price">{priceHeadline(offer)}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="pro-sec" aria-labelledby="pro-unlocks-h">
          <div className="pro-wrap">
            <h2 className="pro-h2" id="pro-unlocks-h">{PRO_COPY.unlocks}</h2>
            <ul className="pro-shows">
              <li className="pro-show" data-moment={moment1.key}>
                <PapersArt badge={PRO_COPY.badge} />
                <div className="pro-show__copy">
                  <p className="pro-show__eyebrow">{moment1.eyebrow}</p>
                  <h3>{moment1.title}</h3>
                  <p>{moment1.line}</p>
                </div>
              </li>
              <li className="pro-show" data-moment={moment2.key}>
                <SmartArt {...PRO_COPY.smart} />
                <div className="pro-show__copy">
                  <p className="pro-show__eyebrow">{moment2.eyebrow}</p>
                  <h3>{moment2.title}</h3>
                  <p>{moment2.line}</p>
                </div>
              </li>
              <li className="pro-show" data-moment={moment3.key}>
                <NtaArt copy={PRO_COPY.nta} />
                <div className="pro-show__copy">
                  <p className="pro-show__eyebrow">{moment3.eyebrow}</p>
                  <h3>{moment3.title}</h3>
                  <p>{moment3.line}</p>
                </div>
              </li>
            </ul>

            <h2 className="pro-h2 pro-h2--also" id="pro-also-h">{PRO_COPY.also}</h2>
            <ul className="pro-also" aria-labelledby="pro-also-h">
              {PRO_COPY.alsoTiles.map((tile) => <AlsoTile key={tile.key} tile={tile} />)}
              {mob ? <AlsoTile tile={PRO_COPY.alsoMob} wide /> : null}
            </ul>
          </div>
        </section>

        <section className="pro-sec pro-sec--plan" id="compare" aria-labelledby="pro-compare-h">
          <div className="pro-wrap pro-plan__grid">
            <div className="pro-cmp">
              <h2 className="pro-h2" id="pro-compare-h">{PRO_COPY.compare}</h2>
              <table className="pro-cmp__table">
                <thead>
                  <tr>
                    <td />
                    <th scope="col">Free</th>
                    <th scope="col" data-pro=""><span className="pro-cmp__pill">Pro</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([feature, free, pro]) => (
                    <tr key={feature}>
                      <th scope="row">{feature}</th>
                      <td><CompareCell value={free} /></td>
                      <td data-pro=""><CompareCell value={pro} pro /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* The one plan and its one checkout. The dock, the hero key and the Upgrade sheet (/pricing#plans) land here. */}
            <div className="pro-plan" id="plans">
              <div className="pro-plan__card" data-commerce="">
                {isCurrentUserPremium ? (
                  <>
                    <h2 className="pro-plan__title">{PRO_COPY.onPro}</h2>
                    <p className="pro-plan__renew">{PRO_COPY.onProLine}</p>
                    <Link className="mm-btn mm-btn--secondary pro-plan__manage" href="/profile#plan">{PRO_COPY.manage}</Link>
                  </>
                ) : (
                  <>
                    <h2 className="pro-plan__title" id="pro-price">{PRO_COPY.plan}</h2>
                    <p className="pro-plan__price"><span className="pro-plan__fig">{PRO_PLAN.price}</span> <span className="pro-plan__cycle">{PRO_PLAN.cycle}</span></p>
                    <p className="pro-plan__renew">{terms.renew}</p>
                    {terms.soon ? <p className="pro-plan__soon">{terms.soon}</p> : null}
                    <div className="pro-plan__go">
                      <RazorpayPaymentButton
                        planId={PRO_PLAN.planId}
                        amount={PRO_PLAN.amount}
                        label={PRO_PLAN.ctaLabel}
                        billing={PRO_PLAN.billing}
                        initialIsPremium={isCurrentUserPremium}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
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
                    <a className="mm-link" href="#compare">Free and Pro, side by side</a>
                  </div>
                </details>
              </div>
              {/* Side by side, how Free works fills the second column with facts from the table above. */}
              <div className="mm-plans__note" role="group" aria-label="How Free works">
                <h3>How Free works</h3>
                <ul>
                  {FREE_NOTES.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <a className="mm-link" href="#compare">Free and Pro, side by side</a>
              </div>
            </div>
          </div>
        </section>

        <section className="mm-section mm-section--sunken">
          <div className="mm-wrap mm-wrap--tight">
            <h2 className="mm-h2">Ask Mobi, on the same credits.</h2>
            <p className="mm-body mm-section__intro">
              One credits balance pays for practice and Ask Mobi, and everyone gets 50 free credits a month, used first. On Pro, practice needs none, so they all go to Ask Mobi.
            </p>
            <p className="mm-body">{ONE_CREDIT_LINE} Credits you have already bought stay in your account.</p>
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
      <MobileDock note={terms.dock} label={PRO_COPY.key} href="#plans" checkoutAware isPremium={isCurrentUserPremium} hideAtFooter />
    </div>
  );
}
