-- Atomic job-claim function used by the moderation worker.
-- Selects the next available job (queued or retrying/due) and marks it as
-- "processing" in a single CTE to prevent double-processing under concurrency.

CREATE OR REPLACE FUNCTION claim_moderation_job(p_worker_id TEXT)
RETURNS TABLE (
    id              UUID,
    question_id     UUID,
    retry_count     INTEGER,
    max_retries     INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id UUID;
BEGIN
    -- Pick the highest-priority, oldest eligible job and lock it immediately.
    SELECT mj.id
    INTO   v_job_id
    FROM   moderation_jobs mj
    WHERE  (
               mj.status = 'queued'
           OR (mj.status = 'retrying' AND mj.next_retry_at <= NOW())
           )
    ORDER BY mj.priority ASC, mj.queued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NULL THEN
        RETURN;  -- empty result set → no jobs available
    END IF;

    -- Claim the job atomically
    UPDATE moderation_jobs
    SET    status       = 'processing',
           picked_up_at = NOW(),
           worker_id    = p_worker_id
    WHERE  id = v_job_id;

    RETURN QUERY
    SELECT mj.id, mj.question_id, mj.retry_count, mj.max_retries
    FROM   moderation_jobs mj
    WHERE  mj.id = v_job_id;
END;
$$;
