// GET /api/me/credits (audit findings 12 and 13): the contract, the words, the paging and the read-only promise.
// data/tests/fixtures/credits/contract_credits_v1.json is the parity contract, copied byte for byte to
// flutter_app/test/fixtures/credits/ so the app parses exactly what this route builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAGE_SIZE, aiWhat, buildHistory, creditsBody, encodeCursor, istDate, loadHistory, oneBalanceBlock, parseCursor, planOf, practiceWhat,
  repairDetails, repairIdsIn, tsKey,
} from '../../src/lib/server/credits.js';
import { mistakeKey } from '../../src/lib/server/repairRecord.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = resolve(root, 'data/tests/fixtures/credits/contract_credits_v1.json');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const U = 'user_1';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// ---- the fixture inputs: what the two ledgers hold, as the route reads them -------------------------------------------
const repairKey = (a, q) => `repair:${mistakeKey(U, a, q)}:req0000000000001`;
const ATTEMPTS = [{
  id: 'att_9', subject: 'accountancy', details: [{ qid: 'qa', isCorrect: true }, { qid: 'qb', isCorrect: false }],
  questions_snapshot: [{ id: 'qa' }, { id: 'qb' }],
}];
const AI_ROWS = [
  { id: id(11), created_at: '2026-10-14T09:30:00.000000+00:00', amount: -1, reason: 'ai_reserve', feature: 'score_recovery_repair', reference: repairKey('att_9', 'qb'), balance_after: 9 },
  { id: id(12), created_at: '2026-10-13T18:00:00.000000+00:00', amount: -1, reason: 'ai_reserve', feature: 'prepos_mentor', reference: 'prepos:user_1:abcdefghijklmnop', balance_after: 10 },
  { id: id(13), created_at: '2026-10-13T18:00:05.000000+00:00', amount: 1, reason: 'ai_release', feature: 'prepos_mentor', reference: 'prepos:user_1:abcdefghijklmnop', balance_after: 11 },
];
const PRACTICE_ROWS = [
  { id: id(21), created_at: '2026-10-14T11:00:00.000000+00:00', amount: -10, credit_delta: -10, type: 'spend', action: 'attempt', reference: 'practice_att_10' },
  { id: id(22), created_at: '2026-10-14T05:00:00.000000+00:00', amount: 10, credit_delta: 10, type: 'bonus', action: 'legacy', reference: 'daily_login:2026-10-14' },
  { id: id(23), created_at: '2026-10-12T08:00:00.000000+00:00', amount: -50, credit_delta: -50, type: 'spend', action: 'attempt_full', reference: 'practice_att_8' },
  { id: id(24), created_at: '2026-10-11T08:00:00.000000+00:00', amount: 2, credit_delta: 2, type: 'earn', action: 'legacy', reference: 'vote:q_77' },
];
const WALLET = { known: true, total: 9, resetAt: '2026-10-31T18:30:00.000Z', state: 'available' };

function fixtureBody() {
  const details = repairDetails({ userId: U, ids: repairIdsIn(AI_ROWS), attempts: ATTEMPTS });
  const { history, next } = buildHistory({ practiceRows: PRACTICE_ROWS, aiRows: AI_ROWS, practiceBalance: 40, aiBalance: 9, details });
  return creditsBody({ practiceBalance: 40, wallet: WALLET, paid: false, premiumUntil: null, history, next });
}

// Run once with CREDITS_WRITE_FIXTURE=1 to (re)write the contract file; the app copy must then be copied byte for byte.
if (process.env.CREDITS_WRITE_FIXTURE === '1') {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(FIXTURE, `${JSON.stringify(fixtureBody(), null, 2)}\n`);
}

