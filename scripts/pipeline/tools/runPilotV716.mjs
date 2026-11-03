// V716 fixed-denominator generation pilot (author -> independent review -> local policy). Measurement only:
// publication never, no repairs, no replacements, every job and every failure stays in the denominator.
// Usage: node --use-system-ca scripts/pipeline/tools/runPilotV716.mjs <prepare|report|execute> <pilot-directory> [--approved]
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';
import { saveAtomicArtifact, drainConcurrent } from '../lib/atomicArtifact.mjs';
import { maximumRequestMicro } from '../lib/campaignExecutionV7.mjs';
import { authorOriginal } from '../lib/factoryCore.mjs';
import { createScorecardReviewV716, scorecardPromptHashV716 } from '../lib/scorecardReviewV716.mjs';
import { FACTORY_VERIFIER_VERSION_V716, validationContractV716 } from '../lib/contractV716.mjs';
import { openCampaignSessionV716, assertRegistrationV716 } from '../lib/campaignSessionV716.mjs';
import { assertExecutionFreezeV716 } from '../lib/executionFreezeV716.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const [action, directoryArg] = process.argv.slice(2), args = process.argv.slice(2);
if (!directoryArg || !['prepare', 'report', 'execute'].includes(action)) throw Error('action_and_pilot_directory_required');
const directory = resolve(directoryArg), rel = p => relative(ROOT, p).split(sep).join('/');
const path = name => resolve(directory, name), read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const study = read(path('study.json')), campaign = read(path('campaign.json'));
if (study.schema !== 'cuet-v716-pilot-v1' || study.publication !== 'never' || study.max_repairs !== 0 || campaign.id !== study.id) throw Error('v716_pilot_definition_invalid');
const jobs = campaign.jobs, WAVE = study.wave_size || 10;
if (!Array.isArray(jobs) || !jobs.length || new Set(jobs.map(j => j.id)).size !== jobs.length || WAVE > 10) throw Error('v716_pilot_jobs_invalid');
const regPath = path('registration.json'), statePath = path('state.json'), preflightPath = path('preflight.json'), ledgerPath = 'data/pipeline-budget.sqlite';
const userText = (provider, body) => provider === 'openai' ? body.input.find(r => r.role === 'user').content : body.contents[0].parts[0].text;
const capRow = (provider, body, options, variant) => { const serialized = JSON.stringify(body);
 return { candidate_id: options.candidate_id, stage: options.stage, provider, variant, request_key: options.key, output_cap: provider === 'openai' ? body.max_output_tokens : body.generationConfig.maxOutputTokens,
  input_bound_bytes: 33024, request_bytes: Buffer.byteLength(serialized), body_sha256: createHash('sha256').update(serialized).digest('hex'), body }; };

