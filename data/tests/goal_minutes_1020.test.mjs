// Long daily goals on the server (20 Oct 2026). The app keeps any whole number of minutes from 5 to 999 on the phone; the server held
// 10, 20 or 30 and rounded the rest. This file holds: the one pure rule (data/goal_minutes.js), the guided plan at every length
// (and that 10, 20 and 30 read exactly as before), the study preferences, tonight's record, the migration and its undo against a real
// Postgres (PGlite), the goal route and store against a fake PostgREST (before and after the column exists), and the website's goal card.
// Run: node --test data/tests/goal_minutes_1020.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import {
  GOAL_MINUTES_MAX, GOAL_MINUTES_MIN, allocateMinutes, goalMinutesOr, isGoalMinutes, minutesLine, parseDailyMinutes, practiceFor,
} from '../goal_minutes.js';
import { guidedSequence, preferences } from '../study_engine.js';
import { learningPlan, practiceForMinutes } from '../learning_engine.js';
import { tonightCompletion, tonightMetadata } from '../study_progress.js';
import { buildMove } from '../../src/lib/today/move.mjs';
import {
  GOAL_COPY, GOAL_MINUTES_CHIPS, goalErrorLine, goalFromServer, goalMinutesLabel, goalMinutesLine, goalSaveBody, parseMinutesInput,
} from '../../src/components/profile/accountModel.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

// ---------------------------------------------------------------- the rule

test('a daily goal is a whole number from 5 to 999, and nothing else', () => {
  assert.equal(GOAL_MINUTES_MIN, 5);
  assert.equal(GOAL_MINUTES_MAX, 999);
  for (const ok of [5, 6, 10, 45, 60, 120, 240, 999]) assert.equal(isGoalMinutes(ok), true, String(ok));
  for (const bad of [4, 0, -5, 1000, 1500, 20.5, '20', null, undefined, NaN, Infinity, true, [], {}]) assert.equal(isGoalMinutes(bad), false, String(bad));
  assert.equal(goalMinutesOr('45'), 45);
  assert.equal(goalMinutesOr(' 45 '), 45);
  assert.equal(goalMinutesOr('4'), null);
  assert.equal(goalMinutesOr('1000'), null);
  assert.equal(goalMinutesOr('abc', 10), 10);
  assert.equal(goalMinutesOr(0, 10), 10);
  assert.equal(goalMinutesOr(NaN, 10), 10);
  assert.equal(goalMinutesOr(120, 10), 120);
});

test('a PUT body: absent keeps, null clears, a number is checked', () => {
  assert.deepEqual(parseDailyMinutes({}), { ok: true, minutes: undefined });
  assert.deepEqual(parseDailyMinutes(null), { ok: true, minutes: undefined });
  assert.deepEqual(parseDailyMinutes({ dailyMinutes: null }), { ok: true, minutes: null });
  assert.deepEqual(parseDailyMinutes({ dailyMinutes: 45 }), { ok: true, minutes: 45 });
  for (const bad of [4, 1000, 20.5, '45', true, {}]) assert.equal(parseDailyMinutes({ dailyMinutes: bad }).ok, false, String(bad));
});

test('the words: 45 minutes, 1 hour, 1 hour 30 minutes', () => {
  assert.equal(minutesLine(5), '5 minutes');
  assert.equal(minutesLine(1), '1 minute');
  assert.equal(minutesLine(45), '45 minutes');
  assert.equal(minutesLine(60), '1 hour');
  assert.equal(minutesLine(90), '1 hour 30 minutes');
  assert.equal(minutesLine(120), '2 hours');
  assert.equal(minutesLine(0), '');
});

test('practice size: 10, 20 and 30 are what they always were; every other length follows the same rule', () => {
  assert.deepEqual([10, 20, 30].map((m) => practiceFor(m)), [{ count: 10, review: 0 }, { count: 20, review: 0 }, { count: 20, review: 10 }]);
  assert.deepEqual(practiceFor(5), { count: 5, review: 0 });
  assert.deepEqual(practiceFor(15), { count: 15, review: 0 });
  assert.deepEqual(practiceFor(45), { count: 20, review: 25 });
  assert.deepEqual(practiceFor(60), { count: 20, review: 30 });
  assert.deepEqual(practiceFor(999), { count: 20, review: 30 }, 'never one enormous review block');
  for (const bad of [0, 4, 1000, NaN, undefined, null, 'x']) assert.deepEqual(practiceFor(bad), { count: 10, review: 0 }, String(bad));
  for (let m = 5; m <= 999; m += 1) {
    const { count, review } = practiceFor(m);
    assert.ok(count >= 5 && count <= 20 && review >= 0 && review <= 30 && count + review <= m, String(m));
  }
  // the old name still answers, with the same rule
  assert.deepEqual(practiceForMinutes(45), practiceFor(45));
});

test('time shared between recall, lesson and practice: the three old tables are kept, every length adds up and none is empty', () => {
  assert.deepEqual([10, 20, 30].map(allocateMinutes), [[2, 3, 5], [4, 6, 10], [5, 10, 15]]);
  for (let m = 5; m <= 999; m += 1) {
    const [recall, learn, practice] = allocateMinutes(m);
    assert.equal(recall + learn + practice, m, String(m));
    assert.ok(recall >= 1 && learn >= 1 && practice >= 1, String(m));
  }
  assert.deepEqual(allocateMinutes(5), [1, 2, 2]);
  assert.deepEqual(allocateMinutes(60), [12, 18, 30]);
  assert.deepEqual(allocateMinutes(undefined), [4, 6, 10], 'no length reads as 20, as before');
  assert.deepEqual(allocateMinutes(7777), [4, 6, 10]);
});

