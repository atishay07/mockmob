-- Phase 1: MockMob Question Ranking and Contribution Engine
-- Run in order. Requires Postgres 14+ on Supabase.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE trust_tier_enum          AS ENUM ('T0','T1','T2','T3','T4');
CREATE TYPE subscription_status_enum AS ENUM ('free','active','cancelled','past_due');
CREATE TYPE ai_tier_enum             AS ENUM ('A','B','C','REJECT','PENDING');
CREATE TYPE difficulty_enum          AS ENUM ('easy','medium','hard');
CREATE TYPE verification_state_enum  AS ENUM ('unverified','pending_review','verified','rejected','disputed');
CREATE TYPE quality_band_enum        AS ENUM ('unrated','useful','strong','exceptional','verified');
CREATE TYPE exploration_lane_enum    AS ENUM ('none','shadow','standard','fast_track');
CREATE TYPE exploration_state_enum   AS ENUM ('pending','active','fast_track','promoted','frozen','rejected');
CREATE TYPE interaction_type_enum    AS ENUM (
    'seen','attempted','like','unlike','save','unsave',
    'report','report_resolved','explanation_opened',
    'answer_challenged','skip','shallow_bounce'
);
CREATE TYPE moderation_job_status_enum AS ENUM ('queued','processing','completed','failed','retrying');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                   TEXT        NOT NULL UNIQUE,
    username                TEXT        NOT NULL UNIQUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at          TIMESTAMPTZ,

    -- public status
    public_level            INTEGER     NOT NULL DEFAULT 1,
    reputation_total        INTEGER     NOT NULL DEFAULT 0,
    contribution_points_90d INTEGER     NOT NULL DEFAULT 0,

    -- hidden trust
    hidden_trust_score      SMALLINT    NOT NULL DEFAULT 50
                                        CHECK (hidden_trust_score BETWEEN 0 AND 100),
    trust_tier              trust_tier_enum NOT NULL DEFAULT 'T2',

    -- account
    subscription_status     subscription_status_enum NOT NULL DEFAULT 'free',
    flags_count             INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX idx_users_trust_tier ON users(trust_tier);

-- ============================================================
-- QUESTIONS
-- ============================================================

