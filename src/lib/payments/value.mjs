// What Pro works out to (R3-D8, owner LK110, 5 Nov 2026: "making people realize a bigger amount as a small amount ... a toggle
// in which people can select, according to how many mocks they will do, the kind of value that they can extract"), computed
// from the offer object (src/lib/payments/offer.js publicOffer) and never typed: a day, a Full mock at the student's own pace,
// and the total to CUET for the dated comparison (data/price_comparison_1105.mjs).
//
// Pure: no imports, no clock (the caller passes the date), so node --test runs every branch (data/tests/pricing_value_1105.test.mjs).
// Honest-money rules (owner UI standards, R3 spec): every "about" figure is the division to the paisa rounded UP to the next 10
// paise, never down (a count of mocks is shown to one decimal, or rounded down once it is 20 or more), so the figure matches the
// spec's 99 / (n x 30/7) rounded up; the maths is shown beside it; a monthly price and a one-time price never share one
// sentence; and a total is compared only over the same period (to the CUET month), never a monthly price against a one-time one.

/** The paces the segmented control offers: Full mocks a week (spec R3-D8). */
export const MOCK_PACES = Object.freeze([2, 4, 7, 14]);
/** The pace selected first: a steady two-a-week-plus student, the middle of the control. */
export const DEFAULT_PACE = 4;
/** A month of Pro, in days, for the per-day and per-mock framing (spec: 99 / (n x 30/7)). */
export const MONTH_DAYS = 30;
const WEEK_DAYS = 7;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Rupees in paise rounded UP to the next 10 paise (a tiny epsilon keeps an exact 330.0000001 from becoming 340). */
export const ceilTenPaise = (paise) => Math.ceil(paise / 10 - 1e-9) * 10;

/** "₹3.30", "₹11.60", "₹693", "₹5,499": whole rupees print without paise, everything else with two places. */
export function rupees(paise) {
  const value = Math.round(paise) / 100;
  if (Number.isInteger(value)) return `₹${value.toLocaleString('en-IN')}`;
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "31 July 2027" (the offer's own wording) as a UTC date, or null. */
export function parseDay(text) {
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(String(text || '').trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  return month < 0 ? null : new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
}

const dayNumber = (date) => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);

/** Whole days from `from` to `to` (both counted as calendar days in UTC), never below 0. */
export const daysBetween = (from, to) => Math.max(0, dayNumber(to) - dayNumber(from));

/** Full mocks a pace gives over a number of days, as the page prints it: one decimal under 20, else whole and rounded DOWN
 *  (fewer mocks makes each one dearer, so the figure is never flattering). */
export function mocksIn(pace, days) {
  const exact = (pace * days) / WEEK_DAYS;
  if (Number.isInteger(exact)) return exact;
  return exact < 20 ? Math.round(exact * 10) / 10 : Math.floor(exact);
}

/** The period the offer pays for today: a 30-day month on the monthly plan, or the days left to the one-time expiry. */
function period(offer, from) {
  if (offer?.purchasable === 'monthly') return { kind: 'monthly', rupees: offer.monthly.rupees, days: MONTH_DAYS };
  const until = parseDay(offer?.oneTime?.expires);
  if (!until || !(from instanceof Date)) return null;
  const days = daysBetween(from, until);
  return days > 0 ? { kind: 'once', rupees: offer.oneTime.rupees, days, until: offer.oneTime.expires } : null;
}

/** What the plan comes to a day: { kind, rupees, perDay: '₹3.30', perDayPaise } or null when it cannot be worked out. */
export function perDay(offer, { from } = {}) {
  const p = period(offer, from);
  if (!p) return null;
  const perDayPaise = ceilTenPaise((p.rupees * 100) / p.days);
  return { kind: p.kind, rupees: p.rupees, days: p.days, until: p.until ?? null, perDayPaise, perDay: rupees(perDayPaise) };
}

/**
 * What one Full mock comes to at `pace` mocks a week. The chain is the one the page prints, so a reader can check it on a
 * calculator: mocks = pace x days / 7 (shown), exact = price / mocks (shown to the paisa), about = that figure rounded UP to the
 * next 10 paise.
 * { pace, mocks, exact: '₹11.51', about: '₹11.60', aboutPaise, price: '₹99', days, kind }
 */
export function perMock(offer, pace, { from } = {}) {
  const p = period(offer, from);
  if (!p || !Number.isFinite(pace) || pace <= 0) return null;
  const mocks = mocksIn(pace, p.days);
  if (!(mocks > 0)) return null;
  const exactPaise = Math.round((p.rupees * 100) / mocks);
  const aboutPaise = ceilTenPaise(exactPaise);
  return { kind: p.kind, pace, days: p.days, until: p.until ?? null, mocks, price: rupees(p.rupees * 100), exactPaise, exact: rupees(exactPaise), aboutPaise, about: rupees(aboutPaise) };
}

/** Every pace of the control, worked out. */
export const perMockTable = (offer, opts) => MOCK_PACES.map((pace) => perMock(offer, pace, opts)).filter(Boolean);

/** Calendar months from `from`'s month to the target month, both counted: November 2026 to May 2027 is 7. */
export function monthsThrough(from, { year, month }) {
  return (year - from.getUTCFullYear()) * 12 + (month - 1 - from.getUTCMonth()) + 1;
}

/**
 * What Pro costs from `from` to the CUET month (the comparison's own period), from the offer:
 *   monthly: one payment a month, this month through the exam month (7 x ₹99 = ₹693 from November 2026 to May 2027);
 *   one-time: the one payment, while its access runs to or past the exam month.
 * { kind, months, perMonth, totalPaise, total: '₹693', from: 'November 2026', to: 'May 2027' } or null (nothing to compare).
 */
export function proToExam(offer, { from, exam } = {}) {
  if (!(from instanceof Date) || !exam) return null;
  const months = monthsThrough(from, exam);
  if (months < 1) return null;
  const label = { from: `${MONTH_NAMES[from.getUTCMonth()]} ${from.getUTCFullYear()}`, fromMonth: MONTH_NAMES[from.getUTCMonth()], to: `${MONTH_NAMES[exam.month - 1]} ${exam.year}` };
  if (offer?.purchasable === 'monthly') {
    const perMonth = offer.monthly.rupees;
    return { kind: 'monthly', months, perMonth: rupees(perMonth * 100), totalPaise: months * perMonth * 100, total: rupees(months * perMonth * 100), ...label };
  }
  const until = parseDay(offer?.oneTime?.expires);
  // The one payment covers the period only if its access lasts to the end of the exam month.
  if (!until || until < new Date(Date.UTC(exam.year, exam.month, 0))) return null;
  return { kind: 'once', months, perMonth: null, totalPaise: offer.oneTime.rupees * 100, total: rupees(offer.oneTime.rupees * 100), until: offer.oneTime.expires, ...label };
}
