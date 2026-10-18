// Release 9 part B (the Mob merged onto release 9): what the merge verifier found, each pinned.
//   HIGH: data/evidence_registry.js must read its JSON relative to the file (import.meta.url), never process.cwd().
//   LOW: the runner header for a Mob paper says "Mob paper"; a create that happened keeps its count when only the view after
//        it fails; GET ?mob= with an empty value is a 400, not NOT_IN_MOB.
//   MEDIUM (release 9 audit): the join and start forms pre-filled the email local part ("rahul2007"), which their own check refuses.
// Run: node --test data/tests/release9b_mob_merge_1018.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createMobService } from '../../src/lib/server/mob/service.js';
import { handleMob } from '../../src/lib/server/mob/http.js';
import { checkName, suggestName } from '../../src/lib/mob/model.mjs';
import { takePersistent } from '../../src/lib/server/rateLimitCore.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const NOW = Date.parse('2026-10-13T14:00:00Z');

test('HIGH: data/evidence_registry.js never reads its JSON through process.cwd()', () => {
  const src = read('data/evidence_registry.js');
  assert.doesNotMatch(src, /process\.cwd\s*\(/, 'a rig-only cwd read must not come back');
  assert.doesNotMatch(src, /\bcwd\b/);
  const reads = src.match(/readFileSync\(/g) || [];
  assert.ok(reads.length >= 2, 'the registry still reads its JSON files');
  assert.match(src, /new URL\('\.\/source_registry\.json', import\.meta\.url\)/);
  assert.match(src, /new URL\('\.\/calibration_manifest\.json', import\.meta\.url\)/);
});

test('LOW: the runner header for a Mob paper reads "Mob paper", not the mode in the address', () => {
  const src = read('src/app/(app)/test/TestPageClient.jsx');
  assert.match(src, /const attemptLabel = isNtaMode \? 'NTA mode' : searchParams\.get\('mob'\) === '1' \? 'Mob paper' : mode\.label;/);
});

// ---- the route: PGlite with the real migrations, the same setup as mob_gate_1018.test.mjs ----
async function database() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) values ('u1');");
  await db.exec(read('supabase/migrations/20261002121000_runtime_ai_guard.sql'));
  await db.exec(read('supabase/migrations/20261017100000_mob.sql'));
  await db.exec(read('supabase/migrations/20261017190000_mob_fix_1017.sql'));
  return db;
}
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const values = keys.map((k) => { const v = params[k]; if (k === 'p_picks') return `{${v.join(',')}}`; return v && typeof v === 'object' ? JSON.stringify(v) : v; });
    return (await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values)).rows[0].r;
  };
}
const supa = (rpc) => async (name, params) => { try { return { data: await rpc(name, params), error: null }; } catch (error) { return { data: null, error }; } };
const bucketOf = (opts) => createHash('sha256').update([opts.route, opts.identityOnly ? '' : '203.0.113.9', ...(opts.keyParts || [])].join(':')).digest('hex');
const countOf = async (db, route, user) => (await db.query('select count from public.persistent_rate_limits where bucket = $1', [bucketOf({ route, identityOnly: true, keyParts: [user] })])).rows[0]?.count ?? 0;

function deps(db, svc, user) {
  const call = supa(pgRpc(db));
  return {
    enabled: () => true,
    auth: async () => ({ user: { id: user } }),
    cors: () => ({}),
    now: () => NOW,
    service: svc,
    rateLimit: (_r, opts) => takePersistent({ take: (limit, windowMs) => call('take_rate_limit', { p_bucket: bucketOf(opts), p_limit: limit, p_window_ms: windowMs }), limit: opts.limit, windowMs: opts.windowMs }),
    giveBack: async (_r, opts) => !(await call('rate_limit_give_back', { p_bucket: bucketOf(opts) })).error,
    waitFor: async () => null,
  };
}
let drawn = 0;
const service = (db, { failRead = () => false } = {}) => createMobService({
  rpc: async (name, params) => { if (name === 'mob_state' && failRead()) throw new Error('read down'); return pgRpc(db)(name, params); },
  now: () => NOW, secret: 'test-secret', blocklist: JSON.parse(read('data/mob_name_blocklist.json')),
  randomBytes: (n) => { drawn += 1; return Uint8Array.from({ length: n }, (_, i) => (drawn * 53 + i * 37) % 256); },
  subjectInfo: (s) => (['accountancy', 'economics'].includes(s) ? { ok: true, id: s, name: s } : { ok: false }),
  validChapter: () => false, pickQuestionIds: async () => [], loadQuestions: async () => [], trapNameFor: async () => null, findAttempts: async () => [],
  loadUser: async () => ({ subjects: ['accountancy', 'economics'], isPremium: false }),
  startPractice: async () => ({}),
});
const post = (body) => new Request('http://localhost/api/mob', { method: 'POST', body: JSON.stringify(body) });
const get = (qs) => new Request(`http://localhost/api/mob${qs}`);

