// FIX 5  (Critical): count DISTINCT mock sessions, not individual attempt rows.
// FIX 11 (High):     derive user_id from verified JWT, never from the request body.
// FIX 16 (Medium):   require dwell_ms for skip / shallow_bounce.
// FIX 17 (Medium):   gate report_resolved / answer_challenged on is_moderator.

import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/auth'
import { Database } from '@/../data/db'

const VALID_INTERACTION_TYPES = new Set([
  'seen', 'attempted', 'like', 'unlike', 'save', 'unsave',
  'report', 'report_resolved', 'explanation_opened',
  'answer_challenged', 'skip', 'shallow_bounce',
])

const VALID_FLOW_CONTEXTS    = new Set(['mock', 'review', 'explore', 'shadow'])
const POSITIVE_SIGNAL_TYPES  = new Set(['like', 'save'])
const SUPPRESSED_IN_TIMED_MOCK = new Set(['skip', 'shallow_bounce'])
const REQUIRES_DWELL_MS      = new Set(['skip', 'shallow_bounce'])
const MODERATOR_ONLY_TYPES   = new Set(['report_resolved', 'answer_challenged'])

/**
 * POST /api/questions/[id]/interact
 *
 * Requires: Authorization: Bearer <supabase-jwt>
 *
 * Request body — user_id is NO LONGER accepted from the body:
 * {
 *   interaction_type: string
 *   session_id:       string | null
 *   flow_context:     "mock" | "review" | "explore" | "shadow"
 *   dwell_ms:         number   — required for skip / shallow_bounce
 *   metadata:         object | null
 * }
 */
export async function POST(request, { params }) {
  const { id: questionId } = await params

  // ---- Auth: derive user_id from verified JWT ----
  let user_id
  const session = await auth().catch(() => null)
  if (session?.user?.id) {
    user_id = session.user.id
  } else {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Authentication required.' }, { status: 401 })
    }
    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return Response.json({ error: 'Invalid or expired token.' }, { status: 401 })
    }
    user_id = user.id
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const {
    interaction_type,
    session_id   = null,
    flow_context = 'explore',
    dwell_ms     = null,
    metadata     = {},
  } = body

  // ---- Basic field validation ----
  if (!VALID_INTERACTION_TYPES.has(interaction_type)) {
    return Response.json(
      { error: `"interaction_type" must be one of: ${[...VALID_INTERACTION_TYPES].join(', ')}.` },
      { status: 400 }
    )
  }

  if (flow_context && !VALID_FLOW_CONTEXTS.has(flow_context)) {
    return Response.json(
      { error: `"flow_context" must be one of: ${[...VALID_FLOW_CONTEXTS].join(', ')}.` },
      { status: 400 }
    )
  }

  // FIX 16: dwell_ms required for skip / shallow_bounce
  if (REQUIRES_DWELL_MS.has(interaction_type)) {
    if (typeof dwell_ms !== 'number' || dwell_ms < 0) {
      return Response.json(
        { error: `"dwell_ms" must be a non-negative number for "${interaction_type}".` },
        { status: 400 }
      )
    }
  }

  // ---- Suppress passive negatives in timed mock ----
  if (flow_context === 'mock' && SUPPRESSED_IN_TIMED_MOCK.has(interaction_type)) {
    return Response.json(
      { error: `"${interaction_type}" must not be emitted in timed mock flow.` },
      { status: 422 }
    )
  }

  // FIX 17: moderator-only interaction types
  if (MODERATOR_ONLY_TYPES.has(interaction_type)) {
    const { data: userRecord } = await supabase
      .from('users')
      .select('is_moderator')
      .eq('id', user_id)
      .single()

    if (!userRecord?.is_moderator) {
      return Response.json(
        { error: 'This action requires moderator privileges.' },
        { status: 403 }
      )
    }
  }

  // ---- Load question (existence + authorship) ----
  const { data: question, error: qError } = await supabase
    .from('questions')
    .select('id, author_id, live_at, is_deleted, subject, chapter, correct_answer, status')
    .eq('id', questionId)
    .single()

  if (qError || !question) {
    return Response.json({ error: 'Question not found.' }, { status: 404 })
  }

  if (question.is_deleted) {
    return Response.json({ error: 'Question has been removed.' }, { status: 410 })
  }

  if (POSITIVE_SIGNAL_TYPES.has(interaction_type) && question.author_id === user_id) {
    return Response.json({ error: 'Authors cannot like or save their own questions.' }, { status: 422 })
  }

  // ---- Qualified like/save checks ----
  if (POSITIVE_SIGNAL_TYPES.has(interaction_type)) {
    const qualifiedError = await checkQualifiedSignal(user_id, questionId, flow_context)
    if (qualifiedError) {
      return Response.json({ error: qualifiedError }, { status: 422 })
    }
  }

  // ---- Insert interaction (append-only) ----
  const { data: interaction, error: insertError } = await supabase
    .from('question_interactions')
    .insert({
      question_id:      questionId,
      user_id,
      interaction_type,
      session_id,
      flow_context,
      dwell_ms:  typeof dwell_ms === 'number' ? dwell_ms : null,
      metadata:  metadata ?? {},
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[interact] insert error:', insertError)
    return Response.json({ error: 'Failed to record interaction.' }, { status: 500 })
  }

  await updateLearningProgress({
    user_id,
    question,
    interaction_type,
    dwell_ms,
    metadata,
  })

  if (interaction_type === 'report') {
    const reportError = await queueReportedQuestion(questionId)
    if (reportError) {
      console.error('[interact] report queue error:', reportError)
      return Response.json({ error: 'Report was recorded, but queueing for moderation failed.' }, { status: 500 })
    }
  }

  return Response.json({ interaction_id: interaction.id }, { status: 201 })
}

