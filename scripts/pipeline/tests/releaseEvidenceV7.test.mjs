import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReleaseEvidenceV7, expectedReleaseBinding } from '../lib/releaseEvidenceV7.mjs';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';

const binding = expectedReleaseBinding();
const subjects = ['accountancy', 'business_studies', 'economics', 'english'];
function makeSet(name, classification) {
  const fixtures = subjects.flatMap((subject, i) => [
    { id: `${name}-valid-${i}`, group: 'authored_valid', category: 'valid', expected_valid: true, candidate: { subject, question_type: 'mcq' }, oracle: { key: 'A' } },
    { id: `${name}-defect-${i}`, group: 'controlled_defect', category: 'wrong_key', expected_valid: false, candidate: { subject, question_type: 'mcq' }, oracle: { key: 'A' } }
  ]);
  const frozen = { id: `${name}-id`, fixtures, payload_hash: payloadHash(fixtures), verifier_version: binding.verifier_version, release_eligibility: classification === 'fresh'
    ? { scope: 'full_cuet_release', classification, preregistration_id: 'prereg-fresh', approved_before_evaluation: true, previously_read: false, tuned_on: false }
    : { scope: 'regression', classification, preregistration_id: 'prereg-regression' } };
  const rows = fixtures.map(f => ({ id: f.id, group: f.group, category: f.category, expected_valid: f.expected_valid, state: f.expected_valid ? 'eligible' : 'quarantined' }));
  const evaluations = Object.fromEntries(fixtures.map(f => [f.id, { openai: { key: 'A', fit: { pass: true } }, gemini: { key: 'A', fit: { pass: true } } }]));
  return { frozen, result: { verifier_version: binding.verifier_version, benchmark: { id: frozen.id, payload_hash: frozen.payload_hash }, contract_binding: structuredClone(binding), release_eligibility: structuredClone(frozen.release_eligibility), topologies: { dual_blind: rows }, evaluations } };
}
function assess(fresh = makeSet('fresh', 'fresh'), regression = makeSet('reg', 'regression')) {
  return assessReleaseEvidenceV7({ resultFresh: fresh.result, frozenFresh: fresh.frozen, resultRegression: regression.result, frozenRegression: regression.frozen });
}

test('only fully bound, preregistered, complete full-release evidence passes', () => {
  assert.equal(assess().state, 'released');
});

test('stale prompt or contract binding cannot be stamped with the current contract', () => {
  const fresh = makeSet('fresh', 'fresh'); fresh.result.contract_binding.prompt_hash = 'old-prompt';
  assert.ok(assess(fresh).problems.includes('fresh_contract_binding_mismatch'));
  fresh.result.contract_binding = structuredClone(binding); fresh.result.contract_binding.validation_contract_hash = 'old-contract';
  assert.ok(assess(fresh).problems.includes('fresh_contract_binding_mismatch'));
});

test('duplicate and missing topology rows fail exact fixture coverage', () => {
  const fresh = makeSet('fresh', 'fresh'); fresh.result.topologies.dual_blind.pop();
  fresh.result.topologies.dual_blind.push(structuredClone(fresh.result.topologies.dual_blind[0]));
  assert.ok(assess(fresh).problems.includes('fresh_dual_blind_rows_not_exact_fixture_coverage'));
});

test('provider errors cannot be counted as quarantined defect rejections', () => {
  const fresh = makeSet('fresh', 'fresh');
  fresh.result.evaluations[fresh.frozen.fixtures[1].id].openai.error = 'timeout';
  assert.ok(assess(fresh).problems.some(p => p.startsWith('fresh_missing_or_error_provider_evaluation:')));
});

test('official scoped or previously read study cannot qualify as fresh release evidence', () => {
  const fresh = makeSet('fresh', 'fresh');
  fresh.frozen.release_eligibility = { scope: 'official_calibration_only', classification: 'fresh', preregistration_id: 'official-46', approved_before_evaluation: true, previously_read: false, tuned_on: false };
  fresh.result.release_eligibility = structuredClone(fresh.frozen.release_eligibility);
  const out = assess(fresh);
  assert.equal(out.state, 'paused');
  assert.ok(out.problems.includes('fresh_set_not_preregistered_as_unseen_full_release'));
  assert.ok(out.problems.includes('fresh_official_scoped_set_cannot_release'));
});

test('missing subject coverage and changed frozen labels fail closed', () => {
  const fresh = makeSet('fresh', 'fresh');
  const regression = makeSet('reg', 'regression');
  fresh.frozen.fixtures[0].candidate.subject = 'english';
  fresh.frozen.payload_hash = payloadHash(fresh.frozen.fixtures);
  fresh.result.benchmark.payload_hash = fresh.frozen.payload_hash;
  regression.frozen.fixtures[0].candidate.subject = 'english';
  regression.frozen.payload_hash = payloadHash(regression.frozen.fixtures);
  regression.result.benchmark.payload_hash = regression.frozen.payload_hash;
  assert.ok(assess(fresh, regression).problems.includes('required_subject_missing:accountancy'));
  fresh.result.topologies.dual_blind[0].expected_valid = false;
  assert.ok(assess(fresh).problems.includes(`fresh_fixture_label_mismatch:${fresh.frozen.fixtures[0].id}`));
});
