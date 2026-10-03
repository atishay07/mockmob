-- PrepOS student-credit reservations: reserved -> executing -> committed | released.
--
-- NOT APPLIED. Save, review and run on staging first (docs/brain/LEARNING-DEPLOYMENT.md).
-- Depends on db/migrations/2026_05_02_ai_overlay_credits_fix.sql (wallet + ledger tables).
-- Rollback: drop the four functions and the table below; the wallet and ledger tables are
-- untouched and existing balances keep working. The older mm_ai_consume_credits stays for
-- zero-risk callers; paid model replies use this lifecycle instead.
--
-- Guarantees:
--   * One stable operation key per student action. Retrying the same key never charges twice.
--   * Reserving takes the credits out of the wallet inside the same transaction that records the
--     reservation and its ledger row, so concurrent requests cannot overspend.
--   * Release returns exactly what was taken (included first, bonus second). If the monthly
--     period has rolled, expired included credits come back as bonus credits, so a failed reply
--     never costs the student anything.
--   * Commit makes the charge final. A committed reservation can never be released, and a
--     released one can never be committed.
--   * Provider spend is recorded separately (runtime_ai_requests); a release does not erase it.

create table if not exists public.ai_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  operation_key text not null,
  amount integer not null check (amount > 0),
  action text not null,
  state text not null default 'reserved' check (state in ('reserved', 'executing', 'committed', 'released')),
  from_included integer not null default 0 check (from_included >= 0),
  from_bonus integer not null default 0 check (from_bonus >= 0),
  period_start timestamptz not null,
  provider_key text,
  receipt jsonb,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  constraint ai_credit_reservations_split check (from_included + from_bonus = amount)
);
create unique index if not exists ai_credit_reservations_operation_idx on public.ai_credit_reservations (operation_key);
create index if not exists ai_credit_reservations_open_idx on public.ai_credit_reservations (expires_at) where state in ('reserved', 'executing');
create index if not exists ai_credit_reservations_user_idx on public.ai_credit_reservations (user_id, created_at desc);

alter table public.ai_credit_reservations enable row level security;
revoke all on public.ai_credit_reservations from public, anon, authenticated;
grant select, insert, update on public.ai_credit_reservations to service_role;

create or replace function public.mm_ai_reserve_credits(
  p_user_id text,
  p_amount integer,
  p_action text,
  p_operation_key text,
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
  v_existing public.ai_credit_reservations%rowtype;
  v_allow integer := greatest(0, coalesce(p_included_monthly_credits, 10));
  v_included_remaining integer;
  v_from_included integer;
  v_from_bonus integer;
  v_balance integer;
begin
  if p_user_id is null or p_user_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_operation_key is null or length(p_operation_key) < 8 then
    return jsonb_build_object('ok', false, 'error', 'operation_key_required');
  end if;

  insert into public.ai_credit_wallets (user_id, included_monthly_credits, included_credits_used, bonus_credits, period_start, reset_at)
  values (p_user_id, v_allow, 0, 0, p_period_start, p_reset_at)
  on conflict (user_id) do nothing;

  -- One lock order everywhere: wallet first. This serialises concurrent reservations per user
  -- before the idempotency record is read.
  select * into v_wallet from public.ai_credit_wallets where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  select * into v_existing from public.ai_credit_reservations where operation_key = p_operation_key;
  if found then
    if v_existing.user_id <> p_user_id then
      return jsonb_build_object('ok', false, 'error', 'operation_key_conflict');
    end if;
    if v_existing.state = 'released' then
      return jsonb_build_object('ok', false, 'error', 'operation_released', 'state', v_existing.state);
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'state', v_existing.state, 'amount', v_existing.amount);
  end if;

  if v_wallet.period_start < p_period_start or v_wallet.included_monthly_credits <> v_allow then
    update public.ai_credit_wallets
       set included_monthly_credits = v_allow,
           included_credits_used = case when v_wallet.period_start < p_period_start then 0 else least(v_wallet.included_credits_used, v_allow) end,
           period_start = case when v_wallet.period_start < p_period_start then p_period_start else v_wallet.period_start end,
           reset_at = case when v_wallet.period_start < p_period_start then p_reset_at else v_wallet.reset_at end,
           updated_at = now()
     where user_id = p_user_id
     returning * into v_wallet;
  end if;

  v_included_remaining := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used);
  v_balance := v_included_remaining + v_wallet.bonus_credits;
  if v_balance < p_amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient_ai_credits', 'balance', v_balance, 'required', p_amount);
  end if;

  v_from_included := least(v_included_remaining, p_amount);
  v_from_bonus := p_amount - v_from_included;

  update public.ai_credit_wallets
     set included_credits_used = included_credits_used + v_from_included,
         bonus_credits = bonus_credits - v_from_bonus,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  insert into public.ai_credit_reservations (user_id, operation_key, amount, action, from_included, from_bonus, period_start)
  values (p_user_id, p_operation_key, p_amount, coalesce(p_action, 'ai'), v_from_included, v_from_bonus, v_wallet.period_start);

  v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits;

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    p_user_id, -p_amount, 'ai_reserve', coalesce(p_action, 'ai'), p_operation_key,
    case when v_from_included > 0 and v_from_bonus > 0 then 'mixed' when v_from_included > 0 then 'included' else 'bonus' end,
    v_balance, 'reserve:' || p_operation_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('kind', 'reserve', 'includedSpent', v_from_included, 'bonusSpent', v_from_bonus)
  );

  return jsonb_build_object('ok', true, 'state', 'reserved', 'amount', p_amount, 'balance', v_balance,
    'includedSpent', v_from_included, 'bonusSpent', v_from_bonus);
