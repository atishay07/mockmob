// Cohort time and changes (spec tmp/mistake-lab-v4/SPEC.md 4.13, section 6 item 7). PURE: no I/O, no node imports.
//
// The nightly table question_option_stats (supabase/migrations/20261016120000_question_option_stats.sql) holds, per question,
// aggregates over the students' FIRST answers: option picks, and, from the records that were captured with the 15 Oct
// capture, how long the students who got it right took, how many changed their answer and how many crossed out the key.
// This file does two things with a row of that table:
//   tableSnapshot(rows)       the rows as a cohort snapshot (the shape data/cohort_picks.js cohortForAttempt reads), each
//                             question carrying its raw time numbers under `stats`;
//   timeRead(stats, own)      one student's view of those numbers with the student's OWN first answer left out, so a
//                             student never counts in the comparison they are shown (spec section 8, risk 8).
// The reliability rules the table applies in SQL are applied here to the student's own record by ownContribution, so
// what is subtracted is exactly what the refresh added (data/tests/cohort_time.test.mjs runs the SQL and this code over
// the same papers and checks they agree). Sentences and gates are in data/mistake_lab.js; nothing here is worded.
import { readTrace } from './paper_trace.js';
import { optionHash } from './option_hash.js';

export const COHORT_TIME_RULES = Object.freeze({
  staleMs: 48 * 3600 * 1000, // a table whose newest refresh is older than this is read as missing
  minTimedMs: 2000, // a question is timed at 2 s or more (data/time_decisions.js TIME_RULES.minTimedMs)
  maxGapMs: 30 * 60 * 1000, // a gap over 30 minutes on a record with no away data is a break (data/paper_trace.js rule 4)
  maxRightSecs: 1000, // the table keeps every right time (for leaving one out) up to this many; above it one student is not material
});

const SERVER_SCORING = new Set(['server_practice_v1', 'server_snapshot_v1']);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const whole = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.trunc(Number(n))) : 0);

/**
 * What one student's first answer to `qid` added to the table, from the attempt that answer was in. Null when that
 * attempt could not have been timed: the same test the SQL refresh applies (server scored, the device record matched the
 * answers, an end event, two or more events). Otherwise:
 *   timed       the question has 2 s or more and no break credited to it (data/paper_trace.js)
 *   ms          the time under the paper trace's one rule
 *   right       the student's answer was today's key (by option text)
 *   changed     the record's observed.answerChanges has this question
 *   offKey      the first pick was the key and the final answer is not
 *   strikeBasis the record can carry strike-outs: the web runner, or any strike-out in it
 *   keyStruck   the key was crossed out at some point
 */
export function ownContribution(attempt, qid, keyHash) {
  const meta = attempt?.selectionMeta || {};
  const rec = meta.recovery;
  if (!SERVER_SCORING.has(meta.scoringVersion) || !isObj(rec) || rec.telemetry !== 'self_reported') return null;
  if (!isObj(rec.end) || !rec.end.qid || !Number.isFinite(rec.end.at)) return null;
  if (!Array.isArray(rec.timeline) || rec.timeline.length < 2) return null;
  const q = (attempt.questionsSnapshot || []).find((x) => x?.id === qid);
  const d = (attempt.details || []).find((x) => x?.qid === qid);
  if (!q || !Array.isArray(q.options) || !d || !Number.isInteger(d.givenIndex)) return null;
  const hashes = q.options.map(optionHash);
  const trace = readTrace(rec);
  const ms = trace.dwell.get(qid) || 0;
  const given = hashes[d.givenIndex];
  const steps = trace.stepsByQid.get(qid) || [];
  const first = steps.length ? hashes[steps[0].answer] : undefined;
  const changes = Array.isArray(rec.observed?.answerChanges) ? rec.observed.answerChanges : [];
  const strikes = trace.strikesByQid.get(qid) || [];
  return {
    timed: ms >= COHORT_TIME_RULES.minTimedMs && !trace.breaks.has(qid),
    ms,
    right: given === keyHash,
    changed: changes.some((c) => c && c.qid === qid),
    offKey: first !== undefined && first === keyHash && given !== keyHash,
    strikeBasis: meta.client?.platform === 'web' || trace.strikesByQid.size > 0,
    keyStruck: strikes.some((s) => s.on && hashes[s.option] === keyHash),
  };
}

