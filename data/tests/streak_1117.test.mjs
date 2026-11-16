// Lane streak (17 Nov 2026, LK296): the personal daily chain is THE daily streak, for every signed-in student.
//   S2/S9 one day rule: a whole Daily Five and a finished repair count (merged in JS, no SQL), a repair never makes a make-up alone
//   S3 rest passes and the cap (bug 6), S4 the make-up in words, S5 the week marks, S6 milestones tied to real work,
//   S8 pause days through the API, S10 the dead streakDays gone, and the copy rule (no guilt words).
// Run: node --test data/tests/streak_1117.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAY_GOAL, MAKE_UP_GOAL, PASS_MAX, STREAK_MILESTONES, computeChain } from '../../src/lib/chain/chain.mjs';
import { createChainService, mergeStreakDays } from '../../src/lib/server/chain.js';
import { dailyFiveStreakDays, readStreakExtras, repairStreakDays } from '../../src/lib/server/streakDays.js';
import { handleStreak, streakBody } from '../../src/lib/server/streak.js';
import {
  chipLabel, makeUpLine, milestoneLine, milestoneMoment, noticeLine, passLine, passRule, makeUpRule, pauseLine, pauseSetLine, ruleLine,
  statusLine, streakWeek, weekLegend,
} from '../../src/lib/streak/streakCopy.mjs';
import { DenCopy } from '../../src/lib/mob/v3/denCopy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const DAY = 86_400_000;
const T = '2026-11-17';
const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const run = (from, n, answered = 6) => Array.from({ length: n }, (_, i) => ({ day: add(from, i), answered }));
const chain = (daily, more = {}) => computeChain({ daily, today: T, ...more });
const NOW = Date.parse(`${T}T12:00:00+05:30`);

// ---------- S2: one day rule ----------

test('a whole Daily Five makes a streak day (its 5 answers); four places do not', () => {
  const five = dailyFiveStreakDays([1, 2, 3, 4, 5].map((n) => ({ session_id: `daily:${add(T, -1)}`, n: String(n) })));
  assert.deepEqual(five, [{ day: add(T, -1), answered: 5, source: 'daily' }]);
  assert.deepEqual(dailyFiveStreakDays([1, 2, 3, 4].map((n) => ({ session_id: `daily:${add(T, -1)}`, n }))), []);
  assert.deepEqual(dailyFiveStreakDays([{ session_id: 'practice:x', n: 1 }]), []);
  assert.equal(chain(mergeStreakDays([], five)).days, 1);
});

test('a finished repair makes its IST day count but adds no answers', () => {
  // 20:00 UTC on the 15th is 1:30 am IST on the 16th.
  const days = repairStreakDays([{ updated_at: '2026-11-15T20:00:00Z' }, { updated_at: '2026-11-16T09:00:00Z' }]);
  assert.deepEqual(days, [{ day: '2026-11-16', answered: 0, counts: true, source: 'repair' }]);
  const c = chain(mergeStreakDays([], days));
  assert.equal(c.days, 1);
  assert.equal(c.run.answered, 0, 'a repair is not counted as questions');
});

test('a repair today counts today; Daily Five plus practice add up across sources', () => {
  assert.equal(chain([{ day: T, answered: 0, counts: true }]).today.done, true);
  assert.equal(chain([{ day: T, answered: 2 }, { day: T, answered: 3 }]).today.done, true);
  assert.equal(chain([{ day: T, answered: 4 }]).today.done, false);
});

test('a repair never makes a 10-answer make-up on its own', () => {
  const base = run(add(T, -3), 1); // one day, then a gap yesterday-but-one
  const withRepair = chain(mergeStreakDays(base, [{ day: add(T, -1), answered: 0, counts: true }]));
  // the repair makes yesterday count by itself (a normal day), but a make-up needs 10 real answers
  const open = chain([...run(add(T, -3), 1)]);
  assert.equal(open.makeUp?.needed, MAKE_UP_GOAL);
  const madeUp = chain([...run(add(T, -3), 1), { day: T, answered: 0, counts: true }]);
  assert.ok(madeUp.makeUp, 'the open day stays open: the repair adds no answers toward the make-up');
  assert.ok(withRepair.days >= 1);
});

