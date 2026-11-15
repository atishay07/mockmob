import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/supabase';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';
import { modelRepliesOpen } from '@/services/prepos/replyDeps';
import { storeReport } from '@/lib/server/aiReplyReport';
import { SUPPORT_REPLY } from '@/services/ai/supportCheck';
import { runMistakeAsk, persistMistakeTurn } from '@/services/mobi/mistakeAsk';
import { buildMistakeDeps } from '@/services/mobi/mistakeDeps';
import { MISTAKE_LIMITS, MISTAKE_COPY } from '@/services/mobi/bringMistake.mjs';

// POST /api/ai/mentor/mistake: "Bring a mistake from any test" (16 Nov 2026). A signed-in student pastes a question they got
// wrong elsewhere; Mobi explains it and sets 2 new questions on the same idea. One more Ask Mobi ask kind: 1 credit through the
// same reserve -> commit | release lifecycle as every written reply, one guarded model call counted against the student's own
// monthly AI cap. The rules and their order are in src/services/mobi/mistakeAsk.js. Signed-out visitors get 401 (the guest
// Ask Mobi is a different route and is unchanged).
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
  let payload;
  try {
    const text = await request.text();
    if (text.length > MISTAKE_LIMITS.body * 2) return NextResponse.json({ ok: false, error: 'payload_too_large', message: MISTAKE_COPY.questionTooLong, charged: 0 }, { status: 413 });
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json_body', message: MISTAKE_COPY.badRequest, charged: 0 }, { status: 400 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  const out = await runMistakeAsk({ user: dbUser, body: payload, gateOpen: modelRepliesOpen(), deps: buildMistakeDeps({ user: dbUser }) });
  if (out.kind === 'error') return NextResponse.json(out.body, { status: out.http });

  const question = typeof payload?.question === 'string' ? payload.question.slice(0, MISTAKE_LIMITS.question) : '';
  if (out.kind === 'support') {
    const savedId = await persist({ userId: dbUser.id, question, response: out.body });
    await recordSupport({ userId: dbUser.id, sessionId: savedId, requestId: payload?.requestId });
    return reply(savedId, out.body, dbUser);
  }
  // A replayed answer was saved the first time; it is not saved twice.
  const sessionId = out.replayed ? null : await persist({ userId: dbUser.id, question: out.value?.question || question, response: out.body });
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
function persist({ userId, question, response }) {
  return persistMistakeTurn({ db: supabaseAdmin(), userId, question, response });
}