/** The median of whole seconds (the mean of the middle two on an even count), as the SQL's percentile_cont. */
export function medianOf(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Normalise one stored row to the numbers the reader uses (a defensive copy: the table is read from outside). */
export function statsOf(row) {
  if (!isObj(row)) return null;
  const secs = Array.isArray(row.right_secs) ? row.right_secs.map(Number).filter(Number.isFinite) : [];
  return {
    nTimed: whole(row.n_timed),
    nTimedRight: whole(row.n_timed_right),
    medianMsRight: Number.isFinite(Number(row.median_ms_right)) && row.median_ms_right !== null ? Number(row.median_ms_right) : null,
    q1MsRight: Number.isFinite(Number(row.q1_ms_right)) && row.q1_ms_right !== null ? Number(row.q1_ms_right) : null,
    q3MsRight: Number.isFinite(Number(row.q3_ms_right)) && row.q3_ms_right !== null ? Number(row.q3_ms_right) : null,
    rightSecs: secs,
    nChanged: whole(row.n_changed),
    nMovedOffKey: whole(row.n_moved_off_key),
    nStrikeBasis: whole(row.n_strike_basis),
    nStruckKey: whole(row.n_struck_key),
  };
}

/**
 * One student's read of a question's time numbers, the student's own first answer left out:
 *   { right: { n, medianMs } | null, timed, changed, movedOff, strike: { n, struck } }
 * `own` is ownContribution() of the student's first answer, or null when it added nothing (or was not counted).
 * medianMs is over the reliably timed right answers: from the stored seconds when the student's own right time has to
 * come out of them, else the stored median.
 */
export function timeRead(stats, own = null) {
  const s = stats && Array.isArray(stats.rightSecs) ? stats : null;
  if (!s) return null;
  // The student's own right time must be among the stored times. When it is not, the table did not count this answer
  // (the refresh and this code disagreed on the record), so nothing of the student's is taken out of any number.
  const ownSecs = own ? Math.round(own.ms / 1000) : null;
  const complete = s.rightSecs.length === s.nTimedRight;
  const at = own && own.timed && own.right && complete ? s.rightSecs.indexOf(ownSecs) : -1;
  const counted = !!own && own.timed && (!own.right || !complete || at >= 0);
  let n = s.nTimedRight;
  let medianMs = s.medianMsRight;
  if (counted && own.right) {
    n = Math.max(0, n - 1);
    if (at >= 0) {
      const secs = [...s.rightSecs];
      secs.splice(at, 1);
      const m = medianOf(secs);
      medianMs = m === null ? null : m * 1000;
    }
  }
  const timed = Math.max(0, s.nTimed - (counted ? 1 : 0));
  const changed = Math.max(0, s.nChanged - (counted && own.changed ? 1 : 0));
  const movedOff = Math.max(0, Math.min(changed, s.nMovedOffKey - (counted && own.changed && own.offKey ? 1 : 0)));
  const strikeN = Math.max(0, s.nStrikeBasis - (own?.strikeBasis ? 1 : 0));
  const struck = Math.max(0, Math.min(strikeN, s.nStruckKey - (own?.strikeBasis && own.keyStruck ? 1 : 0)));
  return {
    right: n > 0 && medianMs !== null ? { n, medianMs } : null,
    timed, changed, movedOff,
    strike: { n: strikeN, struck },
  };
}

/** The newest refresh among rows (ms), or 0. */
export const newestRefresh = (rows) => (Array.isArray(rows) ? rows : []).reduce((m, r) => Math.max(m, Date.parse(r?.refreshed_at) || 0), 0);

/** Is a table whose newest refresh was at `refreshedAtMs` still fresh at `now`? */
export const isFresh = (refreshedAtMs, now = Date.now()) => Number(refreshedAtMs) > 0 && now - Number(refreshedAtMs) <= COHORT_TIME_RULES.staleMs;

/**
 * Rows of question_option_stats as a cohort snapshot (data/cohort_picks.js cohortForAttempt): the same guards then apply
 * (key text, options, question on this paper), and each question carries `stats`, the raw time numbers.
 *   builtAt   the moment up to which answers were counted: a student's own first answer is subtracted only up to it
 *   since     the day of the earliest first answer counted, until the day of the latest
 */
export function tableSnapshot(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.qid === 'string' && isObj(r.option_picks) && /^[0-9a-f]{16}$/.test(String(r.key_hash)));
  if (!list.length) return null;
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const froms = list.map((r) => Date.parse(r.first_answer_from)).filter(Number.isFinite);
  const tos = list.map((r) => Date.parse(r.first_answer_to)).filter(Number.isFinite);
  const through = list.reduce((m, r) => Math.max(m, Date.parse(r.counted_through) || 0), 0);
  const questions = {};
  for (const r of list) {
    questions[r.qid] = { n: whole(r.n_answered), keyHash: r.key_hash, picks: { ...r.option_picks }, stats: statsOf({ ...r }) };
  }
  return {
    version: 1,
    builtAt: through ? new Date(through).toISOString() : null,
    since: froms.length ? day(Math.min(...froms)) : null,
    until: tos.length ? day(Math.max(...tos)) : null,
    source: 'table',
    questions,
  };
}
