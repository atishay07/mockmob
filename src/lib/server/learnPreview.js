// Development only: the Learn v2 routes (/api/learn/*, docs/brain/learn-1031/API-CONTRACT.md) for the visual preview
// (/preview/arena?view=learn2...&decks=real). src/lib/server/keycardsPreview.js hands every /api/learn/ path here with its
// in-memory student (the same memory db, the same &kcs, &plan and &student), so Learn and Key cards see one student.
//
// The logic is the pure, tested modules in data/learn/ (compose, suggest, search, stamps), which the production routes will
// reuse. What this file adds is the preview's data: the real decks (decksOnce with the Must-know re-tier of
// data/keycards/tiers.json, applied by loadDecks, so Key cards and Learn mark the same quarter), real questions from data/fixtures/learn-preview-
// questions.json (answer keys never leave this file before an answer), real lessons from the study catalog
// (data/study/pilot.json), and a believable returning history for the commerce student. Ratings go through the Key cards
// service (kc.review, the key_card_review memory RPC), so every stamp is the real FSRS next date.
//
// Production: never. keycardsPreview.js is imported only behind the NODE_ENV guard of src/app/preview/arena/realdeck.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadKeycardsSyllabus } from './keycardsSyllabus.js';
import { KIND_LABELS, cardMinutes, istDay, lineNeeded, lockedStub, memoryShare, schedule, tasteIds, KEYCARD_RULES } from '../../../data/keycards.js';
import { stateFor, tallyChapters } from '../../../data/chapter_state.js';
import { getCanonicalSubject } from '../../../data/canonical_syllabus.js';
import { LEARN_RULES, composeRun, dryRun, minutesFor, cardStage, isLong, mistakeLabel } from '../../../data/learn/compose.js';
import { suggestions, endOptions } from '../../../data/learn/suggest.js';
import { searchSubject } from '../../../data/learn/search.js';
import { IN_RUN, returnDay, revisePileGroups, shortDate } from '../../../data/learn/stamps.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ok = (body) => ({ http: 200, body });
const bad = (error, http = 422) => ({ http, body: { error } });

// ---------------------------------------------------------------- content read once per process

const STATE_KEYS = Object.freeze({ none: 'none', thin: 'thin', weak: 'needs_work', mid: 'getting_there', strong: 'holding', unknown: 'unknown' });
const PART_TITLES = Object.freeze({
  'Accountancy Part 1': 'Part 1, Partnership Accounts',
  'Accountancy Part 2': 'Part 2, Company Accounts and Analysis of Financial Statements',
});
const ENGLISH_NOTE = 'English cards are written for MockMob, not taken from an NCERT book.';
const LOOKS_TEXT = { keycard_reviews: "Today's 10 free card ratings are used. The rest of your cards show without ratings.", keycard_new: "Today's 5 new free cards are used. The rest of your cards show without ratings." };
const LOCKED_LINE = 'The line for this is in a card that is part of Pro.';
const MISSED_DAYS = 7; // "Missed lately" is the last 7 days (B 3.7)

const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;
/** A chapter title as the book prints it: "Retirement/Death of a Partner" is "Retirement and Death of a Partner" (A10). */
export const cleanTitle = (title) => String(title || '').replace(/\s*\/\s*/g, ' and ').replace(/\s+/g, ' ').trim();

let content = null;
async function contentOnce() {
  if (content) return content;
  const syllabus = await loadKeycardsSyllabus();
  const read = (file) => JSON.parse(readFileSync(path.join(process.cwd(), file), 'utf8'));
  let fixture = { questions: [] };
  try { fixture = read('data/fixtures/learn-preview-questions.json'); } catch { /* no questions: runs are cards only */ }
  const questions = new Map();
  for (const q of fixture.questions || []) {
    const resolved = syllabus.resolveChapter(q.subject, q.chapter);
    if (!resolved || resolved.retired || !q.id) continue;
    const raw = (q.options || []).map((o, i) => (typeof o === 'string' ? { key: 'ABCD'[i], text: o } : { key: o.key, text: o.text }));
    // Some stored options repeat their letter ("A. Written off ..."): strip it only when every option does.
    const prefixed = raw.every((o) => new RegExp(`^${o.key}[.)]?\\s`).test(o.text || ''));
    const options = raw.map((o) => ({ key: o.key, text: prefixed ? o.text.replace(new RegExp(`^${o.key}[.)]?\\s+`), '') : o.text }));
    questions.set(q.id, {
      id: q.id, subject: q.subject, chapter: q.chapter, chapterKey: resolved.key, body: q.body, options, words: wordCount(q.body),
      correct: q.correct_answer, explanation: q.explanation || '', difficulty: q.difficulty || null, cards: q.cards || [],
    });
  }
  let lessons = [];
  try {
    lessons = (read('data/study/pilot.json').units || []).map((u) => {
      const r = syllabus.resolveChapter(u.subject, u.chapter);
      return r && !r.retired ? { id: u.id, subject: u.subject, chapterKey: r.key, title: u.title, minutes: Number(u.estimatedMinutes) || null } : null;
    }).filter(Boolean);
  } catch { lessons = []; }
  content = { syllabus, questions: [...questions.values()], byQuestion: questions, lessons };
  return content;
}

// ---------------------------------------------------------------- the student's Learn state

const iso = (t) => new Date(t).toISOString();
const SEEN_DATES = { mock3: Date.parse('2026-10-16T11:20:00+05:30'), mock4: Date.parse('2026-10-24T10:40:00+05:30') };

/**
 * Learn's own state on a preview student. keycardsPreview.js makes it with the student (learnSeed), before any request is
 * answered, so the sidebar's due badge, Find and the chapter rows all read one student (CRITIQUE-1 E2).
 */
function learnState(ctx) {
  const { entry } = ctx;
  if (entry.learn) return entry.learn;
  entry.learn = { runs: new Map(), mistakes: new Map(), lessonsRead: new Set(), seq: 0 };
  if (!ctx.fresh) seedReturning(ctx);
  return entry.learn;
}

/**
 * The commerce student's returning history (only where the student takes Accountancy):
 *   Accounting for Partnership: Basic Concepts   3 due cards, 3 open mistakes from Mock 3 on 16 Oct, Getting there
 *   Admission of a Partner                        2 open mistakes (Mock 4, 24 Oct), an unfinished run (6 done)
 *   Accounting Ratios                             3 due cards (with Profit and Loss Appropriation Account, seeded by Key cards)
 * The answers are the chapter-state seed of keycardsPreview.js, with its wrong answers in these chapters made real fixture
 * questions, so the chapter state, the open mistakes and the questions a run serves agree.
 */
