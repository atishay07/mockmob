import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPOLOGIES, createFactoryEvidenceV7 } from '../lib/factoryEvidenceV7.mjs';
import { PRODUCTION_TOPOLOGIES, V7_TOPOLOGIES, cuetFitReleased } from '../../../data/cuet_fit_evidence.mjs';
import { PYQ_MAX_READING_WORDS } from '../../../data/cuet_fit_rubric.mjs';
import { MAX_WAVE_SIZE } from '../lib/contractV7.mjs';
import { CUET_FORMAT_PLAN, CUET_DIFFICULTY_PLAN, expandPlan } from '../lib/focusedBriefsV7.mjs';
import { lunaBody } from '../lib/factoryEvidence.mjs';

test('rule 1: the publishable topology keeps every validator', () => {
  assert.deepEqual([...PRODUCTION_TOPOLOGIES], ['dual_blind']);
  const t = TOPOLOGIES.dual_blind, d = V7_TOPOLOGIES.dual_blind;
  assert.equal(t.primary, 'openai'); assert.equal(t.secondary, 'gemini'); assert.equal(t.explanation, 'openai');
  assert.equal(d.primary.provider, 'openai'); assert.equal(d.secondary.provider, 'gemini'); assert.equal(d.explanation.provider, 'openai');
  const adapters = createFactoryEvidenceV7({ registry: { exam_specs: {} }, ledger: { getCache() {}, setCache() {} }, transport: {}, topology: t });
  for (const stage of ['source_support', 'blind_solution', 'independent_evaluation', 'explanation_support', 'exam_fit']) assert.equal(typeof adapters[stage], 'function', stage);
});
test('rule 1: a reduced topology can never be released to students', () => {
  const release = { state: 'released', verifier_version: 'cuet-fit-validator-v7.2', cuet_fit_contract: 'cuet-fit-v1.2', effort_policy: 'effort-policy-v1', source_registry_version: 1, critical_false_accepts: 0, benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) }, prompt_hash: 'p' };
  const record = topology => ({ validation_topology: topology, verifier_version: release.verifier_version, checks: { blind_solution: { evaluation_prompt: 'p', provider: 'openai', effort: 'high' }, explanation_support: { effort: 'high' }, independent_evaluation: { effort: 'medium' } } });
  const manifest = { cuet_fit_releases: { dual_blind: release, single_luna: release, single_gemini: release } };
  assert.equal(cuetFitReleased(manifest, { version: 1 }, record('dual_blind')), true);
  assert.equal(cuetFitReleased(manifest, { version: 1 }, record('single_luna')), false);
  assert.equal(cuetFitReleased(manifest, { version: 1 }, record('single_gemini')), false);
});
test('rule 2: effort levels are explicit, stamped and limited to measured settings', () => {
  assert.throws(() => createFactoryEvidenceV7({ registry: {}, ledger: {}, transport: {}, efforts: { blind: 'max' } }), /unsupported_effort/);
  const body = lunaBody('s', { a: 1 }, 'medium', 100, { type: 'object' });
  assert.equal(body.reasoning.effort, 'medium');
});
test('rule 3 and 5: waves, descriptive PYQ reference and the calibrated plan are bounded', () => {
  assert.equal(MAX_WAVE_SIZE, 10); assert.equal(PYQ_MAX_READING_WORDS, 132);
  for (const [subject, counts] of Object.entries(CUET_FORMAT_PLAN)) assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 25, subject);
  assert.equal(Object.values(CUET_DIFFICULTY_PLAN).reduce((a, b) => a + b, 0), 25);
  assert.equal(expandPlan(CUET_FORMAT_PLAN.economics, 10).length, 10);
  assert.ok(CUET_DIFFICULTY_PLAN.hard <= 1, 'PYQs are about 2% hard');
});
test('rule 4: the per-question loop sends no tools, so no web search is billed', () => {
  const source = ['scripts/pipeline/lib/factoryEvidenceV7.mjs', 'scripts/pipeline/lib/verifyV7.mjs', 'scripts/pipeline/tools/cuetFitFactory.mjs'].map(p => readFileSync(p, 'utf8')).join('\n');
  assert.equal(/web_search|tools\s*:/.test(source.replace(/\/\/.*$/gm, '')), false);
  assert.equal('tools' in lunaBody('s', {}, 'low', 10, null), false);
});
test('rule 9: v7 records keep the policy literal the publication RPC accepts', () => {
  const sql = readFileSync('supabase/migrations/20261005185759_question_factory.sql', 'utf8');
  assert.ok(sql.includes("'cuet-llm-v3'"));
  assert.ok(readFileSync('scripts/pipeline/lib/verifyV7.mjs', 'utf8').includes('policy_version: FACTORY_POLICY'));
});

import { blindEffortFor, effortsFor } from '../../../data/cuet_fit_evidence.mjs';
test('rule 2: effort policy is medium only for English word-meaning formats and high everywhere else', () => {
  for (const type of ['synonym', 'antonym', 'correct_word_usage', 'matching']) assert.equal(blindEffortFor({ subject: 'english', question_type: type }), 'medium', type);
  for (const q of [{ subject: 'english', question_type: 'reading_comprehension' }, { subject: 'english', question_type: 'sequence_ordering' }, { subject: 'accountancy', question_type: 'matching' }, { subject: 'economics', question_type: 'numerical_calculation' }, { subject: 'business_studies', question_type: 'conceptual_mcq' }]) assert.equal(blindEffortFor(q), 'high', JSON.stringify(q));
  assert.deepEqual(effortsFor({ subject: 'english', question_type: 'synonym' }), { blind: 'medium', explanation: 'high', gemini: 'medium' });
});
