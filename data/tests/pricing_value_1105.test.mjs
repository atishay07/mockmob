// Round 3 pricing on the home page (SPEC-R3 R3-D7, R3-D8, R3-D9; owner LK107, LK109-LK112, 5 Nov 2026): the numbers band folded
// into the one plan, the plan as a glass card shared with /pricing, the value at the student's own pace, the dated comparison
// and the branded close band. These tests pin the owner's money rules, not the markup:
//   every rupee figure is worked out from the offer (src/lib/payments/value.mjs) or read from the dated table
//   (data/price_comparison_1105.mjs), never typed; no rival price appears without its date and its source; a monthly price
//   and a one-time price never share a sentence; totals are compared over the same period; nothing says "cheapest".
// Source-level and pure, so no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { MOCK_PACES, DEFAULT_PACE, MONTH_DAYS, ceilTenPaise, perDay, perMock, perMockTable, proToExam, daysBetween, monthsThrough, rupees } from '../../src/lib/payments/value.mjs';
import { PRICE_COMPARISON, sourceHost } from '../price_comparison_1105.mjs';
import { PLAN_HOME, VALUE_COPY, COMPARE_COPY, pricingHead, planGroups, freeLine, proPlan } from '../../src/components/landing/homeCopy.mjs';
import { PLAN_COPY, planTerms, compareRows } from '../../src/components/pricing/planOffer.mjs';
import { REFERRAL_COPY, INVITE_FIELD_HREF, INVITE_ANCHOR } from '../../src/lib/referrals/friendInvite.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const monthly = (rupeesPerMonth = 99) => ({ purchasable: 'monthly', monthly: { rupees: rupeesPerMonth }, oneTime: { rupees: 99, expires: '31 July 2027' } });
const oneTime = (rupeesOnce = 99, expires = '31 July 2027') => ({ purchasable: 'one_time', monthly: { rupees: 99 }, oneTime: { rupees: rupeesOnce, expires } });
const READ_DAY = new Date(Date.UTC(2026, 10, 5)); // 5 Nov 2026, the day the prices were read and this round was built
const EXAM = PRICE_COMPARISON.exam;

// The files that draw a price on the home page's #pricing and its close band.
const PRICE_SOURCES = ['src/components/landing/HomePricing.jsx', 'src/components/landing/PlanValue.jsx', 'src/components/landing/PriceCompare.jsx',
  'src/components/landing/PlanCounts.jsx', 'src/components/landing/PlanFree.jsx', 'src/components/landing/CloseActions.jsx', 'src/components/pricing/PlanCard.jsx',
  'src/components/pricing/planOffer.mjs', 'src/components/landing/homeCopy.mjs', 'src/lib/payments/value.mjs', 'src/app/page.js'];

// ------------------------------------------------------------------------------------------------ computed, never typed
test('the per-mock figures are worked out from the offer: 99 / (n x 30/7) rounded up to 10 paise, for every pace of the control', () => {
  assert.deepEqual([...MOCK_PACES], [2, 4, 7, 14], 'the spec\'s paces: Full mocks a week');
  assert.ok(MOCK_PACES.includes(DEFAULT_PACE));
  assert.equal(MONTH_DAYS, 30);
  const table = perMockTable(monthly());
  assert.deepEqual(table.map((row) => row.about), ['₹11.60', '₹5.80', '₹3.30', '₹1.70']);
  for (const row of table) {
    // The spec's own formula, in paise, gives the same figure the page prints.
    assert.equal(row.aboutPaise, ceilTenPaise((9900 * 7) / (row.pace * 30)), `pace ${row.pace}`);
    assert.ok(row.aboutPaise >= row.exactPaise, 'rounded up, never down');
    assert.equal(row.price, '₹99');
  }
});

