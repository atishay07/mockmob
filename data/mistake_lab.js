// The Mistake Lab ledger (spec tmp/mistake-lab-v4/SPEC.md 4.1 to 4.3): where every missed mark of one paper went.
// PURE, free, no model, no I/O. Shared by the website and (through the server's finished sentences) the app.
//
// Every lost question (wrong or blank) sits in exactly one group, checked top to bottom, so the groups always add up
// to the heading's gap (6 for a wrong answer, 5 for a blank: GAP in data/session_recovery.js). Time, visits and the
// order of picks come from buildTimeDecisions (data/time_decisions.js), so the ledger and Time and decisions agree.
// Held questions (EXCLUDED_REVIEW_STATES) are a separate group and are left out of the re-mark and the cohort line.
// The 2-minute and 20-second bands are fixed for every student and every paper; they are never fitted to anyone.
// Every sentence comes from data/mistake_lab.copy.json; nothing here is a forecast, a cause or a rank.
//
// Slice 2 (spec 4.5, 4.6): time comes from data/paper_trace.js through Time and decisions, so with an end event the
// last question's time is known (it can be a quick wrong answer, and a long stay is no longer "at least"); with
// strike-outs captured a wrong answer whose key was crossed out sits in "Crossed out the key"; and the lab carries
// `replay` (data/replay.js) and `time` (the whole Time and decisions read, finished here for the app to render).
import COPY from './mistake_lab.copy.json' with { type: 'json' };
import { buildTimeDecisions, paperPace, spentLabel, TIME_COPY, TIME_RULES } from './time_decisions.js';
import { paperTrace } from './paper_trace.js';
import { buildReplay } from './replay.js';
import { GAP } from './session_recovery.js';
import { EXCLUDED_REVIEW_STATES } from './attempt_ledger.js';
import { correctIndex } from './recovery.js';
import { wilson } from './prepos_insights.js';

export const LAB_VERSION = 1;
export { COPY as LAB_COPY };

export const LAB_RULES = Object.freeze({
  longMs: 120000, // "2 minutes or more, still lost"
  quickMs: 20000, // "Wrong in under 20 seconds"
  headlineMarks: 12, // a headline needs 12 marks or more ...
  headlineShare: 0.15, // ... or 15% or more of the gap
  cohortMin: 10, // no cohort line or counts under 10 other students
  cohortLabelMin: 20, // "A small group so far" below 20; "most got right" needs 20 and a Wilson low bound over 50%
  timeMedianMin: 30, // "Students who got this right took a median of 51s": 30 or more timed right answers, the student left out
  timeChangesMin: 20, // "6 of 27 timed students changed their answer": 20 or more timed students
  timeStrikeMin: 20, // "9 of 30 students crossed out the key": 20 or more students with strike data
  slowQuestionsMin: 5, // the ledger's "over twice as long": 5 or more such questions ...
  slowRightMin: 15, // ... each with 15 or more timed right answers (the student left out)
  slowRatio: 2, // "over twice as long" is strictly more than twice the median of the students who got it right
  mostRightLowAbove: 50, // the 95% Wilson low bound, in percent, that "most other students got it right" must beat
  trapMinPicks: 5, // the common trap needs 5 or more picks of the student's option
  chipsShown: 8, // Q chips shown before "Show {k} more"
  marks: Object.freeze({ right: 5, wrong: -1, blank: 0 }),
  groupOrder: Object.freeze(['changed_from_right', 'struck_key', 'never_opened', 'long_stay', 'quick_wrong', 'other_wrong', 'other_blank', 'held']),
  basicOrder: Object.freeze(['wrong', 'blank', 'held']),
  headlineGroups: Object.freeze(['changed_from_right', 'struck_key', 'never_opened', 'long_stay', 'quick_wrong']),
});

/** Every group, in bar order, with its label and the state it belongs to. */
export const LAB_GROUPS = Object.freeze([
  ...LAB_RULES.groupOrder.map((id) => Object.freeze({ id, label: COPY.groups[id].label, states: Object.freeze(id === 'held' ? ['ready', 'basic'] : ['ready']) })),
  ...['wrong', 'blank'].map((id) => Object.freeze({ id, label: COPY.groups[id].label, states: Object.freeze(['basic']) })),
]);

