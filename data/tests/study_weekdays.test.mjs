// The student's chosen study weekdays, kept on the account (owner ledger L06 and L39): the pure rule
// (src/lib/studyWeekdays.mjs), the migration and its undo, and the save flow the PUT route performs.
// Run: node --test data/tests/study_weekdays.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  maskFromWeekdays, maskToStore, parseWeekdays, resolveGoalWeekdays, weekdaysFromMask, weekdaysLine, weekdaysOut,
} from '../../src/lib/studyWeekdays.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const prefs = read('supabase/migrations/20261012121000_app_preferences_and_rhythm.sql');
const migration = read('supabase/migrations/20261016110000_study_weekdays.sql');
const undo = read('supabase/undo/20261016110000_study_weekdays.undo.sql');

test('weekdays parse: 1 to 7 distinct integers from 0 (Monday) to 6 (Sunday), sorted', () => {
  assert.deepEqual(parseWeekdays([5, 0, 3, 1]), { ok: true, weekdays: [0, 1, 3, 5] });
  assert.deepEqual(parseWeekdays([6]), { ok: true, weekdays: [6] });
  assert.equal(parseWeekdays([0, 1, 2, 3, 4, 5, 6]).weekdays.length, 7);
  for (const bad of [[], [7], [-1], [1.5], ['1'], [null], [1, 1], [0, 1, 2, 3, 4, 5, 6, 0], 'Mon', 4, null, undefined, {}, { length: 1, 0: 1 }]) {
    assert.equal(parseWeekdays(bad).ok, false, JSON.stringify(bad));
  }
});

test('mask round trip: Mon, Tue, Thu, Sat is 43', () => {
  assert.equal(maskFromWeekdays([0, 1, 3, 5]), 43);
  assert.deepEqual(weekdaysFromMask(43), [0, 1, 3, 5]);
  assert.equal(maskFromWeekdays([0, 1, 2, 3, 4, 5, 6]), 127);
  assert.equal(maskFromWeekdays([9]), null);
  assert.deepEqual(weekdaysFromMask(0), []);
  assert.deepEqual(weekdaysFromMask(128), []);
  assert.deepEqual(weekdaysFromMask(null), []);
  assert.deepEqual(weekdaysFromMask(NaN), []);
});

test('a row shows its weekdays only while their count is the goal', () => {
  assert.deepEqual(weekdaysOut(43, 4), [0, 1, 3, 5]);
  assert.equal(weekdaysOut(43, 3), null); // goal changed elsewhere: the plan is not believed
  assert.equal(weekdaysOut(null, 4), null);
  assert.equal(weekdaysOut(undefined, 4), null);
  assert.deepEqual(weekdaysOut('43', 4), [0, 1, 3, 5]); // a driver that returns the number as text still reads
});

test('PUT body: the days and the goal are decided together', () => {
  assert.deepEqual(resolveGoalWeekdays({ daysPerWeek: 4, weekdays: [0, 1, 3, 5] }), { ok: true, daysPerWeek: 4, weekdays: [0, 1, 3, 5] });
  assert.deepEqual(resolveGoalWeekdays({ weekdays: [5, 0] }), { ok: true, daysPerWeek: 2, weekdays: [0, 5] }); // the count is the goal
  assert.deepEqual(resolveGoalWeekdays({ daysPerWeek: 4 }), { ok: true, daysPerWeek: 4, weekdays: undefined }); // older app, pause buttons
  assert.deepEqual(resolveGoalWeekdays({ daysPerWeek: 3, weekdays: null }), { ok: true, daysPerWeek: 3, weekdays: null });
  // refused
  assert.equal(resolveGoalWeekdays({ daysPerWeek: 3, weekdays: [0, 1, 3, 5] }).ok, false); // count and goal disagree
  assert.match(resolveGoalWeekdays({ daysPerWeek: 3, weekdays: [0, 1, 3, 5] }).message, /4 days/);
  assert.equal(resolveGoalWeekdays({}).ok, false);
  assert.equal(resolveGoalWeekdays({ weekdays: null }).ok, false); // clearing needs the goal it keeps
  assert.equal(resolveGoalWeekdays({ daysPerWeek: 0 }).ok, false);
  assert.equal(resolveGoalWeekdays({ daysPerWeek: 8 }).ok, false);
  assert.equal(resolveGoalWeekdays({ daysPerWeek: '4' }).ok, false);
  assert.equal(resolveGoalWeekdays({ daysPerWeek: 2, weekdays: [0, 7] }).ok, false);
  assert.equal(resolveGoalWeekdays({ daysPerWeek: 2, weekdays: 'Mon,Tue' }).ok, false);
  assert.equal(resolveGoalWeekdays({ weekdays: [] }).ok, false);
  assert.equal(resolveGoalWeekdays(null).ok, false);
});

