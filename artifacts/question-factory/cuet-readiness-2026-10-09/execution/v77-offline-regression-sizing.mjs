import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFactoryEvidenceV77, blindViewV77, TOPOLOGIES, V77_PROMPT_HASH } from '../../../../scripts/pipeline/lib/factoryEvidenceV77.mjs';
import { validationContractV77 } from '../../../../scripts/pipeline/lib/contractV77.mjs';
import { canonicalQuestion } from '../../../../data/content_evidence.js';
import { effortsFor } from '../../../../data/cuet_fit_evidence.mjs';
import { maximumRequestMicro } from '../../../../scripts/pipeline/lib/campaignExecutionV7.mjs';

const root = 'artifacts/question-factory/cuet-readiness-2026-10-09';
const specimen = `${root}/benchmark/v76-qualification-2026-10-09-regression-bounded-input`;
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const frozenPath = `${specimen}/frozen.json`;
const overlayPath = `${specimen}/scratch-registry-overlay.json`;
const savedPath = `${specimen}/run/results.json`;
const frozen = read(frozenPath);
const overlay = read(overlayPath);
const saved = read(savedPath);
const baseRegistry = read('data/source_registry.json');
const prices = read('data/pipeline-prices.json');
const v77ContractHash = validationContractV77();
const inputReservationBytes = 50000;
for (const model of ['gpt-6-luna', 'gemini-3.8-flash']) prices.models[model].max_input_tokens = inputReservationBytes;
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
const stopAfterCapture = 'v77_regression_capture_complete';
const transport = {
  async generate(provider, originalBody, options = {}) {
    // This mirrors createFactoryTransport's native Flex request decoration.
    const body = provider === 'openai' && !originalBody.service_tier
      ? { ...originalBody, service_tier: 'flex' } : originalBody;
    const serialized = JSON.stringify(body);
    const schema = body?.text?.format?.schema || body?.generationConfig?.responseFormat?.text?.schema || null;
    const outputCap = provider === 'openai' ? body.max_output_tokens : body.generationConfig?.maxOutputTokens;
    const retry = structuredClone(body);
    if (provider === 'openai') retry.max_output_tokens *= 2;
    else retry.generationConfig.maxOutputTokens *= 2;
    captures.push({
      candidate_id: currentCandidateId,
      provider,
      stage: options.stage,
      service_tier: body.service_tier || null,
      utf8_bytes: Buffer.byteLength(serialized, 'utf8'),
      schema_utf8_bytes: schema ? Buffer.byteLength(JSON.stringify(schema), 'utf8') : 0,
      body_sha256: sha256(serialized),
      output_cap_tokens: outputCap,
      initial_full_request_maximum_micro: maximumRequestMicro(provider, body, prices),
      one_billed_retry_full_request_maximum_micro: maximumRequestMicro(provider, retry, prices),
    });
    throw new Error(stopAfterCapture);
  },
};

