import test from 'node:test';
import assert from 'node:assert/strict';
import { contentHash } from '../../../data/content_evidence.js';
import { assessDifficultyV717 } from '../lib/difficultyPolicyV717.mjs';
import { deriveScorecardV717, BLIND_SCORE_IDS_V717 } from '../lib/scorecardPolicyV717.mjs';
import { scorecardFormatIssuesV717 } from '../lib/scorecardPolicyV717.mjs';

const evidenceId = 'E1.1';
function candidate({ id = 'v717-demand', key = 'A', body = 'Which management function compares actual performance with a standard?' } = {}) {
  return { id, subject: 'business_studies', chapter: 'Controlling', route: 'conceptual', question_type: 'conceptual_mcq',
    body, options: ['Planning', 'Organising', 'Controlling', 'Staffing'].map((text, index) => ({ key: 'ABCD'[index], text })),
    correct_answer: key, explanation: 'Controlling compares actual performance against standards.', source_refs: [{ id: 'source-v717' }] };
}
function difficulty(level, { basis = 'heuristic', exemplarIds = [], operation = 'Identify the function from a direct definition.' } = {}) {
  return { level, reason: `Observed demand: ${operation}`, comparison_basis: basis, operation,
    concepts_conditions: ['management function', 'comparison with an established standard'], exemplar_ids: exemplarIds };
}
function scores(value = 8) {
  return Object.fromEntries(BLIND_SCORE_IDS_V717.map(id => [id, { score: value, note: `Observed ${value} for this criterion.` }]));
}
function blindReport(item, provider, demand, options) {
  const stage = provider === 'openai' ? 'blind_solution' : 'independent_evaluation';
  return { candidate_id: item.id, content_hash: contentHash(item), provider,
    model: provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash', stage,
    solved_key: 'A', answer_set: ['A'], derivation: 'The supplied rule and wording establish the answer.', source_ids: [evidenceId],
    options: ['A', 'B', 'C', 'D'].map(option => ({ option, status: option === 'A' ? 'defensible' : 'not_answer', basis: 'excerpt',
      source_ids: [evidenceId], reason: option === 'A' ? 'This option answers the stem.' : 'This option does not answer the stem.', ...(options?.[option] || {}) })),
    academic: { syllabus_entitlement: 'supported', source_support: 'supported', decisive_assumptions: 'supported', numerical_accuracy: 'not_applicable',
      boundary_cases: 'not_applicable', passage_answerability: 'not_applicable', completeness: 'supported', format_valid: 'supported', presentation_readable: 'supported' },
    difficulty_assessment: demand, scores: scores(), issues: [] };
}
function auditReport(item) {
  return { candidate_id: item.id, content_hash: contentHash(item), provider: 'openai', model: 'gpt-6-luna', stage: 'explanation_support',
    answer_set: ['A'], explanation_status: 'supported', options_status: 'supported', source_ids: [evidenceId],
    claims: [{ claim: item.explanation, basis: 'excerpt', status: 'supported', source_ids: [evidenceId], reason: 'The source supports the explanation.' }],
    scores: Object.fromEntries(['13', '14', '17', '20'].map(id => [id, { score: 8, note: 'Checked against the source.' }])), issues: [] };
}
function reports(item, left = difficulty('medium'), right = difficulty('medium')) {
  return [blindReport(item, 'openai', left), blindReport(item, 'gemini', right)];
}
function derive(item, pair = reports(item), audit = auditReport(item)) {
  return deriveScorecardV717(item, pair, audit, { evidenceCatalog: [{ id: evidenceId }],
    calibrationExemplars: [{ id: 'matched-example-1', subject: item.subject, question_type: item.question_type }],
    localChecks: { structure: true, presentation: true, provenance: true, syllabus_registry: true, source_integrity: true, novelty: true, numeric_required: false } });
}

