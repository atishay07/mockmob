import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getStudentAIContext } from '@/services/ai/getStudentAIContext';
import { generateAIResponse } from '@/services/ai/providers';
import { buildMentorSystemPrompt, MENTOR_RESPONSE_SCHEMA } from '@/services/ai/systemPrompt';
import { sanitizeMentorResponse, buildFallbackMentorResponse } from '@/services/ai/responseValidator';
import { logAIUsage } from '@/services/ai/usageLogger';
import { getUsageSnapshot, resolveActionQuota } from '@/services/usage/getDailyUsage';
import { checkAndConsumeCredits } from '@/services/credits/checkAndConsumeCredits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_MODES = new Set(['mentor', 'autopsy', 'trap_drill', 'battle', 'admission', 'revision']);

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  const mode = VALID_MODES.has(payload?.mode) ? payload.mode : 'mentor';

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

  // ---- gating: paid-only ----
  const snapshot = await getUsageSnapshot(dbUser);
  const quota = resolveActionQuota({ user: dbUser, snapshot, action: 'mentor_chat' });

  if (!quota.allowed && quota.planRequired) {
    return NextResponse.json(
      {
        error: 'paid_plan_required',
        message: 'AI Mentor is a premium feature. Upgrade to talk to MockMob AI Mentor.',
        feature: 'ai_mentor',
      },
      { status: 402 },
    );
  }

  // ---- consume quota or credits ----
  let chargeRecord = { kind: 'included', amount: 0 };
  if (quota.requiresCredits) {
    const reference = `ai_mentor_${session.user.id}_${Date.now()}`;
    const charge = await checkAndConsumeCredits({
      userId: session.user.id,
      amount: quota.creditCost,
      action: 'ai_mentor_extra',
      reference,
    });
    if (!charge.ok) {
      return NextResponse.json(
        {
          error: charge.error || 'insufficient_credits',
          required: charge.required ?? quota.creditCost,
          balance: charge.balance ?? dbUser.creditBalance,
          upgrade: true,
        },
        { status: 402 },
      );
    }
    chargeRecord = { kind: 'credits', amount: charge.charged, reference };
  }

  // ---- build context ----
  const context = await getStudentAIContext({ user: dbUser });

  // ---- call AI ----
  const systemPrompt = buildMentorSystemPrompt(mode);
  const ai = await generateAIResponse({
    tier: 'smart',
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
      fallbackUsed: ai.fallbackUsed || !ai.ok,
      schemaValid: ai.schemaValid !== false,
      charge: chargeRecord,
      messageLength: message.length,
    },
  });

  // Refreshed snapshot so UI updates instantly.
  const refreshedSnapshot = await getUsageSnapshot(
    chargeRecord.kind === 'credits'
      ? { ...dbUser, creditBalance: Math.max(0, (dbUser.creditBalance || 0) - (chargeRecord.amount || 0)) }
      : dbUser,
  );

  return NextResponse.json({
    ok: true,
    response,
    usageSnapshot: {
      tier: refreshedSnapshot.tier,
      isPaid: refreshedSnapshot.isPaid,
      remaining: refreshedSnapshot.remaining,
      creditBalance: refreshedSnapshot.creditBalance,
    },
  });
}
