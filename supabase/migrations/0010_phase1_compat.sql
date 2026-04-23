-- ============================================================
-- Migration 0010 — Phase 1 compatibility layer
--
-- Designed for a PARTIALLY MIGRATED database that already has
-- the 0001–0004 schema (TEXT PKs, original questions/users/attempts).
--
-- Rules:
--   • ALTER TABLE ... ADD COLUMN IF NOT EXISTS everywhere
--   • CREATE TABLE IF NOT EXISTS everywhere
--   • CREATE OR REPLACE for all functions
--   • No DROPs, no RECREATEs of existing objects
--   • All ID/FK columns are TEXT to match existing schema
--   • Enum columns stored as TEXT (no CREATE TYPE needed)
-- ============================================================


-- ============================================================
-- SECTION 1: Fix existing columns blocking Phase 1 inserts
-- ============================================================

-- Phase 1's upload route does not supply `question`, `correct_index`,
-- or `options` (it uses `body`, `correct_answer`, and optionally null
-- options for open-ended questions). Drop their NOT NULL constraints
-- so Phase 1 inserts don't fail on columns it doesn't own.
ALTER TABLE public.questions ALTER COLUMN question       DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN correct_index  DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN options        DROP NOT NULL;

-- questions.id has no DEFAULT — Supabase returns it on .single() after
-- insert, so we need the DB to generate it when the caller omits it.
ALTER TABLE public.questions
    ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;


-- ============================================================
-- SECTION 2: New columns on existing `questions` table
-- ============================================================

