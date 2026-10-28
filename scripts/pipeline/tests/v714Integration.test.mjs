import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { createFactoryEvidenceV714, TOPOLOGIES } from '../lib/factoryEvidenceV714.mjs';
import { verifyCandidateV714 } from '../lib/verifyV714.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { validationContractV714 } from '../lib/contractV714.mjs';
import { FACTORY_VERIFIER_VERSION_V713 } from '../lib/contractV713.mjs';
import { V714_PROMPT_HASH } from '../lib/factoryEvidenceV714.mjs';

const SECRET = 'offline-v714-integration-secret';
const FAMILY = 'v714-offline-family', PACK = 'v714-offline-pack', SOURCE = 'v714-offline-source';
const RULE = 'Cash receipts from the sale of goods and the rendering of services are examples of cash flows from operating activities.';
const SOURCE_TEXT = `${RULE}\nCash payments to acquire fixed assets are investing activities.\nCash proceeds from issuing shares are financing activities.`;
const EXCERPT_HASH = hashJSON(SOURCE_TEXT);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function makeScenario({ failure = null, sourceInvalid = false, seedV713Cache = false } = {}) {
  const numericCase = failure === 'missing-numeric';
  const candidate = {
    id: `v714-${failure || 'positive'}-${sourceInvalid ? 'badsource' : 'source'}`,
    subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: FAMILY, route: numericCase ? 'numerical' : 'conceptual',
    question_type: numericCase ? 'numerical_mcq' : 'conceptual_mcq', difficulty: 'medium',
    body: numericCase ? 'A retailer receives Rs. 40 cash from sale of goods. What is the amount of the operating cash receipt.'
      : 'A garment retailer receives cash from customers for garments it sells. Classify this cash flow.',
    options: numericCase ? ['Rs. 40.', 'Rs. 20.', 'Rs. 60.', 'Rs. 0.']
      : ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'],
    correct_answer: 'A', explanation: 'Cash received from customers for goods sold is an operating activity.',
    learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: 'Classify operating cash receipts from sales of goods.', target_term: '' },
    provenance: { kind: 'original_practice', adaptation_family: FAMILY, syllabus_version: 'offline-syllabus',
      pattern_version: 'offline-pattern', source_pack_id: PACK, source_pack_version: 1 },
    source_refs: [{ id: SOURCE, version: 1, locator: 'excerpt', support_hash: sourceInvalid ? '0'.repeat(64) : EXCERPT_HASH }],
    evidence_quotes: [RULE]
  };
  const registry = {
    version: 'offline-v714', examples: [], packs: { [PACK]: { state: 'active', version: 1, subject: 'accountancy' } },
    families: { [FAMILY]: { state: 'active', version: 1 } },
    exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [],
      syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', pattern_rules: {}, exam_rule_version: 'offline-rule' } },
    sources: { [SOURCE]: { id: SOURCE, state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64),
      extraction_checked: true, version: 1, supports: { excerpt: EXCERPT_HASH }, facts: { excerpt: { text: SOURCE_TEXT } },
      chapters: ['Cash Flow Statement'], kind: 'textbook', title: 'Offline source', url: 'https://ncert.nic.in/offline-v714-fixture' } }
  };
  const cache = new Map(), requests = [], ledger = {
    getCache(key) { return cache.get(key) ?? null; },
    setCache(key, value) { cache.set(key, structuredClone(value)); }
  };
  if (seedV713Cache) cache.set(`v713:${validationContractV713()}:evaluation:stale`, { passed: true, solved_key: 'A', mock: false });
  const matricesSeenAtAudit = [];
  const transport = { async generate(provider, body, options = {}) {
    requests.push({ provider, stage: options.stage, body: structuredClone(body), key: options.key });
    const userText = provider === 'openai' ? body.input.find(row => row.role === 'user').content : body.contents.find(row => row.role === 'user').parts[0].text;
    const input = JSON.parse(userText);
    if (options.stage === 'explanation_support') {
      matricesSeenAtAudit.push(input.option_resolutions);
      const key = input.option_resolutions?.[0]?.solved_key || 'A';
      const rivals = ['A', 'B', 'C', 'D'].filter(option => option !== key);
      const audit = { key, key_fully_supported: true, key_reason: 'The operating receipt is supported by the supplied excerpt.',
        unexcluded_rival_conditions: [], distractors: rivals.map(option => ({ option, decisively_wrong: true,
          basis: 'direct_contradiction', reason: 'The source-backed classification rules out this category.' })) };
      return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash,
        claims: [{ claim: candidate.explanation, basis: failure === 'unsupported-explanation' ? 'unsupported' : 'excerpt' }],
        passed: failure !== 'unsupported-explanation', reasons: failure === 'unsupported-explanation' ? ['Unsupported claim.'] : [],
        evidence_ids: input.evidence_catalog.map(e => e.id), resolution_audit: audit }) };
    }
    const key = failure === 'wrong-key' ? 'B' : 'A';
    const evidenceId = input.evidence_catalog[0]?.id || '';
    const choices = input.options;
    const rows = choices.map(option => {
      let status = option.key === key ? 'supported' : 'contradicted';
      if (failure === 'two-answers' && option.key === 'B') status = 'supported';
      if (failure === 'unknown-rival' && option.key === 'D') status = 'unresolved';
      const correct = status === 'supported';
      return { option: option.key, status, false_part: correct || status === 'unresolved' ? '' : option.text.replace(/\.$/, ''),
        premise_source: status === 'unresolved' ? 'none' : correct ? 'stem' : 'excerpt',
        evidence_id: status === 'unresolved' || correct ? '' : evidenceId,
        premise_quote: status === 'unresolved' ? '' : correct ? input.body : RULE,
        reason: correct ? 'The stem and cited rule establish this answer.' : status === 'unresolved' ? 'The evidence does not resolve this rival.' : 'The cited rule contradicts this category.' };
    });
    const challenges = choices.filter(option => option.key !== key).map(option => ({ option: option.key,
      strongest_reading: 'This rival assigns a different cash-flow category.', correct_under_reading: false,
      reading_status: 'contradicts_stem', convention_evidence_ids: [] }));
    const result = { candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: key,
      single_defensible_answer: true, source_support: true, numeric_solution: failure !== 'missing-numeric', boundary_cases: true,
      passage_integrity: true, passage_answerability: true, meaningfully_distinct: true, evidence_ids: evidenceId ? [evidenceId] : [],
      supporting_spans: [{ source_id: SOURCE, locator: 'excerpt', quote: RULE }], reasons: [],
      syllabus_chapter: 'Cash Flow Statement', syllabus_topic: 'Operating cash receipts', syllabus_entitlement: true,
      presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
      answer_conditions: [], option_challenges: challenges, option_resolution: rows, blocking_defects: [], style_notes: [],
      cuet_fit: { criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value']
        .map(id => [id, { level: 3, evidence: 'The item tests the named source-backed syllabus skill.' }])),
        reasoning_steps: 1, estimated_difficulty: 'medium', cognitive_level: 'comprehension', exemplar_ids_compared: [] } };
    if (options.stage === 'blind_solution' || options.stage === 'independent_evaluation') {
      if (failure !== 'missing-difficulty') result.difficulty_assessment = { level: failure === 'difficulty-mismatch' ? 'easy' : 'medium',
        reason: failure === 'difficulty-mismatch' ? 'Direct recall only.' : 'Normal CUET syllabus demand.', comparison_basis: 'heuristic' };
    }
    return { output_text: JSON.stringify(result) };
  } };
  const adapters = createFactoryEvidenceV714({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
  const run = () => verifyCandidateV714(candidate, { registry, ledger, adapters, topology: TOPOLOGIES.dual_blind, secret: SECRET });
  return { candidate, registry, cache, requests, matricesSeenAtAudit, adapters, run };
}

test('V714 verifier grants eligibility only after every inherited gate, two independent medium ratings, and both frozen audits', async () => {
  const s = makeScenario({ seedV713Cache: true });
  const result = await s.run();
  assert.equal(result.state, 'eligible', JSON.stringify(result.reasons || result));
  const record = result.question.evidence.record;
  assert.equal(record.verifier_version, 'cuet-fit-validator-v7.14-schema-semantics');
  assert.equal(record.validation_contract_hash, validationContractV714());
  assert.equal(record.checks.blind_solution.prompt_version, 'cuet-fit-validator-v7.14-schema-semantics');
  assert.equal(record.checks.blind_solution.validation_contract_hash, validationContractV714());
  assert.equal(record.checks.blind_solution.evaluation_prompt, V714_PROMPT_HASH);
  assert.equal(record.difficulty_assessment.level, 'medium');
  assert.equal(record.option_resolution.matrices.length, 2);
  assert.equal(record.checks.explanation_support.option_resolution_audit.passed, true);
  assert.deepEqual(s.requests.map(request => [request.provider, request.stage]), [
    ['openai', 'blind_solution'], ['gemini', 'independent_evaluation'], ['openai', 'explanation_support']
  ]);
  assert.equal(s.matricesSeenAtAudit.length, 1);
  assert.deepEqual(s.matricesSeenAtAudit[0].map(item => item.solver), ['openai', 'gemini']);
  assert.deepEqual(s.matricesSeenAtAudit[0].map(item => item.solved_key), ['A', 'A']);
  assert.ok([...s.cache.keys()].some(key => key.startsWith(`v714:${validationContractV714()}:`)));
  assert.ok(!s.requests.some(request => request.key?.startsWith(`v713:${validationContractV713()}:`)));
});

for (const [failure, expected] of [
  ['wrong-key', 'blind_key_contradiction'],
  ['two-answers', 'failed:source_support'],
  ['unknown-rival', 'failed:source_support'],
  ['unsupported-explanation', 'failed:explanation_support'],
  ['missing-numeric', 'failed:numeric_solution'],
  ['missing-difficulty', 'independent_difficulty_assessment_missing'],
  ['difficulty-mismatch', 'difficulty_target_mismatch']
]) {
  test(`V714 verifier quarantines ${failure} without weakening eligibility`, async () => {
    const s = makeScenario({ failure });
    const result = await s.run();
    assert.equal(result.state, 'quarantined', JSON.stringify(result.reasons || result));
    assert.ok(JSON.stringify(result.reasons || result).includes(expected), JSON.stringify(result.reasons || result));
  });
}

test('V714 rejects an invalid source before any adapter or transport call', async () => {
  const s = makeScenario({ sourceInvalid: true });
  const result = await s.run();
  assert.equal(result.state, 'quarantined');
  assert.ok(result.reasons.includes('source_support_missing'));
  assert.equal(s.requests.length, 0);
});

test('V714 refuses an old V713 cached judgment instead of accepting it as a current result', async () => {
  const s = makeScenario();
  s.adapters.blind_solution = async view => ({ candidate_id: view.candidate_id, content_hash: view.content_hash,
    provider: 'openai', passed: true, solved_key: 'A', reasons: [], prompt_version: FACTORY_VERIFIER_VERSION_V713,
    validation_contract_hash: validationContractV713(), evaluation_prompt: 'old-v713-prompt' });
  const result = await s.run();
  assert.equal(result.state, 'quarantined');
  assert.ok(JSON.stringify(result.reasons || result).includes('unbound_v714_verdict:blind_solution'));
});

test('V714 fails closed when an expected verifier result is missing', async () => {
  const s = makeScenario();
  s.adapters.blind_solution = async () => null;
  const result = await s.run();
  assert.equal(result.state, 'quarantined');
  assert.ok(JSON.stringify(result.reasons || result).includes('unmatched_verdict:blind_solution'));
});
