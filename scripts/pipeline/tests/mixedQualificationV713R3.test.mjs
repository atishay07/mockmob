import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REQUIRED_SUBJECTS } from '../lib/releaseEvidenceV7.mjs';
import { assessReleaseEvidenceV713, expectedReleaseBindingV713 } from '../lib/releaseEvidenceV713.mjs';
import { buildCuetFitTopologyReleaseVNext } from '../lib/currentCuetCalibrationGateVNext.mjs';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';

const binding = expectedReleaseBindingV713();
function makeRole(role, validCount, invalidCount) {
  const fixtures = [];
  for (let i = 0; i < validCount + invalidCount; i++) {
    const expected_valid = i < validCount;
    fixtures.push({ id: `${role}-${i}`, group: expected_valid ? 'authored_valid' : 'controlled_defect',
      category: expected_valid ? 'valid_control' : 'multiple_defensible_answers', expected_valid,
      candidate: { subject: REQUIRED_SUBJECTS[i % REQUIRED_SUBJECTS.length] }, oracle: { basis: 'offline fixture' } });
  }
  const release_eligibility = { scope: role === 'fresh' ? 'full_cuet_release' : 'regression', classification: role,
    approved_before_evaluation: true, previously_read: role !== 'fresh', tuned_on: role !== 'fresh', preregistration_id: 'offline-mixed37' };
  const frozen = { id: `offline-mixed37-${role}`, fixtures, payload_hash: payloadHash(fixtures),
    verifier_version: binding.verifier_version, release_eligibility };
  const result = { verifier_version: binding.verifier_version, contract_binding: binding, release_eligibility,
    benchmark: { id: frozen.id, payload_hash: frozen.payload_hash },
    topologies: { dual_blind: fixtures.map(f => ({ id: f.id, group: f.group, category: f.category,
      expected_valid: f.expected_valid, state: f.expected_valid ? 'eligible' : 'quarantined' })) },
    evaluations: { dual_blind: Object.fromEntries(fixtures.map(f => [f.id, { openai: { state: 'ok' }, gemini: { state: 'ok' } }])) } };
  return { frozen, result };
}
const fresh = makeRole('fresh', 18, 13), regression = makeRole('regression', 2, 4);
const assess = (f = fresh, r = regression) => assessReleaseEvidenceV713({ frozenFresh: f.frozen, resultFresh: f.result,
  frozenRegression: r.frozen, resultRegression: r.result });

test('mixed37 assessment counts all valid and controlled-defect rows across exact roles', () => {
  assert.equal(fresh.frozen.fixtures.length, 31); assert.equal(regression.frozen.fixtures.length, 6);
  const result = assess(); assert.equal(result.state, 'released'); assert.equal(result.metrics.valid_items, 20);
  assert.equal(result.metrics.fresh_defects, 13); assert.equal(result.metrics.regression_defects, 4);
  assert.deepEqual(result.metrics.fresh_false_accepts, []); assert.deepEqual(result.metrics.regression_false_accepts, []);
});

test('held, error, and unfinished outcomes fail the assessment', () => {
  for (const state of ['held', 'error', 'pending']) {
    const changed = structuredClone(fresh); changed.result.topologies.dual_blind[0].state = state;
    const result = assess(changed); assert.equal(result.state, 'paused', state);
    assert.ok(result.problems.some(problem => problem.includes('invalid_or_error_verdict')));
  }
});

test('missing provider evidence and role payload hash mismatches fail the assessment', () => {
  const missing = structuredClone(fresh); delete missing.result.evaluations.dual_blind[missing.frozen.fixtures[0].id].gemini;
  assert.ok(assess(missing).problems.some(problem => problem.startsWith('fresh_missing_or_error_provider_evaluation:')));
  const frozenMismatch = structuredClone(fresh); frozenMismatch.frozen.payload_hash = '0'.repeat(64);
  assert.ok(assess(frozenMismatch).problems.includes('fresh_frozen_payload_hash_invalid'));
  const resultMismatch = structuredClone(fresh); resultMismatch.result.benchmark.payload_hash = '0'.repeat(64);
  assert.ok(assess(resultMismatch).problems.includes('fresh_result_frozen_hash_mismatch'));
});

test('paused evidence builds a paused candidate with a pending benchmark', () => {
  const assessment = assess(); assessment.state = 'paused'; assessment.problems.push('joint_study_unfinished');
  const candidate = buildCuetFitTopologyReleaseVNext({ assessment, resultFresh: fresh.result, topology: 'dual_blind',
    tag: 'v7.13', freshName: 'fresh31-regression6', binding, sourceRegistryVersion: 'offline', at: '2026-10-10T00:00:00.000Z' });
  assert.equal(candidate.state, 'paused'); assert.equal(candidate.benchmark.state, 'pending');
});

test('collector binds projections, independent judgments, settlements, and never writes the release manifest', () => {
  const source = readFileSync(resolve('scripts/pipeline/tools/collectMixedQualificationV713R3.mjs'), 'utf8');
  assert.match(source, /hashJSON\(envelope\.fixtures\) !== hashJSON\(frozen\.fixtures\.filter\(f => f\.measurement_role === role\)\)/);
  for (const field of ['candidate_id', 'content_hash', 'provider', 'evaluation_prompt', 'validation_contract_hash', 'prompt_version'])
    assert.match(source, new RegExp(`judgment\\.${field}\\s*!==`));
  assert.match(source, /r\.candidate_id === f\.id && r\.provider === provider && r\.state === 'settled' && r\.receipt/);
  assert.match(source, /if \(!accounting\.receipt_complete \|\| accounting\.held_micro\)/);
  assert.match(source, /release_manifest_written: false/); assert.doesNotMatch(source, /calibration_manifest\.json/);
});

test('runner summary fails closed on held cost and missing provider judgments', () => {
  const source = readFileSync(resolve('scripts/pipeline/tools/runQualificationV713R3.mjs'), 'utf8');
  assert.match(source, /a\.receipt_complete && a\.held_micro === 0/);
  assert.match(source, /\['openai','gemini'\]\.every\(p => state\.cases\[f\.id\]\?\.independent_judgments\?\.\[p\]\)/);
});