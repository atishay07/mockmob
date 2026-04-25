// FIX 6  (Critical): JOB_TIMEOUT_MS is now enforced — passed to callModerationLLM
//                    as an AbortController deadline; a thrown error triggers retry.
// FIX 12 (High):     stuck-processing recovery is a separate endpoint (recover/).
// FIX 15 (Medium):   ai_moderation_reviews rows start as is_canonical=false and are
//                    only promoted to true after all steps succeed, so failed attempts
//                    leave auditable non-canonical rows without polluting the result.
// FIX 18 (Medium):   worker_id is a per-request UUID, not process.pid.

import { supabase } from '@/lib/supabase'
import { runRuleChecks } from '@/lib/moderation/rules'
import { callModerationLLM } from '@/lib/moderation/ai'
import { assignTier, computeAiScore, EXPOSURE_BUDGETS, EXPLORATION_LANES } from '@/lib/moderation/tiering'

// FIX 18: generate a fresh UUID per invocation.
// process.pid is unreliable (undefined or 1) in serverless; a UUID
// correctly identifies this specific execution.
function freshWorkerId() {
  return `worker-${crypto.randomUUID()}`
}

// 35 s outer job timeout. callModerationLLM uses 28 s so it always
// aborts first, giving the worker time to write the retry record.
const JOB_TIMEOUT_MS = 35_000

/**
 * POST /api/internal/moderation/process
 *
 * Claims and processes the next queued moderation job.
 * Protected by x-internal-secret header.
 */
export async function POST(request) {
  const secret = request.headers.get('x-internal-secret')
  if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const jobStart  = Date.now()
  const workerId  = freshWorkerId()

  const { data: claimResult, error: claimError } = await supabase.rpc('claim_moderation_job', {
    p_worker_id: workerId,
  })

  if (claimError) {
    console.error('[moderation/process] claim error:', claimError)
    return Response.json({ error: 'Failed to claim job.' }, { status: 500 })
  }

  if (!claimResult || claimResult.length === 0) {
    return Response.json({ processed: false, reason: 'no_jobs' })
  }

  const job = claimResult[0]

  // FIX 6: outer job timeout — if processJob does not resolve within
  // JOB_TIMEOUT_MS the promise rejects and handleJobError writes a retry.
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Job processing timed out')), JOB_TIMEOUT_MS)
  )

  try {
    const result = await Promise.race([processJob(job), timeoutPromise])
    console.info(`[moderation/process] job ${job.id} ok total_ms=${Date.now() - jobStart}`)
    return Response.json({ processed: true, ...result })
  } catch (err) {
    await handleJobError(job, err)
    console.error(`[moderation/process] job ${job.id} failed total_ms=${Date.now() - jobStart}:`, err.message)
    return Response.json({ processed: false, reason: 'error', error: err.message }, { status: 500 })
  }
}

// ---- Core processing ----

