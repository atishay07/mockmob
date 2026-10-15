// Pricing copy in plain numbers (web IA plan 4.4, 15 Oct 2026).
//
// Every credit number comes from data/plan_facts.mjs. The price comes from the `offer` argument,
// which the page takes from publicOffer() (src/lib/payments/offer.js). Nothing here types a credit
// number or a rupee amount itself, so a change in production facts changes the page and the tests.
//
// Plain module with relative imports only: the page, client code and node tests all read it.
import { PLAN_FACTS, freePlanLines, proPlanLines } from '../../../data/plan_facts.mjs';
import { TODAY_HREF } from '../../lib/navigation.js';

const credits = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const rupees = (amount) => `₹${amount}`;

/** The sentence-case words for the current offer: monthly once billing is ready, otherwise one-time. */
export function offerView(offer) {
  const monthly = offer.purchasable === 'monthly';
  const price = monthly ? offer.monthly.rupees : offer.oneTime.rupees;
  return {
    monthly,
    price,
    priceText: rupees(price),
    cycle: monthly ? 'a month' : 'once',
    planId: monthly ? offer.monthly.planId : offer.oneTime.planId,
    billing: monthly ? 'monthly' : 'once',
    expires: offer.oneTime.expires,
    monthlyText: rupees(offer.monthly.rupees),
  };
}

export function pricingTitle(offer) {
  const view = offerView(offer);
  return `MockMob Pro Pricing: ${view.priceText} ${view.monthly ? 'a month' : 'once'}`;
}

export function pricingDescription(offer) {
  const view = offerView(offer);
  const free = PLAN_FACTS;
  const start = `Start free with ${credits(free.practiceCredits.startingBalance.value, 'practice credit')} and ${free.aiCredits.freeMonthly.value} AI credits a month for CUET mocks.`;
  const pro = `MockMob Pro is ${view.priceText} ${view.monthly ? 'a month' : `once, through ${view.expires}`}: practice without credits, NTA mode, Smart practice, ${free.aiCredits.proMonthly.value} AI credits a month and your gap to each college.`;
  return `${start} ${pro}`;
}

export function pricingHeading(offer) {
  const view = offerView(offer);
  const free = PLAN_FACTS;
  const start = `Start with ${credits(free.practiceCredits.startingBalance.value, 'practice credit')} and ${free.aiCredits.freeMonthly.value} AI credits a month.`;
  return {
    h1: view.monthly ? `Free to start. Pro is ${view.priceText} a month.` : `Free to start. Pro is ${view.priceText}, once.`,
    lead: view.monthly
      ? `${start} Go Pro for practice without credits, NTA mode and ${free.aiCredits.proMonthly.value} AI credits a month. Cancel any month.`
      : `${start} One payment of ${view.priceText} covers Pro through ${view.expires}. It does not renew.`,
  };
}

/** The two plan cards. `signedIn` swaps the Free button from sign-up to Open MockMob. */
export function buildPlans(offer, { signedIn = false, todayHref = TODAY_HREF } = {}) {
  const view = offerView(offer);
  return [
    {
      id: 'free',
      name: 'Free',
      price: '₹0',
      cycle: 'no card',
      description: 'Enough to find out whether MockMob is for you.',
      features: freePlanLines(),
      ctaLabel: signedIn ? 'Open MockMob' : 'Start free',
      ctaHref: signedIn ? todayHref : '/signup',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: view.priceText,
      cycle: view.cycle,
      description: view.monthly
        ? 'Renews every month. Cancel whenever you like.'
        : `One payment covers you through ${view.expires}.`,
      features: ['Everything in Free', ...proPlanLines()],
      ctaLabel: view.monthly ? `Start Pro for ${view.priceText} a month` : `Get Pro for ${view.priceText}`,
      planId: view.planId,
      billing: view.billing,
      amount: view.price * 100,
      featured: true,
      footnote: view.monthly
        ? 'Auto-renews monthly. Cancel in Account; Pro continues to the end of the paid month.'
        : `Access ends ${view.expires}. No auto-renewal on this payment.`,
    },
  ];
}

/** The credit lines in "Two kinds of credits": what each action uses, from plan_facts. */
export function practiceCreditRows() {
  const p = PLAN_FACTS;
  return [
    ['Free accounts start with', credits(p.practiceCredits.startingBalance.value, 'practice credit')],
    ['Quick practice', `${credits(p.practiceCredits.quickCost.value, 'credit')}, for ${p.sessions.quickCounts.value[0]} to ${p.sessions.quickCounts.value[p.sessions.quickCounts.value.length - 1]} questions`],
    ['Full mock', `${credits(p.practiceCredits.fullMockCost.value, 'credit')}, for ${p.sessions.fullQuestions.value} questions in ${p.sessions.fullMinutes.value} minutes`],
    ['Smart practice and NTA mode', 'Come with Pro'],
    ['With Pro', 'Practice without credits'],
  ];
}

