// Time and decisions on the result page: how one paper's time and answer choices went, question by question.
// PURE, free, no model. Every fact comes from two places only:
//   1. the device record of the session (visit and answer events on the paper clock), used only when the
//      server found it matched the submitted answers (selectionMeta.recovery.telemetry === 'self_reported');
//   2. the paper's own time limit (selectionMeta.durationMinutes, else the mode's fixed limit in test_modes).
// Nothing here is a forecast, a cause or another student's number. Every sentence is finished here, so the
// website and the app say exactly the same words: the app's lib/features/result/model/time_decisions.dart is
// a line-for-line port, and both test suites check the same fixture sentences.
import { TEST_MODES } from './test_modes.js';

export const TIME_RULES = Object.freeze({
  minTimedMs: 2000, // a question counts as timed at 2 s or more (the repair's record line uses the same floor)
  minTimedForMedian: 10, // a median is named only over 10 or more timed questions
  longRatio: 2, // "That is 2.3 times the paper's pace" appears from twice the paper's time a question
  maxGapMs: 30 * 60 * 1000, // a gap over 30 minutes (a tab left open) is not counted as time on a question
  longest: 5, // rows in "Where your time went"
  changesShown: 5, // change rows shown before "Show all N changes" (all shown when there are 6 or fewer)
});

// Answer-review states whose stored key may be the old one: their marks effect is left out (as the SWOT does).
export const TIME_EXCLUDED_REVIEW_STATES = Object.freeze(['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected']);

const LETTERS = 'ABCDEFGH';
const MINUS = '−';
const letter = (i) => LETTERS[i] || String(i + 1);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const marksWord = (n) => plural(n, 'mark');

/** Whole seconds, as the paper clock shows them. */
const sec = (ms) => Math.max(0, Math.round(ms / 1000));
/** "42s", "1m", "2m 05s". */
export function spentLabel(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  return s % 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s / 60}m`;
}
/** The paper clock: "0:42", "12:05", "60:00". */
export function clockLabel(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const signedMarks = (n) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : '0');
/** 2.25 -> "2.3", 2 -> "2", 12.4 -> "12". */
export const ratioLabel = (x) => (x >= 10 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toString());
const paperLength = (ms) => (ms % 60000 === 0 ? plural(ms / 60000, 'minute') : spentLabel(ms / 1000));

export const TIME_COPY = Object.freeze({
  title: 'Time and decisions',
  sub: 'Where your time went and every answer you changed',
  clockNote: 'Clock times count from the start of the paper.',
  pace: (pace, length, total) => `This paper gives you ${pace} a question: ${length} for ${plural(total, 'question')}.`,
  median: (median, timed) => `Your median was ${median} a question, over ${timed} timed questions.`,
  split: (parts) => `You spent ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.`,
  splitPart: (time, n, kind) => `${time} on ${plural(n, kind === 'correct' ? 'right answer' : kind === 'wrong' ? 'wrong answer' : 'blank question')}`,
  longestTitle: 'Where your time went',
  longestNote: (pace) => `The mark on each bar is the paper's ${pace} a question.`,
  longestRatio: (x) => `${x} times the paper's pace`,
  verdict: { correct: 'Right', wrong: 'Wrong', skipped: 'Blank' },
  changesTitle: 'Every answer you changed',
  changesNone: 'You did not change any answers in this paper.',
  changesLead: (count, questions, net) => (count === 1
    ? `You changed one answer. Net effect on your marks: ${signedMarks(net)}.`
    : `You changed answers ${count} times across ${plural(questions, 'question')}. Net effect on your marks: ${signedMarks(net)}.`),
  changesGained: (n, m) => `${plural(n, 'change')} gained ${marksWord(m)}`,
  changesCost: (n, m) => `${plural(n, 'change')} cost ${marksWord(m)}`,
  changesNeutral: (n) => `${plural(n, 'change')} made no difference`,
  showAll: (n) => `Show all ${n} changes`,
  showFewer: 'Show fewer',
  changesHeld: (n) => (n === 1 ? '1 question under re-check or corrected is left out of the marks effect.' : `${n} questions under re-check or corrected are left out of the marks effect.`),
  // One question.
  rowLabel: 'Your time and picks',
  time: (spent) => `${spent} on this question.`,
  timePace: (spent, pace) => `${spent} on this question. The paper gives ${pace} a question.`,
  timePaceMedian: (spent, pace, median) => `${spent} on this question. The paper gives ${pace} a question, and your median was ${median}.`,
  timeMedian: (spent, median) => `${spent} on this question. Your median was ${median}.`,
  ratio: (x) => ` That is ${x} times the paper's pace.`,
  visits: (n) => ` You opened it ${n} times.`,
  underTwo: 'Less than 2 seconds on this question.',
  breakOnly: 'A break of over 30 minutes on this question is not counted.',
  lastOnly: 'The last question you opened. Time after your last tap is not recorded.',
  atLeast: (spent) => `At least ${spent}`,
  breakToo: ' A break of over 30 minutes is not counted.',
  notOpened: 'You did not open this question.',
  first: (l, at) => `Picked ${l} at ${at}.`,
  changed: (l, at, gap) => `Changed to ${l} at ${at}, ${gap} later.`,
  cleared: (at, gap) => `Cleared it at ${at}, ${gap} later.`,
  repicked: (l, at, gap) => `Picked ${l} at ${at}, ${gap} later.`,
  effectOne: (m) => (m < 0 ? `That change cost ${marksWord(-m)}.` : m > 0 ? `That change gained ${marksWord(m)}.` : 'That change made no difference to your marks.'),
  effectMany: (n, net) => (net < 0 ? `Together these ${n} changes cost ${marksWord(-net)}.` : net > 0 ? `Together these ${n} changes gained ${marksWord(net)}.` : `Together these ${n} changes made no difference to your marks.`),
  // Whole paper, when there is nothing to show.
  device: 'This earlier session was scored in your browser, so answer changes and timings are not available.',
  inconsistent: 'The record from your device did not match your submitted answers, so it is not used. Your score is unaffected.',
  notRecorded: 'Time and answer changes were not recorded for this paper. Your score is unaffected.',
});

