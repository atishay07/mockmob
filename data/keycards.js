// Key cards: the pure rules (KEYCARDS-BUILD-SPEC.md 2c, KEYCARDS-CONTENT-SPEC.md). No I/O, no clock of its own: the
// server, the content scripts (scripts/keycards/*) and node:test all read this one file; the app mirrors it through the
// fixtures. Product rules: no mastery percentage, never "mastered", no paid model call anywhere in here.
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';

export const KEYCARD_RULES = Object.freeze({
  retention: 0.9,
  examHorizon: '2027-05-15', // the longest interval never passes this date
  free: Object.freeze({ tastePerChapter: 5, reviewsPerDay: 10, newPerDay: 5, lineNeededPerDay: 3 }),
  pro: Object.freeze({ newPerDayChoices: Object.freeze([10, 15, 25]), newPerDayDefault: 15 }),
  overduePauseNew: 40,
  minutesPerCard: 0.25, // 15 seconds per card
  ratings: Object.freeze({ missed: 1, gotIt: 3, easy: 4 }),
});

export const KEYCARDS_VERSION = 1;
export const RATINGS = Object.freeze([1, 3, 4]);
export const MODES = Object.freeze(['revise', 'study', 'last_look']);
export const ADDED_FROM = Object.freeze(['chapter', 'taste', 'mistake', 'manual']);

// Card kinds and the label a student sees (KEYCARDS-CONTENT-SPEC.md section 2), English kinds last.
export const KIND_LABELS = Object.freeze({
  definition: 'Definition', term: 'Term', key_line: 'Key line', list: 'List', difference: 'Difference', steps: 'Steps',
  types: 'Types', formula: 'Formula', fact: 'Fact', example: 'Example', entry: 'Entry', quote: 'Quote',
  word: 'Word', idiom: 'Idiom', one_word: 'One word', usage: 'Usage', rule: 'Rule',
});
export const NCERT_KINDS = Object.freeze(['definition', 'term', 'key_line', 'list', 'difference', 'steps', 'types', 'formula', 'fact', 'example', 'entry', 'quote']);
export const ENGLISH_KINDS = Object.freeze(['word', 'idiom', 'one_word', 'usage', 'rule']);

const DAY = 86_400_000;
const IST_MS = 19_800_000;

