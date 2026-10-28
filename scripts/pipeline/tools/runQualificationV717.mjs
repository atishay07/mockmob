// V717 fixed-case study runner (qualification or bounded regression diagnostic). No repairs, replacements or publication.
// Usage: node scripts/pipeline/tools/runQualificationV717.mjs <prepare|report|execute|recover> <study-directory> [--approved]
// prepare is offline and create-only; execute/recover require --approved and run through the persistent USD50 guard.
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
import { createScorecardReviewV717, scorecardPromptHashV717 } from '../lib/scorecardReviewV717.mjs';
import { FACTORY_VERIFIER_VERSION_V717, validationContractV717 } from '../lib/contractV717.mjs';
import { openCampaignSessionV717, assertRegistrationV717 } from '../lib/campaignSessionV717.mjs';
import { assertExecutionFreezeV717 } from '../lib/executionFreezeV717.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const [action, directoryArg] = process.argv.slice(2), args = process.argv.slice(2);
if (!directoryArg || !['prepare', 'report', 'execute', 'recover'].includes(action)) throw Error('action_and_study_directory_required');
const directory = resolve(directoryArg), rel = p => relative(ROOT, p).split(sep).join('/');
const path = name => resolve(directory, name), read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const SUBJECTS = ['accountancy', 'business_studies', 'economics', 'english'];
const study = read(path('study.json'));
if (study.schema !== 'cuet-v717-study-v1' || !['qualification', 'diagnostic'].includes(study.kind) || study.publication !== 'never') throw Error('v717_study_definition_invalid');
const qualification = study.kind === 'qualification';
const cases = read(path('cases.json'));
if (cases.schema !== 'cuet-v717-cases-v1' || cases.study_id !== study.id || !Array.isArray(cases.cases) || !cases.cases.length) throw Error('v717_cases_invalid');
const regPath = path('registration.json'), statePath = path('state.json'), preflightPath = path('preflight.json'), ledgerPath = 'data/pipeline-budget.sqlite';

// Offline capture of every planned request body (base + completion retry for each stage) with synthetic responses.
async function captureBodies(registry) {
 const valueFor = schema => {
  if (Array.isArray(schema?.enum)) return schema.enum[0];
  if (schema?.type === 'object') return Object.fromEntries((schema.required || []).map(key => [key, valueFor(schema.properties?.[key] || {})]));
  if (schema?.type === 'array') return Array.from({ length: schema.minItems || 0 }, () => valueFor(schema.items || {}));
  if (schema?.type === 'string') return 'Synthetic planning response.';
  if (Array.isArray(schema?.type) && schema.type.includes('number') || schema?.type === 'number') return 8;
  return null;
 };
 const rows = [], counts = new Map(), cache = new Map();
 let active;
 const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
 const transport = { async generate(provider, body, options = {}) {
  const id = `${options.candidate_id}:${options.stage}`, count = counts.get(id) || 0, serialized = JSON.stringify(body);
  counts.set(id, count + 1);
  rows.push({ candidate_id: options.candidate_id, stage: options.stage, provider, variant: count ? 'completion_retry' : 'base', request_key: options.key,
   output_cap: provider === 'openai' ? body.max_output_tokens : body.generationConfig.maxOutputTokens, input_bound_bytes: 33024,
   request_bytes: Buffer.byteLength(serialized), body_sha256: createHash('sha256').update(serialized).digest('hex'), body });
  if (!count) return { output_text: '{' };
  const input = JSON.parse(provider === 'openai' ? body.input.find(r => r.role === 'user').content : body.contents[0].parts[0].text);
  const schema = provider === 'openai' ? body.text.format.schema : body.generationConfig.responseFormat.text.schema, result = valueFor(schema);
  const src = input.evidence_catalog?.[0]?.id ? [input.evidence_catalog[0].id] : [];
  Object.assign(result, { candidate_id: input.candidate_id, content_hash: input.content_hash, source_ids: src, issues: [] });
  if (options.stage === 'explanation_support') Object.assign(result, { answer_set: [active.correct_answer], explanation_status: 'supported', options_status: 'supported',
   claims: [{ claim: active.explanation, basis: 'excerpt', status: 'supported', source_ids: src, reason: 'Planning only.' }] });
  else Object.assign(result, { solved_key: active.correct_answer, answer_set: [active.correct_answer], derivation: 'Planning only.',
   options: ['A', 'B', 'C', 'D'].map(option => ({ option, status: option === active.correct_answer ? 'defensible' : 'not_answer', basis: 'excerpt', source_ids: src, reason: 'Planning only.' })),
   academic: Object.fromEntries(Object.keys(result.academic || {}).map(k => [k, 'supported'])),
   difficulty_assessment: { level: active.difficulty || 'medium', reason: 'Planning only.', comparison_basis: 'heuristic', operation:'Planning only.', concepts_conditions:['Planning only.'], exemplar_ids:[] } });
  return { output_text: JSON.stringify(result) };
 } };
 const reviewer = createScorecardReviewV717({ registry, ledger, transport });
 for (const item of cases.cases) { active = item.candidate; await reviewer.review(item.candidate); }
 return rows;
}

