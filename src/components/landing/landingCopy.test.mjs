// The landing's bolder copy (M-006, 18 Oct 2026; deck: docs/design-decisions/landing-copy-bolder-1018.md) stays inside the truth
// rules: no banned hype words or retired claims, and every bold promise still has the product behaviour that makes it true.
// Source-level, so no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { COPY_BUDGET, wordCount, STATEMENT, HERO_LEAD, LAB_HEAD, TOUR_HEAD, RECOVERY_HEAD, COMPASS_HEAD, DU_HEAD, EXAM_HEAD, INSTAGRAM_HEAD, WALL_HEAD, FAQ_HEAD, CLOSE, COMPASS_PRO, COMBO, LAB_SCENES, RECOVERY_STEPS, EXAM, pricingHead, freePlan, proPlan, buildTour, buildFaqs } from './homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const PAGE = read('../../app/page.js');
const COPY = read('homeCopy.mjs'); // the arrays moved out of page.js (1104 P5) so the budgets below can run them
const SOURCES = [
  ['src/app/page.js', PAGE],
  ...readdirSync(new URL('.', import.meta.url)).filter((f) => /\.(jsx|mjs)$/.test(f) && !f.endsWith('.test.mjs')).map((f) => [f, read(f)]),
];

test('no landing source carries a retired claim, a hype word or a guarantee', () => {
  const banned = /41 subjects|never repeats?|\bunlock|supercharg|revolutioni[sz]|\belevate|seamless|guarantee|#1\b|not affiliated/i;
  // The one exception is the owner's (7 Nov 2026): the college strip's logo line (CollegeStrip.jsx COLLEGE_NOTE).
  const note = 'College names and logos belong to their owners. MockMob is not affiliated with them.';
  for (const [name, src] of SOURCES) assert.doesNotMatch(stripComments(src).split(note).join(''), banned, name);
});

test('the hero bank line keeps every fact in one sentence and says Pro has no cap', () => {
  const line = read('QuestionBankLine.jsx');
  assert.match(line, /SUBJECT_CLAIM\.long\},/);
  assert.match(line, /no fixed set to run out of, no cap on Pro\./);
  assert.match(line, /each built fresh from one live bank of/);
  assert.match(line, /each built fresh from one live question bank/);
  assert.match(line, /bank\.questions\.toLocaleString\('en-IN'\)/, 'the count is the live one');
});

test('"unlimited mocks" on Pro stays true only while the Pro list says unlimited', async () => {
  assert.match(COPY, /h2: 'Start free\. Go Pro for unlimited mocks\.'/);
  // R3-D8 (5 Nov 2026): #pricing is HomePricing.jsx, which renders the head from homeCopy with the page's live offer.
  assert.match(PAGE, /<HomePricing offer=\{OFFER\}/, 'the page hands the live offer to the pricing section');
  assert.match(read('HomePricing.jsx'), /const head = pricingHead\(offer\);/, 'the pricing head comes from homeCopy');
  assert.ok(proPlan().includes('Unlimited Quick practice and Full mock'), 'the Pro list still promises unlimited papers');
  // The /pricing rows are shared now (src/components/pricing/planOffer.mjs compareRows): Full mocks and Quick practice stay unlimited on Pro.
  const { compareRows } = await import('../pricing/planOffer.mjs');
  for (const firstFullMockOn of [true, false]) {
    const rows = Object.fromEntries(compareRows({ firstFullMockOn }).map(([name, free, pro]) => [name, [free, pro]]));
    assert.equal(rows['Full mocks'][1], 'Unlimited');
    assert.deepEqual(rows['Quick practice'], ['1 credit a question', 'Unlimited']);
  }
  assert.match(read('../../app/pricing/page.js'), /const COMPARE_ROWS = compareRows\(\{ newOffer: newOfferReleased\(\), firstFullMockOn: FIRST_FULL_MOCK_ON, recoveryRows: RECOVERY_PACKAGING_ROWS, keyCards: process\.env\.KEY_CARDS_ENABLED === 'true' \}\);/);
});

