// Free monthly AI cap Rs 2.50 -> Rs 3.50 (owner, 16 Nov 2026): supabase/migrations/20261117090000_free_ai_cap_350.sql and its
// undo, the code and words that mirror the cap. The migration runs against an in-process Postgres (PGlite) built from the repo's
// own runtime-guard migrations. No network, no paid model, nothing applied anywhere else.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MIGRATION = file('supabase/migrations/20261117090000_free_ai_cap_350.sql');
const UNDO = file('supabase/undo/20261117090000_free_ai_cap_350.undo.sql');
const FORWARD = "update public.runtime_ai_budget set monthly_cap_usd = 0.0398 where id = 'student_user_free';";
const BACK = "update public.runtime_ai_budget set monthly_cap_usd = 0.0284 where id = 'student_user_free';";
/** The SQL with its comment lines gone, one statement a line. */
const statements = (sql) => sql.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).join('\n').trim();

test('the migration is one statement on the Free row, and the undo is its mirror; nothing else is written', () => {
  assert.equal(statements(MIGRATION), FORWARD);
  assert.equal(statements(UNDO), BACK);
  for (const sql of [MIGRATION, UNDO]) {
    assert.doesNotMatch(statements(sql), /student_user_paid|student_ai'|insert|delete|create|drop|alter|grant|function/i);
  }
  // Rs 3.50 at the Rs 88 the cap rows use, to four places, as the Rs 2.50 row was (2.50 / 88 = 0.0284).
  assert.equal(Math.round((3.5 / 88) * 10000) / 10000, 0.0398);
  assert.equal(Math.round((2.5 / 88) * 10000) / 10000, 0.0284);
  // The head says who decided, that the owner runs it (not a deploy), and where the undo is.
  assert.match(MIGRATION, /owner, 16 Nov 2026/);
  assert.match(MIGRATION, /NOT applied by this branch and NOT applied by a deploy: the owner runs it/);
  assert.match(MIGRATION, /Rollback: supabase\/undo\/20261117090000_free_ai_cap_350\.undo\.sql/);
});

test('the code and the contract mirror it, and say the database row is the enforcer', () => {
  const wallet = file('src/services/credits/aiCreditWallet.js');
  assert.match(wallet, /export const AI_FREE_BUDGET_INR_CAP = 3\.5;/);
  assert.match(wallet, /USD 0\.0398 = Rs 3\.50/);
  assert.match(wallet, /row is the enforcer, per Free student per IST month/);
  assert.match(wallet, /20261117090000_free_ai_cap_350\.sql/);
  const agents = file('AGENTS.md');
  assert.match(agents, /Rs 5 for a paid student, Rs 3\.50 for a free one/);
  assert.doesNotMatch(agents, /Rs 2\.50 for a free one/);
  assert.match(file('src/app/api/ai/rival/submit/route.js'), /Rs 5 paid, Rs 3\.50 free once 20261117090000 is run/);
  // The price block reasons from the new cap.
  const prices = file('src/services/mobi/mistakePrices.mjs');
  assert.match(prices, /Free Rs 3\.50 \/ 50 = Rs 0\.07 \(USD 0\.000795\)/);
  assert.doesNotMatch(prices, /Free Rs 2\.50 \/ 50/);
});

// ---- the migration on a database built from the repo's runtime-guard migrations ------------------------------------------
async function database() {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table public.users(id text primary key);
    create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int default 50, included_credits_used int default 0 check(included_credits_used>=0), bonus_credits int default 0 check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text, feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text, balance_after int, idempotency_key text);`);
  for (const f of ['20261002121000_runtime_ai_guard.sql', '20261002130000_prepos_credit_reservations.sql', '20261004120000_runtime_ai_monthly_cap.sql', '20261017120000_runtime_ai_user_cap.sql', '20261018130000_free_ai_wallet_50.sql']) {
    await d.exec(file(`supabase/migrations/${f}`));
  }
  // Production's global row (the ceiling the owner removed) and a fresh price, as data/tests/free_ai_wallet_50.test.mjs does.
  await d.exec("update public.runtime_ai_budget set monthly_cap_usd = 1000000 where id = 'student_ai'");
  await d.exec("insert into public.runtime_ai_prices values ('openai','gpt-6-luna',0.1,0.5,'https://example.invalid/fixture',now()) on conflict (provider,model) do update set verified_at=now()");
  return d;
}
const q = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const table = async (d) => (await q(d, 'select * from public.runtime_ai_budget order by id')).map((r) => ({ ...r, monthly_cap_usd: Number(r.monthly_cap_usd) }));

test('run: only the Free row changes, 0.0284 -> 0.0398; the undo puts back exactly what was there', async () => {
  const d = await database();
  try {
    const before = await table(d);
    assert.equal(before.find((r) => r.id === 'student_user_free').monthly_cap_usd, 0.0284, 'production today');
    await d.exec(MIGRATION);
    const after = await table(d);
    assert.equal(after.find((r) => r.id === 'student_user_free').monthly_cap_usd, 0.0398);
    const others = (rows) => rows.filter((r) => r.id !== 'student_user_free');
    assert.deepEqual(others(after), others(before), 'every other row, every column, as it was');
    assert.deepEqual(Object.keys(after.find((r) => r.id === 'student_user_free')), Object.keys(before.find((r) => r.id === 'student_user_free')));
    await d.exec(MIGRATION); // run twice: the same result
    assert.deepEqual(await table(d), after);
    await d.exec(UNDO);
    assert.deepEqual(await table(d), before, 'the undo restores the table exactly');
  } finally { await d.close(); }
});

test('what the cap buys, through the real reserve_runtime_ai: a month of photo asks (25, at 2 of the 50 credits) fits Rs 3.50, not Rs 2.50', async () => {
  // A photo ask reserves its worst case (13,552 input and 2,600 output tokens: data/tests/bring_mistake_1116.test.mjs) and settles
  // at the high end of the receipts' estimate, Rs 0.11 = USD 0.00125. Count the asks a Free student gets before the cap stops one.
  const asks = async (d, user) => {
    let n = 0;
    for (let i = 1; i <= 60; i += 1) {
      try {
        await q(d, "select reserve_runtime_ai($1,'openai','gpt-6-luna',13552,2600,$2,'free')", [`${user}_${i}`, user]);
        await q(d, 'select receipt_runtime_ai($1,$2,$3)', [`${user}_${i}`, 0.00125, {}]);
        n += 1;
      } catch { break; }
    }
    return n;
  };
  const d = await database();
  try {
    const old = await asks(d, 'u_old');
    assert.ok(old < 25, `Rs 2.50 stopped a Free student after ${old} photo asks`);
    await d.exec(MIGRATION);
    const now = await asks(d, 'u_new');
    assert.ok(now >= 25, `Rs 3.50 carries ${now} photo asks: the 50 credits, not the cap, end the month`);
    // Written replies at the receipts' average (USD 0.00047, reserving about 0.00155): 50 fit easily.
    let replies = 0;
    for (let i = 1; i <= 60; i += 1) {
      try { await q(d, "select reserve_runtime_ai($1,'openai','gpt-6-luna',8000,1500,'u_reply','free')", [`r_${i}`]); await q(d, 'select receipt_runtime_ai($1,$2,$3)', [`r_${i}`, 0.00047, {}]); replies += 1; } catch { break; }
    }
    assert.ok(replies >= 50, `50 replies at the average receipt: stopped after ${replies}`);
  } finally { await d.close(); }
});
