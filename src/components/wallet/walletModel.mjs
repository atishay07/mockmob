// The Wallet page's pure rules: every word and every number a student reads, with no React and no browser, so
// data/tests/wallet_1018.test.mjs can hold them. The body is GET /api/wallet (src/lib/server/wallet.js).
// Copy rules (owner UI standards): plain sentence case, no "!", no em dash, no middle dot, 12-hour times, counts with units,
// an unknown balance is never written as 0.

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
  // True whether or not selling is open (release 10 verifier L5): held credits, bought or given, never expire.
  lede: 'One balance pays for every practice question and every Ask Mobi reply. Credits you hold stay until you use them.',
  loading: 'Reading your wallet',
  failed: 'Your wallet did not load. Nothing was spent.',
  retry: 'Try again',
  unknown: 'Unknown',
  unknownLine: 'This balance could not be read just now. Nothing was spent.',
  openSoon: 'Top-ups open soon',
  openSoonNote: 'Top-ups open soon. Your free credits keep working until then.',
  historyHeading: 'Recent activity',
  historyEmpty: 'No credit activity yet. Your first question or Ask Mobi reply shows up here.',
  historyFailed: 'Your activity did not load. Your balances above are current.',
  heading: 'Credits',
  packsHeading: 'Top up and keep going',
  packsHeadingClosed: 'Credit packs',
  proLink: 'See Pro',
  // Out of credits (release 10 verifier M5): a top-up is offered only while selling is open (commerce.open), and a Pro student,
  // whose practice needs no credits, is never told to top up to practise.
  zeroLine: ({ open = false, pro = false, renews = null } = {}) => {
    const back = renews ? `Your free credits come back on ${renews}.` : 'Your free credits come back next month.';
    if (pro) return `You are out of credits for Ask Mobi replies; practice needs no credits with Pro. ${back}${open ? ' You can also top up for more replies.' : ''}`;
    return open ? `You are out of credits. Top up to keep practising, or wait: ${back}` : `You are out of credits. ${back}`;
  },
  proLine: (offer) => `Get unlimited mocks: with Pro, practice never uses a credit${offer?.rupees ? `. ₹${offer.rupees}${offer.expires ? ` through ${offer.expires}` : ''}` : ''}.`,
  proNow: (until) => {
    const d = longDate(until, { year: true });
    return d ? `Practice is included with your Pro plan until ${d}, so your credits go to Ask Mobi replies.` : 'Practice is included with your Pro plan, so your credits go to Ask Mobi replies.';
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
  if (!body || typeof body !== 'object' || body.ok !== true || !body.credits || typeof body.credits !== 'object' || !Array.isArray(body.packs) || !body.commerce) return null;
  return {
    credits: body.credits,
    plan: body.plan && typeof body.plan === 'object' ? body.plan : { name: 'Free', until: null },
    proOffer: body.proOffer && typeof body.proOffer === 'object' ? body.proOffer : null,
    packs: body.packs.filter((p) => p && typeof p.packId === 'string'),
    commerce: { open: body.commerce.open === true, message: body.commerce.message || null },
    history: Array.isArray(body.history) ? body.history.filter((l) => l && typeof l === 'object') : null,
  };
}

/**
 * The one balance: { figure, state, lines } where figure is a string or null (unknown), state is 'known' | 'zero' | 'unknown',
 * and lines are the sentences under it: what a credit buys, the free allowance with its reset date, the credits held.
 */
export function balanceTile(data) {
  const c = data?.credits || {};
  const total = whole(c.total);
  const buys = typeof c.buys === 'string' && c.buys ? c.buys : null;
  if (total === null) return { state: 'unknown', figure: null, lines: [WALLET_COPY.unknownLine, ...(buys ? [buys] : [])] };
  const left = whole(c.freeLeft);
  const allowance = whole(c.freeAllowance);
  const held = whole(c.held);
  const reset = resetLabel(c.resetAt);
  const lines = [
    ...(buys ? [buys] : []),
    ...(left !== null && allowance !== null ? [`Free credits this month: ${fmt(left)} of ${fmt(allowance)} left${reset ? `, reset on ${reset}` : ''}.`] : []),
    ...(held !== null ? [`Credits you hold: ${fmt(held)}. They do not expire.`] : []),
    ...(data?.plan?.name === 'Pro' ? [WALLET_COPY.proNow(data.plan.until)] : []),
  ];
  if (total === 0) lines.unshift(WALLET_COPY.zeroLine({ open: data?.commerce?.open === true, pro: data?.plan?.name === 'Pro', renews: longDate(c.renewsOn) }));
  return { state: total === 0 ? 'zero' : 'known', figure: fmt(total), lines };
}

/** The packs as rows: the price, the size, what it buys (full mocks or questions), the value per credit and the key's state. */
export function packRows(data, phases = {}) {
  const open = Boolean(data?.commerce?.open);
  return (data?.packs || []).map((p) => {
    const phase = phases[p.packId] || { status: 'idle', message: '' };
    return {
      packId: p.packId,
      title: `${fmt(p.credits)} credits`,
      price: `₹${fmt(p.priceInr)}`,
      value: whole(p.fullMocks) !== null && whole(p.credits) !== null
        ? `${p.fullMocks === 1 ? '1 full mock' : `${fmt(p.fullMocks)} full mocks`}, or ${questions(p.credits)}`
        : `₹${p.perCreditInr} a credit`,
      perCredit: `₹${p.perCreditInr} a credit`,
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
  const after = whole(line?.balanceAfter);
  const when = whenParts(line?.at);
  return {
    key: `${line?.at || 'line'}:${index}`,
    what: typeof line?.what === 'string' && line.what.trim() ? line.what : 'Credits',
    date: when?.date || null,
    time: when?.time || null,
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
