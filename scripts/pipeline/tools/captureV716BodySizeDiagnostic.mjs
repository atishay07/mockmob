// Offline V716 full-request sizing only. Synthetic responses are discarded; no provider is contacted.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createScorecardReviewV716 } from '../lib/scorecardReviewV716.mjs';

const [directoryArg, outputName = 'v716-body-size-diagnostic.json'] = process.argv.slice(2);
if (!directoryArg) throw Error('usage: node captureV716BodySizeDiagnostic.mjs <qualification-directory>');
if (outputName !== outputName.split(/[\\/]/).at(-1)) throw Error('output_must_be_a_filename_in_the_qualification_directory');
const directory = resolve(directoryArg), read = path => JSON.parse(readFileSync(path, 'utf8'));
const frozenPath = resolve(directory, 'frozen.json'), registryPath = resolve(directory, 'registry.json');
const output = resolve(directory, outputName);
if (![frozenPath, registryPath].every(existsSync)) throw Error('registered_frozen_inputs_required');
if (existsSync(output)) throw Error('diagnostic_exists_refusing_overwrite');
const frozen = read(frozenPath), registry = read(registryPath);
if (frozen.fixtures?.length !== 37 || frozen.denominator !== 37) throw Error('expected_registered_37_case_frozen_set');
const hash = value => createHash('sha256').update(value).digest('hex');
const userText = (provider, body) => provider === 'openai' ? body.input?.find(row => row.role === 'user')?.content : body.contents?.find(row => row.role === 'user')?.parts?.[0]?.text;
const schemaFor = body => body?.text?.format?.schema || body?.generationConfig?.responseFormat?.text?.schema;
const valueFor = schema => {
  if (Array.isArray(schema?.enum)) return schema.enum[0];
  if (schema?.type === 'object') return Object.fromEntries((schema.required || []).map(key => [key, valueFor(schema.properties?.[key] || {})]));
  if (schema?.type === 'array') return Array.from({ length: schema.minItems || 0 }, () => valueFor(schema.items || {}));
  if (schema?.type === 'string') return 'Synthetic sizing-only response.';
  if (schema?.type === 'number' || schema?.type === 'integer' || Array.isArray(schema?.type) && schema.type.includes('number')) return schema.minimum || 8;
  if (schema?.type === 'boolean') return false;
  if (Array.isArray(schema?.type) && schema.type.includes('null')) return null;
  return null;
};
const captures = [], callsPerRequest = new Map(), cache = new Map();
let activeCandidate = null;
const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
const transport = { async generate(provider, body, options = {}) {
  const serialized = JSON.stringify(body), requestId = `${options.candidate_id}:${options.stage}`, count = callsPerRequest.get(requestId) || 0;
  callsPerRequest.set(requestId, count + 1);
  captures.push({ candidate_id: options.candidate_id, provider, stage: options.stage, variant: count ? 'completion_retry' : 'base',
    request_bytes: Buffer.byteLength(serialized, 'utf8'), body_sha256: hash(serialized), body, request_key: options.key });
  if (!count) return { output_text: '{' };
  const input = JSON.parse(userText(provider, body) || '{}'), result = valueFor(schemaFor(body));
  const sourceId = input.evidence_catalog?.[0]?.id;
  result.candidate_id = input.candidate_id; result.content_hash = input.content_hash;
  if (options.stage === 'explanation_support') {
    result.answer_set = [activeCandidate.correct_answer]; result.explanation_status = 'supported'; result.options_status = 'supported';
    result.source_ids = sourceId ? [sourceId] : [];
    result.claims = [{ claim: activeCandidate.explanation, basis: 'excerpt', status: 'supported', source_ids: sourceId ? [sourceId] : [], reason: 'Synthetic sizing-only claim.' }];
    result.issues = [];
    for (const value of Object.values(result.scores || {})) { value.score = 8; value.note = 'Synthetic sizing-only score.'; }
  } else {
    const key = activeCandidate.correct_answer;
    result.solved_key = key; result.answer_set = [key]; result.derivation = 'Synthetic sizing-only solution.'; result.source_ids = sourceId ? [sourceId] : [];
    result.options = ['A', 'B', 'C', 'D'].map(option => ({ option, status: option === key ? 'defensible' : 'not_answer', basis: 'excerpt', source_ids: sourceId ? [sourceId] : [], reason: 'Synthetic sizing-only option note.' }));
    result.academic = Object.fromEntries(Object.keys(result.academic || {}).map(name => [name, 'supported']));
    result.difficulty_assessment = { level: activeCandidate.difficulty, reason: 'Synthetic sizing-only difficulty.', comparison_basis: 'heuristic' };
    result.issues = [];
    for (const value of Object.values(result.scores || {})) { value.score = 8; value.note = 'Synthetic sizing-only score.'; }
  }
  return { output_text: JSON.stringify(result) };
} };
const reviewer = createScorecardReviewV716({ registry, ledger, transport });
for (const fixture of frozen.fixtures) {
  activeCandidate = fixture.candidate;
  await reviewer.review(fixture.candidate, { onBlindFrozen: async () => {} });
}
if (captures.length !== 222) throw Error(`expected_222_stage_and_retry_requests:${captures.length}`);
const max = Math.max(...captures.map(row => row.request_bytes));
const over = captures.filter(row => row.request_bytes > 33024);
const report = { captured_at: new Date().toISOString(), source_frozen_sha256: hash(readFileSync(frozenPath)),
  source_registry_sha256: hash(readFileSync(registryPath)), candidate_count: 37, requests: captures.map(({ body, ...row }) => row),
  maximum_request_bytes: max, input_limit_bytes: 33024, over_limit_count: over.length, over_limit: over.map(({ candidate_id, stage, provider, variant, request_bytes }) => ({ candidate_id, stage, provider, variant, request_bytes })),
  paid_calls: 0, academic_evidence: false, synthetic_retry_cache_warmup: true };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, requests: captures.length, maximum_request_bytes: max, input_limit_bytes: 33024, over_limit_count: over.length,
  paid_calls: 0, academic_evidence: false }, null, 2));
