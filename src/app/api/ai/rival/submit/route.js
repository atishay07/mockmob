import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { scoreRivalBattle } from '@/services/ai-rival/scoreRivalBattle';
import { generateAIResponse } from '@/services/ai/providers';
import { buildRivalOutroPrompt } from '@/services/ai/systemPrompt';
import { getRivalProfile } from '@/services/ai-rival/rivalProfiles';
import { logAIUsage } from '@/services/ai/usageLogger';

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

  const battleId = body?.battleId;
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (!battleId) {
    return NextResponse.json({ error: 'battle_id_required' }, { status: 400 });
  }

  const result = await scoreRivalBattle({
    battleId,
    userId: session.user.id,
    answers,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  // Optional AI outro flavour.
  const profile = getRivalProfile(result.rivalType);
  let outro = { summary: deterministicOutro(result), nextMove: result.nextMoveHint };
  try {
    const ai = await generateAIResponse({
      tier: 'fast',
      systemPrompt: 'You write short post-battle summaries for AI rival matches in a CUET prep app. Reply only with JSON.',
      userMessage: buildRivalOutroPrompt({
        rivalProfile: profile,
        userScore: result.user.score,
        rivalScore: result.rival.score,
        result: result.result,
      }),
      responseSchema: { required: ['summary'], types: { summary: 'string', nextMove: 'string' } },
    });
    if (ai.ok && ai.data?.summary) {
      outro = {
        summary: String(ai.data.summary).slice(0, 220),
        nextMove: ai.data.nextMove ? String(ai.data.nextMove).slice(0, 100) : result.nextMoveHint,
      };
    }
    await logAIUsage({
      userId: session.user.id,
      feature: 'rival_outro',
      provider: ai.usage?.provider,
      model: ai.usage?.model,
      inputTokens: ai.usage?.inputTokens || 0,
      outputTokens: ai.usage?.outputTokens || 0,
      estimatedCostUsd: ai.usage?.estimatedCostUsd || 0,
      actionTriggered: 'submit_ai_rival',
      metadata: { rivalType: result.rivalType, battleId, result: result.result },
    });
  } catch (err) {
    console.warn('[rival] outro AI call failed:', err?.message);
  }

  return NextResponse.json({ ok: true, ...result, outro });
}

function deterministicOutro({ result, user, rival }) {
  if (result === 'win') return `You beat ${rival.profile?.name || 'the rival'} ${user.score}-${rival.score}. Solid execution.`;
  if (result === 'loss') return `You lost ${user.score}-${rival.score}. Sting it; come back stronger.`;
  return `Tied at ${user.score}. Tiebreaker goes to whoever moves faster next round.`;
}
