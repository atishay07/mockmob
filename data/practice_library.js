import { sharedEligibilitySnapshot, publicationEligibility } from './evidence_registry.js';
import { excludeHeldFamilies } from './evidence_holds.js';
import { legacyPracticeVisible } from './practice_availability.js';
import { verifyAnswerIntegrity } from './answer_integrity.js';
import { FACTORY_POLICY } from './question_factory_policy.mjs';

// `known` (optional): Map(question id -> eligible) for evidence-managed questions whose eligibility a stored
// verdict already settles (data/practice_verdicts.js). Those rows skip publicationEligibility and need only
// carry what the other checks read (family, provenance kind, evidence policy). Every other check still runs
// on the row, and a row that is not in `known` is judged on its evidence as before.
export async function readablePracticeQuestions(rows, db, { requireEvidence = false, known = null } = {}) {
  // Apply the same structural answer and community quality floor to inventory
  // aggregates and every selector. These checks do not certify academic truth.
  rows = rows.filter(row => String(row.body ?? row.question ?? '').trim() && Number(row.score ?? 0) >= -2 && verifyAnswerIntegrity(row).accepted);
  // Read the registry and calibration once for this pass; parsing them per row took ~35 ms each.
  const snapshot = rows.length ? sharedEligibilitySnapshot() : undefined;
  const eligible = rows.filter(row => (known?.has(row.id) ? known.get(row.id) === true : publicationEligibility(row, snapshot).eligible));
  const checked = await excludeHeldFamilies(eligible, db);
  const evidenceTier=row=>row.provenance?.kind && row.evidence?.record?.policy_version===FACTORY_POLICY?3:2;
  if (requireEvidence) return checked.map(row=>({...row,selection_evidence_tier:evidenceTier(row)}));
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
  const verified = new Set(checked.map(row => row.id));
  return rows.filter(row => ids.has(row.id)).map(row => ({ ...row, selection_evidence_tier: verified.has(row.id) ? evidenceTier(row) : 1 }));
}
