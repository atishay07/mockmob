-- ============================================================
-- Migration 003 — Schema fixes from Phase 1 audit
-- Safe to run on an empty database or after 001/002.
-- Each ALTER is idempotent where possible.
-- ============================================================

-- ----------------------------------------------------------------
-- FIX 1 (Critical): author_id NOT NULL + ON DELETE SET NULL clash
--
-- NOT NULL prevents Postgres from ever executing SET NULL when a
-- user row is deleted, turning every user deletion into a FK error.
-- Make the column nullable so SET NULL can work as intended.
-- ----------------------------------------------------------------
ALTER TABLE questions ALTER COLUMN author_id DROP NOT NULL;


-- ----------------------------------------------------------------
-- FIX 2 (Critical): content_hash — add UNIQUE to close the
-- SELECT-then-INSERT race window.
--
-- The old non-unique index is superseded; drop it to avoid
-- maintaining two indexes on the same column.
-- ----------------------------------------------------------------
DROP INDEX IF EXISTS idx_questions_content_hash;

CREATE UNIQUE INDEX idx_questions_content_hash_unique
    ON questions(content_hash)
    WHERE content_hash IS NOT NULL
      AND is_deleted = FALSE;


-- ----------------------------------------------------------------
-- FIX 3 (Critical): moderation_jobs — prevent double processing
-- when the same question is uploaded twice (retry / double-submit).
-- Only one active job (queued / processing / retrying) is allowed
-- per question at a time.
-- ----------------------------------------------------------------
CREATE UNIQUE INDEX idx_mj_one_active_per_question
    ON moderation_jobs(question_id)
    WHERE status IN ('queued','processing','retrying');


-- ----------------------------------------------------------------
-- FIX 13 (Medium — data integrity): question_scores denormalized
-- fields can drift when questions.subject / chapter / difficulty
-- are updated. A trigger keeps them in sync automatically.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_question_scores_metadata()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.subject    IS DISTINCT FROM OLD.subject
     OR NEW.chapter    IS DISTINCT FROM OLD.chapter
     OR NEW.difficulty IS DISTINCT FROM OLD.difficulty) THEN
        UPDATE question_scores
        SET    subject    = NEW.subject,
               chapter    = NEW.chapter,
               difficulty = NEW.difficulty
        WHERE  question_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Only fires when the relevant columns actually change
CREATE TRIGGER trg_questions_sync_scores_metadata
    AFTER UPDATE OF subject, chapter, difficulty ON questions
    FOR EACH ROW
    EXECUTE FUNCTION sync_question_scores_metadata();


-- ----------------------------------------------------------------
-- FIX 14 (Medium — schema constraint): flow_context stored as
-- unconstrained TEXT. Add a CHECK so direct DB writes are also
-- validated. IS NULL allowed because the column is nullable.
-- ----------------------------------------------------------------
ALTER TABLE question_interactions
    ADD CONSTRAINT chk_qi_flow_context
    CHECK (flow_context IS NULL
        OR flow_context IN ('mock','review','explore','shadow'));


-- ----------------------------------------------------------------
-- FIX 15 (Medium — data integrity): ai_moderation_reviews
-- accumulates partial rows on retries with no way to identify
-- the canonical (successful) result.
--
-- Add is_canonical flag. A partial unique index enforces that at
-- most one canonical row can exist per question.
-- ----------------------------------------------------------------
ALTER TABLE ai_moderation_reviews
    ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX idx_air_one_canonical_per_question
    ON ai_moderation_reviews(question_id)
    WHERE is_canonical = TRUE;


-- ----------------------------------------------------------------
-- FIX 17 (Medium — permissions): report_resolved and
-- answer_challenged have no privilege gate. Add is_moderator to
-- users so the API can enforce the check without a separate table.
-- ----------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT FALSE;
