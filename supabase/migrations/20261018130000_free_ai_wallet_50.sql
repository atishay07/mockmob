-- Free AI wallet: 10 -> 50 credits a month (owner, 18 Oct 2026, 12:15 and 12:30 pm). Pro stays at 50 included.
-- Companion to src/services/credits/aiCreditWallet.js (AI_FREE_MONTHLY_CREDITS = 50, AI_FREE_BUDGET_INR_CAP = 2.5).
-- NOT applied on production by this branch. Dry-run on staging (onwkqxmjqjrhfbjjdydu) is recorded in docs/brain/STATUS.md.
--
-- The allowance is sent by the server on every spend (p_included_monthly_credits); the wallet row keeps a copy. Three things
-- in the database still said "10" or could not follow a raised allowance, and one cap would stop a student before 50 replies:
--
--   1. mm_ai_consume_credits (Ask Mobi chat, Rival, Trap drill, Admission path) only synced a wallet row's allowance when the
--      month rolled over. A Free student who had already used some of October's 10 would have been shown "46 left" by the app
--      (the app projects from the code allowance) while this function still enforced the stored 10. It now syncs the stored
--      allowance to the one the server sends, exactly as mm_ai_reserve_credits already did, and keeps the credits already
--      used this month (capped at the allowance). So a student who used 4 of 10 has 46 of 50 left: no one-time grant needed.
--      Nothing else in the function changes (idempotency, wallet lock, bonus credits, ledger rows are as on production).
--   2. mm_ai_reserve_credits fell back to 10 when no allowance was sent (the server always sends one). The fallback is now 50.
--      Nothing else in the function changes.
--   3. runtime_ai_budget 'student_user_free' (per-user monthly spend cap, set 17 Oct 2026): USD 0.0114 (Rs 1) -> USD 0.0284
--      (Rs 2.50 at Rs 88 to the dollar, the rate that file used). Evidence, production runtime_ai_requests on 18 Oct 2026:
--      a reply costs about USD 0.00029 actual (gpt-6-luna: 9 requests average 0.000299, maximum 0.000479; the four requests
--      with a user id average 0.000289), and each new request is checked as spent-so-far plus its reservation, about USD 0.00155.
--      Under the old Rs 1 cap a Free student stops after about 33 typical replies (0.0114 - 0.00155 = 0.0099 / 0.0003); 50 typical
--      replies need 0.015 + 0.00155 = about 0.0165. At the observed maximum (0.000479 a reply) 50 replies need about 0.0255, so
--      Rs 2.50 (0.0284) covers that as well, with room for a failed attempt or two (a failed call keeps its reservation).
--      Pro (student_user_paid, 0.0568 = Rs 5) is unchanged. The global 'student_ai' row is NOT touched by this file.
--
-- Rollback: supabase/undo/20261018130000_free_ai_wallet_50.undo.sql (restores production's bodies and the 0.0114 cap).

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

-- Per-user Free spending cap: Rs 1 -> Rs 2.50 (USD 0.0114 -> 0.0284). One UPDATE, no deploy needed to change it again.
update public.runtime_ai_budget set monthly_cap_usd = 0.0284 where id = 'student_user_free';
