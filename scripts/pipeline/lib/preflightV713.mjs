import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const STAGES = ['authoring', 'blind_solution', 'independent_evaluation', 'explanation_support', 'repair'];
export function assertFullBodyPreflightV713(preflight, registration, campaign) {
  const bindings = ['contract_hash', 'prompt_hash', 'campaign_sha256', 'registry_sha256', 'runner_sha256', 'engine_sha256'];
  if (preflight?.passed !== true || preflight.coverage !== 'all-five-stages-and-retries' ||
      bindings.some(key => !registration[key] || preflight[key] !== registration[key]) ||
      preflight.pricing_hash !== registration.cost_profile?.pricing_hash) throw Error('v713_preflight_binding_mismatch');
  const stages = registration.qualification === true ? STAGES.filter(s => !['authoring', 'repair'].includes(s)) : STAGES;
  const expected = new Set(campaign.jobs.flatMap(job => stages.flatMap(stage =>
    ['base', 'completion_retry'].map(variant => `${job.id}:${stage}:${variant}`))));
  if (!Array.isArray(preflight.requests) || preflight.requests.length !== expected.size) throw Error('v713_preflight_incomplete');
  const pairs = new Map();
  for (const row of preflight.requests) {
    const identity = `${row.candidate_id}:${row.stage}:${row.variant}`;
    const provider = row.stage === 'independent_evaluation' ? 'gemini' : 'openai';
    const bound = registration.cost_profile.input_byte_bounds[provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-6-luna'];
    if (!expected.delete(identity) || row.provider !== provider || !/^[a-f0-9]{64}$/.test(row.body_sha256 || '') ||
        !row.request_key || !Number.isSafeInteger(row.output_cap) || row.output_cap <= 0 ||
        row.input_bound_bytes !== bound || !Number.isSafeInteger(row.request_bytes) || row.request_bytes <= 0 || row.request_bytes > bound) {
      throw Error('v713_preflight_request_invalid');
    }
    if (!row.body || Array.isArray(row.body) || typeof row.body !== 'object') throw Error('v713_preflight_body_missing');
    const serialized = JSON.stringify(row.body), cap = provider === 'openai' ? row.body.max_output_tokens : row.body.generationConfig?.maxOutputTokens;
    if (Buffer.byteLength(serialized, 'utf8') !== row.request_bytes || createHash('sha256').update(serialized).digest('hex') !== row.body_sha256 ||
        cap !== row.output_cap) throw Error('v713_preflight_body_changed');
    const pairKey = `${row.candidate_id}:${row.stage}`, pair = pairs.get(pairKey) || {};
    pair[row.variant] = row; pairs.set(pairKey, pair);
  }
  if (expected.size) throw Error('v713_preflight_incomplete');
  for (const pair of pairs.values()) if (pair.base.request_key === pair.completion_retry.request_key ||
      pair.completion_retry.output_cap !== pair.base.output_cap * 2) throw Error('v713_preflight_retry_not_independent_bounded');
  return true;
}
export function assertSealedPreflightV713(directory, registrationSha, preflightPath, readJSON = p => JSON.parse(readFileSync(p, 'utf8'))) {
  const seal = readJSON(directory + '/execution-preflight-seal.json');
  const digest = p => createHash('sha256').update(readFileSync(p)).digest('hex');
  if (seal.schema !== 'cuet-v713-execution-preflight-seal-v1' || seal.registration_sha256 !== registrationSha ||
      seal.preflight_sha256 !== digest(preflightPath)) throw Error('v713_preflight_seal_changed');
  return true;
}
