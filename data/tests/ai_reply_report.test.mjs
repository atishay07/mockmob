import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import {
  validateReport, storeReport, findReceivedReply, handleReportPost, reasonCode, operationKeyFor,
  MAX_REPLY, REPORT_REASONS, REPORT_LIMITS,
} from '../../src/lib/server/aiReplyReport.js';
import { operationKeyFor as chatOperationKeyFor } from '../../src/services/prepos/modelReply.js';

const MIGRATION = new URL('../../supabase/migrations/20261016140000_ai_reply_report.sql', import.meta.url);
const UNDO = new URL('../../supabase/undo/20261016140000_ai_reply_report.undo.sql', import.meta.url);
const ROUTE = readFileSync(new URL('../../src/app/api/ai/mentor/report/route.js', import.meta.url), 'utf8');
const RID = 'req_0123456789abcdef';
const good = (over = {}) => ({ reason: 'It is unsafe or unkind', reply: 'A reply', requestId: RID, ...over });

test('the fixed reasons match the four labels the app shows, by label or by code, and nothing else', () => {
  assert.deepEqual(Object.values(REPORT_REASONS), ['It is wrong about my record', 'It is wrong about the subject', 'It is unsafe or unkind', 'Something else']);
  assert.equal(reasonCode('It is wrong about my record'), 'wrong_about_record');
  assert.equal(reasonCode('  something   ELSE '), 'other');
  assert.equal(reasonCode('unsafe_or_unkind'), 'unsafe_or_unkind');
  for (const bad of ['', 'Wrong answer', 'other; drop table x', 'x'.repeat(300), null, undefined, 5, {}, ['other']]) assert.equal(reasonCode(bad), null, String(bad));
});

test('the operation key is the one the chat route creates', () => {
  for (const [u, r] of [['usr_1', RID], ['usr_1', 'short'], ['', RID], ['usr_1', `${RID}!`]]) assert.equal(operationKeyFor(u, r), chatOperationKeyFor(u, r));
});