function seedReturning(ctx) {
  const { entry, user, now, isPro, c } = ctx;
  const L = entry.learn;
  const t = entry.tables;
  if (!entry.subjects.includes('accountancy')) return;
  const qs = (chapterKey) => c.questions.filter((q) => q.chapterKey === chapterKey);
  // The seeded mistakes are real questions a student gets wrong (medium first), short stems with an explanation first (E3).
  const pickMistakes = (chapterKey, n) => [...qs(chapterKey)].sort((a, b) => (isLong(a) ? 1 : 0) - (isLong(b) ? 1 : 0) || (a.explanation ? 0 : 1) - (b.explanation ? 0 : 1) || (a.difficulty === 'medium' ? 0 : 1) - (b.difficulty === 'medium' ? 0 : 1) || a.id.localeCompare(b.id)).slice(0, n);
  const markWrong = (q, at, where) => {
    t.user_question_progress.push({ user_id: user, question_id: q.id, subject: q.subject, chapter: q.chapter, attempt_count: 1, last_correct: false, last_attempted_at: iso(at), flow_context: 'mock' });
    L.mistakes.set(q.id, { chapterKey: q.chapterKey, where, when: shortDate(at), at, open: true });
  };
  // Partnership Fundamentals: the seed answered 9 (6 right); its 3 wrong stand-ins become 3 real questions from Mock 3.
  const pf = 'accountancy.partnership-fundamentals';
  const wrongPf = t.user_question_progress.filter((r) => r.subject === 'accountancy' && r.chapter === 'Partnership Fundamentals' && r.last_correct === false);
  t.user_question_progress = t.user_question_progress.filter((r) => !wrongPf.includes(r));
  pickMistakes(pf, 3).forEach((q, i) => markWrong(q, SEEN_DATES.mock3 + i * 90_000, 'Mock 3'));
  // Admission of Partner: 5 right stand-ins and 2 real wrong answers from Mock 4.
  const aop = 'accountancy.admission-of-partner';
  for (let k = 0; k < 5; k += 1) t.user_question_progress.push({ user_id: user, question_id: `preview-accountancy-aop-${k}`, subject: 'accountancy', chapter: 'Admission of Partner', attempt_count: 1, last_correct: true, last_attempted_at: iso(SEEN_DATES.mock4 + k * 60_000), flow_context: 'mock' });
  pickMistakes(aop, 2).forEach((q, i) => markWrong(q, SEEN_DATES.mock4 + (6 + i) * 60_000, 'Mock 4'));
  // Due cards: 3 in Partnership Fundamentals on every plan (Free's seed has 2), 3 in Accounting Ratios.
  const deck = entry.decks.bySubject.get('accountancy')?.cards || [];
  const taste = tasteIds(deck);
  const makeDue = (chapterKey, n) => {
    const list = deck.filter((x) => x.chapterKey === chapterKey && x.importance === 'must' && (isPro || taste.has(x.id))).sort((a, b) => (a.order || 0) - (b.order || 0));
    let due = list.filter((x) => isDue(t, user, x.id, now)).length;
    for (const card of list) {
      if (due >= n) break;
      if (isDue(t, user, card.id, now)) continue;
      const at = now - 6 * DAY - due * HOUR;
      const s = schedule(null, 3, at);
      const row = { user_id: user, card_id: card.id, subject: 'accountancy', chapter_key: chapterKey, schedule: s.schedule, reps: s.reps, lapses: s.lapses, due_at: s.due_at, last_review_at: iso(at), last_rating: 3, added_from: 'chapter', added_at: iso(now - 7 * DAY), suspended: false };
      const at_ = t.key_card_states.findIndex((r) => r.user_id === user && r.card_id === card.id);
      if (at_ >= 0) t.key_card_states[at_] = row; else t.key_card_states.push(row);
      due += 1;
    }
  };
  makeDue(pf, 3);
  makeDue('accountancy.accounting-ratios', 3);
  // An unfinished run in Admission of a Partner: a 7-minute mix started two hours ago, 6 items done.
  const run = createRun(ctx, { chapterKey: aop, minutes: 7, leaveOut: [], kind: 'mix' });
  if (run) {
    run.createdAt = now - 2 * HOUR;
    run.items.slice(0, 6).forEach((item) => {
      run.done.set(item.id, item.type === 'card' ? { rating: 3, saved: false, seeded: true } : { correct: true, seeded: true });
    });
  }
}

/** Make a preview student's Learn state now (the returning history for a commerce student). */
export async function learnSeed({ entry, isPro, student, user, fresh = false, now = Date.now() }) {
  const c = await contentOnce();
  return learnState({ entry, isPro, student, user, fresh, now, c });
}

const isDue = (t, user, cardId, now) => {
  const s = t.key_card_states.find((r) => r.user_id === user && r.card_id === cardId);
  return Boolean(s && Number(s.reps) > 0 && Date.parse(s.due_at) <= now);
};

// ---------------------------------------------------------------- reads over the preview student

function statesOf(ctx, subject = null) {
  return ctx.entry.tables.key_card_states.filter((s) => s.user_id === ctx.user && (!subject || s.subject === subject));
}
function progressOf(ctx, subject = null) {
  return ctx.entry.tables.user_question_progress.filter((r) => r.user_id === ctx.user && (!subject || r.subject === subject));
}
function allowanceUsed(ctx, kind) {
  const day = istDay(ctx.now);
  return ctx.entry.tables.learning_allowances.filter((r) => r.user_id === ctx.user && r.kind === kind && String(r.period).startsWith(`${day}:`)).length;
}
const ratingsLeft = (ctx) => (ctx.isPro ? null : Math.max(0, KEYCARD_RULES.free.reviewsPerDay - allowanceUsed(ctx, 'keycard_review')));
const newLeft = (ctx) => (ctx.isPro ? null : Math.max(0, KEYCARD_RULES.free.newPerDay - allowanceUsed(ctx, 'keycard_new')));
const optionOf = (ctx, subject) => ctx.entry.tables.student_subject_options.find((r) => r.user_id === ctx.user && r.subject === subject)?.option || null;
// "Economics / Business Economics" is "Economics" on Learn (no slashes in names, A10).
const subjectName = (id) => String(getCanonicalSubject(id)?.subject_name || id).split(/\s*\/\s*/)[0];
const subjectCards = (ctx, subject) => ctx.entry.decks.bySubject.get(subject)?.cards || [];
const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));

