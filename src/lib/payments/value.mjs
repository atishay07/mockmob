// What Pro works out to (R3-D8, owner LK110, 5 Nov 2026: "making people realize a bigger amount as a small amount ... a toggle
// in which people can select, according to how many mocks they will do, the kind of value that they can extract"; R4-H7, owner
// LK131, 5 Nov 2026 11:40 pm: "even the lowest bar makes the students think that they are doing too low right now ... 5 or 7 a
// week at least ... less than ₹10 a mock", and a catch at the top end), computed from the offer object
// (src/lib/payments/offer.js publicOffer) and never typed: a day, and a Full mock and a question at the student's own pace.
// The dated rival comparison left the site in R4 (owner LK132: naming other platforms is a legal risk), and its maths with it.
// Round 5 (owner, 6 Nov 2026: "In 5, you have written 1 per paper. What does that mean? ... There should be a slider"): the four
// keys became one slider of Full mocks a week, 5 to 21 (PACE), each value said plainly (paceWords), and the value block beside
// the Pro card became the value plan of everything Pro's price covers at the student's own pace (receipt.mjs).
//
// Pure: no clock (the caller passes the date) and one import, the Full mock's own size (data/test_modes.js, itself pure), so
// node --test runs every branch (data/tests/pricing_value_1105.test.mjs).
// Honest-money rules (owner UI standards, R3 spec): every "about" figure is the true division rounded UP to the next 10 paise,
// never down (aboutTenPaise; a count of mocks is shown to one decimal, or rounded down once it is 20 or more), so the figure
// matches price / (n x 30/7) rounded up; a question is "under" the next whole paisa only when the exact figure is below it; the
// maths is shown beside it; and a monthly price and a one-time price never share one sentence.
import { TEST_MODES } from '../../../data/test_modes.js';

/** The slider: Full mocks a week, from 5 (owner LK131: "start at 5-7 so even the lowest makes students feel they practise too
 *  little") to 21, three a day, in steps of one. It starts at its floor, 5 a week (round 5, second take): the student moves it up
 *  from there, and at the start no figure on the value card repeats another (at one a day a mock would cost what a day does, and
 *  the mocks would equal the days). */
export const PACE = Object.freeze({ min: 5, max: 21, step: 1, start: 7 });
/** Every value the slider can take, lowest first (the hero's "as low as" hook reads the last). */
export const MOCK_PACES = Object.freeze(Array.from({ length: (PACE.max - PACE.min) / PACE.step + 1 }, (_, i) => PACE.min + i * PACE.step));
/** The pace selected first: one Full mock a day (round 5, final pass). */
export const DEFAULT_PACE = PACE.start;
/** A month of Pro, in days, for the per-day and per-mock framing (price / (n x 30/7)). */
export const MONTH_DAYS = 30;
/** The questions in one Full mock (a CUET paper: 50 questions in 60 minutes), from the mode that builds it. */
export const QUESTIONS_PER_MOCK = TEST_MODES.full.fixedCount;
const WEEK_DAYS = 7;

/**
 * A pace said plainly, the same words on the slider, in the receipt and in the hero's hook (owner, 6 Nov 2026: "In 7, 1 a day
 * makes sense ... 21 also makes sense (3 a day), but 5, 1 per paper, what does that mean?"): a whole number a day when the
 * week divides by 7, else so many a week. `long` names the thing ("1 full mock a day", "5 full mocks a week"); `short` is the
 * slider's end label ("1 a day", "5 a week").
 */
export function paceWords(pace) {
  const n = Number(pace);
  const perDay = n % WEEK_DAYS === 0 ? n / WEEK_DAYS : null;
  const count = perDay ?? n;
  const unit = perDay ? 'a day' : 'a week';
  return { long: `${count} full ${count === 1 ? 'mock' : 'mocks'} ${unit}`, short: `${count} ${unit}` };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Rupees in paise rounded UP to the next 10 paise (a tiny epsilon keeps an exact 330.0000001 from becoming 340). */
export const ceilTenPaise = (paise) => Math.ceil(paise / 10 - 1e-9) * 10;

/**
 * "About" a share of the price: price / count, rounded UP to the next 10 paise from the true division (never from a figure
 * already rounded to the paisa, which could sit up to half a paisa under it). One rule for a day, a mock and the value plan
 * beside the Pro card (receipt.mjs), so at one full mock a day a mock and a day always read the same figure.
 */
export const aboutTenPaise = (pricePaise, count) => ceilTenPaise(pricePaise / count);

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
  const perDayPaise = aboutTenPaise(p.rupees * 100, p.days);
  return { kind: p.kind, rupees: p.rupees, days: p.days, until: p.until ?? null, perDayPaise, perDay: rupees(perDayPaise) };
}

/**
 * What one Full mock comes to at `pace` mocks a week. The chain is the one the page prints, so a reader can check it on a
 * calculator: mocks = pace x days / 7 (shown), exact = price / mocks (to the paisa), about = price / mocks rounded UP to the
 * next 10 paise (aboutTenPaise).
 * { pace, mocks, exact: '₹11.51', about: '₹11.60', aboutPaise, price: '₹99', pricePaise, days, kind }
 */
export function perMock(offer, pace, { from } = {}) {
  const p = period(offer, from);
  if (!p || !Number.isFinite(pace) || pace <= 0) return null;
  const mocks = mocksIn(pace, p.days);
  if (!(mocks > 0)) return null;
  const exactPaise = Math.round((p.rupees * 100) / mocks);
  const aboutPaise = aboutTenPaise(p.rupees * 100, mocks);
  const questions = Math.floor(mocks) * QUESTIONS_PER_MOCK;
  return {
    kind: p.kind, pace, days: p.days, until: p.until ?? null, mocks, price: rupees(p.rupees * 100), pricePaise: p.rupees * 100, exactPaise, exact: rupees(exactPaise), aboutPaise, about: rupees(aboutPaise),
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

/** Every pace of the slider, worked out. */
export const perMockTable = (offer, opts) => MOCK_PACES.map((pace) => perMock(offer, pace, opts)).filter(Boolean);

/** The lowest honest per-mock figure: the slider's top pace (R4-H2, the hero's "as low as ₹X a mock" hook reads this, so the
 *  hook and the slider can never disagree). null when the offer gives no figure. */
export const asLowAs = (offer, opts) => perMock(offer, MOCK_PACES[MOCK_PACES.length - 1], opts);
