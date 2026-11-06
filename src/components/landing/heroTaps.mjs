// The home hero's words that are not the headline (1104 "Desk Light", decisions 13, 14, 18; round 3 R3-D3, LK99/LK100;
// round 4, owner LK121/LK122/LK124, 5 Nov 2026): Mobi's bubble on the desk, the features strip under the keys and its price
// hook. Pure: no browser, no clock (the caller passes the date), so the words are tested (heroTaps.test.mjs, homeHero.test.mjs).
// Word for word as decided; change them here.
//
// The bubble's lines come only from the sample's state, never from taps (decision 13): on load he says his name and
// offers you a CUET question; a right answer and a miss each get a line; the fifth answer gets the last. A tap gives one
// reaction act and leaves the line as it is. Round 4 (LK122: "think from a marketing angle ... how to write copy
// properly"): plain, warm, complete sentences that invite, and no "Go.".

import { MOCK_PACES, paceWords, perMock } from '../../lib/payments/value.mjs';

/** The bubble's four lines, by the sample's state. Each at most 44 characters, sentence case, no hype. */
export const DESK_LINES = Object.freeze({
  load: 'Hi, I’m Mobi. Try this CUET question.',
  right: 'That’s right. The reason is just below.',
  miss: 'Not this time. The reason is just below.',
  five: 'All five done. Sign up to keep going.',
});
/** The sample card's note under the options (round 4, LK122): what the five are, said once, plainly. */
export const DESK_NOTE = 'Free, no sign-up. Every answer shows its reason.';
export const DESK_STATES = Object.freeze(Object.keys(DESK_LINES));

/** The line for a sample state ('load', 'right', 'miss' or 'five'); anything else is the load line. */
export function deskLine(state) {
  return DESK_LINES[state] || DESK_LINES.load;
}

/**
 * The sample's state after an answer: the last of `total` questions answered is 'five' (whatever the pick), before
 * that a right pick is 'right' and a wrong one 'miss'. `index` is the answered question's place, from 0.
 */
export function deskStateAfter({ index, correct, total = 5 }) {
  if (Number(index) + 1 >= total) return 'five';
  return correct ? 'right' : 'miss';
}

/** Mobi's act for a sample state: right is the app's `correct`, a miss `encourage`, the fifth `cheer`. */
export function deskAct(state) {
  return { right: 'correct', miss: 'encourage', five: 'cheer' }[state] || null;
}

const n = (count) => Number(count).toLocaleString('en-IN');
const hasCount = (count) => Number.isFinite(count) && count > 0;

/** The hero's bank line, one short sentence (the long sentence stays in the FAQ and the shelf). Live count only. */
export function heroBankLine(bankSize = null) {
  return hasCount(bankSize) ? `One bank of ${n(bankSize)} questions. No cap on Pro.` : 'One live question bank. No cap on Pro.';
}

/** The reassurances as separate parts, in order. `price` is priceLine(OFFER); `monthly` picks the last part. */
export function heroTrustSegments(price, { monthly = true } = {}) {
  return ['Free to start', price, monthly ? 'Cancel anytime' : 'No auto-renewal'].filter(Boolean);
}

/**
 * The reassurances as one sentence pair, with no middle dots (slop T6): "Free to start. Pro ₹99 a month, cancel
 * anytime." The one-time offer reads "Free to start. Pro ₹99 once, through 31 July 2027, no auto-renewal."
 */
export function heroTrustSentence(price, { monthly = true } = {}) {
  const [first, ...rest] = heroTrustSegments(price, { monthly });
  if (!rest.length) return `${first}.`;
  const tail = rest.map((part, i) => (i === 0 ? part : part.charAt(0).toLowerCase() + part.slice(1))).join(', ');
  return `${first}. ${tail}.`;
}

/** @deprecated The old dotted line (R3 H2). Kept only until heroLines.test.mjs moves to heroTrustSentence. */
export function heroTrustLine(price, options) {
  return heroTrustSegments(price, options).join(' · ');
}

