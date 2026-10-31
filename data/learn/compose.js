// Learn v2: the session composer (docs/brain/learn-1031/design/B-chapters.md section 4, with DESIGN-SPEC.md A1, A3 and A9).
// PURE: no I/O and no clock of its own. The development preview (src/lib/server/learnPreview.js) and, later, the production
// routes hand it the chapter's cards, the student's card states, the chapter's questions (no answer keys needed), the open
// mistakes and the lesson; it answers with the run's items in order and the piles of the chapter page's dry run.
//
// The recipe:
//   budget        minutes x 60 / 1.1 (the 10 percent is reading the feedback)
//   seconds       15 a rated card, 10 a recap card, 60 a question, a lesson its own minutes
//   split         mixed runs aim 45 percent cards and 55 percent questions; time one side cannot use flows to the other
//   fill order    lesson (20+ minutes, unread only), open mistakes (1 at 5 min, 2 at 10, 3 at 20; all the question side
//                 holds when Questions is left out), due cards (Must-know first), new cards in book order (Must-know first,
//                 at most 40), questions linked to cards in this run (unseen first), other chapter questions (unseen first,
//                 easy 40, medium 40, hard 20)
//   order (A3)    the first item is a card (after the lesson, which plays first); an open mistake is retried before any
//                 card it links to; a linked question sits 3 to 6 items after its latest linked card; the last item is the
//                 question with the best chance of a right answer
//   long stems    a question over 60 words is a wall of text early in a run (CRITIQUE-1 E3, LK11): mistakes under 60 words
//                 are retried first; a long one that is retried plays second-last (never before item 5) and its linked
//                 cards stay out of the run, so the mistake still comes before the card that answers it; other questions
//                 of one difficulty pick the short ones first
//   honest        nothing is padded: when the pools cannot fill the time the run says its real length (shrink)
//   Free          only the chapter's open taste cards; past today's ratings they are looks; questions are free
//   recap         Must-know cards only, answers showing, 10 s each, nothing scheduled

