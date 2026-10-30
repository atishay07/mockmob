// Revise as one queue (LEARN-REVIEW-1017 5.8, packet P-LR2). PURE: no I/O, no React, no clock, so the server (the merged due
// list in src/lib/server/revise.js), the run page (ReviseRun.jsx) and node --test all read one set of rules.
//
// Revise keeps everything the student has to bring back, and plays it as ONE run with one progress line:
//   1  questions   wrong answers due today          (revise_cards, mode 'question'; the same question again)
//   2  again       repaired mistakes due again      (revise_cards, mode 'again'; the same question, key hidden)
//   3  checks      a pending Check it held          (a NEW question on the rule of a repair; from the day after the repair)
//   4  cards       lesson recall cards due          (the study engine's recall run; only from lessons the student has read)
//   5  keycards    Key cards due (KEYCARDS-BUILD-SPEC.md 2e): NCERT lines on their own FSRS schedule, after everything above.
//                  They obey their own limits (data/keycards.js dueQueue and the Free allowance), never the cap below, and
//                  take 15 seconds each in the time estimate. Absent when the feature is off, so the four sources are unchanged.
//
// The rules:
//   - One card per question per day. A question due in sources 1 and 2 plays ONCE, as `again` (it was repaired, so it is
//     answered with the key hidden), with one schedule update. A Check it held is a different question, so it never collides.
//   - The daily cap (5 or 10, less what was answered today) holds sources 1 and 2. A Check it held is always included. Lesson
//     cards add at most CARD_CAP. The same numbers as `reviseDue()` in data/review_input.mjs, which Review's row and the
//     badge read, so Review, the head of the run and the badge always agree (data/tests/revise_queue.test.mjs proves it).
//   - Order: the questions and repaired mistakes oldest due first (then the lower box), then the checks, then the cards.
//   - A confirmed answer counts once per item: a second answer for the same item changes nothing (one schedule update per question).
import { REVISE_RULES, minutesFor } from '../../../data/revise.js';
import COPY from '../../../data/mistake_lab.copy.json' with { type: 'json' };

const RUN = COPY.revise.run;

export const CARD_CAP = 5;
export const SOURCES = Object.freeze(['questions', 'again', 'checks', 'cards', 'keycards']);
export const KINDS = Object.freeze(['question', 'again', 'check', 'card', 'keycard']);
/** Seconds a Key card takes (15) against a question's 40: the minutes of the Key cards part. */
export const KEYCARD_SECONDS = 15;
export const keycardMinutes = (n) => (n > 0 ? Math.ceil((n * KEYCARD_SECONDS) / 60) : 0);

const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole));
const form = (pair, n) => (n === 1 ? pair.one : pair.many);

/** The id an item is counted by: one id per question, one per Check it held, one per concept card slot. */
export const itemKey = (item) => (item.kind === 'check' ? `check:${item.attemptId}:${item.questionId}` : item.kind === 'card' ? `card:${item.slot}` : item.kind === 'keycard' ? `kc:${item.cardId}` : `q:${item.questionId}`);

const byDue = (a, b) => (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : (a.box || 1) - (b.box || 1) || String(a.questionId).localeCompare(String(b.questionId)));

/**
 * The merged queue.
 *   questions   [{ questionId, dueDay, box, ...whatTheScreenShows }]   mode-'question' cards due today
 *   again       the same shape, mode-'again' cards due today
 *   checks      [{ attemptId, questionId, number?, ... }]               pending Check it held
 *   cards       the number of lesson cards due today, or null when it could not be read (counted as none, named in `unknown`)
 *   cap         5 or 10; answered = questions already answered today (they use the cap up)
 * Returns { items, counts, total, minutes, unknown, dropped } where `items` is in play order and each carries its `kind`
 * ('question' | 'again' | 'check' | 'card'). `dropped` is the questions that did not fit under the cap (they wait for tomorrow).
 */
