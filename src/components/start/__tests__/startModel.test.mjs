// node --test src/components/start/__tests__/startModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TEST_MODES } from '../../../../data/test_modes.js';
import { CUET_PUBLIC_ALLOWED_SUBJECTS } from '../../../../data/cuet_controls.js';
import { learningPlan } from '../../../../data/learning_engine.js';
import {
  SESSION, SUBJECT_ART, START_SUBJECTS, artBox, balanceLine, costLine, dragOffset, dragOutcome, heroFromPlan, heroReason, morphFrom,
  pickSubject, practiceHref, safeHref, sheetTitle, springEasing, startRequestFromSearch, startRows, startSubjects, subjectArt, subjectName,
} from '../startModel.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const startDir = join(here, '..');

test('session facts come from TEST_MODES', () => {
  assert.equal(SESSION.quickCost, 10, 'the 10-question set; Quick practice is 1 credit a question');
  assert.equal(SESSION.quickCostPerQuestion, 1);
  assert.equal(SESSION.fullCost, TEST_MODES.full.creditCost);
  assert.equal(SESSION.fullCount, 50);
  assert.equal(SESSION.fullMinutes, 60);
  assert.equal(SESSION.ntaCount, TEST_MODES.nta.fixedCount);
  assert.equal(SESSION.ntaMinutes, 60);
  assert.equal(SESSION.quickMinutes, 10);
  assert.equal(SESSION.ntaPro, true);
});

test('the sheet knows every public CUET subject, in the same order, each with an object on disk', () => {
  assert.deepEqual(START_SUBJECTS.map((s) => s.id), [...CUET_PUBLIC_ALLOWED_SUBJECTS]);
  const files = new Set(readdirSync(join(startDir, 'art')));
  for (const s of START_SUBJECTS) {
    assert.ok(SUBJECT_ART[s.art], `${s.id} has art metadata`);
    assert.ok(files.has(`obj-${s.art}.webp`), `${s.id} has its object file`);
  }
  for (const name of Object.keys(SUBJECT_ART)) assert.ok(files.has(`obj-${name}.webp`), `${name} file exists`);
});

test('subjects: aliases, unknown ids and order', () => {
  assert.equal(subjectName('gat'), 'General Test');
  assert.equal(subjectName('business_studies'), 'Business Studies');
  assert.equal(subjectName('teaching_aptitude'), '');
  assert.equal(subjectArt('bst').name, 'business');
  assert.equal(subjectArt('hindi'), null);
  assert.deepEqual(startSubjects(['economics', 'gat', 'economics', 'hindi', { id: 'english' }]), ['economics', 'general_test', 'english']);
  assert.equal(startSubjects(['english', 'economics', 'accountancy', 'business_studies', 'history', 'geography', 'physics']).length, 5);
  assert.equal(pickSubject(['economics', 'english'], 'english'), 'english');
  assert.equal(pickSubject(['economics', 'english'], 'physics'), 'economics');
  assert.equal(pickSubject([], 'physics'), null);
});

test('artBox keeps the object whole and puts the shadow under its foot', () => {
  const a = SUBJECT_ART.biology;
  const box = artBox(a, 64, 64);
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 64 && box.y + box.height <= 64);
  assert.ok(box.shadow.y > box.y + box.height * 0.8);
  assert.equal(artBox(null, 64), null);
  assert.equal(artBox(a, 0), null);
});

test('artBox on one floor: a wide and a tall object end on the same line', () => {
  const opts = { pad: 0.04, align: 'bottom' };
  const wide = artBox(SUBJECT_ART.accountancy, 48, 48, opts);
  const tall = artBox(SUBJECT_ART.business, 48, 48, opts);
  assert.equal(Math.round(wide.y + wide.height), Math.round(tall.y + tall.height));
  assert.ok(wide.width >= 36 && tall.height >= 36, 'chip objects read at 36 px and up');
  assert.ok(wide.y >= 0 && tall.y >= 0);
});

