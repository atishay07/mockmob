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
//     opened: [{ n, at, result }]   every question that came on screen: when it first did (seconds) and its result
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
    rows.push({ from: fromS, to: toS, label: fill(even === null ? R.row.noPace : R.row.pace, { clock, a: answered, total, p: even }), answeredBy: answered, evenPaceBy: even, bars });
  }

  // Three facts under the grid. A page is one stay on one screen: a question, or a passage set shown whole (the web
  // runner). The first pass ends with the last page that brought a question on screen for the first time; every page
  // after it is a return visit (data/paper_trace.js rules 5 and 6). On old records a page is a visit, as before.
  const facts = [];
  const pages = trace.screens;
  const firstPage = new Map(); // qid -> index of the page that first showed it
  pages.forEach((page, i) => { for (const qid of page.qids) if (numberOf.has(qid) && !firstPage.has(qid)) firstPage.set(qid, i); });
  const opened = firstPage.size;
  facts.push(fill(opened === total ? R.opened.all : form(R.opened, opened), { o: opened, total }));
  if (opened === total) {
    const lastIndex = Math.max(...firstPage.values());
    const page = pages[lastIndex];
    const passEnd = page.to;
    const later = pages.slice(lastIndex + 1);
    const returns = later.length;
    // Time on the return visits: each stay of focus on them, less time away and breaks inside it (never counted).
    const notCounted = [...trace.awaySpans, ...(trace.breakSpans || [])];
    const onPage = (p) => trace.spans.slice(p.first, p.last + 1).reduce((s, v) => s + (v.to - v.from)
      - notCounted.reduce((t, a) => t + Math.max(0, Math.min(a.to, v.to) - Math.max(a.from, v.from)), 0), 0);
    const returnMs = later.reduce((s, p) => s + onPage(p), 0);
    const values = { at: clockLabel(sec(passEnd)), q: numberOf.get(trace.spans[page.last].qid), n: returns, time: spentLabel(returnMs / 1000) };
    // Without an end event the last visit has no known leave time, so the pass is dated by when it reached that page.
    if (!returns && !trace.end) {
      const fresh = [...firstPage].filter(([, i]) => i === lastIndex).map(([qid]) => numberOf.get(qid)).sort((a, b) => a - b);
      if (fresh.length > 1) facts.push(fill(R.firstPass.reachedSet, { q: fresh[0], q2: fresh.at(-1), at: clockLabel(sec(page.from)) }));
      else facts.push(fill(R.firstPass.reached, { q: numberOf.get(trace.spans[page.first].qid), at: clockLabel(sec(page.from)) }));
    } else if (!returns) facts.push(fill(R.firstPass.none, values));
    else facts.push(fill(form(trace.end ? R.firstPass.tail : R.firstPass.count, returns), values));
  } else {
    const k = total - opened;
    facts.push(fill(form(R.noFirstPass, k), { k, total }));
  }
  if (pace) {
    const checkMs = Math.floor((pace.paperMs * REPLAY_RULES.checkShare) / 60000) * 60000;
    if (checkMs > 0 && recordMs >= checkMs) facts.push(fill(R.check, { clock: clockLabel(sec(checkMs)), a: answeredBy(checkMs), total, p: evenBy(checkMs) }));
  }

  const chips = [{ id: 'all', label: R.chips.all, count: null },
    ...REPLAY_RULES.chipGroups.filter((id) => (groupCounts[id] || 0) > 0).map((id) => ({ id, label: R.chips[id], count: groupCounts[id] }))];

  const end = trace.end ? { at: sec(trace.end.at), reason: trace.end.reason, label: fill(R.end[trace.end.reason], { at: clockLabel(sec(trace.end.at)) }) } : null;
  // When each question first came on screen, with its final result: a question of a passage set that was shown but
  // never in focus has no bar, and is still opened (the answer map shows it opened, not "never").
  const openedList = questions.filter((q) => trace.openedAt.has(q.id))
    .map((q) => ({ n: numberOf.get(q.id), at: sec(trace.openedAt.get(q.id)), result: resultOf(q.id) }));
  return { version: REPLAY_VERSION, rowSec, durationSec, recordSec, playMs: REPLAY_RULES.playMs, total, labels: { ...R.labels }, end, rows, opened: openedList, facts, chips };
}

