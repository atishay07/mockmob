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
  // Mobi's answers from a student's own marks are free; a written answer costs 1 credit (src/components/ai/askDoors.mjs).
  lede: 'One balance pays for practice and for Mobi’s written answers. Credits you hold stay until you use them.',
  loading: 'Reading your wallet',
  failed: 'Your wallet did not load. Nothing was spent.',
  retry: 'Try again',
  unknown: 'Unknown',
  unknownLine: 'This balance could not be read just now. Nothing was spent.',
  openSoon: 'Top-ups open soon',
  openSoonNote: 'Top-ups open soon. Your free credits keep working until then.',
  historyHeading: 'Recent activity',
  historyEmpty: 'No credit activity yet. Your first question or written answer from Mobi shows up here.',
  historyFailed: 'Your activity did not load. Your balances above are current.',
  heading: 'Credits',
  packsHeading: 'Top up and keep going',
  packsHeadingClosed: 'Credit packs',
  // Most top-ups are bought by Pro students, for more from Mobi (owner, 20 Oct 2026).
  packsHeadingPro: 'More from Mobi',
  proLink: 'See Pro',
  // Out of credits (release 10 verifier M5): a top-up is offered only while selling is open (commerce.open), and a Pro student,
  // whose practice needs no credits, is never told to top up to practise.
  zeroLine: ({ open = false, pro = false, renews = null } = {}) => {
    const back = renews ? `Your free credits come back on ${renews}.` : 'Your free credits come back next month.';
    if (pro) return `You are out of credits for written answers from Mobi; practice needs no credits with Pro. ${back}${open ? ' You can also top up for more answers.' : ''}`;
    return open ? `You are out of credits. Top up to keep practising, or wait: ${back}` : `You are out of credits. ${back}`;
  },
  proLine: (offer) => `Get unlimited mocks: with Pro, practice never uses a credit${offer?.rupees ? `. ₹${offer.rupees}${offer.expires ? ` through ${offer.expires}` : ''}` : ''}.`,
  proNow: (until) => {
    const d = longDate(until, { year: true });
    return d ? `Practice is included with your Pro plan until ${d}, so your credits go to Mobi’s written answers and mistake repairs.` : 'Practice is included with your Pro plan, so your credits go to Mobi’s written answers and mistake repairs.';
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

/** The packs as rows: the price, the size, what it comes to (Mobi first, packWorth), the value per credit and the key's state. */
export function packRows(data, phases = {}) {
  const open = Boolean(data?.commerce?.open);
  return (data?.packs || []).map((p) => {
    const phase = phases[p.packId] || { status: 'idle', message: '' };
    return {
      packId: p.packId,
      title: `${fmt(p.credits)} credits`,
      price: `₹${fmt(p.priceInr)}`,
      value: packWorth(p.credits) || `₹${p.perCreditInr} a credit`,
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

// ---- version 13 (owner I9, 20 Oct 2026): the balance split honestly, what each thing costs, the packs' real value maths and a
// clear bridge to Pro. The words match the app's Wallet (flutter_app/lib/features/wallet/wallet_copy.dart, billing_copy.dart).

export const WALLET_V13_COPY = Object.freeze({
  toSpend: 'credits to spend',
  freePart: 'Free this month',
  keptPart: 'Kept credits',
  keptNote: 'Your welcome credits and any top-ups. They do not expire.',
  freeFirst: 'Free credits are used first.',
  practiceUnlimited: 'Practice is unlimited on Pro.',
  buysTitle: 'What credits buy',
  costShows: 'The cost always shows before you start.',
  included: 'Included',
  bestValue: 'Best value',
  proTitle: 'Pro makes practice unlimited',
  proBody: 'Practise as much as you like without spending credits, with Smart practice and the exam-day screen.',
  proKey: 'See Pro',
});

const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

/** "Refills on 1 November at 12:00 AM", in India time. Null when the reset instant is unknown. */
export function refillLine(resetAt) {
  const t = Date.parse(resetAt);
  if (!Number.isFinite(t)) return null;
  const ist = new Date(t + IST);
  return `Refills on ${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} at ${whenParts(resetAt).time}`;
}

/**
 * The balance as the hero, split honestly into this month's free credits and the credits a student keeps.
 * { state, total, figure, free: { left, of, text, note } | null, kept: { held, text } | null, shares: { free, kept } | null }
 * Shares are the two parts of the bar, as fractions of the total; null when either part is unknown or the total is 0.
 */
export function balanceSplit(data) {
  const c = data?.credits || {};
  const total = whole(c.total);
  if (total === null) return { state: 'unknown', total: null, figure: null, free: null, kept: null, shares: null };
  const left = whole(c.freeLeft);
  const of = whole(c.freeAllowance);
  const held = whole(c.held);
  const refill = refillLine(c.resetAt);
  const free = left !== null && of !== null
    ? { left, of, text: fmt(left), note: `${fmt(left)} of ${fmt(of)} free credits left this month.${refill ? ` ${refill}.` : ''}` }
    : null;
  const kept = held !== null ? { held, text: fmt(held), note: WALLET_V13_COPY.keptNote } : null;
  const shares = free && kept && free.left + kept.held > 0
    ? { free: free.left / (free.left + kept.held), kept: kept.held / (free.left + kept.held) }
    : null;
  return { state: total === 0 ? 'zero' : 'known', total, figure: fmt(total), free, kept, shares };
}

/**
 * What each thing costs, in credits, from the one price list (src/lib/creditCopy.mjs). On Pro, practice reads "Included".
 * prices: { question, fullMock, analysis, reply, firstMockFree }.
 */
export function priceRows(data, prices) {
  const pro = data?.plan?.name === 'Pro';
  const credits = (n) => plural(n, 'credit', 'credits');
  // Mobi first: most top-ups pay for Mobi's written answers and mistake repairs (owner, 20 Oct 2026).
  return [
    { key: 'reply', what: 'A written answer from Mobi', cost: credits(prices.reply), note: 'Answers from your marks are free', included: false },
    { key: 'repair', what: 'A mistake repair', cost: credits(prices.repair), note: null, included: false },
    { key: 'analysis', what: 'Deeper analysis', cost: credits(prices.analysis), note: null, included: false },
    { key: 'question', what: 'A practice question', cost: pro ? WALLET_V13_COPY.included : credits(prices.question), note: null, included: pro },
    { key: 'mock', what: 'A full mock', cost: pro ? WALLET_V13_COPY.included : credits(prices.fullMock), note: !pro && prices.firstMockFree ? 'First one in each subject is free' : null, included: pro },
  ];
}

/**
 * What a pack comes to, Mobi first, on every plan (owner, 20 Oct 2026: "1 full mock or 50 questions" lines undersold it; most
 * top-ups are bought by Pro students for Mobi's written answers and repairs). A written answer and a mistake repair are 1 credit
 * each, so a pack of N credits is N of them. No mock or question counts: on Free, the price list above says what practice costs.
 */
export function packWorth(credits) {
  const n = whole(credits);
  if (n === null || n <= 0) return null;
  return n === 1 ? '1 written answer from Mobi or mistake repair' : `${fmt(n)} written answers from Mobi or mistake repairs`;
}

/**
 * The packs' heading and the line under it. While top-ups are closed the heading never invites one (release 10 verifier M5).
 * A Pro student, whose practice needs no credits, reads the packs as more from Mobi past this month's free credits.
 */
export function packsIntro(data) {
  const open = data?.commerce?.open === true;
  const pro = data?.plan?.name === 'Pro';
  const allowance = whole(data?.credits?.freeAllowance);
  const heading = !open ? WALLET_COPY.packsHeadingClosed : pro ? WALLET_COPY.packsHeadingPro : WALLET_COPY.packsHeading;
  const lead = pro
    ? `${allowance ? `Your ${fmt(allowance)} free credits` : 'Your free credits'} come back every month. A top-up adds more written answers and mistake repairs, and its credits never expire.`
    : 'Top-up credits pay for practice, written answers from Mobi and mistake repairs. They never expire.';
  return { heading, lead };
}

/**
 * The best-value maths (the app's PackValue): each pack's cost per credit is its price over its credits. The cheapest per
 * credit is the best value, only when it is really cheaper than the dearest pack. Each pack cheaper than the dearest carries
 * its saving against it, rounded down to a whole percent, so the number shown is never more than the maths gives.
 */
export function packValue(packs) {
  const per = {};
  for (const p of packs || []) {
    const price = Number(p?.priceInr);
    const n = Number(p?.credits);
    if (p?.packId && price > 0 && n > 0) per[p.packId] = { cost: price / n, credits: n };
  }
  const ids = Object.keys(per);
  if (ids.length < 2) return { bestId: null, savePercent: {} };
  const dearest = Math.max(...ids.map((id) => per[id].cost));
  let bestId = null;
  for (const id of ids) {
    if (per[id].cost >= dearest - 1e-9) continue;
    if (bestId === null || per[id].cost < per[bestId].cost - 1e-9 || (Math.abs(per[id].cost - per[bestId].cost) < 1e-9 && per[id].credits > per[bestId].credits)) bestId = id;
  }
  const savePercent = {};
  for (const id of ids) {
    const pct = Math.floor((1 - per[id].cost / dearest) * 100 + 1e-9);
    if (pct >= 1) savePercent[id] = pct;
  }
  return { bestId, savePercent };
}

/** The packs as cards: packRows plus what the pack comes to (Mobi first), the real best value and the saving against the dearest pack. */
export function packCards(data, phases = {}) {
  const value = packValue(data?.packs);
  return packRows(data, phases).map((row) => ({
    ...row,
    worth: row.value,
    best: value.bestId === row.packId,
    save: value.savePercent[row.packId] ? `Save ${value.savePercent[row.packId]}%` : null,
  }));
}

/**
 * The bridge to Pro, for Free students only. offer is what /pricing sells today (publicOffer(), read on the server):
 * { rupees, cycle: 'month' | 'once', expires }. Without it, the wallet body's proOffer (one payment through a date) is used.
 */
export function proBridge(data, offer = null) {
  if (!data || data.plan?.name === 'Pro') return null;
  const o = offer && Number(offer.rupees) > 0 ? offer : data.proOffer
    ? { rupees: data.proOffer.rupees, cycle: data.proOffer.planId === 'pro_monthly_99' ? 'month' : 'once', expires: data.proOffer.expires }
    : null;
  const price = !o ? null
    : o.cycle === 'month' ? `₹${o.rupees} a month. Cancel any time in Account.`
      : `₹${o.rupees} once${o.expires ? `, through ${o.expires}` : ''}. It does not renew.`;
  return { title: WALLET_V13_COPY.proTitle, body: WALLET_V13_COPY.proBody, price, key: WALLET_V13_COPY.proKey, href: '/pricing' };
}
