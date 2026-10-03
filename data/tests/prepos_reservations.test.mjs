import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { walletWindow } from '../../src/services/credits/aiWalletState.js';

const NOW = new Date('2026-10-15T06:00:00Z');
const W = walletWindow(NOW);

async function db() {
  const d = new PGlite();
  await d.exec('create role anon;create role authenticated;create role service_role;create table public.users(id text primary key);');
  await d.exec(readFileSync(new URL('../../db/migrations/2026_05_02_ai_overlay_credits_fix.sql', import.meta.url), 'utf8'));
  await d.exec(readFileSync(new URL('../../supabase/migrations/20261002130000_prepos_credit_reservations.sql', import.meta.url), 'utf8'));
  await d.exec("insert into public.users values('u1'),('u2')");
  return d;
}
const call = (d, sql, params) => d.query(sql, params).then((r) => r.rows[0].r);
const reserve = (d, user, amount, key, allowance = 10, w = W) => call(d, 'select public.mm_ai_reserve_credits($1,$2,$3,$4,$5,$6,$7,$8) as r', [user, amount, 'mentor_chat', key, allowance, w.periodStart, w.resetAt, {}]);
const exec = (d, key) => call(d, 'select public.mm_ai_mark_executing($1,$2) as r', [key, 'provider:abc']);
const commit = (d, key) => call(d, 'select public.mm_ai_commit_credits($1,$2) as r', [key, { provider: 'fixture', usd: 0.0004 }]);
const release = (d, key, reason = 'unusable_output') => call(d, 'select public.mm_ai_release_credits($1,$2) as r', [key, reason]);
const wallet = async (d, user) => (await d.query('select included_credits_used u, bonus_credits b, period_start from public.ai_credit_wallets where user_id=$1', [user])).rows[0];
const grant = (d, user, n) => call(d, 'select public.mm_ai_grant_bonus_credits($1,$2,$3,$4,$5,$6) as r', [user, n, 'pack_purchase', 'order_x', `grant:${user}:${n}`, {}]);

test('reserve takes credits atomically; the same key retried never takes them twice', async () => {
  const d = await db();
  try {
    const first = await reserve(d, 'u1', 1, 'op:chat:0001');
    assert.equal(first.ok, true);
    assert.equal(first.balance, 9);
    const retry = await reserve(d, 'u1', 1, 'op:chat:0001');
    assert.equal(retry.idempotent, true);
    assert.equal((await wallet(d, 'u1')).u, 1, 'charged once');
    assert.equal((await d.query("select count(*)::int n from ai_credit_ledger where user_id='u1'")).rows[0].n, 1);
  } finally { await d.close(); }
});

test('two requests that together exceed the balance cannot both succeed', async () => {
  const d = await db();
  try {
    // PGlite serialises on one connection: this proves the arithmetic, not lock contention.
    const results = await Promise.all([reserve(d, 'u1', 6, 'op:big:000001'), reserve(d, 'u1', 6, 'op:big:000002')]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.find((r) => !r.ok).error, 'insufficient_ai_credits');
    assert.equal((await wallet(d, 'u1')).u, 6);
  } finally { await d.close(); }
});

test('release restores exactly what was taken, included first then bonus, and is idempotent', async () => {
  const d = await db();
  try {
    await grant(d, 'u1', 5); // 10 included + 5 bonus
    const r = await reserve(d, 'u1', 12, 'op:mixed:00001');
    assert.equal(r.includedSpent, 10);
    assert.equal(r.bonusSpent, 2);
    assert.deepEqual(await wallet(d, 'u1').then(({ u, b }) => ({ u, b })), { u: 10, b: 3 });
    const rel = await release(d, 'op:mixed:00001');
    assert.equal(rel.ok, true);
    assert.equal(rel.balance, 15);
    assert.deepEqual(await wallet(d, 'u1').then(({ u, b }) => ({ u, b })), { u: 0, b: 5 });
    assert.equal((await release(d, 'op:mixed:00001')).idempotent, true, 'a second release changes nothing');
    assert.equal((await wallet(d, 'u1')).b, 5);
  } finally { await d.close(); }
});

