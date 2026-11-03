import test from 'node:test';
import assert from 'node:assert/strict';
import { assessDifficultyV713 } from '../lib/difficultyPolicyV713.mjs';
import { buildPilotDepsV713 } from '../lib/cuetPilotDepsV713.mjs';
import { repairable } from '../lib/cuetPilotRunV713.mjs';

const observation = (provider, level) => ({
  provider,
  difficulty_assessment: {
    level,
    reason: `${level} demand based on the objective and comparison basis.`,
    comparison_basis: 'heuristic',
  },
});

test('V713 accepts independently agreed demand bands and preserves their practice purpose', () => {
  for (const [level, purpose] of [['easy', 'warmup'], ['medium', 'cuet_core'], ['hard', 'hard_practice']]) {
    const result = assessDifficultyV713({
      blind_solution: observation('openai', level),
      independent_evaluation: observation('gemini', level),
    });
    assert.equal(result.passed, true);
    assert.equal(result.level, level);
    assert.equal(result.purpose, purpose);
    assert.equal(result.agreement, true);
  }
});

test('V713 resolves Easy/Medium disagreement conservatively to Medium, never easy', () => {
  const result = assessDifficultyV713({
    blind_solution: observation('openai', 'easy'),
    independent_evaluation: observation('gemini', 'medium'),
  });
  assert.equal(result.passed, true);
  assert.equal(result.level, 'medium');
  assert.equal(result.agreement, false);
  assert.equal(result.purpose, 'cuet_core');
});

test('V713 refuses to assign Hard unless both independent reviewers confirm above-normal demand', () => {
  for (const [first, second] of [['easy', 'hard'], ['medium', 'hard']]) {
    const result = assessDifficultyV713({
      blind_solution: observation('openai', first),
      independent_evaluation: observation('gemini', second),
    });
    assert.equal(result.passed, false);
    assert.equal(result.reason, 'hard_demand_not_independently_confirmed');
    assert.equal(result.level, 'hard');
  }
});

test('V713 fails closed on missing, unknown, malformed, or same-provider demand observations', () => {
  assert.equal(assessDifficultyV713({}).reason, 'independent_difficulty_assessment_missing');
  assert.equal(assessDifficultyV713({
    blind_solution: observation('openai', 'expert'),
    independent_evaluation: observation('gemini', 'medium'),
  }).reason, 'independent_difficulty_assessment_missing');
  assert.equal(assessDifficultyV713({
    blind_solution: { ...observation('openai', 'medium'), difficulty_assessment: { ...observation('openai', 'medium').difficulty_assessment, reason: ' ' } },
    independent_evaluation: observation('gemini', 'medium'),
  }).reason, 'independent_difficulty_assessment_missing');
  assert.equal(assessDifficultyV713({
    blind_solution: observation('openai', 'medium'),
    independent_evaluation: observation('openai', 'medium'),
  }).reason, 'difficulty_assessments_not_independent');
});

test('V713 rejects authored difficulty metadata that differs from the registered job before validation', async () => {
  const deps = buildPilotDepsV713({ registry: {}, ledger: {}, transport: { generate() { throw new Error('provider_must_not_run'); } } });
  // The mismatch gate is local and must stop before the academic adapters or provider transport run.
  const candidate = { id: 'registered-easy', difficulty: 'medium' };
  const result = await deps.validate(candidate, { id: 'registered-easy', difficulty: 'easy' });
  assert.equal(result.state, 'quarantined');
  assert.ok(result.reasons.includes('failed:difficulty_target'));
  assert.ok(result.reasons.includes('registered_difficulty_mismatch'));
  assert.match(result.failure_details[0], /Registered demand is easy; authored label medium cannot replace it/);
  assert.equal(repairable(result), true, 'the existing one-targeted-repair path can correct the demand mismatch');
});
