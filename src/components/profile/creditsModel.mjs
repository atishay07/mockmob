// Account > Credits: the pure rules behind the two balances, their renew dates and the history list. No React and no
// browser, so data/tests/credits_section.test.mjs can hold every word a student reads.
// The body comes from GET /api/me/credits (data/tests/fixtures/credits/contract_credits_v1.json). Unknown is never 0:
// a balance that could not be read has no figure, and the line says so.
// Copy rules: sentence case, no "!", no em dash, no middle dot, 12-hour times.
import { AI_CREDITS, PRACTICE_CREDITS, POOL_USE } from '../../lib/creditCopy.mjs';

export const CREDITS_URL = '/api/me/credits';
export const CREDITS_COPY = Object.freeze({
  heading: 'Credits',
  history: 'History',
  loading: 'Reading your credits',
  failed: 'Your credits did not load. Nothing was spent.',
  moreFailed: 'The next lines did not load. Nothing was spent.',
  retry: 'Try again',
  more: 'Show more',
  moreLoading: 'Loading',
  empty: 'No credit activity yet. Your first mock or Ask Mobi question shows up here.',
  emptyFilter: 'Nothing here yet for this name.',
  unavailable: 'Not available right now',
});

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const whole = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
const fmt = (n) => n.toLocaleString('en-IN');

/** "1 November" from "2026-11-01" (a calendar date, never shifted by a time zone), or "1 November 2026" with
 *  { year: true } for an end date a student may read months ahead. Null when it is not one. */
export function longDate(ymd, { year = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year ? `${day} ${MONTHS[month - 1]} ${m[1]}` : `${day} ${MONTHS[month - 1]}`;
}

/** "14 Oct, 3:30 PM" in India time, from an ISO instant. Null when it is not one. */
export function whenLabel(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const ist = new Date(t + (5 * 60 + 30) * 60 * 1000);
  const h = ist.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ist.getUTCDate()} ${SHORT[ist.getUTCMonth()]}, ${h12}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * The two balance tiles. Each is { pool, name, figure, state, lines } where figure is a string or null,
 * state is 'known' | 'unlimited' | 'unknown', and lines are the sentences under it.
 */
export function creditTiles(body) {
  const plan = body?.plan || {};
  const pro = plan.name === 'Pro';
  const practiceBalance = whole(body?.practice?.balance);
  const aiBalance = whole(body?.ai?.balance);
  const renews = longDate(body?.ai?.renewsOn);
  const until = longDate(plan.until, { year: true });

  const practice = pro
    ? { state: 'unlimited', figure: 'Unlimited', lines: [until ? `Included with Pro until ${until}.` : 'Included with Pro.'] }
    : practiceBalance === null
      ? { state: 'unknown', figure: null, lines: [CREDITS_COPY.unavailable] }
      : { state: 'known', figure: fmt(practiceBalance), lines: [`${POOL_USE.practice} They do not renew.`] };
  const ai = aiBalance === null
    ? { state: 'unknown', figure: null, lines: [CREDITS_COPY.unavailable, POOL_USE.ai] }
    : { state: 'known', figure: fmt(aiBalance), lines: [POOL_USE.ai, ...(renews ? [`Renews on ${renews}.`] : [])] };
  return [
    { pool: 'practice', name: PRACTICE_CREDITS, ...practice },
    { pool: 'ai', name: AI_CREDITS, ...ai },
  ];
}

/** One history line, ready to print. */
export function historyLine(line, index = 0) {
  const delta = whole(line?.delta) ?? 0;
  const pool = line?.pool === 'ai' ? 'ai' : 'practice';
  const after = whole(line?.balanceAfter);
  const sign = delta > 0 ? '+' : '';
  return {
    key: `${line?.at || 'line'}:${pool}:${index}`,
    what: typeof line?.what === 'string' && line.what.trim() ? line.what : 'Credits',
    when: whenLabel(line?.at),
    change: delta,
    changeText: `${sign}${fmt(delta)}`,
    spokenChange: delta < 0 ? `${fmt(-delta)} used` : delta > 0 ? `${fmt(delta)} added` : 'no change',
    pool,
    poolName: pool === 'ai' ? AI_CREDITS : PRACTICE_CREDITS,
    after: after === null ? null : `${fmt(after)} left`,
  };
}

/** The lines to show for a name filter ('all' | 'practice' | 'ai'). */
export function filterHistory(history, filter) {
  const list = Array.isArray(history) ? history : [];
  return filter === 'practice' || filter === 'ai' ? list.filter((l) => l?.pool === filter) : list;
}

const identity = (l) => `${l.at}|${l.pool}|${l.what}|${l.delta}|${l.balanceAfter}`;

/** Add a fetched page to what is already shown. A line that is already there is never added twice. */
export function appendPage(shown, page) {
  const have = shown || [];
  const seen = new Set(have.map(identity));
  return [...have, ...(Array.isArray(page) ? page : []).filter((l) => !seen.has(identity(l)))];
}

/** The body, or null when it is not the contract (an older server, a wrong reply). */
export function creditsFromResponse(body) {
  if (!body || typeof body !== 'object' || !body.practice || !body.ai || !Array.isArray(body.history)) return null;
  return {
    practice: body.practice,
    ai: body.ai,
    plan: body.plan && typeof body.plan === 'object' ? body.plan : { name: 'Free', until: null },
    history: body.history.filter((l) => l && typeof l === 'object'),
    nextCursor: typeof body.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null,
  };
}

export const FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'practice', label: PRACTICE_CREDITS },
  { id: 'ai', label: AI_CREDITS },
]);
