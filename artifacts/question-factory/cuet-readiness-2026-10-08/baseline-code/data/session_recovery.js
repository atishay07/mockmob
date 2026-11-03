// Score Recovery Lab · what one finished session shows, computed from the server-scored attempt.
// Pure and portable. Every number here is an observation under the session's answer key
// (+5 right, −1 wrong, 0 blank); nothing is a forecast of marks a student will "recover".

export const MARKS = Object.freeze({ right: 5, wrong: -1, blank: 0 });
// A wrong answer sits 6 marks below a right one (5 not earned plus the 1 penalty); a blank, 5.
export const GAP = Object.freeze({ wrong: 6, blank: 5 });
export const QUICK_PICK_MS = 20000;

const text = (v, fallback = '') => v == null ? fallback : typeof v === 'object' ? (v.text ?? v.label ?? v.name ?? fallback) : String(v);

// Seconds on each question, from the device's visit/answer events. The active question is the
// one named by the latest event; the interval to the next event is credited to it.
export function dwellByQuestion(timeline = []) {
  const events = [...timeline].filter(e => e && e.qid && Number.isFinite(e.at)).sort((a, b) => a.at - b.at || (a.seq ?? 0) - (b.seq ?? 0));
  if (events.length < 2) return null;
  const dwell = {};
  for (let i = 0; i < events.length - 1; i++) {
    const gap = events[i + 1].at - events[i].at;
    if (gap > 0) dwell[events[i].qid] = (dwell[events[i].qid] || 0) + gap;
  }
  return dwell;
}

export function analyseSession(attempt) {
  const questions = attempt?.questionsSnapshot || [];
  const details = attempt?.details || [];
  const recovery = attempt?.selectionMeta?.recovery || null;
  const usableTimeline = recovery?.telemetry === 'self_reported' ? recovery.timeline : null;
  const dwell = dwellByQuestion(usableTimeline || []);
  const changes = recovery?.telemetry === 'self_reported' ? (recovery.observed?.answerChanges || []) : [];
  const changedIds = new Set(changes.map(c => c.qid));

  const rows = questions.map((q, index) => {
    const d = details.find(x => x.qid === q.id) || null;
    const verdict = d?.isCorrect === true ? 'correct' : d?.isCorrect === false ? 'wrong' : 'skipped';
    const ms = dwell ? (dwell[q.id] ?? null) : Number.isFinite(d?.timeMs) ? d.timeMs : null;
    return { q, d, verdict, index, number: index + 1, chapter: text(q.chapter, 'Chapter'), ms, changed: changedIds.has(q.id) };
  });

  const count = (v) => rows.filter(r => r.verdict === v).length;
  const right = count('correct'), wrong = count('wrong'), blank = count('skipped');
  const max = rows.length * MARKS.right;
  const scored = right * MARKS.right + wrong * MARKS.wrong;
  const marks = { scored, max, gap: max - scored, gapWrong: wrong * GAP.wrong, gapBlank: blank * GAP.blank, right, wrong, blank };

  const byChapter = new Map();
  for (const r of rows) {
    const c = byChapter.get(r.chapter) || { chapter: r.chapter, n: 0, right: 0, wrong: 0, blank: 0, gap: 0, first: null };
    c.n++;
    if (r.verdict === 'correct') c.right++;
    if (r.verdict === 'wrong') { c.wrong++; c.gap += GAP.wrong; }
    if (r.verdict === 'skipped') { c.blank++; c.gap += GAP.blank; }
    if (r.verdict !== 'correct') c.first ??= r.number;
    byChapter.set(r.chapter, c);
  }
  const chapters = [...byChapter.values()].filter(c => c.gap > 0).sort((a, b) => b.gap - a.gap || a.first - b.first);

  const helped = changes.filter(c => c.markEffect > 0).reduce((s, c) => s + c.markEffect, 0);
  const hurt = changes.filter(c => c.markEffect < 0).reduce((s, c) => s - c.markEffect, 0);
  const rightToWrong = changes.filter(c => c.markEffect === -(MARKS.right - MARKS.wrong)).length;

  const timed = rows.filter(r => Number.isFinite(r.ms));
  const wrongTimed = timed.filter(r => r.verdict === 'wrong');
  const quickWrong = wrongTimed.filter(r => r.ms < QUICK_PICK_MS);
  const totalMs = timed.reduce((s, r) => s + r.ms, 0);

  // Each observation is one fact (headline), one plain consequence (detail) and one thing to do (tip).
  const observations = [];
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (changes.length && hurt > 0) observations.push({ id: 'changes', tone: 'bad', label: 'Changed answers',
    headline: rightToWrong ? `You changed ${rightToWrong === 1 ? 'a right answer' : `${rightToWrong} right answers`} to wrong` : `Changing answers cost you ${hurt} marks`,
    detail: `${plural(changes.length, 'change')} this session: −${hurt} from the ones that hurt${helped ? `, +${helped} from the ones that helped` : ''}.`,
    tip: 'Switch only when you spot a specific error, not a new feeling.',
    questions: changes.filter(c => c.markEffect < 0).map(c => rows.find(r => r.q.id === c.qid)?.number).filter(Boolean) });
  else if (changes.length && helped > 0) observations.push({ id: 'changes', tone: 'good', label: 'Changed answers',
    headline: `Your second looks earned +${helped}`, detail: `${plural(changes.length, 'change')} this session and none cost marks.`,
    tip: 'Keep revisiting flagged questions before you submit.',
    questions: changes.map(c => rows.find(r => r.q.id === c.qid)?.number).filter(Boolean) });
  if (wrongTimed.length >= 2 && quickWrong.length / wrongTimed.length >= 0.5) observations.push({ id: 'quick', tone: 'bad', label: 'Rushed picks',
    headline: `${quickWrong.length} of your ${wrongTimed.length} wrong answers took under ${QUICK_PICK_MS / 1000} seconds`,
    detail: 'Fast wrong answers usually mean the question was matched to a familiar pattern on the first read.',
    tip: 'Find what is actually being asked before you look at the options.',
    questions: quickWrong.map(r => r.number) });
  if (chapters[0] && chapters[0].wrong >= 2 && wrong >= 3 && chapters[0].wrong / wrong >= 0.4) observations.push({ id: 'chapter', tone: 'bad', label: 'One weak chapter',
    headline: `${chapters[0].wrong} of your ${wrong} mistakes were in ${chapters[0].chapter}`,
    detail: 'This chapter is your biggest single leak in this session.',
    tip: 'Repair these first; they may share one idea.',
    questions: rows.filter(r => r.chapter === chapters[0].chapter && r.verdict === 'wrong').map(r => r.number) });
  if (blank > 0) observations.push({ id: 'blank', tone: 'neutral', label: 'Blanks',
    headline: `${blank === 1 ? 'One question' : `${blank} questions`} left blank`,
    detail: 'A blank costs nothing but earns nothing. The record cannot tell whether time ran out.',
    tip: 'Under +5/−1, once you can rule out one option, a guess is worth +1 on average.',
    questions: rows.filter(r => r.verdict === 'skipped').map(r => r.number) });

  return {
    rows, marks, chapters, observations,
    timing: timed.length ? { totalMs, averageMs: Math.round(totalMs / timed.length), source: dwell ? 'events' : 'details' } : null,
    changes: { count: changes.length, helped, hurt },
    telemetry: recovery?.telemetry || 'none',
    mistakes: rows.filter(r => r.verdict === 'wrong' && Number.isInteger(r.d?.givenIndex)),
  };
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
