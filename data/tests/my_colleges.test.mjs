// My colleges (audit findings 5 and 6): one ordered list per student, saved on the server, up to 8.
// The pure rules (src/lib/colleges/model.mjs), the migration and its three functions on a real Postgres
// (PGlite), the route's wiring, and the parity contract data/tests/fixtures/colleges/contract_colleges_v1.json,
// copied byte for byte to flutter_app/test/fixtures/colleges/ on ui/phase2 so the app parses what the route sends.
// Run: node --test data/tests/my_colleges.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_LINE, FULL_LINE, LADDER_SIZE, MAX_COLLEGES, countLine, entryKey, errorLine, fromRows, fromServer, hasEntry,
  ladderView, listBody, moreLine, normalizeEntry, parseEntry, parseList, withAdded, withMoved, withRemoved,
} from '../../src/lib/colleges/model.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const FIXTURE = resolve(root, 'data/tests/fixtures/colleges/contract_colleges_v1.json');
const migration = read('supabase/migrations/20261016090000_my_colleges.sql');
const undo = read('supabase/undo/20261016090000_my_colleges.undo.sql');

const E = (programmeId, college, programme = '') => ({ programmeId, programme, college });
const COM = (college) => E('b-com-hons', college, 'B.Com. (Hons.)');
const ECO = (college) => E('b-a-hons-economics', college, 'B.A. (Hons.) Economics');
const AT = '2026-10-16T05:30:00.000Z';
const row = (e, i) => ({ ...e, addedAt: AT, position: i + 1 });
const plain = ({ programmeId, programme, college }) => ({ programmeId, programme, college });

// ---- the contract file: built from the same functions the route answers with ----------------------------------------
const FOUR = [COM('Shri Ram College of Commerce'), COM('Hindu College'), ECO('Hansraj College'), COM('Deshbandhu College')].map(row);
const EIGHT = [...FOUR, ...['Aryabhatta College', 'Dyal Singh College', 'Kirori Mal College', 'Ramjas College'].map((c) => COM(c))].map(row);
const PUT_LIST = [COM('Hindu College'), COM('Shri Ram College of Commerce'), ECO('Hansraj College')];
function fixtureBody() {
  return {
    contract: 'my-colleges-v1',
    path: '/api/me/colleges',
    max: MAX_COLLEGES,
    ladderSize: LADDER_SIZE,
    get: { status: 200, body: listBody(FOUR) },
    getEmpty: { status: 200, body: listBody([]) },
    put: { request: { colleges: PUT_LIST.map(plain) }, status: 200, body: listBody(PUT_LIST.map(row)) },
    post: {
      request: { programmeId: 'b-com-hons', programme: 'B.Com. (Hons.)', college: 'Deshbandhu College' },
      added: { status: 201, body: { ...listBody(FOUR), result: 'added' } },
      exists: { status: 200, body: { ...listBody(FOUR), result: 'exists' } },
      full: { status: 409, body: { error: 'list_full', message: 'My colleges is full. Remove one to add another.', ...listBody(EIGHT) } },
    },
    delete: {
      request: { query: { programmeId: 'b-a-hons-economics', college: 'Hansraj College' } },
      status: 200,
      body: listBody([COM('Shri Ram College of Commerce'), COM('Hindu College'), COM('Deshbandhu College')].map(row)),
    },
    errors: [
      { status: 401, body: { error: 'Unauthorized' } },
      { status: 422, body: { error: 'invalid_request', message: 'Send the programme and the college.' } },
      { status: 503, body: { error: 'unavailable' } },
    ],
  };
}
// Run once with COLLEGES_WRITE_FIXTURE=1 to (re)write the contract file; the app copy must then be copied byte for byte.
if (process.env.COLLEGES_WRITE_FIXTURE === '1') {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, `${JSON.stringify(fixtureBody(), null, 2)}\n`);
}

