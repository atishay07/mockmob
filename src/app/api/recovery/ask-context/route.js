import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { loadQuestionContext } from '@/services/recovery/askContext';
import { buildCheckDeps } from '@/services/recovery/repairCheckDeps';

// GET /api/recovery/ask-context?q=<attemptId>:<questionId> -> the one-line context the Ask screen shows above the composer
// when it is opened from a repair ("Ask Mobi about this question"): a short stem, the chapter, the repair's rule and the
// cost of a written reply. Free; no model. The full context a reply uses is built again on the server at send time.
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers });
  if (!(await checkPersistentRateLimit(request, { route: '/api/recovery/ask-context', limit: 30, keyParts: [session.user.id], fallback: 'memory' })).allowed)
    return Response.json({ ok: false, error: 'rate_limited', message: 'Please wait a moment.' }, { status: 429, headers });
  const user = await Database.getUserById(session.user.id);
  if (!user) return Response.json({ ok: false, error: 'user_not_found' }, { status: 404, headers });
  const loaded = await loadQuestionContext({ user, ref: new URL(request.url).searchParams.get('q'), deps: buildCheckDeps() });
  if (!loaded.ok) return Response.json({ ok: false, error: loaded.error, message: loaded.message }, { status: loaded.http, headers });
  return Response.json({ ok: true, context: loaded.preview }, { headers });
}