test('what to store: a new plan replaces, a clear clears, a goal alone keeps the plan only while the count matches', () => {
  assert.equal(maskToStore({ weekdays: [0, 1, 3, 5], daysPerWeek: 4, previousMask: null }), 43);
  assert.equal(maskToStore({ weekdays: null, daysPerWeek: 4, previousMask: 43 }), null);
  assert.equal(maskToStore({ weekdays: undefined, daysPerWeek: 4, previousMask: 43 }), undefined); // pause only: untouched
  assert.equal(maskToStore({ weekdays: undefined, daysPerWeek: 5, previousMask: 43 }), null); // goal moved: plan dropped
  assert.equal(maskToStore({ weekdays: undefined, daysPerWeek: 5, previousMask: null }), undefined);
  assert.equal(maskToStore({ weekdays: undefined, daysPerWeek: 5, previousMask: undefined }), undefined); // column not there yet
});

test('the words: Mon, Tue, Thu and Sat', () => {
  assert.equal(weekdaysLine([0, 1, 3, 5]), 'Mon, Tue, Thu and Sat');
  assert.equal(weekdaysLine([6]), 'Sun');
  assert.equal(weekdaysLine([0, 1]), 'Mon and Tue');
  assert.equal(weekdaysLine([0, 1, 2, 3, 4, 5, 6]), 'every day');
  assert.equal(weekdaysLine([]), '');
  assert.equal(weekdaysLine(null), '');
});

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key, name text not null default 'x'); insert into public.users(id) values ('u1'),('u2');");
  await db.exec(prefs);
  return db;
}

test('migration: applies twice, changes no existing row, range-checks the mask', async () => {
  const db = await setup();
  try {
    await db.exec("insert into study_goals(user_id, days_per_week) values ('u1', 6)");
    await db.exec(migration);
    await db.exec(migration); // idempotent
    const row = (await db.query("select days_per_week d, weekday_mask m from study_goals where user_id='u1'")).rows[0];
    assert.deepEqual(row, { d: 6, m: null });
    await db.exec("update study_goals set weekday_mask = 43, days_per_week = 4 where user_id = 'u1'");
    for (const bad of [0, 128, -1]) await assert.rejects(db.exec(`update study_goals set weekday_mask = ${bad} where user_id = 'u1'`), /check/i);
    // the plan can lag the goal in the table (an older writer): the API reads it as "none"
    await db.exec("update study_goals set days_per_week = 5 where user_id = 'u1'");
    assert.equal(weekdaysOut((await db.query('select weekday_mask m from study_goals')).rows[0].m, 5), null);
    // still service-role only
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select weekday_mask from study_goals'), /permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('undo: removes the column and the check, keeps the goal', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    await db.exec("insert into study_goals(user_id, days_per_week, weekday_mask) values ('u1', 4, 43)");
    await db.exec(undo);
    await db.exec(undo); // idempotent
    const cols = (await db.query("select column_name from information_schema.columns where table_name='study_goals'")).rows.map((r) => r.column_name);
    assert.ok(!cols.includes('weekday_mask'));
    assert.equal((await db.query("select days_per_week d from study_goals where user_id='u1'")).rows[0].d, 4);
    await db.exec(migration); // and it can be applied again
  } finally { await db.close(); }
});

const out = (row) => ({ daysPerWeek: row.days_per_week, weekdays: weekdaysOut(row.weekday_mask, row.days_per_week) });

// The save flow of src/lib/server/appPrefs.js saveGoal and goalOut, run against the real table.
async function putGoal(db, userId, body) {
  const goal = resolveGoalWeekdays(body);
  if (!goal.ok) return { status: 422, message: goal.message };
  const prev = (await db.query('select * from study_goals where user_id = $1', [userId])).rows[0];
  const mask = maskToStore({ weekdays: goal.weekdays, daysPerWeek: goal.daysPerWeek, previousMask: prev?.weekday_mask });
  const cols = ['user_id', 'days_per_week'];
  const vals = [userId, goal.daysPerWeek];
  if (mask !== undefined) { cols.push('weekday_mask'); vals.push(mask); }
  const sets = cols.slice(1).map((c) => `${c} = excluded.${c}`).join(', ');
  const { rows } = await db.query(`insert into study_goals(${cols.join(',')}) values (${vals.map((_, i) => `$${i + 1}`).join(',')}) on conflict (user_id) do update set ${sets} returning *`, vals);
  return { status: 200, ...out(rows[0]) };
}
const getGoal = async (db, userId) => {
  const r = (await db.query('select * from study_goals where user_id=$1', [userId])).rows[0];
  return r ? out(r) : { daysPerWeek: 4, weekdays: null };
};

