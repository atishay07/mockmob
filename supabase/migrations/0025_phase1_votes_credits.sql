-- Phase 1 quality engine: server-backed voting and anti-farming credits.

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TYPE public.quality_band_enum ADD VALUE IF NOT EXISTS 'low_quality';
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_score_live
  ON public.questions(subject, chapter, score DESC)
  WHERE is_deleted = FALSE;

DO $$ BEGIN
  CREATE TYPE public.question_vote_type AS ENUM ('up', 'down');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.question_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  vote_type public.question_vote_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT question_votes_user_question_unique UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_votes_question ON public.question_votes(question_id);

CREATE TABLE IF NOT EXISTS public.user_question_answer_credits (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answered_credit_granted BOOLEAN NOT NULL DEFAULT FALSE,
  correct_credit_granted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.user_daily_login_credits (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, login_date)
);

CREATE OR REPLACE FUNCTION public.apply_question_vote(
  p_user_id TEXT,
  p_question_id TEXT,
  p_vote_type public.question_vote_type DEFAULT NULL
) RETURNS TABLE (
  question_id TEXT,
  upvotes INTEGER,
  downvotes INTEGER,
  score INTEGER,
  user_vote TEXT,
  credit_balance INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing public.question_vote_type;
  v_up_delta INTEGER := 0;
  v_down_delta INTEGER := 0;
  v_quality_band TEXT;
  v_credit_reference TEXT;
  v_credits_added BOOLEAN := FALSE;
  v_final_vote TEXT := NULL;
BEGIN
  IF p_user_id IS NULL OR p_question_id IS NULL THEN
    RAISE EXCEPTION 'user_id and question_id are required';
  END IF;

  PERFORM 1 FROM public.questions
    WHERE id = p_question_id AND COALESCE(is_deleted, FALSE) = FALSE
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found';
  END IF;

  SELECT vote_type INTO v_existing
  FROM public.question_votes
  WHERE user_id = p_user_id AND question_id = p_question_id
  FOR UPDATE;

  IF p_vote_type IS NULL THEN
    IF v_existing = 'up' THEN
      v_up_delta := -1;
    ELSIF v_existing = 'down' THEN
      v_down_delta := -1;
    END IF;

    IF v_existing IS NOT NULL THEN
      DELETE FROM public.question_votes
      WHERE user_id = p_user_id AND question_id = p_question_id;
    END IF;
  ELSIF v_existing IS NULL THEN
    INSERT INTO public.question_votes (user_id, question_id, vote_type)
    VALUES (p_user_id, p_question_id, p_vote_type);
    IF p_vote_type = 'up' THEN v_up_delta := 1; ELSE v_down_delta := 1; END IF;
    v_credits_added := FALSE;
    v_final_vote := p_vote_type::TEXT;
  ELSIF v_existing <> p_vote_type THEN
    UPDATE public.question_votes
      SET vote_type = p_vote_type, updated_at = NOW()
      WHERE user_id = p_user_id AND question_id = p_question_id;
    IF p_vote_type = 'up' THEN
      v_up_delta := 1;
      v_down_delta := -1;
    ELSE
      v_up_delta := -1;
      v_down_delta := 1;
    END IF;
    v_final_vote := p_vote_type::TEXT;
  ELSE
    v_final_vote := p_vote_type::TEXT;
  END IF;

  UPDATE public.questions
  SET
    upvotes = GREATEST(0, upvotes + v_up_delta),
    downvotes = GREATEST(0, downvotes + v_down_delta),
    score = GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta),
    quality_band = CASE
      WHEN (GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta)) < -3 THEN 'low_quality'
      WHEN quality_band = 'low_quality' AND (GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta)) >= -3 THEN 'unrated'
      ELSE quality_band
    END,
    exploration_state = CASE
      WHEN (GREATEST(0, upvotes + v_up_delta) - GREATEST(0, downvotes + v_down_delta)) < -3 THEN 'frozen'
      ELSE exploration_state
    END,
    updated_at = NOW()
  WHERE id = p_question_id;

  IF v_credits_added THEN
    v_credit_reference := 'vote:' || p_question_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, reference)
    VALUES (p_user_id, 2, 'earn', v_credit_reference);
    UPDATE public.users SET credit_balance = credit_balance + 2 WHERE id = p_user_id;
  END IF;

  SELECT q.quality_band INTO v_quality_band FROM public.questions q WHERE q.id = p_question_id;
  IF v_quality_band = 'low_quality' THEN
    RAISE LOG 'Question % flagged low_quality via votes', p_question_id;
  END IF;
  RAISE LOG 'Vote applied question=% user=% vote=%', p_question_id, p_user_id, v_final_vote;

  RETURN QUERY
  SELECT q.id, q.upvotes, q.downvotes, q.score, v_final_vote, u.credit_balance
  FROM public.questions q
  JOIN public.users u ON u.id = p_user_id
  WHERE q.id = p_question_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_daily_login_credits(
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  RETURN FALSE;

  INSERT INTO public.user_daily_login_credits (user_id, login_date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE public.users SET credit_balance = credit_balance + 10 WHERE id = p_user_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, reference)
    VALUES (p_user_id, 10, 'bonus', 'daily_login:' || CURRENT_DATE::TEXT);
    RAISE LOG 'Daily login credits granted user=% amount=10', p_user_id;
  END IF;

  RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_attempt_answer_credits(
  p_user_id TEXT,
  p_attempt_id TEXT,
  p_details JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_detail JSONB;
  v_qid TEXT;
  v_is_correct BOOLEAN;
  v_amount INTEGER := 0;
  v_added INTEGER := 0;
  v_existing public.user_question_answer_credits%ROWTYPE;
BEGIN
  RETURN 0;

  IF p_user_id IS NULL OR p_attempt_id IS NULL OR jsonb_typeof(p_details) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_detail IN SELECT * FROM jsonb_array_elements(p_details)
  LOOP
    v_qid := v_detail->>'qid';
    IF v_qid IS NULL OR (v_detail ? 'givenIndex') IS FALSE OR v_detail->>'givenIndex' IS NULL THEN
      CONTINUE;
    END IF;

    v_is_correct := COALESCE((v_detail->>'isCorrect')::BOOLEAN, FALSE);

    IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = v_qid) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.user_question_answer_credits (user_id, question_id)
    VALUES (p_user_id, v_qid)
    ON CONFLICT (user_id, question_id) DO NOTHING;

    SELECT * INTO v_existing
    FROM public.user_question_answer_credits
    WHERE user_id = p_user_id AND question_id = v_qid
    FOR UPDATE;

    v_amount := 0;
    IF NOT v_existing.answered_credit_granted THEN
      v_amount := v_amount + 1;
      UPDATE public.user_question_answer_credits
        SET answered_credit_granted = TRUE, updated_at = NOW()
        WHERE user_id = p_user_id AND question_id = v_qid;
    END IF;

    IF v_is_correct AND NOT v_existing.correct_credit_granted THEN
      v_amount := v_amount + 2;
      UPDATE public.user_question_answer_credits
        SET correct_credit_granted = TRUE, updated_at = NOW()
        WHERE user_id = p_user_id AND question_id = v_qid;
    END IF;

    IF v_amount > 0 THEN
      v_added := v_added + v_amount;
      INSERT INTO public.credit_transactions (user_id, amount, type, reference)
      VALUES (p_user_id, v_amount, 'earn', 'attempt:' || p_attempt_id || ':question:' || v_qid);
    END IF;
  END LOOP;

  IF v_added > 0 THEN
    UPDATE public.users SET credit_balance = credit_balance + v_added WHERE id = p_user_id;
    RAISE LOG 'Attempt credits granted user=% attempt=% amount=%', p_user_id, p_attempt_id, v_added;
  END IF;

  RETURN v_added;
END;
$$;