/** The chapter slug every part shares: lowercase, "&" -> "and", every run of non-alphanumerics -> "-", trimmed. */
export function chapterSlug(name) {
  return String(name ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
/** subject + "." + slug(name): "business_studies.nature-and-significance-of-management". */
export const chapterKeyOf = (subject, name) => `${subject}.${chapterSlug(name)}`;

/** The India calendar day (YYYY-MM-DD) of an instant; the period of a Free daily allowance. */
export const istDay = (at) => new Date(Number(new Date(at)) + IST_MS).toISOString().slice(0, 10);

const time = (v) => { const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
const mustFirst = (a, b) => (a.importance === 'must' ? 0 : 1) - (b.importance === 'must' ? 0 : 1);
const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));

/** What a locked card shows: its kind and label, never its text. */
export const lockedStub = (card) => ({ id: card.id, kind: card.kind, label: KIND_LABELS[card.kind] || 'Card', locked: true });

/**
 * The taste cards of each chapter: its first `tastePerChapter` Must-know cards in book order (`order`, then id). Good-to-know
 * cards are never in the taste (they are added only by a Pro student's choice), so a chapter with fewer Must-know cards has
 * a smaller taste. One rule for the server, the web fixtures and the app: data/keycards/fixtures/taste.json pins it
 * (code review L10).
 */
export function tasteIds(cards, per = KEYCARD_RULES.free.tastePerChapter) {
  const byChapter = new Map();
  for (const c of cards || []) {
    if (!c?.id || c.importance !== 'must') continue;
    const list = byChapter.get(c.chapterKey) || [];
    list.push(c);
    byChapter.set(c.chapterKey, list);
  }
  const out = new Set();
  for (const list of byChapter.values()) {
    const picked = [...list].sort(bookOrder).slice(0, per);
    for (const c of picked) out.add(c.id);
  }
  return out;
}

/** The deck as a student sees it, in book order. Free: the taste cards whole, the rest as locked stubs. Pro: everything. */
export function deckView(cards, { isPro = false } = {}) {
  const sorted = [...(cards || [])].filter((c) => c?.id).sort(bookOrder);
  if (isPro) return sorted;
  const open = tasteIds(sorted);
  return sorted.map((c) => (open.has(c.id) ? c : lockedStub(c)));
}

/** The cards one "Add chapter" adds: Pro, every Must-know card of the chapter; Free, only its taste cards. */
export function chapterAddSet(cards, chapterKey, { isPro = false } = {}) {
  const chapter = (cards || []).filter((c) => c?.chapterKey === chapterKey).sort(bookOrder);
  if (isPro) return chapter.filter((c) => c.importance === 'must');
  const taste = tasteIds(chapter);
  return chapter.filter((c) => taste.has(c.id));
}

/** May this student add this card on their own? Free: taste cards only. Pro: anything published. */
export function canAdd(card, allCards, { isPro = false } = {}) {
  if (!card) return false;
  if (isPro) return true;
  return tasteIds((allCards || []).filter((c) => c.chapterKey === card.chapterKey)).has(card.id);
}

/** Whole days from `now` to the exam horizon, at least 1: the longest interval FSRS may give. */
export function horizonDays(now, horizon = KEYCARD_RULES.examHorizon) {
  const end = Date.parse(`${horizon}T23:59:59+05:30`);
  return Math.max(1, Math.floor((end - time(now)) / DAY));
}

const ratingOf = (r) => (r === 1 ? Rating.Again : r === 3 ? Rating.Good : r === 4 ? Rating.Easy : null);
const schedulers = new Map();
function schedulerFor(maxDays) {
  if (!schedulers.has(maxDays)) schedulers.set(maxDays, fsrs({ request_retention: KEYCARD_RULES.retention, maximum_interval: maxDays, enable_fuzz: false, enable_short_term: false }));
  return schedulers.get(maxDays);
}
const revive = (s) => ({ ...s, due: new Date(s.due), ...(s.last_review ? { last_review: new Date(s.last_review) } : {}) });

/** A fresh schedule for a card just added (FSRS "new", due now). */
export const newSchedule = (now) => JSON.parse(JSON.stringify(createEmptyCard(new Date(time(now)))));

/**
 * One review. `state` is the stored row ({ schedule, reps, lapses } or null for a card never scheduled); `rating` 1 (Missed),
 * 3 (Got it) or 4 (Easy). Returns { schedule, due_at, interval_days, reps, lapses, scheduled_days, elapsed_days }.
 * The interval never passes the exam horizon.
 */
export function schedule(state, rating, now) {
  const r = ratingOf(rating);
  if (r === null) throw new Error('INVALID_RATING');
  const at = new Date(time(now));
  const maxDays = horizonDays(at);
  const card = state?.schedule ? revive(state.schedule) : createEmptyCard(at);
  const { card: next, log } = schedulerFor(maxDays).next(card, at, r);
  let due = next.due.getTime();
  const cap = at.getTime() + maxDays * DAY;
  if (due > cap) due = cap; // belt and braces: ts-fsrs already caps scheduled_days at maximum_interval
  const schedule_ = JSON.parse(JSON.stringify({ ...next, due: new Date(due) }));
  return {
    schedule: schedule_,
    due_at: new Date(due).toISOString(),
    interval_days: Math.round(((due - at.getTime()) / DAY) * 100) / 100,
    reps: (Number(state?.reps) || 0) + 1,
    lapses: (Number(state?.lapses) || 0) + Math.max(0, (Number(next.lapses) || 0) - (Number(card.lapses) || 0)),
    scheduled_days: next.scheduled_days,
    elapsed_days: log.elapsed_days,
  };
}

/** FSRS retrievability of a stored schedule at `now` (0..1), or null for a card never reviewed. */
export function retrievability(stateRow, now) {
  const s = stateRow?.schedule;
  if (!s || !(Number(stateRow.reps) > 0) || !s.last_review || !(s.stability > 0)) return null;
  return schedulerFor(36500).get_retrievability(revive(s), new Date(time(now)), false);
}

/**
 * Today's queue. `states` are the student's key_card_states rows; `cardsById` the published cards.
 *   1. due cards (reviewed before, due_at <= now): Must-know first, then oldest due first
 *   2. then new cards (added, never reviewed) in book order, up to `newAllowanceLeft`: chapter by chapter
 *      (`chapterRank(chapterKey)`, the syllabus order; without it subject then chapter key), then the card's order in
 *      its chapter. A card's `order` restarts in every chapter, so sorting by it alone interleaved chapters.
 * New cards pause while more than `overduePauseNew` cards are overdue. Suspended cards and cards no longer published are
 * skipped. Returns { items: [{ card, state, isNew }], due, overdue, newShown, paused }.
 */
export function dueQueue(states, cardsById, { now, isPro = false, newAllowanceLeft = Infinity, limit = 20, chapterRank = null } = {}) {
  const at = time(now);
  const get = (id) => (cardsById instanceof Map ? cardsById.get(id) : cardsById?.[id]);
  const live = (states || []).filter((s) => s && !s.suspended && get(s.card_id));
  const reviewed = live.filter((s) => Number(s.reps) > 0);
  const due = reviewed.filter((s) => time(s.due_at) <= at)
    .sort((a, b) => mustFirst(get(a.card_id), get(b.card_id)) || time(a.due_at) - time(b.due_at) || String(a.card_id).localeCompare(String(b.card_id)));
  const paused = due.length > KEYCARD_RULES.overduePauseNew;
  const room = Math.max(0, Math.min(Number.isFinite(newAllowanceLeft) ? newAllowanceLeft : Infinity, isPro ? Infinity : KEYCARD_RULES.free.newPerDay));
  const rankOf = typeof chapterRank === 'function' ? (c) => Number(chapterRank(c.chapterKey) ?? Number.MAX_SAFE_INTEGER) : () => 0;
  const chapterOrder = (a, b) => (rankOf(a) - rankOf(b)) || String(a.subject ?? '').localeCompare(String(b.subject ?? '')) || String(a.chapterKey ?? '').localeCompare(String(b.chapterKey ?? ''));
  const fresh = paused ? [] : live.filter((s) => !(Number(s.reps) > 0))
    .sort((a, b) => chapterOrder(get(a.card_id), get(b.card_id)) || bookOrder(get(a.card_id), get(b.card_id)) || time(a.added_at) - time(b.added_at))
    .slice(0, room === Infinity ? undefined : room);
  const cap = limit === Infinity ? Infinity : Math.max(0, Number.isFinite(Number(limit)) ? Number(limit) : 20);
  const items = [...due.map((s) => ({ card: get(s.card_id), state: s, isNew: false })), ...fresh.map((s) => ({ card: get(s.card_id), state: s, isNew: true }))].slice(0, cap);
  return { items, due: due.length, overdue: due.length, newShown: items.filter((i) => i.isNew).length, paused };
}

/** Minutes for `n` cards at 15 seconds a card, rounded up to a whole minute (0 for none). */
export const cardMinutes = (n) => (n > 0 ? Math.ceil(n * KEYCARD_RULES.minutesPerCard) : 0);

const STOPWORDS = new Set(('a an and are as at be been being but by can could did do does for from had has have he her his how i if in into is it its '
  + 'may might more most must no not of on or our shall should so such than that the their them then there these they this those to was we were what '
  + 'when where which while who whom why will with would you your also any all each other only own same some very one two three per under over about '
  + 'between both after before during above below up down out off again further once here following given correct option options statement statements '
  + 'true false choose select answer question').split(/\s+/));
export const isStopword = (w) => STOPWORDS.has(String(w).toLowerCase());
const tokens = (text) => new Set(String(text ?? '').toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOPWORDS.has(w)));