test('a released key cannot be reused to charge again; a new key can', async () => {
  const d = await db();
  try {
    await reserve(d, 'u1', 1, 'op:retry:0001');
    await release(d, 'op:retry:0001');
    const again = await reserve(d, 'u1', 1, 'op:retry:0001');
    assert.equal(again.ok, false);
    assert.equal(again.error, 'operation_released');
    assert.equal((await reserve(d, 'u1', 1, 'op:retry:0002')).ok, true);
  } finally { await d.close(); }
});

test('commit is final: no release after commit, no commit after release, double commit is idempotent', async () => {
  const d = await db();
  try {
    await reserve(d, 'u1', 1, 'op:final:00001');
    assert.equal((await exec(d, 'op:final:00001')).state, 'executing');
    assert.equal((await commit(d, 'op:final:00001')).state, 'committed');
    assert.equal((await commit(d, 'op:final:00001')).idempotent, true);
    const late = await release(d, 'op:final:00001');
    assert.equal(late.ok, false);
    assert.equal(late.error, 'already_committed');
    assert.equal((await wallet(d, 'u1')).u, 1, 'the charge stands');

    await reserve(d, 'u1', 1, 'op:final:00002');
    await release(d, 'op:final:00002');
    assert.equal((await commit(d, 'op:final:00002')).error, 'already_released');
    assert.equal((await exec(d, 'op:final:00002')).ok, false);
  } finally { await d.close(); }
});

test('a release after the monthly reset hands expired included credits back as bonus', async () => {
  const d = await db();
  try {
    await reserve(d, 'u1', 3, 'op:roll:000001');
    const next = walletWindow(new Date('2026-11-15T06:00:00Z'));
    await reserve(d, 'u1', 1, 'op:roll:000002', 10, next); // rolls the wallet into November
    assert.equal((await wallet(d, 'u1')).u, 1);
    await release(d, 'op:roll:000001');
    const after = await wallet(d, 'u1');
    assert.equal(after.u, 1, 'November usage untouched');
    assert.equal(after.b, 3, 'the failed October reply is not lost to the student');
  } finally { await d.close(); }
});

test('expired reservations are swept back to the student; open ones are left alone', async () => {
  const d = await db();
  try {
    await reserve(d, 'u1', 2, 'op:old:0000001');
    await reserve(d, 'u2', 2, 'op:new:0000001');
    await d.query("update public.ai_credit_reservations set expires_at = now() - interval '1 minute' where operation_key = 'op:old:0000001'");
    const swept = (await d.query('select public.mm_ai_release_expired(50) as n')).rows[0].n;
    assert.equal(swept, 1);
    assert.equal((await wallet(d, 'u1')).u, 0);
    assert.equal((await wallet(d, 'u2')).u, 2);
  } finally { await d.close(); }
});

test('the ledger always explains the balance, and a committed reply leaves one debit', async () => {
  const d = await db();
  try {
    await reserve(d, 'u1', 1, 'op:ledger:00001'); await commit(d, 'op:ledger:00001');
    await reserve(d, 'u1', 1, 'op:ledger:00002'); await release(d, 'op:ledger:00002');
    const rows = (await d.query("select reason, amount from ai_credit_ledger where user_id='u1' order by created_at, id")).rows;
    assert.equal(rows.reduce((s, r) => s + r.amount, 0), -1, 'one committed credit, one returned');
    const { rows: [w] } = await d.query("select included_credits_used u from ai_credit_wallets where user_id='u1'");
    assert.equal(10 - w.u, 9);
  } finally { await d.close(); }
});

test('the lifecycle is service-role only', async () => {
  const d = await db();
  try {
    await d.exec('set role authenticated');
    await assert.rejects(reserve(d, 'u1', 1, 'op:client:00001'), /permission denied/);
  } finally { await d.close(); }
});
