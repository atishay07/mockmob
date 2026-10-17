// Security hotfix 17 Oct 2026 (branch fix/security-1017d):
//  (1) GET /api/creator/me and /creator hand a creator only what they need about a sale:
//      no raw Razorpay objects, buyer contact data, user ids or Razorpay ids;
//  (2) creator codes match exactly and case-insensitively: '_' (and '%', '*') are never wildcards,
//      and punctuation-only codes are rejected;
//  (3) a student report is recorded once per account per question, rate-limited per account, and
//      never unlists a question by itself: only 3 distinct accounts older than a day, or a moderator.
// Row shapes below are what PostgREST returns (text ids, timestamptz as ISO strings with +00:00).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATOR_SALE_COLUMNS, creatorSaleOut, saleRef } from '../../src/lib/referrals/creatorSales.js';
import {
  CODE_PATTERN, cleanCreatorCode, escapeLikePattern, exactCodePattern, isValidCreatorCode,
} from '../../src/lib/referrals/codeMatch.js';
import {
  REPORT_POLICY, activeReports, handleQuestionReport, isModeratorRow, qualifiedReporterIds, reportResetAt, toMs,
} from '../../src/lib/server/questionReports.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// ------------------------------------------------------------------ (1) creator sales

const PAYMENT_ROW = {
  id: 'b7f1c0de-1111-4222-8333-944455556666',
  user_id: 'user_buyer_42',
  order_id: 'order_Qx12AbCdEf',
  subscription_id: 'sub_Qx12AbCdEf',
  payment_id: 'pay_Qx12AbCdEf',
  plan_id: 'monthly',
  razorpay_plan_id: 'plan_Qx12',
  amount: 9900,
  amount_paid: 6900,
  currency: 'INR',
  status: 'captured',
  creator_code: 'rahul',
  creator_id: 'creator-1',
  offer_id: 'offer_SjGiVehyf7X33K',
  creator_earning: 2000,
  payout_id: null,
  raw_order: { id: 'order_Qx12AbCdEf', notes: { userId: 'user_buyer_42', email: 'buyer@example.com' } },
  raw_subscription: { id: 'sub_Qx12AbCdEf', customer_id: 'cust_9' },
  raw_payment: { id: 'pay_Qx12AbCdEf', email: 'buyer@example.com', contact: '+919800000000', vpa: 'buyer@okbank' },
  created_at: '2026-10-15T09:12:33.342954+00:00',
  updated_at: '2026-10-15T09:13:01.000001+00:00',
};

test('creatorSaleOut returns only date, plan, amounts, paid flag, earning, payout status and a one-way ref', () => {
  const sale = creatorSaleOut(PAYMENT_ROW);
  assert.deepEqual(Object.keys(sale).sort(), [
    'amount', 'amountPaid', 'createdAt', 'creatorEarning', 'currency', 'paid', 'payoutStatus', 'planId', 'ref', 'status',
  ]);
  assert.equal(sale.createdAt, Date.parse('2026-10-15T09:12:33.342Z'));
  assert.equal(sale.planId, 'monthly');
  assert.equal(sale.amountPaid, 6900);
  assert.equal(sale.paid, true);
  assert.equal(sale.creatorEarning, 2000);
  assert.equal(sale.payoutStatus, 'pending');
  const json = JSON.stringify(sale);
  for (const secret of ['buyer@example.com', '+919800000000', 'buyer@okbank', 'user_buyer_42', 'order_Qx12', 'sub_Qx12', 'pay_Qx12', 'cust_9', PAYMENT_ROW.id]) {
    assert.ok(!json.includes(secret), `the creator never sees ${secret}`);
  }
});

