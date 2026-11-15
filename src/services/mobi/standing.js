import 'server-only';
// Reads what "Where you stand" needs and hands it to the pure builder (data/mobi_standing.js). No model, no credits.
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { computePrepOSInsights } from '@/../data/prepos_insights';
import { buildStanding } from '@/../data/mobi_standing';
import { getColleges } from '@/lib/server/myColleges';
import { offeringsFor } from '@/lib/server/duOfferings';
import { supabaseAdmin } from '@/lib/supabase';
import { openAttemptsOnly, readHeldMobPapers } from '@/lib/server/answerHold';

export const SUBJECT_NAMES = Object.fromEntries(SUBJECTS.flatMap((s) => [[s.id, s.name], [toPublicSubjectId(s.id), s.name]]));

/** The student's standing. `attempts` may be passed in when the caller already read them. Throws when the record cannot be read. */
export async function readStanding(userId, { attempts = null } = {}) {
  const read = attempts || await Database.getAttempts(userId, { limit: 60, slim: 'insights' });
  // A Mob paper still open for the Mob (src/lib/mob/paperHold.mjs) is left out until it closes: closeFastest names chapters
  // with their wrong and blank counts. Rows from the summary-function tier carry no Mob tag, so the held ids are read too;
  // a failed read throws (the standing is then unavailable, never shown with a held paper in it).
  const held = await readHeldMobPapers(supabaseAdmin(), userId);
  const rows = openAttemptsOnly(read).filter((a) => !held.byId.has(a.id));
  const scored = rows.map((a) => ({ ...a, subject: toPublicSubjectId(a.subject) }));
  const insights = computePrepOSInsights(scored, { subjectNames: SUBJECT_NAMES });
  // My colleges failing to load must not hide the band: the colleges are then simply absent.
  const colleges = await getColleges(userId).catch(() => []);
  return buildStanding({ attempts: scored, colleges, offeringsFor, ranked: insights.chapters?.ranked || [], subjectNames: SUBJECT_NAMES });
}