test('"from the official key, or not at all" stays true: a disagreement gives no repair and no charge', () => {
  // The Lab's Repair scene keeps the promise (R8 SEC-10 reworded it to name only the reasons every screen shows).
  assert.match(COPY, /why the key is right, and the rule to keep\. From the official key, or not at all\./);
  assert.match(COPY, /From the official key, or not at all\./);
  assert.match(read('../../../data/mistake_repair.js'), /A disagreement never produces an explanation[\s\S]{0,120}the student is not charged/);
});

test('the SWOT is promised free only while it uses no model and no credit', () => {
  assert.match(COPY, /Free\. No credits\./);
  assert.match(read('../../../data/mock_swot.js'), /free: no model and no credit/);
});

test('the check panel promises fresh questions days apart, not that nothing ever repeats', () => {
  assert.match(read('MistakeLab.jsx'), /<p className="ml__eyebrow">Fresh questions, days apart<\/p>/);
});

// ------------------------------------------------------------------------------------------------------------------
// LK71 (4 Nov 2026): the text walls. Word budgets run on the real arrays, every branch of them.
const OFFERS = [
  { purchasable: 'monthly', monthly: { rupees: 99 }, oneTime: { rupees: 149, expires: '30 June 2027' } },
  { purchasable: 'oneTime', monthly: { rupees: 99 }, oneTime: { rupees: 149, expires: '30 June 2027' } },
];
const TOURS = [buildTour(), buildTour({ studyLive: true, studyLessons: 120, studySubjects: 15, mobLive: true })];
const everyString = (value, out = []) => {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => everyString(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => everyString(v, out));
  return out;
};
const ALL_COPY = [
  STATEMENT, HERO_LEAD, LAB_HEAD, TOUR_HEAD, RECOVERY_HEAD, COMPASS_HEAD, DU_HEAD, EXAM_HEAD, INSTAGRAM_HEAD, WALL_HEAD, FAQ_HEAD, CLOSE, COMPASS_PRO, COMBO,
  LAB_SCENES, RECOVERY_STEPS, TOURS, OFFERS.map((offer) => [pricingHead(offer), buildFaqs({ offer, mobLive: true }), buildFaqs({ offer })]),
  freePlan(), freePlan({ newOffer: true }), proPlan(), proPlan({ newOffer: true }),
].flatMap((part) => everyString(part));

test('every section sub is at most 20 words', () => {
  const subs = [LAB_HEAD, TOUR_HEAD, RECOVERY_HEAD, COMPASS_HEAD, DU_HEAD, EXAM_HEAD, INSTAGRAM_HEAD, ...OFFERS.map(pricingHead), CLOSE].map((head) => head.sub);
  assert.equal(subs.length, 10);
  for (const sub of subs) assert.ok(wordCount(sub) <= COPY_BUDGET.sub, `${wordCount(sub)} words: ${sub}`);
});

test('a tour slide has a body of at most 25 words and at most 2 points of at most 10 words each', () => {
  for (const tour of TOURS) for (const slide of tour) {
    assert.ok(wordCount(slide.body) <= COPY_BUDGET.tourBody, `${slide.id} body is ${wordCount(slide.body)} words`);
    assert.ok(slide.points.length <= COPY_BUDGET.tourPoints, `${slide.id} has ${slide.points.length} points`);
    for (const point of slide.points) assert.ok(wordCount(point) <= COPY_BUDGET.tourPointWords, `${slide.id}: "${point}" is ${wordCount(point)} words`);
    assert.ok(slide.icon, `${slide.id} names a desk object for its rail icon`);
    assert.ok(slide.lede, `${slide.id} has the one sentence phones show`);
  }
  // R11: the tour holds only the tools with no section of their own; the Lab, DU Compass and the DU section tell Repair, Replay,
  // Chapter review, Compass and the Combo Planner.
  assert.deepEqual(TOURS[1].map((s) => s.id), ['arena', 'learn', 'prepos', 'rival', 'mob'], 'five tools, no more');
  assert.deepEqual(TOURS[0].map((s) => s.id), ['arena', 'prepos', 'rival'], 'Learn and the Mob appear only while they are live');
});