function summary(state) {
 const custody = qualification || existsSync(path('custody.json')) ? read(path('custody.json')) : { answers: [] };
 const label = new Map(custody.answers.map(a => [a.id, a]));
 const outcome = id => state.cases?.[id] || {};
 const terminal = id => ['eligible', 'quarantined', 'error'].includes(outcome(id).state);
 const eligible = id => outcome(id).state === 'eligible';
 const valid = cases.cases.filter(c => label.get(c.id)?.expected_valid === true), defects = cases.cases.filter(c => label.get(c.id)?.expected_valid === false);
 const bySubject = Object.fromEntries(SUBJECTS.map(subject => { const rows = valid.filter(c => c.subject === subject); return [subject, { ok: rows.filter(c => eligible(c.id)).length, n: rows.length }]; }));
 let accounting = { settled_micro: 0, held_micro: 0, receipt_complete: true };
 if (existsSync(ledgerPath)) { const db = new DatabaseSync(ledgerPath, { readOnly: true }); try { accounting = scopedAccounting({ db }, study.id + ':'); } finally { db.close(); } }
 const falseAccepts = defects.filter(c => eligible(c.id)).map(c => c.id), validOk = valid.filter(c => eligible(c.id)).length;
 const complete = cases.cases.every(c => terminal(c.id)) && accounting.receipt_complete && accounting.held_micro === 0;
 // Incomplete model evidence is not proof of detecting a controlled defect. The original
 // zero-FA and 85/70 survival thresholds stay intact; every decision must be reviewable.
 const passed = cases.cases.every(c=>outcome(c.id).state!=='error') && !falseAccepts.length && valid.length > 0 && validOk / valid.length >= 0.85 && SUBJECTS.every(s => bySubject[s].n > 0 && bySubject[s].ok / bySubject[s].n >= 0.70);
 const rows = cases.cases.map(c => { const o = outcome(c.id), l = label.get(c.id) || {};
  return { id: c.id, subject: c.subject, expected_valid: l.expected_valid ?? null, defect_class: l.defect_class || null, state: o.state || 'not_started', outcome: o.outcome || null,
   academic_sound: o.academic_sound ?? null, quality_score: o.quality_score ?? null, route_band: o.route_band || null, difficulty: o.difficulty?.level || null,
   blind_keys: (o.checks?.reports || o.question?.evidence?.record?.reports || o.blind_frozen?.reports || []).map(r => r.solved_key), reasons: o.reasons || (o.error ? [o.error] : []) }; });
 return { id: study.id, kind: study.kind, profile: FACTORY_VERIFIER_VERSION_V717, denominator: cases.cases.length, terminal: cases.cases.filter(c => terminal(c.id)).length,
  valid_total: valid.length, valid_eligible: validOk, valid_by_subject: bySubject, controlled_defects: defects.length, controlled_false_accepts: falseAccepts,
  review_incomplete: rows.filter(r => r.state === 'error').map(r => r.id), unfinished: rows.filter(r => !terminal(r.id)).map(r => r.id),
  decision_rule: study.decision_rule, decision: qualification ? (complete ? (passed ? 'passed' : 'failed') : 'incomplete') : 'diagnostic_only',
  settled_usd: accounting.settled_micro / 1e6, held_usd: accounting.held_micro / 1e6, receipt_complete: accounting.receipt_complete, cases: rows,
  publication: 'never', release_record: false };
}