// ---------------------------------------------------------------- the guided plan

// The guidedSequence that shipped before this change, kept verbatim, so "10, 20 and 30 read exactly as before" is a comparison and not a belief.
const STEP_COPY = {
  recall: { purpose: 'Keeps what you have learned from fading before the exam.', done: 'Done when each card is answered or rated.' },
  learn: { purpose: 'Understand one concept, then try it straight away.', done: 'Done when you finish the lesson and its checks.' },
  resume_study: { purpose: 'Pick up from your last saved action.', done: 'Nothing you did is lost.' },
  ordinary_practice: { purpose: 'Apply what you know under exam-style marking.', done: 'Done when you submit; your result shows the chapters to fix.' },
};
function oldGuidedSequence(plan, study, minutes = 20) {
  const allocation = { 10: [2,3,5], 20: [4,6,10], 30: [5,10,15] }[minutes] || [4,6,10];
  const sequence = [];
  const add = step => sequence.push({ ...STEP_COPY[step.kind], ...step });
  if (plan.primary?.kind==='resume_session') add({ ...plan.primary, estimatedMinutes: allocation[2] });
  if (study.active) add({ kind: 'resume_study', title: study.active.mode === 'learn' ? `Finish your lesson${study.active.title ? `: ${study.active.title}` : ''}` : 'Finish your recall session', href: `/study/${study.active.id}`, reason: 'Continue from your last saved action.', estimatedMinutes: allocation[study.active.mode==='learn'?1:0], mode: study.active.mode });
  if (['fresh_check','repair'].includes(plan.primary?.kind)) add({ ...plan.primary, estimatedMinutes: allocation[2] });
  if (study.active?.mode!=='recall' && study.queue?.items.length) {
    const due = study.queue.dueCount, fresh = study.queue.items.length - Math.min(due, study.queue.items.length);
    add({ kind: 'recall', title: due ? `Review ${Math.min(due, study.queue.items.length)} due ${due === 1 ? 'card' : 'cards'}` : `Lock in ${fresh} new ${fresh === 1 ? 'card' : 'cards'}`, href: '/learn?recall=due', reason: study.queue.pausedNew ? 'Clear part of your review backlog first; new cards wait until it is smaller.' : due ? 'These are due now. Answer from memory first, then check.' : 'Cards from lessons you have read. Answer from memory first, then check.', estimatedMinutes: allocation[0] });
  }
  if (study.active?.mode!=='learn' && study.nextUnit) add({ kind: 'learn', title: `Learn: ${study.nextUnit.title}`, href: `/learn/${study.nextUnit.id}`, reason: study.nextUnit.reason || 'A short lesson with worked examples and a quick check.', estimatedMinutes: allocation[1], subject: study.nextUnit.subject, chapter: study.nextUnit.chapter });
  if (!sequence.some(s => ['resume_session','fresh_check','repair'].includes(s.kind))) {
    const chapter = study.nextUnit?.chapter && study.nextUnit?.subject ? study.nextUnit : null;
    add(plan.primary?.kind==='ordinary_practice' && sequence.length
      ? { ...plan.primary, title: `Practise ${allocation[2]} questions`, href: `/dashboard?mode=quick&count=${allocation[2]}${chapter ? `&${new URLSearchParams({ subject: chapter.subject, chapter: chapter.chapter })}` : ''}`, reason: `About ${allocation[2]} minutes of exam-style questions${chapter ? ` from ${chapter.chapter}` : ''}. Access and cost are shown before you start.`, estimatedMinutes: allocation[2] }
      : { ...plan.primary, estimatedMinutes: allocation[2] });
  }
  return sequence;
}

const practicePlan = (minutes) => learningPlan({ minutes, attempts: [], availableConcepts: [] });
const unit = { id: 'u-ratio', title: 'Ratios in accounts', subject: 'accountancy', chapter: 'Ratios', reason: 'Your last paper lost marks here.' };
const queue = (dueCount, n = 6, extra = {}) => ({ items: Array.from({ length: n }, (_, i) => ({ id: i })), dueCount, pausedNew: false, ...extra });
const SCENARIOS = {
  'recall, lesson and practice': () => ({ plan: practicePlan(20), study: { active: null, queue: queue(4), nextUnit: unit } }),
  'a lesson only': () => ({ plan: practicePlan(20), study: { active: null, queue: null, nextUnit: unit } }),
  'cards only, new ones': () => ({ plan: practicePlan(20), study: { active: null, queue: queue(0, 3), nextUnit: null } }),
  'nothing but practice': () => ({ plan: practicePlan(20), study: { active: null, queue: null, nextUnit: null } }),
  'a lesson in progress': () => ({ plan: practicePlan(20), study: { active: { id: 'run1', mode: 'learn', title: 'Ratios' }, queue: queue(2), nextUnit: unit } }),
  'a recall in progress': () => ({ plan: practicePlan(20), study: { active: { id: 'run2', mode: 'recall' }, queue: queue(2), nextUnit: unit } }),
  'an unfinished session': () => ({ plan: { primary: { kind: 'resume_session', title: 'Resume your practice', href: '/test?sessionId=s1', reason: 'Your active session is waiting.', duration: 20 } }, study: { active: null, queue: queue(3), nextUnit: unit } }),
  'a fresh check due': () => ({ plan: { primary: { kind: 'fresh_check', title: 'Take your fresh check', href: '/recovery?episode=e1', reason: 'This check is due.', duration: 20 } }, study: { active: null, queue: queue(3), nextUnit: unit } }),
  'a repair': () => ({ plan: { primary: { kind: 'repair', title: 'Continue your reasoning repair', href: '/recovery?episode=e2', reason: 'Pick up.', duration: 20 } }, study: { active: null, queue: null, nextUnit: null } }),
};