test('change the offer and every figure follows it: nothing on the page is a typed rupee amount', () => {
  const dearer = perMockTable(monthly(149));
  assert.deepEqual(dearer.map((row) => row.about), dearer.map((row) => rupees(ceilTenPaise(Math.round(14900 / row.mocks)))));
  assert.notDeepEqual(dearer.map((row) => row.about), perMockTable(monthly()).map((row) => row.about));
  assert.equal(perDay(monthly()).perDay, '₹3.30', '₹99 a month is about ₹3.30 a day');
  assert.equal(perDay(monthly(149)).perDay, '₹5');
  assert.equal(pricingHead(monthly()).sub, '₹99 a month is about ₹3.30 a day.');
  assert.equal(pricingHead(monthly(149)).sub, '₹149 a month is about ₹5 a day.');
  // No typed rupee amount in any file that draws the plan, its value or the comparison (comments aside).
  for (const rel of PRICE_SOURCES) {
    assert.doesNotMatch(stripComments(read(rel)), /₹\s?\d/, `${rel} types a rupee amount`);
  }
  // The rival prices live in the dated table only, as paise.
  for (const rel of PRICE_SOURCES) {
    assert.doesNotMatch(stripComments(read(rel)), /5,?499|1,?168|549900|116800/, `${rel} names a rival price outside the dated table`);
  }
});

test('the maths is shown and checks out: mocks a month, the division to the paisa, then "rounded up" only when it was', () => {
  const row = perMock(monthly(), 4);
  assert.equal(VALUE_COPY.math(row), '4 a week is 17.1 Full mocks in a 30-day month. ₹99\u00a0÷\u00a017.1\u00a0=\u00a0₹5.79, rounded up to ₹5.80.');
  assert.equal(VALUE_COPY.math(perMock(monthly(), 7)), '7 a week is 30 Full mocks in a 30-day month. ₹99\u00a0÷\u00a030\u00a0=\u00a0₹3.30.');
  for (const r of perMockTable(monthly())) {
    assert.equal(Math.round((99 / r.mocks) * 100), r.exactPaise, `₹99 ÷ ${r.mocks} on a calculator`);
  }
});

test('the one-time offer gets its own sentences: days to its expiry, never "a month"', () => {
  assert.equal(daysBetween(READ_DAY, new Date(Date.UTC(2027, 6, 31))), 268);
  const row = perMock(oneTime(), 4, { from: READ_DAY });
  assert.equal(row.kind, 'once');
  assert.equal(row.mocks, 153, '4 a week for 268 days, rounded down');
  assert.equal(VALUE_COPY.math(row), '4 a week to 31 July 2027 is 153 Full mocks. ₹99\u00a0÷\u00a0153\u00a0=\u00a0₹0.65, rounded up to ₹0.70.');
  assert.equal(perMock(oneTime(), 4), null, 'without a date, no one-time figure (the page passes its build date)');
  assert.equal(perDay(oneTime(99, '1 November 2026'), { from: READ_DAY }), null, 'an expired one-time offer gives no figure');
});

test('a monthly price and a one-time price never share one sentence', () => {
  const sentences = (text) => String(text).split(/(?<=\.)\s+/);
  const lines = [
    pricingHead(monthly()).sub, pricingHead(oneTime()).sub,
    ...perMockTable(monthly()).map(VALUE_COPY.math), ...perMockTable(oneTime(), { from: READ_DAY }).map(VALUE_COPY.math),
    COMPARE_COPY.proTerm(proToExam(monthly(), { from: READ_DAY, exam: EXAM })), COMPARE_COPY.proTerm(proToExam(oneTime(), { from: READ_DAY, exam: EXAM })),
    ...Object.values(planTerms(monthly())), ...Object.values(planTerms(oneTime())),
  ].filter(Boolean);
  for (const line of lines) for (const sentence of sentences(line)) {
    assert.ok(!(/\bonce\b|one payment/i.test(sentence) && /a month|monthly/i.test(sentence)), sentence);
  }
});

