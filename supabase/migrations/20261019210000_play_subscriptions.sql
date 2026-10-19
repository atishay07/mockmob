-- Google Play subscriptions (owner decision 19 Oct 2026, D135/D136): Play sells Pro as the monthly auto-renewing
-- subscription `pro_monthly` (base plan `monthly`, Rs 149 a month). Needs 20261018190000_play_purchases (play_purchases,
-- mm_play_grant_purchase, mm_play_revoke_purchase), which is already on production.
-- NOT APPLIED to production by the branch that wrote it; the main session applies it under the owner's grant.
--
--   public.play_purchases           gains the subscription columns: Google's state, expiry time and auto-renew flag, the
--                                   token it replaces (linkedPurchaseToken) and, on a replaced row, the token that
--                                   replaced it. kind 'pro_sub' marks a subscription row. access_until is the date Pro
--                                   runs to from this row: the expiryTime while Google says it is in force, otherwise a
--                                   date no later than now, so a row out of force never counts as paid access.
--   public.mm_play_sync_subscription   writes Google's current record of one subscription (from verify or from a Real-time
--                                   Developer Notification, always re-read from Google) and, in the same transaction,
--                                   the user's plan columns. It weighs the student's other paid access (a Razorpay Pro
--                                   payment still running, another Play Pro in force, a premium_until set by something
--                                   else), so Play and Razorpay never switch each other off. Idempotent per token.
--   public.mm_play_revoke_purchase  replaced: a Play subscription in force now also counts as other paid access, and a
--                                   manual revoke of a subscription row takes it out of force.
--
-- SECURITY DEFINER with a pinned search_path; executable by service_role only; RLS stays on with no browser policy.
-- Idempotent. Undo: supabase/undo/20261019210000_play_subscriptions.undo.sql.

alter table public.play_purchases add column if not exists sub_state text;
alter table public.play_purchases add column if not exists expiry_time timestamptz;
alter table public.play_purchases add column if not exists auto_renewing boolean;
alter table public.play_purchases add column if not exists base_plan_id text;
alter table public.play_purchases add column if not exists linked_purchase_token text;
alter table public.play_purchases add column if not exists superseded_by text;
alter table public.play_purchases add column if not exists superseded_at timestamptz;
alter table public.play_purchases add column if not exists last_synced_at timestamptz;

alter table public.play_purchases drop constraint if exists play_purchases_kind_check;
alter table public.play_purchases add constraint play_purchases_kind_check check (kind in ('pro', 'ai_credits', 'pro_sub'));

create index if not exists play_purchases_linked_idx on public.play_purchases (linked_purchase_token) where linked_purchase_token is not null;
create index if not exists play_purchases_user_kind_until_idx on public.play_purchases (user_id, kind, access_until);

