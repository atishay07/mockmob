// The free "Try it again" step before the key, on the result page (owner item W-032, "Repair lets the student retry before
// seeing the key"; REVIEW-RESULT-1018 section 7: a blank is "Try it again, free"). PURE: no I/O and no React, so the page, Review
// and the app's port read the same rules and the same words.
//
// A mistake opened on the result stays sealed until the student tries it again or asks for the answer: its key, the book
// explanation and the repair are not on screen. Trying again is free and is not recorded, marked or charged, and nothing in this
// file (or in the components that use it) reaches the server. Seeing the answer is free too (L13: "We can't ask them to pay
// extra to just see the right answer"). The paid Repair comes after, exactly as before, with its cost line.
import { ACTION_LABELS } from './repair_presentation.mjs';

const LETTERS = 'ABCDEFGH';
const letter = (i) => (Number.isInteger(i) && i >= 0 && i < LETTERS.length ? LETTERS[i] : '');

// The words of the free steps, shared by Review's answer sheet and the result's mistakes. The label of the step is
// actionLabel's own ("Try it again"), so it can never drift from the chip on the row.
export const RETRY_COPY = Object.freeze({
  try: ACTION_LABELS.again,
  show: 'Show the answer',
  hidden: 'The answer stays hidden until you ask.',
  hiddenRest: 'Try it again first, or see the correct answer and the book explanation. Both are free.',
  pick: 'Pick one. Nothing is recorded and nothing is charged.',
  yourPick: 'Your pick',
  // Once a try has been made, the paper's own pick is the first one; the line above the options says what the try was.
  firstPick: 'Your first pick',
  right: 'Got it this time.',
  notRecorded: 'This try is not recorded.',
  bookExplanation: 'Book explanation',
  // Said under the keys of a wrong answer: where the paid step went, and what it costs, before anything is tried.
  repairComes: (number) => `Repair${Number.isInteger(number) ? ` Q${number}` : ''} comes after, for 1 credit.`,
  // A question with no book explanation says so; only a wrong answer has a repair to point at.
  noExplanation: (repairable) => `This question has no book explanation yet.${repairable ? ' A repair writes why your pick looked right and why the key is right.' : ''}`,
});

/**
 * Does the retry come first for this mistake? A wrong answer or a blank with no saved repair and no repair attempt yet, whose
 * key is not under re-check or corrected, and whose key and options a try can be marked against. Everything else opens as
 * it always did: a saved repair opens free (F17), a held key says so, a repair already written has already shown the key.
 *
 * verdict      'correct' | 'wrong' | 'skipped' (analyseSession's words)
 * saved        the server holds a repair for this mistake (lab.repaired, savedRepairs)
 * outcome      this visit's repair outcome for it (explained, stored, held_for_recheck, not_explained, corrected_key), or null
 * hasReview    an answer-key review exists for it (re-check or correction)
 * keyIndex     the key as an option index, or null when unknown
 * optionCount  how many options the question has
 */
export function retryEligible({ verdict, saved = false, outcome = null, hasReview = false, keyIndex = null, optionCount = 0 } = {}) {
  if (verdict !== 'wrong' && verdict !== 'skipped') return false;
  if (saved || outcome || hasReview) return false;
  return Number.isInteger(keyIndex) && optionCount >= 2 && keyIndex >= 0 && keyIndex < optionCount;
}

/** A try marked against the key it was given: one pick, right or not. Never sent anywhere. */
export function retryGrade(pick, keyIndex) {
  return { pick: Number.isInteger(pick) ? pick : null, right: Number.isInteger(pick) && Number.isInteger(keyIndex) && pick === keyIndex };
}

/**
 * What the page says once a try is made: a lead and the rest of the line. A right try says "Got it this time."; a wrong one
 * names the pick and the answer. Both say the try is not recorded, so the paper's marks are never in question.
 */
export function retrySaid({ pick, keyIndex, right }) {
  if (right) return { lead: RETRY_COPY.right, rest: RETRY_COPY.notRecorded, right: true };
  const said = [letter(keyIndex) ? `The answer is ${letter(keyIndex)}.` : null, RETRY_COPY.notRecorded].filter(Boolean).join(' ');
  return { lead: letter(pick) ? `Not ${letter(pick)}.` : 'Not this one.', rest: said, right: false };
}
