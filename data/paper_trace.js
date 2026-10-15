// The paper trace: the ONE time calculator for a finished paper (spec tmp/mistake-lab-v4/SPEC.md 4.5, 4.6, 6, 7).
// PURE, free, no model, no I/O, safe in the browser. Time and decisions (data/time_decisions.js), the Mistake Lab
// ledger and its Replay (data/mistake_lab.js, data/replay.js), the session read (data/session_recovery.js) and PrepOS
// (data/prepos_insights.js, and through it data/attempt_ledger.js and the SWOT) all read time from here, so no two
// screens can disagree about how long a question took.
//
// The record is what the server kept from the device's events (data/recovery.js scoreSession):
//   recovery.timeline   visits and answers, exactly as before slice 2
//   recovery.marks      [{seq, qid, at, marked}]               marks for review
//   recovery.presence   [{seq, qid, at, type: 'away' | 'back'}] the paper left and came back to
//   recovery.strikes    [{seq, qid, at, option, on}]          options crossed out and restored
//   recovery.end        {seq, qid, at, reason}                how the record ended, only when it was the last event
//
// The time rule, one for everyone:
//   1. The interval from one event to the next is credited to the question on screen: the one the last visit or answer
//      named. Every event type counts as a boundary; none of the others changes which question is on screen, so a mark
//      or a strike on another question of a passage page never moves time off the question the Replay shows open.
//   2. Time away from the paper is not counted: from an away to the next event of any kind (a back, or anything the
//      student did once they were back). A back with no open away, or a second away, changes nothing.
//   3. With an end event, the last question runs to the end. Without one, the time after the last event is unknown,
//      so the last question's time is "at least" (the record does not say when the student stopped).
//   4. Only when the record has no away or back data at all, a gap over 30 minutes is skipped as a break (a tab left
//      open). With away data the device said when the student left, so nothing is guessed.
//   5. A passage set shown on one page (the web runner): the questions of the set not in focus arrive as visits with
//      via 'set', just before the visit that brings the set on screen. They count as opened, never as time: rule 1
//      keeps crediting the question in focus (the one moved to, or last answered). The page is one screen, so moving
//      focus inside it is not a new visit of the set, and a set opened again is one more visit of each of its questions.
//   6. The submit sheet: a visit with via 'sheet' means the sheet opened over the question in focus. From there to the
//      next visit or answer no question is on screen and the time is credited to none, so with an end after it the last
//      question runs only to the sheet. Coming back from the sheet to the same page is not a new visit.
// Old records (visits and answers only) get exactly the numbers Time and decisions gave before slice 2: with no set or
// sheet visits every page holds one question, so its visits, spans and pages are the same thing.
import COPY from './mistake_lab.copy.json' with { type: 'json' };

export const TRACE_RULES = Object.freeze({
  maxGapMs: 30 * 60 * 1000, // rule 4: a break, only when the record has no away or back data
});

const SERVER_SCORING = new Set(['server_practice_v1', 'server_snapshot_v1']);
const EXTRA_TYPES = new Set(['mark', 'strike', 'away', 'back', 'end']);
const LETTERS = 'ABCDEFGH';
export const letter = (i) => LETTERS[i] || String(i + 1);
export { COPY as TRACE_COPY_ROOT };
const TRACE = COPY.trace;

/** Fill "{name}" placeholders. */
export function fill(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole));
}
/** Whole seconds, as the paper clock shows them. */
export const sec = (ms) => Math.max(0, Math.round(ms / 1000));
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

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const okEvent = (e) => isObj(e) && e.qid && Number.isFinite(e.at);
const byClock = (a, b) => a.at - b.at || (a.seq ?? 0) - (b.seq ?? 0);

/**
 * The record, normalised and merged. `input` is a recovery object ({ timeline, marks, presence, strikes, end }) or a
 * bare timeline array (the old session read passes one).
 */
export function recordOf(input) {
  const rec = Array.isArray(input) ? { timeline: input } : isObj(input) ? input : {};
  const list = (v) => (Array.isArray(v) ? v.filter(okEvent) : []);
  const timeline = list(rec.timeline).filter((e) => !EXTRA_TYPES.has(e.type)).sort(byClock);
  const marks = list(rec.marks).filter((e) => typeof e.marked === 'boolean').map((e) => ({ ...e, type: 'mark' }));
  const presence = list(rec.presence).filter((e) => e.type === 'away' || e.type === 'back');
  const strikes = list(rec.strikes).filter((e) => Number.isInteger(e.option) && typeof e.on === 'boolean').map((e) => ({ ...e, type: 'strike' }));
  const end = okEvent(rec.end) ? { ...rec.end, type: 'end' } : null;
  const events = [...timeline, ...marks, ...presence, ...strikes].sort(byClock);
  // The end is the last event by definition (the scorer keeps it only then); a stray earlier clock is clamped.
  if (end) events.push({ ...end, at: Math.max(end.at, events.at(-1)?.at ?? 0) });
  return { timeline, marks, presence, strikes, end: end ? events.at(-1) : null, events };
}

