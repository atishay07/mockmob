// The 18 Oct Mob go/no-go defects (staging gate NO-GO 8/10), each pinned by a test on the real code paths:
//   2. a Pro student starting a 4th Mob hears the plan's cap, not the weekly create limit (both are 3);
//   3. per-question "how your Mob picked" counts never include a member who keeps answers private;
//   4. a failed join does not count toward the 10 joins an hour;
//   5. with MOB_ENABLED off, /mob answers a real 404 (the proxy answers before the (app) layout streams a 200).
// (1, the 44 px targets, is data/tests/mob_render_size.test.mjs.)
// The database is PGlite with the real migrations: the Mob, its 17 Oct fix and the persistent rate limiter
// (take_rate_limit, rate_limit_give_back, rate_limit_reset_at), called with the exact PostgREST argument names and read
// back in supabase-js's { data, error } shape, as src/lib/server/rateLimit.js does. Run: node --test data/tests/mob_gate_1018.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { ERRORS } from '../../src/lib/mob/model.mjs';
import { buildCompare } from '../../src/lib/mob/compare.mjs';
import { createMobService } from '../../src/lib/server/mob/service.js';
import { ACTIONS, LIMITS, handleMob } from '../../src/lib/server/mob/http.js';
import { takePersistent } from '../../src/lib/server/rateLimitCore.js';
import { MOB_PATHS, mobPageOff } from '../../src/lib/mob/flag.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));
const NOW = Date.parse('2026-10-13T14:00:00Z');

async function database(users = 8) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(`create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,${users}) g;`);
  await db.exec(read('supabase/migrations/20261002121000_runtime_ai_guard.sql'));
  await db.exec(read('supabase/migrations/20261017100000_mob.sql'));
  await db.exec(read('supabase/migrations/20261017190000_mob_fix_1017.sql'));
  return db;
}
// select public.fn(p_a => $1, ...): named arguments, as PostgREST calls an RPC with a JSON body of the same names.
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const values = keys.map((k) => { const v = params[k]; if (k === 'p_picks') return `{${v.join(',')}}`; return v && typeof v === 'object' ? JSON.stringify(v) : v; });
    return (await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values)).rows[0].r;
  };
}
// supabase-js: { data, error }.
const supa = (rpc) => async (name, params) => { try { return { data: await rpc(name, params), error: null }; } catch (error) { return { data: null, error }; } };
// src/lib/server/rateLimit.js persistentBucket, for a by-user limit (identityOnly: no IP in the bucket).
const bucketOf = (opts) => createHash('sha256').update([opts.route, opts.identityOnly ? '' : '203.0.113.9', ...(opts.keyParts || [])].join(':')).digest('hex');

function routeDeps(db, svc, user) {
  const call = supa(pgRpc(db));
  const calls = [];
  return {
    calls,
    enabled: () => true,
    auth: async () => ({ user: { id: user } }),
    cors: () => ({}),
    now: () => NOW,
    service: svc,
    rateLimit: (_r, opts) => { calls.push(['take', opts.route]); return takePersistent({ take: (limit, windowMs) => call('take_rate_limit', { p_bucket: bucketOf(opts), p_limit: limit, p_window_ms: windowMs }), limit: opts.limit, windowMs: opts.windowMs }); },
    giveBack: async (_r, opts) => { calls.push(['give', opts.route]); return !(await call('rate_limit_give_back', { p_bucket: bucketOf(opts) })).error; },
    waitFor: async (_r, opts) => { const { data } = await call('rate_limit_reset_at', { p_bucket: bucketOf(opts) }); return data ? Math.ceil((Date.parse(data) - Date.now()) / 1000) : null; },
  };
}
const countOf = async (db, route, user) => (await db.query('select count from public.persistent_rate_limits where bucket = $1', [bucketOf({ route, identityOnly: true, keyParts: [user] })])).rows[0]?.count ?? 0;
const post = (body) => new Request('http://localhost/api/mob', { method: 'POST', body: JSON.stringify(body) });

