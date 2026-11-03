import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { authorOriginal } from '../lib/factoryCore.mjs';
import { adaptOriginalAuthorRequestV74, createOriginalAuthorPolicyTransportV74, ORIGINAL_AUTHOR_POLICY_V74, authorOriginalV74, OriginalAuthorAbstentionV74 } from '../lib/originalAuthorPolicyV74.mjs';

const job = Object.freeze({ id: 'original-candidate-014', subject: 'economics', chapter: 'Introduction & Theory of Consumer Behaviour' });
const refs = Object.freeze([
  Object.freeze({ id: 'ncert-economics-1', locator: 'chapter-2.definition.4', kind: 'reference', text: 'Utility is the want-satisfying power of a commodity. Total utility is the sum of marginal utilities.' }),
  Object.freeze({ id: 'ncert-economics-1', locator: 'chapter-2.rule.9', kind: 'reference', text: 'When marginal utility is positive, total utility rises; when marginal utility is zero, total utility is maximum.' }),
]);
const request = () => ({ model: 'gpt-6-luna', store: false, input: [
  { role: 'system', content: 'Existing setter instructions.' },
  { role: 'user', content: JSON.stringify({ job_id: job.id, subject: job.subject, chapter: job.chapter,
    stem_assumptions: ['quantities are measured in identical units'], references: structuredClone(refs),
    syllabus: { scope: 'matched_units', relevant_units: ['Consumer behaviour'] } }) },
] });

test('adapter preserves job identity, every decisive excerpt and request semantics while applying a new cache contract', async () => {
  const original = request(), inputBefore = JSON.parse(original.input[1].content);
  const frozenJob = structuredClone(job);
  let received;
  const response = Object.freeze({ output_text: '{"body":"item"}', request_id: 'offline-response-1' });
  const transport = { async generate(provider, body, options) { received = { provider, body, options }; return response; } };
  const wrapped = createOriginalAuthorPolicyTransportV74(transport, job);
  const result = await wrapped.generate('openai', original, { stage: 'authoring', key: 'legacy-key', candidate_id: job.id, purpose: 'candidate' });
  const adaptedInput = JSON.parse(received.body.input[1].content);
  const authoringPolicy = adaptedInput.authoring_policy;
  delete adaptedInput.authoring_policy;
  assert.equal(received.provider, 'openai');
  assert.equal(adaptedInput.job_id, job.id);
  assert.equal(adaptedInput.subject, job.subject);
  assert.equal(adaptedInput.chapter, job.chapter);
  assert.deepEqual(adaptedInput, inputBefore);
  assert.deepEqual(adaptedInput.references, refs);
  assert.equal(authoringPolicy.contract, ORIGINAL_AUTHOR_POLICY_V74);
  assert.equal(authoringPolicy.reference_count, refs.length);
  assert.equal('instructions' in authoringPolicy, false);
  assert.match(received.body.input[0].content, /Never include page, column, locator/);
  assert.equal(received.options.candidate_id, job.id);
  assert.notEqual(received.options.key, 'legacy-key');
  assert.equal(received.options.key, hashJSON({ contract: ORIGINAL_AUTHOR_POLICY_V74, previous_key: 'legacy-key',
    job_id: job.id, subject: job.subject, chapter: job.chapter, body: received.body }));
  assert.equal(result, response);
  assert.deepEqual(job, frozenJob);
  assert.equal(original.input[0].content, 'Existing setter instructions.');
  assert.equal(original.input[1].content, JSON.stringify(inputBefore));
});

test('cache key separates v7.4 authoring requests while non-authoring requests pass through unchanged', async () => {
  const calls = [];
  const transport = { async generate(provider, body, options) { calls.push({ provider, body, options }); return 'unchanged'; } };
  const wrapped = createOriginalAuthorPolicyTransportV74(transport, job);
  const first = request(), second = request();
  const options = { stage: 'authoring', key: 'same-old-key', candidate_id: job.id };
  await wrapped.generate('openai', first, options);
  const changed = JSON.parse(second.input[1].content); changed.references[0].text += ' Additional decisive boundary.'; second.input[1].content = JSON.stringify(changed);
  await wrapped.generate('openai', second, options);
  assert.notEqual(calls[0].options.key, calls[1].options.key);
  const nonAuthoring = request();
  await wrapped.generate('openai', nonAuthoring, { stage: 'validation', key: 'validation-key' });
  assert.equal(calls[2].body, nonAuthoring);
  assert.deepEqual(calls[2].options, { stage: 'validation', key: 'validation-key' });
});