/** One question's steps: answer events in order, repeats of the same answer and leading clears left out. */
export function pickSteps(answerEvents, visitOf = () => null) {
  const steps = [];
  let current;
  for (const e of answerEvents) {
    const answer = Number.isInteger(e.answer) ? e.answer : null;
    if (!steps.length && answer === null) continue;
    if (steps.length && answer === current) continue;
    const prev = steps.at(-1);
    const gap = prev ? sec(e.at) - sec(prev.at) : null;
    const kind = !prev ? 'first' : answer === null ? 'clear' : current === null ? 'repick' : 'change';
    const visit = visitOf(e);
    steps.push({ kind, answer, at: e.at, gapSeconds: gap, visit, laterVisit: prev ? visit !== prev.visit : null });
    current = answer;
  }
  return steps;
}

const isSetVisit = (e) => e.type === 'visit' && e.via === 'set';
const isSheetVisit = (e) => e.type === 'visit' && e.via === 'sheet';
const isFocus = (e) => (e.type === 'answer' || e.type === 'visit') && !isSetVisit(e) && !isSheetVisit(e);

/**
 * The trace of a record: time per question under the one rule, visits, every visit as a span (for the Replay),
 * time away, breaks, marks, strike-outs and the steps of each question's picks. Never null; `timeline` may be empty.
 *   dwell       qid -> ms on it (rules 1 to 6)
 *   visits      qid -> pages it was on, in focus or shown with its passage set (old records: its visits)
 *   openedAt    qid -> ms when it first came on screen
 *   shownOnly   qids that were on screen only as part of a passage set, never in focus (no time, rule 5)
 *   spans       every stay of focus on one question: { qid, from, to } in ms (the Replay's bars)
 *   screens     every stay on one page: { qids, from, to, first, last } (first and last index spans)
 *   sheetSpans  the submit sheet open: { qid (the question under it), from, to }; endedOnSheet when the record ended so
 */