test('LOW: a create that happened keeps its count when only the view after it fails; a refused one takes nothing', async () => {
  const db = await database();
  let down = false;
  const svc = service(db, { failRead: () => down });
  down = true; // the create RPC goes through; the read after it fails
  const res = await handleMob(deps(db, svc, 'u1'), 'create', post({ subject: 'accountancy', name: 'Riya', colour: 0 }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'UNAVAILABLE');
  assert.equal(Number(await pgRpc(db)('mob_started_count', { p_user_id: 'u1' })), 1, 'the Mob was made');
  assert.equal(await countOf(db, '/api/mob:create', 'u1'), 1, 'so its create count stays');
  // A second start is refused by the plan cap (one Mob started, Free): it takes nothing from the weekly count.
  down = false;
  const bad = await handleMob(deps(db, svc, 'u1'), 'create', post({ subject: 'nope', name: 'Riya', colour: 0 }));
  assert.equal((await bad.json()).error.code, 'MOB_LIMIT');
  assert.equal(await countOf(db, '/api/mob:create', 'u1'), 1, 'a refused create takes nothing');
});

test('LOW: GET ?mob= with an empty value is a 400 bad request; a real id that is not yours is still NOT_IN_MOB', async () => {
  const db = await database();
  const svc = service(db);
  const d = deps(db, svc, 'u1');
  for (const [action, path] of [['get', ''], ['chapters', ''], ['compare', ''], ['history', '']]) {
    for (const value of ['', '%20']) {
      const res = await handleMob(d, action, get(`${path}?mob=${value}`));
      assert.equal(res.status, 400, `${action} ?mob=${value}`);
      assert.equal((await res.json()).error.code, 'BAD_REQUEST');
    }
  }
  // Absent stays as before (the student's own Mob), and a well-formed id they are not in is still a 404.
  const mine = await handleMob(d, 'get', get(''));
  assert.equal(mine.status, 200);
  const other = await handleMob(d, 'chapters', get('?mob=00000000-0000-4000-8000-000000000000'));
  assert.equal(other.status, 404);
  assert.equal((await other.json()).error.code, 'NOT_IN_MOB');
});

test('MEDIUM: the name pre-filled on the join and start forms always passes the form own check, and is never the email local part', () => {
  const cases = [
    ['Ananya Sharma', 'ananya.s@example.com', 'Ananya'],
    ['rahul2007', 'rahul2007@example.com', ''],
    ['Rahul2007', 'someone@example.com', 'Rahul'],
    ['rahul_k', 'other@example.com', 'rahul'],
    ['12345', 'x@example.com', ''],
    ['A', 'a@example.com', ''],
    ['', 'rahul@example.com', ''],
    ['Priya', 'priya@example.com', ''],
    [null, null, ''],
    ['अनन्या Rao', 'x@example.com', 'अनन्या'],
  ];
  for (const [name, email, want] of cases) {
    const got = suggestName(name, email);
    assert.equal(got, want, `${name} / ${email}`);
    if (got) assert.equal(checkName(got).ok, true, `${got} must pass checkName`);
  }
  const join = read('src/components/mob/JoinMob.jsx');
  const page = read('src/components/mob/MobPage.jsx');
  assert.match(join, /suggestName\(user\.name, user\.email\)/);
  assert.match(page, /suggestName\(user\?\.name \|\| '', user\?\.email \|\| ''\)/);
  assert.doesNotMatch(join + page, /cleanName\((user\??\.name)[^)]*\)\.split/, 'no raw first-word pre-fill is left');
});

test('Join: an account with no offerable name starts with the name editor open, so Join never fails its first tap (R9 verify round 3)', () => {
  const src = readFileSync(new URL('../../src/components/mob/JoinMob.jsx', import.meta.url), 'utf8');
  assert.match(src, /const showEditor = editing \|\| \(signedIn && !cleanName\(name\)\);/);
  assert.match(src, /\{showEditor \? \(/);
  assert.match(src, /cleanName\(name\) \|\| 'Choose a name'/);
  assert.doesNotMatch(src, /'Your name'/);
});

test('Mob: a used free paper never claims the student sat it in another Mob (R9 verify round 3)', () => {
  const src = readFileSync(new URL('../../src/components/mob/MobPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /You sat it in your other Mob/);
  assert.match(src, /This week&apos;s free Mob paper is used\./);
});
