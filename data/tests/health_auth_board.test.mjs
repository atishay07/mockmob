// Production health audit of 16 Oct 2026, findings 3 and 4.
//  - Finding 3: a student's first sign-in could answer 500 (duplicate key on users_pkey) when two first requests
//    arrived together. Database.ensureUser / createUser is now INSERT ... ON CONFLICT (id) DO NOTHING.
//  - Finding 4: the leaderboard paged every attempt on every call. It now asks mm_leaderboard() (one grouped query,
//    supabase/migrations/20261016160100_leaderboard_group_by.sql, reused from web/credit-rpc-1016).
// The real data/db.js and src/lib/server/cookieSession.js run here, over an in-memory Supabase stand-in
// (helpers/health_supabase_fake.mjs); the migration runs for real on PGlite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const helper = (file) => pathToFileURL(path.join(ROOT, 'data', 'tests', 'helpers', file)).href;
const EXTENSIONS = ['', '.js', '.mjs', '.ts', '/index.js'];
const probe = (base) => {
  for (const extension of EXTENSIONS) {
    const file = base + extension;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return pathToFileURL(file).href;
  }
  return null;
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    if (specifier === '@/lib/supabase') return { url: helper('health_supabase_stub.mjs'), shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const url = probe(path.join(ROOT, 'src', specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }
    try { return next(specifier, context); } catch (error) {
      if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith('file:')) {
        const url = probe(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
        if (url) return { url, shortCircuit: true };
      }
      throw error;
    }
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-service-role-key';
const fake = await import(helper('health_supabase_fake.mjs'));
const { Database } = await import(pathToFileURL(path.join(ROOT, 'data', 'db.js')).href);
const { ensureDbUser } = await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'server', 'cookieSession.js')).href);

const identity = { id: 'sb-race-1', email: 'asha@example.com', name: 'Asha', image: null };
const profile = { id: 'sb-race-1', name: 'Asha', email: 'asha@example.com', image: null, subjects: [] };

// ---- finding 3 ------------------------------------------------------------------------------------------

test('two simultaneous first creates both get the row, one row exists, and only one is "created"', async () => {
  fake.reset();
  const [a, b] = await Promise.all([Database.ensureUser(profile), Database.ensureUser(profile)]);
  assert.equal(fake.tables.users.length, 1);
  assert.deepEqual([a.created, b.created].sort(), [false, true]);
  assert.equal(a.user.id, 'sb-race-1');
  assert.equal(b.user.id, 'sb-race-1');
  assert.equal(fake.tables.users[0].credit_balance, 100, 'the starting credits are given once');
});

test('createUser keeps its old contract: it returns the user, for a new id and for a lost race', async () => {
  fake.reset();
  const [a, b, c] = await Promise.all([Database.createUser(profile), Database.createUser(profile), Database.createUser(profile)]);
  for (const user of [a, b, c]) assert.equal(user.id, 'sb-race-1');
  assert.equal(fake.tables.users.length, 1);
  const fresh = await Database.createUser({ name: 'No id given', email: 'n@example.com' });
  assert.match(fresh.id, /^usr_/);
  assert.equal(fake.tables.users.length, 2);
});

test('an existing row is never overwritten: the profile a student has already changed survives a late create', async () => {
  fake.reset();
  await Database.createUser(profile);
  fake.tables.users[0].name = 'Asha Renamed';
  fake.tables.users[0].credit_balance = 37;
  fake.tables.users[0].subjects = ['accountancy'];
  fake.tables.users[0].role = 'creator';
  const late = await Database.ensureUser({ ...profile, name: 'Asha (from the sign-in)', subjects: [], role: 'student' });
  assert.equal(late.created, false);
  assert.equal(late.user.name, 'Asha Renamed');
  assert.equal(fake.tables.users[0].name, 'Asha Renamed');
  assert.equal(fake.tables.users[0].credit_balance, 37);
  assert.deepEqual(fake.tables.users[0].subjects, ['accountancy']);
  assert.equal(fake.tables.users[0].role, 'creator');
});

test('an email already held by a different id is still an error, not a silent skip', async () => {
  fake.reset();
  await Database.createUser(profile);
  await assert.rejects(Database.ensureUser({ ...profile, id: 'sb-other' }), (e) => e.code === '23505');
  assert.equal(fake.tables.users.length, 1);
});

test('ensureDbUser over the real database layer: two simultaneous first sign-ins, onCreated runs once', async () => {
  fake.reset();
  let counted = 0;
  const onCreated = async () => { counted += 1; };
  const [a, b] = await Promise.all([
    ensureDbUser(identity, Database, { onCreated }),
    ensureDbUser(identity, Database, { onCreated }),
  ]);
  assert.equal(a.id, 'sb-race-1');
  assert.equal(b.id, 'sb-race-1');
  assert.equal(fake.tables.users.length, 1);
  assert.equal(counted, 1, 'the loser of the race is not a second signup');
});

test('ensureDbUser still works with a db that only has createUser (the older path)', async () => {
  const rows = new Map();
  const db = {
    getUserById: async (id) => rows.get(id) || null,
    getUserByEmail: async () => null,
    updateUser: async (id, patch) => ({ ...rows.get(id), ...patch }),
    createUser: async (row) => { rows.set(row.id, { ...row }); return rows.get(row.id); },
  };
  let counted = 0;
  const user = await ensureDbUser(identity, db, { onCreated: async () => { counted += 1; } });
  assert.equal(user.id, 'sb-race-1');
  assert.equal(counted, 1);
});