const SERVER_SCORING = new Set(['server_practice_v1', 'server_snapshot_v1']);

/** The paper's time limit and its share per question, or null when the paper's limit is not known. */
export function paperPace(attempt) {
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const total = questions.length;
  if (!total) return null;
  const meta = attempt?.selectionMeta || {};
  const mode = meta.mode || attempt?.mode || null;
  let paperMs = Number.isFinite(meta.durationMinutes) && meta.durationMinutes > 0 ? meta.durationMinutes * 60000 : null;
  const m = mode ? TEST_MODES[mode] : null;
  if (!paperMs && m?.fixedDurationSec) paperMs = m.fixedDurationSec * 1000;
  if (!paperMs && mode === 'smart') paperMs = questions.reduce((s, q) => s + (m.adaptiveDurationByDifficulty?.[q?.difficulty] ?? m.durationPerQuestionSec), 0) * 1000;
  if (!paperMs && mode === 'quick') paperMs = total * m.durationPerQuestionSec * 1000;
  if (!paperMs) return null;
  return { paperMs, perQuestionMs: Math.round(paperMs / total), total };
}

/** One question's steps: answer events in order, repeats of the same answer and leading clears left out. */
function pickSteps(events) {
  const steps = [];
  let current;
  for (const e of events) {
    const answer = Number.isInteger(e.answer) ? e.answer : null;
    if (!steps.length && answer === null) continue;
    if (steps.length && answer === current) continue;
    const prev = steps.at(-1);
    const gap = prev ? sec(e.at) - sec(prev.at) : null;
    const kind = !prev ? 'first' : answer === null ? 'clear' : current === null ? 'repick' : 'change';
    steps.push({ kind, answer, at: e.at, gapSeconds: gap });
    current = answer;
  }
  return steps;
}

const stepText = (s) => {
  const at = clockLabel(sec(s.at));
  const gap = spentLabel(s.gapSeconds ?? 0);
  if (s.kind === 'first') return TIME_COPY.first(letter(s.answer), at);
  if (s.kind === 'clear') return TIME_COPY.cleared(at, gap);
  if (s.kind === 'repick') return TIME_COPY.repicked(letter(s.answer), at, gap);
  return TIME_COPY.changed(letter(s.answer), at, gap);
};

