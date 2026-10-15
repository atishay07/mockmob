// Across your mocks (spec tmp/mistake-lab-v4/SPEC.md 4.9): what the student's timed mocks show together.
// PURE, free, no model, no I/O. The record of each mock comes from data/paper_trace.js (the one time rule), so these
// lines, the ledger, Time and decisions and the Replay never disagree about a question's time or its picks.
//
// A timed mock is a Full or NTA paper (attempt_ledger MOCK_MODES) scored on the server whose device record matched
// the submitted answers (paperTrace state 'ready'). The window is the student's 10 newest such mocks, up to the paper
// being read (`asOf`), so an old result shows the record as it stood then. Every count is marked as each paper was
// scored (its stored answers and its own key), the same basis as the SWOT's record across papers, so the Lab, the
// Rule book and Analytics give the same numbers. Nothing is a forecast, a cause or a rank; every gate is a sentence.
//
// The lines (each with the marks it lost, for ranking; at most 3 shown, the rest behind "Show all"):
//   second_thoughts  every change from one option to another: wrong to right (+6), right to wrong (−6), wrong to wrong
//   changes_help     changes on a later visit against changes without leaving the question (gate: 8 of each)
//   never_opened     per subject, its last 3 mocks (2 when it has only 2), oldest first
//   long_stays       questions with 2 minutes or more on them (the ledger's own band), and how many were right
//   last_ten         answers whose final pick came in the paper's last 10 minutes against the rest
//                    (gate: 3 mocks with a known time limit and 20 answers on each side)
import COPY from './mistake_lab.copy.json' with { type: 'json' };
import { paperTrace } from './paper_trace.js';
import { paperPace, signedMarks } from './time_decisions.js';
import { isMock, when, chapterOf } from './attempt_ledger.js';
import { correctIndex } from './recovery.js';
import { getSubjectById } from './subjects.js';
import { GAP } from './session_recovery.js';

export const ACROSS_VERSION = 1;
const A = COPY.across;

export const ACROSS_RULES = Object.freeze({
  window: 10, // the newest timed mocks read
  minMocks: 2, // the block opens at 2 timed mocks with a device record
  shown: 3, // lines shown before "Show all"
  longMs: 120000, // the ledger's "2 minutes or more" (LAB_RULES.longMs)
  helpMin: 8, // "when changes help" needs 8 changes of each kind
  neverOpenedMocks: 3, // the last 3 mocks of a subject (2 when it has only 2)
  lastTenMs: 10 * 60 * 1000,
  lastTenMocks: 3, // "the last 10 minutes" needs 3 timed mocks with a known time limit ...
  lastTenMin: 20, // ... and 20 answers on each side
  order: Object.freeze(['second_thoughts', 'changes_help', 'never_opened', 'long_stays', 'last_ten']),
  marks: Object.freeze({ toRight: 6, toWrong: -6, wrongWrong: 0 }),
});