// ------------------------------------------------------------------------------------------------ the dated comparison
test('MockMob\'s comparison row is the same period as the rivals\': one payment a month to the CUET month, from the offer', () => {
  assert.deepEqual({ ...EXAM }, { year: 2027, month: 5 }, 'to May 2027');
  assert.equal(monthsThrough(READ_DAY, EXAM), 7, 'November 2026 to May 2027');
  const pro = proToExam(monthly(), { from: READ_DAY, exam: EXAM });
  assert.equal(pro.total, '₹693');
  assert.equal(COMPARE_COPY.proTerm(pro), '7 months × ₹99, from November');
  assert.equal(proToExam(monthly(149), { from: READ_DAY, exam: EXAM }).total, '₹1,043');
  assert.equal(proToExam(monthly(), { from: new Date(Date.UTC(2027, 1, 10)), exam: EXAM }).months, 4, 'a later build counts the months left');
  assert.equal(proToExam(monthly(), { from: new Date(Date.UTC(2027, 5, 1)), exam: EXAM }), null, 'after May 2027 there is nothing to compare');
  assert.equal(proToExam(oneTime(), { from: READ_DAY, exam: EXAM }).total, '₹99');
  assert.equal(proToExam(oneTime(99, '30 April 2027'), { from: READ_DAY, exam: EXAM }), null, 'a one-time term that ends before CUET is not compared');
  const home = stripComments(read('src/components/landing/HomePricing.jsx'));
  assert.match(home, /proToExam\(offer, \{ from, exam: PRICE_COMPARISON\.exam \}\)/, 'the page compares over the table\'s own period');
});

