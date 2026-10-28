// Offline-only full-body capture for the registered V713 continuation. Retry-only synthetic evaluation output warms local caches; it is never stored as evidence.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { authorOriginal } from '../lib/factoryCore.mjs';
import { repairFactoryCandidate } from '../lib/factoryCore.mjs';
import { authorOriginalV79 } from '../lib/originalAuthorPolicyV79.mjs';
import { composeAuthorTransport } from '../lib/cuetPilotV75Deps.mjs';
import { authorOriginalV713 } from '../lib/originalAuthorPolicyV713.mjs';
import { createFactoryEvidenceV713, blindViewV713, TOPOLOGIES } from '../lib/factoryEvidenceV713.mjs';
import { buildPilotDepsV713 } from '../lib/cuetPilotDepsV713.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { V713_PROMPT_HASH } from '../lib/factoryEvidenceV713.mjs';
import { costProfileV713 } from '../lib/costProfileV713.mjs';
import { assertFullBodyPreflightV713 } from '../lib/preflightV713.mjs';
import { createFactoryEvidenceV712, TOPOLOGIES as TOPOLOGIES_V712, blindViewV712 } from '../lib/factoryEvidenceV712.mjs';
import { bodyCandidateId } from '../lib/scopedAccounting.mjs';

if (!process.argv.includes('--capture-offline') || process.argv.some(arg => ['--execute', '--approved', '--publish'].includes(arg)))
  throw Error('offline_capture_requires_only_--capture-offline');
const directory = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/measurement-continuation-40');
const parent = resolve('artifacts/question-factory/cuet-pilot-v712-40-2026-10-09');
const regFile = resolve(directory, 'registration.json'), campaignFile = resolve(directory, 'campaign.json'), registryFile = resolve(directory, 'registry.json');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
if (![regFile, campaignFile, registryFile].every(existsSync)) throw Error('prepared_v713_registration_required');
const registration = read(regFile), campaign = read(campaignFile), registry = read(registryFile), prices = read('data/pipeline-prices.json');
if (registration.contract_hash !== validationContractV713() || registration.prompt_hash !== V713_PROMPT_HASH ||
    registration.campaign_sha256 !== sha(campaignFile) || registration.registry_sha256 !== sha(registryFile) ||
    registration.runner_sha256 !== sha('scripts/pipeline/tools/runFinalGeneratorV713.mjs') ||
    registration.engine_sha256 !== sha('scripts/pipeline/lib/cuetPilotRunV713.mjs') ||
    registration.cost_profile?.pricing_hash !== costProfileV713(prices).pricing_hash) throw Error('registered_v713_inputs_changed_before_preflight');
const output = resolve(directory, 'full-body-preflight.json');
if (existsSync(output)) throw Error('full_body_preflight_exists_refusing_overwrite');
const old = read(resolve(parent, 'state.json'));
const actualById = new Map(Object.values(old.jobs).filter(job => job.candidate).map(job => [job.id, job.candidate]));
const templates = new Map();
for (const job of actualById.values()) {
  const oldTemplate = templates.get(job.subject);
  if (!oldTemplate || JSON.stringify(job).length > JSON.stringify(oldTemplate).length) templates.set(job.subject, job);
}
if (actualById.size !== 14 || ['english', 'accountancy', 'business_studies', 'economics'].some(subject => !templates.has(subject)))
  throw Error('expected_fourteen_saved_candidates_and_four_subject_templates');

