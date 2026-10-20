import { auth } from '@/lib/auth';
import { startSession, finishSession, recordEvents } from '@/lib/server/recoverySessions';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { startPractice, finishPractice } from '@/lib/server/practiceSessions';
import { countStepOnce } from '@/lib/server/funnelOnceStore';
import { funnelStepsForSession } from '@/lib/server/funnelOnce';
import { forgetBadges } from '@/lib/server/badgesStore';
import { attemptForClient } from '@/lib/server/answerHold';

const ORIGINS = new Set(['capacitor://localhost', 'https://localhost']);
function cors(request) {
  return mobileOptions(request);
}
export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request) });
}
async function handle(request, operation, funnelKind = null) {
  const headers = { ...cors(request), 'Cache-Control': 'no-store' };
  try {
    const session = await auth(request);
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    if (!(await checkPersistentRateLimit(request, { route: '/api/sessions', limit: 60, keyParts:[session.user.id] })).allowed) return Response.json({ error: 'Too many requests' }, { status: 429, headers });
    const text = await request.text();
    if (text.length > 600000) return Response.json({ error: 'Payload too large' }, { status: 413, headers });
    const body = JSON.parse(text);
    const result = await operation(session.user.id, body);
    // A saved attempt can earn a badge: drop the student's cached badge list so the result's earned row and Progress read it fresh
    // (the list is otherwise kept for 5 minutes; BADGES-REFINE-1018).
    if (funnelKind === 'finish') forgetBadges(session.user.id);
    // Aggregate funnel, once per person and never in the way of the answer (a no-op while FUNNEL_ENABLED is off).
    const funnelSteps = funnelStepsForSession({ kind: funnelKind, body, result });
    if (funnelSteps.length) countStepOnce(session.user.id, funnelSteps, request.headers);
    // A finished Mob paper still open for the Mob answers with its marks only (src/lib/mob/paperHold.mjs): no key, no
    // explanation, no per-question right or wrong until the paper closes. Both finish paths (device ticket and durable) land here.
    return Response.json(funnelKind === 'finish' ? attemptForClient(result) : result, { headers });
  } catch (error) {
    const message = error.message || 'SESSION_REQUEST_FAILED';
    // FIRST_FULL_MOCK_TAKEN (data/first_full_mock.js): the free full mock this start was quoted went elsewhere; nothing was charged.
    const status = /FIRST_FULL_MOCK_TAKEN/.test(message) ? 409 : /FIRST_FULL_MOCK_UNCHECKED/.test(message) ? 503 : /NOT_FOUND/.test(message) ? 404 : /MIGRATION|FAILED/.test(message) ? 503 : /CREDITS|PREMIUM/.test(message) ? 402 : 422;
    // NTA refusals carry a sentence for the student and what the bank was short of.
    const extra = error.publicMessage ? { message: error.publicMessage, detail: error.publicDetail } : {};
    return Response.json({ error: message, ...extra }, { status, headers });
  }
}
export const POST = request => handle(request, (userId, body) => body.sessionId ? startPractice(userId, body) : body.episodeId ? startSession(userId, body) : body.experience === 'practice' && !body.recoveryFrom ? startPractice(userId, body) : startSession(userId, body), 'start');
export const PATCH = request => handle(request, (userId, body) => body.sessionTicket ? finishPractice(userId, body) : finishSession(userId, body), 'finish');
export const PUT = request => handle(request, recordEvents);
