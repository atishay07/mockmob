// The Sunday Mock's weekly draw (review, 15 Nov 2026: the Full mock selector with no student ranks the subject's newest, best
// evidenced questions first and has no randomness, so without a seed the Sunday paper was the top 50 a brand-new account also
// gets as its free first Full mock, and the same paper again the next week in any subject whose bank had not moved).
//
// The draw: the Full mock selector with a seeded order (data/practice_pick.js seededDrawOf): the subject's servable questions in
// an order fixed by an HMAC of the Sunday and the subject under a server secret (so nobody can work it out ahead), picked as one
// tier under the Full mock's own difficulty targets and concept, family and shape caps. The questions of the subject's previous
// HISTORY_WEEKS Sunday papers are left out; a bank too thin to fill a paper without them lets the oldest weeks back in, never a
// short paper. The same Sunday and subject always draw the same paper from the same bank (and the first start freezes it anyway).
// No 'server-only' and no alias imports: node:test runs it over the real selector and an in-memory bank (data/tests/sunday_draw.test.mjs).
import { createHmac } from 'node:crypto';
import { PAPER_COUNT, addDays, claimPeriod } from '../../sundayMock.mjs';

export const HISTORY_WEEKS = 8;
const RELAX = [HISTORY_WEEKS, 4, 2, 1, 0];

/** The draw's seed for one Sunday and subject: unguessable without the secret, the same on every server. */
export function drawSeed(secret, week, subject) {
  return createHmac('sha256', String(secret || 'sunday-draw')).update(`sunday-draw:v1:${week}:${subject}`).digest('hex');
}

/** The Sundays before `week`, newest first. */
export const previousSundays = (week, n = HISTORY_WEEKS) => Array.from({ length: n }, (_, i) => addDays(week, -7 * (i + 1)));

const history = new Map(); // `${week}:${subject}` -> ids of a past Sunday's paper (a past paper never changes)
/** Tests only: forget the past papers this server has read. */
export const forgetDrawHistory = () => history.clear();

/**
 * The paper's question ids for a Sunday and subject, at most PAPER_COUNT.
 *   getQuestions(subject, count, opts) -> { questions }   Database.getQuestions in Full mock mode (deps.js); opts carries seededDraw
 *   readPaper(period) -> ids | null                        a past Sunday's frozen paper (store.js readPaper)
 *   extraExclude                                           ids that must not be drawn (a frozen paper's own, when replacing one)
 */
export async function drawPaper({ getQuestions, readPaper, secret, subject, week, extraExclude = [], count = PAPER_COUNT }) {
  const weeks = previousSundays(week);
  const past = await Promise.all(weeks.map(async (w) => {
    const key = claimPeriod(w, subject);
    if (history.has(key)) return history.get(key);
    const ids = await Promise.resolve(readPaper ? readPaper(key) : null).catch(() => null);
    if (Array.isArray(ids)) { history.set(key, ids); while (history.size > 400) history.delete(history.keys().next().value); }
    return Array.isArray(ids) ? ids : [];
  }));
  const seed = drawSeed(secret, week, subject);
  const extra = (Array.isArray(extraExclude) ? extraExclude : []).map(String);
  let best = [];
  for (const n of RELAX) {
    const excludeIds = [...new Set([...extra, ...past.slice(0, n).flat().map(String)])];
    const { questions } = await getQuestions(subject, count, { seededDraw: { seed, excludeIds } });
    const ids = (questions || []).map((q) => String(q.id)).filter((id) => !extra.includes(id));
    if (ids.length >= count) return ids.slice(0, count);
    if (ids.length > best.length) best = ids;
  }
  return best;
}
