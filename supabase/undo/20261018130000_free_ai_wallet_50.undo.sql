-- Undo for supabase/migrations/20261018130000_free_ai_wallet_50.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself. Restores mm_ai_consume_credits and mm_ai_reserve_credits exactly as
-- production had them on 18 Oct 2026 (read from pg_proc, read-only) and puts the Free per-user cap back to USD 0.0114 (Rs 1).
-- Roll the code back first (Free allowance 10), otherwise the app shows 50 while the stored rows are no longer synced upward.
-- Wallet rows already synced to 50 by the new function keep that stored value until the next spend; the old reserve function
-- re-syncs it to the server's allowance, the old consume function only at the next month's reset.

create or replace function public.mm_ai_consume_credits(p_user_id text, p_amount integer, p_action text, p_reference text, p_idempotency_key text, p_included_monthly_credits integer, p_period_start timestamp with time zone, p_reset_at timestamp with time zone, p_metadata jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    select * into v_existing from public.ai_credit_ledger where idempotency_key = p_idempotency_key limit 1;
    if found then
      return jsonb_build_object('ok', true, 'idempotent', true, 'charged', abs(v_existing.amount), 'balance', coalesce(v_existing.balance_after, 0), 'reference', v_existing.reference);
    end if;
  end if;

  insert into public.ai_credit_wallets (user_id, included_monthly_credits, included_credits_used, bonus_credits, period_start, reset_at)
  values (p_user_id, greatest(0, coalesce(p_included_monthly_credits, 50)), 0, 0, p_period_start, p_reset_at)
  on conflict (user_id) do nothing;

  select * into v_wallet from public.ai_credit_wallets where user_id = p_user_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  if v_wallet.period_start < p_period_start then
    update public.ai_credit_wallets
       set included_monthly_credits = greatest(0, coalesce(p_included_monthly_credits, 50)),
           included_credits_used = 0,
           period_start = p_period_start,
           reset_at = p_reset_at,
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

update public.runtime_ai_budget set monthly_cap_usd = 0.0114 where id = 'student_user_free';
