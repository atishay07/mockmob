// Free AI wallet 10 -> 50 a month (owner, 18 Oct 2026). Code constants, copy, and the database migration
// supabase/migrations/20261018130000_free_ai_wallet_50.sql run against an in-process Postgres. No network, no paid model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { walletWindow, projectWallet } from '../../src/services/credits/aiWalletState.js';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const MIGRATION = file('supabase/migrations/20261018130000_free_ai_wallet_50.sql');
const UNDO = file('supabase/undo/20261018130000_free_ai_wallet_50.undo.sql');
const W = walletWindow(new Date('2026-10-18T06:00:00Z'));

// ---- the constants and the words ----------------------------------------------------------------------------------
test('the Free monthly allowance is 50, Pro still 50, and the Free spending cap mirrors the database row', () => {
  const src = file('src/services/credits/aiCreditWallet.js');
  assert.match(src, /export const AI_FREE_MONTHLY_CREDITS = 50;/);
  assert.match(src, /export const AI_PRO_INCLUDED_MONTHLY_CREDITS = 50;/);
  assert.match(src, /export const AI_FREE_BUDGET_INR_CAP = 2\.5;/);
  assert.ok(MIGRATION.includes("monthly_cap_usd = 0.0284 where id = 'student_user_free'"), 'Rs 2.50 at Rs 88 is USD 0.0284');
  assert.ok(UNDO.includes("monthly_cap_usd = 0.0114 where id = 'student_user_free'"), 'the undo restores the Rs 1 cap');
});

test('no page still says Free gets 10 AI credits a month, and the pages that name the number say 50', () => {
  for (const rel of ['src/app/pricing/page.js', 'src/app/features/page.js', 'src/app/page.js', 'src/app/pricing/ai-credits/page.js']) {
    const s = file(rel);
    assert.doesNotMatch(s, /\b10 a month\b|10 on Free|10 AI credits|: 10 a month/, `${rel} still states 10`);
  }
  assert.match(file('src/app/pricing/page.js'), /AI credits', '50 a month for written replies from Ask Mobi'/);
  assert.match(file('src/app/pricing/page.js'), /AI credits: 50 a month on Free, kept apart from practice credits/);
  assert.match(file('src/app/features/page.js'), /50 a month on Free and on Pro/);
  assert.match(file('src/app/page.js'), /AI replies use monthly credits: 50 on Free, 50 on Pro/);
  assert.match(file('src/components/ai/askSuggestions.mjs'), /includedMonthlyCredits \?\? 50\}/);
});

test('a Free wallet is projected from the 50 allowance: a student who used 4 of the old 10 sees 46', () => {
  const row = { included_monthly_credits: 10, included_credits_used: 4, bonus_credits: 0, period_start: W.periodStart, reset_at: W.resetAt };
  const view = projectWallet(row, { paid: false, includedMonthlyCredits: 50, paidAiOpen: true, now: new Date('2026-10-18T06:00:00Z') });
  assert.equal(view.includedMonthlyCredits, 50);
  assert.equal(view.includedRemaining, 46);
  assert.equal(view.total, 46);
  const fresh = projectWallet(null, { paid: false, includedMonthlyCredits: 50, paidAiOpen: true, now: new Date('2026-10-18T06:00:00Z') });
  assert.equal(fresh.total, 50);
});

