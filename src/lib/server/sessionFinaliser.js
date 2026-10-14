// B11: server-side finalisation of durable sessions at their deadline.
// Free of Next and Supabase imports: the store and episode hook are injected so node:test can run it.
import { scoreSession, scorePracticeSubmission } from '../../../data/recovery.js';
import { applyCheckedAnswers, checkedAnswersForSubmit } from './sessionCheck.js';

export const FINALISE_GRACE_MS = 120000;
export const FINALISE_MARGIN_MS = 2000; // Keeps the app clock from running ahead of the database clock.
export const FINALISE_BATCH = 50;

const ms = value => (value instanceof Date ? value.getTime() : Date.parse(value));

/** Builds the attempt payload for one expired durable session from acknowledged events only. */
export function scoreExpiredSession(row, checked = []) {
  const events = Array.isArray(row.events) ? row.events : [];
  let answers = {};
  for (const event of events) if (event.type === 'answer') answers[event.qid] = event.answer;
  // A per-answer check (B13) made that answer final; the deadline path honours it like submit does.
  answers = applyCheckedAnswers(answers, checked);
  const duration = ms(row.expires_at) - ms(row.created_at);
  const ordinary = row.selection_meta?.contentEvidence === 'legacy_bank';
  let invalidTelemetry = false;
  let score;
  try {
    score = ordinary ? scorePracticeSubmission(row.questions, answers, events, duration) : scoreSession(row.questions, answers, events, duration);
  } catch (error) {
    // Unusable telemetry must not strand a session; the answers themselves are still validated.
    if (!/^invalid_event|^unknown_question/.test(error?.message || '')) throw error;
    score = scoreSession(row.questions, answers, [], duration);
    invalidTelemetry = true;
  }
  if (invalidTelemetry) score.recovery.telemetry = 'invalid';
  return { ...score, subject: row.subject, questionsSnapshot: row.questions, expected_event_count: events.length,
    selectionMeta: { ...row.selection_meta, scoringVersion: ordinary ? 'server_practice_v1' : 'server_snapshot_v1',
      recovery: score.recovery, finalisedBy: 'server_deadline' } };
}

// Sessions that expired before this instant are never finalised. Turning sessions abandoned before
// the deadline finaliser shipped into results would be an implicit production data migration
// (AGENTS.md). SESSION_FINALISE_FROM (an ISO time, set in the deployment) overrides the release-day default.
export const FINALISE_FROM_DEFAULT = '2026-10-13T00:00:00.000Z';
export function finaliseFloor(value = process.env.SESSION_FINALISE_FROM) {
  const t = Date.parse(value || '');
  return new Date(Number.isFinite(t) ? t : Date.parse(FINALISE_FROM_DEFAULT)).toISOString();
}

export const FINALISE_MAX_FAILURES = 5; // Transient failures retried this many runs before the session leaves the queue.
const MAX_PAGES = 5;

/**
 * store.listDue(cutoffIso, limit, afterIso) returns active durable rows past the cutoff, oldest first,
 *   starting at expires_at >= afterIso when given (a cursor that lets a run page past failed rows).
 * store.finalise(id, result) returns {id, finalised}; it throws Error with the database message.
 * store.quarantine(id, reason, maxFailures) counts a failure and, once maxFailures is reached, closes the session
 *   as finalisedBy:'unscorable' without an attempt so it leaves the queue. Returns {id, failures, closed}.
 * onEpisodeCheck(row, result) is an optional hook for single-question episode checks.
 */
