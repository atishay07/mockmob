// The daily study time on the website (20 Oct 2026, D126 / H1): 10, 20, 30 and More (1 hour, 2 hours, your own in steps of 15
// minutes, no cap from the page), and how the page behaves while the server still holds only 10, 20 or 30.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COPY, LEGACY_MINUTES, MAX_MINUTES, MORE_CHOICES, OWN_MIN, OWN_START, PRESETS, STORE_KEY, cleanMinutes, goalLine, goalMinutesFromResponse, isMinutes,
  isPreset, minutesChip, minutesLong, ownFrom, pickMinutes, readStored, savedMinutesLine, sendableMinutes, stepOwn, stepStop, storedText,
} from '../../src/lib/goalMinutes.mjs';
import { goalSaveBody } from '../../src/components/profile/accountModel.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the three quick choices are unchanged and More offers an hour, two hours and your own', () => {
  assert.deepEqual([...PRESETS], [10, 20, 30]);
  assert.deepEqual(MORE_CHOICES.map((c) => [c.minutes, c.title, c.line]), [
    [60, '1 hour', 'Time for one full mock a day'],
    [120, '2 hours', 'Time for two full mocks a day'],
  ]);
  assert.ok(isPreset(20) && !isPreset(60));
});

test('a kept length is a whole number from 5 to 999, never a string or a float', () => {
  for (const ok of [5, 10, 45, 60, 999]) assert.equal(cleanMinutes(ok), ok);
  for (const bad of [4, 1000, 12.5, '60', null, undefined, NaN, -15]) assert.equal(cleanMinutes(bad), null);
  assert.ok(isMinutes(990) && !isMinutes(0));
});

test('words: long and short forms read as a student would say them', () => {
  assert.equal(minutesLong(45), '45 minutes');
  assert.equal(minutesLong(60), '1 hour');
  assert.equal(minutesLong(90), '1 hour 30 minutes');
  assert.equal(minutesLong(120), '2 hours');
  assert.equal(minutesLong(135), '2 hours 15 minutes');
  assert.equal(minutesLong(61), '1 hour 1 minute');
  assert.equal(minutesChip(10), '10 min');
  assert.equal(minutesChip(60), '1 hour');
  assert.equal(minutesChip(90), '1 h 30');
  assert.equal(minutesChip(120), '2 hours');
  assert.equal(minutesChip(180), '3 hours');
  assert.equal(minutesLong(null), '');
  assert.equal(minutesChip(2), '');
});

test('the stepper moves in 15 minutes, snaps odd values, and stops with a reason', () => {
  assert.equal(stepOwn(90, 1), 105);
  assert.equal(stepOwn(90, -1), 75);
  assert.equal(stepOwn(100, 1), 105);
  assert.equal(stepOwn(100, -1), 90);
  assert.equal(stepOwn(null, 1), OWN_START + 15);
  assert.equal(stepOwn(OWN_MIN, -1), OWN_MIN);
  assert.equal(stepStop(OWN_MIN, -1), '15 minutes is the shortest');
  assert.equal(stepStop(OWN_MIN + 15, -1), '');
  // Walk a long way up: every step is one more 15; an 8 hour day and a 16 hour day are both reachable.
  let n = OWN_START;
  for (let i = 0; i < 100; i += 1) n = stepOwn(n, 1);
  assert.equal(n, MAX_MINUTES);
  assert.ok(MAX_MINUTES <= 999 && MAX_MINUTES % 15 === 0 && MAX_MINUTES >= 16 * 60);
  assert.equal(stepOwn(480, 1), 495);
  assert.equal(stepStop(MAX_MINUTES, 1), '16 hours 30 minutes is the longest a day can hold');
  assert.equal(ownFrom(null), OWN_START);
  assert.equal(ownFrom(100), 105);
  assert.equal(ownFrom(2000), OWN_START);
});

