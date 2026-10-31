// Development only: the Key cards routes answered from the REAL bundled decks and links, for the visual preview
// (/preview/arena?view=cards|deck|revise|result&decks=real). It is the real service (createKeycards in ./keycards.js) over the
// real deck loader (decksOnce: data/keycards/decks, sha256-checked against the manifest) and the syllabus v2 adapter, with an
// in-memory student and an in-memory table store instead of Supabase. No database, no network, no paid call.
//
// Production: never. src/app/preview/arena/realdeck/route.js imports this file only inside a NODE_ENV guard, so a production
// build drops it, and previewKeycards() refuses on its own as well (data/tests/keycards_preview.test.mjs pins both). The decks
// are read from disk on the dev server; nothing here is imported by a client component, so no deck text reaches the browser
// bundle (the client forwarder, src/app/preview/arena/previewRealDecks.js, only forwards requests).
//
// Query (set by the forwarder): _to = the API path asked for (/api/keycards, /api/keycards/deck, ... or 'revise'),
// _plan = free | pro, _student = commerce | science | new, _s = a session name (each name is its own fresh student),
// _line = the subject "The line you needed" draws its linked questions from, _first = a card id that leads its deck.
// Every other parameter is the API's own.
import { createKeycards, decksOnce } from './keycards.js';
import { fakeDb } from './keycardsMemoryDb.js';
import { loadKeycardsSyllabus } from './keycardsSyllabus.js';
import { newSchedule, schedule, tasteIds } from '../../../data/keycards.js';

/** True wherever the preview must not answer: a production build or a production deployment. */
export const previewOff = (env = process.env) => env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';

/**
 * The preview students. commerce: Accountancy, Business Studies, Economics, English. science: Biology and Political Science.
 * new: the commerce subjects with nothing added and nothing answered (the sparse first visit).
 */
export const PREVIEW_STUDENTS = Object.freeze({
  commerce: Object.freeze({ subjects: ['accountancy', 'business_studies', 'economics', 'english'], fresh: false }),
  science: Object.freeze({ subjects: ['biology', 'political_science'], fresh: false }),
  new: Object.freeze({ subjects: ['accountancy', 'business_studies', 'economics', 'english'], fresh: true }),
});

const USER = 'preview-user';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------- the in-memory table store
// The same fake client the route tests use (./keycardsMemoryDb.js): the migration's keys, paged reads, the suspension view and
// key_card_review(), so the preview runs the server code exactly as the tests do.
export const memoryDb = (tables = {}) => fakeDb(tables);

// ---------------------------------------------------------------- the seeded student

const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));
// Answers per chapter in syllabus order, [answered, right] or null, so the home shows every state:
// Getting there, Too few answers, Needs work, Holding, Not started.
const ANSWERS = [[9, 6], [3, 1], [12, 2], [20, 19], null, [8, 5], null, [2, 2], null, [11, 2], null, [16, 15]];

/**
 * The tables of a preview student. Not fresh: per subject, every chapter answered as ANSWERS says, and the first two chapters
 * with cards added to Revise as "Add chapter" adds them (Pro: the Must-know set; Free: the taste cards). Of those, a few were
 * reviewed six days ago and are due now, a few were reviewed yesterday and are not due yet, and the rest are new.
 */
export function seedTables({ subjects, isPro, fresh, decks, syllabus, now }) {
  const tables = { key_card_states: [], key_card_reviews: [], key_card_reports: [], learning_allowances: [], student_subject_options: [], user_question_progress: [], questions: [] };
  if (fresh) return tables;
  let n = 0;
  for (const subject of subjects) {
    const chapters = syllabus.chaptersFor(subject, {});
    chapters.forEach((ch, i) => {
      const a = ANSWERS[i % ANSWERS.length];
      if (!a) return;
      for (let k = 0; k < a[0]; k += 1) {
        tables.user_question_progress.push({ user_id: USER, question_id: `preview-${subject}-${n += 1}`, subject, chapter: ch.name, attempt_count: 1 + (k % 2), last_correct: k < a[1], last_attempted_at: new Date(now - (k + 1) * 7 * HOUR).toISOString() });
      }
    });
    const cards = decks.bySubject.get(subject)?.cards || [];
    const withCards = chapters.filter((ch) => cards.some((c) => c.chapterKey === ch.key)).slice(0, 2);
    for (const ch of withCards) {
      const list = cards.filter((c) => c.chapterKey === ch.key).sort(bookOrder);
      const taste = tasteIds(list);
      const set = isPro ? list.filter((c) => c.importance === 'must') : list.filter((c) => taste.has(c.id));
      const dueNow = isPro ? 3 : 2;
      const notYet = isPro ? 6 : 1;
      set.forEach((card, j) => {
        const base = { user_id: USER, card_id: card.id, subject, chapter_key: ch.key, added_from: isPro ? 'chapter' : 'taste', added_at: new Date(now - 7 * DAY).toISOString(), suspended: false };
        if (j < dueNow + notYet) {
          const at = now - (j < dueNow ? 6 * DAY + j * HOUR : DAY + j * HOUR);
          const s = schedule(null, j === 1 ? 1 : 3, at);
          tables.key_card_states.push({ ...base, schedule: s.schedule, reps: s.reps, lapses: s.lapses, due_at: s.due_at, last_review_at: new Date(at).toISOString(), last_rating: j === 1 ? 1 : 3 });
        } else {
          tables.key_card_states.push({ ...base, schedule: newSchedule(now - 7 * DAY), reps: 0, lapses: 0, due_at: new Date(now - 7 * DAY).toISOString(), last_review_at: null, last_rating: null });
        }
      });
    }
  }
  return tables;
}

