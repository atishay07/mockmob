import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { computePrepOSInsights } from '@/../data/prepos_insights';
import { compassProjection } from '@/../data/compass_projection';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/supabase';
import { openAttemptsOnly, readHeldMobPapers } from '@/lib/server/answerHold';

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
    const [rows, held] = await Promise.all([
      Database.getAttempts(session.user.id, { limit: 60, slim: 'insights' }),
      readHeldMobPapers(supabaseAdmin(), session.user.id),
    ]);
    const attempts = rows.map((a) => ({ ...a, subject: toPublicSubjectId(a.subject) }));
    // L5 cross-lane (15 Nov 2026): the next move names a chapter with its wrong and blank counts, which would give away a
    // question of a Mob paper still open for the Mob (src/lib/mob/paperHold.mjs), so chapters are ranked without held papers
    // (by tag, and by id for the summary-function tier). The paper projections use subject totals, which a held result shows.
    const insights = computePrepOSInsights(openAttemptsOnly(attempts).filter((a) => !held.byId.has(a.id)), { subjectNames: SUBJECT_NAMES });
    const projection = compassProjection(attempts, { subjectNames: SUBJECT_NAMES, rankedChapters: insights.chapters?.ranked || [] });
    return Response.json({ ok: true, locked: false, projection, sessions: insights.sessions || 0 }, { headers });
  } catch {
    return Response.json({ ok: false, error: 'compass_unavailable', message: 'Your record could not be read just now.' }, { status: 503, headers });
  }
}
