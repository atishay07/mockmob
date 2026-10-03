import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { computePrepOSInsights, readout } from '@/../data/prepos_insights';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUBJECT_NAMES = Object.fromEntries(SUBJECTS.flatMap((s) => [[s.id, s.name], [toPublicSubjectId(s.id), s.name]]));

// Analysis of the signed-in student's own server-scored sessions. Read-only, no model call,
// no credits. The most recent 60 sessions keep the work bounded.
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  if (!(await checkPersistentRateLimit(request, { route: '/api/prepos/insights', limit: 60, keyParts: [session.user.id] })).allowed) {
    return Response.json({ error: 'rate_limited' }, { status: 429, headers });
  }
  try {
    const attempts = (await Database.getAttempts(session.user.id)).slice(0, 60);
    const insights = computePrepOSInsights(attempts, { subjectNames: SUBJECT_NAMES });
    return Response.json({ ok: true, userId: session.user.id, insights, findings: readout(insights, { limit: 4 }), basis: 'Your server-scored sessions. Timing comes from device events.' }, { headers });
  } catch {
    return Response.json({ ok: false, error: 'insights_unavailable', message: 'Your record could not be read just now. Nothing was charged.' }, { status: 503, headers });
  }
}
