import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { cuetFitVerdict, conditionVerdict, optionChallengeVerdict, solveSecondsLevel, derivedSolveSeconds, readingWords, readingLoadReference, CUET_FIT_CRITERIA, CRITERION_IDS } from '../../../data/cuet_fit_rubric.mjs';
import { buildFixtures, applyAdditions } from '../lib/cuetFitBenchmark.mjs';
import { validateFactoryCandidateV7 } from '../lib/verifyV7.mjs';
import { TOPOLOGIES, interpretEvaluation, chapterVerdictV7 } from '../lib/factoryEvidenceV7.mjs';
import { evaluateEvidenceV7, cuetFitReleased, V7_TOPOLOGIES, isCuetFitRecord } from '../../../data/cuet_fit_evidence.mjs';
import { publicationEligibility } from '../../../data/evidence_registry.js';
import { contentHash } from '../../../data/content_evidence.js';

process.env.CUET_EVIDENCE_SIGNING_KEY = 'unit-test-signing-key';
const registry = JSON.parse(readFileSync('data/source_registry.json', 'utf8'));
const levels = (o, steps = 2) => ({ criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(k => [k, { level: o[k] ?? 3, evidence: 'x' }])), reasoning_steps: steps, estimated_difficulty: 'easy', cognitive_level: 'recall', exemplar_ids_compared: ['e1'] });
const W = { words: 60 };
const challenges = (key, over = {}) => [...'ABCD'].filter(k => k !== key).map(option => ({ option, strongest_reading: 'contrived reading', correct_under_reading: false, reading_status: 'strained', convention_evidence_ids: [], ...(over[option] || {}) }));