async function queueReportedQuestion(questionId) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('questions')
    .update({
      status: 'pending',
      verification_state: 'disputed',
      exploration_state: 'pending_review',
      updated_at: now,
    })
    .eq('id', questionId)
    .neq('status', 'rejected')

  if (error) return error
  return null
}

/**
 * Enforces "qualified like" rules from the spec.
 * FIX 5: mock eligibility now counts DISTINCT session_ids via an RPC,
 * not individual attempted rows.
 */
async function checkQualifiedSignal(userId, questionId, flowContext) {
  if (flowContext !== 'mock' && flowContext !== 'review') {
    return 'Likes and saves are only valid inside a completed mock or answer-review flow.'
  }

  // User must have seen or attempted the question
  const { data: seenRecord } = await supabase
    .from('question_interactions')
    .select('id')
    .eq('question_id', questionId)
    .eq('user_id', userId)
    .in('interaction_type', ['seen', 'attempted'])
    .limit(1)
    .maybeSingle()

  if (!seenRecord) {
    return 'You must have seen or attempted this question before liking or saving it.'
  }

  const userRow = await Database.getUserById(userId)
  if (!userRow) return 'User not found.'

  const accountAgeHours = (Date.now() - Number(userRow.createdAt || 0)) / 3_600_000
  if (accountAgeHours >= 24) return null
  if (userRow.isPremium) return null

  // FIX 5: count DISTINCT mock sessions via RPC, not raw row count.
  // The old query counted individual attempted rows — 5 questions in 1
  // mock = 5, which falsely cleared the ≥ 2 sessions threshold.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString()

  const { data: sessionCount, error: rpcError } = await supabase.rpc(
    'count_distinct_mock_sessions',
    { p_user_id: userId, p_since: thirtyDaysAgo }
  )

  if (rpcError) {
    console.error('[interact] count_distinct_mock_sessions error:', rpcError)
    return 'Could not verify mock session history. Please try again.'
  }

  if ((sessionCount ?? 0) >= 2) return null

  return 'Account too new. Complete 2 mocks or wait 24 hours before liking questions.'
}

async function updateLearningProgress({ user_id, question, interaction_type, dwell_ms, metadata }) {
  if (!['seen', 'attempted', 'skip'].includes(interaction_type)) return

  const selectedKey = metadata?.selected_key == null ? null : String(metadata.selected_key)
  const correctKey = question.correct_answer == null ? null : String(question.correct_answer)
  const isAttempt = interaction_type === 'attempted'
  const isCorrect = isAttempt && selectedKey !== null && correctKey !== null && selectedKey === correctKey

  const patch = {
    user_id,
    question_id: question.id,
    subject: question.subject || null,
    chapter: question.chapter || null,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: readError } = await supabase
    .from('user_question_progress')
    .select('*')
    .eq('user_id', user_id)
    .eq('question_id', question.id)
    .maybeSingle()

  if (readError) {
    console.warn('[interact] progress read skipped:', readError.message)
    return
  }

  patch.seen_count = (existing?.seen_count || 0) + (interaction_type === 'seen' ? 1 : 0)
  patch.attempt_count = (existing?.attempt_count || 0) + (isAttempt ? 1 : 0)
  patch.correct_count = (existing?.correct_count || 0) + (isCorrect ? 1 : 0)
  patch.skip_count = (existing?.skip_count || 0) + (interaction_type === 'skip' ? 1 : 0)
  patch.last_selected_key = isAttempt ? selectedKey : existing?.last_selected_key || null
  patch.last_correct = isAttempt ? isCorrect : existing?.last_correct ?? null
  patch.best_dwell_ms = typeof dwell_ms === 'number'
    ? Math.min(existing?.best_dwell_ms || dwell_ms, dwell_ms)
    : existing?.best_dwell_ms || null
  patch.last_seen_at = interaction_type === 'seen'
    ? patch.updated_at
    : existing?.last_seen_at || null
  patch.last_attempted_at = isAttempt
    ? patch.updated_at
    : existing?.last_attempted_at || null

  const { error: writeError } = await supabase
    .from('user_question_progress')
    .upsert(patch, { onConflict: 'user_id,question_id' })

  if (writeError) {
    console.warn('[interact] progress write skipped:', writeError.message)
  }
}
