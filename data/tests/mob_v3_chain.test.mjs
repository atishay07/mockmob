// SV-12: the personal daily chain (src/lib/chain/chain.mjs, MOB-BUILD-SPEC-V3 2.3 and 3.8) and its SQL on PGlite
// (supabase/migrations/20261020100200_mob_v3_chains.sql): IST day boundaries, skips, rest passes that apply themselves,
// the free make-up, exam pause, hide, the best that never drops, and Cutting's "came back".
// Run: node --test data/tests/mob_v3_chain.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cameBack, chainChip, checkPause, computeChain, seasonStart, walkChain } from '../../src/lib/chain/chain.mjs';
import { createChainService } from '../../src/lib/server/chain.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const DAY = 86_400_000;
const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const TODAY = '2026-10-22';
// days(['2026-10-01', 5], ...) or a run: run(from, n, answered)
const run = (from, n, answered = 5) => Array.from({ length: n }, (_, i) => ({ day: add(from, i), answered }));
const chain = (daily, more = {}) => computeChain({ daily, today: TODAY, ...more });

test('no practice: a chain of 0, today waits for 5', () => {
  const c = chain([]);
  assert.equal(c.days, 0);
  assert.deepEqual(c.today, { answered: 0, needed: 5, done: false });
  assert.equal(c.best, 0);
});

test('5 answered in a day counts; 4 does not', () => {
  assert.equal(chain(run('2026-10-21', 1, 5)).days, 1);
  assert.equal(chain(run('2026-10-21', 1, 4)).days, 0);
});

test('5 answered across two sessions on one day count', () => {
  assert.equal(chain([{ day: '2026-10-21', answered: 2 }, { day: '2026-10-21', answered: 3 }]).days, 1);
});

test('five days in a row up to yesterday', () => {
  const c = chain(run('2026-10-17', 5));
  assert.equal(c.days, 5);
  assert.equal(c.practised, 5);
});

test('today practised adds one; the today state shows progress until then', () => {
  assert.equal(chain([...run('2026-10-17', 5), { day: TODAY, answered: 5 }]).days, 6);
  const c = chain([...run('2026-10-17', 5), { day: TODAY, answered: 2 }]);
  assert.equal(c.days, 5);
  assert.deepEqual(c.week.at(-1), { day: TODAY, state: 'today', answered: 2 });
});

test('a pass is gifted at day 3', () => {
  assert.equal(walkChain({ daily: run('2026-10-18', 3), today: '2026-10-21' }).passes, 1);
  assert.equal(walkChain({ daily: run('2026-10-19', 2), today: '2026-10-21' }).passes, 0);
});

test('a pass every 7 days, up to 2 held', () => {
  assert.equal(walkChain({ daily: run('2026-10-01', 7), today: '2026-10-08' }).passes, 2, 'day 3 gift + day 7');
  assert.equal(walkChain({ daily: run('2026-09-20', 21), today: '2026-10-11' }).passes, 2, 'capped at 2');
});

test('day 14 brings a pass (one every 7 days) after one was used', () => {
  const daily = [...run('2026-10-01', 9), ...run('2026-10-11', 5)]; // 10 Oct missed: a pass covers it
  const w = walkChain({ daily, today: '2026-10-16' });
  assert.equal(w.states.get('2026-10-10'), 'rested');
  assert.equal(w.chain, 15);
  assert.equal(w.passes, 2, '1 left after the rest, +1 at 14');
});

test('a missed day takes a held pass by itself (rested), and the chain grows', () => {
  const daily = [...run('2026-10-10', 5), ...run('2026-10-16', 6)]; // 15 Oct missed
  const c = chain(daily);
  assert.equal(c.days, 12, '5 practised, 1 rested, 6 practised');
  assert.equal(c.rested, 1);
  assert.equal(c.week.find((d) => d.day === '2026-10-16').state, 'practised');
  assert.ok(c.calendar.some((d) => d.day === '2026-10-15' && d.state === 'rested'));
});