test('saleRef is stable, 12 hex characters and not the row id; paid follows the admin rule', () => {
  assert.equal(saleRef(PAYMENT_ROW.id), saleRef(PAYMENT_ROW.id));
  assert.match(saleRef(PAYMENT_ROW.id), /^[0-9a-f]{12}$/);
  assert.notEqual(saleRef('a'), saleRef('b'));
  assert.equal(saleRef(null), null);
  assert.equal(creatorSaleOut({ ...PAYMENT_ROW, payment_id: null }).paid, false);
  assert.equal(creatorSaleOut({ ...PAYMENT_ROW, status: 'created' }).paid, false);
  assert.equal(creatorSaleOut({ ...PAYMENT_ROW, amount_paid: 0 }).paid, false);
  assert.equal(creatorSaleOut({ ...PAYMENT_ROW, amount_paid: '6900' }).amountPaid, 6900, 'bigint/numeric strings are read');
  assert.equal(creatorSaleOut({ ...PAYMENT_ROW, payout_id: 'payout-1' }).payoutStatus, 'paid');
  assert.equal(creatorSaleOut(null), null);
});

test('the creator read selects no raw JSON, user id or Razorpay ids, and both creator surfaces use it', () => {
  const columns = CREATOR_SALE_COLUMNS.split(',').map((c) => c.trim());
  for (const banned of ['*', 'raw_payment', 'raw_order', 'raw_subscription', 'user_id', 'order_id', 'subscription_id', 'razorpay_plan_id']) {
    assert.ok(!columns.includes(banned), `${banned} is not read for a creator`);
  }
  const db = read('data/db.js');
  assert.match(db, /async listCreatorSales\(creatorId[\s\S]*?\.select\(CREATOR_SALE_COLUMNS\)[\s\S]*?\.map\(creatorSaleOut\)/);
  for (const path of ['src/app/api/creator/me/route.js', 'src/app/creator/page.jsx']) {
    const src = read(path);
    assert.match(src, /Database\.listCreatorSales\(creator\.id/, `${path} reads the cut-down sales`);
    assert.doesNotMatch(src, /listOrders/, `${path} never reads full payment rows`);
  }
  const client = read('src/app/creator/CreatorDashboardClient.jsx');
  assert.doesNotMatch(client, /rawPayment|rawOrder|userId|paymentId|payoutId/);
});

// ------------------------------------------------------------------ (2) creator codes

// Postgres ILIKE with the default backslash escape, as PostgREST runs it ('*' is PostgREST's alias for '%').
function ilike(value, pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) { re += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i += 1; }
    else if (ch === '%' || ch === '*') re += '.*';
    else if (ch === '_') re += '.';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'is').test(value);
}

const CREATOR_CODES = ['rahul', 'hey30', 'flash', 'ab_cd', 'priya.k', 'neha-12'];

test('the old unescaped pattern was a wildcard; the escaped one matches only the code itself', () => {
  assert.deepEqual(CREATOR_CODES.filter((code) => ilike(code, '_____')), ['rahul', 'hey30', 'flash', 'ab_cd'], 'the bug, reproduced');
  assert.equal(exactCodePattern('_____'), null, 'punctuation-only codes are rejected before any lookup');
  for (const input of ['a____', 'r_hul', 'ra%', 'r*', 'ab_cd', 'RAHUL', ' Priya.K ']) {
    const pattern = exactCodePattern(input);
    const matches = pattern ? CREATOR_CODES.filter((code) => ilike(code, pattern)) : [];
    const expected = CREATOR_CODES.filter((code) => code === cleanCreatorCode(input));
    assert.deepEqual(matches, expected, `${JSON.stringify(input)} matches exactly ${JSON.stringify(expected)}`);
  }
  assert.ok(ilike('ab_cd', exactCodePattern('ab_cd')), 'a real underscore still matches itself');
  assert.ok(!ilike('abxcd', exactCodePattern('ab_cd')), 'but is no longer "any character"');
});

test('cleanCreatorCode: lower-cased, trimmed, [a-z0-9._-] with at least one letter or digit', () => {
  assert.equal(cleanCreatorCode('  RaHul '), 'rahul');
  assert.equal(cleanCreatorCode('ra hul'), 'rahul');
  for (const bad of ['', '   ', '_____', '...', '-_-', '.', 'ra%', 'ra*', 'ra\\', "ra'", 'x'.repeat(65), null, undefined, 42]) {
    assert.equal(cleanCreatorCode(bad), null, `${JSON.stringify(bad)} is not a creator code`);
  }
  assert.equal(isValidCreatorCode('ab_cd'), true);
  assert.equal(isValidCreatorCode('___'), false);
  assert.equal(isValidCreatorCode('Rahul'), false, 'admin routes store lower-case codes only');
  assert.equal(escapeLikePattern('a\\b%c_d*e'), 'a\\\\b\\%c\\_d\\*e');
  assert.ok(CODE_PATTERN.test('a.b-c_d'));
});