// ---- finding 4 ------------------------------------------------------------------------------------------

const GROUPED = [
  { user_id: 'u1', name: 'Asha', image: 'a.png', tests: 2, total_score: 120 },
  { user_id: 'u2', name: 'Ravi', image: null, tests: 1, total_score: 100 },
  { user_id: 'ghost', name: null, image: null, tests: 1, total_score: 10 },
];

const seedLeaderboard = () => {
  fake.reset();
  fake.tables.users.push({ id: 'u1', name: 'Asha', image: 'a.png' }, { id: 'u2', name: 'Ravi', image: null });
  fake.tables.attempts.push(
    { id: 'a1', user_id: 'u1', score: 40 }, { id: 'a2', user_id: 'u2', score: 100 }, { id: 'a3', user_id: 'u1', score: 80 },
    { id: 'a4', user_id: 'ghost', score: 10 },
  );
};

test('getLeaderboard asks the database for one grouped answer and shapes it for the page', async () => {
  seedLeaderboard();
  fake.rpcs.mm_leaderboard = async () => ({ data: GROUPED.map((r) => (r.user_id === 'u1' ? { ...r, total_score: '120' } : r)), error: null });
  const rows = await Database.getLeaderboard();
  assert.deepEqual(rows, [
    { userId: 'u1', name: 'Asha', image: 'a.png', tests: 2, totalScore: 120, avg: 60 },
    { userId: 'u2', name: 'Ravi', image: null, tests: 1, totalScore: 100, avg: 100 },
    { userId: 'ghost', name: 'Unknown User', image: null, tests: 1, totalScore: 10, avg: 10 },
  ]);
  assert.deepEqual(fake.calls.filter(([t]) => t === 'attempts'), [], 'no attempt row is read');
});

test('getLeaderboard: the old paging path gives the same rows while the function is missing', async () => {
  seedLeaderboard();
  const fallback = await Database.getLeaderboard(); // no rpc registered: PGRST202
  assert.ok(fake.calls.some(([t]) => t === 'attempts'), 'the fallback did page the attempts');
  fake.rpcs.mm_leaderboard = async () => ({ data: GROUPED, error: null });
  const grouped = await Database.getLeaderboard();
  assert.deepEqual(grouped, fallback);
});

test('getLeaderboard: any other database error is an error, not a silent fall back to a full scan', async () => {
  seedLeaderboard();
  fake.rpcs.mm_leaderboard = async () => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
  await assert.rejects(Database.getLeaderboard(), (e) => e.code === '57014');
  assert.deepEqual(fake.calls.filter(([t]) => t === 'attempts'), []);
});

test('mm_leaderboard on Postgres: totals, order, a deleted user, no grants for the browser roles', async () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261016160100_leaderboard_group_by.sql'), 'utf8');
  const undo = fs.readFileSync(path.join(ROOT, 'supabase/undo/20261016160100_leaderboard_group_by.undo.sql'), 'utf8');
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(`create table public.users (id text primary key, name text, image text);
      create table public.attempts (id text primary key, user_id text, score integer);`);
    await db.exec(sql);
    await db.exec(sql); // create or replace: applies twice
    await db.exec(`insert into public.users values ('u1','Asha','a.png'),('u2','Ravi',null),('u3','Tie B',null),('u4','Tie A',null);
      insert into public.attempts values ('a1','u1',40),('a2','u2',100),('a3','u1',80),('a4','ghost',10),
        ('a5','u3',55),('a6','u4',55),('a7',null,500),('a8','u2',-20);`);
    const { rows } = await db.query('select * from public.mm_leaderboard()');
    assert.deepEqual(rows.map((r) => [r.user_id, Number(r.tests), Number(r.total_score)]), [
      ['u1', 2, 120], ['u2', 2, 80], ['u3', 1, 55], ['u4', 1, 55], ['ghost', 1, 10],
    ], 'highest total first, ties by user id, an attempt without a user id is left out');
    assert.equal(rows.find((r) => r.user_id === 'ghost').name, null, 'a deleted user still appears, with no name');
    // The same totals the old Node code computed from every attempt row.
    const all = (await db.query('select user_id, score from public.attempts where user_id is not null')).rows;
    const old = new Map();
    for (const a of all) { const s = old.get(a.user_id) || { tests: 0, total: 0 }; s.tests += 1; s.total += a.score; old.set(a.user_id, s); }
    for (const r of rows) assert.deepEqual({ tests: Number(r.tests), total: Number(r.total_score) }, old.get(r.user_id));
    // Privileges and settings.
    const f = (await db.query(`select p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') anon_x,
        has_function_privilege('authenticated', p.oid, 'execute') auth_x, has_function_privilege('service_role', p.oid, 'execute') svc_x
        from pg_proc p where p.proname = 'mm_leaderboard'`)).rows[0];
    assert.equal(f.prosecdef, false, 'security invoker');
    assert.deepEqual(f.proconfig, ['search_path=public']);
    assert.equal(f.anon_x, false);
    assert.equal(f.auth_x, false);
    assert.equal(f.svc_x, true);
    await db.exec(undo);
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname = 'mm_leaderboard'")).rows[0].n, 0, 'the undo drops it');
  } finally { await db.close(); }
});