async function processJob(job) {
  // 1. Load question
  const { data: question, error: qErr } = await supabase
    .from('questions')
    .select('id, author_id, subject, chapter, body, options, correct_answer, explanation, difficulty, content_hash, is_deleted')
    .eq('id', job.question_id)
    .single()

  if (qErr || !question) throw new Error(`Question ${job.question_id} not found.`)

  if (question.is_deleted) {
    await markJobCompleted(job.id)
    return { question_id: job.question_id, tier: 'REJECT', reason: 'deleted' }
  }

  // 2. Exact duplicate detection via content_hash
  const { data: duplicateRows } = await supabase
    .from('questions')
    .select('id')
    .eq('content_hash', question.content_hash)
    .neq('id', question.id)
    .eq('is_deleted', false)
    .limit(5)

  const duplicateCandidateIds = (duplicateRows ?? []).map(r => r.id)
  const isExactDuplicate      = duplicateCandidateIds.length > 0

  // 3. Rule-based checks
  const { violations } = runRuleChecks(question)

  // 4. LLM scoring (skip for known rejects; pass timeout budget to ai.js)
  const hardFail = violations.some(v => v.severity === 'hard') || isExactDuplicate
  let llmResult    = null
  let processingMs = 0
  let modelUsed    = null
  let llmRaw       = null

  if (!hardFail) {
    // callModerationLLM enforces its own 28 s AbortController; throws on timeout
    const llmResponse = await callModerationLLM(question, { timeoutMs: 28_000 })
    llmResult    = llmResponse.parsed
    processingMs = llmResponse.processingMs
    modelUsed    = llmResponse.modelUsed
    llmRaw       = llmResponse.raw
  }

  // 5. Assign tier
  const finalTier  = isExactDuplicate ? 'REJECT' : assignTier(violations, llmResult)
  const aiScore    = computeAiScore(llmResult)
  const duplicateReasonCodes = isExactDuplicate ? ['exact_content_hash_match'] : []

  // 6. Write ai_moderation_reviews — is_canonical starts FALSE.
  //    It is only promoted to TRUE after all subsequent steps succeed,
  //    so a crash between steps leaves an auditable non-canonical row.
  const { data: review, error: reviewErr } = await supabase
    .from('ai_moderation_reviews')
    .insert({
      question_id:                 question.id,
      completed_at:                new Date().toISOString(),
      tier:                        finalTier,
      ai_score:                    aiScore,
      clarity_score:               llmResult?.clarity_score ?? null,
      syllabus_relevance_score:    llmResult?.syllabus_relevance_score ?? null,
      answerability_score:         llmResult?.answerability_score ?? null,
      explanation_quality_score:   llmResult?.explanation_quality_score ?? null,
      duplicate_risk_score:        llmResult?.duplicate_risk_score ?? null,
      difficulty_confidence:       llmResult?.difficulty_confidence ?? null,
      recommended_difficulty:      llmResult?.recommended_difficulty ?? null,
      duplicate_candidate_ids:     duplicateCandidateIds,
      duplicate_reason_codes:      [...(llmResult?.reason_codes ?? []), ...duplicateReasonCodes],
      rule_violations:             violations,
      llm_response:                llmRaw ? { raw: llmRaw, parsed: llmResult } : null,
      model_used:                  modelUsed,
      processing_ms:               processingMs,
      is_canonical:                false, // promoted below after all steps succeed
    })
    .select('id')
    .single()

  if (reviewErr) {
    // Review insert failure is non-fatal for the question update, but log it.
    console.error('[moderation/process] review insert error:', reviewErr)
  }

  // 7. Update question (with potential AI auto-corrections)
  const exposureBudget  = EXPOSURE_BUDGETS[finalTier]  ?? 0
  const explorationLane = EXPLORATION_LANES[finalTier] ?? 'none'
  
  // Strict auto-approval: ONLY A and B go live immediately.
  const isLive          = finalTier === 'A' || finalTier === 'B'
  const liveAt          = isLive ? new Date().toISOString() : null
  
  let newExplorationState = 'pending';
  if (isLive) {
    newExplorationState = 'active';
  } else if (finalTier === 'REJECT') {
    newExplorationState = 'rejected';
  } // 'C' remains 'pending' for manual review or eventual drop.

  const updateData = {
    ai_tier:               finalTier,
    ai_score:              aiScore,
    recommended_difficulty: llmResult?.recommended_difficulty ?? null,
    exposure_budget:       exposureBudget,
    exploration_lane:      explorationLane,
    exploration_state:     newExplorationState,
    live_at:               liveAt,
    // Validation fixes
    ...(llmResult?.fixed_fields?.body           && { body: llmResult.fixed_fields.body }),
    ...(llmResult?.fixed_fields?.options        && { options: llmResult.fixed_fields.options }),
    ...(llmResult?.fixed_fields?.correct_answer && { correct_answer: llmResult.fixed_fields.correct_answer }),
    ...(llmResult?.fixed_fields?.explanation    && { explanation: llmResult.fixed_fields.explanation }),
  }

  const { error: updateErr } = await supabase
    .from('questions')
    .update(updateData)
    .eq('id', question.id)

  if (updateErr) throw new Error(`Failed to update question: ${updateErr.message}`)

  // 8. Initialise question_scores row
  if (isLive) {
    const { error: scoreErr } = await supabase
      .from('question_scores')
      .upsert(
        {
          question_id:               question.id,
          subject:                   question.subject,
          chapter:                   question.chapter,
          difficulty:                question.difficulty,
          rank_score:                0,
          momentum_score:            0,
          quality_score:             0,
          is_eligible_for_discovery: true,
          exploration_lane:          explorationLane,
          last_computed_at:          new Date().toISOString(),
        },
        { onConflict: 'question_id' }
      )

    if (scoreErr) {
      // Upsert failure is bad but not worth orphaning the whole job.
      // Log and continue — the scoring worker can re-create the row.
      console.error('[moderation/process] question_scores upsert error:', scoreErr)
    }
  }

  // 9. Mark job completed
  await markJobCompleted(job.id)

  // 10. FIX 15: promote review row to canonical now that everything succeeded.
  //     Uses the partial unique index (idx_air_one_canonical_per_question) to
  //     prevent duplicate canonicals on concurrent retries.
  if (review?.id) {
    const { error: canonErr } = await supabase
      .from('ai_moderation_reviews')
      .update({ is_canonical: true })
      .eq('id', review.id)

    if (canonErr) {
      console.error('[moderation/process] canonicalise review error:', canonErr)
    }
  }

  return {
    question_id: question.id,
    tier: finalTier,
    ai_score: aiScore,
    validation: {
      score: llmResult?.score ?? null,
      difficulty_correct: llmResult?.difficulty_correct ?? null,
      cuet_alignment: llmResult?.cuet_alignment ?? null,
      issues: llmResult?.issues ?? [],
    },
  }
}

async function markJobCompleted(jobId) {
  await supabase
    .from('moderation_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId)
}

async function handleJobError(job, err) {
  const nextRetryCount = (job.retry_count ?? 0) + 1
  const maxRetries     = job.max_retries ?? 3

  if (nextRetryCount >= maxRetries) {
    await supabase
      .from('moderation_jobs')
      .update({
        status:        'failed',
        retry_count:   nextRetryCount,
        error_message: err.message,
        completed_at:  new Date().toISOString(),
      })
      .eq('id', job.id)
  } else {
    // Exponential backoff: 30 s, 120 s, 480 s
    const backoffSeconds = 30 * Math.pow(4, nextRetryCount - 1)
    const nextRetryAt    = new Date(Date.now() + backoffSeconds * 1000).toISOString()

    await supabase
      .from('moderation_jobs')
      .update({
        status:        'retrying',
        retry_count:   nextRetryCount,
        error_message: err.message,
        next_retry_at: nextRetryAt,
        worker_id:     null,
      })
      .eq('id', job.id)
  }
}
