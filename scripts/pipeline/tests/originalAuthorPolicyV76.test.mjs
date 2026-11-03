import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINAL_AUTHOR_POLICY_V76, OriginalAuthorAbstentionV74, PreparationValueBlockedV76,
  authorOriginalV76, createOriginalAuthorPolicyTransportV76 } from '../lib/originalAuthorPolicyV76.mjs';
import { ORIGINAL_AUTHOR_POLICY_V74 } from '../lib/originalAuthorPolicyV74.mjs';
const job = { id: 'offline-author-v76', subject: 'economics', chapter: 'Money & Banking' };
const request = () => ({ text: { format: { schema: { type: 'object', additionalProperties: false, required: ['body'], properties: { body: { type: 'string' } } } } },
  input: [{ role: 'system', content: 'Setter instructions.' }, { role: 'user', content: JSON.stringify({ job_id: job.id, subject: job.subject, chapter: job.chapter,
    references: [{ id: 'source', locator: 'loc', text: 'Exact definition, condition and boundary.' }] }) }] });

test('v76 author retains complete sources, identity, v74 explanation contract and abstention schema', async () => {
  let sent;
  const transport = createOriginalAuthorPolicyTransportV76({ async generate(provider, body, options) {
    sent = { provider, body, options }; return { output_text: JSON.stringify({ abstain: false, abstention_reason: '' }) };
  } }, job);
  const original = request(), snapshot = JSON.stringify(original);
  await transport.generate('openai', original, { stage: 'authoring', key: 'prior' });
  assert.equal(JSON.stringify(original), snapshot);
  const payload = JSON.parse(sent.body.input[1].content), schema = sent.body.text.format.schema;
  assert.deepEqual(payload.references, JSON.parse(original.input[1].content).references);
  assert.equal(payload.authoring_policy.contract, ORIGINAL_AUTHOR_POLICY_V76);
  assert.equal(payload.authoring_policy.parent_contract, ORIGINAL_AUTHOR_POLICY_V74);
  assert.ok(['abstain', 'abstention_reason', 'learning_objective'].every(key => schema.required.includes(key)));
  assert.deepEqual(schema.properties.learning_objective.required, ['syllabus_unit', 'objective', 'target_term', 'why_answer_requires_it']);
  assert.notEqual(sent.options.key, 'prior');
  const system = sent.body.input[0].content;
  for (const pattern of [/Never include page, column, locator/, /source-complete construction/, /fixed asset versus inventory/, /ALL clauses/, /source silence/, /Genuine novelty and campaign allocation are unchanged/, /Easy valid recall/, /Abstain/]) assert.match(system, pattern);
  assert.equal(system.includes('no "This"'), false, 'no inherited v75 blanket connector ban');
  assert.equal(system.includes('Preparation-value contract (v7.5)'), false);
});

test('invalid identity/source requests fail before transport and non-authoring passes through', async () => {
  let calls = 0, bodyReceived, optionsReceived;
  const transport = createOriginalAuthorPolicyTransportV76({ async generate(provider, body, options) { calls++; bodyReceived = body; optionsReceived = options; return 'ok'; } }, job);
  const bad = request(), payload = JSON.parse(bad.input[1].content); payload.job_id = 'another'; bad.input[1].content = JSON.stringify(payload);
  await assert.rejects(() => transport.generate('openai', bad, { stage: 'authoring' }), /identity_mismatch/);
  const sourceMissing = request(), missing = JSON.parse(sourceMissing.input[1].content); missing.references[0].text = ''; sourceMissing.input[1].content = JSON.stringify(missing);
  await assert.rejects(() => transport.generate('openai', sourceMissing, { stage: 'authoring' }), /complete_references_required/);
  assert.equal(calls, 0);
  const untouched = request(), options = { stage: 'validation', key: 'unchanged' };
  await transport.generate('openai', untouched, options);
  assert.equal(bodyReceived, untouched); assert.equal(optionsReceived, options);
});

test('genuine missing objective blocks authorship; cues alone do not; explicit abstention keeps typed provenance', async () => {
  const candidate = { id: job.id, subject: job.subject, chapter: job.chapter, body: 'Which statement expresses the monetary rule?', question_type: 'conceptual_mcq', difficulty: 'hard',
    options: ['A reserve is held.', 'It always records equity.', 'It never records money.', 'Only equity is recorded.'], correct_answer: 'A',
    learning_objective: { syllabus_unit: 'Money and Banking', objective: 'Apply the policy definition.', target_term: '', why_answer_requires_it: 'Requires knowing the rule.' } };
  const response = { async generate() { return { output_text: JSON.stringify({ abstain: false, abstention_reason: '' }) }; } };
  const invoke = c => authorOriginalV76(async (j, { transport }) => { await transport.generate('openai', request(), { stage: 'authoring', key: 'k' }); return c; }, job, { registry: {}, transport: response });
  assert.equal(await invoke(candidate), candidate);
  await assert.rejects(() => invoke({ ...candidate, learning_objective: undefined }), e => e instanceof PreparationValueBlockedV76 && e.reasons.join() === 'learning_objective_missing' && e.candidate_id === job.id);
  await assert.rejects(() => authorOriginalV76(async (j, { transport }) => transport.generate('openai', request(), { stage: 'authoring' }), job,
    { transport: { async generate() { return { output_text: JSON.stringify({ abstain: true, abstention_reason: 'No supported unique item.' }) }; } } }),
  e => e instanceof OriginalAuthorAbstentionV74 && e.code === 'original_author_abstained' && e.candidate_id === job.id);
});