// ---------------------------------------------------------------------------------------------------------------------
// D17, pass 1018 (docs/design-decisions/pass-1018/REVIEW-RESULT-1018.md section 6): the replay drawn as one slot per
// question, sized to the paper. replayView() reads the replay built above (no new data is collected) and returns what the
// slots and the play need: perQuestion, the real events, and the cut rule. The 10-minute rows are no longer drawn.
export const SLOT_RULES = Object.freeze({
  minSlotPhone: 12, // px, under 768 px wide
  minSlotWide: 16,
  gap: 2,
  cap: 3, // a slot's height is its time over even pace, capped at 3x
  cutEvents: 3, // fewer answer events than this: nothing to replay
  cutSec: 120, // or submitted in under 2 minutes
  labelsAllUpTo: 12, // Q numbers under every slot up to 12 slots a row; otherwise 1, every fifth and the last
});

/**
 * Which slot a press belongs to: the one whose centre is nearest the press (centres and x in the same unit). Every slot has a
 * 44 px wide hit area, but in a row of 25 on a phone the slots sit 12 px apart, so those areas overlap; the browser would hand
 * a press to whichever slot is last in the page. The row asks this instead, so a press always selects the slot it is closest to.
 * Returns the index into `centers`, or -1 for an empty row.
 */
export function nearestSlot(centers, x) {
  let best = -1;
  let gap = Infinity;
  for (let i = 0; i < centers.length; i += 1) {
    const d = Math.abs(centers[i] - x);
    if (d < gap) { gap = d; best = i; }
  }
  return best;
}

/** perRow = ceil(N / ceil(N x (minSlot + 2) / width)); rows are balanced, so a short last row never strands. */
export function slotLayout(n, width, minSlot) {
  const count = Math.max(1, Math.ceil((n * (minSlot + SLOT_RULES.gap)) / Math.max(1, width)));
  const perRow = Math.max(1, Math.ceil(n / count));
  return { perRow, rows: Math.ceil(n / perRow) };
}

/**
 * replayView(replay, { total }) -> {
 *   perQuestion: [{ n, sec, result, changed, visits }]   seconds on the question across visits, less time away
 *   events: [{ at, n, kind: 'pick'|'change'|'clear'|'back'|'end', from?, to? }]   in clock order
 *   cut: null | { reason: 'none'|'short'|'few' }, recordSec, answered, total, awaySec, awayCount, firstAt: Map(n -> sec) }
 * `replay` may be null (no usable record): the view is cut with reason 'none'.
 */
export function replayView(replay, { total: given = null } = {}) {
  const total = Number(given ?? replay?.total) || 0;
  if (!replay || !Array.isArray(replay.rows)) return { perQuestion: [], events: [], cut: { reason: 'none' }, recordSec: 0, answered: 0, total, awaySec: 0, awayCount: 0, firstAt: new Map() };
  const rowSec = replay.rowSec || REPLAY_RULES.rowSec;
  const byN = new Map();
  let awaySec = 0;
  let awayCount = 0;
  replay.rows.forEach((row, r) => (row.bars || []).forEach((b) => {
    if (!Number.isInteger(b.n)) return;
    let q = byN.get(b.n);
    if (!q) { q = { n: b.n, result: b.result, visits: [], picks: [], away: 0 }; byN.set(b.n, q); }
    const last = q.visits.at(-1);
    // A visit split at a row edge is one visit.
    if (last && last.to === b.from && b.from % rowSec === 0 && r === last.row + 1) { last.to = b.to; last.row = r; } else q.visits.push({ from: b.from, to: b.to, row: r });
    q.picks.push(...(b.picks || []));
    for (const a of b.away || []) { const s = Math.max(0, a.to - a.from); q.away += s; awaySec += s; awayCount += 1; }
  }));
  const perQuestion = [];
  const openedResult = new Map((replay.opened || []).map((o) => [o.n, o.result]));
  for (let n = 1; n <= total; n += 1) {
    const q = byN.get(n);
    if (!q) { perQuestion.push({ n, sec: 0, result: openedResult.get(n) || 'blank', changed: false, visits: 0 }); continue; }
    q.picks.sort((a, b) => a.at - b.at);
    const spent = q.visits.reduce((s, v) => s + Math.max(0, v.to - v.from), 0) - q.away;
    perQuestion.push({ n, sec: Math.max(0, spent), result: q.result, changed: q.picks.some((p) => p.change), visits: q.visits.length });
  }
  const events = [];
  let answerEvents = 0;
  let answered = 0;
  const firstAt = new Map();
  for (const q of byN.values()) {
    firstAt.set(q.n, q.visits[0]?.from ?? null);
    let prev = null;
    for (const p of q.picks) {
      const cleared = p.option === null || p.option === undefined;
      const kind = cleared ? 'clear' : p.change && prev !== null ? 'change' : 'pick';
      events.push({ at: p.at, n: q.n, kind, from: prev, to: cleared ? null : p.option });
      if (!cleared) answerEvents += 1;
      prev = cleared ? null : p.option;
    }
    if (prev !== null) answered += 1;
    q.visits.slice(1).forEach((v) => events.push({ at: v.from, n: q.n, kind: 'back' }));
  }
  for (const o of replay.opened || []) if (!firstAt.has(o.n)) firstAt.set(o.n, o.at);
  const recordSec = Number(replay.recordSec) || 0;
  if (replay.end && Number.isFinite(replay.end.at)) events.push({ at: replay.end.at, n: null, kind: 'end' });
  const rank = { back: 0, pick: 1, change: 1, clear: 1, end: 2 };
  events.sort((a, b) => a.at - b.at || rank[a.kind] - rank[b.kind] || (a.n ?? Infinity) - (b.n ?? Infinity));
  const cut = recordSec < SLOT_RULES.cutSec ? { reason: 'short' } : answerEvents < SLOT_RULES.cutEvents ? { reason: 'few' } : null;
  return { perQuestion, events, cut, recordSec, answered, total, awaySec, awayCount, firstAt };
}

