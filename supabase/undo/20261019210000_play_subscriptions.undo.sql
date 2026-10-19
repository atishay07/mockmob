-- Undo for supabase/migrations/20261019210000_play_subscriptions.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Order: deploy code that does not sell the subscription (or switch PLAY_BILLING_ENABLED off) first, then run this.
--
-- 1. mm_play_sync_subscription is dropped.
-- 2. mm_play_revoke_purchase goes back to its 20261018190000 text.
-- 3. The subscription columns and the widened kind check are removed ONLY while no subscription row exists. Once a real
--    subscription is recorded, the row is the only link between a Google order and what the student was given, so the
--    columns stay (a NOTICE says so) and the operator decides by hand.
-- Nothing here touches users, payments or the credit tables, so what was already granted stays.

drop function if exists public.mm_play_sync_subscription(text, text, text, text, timestamptz, boolean, text, text, text, jsonb, text);

create or replace function public.mm_play_revoke_purchase(
  p_purchase_token text,
  p_reason text default 'voided',
  p_order_id text default null,
  p_raw jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.play_purchases%rowtype;
  v_wallet public.ai_credit_wallets%rowtype;
  v_take integer;
  v_other_paid boolean;
  v_balance integer;
  v_revoked jsonb;
begin
  if coalesce(p_purchase_token, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_field');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('play_purchase:' || p_purchase_token, 0));

  select * into v_row from public.play_purchases where purchase_token = p_purchase_token for update;
  if not found then
    insert into public.play_purchases (purchase_token, order_id, state, voided_at, revoked, raw)
    values (p_purchase_token, nullif(p_order_id, ''), 'voided', now(),
            jsonb_build_object('reason', p_reason, 'tombstone', true), coalesce(p_raw, '{}'::jsonb));
    return jsonb_build_object('ok', true, 'found', false, 'tombstone', true);
  end if;

  if v_row.state = 'voided' then
    return jsonb_build_object('ok', true, 'found', true, 'idempotent', true, 'kind', v_row.kind);
  end if;

  if v_row.kind = 'pro' then
    select exists (
             select 1 from public.payments
              where user_id = v_row.user_id and payment_id is not null and amount_paid > 0
                and status in ('captured', 'completed', 'paid')
                and plan_id like 'pro\_%'
           ) or exists (
             select 1 from public.play_purchases
              where user_id = v_row.user_id and kind = 'pro' and state = 'granted' and id <> v_row.id
           )
      into v_other_paid;
    if not v_other_paid then
      update public.users
         set is_premium = false, subscription_status = 'cancelled', premium_until = null
       where id = v_row.user_id;
    end if;
    v_revoked := jsonb_build_object('kind', 'pro', 'reason', p_reason, 'proSwitchedOff', not v_other_paid,
                                    'keptForOtherPaidAccess', v_other_paid);
  elsif v_row.kind = 'ai_credits' then
    select * into v_wallet from public.ai_credit_wallets where user_id = v_row.user_id for update;
    v_take := 0;
    if found then
      v_take := least(coalesce(v_wallet.bonus_credits, 0), coalesce(v_row.credits, 0));
      if v_take > 0 then
        update public.ai_credit_wallets set bonus_credits = bonus_credits - v_take, updated_at = now()
         where user_id = v_row.user_id returning * into v_wallet;
        v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits;
        insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
        values (v_row.user_id, -v_take, 'admin_adjustment', 'play_refund',
                coalesce(v_row.order_id, left(v_row.purchase_token, 64)), 'bonus', v_balance,
                'play_void:' || v_row.purchase_token,
                jsonb_build_object('source', 'google_play', 'productId', v_row.product_id, 'reason', p_reason,
                                   'credits', v_row.credits, 'shortfall', v_row.credits - v_take));
      end if;
    end if;
    v_revoked := jsonb_build_object('kind', 'ai_credits', 'reason', p_reason, 'credits', v_row.credits,
                                    'clawedBack', v_take, 'shortfall', coalesce(v_row.credits, 0) - v_take);
  end if;

  update public.play_purchases
     set state = 'voided', voided_at = now(), revoked = v_revoked,
         raw = raw || jsonb_build_object('voided', coalesce(p_raw, '{}'::jsonb)), updated_at = now()
   where id = v_row.id;

  return jsonb_build_object('ok', true, 'found', true, 'idempotent', false, 'kind', v_row.kind, 'revoked', v_revoked);
end;
$$;

revoke all on function public.mm_play_revoke_purchase(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mm_play_revoke_purchase(text, text, text, jsonb) to service_role;

do $$
begin
  if to_regclass('public.play_purchases') is null then
    return;
  end if;
  if exists (select 1 from public.play_purchases where kind = 'pro_sub') then
    raise notice 'play_purchases holds Play subscription rows: the subscription columns and the kind check are kept. Export them, then remove by hand if really wanted.';
    return;
  end if;
  drop index if exists public.play_purchases_linked_idx;
  drop index if exists public.play_purchases_user_kind_until_idx;
  alter table public.play_purchases drop constraint if exists play_purchases_kind_check;
  alter table public.play_purchases add constraint play_purchases_kind_check check (kind in ('pro', 'ai_credits'));
  alter table public.play_purchases
    drop column if exists sub_state,
    drop column if exists expiry_time,
    drop column if exists auto_renewing,
    drop column if exists base_plan_id,
    drop column if exists linked_purchase_token,
    drop column if exists superseded_by,
    drop column if exists superseded_at,
    drop column if exists last_synced_at;
end;
$$;