/**
 * The hero's one fact line (R3-D3, LK99: "the two fact lines become one line"; preparoo B11). The live bank count
 * leads in ink weight (`count`), then the money (`rest`): "N questions. Free to start, Pro ₹99 a month." Until a
 * live count arrives (or when there is none) only the money shows, the same words, so nothing a reader has read
 * changes: the count simply appears in front. One line on a 360 px phone for the monthly offer, no middle dots, never
 * a typed number. `price` is priceLine(OFFER) ("Pro ₹99 a month", or "Pro ₹99 once, through 31 July 2027").
 */
export function heroFactLine(price, { bankSize = null } = {}) {
  // "Pro" and its price never part at a wrap (the one-time offer's longer clause wraps on phones).
  const rest = price ? `Free to start, ${price.replace(/^Pro /, 'Pro\u00a0')}.` : 'Free to start.';
  return hasCount(bankSize) ? { count: `${n(bankSize)} questions.`, rest: ` ${rest}` } : { count: '', rest };
}

/** The features strip's accessible name (its nav landmark). */
export const HERO_FEATURES_LABEL = 'What MockMob gives you';

/**
 * The features strip (round 4, owner LK124: "highlight the main features ... or remove"; supersedes R3-D3's number strip of
 * 5 / 73 / 2 / 60): the main features, each with its desk object (stripObjects.mjs; round 5, LK160) and one plain line, each a link
 * to where it lives on this page. The Compass link falls back to the free DU calculator when the page has no Compass section; Key
 * cards appear only while their section does (KEY_CARDS_ENABLED). Every line says only what its own section says (homeHero.test.mjs
 * HERO_STRINGS). `icon` names the object: the one that stamps the linked section, the answer sheet for mocks, Mobi for Ask Mobi.
 */
export function heroFeatures({ compass = true, keyCards = false } = {}) {
  return [
    { href: '#pricing', icon: 'questions', name: 'Unlimited mocks', line: 'On Pro, every one fresh' },
    { href: '#inside-the-lab', icon: 'mistakes', name: 'Mistake Lab', line: 'Every lost mark, traced' },
    { href: '#score-recovery-lab', icon: 'revise', name: 'Score Recovery', line: 'Fix it once, check it holds' },
    { href: compass ? '#compass' : '#du-eligibility', icon: 'compass', name: 'DU Compass', line: 'Check your DU shortlist' },
    { href: '#your-prep', icon: 'mobi', name: 'Ask Mobi', line: 'One clear step for tonight' },
    ...(keyCards ? [{ href: '#key-cards', icon: 'keycards', name: 'Key cards', line: 'Turn it, rate it, keep it' }] : []),
  ];
}

/**
 * The honest price hook (owner LK124: "as low as ₹1 a mock"): what one Full mock comes to on Pro at the top pace of the
 * pricing section's slider (value.mjs MOCK_PACES), worked out from the live offer by perMock (rounded UP to the next 10
 * paise, never down). The figure never stands without its pace (round 4 review: a best case shown first must carry its
 * condition in the same line, at the same weight): "As low as ₹X a mock on Pro at 3 full mocks a day", the pace in the
 * slider's own words (value.mjs paceWords; round 5, owner 6 Nov 2026: "3 a day makes sense"), then the price that makes it on
 * its own line, so it can be checked in the receipt at the slider's top. A monthly price and a one-time price never share a
 * sentence. null when it cannot be worked out (then no hook is drawn). The figures follow the offer and the slider; none is
 * typed.
 * { lead: 'As low as', figure, unit: 'a mock on Pro', at: 'at 3 full mocks a day', line: '₹P a month.', pace, href }
 */
export function heroPriceHook(offer, { from } = {}) {
  const pace = Math.max(...MOCK_PACES);
  const m = perMock(offer, pace, { from });
  if (!m) return null;
  const line = m.kind === 'monthly' ? `${m.price} a month.` : `${m.price} once, to ${m.until}.`;
  // Owner, 7 Nov 2026: "why not just make it ₹1 ... doesn't matter, that 10 paisa". From a rupee up the figure is the nearest
  // whole rupee and says "About" (₹99 over 90 mocks is ₹1.10: "About ₹1"); under a rupee it stays the exact-ish paise figure.
  const whole = m.exactPaise >= 100 ? Math.round(m.exactPaise / 100) : null;
  return { lead: whole ? 'About' : 'As low as', figure: whole ? `₹${whole}` : m.about, unit: 'a mock on Pro', at: `at ${paceWords(pace).long}`, line, pace, href: '#pricing' };
}