-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.mm_play_sync_subscription(
  p_user_id text,                 -- the signed-in student from verify, or the owner a replacement token is bound to; null from a notification about a known token
  p_purchase_token text,
  p_product_id text,
  p_state text,                   -- Google subscriptionState, e.g. SUBSCRIPTION_STATE_ACTIVE
  p_expiry timestamptz,           -- the line item's expiryTime
  p_auto_renewing boolean,
  p_linked_token text,            -- linkedPurchaseToken (or outOfAppPurchaseContext.expiredPurchaseToken): the token this one replaces
  p_order_id text,
  p_base_plan_id text,
  p_raw jsonb default '{}'::jsonb,
  p_reason text default null      -- 'revoked' or 'voided' when that is why Google was asked; recorded
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_row public.play_purchases%rowtype;
  v_found boolean;
  v_owner text;
  v_user public.users%rowtype;
  v_entitled boolean;
  v_prev_own timestamptz;
  v_own_until timestamptz;
  v_other timestamptz;
  v_legacy_payment boolean;
  v_until timestamptz;
  v_premium boolean;
  v_status text;
  v_new_until timestamptz;
  v_row_until timestamptz;
  v_superseded integer := 0;
  v_duplicate boolean := false;
  v_touch_user boolean := true;
  v_granted jsonb;
begin
  if coalesce(p_purchase_token, '') = '' or coalesce(p_product_id, '') = '' or coalesce(p_state, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_field');
  end if;

  -- One writer per token at a time; the token it replaces is locked next, always in this order (new, then old), before the
  -- user row, so two syncs can never wait on each other.
  perform pg_advisory_xact_lock(hashtextextended('play_purchase:' || p_purchase_token, 0));
  if coalesce(p_linked_token, '') <> '' and p_linked_token <> p_purchase_token then
    perform pg_advisory_xact_lock(hashtextextended('play_purchase:' || p_linked_token, 0));
  end if;

  select * into v_row from public.play_purchases where purchase_token = p_purchase_token for update;
  v_found := found;
  if v_found then
    if v_row.state = 'voided' then
      return jsonb_build_object('ok', false, 'error', 'purchase_voided');
    end if;
    if v_row.kind is distinct from 'pro_sub' or v_row.product_id is distinct from p_product_id then
      return jsonb_build_object('ok', false, 'error', 'product_mismatch');
    end if;
    if p_user_id is not null and v_row.user_id is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'purchase_already_used');
    end if;
    if v_row.user_id is null then
      return jsonb_build_object('ok', false, 'error', 'user_not_found'); -- the account was deleted
    end if;
    v_owner := v_row.user_id;
    v_prev_own := v_row.access_until;
  else
    if coalesce(p_user_id, '') = '' then
      return jsonb_build_object('ok', false, 'error', 'unknown_purchase');
    end if;
    v_owner := p_user_id;
  end if;

  -- Google's entitlement rule: access while ACTIVE, IN_GRACE_PERIOD or CANCELED, up to expiryTime. A replaced row never
  -- gives access again (its replacement does).
  v_entitled := p_state in ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED')
                and p_expiry is not null and p_expiry > v_now
                and coalesce(p_reason, '') <> 'revoked'
                and (not v_found or v_row.superseded_by is null);

  if not v_found and not v_entitled then
    -- Nothing to record: a token we never granted that does not give access now.
    return jsonb_build_object('ok', true, 'recorded', false, 'entitled', false, 'isPremium', null, 'state', p_state);
  end if;

  select * into v_user from public.users where id = v_owner for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  -- The token this one replaces (upgrade, downgrade, resubscribe) stops counting: one subscription, one row in force.
  if coalesce(p_linked_token, '') <> '' and p_linked_token <> p_purchase_token and v_entitled then
    update public.play_purchases
       set superseded_by = p_purchase_token, superseded_at = coalesce(superseded_at, v_now),
           access_until = least(coalesce(access_until, v_now), v_now), updated_at = v_now
     where purchase_token = p_linked_token and user_id = v_owner and kind = 'pro_sub' and superseded_by is null;
    get diagnostics v_superseded = row_count;
  end if;

  v_own_until := case when v_entitled then p_expiry end;
  v_row_until := case when v_entitled then p_expiry else least(coalesce(p_expiry, v_now), v_now) end;

  -- Other paid access in force now. Play: any other Pro row still running. Razorpay: a captured Pro payment still running
  -- (the same evidence the web refund path uses, plan_id 'pro_...').
  select max(access_until) into v_other
    from public.play_purchases
   where user_id = v_owner and purchase_token <> p_purchase_token and kind in ('pro', 'pro_sub')
     and state = 'granted' and superseded_by is null and access_until > v_now;
  v_other := greatest(v_other, (
    select max(access_until) from public.payments
     where user_id = v_owner and payment_id is not null and amount_paid > 0
       and status in ('captured', 'completed', 'paid') and plan_id like 'pro\_%' and access_until > v_now));
  select exists (
    select 1 from public.payments
     where user_id = v_owner and payment_id is not null and amount_paid > 0
       and status in ('captured', 'completed', 'paid') and plan_id like 'pro\_%' and access_until is null
  ) into v_legacy_payment;
  -- premium_until set by something other than this row (a web plan, an older record) also stands: it is later than
  -- anything this row ever gave, or this row never gave anything yet, or a paid record without a date backs it. A date
  -- that is exactly one of this student's Play subscription expiry times came from Play, and Play rows speak for themselves.
  if v_user.premium_until is not null and v_user.premium_until > v_now
     and (v_legacy_payment or v_prev_own is null or v_user.premium_until > v_prev_own)
     and not exists (select 1 from public.play_purchases
                      where user_id = v_owner and kind = 'pro_sub' and expiry_time = v_user.premium_until) then
    v_other := greatest(v_other, v_user.premium_until);
  end if;
  -- Pro with no end date at all (an older grant outside Play): this row never touches it.
  if coalesce(v_user.is_premium, false) and v_user.premium_until is null then
    v_touch_user := false;
  end if;

  v_until := greatest(v_own_until, v_other);
  v_premium := v_until is not null and v_until > v_now;
  v_duplicate := not v_found and v_entitled and v_other is not null and v_other >= p_expiry;

  if v_premium then
    v_new_until := v_until;
    if v_own_until is not null and (v_other is null or v_own_until >= v_other) then
      -- This subscription is what the student's Pro runs on: its status word follows Google.
      v_status := case p_state
                    when 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' then 'past_due'
                    when 'SUBSCRIPTION_STATE_CANCELED' then 'cancelled'
                    else 'active' end;
    else
      -- Other paid access covers the student: its own status word stays.
      v_status := case when v_user.subscription_status in ('active', 'cancelled', 'past_due') then v_user.subscription_status else 'active' end;
    end if;
  else
    v_status := case when p_state = 'SUBSCRIPTION_STATE_ON_HOLD' then 'past_due' else 'cancelled' end;
    -- The date Pro ended stays on record ("ended on ..."); a revoke clears it, like the web refund path.
    v_new_until := case when coalesce(p_reason, '') = 'revoked' then null else v_row_until end;
  end if;

  if v_touch_user then
    update public.users
       set is_premium = v_premium, subscription_status = v_status, premium_until = v_new_until
     where id = v_owner;
  end if;

  v_granted := jsonb_build_object('kind', 'pro_sub', 'entitled', v_entitled, 'premiumUntil', case when v_touch_user then v_new_until else null end,
                                  'isPremium', case when v_touch_user then v_premium else true end, 'duplicatePro', v_duplicate,
                                  'state', p_state, 'syncedAt', v_now);

  if v_found then
    update public.play_purchases
       set sub_state = p_state, expiry_time = p_expiry, auto_renewing = p_auto_renewing,
           access_until = v_row_until,
           order_id = coalesce(nullif(p_order_id, ''), order_id),
           base_plan_id = coalesce(nullif(p_base_plan_id, ''), base_plan_id),
           linked_purchase_token = coalesce(nullif(p_linked_token, ''), linked_purchase_token),
           granted = granted || v_granted,
           revoked = case when coalesce(p_reason, '') in ('revoked', 'voided')
                          then coalesce(revoked, '{}'::jsonb) || jsonb_build_object('reason', p_reason, 'at', v_now, 'proSwitchedOff', not v_premium)
                          else revoked end,
           raw = coalesce(p_raw, '{}'::jsonb), last_synced_at = v_now, updated_at = v_now
     where id = v_row.id;
  else
    insert into public.play_purchases (purchase_token, order_id, user_id, product_id, kind, state, access_until, granted, raw,
                                       sub_state, expiry_time, auto_renewing, base_plan_id, linked_purchase_token, last_synced_at)
    values (p_purchase_token, nullif(p_order_id, ''), v_owner, p_product_id, 'pro_sub', 'granted', v_row_until, v_granted,
            coalesce(p_raw, '{}'::jsonb), p_state, p_expiry, p_auto_renewing, nullif(p_base_plan_id, ''), nullif(p_linked_token, ''), v_now);
  end if;

  return jsonb_build_object(
    'ok', true, 'recorded', true, 'idempotent', v_found, 'entitled', v_entitled,
    'isPremium', case when v_touch_user then v_premium else true end,
    'premiumUntil', case when v_touch_user then v_new_until else null end,
    'keptForOtherPaidAccess', (not v_entitled) and v_premium,
    'duplicatePro', v_duplicate, 'superseded', v_superseded, 'state', p_state
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- mm_play_revoke_purchase, as in 20261018190000 with two changes: a Play subscription in force counts as other paid Pro
-- access, and a revoke of a subscription row (by hand) takes the row out of force before Pro is weighed.
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

  if v_row.kind in ('pro', 'pro_sub') then
    -- The web refund rule: Pro stays when the student has other paid PRO evidence (a captured Razorpay payment for a Pro plan,
    -- plan_id 'pro_...', another one-time Play Pro, or a Play subscription still in force); otherwise Pro is switched off.
    -- A credit-pack payment bought credits, not Pro, so it never keeps Pro (release 10 verifier M1).
    select exists (
             select 1 from public.payments
              where user_id = v_row.user_id and payment_id is not null and amount_paid > 0
                and status in ('captured', 'completed', 'paid')
                and plan_id like 'pro\_%'
           ) or exists (
             select 1 from public.play_purchases
              where user_id = v_row.user_id and state = 'granted' and id <> v_row.id
                and (kind = 'pro' or (kind = 'pro_sub' and superseded_by is null and access_until > now()))
           )
      into v_other_paid;
    if not v_other_paid then
      update public.users
         set is_premium = false, subscription_status = 'cancelled', premium_until = null
       where id = v_row.user_id;
    end if;
    v_revoked := jsonb_build_object('kind', v_row.kind, 'reason', p_reason, 'proSwitchedOff', not v_other_paid,
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
         access_until = case when kind = 'pro_sub' then least(coalesce(access_until, now()), now()) else access_until end,
         raw = raw || jsonb_build_object('voided', coalesce(p_raw, '{}'::jsonb)), updated_at = now()
   where id = v_row.id;

  return jsonb_build_object('ok', true, 'found', true, 'idempotent', false, 'kind', v_row.kind, 'revoked', v_revoked);
end;
$$;

revoke all on function public.mm_play_sync_subscription(text, text, text, text, timestamptz, boolean, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.mm_play_sync_subscription(text, text, text, text, timestamptz, boolean, text, text, text, jsonb, text) to service_role;
revoke all on function public.mm_play_revoke_purchase(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mm_play_revoke_purchase(text, text, text, jsonb) to service_role;