/** Everything Learn knows about one chapter for this student. */
function chapterInfo(ctx, key, cache = {}) {
  const { c } = ctx;
  const ch = c.syllabus.chapterByKey(key);
  if (!ch || ch.retired) return null;
  const subject = key.split('.')[0];
  const all = (cache.cards || subjectCards(ctx, subject)).filter((x) => x.chapterKey === key).sort(bookOrder);
  const taste = tasteIds(all);
  const open = ctx.isPro ? all : all.filter((x) => taste.has(x.id));
  const states = new Map((cache.states || statesOf(ctx, subject)).filter((s) => s.chapter_key === key).map((s) => [s.card_id, s]));
  const stateMap = (cache.stateMap || states);
  const progress = cache.progress || progressOf(ctx, subject);
  const seen = new Set(progress.filter((r) => Number(r.attempt_count) > 0).map((r) => r.question_id));
  const questions = c.questions.filter((q) => q.chapterKey === key).map((q) => ({ id: q.id, difficulty: q.difficulty, cards: q.cards, seen: seen.has(q.id), words: q.words }));
  const L = learnState(ctx);
  const mistakes = [...L.mistakes].filter(([qid, m]) => m.open && m.chapterKey === key && c.byQuestion.has(qid)).sort((a, b) => a[1].at - b[1].at).map(([id, m]) => ({ id, where: m.where, when: m.when }));
  const lessonRow = c.lessons.find((l) => l.chapterKey === key) || null;
  const lesson = lessonRow ? { id: lessonRow.id, title: lessonRow.title, minutes: lessonRow.minutes, read: L.lessonsRead.has(lessonRow.id) } : null;
  const mine = all.map((x) => stateMap.get(x.id)).filter(Boolean);
  const due = open.filter((x) => cardStage(stateMap.get(x.id), ctx.now) === 'due').length;
  const inRevise = open.filter((x) => { const s = stateMap.get(x.id); return s && !s.suspended; }).length;
  const tally = (cache.tally || tallyChapters(progress, c.syllabus.resolveChapter)).get(key) || { n: 0, right: 0, lastAt: null };
  const memory = mine.length ? memoryShare(mine, all, ctx.now) : null;
  const reviewed = mine.map((s) => Date.parse(s.last_review_at)).filter(Number.isFinite);
  const last = [tally.lastAt, ...reviewed].filter((x) => x !== null && Number.isFinite(x));
  const st = stateFor({ n: tally.n, right: tally.right, memory, lastActivityAt: last.length ? Math.max(...last) : null, now: ctx.now });
  const run = unfinishedRun(ctx, key);
  return {
    key, subject, ch, title: cleanTitle(ch.title || ch.name), name: ch.name, unit: ch.unit, section: ch.section || null,
    ref: ch.ncert?.chapter ? `Ch ${ch.ncert.chapter}` : null, chapterNo: ch.ncert?.chapter || null, book: ch.ncert?.book || null,
    all, open, taste, states: stateMap, questions, mistakes, lesson,
    counts: { cards: all.length, open: open.length, mustKnow: all.filter((x) => x.importance === 'must').length, openMust: open.filter((x) => x.importance === 'must').length, due, inRevise },
    linkedQuestions: questions.filter((q) => q.cards.some((id) => all.some((x) => x.id === id))).length,
    state: { key: STATE_KEYS[st.state] || 'unknown', label: st.fading ? `${st.label}, fading` : st.label },
    studied: tally.n > 0 || mine.some((s) => Number(s.reps) > 0),
    lastActivityAt: last.length ? Math.max(...last) : null,
    tally, memory, run,
  };
}

/** The chapters of a subject in book order (every unit, the part option's units too). */
function subjectChapters(ctx, subject) {
  return ctx.c.syllabus.unitsFor(subject, {}).flatMap((u) => u.chapters.map((ch) => ({ ...ch, unitTitle: u.unit })));
}

function nextChapterOf(ctx, key) {
  const subject = key.split('.')[0];
  const option = optionOf(ctx, subject);
  const list = subjectChapters(ctx, subject).filter((ch) => ctx.c.syllabus.sectionAllowed(subject, ch.section, option));
  const at = list.findIndex((ch) => ch.key === key);
  const cards = subjectCards(ctx, subject);
  const next = list.slice(at + 1).find((ch) => cards.some((x) => x.chapterKey === ch.key) || ctx.c.questions.some((q) => q.chapterKey === ch.key));
  return next ? { key: next.key, title: cleanTitle(next.title || next.name) } : null;
}

function rowMeta(info) {
  if (!info.counts.cards) return info.questions.length ? 'No Key cards yet. Questions ready.' : 'No Key cards yet.';
  const parts = [];
  if (info.run) parts.push(`${info.run.doneCount} of ${info.run.items.length} done today`);
  if (info.counts.due) parts.push(`${info.counts.due} due`);
  if (info.mistakes.length) parts.push(`${info.mistakes.length} open ${info.mistakes.length === 1 ? 'mistake' : 'mistakes'}`);
  if (info.lesson) parts.push('1 lesson');
  return parts.length ? parts.slice(0, 2).join(', ') : null;
}

function chapterRow(info) {
  return {
    key: info.key, title: info.title, ref: info.ref,
    cards: info.counts.cards, mustKnow: info.counts.mustKnow, due: info.counts.due, mistakes: info.mistakes.length, questions: info.questions.length,
    lesson: info.lesson, state: info.state, meta: rowMeta(info), marksOpen: null,
  };
}

// ---------------------------------------------------------------- runs

function unfinishedRun(ctx, key = null) {
  const L = ctx.entry.learn;
  if (!L) return null;
  const list = [...L.runs.values()].filter((r) => !r.ended && ['mix', 'cards'].includes(r.kind) && (!key || r.chapterKey === key)
    && ctx.now - r.createdAt < DAY && r.done.size > 0 && r.done.size < r.items.length);
  const run = list.sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  if (!run) return null;
  run.doneCount = run.items.filter((i) => run.done.has(i.id)).length;
  return run;
}

const itemSeconds = (item) => (item.type === 'question' ? LEARN_RULES.questionSeconds : item.type === 'lesson' ? (item.minutes || 0) * 60 : item.recap ? LEARN_RULES.recapSeconds : LEARN_RULES.cardSeconds);
const minutesLeft = (run) => minutesFor(run.items.filter((i) => !run.done.has(i.id)).reduce((s, i) => s + itemSeconds(i), 0));

