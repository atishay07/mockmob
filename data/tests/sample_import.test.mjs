import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { SAMPLE_QUESTIONS, SAMPLE_VERSION, validateSampleImport, saveSampleImport } from '../../src/lib/server/sampleImport.js';

const migration = readFileSync(new URL('../../supabase/migrations/20261013093000_sample_imports.sql', import.meta.url), 'utf8');

const KEY1 = 'import-key-aaaaaaaa';
const KEY2 = 'import-key-bbbbbbbb';
const answersWith = (keys) => SAMPLE_QUESTIONS.map((q, i) => ({ sampleQuestionId: q.id, optionKey: keys[i] }));
const body = (over = {}) => ({ importKey: KEY1, sampleVersion: SAMPLE_VERSION, subject: 'Accountancy', answers: answersWith(['B', 'B', 'C', 'C', 'B']), ...over });

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key, name text not null default 'x');");
  // Tables that a sample import must never touch.
  await db.exec('create table public.attempts (id serial primary key, user_id text); create table public.credit_ledger (id serial primary key, user_id text);');
  await db.exec("insert into public.users(id) values ('u1'),('u2');");
  await db.exec(migration);
  // Minimal Supabase-style rpc shim over pglite for saveSampleImport.
  const client = {
    async rpc(name, a) {
      try {
        const r = await db.query(`select * from public.${name}($1,$2,$3,$4,$5::jsonb,$6,$7)`, [a.p_user_id, a.p_import_key, a.p_sample_version, a.p_subject, JSON.stringify(a.p_answers), a.p_correct, a.p_total]);
        return { data: r.rows, error: null };
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
  };
  return { db, client };
}
const save = (client, user, b) => { const v = validateSampleImport(b); assert.ok(v.ok, JSON.stringify(v)); return saveSampleImport(client, user, v.value); };

// The landing sample now asks for a subject first and serves five questions of it (src/components/landing/
// sampleBank.mjs). The five 'landing-v1' questions keep their place in that bank, unchanged, so a stored import
// still names real questions: English 1, Accountancy 1 and 2, Economics 1, Business Studies 1.
test('constants match the five original landing questions, still in the sample bank', async () => {
  const { SAMPLE_BANK } = await import('../../src/components/landing/sampleBank.mjs');
  assert.equal(SAMPLE_QUESTIONS.length, 5);
  const originals = [
    ['English', SAMPLE_BANK.english[0]],
    ['Accountancy', SAMPLE_BANK.accountancy[0]],
    ['Economics', SAMPLE_BANK.economics[0]],
    ['Accountancy', SAMPLE_BANK.accountancy[1]],
    ['Business Studies', SAMPLE_BANK.business_studies[0]],
  ];
  assert.deepEqual(SAMPLE_QUESTIONS.map(q => q.subject), originals.map(([subject]) => subject));
  assert.deepEqual(SAMPLE_QUESTIONS.map(q => q.correctKey), originals.map(([, item]) => 'ABCD'[item.correct]));
  assert.match(originals[0][1].q, /CANDID/);
  assert.match(originals[3][1].q, /Goodwill brought in by an incoming partner/);
});

test('validation accepts a good body and scores it', () => {
  const v = validateSampleImport(body());
  assert.ok(v.ok);
  assert.equal(v.value.correct, 5);
  assert.equal(validateSampleImport(body({ answers: answersWith(['A', 'A', 'A', 'A', 'A']) })).value.correct, 0);
});

test('validation rejects bad input', () => {
  const cases = [
    null, [], body({ importKey: 'short' }), body({ importKey: 'has space in it!!' }), body({ importKey: 'x'.repeat(101) }),
    body({ sampleVersion: 'old' }), body({ subject: '' }), body({ subject: 5 }),
    body({ answers: answersWith(['A', 'B', 'C', 'D', 'A']).slice(0, 4) }),
    body({ answers: answersWith(['A', 'B', 'C', 'D', 'E']) }),
    body({ answers: [...answersWith(['A', 'B', 'C', 'D', 'A']).slice(0, 4), { sampleQuestionId: 'q1', optionKey: 'A' }] }),
    body({ answers: [...answersWith(['A', 'B', 'C', 'D', 'A']).slice(0, 4), { sampleQuestionId: 'q9', optionKey: 'A' }] }),
  ];
  for (const c of cases) { const v = validateSampleImport(c); assert.equal(v.ok, false, JSON.stringify(c)); assert.ok(v.error && v.message); }
  assert.equal(validateSampleImport(body({ sampleVersion: 'old' })).error, 'unknown_sample_version');
});

test('migration applies twice and enforces service-role-only RLS', async () => {
  const { db } = await setup();
  try {
    await db.exec(migration);
    const rls = (await db.query("select relrowsecurity from pg_class where relname = 'sample_imports'")).rows[0];
    assert.equal(rls.relrowsecurity, true);
    const g = (await db.query("select grantee from information_schema.role_table_grants where table_name='sample_imports'")).rows.map(r => r.grantee);
    assert.ok(g.includes('service_role'));
    assert.ok(!g.includes('anon') && !g.includes('authenticated'));
    await assert.rejects(db.exec("insert into sample_imports(user_id,import_key,sample_version,subject,answers,correct,total) values ('u1','short','v','s','[]',1,5)"), /check/i);
  } finally { await db.close(); }
});

test('idempotent on importKey: second call returns the first row', async () => {
  const { db, client } = await setup();
  try {
    const a = await save(client, 'u1', body());
    const b = await save(client, 'u1', body({ answers: answersWith(['A', 'A', 'A', 'A', 'A']) }));
    assert.equal(a.status, 'saved');
    assert.deepEqual(b, a);
    assert.equal(b.correct, 5);
    assert.equal((await db.query('select count(*)::int n from sample_imports')).rows[0].n, 1);
  } finally { await db.close(); }
});

test('idempotent on (user, sampleVersion) with a different key', async () => {
  const { db, client } = await setup();
  try {
    const a = await save(client, 'u1', body());
    const b = await save(client, 'u1', body({ importKey: KEY2, answers: answersWith(['A', 'A', 'A', 'A', 'A']) }));
    assert.deepEqual(b, a);
    assert.equal((await db.query('select count(*)::int n from sample_imports')).rows[0].n, 1);
    // Another user may import the same sample version with their own key.
    const c = await save(client, 'u2', body({ importKey: 'import-key-cccccccc', answers: answersWith(['A', 'A', 'A', 'A', 'A']) }));
    assert.equal(c.correct, 0);
    assert.equal((await db.query('select count(*)::int n from sample_imports')).rows[0].n, 2);
  } finally { await db.close(); }
});

test('an import key owned by another user is refused', async () => {
  const { db, client } = await setup();
  try {
    await save(client, 'u1', body());
    await assert.rejects(save(client, 'u2', body()), e => e.code === 'KEY_TAKEN');
    assert.equal((await db.query("select count(*)::int n from sample_imports where user_id='u2'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('no side effects on attempts or credits; stored answers are the clean ones', async () => {
  const { db, client } = await setup();
  try {
    await save(client, 'u1', body());
    await save(client, 'u1', body());
    assert.equal((await db.query('select count(*)::int n from attempts')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int n from credit_ledger')).rows[0].n, 0);
    const row = (await db.query('select answers, correct, total, subject from sample_imports')).rows[0];
    assert.equal(row.total, 5);
    assert.deepEqual(row.answers[0], { sampleQuestionId: 'q1', optionKey: 'B' });
    // The module touches no scoring/credit/rhythm code.
    const src = readFileSync(new URL('../../src/lib/server/sampleImport.js', import.meta.url), 'utf8');
    assert.ok(!/attempts|credit|rhythm|sessions/.test(src.replace(/\/\/.*$/gm, '')));
  } finally { await db.close(); }
});
