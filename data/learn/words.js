// Learn v2 round 3 (R3-SPEC ruling W): one word for each thing, everywhere. PURE. Learn home, the run, the feed, the ends,
// the chapter page, Explore's covers and Today take these labels from here, so a word changes in one place and the copy tests
// pin it once. Questions keep "Save" (it goes to Saved, by design); Key cards use "Revise later" (it goes to Revise).

export const WORDS = Object.freeze({
  turnOver: 'Turn over',
  turnCue: 'Tap the card to turn it over',
  pickHint: 'Pick the answer you think is right.',
  continue: 'Continue',
  keepGoing: 'Keep going',
  nextChapter: 'Next chapter',
  reviseLater: 'Revise later',
  inRevise: 'In Revise',
  revise: 'Revise',
  missedIt: 'Missed it',
  coachRatings: 'How well did you know it? Missed it brings the card back soon. Got it, in a few days. Easy, much later.',
  save: 'Save',
  saved: 'Saved',
  skipKnown: 'Skip what you already know',
  quickRecap: 'Quick recap',
  seePro: 'See Pro',
  singles: 'Answer single questions',
});

const count = (n) => Math.max(0, Math.floor(Number(n) || 0));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A whole number of minutes for a label: rounded up, at least 1. */
export function wholeMinutes(minutes) {
  return Math.max(1, Math.ceil(Number(minutes) || 0));
}

/** "Continue · 6 min": a label with its length (" · N min"; never ", 10 min" or "minutes"). */
export function withMinutes(label, minutes) {
  return `${label} · ${wholeMinutes(minutes)} min`;
}

/** "Fix 3 open mistakes · 3 min" ("open mistakes" is the one name for question mistakes). */
export function fixMistakes(n, minutes) {
  return withMinutes(`Fix ${plural(count(n), 'open mistake')}`, minutes);
}

/** "Revise 9 due cards · 3 min" (due Key cards; never a bare "9 due"). */
export function reviseDue(n, minutes) {
  return withMinutes(`Revise ${plural(count(n), 'due card')}`, minutes);
}

/** "Revise 5 questions" (Today's paper questions to revise; never "Revise 0 of 5 questions"; the dot is for a length only). */
export function reviseQuestions(n) {
  return `Revise ${plural(count(n), 'question')}`;
}

/** "4 to revise" (the Revise-later pile's visible label on desktop; the pile shows only from 1). */
export function pileLabel(n) {
  return `${count(n)} to revise`;
}

/** "Chapter 5 of 14": a chapter's place among the student's playable chapters in roadmap order (R4 ruling N). */
export function chapterPlace(place) {
  const n = count(place?.n);
  const of = count(place?.of);
  return n && of ? `Chapter ${n} of ${of}` : '';
}

/** "Chapter 5": the short form for tight spots (Explore covers). */
export function chapterShort(place) {
  const n = count(place?.n);
  return n ? `Chapter ${n}` : '';
}

/**
 * When a rated card comes back, in words (R5 LK38), from the days FSRS gives it: under 1.5 days "tomorrow", then "in N days" to
 * 13, "in N weeks" to 8 weeks, then "in N months". One function for the keys' second line, the stamp after a rating and the
 * tests, so what a key promises is what the stamp says.
 */
export function returnWords(days) {
  const d = Math.max(0, Number(days) || 0);
  if (d < 1.5) return 'tomorrow';
  const n = Math.round(d);
  if (n <= 13) return `in ${n} days`;
  if (n < 56) return `in ${plural(Math.round(n / 7), 'week')}`;
  return `in ${plural(Math.round(n / 30.4), 'month')}`;
}

/** "Back tomorrow", "Back in 3 days": the stamp after a rating (the words are returnWords). */
export const backStamp = (words) => `Back ${words}`;

/** "back tomorrow": a rating key's second line. */
export const backLine = (words) => `back ${words}`;

/**
 * The words for a Missed card. FSRS always schedules it; when the run also shows it again (a missed card comes back 3 items on,
 * once per card per session) the words say so: "in this session, then tomorrow". `scheduled` is the returnWords of its schedule.
 */
export const missedWords = (scheduled, inRun) => (inRun ? `in this session, then ${scheduled}` : scheduled);