// Offline: the exact raw author bodies (base + completion retry) and planned review bodies for a maximal placeholder draft.
async function planBodies(registry) {
 const rows = [], authorHashes = {};
 for (const job of jobs) {
  const bodies = [];
  const transport = { async generate(provider, body, options = {}) { bodies.push(body); rows.push(capRow(provider, body, { ...options, candidate_id: job.id, stage: 'authoring' }, bodies.length > 1 ? 'completion_retry' : 'base')); return { output_text: '{' }; } };
  try { await authorOriginal(job, { registry, transport }); } catch {}
  if (bodies.length !== 2) throw Error('v716_author_body_capture_incomplete:' + job.id);
  authorHashes[job.id] = { author_body_hash: hashJSON(bodies[0]), author_retry_body_hash: hashJSON(bodies[1]) };
  for (const [index, body] of bodies.entries()) rows.push({ ...capRow('openai', body, { key: hashJSON({ planned: 'repair', job: job.id, index }), candidate_id: job.id, stage: 'repair' }, index ? 'completion_retry' : 'base'), never_executed: 'max_repairs_0' });
 }
 const valueFor = schema => {
  if (Array.isArray(schema?.enum)) return schema.enum[0];
  if (schema?.type === 'object') return Object.fromEntries((schema.required || []).map(key => [key, valueFor(schema.properties?.[key] || {})]));
  if (schema?.type === 'array') return Array.from({ length: schema.minItems || 0 }, () => valueFor(schema.items || {}));
  if (schema?.type === 'string') return 'Planning only.';
  if (Array.isArray(schema?.type) && schema.type.includes('number') || schema?.type === 'number') return 8;
  return null;
 };
 const counts = new Map(), cache = new Map(), ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, value) };
 const transport = { async generate(provider, body, options = {}) {
  const id = `${options.candidate_id}:${options.stage}`, count = counts.get(id) || 0; counts.set(id, count + 1);
  rows.push(capRow(provider, body, options, count ? 'completion_retry' : 'base'));
  if (!count) return { output_text: '{' };
  const input = JSON.parse(userText(provider, body)), schema = provider === 'openai' ? body.text.format.schema : body.generationConfig.responseFormat.text.schema, result = valueFor(schema);
  const src = input.evidence_catalog?.[0]?.id ? [input.evidence_catalog[0].id] : [];
  Object.assign(result, { candidate_id: input.candidate_id, content_hash: input.content_hash, source_ids: src, issues: [], answer_set: ['A'] });
  if (options.stage === 'explanation_support') Object.assign(result, { explanation_status: 'supported', options_status: 'supported', claims: [{ claim: 'Planning only.', basis: 'excerpt', status: 'supported', source_ids: src, reason: 'Planning only.' }] });
  else Object.assign(result, { solved_key: 'A', derivation: 'Planning only.', options: ['A', 'B', 'C', 'D'].map(option => ({ option, status: option === 'A' ? 'defensible' : 'not_answer', basis: 'excerpt', source_ids: src, reason: 'Planning only.' })),
   academic: Object.fromEntries(Object.keys(result.academic || {}).map(k => [k, 'supported'])), difficulty_assessment: { level: 'medium', reason: 'Planning only.', comparison_basis: 'heuristic' } });
  return { output_text: JSON.stringify(result) };
 } };
 const reviewer = createScorecardReviewV716({ registry, ledger, transport });
 const long = n => 'Planning placeholder text of maximal draft length. '.repeat(Math.ceil(n / 50)).slice(0, n);
 for (const job of jobs) {
  // A deliberately long placeholder draft bounds the real draft's review bodies from above.
  const draft = { id: job.id, subject: job.subject, chapter: job.chapter, family_id: job.family_id, route: job.passage_text ? 'passage' : 'conceptual', question_type: job.format,
   difficulty: job.difficulty, body: long(900), options: ['A', 'B', 'C', 'D'].map(key => ({ key, text: long(220) })), correct_answer: 'A', explanation: long(1400), passage_text: job.passage_text || '',
   concept_id: 'planning', source_refs: job.source_refs, learning_objective: { syllabus_unit: 'planning', objective: 'planning', target_term: '' },
   provenance: { kind: 'original_practice', adaptation_family: job.family_id, source_pack_id: job.source_pack_id, source_pack_version: job.source_pack_version } };
  await reviewer.review(draft);
 }
 return { rows, authorHashes };
}

function summary(state) {
 let accounting = { settled_micro: 0, held_micro: 0, receipt_complete: true };
 if (existsSync(ledgerPath)) { const db = new DatabaseSync(ledgerPath, { readOnly: true }); try { accounting = scopedAccounting({ db }, study.id + ':'); } finally { db.close(); } }
 const outcome = id => state.cases?.[id] || {};
 const terminal = id => ['eligible', 'quarantined', 'error'].includes(outcome(id).state);
 const rows = jobs.map(job => { const o = outcome(job.id); return { id: job.id, number: job.number, subject: job.subject, format: job.format, target_difficulty: job.difficulty,
  state: o.state || 'not_started', outcome: o.outcome || null, academic_sound: o.academic_sound ?? null, quality_score: o.quality_score ?? null, route_band: o.route_band || null,
  routed_difficulty: o.difficulty?.level || null, reasons: o.reasons || (o.error ? [o.error] : []) }; });
 const approved = rows.filter(r => r.state === 'eligible'), spent = accounting.settled_micro / 1e6;
 const waves = []; for (let i = 0; i < jobs.length; i += WAVE) { const slice = rows.slice(i, i + WAVE); waves.push({ wave: i / WAVE + 1, eligible: slice.filter(r => r.state === 'eligible').length, terminal: slice.filter(r => terminal(r.id)).length, n: slice.length }); }
 return { id: study.id, profile: FACTORY_VERIFIER_VERSION_V716, denominator: jobs.length, terminal: rows.filter(r => terminal(r.id)).length, approved: approved.length,
  approved_nta: approved.filter(r => r.route_band === 'nta_eligible').length, approved_practice_only: approved.filter(r => r.route_band === 'practice_only').length,
  by_outcome: rows.reduce((m, r) => (m[r.outcome || r.state] = (m[r.outcome || r.state] || 0) + 1, m), {}),
  by_subject: Object.fromEntries(['accountancy', 'business_studies', 'economics', 'english'].map(s => [s, { approved: approved.filter(r => r.subject === s).length, n: rows.filter(r => r.subject === s).length }])),
  waves, stop_rule: study.stop_rule, stopped: existsSync(path('stop.json')) ? read(path('stop.json')) : null, settled_usd: spent, held_usd: accounting.held_micro / 1e6, receipt_complete: accounting.receipt_complete,
  cost_per_approved_usd: approved.length ? spent / approved.length : null, cost_per_10000_approved_usd: approved.length ? 10000 * spent / approved.length : null,
  cost_basis: 'All settled campaign spend (authoring, reasoning, blind solves, independent evaluation, audits, completion retries, failures) divided by approved; holds excluded only when zero.',
  cases: rows, publication: 'never' };
}

