// M4 (security audit 15 Nov 2026): the credit take-back for a refunded Razorpay pack, run in PGlite against the saved
// migration 20261115120000 (NOT applied on production) and its undo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const migration = file('supabase/migrations/20261115120000_razorpay_refund_credit_takeback.sql');
const undo = file('supabase/undo/20261115120000_razorpay_refund_credit_takeback.undo.sql');

// The production shapes and checks of the two tables (read-only pg_constraint / pg_indexes, 15 Nov 2026).
const FIXTURE = `
create role anon; create role authenticated; create role service_role bypassrls;
create table public.users (id text primary key, credit_balance int not null default 0);
create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade,
  included_monthly_credits int default 50, included_credits_used int default 0 check (included_credits_used >= 0),
  bonus_credits int default 0 check (bonus_credits >= 0), period_start timestamptz, reset_at timestamptz, metadata jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int,
  reason text check (reason = any (array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry','ai_reserve','ai_release'])),
  feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(),
  wallet_source text check (wallet_source = any (array['included','bonus','balance','mixed','grant','adjustment','none'])),
  balance_after int, idempotency_key text);
create unique index ai_credit_ledger_idempotency_idx on public.ai_credit_ledger (idempotency_key) where idempotency_key is not null;
insert into public.users (id) values ('u1'), ('u2'), ('u3');
insert into public.ai_credit_wallets (user_id, included_credits_used, bonus_credits) values ('u1', 10, 150), ('u2', 0, 30);
`;

async function setup() {
  const d = new PGlite();
  await d.exec(FIXTURE);
  await d.exec(migration);
  await d.exec(migration); // create or replace: safe to run twice
  return d;
}
const call = async (d, user, credits, key) => (await d.query(
  'select public.mm_ai_take_back_refunded_credits($1, $2, $3, $4, $5::jsonb) r', [user, credits, 'order_1', key, JSON.stringify({ paymentId: 'pay_1' })],
)).rows[0].r;
const bonus = async (d, user) => (await d.query('select bonus_credits b from public.ai_credit_wallets where user_id = $1', [user])).rows[0]?.b;

test('takes back the pack\'s credits while they are unspent, once', async () => {
  const d = await setup();
  try {
    const first = await call(d, 'u1', 100, 'razorpay_refund:pay_1');
    assert.deepEqual([first.ok, first.clawedBack, first.shortfall, first.idempotent], [true, 100, 0, false]);
    assert.equal(await bonus(d, 'u1'), 50);
    assert.equal(first.balance, 40 + 50, 'free credits left this month plus bought credits');
    const again = await call(d, 'u1', 100, 'razorpay_refund:pay_1');
    assert.deepEqual([again.ok, again.idempotent, again.clawedBack], [true, true, 100]);
    assert.equal(await bonus(d, 'u1'), 50, 'a retry takes nothing more');
    const ledger = (await d.query("select amount, reason, feature, wallet_source, metadata from public.ai_credit_ledger where user_id = 'u1'")).rows;
    assert.equal(ledger.length, 1);
    assert.deepEqual([ledger[0].amount, ledger[0].reason, ledger[0].feature, ledger[0].wallet_source], [-100, 'admin_adjustment', 'razorpay_refund', 'bonus']);
    assert.equal(ledger[0].metadata.paymentId, 'pay_1');
  } finally { await d.close(); }
});

test('never goes below zero and records the shortfall; with nothing left it still records, so a retry never takes later credits', async () => {
  const d = await setup();
  try {
    const partial = await call(d, 'u2', 100, 'razorpay_refund:pay_2');
    assert.deepEqual([partial.clawedBack, partial.shortfall], [30, 70]);
    assert.equal(await bonus(d, 'u2'), 0);
    const meta = (await d.query("select metadata from public.ai_credit_ledger where idempotency_key = 'razorpay_refund:pay_2'")).rows[0].metadata;
    assert.equal(meta.shortfall, 70);

    // No wallet at all: nothing to take, the whole pack is the shortfall, and the key is used up.
    const none = await call(d, 'u3', 100, 'razorpay_refund:pay_3');
    assert.deepEqual([none.ok, none.clawedBack, none.shortfall], [true, 0, 100]);
    await d.query("insert into public.ai_credit_wallets (user_id, bonus_credits) values ('u3', 500)");
    const retry = await call(d, 'u3', 100, 'razorpay_refund:pay_3');
    assert.equal(retry.idempotent, true);
    assert.equal(await bonus(d, 'u3'), 500, 'credits bought after the refund are not touched');
    assert.equal((await d.query('select count(*)::int n from public.ai_credit_wallets where bonus_credits < 0')).rows[0].n, 0);
  } finally { await d.close(); }
});

test('refuses bad input and unknown users; only the service role may call it; the undo removes it', async () => {
  const d = await setup();
  try {
    assert.equal((await call(d, '', 100, 'k1')).error, 'missing_field');
    assert.equal((await call(d, 'u1', 0, 'k2')).error, 'invalid_amount');
    assert.equal((await call(d, 'nobody', 100, 'k3')).error, 'user_not_found');
    const grants = (await d.query(`select r.rolname, has_function_privilege(r.rolname, 'public.mm_ai_take_back_refunded_credits(text,integer,text,text,jsonb)', 'execute') ok
      from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1`)).rows;
    assert.deepEqual(grants, [{ rolname: 'anon', ok: false }, { rolname: 'authenticated', ok: false }, { rolname: 'service_role', ok: true }]);
    await d.exec(undo);
    assert.equal((await d.query("select count(*)::int n from pg_proc where proname = 'mm_ai_take_back_refunded_credits'")).rows[0].n, 0);
  } finally { await d.close(); }
});
