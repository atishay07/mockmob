-- Practice credit reload packs (owner D76, 18 Oct 2026: a credits wallet on the website and the app, Razorpay wired by the owner).
-- Companion to src/lib/wallet/walletPacks.mjs (Rs 19 -> 100, Rs 49 -> 300), src/services/credits/practiceCreditWallet.js and
-- the wallet routes /api/wallet/order and /api/wallet/verify, and the Razorpay webhook (payment.captured).
-- NOT applied on production by this branch. Dry-run on staging (rolled back) is recorded in docs/brain/STATUS.md.
--
-- What it adds:
--   1. The value 'purchase' on the enum public.credit_transaction_type (it had earn, spend, bonus). Postgres cannot use a new
--      enum value in the same transaction that adds it, so nothing below inserts 'purchase' at migration time.
--   2. public.mm_grant_practice_credits(user, amount, payment id, pack id): adds practice credits once per payment.
--        * security definer, search_path = public, pg_temp, execute for service_role only (the grant path is server-only);
--        * idempotent on the payment id: the ledger reference is 'purchase:<payment id>' (credit_transactions.reference is
--          unique), a repeat returns { idempotent: true } and adds nothing; the same reference for another user or another
--          amount is refused ('reference_mismatch');
--        * users.credit_balance is locked before the check is repeated, so a checkout verify and a webhook that arrive
--          together add the credits once;
--        * one credit_transactions row: type 'purchase', action 'purchase', amount = credit_delta = the credits added.
--      The amount is chosen by the server from its own catalog; the function only refuses a non-positive amount or one above
--      5000 (a sanity bound, not the price list, so changing a pack in walletPacks.mjs needs no migration).
-- Nothing existing changes: spend_credits, the 100-credit start, contribution grants and the AI wallet functions are untouched.
-- Undo: supabase/undo/20261018200000_practice_credit_packs.undo.sql (drops the function; the enum value stays, it is harmless).

alter type public.credit_transaction_type add value if not exists 'purchase';

create or replace function public.mm_grant_practice_credits(
  p_user_id text,
  p_amount integer,
  p_payment_id text,
  p_pack_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_ref text;
  v_existing public.credit_transactions%rowtype;
  v_balance integer;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;
  if p_payment_id is null or length(trim(p_payment_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'missing_payment');
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 5000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  v_ref := 'purchase:' || p_payment_id;

  select * into v_existing from public.credit_transactions where reference = v_ref;
  if found then
    if v_existing.user_id = p_user_id and v_existing.credit_delta = p_amount then
      select credit_balance into v_balance from public.users where id = p_user_id;
      return jsonb_build_object('ok', true, 'idempotent', true, 'granted', v_existing.credit_delta, 'balance', v_balance);
    end if;
    return jsonb_build_object('ok', false, 'error', 'reference_mismatch');
  end if;

  -- Lock the student's row, then look again: a verify and a webhook for one payment queue here and the second sees the first.
  select credit_balance into v_balance from public.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  select * into v_existing from public.credit_transactions where reference = v_ref;
  if found then
    if v_existing.user_id = p_user_id and v_existing.credit_delta = p_amount then
      return jsonb_build_object('ok', true, 'idempotent', true, 'granted', v_existing.credit_delta, 'balance', v_balance);
    end if;
    return jsonb_build_object('ok', false, 'error', 'reference_mismatch');
  end if;

  update public.users
     set credit_balance = credit_balance + p_amount
   where id = p_user_id
   returning credit_balance into v_balance;

  insert into public.credit_transactions (user_id, amount, type, reference, action, credit_delta)
  values (p_user_id, p_amount, 'purchase', v_ref, 'purchase', p_amount);

  raise log 'credit_change user_id=% action=purchase pack=% credit_delta=%', p_user_id, p_pack_id, p_amount;
  return jsonb_build_object('ok', true, 'idempotent', false, 'granted', p_amount, 'balance', v_balance);
end;
$function$;

revoke all on function public.mm_grant_practice_credits(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.mm_grant_practice_credits(text, integer, text, text) to service_role;