function composeFor(ctx, info, { kind, minutes, leaveOut, cardIds = null }) {
  return composeRun({
    kind, minutes, leaveOut, cardIds, now: ctx.now,
    cards: info.open, states: info.states, questions: info.questions, mistakes: info.mistakes, lesson: info.lesson,
    ratingsLeft: ratingsLeft(ctx), newLeft: newLeft(ctx),
  });
}

/**
 * "Add the next chapter" (B 4.3 rule 5, honest shrink): when this chapter cannot fill the length, the next chapter in book
 * order fills the rest with its own recipe. Returns { plan, added } (added null when nothing was added).
 */
function withNext(ctx, info, plan, { kind, minutes, leaveOut }) {
  if (!plan.shrunk || !['mix', 'feed', 'cards'].includes(plan.kind)) return { plan, added: null };
  const next = nextChapterOf(ctx, info.key);
  const info2 = next ? chapterInfo(ctx, next.key) : null;
  const rest = minutes - plan.realMinutes;
  if (!info2 || rest < 1) return { plan, added: null };
  const more = composeFor(ctx, info2, { kind, minutes: rest, leaveOut });
  if (!more.items.length) return { plan, added: null };
  const sum = (id) => ({ count: plan.piles[id].count + more.piles[id].count, seconds: plan.piles[id].seconds + more.piles[id].seconds });
  const seconds = plan.seconds + more.seconds;
  const realMinutes = minutesFor(seconds);
  const available = Object.fromEntries(Object.keys(plan.available).map((k) => [k, plan.available[k] || more.available[k]]));
  return {
    plan: { ...plan, items: [...plan.items, ...more.items], seconds, realMinutes, shrunk: realMinutes < minutes, available, piles: { cards: sum('cards'), questions: sum('questions'), mistakes: sum('mistakes'), lesson: sum('lesson') } },
    added: { key: info2.key, title: info2.title },
  };
}

/** The questions of a level run: the first chapters in book order that have questions, until there are 6. */
function levelPool(ctx, subject) {
  const out = [];
  const progress = progressOf(ctx, subject);
  const seen = new Set(progress.map((r) => r.question_id));
  for (const ch of subjectChapters(ctx, subject)) {
    const qs = ctx.c.questions.filter((q) => q.chapterKey === ch.key);
    if (!qs.length) continue;
    out.push(...qs.map((q) => ({ id: q.id, difficulty: q.difficulty, cards: q.cards, seen: seen.has(q.id), words: q.words })));
    if (out.filter((q) => !q.seen).length >= LEARN_RULES.levelQuestions) break;
  }
  return out;
}

function createRun(ctx, { chapterKey, cardIds = null, minutes = 10, leaveOut = [], kind = 'mix', addNext = false }) {
  const L = learnState(ctx);
  let key = chapterKey;
  if (!key && Array.isArray(cardIds) && cardIds.length) key = ctx.entry.decks.byId.get(cardIds[0])?.chapterKey || null;
  const info = key ? chapterInfo(ctx, key) : null;
  if (!info) return null;
  let plan;
  let added = null;
  if (kind === 'level') {
    plan = composeRun({ kind: 'level', minutes, questions: levelPool(ctx, info.subject), now: ctx.now });
  } else if (Array.isArray(cardIds) && cardIds.length) {
    // Cards from Find may span chapters: the student's open cards among them, each with its own state.
    const open = cardIds.map((id) => ctx.entry.decks.byId.get(id)).filter((x) => x && (ctx.isPro || tasteIds(subjectCards(ctx, x.subject).filter((y) => y.chapterKey === x.chapterKey)).has(x.id)));
    const states = new Map(statesOf(ctx).map((s) => [s.card_id, s]));
    plan = composeRun({ kind: kind === 'recap' ? 'recap' : 'cards', minutes, cardIds: open.map((x) => x.id), cards: open, states, now: ctx.now, ratingsLeft: ratingsLeft(ctx), newLeft: newLeft(ctx) });
  } else {
    plan = composeFor(ctx, info, { kind, minutes, leaveOut });
    if (addNext) ({ plan, added } = withNext(ctx, info, plan, { kind, minutes, leaveOut }));
  }
  L.seq += 1;
  const id = `lr-${L.seq.toString(36)}-${Math.floor(ctx.now % 1e6).toString(36)}`;
  const items = plan.items.map((it, i) => ({ ...it, id: `${id}-i${i + 1}` }));
  const run = {
    id, kind: plan.kind, chapterKey: info.key, subject: info.subject, title: info.title, ref: info.ref, minutes: plan.shrunk && plan.realMinutes ? plan.realMinutes : plan.minutes,
    leaveOut: plan.leaveOut, items, done: new Map(), createdAt: ctx.now, startState: info.state, reinserted: new Set(), limit: null, ended: false, extra: 0,
    added,
  };
  // Cards past today's Free allowance are looks from the start: say why once (B 3.5, "Free ratings used").
  if (plan.kind !== 'recap' && items.some((i) => i.type === 'card' && i.look)) {
    run.looks = { text: ratingsLeft(ctx) === 0 ? LOOKS_TEXT.keycard_reviews : LOOKS_TEXT.keycard_new };
  }
  L.runs.set(id, run);
  return run;
}

function publicItem(ctx, run, item) {
  if (item.type === 'card') {
    const card = ctx.entry.decks.byId.get(item.cardId);
    return { id: item.id, type: 'card', stage: item.stage, card, look: Boolean(item.look || run.limit), recap: Boolean(item.recap) };
  }
  if (item.type === 'question') {
    const q = ctx.c.byQuestion.get(item.questionId);
    return { id: item.id, type: 'question', origin: item.origin, question: { id: q.id, body: q.body, options: q.options }, mistake: item.origin === 'mistake' ? item.mistake : null };
  }
  const lesson = ctx.c.lessons.find((l) => l.id === item.lessonId);
  return { id: item.id, type: 'lesson', lesson: { id: lesson.id, title: lesson.title, minutes: lesson.minutes } };
}

const revisePile = (run) => ({ count: [...run.done.values()].filter((d) => d.saved && (d.rating === 3 || d.rating === 4)).length });

function runBody(ctx, run, { resumed = false } = {}) {
  const items = run.items.filter((i) => !resumed || !run.done.has(i.id));
  return {
    id: run.id, kind: run.kind, chapter: { key: run.chapterKey, title: run.title, ref: run.ref }, minutes: run.minutes,
    items: items.map((i) => publicItem(ctx, run, i)),
    revisePile: revisePile(run),
    resumed: resumed ? { done: run.items.length - items.length, of: run.items.length } : null,
    added: run.added || null,
    looks: run.limit || run.looks || null,
  };
}

