// L2 / M-010 (production pass, 15 Nov 2026): a database rebuilt from the repository must not bring back the USD 25 global
// monthly AI ceiling the owner removed on 17 Oct 2026. 20261115120000_runtime_ai_global_cap_removed.sql raises the seed to
// production's 1000000; on production (already 1000000) it and its undo change nothing.
//   node --test data/tests/runtime_ai_global_cap_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (rel) => readFileSync(new URL(`../../supabase/${rel}`, import.meta.url), 'utf8');
const FORWARD = sql('migrations/20261115120000_runtime_ai_global_cap_removed.sql');
const UNDO = sql('undo/20261115120000_runtime_ai_global_cap_removed.undo.sql');

// The AI migrations as a rebuilt database applies them, on production-shaped wallet tables (as runtime_ai_monthly_cap.test.mjs).
async function rebuilt() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table public.users(id text primary key);
    create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int, included_credits_used int check(included_credits_used>=0), bonus_credits int check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text check (reason = any(array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry'])), feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text check (wallet_source = any(array['included','bonus','mixed','grant','adjustment','none'])), balance_after int, idempotency_key text);`);
  for (const f of ['20261002121000_runtime_ai_guard.sql', '20261002130000_prepos_credit_reservations.sql', '20261004120000_runtime_ai_monthly_cap.sql']) await db.exec(sql(`migrations/${f}`));
  return db;
}
const cap = async (db) => Number((await db.query("select monthly_cap_usd from public.runtime_ai_budget where id = 'student_ai'")).rows[0].monthly_cap_usd);
const note = async (db) => (await db.query("select col_description('public.runtime_ai_budget'::regclass, (select attnum from pg_attribute where attrelid = 'public.runtime_ai_budget'::regclass and attname = 'monthly_cap_usd')) c")).rows[0].c;

test('a rebuilt database comes up with production\'s global row (1000000), and the undo puts the 25 seed back', async () => {
  const db = await rebuilt();
  try {
    assert.equal(await cap(db), 25, 'the old seed is what a rebuild had');
    await db.exec(FORWARD);
    assert.equal(await cap(db), 1000000);
    assert.match(await note(db), /20261115120000/);
    await db.exec(FORWARD);
    assert.equal(await cap(db), 1000000, 'running it twice changes nothing');
    // The ceiling no longer stops a month's spend at USD 25.
    await db.query("update public.runtime_ai_budget set spent_usd = 30 where id = 'student_ai'");
    await db.query("insert into public.runtime_ai_requests(request_key, provider, model, reserved_usd, actual_usd, state) values ('old_spend_000001', 'openai', 'x', 30, 30, 'settled')");
    const v = (await db.query('select reserve_runtime_ai($1,$2,$3,$4,$5) v', ['key_after_25_usd', 'anthropic', 'claude-haiku-4-5', 4000, 600])).rows[0].v;
    assert.equal(v.dispatch, true, 'a reply past USD 25 of spend this month still goes out');
    await db.exec(UNDO);
    assert.equal(await cap(db), 25);
    assert.equal(await note(db), null);
  } finally { await db.close(); }
});

test('on production\'s state (the row already 1000000, set by hand) both files are no-ops', async () => {
  const db = await rebuilt();
  try {
    await db.query("update public.runtime_ai_budget set monthly_cap_usd = 1000000 where id = 'student_ai'");
    await db.exec(FORWARD);
    assert.equal(await cap(db), 1000000);
    assert.equal(await note(db), null, 'nothing marked: the forward file changed nothing');
    await db.exec(UNDO);
    assert.equal(await cap(db), 1000000, 'the undo never lowers production');
    // A deliberate stop (the 20261004120000 rollback sets 0) is never lifted either.
    await db.query("update public.runtime_ai_budget set monthly_cap_usd = 0 where id = 'student_ai'");
    await db.exec(FORWARD);
    assert.equal(await cap(db), 0);
  } finally { await db.close(); }
});

test('both files say they are not applied and a no-op on production; the forward file touches only the global row', () => {
  for (const text of [FORWARD, UNDO]) assert.match(text, /NOT APPLIED\. A NO-OP ON PRODUCTION\./);
  const statements = FORWARD.replace(/--.*$/gm, '');
  assert.match(statements, /update public\.runtime_ai_budget set monthly_cap_usd = 1000000 where id = 'student_ai' and monthly_cap_usd = 25;/);
  assert.doesNotMatch(statements, /student_user_(paid|free)/, 'the per-student caps are not touched');
});
