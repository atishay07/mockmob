import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { validateReport, storeReport, MAX_REPLY } from '../../src/lib/server/aiReplyReport.js';

const MIGRATION = new URL('../../supabase/migrations/20261014090000_ai_reply_reports.sql', import.meta.url);
const ROUTE = readFileSync(new URL('../../src/app/api/ai/mentor/report/route.js', import.meta.url), 'utf8');

test('validateReport accepts the client payload and derives the dedupe key', () => {
  const r = validateReport({ reason: 'Wrong answer', reply: 'x'.repeat(2000), sessionId: 's1', requestId: 'req-12345' }, null);
  assert.equal(r.ok, true);
  assert.equal(r.value.replyExcerpt.length, MAX_REPLY);
  assert.equal(r.value.dedupeKey, 'ai-report-req-12345');
  assert.equal(validateReport({ reason: 'a', reply: 'b' }, 'ai-report-abcdefgh').value.dedupeKey, 'ai-report-abcdefgh');
  assert.equal(validateReport({ reason: 'a', reply: 'b' }, null).value.dedupeKey, null);
});

test('validateReport rejects bad input', () => {
  for (const body of [null, [], 'x', {}, { reason: '', reply: 'b' }, { reason: 'a', reply: '' }, { reason: 'a', reply: '   ' }, { reason: 'x'.repeat(121), reply: 'b' },
    { reason: 1, reply: 'b' }, { reason: 'a', reply: 2 }, { reason: 'a', reply: 'b', sessionId: 5 }, { reason: 'a', reply: 'b', requestId: 'x'.repeat(101) }])
    assert.equal(validateReport(body, null).ok, false, JSON.stringify(body));
  assert.equal(validateReport({ reason: 'a', reply: 'b' }, 'short').ok, false);
  assert.equal(validateReport({ reason: 'a', reply: 'b' }, 'has spaces in it').ok, false);
});

test('validateReport strips control characters', () => {
  const r = validateReport({ reason: 'bad\u0000 reply', reply: 'hi\u0007 there' }, null);
  assert.equal(r.value.reason, 'bad reply');
  assert.equal(r.value.replyExcerpt, 'hi there');
});

test('migration: constraints, dedupe, index, RLS and no client access', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon;create role authenticated;create role service_role;');
    await db.exec('create table public.users(id text primary key);');
    await db.exec("insert into public.users values('u1'),('u2')");
    const sql = readFileSync(MIGRATION, 'utf8');
    await db.exec(sql); await db.exec(sql); // idempotent
    const ins = (u, reason, reply, key) => db.query('insert into ai_reply_reports(user_id,reason,reply_excerpt,dedupe_key) values($1,$2,$3,$4)', [u, reason, reply, key]);
    await ins('u1', 'Wrong answer', 'reply', 'ai-report-abc12345');
    await assert.rejects(ins('u1', 'Wrong answer', 'reply', 'ai-report-abc12345'), /unique|duplicate/);
    await ins('u2', 'Wrong answer', 'reply', 'ai-report-abc12345');
    await ins('u1', 'Other', 'reply', null); await ins('u1', 'Other', 'reply', null); // no key: never deduped
    await assert.rejects(ins('u1', '', 'reply', null), /check/);
    await assert.rejects(ins('u1', 'x'.repeat(121), 'reply', null), /check/);
    await assert.rejects(ins('u1', 'a', 'x'.repeat(1201), null), /check/);
    await assert.rejects(ins('nobody', 'a', 'b', null), /foreign key/);
    const idx = await db.query("select indexdef from pg_indexes where tablename='ai_reply_reports' and indexname='ai_reply_reports_created_at_idx'");
    assert.match(idx.rows[0].indexdef, /created_at/);
    assert.equal((await db.query("select relrowsecurity r from pg_class where relname='ai_reply_reports'")).rows[0].r, true);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from ai_reply_reports'), /permission denied/);
      await assert.rejects(db.query("insert into ai_reply_reports(user_id,reason,reply_excerpt) values('u1','a','b')"), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec("delete from public.users where id='u1'");
    assert.equal((await db.query("select count(*)::int n from ai_reply_reports where user_id='u1'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('storeReport inserts, dedupes through upsert and surfaces db errors', async () => {
  const calls = [];
  const fake = (error = null) => ({ from: t => ({ upsert: (row, opts) => { calls.push(['upsert', t, row, opts]); return Promise.resolve({ error }); }, insert: row => { calls.push(['insert', t, row]); return Promise.resolve({ error }); } }) });
  const v = validateReport({ reason: 'Wrong answer', reply: 'r', requestId: 'req-12345' }, null).value;
  assert.deepEqual(await storeReport(fake(), 'u1', v), { ok: true });
  assert.equal(calls[0][0], 'upsert');
  assert.deepEqual(calls[0][3], { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
  assert.equal(calls[0][2].user_id, 'u1');
  await storeReport(fake(), 'u1', validateReport({ reason: 'a', reply: 'b' }, null).value);
  assert.equal(calls[1][0], 'insert');
  await assert.rejects(storeReport(fake({ message: 'down' }), 'u1', v), /REPORT_UNAVAILABLE/);
});

test('route authenticates with the bearer token, rate limits, validates and never reads', () => {
  assert.match(ROUTE, /export async function POST[(]request/);
  assert.match(ROUTE, /\bauth\(request\)/);
  assert.doesNotMatch(ROUTE, /\bauth\(\s*\)/);
  assert.match(ROUTE, /checkRateLimit\(request/);
  assert.match(ROUTE, /validateReport/);
  assert.doesNotMatch(ROUTE, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(ROUTE, /\.select\(/);
});
