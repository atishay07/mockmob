// Create-only, offline sizing diagnostic for V715. Captures adapter output metadata only;
// synthetic model responses are discarded and are never academic evidence.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFactoryEvidenceV715, blindViewV715, TOPOLOGIES, V715_PROMPT_HASH } from '../lib/factoryEvidenceV715.mjs';
import { validationContractV715 } from '../lib/contractV715.mjs';
import { costProfileV713 } from '../lib/costProfileV713.mjs';
import { evalSchemaV7 } from '../lib/factoryEvidenceV73.mjs';

const args = process.argv.slice(2);
if (args.length !== 1) throw Error('usage: node v715BodySizeDiagnostic.mjs <prepared-study-directory>');
const directory = resolve(args[0]), read = path => JSON.parse(readFileSync(path, 'utf8'));
const frozenPath = resolve(directory, 'frozen.json'), registryPath = resolve(directory, 'registry.json');
const output = resolve(directory, 'v715-body-size-diagnostic.json');
if (![frozenPath, registryPath].every(existsSync)) throw Error('prepared_frozen_study_required');
if (existsSync(output)) throw Error('v715_size_diagnostic_exists_refusing_overwrite');
const frozen = read(frozenPath), registry = read(registryPath), prices = read('data/pipeline-prices.json');
if (frozen.denominator !== 37 || frozen.fixtures?.length !== 37) throw Error('expected_registered_37_case_denominator');
const sha = text => createHash('sha256').update(text).digest('hex');
const textOf = (provider, body) => provider === 'openai'
  ? body.input?.find(row => row.role === 'user')?.content
  : body.contents?.find(row => row.role === 'user')?.parts?.[0]?.text;
const schemaOf = body => body?.text?.format?.schema || body?.generationConfig?.responseFormat?.text?.schema || null;
const syntheticValue = schema => {
  if (Array.isArray(schema?.enum)) return schema.enum[0];
  if (schema?.const !== undefined) return schema.const;
  if (schema?.type === 'object') {
    const value = {};
    for (const key of schema.required || []) value[key] = syntheticValue(schema.properties?.[key] || {});
    return value;
  }
  if (schema?.type === 'array') return Array.from({ length: schema.minItems || 0 }, () => syntheticValue(schema.items || {}));
  if (schema?.type === 'boolean') return false;
  if (schema?.type === 'integer' || schema?.type === 'number') return schema.minimum || 0;
  if (schema?.type === 'string') return 'Synthetic sizing-only response; not an academic judgment.';
  if (schema?.anyOf?.length) return syntheticValue(schema.anyOf[0]);
  if (schema?.oneOf?.length) return syntheticValue(schema.oneOf[0]);
  return null;
};
function syntheticEvaluation(provider, body) {
  const input = JSON.parse(textOf(provider, body) || '{}'), schema = schemaOf(body);
  if (!input.candidate_id || !input.content_hash || !schema?.properties) throw Error('synthetic_size_response_identity_or_schema_missing');
  const value = syntheticValue(schema);
  value.candidate_id = input.candidate_id;
  value.content_hash = input.content_hash;
  if (schema.properties.solved_key) value.solved_key = schema.properties.solved_key.enum?.[0] || 'A';
  if (Array.isArray(schema.properties.option_resolution?.items?.required)) value.option_resolution = ['A', 'B', 'C', 'D'].map(option => ({
    option, status: 'unresolved', false_part: '', premise_source: 'none', evidence_id: '', premise_quote: '',
    reason: 'Synthetic sizing-only resolution; not an academic judgment.' }));
  return value;
}
const captured = [];
let activeCandidate = null, attempt = 0;
const cache = new Map(), ledger = { getCache: key => cache.get(key) ?? null,
  setCache: (key, value) => cache.set(key, structuredClone(value)) };
