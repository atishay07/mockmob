// Revise: the student's own wrong answers come back on a schedule (feature wave F1, rules unchanged; spec
// tmp/mistake-lab-v4/SPEC.md 4.8 "Same mistakes later"). PURE: no I/O. The server (src/lib/server/revise.js) reads
// and writes; this file holds the rules, so the website and the app agree and a fixture can prove them.
//
// Boxes: a wrong or new card is in box 1, due 1 day after the wrong answer, counted in India days. A right recall moves
// it up: box 2 is due in 3 days, box 3 in 7 days, box 4 in 21 days. A wrong recall drops it back to box 1, due the next
// day. A card is done after a right recall in box 4, which means it has been recalled right four times, each at least
// the box's own interval apart (so "2 right recalls at least 3 days apart", F1's retirement floor, always holds first).
// Cap: 10 questions a day (the student can choose 5). No credits. No attempts row, no write to the student's progress,
// so Revise changes no accuracy number, no chapter number, no SWOT line and no Compass sample.
import COPY from './mistake_lab.copy.json' with { type: 'json' };
import { when } from './attempt_ledger.js';
import { fill, form } from './across_mocks.js';

export const REVISE_VERSION = 1;
const R = COPY.revise;
const L = COPY.later;

export const REVISE_RULES = Object.freeze({
  boxes: 4,
  days: Object.freeze({ 1: 1, 2: 3, 3: 7, 4: 21 }), // days until a card in this box is due again
  cap: 10, // questions a day
  capChoices: Object.freeze([5, 10]),
  seedMax: 200, // the newest wrong questions seeded into cards on a read
  secondsPerCard: 40,
  minuteStep: 5,
  href: '/review/revise',
});

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The India calendar date of a time, "2026-10-16". */
export function istDate(ms) {
  return new Date(Number(ms) + IST_OFFSET_MS).toISOString().slice(0, 10);
}
const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
/** "2026-10-16" plus n days. */
export function addDays(date, n) {
  return new Date((dayNumber(date) + n) * DAY_MS).toISOString().slice(0, 10);
}
/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
/** "Fri 16 Oct" from "2026-10-16". */
export function dayLabel(date) {
  const t = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[t.getUTCDay()]} ${t.getUTCDate()} ${COPY.months[t.getUTCMonth()]}`;
}

/** Cap from a query value: 5 or 10, else the default of 10. */
export const capFrom = (raw) => (REVISE_RULES.capChoices.includes(Number(raw)) ? Number(raw) : REVISE_RULES.cap);

/** "About 5 minutes": 40 seconds a card, rounded up to the next 5 minutes. */
export function minutesFor(count) {
  if (!(count > 0)) return 0;
  return Math.ceil((count * REVISE_RULES.secondsPerCard) / 60 / REVISE_RULES.minuteStep) * REVISE_RULES.minuteStep;
}

/**
 * The card after one recall. `card` is { box, right_total }; `correct` is the server's grade; `today` is the India date.
 * Returns the fields to store: { box, due_day, state, right_total, outcome: 'right' | 'wrong' | 'done' }.
 */
export function gradeCard(card, correct, today) {
  const box = Math.min(Math.max(Number(card?.box) || 1, 1), REVISE_RULES.boxes);
  const total = Number(card?.right_total) || 0;
  if (!correct) return { box: 1, due_day: addDays(today, REVISE_RULES.days[1]), state: 'active', right_total: total, outcome: 'wrong' };
  if (box >= REVISE_RULES.boxes) return { box, due_day: addDays(today, REVISE_RULES.days[box]), state: 'retired', right_total: total + 1, outcome: 'done' };
  return { box: box + 1, due_day: addDays(today, REVISE_RULES.days[box + 1]), state: 'active', right_total: total + 1, outcome: 'right' };
}

const byDue = (a, b) => (a.due_day < b.due_day ? -1 : a.due_day > b.due_day ? 1 : a.box - b.box || String(a.question_id).localeCompare(String(b.question_id)));

/**
 * Today's queue from the student's cards ({ question_id, box, due_day, state, last_recalled_day, right_total }).
 *   due          every active card due today or earlier
 *   answered     cards recalled today (they count against the cap, retired or not)
 *   items        the first (cap - answered) due cards, oldest due date first
 *   nextDay      the earliest later due date, or null
 */
export function todaysQueue({ cards = [], today, cap = REVISE_RULES.cap } = {}) {
  const list = Array.isArray(cards) ? cards : [];
  const due = list.filter((c) => c.state === 'active' && c.due_day <= today).sort(byDue);
  const answered = list.filter((c) => c.last_recalled_day === today).length;
  const room = Math.max(0, cap - answered);
  const later = list.filter((c) => c.state === 'active' && c.due_day > today).map((c) => c.due_day).sort();
  return { due, answered, items: due.slice(0, room), nextDay: later[0] ?? null, room };
}

/** Cards per box 1 to 4, active cards only. */
export function boxCounts(cards = []) {
  const out = [0, 0, 0, 0];
  for (const c of cards) if (c.state === 'active' && c.box >= 1 && c.box <= REVISE_RULES.boxes) out[c.box - 1] += 1;
  return out;
}

/**
 * Cards to write for the student's newest wrong questions (user_question_progress rows with last_correct false):
 * a new card in box 1 due the day after the wrong answer, or an existing card sent back to box 1 when the question was
 * answered wrong again after the card last changed. Seeding is idempotent on (user, question). `usable(qid)` is the
 * server's eligibility check: the question is live and not under re-check. The key letter in the progress row is NOT
 * compared with the question's current key letter: a Full mock or NTA paper serves shuffled options, so the letter the
 * student picked there is a position in that paper, not in the stored question, and the comparison would silently drop
 * about a quarter of the wrong answers on those papers. A key corrected later is handled at the recall instead
 * (key_hash: the card is retired, not graded).
 */
export function planSeeds({ progress = [], cards = [], usable = () => true, keyHashOf = () => null } = {}) {
  const have = new Map((Array.isArray(cards) ? cards : []).map((c) => [c.question_id, c]));
  const rows = [];
  const wrong = (Array.isArray(progress) ? progress : [])
    .filter((p) => p && p.last_correct === false && typeof p.last_selected_key === 'string' && p.last_selected_key && p.last_attempted_at)
    .sort((a, b) => Date.parse(b.last_attempted_at) - Date.parse(a.last_attempted_at))
    .slice(0, REVISE_RULES.seedMax);
  for (const p of wrong) {
    const qid = p.question_id;
    if (!usable(qid)) continue;
    const wrongAt = Date.parse(p.last_attempted_at);
    if (!Number.isFinite(wrongAt)) continue;
    const card = have.get(qid);
    if (card && !(wrongAt > Date.parse(card.updated_at))) continue; // already carded, and not answered wrong since
    rows.push({
      question_id: qid, box: 1, due_day: addDays(istDate(wrongAt), REVISE_RULES.days[1]), state: 'active',
      right_total: card ? Number(card.right_total) || 0 : 0, key_hash: keyHashOf(qid), wrong_at: new Date(wrongAt).toISOString(),
    });
  }
  return rows;
}

/** "It comes back in 3 days" or "It comes back on Sun 19 Oct", from the day a recalled card is next due. */
export function whenPhrase(dueDay, today) {
  const n = daysBetween(today, dueDay);
  return R.when.days[String(n)] ?? fill(R.when.on, { day: dayLabel(dueDay) });
}

/** The line shown after one recall. */
export function resultLine(outcome, dueDay, today) {
  if (outcome === 'done') return R.result.rightDone;
  if (outcome === 'right') return fill(R.result.right, { when: whenPhrase(dueDay, today) });
  return R.result.wrong;
}

/** "8 recalled, 2 come back tomorrow" at the end of a run. */
export function endLine({ right = 0, wrong = 0 } = {}) {
  if (right && wrong) return fill(R.end.both, { r: right, w: wrong });
  if (right) return fill(R.end.right, { r: right });
  if (wrong) return fill(R.end.wrong, { w: wrong });
  return null;
}

/**
 * The body of GET /api/me/revise, finished (items come from the server with the key left out; see
 * src/lib/server/revise.js). `cards` are all the student's cards, `items` today's questions as the server shaped them,
 * `skipped` how many due cards the server found it may not ask (a question under re-check or withdrawn).
 * `due` counts the cards due today beyond the cap too; `shown` is what the student is asked today.
 */
export function reviseBody({ cards = [], items = [], today, cap = REVISE_RULES.cap, skipped = 0 } = {}) {
  const q = todaysQueue({ cards, today, cap });
  const dueTotal = Math.max(0, q.due.length - skipped);
  const shown = items.length;
  const active = cards.filter((c) => c.state === 'active');
  const state = cards.length === 0 ? 'empty' : 'ready';
  const twice = cards.filter((c) => (Number(c.right_total) || 0) >= 2).length;
  return {
    version: REVISE_VERSION,
    state,
    today,
    cap,
    due: dueTotal,
    shown,
    answeredToday: q.answered,
    minutes: minutesFor(shown),
    boxes: boxCounts(cards),
    cards: cards.length,
    nextDay: q.nextDay,
    nextDayLabel: q.nextDay ? dayLabel(q.nextDay) : null,
    head: shown ? fill(form(R.head.due, shown), { n: shown }) : R.head.none,
    summary: cards.length ? fill(R.summary, { due: shown, cards: fill(form(R.cards, cards.length), { n: cards.length }), twice }) : null,
    next: q.nextDay ? fill(R.next, { day: dayLabel(q.nextDay) }) : active.length ? null : R.nextNone,
    labels: { title: R.title, sub: R.sub, fine: R.fine, boxes: R.boxDays },
    items,
  };
}

// ---------- "Same mistakes later" in Prove (4.8) ----------

/**
 * lab.prove.later (contract_later_v1.json, `prove`): which of this paper's wrong answers come back, and when. A wrong
 * answer counts when it is not held or re-checked (no answer review) and the student has not answered the question
 * again since. `cards` is a Map(question id -> card) of the student's existing cards, or null when they could not be
 * read: then only a paper from today or yesterday is told about (its cards are not due yet, so the day is exact), and
 * an older paper says nothing. Returns null when no answer comes back.
 */
export function buildLater({ attempt, allAttempts = [], answerReviews = {}, cards = null, now = Date.now() } = {}) {
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const doneAt = when(attempt);
  if (!questions.length || !doneAt) return null;
  const details = new Map((attempt.details || []).map((d) => [d?.qid, d]));
  const answeredLater = new Set();
  for (const other of allAttempts || []) {
    if (!other || other.id === attempt.id || when(other) <= doneAt) continue;
    for (const d of other.details || []) if (d && Number.isInteger(d.givenIndex)) answeredLater.add(d.qid);
  }
  const today = istDate(now);
  const firstDue = addDays(istDate(doneAt), REVISE_RULES.days[1]);
  const coming = [];
  for (const q of questions) {
    const d = details.get(q?.id);
    if (!d || d.isCorrect !== false || !Number.isInteger(d.givenIndex)) continue;
    if (answerReviews?.[q.id] || answeredLater.has(q.id)) continue;
    const card = cards instanceof Map ? cards.get(q.id) : null;
    if (card) { if (card.state === 'active') coming.push(card.due_day); continue; }
    if (cards === null && firstDue < today) continue; // an older paper and no cards read: nothing to say
    coming.push(firstDue);
  }
  if (!coming.length) return null;
  const nowCount = coming.filter((day) => day <= today).length;
  let whenKind;
  let count;
  let next;
  if (nowCount) { whenKind = 'now'; count = nowCount; next = today; }
  else { next = [...coming].sort()[0]; count = coming.filter((day) => day === next).length; whenKind = next === addDays(today, 1) ? 'tomorrow' : 'day'; }
  const day = dayLabel(next);
  // Revise shows at most the day's cap, so a paper with more wrong answers than that says how many come back that day and
  // that the rest follow later: the count is never more than the cap.
  const shown = Math.min(count, REVISE_RULES.cap);
  const rest = count - shown;
  const line = `${fill(form(L.line[whenKind], shown), { n: shown, day })}${rest ? ` ${fill(form(L.rest, rest), { k: rest })}` : ''}`;
  return {
    version: REVISE_VERSION,
    state: 'scheduled',
    title: L.labels.title,
    count: shown,
    total: coming.length,
    when: whenKind,
    dueDay: next,
    dayLabel: day,
    line,
    note: L.note,
    fine: L.fine,
    open: L.labels.open,
    href: REVISE_RULES.href,
  };
}
