// The home hero's headline (LK74, SPEC-HOME-1104 decision 7): "CUET 2027. One mock. Know what to fix."
// Pure, so node --test can hold the words and the typing's timing (heroLines.test.mjs); page.js renders the first two
// lines and HeroTyped.jsx the third.
//
// History: R3 ruling H1 (1 Nov) made the headline static. On 4 Nov the owner asked for a refined typing animation in
// Preparoo's direction (LK74, L-016: "a typed line or a crisp per-letter morph is fine"), so the third line types ONCE
// per page view and rests on the approved sentence: no loop, no forever-blinking caret, no glass, no glow.
//
// The DOM sentence never changes: the server renders "Know what to fix." (no-JS, crawlers and the LCP see it), a
// screen reader always reads HERO_SENTENCE, and the typed slot is aria-hidden.
//
// Truth (decision 18):
//   "Fresh every time."  every mock is built fresh from one live bank (the FAQ's approved claim; the USP said quietly);
//   "Every mark traced." the Mistake Lab traces every mark (time, changed answers, the reason behind each miss);
//   "Know what to fix."  chapter review names the chapter to fix first, and the free SWOT gives the sets to do next
//                        (data/mock_swot.js).
// The first line keeps the brand-word colour (.lp-title__brand).

export const HERO_LINES = Object.freeze(['CUET 2027.', 'One mock.', 'Know what to fix.']);
/** What a screen reader and a search engine read: the headline as one sentence. */
export const HERO_SENTENCE = HERO_LINES.join(' ');
/** The phrases the third line types once before it rests on HERO_LINES[2]. */
export const HERO_TYPED = Object.freeze(['Fresh every time.', 'Every mark traced.']);
/** Every phrase the slot can show, in order: what its sizer measures (the widest sets the box, so nothing shifts). */
export const HERO_SLOT_PHRASES = Object.freeze([...HERO_TYPED, HERO_LINES[2]]);

/** The typing's timing, ms (LK74 typing field). */
export const TYPING = Object.freeze({
  /** After the opening's hand-off, or this long after first paint when the opening was skipped. */
  startAfterPaint: 600,
  /** The caret fades in when typing starts. */
  caretIn: 100,
  /** Select-back: a wash grows from the line's end to its start, then a beat, then the line clears. */
  wash: 220,
  beat: 100,
  /** Per letter, plus extra after a space and before the full stop. */
  letter: 34,
  afterSpace: 24,
  beforeStop: 70,
  /** Each typed letter fades in and rises 0.06 em. */
  letterIn: 60,
  /** A typed phrase holds this long before it is selected back. */
  hold: 2200,
  /** After the final letter: the caret blinks twice (530 on, 530 off) and leaves in 160 ms. Never loops. */
  blinkOn: 530,
  blinkOff: 530,
  caretOut: 160,
});

/** When each letter of `text` lands, ms after the first: 34 a letter, +24 after a space, +70 before the full stop. */
export function letterTimes(text, t = TYPING) {
  const out = [];
  let at = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (i > 0) {
      at += t.letter;
      if (text[i - 1] === ' ') at += t.afterSpace;
      if (text[i] === '.' && i === text.length - 1) at += t.beforeStop;
    }
    out.push(at);
  }
  return out;
}

/**
 * The one pass, as steps the component plays in order: each { at (ms from the start), kind, ... }.
 *   caret   the caret fades in
 *   wash    select-back of the text on screen
 *   clear   the line empties
 *   letter  { phrase, count }: the first `count` letters of phrase `phrase` are on screen
 *   typed   { phrase, final }: a phrase is complete (HeroTyped dispatches window 'mm:hero-typed')
 *   end     the caret's two blinks start; it is gone `caretTail` ms later
 * Phrases: HERO_TYPED then HERO_LINES[2], so it always rests on the approved sentence.
 */
export function typingPlan(phrases = HERO_SLOT_PHRASES, t = TYPING) {
  const steps = [{ at: 0, kind: 'caret' }];
  let at = t.caretIn;
  phrases.forEach((text, phrase) => {
    steps.push({ at, kind: 'wash' });
    at += t.wash + t.beat;
    steps.push({ at, kind: 'clear' });
    const times = letterTimes(text, t);
    times.forEach((dt, i) => steps.push({ at: at + t.letter + dt, kind: 'letter', phrase, count: i + 1 }));
    at += t.letter + times[times.length - 1];
    const final = phrase === phrases.length - 1;
    steps.push({ at, kind: 'typed', phrase, final });
    if (!final) at += t.hold;
  });
  steps.push({ at, kind: 'end' });
  return steps;
}

/** How long the caret lives after the final letter: two blinks, then it leaves. */
export const caretTail = (t = TYPING) => t.blinkOn + t.blinkOff + t.blinkOn + t.caretOut;