test('a Lab or Recovery step is at most 45 words, with its numbers inside the mock screen', () => {
  for (const scene of LAB_SCENES) {
    const words = wordCount(`${scene.title} ${scene.body} ${scene.take}`);
    assert.ok(words <= COPY_BUDGET.step, `${scene.key}: ${words} words`);
  }
  for (const step of RECOVERY_STEPS) assert.ok(wordCount(`${step.title} ${step.body}`) <= COPY_BUDGET.step, step.key);
  // R11 (owner, 10 Nov 2026): one Lab of five scenes; the Recovery steps stay in the module, no longer drawn on the page.
  assert.deepEqual(LAB_SCENES.map((s) => s.key), ['chapters', 'time', 'changes', 'repair', 'swot']);
  assert.equal(RECOVERY_STEPS.length, 4);
  // The new first scene's take and the SWOT's are worked out from labStory, never typed.
  assert.equal(LAB_SCENES[0].take, '18 of your 28 lost marks sat in one chapter: Partnership.');
  assert.doesNotMatch(COPY, /take: '18 of your/, 'the Chapters take is built, not typed');
  assert.equal(LAB_SCENES[4].take, 'Practise 10 on Partnership first. Your next mock shows whether it held.');
  assert.match(COPY, /take: `\$\{S\.swot\.plan\[0\]\.label\} first\. Your next mock shows whether it held\.`/);
  // One quiet link, in the SWOT scene only.
  assert.deepEqual(LAB_SCENES.filter((s) => s.link).map((s) => [s.key, s.link.href, s.link.label]), [['swot', '/signup', 'Sign up free and open yours']]);
  assert.doesNotMatch(PAGE, /RECOVERY_HEAD|<MistakeLab /, 'R11: the Recovery section is not drawn');
});

test('every FAQ answer is at most 45 words, in every branch', () => {
  for (const offer of OFFERS) for (const mobLive of [true, false]) {
    const faqs = buildFaqs({ offer, mobLive });
    assert.equal(faqs.length, mobLive ? 5 : 4);
    for (const { question, answer } of faqs) assert.ok(wordCount(answer) <= COPY_BUDGET.faq, `"${question}" is ${wordCount(answer)} words`);
  }
});

test('no middle dots, at most one "not just" contrast, no exclamation marks, no generic kickers above an h2 (product-name stamps only, R3-D2)', () => {
  for (const text of ALL_COPY) {
    assert.doesNotMatch(text, /[·•]/, text);
    assert.doesNotMatch(text, /!/, text);
  }
  assert.ok(ALL_COPY.filter((text) => /not just/i.test(text)).length <= 1, 'one "not just" at most');
  assert.doesNotMatch(PAGE, /className="lp-kicker"/, 'the position band already names each section (T2)');
  assert.doesNotMatch(read('LabCinema.jsx'), /not just/i);
  // R3-D2 (LK114): the two-beat brand voice where it is true.
  assert.match(COPY, /Fix why you missed it\./);
  assert.match(COPY, /'Fix it once\. Check it holds\.'/);
  assert.match(COPY, /'The rest of your prep, one tool at a time\.'/); // R11: the tour's new sub replaces the old three-beat one
});

test('the hero lead names the product in ink and ends with the chapter promise (LK70)', () => {
  const lead = `${HERO_LEAD.strong}${HERO_LEAD.rest}`;
  // R3-D3 (owner LK99, 5 Nov 2026: the lead in two lines at 16-17 px, Preparoo-clean): 72 characters, the same claim.
  // Supersedes the 4 Nov 94-character lead "... with a review that finds the chapter behind every mark you lose."
  // R8 HERO-09, CONT-17 (8 Nov 2026): the subject leads in ink, so the grammar holds and no line ends on "that".
  assert.equal(lead, 'CUET UG mocks that trace every lost mark to its chapter.');
  assert.ok(lead.length <= 76, 'two lines on a 360 px phone');
  assert.ok(wordCount(lead) <= 20);
});

test('the Mob slide and the statement say what they said before, shorter', () => {
  const mob = TOURS[1].find((slide) => slide.id === 'mob');
  assert.match(mob.body, /Start a Mob and share its code\./);
  assert.match(mob.body, /same five questions for 24 hours/);
  assert.match(STATEMENT, /\*MockMob.*\*where.*\*tonight.*\*shortlist/, '"MockMob" is green too (LK102)');
  assert.equal(STATEMENT.split(' ').filter((w) => w.startsWith('*')).length, 4);
});

test('the exam head is 20 words or fewer and names the rehearsal in its h2 without a disclaimer', () => {
  assert.match(EXAM_HEAD.h2, /rehearse exam day/i);
  assert.ok(wordCount(EXAM_HEAD.sub) <= COPY_BUDGET.sub);
  assert.equal(EXAM.questions.length, 5);
});

test('owner 7 Nov 2026: the Pro card and the table name what fixes and revises, in true Pro terms', async () => {
  const { planGroups, PRO_MOBI_CREDITS, VALUE_COPY } = await import('./homeCopy.mjs');
  const { compareRows } = await import('../pricing/planOffer.mjs');
  const wallet = readFileSync(new URL('../../services/credits/aiCreditWallet.js', import.meta.url), 'utf8');
  assert.match(wallet, new RegExp(`AI_PRO_INCLUDED_MONTHLY_CREDITS = ${PRO_MOBI_CREDITS};`), 'the card says the credits Pro really gets');
  const text = (groups) => groups.flatMap((g) => g.lines.map((l) => l.text ?? l.fallback));
  const withCards = planGroups({ keyCards: true });
  assert.deepEqual(withCards.map((g) => g.label), ['Practise', 'Fix', 'Revise', 'Plan']);
  assert.ok(text(withCards).some((t) => /^Mistake Lab across all your mocks/.test(t)));
  assert.ok(text(withCards).includes('Mistake Repair and Ask Mobi: 50 credits a month, all for Mobi'));
  assert.ok(text(withCards).includes('Every Key card, with no daily review cap'));
  assert.ok(!text(planGroups({})).some((t) => /Key card/.test(t)), 'no Key cards line while they are off');
  const rows = Object.fromEntries(compareRows({ keyCards: true }).map(([name, free, pro]) => [name, [free, pro]]));
  assert.deepEqual(rows['Mistake Repair and Ask Mobi'], ['50 credits a month, shared with practice', '50 credits a month, all for Mobi']);
  assert.deepEqual(rows['Key cards'], ['A taste of each chapter', 'Every card']);
  assert.ok(!compareRows({}).some(([name]) => name === 'Key cards'));
  assert.equal(VALUE_COPY.each({ key: 'mocks', perSubject: '₹500' }), '₹500 a subject for 10 to 30 papers, typical');
  // Owner, 7 Nov 2026 (later the same day): "we should add it back in": the punch line under the bars, as before.
  const u = { total: '₹3,750', pro: '₹99', kind: 'monthly' };
  assert.deepEqual({ ...VALUE_COPY.punch(u) }, { usual: '₹3,750 the usual way.', pro: '₹99 a month here.' });
  assert.equal(VALUE_COPY.punch({ ...u, kind: 'once' }).pro, '₹99 once here.');
});

test('owner 7 Nov 2026: the pricing head gives its rate in parts for the pill, and the parts say the sub exactly', () => {
  for (const offer of OFFERS) {
    const head = pricingHead(offer);
    assert.equal(head.h2, 'Start free. Go Pro for unlimited mocks.');
    assert.equal(head.rate.map((part) => part.text).join(''), head.rateText);
    assert.equal(head.note ? `${head.rateText} ${head.note}` : head.rateText, head.sub, 'sub stays the whole line');
    assert.ok(head.rate.some((part) => part.figure), 'a figure in the display face');
    assert.equal(head.rate.filter((part) => part.accent).length, 1, 'one accent');
  }
  assert.equal(pricingHead(OFFERS[0]).note, null, 'monthly: one sentence');
  assert.equal(pricingHead(OFFERS[1]).note, null, 'one-time: the monthly line is said once, in the card (R8 PRICE-06, LK175)');
});