const ids = [];
for (const fixture of frozen.fixtures) {
  const candidate = fixture.candidate;
  const candidateId = candidate.id;
  currentCandidateId = candidateId;
  const solvedKey = canonicalQuestion(candidate).key;
  if (!['A', 'B', 'C', 'D'].includes(solvedKey)) throw new Error(`v77_sizing_key_missing:${candidateId}`);
  const savedJudgments = saved.evaluations?.[candidateId];
  if (!savedJudgments?.openai || !savedJudgments?.gemini) throw new Error(`v76_saved_judgments_missing:${candidateId}`);
  const adapters = createFactoryEvidenceV77({
    registry,
    ledger: {
      getCache: () => {
        if (!auditMode) return null;
        const provider = [TOPOLOGIES.dual_blind.primary, TOPOLOGIES.dual_blind.secondary][cachedEvalIndex++ % 2];
        const judgment = savedJudgments[provider];
        // Saved V76 judgments are used as payload-size material, never as new truth claims.
        return { ...structuredClone(judgment), provider, model: provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash' };
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
  if (!evidence?.id || !evidence.quote) throw new Error(`v77_synthetic_source_specimen_required:${candidateId}`);
  const matrix = view.options.map(option => ({
    option: option.key,
    exact_option_text: option.text,
    clauses: [{
      clause: option.text,
      status: 'unresolved',
      decisive_context: evidence.quote,
      rationale: 'Synthetic one-clause structural row for request sizing only; no semantic status is asserted.',
      basis: 'excerpt',
      contradiction_basis: 'none',
      evidence_ids: [evidence.id],
      premises: [evidence.quote],
    }],
  }));

  for (const stage of ['blind_solution', 'independent_evaluation']) {
    try { await adapters[stage](view); }
    catch (error) { if (error.message !== stopAfterCapture) throw error; }
    const provider = stage === 'blind_solution' ? TOPOLOGIES.dual_blind.primary : TOPOLOGIES.dual_blind.secondary;
    const judgment = savedJudgments[provider];
    if (!adapters.__freezeResolution(stage, view, {
      candidate_id: view.candidate_id,
      content_hash: view.content_hash,
      provider,
      solved_key: judgment.solved_key,
      option_resolution: { passed: true, reason: null },
      option_resolution_matrix: structuredClone(matrix),
    })) throw new Error(`v77_synthetic_matrix_freeze_failed:${candidateId}:${stage}`);
  }

  auditMode = true;
  cachedEvalIndex = 0;
  try { await adapters.explanation_support({ ...view, proposed_explanation: candidate.explanation }); }
  catch (error) { if (error.message !== stopAfterCapture) throw error; }
  auditMode = false;
  ids.push(candidateId);
}

if (ids.length !== 13 || captures.length !== ids.length * 3) throw new Error(`v77_regression_capture_count:${ids.length}:${captures.length}`);
for (const id of ids) if (captures.filter(row => row.candidate_id === id).length !== 3) throw new Error(`v77_regression_stage_count:${id}`);

const stages = ['blind_solution', 'independent_evaluation', 'explanation_support'];
const stageBounds = Object.fromEntries(stages.map(stage => {
  const rows = captures.filter(row => row.stage === stage);
  return [stage, {
    request_count: rows.length,
    max_body_utf8_bytes: Math.max(...rows.map(row => row.utf8_bytes)),
    max_schema_utf8_bytes: Math.max(...rows.map(row => row.schema_utf8_bytes)),
    exceeds_50000_bytes: rows.some(row => row.utf8_bytes > inputReservationBytes),
    initial_full_request_bound_usd: rows.reduce((n, row) => n + row.initial_full_request_maximum_micro, 0) / 1e6,
    one_full_retry_each_bound_usd: rows.reduce((n, row) => n + row.one_billed_retry_full_request_maximum_micro, 0) / 1e6,
  }];
}));
const initial13 = captures.reduce((n, row) => n + row.initial_full_request_maximum_micro, 0);
const retry13 = captures.reduce((n, row) => n + row.one_billed_retry_full_request_maximum_micro, 0);
const prior28 = read(`${root}/execution/v77-offline-budget-preflight-v1.json`);
const initial41 = initial13 + Math.round(prior28.initial_requests_maximum_usd * 1e6);
const retry41 = retry13 + Math.round(prior28.one_full_billed_retry_per_request_maximum_usd * 1e6);
const allBytes = Math.max(...captures.map(row => row.utf8_bytes));
const output = {
  version: 'v77-offline-regression-sizing-v1',
  at: new Date().toISOString(),
  paid_calls: 0,
  database_mutations: 0,
  cases: ids.length,
  source_scope: 'The 13 already-inspected V76 regression-bounded-input fixtures only. Their saved V76 judgments are reused as request-size payload material; no fresh source cases or truth claims are made.',
  request_contract: 'Captured from the current V77 adapters. OpenAI requests include the native service_tier:flex field added by factoryTransport at dispatch. No request was sent.',
  saved_judgment_disclosure: 'Saved V76 openai/gemini judgments from run/results.json supply the explanation request blind_solutions with their original reasons/evidence IDs and content. They are historical size specimens, not new validation.',
  synthetic_matrix_disclosure: 'V76 has no V77 option matrices. Each provider matrix here has all four exact printed options as one clause each with unresolved status, one source excerpt ID/quote, and an explicit sizing-only rationale. These rows make no truth claims and are not semantic validation.',
  reservation: { input_bytes_for_cost_bound: inputReservationBytes, source: 'local conservative reservation override only; registered input/output rates unchanged', body_guard_result: allBytes > inputReservationBytes ? 'one_or_more_captured_bodies_exceed_50000_and_would_fail_the_guard' : 'all_captured_bodies_within_50000', full_request_bound_caveat: 'When a captured body exceeds this bound, the corresponding cost reservation cannot be treated as dispatchable; the measured size is supplied to support any later reservation decision.' },
  prices: { expires_at: prices.expires_at, source_file_sha256: sha256(readFileSync('data/pipeline-prices.json')), flex_discount_assumed: false },
  binding: {
    v77_validation_contract_sha256: v77ContractHash,
    v77_prompt_sha256: V77_PROMPT_HASH,
    frozen_v76_regression_sha256: sha256(readFileSync(frozenPath)),
    v76_saved_results_sha256: sha256(readFileSync(savedPath)),
    overlay_sha256: sha256(readFileSync(overlayPath)),
  },
  stage_bounds: stageBounds,
  max_request_body_utf8_bytes: allBytes,
  max_request_case_stage: captures.reduce((best, row) => row.utf8_bytes > best.utf8_bytes ? row : best, captures[0]),
  bound_13: {
    initial_requests_usd: initial13 / 1e6,
    one_full_input_retry_with_doubled_output_each_usd: retry13 / 1e6,
    total_usd: (initial13 + retry13) / 1e6,
  },
  bound_41: {
    prior_28_specimen_source: 'Existing v77-offline-budget-preflight-v1 report, same registered prices and local input reservation.',
    initial_requests_usd: initial41 / 1e6,
    one_full_input_retry_with_doubled_output_each_usd: retry41 / 1e6,
    total_usd: (initial41 + retry41) / 1e6,
  },
  captures,
};
const outArg = process.argv.indexOf('--out');
const outPath = outArg >= 0 ? process.argv[outArg + 1] : `${root}/execution/v77-offline-regression-sizing-v1.json`;
writeFileSync(outPath, JSON.stringify(output, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ ...output, captures: undefined }));
