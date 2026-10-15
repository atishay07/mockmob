// Replay: one paper as a clock you can scrub (spec tmp/mistake-lab-v4/SPEC.md 4.5). PURE, free, no model.
// Built from the paper trace (data/paper_trace.js), so its bars, the ledger and Time and decisions use the same time.
// Every sentence is finished here from data/mistake_lab.copy.json (replay), so the website and the app say the same.
//
// lab.replay (null without a usable record):
//   { version, rowSec, durationSec, recordSec, playMs, total, labels,
//     end: { at, reason, label } | null,
//     rows: [{ from, to, label, answeredBy, evenPaceBy,
//              bars: [{ qid, n, from, to, result, picks: [{ at, option, change }], marks: [at], away: [{ from, to, label }] }] }],
//   away holds every gap in a bar that is not time on the question: "Away 1m 10s" (the device said the paper was left)
//   and, on old records without away data only, "Not counted 41m" (a break of over 30 minutes with no event).
//     facts: [string], chips: [{ id, label, count }] }
// Times are whole seconds on the paper clock. A visit that crosses a row edge is split into one bar per row.
// result is the question's final result: right, wrong, blank, or held (under re-check or corrected).
// Even pace is the paper's own time a question (NTA: 60 minutes for 50, so 72 s). It is a reference line, never a target.
import COPY from './mistake_lab.copy.json' with { type: 'json' };
import { answersAt, clockLabel, fill, sec, shownAway, spentLabel } from './paper_trace.js';

export const REPLAY_VERSION = 1;
export const REPLAY_RULES = Object.freeze({
  rowSec: 600, // one row per 10 minutes: 6 rows for a 60-minute paper, a row fits 343 px on a phone
  playMs: 15000, // the whole record plays in 15 seconds
  checkShare: 2 / 3, // "At 40:00 you had answered 32 of 50": two thirds of the paper, on a whole minute
  chipGroups: Object.freeze(['changed_from_right', 'struck_key', 'long_stay', 'quick_wrong', 'never_opened']),
});

const R = COPY.replay;
const form = (forms, n) => (n === 1 ? forms.one : forms.many);

/**
 * buildReplay({ trace, questions, resultOf, groupCounts, pace }) -> the replay, or null.
 *   trace        paperTrace(attempt) in state 'ready'
 *   questions    the paper's questions in order (questionsSnapshot)
 *   resultOf     qid -> 'right' | 'wrong' | 'blank' | 'held'
 *   groupCounts  ledger group id -> number of questions (for the chips)
 *   pace         paperPace(attempt) or null
 */