/** Put a card back into the run `gap` items after position `at` (once per card per run). */
function reinsertCard(ctx, run, cardId, at, gap = 3) {
  if (run.reinserted.has(cardId)) return null;
  const card = ctx.entry.decks.byId.get(cardId);
  if (!card) return null;
  run.reinserted.add(cardId);
  run.extra += 1;
  const item = { id: `${run.id}-r${run.extra}`, type: 'card', cardId, stage: 'again', look: Boolean(run.limit) };
  const pos = Math.min(run.items.length, at + gap);
  run.items.splice(pos, 0, item);
  return { itemId: item.id, at: pos, item: publicItem(ctx, run, item) };
}

// ---------------------------------------------------------------- handlers

async function subjectRead(ctx, p) {
  const { c, entry } = ctx;
  const own = entry.subjects;
  const subject = p.get('subject') || own[0];
  if (!own.includes(subject) && !entry.decks.bySubject.has(subject)) return bad('SUBJECT_NOT_FOUND', 404);
  const cards = subjectCards(ctx, subject);
  const states = statesOf(ctx, subject);
  const stateMap = new Map(states.map((s) => [s.card_id, s]));
  const progress = progressOf(ctx, subject);
  const tally = tallyChapters(progress, c.syllabus.resolveChapter);
  const cache = { cards, states, stateMap, progress, tally };
  const option = optionOf(ctx, subject);
  const opts = c.syllabus.subjectOptions(subject);
  const units = c.syllabus.unitsFor(subject, {});
  const infos = new Map();
  for (const u of units) for (const ch of u.chapters) infos.set(ch.key, chapterInfo(ctx, ch.key, cache));
  // Parts: units grouped by their NCERT book; a unit open to only one option joins the part above with that option.
  const parts = [];
  for (const u of units) {
    const first = u.chapters[0];
    const optionId = opts?.choices?.some((x) => x.id === first?.section) ? first.section : null;
    const book = first?.ncert?.book || null;
    let part = parts[parts.length - 1];
    if (!part || (!optionId && part.book !== book)) {
      part = { id: `p${parts.length + 1}`, book, title: PART_TITLES[book] || book || (subject === 'english' ? 'CUET English' : subjectName(subject)), option: null, units: [] };
      parts.push(part);
    }
    if (optionId && !part.option) {
      part.option = { label: 'Your part', choices: opts.choices.map((x) => ({ id: x.id, label: x.label })), chosen: option, hint: option ? "Only your part's chapters show here and in your practice." : 'Both parts show until you choose.' };
    }
    part.units.push({ title: u.unit, optionId, chapters: u.chapters.map((ch) => chapterRow(infos.get(ch.key))) });
  }
  const allowed = [...infos.values()].filter((i) => c.syllabus.sectionAllowed(subject, i.section, option));
  const isNew = !states.length && !progress.length;
  const run = unfinishedRun(ctx);
  const runInSubject = run && run.subject === subject ? run : null;
  const lessons = c.lessons.filter((l) => l.subject === subject);
  const sugg = suggestions({
    subject: { id: subject, name: subjectName(subject), cards: cards.length },
    isNew,
    chapters: allowed.map((i) => ({
      key: i.key, title: i.title, chapterNo: i.chapterNo, book: i.book, cards: i.counts.cards, mustKnow: ctx.isPro ? i.counts.mustKnow : i.counts.openMust,
      due: i.counts.due, mistakes: i.mistakes.length, questions: i.questions.length, studied: i.studied, lastActivityAt: i.lastActivityAt,
      mistakeWhere: i.mistakes[0]?.where, mistakeWhen: i.mistakes[0]?.when,
    })),
    run: runInSubject ? { id: runInSubject.id, chapterKey: runInSubject.chapterKey, title: runInSubject.title, done: runInSubject.doneCount, of: runInSubject.items.length, minutesLeft: minutesLeft(runInSubject), kind: runInSubject.kind, leaveOut: runInSubject.leaveOut } : null,
    level: { questions: levelPool(ctx, subject).filter((q) => !q.seen).length || levelPool(ctx, subject).length },
  });
  return ok({
    plan: ctx.isPro ? 'pro' : 'free',
    student: { isNew },
    subjects: own.map((id) => ({ id, name: subjectName(id) })),
    subject: { id: subject, name: subjectName(subject), cards: cards.length, chapters: infos.size, lessons: lessons.length, note: subject === 'english' ? ENGLISH_NOTE : null },
    freeNote: ctx.isPro ? null : `Free opens ${KEYCARD_RULES.free.tastePerChapter} cards in every chapter. Pro opens all ${cards.length}.`,
    suggestions: sugg,
    parts: parts.map(({ book: _b, ...rest }) => rest),
  });
}

function unitTitleOf(info) {
  const unit = String(info.unit || '').trim();
  if (!unit) return null;
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return norm(info.title).startsWith(norm(unit)) ? null : unit;
}

function partTitleOf(ctx, info) {
  const book = info.book;
  return PART_TITLES[book] || book || null;
}

async function previewRead(ctx, body) {
  const key = body?.chapterKey;
  const info = typeof key === 'string' ? chapterInfo(ctx, key) : null;
  if (!info) return bad('CHAPTER_NOT_FOUND', 404);
  const minutes = Math.max(1, Math.min(240, Math.round(Number(body?.minutes) || 10)));
  const leaveOut = Array.isArray(body?.leaveOut) ? body.leaveOut : [];
  let run = composeFor(ctx, info, { kind: 'mix', minutes, leaveOut });
  let added = null;
  if (body?.addNext === true) ({ plan: run, added } = withNext(ctx, info, run, { kind: 'mix', minutes, leaveOut }));
  const recapRun = composeFor(ctx, info, { kind: 'recap', minutes: 5, leaveOut: [] });
  const dry = dryRun({ run, recapRun, isPro: ctx.isPro, firstVisit: !info.studied, ratingsLeft: ratingsLeft(ctx), chapter: { total: info.counts.cards, open: info.counts.open }, nextChapter: added ? null : nextChapterOf(ctx, info.key) });
  return ok({
    // The unit is left out when the title already starts with it ("Accounting for Partnership" over "Accounting for
    // Partnership: Basic Concepts", CRITIQUE-1 C4): the part names the place instead.
    chapter: { key: info.key, title: info.title, ref: info.ref, partTitle: partTitleOf(ctx, info), unitTitle: unitTitleOf(info), state: info.state },
    ...dry,
    added,
    shelf: {
      cards: { count: info.counts.cards, open: info.counts.open, mustKnow: info.counts.mustKnow, inRevise: info.counts.inRevise },
      questions: { linked: info.linkedQuestions, total: info.questions.length },
      mistakes: { open: info.mistakes.length },
      lesson: info.lesson,
      print: { mustKnow: info.counts.mustKnow, locked: !ctx.isPro },
    },
  });
}

