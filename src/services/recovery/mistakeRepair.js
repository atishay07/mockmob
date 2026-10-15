import 'server-only';
// Score Recovery · Mistake Repair. One AI repair per wrong answer, charged 1 PrepOS credit through
// the same reserve -> execute -> commit | release lifecycle as PrepOS replies. Provider spend is
// separately reserved and receipted by the runtime guard (USD 25 / IST month cap).
//
// The lifecycle itself lives in repairFlow.js (dependency-injected, tested with fakes). This file wires the
// real database, wallet and model client into it.
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { generateAIResponse } from '@/services/ai/providers';
import { buildReplyDeps, modelRepliesOpen } from '@/services/prepos/replyDeps';
import { readAIWallet } from '@/services/credits/aiCreditWallet';
import { publicationEligibility } from '@/../data/evidence_registry';
import { runRepair } from './repairFlow';

async function withheldForRecheck(db, { questionId, userId, attemptId, firstIndex, blindIndex, model }) {
  // Same path as a student report: recorded, then withheld from practice until re-checked.
  const report = await db.from('question_interactions').insert({
    question_id: questionId, user_id: userId, interaction_type: 'report', flow_context: 'review', session_id: attemptId,
    metadata: { source: 'ai_key_dispute', solved_index: firstIndex, blind_index: blindIndex, model },
  });
  const held = await db.from('questions').update({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review', updated_at: new Date().toISOString() })
    .eq('id', questionId).neq('status', 'rejected').select('id');
  if (report.error || held.error || !held.data?.length) throw new Error('quarantine_not_confirmed');
}

// Owner, 5 October 2026: GPT-6 Luna for Mistake Repair; low effort for the repair, high for the blind
// second opinion. AI_REPAIR_MODEL overrides the model.
export const REPAIR_ROUTE = Object.freeze({ provider: 'openai', model: process.env.AI_REPAIR_MODEL || 'gpt-6-luna' });
export const REPAIR_EFFORT = Object.freeze({ repair: 'low', secondOpinion: 'high' });
// Owner decision D2, 14 October 2026: when Luna fails (quota or rate limit, a timeout, a 5xx or a rejected
// parameter) the repair is retried once on Anthropic Haiku 5.5, at low effort. It needs the Anthropic key and the
// runtime price row (supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql); without either the
// fallback is skipped and a Luna failure ends as a released credit.
export const REPAIR_FALLBACK_ROUTE = Object.freeze({ provider: 'anthropic', model: process.env.AI_REPAIR_FALLBACK_MODEL || 'claude-haiku-5-5', reasoningEffort: 'low' });

export async function repairMistake({ user, attemptId, questionId, requestId, startedAt = Date.now(), generate = generateAIResponse }) {
  const replyDeps = buildReplyDeps({ user });
  const deps = {
    reserve: replyDeps.reserve,
    markExecuting: replyDeps.markExecuting,
    commit: replyDeps.commit,
    release: replyDeps.release,
    generate,
    gateOpen: modelRepliesOpen,
    loadAttempt: (id) => Database.getAttemptById(id),
    loadQuestion: (id) => supabaseAdmin().from('questions').select('*').eq('id', id).maybeSingle(),
    evidenceEligible: (question) => !!question && publicationEligibility(question).eligible,
    // A finished repair is stored on its committed reservation and reopens free.
    findStored: async (userId, id) => {
      const { data } = await supabaseAdmin().from('ai_credit_reservations').select('receipt').eq('user_id', userId).eq('state', 'committed')
        .like('operation_key', `repair:${id}:%`).order('created_at', { ascending: false }).limit(1);
      return data?.[0]?.receipt?.repair || null;
    },
    // Reservations for this mistake that have not finished (reserved or executing).
    findOpenReservations: async (userId, id) => {
      const { data, error } = await supabaseAdmin().from('ai_credit_reservations').select('operation_key,state,created_at,expires_at')
        .eq('user_id', userId).in('state', ['reserved', 'executing']).like('operation_key', `repair:${id}:%`).limit(20);
      if (error) throw new Error('open_reservations_unavailable');
      return data || [];
    },
    // The trap type, subject and chapter of the student's newest 300 committed repairs, for the free pattern line
    // (data/repair_pattern.js). One read on the existing (user_id, created_at desc) index; v1 and v2 rows carry no trap.
    findRepairTraps: async (userId) => {
      const { data, error } = await supabaseAdmin().from('ai_credit_reservations')
        .select('operation_key,trap:receipt->repair->>trap_type,subject:receipt->>subject,chapter:receipt->>chapter')
        .eq('user_id', userId).eq('action', 'score_recovery_repair').eq('state', 'committed')
        .order('created_at', { ascending: false }).limit(300);
      if (error) throw new Error('repair_traps_unavailable');
      return data || [];
    },
    withhold: (args) => withheldForRecheck(supabaseAdmin(), args),
    readWallet: (u) => readAIWallet(u).catch(() => null),
    now: Date.now,
    // One line per failed repair, for the Vercel logs: stage, error code, provider status and code, model, elapsed ms.
    // Never a student id, a question id, prompt text or a key.
    log: (line) => console.error(line),
  };
  return runRepair({ user, attemptId, questionId, requestId, startedAt, deps, config: { route: REPAIR_ROUTE, effort: REPAIR_EFFORT, fallbackRoute: REPAIR_FALLBACK_ROUTE } });
}
