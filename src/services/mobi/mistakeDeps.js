import 'server-only';
// Real dependencies for runMistakeAsk (src/services/mobi/mistakeAsk.js). Nothing new: the wallet steps are replyDeps' own RPC
// wrappers (mm_ai_reserve_credits, mm_ai_mark_executing, mm_ai_commit_credits, mm_ai_release_credits), and the model call is
// providers.js callProviderOnce, the guarded single call (model allowlist, reserve_runtime_ai with the student and plan, a
// receipt for every physical request). Everything fails closed: a missing RPC or migration throws and the ask is "paused,
// not charged".
import { supabaseAdmin } from '@/lib/supabase';
import { callProviderOnce } from '@/services/ai/providers';
import { buildReplyDeps, spendUserFor } from '@/services/prepos/replyDeps';

export function buildMistakeDeps({ user }) {
  const reply = buildReplyDeps({ user });
  return {
    wallet: { reserve: reply.reserve, markExecuting: reply.markExecuting, commit: reply.commit, release: reply.release },
    callOnce: callProviderOnce,
    spendUser: spendUserFor(user),
    now: () => Date.now(),
    // An ask already charged under this operation key: its stored answer, from the student's own saved turn (owner-bound).
    findReplay: async (operationKey) => {
      const { data, error } = await supabaseAdmin().from('mentor_messages').select('structured_payload')
        .eq('user_id', user.id).eq('role', 'assistant').eq('structured_payload->>kind', 'answer')
        .eq('structured_payload->charge->>reference', operationKey).limit(1).maybeSingle();
      if (error) return null;
      return data?.structured_payload || null;
    },
  };
}
