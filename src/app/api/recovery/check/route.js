import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { openCheck, answerCheck } from '@/services/recovery/repairCheck';
import { buildCheckDeps } from '@/services/recovery/repairCheckDeps';

// The check that follows a Mistake Repair: one fresh, unseen bank question on the same idea (GET), marked by the server
// (POST). Part of the repair's credit: no credit is reserved, charged or released here, and no model is called.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const headers = { 'Cache-Control': 'no-store' };

async function signedIn(request) {
  const session = await auth(request);
  if (!session?.user?.id) return { response: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers }) };
  const user = await Database.getUserById(session.user.id);
  if (!user) return { response: Response.json({ ok: false, error: 'user_not_found' }, { status: 404, headers }) };
  return { user };
}

// GET /api/recovery/check?attemptId&questionId
export async function GET(request) {
  const who = await signedIn(request);
  if (who.response) return who.response;
  if (!(await checkPersistentRateLimit(request, { route: '/api/recovery/check:get', limit: 40, keyParts: [who.user.id], fallback: 'memory' })).allowed)
    return Response.json({ ok: false, error: 'rate_limited', message: 'Please wait a moment before the next check.' }, { status: 429, headers });
  const params = new URL(request.url).searchParams;
  const { http, body } = await openCheck({ user: who.user, attemptId: params.get('attemptId'), questionId: params.get('questionId'), deps: buildCheckDeps() });
  return Response.json(body, { status: http, headers });
}

// POST { attemptId, questionId, checkQuestionId, pick, requestId }
export async function POST(request) {
  const who = await signedIn(request);
  if (who.response) return who.response;
  if (!(await checkPersistentRateLimit(request, { route: '/api/recovery/check:post', limit: 20, keyParts: [who.user.id], fallback: 'memory' })).allowed)
    return Response.json({ ok: false, error: 'rate_limited', message: 'Please wait a moment before the next check.' }, { status: 429, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object')
    return Response.json({ ok: false, error: 'invalid_request', message: 'That check request was incomplete.' }, { status: 422, headers });
  const { http, body: result } = await answerCheck({
    user: who.user, attemptId: body.attemptId, questionId: body.questionId, checkQuestionId: body.checkQuestionId, pick: body.pick, requestId: body.requestId, deps: buildCheckDeps(),
  });
  return Response.json(result, { status: http, headers });
}