// ---------------------------------------------------------------- the students of this dev server

const students = new Map(); // `${student}|${plan}|${session}` -> { kc, tables }
const MAX_STUDENTS = 48;

async function studentFor({ student, isPro, session }) {
  const key = `${student}|${isPro ? 'pro' : 'free'}|${session}`;
  if (students.has(key)) return students.get(key);
  const who = PREVIEW_STUDENTS[student] || PREVIEW_STUDENTS.commerce;
  const decks = decksOnce();
  const syllabus = await loadKeycardsSyllabus();
  const tables = seedTables({ subjects: who.subjects, isPro, fresh: who.fresh, decks, syllabus, now: Date.now() });
  const kc = createKeycards({
    db: memoryDb(tables), decks, syllabus, now: () => Date.now(),
    getUser: async () => ({ isPremium: isPro, subjects: who.subjects }),
  });
  const entry = { kc, tables, decks, subjects: who.subjects };
  if (students.size >= MAX_STUDENTS) students.delete(students.keys().next().value);
  students.set(key, entry);
  return entry;
}

/**
 * "The line you needed" under a preview paper's wrong answer: the paper's question ids are fixtures, so each one stands in
 * for a real question the content stage linked (data/keycards/links/<subject>.json), picked by a stable hash. The stand-in is
 * recorded as answered (wrong) with fixture question text, so the real handler runs end to end.
 */
export function linkedStandIn(entry, questionId, subject) {
  const links = entry.decks.links.get(subject) || {};
  if (links[questionId]) return questionId;
  const ids = Object.keys(links).filter((id) => (links[id] || []).some((c) => entry.decks.byId.has(c))).sort();
  if (!ids.length) return questionId;
  const h = [...String(questionId)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
  return ids[h % ids.length];
}

function ensureAnswered(entry, questionId, subject) {
  const t = entry.tables;
  if (!t.user_question_progress.some((r) => r.question_id === questionId)) {
    t.user_question_progress.push({ user_id: USER, question_id: questionId, subject, chapter: null, attempt_count: 1, last_correct: false, last_attempted_at: new Date().toISOString() });
  }
  if (!t.questions.some((r) => r.id === questionId)) {
    const first = entry.decks.byId.get((entry.decks.links.get(subject) || {})[questionId]?.[0]);
    t.questions.push({ id: questionId, subject, chapter: first?.chapter || null, question: 'A preview question (fixture text).', body: null, explanation: '', is_deleted: false });
  }
}

const parse = async (request) => {
  try { const text = await request.text(); return text ? JSON.parse(text) : null; } catch { return null; }
};

/** One preview request: { http, body } from the real handlers. */
export async function previewAnswer(request) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const student = Object.hasOwn(PREVIEW_STUDENTS, p.get('_student')) ? p.get('_student') : 'commerce';
  const isPro = p.get('_plan') === 'pro';
  const session = String(p.get('_s') || 'default').slice(0, 64);
  const entry = await studentFor({ student, isPro, session });
  const { kc } = entry;
  const method = String(request.method || 'GET').toUpperCase();
  const to = p.get('_to') || '';
  const body = method === 'GET' ? null : await parse(request);
  if (method === 'GET' && to === '/api/keycards') return kc.overview(USER);
  if (method === 'GET' && to === '/api/keycards/deck') {
    const out = await kc.deck(USER, p.get('chapter'));
    // _first=<card id>: that card leads the deck, so a worst-case card can be looked at in Read, Study and Last look.
    const first = p.get('_first');
    const at = first && Array.isArray(out.body?.cards) ? out.body.cards.findIndex((c) => c.id === first) : -1;
    if (at > 0) out.body.cards = [out.body.cards[at], ...out.body.cards.slice(0, at), ...out.body.cards.slice(at + 1)];
    return out;
  }
  if (method === 'POST' && to === '/api/keycards/add') return kc.add(USER, body);
  if (method === 'GET' && to === '/api/keycards/due') return kc.due(USER, { limit: p.get('limit') || 20 });
  if (method === 'POST' && to === '/api/keycards/review') return kc.review(USER, body);
  if (method === 'POST' && to === '/api/keycards/report') return kc.report(USER, body);
  if (method === 'GET' && to === '/api/me/chapters') return kc.chapters(USER, p.get('subject'));
  if (method === 'PUT' && to === '/api/me/subject-options') return kc.putOption(USER, body);
  if (method === 'GET' && to === '/api/keycards/line') {
    const subject = entry.subjects.includes(p.get('_line')) ? p.get('_line') : entry.subjects.find((s) => Object.keys(entry.decks.links.get(s) || {}).length) || entry.subjects[0];
    const qid = linkedStandIn(entry, p.get('questionId') || '', subject);
    ensureAnswered(entry, qid, subject);
    return kc.line(USER, qid);
  }
  if (method === 'GET' && to === 'revise') {
    const out = await kc.reviseSource(USER, { limit: p.get('limit') || 20 });
    return { http: 200, body: out };
  }
  return { http: 404, body: { error: 'NOT_A_KEY_CARDS_ROUTE' } };
}

/** The route's answer as a Response. 404 wherever previewOff() (a production build or deployment). */
export async function previewKeycards(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (previewOff()) return new Response('Not found', { status: 404, headers });
  try {
    const out = await previewAnswer(request);
    return Response.json(out.body, { status: out.http, headers });
  } catch (error) {
    console.warn('[keycards preview]', error?.code || error?.message);
    return Response.json({ error: 'KEY_CARDS_UNAVAILABLE' }, { status: 503, headers });
  }
}
