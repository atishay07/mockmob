// The Mob fixes of 17 Oct (go/no-go check 20261017T075524, CTO decisions): sharing on by default with the undo, a full
// Mob says full, rate limits that count only successful starts and extra papers and say the real wait, the
// MOB_INVITES_ENABLED stop switch, plain error codes for weeks and extra papers, a thin bank offering the nearest paper,
// the departures count and the /admin/funnel Mob block, and the paper's real duration.
// Run: node --test data/tests/mob_fix_1017.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERRORS, PAPER_COUNT, PAPER_SECONDS, errorBody, paperLine, tooLateToStart, waitPhrase } from '../../src/lib/mob/model.mjs';
import { createMobService, longestFor, thinBank } from '../../src/lib/server/mob/service.js';
import { LIMITS, handleMob, limitMessage } from '../../src/lib/server/mob/http.js';
import { MIN_REPORTABLE, summariseMobMetrics } from '../../src/lib/mob/metrics.mjs';
import { TEST_MODES } from '../../data/test_modes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const base = read('supabase/migrations/20261017100000_mob.sql');
const fix = read('supabase/migrations/20261017190000_mob_fix_1017.sql');
const fixUndo = read('supabase/undo/20261017190000_mob_fix_1017.undo.sql');
const guard = read('supabase/migrations/20261002121000_runtime_ai_guard.sql');
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

const NOW = Date.parse('2026-10-13T14:00:00Z'); // Tuesday 13 Oct 2026, 7:30 PM IST
const WEEK = '2026-10-12';