const LETTERS = 'ABCDEFGH';
const MINUS = '−';
const letter = (i) => LETTERS[i] || String(i + 1);
const HELD = new Set(EXCLUDED_REVIEW_STATES);

/** Fill "{name}" placeholders. */
export function fill(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole));
}
const form = (forms, n) => (n === 0 && forms.zero !== undefined ? forms.zero : n === 1 ? forms.one : forms.many);
/** A whole number of marks, with the minus sign U+2212 for a negative one. */
export const marksNumber = (n) => (n < 0 ? `${MINUS}${-n}` : String(n));
/** "Q12", "Q12 and Q17", "Q12, Q17 and Q36". */
export function numberList(numbers) {
  const qs = numbers.map((n) => `Q${n}`);
  if (qs.length <= 1) return qs.join('');
  return `${qs.slice(0, -1).join(COPY.listJoin.comma)}${COPY.listJoin.and}${qs.at(-1)}`;
}
/** "21 Apr" or "15 Oct 2026" from an ISO day (YYYY-MM-DD). */
function dayLabel(iso, withYear) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${COPY.months[m - 1]}${withYear ? ` ${y}` : ''}`;
}
export function dateRange(since, until) {
  const sameYear = String(since).slice(0, 4) === String(until).slice(0, 4);
  return { from: dayLabel(since, !sameYear), to: dayLabel(until, true) };
}
const paperLength = (ms) => (ms % 60000 === 0 ? fill(form(COPY.paperMinutes, ms / 60000), { n: ms / 60000 }) : spentLabel(ms / 1000));

/** A time line that says nothing true about a short stay: a gap of over 30 minutes was left out of this question. */
const hadBreak = (row) => {
  const first = row?.lines?.[0] || '';
  return first === TIME_COPY.breakOnly || first.includes(TIME_COPY.breakToo.trim());
};

// ---------- Cohort time and changes, per question (4.13; the nightly table, data/cohort_time.js) ----------

const CT = COPY.cohort.time;
/** "51s", "1m 05s": a median time in whole seconds. */
const medianLabel = (ms) => spentLabel(Math.round(ms / 1000));

/**
 * The lines 4.13 adds to one opened answer, from a cohort read's `time` ({ right: { n, medianMs } | null, timed, changed,
 * movedOff, strike: { n, struck } }, the student's own first answer already left out). Each line is hidden until its gate
 * passes, and every number carries its denominator. Never null: an empty array when no gate passes.
 */
export function timeLinesFor(time) {
  if (!time || typeof time !== 'object') return [];
  const lines = [];
  if (time.right && time.right.n >= LAB_RULES.timeMedianMin && Number.isFinite(time.right.medianMs)) {
    lines.push(fill(CT.median, { time: medianLabel(time.right.medianMs), n: time.right.n }));
  }
  const k = time.strike;
  const strikeShown = Boolean(k && Number.isInteger(k.n) && k.n >= LAB_RULES.timeStrikeMin);
  const changesShown = Number.isInteger(time.timed) && time.timed >= LAB_RULES.timeChangesMin;
  // Two "None of ..." lines in a row say one thing: nobody wavered here. They fold into one sentence, both denominators kept.
  if (changesShown && strikeShown && time.changed === 0 && k.struck === 0) {
    lines.push(fill(CT.quiet, { n: time.timed, k: k.n }));
    return lines;
  }
  if (changesShown) {
    const c = time.changed;
    const m = time.movedOff;
    let line = fill(c === 0 ? CT.changes.none : c === 1 ? CT.changes.one : CT.changes.many, { c, n: time.timed });
    if (c > 0) line += fill(m === 0 ? CT.moved.none : m === 1 && c === 1 ? CT.moved.single : m === 1 ? CT.moved.one : CT.moved.many, { m });
    lines.push(line);
  }
  if (strikeShown) {
    lines.push(fill(k.struck === 0 ? CT.struck.none : k.struck === 1 ? CT.struck.one : CT.struck.many, { s: k.struck, n: k.n }));
  }
  return lines;
}

/**
 * The ledger finding: questions on which the student took more than twice as long as the students who got it right
 * (their median, the student left out), when 5 or more such questions each have 15 or more timed right answers. Needs the
 * student's own times to be reliable (a record with an end event, no break on the question, 2 s or more), else null.
 * Returns { line, numbers, questions, right, fine } or null.
 */
export function slowFindingFor(cohort, rows) {
  const byQid = cohort?.byQid || {};
  const slow = rows.filter((r) => {
    if (r.held || r.brk || r.ms === null || r.ms < TIME_RULES.minTimedMs) return false;
    const right = byQid[r.qid]?.time?.right;
    return !!right && right.n >= LAB_RULES.slowRightMin && Number.isFinite(right.medianMs) && r.ms > LAB_RULES.slowRatio * right.medianMs;
  });
  if (slow.length < LAB_RULES.slowQuestionsMin) return null;
  const k = slow.length;
  const r = slow.filter((x) => x.outcome === 'right').length;
  const right = fill(r === 0 ? CT.slowRight.none : r === k ? CT.slowRight.all : CT.slowRight.some, { r, k });
  return {
    line: fill(CT.slow, { k, right }),
    numbers: slow.map((x) => x.number).sort((a, b) => a - b),
    questions: k,
    right: r,
    fine: fill(CT.slowFine, { k }),
  };
}

// ---------- How others answered, per question (4.3) ----------

/**
 * One question's "How others answered" from a cohort read ({ n, right, counts, keyIndex }) and the student's own
 * final answer (served index or null). Returns null under the 10-student gate.
 */
export function othersFor(read, { givenIndex = null, outcome = 'blank' } = {}) {
  if (!read || !Number.isInteger(read.n) || read.n < LAB_RULES.cohortMin) return null;
  const { n, right } = read;
  const counts = Array.isArray(read.counts) ? read.counts.map((c) => Number(c) || 0) : [];
  const small = n < LAB_RULES.cohortLabelMin;
  let line = fill(COPY.others.base, { n, right: fill(form(COPY.others.right, right), { r: right }) });
  if (small) line += COPY.others.small;
  if (outcome === 'wrong' && Number.isInteger(givenIndex) && givenIndex !== read.keyIndex) {
    const L = letter(givenIndex);
    const c = counts[givenIndex] || 0;
    const w = n - right;
    const wrongOthers = counts.map((count, i) => ({ i, count })).filter((x) => x.i !== read.keyIndex && x.i !== givenIndex);
    const topOther = Math.max(0, ...wrongOthers.map((x) => x.count));
    if (c >= LAB_RULES.trapMinPicks && c * 2 >= w && c > topOther) line += fill(COPY.others.commonTrap, { c, w, L });
    else if (c === 0) line += fill(COPY.others.nobodyElse, { L });
    else {
      line += fill(form(COPY.others.sameAsYou, c), { c, L });
      const tops = wrongOthers.filter((x) => x.count === topOther);
      if (topOther > c && tops.length === 1) line += fill(COPY.others.moreChose, { L2: letter(tops[0].i), c2: topOther });
    }
  }
  // Slice 5: time, changes and strike-outs, each only once its gate passes (the nightly table, never the static snapshot).
  const lines = timeLinesFor(read.time);
  return {
    n, right, counts, keyIndex: Number.isInteger(read.keyIndex) ? read.keyIndex : null, small, line,
    ...(lines.length ? { lines } : {}),
    optionLabels: counts.map((c, i) => fill(COPY.others.option, { L: letter(i), c, n })),
  };
}

// ---------- Older papers ----------

/**
 * The one line an older paper gets, and its one action, or null when the paper's record is whole.
 *   no_clock        scored in the browser, or no clock record was kept
 *   short           a record exists but is too short to read
 *   unreadable      the server could not read the device's record (telemetry invalid)
 *   not_matched     the device record did not match the submitted answers, so it is not used
 *   before_capture  a usable record, taken before the capture of 15 Oct (no time away, marks, strike-outs or end)
 * The action opens the existing practice setup on this paper's subject with a Full mock; the setup shows its cost.
 * Nothing here is a cause or a forecast: it says what this paper's record cannot show, and why.
 */
export function olderPaper({ attempt, td, trace }) {
  let reason = null;
  if (td.state === 'device') reason = 'no_clock';
  else if (td.state === 'inconsistent') reason = 'not_matched';
  else if (td.state === 'none') {
    // A record the server could not read (telemetry 'invalid') is not a missing one: a paper taken today can have it.
    const telemetry = attempt?.selectionMeta?.recovery?.telemetry;
    reason = telemetry === 'self_reported' ? 'short' : telemetry === 'invalid' ? 'unreadable' : 'no_clock';
  }
  else if (td.state === 'ready' && trace && !trace.captured) reason = 'before_capture';
  if (!reason) return null;
  const subject = attempt?.subject ? String(attempt.subject) : null;
  return {
    reason,
    line: COPY.older[reason],
    action: { label: reason === 'before_capture' ? COPY.older.actionAgain : COPY.older.action, subject, mode: 'full', href: `/dashboard?${subject ? `subject=${encodeURIComponent(subject)}&` : ''}mode=full` },
  };
}

// ---------- The ledger ----------

function groupEntry(id, rows, { open = false, fourOptionsOnly = false } = {}) {
  const marks = rows.reduce((s, r) => s + r.lost, 0);
  const numbers = rows.map((r) => r.number).sort((a, b) => a - b);
  const blankKind = id === 'other_blank' || id === 'blank';
  const doLine = blankKind && !fourOptionsOnly ? null : COPY.groups[id].do;
  return { id, label: COPY.groups[id].label, marks, count: rows.length, numbers, line: fill(form(COPY.groupLine, rows.length), { m: marks, n: rows.length }), doLine, open };
}

function headlineFor(groups, { gap, total, pace, tailQid, rowsById }) {
  const candidates = groups.filter((g) => LAB_RULES.headlineGroups.includes(g.id) && g.marks > 0);
  if (!candidates.length) return null;
  const order = (id) => LAB_RULES.groupOrder.indexOf(id);
  const top = [...candidates].sort((a, b) => b.marks - a.marks || order(a.id) - order(b.id))[0];
  if (!(top.marks >= LAB_RULES.headlineMarks || top.marks >= LAB_RULES.headlineShare * gap)) return null;
  const n = top.count;
  const values = { n, m: top.marks, gap, total };
  let text;
  if (top.id === 'long_stay') {
    const ms = top.qids.reduce((s, qid) => s + (rowsById.get(qid)?.ms || 0), 0);
    const time = spentLabel(ms / 1000);
    values.time = top.qids.includes(tailQid) ? fill(COPY.atLeast, { time }) : time;
    if (pace) values.paper = paperLength(pace.paperMs);
    text = fill(form(pace ? COPY.headline.long_stay : COPY.headline.long_stay_no_paper, n), values);
  } else {
    text = fill(form(COPY.headline[top.id], n), values);
  }
  return { group: top.id, text };
}

function remarkFor(rows, heldCount) {
  const counted = rows.filter((r) => !r.held);
  const changed = counted.filter((r) => r.changed);
  if (!changed.length) return null;
  const M = LAB_RULES.marks;
  const markOf = (answer, key) => (answer === null || answer === undefined ? M.blank : answer === key ? M.right : M.wrong);
  const first = counted.reduce((s, r) => s + markOf(r.firstPick, r.keyIndex), 0);
  const final = counted.reduce((s, r) => s + markOf(r.givenIndex, r.keyIndex), 0);
  const k = changed.length;
  const values = { first: marksNumber(first), final: marksNumber(final), d: Math.abs(first - final), k, questions: form(COPY.remark.questionWord, k) };
  const text = fill(first > final ? COPY.remark.cost : first < final ? COPY.remark.gained : COPY.remark.even, values);
  const fine = COPY.remark.fine + (heldCount > 0 ? fill(form(COPY.remark.fineHeld, heldCount), { h: heldCount }) : '');
  return { first, final, questions: k, text, fine };
}

function cohortBlock(cohort, rows, total, slow = null) {
  if (!cohort || typeof cohort !== 'object') return null;
  const byQid = cohort.byQid || {};
  const most = rows.filter((r) => r.lost > 0 && !r.held).filter((r) => {
    const read = byQid[r.qid];
    if (!read || read.n < LAB_RULES.cohortLabelMin) return false;
    const w = wilson(read.right, read.n);
    return w.low !== null && w.low > LAB_RULES.mostRightLowAbove;
  });
  const numbers = most.map((r) => r.number).sort((a, b) => a - b);
  const m = most.reduce((s, r) => s + r.lost, 0);
  const line = numbers.length ? fill(form(COPY.cohort.line, numbers.length), { k: numbers.length, list: numberList(numbers), m }) : null;
  const compared = Object.values(byQid).filter((read) => read && read.n >= LAB_RULES.cohortMin).length;
  const fine = [fill(form(COPY.cohort.coverage, compared), { c: compared, total })];
  if (cohort.since && cohort.until) fine.push(fill(COPY.cohort.source, dateRange(cohort.since, cohort.until)));
  if (slow) fine.push(slow.fine);
  return { line, numbers, marks: m, fine, ...(slow ? { slow: { line: slow.line, numbers: slow.numbers, questions: slow.questions, right: slow.right } } : {}) };
}

/**
 * buildMistakeLab({ attempt, answerReviews, cohort }) -> the `lab` contract (v1), or null when there is no paper.
 * `cohort` is cohortForAttempt's read (data/cohort_picks.js) or null. States:
 *   ready  the device record matched the submitted answers: the full groups, headline, re-mark and cohort lines;
 *   basic  no usable record (scored in the browser, inconsistent, not recorded): wrong, blank and held;
 *   none   nothing missed: the heading only.
 */
export function buildMistakeLab({ attempt, answerReviews = {}, cohort = null } = {}) {
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  if (!questions.length) return null;
  const details = new Map((attempt.details || []).map((d) => [d.qid, d]));
  const heldIds = new Set(Object.entries(answerReviews || {}).filter(([, r]) => r && HELD.has(r.state)).map(([qid]) => qid));
  const td = buildTimeDecisions(attempt, { answerReviews });
  const ready = td.state === 'ready';
  const tdRows = ready ? new Map(td.rows.map((r) => [r.qid, r])) : new Map();
  const trace = ready ? paperTrace(attempt) : null;
  const struck = (qid, key) => !!trace && key !== null && (trace.strikesByQid.get(qid) || []).some((s) => s.on && s.option === key);

  const rows = questions.map((q, index) => {
    const d = details.get(q.id) || null;
    const outcome = d?.isCorrect === true ? 'right' : d?.isCorrect === false ? 'wrong' : 'blank';
    const key = correctIndex(q);
    const t = tdRows.get(q.id) || null;
    return {
      qid: q.id, number: index + 1, outcome, held: heldIds.has(q.id),
      lost: outcome === 'wrong' ? GAP.wrong : outcome === 'blank' ? GAP.blank : 0,
      givenIndex: Number.isInteger(d?.givenIndex) ? d.givenIndex : null,
      keyIndex: Number.isInteger(key) && key >= 0 ? key : null,
      options: Array.isArray(q.options) ? q.options.length : 0,
      opened: t ? t.opened : null, ms: t ? t.ms : null, brk: t ? hadBreak(t) : false,
      firstPick: t && t.steps.length ? t.steps[0].answer : null,
      changed: !!(t && t.changes.length),
      struckKey: struck(q.id, Number.isInteger(key) && key >= 0 ? key : null),
    };
  });
  const total = rows.length;
  const slow = ready && trace?.end ? slowFindingFor(cohort, rows) : null;
  const gap = rows.reduce((s, r) => s + r.lost, 0);
  const rowsById = new Map(rows.map((r) => [r.qid, r]));

  // How others answered, on every answer row (right, wrong and blank alike), whatever the ledger state.
  const byQuestion = {};
  const cohortById = cohort?.byQid || {};
  for (const r of rows) {
    const others = r.held ? null : othersFor(cohortById[r.qid], { givenIndex: r.givenIndex, outcome: r.outcome });
    if (others) byQuestion[r.qid] = { group: null, others };
  }

  // An older paper carries one line and one action (`older`); a paper with a whole record has no such key.
  const older = olderPaper({ attempt, td, trace });
  const base = { version: LAB_VERSION, labels: { ...COPY.labels }, ...(older ? { older } : {}) };
  // Slice 2 parts, the same in every state: the Replay (null without a usable record) and the finished time read.
  const resultOf = (qid) => {
    const r = rowsById.get(qid);
    return !r ? 'blank' : r.held ? 'held' : r.outcome;
  };
  const slice2 = (groups) => ({
    replay: ready ? buildReplay({ trace, questions, resultOf, groupCounts: Object.fromEntries(groups.map((g) => [g.id, g.count])), pace: paperPace(attempt) }) : null,
    time: JSON.parse(JSON.stringify(td)),
  });
  if (gap === 0) {
    return { ...base, state: 'none', heading: COPY.headingNone, gap: 0, headline: null, groups: [], barLabel: null, remark: null, cohort: cohortBlock(cohort, rows, total, slow), fine: [], byQuestion, ...slice2([]) };
  }

  const lostRows = rows.filter((r) => r.lost > 0);
  const assigned = new Map();
  // The question whose time after the last tap is unknown: the last one opened, unless an end event closed the record.
  const tailQid = ready && !td.end ? td.lastQid : null;
  for (const r of lostRows) {
    let id;
    if (r.held) id = 'held';
    else if (!ready) id = r.outcome; // 'wrong' | 'blank'
    else if (r.firstPick !== null && r.firstPick === r.keyIndex) id = 'changed_from_right';
    else if (r.outcome === 'wrong' && r.struckKey) id = 'struck_key';
    else if (r.outcome === 'blank' && !r.opened) id = 'never_opened';
    else if (r.ms !== null && r.ms >= LAB_RULES.longMs) id = 'long_stay';
    else if (r.outcome === 'wrong' && r.opened && r.ms !== null && r.ms < LAB_RULES.quickMs && r.qid !== tailQid && !r.brk) id = 'quick_wrong';
    else id = r.outcome === 'wrong' ? 'other_wrong' : 'other_blank';
    assigned.set(r.qid, id);
  }

  const order = ready ? LAB_RULES.groupOrder : LAB_RULES.basicOrder;
  let groups = order.map((id) => {
    const members = lostRows.filter((r) => assigned.get(r.qid) === id);
    if (!members.length) return null;
    const g = groupEntry(id, members, { fourOptionsOnly: members.every((r) => r.options === 4) });
    return Object.defineProperty(g, 'qids', { value: members.map((r) => r.qid), enumerable: false });
  }).filter(Boolean);

  const headline = ready ? headlineFor(groups, { gap, total, pace: paperPace(attempt), tailQid, rowsById }) : null;
  groups = groups.map((g) => ({ ...g, open: headline ? g.id === headline.group : false }));
  for (const r of lostRows) byQuestion[r.qid] = { group: assigned.get(r.qid), others: byQuestion[r.qid]?.others ?? null };

  const barLabel = fill(COPY.barLabel, { gap, parts: groups.map((g) => fill(COPY.groups[g.id].bar, { m: g.marks })).join(COPY.listJoin.comma) });
  const fine = ready ? [COPY.fineReady] : [fill(COPY.fineBasic, { message: td.message })];

  return {
    ...base,
    state: ready ? 'ready' : 'basic',
    heading: fill(form(COPY.heading, gap), { gap }),
    gap,
    headline,
    groups,
    barLabel,
    remark: ready ? remarkFor(rows, rows.filter((r) => r.held).length) : null,
    cohort: cohortBlock(cohort, rows, total, slow),
    fine,
    byQuestion,
    ...slice2(groups),
  };
}
