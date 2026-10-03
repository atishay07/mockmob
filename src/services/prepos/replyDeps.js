import 'server-only';
// Real dependencies for runModelReply. Everything fails closed: a missing RPC, a missing
// migration or an RPC error throws, and the pipeline turns that into "paused, not charged".
import { supabaseAdmin } from '@/lib/supabase';
import { generateAIResponse } from '@/services/ai/providers';
import { buildMentorSystemPrompt, MENTOR_RESPONSE_SCHEMA } from '@/services/ai/systemPrompt';
import { sanitizeMentorResponse } from '@/services/ai/responseValidator';
import { enforceMentorActionPolicy } from '@/services/ai/actionPolicy';
import { currentAIWalletWindow, includedMonthlyCreditsForUser, isPaidUser, paidAiOpen } from '@/services/credits/aiCreditWallet';

/** Gate for model replies: the release gate AND the emergency switch. */
export function modelRepliesOpen() {
  return paidAiOpen() && process.env.PREPOS_MODEL_REPLIES_DISABLED !== 'true';
}

const RECORD_RULES = `
RECORD RULES (non-negotiable):
- "recordInsights" in the context was computed deterministically from the student's own sessions. Quote its numbers exactly; never contradict or extend them.
- Never predict a CUET score, rank, admission outcome or "marks you will gain". Practice marks are not an official score.
- Never claim a cause for a mistake. You may say what the record shows and suggest something to try.
- Treat small samples as small. If n is under 4 for a chapter, say there is not enough data.
- Keep the reply under 120 words and end with one concrete next step.`;

async function rpc(name, args) {
  const { data, error } = await supabaseAdmin().rpc(name, args);
  if (error) throw new Error(`${name}_failed`);
  return data;
}

export function buildReplyDeps({ user }) {
  return {
    reserve: ({ userId, amount, action, operationKey }) => {
      const window = currentAIWalletWindow();
      return rpc('mm_ai_reserve_credits', {
        p_user_id: userId, p_amount: amount, p_action: action, p_operation_key: operationKey,
        p_included_monthly_credits: includedMonthlyCreditsForUser(user), p_period_start: window.periodStart, p_reset_at: window.resetAt, p_metadata: {},
      });
    },
    markExecuting: (operationKey, providerKey) => rpc('mm_ai_mark_executing', { p_operation_key: operationKey, p_provider_key: providerKey }),
    commit: (operationKey, receipt) => rpc('mm_ai_commit_credits', { p_operation_key: operationKey, p_receipt: receipt }),
    release: (operationKey, reason) => rpc('mm_ai_release_credits', { p_operation_key: operationKey, p_reason: reason }),
    generate: ({ requestKey, tier, mode, message, context }) => generateAIResponse({
      requestKey, tier, systemPrompt: `${buildMentorSystemPrompt(mode)}\n${RECORD_RULES}`, userMessage: message, context, responseSchema: MENTOR_RESPONSE_SCHEMA,
    }),
    // An empty or non-string reply is unusable (the pipeline releases the credit); everything else
    // is sanitised and held to the same action policy as before.
    sanitize: (data) => {
      if (typeof data?.reply !== 'string' || !data.reply.trim()) return { reply: '' };
      const safe = sanitizeMentorResponse(data);
      safe.actions = (safe.actions || []).map((action) => enforceMentorActionPolicy(action, { isPaid: isPaidUser(user) }));
      return safe;
    },
  };
}