async function runStart(ctx, body) {
  const L = learnState(ctx);
  const kind = ['mix', 'recap', 'cards', 'feed', 'level'].includes(body?.kind) ? body.kind : 'mix';
  const minutes = Math.max(1, Math.min(240, Math.round(Number(body?.minutes) || 10)));
  // Pick up: an explicit resume id, or the same chapter, kind and length as the unfinished run's minutes left.
  const open = body?.chapterKey ? unfinishedRun(ctx, body.chapterKey) : null;
  const resume = (body?.resume && L.runs.get(body.resume)) || (open && open.kind === kind && minutesLeft(open) === minutes ? open : null);
  if (resume && !resume.ended && resume.done.size < resume.items.length) return ok(runBody(ctx, resume, { resumed: true }));
  const cardIds = Array.isArray(body?.cardIds) ? body.cardIds.filter((x) => typeof x === 'string').slice(0, LEARN_RULES.maxCardIds) : null;
  if (!body?.chapterKey && !cardIds?.length) return bad('CHAPTER_OR_CARDS_REQUIRED');
  const run = createRun(ctx, { chapterKey: body?.chapterKey, cardIds, minutes, leaveOut: Array.isArray(body?.leaveOut) ? body.leaveOut : [], kind, addNext: body?.addNext === true });
  if (!run) return bad('CHAPTER_NOT_FOUND', 404);
  return ok(runBody(ctx, run));
}

function runOf(ctx, id) {
  return learnState(ctx).runs.get(id) || null;
}

async function runAnswer(ctx, id, body) {
  const run = runOf(ctx, id);
  if (!run) return bad('RUN_NOT_FOUND', 404);
  const at = run.items.findIndex((i) => i.id === body?.itemId);
  const item = run.items[at];
  if (!item || item.type !== 'question') return bad('ITEM_NOT_A_QUESTION');
  const choice = String(body?.choice ?? '').trim().toUpperCase();
  const q = ctx.c.byQuestion.get(item.questionId);
  if (!q.options.some((o) => o.key === choice)) return bad('INVALID_CHOICE');
  if (run.done.has(item.id)) return ok(run.done.get(item.id).body);
  const correct = choice === q.correct;
  const L = learnState(ctx);
  const t = ctx.entry.tables;
  // The answer is recorded as an Explore answer is (flow_context 'learn'): chapter state moves, a wrong answer opens a mistake.
  const row = t.user_question_progress.find((r) => r.user_id === ctx.user && r.question_id === q.id);
  const stamp = { last_correct: correct, last_attempted_at: iso(ctx.now), flow_context: 'learn' };
  if (row) Object.assign(row, stamp, { attempt_count: (Number(row.attempt_count) || 0) + 1 });
  else t.user_question_progress.push({ user_id: ctx.user, question_id: q.id, subject: q.subject, chapter: q.chapter, attempt_count: 1, ...stamp });
  const mistake = L.mistakes.get(q.id);
  const fixed = Boolean(correct && item.origin === 'mistake' && mistake?.open);
  if (fixed) mistake.open = false;
  if (!correct && !mistake?.open) L.mistakes.set(q.id, { chapterKey: q.chapterKey, where: 'Learn', when: shortDate(ctx.now), at: ctx.now, open: true });
  // The line you needed: the question's linked card (by words otherwise), on a wrong answer and under a fixed mistake.
  let line = null;
  let reinsert = null;
  if (!correct || fixed) {
    const found = lineNeeded(q.id, { [q.id]: q.cards }, ctx.entry.decks.byId, { chapterKey: q.chapterKey, text: `${q.body} ${q.explanation}` });
    const card = found.cards[0] || null;
    if (card) {
      const info = chapterInfo(ctx, card.chapterKey);
      const openCard = ctx.isPro || info?.taste.has(card.id);
      line = openCard ? { card, source: found.source, collapsed: fixed } : { card: lockedStub(card), locked: true, text: LOCKED_LINE };
      const ratedWell = [...run.done.entries()].some(([iid, d]) => (d.rating === 3 || d.rating === 4) && run.items.find((i) => i.id === iid)?.cardId === card.id);
      if (!correct && openCard && !ratedWell) reinsert = reinsertCard(ctx, run, card.id, at);
    }
  }
  const out = {
    correct, key: q.correct, explanation: q.explanation, fixed,
    fixedText: fixed && mistake ? `Fixed. ${mistakeLabel(mistake.where, mistake.when)}.` : null,
    line, reinsert,
  };
  run.done.set(item.id, { correct, fixed, origin: item.origin, body: out });
  return ok(out);
}

async function runRate(ctx, id, body) {
  const run = runOf(ctx, id);
  if (!run) return bad('RUN_NOT_FOUND', 404);
  const at = run.items.findIndex((i) => i.id === body?.itemId);
  const item = run.items[at];
  if (!item) return bad('ITEM_NOT_FOUND', 404);
  if (item.type === 'lesson') {
    learnState(ctx).lessonsRead.add(item.lessonId);
    run.done.set(item.id, { lesson: true });
    return ok({ ok: true, stamp: null, revisePile: revisePile(run), limit: null });
  }
  if (item.type !== 'card') return bad('ITEM_NOT_A_CARD');
  if (run.done.has(item.id)) {
    const d = run.done.get(item.id);
    return ok({ ok: true, replay: true, stamp: d.stamp ?? null, revisePile: revisePile(run), limit: run.limit });
  }
  // The Explore feed's Keep: the card joins Revise, nothing else is scheduled.
  if (body?.keep === true) {
    const res = await ctx.entry.kc.add(ctx.user, { cardIds: [item.cardId] });
    if (res.http !== 200) return { http: res.http, body: res.body };
    run.done.set(item.id, { kept: true, stamp: 'In Revise' });
    return ok({ ok: true, kept: true, stamp: 'In Revise', revisePile: revisePile(run), limit: null });
  }
  const rating = Number(body?.rating);
  if (![1, 3, 4].includes(rating)) return bad('INVALID_RATING');
  // A recap card or a look: logged as a last look (recap) or not at all, never scheduled, no allowance.
  if (run.kind === 'recap' || item.recap) {
    await ctx.entry.kc.review(ctx.user, { cardId: item.cardId, rating, mode: 'last_look' });
    run.done.set(item.id, { look: true });
    return ok({ ok: true, stamp: null, revisePile: revisePile(run), limit: null });
  }
  if (item.look || run.limit) {
    run.done.set(item.id, { look: true });
    return ok({ ok: true, saved: false, look: true, stamp: null, revisePile: revisePile(run), limit: run.limit || run.looks || null });
  }
  const res = await ctx.entry.kc.review(ctx.user, { cardId: item.cardId, rating, mode: 'study', clientReviewedAt: iso(ctx.now) });
  if (res.http === 402) {
    run.limit = { text: LOOKS_TEXT[res.body?.reason] || LOOKS_TEXT.keycard_reviews };
    run.done.set(item.id, { look: true, limitHit: true });
    return ok({ ok: true, saved: false, look: true, stamp: null, revisePile: revisePile(run), limit: run.limit });
  }
  if (res.http !== 200) return { http: res.http, body: res.body };
  const dueAt = res.body.next?.due_at || null;
  let stamp = dueAt ? returnDay(dueAt, ctx.now).stamp : null;
  let reinsert = null;
  if (rating === 1) {
    reinsert = item.stage === 'again' ? null : reinsertCard(ctx, run, item.cardId, at);
    if (reinsert) stamp = IN_RUN;
  }
  run.done.set(item.id, { rating, saved: true, dueAt, stamp });
  return ok({ ok: true, stamp, revisePile: revisePile(run), limit: null, reinsert });
}