test('the pass applies before the make-up', () => {
  const daily = [...run('2026-10-10', 5), { day: '2026-10-16', answered: 12 }, ...run('2026-10-17', 5)];
  const w = walkChain({ daily, today: TODAY });
  assert.equal(w.states.get('2026-10-15'), 'rested');
  assert.equal(w.madeUp, 0);
});

test('two missed days use two passes in turn', () => {
  const daily = [...run('2026-10-01', 7), ...run('2026-10-10', 5)]; // 8 and 9 Oct missed, 2 passes held
  const w = walkChain({ daily, today: '2026-10-15' });
  assert.deepEqual([w.states.get('2026-10-08'), w.states.get('2026-10-09')], ['rested', 'rested']);
  assert.equal(w.chain, 14);
});

test('make-up: 10 answered the next day covers a missed day', () => {
  const daily = [...run('2026-10-18', 2), { day: '2026-10-21', answered: 10 }]; // 20 Oct missed, no pass yet
  const w = walkChain({ daily, today: TODAY });
  assert.equal(w.states.get('2026-10-20'), 'made_up');
  assert.equal(w.chain, 4);
});

test('make-up: 10 answered two days later also counts', () => {
  const daily = [...run('2026-10-17', 2), { day: '2026-10-19', answered: 1 }, { day: '2026-10-21', answered: 10 }];
  const w = walkChain({ daily, today: TODAY });
  assert.equal(w.states.get('2026-10-19'), 'made_up');
  assert.equal(w.states.get('2026-10-20'), 'rested', 'day 3 gave a pass, and it covers the 20th by itself');
});

test('make-up needs 10: 9 is not enough, and the day is missed once both days pass', () => {
  const daily = [...run('2026-10-14', 2), { day: '2026-10-17', answered: 9 }, { day: '2026-10-18', answered: 9 }];
  const w = walkChain({ daily, today: TODAY });
  assert.equal(w.states.get('2026-10-16'), 'missed');
});

test('only one make-up in 14 days', () => {
  // 1-3 practised (gift pass), 4 rested (pass used), 5 made up by 10 on the 6th, 7 missed: 10 on the 8th is refused.
  const daily = [...run('2026-10-01', 3), { day: '2026-10-06', answered: 10 }, { day: '2026-10-08', answered: 10 }];
  const w = walkChain({ daily, today: '2026-10-16' });
  assert.deepEqual(['04', '05', '06', '07'].map((d) => w.states.get(`2026-10-${d}`)), ['rested', 'made_up', 'practised', 'missed'], 'a second make-up 2 days later is refused');
});

test('a make-up is allowed again 14 days later', () => {
  const daily = [...run('2026-09-01', 2), { day: '2026-09-04', answered: 10 }, { day: '2026-09-05', answered: 0 },
    { day: '2026-09-17', answered: 0 }];
  // 3 Sep made up; 15 Sep: rebuild a chain, 17 Sep missed and 18 Sep 10 answered.
  const later = [...daily, ...run('2026-09-12', 5), { day: '2026-09-18', answered: 10 }];
  const w = walkChain({ daily: later, today: '2026-09-25' });
  assert.equal(w.states.get('2026-09-03'), 'made_up');
  assert.equal(w.states.get('2026-09-17'), 'made_up', '14 days after the last make-up');
});

test('open: before the outcome is known the chain shows as held, with the make-up offered', () => {
  const daily = [...run('2026-10-19', 2)]; // 21 Oct (yesterday) missed, no pass
  const c = chain(daily);
  assert.equal(c.days, 2, 'held');
  assert.deepEqual(c.makeUp, { day: '2026-10-21', needed: 10, answeredToday: 0 });
  assert.equal(c.calendar.find((d) => d.day === '2026-10-21').state, 'open');
});

test('open with the make-up used recently: no make-up offered', () => {
  const daily = [...run('2026-10-15', 2), { day: '2026-10-18', answered: 10 }, ...run('2026-10-19', 2)];
  const c = chain(daily);
  assert.equal(c.makeUp, null);
});