test('the contract file is exactly what the route functions produce', () => {
  assert.ok(existsSync(FIXTURE), 'run once with COLLEGES_WRITE_FIXTURE=1');
  assert.equal(readFileSync(FIXTURE, 'utf8'), `${JSON.stringify(fixtureBody(), null, 2)}\n`);
});

test('the contract body round-trips through the page reader and the validators', () => {
  const c = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.equal(c.get.body.count, 4);
  assert.equal(c.get.body.max, 8);
  assert.deepEqual(c.get.body.colleges.map((x) => x.position), [1, 2, 3, 4]);
  assert.equal(fromServer(c.get.body).length, 4);
  assert.equal(parseList(c.put.request).ok, true);
  assert.equal(parseEntry(c.post.request).ok, true);
  assert.equal(parseEntry(c.delete.request.query).ok, true);
  assert.equal(c.post.full.body.count, 8);
  assert.equal(ladderView(c.get.body.colleges).more, 1);
});

// ---- the rules ---------------------------------------------------------------------------------------------------

test('an entry is cleaned, and junk is refused', () => {
  assert.deepEqual(normalizeEntry({ programmeId: ' b-com-hons ', programme: '  B.Com.   (Hons.) ', college: '  Hindu   College ', extra: 1 }), E('b-com-hons', 'Hindu College', 'B.Com. (Hons.)'));
  assert.deepEqual(normalizeEntry({ programmeId: 'b-com-hons', college: 'Hindu College' }), E('b-com-hons', 'Hindu College', ''));
  const junk = [null, [], 'x', {}, { programmeId: 'B COM', college: 'Hindu College' }, { programmeId: '../x', college: 'Hindu College' },
    { programmeId: 'b-com-hons', college: 'H' }, { programmeId: 'b-com-hons', college: 'x'.repeat(161) }, { programmeId: 'b-com-hons', college: 'Hin\u0000du' },
    { programmeId: 'b-com-hons', college: 'Hindu College', programme: 'y'.repeat(161) }, { programmeId: 7, college: 'Hindu College' }];
  for (const bad of junk) assert.equal(normalizeEntry(bad), null, JSON.stringify(bad));
});

test('every real programme and college in the DU catalog is a valid entry', () => {
  const index = JSON.parse(read('public/du/2026/index.json'));
  for (const g of index.groups) assert.ok(normalizeEntry({ programmeId: g.id, programme: g.name, college: 'Hindu College' }), g.id);
  for (const f of ['b-com-hons', 'b-com', 'b-a-hons-economics']) {
    const d = JSON.parse(read(`public/du/2026/offerings/${f}.json`));
    for (const r of d.rows) assert.ok(normalizeEntry({ programmeId: d.id, programme: d.name, college: r[0] }), `${f} ${r[0]}`);
  }
});