test('validateReport accepts the client payload, stores the code, caps the text and derives the dedupe key', () => {
  const r = validateReport(good({ reply: 'x'.repeat(5000), sessionId: 's1', reason: 'It is wrong about the subject' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.reason, 'wrong_about_subject');
  assert.equal(r.value.replyExcerpt.length, MAX_REPLY);
  assert.equal(r.value.dedupeKey, `ai-report-${RID}`);
  assert.equal(r.value.sessionId, 's1');
  assert.equal(validateReport(good()).value.sessionId, null);
});

test('validateReport rejects bad input', () => {
  const bad = [null, [], 'x', {}, good({ reason: '' }), good({ reason: 'Wrong answer' }), good({ reason: 1 }), good({ reply: '' }), good({ reply: '   ' }), good({ reply: 2 }),
    good({ requestId: undefined }), good({ requestId: 'short' }), good({ requestId: `${RID}${'x'.repeat(60)}` }), good({ requestId: 'has spaces in the request id' }), good({ requestId: 5 }),
    good({ sessionId: 5 }), good({ sessionId: 'x'.repeat(101) }), good({ sessionId: '\u0007' })];
  for (const body of bad) assert.equal(validateReport(body).ok, false, JSON.stringify(body));
});

test('validateReport strips control characters from the reply', () => {
  assert.equal(validateReport(good({ reply: 'hi\u0007 there\u0000' })).value.replyExcerpt, 'hi there');
});

// A fake supabase client: each table has the rows it holds; the chain filters by eq() the way the real one does.
function fakeDb({ messages = [], reservations = [], failOn = null, reports = [] } = {}) {
  const log = { reads: [], upserts: [] };
  const table = (name) => {
    const filters = [];
    const q = {
      select: () => q,
      eq: (col, val) => { filters.push([col, val]); return q; },
      limit: () => q,
      maybeSingle: async () => {
        log.reads.push([name, [...filters]]);
        if (failOn === name) return { data: null, error: { message: 'down' } };
        const rows = name === 'mentor_messages' ? messages : reservations;
        const row = rows.find((r) => filters.every(([c, v]) => (c === 'structured_payload->charge->>reference' ? r.reference : r[c]) === v));
        return { data: row || null, error: null };
      },
      upsert: async (row, opts) => {
        log.upserts.push([name, row, opts]);
        if (failOn === 'ai_reply_reports') return { error: { message: 'down' } };
        if (!reports.some((x) => x.user_id === row.user_id && x.dedupe_key === row.dedupe_key)) reports.push(row);
        return { error: null };
      },
    };
    return q;
  };
  return { from: table, log, reports };
}
const KEY = `prepos:u1:${RID}`;
const stored = { user_id: 'u1', role: 'assistant', reference: KEY, content: 'What the student saw', session_id: 'sess-1' };

test('findReceivedReply finds the reply by the owner and the operation key, from the message or the committed credit operation', async () => {
  assert.deepEqual(await findReceivedReply(fakeDb({ messages: [stored] }), 'u1', RID), { found: true, text: 'What the student saw', sessionId: 'sess-1' });
  assert.deepEqual(await findReceivedReply(fakeDb({ reservations: [{ user_id: 'u1', operation_key: KEY, state: 'committed' }] }), 'u1', RID), { found: true, text: null, sessionId: null });
  // someone else's reply, an uncommitted operation, an unknown id and a user's own role filter all find nothing
  assert.equal((await findReceivedReply(fakeDb({ messages: [stored] }), 'u2', RID)).found, false);
  assert.equal((await findReceivedReply(fakeDb({ messages: [{ ...stored, role: 'user' }] }), 'u1', RID)).found, false);
  assert.equal((await findReceivedReply(fakeDb({ reservations: [{ user_id: 'u1', operation_key: KEY, state: 'released' }] }), 'u1', RID)).found, false);
  assert.equal((await findReceivedReply(fakeDb({ reservations: [{ user_id: 'u1', operation_key: KEY, state: 'executing' }] }), 'u1', RID)).found, false);
  assert.equal((await findReceivedReply(fakeDb({ messages: [stored] }), 'u1', 'short')).found, false);
  await assert.rejects(findReceivedReply(fakeDb({ failOn: 'mentor_messages' }), 'u1', RID), /REPORT_LOOKUP_FAILED/);
  await assert.rejects(findReceivedReply(fakeDb({ failOn: 'ai_credit_reservations' }), 'u1', RID), /REPORT_LOOKUP_FAILED/);
});

test('storeReport upserts on the per-student dedupe key and surfaces db errors', async () => {
  const db = fakeDb();
  const v = validateReport(good()).value;
  assert.deepEqual(await storeReport(db, 'u1', v), { ok: true });
  assert.deepEqual(db.log.upserts[0][2], { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
  assert.equal(db.log.upserts[0][1].user_id, 'u1');
  assert.equal(db.log.upserts[0][1].reason, 'unsafe_or_unkind');
  await assert.rejects(storeReport(fakeDb({ failOn: 'ai_reply_reports' }), 'u1', v), /REPORT_UNAVAILABLE/);
});

function post(body, { raw } = {}) {
  return new Request('http://localhost/api/ai/mentor/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });
}
function run(request, { user = 'u1', allowed = true, db = fakeDb({ messages: [stored] }) } = {}) {
  const seen = { limited: 0, dbOpened: 0 };
  return handleReportPost(request, {
    authenticate: async () => user,
    rateLimit: async (_r, id) => { seen.limited += 1; seen.limitedFor = id; return { allowed, headers: { 'Retry-After': '30' } }; },
    db: () => { seen.dbOpened += 1; return db; },
  }).then(async (res) => ({ res, body: await res.json(), seen, db }));
}

test('handler: signed out is 401 and touches nothing', async () => {
  const { res, seen } = await run(post(good()), { user: null });
  assert.equal(res.status, 401);
  assert.equal(seen.limited, 0);
  assert.equal(seen.dbOpened, 0);
});

test('handler: over the limit is 429 with Retry-After, before any read or write', async () => {
  const { res, seen } = await run(post(good()), { allowed: false });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '30');
  assert.equal(seen.dbOpened, 0);
});

test('handler: bad json, a wrong reason, a missing request id and an oversize body are refused before the database', async () => {
  for (const [request, status] of [
    [post(null, { raw: '{nope' }), 422], [post(good({ reason: 'Wrong answer' })), 422], [post(good({ requestId: undefined })), 422],
    [post(good({ reply: 'x'.repeat(9000) })), 413],
  ]) {
    const { res, seen } = await run(request);
    assert.equal(res.status, status);
    assert.equal(seen.dbOpened, 0);
  }
});

test('handler: a reply the student did not receive is 404 and nothing is stored', async () => {
  const { res, db } = await run(post(good()), { user: 'u2' });
  assert.equal(res.status, 404);
  assert.equal(db.reports.length, 0);
});

test('handler: a received reply is stored once with the text the student was shown, and a repeat adds nothing', async () => {
  const db = fakeDb({ messages: [stored] });
  const first = await run(post(good({ reply: 'text the phone made up' })), { db });
  assert.equal(first.res.status, 200);
  assert.equal(first.res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(first.body, { ok: true });
  assert.equal(db.reports.length, 1);
  assert.equal(db.reports[0].reply_excerpt, 'What the student saw');
  assert.equal(db.reports[0].session_id, 'sess-1');
  assert.equal(db.reports[0].reason, 'unsafe_or_unkind');
  assert.equal(db.reports[0].user_id, 'u1');
  assert.equal((await run(post(good()), { db })).res.status, 200);
  assert.equal(db.reports.length, 1);
});

test('handler: a database failure is 503 and says nothing about the database', async () => {
  for (const failOn of ['mentor_messages', 'ai_reply_reports']) {
    const { res, body } = await run(post(good()), { db: fakeDb({ messages: [stored], failOn }) });
    assert.equal(res.status, 503);
    assert.doesNotMatch(JSON.stringify(body), /down|supabase|postgres/i);
  }
});

test('route: bearer-aware auth, per-student persistent limits in two windows, write-only', () => {
  assert.match(ROUTE, /export async function POST[(]request/);
  assert.match(ROUTE, /\bauth\(req\)/);
  assert.doesNotMatch(ROUTE, /\bauth\(\s*\)/);
  assert.match(ROUTE, /checkPersistentRateLimit\(req,.*keyParts: \[userId\]/);
  assert.match(ROUTE, /handleReportPost/);
  assert.doesNotMatch(ROUTE, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(ROUTE, /\.select\(/);
  assert.equal(REPORT_LIMITS.length, 2);
  assert.ok(REPORT_LIMITS[0].windowMs < REPORT_LIMITS[1].windowMs && REPORT_LIMITS[0].limit < REPORT_LIMITS[1].limit);
  assert.equal(new Set(REPORT_LIMITS.map((l) => l.route)).size, 2);
});

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec('create table public.users(id text primary key);');
  await db.exec("insert into public.users values('u1'),('u2')");
  return db;
}

test('migration: idempotent, constraints, dedupe, index, RLS on and no client access', async () => {
  const db = await setup();
  try {
    const sql = readFileSync(MIGRATION, 'utf8');
    await db.exec(sql); await db.exec(sql); // idempotent
    const ins = (u, reason, reply, key) => db.query('insert into ai_reply_reports(user_id,reason,reply_excerpt,dedupe_key) values($1,$2,$3,$4)', [u, reason, reply, key]);
    await ins('u1', 'other', 'reply', 'ai-report-abc12345');
    await assert.rejects(ins('u1', 'other', 'reply', 'ai-report-abc12345'), /unique|duplicate/);
    await ins('u2', 'other', 'reply', 'ai-report-abc12345');
    await ins('u1', 'other', 'reply', null); await ins('u1', 'other', 'reply', null); // no key: never deduped
    await assert.rejects(ins('u1', '', 'reply', null), /check/);
    await assert.rejects(ins('u1', 'x'.repeat(121), 'reply', null), /check/);
    await assert.rejects(ins('u1', 'a', 'x'.repeat(1201), null), /check/);
    await assert.rejects(ins('nobody', 'a', 'b', null), /foreign key/);
    const idx = await db.query("select indexdef from pg_indexes where tablename='ai_reply_reports' and indexname='ai_reply_reports_created_at_idx'");
    assert.match(idx.rows[0].indexdef, /created_at/);
    assert.equal((await db.query("select relrowsecurity r from pg_class where relname='ai_reply_reports'")).rows[0].r, true);
    assert.equal((await db.query("select count(*)::int n from pg_policies where tablename='ai_reply_reports'")).rows[0].n, 0);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from ai_reply_reports'), /permission denied/);
      await assert.rejects(db.query("insert into ai_reply_reports(user_id,reason,reply_excerpt) values('u1','a','b')"), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    await db.query("insert into ai_reply_reports(user_id,reason,reply_excerpt) values('u1','other','by the server')");
    await db.exec('reset role');
    await db.exec("delete from public.users where id='u1'");
    assert.equal((await db.query("select count(*)::int n from ai_reply_reports where user_id='u1'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('undo: drops the table, can run twice, and the migration can run again after it', async () => {
  const db = await setup();
  try {
    const up = readFileSync(MIGRATION, 'utf8'); const down = readFileSync(UNDO, 'utf8');
    await db.exec(up);
    await db.exec(down); await db.exec(down);
    assert.equal((await db.query("select to_regclass('public.ai_reply_reports') as t")).rows[0].t, null);
    assert.equal((await db.query("select count(*)::int n from public.users")).rows[0].n, 2);
    await db.exec(up);
    assert.notEqual((await db.query("select to_regclass('public.ai_reply_reports') as t")).rows[0].t, null);
  } finally { await db.close(); }
});

test('the privacy page names the required stream events and the AI reply report in plain words', () => {
  const page = readFileSync(new URL('../../src/app/privacy/page.js', import.meta.url), 'utf8');
  assert.match(page, /Question stream activity \(required in the app\)/);
  for (const word of ['seen', 'attempted', 'skip']) assert.ok(page.includes(`${word} (`), word);
  assert.match(page, /signed in/);
  assert.match(page, /separate from the optional usage data/);
  assert.match(page, /Reporting an AI reply/);
  assert.match(page, /They are deleted with your account/);
  // Both sections stay held behind the app release gate until the app build that has them is live.
  assert.match(page, /APP_STREAM_AND_REPORT_LIVE \? \(/);
});

test('account deletion removes the reports', async () => {
  const { DELETION_STEPS } = await import('../../src/lib/server/accountDeletion.js');
  const step = DELETION_STEPS.find((s) => s.table === 'ai_reply_reports');
  assert.equal(step.action, 'delete');
  assert.ok(DELETION_STEPS.indexOf(step) < DELETION_STEPS.findIndex((s) => s.table === 'users'));
});
