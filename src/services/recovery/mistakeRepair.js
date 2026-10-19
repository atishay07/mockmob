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
import { buildReplyDeps, modelRepliesOpen, spendUserFor } from '@/services/prepos/replyDeps';
import { readAIWallet } from '@/services/credits/aiCreditWallet';
import { publicationEligibility, sharedEligibilitySnapshot } from '@/../data/evidence_registry';
import { readFullQuestionRow, readQuestionRow } from '@/../data/question_reads';
import { runRepair } from './repairFlow';
import { findStoredRepair } from '@/lib/server/repairSaved';
import { recordTrap } from '@/lib/server/trapAtlas';
import { checkStatus } from './repairCheck';
import { buildCheckDeps } from './repairCheckDeps';
import { atlasForAttempts } from '@/lib/server/trapAtlas';
import { buildTrapsMeet } from '@/../data/trap_atlas';

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
    // Every model call of a repair (the explanation and its blind key check) counts against this student's monthly limit.
    spendUser: spendUserFor,
    gateOpen: modelRepliesOpen,
    loadAttempt: (id) => Database.getAttemptById(id),
    // The row without its signed evidence record (data/question_reads.js).
    loadQuestion: (id) => readQuestionRow(supabaseAdmin(), id),
    // Called only when the key changed since the snapshot: reads the full row for the verdict. Any read failure is "not eligible".
    evidenceEligible: async (question) => {
      if (!question) return false;
      const { data, error } = await readFullQuestionRow(supabaseAdmin(), question.id);
      return !error && !!data && publicationEligibility(data, sharedEligibilitySnapshot()).eligible;
    },
    // A finished repair is stored on its committed reservation and reopens free. A failed read throws (never "none"),
    // so the flow stops before it could reserve a second credit for a repair the student already owns (F17).
    findStored: (userId, id) => findStoredRepair(supabaseAdmin(), userId, id),
    // Reservations for this mistake that have not finished (reserved or executing).
    findOpenReservations: async (userId, id) => {
      const { data, error } = await supabaseAdmin().from('ai_credit_reservations').select('operation_key,state,created_at,expires_at')
        .eq('user_id', userId).in('state', ['reserved', 'executing']).like('operation_key', `repair:${id}:%`).limit(20);
      if (error) throw new Error('open_reservations_unavailable');
      return data || [];
    },
    // The trap type, subject, chapter and date of the student's newest 300 committed repairs, for the free pattern line
    // (data/repair_pattern.js), which is dated from the earliest repair it counts. One read on the existing
    // (user_id, created_at desc) index; v1 and v2 rows carry no trap. Checked against production on 15 Oct 2026 as
    // SQL: receipt is jsonb and receipt->'repair'->>'trap_type', receipt->>'subject' and receipt->>'chapter' resolve.
    findRepairTraps: async (userId) => {
      const { data, error } = await supabaseAdmin().from('ai_credit_reservations')
        .select('operation_key,created_at,trap:receipt->repair->>trap_type,subject:receipt->>subject,chapter:receipt->>chapter')
        .eq('user_id', userId).eq('action', 'score_recovery_repair').eq('state', 'committed')
        .order('created_at', { ascending: false }).limit(300);
      if (error) throw new Error('repair_traps_unavailable');
      return data || [];
    },
    // "Traps you meet" rows for Fix it for good's history line ("This trap has caught you 4 times in 6 chances"). No model.
    trapRows: async (userId) => {
      const attempts = await Database.getAttempts(userId);
      let atlas = null;
      try { atlas = await atlasForAttempts(attempts); } catch { atlas = null; }
      return buildTrapsMeet({ attempts, atlas }).rows;
    },
    // Fills the trap atlas from this committed v3 repair (the trap type on the option the student chose). Never throws.
    recordTrap: (record) => recordTrap(record),
    // The fresh check that follows the explanation (data/repair_check.js): the response says whether one is on offer. Free; no model.
    checkStatus: (args) => checkStatus({ ...args, deps: buildCheckDeps() }),
    withhold: (args) => withheldForRecheck(supabaseAdmin(), args),
    readWallet: (u) => readAIWallet(u).catch(() => null),
    now: Date.now,
    // One line per failed repair, for the Vercel logs: stage, error code, provider status and code, model, elapsed ms.
    // Never a student id, a question id, prompt text or a key.
    log: (line) => console.error(line),
    // The per-repair interpretation line is a diagnostic, not an error: stdout, so Vercel does not list it as one.
    info: (line) => console.log(line),
  };
  return runRepair({ user, attemptId, questionId, requestId, startedAt, deps, config: { route: REPAIR_ROUTE, effort: REPAIR_EFFORT, fallbackRoute: REPAIR_FALLBACK_ROUTE } });
}
