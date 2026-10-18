-- One credits balance (owner, 18 Oct 2026, 6:50 pm, D78: "We are not creating two separate wallets for practice credits and AI
-- credits. There should be, in general, one credits option that can do multiple things.").
-- NOT applied on production by this branch. Staging dry-run and apply are recorded in docs/brain/STATUS.md.
--
-- The one balance a student sees = this month's free credits left (ai_credit_wallets.included_monthly_credits -
-- included_credits_used, after the IST-month sync) + bought/held credits (ai_credit_wallets.bonus_credits +
-- users.credit_balance). NOTHING is moved between tables: every paid thing (a practice set, a full mock, an AI reply) takes
-- its price in ONE order through one internal function, public.mm_wallet_take:
--   (a) this month's free credits, (b) ai_credit_wallets.bonus_credits, (c) users.credit_balance. It never goes negative.
--
-- What this file changes:
--   1. New public.mm_wallet_window(timestamptz): the IST calendar month (period_start, reset_at). It is the same expression
--      mm_ai_grant_bonus_credits already uses and equals src/services/credits/aiWalletState.js walletWindow() (UTC+05:30, no
--      DST in Asia/Kolkata): data/tests/one_credits_balance.test.mjs checks the two agree on month edges.
--   2. New public.mm_wallet_take(user, amount, period_start, reset_at, allowance): locks users then ai_credit_wallets (lock
--      order users -> wallet everywhere), creates the wallet row if missing, syncs the period and allowance exactly as
--      mm_ai_consume_credits did, checks the total and takes the amount in the order above. Returns the three parts.
--   3. public.spend_credits keeps its signature, pricing CASE, idempotency and ledger row; it now takes the price through
--      mm_wallet_take with the IST month of now() and allowance 50 (= AI_FREE_MONTHLY_CREDITS = AI_PRO_INCLUDED_MONTHLY_CREDITS
--      in src/services/credits/aiCreditWallet.js; the test asserts the equality). credit_transactions keeps the total in
--      amount / credit_delta and records the parts in a new nullable jsonb column, parts = {included, bonus, balance}.
--      start_learning_session / start_recovery_session are NOT touched: an unpaid start still leaves no session.
--   4. mm_ai_consume_credits and mm_ai_reserve_credits take through mm_wallet_take, so AI can use bonus and practice/held
--      credits once the month's free ones run out. Idempotency is unchanged. ai_credit_reservations gets a nullable
--      from_balance column; the split check becomes from_included + from_bonus + coalesce(from_balance, 0) = amount.
--      mm_ai_release_credits gives every part back to where it came from (the free part to the free credits in the same
--      month, else to bonus credits as before; the balance part to users.credit_balance). Commit (settle) is unchanged.
--      The ledger records balanceSpent / balanceRestored, and ai_credit_ledger.wallet_source may now say 'balance'.
--   5. reserve_runtime_ai (CTO, 18 Oct 2026, 7:08 pm): the per-user monthly USD cap (student_user_free / student_user_paid)
--      now covers the free monthly allowance only. Each AI credit paid this IST month from bought/held credits (bonus or
--      users.credit_balance part of a reservation or spend that was not released) raises that student's cap by the USD in the
--      new runtime_ai_budget row 'student_held_credit' (monthly_cap_usd = USD per held credit, 0.02). So a student who buys credits
--      is never refused by the cap for what they paid for, a free-only student is capped exactly as before, a failed call
--      (credit released, provider reservation kept) still eats into the cap, and each held credit can add at most that bound.
--      Everything else in reserve_runtime_ai (model allowlist, global cap, idempotency, price check) is production's.
--
-- Production before this migration (read-only pg_proc, 18 Oct 2026):
--   spend_credits(text,text,text)                            md5(prosrc) 911105fda93f7c1dcd687b08dd7c1059  length 1666
--   mm_ai_consume_credits(text,integer,text,text,text,integer,timestamptz,timestamptz,jsonb)
--                                                            md5(prosrc) c1ce92df1577794e2e49a54d82a0fd42  length 4144
--   mm_ai_reserve_credits(text,integer,text,text,integer,timestamptz,timestamptz,jsonb)
--                                                            md5(prosrc) 499b44d19273c8901b11d65f0874e9fc  length 4149
--   mm_ai_release_credits(text,text)                         md5(prosrc) 9c1d744b969d7e52c74d06e5537110f5  length 2211
--   reserve_runtime_ai(text,text,text,integer,integer,text,text)
--                                                            md5(prosrc) f6026ff6dde4b329e6f021dae3b51b7a  length 2404
--   mm_wallet_take / mm_wallet_window / mm_held_ai_credits_spent: absent. runtime_ai_budget 'student_held_credit': absent.
-- Undo: supabase/undo/20261018210000_one_credits_balance.undo.sql restores those exact bodies (code first, see its header).

