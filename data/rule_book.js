// The Rule book, the rule for the next mock, its check and the start sheet line (spec tmp/mistake-lab-v4/SPEC.md 4.8,
// 4.10, 4.12). PURE, free, no model, no I/O: the server reads the repairs and the playbook rows and passes them in.
//
// Two kinds of rule, one list:
//   repair  each committed repair's rule and memory hook (its receipt), grouped by chapter, newest first
//   habit   the four paper habits, worded exactly as the ledger's do lines, each with one evidence line, a Wilson
//           interval behind it and its gate (3 timed mocks, plus a minimum count)
// "Use in my next mock" keeps one rule in force per student (recovery_playbook rows, strategy `rule:<id>`, the rule's
// words in `reflection`). The rule in force for a mock is the newest row chosen before that mock started; after the
// mock, Prove shows the arithmetic only: kept or not kept, with the timed mock before it for comparison. Never "the
// rule gained you X", never a forecast, behaviour words only.
import COPY from './mistake_lab.copy.json' with { type: 'json' };
import { wilson } from './prepos_insights.js';
import { isMock, when, chapterOf } from './attempt_ledger.js';
import {
  ACROSS_RULES, fill, form, countList, subjectName, mockRecord, timedMocks,
  changeCounts, neverOpenedOf, answersByTime, markedCounts,
} from './across_mocks.js';
import { signedMarks } from './time_decisions.js';
import { GAP } from './session_recovery.js';

export const RULE_BOOK_VERSION = 1;
const R = COPY.rules;
const C = COPY.ruleCheck;
const S = COPY.startSheet;

export const RULE_RULES = Object.freeze({
  habitMocks: 3, // rules from how you take papers need 3 timed mocks
  changesMin: 10, // habit 1's evidence needs 10 changes
  longMin: 8, // habit 2's needs 8 answers after 2 minutes
  markedMin: 15, // habit 4's needs 15 marked answers
  neverOpenedMocks: 3, // habit 3 reads the last 3 timed mocks
  longMs: ACROSS_RULES.longMs,
  habitOrder: Object.freeze(['changes', 'long_stay', 'never_opened', 'marked']),
  strategyPrefix: 'rule:', // recovery_playbook.strategy of a rule row
  maxText: 1000, // recovery_playbook.reflection holds the rule's words (the old note's own limit)
});

/** The four habit rules' words: the ledger's own do lines, so a student meets one sentence per habit everywhere. */
export const HABIT_TEXT = Object.freeze({
  changes: COPY.groups.changed_from_right.do,
  long_stay: COPY.groups.long_stay.do,
  never_opened: COPY.groups.never_opened.do,
  marked: R.marked,
});