test('adapter refuses identity drift or incomplete source excerpts before transport dispatch', async () => {
  const body = request();
  const mismatch = structuredClone(job); mismatch.id = 'other-job';
  assert.throws(() => adaptOriginalAuthorRequestV74(body, mismatch), /identity_mismatch/);
  const noText = request(); const input = JSON.parse(noText.input[1].content); input.references[1].text = '  ';
  noText.input[1].content = JSON.stringify(input);
  let calls = 0;
  const wrapped = createOriginalAuthorPolicyTransportV74({ async generate() { calls++; } }, job);
  await assert.rejects(() => wrapped.generate('openai', noText, { stage: 'authoring', key: 'k' }), /complete_references_required/);
  assert.equal(calls, 0);
});

test('adapter returns model output verbatim without post-generation explanation cleanup', async () => {
  const candidate = Object.freeze({ id: job.id, explanation: 'The supplied rule applies (source page 4).', correct_answer: 'B' });
  const wrapped = createOriginalAuthorPolicyTransportV74({ async generate() { return candidate; } }, job);
  const result = await wrapped.generate('openai', request(), { stage: 'authoring', key: 'key' });
  assert.equal(result, candidate);
  assert.equal(result.explanation, candidate.explanation);
});

test('actual authorOriginal-shaped request supports explicit source abstention before any validator path', async () => {
  const excerpt = 'Utility is the want-satisfying power of a commodity. Total utility is the sum of marginal utilities.';
  const reference = { id: 'source-v74', version: 2, locator: 'consumer-utility.definition', support_hash: hashJSON(excerpt) };
  const localJob = { id: 'original-v74-abstain', kind: 'original_practice', subject: 'economics',
    chapter: 'Introduction & Theory of Consumer Behaviour', topic: 'marginal utility', format: 'conceptual_mcq', difficulty: 'medium',
    requested_answer_position: 'B', avoidance: [], family_id: 'fam-v74', source_pack_id: 'pack-v74', source_pack_version: 2,
    source_refs: [reference], passage_text: '' };
  const registry = { exam_specs: { economics: { state: 'verified', syllabus_version: '2026', pattern_version: 'v1',
      included_topics: ['Unit I: Consumer Behaviour and Demand'], excluded_topics: [] } },
    sources: { 'source-v74': { state: 'active', reuse_permitted: true, extraction_checked: true, identity_sha256: 'a'.repeat(64),
      kind: 'reference', version: 2, facts: { [reference.locator]: { text: excerpt } }, supports: { [reference.locator]: reference.support_hash },
      url: 'https://ncert.nic.in/economics.pdf', title: 'Economics' } } };
  const abstention = { body: '', options: ['', '', '', ''], correct_answer: 'A', explanation: '', difficulty: 'medium', route: 'conceptual',
    passage_text: '', question_type: 'conceptual_mcq', concept_id: 'utility', evidence_quotes: [excerpt], stated_assumptions: [],
    option_analysis: ['', '', '', ''], abstain: true, abstention_reason: 'The references do not support a unique distractor set.' };
  let requestBody, downstreamValidatorCalls = 0;
  const providerResponse = { output_text: JSON.stringify(abstention), request_id: 'offline-abstention' };
  const transport = { async generate(provider, body, options) { requestBody = body; assert.equal(options.stage, 'authoring'); return providerResponse; } };
  try {
    const candidate = await authorOriginalV74(authorOriginal, localJob, { registry, transport });
    downstreamValidatorCalls++;
    assert.fail(`abstention unexpectedly returned a candidate ${candidate?.id}`);
  } catch (error) {
    assert.ok(error instanceof OriginalAuthorAbstentionV74);
    assert.equal(error.candidate_id, localJob.id);
    assert.deepEqual(error.candidate, abstention);
    assert.equal(error.provider_response, providerResponse);
  }
  assert.equal(downstreamValidatorCalls, 0);
  const schema = requestBody.text.format.schema;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.abstain, { type: 'boolean' });
  assert.deepEqual(schema.properties.abstention_reason, { type: 'string' });
  assert.equal(schema.required.includes('abstain'), true);
  assert.equal(schema.required.includes('abstention_reason'), true);
  const packed = JSON.parse(requestBody.input[1].content);
  assert.equal(packed.references[0].text, excerpt);
  assert.deepEqual(packed.authoring_policy, { contract: ORIGINAL_AUTHOR_POLICY_V74, reference_count: 1, source_text_complete: true });
});
