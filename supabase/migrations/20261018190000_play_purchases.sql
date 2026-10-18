-- Google Play in-app purchases, server side (owner decision 18 Oct 2026: the Android app sells Pro and credit packs through
-- Google Play Billing; a Play purchase grants exactly what the matching web purchase grants, in the same tables).
-- NOT APPLIED to production by the branch that wrote it; the main session applies it under the owner's grant.
--
--   public.play_purchases        one row per Google Play purchase token: who bought what, what was granted, when it was
--                                acknowledged or consumed, and whether Google later voided it (refund, chargeback).
--                                purchase_token is unique, so a replayed verify can never grant twice and a token cannot be
--                                claimed by a second account. Server only: RLS on, no browser policy, no browser grants.
--   public.mm_play_grant_purchase   atomic grant: the play_purchases row and the entitlement in ONE transaction.
--                                Pro: users.is_premium / subscription_status / premium_until (never shortened), exactly the
--                                columns the web one-time Pro verify writes. Credit packs: the existing atomic
--                                mm_ai_grant_bonus_credits (reason pack_purchase), idempotency key 'play:<token>'.
--   public.mm_play_revoke_purchase  a voided purchase takes back what it granted: Pro off unless other paid evidence exists
--                                (the same rule as the web refund path), credit-pack bonus credits clawed back down to
--                                zero, never below. A void that arrives before the purchase was ever verified leaves a
--                                'voided' tombstone, so a late verify is refused.
--
-- Both functions are SECURITY DEFINER with a pinned search_path and executable by service_role only.
-- Idempotent. Undo: supabase/undo/20261018190000_play_purchases.undo.sql.

create table if not exists public.play_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_token text not null unique,
  order_id text,
  user_id text references public.users(id) on delete set null,
  product_id text,
  kind text check (kind in ('pro', 'ai_credits')),
  state text not null default 'granted' check (state in ('granted', 'voided')),
  access_until timestamptz,
  credits integer check (credits is null or credits > 0),
  granted jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  consumed_at timestamptz,
  voided_at timestamptz,
  revoked jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists play_purchases_user_state_idx on public.play_purchases (user_id, state);
create index if not exists play_purchases_order_idx on public.play_purchases (order_id) where order_id is not null;

