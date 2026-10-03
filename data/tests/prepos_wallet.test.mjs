import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  isPaidUser, projectWallet, unreadableWallet, walletFromResponse, walletWindow, isMissingFunction, PREPOS_PAUSED_MESSAGE,
} from '../../src/services/credits/aiWalletState.js';
import { CAPABILITIES } from '../capabilities.js';

const NOW = new Date('2026-10-15T06:00:00Z');
const row = (over = {}) => ({ included_monthly_credits: 50, included_credits_used: 12, bonus_credits: 30, period_start: walletWindow(NOW).periodStart, reset_at: walletWindow(NOW).resetAt, ...over });

test('expired and legacy entitlements follow the central effective-premium rule', () => {
  const t = Date.parse('2026-10-15T00:00:00Z');
  assert.equal(isPaidUser({ subscriptionStatus: 'free', isPremium: true, premiumUntil: '2026-07-31T00:00:00Z' }, t), false, 'expired paid-through');
  assert.equal(isPaidUser({ subscriptionStatus: 'free', isPremium: true, premiumUntil: '2027-07-31T18:29:59Z' }, t), true);
  assert.equal(isPaidUser({ subscriptionStatus: 'free', isPremium: true, premiumUntil: null }, t), true, 'legacy premium without expiry is preserved');
  assert.equal(isPaidUser({ subscriptionStatus: 'active' }, t), true);
  assert.equal(isPaidUser(null, t), false);
});

test('missing schema and read errors never produce a balance', () => {
  for (const state of ['schema_unavailable', 'error']) {
    const w = unreadableWallet(state, { paid: true });
    assert.equal(w.known, false);
    assert.equal(w.spendable, false);
    assert.equal(w.total, null);
    assert.equal(w.includedRemaining, null);
    assert.notEqual(w.total, 0, 'unknown is not a spendable zero');
    assert.match(w.message, /Nothing has been charged/);
  }
});

test('paused paid AI shows real stored balances but nothing is spendable', () => {
  // 4 Oct 2026: model replies opened by the owner; AI purchases (top-ups) stay closed.
  assert.equal(CAPABILITIES.optionalAi.state, 'available');
  assert.notEqual(CAPABILITIES.aiTopUps.state, 'available', 'top-up checkout stays paused');
  const w = projectWallet(row(), { paid: true, includedMonthlyCredits: 50, paidAiOpen: false, now: NOW });
  assert.equal(w.state, 'paused');
  assert.equal(w.spendable, false);
  assert.equal(w.total, 68);
  assert.equal(w.bonusCredits, 30);
  assert.equal(w.message, PREPOS_PAUSED_MESSAGE);
});

test('a stale stored period is projected as reset without writing; no row is not materialised', () => {
  const stale = projectWallet(row({ period_start: '2026-08-31T18:30:00.000Z', included_credits_used: 50 }), { paid: true, includedMonthlyCredits: 50, paidAiOpen: true, now: NOW });
  assert.equal(stale.includedUsed, 0);
  assert.equal(stale.includedRemaining, 50);
  assert.equal(stale.periodStart, walletWindow(NOW).periodStart);
  const none = projectWallet(null, { paid: false, includedMonthlyCredits: 10, paidAiOpen: true, now: NOW });
  assert.equal(none.materialized, false);
  assert.equal(none.total, 10);
  const empty = projectWallet(row({ included_credits_used: 50, bonus_credits: 0 }), { paid: true, includedMonthlyCredits: 50, paidAiOpen: true, now: NOW });
  assert.equal(empty.state, 'empty');
  assert.equal(empty.total, 0);
});

test('client mapping turns failed or malformed responses into unknown, never zero (account switch/stale cache safe)', () => {
  assert.equal(walletFromResponse(null, { ok: false }).known, false);
  assert.equal(walletFromResponse({ wallet: { total: 50 } }).known, false, 'legacy shape without state is not trusted');
  assert.equal(walletFromResponse({ wallet: unreadableWallet('schema_unavailable') }).total, null);
  const good = projectWallet(row(), { paid: true, includedMonthlyCredits: 50, paidAiOpen: false, now: NOW });
  assert.equal(walletFromResponse({ wallet: good }).total, 68);
});

test('missing-function detection is narrow enough not to swallow real RPC errors', () => {
  assert.equal(isMissingFunction({ code: '42883', message: 'function mm_ai_consume_credits does not exist' }), true);
  assert.equal(isMissingFunction({ code: 'PGRST202', message: 'Could not find the function' }), true);
  assert.equal(isMissingFunction({ code: 'P0001', message: 'insufficient funds in function body' }), false);
});