test('the one line under the choices is fixed by the choice and never claims a habit', () => {
  assert.equal(goalLine(20), 'Full mocks are in Practice whenever you want one. Tap More for an hour or longer.');
  assert.equal(goalLine(60), 'One hour fits a full mock, timed like the exam. You can change this any time.');
  assert.equal(goalLine(120), 'Two hours fits two full mocks. A short break between them helps.');
  assert.equal(goalLine(240), 'That is a long day. Short breaks keep it working.');
  assert.equal(goalLine(600), 'That is a long day. Short breaks keep it working.');
  assert.equal(goalLine(null), goalLine(10));
  for (const n of [null, 10, 20, 30, 45, 60, 90, 120, 150, 240]) assert.doesNotMatch(goalLine(n), /usually|you practise about|your pattern/i);
});

test('copy rules: no exclamation marks, no em dashes, no middle dots, no emoji', () => {
  const lines = [...Object.values(COPY), ...MORE_CHOICES.flatMap((c) => [c.title, c.line]), ...[null, 10, 45, 60, 90, 120, 180, 300].map(goalLine),
    savedMinutesLine(60, 'account'), savedMinutesLine(60, 'device', 30), savedMinutesLine(60, 'device'), stepStop(OWN_MIN, -1), stepStop(MAX_MINUTES, 1)];
  for (const line of lines) assert.doesNotMatch(line, /[!—·]|\p{Extended_Pictographic}/u, line);
});

test('what a server that holds only 10, 20 and 30 is sent: the largest it accepts, never above the choice', () => {
  assert.deepEqual([...LEGACY_MINUTES], [10, 20, 30]);
  assert.equal(sendableMinutes(10), 10);
  assert.equal(sendableMinutes(20), 20);
  assert.equal(sendableMinutes(30), 30);
  assert.equal(sendableMinutes(15), 10);
  assert.equal(sendableMinutes(25), 20);
  assert.equal(sendableMinutes(45), 30);
  assert.equal(sendableMinutes(60), 30);
  assert.equal(sendableMinutes(999), 30);
  assert.equal(sendableMinutes(5), 10);
  assert.equal(sendableMinutes('60'), null);
});

test('a goal save says "account" only when the server answered with the same number', () => {
  assert.equal(goalMinutesFromResponse({ daysPerWeek: 4, dailyMinutes: 60 }, 60), 'account');
  assert.equal(goalMinutesFromResponse({ daysPerWeek: 4 }, 60), 'device'); // today's server sends no field
  assert.equal(goalMinutesFromResponse({ daysPerWeek: 4, dailyMinutes: null }, 60), 'device');
  assert.equal(goalMinutesFromResponse({ daysPerWeek: 4, dailyMinutes: 30 }, 60), 'device');
  assert.equal(goalMinutesFromResponse({ daysPerWeek: 4, dailyMinutes: 60, minutesOnAccount: false }, 60), 'device');
  assert.equal(goalMinutesFromResponse(null, 60), 'device');
});

test('a read: the account wins, then this device, else none', () => {
  assert.deepEqual(pickMinutes(90, 60), { minutes: 90, source: 'account' });
  assert.deepEqual(pickMinutes(null, 60), { minutes: 60, source: 'device' });
  assert.deepEqual(pickMinutes(undefined, null), { minutes: null, source: null });
  assert.deepEqual(pickMinutes(2000, 'x'), { minutes: null, source: null });
});

test('the saved line says exactly where the choice is kept', () => {
  assert.equal(savedMinutesLine(60, 'account'), 'Saved. 1 hour a day.');
  assert.equal(savedMinutesLine(120, 'device', 30), '2 hours a day is kept on this device. Your plan uses 30 minutes a day for now.');
  assert.equal(savedMinutesLine(120, 'device'), '2 hours a day is kept on this device.');
  assert.equal(savedMinutesLine(30, 'device', 30), '30 minutes a day is kept on this device.');
});

test('the device copy round-trips and refuses what it should', () => {
  assert.equal(readStored(storedText(120, 5)), 120);
  assert.equal(readStored('{"minutes":"60"}'), null);
  assert.equal(readStored('not json'), null);
  assert.equal(readStored(null), null);
  assert.match(STORE_KEY, /^mm:/);
});

