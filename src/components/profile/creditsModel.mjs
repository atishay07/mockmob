// Account > Credits: the pure rules behind the ONE credits balance (owner, 18 Oct 2026, D78), when the free credits come
// back, and the history list. No React and no browser, so data/tests/credits_section.test.mjs can hold every word a
// student reads.
// The body comes from GET /api/me/credits (data/tests/fixtures/credits/contract_credits_v1.json). Unknown is never 0:
// a balance that could not be read has no figure, and the line says so.
// Copy rules: sentence case, no "!", no em dash, no middle dot, 12-hour times.
import { CREDITS, ONE_CREDIT_LINE } from '../../lib/creditCopy.mjs';

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
 * The one balance, as a list of one tile { pool: 'total', name, figure, state, lines } so the section renders it like
 * before. figure is a string or null; state is 'known' | 'unknown'. The figure is body.total.balance, or, from an older
 * server without `total`, the two stored parts added (both must be known: an unknown part is an unknown total).
 */
export function oneBalance(body) {
  const t = body?.total && typeof body.total === 'object' ? body.total : null;
  if (t) {
    return { balance: whole(t.balance), freeLeft: whole(t.freeLeft), freeAllowance: whole(t.freeAllowance), renewsOn: t.renewsOn || null };
  }
  const p = whole(body?.practice?.balance);
  const a = whole(body?.ai?.balance);
  return { balance: p === null || a === null ? null : p + a, freeLeft: null, freeAllowance: null, renewsOn: body?.ai?.renewsOn || null };
}

export function creditTiles(body) {
  const plan = body?.plan || {};
  const pro = plan.name === 'Pro';
  const until = longDate(plan.until, { year: true });
  const one = oneBalance(body);
  const renews = longDate(one.renewsOn);
  const proLine = pro ? [until ? `Practice needs no credits with Pro, until ${until}.` : 'Practice needs no credits with Pro.'] : [];
  if (one.balance === null) {
    return [{ pool: 'total', name: CREDITS, state: 'unknown', figure: null, lines: [CREDITS_COPY.unavailable, ONE_CREDIT_LINE, ...proLine] }];
  }
  const free = one.freeLeft !== null && one.freeAllowance
    // The free part goes BACK TO the allowance on the reset date; it is not added on top (release 10 verifier H2).
    ? [`${fmt(one.freeLeft)} of your ${fmt(one.freeAllowance)} free credits left this month. They are used first.`,
      ...(renews ? [`Your free credits go back to ${fmt(one.freeAllowance)} on ${renews}.`] : [])]
    : renews ? [`Free credits come back on ${renews}.`] : [];
  return [{ pool: 'total', name: CREDITS, state: 'known', figure: fmt(one.balance), lines: [ONE_CREDIT_LINE, ...free, ...proLine] }];
}

const KIND_NAMES = Object.freeze({ practice: 'Practice', ai: 'Ask Mobi and repairs' });

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
    poolName: KIND_NAMES[pool],
    after: after === null ? null : `${fmt(after)} left`,
  };
}

/** The lines to show for a kind filter ('all' | 'practice' | 'ai'). One balance; the filter is what it paid for. */
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
    ...(body.total && typeof body.total === 'object' ? { total: body.total } : {}),
    plan: body.plan && typeof body.plan === 'object' ? body.plan : { name: 'Free', until: null },
    history: body.history.filter((l) => l && typeof l === 'object'),
    nextCursor: typeof body.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null,
  };
}

export const FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'practice', label: KIND_NAMES.practice },
  { id: 'ai', label: KIND_NAMES.ai },
]);