test('the contract fixture is exactly what the route builds, and its shape is the agreed one', () => {
  const body = fixtureBody();
  assert.deepEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')), body);
  assert.deepEqual(Object.keys(body), ['practice', 'ai', 'plan', 'history', 'nextCursor']);
  assert.deepEqual(Object.keys(body.practice), ['balance', 'renewsOn', 'label']);
  assert.deepEqual(Object.keys(body.ai), ['balance', 'renewsOn', 'label']);
  assert.deepEqual(Object.keys(body.plan), ['name', 'until']);
  assert.equal(body.practice.label, 'Practice credits');
  assert.equal(body.ai.label, 'AI credits');
  for (const line of body.history) {
    assert.deepEqual(Object.keys(line), ['at', 'pool', 'what', 'delta', 'balanceAfter']);
    assert.match(line.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(['practice', 'ai'].includes(line.pool));
    assert.ok(Number.isInteger(line.delta) && Number.isInteger(line.balanceAfter));
  }
});

test('the fixture reads newest first and names each line in plain words', () => {
  const lines = JSON.parse(readFileSync(FIXTURE, 'utf8')).history;
  const times = lines.map((l) => l.at);
  assert.deepEqual([...times].sort().reverse(), times);
  assert.deepEqual(lines.map((l) => [l.pool, l.what, l.delta, l.balanceAfter]), [
    ['practice', 'Practice set', -10, 40],
    ['ai', 'Repair, Q2 Accountancy', -1, 9],
    ['practice', 'Daily bonus', 10, 50],
    ['ai', 'Ask Mobi returned', 1, 11],
    ['ai', 'Ask Mobi', -1, 10],
    ['practice', 'Full mock', -50, 40],
    ['practice', 'Rated a question', 2, 90],
  ]);
  const all = JSON.stringify(lines);
  assert.ok(!/PrepOS|!|—|·/.test(all), 'plain copy: no PrepOS, no "!", no em dash, no middle dot');
});

test('renew date is the India date of the monthly reset; practice credits do not renew', () => {
  const body = fixtureBody();
  assert.equal(body.ai.renewsOn, '2026-11-01');
  assert.equal(body.practice.renewsOn, null);
  assert.equal(istDate('2026-10-31T18:30:00.000Z'), '2026-11-01');
  assert.equal(istDate('nonsense'), null);
});

test('a wallet that could not be read is unknown, never 0', () => {
  const body = creditsBody({ practiceBalance: 40, wallet: { known: false, total: null, resetAt: null }, paid: false, premiumUntil: null, history: [], next: null });
  assert.deepEqual(body.ai, { balance: null, renewsOn: null, label: 'AI credits' });
  const none = creditsBody({ practiceBalance: undefined, wallet: null, paid: false, premiumUntil: null, history: [], next: null });
  assert.equal(none.practice.balance, null);
});

test('plan is Free or Pro with the paid-through date in India time', () => {
  assert.deepEqual(planOf({ paid: false, premiumUntil: '2027-01-12T00:00:00Z' }), { name: 'Free', until: null });
  assert.deepEqual(planOf({ paid: true, premiumUntil: '2027-01-11T20:00:00.000Z' }), { name: 'Pro', until: '2027-01-12' });
  assert.deepEqual(planOf({ paid: true, premiumUntil: null }), { name: 'Pro', until: null });
});

test('words: every reason and feature has a plain line, and a repair names its question and subject', () => {
  assert.equal(aiWhat({ reason: 'monthly_grant' }), 'Free credits for the month');
  assert.equal(aiWhat({ reason: 'pack_purchase' }), 'Credits added');
  assert.equal(aiWhat({ reason: 'admin_adjustment' }), 'Adjustment from MockMob');
  assert.equal(aiWhat({ reason: 'expiry' }), 'Free credits ended');
  assert.equal(aiWhat({ reason: 'ai_spend', feature: 'rival_quick' }), 'Rival battle');
  assert.equal(aiWhat({ reason: 'ai_reserve', feature: 'score_recovery_repair' }, 'Q7 Accountancy'), 'Repair, Q7 Accountancy');
  assert.equal(aiWhat({ reason: 'ai_release', feature: 'score_recovery_repair' }, 'Q7 Accountancy'), 'Repair returned, Q7 Accountancy');
  assert.equal(aiWhat({ reason: 'ai_reserve', feature: 'something_new' }), 'AI help');
  assert.equal(practiceWhat({ credit_delta: -10, action: 'attempt', reference: 'practice_x' }), 'Practice set');
  assert.equal(practiceWhat({ credit_delta: -50, action: 'attempt_full', reference: 'practice_x' }), 'Full mock');
  assert.equal(practiceWhat({ credit_delta: 10, action: 'legacy', reference: 'daily_login:2026-10-14' }), 'Daily bonus');
  assert.equal(practiceWhat({ credit_delta: 1, action: 'legacy', reference: 'attempt:a:question:q' }), 'Practice answers');
  assert.equal(practiceWhat({ credit_delta: 10, action: 'contribute', reference: 'question_approved_9' }), 'Question approved');
  assert.equal(practiceWhat({ credit_delta: 20, action: 'legacy', reference: 'x' }), 'Credits added');
});

test('a repair for an attempt that cannot be found keeps the plain line', () => {
  const ids = repairIdsIn([{ feature: 'score_recovery_repair', reference: repairKey('gone', 'q') }]);
  assert.equal(repairDetails({ userId: U, ids, attempts: ATTEMPTS }).size, 0);
  const { history } = buildHistory({
    practiceRows: [], aiRows: [{ id: id(1), created_at: '2026-10-14T09:30:00+00:00', amount: -1, reason: 'ai_reserve', feature: 'score_recovery_repair', reference: repairKey('gone', 'q'), balance_after: 4 }],
    practiceBalance: 1, aiBalance: 4,
  });
  assert.equal(history[0].what, 'Repair');
});

// ---- paging ---------------------------------------------------------------------------------------------------------
const practiceLedger = (n) => Array.from({ length: n }, (_, i) => ({
  id: id(1000 + i), created_at: new Date(Date.UTC(2026, 9, 14, 12, 0, 0) - i * 60000).toISOString().replace('Z', '000+00:00'),
  amount: i % 2 ? 2 : -10, credit_delta: i % 2 ? 2 : -10, type: i % 2 ? 'earn' : 'spend', action: i % 2 ? 'legacy' : 'attempt', reference: i % 2 ? `vote:q${i}` : `practice_${i}`,
}));

test('30 lines a page; the cursor carries the running balance so every page states its own balance after each line', () => {
  const rows = practiceLedger(75);
  const all = [];
  let cursor = null;
  let pages = 0;
  for (;;) {
    const after = rows.filter((r) => !cursor || tsKey(r.created_at) < tsKey(cursor.at) || (tsKey(r.created_at) === tsKey(cursor.at) && r.id < cursor.id));
    const { history, next } = buildHistory({ practiceRows: after.slice(0, PAGE_SIZE + 1), aiRows: [], practiceBalance: 400, aiBalance: null, cursor });
    pages += 1;
    assert.equal(history.length, next ? PAGE_SIZE : after.length);
    all.push(...history);
    if (!next) break;
    cursor = parseCursor(next);
    assert.ok(cursor, 'the cursor we issue parses');
  }
  assert.equal(pages, 3);
  assert.equal(all.length, 75);
  // One continuous walk: each line's balance after, minus its change, is the next line's balance after.
  assert.equal(all[0].balanceAfter, 400);
  for (let i = 1; i < all.length; i += 1) assert.equal(all[i].balanceAfter, all[i - 1].balanceAfter - all[i - 1].delta, `line ${i}`);
});

test('lines of both pools merge by time, and the AI ledger keeps its own recorded balance', () => {
  const { history } = buildHistory({ practiceRows: PRACTICE_ROWS, aiRows: AI_ROWS, practiceBalance: 40, aiBalance: 9 });
  assert.deepEqual(history.map((l) => l.pool), ['practice', 'ai', 'practice', 'ai', 'ai', 'practice', 'practice']);
  const ai = history.filter((l) => l.pool === 'ai');
  assert.deepEqual(ai.map((l) => l.balanceAfter), [9, 11, 10], 'balance_after from the ledger wins');
});

test('without a recorded AI balance the running balance counts back from the wallet, and unknown stays null', () => {
  const rows = [
    { id: id(2), created_at: '2026-10-14T10:00:00+00:00', amount: -1, reason: 'ai_reserve', feature: 'prepos_mentor', reference: 'k', balance_after: null },
    { id: id(1), created_at: '2026-10-14T09:00:00+00:00', amount: -2, reason: 'ai_reserve', feature: 'prepos_mentor', reference: 'k2', balance_after: null },
  ];
  assert.deepEqual(buildHistory({ practiceRows: [], aiRows: rows, practiceBalance: 0, aiBalance: 7 }).history.map((l) => l.balanceAfter), [7, 8]);
  assert.deepEqual(buildHistory({ practiceRows: [], aiRows: rows, practiceBalance: 0, aiBalance: null }).history.map((l) => l.balanceAfter), [null, null]);
});

test('same-instant lines keep a stable order by id, and a page boundary never repeats or skips one', () => {
  const same = Array.from({ length: 5 }, (_, i) => ({ id: id(50 + i), created_at: '2026-10-14T10:00:00.123456+00:00', amount: -1, credit_delta: -1, type: 'spend', action: 'attempt', reference: `r${i}` }));
  const first = buildHistory({ practiceRows: same, aiRows: [], practiceBalance: 10, aiBalance: null, pageSize: 2 });
  assert.ok(first.next);
  const cursor = parseCursor(first.next);
  assert.equal(cursor.id, id(53));
  const rest = same.filter((r) => r.id < cursor.id);
  const second = buildHistory({ practiceRows: rest, aiRows: [], practiceBalance: 10, aiBalance: null, cursor, pageSize: 2 });
  assert.equal(second.history[0].balanceAfter, 12);
  assert.equal(second.history.length, 2);
});

test('microsecond timestamps sort correctly and a cursor keeps the digits', () => {
  assert.ok(tsKey('2026-10-14T10:00:00.123456+00:00') > tsKey('2026-10-14T10:00:00.123455+00:00'));
  assert.ok(tsKey('2026-10-14T10:00:00+00:00') < tsKey('2026-10-14T10:00:00.5+00:00'));
  assert.equal(tsKey('2026-10-14T10:00:00Z'), tsKey('2026-10-14T10:00:00.000000+00:00'));
  const c = encodeCursor({ at: '2026-10-14T10:00:00.123456+00:00', id: id(5), practice: 7, ai: null });
  assert.deepEqual(parseCursor(c), { at: '2026-10-14T10:00:00.123456+00:00', id: id(5), practice: 7, ai: null });
});

test('a cursor that is not ours is refused (the route answers 422), and nothing in it can reach the query', () => {
  assert.equal(parseCursor(null), null);
  assert.equal(parseCursor(''), null);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  for (const bad of ['!!', 'x'.repeat(500), 'e30', enc({ at: '2026-10-14T10:00:00Z', id: 'x' }),
    enc({ at: '2026-10-14T10:00:00Z),user_id.neq.x,(a', id: id(1), p: 1, a: 1 }),
    enc({ at: '2026-10-14T10:00:00Z', id: id(1), p: 'x', a: 1 })]) {
    assert.equal(parseCursor(bad), undefined, bad.slice(0, 30));
  }
});

// ---- the reads: read-only, own rows only, a failed ledger is unavailable, a missing one is empty --------------------
function fakeDb({ credit_transactions = [], ai_credit_ledger = [], attempts = [], errors = {} } = {}) {
  const log = [];
  return {
    log,
    from(table) {
      const entry = { table, ops: [] };
      log.push(entry);
      const chain = new Proxy({}, {
        get(_, prop) {
          if (prop === 'then') {
            const rows = { credit_transactions, ai_credit_ledger, attempts }[table] || [];
            return (resolveFn) => resolveFn(errors[table] ? { data: null, error: errors[table] } : { data: rows, error: null });
          }
          return (...args) => { entry.ops.push([prop, ...args]); return chain; };
        },
      });
      return chain;
    },
  };
}

test('loadHistory reads only the student\'s own rows, never writes, and asks for one extra row to know there is more', async () => {
  const db = fakeDb({ credit_transactions: PRACTICE_ROWS, ai_credit_ledger: AI_ROWS, attempts: ATTEMPTS });
  const { history, next } = await loadHistory({ userId: U, practiceBalance: 40, aiBalance: 9, db });
  assert.equal(history.length, 7);
  assert.equal(next, null);
  assert.deepEqual(db.log.map((c) => c.table).sort(), ['ai_credit_ledger', 'attempts', 'credit_transactions']);
  for (const c of db.log) {
    const names = c.ops.map((o) => o[0]);
    assert.ok(!names.some((n) => ['insert', 'update', 'upsert', 'delete', 'rpc'].includes(n)), `${c.table} is read only`);
    assert.ok(c.ops.some((o) => o[0] === 'eq' && o[1] === 'user_id' && o[2] === U), `${c.table} is scoped to the student`);
  }
  const ledger = db.log.find((c) => c.table === 'credit_transactions');
  assert.deepEqual(ledger.ops.find((o) => o[0] === 'limit'), ['limit', PAGE_SIZE + 1]);
  assert.ok(history.some((l) => l.what === 'Repair, Q2 Accountancy'));
});

test('loadHistory with a cursor filters both ledgers strictly older than it', async () => {
  const db = fakeDb();
  const cursor = parseCursor(encodeCursor({ at: '2026-10-14T10:00:00.123456+00:00', id: id(5), practice: 7, ai: 3 }));
  await loadHistory({ userId: U, practiceBalance: 1, aiBalance: 1, cursor, db });
  for (const c of db.log.filter((x) => x.table !== 'attempts')) {
    const or = c.ops.find((o) => o[0] === 'or');
    assert.equal(or[1], `created_at.lt.2026-10-14T10:00:00.123456+00:00,and(created_at.eq.2026-10-14T10:00:00.123456+00:00,id.lt.${id(5)})`);
  }
});

test('a failing ledger read is unavailable; a ledger table that does not exist yet is just empty', async () => {
  await assert.rejects(loadHistory({ userId: U, practiceBalance: 1, aiBalance: 1, db: fakeDb({ errors: { credit_transactions: { code: '500', message: 'boom' } } }) }), (e) => e.code === 'CREDITS_UNAVAILABLE');
  const empty = await loadHistory({ userId: U, practiceBalance: 1, aiBalance: 1, db: fakeDb({ credit_transactions: PRACTICE_ROWS, errors: { ai_credit_ledger: { code: '42P01', message: 'relation "ai_credit_ledger" does not exist' } } }) });
  assert.equal(empty.history.length, 4);
});

test('naming a repair is a nicety: if the attempts read fails the history still loads', async () => {
  const db = fakeDb({ ai_credit_ledger: AI_ROWS, errors: { attempts: { code: '500', message: 'boom' } } });
  const { history } = await loadHistory({ userId: U, practiceBalance: 1, aiBalance: 9, db });
  assert.ok(history.some((l) => l.what === 'Repair'));
});

// ---- the route file --------------------------------------------------------------------------------------------------
test('the route needs a signed-in student, refuses a bad cursor, and exports only GET', () => {
  const src = readFileSync(resolve(root, 'src/app/api/me/credits/route.js'), 'utf8');
  assert.match(src, /export async function GET\(request\)/);
  assert.match(src, /auth\(request\)/);
  assert.match(src, /status: 401/);
  assert.match(src, /status: 422/);
  assert.match(src, /no-store/);
  assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(src, /\.(insert|update|upsert|delete|rpc)\(/);
});

// ---- One credits balance (owner, 18 Oct 2026, D78) -------------------------------------------------------------------
test('one balance: every line states the one total after it, across both ledgers, counted back from the live total', () => {
  const { history } = buildHistory({ practiceRows: PRACTICE_ROWS, aiRows: AI_ROWS, total: 49, periodStart: '2026-09-30T18:30:00.000Z' });
  assert.deepEqual(history.map((l) => l.pool), ['practice', 'ai', 'practice', 'ai', 'ai', 'practice', 'practice']);
  // 49 now; before the -10 set it was 59; before the -1 repair 60; before the +10 bonus 50; and so on.
  assert.deepEqual(history.map((l) => l.balanceAfter), [49, 59, 60, 50, 49, 50, 100]);
  for (let i = 1; i < history.length; i += 1) assert.equal(history[i].balanceAfter, history[i - 1].balanceAfter - history[i - 1].delta);
});

test('one balance: a line from before this IST month has no balance to state (the free credits came back silently)', () => {
  const { history, next } = buildHistory({ practiceRows: PRACTICE_ROWS, aiRows: AI_ROWS, total: 49, periodStart: '2026-10-13T00:00:00.000Z', pageSize: 6 });
  assert.deepEqual(history.map((l) => l.balanceAfter), [49, 59, 60, 50, 49, null]);
  assert.equal(parseCursor(next).practice, null, 'the next page stays unknown too');
  assert.deepEqual(buildHistory({ practiceRows: PRACTICE_ROWS, aiRows: [], total: null }).history.map((l) => l.balanceAfter), [null, null, null, null]);
});

test('one balance: the cursor carries the one running total, so page two continues it', () => {
  const rows = practiceLedger(40);
  const first = buildHistory({ practiceRows: rows.slice(0, PAGE_SIZE + 1), aiRows: [], total: 400 });
  const cursor = parseCursor(first.next);
  assert.equal(cursor.ai, null);
  const last = first.history[first.history.length - 1];
  assert.equal(cursor.practice, last.balanceAfter - last.delta);
  const rest = rows.filter((r) => tsKey(r.created_at) < tsKey(cursor.at) || (tsKey(r.created_at) === tsKey(cursor.at) && r.id < cursor.id));
  const second = buildHistory({ practiceRows: rest, aiRows: [], total: 400, cursor });
  assert.equal(second.history[0].balanceAfter, cursor.practice);
});

test('one balance: the body adds total (free left, allowance, held, renew date) and keeps the two stored parts', () => {
  const unified = { known: true, total: 49, freeLeft: 9, freeAllowance: 50, held: 40, resetAt: '2026-10-31T18:30:00.000Z' };
  const body = creditsBody({ practiceBalance: 40, wallet: { ...WALLET, balanceCredits: 40, total: 49 }, paid: false, premiumUntil: null, history: [], next: null, unified });
  assert.deepEqual(body.total, { balance: 49, freeLeft: 9, freeAllowance: 50, held: 40, renewsOn: '2026-11-01', label: 'Credits' });
  assert.equal(body.practice.balance + body.ai.balance, body.total.balance, 'the two parts add up to the one total, never counted twice');
  assert.deepEqual(oneBalanceBlock({ known: false }), { balance: null, freeLeft: null, freeAllowance: null, held: null, renewsOn: null, label: 'Credits' });
});

test('one balance: the route reads getUnifiedWallet and passes the total and the month start to the history', () => {
  const src = read('src/app/api/me/credits/route.js');
  assert.match(src, /getUnifiedWallet\(user\)/);
  assert.match(src, /total: unified\.known \? unified\.total : null/);
  assert.match(src, /periodStart: wallet\?\.known \? wallet\.periodStart : null/);
});