if (action === 'prepare') {
 if ([regPath, statePath, preflightPath].some(existsSync)) throw Error('v717_registration_exists_create_only');
 const registry = read(path('registry.json')), prices = read('data/pipeline-prices.json');
 const freezePath = resolve(study.execution_freeze_path), freezeSha = sha(freezePath);
 const jobs = cases.cases.map(c => ({ id: c.id, subject: c.subject, candidate_hash: hashJSON(c.candidate), ...(c.passage_group ? { passage_group: c.passage_group } : {}) }));
 const campaign = { id: study.id, jobs: jobs.map(j => ({ id: j.id, subject: j.subject })) };
 const requests = await captureBodies(registry);
 const expected = cases.cases.length * 6;
 if (requests.length !== expected) throw Error(`v717_capture_incomplete:${requests.length}/${expected}`);
 const over = requests.filter(r => r.request_bytes > 33024);
 if (over.length) throw Error('v717_planned_body_over_bound:' + over.map(r => r.candidate_id + ':' + r.stage + ':' + r.variant).join(','));
 const binding = { contract_hash: validationContractV717(), prompt_hash: scorecardPromptHashV717(), campaign_sha256: hashJSON(campaign), registry_sha256: hashJSON(registry),
  runner_sha256: sha(fileURLToPath(import.meta.url)), engine_sha256: sha('scripts/pipeline/lib/verifyV717.mjs') };
 const preflight = { schema: 'cuet-v717-full-body-preflight-v1', passed: true, coverage: 'all-five-stages-and-retries', ...binding, pricing_hash: hashJSON(prices), requests };
 const standard = requests.reduce((total, r) => total + maximumRequestMicro(r.provider, r.body, prices), 0) / 1e6;
 const registration = { id: study.id, kind: study.kind, profile: FACTORY_VERIFIER_VERSION_V717, created_at: new Date().toISOString(), ...binding, registry_hash: binding.registry_sha256,
  pricing_hash: hashJSON(prices), pricing_expires_at: prices.expires_at, cost_profile: { pricing_hash: hashJSON(prices), input_byte_bounds: { 'gpt-6-luna': 33024, 'gemini-3.8-flash': 33024 } },
  jobs, qualification, validation_only: true, cap_usd: study.cap_usd, publication: 'never', max_repairs: 0, replacements: 0, standard_full_bound_usd: standard, budget_stop_possible: true,
  input_byte_bound: 33024, full_retry_bounds: true, preflight_hash: hashJSON(preflight), decision_rule: study.decision_rule, standard_full_bound_exceeds_cap: standard > study.cap_usd,
  execution_freeze: { path: rel(freezePath), sha256: freezeSha }, cases: { path: rel(path('cases.json')), sha256: sha(path('cases.json')) },
  ...(qualification ? { unseen_at_freeze: true, custody: { path: rel(path('custody.json')) }, independent_answer_custody_hash: sha(path('custody.json')) } : {}),
  max_planned_request_bytes: Math.max(...requests.map(r => r.request_bytes)) };
 assertRegistrationV717(registration, registry, prices, preflight);
 writeFileSync(preflightPath, JSON.stringify(preflight) + '\n', { flag: 'wx' });
 writeFileSync(regPath, JSON.stringify(registration, null, 2) + '\n', { flag: 'wx' });
 writeFileSync(statePath, JSON.stringify({ registration_hash: hashJSON(registration), request_keys: [], cases: {}, runs: [], created_at: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
 console.log(JSON.stringify({ prepared: rel(directory), cases: cases.cases.length, planned_requests: requests.length, max_request_bytes: registration.max_planned_request_bytes,
  standard_full_bound_usd: standard, cap_usd: study.cap_usd, budget_stop_possible: registration.budget_stop_possible, paid_calls: 0 }, null, 2));
 process.exit(0);
}
if (!existsSync(regPath)) { console.log(JSON.stringify({ prepared: false, paid_calls: 0 })); process.exit(0); }
if (action === 'report') { const result = summary(read(statePath)); console.log(JSON.stringify(result, null, 2)); process.exit(0); }
if (!args.includes('--approved')) throw Error('explicit_paid_execution_required');
const registration = read(regPath), registry = read(path('registry.json')), prices = read('data/pipeline-prices.json'), preflight = read(preflightPath);
if (registration.runner_sha256 !== sha(fileURLToPath(import.meta.url))) throw Error('v717_registered_runner_changed');
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
 session = await openCampaignSessionV717({ registration, registry, prices, preflight, ledgerPath, statePath, inventory: [], secret: process.env.CUET_EVIDENCE_SIGNING_KEY, stopRequested: requested });
 const current = () => read(statePath);
 if (action === 'recover') await session.recover();
 else {
  let paused = false;
  while (!requested() && !paused) {
   // Every frozen module must still match before each wave; a changed checkout pauses the study instead of re-keying it.
   try { assertExecutionFreezeV717(registration.execution_freeze.path, registration.execution_freeze.sha256); } catch (error) { log({ paused: 'execution_freeze_changed', error: error.message }); paused = true; break; }
   await session.recover();
   const st = current();
   const open = cases.cases.filter(c => !['eligible', 'quarantined', 'error', 'held'].includes(st.cases?.[c.id]?.state));
   const wave = open.slice(0, 10);
   if (!wave.length) break;
   let pending = 0;
   await drainConcurrent(wave, async item => {
    try { const result = await session.validate(item.candidate, item.passage_group ? { passageGroup: item.passage_group } : {}); log({ id: item.id, state: result.state, outcome: result.outcome, reasons: result.reasons || [] }); }
    catch (error) {
     const state = current().cases?.[item.id]?.state;
     if (state === 'pending') pending++; else if (state === 'paused' || /draining_stop|session_closed|contract_changed/.test(String(error.message))) paused = true;
     log({ id: item.id, state, error: String(error.message).slice(0, 300) });
    }
   }, { concurrency: 4, shouldStop: () => requested() || paused });
   if (paused || requested()) break;
   await session.flush();
   if (pending) await new Promise(done => setTimeout(done, 30000));
  }
 }
} finally {
 try { session?.close(); } catch (error) { log({ close_error: error.message }); }
 process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
 try { unlinkSync(lock); } catch {}
}
const result = summary(read(statePath));
saveAtomicArtifact(path('summary.json'), result);
console.log(JSON.stringify({ ...result, cases: undefined }, null, 2));