test('save flow: the website and the app read the same days; the goal is always their count', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    assert.deepEqual(await getGoal(db, 'u1'), { daysPerWeek: 4, weekdays: null });
    // the app (or the website) saves Mon, Tue, Thu, Sat
    assert.deepEqual(await putGoal(db, 'u1', { daysPerWeek: 4, pausedUntil: null, weekdays: [5, 3, 1, 0] }), { status: 200, daysPerWeek: 4, weekdays: [0, 1, 3, 5] });
    // a second device reads them
    assert.deepEqual(await getGoal(db, 'u1'), { daysPerWeek: 4, weekdays: [0, 1, 3, 5] });
    // a pause (goal PUT without weekdays) keeps them
    assert.deepEqual(await putGoal(db, 'u1', { daysPerWeek: 4, pausedUntil: '2026-10-20' }), { status: 200, daysPerWeek: 4, weekdays: [0, 1, 3, 5] });
    // an older client moves the goal to 3: the plan is dropped, not shown wrong
    assert.deepEqual(await putGoal(db, 'u1', { daysPerWeek: 3 }), { status: 200, daysPerWeek: 3, weekdays: null });
    assert.equal((await db.query("select weekday_mask m from study_goals where user_id='u1'")).rows[0].m, null);
    // choosing days without a goal: the count becomes the goal
    assert.deepEqual(await putGoal(db, 'u1', { weekdays: [2, 4] }), { status: 200, daysPerWeek: 2, weekdays: [2, 4] });
    // clearing
    assert.deepEqual(await putGoal(db, 'u1', { daysPerWeek: 2, weekdays: null }), { status: 200, daysPerWeek: 2, weekdays: null });
    // refused input changes nothing
    await putGoal(db, 'u1', { weekdays: [0, 1, 2] });
    for (const bad of [{ daysPerWeek: 2, weekdays: [0, 1, 2] }, { daysPerWeek: 3, weekdays: [0, 0, 1] }, { daysPerWeek: 3, weekdays: [0, 1, 7] }, { weekdays: 'all' }]) {
      assert.equal((await putGoal(db, 'u1', bad)).status, 422);
    }
    assert.deepEqual(await getGoal(db, 'u1'), { daysPerWeek: 3, weekdays: [0, 1, 2] });
  } finally { await db.close(); }
});

test('own rows only: one student saving never changes another', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    await putGoal(db, 'u1', { weekdays: [0, 1, 2, 3] });
    await putGoal(db, 'u2', { weekdays: [5, 6] });
    assert.deepEqual(await getGoal(db, 'u1'), { daysPerWeek: 4, weekdays: [0, 1, 2, 3] });
    assert.deepEqual(await getGoal(db, 'u2'), { daysPerWeek: 2, weekdays: [5, 6] });
    await db.exec("delete from public.users where id = 'u1'");
    assert.equal((await db.query('select count(*)::int n from study_goals')).rows[0].n, 1); // cascade, other row kept
  } finally { await db.close(); }
});

test('source: the route takes the user from the session, validates before saving, and the store writes the plan with the goal', () => {
  const route = read('src/app/api/me/goal/route.js');
  assert.match(route, /const goal = resolveGoalWeekdays\(body\);\s*\n\s*if \(!goal\.ok\) return bad\(goal\.message\);/);
  assert.match(route, /saveGoal\(session\.user\.id, \{ daysPerWeek: goal\.daysPerWeek, pausedUntil, weekdays: goal\.weekdays \}\)/);
  assert.ok(route.indexOf('resolveGoalWeekdays(body)') < route.indexOf('saveGoal(session.user.id'));
  assert.doesNotMatch(route, /body\.(userId|user_id)/);
  const store = read('src/lib/server/appPrefs.js');
  assert.match(store, /maskToStore\(\{ weekdays, daysPerWeek, previousMask: prev\.data\?\.weekday_mask \}\)/);
  assert.match(store, /weekdays: weekdaysOut\(row\?\.weekday_mask, daysPerWeek\)/);
  assert.match(store, /\.upsert\(row, \{ onConflict: 'user_id' \}\)/);
});
