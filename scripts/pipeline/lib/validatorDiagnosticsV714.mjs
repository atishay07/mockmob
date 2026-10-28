// Explain inherited fail-closed predicates; never mutate a judgment or convert failure into a pass.
import { CUET_FIT_CRITERIA } from './cuetFit.mjs';
import { conditionVerdict, optionChallengeVerdict } from '../../../data/cuet_fit_rubric.mjs';

export function annotateValidationSchemaV714(schema) {
  const p = schema?.properties;
  if (!p) throw Error('v714_schema_required');
  if (p.option_challenges) {
    p.option_challenges.description = 'Exactly three distinct non-chosen options, excluding your independently derived solved_key. Different from the four-row option_resolution.';
    p.option_challenges.items.properties.option.description = 'One rival option other than solved_key. Cover every non-chosen option once.';
  }
  for (const field of ['answer_conditions', 'option_challenges']) {
    const item = p[field]?.items?.properties;
    if (!item) continue;
    item.convention_evidence_ids.description = 'Exact IDs also selected in evidence_ids for convention/standard_convention; otherwise empty.';
  }
  if (p.cuet_fit) {
    p.cuet_fit.description = 'Anchored CUET craft criteria, independently of correctness and difficulty. No default zeros or blank evidence; apply each anchor to the actual task.';
    for (const criterion of CUET_FIT_CRITERIA.filter(c => !c.derived)) {
      const node = p.cuet_fit.properties.criteria.properties[criterion.id];
      if (!node) throw Error('v714_criterion_schema_missing:' + criterion.id);
      node.properties.level.description = `${criterion.id}: use the canonical 0-3 anchors in the system instructions. Judge actual demand independently of correctness; easy CUET recall can score 3.`;
      node.properties.evidence.description = 'A concise actual task/exemplar/source basis for this level, never a placeholder.';
    }
  }
  return schema;
}

export function withValidationDiagnosticsV714(result) {
  if (!result || typeof result !== 'object') return result;
  const reasons = [...(result.reasons || [])];
  const add = code => { if (code && !reasons.includes(code)) reasons.push(code); };
  if (result.challenges_ok === false) {
    add(result.challenge_reason || optionChallengeVerdict(result.option_challenges, result.solved_key, result.evidence_ids).reason || 'option_challenges_failed');
  }
  if (result.conditions_ok === false) add(conditionVerdict(result.answer_conditions, result.evidence_ids).reason || 'answer_conditions_failed');
  if (result.reference_quotes_valid === false) add('selected_evidence_quotes_invalid');
  if (result.defects_valid === false) add('blocking_defect_or_challenge_record_invalid');
  if (result.option_resolution?.passed === false) add(result.option_resolution.reason || 'option_resolution_failed');
  return { ...result, reasons };
}
