// Offline full-body sizing for the registered V713 fresh qualification. It authors no cases and cannot contact a provider.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFactoryEvidenceV713, blindViewV713, TOPOLOGIES, V713_PROMPT_HASH } from '../lib/factoryEvidenceV713.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { costProfileV713 } from '../lib/costProfileV713.mjs';
import { assertFullBodyPreflightV713 } from '../lib/preflightV713.mjs';
import { bodyCandidateId } from '../lib/scopedAccounting.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--capture-offline') throw Error('offline_capture_requires_directory_and_only_--capture-offline');
const directory = resolve(args[1]), read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const regPath = resolve(directory, 'registration.json'), frozenPath = resolve(directory, 'frozen.json');
const registryPath = resolve(directory, 'registry.json'), output = resolve(directory, 'full-body-preflight.json');
if (![regPath, frozenPath, registryPath].every(existsSync)) throw Error('prepared_frozen_qualification_required');
if (existsSync(output)) throw Error('full_body_preflight_exists_refusing_overwrite');
const registration = read(regPath), frozen = read(frozenPath), registry = read(registryPath), prices = read('data/pipeline-prices.json');
const runnerPath = resolve('scripts/pipeline/tools/runQualificationV713.mjs'), enginePath = resolve('scripts/pipeline/lib/verifyV713.mjs');
const campaign = { id: 'cuet-v713-fresh-final-qualification', jobs: frozen.fixtures.map(f => ({ id: f.id, subject: f.subject })) };
if (registration.qualification !== true || registration.contract_hash !== validationContractV713() ||
    registration.prompt_hash !== V713_PROMPT_HASH || registration.campaign_sha256 !== createHash('sha256').update(JSON.stringify(campaign)).digest('hex') ||
    registration.registry_sha256 !== sha(registryPath) || registration.runner_sha256 !== sha(runnerPath) ||
    registration.engine_sha256 !== sha(enginePath) || registration.cost_profile?.pricing_hash !== costProfileV713(prices).pricing_hash ||
    frozen.denominator !== 36 || frozen.publication !== 'never' || frozen.fixtures.length !== 36) throw Error('registered_qualification_inputs_changed_before_preflight');

class Captured extends Error { constructor() { super('offline_body_captured'); } }
const captured = [];
let activeCandidate = null, attempts = 0;
const cache = new Map(), ledger = { getCache: key => cache.get(key) ?? null,
  setCache: (key, value) => cache.set(key, structuredClone(value)) };
const userInput = (provider, body) => provider === 'openai'
  ? body.input?.find(row => row.role === 'user')?.content
  : body.contents?.find(row => row.role === 'user')?.parts?.[0]?.text;
