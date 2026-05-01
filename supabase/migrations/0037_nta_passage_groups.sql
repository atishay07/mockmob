-- ============================================================
-- Migration 0037 - NTA passage group support.
--
-- Keeps English reading-comprehension passages as first-class
-- groups so NTA mode can select and display a passage with all
-- linked questions instead of orphaning child questions.
--
-- Production compatibility note:
-- Some environments may not have run 0035_cuet_traceability yet.
-- NTA mode requires traceability metadata, so this migration adds
-- those columns idempotently as nullable fields. It does not backfill
-- or invent anchor tiers; rows remain excluded from strict NTA mocks
-- until real PYQ-anchor metadata is populated.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.passage_groups (
  id TEXT PRIMARY KEY DEFAULT ('pg_' || replace(gen_random_uuid()::text, '-', '')),
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  passage_type TEXT,
  title TEXT,
  passage_text TEXT NOT NULL,
  source TEXT,
  difficulty TEXT,
  status TEXT NOT NULL DEFAULT 'live',
  discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  mode_visibility TEXT[] NOT NULL DEFAULT ARRAY['full_mock', 'nta_mode'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS concept TEXT,
  ADD COLUMN IF NOT EXISTS concept_id TEXT,
  ADD COLUMN IF NOT EXISTS pyq_anchor_id TEXT,
  ADD COLUMN IF NOT EXISTS anchor_tier INTEGER,
  ADD COLUMN IF NOT EXISTS difficulty_weight INTEGER,
  ADD COLUMN IF NOT EXISTS question_type TEXT,
  ADD COLUMN IF NOT EXISTS passage_group_id TEXT,
  ADD COLUMN IF NOT EXISTS passage_id TEXT,
  ADD COLUMN IF NOT EXISTS passage_type TEXT,
  ADD COLUMN IF NOT EXISTS order_index INTEGER;

UPDATE public.questions
SET difficulty_weight = CASE difficulty
  WHEN 'easy' THEN 1
  WHEN 'medium' THEN 2
  WHEN 'hard' THEN 3
  ELSE 2
END
WHERE difficulty_weight IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_anchor_tier_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_anchor_tier_check
      CHECK (anchor_tier IS NULL OR anchor_tier IN (1, 2, 3, 4));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_difficulty_weight_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_difficulty_weight_check
      CHECK (difficulty_weight IS NULL OR difficulty_weight IN (1, 2, 3));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_passage_groups_subject_chapter
  ON public.passage_groups(subject, chapter)
  WHERE status = 'live' AND discoverable = TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name = 'is_deleted'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_passage_group
      ON public.questions(passage_group_id, order_index)
      WHERE is_deleted = FALSE AND passage_group_id IS NOT NULL';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_passage_group
      ON public.questions(passage_group_id, order_index)
      WHERE passage_group_id IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_pyq_anchor_id
  ON public.questions(pyq_anchor_id)
  WHERE pyq_anchor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_anchor_tier
  ON public.questions(anchor_tier)
  WHERE anchor_tier IS NOT NULL;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name IN (
        'subject',
        'anchor_tier',
        'quality_band',
        'difficulty',
        'status',
        'verification_state',
        'exploration_state'
      )
  ) = 7 AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name = 'is_deleted'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_nta_pool
      ON public.questions(subject, anchor_tier, quality_band, difficulty)
      WHERE is_deleted = FALSE
        AND status = ''live''
        AND verification_state = ''verified''
        AND exploration_state IN (''active'', ''fast_track'', ''promoted'')';
  ELSIF (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'questions'
      AND column_name IN (
        'subject',
        'anchor_tier',
        'quality_band',
        'difficulty',
        'status',
        'verification_state',
        'exploration_state'
      )
  ) = 7 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_questions_nta_pool
      ON public.questions(subject, anchor_tier, quality_band, difficulty)
      WHERE status = ''live''
        AND verification_state = ''verified''
        AND exploration_state IN (''active'', ''fast_track'', ''promoted'')';
  ELSE
    RAISE NOTICE 'Skipping idx_questions_nta_pool because required questions columns are missing.';
  END IF;
END $$;
