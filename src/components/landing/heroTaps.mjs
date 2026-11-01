// The home hero's Mobi lines (LK32, LK29; hero.md item 3) and the hero's two quiet fact lines (item 4). Pure: no
// browser, no clock, so the words are tested (heroTaps.test.mjs). Word for word as decided; change them here only.
//
// On load his bubble says how he works ("Tap me."). Each tap shows the next line, one per tap, six in all; the sixth
// stays and later taps only squash him. Tap 3 carries the live bank count, the real stored inventory the page already
// reads (/api/stats bankSize, through bankStats.js); without it the line still holds, with no number (never made up).

export const HERO_LINE_LOAD = 'Hi, I’m Mobi. Tap me.';
export const HERO_TAP_COUNT = 6;
/** The step (1 to 6) whose tap also lifts the "Try five questions" key once (his "Try five questions?"). */
export const HERO_KEY_LIFT_STEP = 4;

const n = (count) => Number(count).toLocaleString('en-IN');
const hasCount = (count) => Number.isFinite(count) && count > 0;

/** The line for a tap step: 0 is the load line, 1 to 6 the taps; past 6 the sixth stays. */
export function heroTapLine(step, bankSize = null) {
  const s = Math.max(0, Math.min(HERO_TAP_COUNT, Math.floor(Number(step) || 0)));
  switch (s) {
    case 0: return HERO_LINE_LOAD;
    case 1: return 'I find where your marks slip.';
    case 2: return 'One timed mock shows me the chapter.';
    case 3: return hasCount(bankSize) ? `${n(bankSize)} questions. A fresh mock every time.` : 'One big bank. A fresh mock every time.';
    case 4: return 'Okay, okay. Try five questions?';
    case 5: return 'Free to start. These five need no signup.';
    default: return 'That’s all my tips. Go on, try one.';
  }
}

/** Every line in order (load, then taps 1 to 6), for the tests and anyone checking the copy. */
export function heroTapLines(bankSize = null) {
  return Array.from({ length: HERO_TAP_COUNT + 1 }, (_, i) => heroTapLine(i, bankSize));
}

/** The next step after a tap (it stops at the sixth line). */
export const nextHeroStep = (step) => Math.min(HERO_TAP_COUNT, (Number(step) || 0) + 1);

/** The hero's bank line, one short line under the reassurances (the long sentence stays in the FAQ and the shelf). */
export function heroBankLine(bankSize = null) {
  return hasCount(bankSize) ? `One bank of ${n(bankSize)} questions. No cap on Pro.` : 'One live question bank. No cap on Pro.';
}

/** The three reassurances as one line with middle dots. `price` is priceLine(OFFER); `monthly` picks the last part. */
export function heroTrustLine(price, { monthly = true } = {}) {
  return ['Free to start', price, monthly ? 'Cancel anytime' : 'No auto-renewal'].filter(Boolean).join(' · ');
}
