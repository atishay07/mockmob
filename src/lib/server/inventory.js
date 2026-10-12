import 'server-only';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readablePracticeQuestions } from '@/../data/practice_library';
import { publicationEligibility } from '@/../data/evidence_registry';
import { snapshotDecision } from './inventorySnapshot';

// Cache only public aggregates, never keys or personal evidence. Errors are not cached.
// Checking every question's publication evidence is CPU-heavy (seconds to minutes on a cold
// instance), so requests read a stored snapshot and the expensive pass runs in the background.
let cached = null;
let refreshing = null;

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
  for (const q of eligible) {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    if (publicationEligibility(q).eligible) recoverySubjectCounts[q.subject] = (recoverySubjectCounts[q.subject] || 0) + 1;
  }
  return { state: 'available', bankSize: eligible.length, subjectCounts, recoverySubjectCounts, recoveryEligible: Object.values(recoverySubjectCounts).reduce((a,b)=>a+b,0), checkedAt: new Date().toISOString(), note: 'Ordinary library counts use the same publication and family-hold policies as practice. A count does not establish a complete mock blueprint or recovery pathway.' };
}

/** Recompute the aggregates and store them. A missing snapshot table is tolerated. */
export async function refreshInventorySnapshot() {
  const db = supabaseAdmin();
  const value = await computeInventory(db);
  await db.from('public_inventory_snapshot').upsert({ id: 'current', value, computed_at: value.checkedAt }).then(() => {}, () => {});
  cached = { value, until: Date.now() + 60000 };
  return value;
}

function scheduleRefresh() {
  if (refreshing) return;
  const run = () => (refreshing = refreshInventorySnapshot().catch(() => {}).finally(() => { refreshing = null; }));
  try { after(run); } catch { run(); } // after() needs a request scope
}

export async function publicInventory() {
  if (cached?.until > Date.now()) return cached.value;
  const { data } = await supabaseAdmin().from('public_inventory_snapshot').select('value,computed_at').eq('id', 'current').maybeSingle()
    .then(result => result, () => ({ data: null }));
  const decision = snapshotDecision(data);
  if (decision.use === 'snapshot') {
    cached = { value: data.value, until: Date.now() + 60000 };
    if (decision.refresh) scheduleRefresh();
    return data.value;
  }
  return refreshInventorySnapshot();
}