test('a whole list is at most 8, has no repeats and keeps its order', () => {
  const ok = parseList({ colleges: [COM('Hindu College'), ECO('Hindu College')] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.list.map(entryKey), ['b-com-hons::Hindu College', 'b-a-hons-economics::Hindu College']);
  assert.equal(parseList({ colleges: [] }).ok, true);
  assert.equal(parseList({ colleges: Array.from({ length: 8 }, (_, i) => COM(`College ${i}`)) }).ok, true);
  assert.equal(parseList({ colleges: Array.from({ length: 9 }, (_, i) => COM(`College ${i}`)) }).message, 'Keep up to 8 colleges.');
  assert.match(parseList({ colleges: [COM('Hindu College'), COM('Hindu College')] }).message, /once for each programme/);
  assert.equal(parseList({ colleges: [COM('Hindu College'), { college: 'x' }] }).ok, false);
  for (const body of [null, {}, { colleges: 'x' }, []]) assert.equal(parseList(body).ok, false);
});

test('the response always counts from 1 and says the cap', () => {
  const b = listBody([COM('A College'), COM('B College')]);
  assert.deepEqual(b.colleges.map((c) => c.position), [1, 2]);
  assert.equal(b.count, 2);
  assert.equal(b.max, 8);
  assert.deepEqual(listBody(null), { colleges: [], count: 0, max: 8 });
  assert.equal(listBody(Array.from({ length: 12 }, (_, i) => COM(`College ${i}`))).count, 8);
  assert.deepEqual(
    fromRows([{ programme_id: 'b-com-hons', programme: 'B.Com. (Hons.)', college: 'Hindu College', added_at: AT }]),
    [{ programmeId: 'b-com-hons', programme: 'B.Com. (Hons.)', college: 'Hindu College', addedAt: AT }],
  );
});

test('Today shows the first 3 and the count of the rest', () => {
  assert.equal(LADDER_SIZE, 3);
  assert.deepEqual(ladderView(EIGHT), { shown: EIGHT.slice(0, 3), more: 5, total: 8 });
  assert.equal(ladderView(FOUR).more, 1);
  assert.equal(ladderView(FOUR.slice(0, 3)).more, 0);
  assert.deepEqual(ladderView(null), { shown: [], more: 0, total: 0 });
  assert.equal(moreLine(5), '5 more on My colleges');
  assert.equal(countLine(4), '4 of 8 colleges');
});

test('the page edits the list the way the server will', () => {
  const list = withAdded(withAdded([], COM('A College')), ECO('A College'));
  assert.deepEqual(list.map((c) => c.position), [1, 2]);
  assert.equal(withAdded(list, COM('A College')), list, 'a repeat changes nothing');
  assert.equal(hasEntry(list, ECO('A College')), true);
  assert.equal(hasEntry(list, COM('Zed College')), false);
  assert.deepEqual(withRemoved(list, COM('A College')).map((c) => [c.college, c.position]), [['A College', 1]]);
  assert.deepEqual(withMoved([COM('A College'), COM('B College'), COM('C College')], 2, 0).map((c) => c.college), ['C College', 'A College', 'B College']);
  assert.deepEqual(withMoved([COM('A College')], 0, 3).map((c) => c.college), ['A College']);
  const full = Array.from({ length: 8 }, (_, i) => COM(`College ${i}`));
  assert.equal(withAdded(full, COM('Extra College')).length, 8);
  assert.equal(fromServer({ colleges: [{ programmeId: 'x y', college: 'Hindu College' }] }), null);
  assert.equal(fromServer(null), null);
});

test('the words are plain', () => {
  const all = [FULL_LINE, EMPTY_LINE, errorLine({ status: 409 }), errorLine({ kind: 'network' }), errorLine(new Error('x')), moreLine(2), countLine(1)].join(' ');
  assert.doesNotMatch(all, /[!—·]/);
  assert.equal(errorLine({ status: 409 }), FULL_LINE);
});

// ---- the migration on a real Postgres ---------------------------------------------------------------------------

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) values ('u1'),('u2');");
  await db.exec(migration);
  return db;
}
const names = async (db, user = 'u1') => (await db.query('select college from my_colleges where user_id=$1 order by position', [user])).rows.map((r) => r.college);
const positions = async (db, user = 'u1') => (await db.query('select position from my_colleges where user_id=$1 order by position', [user])).rows.map((r) => r.position);
const replace = (db, user, list) => db.query('select my_colleges_replace($1, $2::jsonb) n', [user, JSON.stringify(list)]);
const add = async (db, user, e) => (await db.query('select my_colleges_add($1,$2,$3,$4) r', [user, e.programmeId, e.programme, e.college])).rows[0].r;
const remove = async (db, user, e) => (await db.query('select my_colleges_remove($1,$2,$3) n', [user, e.programmeId, e.college])).rows[0].n;

test('the migration applies twice and the undo removes it cleanly', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    await db.exec(undo);
    assert.equal((await db.query("select count(*)::int n from pg_tables where tablename='my_colleges'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from pg_proc where proname like 'my_colleges_%'")).rows[0].n, 0);
    await db.exec(undo);
    await db.exec(migration);
  } finally { await db.close(); }
});