const candidates = campaign.jobs.map(job => {
  const saved = actualById.get(job.id);
  if (saved) { const candidate = structuredClone(saved); delete candidate.evidence;
    return { job, candidate, source: 'saved_v712_candidate' }; }
  const candidate = structuredClone(templates.get(job.subject));
  candidate.id = job.id; candidate.subject = job.subject; candidate.chapter = job.chapter; candidate.family_id = job.family_id;
  candidate.difficulty = job.difficulty; candidate.source_refs = structuredClone(job.source_refs);
  candidate.provenance = { ...candidate.provenance, adaptation_family: job.family_id, source_pack_id: job.source_pack_id,
    source_pack_version: job.source_pack_version, syllabus_version: registry.exam_specs?.[job.subject]?.syllabus_version || candidate.provenance?.syllabus_version,
    pattern_version: registry.exam_specs?.[job.subject]?.pattern_version || candidate.provenance?.pattern_version };
  candidate.learning_objective = { ...(candidate.learning_objective || {}), syllabus_unit: job.official_syllabus_topic || job.chapter,
    objective: `Synthetic sizing-only copy for registered brief ${job.id}: ${job.topic}` };
  if (job.format === 'reading_comprehension') {
    candidate.route = 'passage'; candidate.question_type = 'reading_comprehension'; candidate.passage_text = job.passage_text || candidate.passage_text || '';
  }
  delete candidate.evidence;
  return { job, candidate, source: 'synthetic_for_sizing_only' };
});
const cache = new Map(), ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)), claimRepair: () => true };
const requests = [], v712Requests = [];
class Captured extends Error { constructor() { super('offline_body_captured'); } }
let activeCapture = null, activeCandidateId = null;
function syntheticEvaluation(provider, body) {
  const raw = provider === 'openai' ? body.input?.find(row => row.role === 'user')?.content
    : body.contents?.find(row => row.role === 'user')?.parts?.[0]?.text;
  const input = JSON.parse(raw || '{}'), options = Array.isArray(input.options) ? input.options : [];
  return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: 'A',
    single_defensible_answer: true, source_support: true, numeric_solution: true, boundary_cases: true, passage_integrity: true,
    passage_answerability: true, meaningfully_distinct: true, evidence_ids: [], reasons: ['Synthetic sizing response only; not an academic judgment.'],
    syllabus_chapter: input.chapter || '', syllabus_topic: input.chapter || '', syllabus_entitlement: true, presentation_ready: true,
    question_type_match: true, principle_applicability: 'skill_from_stem', decisive_principle_in_excerpts: true, answer_conditions: [],
    option_challenges: [], blocking_defects: [], style_notes: [], cuet_fit: { criteria: {
      syllabus_objective: { level: 3, evidence: 'synthetic sizing fixture' }, format_authenticity: { level: 3, evidence: 'synthetic sizing fixture' },
      level_calibration: { level: 3, evidence: 'synthetic sizing fixture' }, discrimination_value: { level: 3, evidence: 'synthetic sizing fixture' } },
      reasoning_steps: 1, estimated_difficulty: 'medium', cognitive_level: 'comprehension', exemplar_ids_compared: [] },
    difficulty_assessment: { level: 'medium', reason: 'Synthetic sizing fixture.', comparison_basis: 'heuristic' },
    option_resolution: options.map(option => ({ option: option.key, status: 'unresolved', false_part: '', premise_source: 'none',
      evidence_id: '', premise_quote: '', reason: 'Synthetic sizing fixture.' })) }) };
}
const captureTransport = requestsOut => ({ async generate(provider, body, options = {}) {
  if (!options.stage) throw Error('preflight_stage_missing');
  const variant = activeCapture?.count === 0 ? 'base' : 'completion_retry';
  if (activeCapture) activeCapture.count++;
  requestsOut.push({ candidate_id: options.candidate_id || bodyCandidateId(provider, body) || activeCandidateId, stage: options.stage, provider,
    body: structuredClone(body), key: options.key, variant });
  if (variant === 'base') return { output_text: '{' };
  if (['blind_solution', 'independent_evaluation'].includes(options.stage)) return syntheticEvaluation(provider, body);
  throw new Captured();
} });
const transport = captureTransport(requests), transportV712 = captureTransport(v712Requests);
const deps = buildPilotDepsV713({ registry, ledger, transport });
const evidence = createFactoryEvidenceV713({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
const evidenceV712 = createFactoryEvidenceV712({ registry, ledger, transport: transportV712, topology: TOPOLOGIES_V712.dual_blind });
const inputBound = costProfileV713(prices).input_byte_bounds;
const syntheticRows = (view, key) => view.options.map(option => ({ option: option.key, status: option.key === key ? 'supported' : 'contradicted',
  false_part: option.key === key ? '' : String(option.text).slice(0, 80), premise_source: view.evidence_catalog?.length ? 'excerpt' : 'stem',
  evidence_id: view.evidence_catalog?.[0]?.id || '', premise_quote: String(view.body || view.passage || '').slice(0, 120),
  reason: 'Synthetic sizing-only resolution row; not an academic judgment.' }));
async function captureFrom(buffer, label, run) {
  const before = buffer.length, previous = activeCapture; activeCapture = { count: 0 };
  try { await run(); } catch (error) { if (!(error instanceof Captured)) throw error; }
  finally { activeCapture = previous; }
  if (buffer.length !== before + 2) throw Error(`preflight_expected_base_and_actual_retry:${label}:${buffer.length - before}`);
  if (!buffer[before].key || !buffer[before + 1].key || buffer[before].key === buffer[before + 1].key)
    throw Error(`preflight_retry_key_not_distinct:${label}`);
  return buffer.splice(before, 2);
}
function rowsForCapture(records, itemSource) { return records.map((record, index) => {
  const text = JSON.stringify(record.body), bound = inputBound[record.provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-6-luna'];
  return { candidate_id: record.candidate_id, stage: record.stage, provider: record.provider,
    variant: index === 0 ? 'base' : 'completion_retry', request_bytes: Buffer.byteLength(text, 'utf8'), input_bound_bytes: bound,
    body_sha256: createHash('sha256').update(text).digest('hex'), body: record.body, request_key: record.key,
    output_cap: record.provider === 'openai' ? record.body.max_output_tokens : record.body.generationConfig.maxOutputTokens,
    retry_output_doubled: index === 1, item_source: itemSource };
}); }
const sizingRows = [], v712SizingRows = [];
for (const { job, candidate, source } of candidates) {
  activeCandidateId = job.id;
  const authorRecords = await captureFrom(requests, `${job.id}:v713-authoring`, () => deps.author(job));
  sizingRows.push(...rowsForCapture(authorRecords, source === 'saved_v712_candidate' ? 'synthetic_brief_for_nonexecuted_authoring' : 'registered_brief'));
  const view = blindViewV713(candidate, candidate.source_refs || []);
  const blindRecords = await captureFrom(requests, `${job.id}:v713-blind_solution`, () => evidence.blind_solution(view));
  sizingRows.push(...rowsForCapture(blindRecords, source));
  const independentRecords = await captureFrom(requests, `${job.id}:v713-independent_evaluation`, () => evidence.independent_evaluation(view));
  sizingRows.push(...rowsForCapture(independentRecords, source));
  const prior = old.jobs[job.id]?.candidate?.evidence?.record?.option_resolution?.matrices || [];
  for (const [stage, provider] of [['blind_solution', 'openai'], ['independent_evaluation', 'gemini']]) {
    const saved = prior.find(row => row.stage === stage)?.matrix;
    const frozen = { candidate_id: view.candidate_id, content_hash: view.content_hash, solved_key: candidate.correct_answer,
      option_resolution: { passed: true }, option_resolution_rows: saved?.length === 4 ? saved : syntheticRows(view, candidate.correct_answer) };
    frozen.provider = provider;
    if (evidence.__freezeResolution(stage, view, frozen) !== true) throw Error(`preflight_freeze_failed:${job.id}:${stage}`);
  }
  const auditSource = prior.length === 2 ? 'saved_v712_matrices' : `${source}_with_synthetic_matrices`;
  const auditRecords = await captureFrom(requests, `${job.id}:v713-explanation_support`, () => evidence.explanation_support({ ...view, proposed_explanation: candidate.explanation || '' }));
  sizingRows.push(...rowsForCapture(auditRecords, auditSource));
  const repairRecords = await captureFrom(requests, `${job.id}:v713-repair`, () => repairFactoryCandidate(candidate,
    ['failed:offline_sizing_only'], { registry, ledger, transport: { async generate(provider, body, options = {}) {
      return transport.generate(provider, body, { ...options, candidate_id: options.candidate_id || job.id });
    } } }));
  sizingRows.push(...rowsForCapture(repairRecords, source));

  const oldAuthorRecords = await captureFrom(v712Requests, `${job.id}:v712-authoring`, () => authorOriginalV79(authorOriginal, job,
    { registry, transport: composeAuthorTransport(transportV712, job) }));
  v712SizingRows.push(...rowsForCapture(oldAuthorRecords, source === 'saved_v712_candidate' ? 'synthetic_brief_for_nonexecuted_authoring' : 'registered_brief'));
  const oldView = blindViewV712(candidate, candidate.source_refs || []);
  v712SizingRows.push(...rowsForCapture(await captureFrom(v712Requests, `${job.id}:v712-blind_solution`, () => evidenceV712.blind_solution(oldView)), source));
  v712SizingRows.push(...rowsForCapture(await captureFrom(v712Requests, `${job.id}:v712-independent_evaluation`, () => evidenceV712.independent_evaluation(oldView)), source));
  for (const [stage, provider] of [['blind_solution', 'openai'], ['independent_evaluation', 'gemini']]) {
    const saved = prior.find(row => row.stage === stage)?.matrix;
    const frozen = { candidate_id: oldView.candidate_id, content_hash: oldView.content_hash, solved_key: candidate.correct_answer,
      option_resolution: { passed: true }, option_resolution_rows: saved?.length === 4 ? saved : syntheticRows(oldView, candidate.correct_answer), provider };
    if (evidenceV712.__freezeResolution(stage, oldView, frozen) !== true) throw Error(`preflight_v712_freeze_failed:${job.id}:${stage}`);
  }
  const oldAuditRecords = await captureFrom(v712Requests, `${job.id}:v712-explanation_support`, () => evidenceV712.explanation_support({ ...oldView, proposed_explanation: candidate.explanation || '' }));
  v712SizingRows.push(...rowsForCapture(oldAuditRecords, auditSource));
  v712SizingRows.push(...rowsForCapture(await captureFrom(v712Requests, `${job.id}:v712-repair`, () => repairFactoryCandidate(candidate,
    ['failed:offline_sizing_only'], { registry, ledger, transport: { async generate(provider, body, options = {}) {
      return transportV712.generate(provider, body, { ...options, candidate_id: options.candidate_id || job.id });
    } } })), source));
}
const bindings = { contract_hash: registration.contract_hash, prompt_hash: registration.prompt_hash, campaign_sha256: registration.campaign_sha256,
  registry_sha256: registration.registry_sha256, runner_sha256: registration.runner_sha256, engine_sha256: registration.engine_sha256,
  pricing_hash: registration.cost_profile.pricing_hash };
const preflight = { ...bindings, coverage: 'all-five-stages-and-retries', captured_at: new Date().toISOString(), candidate_count: candidates.length,
  saved_candidate_count: actualById.size, synthetic_sizing_only_count: candidates.length - actualById.size, requests: sizingRows,
  v712_comparison_requests: v712SizingRows,
  maximum_request_bytes: Math.max(...sizingRows.map(row => row.request_bytes)), input_limit_bytes: inputBound,
  v712_comparison: { input_limit_bytes: 33024, max_request_bytes_v712: Math.max(...v712SizingRows.map(row => row.request_bytes)),
    max_request_bytes_v713: Math.max(...sizingRows.map(row => row.request_bytes)),
    max_byte_savings: Math.max(...v712SizingRows.map(row => row.request_bytes)) - Math.max(...sizingRows.map(row => row.request_bytes)),
    comparison_basis: 'same saved V712 candidate / synthetic sizing-only brief inputs, both adapters run through actual malformed-JSON completion retry; saved evidence matrices are reused where present' },
  paid_calls: 0, academic_evidence: false, passed: false };
const overBound = sizingRows.filter(row => row.request_bytes > row.input_bound_bytes);
if (sizingRows.length !== 400 || overBound.length) throw Error(`v713_full_body_preflight_failed:${JSON.stringify({ rows: sizingRows.length, overBound: overBound.slice(0, 10) })}`);
preflight.passed = true;
assertFullBodyPreflightV713(preflight, registration, campaign);
writeFileSync(output, JSON.stringify(preflight, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ preflight: output, candidates: 40, saved_candidates: actualById.size, synthetic_sizing_only: candidates.length - actualById.size,
  captures: sizingRows.length, maximum_request_bytes: preflight.maximum_request_bytes, input_limit_bytes: inputBound, paid_calls: 0, academic_evidence: false }, null, 2));
