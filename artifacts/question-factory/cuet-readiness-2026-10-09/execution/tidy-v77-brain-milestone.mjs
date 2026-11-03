import { readFileSync, writeFileSync } from 'node:fs';
const path = 'docs/brain/STATUS.md';
const text = readFileSync(path, 'utf8');
const marker = '## 9 October 2026 IST — local V77 correction verified; qualification still failed';
const start = text.lastIndexOf(marker);
if (start < 0 || !text.slice(start).includes('Goalactive,unachieved.')) throw Error('expected_current_entry_missing');
writeFileSync('artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-brain-entry-original.md', text.slice(start), { flag: 'wx' });
const entry = `${marker}

V76 qualification remains failed and unchanged: 41 terminal cases, 118 receipts settled for $0.649980, and no new hold. The five additive V77 modules are prospectively frozen at 614d423f795314c7661e952ca1f1bf41258b005586744172dd8ec3b32021ecd1. There is no released V77 profile, native qualification runner or publication authorization.

Both independent blind evaluations now provide whole-option/clause coverage with trusted source premises. The existing Luna explanation audit also checks both frozen matrices and all explanation claims, adding no fourth call or model comparison. Identity/mock checks cover cache hits and precede fresh stage-cache writes. Independent counterexamples and earlier drafts are retained. Stem-only arithmetic and a proved false conjunction with an accurately unresolved nondecisive clause are permitted; selected answers still require complete support and every nonchosen full option a decisive exclusion. Category attribution and source silence cannot establish falsehood. Entailment remains a fallible model judgment. These are local regression checks, not fresh qualification.

Root factory tests 696/696; focused tests 14/14; independent cached restart 1/1 with no extra callbacks. Prior recovery 40/40, question/payment/student budgets 38/38, explicit payment/entitlements 40/40, and the unchanged 67-page app build passed. All 228 frozen hash bindings across 61 paths match; the registered source-registry hash also matches. V75/V76 evidence, code, base prices and historical artifacts are preserved.

Offline preflight captured 84 bodies from 28 consumed V76 specimens: maximum 32,817 UTF-8 bytes under a local 50,000-byte reserve. Synthetic matrices/minimal cached solver fields do not guarantee future real payload fit. At registered rates, including one full-input/doubled-output billed retry per request, the 28-case bound is $4.742500; 41 cases at the same caps would be $6.944375. A $4 stop cap would not guarantee completion. No discounts were assumed and base prices are unchanged.

Read-only lifetime: $35.127518 settled plus $0.507892 held, leaving $14.364590 under the $50 ceiling. There are 13,925 reservations and 37 uncertain records, all preserved. V76 has 118 complete provider requests; V75 has 99/100 complete plus the $0.008596 unknown Anthropic hold. No active factory worker/qualification lease, V77 native calls, pilot, live current-profile staging or production writes.

Evidence: execution/V77-LOCAL-CORRECTION-RESULT.md, root-checkpoint-v77-local-complete.json, v77-independent-semantic-audit-review.md, v77-offline-budget-preflight-v1.json and v77-source-registry-integrity.json.

Exact next step: the asynchronous scope question asks whether the owner's “Qualify once” instruction permits one further paid V77 study with a $4 stop cap. No permission has yet been received. Do not dispatch while pending. Any authorized future study must preserve this freeze, establish genuinely fresh source/key custody before evaluation, preregister a fixed denominator and retry-inclusive persistent budget, and retain every outcome. The 41 inspected V76 cases remain regression evidence. Only a genuine qualification pass permits the 40-candidate pilot and live staging proof. English matching has one unused target; the pilot's $3 stop cap is below its $12.424320 theoretical retry/repair-inclusive bound. Current-profile staging restart, idempotency, complete passage-group atomicity, retrieval and dispute invalidation remain unproven. Production publication, deployment and migration still require final explicit approval. Goal active and unachieved.
`;
writeFileSync(path, text.slice(0, start) + entry);
console.log(JSON.stringify({ path, prior_entry_preserved: true, goal_status: 'active', paid_scope: 'pending user clarification' }));