test('replace keeps the order sent, and a second replace reorders', async () => {
  const db = await setup();
  try {
    await replace(db, 'u1', [COM('B College'), ECO('A College'), COM('C College')]);
    assert.deepEqual(await names(db), ['B College', 'A College', 'C College']);
    assert.deepEqual(await positions(db), [1, 2, 3]);
    await replace(db, 'u1', [COM('C College'), COM('B College')]);
    assert.deepEqual(await names(db), ['C College', 'B College']);
    await replace(db, 'u1', []);
    assert.deepEqual(await names(db), []);
  } finally { await db.close(); }
});

test('the same college can sit under two programmes, never twice under one', async () => {
  const db = await setup();
  try {
    await replace(db, 'u1', [COM('Hindu College'), ECO('Hindu College')]);
    assert.equal((await names(db)).length, 2);
    await assert.rejects(replace(db, 'u1', [COM('Hindu College'), COM('Hindu College')]), /duplicate|unique/i);
    assert.equal((await names(db)).length, 2, 'a failed replace changes nothing');
  } finally { await db.close(); }
});

test('add appends, repeats are a no-op, and the ninth is refused', async () => {
  const db = await setup();
  try {
    assert.equal(await add(db, 'u1', COM('A College')), 'added');
    assert.equal(await add(db, 'u1', COM('A College')), 'exists');
    for (let i = 1; i < 8; i++) assert.equal(await add(db, 'u1', COM(`College ${i}`)), 'added');
    assert.equal(await add(db, 'u1', COM('One too many')), 'full');
    assert.equal(await add(db, 'u1', COM('A College')), 'exists', 'a repeat on a full list is still a repeat');
    assert.deepEqual(await positions(db), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal((await names(db))[0], 'A College');
    assert.equal(await add(db, 'u2', COM('A College')), 'added', 'lists are per student');
  } finally { await db.close(); }
});

test('replace refuses more than 8 and bad shapes', async () => {
  const db = await setup();
  try {
    await assert.rejects(replace(db, 'u1', Array.from({ length: 9 }, (_, i) => COM(`College ${i}`))), /at most 8/);
    await assert.rejects(replace(db, 'u1', { not: 'a list' }), /at most 8/);
    await assert.rejects(replace(db, 'nobody', [COM('A College')]), /foreign key/i);
    await assert.rejects(replace(db, 'u1', [{ programmeId: 'BAD ID', college: 'A College' }]), /check/i);
    await assert.rejects(replace(db, 'u1', [{ programmeId: 'b-com-hons', college: 'A' }]), /check/i);
  } finally { await db.close(); }
});

test('remove closes the gap, and removing what is not there is harmless', async () => {
  const db = await setup();
  try {
    await replace(db, 'u1', [COM('A College'), COM('B College'), ECO('C College'), COM('D College')]);
    assert.equal(await remove(db, 'u1', COM('B College')), 1);
    assert.deepEqual(await names(db), ['A College', 'C College', 'D College']);
    assert.deepEqual(await positions(db), [1, 2, 3]);
    assert.equal(await remove(db, 'u1', COM('B College')), 0);
    assert.equal(await remove(db, 'u1', COM('C College')), 0, 'the programme is part of the key');
    assert.equal(await remove(db, 'u2', COM('A College')), 0, 'another student cannot remove it');
    assert.deepEqual(await names(db), ['A College', 'C College', 'D College']);
    await remove(db, 'u1', COM('A College'));
    assert.deepEqual(await positions(db), [1, 2]);
    assert.equal(await add(db, 'u1', COM('E College')), 'added');
    assert.deepEqual(await positions(db), [1, 2, 3]);
  } finally { await db.close(); }
});

test('deleting the student deletes the list', async () => {
  const db = await setup();
  try {
    await replace(db, 'u1', [COM('A College')]);
    await db.exec("delete from public.users where id='u1'");
    assert.deepEqual(await names(db), []);
  } finally { await db.close(); }
});

test('only the service role can touch it', async () => {
  const db = await setup();
  try {
    const priv = async (role, what) => (await db.query(`select has_table_privilege('${role}','public.my_colleges','${what}') p`)).rows[0].p;
    assert.equal(await priv('anon', 'select'), false);
    assert.equal(await priv('authenticated', 'select'), false);
    assert.equal(await priv('service_role', 'insert'), true);
    assert.equal((await db.query("select relrowsecurity r from pg_class where relname='my_colleges'")).rows[0].r, true);
    for (const fn of ['my_colleges_replace(text,jsonb)', 'my_colleges_add(text,text,text,text)', 'my_colleges_remove(text,text,text)']) {
      assert.equal((await db.query(`select has_function_privilege('authenticated','public.${fn}','execute') p`)).rows[0].p, false, fn);
      assert.equal((await db.query(`select has_function_privilege('service_role','public.${fn}','execute') p`)).rows[0].p, true, fn);
    }
  } finally { await db.close(); }
});

// ---- the route and the account deletion plan ----------------------------------------------------------------------

test('the route authenticates with auth(request) on every method and never trusts a body user id', () => {
  const src = read('src/app/api/me/colleges/route.js');
  for (const m of ['GET', 'PUT', 'POST', 'DELETE']) assert.match(src, new RegExp(`export async function ${m}\\(request\\)`), m);
  assert.equal((src.match(/await auth\(request\)/g) || []).length, 4);
  assert.doesNotMatch(src, /\bauth\(\s*\)/);
  assert.doesNotMatch(src, /body\.(userId|user_id)/);
  assert.match(src, /status: 409/);
  assert.match(src, /status: 401/);
  assert.match(src, /no-store/);
});

test('account deletion removes the list with the rest of the student', () => {
  assert.match(read('src/lib/server/accountDeletion.js'), /table: 'my_colleges', action: 'delete'/);
});

// ---- the three places that read and write the one list --------------------------------------------------------------

test('Today, Account and the Compass rows all use the one list', () => {
  const today = read('src/app/(app)/today/page.jsx');
  assert.match(today, /<TodayColleges userId=\{user\?\.id\} \/>/);
  assert.match(read('src/app/(app)/profile/ProfilePageClient.jsx'), /<AccountColleges userId=\{user\?\.id\} \/>/);
  const calc = read('src/components/du/CutoffCalculator.jsx');
  assert.match(calc, /<AddToMyColleges userId=\{userId\} programmeId=\{group\?\.id\}/);
  const mine = read('src/components/colleges/MyColleges.jsx');
  assert.match(mine, /Add to my colleges/);
  assert.match(mine, /ladderView\(mine\.colleges\)/, 'Today shows the first 3 and a count of the rest');
  assert.match(mine, /id="colleges"/, 'Account has the anchor the Today link goes to');
});

test('Compass Pro reads and writes My colleges and moves an old browser shortlist over once', () => {
  const pro = read('src/components/du/CompassPro.jsx');
  assert.match(pro, /useMyColleges\(userId\)/);
  assert.doesNotMatch(pro, /setItem\(/, 'nothing is written to browser storage any more');
  assert.match(pro, /clearLegacy\(userId\)/);
  assert.doesNotMatch(pro, /Your DU shortlist/);
  assert.match(read('src/components/profile/accountModel.mjs'), /'name', 'colleges', 'plan'/);
});

test('the pages keep to the copy rules: no exclamation mark, em dash or middle dot', () => {
  for (const f of ['src/components/colleges/MyColleges.jsx', 'src/components/colleges/useMyColleges.js', 'src/lib/colleges/model.mjs', 'src/app/api/me/colleges/route.js']) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Only the words a student can read: the text in quotes, backticks and JSX.
    const words = [...src.matchAll(/'([^'\n]*)'|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3]);
    for (const w of words) assert.doesNotMatch(w, /!|—|·/, `${f}: ${w}`);
  }
});

test('the store runs changes one at a time and puts the list back when the server refuses', () => {
  const hook = read('src/components/colleges/useMyColleges.js');
  assert.match(hook, /store\.chain\.then\(run, run\)/);
  assert.match(hook, /colleges: theirs \|\| before/);
  assert.match(hook, /store\.loading/);
});
