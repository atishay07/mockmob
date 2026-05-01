-- =====================================================================
-- MockMob AI overlay + dedicated AI credits corrective migration
-- Date: 2026-05-02
--
-- Apply: paste this file into the Supabase SQL editor and run.
-- Idempotent: safe to re-run. Does not mutate normal app credits.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Base AI tables
-- This corrective migration must run even if the earlier 2026-05-01 AI
-- migration was not applied. Create the base tables before any ALTER TABLE.
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
-- 1. Dedicated per-user AI wallet
-- ---------------------------------------------------------------------
create table if not exists public.ai_credit_wallets (
  user_id text primary key references public.users(id) on delete cascade,
  included_monthly_credits integer not null default 10,
  included_credits_used integer not null default 0 check (included_credits_used >= 0),
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  period_start timestamptz not null,
  reset_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_credit_wallets_reset_idx
  on public.ai_credit_wallets (reset_at);

-- ---------------------------------------------------------------------
-- 2. Extend ledger from the first AI migration without breaking reruns
-- ---------------------------------------------------------------------
create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  feature text,
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ai_credit_ledger
  add column if not exists wallet_source text
    check (wallet_source in ('included', 'bonus', 'mixed', 'grant', 'adjustment', 'none'));

alter table public.ai_credit_ledger
  add column if not exists balance_after integer;

alter table public.ai_credit_ledger
  add column if not exists idempotency_key text;

create unique index if not exists ai_credit_ledger_idempotency_idx
  on public.ai_credit_ledger (idempotency_key)
  where idempotency_key is not null;

create index if not exists ai_credit_ledger_user_created_idx
  on public.ai_credit_ledger (user_id, created_at desc);

create index if not exists ai_credit_ledger_reference_idx
  on public.ai_credit_ledger (reference);

-- ---------------------------------------------------------------------
-- 3. Mentor history safety
-- ---------------------------------------------------------------------
create table if not exists public.mentor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
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
  user_id text not null references public.users(id) on delete cascade,
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
-- 4. Rival battle reliability additions
-- ---------------------------------------------------------------------
create table if not exists public.rival_battles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
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
  user_id text not null references public.users(id) on delete cascade,
  question_id text not null,
  selected_answer integer,
  is_correct boolean,
  time_spent_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists rival_battle_answers_battle_idx
  on public.rival_battle_answers (battle_id);

alter table public.rival_battles
  add column if not exists share_payload jsonb not null default '{}'::jsonb;

alter table public.rival_battles
  add column if not exists error_message text;

create index if not exists rival_battles_user_status_created_idx
  on public.rival_battles (user_id, status, created_at desc);

-- ---------------------------------------------------------------------
-- 5. RLS hardening
-- Server routes use the service role key. RLS stays enabled for defense in
-- depth, with no broad direct anon/authenticated table policies here.
-- ---------------------------------------------------------------------
alter table public.ai_credit_wallets enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.mentor_sessions enable row level security;
alter table public.mentor_messages enable row level security;
alter table public.rival_battles enable row level security;
alter table public.rival_battle_answers enable row level security;

-- ---------------------------------------------------------------------
-- 6. Atomic AI credit consumption
-- The function resets monthly included credits when p_period_start advances,
-- then spends included credits first and bonus credits second.
-- ---------------------------------------------------------------------
create or replace function public.mm_ai_consume_credits(
  p_user_id text,
  p_amount integer,
  p_action text,
  p_reference text,
  p_idempotency_key text,
  p_included_monthly_credits integer,
  p_period_start timestamptz,
  p_reset_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.ai_credit_wallets%rowtype;
  v_included_remaining integer;
  v_from_included integer;
  v_from_bonus integer;
  v_total_balance integer;
  v_existing public.ai_credit_ledger%rowtype;
begin
  if p_user_id is null or p_user_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  if p_amount is null or p_amount < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
      from public.ai_credit_ledger
     where idempotency_key = p_idempotency_key
     limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'charged', abs(v_existing.amount),
        'balance', coalesce(v_existing.balance_after, 0),
        'reference', v_existing.reference
      );
    end if;
  end if;

  insert into public.ai_credit_wallets (
    user_id,
    included_monthly_credits,
    included_credits_used,
    bonus_credits,
    period_start,
    reset_at
  )
  values (
    p_user_id,
    greatest(0, coalesce(p_included_monthly_credits, 10)),
    0,
    0,
    p_period_start,
    p_reset_at
  )
  on conflict (user_id) do nothing;

  select * into v_wallet
    from public.ai_credit_wallets
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  if v_wallet.period_start < p_period_start
     or v_wallet.included_monthly_credits <> greatest(0, coalesce(p_included_monthly_credits, 10)) then
    update public.ai_credit_wallets
       set included_monthly_credits = greatest(0, coalesce(p_included_monthly_credits, 10)),
           included_credits_used = case
             when v_wallet.period_start < p_period_start then 0
             else least(v_wallet.included_credits_used, greatest(0, coalesce(p_included_monthly_credits, 10)))
           end,
           period_start = case when v_wallet.period_start < p_period_start then p_period_start else v_wallet.period_start end,
           reset_at = case when v_wallet.period_start < p_period_start then p_reset_at else v_wallet.reset_at end,
           updated_at = now()
     where user_id = p_user_id
     returning * into v_wallet;
  end if;

  v_included_remaining := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used);
  v_total_balance := v_included_remaining + v_wallet.bonus_credits;

  if p_amount = 0 then
    return jsonb_build_object(
      'ok', true,
      'charged', 0,
      'balance', v_total_balance,
      'includedRemaining', v_included_remaining,
      'bonusCredits', v_wallet.bonus_credits
    );
  end if;

  if v_total_balance < p_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient_ai_credits',
      'balance', v_total_balance,
      'required', p_amount,
      'includedRemaining', v_included_remaining,
      'bonusCredits', v_wallet.bonus_credits
    );
  end if;

  v_from_included := least(v_included_remaining, p_amount);
  v_from_bonus := p_amount - v_from_included;

  update public.ai_credit_wallets
     set included_credits_used = included_credits_used + v_from_included,
         bonus_credits = bonus_credits - v_from_bonus,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  v_included_remaining := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used);
  v_total_balance := v_included_remaining + v_wallet.bonus_credits;

  insert into public.ai_credit_ledger (
    user_id,
    amount,
    reason,
    feature,
    reference,
    wallet_source,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    -p_amount,
    'ai_spend',
    p_action,
    p_reference,
    case
      when v_from_included > 0 and v_from_bonus > 0 then 'mixed'
      when v_from_included > 0 then 'included'
      when v_from_bonus > 0 then 'bonus'
      else 'none'
    end,
    v_total_balance,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb) ||
      jsonb_build_object('includedSpent', v_from_included, 'bonusSpent', v_from_bonus)
  );

  return jsonb_build_object(
    'ok', true,
    'charged', p_amount,
    'balance', v_total_balance,
    'includedRemaining', v_included_remaining,
    'bonusCredits', v_wallet.bonus_credits,
    'includedSpent', v_from_included,
    'bonusSpent', v_from_bonus,
    'reference', p_reference
  );
