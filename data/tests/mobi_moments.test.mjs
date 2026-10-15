import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mobiMoment, entranceAt, isLate, isLateNightHour, underLevel, recapReaction, runMood, answerAct, weekMobi, createTapRun, TAP_CYCLE,
} from '../../src/lib/mobiMoments.js';
import * as ration from '../../src/lib/mobiRation.js';
import { doneReaction } from '../../src/components/study/studyCopy.js';
import { mobiReaction, answerReaction } from '../../src/app/(app)/result/[id]/reaction.js';

const at = (h, m = 0) => new Date(2026, 9, 15, h, m);

test('events name the act, and an unknown event stands at ease', () => {
  assert.equal(mobiMoment('rightAnswer'), 'correct');
  assert.equal(mobiMoment('wrongAnswer'), 'encourage');
  assert.equal(mobiMoment('saveConfirmed'), 'nod');
  assert.equal(mobiMoment('refused'), 'oops');
  assert.equal(mobiMoment('nonsense'), 'idle');
});

test('late night is 11 PM to 5 AM, sleepy until 1 AM and asleep after', () => {
  assert.equal(isLateNightHour(22), false);
  assert.equal(isLateNightHour(23), true);
  assert.equal(isLateNightHour(4), true);
  assert.equal(isLateNightHour(5), false);
  assert.equal(entranceAt(at(22, 59)), 'hello');
  assert.equal(entranceAt(at(23)), 'sleepy');
  assert.equal(entranceAt(at(0, 30)), 'sleepy');
  assert.equal(entranceAt(at(1)), 'sleep');
  assert.equal(entranceAt(at(4, 59)), 'sleep');
  assert.equal(entranceAt(at(5), 'idle'), 'idle');
  assert.equal(isLate(at(2)), true);
});

test('Quiet turns a celebration into a nod, Off into nothing, and leaves every other act alone', () => {
  assert.equal(underLevel('proud', 'quiet'), 'nod');
  assert.equal(underLevel('cheer', 'off'), null);
  assert.equal(underLevel('correct', 'quiet'), 'correct');
  assert.equal(underLevel('correct', 'off'), 'correct');
});

test('the result hero follows the app recap table', () => {
  assert.equal(recapReaction({ tone: 'first_mock' }).act, 'proud');
  assert.equal(recapReaction({ tone: 'higher' }).act, 'cheer');
  assert.equal(recapReaction({ tone: 'lower' }).act, 'encourage');
  assert.equal(recapReaction({ tone: 'held' }).act, 'encourage');
  assert.equal(recapReaction({ tone: 'standard' }).act, 'rest');
  assert.equal(recapReaction({ tone: 'first_mock', celebrations: 'quiet' }).act, 'rest');
  assert.equal(recapReaction({ tone: 'higher', celebrations: 'off' }).act, 'rest');
  assert.equal(recapReaction({ tone: 'lower', celebrations: 'off' }).act, 'encourage');
  assert.equal(recapReaction({ tone: 'higher', isNta: true }), null);
  assert.deepEqual(recapReaction({ tone: 'higher', hour: 23 }), { act: 'sleepy', line: 'Goodnight.' });
  assert.deepEqual(recapReaction({ tone: 'higher', hour: 3 }), { act: 'sleepy', line: 'Goodnight.' });
});

test('the result page asks for the same hero from an attempt, and never in an NTA attempt', () => {
  assert.equal(mobiReaction({ recap: { tone: 'first_mock' } }).act, 'proud');
  assert.equal(mobiReaction({ recap: { tone: 'held' } }).alt.includes('answer keys'), true);
  assert.equal(mobiReaction({ recap: {} }).act, 'rest');
  assert.equal(mobiReaction({ selectionMeta: { mode: 'nta' }, recap: { tone: 'higher' } }), null);
  assert.equal(mobiReaction({ recap: { tone: 'higher' } }, { hour: 2 }).line, 'Goodnight.');
});

test('an opened answer: wrong or blank encourages then points, right hops then reads, held says nothing', () => {
  assert.deepEqual(answerAct('wrong'), { first: 'encourage', then: 'point', glance: false });
  assert.deepEqual(answerAct('blank'), { first: 'encourage', then: 'point', glance: false });
  assert.deepEqual(answerAct('correct'), { first: 'correct', then: 'read', glance: true });
  assert.equal(answerAct('held'), null);
  assert.equal(answerAct(undefined), null);
});

test('opened answers react only in Full, with motion, and one per 2.5 s', () => {
  ration.reset();
  let now = 1_000_000;
  ration.setClock(() => now);
  assert.equal(answerReaction('wrong', { celebrations: 'quiet' }), null);
  assert.equal(answerReaction('wrong', { celebrations: 'off' }), null);
  assert.equal(answerReaction('wrong', { reduced: true }), null);
  assert.equal(answerReaction('wrong').first, 'encourage');
  now += 1000;
  assert.equal(answerReaction('correct'), null, 'a second answer within 2.5 s is browsing, not a reaction');
  now += 1600;
  assert.equal(answerReaction('correct').first, 'correct');
  ration.reset();
});

test('a finished run is proportional (the app runMood)', () => {
  assert.equal(runMood(0, 0), 'cheer');
  assert.equal(runMood(1, 1), 'correct');
  assert.equal(runMood(0, 1), 'encourage');
  assert.equal(runMood(5, 5), 'celebrate');
  assert.equal(runMood(3, 3), 'cheer', 'all right out of fewer than five is a cheer, not a celebration');
  assert.equal(runMood(4, 5), 'cheer');
  assert.equal(runMood(7, 10), 'cheer', 'three in ten not kept is under a third');
  assert.equal(runMood(6, 10), 'encourage', 'four in ten not kept is a third or more');
  assert.equal(runMood(8, 10), 'cheer');
  assert.equal(runMood(2, 6), 'encourage');
});