/** Under a minute in words ("58 seconds"); longer as the paper says it ("3m 17s"). */
export function spokenTime(secs) {
  const v = Math.round(secs);
  return v < 60 ? fill(v === 1 ? R.slots.seconds.one : R.slots.seconds.many, { n: v }) : spentLabel(v);
}

/**
 * What the paper's own record still holds when there is no replay of it (an older paper, or a result without the Lab): its
 * total time, and how many answers changed. null when it holds no time at all. The sentence under "Nothing to replay"
 * says this instead of claiming there is no record, because the index row and the answer map read the same numbers.
 */
export function knownRecord({ totalMs = null, changed = 0 } = {}) {
  const sec = Number(totalMs) > 0 ? Number(totalMs) / 1000 : 0;
  if (!(sec > 0)) return null;
  return { sec, changed: Math.max(0, Math.floor(Number(changed) || 0)) };
}

/** The one sentence under "Nothing to replay on this paper." (view = replayView(...) with a cut; known = knownRecord(...) or null). */
export function cutSentence(view, { known = null } = {}) {
  const S = R.slots;
  const time = spokenTime(view.recordSec);
  const blanks = Math.max(0, view.total - view.answered);
  const where = blanks && view.answered ? fill(S.whereBoth, { a: view.answered, b: blanks }) : S.whereAll;
  if (view.cut?.reason === 'short') return fill(S.cutShort, { time, a: view.answered, total: view.total, where });
  if (view.cut?.reason === 'few') return fill(S.cutFew, { time, k: view.events.filter((e) => e.kind === 'pick' || e.kind === 'change').length });
  if (!known) return S.cutNone;
  const changes = known.changed ? fill(known.changed === 1 ? S.cutHeldChanges.one : S.cutHeldChanges.many, { k: known.changed }) : null;
  return [S.cutNoReplay, fill(S.cutHeldTime, { time: spokenTime(known.sec) }), changes, S.whereAll].filter(Boolean).join(' ');
}

/** The Time part's index line when nothing is drawn: "58 seconds. Nothing to replay." The paper's own total time stands in for a missing replay clock. */
export function cutIndexLine(view, { known = null } = {}) {
  if (!view.cut) return null;
  const secs = view.recordSec || known?.sec || 0;
  return fill(R.slots.cutIndex, { time: secs ? spokenTime(secs) : 'No record' });
}

// ---------------------------------------------------------------------------------------------------------------------
// D29, pass 1018 (owner, 18 Oct 4:10 am IST): "Play your paper back, 20 s". The same engine as the replay above, not a second
// feature: it reads replayView() (perQuestion seconds and the real events) plus the attempt record's own rows and answer
// changes, and returns ONE timeline of frames. The sheet plays question by question (a bubble lights right, wrong or blank
// as the score counts up), pauses on the real moments (a right answer changed to wrong, the longest stay), lands on the
// costliest chapter and ends on the one next move. Nothing here is invented: a moment exists only where the record says it
// happened, and a paper with no trace still plays its sheet, score, costliest chapter and next move (no moments).
// PURE: no React, no clock. The website draws it with a rAF clock over `durationMs`; the app ports it with the same JSON.
export const REEL_RULES = Object.freeze({
  startMs: 600, // the empty sheet, before the first bubble
  walkMs: 8000, // the whole sheet takes about 8 seconds, never slower than 420 ms or faster than 90 ms a question
  stepMin: 90,
  stepMax: 420,
  momentMs: 2200, // each pause on a real moment
  chapterMs: 3200, // the costliest chapter
  endMs: 1200, // the next move settles
  maxMoments: 3,
  longStayMin: 90, // seconds, and at least 2.5x the even pace, on a question that did not earn marks
  longStayRatio: 2.5,
});
const MARKS_RIGHT = 5;
const MARKS_WRONG = -1;
const LETTERS = 'ABCDEFGH';

