// PrepOS insights: analysis of the student's own server-scored sessions. Pure and free to run.
//
// Principles (see docs/brain/CLAUDE-MASTER-HANDOVER.md):
//   * Report what the record shows, with sample sizes. Never a cause, a mastery level, a rank
//     prediction or "marks you could recover". Answer changes are counted both ways (gains
//     and losses); the net can be positive.
//   * Timing comes from device events and is labelled as such; sessions without a usable
//     timeline contribute nothing to pace.
//   * Small samples are shown as small samples (Wilson interval), and thin chapters are
//     listed separately instead of ranked.

export const MARK_RIGHT = 5;
export const MARK_WRONG = -1;
export const MIN_CHAPTER_SAMPLE = 4;
const DAY = 86_400_000;

export function wilson(successes, total, z = 1.96) {
  if (!total) return { pct: null, low: null, high: null, n: 0 };
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom;
  return { pct: Math.round(p * 100), low: Math.max(0, Math.round((centre - margin) * 100)), high: Math.min(100, Math.round((centre + margin) * 100)), n: total };
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const roundedMedian = (list) => { const m = median(list.map((r) => r.seconds)); return m === null ? null : Math.round(m); };
const percentile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

/** Seconds spent on each question, from the visit/answer timeline. Null when unusable. */
export function dwellByQuestion(attempt) {
  const recovery = attempt?.selectionMeta?.recovery;
  const timeline = recovery?.timeline;
  if (!recovery || recovery.telemetry !== 'self_reported' || !Array.isArray(timeline) || timeline.length < 2) return null;
  const totals = new Map();
  for (let i = 0; i < timeline.length - 1; i++) {
    const gap = timeline[i + 1].at - timeline[i].at;
    if (!(gap >= 0) || gap > 30 * 60 * 1000) continue; // ignore tab-away gaps over 30 minutes
    totals.set(timeline[i].qid, (totals.get(timeline[i].qid) || 0) + gap);
  }
  return totals.size ? totals : null;
}

function expandAttempt(attempt) {
  const snapshot = new Map((attempt.questionsSnapshot || []).map((q) => [q.id, q]));
  const dwell = dwellByQuestion(attempt);
  return (attempt.details || []).map((d, index) => {
    const q = snapshot.get(d.qid) || {};
    return {
      attemptId: attempt.id, subject: attempt.subject, completedAt: attempt.completedAt, qid: d.qid, position: index + 1,
      chapter: q.chapter || 'Unmapped chapter', difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : null,
      outcome: d.isCorrect === true ? 'right' : d.isCorrect === false ? 'wrong' : 'skip',
      seconds: dwell?.has(d.qid) ? Math.round(dwell.get(d.qid) / 1000) : null,
    };
  });
}

export function computePrepOSInsights(attempts = [], { now = Date.now(), subjectNames = {} } = {}) {
  const usable = attempts.filter((a) => Array.isArray(a.details) && a.details.length > 0 && a.completedAt).sort((a, b) => b.completedAt - a.completedAt);
  if (!usable.length) return { state: 'empty', sessions: 0, questions: 0, generatedAt: new Date(now).toISOString() };

  const rows = usable.flatMap(expandAttempt);
  const count = (list, outcome) => list.filter((r) => r.outcome === outcome).length;
  const right = count(rows, 'right'); const wrong = count(rows, 'wrong'); const skip = count(rows, 'skip');

  // Marks ledger: what the record shows, not what could have been.
  const ledger = {
    gained: right * MARK_RIGHT,
    penalty: wrong, // marks deducted by wrong answers (1 each)
    net: right * MARK_RIGHT + wrong * MARK_WRONG,
    openWrong: wrong * MARK_RIGHT, // what the wrong answers were worth
    openSkipped: skip * MARK_RIGHT, // what the blank questions were worth
  };
  ledger.open = ledger.openWrong + ledger.openSkipped;

  const attempted = right + wrong;
  const accuracy = wilson(right, attempted);
  const attemptRate = rows.length ? Math.round((attempted / rows.length) * 100) : null;

  // Chapters
  const chapterMap = new Map();
  for (const r of rows) {
    const key = `${r.subject}::${r.chapter}`;
    const c = chapterMap.get(key) || { key, subject: r.subject, subjectName: subjectNames[r.subject] || r.subject, chapter: r.chapter, right: 0, wrong: 0, skip: 0, n: 0, sessions: new Set(), last: 0 };
    c[r.outcome] += 1; c.n += 1; c.sessions.add(r.attemptId); c.last = Math.max(c.last, r.completedAt);
    chapterMap.set(key, c);
  }
  const chapters = [...chapterMap.values()].map((c) => ({
    key: c.key, subject: c.subject, subjectName: c.subjectName, chapter: c.chapter, right: c.right, wrong: c.wrong, skip: c.skip, n: c.n, sessions: c.sessions.size,
    accuracy: wilson(c.right, c.right + c.wrong), open: (c.wrong + c.skip) * MARK_RIGHT, last: c.last,
  }));
  const ranked = chapters.filter((c) => c.n >= MIN_CHAPTER_SAMPLE && (c.wrong + c.skip) > 0)
    .sort((a, b) => b.open - a.open || (a.accuracy.pct ?? 100) - (b.accuracy.pct ?? 100) || b.n - a.n);
  const thin = chapters.filter((c) => c.n < MIN_CHAPTER_SAMPLE && (c.wrong + c.skip) > 0).sort((a, b) => b.last - a.last);

  // Difficulty
  const difficulty = ['easy', 'medium', 'hard'].map((level) => {
    const list = rows.filter((r) => r.difficulty === level);
    const r = count(list, 'right'); const w = count(list, 'wrong');
    return { level, n: list.length, right: r, wrong: w, skip: count(list, 'skip'), accuracy: wilson(r, r + w) };
  }).filter((d) => d.n > 0);

  // Pace (device events)
  const timed = rows.filter((r) => r.seconds !== null);
  const timedSessions = new Set(timed.map((r) => r.attemptId)).size;
  const bySession = new Map();
  for (const r of timed) { const list = bySession.get(r.attemptId) || []; list.push(r.seconds); bySession.set(r.attemptId, list); }
  const overallMedian = median(timed.map((r) => r.seconds));
  const slow = overallMedian ? timed.filter((r) => r.seconds >= Math.max(overallMedian * 2.5, 90)).sort((a, b) => b.seconds - a.seconds).slice(0, 5) : [];
  const wrongTime = timed.filter((r) => r.outcome === 'wrong').reduce((s, r) => s + r.seconds, 0);
  const totalTime = timed.reduce((s, r) => s + r.seconds, 0);
  const pace = {
    usable: timed.length >= 8 && timedSessions >= 1, questionsTimed: timed.length, sessionsTimed: timedSessions,
    medianSec: overallMedian !== null ? Math.round(overallMedian) : null, p90Sec: timed.length ? Math.round(percentile(timed.map((r) => r.seconds), 0.9)) : null,
    medianRightSec: roundedMedian(timed.filter((r) => r.outcome === 'right')),
    medianWrongSec: roundedMedian(timed.filter((r) => r.outcome === 'wrong')),
    shareOnWrong: totalTime ? Math.round((wrongTime / totalTime) * 100) : null,
    slowest: slow.map((r) => ({ chapter: r.chapter, subject: r.subject, position: r.position, seconds: r.seconds, outcome: r.outcome, attemptId: r.attemptId })),
  };

  // Answer changes, both directions
  const changes = usable.flatMap((a) => (a.selectionMeta?.recovery?.observed?.answerChanges || []).map((c) => ({ ...c, attemptId: a.id })));
  const gains = changes.filter((c) => c.markEffect > 0);
  const losses = changes.filter((c) => c.markEffect < 0);
  const changeSummary = {
    sessionsWithTelemetry: usable.filter((a) => a.selectionMeta?.recovery?.telemetry === 'self_reported').length,
    count: changes.length, gains: gains.length, losses: losses.length,
    marksGained: gains.reduce((s, c) => s + c.markEffect, 0), marksLost: -losses.reduce((s, c) => s + c.markEffect, 0),
    net: changes.reduce((s, c) => s + c.markEffect, 0),
  };

  // Rhythm and the last two weeks
  const inWindow = (from, to) => usable.filter((a) => a.completedAt >= now - to * DAY && a.completedAt < now - from * DAY);
  const summarise = (list) => {
    const rs = list.flatMap(expandAttempt); const r = count(rs, 'right'); const w = count(rs, 'wrong');
    return { sessions: list.length, questions: rs.length, right: r, wrong: w, skip: count(rs, 'skip'), net: r * MARK_RIGHT + w * MARK_WRONG, accuracy: wilson(r, r + w) };
  };
  const thisWeek = summarise(inWindow(0, 7)); const lastWeek = summarise(inWindow(7, 14));
  const activeDays = new Set(inWindow(0, 14).map((a) => new Date(a.completedAt + 19_800_000).toISOString().slice(0, 10))).size;

  return {
    state: 'ready', generatedAt: new Date(now).toISOString(), sessions: usable.length, questions: rows.length,
    window: { first: usable.at(-1).completedAt, last: usable[0].completedAt },
    ledger, accuracy, attemptRate, chapters: { ranked, thin }, difficulty, pace, changes: changeSummary,
    week: { thisWeek, lastWeek, activeDaysLast14: activeDays },
  };
}

const sec = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)}s`);
const sign = (n) => (n > 0 ? `+${n}` : String(n));

/** Plain-language findings, strongest first. Every finding carries its sample size. */
export function readout(insights, { limit = 4 } = {}) {
  if (insights.state !== 'ready') return [];
  const out = [];
  const top = insights.chapters.ranked[0];
  if (top) {
    out.push({ id: 'chapter', kind: 'leak', n: top.n, headline: `${top.chapter} is where the most marks are open`,
      detail: `${top.subjectName}: ${top.right} right, ${top.wrong} wrong, ${top.skip} left blank out of ${top.n} questions over ${top.sessions} session${top.sessions === 1 ? '' : 's'}. Those ${top.wrong + top.skip} questions were worth ${top.open} marks.`,
      action: { label: `Practise ${top.chapter}`, href: `/dashboard?subject=${encodeURIComponent(top.subject)}&mode=quick` } });
  } else if (insights.chapters.thin[0]) {
    const t = insights.chapters.thin[0];
    out.push({ id: 'thin', kind: 'info', n: t.n, headline: 'Not enough questions in any one chapter to rank them yet',
      detail: `Most recent miss: ${t.chapter} (${t.n} question${t.n === 1 ? '' : 's'} so far). Chapters are ranked once there are ${MIN_CHAPTER_SAMPLE} or more answered in each.`, action: { label: 'Practise another set', href: '/dashboard?mode=quick' } });
  }
  const c = insights.changes;
  if (c.count >= 2) {
    out.push({ id: 'changes', kind: c.net < 0 ? 'leak' : c.net > 0 ? 'good' : 'info', n: c.count,
      headline: c.net < 0 ? `Changing answers has cost ${-c.net} marks net` : c.net > 0 ? `Changing answers has gained ${c.net} marks net` : 'Changing answers has been about even',
      detail: `${c.count} changes across ${c.sessionsWithTelemetry} timed session${c.sessionsWithTelemetry === 1 ? '' : 's'}: ${c.gains} helped (${sign(c.marksGained)} marks) and ${c.losses} hurt (−${c.marksLost}). Both directions are counted.`,
      action: { label: 'See your replay in Review', href: '/review' } });
  }
  const p = insights.pace;
  if (p.usable && p.slowest[0] && p.medianSec) {
    const s = p.slowest[0];
    out.push({ id: 'pace', kind: 'info', n: p.questionsTimed, headline: `Your slowest question took ${sec(s.seconds)}, against a typical ${sec(p.medianSec)}`,
      detail: `${s.chapter} (question ${s.position}). ${p.shareOnWrong !== null ? `About ${p.shareOnWrong}% of your timed minutes went on questions you got wrong. ` : ''}Timing comes from device events across ${p.questionsTimed} questions.`,
      action: { label: 'Do a paced 10-question set', href: '/dashboard?mode=quick&count=10' } });
  }
  const unattemptedShare = insights.attemptRate !== null ? 100 - insights.attemptRate : 0;
  if (unattemptedShare >= 15 && insights.ledger.openSkipped > 0) {
    out.push({ id: 'skips', kind: 'info', n: insights.questions, headline: `${unattemptedShare}% of questions were left blank`,
      detail: `${insights.ledger.openSkipped / MARK_RIGHT} blank questions were worth ${insights.ledger.openSkipped} marks. Blank costs nothing under CUET marking, but it gains nothing either; a wrong answer costs 1.`,
      action: { label: 'Review skipped questions', href: '/review' } });
  }
  const easy = insights.difficulty.find((d) => d.level === 'easy');
  if (easy && easy.right + easy.wrong >= 8 && easy.accuracy.pct !== null && easy.accuracy.pct < 70) {
    out.push({ id: 'easy', kind: 'leak', n: easy.right + easy.wrong, headline: `Easy questions are right ${easy.accuracy.pct}% of the time`,
      detail: `${easy.right} of ${easy.right + easy.wrong} (likely range ${easy.accuracy.low}–${easy.accuracy.high}%). Misses on easy questions usually point to speed or care rather than gaps, though this record cannot tell which.`,
      action: { label: 'Review your easy misses', href: '/review' } });
  }
  return out.slice(0, limit);
}

/** Deterministic answers to common record questions. Returns null when the question is not about the record. */
export function answerFromInsights(text, insights, { pro = true } = {}) {
  const q = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const has = (...words) => words.some((w) => q.includes(` ${w}`) || q.includes(w + ' '));
  const asksRecord = has('lose', 'losing', 'lost', 'leak', 'weak', 'chapter', 'slow', 'pace', 'time', 'change', 'changing', 'skip', 'blank', 'week', 'progress', 'accuracy', 'improv', 'marks');
  if (!asksRecord) return null;
  if (insights.state !== 'ready') {
    return { reply: 'There is nothing to analyse yet. Finish one practice session and PrepOS will show where your marks went.', actions: [{ label: 'Start a practice set', route: '/dashboard?mode=quick' }] };
  }
  const found = readout(insights, { limit: 6 });
  const pick = (id) => found.find((f) => f.id === id);
  let hit = null;
  if (has('change', 'changing', 'second guess')) hit = pick('changes');
  else if (has('slow', 'pace', 'time', 'fast')) hit = pick('pace');
  else if (has('skip', 'blank', 'left')) hit = pick('skips');
  else if (has('week', 'progress', 'improv')) {
    const { thisWeek: t, lastWeek: l } = insights.week;
    const reply = t.sessions === 0
      ? 'You have not finished a session in the last 7 days.'
      : `Last 7 days: ${t.sessions} session${t.sessions === 1 ? '' : 's'}, ${t.questions} questions, ${t.net} net marks${t.accuracy.pct !== null ? `, ${t.accuracy.pct}% accuracy (likely range ${t.accuracy.low}–${t.accuracy.high}%)` : ''}. ${l.sessions ? `The week before: ${l.sessions} sessions, ${l.net} net marks.` : 'There is no earlier week to compare with yet.'} Small samples move a lot from week to week, so treat this as a description, not a verdict.`;
    return { reply, actions: [{ label: 'Open your record', route: '/mentor' }] };
  } else hit = pick('chapter') || pick('thin') || found[0];
  hit = hit || found[0];
  if (!pro && hit && (hit.id === 'changes' || hit.id === 'pace')) {
    return { reply: `${hit.id === 'changes' ? 'Changed-answer detail' : 'Pace detail'} is part of Pro. Your chapters, marks ledger and weekly summary are free.`, actions: [{ label: 'See Pro', route: '/pricing' }] };
  }
  if (!hit) return { reply: 'Nothing stands out yet. Keep practising and PrepOS will point to the biggest leak once there are enough questions.', actions: [{ label: 'Start a practice set', route: '/dashboard?mode=quick' }] };
  return { reply: `${hit.headline}. ${hit.detail}`, actions: hit.action ? [{ label: hit.action.label, route: hit.action.href }] : [] };
}
