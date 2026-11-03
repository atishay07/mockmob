import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFactoryEvidenceV77, blindViewV77, TOPOLOGIES, V77_PROMPT_HASH } from '../../../../scripts/pipeline/lib/factoryEvidenceV77.mjs';
import { validationContractV77 } from '../../../../scripts/pipeline/lib/contractV77.mjs';
import { canonicalQuestion } from '../../../../data/content_evidence.js';
import { effortsFor } from '../../../../data/cuet_fit_evidence.mjs';
import { maximumRequestMicro } from '../../../../scripts/pipeline/lib/campaignExecutionV7.mjs';

const root = 'artifacts/question-factory/cuet-readiness-2026-10-09';
const specimen = `${root}/benchmark/v76-qualification-2026-10-09-fresh-bounded-input`;
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const frozen = read(`${specimen}/frozen.json`);
const baseRegistry = read('data/source_registry.json');
const overlay = read(`${specimen}/scratch-registry-overlay.json`);
const prices = read('data/pipeline-prices.json');
const v77ContractHash = validationContractV77();
const maxInputBytes = 50000;
for (const model of ['gpt-6-luna', 'gemini-3.8-flash']) prices.models[model].max_input_tokens = maxInputBytes;
const registry = {
  ...baseRegistry,
  sources: { ...baseRegistry.sources, ...overlay.sources },
  families: { ...baseRegistry.families, ...overlay.families },
  packs: { ...baseRegistry.packs, ...overlay.packs },
};

const captures = [];
let auditMode = false;
let cachedEvalIndex = 0;
let currentCandidateId = null;
const throwAfterCapture = 'v77_offline_capture_complete';
const transport = {
  async generate(provider, body, options = {}) {
    const serialized = JSON.stringify(body);
    const utf8Bytes = Buffer.byteLength(serialized, 'utf8');
    if (utf8Bytes > maxInputBytes) throw new Error(`v77_request_exceeds_local_input_reservation:${options.stage}:${utf8Bytes}:${maxInputBytes}`);
    const schema = body?.text?.format?.schema || body?.generationConfig?.responseFormat?.text?.schema || null;
    const outputCap = provider === 'openai' ? body.max_output_tokens : body.generationConfig?.maxOutputTokens;
    const retry = structuredClone(body);
    if (provider === 'openai') retry.max_output_tokens *= 2;
    else retry.generationConfig.maxOutputTokens *= 2;
    captures.push({
      candidate_id: currentCandidateId,
      provider,
      stage: options.stage,
      utf8_bytes: utf8Bytes,
      schema_utf8_bytes: schema ? Buffer.byteLength(JSON.stringify(schema), 'utf8') : 0,
      schema_overhead_included_in_request_bytes: Boolean(schema),
      output_cap_tokens: outputCap,
      initial_full_request_maximum_micro: maximumRequestMicro(provider, body, prices),
      one_billed_retry_full_request_maximum_micro: maximumRequestMicro(provider, retry, prices),
    });
    throw new Error(throwAfterCapture);
  },
};

const capturedCandidateIds = [];
for (const fixture of frozen.fixtures) {
  const candidate = fixture.candidate;
  currentCandidateId = candidate.id;
  const solvedKey = canonicalQuestion(candidate).key;
  if (!['A', 'B', 'C', 'D'].includes(solvedKey)) throw new Error(`v77_synthetic_key_missing:${candidate.id}`);
  const adapters = createFactoryEvidenceV77({
    registry,
    ledger: {
      getCache: () => {
        if (!auditMode) return null;
        const providers = [TOPOLOGIES.dual_blind.primary, TOPOLOGIES.dual_blind.secondary];
        const provider = providers[cachedEvalIndex++ % providers.length];
        return {
          provider,
          model: provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash',
          solved_key: solvedKey,
          reasons: ['Synthetic offline cache entry used only to reach the V77 audit request builder.'],
          evidence_ids: [],
        };
      },
      setCache: () => { throw new Error('offline_cache_write_forbidden'); },
    },
    transport,
    topology: TOPOLOGIES.dual_blind,
    calibrationPurpose: true,
    efforts: effortsFor(candidate),
  });
  const view = blindViewV77(candidate, candidate.source_refs);
  const context = adapters.__context(view);
  const evidence = context.evidence_catalog?.[0];
  if (!evidence?.id || !evidence.quote) throw new Error(`v77_synthetic_source_specimen_required:${candidate.id}`);
  const syntheticMatrix = view.options.map(option => ({
    option: option.key,
    exact_option_text: option.text,
    clauses: [{
      clause: option.text,
      status: option.key === solvedKey ? 'support' : 'contradiction',
      decisive_context: evidence.quote,
      rationale: 'Synthetic source-bound structure for payload sizing only; no semantic judgment is asserted.',
      basis: 'excerpt',
      contradiction_basis: option.key === solvedKey ? 'none' : 'source_contradiction',
      evidence_ids: [evidence.id],
      premises: [evidence.quote],
    }],
  }));

  for (const stage of ['blind_solution', 'independent_evaluation']) {
    try { await adapters[stage](view); }
    catch (error) { if (error.message !== throwAfterCapture) throw error; }
    const provider = stage === 'blind_solution' ? TOPOLOGIES.dual_blind.primary : TOPOLOGIES.dual_blind.secondary;
    const syntheticResult = {
      candidate_id: view.candidate_id,
      content_hash: view.content_hash,
      provider,
      solved_key: solvedKey,
      option_resolution: { passed: true, reason: null },
      option_resolution_matrix: structuredClone(syntheticMatrix),
    };
    if (!adapters.__freezeResolution(stage, view, syntheticResult)) throw new Error(`v77_synthetic_matrix_freeze_failed:${candidate.id}:${stage}`);
  }

  auditMode = true;
  cachedEvalIndex = 0;
  try { await adapters.explanation_support({ ...view, proposed_explanation: candidate.explanation }); }
  catch (error) { if (error.message !== throwAfterCapture) throw error; }
  auditMode = false;
  capturedCandidateIds.push(candidate.id);
}

