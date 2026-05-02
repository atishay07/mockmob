-- Atomic, idempotent PrepOS credit purchase grants.
-- Both checkout verification and Razorpay webhooks use this RPC with the same
-- idempotency key, so one captured payment can only add credits once.

create unique index if not exists ai_credit_ledger_idempotency_idx
on public.ai_credit_ledger (idempotency_key)
where idempotency_key is not null;

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
  v_period_start timestamptz;
  v_reset_at timestamptz;
  v_reason text;
begin
  if p_user_id is null or p_user_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  v_reason := case
    when p_reason in ('monthly_grant', 'pack_purchase', 'admin_adjustment', 'ai_spend', 'expiry') then p_reason
    else 'pack_purchase'
  end;

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

  v_period_start := date_trunc('month', timezone('Asia/Kolkata', now())) at time zone 'Asia/Kolkata';
  v_reset_at := (date_trunc('month', timezone('Asia/Kolkata', now())) + interval '1 month') at time zone 'Asia/Kolkata';

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
    v_period_start,
    v_reset_at
  )
  on conflict (user_id) do nothing;

  select * into v_wallet
    from public.ai_credit_wallets
   where user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;

  -- Re-check after the wallet lock. If checkout verify and webhook arrive
  -- together, the second caller waits here and then sees the first ledger row.
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
    v_reason,
    'ai_credit_purchase',
    p_reference,
    'grant',
    v_balance,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
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