async function runEnd(ctx, id) {
  const run = runOf(ctx, id);
  if (!run) return bad('RUN_NOT_FOUND', 404);
  const info = chapterInfo(ctx, run.chapterKey);
  const done = [...run.done.values()].filter((d) => !d.seeded);
  const rated = done.filter((d) => d.saved);
  const n = (r) => rated.filter((d) => d.rating === r).length;
  const looks = done.filter((d) => d.look).length;
  // Questions and mistakes are counted apart (CRITIQUE-1 E5): "3 questions answered" and "2 mistakes fixed" after a run of
  // 3 questions and 2 mistakes, never "5 questions answered".
  const answeredAll = done.filter((d) => typeof d.correct === 'boolean');
  const answered = answeredAll.filter((d) => d.origin !== 'mistake');
  const right = answered.filter((d) => d.correct).length;
  const mistakesIn = run.items.filter((i) => i.type === 'question' && i.origin === 'mistake');
  const mistakesTried = answeredAll.filter((d) => d.origin === 'mistake').length;
  const fixed = answeredAll.filter((d) => d.fixed).length;
  const cardsText = run.kind === 'recap'
    ? `${looks} looked at, nothing scheduled`
    : [n(3) ? `${n(3)} got it` : null, n(4) ? `${n(4)} easy` : null, n(1) ? `${n(1)} missed` : null, looks ? `${looks} looked at` : null].filter(Boolean).join(', ');
  const still = mistakesIn.length - fixed;
  const mistakesText = mistakesIn.length ? (still ? `${fixed} of ${mistakesIn.length} fixed, ${still} still open` : `${fixed} of ${mistakesIn.length} fixed`) : '';
  const lines = [];
  if (cardsText) lines.push({ label: 'Cards', text: cardsText });
  if (answered.length) lines.push({ label: 'Questions', text: `${right} of ${answered.length} right` });
  if (mistakesIn.length) lines.push({ label: 'Mistakes', text: mistakesText });
  // One line of detail under each number (R6), so the screen need not repeat the numbers as a table.
  const detail = {
    cards: run.kind === 'recap' ? 'nothing scheduled' : [n(3) ? `${n(3)} got it` : null, n(4) ? `${n(4)} easy` : null, n(1) ? `${n(1)} missed` : null].filter(Boolean).join(', ') || null,
    questions: answered.length ? `${right} of ${answered.length} right` : null,
    fixed: mistakesIn.length ? `${fixed} of ${mistakesIn.length}${still ? `, ${still} still open` : ''}` : null,
  };
  const groups = revisePileGroups(rated.map((d) => d.dueAt).filter(Boolean), ctx.now);
  const moved = ctx.isPro && info && run.startState && info.state.key !== run.startState.key ? `${info.title} moved from ${run.startState.label} to ${info.state.label}.` : null;
  const free = !ctx.isPro && run.limit ? { text: `Free opened ${info.counts.open} of this chapter's ${info.counts.cards} cards. Pro opens all of them and keeps them on a schedule.` } : null;
  // The next options (B 3.6).
  const subject = run.subject;
  const L = learnState(ctx);
  const elsewhere = new Map();
  for (const [qid, m] of L.mistakes) if (m.open && m.chapterKey !== run.chapterKey && m.chapterKey.startsWith(`${subject}.`) && ctx.c.byQuestion.has(qid)) elsewhere.set(m.chapterKey, (elsewhere.get(m.chapterKey) || 0) + 1);
  const top = [...elsewhere].sort((a, b) => b[1] - a[1])[0];
  const topInfo = top ? chapterInfo(ctx, top[0]) : null;
  const dueAll = dueIn(ctx, subject);
  const fresh = info ? info.open.filter((x) => cardStage(info.states.get(x.id), ctx.now) === 'new').length : 0;
  const opts = endOptions({
    subject, chapter: { key: run.chapterKey, title: run.title }, minutes: ['mix', 'feed'].includes(run.kind) ? run.minutes : 10, missed: n(1), fresh: Math.min(fresh, 3),
    next: nextChapterOf(ctx, run.chapterKey), mistakeElsewhere: topInfo ? { key: topInfo.key, title: topInfo.title, count: top[1] } : null,
    due: { count: dueAll }, mustKnow: info ? (ctx.isPro ? info.counts.mustKnow : info.counts.openMust) : 0,
  });
  run.ended = true;
  return ok({
    title: run.kind === 'recap' ? `Quick recap of ${run.title}` : `${run.minutes} ${run.minutes === 1 ? 'minute' : 'minutes'} on ${run.title}`,
    numbers: { cards: rated.length, questions: answered.length, fixed, mistakes: mistakesTried, detail },
    lines,
    revisePile: groups,
    moved, free,
    lead: opts.lead, options: opts.options,
  });
}

