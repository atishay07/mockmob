-- Undo for supabase/migrations/20261018170000_practice_credit_per_question.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself. Restores public.spend_credits exactly as
-- production had it on 18 Oct 2026 (read from pg_proc, read-only): md5(prosrc) = 7decd1ff44f4456ed2552a9e19ed1157,
-- length(prosrc) = 1535. Roll the code back first (Quick practice priced by count), otherwise a start sends attempt_5 and the
-- restored function refuses it ("unsupported credit spend action"). Spends already made keep their ledger rows
-- (action attempt_5 / attempt_10 / attempt_15 / attempt_20 with the amount charged); a retry of one of those references after the
-- undo would raise "credit reference already used for a different transaction", which is the safe answer.
-- Note: the staging copy of this function differed from production before this work (no search_path, CRLF); after the undo it
-- matches production.

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