/** The caption of one real event, in words ("Q22 changed D to A, a right answer made wrong"). Shared by the replay's Play. */
export function eventCaption(e, { key = null } = {}) {
  if (!e) return null;
  const C = R.slots.caption;
  const at = clockLabel(e.at);
  const letter = (i) => (Number.isInteger(i) ? LETTERS[i] || String(i + 1) : '');
  if (e.kind === 'end') return { at, text: C.end };
  if (e.kind === 'back') return { at, text: fill(C.back, { n: e.n }) };
  if (e.kind === 'clear') return { at, text: fill(C.clear, { n: e.n }) };
  if (e.kind === 'pick') return { at, text: fill(C.pick, { n: e.n, to: letter(e.to) }) };
  let made = '';
  if (Number.isInteger(key)) {
    if (e.from === key && e.to !== key) made = `, ${R.slots.made.rightToWrong}`;
    else if (e.from !== key && e.to === key) made = `, ${R.slots.made.wrongToRight}`;
  }
  return { at, text: fill(C.change, { n: e.n, from: letter(e.from), to: letter(e.to), made }) };
}

/**
 * The moments in the order they happened: by the clock second each carries (`sec`: when the answer changed, or when the long
 * stay began). A moment without a known second goes after the dated ones, in paper order; ties go by question number.
 */
export function momentsInTimeOrder(moments) {
  const when = (m) => (Number.isFinite(m.sec) ? m.sec : Infinity);
  return [...moments].sort((a, b) => when(a) - when(b) || a.n - b.n);
}

/**
 * The real moments of a paper, at most REEL_RULES.maxMoments, chosen by rank (lost, long, won) and returned in the order they
 * happened on the clock ("What stood out" reads like the sitting did):
 *   lost  the first answer was the key and the paper's final answer is not (answerChanges: before === key, after !== key)
 *   long  the longest stay (>= 90 s and >= 2.5x even pace) on a question that did not earn marks
 *   won   the first answer was wrong and the final answer is the key
 * rows: analyseSession(attempt).rows; changes: attempt.selectionMeta.recovery.observed.answerChanges.
 */
export function reelMoments({ rows = [], changes = [], view = null, paceSec = null } = {}) {
  const M = R.reel.moments;
  const byQid = new Map();
  for (const c of Array.isArray(changes) ? changes : []) {
    if (!c || !c.qid || !Number.isFinite(c.at)) continue;
    if (!byQid.has(c.qid)) byQid.set(c.qid, []);
    byQid.get(c.qid).push(c);
  }
  const lost = [];
  const won = [];
  for (const row of rows) {
    const key = row.q?.correctIndex;
    const list = byQid.get(row.q?.id)?.slice().sort((a, b) => a.at - b.at);
    if (!list?.length || !Number.isInteger(key)) continue;
    if (row.verdict === 'wrong' && list[0].before === key) {
      const leave = list.find((c) => c.before === key && c.after !== key) || list[0];
      lost.push({ kind: 'lost', n: row.number, sec: sec(leave.at), at: clockLabel(sec(leave.at)), text: fill(M.lost, { n: row.number, m: MARKS_RIGHT - MARKS_WRONG }) });
    } else if (row.verdict === 'correct' && Number.isInteger(list[0].before) && list[0].before !== key) {
      const gain = list.find((c) => c.after === key) || list[list.length - 1];
      won.push({ kind: 'won', n: row.number, sec: sec(gain.at), at: clockLabel(sec(gain.at)), text: fill(M.won, { n: row.number, m: MARKS_RIGHT - MARKS_WRONG }) });
    }
  }
  let long = null;
  if (view && !view.cut && paceSec > 0) {
    const verdictOf = new Map(rows.map((r) => [r.number, r.verdict]));
    const best = view.perQuestion.filter((q) => q.sec >= REEL_RULES.longStayMin && q.sec >= REEL_RULES.longStayRatio * paceSec && verdictOf.get(q.n) !== 'correct')
      .sort((a, b) => b.sec - a.sec || a.n - b.n)[0];
    if (best) {
      const x = Math.round((best.sec / paceSec) * 10) / 10;
      long = { kind: 'long', n: best.n, sec: Number.isFinite(view.firstAt?.get?.(best.n)) ? view.firstAt.get(best.n) : null, at: null, text: fill(M.long, { n: best.n, time: spentLabel(best.sec), x, pace: spentLabel(paceSec), result: R.reel.results[verdictOf.get(best.n) === 'skipped' ? 'blank' : 'wrong'] }) };
    }
  }
  const picked = [];
  const taken = new Set();
  for (const m of [...lost.slice(0, 2), ...(long ? [long] : []), ...won.slice(0, 1), ...lost.slice(2)]) {
    if (picked.length >= REEL_RULES.maxMoments) break;
    if (taken.has(m.n)) continue; // one pause a question
    taken.add(m.n);
    picked.push(m);
  }
  return momentsInTimeOrder(picked);
}