test('10, 20 and 30 minutes: the plan is the one that shipped before, step for step', () => {
  for (const [name, make] of Object.entries(SCENARIOS)) {
    for (const minutes of [10, 20, 30]) {
      const { plan, study } = make();
      assert.deepEqual(guidedSequence(plan, study, minutes, { attempts: 12 }), oldGuidedSequence(plan, study, minutes), `${name} at ${minutes}`);
    }
    const { plan, study } = make();
    assert.deepEqual(guidedSequence(plan, study), oldGuidedSequence(plan, study), `${name} with no length`);
  }
});

test('every length from 5 to 999 makes a plan: sized to Quick practice, never longer than the goal, never an enormous step', () => {
  for (let minutes = 5; minutes <= 999; minutes += 1) {
    for (const [name, make] of Object.entries(SCENARIOS)) {
      const { plan, study } = make();
      const seq = guidedSequence(plan, study, minutes, { attempts: 12 });
      assert.ok(seq.length >= 1 && seq.length <= 9, `${name} ${minutes}: ${seq.length} steps`);
      for (const step of seq) {
        assert.ok(Number.isInteger(step.estimatedMinutes) && step.estimatedMinutes >= 1, `${name} ${minutes}: ${step.kind} ${step.estimatedMinutes}`);
        assert.ok(step.estimatedMinutes <= 30, `${name} ${minutes}: ${step.kind} claims ${step.estimatedMinutes} minutes`);
        const count = Number(new URLSearchParams(step.href.split('?')[1] || '').get('count'));
        if (step.href.startsWith('/dashboard?mode=quick')) assert.ok(count >= 1 && count <= 20, `${name} ${minutes}: ${step.href}`);
      }
      assert.ok(seq.every((s) => typeof s.href === 'string' && s.href.startsWith('/')), `${name} ${minutes}`);
    }
    // the plain case adds up to the goal and no further, so "About X min" never promises more time than the student has
    const { plan, study } = SCENARIOS['recall, lesson and practice']();
    const total = guidedSequence(plan, study, minutes, { attempts: 12 }).reduce((sum, s) => sum + s.estimatedMinutes, 0);
    assert.ok(total <= minutes, `${minutes}: the plan adds up to ${total}`);
  }
});

test('a goal of 15, 45 and 60 minutes gives the plan its own shape', () => {
  const { plan, study } = SCENARIOS['recall, lesson and practice']();
  const shape = (minutes, attempts = 12) => guidedSequence(plan, study, minutes, { attempts }).map((s) => [s.kind, s.estimatedMinutes]);
  assert.deepEqual(shape(15), [['recall', 2], ['learn', 5], ['ordinary_practice', 8]]);
  // 45: a lesson, recall and 20 questions fill 42 of the 45 minutes; three minutes are not worth a step of their own
  assert.deepEqual(shape(45), [['recall', 8], ['learn', 14], ['ordinary_practice', 20]]);
  // 60: 48 minutes of the steps, then the other 12 go to the mistakes in the saved papers
  assert.deepEqual(shape(60), [['recall', 10], ['learn', 18], ['ordinary_practice', 20], ['review', 12]]);
  // no saved papers: nothing to review, so the same 12 minutes go to more questions
  assert.deepEqual(shape(60, 0), [['recall', 10], ['learn', 18], ['ordinary_practice', 20], ['ordinary_practice', 12]]);
  const practice = guidedSequence(plan, study, 15, { attempts: 12 }).at(-1);
  assert.equal(practice.title, 'Practise 8 questions');
  assert.equal(practice.href, '/dashboard?mode=quick&count=8&subject=accountancy&chapter=Ratios');
});

test('a long goal adds a review of the mistakes (only when there are papers) and up to three more sets, so the plan grows with the goal', () => {
  const { plan, study } = SCENARIOS['recall, lesson and practice']();
  const long = guidedSequence(plan, study, 180, { attempts: 12 });
  assert.deepEqual(long.map((s) => s.kind), ['recall', 'learn', 'ordinary_practice', 'review', 'ordinary_practice', 'ordinary_practice', 'ordinary_practice']);
  assert.equal(long.find((s) => s.kind === 'review').href, '/review');
  assert.equal(long.find((s) => s.kind === 'review').estimatedMinutes, 30);
  assert.equal(long.filter((s) => s.kind === 'ordinary_practice').length, 4, 'the set, and three more');
  assert.ok(long.reduce((n, s) => n + s.estimatedMinutes, 0) <= 180);
  // no saved papers yet: nothing to review, so no review step
  assert.ok(!guidedSequence(plan, study, 180, { attempts: 0 }).some((s) => s.kind === 'review'));
  assert.ok(!guidedSequence(plan, study, 180).some((s) => s.kind === 'review'));
  // the longest goal is still a plan of a few steps, each of real size
  const longest = guidedSequence(plan, study, 999, { attempts: 40 });
  assert.ok(longest.length <= 8);
  assert.ok(longest.reduce((n, s) => n + s.estimatedMinutes, 0) < 999);
  // the copy for the new step reads in the owner's voice: full sentences, no exclamation mark, no dash
  const review = long.find((s) => s.kind === 'review');
  for (const text of [review.title, review.reason, review.purpose, review.done]) assert.doesNotMatch(text, /!|—|·/);
});