test('a missed day restarts the chain; the best stays', () => {
  const daily = [...run('2026-10-01', 2), ...run('2026-10-10', 3)];
  const c = computeChain({ daily, today: '2026-10-14' });
  assert.equal(c.days, 4, 'restarted on the 10th: 3 practised, then the day-3 pass covers the 13th');
  assert.equal(c.calendar.find((d) => d.day === '2026-10-05').state, 'missed');
  assert.equal(walkChain({ daily: [...run('2026-10-01', 9), ...run('2026-10-20', 1)], today: TODAY }).best, 11, '9 practised and 2 rested before the miss');
});

test('pause days hold the chain and do not add', () => {
  const daily = [...run('2026-10-15', 3), ...run('2026-10-20', 2)];
  const c = computeChain({ daily, pauses: ['2026-10-18', '2026-10-19'], today: TODAY });
  assert.equal(c.days, 5);
  assert.equal(c.paused, 2);
  assert.equal(c.calendar.find((d) => d.day === '2026-10-18').state, 'paused');
});

test('future pause days show on the calendar', () => {
  const c = computeChain({ daily: [], pauses: ['2026-10-30'], today: TODAY });
  assert.equal(c.calendar.find((d) => d.day === '2026-10-30').state, 'paused');
  assert.deepEqual(c.pause, { days: ['2026-10-30'], usedThisSeason: 1, max: 14 });
});

test('held fixes: one pass for every 3rd (all time)', () => {
  assert.equal(walkChain({ daily: run('2026-10-20', 2), fixesHeld: [{ day: '2026-10-20', n: 3 }], today: TODAY }).passes, 1);
  assert.equal(walkChain({ daily: run('2026-10-20', 2), fixesHeld: [{ day: '2026-10-20', n: 2 }], today: TODAY }).passes, 0);
  assert.equal(walkChain({ daily: run('2026-10-20', 2), fixesHeld: [{ day: '2026-10-01', n: 4 }, { day: '2026-10-21', n: 2 }], today: TODAY }).passes, 2);
});

test('the cap of 2 holds with fixes too', () => {
  assert.equal(walkChain({ daily: run('2026-10-10', 7), fixesHeld: [{ day: '2026-10-11', n: 9 }], today: '2026-10-17' }).passes, 2);
});

test('hidden still computes', () => {
  const c = chain(run('2026-10-17', 5), { hidden: true });
  assert.equal(c.hidden, true);
  assert.equal(c.days, 5);
  assert.deepEqual(chainChip(c), { hidden: true, days: 5, todayDone: false });
});

test('the best never drops, even if history is deleted', () => {
  assert.equal(chain([], { storedBest: 23 }).best, 23);
  assert.equal(chain(run('2026-10-17', 5), { storedBest: 3 }).best, 5);
});

test('milestones: done, left, and due once', () => {
  const c = chain(run('2026-10-08', 14));
  assert.equal(c.days, 14);
  assert.deepEqual(c.milestones.find((m) => m.at === 14), { at: 14, reward: 'rest_pass', done: true });
  assert.deepEqual(c.milestones.find((m) => m.at === 30), { at: 30, reward: 'foil', done: false, left: 16 });
  assert.deepEqual(c.due, ['chain:3', 'chain:7', 'chain:14']);
  assert.deepEqual(chain(run('2026-10-08', 14), { seen: new Set(['chain:3', 'chain:7']) }).due, ['chain:14']);
  assert.deepEqual(c.next, { at: 21, reward: 'rest_pass', left: 7 });
});

test('notices: rested and made-up days not yet seen', () => {
  const daily = [...run('2026-10-10', 5), ...run('2026-10-16', 6)];
  const c = chain(daily);
  assert.deepEqual(c.notices, [{ key: 'rest:2026-10-15', kind: 'rested', day: '2026-10-15', days: 6 }]);
  assert.deepEqual(chain(daily, { seen: new Set(['rest:2026-10-15']) }).notices, []);
});

