import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getStudentAIContext } from '@/services/ai/getStudentAIContext';
import { generateAIResponse } from '@/services/ai/providers';
import { buildMentorSystemPrompt, MENTOR_RESPONSE_SCHEMA } from '@/services/ai/systemPrompt';
import { sanitizeMentorResponse, buildFallbackMentorResponse } from '@/services/ai/responseValidator';
import { logAIUsage } from '@/services/ai/usageLogger';
import { getUsageSnapshot, mentorModeToQuotaAction } from '@/services/usage/getDailyUsage';
import { consumeAIAllowance } from '@/services/credits/consumeAIAllowance';
import { enforceMentorActionPolicy, capConfidence } from '@/services/ai/actionPolicy';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_MODES = new Set(['mentor', 'autopsy', 'trap_drill', 'mistake_replay', 'battle', 'admission', 'revision', 'comeback', 'mock_plan']);
const SMART_MODES = new Set(['autopsy', 'trap_drill', 'mistake_replay', 'admission', 'comeback', 'mock_plan']);
const MENTOR_RESPONSE_CACHE = new Map();

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  const mode = VALID_MODES.has(payload?.mode) ? payload.mode : 'mentor';
  const setupProfile = sanitizeSetupProfile(payload?.setupProfile);

  if (!message) {
    return NextResponse.json({ error: 'message_required' }, { status: 400 });
  }
  if (message.length > 1500) {
    return NextResponse.json({ error: 'message_too_long', maxChars: 1500 }, { status: 413 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // Build context before charging so repeat "today" requests can use a short
  // deterministic cache without spending credits or calling the model.
  const baseContext = await getStudentAIContext({ user: dbUser });
  const context = setupProfile
    ? { ...baseContext, setupProfile }
    : baseContext;
  const cachedResponse = getCachedMentorResponse({ userId: session.user.id, mode, message, context });
  if (cachedResponse) {
    const mentorSessionId = await persistMentorExchange({
      userId: session.user.id,
      sessionId: typeof payload?.sessionId === 'string' ? payload.sessionId : null,
      message,
      response: cachedResponse,
      mode,
    });
    const refreshedSnapshot = await getUsageSnapshot(dbUser);
    return NextResponse.json({
      ok: true,
      ...cachedResponse,
      response: cachedResponse,
      sessionId: mentorSessionId,
      cached: true,
      usageSnapshot: publicUsageSnapshot(refreshedSnapshot),
    });
  }

  const quotaAction = mentorModeToQuotaAction(mode);
  const allowance = await consumeAIAllowance({
    user: dbUser,
    action: quotaAction,
    referencePrefix: `mentor_${mode}`,
  });

  if (!allowance.ok) {
    return NextResponse.json(
      {
        error: allowance.error || 'ai_allowance_denied',
        message: allowance.planRequired
          ? 'Personalized PrepOS is a premium feature. Upgrade to unlock MockMob PrepOS.'
            : allowance.error === 'ai_credit_schema_missing'
              ? 'AI credits are not initialized yet. Run the AI overlay credits migration.'
              : 'You are out of PrepOS credits. Buy a top-up pack to keep planning.',
        required: allowance.required,
        balance: allowance.balance,
        feature: 'prepos',
        response: buildCreditBlockedResponse({ planRequired: allowance.planRequired, required: allowance.required, balance: allowance.balance }),
      },
      { status: allowance.status || 402 },
    );
  }

  const chargeRecord = allowance.charge;

  // ---- call AI ----
  const systemPrompt = buildMentorSystemPrompt(mode);
  const ai = await generateAIResponse({
    tier: SMART_MODES.has(mode) ? 'smart' : 'fast',
    systemPrompt,
    userMessage: message,
    context,
    responseSchema: MENTOR_RESPONSE_SCHEMA,
  });

  let response;
  if (ai.ok && ai.data) {
    response = sanitizeMentorResponse(ai.data, {
      fallbackReply: 'I understood your question but produced a partial answer. Try again in a moment.',
    });
  } else {
    response = buildFallbackMentorResponse({ context, mode, error: ai.error });
  }

  response.confidence = capConfidence(response.confidence, context.aiConfidence);
  response.actions = (response.actions || []).map((action) =>
    enforceMentorActionPolicy(action, { isPaid: allowance.snapshot?.isPaid === true }),
  );

  // Stamp server-side fields the model is forbidden from filling.
  response.usage = {
    provider: ai.usage?.provider || 'fallback',
    model: ai.usage?.model || 'fallback',
    inputTokens: ai.usage?.inputTokens || 0,
    outputTokens: ai.usage?.outputTokens || 0,
    estimatedCostUsd: ai.usage?.estimatedCostUsd || 0,
  };
  response.charge = chargeRecord;
  response.mode = mode;
  setCachedMentorResponse({ userId: session.user.id, mode, message, context, response });

  // ---- log usage (always, even on fallback) ----
  await logAIUsage({
    userId: session.user.id,
    feature: 'mentor_chat',
    provider: response.usage.provider,
    model: response.usage.model,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    estimatedCostUsd: response.usage.estimatedCostUsd,
    actionTriggered: null,
    metadata: {
      mode,
      setupProfile,
      fallbackUsed: ai.fallbackUsed || !ai.ok,
      schemaValid: ai.schemaValid !== false,
      charge: chargeRecord,
      creditUnits: chargeRecord.creditUnits || 0,
      quotaAction,
      messageLength: message.length,
    },
  });

  const mentorSessionId = await persistMentorExchange({
    userId: session.user.id,
    sessionId: typeof payload?.sessionId === 'string' ? payload.sessionId : null,
    message,
    response,
    mode,
  });

  // Refreshed snapshot so UI updates instantly.
  const latestUser = await Database.getUserById(session.user.id).catch(() => dbUser);
  const refreshedSnapshot = await getUsageSnapshot(latestUser || dbUser);

  return NextResponse.json({
    ok: true,
    ...response,
    response,
    sessionId: mentorSessionId,
    usageSnapshot: {
      ...publicUsageSnapshot(refreshedSnapshot),
    },
  });
}

function publicUsageSnapshot(snapshot) {
  return {
    tier: snapshot.tier,
    isPaid: snapshot.isPaid,
    remaining: snapshot.remaining,
    creditBalance: snapshot.creditBalance,
    aiCreditBalance: snapshot.aiCreditBalance,
    aiWallet: snapshot.aiWallet,
    includedAiCreditsRemaining: snapshot.includedAiCreditsRemaining,
    normalCreditBalance: snapshot.normalCreditBalance,
    creditCosts: snapshot.creditCosts,
  };
}

function buildCreditBlockedResponse({ planRequired, required, balance }) {
  return {
    reply: planRequired
      ? 'Personalized PrepOS is locked on the free plan. Use your free Daily Benchmark today, then upgrade when you want missions, replay, and autopsy.'
      : `AI credits are exhausted. You need ${required || 1} AI credit(s); current balance is ${balance || 0}.`,
    confidence: 100,
    cards: [
      {
        type: 'credits',
        title: planRequired ? 'PrepOS requires Premium' : 'Credits needed',
        body: planRequired
          ? 'Free users get one Daily Benchmark per day. Personal missions, mock autopsy, Mistake Replay, and DU path guidance are Premium.'
          : 'Your included monthly PrepOS credits and purchased credits are used up. Normal MockMob credits are separate and will not be touched.',
        metadata: { required: required || 0, balance: balance || 0 },
      },
    ],
    actions: [
      {
        label: planRequired ? 'Upgrade plan' : 'Buy AI credits',
        action: planRequired ? 'upgrade_plan' : 'buy_credits',
        params: {},
        creditCost: 0,
        requiresPaid: Boolean(planRequired),
      },
    ],
    usage: { provider: 'none', model: 'none', inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
  };
}

function getCachedMentorResponse({ userId, mode, message, context }) {
  if (mode !== 'mentor') return null;
  const normalized = normalizePrompt(message);
  if (normalized !== 'what should i do today') return null;
  const cacheKey = buildCacheKey({ userId, mode, normalized, context });
  const cached = MENTOR_RESPONSE_CACHE.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > 20 * 60_000) {
    MENTOR_RESPONSE_CACHE.delete(cacheKey);
    return null;
  }
  return {
    ...cached.response,
    charge: { kind: 'cache', amount: 0, creditUnits: 0, reference: null },
    usage: { provider: 'cache', model: 'deterministic-cache', inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
  };
}

function setCachedMentorResponse({ userId, mode, message, context, response }) {
  if (mode !== 'mentor') return;
  const normalized = normalizePrompt(message);
  if (normalized !== 'what should i do today') return;
  const cacheKey = buildCacheKey({ userId, mode, normalized, context });
  MENTOR_RESPONSE_CACHE.set(cacheKey, { response, createdAt: Date.now() });
  if (MENTOR_RESPONSE_CACHE.size > 500) {
    const firstKey = MENTOR_RESPONSE_CACHE.keys().next().value;
    if (firstKey) MENTOR_RESPONSE_CACHE.delete(firstKey);
  }
}

function buildCacheKey({ userId, mode, normalized, context }) {
  const lastAttempt = context?.lastMockSummary?.attemptId || 'none';
  const attemptCount = context?.recentMockSummary?.attemptCount || 0;
  const weak = (context?.weaknessSummary?.weakChapters || [])
    .slice(0, 3)
    .map((item) => `${item.subject}:${item.chapter}:${item.accuracy}`)
    .join('|');
  const setup = context?.setupProfile
    ? `${context.setupProfile.target}:${context.setupProfile.dailyMinutes}:${context.setupProfile.focus}:${context.setupProfile.benchmark}`
    : 'no_setup';
  return `${userId}:${mode}:${normalized}:${lastAttempt}:${attemptCount}:${weak}:${setup}`;
}

function normalizePrompt(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSetupProfile(value) {
  if (!value || typeof value !== 'object') return null;

  const target = cleanText(value.target, 48) || 'CUET score climb';
  const focus = ['weakness', 'speed', 'accuracy', 'revision'].includes(value.focus)
    ? value.focus
    : 'weakness';
  const benchmark = ['daily', 'speed', 'accuracy', 'weakness'].includes(value.benchmark)
    ? value.benchmark
    : 'daily';
  const rawMinutes = Number(value.dailyMinutes);
  const dailyMinutes = Number.isFinite(rawMinutes)
    ? Math.min(120, Math.max(15, Math.round(rawMinutes)))
    : 45;

  return {
    target,
    dailyMinutes,
    focus,
    benchmark,
  };
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function persistMentorExchange({ userId, sessionId, message, response, mode }) {
  try {
    const sb = supabaseAdmin();
    let effectiveSessionId = sessionId;
    if (effectiveSessionId) {
      const { data: existing } = await sb
        .from('mentor_sessions')
        .select('id')
        .eq('id', effectiveSessionId)
        .eq('user_id', userId)
        .maybeSingle();
      effectiveSessionId = existing?.id || null;
    }

    if (!effectiveSessionId) {
      const title = message.slice(0, 56);
      const { data } = await sb
        .from('mentor_sessions')
        .insert({ user_id: userId, title, metadata: { mode } })
        .select('id')
        .single();
      effectiveSessionId = data?.id || null;
    } else {
      await sb
        .from('mentor_sessions')
        .update({ updated_at: new Date().toISOString(), metadata: { mode } })
        .eq('id', effectiveSessionId)
        .eq('user_id', userId);
    }

    if (!effectiveSessionId) return null;
    await sb.from('mentor_messages').insert([
      { session_id: effectiveSessionId, user_id: userId, role: 'user', content: message },
      {
        session_id: effectiveSessionId,
        user_id: userId,
        role: 'assistant',
        content: response.reply || '',
        structured_payload: response,
      },
    ]);
    return effectiveSessionId;
  } catch (err) {
    console.warn('[mentor] message persistence skipped:', err?.message || err);
    return null;
  }
}