test('the plan itself: the length it carries and the practice it names, for any length', () => {
  assert.equal(learningPlan({ minutes: 45 }).minutes, 45);
  assert.equal(learningPlan({ minutes: 5 }).minutes, 5);
  assert.equal(learningPlan({ minutes: 999 }).minutes, 999);
  for (const bad of [1000, 4, NaN, 0, undefined]) assert.equal(learningPlan({ minutes: bad }).minutes, 10, String(bad));
  assert.equal(learningPlan({}).minutes, 10);
  const p45 = learningPlan({ minutes: 45 });
  assert.equal(p45.primary.href, '/dashboard?mode=quick&count=20');
  assert.match(p45.primary.reason, /20 questions, about 20 minutes, then 25 minutes reviewing your mistakes/);
  assert.equal(learningPlan({ minutes: 15 }).primary.href, '/dashboard?mode=quick&count=15');
  assert.equal(learningPlan({ minutes: 5 }).primary.title, 'Start 5 practice questions');
  assert.equal(learningPlan({ minutes: 999 }).primary.href, '/dashboard?mode=quick&count=20');
  assert.equal(learningPlan({ minutes: 20 }).primary.href, '/dashboard?mode=quick&count=20');
});

// ---------------------------------------------------------------- study preferences and tonight

test('study preferences keep any length from 5 to 999 and refuse the rest; the weekly plan too', () => {
  for (const minutes of [5, 10, 17, 45, 120, 999]) assert.equal(preferences({ minutes }).minutes, minutes);
  for (const bad of [4, 1000, 0, -20, 20.5, '20', NaN]) assert.throws(() => preferences({ minutes: bad }), /INVALID_MINUTES/, String(bad));
  const plan = (minutes) => Array.from({ length: 7 }, () => ({ subject: 'english', minutes }));
  assert.equal(preferences({ weeklyPlan: plan(45) }, undefined, true).weeklyPlan[0].minutes, 45);
  assert.equal(preferences({ weeklyPlan: plan(5) }, undefined, true).weeklyPlan[6].minutes, 5);
  for (const bad of [4, 1000, 20.5]) assert.throws(() => preferences({ weeklyPlan: plan(bad) }, undefined, true), /INVALID_WEEKLY_PLAN/, String(bad));
  assert.throws(() => preferences({ weeklyPlan: plan(45) }, undefined, false), /PREMIUM_REQUIRED/);
});

test('tonight: a session started from a plan of any length is recorded against it', () => {
  const key = 'tonight-key-abcdef123456';
  const at = Date.UTC(2026, 9, 20, 12);
  // the practice a plan names is the practice that is recorded: 10 -> 10, 45 -> 20, 5 -> 5
  for (const minutes of [5, 10, 15, 20, 30, 45, 60, 120, 999]) {
    const { count } = practiceFor(minutes);
    const meta = tonightMetadata({ tonightKey: key, tonightMinutes: String(minutes), mode: 'quick', count }, at);
    assert.equal(meta.tonight.minutes, minutes, String(minutes));
    assert.deepEqual(tonightMetadata({ tonightKey: key, tonightMinutes: String(minutes), mode: 'quick', count: count + 1 }, at), {}, `${minutes}: a different count is not tonight's practice`);
  }
  assert.deepEqual(tonightMetadata({ tonightKey: key, tonightMinutes: '4', mode: 'quick', count: 10 }, at), {});
  assert.deepEqual(tonightMetadata({ tonightKey: key, tonightMinutes: '1000', mode: 'quick', count: 20 }, at), {});
  assert.deepEqual(tonightMetadata({ tonightKey: key, tonightMinutes: '45', mode: 'full', count: 20 }, at), {});
  const done = (minutes, count) => [{ id: 'a1', completedAt: at, selectionMeta: { scoringVersion: 'server_practice_v1', ...tonightMetadata({ tonightKey: key, tonightMinutes: String(minutes), mode: 'quick', count }, at) } }];
  assert.deepEqual(tonightCompletion(done(10, 10), at + 1000), { state: 'recorded', sessionId: 'a1', minutes: 10, completedAt: at, reviewMinutes: 0 });
  assert.equal(tonightCompletion(done(30, 20), at + 1000).reviewMinutes, 10, 'the 30-minute record is unchanged');
  assert.equal(tonightCompletion(done(45, 20), at + 1000).reviewMinutes, 25);
  assert.equal(tonightCompletion(done(5, 5), at + 1000).minutes, 5);
});