test('CUET fit: direct recall at PYQ level passes; easy is not poor', () => {
  const v = cuetFitVerdict(levels({}, 1), W);
  assert.equal(v.pass, true); assert.equal(v.score, 10);
  assert.equal(cuetFitVerdict(levels({ level_calibration: 3, discrimination_value: 0 }, 1), W).pass, true);   // weak distractors alone never block
});
test('CUET fit: anchors drive a deterministic pass/fail, never a model-chosen overall', () => {
  assert.equal(cuetFitVerdict(levels({ syllabus_objective: 1 }), W).pass, false);          // peripheral trivia
  assert.equal(cuetFitVerdict(levels({ format_authenticity: 1 }), W).pass, false);          // unusual format
  assert.equal(cuetFitVerdict(levels({ level_calibration: 0 }), W).pass, false);            // outside PYQ range
  assert.equal(cuetFitVerdict(levels({ discrimination_value: 1, level_calibration: 2 }, 3), W).pass, true);
  assert.equal(cuetFitVerdict(levels({}, 9), { words: 120 }).pass, false);                  // nine-step calculation: about 206 s
  assert.equal(cuetFitVerdict(levels({}, 1), { words: 133 }).pass, true);                   // observed max is not a universal limit
  assert.equal(cuetFitVerdict(levels({}, 1), { words: 450 }).pass, false);                  // time estimate exceeds 150 s
  assert.equal(cuetFitVerdict({}, W).pass, false);
  assert.equal(cuetFitVerdict(levels({}), {}).pass, false);                                 // reading load must be measured
});
test('CUET fit: time is a heuristic estimate, not an observed timing rule', () => {
  assert.equal(derivedSolveSeconds(2, 60), 62); assert.equal(derivedSolveSeconds(9, 120), 206); assert.equal(derivedSolveSeconds(0, 60), null);
  assert.deepEqual([60, 90, 91, 150, 151, 240, 241].map(solveSecondsLevel), [3, 3, 2, 2, 1, 1, 0]);
  assert.equal(readingWords({ body: 'one two three', options: ['four', 'five six'], passage_text: 'a b c d e f g h i j' }), 8);
  assert.equal(CRITERION_IDS.length, 5); assert.ok(CUET_FIT_CRITERIA.every(c => c.anchors[3] && c.anchors[0]));
});
test('reading reference uses authenticated subject and format examples and reports thin or missing samples', () => {
  const examples = Array.from({ length: 10 }, (_, i) => ({ subject: 'economics', question_type: 'direct_recall', final_key_matched: true, body: `word ${i}`, options: ['a', 'b', 'c', 'd'] }));
  const reference = readingLoadReference(133, 'economics', 'direct_recall', examples);
  assert.equal(reference.status, 'subject_format_sample'); assert.equal(reference.sample_size, 10); assert.equal(reference.observed_max_words, 6);
  assert.equal(readingLoadReference(133, 'accountancy', 'direct_recall', examples).status, 'no_matched_authenticated_examples');
  assert.equal(readingLoadReference(133, 'economics', 'direct_recall', examples.slice(0, 2)).status, 'thin_subject_format_sample');
});
test('answer conditions: only unstated, merely implied or concluded decisive assumptions block; conventions need evidence', () => {
  assert.equal(conditionVerdict([{ condition: 'These demands refers to C', status: 'text_reference', alters_key_if_changed: true }]).ok, true);
  assert.equal(conditionVerdict([{ condition: 'standard convention', status: 'convention', alters_key_if_changed: true, convention_evidence_ids: ['E1.1'] }], ['E1.1']).ok, true);
  assert.equal(conditionVerdict([{ condition: 'standard convention', status: 'convention', alters_key_if_changed: true, convention_evidence_ids: [] }], ['E1.1']).ok, false);
  assert.equal(conditionVerdict([{ condition: 'x', status: 'implied_decisive', alters_key_if_changed: false }]).ok, true);
  assert.equal(conditionVerdict([{ condition: 'no other instalment is unpaid', status: 'inferred_fact', alters_key_if_changed: true }]).ok, false);
  assert.equal(conditionVerdict([{ condition: 'financial status', status: 'missing', alters_key_if_changed: true }]).ok, false);
  assert.equal(conditionVerdict([{ condition: 'x', status: 'implied_decisive', alters_key_if_changed: true }]).ok, false);
  assert.equal(conditionVerdict(undefined).ok, false);
});
test('alternative-reading challenge: a reasonable reading that makes another option correct blocks; a strained one does not', () => {
  assert.equal(optionChallengeVerdict(challenges('B'), 'B').ok, true);
  assert.equal(optionChallengeVerdict(challenges('B', { D: { correct_under_reading: true, reading_status: 'strained' } }), 'B').ok, true);
  assert.equal(optionChallengeVerdict(challenges('B', { D: { correct_under_reading: true, reading_status: 'reasonable_unstated' } }), 'B').ok, false);
  assert.equal(optionChallengeVerdict(challenges('B', { A: { correct_under_reading: true, reading_status: 'stated_by_stem' } }), 'B').ok, false);
  assert.equal(optionChallengeVerdict(challenges('B', { C: { correct_under_reading: true, reading_status: 'standard_convention', convention_evidence_ids: ['E1.1'] } }), 'B', ['E1.1']).ok, false);
  assert.equal(optionChallengeVerdict(challenges('B', { C: { correct_under_reading: false, reading_status: 'standard_convention' } }), 'B', ['E1.1']).reason, 'convention_without_selected_source_evidence');
  assert.equal(optionChallengeVerdict(challenges('B').slice(1), 'B').reason, 'option_challenges_incomplete');
  assert.equal(optionChallengeVerdict(undefined, 'B').reason, 'option_challenges_required');
  assert.equal(optionChallengeVerdict(challenges('B'), 'abstain').ok, false);
});
test('chapter labels inside one syllabus unit are a relabel, not a rejection; a different unit is', () => {
  const ok = chapterVerdictV7({ subject: 'accountancy', assigned: 'Analysis of Financial Statements', chapters: ['Comparative & Common Size Statements'], cited: [], sources: {} });
  assert.equal(ok.ok, true); assert.equal(ok.relabelled_within_unit, true);
  const bad = chapterVerdictV7({ subject: 'accountancy', assigned: 'Accounting Ratios', chapters: ['Share Capital'], cited: [], sources: {} });
  assert.equal(bad.ok, false);
});
test('mandatory defects stay blocking; style notes never block', () => {
  const view = { body: 'stem words here', options: ['a', 'b', 'c', 'd'], passage: '' };
  const r = { solved_key: 'B', cuet_fit: levels({}), answer_conditions: [], option_challenges: challenges('B'), blocking_defects: [{ category: 'multiple_correct_options', detail: 'B and C' }], principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true };
  assert.equal(interpretEvaluation(r, view).defects.length, 1);
  assert.equal(interpretEvaluation({ ...r, blocking_defects: [] }, view).defects.length, 0);
  const hidden = interpretEvaluation({ ...r, blocking_defects: [], option_challenges: challenges('B', { D: { correct_under_reading: true, reading_status: 'reasonable_unstated', strongest_reading: 'another instalment unpaid' } }) }, view);
  assert.equal(hidden.defects.length, 1); assert.equal(hidden.missing_assumptions, true);
  assert.equal(interpretEvaluation({ ...r, blocking_defects: [], option_challenges: undefined }, view).defects_valid, false);
});