-- Phase 1 field names (alongside the original schema's field names)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS body           TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS correct_answer TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS author_id      TEXT;   -- maps to uploaded_by
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS tags           TEXT[]      NOT NULL DEFAULT '{}';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- AI moderation
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_tier              TEXT        NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_score             NUMERIC(5,3);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS recommended_difficulty TEXT;

-- Verification & ranking
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS verification_state TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS quality_band        TEXT NOT NULL DEFAULT 'unrated';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS quality_score       NUMERIC(8,4) NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS momentum_score      NUMERIC(8,4) NOT NULL DEFAULT 0;

-- Exploration
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exposure_budget   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exposure_used      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exploration_lane   TEXT    NOT NULL DEFAULT 'none';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exploration_state  TEXT    NOT NULL DEFAULT 'pending';

-- Duplicate detection
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS duplicate_group_id TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS content_hash       TEXT;

-- Lifecycle
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS live_at    TIMESTAMPTZ;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;


-- ============================================================
-- SECTION 3: New columns on existing `users` table
-- ============================================================

-- interact route reads: created_at (exists), subscription_status, is_moderator
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT    NOT NULL DEFAULT 'free';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_moderator        BOOLEAN NOT NULL DEFAULT FALSE;

-- Phase 1 trust/reputation fields (not yet used by routes, safe to add now)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at         TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_level           INTEGER  NOT NULL DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reputation_total       INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contribution_points_90d INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS hidden_trust_score     SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trust_tier             TEXT     NOT NULL DEFAULT 'T2';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS flags_count            INTEGER  NOT NULL DEFAULT 0;


-- ============================================================
-- SECTION 4: New table — question_interactions
-- ============================================================
-- Append-only event log. FKs use TEXT to match existing PKs.
-- user_id intentionally has NO FK constraint so dev 'test-user'
-- can write interactions without a matching users row.

CREATE TABLE IF NOT EXISTS public.question_interactions (
    id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    question_id      TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_id          TEXT        NOT NULL,   -- no FK: allows dev 'test-user'
    interaction_type TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id       TEXT,
    flow_context     TEXT        CHECK (flow_context IS NULL
                                     OR flow_context IN ('mock','review','explore','shadow')),
    dwell_ms         INTEGER,
    metadata         JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_qi_question_id
    ON public.question_interactions(question_id);

CREATE INDEX IF NOT EXISTS idx_qi_user_id
    ON public.question_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_qi_question_user_type
    ON public.question_interactions(question_id, user_id, interaction_type);

CREATE INDEX IF NOT EXISTS idx_qi_user_flow_type_created
    ON public.question_interactions(user_id, flow_context, interaction_type, created_at);


-- ============================================================
-- SECTION 5: New table — question_scores
-- ============================================================

CREATE TABLE IF NOT EXISTS public.question_scores (
    question_id               TEXT          PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    subject                   TEXT          NOT NULL,
    chapter                   TEXT          NOT NULL,
    difficulty                TEXT          NOT NULL,
    rank_score                NUMERIC(10,4) NOT NULL DEFAULT 0,
    momentum_score            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    quality_score             NUMERIC(8,4)  NOT NULL DEFAULT 0,
    attempts_qualified        INTEGER       NOT NULL DEFAULT 0,
    exposures_total           INTEGER       NOT NULL DEFAULT 0,
    like_count                INTEGER       NOT NULL DEFAULT 0,
    save_count                INTEGER       NOT NULL DEFAULT 0,
    skip_count                INTEGER       NOT NULL DEFAULT 0,
    shallow_bounce_count      INTEGER       NOT NULL DEFAULT 0,
    report_count              INTEGER       NOT NULL DEFAULT 0,
    unique_user_count         INTEGER       NOT NULL DEFAULT 0,
    save_rate                 NUMERIC(6,4),
    like_rate                 NUMERIC(6,4),
    skip_rate                 NUMERIC(6,4),
    report_rate               NUMERIC(6,4),
    weighted_likes            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    weighted_saves            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    weighted_skips            NUMERIC(8,4)  NOT NULL DEFAULT 0,
    weighted_reports          NUMERIC(8,4)  NOT NULL DEFAULT 0,
    is_eligible_for_discovery BOOLEAN       NOT NULL DEFAULT FALSE,
    exploration_lane          TEXT          NOT NULL DEFAULT 'none',
    last_computed_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qs_subject_chapter
    ON public.question_scores(subject, chapter);

CREATE INDEX IF NOT EXISTS idx_qs_rank_eligible
    ON public.question_scores(rank_score DESC)
    WHERE is_eligible_for_discovery = TRUE;

CREATE INDEX IF NOT EXISTS idx_qs_explore_bucket
    ON public.question_scores(subject, chapter, difficulty, exploration_lane, rank_score DESC)
    WHERE is_eligible_for_discovery = TRUE;


-- ============================================================
-- SECTION 6: New table — ai_moderation_reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_moderation_reviews (
    id                        TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    question_id               TEXT          NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at              TIMESTAMPTZ,
    tier                      TEXT,
    ai_score                  NUMERIC(5,3),
    clarity_score             NUMERIC(4,3),
    syllabus_relevance_score  NUMERIC(4,3),
    answerability_score       NUMERIC(4,3),
    explanation_quality_score NUMERIC(4,3),
    duplicate_risk_score      NUMERIC(4,3),
    difficulty_confidence     NUMERIC(4,3),
    recommended_difficulty    TEXT,
    duplicate_candidate_ids   TEXT[]        NOT NULL DEFAULT '{}',
    duplicate_reason_codes    TEXT[]        NOT NULL DEFAULT '{}',
    rule_violations           JSONB         NOT NULL DEFAULT '[]',
    llm_response              JSONB,
    model_used                TEXT,
    processing_ms             INTEGER,
    error_message             TEXT,
    retry_count               INTEGER       NOT NULL DEFAULT 0,
    is_canonical              BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_air_question
    ON public.ai_moderation_reviews(question_id);

-- At most one canonical review per question
CREATE UNIQUE INDEX IF NOT EXISTS idx_air_one_canonical_per_question
    ON public.ai_moderation_reviews(question_id)
    WHERE is_canonical = TRUE;


-- ============================================================
-- SECTION 7: New table — moderation_jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.moderation_jobs (
    id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    question_id    TEXT        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    status         TEXT        NOT NULL DEFAULT 'queued',
    priority       INTEGER     NOT NULL DEFAULT 5,
    queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    picked_up_at   TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    next_retry_at  TIMESTAMPTZ,
    retry_count    INTEGER     NOT NULL DEFAULT 0,
    max_retries    INTEGER     NOT NULL DEFAULT 3,
    error_message  TEXT,
    worker_id      TEXT
);

-- Job claim index: only queued/retrying rows
CREATE INDEX IF NOT EXISTS idx_mj_claim
    ON public.moderation_jobs(priority ASC, queued_at ASC)
    WHERE status IN ('queued','retrying');

CREATE INDEX IF NOT EXISTS idx_mj_question_id
    ON public.moderation_jobs(question_id);

CREATE INDEX IF NOT EXISTS idx_mj_retry_due
    ON public.moderation_jobs(next_retry_at)
    WHERE status = 'retrying';

-- At most one active job per question (prevents double-processing on retry)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mj_one_active_per_question
    ON public.moderation_jobs(question_id)
    WHERE status IN ('queued','processing','retrying');


-- ============================================================
-- SECTION 8: Unique index — content_hash dedup guard
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_content_hash_unique
    ON public.questions(content_hash)
    WHERE content_hash IS NOT NULL
      AND is_deleted = FALSE;


-- ============================================================
-- SECTION 9: RPC — claim_moderation_job
-- Uses TEXT ids to match the existing schema.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_moderation_job(p_worker_id TEXT)
RETURNS TABLE (
    id          TEXT,
    question_id TEXT,
    retry_count INTEGER,
    max_retries INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id TEXT;
BEGIN
    SELECT mj.id
    INTO   v_job_id
    FROM   public.moderation_jobs mj
    WHERE  (
               mj.status = 'queued'
           OR (mj.status = 'retrying' AND mj.next_retry_at <= NOW())
           )
    ORDER BY mj.priority ASC, mj.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.moderation_jobs
    SET    status       = 'processing',
           picked_up_at = NOW(),
           worker_id    = p_worker_id
    WHERE  public.moderation_jobs.id = v_job_id;

    RETURN QUERY
    SELECT mj.id, mj.question_id, mj.retry_count, mj.max_retries
    FROM   public.moderation_jobs mj
    WHERE  mj.id = v_job_id;
END;
$$;


-- ============================================================
-- SECTION 10: RPC — count_distinct_mock_sessions
-- Counts distinct completed mock sessions for a user.
-- user_id is TEXT to match question_interactions.user_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_distinct_mock_sessions(
    p_user_id TEXT,
    p_since   TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(DISTINCT session_id)::INTEGER
    FROM   public.question_interactions
    WHERE  user_id          = p_user_id
      AND  flow_context     = 'mock'
      AND  interaction_type = 'attempted'
      AND  session_id       IS NOT NULL
      AND  created_at       >= p_since;
$$;


-- ============================================================
-- SECTION 11: RPC — recover_stale_moderation_jobs
-- Resets stuck 'processing' jobs (worker crash recovery).
-- ============================================================

CREATE OR REPLACE FUNCTION public.recover_stale_moderation_jobs(
    p_stale_after_minutes INTEGER DEFAULT 2
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_recovered INTEGER;
BEGIN
    UPDATE public.moderation_jobs
    SET    status        = 'retrying',
           next_retry_at = NOW(),
           worker_id     = NULL,
           error_message = COALESCE(error_message || ' ', '')
                           || '[recovered: stale processing at ' || NOW()::TEXT || ']'
    WHERE  status       = 'processing'
      AND  picked_up_at < NOW() - (p_stale_after_minutes || ' minutes')::INTERVAL
      AND  retry_count  < max_retries;

    GET DIAGNOSTICS v_recovered = ROW_COUNT;

    UPDATE public.moderation_jobs
    SET    status        = 'failed',
           completed_at  = NOW(),
           worker_id     = NULL,
           error_message = COALESCE(error_message || ' ', '')
                           || '[failed: stale processing exhausted retries at ' || NOW()::TEXT || ']'
    WHERE  status       = 'processing'
      AND  picked_up_at < NOW() - (p_stale_after_minutes || ' minutes')::INTERVAL
      AND  retry_count  >= max_retries;

    RETURN v_recovered;
END;
$$;


-- ============================================================
-- SECTION 12: Sync trigger — keep question_scores metadata
-- in sync when questions.subject/chapter/difficulty changes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_question_scores_metadata()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.subject    IS DISTINCT FROM OLD.subject
     OR NEW.chapter    IS DISTINCT FROM OLD.chapter
     OR NEW.difficulty IS DISTINCT FROM OLD.difficulty) THEN
        UPDATE public.question_scores
        SET    subject    = NEW.subject,
               chapter    = NEW.chapter,
               difficulty = NEW.difficulty
        WHERE  question_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Drop before recreate so this is idempotent
DROP TRIGGER IF EXISTS trg_questions_sync_scores_metadata ON public.questions;

CREATE TRIGGER trg_questions_sync_scores_metadata
    AFTER UPDATE OF subject, chapter, difficulty ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_question_scores_metadata();
