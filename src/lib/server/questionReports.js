// Student reports on a question (security hotfix, 17 Oct 2026).
//
// POST /api/questions/[id]/interact with interaction_type 'report' used the service-role client
// to move a live question to status 'pending' after ONE report from any signed-in account: no
// threshold, no dedupe, no rate limit, so one person could empty the live bank. Now:
//  - a report is recorded once per account per question (until a moderator re-approves it);
//  - the route rate-limits reports per account (REPORT_POLICY.rateLimit per hour);
//  - a report never changes the question by itself. A live question goes to the moderation
//    queue (status 'pending', verification 'disputed', exploration 'pending_review', exactly
//    what getPendingQuestions reads) only when REPORT_POLICY.distinctReporters distinct accounts
//    older than a day have reported it since it last went live, or when a moderator reports it.
// No '@/' imports so node --test can load this file directly; the database client is passed in.

export const REPORT_POLICY = Object.freeze({
  distinctReporters: 3,
  minAccountAgeMs: 24 * 60 * 60 * 1000,
  rateLimit: 10,
  rateWindowMs: 60 * 60 * 1000,
});

const MODERATOR_ROLES = new Set(['moderator', 'admin']);

/** PostgREST timestamptz ('2026-05-03T06:33:18.342954+00:00') to epoch ms; 0 when missing or unreadable. */
export function toMs(value) {
  if (value == null || value === '') return 0;
  const ms = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

export function isModeratorRow(user) {
  return Boolean(user) && (user.is_moderator === true || MODERATOR_ROLES.has(user.role));
}

/**
 * Reports older than this point no longer count: the question went live again (a moderator kept
 * it: moderate_question_with_credit sets live_at = now()) or a moderator resolved the reports.
 */
export function reportResetAt(question, events = []) {
  let at = toMs(question?.live_at);
  for (const event of events || []) {
    if (event?.interaction_type === 'report_resolved') at = Math.max(at, toMs(event.created_at));
  }
  return at;
}

/** Reports that still count (after resetAt), newest first as PostgREST returned them. */
export function activeReports(events = [], resetAt = 0) {
  return (events || []).filter((event) => event?.interaction_type === 'report' && toMs(event.created_at) > resetAt);
}

/** Distinct reporters whose account is at least minAccountAgeMs old at `now`. */
export function qualifiedReporterIds(reports = [], users = [], { now = Date.now(), minAccountAgeMs = REPORT_POLICY.minAccountAgeMs } = {}) {
  const createdAt = new Map((users || []).map((user) => [String(user.id), toMs(user.created_at)]));
  const ids = new Set();
  for (const report of reports || []) {
    const id = report?.user_id == null ? '' : String(report.user_id);
    if (!id || !createdAt.has(id)) continue;
    const born = createdAt.get(id);
    if (born > 0 && now - born >= minAccountAgeMs) ids.add(id);
  }
  return ids;
}

/**
 * Record one report and decide whether the question goes to the moderation queue.
 *  db:           a supabase-js client (service role); only select/update on questions,
 *                question_interactions and users are used.
 *  question:     { id, status, live_at } as read by the route.
 *  insertReport: async () => ({ id }) inserting the question_interactions row; throws on failure.
 * Returns { status: 'duplicate' } or { status: 'recorded', interactionId, queued, reason, reporters }.
 */
export async function handleQuestionReport({ db, question, userId, insertReport, now = Date.now(), policy = REPORT_POLICY }) {
  const questionId = question.id;
  const uid = String(userId);

  const { data: events, error: eventsError } = await db
    .from('question_interactions')
    .select('user_id, interaction_type, created_at')
    .eq('question_id', questionId)
    .in('interaction_type', ['report', 'report_resolved'])
    .order('created_at', { ascending: false })
    .limit(1000);
  if (eventsError) throw eventsError;

  const resetAt = reportResetAt(question, events || []);
  const prior = activeReports(events || [], resetAt);
  if (prior.some((event) => String(event.user_id) === uid)) return { status: 'duplicate' };

  const inserted = await insertReport();
  const interactionId = inserted?.id ?? null;
  const reports = [{ user_id: uid, interaction_type: 'report', created_at: new Date(now).toISOString() }, ...prior];

  if (question.status !== 'live') {
    return { status: 'recorded', interactionId, queued: false, reason: 'not_live', reporters: null };
  }

  const reporterIds = [...new Set(reports.map((event) => String(event.user_id)))];
  const { data: users, error: usersError } = await db
    .from('users')
    .select('id, role, is_moderator, created_at')
    .in('id', reporterIds);
  if (usersError) throw usersError;

  const reporter = (users || []).find((user) => String(user.id) === uid);
  const qualified = qualifiedReporterIds(reports, users || [], { now, minAccountAgeMs: policy.minAccountAgeMs });
  const byModerator = isModeratorRow(reporter);
  if (!byModerator && qualified.size < policy.distinctReporters) {
    return { status: 'recorded', interactionId, queued: false, reason: 'below_threshold', reporters: qualified.size };
  }

  const { error: queueError } = await db
    .from('questions')
    .update({
      status: 'pending',
      verification_state: 'disputed',
      exploration_state: 'pending_review',
      updated_at: new Date(now).toISOString(),
    })
    .eq('id', questionId)
    .eq('status', 'live');
  if (queueError) throw queueError;

  return { status: 'recorded', interactionId, queued: true, reason: byModerator ? 'moderator' : 'threshold', reporters: qualified.size };
}