-- ---- schema: two nullable columns, two widened checks, one budget row ------------------------------------------------
alter table public.credit_transactions add column if not exists parts jsonb;
comment on column public.credit_transactions.parts is 'Where a spend came from (one credits balance, 18 Oct 2026): {"included": free credits this month, "bonus": ai bonus credits, "balance": users.credit_balance}. Null on rows written before.';

alter table public.ai_credit_reservations add column if not exists from_balance integer;
alter table public.ai_credit_reservations drop constraint if exists ai_credit_reservations_from_balance_check;
alter table public.ai_credit_reservations add constraint ai_credit_reservations_from_balance_check check (from_balance is null or from_balance >= 0);
alter table public.ai_credit_reservations drop constraint if exists ai_credit_reservations_split;
alter table public.ai_credit_reservations add constraint ai_credit_reservations_split check (from_included + from_bonus + coalesce(from_balance, 0) = amount);

alter table public.ai_credit_ledger drop constraint if exists ai_credit_ledger_wallet_source_check;
alter table public.ai_credit_ledger add constraint ai_credit_ledger_wallet_source_check
  check (wallet_source in ('included', 'bonus', 'balance', 'mixed', 'grant', 'adjustment', 'none'));

-- USD 0.02 per held credit (CTO, 18 Oct 2026, 11 pm). One charged reply makes at most 2 physical provider calls
-- (src/services/ai/providerCore.js MAX_PHYSICAL_CALLS: the primary, then one JSON retry or fallback), each reserved at its
-- bound before it is sent. Production runtime_ai_requests (read-only, 18 Oct 2026): the largest single reservation for a
-- runtime model (gpt-6-luna, 9 rows) is USD 0.00237 (p99 0.00236, p50 0.00194); the largest of any model ever 0.002536;
-- the largest actual cost 0.00048. The largest the code can reserve is about USD 0.0045 per call (12 KB context + prompt +
-- message, about 30 KB in; 2,000 visible + 1,000 reasoning tokens out, at USD 0.10 / 0.50 per million), so 0.009 a reply.
-- 0.02 covers one such reply twice over: a reply paid from held credits at the very edge of the cap dispatches both calls,
-- and so does the next one even after a failed reply there (a failed reply releases its credit, so it no longer raises the
-- cap, while its provider reservations keep counting). A larger value never makes anything cost more: it only lifts the
-- cap, the credit is taken per reply, each call is bounded by its own reservation, and the free credits are always spent
-- first in a month, so this headroom serves replies paid from bought/held credits (and at most the few free credits a
-- failed reply gives back).
-- (Drafts: 0.005, exactly 2 x 0.002536, which a 2-call reply could exceed; then 0.01, which one failed reply at the edge
-- could use up for the next.)
-- do update: this file is the source of the value (staging took the 0.005 draft; production has no row yet).
insert into public.runtime_ai_budget(id, monthly_cap_usd) values ('student_held_credit', 0.02)
  on conflict (id) do update set monthly_cap_usd = excluded.monthly_cap_usd;

