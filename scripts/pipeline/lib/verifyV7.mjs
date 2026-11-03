import { createHash } from 'node:crypto';
import { canonicalQuestion, contentHash, evidenceSignature } from '../../../data/content_evidence.js';
import { presentationLint } from '../../../data/question_presentation.mjs';
import { FACTORY_POLICY, provenanceReasons, needsNumericChecks } from '../../../data/question_factory_policy.mjs';
import { structureVerdict, blindView } from './evidencePipeline.mjs';
import { createFactoryEvidenceV7, requiredStagesV7, FACTORY_VERIFIER_VERSION_V7, TOPOLOGIES } from './factoryEvidenceV7.mjs';
import { criteriaResultsV7, cuetFitSummary, evaluateEvidenceV7, V7_TOPOLOGIES, effortsFor } from '../../../data/cuet_fit_evidence.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Same stage-by-stage, fail-closed flow as the legacy verifier, with the topology-dependent stage list and the
// CUET-fit record. Nothing about the legacy verifier, its caches or its records is shared or modified.
export async function verifyCandidateV7(candidate, { registry, ledger, adapters, topology = TOPOLOGIES.dual_blind, secret = process.env.CUET_EVIDENCE_SIGNING_KEY, seen = new Set(), academicOnly = false }) {
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
  const stamp = (result, stage) => ({ ...result, stage, provider: result.provider || 'local', model: result.model || null, effort: result.effort || null, prompt_version: result.prompt_version || FACTORY_VERIFIER_VERSION_V7, candidate_id: id, content_hash, evidence_hash: hash(result) });
  checks.schema = stamp(local, 'schema'); checks.dedupe = stamp({ passed: true, stem }, 'dedupe');
  const family = registry.families?.[candidate.family_id];
  if (!family || family.state !== 'active') return fail('family_not_active');
  const references = candidate.source_refs || [];
  if (!references.length || references.some(r => { const s = registry.sources?.[r.id]; return !s || s.state !== 'active' || !s.reuse_permitted || s.version !== r.version || !r.support_hash || s.supports?.[r.locator] !== r.support_hash; })) return fail('source_support_missing');
  const view = blindView(candidate, references), numeric = needsNumericChecks(candidate, registry);
  for (const stage of requiredStagesV7(candidate.route, numeric, topology)) {
    const adapter = adapters?.[stage];
    if (typeof adapter !== 'function') return fail(`adapter_missing:${stage}`);
    const cacheKey = hash({ id, content_hash, references, version: FACTORY_VERIFIER_VERSION_V7, topology: topology.id, stage, family_version: family.version, provenance: candidate.provenance, adapter_provenance: adapter.provenance || null });
    let result = ledger?.getCache(cacheKey);
    if (!result) {
      result = await adapter(structuredClone(stage === 'explanation_support' ? { ...view, proposed_explanation: canonicalQuestion(candidate).explanation } : view));
      if (!result || result.candidate_id !== id || result.content_hash !== content_hash || result.mock === true) return fail(`unmatched_verdict:${stage}`);
      ledger?.setCache(cacheKey, result);
    }
    checks[stage] = stamp({ ...result, source_refs: references }, stage);
    if (result.passed !== true) return { ...fail(`failed:${stage}`), failure_details: result.reasons || [], failed_stage: stage };
    if (['blind_solution', 'independent_evaluation'].includes(stage) && result.solved_key !== canonicalQuestion(candidate).key) return fail(stage === 'blind_solution' ? 'blind_key_contradiction' : 'independent_key_contradiction');
  }
  const spec = V7_TOPOLOGIES[topology.id];
  const record = { candidate_id: id, content_hash, state: 'eligible', route: candidate.route, family_id: candidate.family_id, family_version: family.version, sources: references,
    policy_version: FACTORY_POLICY, provenance: candidate.provenance, numeric_required: numeric, question_type: candidate.question_type, verifier_version: FACTORY_VERIFIER_VERSION_V7, validation_topology: topology.id,
    verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), solved_key: checks.blind_solution.solved_key, checks,
    criteria: criteriaResultsV7(checks, candidate, spec), cuet_fit: cuetFitSummary(checks, spec, candidate) };
  const question = { ...candidate, evidence: { record, signature: evidenceSignature(record, secret) } };
  const verdict = evaluateEvidenceV7(question, { ...registry, secret });
  return verdict.eligible ? { state: 'eligible', question } : fail(verdict.reasons.join(','));
}
export async function validateFactoryCandidateV7(candidate, { registry, ledger, transport, topology = TOPOLOGIES.dual_blind, exemplarExclude, calibrationPurpose = false, efforts, seen }) {
  const adapters = createFactoryEvidenceV7({ registry, ledger, transport, topology, exemplarExclude, calibrationPurpose, efforts: efforts || effortsFor(candidate) });
  return verifyCandidateV7(candidate, { registry, ledger, adapters, topology, seen });
}
