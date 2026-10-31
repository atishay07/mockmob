// Learn v2: the session composer (docs/brain/learn-1031/design/B-chapters.md section 4, DESIGN-SPEC.md A1, A3 and A9, with
// BUILD-1101 Part 1: 1.2, 1.4, 1.5, R11 and R15).
// PURE: no I/O and no clock of its own. The service (src/lib/server/learn.js) hands it the chapter's cards, the student's card
// states, the chapter's questions (no answer keys needed), the open mistakes and the lesson; it answers with the run's items in
// order and the piles of the chapter page's dry run.
//
// The recipe:
//   budget        minutes x 60 / 1.1 (the 10 percent is reading the feedback)
//   seconds       per item (data/learn/seconds.js): cards new 18, due 12, look 10, recap 10, +8 for a long card; questions
//                 easy 50, medium 65, hard 90, +20 for a long stem; an open mistake 60; a lesson its own minutes.
//                 Every item carries `seconds`.
//   split         a run aims 45 percent cards; a feed 35 percent cards with the questions taking the leftover first; time one
//                 side cannot use flows to the other
//   fill          to the nearest item: one more item when at least half of it fits (BUILD 1.5)
//   fill order    lesson (R11), open mistakes (1 at 5 min, 2 at 10, 3 at 20; all the question side holds when Questions is
//                 left out), due cards (Must-know first), new cards (Must-know first, at most 40; at most 4 per 10 minutes
//                 past 40 overdue, R15), questions linked to cards in this run (one per card, unseen first), other chapter
//                 questions (unseen first, easy 40, medium 40, hard 20)
//   the feed      (BUILD 1.2) never a due card: open cards the student does not hold yet, the ones not shown in the last 3
//                 days first (Must-know first, then book order), then the recently shown ones (oldest shown first); when
//                 those run out, held cards that are not due join as looks
//   order (R3)    question slots first, spread evenly; the cards around them (a linked question's card 4 before its slot);
//                 the last item is the easiest plain question; a long mistake plays second-last; repair passes
//   honest        shrink only when the chapter has no more (reason pool | cap | mistakes)
//   Free          only the chapter's open taste cards; past today's ratings they are looks; questions are free
//   recap         Must-know cards only, answers showing, nothing scheduled
import { SECONDS, cardSeconds, cardWords, questionSeconds } from './seconds.js';

export const LEARN_RULES = Object.freeze({
  feedback: 1.1,
  // Typical seconds of a kind (the per-item rule is data/learn/seconds.js; these are kept for older importers).
  cardSeconds: SECONDS.card.new,
  recapSeconds: SECONDS.card.recap,
  questionSeconds: SECONDS.question.medium,
  cardShare: 0.45,
  feedCardShare: 0.35,
  restDays: 3, // a card shown in a feed rests 3 days behind the cards not shown
  maxNewCards: 40,
  overduePauseNew: 40, // past this many overdue Key cards, new cards are capped (R15)
  newPerTenOverdue: 4, // ... at 4 per 10 minutes
  questionsPerBlock: 20, // no more than 20 questions in one 20-minute block
  blockMinutes: 20,
  lessonFromMinutes: 20,
  levelQuestions: 6,
  maxCardIds: 100,
  longStemWords: 60, // a question stem over this many words is long (E3)
  lateFrom: 5, // a long mistake never plays before this item (1-based)
});

export const PILE_IDS = Object.freeze(['cards', 'questions', 'mistakes', 'lesson']);
export const PILE_LABELS = Object.freeze({ cards: 'Key cards', questions: 'Questions', mistakes: 'Your mistakes', lesson: 'Lesson' });
export const RUN_KINDS = Object.freeze(['mix', 'cards', 'recap', 'feed', 'level']);
export const SHRINK_REASONS = Object.freeze(['pool', 'cap', 'mistakes']);
export const NOTE = 'Ratings join Revise. Questions are free.';
export const NOTE_FIRST = 'Ratings join Revise, so cards come back when they are due.';
export const RATINGS_USED = "Today's 10 free card ratings are used. Your cards show without ratings; questions are free.";