-- ---- the IST month ---------------------------------------------------------------------------------------------------
create or replace function public.mm_wallet_window(p_at timestamp with time zone, out period_start timestamp with time zone, out reset_at timestamp with time zone)
 language sql
 stable
 set search_path to ''
as $function$
  select date_trunc('month', timezone('Asia/Kolkata', p_at)) at time zone 'Asia/Kolkata',
         (date_trunc('month', timezone('Asia/Kolkata', p_at)) + interval '1 month') at time zone 'Asia/Kolkata'
$function$;

-- ---- the one spend order ---------------------------------------------------------------------------------------------
create or replace function public.mm_wallet_take(p_user_id text, p_amount integer, p_period_start timestamp with time zone, p_reset_at timestamp with time zone, p_allowance integer,
  out ok boolean, out error_code text, out take_included integer, out take_bonus integer, out take_balance integer,
  out left_included integer, out left_bonus integer, out left_balance integer, out left_total integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_allow integer := greatest(0, coalesce(p_allowance, 50));
  v_wallet public.ai_credit_wallets%rowtype;
  v_balance integer;
begin
  ok := false; take_included := 0; take_bonus := 0; take_balance := 0;
  if p_user_id is null or p_user_id = '' then error_code := 'missing_user'; return; end if;
  if p_amount is null or p_amount < 0 then error_code := 'invalid_amount'; return; end if;
  if p_period_start is null or p_reset_at is null then error_code := 'missing_period'; return; end if;

  -- Lock order everywhere: the users row, then the wallet row.
  select u.credit_balance into v_balance from public.users u where u.id = p_user_id for update;
  if not found then error_code := 'user_not_found'; return; end if;
  v_balance := greatest(0, coalesce(v_balance, 0));

  insert into public.ai_credit_wallets (user_id, included_monthly_credits, included_credits_used, bonus_credits, period_start, reset_at)
  values (p_user_id, v_allow, 0, 0, p_period_start, p_reset_at)
  on conflict (user_id) do nothing;

  select * into v_wallet from public.ai_credit_wallets w where w.user_id = p_user_id for update;
  if not found then error_code := 'wallet_not_found'; return; end if;

  -- The period and allowance sync, exactly as mm_ai_consume_credits did it.
  if v_wallet.period_start < p_period_start then
    update public.ai_credit_wallets w
       set included_monthly_credits = v_allow, included_credits_used = 0, period_start = p_period_start, reset_at = p_reset_at, updated_at = now()
     where w.user_id = p_user_id
     returning * into v_wallet;
  elsif v_wallet.included_monthly_credits <> v_allow then
    update public.ai_credit_wallets w
       set included_monthly_credits = v_allow, included_credits_used = least(v_wallet.included_credits_used, v_allow), updated_at = now()
     where w.user_id = p_user_id
     returning * into v_wallet;
  end if;

  left_included := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used);
  left_bonus := greatest(0, v_wallet.bonus_credits);
  left_balance := v_balance;
  left_total := left_included + left_bonus + left_balance;

  if left_total < p_amount then error_code := 'insufficient'; return; end if;

  take_included := least(left_included, p_amount);
  take_bonus := least(left_bonus, p_amount - take_included);
  take_balance := p_amount - take_included - take_bonus;

  if take_included > 0 or take_bonus > 0 then
    update public.ai_credit_wallets w
       set included_credits_used = w.included_credits_used + take_included, bonus_credits = w.bonus_credits - take_bonus, updated_at = now()
     where w.user_id = p_user_id;
  end if;
  if take_balance > 0 then
    update public.users u set credit_balance = u.credit_balance - take_balance where u.id = p_user_id;
  end if;

  left_included := left_included - take_included;
  left_bonus := left_bonus - take_bonus;
  left_balance := left_balance - take_balance;
  left_total := left_included + left_bonus + left_balance;
  ok := true;
end;
$function$;

