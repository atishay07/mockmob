-- Student learning layer: durable bookmarks, feed progress, and premium-aware limits.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS public.question_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'explore',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_bookmarks_user_created
  ON public.question_bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_bookmarks_question
  ON public.question_bookmarks(question_id);

CREATE TABLE IF NOT EXISTS public.user_question_progress (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  subject TEXT,
  chapter TEXT,
  seen_count INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_selected_key TEXT,
  last_correct BOOLEAN,
  best_dwell_ms INTEGER,
  last_seen_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_user_question_progress_user_subject
  ON public.user_question_progress(user_id, subject, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_question_progress_user_updated
  ON public.user_question_progress(user_id, updated_at DESC);
