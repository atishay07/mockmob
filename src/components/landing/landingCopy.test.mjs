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
  for (const [name, src] of SOURCES) assert.doesNotMatch(stripComments(src), banned, name);
});

test('the hero bank line keeps every fact in one sentence and says Pro has no cap', () => {
  const line = read('QuestionBankLine.jsx');
  assert.match(line, /SUBJECT_CLAIM\.long\},/);
  assert.match(line, /no fixed set to run out of, no cap on Pro\./);
  assert.match(line, /each built fresh from one live bank of/);
  assert.match(line, /each built fresh from one live question bank/);
  assert.match(line, /bank\.questions\.toLocaleString\('en-IN'\)/, 'the count is the live one');
});

test('"unlimited mocks" on Pro stays true only while the Pro list says unlimited', () => {
  assert.match(COPY, /h2: 'Start free\. Go Pro for unlimited mocks\.'/);
  assert.match(PAGE, /pricingHead\(OFFER\)/, 'the page renders the pricing head from homeCopy');
  assert.ok(proPlan().includes('Unlimited Quick practice and Full mock'), 'the Pro list still promises unlimited papers');
  assert.match(read('../../app/pricing/page.js'), /\['Full mocks', [^\n]*'Unlimited'\],\n\s+\['Quick practice', '1 credit a question', 'Unlimited'\],/);
});

test('"from the official key, or not at all" stays true: a disagreement gives no repair and no charge', () => {
  assert.match(COPY, /Written from the official key, or not written at all\./);
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
  assert.deepEqual(TOURS[1].map((s) => s.id), ['arena', 'repair', 'learn', 'replay', 'radar', 'prepos', 'compass', 'combo', 'rival', 'mob'], 'no tool was cut');
  assert.deepEqual(TOURS[0].map((s) => s.id), ['arena', 'repair', 'replay', 'radar', 'prepos', 'compass', 'combo', 'rival'], 'Learn and the Mob appear only while they are live');
});

test('a Lab or Recovery step is at most 45 words, with its numbers inside the mock screen', () => {
  for (const scene of LAB_SCENES) {
    const words = wordCount(`${scene.title} ${scene.body} ${scene.take}`);
    assert.ok(words <= COPY_BUDGET.step, `${scene.key}: ${words} words`);
  }
  for (const step of RECOVERY_STEPS) assert.ok(wordCount(`${step.title} ${step.body}`) <= COPY_BUDGET.step, step.key);
  assert.equal(LAB_SCENES.length, 4);
  assert.equal(RECOVERY_STEPS.length, 4);
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
  assert.match(COPY, /'Practise\. Replay\. Repair\. /);
});

test('the hero lead names the product in ink and ends with the chapter promise (LK70)', () => {
  const lead = `${HERO_LEAD.strong}${HERO_LEAD.rest}`;
  assert.equal(lead, 'MockMob is CUET UG mock tests with a review that finds the chapter behind every mark you lose.');
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
