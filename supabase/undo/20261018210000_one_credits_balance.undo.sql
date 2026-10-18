-- Undo for supabase/migrations/20261018210000_one_credits_balance.sql. NOT a migration: it lives outside supabase/migrations
-- on purpose, so the Supabase CLI never applies it by itself.
--
-- ORDER: roll the CODE back first (the one-balance reads, unified practice quote and credit packs), then run this file.
-- Old code works against either database: it never reads credit_transactions.parts, ai_credit_reservations.from_balance or the
-- 'student_held_credit' row, and the RPC signatures are unchanged. This file restores production's exact bodies as read on
-- 18 Oct 2026 (read-only pg_proc):
--   spend_credits(text,text,text)                       md5(prosrc) 911105fda93f7c1dcd687b08dd7c1059  length 1666
--   mm_ai_consume_credits(...9 args)                    md5(prosrc) c1ce92df1577794e2e49a54d82a0fd42  length 4144
--   mm_ai_reserve_credits(...8 args)                    md5(prosrc) 499b44d19273c8901b11d65f0874e9fc  length 4149
--   mm_ai_release_credits(text,text)                    md5(prosrc) 9c1d744b969d7e52c74d06e5537110f5  length 2211
--   reserve_runtime_ai(text,text,text,int,int,text,text) md5(prosrc) f6026ff6dde4b329e6f021dae3b51b7a  length 2404
-- and drops mm_wallet_take, mm_wallet_window and mm_held_ai_credits_spent and the 'student_held_credit' budget row.
--
-- What it deliberately keeps: the two nullable history columns (credit_transactions.parts, ai_credit_reservations.from_balance)
-- and the rows written while the migration was live. The restored checks are added NOT VALID, so those rows stay readable
-- and every new row is checked exactly as before. A spend already taken from free or bonus credits for practice is not given
-- back to users.credit_balance (nothing is moved between tables either way; the parts column says where each one came from).
--
-- Guard: an open AI reservation that took credits from users.credit_balance would be refunded by the restored release only
-- for its free and bonus parts. Reservations expire after 10 minutes; if the guard raises, wait for mm_ai_release_expired (or
-- release those keys with the current function) and run this file again.

do $guard$
declare v_open boolean := false;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_credit_reservations' and column_name = 'from_balance') then
    execute $q$select exists (select 1 from public.ai_credit_reservations where state in ('reserved', 'executing') and coalesce(from_balance, 0) > 0)$q$ into v_open;
  end if;
  if v_open then
    raise exception 'one_credits_balance undo: open reservations hold users.credit_balance credits; release them first';
  end if;
end
$guard$;

create or replace function public.spend_credits(p_user_id text, p_action text, p_reference text)
 returns boolean
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_amount INTEGER;
  v_balance INTEGER;
  v_existing public.credit_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action IS NULL OR p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'user_id, action, and reference are required';
  END IF;

  v_amount := CASE p_action
    WHEN 'generate'      THEN 10
    WHEN 'attempt'       THEN 10
    WHEN 'attempt_5'     THEN 5
    WHEN 'attempt_10'    THEN 10
    WHEN 'attempt_15'    THEN 15
    WHEN 'attempt_20'    THEN 20
    WHEN 'attempt_full'  THEN 50
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'unsupported credit spend action: %', p_action;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.credit_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id = p_user_id
       AND v_existing.action = p_action
       AND v_existing.credit_delta = -v_amount THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION 'credit reference already used for a different transaction';
  END IF;

  SELECT credit_balance
  INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF v_balance < v_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET credit_balance = credit_balance - v_amount
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference, action, credit_delta)
  VALUES (p_user_id, -v_amount, 'spend', p_reference, p_action, -v_amount);

  RAISE LOG 'credit_change user_id=% action=% credit_delta=%', p_user_id, p_action, -v_amount;
  RETURN TRUE;
END;
$function$;


create or replace function public.mm_ai_consume_credits(p_user_id text, p_amount integer, p_action text, p_reference text, p_idempotency_key text, p_included_monthly_credits integer, p_period_start timestamp with time zone, p_reset_at timestamp with time zone, p_metadata jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_wallet public.ai_credit_wallets%rowtype;
  v_allow integer := greatest(0, coalesce(p_included_monthly_credits, 50));
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
    select * into v_existing from public.ai_credit_ledger where idempotency_key = p_idempotency_key limit 1;
    if found then
      return jsonb_build_object('ok', true, 'idempotent', true, 'charged', abs(v_existing.amount), 'balance', coalesce(v_existing.balance_after, 0), 'reference', v_existing.reference);
    end if;
  end if;

  insert into public.ai_credit_wallets (user_id, included_monthly_credits, included_credits_used, bonus_credits, period_start, reset_at)
  values (p_user_id, v_allow, 0, 0, p_period_start, p_reset_at)
  on conflict (user_id) do nothing;

  select * into v_wallet from public.ai_credit_wallets where user_id = p_user_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  if v_wallet.period_start < p_period_start then
    update public.ai_credit_wallets
       set included_monthly_credits = v_allow,
           included_credits_used = 0,
           period_start = p_period_start,
           reset_at = p_reset_at,
           updated_at = now()
     where user_id = p_user_id
     returning * into v_wallet;
  elsif v_wallet.included_monthly_credits <> v_allow then
    -- Mid-month allowance change (for example Free 10 -> 50): follow the server's allowance, keep what was already used.
    update public.ai_credit_wallets
       set included_monthly_credits = v_allow,
           included_credits_used = least(v_wallet.included_credits_used, v_allow),
           updated_at = now()
     where user_id = p_user_id
     returning * into v_wallet;
  end if;

  v_included_remaining := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used);
  v_total_balance := v_included_remaining + v_wallet.bonus_credits;

  if p_amount = 0 then
    return jsonb_build_object('ok', true, 'charged', 0, 'balance', v_total_balance, 'includedRemaining', v_included_remaining, 'bonusCredits', v_wallet.bonus_credits);
  end if;

  if v_total_balance < p_amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient_ai_credits', 'balance', v_total_balance, 'required', p_amount, 'includedRemaining', v_included_remaining, 'bonusCredits', v_wallet.bonus_credits);
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

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    p_user_id,
    -p_amount,
    'ai_spend',
    p_action,
    p_reference,
    case when v_from_included > 0 and v_from_bonus > 0 then 'mixed' when v_from_included > 0 then 'included' when v_from_bonus > 0 then 'bonus' else 'none' end,
    v_total_balance,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('includedSpent', v_from_included, 'bonusSpent', v_from_bonus)
  );

  return jsonb_build_object('ok', true, 'charged', p_amount, 'balance', v_total_balance, 'includedRemaining', v_included_remaining, 'bonusCredits', v_wallet.bonus_credits, 'includedSpent', v_from_included, 'bonusSpent', v_from_bonus, 'reference', p_reference);
