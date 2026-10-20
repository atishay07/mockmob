import 'server-only';
// Reads what "Where you stand" needs and hands it to the pure builder (data/mobi_standing.js). No model, no credits.
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { computePrepOSInsights } from '@/../data/prepos_insights';
import { buildStanding } from '@/../data/mobi_standing';
import { getColleges } from '@/lib/server/myColleges';
import { offeringsFor } from '@/lib/server/duOfferings';

export const SUBJECT_NAMES = Object.fromEntries(SUBJECTS.flatMap((s) => [[s.id, s.name], [toPublicSubjectId(s.id), s.name]]));

/** The student's standing. `attempts` may be passed in when the caller already read them. Throws when the record cannot be read. */
export async function readStanding(userId, { attempts = null } = {}) {
  const rows = attempts || await Database.getAttempts(userId, { limit: 60, slim: 'insights' });
  const scored = rows.map((a) => ({ ...a, subject: toPublicSubjectId(a.subject) }));
  const insights = computePrepOSInsights(scored, { subjectNames: SUBJECT_NAMES });
  // My colleges failing to load must not hide the band: the colleges are then simply absent.
  const colleges = await getColleges(userId).catch(() => []);
  return buildStanding({ attempts: scored, colleges, offeringsFor, ranked: insights.chapters?.ranked || [], subjectNames: SUBJECT_NAMES });
}
