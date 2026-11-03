// Read-only accounting and exact outcome projection. This tool cannot publish or alter a release manifest.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';
import { assessReleaseEvidenceV713, expectedReleaseBindingV713 } from '../lib/releaseEvidenceV713.mjs';
import { buildCuetFitTopologyReleaseVNext } from '../lib/currentCuetCalibrationGateVNext.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
const directory = resolve(process.argv[2] || 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/qualification-fresh31-regression6');
const path = name => resolve(directory, name), read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const frozen = read(path('frozen.json')), reg = read(path('registration.json')), state = read(path('state.json'));
if (sha(path('frozen.json')) !== reg.frozen_sha256 || sha(path('registry.json')) !== reg.registry_sha256 ||
    frozen.denominator !== 37 || reg.id !== frozen.id || reg.cap_usd !== 1) throw Error('registered_joint_study_changed');
const binding = expectedReleaseBindingV713(), registry = read(path('registry.json'));
const db = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
let accounting, receipts;
try {
  accounting = scopedAccounting({ db }, reg.id + ':');
  receipts = accounting.requests.map(row => ({ ...row, receipt: JSON.parse(db.prepare('SELECT receipt_json FROM requests WHERE id=?').get(row.reservation_id)?.receipt_json || 'null') }));
} finally { db.close(); }
const projections = {};
for (const role of ['fresh', 'regression']) {
  const envelope = read(path('release-' + role + '-envelope.json'));
  if (envelope.underlying_frozen_sha256 !== sha(path('frozen.json')) || JSON.stringify(envelope.fixtures.map(f => f.id)) !== JSON.stringify(frozen.role_ids[role])) throw Error('role_projection_changed');
  if (hashJSON(envelope.fixtures) !== hashJSON(frozen.fixtures.filter(f => f.measurement_role === role))) throw Error('role_projection_payload_changed');
  const rows = envelope.fixtures.map(f => ({ id: f.id, group: f.group, category: f.category, expected_valid: f.expected_valid,
    state: state.cases[f.id]?.state || 'unfinished', reasons: state.cases[f.id]?.reasons || [] }));
  const result = { verifier_version: binding.verifier_version, contract_binding: binding, release_eligibility: envelope.release_eligibility,
    benchmark: { id: envelope.id, payload_hash: envelope.payload_hash }, topologies: { dual_blind: rows },
    evaluations: { dual_blind: Object.fromEntries(envelope.fixtures.map(f => [f.id, state.cases[f.id]?.independent_judgments || {}])) } };
  projections[role] = { frozen: envelope, result };
}
const totalIds = [...projections.fresh.frozen.fixtures, ...projections.regression.frozen.fixtures].map(f => f.id);
if (totalIds.length !== 37 || new Set(totalIds).size !== 37 || frozen.fixtures.some(f => !totalIds.includes(f.id))) throw Error('all37_projection_required');
const assessment = assessReleaseEvidenceV713({ frozenFresh: projections.fresh.frozen, resultFresh: projections.fresh.result,
  frozenRegression: projections.regression.frozen, resultRegression: projections.regression.result });
const freshValid = projections.fresh.frozen.fixtures.filter(f => f.expected_valid);
const freshOk = freshValid.filter(f => state.cases[f.id]?.state === 'eligible').length;
if (freshValid.length !== 18 || freshOk / freshValid.length < .85) assessment.problems.push('fresh_partition_valid_survival_below_85_percent');
for (const subject of ['accountancy','business_studies','economics','english']) {
  const rows = freshValid.filter(f => f.subject === subject);
  if (!rows.length || rows.filter(f => state.cases[f.id]?.state === 'eligible').length / rows.length < .70) assessment.problems.push('fresh_partition_subject_survival:' + subject);
}
if (!accounting.receipt_complete || accounting.held_micro) assessment.problems.push('joint_study_receipts_incomplete');
for (const f of frozen.fixtures) for (const provider of ['openai','gemini']) {
  const judgment = state.cases[f.id]?.independent_judgments?.[provider];
  if (!judgment || judgment.candidate_id !== f.id || judgment.content_hash !== f.content_hash || judgment.provider !== provider ||
      judgment.evaluation_prompt !== binding.prompt_hash || judgment.validation_contract_hash !== binding.validation_contract_hash ||
      judgment.prompt_version !== binding.verifier_version) assessment.problems.push('unbound_independent_judgment:' + f.id + ':' + provider);
  if (!receipts.some(r => r.candidate_id === f.id && r.provider === provider && r.state === 'settled' && r.receipt &&
      r.stage === (provider === 'openai' ? 'blind_solution' : 'independent_evaluation') && r.receipt.usage && !r.receipt.error))
    assessment.problems.push('missing_independent_provider_receipt:' + f.id + ':' + provider);
}
if (accounting.committed_micro > 1000000) assessment.problems.push('joint_study_cap_exceeded');
if (frozen.fixtures.some(f => !['eligible', 'quarantined'].includes(state.cases[f.id]?.state))) assessment.problems.push('joint_study_unfinished');
if (assessment.problems.length) assessment.state = 'paused';
const releaseCandidate = buildCuetFitTopologyReleaseVNext({ assessment, resultFresh: projections.fresh.result, topology: 'dual_blind',
  tag: 'v7.13', freshName: 'fresh31-regression6', binding, sourceRegistryVersion: registry.version, at: new Date().toISOString() });
const report = { collected_at: new Date().toISOString(), study_id: reg.id, frozen_sha256: sha(path('frozen.json')),
  registration_sha256: sha(path('registration.json')), denominator: 37, roles: { fresh: 31, regression: 6 }, assessment,
  settled_usd: accounting.settled_micro / 1e6, held_usd: accounting.held_micro / 1e6, receipt_complete: accounting.receipt_complete,
  publication: 'never', release_manifest_written: false, premium_quality_rating: 'not_established',
  cost_per_10000_publishable_questions: 'not_established_by_validator_benchmark',
  release_candidate: releaseCandidate, projections,
  cases: frozen.fixtures.map(f => ({ ...f, outcome: state.cases[f.id] || null,
    decisive_excerpts: f.candidate.source_refs.map(r => ({ ...r, text: registry.sources[r.id]?.facts?.[r.locator]?.text || null })),
    actual_cost_usd: receipts.filter(r => r.candidate_id === f.id).reduce((n, r) => n + r.settled_micro, 0) / 1e6,
    held_cost_usd: receipts.filter(r => r.candidate_id === f.id).reduce((n, r) => n + r.held_micro, 0) / 1e6 })), receipts };
const out = path('qualification-evidence-' + Date.now() + '.json');
writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ exported: out, state: assessment.state, problems: assessment.problems, metrics: assessment.metrics,
  settled_usd: report.settled_usd, held_usd: report.held_usd, publication: 'never' }, null, 2));