export function readTrace(input) {
  const { timeline, marks, presence, strikes, end, events } = recordOf(input);
  const awayKnown = presence.length > 0;
  const captured = !!(end || presence.length || strikes.length || marks.length || timeline.some((e) => e.via !== undefined));

  const dwell = new Map();
  const visits = new Map();
  const openedAt = new Map();
  const focused = new Set();
  const breaks = new Set();
  const awayByQid = new Map();
  const awaySpans = [];
  const breakSpans = []; // rule 4 gaps, on records without away data: not counted, and drawn as a gap in the Replay
  const sheetSpans = [];
  const spans = []; // every stay of focus: { qid, from, to } in ms; `to` is when focus moved, the sheet opened, or the end
  const screens = [];
  const visitIndex = new Map(); // timeline event -> index of its span
  let awayOpen = null;
  let onScreen = null; // the question in focus (still the question under the submit sheet while it is open)
  let sheet = null; // the submit sheet's span while it is open
  let pending = []; // set visits waiting for the visit that brings their set on screen
  const opened = (qid, at) => {
    visits.set(qid, (visits.get(qid) || 0) + 1);
    if (!openedAt.has(qid)) openedAt.set(qid, at);
  };
  const closeSpan = (at) => { if (spans.length && spans.at(-1).to === null) spans.at(-1).to = at; };
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (isSetVisit(e)) pending.push(e);
    else if (isSheetVisit(e)) {
      if (!sheet) {
        closeSpan(e.at);
        sheet = { qid: onScreen ?? e.qid, from: e.at, to: null };
        sheetSpans.push(sheet);
      }
    } else if (isFocus(e)) {
      const shown = pending.filter((x) => x.qid !== e.qid);
      pending = [];
      let page = screens.at(-1);
      if (!page || !page.group.has(e.qid)) {
        // A new page: the question in focus and every question shown with it.
        closeSpan(e.at);
        page = { group: new Set([e.qid]), first: spans.length, last: spans.length };
        screens.push(page);
        opened(e.qid, e.at);
      }
      // Shown with the set (on a new page, or added to this one when the set was shown again on a resume).
      for (const x of shown) if (!page.group.has(x.qid)) { page.group.add(x.qid); opened(x.qid, x.at); }
      // A new stay of focus: another question, or back on the page from the submit sheet.
      if (e.qid !== onScreen || sheet || !spans.length) {
        closeSpan(e.at);
        spans.push({ qid: e.qid, from: e.at, to: null });
        page.last = spans.length - 1;
        onScreen = e.qid;
      }
      if (sheet) { sheet.to = e.at; sheet = null; }
      focused.add(e.qid);
      visitIndex.set(e, spans.length - 1);
    }
    // Rule 1: equal to e.qid for a visit or an answer. Rule 6: nobody while the sheet is open. Rule 5: a set shown
    // before any question is in focus owns nothing.
    const owner = sheet ? null : onScreen ?? (isSetVisit(e) || isSheetVisit(e) ? null : e.qid);
    if (e.type === 'away') {
      if (!awayOpen) awayOpen = { qid: owner, from: e.at };
    } else if (awayOpen) {
      const span = { qid: awayOpen.qid, from: awayOpen.from, to: e.at };
      awaySpans.push(span);
      if (span.qid !== null) awayByQid.set(span.qid, [...(awayByQid.get(span.qid) || []), span]);
      awayOpen = null;
    }
    const next = events[i + 1];
    if (!next || e.type === 'end') continue;
    const gap = next.at - e.at;
    if (awayOpen) continue; // rule 2
    if (owner === null) continue; // rules 5 and 6: time on no question
    if (!awayKnown && gap > TRACE_RULES.maxGapMs) { breaks.add(owner); breakSpans.push({ qid: owner, from: e.at, to: next.at }); continue; } // rule 4
    if (gap >= 0) dwell.set(owner, (dwell.get(owner) || 0) + gap); // rule 1
  }
  // A set shown with no visit after it (the event cap): its questions were on screen, on the last page.
  const lastPage = screens.at(-1);
  if (lastPage) for (const x of pending) if (!lastPage.group.has(x.qid)) { lastPage.group.add(x.qid); opened(x.qid, x.at); }
  const lastAt = events.length ? events.at(-1).at : 0;
  const endedOnSheet = !!sheet;
  if (sheet) sheet.to = end ? end.at : lastAt;
  if (spans.length && spans.at(-1).to === null) spans.at(-1).to = end ? end.at : Math.max(spans.at(-1).from, lastAt);

  const stepsByQid = new Map();
  const answersByQid = new Map();
  for (const e of timeline) if (e.type === 'answer') answersByQid.set(e.qid, [...(answersByQid.get(e.qid) || []), e]);
  for (const [qid, list] of answersByQid) stepsByQid.set(qid, pickSteps(list, (e) => visitIndex.get(e) ?? null));
  const group = (list) => list.reduce((m, e) => m.set(e.qid, [...(m.get(e.qid) || []), e]), new Map());

  return {
    timeline, events, end, awayKnown, captured,
    dwell, visits, openedAt, breaks, breakSpans, spans, awaySpans, awayByQid, sheetSpans, endedOnSheet,
    shownOnly: new Set([...visits.keys()].filter((qid) => !focused.has(qid))),
    screens: screens.map((x) => ({ qids: [...x.group], first: x.first, last: x.last, from: spans[x.first].from, to: spans[x.last].to })),
    lastQid: onScreen, // the question in focus at the end of the record (under the submit sheet when it was open)
    lastAt, // the clock of the last event (the end, when there is one)
    openTail: !end && !endedOnSheet, // rule 3: without an end (or a sheet that stopped it), the last time is unknown
    stepsByQid,
    marksByQid: group(marks),
    strikesByQid: group(strikes),
  };
}

/**
 * The trace of one finished attempt, behind the same gates Time and decisions has always used:
 *   device        scored in the browser (no server record)
 *   inconsistent  the device record did not match the submitted answers
 *   none          no usable record (fewer than 2 visits and answers, or no questions)
 *   ready         { ...readTrace(recovery) }
 */
export function paperTrace(attempt) {
  const meta = attempt?.selectionMeta || {};
  const rec = meta.recovery || null;
  if (!SERVER_SCORING.has(meta.scoringVersion)) return { state: 'device' };
  if (rec?.telemetry === 'inconsistent') return { state: 'inconsistent' };
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  if (rec?.telemetry !== 'self_reported' || !questions.length) return { state: 'none' };
  const trace = readTrace(rec);
  if (trace.timeline.length < 2) return { state: 'none' };
  return { state: 'ready', ...trace };
}

/**
 * Time away worth words or a gap in the Replay: spans that round to at least 1s, so nothing reads "Away 0s" (the third
 * NTA warning submits the paper the instant the tab is hidden, and a quick switch back can take under half a second).
 * Shorter spans are still not counted as time on the question (rule 2); only their words are left out.
 */
export const shownAway = (spans) => (Array.isArray(spans) ? spans.filter((a) => sec(a.to - a.from) > 0) : []);