const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/**
 * The whole read for one attempt. `answerReviews` (qid -> { state }) leaves held or corrected questions out of the
 * marks effect. Returns { state, ... }: 'ready' with the analysis, or 'device' | 'inconsistent' | 'none' with one
 * `message` and nothing else.
 */
export function buildTimeDecisions(attempt, { answerReviews = {} } = {}) {
  const meta = attempt?.selectionMeta || {};
  const rec = meta.recovery || null;
  if (!SERVER_SCORING.has(meta.scoringVersion)) return { state: 'device', message: TIME_COPY.device };
  if (rec?.telemetry === 'inconsistent') return { state: 'inconsistent', message: TIME_COPY.inconsistent };
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const timeline = (Array.isArray(rec?.timeline) ? rec.timeline : [])
    .filter((e) => e && e.qid && Number.isFinite(e.at) && e.type !== 'mark')
    .sort((a, b) => a.at - b.at || (a.seq ?? 0) - (b.seq ?? 0));
  if (rec?.telemetry !== 'self_reported' || timeline.length < 2 || !questions.length) return { state: 'none', message: TIME_COPY.notRecorded };

  const excludedStates = new Set(TIME_EXCLUDED_REVIEW_STATES);
  const excluded = new Set(Object.entries(answerReviews || {}).filter(([, r]) => excludedStates.has(r?.state)).map(([qid]) => qid));

  // Time on each question: the interval to the next event is credited to the question the event names.
  const dwell = new Map();
  const visits = new Map();
  const breaks = new Set(); // questions with a gap over 30 minutes left out
  let last = null;
  for (let i = 0; i < timeline.length; i++) {
    const e = timeline[i];
    if (e.qid !== last) { visits.set(e.qid, (visits.get(e.qid) || 0) + 1); last = e.qid; }
    const next = timeline[i + 1];
    if (!next) continue;
    const gap = next.at - e.at;
    if (gap >= 0 && gap <= TIME_RULES.maxGapMs) dwell.set(e.qid, (dwell.get(e.qid) || 0) + gap);
    else if (gap > TIME_RULES.maxGapMs) breaks.add(e.qid);
  }

  const lastQid = timeline.at(-1).qid; // time after the final event (until submit) is not in the record
  const pace = paperPace(attempt);
  const timed = [...dwell.values()].filter((ms) => ms >= TIME_RULES.minTimedMs);
  const medianMs = timed.length >= TIME_RULES.minTimedForMedian ? median(timed) : null;
  const paceLabel = pace ? spentLabel(pace.perQuestionMs / 1000) : null;
  const medianLabel = medianMs !== null ? spentLabel(medianMs / 1000) : null;

  const allChanges = Array.isArray(rec.observed?.answerChanges) ? rec.observed.answerChanges.filter((c) => c && c.qid) : [];
  const details = new Map((attempt.details || []).map((d) => [d.qid, d]));

  const rows = questions.map((q, index) => {
    const d = details.get(q.id);
    const verdict = d?.isCorrect === true ? 'correct' : d?.isCorrect === false ? 'wrong' : 'skipped';
    const opened = visits.has(q.id);
    const ms = opened ? (dwell.get(q.id) || 0) : null;
    const ratio = pace && ms !== null && ms >= TIME_RULES.minTimedMs ? ms / pace.perQuestionMs : null;
    const steps = pickSteps(timeline.filter((e) => e.qid === q.id && e.type === 'answer'));
    const changes = allChanges.filter((c) => c.qid === q.id);
    const held = excluded.has(q.id);
    const net = changes.reduce((s, c) => s + (Number(c.markEffect) || 0), 0);

    let time;
    if (!opened) time = TIME_COPY.notOpened;
    else if (ms < TIME_RULES.minTimedMs) time = breaks.has(q.id) ? TIME_COPY.breakOnly : q.id === lastQid ? TIME_COPY.lastOnly : TIME_COPY.underTwo;
    else {
      const spent = q.id === lastQid ? TIME_COPY.atLeast(spentLabel(ms / 1000)) : spentLabel(ms / 1000);
      time = paceLabel && medianLabel ? TIME_COPY.timePaceMedian(spent, paceLabel, medianLabel)
        : paceLabel ? TIME_COPY.timePace(spent, paceLabel)
        : medianLabel ? TIME_COPY.timeMedian(spent, medianLabel)
        : TIME_COPY.time(spent);
      if (ratio !== null && ratio >= TIME_RULES.longRatio) time += TIME_COPY.ratio(ratioLabel(ratio));
      if (breaks.has(q.id)) time += TIME_COPY.breakToo;
    }
    if (opened && (visits.get(q.id) || 0) > 1) time += TIME_COPY.visits(visits.get(q.id));
    const picks = steps.length ? steps.map(stepText).join(' ') : null;
    const effect = changes.length && !held ? (changes.length === 1 ? TIME_COPY.effectOne(net) : TIME_COPY.effectMany(changes.length, net)) : null;
    return {
      qid: q.id, number: index + 1, verdict, chapter: q.chapter ?? null, opened, ms, visits: visits.get(q.id) || 0,
      ratio, steps, changes, net, held, lines: [time, picks, effect].filter(Boolean),
    };
  });

  // Whole paper.
  const split = ['correct', 'wrong', 'skipped'].map((kind) => {
    const group = rows.filter((r) => r.verdict === kind);
    return { kind, n: group.length, ms: group.reduce((s, r) => s + (r.ms || 0), 0) };
  }).filter((g) => g.n > 0);
  const longest = rows.filter((r) => r.ms !== null && r.ms >= TIME_RULES.minTimedMs)
    .sort((a, b) => b.ms - a.ms || a.number - b.number).slice(0, TIME_RULES.longest)
    .map((r) => ({ number: r.number, verdict: r.verdict, ms: r.ms, time: spentLabel(r.ms / 1000), ratio: r.ratio,
      ratioText: r.ratio !== null && r.ratio >= 1.05 ? TIME_COPY.longestRatio(ratioLabel(r.ratio)) : null }));

  const counted = rows.filter((r) => r.changes.length && !r.held);
  const heldChanged = rows.filter((r) => r.changes.length && r.held).length;
  const flat = counted.flatMap((r) => r.changes.map((c) => Number(c.markEffect) || 0));
  const gained = flat.filter((m) => m > 0);
  const cost = flat.filter((m) => m < 0);
  const neutral = flat.filter((m) => m === 0);
  const net = flat.reduce((s, m) => s + m, 0);
  const changeCount = rows.reduce((s, r) => s + r.changes.length, 0);

  return {
    state: 'ready',
    pace,
    medianMs,
    timedCount: timed.length,
    rows,
    longest,
    summary: {
      pace: pace ? TIME_COPY.pace(paceLabel, paperLength(pace.paperMs), pace.total) : null,
      median: medianLabel ? TIME_COPY.median(medianLabel, timed.length) : null,
      split: split.length ? TIME_COPY.split(split.map((g) => TIME_COPY.splitPart(spentLabel(g.ms / 1000), g.n, g.kind))) : null,
      longestNote: paceLabel && longest.length ? TIME_COPY.longestNote(paceLabel) : null,
    },
    changes: {
      count: changeCount,
      questions: rows.filter((r) => r.changes.length).length,
      net,
      lead: changeCount === 0 ? TIME_COPY.changesNone : counted.length ? TIME_COPY.changesLead(flat.length, counted.length, net) : null,
      parts: [
        gained.length ? { kind: 'gained', text: TIME_COPY.changesGained(gained.length, gained.reduce((s, m) => s + m, 0)) } : null,
        cost.length ? { kind: 'cost', text: TIME_COPY.changesCost(cost.length, -cost.reduce((s, m) => s + m, 0)) } : null,
        neutral.length ? { kind: 'neutral', text: TIME_COPY.changesNeutral(neutral.length) } : null,
      ].filter(Boolean),
      held: heldChanged ? TIME_COPY.changesHeld(heldChanged) : null,
      rows: rows.filter((r) => r.changes.length).map((r) => ({ number: r.number, qid: r.qid, net: r.held ? null : r.net, text: r.steps.map(stepText).join(' ') })),
    },
  };
}