-- ---- AI credits paid from bought/held credits this month (for the per-user USD cap) -----------------------------------
create or replace function public.mm_held_ai_credits_spent(p_user_id text, p_since timestamp with time zone)
 returns integer
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select (
    coalesce((select sum(r.from_bonus + coalesce(r.from_balance, 0)) from public.ai_credit_reservations r
               where r.user_id = p_user_id and r.created_at >= p_since and r.state <> 'released'), 0)
    + coalesce((select sum(coalesce((l.metadata->>'bonusSpent')::integer, 0) + coalesce((l.metadata->>'balanceSpent')::integer, 0)) from public.ai_credit_ledger l
               where l.user_id = p_user_id and l.created_at >= p_since and l.reason = 'ai_spend'), 0)
  )::integer
$function$;

-- ---- practice: spend_credits ------------------------------------------------------------------------------------------
create or replace function public.spend_credits(p_user_id text, p_action text, p_reference text)
 returns boolean
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_amount INTEGER;
  v_window RECORD;
  v_take RECORD;
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

  -- One balance: this month's free credits, then bonus credits, then users.credit_balance. The month is the IST month and
  -- the allowance is 50, the same values the server sends for AI (aiCreditWallet.js AI_FREE_MONTHLY_CREDITS / AI_PRO_...).
  SELECT * INTO v_window FROM public.mm_wallet_window(now());
  SELECT * INTO v_take FROM public.mm_wallet_take(p_user_id, v_amount, v_window.period_start, v_window.reset_at, 50);

  IF v_take.error_code = 'user_not_found' THEN
    RAISE EXCEPTION 'user not found';
  END IF;
  IF v_take.error_code = 'insufficient' THEN
    RETURN FALSE;
  END IF;
  IF NOT v_take.ok THEN
    RAISE EXCEPTION 'credit spend failed: %', v_take.error_code;
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference, action, credit_delta, parts)
  VALUES (p_user_id, -v_amount, 'spend', p_reference, p_action, -v_amount,
          jsonb_build_object('included', v_take.take_included, 'bonus', v_take.take_bonus, 'balance', v_take.take_balance));

  RAISE LOG 'credit_change user_id=% action=% credit_delta=%', p_user_id, p_action, -v_amount;
  RETURN TRUE;
END;
$function$;

-- ---- AI: consume (charge-first features) ------------------------------------------------------------------------------
create or replace function public.mm_ai_consume_credits(p_user_id text, p_amount integer, p_action text, p_reference text, p_idempotency_key text, p_included_monthly_credits integer, p_period_start timestamp with time zone, p_reset_at timestamp with time zone, p_metadata jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_allow integer := greatest(0, coalesce(p_included_monthly_credits, 50));
  v_take record;
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

  select * into v_take from public.mm_wallet_take(p_user_id, p_amount, p_period_start, p_reset_at, v_allow);

  if v_take.error_code in ('user_not_found', 'wallet_not_found') then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;
  if v_take.error_code = 'insufficient' then
    return jsonb_build_object('ok', false, 'error', 'insufficient_ai_credits', 'balance', v_take.left_total, 'required', p_amount,
      'includedRemaining', v_take.left_included, 'bonusCredits', v_take.left_bonus, 'heldBalance', v_take.left_balance);
  end if;
  if not v_take.ok then
    return jsonb_build_object('ok', false, 'error', coalesce(v_take.error_code, 'take_failed'));
  end if;

  if p_amount = 0 then
    return jsonb_build_object('ok', true, 'charged', 0, 'balance', v_take.left_total, 'includedRemaining', v_take.left_included, 'bonusCredits', v_take.left_bonus, 'heldBalance', v_take.left_balance);
  end if;

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    p_user_id,
    -p_amount,
    'ai_spend',
    p_action,
    p_reference,
    case
      when (v_take.take_included > 0)::int + (v_take.take_bonus > 0)::int + (v_take.take_balance > 0)::int > 1 then 'mixed'
      when v_take.take_included > 0 then 'included'
      when v_take.take_bonus > 0 then 'bonus'
      when v_take.take_balance > 0 then 'balance'
      else 'none'
    end,
    v_take.left_total,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('includedSpent', v_take.take_included, 'bonusSpent', v_take.take_bonus, 'balanceSpent', v_take.take_balance)
  );

  return jsonb_build_object('ok', true, 'charged', p_amount, 'balance', v_take.left_total, 'includedRemaining', v_take.left_included, 'bonusCredits', v_take.left_bonus,
    'heldBalance', v_take.left_balance, 'includedSpent', v_take.take_included, 'bonusSpent', v_take.take_bonus, 'balanceSpent', v_take.take_balance, 'reference', p_reference);
