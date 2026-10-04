import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toPublicSubjectId } from '@/../data/cuet_controls';
import { computePrepOSInsights, answerFromInsights } from '@/../data/prepos_insights';
import { getStudentAIContext } from '@/services/ai/getStudentAIContext';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/supabase';
import { runModelReply, operationKeyFor, PREPOS_PAUSED_MESSAGE } from '@/services/prepos/modelReply';
import { buildReplyDeps, modelRepliesOpen } from '@/services/prepos/replyDeps';
import { isPaidUser } from '@/services/credits/aiCreditWallet';
import { studyTutorContext } from '@/lib/server/study';
import {studyHelpReplay} from '@/../data/study_help';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_MODES = new Set(['mentor', 'autopsy', 'trap_drill', 'mistake_replay', 'battle', 'admission', 'revision', 'comeback', 'mock_plan']);
const SMART_MODES = new Set(['autopsy', 'trap_drill', 'mistake_replay', 'admission', 'comeback', 'mock_plan']);
const SUBJECT_NAMES = Object.fromEntries(SUBJECTS.flatMap((s) => [[s.id, s.name], [toPublicSubjectId(s.id), s.name]]));
const NO_CHARGE = { kind: 'included', creditUnits: 0, amount: 0 };
const NO_USAGE = { provider: 'none', model: 'none', inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await checkPersistentRateLimit(request, { route: '/api/ai/mentor/chat', limit: 20, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  let payload;
  try {
    const text = await request.text();
    if (text.length > 12000) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  const mode = VALID_MODES.has(payload?.mode) ? payload.mode : 'mentor';
  if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 });
  if (message.length > 1500) return NextResponse.json({ error: 'message_too_long', maxChars: 1500 }, { status: 413 });

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  const userId = session.user.id;
  let studyLesson=null;
  if(payload.studyRunId !== undefined) {
    if(typeof payload.studyRunId!=='string' || payload.studyRunId.length>100 || !Number.isInteger(payload.studyRevision) || typeof payload.studyItemId!=='string' || payload.studyItemId.length>150) return NextResponse.json({error:'invalid_run'}, {status:400});
    try { studyLesson=await studyTutorContext(userId,payload.studyRunId,{expectedRevision:payload.studyRevision,itemId:payload.studyItemId}); }
    catch(error) { return NextResponse.json({error:error.message,message:'Answer the current card first, or reopen the current lesson. No credits used.'},{status:422}); }
  }
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : null;

  // 1. Questions about the student's own record are answered from the record: free, instant, no model.
  let insights = null;
  try {
    if(!studyLesson) insights = computePrepOSInsights((await Database.getAttempts(userId)).slice(0, 60), { subjectNames: SUBJECT_NAMES });
  } catch { /* the record is unavailable; fall through to the plan or model path */ }
  const fromRecord = !studyLesson && insights ? answerFromInsights(message, insights, { pro: isPaidUser(dbUser) }) : null;
  if (fromRecord) {
    const response = {
      reply: fromRecord.reply, origin: 'record', confidence: 0, reason: 'From your own sessions. No credits used.', cards: [],
      actions: (fromRecord.actions || []).map((a) => ({ label: a.label, type: 'navigate', route: a.route })), mode, charge: NO_CHARGE, usage: NO_USAGE,
    };
    return reply(await persist({ userId, sessionId, message, response, mode }), response, dbUser, 'record');
  }

  // Lesson help needs current teaching, not the student's unrelated record or personal details.
  const context = studyLesson ? {exam:'CUET',contextVersion:1} : await getStudentAIContext({ user: dbUser });
  // The explicit free-record surface can never fall through to a billed model.
  if (payload.replyKind === 'record') {
    const next=context.sharedPlan?.primary;
    // Explain the shared step with its checked facts; never a model-written diagnosis.
    const why=next?.facts?.length ? ` Your next step is "${next.title}" because: ${next.facts.map(f=>f.text).join(' ')}` : '';
    const response={reply:`Your record cannot answer that question yet. Ask about marks, chapters or timing, or open your next practice step.${why}`, confidence:0, cards:[], origin:'record', actions:next ? [{label:next.title,type:'navigate',route:next.href}] : [], mode,charge:NO_CHARGE,usage:NO_USAGE};
    return reply(await persist({userId,sessionId,message,response,mode}),response,dbUser,'record');
  }

  // 2. Paid replies paused: explain the shared plan, never charge, never call a model.
  if (!modelRepliesOpen()) {
    const next = context.sharedPlan?.primary;
    const response = {
      reply: `${PREPOS_PAUSED_MESSAGE} ${next ? `Your free next step is: ${next.title}. ${next.reason}` : 'Open Today for your free next practice step.'}`,
      origin: 'status', confidence: 0, reason: 'Based on your shared practice record. No credits used.', cards: [],
      actions: next ? [{ label: next.title, type: 'navigate', route: next.href }] : [{ label: 'Open Today', type: 'navigate', route: '/today' }],
      mode, charge: NO_CHARGE, usage: NO_USAGE,
    };
    return reply(await persist({ userId, sessionId, message, response, mode }), response, dbUser, 'paused');
  }

  // 3. Model reply through the reserve -> execute -> commit | release lifecycle.
  const compact = insights?.state === 'ready'
    ? { n: insights.questions, sessions: insights.sessions, ledger: insights.ledger, accuracy: insights.accuracy, topChapters: insights.chapters.ranked.slice(0, 3).map((c) => ({ chapter: c.chapter, n: c.n, right: c.right, wrong: c.wrong, skip: c.skip })), changes: insights.changes, pace: insights.pace.usable ? { medianSec: insights.pace.medianSec, n: insights.pace.questionsTimed } : null }
    : { n: 0 };
  const out = await runModelReply({
    user: dbUser, message, mode:studyLesson ? 'revision' : mode, requestId: payload.requestId, creditCost: 1, tier: !studyLesson && SMART_MODES.has(mode) ? 'smart' : 'fast',
    gateOpen: true, context: { ...context, recordInsights: compact, ...(studyLesson ? {studyLesson} : {}) }, deps: buildReplyDeps({ user: dbUser }),
  });
  if (out.status !== 'answered') {
    // A response lost in transit can be recovered from owner-bound history without another call.
    if(studyLesson && out.status==='duplicate') {
      const key=operationKeyFor(userId,payload.requestId);
      const {data:saved,error}=await supabaseAdmin().from('mentor_messages').select('structured_payload').eq('user_id',userId).eq('role','assistant').eq('structured_payload->charge->>reference',key).limit(1).maybeSingle();
      const previous=studyHelpReplay(saved?.structured_payload,{runId:payload.studyRunId,revision:payload.studyRevision,itemId:payload.studyItemId});
      if(!error && previous) {
        return reply(null,previous,dbUser,'replayed');
      }
    }
    return NextResponse.json({ ok: false, error: out.error || out.status, status: out.status, message: out.message, required: out.required, balance: out.balance, charged: 0 }, { status: out.http });
  }
  const response = {
    ...out.response, origin: 'model', mode, usage: { ...NO_USAGE, ...out.receipt },
    ...(studyLesson ? {study:{runId:payload.studyRunId,revision:payload.studyRevision,itemId:payload.studyItemId}} : {}),
    charge: { kind: 'prepos_credit', creditUnits: 1, amount: out.charged, reference: out.operationKey },
  };
  return reply(await persist({ userId, sessionId, message, response, mode }), response, dbUser, 'live');
}

async function reply(sessionId, response, dbUser, runtimeState) {
  // Fresh read after any charge so the wallet shown is the wallet stored.
  const latest = await Database.getUserById(dbUser.id).catch(() => dbUser);
  const snapshot = await getUsageSnapshot(latest || dbUser);
  return NextResponse.json({
    sessionId, ok: true, ...response, response, runtimeState,
    usageSnapshot: { tier: snapshot.tier, isPaid: snapshot.isPaid, aiWallet: snapshot.aiWallet, normalCreditBalance: snapshot.normalCreditBalance },
  });
}

async function persist({ userId, sessionId, message, response, mode }) {
  try {
    const sb = supabaseAdmin();
    let effectiveSessionId = sessionId;
    if (effectiveSessionId) {
      const { data: existing } = await sb.from('mentor_sessions').select('id').eq('id', effectiveSessionId).eq('user_id', userId).maybeSingle();
      effectiveSessionId = existing?.id || null;
    }
    if (!effectiveSessionId) {
      const { data } = await sb.from('mentor_sessions').insert({ user_id: userId, title: message.slice(0, 56), metadata: { mode } }).select('id').single();
      effectiveSessionId = data?.id || null;
    } else {
      await sb.from('mentor_sessions').update({ updated_at: new Date().toISOString(), metadata: { mode } }).eq('id', effectiveSessionId).eq('user_id', userId);
    }
    if (!effectiveSessionId) return null;
    await sb.from('mentor_messages').insert([
      { session_id: effectiveSessionId, user_id: userId, role: 'user', content: message },
      { session_id: effectiveSessionId, user_id: userId, role: 'assistant', content: response.reply || '', structured_payload: response },
    ]);
    return effectiveSessionId;
  } catch (err) {
    console.warn('[mentor] message persistence skipped:', err?.message || err);
    return null;
  }
}
