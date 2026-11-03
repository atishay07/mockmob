// The home hero's words that are not the headline (1104 "Desk Light", decisions 13, 14, 18): Mobi's bubble on the
// desk, the two fact sentences under the key and the four sentence links of the second beat. Pure: no browser, no
// clock, so the words are tested (heroTaps.test.mjs, homeHero.test.mjs). Word for word as decided; change them here.
//
// The bubble's lines come only from the sample's state, never from taps (decision 13): on load he hands you the first
// question; a right answer and a miss each get a line; the fifth answer gets the last. A tap gives one reaction act
// and leaves the line as it is. The six tap-only pitch lines (LK32) retired: their facts now live in the lead, the
// typed line and the bank line.

/** The bubble's four lines, by the sample's state. Each at most 44 characters, sentence case, no hype. */
export const DESK_LINES = Object.freeze({
  load: 'Your first question. Go.',
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
 * The second beat (decision 14): four sentence links in a hairline row, no big numbers, no glass. The facts are
 * unchanged from the old proof strip: five free questions, the DU programme count (DU_FACTS, live from the index),
 * two exam screens, the 60-minute 50-question clock. `programmes` is duIndexFacts().programmes, or null.
 */
export function heroBeat(programmes = null) {
  return [
    { href: '#try-practice', title: 'Five questions free', line: 'Each with the why, no signup' },
    ...(Number.isFinite(programmes) && programmes > 0
      ? [{ href: '#du-eligibility', title: `${programmes} DU programmes`, line: 'Matched to your subjects' }]
      : []),
    { href: '#exam-experience', title: 'Two exam screens', line: 'Practise calm, rehearse NTA style' },
    { href: '#your-prep', title: '60 minutes, 50 questions', line: 'The full CUET clock' },
  ];
}

/** The lead (LK70): what MockMob is, in one sentence. The first clause is set in ink at weight 650. */
export const HERO_LEAD = Object.freeze({
  strong: 'MockMob is CUET UG mock tests',
  rest: ' with a review that finds the chapter behind every mark you lose.',
});
