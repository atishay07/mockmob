-- ============================================================
-- Migration 005 — RPCs from Phase 1 audit
-- ============================================================

-- ----------------------------------------------------------------
-- FIX 5 (Critical): count DISTINCT mock sessions, not rows.
--
-- The Supabase JS client cannot express COUNT(DISTINCT session_id)
-- directly. An RPC is the clean solution.
-- NULL session_ids are excluded — a session with no ID cannot be
-- meaningfully counted as a completed mock.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION count_distinct_mock_sessions(
    p_user_id UUID,
    p_since   TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(DISTINCT session_id)::INTEGER
    FROM   question_interactions
    WHERE  user_id         = p_user_id
      AND  flow_context    = 'mock'
      AND  interaction_type = 'attempted'
      AND  session_id      IS NOT NULL
      AND  created_at      >= p_since;
$$;


-- ----------------------------------------------------------------
-- FIX 12 (High): Recovery for stuck 'processing' jobs.
--
-- If a worker crashes or times out while a job is 'processing',
-- the claim_moderation_job() RPC skips it permanently because it
-- only considers 'queued' and 'retrying' rows.
--
-- This function resets stale processing jobs back to 'retrying'
-- (or 'failed' if retries are exhausted). It is designed to be
-- called by a cron job every 2 minutes.
--
-- p_stale_after_minutes: how long a 'processing' job must be
-- untouched before it is considered stuck (default 2 minutes,
-- well above the 35 s LLM timeout enforced in code).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION recover_stale_moderation_jobs(
    p_stale_after_minutes INTEGER DEFAULT 2
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_recovered INTEGER;
BEGIN
    -- Jobs that still have retries left → reset to retrying
    UPDATE moderation_jobs
    SET    status        = 'retrying',
           next_retry_at = NOW(),
           worker_id     = NULL,
           error_message = COALESCE(error_message || ' ', '')
                           || '[recovered: stale processing at '
                           || NOW()::TEXT || ']'
    WHERE  status       = 'processing'
      AND  picked_up_at < NOW() - (p_stale_after_minutes || ' minutes')::INTERVAL
      AND  retry_count  < max_retries;

    GET DIAGNOSTICS v_recovered = ROW_COUNT;

    -- Jobs that have no retries left → mark failed
    UPDATE moderation_jobs
    SET    status        = 'failed',
           completed_at  = NOW(),
           worker_id     = NULL,
           error_message = COALESCE(error_message || ' ', '')
                           || '[failed: stale processing exhausted retries at '
                           || NOW()::TEXT || ']'
    WHERE  status       = 'processing'
      AND  picked_up_at < NOW() - (p_stale_after_minutes || ' minutes')::INTERVAL
      AND  retry_count  >= max_retries;

    RETURN v_recovered;
END;
$$;