end;
$$;

revoke all on function public.mm_ai_consume_credits(
  text, integer, text, text, text, integer, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.mm_ai_consume_credits(
  text, integer, text, text, text, integer, timestamptz, timestamptz, jsonb
) to service_role;

create or replace function public.mm_ai_grant_bonus_credits(
  p_user_id text,
  p_amount integer,
  p_reason text,
  p_reference text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.ai_credit_wallets%rowtype;
  v_existing public.ai_credit_ledger%rowtype;
  v_balance integer;
begin
  if p_user_id is null or p_user_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
      from public.ai_credit_ledger
     where idempotency_key = p_idempotency_key
     limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'granted', greatest(0, v_existing.amount),
        'balance', coalesce(v_existing.balance_after, 0),
        'reference', v_existing.reference
      );
    end if;
  end if;

  insert into public.ai_credit_wallets (
    user_id,
    included_monthly_credits,
    included_credits_used,
    bonus_credits,
    period_start,
    reset_at
  )
  values (
    p_user_id,
    10,
    0,
    0,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month'
  )
  on conflict (user_id) do nothing;

  select * into v_wallet
    from public.ai_credit_wallets
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  update public.ai_credit_wallets
     set bonus_credits = bonus_credits + p_amount,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits;

  insert into public.ai_credit_ledger (
    user_id,
    amount,
    reason,
    feature,
    reference,
    wallet_source,
    balance_after,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_amount,
    coalesce(nullif(p_reason, ''), 'ai_credit_purchase'),
    'ai_credit_purchase',
    p_reference,
    'grant',
    v_balance,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'ok', true,
    'granted', p_amount,
    'balance', v_balance,
    'bonusCredits', v_wallet.bonus_credits,
    'reference', p_reference
  );
end;
$$;

revoke all on function public.mm_ai_grant_bonus_credits(
  text, integer, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.mm_ai_grant_bonus_credits(
  text, integer, text, text, text, jsonb
) to service_role;
