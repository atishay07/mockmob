-- NOT APPLIED. Saved by the 15 Nov 2026 security fix (audit finding M4, tmp/1115-prod/sec-money.md); apply only with the
-- owner's word. Undo: supabase/undo/20261115120000_razorpay_refund_credit_takeback.undo.sql.
--
-- A refund of a Razorpay credit pack (made in the Razorpay dashboard) takes back the credits that pack bought, the same way
-- mm_play_revoke_purchase does for a voided Google Play pack: only purchased (bonus) credits, never more than the wallet
-- still holds, never below zero, and the shortfall (credits already spent) is kept in the ledger row's metadata.
--
-- Idempotent: one ledger row per p_idempotency_key (the webhook passes 'razorpay_refund:<payment id>'), written even when
-- nothing could be taken back (amount 0), so a retry never takes credits bought later. ai_credit_ledger has no check on
-- amount and a unique index on idempotency_key (ai_credit_ledger_idempotency_idx, migration 0038; checked read-only on
-- production 15 Nov 2026). Lock order users -> wallet, as mm_wallet_take.
--
-- Nothing here is required for the site to work: until this is applied, Database.takeBackRefundedCredits answers
-- 'rpc_missing', the webhook records billing.refund_credits_manual and the owner follows the refund runbook (REFUND-RUNBOOK.md).
-- Tested by data/tests/refund_credit_takeback_1115.test.mjs (PGlite).

create or replace function public.mm_ai_take_back_refunded_credits(
  p_user_id text,
  p_credits integer,
  p_reference text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.ai_credit_wallets%rowtype;
  v_existing public.ai_credit_ledger%rowtype;
  v_take integer := 0;
  v_balance integer := 0;
begin
  if coalesce(p_user_id, '') = '' or coalesce(p_idempotency_key, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_field');
  end if;
  if p_credits is null or p_credits <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  perform 1 from public.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  select * into v_existing from public.ai_credit_ledger where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'idempotent', true,
      'clawedBack', -coalesce(v_existing.amount, 0),
      'shortfall', coalesce((v_existing.metadata ->> 'shortfall')::integer, 0));
  end if;

  select * into v_wallet from public.ai_credit_wallets where user_id = p_user_id for update;
  if found then
    v_take := least(greatest(coalesce(v_wallet.bonus_credits, 0), 0), p_credits);
    if v_take > 0 then
      update public.ai_credit_wallets set bonus_credits = bonus_credits - v_take, updated_at = now()
       where user_id = p_user_id returning * into v_wallet;
    end if;
    v_balance := greatest(0, coalesce(v_wallet.included_monthly_credits, 0) - coalesce(v_wallet.included_credits_used, 0))
               + coalesce(v_wallet.bonus_credits, 0);
  end if;

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (p_user_id, -v_take, 'admin_adjustment', 'razorpay_refund', p_reference, 'bonus', v_balance, p_idempotency_key,
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('credits', p_credits, 'clawedBack', v_take, 'shortfall', p_credits - v_take));

  return jsonb_build_object('ok', true, 'idempotent', false, 'clawedBack', v_take, 'shortfall', p_credits - v_take, 'balance', v_balance);
end;
$$;

revoke all on function public.mm_ai_take_back_refunded_credits(text, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mm_ai_take_back_refunded_credits(text, integer, text, text, jsonb) to service_role;