test('the chain service merges the extra days, keeps the SQL rows for the Mob, and survives a failed extra read', async () => {
  const rpc = async (name) => (name === 'chain_state' ? { daily: [{ day: add(T, -1), answered: 6 }], pauses: [], fixes: [], hidden: false, best_days: 0, seen: [] } : null);
  const extraDays = async () => [{ day: add(T, -2), answered: 5 }, { day: T, answered: 0, counts: true }];
  const svc = createChainService({ rpc, now: () => NOW, extraDays });
  const r = await svc.read('u1');
  assert.equal(r.body.days, 3);
  assert.deepEqual(r.daily, [{ day: add(T, -1), answered: 6 }], 'the unlock checks still read only the SQL rows');
  const failing = createChainService({ rpc, now: () => NOW, extraDays: async () => { throw new Error('down'); } });
  assert.equal((await failing.get('u1')).days, 1);
});

test('readStreakExtras asks for the right rows and turns them into days; a failed read is []', async () => {
  const calls = [];
  const builder = (table, rows) => {
    const q = { calls: [] };
    for (const m of ['select', 'eq', 'is', 'gte', 'order', 'not']) q[m] = (...a) => { q.calls.push([m, ...a]); return q; };
    q.limit = async () => ({ data: rows, error: null });
    calls.push([table, q]);
    return q;
  };
  const db = { from: (t) => builder(t, t === 'question_interactions' ? [1, 2, 3, 4, 5].map((n) => ({ session_id: `daily:${T}`, n })) : [{ updated_at: `${add(T, -1)}T06:00:00Z` }]) };
  const days = await readStreakExtras(db, 'u1', add(T, -30));
  assert.deepEqual(days.map((d) => [d.day, d.answered, d.counts === true]), [[T, 5, false], [add(T, -1), 0, true]]);
  const qi = calls.find(([t]) => t === 'question_interactions')[1].calls;
  assert.ok(qi.some((c) => c[0] === 'eq' && c[1] === 'interaction_type' && c[2] === 'daily_five'));
  assert.ok(qi.some((c) => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'u1'));
  const bad = { from: () => { throw new Error('boom'); } };
  assert.deepEqual(await readStreakExtras(bad, 'u1', T), []);
});

// ---------- S3: passes and the cap (bug 6) ----------

test('passes cap at 2; the body says full, and no milestone or line promises a pass the cap swallows', () => {
  const c = chain(run(add(T, -10), 10)); // day 3 gift + day 7 = 2 held, day 10 today
  assert.equal(c.passes.held, PASS_MAX);
  assert.equal(c.passes.full, true);
  const fourteen = c.milestones.find((m) => m.at === 14);
  assert.equal(fourteen.full, true);
  assert.match(DenCopy.milestone(fourteen), /already hold 2, the most you can keep/);
  const line = passLine(c.passes);
  assert.match(line.title, /the most you can hold/);
  assert.doesNotMatch(`${line.title} ${line.next}`, /day 14/);
  const one = chain(run(add(T, -4), 4));
  assert.equal(one.passes.full, false);
  assert.equal(passLine(one.passes).next, 'Next pass at day 7.');
  assert.equal(passLine({ held: 0, max: 2, next: { at: 3 } }).title, 'No rest pass yet');
});

test('a covered day gives a calm notice, never a warning', () => {
  const c = chain([...run(add(T, -10), 9), { day: T, answered: 6 }]);
  assert.equal(c.week.at(-2).state, 'rested');
  assert.equal(noticeLine(c, T), 'Yesterday was covered by a rest pass. Your streak is still going.');
  assert.match(statusLine({ ...c, rule: { answers: DAY_GOAL } }).text, /^Today counts\. Yesterday was covered/);
});

// ---------- S4: the make-up in words ----------

