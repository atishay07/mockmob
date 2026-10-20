import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { readThread, attachThreadChecks, answerThreadCheck } from '@/services/mobi/doubtThread';
import { buildThreadDeps, chapterCatalog } from '@/services/mobi/doubtThreadDeps';

// A doubt thread's 2 new CUET-style questions (C-dec 3, 20 Oct 2026). Part of the thread's one credit: nothing here reserves,
// charges or releases a credit, and no model is called. Bearer (app) or cookie (web).
//   GET  ?threadId                                         the thread, its questions (no key) and any answers given
//   POST { op:'checks', threadId, subject, chapter }        attaches the 2 questions once, when the doubt named no chapter
//   POST { op:'answer', threadId, checkQuestionId, pick, requestId }   marks one answer against today's key (first answer counts)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const headers = { 'Cache-Control': 'no-store' };

async function signedIn(request, route, limit) {
  const session = await auth(request);
  if (!session?.user?.id) return { response: Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers }) };
  if (!(await checkPersistentRateLimit(request, { route, limit, keyParts: [session.user.id], fallback: 'memory' })).allowed) {
    return { response: Response.json({ ok: false, error: 'rate_limited', message: 'Please wait a moment and try again.' }, { status: 429, headers }) };
  }
  const user = await Database.getUserById(session.user.id);
  if (!user) return { response: Response.json({ ok: false, error: 'user_not_found' }, { status: 404, headers }) };
  return { user };
}

export async function GET(request) {
  const who = await signedIn(request, '/api/mobi/thread:get', 60);
  if (who.response) return who.response;
  const threadId = new URL(request.url).searchParams.get('threadId');
  const { http, body } = await readThread({ user: who.user, threadId, deps: buildThreadDeps({ user: who.user }) });
  return Response.json(body, { status: http, headers });
}

export async function POST(request) {
  const who = await signedIn(request, '/api/mobi/thread:post', 30);
  if (who.response) return who.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || typeof body.threadId !== 'string') {
    return Response.json({ ok: false, error: 'invalid_request', message: 'That request was incomplete.' }, { status: 422, headers });
  }
  const deps = buildThreadDeps({ user: who.user });
  const result = body.op === 'checks'
    ? await attachThreadChecks({ user: who.user, threadId: body.threadId, subject: body.subject, chapter: body.chapter, catalog: chapterCatalog(who.user), deps })
    : body.op === 'answer'
      ? await answerThreadCheck({ user: who.user, threadId: body.threadId, checkQuestionId: body.checkQuestionId, pick: body.pick, requestId: body.requestId, deps })
      : { http: 422, body: { ok: false, error: 'invalid_request', message: 'That request was incomplete.' } };
  return Response.json(result.body, { status: result.http, headers });
}
