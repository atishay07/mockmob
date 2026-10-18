-- Practice credits per question (owner, 18 Oct 2026, D65: "5, 10, 15, 20, like as many questions, that many credits").
-- Quick practice costs 1 practice credit a question: 5 questions = 5, 10 = 10, 15 = 15, 20 = 20. A full mock stays 50.
-- Companion to data/test_modes.js (practiceCreditCost / practiceCreditAction) and src/lib/server/practiceSessions.js.
-- NOT applied on production by this branch. Dry-run and staging apply are recorded in docs/brain/STATUS.md.
--
-- What changes: the one place the database prices a spend, public.spend_credits. New actions 'attempt_5', 'attempt_10',
-- 'attempt_15' and 'attempt_20' are priced 5, 10, 15 and 20. Nothing else changes: 'attempt' stays 10 and 'attempt_full' stays 50
-- (old code and old app builds still send them), 'generate' stays 10, an unknown action still raises, the credit_transactions
-- idempotency check (same user, same action, same amount, else "credit reference already used"), the users row lock, the
-- balance check, the ledger row and the search_path are exactly production's. start_learning_session and
-- start_recovery_session only pass the action name through to spend_credits, so they are not touched. There is no refund or
-- cancel path for practice spends in the database or the app, so nothing needs to give back a different amount.
--
-- Production before this migration (read from pg_proc, read-only, 18 Oct 2026):
--   public.spend_credits(text, text, text): md5(prosrc) = 7decd1ff44f4456ed2552a9e19ed1157, length(prosrc) = 1535.
--   Free's allowances are unaffected: today's included 10-question set, the first set in a subject, the free 5-question recovery
--   set and Mob papers never reach spend_credits (the start functions pass a null action for them).
-- After this migration: md5(prosrc) = 911105fda93f7c1dcd687b08dd7c1059, length(prosrc) = 1666, proconfig = {search_path=public, pg_temp}.
-- Undo: supabase/undo/20261018170000_practice_credit_per_question.undo.sql restores that exact body.

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

-- Grants are unchanged: create or replace keeps the function's owner and privileges.
