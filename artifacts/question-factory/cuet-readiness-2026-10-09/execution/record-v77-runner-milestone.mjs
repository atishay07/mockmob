import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { verifyV77Freeze, verifyV77TransportFreeze, V77_TRANSPORT_DEPENDENCIES } from '../../../../scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09';
const execution = `${base}/execution`;
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function tests(name) {
  const path = arg(name);
  if (!path) throw new Error(`test_log_required:${name}`);
  const raw = readFileSync(path, 'utf8');
  const pass = Number(raw.match(/(?:#|ℹ) pass (\d+)/)?.[1]), fail = Number(raw.match(/(?:#|ℹ) fail (\d+)/)?.[1]);
  if (!Number.isSafeInteger(pass) || !pass || fail !== 0) throw new Error(`passing_test_log_required:${path}`);
  return { path, pass, fail, sha256: sha(path) };
}
const verification = { factory: tests('--factory-log'), focused: tests('--focused-log') };
const preservedPath = arg('--preservation');
if (!preservedPath) throw new Error('current_preservation_report_required');
const preservation = json(preservedPath);
if (!Array.isArray(preservation.mismatches) || preservation.mismatches.length) throw new Error('frozen_preservation_check_failed');
const core = verifyV77Freeze(resolve('.')), transport = verifyV77TransportFreeze(resolve('.'), V77_TRANSPORT_DEPENDENCIES);
const db = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
const lifetime = db.prepare(`SELECT COUNT(*) AS reservations,
  COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE 0 END),0) AS settled_micro,
  COALESCE(SUM(CASE WHEN state='settled' THEN 0 ELSE MAX(reserved,COALESCE(actual,0)) END),0) AS held_micro,
  SUM(CASE WHEN state='unresolved' THEN 1 ELSE 0 END) AS unresolved FROM requests`).get();
const provider = prefix => db.prepare("SELECT state,COUNT(*) AS n FROM provider_requests WHERE json_extract(request_json,'$.config.candidate_id') LIKE ? GROUP BY state").all(prefix+'%');
const requests = { v75: provider('v75-fresh-cbse2022-2026-10-09:'), v76: provider('v76-qualification-2026-10-09-'), v77: provider('v77-qualification-2026-10-09-') };
db.close();
if (requests.v77.length) throw new Error('milestone_is_local_only_not_native_qualification');
const costs = { settled_usd: lifetime.settled_micro/1e6, held_usd: lifetime.held_micro/1e6,
  committed_usd: (lifetime.settled_micro+lifetime.held_micro)/1e6,
  remaining_usd: (50e6-lifetime.settled_micro-lifetime.held_micro)/1e6,
  ceiling_usd: 50, reservations: lifetime.reservations, unresolved: lifetime.unresolved };
const prices = json('data/pipeline-prices.json');
const sizing = json(`${execution}/v77-offline-regression-sizing-v1.json`);
if (sizing.cases !== 13 || sizing.paid_calls !== 0 || sizing.database_mutations !== 0) throw new Error('expected_offline_regression_sizing_report_required');
const at = new Date().toISOString();
const changed = ['scripts/pipeline/tools/runFreshCuetReadinessV77.mjs', 'scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs',
  'scripts/pipeline/lib/releaseEvidenceV77.mjs', 'scripts/pipeline/tests/freshCuetReadinessV77Guards.test.mjs'];
const checkpoint = { at, goal_status: 'active', generator_state: 'V76 failed; V77 frozen locally and unqualified',
  core_freeze_sha256: core.raw_sha256, validation_contract_hash: core.validation_contract_hash,
  transport_freeze_sha256: transport.raw_sha256, transport_bound_files: V77_TRANSPORT_DEPENDENCIES.length,
  verification, historical_frozen_integrity: { path: preservedPath, checks: preservation.checks, distinct_paths: preservation.distinct_paths, mismatches: [] },
  lifetime: costs, provider_states: requests, native_v77_requests: 0,
  v77_lease_present: existsSync('data/question-factory-runtime/v77-qualification-owner.json'),
  real_v77_study_directory_present: existsSync(`${base}/v77-qualification`),
  pricing: { expires_at: prices.expires_at, currently_valid: Date.parse(prices.expires_at)>Date.now(), sha256: sha('data/pipeline-prices.json') },
  native_study_cap_usd: 4, conservative_41_case_bound_usd: 6.944375,
  offline_sizing: { path: `${execution}/v77-offline-regression-sizing-v1.json`, sha256: sha(`${execution}/v77-offline-regression-sizing-v1.json`),
    synthetic_matrix_limitations: true },
  changed_files: changed.map(path=>({path,sha256:sha(path)})), pilot_executed: false, live_current_profile_staging_executed: false,
  production_writes: 0, further_paid_study_authorization: 'pending single asynchronous user question; none received',
  remaining: [
    'Do not start another paid benchmark without the pending scope answer: the owner instructed Qualify once and the failed V76 preregistration prohibits further paid studies.',
    'If authorized, use both exact freezes and construct genuinely fresh cases and independent keys/labels AFTER the transport freeze; preregister all fixed cases and full retry-inclusive costs before dispatch.',
    'Four dollars remains a persistent stop cap, below the conservative 6.944375 dollar bound for41 cases; budget-stopped cases remain pending in the denominator. No discount or uncertain usage is assumed free.',
    'Only a genuine current-version qualification pass permits the40-candidate pilot. Its3USD stop cap is below12.424320USD retry/repair-inclusive maximum, and English matching has only one unused target.',
    'Current-profile staging restart, idempotency, complete passage-group atomicity, student retrieval and dispute invalidation remain unproven. Production publication/deployment/migration still require final explicit approval.',
    'All37 historical uncertain records are retained, including the0.008596USD V75 Anthropic request without a recoverable remoteID.'
  ] };
writeFileSync(`${execution}/root-checkpoint-v77-runner-complete.json`, JSON.stringify(checkpoint,null,2)+'\n', {flag:'wx'});
const summary = `# V7.7 prospective runner verified; generator still unqualified\n\n`+
  `V7.6 remains failed: all 41 cases are terminal, all 118 native receipts settled for $0.649980, with one registered regression false accept. The original labels, inspected cases, source evidence and outcomes remain unchanged. V7.7 has no native qualification, pilot or live staging evidence.\n\n`+
  `The local runner and its 51 transitive dependencies are now frozen separately from the already frozen V7.7 core. Its registration binds both study payloads/custody, code, 13 prior frozen sets, source registry and pricing. Independent review reproduced and corrected missing prior-case coverage, a contested-defect denominator exclusion, Flex fallback behavior, ledger/database interface wiring and terminal-error recovery. Native requests remain disabled pending explicit scope authorization. Receipt-only replay preserves old errors and prevents new reservations or requests. The final crash-boundary test uses the frozen native transport and a temporary SQLite ledger to recover a completed response without a cache entry, with zero fetches or new reservations. Full registered V77 CLI recovery has not run because no V77 studies exist.\n\n`+
  `Root verification: factory ${verification.factory.pass}/${verification.factory.pass}, focused runner ${verification.focused.pass}/${verification.focused.pass}, and ${preservation.checks} historical hash bindings across ${preservation.distinct_paths} paths intact. Previously verified recovery 40/40, question/payment/student budget 38/38, payment/entitlements 40/40 and the unchanged 67-page application build remain applicable; this milestone changes pipeline helpers only.\n\n`+
  `All 41 already inspected sizing specimens are covered. The 13 regression specimens include saved V7.6 judgments and synthetic V7.7 clause matrices; the maximum measured regression body is 36,978 UTF-8 bytes. These are sizing checks, not semantic qualification. All future final bodies must pass the 50,000-byte runtime guard. At registered standard maximum rates, first requests plus a full-input/doubled-output retry on every stage bound 41 cases at $6.944375. The proposed $4 cap can stop the study incomplete. No Flex or Batch discount is assumed.\n\n`+
  `Read-only lifetime accounting at ${at}: $${costs.settled_usd.toFixed(6)} settled plus $${costs.held_usd.toFixed(6)} held, $${costs.remaining_usd.toFixed(6)} remaining under $50. All ${costs.unresolved} uncertain records are preserved; V7.7 has zero provider requests.\n\n`+
  `The pending scope answer is the next dependency. Your instruction says “Qualify once”; the failed V7.6 preregistration also stops further paid studies after failure. No additional paid benchmark will run without that clarification. If authorized, new source/key custody must follow both freezes, with the fixed denominator and conservative stop-budget outcome preregistered. Pilot and live staging remain conditional on genuine qualification. Production publication, deployment and migration still need final explicit approval.\n\n`+
  `Evidence: root-checkpoint-v77-runner-complete.json, ${verification.factory.path}, ${verification.focused.path}, ${preservedPath}, V77-RUNNER-FINAL-INDEPENDENT-REVIEW.md, v77-offline-regression-sizing-v1.json and ../v77-local-transport-freeze.json.\n`;
writeFileSync(`${execution}/V77-RUNNER-VERIFICATION-RESULT.md`, summary, {flag:'wx'});
const milestone = `\n\n## 9 October 2026 IST — V77 prospective runner verified; paid scope still pending\n\n`+
  `The additive V77 runner is locally frozen across ${V77_TRANSPORT_DEPENDENCIES.length} transitive dependencies. Core raw freeze ${core.raw_sha256}; transport raw freeze ${transport.raw_sha256}. V76 qualification remains failed and frozen; V77 is unqualified with zero native provider requests, no pilot, no live staging and no production writes.\n\n`+
  `Independent local counterexamples corrected omitted V73/V74 case history, contested-defect exclusion, missing code bindings, Flex fallback, ledger/database callback wiring and terminal-error recovery. Exact fresh/regression custody and case-level review must follow both freezes. Registration binds both fixed studies, all 13 prior frozen sets, code, source registry, prices and explicit scope authorization. Accepted/unknown keys never resubmit; receipt-only replay can consume later-complete saved responses while preserving original errors and forbidding new reservations/requests. Budget or unfinished outcomes remain pending, not academic rejections.\n\n`+
  `Root factory ${verification.factory.pass}/${verification.factory.pass}; focused runner ${verification.focused.pass}/${verification.focused.pass}; ${preservation.checks} protected hash bindings/${preservation.distinct_paths} paths intact. Earlier recovery 40/40, question/payment/student budget 38/38, payment/entitlements 40/40 and unchanged app build 67 pages remain verified. Changed runtime files: ${changed.join(', ')}. Current lifetime $${costs.settled_usd.toFixed(6)} settled + $${costs.held_usd.toFixed(6)} held; $${costs.remaining_usd.toFixed(6)} left under $50; ${costs.unresolved} uncertain records preserved.\n\n`+
  `Offline sizing now covers all 41 consumed specimens; 13 regression bodies used saved V76 judgments and synthetic V77 matrices, maximum 36,978 bytes. Future actual full matrices still need the 50,000-byte guard. Conservative 41-case bound $6.944375 includes full repeated input and doubled output for one retry at every stage. Four dollars is a stop cap, not a completion promise; no discounts presumed. Pilot $3 remains below $12.424320 maximum; English matching has one unused target.\n\n`+
  `Next dependency: the single async question about authorizing one further $4 V77 study is unanswered. Do not dispatch. If authorized, construct genuinely fresh source/key custody after both freezes and preregister the fixed four-subject benchmark/costs. Only a passing qualification enables a 40-candidate pilot under that exact version and current-profile staging restart/idempotency/atomic passages/retrieval/dispute tests. Production still needs final explicit approval. Goal remains active and unfinished. Checkpoint: execution/root-checkpoint-v77-runner-complete.json; current result: execution/V77-RUNNER-VERIFICATION-RESULT.md.\n`;
appendFileSync('docs/brain/STATUS.md', milestone);
appendFileSync('docs/brain/QUALITY.md', `\n\n## 9 October 2026 IST — prospective V77 execution safeguards\n\nV77 remains unqualified. Its local runner is frozen after independent counterexamples and ${verification.factory.pass} passing factory checks. Fresh/contested/boolean labels cannot be excluded from fixed-denominator release accounting; complete academic outcomes and settled receipts are separate requirements. Inspected sizing specimens are regression evidence only. See STATUS's latest V77 milestone and execution/V77-RUNNER-VERIFICATION-RESULT.md for current hashes, costs and exact blockers.\n`);
appendFileSync('docs/brain/README.md', `\n\nCurrent generator execution milestone (9 October2026 IST): see STATUS's latest V77 prospective-runner entry and artifacts/question-factory/cuet-readiness-2026-10-09/execution/V77-RUNNER-VERIFICATION-RESULT.md. V76 failed, V77 locally frozen/unqualified; further paid qualification awaits the single scope answer.\n`);
console.log(JSON.stringify({checkpoint_saved:true,brain_appended:true,verification,lifetime:costs,qualified:false,native_v77_requests:0}));
