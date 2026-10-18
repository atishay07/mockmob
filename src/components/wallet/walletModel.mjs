// The Wallet page's pure rules: every word and every number a student reads, with no React and no browser, so
// data/tests/wallet_1018.test.mjs can hold them. The body is GET /api/wallet (src/lib/server/wallet.js).
// Copy rules (owner UI standards): plain sentence case, no "!", no em dash, no middle dot, 12-hour times, counts with units,
// an unknown balance is never written as 0.
import { PRACTICE_CREDITS, AI_CREDITS, POOL_USE } from '../../lib/creditCopy.mjs';

export const WALLET_URL = '/api/wallet';
export const WALLET_PATH = '/wallet';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST = (5 * 60 + 30) * 60 * 1000;

const whole = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
const fmt = (n) => n.toLocaleString('en-IN');
const questions = (n) => `${fmt(n)} ${n === 1 ? 'question' : 'questions'}`;

/** "1 November" or, with { year: true }, "1 November 2026", from "2026-11-01". Null when it is not a calendar date. */
export function longDate(ymd, { year = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year ? `${day} ${MONTHS[month - 1]} ${m[1]}` : `${day} ${MONTHS[month - 1]}`;
}

export const WALLET_COPY = Object.freeze({
  title: 'Wallet',
  lede: 'Your practice credits and AI credits, what each is for, and how to add more.',
  loading: 'Reading your wallet',
  failed: 'Your wallet did not load. Nothing was spent.',
  retry: 'Try again',
  unknown: 'Unknown',
  unknownLine: 'This balance could not be read just now. Nothing was spent.',
  openSoon: 'Top-ups open soon',
  openSoonNote: 'Top-ups are not open yet. The prices are shown so you can plan.',
  historyHeading: 'Recent activity',
  historyEmpty: 'No credit activity yet. Your first mock or Ask Mobi question shows up here.',
  historyFailed: 'Your activity did not load. Your balances above are current.',
  proLink: 'See Pro',
  proLine: (offer) => `Practice is included with Pro${offer?.rupees ? `, ₹${offer.rupees}${offer.expires ? ` through ${offer.expires}` : ''}` : ''}.`,
  proNow: (until) => {
    const d = longDate(until, { year: true });
    return d ? `Practice is included with your Pro plan until ${d}.` : 'Practice is included with your Pro plan.';
  },
});

/** { date: "14 Oct", time: "3:30 PM" } in India time from an ISO instant. Null when it is not one. */
export function whenParts(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const ist = new Date(t + IST);
  const h = ist.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { date: `${ist.getUTCDate()} ${SHORT[ist.getUTCMonth()]}`, time: `${h12}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` };
}

/** "1 November, 12:00 AM": the AI credits reset instant, in India time on a 12-hour clock. Null when unknown. */
export function resetLabel(resetAt) {
  const t = Date.parse(resetAt);
  if (!Number.isFinite(t)) return null;
  const ist = new Date(t + IST);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}, ${whenParts(resetAt).time}`;
}

/** The body, or null when it is not the wallet contract (an older server, a wrong reply). */
export function walletFromResponse(body) {
  if (!body || typeof body !== 'object' || body.ok !== true || !body.practice || !body.ai || !Array.isArray(body.packs) || !body.commerce) return null;
  return {
    practice: body.practice,
    ai: body.ai,
    plan: body.plan && typeof body.plan === 'object' ? body.plan : { name: 'Free', until: null },
    proOffer: body.proOffer && typeof body.proOffer === 'object' ? body.proOffer : null,
    packs: body.packs.filter((p) => p && typeof p.packId === 'string' && (p.pool === 'practice' || p.pool === 'ai')),
    commerce: { open: body.commerce.open === true, message: body.commerce.message || null },
    history: Array.isArray(body.history) ? body.history.filter((l) => l && typeof l === 'object') : null,
  };
}

/**
 * The two balances. Each is { pool, name, unit, figure, state, lines } where figure is a string or null (unknown),
 * state is 'known' | 'zero' | 'unlimited' | 'unknown', and lines are the sentences under it.
 */
export function balanceTiles(data) {
  const pro = data?.plan?.name === 'Pro';
  const p = data?.practice || {};
  const a = data?.ai || {};
  const pb = whole(p.balance);
  const ab = whole(a.balance);

  let practice;
  if (pro) {
    practice = { state: 'unlimited', figure: 'Unlimited', lines: [WALLET_COPY.proNow(data.plan.until), POOL_USE.practice] };
  } else if (pb === null) {
    practice = { state: 'unknown', figure: null, lines: [WALLET_COPY.unknownLine, POOL_USE.practice] };
  } else {
    const q = whole(p.approxQuestions);
    practice = {
      state: pb === 0 ? 'zero' : 'known',
      figure: fmt(pb),
      lines: [
        pb === 0 ? 'You have no practice credits left.' : `About ${questions(q === null ? pb : q)}.`,
        `${POOL_USE.practice} They do not renew.`,
      ],
    };
  }

  const reset = resetLabel(a.resetAt);
  let ai;
  if (ab === null) {
    ai = { state: 'unknown', figure: null, lines: [WALLET_COPY.unknownLine, POOL_USE.ai] };
  } else {
    const inc = whole(a.includedRemaining);
    const mon = whole(a.includedMonthly);
    const bought = whole(a.boughtBalance);
    const split = inc !== null && mon !== null && bought !== null
      ? `${fmt(inc)} of ${fmt(mon)} included this month left, plus ${fmt(bought)} bought.` : null;
    ai = {
      state: ab === 0 ? 'zero' : 'known',
      figure: fmt(ab),
      lines: [
        ...(split ? [split] : []),
        ...(reset ? [`Included credits reset on ${reset}.`] : []),
        `${POOL_USE.ai} Bought credits never expire.`,
      ],
    };
  }
  return [
    { pool: 'practice', name: PRACTICE_CREDITS, unit: 'practice credits', ...practice },
    { pool: 'ai', name: AI_CREDITS, unit: 'AI credits', ...ai },
  ];
}

/** The packs of one pool as rows: the price, the size, the value per credit and the key's state. */
export function packRows(data, pool, phases = {}) {
  const open = Boolean(data?.commerce?.open);
  return (data?.packs || []).filter((p) => p.pool === pool).map((p) => {
    const phase = phases[p.packId] || { status: 'idle', message: '' };
    return {
      packId: p.packId,
      pool,
      title: `${fmt(p.credits)} ${pool === 'practice' ? 'practice credits' : 'AI credits'}`,
      price: `₹${fmt(p.priceInr)}`,
      value: `₹${p.perCreditInr} a credit${pool === 'practice' ? `, about ${questions(p.credits)}` : ''}`,
      featured: Boolean(p.featured),
      featuredLabel: 'Best value',
      disabled: !open || phase.status === 'working',
      key: !open ? WALLET_COPY.openSoon : phase.status === 'working' ? 'Opening checkout' : `Add for ₹${fmt(p.priceInr)}`,
      status: phase.status,
      message: phase.message || '',
    };
  });
}

/** One history line, ready to print. */
export function historyRow(line, index = 0) {
  const delta = whole(line?.delta) ?? 0;
  const pool = line?.pool === 'ai' ? 'ai' : 'practice';
  const after = whole(line?.balanceAfter);
  const when = whenParts(line?.at);
  return {
    key: `${line?.at || 'line'}:${pool}:${index}`,
    what: typeof line?.what === 'string' && line.what.trim() ? line.what : 'Credits',
    date: when?.date || null,
    time: when?.time || null,
    pool,
    poolName: pool === 'ai' ? AI_CREDITS : PRACTICE_CREDITS,
    change: delta,
    changeText: `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${fmt(Math.abs(delta))}`,
    spokenChange: delta < 0 ? `${fmt(-delta)} used` : delta > 0 ? `${fmt(delta)} added` : 'no change',
    after: after === null ? null : `Balance ${fmt(after)}`,
  };
}

/** The Pro row: Free students only. Null for Pro or when there is nothing to show. */
export function proRow(data) {
  if (!data || data.plan?.name === 'Pro') return null;
  return { text: WALLET_COPY.proLine(data.proOffer), link: WALLET_COPY.proLink, href: '/pricing' };
}

/** Merge order for history: newest first, the order GET /api/wallet already sends. Kept here for the test of the contract. */
export function newestFirst(lines) {
  return [...(lines || [])].sort((a, b) => Date.parse(b?.at) - Date.parse(a?.at));
}