let drawn = 0;
const service = (db, pro = new Set(), { loadUser } = {}) => createMobService({
  rpc: pgRpc(db), now: () => NOW, secret: 'test-secret', blocklist,
  randomBytes: (n) => { drawn += 1; return Uint8Array.from({ length: n }, (_, i) => (drawn * 53 + i * 37) % 256); },
  subjectInfo: (s) => (['accountancy', 'economics'].includes(s) ? { ok: true, id: s, name: s } : { ok: false }),
  validChapter: () => false, pickQuestionIds: async () => [], loadQuestions: async () => [], trapNameFor: async () => null, findAttempts: async () => [],
  loadUser: loadUser || (async (id) => ({ subjects: ['accountancy', 'economics'], isPremium: pro.has(id) })),
  startPractice: async () => ({}),
});

// --- 2 ---------------------------------------------------------------------------------------------------------------
test('2: the create limit and the Pro cap are both 3, so the cap answers first: a 4th Mob says MOB_LIMIT_PRO, never the weekly wait', async () => {
  assert.equal(LIMITS.create.limit, 3);
  assert.deepEqual(ACTIONS.create[1], ['write', 'create'], 'write is taken first, so the plan gate is counted');
  assert.equal(ACTIONS.create[4].gateBefore, 'create');
  const db = await database();
  const svc = service(db, new Set(['u2']));
  const deps = routeDeps(db, svc, 'u2');
  for (const subject of ['accountancy', 'economics', 'accountancy']) {
    const res = await handleMob(deps, 'create', post({ subject, name: 'Asha', colour: 1 }));
    assert.equal(res.status, 201, subject);
  }
  assert.equal(await countOf(db, '/api/mob:create', 'u2'), 3, 'three Mobs started: the weekly limit is spent too');
  assert.equal(Number(await pgRpc(db)('mob_started_count', { p_user_id: 'u2' })), 3);
  deps.calls.length = 0;
  const fourth = await handleMob(deps, 'create', post({ subject: 'economics', name: 'Asha', colour: 1 }));
  assert.equal(fourth.status, 409);
  const body = await fourth.json();
  assert.deepEqual(body.error.code, 'MOB_LIMIT_PRO');
  assert.equal(body.error.message, ERRORS.MOB_LIMIT_PRO[1]);
  assert.doesNotMatch(body.error.message, /7 days|You can start another/);
  assert.equal(fourth.headers.get('retry-after'), null, 'not a rate limit');
  assert.deepEqual(deps.calls, [['take', '/api/mob:write']], 'the create limit is never touched');
  assert.equal(await countOf(db, '/api/mob:create', 'u2'), 3);
  // Free: one started, a second says the Free cap.
  const freeDeps = routeDeps(db, svc, 'u1');
  assert.equal((await handleMob(freeDeps, 'create', post({ subject: 'accountancy', name: 'Riya', colour: 0 }))).status, 201);
  const second = await handleMob(freeDeps, 'create', post({ subject: 'economics', name: 'Riya', colour: 0 }));
  assert.equal((await second.json()).error.code, 'MOB_LIMIT');
  assert.equal(await countOf(db, '/api/mob:create', 'u1'), 1);
});

test('2: under the cap, the weekly create limit still answers with its real wait; a failed account read leaves the decision to create', async () => {
  const db = await database();
  const svc = service(db, new Set(['u2']));
  const deps = routeDeps(db, svc, 'u2');
  // The weekly limit already spent (3 this week), but only 2 Mobs still started (one was left): the limit, with its wait.
  await db.query("insert into public.persistent_rate_limits values ($1, 3, now() + interval '5 days')", [bucketOf({ route: '/api/mob:create', identityOnly: true, keyParts: ['u2'] })]);
  for (const subject of ['accountancy', 'economics']) assert.ok((await svc.create('u2', { subject, name: 'Asha', colour: 1 })).mob);
  const res = await handleMob(deps, 'create', post({ subject: 'accountancy', name: 'Asha', colour: 1 }));
  assert.equal(res.status, 429);
  assert.match((await res.json()).error.message, /^You started 3 Mobs in the last 7 days, the most a week allows\. You can start another on /);
  assert.ok(Number(res.headers.get('retry-after')) > 4 * 86400);
  // The account cannot be read: the gate says nothing, create answers (UNAVAILABLE), and the count comes back.
  const blind = service(db, new Set(), { loadUser: async () => { throw new Error('down'); } });
  const blindDeps = routeDeps(db, blind, 'u3');
  const out = await handleMob(blindDeps, 'create', post({ subject: 'accountancy', name: 'Kabir', colour: 2 }));
  assert.equal((await out.json()).error.code, 'UNAVAILABLE');
  assert.equal(await countOf(db, '/api/mob:create', 'u3'), 0, 'a failed create gives its count back');
});