test('every creator-code lookup uses the escaped exact pattern; the admin routes share the validator', () => {
  const offers = read('src/lib/referrals/offers.js');
  assert.match(offers, /\.ilike\('code', exactCodePattern\(code\)\)/);
  assert.match(offers, /return cleanCreatorCode\(trimmed\)/);
  assert.doesNotMatch(offers, /const CODE_PATTERN/);
  const db = read('data/db.js');
  assert.match(db, /async getCreatorByCode\(code\) \{[\s\S]*?exactCodePattern[\s\S]*?\.ilike\('code', pattern\)/);
  assert.match(db, /\.ilike\('email', escapeLikePattern\(trimmed\)\)/, 'creator email lookup cannot wildcard either');
  assert.doesNotMatch(db, /\.ilike\('code', trimmed\)/);
  for (const path of ['src/app/api/admin/creators/route.js', 'src/app/api/admin/creators/[id]/route.js']) {
    const src = read(path);
    assert.match(src, /isValidCreatorCode\(code\)/, `${path} validates with the shared rule`);
    assert.doesNotMatch(src, /CODE_PATTERN/);
  }
});

// ------------------------------------------------------------------ (3) question reports

const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const OLD = '2026-09-01T08:00:00.123456+00:00'; // account created long ago
const NEW = '2026-10-17T06:00:00.654321+00:00'; // six hours before NOW
const LIVE_AT = '2026-10-01T00:00:00+00:00';

// A minimal supabase-js stand-in: records each request and answers from `answer(req)`.
function fakeDb(answer) {
  const calls = [];
  const from = (table) => {
    const req = { table, op: 'select', columns: null, patch: null, filters: [] };
    calls.push(req);
    const builder = {
      select(columns) { if (req.op === 'select') req.columns = columns; else req.returning = columns; return builder; },
      insert(row) { req.op = 'insert'; req.patch = row; return builder; },
      update(patch) { req.op = 'update'; req.patch = patch; return builder; },
      eq(col, val) { req.filters.push(['eq', col, val]); return builder; },
      neq(col, val) { req.filters.push(['neq', col, val]); return builder; },
      in(col, val) { req.filters.push(['in', col, val]); return builder; },
      order() { return builder; },
      limit() { return builder; },
      single() { return Promise.resolve(answer(req)); },
      maybeSingle() { return Promise.resolve(answer(req)); },
      then(resolve, reject) { return Promise.resolve(answer(req)).then(resolve, reject); },
    };
    return builder;
  };
  return { from, calls };
}

function world({ events = [], users = [], updateError = null, eventsError = null } = {}) {
  return fakeDb((req) => {
    if (req.table === 'question_interactions' && req.op === 'select') return { data: eventsError ? null : events, error: eventsError };
    if (req.table === 'users') {
      const ids = req.filters.find(([op, col]) => op === 'in' && col === 'id')?.[2] || [];
      return { data: users.filter((u) => ids.includes(u.id)), error: null };
    }
    if (req.table === 'questions' && req.op === 'update') return { data: null, error: updateError };
    throw new Error(`unexpected request ${req.table} ${req.op}`);
  });
}

const report = (user_id, created_at) => ({ user_id, interaction_type: 'report', created_at });
const liveQuestion = { id: 'q_econ_001', status: 'live', live_at: LIVE_AT };

function inserter() {
  const rows = [];
  const fn = async () => { rows.push(1); return { id: `qi_${rows.length}` }; };
  fn.rows = rows;
  return fn;
}

const updates = (db) => db.calls.filter((c) => c.table === 'questions' && c.op === 'update');

test('one report from a normal account is recorded and the question stays live', async () => {
  const db = world({ users: [{ id: 'u1', role: 'student', is_moderator: false, created_at: OLD }] });
  const insertReport = inserter();
  const out = await handleQuestionReport({ db, question: liveQuestion, userId: 'u1', insertReport, now: NOW });
  assert.equal(out.status, 'recorded');
  assert.equal(out.interactionId, 'qi_1');
  assert.equal(out.queued, false);
  assert.equal(out.reason, 'below_threshold');
  assert.equal(insertReport.rows.length, 1);
  assert.equal(updates(db).length, 0, 'no question row is touched');
});

test('the same account reporting again is a duplicate: nothing inserted, nothing changed', async () => {
  const db = world({ events: [report('u1', '2026-10-16T10:00:00.5+00:00')], users: [{ id: 'u1', role: 'student', is_moderator: false, created_at: OLD }] });
  const insertReport = inserter();
  const out = await handleQuestionReport({ db, question: liveQuestion, userId: 'u1', insertReport, now: NOW });
  assert.deepEqual(out, { status: 'duplicate' });
  assert.equal(insertReport.rows.length, 0);
  assert.equal(updates(db).length, 0);
});

test('the third distinct account older than a day queues the question exactly as the moderation queue reads it', async () => {
  const users = ['u1', 'u2', 'u3'].map((id) => ({ id, role: 'student', is_moderator: false, created_at: OLD }));
  const db = world({ events: [report('u2', '2026-10-16T11:00:00.000001+00:00'), report('u1', '2026-10-16T10:00:00+00:00')], users });
  const out = await handleQuestionReport({ db, question: liveQuestion, userId: 'u3', insertReport: inserter(), now: NOW });
  assert.equal(out.queued, true);
  assert.equal(out.reason, 'threshold');
  assert.equal(out.reporters, 3);
  const [update] = updates(db);
  assert.deepEqual(update.patch, {
    status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review', updated_at: new Date(NOW).toISOString(),
  });
  assert.deepEqual(update.filters, [['eq', 'id', 'q_econ_001'], ['eq', 'status', 'live']], 'only a still-live question moves');
  // getPendingQuestions reads status 'pending' + verification_state in (unverified, pending_review, disputed).
  assert.match(read('data/db.js'), /async getPendingQuestions\(\)[\s\S]*?\.eq\('status', 'pending'\)[\s\S]*?'disputed'/);
});

test('accounts younger than a day do not count, so three fresh accounts cannot unlist a question', async () => {
  const users = [
    { id: 'u1', role: 'student', is_moderator: false, created_at: OLD },
    { id: 'n2', role: 'student', is_moderator: false, created_at: NEW },
    { id: 'n3', role: 'student', is_moderator: false, created_at: NEW },
  ];
  const db = world({ events: [report('n2', '2026-10-17T07:00:00+00:00'), report('u1', '2026-10-16T10:00:00+00:00')], users });
  const out = await handleQuestionReport({ db, question: liveQuestion, userId: 'n3', insertReport: inserter(), now: NOW });
  assert.equal(out.queued, false);
  assert.equal(out.reporters, 1);
  assert.equal(updates(db).length, 0);
});

test('reports from before the question last went live (moderator kept it) or before report_resolved do not count', async () => {
  const users = ['u1', 'u2', 'u3'].map((id) => ({ id, role: 'student', is_moderator: false, created_at: OLD }));
  const reApproved = { ...liveQuestion, live_at: '2026-10-16T12:00:00+00:00' };
  let db = world({ events: [report('u2', '2026-10-16T11:00:00+00:00'), report('u1', '2026-10-16T10:00:00+00:00')], users });
  let out = await handleQuestionReport({ db, question: reApproved, userId: 'u3', insertReport: inserter(), now: NOW });
  assert.equal(out.queued, false, 'two reports before the re-approval are spent');
  assert.equal(out.reporters, 1);

  db = world({ events: [{ user_id: 'mod1', interaction_type: 'report_resolved', created_at: '2026-10-16T11:30:00+00:00' }, report('u2', '2026-10-16T11:00:00+00:00'), report('u1', '2026-10-16T10:00:00+00:00')], users });
  out = await handleQuestionReport({ db, question: liveQuestion, userId: 'u1', insertReport: inserter(), now: NOW });
  assert.equal(out.status, 'recorded', 'after report_resolved the same account may report again');
  assert.equal(out.queued, false);
});

test('a moderator report queues the question on its own; a report on a non-live question changes nothing', async () => {
  let db = world({ users: [{ id: 'mod1', role: 'moderator', is_moderator: false, created_at: NEW }] });
  let out = await handleQuestionReport({ db, question: liveQuestion, userId: 'mod1', insertReport: inserter(), now: NOW });
  assert.equal(out.queued, true);
  assert.equal(out.reason, 'moderator');
  assert.equal(updates(db).length, 1);

  db = world({ users: [{ id: 'u1', role: 'student', is_moderator: false, created_at: OLD }] });
  out = await handleQuestionReport({ db, question: { ...liveQuestion, status: 'pending' }, userId: 'u1', insertReport: inserter(), now: NOW });
  assert.equal(out.queued, false);
  assert.equal(out.reason, 'not_live');
  assert.equal(db.calls.filter((c) => c.table === 'users').length, 0);
  assert.equal(updates(db).length, 0);
});

test('database errors surface instead of being swallowed', async () => {
  const boom = { message: 'connection reset', code: '08006' };
  await assert.rejects(handleQuestionReport({ db: world({ eventsError: boom }), question: liveQuestion, userId: 'u1', insertReport: inserter(), now: NOW }), (e) => e.message === 'connection reset');
  const users = ['u1', 'u2', 'u3'].map((id) => ({ id, role: 'student', is_moderator: false, created_at: OLD }));
  const db = world({ events: [report('u2', '2026-10-16T11:00:00+00:00'), report('u1', '2026-10-16T10:00:00+00:00')], users, updateError: boom });
  await assert.rejects(handleQuestionReport({ db, question: liveQuestion, userId: 'u3', insertReport: inserter(), now: NOW }), (e) => e.message === 'connection reset');
  await assert.rejects(handleQuestionReport({ db: world(), question: liveQuestion, userId: 'u1', insertReport: async () => { throw new Error('insert failed'); }, now: NOW }), /insert failed/);
});

test('helpers read PostgREST timestamps and roles', () => {
  assert.equal(toMs('2026-05-03T06:33:18.342954+00:00'), Date.parse('2026-05-03T06:33:18.342Z'));
  assert.equal(toMs(null), 0);
  assert.equal(toMs('not a date'), 0);
  assert.equal(isModeratorRow({ role: 'admin' }), true);
  assert.equal(isModeratorRow({ role: 'student', is_moderator: true }), true);
  assert.equal(isModeratorRow({ role: 'student', is_moderator: false }), false);
  assert.equal(isModeratorRow(null), false);
  assert.equal(reportResetAt({ live_at: null }, []), 0);
  assert.equal(activeReports([report('a', LIVE_AT)], toMs(LIVE_AT)).length, 0, 'a report at the reset instant is spent');
  assert.equal(qualifiedReporterIds([report('ghost', OLD)], [], { now: NOW }).size, 0, 'an unknown account never counts');
  assert.equal(REPORT_POLICY.distinctReporters, 3);
  assert.equal(REPORT_POLICY.minAccountAgeMs, 86_400_000);
});

test('the interact route rate-limits reports per account and no longer unlists on one report', () => {
  const src = read('src/app/api/questions/[id]/interact/route.js');
  assert.doesNotMatch(src, /queueReportedQuestion/);
  assert.doesNotMatch(src, /status:\s*'pending'/, 'the route itself never writes a question status');
  assert.match(src, /checkPersistentRateLimit\(request, \{[\s\S]*?route: '\/api\/questions\/interact#report'[\s\S]*?identityOnly: true[\s\S]*?keyParts: \[user_id\]/);
  assert.match(src, /status: 429/);
  assert.match(src, /handleQuestionReport\(\{/);
  const reportBranch = src.indexOf("if (interaction_type === 'report') {");
  const genericInsert = src.indexOf('// ---- Insert interaction (append-only) ----');
  assert.ok(reportBranch > 0 && reportBranch < genericInsert, 'reports return before the generic insert');
});