test('no rival price appears without its date and its source: every row carries both, and the page prints them', () => {
  assert.equal(PRICE_COMPARISON.readOn, '2026-11-05');
  assert.equal(PRICE_COMPARISON.readOnLabel, '5 Nov 2026');
  assert.deepEqual(PRICE_COMPARISON.rows.map((row) => row.id), ['all-access', 'science-series', 'subject-packs'], 'the spec\'s three rows');
  for (const row of PRICE_COMPARISON.rows) {
    assert.equal(row.readOn, PRICE_COMPARISON.readOn, `${row.id} is dated`);
    assert.match(row.url, /^https:\/\/[\w.-]+\.[a-z]{2,}\//, `${row.id} names the page it was read on`);
    assert.ok(row.platform && row.product, `${row.id} names the platform and product`);
    assert.ok(Number.isInteger(row.pricePaise) && row.pricePaise > 0 && row.pricePaise % 100 === 0, `${row.id} is a listed price in whole rupees`);
    assert.ok(row.term && row.gets, `${row.id} says what it is and for how long`);
    assert.doesNotMatch(`${row.what} ${row.gets} ${row.term}`, /mrp|was ₹|save|% off|cheap/i, 'the sale price as listed, nothing struck or saved');
  }
  // The figures read on each platform's own page on 5 Nov 2026 (tmp-night/r3-research: preparoo B6, prices P3, P4).
  assert.deepEqual(PRICE_COMPARISON.rows.map((row) => rupees(row.pricePaise)), ['₹5,499', '₹1,168', '₹99']);
  assert.deepEqual(PRICE_COMPARISON.rows.map((row) => sourceHost(row.url)), ['ug.preparoo.app', 'adda247.com', 'oswaal360.com']);
  // The page: the date under the table and the sources in a disclosure, each with its host and the read date.
  assert.equal(COMPARE_COPY.note(PRICE_COMPARISON.readOnLabel), 'Prices as listed on each platform’s page, 5 Nov 2026.');
  const cmp = stripComments(read('src/components/landing/PriceCompare.jsx'));
  assert.match(cmp, /<p className="lp-cmp__note">\{COMPARE_COPY\.note\(readOnLabel\)\}<\/p>/);
  assert.match(cmp, /<details className="lp-cmp__sources">/);
  assert.match(cmp, /COMPARE_COPY\.source\(\{ row, price: rupees\(row\.pricePaise\), host: sourceHost\(row\.url\), date: readOnLabel \}\)/);
  assert.match(cmp, /<b>\{rupees\(row\.pricePaise\)\}<\/b>/, 'each rival price is drawn from the table');
  const line = COMPARE_COPY.source({ row: PRICE_COMPARISON.rows[0], price: '₹5,499', host: 'ug.preparoo.app', date: '5 Nov 2026' });
  assert.equal(line, 'Preparoo, CUET All Access: ₹5,499 once, access until May 2027. Read on ug.preparoo.app, 5 Nov 2026.');
  // Nothing anywhere in the pricing sources claims to be the cheapest.
  for (const rel of [...PRICE_SOURCES, 'data/price_comparison_1105.mjs', 'src/app/home-pricing.css']) {
    assert.doesNotMatch(stripComments(read(rel)), /cheapest|lowest price|best price|best value/i, rel);
  }
});

// ------------------------------------------------------------------------------------------------ the one plan, shared
test('R3-D7: the numbers band is gone; its true counts are lines of the plan card with a count-up at 40% in view', () => {
  const page = stripComments(read('src/app/page.js'));
  assert.doesNotMatch(page, /lp-sec--tight|LiveStatsBand/);
  assert.ok(!existsSync(new URL('../../src/components/landing/LiveStatsBand.jsx', import.meta.url)), 'the band component left with the band');
  assert.doesNotMatch(read('src/app/landing.css'), /\.lp-sec--tight|\.lp \.mm-figures/);
  const groups = planGroups();
  assert.deepEqual(groups.map((g) => g.label), ['Practise', 'Review', 'Plan'], 'sentence-case group names, no caps');
  const counted = groups.flatMap((g) => g.lines).filter((line) => line.count).map((line) => line.count);
  assert.deepEqual(counted, ['bank', 'subjects'], 'the bank size and the subjects, from /api/stats');
  assert.deepEqual(groups.flatMap((g) => g.lines).filter((line) => line.text).map((line) => line.text).sort(), [...proPlan()].sort(), 'every Pro item, once');
  assert.equal(planGroups({ newOffer: true }).flatMap((g) => g.lines).filter((line) => line.text).length, proPlan({ newOffer: true }).length);
  const counts = read('src/components/landing/PlanCounts.jsx');
  assert.match(counts, /loadPublicStats\(\)/, 'the same /api/stats answer the hero reads');
  assert.match(counts, /useSeenOnce\(ref, 0\.4\)/, 'counts once at 40% in view');
  assert.match(counts, /<b className="lp-count" aria-hidden="true">[\s\S]*<span className="lp-sr">\{value\.real/, 'a screen reader hears the real number, never a counting one');
  assert.match(counts, /if \(state === 'failed' \|\| \(state === 'ready' && value == null\)\) return line\.fallback;/, 'no number when the count cannot load');
  const stats = read('src/components/landing/bankStats.js');
  assert.match(stats, /data\.publicSubjectCount/, 'the subject count is the public one (never the stored total)');
  const hook = read('src/components/landing/useCountUp.js');
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /if \(done \|\| reducedMotion\(\)\) return target;/);
});

test('R3-D8: #pricing is the /pricing page\'s one plan, through shared pieces, as a glass card over "Pro" with its seal strip', () => {
  const home = stripComments(read('src/components/landing/HomePricing.jsx'));
  assert.match(home, /<PlanCard offer=\{offer\} titleAs="h3" titleId="lp-plan-title" className="lp-plan" head=\{<ProSealStrip label=\{PLAN_COPY\.label\} \/>\}>/);
  assert.match(home, /<p className="lp-price__word" aria-hidden="true">\{PLAN_HOME\.backdrop\}<\/p>/);
  assert.equal(PLAN_HOME.backdrop, 'Pro');
  assert.match(home, /<Link href="\/pricing#plans" className="mm-btn mm-btn--primary">\{PLAN_COPY\.key\}<\/Link>/, 'Get Pro goes to the one checkout on /pricing');
  assert.equal(PLAN_COPY.plan, 'One plan, everything in it');
  assert.equal(PLAN_COPY.key, 'Get Pro');
  assert.doesNotMatch(home, /RazorpayPaymentButton/, 'no checkout on the home page');
  // Free is one quiet line with Start free, for a guest only.
  assert.equal(freeLine(), 'Or start on Free: 50 credits a month, no card needed.');
  assert.equal(freeLine({ firstFullMock: 'Your first full mock in every subject is free.' }), 'Or start on Free: 50 credits a month, no card needed. Your first full mock in every subject is free.');
  assert.match(read('src/app/page.js'), /firstFullMock=\{FIRST_FULL_MOCK_ON \? FIRST_FULL_MOCK_COPY\.plan : null\}/, 'the rule’s own sentence, only while it is on');
  assert.match(read('src/components/landing/PlanFree.jsx'), /\{isAuthenticated \? null : <Link href="\/signup" className="lp-plan__freekey">\{cta\}<\/Link>\}/);
  // Branches: the unlimited-mocks maths only while the current offer is the one on sale.
  assert.match(home, /const table = newOffer \? \[\] : perMockTable\(offer, \{ from \}\);/);
  assert.match(home, /const toExam = newOffer \? null : proToExam/);
  // /pricing draws the same card and the same rows.
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /import \{ PlanCard \} from '@\/components\/pricing\/PlanCard';/);
  assert.match(pricing, /import \{ PLAN_COPY, compareRows, planTerms \} from '@\/components\/pricing\/planOffer\.mjs';/);
  assert.doesNotMatch(pricing, /function planTerms|\['Smart practice', false, true\]/, 'nothing is copied back into the page');
  assert.equal(compareRows({ newOffer: true, recoveryRows: [['x', true, true]] }).length, 1, 'the new offer brings its own rows');
  assert.deepEqual(planTerms(monthly()), { renew: 'Renews every month. Cancel any time.', dock: '₹99 a month. Cancel any time.', soon: null });
});

