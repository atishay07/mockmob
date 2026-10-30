import 'server-only';
// The Key cards routes' wrapper (KEYCARDS-BUILD-SPEC.md 2e), the learningHttp.js pattern: the feature flag first
// (KEY_CARDS_ENABLED, default off: 404 { error: 'KEY_CARDS_OFF' }), then auth, the rate limit and the body cap.
// The handlers live in src/lib/server/keycards.js and return { http, body }.
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { createKeycards, decksOnce, keyCardsEnabled, OFF } from '@/lib/server/keycards';
import { loadKeycardsSyllabus } from '@/lib/server/keycardsSyllabus';
import { publicInventory } from '@/lib/server/inventory';
import { loadReviewRecord } from '@/lib/server/review';
import { readHeldMobPapersSafe } from '@/lib/server/answerHold';
import { chapterRows } from '@/../data/review_chapters.mjs';

const BODY_MAX = 4000;

let service = null;
/** One service per process: the decks, the syllabus and the report list are read once and shared. */
export async function keycardsService() {
  if (!service) {
    const syllabus = await loadKeycardsSyllabus();
    service = createKeycards({
      db: supabaseAdmin(),
      decks: decksOnce(),
      syllabus,
      getUser: (id) => Database.getUserById(id),
      inventory: () => publicInventory(),
      reviewRecord: (userId) => loadReviewRecord(userId, { db: supabaseAdmin() }),
      marksLostRows: (record) => chapterRows(record),
      isHeld: async (userId, questionId) => (await readHeldMobPapersSafe(supabaseAdmin(), userId, Date.now(), 'keycards line')).qids.has(questionId),
    });
  }
  return service;
}

/** Run `fn(service, userId, body, url)` behind the flag, auth, rate limit and body cap. */
export async function keycardsHttp(request, fn, { write = false } = {}) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!keyCardsEnabled()) return Response.json(OFF.body, { status: OFF.http, headers });
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    if (!(await checkPersistentRateLimit(request, { route: '/api/keycards', limit: 120, keyParts: [session.user.id] })).allowed) {
      return Response.json({ error: 'Please wait a moment and try again.' }, { status: 429, headers });
    }
    let body = null;
    if (write) {
      const text = await request.text();
      if (text.length > BODY_MAX) return Response.json({ error: 'BODY_TOO_LARGE' }, { status: 413, headers });
      try { body = JSON.parse(text); } catch { body = null; }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'INVALID_BODY' }, { status: 422, headers });
    }
    const out = await fn(await keycardsService(), session.user.id, body, new URL(request.url));
    return Response.json(out.body, { status: out.http, headers });
  } catch (error) {
    console.warn('[keycards]', error?.code || error?.message);
    return Response.json({ error: 'KEY_CARDS_UNAVAILABLE', message: 'Key cards did not load. Try again in a moment.' }, { status: 503, headers });
  }
}