const responseSchema = body => body?.text?.format?.schema || body?.generationConfig?.responseFormat?.text?.schema || null;
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
  if (schema?.type === 'string') return 'Synthetic sizing-only result; not an academic judgment.';
  if (schema?.anyOf?.length) return syntheticValue(schema.anyOf[0]);
  if (schema?.oneOf?.length) return syntheticValue(schema.oneOf[0]);
  return null;
};
function syntheticEvaluation(provider, body) {
  const input = JSON.parse(userInput(provider, body) || '{}'), schema = responseSchema(body);
  if (!input.candidate_id || !input.content_hash || !schema?.properties) throw new Error('qualification_preflight_synthetic_schema_or_identity_missing');
  const value = syntheticValue(schema);
  value.candidate_id = input.candidate_id;
  value.content_hash = input.content_hash;
  if (schema.properties.solved_key) value.solved_key = schema.properties.solved_key.enum?.[0] || 'A';
  if (Array.isArray(schema.properties.option_resolution?.items?.required)) {
    value.option_resolution = ['A', 'B', 'C', 'D'].map(option => ({ option, status: 'unresolved', false_part: '',
      premise_source: 'none', evidence_id: '', premise_quote: '', reason: 'Synthetic sizing-only resolution; not an academic judgment.' }));
  }
  return value;
}
const transport = { async generate(provider, body, options = {}) {
  const variant = attempts++ === 0 ? 'base' : 'completion_retry';
  captured.push({ candidate_id: activeCandidate, stage: options.stage, provider, body: structuredClone(body), key: options.key, variant });
  if (variant === 'base') return { output_text: '{' };
  // The valid synthetic retry warms only this process-local evaluation cache. It is discarded and never exported as academic evidence.
  return { output_text: JSON.stringify(syntheticEvaluation(provider, body)) };
} };
const adapters = createFactoryEvidenceV713({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
const syntheticRows = (view, key) => view.options.map(option => ({ option: option.key,
  status: option.key === key ? 'supported' : 'contradicted', false_part: option.key === key ? '' : String(option.text).slice(0, 80),
  premise_source: view.evidence_catalog?.length ? 'excerpt' : 'stem', evidence_id: view.evidence_catalog?.[0]?.id || '',
  premise_quote: String(view.body || view.passage || '').slice(0, 120), reason: 'Synthetic sizing-only resolution; not an academic judgment.' }));
async function capture(candidateId, stage, invoke) {
  const start = captured.length; activeCandidate = candidateId; attempts = 0;
  try { await invoke(); } catch (error) { if (!(error instanceof Captured)) throw error; }
  if (captured.length !== start + 2) throw Error(`qualification_preflight_expected_actual_retry:${candidateId}:${stage}:${captured.length - start}`);
  const pair = captured.slice(start);
  if (!pair[0].key || !pair[1].key || pair[0].key === pair[1].key) throw Error(`qualification_preflight_retry_key_not_distinct:${candidateId}:${stage}`);
  return pair;
}
const bounds = costProfileV713(prices).input_byte_bounds, requests = [];
for (const fixture of frozen.fixtures) {
  const candidate = fixture.candidate, view = blindViewV713(candidate, candidate.source_refs || []);
  for (const [stage, provider] of [['blind_solution', 'openai'], ['independent_evaluation', 'gemini']]) {
    const rows = syntheticRows(view, candidate.correct_answer);
    if (adapters.__freezeResolution(stage, view, { candidate_id: view.candidate_id, content_hash: view.content_hash,
      solved_key: candidate.correct_answer, provider, option_resolution: { passed: true }, option_resolution_rows: rows }) !== true)
      throw Error(`qualification_preflight_synthetic_freeze_failed:${fixture.id}:${stage}`);
  }
  for (const [stage, invoke] of [
    ['blind_solution', () => adapters.blind_solution(view)],
    ['independent_evaluation', () => adapters.independent_evaluation(view)],
    ['explanation_support', () => adapters.explanation_support({ ...view, proposed_explanation: candidate.explanation || '' })],
  ]) {
    const pair = await capture(fixture.id, stage, invoke);
    for (const [index, record] of pair.entries()) {
      const provider = stage === 'independent_evaluation' ? 'gemini' : 'openai';
      if (record.provider !== provider || record.stage !== stage || bodyCandidateId(provider, record.body) !== fixture.id)
        throw Error(`qualification_preflight_wrong_identity_provider_or_stage:${fixture.id}:${stage}`);
      const serialized = JSON.stringify(record.body), cap = provider === 'openai'
        ? record.body.max_output_tokens : record.body.generationConfig?.maxOutputTokens;
      requests.push({ candidate_id: fixture.id, stage, provider, variant: index === 0 ? 'base' : 'completion_retry',
        request_bytes: Buffer.byteLength(serialized, 'utf8'), input_bound_bytes: bounds[provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-6-luna'],
        body_sha256: createHash('sha256').update(serialized).digest('hex'), body: record.body, request_key: record.key,
        output_cap: cap, retry_output_doubled: index === 1, item_source: 'frozen_fresh_fixture' });
    }
  }
}
const bindings = { contract_hash: registration.contract_hash, prompt_hash: registration.prompt_hash,
  campaign_sha256: registration.campaign_sha256, registry_sha256: registration.registry_sha256,
  runner_sha256: registration.runner_sha256, engine_sha256: registration.engine_sha256, pricing_hash: registration.cost_profile.pricing_hash };
const maximum = Math.max(...requests.map(row => row.request_bytes));
const overBound = requests.filter(row => row.request_bytes > row.input_bound_bytes);
if (requests.length !== 216 || overBound.length) throw Error(`qualification_preflight_failed:${JSON.stringify({ rows: requests.length, overBound: overBound.slice(0, 12) })}`);
const preflight = { ...bindings, coverage: 'all-five-stages-and-retries', captured_at: new Date().toISOString(), candidate_count: 36,
  synthetic_audit_matrices: true, requests, maximum_request_bytes: maximum, input_limit_bytes: bounds,
  paid_calls: 0, academic_evidence: false, passed: true };
assertFullBodyPreflightV713(preflight, registration, campaign);
writeFileSync(output, JSON.stringify(preflight, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ preflight: output, candidates: 36, captures: requests.length, maximum_request_bytes: maximum,
  input_limit_bytes: bounds, paid_calls: 0, academic_evidence: false, synthetic_retry_cache_warmup: true }, null, 2));
