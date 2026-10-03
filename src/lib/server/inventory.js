import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { readablePracticeQuestions } from '@/../data/practice_library';
import { publicationEligibility } from '@/../data/evidence_registry';
// Cache only public aggregates, never keys or personal evidence. Errors are not cached.
let cached = null;
export async function publicInventory() {
  if (cached?.until > Date.now()) return cached.value;
  const db = supabaseAdmin(), rows = [];
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
  const value = { state: 'available', bankSize: eligible.length, subjectCounts, recoverySubjectCounts, recoveryEligible: Object.values(recoverySubjectCounts).reduce((a,b)=>a+b,0), checkedAt: new Date().toISOString(), note: 'Ordinary library counts use the same publication and family-hold policies as practice. A count does not establish a complete mock blueprint or recovery pathway.' };
  cached = { value, until: Date.now() + 60000 };
  return value;
}
