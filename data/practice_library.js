import { publicationEligibility } from './evidence_registry';
import { excludeHeldFamilies } from './evidence_holds';
import { legacyPracticeVisible } from './practice_availability';
import { verifyAnswerIntegrity } from './answer_integrity';

export async function readablePracticeQuestions(rows, db, { requireEvidence = false } = {}) {
  // Apply the same structural answer and community quality floor to inventory
  // aggregates and every selector. These checks do not certify academic truth.
  rows = rows.filter(row => String(row.body ?? row.question ?? '').trim() && Number(row.score ?? 0) >= -2 && verifyAnswerIntegrity(row).accepted);
  const eligible = rows.filter(row => publicationEligibility(row).eligible);
  const checked = await excludeHeldFamilies(eligible, db);
  if (requireEvidence) return checked;
  const legacy = rows.filter(legacyPracticeVisible);
  // Existing library rows with family identifiers must respect deployed family holds.
  // A missing migration is tolerated only for legacy rows; all other failures stop reads.
  let unheld = legacy;
  const families = [...new Set(legacy.map(q => q.family_id || q.template_id).filter(Boolean))];
  if (families.length) {
    const held = new Set();
    for (let i = 0; i < families.length; i += 300) {
      const { data, error } = await db.from('recovery_family_holds').select('family_id').in('family_id', families.slice(i, i + 300));
      if (error && !['42P01', 'PGRST205'].includes(error.code)) throw new Error('family_hold_lookup_required');
      for (const row of data || []) held.add(row.family_id);
    }
    unheld = legacy.filter(q => !held.has(q.family_id || q.template_id));
  }
  const ids = new Set([...checked, ...unheld].map(row => row.id));
  return rows.filter(row => ids.has(row.id));
}