test('cost lines say what is spent against the real balance', () => {
  assert.deepEqual(costLine('quick', { balance: 40 }), { text: 'Uses 10 of your 40 practice credits.', tone: 'cost' });
  assert.deepEqual(costLine('full', { balance: 40 }), { text: 'Uses 50 practice credits. You have 40.', tone: 'short' });
  assert.deepEqual(costLine('quick', { balance: null }), { text: 'Uses 10 practice credits.', tone: 'cost' });
  assert.deepEqual(costLine('quick', { balance: 10 }), { text: 'Uses 10 of your 10 practice credits.', tone: 'cost' });
  // Quick practice is 1 credit a question, so a count changes the line; Pro and the Pro-only modes ignore it.
  assert.deepEqual(costLine('quick', { balance: 40, count: 5 }), { text: 'Uses 5 of your 40 practice credits.', tone: 'cost' });
  assert.deepEqual(costLine('quick', { balance: 12, count: 15 }), { text: 'Uses 15 practice credits. You have 12.', tone: 'short' });
  assert.deepEqual(costLine('quick', { balance: null, count: 20, short: true }), { text: '20 credits', tone: 'cost' });
  assert.deepEqual(costLine('quick', { balance: null, count: 7 }), { text: 'Uses 10 practice credits.', tone: 'cost' }, 'a count Quick does not offer is priced as the default set, as the server resolves it');
  assert.deepEqual(costLine('quick', { pro: true, count: 20 }), { text: 'Included with Pro.', tone: 'included' });
  assert.deepEqual(costLine('full', { balance: 400, count: 5 }), { text: 'Uses 50 of your 400 practice credits.', tone: 'cost' }, 'a Full mock is 50 whatever count is passed');
  assert.deepEqual(costLine('nta', { balance: 400 }), { text: 'Needs Pro.', tone: 'locked' });
  assert.deepEqual(costLine('nta', { pro: true }), { text: 'Included with Pro.', tone: 'included' });
  assert.deepEqual(costLine('full', { pro: true, balance: 0 }), { text: 'Included with Pro.', tone: 'included' });
  assert.equal(balanceLine({ balance: 1 }), 'You have 1 practice credit');
  assert.equal(balanceLine({ balance: null }), null);
  assert.equal(balanceLine({ pro: true }), 'Pro: practice and mocks are included');
});

test('practice links open Practice set up, never the test itself', () => {
  assert.equal(practiceHref({ subject: 'gat', mode: 'quick', count: 10 }), '/dashboard?subject=general_test&mode=quick&count=10');
  assert.equal(practiceHref({ mode: 'full' }), '/dashboard?mode=full');
  assert.equal(practiceHref({ subject: 'economics', mode: 'nta', screen: 'nta' }), '/dashboard?subject=economics&mode=nta&interface=nta');
  assert.equal(safeHref('https://evil.example/x'), null);
  assert.equal(safeHref('//evil.example'), null);
  assert.equal(safeHref('/recovery?episode=1'), '/recovery?episode=1');
});

test('the hero is the live plan, with the chosen subject added to a bare practice link', () => {
  const plan = learningPlan({ minutes: 10 });
  const hero = heroFromPlan(plan, { subject: 'economics', balance: 40 });
  // START-1017 D3: plain practice follows the chosen subject, so its title names it (the plan's own title is kept too).
  assert.equal(hero.followsSubject, true);
  assert.equal(hero.title, '10 Economics questions');
  assert.equal(hero.planTitle, plan.primary.title);
  assert.equal(heroFromPlan(plan, { subject: 'accountancy' }).title, '10 Accountancy questions');
  // Plain practice: the planner's own reason (recovery release state) never reaches the student.
  assert.equal(hero.reason, 'About 10 minutes. Then see why each miss happened.', 'the title names the set, so the line does not repeat the count');
  assert.doesNotMatch(hero.reason, /recovery|calibration|ordinary|concept/i);
  assert.equal(hero.href, '/dashboard?mode=quick&count=10&subject=economics');
  assert.equal(hero.quick, true);
  assert.equal(hero.subject, 'economics');
  assert.equal(hero.cost.text, 'Uses 10 of your 40 practice credits.');
  assert.equal(hero.eyebrow, undefined, 'the card heading says it; no kicker above it');
  const keyed = heroFromPlan(plan, { subject: 'economics', tonightKey: 'tonight-start-r1x' });
  assert.equal(keyed.href, '/dashboard?mode=quick&count=10&subject=economics&tonightKey=tonight-start-r1x&tonightMinutes=10');
  assert.equal(heroFromPlan(plan, { subject: 'economics', tonightKey: 'bad key' }).href, '/dashboard?mode=quick&count=10&subject=economics');

  const withConcepts = heroFromPlan(learningPlan({ minutes: 10, availableConcepts: ['c1'], attempts: [{ subject: 'economics', details: [] }] }), { subject: 'economics' });
  assert.equal(withConcepts.kind, 'ordinary_practice');
  assert.equal(withConcepts.reason, 'About 10 minutes. Then see why each miss happened.');
  assert.equal(heroFromPlan(learningPlan({ minutes: 20 }), { subject: 'economics' }).reason, 'About 20 minutes. Then see why each miss happened.');
  assert.equal(heroReason({ kind: 'ordinary_practice' }, { count: 20 }), '20 questions, about 20 minutes. Then see why each miss happened.');
  assert.equal(heroFromPlan(learningPlan({ minutes: 30 }), { subject: 'economics' }).reason, 'About 20 minutes, then 10 minutes on why each miss happened.');
  assert.equal(heroReason({ kind: 'repair', reason: 'Pick up the activity you started.' }), 'Pick up the activity you started.');
  assert.equal(heroReason({ kind: 'repair' }), null);

  const resume = heroFromPlan({ primary: { kind: 'resume_session', title: 'Resume your practice', href: '/test?subject=economics&mode=quick&sessionId=s1', reason: 'Your active session is waiting.' } });
  assert.equal(resume.reason, 'Your active session is waiting.');
  assert.equal(resume.cta, 'Resume');
  assert.equal(resume.graphic, 'resume');
  assert.equal(resume.cost, null);
  assert.equal(resume.followsSubject, false, 'a resume is fixed: it sits above the rail and keeps its title');
  assert.equal(resume.title, 'Resume your practice');
  const linked = heroFromPlan({ primary: { kind: 'ordinary_practice', title: 'Practise Accountancy', href: '/dashboard?subject=accountancy&mode=quick&count=10' } }, { subject: 'economics' });
  assert.equal(linked.followsSubject, false, 'a plan link that names its subject does not follow the chips');
  assert.equal(linked.title, 'Practise Accountancy');
  assert.equal(heroFromPlan({ primary: { kind: 'repair', title: 'x', href: 'javascript:alert(1)' } }), null);
  assert.equal(heroFromPlan(null), null);
});