export function mergeQueue({ questions = [], again = [], checks = [], cards = 0, keycards = null, cap = REVISE_RULES.cap, answered = 0 } = {}) {
  const capN = REVISE_RULES.capChoices.includes(Number(cap)) ? Number(cap) : REVISE_RULES.cap;
  const room = Math.max(0, capN - (Number(answered) || 0));
  const merged = new Map();
  // `again` first: a question in both lists keeps the repaired mode and its own fields.
  for (const item of again) if (item?.questionId && !merged.has(item.questionId)) merged.set(item.questionId, { ...item, kind: 'again' });
  for (const item of questions) if (item?.questionId && !merged.has(item.questionId)) merged.set(item.questionId, { ...item, kind: 'question' });
  const back = [...merged.values()].sort(byDue);
  const shown = back.slice(0, room);
  const seen = new Set();
  const pending = [];
  for (const item of checks) {
    const key = itemKey({ ...item, kind: 'check' });
    if (!item?.attemptId || !item?.questionId || seen.has(key)) continue;
    seen.add(key);
    pending.push({ ...item, kind: 'check' });
  }
  const unknown = cards === null || cards === undefined ? ['cards'] : [];
  const cardCount = unknown.length ? 0 : Math.min(Math.max(0, Number(cards) || 0), CARD_CAP);
  const slots = Array.from({ length: cardCount }, (_, i) => ({ kind: 'card', slot: i + 1 }));
  // Key cards last, one per card id; given only when the feature is on (null keeps the four-source body exactly as before).
  const kcSeen = new Set();
  const kc = Array.isArray(keycards) ? keycards.filter((i) => i?.cardId && !kcSeen.has(i.cardId) && kcSeen.add(i.cardId)).map((i) => ({ ...i, kind: 'keycard' })) : [];
  const items = [...shown, ...pending, ...slots, ...kc];
  const counts = {
    questions: shown.filter((i) => i.kind === 'question').length,
    again: shown.filter((i) => i.kind === 'again').length,
    checks: pending.length,
    cards: cardCount,
  };
  if (Array.isArray(keycards)) counts.keycards = kc.length;
  counts.back = counts.questions + counts.again;
  const total = items.length;
  return { items, counts, total, minutes: minutesFor(total - kc.length) + keycardMinutes(kc.length), unknown, dropped: back.length - shown.length };
}

/** "8 due today, about 7 minutes." One head, nothing more. */
export function headLine(total, minutes) {
  return total > 0 ? fill(RUN.head, { n: total, m: minutes }) : RUN.headNone;
}

/** "5 questions back, 1 Check it held, 2 concept cards": the parts that exist, in play order. */
export function mixParts(counts) {
  return [
    counts.back ? { key: 'back', n: counts.back, text: fill(form(RUN.mix.back, counts.back), { n: counts.back }) } : null,
    counts.checks ? { key: 'checks', n: counts.checks, text: fill(RUN.mix.checks, { n: counts.checks }) } : null,
    counts.cards ? { key: 'cards', n: counts.cards, text: fill(form(RUN.mix.cards, counts.cards), { n: counts.cards }) } : null,
    counts.keycards ? { key: 'keycards', n: counts.keycards, text: `${counts.keycards} Key ${counts.keycards === 1 ? 'card' : 'cards'}` } : null,
  ].filter(Boolean);
}
export const mixLine = (counts) => mixParts(counts).map((p) => p.text).join(', ');

/** "{n} of {total}" for the item being played (1-based). */
export const positionLine = (at, total) => fill(RUN.position, { k: Math.min(at + 1, total), n: total });

/** What a card is, in the student's words: { title, detail } for the line above the stem. */
export function kindLine(item, { paperLabel = null } = {}) {
  if (item.kind === 'check') {
    const n = Number.isInteger(item.number) && item.number > 0 ? item.number : null;
    return { title: n ? fill(RUN.kind.check, { n }) : 'Check it held', detail: [item.paper, item.chapter].filter(Boolean).join('. ') || null };
  }
  if (item.kind === 'card') return { title: fill(RUN.kind.card, { lesson: item.lesson || 'your lessons' }), detail: null };
  if (item.kind === 'keycard') return { title: 'Key card', detail: null };
  const title = item.kind === 'again' ? RUN.kind.again : RUN.kind.question;
  const source = paperLabel || item.source || null;
  return { title, detail: [source, item.chapter].filter(Boolean).join('. ') || null };
}

