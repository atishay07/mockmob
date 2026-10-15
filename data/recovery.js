// Portable pure logic. Scores use server snapshots; events remain self-reported observations.
export function correctIndex(q) {
  if (Number.isInteger(q.correctIndex)) return q.correctIndex;
  const key = q.correct_answer || q.correct_option || q.correctAnswer;
  return (q.options || []).findIndex((o, i) => (o?.key || 'ABCD'[i]) === key);
}

// The session events the server accepts (spec tmp/mistake-lab-v4/SPEC.md 6). Every event names the question on
// screen (qid) and the paper clock (at, ms from the start); seq rises by one or more, at never goes back.
//   answer {answer: served index | null}   visit {via?: VISIT_VIA}   mark {marked: boolean}
//   strike {option: served index, on: boolean}   away {}   back {}   end {reason: END_REASONS}
// away and back need not pair up: a back with no open away, or a second away, is accepted and has no effect, and any
// later event closes an open away (data/paper_trace.js). An end counts only as the last event of the record; an end
// followed by more events (a submit that failed and a student who carried on) is kept in the log and ignored.
// A visit's via says how the question was reached (next, previous, palette, swipe, resume), and two more say what was
// on screen without the student moving to the question:
//   set    shown with its passage set when the set opened (the web shows every question of a set on one page); the
//          question in focus is the visit that follows at the same clock. It counts as opened, never as time on it.
//   sheet  the submit sheet opened over the question named; until the next visit or answer no question is on screen,
//          so the time spent deciding to submit is credited to none of them.
export const SESSION_EVENT_TYPES = Object.freeze(['answer', 'visit', 'mark', 'strike', 'away', 'back', 'end']);
export const VISIT_VIA = Object.freeze(['next', 'previous', 'palette', 'swipe', 'resume', 'set', 'sheet']);
export const END_REASONS = Object.freeze(['submit', 'time_up', 'nta_strikes']);
export const MAX_SESSION_EVENTS = 5000;
export const MAX_EVENT_BYTES = 512; // about 75 bytes in practice; anything near this is not a session event

function checkEvent(event, q, durationMs, last, lastAt) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('invalid_event_shape');
  if (!q || !Number.isInteger(event.seq) || event.seq <= last || !Number.isFinite(event.at) || event.at < lastAt || event.at < 0 || event.at > durationMs || !SESSION_EVENT_TYPES.includes(event.type)) throw new Error('invalid_event_sequence');
  if (JSON.stringify(event).length > MAX_EVENT_BYTES) throw new Error('invalid_event_size');
  if (event.type === 'answer' && event.answer !== null && (!Number.isInteger(event.answer) || event.answer < 0 || event.answer >= q.options.length)) throw new Error('invalid_event_answer');
  // A mark for review is a student's own flag (event.marked true or false), kept with the session so a resume on
  // another device restores it. It never enters the scored timeline: it carries no answer and must not split time.
  if (event.type === 'mark' && typeof event.marked !== 'boolean') throw new Error('invalid_event_mark');
  if (event.type === 'visit' && event.via !== undefined && !VISIT_VIA.includes(event.via)) throw new Error('invalid_event_via');
  if (event.type === 'strike' && (!Number.isInteger(event.option) || event.option < 0 || event.option >= q.options.length || typeof event.on !== 'boolean')) throw new Error('invalid_event_strike');
  if (event.type === 'end' && !END_REASONS.includes(event.reason)) throw new Error('invalid_event_end');
}

