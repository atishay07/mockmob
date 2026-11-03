import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { markRetryAnswer } from '@/services/recovery/repairRetry';
import { retryPickOf } from '@/../data/repair_retry.mjs';

// POST { attemptId, questionId, retry_pick } -> the server's marking of the student's second try on a mistake, before the
// key and the reason are shown. Free: no credit, no model, nothing written. The repair that follows carries the same pick.
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers });
  if (!checkRateLimit(request, { route: '/api/recovery/retry', limit: 40, keyParts: [session.user.id] }).allowed)
    return Response.json({ ok: false, error: 'rate_limited', message: 'Please wait a moment.' }, { status: 429, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ ok: false, error: 'invalid_request', message: 'That request was incomplete.' }, { status: 422, headers });
  const user = await Database.getUserById(session.user.id);
  if (!user) return Response.json({ ok: false, error: 'user_not_found' }, { status: 404, headers });
  const { http, body: result } = await markRetryAnswer({
    user, attemptId: body.attemptId, questionId: body.questionId, pick: retryPickOf(body),
    deps: { loadAttempt: (id) => Database.getAttemptById(id), loadQuestion: (id) => supabaseAdmin().from('questions').select('*').eq('id', id).maybeSingle() },
  });
  return Response.json(result, { status: http, headers });
}