// The lexical fallback of "The line you needed": a card matches when at least `minShared` content words of its quote are in
// the question text and they are at least `minScore` of the quote's words. English Must-know quotes are mostly one or two
// words, so a share alone let one generic word match (code review L5).
export const LINE_MATCH = Object.freeze({ minScore: 0.35, minShared: 3 });

/** Content words of the card quote that also appear in the question text: { shared, words, score } (score 0..1). */
export function overlap(questionText, quote) {
  const q = tokens(questionText);
  const c = tokens(quote);
  if (!c.size || !q.size) return { shared: 0, words: c.size, score: 0 };
  let shared = 0;
  for (const w of c) if (q.has(w)) shared += 1;
  return { shared, words: c.size, score: shared / c.size };
}

/** Share of the card quote's tokens that also appear in the question text (0..1). */
export const overlapScore = (questionText, quote) => overlap(questionText, quote).score;

/**
 * "The line you needed" for a question answered wrong. Precomputed links first; otherwise the lexical match over the
 * Must-know cards of the question's chapter (top 2 with at least 3 shared content words, at least 0.35 of the quote's);
 * otherwise nothing.
 *   fallback = { chapterKey, text } (question stem + explanation), or null
 * Returns { cards, source: 'linked' | 'matched' | 'none' }.
 */