test('rows: Quick practice folds into a hero that is already 10 questions; NTA says Pro on Free', () => {
  const plan = learningPlan({ minutes: 10 });
  const merged = startRows({ plan, subjects: ['accountancy', 'economics'], subject: 'economics', balance: 40 });
  // Every mode the app offers is a button in the sheet (owner F5): the exam pair, then By chapter and Smart practice.
  assert.deepEqual(merged.rows.map((r) => r.id), ['full', 'nta', 'chapter', 'smart']);
  assert.equal(merged.choose.href, '/dashboard');
  assert.equal(merged.section, 'Or start something else');
  // Every session is a button with a go mark that says where it goes: start a session, or open Practice.
  assert.deepEqual([...merged.rows, merged.choose].map((r) => r.go), ['start', 'start', 'start', 'start', 'open']);
  // Each one says what pressing it does.
  assert.deepEqual([...merged.rows, merged.choose].map((r) => r.action), ['Set up', 'Set up', 'Pick chapters', 'Set up', 'Open']);
  assert.equal(merged.rows[2].href, '/dashboard?subject=economics&mode=quick&count=10&pick=chapters');
  assert.equal(merged.rows[3].href, '/dashboard?subject=economics&mode=smart');
  assert.equal(merged.rows[3].cost.text, 'Needs Pro');
  assert.equal(merged.rows[3].tag, 'Pro');
  // The exam pair's tiles carry the short cost, two lines at most in a half-width tile on a phone.
  assert.deepEqual(merged.rows[0].cost, { text: '50 credits. You have 40.', tone: 'short' });
  assert.equal(merged.rows[0].detail, '50 Economics questions, 60 minutes, a new paper every time');
  assert.equal(merged.rows[0].graphic, 'stopwatch');
  assert.equal(merged.rows[1].detail, 'The exam-day screen in Economics, 50 questions in 60 minutes');
  assert.equal(merged.rows[1].graphic, 'exam');

  // A fixed hero (a resume) stays above the rail: the Quick practice row comes back and the label names the subject.
  const fixed = startRows({ plan: { primary: { kind: 'resume_session', title: 'Finish your recall session', href: '/recall?session=r1', reason: '7 cards left.' } }, subjects: ['accountancy', 'economics'], subject: 'economics', balance: 40 });
  assert.equal(fixed.hero.followsSubject, false);
  assert.deepEqual(fixed.rows.map((r) => r.id), ['quick', 'full', 'nta', 'chapter', 'smart']);
  assert.equal(fixed.section, 'Or start in Economics');
  assert.equal(startRows({ plan: null, subjects: ['economics'] }).section, 'Pick a session');

  const twenty = startRows({ plan: learningPlan({ minutes: 20 }), subjects: ['accountancy'], balance: 40 });
  assert.deepEqual(twenty.rows.map((r) => r.id), ['quick', 'full', 'nta', 'chapter', 'smart']);
  const quick = twenty.rows[0];
  assert.equal(quick.href, '/dashboard?subject=accountancy&mode=quick&count=10');
  assert.equal(quick.detail, '10 Accountancy questions, about 10 minutes');

  const loading = startRows({ plan: null, subjects: ['economics'], balance: 40 });
  assert.equal(loading.hero, null);
  assert.deepEqual(loading.rows.map((r) => r.id), ['quick', 'full', 'nta', 'chapter', 'smart']);
  const nta = loading.rows.find((r) => r.id === 'nta');
  assert.equal(nta.tag, 'Pro', 'locked on Free: an outlined Pro tag on the tile, and the cost line says Needs Pro');
  assert.equal(nta.href, '/dashboard?subject=economics&mode=nta&interface=nta');
  assert.equal(nta.cost.text, 'Needs Pro');
  const ntaPro = startRows({ plan: null, subjects: ['economics'], pro: true }).rows.find((r) => r.id === 'nta');
  assert.equal(ntaPro.tag, null, 'Pro: no tag');
  assert.equal(ntaPro.cost.text, 'Included with Pro');
});