test('Today: the move follows the plan\'s own length (the daily goal), and 10, 20 and 30 are unchanged', () => {
  const papers = [{ id: 'p1', subject: 'economics', questions: 20, completedAt: Date.UTC(2026, 9, 19, 12), score: 40 }];
  const move = (planMinutes, minutes = null) => buildMove({
    plan: { ...practicePlan(planMinutes), minutes: planMinutes }, papers, rhythm: { counts: { sessions: 3 } }, facts: { sessions: 3, mocks: 1 },
    repaired: new Map(), revise: { due: 0 }, minutes, now: Date.UTC(2026, 9, 20, 12),
  });
  assert.equal(move(10).id, 'practice');
  assert.equal(move(10).number, 10);
  assert.equal(move(20).number, 20);
  assert.equal(move(30).number, 20);
  assert.equal(move(30).key.minutes, 30, '20 questions and 10 of review is still 30 minutes');
  assert.equal(move(5).number, 5);
  assert.equal(move(15).number, 15);
  assert.equal(move(45).number, 20);
  assert.equal(move(45).key.minutes, 45, '20 questions and 25 minutes on what you missed');
  assert.equal(move(999).number, 20);
  assert.ok(move(999).key.minutes <= 50, 'the card never promises a 999-minute set');
  assert.equal(move(45, 10).number, 10, 'a length chosen on the card still wins');
  assert.equal(move(1000).number, 10, 'a length outside the range reads as the default');
});

// ---------------------------------------------------------------- the migration, on a real Postgres

const prefsSql = read('supabase/migrations/20261012121000_app_preferences_and_rhythm.sql');
const weekdaysSql = read('supabase/migrations/20261016110000_study_weekdays.sql');
const roadSql = read('supabase/migrations/20261017150000_study_road_fields.sql');
const migration = read('supabase/migrations/20261020110000_study_goal_daily_minutes.sql');
const undo = read('supabase/undo/20261020110000_study_goal_daily_minutes.undo.sql');
const roadUndo = read('supabase/undo/20261017150000_study_road_fields.undo.sql');

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key, name text not null default 'x'); insert into public.users(id) values ('u1'),('u2'),('u3');");
  await db.exec(prefsSql);
  await db.exec(weekdaysSql);
  await db.exec(roadSql);
  return db;
}
const columns = async (db) => (await db.query("select column_name from information_schema.columns where table_name='study_goals'")).rows.map((r) => r.column_name);

test('migration: applies twice, changes no existing row, keeps 5 to 999 and refuses the rest', async () => {
  const db = await setup();
  try {
    await db.exec("insert into study_goals(user_id, days_per_week, weekday_mask, exam_date, mock_target) values ('u1', 6, 43, '2027-05-01', 12), ('u2', 3, null, null, null)");
    const before = (await db.query('select * from study_goals order by user_id')).rows;
    await db.exec(migration);
    await db.exec(migration); // idempotent
    assert.ok((await columns(db)).includes('daily_minutes'));
    const after = (await db.query('select * from study_goals order by user_id')).rows;
    assert.equal(after.length, 2);
    for (let i = 0; i < before.length; i += 1) {
      assert.equal(after[i].daily_minutes, null, 'every existing row keeps null');
      const { daily_minutes: _none, ...rest } = after[i];
      assert.deepEqual(rest, before[i], 'nothing else on the row changes');
    }
    for (const ok of [5, 6, 45, 999]) { await db.exec(`update study_goals set daily_minutes = ${ok} where user_id = 'u1'`); assert.equal((await db.query("select daily_minutes m from study_goals where user_id='u1'")).rows[0].m, ok); }
    await db.exec("update study_goals set daily_minutes = null where user_id = 'u1'");
    for (const bad of [0, 4, 1000, -5]) await assert.rejects(db.exec(`update study_goals set daily_minutes = ${bad} where user_id = 'u1'`), /check/i, String(bad));
    // a goal saved the way the API saves it: one upsert
    await db.exec("insert into study_goals(user_id, daily_minutes) values ('u3', 90) on conflict (user_id) do update set daily_minutes = excluded.daily_minutes");
    assert.deepEqual((await db.query("select days_per_week d, daily_minutes m from study_goals where user_id='u3'")).rows[0], { d: 4, m: 90 });
    // still service-role only
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select daily_minutes from study_goals'), /permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('undo: removes the column and its check, keeps the goal, and the migration can be applied again', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    await db.exec("insert into study_goals(user_id, days_per_week, weekday_mask, daily_minutes) values ('u1', 4, 43, 90)");
    await db.exec(undo);
    await db.exec(undo); // idempotent
    const cols = await columns(db);
    assert.ok(!cols.includes('daily_minutes'));
    for (const kept of ['days_per_week', 'weekday_mask', 'exam_date', 'mock_target', 'paused_until']) assert.ok(cols.includes(kept), kept);
    assert.deepEqual((await db.query("select days_per_week d, weekday_mask m from study_goals where user_id='u1'")).rows[0], { d: 4, m: 43 });
    assert.equal((await db.query("select count(*)::int n from pg_constraint where conname = 'study_goals_daily_minutes_range'")).rows[0].n, 0);
    await db.exec(migration);
    assert.ok((await columns(db)).includes('daily_minutes'));
    // the other column groups' undo files still work with this one present
    await db.exec(roadUndo);
    assert.ok((await columns(db)).includes('daily_minutes'));
  } finally { await db.close(); }
});

test('the migration is additive: no drop, no delete, no rewrite of existing rows, and it names its undo', () => {
  const sql = migration.replace(/^--.*$/gm, '');
  assert.doesNotMatch(sql, /\bdrop\b|\bdelete\b|\btruncate\b|\bupdate\b/i);
  assert.match(sql, /add column if not exists daily_minutes smallint/);
  assert.match(migration, /supabase\/undo\/20261020110000_study_goal_daily_minutes\.undo\.sql/);
  assert.match(undo, /drop column if exists daily_minutes/);
  assert.match(undo, /drop constraint if exists study_goals_daily_minutes_range/);
});

// ---------------------------------------------------------------- the goal route and store, against a fake PostgREST

