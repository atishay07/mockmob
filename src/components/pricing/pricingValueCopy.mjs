// The /pricing page's value section (PricingValue.jsx; round 6, owner 7 Nov 2026: "below that, keep a more detailed value
// indicator than the homepage one. This can have more features and more convincing ways, so if someone is coming to a pricing
// page, they should not leave in any case"; "Students usually pay ₹3,000 the usual way, ₹99 a month here. That line was
// removed, and we should add it back"; "the default should be 5 only, because 99% of students are taking 5 subjects").
// The home card (src/components/landing/PlanValue.jsx) is the short version; this one adds how often you sit a full mock, what
// Pro comes to at that pace, and what else the same price holds.
//
// Pure: no React, no browser, no clock (the caller passes the day), so node --test pins every word and every figure
// (data/tests/pricing_page_r6.test.mjs).
// Truth (owner rule, hard): every rupee figure is worked out by receipt.mjs (usualWay, planValue) and value.mjs (paceWords,
// rupees) from the live offer, never typed here. The typical prices are the owner's own low estimates (receipt.mjs
// USUAL_PRICES), said as typical, with no platform named and no claim about what anyone else lacks.
// Copy rules: sentence case, no middle dots, no exclamation marks, no hype, no arrows on keys; a monthly price and a one-time
// price never share one sentence.
import { MOCK_PACES, PACE, paceWords, rupees } from '../../lib/payments/value.mjs';
import { SUBJECT_COUNT, USUAL_PRICES, planValue, share, usualWay } from '../../lib/payments/receipt.mjs';
import { PRO_MOBI_CREDITS, VALUE_COPY } from '../landing/homeCopy.mjs';

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const n = (count) => Number(count).toLocaleString('en-IN');

/** Where the two controls start: 5 subjects (owner, 7 Nov 2026: "99% of students are taking 5"; CUET UG's most, SUBJECT_COUNT.max)
 *  and one full mock a day (value.mjs PACE.start, 7 a week). */
export const VALUE_START = Object.freeze({ subjects: SUBJECT_COUNT.max, pace: PACE.start });
/** The subject steps, 1 to 5. */
export const SUBJECT_STEPS = Object.freeze(Array.from({ length: SUBJECT_COUNT.max - SUBJECT_COUNT.min + 1 }, (_, i) => SUBJECT_COUNT.min + i));
/** The pace steps: 5 a week, then one, two and three a day (all within value.mjs MOCK_PACES). Four big keys, not a slider: the owner
 *  missed the old pace picker but not its labels ("5, 1 per paper. What does that mean?"), so each key says its pace plainly. */
export const PACE_STEPS = Object.freeze([PACE.min, 7, 14, PACE.max].filter((pace) => MOCK_PACES.includes(pace)));

/**
 * A pace key's words, from value.mjs paceWords: the number a week on the key, and under it the same pace said plainly ("1 a day",
 * "2 a day"; for 5, "a week", since the key's own number already says 5). `aria` starts with the number the key shows (WCAG 2.5.3
 * label in name): "7 full mocks a week, 1 a day", "5 full mocks a week".
 */
export function paceStep(pace) {
  const words = paceWords(pace);
  const lead = `${pace} `;
  const aria = pace % 7 === 0 ? `${pace} full mocks a week, ${words.short}` : cap(words.long);
  return { pace, label: String(pace), sub: words.short.startsWith(lead) ? words.short.slice(lead.length) : words.short, aria };
}

/** The plain offer the client needs to work the figures out (no plan ids), as the home page's #pricing builds it. */
export function plainTerms(offer) {
  return { purchasable: offer?.purchasable, monthly: { rupees: offer?.monthly?.rupees }, oneTime: { rupees: offer?.oneTime?.rupees, expires: offer?.oneTime?.expires } };
}

/** Whether the section is drawn: only while the offer gives a price and the new (recovery) offer is not released (its list does not
 *  promise unlimited mocks). */
export const valueShown = (terms, { newOffer = false } = {}) => !newOffer && usualWay(terms) !== null;

/** Paces that give at least one whole mock in what the offer pays for (a one-time offer near its end can give none at 5 a week). */
export const paceSteps = (terms, { from } = {}) => PACE_STEPS.filter((pace) => planValue(terms, { from, pace }) !== null);

/** "About ₹3.30", or "₹3.30" when the division is exact (receipt.mjs share): the "about" is never said of an exact figure. */
const about = (share) => (share.exact ? '' : 'About');

