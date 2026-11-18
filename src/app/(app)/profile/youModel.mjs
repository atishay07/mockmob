// You (19 Nov 2026, lane arena-b): the pure rules behind "who you are, first, as one card" and the places under it. Every figure is
// one the page already reads: the streak from GET /api/me/streak (the same read as Today and the top bar), the colleges count from
// the Compass rules the page already loaded for its Colleges line (compassState). Nothing is estimated here; a figure that is not
// known is not drawn, and zero is said as zero, never as unknown.
import { STREAK_NAME, chipLabel, statusLine } from '../../../lib/streak/streakCopy.mjs';

/**
 * The streak on the card: null when it is not shown (no read yet is 'wait'; a failed read, or the student chose Hide my streak, is
 * null), else { days, lit, word, label }. With no run yet the card says the streak's name and how it starts (never a 0 lead).
 */
export function cardStreak(status, body) {
  if (!body) return status === 'error' ? null : 'wait';
  if (body.hidden) return null;
  const days = Number(body.days) || 0;
  const lit = Boolean(body.today?.done);
  if (days <= 0) {
    const start = statusLine(body)?.text || 'Each day that counts adds one.';
    return { days: 0, lit: false, word: STREAK_NAME, label: `${STREAK_NAME}. ${start} Opens your streak.` };
  }
  return { days, lit, word: days === 1 ? 'day' : 'days', label: chipLabel(days, lit) };
}

/**
 * Whether Your progress (AccountGlance) keeps its own streak cell. The card carries the streak, so normally it is said once; but a
 * student who chose Hide my streak has it hidden on the card, and "Hide my streak" hides it from others and the chip, never from the
 * student (W-063: Today and You still show it). So the cell stays exactly then (review, 19 Nov 2026).
 */
export const glanceKeepsStreak = (body) => Boolean(body?.hidden);

/** "35 of 73 open": the DU courses the student's subjects open, from the Compass rules. Null unless the count is known. */
export function collegesFigure(state) {
  if (state?.status !== 'ready') return null;
  const open = Number(state.open);
  const total = Number(state.total);
  if (!Number.isFinite(open) || !(total > 0)) return null;
  return `${open} of ${total} open`;
}

/**
 * The live figure each place row carries, keyed by the place's id. Only Colleges has one the page reads that the card above does
 * not already say: Wallet's balance is the card's credits line (said once), Progress's streak is the card's Mobi.
 */
export function placeFigures({ compass = null } = {}) {
  const out = {};
  const colleges = collegesFigure(compass);
  if (colleges) out['admission-compass'] = colleges;
  return out;
}