const REPAIR_ID = /^repair:[0-9a-f]{24}$/;
/** { kind, key } for a valid rule id ("habit:never_opened", "repair:<24 hex>"), else null. */
export function parseRuleId(id) {
  if (typeof id !== 'string' || id.length > 64) return null;
  const habit = /^habit:([a-z_]+)$/.exec(id);
  if (habit && RULE_RULES.habitOrder.includes(habit[1])) return { kind: 'habit', key: habit[1] };
  if (REPAIR_ID.test(id)) return { kind: 'repair', key: id.slice('repair:'.length) };
  return null;
}
export const strategyFor = (ruleId) => `${RULE_RULES.strategyPrefix}${ruleId}`;
export const ruleIdOfStrategy = (strategy) => (typeof strategy === 'string' && strategy.startsWith(RULE_RULES.strategyPrefix) ? strategy.slice(RULE_RULES.strategyPrefix.length) : null);
const iso = (v) => { const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const interval = (k, n) => { const w = wilson(k, n); return { k, n, pct: w.pct, low: w.low, high: w.high }; };
/** "Open every question ..." -> "open every question ..." for the habit rules' own sentences; a repair's words are kept as written. */
const inLine = (rule) => (rule.kind === 'habit' ? rule.text.charAt(0).toLowerCase() + rule.text.slice(1) : rule.text);

// ---------- The rule in force (recovery_playbook rows) ----------

/** The playbook's rule rows, newest first: { id, kind, text, since, attemptId }. Rows of the old free-text note are left out. */
export function ruleRows(rows) {
  return (rows || []).map((row) => {
    const id = ruleIdOfStrategy(row?.strategy);
    const parsed = parseRuleId(id);
    const since = iso(row?.created_at);
    if (!parsed || !since || typeof row.reflection !== 'string' || !row.reflection.trim()) return null;
    return { id, kind: parsed.kind, text: row.reflection.trim(), since, attemptId: row.attempt_id ?? null };
  }).filter(Boolean).sort((a, b) => (a.since < b.since ? 1 : a.since > b.since ? -1 : 0));
}
/** The active rule: the newest one chosen (each choice retires the one before). */
export function activeRule(rows) {
  const r = ruleRows(rows)[0];
  return r ? { id: r.id, kind: r.kind, text: r.text, since: r.since } : null;
}
/** When a mock started on the paper clock: its completion less the length of its record (or of its time limit). */
export function attemptStart(attempt) {
  const done = when(attempt);
  const rec = mockRecord(attempt);
  if (rec && rec.lengthMs > 0) return done - rec.lengthMs;
  const minutes = attempt?.selectionMeta?.durationMinutes;
  return Number.isFinite(minutes) && minutes > 0 ? done - minutes * 60000 : done;
}
/** The rule in force when this mock started: the newest rule row chosen before then, or null. */
export function ruleInForce(rows, attempt) {
  const start = attemptStart(attempt);
  const r = ruleRows(rows).find((x) => Date.parse(x.since) < start);
  return r ? { id: r.id, kind: r.kind, text: r.text, since: r.since } : null;
}

// ---------- The Rule book ----------

function repairSection(repairs, activeId) {
  const seen = new Set();
  const list = (repairs || []).filter((r) => r && typeof r.id === 'string' && /^[0-9a-f]{24}$/.test(r.id) && typeof r.rule === 'string' && r.rule.trim())
    .sort((a, b) => (String(a.repairedAt) < String(b.repairedAt) ? 1 : String(a.repairedAt) > String(b.repairedAt) ? -1 : 0))
    .filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
  const chapters = [];
  const byChapter = new Map();
  for (const r of list) {
    const chapter = r.chapter || chapterOf({});
    let group = byChapter.get(chapter);
    if (!group) { group = { chapter, rules: [], texts: new Set() }; byChapter.set(chapter, group); chapters.push(group); }
    const text = r.rule.trim();
    const same = text.toLowerCase().replace(/\s+/g, ' ');
    if (group.texts.has(same)) continue; // the same rule twice in a chapter: the newest stays
    group.texts.add(same);
    const id = `repair:${r.id}`;
    group.rules.push({
      id, kind: 'repair', text, hook: typeof r.hook === 'string' && r.hook.trim() ? r.hook.trim() : null,
      number: Number.isInteger(r.number) ? r.number : null, subject: r.subject ?? null, repairedAt: iso(r.repairedAt), active: id === activeId,
    });
  }
  return { empty: chapters.length ? null : R.repairsEmpty, chapters: chapters.map(({ chapter, rules }) => ({ chapter, rules })) };
}

function habitRules(mocks, activeId) {
  const mocksPhrase = fill(form(COPY.across.mocks, mocks.length), { n: mocks.length });
  const rule = (key, evidence, gated, iv) => ({ id: `habit:${key}`, kind: 'habit', text: HABIT_TEXT[key], evidence, gated, interval: gated ? null : iv, active: `habit:${key}` === activeId });

  const c = changeCounts(mocks);
  const changes = c.total < RULE_RULES.changesMin
    ? rule('changes', fill(R.evidence.changesGate, { n: c.total }), true, null)
    : rule('changes', c.toWrong ? fill(R.evidence.changes, { mocks: mocksPhrase, k: c.toWrong, n: c.total, marks: c.toWrong * GAP.wrong }) : fill(R.evidence.changesNone, { mocks: mocksPhrase, n: c.total }), false, interval(c.toWrong, c.total));

  const { slow, fast } = answersByTime(mocks);
  const long = slow.n < RULE_RULES.longMin
    ? rule('long_stay', fill(R.evidence.longStayGate, { n: slow.n }), true, null)
    : rule('long_stay', fill(R.evidence.longStay, { a: slow.right, b: slow.n, c: fast.right, d: fast.n }), false, interval(slow.right, slow.n));

  const recent = mocks.slice(0, RULE_RULES.neverOpenedMocks).reverse(); // oldest first
  const items = recent.map((m) => ({ n: neverOpenedOf(m), total: m.total }));
  const never = rule('never_opened', fill(R.evidence.neverOpened, { list: countList(items), k: recent.length }), false,
    interval(items.reduce((s, x) => s + x.n, 0), items.reduce((s, x) => s + x.total, 0)));

  const m = markedCounts(mocks);
  const marked = m.answered < RULE_RULES.markedMin
    ? rule('marked', fill(R.evidence.markedGate, { n: m.answered }), true, null)
    : rule('marked', fill(R.evidence.marked, { r: m.right, n: m.answered, marks: signedMarks(m.marks) }), false, interval(m.right, m.answered));

  return [changes, long, never, marked];
}

/**
 * buildRuleBook({ attempts, repairs, playbook, asOf }) -> the Rule book contract (v1):
 * data/tests/fixtures/mistake_lab/contract_rules_v1.json `book`.
 *   repairs   [{ id (24 hex), attemptId, questionId, number, chapter, subject, repairedAt, rule, hook }] (the server
 *             reads them from committed repair receipts)
 *   playbook  recovery_playbook rows ({ strategy, reflection, created_at, attempt_id })
 */
export function buildRuleBook({ attempts = [], repairs = [], playbook = [], asOf = Infinity } = {}) {
  const active = activeRule(playbook);
  const activeId = active?.id ?? null;
  const mocks = timedMocks(attempts, { asOf });
  const repairsPart = repairSection(repairs, activeId);
  const habitsReady = mocks.length >= RULE_RULES.habitMocks;
  const habits = habitsReady
    ? { state: 'ready', gateLine: null, rules: habitRules(mocks, activeId) }
    : { state: 'below_gate', gateLine: fill(R.habitsGate, { n: mocks.length }), rules: [] };
  const count = repairsPart.chapters.reduce((s, ch) => s + ch.rules.length, 0) + habits.rules.length;
  return {
    version: RULE_BOOK_VERSION,
    title: R.title,
    count,
    countLabel: fill(R.countLabel, { n: count }),
    labels: { ...R.labels },
    active,
    repairs: repairsPart,
    habits,
    basis: mocks.length ? fill(form(COPY.across.basis, mocks.length), { n: mocks.length }) : null,
  };
}

/** The Lab's short form: { count, countLabel, active }. */
export const ruleSummary = (book) => (book ? { count: book.count, countLabel: book.countLabel, active: book.active } : null);

/** Every rule in the book a student can choose, flat: the server checks a choice against this. */
export function bookRules(book) {
  return [...(book?.repairs?.chapters || []).flatMap((ch) => ch.rules.map((r) => ({ ...r, chapter: ch.chapter }))), ...(book?.habits?.rules || [])];
}
/** The rule a POST may set, or null: it must be in the student's own book right now. */
export function choosableRule(book, ruleId) {
  if (!parseRuleId(ruleId)) return null;
  const r = bookRules(book).find((x) => x.id === ruleId);
  return r && typeof r.text === 'string' && r.text.length <= RULE_RULES.maxText ? r : null;
}

// ---------- The rule check (4.8) and the start sheet line (4.12) ----------

/** One habit measured on one mock record: { n, total } (n = times the rule was not kept), or null when it cannot be read. */
export function measureHabit(key, rec) {
  if (!rec) return null;
  if (key === 'never_opened') return { n: neverOpenedOf(rec), total: rec.total };
  if (key === 'changes') { const c = changeCounts([rec]); return { n: c.toWrong, total: c.total }; }
  if (key === 'long_stay') return { n: rec.rows.filter((r) => r.longestVisitMs >= RULE_RULES.longMs).length, total: rec.total };
  if (key === 'marked') {
    if (!rec.captured) return null;
    const marked = rec.rows.filter((r) => r.marked);
    return { n: marked.filter((r) => r.given === null).length, total: marked.length };
  }
  return null;
}
/** One chapter's answers in one attempt: { r, n } (right of all its questions). */
function chapterCount(attempt, chapter) {
  const details = new Map((attempt?.details || []).map((d) => [d.qid, d]));
  const qs = (attempt?.questionsSnapshot || []).filter((q) => chapterOf(q) === chapter);
  return { r: qs.filter((q) => details.get(q.id)?.isCorrect === true).length, n: qs.length };
}
/** The timed mock before this one (same subject for a repair rule), as a record, or null. */
function previousMock(attempt, attempts, subject = null) {
  return timedMocks(attempts, { before: when(attempt), window: 1, subject })[0] || null;
}
const previousTimedAttempt = (attempt, attempts, subject) => (attempts || [])
  .filter((a) => a && a.id !== attempt.id && isMock(a) && when(a) < when(attempt) && a.subject === subject)
  .sort((a, b) => when(b) - when(a))[0] || null;

function checkPayload(rule, state, result, numbers, fine) {
  const line = fill(C.line, { rule: inLine(rule) });
  return {
    version: RULE_BOOK_VERSION, state, rule: { id: rule.id, kind: rule.kind, text: rule.text },
    title: C.title, line, result, text: `${line} ${result}`, numbers, fine,
  };
}

/**
 * The rule check on one mock (lab.prove.ruleCheck): contract_rulecheck_v1.json. `rule` is the rule in force when the
 * mock started (ruleInForce), with `chapter` and `subject` for a repair rule (from the Rule book), or null. Returns
 * null when no rule was in force or the paper is not a mock. States:
 *   kept / not_kept  a habit rule, measured on this mock's record, with the timed mock before it in brackets
 *   counted          a repair rule (its chapter's answers, right of all), or the marked rule with nothing marked
 *   not_checked      the record cannot answer it (no device record, no marks captured, the repair is gone)
 */
export function buildRuleCheck({ attempt, attempts = [], rule = null } = {}) {
  if (!rule || !attempt || !isMock(attempt)) return null;
  const parsed = parseRuleId(rule.id);
  if (!parsed) return null;
  const sentence = (result, last) => (last ? fill(C.withLast, { result, last }) : fill(C.alone, { result }));

  if (parsed.kind === 'repair') {
    if (!rule.chapter) return checkPayload(rule, 'not_checked', C.noRepair, null, null);
    const now = attempt.subject === rule.subject || !rule.subject ? chapterCount(attempt, rule.chapter) : { r: 0, n: 0 };
    const prevAttempt = previousTimedAttempt(attempt, attempts, attempt.subject);
    const prev = prevAttempt ? chapterCount(prevAttempt, rule.chapter) : null;
    const result = now.n ? fill(C.repair.count, { chapter: rule.chapter, r: now.r, n: now.n }) : fill(C.repair.none, { chapter: rule.chapter });
    const last = prev ? (prev.n ? fill(C.repair.last, { r: prev.r, n: prev.n }) : C.repair.lastNone) : null;
    return checkPayload(rule, 'counted', sentence(result, last), { now: now.r, total: now.n, last: prev ? prev.r : null, lastTotal: prev ? prev.n : null }, prevAttempt ? C.fineRepair : C.fineRepairNoLast);
  }

  const key = parsed.key;
  const rec = mockRecord(attempt);
  if (!rec) return checkPayload(rule, 'not_checked', C.noRecord, null, null);
  const now = measureHabit(key, rec);
  if (!now) return checkPayload(rule, 'not_checked', C.noMarks, null, null);
  const H = C.habits[key];
  const prevRec = previousMock(attempt, attempts);
  const prev = measureHabit(key, prevRec);
  if (key === 'marked' && now.total === 0) {
    const last = prev ? (prev.total ? fill(H.lastKept, { n: prev.n, total: prev.total }) : H.lastNone) : null;
    return checkPayload(rule, 'counted', sentence(H.none, last), { now: 0, total: 0, last: prev?.n ?? null, lastTotal: prev?.total ?? null }, prevRec && prev ? C.fine : C.fineNoLast);
  }
  const kept = now.n === 0;
  const result = kept ? H.kept : fill(H.notKept, now);
  let last = null;
  if (prev) {
    if (key === 'changes' && prev.total === 0) last = H.lastNone;
    else if (key === 'marked' && prev.total === 0) last = H.lastNone;
    else last = fill(kept ? H.lastKept : H.lastNotKept, prev);
  }
  return checkPayload(rule, kept ? 'kept' : 'not_kept', sentence(result, last), { now: now.n, total: now.total, last: prev?.n ?? null, lastTotal: prev?.total ?? null }, prev ? C.fine : C.fineNoLast);
}

/**
 * The two strings for MockMob's own sheet before the clock starts (4.12): { rule, last } or null with no rule.
 * `last` comes from the student's newest timed mock (for a repair rule, the newest in its subject) and is null when
 * there is none or its record cannot say. `subject` (the paper about to start) leaves out a repair rule of another
 * subject. Nothing here is shown inside a timed paper.
 */
export function startSheetLines({ rule, attempts = [], subject = null } = {}) {
  if (!rule) return null;
  const parsed = parseRuleId(rule.id);
  if (!parsed) return null;
  if (parsed.kind === 'repair' && subject && rule.subject && rule.subject !== subject) return null;
  const line = fill(S.rule, { rule: inLine(rule) });
  let last = null;
  if (parsed.kind === 'repair') {
    const prev = rule.chapter && rule.subject ? (attempts || []).filter((a) => a && isMock(a) && a.subject === rule.subject).sort((a, b) => when(b) - when(a))[0] : null;
    const c = prev ? chapterCount(prev, rule.chapter) : null;
    if (c && c.n) last = fill(S.last.repair, { subject: subjectName(rule.subject), chapter: rule.chapter, r: c.r, n: c.n });
  } else {
    const rec = timedMocks(attempts, { window: 1 })[0] || null;
    const m = measureHabit(parsed.key, rec);
    const L = S.last;
    if (m) {
      const k = parsed.key;
      if (k === 'changes') last = m.total === 0 ? L.changesZero : m.n === 0 ? fill(L.changesNone, m) : fill(L.changes, m);
      else if (k === 'marked') last = m.total === 0 ? L.markedZero : m.n === 0 ? L.markedNone : fill(L.marked, m);
      else last = m.n === 0 ? L[`${k}None`] : fill(L[k], m);
    }
  }
  return { rule: line, last };
}