const expected = frozen.fixtures.length * 3;
if (captures.length !== expected) throw new Error(`v77_expected_three_stage_captures:${captures.length}:${expected}`);
for (const id of capturedCandidateIds) if (captures.filter(row => row.candidate_id === id).length !== 3) throw new Error(`v77_candidate_stage_capture_count:${id}`);

const stages = [...new Set(captures.map(row => row.stage))];
const byStage = Object.fromEntries(stages.map(stage => {
  const rows = captures.filter(row => row.stage === stage);
  return [stage, {
    calls: rows.length,
    maximum_body_utf8_bytes: Math.max(...rows.map(row => row.utf8_bytes)),
    maximum_schema_utf8_bytes: Math.max(...rows.map(row => row.schema_utf8_bytes)),
    initial_requests_maximum_usd: rows.reduce((sum, row) => sum + row.initial_full_request_maximum_micro, 0) / 1e6,
    one_full_billed_retry_each_maximum_usd: rows.reduce((sum, row) => sum + row.one_billed_retry_full_request_maximum_micro, 0) / 1e6,
    stage_with_retry_maximum_usd: rows.reduce((sum, row) => sum + row.initial_full_request_maximum_micro + row.one_billed_retry_full_request_maximum_micro, 0) / 1e6,
  }];
}));
const initialMicro = captures.reduce((sum, row) => sum + row.initial_full_request_maximum_micro, 0);
const retryMicro = captures.reduce((sum, row) => sum + row.one_billed_retry_full_request_maximum_micro, 0);
const totalMicro = initialMicro + retryMicro;
const out = {
  version: 'v77-offline-budget-preflight-v1',
  at: new Date().toISOString(),
  paid_calls: 0,
  database_mutations: 0,
  specimen: 'Already-consumed V76 bounded-input frozen cases and overlay, used only as local request-size specimens; no fresh source cases or qualification evidence were collected.',
  source_registry: 'Current source_registry.json plus the frozen V76 specimen overlay, used only to construct request payloads.',
  local_input_reservation: { max_utf8_bytes: maxInputBytes, rationale: 'A disclosed local-only allowance above the prior V76 35,000-byte reservation to account for V77 matrix/audit payload growth; this is a preflight constraint, not a provider context-window claim.', rates_changed: false, base_price_file_changed: false, enforcement: 'Hard-fail each serialized full request body above this local reservation before recording it.' },
  synthetic_audit_input: {
    limitation: 'Both frozen V77 option matrices are synthetic structural payloads with source-bound quote strings. They are not model outputs, independent audits, semantic validation, or qualification evidence.',
    output_shape: 'Two four-option matrices, one per solver; each option is represented as a single exact-text clause with a local excerpt ID and quote for payload sizing.',
    other_synthetic_fields: 'The cached blind_solutions fields are minimal placeholders with empty evidence ID lists and short reasons; actual solver reasons, evidence IDs, and multi-clause matrices may enlarge the explanation body.',
    report_limit: 'This request-size specimen is not a completion promise or qualification evidence. A future full request must independently pass the same hard 50,000-byte body guard before dispatch.',
    bytes_measured_in_full_request: true,
    schema_overhead_measured_and_included: true,
  },
  retry_contract: 'For each captured initial request, the existing completeJSON contract permits exactly one billed retry only after provider_output_incomplete or invalid_provider_json with a durable key. Retry sends the same full input and doubles the output cap. Each retry cost below is a second full request reservation, including input/cache-write maximum, reasoning output, and registered output rate. Flex discounts are not assumed.',
  pricing: { expires_at: prices.expires_at, registered_rates_used: true, prices_file_modified: false },
  binding: {
    v77_validation_contract_sha256: v77ContractHash,
    v77_prompt_sha256: V77_PROMPT_HASH,
    price_table_file_sha256: sha256('data/pipeline-prices.json'),
    frozen_v76_specimen_file_sha256: sha256(`${specimen}/frozen.json`),
    overlay_file_sha256: sha256(`${specimen}/scratch-registry-overlay.json`),
  },
  case_count: capturedCandidateIds.length,
  stage_bounds: byStage,
  initial_requests_maximum_usd: initialMicro / 1e6,
  one_full_billed_retry_per_request_maximum_usd: retryMicro / 1e6,
  all_stages_with_one_full_retry_each_maximum_usd: totalMicro / 1e6,
  maximum_request_body_utf8_bytes: Math.max(...captures.map(row => row.utf8_bytes)),
  v76_reference_preserved: { per_case_with_one_full_retry_each_usd: 0.139375, cases: 41, total_usd: 5.714375, note: 'Historical estimate only; this new V77 output does not overwrite or revise V76 estimates.' },
  captures,
};
const outArg = process.argv.indexOf('--out');
const output = outArg >= 0 ? process.argv[outArg + 1] : `${root}/execution/v77-offline-budget-preflight-v1.json`;
writeFileSync(output, JSON.stringify(out, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ ...out, captures: undefined }));
