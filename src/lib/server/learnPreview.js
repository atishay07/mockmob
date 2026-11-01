// Development only: the seed of the Learn v2 preview (/preview/arena?view=learn2...&decks=real). The routes themselves are the
// production service (src/lib/server/learn.js, createLearn) over the in-memory client (keycardsMemoryDb.js), so the preview
// runs the code that ships and data/tests/learn_preview.test.mjs and learn_feed.test.mjs are parity tests of it.
// src/lib/server/keycardsPreview.js hands every /api/learn/ path here with its in-memory student (the same tables, the same
// &kcs, &plan and &student), so Learn and Key cards see one student.
//
// What this file adds is the preview's data, none of which production uses:
//   - the question index: real questions from data/fixtures/learn-preview-questions.json (their rows, keys included, sit in the
//     memory `questions` table; the service reads a key only at answer time, as in production);
//   - lessons: the study catalog (data/study/pilot.json), read when a lesson event of this student says so;
//   - a believable returning history for the commerce student (wrong answers from "Mock 3" and "Mock 4", due cards and an
//     unfinished run), and the places of those mistakes.
//
// Production: never. keycardsPreview.js is imported only behind the NODE_ENV guard of src/app/preview/arena/realdeck.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadKeycardsSyllabus } from './keycardsSyllabus.js';
import { fakeDb } from './keycardsMemoryDb.js';
import { createLearn, cleanTitle as titleOf, servedOptions } from './learn.js';
import { schedule, tasteIds } from '../../../data/keycards.js';
import { isLong } from '../../../data/learn/compose.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const IST_MS = 19_800_000;
const iso = (t) => new Date(t).toISOString();
const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;
/** A chapter title as the book prints it (kept here for older importers; learn.js holds the rule). */
export const cleanTitle = titleOf;

// ---------------------------------------------------------------- content read once per process

let content = null;
async function contentOnce() {
  if (content) return content;
  const syllabus = await loadKeycardsSyllabus();
  const read = (file) => JSON.parse(readFileSync(path.join(process.cwd(), file), 'utf8'));
  let fixture = { questions: [] };
  try { fixture = read('data/fixtures/learn-preview-questions.json'); } catch { /* no questions: runs are cards only */ }
  const index = new Map(); // subject -> [entry]
  const rows = [];
  for (const q of fixture.questions || []) {
    const resolved = syllabus.resolveChapter(q.subject, q.chapter);
    if (!resolved || resolved.retired || !q.id) continue;
    const options = servedOptions(q.options);
    const entry = {
      id: q.id, subject: q.subject, chapter: q.chapter, chapterKey: resolved.key, body: q.body, options, words: wordCount(q.body),
      difficulty: q.difficulty || null, cards: q.cards || [], chash: `fixture-${q.id}`, managed: false,
    };
    index.set(q.subject, [...(index.get(q.subject) || []), entry]);
    rows.push({
      id: q.id, subject: q.subject, chapter: q.chapter, question: q.body, body: q.body, options: q.options, correct_answer: q.correct_answer,
      explanation: q.explanation || '', difficulty: q.difficulty || null, status: 'live', is_deleted: false, verification_state: 'verified',
      content_hash: `fixture-${q.id}`, updated_at: '2026-10-31T00:00:00Z',
    });
  }
  let lessons = [];
  try {
    lessons = (read('data/study/pilot.json').units || []).map((u, i) => {
      const r = syllabus.resolveChapter(u.subject, u.chapter);
      return r && !r.retired ? { id: u.id, subject: u.subject, chapter: u.chapter, chapterKey: r.key, title: u.title, minutes: Number(u.estimatedMinutes) || null, order: i } : null;
    }).filter(Boolean);
  } catch { lessons = []; }
  content = { syllabus, index, rows, lessons };
  return content;
}

// ---------------------------------------------------------------- the service of one preview student

const SEEN = { mock3: Date.parse('2026-10-16T11:20:00+05:30'), mock4: Date.parse('2026-10-24T10:40:00+05:30') };

