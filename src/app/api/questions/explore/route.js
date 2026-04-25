// FIX 4  (Critical): per-difficulty cursors replace the single shared cursor.
// FIX 10 (High):     strip correct_answer, explanation, recommended_difficulty
//                    from the explore response — answers must never appear in
//                    the discovery feed.

import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/auth'
import { Database } from '@/../data/db'

export const dynamic = 'force-dynamic'

const DIFFICULTY_QUOTAS = { easy: 0.10, medium: 0.60, hard: 0.30 }

/**
 * GET /api/questions/explore
 *
 * Query parameters:
 *   subject         (required)
 *   chapter         (optional)
 *   limit           (optional, default 20, max 50)
 *   lane            (optional, default "standard")
 *   cursor_easy     (optional) — rank_score exclusive upper bound for easy bucket
 *   cursor_medium   (optional) — rank_score exclusive upper bound for medium bucket
 *   cursor_hard     (optional) — rank_score exclusive upper bound for hard bucket
 *
 * Response 200:
 * {
 *   questions: [...],
 *   next_cursors: {
 *     cursor_easy:   string | null,
 *     cursor_medium: string | null,
 *     cursor_hard:   string | null
 *   }
 * }
 *
 * Pagination: pass all three next_cursors values back on the next request.
 * A null cursor for a bucket means that bucket is exhausted.
 */
export async function GET(request) {
  const { searchParams } = request.nextUrl

  const subject = searchParams.get('subject')
  if (!subject) {
    return Response.json({ error: '"subject" query param is required.' }, { status: 400 })
  }

  const chapter  = searchParams.get('chapter') ?? null
  const lane     = searchParams.get('lane') ?? 'standard'
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit    = Math.min(Math.max(rawLimit, 1), 50)

  const validLanes = ['standard', 'shadow', 'fast_track']
  if (!validLanes.includes(lane)) {
    return Response.json(
      { error: `"lane" must be one of: ${validLanes.join(', ')}.` },
      { status: 400 }
    )
  }

  // Per-difficulty cursors — each bucket pages independently
  const cursors = {
    easy:   parseCursor(searchParams.get('cursor_easy')),
    medium: parseCursor(searchParams.get('cursor_medium')),
    hard:   parseCursor(searchParams.get('cursor_hard')),
  }

  // Fetch all three buckets in parallel
  const [easyRows, mediumRows, hardRows] = await Promise.all([
    fetchBucket({ subject, chapter, difficulty: 'easy',   lane, limit, cursor: cursors.easy }),
    fetchBucket({ subject, chapter, difficulty: 'medium', lane, limit, cursor: cursors.medium }),
    fetchBucket({ subject, chapter, difficulty: 'hard',   lane, limit, cursor: cursors.hard }),
  ])

  const buckets = { easy: easyRows, medium: mediumRows, hard: hardRows }

  const { result: merged, lastConsumed } = interleaveByQuota(buckets, DIFFICULTY_QUOTAS, limit)
  const session = await auth().catch(() => null)
  if (session?.user?.id && merged.length > 0) {
    const voteMap = await Database.getUserVotes(session.user.id, merged.map((row) => row.question_id))
    for (const row of merged) {
      if (row.questions) row.questions.userVote = voteMap.get(row.question_id) || null
    }
  }

  // Build next_cursors: the rank_score of the last item served from each bucket.
  // A null means nothing was served from that bucket this page (exhausted or target = 0).
  const next_cursors = {
    cursor_easy:   lastConsumed.easy   !== null ? String(lastConsumed.easy)   : null,
    cursor_medium: lastConsumed.medium !== null ? String(lastConsumed.medium) : null,
    cursor_hard:   lastConsumed.hard   !== null ? String(lastConsumed.hard)   : null,
  }

  return Response.json({ questions: merged, next_cursors })
}

// ---- helpers ----

function parseCursor(raw) {
  if (!raw) return null
  const f = parseFloat(raw)
  return Number.isFinite(f) ? f : null
}