end;
$function$;


create or replace function public.mm_ai_reserve_credits(p_user_id text, p_amount integer, p_action text, p_operation_key text, p_included_monthly_credits integer, p_period_start timestamp with time zone, p_reset_at timestamp with time zone, p_metadata jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_wallet public.ai_credit_wallets%rowtype;
  v_existing public.ai_credit_reservations%rowtype;
  v_allow integer := greatest(0, coalesce(p_included_monthly_credits, 50));
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
$function$;


create or replace function public.mm_ai_release_credits(p_operation_key text, p_reason text default 'released'::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
$function$;

create or replace function public.reserve_runtime_ai(p_key text, p_provider text, p_model text, p_input_bound integer, p_output_bound integer, p_user_id text default null::text, p_user_tier text default null::text)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare b public.runtime_ai_budget%rowtype;r public.runtime_ai_requests%rowtype;price public.runtime_ai_prices%rowtype;cost numeric;month_spend numeric;user_cap numeric;user_spend numeric;
begin
 select * into b from public.runtime_ai_budget where id='student_ai' for update;
 if not found or b.paused then raise exception 'runtime funding unavailable'; end if;
 if not ((p_provider='openai' and p_model='gpt-6-luna') or (p_provider='anthropic' and p_model='claude-haiku-5-5')) then raise exception 'runtime model not allowed'; end if;
 select * into r from public.runtime_ai_requests where request_key=p_key;
 if found then
   if r.provider<>p_provider or r.model<>p_model then raise exception 'request conflict'; end if;
   return jsonb_build_object('dispatch',false,'state',r.state,'receipt',r.receipt);
 end if;
 select * into price from public.runtime_ai_prices where provider=p_provider and model=p_model and verified_at>now()-interval '90 days';
 if not found then raise exception 'verified model price required'; end if;
 if p_input_bound<1 or p_output_bound<1 then raise exception 'invalid token bounds'; end if;
 cost=(p_input_bound*price.input_per_million+p_output_bound*price.output_per_million)/1000000;
 select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into month_spend
   from public.runtime_ai_requests where created_at>=public.runtime_ai_month_start();
 if month_spend+cost>b.monthly_cap_usd then raise exception 'runtime budget exhausted'; end if;
 if p_user_id is not null then
   select monthly_cap_usd into user_cap from public.runtime_ai_budget
     where id=case when p_user_tier='paid' then 'student_user_paid' else 'student_user_free' end;
   if user_cap is null then raise exception 'runtime funding unavailable'; end if;
   select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into user_spend
     from public.runtime_ai_requests where user_id=p_user_id and created_at>=public.runtime_ai_month_start();
   if user_spend+cost>user_cap then raise exception 'runtime user limit reached'; end if;
 end if;
 insert into public.runtime_ai_requests(request_key,provider,model,reserved_usd,user_id) values(p_key,p_provider,p_model,cost,p_user_id);
 update public.runtime_ai_budget set reserved_usd=reserved_usd+cost where id=b.id;
 return jsonb_build_object('dispatch',true,'reserved',cost,'inputRate',price.input_per_million,'outputRate',price.output_per_million);
end $function$;

drop function if exists public.mm_wallet_take(text, integer, timestamp with time zone, timestamp with time zone, integer);
drop function if exists public.mm_held_ai_credits_spent(text, timestamp with time zone);
drop function if exists public.mm_wallet_window(timestamp with time zone);
delete from public.runtime_ai_budget where id = 'student_held_credit';

-- The checks as production had them (NOT VALID: rows written while the migration was live stay; new rows are checked).
alter table public.ai_credit_reservations drop constraint if exists ai_credit_reservations_split;
alter table public.ai_credit_reservations add constraint ai_credit_reservations_split check (from_included + from_bonus = amount) not valid;
alter table public.ai_credit_ledger drop constraint if exists ai_credit_ledger_wallet_source_check;
alter table public.ai_credit_ledger add constraint ai_credit_ledger_wallet_source_check
  check (wallet_source in ('included', 'bonus', 'mixed', 'grant', 'adjustment', 'none')) not valid;
-- Kept on purpose (nullable history): credit_transactions.parts, ai_credit_reservations.from_balance and its >= 0 check.
