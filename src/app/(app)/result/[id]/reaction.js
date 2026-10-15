// Result page helpers shared with the app's rules (pure, no I/O).
//
// `act` is the shared MobiReact act (src/components/brand/MobiReact.jsx), which also honours the
// student's Reduce motion and Celebrations settings.
// Mobi's reaction follows the server's recap tone (src/lib/server/recap.js), the same table as the
// app (flutter_app lib/features/result/model/recap_variant.dart): proud on a first mock, a cheer when
// higher, encouragement when lower or held, a rest otherwise, sleepy late at night, and no Mobi in NTA mode.
// The repair key counts the same candidates the app does (lib/core/domain/repair_candidates.dart).
import { answerAct, recapReaction } from '../../../../lib/mobiMoments.js';
import { reactNow } from '../../../../lib/mobiRation.js';
import { inRepairOrder } from '../../../../components/result/labLoop.js';

const ALT = {
  proud: 'Mobi, proud of your first mock in this subject.',
  cheer: 'Mobi cheering a higher result than last time.',
  encourage: 'Mobi encouraging you after a lower result.',
  held: 'Mobi waiting with you while some answer keys are checked.',
  sleepy: 'Mobi, sleepy. It is late.',
  rest: 'Mobi beside your recorded result.',
};

/**
 * The hero Mobi's reaction: the app's recapReaction table (lib/mobiMoments.js). NTA none; late at
 * night sleepy with "Goodnight."; first mock proud; higher cheer; lower and held encourage; the
 * standard result rests. Under Quiet or Off the big acts become a held rest. `hour` is the local
 * hour, 0 to 23.
 */
export function mobiReaction(attempt, { celebrations = 'full', hour = 12 } = {}) {
  const tone = attempt?.recap?.tone;
  const found = recapReaction({ tone, celebrations, isNta: attempt?.selectionMeta?.mode === 'nta', hour });
  if (!found) return null;
  const alt = found.act === 'encourage' && tone === 'held' ? ALT.held : ALT[found.act] || ALT.rest;
  return { act: found.act, alt, line: found.line || '' };
}

/**
 * What the reader Mobi does when the student opens an answer (the app's AnswerReactor): a wrong or
 * blank one gets encouragement and then a point (come and look); a right one gets the small correct
 * hop and goes back to reading. Full only, never under Reduce motion, and one act per 2.5 s, so
 * opening five rows reads as browsing. Held answers get nothing. Returns null when nothing plays.
 */
export function answerReaction(verdict, { celebrations = 'full', reduced = false } = {}) {
  if (celebrations !== 'full' || reduced) return null;
  const found = answerAct(verdict);
  if (!found || !reactNow('result:answer')) return null;
  return found;
}

const HELD_STATES = new Set(['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected']);

// Wrong answers that repair can open: not yet handled, and not held for a key check. In paper order, or in the
// server's repair order when it sends one (lab.repairOrder, spec 4.7: most other students got it right first, then
// common traps, then paper order).
export function repairCandidates(analysis, handled, answerReviews = {}, repairOrder = null) {
  const open = (analysis?.mistakes || []).filter((row) => !handled?.has(row.q.id) && !HELD_STATES.has(answerReviews?.[row.q.id]?.state));
  return inRepairOrder(open, repairOrder);
}

// Three minutes a mistake, rounded up to the nearest five (the app's figure).
export function repairMinutes(count) {
  return count > 0 ? Math.ceil((count * 3) / 5) * 5 : null;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Says exactly what the key opens: one chapter by name, otherwise the count and the time.
export function repairKeyLabel(candidates) {
  const count = candidates?.length || 0;
  if (!count) return null;
  const chapters = new Set(candidates.map((row) => row.chapter));
  if (chapters.size === 1) return `Repair ${candidates[0].chapter}, ${plural(count, 'mistake')}`;
  return `Repair ${plural(count, 'mistake')}, about ${repairMinutes(count)} minutes`;
}

export function verdictWord(verdict) {
  return verdict === 'correct' ? 'right' : verdict === 'wrong' ? 'wrong' : 'blank';
}