test('the week: 7 days with today last; the calendar: last month and this month', () => {
  const c = chain(run('2026-10-17', 5));
  assert.equal(c.week.length, 7);
  assert.equal(c.week.at(-1).day, TODAY);
  assert.equal(c.calendar[0].day, '2026-09-01');
  assert.equal(c.calendar.at(-1).day, '2026-10-31');
  assert.equal(c.calendar.length, 61);
  assert.ok(c.calendar.every((d) => ['practised', 'rested', 'made_up', 'paused', 'missed', 'open', 'none'].includes(d.state)));
  const jan = computeChain({ daily: [], today: '2027-01-05' });
  assert.equal(jan.calendar[0].day, '2026-12-01');
});

test('the next pass: day 3 before the gift, then each 7th day', () => {
  assert.deepEqual(chain([]).passes.next, { kind: 'days', at: 3 });
  assert.deepEqual(chain(run('2026-10-17', 5)).passes.next, { kind: 'days', at: 7 });
  assert.deepEqual(chain(run('2026-10-08', 14)).passes.next, { kind: 'days', at: 21 });
});

test('no warning, countdown or exclamation in anything the chain returns', () => {
  const s = JSON.stringify(chain([...run('2026-10-19', 2)]));
  assert.doesNotMatch(s, /!|risk|hurry|lose|lost|warning|deadline/i);
});

test('Cutting: back after 3 or more days away', () => {
  assert.equal(cameBack([{ day: '2026-10-01', answered: 1 }, { day: '2026-10-04', answered: 1 }]), true);
  assert.equal(cameBack([{ day: '2026-10-01', answered: 1 }, { day: '2026-10-03', answered: 1 }]), false);
  assert.equal(cameBack([{ day: '2026-10-01', answered: 1 }, { day: '2026-10-09', answered: 0 }]), false, 'a day with nothing answered is not a return');
});

test('pause rules: only after today; at most 14 in a season', () => {
  assert.equal(checkPause({ days: [TODAY], today: TODAY }).code, 'PAUSE_PAST');
  assert.equal(checkPause({ days: ['2026-10-21'], today: TODAY }).code, 'PAUSE_PAST');
  assert.deepEqual(checkPause({ days: ['2026-11-11', '2026-11-10'], today: TODAY }), { ok: true, days: ['2026-11-10', '2026-11-11'] });
  const fourteen = Array.from({ length: 14 }, (_, i) => add('2026-11-01', i));
  assert.equal(checkPause({ days: fourteen, today: TODAY }).ok, true);
  assert.equal(checkPause({ days: ['2026-12-25'], today: TODAY, existing: fourteen }).code, 'PAUSE_LIMIT');
  assert.equal(checkPause({ days: ['2027-08-02'], today: TODAY, existing: fourteen }).ok, true, 'a new season');
  assert.equal(checkPause({ days: ['not a day'], today: TODAY }).code, 'BODY_INVALID');
});

test('seasons run 1 Aug to 31 Jul', () => {
  assert.equal(seasonStart('2026-07-31'), '2025-08-01');
  assert.equal(seasonStart('2026-08-01'), '2026-08-01');
  assert.equal(seasonStart('2027-01-15'), '2026-08-01');
});

// ---------------------------------------------------------------------------------------------------------------
// The SQL on PGlite
// ---------------------------------------------------------------------------------------------------------------

