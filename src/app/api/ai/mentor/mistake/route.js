import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/supabase';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';
import { modelRepliesOpen } from '@/services/prepos/replyDeps';
import { storeReport } from '@/lib/server/aiReplyReport';
import { SUPPORT_REPLY } from '@/services/ai/supportCheck';
import { runMistakeAsk, persistMistakeTurn, mistakeTurn } from '@/services/mobi/mistakeAsk';
import { buildMistakeDeps } from '@/services/mobi/mistakeDeps';
import { MISTAKE_COPY, readMistakeBody } from '@/services/mobi/bringMistake.mjs';

// POST /api/ai/mentor/mistake: "Bring a mistake from any test" (16 Nov 2026). A signed-in student pastes a question they got
// wrong elsewhere; Mobi explains it and sets 2 new questions on the same idea. One more Ask Mobi ask kind: 1 credit through the
// same reserve -> commit | release lifecycle as every written reply, one guarded model call counted against the student's own
// monthly AI cap. The rules and their order are in src/services/mobi/mistakeAsk.js. Signed-out visitors get 401 (the guest
// Ask Mobi is a different route and is unchanged).
// A photo of the question (lane web/1116-photo): 2 credits, same lifecycle. The body cap rises only by the photo's own base64
// and only when a photo is in the body (readMistakeBody, mistakeBodyCheck). The photo is never stored and never logged:
// nothing here logs the body, and the saved turn keeps Mobi's reading of the photo, not the photo.
// An ask Mobi had to read but cannot use (its own "not a test question" or "unreadable", lane web/1116n-price): the reservation
// is released and 1 credit is taken once through the one-step consume (mistakeDeps consume); the reply says so, and the wallet
// below is read after it like after any charge.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // 6 asks a minute per student. Production does not set PERSISTENT_LIMITS_ENABLED, so this is the in-memory limit: per server
  // instance, a speed bump, not a shared limit. What bounds spend is the credit per ask and the student's monthly AI cap in the
  // database. Were the persistent limiter on, a database blip would refuse here (no 'memory' fallback: a paid model is behind it).
  if (!(await checkPersistentRateLimit(request, { route: '/api/ai/mentor/mistake', limit: 6, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ ok: false, error: 'rate_limited', message: MISTAKE_COPY.tooMany, charged: 0 }, { status: 429 });
  }
  // The body (readMistakeBody): refused by its declared length before it is read, then by its length with and without a photo's
  // base64. An oversized photo gets the photo's own words.
  const checked = await readMistakeBody(request);
  if (!checked.ok) return NextResponse.json({ ok: false, error: checked.error, message: checked.message, charged: 0 }, { status: checked.http });
  const payload = checked.payload;

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  const out = await runMistakeAsk({ user: dbUser, body: payload, gateOpen: modelRepliesOpen(), deps: buildMistakeDeps({ user: dbUser }) });
  if (out.kind === 'error') return NextResponse.json(out.body, { status: out.http });

  // What is saved (mistakeTurn, from runMistakeAsk's `saved`): the typed words, Mobi's reading of a photo, or the fixed words for
  // a photo that was read; marked as from a photo only when a checked photo was actually read. An answer shown again was saved
  // the first time and is not saved twice.
  const turn = mistakeTurn(out);
  const sessionId = turn ? await persist({ userId: dbUser.id, question: turn.question, response: out.body, photo: turn.photo }) : null;
  if (out.kind === 'support') {
    await recordSupport({ userId: dbUser.id, sessionId, requestId: payload?.requestId });
    return reply(sessionId, out.body, dbUser);
  }
  return reply(sessionId, out.body, dbUser, out.replayed ? true : Boolean(sessionId));
}

async function reply(sessionId, body, dbUser, saved = Boolean(sessionId)) {
  // A fresh read after any charge, so the wallet shown is the wallet stored.
  const latest = await Database.getUserById(dbUser.id).catch(() => dbUser);
  const snapshot = await getUsageSnapshot(latest || dbUser);
  return NextResponse.json({
    sessionId, saved, ...body,
    usageSnapshot: { tier: snapshot.tier, isPaid: snapshot.isPaid, aiWallet: snapshot.aiWallet, normalCreditBalance: snapshot.normalCreditBalance },
  });
}

// L1: the support reply is recorded where reply reports are, as the chat route does: the fixed reply, never the student's words.
async function recordSupport({ userId, sessionId, requestId }) {
  const id = typeof requestId === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(requestId) ? requestId : null;
  try {
    await storeReport(supabaseAdmin(), userId, { reason: 'support_reply', replyExcerpt: SUPPORT_REPLY, sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 100) : null, requestId: id, dedupeKey: id ? `ai-support-${id}` : null });
  } catch (err) {
    console.warn('[mistake] support record skipped:', err?.message || err);
  }
  console.info(JSON.stringify({ route: 'mentor_mistake', outcome: 'support_reply' }));
}

// The saved turn (Your recent questions, and the replay of a lost answer): persistMistakeTurn in mistakeAsk.js, which logs a
// failed write. The answer still reaches the student when the save fails; `saved: false` says it is not in the history.
function persist({ userId, question, response, photo = false }) {
  return persistMistakeTurn({ db: supabaseAdmin(), userId, question, response, photo });
}
