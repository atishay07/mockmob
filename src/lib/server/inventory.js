import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { readablePracticeQuestions } from '@/../data/practice_library';
import { eligibilitySnapshot, publicationEligibility } from '@/../data/evidence_registry';
import { assertFullBankRead } from '@/../data/full_bank_guard';
import { SERVE_MEMO_MS, servedInventory } from './inventorySnapshot';

// Cache only public aggregates, never keys or personal evidence.
// Counting reads every question with every column (about 41 MB on 15 Oct 2026) and checks each one's
// publication evidence. It runs once a day, from the cron (/api/internal/refresh-inventory), and only
// on Vercel production (data/full_bank_guard.js). Requests serve the stored row; they never count.
let cached = null;

async function computeInventory(db) {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from('questions').select('*').eq('is_deleted', false).order('id').range(start, start + 999);
    if (error) throw new Error('INVENTORY_UNAVAILABLE');
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const visible = rows.filter(q => q.status === 'live' || (q.verification_state === 'verified' && q.exploration_state === 'active'));
  const eligible = await readablePracticeQuestions(visible, db, { requireEvidence: false });
  const subjectCounts = {}, recoverySubjectCounts = {};
  const snapshot = eligible.length ? eligibilitySnapshot() : undefined;
  for (const q of eligible) {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    if (publicationEligibility(q, snapshot).eligible) recoverySubjectCounts[q.subject] = (recoverySubjectCounts[q.subject] || 0) + 1;
  }
  return { state: 'available', bankSize: eligible.length, subjectCounts, recoverySubjectCounts, recoveryEligible: Object.values(recoverySubjectCounts).reduce((a,b)=>a+b,0), checkedAt: new Date().toISOString(), note: 'Ordinary library counts use the same publication and family-hold policies as practice. A count does not establish a complete mock blueprint or recovery pathway.' };
}

/**
 * Recompute the aggregates and store them. Called only by the daily cron. Outside Vercel production it
 * throws FullBankReadBlocked before reading anything. The stored row is now the only source requests
 * use, so a failed write is an error (the cron reports it) rather than silently ignored.
 */
export async function refreshInventorySnapshot() {
  assertFullBankRead('the inventory refresh');
  const db = supabaseAdmin();
  const value = await computeInventory(db);
  const { error } = await db.from('public_inventory_snapshot').upsert({ id: 'current', value, computed_at: value.checkedAt })
    .then(result => result, failure => ({ error: failure }));
  if (error) throw new Error('INVENTORY_STORE_FAILED');
  cached = { value, until: Date.now() + SERVE_MEMO_MS };
  return value;
}

/** The stored counts, or an "unavailable" fallback when there are none. Never reads the whole bank. */
export async function publicInventory() {
  if (cached?.until > Date.now()) return cached.value;
  const { value, memo } = await servedInventory({
    readStored: async () => (await supabaseAdmin().from('public_inventory_snapshot').select('value,computed_at').eq('id', 'current').maybeSingle()).data,
  });
  if (memo) cached = { value, until: Date.now() + SERVE_MEMO_MS };
  return value;
}