// --- 3 ---------------------------------------------------------------------------------------------------------------
test('3: a private member is in nobody else\'s counts or split, so subtracting the rows you read never leaves their pick', () => {
  // The gate's case: 3 sitters, you and Gita share, Hari keeps his answers private.
  const members = [
    { user_id: 'you', display_name: 'You', colour: 0, show_score: true, joined_at: '2026-10-12T01:00:00Z' },
    { user_id: 'gita', display_name: 'Gita', colour: 1, show_score: true, joined_at: '2026-10-12T02:00:00Z' },
    { user_id: 'hari', display_name: 'Hari', colour: 2, show_score: false, joined_at: '2026-10-12T03:00:00Z' },
  ];
  const sittings = [{ user_id: 'you', picks: [0, 0, 2] }, { user_id: 'gita', picks: [1, 0, 2] }, { user_id: 'hari', picks: [1, 3, -1] }];
  const ids = ['q1', 'q2', 'q3'];
  const questions = ids.map((id) => ({ id, stem: id, correctIndex: 0 }));
  const out = buildCompare({ members, sittings, ids, questions, userId: 'you', memberIdFor: (u) => `M-${u}`, access: 'full', week: '2026-10-12' });
  assert.equal(out.hidden, 1);
  for (const q of out.questions) {
    assert.equal(q.picks, null, `q${q.number}: 2 readable sitters are too few for counts`);
    assert.deepEqual(q.others.map((o) => o.name), ['Gita']);
  }
  // The split is over you and Gita only: q2 (Hari picked D, you both A) is not a split; q1 (you A, Gita B) is.
  assert.deepEqual(out.questions.map((q) => q.split), [true, false, false]);
  assert.equal(JSON.stringify(out).includes('Hari'), false);
  // A fourth member who shares: counts over the 3 readable sitters, and they add up to exactly the rows you can read.
  const four = buildCompare({
    members: [...members, { user_id: 'isha', display_name: 'Isha', colour: 3, show_score: true, joined_at: '2026-10-12T04:00:00Z' }],
    sittings: [...sittings, { user_id: 'isha', picks: [0, 1, 2] }], ids, questions, userId: 'you', memberIdFor: (u) => `M-${u}`, access: 'full', week: '2026-10-12',
  });
  for (const q of four.questions) {
    const shownPicks = [q.you.picked, ...q.others.map((o) => o.picked)];
    const counted = Object.fromEntries(q.picks.map((p) => [p.option, p.count]));
    const fromRows = shownPicks.reduce((m, p) => ({ ...m, [p]: (m[p] || 0) + 1 }), {});
    assert.deepEqual(counted, fromRows, `q${q.number}: the counts are exactly the rows you can read`);
    assert.equal(q.picks.reduce((n, p) => n + p.count, 0), 3);
  }
  assert.deepEqual(four.questions[1].picks, [{ option: 'A', count: 2 }, { option: 'B', count: 1 }], 'Hari\'s D is in no count');
  // Someone who keeps their own answers private reads nobody, so has no counts and no split at all.
  const quiet = buildCompare({ members, sittings, ids, questions, userId: 'hari', memberIdFor: (u) => u, access: 'full', week: '2026-10-12' });
  assert.deepEqual(quiet.questions.map((q) => [q.picks, q.split]), [[null, null], [null, null], [null, null]]);
});