export const LEARN_RULES = Object.freeze({
  feedback: 1.1,
  cardSeconds: 15,
  recapSeconds: 10,
  questionSeconds: 60,
  cardShare: 0.45,
  maxNewCards: 40,
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
export const NOTE = 'Ratings join Revise. Questions are free.';
export const NOTE_FIRST = 'Ratings join Revise, so cards come back when they are due.';
export const RATINGS_USED = "Today's 10 free card ratings are used. Your cards show without ratings; questions are free.";

const DIFFICULTY_RANK = Object.freeze({ easy: 0, medium: 1, hard: 2 });
const diffRank = (q) => DIFFICULTY_RANK[q?.difficulty] ?? 3;
/** True when a question's stem is long (its `words`, counted by the caller from the stem). */
export const isLong = (q) => Number(q?.words) > LEARN_RULES.longStemWords;
const longRank = (q) => (isLong(q) ? 1 : 0);
const time = (v) => { const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));
const mustFirst = (a, b) => (a.importance === 'must' ? 0 : 1) - (b.importance === 'must' ? 0 : 1);
const fl = (x) => Math.floor(x + 1e-6); // budgets are fractions of 1.1: 299.99999 seconds is 300
const stateOf = (states, id) => (states instanceof Map ? states.get(id) : states?.[id]) || null;

/** Usable seconds of a length: minutes x 60 / 1.1. */
export const budgetSeconds = (minutes) => (Math.max(0, Number(minutes) || 0) * 60) / LEARN_RULES.feedback;
/** The minutes a student is told for `seconds` of items: with the 10 percent, rounded, at least 1 when there is anything. */
export const minutesFor = (seconds) => (seconds > 0 ? Math.max(1, Math.round((seconds * LEARN_RULES.feedback) / 60)) : 0);
/** Open mistakes a mixed run retries: 1 under 10 minutes, 2 under 20, 3 from 20. */
export const mistakesFor = (minutes) => (minutes >= 20 ? 3 : minutes >= 10 ? 2 : 1);
/** "Start 10 minutes", "Start 1 minute". */
export const startLabel = (minutes) => `Start ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
/** "about 4 min" (a lesson's own minutes are exact: "7 min"). */
export const pileMinutesLabel = (id, minutes) => (id === 'lesson' ? `${minutes} min` : `about ${minutes} min`);

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

// ---------------------------------------------------------------- the order on screen (A3)

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

function buildOrder({ cards, questions, lesson, finalQ, lateCardId }) {
  const seq = lesson ? [lesson] : [];
  const runCards = new Set(cards.map((c) => c.cardId));
  const cardQ = cards.filter((c) => c.cardId !== lateCardId);
  const late = lateCardId ? cards.find((c) => c.cardId === lateCardId) : null;
  let lateDone = !late;
  const rest = questions.filter((q) => q !== finalQ);
  const mistakesQ = rest.filter((q) => q.origin === 'mistake' && !q.late);
  const lateQ = rest.filter((q) => q.origin === 'mistake' && q.late);
  const linkedQ = rest.filter((q) => q.origin === 'linked');
  const otherQ = rest.filter((q) => q.origin !== 'mistake' && q.origin !== 'linked');
  const placed = new Map(); // cardId -> index
  let sinceQ = 0;
  let firstCard = false;
  const blocked = (c) => mistakesQ.some((m) => (m.links || []).includes(c.cardId));
  const windowOf = (q) => {
    const at = (q.links || []).filter((id) => placed.has(id)).map((id) => placed.get(id));
    if (!at.length) return null;
    const last = Math.max(...at);
    return [last + 3, last + 6];
  };
  const remaining = () => cardQ.length + mistakesQ.length + linkedQ.length + otherQ.length + (lateDone ? 0 : 1);
  const putCard = (c) => { placed.set(c.cardId, seq.length); seq.push(c); sinceQ += 1; firstCard = true; };
  const putQ = (list, q) => { list.splice(list.indexOf(q), 1); seq.push(q); sinceQ = 0; };
  const takeCard = (c) => { cardQ.splice(cardQ.indexOf(c), 1); putCard(c); };
  let guard = 0;
  while (remaining() > 0 && guard++ < 10_000) {
    const idx = seq.length;
    const free = cardQ.filter((c) => !blocked(c));
    if (!lateDone && (remaining() - 1 <= 3 || (!cardQ.length && !mistakesQ.length && !otherQ.length && !linkedQ.some((q) => windowOf(q))))) {
      putCard(late); lateDone = true; continue;
    }
    if (!firstCard && free.length) { takeCard(free[0]); continue; }
    const questionsLeft = mistakesQ.length + linkedQ.length + otherQ.length;
    const cardsLeft = cardQ.length + (lateDone ? 0 : 1);
    // Spread the questions evenly through the cards (the final question counts as one more slot).
    const gap = Math.max(1, Math.round(cardsLeft / (questionsLeft + (finalQ ? 1 : 0) || 1)));
    const ready = linkedQ.map((q) => ({ q, w: windowOf(q) })).filter((x) => x.w && x.w[0] <= idx).sort((a, b) => a.w[1] - b.w[1]);
    if (ready.length && (ready[0].w[1] <= idx || sinceQ >= gap || !free.length)) { putQ(linkedQ, ready[0].q); continue; }
    if (mistakesQ.length && (sinceQ >= Math.min(gap, 2) || !free.length)) { putQ(mistakesQ, mistakesQ[0]); continue; }
    if (otherQ.length && (sinceQ >= gap || !free.length)) { putQ(otherQ, otherQ[0]); continue; }
    if (free.length) { takeCard(free[0]); continue; }
    if (otherQ.length) { putQ(otherQ, otherQ[0]); continue; }
    if (cardQ.length) { takeCard(cardQ[0]); continue; }
    if (linkedQ.length) {
      const next = linkedQ.map((q) => ({ q, w: windowOf(q) })).sort((a, b) => (a.w ? a.w[0] : Infinity) - (b.w ? b.w[0] : Infinity))[0];
      putQ(linkedQ, next.q); continue;
    }
    if (mistakesQ.length) { putQ(mistakesQ, mistakesQ[0]); continue; }
  }
  // A long mistake plays second-last (just before the final question), and never before item LEARN_RULES.lateFrom.
  for (const q of lateQ) seq.push(q);
  if (finalQ) seq.push(finalQ);
  return seq;
}

/**
 * The run's order: tries the easiest questions as the last item (unlinked first) and keeps the order with the fewest A3
 * problems, so the run ends on the question with the best chance of a right answer whenever the rules allow it.
 */
export function orderRun({ cards = [], questions = [], lesson = null }) {
  const runCards = new Set(cards.map((c) => c.cardId));
  const plain = questions.filter((q) => q.origin !== 'mistake');
  const candidates = [...plain].sort((a, b) => diffRank(a) - diffRank(b)
    || (a.origin === 'linked' ? 1 : 0) - (b.origin === 'linked' ? 1 : 0)
    || (a.seen ? 0 : 1) - (b.seen ? 0 : 1)
    || String(a.questionId).localeCompare(String(b.questionId))).slice(0, 8);
  let best = null;
  const tries = candidates.length ? candidates : [null];
  for (const finalQ of tries) {
    const lateCards = finalQ?.origin === 'linked' ? (finalQ.links || []).filter((id) => runCards.has(id)) : [];
    for (const lateCardId of lateCards.length ? lateCards : [null]) {
      const seq = buildOrder({ cards, questions, lesson, finalQ, lateCardId });
      const problems = orderProblems(seq);
      const score = problems.length * 10 + (finalQ ? diffRank(finalQ) : 5);
      if (!best || score < best.score) best = { seq, problems, score };
      if (!problems.length) return best.seq;
    }
    if (best && !best.problems.length) break;
  }
  return best ? best.seq : [];
}

// ---------------------------------------------------------------- the composer

/**
 * Compose a run, or its dry run (the same call: the chapter page's piles are the counts of the real run).
 *   kind          'mix' | 'cards' | 'recap' | 'feed' (the Explore feed, composed as a mix) | 'level' (questions only)
 *   minutes       the chosen length
 *   leaveOut      piles the student left out: 'cards' | 'questions' | 'mistakes' | 'lesson'
 *   cards         the chapter's cards the student may open (Free: the taste cards), any order
 *   states        Map(cardId -> key_card_states row)
 *   questions     the chapter's questions [{ id, difficulty, cards: [cardIds], seen }]
 *   mistakes      open mistakes [{ id (question id), where, when }], oldest first; their questions are in `questions`
 *   lesson        null | { id, title, minutes, read }
 *   ratingsLeft   Free: card ratings left today (null on Pro); cards past it are looks
 *   newLeft       Free: new cards left today (null on Pro); new cards past it are looks
 *   cardIds       an explicit set (Find: "Study these", "Quick recap these"), book order, minutes ignored
 * Returns { kind, minutes, budget, seconds, realMinutes, shrunk, leaveOut, kept, available, piles, items }.
 */
export function composeRun({
  kind = 'mix', minutes = 10, leaveOut = [], cards = [], states = new Map(), now, questions = [], mistakes = [], lesson = null,
  ratingsLeft = null, newLeft = null, cardIds = null,
} = {}) {
  const k = RUN_KINDS.includes(kind) ? kind : 'mix';
  const length = Math.max(1, Math.min(240, Math.round(Number(minutes) || 10)));
  const B = budgetSeconds(length);
  const open = (cards || []).filter((c) => c?.id && !c.locked);
  const byId = new Map(open.map((c) => [c.id, c]));
  const qById = new Map((questions || []).map((q) => [q.id, q]));
  const mistakeIds = new Set((mistakes || []).map((m) => m.id).filter((id) => qById.has(id)));
  const mistakeMeta = new Map((mistakes || []).map((m) => [m.id, m]));
  const looks = (list) => {
    let rated = 0;
    let fresh = 0;
    return list.map((x) => {
      const isNew = x.stage === 'new';
      const roomRating = ratingsLeft === null || ratingsLeft === undefined || rated < ratingsLeft;
      const roomNew = !isNew || newLeft === null || newLeft === undefined || fresh < newLeft;
      const look = !(roomRating && roomNew);
      if (!look) { rated += 1; if (isNew) fresh += 1; }
      return { ...x, look };
    });
  };
  const result = (extra) => ({ kind: k, minutes: length, budget: B, ...extra });

  // ---- recap: Must-know cards only (or the chosen set), answers showing, nothing scheduled
  if (k === 'recap') {
    const set = cardIds ? cardIds.map((id) => byId.get(id)).filter(Boolean) : open.filter((c) => c.importance === 'must');
    const list = [...new Set(set)].sort(bookOrder).slice(0, LEARN_RULES.maxCardIds);
    // A recap schedules nothing, so its cards carry no stage ("Due today" means nothing in one pass, CRITIQUE-1 R7).
    const items = list.map((card) => ({ type: 'card', cardId: card.id, stage: 'recap', look: true, recap: true }));
    const seconds = items.length * LEARN_RULES.recapSeconds;
    return result({
      seconds, realMinutes: minutesFor(seconds), shrunk: false, leaveOut: [], kept: null,
      available: { cards: items.length > 0, questions: false, mistakes: false, lesson: false },
      piles: { cards: { count: items.length, seconds }, questions: zero(), mistakes: zero(), lesson: zero() },
      items,
    });
  }

  // ---- an explicit set of cards (Find: "Study these 12")
  if (cardIds) {
    const list = [...new Set(cardIds.map((id) => byId.get(id)).filter(Boolean))].sort(bookOrder).slice(0, LEARN_RULES.maxCardIds);
    const items = looks(list.map((card) => ({ type: 'card', cardId: card.id, stage: stageName(cardStage(stateOf(states, card.id), now)) })));
    const seconds = items.length * LEARN_RULES.cardSeconds;
    return result({
      kind: 'cards', seconds, realMinutes: minutesFor(seconds), shrunk: false, leaveOut: [], kept: null,
      available: { cards: items.length > 0, questions: false, mistakes: false, lesson: false },
      piles: { cards: { count: items.length, seconds }, questions: zero(), mistakes: zero(), lesson: zero() }, items,
    });
  }

  // ---- level: questions only, easiest first, at most 6
  if (k === 'level') {
    // A level run is a minute a question (its feedback is a single line): "6 questions, about 6 minutes".
    const n = Math.min(LEARN_RULES.levelQuestions, Math.max(1, length));
    const picked = [...(questions || [])].sort((a, b) => (a.seen ? 1 : 0) - (b.seen ? 1 : 0) || diffRank(a) - diffRank(b) || String(a.id).localeCompare(String(b.id))).slice(0, n);
    const ordered = [...picked].sort((a, b) => diffRank(b) - diffRank(a)); // the easiest last
    const items = ordered.map((q) => ({ type: 'question', questionId: q.id, origin: 'chapter', links: q.cards || [], difficulty: q.difficulty, seen: Boolean(q.seen) }));
    const seconds = items.length * LEARN_RULES.questionSeconds;
    return result({
      seconds, realMinutes: items.length, shrunk: items.length < n, leaveOut: [], kept: null,
      available: { cards: false, questions: items.length > 0, mistakes: false, lesson: false },
      piles: { cards: zero(), questions: { count: items.length, seconds }, mistakes: zero(), lesson: zero() }, items,
    });
  }

  // ---- mix, feed, cards only
  const pools = cardPools(open, states, now);
  const cardPool = [...pools.due, ...pools.fresh.slice(0, LEARN_RULES.maxNewCards)];
  // Open mistakes oldest first, the short ones before the long ones (E3).
  const mistakeList = (mistakes || []).filter((m) => qById.has(m.id)).map((m) => qById.get(m.id))
    .map((q, i) => ({ q, i })).sort((a, b) => longRank(a.q) - longRank(b.q) || a.i - b.i).map((x) => x.q);
  const plainPool = (questions || []).filter((q) => !mistakeIds.has(q.id));
  const lessonOpen = Boolean(lesson && !lesson.read && length >= LEARN_RULES.lessonFromMinutes && k !== 'cards' && Number(lesson.minutes) > 0);
  const available = { cards: cardPool.length > 0, questions: k !== 'cards' && plainPool.length > 0, mistakes: k !== 'cards' && mistakeList.length > 0, lesson: lessonOpen };
  const asked = k === 'cards' ? [...new Set([...(leaveOut || []), 'questions', 'mistakes', 'lesson'])] : leaveOut;
  const eff = effectiveLeaveOut(asked, available);
  const out = new Set(eff.leaveOut);
  const useLesson = lessonOpen && !out.has('lesson');
  const lessonSeconds = useLesson ? Number(lesson.minutes) * 60 : 0;
  const R = Math.max(0, B - lessonSeconds);
  const cPool = out.has('cards') ? [] : cardPool;
  const mPool = out.has('mistakes') || k === 'cards' ? [] : mistakeList;
  const qPool = out.has('questions') || k === 'cards' ? [] : plainPool;
  const qCap = LEARN_RULES.questionsPerBlock * Math.max(1, Math.ceil(length / LEARN_RULES.blockMinutes));
  const mCap = out.has('questions') ? qCap : mistakesFor(length);
  const S = { c: LEARN_RULES.cardSeconds, q: LEARN_RULES.questionSeconds };
  const questionSide = mPool.length + qPool.length > 0;
  const cardBudget = cPool.length ? (questionSide ? R * LEARN_RULES.cardShare : R) : 0;
  const qBudget = R - cardBudget;
  let nM = Math.min(mPool.length, mCap, fl(qBudget / S.q));
  let nC = Math.min(cPool.length, fl(cardBudget / S.c));
  let nQ = Math.min(qPool.length, Math.max(0, qCap - nM), fl((qBudget - nM * S.q) / S.q));
  // Time one side cannot use flows to the other side, until nothing more fits.
  for (let pass = 0; pass < 4; pass += 1) {
    let left = R - nC * S.c - (nM + nQ) * S.q;
    const addC = Math.min(cPool.length - nC, fl(left / S.c));
    if (addC > 0) { nC += addC; left -= addC * S.c; }
    const addM = out.has('questions') ? Math.min(mPool.length - nM, fl(left / S.q), qCap - nM - nQ) : 0;
    if (addM > 0) { nM += addM; left -= addM * S.q; }
    const addQ = Math.min(qPool.length - nQ, fl(left / S.q), qCap - nM - nQ);
    if (addQ > 0) { nQ += addQ; left -= addQ * S.q; }
    if (addC <= 0 && addM <= 0 && addQ <= 0) break;
  }
  const chosenMistakes = mPool.slice(0, Math.max(0, nM));
  // A long mistake plays late, so the cards that answer it stay out of this run (it is still retried before them).
  const lateLinks = new Set(chosenMistakes.filter(isLong).flatMap((q) => q.cards || []));
  const chosenCards = cPool.filter((x) => !lateLinks.has(x.card.id)).slice(0, Math.max(0, nC));
  const runCardIds = new Set(chosenCards.map((x) => x.card.id));
  const linkedPool = qPool.filter((q) => (q.cards || []).some((id) => runCardIds.has(id)));
  const otherPool = qPool.filter((q) => !linkedPool.includes(q));
  const linkedPick = pickQuestions(linkedPool, nQ);
  const otherPick = pickQuestions(otherPool, nQ - linkedPick.length);
  const cardItems = looks(chosenCards.map(({ card, state }) => ({ type: 'card', cardId: card.id, stage: stageName(cardStage(state, now)), mustKnow: card.importance === 'must' })));
  const qItem = (q, origin) => ({
    type: 'question', questionId: q.id, origin, links: q.cards || [], difficulty: q.difficulty, seen: Boolean(q.seen),
    ...(origin === 'mistake' && isLong(q) ? { late: true } : {}),
    mistake: origin === 'mistake' ? mistakeOf(mistakeMeta.get(q.id)) : null,
  });
  const questionItems = [
    ...chosenMistakes.map((q) => qItem(q, 'mistake')),
    ...linkedPick.map((q) => qItem(q, 'linked')),
    ...otherPick.map((q) => qItem(q, 'chapter')),
  ];
  const lessonItem = useLesson ? { type: 'lesson', lessonId: lesson.id, minutes: Number(lesson.minutes) } : null;
  const items = orderRun({ cards: cardItems, questions: questionItems, lesson: lessonItem });
  const seconds = lessonSeconds + cardItems.length * S.c + questionItems.length * S.q;
  const realMinutes = minutesFor(seconds);
  return result({
    seconds, realMinutes, shrunk: realMinutes < length, leaveOut: eff.leaveOut, kept: eff.kept, available,
    piles: {
      cards: { count: cardItems.length, seconds: cardItems.length * S.c },
      questions: { count: linkedPick.length + otherPick.length, seconds: (linkedPick.length + otherPick.length) * S.q },
      mistakes: { count: chosenMistakes.length, seconds: chosenMistakes.length * S.q, open: mistakeList.length },
      lesson: { count: useLesson ? 1 : 0, seconds: lessonSeconds },
    },
    items,
  });
}

const zero = () => ({ count: 0, seconds: 0 });

/** The one label of a mistake everywhere (run, feed, end): "You missed this in Mock 3 on 16 Oct". */
export function mistakeLabel(where, when) {
  if (!where) return 'You missed this before';
  return when ? `You missed this in ${where} on ${when}` : `You missed this in ${where}`;
}
const mistakeOf = (m) => ({ where: m?.where ?? null, when: m?.when ?? null, label: mistakeLabel(m?.where, m?.when) });

/** A pile's minutes: its own seconds at a minute a question and 15 s a card, rounded, at least 1 (the 10 percent of reading
 * the feedback is in the run's length, not in each pile, so 5 questions always read "about 5 min"). */
export const pileMinutes = (seconds) => (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0);
const stageName = (stage) => (stage === 'due' ? 'due' : 'new');

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
  const piles = [];
  for (const id of PILE_IDS) {
    if (!run.available[id]) continue;
    const left = run.leaveOut.includes(id);
    const p = run.piles[id];
    const minutes = left ? 0 : pileMinutes(p.seconds);
    // Fewer mistakes in the pile than are open: say so ("2 of 3, about 2 min"), so the shelf's "3 open" agrees.
    const of = id === 'mistakes' && !left && Number(p.open) > p.count ? p.open : null;
    const minutesLabel = left ? 'Left out' : of ? `${p.count} of ${of}, ${pileMinutesLabel(id, minutes)}` : pileMinutesLabel(id, minutes);
    piles.push({ id, count: left ? 0 : p.count, minutes, label: PILE_LABELS[id], minutesLabel, left, ...(of ? { of } : {}) });
  }
  const length = run.shrunk ? run.realMinutes : run.minutes;
  const recapCount = recapRun?.items.length || 0;
  const recapMinutes = recapRun ? recapRun.realMinutes : 0;
  const recap = recapCount ? {
    count: recapCount, minutes: recapMinutes,
    label: `Or a quick recap: the ${recapCount} Must-know ${recapCount === 1 ? 'line' : 'lines'}, about ${recapMinutes} min`,
  } : null;
  let shrink = null;
  if (run.shrunk) {
    shrink = {
      minutes: run.realMinutes,
      text: run.realMinutes > 0
        ? `This chapter has enough for about ${run.realMinutes} ${run.realMinutes === 1 ? 'minute' : 'minutes'} today.`
        : 'Nothing is lined up in this chapter yet.',
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
    startLabel: length > 0 ? startLabel(length) : 'Nothing to start yet',
    piles,
    leaveOut: run.leaveOut,
    coach: piles.length > 1 ? 'Tap a pile to leave it out.' : null,
    note: firstVisit ? NOTE_FIRST : NOTE,
    recap,
    shrink,
    free,
  };
}