end;
$function$;

-- ---- AI: reserve (Ask Mobi replies, Mistake Repair) -------------------------------------------------------------------
create or replace function public.mm_ai_reserve_credits(p_user_id text, p_amount integer, p_action text, p_operation_key text, p_included_monthly_credits integer, p_period_start timestamp with time zone, p_reset_at timestamp with time zone, p_metadata jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_existing public.ai_credit_reservations%rowtype;
  v_allow integer := greatest(0, coalesce(p_included_monthly_credits, 50));
  v_take record;
  v_period timestamp with time zone;
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

  -- Serialise this student's spends (users row first, as everywhere) before the idempotency check.
  perform 1 from public.users where id = p_user_id for update;
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

  select * into v_take from public.mm_wallet_take(p_user_id, p_amount, p_period_start, p_reset_at, v_allow);
  if v_take.error_code in ('user_not_found', 'wallet_not_found') then
    return jsonb_build_object('ok', false, 'error', 'wallet_not_found');
  end if;
  if v_take.error_code = 'insufficient' then
    return jsonb_build_object('ok', false, 'error', 'insufficient_ai_credits', 'balance', v_take.left_total, 'required', p_amount);
  end if;
  if not v_take.ok then
    return jsonb_build_object('ok', false, 'error', coalesce(v_take.error_code, 'take_failed'));
  end if;

  -- The reservation records the wallet's period after mm_wallet_take synced it (as production did), not the caller's
  -- p_period_start: if the server clock is behind at a month edge the two differ, and a release must compare like with like
  -- or it would turn the free part into bonus credits. The wallet row is locked by mm_wallet_take in this transaction.
  select w.period_start into v_period from public.ai_credit_wallets w where w.user_id = p_user_id;

  insert into public.ai_credit_reservations (user_id, operation_key, amount, action, from_included, from_bonus, from_balance, period_start)
  values (p_user_id, p_operation_key, p_amount, coalesce(p_action, 'ai'), v_take.take_included, v_take.take_bonus, v_take.take_balance, coalesce(v_period, p_period_start));

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    p_user_id, -p_amount, 'ai_reserve', coalesce(p_action, 'ai'), p_operation_key,
    case
      when (v_take.take_included > 0)::int + (v_take.take_bonus > 0)::int + (v_take.take_balance > 0)::int > 1 then 'mixed'
      when v_take.take_included > 0 then 'included'
      when v_take.take_bonus > 0 then 'bonus'
      else 'balance'
    end,
    v_take.left_total, 'reserve:' || p_operation_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('kind', 'reserve', 'includedSpent', v_take.take_included, 'bonusSpent', v_take.take_bonus, 'balanceSpent', v_take.take_balance)
  );

  return jsonb_build_object('ok', true, 'state', 'reserved', 'amount', p_amount, 'balance', v_take.left_total,
    'includedSpent', v_take.take_included, 'bonusSpent', v_take.take_bonus, 'balanceSpent', v_take.take_balance);
end;
$function$;

-- ---- AI: release (refund every part to where it came from) ------------------------------------------------------------
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
  v_to_balance integer;
  v_held integer;
  v_balance integer;