// --- 4 ---------------------------------------------------------------------------------------------------------------
test('4: a failed join gives its count back, whatever the reason; 10 wrong codes in an hour still leave a real join through', async () => {
  assert.equal(LIMITS.join.limit, 10);
  assert.equal(LIMITS.join.success, true);
  assert.equal('refundOn' in LIMITS.join, false);
  const db = await database();
  const svc = service(db, new Set(['u1']));
  const owner = await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 0 });
  const invite = await svc.invite('u1', { mob: owner.mob.id });
  const deps = routeDeps(db, svc, 'u2');
  const tries = [
    [{ code: 'ZZZZ-ZZZZ', name: 'Asha', colour: 1 }, 'INVITE_INVALID'],
    [{ code: 'not a code', name: 'Asha', colour: 1 }, 'INVITE_INVALID'],
    [{ code: invite.code, name: '', colour: 1 }, 'NAME_INVALID'],
    [{ code: invite.code, name: 'Asha', colour: 99 }, 'COLOUR_INVALID'],
  ];
  for (let i = 0; i < 12; i += 1) {
    const [body, code] = tries[i % tries.length];
    const res = await handleMob(deps, 'join', post(body));
    assert.equal((await res.json()).error.code, code, `try ${i + 1}`);
  }
  assert.equal(await countOf(db, '/api/mob:join', 'u2'), 0, '12 failed joins, none counted');
  assert.equal(await countOf(db, '/api/mob:write', 'u2'), 12, 'every try still counts toward write: guessing stays bounded');
  const ok = await handleMob(deps, 'join', post({ code: invite.code, name: 'Asha', colour: 1 }));
  assert.equal(ok.status, 200);
  assert.equal(await countOf(db, '/api/mob:join', 'u2'), 1, 'the join that happened counts');
  // An expired or full link, or a body that is not JSON, gives it back too.
  const bad = await handleMob(routeDeps(db, svc, 'u3'), 'join', new Request('http://localhost/api/mob', { method: 'POST', body: '{nope' }));
  assert.equal((await bad.json()).error.code, 'BODY_INVALID');
  assert.equal(await countOf(db, '/api/mob:join', 'u3'), 0);
});

test('4: the 10 an hour still holds for joins that happen; the 11th waits with the real time', async () => {
  const db = await database(3);
  const svc = service(db);
  const deps = routeDeps(db, svc, 'u2');
  await db.query("insert into public.persistent_rate_limits values ($1, 10, now() + interval '40 minutes')", [bucketOf({ route: '/api/mob:join', identityOnly: true, keyParts: ['u2'] })]);
  const res = await handleMob(deps, 'join', post({ code: 'ZZZZ-ZZZZ', name: 'Asha', colour: 1 }));
  assert.equal(res.status, 429);
  assert.match((await res.json()).error.message, /^That was a lot of tries to join in an hour\. You can try again in (39|40) minutes\.$/);
});

// --- 5 ---------------------------------------------------------------------------------------------------------------
test('5: with MOB_ENABLED off, the proxy answers /mob before any page renders, with a path no page owns (a real 404)', () => {
  assert.deepEqual(MOB_PATHS, ['/mob', '/mob/']);
  for (const off of [{}, { MOB_ENABLED: 'false' }, { MOB_ENABLED: '1' }, { MOB_ENABLED: 'TRUE' }]) {
    assert.equal(mobPageOff('/mob', off), true, JSON.stringify(off));
    assert.equal(mobPageOff('/mob/', off), true);
  }
  assert.equal(mobPageOff('/mob', { MOB_ENABLED: 'true' }), false);
  for (const other of ['/', '/mobile', '/mob-faq', '/practice', '/join/ABCD-EFGH']) assert.equal(mobPageOff(other, {}), false, other);
  const proxy = read('src/proxy.js');
  const body = proxy.slice(proxy.indexOf('export async function proxy('));
  assert.match(body, /^export async function proxy\(request\) \{\n  if \(mobPageOff\(request\.nextUrl\.pathname\)\) return NextResponse\.rewrite\(new URL\('\/not-found-mob-off', request\.url\)\);/,
    'the first thing the proxy does');
  assert.equal(existsSync(resolve(root, 'src/app/not-found-mob-off')), false, 'no page owns the rewrite target');
  // The matcher reaches /mob (it excludes only api, Next internals and static files).
  const matcher = proxy.match(/matcher: \[\s*(?:\/\/.*\n\s*)*'([^']+)'/)[1].split('\\\\').join('\\');
  assert.equal(new RegExp(`^${matcher}$`).test('/mob'), true);
  // The page keeps its own notFound() as a second line.
  assert.match(read('src/app/(app)/mob/page.jsx'), /if \(process\.env\.MOB_ENABLED !== 'true'\) notFound\(\);/);
});