/**
 * reelScript({ rows, changes, view, paceSec, finding, next }) -> null | {
 *   total, durationMs, max, score, sheet: [{ n, v: 'correct'|'wrong'|'skipped' }], moments, chapter, next, frames }
 *   rows     analyseSession(attempt).rows (number, verdict 'correct'|'wrong'|'skipped', chapter, q)
 *   changes  the record's observed answerChanges
 *   view     replayView(lab.replay), or null without a trace (the sheet still plays)
 *   finding  costliestLine(...) { line, detail, chapter } or null
 *   next     the one next move { kind, label, target, href } or null
 * Frames in clock order: { t (ms), kind: 'start'|'light'|'moment'|'chapter'|'next', n, lit, marks, caption, ring }.
 * `lit` is how many questions of the sheet have lit; `marks` the running score (+5 right, -1 wrong, 0 blank); at the last
 * light frame it equals the paper's score. null when no question was answered.
 */
export function reelScript({ rows = [], changes = [], view = null, paceSec = null, finding = null, next = null } = {}) {
  const total = rows.length;
  const answered = rows.filter((r) => r.verdict !== 'skipped').length;
  if (!total || !answered) return null;
  const Rr = R.reel;
  const moments = reelMoments({ rows, changes, view, paceSec });
  const momentAt = new Map(moments.map((m) => [m.n, m]));
  const step = Math.min(REEL_RULES.stepMax, Math.max(REEL_RULES.stepMin, Math.round(REEL_RULES.walkMs / total)));
  const frames = [{ t: 0, kind: 'start', n: null, lit: 0, marks: 0, caption: null, ring: null }];
  let t = REEL_RULES.startMs;
  let marks = 0;
  rows.forEach((row, i) => {
    marks += row.verdict === 'correct' ? MARKS_RIGHT : row.verdict === 'wrong' ? MARKS_WRONG : 0;
    frames.push({ t, kind: 'light', n: row.number, lit: i + 1, marks, caption: null, ring: null });
    t += step;
    const m = momentAt.get(row.number);
    if (m) {
      frames.push({ t, kind: 'moment', n: row.number, lit: i + 1, marks, caption: { at: m.at, text: m.text }, ring: row.number });
      t += REEL_RULES.momentMs;
    }
  });
  const chapterName = finding?.chapter || null;
  const chapter = chapterName ? { name: chapterName, numbers: rows.filter((r) => r.chapter === chapterName && r.verdict !== 'correct').map((r) => r.number) } : null;
  if (finding?.line) {
    frames.push({ t, kind: 'chapter', n: null, lit: total, marks, caption: { at: null, text: finding.line, detail: finding.detail || null }, ring: null, chapter });
    t += REEL_RULES.chapterMs;
  }
  // The end keeps the chapter's sentence on screen; the next move's key sits under it.
  frames.push({ t, kind: 'next', n: null, lit: total, marks, caption: finding?.line ? { at: null, text: finding.line, detail: finding.detail || null } : { at: null, text: Rr.next }, ring: null, chapter, next: next || null });
  const sheet = rows.map((r) => ({ n: r.number, v: r.verdict }));
  return { total, durationMs: t + REEL_RULES.endMs, max: total * MARKS_RIGHT, score: marks, sheet, moments, chapter, next: next || null, frames };
}

/** The frame showing at clock t (ms): the last frame at or before it. */
export function reelFrameAt(script, t) {
  if (!script?.frames?.length) return null;
  let lo = 0;
  let hi = script.frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (script.frames[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  return script.frames[lo];
}

/** The frames a student steps through one press at a time (reduced motion): each real moment, the chapter, the next move. */
export function reelKeyFrames(script) {
  return (script?.frames || []).filter((f) => f.kind === 'moment' || f.kind === 'chapter' || f.kind === 'next');
}

/** The honest length for the title: the script's own duration to the nearest 5 seconds, never under 5 ("20 s"). */
export function reelSeconds(script) {
  return Math.max(5, Math.round((script?.durationMs || 0) / 5000) * 5);
}