function serviceFor(entry, { isPro, c }) {
  const db = fakeDb(entry.tables);
  return createLearn({
    db, kc: entry.kc, decks: entry.decks, syllabus: c.syllabus,
    getUser: async () => ({ isPremium: isPro, subjects: entry.subjects }),
    questionIndex: async (subject) => ({ list: c.index.get(subject) || [] }),
    // A lesson is read when this student finished it in a run (production: Study's own progress).
    lessonsFor: async (userId, subject) => {
      const read = new Set((entry.tables.learn_run_events || []).filter((e) => e.user_id === userId && e.kind === 'lesson').map((e) => e.body?.lessonId));
      return c.lessons.filter((l) => l.subject === subject).map((l) => ({ ...l, read: read.has(l.id) }));
    },
    heldQuestions: async () => new Set(), // the preview student has no open Mob paper
    mistakePlaces: async () => entry.places,
    now: () => Date.now(),
    warn: () => {},
  });
}

/**
 * The commerce student's returning history (only where the student takes Accountancy):
 *   Accounting for Partnership: Basic Concepts   3 due cards, 3 open mistakes from Mock 3 on 16 Oct, Getting there
 *   Admission of a Partner                        2 open mistakes (Mock 4, 24 Oct), an unfinished run (6 of 16 done)
 *   Accounting Ratios                             3 due cards
 * The answers are the chapter-state seed of keycardsPreview.js, with its wrong answers in these chapters made real fixture
 * questions, so the chapter state, the open mistakes and the questions a run serves agree.
 */
