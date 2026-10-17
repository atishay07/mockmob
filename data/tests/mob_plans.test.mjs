// Free and Pro on the Mob (docs/design-decisions/pass-1016e/SOCIAL-SPEC.md section 15), enforced on the server:
//   - the weekly Mob paper costs no credits and no daily allowance, for everyone (data/practice_charge.js);
//   - a free student gets one weekly Mob paper a week whichever Mob it is in, Pro has no such limit;
//   - free is one Mob, Pro is three; extra papers on a chosen chapter and length are Pro to make, any member sits them;
//   - the teaser is free; the full side-by-side is Pro, with one free sample; past weeks are Pro;
//   - everything private stays private: another member is shown only when both of you share your answers.
// And: the Mob is open to everyone, so nothing in it reads an age band. Run: node --test data/tests/mob_plans.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTRA_LENGTHS, EXTRA_MAX_PER_WEEK, FREE_MAX_MOBS, PRO_MAX_MOBS, closesAt, costLine, teaserLine } from '../../src/lib/mob/model.mjs';
import { buildCompare, compareSummary, computeTeaser, sharingSet } from '../../src/lib/mob/compare.mjs';
import { createMobService } from '../../src/lib/server/mob/service.js';
import { LIMITS, handleMob } from '../../src/lib/server/mob/http.js';
import { detailFromAttempt } from '../../src/lib/server/mob/detail.js';
import { practiceCharge } from '../../data/practice_charge.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const migration = read('supabase/migrations/20261017100000_mob.sql');
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

// Tuesday 13 Oct 2026, 7:30 PM IST. The week is Monday 12 Oct.
const NOW = Date.parse('2026-10-13T14:00:00Z');
const WEEK = '2026-10-12';
const WEEK2 = '2026-10-19';
const DAY = 86_400_000;
const STUB_MOB = '11111111-2222-4333-8444-555555555555';

