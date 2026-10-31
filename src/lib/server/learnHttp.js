import 'server-only';
// The Learn v2 routes' wrapper (docs/brain/learn-1031/BUILD-1101.md Part 2; A6-wiring.md section 2), the keycardsHttp.js
// pattern, in this order:
//   1. the flag: LEARN2_ENABLED === 'true' and Key cards on, otherwise 404 { error: 'LEARN_OFF' };
//   2. auth(request): the bearer token first (the app), then the cookie (the website), otherwise 401;
//   3. the persistent rate limit, 120 a minute per student (429);
//   4. a write's body: a JSON object of at most 8,000 characters (413 or 422);
//   5. Cache-Control: no-store on every answer;
//   6. anything thrown answers 503 { error: 'LEARN_UNAVAILABLE', message }.
// The handlers live in src/lib/server/learn.js and return { http, body }. learnService() wires production: Supabase, the Key
// cards service, the bundled decks, the syllabus, the practice question pool (cached per subject), Study's lessons and the
// Mob paper hold. No paid model call anywhere.
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { decksOnce, keyCardsEnabled } from '@/lib/server/keycards';
import { keycardsService } from '@/lib/server/keycardsHttp';
import { loadKeycardsSyllabus } from '@/lib/server/keycardsSyllabus';
import { readHeldMobPapers } from '@/lib/server/answerHold';
import { lessonsFor as studyLessons } from '@/lib/server/study';
import { createLearn, servedOptions } from '@/lib/server/learn';
import { createPracticeSource } from '@/../data/practice_source';
import { filterServable } from '@/../data/cuet_syllabus';
import { isPassageLinkedQuestion } from '@/../data/nta_question_selector';

export const BODY_MAX = 8000;
export const LEARN_OFF = Object.freeze({ http: 404, body: { error: 'LEARN_OFF' } });
/** Learn v2 is on only with its own flag and Key cards together (both off in production until the owner turns them on). */
export const learnEnabled = (env = process.env) => env.LEARN2_ENABLED === 'true' && keyCardsEnabled(env);

const INDEX_TTL_MS = 5 * 60 * 1000;
const MAX_PER_CONCEPT = 2;
const QUICK = Object.freeze({ id: 'quick', allowDifficultyOverride: false, recencyLimit: 0 });
const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

/**
 * A subject's Learn question index from the shared practice light pool (A6 4.3 step 6, A5 P3): live and servable rows, no
 * passage-linked questions, legacy rows by their readable verdict, managed rows presumed until a run start checks them on
 * their fresh full rows; one per family and at most 2 per concept in a chapter. Never every column (star); no key in the index.
 */
async function buildIndex(db, subject, syllabus, decks) {
  const source = createPracticeSource({ db, subjectId: subject, mode: QUICK, opts: {}, targetCount: 10, hooks: { attachPassages: async (rows) => rows } });
  const light = await source.loadLightPool();
  const managed = (row) => light.managedIds.has(row.id);
  const rows = filterServable(light.rows, {}).filter((row) => !isPassageLinkedQuestion(row));
  const legacy = new Set((await source.readable(rows.filter((row) => !managed(row)))).map((row) => row.id));
  const links = decks.links.get(subject) || {};
  const families = new Set();
  const concepts = new Map();
  const list = [];
  for (const row of rows) {
    if (!managed(row) && !legacy.has(row.id)) continue;
    const resolved = syllabus.resolveChapter(subject, row.chapter);
    if (!resolved || resolved.retired) continue;
    const options = servedOptions(row.options);
    if (options.length < 2) continue;
    const family = row.family_id || row.ev_family || null;
    if (family && families.has(`${resolved.key}|${family}`)) continue;
    const concept = row.concept_id || row.concept || null;
    const ck = concept ? `${resolved.key}|${concept}` : null;
    if (ck && (concepts.get(ck) || 0) >= MAX_PER_CONCEPT) continue;
    if (family) families.add(`${resolved.key}|${family}`);
    if (ck) concepts.set(ck, (concepts.get(ck) || 0) + 1);
    const body = String(row.question || row.body || '');
    list.push({
      id: row.id, subject, chapter: row.chapter, chapterKey: resolved.key, body, options, words: wordCount(body),
      difficulty: ['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : null, cards: links[row.id] || [],
      chash: String(row.content_hash || row.updated_at || ''), managed: managed(row), family, concept,
    });
  }
  return { list };
}

let service = null;
/** One service per process: the decks, the syllabus and the question indexes are read once and shared. */
export async function learnService() {
  if (service) return service;
  const db = supabaseAdmin();
  const [kc, syllabus] = await Promise.all([keycardsService(), loadKeycardsSyllabus()]);
  const decks = decksOnce();
  const indexes = new Map(); // subject -> { at, value: Promise }
  const questionIndex = (subject) => {
    const hit = indexes.get(subject);
    if (hit && Date.now() - hit.at < INDEX_TTL_MS) return hit.value;
    const value = buildIndex(db, subject, syllabus, decks).catch((error) => { indexes.delete(subject); throw error; });
    indexes.set(subject, { at: Date.now(), value });
    return value;
  };
  service = createLearn({
    db, kc, decks, syllabus,
    getUser: (id) => Database.getUserById(id),
    questionIndex,
    verifyRows: async (ids) => {
      const source = createPracticeSource({ db, subjectId: null, mode: QUICK, opts: {}, targetCount: ids.length, hooks: { attachPassages: async (rows) => rows } });
      const rows = await source.loadFullRows(ids);
      return new Set((await source.readable(rows)).map((row) => row.id));
    },
    lessonsFor: async (userId, subject) => (await studyLessons(userId, subject)).map((l) => {
      const resolved = syllabus.resolveChapter(subject, l.chapter);
      return resolved && !resolved.retired ? { ...l, chapterKey: resolved.key } : null;
    }).filter(Boolean),
    // A failed read throws: the service then refuses every question (fail closed).
    heldQuestions: async (userId) => (await readHeldMobPapers(db, userId, Date.now())).qids,
  });
  return service;
}

/** Run `fn(service, userId, body, url)` behind the flag, auth, the rate limit and the body cap. */
export async function learnHttp(request, fn, { write = false } = {}) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!learnEnabled()) return Response.json(LEARN_OFF.body, { status: LEARN_OFF.http, headers });
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    if (!(await checkPersistentRateLimit(request, { route: '/api/learn', limit: 120, keyParts: [session.user.id] })).allowed) {
      return Response.json({ error: 'Please wait a moment and try again.' }, { status: 429, headers });
    }
    let body = null;
    if (write) {
      const text = await request.text();
      if (text.length > BODY_MAX) return Response.json({ error: 'BODY_TOO_LARGE' }, { status: 413, headers });
      try { body = JSON.parse(text); } catch { body = null; }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'INVALID_BODY' }, { status: 422, headers });
    }
    const url = new URL(request.url);
    const out = await fn(await learnService(), session.user.id, body, url);
    return Response.json(out.body, { status: out.http, headers });
  } catch (error) {
    console.warn('[learn]', error?.code || error?.message, error?.what || '');
    return Response.json({ error: 'LEARN_UNAVAILABLE', message: 'Learn did not load. Try again in a moment.' }, { status: 503, headers });
  }
}