async function cardsRead(ctx, p) {
  const key = p.get('chapter');
  const info = key ? chapterInfo(ctx, key) : null;
  if (!info) return bad('CHAPTER_NOT_FOUND', 404);
  const filter = ['all', 'must', 'revise', 'missed'].includes(p.get('filter')) ? p.get('filter') : 'all';
  const L = learnState(ctx);
  const missedByQuestion = new Set();
  for (const [qid, m] of L.mistakes) if (m.open && m.chapterKey === key) for (const id of ctx.c.byQuestion.get(qid)?.cards || []) missedByQuestion.add(id);
  const recent = ctx.now - MISSED_DAYS * DAY;
  const rows = info.open.map((card) => {
    const s = info.states.get(card.id);
    const inRevise = Boolean(s && !s.suspended);
    const missedLately = (s?.last_rating === 1 && Date.parse(s.last_review_at) >= recent) || missedByQuestion.has(card.id);
    return { ...card, inRevise, missedLately, locked: false };
  });
  const counts = { total: info.counts.cards, all: rows.length, must: rows.filter((r) => r.importance === 'must').length, revise: rows.filter((r) => r.inRevise).length, missed: rows.filter((r) => r.missedLately).length };
  const keep = rows.filter((r) => filter === 'all' || (filter === 'must' && r.importance === 'must') || (filter === 'revise' && r.inRevise) || (filter === 'missed' && r.missedLately));
  const sections = [];
  for (const card of keep) {
    const title = card.source?.section || 'Other cards';
    let s = sections.find((x) => x.title === title);
    if (!s) { s = { title, cards: [] }; sections.push(s); }
    s.cards.push(card);
  }
  const lockedCount = info.counts.cards - info.counts.open;
  return ok({
    chapter: { key: info.key, title: info.title, ref: info.ref }, plan: ctx.isPro ? 'pro' : 'free', counts, sections,
    lockedCount,
    lockedLine: !ctx.isPro && lockedCount > 0 ? `${lockedCount} more ${lockedCount === 1 ? 'card' : 'cards'} in this chapter. Pro opens every card in every chapter and keeps them on a schedule.` : null,
  });
}

/** Due cards of one subject the student may open (Free: the taste cards), not suspended: one rule for every due count. */
function dueIn(ctx, subject) {
  const taste = tasteIds(subjectCards(ctx, subject));
  return statesOf(ctx, subject).filter((s) => !s.suspended && (ctx.isPro || taste.has(s.card_id)) && ctx.entry.decks.byId.has(s.card_id) && cardStage(s, ctx.now) === 'due').length;
}

async function shelvesRead(ctx, p) {
  const subject = p.get('subject') || ctx.entry.subjects[0];
  const cards = subjectCards(ctx, subject);
  const taste = tasteIds(cards);
  const openCard = (id) => ctx.isPro || taste.has(id);
  const states = statesOf(ctx, subject).filter((s) => !s.suspended && openCard(s.card_id) && ctx.entry.decks.byId.has(s.card_id));
  const due = states.filter((s) => cardStage(s, ctx.now) === 'due').length;
  // The same count over every subject of the student: the Learn sidebar's due badge (Revise is one queue), CRITIQUE-1 E2.
  const dueAll = ctx.entry.subjects.reduce((sum, id) => sum + dueIn(ctx, id), 0);
  const recent = ctx.now - MISSED_DAYS * DAY;
  const missed = new Set(states.filter((s) => s.last_rating === 1 && Date.parse(s.last_review_at) >= recent).map((s) => s.card_id));
  for (const [qid, m] of learnState(ctx).mistakes) if (m.open && m.chapterKey.startsWith(`${subject}.`)) for (const id of ctx.c.byQuestion.get(qid)?.cards || []) if (openCard(id)) missed.add(id);
  const must = cards.filter((x) => x.importance === 'must' && openCard(x.id));
  return ok({
    due: { count: due, minutes: cardMinutes(due), all: dueAll, subjects: ctx.entry.subjects.length },
    missed: { count: missed.size, days: MISSED_DAYS },
    revise: { count: states.length, chapters: new Set(states.map((s) => s.chapter_key)).size },
    must: { count: must.length, chapters: new Set(must.map((x) => x.chapterKey)).size },
  });
}

async function searchRead(ctx, p) {
  const subject = p.get('subject') || ctx.entry.subjects[0];
  const cards = subjectCards(ctx, subject);
  const taste = tasteIds(cards);
  const chapters = subjectChapters(ctx, subject).map((ch) => ({ key: ch.key, title: cleanTitle(ch.title || ch.name), name: ch.name, cards: cards.filter((x) => x.chapterKey === ch.key).length }));
  const titles = new Map(chapters.map((ch) => [ch.key, ch.title]));
  const out = searchSubject({
    query: p.get('q') || '',
    chapters,
    lessons: ctx.c.lessons.filter((l) => l.subject === subject).map((l) => ({ id: l.id, title: l.title, chapterKey: l.chapterKey })),
    cards: [...cards].sort(bookOrder),
    chapterTitle: (k) => titles.get(k) || k,
    kindLabel: (k) => KIND_LABELS[k] || k,
    isOpen: (card) => ctx.isPro || taste.has(card.id),
    stub: lockedStub,
  });
  return ok(out);
}

/**
 * One /api/learn/ request of a preview student.
 *   entry    the preview student of keycardsPreview.js ({ kc, tables, decks, subjects })
 *   to       the API path asked for     method, params (URLSearchParams), body (parsed JSON or null)
 */
export async function learnAnswer({ entry, to, method, params, body, isPro, student, user, fresh = false, now = Date.now() }) {
  const c = await contentOnce();
  const ctx = { entry, isPro, student, user, fresh, now, c };
  learnState(ctx);
  const m = String(method || 'GET').toUpperCase();
  const run = /^\/api\/learn\/runs\/([^/]+)\/(answer|rate|end)$/.exec(to);
  if (m === 'GET' && to === '/api/learn/subject') return subjectRead(ctx, params);
  if (m === 'POST' && to === '/api/learn/runs/preview') return previewRead(ctx, body);
  if (m === 'POST' && to === '/api/learn/runs') return runStart(ctx, body);
  if (run && m === 'POST' && run[2] === 'answer') return runAnswer(ctx, decodeURIComponent(run[1]), body);
  if (run && m === 'POST' && run[2] === 'rate') return runRate(ctx, decodeURIComponent(run[1]), body);
  if (run && m === 'GET' && run[2] === 'end') return runEnd(ctx, decodeURIComponent(run[1]));
  if (m === 'GET' && to === '/api/learn/cards') return cardsRead(ctx, params);
  if (m === 'GET' && to === '/api/learn/shelves') return shelvesRead(ctx, params);
  if (m === 'GET' && to === '/api/learn/search') return searchRead(ctx, params);
  return { http: 404, body: { error: 'NOT_A_LEARN_ROUTE' } };
}

