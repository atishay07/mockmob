// FIX 12 (High): recovery endpoint for stuck 'processing' jobs.
//
// If a worker crashes or is killed while a job is 'processing',
// claim_moderation_job() will skip it forever because the RPC only
// picks up 'queued' and 'retrying' rows.
//
// This endpoint calls recover_stale_moderation_jobs() (migration 005),
// which resets jobs that have been 'processing' for longer than the
// stale threshold back to 'retrying' (or 'failed' if retries exhausted).
//
// Call this from a cron every 2 minutes — safely idempotent.

import { supabase } from '@/lib/supabase'

/**
 * POST /api/internal/moderation/recover
 *
 * Protected by x-internal-secret header.
 *
 * Optional body (JSON):
 * { stale_after_minutes: number }   default 2
 *
 * Response 200:
 * { recovered_count: number }
 */
export async function POST(request) {
  const secret = request.headers.get('x-internal-secret')
  if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }

  let staleAfterMinutes = 2
  try {
    const body = await request.json()
    if (typeof body?.stale_after_minutes === 'number' && body.stale_after_minutes > 0) {
      staleAfterMinutes = body.stale_after_minutes
    }
  } catch {
    // body is optional; proceed with default
  }

  const { data: recoveredCount, error } = await supabase.rpc(
    'recover_stale_moderation_jobs',
    { p_stale_after_minutes: staleAfterMinutes }
  )

  if (error) {
    console.error('[moderation/recover] RPC error:', error)
    return Response.json({ error: 'Recovery failed.' }, { status: 500 })
  }

  console.info(`[moderation/recover] recovered ${recoveredCount} stale jobs`)
  return Response.json({ recovered_count: recoveredCount ?? 0 })
}
