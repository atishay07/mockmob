import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { repairMistake } from '@/services/recovery/mistakeRepair';
import { actionFromHref } from '@/lib/server/actionFields';

// Owner decision D1 (14 Oct 2026): the project is on Vercel Hobby with Fluid compute, which allows up to 300 s, so
// 90 s is available. The repair plans its model work to finish by about 78 s (REPAIR_BUDGET in
// src/services/recovery/repairFlow.js: 25 s per main call, 30 s per blind-check call), so a slow provider ends as a
// released credit and a clear message instead of a platform kill with the credit still reserved.
export const maxDuration = 90;

// POST { attemptId, questionId, requestId } -> AI Mistake Repair for one wrong answer.
export async function POST(request) {
  const startedAt = Date.now();
  const headers = { 'Cache-Control': 'no-store' };
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers });
  if (!checkRateLimit(request, { route: '/api/recovery/repair', limit: 12, keyParts: [session.user.id] }).allowed)
    return Response.json({ ok: false, error: 'rate_limited', message: 'Please wait a moment before the next repair.' }, { status: 429, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.attemptId !== 'string' || typeof body.questionId !== 'string')
    return Response.json({ ok: false, error: 'invalid_request', message: 'That repair request was incomplete.' }, { status: 422, headers });
  const user = await Database.getUserById(session.user.id);
  if (!user) return Response.json({ ok: false, error: 'user_not_found' }, { status: 404, headers });
  const { http, body: result } = await repairMistake({ user, attemptId: body.attemptId, questionId: body.questionId, requestId: body.requestId, startedAt });
  const out = result && typeof result.practiceHref === 'string' ? { ...result, practiceAction: actionFromHref(result.practiceHref) } : result;
  return Response.json(out, { status: http, headers });
}
