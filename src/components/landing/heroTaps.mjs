// The home hero's words that are not the headline (1104 "Desk Light", decisions 13, 14, 18; round 3 R3-D3, LK99/LK100,
// 5 Nov 2026): Mobi's bubble on the desk, the one fact line under the keys and the four facts of the second beat. Pure:
// no browser, no clock, so the words are tested (heroTaps.test.mjs, homeHero.test.mjs). Word for word as decided;
// change them here.
//
// The bubble's lines come only from the sample's state, never from taps (decision 13): on load he says his name and
// hands you the first question (R3-D3: "Hi, I'm Mobi." is back, brandloss B5); a right answer and a miss each get a
// line; the fifth answer gets the last. A tap gives one reaction act and leaves the line as it is.

/** The bubble's four lines, by the sample's state. Each at most 44 characters, sentence case, no hype. */
export const DESK_LINES = Object.freeze({
  load: 'Hi, I’m Mobi. Your first question. Go.',
  right: 'Right. The why is under it.',
  miss: 'Close one. Read the why.',
  five: 'That’s five. Pick your subject next.',
});
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

/** The number strip's accessible name (its nav landmark): what the four facts answer, in sentence case. */
export const HERO_BEAT_LABEL = 'Why MockMob';

/**
 * The second beat (R3-D3, LK100: "branded properly ... shown properly"): the same four facts as before, now with their
 * number weight and a desk object each (the number strip under the hero, HeroBeatStrip): `figure` in the brand word
 * colour, `unit` what it counts, `line` one quiet line, `icon` the desk object (BrandIcon). The facts
 * are unchanged: five free questions on this page, the DU programme count (DU_FACTS, live from the index), the two exam
 * screens, the 60-minute 50-question clock. `programmes` is duIndexFacts().programmes, or null (then three facts).
 */
export function heroBeat(programmes = null) {
  const du = Number.isFinite(programmes) && programmes > 0;
  return [
    { href: '#try-practice', icon: 'questions', figure: '5', unit: 'questions free', line: 'Each with the why, no signup' },
    ...(du ? [{ href: '#du-eligibility', icon: 'compass', figure: String(programmes), unit: 'DU programmes', line: 'Matched to your subjects' }] : []),
    { href: '#exam-experience', icon: 'papers', figure: '2', unit: 'exam screens', line: 'Practise calm, rehearse NTA style' },
    { href: '#your-prep', icon: 'today', figure: '60', unit: 'minutes, 50 questions', line: 'The full CUET clock' },
  ];
}
