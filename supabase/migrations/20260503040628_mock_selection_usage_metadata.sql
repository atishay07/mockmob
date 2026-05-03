-- Store per-attempt picker metadata and keep the newest-first mock pool fast.

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS selection_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questions_mock_latest_pool
  ON public.questions(subject, difficulty, created_at DESC)
  WHERE is_deleted = FALSE
    AND (
      status = 'live'
      OR (verification_state = 'verified' AND exploration_state = 'active')
    );
