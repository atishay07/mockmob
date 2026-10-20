// GET /api/attempts?view=summary: the same bare array of attempts, with only what the Android app reads.
//
// Why (18 Oct 2026, final app walk on staging): the full list returned about 29 MB for 25 attempts and the read hit
// "canceling statement due to statement timeout" (57014); Today could not load for 6 minutes. An attempt row is its
// `questions_snapshot`, and each question of a snapshot carries the whole bank row: verification evidence (about 40 KB a
// question on a server-scored paper), explanation, quality scores, authorship, votes, source fields. The query itself is
// fast (the plan was checked on staging: 0.5 ms, index attempts_user_completed_idx is used); the cost is detoasting,
// serialising and shipping that column.
//
// What the app reads from a list attempt (flutter_app/lib/core/models/attempt.dart, checked against every reader of the
// attempts list: Today, Review, Practice, You, Insights, Rhythm, Compass, Ask Mobi's instant answer):
//   attempt:   id, userId, subject, score, correct, wrong, unattempted, total, mode, formatId, completedAt
//   details:   qid, givenIndex, isCorrect, timeMs
//   selectionMeta: mode, sessionId, scoringVersion, durationMinutes, recovery (telemetry, observed.answerChanges, timeline)
//   questionsSnapshot[]: id, subject, internalSubject, chapter, difficulty, question, body, options, passageText
// Left out: the answer key and explanation of each question (the app reads them only from GET /api/attempts/{id}, through
// its key rule), verification evidence and every other bank field, and the rest of selection_meta (selection usage,
// pool stats, answer integrity, validation). Without ?view=summary nothing here runs: the response is the old one.

import { readAttemptRows } from '../../../data/attempt_reads.js';
import { formatIdFor } from './attemptSummary.js';

export const SUMMARY_VIEW = 'summary';
const QUESTION_STRING_FIELDS = ['id', 'subject', 'internalSubject', 'chapter', 'difficulty', 'question', 'passageText'];
const DETAIL_FIELDS = ['qid', 'givenIndex', 'isCorrect', 'timeMs'];
const META_FIELDS = ['mode', 'sessionId', 'scoringVersion', 'durationMinutes'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** True only for ?view=summary. Any other value (or none) is the full list, as before. */
export function isSummaryView(request) {
  try {
    return new URL(request.url).searchParams.get('view') === SUMMARY_VIEW;
  } catch { return false; }
}

export const MARKS_VIEW = 'marks';
/** True only for ?view=marks (the web Profile's count and average): [{ id, score, completedAt }] and nothing else. */
export function isMarksView(request) {
  try {
    return new URL(request.url).searchParams.get('view') === MARKS_VIEW;
  } catch { return false; }
}

/** The marks view of the attempts read with columns id, score, completed_at (attemptOut shape). */
export const marksItem = (a) => ({ id: a.id, score: a.score, completedAt: a.completedAt });

const present = (v) => v !== null && v !== undefined;

/** One snapshot question reduced to what the app shows. Missing fields are left out (the app reads them as absent). */
export function slimQuestion(q) {
  if (!isObject(q)) return q;
  const out = {};
  for (const key of QUESTION_STRING_FIELDS) if (present(q[key])) out[key] = q[key];
  // A bank row often repeats the stem in `body`; the app prints only a body that adds something, so a copy is not sent.
  if (present(q.body) && (!present(q.question) || String(q.body).trim() !== String(q.question).trim())) out.body = q.body;
  if (Array.isArray(q.options)) out.options = q.options;
  return out;
}

export function slimDetail(d) {
  if (!isObject(d)) return d;
  const out = {};
  for (const key of DETAIL_FIELDS) if (key in d && d[key] !== undefined) out[key] = d[key];
  return out;
}

export function slimSelectionMeta(meta) {
  if (!isObject(meta)) return {};
  const out = {};
  for (const key of META_FIELDS) if (present(meta[key])) out[key] = meta[key];
  if (isObject(meta.recovery)) out.recovery = meta.recovery;
  return out;
}

/** A raw `attempts` row (all twelve columns, or the slim snapshot of the database function) to the list item. */
export function summaryAttempt(r) {
  if (!r) return r;
  const meta = slimSelectionMeta(r.selection_meta);
  return {
    id: r.id,
    userId: r.user_id,
    subject: r.subject,
    score: r.score,
    correct: r.correct,
    wrong: r.wrong,
    unattempted: r.unattempted,
    total: r.total,
    details: Array.isArray(r.details) ? r.details.map(slimDetail) : [],
    questionsSnapshot: Array.isArray(r.questions_snapshot) ? r.questions_snapshot.map(slimQuestion) : [],
    selectionMeta: meta,
    mode: (meta && meta.mode) || null,
    formatId: formatIdFor({ subject: r.subject, total: r.total, selectionMeta: meta }),
    completedAt: new Date(r.completed_at).getTime(),
  };
}

// The database function public.attempts_list_summary (migration 20261018230100, not applied until the owner's go) does the
// same reduction inside Postgres, so the heavy column is never shipped to the server. Until it exists the list is read
// whole and reduced here; the answer is the same either way (summaryAttempt is applied to both).
export const SUMMARY_RPC = 'attempts_list_summary';
const RPC_RETRY_MS = 5 * 60 * 1000;
let rpcMissingAt = 0;
const PAGE = 1000;

// Only a function that is not there (PostgREST PGRST202, Postgres 42883) falls back to the table read (release 10 verifier M6,
// L6). Any other failure, a statement timeout (57014) above all, is the database under load: reading the whole heavy table then
// would make it worse, so the error goes back and the route answers 503 with a retry message.
export function rpcIsMissing(error) {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

export const SUMMARY_UNAVAILABLE = 'attempts_summary_unavailable';

async function readViaRpc(db, userId) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.rpc(SUMMARY_RPC, { p_user_id: userId })
      .order('completed_at', { ascending: false }).order('id').range(offset, offset + PAGE - 1);
    if (error) return { error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { rows };
}

/** Every attempt of the user, newest first (completed_at desc, id asc), as summary items. Throws the database error, and
 * SUMMARY_UNAVAILABLE when the function exists but failed (a timeout): the caller answers 503. */
export async function readAttemptListSummary(db, userId, { now = Date.now } = {}) {
  if (!userId) throw new Error('attempt_owner_required');
  if (typeof db.rpc === 'function' && now() - rpcMissingAt >= RPC_RETRY_MS) {
    const viaRpc = await readViaRpc(db, userId);
    if (viaRpc.rows) return viaRpc.rows.map(summaryAttempt);
    if (!rpcIsMissing(viaRpc.error)) {
      console.warn('[api/attempts] summary function failed:', viaRpc.error?.code || '', viaRpc.error?.message || viaRpc.error);
      throw Object.assign(new Error(SUMMARY_UNAVAILABLE), { code: SUMMARY_UNAVAILABLE, cause: viaRpc.error });
    }
    rpcMissingAt = now();
  }
  return (await readAttemptRows(db, userId)).map(summaryAttempt);
}

/** Test hook: forget that the function was missing. */
export function resetSummaryRpcState() { rpcMissingAt = 0; }
