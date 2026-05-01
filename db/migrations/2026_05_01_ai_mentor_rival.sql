-- =====================================================================
-- MockMob — AI Mentor + AI Rival migration
-- Date: 2026-05-01
--
-- Apply: paste this entire file into the Supabase SQL editor and run.
-- Idempotent: safe to re-run. Does not touch existing tables/columns.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ai_usage_logs
--    Append-only log of every AI call. Drives cost reporting and the
--    monthly included AI-credit counter.
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  feature text not null,
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  action_triggered text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_created_idx
  on public.ai_usage_logs (user_id, created_at desc);
create index if not exists ai_usage_logs_feature_created_idx
  on public.ai_usage_logs (feature, created_at desc);

-- ---------------------------------------------------------------------
-- 1b. ai_credit_ledger
--     Future-ready ledger for monthly included grants and extra AI packs.
--     Current app code can operate from ai_usage_logs, but this table lets
--     future payment/cron jobs grant, expire, and audit AI credits cleanly.
-- ---------------------------------------------------------------------
create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  amount integer not null,
  reason text not null
    check (reason in ('monthly_grant', 'pack_purchase', 'admin_adjustment', 'ai_spend', 'expiry')),
  feature text,
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_credit_ledger_user_created_idx
  on public.ai_credit_ledger (user_id, created_at desc);
create index if not exists ai_credit_ledger_reference_idx
  on public.ai_credit_ledger (reference);

-- ---------------------------------------------------------------------
-- 2. mentor_sessions + mentor_messages
-- ---------------------------------------------------------------------
create table if not exists public.mentor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentor_sessions_user_idx
  on public.mentor_sessions (user_id, updated_at desc);

create table if not exists public.mentor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mentor_sessions(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  structured_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mentor_messages_session_idx
  on public.mentor_messages (session_id, created_at);
create index if not exists mentor_messages_user_idx
  on public.mentor_messages (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. rival_battles + rival_battle_answers
-- ---------------------------------------------------------------------
create table if not exists public.rival_battles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  rival_type text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'abandoned')),
  subjects text[] not null default '{}',
  question_ids text[] not null default '{}',
  rival_profile jsonb not null default '{}'::jsonb,
  rival_score integer not null default 0,
  rival_accuracy integer not null default 0,
  rival_time_seconds integer not null default 0,
  user_score integer,
  user_accuracy integer,
  user_time_seconds integer,
  result text check (result in ('win', 'loss', 'tie')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists rival_battles_user_created_idx
  on public.rival_battles (user_id, created_at desc);
create index if not exists rival_battles_rival_type_idx
  on public.rival_battles (rival_type);
create index if not exists rival_battles_status_idx
  on public.rival_battles (status);

create table if not exists public.rival_battle_answers (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.rival_battles(id) on delete cascade,
  user_id text not null,
  question_id text not null,
  selected_answer integer,
  is_correct boolean,
  time_spent_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists rival_battle_answers_battle_idx
  on public.rival_battle_answers (battle_id);

-- ---------------------------------------------------------------------
-- 3b. RLS hardening
--     The app currently accesses these tables from server routes through
--     the service-role Supabase client. Enable RLS for defense in depth and
--     do not add broad anon/authenticated direct table policies here.
-- ---------------------------------------------------------------------
alter table public.ai_usage_logs enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.mentor_sessions enable row level security;
alter table public.mentor_messages enable row level security;
alter table public.rival_battles enable row level security;
alter table public.rival_battle_answers enable row level security;

-- ---------------------------------------------------------------------
-- 4. mm_spend_credits_amount RPC
--    Atomic, parameterised credit decrement for AI Mentor + Rival.
--    Independent from the existing fixed-action `spend_credits` RPC so
--    we can charge variable amounts without modifying the original.
--
--    Returns jsonb { ok, balance, charged?, required?, error? }.
-- ---------------------------------------------------------------------
create or replace function public.mm_spend_credits_amount(
  p_user_id text,
  p_amount integer,
  p_action text,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_after integer;
begin
  if p_amount is null or p_amount < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  select credit_balance into v_balance
    from public.users
   where id = p_user_id
   for update;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'user_not_found', 'balance', 0);
  end if;

  if p_amount = 0 then
    return jsonb_build_object('ok', true, 'balance', v_balance, 'charged', 0);
  end if;

  if v_balance < p_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient_credits',
      'balance', v_balance,
      'required', p_amount
    );
  end if;

  update public.users
     set credit_balance = credit_balance - p_amount
   where id = p_user_id;
  v_after := v_balance - p_amount;

  return jsonb_build_object(
    'ok', true,
    'balance', v_after,
    'charged', p_amount,
    'action', p_action,
    'reference', p_reference
  );
end;
$$;

revoke all on function public.mm_spend_credits_amount(text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.mm_spend_credits_amount(text, integer, text, text)
  to service_role;
