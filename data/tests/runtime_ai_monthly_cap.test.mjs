// The three AI migrations exactly as applied to production on 4 Oct 2026, on production-shaped wallet tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('monthly cap, no global pause on missing usage, ledger reasons and wallet lifecycle', async () => {
  const db = new PGlite(); const q = (s, p) => db.query(s, p).then(r => r.rows);
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table public.users(id text primary key);
      create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int, included_credits_used int check(included_credits_used>=0), bonus_credits int check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
      create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text check (reason = any(array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry'])), feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text check (wallet_source = any(array['included','bonus','mixed','grant','adjustment','none'])), balance_after int, idempotency_key text);
      insert into public.users values('u1');`);
    for (const f of ['20261002121000_runtime_ai_guard.sql', '20261002130000_prepos_credit_reservations.sql', '20261004120000_runtime_ai_monthly_cap.sql'])
      await db.exec(readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8'));
    assert.equal(Number((await q('select monthly_cap_usd from runtime_ai_budget'))[0].monthly_cap_usd), 25);
    const reserve = key => q('select reserve_runtime_ai($1,$2,$3,$4,$5) v', [key, 'anthropic', 'claude-haiku-4-5', 4000, 600]);
    assert.equal((await reserve('key_aaaaaaaaaaaa'))[0].v.dispatch, true);
    assert.equal((await reserve('key_aaaaaaaaaaaa'))[0].v.dispatch, false, 'a retried key never dispatches twice');
    await q('select receipt_runtime_ai($1,$2,$3)', ['key_aaaaaaaaaaaa', null, { lost: true }]);
    const b = (await q('select spent_usd, reserved_usd, paused from runtime_ai_budget'))[0];
    assert.equal(Number(b.spent_usd), 0.007, 'missing usage books the full reservation'); assert.equal(b.paused, false, 'and does not pause everyone');
    await q('update runtime_ai_budget set monthly_cap_usd=0.01');
    await assert.rejects(reserve('key_bbbbbbbbbbbb'), /budget exhausted/);
    await q("update runtime_ai_requests set created_at = runtime_ai_month_start() - interval '1 day'");
    assert.equal((await reserve('key_cccccccccccc'))[0].v.dispatch, true, 'last month does not count against this month');
    await q("update runtime_ai_prices set verified_at = now() - interval '91 days'");
    await assert.rejects(reserve('key_dddddddddddd'), /verified model price/);
    const ps = "'2026-09-30T18:30:00Z'::timestamptz", rs = "'2026-10-31T18:30:00Z'::timestamptz";
    assert.equal((await q(`select mm_ai_reserve_credits('u1',1,'score_recovery_repair','repair:abc:req1',10,${ps},${rs}) v`))[0].v.ok, true);
    assert.equal((await q(`select mm_ai_reserve_credits('u1',1,'score_recovery_repair','repair:abc:req1',10,${ps},${rs}) v`))[0].v.idempotent, true);
    assert.equal((await q("select mm_ai_commit_credits('repair:abc:req1','{\"repair\":{\"key_idea\":\"x\"}}') v"))[0].v.state, 'committed');
    assert.equal((await q("select receipt->'repair'->>'key_idea' k from ai_credit_reservations where operation_key like 'repair:abc:%' and state='committed'"))[0].k, 'x', 'a finished repair is stored for free reopening');
    assert.equal((await q(`select mm_ai_reserve_credits('u1',1,'prepos_mentor','op_key_000002',10,${ps},${rs}) v`))[0].v.ok, true);
    assert.equal((await q("select mm_ai_release_credits('op_key_000002','provider_failed') v"))[0].v.state, 'released');
    assert.equal((await q('select included_credits_used from ai_credit_wallets'))[0].included_credits_used, 1, 'released credit returned, committed one kept');
    assert.deepEqual((await q('select reason from ai_credit_ledger order by created_at')).map(r => r.reason), ['ai_reserve', 'ai_reserve', 'ai_release']);
    await db.exec('set role authenticated'); await assert.rejects(reserve('key_eeeeeeeeeeee'), /permission denied/);
  } finally { await db.close(); }
});
