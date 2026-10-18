// The hero headline's changing third line (L-016, D38, 18 Oct 2026): "CUET 2027. / One mock. / <phrase>".
// Pure, so node --test can hold the words and the timing (heroPhrases.test.mjs) and HeroMorph.jsx renders them.
//
// Every phrase is true and short enough to sit on ONE line of the headline at 320 px and up, at the hero's size
// (the widest, "Every mark traced.", is 8.7 em; the copy column holds 9 em on a phone and 8.8 em on a desktop).
// Where each one is true:
//   "No more guessing."  the copy deck's line 3 (docs/design-decisions/landing-copy-bolder-1018.md); the lead under
//                        it says what replaces the guessing: a timed mock and where every mark went.
//   "Every mark traced." the Mistake Lab ledger sorts every missed mark into one group (labStory.mjs marksLedger)
//                        and its heading is the owner's praised "Every mark, traced back to a moment."
//   "Know what to fix."  chapter review names the chapter to fix first, and the free SWOT gives the sets to do next
//                        (data/mock_swot.js).
//   "Fresh every time."  every mock is built fresh from one live bank (practiceSessions.js builds the paper at
//                        start; QuestionBankLine, ONBOARDING_LEAD). It says fresh, never "never repeats".

export const HERO_LINES = Object.freeze(['CUET 2027.', 'One mock.']);
export const HERO_PHRASES = Object.freeze(['No more guessing.', 'Every mark traced.', 'Know what to fix.', 'Fresh every time.']);
// What a screen reader and a search engine read: the headline with its first phrase, never the cycle.
export const HERO_SENTENCE = [...HERO_LINES, HERO_PHRASES[0]].join(' ');

// The motion, per letter: the old letter rises 0.35 em and fades (gone by 60% of OUT_MS, so it has left before the
// new letter under it shows), the new one rises in from 0.35 em below. A letter's change takes CHANGE_MS (out starts
// at 0, in starts at IN_DELAY_MS and ends at CHANGE_MS); the letters follow each other STAGGER_MS apart. Each phrase holds HOLD_MS once its last letter lands; the first
// change waits FIRST_MS so Mobi has landed and waved and the reader has read the line once.
export const MORPH = Object.freeze({
  STAGGER_MS: 20,
  OUT_MS: 240,
  IN_DELAY_MS: 120,
  IN_MS: 360,
  CHANGE_MS: 480,
  HOLD_MS: 2600,
  FIRST_MS: 3600,
  RISE_EM: 0.35,
  EASE: 'cubic-bezier(0.23, 1, 0.32, 1)',
});

/** The letters of a phrase, grouped into words so a narrow window (200% zoom) can still wrap at a space. Each
 * letter carries its index in the whole phrase (spaces count), which sets its place in the stagger. */
export function phraseWords(phrase) {
  const words = [];
  let i = 0;
  for (const word of String(phrase).split(' ')) {
    words.push(Array.from(word).map((ch) => ({ ch, i: i++ })));
    i++; // the space
  }
  return words;
}

/** How long a whole change takes on screen, from the first old letter leaving to the last new letter landing. */
export function changeSpanMs(from, to) {
  const last = Math.max(String(from).length, String(to).length) - 1;
  return last * MORPH.STAGGER_MS + MORPH.CHANGE_MS;
}

export const nextPhrase = (index, count = HERO_PHRASES.length) => (index + 1) % count;

/** Whether the line may change at all right now. Reduce motion (the system's or MockMob's own) keeps the first
 * phrase, still; so does a hidden tab or a hero that has scrolled out of view (the cycle pauses there). */
export function mayMorph({ reduced = false, hidden = false, inView = true, count = HERO_PHRASES.length } = {}) {
  return !reduced && !hidden && inView && count > 1;
}
