// FIX 11 (High): derive author_id from the verified JWT, never from
// the request body. Any caller could previously spoof any user_id.

import { supabase } from '@/lib/supabase'
import { runRuleChecks } from '@/lib/moderation/rules'
import { computeContentHash } from '@/lib/moderation/hash'

/**
 * POST /api/questions/upload
 *
 * Requires: Authorization: Bearer <supabase-jwt>
 *
 * Request body (JSON) — author_id is NO LONGER accepted from the body:
 * {
 *   subject:        string
 *   chapter:        string
 *   body:           string
 *   options:        [{key: string, text: string}] | null
 *   correct_answer: string
 *   explanation:    string | null
 *   difficulty:     "easy" | "medium" | "hard"
 *   tags:           string[]
 * }
 *
 * Response 201:
 * {
 *   question_id:     string
 *   job_id:          string | null
 *   status:          "pending_moderation"
 *   rule_violations: [{rule, severity, message}]
 * }
 */
export async function POST(request) {
  try {
    console.log('[upload] 1. request received')

    // ---- Auth: derive author_id from verified JWT ----
    // In development, skip JWT validation and use a fixed test user.
    let author_id
    if (process.env.NODE_ENV === 'development') {
      author_id = 'test-user'
      console.log('[upload] 1a. dev mode — author_id:', author_id)
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
      author_id = user.id
    }

    // ---- Parse body ----
    let body
    try {
      body = await request.json()
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const {
      subject,
      chapter,
      body: questionBody,
      options        = null,
      correct_answer,
      explanation    = null,
      difficulty     = 'medium',
      tags           = [],
    } = body

    console.log('[upload] 2. parsed body:', {
      subject, chapter, difficulty,
      body_len: questionBody?.length,
      correct_answer,
      has_options: Array.isArray(options),
      has_explanation: !!explanation,
    })

    // ---- Supabase client check ----
    console.log('[upload] 3. supabase client:', typeof supabase?.from)

    // ---- Synchronous rule-based validation ----
    const { violations } = runRuleChecks({
      body: questionBody,
      correct_answer,
      explanation,
      options,
      subject,
      chapter,
    })

    const hardViolations = violations.filter(v => v.severity === 'hard')
    if (hardViolations.length > 0) {
      console.log('[upload] rule violations (hard):', hardViolations)
      return Response.json(
        { error: 'Question failed validation.', rule_violations: hardViolations },
        { status: 422 }
      )
    }

    // ---- Duplicate hash check ----
    const contentHash = computeContentHash(questionBody ?? '', correct_answer ?? '')

    const { data: existingHash } = await supabase
      .from('questions')
      .select('id')
      .eq('content_hash', contentHash)
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle()

    if (existingHash) {
      return Response.json(
        { error: 'An identical question already exists.', duplicate_of: existingHash.id },
        { status: 409 }
      )
    }

    // ---- Persist question as PENDING ----
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .insert({
        author_id,
        subject:           subject.trim(),
        chapter:           chapter.trim(),
        body:              questionBody.trim(),
        options:           options ?? null,
        correct_answer:    correct_answer.trim(),
        explanation:       explanation?.trim() ?? null,
        difficulty,
        tags,
        ai_tier:           'PENDING',
        content_hash:      contentHash,
        exploration_state: 'pending',
        exploration_lane:  'none',
      })
      .select('id')
      .single()

    console.log('[upload] 4. insert result — question:', question, 'error:', questionError)

    if (questionError) {
      if (questionError.code === '23505') {
        return Response.json(
          { error: 'An identical question already exists.' },
          { status: 409 }
        )
      }
      return Response.json(
        { error: 'Failed to save question.', detail: questionError.message, code: questionError.code },
        { status: 500 }
      )
    }

    // ---- Enqueue moderation job ----
    const { data: job, error: jobError } = await supabase
      .from('moderation_jobs')
      .insert({
        question_id: question.id,
        status:      'queued',
        priority:    5,
      })
      .select('id')
      .single()

    console.log('[upload] 5. job creation — job:', job, 'error:', jobError)

    if (jobError) {
      return Response.json(
        {
          question_id:     question.id,
          job_id:          null,
          status:          'pending_moderation',
          warning:         'Moderation job could not be enqueued. Will retry automatically.',
          job_error:       jobError.message,
          rule_violations: violations.filter(v => v.severity === 'soft'),
        },
        { status: 201 }
      )
    }

    return Response.json(
      {
        question_id:     question.id,
        job_id:          job.id,
        status:          'pending_moderation',
        rule_violations: violations.filter(v => v.severity === 'soft'),
      },
      { status: 201 }
    )

  } catch (err) {
    console.error('[upload] unhandled error:', err)
    return Response.json(
      { error: 'Unexpected server error.', message: err.message, stack: err.stack },
      { status: 500 }
    )
  }
}