test('a goal save body carries the daily time only when it is a real length', () => {
  assert.deepEqual(goalSaveBody(4, null, Date.now(), [0, 1, 3, 5], 90), { daysPerWeek: 4, pausedUntil: null, weekdays: [0, 1, 3, 5], dailyMinutes: 90 });
  assert.deepEqual(goalSaveBody(4, null, Date.now(), [0, 1, 3, 5]), { daysPerWeek: 4, pausedUntil: null, weekdays: [0, 1, 3, 5] });
  assert.deepEqual(goalSaveBody(4, null, Date.now(), undefined, 12.5), { daysPerWeek: 4, pausedUntil: null });
});

// ---- the store, with a fake server in place of fetch ----
const storeSource = read('src/lib/goalMinutesStore.js');
async function loadStore() {
  // The store imports the app's fetcher by alias; run its logic with a stand-in, through a rewritten copy.
  const patched = storeSource
    .replace("import { api } from '@/lib/fetcher';", 'const api = async () => { throw new Error("no network in tests"); };')
    .replace("from '@/lib/goalMinutes.mjs'", `from '${new URL('../../src/lib/goalMinutes.mjs', import.meta.url).href}'`);
  return import(`data:text/javascript;base64,${Buffer.from(patched).toString('base64')}`);
}
const err = (status, error) => Object.assign(new Error(error), { status, body: { error } });
const fakeServer = ({ goalPut, legacy = false, prefs = {} }) => {
  const log = [];
  const state = { goal: { daysPerWeek: 4 }, prefs: { minutes: 20, revision: 3, state: 'ready', ...prefs } };
  const call = async (path, init) => {
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(init.body) : null;
    log.push([method, path, body]);
    if (path === '/api/me/goal' && method === 'GET') return state.goal;
    if (path === '/api/me/goal' && method === 'PUT') return goalPut(state, body);
    if (path === '/api/study/preferences' && method === 'GET') return state.prefs;
    if (path === '/api/study/preferences' && method === 'PUT') {
      const ok = legacy ? [10, 20, 30].includes(body.minutes) : Number.isInteger(body.minutes) && body.minutes >= 5 && body.minutes <= 999;
      if (!ok) throw err(422, 'INVALID_MINUTES');
      if (body.expectedRevision !== state.prefs.revision) throw err(409, 'REVISION_CONFLICT');
      state.prefs = { ...state.prefs, minutes: body.minutes, revision: state.prefs.revision + 1 };
      return state.prefs;
    }
    throw err(404, 'NOT_FOUND');
  };
  return { call, log, state };
};
const oldGoal = () => { throw err(422, 'invalid_request'); };
const newGoal = (state, body) => { state.goal = { ...state.goal, dailyMinutes: body.dailyMinutes }; return state.goal; };
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test("today's server (10, 20, 30 only): the choice stays on the device, the plan is pointed at 30, and nothing says the account holds it", async () => {
  globalThis.window = { localStorage: memoryStorage() };
  const store = await loadStore();
  const s = fakeServer({ goalPut: oldGoal, legacy: true });
  const result = await store.saveDailyMinutes(120, s.call);
  assert.deepEqual(result, { where: 'device', planMinutes: 30 });
  assert.equal(store.readDeviceMinutes(), 120, "the student's real choice is kept");
  assert.equal(s.state.prefs.minutes, 30, 'the plan was sent what the server accepts');
  for (const [, path, body] of s.log) if (path === '/api/study/preferences' && body) assert.ok([10, 20, 30].includes(body.minutes));
  assert.equal(savedMinutesLine(120, result.where, result.planMinutes), '2 hours a day is kept on this device. Your plan uses 30 minutes a day for now.');
});

test("today's server: a choice the plan already holds is not written again", async () => {
  globalThis.window = { localStorage: memoryStorage() };
  const store = await loadStore();
  const s = fakeServer({ goalPut: oldGoal, legacy: true, prefs: { minutes: 20 } });
  const result = await store.saveDailyMinutes(20, s.call);
  assert.deepEqual(result, { where: 'device', planMinutes: 20 });
  assert.equal(s.log.filter(([m, p]) => m === 'PUT' && p === '/api/study/preferences').length, 0, 'no needless write');
});