/** Milliseconds on each question under the one rule (a Map), from a recovery object or a bare timeline. */
export function dwellOf(input) {
  return readTrace(input).dwell;
}

// ---------- The question trace lines (4.6), finished here so the website and the app say the same words ----------

/** A pick step on a paper with slice 2 capture: "Changed to C at 54:20, 39m later, on a later visit." */
export function capturedStepText(s) {
  const at = clockLabel(sec(s.at));
  const gap = spentLabel(s.gapSeconds ?? 0);
  const how = s.laterVisit ? 'later' : 'same';
  if (s.kind === 'clear') return fill(TRACE.steps.cleared[how], { at, gap });
  if (s.kind === 'repick') return fill(TRACE.steps.repicked[how], { L: letter(s.answer), at, gap });
  return fill(TRACE.steps.changed[how], { L: letter(s.answer), at, gap });
}

/** "2m 05s on this question, until you submitted at 59:58." in place of the time line's first sentence. */
export function untilSubmitted(spent, endAt) {
  return fill(TRACE.untilSubmit, { spent, at: clockLabel(sec(endAt)) });
}

/** "1m 10s on this question, until you went to submit at 58:30.": the submit sheet (or check) stopped its time. */
export function untilSheet(spent, sheetAt) {
  return fill(TRACE.untilSheet, { spent, at: clockLabel(sec(sheetAt)) });
}

/**
 * The lines 4.6 adds under one question's time and picks, in order: strike-outs, the mark for review, time away and,
 * on the question open at the end, how the paper ended (time up, or the third warning; a submit changes the time
 * line itself, see untilSubmitted). Empty for a record without slice 2 capture.
 */
export function questionTraceLines(trace, qid, { keyIndex = null } = {}) {
  if (!trace?.captured) return [];
  const lines = [];
  const reason = trace.end?.reason;

  // Strike-outs: one sentence per option crossed out, in the order they were first crossed out.
  const strikes = trace.strikesByQid.get(qid) || [];
  const byOption = new Map();
  for (const s of strikes) {
    const o = byOption.get(s.option) || { option: s.option, firstOn: null, lastOff: null, on: false };
    if (s.on && o.firstOn === null) o.firstOn = s.at;
    if (!s.on && o.on) o.lastOff = s.at;
    o.on = s.on;
    byOption.set(s.option, o);
  }
  for (const o of [...byOption.values()].filter((x) => x.firstOn !== null).sort((a, b) => a.firstOn - b.firstOn)) {
    const isKey = o.option === keyIndex;
    const values = { L: letter(o.option), at: clockLabel(sec(o.firstOn)), at2: o.lastOff !== null ? clockLabel(sec(o.lastOff)) : '' };
    const restored = !o.on && o.lastOff !== null;
    lines.push(fill(TRACE.struck[isKey ? (restored ? 'keyRestored' : 'key') : restored ? 'plainRestored' : 'plain'], values));
  }

  // The mark for review: when it was first set, and whether it was still on at the end.
  const marks = trace.marksByQid.get(qid) || [];
  const firstOn = marks.find((m) => m.marked);
  if (firstOn) {
    const final = marks.at(-1);
    if (final.marked) lines.push(fill(TRACE.marked.kept[reason || 'open'] || TRACE.marked.kept.open, { at: clockLabel(sec(firstOn.at)) }));
    else lines.push(fill(TRACE.marked.removed, { at: clockLabel(sec(firstOn.at)), at2: clockLabel(sec(final.at)) }));
  }

  // Time away while this question was on screen (spans that round to 0s are left out of the words, never the rule).
  const away = shownAway(trace.awayByQid.get(qid));
  if (away.length) {
    const ms = away.reduce((s, a) => s + (a.to - a.from), 0);
    lines.push(fill(away.length === 1 ? TRACE.away.one : TRACE.away.many, { n: away.length, time: spentLabel(ms / 1000) }));
  }

  // How the paper ended, on the question that was open (or under the submit check, when that was open).
  const endLines = trace.endedOnSheet ? TRACE.endSheet : TRACE.endHere;
  if (trace.end && trace.lastQid === qid && endLines[reason]) lines.push(fill(endLines[reason], { at: clockLabel(sec(trace.end.at)) }));
  return lines;
}

/** The answer each question held at a clock time (ms): qid -> served index, blanks and clears left out. */
export function answersAt(trace, atMs) {
  const held = new Map();
  for (const e of trace.timeline) {
    if (e.at > atMs) break;
    if (e.type !== 'answer') continue;
    if (Number.isInteger(e.answer)) held.set(e.qid, e.answer);
    else held.delete(e.qid);
  }
  return held;
}