async function database(users = 8, { withFix = true } = {}) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(`create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,${users}) g;`);
  await db.exec(base);
  if (withFix) await db.exec(fix);
  return db;
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]?.r;
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const values = keys.map((k) => { const v = params[k]; if (k === 'p_picks') return `{${v.join(',')}}`; return v && typeof v === 'object' ? JSON.stringify(v) : v; });
    return (await db.query(`select public.${name}(${args}) as r`, values)).rows[0].r;
  };
}
const BANK = Array.from({ length: 20 }, (_, i) => ({ id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1}`, options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: t })) }));
let drawn = 0;
const deps = (db, extra = {}) => ({
  rpc: pgRpc(db), now: () => NOW, secret: 'test-secret', blocklist,
  randomBytes: (n) => { drawn += 1; return Uint8Array.from({ length: n }, (_, i) => (drawn * 53 + i * 37) % 256); },
  subjectInfo: (s) => (['accountancy', 'economics'].includes(s) ? { ok: true, id: s, name: s[0].toUpperCase() + s.slice(1) } : { ok: false }),
  loadUser: async (id) => ({ subjects: ['accountancy', 'economics'], isPremium: id === 'u1' }),
  validChapter: (subject, chapter) => subject === 'accountancy' && ['Share Capital', 'Debentures', 'Cash Flow Statement'].includes(chapter),
  pickQuestionIds: async (_s, { count = 10 } = {}) => BANK.slice(0, count).map((q) => q.id),
  loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
  trapNameFor: async () => null, findAttempts: async () => [], startPractice: async () => ({}),
  ...extra,
});
const expectCode = (code) => (e) => e?.code === code;
const req = (method = 'POST', body) => new Request('http://localhost/api/mob', { method, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });

// ---------------------------------------------------------------------------------------------------------------

test('sharing is on by default; the fix moves existing rows once, and the undo turns off exactly those', async () => {
  const db = await database(6, { withFix: false });
  try {
    // Before the fix: two members at the old default (off), one who chose to share.
    await db.query("select mob_create('u1','accountancy','Riya',0::smallint,1)");
    const mob = await one(db, 'select id::text r from mobs');
    await db.query("select mob_invite_new('u1',$1::uuid,'AAAAAAAA',now() + interval '7 days')", [mob]);
    await db.query("select mob_join('u2','AAAAAAAA','Asha',1::smallint,1)");
    await db.query("select mob_join('u3','AAAAAAAA','Kabir',2::smallint,1)");
    await db.exec("update mob_members set show_score = true where user_id = 'u3'");
    await db.exec(fix);
    assert.deepEqual((await db.query('select user_id, show_score, share_moved_1017 from mob_members order by user_id')).rows,
      [{ user_id: 'u1', show_score: true, share_moved_1017: true }, { user_id: 'u2', show_score: true, share_moved_1017: true }, { user_id: 'u3', show_score: true, share_moved_1017: false }]);
    assert.equal(await one(db, 'select created_by r from mobs'), 'u1', 'the owner is recorded as who started it');
    // A member who turns sharing off after the move stays off when the file runs again; a new member shares.
    await db.exec("update mob_members set show_score = false where user_id = 'u2'");
    await db.exec(fix);
    assert.equal(await one(db, "select show_score r from mob_members where user_id = 'u2'"), false);
    await db.query("select mob_join('u4','AAAAAAAA','Meera',3::smallint,12)");
    assert.equal(await one(db, "select show_score r from mob_members where user_id = 'u4'"), true);
    // The undo: off again only for the rows the fix moved (u1), never for someone who chose to share (u3).
    await db.exec(fixUndo);
    assert.deepEqual((await db.query('select user_id, show_score from mob_members order by user_id')).rows.map((r) => [r.user_id, r.show_score]),
      [['u1', false], ['u2', false], ['u3', true], ['u4', true]]);
    // Re-applying is clean.
    await db.exec(fix);
    assert.equal(await one(db, 'select count(*)::int r from mob_data_moves'), 2);
  } finally { await db.close(); }
});

test('a full Mob says full on the join page and on join, before anything about the link', async () => {
  const db = await database(8);
  const svc = createMobService(deps(db));
  try {
    const made = await svc.create('u2', { subject: 'accountancy', name: 'Riya', colour: 0 });
    const link = await svc.invite('u2', {});
    for (const [u, name] of [['u3', 'Asha'], ['u4', 'Kabir'], ['u5', 'Meera'], ['u6', 'Dev']]) await svc.join(u, { code: link.code, name, colour: 1 });
    assert.equal((await svc.view('u2')).mob.week.size, 5);
    await assert.rejects(svc.lookup(link.code), expectCode('MOB_FULL'));
    await assert.rejects(svc.join('u7', { code: link.code, name: 'Isha', colour: 2 }), expectCode('MOB_FULL'));
    assert.match(ERRORS.MOB_FULL[1], /full/);
    assert.notEqual(ERRORS.MOB_FULL[1], ERRORS.INVITE_EXPIRED[1]);
    // A seat opens: the same link is used up (it allowed the seats there were), so the joiner hears that instead.
    await svc.leave('u6', {});
    await assert.rejects(svc.join('u7', { code: link.code, name: 'Isha', colour: 2 }), expectCode('INVITE_EXPIRED'));
    assert.ok(made.mob.id);
  } finally { await db.close(); }
});

test('leaving and removal are counted with no user id', async () => {
  const db = await database(6);
  const svc = createMobService(deps(db));
  try {
    await svc.create('u2', { subject: 'accountancy', name: 'Riya', colour: 0 });
    const link = await svc.invite('u2', {});
    for (const [u, name] of [['u3', 'Asha'], ['u4', 'Kabir']]) await svc.join(u, { code: link.code, name, colour: 1 });
    await svc.leave('u3', {});
    const kabir = (await svc.view('u2')).mob.members.find((m) => m.name === 'Kabir');
    await svc.remove('u2', { memberId: kabir.memberId });
    const rows = (await db.query('select * from mob_departures order by id')).rows;
    assert.deepEqual(rows.map((r) => r.kind), ['left', 'removed']);
    for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['id', 'joined_at', 'kind', 'left_at', 'mob_id'], 'no user column');
  } finally { await db.close(); }
});

test('the stop switch: MOB_INVITES_ENABLED=false pauses new links and joining; the Mob works as before', async () => {
  const db = await database(6);
  let on = true;
  const svc = createMobService(deps(db, { invitesEnabled: () => on }));
  try {
    await svc.create('u2', { subject: 'accountancy', name: 'Riya', colour: 0 });
    const link = await svc.invite('u2', {});
    assert.equal(Object.hasOwn((await svc.view('u2')).mob, 'invitesPaused'), false, 'the shape is unchanged while invites are on');
    on = false;
    await assert.rejects(svc.invite('u2', {}), expectCode('INVITES_PAUSED'));
    await assert.rejects(svc.lookup(link.code), expectCode('JOIN_PAUSED'));
    await assert.rejects(svc.join('u3', { code: link.code, name: 'Asha', colour: 1 }), expectCode('JOIN_PAUSED'));
    const v = (await svc.view('u2')).mob;
    assert.equal(v.invitesPaused, true);
    assert.equal(v.invite, null, 'the old link is not shown while paused');
    assert.ok(await svc.patchMe('u2', { name: 'Riya K' }), 'everything else works');
    on = true;
    assert.equal((await svc.join('u3', { code: link.code, name: 'Asha', colour: 1 })).mob.week.size, 2);
  } finally { await db.close(); }
});

test('extra papers: a thin chapter says how many are ready and offers the nearest paper; the chooser lists what can be made', async () => {
  assert.deepEqual([longestFor(4), longestFor(5), longestFor(7), longestFor(14), longestFor(40)], [null, 5, 5, 10, 20]);
  const seven = thinBank({ ready: 7, count: 10, chapter: 'Debentures' });
  assert.equal(seven.code, 'BANK_THIN');
  assert.equal(seven.extra.message, 'Debentures has 7 questions ready right now, enough for a 5-question paper. Make a 5-question paper instead, or use the whole subject.');
  assert.deepEqual(seven.extra.detail, { ready: 7, asked: 10, suggest: { chapter: 'Debentures', count: 5 } });
  const three = thinBank({ ready: 3, count: 10, chapter: 'Debentures' });
  assert.match(three.extra.message, /too few for a paper\. Make it from the whole subject/);
  assert.deepEqual(three.extra.detail.suggest, { chapter: null, count: 10 });
  assert.match(thinBank({ ready: 0, count: 10, subjectName: 'Accountancy' }).extra.message, /^Accountancy has no questions ready/);

  const db = await database(6);
  const svc = createMobService(deps(db, {
    pickQuestionIds: async (_s, { count = 10, chapter = null } = {}) => BANK.slice(0, chapter === 'Debentures' ? Math.min(count, 7) : count).map((q) => q.id),
    chapterCounts: async () => [{ chapter: 'Share Capital', ready: 21 }, { chapter: 'Debentures', ready: 7 }, { chapter: 'Goodwill Valuation', ready: 2 }, { chapter: 'Not a chapter', ready: 50 }, { chapter: 'Cash Flow Statement', ready: 10 }],
  }));
  try {
    await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 0 });
    await assert.rejects(svc.createExtra('u1', { chapter: 'Debentures', count: 10 }), (e) => e.code === 'BANK_THIN' && e.extra.detail.suggest.count === 5);
    const made = await svc.createExtra('u1', { chapter: 'Debentures', count: 5 });
    assert.ok(made.extraId, 'the suggested paper can be made');
    const list = await svc.chapters('u1', {});
    assert.deepEqual(list.chapters, [
      { chapter: 'Share Capital', ready: 21, longest: 20 }, { chapter: 'Cash Flow Statement', ready: 10, longest: 10 }, { chapter: 'Debentures', ready: 7, longest: 5 },
    ], 'only chapters of the syllabus that can make a paper, fullest first');
    await svc.join('u2', { code: (await svc.invite('u1', {})).code, name: 'Asha', colour: 1 });
    await assert.rejects(svc.chapters('u2', {}), expectCode('PRO_REQUIRED'));
    // Through the route: the sentence and the suggestion reach the screen, the cause never does.
    const res = await handleMob({ enabled: () => true, auth: async () => ({ user: { id: 'u1' } }), rateLimit: async () => ({ allowed: true }), service: svc }, 'extra', req('POST', { chapter: 'Debentures', count: 10 }));
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'BANK_THIN');
    assert.match(body.error.message, /^Debentures has 7 questions ready/);
    assert.deepEqual(body.error.detail.suggest, { chapter: 'Debentures', count: 5 });
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Rate limits that count only successful actions, and say the real wait
// ---------------------------------------------------------------------------------------------------------------

function limiter({ allow = () => true, wait = null } = {}) {
  const taken = [];
  const given = [];
  return {
    taken, given,
    deps: (service, user = 'u1') => ({
      enabled: () => true, auth: async () => ({ user: { id: user } }), cors: () => ({}), now: () => NOW, service,
      rateLimit: async (_r, o) => { taken.push(o.route); return allow(o.route) ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 }; },
      giveBack: async (_r, o) => { given.push(o.route); },
      waitFor: async () => wait,
    }),
  };
}
const fails = (code) => ({ create: async () => { const { MobError } = await import('../../src/lib/mob/model.mjs'); throw new MobError(code); }, createExtra: async () => { const { MobError } = await import('../../src/lib/mob/model.mjs'); throw new MobError(code); } });

test('starting a Mob and making an extra paper count only when they succeed', async () => {
  assert.deepEqual([LIMITS.create.success, LIMITS.extra.success, Boolean(LIMITS.write.success), Boolean(LIMITS.invite.success)], [true, true, false, false]);
  for (const code of ['NAME_INVALID', 'NAME_REFUSED', 'SUBJECT_INVALID', 'MOB_LIMIT', 'UNAVAILABLE']) {
    const l = limiter();
    const res = await handleMob(l.deps(fails(code)), 'create', req('POST', { name: 'x' }));
    assert.equal(res.status, ERRORS[code][0]);
    assert.deepEqual(l.given, ['/api/mob:create'], `${code}: the start is given back, the write limit is not`);
  }
  const bad = limiter();
  assert.equal((await handleMob(bad.deps({}), 'create', req('POST', '{nope'))).status, 422);
  assert.deepEqual(bad.given, ['/api/mob:create'], 'a body that does not parse is given back too');
  const ok = limiter();
  assert.equal((await handleMob(ok.deps({ create: async () => ({ mob: null }) }), 'create', req('POST', {}))).status, 201);
  assert.deepEqual(ok.given, [], 'a Mob that was started keeps its count');
  const extra = limiter();
  await handleMob(extra.deps(fails('BANK_THIN')), 'extra', req('POST', { count: 10 }));
  assert.deepEqual(extra.given, ['/api/mob:extra']);
  // 18 Oct: create takes write first (it counts every try, so the plan gate before create is counted). A refused write
  // never reaches the create limit, so there is nothing to give back.
  const writes = limiter({ allow: (r) => r !== '/api/mob:write' });
  assert.equal((await handleMob(writes.deps({ create: async () => ({ mob: null }) }), 'create', req('POST', {}))).status, 429);
  assert.deepEqual(writes.given, []);
  // A later limit refusing the request gives the earlier success-only count back: nothing happened (extra: extra, then write).
  const extraWrites = limiter({ allow: (r) => r !== '/api/mob:write' });
  assert.equal((await handleMob(extraWrites.deps({ createExtra: async () => ({}) }), 'extra', req('POST', { count: 10 }))).status, 429);
  assert.deepEqual(extraWrites.given, ['/api/mob:extra']);
  // Three typos in a row never reach the weekly cap: the fourth real start still goes through.
  const counts = new Map();
  const real = {
    enabled: () => true, auth: async () => ({ user: { id: 'u1' } }), cors: () => ({}),
    rateLimit: async (_r, o) => { const n = (counts.get(o.route) || 0) + 1; counts.set(o.route, n); return { allowed: n <= o.limit }; },
    giveBack: async (_r, o) => { counts.set(o.route, counts.get(o.route) - 1); },
  };
  for (let i = 0; i < 3; i += 1) await handleMob({ ...real, service: fails('NAME_INVALID') }, 'create', req('POST', {}));
  for (let i = 0; i < 3; i += 1) assert.equal((await handleMob({ ...real, service: { create: async () => ({ mob: null }) } }, 'create', req('POST', {}))).status, 201);
  assert.equal((await handleMob({ ...real, service: { create: async () => ({ mob: null }) } }, 'create', req('POST', {}))).status, 429, 'the fourth start in a week is refused');
});

test('a refused limit says the real wait in plain words, and Retry-After matches it', async () => {
  assert.equal(waitPhrase(30, NOW), 'in a minute');
  assert.equal(waitPhrase(25 * 60, NOW), 'in 25 minutes');
  assert.equal(waitPhrase(70 * 60, NOW), 'in about an hour');
  assert.equal(waitPhrase(5 * 3600, NOW), 'in 5 hours');
  assert.equal(waitPhrase(3 * 86_400 + 2 * 3600, NOW), 'on Fri 16 Oct, 9:30 PM');
  const week = limiter({ allow: (r) => r !== '/api/mob:create', wait: 3 * 86_400 + 2 * 3600 });
  const res = await handleMob(week.deps({}), 'create', req('POST', {}));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), String(3 * 86_400 + 2 * 3600));
  const body = await res.json();
  assert.equal(body.error.code, 'RATE_LIMITED');
  assert.equal(body.error.message, 'You started 3 Mobs in the last 7 days, the most a week allows. You can start another on Fri 16 Oct, 9:30 PM.');
  // No readable wait (the store did not answer): the limiter's own number, never a made-up one.
  const unknown = limiter({ allow: () => false, wait: null });
  const r2 = await handleMob(unknown.deps({}), 'invite', req('POST', {}));
  assert.equal(r2.headers.get('retry-after'), '60');
  assert.match((await r2.json()).error.message, /You can make a new one in a minute\.$/);
  for (const name of Object.keys(LIMITS)) {
    const line = limitMessage(name, 'in 5 hours');
    assert.doesNotMatch(line, /[!→]|->|—/, name);
    assert.match(line, /in 5 hours/, name);
  }
});

test('the rate-limit helpers on the real limiter table: give back once, read the reset time', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(guard.match(/create table public\.persistent_rate_limits[^;]+;/)[0]);
    await db.exec(guard.match(/create function public\.take_rate_limit[\s\S]+?end \$\$;/)[0]);
    await db.exec('create table public.users (id text primary key);');
    await db.exec(base);
    await db.exec(fix);
    const take = () => one(db, "select take_rate_limit('b', 2, 60000) r");
    assert.deepEqual([await take(), await take(), await take()], [true, true, false]);
    assert.equal(await one(db, "select rate_limit_give_back('b') r"), true);
    assert.equal(await one(db, "select count r from persistent_rate_limits where bucket = 'b'"), 2);
    assert.ok(await one(db, "select rate_limit_reset_at('b') r"));
    assert.equal(await one(db, "select rate_limit_reset_at('nobody') r"), null);
    assert.equal(await one(db, "select rate_limit_give_back('nobody') r"), false);
    await db.exec("update persistent_rate_limits set count = 0 where bucket = 'b'");
    await db.query("select rate_limit_give_back('b')");
    assert.equal(await one(db, "select count r from persistent_rate_limits where bucket = 'b'"), 0, 'never below zero');
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// The paper's real duration, the error copy, the funnel block
// ---------------------------------------------------------------------------------------------------------------

test('the paper lasts what the runner shows: 10 questions, 10 minutes', () => {
  assert.equal(PAPER_SECONDS, PAPER_COUNT * TEST_MODES.quick.durationPerQuestionSec);
  assert.equal(paperLine(), '10 questions, 10 minutes');
  assert.equal(paperLine(5), '5 questions, 5 minutes');
  // The start cut-off keeps slack: 20 minutes before the close a paper still starts, 10 minutes before it does not.
  assert.equal(tooLateToStart(WEEK, Date.parse('2026-10-18T18:10:00Z')), false);
  assert.equal(tooLateToStart(WEEK, Date.parse('2026-10-18T18:20:00Z')), true);
  for (const file of ['src/components/mob/MobPage.jsx', 'src/components/mob/JoinMob.jsx', 'src/components/mob/MobTodayCard.jsx']) {
    assert.doesNotMatch(read(file), /12 min/, `${file} says the real length`);
  }
});

test('every error message says more than its heading, and a message can carry the real numbers', () => {
  for (const [code, [status, message]] of Object.entries(ERRORS)) {
    assert.ok(status >= 400 && status < 600, code);
    assert.doesNotMatch(message, /[!→]|->|—/, code);
  }
  assert.deepEqual(errorBody('BANK_THIN', { message: 'Debentures has 7.', detail: { ready: 7 } }), { error: { code: 'BANK_THIN', message: 'Debentures has 7.', detail: { ready: 7 } } });
  assert.deepEqual(errorBody('BANK_THIN'), { error: { code: 'BANK_THIN', message: ERRORS.BANK_THIN[1] } });
  // The page's error card: its heading is "Your Mob did not load", so the line under it must not say the same.
  const page = read('src/components/mob/MobPage.jsx');
  assert.match(page, /errorDetail/);
});

test('the /admin/funnel Mob block: counts from mob_metrics, groups under 5 suppressed, the stop rule stated', async () => {
  const db = await database(12);
  const svc = createMobService(deps(db));
  try {
    for (const [owner, joiners] of [['u1', ['u2', 'u3']], ['u4', ['u5']], ['u6', []]]) {
      await svc.create(owner, { subject: 'accountancy', name: 'Host', colour: 0 });
      const link = await svc.invite(owner, {});
      for (const u of joiners) await svc.join(u, { code: link.code, name: 'Friend', colour: 1 });
    }
    await svc.report('u2', { memberId: (await svc.view('u2')).mob.members[0].memberId, reason: 'name' });
    const raw = await one(db, 'select mob_metrics($1::timestamptz) r', [new Date(NOW).toISOString()]);
    assert.equal(raw.week, WEEK);
    assert.deepEqual([raw.mobs, raw.active_mobs, raw.members, raw.members_in_active, raw.reports_7d], [3, 2, 6, 5, 1]);
    const text = JSON.stringify(raw);
    for (const leak of ['u1', 'u2', 'Host', 'Friend']) assert.equal(text.includes(leak), false, leak);
    const small = summariseMobMetrics(raw);
    assert.equal(small.rows.find((r) => r.label === 'Active Mobs').value, `fewer than ${MIN_REPORTABLE}`);
    // One report among 6 members is over 2 per 100: on safety the rule trips even for a small group (an admin looks).
    assert.deepEqual(small.stop.reasons, ['Reports are 16.7 per 100 members this week, over 2.']);
    assert.equal(small.rows.find((r) => r.label.startsWith('Left within')).value, `fewer than ${MIN_REPORTABLE}`, 'a leave rate over fewer than 5 is not shown');
  } finally { await db.close(); }
  const big = summariseMobMetrics({ week: '2026-10-12', mobs: 30, active_mobs: 20, members: 80, members_in_active: 70, sat_this_week: 50, sat_last_week: 60, sittings_7d: 40, late_7d: 10, reports_7d: 3, blocks_7d: 1, joined_cohort: 20, left_within_7d: 9 });
  assert.equal(big.rows.find((r) => r.label.startsWith('Papers sat per active Mob, this')).value, '2.5');
  assert.equal(big.rows.find((r) => r.label.startsWith('Left within')).value, '45% (9 of 20)');
  assert.equal(big.rows.find((r) => r.label.startsWith('Sat between')).value, '25% (10 of 40)');
  assert.equal(big.stop.tripped, true);
  assert.deepEqual(big.stop.reasons, ['Reports are 3.8 per 100 members this week, over 2.', '45% left within 7 days of joining, over 40%.']);
});

test('the privacy page explains the Mob in plain words when the Mob is on, and terms cover it', () => {
  const legal = read('src/components/mob/MobLegal.jsx');
  // Rewritten for Mob v3 on 20 Oct 2026 (data/tests/mob_legal_v3_1020.test.mjs holds the v3 assertions).
  for (const must of ['What the other members of your Mob see', 'Sharing is on by default, and you can turn it off', 'Share my marks in games',
    'Leaving and blocking', 'Reporting', 'deleted after 180 days', 'Deleting your account', 'never asks for your contacts']) {
    assert.ok(legal.includes(must), must);
  }
  assert.match(read('src/app/privacy/page.js'), /mobEnabledForLegal\(\) \? <MobPrivacySection \/>/);
  assert.match(read('src/app/terms/page.js'), /mobEnabledForLegal\(\) \? <MobTermsSection \/>/);
  // The switch's label in the v3 den is the one the policy names.
  assert.match(read('src/lib/mob/v3/denCopy.mjs'), /shareMarks: 'Share my marks in games'/);
});

test('entry lines: one per page for a member, the invitation only on Today and only at its moment', async () => {
  const { entryFor, inviteMoment } = await import('../../src/components/mob/mobEntryModel.mjs');
  const view = JSON.parse(read('data/tests/fixtures/mob/get_not_sat_v1.json')).mob;
  const today = entryFor('today', view);
  assert.equal(today.key, 'Sit it');
  assert.match(today.title, /sat this week$/);
  const practice = entryFor('practice', view);
  assert.match(practice.title, /^Mob paper, .+, 10 questions, 10 minutes$/);
  assert.equal(entryFor('review', view), null, 'Review says nothing to someone who has not sat');
  const sat = JSON.parse(read('data/tests/fixtures/mob/get_v1.json')).mob;
  assert.match(entryFor('review', sat).title, /trap: question \d+$/);
  assert.equal(entryFor('practice', sat).key, 'See your marks', "this week's answers open when the week closes (C-dec 2 item 1)");
  assert.equal(inviteMoment({ counts: { weeksMet: 0, sessions: 3 } }), null);
  assert.equal(inviteMoment({ counts: { weeksMet: 1, sessions: 3 } }), 'You met your study goal for a week.');
  assert.equal(inviteMoment({ counts: { weeksMet: 0, sessions: 7 } }), 'You have saved 7 sessions.');
  // Releases 3 to 8 gave Today, Practice and Progress their own Mob rows (TodayMob, PracticeMobChip, MobTodayCard);
  // MobEntry carries Today's invitation for someone in no Mob, and the Mob row under Also in Review.
  assert.match(read('src/app/(app)/today/page.jsx'), /<MobEntry where="today"[^>]* inviteOnly \/>/);
  assert.match(read('src/app/(app)/today/page.jsx'), /<TodayMob enabled=\{mobOn/);
  assert.match(read('src/app/(app)/dashboard/DashboardPageClient.jsx'), /<PracticeMobChip userId=/);
  assert.match(read('src/components/RecoveryOverview.jsx'), /<MobTodayCard userId=/);
  assert.match(read('src/components/review/ReviewChapters.jsx'), /<MobEntry where="review" \/>/);
  // Today shows a member one Mob row (TodayMob): the invitation-only entry returns nothing once there is a Mob.
  const entrySrc = read('src/components/mob/MobEntry.jsx');
  assert.ok(entrySrc.indexOf('if (inviteOnly) return null;') > entrySrc.indexOf('if (!data) {'), 'inviteOnly stays quiet for a member');
  assert.ok(entrySrc.indexOf('if (inviteOnly) return null;') < entrySrc.indexOf('const entry = entryFor(where, data);'), 'inviteOnly is decided before the member line is built');
  const entry = read('src/components/mob/MobEntry.jsx');
  assert.doesNotMatch(entry, /btn-volt|data-page-primary/, 'an entry line never takes the page\'s volt');
});

test('a student with no subjects gets NO_SUBJECTS and a way to choose them that comes back to the Mob', () => {
  assert.equal(ERRORS.NO_SUBJECTS[0], 422);
  assert.match(ERRORS.NO_SUBJECTS[1], /subjects first/);
  const page = read('src/components/mob/MobPage.jsx');
  assert.match(page, /SUBJECTS_HREF = '\/onboarding\?edit=true&back=\/mob'/);
  assert.match(page, /r\.code === 'NO_SUBJECTS'/);
  const onboarding = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(onboarding, /const BACK_PATHS = \['\/mob'\];/, 'only known pages, never a path from the address bar');
  assert.match(onboarding, /router\.push\(back \|\| DONE_PATH\)/);
});

test('the join page promises exactly as many sample questions as the guest sample has', () => {
  const join = read('src/components/mob/JoinMob.jsx');
  const count = Number(/export const SAMPLE_COUNT = (\d+);/.exec(join)?.[1]);
  const drill = read('src/components/landing/DemoDrill.jsx');
  const block = drill.slice(drill.indexOf('const DRILL = ['), drill.indexOf('\n];', drill.indexOf('const DRILL = [')));
  assert.equal((block.match(/^ {4}subject:/gm) || []).length, count, 'DemoDrill.jsx DRILL and JoinMob SAMPLE_COUNT must agree');
  assert.match(join, /href="\/#try-practice"/);
  assert.doesNotMatch(join, /} of 5 seats are taken/);
});

test('first-impression layout: 8 colours as two rows of 4 on a phone, the paper numbers 4 across only in a wide column, a 44 px Pro link', () => {
  const css = read('src/components/mob/mob.css');
  assert.match(css, /@media \(max-width: 520px\) \{ \.mob-colours__row \{ grid-template-columns: repeat\(4, 44px\)/);
  assert.match(css, /\.mob-intro__story, \.mob-join__visual \{ container-type: inline-size; \}/);
  assert.match(css, /@container \(min-width: 600px\) \{ \.mob-facts \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \} \}/);
  assert.doesNotMatch(css, /@media \(min-width: 560px\) \{ \.mob-facts/, 'never 4 across by window width');
  assert.match(css, /\.mob-pro-line \.mob-link \{ display: inline-block; min-height: 0; padding: 14px 2px; margin: -14px -2px; \}/);
  assert.match(css, /\.app-shell \.today-grid \.mob-entry \{ order: 5; \}/, 'Today: the Mob line after the move, never above it');
});

test('the chooser lengths come from the paper selector itself, and a stale length is dropped, never offered again', async () => {
  const wiring = read('src/lib/server/mob/deps.js');
  assert.match(wiring, /readablePracticeQuestions\(rows\.filter\(\(row\) => row\.chapter && !isPassageLinkedQuestion\(row\)\)/, 'the same filters as the selector');
  assert.match(wiring, /pickWithConstraints\(ranked, n, mode\)\.length >= n/, 'the same constraints as the selector, per length');
  assert.match(wiring, /forgetChapterCounts/);
  const db = await database(6);
  const forgot = [];
  const svc = createMobService(deps(db, {
    // The bank changed since the chooser looked: Cash Flow Statement no longer fills 10.
    pickQuestionIds: async (_s, { count = 10, chapter = null } = {}) => (chapter === 'Cash Flow Statement' ? [] : BANK.slice(0, count).map((q) => q.id)),
    chapterCounts: async () => [{ chapter: 'Cash Flow Statement', ready: 10 }],
    forgetChapterCounts: (subject) => forgot.push(subject),
  }));
  try {
    await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 0 });
    await assert.rejects(svc.createExtra('u1', { chapter: 'Cash Flow Statement', count: 10 }), (e) => e.code === 'BANK_THIN'
      && e.extra.detail.suggest.chapter === null && /too few for a paper\. Make it from the whole subject/.test(e.extra.message));
    assert.deepEqual(forgot, ['accountancy'], 'the next chooser read is fresh');
  } finally { await db.close(); }
});
