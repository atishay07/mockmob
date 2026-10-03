import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { repairMistake } from '@/services/recovery/mistakeRepair';

// POST { attemptId, questionId, requestId } -> AI Mistake Repair for one wrong answer.
export async function POST(request) {
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
  const { http, body: result } = await repairMistake({ user, attemptId: body.attemptId, questionId: body.questionId, requestId: body.requestId });
  return Response.json(result, { status: http, headers });
}