export function buildReplay({ trace, questions, resultOf, groupCounts = {}, pace = null }) {
  if (!trace || trace.state !== 'ready' || !trace.spans.length || !questions?.length) return null;
  const total = questions.length;
  const numberOf = new Map(questions.map((q, i) => [q.id, i + 1]));
  const rowSec = REPLAY_RULES.rowSec;
  const recordMs = trace.end ? trace.end.at : trace.lastAt;
  const recordSec = sec(recordMs);
  const durationSec = pace ? sec(pace.paperMs) : Math.max(rowSec, Math.ceil(recordSec / rowSec) * rowSec);
  const answeredBy = (ms) => answersAt(trace, ms).size;
  const evenBy = (ms) => (pace ? Math.min(total, Math.floor(ms / pace.perQuestionMs)) : null);

  // Every visit, with its picks, marks and time away, as ms on the paper clock.
  const visits = trace.spans.map((span, index) => {
    const steps = (trace.stepsByQid.get(span.qid) || []).filter((s) => s.visit === index);
    const marks = (trace.marksByQid.get(span.qid) || []).filter((m) => m.marked && m.at >= span.from && m.at <= span.to);
    // Time away, and on old records a break of over 30 minutes: both are gaps in the bar, never time on the question.
    const away = [
      ...shownAway(trace.awayByQid.get(span.qid)).map((a) => ({ ...a, copy: R.away })),
      ...(trace.breakSpans || []).filter((b) => b.qid === span.qid).map((b) => ({ ...b, copy: R.gap })),
    ].filter((a) => a.from >= span.from && a.from <= span.to).sort((x, y) => x.from - y.from);
    return { ...span, index, steps, marks, away };
  });

  const rowCount = Math.max(1, Math.ceil(recordSec / rowSec));
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const fromS = r * rowSec;
    const toS = Math.min((r + 1) * rowSec, Math.max(durationSec, recordSec));
    const fromMs = fromS * 1000;
    const toMs = toS * 1000;
    const last = r === rowCount - 1;
    const bars = [];
    for (const v of visits) {
      const zero = v.to === v.from;
      const inside = zero ? (v.from >= fromMs && (v.from < toMs || (last && v.from <= toMs))) : v.from < toMs && v.to > fromMs;
      if (!inside) continue;
      const a = Math.max(v.from, fromMs);
      const b = Math.min(v.to, toMs);
      const within = (at) => at >= a && (at < b || (at === b && (b === v.to || last)));
      bars.push({
        qid: v.qid,
        n: numberOf.get(v.qid) ?? null,
        from: sec(a),
        to: sec(b),
        result: resultOf(v.qid),
        picks: v.steps.filter((s) => within(s.at)).map((s) => ({ at: sec(s.at), option: s.answer, change: s.kind !== 'first' })),
        marks: v.marks.filter((m) => within(m.at)).map((m) => sec(m.at)),
        away: v.away.filter((w) => (w.to > a && w.from < b) || (w.from === w.to && within(w.from)))
          .map((w) => ({ from: sec(Math.max(w.from, a)), to: sec(Math.min(w.to, b)), label: fill(w.copy, { time: spentLabel((w.to - w.from) / 1000) }) })),
      });
    }
    // The row ends at its edge, or at the end of the record when the record ends inside it.
    const labelMs = last && trace.end ? Math.min(toMs, recordMs) : toMs;
    const answered = answeredBy(labelMs);
    const even = evenBy(labelMs);
    const clock = clockLabel(sec(labelMs));
    rows.push({ from: fromS, to: toS, label: fill(even === null ? R.row.noPace : R.row.pace, { clock, a: answered, p: even }), answeredBy: answered, evenPaceBy: even, bars });
  }

  // Three facts under the grid.
  const facts = [];
  const firstVisit = new Map();
  for (const v of visits) if (!firstVisit.has(v.qid)) firstVisit.set(v.qid, v);
  const opened = [...firstVisit.keys()].filter((qid) => numberOf.has(qid)).length;
  facts.push(fill(opened === total ? R.opened.all : form(R.opened, opened), { o: opened, total }));
  if (opened === total) {
    const lastNew = [...firstVisit.values()].sort((x, y) => x.index - y.index).at(-1);
    const passEnd = lastNew.to;
    const returns = visits.filter((v) => v.index > lastNew.index).length;
    const values = { at: clockLabel(sec(passEnd)), q: numberOf.get(lastNew.qid), n: returns, time: spentLabel((recordMs - passEnd) / 1000) };
    // Without an end event the last visit has no known leave time, so the pass is dated by when it reached that question.
    if (!returns && !trace.end) facts.push(fill(R.firstPass.reached, { ...values, at: clockLabel(sec(lastNew.from)) }));
    else if (!returns) facts.push(fill(R.firstPass.none, values));
    else facts.push(fill(form(trace.end ? R.firstPass.tail : R.firstPass.count, returns), values));
  } else {
    const k = total - opened;
    facts.push(fill(form(R.noFirstPass, k), { k }));
  }
  if (pace) {
    const checkMs = Math.floor((pace.paperMs * REPLAY_RULES.checkShare) / 60000) * 60000;
    if (checkMs > 0 && recordMs >= checkMs) facts.push(fill(R.check, { clock: clockLabel(sec(checkMs)), a: answeredBy(checkMs), total, p: evenBy(checkMs) }));
  }

  const chips = [{ id: 'all', label: R.chips.all, count: null },
    ...REPLAY_RULES.chipGroups.filter((id) => (groupCounts[id] || 0) > 0).map((id) => ({ id, label: R.chips[id], count: groupCounts[id] }))];

  const end = trace.end ? { at: sec(trace.end.at), reason: trace.end.reason, label: fill(R.end[trace.end.reason], { at: clockLabel(sec(trace.end.at)) }) } : null;
  return { version: REPLAY_VERSION, rowSec, durationSec, recordSec, playMs: REPLAY_RULES.playMs, total, labels: { ...R.labels }, end, rows, facts, chips };
}