test('the glass is the plan card\'s only, with a solid fallback, and the backdrop word is a quiet ink, never volt', () => {
  const css = read('src/app/home-pricing.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const glass = [...css.matchAll(/([^{}]+)\{([^{}]*backdrop-filter:[^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
  assert.ok(glass.length >= 2);
  for (const [selector, body] of glass) {
    assert.match(selector, /\.lp-plan\.pro-plan__card$/, `glass only on the plan card: ${selector}`);
    assert.match(body, /backdrop-filter: (none|blur\((8|15)px\) saturate\(1\.4\))/);
  }
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\) \{\s*\.lp \.lp-plan\.pro-plan__card \{ background: var\(--paper-raised\); -webkit-backdrop-filter: none; backdrop-filter: none; \}/);
  assert.match(css, /\.lp \.lp-price__word \{[^}]*color: var\(--price-word\)/);
  assert.doesNotMatch(css, /--price-word: [^;]*(d2f000|210, ?240|volt)/i);
  assert.doesNotMatch(css, /background-clip: text|text-shadow|@keyframes [\w-]*(sheen|shine|shimmer|glow|pulse)/i);
});

test('the pace control is a real control: native radios in a fieldset, 44 px keys, a focus ring, and the R3-D1 Day selected state', () => {
  const value = read('src/components/landing/PlanValue.jsx');
  assert.match(value, /<fieldset className="lp-seg">\s*<legend className="lp-seg__legend">\{VALUE_COPY\.pace\}<\/legend>/);
  assert.match(value, /<input type="radio" name=\{`\$\{id\}-pace`\} value=\{r\.pace\} checked=\{r\.pace === pace\} onChange=\{\(\) => setPace\(r\.pace\)\} \/>/);
  assert.match(value, /<div className="lp-value__read" aria-live="polite">/, 'a screen reader hears the new figure once');
  assert.match(value, /<b aria-hidden="true">\{rupees\(shown\)\}<\/b><span className="lp-sr">\{row\.about\}<\/span>/);
  assert.match(value, /if \(reduced\(\)\)/, 'reduced motion changes the figure at once');
  assert.equal(VALUE_COPY.pace, 'Full mocks a week');
  const css = read('src/app/home-pricing.css');
  assert.match(css, /\.lp \.lp-seg__opt span \{[^}]*min-height: 44px/);
  assert.match(css, /\.lp \.lp-seg__opt input:focus-visible \+ span \{ outline: 2px solid var\(--focus-ring/);
  assert.match(css, /\.lp \.lp-seg__opt input:checked \+ span \{ background: var\(--volt\); color: var\(--volt-ink\); \}/, 'Night: a volt fill carrying dark ink');
  assert.match(css, /html\[data-theme='light'\] \.lp \.lp-seg__opt input:checked \+ span \{ background: #fffdf8; color: var\(--ink\); box-shadow: inset 0 0 0 1\.5px #526700; \}/, 'Day: paper, a 1.5 px green rim, ink');
});

// ------------------------------------------------------------------------------------------------ the close band
test('R3-D9: the final card keeps Sign up free and Log in, wears the answer sheet, and gives a guest one invite line only while invites are on', () => {
  const page = stripComments(read('src/app/page.js'));
  assert.match(page, /const INVITES_LIVE = referralsLive\(\);/, 'the server switch /signup reads');
  assert.match(page, /<CloseActions invites=\{INVITES_LIVE\} \/>/);
  assert.match(page, /<MascotSeat station="close" pose="celebrating"/, 'Mobi stays');
  const close = stripComments(read('src/components/landing/CloseActions.jsx'));
  assert.match(close, /\{invites && !isAuthenticated \? \(/, 'a guest, while invites are on');
  assert.match(close, /<Link href=\{INVITE_FIELD_HREF\} prefetch=\{false\}>\{REFERRAL_COPY\.homeInviteLink\}<\/Link>/);
  assert.doesNotMatch(close, /displayReferralCode|referralView|\/api\/referrals|referralLink\(/, 'never a code on a guest page');
  assert.equal(INVITE_FIELD_HREF, '/signup#invite-code');
  const field = read('src/components/referrals/InviteCodeField.jsx');
  assert.match(field, /id=\{INVITE_ANCHOR\}/, 'the sign-up page has the anchor');
  assert.match(field, /window\.location\.hash === `#\$\{INVITE_ANCHOR\}`\) setOpen\(true\)/, 'and the link opens the field');
  assert.equal(INVITE_ANCHOR, 'invite-code');
  const words = [REFERRAL_COPY.homeInviteAsk, REFERRAL_COPY.homeInviteLink, REFERRAL_COPY.homeInviteReward()].join(' ');
  assert.equal(words, 'Have a friend’s invite code? Add it when you sign up You both get 100 credits once you finish one practice.');
});

// ------------------------------------------------------------------------------------------------ copy rules on the new words
test('the new pricing words follow the copy rules: no middle dots, no "!", no hype, sentence case, and the section sub fits its budget', () => {
  const words = [
    ...Object.values(PLAN_HOME), VALUE_COPY.title, VALUE_COPY.pace, VALUE_COPY.result, VALUE_COPY.about,
    ...perMockTable(monthly()).map(VALUE_COPY.math), ...perMockTable(oneTime(), { from: READ_DAY }).map(VALUE_COPY.math),
    COMPARE_COPY.title('May 2027'), COMPARE_COPY.pro, COMPARE_COPY.proGets({ kind: 'monthly' }), COMPARE_COPY.note('5 Nov 2026'), COMPARE_COPY.sources,
    ...planGroups().flatMap((g) => [g.label, ...g.lines.map((line) => line.text || `${line.rest} ${line.fallback}`)]),
    ...PRICE_COMPARISON.rows.flatMap((row) => [row.what, row.gets, row.term]),
    REFERRAL_COPY.homeInviteAsk, REFERRAL_COPY.homeInviteLink, REFERRAL_COPY.homeInviteReward(),
  ];
  for (const text of words) {
    assert.doesNotMatch(text, /[·•!]|→|->|\bunlock|seamless|supercharge|game-?changer|journey|cheapest/i, text);
    assert.doesNotMatch(text.replace(/\b(CUET|NTA)\b/g, ''), /\b[A-Z]{4,}\b/, `no capitals: ${text}`);
  }
  assert.ok(pricingHead(monthly()).sub.split(/\s+/).length <= 20);
});

test('every home source that the pricing section reaches is on the landing\'s file walk (so the landing-wide rules check it)', () => {
  const landing = readdirSync(new URL('../../src/components/landing/', import.meta.url));
  for (const f of ['HomePricing.jsx', 'PlanCounts.jsx', 'PlanFree.jsx', 'PlanValue.jsx', 'PriceCompare.jsx', 'useCountUp.js']) assert.ok(landing.includes(f), f);
  assert.match(read('src/app/page.js'), /import \{ HomePricing \} from '@\/components\/landing\/HomePricing';/);
  assert.match(read('src/components/landing/HomePricing.jsx'), /import '@\/app\/home-pricing\.css';/);
});