// ---- end-to-end verification flow with a deterministic fake provider (no spend) ----
function fakeTransport(behaviour = {}) {
  const calls = [];
  return { calls, async generate(provider, body, options) {
    const user = provider === 'openai' ? JSON.parse(body.input.find(r => r.role === 'user').content) : provider === 'anthropic' ? JSON.parse(body.messages[0].content) : JSON.parse(body.contents[0].parts[0].text);
    const system = provider === 'openai' ? body.input[0].content : provider === 'anthropic' ? body.system : body.systemInstruction.parts[0].text;
    calls.push({ provider, stage: options.stage });
    let result;
    if (options.stage === 'explanation_support') {
      result = { candidate_id: user.candidate_id, content_hash: user.content_hash, claims: [{ claim: 'c', basis: 'stem' }], passed: behaviour.explanationPasses !== false, reasons: [], evidence_ids: (user.evidence_catalog || []).slice(0, 1).map(e => e.id) };
    } else {
      const catalogue = user.evidence_catalog || [];
      const key = behaviour.solvedKey?.[provider] ?? behaviour.key;
      result = { candidate_id: user.candidate_id, content_hash: user.content_hash, solved_key: key, single_defensible_answer: true, source_support: true, numeric_solution: true, boundary_cases: true, passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
        evidence_ids: catalogue.slice(0, 1).map(e => e.id), reasons: ['ok'], syllabus_chapter: user.chapter, syllabus_topic: 't', syllabus_entitlement: true, presentation_ready: true, question_type_match: true,
        principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true, answer_conditions: behaviour.conditions || [{ condition: 'stated', status: 'explicit', alters_key_if_changed: false, convention_evidence_ids: [] }], option_challenges: behaviour.challenges || challenges(key), blocking_defects: behaviour.defects || [], style_notes: [],
        cuet_fit: behaviour.fit || levels({}, 2) };
    }
    const text = JSON.stringify(result);
    return provider === 'openai' ? { output_text: text, status: 'completed' } : provider === 'anthropic' ? { content: [{ type: 'text', text }], stop_reason: 'end_turn' } : { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] };
  } };
}
const { additions, fixtures } = buildFixtures(registry);
const scratch = applyAdditions(registry, additions, fixtures);
const valid = fixtures.find(f => f.id === 'v7b-acc-inv-turnover');
const run = async (candidate, behaviour, topology = TOPOLOGIES.dual_blind) => {
  const ledger = new BudgetLedger(':memory:');
  try { const transport = fakeTransport(behaviour); const r = await validateFactoryCandidateV7(candidate, { registry: scratch, ledger, transport, topology, seen: new Set() }); return { r, transport }; } finally { ledger.close(); }
};
test('V7 flow: a sound item is eligible under every topology and the record verifies independently', async () => {
  for (const topology of Object.values(TOPOLOGIES)) {
    const { r } = await run(valid.candidate, { key: 'B' }, topology);
    assert.equal(r.state, 'eligible', JSON.stringify(r.reasons) + JSON.stringify(r.failure_details));
    assert.equal(isCuetFitRecord(r.question.evidence.record), true);
    assert.equal(r.question.evidence.record.validation_topology, topology.id);
    assert.equal(evaluateEvidenceV7(r.question, { ...scratch, secret: process.env.CUET_EVIDENCE_SIGNING_KEY }).eligible, true);
  }
});
test('V7 flow: single-validator topologies make fewer paid calls; hidden-key solving is blind', async () => {
  const dual = await run(valid.candidate, { key: 'B' }), single = await run(valid.candidate, { key: 'B' }, TOPOLOGIES.single_luna);
  assert.ok(single.transport.calls.length < dual.transport.calls.length);
  assert.equal(single.transport.calls.filter(c => c.provider === 'gemini').length, 0);
});
test('V7 flow: wrong key, blocking defects, undeclared decisive assumptions and weak CUET fit all reject', async () => {
  assert.equal((await run(valid.candidate, { key: 'A' })).r.state, 'quarantined');
  assert.equal((await run(valid.candidate, { key: 'B', defects: [{ category: 'multiple_correct_options', detail: 'B and C' }] })).r.state, 'quarantined');
  assert.equal((await run(valid.candidate, { key: 'B', conditions: [{ condition: 'financial status', status: 'missing', alters_key_if_changed: true }] })).r.state, 'quarantined');
  assert.equal((await run(valid.candidate, { key: 'B', fit: levels({ syllabus_objective: 1 }) })).r.state, 'quarantined');
  assert.equal((await run(valid.candidate, { key: 'B', conditions: [{ condition: 'no other instalment is unpaid', status: 'inferred_fact', alters_key_if_changed: true }] })).r.state, 'quarantined');
  assert.equal((await run(valid.candidate, { key: 'B', challenges: challenges('B', { D: { correct_under_reading: true, reading_status: 'reasonable_unstated', strongest_reading: 'a further instalment was also unpaid' } }) })).r.state, 'quarantined');
  assert.equal((await run(valid.candidate, { key: 'B', challenges: challenges('B').slice(1) })).r.state, 'quarantined');
  const ok = await run(valid.candidate, { key: 'B', conditions: [{ condition: 'cohesion reference', status: 'text_reference', alters_key_if_changed: true }] });
  assert.equal(ok.r.state, 'eligible');
});
test('V7 flow: disagreement between validators and a failed explanation audit reject', async () => {
  assert.equal((await run(valid.candidate, { key: 'B', solvedKey: { gemini: 'C' } })).r.state, 'quarantined');
  assert.equal((await run(valid.candidate, { key: 'B', explanationPasses: false })).r.state, 'quarantined');
});
test('V7 evidence is tamper-evident and student retrieval needs a measured release', async () => {
  const { r } = await run(valid.candidate, { key: 'B' });
  const q = r.question, secretRegistry = { ...scratch, secret: process.env.CUET_EVIDENCE_SIGNING_KEY };
  assert.equal(evaluateEvidenceV7({ ...q, correct_answer: 'C' }, secretRegistry).eligible, false);
  assert.equal(evaluateEvidenceV7({ ...q, body: q.body + ' ' }, secretRegistry).eligible, false);
  const forged = structuredClone(q); forged.evidence.record.checks.blind_solution.cuet_fit = levels({ syllabus_objective: 0 }); assert.equal(evaluateEvidenceV7(forged, secretRegistry).eligible, false);
  const unsigned = structuredClone(q); unsigned.evidence.record.validation_topology = 'single_luna'; assert.equal(evaluateEvidenceV7(unsigned, secretRegistry).eligible, false);
  const row = { ...q, status: 'live', verification_state: 'verified' };
  assert.equal(publicationEligibility(row, { registry: scratch, manifest: {} }).eligible, false);
  assert.equal(publicationEligibility(row, { registry: scratch, manifest: {} }).reasons[0], 'cuet_fit_release_required');
  const release = { state: 'released', verifier_version: q.evidence.record.verifier_version, cuet_fit_contract: 'cuet-fit-v1.2', effort_policy: 'effort-policy-v1', source_registry_version: scratch.version, critical_false_accepts: 0, benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) }, prompt_hash: q.evidence.record.checks.blind_solution.evaluation_prompt };
  const manifest = { cuet_fit_releases: { dual_blind: release } };
  assert.equal(cuetFitReleased(manifest, scratch, q.evidence.record), true);
  assert.equal(cuetFitReleased({ cuet_fit_releases: { dual_blind: { ...release, critical_false_accepts: 1 } } }, scratch, q.evidence.record), false);
  assert.equal(contentHash(q), q.evidence.record.content_hash);
  assert.ok(V7_TOPOLOGIES.single_luna);
});