export function scoreSession(questions, answers = {}, events = [], durationMs = Infinity) {
  if (!questions.length || questions.some(q => !Array.isArray(q.options) || correctIndex(q) < 0 || correctIndex(q) >= q.options.length)) throw new Error('invalid_server_snapshot');
  if (!answers || Array.isArray(answers) || typeof answers !== 'object') throw new Error('invalid_answers');
  const ids = new Set(questions.map(q => q.id));
  if (new Set(ids).size !== questions.length || Object.keys(answers).some(id => !ids.has(id))) throw new Error('unknown_question');
  if (!Array.isArray(events) || events.length > MAX_SESSION_EVENTS) throw new Error('invalid_events');
  let last = 0; let lastAt = 0;
  const checked = events.map(event => {
    const q = event && typeof event === 'object' ? questions.find(q => q.id === event.qid) : null;
    checkEvent(event, q, durationMs, last, lastAt);
    last = event.seq; lastAt = event.at;
    const base = { seq: event.seq, qid: event.qid, at: event.at, type: event.type };
    if (event.type === 'answer') return { ...base, answer: event.answer };
    if (event.type === 'visit') return event.via === undefined ? base : { ...base, via: event.via };
    if (event.type === 'mark') return { ...base, marked: event.marked };
    if (event.type === 'strike') return { ...base, option: event.option, on: event.on };
    if (event.type === 'end') return { ...base, reason: event.reason };
    return base; // away, back
  });
  // The scored timeline keeps visits and answers only, exactly as before slice 2, so every reader of it is unchanged.
  // Marks, time away, strike-outs and the end are kept beside it (only when present) for data/paper_trace.js.
  const timeline = checked.filter(event => event.type === 'answer' || event.type === 'visit');
  const strip = ({ type, ...rest }) => rest;
  const extras = {
    marks: checked.filter(e => e.type === 'mark').map(strip),
    presence: checked.filter(e => e.type === 'away' || e.type === 'back'),
    strikes: checked.filter(e => e.type === 'strike').map(strip),
    end: checked.at(-1)?.type === 'end' ? strip(checked.at(-1)) : null,
  };
  let correct = 0; let wrong = 0;
  const details = questions.map(q => {
    const given = answers[q.id] ?? null;
    if (given !== null && (!Number.isInteger(given) || given < 0 || given >= q.options.length)) throw new Error('invalid_answer');
    const isCorrect = given === null ? null : given === correctIndex(q);
    if (isCorrect === true) correct++; if (isCorrect === false) wrong++;
    return { qid: q.id, givenIndex: given, isCorrect };
  });
  const rawScore = correct * 5 - wrong;
  const changes = []; const previous = new Map();
  for (const e of timeline.filter(e => e.type === 'answer')) {
    const q = questions.find(q => q.id === e.qid);
    if (previous.has(e.qid) && previous.get(e.qid) !== e.answer) {
      const mark = answer => answer === null ? 0 : answer === correctIndex(q) ? 5 : -1;
      changes.push({ qid: e.qid, at: e.at, before: previous.get(e.qid), after: e.answer, markEffect: mark(e.answer) - mark(previous.get(e.qid)) });
    }
    previous.set(e.qid, e.answer);
  }
  // Contradictory telemetry does not affect authoritative scoring; omit its analysis.
  const consistent = [...previous].every(([qid, answer]) => (answers[qid] ?? null) === answer);
  const lostOnChanges = consistent ? changes.filter(c => c.markEffect < 0).reduce((sum, c) => sum - c.markEffect, 0) : null;
  const netFirstToFinal = consistent ? changes.reduce((sum, c) => sum + c.markEffect, 0) : null;
  return { score: Math.max(0, Math.round(rawScore / (questions.length * 5) * 100)), rawScore, correct, wrong,
    unattempted: questions.length - correct - wrong, total: questions.length, details,
    recovery: { version: 1, scoring: 'server_snapshot', telemetry: consistent ? 'self_reported' : 'inconsistent',
      observed: { answerChanges: consistent ? changes : [], lostOnChanges, netFirstToFinal, unanswered: questions.length - correct - wrong },
      timeline: consistent ? timeline : [],
      ...(consistent && extras.marks.length ? { marks: extras.marks } : {}),
      ...(consistent && extras.presence.length ? { presence: extras.presence } : {}),
      ...(consistent && extras.strikes.length ? { strikes: extras.strikes } : {}),
      ...(consistent && extras.end ? { end: extras.end } : {}),
      recommendation: { kind: wrong > 0 ? 'concept_repair' : 'timed_practice',
        title: wrong > 0 ? 'Practise one concept you missed' : 'Try a fresh timed set',
        reason: 'Suggested from this attempt; a fresh check is needed before claiming improvement.' } } };
}

// Regular practice keeps no replay, so a malformed or clock-skewed event log must not
// block an otherwise valid submission. Answers are still fully validated and scored.
export function scorePracticeSubmission(questions, answers = {}, events = [], durationMs = Infinity) {
  try {
    return scoreSession(questions, answers, events, durationMs);
  } catch (error) {
    if (!/^invalid_event/.test(error?.message || '')) throw error;
    const result = scoreSession(questions, answers, [], durationMs);
    result.recovery.telemetry = 'invalid';
    return result;
  }
}

