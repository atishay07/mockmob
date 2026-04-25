-- Autonomous Question Generation Schema Updates

-- 1. Generation Jobs Table
CREATE TABLE IF NOT EXISTS public.generation_jobs (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id     TEXT        NOT NULL,
    chapter        TEXT        NOT NULL,
    status         TEXT        NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    priority       INTEGER     NOT NULL DEFAULT 5,        -- 1 (highest) to 10
    target_count   INTEGER     NOT NULL DEFAULT 20,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    error_message  TEXT
);

-- 2. Generation Stats Table (for Feedback Loop)
CREATE TABLE IF NOT EXISTS public.generation_stats (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id         TEXT        NOT NULL,
    subject_id     TEXT        NOT NULL,
    chapter        TEXT        NOT NULL,
    total_attempted INTEGER    NOT NULL DEFAULT 0,
    accepted_count  INTEGER    NOT NULL DEFAULT 0,
    rejected_count  INTEGER    NOT NULL DEFAULT 0,
    duplicate_count INTEGER    NOT NULL DEFAULT 0,
    avg_score       NUMERIC(4,2),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Concept Tracking Table (Optional but requested)
CREATE TABLE IF NOT EXISTS public.question_concepts (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id    UUID        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    subject_id     TEXT        NOT NULL,
    chapter        TEXT        NOT NULL,
    concept_pattern TEXT       NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_gen_jobs_status ON public.generation_jobs(status, priority);
CREATE INDEX IF NOT EXISTS idx_question_concepts_lookup ON public.question_concepts(subject_id, chapter, concept_pattern);
