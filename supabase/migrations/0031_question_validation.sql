-- ============================================================
-- Migration 0031 — Question validation pipeline columns.
--
-- Adds the four classification fields written by
-- `scripts/pipeline/validate-existing.mjs`. The script reuses
-- existing fields where possible (difficulty, quality_score,
-- verification_state) and only adds what is genuinely new.
--
-- Rules:
--   • ADD COLUMN IF NOT EXISTS only — no destructive ops.
--   • Defaults are NULL so we can distinguish "not yet validated"
--     from "validated and {true|false|low}". A nullable column +
--     index on validated_at lets us re-run only the unvalidated
--     subset on subsequent passes.
-- ============================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS is_ncert_relevant     BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_cuet_syllabus      BOOLEAN,
  ADD COLUMN IF NOT EXISTS validation_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS topic                 TEXT,
  ADD COLUMN IF NOT EXISTS validated_at          TIMESTAMPTZ;

-- Sanity bound — confidence is always 0..1.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_validation_confidence_range'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_validation_confidence_range
      CHECK (validation_confidence IS NULL OR (validation_confidence >= 0 AND validation_confidence <= 1));
  END IF;
END $$;

-- Index for incremental re-runs: pull rows that haven't been validated yet,
-- or that fell into the flagged band and may be re-classified.
CREATE INDEX IF NOT EXISTS idx_questions_validation_pending
  ON public.questions(validated_at)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_questions_topic
  ON public.questions(subject, topic)
  WHERE is_deleted = FALSE AND topic IS NOT NULL;
