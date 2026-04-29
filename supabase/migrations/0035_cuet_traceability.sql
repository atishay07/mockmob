-- ============================================================
-- Migration 0035 - CUET-first traceability fields.
--
-- Every AI-generated question must be traceable to:
-- CUET syllabus -> chapter -> topic -> concept -> concept_id.
-- ============================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS concept TEXT,
  ADD COLUMN IF NOT EXISTS concept_id TEXT,
  ADD COLUMN IF NOT EXISTS pyq_anchor_id TEXT,
  ADD COLUMN IF NOT EXISTS anchor_tier INTEGER,
  ADD COLUMN IF NOT EXISTS question_type TEXT;

CREATE INDEX IF NOT EXISTS idx_questions_concept_id
  ON public.questions(subject, chapter, concept_id)
  WHERE is_deleted = FALSE AND concept_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_question_type
  ON public.questions(subject, question_type)
  WHERE is_deleted = FALSE AND question_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_pyq_anchor_id
  ON public.questions(pyq_anchor_id)
  WHERE is_deleted = FALSE AND pyq_anchor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_anchor_tier
  ON public.questions(anchor_tier)
  WHERE is_deleted = FALSE AND anchor_tier IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_anchor_tier_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_anchor_tier_check
      CHECK (anchor_tier IS NULL OR anchor_tier IN (1, 2, 3));
  END IF;
END $$;