/**
 * The three figures at a pace, each { key, pre, value, unit, text }: a mock, a question and a day, from receipt.mjs planValue
 * (whole mocks only, every "about" the true division rounded up to 10 paise; a question "under" the next whole paisa).
 * R8 PRICE-17: at one mock a day the day's figure is the mock's figure again, so when the caller passes the student's `subjects`
 * that third tile says what Pro comes to a subject instead (the same rounding, receipt.mjs share): three measures at every pace.
 */
export function paceFigures(v, { subjects = null } = {}) {
  if (!v) return [];
  const q = v.perQuestion;
  const question = q.exactPaise >= 100
    ? { pre: 'About', value: rupees(q.paise), unit: 'a question' }
    : { pre: q.under ? 'Under' : '', value: String(q.paise), unit: `${q.paise === 1 ? 'paisa' : 'paise'} a question` };
  const figures = [
    { key: 'mock', pre: about(v.perMock), value: v.perMock.about, unit: 'a mock' },
    { key: 'question', ...question },
    { key: 'day', pre: about(v.perDay), value: v.perDay.about, unit: 'a day' },
  ];
  if (Number.isInteger(subjects) && subjects > 0 && v.perDay.aboutPaise === v.perMock.aboutPaise) {
    const each = share(v.pricePaise, subjects);
    // (Near the end of a one-time term the mocks left can equal the subjects; then the subject says nothing new either.)
    if (each.aboutPaise !== v.perMock.aboutPaise) figures[2] = { key: 'subject', pre: about(each), value: each.about, unit: 'a subject' };
  }
  return figures.map((f) => ({ ...f, text: [f.pre.toLowerCase(), f.value, f.unit].filter(Boolean).join(' ') }));
}

const subjectsWord = (count) => `${count} ${count === 1 ? 'subject' : 'subjects'}`;
const proPrice = (u) => (u.kind === 'monthly' ? `${u.pro} a month` : `${u.pro} once`);

export const PRICING_VALUE = Object.freeze({
  title: 'What students usually pay, and what you pay.',
  /** The lede: monthly and one-time each get their own sentence. */
  lede: (u, { until = null } = {}) => `Set your subjects and how often you sit a full mock. The usual way uses typical prices; Pro is ${u.kind === 'monthly' ? `${u.pro} a month` : `${u.pro} once${until ? `, through ${String(until).replace(/ /g, ' ')}` : ''}`}.`,
  askSubjects: 'How many CUET subjects are you taking?',
  askPace: 'Full mocks a week',
  subjects: subjectsWord,
  usualHead: 'The usual way',
  // The two things a student usually buys for each subject, with their desk objects (BrandIcon), as the home card names them
  // (homeCopy.mjs VALUE_COPY.lines and VALUE_COPY.each).
  lines: Object.freeze({
    mocks: Object.freeze({ icon: 'questions', name: 'Mock test series' }),
    revision: Object.freeze({ icon: 'keycards', name: 'Revision cards or books' }),
  }),
  each: (line) => (line.key === 'mocks' ? `${line.perSubject} a subject for 10 to 30 papers, typical` : `${line.perSubject} a subject, typical`),
  totalLabel: (u) => `For ${subjectsWord(u.subjects)}`,
  proName: 'MockMob Pro',
  proPrice,
  // homeCopy.mjs VALUE_COPY.proLine.
  proLine: ({ keyCards = false } = {}) => `Every subject, unlimited mocks, Mistake Lab, ${keyCards ? 'Key cards and ' : ''}Ask Mobi.`,
  barUsual: 'The usual way',
  barPro: 'MockMob Pro',
  /** The punch line (owner, 7 Nov 2026: "₹3,000 the usual way, ₹99 a month here"): the usual total, then Pro's own price.
   *  `rest` follows the total where the total is drawn rolling (the whole sentence is `usual`, for a screen reader). */
  /** The Pro half is the home card's own wording (homeCopy.mjs VALUE_COPY.punch), so the line reads the same in both places. */
  punch: (u) => ({ usual: `${u.total} the usual way.`, rest: 'the usual way.', pro: VALUE_COPY.punch(u).pro }),
  paceHead: 'At your pace',
  /** The maths beside the figures (value.mjs: "the maths is shown beside it"): whole mocks and their questions in the period. */
  paceMaths: (v) => `${cap(paceWords(v.pace).long)}: ${n(v.mocks)} full mocks and ${n(v.questions)} questions ${v.kind === 'monthly' ? `in ${v.days} days` : `by ${String(v.until).replace(/ /g, ' ')}`}.`, // PRICE-17: the date never splits
  seriesLine: 'A test series stops at its last paper. Pro builds a new one every time you start.',
  alsoHead: (u) => `Also in the same ${u.pro}`,
  getPro: 'Get Pro', // D185: the key says Get Pro (planOffer.mjs PLAN_COPY.key)
  startFree: 'Sign up free', // homeCopy.mjs PLAN_HOME.freeCta
  /** The typical prices, said once (homeCopy.mjs VALUE_COPY.footnote, word for word). */
  footnote: () => `Typical prices: ${rupees(USUAL_PRICES.mockSeriesPaise)} a subject for a CUET mock series (${rupees(USUAL_PRICES.mockSeriesPaise)}-${rupees(USUAL_PRICES.mockSeriesHighPaise).slice(1)} is common) and ${rupees(USUAL_PRICES.revisionPaise)} a subject for revision cards or a revision book. Yours may differ.`,
  /** What a screen reader hears after a key is pressed. */
  liveSubjects: (u) => `${cap(subjectsWord(u.subjects))}: ${u.total} the usual way, ${proPrice(u)} on MockMob Pro.`,
  livePace: (v, { subjects = null } = {}) => `${cap(paceWords(v.pace).long)}: ${paceFigures(v, { subjects }).map((f) => f.text).join(', ')}.`,
});