// ---- the migration on production-shaped tables --------------------------------------------------------------------
async function database() {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table public.users(id text primary key);
    create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int default 50, included_credits_used int default 0 check(included_credits_used>=0), bonus_credits int default 0 check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text, feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text, balance_after int, idempotency_key text);`);
  for (const f of ['20261002121000_runtime_ai_guard.sql', '20261002130000_prepos_credit_reservations.sql', '20261004120000_runtime_ai_monthly_cap.sql', '20261017120000_runtime_ai_user_cap.sql'])
    await d.exec(file(`supabase/migrations/${f}`));
  // Production's state before this change: the undo file holds production's two function bodies exactly as read on 18 Oct 2026.
  await d.exec(UNDO);
  await d.exec("insert into public.users values('old'),('new'),('stale'),('nullallow')");
  return d;
}
const q = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const consume = (d, user, key, allowance = 50, w = W, amount = 1) =>
  q(d, 'select public.mm_ai_consume_credits($1,$2,$3,$4,$5,$6,$7,$8,$9) r', [user, amount, 'mentor_chat', 'ref', key, allowance, w.periodStart, w.resetAt, {}]).then((r) => r[0].r);

test('before the migration: a stored 10 with 4 used still enforces 10 even when the server sends 50 (the bug this fixes)', async () => {
  const d = await database();
  try {
    await d.query("insert into public.ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values ('old',10,4,0,$1,$2)", [W.periodStart, W.resetAt]);
    const r = await consume(d, 'old', 'before:key:000001');
    assert.equal(r.includedRemaining, 5, '10 - 4 - 1: the old function never followed the server allowance');
  } finally { await d.close(); }
});

test('after the migration: consume follows the 50 allowance and keeps what was used; 50 spends work and the 51st is refused', async () => {
  const d = await database();
  try {
    await d.exec(MIGRATION);
    await d.query("insert into public.ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values ('old',10,4,0,$1,$2)", [W.periodStart, W.resetAt]);
    const r = await consume(d, 'old', 'after:key:000001');
    assert.equal(r.ok, true);
    assert.equal(r.includedRemaining, 45, '50 - 4 used - 1');
    const row = (await q(d, "select included_monthly_credits a, included_credits_used u from public.ai_credit_wallets where user_id='old'"))[0];
    assert.deepEqual(row, { a: 50, u: 5 });

    let ok = 0; let last;
    for (let i = 1; i <= 51; i += 1) { last = await consume(d, 'new', `fresh:key:${String(i).padStart(6, '0')}`); if (last.ok) ok += 1; }
    assert.equal(ok, 50);
    assert.equal(last.error, 'insufficient_ai_credits');

    // The new month still resets cleanly, and purchased (bonus) credits are untouched by the sync.
    await d.query("insert into public.ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values ('stale',10,9,5,'2026-08-31T18:30:00Z','2026-09-30T18:30:00Z')");
    const s = await consume(d, 'stale', 'stale:key:000001');
    assert.deepEqual([s.includedRemaining, s.bonusCredits], [49, 5]);
    await d.query("update public.ai_credit_wallets set included_monthly_credits=10, included_credits_used=10, bonus_credits=7 where user_id='old'");
    const b = await consume(d, 'old', 'bonus:key:000001', 50, W, 3);
    assert.equal(b.bonusCredits, 7, 'bonus credits are not spent while included credits remain after the sync (50 - 10)');
    assert.equal(b.includedSpent, 3);
  } finally { await d.close(); }
});

test('the reserve path falls back to 50 when no allowance is sent, and syncs a stored 10 up to 50', async () => {
  const d = await database();
  try {
    await d.exec(MIGRATION);
    const r = (await q(d, 'select public.mm_ai_reserve_credits($1,$2,$3,$4,$5,$6,$7,$8) r', ['nullallow', 1, 'repair', 'op:null:000001', null, W.periodStart, W.resetAt, {}]))[0].r;
    assert.equal(r.balance, 49);
    assert.equal((await q(d, "select included_monthly_credits a from public.ai_credit_wallets where user_id='nullallow'"))[0].a, 50);
    await d.query("insert into public.ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values ('old',10,3,0,$1,$2)", [W.periodStart, W.resetAt]);
    const s = (await q(d, 'select public.mm_ai_reserve_credits($1,$2,$3,$4,$5,$6,$7,$8) r', ['old', 1, 'repair', 'op:old:000001', 50, W.periodStart, W.resetAt, {}]))[0].r;
    assert.equal(s.balance, 46, '50 - 3 - 1');
  } finally { await d.close(); }
});

test('the Free per-user cap lets a typical student reach 50 replies (and the old Rs 1 cap did not); Pro and the global row are untouched', async () => {
  const d = await database();
  const cap = async () => Object.fromEntries((await q(d, 'select id, monthly_cap_usd c from public.runtime_ai_budget')).map((r) => [r.id, Number(r.c)]));
  try {
    await d.exec("insert into public.runtime_ai_prices values ('openai','gpt-6-luna',0.1,0.5,'https://example.invalid/fixture',now()) on conflict (provider,model) do update set verified_at=now()");
    const before = await cap();
    assert.equal(before.student_user_free, 0.0114);
    // A reply reserves about USD 0.00155 and settles at about 0.00029 (production, 18 Oct 2026). Count replies until the cap stops one.
    const replies = async (user) => {
      let n = 0;
      for (let i = 1; i <= 90; i += 1) {
        try {
          await q(d, "select reserve_runtime_ai($1,'openai','gpt-6-luna',8000,1500,$2,'free')", [`${user}_${i}`, user]);
          await q(d, 'select receipt_runtime_ai($1,$2,$3)', [`${user}_${i}`, 0.00029, {}]);
          n += 1;
        } catch { break; }
      }
      return n;
    };
    const oldCapReplies = await replies('u_old');
    assert.ok(oldCapReplies >= 30 && oldCapReplies < 40, `the Rs 1 cap stopped a free student after ${oldCapReplies} replies, before 50`);
    await d.exec(MIGRATION);
    const after = await cap();
    assert.equal(after.student_user_free, 0.0284);
    assert.equal(after.student_user_paid, before.student_user_paid, 'Pro cap unchanged');
    assert.equal(after.student_ai, before.student_ai, 'the global row is unchanged');
    assert.ok(await replies('u_new') >= 50, 'the new cap carries 50 typical replies');
    // At the highest reply cost seen (USD 0.000479) 50 replies still fit.
    let n = 0;
    for (let i = 1; i <= 90; i += 1) {
      try { await q(d, "select reserve_runtime_ai($1,'openai','gpt-6-luna',8000,1500,'u_max','free')", [`max_${i}`]); await q(d, 'select receipt_runtime_ai($1,$2,$3)', [`max_${i}`, 0.000479, {}]); n += 1; } catch { break; }
    }
    assert.ok(n >= 50, `50 replies at the highest cost seen: stopped after ${n}`);
  } finally { await d.close(); }
});

test('the undo puts production back: the two functions read as before and the cap returns to Rs 1', async () => {
  const d = await database();
  try {
    const hash = async () => (await q(d, "select md5(pg_get_functiondef(p.oid)) h, proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('mm_ai_consume_credits','mm_ai_reserve_credits') order by proname"));
    const before = await hash();
    await d.exec(MIGRATION);
    assert.notDeepEqual(await hash(), before);
    await d.exec(UNDO);
    assert.deepEqual(await hash(), before);
    assert.equal(Number((await q(d, "select monthly_cap_usd c from public.runtime_ai_budget where id='student_user_free'"))[0].c), 0.0114);
  } finally { await d.close(); }
});