const DAY = 86_400_000;
const DIFFICULTY_RANK = Object.freeze({ easy: 0, medium: 1, hard: 2 });
const diffRank = (q) => DIFFICULTY_RANK[q?.difficulty] ?? 3;
/** True when a question's stem is long (its `words`, counted by the caller from the stem). */
export const isLong = (q) => Number(q?.words) > LEARN_RULES.longStemWords;
const longRank = (q) => (isLong(q) ? 1 : 0);
const time = (v) => { const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));
const mustFirst = (a, b) => (a.importance === 'must' ? 0 : 1) - (b.importance === 'must' ? 0 : 1);
const stateOf = (states, id) => (states instanceof Map ? states.get(id) : states?.[id]) || null;
const shownOf = (shownAt, id) => (shownAt instanceof Map ? shownAt.get(id) : shownAt?.[id]) ?? null;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Usable seconds of a length: minutes x 60 / 1.1. */
export const budgetSeconds = (minutes) => (Math.max(0, Number(minutes) || 0) * 60) / LEARN_RULES.feedback;
/** The one minutes function of Learn (R9.5): seconds of items with the 10 percent, rounded, at least 1 when there is anything. */
export const minutesFor = (seconds) => (seconds > 0 ? Math.max(1, Math.round((seconds * LEARN_RULES.feedback) / 60)) : 0);
/** Open mistakes a mixed run retries: 1 under 10 minutes, 2 under 20, 3 from 20. */
export const mistakesFor = (minutes) => (minutes >= 20 ? 3 : minutes >= 10 ? 2 : 1);
/** "Start 10 minutes", "Start 1 minute". */
export const startLabel = (minutes) => `Start ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
/** "about 4 min" (a lesson's own minutes are exact: "7 min"). */
export const pileMinutesLabel = (id, minutes) => (id === 'lesson' ? `${minutes} min` : `about ${minutes} min`);
/** New cards a run may take while more than 40 Key cards are overdue (R15): 4 per 10 minutes, at least 1. */
export const overdueNewCap = (minutes) => Math.max(1, Math.round((Number(minutes) || 0) * (LEARN_RULES.newPerTenOverdue / 10)));
/** A lesson's seconds in a run: its minutes are exact, so its seconds carry the 10 percent already (minutesFor gives them back). */
export const lessonSeconds = (minutes) => Math.round(((Number(minutes) || 0) * 60) / LEARN_RULES.feedback);

/** A card's stage for this student now: 'due' (reviewed, due), 'new' (never reviewed), or 'later' (reviewed, not due yet). */
export function cardStage(state, now) {
  if (!state || state.suspended === true) return state?.suspended ? 'suspended' : 'new';
  if (!(Number(state.reps) > 0)) return 'new';
  return time(state.due_at) <= time(now) ? 'due' : 'later';
}

/** The chapter's card pools: due (Must-know first, then oldest due) and new (Must-know first, then book order). */
export function cardPools(cards, states, now) {
  const due = [];
  const fresh = [];
  for (const card of cards || []) {
    if (!card?.id || card.locked) continue;
    const st = stateOf(states, card.id);
    const stage = cardStage(st, now);
    if (stage === 'due') due.push({ card, state: st });
    else if (stage === 'new') fresh.push({ card, state: st });
  }
  due.sort((a, b) => mustFirst(a.card, b.card) || time(a.state.due_at) - time(b.state.due_at) || bookOrder(a.card, b.card));
  fresh.sort((a, b) => mustFirst(a.card, b.card) || bookOrder(a.card, b.card));
  return { due, fresh };
}

/**
 * The feed's card pools (BUILD-1101 1.2, A5 R1). Never a due card.
 *   fresh   open cards the student does not hold (no key_card_states row): the ones not shown in the last 3 days first
 *           (Must-know first, then book order), then the recently shown ones, oldest shown first
 *   held    cards in Revise that are not due (reviewed, due later), in the same rest order: they join only as looks, when the
 *           fresh cards run out
 * shownAt: Map(cardId -> ms) of the student's feed showings in the last 3 days.
 */
export function feedCardPool(cards, states, shownAt, now) {
  const t = time(now);
  const rested = (c) => { const at = shownOf(shownAt, c.id); return at === null || t - at >= LEARN_RULES.restDays * DAY; };
  const byRest = (list) => [
    ...list.filter((x) => rested(x.card)).sort((a, b) => mustFirst(a.card, b.card) || bookOrder(a.card, b.card)),
    ...list.filter((x) => !rested(x.card)).sort((a, b) => shownOf(shownAt, a.card.id) - shownOf(shownAt, b.card.id) || bookOrder(a.card, b.card)),
  ];
  const fresh = [];
  const held = [];
  for (const card of cards || []) {
    if (!card?.id || card.locked) continue;
    const st = stateOf(states, card.id);
    if (!st) { fresh.push({ card, state: null }); continue; }
    if (st.suspended || !(Number(st.reps) > 0)) continue;
    if (time(st.due_at) > t) held.push({ card, state: st });
  }
  return { fresh: byRest(fresh), held: byRest(held) };
}

/** Normalise leaveOut to the known piles, and keep at least one available pile in (the first in pile order). */
export function effectiveLeaveOut(leaveOut, available) {
  const asked = [...new Set((Array.isArray(leaveOut) ? leaveOut : []).filter((p) => PILE_IDS.includes(p)))];
  const open = PILE_IDS.filter((p) => available[p]);
  if (open.length && open.every((p) => asked.includes(p))) {
    const keep = open[0];
    return { leaveOut: asked.filter((p) => p !== keep), kept: keep };
  }
  return { leaveOut: asked, kept: null };
}

/** Pick `n` questions: unseen first, then easy 40, medium 40, hard 20 percent, the rest from what is left. */
export function pickQuestions(pool, n) {
  if (n <= 0 || !pool.length) return [];
  const sorted = [...pool].sort((a, b) => (a.seen ? 1 : 0) - (b.seen ? 1 : 0) || diffRank(a) - diffRank(b) || longRank(a) - longRank(b) || String(a.id).localeCompare(String(b.id)));
  const unseen = sorted.filter((q) => !q.seen);
  const seen = sorted.filter((q) => q.seen);
  const out = [];
  const take = (list, k) => { for (const q of list) { if (k <= 0) break; if (!out.includes(q)) { out.push(q); k -= 1; } } };
  for (const group of [unseen, seen]) {
    const room = n - out.length;
    if (room <= 0) break;
    const easy = Math.round(room * 0.4);
    const medium = Math.round(room * 0.4);
    const hard = room - easy - medium;
    take(group.filter((q) => q.difficulty === 'easy'), easy);
    take(group.filter((q) => q.difficulty === 'medium'), medium);
    take(group.filter((q) => q.difficulty === 'hard'), hard);
    take(group, n - out.length);
  }
  return out.slice(0, n);
}

// ---------------------------------------------------------------- the order on screen (A3, R3)

/**
 * Problems with an item order, [] when it keeps every A3 rule. Items: { type: 'card', cardId } | { type: 'question',
 * questionId, origin, links: [cardIds] } | { type: 'lesson' }.
 *   first     the first item after a lesson is a card
 *   mistake   an open mistake comes before every card of this run it links to
 *   linked    a linked question sits 3 to 6 items after its latest linked card before it
 *   last      the last item is a question when the run has a non-mistake question
 */
export function orderProblems(items) {
  const problems = [];
  const list = items || [];
  const start = list[0]?.type === 'lesson' ? 1 : 0;
  if (list.length > start && list[start].type !== 'card' && list.some((x) => x.type === 'card')) problems.push({ rule: 'first', at: start });
  const cardAt = new Map();
  list.forEach((x, i) => { if (x.type === 'card' && !cardAt.has(x.cardId)) cardAt.set(x.cardId, i); });
  list.forEach((x, i) => {
    if (x.type !== 'question') return;
    const links = (x.links || []).filter((id) => cardAt.has(id));
    if (x.origin === 'mistake') {
      if (links.some((id) => cardAt.get(id) < i)) problems.push({ rule: 'mistake', at: i });
      return;
    }
    if (x.origin === 'linked') {
      const before = links.map((id) => cardAt.get(id)).filter((j) => j < i);
      if (!before.length) { problems.push({ rule: 'linked', at: i, gap: null }); return; }
      const gap = i - Math.max(...before);
      if (gap < 3 || gap > 6) problems.push({ rule: 'linked', at: i, gap });
    }
  });
  const hasPlain = list.some((x) => x.type === 'question' && x.origin !== 'mistake');
  if (hasPlain && list[list.length - 1]?.type !== 'question') problems.push({ rule: 'last', at: list.length - 1 });
  return problems;
}

/** The rhythm of an order: questions back to back while cards remain after them, and the longest run of cards. */
export function rhythm(items) {
  const list = (items || []).filter((x) => x.type !== 'lesson');
  let backToBack = 0;
  let streak = 0;
  let longest = 0;
  list.forEach((x, i) => {
    if (x.type === 'card') { streak += 1; longest = Math.max(longest, streak); return; }
    streak = 0;
    if (i > 0 && list[i - 1].type === 'question' && list.slice(i + 1).some((y) => y.type === 'card')) backToBack += 1;
  });
  return { backToBack, longestCards: longest };
}

/** The repair score of an order (R3): A3 problems x 100 + back-to-back questions x 10 + the longest card streak. */
export const orderScore = (items) => { const r = rhythm(items); return orderProblems(items).length * 100 + r.backToBack * 10 + r.longestCards; };

/**
 * Lay out one order (R3): question slots first, spread evenly through the run; the tail (long mistakes, then the final
 * question) closes it; each linked question's card goes 4 before its slot (else 3, 5, 6), never at or before a mistake that
 * links to it; the other cards fill the gaps in display order (the order `cards` arrive in).
 */
function layout(cards, mid, tail, lead = 1) {
  const C = cards.length;
  const T = tail.length;
  const N = C + mid.length + T;
  const M = mid.length;
  const at = new Array(N).fill(null);
  // Cards are dealt into the gaps before each question slot (the tail block is one slot, last, with no card after it; with
  // no tail the cards also fill a gap after the last question), as evenly as they go: gap k holds
  // ceil((k + 1) C / G) - ceil(k C / G) cards, so the first gap always has a card and no gap is empty while C >= G.
  // A late start (lead > 1) puts `lead` cards before the first question, so a linked first question can have its card 3+ before.
  const G = M + 1;
  const gaps = new Array(G).fill(0);
  const deal = (from, count) => {
    const n = G - from;
    for (let k = 0; k < n; k += 1) gaps[from + k] = Math.ceil(((k + 1) * count) / n - 1e-9) - Math.ceil((k * count) / n - 1e-9);
  };
  if (lead > 1 && C >= lead && M) { gaps[0] = lead; deal(1, C - lead); } else deal(0, C);
  const slots = [];
  let pos = 0;
  for (let k = 0; k < M; k += 1) { pos += gaps[k]; slots.push(pos); pos += 1; }
  if (T) tail.forEach((q, j) => { at[C + M + j] = q; });
  mid.forEach((q, k) => { at[slots[k]] = q; });
  const qAt = new Map();
  at.forEach((x, i) => { if (x) qAt.set(x, i); });
  // A card linked to a mistake must come after it.
  const after = new Map();
  for (const [q, i] of qAt) {
    if (q.origin !== 'mistake') continue;
    for (const id of q.links || []) after.set(id, Math.max(after.get(id) ?? -1, i));
  }
  const free = new Set();
  at.forEach((x, i) => { if (!x) free.add(i); });
  const placed = new Set();
  const rank = new Map(cards.map((c, i) => [c.cardId, i]));
  for (const q of mid.concat(tail)) {
    if (q.origin !== 'linked') continue;
    const own = (q.links || []).filter((id) => rank.has(id) && !placed.has(id)).sort((a, b) => rank.get(a) - rank.get(b))[0];
    if (!own) continue;
    const s = qAt.get(q);
    for (const d of [4, 3, 5, 6]) {
      const p = s - d;
      if (p >= 0 && free.has(p) && p > (after.get(own) ?? -1)) { at[p] = cards[rank.get(own)]; free.delete(p); placed.add(own); break; }
    }
  }
  const rest = cards.filter((c) => !placed.has(c.cardId));
  for (const p of [...free].sort((a, b) => a - b)) {
    let i = rest.findIndex((c) => (after.get(c.cardId) ?? -1) < p);
    if (i < 0) i = 0;
    at[p] = rest[i];
    rest.splice(i, 1);
  }
  return at;
}

/**
 * The run's order (R3). A lesson, when there is one, plays first. The final question is the easiest plain one (unlinked
 * first); the order with the best repair score over the first candidates for it is kept. Repair: while A3 problems remain,
 * swap two non-tail questions' slots when the swap lowers the score (at most 3 passes).
 */
export function orderRun({ cards = [], questions = [], lesson = null }) {
  const head = lesson ? [lesson] : [];
  const mistakes = questions.filter((q) => q.origin === 'mistake');
  const shortM = mistakes.filter((q) => !q.late);
  const late = mistakes.filter((q) => q.late);
  const plain = questions.filter((q) => q.origin !== 'mistake');
  const rank = new Map(cards.map((c, i) => [c.cardId, i]));
  const firstRank = (q) => Math.min(...(q.links || []).map((id) => rank.get(id) ?? Infinity));
  const candidates = [...plain].sort((a, b) => diffRank(a) - diffRank(b)
    || (a.origin === 'linked' ? 1 : 0) - (b.origin === 'linked' ? 1 : 0)
    || (a.seen ? 0 : 1) - (b.seen ? 0 : 1)
    || String(a.questionId).localeCompare(String(b.questionId))).slice(0, 8);
  const midOf = (finalQ) => [
    ...shortM,
    ...plain.filter((q) => q.origin === 'linked' && q !== finalQ).sort((a, b) => firstRank(a) - firstRank(b)),
    ...plain.filter((q) => q.origin !== 'linked' && q !== finalQ),
  ];
  if (!cards.length) {
    const finalQ = candidates[0] || null;
    return [...head, ...midOf(finalQ), ...late, ...(finalQ ? [finalQ] : [])];
  }
  if (!questions.length) return [...head, ...cards];
  let best = null;
  for (const finalQ of candidates.length ? candidates : [null]) {
    const tail = [...late, ...(finalQ ? [finalQ] : [])];
    for (const lead of [1, 3]) {
      if (lead > 1 && cards.length < lead) continue;
      let mid = midOf(finalQ);
      let seq = [...head, ...layout(cards, mid, tail, lead)];
      let score = orderScore(seq);
      for (let pass = 0; pass < 3 && orderProblems(seq).length; pass += 1) {
        let swap = null;
        for (let i = 0; i < mid.length; i += 1) {
          for (let j = i + 1; j < mid.length; j += 1) {
            const m = [...mid];
            [m[i], m[j]] = [m[j], m[i]];
            const s = [...head, ...layout(cards, m, tail, lead)];
            const sc = orderScore(s);
            if (sc < score && (!swap || sc < swap.score)) swap = { mid: m, seq: s, score: sc };
          }
        }
        if (!swap) break;
        ({ mid, seq, score } = swap);
      }
      // The easiest final question wins unless a harder one removes an A3 problem.
      const total = score + (finalQ ? diffRank(finalQ) : 5);
      if (!best || total < best.total) best = { seq, total, problems: orderProblems(seq).length };
    }
    if (!best.problems) break;
  }
  return best.seq;
}

// ---------------------------------------------------------------- the composer

const shrinkMinutes = (n) => plural(n, 'minute');
/** The shrink line for its reason (BUILD-1101 1.5). */
export function shrinkText(reason, { minutes = 0, mistakes = 0, cap = LEARN_RULES.maxNewCards, due = 0 } = {}) {
  if (!(minutes > 0)) return 'Nothing is lined up in this chapter yet.';
  if (reason === 'mistakes') return `Your ${plural(mistakes, 'open mistake')} ${mistakes === 1 ? 'takes' : 'take'} about ${shrinkMinutes(minutes)}.`;
  if (reason === 'cap') {
    return due > LEARN_RULES.overduePauseNew
      ? `Revise first: ${due} due. Until then a run takes at most ${plural(cap, 'new card')}, about ${shrinkMinutes(minutes)}.`
      : `One run takes at most ${plural(cap, 'new card')}, about ${shrinkMinutes(minutes)}.`;
  }
  return `This chapter has about ${shrinkMinutes(minutes)} of new things today.`;
}

/**
 * Compose a run, or its dry run (the same call: the chapter page's piles are the counts of the real run).
 *   kind          'mix' | 'cards' | 'recap' | 'feed' (the Explore feed) | 'level' (questions only)
 *   minutes       the chosen length
 *   leaveOut      piles the student left out: 'cards' | 'questions' | 'mistakes' | 'lesson'
 *   cards         the chapter's cards the student may open (Free: the taste cards), any order
 *   states        Map(cardId -> key_card_states row)
 *   questions     the chapter's questions [{ id, difficulty, cards: [cardIds], seen, words }]
 *   mistakes      open mistakes [{ id (question id), where, when }], oldest first; their questions are in `questions`
 *   lesson        null | { id, title, minutes, read }
 *   ratingsLeft   Free: card ratings left today (null on Pro); cards past it are looks
 *   newLeft       Free: new cards left today (null on Pro); new cards past it are looks
 *   cardIds       an explicit set (Find: "Study these", "Quick recap these"), book order, minutes ignored
 *   shownAt       Map(cardId -> ms): feed showings of the last 3 days (the feed's pool, BUILD 1.2)
 *   overdue       the student's overdue Key cards (R15: past 40, new cards are capped at 4 per 10 minutes)
 * Returns { kind, minutes, budget, seconds, realMinutes, shrunk, shrink, exhausted, leaveOut, kept, available, piles, items,
 *   overdue }. Every item carries `seconds`.
 */
export function composeRun({
  kind = 'mix', minutes = 10, leaveOut = [], cards = [], states = new Map(), now, questions = [], mistakes = [], lesson = null,
  ratingsLeft = null, newLeft = null, cardIds = null, shownAt = null, overdue = 0,
} = {}) {
  const k = RUN_KINDS.includes(kind) ? kind : 'mix';
  const feed = k === 'feed';
  const length = Math.max(1, Math.min(240, Math.round(Number(minutes) || 10)));
  const B = budgetSeconds(length);
  const open = (cards || []).filter((c) => c?.id && !c.locked);
  const byId = new Map(open.map((c) => [c.id, c]));
  const qById = new Map((questions || []).map((q) => [q.id, q]));
  const mistakeIds = new Set((mistakes || []).map((m) => m.id).filter((id) => qById.has(id)));
  const mistakeMeta = new Map((mistakes || []).map((m) => [m.id, m]));
  const looks = (list) => {
    // A feed card is never rated (Keep is its only key), so only a held card is a look there (BUILD 1.2).
    if (feed) return list.map((x) => ({ ...x, look: Boolean(x.held) }));
    let rated = 0;
    let fresh = 0;
    return list.map((x) => {
      if (x.held) return { ...x, look: true };
      const isNew = x.stage === 'new';
      const roomRating = ratingsLeft === null || ratingsLeft === undefined || rated < ratingsLeft;
      const roomNew = !isNew || newLeft === null || newLeft === undefined || fresh < newLeft;
      const look = !(roomRating && roomNew);
      if (!look) { rated += 1; if (isNew) fresh += 1; }
      return { ...x, look };
    });
  };
  const withSeconds = (x) => ({ ...x, seconds: cardSeconds({ stage: x.stage, look: x.look, recap: x.recap, words: x.words }) });
  const result = (extra) => ({ kind: k, minutes: length, budget: B, shrink: null, exhausted: false, overdue: null, ...extra });
  const sum = (list) => list.reduce((s, x) => s + x.seconds, 0);

  // ---- recap: Must-know cards only (or the chosen set), answers showing, nothing scheduled
  if (k === 'recap') {
    const set = cardIds ? cardIds.map((id) => byId.get(id)).filter(Boolean) : open.filter((c) => c.importance === 'must');
    const list = [...new Set(set)].sort(bookOrder).slice(0, LEARN_RULES.maxCardIds);
    // A recap schedules nothing, so its cards carry no stage ("Due today" means nothing in one pass, CRITIQUE-1 R7).
    const items = list.map((card) => withSeconds({ type: 'card', cardId: card.id, stage: 'recap', look: true, recap: true, words: cardWords(card) })).map(strip);
    const seconds = sum(items);
    return result({
      seconds, realMinutes: minutesFor(seconds), shrunk: false, leaveOut: [], kept: null,
      available: { cards: items.length > 0, questions: false, mistakes: false, lesson: false },
      piles: { cards: { count: items.length, seconds }, questions: zero(), mistakes: zero(), lesson: zero() },
      items,
    });
  }

  // ---- an explicit set of cards (Find: "Study these 12", a due run of Learn home)
  if (cardIds) {
    const list = [...new Set(cardIds.map((id) => byId.get(id)).filter(Boolean))].sort(bookOrder).slice(0, LEARN_RULES.maxCardIds);
    const items = looks(list.map((card) => ({ type: 'card', cardId: card.id, stage: stageName(cardStage(stateOf(states, card.id), now)), words: cardWords(card) }))).map(withSeconds).map(strip);
    const seconds = sum(items);
    return result({
      kind: 'cards', seconds, realMinutes: minutesFor(seconds), shrunk: false, leaveOut: [], kept: null,
      available: { cards: items.length > 0, questions: false, mistakes: false, lesson: false },
      piles: { cards: { count: items.length, seconds }, questions: zero(), mistakes: zero(), lesson: zero() }, items,
    });
  }

  // ---- level: questions only, easiest last, at most 6, 55 s each ("6 questions, about 6 minutes")
  if (k === 'level') {
    const n = Math.min(LEARN_RULES.levelQuestions, Math.max(1, length));
    const picked = [...(questions || [])].sort((a, b) => (a.seen ? 1 : 0) - (b.seen ? 1 : 0) || diffRank(a) - diffRank(b) || String(a.id).localeCompare(String(b.id))).slice(0, n);
    const ordered = [...picked].sort((a, b) => diffRank(b) - diffRank(a)); // the easiest last
    const items = ordered.map((q) => ({ type: 'question', questionId: q.id, origin: 'chapter', links: q.cards || [], difficulty: q.difficulty, seen: Boolean(q.seen), seconds: questionSeconds({ level: true }) }));
    const seconds = sum(items);
    return result({
      seconds, realMinutes: minutesFor(seconds), shrunk: items.length < n, exhausted: items.length < n, leaveOut: [], kept: null,
      available: { cards: false, questions: items.length > 0, mistakes: false, lesson: false },
      piles: { cards: zero(), questions: { count: items.length, seconds }, mistakes: zero(), lesson: zero() }, items,
    });
  }

  // ---- mix, feed, cards only
  const overduePaused = Number(overdue) > LEARN_RULES.overduePauseNew;
  const newCap = overduePaused ? Math.min(LEARN_RULES.maxNewCards, overdueNewCap(length)) : LEARN_RULES.maxNewCards;
  let poolEntries;
  let freshTotal;
  if (feed) {
    const fp = feedCardPool(open, states, shownAt, now);
    freshTotal = fp.fresh.length;
    poolEntries = [
      ...fp.fresh.slice(0, newCap).map((x) => ({ ...x, stage: 'new' })),
      ...fp.held.map((x) => ({ ...x, stage: 'later', held: true })),
    ];
  } else {
    const pools = cardPools(open, states, now);
    freshTotal = pools.fresh.length;
    poolEntries = [...pools.due.map((x) => ({ ...x, stage: 'due' })), ...pools.fresh.slice(0, newCap).map((x) => ({ ...x, stage: 'new' }))];
  }
  // Seconds of the pool in pick order (a prefix is picked): looks follow Free's ratings in that order.
  const cardPool = looks(poolEntries.map((x) => ({ ...x, words: cardWords(x.card) }))).map((x) => ({ ...x, seconds: cardSeconds({ stage: x.stage, look: x.look, words: x.words }) }));
  // Open mistakes oldest first, the short ones before the long ones (E3).
  const mistakeList = (mistakes || []).filter((m) => qById.has(m.id)).map((m) => qById.get(m.id))
    .map((q, i) => ({ q, i })).sort((a, b) => longRank(a.q) - longRank(b.q) || a.i - b.i).map((x) => x.q);
  const plainPool = (questions || []).filter((q) => !mistakeIds.has(q.id));
  const lessonMinutes = Number(lesson?.minutes) || 0;
  const lessonUnread = Boolean(lesson && !lesson.read && lessonMinutes > 0 && k !== 'cards' && !feed);
  const otherContent = cardPool.length > 0 || (k !== 'cards' && (plainPool.length > 0 || mistakeList.length > 0));
  // R11: the lesson pile at 20+ minutes when the lesson fits in half the length, or at any length when it is all the chapter has.
  const lessonOpen = lessonUnread && ((length >= LEARN_RULES.lessonFromMinutes && lessonMinutes <= length / 2) || !otherContent);
  const available = { cards: cardPool.length > 0, questions: k !== 'cards' && plainPool.length > 0, mistakes: k !== 'cards' && mistakeList.length > 0, lesson: lessonOpen };
  const asked = k === 'cards' ? [...new Set([...(leaveOut || []), 'questions', 'mistakes', 'lesson'])] : leaveOut;
  const eff = effectiveLeaveOut(asked, available);
  const out = new Set(eff.leaveOut);
  const useLesson = lessonOpen && !out.has('lesson');
  const lessonSecs = useLesson ? lessonSeconds(lessonMinutes) : 0;
  const R = Math.max(0, B - lessonSecs);
  const cPool = out.has('cards') ? [] : cardPool;
  const mPool = out.has('mistakes') || k === 'cards' ? [] : mistakeList.map((q) => ({ q, seconds: questionSeconds({ origin: 'mistake', words: q.words }) }));
  const qPool = out.has('questions') || k === 'cards' ? [] : plainPool;
  const qCap = LEARN_RULES.questionsPerBlock * Math.max(1, Math.ceil(length / LEARN_RULES.blockMinutes));
  const mCap = out.has('questions') ? qCap : mistakesFor(length);
  const mMax = Math.min(mPool.length, mCap);

  // A choice is { nC, nM, nQ }: the first nC cards (less the cards a long mistake links to), the first nM mistakes, nQ plain
  // questions picked over the chosen cards (one linked question per card: a linked pick whose first run card is covered by an
  // earlier pick is skipped and the next one taken).
  const qSecs = (q) => questionSeconds({ difficulty: q.difficulty, words: q.words });
  const cardsFor = (nM) => {
    const late = new Set(mPool.slice(0, nM).filter((x) => isLong(x.q)).flatMap((x) => x.q.cards || []));
    return late.size ? cPool.filter((x) => !late.has(x.card.id)) : cPool;
  };
  const plainCache = new Map();
  const plainFor = (chosen, nM, nQ) => {
    const key = `${chosen.length}|${nM}|${nQ}`;
    if (plainCache.has(key)) return plainCache.get(key);
    const runIds = new Set(chosen.map((x) => x.card.id));
    const order = displayOrder(chosen);
    const rankOf = new Map(order.map((x, i) => [x.card.id, i]));
    const firstCard = (q) => (q.cards || []).filter((id) => runIds.has(id)).sort((a, b) => rankOf.get(a) - rankOf.get(b))[0] || null;
    const covered = new Set(mPool.slice(0, nM).flatMap((x) => (x.q.cards || []).filter((id) => runIds.has(id))));
    let linkedPool = qPool.filter((q) => firstCard(q));
    const otherPool = qPool.filter((q) => !firstCard(q));
    let linked = [];
    for (let guard = 0; guard < 50; guard += 1) {
      linked = pickQuestions(linkedPool, nQ);
      const seen = new Set(covered);
      const skip = [];
      for (const q of linked) { const c = firstCard(q); if (seen.has(c)) skip.push(q); else seen.add(c); }
      if (!skip.length) break;
      linkedPool = linkedPool.filter((q) => !skip.includes(q));
    }
    // The linked questions this card set can hold (one per card not covered by a mistake).
    const holdable = new Set(linkedPool.map(firstCard).filter((c) => !covered.has(c))).size;
    // A linked question skipped by the one-per-card rule may still play as a chapter question, after the others.
    const skipped = qPool.filter((q) => firstCard(q) && !linkedPool.includes(q));
    const other = pickQuestions(otherPool, nQ - linked.length);
    other.push(...pickQuestions(skipped, nQ - linked.length - other.length));
    const res = { linked, other, seconds: [...linked, ...other].reduce((s, q) => s + qSecs(q), 0), room: holdable + otherPool.length + skipped.length };
    plainCache.set(key, res);
    return res;
  };
  const build = ({ nC, nM, nQ }) => {
    const avail = cardsFor(nM);
    const chosen = avail.slice(0, nC);
    const ms = mPool.slice(0, nM);
    const plain = plainFor(chosen, nM, nQ);
    return { avail, chosen, ms, plain, cards: sum(chosen), mistakes: ms.reduce((s, x) => s + x.seconds, 0), questions: plain.seconds };
  };
  const total = (b) => b.cards + b.mistakes + b.questions;
  const fitCards = (c, nM, budget) => { const avail = cardsFor(nM); let n = 0; let s = 0; while (n < avail.length && s + avail[n].seconds <= budget + 1e-6) { s += avail[n].seconds; n += 1; } return Math.max(c, n); };
  const fitQuestions = (ch, budget) => {
    // No question is under 50 s, so more than budget / 50 never fits.
    const most = Math.min(qPool.length, Math.max(0, qCap - ch.nM), Math.floor((budget + 1e-6) / SECONDS.question.easy));
    for (let n = most; n > ch.nQ; n -= 1) if (build({ ...ch, nQ: n }).questions <= budget + 1e-6) return n;
    return ch.nQ;
  };
  const fitMistakes = (ch, budget) => {
    let n = ch.nM;
    while (n < mMax && build({ ...ch, nM: n + 1 }).mistakes <= budget + 1e-6) n += 1;
    return n;
  };

  const questionSide = mPool.length + qPool.length > 0;
  const share = feed ? LEARN_RULES.feedCardShare : LEARN_RULES.cardShare;
  const cardBudget = cPool.length ? (questionSide ? R * share : R) : 0;
  let ch = { nC: 0, nM: 0, nQ: 0 };
  ch.nC = fitCards(0, 0, cardBudget);
  ch.nM = fitMistakes(ch, R - build(ch).cards);
  ch.nC = Math.min(ch.nC, cardsFor(ch.nM).length);
  ch.nQ = fitQuestions(ch, R - build(ch).cards - build(ch).mistakes);
  // Time one side cannot use flows to the other side, until nothing more fits (a feed: questions take it first).
  const grow = {
    c: () => { const b = build(ch); ch.nC = fitCards(ch.nC, ch.nM, b.cards + (R - total(b))); },
    m: () => { if (!out.has('questions')) return; const b = build(ch); ch.nM = fitMistakes(ch, b.mistakes + (R - total(b))); },
    q: () => { const b = build(ch); ch.nQ = fitQuestions(ch, b.questions + (R - total(b))); },
  };
  // Fill to the nearest item (R4): one more item of a kind that still has one, when at least half of it fits.
  const fillOne = (kinds) => {
    const b = build(ch);
    const left = R - total(b);
    const tries = {
      c: () => (ch.nC < b.avail.length ? { ...ch, nC: ch.nC + 1 } : null),
      m: () => (out.has('questions') && ch.nM < mMax ? { ...ch, nM: ch.nM + 1 } : null),
      q: () => (ch.nQ < Math.min(qPool.length, qCap - ch.nM) ? { ...ch, nQ: ch.nQ + 1 } : null),
    };
    for (const g of kinds) {
      const next = tries[g]();
      if (!next) continue;
      const nb = build(next);
      if (nb.plain.linked.length + nb.plain.other.length < next.nQ) continue;
      const added = total(nb) - total(b);
      if (added > 0 && left >= added / 2 - 1e-6) { ch = next; return true; }
    }
    return false;
  };
  // A feed's questions take the leftover first, to the nearest question, before any card does (BUILD 1.2).
  let filled = false;
  if (feed) { grow.q(); filled = fillOne(['q']); }
  for (let pass = 0; pass < 4; pass += 1) {
    const before = JSON.stringify(ch);
    for (const g of feed ? ['q', 'm', 'c'] : ['c', 'm', 'q']) grow[g]();
    if (JSON.stringify(ch) === before) break;
  }
  if (!filled) fillOne(feed ? ['q', 'm', 'c'] : ['c', 'm', 'q']);

  const fin = build(ch);
  const chosenMistakes = fin.ms.map((x) => x.q);
  const plainCount = fin.plain.linked.length + fin.plain.other.length;
  // Display order: due cards by oldest due date, then new cards in book order (held looks last), looks re-set in that order.
  const cardItems = looks(displayOrder(fin.chosen).map(({ card, stage, held, words }) => ({
    type: 'card', cardId: card.id, stage: stage === 'later' ? 'later' : stageName(stage), mustKnow: card.importance === 'must', words, ...(held ? { held: true } : {}),
  }))).map(withSeconds).map(strip);
  const qItem = (q, origin) => ({
    type: 'question', questionId: q.id, origin, links: q.cards || [], difficulty: q.difficulty, seen: Boolean(q.seen),
    seconds: origin === 'mistake' ? questionSeconds({ origin: 'mistake', words: q.words }) : qSecs(q),
    ...(origin === 'mistake' && isLong(q) ? { late: true } : {}),
    mistake: origin === 'mistake' ? mistakeOf(mistakeMeta.get(q.id)) : null,
  });
  const questionItems = [
    ...chosenMistakes.map((q) => qItem(q, 'mistake')),
    ...fin.plain.linked.map((q) => qItem(q, 'linked')),
    ...fin.plain.other.map((q) => qItem(q, 'chapter')),
  ];
  const lessonItem = useLesson ? { type: 'lesson', lessonId: lesson.id, minutes: lessonMinutes, seconds: lessonSecs } : null;
  const items = orderRun({ cards: cardItems, questions: questionItems, lesson: lessonItem });
  const cardSecs = sum(cardItems);
  const plainSecs = questionItems.filter((q) => q.origin !== 'mistake').reduce((s, q) => s + q.seconds, 0);
  const mistakeSecs = questionItems.filter((q) => q.origin === 'mistake').reduce((s, q) => s + q.seconds, 0);
  const seconds = lessonSecs + cardSecs + plainSecs + mistakeSecs;
  const realMinutes = minutesFor(seconds);
  // Honest length (R4): shrunk only when the chapter has no more of what is in.
  const newChosen = fin.chosen.filter((x) => x.stage === 'new').length;
  const capHit = !out.has('cards') && newChosen >= newCap && freshTotal > newCap;
  const exhausted = (out.has('cards') || ch.nC >= fin.avail.length)
    && (out.has('questions') || k === 'cards' || plainCount >= fin.plain.room || ch.nM + plainCount >= qCap)
    && (out.has('mistakes') || k === 'cards' || ch.nM >= mMax);
  const shrunk = exhausted && realMinutes < length;
  let shrink = null;
  if (shrunk) {
    const onlyMistakes = chosenMistakes.length > 0 && !cardItems.length && !plainCount && !useLesson;
    const reason = onlyMistakes ? 'mistakes' : capHit ? 'cap' : 'pool';
    shrink = { reason, text: shrinkText(reason, { minutes: realMinutes, mistakes: chosenMistakes.length, cap: newCap, due: overduePaused ? Number(overdue) : 0 }) };
  }
  return result({
    seconds, realMinutes, shrunk, shrink, exhausted, leaveOut: eff.leaveOut, kept: eff.kept, available,
    overdue: overduePaused ? { count: Number(overdue), newCap, text: `Revise first: ${Number(overdue)} due` } : null,
    piles: {
      cards: { count: cardItems.length, seconds: cardSecs },
      questions: { count: plainCount, seconds: plainSecs },
      mistakes: { count: chosenMistakes.length, seconds: mistakeSecs, open: mistakeList.length },
      lesson: { count: useLesson ? 1 : 0, seconds: lessonSecs, ...(useLesson ? { minutes: lessonMinutes } : {}) },
    },
    items,
  });
}

/** Cards in the order they show: due by oldest due date, then the rest in book order (held looks last). */
function displayOrder(chosen) {
  const due = chosen.filter((x) => x.stage === 'due').sort((a, b) => time(a.state?.due_at) - time(b.state?.due_at) || bookOrder(a.card, b.card));
  const fresh = chosen.filter((x) => x.stage !== 'due' && !x.held).sort((a, b) => bookOrder(a.card, b.card));
  const held = chosen.filter((x) => x.held).sort((a, b) => bookOrder(a.card, b.card));
  return [...due, ...fresh, ...held];
}

// Composer-only fields never leave the composer: `words` is how seconds were set; `held` is a feed look's source.
const strip = ({ words: _w, held: _h, ...rest }) => rest;
const zero = () => ({ count: 0, seconds: 0 });

/** The one label of a mistake everywhere (run, feed, end): "You missed this in Mock 3 on 16 Oct", "You missed this on 16 Oct". */
export function mistakeLabel(where, when) {
  if (!where) return when ? `You missed this on ${when}` : 'You missed this before';
  return when ? `You missed this in ${where} on ${when}` : `You missed this in ${where}`;
}
const mistakeOf = (m) => ({ where: m?.where ?? null, when: m?.when ?? null, label: mistakeLabel(m?.where, m?.when) });

/** A pile's minutes on its own (rounded, at least 1). The dry run splits the run's total instead (splitMinutes). */
export const pileMinutes = (seconds) => (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0);
const stageName = (stage) => (stage === 'due' ? 'due' : 'new');

/**
 * Split `total` minutes over parts in proportion to their seconds, so they add up to it (largest remainder, BUILD 1.5).
 * A part with seconds gets at least 1 minute while another part can spare one.
 */
export function splitMinutes(total, seconds) {
  const list = (seconds || []).map((s) => Math.max(0, Number(s) || 0));
  const all = list.reduce((a, b) => a + b, 0);
  const T = Math.max(0, Math.round(Number(total) || 0));
  if (!all || !T) return list.map(() => 0);
  const raw = list.map((s) => (s / all) * T);
  const out = raw.map(Math.floor);
  let left = T - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f || list[b.i] - list[a.i] || a.i - b.i);
  for (let j = 0; left > 0; j = (j + 1) % order.length, left -= 1) out[order[j].i] += 1;
  for (let i = 0; i < out.length; i += 1) {
    if (list[i] > 0 && out[i] === 0) {
      const big = out.reduce((b, v, j) => (v > out[b] ? j : b), 0);
      if (out[big] > 1) { out[big] -= 1; out[i] = 1; }
    }
  }
  return out;
}

// ---------------------------------------------------------------- the chapter page's dry run (A1)

/**
 * The lined-up block of the chapter page from a composed run.
 *   run         composeRun() for the chosen length and leaveOut
 *   recapRun    composeRun({ kind: 'recap' }) (the Must-know set)
 *   chapter     { total, open } card counts (Free: open is the taste)
 *   isPro, firstVisit, ratingsLeft
 *   nextChapter null | { key, title } the next chapter in book order (honest shrink offers it)
 */
export function dryRun({ run, recapRun = null, isPro = true, firstVisit = false, ratingsLeft = null, chapter = { total: 0, open: 0 }, nextChapter = null }) {
  const length = run.shrunk ? run.realMinutes : run.minutes;
  const ids = PILE_IDS.filter((id) => run.available[id]);
  const inIds = ids.filter((id) => !run.leaveOut.includes(id) && run.piles[id].count > 0);
  // The lesson's minutes are exact; the other piles split the rest of the run's length so the piles add up to it.
  const lessonMin = inIds.includes('lesson') ? Number(run.piles.lesson.minutes) || Math.round((run.piles.lesson.seconds * LEARN_RULES.feedback) / 60) : 0;
  const others = inIds.filter((id) => id !== 'lesson');
  const split = splitMinutes(Math.max(others.length ? 1 : 0, length - lessonMin), others.map((id) => run.piles[id].seconds));
  const minutesOf = new Map(others.map((id, i) => [id, split[i]]));
  if (lessonMin) minutesOf.set('lesson', lessonMin);
  const piles = [];
  for (const id of ids) {
    const left = run.leaveOut.includes(id);
    const p = run.piles[id];
    const minutes = left ? 0 : minutesOf.get(id) || 0;
    // Fewer mistakes in the pile than are open: say so ("2 of 3, about 2 min"), so the shelf's "3 open" agrees.
    const of = id === 'mistakes' && !left && Number(p.open) > p.count ? p.open : null;
    const minutesLabel = left ? 'Left out' : of ? `${p.count} of ${of}, ${pileMinutesLabel(id, minutes)}` : pileMinutesLabel(id, minutes);
    const note = id === 'cards' && !left && run.overdue ? { note: run.overdue.text } : {};
    piles.push({ id, count: left ? 0 : p.count, minutes, label: PILE_LABELS[id], minutesLabel, left, ...(of ? { of } : {}), ...note });
  }
  const recapCount = recapRun?.items.length || 0;
  const recapMinutes = recapRun ? recapRun.realMinutes : 0;
  const recap = recapCount ? {
    count: recapCount, minutes: recapMinutes,
    label: `Or a quick recap: the ${recapCount} Must-know ${recapCount === 1 ? 'line' : 'lines'}, about ${recapMinutes} min`,
  } : null;
  // R11: a chapter whose only content is its lesson starts the lesson by name, with no shrink line.
  const lessonOnly = inIds.length === 1 && inIds[0] === 'lesson';
  let shrink = null;
  if (run.shrunk && !lessonOnly) {
    shrink = {
      minutes: run.realMinutes,
      reason: run.shrink?.reason || 'pool',
      text: run.shrink?.text || shrinkText('pool', { minutes: run.realMinutes }),
      addNext: nextChapter ? { key: nextChapter.key, title: nextChapter.title, label: `Add the next chapter, ${nextChapter.title}` } : null,
    };
  }
  let free = null;
  if (!isPro) {
    const parts = [];
    if (chapter.total > chapter.open) parts.push(`Free opens ${chapter.open} of this chapter's ${chapter.total} cards.`);
    if (ratingsLeft === 0) parts.push(RATINGS_USED);
    free = parts.length ? { text: parts.join(' ') } : null;
  }
  return {
    minutes: run.minutes,
    realMinutes: run.realMinutes,
    startLabel: lessonOnly ? `Start the ${lessonMin}-minute lesson` : length > 0 ? startLabel(length) : 'Nothing to start yet',
    piles,
    leaveOut: run.leaveOut,
    coach: piles.length > 1 ? 'Tap a pile to leave it out.' : null,
    note: firstVisit ? NOTE_FIRST : NOTE,
    recap,
    shrink,
    free,
  };
}