alter table public.play_purchases enable row level security;
revoke all on public.play_purchases from public;
revoke all on public.play_purchases from anon;
revoke all on public.play_purchases from authenticated;
grant select, insert, update on public.play_purchases to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.mm_play_grant_purchase(
  p_user_id text,
  p_purchase_token text,
  p_order_id text,
  p_product_id text,
  p_kind text,
  p_credits integer,
  p_access_until timestamptz,
  p_raw jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.play_purchases%rowtype;
  v_user public.users%rowtype;
  v_grant jsonb;
  v_prev_until timestamptz;
  v_new_until timestamptz;
  v_duplicate boolean;
  v_granted jsonb;
begin
  if coalesce(p_user_id, '') = '' or coalesce(p_purchase_token, '') = '' or coalesce(p_product_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_field');
  end if;
  if p_kind is null or p_kind not in ('pro', 'ai_credits') then
    return jsonb_build_object('ok', false, 'error', 'invalid_kind');
  end if;
  if p_kind = 'ai_credits' and (p_credits is null or p_credits <= 0) then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_kind = 'pro' and p_access_until is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_access');
  end if;

  -- One verify per token at a time: a second call waits here, then sees the first one's row.
  perform pg_advisory_xact_lock(hashtextextended('play_purchase:' || p_purchase_token, 0));

  select * into v_row from public.play_purchases where purchase_token = p_purchase_token;
  if found then
    if v_row.state = 'voided' then
      return jsonb_build_object('ok', false, 'error', 'purchase_voided');
    end if;
    if v_row.user_id is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'purchase_already_used');
    end if;
    if v_row.product_id is distinct from p_product_id then
      return jsonb_build_object('ok', false, 'error', 'product_mismatch');
    end if;
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'kind', v_row.kind, 'productId', v_row.product_id, 'granted', v_row.granted,
      'acknowledgedAt', v_row.acknowledged_at, 'consumedAt', v_row.consumed_at
    );
  end if;

  select * into v_user from public.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  insert into public.play_purchases (purchase_token, order_id, user_id, product_id, kind, state, access_until, credits, raw)
  values (p_purchase_token, nullif(p_order_id, ''), p_user_id, p_product_id, p_kind, 'granted',
          case when p_kind = 'pro' then p_access_until end,
          case when p_kind = 'ai_credits' then p_credits end,
          coalesce(p_raw, '{}'::jsonb));

  if p_kind = 'pro' then
    v_prev_until := v_user.premium_until;
    -- Already Pro for at least as long (for example bought on the web): the purchase is still recorded and acknowledged,
    -- and flagged so the owner can refund the double purchase in Play Console.
    v_duplicate := v_prev_until is not null and v_prev_until > now() and v_prev_until >= p_access_until;
    v_new_until := greatest(coalesce(v_prev_until, p_access_until), p_access_until);
    update public.users
       set is_premium = true,
           subscription_status = 'active',
           premium_until = v_new_until
     where id = p_user_id;
    v_granted := jsonb_build_object('kind', 'pro', 'accessUntil', p_access_until, 'premiumUntil', v_new_until,
                                    'duplicatePro', v_duplicate);
  else
    v_grant := public.mm_ai_grant_bonus_credits(
      p_user_id, p_credits, 'pack_purchase', coalesce(nullif(p_order_id, ''), left(p_purchase_token, 64)),
      'play:' || p_purchase_token,
      jsonb_build_object('source', 'google_play', 'productId', p_product_id, 'orderId', p_order_id)
    );
    if not coalesce((v_grant ->> 'ok')::boolean, false) then
      -- Rolls the play_purchases row back with it: nothing is half granted.
      raise exception 'play_credit_grant_failed: %', coalesce(v_grant ->> 'error', 'unknown');
    end if;
    v_granted := jsonb_build_object('kind', 'ai_credits', 'credits', p_credits, 'balance', (v_grant ->> 'balance')::integer);
  end if;

  update public.play_purchases set granted = v_granted, updated_at = now() where purchase_token = p_purchase_token;

  return jsonb_build_object('ok', true, 'idempotent', false, 'kind', p_kind, 'productId', p_product_id, 'granted', v_granted);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
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
    -- Voided before it was ever verified: leave a tombstone so a late verify of this token is refused.
    insert into public.play_purchases (purchase_token, order_id, state, voided_at, revoked, raw)
    values (p_purchase_token, nullif(p_order_id, ''), 'voided', now(),
            jsonb_build_object('reason', p_reason, 'tombstone', true), coalesce(p_raw, '{}'::jsonb));
    return jsonb_build_object('ok', true, 'found', false, 'tombstone', true);
  end if;

  if v_row.state = 'voided' then
    return jsonb_build_object('ok', true, 'found', true, 'idempotent', true, 'kind', v_row.kind);
  end if;

  if v_row.kind = 'pro' then
    -- The web refund rule: Pro stays when the student has other paid evidence (a captured Razorpay payment, or another
    -- Play Pro purchase that is still in force); otherwise Pro is switched off.
    select exists (
             select 1 from public.payments
              where user_id = v_row.user_id and payment_id is not null and amount_paid > 0
                and status in ('captured', 'completed', 'paid')
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
      -- Only purchased (bonus) credits can be taken back, and never more than the wallet still holds.
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

revoke all on function public.mm_play_grant_purchase(text, text, text, text, text, integer, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.mm_play_grant_purchase(text, text, text, text, text, integer, timestamptz, jsonb) to service_role;
revoke all on function public.mm_play_revoke_purchase(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mm_play_revoke_purchase(text, text, text, jsonb) to service_role;