test('the make-up says "Yesterday is still open" with the real numbers, no timer', () => {
  const c = chain([...run(add(T, -3), 2), { day: T, answered: 4 }]);
  assert.deepEqual(c.makeUp, { day: add(T, -1), needed: MAKE_UP_GOAL, answeredToday: 4 });
  assert.deepEqual(makeUpLine(c.makeUp, T), { text: 'Yesterday is still open. Answer 10 today to keep your streak.', progress: 'You have answered 4 of 10 today.' });
  assert.equal(statusLine(c).text, 'Yesterday is still open. Answer 10 today to keep your streak.');
  assert.equal(makeUpLine({ day: add(T, -2), needed: 10, answeredToday: 0 }, T).text.startsWith('Sunday is still open'), true);
});

// ---------- S5: the week ----------

test('the week marks: done, rested, made up, paused, open, today; a day without practice is plain', () => {
  const body = { week: [
    { day: add(T, -6), state: 'missed' }, { day: add(T, -5), state: 'practised' }, { day: add(T, -4), state: 'rested' },
    { day: add(T, -3), state: 'made_up' }, { day: add(T, -2), state: 'paused' }, { day: add(T, -1), state: 'open' }, { day: T, state: 'today', answered: 2 },
  ] };
  const marks = streakWeek(body);
  assert.deepEqual(marks.map((m) => m.look), ['none', 'done', 'rested', 'made_up', 'paused', 'open', 'today']);
  assert.equal(marks[0].label, 'Wednesday: no practice');
  assert.equal(marks.at(-1).name, 'Today');
  assert.equal(weekLegend(marks), 'Moon: a rest pass kept the day. Ring: a day you made up. Bar: an exam pause day. Dashed: a day still open.');
});

// ---------- S6: milestones tied to real work ----------

test('milestones at 3, 7, 14, 30, 50, 100 with the questions answered in this run, never marks', () => {
  assert.deepEqual([...STREAK_MILESTONES], [3, 7, 14, 30, 50, 100]);
  const c = chain([...run(add(T, -30), 30, 12), { day: T, answered: 7 }]);
  assert.equal(c.days, 31);
  assert.deepEqual(c.milestone, { at: 30, answered: 30 * 12 + 7 });
  assert.deepEqual(milestoneMoment(c.milestone), { title: '30 days in a row', text: '367 questions answered since this streak began.' });
  assert.equal(milestoneLine(c), 'Next milestone: 50 days, 19 days to go.');
  // the run starts again after a day that was not covered: older work is not counted in it
  const reset = chain([...run(add(T, -20), 5, 20), ...run(add(T, -8), 8, 6)]);
  assert.equal(reset.run.from, add(T, -8));
  assert.equal(reset.run.answered, 48);
  assert.doesNotMatch(JSON.stringify(milestoneMoment(c.milestone)), /mark/i);
});

// ---------- the API ----------

const fakeService = (body = chain(run(add(T, -3), 3))) => ({
  get: async () => body,
  pauseSet: async (_u, b) => { if ((b.days || []).some((d) => d <= T)) { const { MobError } = await import('../../src/lib/mob/model.mjs'); throw new MobError('PAUSE_PAST'); } return { ...body, pause: { ...body.pause, days: b.days } }; },
  pauseClear: async () => body,
});
const req = (method = 'GET', body = null, headers = {}) => new Request('http://x/api/me/streak', { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });

test('GET /api/me/streak: 401 signed out; 200 for a student in no Mob, with the rule and no-store', async () => {
  const out = await handleStreak({ auth: async () => null, service: fakeService() }, 'get', req());
  assert.equal(out.status, 401);
  assert.equal((await out.json()).error.code, 'UNAUTHENTICATED');
  let seen = null;
  const ok = await handleStreak({ auth: async (r) => { seen = r.headers.get('authorization'); return { user: { id: 'u1' } }; }, service: fakeService() }, 'get', req('GET', null, { Authorization: 'Bearer app-token' }));
  assert.equal(ok.status, 200);
  assert.equal(seen, 'Bearer app-token', 'auth(request) sees the app token');
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  const b = await ok.json();
  assert.equal(b.days, 3);
  assert.deepEqual(Object.keys(b.rule).sort(), ['answers', 'makeUp', 'makeUpEvery', 'passEvery', 'passFirstAt', 'passPerFixes']);
  for (const k of ['days', 'best', 'today', 'passes', 'week', 'makeUp', 'pause', 'notices', 'run', 'streakMilestones', 'milestone']) assert.ok(k in b, k);
});