// Attempt meta a client sends with its submit (spec 6, item 6): which runner, its version and its own start time.
// It is a description of the device, never trusted for scoring; a malformed value is dropped, never fatal.
export const CLIENT_PLATFORMS = Object.freeze(['web', 'android']);
const EARLIEST_START = Date.UTC(2026, 0, 1);
export function clientMeta(input, now = Date.now()) {
  const c = input?.client;
  if (!c || typeof c !== 'object' || Array.isArray(c) || !CLIENT_PLATFORMS.includes(c.platform)) return null;
  const out = { platform: c.platform };
  if (typeof c.appVersion === 'string' && /^[0-9A-Za-z.+_-]{1,40}$/.test(c.appVersion)) out.appVersion = c.appVersion;
  if (Number.isInteger(c.startedAt) && c.startedAt >= EARLIEST_START && c.startedAt <= now + 86400000) out.startedAt = c.startedAt;
  return out;
}

/**
 * A time-up end that reached the server after the deadline (spec 6, item 1). The runner closes the paper when its
 * countdown shows 0:00 and sends the end with the submit, so with network time the submit often lands just after
 * expires_at, when the database refuses any new event (record_recovery_events) and the paper must never be extended.
 * The end is then placed by the server, at the paper's own limit, only when it changes nothing but how the record ends:
 *   - the device's last event is an end with reason time_up, and
 *   - every event before it is already stored (the same count, and its seq is the next one), so no answer, visit or
 *     other event is added or lost by placing it, and
 *   - it names a question of the paper and the stored record does not already end.
 * Returns the end event to score beside the stored events ({ seq, qid, at: durationMs, type: 'end', reason }), or
 * null. It is never written to the session's event log, so expected_event_count stays the stored count.
 */
export function lateTimeUpEnd(stored, sent, { durationMs, questionIds } = {}) {
  if (!Array.isArray(stored) || !Array.isArray(sent) || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const end = sent.at(-1);
  if (!end || typeof end !== 'object' || end.type !== 'end' || end.reason !== 'time_up') return null;
  if (sent.length !== stored.length + 1 || end.seq !== stored.length + 1 || stored.at(-1)?.type === 'end') return null;
  const known = questionIds instanceof Set ? questionIds : new Set(questionIds || []);
  if (typeof end.qid !== 'string' || !known.has(end.qid)) return null;
  const FIELDS = ['seq', 'qid', 'type', 'at', 'answer', 'marked', 'via', 'option', 'on', 'reason'];
  for (let i = 0; i < stored.length; i++) {
    const a = stored[i]; const b = sent[i];
    if (!a || !b || typeof b !== 'object' || FIELDS.some((k) => a[k] !== b[k])) return null;
  }
  if ((stored.at(-1)?.at ?? 0) > durationMs) return null;
  return { seq: end.seq, qid: end.qid, at: durationMs, type: 'end', reason: 'time_up' };
}

/** How the session ended: the reason on the record's final end event, else a reason the client named, else null. */
export function endedByOf(events = [], input = null) {
  const final = Array.isArray(events) ? events.at(-1) : null;
  if (final?.type === 'end' && END_REASONS.includes(final.reason)) return final.reason;
  return END_REASONS.includes(input?.endedBy) ? input.endedBy : null;
}

/** The additive selectionMeta fields of a submit: { client?, endedBy? }, each only when known. */
export function submitMeta(input, events, now = Date.now()) {
  const client = clientMeta(input, now);
  const endedBy = endedByOf(events, input);
  return { ...(client ? { client } : {}), ...(endedBy ? { endedBy } : {}) };
}

export function improvementEvidence(checks) {
  const ordered = [...checks].sort((a,b) => a.at - b.at);
  const lastFailure = ordered.findLastIndex(c => c.correct === false);
  const distinct = []; const ids = new Set(); const families = new Set();
  for (const c of ordered.slice(lastFailure + 1)) {
    if (!c.correct || c.assisted || !c.fresh || !c.familyId || ids.has(c.questionId) || families.has(c.familyId)) continue;
    ids.add(c.questionId); families.add(c.familyId); distinct.push(c);
  }
  const demonstrated = distinct.length >= 2 && distinct.at(-1).at - distinct[0].at >= 86400000;
  return { state: demonstrated ? 'improvement_demonstrated' : 'more_evidence_needed', sampleSize: distinct.length };
}
