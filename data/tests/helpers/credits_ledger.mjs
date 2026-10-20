// The real credits ledger on an in-process Postgres (PGlite), for tests that must prove a charge happens once: production's
// spend_credits, start_recovery_session and start_learning_session, built exactly as data/tests/one_credits_balance.test.mjs
// builds them (the repo's migration chain, then the undo that holds production's bodies, then the one-balance migration).
// No network, no Supabase.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { walletWindow } from '../../../src/services/credits/aiWalletState.js';

const file = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const CHAIN = [
  'supabase/migrations/0036_mode_aware_credits.sql',
  'supabase/migrations/20261001105920_score_recovery_foundations.sql',
  'supabase/migrations/20261002120000_connected_learning.sql',
  'supabase/migrations/20261002123000_answer_correction_history.sql',
  'db/migrations/2026_05_02_ai_overlay_credits_fix.sql',
  'supabase/migrations/20261002121000_runtime_ai_guard.sql',
  'supabase/migrations/20261002130000_prepos_credit_reservations.sql',
  'supabase/migrations/20261004120000_runtime_ai_monthly_cap.sql',
  'supabase/migrations/20261005090000_runtime_ai_price_gpt6_luna.sql',
  'supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql',
  'supabase/migrations/20261017120000_runtime_ai_user_cap.sql',
  'supabase/migrations/20261018130000_free_ai_wallet_50.sql',
  'supabase/migrations/20261018170000_practice_credit_per_question.sql',
];

export const W = walletWindow(new Date());

/** A fresh ledger database with production's credit functions. */
export async function ledgerDatabase() {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table users(id text primary key,credit_balance int);
    create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,explanation text);
    create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb);
    create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz);
    create table credit_transactions(user_id text,amount int,type text,reference text primary key,action text,credit_delta int);
    create table question_interactions(user_id text,question_id text);
    create table question_bookmarks(user_id text,question_id text);`);
  for (const rel of CHAIN) await d.exec(file(rel));
  await d.exec(`update runtime_ai_budget set monthly_cap_usd=1000000 where id='student_ai';
    update runtime_ai_budget set monthly_cap_usd=0.0568 where id='student_user_paid';
    update runtime_ai_prices set verified_at=now();`);
  await d.exec(file('supabase/undo/20261018210000_one_credits_balance.undo.sql'));
  await d.exec(file('supabase/migrations/20261018210000_one_credits_balance.sql'));
  return d;
}

const rows = (d, sql, params) => d.query(sql, params).then((r) => r.rows);

/** A student with `balance` bought credits and this month's 50 free credits already used (so the figures are plain). */
export async function ledgerUser(d, id, { balance = 100, used = 50 } = {}) {
  await rows(d, 'insert into users values($1,$2)', [id, balance]);
  await rows(d, 'insert into ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values($1,$2,$3,$4,$5,$6)', [id, 50, used, 0, W.periodStart, W.resetAt]);
}

/** Everything the student can spend now: this month's free credits left, bonus and bought. */
export async function spendable(d, id) {
  const [r] = await rows(d, `select u.credit_balance + coalesce(w.included_monthly_credits - w.included_credits_used, 0) + coalesce(w.bonus_credits, 0) n
    from users u left join ai_credit_wallets w on w.user_id = u.id where u.id = $1`, [id]);
  return Number(r.n);
}

/** The ledger rows of one student. */
export const ledger = (d, id) => rows(d, 'select reference, action, credit_delta from credit_transactions where user_id = $1 order by reference', [id]);

/** spend_credits, as Database.spendCredits calls it: true when paid (or already paid under this reference). */
export const spendCredits = (d) => async (userId, action, reference) => (await rows(d, 'select public.spend_credits($1,$2,$3) r', [userId, action, reference]))[0].r === true;