async function fetchBucket({ subject, chapter, difficulty, lane, limit, cursor }) {
  // Fetch slightly more than the quota share to give the interleaver
  // headroom when other buckets are exhausted.
  const quota       = DIFFICULTY_QUOTAS[difficulty]
  const bucketLimit = Math.ceil(limit * quota) + 3

  const buildQuery = (withVotes) => {
    let query = supabase
      .from('question_scores')
      .select(`
      question_id,
      rank_score,
      momentum_score,
      quality_score,
      attempts_qualified,
      exposures_total,
      save_rate,
      like_rate,
      skip_rate,
      report_rate,
      exploration_lane,
      questions!inner (
        id,
        subject,
        chapter,
        body,
        options,
        difficulty,
        tags,
        ai_tier,
        ai_score,
        verification_state,
        quality_band,
        ${withVotes ? 'upvotes, downvotes, score,' : ''}
        live_at
      )
    `)
      .eq('subject', subject)
      .eq('difficulty', difficulty)
      .eq('exploration_lane', lane)
      .eq('is_eligible_for_discovery', true)
      .order('rank_score', { ascending: false })
      .limit(bucketLimit)

    if (withVotes) query = query.gte('questions.score', 0)
    if (chapter) query = query.eq('chapter', chapter)
    // Per-difficulty cursor: only return items ranked below this score
    if (cursor !== null) query = query.lt('rank_score', cursor)
    return query
  }

  let { data, error } = await buildQuery(true)
  if (error && (error.code === '42703' || /score|upvotes|downvotes|column .* does not exist/i.test(error.message || ''))) {
    ({ data, error } = await buildQuery(false))
  }

  if (error) {
    console.error(`[explore] bucket fetch error (${difficulty}):`, error)
    return []
  }

  return (data ?? []).sort((a, b) => {
    const aScore = a.questions?.score ?? 0
    const bScore = b.questions?.score ?? 0
    const aBoost = aScore > 5 ? 1000 : 0
    const bBoost = bScore > 5 ? 1000 : 0
    return (bBoost + bScore + Number(b.rank_score || 0)) - (aBoost + aScore + Number(a.rank_score || 0))
  })
}

/**
 * Interleave rows from the three difficulty buckets according to quota
 * weights while preserving intra-bucket rank order.
 *
 * Returns { result, lastConsumed } where lastConsumed holds the
 * rank_score of the last item taken from each bucket (null if none taken).
 */
function interleaveByQuota(buckets, quotas, totalLimit) {
  const result  = []
  const indices = { easy: 0, medium: 0, hard: 0 }
  const counts  = { easy: 0, medium: 0, hard: 0 }

  const easyTarget   = Math.round(totalLimit * quotas.easy)
  const mediumTarget = Math.round(totalLimit * quotas.medium)
  const targets = {
    easy:   easyTarget,
    medium: mediumTarget,
    hard:   totalLimit - easyTarget - mediumTarget,
  }

  while (result.length < totalLimit) {
    let added = false
    // 1. First pass: try to respect targets
    for (const diff of ['medium', 'easy', 'hard']) {
      if (counts[diff] < targets[diff] && indices[diff] < buckets[diff].length) {
        result.push(buckets[diff][indices[diff]])
        indices[diff]++
        counts[diff]++
        added = true
        if (result.length >= totalLimit) break
      }
    }
    
    // 2. Second pass: if we haven't reached totalLimit and first pass didn't add anything 
    // (meaning some buckets hit targets but others are empty), borrow from any available bucket.
    if (!added) {
      for (const diff of ['medium', 'easy', 'hard']) {
        if (indices[diff] < buckets[diff].length) {
          result.push(buckets[diff][indices[diff]])
          indices[diff]++
          counts[diff]++
          added = true
          if (result.length >= totalLimit) break
        }
      }
    }

    if (!added) break
  }

  const lastConsumed = {
    easy:   indices.easy   > 0 ? buckets.easy[indices.easy - 1].rank_score     : null,
    medium: indices.medium > 0 ? buckets.medium[indices.medium - 1].rank_score : null,
    hard:   indices.hard   > 0 ? buckets.hard[indices.hard - 1].rank_score     : null,
  }

  return { result, lastConsumed }
}
