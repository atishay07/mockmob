// What Pro works out to (R3-D8, owner LK110, 5 Nov 2026: "making people realize a bigger amount as a small amount ... a toggle
// in which people can select, according to how many mocks they will do, the kind of value that they can extract"; R4-H7, owner
// LK131, 5 Nov 2026 11:40 pm: "even the lowest bar makes the students think that they are doing too low right now ... 5 or 7 a
// week at least ... less than ₹10 a mock", and a catch at the top end), computed from the offer object
// (src/lib/payments/offer.js publicOffer) and never typed: a day, and a Full mock and a question at the student's own pace.
// The dated rival comparison left the site in R4 (owner LK132: naming other platforms is a legal risk), and its maths with it.
//
// Pure: no clock (the caller passes the date) and one import, the Full mock's own size (data/test_modes.js, itself pure), so
// node --test runs every branch (data/tests/pricing_value_1105.test.mjs).
// Honest-money rules (owner UI standards, R3 spec): every "about" figure is the division to the paisa rounded UP to the next 10
// paise, never down (a count of mocks is shown to one decimal, or rounded down once it is 20 or more), so the figure matches
// price / (n x 30/7) rounded up; a question is "under" the next whole paisa only when the exact figure is below it; the maths
// is shown beside it; and a monthly price and a one-time price never share one sentence.
import { TEST_MODES } from '../../../data/test_modes.js';

/** The paces the segmented control offers: Full mocks a week (R4-H7: 5 is one a week in each of five CUET papers, 7 one a
 *  day, 14 two a day, 21 three a day). */
export const MOCK_PACES = Object.freeze([5, 7, 14, 21]);
/** The pace selected first: one Full mock a day. */
export const DEFAULT_PACE = 7;
/** A month of Pro, in days, for the per-day and per-mock framing (price / (n x 30/7)). */
export const MONTH_DAYS = 30;
/** The questions in one Full mock (a CUET paper: 50 questions in 60 minutes), from the mode that builds it. */
export const QUESTIONS_PER_MOCK = TEST_MODES.full.fixedCount;
const WEEK_DAYS = 7;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Rupees in paise rounded UP to the next 10 paise (a tiny epsilon keeps an exact 330.0000001 from becoming 340). */
export const ceilTenPaise = (paise) => Math.ceil(paise / 10 - 1e-9) * 10;

/** "₹3.30", "₹4.80", "₹99", "₹1,043": whole rupees print without paise, everything else with two places. */
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
  const questions = Math.floor(mocks) * QUESTIONS_PER_MOCK;
  return {
    kind: p.kind, pace, days: p.days, until: p.until ?? null, mocks, price: rupees(p.rupees * 100), exactPaise, exact: rupees(exactPaise), aboutPaise, about: rupees(aboutPaise),
    questions, perQuestion: perQuestion(p.rupees * 100, questions),
  };
}

/**
 * What one question comes to (R4-H7, the catch: "under 10 paise a question"). Whole mocks only (a part mock has no questions),
 * so the figure is never flattering. Under a rupee it is paise: "under 7" when the exact figure is below the next whole paisa
 * (6.6 is under 7), or the whole figure when it is exact (5 is "5", never "under 5"); from a rupee up it is rupees rounded up to
 * 10 paise, like a mock. { exactPaise: 6.6, paise: 7, under: true, text: 'under 7 paise' } or null.
 */
export function perQuestion(pricePaise, questions) {
  if (!(questions > 0) || !(pricePaise > 0)) return null;
  const exactPaise = pricePaise / questions;
  if (exactPaise >= 100) {
    const about = ceilTenPaise(exactPaise);
    return { exactPaise, paise: about, under: false, text: `about ${rupees(about)}` };
  }
  const whole = Math.ceil(exactPaise - 1e-9);
  const under = whole - exactPaise > 1e-9;
  return { exactPaise, paise: whole, under, text: `${under ? 'under ' : ''}${whole} ${whole === 1 ? 'paisa' : 'paise'}` };
}

/** Every pace of the control, worked out. */
export const perMockTable = (offer, opts) => MOCK_PACES.map((pace) => perMock(offer, pace, opts)).filter(Boolean);

/** The lowest honest per-mock figure: the control's top pace (R4-H2, the hero's "as low as ₹X a mock" hook reads this, so the
 *  hook and the control can never disagree). null when the offer gives no figure. */
export const asLowAs = (offer, opts) => perMock(offer, MOCK_PACES[MOCK_PACES.length - 1], opts);
