import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { computePrepOSInsights, readout } from '@/../data/prepos_insights';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/supabase';
import { openAttemptsOnly, readHeldMobPapers } from '@/lib/server/answerHold';

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
    // L5 (15 Nov 2026): a Mob paper still open for the Mob is not in the record until it closes, as in Ask Mobi's record
    // (src/lib/mob/paperHold.mjs): weak chapters, the slowest answers and answer changes name its questions and their right or
    // wrong. Held by its tag and, because the summary-function tier of an 'insights' read drops the tag, by its id too.
    const [rows, held] = await Promise.all([
      Database.getAttempts(session.user.id, { limit: 60, slim: 'insights' }),
      readHeldMobPapers(supabaseAdmin(), session.user.id),
    ]);
    const attempts = openAttemptsOnly(rows).filter((a) => !held.byId.has(a.id));
    const insights = computePrepOSInsights(attempts, { subjectNames: SUBJECT_NAMES });
    return Response.json({ ok: true, userId: session.user.id, insights, findings: readout(insights, { limit: 4 }), basis: 'Your server-scored sessions. Timing comes from device events.' }, { headers });
  } catch {
    return Response.json({ ok: false, error: 'insights_unavailable', message: 'Your record could not be read just now. Nothing was charged.' }, { status: 503, headers });
  }
}
