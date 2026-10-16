import { auth } from '@/lib/auth';
import { startSession, finishSession, recordEvents } from '@/lib/server/recoverySessions';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { startPractice, finishPractice } from '@/lib/server/practiceSessions';
import { countStepOnce } from '@/lib/server/funnelOnceStore';
import { funnelStepsForSession } from '@/lib/server/funnelOnce';

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
    // Aggregate funnel, once per person and never in the way of the answer (a no-op while FUNNEL_ENABLED is off).
    const funnelSteps = funnelStepsForSession({ kind: funnelKind, body, result });
    if (funnelSteps.length) countStepOnce(session.user.id, funnelSteps, request.headers);
    return Response.json(result, { headers });
  } catch (error) {
    const message = error.message || 'SESSION_REQUEST_FAILED';
    const status = /NOT_FOUND/.test(message) ? 404 : /MIGRATION|FAILED/.test(message) ? 503 : /CREDITS|PREMIUM/.test(message) ? 402 : 422;
    // NTA refusals carry a sentence for the student and what the bank was short of.
    const extra = error.publicMessage ? { message: error.publicMessage, detail: error.publicDetail } : {};
    return Response.json({ error: message, ...extra }, { status, headers });
  }
}
export const POST = request => handle(request, (userId, body) => body.sessionId ? startPractice(userId, body) : body.episodeId ? startSession(userId, body) : body.experience === 'practice' && !body.recoveryFrom ? startPractice(userId, body) : startSession(userId, body), 'start');
export const PATCH = request => handle(request, (userId, body) => body.sessionTicket ? finishPractice(userId, body) : finishSession(userId, body), 'finish');
export const PUT = request => handle(request, recordEvents);