async function seedReturning(entry, { isPro, user, now, c }) {
  const t = entry.tables;
  if (!entry.subjects.includes('accountancy')) return;
  const qs = (chapterKey) => (c.index.get('accountancy') || []).filter((q) => q.chapterKey === chapterKey);
  const keyOf = (id) => c.rows.find((r) => r.id === id)?.correct_answer;
  // The seeded mistakes are real questions a student gets wrong (medium first), short stems with an explanation first (E3).
  const explained = (id) => Boolean(c.rows.find((r) => r.id === id)?.explanation);
  const pickMistakes = (chapterKey, n) => [...qs(chapterKey)].sort((a, b) => (isLong(a) ? 1 : 0) - (isLong(b) ? 1 : 0) || (explained(a.id) ? 0 : 1) - (explained(b.id) ? 0 : 1) || (a.difficulty === 'medium' ? 0 : 1) - (b.difficulty === 'medium' ? 0 : 1) || a.id.localeCompare(b.id)).slice(0, n);
  const markWrong = (q, at, where) => {
    const wrong = ['A', 'B', 'C', 'D'].find((k) => k !== keyOf(q.id)) || 'A';
    t.user_question_progress.push({ user_id: user, question_id: q.id, subject: q.subject, chapter: q.chapter, attempt_count: 1, last_correct: false, last_selected_key: wrong, last_attempted_at: iso(at) });
    entry.places.set(q.id, where);
  };
  // Partnership Fundamentals: the seed answered 9 (6 right); its 3 wrong stand-ins become 3 real questions from Mock 3.
  const pf = 'accountancy.partnership-fundamentals';
  t.user_question_progress = t.user_question_progress.filter((r) => !(r.subject === 'accountancy' && r.chapter === 'Partnership Fundamentals' && r.last_correct === false));
  pickMistakes(pf, 3).forEach((q, i) => markWrong(q, SEEN.mock3 + i * 90_000, 'Mock 3'));
  // Admission of Partner: 5 right stand-ins and 2 real wrong answers from Mock 4.
  const aop = 'accountancy.admission-of-partner';
  for (let k = 0; k < 5; k += 1) t.user_question_progress.push({ user_id: user, question_id: `preview-accountancy-aop-${k}`, subject: 'accountancy', chapter: 'Admission of Partner', attempt_count: 1, last_correct: true, last_attempted_at: iso(SEEN.mock4 + k * 60_000) });
  pickMistakes(aop, 2).forEach((q, i) => markWrong(q, SEEN.mock4 + (6 + i) * 60_000, 'Mock 4'));
  // Due cards: 3 in Partnership Fundamentals on every plan (Free's seed has 2), 3 in Accounting Ratios.
  const deck = entry.decks.bySubject.get('accountancy')?.cards || [];
  const taste = tasteIds(deck);
  const isDue = (cardId) => { const s = t.key_card_states.find((r) => r.user_id === user && r.card_id === cardId); return Boolean(s && Number(s.reps) > 0 && Date.parse(s.due_at) <= now); };
  const makeDue = (chapterKey, n) => {
    const list = deck.filter((x) => x.chapterKey === chapterKey && x.importance === 'must' && (isPro || taste.has(x.id))).sort((a, b) => (a.order || 0) - (b.order || 0));
    let due = list.filter((x) => isDue(x.id)).length;
    for (const card of list) {
      if (due >= n) break;
      if (isDue(card.id)) continue;
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
  // An unfinished run in Admission of a Partner: an 8-minute mix (16 items for Pro at the seconds of data/learn/seconds.js)
  // started earlier today (up to two hours ago), 6 items done.
  const out = await entry.learnService.start(user, { chapterKey: aop, minutes: 8, leaveOut: [], kind: 'mix', requestKey: 'preview-seed-aop-run' });
  const run = (t.learn_runs || []).find((r) => r.id === out.body?.id);
  if (!run) return;
  const sinceMidnight = (now + IST_MS) % DAY;
  const created = now - Math.min(2 * HOUR, Math.max(60_000, sinceMidnight - 60_000));
  run.created_at = iso(created);
  run.updated_at = iso(created);
  t.learn_run_events = t.learn_run_events || [];
  for (const item of run.items.slice(0, 6)) {
    t.learn_run_events.push({
      run_id: run.id, item_id: item.id, user_id: user, kind: item.type === 'card' ? 'look' : 'answer', question_id: item.questionId || null,
      card_id: item.cardId || null, choice: null, correct: item.type === 'question' ? true : null, fixed: null, origin: item.origin || null,
      rating: null, due_at: null, body: { seeded: true }, created_at: iso(created + 60_000),
    });
    run.done_count += 1;
    run.seconds_left = Math.max(0, run.seconds_left - (Number(item.seconds) || 0));
  }
}

/** Make a preview student's Learn state now (the returning history for a commerce student). */
export async function learnSeed({ entry, isPro, user, fresh = false, now = Date.now() }) {
  const c = await contentOnce();
  if (entry.learnService) return entry.learnService;
  const t = entry.tables;
  t.questions = t.questions || [];
  const have = new Set(t.questions.map((r) => r.id));
  for (const row of c.rows) if (!have.has(row.id)) t.questions.push({ ...row });
  t.user_question_progress = t.user_question_progress || [];
  t.key_card_states = t.key_card_states || [];
  entry.places = new Map();
  entry.learnService = serviceFor(entry, { isPro, c });
  if (!fresh) await seedReturning(entry, { isPro, user, now, c });
  return entry.learnService;
}

/**
 * One /api/learn/ request of a preview student: the production handlers over the memory tables.
 *   entry    the preview student of keycardsPreview.js ({ kc, tables, decks, subjects })
 *   to       the API path asked for     method, params (URLSearchParams), body (parsed JSON or null)
 */
export async function learnAnswer({ entry, to, method, params, body, isPro, user, fresh = false }) {
  const svc = await learnSeed({ entry, isPro, user, fresh });
  const m = String(method || 'GET').toUpperCase();
  const run = /^\/api\/learn\/runs\/([^/]+)(?:\/(answer|rate|end))?$/.exec(to);
  if (m === 'GET' && to === '/api/learn/subject') return svc.subject(user, params);
  if (m === 'GET' && to === '/api/learn/home') return svc.home(user, params);
  if (m === 'POST' && to === '/api/learn/runs/preview') return svc.preview(user, body);
  if (m === 'POST' && to === '/api/learn/runs') return svc.start(user, body || {});
  if (run && run[1] !== 'preview') {
    const id = decodeURIComponent(run[1]);
    if (m === 'GET' && !run[2]) return svc.getRun(user, id);
    if (m === 'POST' && run[2] === 'answer') return svc.answer(user, id, body);
    if (m === 'POST' && run[2] === 'rate') return svc.rate(user, id, body);
    if (m === 'GET' && run[2] === 'end') return svc.end(user, id);
  }
  if (m === 'GET' && to === '/api/learn/cards') return svc.cards(user, params);
  if (m === 'GET' && to === '/api/learn/covers') return svc.covers(user, params);
  if (m === 'GET' && to === '/api/learn/shelves') return svc.shelves(user, params);
  if (m === 'GET' && to === '/api/learn/search') return svc.search(user, params);
  return { http: 404, body: { error: 'NOT_A_LEARN_ROUTE' } };
}