CREATE TABLE questions (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id           UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    subject             TEXT        NOT NULL,
    chapter             TEXT        NOT NULL,

    -- question content
    body                TEXT        NOT NULL,
    options             JSONB,                      -- [{key: "A", text: "..."}, ...]  NULL for open-ended
    correct_answer      TEXT        NOT NULL,
    explanation         TEXT,
    difficulty          difficulty_enum NOT NULL DEFAULT 'medium',
    tags                TEXT[]      NOT NULL DEFAULT '{}',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- AI moderation
    ai_tier             ai_tier_enum NOT NULL DEFAULT 'PENDING',
    ai_score            NUMERIC(5,3),               -- 0.000 – 1.000
    recommended_difficulty difficulty_enum,

    -- verification
    verification_state  verification_state_enum NOT NULL DEFAULT 'unverified',
    quality_band        quality_band_enum       NOT NULL DEFAULT 'unrated',

    -- ranking
    quality_score       NUMERIC(8,4) NOT NULL DEFAULT 0,
    momentum_score      NUMERIC(8,4) NOT NULL DEFAULT 0,

    -- exploration
    exposure_budget     INTEGER     NOT NULL DEFAULT 0,
    exposure_used       INTEGER     NOT NULL DEFAULT 0,
    exploration_lane    exploration_lane_enum   NOT NULL DEFAULT 'none',
    exploration_state   exploration_state_enum  NOT NULL DEFAULT 'pending',

    -- duplicate detection
    duplicate_group_id  UUID,
    content_hash        TEXT,                       -- SHA-256 of normalised body+answer

    -- lifecycle
    live_at             TIMESTAMPTZ,
    settled_at          TIMESTAMPTZ,
    is_deleted          BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_questions_author          ON questions(author_id);
CREATE INDEX idx_questions_subject_chapter ON questions(subject, chapter);
CREATE INDEX idx_questions_ai_tier         ON questions(ai_tier);
CREATE INDEX idx_questions_content_hash    ON questions(content_hash)
    WHERE content_hash IS NOT NULL;
CREATE INDEX idx_questions_live_at         ON questions(live_at)
    WHERE live_at IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_questions_exploration     ON questions(exploration_state, ai_tier)
    WHERE is_deleted = FALSE;

-- ============================================================
-- QUESTION_INTERACTIONS  (append-only event log)
-- ============================================================

CREATE TABLE question_interactions (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id      UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id          UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    interaction_type interaction_type_enum NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- context
    session_id       TEXT,
    flow_context     TEXT,       -- 'mock' | 'review' | 'explore' | 'shadow'
    dwell_ms         INTEGER,    -- milliseconds visible before skip/shallow_bounce
    metadata         JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_qi_question_id   ON question_interactions(question_id);
CREATE INDEX idx_qi_user_id       ON question_interactions(user_id);
CREATE INDEX idx_qi_question_user ON question_interactions(question_id, user_id);
CREATE INDEX idx_qi_type_created  ON question_interactions(interaction_type, created_at);

-- Prevent duplicate "qualified" positive signals from same user on same question
-- (like/save/report are idempotent by logic, not by DB constraint, since unlike/unsave exist)

-- ============================================================
-- QUESTION_SCORES  (cached ranking — written only by scoring worker)
-- ============================================================

CREATE TABLE question_scores (
    question_id      UUID        PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
    subject          TEXT        NOT NULL,
    chapter          TEXT        NOT NULL,
    difficulty       difficulty_enum NOT NULL,

    -- composite scores
    rank_score       NUMERIC(10,4) NOT NULL DEFAULT 0,
    momentum_score   NUMERIC(8,4)  NOT NULL DEFAULT 0,
    quality_score    NUMERIC(8,4)  NOT NULL DEFAULT 0,

    -- raw signal counts (used by scoring worker)
    attempts_qualified  INTEGER  NOT NULL DEFAULT 0,   -- "A" in the spec
    exposures_total     INTEGER  NOT NULL DEFAULT 0,   -- "E" in the spec
    like_count          INTEGER  NOT NULL DEFAULT 0,
    save_count          INTEGER  NOT NULL DEFAULT 0,
    skip_count          INTEGER  NOT NULL DEFAULT 0,
    shallow_bounce_count INTEGER NOT NULL DEFAULT 0,
    report_count        INTEGER  NOT NULL DEFAULT 0,
    unique_user_count   INTEGER  NOT NULL DEFAULT 0,

    -- derived rates (NULL until enough data)
    save_rate        NUMERIC(6,4),
    like_rate        NUMERIC(6,4),
    skip_rate        NUMERIC(6,4),
    report_rate      NUMERIC(6,4),

    -- pre-aggregated weighted signals (trust-weighted, set by scoring worker)
    weighted_likes   NUMERIC(8,4) NOT NULL DEFAULT 0,
    weighted_saves   NUMERIC(8,4) NOT NULL DEFAULT 0,
    weighted_skips   NUMERIC(8,4) NOT NULL DEFAULT 0,
    weighted_reports NUMERIC(8,4) NOT NULL DEFAULT 0,

    -- discovery eligibility
    is_eligible_for_discovery BOOLEAN NOT NULL DEFAULT FALSE,
    exploration_lane          exploration_lane_enum NOT NULL DEFAULT 'none',

    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qs_subject_chapter ON question_scores(subject, chapter);
CREATE INDEX idx_qs_rank_eligible   ON question_scores(rank_score DESC)
    WHERE is_eligible_for_discovery = TRUE;
CREATE INDEX idx_qs_difficulty      ON question_scores(difficulty)
    WHERE is_eligible_for_discovery = TRUE;

-- ============================================================
-- AI_MODERATION_REVIEWS
-- ============================================================

CREATE TABLE ai_moderation_reviews (
    id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id              UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at             TIMESTAMPTZ,

    -- tier decision
    tier                     ai_tier_enum,
    ai_score                 NUMERIC(5,3),

    -- component scores (each 0.000 – 1.000)
    clarity_score            NUMERIC(4,3),
    syllabus_relevance_score NUMERIC(4,3),
    answerability_score      NUMERIC(4,3),
    explanation_quality_score NUMERIC(4,3),
    duplicate_risk_score     NUMERIC(4,3),
    difficulty_confidence    NUMERIC(4,3),
    recommended_difficulty   difficulty_enum,

    -- duplicate detection
    duplicate_candidate_ids  UUID[]      NOT NULL DEFAULT '{}',
    duplicate_reason_codes   TEXT[]      NOT NULL DEFAULT '{}',

    -- rule-based check results
    -- each entry: {rule: string, severity: "hard"|"soft", message: string}
    rule_violations          JSONB       NOT NULL DEFAULT '[]',

    -- LLM raw response for audit
    llm_response             JSONB,
    model_used               TEXT,
    processing_ms            INTEGER,

    -- job execution
    error_message            TEXT,
    retry_count              INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX idx_ai_reviews_question ON ai_moderation_reviews(question_id);
CREATE INDEX idx_ai_reviews_tier     ON ai_moderation_reviews(tier)
    WHERE tier IS NOT NULL;

-- ============================================================
-- MODERATION_JOBS  (Postgres-backed job queue)
-- ============================================================

CREATE TABLE moderation_jobs (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id    UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    status         moderation_job_status_enum NOT NULL DEFAULT 'queued',
    priority       INTEGER     NOT NULL DEFAULT 5, -- lower number = higher priority
    queued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    picked_up_at   TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    next_retry_at  TIMESTAMPTZ,
    retry_count    INTEGER     NOT NULL DEFAULT 0,
    max_retries    INTEGER     NOT NULL DEFAULT 3,
    error_message  TEXT,
    worker_id      TEXT        -- used for advisory locking
);

-- Claim next available job: ORDER BY priority ASC, queued_at ASC
CREATE INDEX idx_mj_claim ON moderation_jobs(priority ASC, queued_at ASC)
    WHERE status IN ('queued','retrying');
CREATE INDEX idx_mj_question_id ON moderation_jobs(question_id);
CREATE INDEX idx_mj_retry_due   ON moderation_jobs(next_retry_at)
    WHERE status = 'retrying';

-- ============================================================
-- UPDATED_AT trigger helper
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
