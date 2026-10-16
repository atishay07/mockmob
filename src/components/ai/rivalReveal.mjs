// The Rival result reveal, as data: the order its parts land in, and the one act Mobi plays when the
// score has landed. Pure, so it is tested without a browser (data/tests/rival_reveal.test.mjs).
//
// The numbers come first. The reveal is four parts in a fixed order: the score, then the comparison
// (accuracy and time against the benchmark), then Mobi's reaction, then the next move. Each part
// enters once in 280 ms (ease-out); the gaps between them are short so the whole screen is in place
// in about a second. A tap or a key during the reveal lands everything at once. Under Reduce motion
// every part is drawn in place at once and Mobi is a still frame.
import { underLevel } from '../../lib/mobiMoments.js';

export const REVEAL_PARTS = ['score', 'comparison', 'mobi', 'next'];

// When each part starts, in ms after the result arrives. The comparison waits for the score to settle
// (280 ms), Mobi waits for the comparison, the next move follows Mobi's first beat.
export const REVEAL_AT = { score: 0, comparison: 320, mobi: 760, next: 1060 };
export const REVEAL_PART_MS = 280;

/** How many parts are showing `ms` after the result arrived (0 to 4). Reduced motion shows all. */
export function revealStage(ms, { reduced = false } = {}) {
  if (reduced) return REVEAL_PARTS.length;
  return REVEAL_PARTS.filter((part) => ms >= REVEAL_AT[part]).length;
}

// One act per outcome. A win cheers (a celebration, so the Celebrations setting can make it a nod or
// nothing); a loss gets the encouraging beat the result page uses after a lower mock; a draw gets a
// head tilt (a dead heat is a question, not a verdict). He never plays twice: once the act ends he
// stands still beside the next move.
const ACTS = {
  win: { act: 'cheer', mood: 'happy', label: 'Mobi cheering your win over the benchmark.' },
  loss: { act: 'encourage', mood: 'calm', label: 'Mobi encouraging you after the benchmark won this one.' },
  tie: { act: 'tilt', mood: 'curious', label: 'Mobi tilting his head at a dead heat.' },
};

/**
 * Mobi's reaction to a scored benchmark. `outcome` is the server's result ('win', 'loss' or 'tie').
 * Under Quiet a win is a nod; under Off he stands still with nothing played (`act` 'idle'). An
 * unknown outcome gets no Mobi at all (null), so a malformed result never shows a reaction.
 */
export function rivalMobi(outcome, { celebrations = 'full' } = {}) {
  const found = ACTS[outcome];
  if (!found) return null;
  const act = underLevel(found.act, celebrations) || 'idle';
  return { ...found, act };
}

/**
 * The denominator under your accuracy, from the server's counts: accuracy is right answers over
 * answered questions, so the note says both, and how many were skipped when any were. Null when the
 * counts are missing (the number then stands alone rather than inventing a denominator).
 */
export function accuracyNote(user = {}) {
  const { correct, answered, total } = user || {};
  if (!Number.isInteger(correct) || !Number.isInteger(answered) || answered < 0 || correct > answered) return null;
  const skipped = Number.isInteger(total) && total > answered ? total - answered : 0;
  if (answered === 0) return skipped ? `None answered, ${skipped} skipped` : null;
  const right = `${correct} of ${answered} answered right`;
  return skipped ? `${right}, ${skipped} skipped` : right;
}