export function aiCreditRows({ repairOn = true, askOn = true } = {}) {
  const a = PLAN_FACTS.aiCredits;
  const rows = [
    ['Every month', `${a.freeMonthly.value} on Free, ${a.proMonthly.value} on Pro. Renews on the ${a.renews.value}.`],
  ];
  if (repairOn) {
    rows.push(['Mistake Repair', `${credits(a.repairCost.value, 'credit')} for each mistake. A repair already prepared for that question is shown again at no charge.`]);
  }
  if (askOn) {
    rows.push(['Ask Mobi', `${credits(a.askMobiReplyCost.value, 'credit')} for each reply. Questions about your own record are answered from the record and are free.`]);
  }
  return rows;
}

/** The line-by-line table: [feature, free, pro, marker]. Values are true, false or text. */
export function buildCostGroups({ repairOn = true, askOn = true } = {}) {
  const p = PLAN_FACTS;
  const practice = [
    [`Quick practice, ${p.sessions.quickCounts.value[0]} to ${p.sessions.quickCounts.value[p.sessions.quickCounts.value.length - 1]} questions`, `${credits(p.practiceCredits.quickCost.value, 'practice credit')} each`, 'No credits used'],
    [`Full mock, ${p.sessions.fullQuestions.value} questions, ${p.sessions.fullMinutes.value} minutes`, `${credits(p.practiceCredits.fullMockCost.value, 'practice credit')} each`, 'No credits used'],
    ['Smart practice, adaptive', false, true],
    ['NTA mode, the CUET exam screen', false, true],
  ];
  const ai = [['AI credits each month', String(p.aiCredits.freeMonthly.value), String(p.aiCredits.proMonthly.value)]];
  if (repairOn) ai.push(['Mistake Repair, one mistake', credits(p.aiCredits.repairCost.value, 'AI credit'), credits(p.aiCredits.repairCost.value, 'AI credit')]);
  if (askOn) {
    ai.push(['Ask Mobi, one reply', credits(p.aiCredits.askMobiReplyCost.value, 'AI credit'), credits(p.aiCredits.askMobiReplyCost.value, 'AI credit')]);
    ai.push(['Ask Mobi about your own record', true, true]);
  }
  return [
    { heading: 'Practice', rows: practice },
    { heading: 'Mistake Repair and Ask Mobi', rows: ai },
    {
      heading: 'Your record and tools',
      rows: [
        ['Cutoff calculator and Combo planner', true, true],
        ['Your record: top three chapters and weekly summary', true, true],
        ['Your record: every ranked chapter, pace and changed answers', false, true],
        ['Your gap to each college', false, true, 'popular'],
        ['Difficulty selector', false, 'Easy, medium, hard or auto'],
        ['Saved questions', `${p.savedQuestions.freeLimit.value} saves`, 'Unlimited'],
        ['Leaderboard', true, true],
      ],
    },
  ];
}

export function buildFaqs(offer, { repairOn = true } = {}) {
  const view = offerView(offer);
  const p = PLAN_FACTS;
  const faqs = [
    {
      q: 'Is Pro a monthly subscription?',
      a: view.monthly
        ? `Yes. Pro is ${view.priceText} a month and renews automatically until you cancel. Cancel in Account at any time; you keep Pro until the end of the month you already paid for.`
        : `Monthly Pro at ${view.monthlyText} a month opens soon. Until then you can pay ${view.priceText} once for access through ${view.expires}, with no auto-renewal. That payment keeps its full term when monthly billing opens.`,
    },
    {
      q: 'What happens when I cancel?',
      a: 'Renewals stop. Pro stays active until the end of the period you paid for, then your account drops to Free. Your history, saved questions and credits stay.',
    },
    {
      q: 'What are practice credits and AI credits?',
      a: `Practice credits pay for mocks and practice: ${credits(p.practiceCredits.quickCost.value, 'credit')} for a Quick practice and ${p.practiceCredits.fullMockCost.value} for a Full mock. AI credits pay for ${repairOn ? 'Mistake Repair and ' : ''}Ask Mobi: ${p.aiCredits.freeMonthly.value} a month on Free and ${p.aiCredits.proMonthly.value} on Pro. The two are never mixed.`,
    },
    {
      q: 'What does the Cutoff calculator compare?',
      a: 'It uses official DU programme rules and published historical allocation scores, free for everyone. With Pro, Your gap to each college adds a practice projection: what each CUET paper would be worth if exam day went like your own practice, with a range, checked against the 2026 cutoffs of the colleges on your shortlist. It is a projection, not a prediction or an admission chance.',
    },
    {
      q: 'Is the Cutoff calculator the same as Your record?',
      a: 'No. Your record describes your practice history. The Cutoff calculator checks sourced eligibility and historical cutoffs; with Pro, it also maps your practice to your DU shortlist and names the paper with the most marks open.',
    },
    {
      q: 'Are the questions reliable?',
      a: 'Questions pass automated checks on the answer key, duplicates and difficulty before they reach you. Those checks catch defects, but they do not prove every question is correct. If an answer looks wrong, write to support@mockmob.in.',
    },
    {
      q: 'Do I need a card to start?',
      a: 'No. Free needs an account and nothing else. Pro payments run through Razorpay, with UPI, cards or netbanking.',
    },
  ];
  return faqs;
}

/** What Pro's "unlimited" does not promise (shown once, under the table). */
export const UNLIMITED_NOTE = 'Pro removes the credit limit on practice. It does not promise unlimited unique questions: you practise what is in the bank and can reattempt it. NTA mode follows the 2026 format until NTA publishes the 2027 rules.';
