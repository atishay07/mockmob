// Learn v2 on the server: one injectable service for every /api/learn route (docs/brain/learn-1031/BUILD-1101.md Parts 1
// and 2; the plan is docs/brain/learn-1031/audit-1101/A6-wiring.md). The Key cards pattern: createLearn(deps) answers
// { http, body } from every handler; production wires Supabase and the real caches through learnHttp.js, while the tests and
// the development preview (learnPreview.js) run the SAME code over the in-memory client (keycardsMemoryDb.js).
// No 'server-only' and no '@/' imports, so node:test drives it. No paid model call anywhere here.
//
// Every handler reads one snapshot of the student per request (A6 section 3) and computes every chapter from it in memory:
// a request costs the same reads whether the subject has 2 chapters or 20.
//
// deps:
//   db                  Supabase-like client (the store, learnStore.js, holds every query)
//   kc                  the Key cards service (createKeycards): review(userId, body, { clientKey, withToday, me }),
//                       add(userId, { cardIds, addedFrom }), dueCount(userId), published() when it exports it
//   decks, syllabus     loadDecks() and the keycardsSyllabus.js adapter
//   getUser(id)         -> { isPremium, subjects } (fresh, never an auth cache)
//   questionIndex(subject) -> { list: [{ id, subject, chapter, chapterKey, body, options, words, difficulty, cards, chash,
//                       managed, family, concept }] } (no key, no explanation)
//   verifyRows(ids)     -> Set of the managed ids that pass a check on their fresh full rows (optional: all pass)
//   lessonsFor(userId, subject) -> [{ id, chapterKey, title, minutes, read }] in catalog order (optional: none)
//   heldQuestions(userId) -> Set of question ids of a Mob paper still open (throws: every question is refused, fail closed)
//   mistakePlaces(userId, subject, questionIds) -> Map(qid -> 'Mock 3') (optional; the paper a mistake was made in)
//   lessonTitles        PART_TITLES override (optional)
//   now(), newId()      clock (ms) and run ids
import { createHash, randomBytes } from 'node:crypto';
import { KIND_LABELS, KEYCARD_RULES, istDay, lineNeeded, lockedStub, memoryShare, tasteIds } from '../../../data/keycards.js';
import { stateFor, tallyChapters } from '../../../data/chapter_state.js';
import { getCanonicalSubject, isTopSubject } from '../../../data/canonical_syllabus.js';
import { LEARN_RULES, budgetSeconds, composeRun, dryRun, minutesFor, cardStage, mistakeLabel } from '../../../data/learn/compose.js';
import { suggestions, endOptions, cardRunMinutes, fixMinutes, recapMinutes } from '../../../data/learn/suggest.js';
import { searchSubject } from '../../../data/learn/search.js';
import { ROADMAP_RULES, roadmap as roadmapOf, verdictOf } from '../../../data/learn/roadmap.js';
import { IN_RUN, doneLine, istDaysBetween, levelPick, movedLine, retryReady, returnDay, revisePileGroups, shortDate } from '../../../data/learn/stamps.js';
import { FEED_RULES, coverOrder, feedEndLines, keptLine } from '../../../data/learn/feed.js';
import { LEARN_FREE, FREE_SESSION_DONE, FREE_END_LINE, FREE_CAPPED, FREE_CARDS_ONLY, freeSession, isCounted } from '../../../data/learn/allowance.js';
import { WORDS, reviseDue, withMinutes } from '../../../data/learn/words.js';
import { cardSeconds, cardWords, itemSeconds, questionSeconds } from '../../../data/learn/seconds.js';
import { gradeCard, istDate, planSeeds } from '../../../data/revise.js';
import { createLearnStore } from './learnStore.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ok = (body) => ({ http: 200, body });
const bad = (error, http = 422, extra = {}) => ({ http, body: { error, ...extra } });
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });

// ---------------------------------------------------------------- the rules and the words (BUILD-1101 Part 1)

/** LK15: Free's one Learn session a day (BUILD-1101 1.6): the rule and its lines live in data/learn/allowance.js. */
export { LEARN_FREE, FREE_SESSION_DONE, FREE_END_LINE, FREE_CAPPED, FREE_CARDS_ONLY };
export const LOCKED_LINE = 'The line for this is in a card that is part of Pro.';
export const LOOKS_TEXT = Object.freeze({
  keycard_reviews: "Today's 10 free card ratings are used. The rest of your cards show without ratings.",
  keycard_new: "Today's 5 new free cards are used. The rest of your cards show without ratings.",
});
export const LEARN_LIMITS = Object.freeze({ seenFeedDays: 60, seenFeedRuns: 40, resumeHours: 24, answerHours: 48, restDays: 3, missedDays: 7, maxCardIds: 100, requestKey: /^[A-Za-z0-9_-]{8,100}$/ });
const STATE_KEYS = Object.freeze({ none: 'none', thin: 'thin', weak: 'needs_work', mid: 'getting_there', strong: 'holding', unknown: 'unknown' });
export const PART_TITLES = Object.freeze({
  'Accountancy Part 1': 'Part 1, Partnership Accounts',
  'Accountancy Part 2': 'Part 2, Company Accounts and Analysis of Financial Statements',
});
const ENGLISH_NOTE = 'English cards are written for MockMob, not taken from an NCERT book.';
const KINDS = Object.freeze(['mix', 'recap', 'cards', 'feed', 'level']);
const PILES = Object.freeze(['cards', 'questions', 'mistakes', 'lesson']);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const minutesWord = (n) => plural(n, 'minute');
const iso = (t) => new Date(t).toISOString();
const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;
const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));
/** A chapter title as the book prints it: "Retirement/Death of a Partner" is "Retirement and Death of a Partner" (A10). */
export const cleanTitle = (title) => String(title || '').replace(/\s*\/\s*/g, ' and ').replace(/\s+/g, ' ').trim();
/** "Economics / Business Economics" is "Economics" on Learn (no slashes in names, A10). */
export const subjectName = (id) => String(getCanonicalSubject(id)?.subject_name || id).split(/\s*\/\s*/)[0];
/** The replay key of one item's card review: 'learn:' + sha256(runId:itemId), 46 characters (fits client_key's 100). */
export const clientKeyOf = (runId, itemId) => `learn:${createHash('sha256').update(`${runId}:${itemId}`).digest('hex').slice(0, 40)}`;
/** A run's id: 'lr_' and 24 hex characters. */
export const newRunId = () => `lr_${randomBytes(12).toString('hex')}`;

/** An item's seconds: its own (every composed item carries them, BUILD-1101 1.5), else the rule of data/learn/seconds.js. */
export const secondsOf = (item) => itemSeconds(item);

/** The return-day stamp, with "Due now" for a card due at or before now (A5 R16, data/learn/stamps.js). */
export function stampOf(dueAt, now) {
  if (!dueAt) return null;
  return returnDay(dueAt, now).stamp;
}

/** "Back on Wed", "Back tomorrow", "Back in 7 days" for a Revise due day ('YYYY-MM-DD', India). */
function backOn(dueDay, now) {
  const at = Date.parse(`${dueDay}T09:00:00+05:30`);
  const r = returnDay(at, now);
  return r.days >= 2 && r.days < 7 ? `Back on ${r.stamp.slice(5)}` : r.stamp;
}

/** One label of a mistake (A5 R10.3): "You missed this in Mock 4 on 24 Oct", "You missed this yesterday". */
export function mistakeText(where, at, now) {
  const paper = where && !['Learn', 'Explore feed'].includes(where);
  if (paper) return mistakeLabel(where, shortDate(at));
  if (Number.isFinite(at) && istDaysBetween(at, now) === 1) return 'You missed this yesterday';
  if (where) return mistakeLabel(where, shortDate(at));
  return mistakeLabel(null, Number.isFinite(at) ? shortDate(at) : null);
}

/** Options as served: the stored ones, with a repeated "A. " stripped only when every option has it. */
export function servedOptions(raw) {
  let parsed = raw;
  if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch { parsed = []; } }
  const list = (Array.isArray(parsed) ? parsed : []).map((o, i) => (typeof o === 'string' ? { key: 'ABCD'[i], text: o } : { key: String(o?.key ?? 'ABCD'[i]).trim().toUpperCase(), text: String(o?.text ?? o?.label ?? o?.value ?? '') }));
  const prefixed = list.length > 0 && list.every((o) => new RegExp(`^${o.key}[.)]?\\s`).test(o.text || ''));
  return list.map((o) => ({ key: o.key, text: prefixed ? o.text.replace(new RegExp(`^${o.key}[.)]?\\s+`), '') : o.text }));
}

/** The served key letter of a live row: the index the row names (correct_index or correct_answer), as a served key. */
export function keyLetter(row, options = servedOptions(row?.options)) {
  const idx = [row?.correct_index, row?.correctIndex].map(Number).find((n) => Number.isInteger(n) && n >= 0 && n < options.length);
  if (idx !== undefined) return options[idx].key;
  const raw = String(row?.correct_answer ?? '').trim().toUpperCase().replace(/^OPTION[_\s-]*/, '').replace(/[).:]+$/, '');
  if (options.some((o) => o.key === raw)) return raw;
  const text = String(row?.correct_answer ?? '').trim().toLowerCase();
  return options.find((o) => o.text.trim().toLowerCase() === text)?.key || null;
}
const explanationOf = (row) => (typeof row?.explanation === 'string' ? row.explanation : row?.explanation?.text || '');
const changeStamp = (row) => String(row?.content_hash || row?.updated_at || '');
const liveRow = (row) => Boolean(row) && !row.is_deleted && (row.status === undefined || row.status === 'live') && row.verification_state !== 'disputed';

// ---------------------------------------------------------------- the service