/** Fill "{name}" placeholders. */
export function fill(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole));
}
/** The `zero`, `one` or `many` form of a copy entry. */
export const form = (forms, n) => (n === 0 && forms.zero !== undefined ? forms.zero : n === 1 ? forms.one : forms.many);
export const subjectName = (id) => getSubjectById(id)?.name || String(id || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** "9, 7 and 6 of 50" when every paper has 50 questions, else "9 of 50, 7 of 40 and 6 of 50". */
export function countList(items) {
  const join = (parts) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(COPY.listJoin.comma)}${COPY.listJoin.and}${parts.at(-1)}`);
  const same = items.every((x) => x.total === items[0]?.total);
  return same ? `${join(items.map((x) => String(x.n)))} of ${items[0]?.total ?? 0}` : join(items.map((x) => `${x.n} of ${x.total}`));
}

/** Milliseconds of a stay that the one time rule counts: time away and skipped breaks inside it are left out. */
function countedMs(span, gaps) {
  let ms = span.to - span.from;
  for (const g of gaps) ms -= Math.max(0, Math.min(span.to, g.to) - Math.max(span.from, g.from));
  return Math.max(0, ms);
}

/**
 * One timed mock's record, or null when the attempt is not a timed mock with a usable device record.
 *   rows     per question in served order: outcome as scored, opened, ms (the one rule), the longest single visit,
 *            when its final answer was picked, and whether it was marked for review at some point
 *   changes  every change from one option to another: { qid, kind: 'to_right' | 'to_wrong' | 'wrong_wrong', laterVisit }
 */
export function mockRecord(attempt) {
  if (!attempt || !isMock(attempt)) return null;
  const trace = paperTrace(attempt);
  if (trace.state !== 'ready') return null;
  const questions = attempt.questionsSnapshot;
  const details = new Map((attempt.details || []).map((d) => [d.qid, d]));
  const gaps = [...trace.awaySpans, ...trace.breakSpans];
  const longestVisit = new Map();
  for (const s of trace.spans) longestVisit.set(s.qid, Math.max(longestVisit.get(s.qid) || 0, countedMs(s, gaps)));
  const changes = [];
  const rows = questions.map((q, index) => {
    const d = details.get(q.id) || null;
    const key = correctIndex(q);
    const keyIndex = Number.isInteger(key) && key >= 0 ? key : null;
    const given = Number.isInteger(d?.givenIndex) ? d.givenIndex : null;
    const outcome = d?.isCorrect === true ? 'right' : d?.isCorrect === false ? 'wrong' : 'blank';
    const steps = trace.stepsByQid.get(q.id) || [];
    steps.forEach((s, i) => {
      if (s.kind !== 'change') return;
      const from = steps[i - 1].answer;
      const kind = from === keyIndex ? 'to_wrong' : s.answer === keyIndex ? 'to_right' : 'wrong_wrong';
      changes.push({ qid: q.id, kind, laterVisit: s.laterVisit === true });
    });
    const last = steps.at(-1);
    const opened = trace.visits.has(q.id);
    return {
      qid: q.id, number: index + 1, chapter: chapterOf(q), keyIndex, given, outcome,
      lost: outcome === 'wrong' ? GAP.wrong : outcome === 'blank' ? GAP.blank : 0,
      opened,
      ms: opened ? trace.dwell.get(q.id) || 0 : null,
      // The question open at the end of a record with no end event: its time is only "at least".
      tail: trace.openTail && trace.lastQid === q.id,
      longestVisitMs: longestVisit.get(q.id) || 0,
      finalAt: given !== null && last && last.answer === given ? last.at : null,
      marked: (trace.marksByQid.get(q.id) || []).some((m) => m.marked),
    };
  });
  const pace = paperPace(attempt);
  return {
    id: attempt.id, subject: attempt.subject ?? null, completedAt: when(attempt), total: rows.length, rows, changes,
    paperMs: pace ? pace.paperMs : null,
    captured: !!trace.captured, // slice 2 capture: marks for review were recorded (none marked is then a real zero)
    lengthMs: trace.lastAt || 0,
  };
}

/** The student's timed mocks with a device record, newest first, completed at or before `asOf`, at most `window`. */
export function timedMocks(attempts, { asOf = Infinity, window = ACROSS_RULES.window, subject = null, before = null } = {}) {
  const out = [];
  const list = (attempts || []).filter((a) => a && isMock(a) && when(a) <= asOf && (before === null || when(a) < before) && (subject === null || a.subject === subject))
    .sort((a, b) => when(b) - when(a) || String(b.id).localeCompare(String(a.id)));
  for (const a of list) {
    if (out.length >= window) break;
    const r = mockRecord(a);
    if (r) out.push(r);
  }
  return out;
}

// ---------- The counts every reader shares (the Rule book and the rule check use these too) ----------

export function changeCounts(mocks) {
  const all = mocks.flatMap((m) => m.changes);
  const of = (kind) => all.filter((c) => c.kind === kind).length;
  const later = all.filter((c) => c.laterVisit);
  const same = all.filter((c) => !c.laterVisit);
  return {
    total: all.length, toRight: of('to_right'), toWrong: of('to_wrong'), wrongWrong: of('wrong_wrong'),
    later: { n: later.length, helped: later.filter((c) => c.kind === 'to_right').length },
    same: { n: same.length, helped: same.filter((c) => c.kind === 'to_right').length },
  };
}
export const neverOpenedOf = (m) => m.rows.filter((r) => !r.opened).length;
/** Questions with 2 minutes or more on them (the ledger's band, total time under the one rule). */
export const longRows = (m) => m.rows.filter((r) => r.ms !== null && r.ms >= ACROSS_RULES.longMs);
/** Answered questions split at 2 minutes; a last question whose time is only "at least" and under 2 minutes is left out. */
export function answersByTime(mocks) {
  const slow = { right: 0, n: 0 };
  const fast = { right: 0, n: 0 };
  for (const m of mocks) for (const r of m.rows) {
    if (r.given === null || r.ms === null) continue;
    if (r.ms >= ACROSS_RULES.longMs) { slow.n += 1; if (r.outcome === 'right') slow.right += 1; }
    else if (!r.tail) { fast.n += 1; if (r.outcome === 'right') fast.right += 1; }
  }
  return { slow, fast };
}
/** Questions marked for review at some point and answered, over mocks whose record carries marks. */
export function markedCounts(mocks) {
  const withMarks = mocks.filter((m) => m.captured);
  const marked = withMarks.flatMap((m) => m.rows.filter((r) => r.marked));
  const answered = marked.filter((r) => r.given !== null);
  const right = answered.filter((r) => r.outcome === 'right').length;
  return { mocks: withMarks.length, marked: marked.length, answered: answered.length, right, blank: marked.length - answered.length, marks: 5 * right - (answered.length - right) };
}

// ---------- The lines ----------

function secondThoughts(mocks, mocksPhrase) {
  const c = changeCounts(mocks);
  if (!c.total) return { id: 'second_thoughts', subject: null, marks: 0, gated: false, text: fill(A.secondThoughts.none, { mocks: mocksPhrase }) };
  const M = ACROSS_RULES.marks;
  const parts = [
    c.toRight ? fill(A.secondThoughts.toRight, { n: c.toRight, marks: signedMarks(c.toRight * M.toRight) }) : null,
    c.toWrong ? fill(A.secondThoughts.toWrong, { n: c.toWrong, marks: signedMarks(c.toWrong * M.toWrong) }) : null,
    c.wrongWrong ? fill(form(A.secondThoughts.wrongWrong, c.wrongWrong), { n: c.wrongWrong }) : null,
  ].filter(Boolean);
  const net = c.toRight * M.toRight + c.toWrong * M.toWrong;
  const text = `${fill(form(A.secondThoughts.lead, c.total), { mocks: mocksPhrase, n: c.total })} ${parts.join(COPY.listJoin.comma)}. ${fill(A.secondThoughts.net, { marks: signedMarks(net) })}`;
  return { id: 'second_thoughts', subject: null, marks: c.toWrong * -M.toWrong, gated: false, text };
}

function changesHelp(mocks) {
  const c = changeCounts(mocks);
  const values = { a: c.later.helped, b: c.later.n, c: c.same.helped, d: c.same.n };
  if (c.later.n < ACROSS_RULES.helpMin || c.same.n < ACROSS_RULES.helpMin) return { id: 'changes_help', subject: null, marks: 0, gated: true, text: fill(A.changesHelp.gate, values) };
  // Ranked with the marks the changes that did not help lost (right to wrong).
  return { id: 'changes_help', subject: null, marks: c.toWrong * -ACROSS_RULES.marks.toWrong, gated: false, text: fill(A.changesHelp.text, values) };
}

function neverOpened(mocks) {
  const subjects = [...new Set(mocks.map((m) => m.subject))];
  const lines = [];
  for (const subject of subjects) {
    const recent = mocks.filter((m) => m.subject === subject).slice(0, ACROSS_RULES.neverOpenedMocks).reverse(); // oldest first
    if (recent.length < 2) continue;
    const items = recent.map((m) => ({ n: neverOpenedOf(m), total: m.total }));
    const n = items.reduce((s, x) => s + x.n, 0);
    lines.push({ id: 'never_opened', subject, marks: n * GAP.blank, gated: false, text: fill(A.neverOpened, { k: recent.length, subject: subjectName(subject), list: countList(items) }) });
  }
  return lines;
}

function longStays(mocks, mocksPhrase) {
  const rows = mocks.flatMap(longRows);
  const n = rows.length;
  const r = rows.filter((x) => x.outcome === 'right').length;
  const marks = rows.reduce((s, x) => s + x.lost, 0);
  if (!n) return { id: 'long_stays', subject: null, marks: 0, gated: false, text: fill(A.longStays.none, { mocks: mocksPhrase }) };
  const right = n === 1 ? form(A.longStays.rightOne, r) : fill(form(A.longStays.rightMany, r), { r });
  return { id: 'long_stays', subject: null, marks, gated: false, text: fill(n === 1 ? A.longStays.one : A.longStays.many, { mocks: mocksPhrase, n, right }) };
}

function lastTen(mocks) {
  const timed = mocks.filter((m) => m.paperMs);
  const late = { right: 0, n: 0, wrong: 0 };
  const early = { right: 0, n: 0 };
  for (const m of timed) {
    const from = m.paperMs - ACROSS_RULES.lastTenMs;
    for (const r of m.rows) {
      if (r.given === null || r.finalAt === null) continue;
      const side = r.finalAt >= from ? late : early;
      side.n += 1;
      if (r.outcome === 'right') side.right += 1;
      else if (side === late) late.wrong += 1;
    }
  }
  const values = { mocks: fill(form(A.mocks, timed.length), { n: timed.length }), a: late.right, b: late.n, c: early.right, d: early.n };
  if (timed.length < ACROSS_RULES.lastTenMocks || late.n < ACROSS_RULES.lastTenMin || early.n < ACROSS_RULES.lastTenMin) {
    return { id: 'last_ten', subject: null, marks: 0, gated: true, text: fill(A.lastTen.gate, values) };
  }
  const lengths = new Set(timed.map((m) => m.paperMs));
  const firstMs = timed[0].paperMs - ACROSS_RULES.lastTenMs;
  const earlier = lengths.size === 1 && firstMs % 60000 === 0 ? fill(A.lastTen.firstMinutes, { m: firstMs / 60000 }) : A.lastTen.earlier;
  return { id: 'last_ten', subject: null, marks: late.wrong * GAP.wrong, gated: false, text: fill(A.lastTen.text, { ...values, earlier }) };
}

/**
 * buildAcrossMocks({ attempts, asOf }) -> the acrossMocks contract (v1): data/tests/fixtures/mistake_lab/contract_across_v1.json.
 *   none        no timed mock with a device record yet (message says how one is made)
 *   below_gate  fewer than 2 (message states the gate)
 *   ready       lines (the top 3 by marks lost) and more (the rest), each { id, subject, marks, gated, text }
 * A line below its own gate states the gate in words, carries 0 marks and so sorts after every measured line.
 */
export function buildAcrossMocks({ attempts = [], asOf = Infinity } = {}) {
  const mocks = timedMocks(attempts, { asOf });
  const n = mocks.length;
  const shell = (state, message) => ({ version: ACROSS_VERSION, state, title: A.title, mocks: n, message, basis: null, lines: [], more: [], showAll: null, showFewer: A.showFewer });
  if (!n) return shell('none', A.none);
  if (n < ACROSS_RULES.minMocks) return shell('below_gate', fill(form(A.belowGate, n), { n }));
  const mocksPhrase = fill(form(A.mocks, n), { n });
  const order = (id) => ACROSS_RULES.order.indexOf(id);
  const all = [secondThoughts(mocks, mocksPhrase), changesHelp(mocks), ...neverOpened(mocks), longStays(mocks, mocksPhrase), lastTen(mocks)]
    .map((line, i) => ({ line, i }))
    .sort((x, y) => Number(x.line.gated) - Number(y.line.gated) || y.line.marks - x.line.marks || order(x.line.id) - order(y.line.id) || x.i - y.i)
    .map((x) => x.line);
  const more = all.slice(ACROSS_RULES.shown);
  return {
    ...shell('ready', null),
    basis: fill(form(A.basis, n), { n }),
    lines: all.slice(0, ACROSS_RULES.shown),
    more,
    showAll: more.length ? fill(A.showAll, { n: all.length }) : null,
  };
}