/** The line under the options: free, and when a right answer sends the card back (the box it moves to). */
export function footLine(item, whenPhrase = null) {
  if (item.kind === 'check') return `${RUN.foot} ${RUN.footCheck}`;
  if ((item.box || 1) >= REVISE_RULES.boxes) return `${RUN.foot} ${RUN.footBackDone}`;
  return whenPhrase ? `${RUN.foot} ${fill(RUN.footBack, { when: whenPhrase })}` : RUN.foot;
}

/** The "in 3 days" the next right answer earns, from the card's box (null for a card that would finish). */
export function nextWhen(box) {
  const next = Math.min(Math.max(Number(box) || 1, 1), REVISE_RULES.boxes) + 1;
  const days = REVISE_RULES.days[next];
  return days ? `in ${days} days` : null;
}

/** Only one source (`?source=cards|again|questions|checks`), or everything. An unknown source is everything.
 *  `cards` plays everything a recall run holds (due plus new cards of lessons already read, at most 10): Today's "Lock in new cards". */
export function filterSource(queue, source) {
  if (source === 'cards' && Number.isFinite(queue.cardsAvailable) && queue.cardsAvailable > queue.counts.cards) {
    const slots = Array.from({ length: Math.min(queue.cardsAvailable, 10) }, (_, i) => ({ kind: 'card', slot: i + 1 }));
    return filterSource({ ...queue, items: [...queue.items.filter((i) => i.kind !== 'card'), ...slots], cardsAvailable: null }, 'cards');
  }
  const wanted = { cards: ['card'], again: ['again'], questions: ['question'], checks: ['check'], keycards: ['keycard'] }[source];
  if (!wanted) return queue;
  const items = queue.items.filter((i) => wanted.includes(i.kind));
  const counts = {
    questions: items.filter((i) => i.kind === 'question').length, again: items.filter((i) => i.kind === 'again').length,
    checks: items.filter((i) => i.kind === 'check').length, cards: items.filter((i) => i.kind === 'card').length,
  };
  const kcN = items.filter((i) => i.kind === 'keycard').length;
  if ('keycards' in (queue.counts || {})) counts.keycards = kcN;
  counts.back = counts.questions + counts.again;
  return { ...queue, items, counts, total: items.length, minutes: minutesFor(items.length - kcN) + keycardMinutes(kcN), filtered: source };
}

// ---------------------------------------------------------------- the run: one answer per item

export const startRun = (items) => ({ items, answers: {}, at: 0 });

/**
 * A confirmed answer (the server acknowledged it). `result` is { correct, retired?, outcome? }. The second answer for the same
 * item is ignored, so one item makes one schedule update however many times the screen reports it. Returns the same state
 * object when nothing changed.
 */
export function recordAnswer(state, item, result) {
  const key = itemKey(item);
  if (state.answers[key]) return state;
  return { ...state, answers: { ...state.answers, [key]: { kind: item.kind, correct: result?.correct === true, retired: result?.retired === true } } };
}

/** Leave an item for today without an answer (a Check it held with no new question ready): it stays due, so it is not counted as answered. */
export function skipItem(state, item) {
  const key = itemKey(item);
  return state.answers[key] ? state : { ...state, answers: { ...state.answers, [key]: { kind: item.kind, skipped: true } } };
}

export const advance = (state) => ({ ...state, at: Math.min(state.at + 1, state.items.length) });
/** Items the server confirmed an answer for (a skipped item is still due). */
export const answeredCount = (state) => Object.values(state.answers).filter((a) => !a.skipped).length;
export const remaining = (state) => state.items.length - answeredCount(state);
export const isFinished = (state) => state.items.length > 0 && state.at >= state.items.length;

/** What the end of the run says: questions and repaired mistakes recalled or coming back, the checks, the cards. */
export function summary(state) {
  const list = Object.values(state.answers).filter((a) => !a.skipped);
  const back = list.filter((a) => a.kind === 'question' || a.kind === 'again');
  const checks = list.filter((a) => a.kind === 'check');
  const cards = list.filter((a) => a.kind === 'card');
  const keycards = list.filter((a) => a.kind === 'keycard');
  return {
    recalled: back.filter((a) => a.correct).length, comeBack: back.filter((a) => !a.correct).length,
    held: checks.filter((a) => a.correct).length, slipped: checks.filter((a) => !a.correct).length,
    cards: cards.length, ...(keycards.length ? { keycards: keycards.length } : {}), answered: list.length,
  };
}
