// Portable pure logic. Scores use server snapshots; events remain self-reported observations.
export function correctIndex(q) {
  if (Number.isInteger(q.correctIndex)) return q.correctIndex;
  const key = q.correct_answer || q.correct_option || q.correctAnswer;
  return (q.options || []).findIndex((o, i) => (o?.key || 'ABCD'[i]) === key);
}

export function scoreSession(questions, answers = {}, events = [], durationMs = Infinity) {
  if (!questions.length || questions.some(q => !Array.isArray(q.options) || correctIndex(q) < 0 || correctIndex(q) >= q.options.length)) throw new Error('invalid_server_snapshot');
  if (!answers || Array.isArray(answers) || typeof answers !== 'object') throw new Error('invalid_answers');
  const ids = new Set(questions.map(q => q.id));
  if (new Set(ids).size !== questions.length || Object.keys(answers).some(id => !ids.has(id))) throw new Error('unknown_question');
  if (!Array.isArray(events) || events.length > 5000) throw new Error('invalid_events');
  let last = 0; let lastAt = 0;
  const timeline = events.map(event => {
    const q = questions.find(q => q.id === event.qid);
    if (!q || !Number.isInteger(event.seq) || event.seq <= last || !Number.isFinite(event.at) || event.at < lastAt || event.at < 0 || event.at > durationMs || !['answer','visit'].includes(event.type)) throw new Error('invalid_event_sequence');
    if (event.type === 'answer' && event.answer !== null && (!Number.isInteger(event.answer) || event.answer < 0 || event.answer >= q.options.length)) throw new Error('invalid_event_answer');
    last = event.seq; lastAt = event.at;
    return { seq: event.seq, qid: event.qid, at: event.at, type: event.type, ...(event.type === 'answer' ? { answer: event.answer } : {}) };
  });
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