test('V717 preserves observed Easy and Medium bands and only confirms Hard by independent agreement', () => {
  const item = candidate();
  const easyMedium = derive(item, reports(item, difficulty('easy'), difficulty('medium')));
  assert.equal(easyMedium.state, 'eligible');
  assert.equal(easyMedium.difficulty.level, 'medium');
  assert.equal(easyMedium.difficulty.purpose, 'cuet_core');

  const easy = derive(item, reports(item, difficulty('easy'), difficulty('easy')));
  assert.equal(easy.state, 'eligible');
  assert.equal(easy.difficulty.level, 'easy');
  assert.equal(easy.difficulty.purpose, 'warmup');
  assert.equal(easy.quality_score, 8, 'difficulty does not alter craft score');

  const hard = derive(item, reports(item, difficulty('hard', { operation: 'Integrate competing conditions across two syllabus concepts.' }),
    difficulty('hard', { operation: 'Integrate competing conditions across two syllabus concepts.' })));
  assert.equal(hard.state, 'eligible');
  assert.equal(hard.difficulty.level, 'hard');
  assert.equal(hard.difficulty.nta_policy, 'fallback_only_after_easy_medium_shortage');

  const disputedHard = derive(item, reports(item, difficulty('medium'), difficulty('hard')));
  assert.equal(disputedHard.state, 'quarantined');
  assert.equal(disputedHard.outcome, 'routing_hold');
  assert.equal(disputedHard.academic_sound, true);
  assert.equal(disputedHard.difficulty.level, 'hard');
});

test('V717 binds authenticated comparator claims to supplied exemplar IDs and keeps heuristic claims unanchored', () => {
  const item = candidate(), base = reports(item);
  base[0].difficulty_assessment = difficulty('medium', { basis: 'authenticated_exemplar', exemplarIds: ['matched-example-1'] });
  assert.deepEqual(scorecardFormatIssuesV717(item, base, null, { blindOnly: true, exemplarIds: ['matched-example-1'] }), []);
  assert.ok(scorecardFormatIssuesV717(item, base, null, { blindOnly: true, exemplarIds: ['different-example'] })
    .includes('difficulty_comparator_unbound:blind_solution'));
  base[0].difficulty_assessment = difficulty('medium', { basis: 'authenticated_exemplar', exemplarIds: [] });
  assert.ok(scorecardFormatIssuesV717(item, base, null, { blindOnly: true, exemplarIds: [] })
    .includes('difficulty_comparator_unbound:blind_solution'));
  base[0].difficulty_assessment = difficulty('medium', { basis: 'heuristic', exemplarIds: ['matched-example-1'] });
  assert.ok(scorecardFormatIssuesV717(item, base, null, { blindOnly: true, exemplarIds: ['matched-example-1'] })
    .includes('difficulty_comparator_unbound:blind_solution'));
});

test('V717 does not treat a true statement as a NOT-stem answer and quarantines an unresolved rival', () => {
  const item = candidate({ id: 'v717-not-stem', key: 'A', body: 'Which option is NOT a function of management?' });
  const pair = reports(item, difficulty('easy'), difficulty('easy'));
  // On a NOT stem the three genuine functions are true statements but are not answers to the question.
  const correctNotReading = pair.map(report => ({ ...report, options: report.options.map(row => ({ ...row,
    status: row.option === 'A' ? 'defensible' : 'not_answer',
    reason: row.option === 'A' ? 'This is the only choice that satisfies NOT.' : 'This true function does not satisfy the requested exception.' })) }));
  const sound = derive(item, correctNotReading);
  assert.equal(sound.state, 'eligible');
  assert.equal(sound.difficulty.level, 'easy', 'answer polarity does not rewrite observed demand');

  pair[0].options = pair[0].options.map(row => row.option === 'B' ? { ...row, status: 'unresolved', reason: 'This may also satisfy the requested exception.' } : row);
  const result = derive(item, pair);
  assert.equal(result.state, 'quarantined');
  assert.equal(result.outcome, 'academic_quarantine');
  assert.ok(result.reasons.some(reason => reason.includes('unresolved_or_defensible_rival:blind_solution:B')));
  assert.equal(result.difficulty, undefined, 'ambiguous answer status is not silently converted into a Medium difficulty band');
});