async function database() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users values ('u1'),('u2');");
  await db.exec(`create table public.attempts (id text primary key, user_id text, subject text, score int, correct int, wrong int, unattempted int, total int,
    details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  for (const f of ['20261017100000_mob', '20261017190000_mob_fix_1017', '20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains']) {
    await db.exec(read(`supabase/migrations/${f}.sql`));
  }
  return db;
}
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const values = keys.map((k) => (Array.isArray(params[k]) && k === 'p_days' ? `{${params[k].join(',')}}` : params[k]));
    return (await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values)).rows[0].r;
  };
}
const attempt = (db, id, at, total, unattempted = 0) => db.query("insert into attempts (id, user_id, total, unattempted, completed_at) values ($1, 'u1', $2, $3, $4)", [id, total, unattempted, at]);

test('SQL: the IST day boundary, 11:59 PM and 12:00 AM', async () => {
  const db = await database();
  try {
    await attempt(db, 'a', '2026-10-21T18:29:59Z', 3); // 21 Oct, 11:59 PM IST
    await attempt(db, 'b', '2026-10-21T18:30:00Z', 4); // 22 Oct, 12:00 AM IST
    const daily = (await db.query("select chain_daily('u1', '2026-10-01') r")).rows[0].r;
    assert.deepEqual(daily, [{ day: '2026-10-21', answered: 3 }, { day: '2026-10-22', answered: 4 }]);
  } finally { await db.close(); }
});

test('SQL: skips never count (unattempted questions, skipped game answers)', async () => {
  const db = await database();
  try {
    await attempt(db, 'a', '2026-10-21T08:00:00Z', 10, 6);
    const daily = (await db.query("select chain_daily('u1', '2026-10-01') r")).rows[0].r;
    assert.deepEqual(daily, [{ day: '2026-10-21', answered: 4 }]);
    assert.equal(computeChain({ daily, today: TODAY }).days, 0, '10 seen, 4 answered: not a day');
  } finally { await db.close(); }
});

test('SQL: pause days after today only, 14 a season; clear future days only; prefs and the best only rise', async () => {
  const db = await database();
  const rpc = pgRpc(db);
  try {
    assert.equal(await rpc('chain_pause_set', { p_user_id: 'u1', p_days: [TODAY], p_today: TODAY }), 'past');
    assert.equal(await rpc('chain_pause_set', { p_user_id: 'u1', p_days: Array.from({ length: 14 }, (_, i) => add('2026-11-01', i)), p_today: TODAY }), 'ok');
    assert.equal(await rpc('chain_pause_set', { p_user_id: 'u1', p_days: ['2027-03-01'], p_today: TODAY }), 'limit');
    assert.equal(await rpc('chain_pause_clear', { p_user_id: 'u1', p_days: ['2026-10-01'], p_today: TODAY }), 'past');
    assert.equal(await rpc('chain_pause_clear', { p_user_id: 'u1', p_days: ['2026-11-01'], p_today: TODAY }), 'ok');
    assert.equal(await rpc('chain_pause_set', { p_user_id: 'u1', p_days: ['2027-03-01'], p_today: TODAY }), 'ok');
    assert.equal(await rpc('chain_best_bump', { p_user_id: 'u1', p_days: 9 }), 9);
    assert.equal(await rpc('chain_best_bump', { p_user_id: 'u1', p_days: 4 }), 9, 'never drops');
    assert.equal(await rpc('chain_prefs_set', { p_user_id: 'u1', p_hidden: true }), 'ok');
    const s = await rpc('chain_state', { p_user_id: 'u1', p_from: '2026-01-01' });
    assert.equal(s.hidden, true);
    assert.equal(s.best_days, 9);
    assert.equal(s.pauses.length, 14);
  } finally { await db.close(); }
});

test('the chain service: GET, Hide, pause through the API rules, best stored', async () => {
  const db = await database();
  try {
    const now = Date.parse('2026-10-22T08:00:00Z');
    for (let i = 1; i <= 6; i += 1) await attempt(db, `x${i}`, new Date(now - i * DAY).toISOString(), 5);
    const svc = createChainService({ rpc: pgRpc(db), now: () => now });
    const c = await svc.get('u1');
    assert.equal(c.days, 6);
    assert.equal((await db.query("select best_days r from chain_prefs where user_id='u1'")).rows[0].r, 6, 'the best is stored');
    assert.equal((await svc.patch('u1', { hidden: true })).hidden, true);
    await assert.rejects(svc.patch('u1', { hidden: 'yes' }), (e) => e.code === 'BODY_INVALID');
    await assert.rejects(svc.pauseSet('u1', { days: ['2026-10-22'] }), (e) => e.code === 'PAUSE_PAST');
    const p = await svc.pauseSet('u1', { days: ['2026-10-30', '2026-10-31'] });
    assert.deepEqual(p.pause.days, ['2026-10-30', '2026-10-31']);
    assert.deepEqual((await svc.pauseClear('u1', { days: ['2026-10-30'] })).pause.days, ['2026-10-31']);
    await db.exec("delete from attempts");
    assert.equal((await svc.get('u1')).best, 6, 'history deleted, the best stays');
  } finally { await db.close(); }
});
