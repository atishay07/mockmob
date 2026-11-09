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

/**
 * The typing's timing, ms (LK74 typing field; refined 5 Nov for LK87 after a 50 ms film beside ug.preparoo.app).
 * Letters land whole, the way a caret types (no per-letter fade: it left a gap between the caret and a letter still
 * fading in). A slightly slower, even cadence with a beat at each word reads as someone typing rather than a printout;
 * the shorter holds keep the whole pass no longer than before (about 9 s with the caret's goodbye).
 */
export const TYPING = Object.freeze({
  /** This long after the page started loading when the opening was skipped (round 10, 10 Nov 2026: was 600). At 600 the
   *  first select-back cleared the line about 1.4 s in, so a student's first read of the headline was "CUET 2027. One mock."
   *  and an empty third line; now the whole sentence holds for the first read and the line clears no earlier than ~3 s. */
  startAfterPaint: 2200,
  /** After the opening's hand-off (first visits), a beat to read the whole sentence on the page the opening just lifted
   *  off, before the caret comes in (round 10: was 0, so the line cleared about 0.8 s after the page appeared). */
  afterOpening: 1000,
  /** While an opening plays, the pass starts at its hand-off, or this long after the hero mounts if the hand-off never
   *  arrives (round 4, LK120: the line must type on every visit; the longest opening is 1,600 ms). */
  openingFallback: 2400,
  /** The caret fades in at the end of the resting line when typing starts. */
  caretIn: 100,
  /** The resting line holds with its caret before the first select-back, so the sentence is read before it changes. */
  lead: 420,
  /** Select-back: a wash grows from the line's end to its start, then a beat, then the line clears. */
  wash: 180,
  beat: 90,
  /** Per letter, plus extra at the start of each new word and before the full stop. */
  letter: 46,
  afterSpace: 34,
  beforeStop: 80,
  /** A typed phrase holds this long before it is selected back; the caret blinks while it waits (from blinkOn). */
  hold: 1700,
  /** A caret at rest blinks like a text field's: 530 on, 530 off. After the final letter it blinks twice and leaves in 160 ms. */
  blinkOn: 530,
  blinkOff: 530,
  caretOut: 160,
});

/** When each letter of `text` lands, ms after the first: 46 a letter, +34 at the start of a word, +80 before the full stop. */
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
 *   caret   the caret fades in at the end of the resting line, which then holds for `lead`
 *   wash    select-back of the text on screen (the caret gives way to the selection)
 *   clear   the line empties
 *   letter  { phrase, count }: the first `count` letters of phrase `phrase` are on screen
 *   typed   { phrase, final }: a phrase is complete (HeroTyped dispatches window 'mm:hero-typed'; the caret rests and blinks)
 *   end     the caret's two blinks start; it is gone `caretTail` ms later
 * Phrases: HERO_TYPED then HERO_LINES[2], so it always rests on the approved sentence.
 */
export function typingPlan(phrases = HERO_SLOT_PHRASES, t = TYPING) {
  const steps = [{ at: 0, kind: 'caret' }];
  let at = t.caretIn + t.lead;
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