test('the widened server: the account holds the real number and the plan is not touched', async () => {
  globalThis.window = { localStorage: memoryStorage() };
  const store = await loadStore();
  const s = fakeServer({ goalPut: newGoal });
  const result = await store.saveDailyMinutes(90, s.call);
  assert.deepEqual(result, { where: 'account', planMinutes: null });
  assert.equal(s.state.goal.dailyMinutes, 90);
  assert.equal(s.log.some(([, p]) => p === '/api/study/preferences'), false);
});

test('a server whose column is not ready (409) keeps the choice on the device', async () => {
  globalThis.window = { localStorage: memoryStorage() };
  const store = await loadStore();
  const s = fakeServer({ goalPut: () => { throw err(409, 'minutes_not_on_account'); } });
  const result = await store.saveDailyMinutes(60, s.call);
  assert.equal(result.where, 'device');
  assert.equal(store.readDeviceMinutes(), 60);
});

test('offline or signed out is an error to show, never a quiet device-only save', async () => {
  globalThis.window = { localStorage: memoryStorage() };
  const store = await loadStore();
  const s = fakeServer({ goalPut: () => { throw Object.assign(new Error('Network error'), { kind: 'network' }); } });
  await assert.rejects(() => store.saveDailyMinutes(60, s.call), /Network error/);
  assert.equal(store.readDeviceMinutes(), null, 'nothing was claimed');
  const out = fakeServer({ goalPut: () => { throw err(401, 'Unauthorized'); } });
  await assert.rejects(() => store.saveDailyMinutes(60, out.call), (e) => e.status === 401);
});

test('a choice kept on the device goes to the account once, when the server learns the field', async () => {
  globalThis.window = { localStorage: memoryStorage() };
  const store = await loadStore();
  store.writeDeviceMinutes(75);
  const s = fakeServer({ goalPut: newGoal });
  assert.equal(await store.promoteDeviceMinutes({ daysPerWeek: 4, dailyMinutes: null }, s.call), 75);
  assert.equal(s.state.goal.dailyMinutes, 75);
  // An older server (no field in the read) is never written to; an account that holds a number is never overwritten.
  const o = fakeServer({ goalPut: oldGoal });
  assert.equal(await store.promoteDeviceMinutes({ daysPerWeek: 4 }, o.call), null);
  assert.equal(o.log.length, 0);
  assert.equal(await store.promoteDeviceMinutes({ daysPerWeek: 4, dailyMinutes: 45 }, s.call), null);
  assert.equal(await store.promoteDeviceMinutes({ daysPerWeek: 4, dailyMinutes: null, minutesOnAccount: false }, s.call), null);
});

test('private windows and blocked storage read as no copy and never throw', async () => {
  globalThis.window = { get localStorage() { throw new Error('blocked'); } };
  const store = await loadStore();
  assert.equal(store.readDeviceMinutes(), null);
  assert.doesNotThrow(() => store.writeDeviceMinutes(60));
});

test('the pages use the shared picker where a student sets the daily time', () => {
  const goal = read('src/components/profile/GoalControl.jsx');
  assert.match(goal, /import DailyMinutes from '@\/components\/goal\/DailyMinutes'/);
  assert.match(goal, /<DailyMinutes/);
  const profile = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.match(profile, />Your goal<\/h2>/);
  const onboarding = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(onboarding, /<DailyMinutes/);
  assert.match(onboarding, /Optional/);
  // The daily time rides with the days only when the student chose one, and a failure of it never blocks the first run.
  assert.match(onboarding, /\.\.\.\(minutes \? \{ dailyMinutes: minutes \} : \{\}\)/);
  const study = read('src/components/study/StudyWorkspace.jsx');
  assert.match(study, /<DailyMinutes/);
  assert.doesNotMatch(study, /STUDY_MINUTES|WEEK_MINUTES/);
});