async function database(users = 8) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(`create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,${users}) g;`);
  await db.exec(migration);
  return db;
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]?.r;
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const values = keys.map((k) => {
      const v = params[k];
      if (k === 'p_picks') return `{${v.join(',')}}`;
      if (v && typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    return (await db.query(`select public.${name}(${args}) as r`, values)).rows[0].r;
  };
}
const expectCode = (code) => (e) => e?.code === code;

const BANK = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t}${i}` })) }));
const EXTRA_BANK = Array.from({ length: 20 }, (_, i) => BANK[i] || { id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, options: BANK[0].options });

let drawn = 0;
const baseDeps = (db, clock) => ({
  rpc: pgRpc(db), now: () => clock.now, secret: 'test-secret', blocklist,
  randomBytes: (n) => { drawn += 1; return Uint8Array.from({ length: n }, (_, i) => (drawn * 53 + i * 37) % 256); },
  subjectInfo: (s) => (['accountancy', 'economics'].includes(s) ? { ok: true, id: s, name: s[0].toUpperCase() + s.slice(1) } : { ok: false }),
  validChapter: (subject, chapter) => subject === 'accountancy' && ['Partnership Accounts', 'Cash Flow Statement'].includes(chapter),
  pickQuestionIds: async (_s, { count = 10 } = {}) => EXTRA_BANK.slice(0, count).map((q) => q.id),
  loadQuestions: async (ids) => ids.map((id) => EXTRA_BANK.find((q) => q.id === id)).filter(Boolean),
  trapNameFor: async () => null, findAttempts: async () => [],
});
const mobStart = (svc, user, subject = 'accountancy', name = 'Riya') => svc.create(user, { subject, name, colour: 0 });

// A finished attempt of the paper, with a device record so the sitting keeps seconds and changed answers.
function sat(mobId, week, user, picks, { extraId = null, bank = BANK, changed = {}, completedAt = NOW + 60_000, session } = {}) {
  const ids = bank.map((q) => q.id);
  const timeline = [];
  let seq = 0;
  ids.forEach((id, i) => {
    timeline.push({ seq: (seq += 1), qid: id, at: i * 10_000, type: 'visit' });
    if (picks[i] >= 0) timeline.push({ seq: (seq += 1), qid: id, at: i * 10_000 + 4_000, type: 'answer', answer: picks[i] });
  });
  const answerChanges = Object.entries(changed).flatMap(([qid, n]) => Array.from({ length: n }, () => ({ qid, at: 1, before: 0, after: 1, markEffect: 0 })));
  return {
    id: session || `att_${user}_${extraId || week}`, userId: user, completedAt,
    correct: picks.filter((p, i) => p === bank[i].correctIndex).length, total: bank.length,
    details: picks.map((p, i) => ({ qid: bank[i].id, givenIndex: p < 0 ? null : p })),
    selectionMeta: {
      mobPaper: { mobId, weekStart: week, ...(extraId ? { extraId } : {}) }, scoringVersion: 'server_practice_v1',
      recovery: { telemetry: 'self_reported', timeline, observed: { answerChanges }, end: { seq: seq + 1, qid: ids.at(-1), at: ids.length * 10_000, reason: 'submit' } },
    },
  };
}

test('a Mob paper costs no credits and no daily allowance, for everyone; a request body cannot ask for that', () => {
  const quick10 = { modeId: 'quick', creditAction: 'attempt', count: 10, subject: 'accountancy' };
  assert.deepEqual(practiceCharge(quick10), { creditAction: 'attempt', quota: 'daily_practice' }, 'an ordinary quick 10 is unchanged');
  assert.deepEqual(practiceCharge({ ...quick10, mobPaper: { mobId: STUB_MOB, weekStart: WEEK } }), { creditAction: null, quota: null });
  assert.deepEqual(practiceCharge({ ...quick10, count: 15, mobPaper: { mobId: STUB_MOB, weekStart: WEEK, extraId: STUB_MOB } }), { creditAction: null, quota: null }, 'extra papers too');
  assert.deepEqual(practiceCharge({ ...quick10, isPremium: true }), { creditAction: null, quota: null });
  assert.deepEqual(practiceCharge({ modeId: 'quick', creditAction: 'attempt', count: 5, purpose: 'baseline', subject: 'english' }), { creditAction: 'attempt', quota: 'baseline:english' });
  assert.deepEqual(practiceCharge({ modeId: 'full', creditAction: 'full', count: 50, purpose: 'full_sample', subject: 'economics' }), { creditAction: 'full', quota: 'full_sample:economics' });
  assert.deepEqual(practiceCharge({ modeId: 'smart', creditAction: null, count: 10, subject: 'accountancy' }), { creditAction: null, quota: null });
  // Only the server can pass mobPaper: the sessions route never hands startPractice a third argument.
  assert.doesNotMatch(read('src/app/api/sessions/route.js'), /mobPaper|startPractice\(userId, body,/);
  const practice = read('src/lib/server/practiceSessions.js');
  assert.match(practice, /practiceCharge\(\{[^}]*mobPaper/);
  assert.doesNotMatch(practice, /mode\.creditAction\)/, 'both start paths take the charge from practiceCharge');
});

test('the Mob has no age gate: nothing in the Mob code reads an age band or an adult flag', () => {
  for (const file of ['src/lib/mob/model.mjs', 'src/lib/mob/compare.mjs', 'src/lib/server/mob/service.js', 'src/lib/server/mob/deps.js', 'src/lib/server/mob/http.js',
    'src/components/mob/MobPage.jsx', 'src/components/mob/JoinMob.jsx', 'supabase/migrations/20261017100000_mob.sql']) {
    assert.doesNotMatch(read(file), /age_band|ageBand|\badult|under-18|under 18|consent/i, file);
  }
});

test('plans: free is one Mob, Pro is three, on start and on join; several Mobs are named on every write', async () => {
  assert.deepEqual([FREE_MAX_MOBS, PRO_MAX_MOBS], [1, 3]);
  const db = await database(8);
  const pro = new Set(['u2']);
  const clock = { now: NOW };
  const svc = createMobService({ ...baseDeps(db, clock), loadUser: async (id) => ({ isPremium: pro.has(id) }), startPractice: async () => ({}) });
  try {
    const free = await mobStart(svc, 'u1');
    assert.deepEqual(free.mob.plan, { pro: false, maxMobs: 1, mobCount: 1, canMakeExtra: false, canStartAnother: false });
    await assert.rejects(mobStart(svc, 'u1', 'economics'), expectCode('MOB_LIMIT'));
    const a = await mobStart(svc, 'u2', 'accountancy', 'Asha');
    const b = await mobStart(svc, 'u2', 'economics', 'Asha');
    const c = await mobStart(svc, 'u2', 'accountancy', 'Asha');
    assert.equal(new Set([a.mob.id, b.mob.id, c.mob.id]).size, 3);
    await assert.rejects(mobStart(svc, 'u2', 'economics', 'Asha'), expectCode('MOB_LIMIT_PRO'));
    const all = await svc.view('u2');
    assert.deepEqual(all.mob.mobs.map((m) => m.id), [a.mob.id, b.mob.id, c.mob.id], 'in the order you joined');
    assert.equal(all.mob.id, a.mob.id, 'the earliest Mob is the default');
    assert.deepEqual(all.mob.plan, { pro: true, maxMobs: 3, mobCount: 3, canMakeExtra: true, canStartAnother: false });
    assert.deepEqual(all.mob.mobs.map((m) => m.subjectName), ['Accountancy', 'Economics', 'Accountancy']);
    assert.equal((await svc.view('u2', { mobId: c.mob.id })).mob.id, c.mob.id);
    assert.equal((await svc.view('u2', { mobId: '00000000-0000-4000-8000-000000000000' })).mob.id, a.mob.id, 'a Mob you left falls back to one you have');
    assert.equal((await svc.view('u2', { mobId: 'nonsense' })).mob.id, a.mob.id);
    // Every write names its Mob when there is more than one; nobody can act in a Mob they are not in.
    for (const act of [(s) => s.invite('u2', {}), (s) => s.leave('u2', {}), (s) => s.patchMe('u2', { showScore: true }), (s) => s.nudge('u2', {}), (s) => s.startPaper('u2', {}), (s) => s.createExtra('u2', {})]) {
      await assert.rejects(act(svc), expectCode('MOB_REQUIRED'));
    }
    await assert.rejects(svc.invite('u3', { mob: a.mob.id }), expectCode('NOT_IN_MOB'));
    await assert.rejects(svc.invite('u2', { mob: 'not-a-uuid' }), expectCode('NOT_IN_MOB'));
    await assert.rejects(svc.patchMe('u3', { mob: b.mob.id, showScore: true }), expectCode('NOT_IN_MOB'));
    // A free student already in a Mob cannot join another; a friend with no Mob can.
    const inv = await svc.invite('u2', { mob: b.mob.id });
    await assert.rejects(svc.join('u1', { code: inv.code, name: 'Riya', colour: 1 }), expectCode('MOB_LIMIT'));
    assert.equal((await svc.join('u3', { code: inv.code, name: 'Kabir', colour: 2 })).mob.id, b.mob.id);
    assert.equal((await svc.join('u3', { code: inv.code, name: 'Kabir', colour: 2 })).mob.id, b.mob.id, 'opening the link of a Mob you are in just takes you there');
    // Leaving one Mob leaves the others.
    await svc.patchMe('u2', { mob: a.mob.id, name: 'Asha K' });
    assert.deepEqual(await svc.leave('u2', { mob: b.mob.id }), { left: true });
    const after = await svc.view('u2');
    assert.deepEqual(after.mob.mobs.map((m) => m.id), [a.mob.id, c.mob.id]);
    assert.equal(after.mob.you.name, 'Asha K');
    assert.equal((await svc.view('u3')).mob.you.role, 'owner', 'the earliest remaining member');
    // A lapsed Pro keeps the Mobs they are in and cannot start or join more.
    pro.delete('u2');
    const lapsed = await svc.view('u2');
    assert.equal(lapsed.mob.mobs.length, 2);
    assert.deepEqual([lapsed.mob.plan.pro, lapsed.mob.plan.canStartAnother, lapsed.mob.plan.canMakeExtra], [false, false, false]);
    await assert.rejects(mobStart(svc, 'u2', 'economics', 'Asha'), expectCode('MOB_LIMIT'));
  } finally { await db.close(); }
});

test('Pro can be in 3 Mobs by joining too; the cap is the same number on join', async () => {
  const db = await database(8);
  const clock = { now: NOW };
  const svc = createMobService({ ...baseDeps(db, clock), loadUser: async (id) => ({ isPremium: id === 'u1' }), startPractice: async () => ({}) });
  try {
    const invites = [];
    for (const [u, subject] of [['u2', 'accountancy'], ['u3', 'economics'], ['u4', 'accountancy'], ['u5', 'economics']]) {
      await mobStart(svc, u, subject, 'Host');
      invites.push(await svc.invite(u, {}));
    }
    for (const inv of invites.slice(0, 3)) await svc.join('u1', { code: inv.code, name: 'Pro', colour: 3 });
    await assert.rejects(svc.join('u1', { code: invites[3].code, name: 'Pro', colour: 3 }), expectCode('MOB_LIMIT_PRO'));
    assert.equal((await svc.view('u1')).mob.mobs.length, 3);
  } finally { await db.close(); }
});

test('the weekly Mob paper is free of credits, once a week per free student whichever Mob it is in, and Pro has no such limit', async () => {
  const db = await database(8);
  const clock = { now: NOW };
  const started = [];
  const pro = new Set(['u5']);
  let failNext = null;
  const svc = createMobService({
    ...baseDeps(db, clock), loadUser: async (id) => ({ isPremium: pro.has(id), creditBalance: 0 }),
    startPractice: async (userId, input, server) => {
      if (failNext) { const e = failNext; failNext = null; throw e; }
      started.push({ userId, input, server });
      return { id: 'practice_x', meta: { storage: 'device' } };
    },
  });
  try {
    // A free student with no credits at all can sit: the service never reads a balance.
    const a = await mobStart(svc, 'u1');
    assert.deepEqual(a.mob.week.paper.cost, { type: 'free' });
    assert.equal(costLine(a.mob.week.paper.cost), 'Free. No credits.');
    assert.equal(a.mob.week.paper.blocked, null);
    await svc.startPaper('u1', {});
    assert.equal(started.length, 1);
    assert.equal(started[0].server.mobPaper.extraId, undefined);
    await svc.startPaper('u1', {});
    assert.equal(started[1].input.generationKey, started[0].input.generationKey, 'a retry resumes the same session');
    assert.equal(await one(db, "select count(*)::int r from mob_free_claims where user_id = 'u1'"), 1);
    // Leaving and starting another Mob mid-week does not give a second free paper: the claim outlives the membership.
    await svc.leave('u1', {});
    await mobStart(svc, 'u1', 'economics', 'Riya');
    assert.equal((await svc.view('u1')).mob.week.paper.blocked, 'free_used');
    await assert.rejects(svc.startPaper('u1', {}), expectCode('FREE_PAPER_USED'));
    assert.equal(started.length, 2, 'the second Mob paper never reached the session engine');
    // Next week it is free again.
    clock.now += 7 * DAY;
    assert.equal((await svc.view('u1')).mob.week.paper.blocked, null);
    await svc.startPaper('u1', {});
    assert.equal(started.length, 3);
    // A start that fails gives the claim back, so the free paper is not lost to a bank hiccup.
    await mobStart(svc, 'u2', 'accountancy', 'Asha');
    failNext = new Error('INSUFFICIENT_PRACTICE_CONTENT');
    await assert.rejects(svc.startPaper('u2', {}), expectCode('PAPER_UNAVAILABLE'));
    assert.equal(await one(db, "select count(*)::int r from mob_free_claims where user_id = 'u2'"), 0);
    await svc.startPaper('u2', {});
    assert.equal(started.length, 4);
    // Pro sits a paper in every Mob the same week and never touches the free ledger.
    const first = await mobStart(svc, 'u5', 'accountancy', 'Pro');
    const second = await mobStart(svc, 'u5', 'economics', 'Pro');
    await svc.startPaper('u5', { mob: first.mob.id });
    await svc.startPaper('u5', { mob: second.mob.id });
    assert.equal(started.length, 6);
    assert.equal(await one(db, "select count(*)::int r from mob_free_claims where user_id = 'u5'"), 0);
  } finally { await db.close(); }
});

test('extra papers: only Pro makes them, any member sits them, 3 a Mob and week, a chosen chapter and length', async () => {
  const db = await database(8);
  const clock = { now: NOW };
  const started = [];
  const pro = new Set(['u1']);
  const svc = createMobService({
    ...baseDeps(db, clock), loadUser: async (id) => ({ isPremium: pro.has(id) }),
    startPractice: async (userId, input, server) => { started.push({ userId, input, server }); return { id: 'practice_x', meta: {} }; },
  });
  try {
    const made = await mobStart(svc, 'u1');
    const mob = made.mob.id;
    const link = await svc.invite('u1', {});
    await svc.join('u2', { code: link.code, name: 'Asha', colour: 1 });
    await svc.join('u3', { code: link.code, name: 'Kabir', colour: 2 });
    await assert.rejects(svc.createExtra('u2', { count: 5 }), expectCode('PRO_REQUIRED'));
    await assert.rejects(svc.createExtra('u1', { count: 7 }), expectCode('LENGTH_INVALID'));
    await assert.rejects(svc.createExtra('u1', { count: '10' }), expectCode('LENGTH_INVALID'));
    await assert.rejects(svc.createExtra('u1', { count: 5, chapter: 'Not a chapter' }), expectCode('CHAPTER_INVALID'));
    await assert.rejects(svc.createExtra('u1', { count: 5, chapter: 12 }), expectCode('CHAPTER_INVALID'));
    assert.deepEqual([...EXTRA_LENGTHS], [5, 10, 15, 20]);
    const r = await svc.createExtra('u1', { count: 5, chapter: 'Cash Flow Statement' });
    assert.match(r.extraId, /^[0-9a-f-]{36}$/);
    const mine = r.mob.extras[0];
    assert.deepEqual([mine.count, mine.chapter, mine.createdByYou, mine.youSat, mine.sat, mine.closed], [5, 'Cash Flow Statement', true, false, 0, false]);
    assert.equal(mine.closesAt, new Date(NOW + 7 * DAY).toISOString());
    const seen = (await svc.view('u2')).mob.extras[0];
    assert.deepEqual([seen.id, seen.createdByYou, seen.count], [r.extraId, false, 5]);
    assert.equal(JSON.stringify(seen).includes('u1'), false);
    // A free member sits it; it never touches the weekly paper or the free ledger.
    await svc.startPaper('u2', { extra: r.extraId });
    assert.equal(started.at(-1).server.mobPaper.extraId, r.extraId);
    assert.equal(started.at(-1).server.mobPaper.questions.length, 5);
    assert.equal(started.at(-1).input.count, 5);
    assert.equal(await one(db, "select count(*)::int r from mob_free_claims where user_id = 'u2'"), 0);
    await assert.rejects(svc.startPaper('u2', { extra: '00000000-0000-4000-8000-000000000000' }), expectCode('NOT_FOUND'));
    await assert.rejects(svc.startPaper('u2', { extra: 'bad' }), expectCode('NOT_FOUND'));
    await assert.rejects(svc.startPaper('u4', { extra: r.extraId }), expectCode('NOT_IN_MOB'));
    // Recording: through the finish hook, once, and a sitting after the window is not recorded.
    const bank5 = EXTRA_BANK.slice(0, 5);
    const att = sat(mob, WEEK, 'u2', bank5.map((q) => q.correctIndex), { extraId: r.extraId, bank: bank5 });
    assert.equal(await svc.recordFromAttempt('u2', att), 'recorded');
    assert.equal(await svc.recordFromAttempt('u2', att), 'exists');
    assert.equal(await svc.recordFromAttempt('u3', { ...att, userId: 'u3', completedAt: NOW + 8 * DAY }), 'late');
    await assert.rejects(svc.startPaper('u2', { extra: r.extraId }), expectCode('PAPER_ALREADY_SAT'));
    const after = (await svc.view('u2')).mob.extras[0];
    assert.deepEqual([after.youSat, after.sat, after.yourResultId], [true, 1, `att_u2_${r.extraId}`]);
    // 3 a Mob and week.
    for (let i = 1; i < EXTRA_MAX_PER_WEEK; i += 1) await svc.createExtra('u1', { count: 10 });
    await assert.rejects(svc.createExtra('u1', { count: 10 }), expectCode('EXTRA_LIMIT'));
    // The window: 7 days. Past it nobody can start it.
    clock.now = NOW + 8 * DAY;
    await assert.rejects(svc.startPaper('u3', { extra: r.extraId }), expectCode('EXTRA_CLOSED'));
    // Next week the Mob can make more; the closed ones are no longer listed.
    const next = await svc.createExtra('u1', { count: 15 });
    assert.equal(next.mob.extras.length, 1);
    assert.equal(next.mob.extras[0].count, 15);
  } finally { await db.close(); }
});

test('a durable-path extra sitting is credited when a member next reads the Mob', async () => {
  const db = await database(8);
  const clock = { now: NOW };
  const attempts = [];
  const svc = createMobService({ ...baseDeps(db, clock), loadUser: async (id) => ({ isPremium: id === 'u1' }), startPractice: async () => ({}), findAttempts: async (users, q) => attempts.filter((a) => users.includes(a.userId) && Boolean(a.selectionMeta.mobPaper.extraId) === Boolean(q.extraId)) });
  try {
    const made = await mobStart(svc, 'u1');
    const link = await svc.invite('u1', {});
    await svc.join('u2', { code: link.code, name: 'Asha', colour: 1 });
    const extra = await svc.createExtra('u1', { count: 5 });
    const bank5 = EXTRA_BANK.slice(0, 5);
    attempts.push(sat(made.mob.id, WEEK, 'u2', bank5.map((q) => q.correctIndex), { extraId: extra.extraId, bank: bank5 }));
    const read2 = (await svc.view('u1')).mob.extras[0];
    assert.equal(read2.sat, 1, 'found on read');
    assert.equal(read2.youSat, false);
  } finally { await db.close(); }
});

test('a sitting keeps seconds and changed answers from the device record, and nothing without one', () => {
  const att = sat(STUB_MOB, WEEK, 'u1', [0, 1, 2, 3, 0, 1, 2, 3, 0, 1], { changed: { q2: 2 } });
  const detail = detailFromAttempt(BANK.map((q) => q.id), att);
  assert.deepEqual(detail.t, Array(10).fill(10));
  assert.deepEqual(detail.c, [0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detailFromAttempt(BANK.map((q) => q.id), { selectionMeta: {} }), null);
  assert.equal(detailFromAttempt(BANK.map((q) => q.id), { selectionMeta: { recovery: { telemetry: 'inconsistent' } } }), null);
  assert.equal(detailFromAttempt([], att), null);
  const two = sat(STUB_MOB, WEEK, 'u1', [0, 1], { bank: BANK.slice(0, 2) });
  assert.equal(detailFromAttempt(['q1', 'q2', 'qX'], two).t.at(-1), -1, 'a question the device never showed has no time');
});

test('the teaser: where the Mob split, never who was right; 3 sitters or everyone sharing; named only between two who share', () => {
  const a = { user_id: 'a', picks: [0, 1, 2, 3] };
  const b = { user_id: 'b', picks: [0, 2, 2, 0] };
  const c = { user_id: 'c', picks: [1, 1, 2, 3] };
  const names = { a: 'Riya', b: 'Asha', c: 'Kabir' };
  const nameOf = (u) => names[u];
  // Two sitters who keep their answers private learn nothing about each other, not even a count.
  assert.equal(computeTeaser([a, b], { userId: 'a', share: new Set(), nameOf, count: 4 }), null);
  assert.equal(computeTeaser([a, b], { userId: 'a', share: new Set(['a']), nameOf, count: 4 }), null, 'only one of two shares');
  assert.equal(computeTeaser([b], { userId: 'b', share: new Set(['b']), nameOf, count: 4 }), null, 'a Mob of one');
  assert.equal(computeTeaser([a, b], { userId: 'z', share: new Set(['a', 'b']), nameOf, count: 4 }), null, 'you have not sat');
  // Both share: named, counting the two of you.
  const pair = computeTeaser([a, b], { userId: 'a', share: new Set(['a', 'b']), nameOf, count: 4 });
  assert.deepEqual(pair, { split: 2, of: 4, with: 'Asha' });
  assert.equal(teaserLine(pair), 'You and Asha split on 2 questions.');
  // Three sitters, nobody shares: the whole Mob, no names.
  const three = computeTeaser([a, b, c], { userId: 'a', share: new Set(), nameOf, count: 4 });
  assert.deepEqual(three, { split: 3, of: 4, with: null });
  assert.equal(teaserLine(three), 'Your Mob split on 3 of 4 questions.');
  // Three sitters and exactly one other shares with you: the two of you, named.
  assert.deepEqual(computeTeaser([a, b, c], { userId: 'a', share: new Set(['a', 'c']), nameOf, count: 4 }), { split: 1, of: 4, with: 'Kabir' });
  // Two others share: the whole Mob, no names.
  assert.equal(computeTeaser([a, b, c], { userId: 'a', share: new Set(['a', 'b', 'c']), nameOf, count: 4 }).with, null);
  assert.equal(teaserLine({ split: 0, of: 4, with: 'Asha' }), 'You and Asha picked the same on every question.');
  assert.equal(teaserLine({ split: 0, of: 4, with: null }), 'Your Mob picked the same on every question.');
  assert.equal(teaserLine({ split: 1, of: 4, with: 'Asha' }), 'You and Asha split on 1 question.');
  for (const line of [teaserLine(pair), teaserLine(three)]) assert.doesNotMatch(line, /[!→—]|better|worse|ahead|behind|rank|won|lost/i, line);
});

test('plans on the side-by-side: Pro opens everything, a free student gets one sample and the teaser, the rest is Pro', () => {
  const sittings = [{ user_id: 'a', picks: [0, 1] }, { user_id: 'b', picks: [0, 2] }];
  const members = [{ user_id: 'a', show_score: true }, { user_id: 'b', show_score: true }];
  const base = { sittings, userId: 'a', members, nameOf: () => 'Asha', count: 2, mobId: 'm', week: WEEK };
  assert.equal(compareSummary({ ...base, pro: true, sample: { mob_id: 'other', week_start: '2020-01-06' } }).access, 'full');
  assert.equal(compareSummary({ ...base, pro: false, sample: null }).access, 'offer');
  assert.equal(compareSummary({ ...base, pro: false, sample: { mob_id: 'm', week_start: WEEK } }).access, 'sample');
  assert.equal(compareSummary({ ...base, pro: false, sample: { mob_id: 'm', week_start: '2026-10-05' } }).access, 'locked');
  assert.equal(compareSummary({ ...base, pro: false, sample: { mob_id: 'x', week_start: WEEK } }).access, 'locked');
  assert.equal(compareSummary({ ...base, pro: false, sample: null }).teaser.text, 'You and Asha split on 1 question.', 'the teaser is free');
  assert.equal(compareSummary({ ...base, sittings: [sittings[0]], pro: false, sample: null }).available, false);
  assert.equal(compareSummary({ ...base, members: [{ user_id: 'a', show_score: false }, members[1]], pro: false, sample: null }).needsShare, true);
  assert.equal(compareSummary({ ...base, pro: false, sample: null }).needsShare, false);
  assert.deepEqual([...sharingSet(members)], ['a', 'b']);
});

test('the side-by-side on a real Mob: reciprocal sharing, nobody named who keeps answers private, one free sample, history is Pro', async () => {
  const db = await database(8);
  const clock = { now: NOW };
  const pro = new Set(['u1']);
  const svc = createMobService({
    ...baseDeps(db, clock), loadUser: async (id) => ({ isPremium: pro.has(id) }), startPractice: async () => ({}),
    trapNameFor: async (q, i) => (q.id === 'q2' && i === 3 ? 'A look-alike term' : null),
  });
  const right = BANK.map((q) => q.correctIndex);
  const trap = [...right]; trap[1] = 3; // three of us pick D on question 2 (key B)
  const miss = [...trap]; miss[4] = 2; // one member also misses question 5
  try {
    const made = await mobStart(svc, 'u1', 'accountancy', 'Riya');
    const mob = made.mob.id;
    const link = await svc.invite('u1', {});
    for (const [u, name] of [['u2', 'Asha'], ['u3', 'Kabir'], ['u4', 'Meera']]) await svc.join(u, { code: link.code, name, colour: 1 });
    await svc.startPaper('u1', {}); // freezes the paper
    // Before anyone sat, and with one sitter.
    await assert.rejects(svc.compare('u1', {}), expectCode('NOT_SAT_YET'));
    assert.equal(await svc.recordFromAttempt('u1', sat(mob, WEEK, 'u1', trap, { changed: { q2: 1 } })), 'recorded');
    await assert.rejects(svc.compare('u1', {}), expectCode('COMPARE_UNAVAILABLE'));
    await svc.recordFromAttempt('u2', sat(mob, WEEK, 'u2', trap));
    await svc.recordFromAttempt('u3', sat(mob, WEEK, 'u3', miss));
    // The view: the teaser for a sitter (3 sat, so it counts the whole Mob), nothing for Meera, who has not sat.
    const v1 = (await svc.view('u1')).mob;
    assert.equal(v1.compare.available, true);
    assert.equal(v1.compare.access, 'full');
    assert.deepEqual(v1.compare.teaser, { split: 1, of: 10, with: null, text: 'Your Mob split on 1 of 10 questions.' });
    assert.equal((await svc.view('u4')).mob.compare, null);
    await assert.rejects(svc.compare('u4', {}), expectCode('NOT_SAT_YET'));
    await assert.rejects(svc.compare('u5', {}), expectCode('NOT_IN_MOB'));

    // Pro, nobody sharing: your own row and how the Mob picked, with the others counted, never named.
    const quiet = (await svc.compare('u1', {})).compare;
    assert.equal(quiet.access, 'full');
    assert.equal(quiet.youShare, false);
    assert.equal(quiet.hidden, 2);
    assert.equal(quiet.questions.length, 10);
    assert.deepEqual(quiet.questions[1].you, { picked: 'D', right: false, changed: 1, seconds: 10 });
    assert.deepEqual(quiet.questions[1].others, []);
    assert.deepEqual(quiet.questions[1].picks, [{ option: 'D', count: 3 }], 'counts per option, no names');
    assert.equal(quiet.questions[1].trap.trapName, 'A look-alike term');
    assert.deepEqual([quiet.questions[1].trap.option, quiet.questions[1].trap.count, quiet.questions[1].trap.of], ['D', 3, 3]);
    assert.equal(quiet.questions[4].split, true);
    assert.equal(quiet.questions[0].stem, 'Question 1 stem');
    assert.equal(quiet.questions[1].key, 'B');
    // Sharing is reciprocal: Riya shares, Asha shares, Kabir keeps his private.
    await svc.patchMe('u1', { showScore: true });
    await svc.patchMe('u2', { showScore: true });
    const shared = (await svc.compare('u1', {})).compare;
    assert.equal(shared.youShare, true);
    assert.equal(shared.hidden, 1, 'Kabir keeps his answers private: counted, never named');
    assert.deepEqual(shared.questions[1].others.map((o) => [o.name, o.picked, o.right, o.changed, o.seconds]), [['Asha', 'D', false, 0, 10]]);
    const everything = JSON.stringify(shared);
    for (const leak of ['Kabir', 'Meera', '"u1"', '"u2"', 'u3', 'u4', 'att_u2', 'att_u3', 'att_u4', 'user_id', 'session_id']) assert.equal(everything.includes(leak), false, leak);
    assert.equal(shared.questions[3].others[0].right, true);
    // Free students: the teaser always, the side-by-side once.
    assert.equal((await svc.view('u2')).mob.compare.access, 'offer');
    assert.equal((await svc.view('u2')).mob.trap, null, 'the shared trap is part of the side-by-side, not the teaser');
    assert.notEqual((await svc.view('u1')).mob.trap, null, 'Pro sees it');
    await assert.rejects(svc.compare('u3', {}), expectCode('SHARE_FIRST'));
    assert.equal(await one(db, "select count(*)::int r from mob_samples where user_id = 'u3'"), 0, 'a refused open does not spend the sample');
    const first = (await svc.compare('u2', {})).compare;
    assert.equal(first.access, 'sample');
    assert.deepEqual(first.questions[1].others.map((o) => o.name), ['Riya']);
    assert.equal((await svc.compare('u2', {})).compare.access, 'sample', 'opening the same week again stays free');
    assert.equal((await svc.view('u2')).mob.compare.access, 'sample');
    assert.notEqual((await svc.view('u2')).mob.trap, null, 'the sample week unlocks the trap');
    // Past weeks and a second week's comparison are Pro.
    await assert.rejects(svc.history('u2', {}), expectCode('PRO_REQUIRED'));
    clock.now += 7 * DAY;
    await svc.startPaper('u1', {});
    for (const u of ['u1', 'u2', 'u3']) await svc.recordFromAttempt(u, sat(mob, WEEK2, u, right, { completedAt: clock.now + 60_000, session: `w2_${u}` }));
    await assert.rejects(svc.compare('u2', {}), expectCode('PRO_REQUIRED'));
    assert.equal((await svc.compare('u2', { week: WEEK })).compare.access, 'sample', 'the sample week stays openable');
    assert.equal((await svc.compare('u1', {})).compare.week, WEEK2);
    assert.equal((await svc.compare('u1', { week: WEEK })).compare.week, WEEK);
    for (const bad of ['2026-10-13', 'abc', '2030-01-05', '2026-10-26']) await assert.rejects(svc.compare('u1', { week: bad }), expectCode('NOT_FOUND'), bad);
    const hist = await svc.history('u1', {});
    assert.deepEqual(hist.weeks.map((w) => [w.week, w.sat, w.you.sat, w.you.score]), [[WEEK, 3, true, { value: 9, of: 10 }]]);
    assert.equal(hist.weeks[0].closedAt, closesAt(WEEK));
    assert.equal(JSON.stringify(hist).includes('u2'), false);
    await assert.rejects(svc.history('u5', {}), expectCode('NOT_IN_MOB'));
    // An extra paper compares the same way, on the same plan rules.
    const extra = await svc.createExtra('u1', { count: 5, chapter: 'Partnership Accounts' });
    const bank5 = EXTRA_BANK.slice(0, 5);
    for (const u of ['u1', 'u2']) await svc.recordFromAttempt(u, sat(mob, WEEK2, u, bank5.map((q) => q.correctIndex), { extraId: extra.extraId, bank: bank5, completedAt: clock.now + 120_000 }));
    const ex = (await svc.compare('u1', { extra: extra.extraId })).compare;
    assert.deepEqual([ex.kind, ex.extraId, ex.chapter, ex.questions.length], ['extra', extra.extraId, 'Partnership Accounts', 5]);
    await assert.rejects(svc.compare('u2', { extra: extra.extraId }), expectCode('PRO_REQUIRED'), 'the sample was spent on the weekly paper of week 1');
    await assert.rejects(svc.compare('u4', { extra: extra.extraId }), expectCode('NOT_SAT_YET'));
    await assert.rejects(svc.compare('u5', { extra: extra.extraId }), expectCode('NOT_FOUND'));
  } finally { await db.close(); }
});

test('buildCompare: the payload never carries user ids and never reads a private member', () => {
  const members = [
    { user_id: 'a', display_name: 'Riya', colour: 0, show_score: true }, { user_id: 'b', display_name: 'Asha', colour: 1, show_score: false },
    { user_id: 'c', display_name: 'Kabir', colour: 2, show_score: true },
  ];
  const sittings = [
    { user_id: 'a', picks: [0, 1], detail: { t: [12, -1], c: [0, 3] } }, { user_id: 'b', picks: [0, 3], detail: { t: [5, 6], c: [1, 1] } },
    { user_id: 'c', picks: [1, 1], detail: null },
  ];
  const out = buildCompare({
    members, sittings, ids: ['q1', 'q2'], questions: [{ id: 'q1', stem: 'x'.repeat(300), correctIndex: 0 }, { id: 'q2', stem: 'Two', correctIndex: 1 }],
    userId: 'a', memberIdFor: (u) => `M-${u}`, access: 'full', week: WEEK,
  });
  assert.equal(out.questions[0].stem.length <= 110, true);
  assert.deepEqual(out.questions[0].you, { picked: 'A', right: true, changed: 0, seconds: 12 });
  assert.deepEqual(out.questions[1].you, { picked: 'B', right: true, changed: 3, seconds: null }, 'an unknown time is null, not 0');
  assert.deepEqual(out.questions[0].others.map((o) => o.name), ['Kabir'], 'Asha keeps her answers private');
  assert.deepEqual(out.questions[0].others[0], { memberId: 'M-c', name: 'Kabir', colour: 2, picked: 'B', right: false, changed: null, seconds: null });
  assert.equal(out.hidden, 1);
  assert.equal(JSON.stringify(out).includes('"a"'), false);
  assert.equal(JSON.stringify(out).includes('Asha'), false);
  const alone = buildCompare({ members, sittings, ids: ['q1', 'q2'], questions: [{ id: 'q1', stem: 'One', correctIndex: 0 }], userId: 'b', memberIdFor: (u) => u, access: 'full', week: WEEK });
  assert.equal(alone.questions.length, 1, 'a question the bank could not load is left out, never guessed');
  assert.deepEqual(alone.questions[0].others, [], 'Asha does not share, so she is not shown anyone');
  assert.equal(alone.hidden, 2);
});

// ---------------------------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------------------------

const req = (method = 'GET', body) => new Request('http://localhost/api/mob', { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const httpDeps = ({ allow = true, user = 'u1', service = {} } = {}) => ({
  enabled: () => true, auth: async () => (user ? { user: { id: user } } : null), cors: () => ({}), service,
  rateLimit: async (_r, opts) => (allow === true || (Array.isArray(allow) && allow.includes(opts.route)) ? { allowed: true } : { allowed: false }),
});

test('routes: the new routes, the mob query, and the limits that stop a free paper being farmed', async () => {
  const seen = [];
  const service = {
    view: async (u, o) => { seen.push(['view', u, o]); return { mob: null }; },
    compare: async (u, q) => { seen.push(['compare', u, q]); return { compare: {} }; },
    history: async (u, q) => { seen.push(['history', u, q]); return { weeks: [] }; },
    createExtra: async (u, b) => { seen.push(['extra', u, b]); return {}; },
  };
  await handleMob(httpDeps({ service }), 'get', new Request('http://localhost/api/mob?mob=abc'), {});
  await handleMob(httpDeps({ service }), 'compare', new Request('http://localhost/api/mob/compare?mob=m&week=2026-10-12&extra=x'), {});
  await handleMob(httpDeps({ service }), 'history', new Request('http://localhost/api/mob/history?mob=m'), {});
  const made = await handleMob(httpDeps({ service }), 'extra', req('POST', { mob: 'm', count: 5 }), {});
  assert.equal(made.status, 201);
  assert.deepEqual(seen, [['view', 'u1', { mobId: 'abc' }], ['compare', 'u1', { mob: 'm', week: '2026-10-12', extra: 'x' }], ['history', 'u1', { mob: 'm' }], ['extra', 'u1', { mob: 'm', count: 5 }]]);
  assert.deepEqual([LIMITS.create.limit, LIMITS.create.windowMs, LIMITS.extra.limit], [3, 7 * DAY, 6]);
  const res = await handleMob(httpDeps({ allow: ['/api/mob:write'] }), 'create', req('POST', {}), {});
  assert.equal(res.status, 429, 'starting Mobs is capped at 3 a week');
  assert.equal(res.headers.get('retry-after'), String(7 * 86_400));
  const limitedExtra = await handleMob(httpDeps({ allow: ['/api/mob:write'] }), 'extra', req('POST', {}), {});
  assert.equal(limitedExtra.status, 429);
  const proOnly = { compare: async () => { const { MobError } = await import('../../src/lib/mob/model.mjs'); throw new MobError('PRO_REQUIRED'); } };
  const refused = await handleMob(httpDeps({ service: proOnly }), 'compare', new Request('http://localhost/api/mob/compare'), {});
  assert.equal(refused.status, 402);
  assert.equal((await refused.json()).error.code, 'PRO_REQUIRED');
});

test('the join page greets a signed-in student with who invited them, and the public page never names anyone', async () => {
  const db = await database(8);
  const clock = { now: NOW };
  const svc = createMobService({ ...baseDeps(db, clock), loadUser: async () => ({ isPremium: false }), startPractice: async () => ({}) });
  try {
    await mobStart(svc, 'u1', 'accountancy', 'Riya Sharma');
    const inv = await svc.invite('u1', {});
    const pub = await svc.lookup(inv.code);
    assert.equal('inviter' in pub, false);
    assert.equal((await svc.lookup(inv.code, { viewerId: 'u2' })).inviter, 'Riya Sharma');
    const anon = await handleMob({ ...httpDeps({ user: null }), service: svc }, 'lookup', new Request('http://localhost/api/mob/join/x'), { code: inv.code });
    const anonText = await anon.text();
    assert.equal(anon.status, 200);
    assert.equal(anonText.includes('Riya'), false, 'the public join page carries no name');
    const signed = await handleMob({ ...httpDeps({ user: 'u2' }), service: svc }, 'lookup', new Request('http://localhost/api/mob/join/x'), { code: inv.code });
    const body = await signed.json();
    assert.equal(body.inviter, 'Riya Sharma');
    assert.equal(JSON.stringify(body).includes('memberId'), false);
    // An expired link says nothing about who made it, signed in or not.
    clock.now += 8 * DAY;
    await assert.rejects(svc.lookup(inv.code, { viewerId: 'u2' }), expectCode('INVITE_EXPIRED'));
  } finally { await db.close(); }
});
