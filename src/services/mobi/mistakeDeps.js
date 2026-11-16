import 'server-only';
// Real dependencies for runMistakeAsk (src/services/mobi/mistakeAsk.js). Nothing new: the wallet steps are replyDeps' own RPC
// wrappers (mm_ai_reserve_credits, mm_ai_mark_executing, mm_ai_commit_credits, mm_ai_release_credits), and the model call is
// providers.js callProviderOnce, the guarded single call (model allowlist, reserve_runtime_ai with the student and plan, a
// receipt for every physical request). Everything fails closed: a missing RPC or migration throws and the ask is "paused,
// not charged".
import { supabaseAdmin } from '@/lib/supabase';
import { callProviderOnce } from '@/services/ai/providers';
import { buildReplyDeps, spendUserFor } from '@/services/prepos/replyDeps';
import { consumeAIWalletCredits } from '@/services/credits/aiCreditWallet';
import { findMistakeReplay, findUnusableCharge } from '@/services/mobi/mistakeAsk';
import { createLiveChapters, readLiveChapterNames } from '@/services/mobi/liveChapters.mjs';

// The chapter names Practice keeps from a link (review, 16 Nov 2026): read-only, one select per subject, kept for 5 minutes in
// this server instance. A failed read throws and the answer's chapter is dropped (the subject's link instead).
const liveChapters = createLiveChapters({ read: (subjectId) => readLiveChapterNames(supabaseAdmin(), subjectId) });

export function buildMistakeDeps({ user }) {
  const reply = buildReplyDeps({ user });
  return {
    wallet: { reserve: reply.reserve, markExecuting: reply.markExecuting, commit: reply.commit, release: reply.release },
    // An ask Mobi had to read but cannot use (lane web/1116n-price): 1 credit through the existing one-step consume
    // (mm_ai_consume_credits; it fails closed and never charges twice under one key), for this stored student; and the read of
    // that charge in the AI credit ledger for the same ask sent again (owner-bound). A failed read throws.
    consume: ({ amount, action, reference, idempotencyKey, metadata }) => consumeAIWalletCredits({ user, amount, action, reference, idempotencyKey, metadata }),
    findUnusable: (operationKey) => findUnusableCharge({ db: supabaseAdmin(), userId: user.id, operationKey }),
    callOnce: callProviderOnce,
    spendUser: spendUserFor(user),
    now: () => Date.now(),
    // An ask already charged under this operation key: its stored answer, from the student's own saved turn (owner-bound). The
    // read and the route's write (persistMistakeTurn) are one pair in mistakeAsk.js. A failed read throws.
    findReplay: (operationKey) => findMistakeReplay({ db: supabaseAdmin(), userId: user.id, operationKey }),
    liveChapters,
  };
}