if (action === 'prepare') {
 if ([regPath, statePath, preflightPath].some(existsSync)) throw Error('v716_registration_exists_create_only');
 const registry = read(path('registry.json')), prices = read('data/pipeline-prices.json');
 const freezePath = resolve(study.execution_freeze_path);
 const { rows, authorHashes } = await planBodies(registry);
 const expected = jobs.length * 10;
 if (rows.length !== expected) throw Error(`v716_plan_incomplete:${rows.length}/${expected}`);
 const over = rows.filter(r => r.request_bytes > 33024);
 if (over.length) throw Error('v716_planned_body_over_bound:' + over.map(r => r.candidate_id + ':' + r.stage).join(','));
 const regJobs = jobs.map(job => ({ ...job, ...authorHashes[job.id] }));
 const binding = { contract_hash: validationContractV716(), prompt_hash: scorecardPromptHashV716(), campaign_sha256: hashJSON({ id: study.id, jobs: regJobs.map(j => ({ id: j.id, subject: j.subject })) }),
  registry_sha256: hashJSON(registry), runner_sha256: sha(fileURLToPath(import.meta.url)), engine_sha256: sha('scripts/pipeline/lib/verifyV716.mjs') };
 const preflight = { schema: 'cuet-v716-full-body-preflight-v1', passed: true, coverage: 'all-five-stages-and-retries', ...binding, pricing_hash: hashJSON(prices), requests: rows };
 const standard = rows.reduce((t, r) => t + maximumRequestMicro(r.provider, r.body, prices), 0) / 1e6;
 const executable = rows.filter(r => !r.never_executed).reduce((t, r) => t + maximumRequestMicro(r.provider, r.body, prices), 0) / 1e6;
 const registration = { id: study.id, kind: 'pilot', profile: FACTORY_VERIFIER_VERSION_V716, created_at: new Date().toISOString(), ...binding, registry_hash: binding.registry_sha256,
  pricing_hash: hashJSON(prices), pricing_expires_at: prices.expires_at, cost_profile: { pricing_hash: hashJSON(prices), input_byte_bounds: { 'gpt-6-luna': 33024, 'gemini-3.8-flash': 33024 } },
  jobs: regJobs, qualification: false, cap_usd: study.cap_usd, publication: 'never', max_repairs: 0, replacements: 0, standard_full_bound_usd: standard,
  standard_executable_bound_usd: executable, budget_stop_possible: true, input_byte_bound: 33024, full_retry_bounds: true, preflight_hash: hashJSON(preflight),
  wave_size: WAVE, stop_rule: study.stop_rule, measurement_rules: study.measurement_rules, execution_freeze: { path: rel(freezePath), sha256: sha(freezePath) },
  max_planned_request_bytes: Math.max(...rows.map(r => r.request_bytes)) };
 assertRegistrationV716(registration, registry, prices, preflight);
 writeFileSync(preflightPath, JSON.stringify(preflight) + '\n', { flag: 'wx' });
 writeFileSync(regPath, JSON.stringify(registration, null, 2) + '\n', { flag: 'wx' });
 writeFileSync(statePath, JSON.stringify({ registration_hash: hashJSON(registration), request_keys: [], cases: {}, runs: [], created_at: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
 console.log(JSON.stringify({ prepared: rel(directory), jobs: jobs.length, planned_requests: rows.length, max_request_bytes: registration.max_planned_request_bytes,
  standard_full_bound_usd: standard, standard_executable_bound_usd: executable, cap_usd: study.cap_usd, paid_calls: 0 }, null, 2));
 process.exit(0);
}
if (!existsSync(regPath)) { console.log(JSON.stringify({ prepared: false, paid_calls: 0 })); process.exit(0); }
if (action === 'report') { console.log(JSON.stringify(summary(read(statePath)), null, 2)); process.exit(0); }
if (!args.includes('--approved')) throw Error('explicit_paid_execution_required');
const registration = read(regPath), registry = read(path('registry.json')), prices = read('data/pipeline-prices.json'), preflight = read(preflightPath);
if (registration.runner_sha256 !== sha(fileURLToPath(import.meta.url))) throw Error('v716_registered_runner_changed');
try { loadEnvFile('.env.local'); } catch {}
if (process.env.MOCK_AI === 'true' || !process.env.CUET_EVIDENCE_SIGNING_KEY) throw Error('real_signed_evidence_required');
const lock = path('worker.lock');
writeFileSync(lock, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }), { flag: 'wx' });
let stopping = false;
const stop = () => { stopping = true; }, requested = () => stopping || existsSync(path('STOP_AFTER_REQUEST'));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const log = value => console.log(JSON.stringify({ at: new Date().toISOString(), ...value }));
let session;
try {
 session = await openCampaignSessionV716({ registration, registry, prices, preflight, ledgerPath, statePath, inventory: [], secret: process.env.CUET_EVIDENCE_SIGNING_KEY, stopRequested: requested });
 const current = () => read(statePath), terminal = s => ['eligible', 'quarantined', 'error', 'held'].includes(s);
 let paused = false, weak = 0;
 for (let start = 0; start < jobs.length && !paused && !requested(); start += WAVE) {
  const wave = jobs.slice(start, start + WAVE);
  for (;;) {
   try { assertExecutionFreezeV716(registration.execution_freeze.path, registration.execution_freeze.sha256); } catch (error) { log({ paused: 'execution_freeze_changed', error: error.message }); paused = true; break; }
   await session.recover();
   const open = wave.filter(job => !terminal(current().cases?.[job.id]?.state));
   if (!open.length || paused || requested()) break;
   let pending = 0;
   await drainConcurrent(open, async job => {
    try {
     let candidate = current().cases?.[job.id]?.generated_candidate || await session.author(job.id);
     if (!candidate) { log({ id: job.id, state: current().cases?.[job.id]?.state, outcome: current().cases?.[job.id]?.outcome }); return; }
     const result = await session.validate(candidate, job.passage_group ? { passageGroup: job.passage_group } : {});
     log({ id: job.id, state: result.state, outcome: result.outcome, score: result.quality_score ?? null, reasons: (result.reasons || []).slice(0, 6) });
    } catch (error) {
     const state = current().cases?.[job.id]?.state;
     if (state === 'pending') pending++; else if (state === 'paused' || /draining_stop|session_closed|contract_changed/.test(String(error.message))) paused = true;
     log({ id: job.id, state, error: String(error.message).slice(0, 300) });
    }
   }, { concurrency: 4, shouldStop: () => requested() || paused });
   if (paused || requested()) break;
   await session.flush();
   if (pending) await new Promise(done => setTimeout(done, 30000));
  }
  if (paused || requested()) break;
  const eligible = wave.filter(job => current().cases?.[job.id]?.state === 'eligible').length;
  log({ wave: start / WAVE + 1, eligible, n: wave.length });
  // Preregistered stop rule: two consecutive completed waves under 40% eligible stop the campaign.
  weak = eligible / wave.length < 0.4 ? weak + 1 : 0;
  if (weak >= 2) { log({ stop: 'two_consecutive_waves_under_40_percent' }); writeFileSync(path('stop.json'), JSON.stringify({ reason: 'two_consecutive_waves_under_40_percent', after_wave: start / WAVE + 1, at: new Date().toISOString() }), { flag: 'wx' }); session.stop(); stopping = true; break; }
 }
} finally {
 try { session?.close(); } catch (error) { log({ close_error: error.message }); }
 process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
 try { unlinkSync(lock); } catch {}
}
const finalState = read(statePath);
const result = summary(finalState);
saveAtomicArtifact(path('summary.json'), result);
console.log(JSON.stringify({ ...result, cases: undefined }, null, 2));