test('copy rules: sentence case, no exclamation mark, no em dash', () => {
  const texts = [];
  for (const pro of [false, true]) {
    for (const minutes of [10, 20, 30]) {
      const m = startRows({ plan: learningPlan({ minutes }), subjects: ['accountancy', 'economics'], subject: 'accountancy', pro, balance: 4 });
      if (m.hero) texts.push(m.hero.eyebrow, m.hero.cta, m.hero.cost?.text);
      for (const r of [...m.rows, m.choose]) texts.push(r.title, r.detail, r.cost?.text, r.tag);
    }
  }
  const sheet = readFileSync(join(startDir, 'StartSheet.jsx'), 'utf8');
  texts.push(sheetTitle(new Date(2026, 9, 17, 9)), sheetTitle(new Date(2026, 9, 17, 21)));
  assert.ok(sheet.includes('sheetTitle(new Date())'), 'the title follows the clock');
  for (const literal of ['Subject', 'Or start something else', 'Pick a session', 'Nothing is spent here. Practice shows the cost again before you start.', 'Your next move could not be loaded. The sessions below still work.', 'Try again', 'Opens Practice']) {
    assert.ok(sheet.includes(literal), literal);
    texts.push(literal);
  }
  for (const t of texts.filter(Boolean)) {
    assert.ok(!t.includes('!'), t);
    assert.ok(!t.includes('—'), t);
    assert.ok(t === t.replace(/^[a-z]/, (c) => c.toUpperCase()), `sentence case: ${t}`);
  }
});

test('motion helpers', () => {
  const m = morphFrom({ left: 10, top: 10, width: 200, height: 48 }, { left: 248, top: 100, width: 520, height: 600 });
  assert.ok(m.transform.startsWith('translate('));
  assert.equal(morphFrom(null, { left: 0, top: 0, width: 1, height: 1 }), null);
  assert.equal(dragOutcome({ dy: 200, velocity: 0, height: 600 }), 'close');
  assert.equal(dragOutcome({ dy: 40, velocity: 1.2, height: 600 }), 'close');
  assert.equal(dragOutcome({ dy: 40, velocity: 0.1, height: 600 }), 'settle');
  assert.equal(dragOutcome({ dy: 10, velocity: 3, height: 600 }), 'settle');
  assert.equal(dragOffset(50), 50);
  assert.ok(dragOffset(-100) > -30 && dragOffset(-100) < 0);
  const curve = springEasing({ zeta: 0.72 });
  assert.match(curve, /^linear\(0, /);
  assert.ok(curve.endsWith(', 1)'));
  const values = curve.slice(7, -1).split(', ').map(Number);
  assert.ok(Math.max(...values) > 1 && Math.max(...values) < 1.08, 'a small overshoot');
});

test('the sheet title follows the clock (tonight from 4 PM)', () => {
  assert.equal(sheetTitle(new Date(2026, 9, 17, 15, 59)), 'Pick today’s work');
  assert.equal(sheetTitle(new Date(2026, 9, 17, 16, 0)), 'Pick tonight’s work');
  assert.equal(sheetTitle(new Date(2026, 9, 17, 23, 30)), 'Pick tonight’s work');
  assert.equal(sheetTitle(new Date('nope')), 'Pick today’s work');
});

test('?start= requests', () => {
  assert.deepEqual(startRequestFromSearch('?start=quick'), { row: 'quick' });
  assert.deepEqual(startRequestFromSearch('?start=open'), { row: null });
  assert.deepEqual(startRequestFromSearch('?start=bogus'), { row: null });
  assert.equal(startRequestFromSearch('?view=today'), null);
  assert.equal(startRequestFromSearch(''), null);
});
