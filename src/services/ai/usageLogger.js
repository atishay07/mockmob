import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Append-only AI usage log. Drives daily-quota counters and cost reporting.
 * Failures here must NEVER break the user-facing request — log + swallow.
 */
export async function logAIUsage({
  userId,
  feature,
  provider,
  model,
  inputTokens = 0,
  outputTokens = 0,
  estimatedCostUsd = 0,
  actionTriggered = null,
  metadata = {},
}) {
  try {
    const { error } = await supabaseAdmin()
      .from('ai_usage_logs')
      .insert({
        user_id: userId,
        feature,
        provider: provider || null,
        model: model || null,
        input_tokens: Math.max(0, inputTokens | 0),
        output_tokens: Math.max(0, outputTokens | 0),
        estimated_cost_usd: Number.isFinite(estimatedCostUsd) ? estimatedCostUsd : 0,
        action_triggered: actionTriggered || null,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      });
    if (error) {
      console.error('[ai_usage_logs] insert failed:', error.message || error);
    }
  } catch (err) {
    console.error('[ai_usage_logs] insert threw:', err);
  }
}