end;
$$;

create or replace function public.mm_ai_mark_executing(p_operation_key text, p_provider_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.ai_credit_reservations%rowtype;
begin
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  end if;
  if v_res.state = 'reserved' then
    update public.ai_credit_reservations
       set state = 'executing', provider_key = p_provider_key, expires_at = now() + interval '10 minutes', updated_at = now()
     where id = v_res.id;
    return jsonb_build_object('ok', true, 'state', 'executing');
  end if;
  if v_res.state = 'executing' then
    return jsonb_build_object('ok', true, 'state', 'executing', 'idempotent', true);
  end if;
  return jsonb_build_object('ok', false, 'error', 'reservation_' || v_res.state, 'state', v_res.state);
end;
$$;

create or replace function public.mm_ai_commit_credits(p_operation_key text, p_receipt jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.ai_credit_reservations%rowtype;
begin
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  end if;
  if v_res.state = 'committed' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'state', 'committed', 'amount', v_res.amount);
  end if;
  if v_res.state = 'released' then
    return jsonb_build_object('ok', false, 'error', 'already_released', 'state', 'released');
  end if;
  update public.ai_credit_reservations
     set state = 'committed', receipt = coalesce(p_receipt, '{}'::jsonb), updated_at = now()
   where id = v_res.id;
  return jsonb_build_object('ok', true, 'state', 'committed', 'amount', v_res.amount);
end;
$$;

create or replace function public.mm_ai_release_credits(p_operation_key text, p_reason text default 'released')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.ai_credit_reservations%rowtype;
  v_wallet public.ai_credit_wallets%rowtype;
  v_to_included integer;
  v_to_bonus integer;
  v_balance integer;
begin
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  end if;
  -- Lock order matches reserve: wallet, then the reservation.
  select * into v_wallet from public.ai_credit_wallets where user_id = v_res.user_id for update;
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key for update;

  if v_res.state = 'released' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'state', 'released');
  end if;
  if v_res.state = 'committed' then
    return jsonb_build_object('ok', false, 'error', 'already_committed', 'state', 'committed');
  end if;

  if v_wallet.period_start = v_res.period_start then
    v_to_included := v_res.from_included;
    v_to_bonus := v_res.from_bonus;
  else
    -- The monthly allowance already reset; hand back the expired included credits as bonus.
    v_to_included := 0;
    v_to_bonus := v_res.from_included + v_res.from_bonus;
  end if;

  update public.ai_credit_wallets
     set included_credits_used = greatest(0, included_credits_used - v_to_included),
         bonus_credits = bonus_credits + v_to_bonus,
         updated_at = now()
   where user_id = v_res.user_id
   returning * into v_wallet;

  update public.ai_credit_reservations
     set state = 'released', release_reason = left(coalesce(p_reason, 'released'), 200), updated_at = now()
   where id = v_res.id;

  v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits;

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    v_res.user_id, v_res.amount, 'ai_release', v_res.action, p_operation_key, 'adjustment', v_balance, 'release:' || p_operation_key,
    jsonb_build_object('kind', 'release', 'includedRestored', v_to_included, 'bonusRestored', v_to_bonus, 'reason', left(coalesce(p_reason, 'released'), 200))
  );

  return jsonb_build_object('ok', true, 'state', 'released', 'restored', v_res.amount, 'balance', v_balance);
end;
$$;

-- Sweeps reservations whose reply never finished (crash, timeout). Safe to run on a schedule.
create or replace function public.mm_ai_release_expired(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_count integer := 0;
begin
  for v_key in
    select operation_key from public.ai_credit_reservations
     where state in ('reserved', 'executing') and expires_at < now()
     order by expires_at
     limit greatest(1, least(coalesce(p_limit, 100), 1000))
  loop
    perform public.mm_ai_release_credits(v_key, 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.mm_ai_reserve_credits(text, integer, text, text, integer, timestamptz, timestamptz, jsonb),
  public.mm_ai_mark_executing(text, text), public.mm_ai_commit_credits(text, jsonb),
  public.mm_ai_release_credits(text, text), public.mm_ai_release_expired(integer) from public, anon, authenticated;
grant execute on function public.mm_ai_reserve_credits(text, integer, text, text, integer, timestamptz, timestamptz, jsonb),
  public.mm_ai_mark_executing(text, text), public.mm_ai_commit_credits(text, jsonb),
  public.mm_ai_release_credits(text, text), public.mm_ai_release_expired(integer) to service_role;
