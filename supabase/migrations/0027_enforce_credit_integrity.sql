-- Enforce the credit source of truth:
-- 1. New users start with exactly 100 credits.
-- 2. Credits decrease only for server-defined question generation/attempt actions.
-- 3. Credits increase only for approved valid contributions.
-- 4. Every credit mutation is atomic, logged, and idempotent by reference.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 100;

ALTER TABLE public.users
  ALTER COLUMN credit_balance SET DEFAULT 100;

UPDATE public.users
SET credit_balance = 100
WHERE credit_balance = 0;

ALTER TABLE public.users
  ALTER COLUMN credit_balance SET NOT NULL;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS credit_delta INTEGER;

UPDATE public.credit_transactions
SET
  credit_delta = COALESCE(credit_delta, amount),
  action = COALESCE(
    action,
    CASE
      WHEN reference LIKE 'question_approved_%' THEN 'contribute'
      WHEN reference LIKE 'generate_mock_%' THEN 'generate'
      ELSE 'legacy'
    END
  );

ALTER TABLE public.credit_transactions
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN credit_delta SET NOT NULL;

WITH duplicates AS (
  SELECT
    ctid,
    reference,
    ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at, id) AS rn
  FROM public.credit_transactions
)
UPDATE public.credit_transactions ct
SET reference = ct.reference || ':legacy_duplicate:' || duplicates.rn::TEXT
FROM duplicates
WHERE ct.ctid = duplicates.ctid
  AND duplicates.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_reference_unique
  ON public.credit_transactions(reference);

DROP FUNCTION IF EXISTS public.spend_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.grant_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.grant_daily_login_credits(TEXT);
DROP FUNCTION IF EXISTS public.grant_attempt_answer_credits(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id TEXT,
  p_action TEXT,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_amount INTEGER;
  v_balance INTEGER;
  v_existing public.credit_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action IS NULL OR p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'user_id, action, and reference are required';
  END IF;

  v_amount := CASE p_action
    WHEN 'generate' THEN 10
    WHEN 'attempt' THEN 10
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
$$;

CREATE OR REPLACE FUNCTION public.grant_contribution_credits(
  p_user_id TEXT,
  p_action TEXT,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_amount INTEGER := 15;
  v_existing public.credit_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action <> 'contribute' OR p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'valid contribution credit grant parameters are required';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.credit_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id = p_user_id
       AND v_existing.action = p_action
       AND v_existing.credit_delta = v_amount THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION 'credit reference already used for a different transaction';
  END IF;

  PERFORM 1
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  UPDATE public.users
  SET credit_balance = credit_balance + v_amount
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference, action, credit_delta)
  VALUES (p_user_id, v_amount, 'earn', p_reference, p_action, v_amount);

  RAISE LOG 'credit_change user_id=% action=% credit_delta=%', p_user_id, p_action, v_amount;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_daily_login_credits(
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_attempt_answer_credits(
  p_user_id TEXT,
  p_attempt_id TEXT,
  p_details JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_question_with_credit(
  p_question_id TEXT,
  p_action TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_question public.questions%ROWTYPE;
  v_credit_user_id TEXT;
BEGIN
  IF p_question_id IS NULL OR p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid moderation parameters';
  END IF;

  SELECT *
  INTO v_question
  FROM public.questions
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND OR v_question.status <> 'pending' THEN
    RETURN NULL;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.questions
    SET
      status = 'live',
      verification_state = 'verified',
      exploration_state = 'active',
      live_at = NOW()
    WHERE id = p_question_id
    RETURNING * INTO v_question;

    v_credit_user_id := COALESCE(v_question.author_id, v_question.uploaded_by);
    IF v_credit_user_id IS NOT NULL THEN
      PERFORM public.grant_contribution_credits(
        v_credit_user_id,
        'contribute',
        'contribute:' || p_question_id
      );
    END IF;
  ELSE
    UPDATE public.questions
    SET
      status = 'rejected',
      verification_state = 'rejected',
      exploration_state = 'rejected'
    WHERE id = p_question_id
    RETURNING * INTO v_question;
  END IF;

  UPDATE public.moderation_jobs
  SET status = 'completed', completed_at = NOW()
  WHERE question_id = p_question_id
    AND status IN ('queued', 'processing', 'retrying');

  RETURN to_jsonb(v_question);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_credits(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_contribution_credits(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_question_with_credit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_daily_login_credits(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_attempt_answer_credits(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.spend_credits(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_contribution_credits(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.moderate_question_with_credit(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_daily_login_credits(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_attempt_answer_credits(TEXT, TEXT, JSONB) TO service_role;