test('the lesson and review endings say only what the counts say', () => {
  assert.deepEqual(doneReaction(1, 1), { act: 'correct', line: 'That one stuck.' });
  assert.deepEqual(doneReaction(5, 5), { act: 'celebrate', line: 'That one stuck.' });
  assert.equal(doneReaction(3, 3).act, 'cheer');
  assert.equal(doneReaction(3, 3).line, 'That one stuck.');
  assert.deepEqual(doneReaction(4, 5), { act: 'cheer', line: 'Most of it stuck. The rest comes back in review.' });
  assert.equal(doneReaction(1, 4).act, 'encourage');
  assert.equal(doneReaction(0, 0).line, '');
});

test('the week Mobi follows the app rules in order', () => {
  const week = (over) => ({ status: 'open', studyDays: 1, goal: 4, daysLeft: 5, todayPlanned: false, ...over });
  assert.deepEqual(weekMobi(week({ status: 'paused' }), { hour: 12 }), { kind: 'rest', act: 'rest', line: 'Paused. Your run is kept.', lineIsState: true });
  assert.equal(weekMobi(week({ status: 'met', studyDays: 4 }), { hour: 2 }).act, 'proud', 'a met week beats the late-night sleep');
  assert.equal(weekMobi(week(), { hour: 2 }).act, 'sleep');
  assert.equal(weekMobi(week(), { hour: 2 }).wakeLine, 'Sleep well. Tomorrow counts.');
  assert.equal(weekMobi(week(), { hour: 12, returning: true }).act, 'hello');
  assert.equal(weekMobi(week({ daysLeft: 2 }), { hour: 12 }).act, 'encourage', 'three needed, two days left');
  assert.equal(weekMobi(week({ studyDays: 3, daysLeft: 3, todayPlanned: true }), { hour: 12 }).act, 'nudge');
  assert.equal(weekMobi(week({ studyDays: 3, daysLeft: 3, todayPlanned: false }), { hour: 12 }), null, 'on track gets nobody');
  assert.equal(weekMobi(week({ daysLeft: null }), { hour: 12 }), null, 'a week that is not this week has nothing honest to say');
});

test('the tap cycle never repeats an act, restarts after 8 s and stops at six', () => {
  const run = createTapRun(TAP_CYCLE);
  const first = [run.tap(0), run.tap(100), run.tap(200), run.tap(300)];
  assert.deepEqual(first, ['hello', 'tilt', 'hop', 'startle']);
  assert.equal(run.tap(400), 'hello');
  assert.equal(run.tap(500), 'tilt');
  assert.equal(run.tap(600), null, 'six acts are the visit cap');
  const fresh = createTapRun(TAP_CYCLE);
  fresh.tap(0);
  fresh.tap(100);
  assert.equal(fresh.tap(9000), 'hello', 'eight quiet seconds start the cycle over');
});

test('the rations: hello and nudge once a day, a line once a run, a shrug once a run, one reaction per 2.5 s', () => {
  ration.reset();
  let now = new Date(2026, 9, 15, 10).getTime();
  ration.setClock(() => now);
  assert.equal(ration.helloToday('today'), true);
  assert.equal(ration.helloToday('today'), false);
  assert.equal(ration.helloToday('profile'), true, 'each screen has its own hello');
  assert.equal(ration.nudgeToday('today'), true);
  assert.equal(ration.nudgeToday('today'), false);
  now = new Date(2026, 9, 16, 10).getTime();
  assert.equal(ration.helloToday('today'), true, 'a new day, a new hello');
  assert.equal(ration.speakOnce('today'), true);
  assert.equal(ration.speakOnce('today'), false);
  assert.equal(ration.oops('saved'), true);
  assert.equal(ration.oops('saved'), false);
  ration.recovered('saved');
  assert.equal(ration.oops('saved'), true);
  assert.equal(ration.reactNow('k'), true);
  assert.equal(ration.reactNow('k'), false);
  now += 2499;
  assert.equal(ration.reactNow('k'), false);
  now += 2;
  assert.equal(ration.reactNow('k'), true);
  ration.reset();
});

test('a failing retry loop shrugs once, and a new run after 90 s shrugs again', () => {
  ration.reset();
  let now = 5_000_000;
  ration.setClock(() => now);
  assert.equal(ration.oopsRun('list'), true);
  for (let i = 0; i < 5; i += 1) { now += 30_000; assert.equal(ration.oopsRun('list'), false, `retry ${i + 1}`); }
  now += 91_000;
  assert.equal(ration.oopsRun('list'), true);
  ration.reset();
});

test('greeting: asleep late at night, a hello the first time today, then idle', () => {
  ration.reset();
  let now = new Date(2026, 9, 15, 10).getTime();
  ration.setClock(() => now);
  assert.equal(ration.greeting('today'), 'hello');
  assert.equal(ration.greeting('today'), 'idle');
  now = new Date(2026, 9, 15, 23, 40).getTime();
  assert.equal(ration.greeting('today'), 'sleepy');
  now = new Date(2026, 9, 16, 3).getTime();
  assert.equal(ration.greeting('today'), 'sleep');
  ration.reset();
});