const HOOKS = `
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
const ROOT = ${JSON.stringify(pathToFileURL(`${root}/`).href)};
const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__fakeSupabase;',
  '@/lib/auth': 'export const auth = async () => globalThis.__session;',
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) };',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  return next(url, context);
}
`;

// The part of PostgREST the goal store uses, over plain maps. `hasMinutes: false` is a database that has not had the migration:
// a select of the column, or an upsert that carries it, fails the way PostgREST does.
function fakeSupabase({ hasMinutes = true, goals = {} } = {}) {
  const tables = { study_goals: new Map(Object.entries(goals)), notification_prefs: new Map(), study_goal_history: [] };
  const log = [];
  const missing = { code: 'PGRST204', message: "Could not find the 'daily_minutes' column of 'study_goals' in the schema cache" };
  const defaults = (row) => ({ days_per_week: 4, timezone: 'Asia/Kolkata', paused_until: null, weekday_mask: null, exam_date: null, mock_target: null, ...(hasMinutes ? { daily_minutes: null } : {}), ...row });
  return {
    log, tables,
    from(name) {
      const state = { op: 'select', columns: '*', row: null, id: null };
      const run = () => {
        log.push({ table: name, op: state.op, columns: state.columns, row: state.row && { ...state.row } });
        if (name === 'study_goal_history') {
          if (state.op === 'upsert') {
            for (const w of state.row) { const i = tables.study_goal_history.findIndex((h) => h.user_id === w.user_id && h.effective_week === w.effective_week); if (i >= 0) tables.study_goal_history[i] = w; else tables.study_goal_history.push(w); }
            return { data: null, error: null };
          }
          return { data: tables.study_goal_history.filter((h) => h.user_id === state.id), error: null };
        }
        const table = tables[name];
        if (name === 'study_goals' && !hasMinutes && (state.columns === 'daily_minutes' || (state.op === 'upsert' && 'daily_minutes' in state.row))) return { data: null, error: missing };
        if (state.op === 'upsert') {
          const was = table.get(state.row.user_id);
          const next = name === 'study_goals' ? defaults({ ...(was || {}), ...state.row }) : { ...(was || {}), ...state.row };
          table.set(state.row.user_id, next);
          return { data: { ...next }, error: null };
        }
        const row = table.get(state.id);
        const data = row ? (state.columns === '*' ? { ...row } : Object.fromEntries(state.columns.split(',').map((c) => [c.trim(), row[c.trim()] ?? null]))) : null;
        return { data, error: null };
      };
      const builder = {
        select(columns) { state.columns = columns; return builder; },
        upsert(row) { state.op = 'upsert'; state.row = row; return builder; },
        eq(_c, id) { state.id = id; return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle: async () => run(),
        single: async () => run(),
        then(resolveFn, rejectFn) { return Promise.resolve(run()).then(resolveFn, rejectFn); },
      };
      return builder;
    },
  };
}

let routes;
async function loadRoute() {
  if (routes) return routes;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  routes = await import(pathToFileURL(resolve(root, 'src/app/api/me/goal/route.js')).href);
  return routes;
}
const as = (userId) => { globalThis.__session = userId ? { user: { id: userId } } : null; };
const put = (route, body) => route.PUT(new Request('http://localhost/api/me/goal', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const get = (route) => route.GET(new Request('http://localhost/api/me/goal'));
const reply = async (response) => ({ status: response.status, body: await response.json() });

test('goal route: the daily goal is read and written with the days, and an older app is not disturbed', async () => {
  const route = await loadRoute();
  globalThis.__fakeSupabase = fakeSupabase();
  as('u1');
  // a new account: the goal has no daily time yet
  assert.deepEqual(await reply(await get(route)), { status: 200, body: { daysPerWeek: 4, timezone: 'Asia/Kolkata', pausedUntil: null, weekdays: null, dailyMinutes: null } });
  // the app saves 45 minutes alone: the days stay at the default and nothing else moves
  assert.equal((await reply(await put(route, { dailyMinutes: 45 }))).body.dailyMinutes, 45);
  const alone = await reply(await get(route));
  assert.equal(alone.body.dailyMinutes, 45);
  assert.equal(alone.body.daysPerWeek, 4);
  // days and time together, in one write
  const both = await reply(await put(route, { daysPerWeek: 3, weekdays: [0, 2, 4], dailyMinutes: 90 }));
  assert.deepEqual([both.status, both.body.daysPerWeek, both.body.weekdays, both.body.dailyMinutes], [200, 3, [0, 2, 4], 90]);
  // an older app saves the days only: the daily time is kept, never cleared
  const older = await reply(await put(route, { daysPerWeek: 3, pausedUntil: null }));
  assert.deepEqual([older.status, older.body.dailyMinutes, older.body.weekdays], [200, 90, [0, 2, 4]]);
  // minutes alone leave the days, the plan and a pause as they are
  const pausedDay = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  await put(route, { daysPerWeek: 3, pausedUntil: pausedDay });
  const quiet = await reply(await put(route, { dailyMinutes: 120 }));
  assert.deepEqual([quiet.body.dailyMinutes, quiet.body.daysPerWeek, quiet.body.pausedUntil, quiet.body.weekdays], [120, 3, pausedDay, [0, 2, 4]]);
  // the edges, and a clear
  assert.equal((await reply(await put(route, { dailyMinutes: 5 }))).body.dailyMinutes, 5);
  assert.equal((await reply(await put(route, { dailyMinutes: 999 }))).body.dailyMinutes, 999);
  assert.equal((await reply(await put(route, { dailyMinutes: null }))).body.dailyMinutes, null);
  assert.equal((await reply(await get(route))).body.dailyMinutes, null);
});

test('goal route: a daily goal outside 5 to 999 is refused with a sentence, and nothing is written', async () => {
  const route = await loadRoute();
  const sb = fakeSupabase();
  globalThis.__fakeSupabase = sb;
  as('u1');
  for (const bad of [4, 0, -10, 1000, 45.5, '45', true, [45], {}]) {
    const r = await reply(await put(route, { dailyMinutes: bad }));
    assert.equal(r.status, 422, JSON.stringify(bad));
    assert.equal(r.body.message, 'Choose between 5 and 999 minutes a day.');
    const withDays = await reply(await put(route, { daysPerWeek: 4, dailyMinutes: bad }));
    assert.equal(withDays.status, 422, `${JSON.stringify(bad)} with days`);
  }
  assert.equal(sb.log.filter((l) => l.op === 'upsert').length, 0, 'a refused goal writes nothing');
  // the days rule is as strict as it was
  assert.equal((await reply(await put(route, { daysPerWeek: 9 }))).status, 422);
  assert.equal((await reply(await put(route, {}))).status, 422);
  assert.equal((await reply(await put(route, '[]'))).status, 422);
});

test('goal route: signed out is 401, and the user is always the session user', async () => {
  const route = await loadRoute();
  const sb = fakeSupabase();
  globalThis.__fakeSupabase = sb;
  as(null);
  assert.equal((await put(route, { dailyMinutes: 45 })).status, 401);
  assert.equal((await get(route)).status, 401);
  as('u2');
  await put(route, { dailyMinutes: 45, userId: 'u9', user_id: 'u9' });
  assert.deepEqual([...sb.tables.study_goals.keys()], ['u2']);
});

test('goal route: before the migration the days still save, the time answers null, and a minutes-only save says so (409)', async () => {
  const route = await loadRoute();
  const sb = fakeSupabase({ hasMinutes: false, goals: { u1: { user_id: 'u1', days_per_week: 4, timezone: 'Asia/Kolkata', paused_until: null, weekday_mask: null } } });
  globalThis.__fakeSupabase = sb;
  as('u1');
  assert.equal((await reply(await get(route))).body.dailyMinutes, null);
  const withDays = await reply(await put(route, { daysPerWeek: 3, weekdays: [0, 2, 4], dailyMinutes: 90 }));
  assert.deepEqual([withDays.status, withDays.body.daysPerWeek, withDays.body.weekdays, withDays.body.dailyMinutes, withDays.body.minutesOnAccount], [200, 3, [0, 2, 4], null, false]);
  assert.equal(sb.tables.study_goals.get('u1').days_per_week, 3, 'the days were saved');
  const alone = await reply(await put(route, { dailyMinutes: 90 }));
  assert.equal(alone.status, 409);
  assert.equal(alone.body.error, 'minutes_not_on_account');
  // an older app that never sends minutes is untouched by all of this
  const older = await reply(await put(route, { daysPerWeek: 5 }));
  assert.deepEqual([older.status, older.body.daysPerWeek], [200, 5]);
  assert.equal('minutesOnAccount' in older.body, false);
});

test('the learning plan reads the daily goal without ever failing the plan', async () => {
  await loadRoute(); // puts the module loader in place
  const store = await import(pathToFileURL(resolve(root, 'src/lib/server/appPrefs.js')).href);
  globalThis.__fakeSupabase = fakeSupabase({ goals: { u1: { user_id: 'u1', days_per_week: 4, daily_minutes: 75 }, u2: { user_id: 'u2', days_per_week: 4, daily_minutes: null } } });
  assert.equal(await store.getDailyMinutes('u1'), 75);
  assert.equal(await store.getDailyMinutes('u2'), null);
  assert.equal(await store.getDailyMinutes('nobody'), null);
  globalThis.__fakeSupabase = fakeSupabase({ hasMinutes: false, goals: { u1: { user_id: 'u1', days_per_week: 4 } } });
  assert.equal(await store.getDailyMinutes('u1'), null, 'a database without the column is no goal, not an error');
  globalThis.__fakeSupabase = { from() { throw new Error('storage down'); } };
  assert.equal(await store.getDailyMinutes('u1'), null);
  // a stored value outside the range (an old writer, a manual edit) reads as none
  assert.equal(store.goalOut({ days_per_week: 4, daily_minutes: 2000 }).dailyMinutes, null);
  assert.equal(store.goalOut({ days_per_week: 4, daily_minutes: 45 }).dailyMinutes, 45);
  assert.equal(store.goalOut(null).dailyMinutes, null);
});

test('source: the plan no longer clamps to 10, 20 and 30, and says who decides the length', () => {
  const learning = read('src/lib/server/learning.js');
  assert.doesNotMatch(learning, /\[10, ?20, ?30\]/);
  assert.match(learning, /minutes = goalMinutesOr\(minutes, null\)/);
  // the order: the length asked for, the Pro plan's day, the account's daily goal, the usual length in the preferences
  assert.ok(learning.indexOf('goalMinutesOr(weekly?.minutes, null)') < learning.indexOf('getDailyMinutes(userId)'));
  assert.ok(learning.indexOf('getDailyMinutes(userId)') < learning.indexOf('?? usual'));
  assert.match(learning, /guidedSequence\(plan,study,plan\.minutes,\{attempts:attempts\.length\}\)/);
  assert.match(learning, /return \{ \.\.\.withActions, goalMinutes,/);
  for (const file of ['data/study_engine.js', 'data/learning_engine.js', 'data/study_progress.js']) {
    assert.doesNotMatch(read(file).replace(/\/\/.*$/gm, ''), /\[10, ?20, ?30\]\.includes\((minutes|d\.minutes|Number\(minutes\)|plan\?\.minutes)\)|\[10,20,30\]\.includes/, file);
  }
});

// ---------------------------------------------------------------- the website

test('the goal card: reads the daily time, saves it with or without the days, and never says "saved" for what the account did not keep', () => {
  assert.deepEqual(goalFromServer({ daysPerWeek: 4, weekdays: [0, 1, 3, 5], dailyMinutes: 45 }), { days: 4, set: true, pausedUntil: null, weekdays: [0, 1, 3, 5], dailyMinutes: 45 });
  assert.equal(goalFromServer({ daysPerWeek: 4 }).dailyMinutes, null, 'a server that sends none (an older deploy) is no daily time');
  for (const bad of [4, 1000, 45.5, '45', null]) assert.equal(goalFromServer({ daysPerWeek: 4, dailyMinutes: bad }).dailyMinutes, null, String(bad));
  assert.deepEqual(goalSaveBody(4, null, Date.now(), [0, 1, 3, 5], 45), { daysPerWeek: 4, pausedUntil: null, weekdays: [0, 1, 3, 5], dailyMinutes: 45 });
  assert.deepEqual(goalSaveBody(4, null, Date.now(), [0, 1, 3, 5]), { daysPerWeek: 4, pausedUntil: null, weekdays: [0, 1, 3, 5] });
  assert.equal('dailyMinutes' in goalSaveBody(4, null, Date.now(), undefined, 3), false, 'an out-of-range time is never sent');
  assert.deepEqual(GOAL_MINUTES_CHIPS, [10, 20, 30, 45, 60, 90, 120]);
  assert.ok(GOAL_MINUTES_CHIPS.every(isGoalMinutes));
  assert.deepEqual(GOAL_MINUTES_CHIPS.map(goalMinutesLabel), ['10 min', '20 min', '30 min', '45 min', '1 hour', '90 min', '2 hours']);
  assert.equal(parseMinutesInput('45'), 45);
  assert.equal(parseMinutesInput(' 5 '), 5);
  assert.equal(parseMinutesInput('999'), 999);
  for (const bad of ['', '4', '0', '1000', '4.5', '-45', 'abc', '45m', null, undefined]) assert.equal(parseMinutesInput(bad), null, String(bad));
  assert.equal(goalMinutesLine(45, 4), '45 minutes a day. With 4 study days that is 3 hours a week.');
  assert.equal(goalMinutesLine(10, 1), '10 minutes a day. With 1 study day that is 10 minutes a week.');
  assert.equal(goalMinutesLine(90, 2), '1 hour 30 minutes a day. With 2 study days that is 3 hours a week.');
  assert.equal(goalMinutesLine(300, 5), `5 hours a day. With 5 study days that is 25 hours a week. ${GOAL_COPY.minutesBigDay}`);
  assert.doesNotMatch(goalMinutesLine(240, 7), /big day/, 'four hours is not yet a big day');
  assert.equal(goalMinutesLine(3, 4), '');
  assert.match(goalErrorLine({ status: 422 }), /1 to 7/);
  assert.match(goalErrorLine({ status: 409 }), /daily time/);
  for (const line of [GOAL_COPY.minutesQuestion, GOAL_COPY.minutesOwn, GOAL_COPY.minutesRange, GOAL_COPY.minutesNotSet, GOAL_COPY.minutesBigDay, GOAL_COPY.minutesNotSaved]) {
    assert.doesNotMatch(line, /!|—|·/, line);
    assert.match(line, /[a-z]/);
  }
});

test('the website: the goal card carries the daily time, the usual-length controls keep it in step, and the preview serves it', () => {
  const card = read('src/components/profile/GoalControl.jsx');
  assert.match(card, /GOAL_MINUTES_CHIPS\.map/);
  assert.match(card, /role="radiogroup"/);
  assert.match(card, /\{ dailyMinutes: sentMinutes \}/, 'the time alone is its own write');
  assert.match(card, /goalSaveBody\(sent\.length, goal\.pausedUntil, Date\.now\(\), sent, sentMinutes\)/);
  assert.match(card, /GOAL_COPY\.minutesNotSaved/);
  assert.match(read('src/app/(app)/profile/ProfilePageClient.jsx'), />Your goal<\/h2>/);
  // changing the usual length on Today, on the plan card or in the study preferences moves the daily goal with it, when the account holds one
  assert.match(read('src/app/(app)/today/page.jsx'), /data\.plan\.data\?\.goalMinutes != null/);
  assert.match(read('src/components/LearningNextAction.jsx'), /plan\.goalMinutes!=null/);
  assert.match(read('src/components/study/StudyWorkspace.jsx'), /goal\.dailyMinutes !== minutes/);
  assert.match(read('src/components/start/startModel.mjs'), /isGoalMinutes\(Number\(plan\?\.minutes\)\)/);
  assert.match(read('src/app/preview/arena/ArenaPreviewClient.jsx'), /dailyMinutes: Number\(fixture\.get\('minutes'\)\) \|\| null/);
});