// ---- author-side integrity (tolerance is limited to formatting and extraction damage) ----
import { classifyQuote, normalizeOptionLabels } from '../lib/authorIntegrityV7.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';
const corpusText = ['Marginal product of an input is defined as the change in output per unit of change in the input when all other inputs are held constant.', 'very weak', 'quiet and peaceful\ncontinuing for only a short time'];
test('quote integrity: exact, whole short definitions and line-joined verbatim spans pass; paraphrase and fabrication do not', () => {
  assert.equal(classifyQuote('Marginal product of an input is defined as the change in output per unit of change in the input', corpusText), 'exact');
  assert.equal(classifyQuote('very weak', corpusText), 'whole_short');
  assert.equal(classifyQuote('quiet and peaceful\ncontinuing for only a short time', corpusText), 'exact');
  assert.equal(classifyQuote('Marginal product is the extra output obtained when one more worker is hired.', corpusText), null);
  assert.equal(classifyQuote('Marginal product of an input is defined as the total output divided by the number of workers employed in the firm', corpusText), null);
});
test('option label prefixes are stripped only when uniform and sequential, and never from matching-style options', () => {
  const base = { subject: 'economics', question_type: 'conceptual_mcq', body: 'Which is correct?', passage_text: '', provenance: { kind: 'original_practice' } };
  const labelled = { ...base, options: ['(A) first thing', '(B) second thing', '(C) third thing', '(D) fourth thing'] };
  const n = normalizeOptionLabels(labelled);
  assert.equal(n.changed, true); assert.deepEqual(n.candidate.options, ['first thing', 'second thing', 'third thing', 'fourth thing']); assert.equal(presentationLint(n.candidate).includes('option_label_prefix'), false);
  const mixed = { ...base, options: ['(A) first thing', 'second thing', '(C) third thing', '(D) fourth thing'] };
  assert.equal(normalizeOptionLabels(mixed).changed, false);
  const matching = { ...base, options: ['(A)-(I), (B)-(II)', '(A)-(II), (B)-(I)', '(A)-(III), (B)-(I)', '(A)-(I), (B)-(III)'] };
  assert.equal(normalizeOptionLabels(matching).changed, false);
  const plain = { ...base, options: ['one', 'two', 'three', 'four'] };
  assert.equal(normalizeOptionLabels(plain).changed, false);
});

test('reading load above the observed maximum does not fail by itself', () => {
  assert.equal(cuetFitVerdict(levels({}, 1), { words: 132 }).pass, true);
  const over = cuetFitVerdict(levels({}, 1), { words: 133 });
  assert.equal(over.pass, true); assert.equal(over.reasons.some(r => r.startsWith('cuet_fit_reading_load_133')), false);
  assert.equal(over.levels.time_suitability, 3); assert.equal(over.time_estimate_method, 'heuristic_not_observed');
});
