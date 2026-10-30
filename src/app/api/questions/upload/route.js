// FIX 11 (High): derive author_id from the verified JWT, never from
// the request body. Any caller could previously spoof any user_id.

import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/auth'
import { runRuleChecks } from '@/lib/moderation/rules'
import { computeContentHash } from '@/lib/moderation/hash'
import { candidateContentHashes, uploadAccepted, uploadShapeViolation, UPLOAD_ACCEPTED_STATUS } from '@/lib/moderation/uploadDedupe'
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit'
import { normalizeSubjectSelection } from '@/../data/cuet_controls'
import { canonicalChapterName, isValidTopSyllabusPair } from '@/../data/canonical_syllabus'
import { contributeEnabled, contributionsPausedResponse } from '@/lib/contribute'

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
 * Response 202 (the same for a new question and for a silent duplicate, so the route is no answer oracle):
 * {
 *   status:          "pending_moderation"
 *   rule_violations: [{rule, severity, message}]   (soft warnings about the submitted text only)
 * }
 * The uploader tracks the question in My uploads (/api/questions/mine). A duplicate stores nothing.
 */
const UPLOAD_LIMITS = [
  { route: '/api/questions/upload', limit: 30, windowMs: 60_000 },
  { route: '/api/questions/upload:day', limit: 200, windowMs: 86_400_000 },
]

export async function POST(request) {
  // Contributions are paused unless CONTRIBUTE_ENABLED=true (COMMUNITY-1018): a stable 403, before any auth, limit or database work.
  if (!contributeEnabled()) return contributionsPausedResponse()
  try {
    // ---- Auth: derive author_id from verified JWT ----
    // In development, skip JWT validation and use a fixed test user.
    let author_id
    if (false) {
      author_id = null
      console.log('[upload] 1a. dev mode — author_id:', author_id)
    } else {
      const session = await auth()
      if (session?.user?.id) {
        author_id = session.user.id
      }
      const authHeader = author_id ? null : request.headers.get('authorization')
      if (!author_id && !authHeader?.startsWith('Bearer ')) {
        return Response.json({ error: 'Authentication required.' }, { status: 401 })
      }
      const token = authHeader?.slice(7)
      if (!author_id) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !user) {
          return Response.json({ error: 'Invalid or expired token.' }, { status: 401 })
        }
        author_id = user.id
      }
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

    // Per student: stops queue flooding (each upload is a pending question plus a moderation job).
    for (const window of UPLOAD_LIMITS) {
      const limited = await checkPersistentRateLimit(request, { ...window, keyParts: [author_id], identityOnly: true, fallback: 'memory' })
      if (!limited.allowed) {
        return Response.json(
          { error: 'Too many uploads. Please wait before submitting more.' },
          { status: 429, headers: rateLimitHeaders({ ...limited, retryAfterSeconds: limited.retryAfterSeconds || 60 }) }
        )
      }
    }

    const subjectSelection = normalizeSubjectSelection({ subject })
    if (!subjectSelection.valid) {
      return Response.json(
        { error: subjectSelection.error },
        { status: subjectSelection.error === 'SUBJECT_REQUIRED' ? 400 : 422 }
      )
    }

    if (!isValidTopSyllabusPair(subjectSelection.internalSubject, chapter)) {
      return Response.json(
        { error: 'Unsupported CUET subject or chapter. Only the top 15 CUET subjects are accepted.' },
        { status: 422 }
      )
    }

    // ---- Synchronous rule-based validation ----
    const { violations } = runRuleChecks({
      body: questionBody,
      correct_answer,
      explanation,
      options,
      subject,
      chapter,
    })

    const shapeViolation = uploadShapeViolation(options, correct_answer)
    const hardViolations = [
      ...violations.filter(v => v.severity === 'hard'),
      ...(shapeViolation && !violations.some(v => v.rule === shapeViolation.rule) ? [shapeViolation] : []),
    ]
    if (hardViolations.length > 0) {
      return Response.json(
        { error: 'Question failed validation.', rule_violations: hardViolations },
        { status: 422 }
      )
    }

    // ---- Duplicate check (never depends on the submitted answer; see uploadDedupe.js) ----
    const contentHash = computeContentHash(questionBody ?? '', correct_answer ?? '')
    const accepted = () => Response.json(uploadAccepted(violations), { status: UPLOAD_ACCEPTED_STATUS })

    // Same scope as idx_questions_content_hash_unique (non-deleted rows), so the insert below cannot hit 23505 for a
    // pair this lookup missed.
    const { data: existingHash, error: hashError } = await supabase
      .from('questions')
      .select('id')
      .in('content_hash', candidateContentHashes(questionBody ?? ''))
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle()

    if (hashError) {
      console.error('[upload] duplicate check failed:', hashError.code)
      return Response.json({ error: 'Failed to save question.' }, { status: 500 })
    }
    // Same reply as a new upload, nothing stored: the body already exists with one of the allowed keys.
    if (existingHash) return accepted()

    // ---- Persist question as PENDING ----
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .insert({
        author_id,
        subject:           subjectSelection.internalSubject,
        // Syllabus v2: an old or alternative name is stored as its live chapter.
        chapter:           canonicalChapterName(subjectSelection.internalSubject, chapter.trim()),
        body:              questionBody.trim(),
        options:           options ?? null,
        correct_answer:    String(correct_answer).trim(),
        explanation:       explanation?.trim() ?? null,
        difficulty,
        difficulty_weight: getDifficultyWeight(difficulty),
        tags,
        ai_tier:           'PENDING',
        content_hash:      contentHash,
        exploration_state: 'pending',
        exploration_lane:  'none',
      })
      .select('id')
      .single()

    if (questionError) {
      // A concurrent identical upload: the same silent reply as any other duplicate.
      if (questionError.code === '23505') return accepted()
      console.error('[upload] insert failed:', questionError.code)
      return Response.json({ error: 'Failed to save question.' }, { status: 500 })
    }

    // ---- Enqueue moderation job ----
    const { error: jobError } = await supabase
      .from('moderation_jobs')
      .insert({
        question_id: question.id,
        status:      'queued',
        priority:    5,
      })
      .select('id')
      .single()

    // A missing job is picked up by the moderation recovery pass; the uploader gets the same reply either way.
    if (jobError) console.error('[upload] moderation job not enqueued for', question.id, jobError.code)

    return accepted()

  } catch (err) {
    console.error('[upload] unhandled error:', err)
    return Response.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}

function getDifficultyWeight(difficulty) {
  return { easy: 1, medium: 2, hard: 3 }[String(difficulty || '').toLowerCase()] || 2;
}
