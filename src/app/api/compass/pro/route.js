import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { computePrepOSInsights } from '@/../data/prepos_insights';
import { compassProjection } from '@/../data/compass_projection';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUBJECT_NAMES = Object.fromEntries(SUBJECTS.flatMap((s) => [[s.id, s.name], [toPublicSubjectId(s.id), s.name]]));

// Compass Pro: the practice projection and next move, computed from the student's own
// server-scored sessions. Pro only, enforced here. Read-only: no model call, no credits.
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  if (!(await checkPersistentRateLimit(request, { route: '/api/compass/pro', limit: 60, keyParts: [session.user.id] })).allowed) {
    return Response.json({ error: 'rate_limited' }, { status: 429, headers });
  }
  try {
    const user = await Database.getUserById(session.user.id);
    if (!user?.isPremium) return Response.json({ ok: true, locked: true }, { headers });
    const attempts = (await Database.getAttempts(session.user.id)).slice(0, 60).map((a) => ({ ...a, subject: toPublicSubjectId(a.subject) }));
    const insights = computePrepOSInsights(attempts, { subjectNames: SUBJECT_NAMES });
    const projection = compassProjection(attempts, { subjectNames: SUBJECT_NAMES, rankedChapters: insights.chapters?.ranked || [] });
    return Response.json({ ok: true, locked: false, projection, sessions: insights.sessions || 0 }, { headers });
  } catch {
    return Response.json({ ok: false, error: 'compass_unavailable', message: 'Your record could not be read just now.' }, { status: 503, headers });
  }
}