export async function finaliseExpiredSessions(store, { now = Date.now(), limit = FINALISE_BATCH, onEpisodeCheck, from = finaliseFloor() } = {}) {
  const size = Math.max(1, Math.min(FINALISE_BATCH, Number(limit) || FINALISE_BATCH));
  const cutoff = new Date(now - FINALISE_GRACE_MS - FINALISE_MARGIN_MS).toISOString();
  const out = { due: 0, finalised: 0, alreadyDone: 0, notDue: 0, failed: 0, quarantined: 0, errors: [] };
  const seen = new Set();
  let after = from;
  for (let page = 0; page < MAX_PAGES && out.finalised < size; page++) {
    const listed = await store.listDue(cutoff, size, after);
    const rows = listed.filter(row => !seen.has(row.id));
    if (!rows.length) break;
    for (const row of rows) seen.add(row.id);
    out.due += rows.length;
    // Failed rows stay behind the cursor for this run, so newer sessions behind them still get finalised.
    after = rows[rows.length - 1].expires_at;
    for (const row of rows) {
      let result;
      let checked = [];
      try {
        checked = store.checkedAnswers ? await store.checkedAnswers(row) : [];
      } catch {
        await fail(store, out, row, 'finalise_failed', FINALISE_MAX_FAILURES);
        continue;
      }
      try {
        result = scoreExpiredSession(row, checked);
      } catch {
        // Deterministic: the snapshot or answers can never be scored, so retrying would only starve the queue.
        await fail(store, out, row, 'unscorable', 1);
        continue;
      }
      try {
        const done = await store.finalise(row.id, result);
        if (done?.finalised) {
          out.finalised++;
          if (row.selection_meta?.episodeId && onEpisodeCheck) {
            try { await onEpisodeCheck(row, result); } catch { out.errors.push({ id: row.id, code: 'episode_check_failed' }); }
          }
        } else out.alreadyDone++;
      } catch (error) {
        const message = error?.message || '';
        if (/session not expired/.test(message)) out.notDue++;
        else await fail(store, out, row, /event conflict/.test(message) ? 'event_conflict' : 'finalise_failed', FINALISE_MAX_FAILURES);
      }
    }
  }
  out.errors = out.errors.slice(0, 20);
  return out;
}

async function fail(store, out, row, code, maxFailures) {
  out.failed++;
  out.errors.push({ id: row.id, code });
  try {
    const verdict = await store.quarantine?.(row.id, code, maxFailures);
    if (verdict?.closed) out.quarantined++;
  } catch { out.errors.push({ id: row.id, code: 'quarantine_failed' }); }
}

/** With `userId`, only that student's sessions are listed (the on-demand pass when they open results). */
export function supabaseSessionStore(db, { userId } = {}) {
  return {
    async listDue(cutoffIso, limit, afterIso) {
      let query = db.from('recovery_sessions')
        .select('id,user_id,subject,mode,questions,selection_meta,events,created_at,expires_at')
        .eq('state', 'active').lt('expires_at', cutoffIso);
      if (userId) query = query.eq('user_id', userId);
      if (afterIso) query = query.gte('expires_at', afterIso);
      const { data, error } = await query.order('expires_at', { ascending: true }).limit(limit);
      if (error) throw new Error('FINALISER_STORAGE_UNAVAILABLE');
      return data || [];
    },
    async finalise(id, result) {
      const { data, error } = await db.rpc('finalise_expired_recovery_session', { p_id: id, p_result: result });
      if (error) throw new Error(error.message || 'finalise_failed');
      return data;
    },
    async checkedAnswers(row) {
      return checkedAnswersForSubmit(db, row.id, row.user_id);
    },
    async quarantine(id, reason, maxFailures) {
      const { data, error } = await db.rpc('quarantine_recovery_session', { p_id: id, p_reason: reason, p_max: maxFailures });
      if (error) throw new Error(error.message || 'quarantine_failed');
      return data;
    },
  };
}

/** Episode checks report the answer the way finishSession does, including unanswered. */
export function episodeCheckInput(row, result) {
  const detail = result.details?.find(d => d.qid === row.questions[0].id);
  const unanswered = !Number.isInteger(detail?.givenIndex);
  return {
    input: { requestKey: `submission_${row.id}`, itemId: row.selection_meta.itemId, type: 'choice', value: unanswered ? null : detail.givenIndex },
    options: { scoredCheck: true, incompleteCheck: unanswered ? 'unanswered' : null },
  };
}

/**
 * On-demand pass for one student: finalise their own expired durable sessions before their
 * results are read, so an abandoned mock appears without waiting for the daily cron. Never throws;
 * a failure leaves the session for the next pass.
 */
export async function finaliseExpiredSessionsForUser(store, options = {}) {
  try {
    return await finaliseExpiredSessions(store, { ...options, limit: options.limit ?? 5 });
  } catch {
    return null;
  }
}
