import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { openPractice } from '@/../data/practice_ticket';
import { publicationEligibility, sharedEligibilitySnapshot } from '@/../data/evidence_registry';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { checkSessionAnswer, isCheckError, checkErrorBody } from '@/lib/server/sessionCheck';

export const dynamic = 'force-dynamic';
const secret = () => process.env.PRACTICE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: mobileOptions(request) });
}

// POST /api/sessions/{id}/check  {qid, answer, sessionTicket?}
export async function POST(request, { params }) {
  const headers = { ...mobileOptions(request), 'Cache-Control': 'no-store' };
  const json = (body, status = 200) => Response.json(body, { status, headers });
  try {
    const session = await auth(request);
    if (!session?.user?.id) return json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401);
    const userId = session.user.id;
    // Off until submit scoring applies session_check_log (applyCheckedAnswers); otherwise the key is an oracle.
    if (process.env.SESSION_CHECK_ENABLED !== '1') return json({ error: 'check_not_available', message: 'Answers are not checked during this kind of session.' }, 403);
    const limit = await checkPersistentRateLimit(request, { route: '/api/sessions/check', limit: 60, keyParts: [userId] });
    if (!limit.allowed) return json({ error: 'rate_limited', message: 'Too many checks. Try again in a minute.' }, 429);
    const text = await request.text();
    if (text.length > 600000) return json({ error: 'invalid_request', message: 'The request is too large.' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_request', message: 'Send a question id and an answer index.' }, 422);
    const { id } = await params;
    const result = await checkSessionAnswer({
      db: supabaseAdmin(), userId, sessionId: id, qid: body.qid, answer: body.answer, sessionTicket: body.sessionTicket,
      openTicket: (ticket, uid, now) => openPractice(ticket, secret(), uid, now),
      attemptExists: async attemptId => !!(await Database.getAttemptById(attemptId)),
      eligible: row => publicationEligibility(row, sharedEligibilitySnapshot()).eligible,
    });
    return json(result);
  } catch (error) {
    if (isCheckError(error)) return json(checkErrorBody(error), error.status);
    console.error('[api/sessions/:id/check] failed:', error);
    return json({ error: 'unavailable', message: 'Checking is unavailable right now.' }, 503);
  }
}