test('pause days: 422 for a day not after today, 200 for future days, 429 when limited, 503 on a failed read', async () => {
  const deps = { auth: async () => ({ user: { id: 'u1' } }), service: fakeService() };
  assert.equal((await handleStreak(deps, 'pauseSet', req('POST', { days: [T] }))).status, 422);
  const ok = await handleStreak(deps, 'pauseSet', req('POST', { days: [add(T, 3)] }));
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).pause.days, [add(T, 3)]);
  const limited = await handleStreak({ ...deps, rateLimit: async () => ({ allowed: false, retryAfterSeconds: 60 }) }, 'pauseSet', req('POST', { days: [add(T, 3)] }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  const down = await handleStreak({ ...deps, service: { get: async () => { throw new Error('db'); } } }, 'get', req());
  assert.equal(down.status, 503);
  assert.equal((await down.json()).error.message, 'Your streak did not load. Try again shortly.');
  assert.equal((await handleStreak(deps, 'pauseSet', new Request('http://x', { method: 'POST', body: '[1]' }))).status, 400);
});

test('the routes use auth(request) and no Mob switch; streakDays is gone from the summary', () => {
  const deps = read('src/lib/server/streakDeps.js');
  assert.match(deps, /auth: \(request\) => auth\(request\)/);
  assert.doesNotMatch(deps, /mobEnabled|MOB_V3/);
  assert.match(read('src/app/api/me/streak/route.js'), /handleStreak\(streakDeps\(\), 'get', request\)/);
  assert.match(read('src/app/api/me/streak/pause/route.js'), /handleStreak\(streakDeps\(\), 'pauseSet', request\)/);
  assert.match(read('src/app/api/me/streak/pause/route.js'), /handleStreak\(streakDeps\(\), 'pauseClear', request\)/);
  assert.doesNotMatch(read('src/app/api/learning/summary/route.js'), /streakDays:|countStreak\(/);
  assert.equal(streakBody({ days: 1 }).rule.answers, DAY_GOAL);
});

// ---------- the copy rule ----------

const BANNED = /\b(lost|lose|behind|hurry|at risk|missed|miss|break|broke|broken|fail|failed|failure|warning)\b|!/i;
test('no guilt words in any streak line, in every state', () => {
  const states = [
    chain([]), chain(run(add(T, -3), 3)), chain([...run(add(T, -10), 9), { day: T, answered: 6 }]), chain([...run(add(T, -3), 2), { day: T, answered: 4 }]),
    chain(run(add(T, -9), 7), { pauses: [add(T, -2), add(T, -1), T, add(T, 2)] }), chain([...run(add(T, -30), 30), { day: T, answered: 9 }]),
    chain([...run(add(T, -20), 5), { day: T, answered: 1 }]),
  ].map((c) => ({ ...c, rule: { answers: DAY_GOAL } }));
  const lines = [ruleLine(DAY_GOAL), passRule({}), makeUpRule({}), chipLabel(3, true), DenCopy.passesRule, DenCopy.hiddenLine, DenCopy.calendarCaption, DenCopy.makeUpOpen('Monday', 10), DenCopy.newChain(9), DenCopy.pauseLine(4), DenCopy.passNotice('Monday', 5)];
  for (const c of states) {
    const s = statusLine(c);
    lines.push(s.text, s.sub || '', passLine(c.passes).title, passLine(c.passes).next || '', milestoneLine(c) || '', pauseLine(c.pause), pauseSetLine(c.pause, T) || '');
    for (const m of streakWeek(c)) lines.push(m.label);
    lines.push(weekLegend(streakWeek(c)));
    if (c.milestone) lines.push(...Object.values(milestoneMoment(c.milestone)));
  }
  for (const l of lines) assert.doesNotMatch(l, BANNED, l);
  // the paused day and the new streak read as calm facts
  assert.equal(statusLine(states[4]).text, 'Today is an exam pause day. Your streak holds.');
  assert.equal(streakWeek(states[4]).at(-1).look, 'paused');
  assert.equal(statusLine(states[6]).text, 'A new streak starts with today. Your best is 6 days.');
  assert.equal(statusLine(states[0]).text, 'Answer 5 questions today to start your streak.');
});
