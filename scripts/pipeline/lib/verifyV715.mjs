import { assessDifficultyV713 as assessDifficultyV715 } from './difficultyPolicyV713.mjs';
import { createHash } from 'node:crypto';
import { canonicalQuestion, contentHash, evidenceSignature } from '../../../data/content_evidence.js';
import { presentationLint } from '../../../data/question_presentation.mjs';
import { FACTORY_POLICY, provenanceReasons, needsNumericChecks } from '../../../data/question_factory_policy.mjs';
import { structureVerdict } from './evidencePipeline.mjs';
import { createFactoryEvidenceV715, blindViewV715, applyPreparationValueV76, requiredStagesV7, TOPOLOGIES, V715_PROMPT_HASH } from './factoryEvidenceV715.mjs';
import { FACTORY_VERIFIER_VERSION_V715, validationContractV715 } from './contractV715.mjs';
import { PREPARATION_VALUE_VERSION_V76 } from './preparationValueV76.mjs';
import { applyOptionResolutionV715, applyResolutionAuditV715 } from './optionResolutionV715.mjs';
import { criteriaResultsV7, cuetFitSummary, evaluateEvidenceV7, V7_TOPOLOGIES, effortsFor } from '../../../data/cuet_fit_evidence.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// V7.12 (copy of frozen V7.9 r5): the V7.8 verifier flow with the compact option resolution and its explanation-stage audit (see optionResolutionV715.mjs).
// The v7.4 flow, unchanged in every correctness predicate, plus preparation-value gating:
//  1. a free deterministic check before any paid call (nothing is spent on an item that is already known to lack preparation value);
//  2. the same check again once the independent evaluations have reported reasoning steps, as the CUET-fit gate (exam_fit).
// A preparation-value failure quarantines the candidate; it never turns a correctness failure into a pass.
export async function verifyCandidateV715(candidate, { registry, ledger, adapters, topology = TOPOLOGIES.dual_blind, secret = process.env.CUET_EVIDENCE_SIGNING_KEY, seen = new Set() }) {
  const contractHash = validationContractV715();
  const id = candidate.id || candidate.candidate_id || candidate.local_id, content_hash = contentHash(candidate), checks = {};
  const fail = reason => ({ state: 'quarantined', candidate_id: id, content_hash, reasons: [reason], checks });
  if (!id || !secret || process.env.MOCK_AI === 'true') return fail('verification_configuration_missing');
  const local = structureVerdict(candidate);
  if (!local.passed) return fail(local.reasons.join(','));
  const early = [...presentationLint(candidate), ...provenanceReasons(candidate, registry)];
  if (early.length) return fail(early.join(','));
  const stem = hash({ subject: candidate.subject, body: canonicalQuestion(candidate).body.toLowerCase().replace(/\s+/g, ' ').trim() });
  if (seen.has(stem)) return fail('duplicate_before_paid_checks');
  seen.add(stem);
  const stamp = (result, stage) => ({ ...result, stage, provider: result.provider || 'local', model: result.model || null, effort: result.effort || null, prompt_version: result.prompt_version || FACTORY_VERIFIER_VERSION_V715, candidate_id: id, content_hash, evidence_hash: hash(result) });
  checks.schema = stamp(local, 'schema'); checks.dedupe = stamp({ passed: true, stem }, 'dedupe');
  const family = registry.families?.[candidate.family_id];
  if (!family || family.state !== 'active') return fail('family_not_active');
  const references = candidate.source_refs || [];
  if (!references.length || references.some(r => { const s = registry.sources?.[r.id]; return !s || s.state !== 'active' || !s.reuse_permitted || s.version !== r.version || !r.support_hash || s.supports?.[r.locator] !== r.support_hash; })) return fail('source_support_missing');
  const preparationFailure = (applied, stage) => ({ ...fail(`failed:${stage}`), reasons: [`failed:${stage}`, ...applied.value.findings.filter(f => f.blocking).map(f => f.code)],
    failure_details: applied.value.findings.filter(f => f.blocking).map(f => `${f.code}: ${f.basis}`), failed_stage: stage, preparation_value: applied.value });
  const free = applyPreparationValueV76(candidate, {}, { checks });
  if (free.value.blocking) return preparationFailure(free, 'preparation_value');
  const view = blindViewV715(candidate, references), numeric = needsNumericChecks(candidate, registry), viewHash = hash(view);
  let preparation = free.value;
  for (const stage of requiredStagesV7(candidate.route, numeric, topology)) {
    const adapter = adapters?.[stage];
    if (typeof adapter !== 'function') return fail(`adapter_missing:${stage}`);
    const cacheKey = hash({ id, content_hash, view_hash: viewHash, references, version: FACTORY_VERIFIER_VERSION_V715, contract_hash: contractHash, topology: topology.id, stage, family_version: family.version, provenance: candidate.provenance, adapter_provenance: adapter.provenance || null });
    let result = ledger?.getCache(cacheKey), cacheHit = Boolean(result);
    if (!cacheHit) {
      result = await adapter(structuredClone(stage === 'explanation_support' ? { ...view, proposed_explanation: canonicalQuestion(candidate).explanation } : view));
    }
    if (!result || result.candidate_id !== id || result.content_hash !== content_hash || result.mock === true) return fail(`unmatched_verdict:${stage}`);
    if (result.prompt_version !== FACTORY_VERIFIER_VERSION_V715 || result.validation_contract_hash !== contractHash || result.evaluation_prompt !== V715_PROMPT_HASH) return fail(`unbound_v715_verdict:${stage}`);
    if (!cacheHit) ledger?.setCache(cacheKey, result);
    if (['source_support', 'syllabus_mapping', 'presentation_quality', 'numeric_solution', 'llm_boundary_cases', 'passage_integrity', 'passage_answerability',
      'blind_solution', 'alternatives', 'independent_evaluation', 'exam_fit'].includes(stage)) {
      const trusted = adapters.__context?.(view);
      result = applyOptionResolutionV715(result, view, { evidenceCatalog: trusted?.evidence_catalog || [] });
    }
    if (['blind_solution', 'independent_evaluation'].includes(stage) && adapters.__freezeResolution?.(stage, view, result) !== true) return fail(`option_resolution_freeze_failed:${stage}`);
    if (stage === 'explanation_support') {
      if (typeof adapters.__auditResolution !== 'function') return fail('option_resolution_audit_adapter_missing');
      result = adapters.__auditResolution(view, result);
    }
    checks[stage] = stamp({ ...result, source_refs: references }, stage);
    if (result.passed !== true) return { ...fail(`failed:${stage}`), failure_details: result.reasons || [], failed_stage: stage };
    if (['blind_solution', 'independent_evaluation'].includes(stage) && result.solved_key !== canonicalQuestion(candidate).key) return fail(stage === 'blind_solution' ? 'blind_key_contradiction' : 'independent_key_contradiction');
    if (stage === 'exam_fit') {
      // CUET-fit gate: reasoning steps from the completed evaluations are now known.
      const applied = applyPreparationValueV76(candidate, result, { checks });
      preparation = applied.value;
      if (applied.value.blocking) { checks[stage] = stamp({ ...applied.result, source_refs: references }, stage); return preparationFailure(applied, stage); }
    }
  }
  if (checks.blind_solution?.option_resolution?.passed !== true ||
      (topology.secondary && checks.independent_evaluation?.option_resolution?.passed !== true)) return fail('option_resolution_required_before_eligibility');
  const demand = assessDifficultyV715(checks);
  if (!demand.passed) return fail(demand.reason);
  if (demand.level !== candidate.difficulty) return { ...fail('difficulty_target_mismatch'), observed_difficulty: demand };
  const spec = V7_TOPOLOGIES[topology.id];
  const record = { candidate_id: id, content_hash, state: 'eligible', route: candidate.route, family_id: candidate.family_id, family_version: family.version, sources: references,
    policy_version: FACTORY_POLICY, provenance: candidate.provenance, numeric_required: numeric, question_type: candidate.question_type, verifier_version: FACTORY_VERIFIER_VERSION_V715, validation_contract_hash: contractHash, validation_topology: topology.id,
    difficulty_assessment: demand,
    preparation_value: { version: PREPARATION_VALUE_VERSION_V76, applicable: preparation.applicable === true, findings: preparation.findings, learning_objective: candidate.learning_objective || null },
    option_resolution: { version: 'compact-option-resolution-v715', required: true, passed: true,
      matrices: ['blind_solution', 'independent_evaluation'].filter(stage => checks[stage]).map(stage => ({ stage, matrix: checks[stage].option_resolution_rows })) },
    verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), solved_key: checks.blind_solution.solved_key, checks,
    criteria: criteriaResultsV7(checks, candidate, spec), cuet_fit: cuetFitSummary(checks, spec, candidate) };
  const question = { ...candidate, evidence: { record, signature: evidenceSignature(record, secret) } };
  const verdict = evaluateEvidenceV7(question, { ...registry, secret });
  return verdict.eligible ? { state: 'eligible', question } : fail(verdict.reasons.join(','));
}
export async function validateFactoryCandidateV715(candidate, { registry, ledger, transport, topology = TOPOLOGIES.dual_blind, exemplarExclude, calibrationPurpose = false, efforts, seen }) {
  const adapters = createFactoryEvidenceV715({ registry, ledger, transport, topology, exemplarExclude, calibrationPurpose, efforts: efforts || effortsFor(candidate) });
  return verifyCandidateV715(candidate, { registry, ledger, adapters, topology, seen });
}