begin
  select * into v_res from public.ai_credit_reservations where operation_key = p_operation_key;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  end if;
  -- Lock order everywhere: users row, wallet row, then the reservation.
  perform 1 from public.users where id = v_res.user_id for update;
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
  v_to_balance := coalesce(v_res.from_balance, 0);

  update public.ai_credit_wallets
     set included_credits_used = greatest(0, included_credits_used - v_to_included),
         bonus_credits = bonus_credits + v_to_bonus,
         updated_at = now()
   where user_id = v_res.user_id
   returning * into v_wallet;

  if v_to_balance > 0 then
    update public.users set credit_balance = credit_balance + v_to_balance where id = v_res.user_id returning credit_balance into v_held;
  else
    select credit_balance into v_held from public.users where id = v_res.user_id;
  end if;

  update public.ai_credit_reservations
     set state = 'released', release_reason = left(coalesce(p_reason, 'released'), 200), updated_at = now()
   where id = v_res.id;

  v_balance := greatest(0, v_wallet.included_monthly_credits - v_wallet.included_credits_used) + v_wallet.bonus_credits + greatest(0, coalesce(v_held, 0));

  insert into public.ai_credit_ledger (user_id, amount, reason, feature, reference, wallet_source, balance_after, idempotency_key, metadata)
  values (
    v_res.user_id, v_res.amount, 'ai_release', v_res.action, p_operation_key, 'adjustment', v_balance, 'release:' || p_operation_key,
    jsonb_build_object('kind', 'release', 'includedRestored', v_to_included, 'bonusRestored', v_to_bonus, 'balanceRestored', v_to_balance, 'reason', left(coalesce(p_reason, 'released'), 200))
  );

  return jsonb_build_object('ok', true, 'state', 'released', 'restored', v_res.amount, 'balance', v_balance);
end;
$function$;

-- ---- runtime guard: the per-user USD cap covers the free allowance; held credits paid this month raise it ------------
create or replace function public.reserve_runtime_ai(p_key text, p_provider text, p_model text, p_input_bound integer, p_output_bound integer, p_user_id text default null::text, p_user_tier text default null::text)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare b public.runtime_ai_budget%rowtype;r public.runtime_ai_requests%rowtype;price public.runtime_ai_prices%rowtype;cost numeric;month_spend numeric;user_cap numeric;user_spend numeric;held_credit_usd numeric;
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
   -- One credits balance (18 Oct 2026): the cap above covers the free monthly allowance. AI credits this student paid this
   -- month from bought/held credits each add 'student_held_credit' USD. No row: the cap is exactly as before.
   select monthly_cap_usd into held_credit_usd from public.runtime_ai_budget where id='student_held_credit';
   if coalesce(held_credit_usd,0)>0 then
     user_cap=user_cap+public.mm_held_ai_credits_spent(p_user_id,public.runtime_ai_month_start())*held_credit_usd;
   end if;
   select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into user_spend
     from public.runtime_ai_requests where user_id=p_user_id and created_at>=public.runtime_ai_month_start();
   if user_spend+cost>user_cap then raise exception 'runtime user limit reached'; end if;
 end if;
 insert into public.runtime_ai_requests(request_key,provider,model,reserved_usd,user_id) values(p_key,p_provider,p_model,cost,p_user_id);
 update public.runtime_ai_budget set reserved_usd=reserved_usd+cost where id=b.id;
 return jsonb_build_object('dispatch',true,'reserved',cost,'inputRate',price.input_per_million,'outputRate',price.output_per_million);
end $function$;

-- ---- privileges: the new functions are server-only, like every credit function ---------------------------------------
revoke all on function public.mm_wallet_window(timestamp with time zone) from public, anon, authenticated;
revoke all on function public.mm_wallet_take(text, integer, timestamp with time zone, timestamp with time zone, integer) from public, anon, authenticated;
revoke all on function public.mm_held_ai_credits_spent(text, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.mm_wallet_window(timestamp with time zone) to service_role;
grant execute on function public.mm_wallet_take(text, integer, timestamp with time zone, timestamp with time zone, integer) to service_role;
grant execute on function public.mm_held_ai_credits_spent(text, timestamp with time zone) to service_role;
-- create or replace keeps the owner and grants of spend_credits, mm_ai_consume_credits, mm_ai_reserve_credits,
-- mm_ai_release_credits and reserve_runtime_ai (service_role only on production).