const transport = { async generate(provider, body, options = {}) {
  const variant = attempt++ === 0 ? 'base' : 'completion_retry';
  captured.push({ candidate_id: activeCandidate, stage: options.stage, provider, body: structuredClone(body), key: options.key, variant });
  if (variant === 'base') return { output_text: '{' };
  return { output_text: JSON.stringify(syntheticEvaluation(provider, body)) };
} };
const adapters = createFactoryEvidenceV715({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
const syntheticRows = view => view.options.map(option => ({ option: option.key, status: 'contradicted', false_part: String(option.text).slice(0, 80),
  premise_source: view.evidence_catalog?.length ? 'excerpt' : 'stem', evidence_id: view.evidence_catalog?.[0]?.id || '',
  premise_quote: String(view.body || view.passage || '').slice(0, 120), reason: 'Synthetic sizing-only row; not an academic judgment.' }));
async function capture(fixtureId, stage, invoke) {
  const start = captured.length; activeCandidate = fixtureId; attempt = 0;
  try { await invoke(); } catch { /* This diagnostic intentionally does not evaluate academic output. */ }
  if (captured.length !== start + 2) throw Error(`expected_base_and_retry_capture:${fixtureId}:${stage}:${captured.length - start}`);
  const pair = captured.slice(start);
  if (!pair[0].key || !pair[1].key || pair[0].key === pair[1].key) throw Error(`retry_key_not_distinct:${fixtureId}:${stage}`);
  return pair;
}
const bound = costProfileV713(prices).input_byte_bounds;
const requests = [];
for (const fixture of frozen.fixtures) {
  const candidate = fixture.candidate, view = blindViewV715(candidate, candidate.source_refs || []), rows = syntheticRows(view);
  for (const [stage, provider] of [['blind_solution', 'openai'], ['independent_evaluation', 'gemini']]) {
    if (adapters.__freezeResolution(stage, view, { candidate_id: view.candidate_id, content_hash: view.content_hash,
      solved_key: 'A', provider, option_resolution: { passed: true }, option_resolution_rows: rows }) !== true)
      throw Error(`synthetic_resolution_capture_setup_failed:${fixture.id}:${stage}`);
  }
  for (const [stage, invoke] of [
    ['blind_solution', () => adapters.blind_solution(view)],
    ['independent_evaluation', () => adapters.independent_evaluation(view)],
    ['explanation_support', () => adapters.explanation_support({ ...view, proposed_explanation: candidate.explanation || '' })],
  ]) {
    const pair = await capture(fixture.id, stage, invoke);
    for (const [index, record] of pair.entries()) {
      const provider = stage === 'independent_evaluation' ? 'gemini' : 'openai';
      const serialized = JSON.stringify(record.body), bytes = Buffer.byteLength(serialized, 'utf8');
      requests.push({ fixture_id: fixture.id, stage, provider, variant: index ? 'completion_retry' : 'base',
        request_bytes: bytes, input_bound_bytes: bound[provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-6-luna'],
        body_sha256: sha(serialized), output_cap: provider === 'openai' ? record.body.max_output_tokens : record.body.generationConfig?.maxOutputTokens,
        request_key_sha256: sha(record.key), request_key_distinct_from_pair: pair[0].key !== pair[1].key });
    }
  }
}
const maximum = Math.max(...requests.map(row => row.request_bytes));
const overBound = requests.filter(row => row.request_bytes > row.input_bound_bytes);
if (requests.length !== 222 || overBound.length) throw Error(`v715_body_size_diagnostic_failed:${JSON.stringify({ captures: requests.length, overBound: overBound.length })}`);
const report = { schema: 'cuet-v715-offline-body-size-diagnostic-v1', created_at: new Date().toISOString(),
  contract_hash: validationContractV715(), prompt_hash: V715_PROMPT_HASH, fixture_count: frozen.fixtures.length,
  request_count: requests.length, maximum_request_bytes: maximum, requests, paid_calls: 0, synthetic_responses: true,
  academic_evidence: false, release: false };
mkdirSync(directory, { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ diagnostic: output, fixture_count: 37, request_count: 222, maximum_request_bytes: maximum,
  over_bound: overBound.length, paid_calls: 0, academic_evidence: false, release: false }));
