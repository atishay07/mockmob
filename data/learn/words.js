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

/** "Revise · 5 questions" (Today's paper questions to revise; never "Revise 0 of 5 questions"). */
export function reviseQuestions(n) {
  return `Revise · ${plural(count(n), 'question')}`;
}

/** "4 to revise" (the Revise-later pile's visible label on desktop; the pile shows only from 1). */
export function pileLabel(n) {
  return `${count(n)} to revise`;
}