export function createLearn(deps) {
  const {
    db, kc, decks, syllabus, getUser, questionIndex, verifyRows = null, lessonsFor = null, heldQuestions = null,
    mistakePlaces = null, now = () => Date.now(), newId = newRunId, partTitles = PART_TITLES, warn = console.warn,
  } = deps;
  const store = deps.store || createLearnStore(db, { now, warn });

  // ---- content: the published cards (cards suspended for everyone stay out, A6 4.1)
  async function published() {
    if (typeof kc?.published === 'function') {
      const pub = await kc.published();
      return { byId: pub.byId, cardsOf: pub.cardsOf, taste: pub.taste };
    }
    let taste = null;
    return {
      byId: decks.byId,
      cardsOf: (subject) => decks.bySubject.get(subject)?.cards || [],
      taste: () => taste || (taste = tasteIds([...decks.byId.values()])),
    };
  }

  async function who(userId) {
    const user = await getUser(userId);
    if (!user) throw fail('LEARN_UNAVAILABLE', new Error('user unread'));
    return { isPro: user.isPremium === true, subjects: Array.isArray(user.subjects) ? user.subjects.filter(isTopSubject) : [] };
  }

  /** The student's subjects that Learn can serve (a deck or a question pool), and the default one. */
  function subjectsOf(me) {
    return me.subjects.filter((s) => decks.bySubject.has(s) || syllabus.unitsFor(s, {}).length > 0);
  }
  function pickSubject(me, asked) {
    const own = subjectsOf(me);
    if (asked) return own.includes(asked) || decks.bySubject.has(asked) ? asked : null;
    return own[0] || null;
  }

  // ---------------------------------------------------------------- the per-request snapshot (A6 section 3)

  /**
   * Everything one request needs about one subject, read once in parallel. Throws LEARN_UNAVAILABLE when the plan, the card
   * states, the answered progress or today's allowances cannot be read (a 503, never a zero).
   */
  async function snapshot(userId, meIn, subject, { feeds = false, seen: wantSeen = false } = {}) {
    const t = now();
    const day = istDay(t);
    const held = heldQuestions
      ? heldQuestions(userId).then((qids) => ({ qids: qids instanceof Set ? qids : new Set(qids || []), failed: false }), () => ({ qids: new Set(), failed: true }))
      : Promise.resolve({ qids: new Set(), failed: false });
    // speed.md item 5b: the student's plan is read in the same round as everything else (`meIn` may be who()'s promise).
    const [me, options, pub, states, progress, allowances, runs, heldOut, index, lessons, revise, recentFeeds, seenFeeds] = await Promise.all([
      Promise.resolve(meIn),
      store.options(userId), published(), store.states(userId, { subject }), store.progress(userId, subject), store.allowances(userId, day),
      store.openRuns(userId, { hours: LEARN_LIMITS.resumeHours }), held,
      Promise.resolve(questionIndex(subject)).catch((e) => { throw fail('LEARN_UNAVAILABLE', e); }),
      lessonsFor ? Promise.resolve(lessonsFor(userId, subject)).catch(() => []) : Promise.resolve([]),
      store.reviseCards(userId),
      feeds ? store.recentFeeds(userId, { days: LEARN_LIMITS.restDays }) : Promise.resolve([]),
      // R2 ruling 3: cards moved past in an Explore feed count as seen on the roadmap (a longer window than the feed's 3-day rest).
      wantSeen ? store.recentFeeds(userId, { days: LEARN_LIMITS.seenFeedDays, limit: LEARN_LIMITS.seenFeedRuns }) : Promise.resolve([]),
    ]);
    const S = { userId, isPro: me.isPro, subjects: subjectsOf(me), subject, now: t, day, options, option: options.get(subject) || null, pub, states, progress, allowances, runs, held: heldOut, lessons: lessons || [] };
    S.stateMap = new Map(states.map((s) => [s.card_id, s]));
    S.tally = tallyChapters(progress, syllabus.resolveChapter);
    S.cards = pub.cardsOf(subject);
    S.taste = me.isPro ? null : tasteIds(S.cards);
    S.isOpen = (id) => me.isPro || S.taste.has(id);
    // Questions: the index less the held ones; a failed hold read refuses every question (fail closed, A6 R4).
    const list = (index?.list || []).filter((q) => q && q.id && q.chapterKey);
    S.questionsById = new Map(list.map((q) => [q.id, q]));
    S.servable = (id) => !S.held.failed && !S.held.qids.has(id) && S.questionsById.has(id);
    const seen = new Set(progress.filter((r) => Number(r.attempt_count) > 0).map((r) => r.question_id));
    S.byChapter = new Map();
    for (const q of list) {
      if (!S.servable(q.id)) continue;
      const row = { id: q.id, difficulty: q.difficulty || null, cards: q.cards || [], seen: seen.has(q.id), words: Number(q.words) || wordCount(q.body), ...(q.family ? { family: q.family } : {}), ...(q.concept ? { concept: q.concept } : {}) };
      S.byChapter.set(q.chapterKey, [...(S.byChapter.get(q.chapterKey) || []), row]);
    }
    S.mistakes = openMistakes(S, revise);
    S.allowanceUsed = (kind) => allowances.filter((r) => r.kind === kind).length;
    S.ratingsLeft = me.isPro ? null : Math.max(0, KEYCARD_RULES.free.reviewsPerDay - S.allowanceUsed('keycard_review'));
    S.newLeft = me.isPro ? null : Math.max(0, KEYCARD_RULES.free.newPerDay - S.allowanceUsed('keycard_new'));
    S.session = me.isPro ? null : allowances.find((r) => r.kind === 'learn_session') || null;
    S.recentFeeds = recentFeeds;
    S.feedReach = new Map();
    // speed.md item 5c: the feed's shown cards and the mistakes' places are read together.
    const subjectFeeds = (list_) => (list_ || []).filter((f) => String(f.chapter_key || '').split('.')[0] === subject);
    const [shownAt, feedSeen, places] = await Promise.all([
      feeds ? shownCards(recentFeeds, S.feedReach) : Promise.resolve(new Map()),
      wantSeen ? shownCards(subjectFeeds(seenFeeds)) : Promise.resolve(new Map()),
      mistakePlaces ? Promise.resolve().then(() => mistakePlaces(userId, subject, [...S.mistakes.values()].flat().map((m) => m.id))).catch(() => null) : Promise.resolve(null),
    ]);
    S.shownAt = shownAt;
    S.feedSeen = feedSeen;
    if (mistakePlaces) {
      // A failed read leaves the place unknown: "You missed this on 16 Oct".
      for (const list_ of S.mistakes.values()) for (const m of list_) if (places?.get?.(m.id)) m.where = places.get(m.id);
      for (const list_ of S.mistakes.values()) for (const m of list_) m.label = mistakeText(m.where, m.at, t);
    }
    return S;
  }

  /**
   * Open mistakes per chapter (BUILD-1101 1.8 R10): the student's Revise question cards that are due (state 'active',
   * due_day today or earlier), together with the ones Revise will seed from the progress rows (planSeeds: box 1, due the
   * day after the wrong answer). A mistake made today rests a day. Oldest first. Only servable questions.
   */
  function openMistakes(S, stored) {
    const cards = Array.isArray(stored) ? stored : [];
    const virtual = new Map(cards.map((c) => [c.question_id, { ...c, stored: true }]));
    for (const row of planSeeds({ progress: S.progress, cards })) virtual.set(row.question_id, { ...(virtual.get(row.question_id) || {}), ...row, stored: virtual.has(row.question_id) });
    const today = istDate(S.now);
    const lastAt = new Map(S.progress.map((r) => [r.question_id, Date.parse(r.last_attempted_at)]));
    S.reviseCards = virtual;
    const out = new Map();
    for (const card of virtual.values()) {
      if (card.state !== 'active' || !(card.due_day <= today) || !S.servable(card.question_id)) continue;
      const q = S.questionsById.get(card.question_id);
      const at = Number.isFinite(lastAt.get(card.question_id)) ? lastAt.get(card.question_id) : Date.parse(card.wrong_at);
      // R10.1: retried in Learn only from an earlier India day (a miss made today rests a day).
      if (Number.isFinite(at) && !retryReady(at, S.now)) continue;
      const m = { id: q.id, chapterKey: q.chapterKey, at: Number.isFinite(at) ? at : null, when: Number.isFinite(at) ? shortDate(at) : null, where: null };
      m.label = mistakeText(null, m.at, S.now);
      out.set(q.chapterKey, [...(out.get(q.chapterKey) || []), m]);
    }
    for (const list of out.values()) list.sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || a.id.localeCompare(b.id));
    return out;
  }

  /**
   * When each card was last shown in a feed of the last 3 days (BUILD-1101 1.2): a card item counts as shown at the time of
   * the first event on a later item of its run (an answer, a Keep, a look); the cards before the last item acted on.
   */
  async function shownCards(feeds, reach = new Map()) {
    const shown = new Map();
    if (!feeds.length) return shown;
    let events = [];
    try { events = await store.eventsOf(feeds.map((f) => f.id)); } catch { return shown; }
    const byRun = new Map();
    for (const e of events) byRun.set(e.run_id, [...(byRun.get(e.run_id) || []), e]);
    for (const run of feeds) {
      const items = Array.isArray(run.items) ? run.items : [];
      const at = new Map(items.map((it, i) => [it.id, i]));
      const acted = (byRun.get(run.id) || []).map((e) => ({ i: at.get(e.item_id), t: Date.parse(e.created_at) })).filter((x) => Number.isInteger(x.i));
      reach.set(run.id, acted.length ? Math.max(...acted.map((x) => x.i)) + 1 : 0);
      items.forEach((it, i) => {
        if (it.type !== 'card' || !it.cardId) return;
        const later = acted.filter((x) => x.i > i).map((x) => x.t).filter(Number.isFinite);
        if (!later.length) return;
        const t = Math.min(...later);
        if (!shown.has(it.cardId) || shown.get(it.cardId) < t) shown.set(it.cardId, t);
      });
    }
    return shown;
  }

  // ---------------------------------------------------------------- chapters

  function subjectChapters(subject) {
    return syllabus.unitsFor(subject, {}).flatMap((u) => u.chapters.map((ch) => ({ ...ch, unitTitle: u.unit })));
  }
  function allowedChapters(S) {
    return subjectChapters(S.subject).filter((ch) => syllabus.sectionAllowed(S.subject, ch.section, S.option));
  }
  const hasPlay = (S, key) => S.cards.some((x) => x.chapterKey === key) || (S.byChapter.get(key) || []).length > 0;
  const refOf = (ch) => (ch?.ncert?.chapter ? `Ch ${ch.ncert.chapter}` : null);
  function nextChapterOf(S, key) {
    const list = allowedChapters(S);
    const at = list.findIndex((ch) => ch.key === key);
    const next = list.slice(at + 1).find((ch) => hasPlay(S, ch.key));
    return next ? { key: next.key, title: cleanTitle(next.title || next.name), ref: refOf(next) } : null;
  }
  /** The chapter's lesson (R11): its first unread lesson in catalog order, else its first (read) one. */
  function lessonOf(S, key) {
    const list = S.lessons.filter((l) => l.chapterKey === key);
    const l = list.find((x) => !x.read) || list[0] || null;
    return l ? { id: l.id, title: l.title, minutes: l.minutes, read: Boolean(l.read) } : null;
  }

  function unfinished(S, key = null, kinds = ['mix', 'cards']) {
    return S.runs.filter((r) => kinds.includes(r.kind) && (!key || r.chapter_key === key)
      && S.now - Date.parse(r.created_at) < LEARN_LIMITS.resumeHours * HOUR && Number(r.done_count) > 0 && Number(r.done_count) < Number(r.item_count))[0] || null;
  }

  /** Everything Learn knows about one chapter for this student, from the snapshot. */
  function chapterInfo(S, key) {
    const ch = syllabus.chapterByKey(key);
    if (!ch || ch.retired || key.split('.')[0] !== S.subject) return null;
    const all = S.cards.filter((x) => x.chapterKey === key).sort(bookOrder);
    const taste = tasteIds(all);
    const open = S.isPro ? all : all.filter((x) => taste.has(x.id));
    const states = new Map(S.states.filter((s) => s.chapter_key === key).map((s) => [s.card_id, s]));
    const questions = S.byChapter.get(key) || [];
    const mistakes = (S.mistakes.get(key) || []).map((m) => ({ id: m.id, where: m.where, when: m.when, at: m.at, label: m.label }));
    const lesson = lessonOf(S, key);
    const mine = all.map((x) => states.get(x.id)).filter(Boolean);
    const due = open.filter((x) => cardStage(states.get(x.id), S.now) === 'due');
    const inRevise = open.filter((x) => { const s = states.get(x.id); return s && !s.suspended; }).length;
    const tally = S.tally.get(key) || { n: 0, right: 0, lastAt: null };
    const memory = mine.length ? memoryShare(mine, all, S.now) : null;
    const reviewed = mine.map((s) => Date.parse(s.last_review_at)).filter(Number.isFinite);
    const last = [tally.lastAt, ...reviewed].filter((x) => x !== null && Number.isFinite(x));
    const st = stateFor({ n: tally.n, right: tally.right, memory, lastActivityAt: last.length ? Math.max(...last) : null, now: S.now });
    // The roadmap (R2 rulings 2 and 3): an open card is seen once it has a state row or was moved past in an Explore feed; the
    // chapter's latest Learn activity is its newest card review, feed showing or unfinished run (never a mock answer).
    const feedSeen = S.feedSeen || new Map();
    const seenCards = open.filter((x) => states.has(x.id) || feedSeen.has(x.id));
    const run = unfinished(S, key);
    const learnTimes = [
      ...reviewed,
      ...all.map((x) => feedSeen.get(x.id)).filter(Number.isFinite),
      ...(run ? [Date.parse(run.created_at)] : []),
    ].filter(Number.isFinite);
    return {
      key, subject: S.subject, ch, title: cleanTitle(ch.title || ch.name), name: ch.name, unit: ch.unit, section: ch.section || null,
      ref: ch.ncert?.chapter ? `Ch ${ch.ncert.chapter}` : null, chapterNo: ch.ncert?.chapter || null, book: ch.ncert?.book || null,
      all, open, taste, states, questions, mistakes, lesson,
      counts: {
        cards: all.length, open: open.length, mustKnow: all.filter((x) => x.importance === 'must').length, openMust: open.filter((x) => x.importance === 'must').length,
        due: due.length, inRevise, kept: mine.filter((s) => !s.suspended && s.added_from === 'manual').length,
      },
      dueIds: due.map((x) => x.id),
      linkedQuestions: questions.filter((q) => q.cards.some((id) => all.some((x) => x.id === id))).length,
      state: { key: STATE_KEYS[st.state] || 'unknown', label: st.fading ? `${st.label}, fading` : st.label },
      studied: tally.n > 0 || mine.some((s) => Number(s.reps) > 0),
      lastActivityAt: last.length ? Math.max(...last) : null,
      tally, memory, run,
      coverage: { of: open.length, seen: seenCards.length, unseen: open.length - seenCards.length, questions: questions.length, tried: questions.filter((q) => q.seen).length },
      learnAt: learnTimes.length ? Math.max(...learnTimes) : null,
    };
  }

  function rowMeta(S, info) {
    if (!info.counts.cards) return info.questions.length ? 'No Key cards yet. Questions ready.' : 'No Key cards yet.';
    const parts = [];
    // R16: "today" only when the run is from today's India day.
    if (info.run) parts.push(doneLine(info.run.done_count, info.run.item_count, info.run.created_at, S.now));
    if (info.counts.due) parts.push(`${info.counts.due} due`);
    if (info.mistakes.length) parts.push(`${info.mistakes.length} open ${info.mistakes.length === 1 ? 'mistake' : 'mistakes'}`);
    if (info.lesson) parts.push('1 lesson');
    return parts.length ? parts.slice(0, 2).join(', ') : null;
  }
  function chapterRow(S, info) {
    return {
      key: info.key, title: info.title, ref: info.ref,
      cards: info.counts.cards, mustKnow: info.counts.mustKnow, due: info.counts.due, mistakes: info.mistakes.length, questions: info.questions.length,
      lesson: info.lesson, state: info.state, meta: rowMeta(S, info), marksOpen: null,
      // R2 ruling 2: coverage through the chapter (never mastery) and the one verdict word Learn lists may carry.
      progress: { ...info.coverage }, verdict: verdictOf(info.state.key), unit: info.unit || null,
    };
  }
  const unitTitleOf = (info) => {
    const unit = String(info.unit || '').trim();
    if (!unit) return null;
    const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return norm(info.title).startsWith(norm(unit)) ? null : unit;
  };
  const partTitleOf = (info) => partTitles[info.book] || info.book || null;

  // ---------------------------------------------------------------- composing

  function composeFor(S, info, { kind, minutes, leaveOut, cardIds = null, ratingsLeft = S.ratingsLeft }) {
    return composeRun({
      kind, minutes, leaveOut, cardIds, now: S.now,
      cards: info.open, states: info.states, questions: info.questions, mistakes: info.mistakes, lesson: info.lesson,
      ratingsLeft, newLeft: S.newLeft, shownAt: S.shownAt, overdue: S.overdue || 0,
      dueLooks: !S.isPro, // Free's returning feed: the cards it already holds show again as looks (BUILD-1101 F4)
    });
  }

  /**
   * "Today's 10 minutes" (R2 ruling 1, usefulness.md item 5): a mix on the roadmap chapter whose `cardIds` are due cards from any
   * chapter of the subject. The due cards play first, oldest due first, taking at most 40 percent of the time; the rest is the
   * chapter's own new cards and questions; one open mistake (the oldest, any chapter) plays second-last. A card that is not due,
   * not open or not in this subject is dropped here, whatever the link said.
   */
  function todayPlan(S, info, { minutes, leaveOut, cardIds, dropped }) {
    const budget = budgetSeconds(minutes);
    const cap = budget * ROADMAP_RULES.dueShare;
    const dueAt = (c) => Date.parse(S.stateMap.get(c.id)?.due_at) || 0;
    const due = [...new Set(cardIds)].map((id) => S.pub.byId.get(id))
      .filter((c) => c && S.isOpen(c.id) && String(c.chapterKey || '').split('.')[0] === S.subject && cardStage(S.stateMap.get(c.id), S.now) === 'due')
      .sort((a, b) => dueAt(a) - dueAt(b) || String(a.id).localeCompare(String(b.id)));
    const taken = [];
    let dueSecs = 0;
    for (const c of due) {
      const sec = cardSeconds({ stage: 'due', words: cardWords(c) });
      if (taken.length && dueSecs + sec > cap + 1e-6) break;
      taken.push(c);
      dueSecs += sec;
    }
    const left = S.ratingsLeft;
    let rated = 0;
    const dueItems = taken.map((c) => {
      const look = left !== null && left !== undefined && rated >= left;
      if (!look) rated += 1;
      return { type: 'card', cardId: c.id, stage: 'due', ...(look ? { look: true } : {}), mustKnow: c.importance === 'must', seconds: cardSeconds({ stage: 'due', look, words: cardWords(c) }) };
    });
    const takenIds = new Set(taken.map((c) => c.id));
    const restMinutes = Math.max(1, minutesFor(Math.max(0, budget - dueSecs)));
    const rest = composeFor(S, { ...info, open: info.open.filter((c) => !takenIds.has(c.id)), mistakes: [] }, {
      kind: 'mix', minutes: restMinutes, leaveOut, ratingsLeft: left === null || left === undefined ? left : Math.max(0, left - rated),
    });
    const m = leaveOut.includes('mistakes') || leaveOut.includes('questions') ? null
      : [...S.mistakes.values()].flat().filter((x) => !dropped.has(x.id) && S.questionsById.has(x.id)).sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || a.id.localeCompare(b.id))[0] || null;
    const q = m ? S.questionsById.get(m.id) : null;
    const mistakeItem = q ? {
      type: 'question', questionId: q.id, origin: 'mistake', links: q.cards || [], difficulty: q.difficulty || null,
      seconds: questionSeconds({ origin: 'mistake', words: q.words }), mistake: { where: m.where || null, when: m.when || null, label: m.label || null },
    } : null;
    const tail = rest.items;
    const body = mistakeItem ? (tail.length ? [...tail.slice(0, -1), mistakeItem, tail[tail.length - 1]] : [mistakeItem]) : tail;
    const items = [...dueItems, ...body];
    const seconds = items.reduce((sum, i) => sum + secondsOf(i), 0);
    return { ...rest, kind: 'mix', minutes, items, seconds, realMinutes: minutesFor(seconds), shrunk: false, shrink: null, today: { due: dueItems.length } };
  }

  /** R15: the student's overdue Key cards over every subject (the Key cards service's own count); 0 when unread. */
  async function overdueOf(userId) {
    if (typeof kc?.dueCount !== 'function') return 0;
    try { return Number(await kc.dueCount(userId)) || 0; } catch { return 0; }
  }

  /** The seconds Learn home's suggestions say for a chapter: its due cards, its open mistakes and its recap (R9.5). */
  function chapterSeconds(S, info) {
    const cards = (list, opts) => list.reduce((s, c) => s + cardSeconds({ ...opts, words: cardWords(c) }), 0);
    const must = (S.isPro ? info.all : info.open).filter((c) => c.importance === 'must');
    const mistakes = info.mistakes.reduce((s, m) => s + questionSeconds({ origin: 'mistake', words: S.questionsById.get(m.id)?.words }), 0);
    const due = new Set(info.dueIds);
    return { dueSeconds: cards(info.open.filter((c) => due.has(c.id)), { stage: 'due' }), recapSeconds: cards(must, { recap: true }), mistakeSeconds: mistakes };
  }

  /** "Add the next chapter" (B 4.3 rule 5, honest shrink): the next chapter fills the rest with its own recipe. */
  function withNext(S, info, plan, { kind, minutes, leaveOut }) {
    if (!plan.shrunk || !['mix', 'feed', 'cards'].includes(plan.kind)) return { plan, added: null };
    const next = nextChapterOf(S, info.key);
    const info2 = next ? chapterInfo(S, next.key) : null;
    const rest = minutes - plan.realMinutes;
    if (!info2 || rest < 1) return { plan, added: null };
    const more = composeFor(S, info2, { kind, minutes: rest, leaveOut });
    if (!more.items.length) return { plan, added: null };
    const sum = (id) => ({ count: plan.piles[id].count + more.piles[id].count, seconds: plan.piles[id].seconds + more.piles[id].seconds });
    const seconds = plan.seconds + more.seconds;
    const realMinutes = minutesFor(seconds);
    const available = Object.fromEntries(Object.keys(plan.available).map((k) => [k, plan.available[k] || more.available[k]]));
    return {
      plan: { ...plan, items: [...plan.items, ...more.items], seconds, realMinutes, shrunk: more.shrunk && realMinutes < minutes, shrink: more.shrunk && realMinutes < minutes ? more.shrink : null, available, piles: { cards: sum('cards'), questions: sum('questions'), mistakes: sum('mistakes'), lesson: sum('lesson') } },
      added: { key: info2.key, title: info2.title, ref: info2.ref },
    };
  }

  /** The questions of a level run: the first chapters in book order that have questions, until there are 6. */
  function levelPool(S) {
    const out = [];
    for (const ch of subjectChapters(S.subject)) {
      const qs = S.byChapter.get(ch.key) || [];
      if (!qs.length) continue;
      out.push(...qs);
      if (out.filter((q) => !q.seen).length >= LEARN_RULES.levelQuestions) break;
    }
    return out;
  }

  /**
   * LK15 on a start or a dry run (BUILD-1101 1.6), Free and a counted kind only:
   *   minutes over 10 are composed at 10, with `capped` (the line shows only then);
   *   a day already claimed by another run: a feed is refused (402), a chapter run is Key cards only.
   */
  function freeRule(S, { kind, minutes, ownRunId = null }) {
    const used = !S.isPro && isCounted(kind) && Boolean(S.session && S.session.reference !== ownRunId);
    const rule = freeSession({ isPro: S.isPro, claimedByOther: used, kind, minutes });
    return { minutes: rule.minutes, capped: rule.capped, used, cardsOnly: rule.cardsOnly, refuse: rule.refuse };
  }

  /**
   * The 402 of a feed start after the day is claimed (R3-SPEC ruling F): the line (FREE_SESSION_DONE is the headline and the
   * line), today's own run to continue (`resume`, when it is unfinished), and the Or rows that still work today, in order:
   * "Revise N due cards · M min" (a cards run, never counted) and "Answer single questions" (Explore stays free).
   */
  function sessionUsed(S, info, holder = null) {
    const options = [];
    const secs = info ? chapterSeconds(S, info) : null;
    if (info?.counts.due) {
      const m = cardRunMinutes(info.counts.due, secs.dueSeconds);
      options.push({ kind: 'revise', label: reviseDue(info.counts.due, m), minutes: m, run: { kind: 'cards', chapterKey: info.key, cardIds: info.dueIds.slice(0, LEARN_LIMITS.maxCardIds), minutes: m } });
    }
    options.push({ kind: 'explore', label: WORDS.singles, minutes: null, href: info ? `/explore?${new URLSearchParams({ subject: S.subject, chapter: info.name })}` : '/explore', go: 'explore' });
    const resume = holder && holder.of > holder.done ? { ...holder, label: withMinutes(WORDS.continue, holder.minutesLeft) } : null;
    return { http: 402, body: { error: 'FREE_SESSION_USED', reason: 'learn_session', line: FREE_SESSION_DONE, options, resume } };
  }

  // ---------------------------------------------------------------- runs on the wire

  function cardOf(S, id) { return S?.pub?.byId?.get(id) || decks.byId.get(id) || null; }

  /** A run row's start_state holds the chapter state, and what the start told the student (free, capped). */
  const metaOf = (row) => (row?.start_state && typeof row.start_state === 'object' ? row.start_state : {});

  async function questionsFor(S, row, ids) {
    const out = new Map();
    const index = S?.questionsById || null;
    const missing = [];
    for (const id of ids) {
      const q = index?.get(id);
      if (q) out.set(id, { id: q.id, body: q.body, options: q.options });
      else missing.push(id);
    }
    if (!missing.length) return out;
    let rows = [];
    try { rows = await store.questionContent(missing); } catch { rows = []; }
    for (const r of rows) out.set(r.id, { id: r.id, body: String(r.question || r.body || ''), options: servedOptions(r.options) });
    return out;
  }

  function publicItem(S, row, item, qmap, limited) {
    if (item.type === 'card') {
      return {
        id: item.id, type: 'card', stage: item.stage, card: cardOf(S, item.cardId), look: Boolean(item.look || limited), recap: Boolean(item.recap),
        seconds: secondsOf(item), ...(item.reason ? { reason: item.reason } : {}),
      };
    }
    if (item.type === 'question') {
      const q = qmap.get(item.questionId) || { id: item.questionId, body: '', options: [] };
      return { id: item.id, type: 'question', origin: item.origin, question: { id: q.id, body: q.body, options: q.options }, mistake: item.origin === 'mistake' ? item.mistake || null : null, seconds: secondsOf(item) };
    }
    return { id: item.id, type: 'lesson', lesson: { id: item.lessonId, title: item.title || null, minutes: item.minutes || null }, seconds: secondsOf(item) };
  }

  const pileOf = (events) => ({ count: new Set(events.filter((e) => e.kind === 'rate' && (e.rating === 3 || e.rating === 4)).map((e) => e.card_id)).size });

  async function runBody(S, row, { events = [], resumed = false } = {}) {
    const done = new Set(events.map((e) => e.item_id));
    const items = (row.items || []).filter((i) => !resumed || !done.has(i.id));
    const qmap = await questionsFor(S, row, items.filter((i) => i.type === 'question').map((i) => i.questionId));
    const meta = metaOf(row);
    const chapter = row.chapter_key ? syllabus.chapterByKey(row.chapter_key) : null;
    const limited = Boolean(row.limit_line);
    return {
      id: row.id, kind: row.kind,
      chapter: {
        key: row.chapter_key, title: cleanTitle(chapter?.title || chapter?.name || row.chapter_key), ref: chapter?.ncert?.chapter ? `Ch ${chapter.ncert.chapter}` : null,
        partTitle: chapter ? partTitles[chapter.ncert?.book] || chapter.ncert?.book || null : null, number: chapter?.ncert?.chapter ? Number(chapter.ncert.chapter) || null : null,
      },
      minutes: row.minutes, asked: Number(row.asked_minutes) || row.minutes,
      items: items.map((i) => publicItem(S, row, i, qmap, limited)),
      revisePile: pileOf(events),
      resumed: resumed ? { done: (row.items || []).length - items.length, of: (row.items || []).length } : null,
      added: row.added || null,
      looks: row.limit_line ? { text: row.limit_line } : row.looks || null,
      free: meta.free || null,
      capped: meta.capped || null,
      shrink: meta.shrink || null,
    };
  }

  // ---------------------------------------------------------------- GET /api/learn/subject

  /**
   * The subject a read asks for, with the student's plan read alongside (speed.md item 5b): a subject that has a deck is valid for
   * everyone, so its reads start at once; any other (or none) waits for the plan to pick it.
   */
  async function subjectAndMe(userId, p) {
    const meP = who(userId);
    const asked = p.get('subject');
    if (asked && decks.bySubject.has(asked)) return { me: meP, sid: asked };
    const me = await meP;
    return { me, sid: pickSubject(me, asked) };
  }

  async function subject(userId, p) {
    const { me, sid } = await subjectAndMe(userId, p);
    if (!sid) return bad('SUBJECT_NOT_FOUND', 404);
    const S = await snapshot(userId, me, sid, { seen: true });
    return ok(subjectBody(S, sid));
  }

  // ---------------------------------------------------------------- GET /api/learn/home (speed.md item 3)

  /** Learn home in one answer: the subject body and the shelves from ONE snapshot; `shelves.due.all` is the sum over subjects. */
  async function home(userId, p) {
    const { me, sid } = await subjectAndMe(userId, p);
    if (!sid) return bad('SUBJECT_NOT_FOUND', 404);
    const S = await snapshot(userId, me, sid, { seen: true });
    return ok({ ...subjectBody(S, sid), shelves: await shelvesOf(S, sid, userId) });
  }

  /** Learn home's body from one snapshot (GET /api/learn/subject and /home). */
  function subjectBody(S, sid) {
    const opts = syllabus.subjectOptions(sid);
    const units = syllabus.unitsFor(sid, {});
    const infos = new Map();
    for (const u of units) for (const ch of u.chapters) { const info = chapterInfo(S, ch.key); if (info) infos.set(ch.key, info); }
    const parts = [];
    for (const u of units) {
      const first = u.chapters[0];
      const optionId = opts?.choices?.some((x) => x.id === first?.section) ? first.section : null;
      const book = first?.ncert?.book || null;
      let part = parts[parts.length - 1];
      if (!part || (!optionId && part.book !== book)) {
        part = { id: `p${parts.length + 1}`, book, title: partTitles[book] || book || (sid === 'english' ? 'CUET English' : subjectName(sid)), option: null, units: [] };
        parts.push(part);
      }
      if (optionId && !part.option) {
        part.option = { label: 'Your part', choices: opts.choices.map((x) => ({ id: x.id, label: x.label })), chosen: S.option, hint: S.option ? "Only your part's chapters show here and in your practice." : 'Both parts show until you choose.' };
      }
      part.units.push({ title: u.unit, optionId, chapters: u.chapters.filter((ch) => infos.has(ch.key)).map((ch) => chapterRow(S, infos.get(ch.key))) });
    }
    const allowed = [...infos.values()].filter((i) => syllabus.sectionAllowed(sid, i.section, S.option));
    const isNew = !S.states.length && !S.progress.length;
    const run = unfinished(S, null);
    const runInSubject = run && run.subject === sid ? run : null;
    const runInfo = runInSubject ? infos.get(runInSubject.chapter_key) : null;
    const lessons = S.lessons;
    const pool = levelPool(S);
    const secs = new Map(allowed.map((i) => [i.key, chapterSeconds(S, i)]));
    const runOut = runInSubject ? {
      id: runInSubject.id, chapterKey: runInSubject.chapter_key, title: runInfo?.title || runInSubject.chapter_key, done: Number(runInSubject.done_count), of: Number(runInSubject.item_count),
      minutesLeft: minutesFor(Number(runInSubject.seconds_left) || 0), kind: runInSubject.kind, leaveOut: runInSubject.leave_out || [],
    } : null;
    const levelQuestions = pool.filter((q) => !q.seen).length || pool.length;
    // Free after the day's session: today's own unfinished run of a kind the pick-up does not carry (a stopped feed), for the
    // Free-done block's "Continue" row (R3 ruling F). A mix or cards run is picked up first, as before.
    const holder = !S.isPro && S.session?.reference && !runOut ? S.runs.find((r) => r.id === S.session.reference) : null;
    const holderOk = holder && holder.subject === sid && !holder.ended_at && S.now - Date.parse(holder.created_at) < LEARN_LIMITS.resumeHours * HOUR
      && Number(holder.done_count) > 0 && Number(holder.done_count) < Number(holder.item_count);
    const freeRun = holderOk ? { id: holder.id, chapterKey: holder.chapter_key, kind: holder.kind, minutesLeft: minutesFor(Number(holder.seconds_left) || 0) } : null;
    const sugg = suggestions({
      subject: { id: sid, name: subjectName(sid), cards: S.cards.length },
      isNew,
      isPro: S.isPro,
      sessionUsed: Boolean(S.session),
      sessionRunId: S.session?.reference || null,
      chapters: allowed.map((i) => ({
        key: i.key, title: i.title, chapterNo: i.chapterNo, book: i.book, cards: i.counts.cards, mustKnow: S.isPro ? i.counts.mustKnow : i.counts.openMust,
        due: i.counts.due, dueIds: i.dueIds, mistakes: i.mistakes.length, questions: i.questions.length, studied: i.studied, lastActivityAt: i.lastActivityAt,
        mistakeWhere: i.mistakes[0]?.where, mistakeWhen: i.mistakes[0]?.when, state: i.state.key, ...secs.get(i.key),
      })),
      run: runOut,
      level: { questions: levelQuestions },
    });
    // R2 rulings 1 to 3: the one start offer and the student's place in the subject (data/learn/roadmap.js), from the same rows.
    const due = allowed.flatMap((i) => i.dueIds.map((id) => ({
      id, chapterKey: i.key, dueAt: i.states.get(id)?.due_at || null, seconds: cardSeconds({ stage: 'due', words: cardWords(S.pub.byId.get(id)) }),
    })));
    const road = roadmapOf({
      subject: { id: sid, name: subjectName(sid) },
      isPro: S.isPro,
      chapters: allowed.map((i) => ({
        key: i.key, title: i.title, of: i.coverage.of, cards: i.counts.cards, seen: i.coverage.seen, unseen: i.coverage.unseen, questions: i.coverage.questions,
        tried: i.coverage.tried, learnAt: i.learnAt, mistakes: i.mistakes.length, mistakeSeconds: secs.get(i.key)?.mistakeSeconds, state: i.state.key,
      })),
      run: runOut,
      due,
      // Free's one session of the day is used (by any run that is not the open one: an open run is picked up first).
      freeDone: !S.isPro && Boolean(S.session),
      freeRun,
      // C1: the Revise row reads dueNow, the same count and minutes the shelves' due.bySubject[sid] and due.minutes carry.
      reviseDue: dueNow(S),
      level: { questions: levelQuestions, chapterKey: pool[0] ? S.questionsById.get(pool[0].id)?.chapterKey || null : null },
    });
    return {
      plan: S.isPro ? 'pro' : 'free',
      student: { isNew },
      subjects: S.subjects.map((id) => ({ id, name: subjectName(id) })),
      // C2: the chapters the student can play (the student's part, with cards), never the coming-soon ones.
      subject: { id: sid, name: subjectName(sid), cards: S.cards.length, chapters: allowed.filter((i) => i.counts.cards > 0).length, lessons: lessons.length, note: sid === 'english' ? ENGLISH_NOTE : null },
      freeNote: S.isPro ? null : `Free opens ${KEYCARD_RULES.free.tastePerChapter} cards in every chapter. Pro opens all ${S.cards.length}.`,
      free: !S.isPro && S.session ? { text: FREE_SESSION_DONE, maxMinutes: LEARN_FREE.maxMinutes } : null,
      suggestions: sugg,
      roadmap: road,
      parts: parts.map(({ book: _b, ...rest }) => rest),
    };
  }

  // ---------------------------------------------------------------- POST /api/learn/runs/preview

  function cleanLeaveOut(list) { return Array.isArray(list) ? [...new Set(list.filter((x) => PILES.includes(x)))] : []; }
  const clampMinutes = (m) => Math.max(1, Math.min(240, Math.round(Number(m) || 10)));

  async function preview(userId, body) {
    const key = body?.chapterKey;
    if (typeof key !== 'string' || !key || key.length > 120) return bad('CHAPTER_NOT_FOUND', 404);
    const ch = syllabus.chapterByKey(key);
    if (!ch || ch.retired) return bad('CHAPTER_NOT_FOUND', 404);
    const me = who(userId); // read alongside the snapshot (speed.md item 5b)
    const [S, overdue] = await Promise.all([snapshot(userId, me, key.split('.')[0]), overdueOf(userId)]);
    S.overdue = overdue;
    const info = chapterInfo(S, key);
    if (!info) return bad('CHAPTER_NOT_FOUND', 404);
    const asked = clampMinutes(body?.minutes);
    const rule = freeRule(S, { kind: 'mix', minutes: asked, ownRunId: unfinished(S, key, ['mix'])?.id || null });
    let leaveOut = cleanLeaveOut(body?.leaveOut);
    if (rule.cardsOnly) leaveOut = [...new Set([...leaveOut, 'questions', 'mistakes'])];
    let run = composeFor(S, info, { kind: 'mix', minutes: rule.minutes, leaveOut });
    let added = null;
    if (body?.addNext === true) ({ plan: run, added } = withNext(S, info, run, { kind: 'mix', minutes: rule.minutes, leaveOut }));
    const recapRun = composeFor(S, info, { kind: 'recap', minutes: 5, leaveOut: [] });
    const next = added ? null : nextChapterOf(S, info.key);
    const dry = dryRun({ run, recapRun, isPro: S.isPro, firstVisit: !info.studied, ratingsLeft: S.ratingsLeft, chapter: { total: info.counts.cards, open: info.counts.open }, nextChapter: next });
    // B7 5: the add-next row says which chapter ('Ch 3'); a pile held back on Free says so; today's unfinished run of this chapter.
    if (dry.shrink?.addNext && next) dry.shrink.addNext = { ...dry.shrink.addNext, ref: next.ref };
    const held = (id) => (rule.cardsOnly && (id === 'questions' || id === 'mistakes') ? 'free' : null);
    const open = info.run ? { runId: info.run.id, done: Number(info.run.done_count), of: Number(info.run.item_count), minutesLeft: minutesFor(Number(info.run.seconds_left) || 0), kind: info.run.kind } : null;
    // R2 ruling 9: the chapter page's "First up" row, the fronts of the first 3 Key cards this run serves (the composer is
    // deterministic, so a start serves these first). Only cards this student may open; [] when the run starts with none.
    const firstUp = run.items.filter((item) => item.type === 'card').map((item) => cardOf(S, item.cardId))
      .filter((card) => card && card.front && S.isOpen(card.id)).slice(0, 3)
      .map((card) => ({ id: card.id, front: card.front, kind: card.kind || null, mustKnow: card.importance === 'must' }));
    return ok({
      // The unit is left out when the title already starts with it (CRITIQUE-1 C4): the part names the place instead.
      chapter: { key: info.key, title: info.title, ref: info.ref, partTitle: partTitleOf(info), unitTitle: unitTitleOf(info), state: info.state },
      ...dry,
      piles: dry.piles.map((pile) => ({ ...pile, held: held(pile.id) })),
      resume: open,
      firstUp,
      firstVisit: !info.studied,
      // R3 X6: the chapter's cards this student has seen (a state row or a feed past), so the page offers Quick recap only after 1.
      cardsSeen: info.coverage.seen,
      ...(rule.cardsOnly ? { free: { text: FREE_CARDS_ONLY } } : {}),
      asked,
      capped: rule.capped,
      freeSession: S.isPro ? null : { used: rule.used, maxMinutes: LEARN_FREE.maxMinutes, line: rule.used ? FREE_SESSION_DONE : null },
      added,
      shelf: {
        cards: { count: info.counts.cards, open: info.counts.open, mustKnow: info.counts.mustKnow, inRevise: info.counts.inRevise },
        questions: { linked: info.linkedQuestions, total: info.questions.length },
        mistakes: { open: info.mistakes.length },
        lesson: info.lesson,
        print: { mustKnow: info.counts.mustKnow, locked: !S.isPro },
      },
    });
  }

  // ---------------------------------------------------------------- POST /api/learn/runs

  async function events(runId) { return store.events(runId); }

  /** What a run body needs without the student's reads: the published cards and the subject's question index. */
  async function contentOf(subject) {
    const [pub, index] = await Promise.all([published(), Promise.resolve(questionIndex(subject)).catch(() => ({ list: [] }))]);
    return { pub, questionsById: new Map((index?.list || []).map((q) => [q.id, q])) };
  }

  /** A replayed start: the run with only its items not done when it has begun, else whole. */
  async function resumeOrBody(userId, row) {
    const [C, ev] = await Promise.all([contentOf(row.subject), events(row.id)]);
    return ok(await runBody(C, row, { events: ev, resumed: ev.length > 0 }));
  }

  async function resumeBody(userId, row) {
    const [C, ev] = await Promise.all([contentOf(row.subject), events(row.id)]);
    return ok(await runBody(C, row, { events: ev, resumed: true }));
  }

  /** The labels of a run's mistake items: "Learn" when the newest wrong answer was in Learn, else the paper or the date. */
  async function labelMistakes(S, items) {
    const mistakes = items.filter((i) => i.type === 'question' && i.origin === 'mistake');
    if (!mistakes.length) return;
    const flat = new Map([...S.mistakes.values()].flat().map((m) => [m.id, m]));
    let learnRows = [];
    try { learnRows = await store.learnAnswers(S.userId, mistakes.map((i) => i.questionId)); } catch { learnRows = []; }
    for (const item of mistakes) {
      const m = flat.get(item.questionId) || {};
      const wrongHere = learnRows.some((r) => r.question_id === item.questionId && r.correct === false && Math.abs(Date.parse(r.created_at) - (m.at ?? 0)) < 5 * 60_000);
      const where = m.where || (wrongHere ? 'Learn' : null);
      item.mistake = { where, when: m.when ?? null, label: mistakeText(where, m.at ?? NaN, S.now) };
    }
  }

  async function start(userId, body) {
    const kind = KINDS.includes(body?.kind) ? body.kind : 'mix';
    const asked = clampMinutes(body?.minutes);
    const fresh = body?.fresh === true;
    if (body?.requestKey !== undefined && body?.requestKey !== null && !(typeof body.requestKey === 'string' && LEARN_LIMITS.requestKey.test(body.requestKey))) return bad('INVALID_REQUEST_KEY');
    const requestKey = typeof body?.requestKey === 'string' ? body.requestKey : `srv_${randomBytes(12).toString('hex')}`;
    const me = await who(userId);
    // An explicit resume of the student's own unfinished run, under 24 hours old.
    if (typeof body?.resume === 'string' && body.resume) {
      const row = await store.run(userId, body.resume);
      if (row && !row.ended_at && now() - Date.parse(row.created_at) < LEARN_LIMITS.resumeHours * HOUR && Number(row.done_count) < Number(row.item_count)) {
        return resumeBody(userId, row);
      }
    }
    const cardIds = Array.isArray(body?.cardIds) ? body.cardIds.filter((x) => typeof x === 'string' && x.length <= 120).slice(0, LEARN_LIMITS.maxCardIds) : null;
    let key = typeof body?.chapterKey === 'string' && body.chapterKey ? body.chapterKey : null;
    if (!key && cardIds?.length) key = decks.byId.get(cardIds[0])?.chapterKey || null;
    if (!key) return bad('CHAPTER_OR_CARDS_REQUIRED');
    const ch = syllabus.chapterByKey(key);
    if (!ch || ch.retired) return bad('CHAPTER_NOT_FOUND', 404);
    // A retried start (the same request key) is the same run, before any rule is applied again.
    const replayed = typeof body?.requestKey === 'string' ? await store.runByKey(userId, requestKey) : null;
    if (replayed) {
      const sameKind = replayed.kind === kind || (['cards', 'recap'].includes(kind) && ['cards', 'recap'].includes(replayed.kind));
      if (!sameKind || replayed.chapter_key !== key) return bad('IDEMPOTENCY_CONFLICT', 409);
      return resumeOrBody(userId, replayed);
    }
    const [S, overdue] = await Promise.all([snapshot(userId, me, key.split('.')[0], { feeds: kind === 'feed' }), ['mix', 'feed', 'cards'].includes(kind) ? overdueOf(userId) : 0]);
    S.overdue = overdue;
    const info = chapterInfo(S, key);
    if (!info) return bad('CHAPTER_NOT_FOUND', 404);
    // Resume (BUILD-1101 1.3): the same chapter and kind on the same India day, unfinished, unless the body says fresh. R3-SPEC L5
    // (C2-1): only a run of the same make. A mistakes-only start (cards left out) never resumes a stopped full run, and a full
    // start never resumes a mistakes-only run.
    const cardsOut = cleanLeaveOut(body?.leaveOut).includes('cards');
    if (!fresh && isCounted(kind) && !cardIds?.length) {
      const open = S.runs.find((r) => r.kind === kind && r.chapter_key === key && istDay(Date.parse(r.created_at)) === S.day && Number(r.done_count) < Number(r.item_count)
        && (r.leave_out || []).includes('cards') === cardsOut);
      if (open) {
        const row = await store.run(userId, open.id);
        if (row && !row.ended_at) return ok(await runBody(S, row, { events: await events(row.id), resumed: true }));
      }
    }
    const rule = freeRule(S, { kind, minutes: asked });
    if (rule.refuse) {
      const holder = S.session?.reference ? S.runs.find((r) => r.id === S.session.reference) : null;
      return sessionUsed(S, info, holder ? { id: holder.id, chapterKey: holder.chapter_key, title: chapterInfo(S, holder.chapter_key)?.title || holder.chapter_key, done: Number(holder.done_count), of: Number(holder.item_count), minutesLeft: minutesFor(Number(holder.seconds_left) || 0), kind: holder.kind } : null);
    }
    const minutes = rule.minutes;
    let leaveOut = cleanLeaveOut(body?.leaveOut);
    if (kind === 'feed') leaveOut = [...new Set([...leaveOut, 'lesson'])]; // a feed never plays a lesson
    if (rule.cardsOnly) leaveOut = [...new Set([...leaveOut, 'questions', 'mistakes'])];

    // A mix that names its chapter and carries cards is "Today's 10 minutes" (the roadmap's key): due cards folded into the chapter.
    const today = kind === 'mix' && Boolean(cardIds?.length) && typeof body?.chapterKey === 'string';
    // Compose; then check the managed questions picked on their fresh rows, and compose again without the failures (3 rounds).
    const dropped = new Set();
    let plan;
    let added = null;
    for (let round = 0; round < 3; round += 1) {
      const infoNow = dropped.size ? { ...info, questions: info.questions.filter((q) => !dropped.has(q.id)), mistakes: info.mistakes.filter((m) => !dropped.has(m.id)) } : info;
      if (kind === 'level') {
        plan = composeRun({ kind: 'level', minutes, questions: levelPool(S).filter((q) => !dropped.has(q.id)), now: S.now });
      } else if (today) {
        plan = todayPlan(S, infoNow, { minutes, leaveOut, cardIds, dropped });
      } else if (cardIds?.length) {
        const open = cardIds.map((id) => S.pub.byId.get(id)).filter((x) => x && S.isOpen(x.id));
        plan = composeRun({ kind: kind === 'recap' ? 'recap' : 'cards', minutes, cardIds: open.map((x) => x.id), cards: open, states: S.stateMap, now: S.now, ratingsLeft: S.ratingsLeft, newLeft: S.newLeft });
      } else {
        plan = composeFor(S, infoNow, { kind, minutes, leaveOut });
        if (body?.addNext === true) ({ plan, added } = withNext(S, infoNow, plan, { kind, minutes, leaveOut }));
      }
      const managed = plan.items.filter((i) => i.type === 'question' && S.questionsById.get(i.questionId)?.managed).map((i) => i.questionId);
      if (!verifyRows || !managed.length) break;
      const passed = await verifyRows(managed);
      const failed = managed.filter((id) => !passed.has(id));
      if (!failed.length) break;
      for (const id of failed) dropped.add(id);
      if (round === 2) plan = { ...plan, items: plan.items.filter((i) => !(i.type === 'question' && dropped.has(i.questionId))) };
    }
    const id = newId();
    const items = plan.items.map((it, i) => compactItem(S, it, `${id}-i${i + 1}`));
    await labelMistakes(S, items);
    const seconds = items.reduce((s, i) => s + secondsOf(i), 0);
    const real = plan.shrunk && plan.realMinutes ? plan.realMinutes : plan.minutes;
    const looks = plan.kind !== 'recap' && items.some((i) => i.type === 'card' && i.look)
      ? { text: S.ratingsLeft === 0 ? LOOKS_TEXT.keycard_reviews : LOOKS_TEXT.keycard_new } : null;
    // A start from an Explore cover says so (BUILD-1101 B7 item 4): where it came from, whether it was For you, and its place.
    const fromCover = body?.source === 'explore_cover'
      ? { source: 'explore_cover', forYou: body.forYou === true, position: Number.isInteger(body.position) && body.position >= 0 && body.position <= 500 ? body.position : null }
      : {};
    const meta = {
      key: info.state.key, label: info.state.label, ...fromCover, ...(plan.today ? { today: plan.today } : {}),
      free: rule.cardsOnly ? { text: FREE_CARDS_ONLY } : null,
      capped: rule.capped,
      shrink: plan.shrunk && plan.shrink ? plan.shrink : null,
    };
    const row = {
      id, user_id: userId, request_key: requestKey, kind: plan.kind, subject: info.subject, chapter_key: info.key,
      asked_minutes: minutes, minutes: Math.max(0, Math.min(240, real || 0)), leave_out: plan.leaveOut || [], items, seconds, seconds_left: seconds,
      start_state: meta, added, looks, created_at: iso(S.now),
    };
    const res = await store.startRun(row, items.filter((i) => i.type === 'question').map((i) => i.questionId));
    if (res?.status === 'key_conflict') return bad('IDEMPOTENCY_CONFLICT', 409);
    if (res?.status === 'replay') {
      const prior = await store.run(userId, res.id);
      if (!prior) throw fail('LEARN_UNAVAILABLE', new Error('replayed run unread'));
      const ev = await events(prior.id);
      return ok(await runBody(S, prior, { events: ev, resumed: ev.length > 0 }));
    }
    if (res?.status !== 'ok') throw fail('LEARN_UNAVAILABLE', new Error(`learn_start_run answered ${JSON.stringify(res)}`));
    return ok(await runBody(S, { ...row, item_count: items.length, done_count: 0, limit_line: null }, { events: [] }));
  }

  /** The stored form of an item: ids only, never a key. */
  function compactItem(S, it, id) {
    const base = { id, type: it.type, seconds: secondsOf(it) };
    if (it.type === 'card') return { ...base, cardId: it.cardId, stage: it.stage, ...(it.look ? { look: true } : {}), ...(it.recap ? { recap: true } : {}), ...(it.mustKnow ? { mustKnow: true } : {}), ...(it.reason ? { reason: it.reason } : {}) };
    if (it.type === 'question') {
      const q = S.questionsById.get(it.questionId);
      return {
        ...base, questionId: it.questionId, origin: it.origin, links: it.links || [], difficulty: it.difficulty || null,
        chash: q?.chash ?? null, ...(it.late ? { late: true } : {}), ...(it.origin === 'mistake' ? { mistake: it.mistake || null } : {}),
      };
    }
    const lesson = S.lessons.find((l) => l.id === it.lessonId);
    return { ...base, lessonId: it.lessonId, title: lesson?.title || null, minutes: Number(it.minutes) || lesson?.minutes || null };
  }

  // ---------------------------------------------------------------- GET /api/learn/runs/:id

  const endHrefOf = (row) => `${row.kind === 'feed' ? '/explore/run' : '/learn/run'}?${new URLSearchParams({ run: row.id, end: '1' })}`;

  async function getRun(userId, id) {
    const row = await store.run(userId, id);
    if (!row) return bad('RUN_NOT_FOUND', 404);
    if (row.ended_at) return bad('RUN_ENDED', 409, { endHref: endHrefOf(row) });
    if (now() - Date.parse(row.created_at) > LEARN_LIMITS.answerHours * HOUR) return bad('RUN_EXPIRED', 409, { endHref: endHrefOf(row) });
    return resumeBody(userId, row);
  }

  // ---------------------------------------------------------------- POST /api/learn/runs/:id/answer

  /** A stored event body as the client sees it: the line's card rebuilt from the decks, the re-insert with its item. */
  async function hydrateAnswer(S, row, body) {
    const out = { ...body };
    if (body?.line?.cardId) {
      const card = cardOf(S, body.line.cardId);
      out.line = body.line.locked
        ? { card: card ? lockedStub(card) : { id: body.line.cardId, locked: true }, locked: true, text: LOCKED_LINE }
        : { card, source: body.line.source, collapsed: Boolean(body.line.collapsed) };
    }
    out.reinsert = await hydrateReinsert(S, row, body?.reinsert);
    return out;
  }
  async function hydrateReinsert(S, row, r) {
    if (!r?.item_id) return null;
    const fresh = await store.run(row.user_id, row.id);
    const item = (fresh?.items || []).find((i) => i.id === r.item_id);
    if (!item) return null;
    return { itemId: r.item_id, at: r.at, item: publicItem(S, fresh, item, new Map(), Boolean(fresh.limit_line)), ...(r.moved ? { moved: true } : {}) };
  }

  const expired = (row) => now() - Date.parse(row.created_at) > LEARN_LIMITS.answerHours * HOUR;

  /**
   * The few reads one answer needs (A6 4.5), never the subject snapshot: the plan, today's allowances, the held Mob
   * questions, and this question's Revise card and progress row. Throws LEARN_UNAVAILABLE as the snapshot does.
   */
  async function answerContext(userId, row, questionId) {
    const t = now();
    const day = istDay(t);
    const [me, allowances, heldOut, pub, index, stored, progressRow] = await Promise.all([
      who(userId), store.allowances(userId, day),
      heldQuestions ? Promise.resolve(heldQuestions(userId)).then((q) => ({ qids: q instanceof Set ? q : new Set(q || []), failed: false }), () => ({ qids: new Set(), failed: true })) : Promise.resolve({ qids: new Set(), failed: false }),
      published(), Promise.resolve(questionIndex(row.subject)).catch(() => ({ list: [] })),
      store.reviseCard(userId, questionId), store.progressRow(userId, questionId),
    ]);
    const taste = me.isPro ? null : tasteIds(pub.cardsOf(row.subject));
    const seeded = planSeeds({ progress: progressRow ? [progressRow] : [], cards: stored ? [stored] : [] })[0] || null;
    const reviseCard = seeded ? { ...(stored || {}), ...seeded, stored: Boolean(stored) } : stored ? { ...stored, stored: true } : null;
    return {
      now: t, day, isPro: me.isPro, me, allowances, held: heldOut, pub, reviseCard,
      questionsById: new Map((index?.list || []).map((q) => [q.id, q])),
      isOpen: (id) => me.isPro || taste.has(id),
      session: me.isPro ? null : allowances.find((r) => r.kind === 'learn_session') || null,
    };
  }

  async function answer(userId, id, body) {
    const row = await store.run(userId, id);
    if (!row) return bad('RUN_NOT_FOUND', 404);
    const items = row.items || [];
    const at = items.findIndex((i) => i.id === body?.itemId);
    const item = items[at];
    if (!item || item.type !== 'question') return bad('ITEM_NOT_A_QUESTION');
    const prior = await store.event(row.id, item.id);
    if (prior) return ok(await hydrateAnswer({ pub: await published() }, row, { ...prior.body, choice: prior.body?.choice ?? prior.choice ?? null }));
    if (row.ended_at) return bad('RUN_ENDED', 409, { endHref: endHrefOf(row) });
    if (expired(row)) return bad('RUN_EXPIRED', 409, { endHref: endHrefOf(row) });
    const [q, A] = await Promise.all([store.question(item.questionId), answerContext(userId, row, item.questionId)]);
    const options = servedOptions(q?.options);
    const choice = String(body?.choice ?? '').trim().toUpperCase();
    if (q && !options.some((o) => o.key === choice)) return bad('INVALID_CHOICE');
    // Only a current, unchanged key is used (sessionCheck.resolveKey's rule): otherwise nothing is written.
    const key = q ? keyLetter(q, options) : null;
    if (!q || !liveRow(q) || !key || (item.chash && changeStamp(q) && item.chash !== changeStamp(q))) return bad('QUESTION_CHANGED', 409);
    // A question of a Mob paper still open is never graded here; an unread hold refuses every question (fail closed).
    if (A.held.failed || A.held.qids.has(q.id)) return bad('QUESTION_HELD', 409);
    const counted = !A.isPro && isCounted(row.kind);
    const used = () => ({ http: 402, body: { error: 'FREE_SESSION_USED', reason: 'learn_session', line: FREE_SESSION_DONE, options: [], resume: null } });
    if (counted && A.session && A.session.reference !== row.id) return used();
    const correct = choice === key;
    const chapterKey = syllabus.resolveChapter(q.subject, q.chapter)?.key || row.chapter_key;
    // A retried mistake is graded as Revise grades it (R10.2): its card moves, the progress row does not.
    const isMistake = item.origin === 'mistake';
    const card = isMistake ? A.reviseCard || { box: 1, right_total: 0, stored: false } : null;
    const graded = isMistake ? gradeCard(card, correct, istDate(A.now)) : null;
    const fixed = Boolean(isMistake && correct);
    let fixedText = null;
    if (fixed) {
      fixedText = graded.state === 'retired'
        ? `Fixed. ${item.mistake?.label || 'You missed this before'}.`
        : `Right this time. ${backOn(graded.due_day, A.now)} to check it held.`;
    }
    // The line you needed: the question's linked card (by words otherwise), on a wrong answer and under a fixed mistake.
    let line = null;
    let reinsert = null;
    if (!correct || fixed) {
      const links = A.questionsById.get(q.id)?.cards || decks.links.get(q.subject)?.[q.id] || [];
      const found = lineNeeded(q.id, { [q.id]: links }, A.pub.byId, { chapterKey, text: `${q.question || q.body || ''} ${explanationOf(q)}` });
      const lineCard = found.cards[0] || null;
      if (lineCard) {
        const open = A.isOpen(lineCard.id);
        let shown = open;
        // R14: on Free, a line whose card is not open follows Key cards' rule (3 a day, keycard_line); a right answer spends nothing.
        if (!open && !correct) {
          const mine = A.allowances.filter((r) => r.kind === 'keycard_line');
          shown = mine.some((r) => r.reference === q.id) || await store.claimLine(userId, A.day, mine.length, KEYCARD_RULES.free.lineNeededPerDay, q.id);
        }
        line = shown ? { cardId: lineCard.id, source: found.source, collapsed: fixed } : { cardId: lineCard.id, locked: true };
        if (!correct && open) reinsert = reinsertFor(row, at, lineCard.id);
      }
    }
    const stored = { correct, key, choice, explanation: explanationOf(q), fixed, fixedText, ...(isMistake ? { retired: graded.state === 'retired' } : {}), line };
    const res = await store.recordEvent({
      userId, runId: row.id, itemId: item.id,
      event: { kind: 'answer', question_id: q.id, choice, correct, fixed, origin: item.origin || 'chapter', seconds: secondsOf(item), body: stored },
      progress: isMistake ? null : { question_id: q.id, subject: q.subject, chapter: q.chapter, selected_key: choice, correct },
      interaction: { question_id: q.id, metadata: { selected_key: choice, is_correct: correct, item_id: item.id, run_kind: row.kind } },
      reinsert,
      quota: counted ? { kind: 'learn_session', day: A.day, limit: LEARN_FREE.sessionsPerDay } : null,
    });
    if (res?.status === 'used') return used();
    if (res?.status === 'replay') return ok(await hydrateAnswer(A, row, { ...res.body, choice: res.body?.choice ?? null }));
    if (res?.status === 'not_found') return bad('RUN_NOT_FOUND', 404);
    if (res?.status === 'no_item') return bad('ITEM_NOT_A_QUESTION');
    if (res?.status !== 'ok') throw fail('LEARN_UNAVAILABLE', new Error(`learn_record_event answered ${JSON.stringify(res)}`));
    if (isMistake) await store.gradeRevise(userId, q.id, card, graded, istDate(A.now));
    return ok(await hydrateAnswer(A, row, { ...stored, reinsert: res.reinsert || null }));
  }

  /**
   * Where the line's card goes after a wrong answer at item `at` (A5 R7, BUILD-1101 1.7): still ahead, it moves to at + 3
   * (no copy); shown before and not rated well, a copy at at + 3 ("Back from earlier"); not in the run, it is put in at
   * at + 3 ("The line you needed"). Once per card per run (the function's rule).
   */
  function reinsertFor(row, at, cardId) {
    const items = row.items || [];
    const j = items.findIndex((i) => i.type === 'card' && i.cardId === cardId);
    const copy = (reason) => ({ type: 'card', cardId, stage: 'again', reason, seconds: secondsOf({ type: 'card', stage: 'again' }), ...(row.limit_line ? { look: true } : {}) });
    if (j > at) return { card_id: cardId, gap: 3, move_item: items[j].id };
    if (j >= 0) return { card_id: cardId, gap: 3, unless_rated_well: true, item: copy('earlier') };
    return { card_id: cardId, gap: 3, unless_rated_well: false, item: copy('line') };
  }

  // ---------------------------------------------------------------- POST /api/learn/runs/:id/rate

  async function rate(userId, id, body) {
    const row = await store.run(userId, id);
    if (!row) return bad('RUN_NOT_FOUND', 404);
    const items = row.items || [];
    const at = items.findIndex((i) => i.id === body?.itemId);
    const item = items[at];
    if (!item) return bad('ITEM_NOT_FOUND', 404);
    if (item.type !== 'card' && item.type !== 'lesson') return bad('ITEM_NOT_A_CARD');
    const prior = await store.event(row.id, item.id);
    const evs = async () => store.events(row.id);
    if (prior) {
      const b = prior.body || {};
      return ok({ ok: true, replay: true, ...(b.kept ? { kept: true, line: b.line || null } : {}), stamp: b.stamp ?? null, revisePile: pileOf(await evs()), limit: row.limit_line ? { text: row.limit_line } : null });
    }
    if (row.ended_at) return bad('RUN_ENDED', 409, { endHref: endHrefOf(row) });
    if (expired(row)) return bad('RUN_EXPIRED', 409, { endHref: endHrefOf(row) });
    const record = (event, extra = {}) => store.recordEvent({ userId, runId: row.id, itemId: item.id, event: { seconds: secondsOf(item), ...event }, ...extra });
    const pile = (res, fallback) => ({ count: Number.isFinite(Number(res?.revise_pile)) ? Number(res.revise_pile) : fallback });
    if (item.type === 'lesson') {
      const res = await record({ kind: 'lesson', body: { lessonId: item.lessonId } });
      return ok({ ok: true, stamp: null, revisePile: pile(res, 0), limit: null });
    }
    const me = await who(userId);
    const t = now();
    // The feed's Keep (BUILD-1101 1.1): the card joins Revise as a new card (the Key cards add, added_from 'manual'); no review,
    // no rating, no Free allowance. A card already in Revise: nothing is written; its stamp is its real return day.
    if (body?.keep === true) {
      const found = await store.cardState(userId, item.cardId);
      const st = found && !found.suspended ? found : null;
      let stamp = 'In Revise';
      let lineText = 'In Revise';
      if (st) {
        const reviewed = Number(st.reps) > 0;
        stamp = reviewed ? stampOf(st.due_at, t) : 'In Revise';
        lineText = reviewed ? `In Revise, ${stamp === 'Due now' ? 'due now' : stamp.replace(/^Back/, 'back')}` : 'In Revise';
      } else {
        const res = await kc.add(userId, { cardIds: [item.cardId], addedFrom: 'manual' });
        if (res.http === 402) return { http: 402, body: { error: 'PRO_REQUIRED', reason: res.body?.reason || 'keycards' } };
        if (res.http !== 200) return { http: res.http, body: res.body };
      }
      const res = await record({ kind: 'keep', card_id: item.cardId, due_at: st && Number(st.reps) > 0 ? st.due_at : null, body: { kept: true, stamp, line: lineText, already: Boolean(st) } });
      if (res?.status === 'replay') return ok({ ok: true, replay: true, kept: true, stamp: res.body?.stamp ?? stamp, line: res.body?.line ?? lineText, revisePile: pile(res, 0), limit: null });
      return ok({ ok: true, kept: true, stamp, line: lineText, revisePile: pile(res, 0), limit: null });
    }
    const rating = Number(body?.rating);
    if (![1, 3, 4].includes(rating)) return bad('INVALID_RATING');
    const opts = { clientKey: clientKeyOf(row.id, item.id), withToday: false, me: { isPro: me.isPro, isPremium: me.isPro, subjects: me.subjects } };
    // A recap card: logged as a last look, never scheduled, no allowance.
    if (row.kind === 'recap' || item.recap) {
      await kc.review(userId, { cardId: item.cardId, rating, mode: 'last_look' }, opts);
      const res = await record({ kind: 'recap', card_id: item.cardId, rating, body: { look: true } });
      return ok({ ok: true, stamp: null, revisePile: pile(res, 0), limit: null });
    }
    if (item.look || row.limit_line) {
      const res = await record({ kind: 'look', card_id: item.cardId, body: { look: true } });
      return ok({ ok: true, saved: false, look: true, stamp: null, revisePile: pile(res, 0), limit: row.limit_line ? { text: row.limit_line } : row.looks || null });
    }
    // A card rated earlier in this run and back again (R6.1): a learning step, logged as a last look; its stamp stays the first's.
    const ev = await evs();
    const first = ev.find((e) => e.kind === 'rate' && e.card_id === item.cardId);
    if (first) {
      await kc.review(userId, { cardId: item.cardId, rating, mode: 'last_look' }, opts);
      const stamp = first.body?.stamp && first.body.stamp !== IN_RUN ? first.body.stamp : stampOf(first.due_at, t);
      const res = await record({ kind: 'look', card_id: item.cardId, rating, body: { again: true, stamp } });
      return ok({ ok: true, again: true, stamp, revisePile: pile(res, pileOf(ev).count), limit: null });
    }
    let res = await kc.review(userId, { cardId: item.cardId, rating, mode: 'study' }, opts);
    if (res.http === 409 && res.body?.error === 'REVIEW_CONFLICT') res = await kc.review(userId, { cardId: item.cardId, rating, mode: 'study' }, opts);
    if (res.http === 402) {
      const text = LOOKS_TEXT[res.body?.reason] || LOOKS_TEXT.keycard_reviews;
      const out = await record({ kind: 'look', card_id: item.cardId, body: { look: true, limitHit: true } }, { limitLine: text });
      return ok({ ok: true, saved: false, look: true, stamp: null, revisePile: pile(out, pileOf(ev).count), limit: { text } });
    }
    if (res.http !== 200) return { http: res.http, body: res.body };
    const dueAt = res.body?.next?.due_at || null;
    let stamp = dueAt ? stampOf(dueAt, t) : null;
    const reinsert = rating === 1 ? { card_id: item.cardId, gap: 3, unless_rated_well: false, item: { type: 'card', cardId: item.cardId, stage: 'again', seconds: secondsOf({ type: 'card', stage: 'again' }) } } : null;
    const out = await record({ kind: 'rate', card_id: item.cardId, rating, due_at: dueAt, body: { stamp, saved: true } }, { reinsert });
    if (out?.status === 'replay') return ok({ ok: true, replay: true, stamp: out.body?.stamp ?? stamp, revisePile: pile(out, pileOf(ev).count), limit: null });
    const back = out?.reinsert ? await hydrateReinsert({ pub: await published() }, row, out.reinsert) : null;
    if (back) stamp = IN_RUN;
    return ok({ ok: true, stamp, revisePile: pile(out, pileOf(ev).count + (rating >= 3 ? 1 : 0)), limit: null, reinsert: back });
  }

  // ---------------------------------------------------------------- GET /api/learn/runs/:id/end

  async function end(userId, id, { stop = false } = {}) {
    const row = await store.run(userId, id);
    if (!row) return bad('RUN_NOT_FOUND', 404);
    const me = await who(userId);
    const [S, evAll] = await Promise.all([snapshot(userId, me, row.subject), store.events(row.id)]);
    const info = chapterInfo(S, row.chapter_key);
    const items = row.items || [];
    const itemOf = new Map(items.map((i) => [i.id, i]));
    const ev = evAll.filter((e) => !e.body?.seeded);
    // Cards (R6): one count per card; the detail counts first ratings; one return date per card (its last saved rating).
    const perCard = new Map();
    for (const e of ev.filter((x) => x.kind === 'rate')) {
      const c = perCard.get(e.card_id) || { first: e.rating, dueAt: null };
      if (e.due_at) c.dueAt = e.due_at;
      perCard.set(e.card_id, c);
    }
    const firsts = [...perCard.values()].map((c) => c.first);
    const n = (r) => firsts.filter((x) => x === r).length;
    const looks = ev.filter((e) => (e.kind === 'look' && !e.body?.again) || e.kind === 'recap').length;
    const answersAll = ev.filter((e) => e.kind === 'answer');
    const answered = answersAll.filter((e) => e.origin !== 'mistake');
    const right = answered.filter((e) => e.correct).length;
    const mistakesIn = items.filter((i) => i.type === 'question' && i.origin === 'mistake');
    const mistakesTried = answersAll.filter((e) => e.origin === 'mistake').length;
    const fixed = answersAll.filter((e) => e.fixed).length;
    const recap = row.kind === 'recap';
    const ratedText = [n(3) ? `${n(3)} got it` : null, n(4) ? `${n(4)} easy` : null, n(1) ? `${n(1)} missed` : null].filter(Boolean);
    const cardsText = recap ? `${looks} looked at, nothing scheduled` : [...ratedText, looks ? `${looks} looked at` : null].filter(Boolean).join(', ');
    const still = mistakesIn.length - fixed;
    const lines = [];
    if (cardsText) lines.push({ label: 'Cards', text: cardsText });
    if (answered.length) lines.push({ label: 'Questions', text: `${right} of ${answered.length} right` });
    if (mistakesIn.length) lines.push({ label: 'Mistakes', text: still ? `${fixed} of ${mistakesIn.length} fixed, ${still} still open` : `${fixed} of ${mistakesIn.length} fixed` });
    const detail = {
      cards: recap ? 'nothing scheduled' : ratedText.join(', ') || null,
      questions: answered.length ? `${right} of ${answered.length} right` : null,
      fixed: mistakesIn.length ? `${fixed} of ${mistakesIn.length}${still ? `, ${still} still open` : ''}` : null,
    };
    // B7 6: the cards this run sent to Revise as they were rated Got it or Easy, in run order, at most 4, for the end's pile.
    const placeOf = new Map(items.map((i, k) => [i.id, k]));
    const sent = [];
    for (const e of ev.filter((x) => x.kind === 'rate' && (x.rating === 3 || x.rating === 4))) {
      if (!sent.some((x) => x.id === e.card_id)) sent.push({ id: e.card_id, at: placeOf.get(e.item_id) ?? Number.MAX_SAFE_INTEGER });
    }
    const reviseCards = sent.sort((a, b) => a.at - b.at).map((x) => cardOf(S, x.id)).filter(Boolean).slice(0, 4)
      .map((c) => ({ id: c.id, kind: c.kind, front: c.front, mustKnow: c.importance === 'must' }));
    const groups = revisePileGroups([...perCard.values()].map((c) => c.dueAt).filter(Boolean), S.now);
    // R16: "moved" only between answer-based states, never from Not started.
    const startState = metaOf(row);
    const moved = S.isPro && info ? movedLine(info.title, startState, info.state) : null;
    const free = !S.isPro && row.limit_line && info ? { text: `Free opened ${info.counts.open} of this chapter's ${info.counts.cards} cards. Pro opens all of them and keeps them on a schedule.` } : null;
    // The length the student chose, unless the run was shrunk (R4): the title and the next options use it.
    const length = metaOf(row).shrink ? Number(row.minutes) : Number(row.asked_minutes) || Number(row.minutes);
    const title = recap ? `Quick recap of ${info?.title || row.chapter_key}` : `${minutesWord(length)} on ${info?.title || row.chapter_key}`;
    // R2 ruling 6: a run stopped part way (the stop sheet's "Stop here": ?stop=1) is not ended, so the student can pick it up
    // today (Learn home and the chapter page offer it; a start of the same chapter and make resumes it). A run that reached its
    // end, or a stop with every item done, is ended once.
    const finished = !stop || recap || Number(row.done_count) >= Number(row.item_count);
    // The keys (B 3.6, R3-SPEC L5): one main key and one quiet link, the same for a run and a feed. A stopped run's main key
    // resumes it ("Continue · N min"); on Free once today's session is used, none that serves questions (ruling F).
    const doneIds = new Set(ev.map((e) => e.item_id));
    const secondsLeft = items.filter((i) => !doneIds.has(i.id)).reduce((t, i) => t + secondsOf(i), 0);
    const elsewhere = new Map();
    for (const [k, list] of S.mistakes) if (k !== row.chapter_key) elsewhere.set(k, list.length);
    const top = [...elsewhere].sort((a, b) => b[1] - a[1])[0];
    const topInfo = top ? chapterInfo(S, top[0]) : null;
    const dueAll = S.cards.filter((x) => S.isOpen(x.id) && cardStage(S.stateMap.get(x.id), S.now) === 'due').length;
    // "Another 5 minutes here" says what the real 5-minute run of the chapter would hold (R6.2).
    const five = info && row.kind !== 'level' ? composeFor(S, info, { kind: 'mix', minutes: 5, leaveOut: [] }) : null;
    const secs = info ? chapterSeconds(S, info) : null;
    const topSecs = topInfo ? chapterSeconds(S, topInfo) : null;
    const sessionDone = !S.isPro && Boolean(S.session);
    let opts = endOptions({
      subject: row.subject, chapter: { key: row.chapter_key, title: info?.title || row.chapter_key, name: info?.name }, minutes: ['mix', 'feed'].includes(row.kind) ? length : 10,
      kind: row.kind, missed: n(1), here: five ? { cards: five.piles.cards.count, questions: five.piles.questions.count + five.piles.mistakes.count } : null,
      next: nextChapterOf(S, row.chapter_key), mistakes: info?.mistakes.length ? { count: info.mistakes.length, seconds: secs?.mistakeSeconds ?? null } : null,
      mistakeElsewhere: topInfo ? { key: topInfo.key, title: topInfo.title, count: top[1], seconds: topSecs.mistakeSeconds } : null,
      due: { count: dueAll }, mustKnow: info ? (S.isPro ? info.counts.mustKnow : info.counts.openMust) : 0, recapSeconds: secs?.recapSeconds ?? null,
      // R2 ruling 3 (P1 request): stay in the chapter until its cards are seen once.
      unseen: Number.isFinite(info?.coverage?.unseen) ? info.coverage.unseen : null,
      freeSessionUsed: sessionDone, hadCards: items.some((i) => i.type === 'card'),
      stopped: finished || row.kind === 'level' ? null : { runId: row.id, kind: row.kind, minutesLeft: minutesFor(secondsLeft) },
    });
    // The level run's end names the chapter to start (R16): the lowest share right among its questions' chapters.
    let level = null;
    if (row.kind === 'level') {
      const qIndex = (await Promise.resolve(questionIndex(row.subject)).catch(() => ({ list: [] })))?.list || [];
      const chapterOfQ = new Map(qIndex.map((q) => [q.id, q.chapterKey]));
      const books = allowedChapters(S).map((ch) => ({ key: ch.key, title: cleanTitle(ch.title || ch.name) }));
      const pick = levelPick(answered.map((e) => ({ chapterKey: chapterOfQ.get(e.question_id) || null, correct: e.correct })), books);
      if (pick) {
        level = { chapterKey: pick.key, title: pick.title, right: pick.right, of: pick.of };
        if (!sessionDone) {
          const start = { kind: 'next', title: `Start with ${pick.title}`, minutes: 10, label: `Start with ${pick.title}`, evidence: `Your lowest score here: ${pick.right} of ${pick.of} right.`, run: { kind: 'mix', chapterKey: pick.key, minutes: 10, leaveOut: [] } };
          opts = { lead: start, options: [opts.lead, ...opts.options].filter((o) => o && !(o.run && o.run.chapterKey === pick.key && o.run.kind === 'mix')).slice(0, 1) };
        }
      }
    }
    if (finished) await store.endRun(userId, row.id);
    // How far the run got and how long it took, for every run kind ("You stopped at 8 of 21." / "All 21 done in 9 min.").
    const done = runDone(row, ev);
    const progress = info ? chapterProgress(info, items, ev) : null;
    const feed = row.kind === 'feed' ? feedEnd(S, row, info, { ev, itemOf, answered: answered.length, right, fixed, mistakes: mistakesIn.length, sessionDone, length, done }) : null;
    return ok({
      feed, title, done, stopped: !finished, progress, chapter: info ? { key: info.key, title: info.title } : null,
      numbers: { cards: perCard.size, questions: answered.length, fixed, mistakes: mistakesTried, detail },
      lines, revisePile: groups, reviseCards, moved, free, lead: opts.lead, options: opts.options, ...(level ? { level } : {}),
    });
  }

  /**
   * The chapter's cards seen, before this run and now (R2 ruling 5: the end's progress bar grows from `before` to `seen`).
   * Seen: a card with a state, or a card this run acted on; this run's new ones are those served as new that it acted on.
   */
  function chapterProgress(info, items, ev) {
    const acted = new Set(ev.filter((e) => e.card_id && ['rate', 'look', 'keep', 'recap'].includes(e.kind)).map((e) => e.card_id));
    const known = new Set(info.all.filter((x) => info.states.has(x.id)).map((x) => x.id));
    const inChapter = new Set(info.all.map((x) => x.id));
    for (const id of acted) if (inChapter.has(id)) known.add(id);
    const fresh = new Set(items.filter((i) => i.type === 'card' && i.stage === 'new' && acted.has(i.cardId)).map((i) => i.cardId));
    return { of: info.all.length, seen: known.size, before: Math.max(0, known.size - fresh.size) };
  }

  /**
   * How far a run got and how long it took (B7 2, F4 3): `reached` is the place of the last item the student acted on, `of`
   * the run's items, `minutes` the first event to the last, rounded, at least 1.
   */
  function runDone(row, ev) {
    const places = (row.items || []).map((i) => i.id);
    const reached = ev.reduce((m, e) => Math.max(m, places.indexOf(e.item_id) + 1), 0);
    const times = ev.map((e) => Date.parse(e.created_at)).filter(Number.isFinite);
    const minutes = times.length ? Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 60_000)) : 1;
    return { reached, of: places.length, minutes };
  }

  /**
   * The Explore feed's end screen (FEED-2 section 5, BUILD-1101 1.2 and 1.9): the kept pile, the lines, the keys.
   *   kept      { count, cards, groups, stamp, line: "6 kept. They are first in Revise." }
   *   lead      "Keep going · 10 min" (fresh: true); on Free with the day's session used, null and `free` says why
   *   next      "Next chapter · 10 min" with the chapter's title
   *   dueOffer  "Revise 3 due cards · 1 min" when the chapter has due cards
   * The end's main key and quiet link are the end's own `lead` and `options` (endOptions, the same as a run's, R3-SPEC L5).
   */
  function feedEnd(S, row, info, { ev, answered, right, fixed, mistakes, sessionDone, length, done }) {
    const keeps = ev.filter((e) => e.kind === 'keep' && e.body?.kept);
    const cards = keeps.map((k) => cardOf(S, k.card_id)).filter(Boolean);
    const dues = keeps.map((k) => k.due_at).filter(Boolean);
    const stamps = [...new Set(keeps.map((k) => k.body?.stamp).filter(Boolean))];
    const lines = feedEndLines({ answered, right, fixed, mistakes });
    const minutes = FEED_RULES.lengths.includes(length) ? length : 10;
    const next = nextChapterOf(S, row.chapter_key);
    const due = info ? info.counts.due : 0;
    const dueMin = due ? cardRunMinutes(due, chapterSeconds(S, info).dueSeconds) : 0;
    return {
      title: `${minutesWord(length)} on ${info?.title || row.chapter_key}`,
      done,
      kept: { count: cards.length, cards: cards.slice(0, 5), groups: revisePileGroups(dues, S.now), stamp: stamps.length === 1 && keeps.length ? stamps[0] : null, line: keptLine(cards.length) },
      lines,
      lead: sessionDone ? null : { label: withMinutes(WORDS.keepGoing, minutes), run: { kind: 'feed', chapterKey: row.chapter_key, minutes, fresh: true } },
      free: sessionDone ? { text: FREE_END_LINE } : null,
      next: next ? { label: withMinutes(WORDS.nextChapter, minutes), title: next.title, key: next.key, run: sessionDone ? null : { kind: 'feed', chapterKey: next.key, minutes } } : null,
      dueOffer: due ? { count: due, minutes: dueMin, label: reviseDue(due, dueMin), run: { kind: 'cards', chapterKey: info.key, cardIds: info.dueIds.slice(0, LEARN_LIMITS.maxCardIds), minutes: dueMin } } : null,
    };
  }

  // ---------------------------------------------------------------- GET /api/learn/covers

  /**
   * The Explore covers (A5 R12, BUILD-1101 1.9): every playable chapter, For you first, then book order from the chapter
   * after it, wrapping. Each with its opening card (hook), one true line about the student, and the real counts of a feed
   * at 5, 10 and 20 minutes (Free: 20 is composed as 10, capped).
   */
  /** The ref line of a cover (A2 4.2): "Part 1, Ch 2", "Microeconomics, Ch 2"; no chapter number gives the unit ("Verbal Ability"). */
  function refLineOf(info) {
    if (!info.ref) return unitTitleOf(info);
    const book = partTitleOf(info);
    if (!book) return info.ref;
    const part = /^Part\s+(\d+)\b/i.exec(book) || /\bPart\s+(\d+)\s*$/i.exec(book);
    if (part) return `Part ${part[1]}, ${info.ref}`;
    return `${String(book).replace(/^Introductory\s+/i, '')}, ${info.ref}`;
  }

  async function covers(userId, p) {
    const me = await who(userId);
    const sid = pickSubject(me, p.get('subject'));
    if (!sid) return bad('SUBJECT_NOT_FOUND', 404);
    const [S, overdue] = await Promise.all([snapshot(userId, me, sid, { feeds: true }), overdueOf(userId)]);
    S.overdue = overdue; // the same composer input as a feed start, so the hook is the card that start serves first
    const list = allowedChapters(S).map((ch, order) => ({ order, info: chapterInfo(S, ch.key) })).filter((x) => x.info && (x.info.counts.open + x.info.questions.length) > 0);
    const history = list.some((x) => x.info.studied);
    if (!list.length) return ok({ subject: { id: sid, name: subjectName(sid) }, lengths: FEED_RULES.lengths, covers: [], free: null, history });
    // Today's unfinished feed of a chapter (the one a start of that chapter resumes, BUILD-1101 1.3).
    const openFeedOf = (key) => S.runs.find((r) => r.kind === 'feed' && r.chapter_key === key && istDay(Date.parse(r.created_at)) === S.day && Number(r.done_count) < Number(r.item_count));
    // A feed ended today having got to its last quarter counts as finished (the feed's own events only record answers and keeps).
    const finishedToday = (key) => S.recentFeeds.some((r) => {
      const of = Array.isArray(r.items) ? r.items.length : 0;
      return r.chapter_key === key && r.ended_at && istDay(Date.parse(r.created_at)) === S.day && of > 0 && (S.feedReach.get(r.id) || 0) >= 0.75 * of;
    });
    // On a cover with such a feed, the hook is the next card the feed has left (Play resumes it).
    const resumeHook = new Map();
    await Promise.all(list.filter((x) => openFeedOf(x.info.key)).map(async ({ info }) => {
      const open = openFeedOf(info.key);
      try {
        const [row, ev] = await Promise.all([store.run(userId, open.id), events(open.id)]);
        const done = new Set(ev.map((e) => e.item_id));
        const next = (row?.items || []).find((i) => i.type === 'card' && !done.has(i.id));
        // A start resumes this feed whatever the length, so every length's hook is its next card (null: only questions are left).
        resumeHook.set(info.key, next ? next.cardId : null);
      } catch { /* the hook falls back to the feed a new start would serve */ }
    }));
    // R12: For you first (with its reason), then book order from the chapter after it, wrapping (data/learn/feed.js).
    // A chapter whose feed was finished today is not offered again while another one qualifies (BUILD-1101 B7 item 4):
    // it keeps its place in the book order, but loses the mistakes and new cards that would make it the pick.
    const entries = list.map(({ order, info }) => ({
      key: info.key, title: info.title, order, chapterNo: info.chapterNo, cards: info.counts.open, questions: info.questions.length,
      mistakes: info.mistakes.length, lastActivityAt: info.lastActivityAt, hasNew: info.open.some((c) => !info.states.has(c.id)),
      openFeed: Boolean(openFeedOf(info.key)), info,
    }));
    const finished = new Set(entries.filter((e) => !e.openFeed && finishedToday(e.key)).map((e) => e.key));
    const eligible = entries.map((e) => (finished.has(e.key) ? { ...e, mistakes: 0, hasNew: false } : e));
    let ordered = coverOrder(eligible).map((c) => ({ ...entries.find((e) => e.key === c.key), forYou: c.forYou, reason: c.reason }));
    if (finished.size && finished.size < entries.length && finished.has(ordered[0].key)) {
      // Only the book-order fallback can still land on a finished chapter: take the next one that was not finished.
      const was = ordered[0];
      const at = entries.findIndex((e) => !finished.has(e.key) && e.order > was.order);
      const pickAt = at >= 0 ? at : entries.findIndex((e) => !finished.has(e.key));
      const rotated = [...entries.slice(pickAt), ...entries.slice(0, pickAt)];
      ordered = rotated.map((e, i) => ({ ...e, forYou: i === 0, reason: i === 0 ? `Next after ${was.title}` : null }));
    }
    // The book-order reason reads "First in the syllabus" (for Economics the first chapter of the syllabus is "Ch 2" of its book).
    if (ordered[0] && (ordered[0].reason === null || /^Chapter \d+ of your book$/.test(ordered[0].reason))) ordered[0] = { ...ordered[0], reason: 'First in the syllabus' };
    const hookOf = (id) => {
      const card = id ? cardOf(S, id) : null;
      if (!card) return null;
      return S.isOpen(card.id) ? { id: card.id, front: card.front, kind: card.kind, mustKnow: card.importance === 'must' } : { front: null, kind: card.kind, mustKnow: card.importance === 'must', locked: true };
    };
    const out = ordered.map(({ info, forYou, reason }) => {
      const counts = {};
      for (const m of FEED_RULES.lengths) {
        const rule = freeRule(S, { kind: 'feed', minutes: m });
        const plan = composeFor(S, info, { kind: 'feed', minutes: rule.minutes, leaveOut: ['lesson'] });
        // `capped` only when Free's 10-minute clamp really cut the run: the same feed at the asked length would have held more.
        const capped = Boolean(rule.capped) && composeFor(S, info, { kind: 'feed', minutes: m, leaveOut: ['lesson'] }).items.length > plan.items.length;
        // B7 4 and F4 1: the hook is the first card of THIS length's feed (what a start serves first), null when that run has no card;
        // an unfinished feed of the chapter is resumed by any start, so its next card is every length's hook.
        const firstId = resumeHook.has(info.key) ? resumeHook.get(info.key) : plan.items.find((i) => i.type === 'card')?.cardId || null;
        counts[m] = {
          cards: plan.piles.cards.count, questions: plan.piles.questions.count + plan.piles.mistakes.count,
          minutes: plan.shrunk && plan.realMinutes ? plan.realMinutes : rule.minutes,
          ...(capped ? { capped: true } : {}),
          // Why this length is shorter than asked (never "all it has today" for the 40-card cap): pool | cap | mistakes.
          ...(plan.shrunk && plan.shrink ? { shrink: { reason: plan.shrink.reason } } : {}),
          hook: hookOf(firstId),
        };
      }
      const runHere = S.runs.find((r) => r.kind === 'feed' && r.chapter_key === info.key && istDay(Date.parse(r.created_at)) === S.day && Number(r.done_count) > 0 && Number(r.done_count) < Number(r.item_count));
      const resume = runHere ? { runId: runHere.id, done: Number(runHere.done_count), of: Number(runHere.item_count), minutesLeft: minutesFor(Number(runHere.seconds_left) || 0) } : null;
      // One true line without due counts (A2 4.11): the stop, else the open mistakes, else the chapter's state, else "New to you".
      const studentLine = resume ? `You stopped at ${resume.done} of ${resume.of}`
        : info.mistakes.length ? `${plural(info.mistakes.length, 'open mistake')} to fix` : info.studied ? info.state.label : 'New to you';
      return {
        key: info.key, title: info.title, name: info.name, ref: info.ref, refLine: refLineOf(info), number: info.chapterNo ? Number(info.chapterNo) : null, partTitle: partTitleOf(info), unitTitle: unitTitleOf(info),
        reason, forYou,
        hook: counts[10].hook, // the top-level hook is the 10-minute length's (counts[m].hook is each length's own)
        state: info.state, studentLine, resume, counts,
        kept: info.counts.kept, due: info.counts.due, mistakes: info.mistakes.length, art: null,
      };
    }).filter((c) => FEED_RULES.lengths.some((m) => c.counts[m].cards + c.counts[m].questions > 0));
    return ok({
      subject: { id: sid, name: subjectName(sid) }, lengths: FEED_RULES.lengths, covers: out, history,
      free: !S.isPro && S.session ? { text: FREE_SESSION_DONE, maxMinutes: LEARN_FREE.maxMinutes } : null,
    });
  }

  // ---------------------------------------------------------------- GET /api/learn/cards

  function cardRows(S, info, filter) {
    const recent = S.now - LEARN_LIMITS.missedDays * DAY;
    const missedByQuestion = new Set();
    for (const m of info.mistakes) for (const id of S.questionsById.get(m.id)?.cards || []) missedByQuestion.add(id);
    const rows = info.open.map((card) => {
      const s = info.states.get(card.id);
      const inRevise = Boolean(s && !s.suspended);
      const missedLately = (s?.last_rating === 1 && Date.parse(s.last_review_at) >= recent) || missedByQuestion.has(card.id);
      return { ...card, inRevise, missedLately, locked: false };
    });
    const dueSet = new Set(info.dueIds);
    const counts = { total: info.counts.cards, all: rows.length, must: rows.filter((r) => r.importance === 'must').length, revise: rows.filter((r) => r.inRevise).length, missed: rows.filter((r) => r.missedLately).length, due: rows.filter((r) => dueSet.has(r.id)).length };
    const keep = rows.filter((r) => filter === 'all' || (filter === 'must' && r.importance === 'must') || (filter === 'revise' && r.inRevise) || (filter === 'missed' && r.missedLately) || (filter === 'due' && dueSet.has(r.id)));
    return { counts, keep };
  }

  async function cards(userId, p) {
    const filter = ['all', 'must', 'revise', 'missed', 'due'].includes(p.get('filter')) ? p.get('filter') : 'all';
    const me = await who(userId);
    const key = p.get('chapter');
    if (!key && p.get('subject')) {
      // One request for Find's shelf over the whole subject (A6 4.9).
      const sid = pickSubject(me, p.get('subject'));
      if (!sid) return bad('SUBJECT_NOT_FOUND', 404);
      const S = await snapshot(userId, me, sid);
      let locked = 0;
      const chapters = [];
      for (const ch of allowedChapters(S)) {
        const info = chapterInfo(S, ch.key);
        if (!info || !info.counts.cards) continue;
        locked += info.counts.cards - info.counts.open;
        const { counts, keep } = cardRows(S, info, filter);
        chapters.push({ key: info.key, title: info.title, ref: info.ref, counts, cards: keep });
      }
      return ok({ plan: S.isPro ? 'pro' : 'free', filter, lockedCount: locked, chapters });
    }
    const ch = typeof key === 'string' && key ? syllabus.chapterByKey(key) : null;
    if (!ch || ch.retired) return bad('CHAPTER_NOT_FOUND', 404);
    const S = await snapshot(userId, me, key.split('.')[0]);
    const info = chapterInfo(S, key);
    if (!info) return bad('CHAPTER_NOT_FOUND', 404);
    const { counts, keep } = cardRows(S, info, filter);
    const sections = [];
    for (const card of keep) {
      const title = card.source?.section || 'Other cards';
      let s = sections.find((x) => x.title === title);
      if (!s) { s = { title, cards: [] }; sections.push(s); }
      s.cards.push(card);
    }
    const lockedCount = info.counts.cards - info.counts.open;
    return ok({
      chapter: { key: info.key, title: info.title, ref: info.ref }, plan: S.isPro ? 'pro' : 'free', counts, sections, lockedCount,
      lockedLine: !S.isPro && lockedCount > 0 ? `${lockedCount} more ${lockedCount === 1 ? 'card' : 'cards'} in this chapter. Pro opens every card in every chapter and keeps them on a schedule.` : null,
    });
  }

  // ---------------------------------------------------------------- GET /api/learn/shelves

  async function shelves(userId, p) {
    const { me, sid } = await subjectAndMe(userId, p);
    if (!sid) return bad('SUBJECT_NOT_FOUND', 404);
    const S = await snapshot(userId, me, sid);
    return ok(await shelvesOf(S, sid, userId));
  }

  /** This subject's due Key cards from the snapshot: { count, minutes } (the live open rows; shelves.due and the offer's Revise row). */
  function dueNow(S) {
    const live = S.states.filter((s) => !s.suspended && S.isOpen(s.card_id) && S.pub.byId.has(s.card_id));
    const due = live.filter((s) => cardStage(s, S.now) === 'due');
    const seconds = due.reduce((sum, st) => sum + cardSeconds({ stage: 'due', words: cardWords(S.pub.byId.get(st.card_id)) }), 0);
    return { live, count: due.length, minutes: cardRunMinutes(due.length, seconds) };
  }

  /**
   * The Key cards due today: ONE function for both routes (R3 ruling C1). `mine` is this subject's own count (the live open rows);
   * every other subject is counted by the same rule from its own states. `all` is the sum, so the sidebar's dot, the subject rows and
   * Learn home's Revise row can never disagree, and /api/learn/home and /api/learn/shelves give the same `due.all` for one student.
   * A subject whose read fails is left out, never a zero.
   */
  async function dueSummary(S, sid, userId, mine) {
    const bySubject = { [sid]: mine };
    await Promise.all(S.subjects.filter((id) => id !== sid).map(async (id) => {
      try {
        const rows = await store.states(userId, { subject: id });
        const taste = S.isPro ? null : tasteIds(S.pub.cardsOf(id));
        bySubject[id] = rows.filter((s) => !s.suspended && (S.isPro || taste.has(s.card_id)) && S.pub.byId.has(s.card_id) && cardStage(s, S.now) === 'due').length;
      } catch { /* left out */ }
    }));
    return { bySubject, all: Object.values(bySubject).reduce((n, x) => n + (Number(x) || 0), 0) };
  }

  /** Find's shelves from a snapshot (the due numbers come from dueSummary). */
  async function shelvesOf(S, sid, userId) {
    const { live, count: due, minutes: dueMinutes } = dueNow(S);
    const recent = S.now - LEARN_LIMITS.missedDays * DAY;
    const missed = new Set(live.filter((s) => s.last_rating === 1 && Date.parse(s.last_review_at) >= recent).map((s) => s.card_id));
    for (const list of S.mistakes.values()) for (const m of list) for (const id of S.questionsById.get(m.id)?.cards || []) if (S.isOpen(id) && S.pub.byId.has(id)) missed.add(id);
    const must = S.cards.filter((x) => x.importance === 'must' && S.isOpen(x.id));
    const { bySubject, all } = await dueSummary(S, sid, userId, due);
    return {
      // The same count over every subject (the sidebar's dot, CRITIQUE-1 E2): the sum of bySubject, from dueSummary.
      due: { bySubject, count: due, minutes: dueMinutes, all, subjects: S.subjects.length },
      missed: { count: missed.size, days: LEARN_LIMITS.missedDays },
      revise: { count: live.length, chapters: new Set(live.map((s) => s.chapter_key)).size },
      must: { count: must.length, chapters: new Set(must.map((x) => x.chapterKey)).size },
    };
  }

  // ---------------------------------------------------------------- GET /api/learn/search

  async function search(userId, p) {
    const me = await who(userId);
    const sid = pickSubject(me, p.get('subject'));
    if (!sid) return bad('SUBJECT_NOT_FOUND', 404);
    const query = String(p.get('q') || '').slice(0, 80);
    const pub = await published();
    const cardsList = pub.cardsOf(sid);
    const taste = tasteIds(cardsList);
    const chapters = subjectChapters(sid).map((ch) => ({ key: ch.key, title: cleanTitle(ch.title || ch.name), name: ch.name, cards: cardsList.filter((x) => x.chapterKey === ch.key).length }));
    const titles = new Map(chapters.map((ch) => [ch.key, ch.title]));
    let lessons = [];
    try { lessons = lessonsFor ? await lessonsFor(userId, sid) : []; } catch { lessons = []; }
    return ok(searchSubject({
      query, chapters,
      lessons: lessons.map((l) => ({ id: l.id, title: l.title, chapterKey: l.chapterKey })),
      cards: [...cardsList].sort(bookOrder),
      chapterTitle: (k) => titles.get(k) || k,
      kindLabel: (k) => KIND_LABELS[k] || k,
      isOpen: (card) => me.isPro || taste.has(card.id),
      stub: lockedStub,
    }));
  }

  return { subject, home, preview, start, getRun, answer, rate, end, cards, shelves, search, covers, store, snapshot };
}
