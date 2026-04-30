-- ============================================================
-- Migration 0036 — mode-aware credit costs.
--
-- Quick Practice  -> 'attempt'       -> 10 credits (unchanged)
-- Full Mock       -> 'attempt_full'  -> 50 credits (new)
-- Smart / NTA Mode are premium-only and never call spend_credits.
--
-- The 'generate' action (10 credits) is left untouched.
-- ============================================================

CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id TEXT,
  p_action TEXT,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $function$
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

-- The function is owned by the same role; permissions remain via the
-- service-role grant established in 0027.