/**
 * "Also in the same ₹99": what else Pro's price holds, one desk object (BrandIcon; 'bell' is Ask Mobi's brass desk bell, as in the
 * feature tour), a name and one line each. Every line is a line the site already ships (source on each), never a new claim, and
 * none says what anyone else lacks. Key cards only while they are live (KEY_CARDS_ENABLED); hosting a Mob only while the Mob is
 * live (the same switches /pricing's mobRows reads); Score Recovery only while `recovery` (recoveryReleased()).
 */
export function valueTiles({ keyCards = false, mob = false, recovery = false } = {}) {
  return [
    // src/app/pricing/page.js PRO_COPY.moments[0].line, its first sentence.
    { key: 'mocks', icon: 'papers', name: 'Unlimited mocks', line: 'Each Full mock is built fresh from one central question bank, so every paper is new.' },
    // homeCopy.mjs LAB_HEAD.sub.
    { key: 'lab', icon: 'mistakes', name: 'Mistake Lab', line: 'Every mock opens in the Lab: time, changed answers and the reason behind each miss.' },
    // Score Recovery only once it is live (data/capabilities.js recoveryReleased(): its fresh checks "open soon" until then); homeCopy.mjs
    // RECOVERY_HEAD.sub. Until then the slot holds Smart practice, live in Pro today: src/app/pricing/page.js PRO_COPY.moments[1].line
    // (planOffer.mjs compareRows: Smart practice, Free no, Pro yes).
    recovery
      ? { key: 'recovery', icon: 'revise', name: 'Score Recovery', line: 'Replay the session, repair the leak, then prove it on fresh questions days later.' }
      : { key: 'smart', icon: 'questions', name: 'Smart practice', line: 'Smart practice reads your record and leans each set toward the chapters you miss, so every set fixes something.' },
    // homeCopy.mjs proPlan() item 5 ("... 50 credits a month, all for Mobi"), then buildTour's Ask Mobi lede.
    { key: 'mobi', icon: 'bell', name: 'Ask Mobi', line: `${PRO_MOBI_CREDITS} credits a month, all for Mobi. Ask about your own record and get one next step.` },
    // homeCopy.mjs proPlan() item 6, then keyCardsCopy.mjs KEY_CARDS_HEAD.sub's last sentence.
    ...(keyCards ? [{ key: 'keycards', icon: 'keycards', name: 'Key cards', line: 'Every Key card, with no daily review cap. Your rating sets when it comes back.' }] : []),
    // homeCopy.mjs COMPASS_PRO.title.
    { key: 'compass', icon: 'compass', name: 'DU Compass', line: 'Your practice, mapped to the colleges you want.' },
    // src/app/pricing/page.js PRO_COPY.moments[2] (eyebrow "NTA mode", its line's first clause).
    { key: 'nta', icon: 'today', name: 'Exam-day screen', line: 'NTA mode: 50 questions in 60 minutes, on the screen you will meet on the day.' },
    // src/app/pricing/page.js PRO_COPY.alsoMob.line.
    ...(mob ? [{ key: 'mob', icon: 'mob', name: 'Host your Mob', line: 'Start as many games as you like, and up to 3 Mobs of your own.' }] : []),
  ];
}
