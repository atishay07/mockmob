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

  PERFORM 1
  FROM public.questions q
  WHERE q.id = p_question_id AND COALESCE(q.is_deleted, FALSE) = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found';
  END IF;

  SELECT qv.vote_type INTO v_existing
  FROM public.question_votes qv
  WHERE qv.user_id = p_user_id AND qv.question_id = p_question_id
  FOR UPDATE;

  IF p_vote_type IS NULL THEN
    IF v_existing = 'up' THEN
      v_up_delta := -1;
    ELSIF v_existing = 'down' THEN
      v_down_delta := -1;
    END IF;

    IF v_existing IS NOT NULL THEN
      DELETE FROM public.question_votes qv
      WHERE qv.user_id = p_user_id AND qv.question_id = p_question_id;
    END IF;
  ELSIF v_existing IS NULL THEN
    INSERT INTO public.question_votes (user_id, question_id, vote_type)
    VALUES (p_user_id, p_question_id, p_vote_type);
    IF p_vote_type = 'up' THEN
      v_up_delta := 1;
    ELSE
      v_down_delta := 1;
    END IF;
    v_final_vote := p_vote_type::TEXT;
  ELSIF v_existing <> p_vote_type THEN
    UPDATE public.question_votes qv
    SET vote_type = p_vote_type, updated_at = NOW()
    WHERE qv.user_id = p_user_id AND qv.question_id = p_question_id;

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

  UPDATE public.questions q
  SET
    upvotes = GREATEST(0, q.upvotes + v_up_delta),
    downvotes = GREATEST(0, q.downvotes + v_down_delta),
    score = GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta),
    quality_band = CASE
      WHEN (GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta)) < -3 THEN 'low_quality'
      WHEN q.quality_band = 'low_quality' AND (GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta)) >= -3 THEN 'unrated'
      ELSE q.quality_band
    END,
    exploration_state = CASE
      WHEN (GREATEST(0, q.upvotes + v_up_delta) - GREATEST(0, q.downvotes + v_down_delta)) < -3 THEN 'frozen'
      ELSE q.exploration_state
    END,
    updated_at = NOW()
  WHERE q.id = p_question_id;

  IF v_credits_added THEN
    v_credit_reference := 'vote:' || p_question_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, reference)
    VALUES (p_user_id, 2, 'earn', v_credit_reference);

    UPDATE public.users u
    SET credit_balance = u.credit_balance + 2
    WHERE u.id = p_user_id;
  END IF;

  SELECT q.quality_band INTO v_quality_band
  FROM public.questions q
  WHERE q.id = p_question_id;

  IF v_quality_band = 'low_quality' THEN
    RAISE LOG 'Question % flagged low_quality via votes', p_question_id;
  END IF;

  RETURN QUERY
  SELECT q.id::TEXT, q.upvotes::INTEGER, q.downvotes::INTEGER, q.score::INTEGER, v_final_vote, u.credit_balance::INTEGER
  FROM public.questions q
  JOIN public.users u ON u.id = p_user_id
  WHERE q.id = p_question_id;
END;
$$;
