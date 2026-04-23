-- ============================================================
-- Migration 004 — Performance indexes from Phase 1 audit
-- ============================================================

-- ----------------------------------------------------------------
-- FIX 7 (High): Covering index for the explore bucket query.
--
-- The query filters (subject, chapter, difficulty, exploration_lane,
-- is_eligible_for_discovery) and orders by rank_score DESC.
-- Without this index Postgres scans the whole table and post-filters.
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_qs_explore_bucket
    ON question_scores(subject, chapter, difficulty, exploration_lane, rank_score DESC)
    WHERE is_eligible_for_discovery = TRUE;


-- ----------------------------------------------------------------
-- FIX 8 (High): Seen-record lookup in checkQualifiedSignal.
--
-- Query: question_id = X AND user_id = Y AND interaction_type IN (...)
-- The existing idx_qi_question_user covers (question_id, user_id)
-- but Postgres still scans all rows for that pair to apply the type
-- filter. Adding interaction_type as a third column eliminates the
-- post-filter scan.
-- Drop the old two-column index — it is a strict prefix of the new
-- three-column one, so it is fully superseded.
-- ----------------------------------------------------------------
DROP INDEX IF EXISTS idx_qi_question_user;

CREATE INDEX IF NOT EXISTS idx_qi_question_user_type
    ON question_interactions(question_id, user_id, interaction_type);


-- ----------------------------------------------------------------
-- FIX 9 (High): Mock-count query runs on every like/save.
--
-- Query: user_id = X AND flow_context = 'mock'
--        AND interaction_type = 'attempted' AND created_at >= T
-- Only idx_qi_user_id existed; the remaining three columns were
-- evaluated as a post-filter scan.
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_qi_user_flow_type_created
    ON question_interactions(user_id, flow_context, interaction_type, created_at);