test('wallet service has no direct read-modify-write path and fails closed while paused', () => {
  const src = readFileSync(new URL('../../src/services/credits/aiCreditWallet.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /consumeDirectly|grantDirectly/);
  assert.doesNotMatch(src, /from\('ai_credit_wallets'\)[\s\S]{0,200}\.(insert|update|upsert)\(/, 'the wallet read never writes');
  assert.ok(src.indexOf("if (!paidAiOpen()) return { ok: false, error: 'prepos_paused'") < src.indexOf("rpc('mm_ai_consume_credits'"), 'pause check precedes the spend RPC');
  assert.match(src, /operation_key_required/);
  const allowance = readFileSync(new URL('../../src/services/credits/consumeAIAllowance.js', import.meta.url), 'utf8');
  assert.doesNotMatch(allowance, /Date\.now\(\)/, 'operation keys are caller-stable, not time-based');
});

async function walletDb() {
  const db = new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role;create table public.users(id text primary key);');
  await db.exec(readFileSync(new URL('../../db/migrations/2026_05_02_ai_overlay_credits_fix.sql', import.meta.url), 'utf8'));
  await db.exec("insert into public.users values('u1'),('u2')");
  return db;
}
const consume = (db, user, amount, key, w = walletWindow(NOW)) => db.query(
  'select public.mm_ai_consume_credits($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',
  [user, amount, 'mentor_chat', key, key, 10, w.periodStart, w.resetAt, {}],
).then((res) => res.rows[0].r);

test('atomic RPC: concurrent consumes cannot overspend; a retried key charges once', async () => {
  const db = await walletDb();
  try {
    // PGlite runs these on one connection, so they are serialised: this checks the
    // balance arithmetic and idempotency, not multi-session lock contention.
    const results = await Promise.all([consume(db, 'u1', 6, 'op:a1'), consume(db, 'u1', 6, 'op:a2')]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.find((r) => !r.ok).error, 'insufficient_ai_credits');
    const retry = await consume(db, 'u1', 6, 'op:a1');
    assert.equal(retry.ok, true);
    assert.equal(retry.idempotent, true);
    const { rows } = await db.query("select included_credits_used, bonus_credits from ai_credit_wallets where user_id='u1'");
    assert.equal(rows[0].included_credits_used, 6);
    assert.equal((await db.query("select count(*)::int n from ai_credit_ledger where user_id='u1'")).rows[0].n, 1);
  } finally { await db.close(); }
});

test('atomic RPC: a ledger insert failure rolls back the balance change', async () => {
  const db = await walletDb();
  try {
    await db.exec("create function fail_ledger() returns trigger language plpgsql as $$ begin raise exception 'ledger unavailable'; end $$; create trigger fail_ledger before insert on ai_credit_ledger for each row execute function fail_ledger();");
    await assert.rejects(consume(db, 'u2', 3, 'op:b1'), /ledger unavailable/);
    const { rows } = await db.query("select included_credits_used from ai_credit_wallets where user_id='u2'");
    assert.ok(rows.length === 0 || rows[0].included_credits_used === 0, 'no credits consumed without a ledger row');
  } finally { await db.close(); }
});

test('reconciliation flags a balance change whose ledger row is missing', async () => {
  const { reconcileWallets } = await import('../../scripts/learning/wallet-reconciliation.mjs');
  const period = '2026-09-30T18:30:00.000Z';
  const report = reconcileWallets(
    [
      { user_id: 'ok', included_credits_used: 3, bonus_credits: 48, period_start: period },
      // Old direct path: balance moved but the swallowed ledger insert never landed.
      { user_id: 'drift', included_credits_used: 5, bonus_credits: 50, period_start: period },
    ],
    [
      { user_id: 'ok', amount: 50, metadata: {}, created_at: '2026-09-01T00:00:00Z' },
      { user_id: 'ok', amount: -5, metadata: { includedSpent: 3, bonusSpent: 2 }, created_at: '2026-10-02T00:00:00Z' },
      { user_id: 'drift', amount: 50, metadata: {}, created_at: '2026-09-01T00:00:00Z' },
      { user_id: 'orphan', amount: 50, metadata: {}, created_at: '2026-09-01T00:00:00Z' },
    ],
  );
  const by = Object.fromEntries(report.rows.map((r) => [r.userId, r]));
  assert.equal(by.ok.status, 'ok');
  assert.equal(by.drift.status, 'mismatch');
  assert.equal(by.drift.includedDelta, 5);
  assert.equal(by.orphan.status, 'ledger_without_wallet');
});

test('reconciliation treats a released reservation as a reversal, not a purchase', async () => {
  const { reconcileWallets } = await import('../../scripts/learning/wallet-reconciliation.mjs');
  const period = '2026-09-30T18:30:00.000Z';
  const report = reconcileWallets(
    [{ user_id: 'r1', included_credits_used: 0, bonus_credits: 50, period_start: period }],
    [
      { user_id: 'r1', amount: 50, metadata: {}, created_at: '2026-09-01T00:00:00Z' },
      { user_id: 'r1', amount: -1, metadata: { kind: 'reserve', includedSpent: 1, bonusSpent: 0 }, created_at: '2026-10-02T00:00:00Z' },
      { user_id: 'r1', amount: 1, metadata: { kind: 'release', includedRestored: 1, bonusRestored: 0 }, created_at: '2026-10-02T00:01:00Z' },
    ],
  );
  assert.equal(report.rows[0].status, 'ok');
  assert.equal(report.rows[0].expectedBonus, 50);
});

test('atomic grant RPC is idempotent for a captured payment key', async () => {
  const db = await walletDb();
  try {
    const grant = () => db.query('select public.mm_ai_grant_bonus_credits($1,$2,$3,$4,$5,$6) as r', ['u1', 50, 'pack_purchase', 'order_1', 'ai_topup:order_1:pay_1', {}]).then((r) => r.rows[0].r);
    const first = await grant();
    const second = await grant();
    assert.equal(first.ok, true);
    assert.equal(second.idempotent, true);
    assert.equal((await db.query("select bonus_credits from ai_credit_wallets where user_id='u1'")).rows[0].bonus_credits, 50);
  } finally { await db.close(); }
});
