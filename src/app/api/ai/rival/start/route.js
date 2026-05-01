import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { createAIRivalBattle } from '@/services/ai-rival/createAIRivalBattle';
import { getRivalProfile } from '@/services/ai-rival/rivalProfiles';
import { generateAIResponse } from '@/services/ai/providers';
import { buildRivalIntroPrompt } from '@/services/ai/systemPrompt';
import { logAIUsage } from '@/services/ai/usageLogger';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const result = await createAIRivalBattle({
    user: dbUser,
    rivalType: body.rivalType,
    subjects: body.subjects,
    questionCount: body.questionCount,
    timeLimitMinutes: body.timeLimitMinutes,
    difficultyTarget: body.difficultyTarget,
    targetCollege: body.targetCollege,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message,
        planRequired: result.planRequired || false,
        upgradeHint: result.upgradeHint || false,
        balance: result.balance,
        required: result.required,
      },
      { status: result.status || 400 },
    );
  }

  if (result.battle.charge?.creditUnits > 0) {
    await logAIUsage({
      userId: session.user.id,
      feature: 'benchmark_premium',
      provider: 'none',
      model: 'none',
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      actionTriggered: 'launch_ai_rival',
      metadata: {
        rivalType: result.battle.rivalType,
        battleId: result.battle.id,
        charge: result.battle.charge,
        creditUnits: result.battle.charge.creditUnits,
      },
    });
  }

  const profile = getRivalProfile(result.battle.rivalType);
  let intro = { introLine: deterministicIntro(profile), tagline: profile.archetype.toUpperCase() };
  try {
    const ai = await generateAIResponse({
      tier: 'fast',
      systemPrompt: 'You write short, clear setup lines for timed CUET pressure benchmarks. No fantasy roleplay. Reply only with JSON.',
      userMessage: buildRivalIntroPrompt(profile, {
        avgScore: result.battle.rivalBenchmark.score,
      }),
      responseSchema: { required: ['introLine'], types: { introLine: 'string' } },
    });
    if (ai.ok && ai.data?.introLine) {
      intro = {
        introLine: String(ai.data.introLine).slice(0, 180),
        tagline: String(ai.data.tagline || profile.archetype).slice(0, 60),
      };
    }
    await logAIUsage({
      userId: session.user.id,
      feature: 'benchmark_intro',
      provider: ai.usage?.provider,
      model: ai.usage?.model,
      inputTokens: ai.usage?.inputTokens || 0,
      outputTokens: ai.usage?.outputTokens || 0,
      estimatedCostUsd: ai.usage?.estimatedCostUsd || 0,
      actionTriggered: 'launch_ai_rival',
      metadata: { rivalType: result.battle.rivalType, battleId: result.battle.id },
    });
  } catch (err) {
    console.warn('[rival] intro AI call failed, using deterministic intro:', err?.message);
  }

  const latestUser = await Database.getUserById(session.user.id).catch(() => dbUser);
  const usageSnapshot = await getUsageSnapshot(latestUser || dbUser).catch(() => null);

  return NextResponse.json({
    ok: true,
    battle: { ...result.battle, intro },
    usageSnapshot: usageSnapshot
      ? {
          tier: usageSnapshot.tier,
          isPaid: usageSnapshot.isPaid,
          remaining: usageSnapshot.remaining,
          creditBalance: usageSnapshot.creditBalance,
          aiCreditBalance: usageSnapshot.aiCreditBalance,
          aiWallet: usageSnapshot.aiWallet,
          includedAiCreditsRemaining: usageSnapshot.includedAiCreditsRemaining,
          normalCreditBalance: usageSnapshot.normalCreditBalance,
        }
      : null,
  });
}

function deterministicIntro(profile) {
  if (!profile) return 'Your benchmark is ready.';
  return `${profile.name} is ready. Benchmark focus: ${profile.strength}. Watch for: ${profile.weakness}.`;
}
