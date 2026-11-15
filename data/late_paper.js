// A device-held paper sent after its upload grace (bugs-core B8, owner option a, 15 Nov 2026). Mobile data drops near exam
// halls and hostels, so a paper answered offline often reaches the server long after its timer ended. Before this rule it was
// refused 2 minutes after the deadline and every answer was lost. Now (pure; src/lib/server/practiceSessions.js finishPractice
// applies it):
//   * on time   up to SUBMISSION_GRACE_MS after the deadline: unchanged.
//   * late      after that and up to LATE_WINDOW_MS after the deadline: accepted. The sealed ticket proves who started which
//               paper and when; only the events stamped at or before the paper's own limit count (everything from the first
//               event past it is dropped), and the answers scored are the ones those events hold, never the answer map the
//               device sent beside them. The attempt carries selection_meta.late = true and lateArrivedAt.
//   * expired   later than that: refused with SESSION_EXPIRED, as every send past the grace was before.
// A late paper counts for the student's own record (result, Review, repairs, study day) and is kept out of everything that
// compares students (src/lib/server/latePapers.js), because its answer times are the device's word only and its answers could
// have been looked up in the days between.
import { SUBMISSION_GRACE_MS } from './session_draft.js';
import { MAX_SESSION_EVENTS } from './recovery.js';

export { SUBMISSION_GRACE_MS };
export const LATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** 'on_time' | 'late' | 'expired' for a send at `now` of a paper whose deadline is `expiresAtMs`. */
export function submitTiming(expiresAtMs, now = Date.now()) {
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(now)) return 'expired';
  if (now <= expiresAtMs + SUBMISSION_GRACE_MS) return 'on_time';
  if (now <= expiresAtMs + LATE_WINDOW_MS) return 'late';
  return 'expired';
}

/** Is this attempt (or its selection_meta) a late paper? */
export function isLatePaper(value) {
  const meta = value && typeof value === 'object' && 'selectionMeta' in value ? value.selectionMeta : value?.selection_meta ?? value;
  return meta?.late === true;
}

/**
 * What a late send may score: { answers, events }. events are the sent events up to (not including) the first one that is not a
 * plain object with a paper clock inside [0, durationMs]; answers are what those events' answer events hold for questions of the
 * paper (the last one per question wins; a null clears it). An answer the device holds with no event before the deadline is
 * not scored.
 */
export function lateSubmission(questions, events, durationMs) {
  const byId = new Map((Array.isArray(questions) ? questions : []).filter((q) => q && typeof q.id === 'string').map((q) => [q.id, q]));
  const kept = [];
  const answers = {};
  if (!Number.isFinite(durationMs) || durationMs <= 0) return { answers, events: kept };
  for (const event of Array.isArray(events) ? events.slice(0, MAX_SESSION_EVENTS) : []) {
    if (!event || typeof event !== 'object' || Array.isArray(event) || !Number.isFinite(event.at) || event.at < 0 || event.at > durationMs) break;
    kept.push(event);
    if (event.type !== 'answer') continue;
    const q = byId.get(event.qid);
    if (!q) continue;
    if (event.answer === null) delete answers[q.id];
    else if (Number.isInteger(event.answer) && event.answer >= 0 && event.answer < (Array.isArray(q.options) ? q.options.length : 0)) answers[q.id] = event.answer;
  }
  return { answers, events: kept };
}

/** The selection_meta fields a late paper carries. */
export const lateMeta = (now = Date.now()) => ({ late: true, lateArrivedAt: new Date(now).toISOString() });