export function lineNeeded(questionId, links, cardsById, fallback = null) {
  const get = (id) => (cardsById instanceof Map ? cardsById.get(id) : cardsById?.[id]);
  const linked = (links?.[questionId] || []).map(get).filter(Boolean).slice(0, 2);
  if (linked.length) return { cards: linked, source: 'linked' };
  if (!fallback?.chapterKey || !fallback?.text) return { cards: [], source: 'none' };
  const all = cardsById instanceof Map ? [...cardsById.values()] : Object.values(cardsById || {});
  const scored = all.filter((c) => c.chapterKey === fallback.chapterKey && c.importance === 'must' && c.quote)
    .map((c) => ({ c, o: overlap(fallback.text, c.quote) }))
    .filter((x) => x.o.shared >= LINE_MATCH.minShared && x.o.score >= LINE_MATCH.minScore)
    .map((x) => ({ c: x.c, s: x.o.score }))
    .sort((a, b) => b.s - a.s || bookOrder(a.c, b.c))
    .slice(0, 2)
    .map((x) => x.c);
  return scored.length ? { cards: scored, source: 'matched' } : { cards: [], source: 'none' };
}

/** Among the chapter's added Must-know cards, how many FSRS says are holding today (retrievability at least 0.9). */
export function memoryShare(states, chapterCards, now) {
  const must = (chapterCards || []).filter((c) => c.importance === 'must');
  const mustIds = new Set(must.map((c) => c.id));
  const added = (states || []).filter((s) => mustIds.has(s.card_id) && !s.suspended);
  const holding = added.filter((s) => (retrievability(s, now) ?? 0) >= KEYCARD_RULES.retention).length;
  return { holding, added: added.length, mustKnow: must.length };
}

/** Free allowance kinds in learning_allowances (period = the IST day + a slot number). */
export const ALLOWANCE = Object.freeze({ review: 'keycard_review', fresh: 'keycard_new', line: 'keycard_line' });

/** Clamp a client review time to [now - 48 h, now]; null when absent or unreadable. */
export function clampClientTime(value, now) {
  const t = time(value);
  if (t === null || value === undefined || value === null || value === '') return null;
  const at = time(now);
  return new Date(Math.min(at, Math.max(at - 2 * DAY, t))).toISOString();
}
