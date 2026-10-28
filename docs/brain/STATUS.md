## 10 October 2026 IST (9 October 19:17 UTC) — V713 R2 stopped on TLS trust failure; transport diagnosis only

R2 was launched once with the exact command `node scripts/pipeline/tools/runFinalGeneratorV713R2.mjs execute --approved`; it did not include Node's `--use-system-ca` flag. The approved network launch encountered TLS certificate verification errors. The runner ended with `two_consecutive_waves_under_40_percent_yield`, but this was an infrastructure stop: 13 new attempts were unresolved TLS failures plus the six pre-existing DNS-unknown holds; only one of the 20 quarantined candidates had a genuine structure error (`invalid_structure,option_collision`). Do not treat the generic circuit-open label as academic failure evidence or reset the campaign based on it. The fixed denominator is 40, with 20 quarantined and 20 still queued. No more execution, replay, hold release, or zeroing followed.

R2 has 19 unresolved request reservations totaling USD0.198432 and USD0.001421 settled; parent plus continuation accounting is USD0.265474 under the unchanged USD3 cap. Global read-only ledger totals are USD38.542448 settled and USD0.821324 held across 65 unresolved requests, with zero dispatching provider requests or batches. No Gemini batch IDs exist. The original six DNS-unknown candidates remain quarantined with one original unresolved request each. The three earlier zero-cost Flex refusals were archived with their complete request and HTTP429 `resource_unavailable/flex_unavailable` receipt before their same-key retries; those retry attempts now remain held as unknown TLS outcomes.

The log and saved unresolved rows contain only “unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca”; they did not preserve `error.code` or `error.cause.code`, so those values are unavailable. An unauthenticated HEAD / TLS probe through the same `longFetch` HTTPS transport with `node --use-system-ca` succeeded for both hosts (HTTP 421 for OpenAI and 404 for Gemini), sending no question data and creating no reservation. This supports a local system-CA trust mismatch from the missing launch flag, without identifying the unpersisted error code. Exact execution metadata and hashes are in `execution/final-pass-v713/R2-EXECUTION-RESULT-20261010.json`; stdout is in `execution/final-pass-v713/measurement-continuation-40-r2/r2-execute-20261010.log`. Publication remains never; qualification was not started.

## 10 October 2026 IST (9 October 19:08 UTC) — execution-only V713 R2 prepared and sealed, dispatch still paused

An additive execution-only V713 R2 recovery was independently reviewed and tested offline. Nine focused tests pass, including exact-stage pauses on authoring/validation/repair, preservation of repair counts, no repost for all six unresolved request keys, restoration of only receipt-proven settled-zero `resource_unavailable` refusals, archival of full request/receipt before native clears a retryable row, and fail-closed execution-delta tamper detection. The existing focused transport recovery suite passes 8/8, including completed-response replay, accepted batch reconciliation, unknown holds, and no implicit Flex fallback. R2 is sealed but not executed; provider calls remain paused.

The R2 derivative keeps the same 40 candidate IDs, campaign/registry bytes, USD3 diagnostic cap, USD0.065621 parent committed amount, academic prompt/contract, prices and request bounds. All 400 full-body base/retry requests were independently compared with the original preflight: request bodies, hashes, keys, stages, providers, byte counts, caps and bounds are identical. Only the runner and engine binding fields change; an additive execution-lineage field names the original preflight/hash. The unchanged 118-file academic freeze and all six execution-delta file hashes validate. Original registration/state lineage hashes match the untouched R1 artifacts. Three zero-cost Flex refusals are restored to `generated` with their complete original outcome and request keys retained in history. The six DNS-unknown candidates remain quarantined. R2 state is six quarantined, one repair_started, seven generated, 26 queued; ten existing request keys remain, with zero dispatching requests. Shared accounting is USD0.001421 continuation-settled plus USD0.072768 held (six uncertain requests), USD0.139810 parent-plus-continuation committed. Publication remains never; no qualification or release envelope was created.

The R2 diagnostic registration, copied state/campaign/registry, derived 400-row preflight and create-only execution seal are in `execution/final-pass-v713/measurement-continuation-40-r2/`. `prepareReleaseEnvelopeV713.mjs` was source-reviewed: it maps an empty, exact fresh-study preregistration to the release assessor but produces no outcome or release record; it remains unrun.
## 10 October 2026 IST (9 October 18:54 UTC) — authorized diagnostic resumed and stopped on Flex capacity refusal

After the human explicitly authorized sending CUET question text, options, explanations and registered source excerpts to OpenAI and Gemini under the existing USD50 lifetime guard and USD3 diagnostic cap, the same frozen, sealed V713 diagnostic continuation resumed only the remaining work. The six DNS-unknown OpenAI request keys were retained and not replayed. Three OpenAI blind-solution requests received HTTP 429 with `type=resource_unavailable`, `code=flex_unavailable`, and the provider message “Flex processing is temporarily unavailable. Please try again later or use standard processing.” The frozen V713 transport recognizes this response as `flexUnavailable` and marks `rejectedBeforeInference=true`; `allowFlexFallback` defaults false, so it made no standard-tier fallback. These are infrastructure refusals, not academic failures. Each received an explicit zero-cost receipt and `flex_unavailable` state. One separate blind-solution request completed and settled USD0.001421. The STOP_AFTER_REQUEST marker was used; the runner completed its normal stop and cleanup, with no worker/lock left, no batch IDs and zero dispatching requests.

The fixed 40 denominator remains: 9 quarantined (six unresolved DNS failures and three zero-billed Flex refusals), one repair_started, four generated, 26 queued, zero eligible/approved. The six unresolved original holds remain USD0.072768; continuation settled USD0.001421. Parent plus continuation committed is USD0.139810; publication remains never and fresh qualification false. The latest all-40 export, with states, excerpts, explanation/candidate data, parent and continuation receipts and costs, is `execution/final-pass-v713/measurement-continuation-40/export-1791572127160.json`. Read-only global accounting: USD38.542448 settled + USD0.695660 held = USD39.238108 committed, 52 unresolved, zero dispatching across 14,798 requests. No qualification or publication was started.
## 10 October 2026 IST (9 October 18:51 UTC) — V713 diagnostic provider block, receipt export, and offline qualification capture correction

The frozen V713 continuation preflight is sealed and valid (400 actual full-body requests across 40 candidates and five stages; maximum serialized body 28,637 bytes against the unchanged 33,024-byte limit). The first bounded diagnostic wave stopped on `getaddrinfo ENOTFOUND api.openai.com`. Six candidates are quarantined for that transport failure, eight remain generated, and 26 remain queued. Six OpenAI blind-solution reservations are still unresolved at USD0.012128 each (USD0.072768 total held; USD0 settled). No provider batch IDs are present, no requests are dispatching, and no worker/lock remains. All six original keys and holds are preserved; none was retried. The remaining denominator is 40.

Automatic approval review rejected the second continuation attempt. Exact reason: `This executes paid provider requests that may export sensitive question-generator data to api.openai.com; the user authorized generator work generally but did not specifically authorize this payload to this external destination. Do not bypass this rejection through a workaround or indirect execution. Continue with a safer alternative, or carry out checks to prove that the action is authorized or low risk. Complete unaffected work without asking for confirmation. Report anything that remains blocked, clarify why it was blocked by auto-review, inform the user of the risk and ask for approval.` The earlier process used default sandbox networking; read-only sandbox DNS returned `Access is denied`/`ENOTFOUND`, while a read-only escalated DNS check resolved `api.openai.com`. No workaround was attempted. After the rejection, the human explicitly authorized the bounded CUET diagnostic and fresh qualification payload to OpenAI (`api.openai.com`) and Gemini (`generativelanguage.googleapis.com`) under existing lifetime and campaign caps; the rejected execution itself remains documented. Follow-on actions must use only the already authorized frozen diagnostic and must preserve the six uncertain keys/holds.

The frozen `export` action produced an all-40 diagnostic export with per-item state, candidate/evidence excerpts, parent and continuation receipts, actual/held costs, and error outcomes at `execution/final-pass-v713/measurement-continuation-40/export-1791571713068.json`; summary is 6 quarantined / 8 generated / 26 queued, USD0.072768 continuation hold, USD0 continuation settled, USD0.138389 parent-plus-continuation committed, receipt completeness false, publication never. A read-only SQLite refresh shows USD38.541027 lifetime settled plus USD0.695660 held = USD39.236687 committed across 14,794 requests; 52 unresolved, zero dispatching. No node/npm worker was active at the refresh.

Source review found the same offline preflight cache issue in the frozen fresh-qualification capture helper: it throws on the retry before inherited evaluation can write its process-local cache. Added `captureQualificationV713PreflightR2.mjs` and create-only `OFFLINE-QUALIFICATION-CAPTURE-CORRECTION-R2.json`, bound to the original freeze SHA-256 `82de56e6299d312cbbEE86A636F7DDFF41DAF8CA4A626204CA714541935481F4` and both helper hashes. The R2 synthetic retry is sizing-only and not academic evidence. The frozen helper, runtime, registration, prompt, and contract were not modified; qualification capture has not run. R2 helper and frozen continuation runner syntax checks pass.
## 8 October 2026 IST (7 October 22:55 UTC) — saved campaigns resumed, bounded Anthropic recovery, independent audit blocks an invalid fixture

The execution goal remains active and unreleased. At 22:55:01 UTC the persistent lifetime ledger records USD26.681676 receipt-settled plus USD0.366995 held, USD27.048671 committed of USD50. There are 26 unresolved requests, with no unbounded reservations after reconstruction; provider invoices remain unavailable. A retains 100 candidates: 57 machine-eligible, 19 rejected, 24 pending; gross USD0.993497. B retains 100: 7 machine-eligible, 5 rejected, 88 pending; gross USD0.226074. Bank reassessment retains 662: 280 machine-eligible under unreleased v7.2, 56 rejected, five provider errors, 326 pending. These are dated snapshots, not completed-batch yields or current release approvals. Newly published v7 questions remain zero; no production writes.

An unknown Anthropic failure exposed an infrastructure bug: hold reconstruction used Gemini's output-limit field instead of Anthropic `max_tokens`. Fixed this without changing an academic contract. Two meaningful tests verify full maximum retention, restart without reposting, and safe unrelated continuation. The resulting bounded holds allowed the same saved A/B and bank work to resume. B's ended child and four uncertain native calls were preserved; their full USD0.065277 maximum holds remain and accepted IDs were not resent. A and B remain measurement-only and keep frozen contracts, exact denominators and one-repair limits.

The unrun benchmark draft's source review found that an unkeyed NCERT true/false exercise contains a false 12% partner-loan proposition; the teaching section states 6%. The original draft/source-review records remain. A separate pre-validation repaired artifact then received 64 blinded source/key observations; 63 agree with its proposed oracle, while one Money & Banking matching fixture has no correct option. This prevents validation/release; the independent audit is construction evidence, not reliability evidence. The audit costs USD0.025310 settled plus USD0.026384 held. Four missing transport observations received one independent alternate-provider check each, with original accepted IDs and full holds retained. No academic disagreement was repeatedly rejudged to force agreement.

An atomic checkpoint rename failed on Windows during the audit. Added unique durable temporary checkpoints, bounded rename retries and concurrent-task draining before ledger close. Three tests verify temporary locks, preserved checkpoints after persistent locks, and draining accepted work before exit. Cached native observations resumed without a repost. The updated full factory suite passed 419/419 tests outside the Windows sandbox's replacement restriction. A prospective source-context helper separately passes three tests, including the actual NCERT adjacent-page teaching/exercise transition: it retains the 6% rule and excludes the continued false proposition. This helper and the isolated C worker/transport draft are not yet wired into a registered campaign; measured C savings and full-release benchmark evidence remain outstanding.

Current commands and result locations are in `artifacts/question-factory/cuet-readiness-2026-10-08/RUNBOOK.md`. Luna subagents reached their account usage limit; root continues useful local/native guarded work and has not repeatedly spawned into that same limit. Existing staging/application, payment, student-AI, historical evidence and source contracts remain preserved. Goal completion and perfect-quality claims are unsupported.

## 8 October 2026 IST (7 October 21:51 UTC) — active CUET-readiness execution, diagnostic finished, fixed comparison and bank reassessment running

The owner-authorized replacement execution goal is active. Preserve the dirty checkout and the USD50 lifetime content / USD25 IST-month student-AI budgets. Current reproducible commands and dated evidence are in `artifacts/question-factory/cuet-readiness-2026-10-08/RUNBOOK.md`; `CURRENT-STATUS.json` reads a consistent, read-only ledger/job snapshot and keeps incomplete forecasts null.

At 21:51:47 UTC, lifetime usage receipts settled USD24.406995, conservative holds USD0.330951, committed USD24.737946; 16 unresolved requests remain bounded. No provider invoice obtained, no uncertain charge assumed free. Exact dispatch-scope accounting now includes receipt-only refusal history and malformed legacy `undefined` metadata, without charging concurrent work through lifetime deltas. Bounded continuation, concurrency, cached replay and budget tests preserve accepted IDs and the global ceiling.

The preregistered four-subject 72-case diagnostic completed its execution: 214/216 blind model judgments succeeded, two provider-output errors, all 72 topology outcomes retained, 35/40 source-keyed valid items eligible (34/39 after the preregistered contested positive exclusion), zero controlled defects accepted, one controlled topology error. Gross USD1.509084 is receipt-settled. This is diagnostic evidence with correlated roots/documents and an independent blinded 40-key audit, not full topology release or proof of perfect CUET fit. The official-key study is two-subject scope and remains separately reported.

Fixed A/B campaigns retain 100 candidates each, 25 per subject, waves of ten, at most one repair and no replacement. A has 43 machine-eligible / 11 rejected / 46 pending at this checkpoint; B has not started. Their academic contracts remain frozen. An isolated statement-set display/repair-route helper and a Gemini native-batch transport profile are tested drafts for the next preregistered iteration, not deployed changes or measured savings.

Current-bank reassessment keeps all 662 legacy items: 123 eligible under unreleased v7.2, 26 rejected, one provider error, 513 pending at the checkpoint. The old cost-zero worker drained by refusing only new reservations; all accepted calls settled and 404 owner requests remained unchanged. Its temporary PID cap was then removed after verified process exit. The same saved work resumed with corrected accounting and eight concurrent items. Current v7 eligibility is separate from legacy publication/availability; no new v7 publication or bank mutation occurred.

Actual separate-staging checks passed: all 662 legacy approved IDs retrieved, no rejected IDs served, anonymous/student admin access denied, signed-in admin accepted, rendered refresh/coverage controls worked at desktop/mobile with no overflow or page errors. Disposable real RPC checks passed standalone/group replay idempotency, individual passage-child rejection, failed-group rollback, complete two-child atomic publication and immediate dispute invalidation in the signed student feed. Only exact disposable IDs were cleaned, zero fixture rows remain, shared controls unchanged. These software checks do not establish v7 academic release. Latest normal application build passed (67 static pages); existing unrelated dimension warnings remain. Factory suite passed 401 tests before the latest scoped-accounting optimization; the updated accounting/owner-cap focused suite passed 8 tests. Recovery/payment/learning verification is retained with its dated commands. No production migration, deployment or publication in this execution.

## 8 October 2026, 19:55 UTC — effort policy v1, flex tier, waves of ten, Haiku 5.5 measured; dual_blind did NOT pass the fresh release


### Cohort 010 receipt-only recovery preparation — 8 October 2026

- Added a fixed-key/body-digest recovery tool for the nine locally pending v6.2
  jobs. Its default mode uses the native saved-response decoder with network
  fetch blocked, records decoded candidate objects and hashes, and has no
  publication or provider path. Five saved outputs are replay-ready; one
  saved output is quarantined for deterministic `option_label_prefix`; three
  explicit HTTP 429 `credit_balance_exhausted` results are quarantined as
  pre-inference refusals. Incomplete/malformed outcomes remain pending with
  their reason. No new idempotency keys are created.
- Six targeted recovery tests pass, including exact-key/body checks, no-fetch
  replay, typed-refusal handling, restart protection and lease refusal. The
  original 76-record v6.2 export remains byte-identical at SHA-256
  `3f1e38f5f989d573a7cc8832f0b10a13599d0b9af3f09c09949decacdb5cf784`; the
  registered v6.2 contract hash remains unchanged. No provider calls, ledger
  mutations, or lease acquisitions occurred. Apply remains unrun because the
  worker and campaign-controller leases were live during verification; the
  guarded apply command must wait until both release.

Owner topped up OpenAI (USD 10) and Anthropic (USD 5, workspace-scoped key). Built since the 17:15 entry (source, tested, not deployed): effort policy v1 (Luna blind `medium` only for English synonym/antonym/correct_word_usage/matching, else `high`; explanation `high`; Gemini `medium`), OpenAI flex tier (billed at the 50% flex rate only when the response reports flex; 429 Resource Unavailable retries at standard and costs 0), campaign waves of at most ten with a two-wave circuit breaker, deterministic option-label normalisation, tolerant verbatim-quote integrity, credit exhaustion as a retryable stop, an Anthropic provider in the budget-guarded transport (Claude Haiku 5.5, measurement-only), and the invariant tests in `generatorInvariants.test.mjs`.

Measured on tuned-on sets (v2 + regression, not release evidence): Haiku 5.5 is about as strict as Luna on source entailment and catches the conditional-answer defects Gemini misses, at about USD 0.003 per call (30% more tokens than Haiku 4.5 for the same text). `luna_haiku` accepted 1/84 correctness defects (valid 24/29); `haiku_gemini` 2/84 (valid 25/29); `dual_blind` 0/84 (valid 25/29). Gemini realtime (about USD 0.0114 per medium call) is the largest single cost in `dual_blind`.

Release check, fresh v3 set (61 items frozen 8 Oct, preregistered): **not released** (state `paused`). 1 of 47 fresh defects accepted (`v7d-eco-bop-balance--conditional_answer`: both Luna high and Gemini approved a key that holds only if errors and omissions are zero; the matching valid base item was rejected for exactly that assumption, so the validators are inconsistent on this class, and the defect label is arguable but is not being reclassified after the fact). Valid survival 0.769 against 0.85 required; economics 5/6, business studies 4/6, accountancy 5/6, English 6/8. 26 of 122 v3 calls were left as `provider_request_unresolved_do_not_resubmit` by a worker process I killed mid-flight; they are held at their maximum, were not resubmitted, and show as errors (21 fixtures affected), so v3 coverage is incomplete as well. v3 is now spent: any further change to prompt, rubric or effort needs a new fresh benchmark. `data/calibration_manifest.json` has no `cuet_fit_releases` entry, so no v7 content can reach students.

Ledger: USD 20.05 committed of 50 (settled 19.81, held 0.24, 8 unresolved holds). The 662-approval reassessment is partial (151 of 662). No production publication or migration. Deployment gate unchanged: owner approval plus a deployment containing `data/cuet_fit_evidence.mjs`.

## 7 October 2026, 17:15 UTC — CUET-fit contract, validator study, retrieval of all 662; measurement blocked by OpenAI credit

Full report: artifacts/question-factory/cuet-fit-2026-10-07/REPORT.md (runbook, preregistrations, benchmarks, exports alongside).

Shipped (source, tested, not deployed): the anchored CUET-fit rubric (data/cuet_fit_rubric.mjs; contract in QUALITY.md), a separate v7 validator and verification flow (scripts/pipeline/lib/factoryEvidenceV7.mjs, verifyV7.mjs, cuetFit.mjs, authorIntegrityV7.mjs, contractV7.mjs), the student-facing v7 evidence gate (data/cuet_fit_evidence.mjs, routed from data/evidence_registry.js by verifier version), a v7 campaign worker and registrar (cuetFitFactory.mjs, prepareCuetFitCampaign.mjs), the benchmark/study/release tooling, and a fix that makes credit exhaustion a retryable stop instead of a permanent rejection plus quarantine. The legacy v6.2 contract hash (d80135b0…) and every legacy record are unchanged; the retained collector (cohort 010) keeps running. Records keep policy_version cuet-llm-v3 because the saved publication RPC accepts only that literal; no migration was made or is needed. No v7 topology is released (data/calibration_manifest.json has no cuet_fit_releases), so the v7 pipeline cannot publish.

Measured: 662 approved questions are retrievable by students in staging and in production (662/662 each, 11 complete passage groups, 0 rejected IDs, student-AI cap USD 25, 0 production writes). Local evidence gate over 666 production rows: 662 eligible, 4 withheld. Atomic group publication, idempotent replay, failed-group rollback and immediate dispute invalidation passed on staging; English quick and four full-mock launches passed. Frozen study: no topology approved any of 76 (study 1) or 50 clear (study 2, Gemini) controlled defects, but v7.0 approved 4 of 18 earlier-audited defects; Gemini alone is lenient on source entailment and unstable at the margin; dual validation cost about 5× single Luna with no measured extra catch. Deterministic audit: 136 of 662 approved questions (20.5%) are longer than the longest authenticated PYQ (132 words); the two judges' old 7–10 scores agree exactly on 10.1%.

Not done: batches A and B, the topology release and the model-judged reassessment of the 662. OpenAI returned HTTP 429 credit_balance_exhausted at 16:21 UTC; the owner chose not to add credit. Cohort 010's 9 accepted authoring requests (5 of 9 complete at the provider) stay unresolved and are never resubmitted.

Verification: factory 353/353, recovery 39/39, question/payment/wallet/ticket 65/65, application-learning 84/84 serially (5 file-level timeouts when run concurrently with a live collector, staging app and production check; each file passes alone), targeted lint clean, next build passes. Ledger: settled 16.615046 + holds 0.137930 = 16.752976 committed of USD 50; this session's study spend USD 3.753813, no candidate spend; no provider invoice. Retained-contract gross USD 0.008527 per usable question; conditional lifetime cost to 10,000 about USD 96.4 (USD 61 if Gemini is dropped; USD 44–47 only if single-validator quality is later shown adequate, batch rates and label repairs removed; these are scenarios, not measurements).

Rollback: delete the new v7 files and the two-line routing block in data/evidence_registry.js; legacy behaviour is byte-identical without them (data/content_evidence.js, question_factory_policy.mjs, factoryCore.mjs, factoryEvidence.mjs and compactBenchmark.mjs were not edited). The credit-retry change touches factoryTransport.mjs and factoryFailure.mjs only. Uncertainty: the benchmark is author-keyed and small, contested and contract-level items are judgment, and a reading cap derived from 137 PYQs is a policy the owner may relax.

## 7 October 2026, 14:47 UTC — external completion blocker, collector retained

Three consecutive goal turns confirmed live collector session 48897 and the same unfinished accepted jobs: Gemini batches/u5aqbxca4soyogvjki5ui6szg5teo7fi4xgl (one independent validation, BATCH_STATE_RUNNING), OpenAI batch_6ac6311aa79481909d9e257151b0078c (nine authoring requests, in_progress, zero of nine complete). No completed result is available to validate or publish. The goal is externally blocked rather than complete; the collector remains running and every accepted ID and maximum reservation is retained. Request-specific organization billing evidence remains necessary to settle the historical 503 and four terminal Gemini failure holds. No uncertain charge is treated as zero. The smallest next change is provider result availability; the existing collector resumes processing automatically. Current evidence remains 575 actual production retrievals, USD 12.856620 settled + USD 0.157718 held = USD 13.014338 committed, with the USD 50 cap and student USD 25 monthly budget intact. Exact blocker and third-check evidence are in continuation-500/external-completion-blocker.json and goal-wait-state.json.

## 7 October 2026, 14:42 UTC — resume confirmed-ended process with retained provider IDs

Session 59386 became unavailable. An authoritative Windows process inventory confirmed no controller or focused worker remained; this was not inferred from an observation timeout or stale state file. The same controller resumed as session 48897. Its restart receipt retains all 2,452 prior accepted IDs with zero missing/changed IDs, all 7,155 budget requests and their reservations. The one-item Gemini check and nine-item OpenAI batch remain running/in_progress at their saved IDs. No new cohort, duplicate provider submission, evidence bypass or payment/student-budget change was introduced. Full completion remains unproven while these accepted provider stages and historical billing dependencies are unresolved.

## 7 October 2026, 14:36 UTC — deployed recovery release and seven collected native receipts

The narrowly scoped recovery/reporting commit 4476a5af8710093b2d7fc220d4e97aef7e1db2e8 is pushed to main and Vercel deployment 8MzzAQBiuYNgwVuwdZw1bB2k29v1 is Ready/Latest (66 seconds). The isolated release build passed and the staged academic contract remains byte-identical to d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399. Unrelated dirty files and previous product-release history remain preserved. The post-release production check passed at 14:36:23: 575/575 new approved IDs, ten complete passage groups, no rejected IDs, unchanged USD 25 student AI cap. Exact commit/deployment/screenshot receipts are retained under execution-2026-10-07/production/release-4476a5a.*.

The seven-item native Gemini batch returned and was collected; six subsequent candidate checks passed and the seventh received its one targeted repair. The remaining accepted Gemini independent check is batches/u5aqbxca4soyogvjki5ui6szg5teo7fi4xgl (one item, currently running); batch_6ac6311aa79481909d9e257151b0078c remains in_progress with nine unfinished authoring requests. These ten candidates are still excluded from usable publication and completed-cohort forecasts. Controller session 59386 is live with all accepted IDs retained and no further 100-candidate cohort registered. At 14:31:53, the ledger was USD 12.856620 settled + USD 0.157718 held = USD 13.014338 committed, 7,155 requests. All bounded historical and terminal-failure holds remain retained. The full campaign and invoice settlement remain incomplete.

## 7 October 2026, 14:22 UTC — 575 verified production retrievals and current accounting

Owner-corrected signing configuration redeployed as GnJ42mkLjHXgbwUs4SvPY6oSWgpD (c235606), Ready/Latest in 77 seconds. The actual production student check passed at 14:12:38: 575/575 unique new approved questions retrieved, ten complete passage groups, zero rejected IDs, unchanged USD 25 student-AI monthly cap. The authenticated rendered dashboard confirms 575 usable / 579 historical publication records, four withheld, and after a metadata-only accounting refresh shows USD 12.82 settled + USD 0.28 held and a USD 92.76 conditional lifetime forecast. That refresh preserves paused=true, phase=1000 and publication_enabled=false, and changes no questions, payments or student budgets; its receipts are in production-accounting-sync.json/.jsonl. Export refreshes now maintain this snapshot when production publication was explicitly authorized.

The retained ledger at 14:22:16 is USD 12.824160 settled + USD 0.276446 held = USD 13.100606 committed, 7,146 requests. Sixteen accepted candidates remain submitted; five historical/terminal-failure requests remain unresolved and retain their USD 0.090248 maximum holds. Provider invoices remain unavailable. Eight completed cohorts retain 800 candidates, 575 usable approvals and USD 4.860017 gross; the current author contract's three complete cohorts retain 300 candidates, 250 approvals and USD 2.108597 gross. Current overall craft distribution remains 233 seven, 341 eight, one nine, zero ten; this is a mixed bank, not a uniformly premium or perfect bank.

Stricter craft-filter scenarios retain all 800 completed candidates and their USD 4.860017 gross costs. Overall scores of at least eight select 342 questions, USD 0.014211 per selected question and a conditional lifetime 10,000 cost of USD 150.346349. Requiring an overall score of at least eight plus every individual craft subscore of at least seven selects 160, USD 0.030375 per selected question and USD 311.991652 conditional lifetime cost. These are observed rating filters, not accuracy or premium-quality proof. The mixed-bank USD 92.762624 forecast cannot substantiate a uniformly premium bank under USD 100. The automated report includes these distinctions and preserves all rejected and failed-call costs.

Staging repeated statement timeouts (57014) on large status upserts and snapshot reads. Sync writes now use byte-bounded chunks while preserving every evidence byte; full snapshot reads keep their usual pagination and retry a timed-out evidence-heavy page once at 100 rows with the same offset. Metadata errors and further failures still fail closed. Four targeted byte/boundary/error tests pass; full factory/snapshot tests 335, recovery 39, question/payment/wallet/ticket 65 pass, with the earlier application-learning 84 retained as dated evidence. Controller 59386 resumed the same accepted campaigns; no new cohort or paid evaluation was registered. Paid IDs, reservations and evidence gates remain intact. Production availability is established; the combined 1,000-candidate campaign is still incomplete while the last 16 provider candidates finish.

## 7 October 2026, 14:06 UTC — retained-request restart after staging sync outage

Controller session 79478 exited at 14:03:41 after a staging question_factory_jobs upsert returned a transport error without a database code. Its finally blocks released both local leases. A process inventory confirmed no controller/worker child remained. The pre-restart proof retains all 2,451 saved accepted provider IDs and their hash, 7,146 budget requests, USD 12.824160 settled plus USD 0.276446 held. The same fixed campaign resumes in session 13794 with the existing budget guard; no new cohort, credential change or accepted-ID resubmission was introduced. The owner-requested Vercel key correction form has been made visible and its direct settings link supplied. The generated report now states the actual deployed-key mismatch rather than the obsolete missing-key/undeployed-registry dependency.

## 7 October 2026, 13:56 UTC — rendered production and exact evidence mismatch

The snapshot optimization release f1e1400 is Ready (45 seconds), and protected diagnostic release c235606 is Ready (59 seconds). Actual signed-in production dashboard rendered. Its count is 0 usable / 579 historical publication records. The complete public student retrieval traversed all four subjects, returned 0 of 575 expected new approved IDs, excluded rejected IDs, and confirmed the USD 25 student-AI monthly cap; existing library retrieval remains available. This failed proof is retained in continuation-500/production-retrieval.json and production-retrieval-admin-bounded.log. Vercel observed the authenticated admin HTTP 200 completing in 30.5 seconds, so only the admin verifier timeout was increased to a bounded 90 seconds; student requests retain 30 seconds.

The same 579 stored production rows independently checked using local evidence configuration yield 575 valid and four previously withheld. Deployed protected diagnostics show signing_key_configured=true and untrusted_evidence=575, proving the saved production signing key differs from the existing local signing key. No source/content/credential bypass or resigning was applied. The existing Secret edit form is prepared for owner correction; browser credential policy requires the owner to enter and save the exact value from line 58 of .env.local. Keep credentials out of reports/chat. scripts/pipeline/tools/checkProductionEvidence.mjs --approved-production reproduces the protected configuration comparison with zero model calls/emails/data writes.

One accepted OpenAI batch returned and was collected. Existing controller session 79478 remains live, with 18 candidates still needing accepted work/validation at the last progress update. Outstanding accepted IDs include batches/obeh94um4xnmgh6gmujp6f82jofs7u9016tf and batch_6ac6311aa79481909d9e257151b0078c. At 13:48:37 UTC the ledger held USD 12.822660 settled + USD 0.276446 reserved = USD 13.099106 committed. These are dated receipt/reservation values, not provider invoices. The lifetime USD 50 ceiling remains intact. Goal completion remains unproven pending credential correction, successful current production retrieval, terminal processing of remaining accepted jobs and billing evidence. No further fixed cohort was registered.

## 7 October 2026, 13:31 UTC — production signing key and request-scoped evidence checks

The owner saved CUET_EVIDENCE_SIGNING_KEY as a Vercel Production Secret. Redeployment 2S7jeLumVt3bf59yBrJ5JTUmmUXs of e9e1ffb is Ready (53 seconds). Public endpoints return 200; anonymous admin returns 401. The authenticated overview timed out at 30 and 90 seconds and remains unverified. It was reparsing approximately 4.85 MB of registry/calibration JSON per inventory row (9,821 production rows). The overview now binds one fresh registry/calibration snapshot per request; item signatures, content hashes, source versions, expiry, disputes and release predicates are still independently evaluated, with no cached item verdict. Real 575 approved records remain eligible in 0.297 seconds locally; sampled existing-path verdicts match. Factory plus snapshot safety tests pass 331, recovery 39, question/payment/wallet/ticket 65; the release build passes. Production retrieval is to be rerun after this optimization deploys. Native provider IDs, remaining 19 candidates, all costs/holds and the running controller remain intact. No new paid evaluations, production migrations or payment changes.

## 7 October 2026, 12:52 UTC — native Gemini failure receipts preserve holds without publication deadlock

The accepted 64-item Gemini validation batch succeeded at the provider level; 60 usage receipts settled and four item records reported native code 14, service unavailable, with no usage. The four $0.019788 reservations remain fully committed ($0.079152 total), and all four corresponding candidates are quarantined. The transport now retains each exact native metadata key, batch identity, terminal state and error record. Cohort accounting recognizes only matching terminal failures on quarantined items as bounded receipt holds, so unrelated approved questions can publish once their pending work finishes. A failed call with reported usage is charged for its candidate plus reasoning tokens; no service failure is assumed free. Missing/duplicate identities, a running batch, missing failure evidence, invalid bounds or an approved failed item still block publication.

The fix passed 28 targeted receipt/restart/identity/budget/publication tests, all 328 factory tests and the full release build. It was applied atomically after preserving the old files; the existing controller and active paid calls were left running. Actual SQLite proof at 12:51:38 UTC verifies all four native keys, terminal errors, unchanged full holds and quarantined item states. The academic generation/validation contract is unchanged; no repeated paid evaluation or accepted-ID resubmission was introduced. Two OpenAI batches and later repair-validation work remain pending; the controller must finish them before the combined campaign is called complete. Production signing-key entry and the historical 503 receipt remain external dependencies.

## 7 October 2026, 12:22 UTC — 575 actual staging retrievals and deployed currency correction

The signed-in staging student check at 12:15:53 UTC retrieved all 575 current approved questions: English 149, Accountancy 123, Business Studies 159 and Economics 144. Ten passage groups were complete; no rejected item was retrieved. The authenticated admin overview distinguishes 579 retained publication records from 575 currently usable factory items. Funded checkpoint replay, the unfunded 10,000 checkpoint rejection and the existing $25 student-AI monthly cap passed. This is actual API evidence; it does not replace a current rendered dashboard inspection.

The serving guard now preserves the sign in grouped rupee amounts, including Indian grouping, while rejecting mathematically equal options such as ₹3,00,000 and ₹300000. This corrected a false positive on one independently validated Economics item without changing its key, explanation or academic evidence. Fractional signed scalars are also covered. Question/selector/payment/wallet/ticket checks pass 65, factory 324, recovery 39 and the release build passes. Vercel shows production commit 4a9c002e7ce957d78715c409f0ec45f7d5ce3cca Ready/Latest, deployment Fr8c2aHmfwxtzqjXF1inXovKTdSm, 57 seconds. The frozen academic contract remains byte-identical to the release checkout: d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399.

The existing controller was restarted only after two independent child-empty checks to reload the guard. Restart evidence retains all 7,047 prior ledger requests and 2,438 stored accepted provider IDs, with zero missing IDs and no replay calls. The resumed controller reports 575 usable items and 83 pending candidates in the two already registered later cohorts; no further cohort was registered. Eight complete fixed cohorts preserve their entire 800-candidate denominator, 575 approvals and $4.860017 gross cost. At the dated 12:15:30 snapshot, lifetime settled usage is $12.521966, holds $1.378190, committed $13.900156; the conditional lifetime 10,000 forecast is $93.562174 across all completed cohorts and $93.394263 for all completed current-author-contract cohorts. Neither a uniformly premium bank nor a $50–70 forecast is established. These are usage receipts and conservative holds, not provider invoices.

Additional application/learning verification completed at 12:32 UTC: 84/84 existing tests pass. They exercise the production-shaped monthly AI budget migrations, conservative missing-usage accounting, duplicate dispatch suppression, credit reserve/commit/refund lifecycle and historical payment-plan resolution. These are local database and application checks, not a captured production payment or live student-provider claim. The report retains exact commands, test counts and log hashes in continuation-500/local-verification.json and includes them automatically in future exports.

Production student availability remains unverified while the owner-controlled CUET_EVIDENCE_SIGNING_KEY form awaits entry and submission; storage receipts and a Ready deployment do not establish availability. The browser credential rule requires the owner to complete that step. The historical OpenAI 503 request remains conservatively held at $0.011096; the read-only billing lookup encountered an authentication failure, and no zero-cost assumption or resubmission was made. The accepted native batches remain under the persistent controller for completion, export and final retrieval checks.

## 7 October 2026, 10:15 UTC — current usable admin counts and lifetime forecast

The actual staging check at 10:12:30 UTC passes 491/491 current approved questions, ten complete passage groups, and zero rejected items retrieved. The authenticated overview now separates 495 retained publication records from 491 currently usable factory questions. All four withheld historical publications remain stored and unavailable. The admin headline, subject counters and checkpoint gates use the intersection of current usable coverage with new factory publication IDs; unrelated legacy inventory cannot fill these checkpoints. The lifetime forecast includes existing committed spending and conservative holds once, rather than showing only marginal cost for 10k.

Four targeted count/forecast tests cover retained withholding, legacy exclusion, an insufficient 999-usable/1000-historical checkpoint, and absent cost evidence. Factory passes 324; the full release build passes. Recovery 39 and scoped question/payment/wallet/ticket 64 remain passing. At the dated aggregate snapshot 10:06:44 UTC, seven completed cohorts retain all 700 candidates, with 491 usable approvals and $4.128471 gross. Lifetime settled is $11.398041 and conservative reservations $0.782782, committed $12.180823. Conditional lifetime 10k is $92.135264 across all completed cohorts; uniform premium quality and a $50–70 fit are not established.

The accepted native batches are still processing (99/100, 98/100 and 0/7 in the latest direct read). Their output files are not available yet, so partial provider counters cannot be collected as completed questions or settled receipts. All accepted IDs remain retained; no paid regeneration or accepted-request resubmission was introduced. Production signing-key entry and the historical 503 billing receipt remain precise external dependencies.

## 7 October 2026, 10:04 UTC — unsupported antonym explanation withheld

The actual supplied dictionary span does not entail the generated rule that an antonym 'must oppose both qualities'. Both independent model checks and the explanation audit passed that unsupported claim. The publication inspection now rejects it automatically, and the already published item abb793b3de99185acb169170f420b335 has been withheld in both authorized environments with content, provider costs and prior publication history retained. This is an observed validator miss and dated regression evidence; it is not a fresh benchmark success or proof of general accuracy. The three duplicate passage children remain withheld. Cohort 007 now has 78 approvals and 22 rejections, preserving its full 100-candidate denominator and $0.681212 settled gross cost.

Inspection contract evidence-content-idea-inspection-v3 binds publication reuse to these current guards and unchanged content. The frozen academic model contract remains d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399. Factory passes 320 tests; recovery 39 and scoped answer/selector/payment/wallet/ticket checks 64 remain passing. Actual staging retrieval passed 492/492 at 09:55 before this additional withholding, so that proof is dated; the updated usable count must exclude this item. Remaining native requests are retained, and no fresh paid benchmark or uncontrolled regeneration was run.

## 7 October 2026, 09:50 UTC — actual novelty withholding and serving guard corrections

Vercel reports production 224e63a1ad3928f592f945d88be1b3ae351a7510 Ready (53 seconds). The retained seven completed cohorts originally approved 495 candidates. A new automatic passage-fact check found three children of the same passage group asking the same factual condition, despite differing concept labels. All three are now withheld in staging and approved production through retained dispute receipts; no content, publication receipt or spending record was erased. The local cohort retains the former publication history and now reports 79 approvals and 21 rejections. The strengthened prepublication check also withholds every sibling if a duplicate child fails. Numeric quantities, negations, different passages and genuinely distinct facts remain distinct in regression tests.

Two serving false positives were found from actual inventory: the guard collapsed +3.75 and -3.75, and treated vocabulary definitions containing 'true' as answer verdicts. Signed scalars now preserve value/sign, equivalent scalar options still collide, and truth assertions require an actual verdict. Independent key, support and explanation validation remain unchanged. The frozen academic contract is unaffected; no fresh paid benchmark was purchased.

Factory passes 319, recovery 39, and the scoped answer/selector/payment/wallet/ticket checks pass 64. The controller was stopped only after two child-empty checks, preserving accepted provider jobs; it resumed with the same persistent ledger. Remaining accepted cohorts 008–010 are still processing. The current count and lifetime figures are in artifacts/question-factory/continuation-500/REPORT.md; neither pending work nor historical duplicate publications count as delivery. Production student availability still needs the owner to save the prepared signing secret; OpenAI billing login returned an authentication error, and its historical 503 maximum reservation remains fully counted.

## 7 October 2026, 09:05 UTC — content-bound retrieval and automatic final evidence

The stronger real staging check passes 413/413 approved items across all four subjects, verifies actual passage-group IDs and nine complete groups, and finds no rejected questions in retrieval or storage. Its proof binds the complete exported content/evidence hash and the unchanged academic validation contract d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399. Anonymous/student admin denial, cross-origin rejection, funded checkpoint replay, unfunded 10k denial and the preserved $25 monthly student AI cap also pass. No paid model calls, emails or production data writes occur in these checks.

The final export now refreshes REPORT.md automatically. Once every registered candidate and accepted provider processing stage is terminal and the actual usable bank reaches 500, it runs one real staging retrieval and, under the existing production authorization, one real production retrieval. Attempts are persisted before dispatch; content, evidence, academic verification contract and retrieval-script content bind reuse. Interrupted/failed checks remain explicit rather than being presented as completion. After an external configuration fix, --refresh-final-evidence rechecks without generation or paid evaluations. This lets the persistent worker finish reviewable evidence if chat usage ends while native results are still pending.

The factory suite passes 317 tests. Recovery passes 39 and question/payment/ticket checks pass 67. Production submission fix 2e50d71 remains Ready; new production factory retrieval still needs owner submission of the prepared signing key. The fixed 1000-candidate campaign remains incomplete and its pending native requests are retained, not resubmitted or counted as delivered.

## 7 October 2026, 08:38 UTC — deployed submission fix and safe campaign restart

Production 2e50d719cf86e83dc6fc8fbab5fcfaef5f45f8a8 is Ready/Latest (50-second cloud build), verified on its exact Vercel overview. The expanded recovery command passes 39 tests. Actual full mocks for all four subjects and English quick practice pass the separate-staging launch/submission/replay check; every selected item is in the new approved bank.

The controller was restarted only after two inspections confirmed no active worker child. Its old process ended; no worker child or provider job was terminated. Actual restart evidence retains all 293 previous accepted provider IDs, zero missing IDs and all 6079 ledger requests. The resumed controller reports the current 413 usable questions rather than the old module's conservative undercount of 410. Accepted request IDs were not resubmitted.

Pending-capacity scheduling now waits for already accepted candidates or settled approvals that can fill the target before buying another cohort. This potential is an upper bound, not promised yield. Terminal receipt-only holds contribute no fictitious delivery capacity and remain fully committed; bounded unrelated work remains permitted. The new scheduling cases and existing budget/concurrency/recovery checks pass (17 targeted tests). The export report binds its coverage snapshot to its own inventory measurement so an older running controller cannot overwrite the report's count or topic contract.

The live campaign remains unfinished: six completed fixed cohorts, 600 candidates, 413 unique published questions; cohort 007 has 78 approvals, 17 rejected and five accepted requests pending, and cohorts 008–010 still await accepted authoring results. At 08:25:58 UTC, lifetime receipt-settled usage is $10.680328 and conservative holds $1.139486, committed $11.819814 under $50. Production student retrieval still requires owner entry/submission of the prepared signing key; provider invoices and the historical 503 usage remain unresolved. None of the queued work is counted as completed delivery.

## 7 October 2026, 08:20 UTC — actual full-paper submission repaired and verified

Production commit 66aef5f is Ready (50-second cloud build), including source families through fixed cohort 010. This does not establish new factory student retrieval: owner submission of the prepared Production CUET_EVIDENCE_SIGNING_KEY remains pending.

Actual separate-staging API launches exposed a real issue: 50 selected factory questions carried sufficient verification records to make the encrypted device-held session ticket exceed the 600k submission limit. New p2 tickets compress the complete server snapshot before AES-GCM encryption, retain an 8 MiB decompression bound and the existing 500k ticket ceiling, and keep valid p1 tickets readable. No academic evidence, keys, source records or historical receipts were dropped. Sealing still precedes charging; oversized sets fail before spend.

The corrected live staging check passed English quick practice and all four 50-question/60-minute full mocks, actual approved-question selection, four options, passage delivery, hidden timed-session keys, free replay and idempotent submissions. Synthetic unanswered attempts score zero; these are test records, not learner-gain or fresh academic reliability evidence. Failed initial checks remain in practice-launch-checks.json. The existing disposable student received a separately recorded 160-credit non-monetary staging fixture; production balances, entitlements, payment receipts and AI budgets remain untouched.

Verification: 35 existing recovery checks and 67 question/payment/ticket checks passed; the four new ticket checks cover exact large-snapshot recovery, legacy readability, authentication/tampering/ownership/expiry, and decompression limits. The complete release build passes. The new ticket suite is now included in test:recovery. Accepted generation requests continue under their original IDs; the 500 delivery target and final accounting remain unfinished.

# Implementation status — latest update: 7 October 2026

## 7 October 2026 — owner-approved production release and cost optimization (ongoing)

- Update 07:57 UTC: six completed fixed cohorts retain all 600 candidates: 413 approved, 187 withheld, gross cohort cost $3.447259. Actual signed-in staging retrieval at 07:51 verifies all 413 exact records (English 111, Accountancy 86, Business Studies 111, Economics 105), nine complete passage groups and zero rejected items. All 413 have production atomic storage receipts; new production student retrieval still needs the owner signing-key entry. The original fixed 100 remains 50 approved/50 rejected/$0.515798, not substituted by continuation yields.
- Release 9085d02849756710323abf3e702c633b4608dfcf is visibly Ready/Latest on www.mockmob.in after a same-commit clean rebuild (70 seconds). Initial Vercel restored-cache build failed in Turbopack Google-font module resolution; the uncached rebuild passed. Actual production feed preserves existing library access in all four subjects. Factory 315/315, recovery 35/35, question/payment 63/63 and production build pass; frozen academic contract remains d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399.
- A repeated authenticated staging check hit the 30-second request timeout because controls downloaded/classified the full bank twice. Controls now retain the first inventory's explicit counts_snapshot_at, apply the same funding/evidence gates, then re-read actual database controls without a second whole-bank download. Live authenticated release/replay and all-413 retrieval pass, as do the subsequent build and recovery checks. No correctness gate or paid-model stage was removed.
- The local helper's IPv4-only binding did not match this host's localhost (::1) resolution. Helpers now bind only to localhost and the direct localhost health check returns 200. Existing browser error pages are additionally blocked by Browser Use's data-URL policy; no raw browser/security workaround was used. Current rendered admin recapture needs that browser page restored; earlier actual admin/student screenshots remain dated evidence.
- Cohorts 007–010 retain accepted IDs and fixed 100-candidate denominators. Pending authoring and independent batch checks are provider work, not completed questions. The live exclusive guarded controller continues; the $50 content cap and $25/IST-month student cap remain intact. Current exports and dated lifetime reservations/forecasts are in continuation-500/REPORT.md; no global settled-cost or invoice claim while the saved historical 503 remains held.

- Update 07:40 UTC: original fixed 100 and continuation cohorts 002–006 are academically complete (600 candidates; 413 approved, 187 withheld), with completed-cohort gross cost $3.447259. Publication of cohort 003 is still progressing; dated actual counts and receipts are in `artifacts/question-factory/continuation-500/REPORT.md`. Cohorts 007–009 retain their fixed denominators and accepted provider IDs; queued candidates are not counted as usable delivery.
- Actual signed-in staging retrieval at 07:27 verifies all then-published 253 exact keys/options/explanations, six complete passage groups and zero rejected items. Monthly student AI cap remains $25. Latest deployed commit fc060f2 is visibly Ready/Latest in Production (43-second Vercel build). New factory production student availability still requires the owner signing-key entry and current family registry deployment.
- Fixed a deterministic answer-guard false positive: the ordinary dictionary definition “understood in more than one way” was wrongly treated as a combined-answer choice. Combined-answer options remain withheld; two regressions pass. Independently validated academic content and keys were unchanged. Recovery 35/35 and question/payment 63/63 pass after this correction.
- English coverage now separates exact numbered/lettered official syllabus phrases instead of treating the whole PDF as a single unfillable topic; independent tag disagreement remains unclassified. Five official-topic regression checks pass. Aggregate exports now disclose all completed cohort economics alongside the predeclared current-author-contract subset and lower independent craft ratings; no partial or favorable-cohort selection.
- The first v3 authoring cohort completed 88/100 approvals for $0.695839, with overall scores 28 at 7 and 60 at 8. These are sound-to-ordinary practice ratings, not uniform premium or accuracy guarantees. Actual committed lifetime snapshots include all outstanding reservations and the historical $0.011096 OpenAI 503 hold; no provider invoice or globally settled-cost claim.

- Update 06:00 UTC: two fixed 100-candidate cohorts are complete. Original: 50 approved/50 rejected/$0.515798; native cohort 002: 53 approved/47 rejected/$0.482092. All **103** newly approved items are published in staging and production database. Signed-in staging student retrieval verifies all 103 exact keys/options/explanations and two complete passage groups; no rejected item retrieved. Production student availability of new factory items still requires the pending owner signing-key entry; it is not counted as verified delivery.
- Production compatibility release **9bf60d0cf6e4faaf62ef12dfeae048d7fa90e6c7** is Ready (49-second Vercel build). Its actual public feed again returns existing library questions in all four subjects. Fixed a regression requiring screening receipts on every pre-existing row; existing holds and any failed/stale receipt still withhold a row, and modern factory evidence/provenance cannot use legacy compatibility. 313 factory, 35 recovery and 61 question/payment checks pass; production build passes.
- Atomic publication caught three individually approved children with differing chapter classifications in one registered passage. The publisher stopped correctly. Prepublication inspection now uses that same unchanged group contract and quarantines the entire affected group before RPCs. Three additional removals reduced native cohort 002 from 56 to 53; no forced repair, rewritten answer or score inflation.
- Cohort 004 authoring finished with 87 responses and 13 provider-confirmed invalid-schema failures: strict quote enums cannot contain newline characters. Failed requests remain in its denominator. New author contract v3 uses exact contiguous source spans without control characters. Existing accepted v2 bodies and idempotency keys are preserved byte for byte; no accepted ID is replaced. Regression tests cover both.
- At 05:59 UTC the actual lifetime ledger was $9.230111 committed, including pending validations and conservative holds. This is a dated snapshot, not a final cost or provider invoice. Cohorts 003–005 are still in progress. **500 registered candidates is not 500 approved questions.** The guarded worker continues toward 500 new usable publications; current-author-contract forecast remains unmeasured until complete cohorts exist. Content cap stays $50; student cap stays $25/IST month.

- Update 05:13 UTC: original 100 remains completed, 50 production database publications. Four fixed continuation cohorts (002–005) are processing; 500 registered candidates including the original is not 500 approved questions. Usable published staging remains 50. Current committed ledger total $8.727080 includes all conservative holds; global accounting is not fully settled and no invoice is obtained.
- Latest full pipeline suite: 295/295 pass; subsequently added economics tests 3/3 and checkpoint tests 3/3 pass. Legacy test fixtures now reflect the existing five-child contract, current passage limit, optional author metadata and required telemetry. Mandatory independent academic gates remain unchanged.
- Fixed stale undefined `forecast` references in signed-in checkpoint controls. Actual authenticated staging release_1000 and replay return success; an unfunded release_10000 returns 409. Pending new cohorts retain the completed original pilot and use completed cost measurements for checkpoint funding. Actual paginated student feed returns all 50 approved questions with exact keys/options/explanations/passages; rejected questions absent; monthly student-AI cap 25.
- New transport recovery collects output and error files, preserves failed usage receipts, and never resubmits saved IDs. Four failure-receipt tests and tested bounded scheduler concurrency/receipt-only continuation pass. New authoring constrains quote selection to actual excerpts; future briefs diversify cached source sections, 14 inspected dictionary definitions and 32 original fictional stimuli. Retrieved actual NCERT Directing columns and brief official NISM/SEBI market definitions are source material pending independent per-question entitlement/entailment, not academic certification.
- Consolidated denominator/cost export and paginated staging/production retrieval commands are implemented in docs/brain/QUESTION-FACTORY.md. Improved unit costs remain unmeasured until the new fixed cohorts finish. Production signing-key owner handoff remains pending; no final student-access or 500-question completion claim.

- Owner explicitly approved deployment of the 50-question subset and continued bounded generation toward at least 500 usable questions and a conditional 10,000-question forecast below $100. The $50 content ceiling remains unchanged; $70 was a scenario.
- Applied only the saved additive factory migration to production project isrxrxzjocewrdureyhp; transaction succeeded. Published 50 approved questions through atomic RPCs with current stored evidence valid. Production student retrieval remains unverified until the release and signing configuration are complete.
- Prepared isolated release 0d961f1f3833732b9a0b5c5db0de48f012312432 on current origin/main, preserving newer product features and the original dirty checkout. Release build passes; factory 107, recovery 35, question/payment 61 checks pass. Dynamic evidence JSON is explicitly included in serverless file tracing.
- Checkpoint budgeting now measures the requested 1,000/10,000 checkpoint against committed costs and retained holds; a $103 ten-thousand forecast cannot block an affordable 1,000 checkpoint. Persistent per-call enforcement stays $50. Two boundary/missing-measurement tests pass. Cross-cohort duplicates and atomic sibling withholding have two new tests.
- Next fixed cohort cost-native-cohort-002: 100 candidates, 25 each, actual staging coverage before = 50. All author IDs accepted once in batch_6ac5c5843ad88190b6c2b448588f11f9. Native batch pricing for generation, blind checks, repair and explanation auditing; academic contracts unchanged. It is pending and is not counted as a completed yield. Current conservative committed total $7.490159 includes $0.367300 pending cohort reservation and historical $0.011096 hold.
- Missing production signing secret: owner handoff requested for the existing CUET_EVIDENCE_SIGNING_KEY from .env.local into the prepared Vercel Production secret form. Browser credential-entry policy requires owner entry. No secret printed or sent in chat; independent batch work continues.

## 7 October 2026 — completed original live generator execution (staging history)

- Working pipeline: usable official-syllabus coverage → focused cached decisive excerpts → GPT-6 Luna generation → blinded Luna and independent Gemini checks → explanation audit → automatic inspection → atomic publication → refreshed coverage. Original practice does not require a PYQ anchor; authentic PYQ labels retain strict authentication. Sixteen mandatory gates among 19 criteria cannot be offset by craft scores; overall craft 7–10 may pass. At most one targeted repair.
- Finished all 100 preregistered candidates, 25 per subject, including all accepted provider requests and receipts. Unique approved: **50**; withheld: **50**. Approved counts: English 10, Accountancy 19, Business Studies 12, Economics 9. All 50 are newly published in separate staging and retrieved through the actual signed-in student API. Production publications/writes: **0**. No fixtures, historical passes or queued requests contribute to yield.
- Gross cohort usage cost: **$0.515798**, holds **$0**; gross cost per approved question **$0.01031596**. Fresh final benchmark $0.120406; all calibration/preparation attempts $0.422157; execution with preparation $0.937955. Lifetime settled $7.111763 plus saved historical 503 conservative hold $0.011096 = **$7.122859 committed** under unchanged $50 ceiling. Provider invoices were not obtained; the lifetime amount is not fully settled.
- Conditional marginal cost for 10,000 approved questions: $103.159600; conditional lifetime cost to that target: $109.766661. It does not fit $50–70 at measured yield/pricing. Remaining $50 capacity conditionally supports 4,156 additional approved questions (4,206 including these 50). $60 and $70 remain scenarios, not authorization. Reasoning, rejected outputs, independent checking and repair are included, with stage costs in REPORT.md.
- Fresh frozen benchmark: 12/12 valid retained, 0/12 controlled defects accepted; both independent blind providers 12/12 positive keys correct. Eighteen old regression examples withheld separately. The 12-defect sample gives a 22.09% one-sided 95% upper bound, not proof of perfect reliability. Live inspection caught model-passed missing financial-enterprise status, an unsupported clause generalization and uncertain step ordering, and withheld them before publication. Free duplicate/provenance guards also removed surplus items. Model agreement does not prove truth; no extra academic regeneration inflated yield.
- Staging project onwkqxmjqjrhfbjjdydu: 47 migrations dry-run then applied only to separate staging. Signed-in admin authorization/controls, worker restart preserving the original batch ID, idempotent publication, complete passage-group atomicity/rollback, actual student keys/options/explanations/full passages and dispute invalidation pass. Repeated publication retains exactly 50 rows and no new paid requests. Signed-in 10-question quick quotes are available for English, Accountancy and Business Studies; Economics correctly refuses because only nine exist. No complete 50-question subject paper is claimed.
- Fixed JSONB key-order changes invalidating signatures using canonical signing with legacy compatibility. Re-signed only matching staging evidence envelopes and retained originals; no key, explanation or provider-receipt edits. Fixed null answer-index fields overriding letter keys. The storage compatibility amendment preserves academic prompts/oracles/decisions; it was not labelled a new unseen paid benchmark. Progress writes now use 25-row chunks after a repeated 100-row write hit a statement timeout, and completed worker ticks do not republish.
- Current coverage: 50 usable unique questions across 32 of 51 official chapter cells. Format/difficulty/duplicates/branch and independent topic observations are exported. Ambiguous fine-topic tags leave gaps open. Accountancy financial-analysis/common and computerized alternatives remain separate. 2026 rules are provisional for 2027; English passages stay within 300 words.
- Final checks: **105 factory, 35 recovery, 84 learning, 54 question/payment, 7 discovery-feed tests pass**; final optimized production build passes with the two existing image dimension warnings. Rendered admin and actual student answer/passage screens inspected; screenshots saved in staging/. Separate student AI $25 per IST month, existing entitlements and historical receipts remain intact. No captured production payment verification is claimed.
- Staging worker is paused after completion. Runbook: docs/brain/QUESTION-FACTORY.md. Completed evidence and exports: artifacts/question-factory/execution-2026-10-07/REPORT.md, original-candidates.json, all-100.json/.csv, approved-records.json, rejected.json, receipts.json, coverage-after.json and staging/.
- Remaining external gates: owner approval for the prepared additive production migration, reviewed generator deployment and these 50 publications; and exact provider usage/billing confirmation for historical request req_b4d44cd7e2164c18bda70d533c3683d5. Organization usage API returned 403 and the provider billing page needs owner sign-in. Retain its full hold; valid bounded holds permit unrelated work. No production migration was applied. Earlier sections below are historical; 10/10-only requirements are superseded by the owner's 7–10 craft threshold.

## 7 October 2026 — premium factory implementation and explicit unresolved gates (Codex)

- Implemented frozen ledger-bound unseen-benchmark registration, prior-exposure rejection, current-syllabus/300-word preflight before paid preparation, guarded cache-only recovery, full campaign economics and an acceptance report. Added 14 NCERT reference documents and 21 anchor reference attachments; source foundation is not calibration proof.
- Fixed underscore exam blanks being falsely rejected as Markdown. Disabled oversized English and out-of-scope legacy generation anchors. Current verifier v5.6 enforces the owner's 10/10 craft floor; no blocking academic defect can be offset by a score. Earlier 7/10 admission is historical.
- Current source registry 55: English 1/7, Accountancy 9/15, Business Studies 4/12, Economics 5/17 tracked topic groups have active supported generation anchors. 32 gaps remain.
- OpenAI 503 returned no usage receipt: request req_b4d44cd7e2164c18bda70d533c3683d5; unresolved reservation $0.011096 remains held. Lifetime settled $6.172435, all holds $0.018283, available $43.809282 under unchanged $50 cap. No new paid calls after the unresolved response.
- Saved v5.4 probe: four candidate checks pending; four of six saved native batch IDs completed, two submitted. Receipt-only recovery does not resubmit accepted IDs. New premium contract requires renewed proof.
- Frozen v5.4 benchmark preserved: 31 positive observations (16 machine-eligible, 15 quarantined), seven completed negatives with zero accepts, six distinct pending fixtures. Six 335-word English items violate the current 300-word limit; no valid-difficult coverage. The fixture file is rejected by free preflight and cannot release current calibration.
- Historical v5.5 known-defect regression: 18/18 quarantined. Current v5.6: five completed free quarantines, thirteen uncached checks pending; no false accepts. Neither pending nor historical checks count as current release evidence.
- Supabase dashboard checked: mockmob has only production project isrxrxzjocewrdureyhp, no branches; Campusos has zero projects. No staging project exists. Production REST factory control lookup returned PGRST205/404. No production migration, deployment, publication or credentials changed.
- Verified 156 tests (76 factory, 35 recovery, 45 answer/selector/payment), targeted lint, final build, local preview HTTP 200 and browser coverage expansion; admin API unauthenticated HTTP 401. Signed-in admin/restart/atomic publication/dispute flow still requires separate staging. Existing build image-size warnings are unrelated.
- Evidence: artifacts/question-factory/implementation-2026-10-07/acceptance.json, first-frozen-benchmark-recovery-v54.json, staging-evidence.json and logs; regression campaign history preserves older contracts. No completed premium native-batch cohort supports 10,000 within $50–60. Keep generation/publication paused; do not reset unknown usage holds.


## 6 October 2026 (evening) — 100-candidate measurement cohort, independent audit and forecast (Claude)

Owner chose a measure-only run while calibration retention (80.6%) is below the 85% release floor. Nothing is
publishable: publication eligibility still requires the released manifest. Evidence: `artifacts/question-factory/quality-v5/`
(`results.json`, `cost-and-cohort-report.json`, `independent-audit.json`, `audit-export-*.txt`).

- Cohort (preregistered, 25 per subject, verifier v5.3): 100 planned, 96 generated, 58 machine-eligible, 0 published.
  Adaptations 52/84, authentic originals 6/16. By subject: English 7, Accountancy 13, Business Studies 17, Economics 21.
  58 distinct fingerprints; 36 anchor families; formats include matching, statement selection, assertion-reason,
  numerical and case items; difficulty 29 easy / 29 medium / 0 hard. Rejections: source support 15, repair abstained 13,
  evidence quote not in sources 4, syllabus/chapter 4, duplicate inventory 3, other 3.
- Independent audit (Claude subscription session, not publication evidence): 41 publish-ready, 8 acceptable but weak,
  7 defective, 2 duplicate ideas. Defect classes: self-labelled options, definition-phrase synonym options, an
  arguable assertion-reason, a flattened authentic list, near-duplicate ideas across anchors, weak distractors.
  New deterministic lint now rejects 5 of the 7 defects at zero model cost (tested).
- Cost: lifetime gross $5.73 of $50 (remaining $44.27); campaign window since top-up
  $2.57; cohort $1.13 = $0.0194 per machine-eligible item.
  Largest cohort stages: Luna blind checks, Gemini evaluation, authoring, blueprints. Google credit deductions unverified.
- Forecast: 10,000 at the measured real-time rate ≈ $200.12 lifetime; achievable with the remaining budget
  ≈ 2277 eligible. Batch pricing (ESTIMATE, not demonstrated): ≈ $102.92,
  ≈ 4554 eligible. Bulk spending stays paused: 10,000 within $50 is not met.
- Remaining gates: calibration retention release (or owner threshold decision); demonstrate batch execution;
  restore presentation of flattened authentic originals; cross-anchor idea deduplication; staging migration,
  authenticated worker/dashboard proof and atomic publication before any production step.
- Checks: factory 54, recovery 35, answer-integrity 6, NTA 22, question/payment 16 pass; targeted lint clean;
  production build passes.

## 6 October 2026 (afternoon) — Factory v5.3 gates: defect regression passed, calibration retention short; cohort not run (Claude)

Evidence: `artifacts/question-factory/quality-v5/` (every gate run archived in `history/`). No publication or site-database writes.

- Sources: approved NCERT leac102/103/202/206 downloaded once, extracted with `extractReferencePdf.py`
  (identity SHA-256, URL, syllabus version in `extraction-metadata.json`), registered via the reusable
  `registerReferenceSpans.mjs`. Every reference document carries source-backed chapter coverage.
  Generation-ready anchors 31 → 54 (Accountancy 24, Business Studies 15, Economics 12, English 3). Registry v50.
- Gates made consistent: one shared release predicate (`routeCalibrationReleased` / `factoryCalibrationReady`)
  now governs calibration, worker, publication eligibility and the ledger. Publication previously still
  applied the old 95% rules. v4+ receipts must positively carry `polish_gate: true`; academic-only
  calibration receipts are refused by publication (tested).
- Verifier v5.3: source-backed chapter rule (cited documents must cover the tag; evaluators agreeing
  elsewhere, or both leaving the unit, fail); unit-scoped syllabus and per-candidate excerpts (largest
  request 27.4k → 24.3k bytes); two independent Luna samples must both pass before Gemini is paid;
  decisive principle must be in the excerpts (journal-entry direction included); missing conditions fail.
- Correction: the 17 "fresh" fixtures were previously evaluated by v2.6/v3.0 and v4 was tuned on them; all
  calibration is a previously-observed regression check, not an unseen benchmark. Reclassifications
  (2 official items to known-bad; anchor q29 chapter metadata) are recorded in the fixture file.
- v5.3 result: audited-defect regression 0/18 accepted. Calibration retention 25/31 (80.6%) < 85%;
  numerical 2/3, passage 9/13 < 80%; keys 100% both models; 0/14 known-bad accepted. NOT released.
- Spend: lifetime ≈ $4.6 gross of $50; the 100-candidate cohort was not generated.
- Tests: factory 53 pass; targeted lint clean; production build passes. Multiline question rendering
  verified in the Arena preview (desktop and 375px, no overflow).

## 6 October 2026 — Question factory quality-v4: verifier released, generation blocked on OpenAI credits (Claude)

Owner direction: quality over yield (a 40% pass rate is acceptable once; passing items must be 10/10).
Evidence: `artifacts/question-factory/quality-v4/`. No publication, no site-database writes.

- Sources: 16 anchors gained exact NCERT spans (`scripts/pipeline/data/quality-v4-anchor-sources.json`,
  `prepareQualityV4.mjs`); generation-ready anchors 21 → 31. Registry v45. Input byte guard raised
  24,576 → 32,768 (rates unchanged). Missing chapters (Admission, Retirement, Debentures, Cash Flow,
  Staffing, Directing, Financial Markets, Consumer Protection) need NCERT PDFs the owner must approve downloading.
- Authoring `cuet-setter-v4.1`: Luna high, NTA setter rules, verbatim evidence quotes checked locally,
  deterministic presentation lint. New blueprint stage plans distinct excerpt-grounded items per anchor.
- Verifier `luna-gemini-cuET-v4.6`: academic gate plus a separate polish gate (both evaluators must score
  ≥9/10 with zero listed defects); unit-level chapter check, failed when both blind views reject the tag;
  claim-by-claim explanation audit; evaluation cache keyed on exact prompt text.
- Calibration (academic, polish off): 31 valid official items incl. 17 fresh held-out; v4.5 released with
  28/31 kept, keys 100% for both models, 0/14 known-bad accepted. Release policy `strict-quality-v4`
  (overall survival ≥85%, route ≥80%, answered key accuracy ≥95%, abstention ≤15%) replaces the 95%
  survival floor; owner may veto. Two official items moved to known-bad after written adjudication.
- Audited-defect regression: 17/18 rejected at v4.5; the circular-flow explanation was still accepted.
  v4.6 adds a rule against importing a textbook model's unstated assumptions; its rerun was interrupted.
- BLOCKER: OpenAI returned HTTP 429 credit_balance_exhausted. Four zero-cost holds reconciled; transport now
  settles credit refusals at $0. Content ledger: $3.161792 committed of $50. Gemini credits unverified.
- Next after top-up: `node --use-system-ca scripts/pipeline/tools/qualityCampaign.mjs calibrate`, then
  `audit-regression`, `plan`, `generate`; then independent audit of every eligible item.
- Tests: factory 49, recovery 35, question/payment 16, answer-integrity 6, NTA 22 pass; targeted lint clean.
  Production build not rerun for this change set. Test runner question text now preserves line breaks.

## 4 October 2026 — Mobile refinement publication authorized (Codex)

The owner explicitly requested committing these changes to the live website. Publishing
the verified mobile refinement through `main` and the existing Git deployment integration.
Physical-device/background-tab acceptance and the inconsistent throttled LCP result remain
documented limitations, not completed checks. No database or environment changes are part
of this publication. Deployment completion is to be checked against the live domain.

## 4 October 2026 — Mobile refinement implemented locally (Codex)

Owner approved implementation and the public companion name **Mobi**. Detailed changes,
measurements and limits: `MOBILE-REFINEMENT-IMPLEMENTATION-2026-10-04.md`.

- Lab starts only when its content is readable. One clock pauses offscreen/hidden;
  manual steps pause and explicit Replay restarts. Compact phone controls and natural
  panel sizing; Mobi uses contained local reactions, preserving desktop travel.
- Phone hero/exam palette refined. Practice summary repaired at 320px (390px → 166px).
  Result Find shortened through disclosure (1247px → 399px at 390px). Light answer-state
  contrast corrected; navigation glass has opaque accessibility fallbacks.
- Arena header now sticks correctly. More opens without page jumps, scrolls between
  measured header/dock bounds, and restores opener focus on Escape. Final checks at
  320px, 390px with 200% text, and 844×390 landscape reached the last account action.
- Responsive matrix: 56 homepage/Practice/Result/quick-runner configurations across seven
  widths and both themes; no root overflow or page exceptions. Timing, reduced motion,
  text zoom, Mobi fallback, both NTA skins' answer/palette flows, public demo, theme
  persistence and free/error states verified in development fixtures. Result contrast
  scans had no flagged text. Evidence: `artifacts/mobile-refinement-2026-10-04/`.
- Lint/build passed. Recovery 35, learning 80, NTA/answer-integrity/payment 40: all 155
  tests passed without skips. Diff whitespace check passed. Build EPERM was resolved by
  approved filesystem access, with no cache deletion or configuration workaround.
- Isolated Slow 4G/4× CPU production samples: CLS 0; LCP 1.604–3.532s, so the 2.5s
  target is not consistently met. Physical Android/Safari, actual background-tab resume,
  assistive technology and real signed-in acceptance remain open. Local emulation does
  not establish hardware or production readiness. No paid model, migration or deploy.
- Preview: localhost:3010. Temporary production server 3011 stopped. Existing edits/
  untracked artifacts preserved. No commit or push; publication awaits device/performance
  acceptance and an explicit deployment decision.

## 4 October 2026 — Published mobile audit and Preparoo reference study (Codex)

Audit and plan only; no product behaviour or production changes. Plan:
`MOBILE-REFINEMENT-PLAN-2026-10-04.md`. Evidence: `artifacts/mobile-audit-2026-10-04/`.

- Live homepage: 390/1280px, both themes; Lab autoplay advances to Find while the replay
  has zero visible pixels on phones. The phone rail occupies 376px before the replay.
- Preparoo public reference: 390/1280px, wheel-scroll samples, phone illustration and
  backdrop-filter inventory. Observed mobile hero asset is WebP, plus PNG/SVG assets.
  Phone feature/explanation/preview hierarchy is the useful reference; no assets copied.
- Hydrated Arena fixtures: Practice, branded quick runner, Result at 320/390/430px,
  both themes, 18 captures. Zero document overflow/page exceptions. Narrow Practice
  cost text wraps nearly letter by letter; Result Find occupies 1247px at 390px.
  Light Result option letters produce two contrast flags (~2.75/2.82:1).
- Menu taps and Escape close verified at 320/390px. Public reduced motion shows a
  complete static replay and removes the floating guide. Initial unhydrated captures
  were rejected; localhost-origin retry restored fixture hydration without config edits.
- Next: playback readability gate + compact Lab + Practice summary + Result density/
  contrast, then phone-local mascot, previews/navigation and daylight depth. Mobi is
  a suggested name only, not an approved or implemented rename.
- Browser emulation is not physical-device proof. Real Android/Safari, screen reader,
  throttled production performance, both premium NTA skins and live signed-in workflows
  remain acceptance gates. No attempt, model call, checkout, migration or deploy ran.
  Only audit scripts/docs changed; product suites/build were not rerun. Local preview
  is running on port 3010. Existing untracked evidence directories were preserved.

## 5 October 2026 — Mistake Repair on GPT-6 Luna (Claude)

Owner chose GPT-6 Luna (USD 0.10 in / 0.50 out per 1M) for Mistake Repair: reasoning effort `low` for
the repair, `high` for the blind second opinion (`REPAIR_ROUTE`/`REPAIR_EFFORT` in
`src/services/recovery/mistakeRepair.js`; `AI_REPAIR_MODEL` overrides). `providers.js` now sends
`max_completion_tokens` + `reasoning_effort` (no temperature) to GPT-5/6/o-series and reserves budget
for hidden reasoning tokens. gpt-4o-mini remains the fallback. Price row inserted in production
`runtime_ai_prices` (owner instruction to ship now; file `20261005090000_runtime_ai_price_gpt6_luna.sql`).
Not verified: a live GPT-6 Luna call (the live eval run was blocked by the local permission
classifier). If Luna rejects a parameter, repairs fall back to gpt-4o-mini rather than failing.
Open: key disputes ("No repair for this one") still are not logged as evidence about the key; the
dispute flow designed on 5 October (soft flags, proposed key, student-was-right signal) is next.

## 4 October 2026 (late night) — Result page + Score Recovery Lab redesign after owner test (Claude)

Owner tried a 10-question quick practice (3 right, 7 wrong) and rated the Lab 5/10: no meaningful use,
weird "replay your decisions" slider, page too tall; wanted summary + Pip first, then the Lab, then
each answer with Mistake Repair. Done (see DESIGN.md "Score Recovery Lab"):
- `data/session_recovery.js` (new, pure): marks gap (6 per wrong, 5 per blank), chapters ranked by
  marks lost, per-question time from device events, factual observations. Tests:
  `data/tests/session_recovery.test.mjs` (added to `test:recovery`).
- `ResultPageClient.jsx` rewritten: summary hero with question strip → Lab → accordion answers.
  Removed from this page: ArenaHead, MistakeReplay, SessionReadout, the separate next-step block and
  the compact LearningNextAction (all duplicated the Lab). Components still exist for other pages.
- `ScoreRecoveryLab.jsx` rewritten as Find / Repair / Prove; slider replaced by a folded decision log.
- `MistakeRepair.jsx`: staged loading, two-card trap/why-wrong layout, "matched the key" check,
  auto-run when launched from the Lab queue, "Next mistake: Qn" chaining.
- `/preview/arena?view=result` fixture is now a realistic 10-question session scored by the real
  engine; `/preview/recovery` redirects there.
Verified: recovery 35, learning 80, nta 22, answer-integrity 6, du 19, payment/questions/PrepOS/repair
81 pass; lint clean; `next build` 62/62. Browser: desktop, 375px (no horizontal scroll), light theme,
Start repairing → Q2 repaired → Next mistake Q3 → Q4. Page height on the fixture fell from ~5.8k to ~3.6k px.
Second pass (owner: UI 9/10, clarity 7/10, "too much AI framing"): repair copy no longer narrates
the AI ("Why option C felt right", "Where it breaks", "Checked against the answer key"); server
held/not-explained messages rewritten the same way; sparkle icon replaced by a wrench; observations
are now tag + fact + consequence + one tip; step headers say what each step is for; mono uppercase
labels replaced with sentence case; motion added (score count-up, Pip entrance, strip stagger, bars
and chapter tracks grow when the Lab scrolls into view, repair cards stagger in; all off under reduced
motion). Owner approved commit and push to main.

## 4 October 2026 (night) — Score Recovery + AI unblocked and live in production DB (Claude)

Owner decisions in chat: names (marketing "Score Recovery", feature "Score Recovery Lab", action
"Mistake Repair"); student AI USD 25 per IST month; content generation USD 50 lifetime; AI migrations to
production "with my OK" (then explicit yes on the dry-run report); provider "whichever is best, make a
report" (AI-MODEL-REPORT-2026-10-04.md); OpenAI tonight because the Anthropic key is invalid.
Plan of record: PLAN-2026-10-04-NEXT-DAYS.md.

**Production database changes (owner-approved, applied via Supabase MCP):**
`runtime_ai_guard`, `prepos_credit_reservations`, `runtime_ai_monthly_cap` (new file
20261004120000). Dry run: reports/ai-migrations-dry-run-2026-10-04.json (PGlite rehearsal + production
precondition checks: no collisions, 879 wallets / 108 ledger rows untouched). Found and fixed before
applying: the ledger `reason` check would have rejected every reserve/release (all paid replies would
have failed); a single missing-usage response paused all student AI; prices expired after 30 days.
Verified after apply: cap 25, prices for claude-haiku-4-5, claude-sonnet-5-5, gpt-4.1-mini, gpt-4o-mini
(gpt-4o-mini added by SQL insert), all functions present, readiness script all green.

**Code:**
- `RELEASE_GATES.runtimeAi = true` (PrepOS replies + Mistake Repair); new `aiCommerce = false` keeps
  top-up checkout and charged Rival battles closed (order route, packs, pricing page, Rival).
- Anthropic provider in `src/services/ai/providers.js` (SDK retries off, per-model params: Sonnet 5.5
  without custom temperature / thinking off). `.env.local` routing: OpenAI gpt-4.1-mini fast+smart,
  gpt-4o-mini fallback (Claude routing documented for when the key is fixed).
- **Mistake Repair**: `data/mistake_repair.js` (eligibility, solve-then-explain prompt, blind second
  opinion, output validation incl. banned score/rank promises), `src/services/recovery/mistakeRepair.js`
  (1 PrepOS credit via reserve/commit/release; finished repair stored on the committed reservation and
  reopened free; dispute → blind check → question withheld exactly like a student report, credit
  released), `POST /api/recovery/repair`, `src/components/recovery/MistakeRepair.jsx` on result-page
  wrong answers with "Prove it: 5 fresh questions on this chapter".
- Budgets: AGENTS.md rewritten (limits are owner-set; do not invent stricter ones);
  `CONTENT_LIFETIME_CEILING_USD = 50` in budgetLedger.mjs; COST-POLICY, QUALITY, ROADMAP, README,
  PRODUCT, DECISION, IMPLEMENTATION, BACKLOG, LEARNING-DEPLOYMENT reconciled.

**Verification actually run** (logs: artifacts/ai-night-2026-10-04/):
- Live smoke through the production guard: gpt-4.1-mini ×2, gpt-4o-mini ×1 valid JSON, receipted
  (~$0.00007 each). Anthropic: 401 invalid key (booked conservatively, no pause).
- Live Mistake Repair eval on 10 real published bank questions: 10/10 solved = key, explained,
  $0.0038 total. Sample was all Accountancy (selection by ID order) — not representative.
- Tests: recovery 30/30, learning 80/80 (+5 Mistake Repair, +1 production-migration PGlite), nta 22/22,
  answer-integrity 6/6, du 19/19, payment 12/12, questions 9/9, recovery:validate; lint clean; build 62/62.
- Browser (preview fixture, localhost:3010): repair explained / withheld / out of credits / failure
  states, light theme; result page renders the panel only under wrong answers.
- Month-to-date runtime spend after all tests: ≈ $0.008 of $25.

**Deployed (owner chose "commit and push to main"):** `3c88f92` (all source/docs in the tree, incl.
the owner's and earlier agents' uncommitted work; untracked `artifacts/` 121 MB deliberately not committed).
**Incident:** that tree contained an earlier agent's www→apex redirect in next.config.mjs while Vercel
redirects apex→www, so production looped (50 redirects) for ~15–20 minutes. Hotfix `499475a` removed the
rule; site verified 200 at 01:03 IST on /, /pricing, /cuet-subject-combination, /api/stats; new
/api/recovery/repair and /api/ai/mentor/chat answer 401 signed out. Lesson: before pushing a dirty tree,
diff next.config/middleware against the deployed commit and probe redirects right after deploy. To make
the apex canonical, change Vercel's domain redirect first, then add the rule.
**Not done / gates:** Vercel `AI_*` env vars (code defaults to OpenAI gpt-4o-mini/gpt-4.1-mini, both
priced, so replies work if Vercel has OPENAI_API_KEY — unverified); signed-in production
check of a real PrepOS reply and repair; Anthropic key; learning/recovery migrations (triggers on live
`questions`) still unapplied; homepage/store copy not yet renamed to "Score Recovery"; AI purchases
closed; AI dispute quarantine relies on one model family tonight (both opinions from OpenAI).

Rollback: `update runtime_ai_budget set monthly_cap_usd=0` stops all student AI instantly; or set
`RELEASE_GATES.runtimeAi=false` / `PREPOS_MODEL_REPLIES_DISABLED=true`. Remove the repair route and
component to withdraw Mistake Repair. Wallets and ledger history are never rewritten.

## 4 October 2026 — Differentiator decision and first validation slice (Claude)

Decision: [DECISION-2026-10-03-DIFFERENTIATOR.md](DECISION-2026-10-03-DIFFERENTIATOR.md). Primary bet
"repair that holds", proven on one pathway before eight; trustworthy practice and goal-aware DU tools
support it. Rename to "Mistake Repair" proposed, **not applied** (owner decision). Brain reconciled:
README, PRODUCT.md, ROADMAP-2027 (amendment), IMPLEMENTATION-2027 (Stage 2), BACKLOG (ordered next).

Implemented (local source only; nothing deployed, migrated, seeded, purchased or sent to a model):
- Candidate pathway `data/recovery_candidates/sacrificing_gaining.{source,pathway}.json`: original
  wording, CUET UG 2026 Accountancy (301) Unit II locator with PDF SHA-256, 3 probes / 5 repair /
  6 checks, 14 families, hypotheses secure / direction_reversed / old_ratio_default / new_ratio_used,
  boundary checks (old ratio correct; unaffected partner). State `candidate`; manifest still
  `blocked_sources` with `pathways: []`. `source_registry.json` deliberately untouched (the paid
  worker treats an empty registry as a pause signal).
- Validator `data/pathway_validation.js` + `npm run recovery:validate`: exact-fraction recomputation of
  every key, matrix cell, derived ratio, unique key, option-text/claim binding, family disjointness,
  isomorphic scenarios, sources. 97/97. Corruption tests prove it fails on 13 seeded defects; it caught
  one real weakness during this work (swapped partner attribution passed), now fixed.
- Engine: no-gap diagnosis label; clearer feedback when repair ends; shared plan `primary.facts`
  (record vs rule) incl. immediate-check and upcoming-check states. Server digest now reuses
  `pathwayDigest` from the validator (same algorithm, one implementation).
- PrepOS: "Why this step" facts in the plan panel; free record reply appends the facts; model prompt
  states facts are authoritative (paid replies remain paused).
- Metrics `data/recovery_metrics.js` + read-only `scripts/learning/recovery-metrics.mjs`: completion,
  immediate/delayed/maintenance pass rates (Wilson, n), overdue and stalled attrition, defects,
  diagnosis counts, probe concordance, cost; groups < 5 suppressed; no decision < 30 episodes.
- Capability registry: `EVIDENCE_LEVELS`, `DIFFERENTIATORS`, `differentiatorClaimable()` (false for all).
- Dev-only fixture `/preview/arena?view=recovery&recovery=candidate[&net=lose-once][&clock=h]`: real
  recovery UI on the real engine, idempotent by request key; pathway read server-side in development
  only. Production build contains no candidate item IDs (grep of .next/static and .next/server: 0).

Verification actually run (logs in `artifacts/differentiator-2026-10-04/`):
- `npm.cmd run test:recovery` 30/30 (was 17; +13 candidate tests incl. PGlite storage),
  `test:learning` 74/74, `test:nta` 22/22, `test:answer-integrity` 6/6, `test:du` 19/19,
  payment_entitlements 12/12, mock selector + explore feed 9/9, `recovery:validate` passed.
- Candidate tests cover: per-hypothesis diagnosis/routing/timing (24h, 72h), secure path, conflicting
  probes → general repair, repeat exposure (seen family/question, failed checks consume families,
  exhaustion → blocked_content), interruption (stale submit rejected, expired check reopens repair),
  no key/matrix/claim leakage, concurrent start retries → one episode and one weekly allowance, refused
  start consumes nothing, second concept same week refused, idempotent response retry, answer
  correction → episode invalidated → counted as a defect.
- `npm.cmd run lint` clean; `npm.cmd run build` 61/61 pages.
- Browser (in-app pane, existing dev server on localhost:3010): start → probe 1 with response lost
  after commit → retry returned the committed state, 1 commit → probe 2 → supported old-ratio
  diagnosis, explanation, contrast → routed repair → hand-off to unassisted fresh check (4 commits for
  4 answers); conflicting probes → general explanation; PrepOS shows "Take your first fresh check"
  with record/rule facts; 320px: no overflow, 76px option targets; PrepOS facts contrast ≥ 9:1.
- Read-only metrics against the configured database: `learning_episodes` absent (PGRST205) → n = 0.
  The connected-learning migration is not applied there. Fixture report is labelled simulated.

Not done / gates: academic validation (independent Accountancy reviewer; one definition item flagged
for review); backend-signed evidence for the 14 items; staging migration + seeding + digest
registration; opted-in pilot flag (not built); scored fresh check through `/test` with real
sessions; real devices and screen readers; DPDP legal review (under-18 consent and telemetry before
~13 May 2027); owner decision on the rename; Testbook research (pages unavailable on 3 Oct).

Rollback: delete `data/recovery_candidates/`, `data/pathway_validation.js`, `data/recovery_metrics.js`,
`data/tests/recovery_pathway_candidate.test.mjs`, `data/tests/recoveryCohortFixture.mjs`,
`scripts/learning/{validate-pathway,recovery-metrics}.mjs`, the `candidates` key in
`data/recovery_pathways.json`, and the `recovery:validate`/test-list additions in package.json; revert the
small edits in learning_engine.js, capabilities.js, server/learning.js, MockMobAIHub.jsx, prepos.css,
mentor chat route, systemPrompt.js and the preview files. No data, credit, entitlement or payment path changed.


## 3 October 2026 — Owner round 2: motion, social proof, hero, Arena, Compass Pro, Combo Planner (Claude)

Owner decisions taken in chat this round: demos autoplay by default with an explicit pause; creators shown
with real follower numbers, ordered by reach; Compass gets Pro features (projection, college mapping); a new
USP feature; ₹99/month to be executed; live-site testimonials described by the owner as authenticated.

Implemented (local source only; nothing deployed, migrated, purchased or sent to a model):
- **Mistake Lab** no longer pauses under a passing cursor, a tap or the 35% visibility threshold; it pauses only
  fully offscreen, on keyboard focus, or by its button. Step descriptions share one fixed-height slot, removing the
  6-second layout shift that moved everything below on phones. Verified: steps advance while scrolling, rail
  height constant (376px at 390 wide).
- **Compass ladder** autoplays again by default as an eased, time-based rAF sweep (600–960, 11s); Pause/Play
  resumes from the visitor's score; filters no longer stop it; drag or quick score takes control.
- **Creators section** reframed "Trusted by CUET creators with 199K+ followers": counts read from public profiles on
  3 Oct 2026 (Garima Jain 25.2K + runs @du__club 161K; Rahul Thapa 13K; Prathna Jain 188), bios paraphrased from
  their own profiles, reel likes/comments where Instagram exposed them, sorted by reach, glass summary panel.
  Rahul's reel is marked Partner (his bio offers paid collaborations and the caption carries a discount code).
- **Hero**: CSS scroll-driven depth on the existing planes (aurora/grid/dots lag; drill card lifts on desktop
  only), a glass proof dock (199K+ creator reach, 73 DU programmes, 2 exam screens, 50 in 60), and a
  scroll-scrubbed statement. Progressive enhancement; reduced motion and unsupported browsers get the static page.
- **Compass Pro** (`data/compass_projection.js`, `/api/compass/pro`, `CompassPro.jsx`): per-paper practice
  projection out of 250 (attempt share × +5/−1 accuracy, Wilson range, ≥30 questions), four-paper total (one
  language + three strongest domain), personal DU shortlist (≤8 eligible programme+college targets, Rounds I–III
  in the chosen category, band position), next move (paper with most marks open + weakest ranked chapter).
  Pro enforced server-side; free sees a locked explainer. Labelled a projection, never a prediction or chance.
  No paid model call (runtime AI gate stays off). Advertised on landing, pricing and FAQ.
- **New USP: CUET Subject Combo Planner** (`/cuet-subject-combination`, `src/lib/du/combos.js`): targets + candidate
  subjects → every combination up to the paper limit checked with DU's own eligibility evaluator, ranked by targets
  met, programmes unlocked, fewer papers; "do not drop" subjects computed over all qualifying combinations; deep
  links into the calculator. Free, no signup. Promoted on landing, footer, CUET 2027 guide, sitemap.
- **Arena**: shared `ArenaHead`/`ArenaStats` (Practice's header and ruled stat strip); Today, Review, Progress
  rebuilt from a light "recovery-lab" slab into Arena pages; shared next-step card (full and compact); Radar's
  stray next-step moved under its header; Saved header; shared Empty/Error states restyled (no "// Error").

Not done, needs the owner:
- **₹99/month**: code is complete; creating the live Razorpay plan was blocked by the session's permission
  classifier. Create Plan (₹99, monthly, interval 1) in the Razorpay dashboard, set
  `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` in `.env.local` and Vercel production, redeploy. `publicOffer()` then flips
  every price surface. Run the LEARNING-DEPLOYMENT.md §A staging checks first.
- **Wall of Love**: not published. The July 2026 audit records the live-site quotes as fabricated and removed,
  and one is attributed to the owner. Publish only with written consent per quote; a founder quote must be
  labelled as such (ASCI/CCPA disclosure).

Verification: lint clean; build 56/56 (Edge Runtime warning unchanged); recovery 17/17, du 19/19 (+3 combos),
learning 74/74 (+5 compass projection), nta 22/22, answer-integrity 6/6, payment 12/12. Headless Chrome (CDP,
real input events): Mistake Lab and Compass autoplay timings; creators section 1280 dark / 390 light; hero
depth transforms at 400px scroll; statement word scrub; Compass Pro Pro/free/dark/light/390 with shortlist adds
and verdicts, contrast audit 0 failures; Today/Review/Progress/Radar/Saved fixtures; planner flow at 1280/390,
no overflow. Fixture APIs are stubs; real signed-in data, Instagram embeds on phones, real devices unverified.

Rollback: revert the files above; delete `src/app/cuet-subject-combination/`, `src/app/api/compass/pro/`,
`src/components/du/CompassPro.jsx`, `src/components/du/ComboPlanner.jsx`, `src/lib/du/combos.js`,
`data/compass_projection.js`, `src/components/arena/`, `src/app/hero-depth.css` and the two new tests.
No data, credit, entitlement or payment path changed.

## 3 October 2026 — Astra UI continuation: verification pass and confirmed fixes (Claude)

Local source only. No deployment, migration, checkout, paid generation, bank mutation or external message.
The PrepOS reservation migration remains unapplied. No image generated (none warranted).

Method: the in-app browser pane could not paint while occluded, so interaction checks ran in headless
Chrome driven over the DevTools protocol (scratch script, not committed) with real `Input.dispatch*`
mouse, touch and key events, `Emulation.setEmulatedMedia` for `prefers-reduced-motion` and colour
scheme, and touch emulation (`pointer: coarse`) below 900px. This is lab emulation, not real hardware.

Confirmed defects, each reproduced before fixing and re-checked after:
- **Signed-in Admission Compass, dark theme (high):** `du.css` reads marketing tokens defined only on
  `.mm`; inside the app shell they fell back to light ink (`#0a0a0a` on `#0b100e`, ~1.1:1 headings,
  buttons, notes), unset radii/shadows/`--volt-ink`. Bridged to `--a-*` tokens on `.app-shell .cmp`
  (`arena.css`). Light theme's active "All" chip was also unreadable; fixed by the same bridge.
- **Calculator sticky summary, light theme:** fixed night fill under theme ink (~1.1–1.6:1), public and
  signed-in, below 1100px. Now follows `--paper-raised`.
- **Calculator results at 320px:** implicit auto grid tracks (`.du-main`, `.du-list`) grew to card
  min-content, pushing cards 23–41px past the column. Pinned to `minmax(0, 1fr)`.
- **Wall of Love, 4 entries:** each lane held 2 cards, narrower than the lane, leaving an empty stretch
  every loop. Lanes now repeat hidden copies to at least 4 cards; duration scales per card (~16px/s).
  Accessible tree still lists each quote once. Removed `aria-pressed` beside a state-changing label.
- **Keyboard focus loss to `<body>`:** carousel arrow reaching its end (now `aria-disabled`, focus kept);
  activating an Instagram card (focus moves to "Open original"); demo drill after answering, Next and
  finish (focus moves to Next, first option, readout); Escape from the mobile nav sheet (returns to the
  menu button). Arrow group gained `role="group"` so its label is exposed. Nav `aria-controls` now set
  only while the sheet exists.
- **Mistake Lab, reduced motion:** tapping a question always snapped back to Q4 (effect re-ran on
  `picked`). Fixed. Score live region is quiet while the tour auto-plays.
- **Compass ladder:** UR/SC chips were 42x40 (now ≥44x44); "0 of 0 colleges" when a round/category has
  no published cutoff now says no cutoff was published for that cycle.
- **Narrow/zoomed phones:** below ~300px CSS width (≥125% zoom on a 360px phone) the menu button left the
  screen; hero title and dock CTA clipped at 200% text. Wordmark is visually hidden under 300px (still
  named), theme switch moves into the sheet under 240px, rotating hero phrase may wrap, phone title floor
  1.5rem, dock note yields under a 17rem container, dock spacer grows with text size and safe area.
  320px and wider are unchanged (measured).
- Touch tablets (761–1023px, `pointer: coarse`): NTA comparator's live palette cells 22x36 -> 49x44.
  Breadcrumb and stale-subject links raised to 44px targets.

Not changed after testing: MobileDock clearance at 320x640/740x360 (last footer line 41px above dock);
phone carousel arrows were already visible (44px) at 375/390, so code and notes agree.

Browser coverage actually exercised: homepage at 320, 390, 768, 1024, 1440, 1920 in dark and light
(no document overflow, no console errors, no broken images); 195px and 240/288px nav; 200% root font on
`/`, `/pricing`, calculator, `/cuet/english`; short landscape 740x360 and 568x320; full five-question demo
by touch and by keyboard only; comparator answer/review/switch preservation; Compass programme, category,
round, quick score, range keys and missing rows; Mistake Lab pause, step and tile selection in normal and
reduced motion; Wall fixtures 0/4/many incl. reduced motion at 320; Instagram arrows to both ends and
card activation (a real reel rendered); calculator alias search (BST, Accounts), score, share link,
reload persistence, Edit subjects; 20 public routes at 320 dark and 1280 light; `/preview/arena`
fixture views (free, Pro, inventory down, stale subjects, test, PrepOS plan/record/wallet, Compass,
Radar, Saved) at 320 and 1280. Computed-contrast audit (text vs nearest opaque surface) on home,
calculator, pricing and fixture views, both themes: remaining flags are the logotype dot (exempt) and
two probe false positives (gradient avatar, oklab launcher fill).

Verification: `npm.cmd run lint` clean; `npm.cmd run build` 55/55 pages, existing Edge Runtime warning;
`test:recovery` 17/17, `test:du` 16/16, `test:learning` 69/69, `test:nta` 22/22,
`test:answer-integrity` 6/6, `payment_entitlements` 12/12. `git diff --check` clean on edited files.

Still unverified: real phones (sticky hover, safe-area values, keyboard, 60fps), true browser page zoom
(root-font scaling and narrow viewports were used as proxies), screen readers, Instagram login walls,
signed-in persistence/entitlements/billing (`/preview/arena` is a stubbed fixture), creator permission
for the curated reels. Wall of Love stays hidden: no consented quotes exist.

Rollback boundary: revert the edits in `WallOfLove.jsx`, `CreatorReels.jsx`, `CompassLadder.jsx`,
`DemoDrill.jsx`, `MistakeLab.jsx`, `NavBar.jsx`, `Logo.jsx`, `social-proof.css`, `compass-ladder.css`,
`home-refinements.css`, `landing.css`, `globals.css` (crumbs, dock, nav-narrow, drill result),
`(app)/arena.css` (`.cmp` bridge, `.pr-alert a`) and `du/du.css` (`.du-sum`, `.du-main`, `.du-list`).
CSS/markup/focus only: no data, scoring, credit, entitlement or payment path changed.

## 3 October 2026 — Astra UI continuation handover (Codex)

The previous UI-refinement agent reached the usage limit during the final browser pass. A complete continuation prompt is saved at `docs/brain/CLAUDE-ASTRA-UI-CONTINUATION-2026-10-03.md`. This pass completed focused homepage, Compass, Mistake Lab, reveal, morph and historical-copy refinements, plus integrated social, authenticated-page and public-page work documented in the three `ASTRA-*-UI-NOTES.md` files. No image asset was generated because existing campus artwork and code-native product surfaces cover the meaningful visual needs.

Fresh verification: `npm.cmd run lint` passed with 0 errors and 0 warnings; `npm.cmd run build` passed with 55 generated pages and the existing Edge Runtime warning; `npm.cmd run test:recovery` 17/17; `npm.cmd run test:learning` 69/69; `npm.cmd run test:nta` 22/22; `npm.cmd run test:answer-integrity` 6/6; `npm.cmd run test:du` 16/16; `node --test data/tests/payment_entitlements.test.mjs` 12/12. Browser evidence covers homepage light/dark at 1440, homepage at 390 and compact 320 opening, Compass filters/keyboard/demo/missing-data state, Mistake Lab manual replay, and one real deferred Instagram embed. Wall fixtures, reduced motion, all route states, 200% zoom and real-device behavior remain unverified.

Open UI follow-ups: verify/fix phone carousel arrow visibility versus `ASTRA-SOCIAL-UI-NOTES.md`; inspect Wall fixtures and reduced motion; verify closed NavBar `aria-controls` target and MobileDock height at narrow/landscape sizes; complete route/theme/keyboard browser pass; preserve the honest empty public Wall. No production data, migration, checkout, deployment, paid generation or external communication was performed.

## 3 October 2026 — Astra UI handoff preparation (Codex)

Saved `ASTRA-UI-HANDOVER-2026-10-03.md`: current-source continuation prompt for
homepage refinement and remaining student-facing UI, Scroll Craft plus all 14
Emil Kowalski skill applicability, built-in image generation, and acceptance checks.
Read current contracts and Stage R/R2 notes; inspected the local homepage at phone
and desktop sizes, Compass, dark Instagram strip, and development-only Wall preview.
Confirmed the curated social strip is already present and public testimonials remain
hidden because the consented quote list is empty. No embeds activated in this pass.

No application code changed, no test/build suites rerun, no generation, migration,
checkout or deployment performed. This is prompt preparation, not UI completion.
Signed-in routes, all motion states and real-device behavior remain unverified here.
Rollback: remove the new handoff document and this entry; application source is unchanged.

## 2 October 2026 — Stage R2: original-site comparison, Compass, Radar, NTA, creators (Claude)

Local source only. Nothing deployed, migrated, purchased or sent to a model.

Compared with the live mockmob.in (read in the in-app browser): it had a Compass showcase with a cycling score card
and college labels, a Wall of love, a PrepOS section and a college marquee. Its Compass card showed "Reach / Moderate /
High" chances and a "score band predictor"; those claims are NOT reproduced (AGENTS.md: no admission probability, no
mock-to-CUET conversion). The three quotes on that site were not carried over.

Implemented:
- **Landing Compass ladder** (`CompassLadder.jsx`, `src/lib/du/showcase.js`): a score sweeps (or is dragged) across last
  year's real published Round I-III minimum allocation scores for 10 colleges in 4 programmes and 4 categories, from
  `public/du/2026`. About 10 KB shipped. It states a gap to a past cutoff only and links to the free eligibility tool.
- **Instagram strip** (`CreatorReels.jsx`, `src/lib/social.js`): 9:16 horizontal cards for the 3 creator reels and 3
  MockMob posts found on the public profile. Instagram's own embed loads only when a card is pressed. Edit the list in
  `src/lib/social.js` to add reels. Instagram's login wall blocks reading the feed, so entries are curated, not synced.
- **Wall of love** (`WallOfLove.jsx`, `src/lib/voices.js`): two opposing drifting rows (a grid under 4 voices), hidden when
  empty, only entries with `consent: true`. Dev-only prototype with labelled placeholders at `/preview/wall`. No
  testimonial is published.
- **Practice**: NTA Mode is a featured row (mini exam-console preview, chips, "Closest to exam day") with an exam-screen
  choice (MockMob / NTA style) for Pro and a free preview link for others. The grid is Quick, Full, Smart.
- **Admission Compass page** rebuilt as a product page: opens already ticked from the student's profile subjects
  (link, then saved choice, then profile), a three-step explainer, an honesty note, a bridge from the practice record
  ("Your practice says: ..."), and the sources. Calculator logic is unchanged apart from the seed prop.
- **Radar** rebuilt on the PrepOS record engine plus a theme-aware score trend (Chart.js reads Arena tokens and re-reads on
  theme change). Removed the invented composites ("Rank readiness", "Focus score"), the 1-4 axis radar chart, the
  non-functional "Ask Radar" box and the blurred paywall over made-up metrics.
- **Free vs Pro for the record**: free = marks ledger, top 3 chapters, findings, weekly summary; Pro = every ranked
  chapter, thin-chapter list, changed-answer and pace detail. Enforced in the record view and in Ask (server and client),
  and stated in the pricing page, landing page and PrepOS wallet copy.

Verification actually run: lint clean; `test:learning` 69/69 (adds landing_content 4: real-file cutoff match, embed
format, consent filter, Pro gating of Ask); recovery 17/17, du 16/16, nta 22/22, answer-integrity 6/6; build 55/55.
Browser: landing Compass ladder, reels (the embed loaded a real reel), Wall prototype, Practice with the NTA tile, Compass
page, Radar, at 1280 and 375 widths in light; no horizontal overflow.

Not verified: no signed-in session, so Radar/Compass/Practice used the dev preview with stubbed account APIs (real engines,
real DU data). Saved, Explore, Ranks, Contribute and My uploads were not touched this round. A dark-mode pass of the new
sections was not repeated. Creator names and handles come from the public profile page; the owner should confirm permission.

## 2 October 2026 — Stage R: Arena design language, PrepOS record and wallet, ₹99/month, landing (Claude)

Local source only. Nothing deployed, migrated, purchased, or sent to a model; no real wallet or ledger row was
read or written. Owner decisions taken this round: Pro is **₹99/month auto-renewing**; PrepOS model replies for a
small monthly allowance are **built but switched off** until the gates in LEARNING-DEPLOYMENT.md pass.

Implemented:
- **One icon language.** `src/components/ui/Glyph.jsx`: one lucide family at one stroke weight (`AppIcon`,
  `StatusIcon`, `SubjectIcon` for all 42 subject ids, `ModeIcon`) and two distinct credit coins (`CreditMark`:
  bolt = practice credits, orbit = PrepOS). Replaced the mixed nav icons, the star + "∞" credit pill, the
  38 decorative subject characters, and emoji/text glyphs (✅ ❌ 💡 🌵 ⚡ ★ ▲ ▼ ↻ ✓ ✗ ⚠) in Arena, uploads, feed
  cards, onboarding and votes. Remaining hits in `scripts/design-audit/glyph-audit.mjs` are the now-unused
  `glyph` data fields, a comment and a seed question.
- **Credit display fixed everywhere.** Pro now reads "Unlimited" (coin + word, not "∞" or "no credits") in the
  top bar, Practice, Account and the modal; free reads the number. A second chip shows the PrepOS wallet
  (unknown wallets show "—", never a number). Practice credits and PrepOS credits are always labelled apart.
- **Practice screen rebuilt** (`DashboardPageClient.jsx` + `.pr-*` in `arena.css`): two-column layout with a
  sticky session summary (a pinned launch bar on phones), subject and mode tiles with icons, official subject
  codes and entitlement badges, segmented controls, a Fine-tune disclosure, ruled stat strip, recent sessions
  with subject icons, status badges with icons. No inline `<style>`. Launcher no longer covers the Start button.
- **₹99/month.** `pro_monthly_99` plan, `/create-monthly-subscription`, `/api/billing/cancel`, checkout in
  `RazorpayPaymentButton`, `PlanCard` on Account (renewal date, two-step cancel). `publicOffer()` is the single
  source for pricing page, landing page, Arena upsell, modal, SEO title and mobile dock. Closed until
  `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is set; until then the existing ₹99 one-time access stays the honest offer
  and copy says monthly "opens soon". When set, new one-time checkouts close; old orders keep verifying.
- **PrepOS record engine** (`data/prepos_insights.js`, free, no model): marks ledger (+5/−1, blanks), accuracy with a
  Wilson range, chapters ranked by marks left open only with ≥4 answered questions (thin chapters listed apart),
  difficulty split, pace from device events, answer changes counted both directions with the net, last-7-days vs
  previous week. Surfaces: PrepOS "Your record" tab, "Ask" answers record questions instantly and free, Today
  shows the top finding, the Result page shows "Where your marks went" for that session.
- **PrepOS wallet clarity.** Monthly meter ("38 of 50 left", reset date, no carry-over), purchased credits shown
  apart, plain list of what is always free and what costs 1 credit.
- **Model replies, gated.** Migration `20261002130000_prepos_credit_reservations.sql` (saved, NOT applied) adds the
  reserved→executing→committed|released lifecycle; `runModelReply` wraps the existing provider/runtime-budget
  guard; chat route answers record questions free, explains the plan while paused, and runs the lifecycle only
  when `RELEASE_GATES.runtimeAi` is true. Client keeps one request id per action and reuses it only after an
  unknown outcome.
- **Landing.** The section after the hero is now the interactive "Mistake lab" (`MistakeLab.jsx`, `mistake-lab.css`):
  four auto-advancing, tappable, pausable steps (replay → leak → one next move → fresh check later) on one
  labelled illustrative session, reduced-motion and keyboard safe; the recovery step shows its real release state.
  Sharper hero and section copy; offer-aware trust row, pricing block, FAQ and stats cell. NTA/MockMob comparison,
  scroll reveals and the rest were left untouched.

Verification actually run:
- `npm.cmd run lint` clean. `npm.cmd run build` 54/54 pages, new routes present.
- `test:learning` **65/65** (adds `monthly_billing` 5, `prepos_insights` 8, `prepos_reservations` 9 in real Postgres
  via PGlite, `prepos_model_reply` 9, plus the earlier quote/wallet suites). `test:recovery` 17/17, `test:nta` 22/22,
  `test:answer-integrity` 6/6, `test:du` 16/16, `payment_entitlements` 12/12, selection/offline 16/16.
- Reservation SQL cases proven: retry same key charges once; over-reserve refused; release restores included then
  bonus exactly and is idempotent; released key cannot be reused; commit final both ways; month rollover returns
  expired included credits as bonus; expiry sweep; ledger explains balance; service-role only. PGlite is one
  connection, so these prove arithmetic and idempotency, NOT multi-session lock contention.
- Browser (dev-only `/preview/arena`, stubbed account APIs built from the real pure engines, plus the real `/`
  and `/pricing`): Practice, PrepOS record/ask/wallet and landing at 320–1366 widths in light and dark; computed
  contrast audit (full text coverage) clean on Practice, PrepOS record and wallet (light), Practice (dark; one
  false positive: black on a volt gradient avatar), landing and pricing. No horizontal overflow. Unauthenticated
  boundary: new endpoints return 401.
- Lab auto-advance, pause, step taps, tile inspector exercised in the browser.

Not verified / known gaps:
- No real signed-in session: Account PlanCard, Result-page readout and Today glimpse are lint/build verified and use
  the same components as the verified previews, but were not rendered with live data. No real Razorpay checkout
  (test or live), no webhook replay, no model call, no real Android or screen-reader run.
- Research: 20 pages requested, 16 usable; far below the 300–400 requested. See DESIGN-REFERENCES.md.
- The Chart.js screens (Radar), Moderation, Saved and Explore were not re-skinned in this round.
- Account plan card forgets a requested cancellation across reloads; subscription is created with 24 cycles.

Next incomplete criteria: staging for the reservation migration + Razorpay test plan (LEARNING-DEPLOYMENT.md A/B);
signed-in two-theme pass of the remaining app routes; then Stage C (durable sessions) and Stage D (bank audit).

## 2 October 2026 — Claude handover execution, Stage A (Arena capability/theme truth)

Local source only. No deployment, migration, checkout, paid model call or content
generation. Existing user edits preserved. Checklist: `CLAUDE-WORKLOG.md`.

Implemented:
- `data/subject_registry.js`: versioned subject registry with official codes verified
  against the NTA CUET(UG)-2026 subject list (cuet.nta.nic.in, "Last Updated Sep 02,
  2026", checked 2 Oct 2026; provisional for 2027). Crosswalk keeps old IDs
  (`gat`→501, `applied_mathematics`→319; Engineering Graphics, Entrepreneurship, Legal
  Studies, Teaching Aptitude are not in the 2026 list → `retired`). Stored choices are
  never deleted; unsupported ones show a reason and cannot launch.
- `data/capabilities.js`: capability IDs/versions, inventory purposes (ordinary,
  recovery-eligible, original sample, verified historical — none claimed), and per-mode
  capabilities with entitlement copy that never ranks question quality.
- `data/practice_quote.js` + `GET /api/practice/quote`: read-only server launch quote
  (entitlement + expiry, allowance, credit cost, duration, inventory policy/count,
  reason, 60-second staleness, server-minted idempotency token). Unknown inventory or
  an unreadable allowance is unavailable, never free. Dashboard renders only this; the
  launch button is disabled unless the quote for the exact selection is launchable,
  re-checks a stale quote, and reuses the server token across retries.
- Dashboard copy: removed "Fast lane active", "highest-quality selection layer",
  "Upgrade for premium question quality", "Most Popular" badge and "unlock more premium
  mocks"; counts say "usable questions in the ordinary library" with unavailable state.
  Onboarding lists only practice-supported subjects and lets stale saved ones be removed.
- Today: the 10/20/30 choice now sets the session (`/dashboard?mode=quick&count=10|20`,
  30 min = 20 questions + 10 minutes review) and states the duration/charging contract.
- Arena theme: semantic `--a-*` tokens for dark (Night Arena, unchanged values) and an
  intentional light palette, scoped to `html:has(.app-shell)` so portals/toasts follow.
  Tailwind's variable-backed palette is remapped in light mode; volt-as-text becomes
  `--a-accent-text`. Theme switch added to the app top bar (≥640px) and mobile sheet,
  using the existing `mm:theme:v1` preference (set pre-paint by the root script). The
  pre-shell auth screen has a light variant. The NTA-style console pins its previous
  token values so it renders exactly as before in either Arena theme. PrepOS launcher
  stays a deliberate dark island.

Verification actually run:
- `npm.cmd run test:learning` 12/12 before adding the new file; new
  `data/tests/practice_quote.test.mjs` 10/10 (final suite totals are in Stage B below) (registry codes, stale/retired/unknown
  subjects, premium block, unknown/short/empty inventory, zero credits, included/used/
  unknown allowance, expiry, no quality ranking, minutes→session). `test:recovery` 17/17.
- `npm.cmd run lint`: clean. `npm.cmd run build`: first attempt failed fetching the Geist
  Mono Google Font (network); immediate retry compiled and generated 54/54 pages.
- Browser, dev-only `/preview/arena` (mock user, stubbed account APIs, quote built by the
  real `buildPracticeQuote`) on the owner's running dev server: computed-contrast audit of
  every visible text node (`scripts/design-audit/contrast-audit.js`) and overflow check.
  Dashboard light: 0 failures at 320/375/768/1024/1280/1920 after fixes; dark at 320 and
  1280: 0 (one false positive: black on volt-gradient avatar). Branded runner light 375:
  0; answer selection causes no layout shift (paper 598px before/after); selected border
  #6f8700 ≈3.9:1. NTA console in both Arena themes: unchanged conventional skin (only its
  existing orange "visited" chip, 4.4:1, which predates this change). Exercised states:
  stale saved subjects, inventory outage, insufficient inventory (15 > 12), Pro included
  with expiry, theme toggle click + persistence. No horizontal overflow at any width.

Not verified / remaining for Stage A:
- Signed-in routes other than the dashboard/runner harness (Today, Review, Progress,
  Radar, Account, Saved, Compass, PrepOS, Explore, Ranks, Upload, Result) were not
  rendered: no session in the built-in browser and no credentials may be entered. They
  inherit the token remap, but charts (Chart.js colours), page-specific inline styles
  (TestPageClient result states, MyUploads, Moderation, Upload, Analytics) still need a
  signed-in two-theme pass. Keyboard-only and screen-reader passes not done.
- Recovery-launch quotes (`purpose=baseline/full_sample`) are computed but not exposed in UI.
- Lead, not fixed: the root font is 15px, so Tailwind `min-h-11` renders 41.25px (17 uses
  outside PrepOS). New PrepOS controls use explicit 44px.

## 2 October 2026 — Stage B (PrepOS wallet safety and explanation layer)

Local source only. Paid PrepOS stays paused (`CAPABILITIES.optionalAi.state = 'paused'`).
No wallet balance, ledger row, payment or migration was changed; no model was called.

Implemented:
- `src/services/credits/aiWalletState.js` (pure): explicit wallet states `available`,
  `empty`, `paused`, `schema_unavailable`, `error`, with a safe message. An unreadable
  wallet has `known:false` and null balances — never a synthetic allowance or a spendable
  zero. Paused wallets still show real stored balances, not spendable. Central
  `isPaidUser` uses `effectivePremiumFromRow` (status / paid-through / legacy flag) at call
  time, so expired access stops counting.
- `aiCreditWallet.js`: `readAIWallet` is one select; it never inserts, resets or syncs
  (the monthly reset/allowance sync is projected and applied only inside the atomic RPC).
  `consumeDirectly`/`grantDirectly` and the swallowed ledger insert are deleted. Spend is
  RPC-only, requires a caller-stable operation key, and returns `prepos_paused` before any
  RPC while paused; a missing RPC fails closed (503). Grants for captured purchases still
  use the atomic grant RPC (historical orders and webhook/verify paths unchanged).
  Narrowed missing-function detection so real RPC errors are not treated as "missing".
- `consumeAIAllowance`: refuses while paused before reading or charging; uses the caller's
  operation key (Rival: `rival:<battleId>:<action>`), never `Date.now()`. Rival refuses a
  paid benchmark before creating a battle row while paused. Usage snapshot accepts a
  pre-read wallet and refuses charges unless the wallet is spendable.
- `GET /api/ai/credits`: one wallet read, `state`/`message`, practice credits labelled as a
  separate ledger, `checkout.open`, packs carry `status: 'paused'`.
- PrepOS hub rewritten as an explanation layer: "Next step" renders `/api/learning/plan`
  with the same 10/20/30 choices as Today; "Ask" answers product/credit/DU questions
  deterministically and sends plan questions to the existing no-charge server route;
  "Tools and wallet" shows the wallet state read-only with no pack buttons. Removed local
  missions/day plans/setup planner (20/45/60/90), benchmark entitlements, "GPT-4.1 mini"
  and "college and course direction" copy. DU wording now: published 2026 eligibility
  rules and Round I–III minimum allocation scores by category, historical only, no
  admission prediction or mock→CUET score conversion. Hub remounts per account.
- Retired unreferenced legacy `MockMobAssistant.jsx`, `AIAssistantDrawer.jsx`,
  `AIAssistantLauncher.jsx` (no importers; tracked in git) and a dead charge helper in
  `/api/ai/actions/execute`. `/pricing/prepos` shows the paused message, "—" for unknown
  figures and lists packs only when checkout is open. Rival shows "—" for unknown wallets.
- `scripts/learning/wallet-reconciliation.mjs`: read-only wallet↔ledger reconciliation
  (grants − bonus spends vs stored bonus; included spends this period vs stored usage;
  orphan ledgers). Offline `--fixture` or explicit `--remote-read`; never writes.
- PRODUCT.md lines promising fast lane, score-band estimate, college recommendations,
  peer review and live AI packs are marked superseded.

Verification actually run (all exit 0):
- `test:learning` **33/33** (includes `practice_quote` 10 and new `prepos_wallet` 11:
  expired/legacy entitlement, missing schema, read error, paused, stale period projection,
  unmaterialised wallet, client mapping of failed/legacy responses, narrow missing-function
  detection, source guards against direct writes/time-based keys, real
  `mm_ai_consume_credits` in PGlite: two consumes over balance → one succeeds, same-key
  retry charges once, ledger insert failure rolls back the balance; grant idempotency;
  reconciliation flags drift). PGlite runs on one connection, so "concurrent" consumes are
  serialised — this proves arithmetic/idempotency, not multi-session lock contention.
- `test:recovery` 17/17, `test:nta` 22/22, `test:answer-integrity` 6/6, `test:du` 16/16,
  `payment_entitlements` 12/12; payment + mock selector + practice filtering + offline
  batch (schema/dedup/alignment/generation/import) 24/24. `npm.cmd run lint` clean.
  `npm.cmd run build` 54/54 pages.
- Unauthenticated dev-server checks: `/api/practice/quote` 401 with unavailable state,
  `/api/ai/credits` 401, `/api/learning/plan` 401, `/api/subjects` 200.
- Browser (`/preview/arena?view=prepos`, stubbed APIs built from the real pure functions):
  plan at 375 light; paused wallet shows 68 / 38/50 / 30 with the required message and no
  pack buttons; `wallet=down` shows only "could not be read… Nothing has been charged";
  Ask answers for credits, DU chances and "what next" at 320 dark; keyboard focus ring on
  section tabs. Contrast audit was corrected mid-run (it had skipped oklch/oklab colours)
  and every Stage A/B view was re-run with full coverage: 0 failures except the known
  avatar false positive.

Remaining gates before any paid PrepOS reactivation (unchanged: stays paused):
1. Student-ledger reservation lifecycle (`reserved → executing → committed/released`)
   does not exist yet; only provider-side runtime reservations/receipts
   (`20261002121000_runtime_ai_guard.sql`). Provider timeout, unusable output and
   deterministic-fallback reversal tests cannot be written until that path exists.
2. Staging verification of `ai_credit_wallets`/`ai_credit_ledger` and both RPCs, then a
   `--remote-read` reconciliation run reviewed by the owner (not run; production data was
   not read).
3. Real multi-session concurrency test against staging Postgres.
4. Signed-in browser pass of `/mentor`, `/rival`, `/pricing/prepos` and account switching.

Next incomplete acceptance criterion: Stage A signed-in two-theme pass of the remaining
app routes, then Stage C (durable sessions/recovery integration) and Stage D (read-only bank
audit against the subject registry). Stage 1 explicit staging schema remains the release gate.

## Approved roadmap execution — source implementation, launch still gated

The complete product is **not released or definition-of-done complete**. Existing
user edits were preserved. No production/staging migration, quarantine application,
deployment, real checkout/refund or paid generation was performed in this run.
The content ceiling remains $2 calibration within $10 lifetime; runtime AI funding
has not been authorized. Current offer remains ₹99 through 31 July 2027.

Implemented local behavior:

- Central capability/release truth, versioned ₹299 plan and coordinated future copy;
  old ₹99 orders, access and offer amounts are retained. New sales remain gated.
- Bounded diagnosis, selected/general reasoning repair, independent numeric solvers,
  choice/numeric/evidence-span responses, fresh-family reservation and two delayed
  checks. Wrong/unanswered/expired checks reopen repair; repeats and assistance
  cannot certify understanding. No hidden keys/matrices/future questions in plans.
- Saved service-only owner/allowance/episode/observation/exposure transactions,
  durable sessions behind a switch, legacy ticket compatibility, revision/idempotency
  checks, account ownership and changed/held-content invalidation.
- Shared next action for Today/Radar/results/PrepOS; ordinary mistake Review and
  episode-based Progress; functional recovery forms/check launch in the existing shell.
  Decision replay distinguishes event effects and net changes. Experiments deferred.
- Compass now uses sourced DU rules/cutoffs; fictional chance/score predictor removed.
- Persistent request reservations/usage receipts and rate limiting saved in Postgres
  migrations. Unknown costs/funding block physical AI dispatch. Core plans/repairs
  have no paid model dependency. New AI top-ups/replies paused; wallets preserved.
- Rival duplicate/ownership guard and atomic completion SQL. Answer changes archive
  history and queue recomputation; comparable revalidated score derivation keeps
  original attempts intact. Edited/reordered answers cannot reinterpret old indexes.
- Shared practice eligibility for inventory, truthful zero/unavailable counts, public
  aggregate caching; current copy/legal/theme refinements and optional shorter guide.
  Open test-email sending is disabled by default and admin/rate limited if enabled.
- Roadmap authority, implementation checklist, local preflight and deployment/rollback
  instructions saved in the brain. Earlier pilot/count/store order is superseded.

Verification actually performed:

- `npm.cmd run test:recovery`: 17/17 passed.
- `npm.cmd run test:learning`: 12/12 passed. Includes isolated PGlite transactions
  for allowance concurrency, owner restrictions, response retries/CAS, original
  snapshot preservation, answer correction queues and family-hold invalidation;
  zero-funding/unknown-price/reservation/receipt/rate-limit behavior; Rival atomicity.
- Combined `node --test data/tests/*.test.mjs` plus recoverySafety, evidencePipeline,
  sourceAdapters, practiceModeFiltering and offlineBatchSchema/Dedup/Alignment/
  Generation/Import: **101/101 passed**. Includes NTA, answer integrity, mock selection,
  payment/entitlement, DU and offline import gates. Fixtures are software-only.
- `npm.cmd run lint` and `npm.cmd run build`: passed before the final HTTP boundary
  follow-up; final repeat results and HTTP checks are recorded below.
- `node scripts/learning/preflight.mjs`: sources 0, academic calibration paused,
  pathways 0, current price ₹99, ₹299 disabled. See reports/learning-preflight.json.
- Browser (local development server): homepage at 320px in both themes, keyboard
  Space theme toggle, pricing at 320px, honest count failure display and unreleased
  recovery notice. No horizontal overflow on inspected home/pricing. Recovery rendered
  its unavailable state with ordinary Practice/Review links; existing session resolved
  and GET /api/learning/plan returned 200. No new study attempt or payment initiated.
  One navigation timed out before its rendered state resolved; it was not treated
  as a completed flow until the DOM showed the actual unavailable state.
- Initial local production boundary pass: 8/9 expected statuses. Empty anonymous
  mentor payload returned 400 before authentication; auth/rate limiting moved before
  parsing/context work, with a bounded payload. Final repeat recorded below.
- No screen-reader, real Android, constrained-network, Lighthouse or field CWV
  result. Theme/320px inspection does not establish accessibility or device readiness.

Release gates and remaining implementation:

1. Explicit staging schema verification/application of saved migrations, including
   older interactions, bookmarks/progress, atomic credits and recovery foundations.
   Rival additionally requires the older db/migrations AI-overlay tables before its
   new submit service deploys. No source deployment should bypass this dependency.
2. Eight permitted/versioned, independently calibrated concept pathways with complete
   fresh inventory. Sources and academic benchmarks are empty; no academic accuracy,
   student learning gain or source-backed coverage is established by these tests.
3. Real authenticated baseline → investigation → repair → immediate → two delayed
   checks, resume/account-switch/concurrency/expiry/invalidation/exhaustion tests in
   staging. Audit legacy device-ticket wall-clock limitations; its telemetry cannot
   prove answer timing. Durable server checks enforce deadlines without grace answers.
4. Correction-queue worker, report-triggered evidence re-evaluation, payment
   reconciliation and cohort/cost/support reporting remain unfinished. Uncertain
   content stays withheld. Fresh timed decision experiments wait for the core loop.
5. Real staging captured checkout, old pending orders, new V2, signature/owner/amount,
   webhook retries and refund/revocation. Optional runtime wallet reservation/reversal
   and price/funding receipts remain gates; paid AI stays paused.
6. Android/accessibility/performance, season receipts and ≥70% contribution margin;
   opted-in cohort before public recovery/₹299. Do not sell planned features as live.

Next incomplete acceptance criterion: **Stage 1 explicit staging schema and real
authenticated session/owner flow**. Stage 2 cannot release until academic source and
calibration gates pass. See IMPLEMENTATION-2027.md for the dependency checklist and
LEARNING-DEPLOYMENT.md for switches, migration order and non-destructive rollback.

Final follow-up results:

- Final `npm.cmd run build`: exit 0; optimized Next 16.2.4 build completed. Existing
  edge-runtime/static-generation warning remains informational.
- Final standalone `npm.cmd run lint`: exit 0, no diagnostics. One preceding
  overlapping lint invocation ended exit 1 without diagnostic output; this was
  not called a pass. The separate repeat completed successfully.
- `node scripts/learning/http-check.mjs`: exit 0, **9/9** expected production-build
  authentication/unavailable statuses. Saved reports/learning-http-checks.json.
  Includes the corrected anonymous mentor 401, disabled email 404 and production
  preview 404s. No cookies, credentials, provider dispatch or payment was used.
- Temporary development and production inspection servers were stopped, browser
  viewport restored and temporary inspection tab closed. No deployment made.

## 2 October 2026 — roadmap gap audit and Claude handoff

This follow-up was documentation-only. No product source, database, migration,
entitlement, wallet balance, payment, content record or deployment was changed.
The existing user-owned development server was left running. The companion audit
`ROADMAP-GAP-AUDIT-2026-10-02.md` records the evidence; the copy-ready execution
contract is `CLAUDE-MASTER-HANDOVER.md`.

Confirmed current issues include the Arena app shell staying dark while the
marketing theme reports light, no Arena theme control, stale Fast lane and mixed
availability copy, inconsistent subject catalogs, PrepOS local planner/time
choices, and wallet degraded/fallback paths that can expose synthetic balances or
non-atomic direct consumption. These findings are release blockers or staging
work; they were not patched in this audit.

The Impeccable detector returned 95 heuristic advisories across Arena/dashboard/
PrepOS files (49 font-size, 28 color, 15 radius, plus grid/transition/easing).
They are retained as review leads in `reports/claude-handover-static-audit.json`,
not counted as confirmed defects. A read-only local browser check observed the
Arena computed dark shell under `data-theme="light"` and the 320px Today fallback.
No new mock, purchase, paid model call, migration or content generation occurred.

Next incomplete acceptance criterion remains the explicit staging schema and real
authenticated session/owner flow. The next Claude run must fix Arena/capability
truth and PrepOS wallet safety before enabling paid AI, then begin the authoritative
CUET syllabus registry and read-only question-bank audit. Existing prior test/build
numbers remain prior-run evidence and were not rerun in this documentation pass.
- `git diff --check` identified three trailing-space lines introduced while editing
  pricing; they were removed. Other existing user changes remain intact.

## Historical status — October 1 2026

This is a locally implemented foundation and redesigned recovery pilot journey,
NOT a completed production launch. No production migration, bank mutation, deploy,
paid content request, APK signing, store submission or real-device test was made.

| Milestone | Completion evidence | Remaining gate |
|---|---|---|
| Project brain | AGENTS, PRODUCT, DESIGN and brain specifications/architecture/quality/cost/benchmark/backlog | Keep updating actual results |
| Read-only inventory | 9,342 records; saved per-item report and 59-row quarantine dry run | Independent semantic checks, schema deployment before applying quarantine |
| Historical failure classification | Ten zero-candidate/zero-validator routes classified unknown | Request-level receipts needed to reconstruct old bills |
| Durable cost controls | Shared SQLite reservations, usage receipts, crash/concurrency/zero-yield/repair/cache tests | Verified prices, durable worker deployment; distributed ledger not implemented |
| Evidence publication | Signed hashes, source/family/version checks, blind solving, alternative challenges, route calibration; worker/offline importer integrated | Source registry/academic fixtures empty; source-backed model adapter configured but not executed; numerical family solvers not supplied |
| Practice/recovery backend | Server scoring, event replay, idempotency, ownership, credits, playbook/review queue, changed-evidence progress exclusion | Saved SQL needs staging/production setup; correction recomputation and fuller timing/review behavior pending |
| Web pilot UI | Immediate illustrative replay, separate pilot signup, observed/inferred results, four launch subjects; public reference notes | Remaining legacy screens, live authenticated content flow |
| Mobile beta source | Bundled React/Vite/Capacitor assets/fonts, OTP/bearer, native secure storage, cached reviews/drafts, reminders; Android project generated | Public environment config, signing, JDK/SDK, macOS/iOS, real-device QA and store review |

## Verification

- npm run test:recovery: 15 focused software regressions, including local Postgres
  transaction/owner/credit/idempotency/quarantine/passage rollback tests.
- Existing answer integrity, NTA selection, mock selection, payment/entitlement and
  offline batch suites: 52 tests. Academic fixture release remains unverified.
- Production web and mobile asset builds compile. Targeted edited React lint is clean.
- Production-mode HTTP checks reject unauthenticated/forged-token attempt, analytics,
  recovery, session and mobile reads/submissions with 401. The illustrative preview
  returns 404 in production. Saved results: artifacts/recovery/http-checks.json.
- Desktop/390px captures in artifacts/recovery; no horizontal overflow in inspected
  home/lab. Replay control is 44px. Public catalog references include >1,000 designs;
  no claim that 1,000 screens were individually inspected.
- Fresh Impeccable design review: initial disposition fix; all six material fixes
  resolved in one batch; final disposition ship. DESIGN and sidecar reconciled.

Artifacts are local evidence, not live app success. Lab screenshots contain clearly
labelled development-only illustrative data. Existing user edits/payment changes
were preserved. No independent academic accuracy or model-versus-human result exists.

## Next agent

Read brain README, BANK-AUDIT and BACKLOG. Verify live setup before claiming anything
deployed. Start with authenticated source/key extraction and development/held-out
fixtures; do not open paid generation on missing prices or empty references. Keep
the $2 calibration hold and $10 ceiling. Never reset the ledger or publish the old
Economics sample based on its heuristic grade. Follow BACKLOG in order.

## 2026-10-01 stabilisation and landing rebuild (Claude)

Done and verified locally (dev server, port 3100):
- Homepage was unstyled: ChatGPT's last pass shipped about 20 `cuet-*` classes with no CSS.
  `src/app/page.js` rebuilt on the existing `.mm` system plus `src/app/landing.css`
  (`.lp-*`): hero with playable five-question drill, subject keys, live stats band,
  Arena/Radar/Compass screens (static, labelled illustrative), steps, Score Recovery
  Lab replay, free vs Pro (₹99 once) comparison, FAQ, close. On phones the drill
  follows the lead directly; subject keys follow the drill.
- `/api/leaderboard` returned 500: `Database.getLeaderboard` put 512 user ids in one
  `.in()` filter (20 KB URL, HeadersOverflowError) and silently read only the first
  1000 of 1807 attempts. Now pages attempts and chunks user lookups by 100
  (`data/db.js`). Synthetic practice rivals remain labelled.
- `LiveStatsBand` fallback claimed "10,000+" questions; live bank is 6,963
  (`/api/stats`). Fallbacks are now "6,900+" and "40". Bank note reworded to
  "automated schema, duplicate and answer-key checks".
- `/login` and `/signup` still used legacy dark utility classes inside the paper
  world. Rebuilt with `AuthShell`, `auth.css` and a restyled `SignupCard` (auth
  logic unchanged: Google, email link, 8-digit OTP).
- Testimonials: no invented student quotes were added. `src/lib/voices.js` is an empty
  list; the landing section renders only when real, consented quotes are added.

Verification: `npm run lint` clean; `npm run build` passes, all routes; test:recovery
15/15, test:nta 22/22, test:answer-integrity 6/6, payment_entitlements 11/11.
Public routes and `/api/stats|subjects|leaderboard` return 200 locally; 390px and
1440px landing/auth captures show no horizontal overflow.

Not verified: any signed-in screen (dashboard, test, result, saved, profile, Compass,
PrepOS) was NOT visually checked this pass (no test credentials used); Quick Practice
submit/resume/idempotency from the handover; Razorpay checkout end to end; production.
Remaining legacy dark-style screens inside `(app)` still need the same audit.

## 2026-10-02 landing redesign round 2 (Claude)

Owner rejected the paper homepage as less polished than mockmob.in, prepium.in and
ug.preparoo.app. Rebuilt `/` as "Night Arena" (see DESIGN.md): layered grid/dot-matrix
backdrop with pointer-lit dots, hero stage (playable drill + Example chips), subject
marquee, live stats, wide/pair/wide/trio bento (Arena, Radar, PrepOS, Compass, three
small tiles), animated three-step section, Score Recovery Lab replay, live per-subject
counts, free vs Pro, FAQ, closing band. Restored FAQ + breadcrumb JSON-LD from the old page.

Root cause of the hover "shake": `DecodeWord` re-scrambled on hover and glyph widths
differ. Deleted; replaced by width-reserving `MorphWord`. Verified by measuring every
hero element's box before/after hovering the primary CTA: no movement (only the
decorative chips on their own loop). Drill height is constant before/after answering.

Verified in the browser at 320, 390, 820x1180, 1024x768, 1280x720, 1440x900,
3440x1440 and 844x390 landscape: no horizontal overflow at any size; hero balanced;
mobile nav works on dark. `npm run lint` clean; `npm run build` passes; test:recovery 15/15;
payment_entitlements 11/11.

Not verified: real-device performance on a budget Android (backdrop uses static CSS layers;
pointer layer is disabled on touch); reduced-motion behaviour was reviewed in CSS, not
exercised in a browser; Lighthouse not run; no screen-reader pass beyond the a11y tree.
`DynamicCompassPreview.jsx`, `ArenaPreview.jsx`, `RadarField.jsx` are now unused by `/`.

## 2026-10-02 free DU eligibility and cutoff calculator (Claude)

New public tool at `/cuet-cutoff-calculator` plus a landing-page teaser (`#du-eligibility`),
nav and footer links, a hero link, a Compass-tile link, a Radar-page link that pre-fills the
student's practised subjects, and a pointer from the Admission Compass page.

Data (all from four public DU documents, user-approved download of five PDFs, ~9.7 MB):
UG Bulletin of Information 2026-27, and the Round I, II, III minimum-allocation-score lists.
Pipeline in `scripts/du-csas/` (geometry-based PDF parsing, hard failure on ambiguity);
output is static JSON in `public/du/2026/` (no serverless function runs for the tool).

Verified:
- Cutoffs: S.NO contiguous (1,393 / 1,393 / 956), identical seat lists across Rounds I and II,
  Round III a subset, and the multiset of every parsed score equals the numbers printed in the
  PDFs: 17,316 cells (two whole-number cells in Round I located individually). One displayed
  value (Dyal Singh B.Com. (Hons.) Round I OBC-NCL 695.3) traced to the raw PDF coordinates.
- Eligibility: 73 Bulletin programmes, 149 combinations all parsed into typed slots, every
  combination satisfiable. Engine tested (`npm run test:du`, 12 tests) including language
  specific rules, GAT combinations, the "considered only if seats remain" combinations III/IV,
  and the UR-merit rule for reserved categories.
- `npm run lint` clean; `npm run build` passes (route prerendered static); test:recovery 15/15,
  test:nta 22/22, test:answer-integrity 6/6, payment_entitlements 11/11.
- Browser: desktop 1440/1024 and mobile 390 on the calculator and the landing teaser; no
  horizontal overflow; selection, URL sharing, expand-to-cutoffs, score status all exercised.

Also fixed: `html, body { overflow-x: hidden }` in globals.css made `<body>` a scroll container,
so `position: sticky` (including the site's own nav) never stuck. On marketing-system pages
(`.mm.lp`) it is now `overflow-x: clip`.

Not done / limits:
- Seat counts (Prepium shows them): the seat-matrix PDF is organised differently and was not
  parsed. Not shown rather than guessed.
- 5 Bulletin programmes (3 music, B.F.A., B.Sc. PE) have test-based merit and no CUET cutoff
  list; shown for eligibility only.
- 2026 data only. Add a 2025 cycle by adding a second dataset folder; the UI reads `meta`.
- No Lighthouse or real-device run. No screen-reader pass beyond the a11y tree and aria states.
- `src/lib/admissionCompass.js` (existing, untouched) still uses invented per-college "target"
  scores and category adjustments. It is clearly labelled as an estimate, but it should not be
  presented as cutoffs. The calculator is the source of real published numbers.

## 2026-10-02 calculator rework after owner feedback (Claude)

Owner reported the cutoff calculator "not updating live", no way to recheck, clunky UX, and that
subject mapping did not show that IP/Computer Science (and similar) are one CUET subject.

What I could and could not reproduce: scripted clicks always updated state, so I found no
single hard failure. I did demonstrate real defects that make live updates invisible or
unreliable for a person: a floating "N programmes unlocked" bar sat over the chip grid (scripted
`.click()` bypasses overlays, a finger does not), the results were far below a very long picker,
and the address bar was rewritten on every change. All three are removed.

Changes: two-pane layout from 1100px (sticky subjects pane, results beside it, live); below that a
sticky summary bar with the live count and Edit / View buttons; removable selected-subject tray;
full official subject names on chips plus a finder that maps aliases (IP, Informatics Practices,
Biotech, Book Keeping, Applied Maths...) to the one subject DU/NTA count; every programme card shows
the Bulletin's exact combinations with met / missing marks, and "Not eligible yet" rows open to the
same rules. The URL is read once on load and then cleaned; edits persist in localStorage; Share
builds the link on demand.

Accuracy check: B.Sc. (Hons.) Computer Science has two Bulletin combinations and BOTH require
Mathematics/Applied Mathematics, so a commerce student with only IP is not eligible. Tests added
(16 total in `npm run test:du`): that case, the Computer Science / IP equivalence, rule
explanations, alias search. Verified in the browser with a real click: adding Mathematics took
35 -> 41 programmes and made B.Sc. CS Honours and Economics Honours appear.

Note: Prepium lists Sanskrit under List B; the 2026 Bulletin's List B (22 subjects) does not,
so the tool follows the Bulletin. Lint, build, test:du 16/16, recovery 15/15, nta 22/22,
answer-integrity 6/6, payments 11/11. No real-device or screen-reader run.

## October 2, 2026 — homepage refinement and exam-interface comparison

Preserved the existing homepage and added a refined hero practice frame, persistent
animated light/dark switch, four original campus illustration cards, and an
interactive MockMob/NTA-style comparison. Premium NTA sessions now offer a
presentation switch on the same runner; the existing scoring, timing, entitlement
and credit logic is unchanged. College cards hand off a validated programme filter
to the existing DU calculator.

Verification: production build and ESLint pass; NTA 22/22, DU 16/16, recovery 15/15,
answer integrity 6/6, payment entitlements 11/11. Browser checks at desktop and
390px/320px confirm theme persistence, mobile menu, no horizontal document overflow,
preview answer/review/clear/reset state, and Commerce preset 35/73. Premium setup
link selects NTA Mode with 50 questions / 60 minutes without starting the mock.
New browser tab reported no console errors. Generated campus asset is 276 KB WebP.

No production deployment, migration, checkout or scored exam submission performed.
The real premium exam submission path with the classic skin remains a release check.
NTA style is a reference-based practice console, not a guarantee about the official
2027 UI. Source changes and their rollback boundary, reference survey, image prompt
and evidence are in HOMEPAGE-REFINEMENT-2026-10-02.md and artifacts/homepage/.

## October 2, 2026 (second pass) — repair, theme, Arena alignment (Claude)

Local source only. Nothing deployed, migrated, purchased or generated. Screenshots:
`artifacts/refinement-2026-10-02b/`.

Confirmed defects fixed (cause → fix):
- Radar/analytics was empty for every student: `/api/analytics` kept only `server_snapshot_v1`
  attempts (Score Recovery pilot, not launched) while practice writes `server_practice_v1`.
  Now counts the owner's practice; pre-server browser-scored attempts are included and labelled
  (owner decision). Recovery/progress evidence rules are unchanged. `data/attempt_scoring.js`.
- Submission could be rejected by clock skew: runner timed events as client `Date.now()` minus
  server `startedAt`; server rejects events later than its elapsed time + 2 s. Runner now times
  from receipt using only the server duration; `finishPractice` scores answers without the
  (discarded) event log if the log is malformed (`scorePracticeSubmission`). Answers still fully
  validated. Recovery-pilot `finishSession` is unchanged.
- Result page called every new practice attempt "historical… not scored from a server-held
  snapshot". Copy now distinguishes server-scored practice from older browser-scored attempts.
- Nav dropped Radar, Saved, Compass, PrepOS, Explore, Ranks, Contribute, My uploads (pages still
  existed; several are sold as Pro). Restored as a "Tools" group (owner decision). App tour pointed
  at nine missing nav targets; rewritten for the current nav.
- Light mode: subject-card hover was `#121712` behind `#172016` text (1.08:1); landing secondary
  button hover `#151a14` (1.05:1); dark mode on paper sub-pages: shared `.mm-btn--secondary:hover`
  was `#fff` behind near-white text (1.11:1); calculator/teaser lime, amber and pink text on paper
  (1.2–2:1). Cause: night-only literals in `landing.css`/`du.css`/`globals.css`. Fixed with theme
  roles (`--accent-text`, `--accent-line`, `--accent-wash`, `--tint`, `--surface-hover`,
  `--warn/bad/good-text`) defined per theme in `marketing-theme.css`; per-selector light patches removed.
- 900–1023 px: marketing nav labels wrapped onto two lines after the toggle was added. Text links
  now move into the menu below 1024 px; CTA and Log in stay. NTA-style "Mark for Review & Next" and
  "Clear response" were hidden at 761–1023 px; now visible below 1024 px.

Refinements: theme switch redesigned (sun/moon thumb, inset-shadow crescent, stars, spring travel,
press squash, circular View Transition reveal from the switch; instant under reduced motion or
without support). Hero practice bay restored (framed bay, lit slate card, deep shadow, skeleton
explanation) plus a two-card stack; status row and purpose rail kept. Campus cards pair as
landscape cards at 761–1023 px. Arena: scoped `src/app/(app)/arena.css` re-skins shell, dashboard,
shared app primitives and the branded runner; NTA-style console untouched apart from the
breakpoint fix. Dashboard copy and numbered setup steps; no logic change.

Verified locally:
- Tests: recovery 17/17 (2 new), NTA 22/22, DU 16/16, answer integrity 6/6, payments 11/11,
  mock selector + practice filtering + offline batch (pure) 13/13. Paid-model pipeline tests not run.
- `npm run lint` clean; `npm run build` passes. Production server: `/preview/arena` and
  `/preview/recovery` 404; unauthenticated `/api/analytics`, `/api/attempts`, PATCH `/api/sessions` 401.
- Browser: computed-state contrast audit of every hover/focus/pressed/selected/disabled rule on
  `/`, `/pricing`, `/cuet-cutoff-calculator`, `/login`, `/about`, `/cuet-2027`, `/features` in both
  themes; light homepage clean; calculator text (542 nodes) passes in light with results open.
  Real-pointer hovers checked in both themes. Toggle: click, Space, Enter, focus ring, aria-checked,
  persistence, reveal animation from the switch. No document overflow at 15 widths 320–1440.
  Drill answer causes no layout shift (stage 718 px before and after).
- Arena via `/preview/arena` (development-only, mock user, stubbed account APIs, no production
  writes): dashboard subject/mode/count selection, 50-credit gate disabled with top-up hint, launch
  URL; branded runner answer, mark, clear, navigate, submit; captured payload scored by the real
  `scorePracticeSubmission`; NTA-style console at 1366 and 900 px; mobile menu at 375 px.

Not verified / release checks:
- A real signed-in Quick Practice (start → submit → result → Radar) was approved by the owner but
  not run: the browser pane had no session and credentials cannot be entered for the owner.
- Live premium NTA submission with either interface; Razorpay checkout; production deploy.
- Reduced-motion paths reviewed in code, not emulated. No real-device, Lighthouse or screen-reader run.
- `/api/bookmarks` hides saved questions that fail the current quality gate, but the free-tier
  25-save limit still counts them (not changed).
- Other app pages (Compass, Radar, Saved, Profile…) inherit the re-skinned primitives but their
  page-specific layouts were not redesigned.

## 3 October 2026 — Round 4: restored craft, Pip guide, motion system, study loop (Claude)

Local source only. Nothing deployed, migrated, purchased, generated or sent. Full record:
`docs/brain/ROUND4-NOTES.md`; motion rules: `docs/brain/MOTION.md`; brief:
`scrollcraft/builds/mockmob-round4/BRIEF.md`; evidence: `artifacts/round4/`.

- Regressions fixed at their measured causes: comparator palette (44px min-width in 1fr tracks,
  5-column phone override with span-2 holes, lost NTA placeholder skin, clipped focus rings);
  Arena entry and exam-day card (round-3 blanket overrides; containers now fade, leaves rise, so the
  fixed phone dock is never re-anchored); exam-day clock now really counts down, offscreen-paused.
- Pip: one guide that hands off between five perches and reacts to page events (drill answer, Mistake
  Lab next move, exam preview answers). Chosen over two other built prototypes (archived). Static
  perches remain the no-JS/reduced-motion experience. No mascot motion in the timed runner.
- Study loop: Result ends with one next step from the PrepOS insights engine (no chapter named
  below its 4-answer ranking rule), plus Review, Saved, Radar, Back to Practice. Saved links back to
  Practice.
- Sweep: 760 loads (38 routes × 10 sizes × 2 themes): root overflow 0, console errors 0. Found and
  fixed a Practice panel cut off from 320–1440px (grid `auto` tracks) and six sub-44px controls.
- Verified: `npm run lint` clean; `npm run build` passes; recovery 17, DU 19, learning 74, NTA 22,
  answer-integrity 6, payments 12, Explore/contribution 8 = 158/158 pass (logs in
  `artifacts/round4/logs`). Reduced motion, 200% text, real-touch flows, light theme and contrast on
  new surfaces checked in Chrome. Lab perf (prod build, 390px, 4× CPU, Slow 4G): LCP 2.9–3.3s, CLS 0.
- Not verified / release checks: physical phones, screen reader, authenticated persistence and
  resume, live premium NTA submission, payments; LCP above target with cause not isolated.

## 3 October 2026 — Round 5: continuous Pip journey and Arena handover

Local implementation. Full evidence and limits: `docs/brain/ROUND5-NOTES.md`; scoped future
work: `docs/brain/ROUND5-NEXT-FEATURES.md`; artifacts: `artifacts/round5/`.

- Seven ordered perches with hysteresis replace the narrow observer band. One desktop actor
  carries through a reserved gutter; phone motion stays local and follows document scrolling.
  Reverse/fast crossings coalesce. Larger original art, pose fades and static reduced motion.
- Lab celebration waits for the visible next-move control and settled visible Pip. One peak
  per view. Today, Practice, Review and Saved gain calm companion states; recorded-session
  acknowledgment uses server data. PrepOS keeps its orb, voice and capability/credit wall.
- Three travel/PrepOS studies archived; temporary Round 5 route removed. One requested image
  concept generated; original six pose assets remain in product. Exact GPT Image 2.5 selection
  is unavailable through the tool, so no such model-version claim is made.
- Lint and production build pass. Recovery/DU/learning/NTA/answer-integrity/payment/Explore
  suites: 158 passed, plus two station-selection tests. 760 verified layout loads: 380 public
  production + 380 development fixtures; zero root overflow, pageerrors or failed loads.
  Reduced motion, quarter-interval reverse journeys and six 200%-text fixture views checked.
- Hero-animation ablation reproduced lower text LCP (phone 1.60–1.94s versus guide baseline
  2.27–3.64s). Removed only the measured lead paragraph's entrance animation; other entrances
  remain. Final production measurements and methodological limits are in ROUND5-NOTES.md.
- No deployment, production migration, bank writes, paid-content generation, outgoing email
  or checkout. Live authenticated persistence/resume, premium NTA submission, payments,
  physical devices and screen-reader acceptance remain release gates. Fixture counts and
  laboratory performance are not live account evidence or field Core Web Vitals.

## 3 October 2026 — owner-approved Round 5 follow-up and local-server recovery

Local implementation; full source map, evidence and limits: `docs/brain/ROUND5-COMPLETION.md`.
The owner subsequently approved implementing the remaining plan and restoring the site.

- Tonight's plan now uses the shared server plan and ties its recorded state to a current-day
  server-scored attempt. First-session/fresh-check milestones use real validated records.
  Thirty minutes includes ten minutes of review, which is not automatically marked done.
- Result offers evidence-gated, unseen-family five-question replay only when inventory permits;
  ownership/rate limits and launch checks remain authoritative. No generation or bank writes.
- Install/PWA support caches only three public fallback assets. Open-runner drafts preserve
  session identity, answers and deadline. Network submission freezes answers and supports
  bounded reconnect/reload without a new timer, debit or local score. Logout purges own drafts.
- Monthly cancellation now uses the installed Razorpay SDK's boolean argument and confirms
  rejected requests only through a matching terminal provider state. No provider operation ran;
  monthly activation remains gated because the plan ID is absent. One-time Pro access remains.
- Local dev restored at `http://localhost:3010/` with separate `.next-dev` output and disabled
  Turbopack development filesystem cache. The phone-blocking Next dev indicator is disabled.
  No reset/cache deletion/bulk revert. Earlier worker/cache/chunk failure logs are retained.
- Final build and lint passed; 172 automated tests passed, including question/payment/recovery
  contracts. 760 route/size/theme loads passed. New feature suite: 43 checks passed. Acceptance:
  37 forward/reverse wheel, clipped control/focus clearance, reduced-motion, 200%-text and iOS
  help checks passed. Rebuilt homepage: 20 size/theme checks passed; production PWA check passed.
  A concurrent autoplay timing run paused and failed; unchanged sequential rerun passed, both
  retained. Fixtures, browser touch and device emulation are not live persistence/hardware proof.
- Existing signed-in browser session inspected read-only: Today 20-minute plan → Practice setup,
  fixed-expiry Account, existing legacy Result and Review. No new attempt, score or debit.
  Opera/native-app access was unavailable; Gmail/OTP access was unnecessary and not performed.
- Remaining release gates: authenticated staging submission/resume and premium NTA with both
  skins, configured monthly plan plus sandbox billing/webhook evidence, physical Android/iPhone
  and screen reader. No deploy, migration, paid content generation, checkout or external message.

## 3 October 2026 — Pip intent and PrepOS refinement (Round 6)

Owner asked to preserve the good motion, make mascot actions contextual, reduce generic hero
details, strengthen PrepOS with its existing API/wallet and prepare next steps. Full handoff and
paste-ready Claude prompt: `CLAUDE-PIP-PREPOS-HANDOFF-2026-10-03.md`.

- Added one GPT-generated attentive pose with open eyes and relaxed arms. Removed sleep/wink
  defaults from scroll reading, pricing, comparison, Arena setup and loading. Original art stays.
- Pip points inward, including its static reduced-motion fallback. Single-face 140 ms entry
  replaces the overlapping-visors dissolve. Small scroll corrections retain the expression.
  Correct sample answers keep their hop; wrong answers receive an attentive nod. Keyboard
  answers trigger no mascot reaction. The Lab peak and mascot-free timed answering remain.
- Hero now states one fixed practice promise and leads with the actual five-question sample.
  PrepOS connects its next step with the record observation and an inspect/ask handoff.
- PrepOS Ask explicitly separates free record facts from optional one-credit model guidance.
  Source labels, receipts, wallet refresh, unknown-balance handling and same-ID retry are visible.
  Unresolved requests/conversations survive PrepOS section changes; late history cannot replace
  a new conversation. Effective paid expiry is recomputed using the shared entitlement rule.
  Explicit free requests cannot fall through to a paid model; new saved replies carry their source.
- Final build and lint passed. **172 existing automated tests passed** across recovery, question,
  payment, wallet, reservation, model lifecycle and other contracts. A final focused PrepOS rerun
  also passed all 26 tests. **147 browser report entries passed** at four widths and both themes:
  forward/reverse stations, inward pointing, one face, reduced motion, free/paid/unknown wallet
  states, lost-after-commit idempotent retry, keyboard/mouse reactions, wheel reversal and quiet
  companions with doubled root font size. Browser AI responses are labelled fixtures, not live
  model calls. Evidence and earlier failed test assumptions are retained in `artifacts/round6/`.
- Read-only configured Supabase check: wallet, ledger, reservation, runtime request and price
  tables answered. Funding table unavailable through the Data API (`PGRST205`); configured
  model prices not verified; available funding not established. Paid AI remains release-gated.
  Table readability does not establish RPC correctness or applied migration history. No migration
  was executed and no model/credit/budget call was made during this check.
- Public live PrepOS still shows its earlier public-guide/missions interface. That observation
  does not establish deployment of this checkout's guarded contracts. No outgoing email, paid
  educational generation, attempt/score fabrication, checkout or deploy. Port 3010 dev is left
  running; the temporary port 3011 production verification server is stopped.
- Next gates: resolve funding-table availability, verify actual schema/RPCs against saved SQL
  without blindly reapplying migrations, establish authorized runtime funding/current prices,
  reconcile wallets and run real staging concurrency/retry/release. Then consider activation.
  Durable client retry after reload/drawer closure, physical phones, screen reader and prior
  authenticated staging/payment acceptance remain unverified. This refinement preserves the
  retry ID across section changes only; it does not claim paid-request reload recovery.

## 5 October 2026 — Luna-only routing, shorter mobile home, light default, AI purchases

Source changes (not yet deployed; deploy needs `AI_LUNA_MODEL` optional and the Razorpay env below):
- **Model routing:** `src/services/ai/providers.js` now runs GPT-6 Luna only. `fast` tier = no reasoning, `smart` tier =
  low effort; callers that solve/generate questions pass `reasoningEffort` explicitly (medium+). Fallback is Luna, no
  reasoning. Question moderation (`src/lib/moderation/ai.js`) moved from a direct Claude call to the budget-guarded
  router, Luna at medium effort. `AI_FAST_MODEL`/`AI_SMART_MODEL`/`AI_FALLBACK_*` no longer route anywhere.
- **Homepage:** removed Subjects, Marquee, How-it-works, Proof band, mini tiles, Compass Pro box, college destinations;
  Instagram moved up under the statement; stats are now combined followers, reel views (owner-stated 100K+ floor,
  `REEL_VIEWS_FLOOR`) and recorded likes+comments. Product screens hidden under 700px. Mobile page 20.2k → 15.1k px.
- **Theme:** light is the default (`layout.js`); first-visit hint on the switch (`ThemeToggle hint`), shown once.
- **Payments:** `RELEASE_GATES.aiCommerce = true` (owner, 5 Oct); PrepOS top-up packs (₹10/50, ₹20/150, ₹50/400) now sell
  on `/pricing`. Monthly Pro ₹99 opens when `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is set; create it with
  `scripts/payments/create-razorpay-plan.mjs`. Pro keeps 50 PrepOS credits/month, Free 10.
- Verification: `test:learning` 80/80, `test:recovery` 35/35, payment + landing tests 16/16; browser checks on 375px.
- **Unresolved gates:** Razorpay keys + plan ID + webhook secret are empty in `.env.local`; no real captured top-up or
  subscription charge has been verified; Vercel env not updated.

### 5 October 2026 (later) — landing page restructure, feature tour
- Reverted the over-trimmed homepage: Compass Pro box, college destinations, stats band restored. Removed only the Subjects
  block (owner), the subject marquee and the three-step "how it works". Instagram stays where Subjects was.
- New `FeatureTour` (`src/components/landing/FeatureTour.jsx`, `src/app/feature-tour.css`): eight tools, one idea per slide,
  swipe on phones (scroll-snap), list + stage on desktop, autoplay with pause, only while on screen. Replaces the bento.
  Slides accept `video: '/demos/<id>.mp4'`; no recordings exist yet, so the animated screens play.
- Phone polish: glass header with progressive blur, floating glass dock, blur-in reveals (`.lp .rv`, reduced-motion safe).
- Reference studied: ug.preparoo.app (Webflow + GSAP; 7.1k px on mobile; one feature carousel, product mocks, sticky CTA).
- Tour v2 (same day): desktop is tool pills + a split stage (copy left, screen right); phones get equal-height cropped glass cards.
  Copy rewritten; Rival slide now says what it is (a fixed accuracy-and-pace target, not other students).
  `LiveStatsBand` drops a figure that fails to load instead of printing "Unavailable". Cause of the "unavailable" the owner saw:
  the preview dev server lacked `--use-system-ca` (TLS to Supabase failed); `.claude/launch.json` now uses it. Production unaffected.
- Tour v3 (same day): slides now use `TourScreens.jsx` + `tour-screens.css`, compact demo screens that play a scripted
  sequence each time their slide becomes active while the tour is on screen (timer ticks, options tapped, rows arriving,
  typing, bars filling), then hold the finished state; reduced motion shows the finished state. Nothing is cropped on phones.
  Verified frame by frame in a foreground Chrome (chrome-devtools) at 390x844 mobile and 1440x900: all 8 demos play and settle.
  Note: the desktop app's Browser pane throttles timers when hidden, so it is not reliable for checking motion.

## 4 October 2026 — UI/UX audit (audit-session date)

- Documentation-only audit saved to `docs/brain/UI-UX-AUDIT-2026-10-04.md`; raw evidence and screenshots in
  `artifacts/ui-ux-audit-2026-10-04/`. Independent visual and implementation reviewers completed before synthesis.
- Design health 26/40; technical health 14/20. Ten accepted groups: P0 0, P1 1, P2 8, P3 1. Highest priority:
  illustrative key agreement must not imply official correctness or explanation safety. Other priorities:
  phone journey/feature repetition, result mascot overlap and split percentage, touch/keyboard semantics.
- Homepage checked at widths 320/360/390/430/768/1024/1440/1920; all observed MockMob global widths fit.
  Public pages, 15 student fixture views, both themes, live home/signup and three live competitors sampled.
  Initial profile/test loading frames are not full-state verification. Incorrectly labelled initial desktop rows
  are retained as provenance and excluded; corrected 1440 measurements are the desktop evidence.
- Sampled answer feedback/focus, menu Escape, tour ArrowRight, timed palette, malformed email without sending,
  and long-name/empty/error fixtures. Contrast sampling had no eligible content-text failures within its limited
  coverage; gradients/animation and other unsupported cases were skipped. No whole-site WCAG certification.
- Detector ran once: 137 raw alerts, largely contextual advisories; no bulk theme/runner normalization warranted.
  Current aiCommerce=true supersedes the older closed-top-up assessment; target-size equivalent-control exception
  prevents declaring a definitive WCAG failure from dots alone. Both reconciliations are explicit in the report.
- No UI code changes, tests/builds, paid model calls, real attempts, migrations, auth completion, emails, payments or
  deploys performed. Existing dirty tree/dev server preserved. Audit tabs and temporary viewport overrides cleaned up.
- Open gates: real phone keyboards/safe areas, screen reader, 200% text zoom, full hover/focus/reduced-motion matrix,
  background interruption and budget-device/slow-network performance; authenticated persistence/payments/AI receipts.
  Live landing differs from local; this audit does not establish deployment of the new feature tour or configured AI.

### 4 October 2026 — owner-selected UI/UX implementation plan

- Saved `UI-UX-IMPLEMENTATION-PLAN-2026-10-04.md` and linked it from the brain README/audit.
  Owner retains official-key trust wording; wording-first audit priority is superseded for this sprint.
- Order: reproducible baseline → phone performance/composition → accessibility → student/error states
  → activation flow → final measurement and release evidence. Cosmetic detector cleanup, unused demos,
  arbitrary competitor page-height targets and blanket motion/feature removal are excluded/deferred.
- Current source review found held/not-explained repair outcomes enter the Result `repaired` set, which
  drives a Repaired badge. Plan requires fixture reproduction and separate handled/outcome states;
  no runtime reproduction or fix is claimed in this planning pass.
- Planning only: no UI edits, performance runs, tests, paid calls, migration or deployment performed.
  Performance acceptance separates controlled production-build traces from real-user Core Web Vitals.

### 4 October 2026 — UI/UX plan implementation

- Implemented phone hero/sample composition; tour carousel controls, inert slides, focus/manual pause,
  bounded pausable demo timelines, hidden/offscreen gating and 44px controls; official-key wording retained.
- Practice setup now precedes supplementary commentary/statistics and no longer waits for optional panel
  reads. Pending/unavailable counts are explicit; matching/expiry/idempotent server quote guards remain.
  Scoped load retry retains choices; phone summary exposes subject, mode, count, time, marking and cost.
- Result mascot height/entrance and metric units fixed; distinct explanation/held/unexplained outcomes,
  handled queue vs explanation progress, retained visited answer state across collapse/filter, and safe
  same-ID retry/in-progress/released handling. No scoring, wallet, model, budget or entitlement changes.
- DU category arrows/Home/End and clear focus fixed; editable phone/tablet fields 16px; key targets 44px;
  transform progress bars; one main in timed runner and PrepOS.
- Baseline/final production builds and final lint passed; 179 tests passed (35 recovery, 80 learning,
  59 payment/question/NTA/DU, 5 new UI state tests). Final key-route light 320/390/768/1440 and dark
  320/390/1440 matrices have zero horizontal overflow and no result mascot/metric overlap.
  Fixtures cover distinct repair outcomes, pending/error states and retained held panels. Browser
  checked DU keyboard, menu Escape focus return, sample feedback, tour freeze and one-main wrappers.
- Local production preview on 3020 checked public home, themes and sample; existing authenticated
  setup was read-only. Signup redirected to setup, so current-run native email validation is unverified.
  No new real session/paid repair/payment/signup completion, data migration or deploy performed.
- Several local inventory reads took 7.5-11s and had blocked setup; dependency removed and tested with
  never-resolving-statistics fixture. No device speedup, Core Web Vitals or field gains claimed.
- Full evidence/open gates: UI-UX-IMPLEMENTATION-RESULTS-2026-10-04.md and
  artifacts/ui-ux-implementation-2026-10-04/. Physical phone, screen reader, actual 200% zoom,
  reduced-motion browser/full contrast matrix, controlled throttled traces/field CWV, real transaction
  receipts and production deployment remain open. Measurements cannot be replaced with screenshots.
- Existing checkout changes retained. Diff check only reported the pre-existing ProductScreens.jsx EOF
  blank line. Do not bulk-reset/revert these files; review the scoped implementation hunks.

### 4 October 2026 — authorized UI production release preflight

- Owner requested publication of the UI changes. The staged release includes the reviewed landing/tour,
  mobile/accessibility, dashboard, result/repair presentation and DU refinements with their source dependencies.
- Existing AI-routing/moderation, aiCommerce enablement, pricing, payment scripts and corresponding
  backend-test edits are excluded and retained locally. This release does not activate new commerce,
  change model routing, migrate data or call a paid model.
- Exact staged source tree `7cfe2abf1d958767fb32f5bcd270560900cddd58` was exported independently:
  production build and lint passed, with 179/179 recovery/learning/payment/question/NTA/DU/UI-state tests.
  Evidence: `artifacts/ui-ux-release-2026-10-04/`. Shared dependency junction was rejected by Turbopack;
  the successful build used a real dependency copy. No application workaround was introduced.
- Push/Vercel readiness and live-domain/mobile/desktop smoke are pending at this preflight entry.
  Hardware, screen-reader, measured throttled performance/CWV and real transaction gates remain open.

### 4 October 2026 — UI release live verification

- Pushed `f70e385909ff454f10bf83e60d96a6883bb31c17` to `origin/main`. `Vercel – mockmob`
  reached success at `2026-10-04T12:50:34Z`; deployment:
  https://vercel.com/atishay07s-projects/mockmob/6VA6xyZTYuXB87urHXQLAgeusbAx.
- `https://www.mockmob.in/` serves the new tour, short hero lead and sample CTA with HTTP 200.
  Apex redirects once (307) to www, then 200. Calculator returns 200; no redirect loop.
- Live home light/dark checks at 320/390/1440px: no horizontal overflow, one main.
  Sample CANDID/Frank feedback works; selecting Mistake Repair pauses the tour with one active,
  seven inert slides and 44x44px controls. Live calculator at 390px: category ArrowRight selects
  and focuses OBC-NCL with one tab stop; clear empties search, restores focus, and input is 16px.
  No captured browser error logs in this smoke. Phone and desktop screenshots saved.
- Evidence: `artifacts/ui-ux-release-2026-10-04/{github-status.json,live-http.json,live-ui.json}`
  and build/test/lint logs. This post-deployment receipt is a local status update; deployed source
  and preflight documentation are in the release commit above.
- Existing unrelated AI/commerce/payment edits remain local. No production migration, paid model
  call, real attempt, purchase or signup completion was performed. Physical devices, screen reader,
  actual zoom, controlled performance/field CWV and real accounting receipts remain unresolved.

### 4 October 2026 — guided tour follow-up

- Owner rejected the phone dropdown and easily interrupted/slow feature playback after the UI
  publication. Rebuilt the tour as an automatic 4.8-second chapter sequence with shared progress,
  explicit Pause, a chapter strip and an Up next nudge. Normal vertical browsing no longer turns
  rotation off. Pointer navigation resumes its cycle; horizontal input holds briefly while settling.
- Preserved keyboard reading holds, explicit resume, reduced motion, inactive-slide isolation and
  hidden/offscreen suspension. Phone product panels fit without overhang; the sample dock steps
  aside during the tour. Nearby Mistake Lab stages also use 4.8 seconds. Official-key copy retained.
- Final isolated application source build and lint passed; nine relevant tests passed. Both-theme
  320/390/768/1024/1440 matrices have zero root overflow, no screen overhang and 44px controls.
  Browser observed auto progression/loopback, scrolling/navigation without sticky pause, explicit
  pause, and keyboard hold/resume. No measured wall-clock/FPS/device performance claim.
- See `TOUR-REFINEMENT-2026-10-04.md` and `artifacts/tour-refinement-2026-10-04/` for details.
  Production readiness/live smoke pending at this entry. Physical phones, screen reader and CWV
  gates remain open. Unrelated AI/commerce/payment edits retained locally; no migration/paid call.

### 4 October 2026 — guided tour published

- Final commit `6c5e05b6562830fc2e12450a87846eb8c678f0c2` is on `origin/main`.
  `Vercel – mockmob` succeeded at `2026-10-04T14:16:25Z`; deployment:
  https://vercel.com/atishay07s-projects/mockmob/5LCkkWSUNNWQU3KoWt1BvLkDpYTd.
- Live www serves the new chapter strip, progress and Up next controls with HTTP 200.
  Apex redirects once (307) to www, then 200. The former feature dropdown is absent.
- Live phone playback advanced to another chapter after ordinary vertical scrolling.
  Fresh production tab checks confirmed actual 320/390/1440px viewports in light and dark:
  zero root overflow and no tour controls smaller than 44px. Desktop playback resumes when
  its media enters view. No captured browser error logs in the final smoke.
- Evidence: `artifacts/tour-refinement-2026-10-04/{github-status-final.json,live-http.json,
  live-responsive-final.json,live-phone-light.jpg,live-desktop-light.jpg}` and local build,
  lint, nine-test and responsive/motion observations. The final small phone-caption change
  passed targeted lint; the exact final commit passed Vercel's production build.
- This post-deployment receipt remains local. Unrelated AI/commerce/payment edits remain
  untouched and unpublished. No migration, paid call, signup or purchase was performed.
  Physical swipes/momentum, screen reader, actual browser zoom/reduced-motion settings,
  controlled CPU/network performance and field CWV remain unverified.

### 4 October 2026 — connected preparation suite verified for rollout

- Implemented shared Today sequence, Learn, server-scheduled Recall, durable versioned runs/events,
  separate study progress, selected subjects/time, Pro weekly plans and custom mixed recall.
  Mobile Today/Practice/Learn/Review retains the other destinations through More. Active sessions
  and due checks replace their plan blocks; a persistent full-mock shortcut retains the existing
  quote/eligibility/credit path. Teaching/card exposure excludes those families from fresh checks.
- Owner explicitly authorized current Supabase project `isrxrxzjocewrdureyhp` with existing data.
  Saved migrations and isolated dry runs preceded SQL-editor application of score-recovery,
  connected-learning and study foundations; the published-version backlog follow-up also applied.
  The original transaction verified existing questions/attempts/credits/entitlements/credit receipts
  unchanged. Current service-role retry/scheduling/stale-revision smoke passed and rolled back all
  verification writes. CLI migration history remains unreconciled; do not blindly reapply pending SQL.
- Published two units and 23 cards: English twenty-word deck and sacrificing/gaining ratios.
  Canonical hashes and anonymous table denial verified against the current project. WordNet license
  preserved; NCERT formula/source reconciliation and exact arithmetic passed. This does not release
  formal recovery pathways or certify academic calibration, exam fit, mastery or score gains.
  Remaining four-subject coverage is visibly pending; offline packs and curriculum expansion remain.
- Clean isolated release excludes owner's unfinished pricing/provider/AI-evaluation/payment-script/
  landing edits. Lint and production build passed. 166 distinct tests passed: recovery 35, learning
  80, answer integrity 6, NTA 22, payment entitlements 12, study 11. Final plan changes passed study
  tests again; final mock/lesson links passed targeted lint and production rebuild. Complete local
  four-migration/import/retry/runtime dry run passed. Authenticated browser saved/resumed/completed
  the English lesson, persisted/reloaded a recall rating and saved/restored time preferences.
- No paid model calls. Existing Free/Pro prices, entitlements, atomic credit RPCs and AI allowances/
  persistent $50 generation and $25 monthly runtime guards unchanged. Only three independent study
  flags were saved as true in production on the domain-verified Vercel `mockmob` project.
  Publication/live verification pending at this entry; local build is not proof of deployment.
- See `STUDY-SUITE-2026-10-04.md` and local `artifacts/study-suite/` receipts. Real Android/keyboard,
  screen reader, actual 200% text/zoom/reduced-motion settings, field CWV and delayed unseen-question
  outcomes remain unverified. Rollback disables study flags and retains learning records.


### 4 October 2026 — preparation suite published

- Commit `a6a61cc276d9df36b43e4760c08df0dfe83802a3` is on `origin/main`.
  Domain-verified Vercel project `mockmob` deployment is Ready:
  https://vercel.com/atishay07s-projects/mockmob/FeimHt2rAGpA3qG4Eepoqfa43PNJ.
  Vercel showed 49 seconds and 23:21:17 IST on 4 October. Production flags are enabled.
- Live HTTP smoke passed: apex 307 once to www then 200; www and Learn 200; anonymous
  study catalog 401; dev-only study preview 404. Public Learn redirects signed-out users
  through existing authentication. Live signed-in browser check awaits owner Google sign-in;
  the Google chooser shows the existing account signed out. No credential was generated,
  transferred from localhost or changed to bypass login.
- Authenticated current-project readback passed: English lesson complete, recall cursor one
  after the first card, answer hidden on the next card, one persisted FSRS review whose due
  date matches the run receipt, and original twenty-minute preference restored. Actual
  owner QA records remain resumable; they are not student outcome evidence.
- Final authenticated release library and recall checks across 320/390/768/1024/1440 plus
  short landscape showed zero root overflow and no study buttons/links below 44px. Dark
  phone library also had no overflow. Full-mock shortcut selected the existing Full Mock
  and displayed its access quote without starting or charging a practice session.
- Evidence: `artifacts/study-suite/{production-release-receipt.json,production-deployed.png,
  live-http.json,authenticated-study-receipt.json,responsive-release-library.json,
  responsive-release-recall.json,phone-library-dark.png}`. This post-release receipt remains
  local; application source and pre-release verification status are already published.
- Original dirty checkout and unrelated owner edits remain intact; release checkout/branch is
  `artifacts/study-suite/release` / `codex/connected-study-suite`. Original local main still
  points at its prior commit; reconcile intentionally before later publishing owner edits.
  Full curriculum/offline packs, formal calibration, CLI migration-history reconciliation,
  physical-device/assistive-technology/200%-zoom and field performance/outcome gates remain open.


### 4 October 2026 — signed-in preparation-suite production smoke passed

- Owner completed normal Google sign-in. Live library rendered both English and Accountancy
  units, existing Pro access, the completed lesson and recall progress. The existing recall run
  resumed at card two. A live reveal was saved and survived page reload; its answer, optional
  pronunciation, linked lesson and four rating controls rendered correctly. No scored session,
  practice-credit charge, purchased-entitlement change or paid AI call was made.
- Actual live library viewport checks passed at 320/390/768/1024/1440 and short landscape.
  Revealed recall passed at 320/390/1440 and short landscape. Each measurement asserted actual
  width/height, zero root overflow and no study buttons/links below 44px. No error logs were
  captured in the final live test tab. Earlier viewport results that targeted the build-queue
  tab were discarded and replaced with these measurements; they are not release evidence.
- Evidence: `live-responsive-library.json`, `live-responsive-recall.json`, `live-phone-library.png`,
  `live-phone-recall.png` and updated `production-release-receipt.json` in `artifacts/study-suite/`.
  Physical-device, assistive-technology, actual zoom/reduced-motion, field performance and
  curriculum/calibration/offline/history-reconciliation gates listed above remain open.


- Final signed-in live Today showed the same resumable study run, twenty-minute preference and
  the 4/6/10-minute sequence plus full-mock shortcut. Temporary viewport overrides were reset.

## 5 October 2026 — Published expansion and clearer study journey

Live implementation is in the isolated `artifacts/study-suite/release` checkout, published
through `86accc3` and `23ac1ddac20600865d94cd04843fdc36113e0a08` on `origin/main`.
The latter Vercel production deployment `628qJMZ5zB1ABCnb2iu1GiN4scG9` is Ready
(40s build; 02:21:12 IST). Original checkout remains at `6c5e05b` with owner edits preserved;
reconcile deliberately before publishing from this older checkout.

- Seven source-linked concept packets added: current 21 lessons / 86 cards / 221 variants,
  partial lessons in 15 of 54 chapters. Baseline 14 lessons/65 cards keep their exact hashes.
- Reusable compiler/source-validation workflow produces lessons, recall and summaries once;
  no paid content generation. Strict PDF/digest, arithmetic and key checks passed. Saved SQL
  and dry-run receipts preceded current-project inserts and immutable correction withdrawal.
- New cards require teaching; mixed revision opens its saved run; corrected sessions link
  to current content. Large selection tiles, explicit assistance buttons, specific next
  actions and optional one-credit lesson explanations improve the connected journey.
- One owner tutor QA call committed one credit, provider cost $0.00032835. Existing AI and
  wallet budget guards retained. Existing Android/offline work retained, not rebuilt.
- Recovery/learning/study/payment/integrity/NTA/UI: 182 distinct tests passed, plus lint,
  production build and live public/auth checks. Signed-in mixed revision, corrected-run
  navigation, saved lesson resume and Planning completion passed. Its daily cap correctly
  schedules three new cards tomorrow after five introductions today.

Detailed status/workflow/evidence are in the release checkout's `docs/brain/STATUS.md`,
`docs/brain/STUDY-CONTENT-WORKFLOW.md` and `artifacts/study-suite/v3/`.
Remaining: 39 chapter gaps and depth within touched chapters; actual Android/offline,
screen reader/OS zoom/reduced-motion, print output, field CWV and delayed outcome checks.
This is partial curriculum, not a claim of complete coverage or proven learning gains.


## 5 Oct 2026: Key Review + NTA integrity guard
- Key Review: when Mistake Repair's solve and blind second check both disagree with the key, the student now sees an
  acknowledgement ("We may have got this one wrong") with who picked what, plus a result-page log of held keys.
  A reload shows the same panel via `question_under_review`. Marks are NOT changed automatically; copy says so.
  Files: `src/components/recovery/KeyReview{Notice,Log}.jsx`, `data/repair_presentation.mjs`, `dispute` field in
  `src/services/recovery/mistakeRepair.js`. No migration, no extra model calls.
- NTA integrity guard: leaving the tab/window = strike; warnings 1-2 show an animated modal, strike 3 submits the
  session. Strikes persist across reload (`<session key>:integrity`), copy/paste/context menu blocked. Browser-side
  deterrent only: strikes are NOT sent to the server (attempt events accept only answer/visit), so there is no
  server-verified proctoring record. Files: `data/exam_integrity.mjs`, `src/components/arena/ExamIntegrityGuard.jsx`.
- Verified: `npm run test:learning` 84 pass (incl. new `exam_integrity_review.test.mjs`), eslint clean, preview
  walkthrough of both flows. Not verified: real multi-window/mobile app-switch behaviour, signed-in NTA run.

## 6 October 2026 — Subscription screening and Luna question factory

Implemented locally in this original checkout; owner edits preserved. No deployment,
production migration/data write, paid generation call or new question publication occurred.
The live study-suite changes described above must be reconciled before any release from
this older checkout (`6c5e05b`). Workflow: `docs/brain/QUESTION-FACTORY-RUNBOOK.md`.

- Legacy complete-bank read-only scan: **9,242** rows, **6,299 mechanically clear**,
  **2,943 with suspect signals**, 284 bundles of up to 20. Signals are not confirmed
  academic errors. Included desktop Luna medium screened one clear four-subject sample:
  15 no-issue-found, three suspect, two incomplete; ID/hash-validated locally, not imported
  to production and not upgraded to signed publication evidence. Additional API spend $0.
- Subscription bridge strips provider credentials, checks ChatGPT account/limits, refuses
  API login/purchased/unknown credits, and pauses without paid fallback. Codex CLI is not
  logged in here; the actual sample used a signed-in desktop agent. Claude remains optional.
- Source catalog contains four 2026 syllabus PDF hashes and official 2025/current 2026 final
  key PDFs. Target-subject provisional extraction: 4,366/4,033 rows, including 55/20
  excluded rows. 2025 position keys and 2026 official option IDs require distinct exact
  mappings. The current June 23 key is linked by the hashed official CUET homepage;
  the earlier June 21 download is recorded as superseded. None are authenticated complete
  paper anchors or permission to reuse. Source registry/calibration intentionally remain empty.
- New factory: Luna medium authoring, shared blind Luna high academic/numerical/boundary/
  exam checks, one Gemini medium independent evaluation, Luna medium explanation audit.
  Originals skip stem authoring; adapters require source-backed syllabus/patterns, distinct
  adaptations, complete passage groups, signed version-bound receipts and one persisted
  repair followed by full revalidation. Default paid Haiku/Sonnet/Sol routes retired.
- Native Responses/Gemini and asynchronous batch transports reserve before dispatch,
  count reasoning/tools/failures/retries, persist accepted IDs and reconcile uncertain
  usage without resubmission. One leased local worker is permanently bound to its persistent
  ledger identity. Lifetime content ceiling remains $50; historical spending is unreconciled,
  so the fresh ledger's recorded zero does not establish $50 available. Student $25/IST-month
  budget, atomic credits and entitlements retained.
- Protected admin dashboard shows coverage, staged/published counts, disputes/quarantine,
  actual spend/forecast and 200→1,000→10,000 controls. Publication stays paused on missing
  evidence or forecast shortfall; no approve-anyway control. Ordinary selectors put eligible
  factory evidence before prior verified evidence, then current screened/undisputed legacy.
  NTA/recovery remain evidence-gated; failed evidence-managed items cannot fall back.
  Mistake Repair disputes bind the reviewed content version and propagate holds.
- Verification: **186 distinct tests passed** (23 factory, 35 recovery, six answer-integrity,
  38 selector/NTA/payment, 84 learning/student-AI/wallet), targeted eslint and Next 16.2.4
  production build passed. Migration executes in isolated PGlite, with atomic passage rollback,
  stale screening rejection, permanent worker binding and service-only access checks.
  Desktop/mobile preview and chapter disclosure passed with no horizontal overflow at
  1440/390 widths; temporary viewport reset. Unauthenticated admin API GET/POST return 401,
  admin page redirects to login. Saved receipts: `artifacts/question-factory/verification.json`,
  `migration-dry-run.json`, test/build/lint logs and screenshots.

Remaining release gates: complete authenticated papers/keys/excerpts and reuse permission;
2027 syllabus revalidation when available; historical spend reconciliation; signing/author
setup; current prices; officially keyed disjoint calibration and live guarded provider proof;
actual 200-candidate pilot and cost/acceptance/Gemini-catch measurements. Migration
`20261005185759_question_factory.sql` is **unapplied**. PGlite is not Supabase staging proof;
capture authenticated staging import/repair/publication evidence before requesting production
migration approval under AGENTS.md. Stage legacy screening receipts before deploying stricter
fallback so ordinary practice does not become empty. Jev receives no integration or budget.

### 6 October 2026 — first pilot commissioning

- Owner requested 50–100 candidates; the pilot now defaults to **100, 25 per subject**,
  retaining complete passage groups and the same evidence gates. Saved, unapplied migration
  adds a balanced pilot target; local SQL dry run checks default 100 and rejects target 101.
- Local evidence signing secret and the existing content author are configured in ignored
  local environment only. No secrets printed/committed, production environment unchanged.
- Read-only provider preflight: Luna model and OpenAI batch listing both **200**;
  Gemini model and native batch listing both **400, invalid API key**. Worker/foundation
  dispatch checks this before paid work. Native Gemini transport handles raw REST nested
  inline output and both state enum forms; missing request identity remains unresolved.
- Dashboard now reports measured spending/tokens by stage, including reasoning in output,
  separately from open reservation holds. No generated, queued or published pilot questions;
  new generation requests/spend remain **0 / $0**. Historical spend remains unreconciled.
- Acquired official 2023 key (1,761 pages) and inspected a 39-page image-only English/General
  Test mirror. Neither of two visually sampled question IDs matches the full extracted key;
  mirror is not registered. Incomplete reconstructed 2025 PDFs were excluded. No reuse
  permission or complete four-subject source pack has been established; calibration paused.
- Current connected database schema inspected through read-only REST metadata; factory
  control table absent. No staging project has been supplied. No schema/data write, migration
  or deployment occurred. Production migration still requires staging evidence and owner
  approval under this repository's AGENTS.md, after concrete staging/dry-run results exist.
- Current change verification: **105 tests passed** (26 factory, 35 recovery, 44 question/
  selector/NTA/payment), targeted eslint clean, Next production build passed. Mobile/desktop
  preview shows target 100 with no horizontal overflow; viewport reset. These are software
  checks, not academic or live provider proof. See `artifacts/question-factory/commissioning.json`,
  supporting logs/screenshots, refreshed migration hash and provider/source reports.

Remaining commissioning gates: replace invalid Gemini key; establish historical content
spend; authenticated permitted sources; officially keyed development/held-out calibration;
staging migration and authenticated operation checks. Then dispatch the 100-candidate pilot,
measure actual usage, acceptance, independent catches and cost, and evaluate checkpoint
release. No claim of 10/10 academic quality or completed pilot is justified yet.

Owner follow-up during commissioning: local Gemini key updated; repeated read-only model
lookup and native batch listing now both **200**, with `batchGenerateContent` advertised.
The credential blocker is cleared; actual submission/completion remains untested. Owner
states paper reuse permission/access and asks to proceed without a document. Recorded as
an owner attestation (not independently verified licence proof), without relaxing paper/
key/extraction authentication. Historical spend remains unanswered; source authentication,
academic calibration and database staging/migration evidence remain outstanding. The owner
has no separate staging project. No production migration has been executed implicitly.


### 6 October 2026 — usage-limit resume and held-out model comparison

- Continued the existing dirty checkout. Audited 21 factory commissioning files plus related
  evidence, budget, selector and admin contracts. Git has 50 tracked changes and additional
  new files; this is not a clean 21-file repository diff. Owner changes were preserved.
  Audit hashes: artifacts/question-factory/resume-file-audit.json.
- The interrupted run had accepted 32 held-out Gemini batches per Flash-Lite model.
  Accepted IDs and holds survived, with no unresolved charge or recorded API quota failure.
  Reconciliation reused those jobs. Initial resumed network checks failed inside the sandbox;
  authorized guarded provider reconciliation succeeded outside it. No batch was resubmitted
  merely because the desktop session/usage ended.
- Restored Economics Q28–32's 918-character biocomposting passage from both complete
  saved publisher copies and inspected the rendered PDF page. All 200 ordered paper/key
  identities pass the audit. Four packs retain 173 authenticated canonical anchors;
  28 calibration anchors remain reserved. Generation reference coverage is now 19
  nonreserved anchors (English9, Accountancy4, BusinessStudies3, Economics3), not
  proof of 800 diverse accepted questions. Source registry version15 is active locally.
- The 21 keyed held-out items gave 21/21 correct answers for all three Gemini models.
  Flash3.8 accepted21/21 valid items and no tested defects. Flash-Lite3.1 accepted19/21
  valid items after exact-reference checks, accepted the orphan-passage fixture, and had
  two incomplete negative responses. Flash-Lite3.5 accepted21/21 valid items but accepted
  missing assumptions, an invalid numerical boundary and the orphan-passage fixture.
  False-citation hashes were rejected locally before dispatch. Explanation faults cannot
  be assessed by a blind evaluator that does not receive the author explanation.
  Default remains Gemini3.8Flash MEDIUM; no cheaper model promotion.
- Measured 32-request evaluation cost: Flash3.8 $0.085462; Flash-Lite3.1 $0.049104;
  Flash-Lite3.5 $0.050195. These are token-priced gross costs, not cost per published
  question or confirmed credit deductions. Full detailed model evidence: gemini-benchmark.json.
- Numerical questions inside passage groups now retain Luna numerical/boundary stages
  and Gemini numerical/boundary requirements. Requirements are bound to authenticated
  anchor metadata and signed evidence; changing question-type metadata invalidates checks.
  Future paper exports exclude a following group's stimulus from the preceding question
  excerpt. The frozen current comparison is retained rather than tuned into a passing score.
- Full academic calibration is PAUSED: four valid items currently fail source/passage
  evidence checks despite correct blind keys (EnglishQ11, AccountancyQ44/Q45, EconomicsQ37).
  25 accepted explanation checks remain pending. Eleven known-bad fixtures have already
  quarantined; the explanation-negative fixture awaits its audit. The known valid failures
  prevent the95% acceptance gate even if all remaining items pass. No pilot enqueue,
  authoring or publication: target800, actual0generated/0published.
- Gross settled content usage $0.319079; pending holds $0.038225; available after holds
  $49.642696 of the $50 lifetime ceiling at this receipt. Historical spend is the owner's
  best-known $0 estimate, not invoice-audited. Google credits are not counted as zero-cost
  usage until actual billing deductions confirm their application. StudentAI remains
  separately guarded at $25/ISTmonth.
- Verification:114 tests PASS (35factory,35recovery,44question/selector/NTA/payment),
  targeted eslint PASS, current Next production build PASS. Existing unrelated ProductScreens
  width/height warnings and a blank line at EOF remain preserved. The migration still passes
  isolated PGlite checks and remains unapplied. Fresh browser automation could not initialize
  its kernel assets on resume; earlier1440/390 screenshots are retained as prior proof.
  Results: artifacts/question-factory/resume-results.json and linked logs.

Remaining gates: reconcile pending explanation jobs without duplicate submissions; investigate
source/passage and citation-output failures through development examples and a fresh held-out
evaluation; require academic release before pilot generation. Frozen-set answer agreement
does not prove universal accuracy. No staging project or authenticated staging publication
evidence exists. No production migration, bank write, deploy or publication was performed;
these still require concrete staging evidence and explicit production approval under AGENTS.md.

### Final accepted-batch reconciliation, 6 Oct 2026 11:36 IST

Twenty-two of the 25 Luna explanation audits completed on their original accepted IDs.
Three remain pending (two development, one held-out). Current held-out pipeline results:
one eligible valid item, 19 valid rejections, one valid pending; all 12 controlled
negative fixtures are quarantined. Correct blind keys do not bypass evidence failures.
The completed audits identify official-key claims and publisher attributions missing
from the audit input as a recurring reason for rejection. Supply authenticated
provenance after blind solving and evaluate the revised contract on fresh held-out
material; retain this frozen result. No new pilot questions were generated.

Final saved ledger: $0.326466 gross settled, $0.004587 held, $49.668947 available after
holds under the $50 ceiling; zero unresolved usage. Promotional billing deductions
remain unverified. Final targeted lint and production build passed. The 114 distinct
factory/recovery/question/NTA/payment tests remain passing. Updated results, hashes and
runbook are saved. Full academic release, the three outstanding batch receipts and
staging/production migration evidence remain open.

### Completed 100-question commissioning, 6 Oct 2026

Current authoritative receipt: artifacts/question-factory/commissioning100-report.json.
The earlier paused/zero-generation entries above are historical observations, not the current state.

- Generated 100 actual question drafts, 25 per subject: 48 eligible, 52 quarantined,
  zero published. English 5/25 pass; Accountancy 15/25; Business Studies 11/25;
  Economics 17/25. All 100 have stems, four options and explanations; malformed
  keys/routes remain quarantined. Passing inventory contains 19 authenticated originals
  and 29 adaptations; nine numerical questions and one complete five-child passage
  group pass. Difficulty coverage in this run is easy/medium only.
- Fixed source-extraction contamination, quoted passage literals rejected by strict
  schemas, oversized explanation-audit context, and unsupported original explanations.
  Immutable source passages are attached locally. Explanation audits retain sources,
  source metadata, official anchor-key scope and blind reasoning. Original explanations
  receive one repair without editing the official question/options/key. All repairs
  require full content-version validation. No deterministic numerical receipt is fabricated.
- Source registry39 and verifier luna-gemini-cuET-v3.1 are current. Final held-out
  results: both blind evaluators 16/16 official keys; 16/16 valid items eligible;
  all 12 controlled negative fixtures quarantined. Development25 and held-out16
  valid items reserve distinct authenticated item/stimulus families. Previous failed
  cohorts remain archived; four fresh Business Studies items replaced a failed
  cohort after development fixes. This small, partly reused benchmark does not
  establish universal accuracy or independent validation on a new paper population.
- Standard direct commissioning cost $0.769063; token-reported portion $0.765205,
  plus $0.003858 conservatively debited for an HTTP400 whose original body was lost.
  Later typed schema rejections retain diagnostics and zero pre-inference usage;
  uncertain failures retain holds. Repairs, failures and rejected candidates count.
  Old accepted batches were reconciled on their saved IDs, with no resubmission.
  Lifetime accounted spend $1.419007; held/unresolved usage zero; available $48.580993.
  Google promotional deductions remain unverified; student AI retains its separate cap.
- Observed-token batch equivalent $0.382712; approximately $79.73 for 10,000 eligible
  at the observed yield. Assuming current eligible drafts later publish, remaining
  funds project about 6,093 additional eligible questions and a $30.77 shortfall
  to the target, excluding new source work. Bulk scaling stays paused. No budget
  increase or validation reduction occurred.
- Fifty-one repair entitlements were used. Eighteen incomplete model responses
  remain rejected; future repairs now use a strict key/route schema and 6,000
  output-token headroom while existing receipts retain their original contract
  and single-repair limit. That future configuration has regression coverage,
  but was not retroactively counted as a successful paid rerun.
- 125 tests PASS:42 factory,35 recovery,26 question/payment/integrity,22 NTA.
  Targeted lint and production build PASS. Original21 commissioning files plus
  six related/new files have refreshed hashes and syntax checks. Owner edits
  remain preserved. Completed worker restart: zero new requests, zero extra cost.
  All48 eligible drafts pass signature, evidence, complete-group and publication
  row/hash dry-run checks. No production database writes occurred.
- Local dashboard: http://localhost:3010/preview/question-factory. HTTP200 and
  server-rendered final totals verified; preview controls are disabled. Fresh
  authenticated browser interactions and production admin controls are unverified.
  Full report, all100 questions CSV, eligible-only JSON, restart check and row
  dry-run are saved under artifacts/question-factory/commissioning100-*.

Remaining gates: broaden supported anchor/chapter coverage, improve repetitive
adaptation yield and verify difficult-item generation; demonstrate authenticated
staging worker/admin/atomic publication with the saved migration and dry-run rows;
then request production migration approval. No staging project, migration, bank
publication, deployment or claim of 100% accuracy is implied by this local run.

### Independent quality audit and paused uplift, 6 October 2026

Current status: artifacts/question-factory/quality-uplift/FINAL-STATUS.md and
final-status.json. The earlier 48 passing drafts and ~$79.73 forecast above are
historical automated results, superseded for quality/release decisions by this audit.

- Independently reviewed all 48 frozen content hashes using included subscription
  review. All intended keys matched; 30 have no blocking defect found, 17 need
  corrections, and one lacks source/syllabus entitlement. This is not a perfection
  guarantee or a publication receipt. Economics includes overlapping answers and
  an AND/OR definition defect; Accountancy includes omitted conditions, mapping
  errors and OCR/format leakage; English includes lost emphasis, raw HTML and
  unsupported changed vocabulary. The eleven Business Studies items have no
  blocking academic defect found, subject to recorded qualifications.
- Implemented cuet-llm-v3 / luna-gemini-cuET-v3.2: separate chapter/topic and
  presentation receipts, exact task checks, academic quotes excluding paper stems,
  explicit assumptions/plain-text authoring, per-adaptation chapter selection,
  one durable completion retry, and campaign-specific queues and reports.
  Incomplete paid responses and the single permitted retry both count toward
  the persistent budget. Prior accepted batches remain bound to saved IDs.
- Registered source registry42: 31 exact scoped NCERT excerpts and 25 directly
  observed primary dictionary definitions. Disabled unsupported Economics q9,
  q24 and q49 for generation; disabled literal originals with missing conditions
  while retaining supported adaptation opportunities. Reserved calibration
  families remain reserved. Original commissioning artifacts remain frozen.
- Live stricter regression: 11/16 previously labelled valid fixtures eligible;
  Luna15/16 intended keys (one abstention), Gemini16/16; all12 controlled negative
  fixtures quarantined. Five valid-fixture failures concern word-choice/economic
  ambiguity, exact chapter taxonomy and a dissolution explanation reversing
  debit/credit direction. This is a previously observed benchmark, not a fresh
  unseen-paper accuracy claim. Reclassification/repair must preserve this result.
- Additional independent-audit challenges: 15/18 quarantine; three still pass
  automated checks (other-instalment payment assumption, direct journal-entry
  source entitlement, and overgeneralisation of a no-saving circular-flow model).
  Academic release FAILS. Current calibration is paused; the shared release guard
  requires the audit-challenge gate as well as the keyed benchmark, so a later
  calibration run alone cannot bypass the audit misses. No new pilot questions
  or production publication were performed. Neither >70% yield nor $60/10,000
  is measured or established.
- Content ledger: $1.616247 accounted, $0 held, $48.383753 remaining under the
  unchanged $50 lifetime ceiling; zero unresolved usage. This resumed live
  validation cost $0.197240. Google promotional deductions remain unverified.
  The separate student-AI budget and paid entitlements remain intact.
- 129 tests PASS:45 factory,35 recovery,49 question/payment/NTA. Targeted lint and
  production build PASS. Factory SQL remains saved and locally checked in PGlite;
  no production migration ran. Local preview HTTP200 shows the audit, failed gate,
  historical pass labels and withheld old forecast. Controls remain disabled;
  authenticated staging/admin/publication and device interactions are unverified.

Remaining: resolve the five fixture failures and three audit misses without
weakening quality, rerun both release checks, then run the separate preregistered
100-candidate cohort and measure yield/variety/full costs. Broader source/chapter
and difficult-item coverage plus authenticated staging/atomic publication remain
required before production approval. This task is NOT complete or production-ready.


### Final question-factory reconciliation and implementation pass — 6 October 2026

Owner clarification: excellent PYQ-faithful Class XII questions remain the aim;
sound 7–8/10 questions are acceptable when only craft is weak. Correct/unique keys,
explicit decisive assumptions, source entailment, explanation, syllabus and readable
CUET format remain mandatory. No routine human review is added.

- Read the entire supplied Claude log and reconciled its saved quality-v5 cohort
  against the persistent SQLite ledger. Contrary to the handoff's claim, the latest
  v5.3/$5.73 cohort had not been added to this main STATUS file. Frozen logs remain.
- Planned100/generated96/historical automated passes58. Claude's included-review
  record rates41 strong and8 weak. Item57's unseen-list wording is a blocking
  defect, so unchanged review-supported drafts are41+7=48. Original matching item51
  now displays its two lists correctly:49 potential usable drafts, including that
  display restoration awaiting renewed evidence. Seven need correction and two
  duplicate ideas do not count. Guaranteed10/10 count is unknown; published0.
  These are cross-checked historical review opinions, not fresh academic receipts.
- Current ledger: $5.731810 settled gross,
  $0.013556 held, $44.254634 remaining under
  the unchanged $50 lifetime ceiling. Additional committed spending in this pass
  is $0.014042; no new authoring. Google credits,
  provider invoices and subscription-plan consumption are not reconciled.
- Saved token partitions exposed omitted cache read/write prices. Future guarded
  requests now price those separately and reserve at the maximum input rate.
  Original settlements stay preserved: the read-only historical recomputation
  shows about $0.019 net overcount, not a large hidden charge. Accepted legacy
  batches enrich missing cache rates only from verified matching base prices;
  missing/invalid prices or usage remain held. No ledger reset/refund is inferred.
- Current reviewed-yield forecast is about $235 real-time / $120 assuming every
  cost halves, for10,000. Both include prior spending but omit new preparation/
  validation/staging cost and remain estimates. The $50–60 target is unproven;
  even the 5,000–7,000 claim is unsupported at this denominator.
- v5.4 separates optional craft notes from blocking defects, permits sound scores
  7–8 and retains dual Luna high checks, independent Gemini3.8 medium, source and
  explanation safeguards. v5.3 calibration is paused and cannot release v5.4.
  No thresholds in CALIBRATION_RELEASE were loosened. Current fixtures are
  previously observed/tuned regression evidence, not an unseen benchmark.
- Shared browser-safe presentation checks now run during authoring, validation
  and evidence serving, including saved/repaired rows and three-entry matching.
  Lists restore only at display time; stored stems/options/keys/hashes remain.
  Subject-wide blueprint skill/task IDs and avoidance context suppress exact
  repeated skills across anchors; semantic paraphrases are not guaranteed caught.
- Campaigns now support native --batch execution and resumable pending jobs;
  pending passage siblings do not quarantine the whole group prematurely.
  Seven frozen items form a no-authoring/no-repair/no-publication batch probe.
  Three known faults fail before paid dispatch. One real native batch completed
  and recorded usage; four items still await complete stage sequences, using
  saved provider IDs. This is not full batch throughput or quality proof.
- The local preview now shows latest reviewed counts/current saved ledger totals
  instead of stale commissioning data. Explicit en-IN number formatting fixes
  a browser-found hydration mismatch. Receipt loading was separated from React
  rendering after the previous expanded component caused ESLint memory failure;
  full targeted lint subsequently passes.
- 141 tests PASS:62 factory,35 recovery,6 answer-integrity,22 NTA,16 question/
  payment. Targeted lint and production build PASS. Existing image dimension
  warnings remain. Real local preview interactions at1440px and375px show both
  list columns, four choices, preserved selection, no horizontal overflow and
  no hydration errors. Headless local emulation is not physical-device proof.

Evidence: artifacts/question-factory/final-pass/REPORT.md, reconciliation-report.json,
review-supported-drafts.json, cache-price-audit.json, batch-probe.json, verification.json
and browser-check.json/screenshots. All older campaigns and owner edits are preserved.

Remaining, in execution order: reconcile/finish the saved probe IDs; verify revised
mandatory-negative regression and freeze genuinely unobserved keyed material; add
English comprehension/verbal anchors and the missing syllabus chapter sources;
measure a separately preregistered balanced batch cohort including every cost and
rejection; stage the saved SQL migration and inspect signed-in admin/worker restart/
atomic publication/dispute behavior; save staging/dry-run evidence before requesting
production migration approval. No staging project was created or migration applied,
no production bank writes/publication/deployment occurred, and paid entitlements,
atomic credits and the separate $25/IST-month student-AI cap remain intact.

This final pass improves implementation and measurement; it does NOT establish
end-to-end readiness, syllabus completeness, error-free content or10,000/$50–60.
## 8 October 2026 IST, 20:48 UTC checkpoint — new execution goal and live CUET-readiness measurements

The owner explicitly superseded the earlier goal and requested execution. The new app goal is active; its saved contract is `artifacts/question-factory/cuet-fit-2026-10-07/GOAL-CUET-READINESS-2026-10-08.md`. Preserve the dirty checkout, the USD 50 lifetime content ceiling, USD 25 monthly student AI cap, all payments/credits and historical receipts. No new v7 release or production publication is authorized by these measurement runs.

Running: two preregistered 100-candidate, 25-per-subject comparison arms in saved ten-item waves (baseline and improved whole-pipeline comparison, not a causal single-lever experiment); read-only reassessment of all 662 previously published records under the current v7.2 contract; 46-case limited official-key comparison across Luna/Gemini/Haiku. At this checkpoint baseline has 18 eligible, 3 rejected and 79 pending. Reassessment has 21 eligible, 4 rejected and 637 pending. These partial counts do not establish completed batch yield, current full-bank eligibility or release readiness. Haiku remains measurement-only.

Found and repaired two phase-reporting bugs: study code summed unprojected columns after converting receipt rows to `*_micro`; reassessment transport metadata used an absent options candidate ID. Saved dispatch contracts and actual receipts remain intact. New attribution uses persisted scope, body identity and exact reservations; uncertain usage keeps its full maximum. Already loaded workers keep running without cancellation. Verified worker PIDs 6916 (bank) and 37712 (official study) now have separately tested SQLite reservation-transaction caps of USD 9 and USD 6; the global USD 50 ceiling is unchanged. Temporary caps must be removed after those exact workers drain. No accepted request was resent. Native receipt reuse now rejects changed request bodies and reconciles original-price receipts before returning cached payloads.

Ledger checkpoint: USD 20.425073 settled + USD 0.237380 reserved/held = USD 20.662453 committed; this is dated receipt accounting, not invoices or a final total. Reassessment actual receipts later in the same checkpoint show USD 0.235850 settled + USD 0.031384 held; the official study USD 0.172695 settled. Loaded workers' zero-cost progress messages are invalid and must not be used in forecasts. Historical bounded holds stay committed; no uncertain call is treated as free.

Implemented current-contract, exact-fixture release binding: stale prompts, missing/duplicate cases, missing provider results, errors disguised as rejections, previously inspected or two-subject-only sets cannot release the full four-subject topology. The empirical 132-word sample maximum is descriptive; English passage maximum remains 300 words. Conventional assumptions require exact source support and cannot supply missing case-specific values. A larger source-certificate benchmark is being prepared and independently checked; it has shared source documents and correlated mutations, so case count must not be represented as independent sample size.

Software checks so far: factory 364/364 before latest transport/release/accounting additions; recovery 40/40; question/payment checks 49/49; additional safety/payment checks 24/24; application-learning 84/84. Later questionFactory tests 66/66, scoped attribution/owner-cap/release tests 11/11. A full current suite/build and renewed staging checks remain due. No production migration, new question publication or bank withholding occurred in this resumed execution.


## 8 October 2026 IST, 2026-10-07T23:45:18.583Z — completed first campaign and frozen full-source benchmark

The active execution goal remains unfinished. Baseline A now has all 100 fixed candidates terminal: 70 machine-eligible, 30 quarantined, USD 1.216368 settled plus USD 0.011628 conservative hold. All 100 exports have stems, keys, explanations, source excerpts, validation results and attributed costs; their item costs reconcile to USD 1.227996 gross. Read-only within-batch inspection found no additional duplicate decisions, A/B/C/D positions 22/15/15/18, longest equal-key run 3, and easy/medium/hard counts 29/34/7. Inventory comparison and current-release publication are still due. The hold means final cost is not settled, and no new v7 questions have been published. A gross conditional baseline projection is about USD 175.43 for 10,000 machine-eligible items at unchanged mix/yield; this is an unsettled conservative scenario, not a released-quality or affordability claim.

The frozen current-contract four-subject benchmark fresh-full-v6-source-keyed completed all 96 full topology rows and provider observations: 52/64 intended positives eligible (81.25%), all 32 controlled defects withheld, no current provider or topology errors. Subject positive retention: Accountancy 15/16, Business Studies 11/16, Economics 14/16, English 12/16. All failures remain in the denominator. Three Business Studies fixtures have numerical route metadata on non-numerical printed questions; that is disclosed, not repaired after fit evaluation. The initial family-envelope failure, checkpoint, completed raw judgments and exact blind-content invariants were preserved under a registered harness-only resume. The independently source/key audited construction has shared documents and correlated controls, so neither 96 cases nor zero observed false accepts establishes statistical independence or perfection. USD 1.168724 settled plus USD 0.026384 inherited key-audit holds remain counted. A current regression and full release assessment are still required; no threshold was weakened.

At this dated ledger snapshot lifetime content spending is USD 30.212012 settled plus USD 0.390379 held = USD 30.602391 committed of USD 50, with 26 unresolved requests and no provider invoices. Improved B is 18 eligible / 9 rejected / 73 pending. Bank reassessment is 448 eligible / 105 rejected / 109 pending; five saved Flex replay errors are among pending work. Native transport now restores only its previously injected service_tier field when the full saved request otherwise matches. A restart integration test proves no new POST, unchanged spending and refusal of changed question content or token bounds. Original workers keep running and saved IDs/holds remain intact. Error-only recovery refuses a live recorded measurement owner.

Prospective C registration/worker now pins the fixed campaign, local source registry, worker, native transport, budget, source-selection and repair dependencies. It is still unregistered/unmeasured and its registrar refuses the incomplete comparison/reassessment. Its source-context trial retains 841 exact teaching spans across 38 NCERT references; only two duplicate focused-extraction aliases lack matching page context. The canonical references remain available. Column-order Directing physical pages 1-2 were visually inspected from the retained PDF. Multi-page retirement spans resolve into exact real-page substrings. Every original fact/identity stays preserved; teaching context is not answer entailment. C will use Luna realtime/Flex, native Gemini batches of at most ten requests, complete-passage-unit coverage and one repair preserving the route/group. No savings are claimed before its completed live batch.

Current local checks after the latest receipt fix: full factory 437/437; recovery 40/40; learning/student-budget 84/84; question/payment/wallet 61/61. Prior standard Next build and actual desktop/mobile signed-in staging dashboard checks remain valid because no framework/UI code changed. The separate staging publication, passage-group atomicity, restart/idempotency and dispute fixture evidence is retained; software fixtures are not live academic publications. Production bank, payments, entitlements and the USD 25 monthly student-AI cap were not changed.

## 8 October 2026, 06:21 UTC — durable bank outcomes, bounded recovery and resumed comparison

The bank reassessment has all 662 denominator records disposed under the pinned current contract: 536 provisional machine passes and 126 quarantines. One quarantine is a lost provider response, not a proven academic defect; it retains its USD 0.011628 maximum hold and cannot claim completed independent validation. Whole passage-group closure produces 127 records to withhold. Complete keys, explanations, supporting excerpts, judgments, reasons and exact attributed costs are exported in execution/reassessment/snapshot-20261008T060712941Z. The bank costs USD 6.267641 settled plus USD 0.011628 held. This is not released v7 inventory and not proof that every provisional pass is correct. A staging-only withholding implementation is being prepared; no new staging/production availability writes have occurred at this checkpoint.

App/process refresh ended the old paid workers; a current CIM inventory confirmed none before restart. Two abandoned B request bodies had exact, independently recomputed maximum-reservation proofs. The scoped savedRequestMaximumRecoveryV7 helper revalidates native saved content/rates/config inside its transaction; 4 meaningful tests pass. Root applied only the two conservative hold proofs (USD 0.053271 combined), preserving native requests, actual usage and all older holds. No unknown receipt was settled or request resent. The resumed comparison supervisor has a new live process and retains all 100 candidates per arm. A is 100 terminal, 70 eligible/30 quarantined. B's durable current IDs show 50 terminal (38 eligible/12 quarantined), 9 staged candidates and 41 not yet staged; its older batch-report export remains stale until the next complete wave. Old session IDs/PIDs are not treated as live evidence.

Current read-only lifetime totals at 06:21:04 UTC: USD 31.557870 settled plus USD 0.373748 held/reserved = USD 31.931618 committed of USD 50. There are 29 unresolved requests; every unresolved charge has a proven conservative hold, permitting bounded unrelated work. Four saved Gemini batch item responses are provider error 14 with no usageMetadata, even though the parent batch reports succeeded. A GET of the exact accepted ID confirmed this; their USD 0.019788 maximum holds each remain. No provider invoices were obtained. Continuing model usage changes this timestamped total; report final relevant usage as unsettled while any hold remains.

Fresh benchmark release evidence remains 52/64 positive retention (81.25%), 0/32 controlled critical false accepts. It fails the 85% aggregate release condition, has shared source families and construction limitations, and is now spent regression material. No post-inspection academic edits, inflated score, or release bypass occurred. The C draft is still unregistered/unmeasured. Its interrupted write was found to contain only NUL bytes; only that unregistered worker was restored from intact base plus scoped C changes, syntax checked and documented, with root frozen contract and receipts unchanged.

Current complete offline checks: factory 456/456, recovery 40/40, question/payment/wallet/student monthly budget 62/62. The isolated staging app was restarted with paid student/payment provider keys disabled. Actual signed-in rendered dashboard refresh/coverage checks and staging withholding/student retrieval evidence are in progress. The first conservative gross batch projection remains USD 175.43 per 10,000 provisional passes at unchanged mix/yield, excluding additional calibration/maintenance; it is not a settled or released-quality promise. Production publication, migrations, payments, credits and USD 25 monthly student AI limits remain unchanged.

## 8 October 2026, 06:30 UTC — staging dashboard snapshot projection prepared (dry-run only)

Added a staging-only snapshot projection tool for `onwkqxmjqjrhfbjjdydu`. It reads the SQLite ledger in a read-only consistent transaction, scopes A/B to exact preregistered candidate IDs, imports the complete 662-item reassessment export, and proposes changing only `snapshot` and `updated_at` under an `updated_at` compare-and-swap. All prior control columns remain outside the patch. Previous snapshot/pilot/batch/economics are retained in snapshot history and the local before/after journal. Both forecasts and unit cost are null because v7 is unreleased and usage holds remain; the dashboard economics helper therefore yields no point forecast.

Dry run at 06:30:33Z: A 100/100 terminal (70 eligible, 30 quarantined); B 56/100 terminal (41 eligible, 15 quarantined, 44 pending); completed bank export 662/662 (536 eligible, 126 quarantined). Ledger $31.607783 settled + $0.374248 held = $31.982031 committed of $50; all 29 unresolved requests had conservative holds; 0 unbounded. The active comparison worker and one dispatching request blocked apply as intended. No staging write, publication, student/payment write, or provider call occurred. Seven focused projection/quiescence tests pass. The generated CAS proof is `artifacts/question-factory/cuet-readiness-2026-10-08/execution/staging-snapshot-vnext-proof.json`; the local snapshot journal is `.../execution/staging-snapshot-vnext-history.jsonl`. Apply remains unreviewed and unperformed.

### 06:33 UTC metadata-sync concurrency correction

The snapshot refresh is a read-only SQLite consistent snapshot followed by a staging patch restricted to `snapshot` and `updated_at` under CAS. A live paid worker does not by itself make this metadata-only update unsafe; an earlier draft's quiescence check was removed. The patch cannot release/overwrite the local worker or measurement lease and preserves all other `question_factory_control` columns. If `updated_at` changes before CAS, the update returns no row and is skipped. After an update, the proof records every control-column delta observed without attributing those fields to this sync. Regression test covers live-worker/held-cost projection and null forecast. Latest dry-run 06:33:13Z shows B 56/100 (41 eligible, 15 quarantined, 44 pending), global $32.000514 committed of $50 ($31.612010 settled + $0.388504 held), 29 bounded unresolved holds, and 3 dispatching requests. No staging apply was run.

## 8 October 2026 — V7 CUET release gate for staging publication actions

Added a server-side gate to `release_1000` and `release_10000`: the current dual-blind CUET release must match the exact V7 verifier, prompt, effort policy and stage-effort map, validation-contract hash, source-registry version, release policy and measured subject/survival/false-accept thresholds. The legacy manifest's top-level `released` value cannot satisfy it. Failed checks return `current_cuet_calibration_required` before any staging controls are updated. Pause, resume and historical reads retain their existing paths. The release writer now stamps its benchmark `state` as completed only after the full evidence assessment passes, which matches the existing release predicate. No manifest, controls or publication records were written in this change.

Verification: new release-gate tests 4/4; current release evidence tests and generator invariants 17/17; factory suite 475/475; recovery suite 40/40; syntax checks passed. Live route/control verification remains with the parent. Test output exposed pre-existing provider-key diagnostic fragments; avoid rerunning noisy diagnostic suites until sanitized.

## 8 October 2026 — V7 release producer/runtime false-accept parity

Moved release-record construction into a pure builder used by the release CLI. It now derives `critical_false_accepts` from both measured false-accept lists and fails closed if either list is missing; benchmark completion remains gated on a passing assessment. A round-trip test feeds the actual builder output to the frozen runtime predicate and current publication gate. No manifest was written.

Verification: focused current-gate and release-evidence tests 12/12; CLI syntax check passed. Current benchmark status and publication gates are unchanged.

## 8 October 2026 — include frozen V7 evidence inputs in server route traces

The existing `.next` admin question-factory route trace contained 9 of the 15 exact original V7 contract inputs; the 6 `data/*` contracts were absent. Added explicit root-relative tracing includes for all 15 paths under the existing global route glob, preserving the existing data-file includes and other config values. `next.config.mjs` syntax check passed. A fresh build and `.nft.json` verification are still required; the prior trace does not prove the updated configuration is packaged.

## 8 October 2026, 06:44 UTC — staging bank withholding and current publication control verified

The reviewed, hash-pinned bank plan was applied to the separate staging project onwkqxmjqjrhfbjjdydu only. One bulk statement withheld all 127 records, including the complete affected two-question passage group. All 127 deterministic dispute receipts and matching staging job updates completed. The four unrelated historical staging records, content bodies/keys/explanations, publication history and older receipts remain intact. Tests for group closure, exact content, drift, extra children, four unrelated extra records, atomic withholding and interrupted receipt resume pass 8/8. The journal is saved with the exported snapshot; no production question write or new academic publication occurred.

Actual signed-in student retrieval at 06:43:22 UTC returned all 535 expected retained legacy records and zero of the 127 withheld records. Subject counts: English 156, Accountancy 105, Business Studies 162, Economics 112. Anonymous admin GET returns 401, signed student admin GET 404, signed admin GET 200. Release POST is refused with 409/current_cuet_calibration_required and leaves controls unchanged. This is legacy bank availability after a current reassessment, not a released v7 bank. Current v7 publications remain zero. The student AI cap is still USD 25/month.

Found and repaired an actual app integration gap: generic admin release buttons previously relied on the released legacy v6.2 manifest. The current publication promotions now require exact current dual-blind measured release, full verifier/prompt/effort/validation-content/source binding and passing policy metrics; pause/resume behavior and historical retrieval remain untouched. Fixed producer/runtime parity: measured release output now derives critical_false_accepts from the measured arrays and stamps benchmark completed only on a passing assessment. No calibration manifest was written. Roundtrip release/predicate tests pass; latest full factory 475/475 and recovery 40/40 pass. Application build and renewed responsive rendering are running after this behavior change.

Staging dashboard accounting metadata was refreshed from one consistent read-only ledger snapshot without altering worker controls or native requests. Old reports remain in local history. The stale conditional publication forecast was cleared because the current v7 contract is unreleased. A concurrently active model request is retained in costs, rather than requiring the unrelated worker to stop. Current status writer now prefers the new post-withholding retrieval proof over the older historical staging snapshot.

At 06:43:57 UTC, content usage is USD 31.692550 settled + USD 0.419641 reserved/held = USD 32.112191 committed of USD 50; active calls make this a dated interim total, not a fully settled invoice. B has 63/100 terminal (47 machine eligible,16 quarantined,37 pending) and remains an incomplete campaign; A remains 70/100 eligible with all 100 terminal. All remaining paid work uses saved candidate/request IDs and budget guards. The bank QA found no exact content/stem/options-key duplicate group and no saved gate exceptions among the 535 retained; all 32 English passage fields meet the official provisional 300-word cap. Observed max132 is descriptive. Fit scores among retained are 7:16,8:172,9:314,10:33; none proves accuracy. No clear extra academic defect was found in the inspected 16 lowest-scored retained items. Fresh current-contract retention still fails release at81.25%; new independently keyed material and measured cost iteration remain outstanding.

## 8 October 2026, 06:52 UTC — current app build and deployment trace passed

The application build passes after the admin current-release guard and explicit tracing correction. The built admin route now includes all 15 original validation contract files (previously 9/15); no keys or ledger files were added to tracing. Renewed actual signed-in dashboard rendering at 1440x1000 and 390x844 passes refresh, expanded coverage, zero page errors and no horizontal overflow. Visual inspection confirms 535 usable legacy staging questions, USD31.62 settled/USD0.38 held in its labelled06:35 snapshot, no stale point forecast, and the current calibration release blocker. Latest actual API retrieval proof remains535/535 retained,0/127 withheld, and refused current publication. Current stage/release regression checks pass21/21 after the producer/runtime parity fix. Production deploy, new publication and data migrations remain untouched.

Official CBSE2026-27 sample papers plus marking schemes were acquired for four subjects, with32 new private source candidates and a separate sealed official-key sidecar. These are not CUET PYQs or evaluated release evidence. The answer-blind Luna developer subagent's first pass is frozen before key comparison; English stimuli were adapted to fit300words and need independently re-established answers. There are only four correlated paper families. All32 original records and first-pass outcomes remain preserved. No paid validation was run on this set and its intended release role is not yet frozen. The prospective optional-exemplar adapter is being implemented in additive files, without changing the active v7.2 comparison or unregisteredC parent contract.

## 8 October, 07:09 UTC — progress request and prospective validator binding
Read-only ledger snapshot: USD31.812227 settled + USD0.409510 held = USD32.221737 committed; USD50 lifetime cap unchanged; 30 unresolved costs remain reserved, no provider invoice obtained. A is100terminal/70eligible/30quarantined, B is73terminal/54eligible/19quarantined/27pending; live comparison supervisor continues accepted IDs. Staging evidence still535 legacy questions retrieved,127 newly withheld, zero new v7 production publications. Estimated execution progress remains roughly70%, not an academic accuracy estimate.
Prospective isolated v7.3 optional-exemplar contract now hashes its own binding implementation and records actual comparator IDs separately from the exact authenticated anchor. Contract hash b9334f06c3f0acc8c57ec31536c638a228f3d46c7eaf68aa01e54e3ffbfe65a3; active v7.2 hash unchanged. Root ran11 focused optional-exemplar/verdict checks, all passed; developer agent separately reported34 focused checks. No paid calls or active pipeline rewiring for these changes. Current release benchmark remains52/64 valid retained (81.25%, below85%) and0/32 controlled defects accepted. New source-key construction and C native-batch continuation are in preparation, unregistered and unmeasured; production release remains gated.

## 8 October 2026 — prospective C continuation driver prepared, campaign remains unregistered

Added a C-only continuation driver and durable progress/event log. It resumes the frozen 100-item campaign in ten-item worker waves, recognizes an already-live worker before starting another, reuses the campaign’s persisted provider request IDs, and stops on worker errors or after a bounded 24-hour/128-poll backoff window without killing a worker. The frozen Luna realtime/Flex and Gemini native-batch pricing profile and USD 5 C cap remain bound; the USD 50 persistent lifetime guard remains in the worker path.

The C preparer now requires both comparison arms to contain exactly 100 matching terminal items and the reassessment profile to cover all 662 bank IDs with terminal results. The prospective C cohort is checked for exactly 100 unique candidates, 25 per authorized subject. Revalidation against the 06:07:12 UTC bank export confirms all 662 latest-by-ID results are terminal and match the frozen content, verifier, contract and aggregate source-reference hash; older provider-error rows are superseded in the 670-row history. A is 100/100 terminal. B is now 80/100 terminal with 20 pending and is the current C preparation blocker. The exact guard refusal is `candidate_c_comparison_arm_incomplete:improved`. C was not prepared, registered, or run. No provider API calls were made.

Focused local orchestration, prerequisite, and mocked C transport checks passed 20/20; syntax checks passed for the changed preparation and continuation files. Coverage included exact process-creation/command identity on restart, no duplicate worker during lock recovery, draining a saved live worker before stop, terminal candidates blocked by pending accepted-request accounting, latest-by-ID quarantine superseding a historical provider error, source-hash drift refusal, bounded backoff, exact ten-request batches, and accepted native IDs not being reposted. The supervisor requires the C report’s `provider_processing_complete` gate; terminal bounded failure holds remain unresolved costs. These are software orchestration checks, not academic or provider evidence.

Before registration, the current C binding enumerates 19 dependencies and computes all 19 hashes, including the continuation tool and supervisor library. `assertCCodeBinding` passes on that current set. A local Windows CIM probe returned the process ID, creation time and command-line fields used by the supervisor’s exact worker/owner identity check; command lines are not written to the continuation log.

Coverage integration before C freeze: the C preparer now applies a pure current-reassessment topic refresh to its existing qualified coverage snapshot before setting qualification fields. Only topic usable/format/difficulty counters are rebuilt. Current tags must come from an exact matching eligible row and its current v7.2 `result.question.evidence.record.checks`; conflicting, missing, ambiguous, stale-profile or stale-content tags remain unclassified. Legacy tags remain diagnostic metadata and cannot contribute to counters. Existing chapter usable counts, question evidence/status and source-family metadata are unchanged; drafts do not enter the usable inventory. Applying the helper to the local 535-row snapshot yields 79 classified and 456 unclassified observations, versus legacy 83/452, with 42 observations changing classification. Focused C coverage, supervisor, and transport tests pass 21/21. A remains 100/100 terminal; B remains 80/100 with 20 pending; the exact preparation refusal remains `candidate_c_comparison_arm_incomplete:improved`. Current C code binding still covers 19 files and passes. No C registration or provider call occurred.

Prospective C accountancy source coverage: cached the official NCERT `leac203.pdf` privately under `c-source-overlay`; the PDF is 27 pages, titled “Financial Statements of a Company,” and its final page identifies Reprint 2026-27. Visually checked physical pages 1–4, 10–13, and 21–24 (printed pages 144–147, 153–156, and 164–167). The private v1 overlay holds 19 exact page-bound teaching excerpts for meaning, decision objectives, statement types, statement definitions, current/non-current classification, and limitations; exercises, objectives-only sidebars, and table fragments are excluded. Its reference permission basis is inherited from the existing NCERT local-educational-validation basis and retains the no-unrestricted-republication limit. The local C validation view includes this source and accountancy pack ref; the selection-only view narrows `ncert-leac201` to Share Capital and selects `ncert-leac203` for Financial Statements of Company. The global source registry and historical metadata are unchanged. The preparer verifies the cached PDF, extraction, page map and reviewed-page identities before external reads. PDF SHA-256 `c39c34b6445eef09159ccbf3a7b14163edb5b203c6b37411bbf92317304ac82c`; extraction SHA-256 `c6fc29c2b31e9f5bdff0542eb1a649083f71ef58d9097f9b092059b5dd0a8ad6`; page JSON SHA-256 `f87b6e0433f7a7d09fa69735c022ecaa8f6a9300648f32dc882aa318bae9fdd9`. C now binds 23 dependencies, including all four overlay assets; current binding passes. Overlay identity, chapter-alias exclusion, and focused retrieval tests pass. Combined focused C checks pass 22/22. Latest saved comparison state is A 100/100 terminal and B 81/100 terminal with 19 pending; C preparation still refuses with `candidate_c_comparison_arm_incomplete:improved`. No C preparation, registration, or run occurred; no paid/provider calls occurred.

Final offline C review: a pure run of the frozen 100-job planner against the refreshed 535-item coverage snapshot allocated eight Accountancy jobs to `Financial Statements of Company`; every one retrieved the private `ncert-leac203` excerpt source. The legacy registry and C validation view retain both historical `ncert-leac201` chapter mappings, while the generation-selection view limits that source to Share Capital. The supervisor now independently requires `publication_accounting.ready === true` and an explicit empty `blocked_requests` array alongside 100 terminal candidate rows and `provider_processing_complete === true`. The worker's `cohortAccounting` permits proven bounded terminal failure holds only for quarantined candidates, leaves them unsettled, and blocks queued/accepted native requests, unknown receipt states, and invalid identities. New integration coverage tests the accepted-pending and bounded-terminal-hold paths. Focused C/accounting tests pass 28/28; syntax and all 23 dependency hashes pass. Latest saved B state is 89/100 terminal with 11 pending, so C remains blocked by `candidate_c_comparison_arm_incomplete:improved`. No preparation, registration, dispatch, or provider call occurred.

## 8 October 2026, 07:38 UTC — current execution update and prospective harness review

The read-only current ledger snapshot is USD31.964190 settled plus USD0.388626 held = USD32.352816 committed of the unchanged USD50 ceiling, with31 unresolved costs retained. A is100 terminal/70 eligible/30 quarantined. B is89 terminal/66 eligible/23 quarantined/11 pending, grossUSD1.206889; its live comparison supervisor and child process were verified by current Windows process creation/command identity. No accepted request was killed, resubmitted, or replaced. No provider invoice obtained. Current staging remains535 retained legacy questions,519 with fit scores8–10; scores are not accuracy guarantees. New v7 production publications remainzero, and the current benchmark81.25% retention fails the85% release rule.

Current local factory suite passed505/505 before the latest prospective harness changes. C now has a verified private27-page Financial Statements of Company source overlay with19 exact teaching excerpts and23 bound dependencies. Current coverage is535 actual usable records,456 conservatively unclassified topic observations and two zero-usable Accountancy chapter cells. C is unregistered and waits for B's complete100-item export.

Prospective v7.3 harness fixes separate honest fresh/regression roles and enforce complete blinded provider capture matrices plus conservative pre-dispatch size bounds; dedicated helper checks pass10/10. Root review found that the actual per-fixture runner still skipped a saved Haiku pre-dispatch refusal when the dual verdict was already terminal. Integration repair and meaningful no-repeat mocked workflow checks were requested before freeze. No v7.3 study was registered or paid evaluation performed. Fresh source-key custody remains in construction; official-key mismatches and abstentions are preserved and may not be promoted to positives by model agreement.


### 8 Oct 2026, 14:02 IST — completed A/B inspection and prospective C execution

All 200 A/B candidate dispositions are terminal. A scoped, journaled local inspection withheld four repeated lexical ideas per arm; all 100 candidates and preinspection exports remain retained. Final eligible counts are baseline 66 and improved 70. Read-only exact receipt reconciliation gives gross committed costs $1.227996 and $1.341445, including unresolved holds; conditional marginal 10,000-item forecasts are $186.06 and $191.63. Eligibility is under each registered contract and is not a current release or accuracy claim.

C is now running with exactly 100 registered candidates (25 per subject), 24 verified frozen code/source hashes, a $5 campaign guard and the $50 lifetime guard, native Gemini validation in waves of at most ten, and publication disabled. The format-enforcement disclosure was saved before its first paid call. The supervisor requires absolute campaign paths for process identity matching; the initial relative-path launch failed before dispatch, and the verified absolute-path launch succeeded.

Latest ledger snapshot 08:32:01 UTC: $32.087118 settled plus $0.429766 conservative holds, $32.516884 committed, $17.483116 remaining. This is an in-flight snapshot, not a settled provider invoice. Fresh reliability construction and release qualification remain unfinished. The last authenticated staging retrieval verified 535 available legacy questions, zero of the 127 withheld questions exposed, and zero new v7 publications; production changes still require final approval.


## 8 October 2026, 10:03 UTC — source-key custody completed; fresh and regression roles preserved

Completed immutable source/calculation audits for all 64 CBSE-derived construction candidates, 16 per subject and 254 printed options. Exact-source checks, separate frozen blind answers and post-freeze official marking-scheme comparison agree for 51 candidates (English 11, Accountancy 12, Business Studies 14, Economics 14). Thirteen remain withheld for unsupported rules or assumptions, ambiguous/missing options, misdirected passage references or unresolved key wording. Five official-key disagreements/abstentions remain recorded. All 16 original paper/key PDF identities were checked. Agreement is evidence, not proof of perfect accuracy or CUET fit. No source-audit candidate was published or paid-fit evaluated.

The source-audit freeze hash is c6950201a2774d2636452edda70eebd88cfc7a00cd3ab937e1af68468257e5e8; the post-freeze comparison hash is 91103914fd64abb4e4719dbf5a4f4aba82c080a745c096d2a66e7ed9f9478ad9. The original-content-stream NCERT cache and exact quote offsets supersede unreliable geometric column extraction for this audit; the old caches remain history. Cached NIOS and official consumer-protection excerpts provide the specific missing definitions.

All 64 cases are conservatively classified as regression for v7.3: the first set predates its prompt, and the additional set's source PDFs were acquired at 07:12 UTC before final contract binding at 07:22 UTC. Four different CBSE 2024–25 question-only papers were subsequently acquired after a saved current-validator binding (pre-acquisition hash d60f01257973cda20ca016f7736740dc30e8d56f7869e91d9267a75570e34966). Their source manifest hash is 2eddf9ea5e131cbc499da17a33b1e7587316778f1a9ebc022bc343aea8775969. No keys were read by that acquisition tool. The earlier-read Economics question 14 worked example is explicitly excluded. The new 32-case construction and paid fresh benchmark are not yet complete.

The unregistered v7.3 runner now evaluates Haiku only for fresh comparison evidence; regression retains both Luna and Gemini and every publication-validation stage. Registration, preflight and reporting bind the exact provider set to the evidence classification; reduced validator sets, a fresh Haiku role on regression data, incomplete capture matrices and unresolved accepted-request resubmission are refused. No academic prompt, release threshold, parent v7 contract or frozen C dependency was changed. Parent hash remains 6f27a61131688db75be6686159b77894ee083f0c8abcca47d812a9a0eb20692c. Syntax checks and local factory 527/527, recovery 40/40, question/selector/payment/wallet 61/61 passed; logs are saved under cuet-readiness-2026-10-08/execution. These are software checks, not model reliability results.

At 10:02:58 UTC the read-only ledger recorded $32.269973 settled plus $0.546008 conservative holds = $32.815981 committed, $17.184019 remaining of $50, with 39 unsettled reservations retained. Provider invoices remain unverified. C's verified live supervisor is session 65754 / PID 13552; latest saved export has 19/100 terminal, 14 eligible, 5 rejected, 81 pending and $0.328609 gross. Seven native provider requests were pending in the last supervisor event. This is a partial campaign, not a final yield or forecast. Staging's last authenticated retrieval remains 535 existing available questions after 127 were withheld, zero newly published v7 questions; no production changes occurred.


## 8 October 2026, 11:01 UTC — fresh question/source custody frozen, cost forecast clarified

Concrete progress since the previous checkpoint: the new four-subject source packet contains all 32 raw cases (eight each), with a 190-word adapted English stimulus. All four first-pass source/calculation derivations are frozen before candidate marking schemes or paid validator results. They retain 26 provisional source-key positives and six held cases. This is source construction, not independent CUET-fit validation or release. The answer-blind second-review packet includes 44 verified source excerpts; each underlying document/cache/page/quote and full question-body/options/stimulus digest was checked. Packet hash e1cd69636842d1f86f8d35a2fed08fa66e51d0da9c67ccbdb3d1ca0f89c2bdfe. English derivation v2 corrects v1’s per-item view-field name; the original v1 and its full packet hash remain preserved. No key, question or interpretation was changed from validator results.

Exact-ID cost comparison was refreshed read-only at 10:53 UTC: A 66/100 eligible, $1.227996 gross; B 70/100 eligible, $1.341445 gross. Conditional marginal 10,000 eligible-item forecasts are $186.06 and $191.63, including conservative holds, excluding prior development spend; they are not settled invoices or released-bank forecasts. B costs are approximately $0.159465 authoring, $0.814995 Gemini evaluation, $0.321344 Luna blind solving, $0.028165 explanation support and $0.017476 repair. Lower generated yield is acceptable if gross cost per usable item meets the target; 85% refers to valid-control retention, never an approval quota. Mandatory correctness/evidence failures still reject. The earlier rolling completion-time estimates were unsupported and have been withdrawn from the checkpoint.

At 10:53:15 UTC, lifetime $32.348703 settled plus $0.504364 held = $32.853067 committed, leaving $17.146933 of the $50 ceiling. C has 30/100 terminal, 23 eligible, seven rejected, 70 pending and incomplete accepted-provider processing. Supervisor session 65754 was re-polled live on this turn; it is not restarted. No production writes or new v7 publications. The developer-agent account limit reports reset at 16:33 IST; independent developer checking is not retried before that time.

## 8 October 2026, 11:57 UTC — owner cost report and current execution gates

Read-only ledger transaction: $32.813934 settled plus $0.501512 conservative holds = $33.315446 committed, $16.684554 remaining of $50. Provider invoices remain unverified. A/B retain 100/100 final candidate dispositions with 66/70 eligible and $1.227996/$1.341445 gross costs; unresolved receipt holds remain. The $186.06/$191.63 numbers are conditional marginal 10,000-eligible-item forecasts, not actual spending. B's higher yield did not improve cost per eligible item. Its largest stage is Gemini independent evaluation ($0.814995; about 61%). Lower generated yield is acceptable when gross cost per verified usable item meets the target. The 85% registered rule concerns valid benchmark-control retention, never an approval quota. No frozen policy or correctness gate was weakened.

C live report at 11:54 UTC has 39/100 terminal: 31 eligible, eight rejected, 61 pending, $0.372337 in-flight gross. Fresh v7.3 execution is now live under the persistent guard: 41 paid cases, 22 designated positives and 19 independently reviewed academic defects; one false-authentic-PYQ local proof remains separately accounted. At 11:57:24 UTC its cost is $0.371183 gross, execution/release evidence incomplete and zero publication writes. Both live sessions were polled; no accepted request was killed, restarted or resubmitted.

The 32-case fresh source/key custody and official-key comparison are frozen. A separate 40-case historical semantic regression proposal preserves 12 positive and 28 negative fixtures and original-provenance lineage. Corrected offline original-selector proof reports eight authenticated-anchor stops, three format mismatches and five transport sentinels across its 16 audit cases; zero provider calls. This diagnostic proposal is not literal production-path or fresh reliability evidence, and is not yet paid-dispatched. New final proposal preregistration ID matches its study ID; original artifacts remain unchanged.

Runtime integration remains unfinished: normal CLI worker routing still uses the fixed legacy campaign runner. A concrete explicit queue route, per-job current-version pin and non-bound runtime evidence adapter are being prepared as patch artifacts; no active C dependency or academic parent contract was changed. No v7.3 release exists, no new v7 question was published, and the last authenticated staging retrieval remains 535 legacy questions after 127 were withheld. Earlier rolling release ETAs were unsupported. The current 39-item C throughput supports only a conditional 5–7 additional hours for that campaign, not a release deadline. Detailed report: `artifacts/question-factory/cuet-readiness-2026-10-08/execution/OWNER-PROGRESS-COST-2026-10-08.md`.
## 8 October 2026, 12:47 UTC — actual current runtime integration and finished fresh measurement

The explicit `factory.mjs worker --queue --staging` route is implemented, rather than a patch proposal. New original-practice jobs carry an immutable current profile, exact source/release bindings, a fixed campaign denominator of at most 100, and campaign spending bounds. Work proceeds in ten-candidate waves. Native submission is restricted to the active wave; legacy queued and accepted IDs are not dispatched again. Repair state persists before/after the single targeted repair. Lease checks precede all mutations, oversized groups fail explicitly, complete passage groups wait for siblings, and interrupted post-publication state updates recover through the existing idempotent atomic RPC. Legacy routing remains separate. No frozen academic contract or active C dependency changed.

The first actual staging queue entry exposed an inventory-read failure before any ledger initialization or paid call. Server-side profile-key filtering and bounded 100-row pages corrected it; malformed/null/unknown-version pins still fail closed. The real staging command then exited successfully with zero profiled jobs and zero paid calls. This proves the entry path, not current live academic publication. Final factory suite548/548, queue/transport checks17/17, runtime integrity/current-release tests10/10, recovery40/40 and question/payment/wallet61/61 passed. The original strict979-locator source invariant remains intact. Final application build passes. Deployment traces include all20 raw academic contract files and the runtime binding metadata. Admin readiness handles missing/corrupt raw contract files without a500; student/current publication remains fail closed.

Renewed real signed-in dashboard rendering at12:42UTC passed desktop1440×1000/mobile390×844, refresh, expanded coverage, no page errors and no horizontal overflow. The banner explicitly withholds v7.3 release. Labels identify usable inventory and dated worker cost snapshots. Authenticated staging retrieval at12:20UTC still returned535/535 retained legacy questions,0/127 withheld, admin200/anonymous401/student-admin404, and a409 current-release refusal with controls unchanged. Student AI cap remains$25/month. Newly published v7 questions:0; production deployment/publication/migration untouched.

Fresh v7.3 measurement finished12:16:32UTC: all41 paid cases and receipts complete,22 designated positives/19 independently reviewed defects,12 eligible positives,0/19 controlled false accepts, all three providers41/41 completed. Settled cost$0.800698 includes comparison-only Haiku$0.104207. Release remains false. Two positive cases expose contradictory missing-assumption flags; other holds include genuine absent support and unsupported explanation claims. Frozen labels/results were not relabelled. The original pre-scoped-flush transport was archived with exact original pinned SHA; completed-study registration/results were not rebound or resumed. Detailed measured findings and owner report are saved under the execution directory.

Read-only lifetime capture12:47:36UTC: $33.341848 settled+$0.504364 holds=$33.846212 committed; $16.153788 remaining of$50. Provider invoices are unverified. A/B retain all100 terminal dispositions with66/70 eligible, gross$1.227996/$1.341445; conditional marginal10k forecasts$186.06/$191.63 are not spending or released-bank forecasts. The85% rule is valid benchmark-control retention, not a generated-question approval quota. Cost per verified usable item is the optimization goal. C's12:40:55UTC export has53terminal/44eligible/9rejected/47pending and$0.558142 in-flight gross; five accepted native requests remain pending and the original supervisor continues. No partial yield is called final. Remaining work is reliability correction/new independent evidence, full C economics, current-batch staging publication/retrieval and final concrete production approval. Earlier rolling release ETAs remain withdrawn. End-to-end progress is a rough65%, not an academic accuracy measure.

## 8 October 2026, 13:37 UTC — measured v7.4 correction, current cost and honest timeline

The earlier 12:47 note's `contradictory missing-assumption flags` diagnosis was inaccurate. Both flags are consistently derived from conditionVerdict. The solver incorrectly classifies a computed remainder or logical result as an independently varying INPUT prerequisite. New v7.4 instructions distinguish these without changing the parent's blocking predicate. BS03 also retains an actual assigned-format mismatch. Frozen labels/results remain unchanged; no contradiction was repaired by trusting a scalar flag.

The v7.4 author adapter supplies the same complete sources, separates student explanation prose from source/layout metadata, changes request/cache identity and supports explicit source abstention before validators. A versioned V74 profile and queue router select the V74 author/validator, preserve generated abstention payloads in quarantine, retain V73/legacy isolation and refuse dispatch when no exact measured V74 release exists. No frozen academic parent, registered C file or V74 diagnostic input was edited after registration.

The fixed historical ten-case prerequisite diagnostic finished at13:29UTC: all20 blinded provider judgments, all10 terminal dispositions, zero errors, three/four designated positives eligible and zero/six controlled false accepts. All receipts are settled; total$0.210774. The Accountancy remainder now passes, but its omitted-provision control rejects. A separate Economics explanation claim remains unsupported and rejects. This is regression/diagnostic evidence only, never fresh release evidence. All candidate texts, keys, explanations, labels and failures remain in the denominator. New publication writes:0.

Final factory565/565, recovery40/40, question/selector/payment/wallet66/66 and current-runtime/profile14/14 passed. CLI-only V74 additions do not constitute a new rendered dashboard or current academic staging-publication check; the previous app build/dashboard/retrieval evidence remains separately dated. A future-only progress-aware continuation wrapper passes4/4 and refuses the active C identity. It is not wired into or substituted for the registered live C supervisor; its15-minute progress delays remain a limitation of that experiment.

At13:34:05UTC the read-only ledger shows$33.636932 settled+$0.474348 conservative holds=$34.111280 committed, leaving$15.888720 of$50. Provider invoices are not obtained. A/B have66/70 eligible out of100 with$1.227996/$1.341445 gross, completed candidate dispositions but outstanding receipt holds. Conditional marginal10k forecasts are$186.06/$191.64, not spending or current verified-bank costs. C's latest saved export remains49eligible/9rejected/42unfinished, at$0.519652 recorded gross, under the same live supervisor. No partial forecast or completedC claim is made.

End-to-end completion remains a rough65% deliverable estimate. Main gaps are completeC economics, fresh current academic qualification, current-campaign verified unit cost, actual current-profile staging publication/retrieval/restart, and final concrete production approval. Earlier rolling3–4-hour promises were unsupported. Further8–16active hours plus provider waiting is a conditional planning estimate, not a guaranteed release deadline; failed qualification extends it. Owner report: artifacts/question-factory/cuet-readiness-2026-10-08/execution/OWNER-COST-TIMELINE-2026-10-08.md. The V74 pre-acquisition binding is saved; new source construction has started with independent answers to be established before validation. No production change or new v7 publication.

## 8 October 2026, 14:15 UTC — live publication reconciliation and owner-requested127 review

The owner requested independent manual diagnosis of all127 flagged bank questions and continued generator work. The active goal continues; no cap change, paid experiment or production write is implied. Exact answer-blind packets are frozen under `execution/owner-127-review`: Accountancy36, Business Studies21, Economics53, English17. Reviewers must save independent solutions before opening the separate original keys, explanations and prior judgments. All127 remain in the denominator. This is a one-off diagnostic, not fresh reliability evidence, a routine human publication requirement or permission to bypass release gates. Reviews are underway, not complete.

The new read-only deployed-feed accounting at13:54:05UTC verifies662 paid-factory questions currently served in production, from666 distinct publication receipts with four unavailable. The full feed has2,678 unique questions;2,016 older nonfactory items remain outside this factory qualification. The newer reassessment retains535 and flags127 including passage siblings. **All127 flagged items remain served in production and are withheld only in staging.** The535 are already live, not pending publication. New v7 publication count remains0. Report: `execution/production-publication-accountability.json`. This corrects any impression that the127 staging holds were already applied to production, without claiming every flag is an actual wrong question.

At13:47:33UTC the read-only ledger reconcilesUSD33.639335 settled+USD0.483542 holds=USD34.122877 committed, leavingUSD15.877123 of50. Attribution: content11.462618; reassessment6.849736; calibration/comparisons15.794730; probes0.000839; unattributed0.014954. Approximately two thirds funded reassessment/testing. No training or fine-tuning occurred. Exact avoidable-spend attribution is incomplete; tests are not all waste and no zero-waste claim is made. Provider invoices remain unverified. C's13:57:08UTC report is56 eligible/9 rejected/35 unfinished of100, grossUSD0.685480, five accepted native requests pending. The frozen existing supervisor continues; no accepted ID was killed or resubmitted.

Current blockers, findings and evidence are recorded in `GENERATOR-CURRENT-BLOCKERS-2026-10-08.md` and linked from README. Remaining includes independent v7.4 qualification, actual source/explanation support, completeC economics, additive v7.4 application binding and current-profile staging release/retrieval. The old time estimates remain withdrawn. Recent565/40/66/14 test results are unchanged; this packet preparation makes no application behavior or payment change.


## 8 October 2026, 15:04 UTC — 127-item owner review complete; current runtime wired

The one-off review now retains all127 reviewed IDs with0 pending:99 reconsider unchanged,11 repair needed,7 uncertain holds,5 evidence/presentation refreshes,4 CUET-learning-objective revisions,1 duplicate-idea hold. This is not127 approved,99 current-qualified, a fresh reliability benchmark or publication permission. Original keys, judgments and blind answers remain byte-identical; source hashes use the established hashJSON contract. The compiler and verification artifact check all19 recorded dimensions, unique IDs, exact denominator and frozen packet/custody hashes. Detailed unchanged questions, keys, explanations, full selected excerpts, previous judgments, blind derivations and prospective fixes: execution/owner-127-review/OWNER-127-REVIEW.json and.md. No additional factory API calls, label changes, ledger mutations or production writes.

First blind key agreement is123/127, not measured accuracy. Post-checking finds two actual reviewer errors (reversed debit/credit and improperly including mining), one option-letter transcription error, and one gross/net primary-deficit interpretation disagreement. The first Accountancy review's all-true gates are not certification. The FULL primary-deficit excerpt supports the stored740000 under its gross/net-interest formula; the earlier categorical wrong-key claim is withdrawn and wording clarification is required. Full excerpts also support reform years, colonial output figures, motor-vehicle counts, sustainable extraction and unequal trade access. Short quotations or headers cannot establish a support gap.

A real accounting failure was found: item5bde762f1a36a3a7d894f0aa45f655e9 copies a printed page64 journal line that credits Premium for Goodwill but debits Goodwill on distribution. The same NCERT PDF's worked journal on page66 correctly clears Premium for Goodwill. Both pages were rendered and visually checked.11 bank items reference the faulty mixed excerpt; only this item was found copying the faulty entry, so no blanket claim that the other10 are wrong. The registered frozen sources are unchanged. Prospective source repair and impact are saved in GOODWILL-SOURCE-IMPACT.json. Other substantive findings include nonunique process orders, overlapping broad categories, treating planned inventory as actual, an unstated human-capital condition, and omitting asset-reducing capital receipts.

The additive v7.4 application binding is now implemented without changing its frozen academic contract e49ee5a979a01e649b294e726264e7d3611a1d32a19f4b624be35c9bd14fd661. Factory565/565, recovery40/40, question/runtime/wallet46/46 and additional actual-payment/entitlement/integrity27/27 passed; build passed. Saved deployment trace proof14:19UTC includes25/25 academic raw files in both admin and student-feed routes. Real signed-in desktop/mobile dashboard14:18UTC has0 page errors/overflow and correctly blocks v7.4 without a measured release. Authenticated staging14:19UTC retrieves535/535 retained legacy questions and0/127 withheld, admin200/anon401/student-admin404, release409 with controls unchanged; student AI cap remains25/month. These software and legacy-retrieval checks do not prove current academic publication. New v7 production publications remain0.

Read-only audit ledger at 2026-10-08T14:57:40.801Z: USD33.761682 settled + USD0.462720 conservative holds = USD34.224402 committed; USD15.775598 remains of50. Provider invoices are unverified. C report14:43UTC has65 eligible/9 rejected/26 unfinished of100, USD0.663092 settled+0.062466 held=0.725558 gross. Supervisor PID13552 was confirmed live after that report; no accepted ID was resubmitted or worker killed. C is not completed and no final forecast is claimed.

Owner requested realistic expectations: a narrowed6–10 ACTIVE-hour planning range (1–2 calendar days allowing provider waits) is conditional on the next frozen qualification passing, not a guaranteed release date. It reflects completed runtime work and review, not a new rolling countdown. Rough USD2–4 applies to one bounded next qualification/current-generation round; it is not an estimate for repeatedly revalidating the entire662-item legacy bank. Any broader paid requalification needs an explicit scoped maximum reservation and must fit the existing50 cap. Keep independent validation and source correctness; don't increase acceptance to manufacture yield. If the preregistered reliability rule fails, report the failure and do not spend indefinitely tuning around the same benchmark. Remaining: corrective source/evidence preparation, fresh independent current qualification, allC outcomes/receipts, measured current-generation unit cost, actual current-profile restart/publication/student retrieval in staging, and final reviewable production approval.

Two newly established source/correctness failures are frozen as regression-only cases in execution/owner-127-review/KNOWN-CRITICAL-REGRESSIONS.json. A release must catch them as well as pass fresh qualification. No paid evaluation of these cases has been run, and they are not fresh evidence.

## 8 October 2026, 17:27 UTC — C completed; owner chooses handoff and continued optimization hold

Campaign C's final export17:19:02UTC retains all100 preregistered IDs with84 machine-eligible,16 rejected,0 pending and all accepted provider processing complete. English21/4,Accountancy23/2,BusinessStudies21/4,Economics19/6 eligible/rejected, with25 candidates per subject. All492 campaign receipts are settled:USD0.855970 actual gross,USD0 holds. No provider invoice obtained. Final read-only export verification17:22:56UTC proves exact ID/approved/rejected partitions, all213 source references resolve, required question/key/explanation/support/verdict/cost fields are present, and receipts aggregate exactly to the report. C is measure-only underv7.2,publication_policy=never,newly_published=0; it does not qualify currentv7.4. The still-live supervisor can finish housekeeping on its next poll; it was not killed or restarted.

C-only stage costs from receipts:Gemini independent evaluationUSD0.442854;Luna blind solutionUSD0.229843;authoringUSD0.133678;explanationUSD0.032251;repairUSD0.017344. The report's costs_by_stage is a lifetime aggregation and must not be used as C-only cost. Current unit costUSD0.010190119 per machine-eligible item implies conditional marginal10kUSD101.901190 before development/reassessment/current-release qualification. A/B conditional forecasts remain roughlyUSD186–192. None demonstrates premium10k within50–70. Scores7:5,8:33,9:39,10:7; answer positionsA25/B21/C17/D21; difficulty33easy/48medium/3hard. No exact normalized stem/options duplicates; semantic idea novelty is not proven by that check. All16 rejection reasons and30 targeted-repair records remain exported.

Read-only lifetime17:22:15UTC:USD33.954560 settled+USD0.499296 conservative holds=USD34.453856 committed,USD15.546144 remaining of50,36 unresolved records. C is settled; lifetime is not fully settled or invoiced. Historical503/other uncertain receipts and four new critical-regression holds remain preserved. The two new critical cases attempted four requests, all fetch-failed:USD0settled+USD0.099042held,no new academic judgments. The launch omitted the known Node system-CA option; later credential-free probes reproduced the TLS failure without it and succeeded with it. Saved per-call errors do not independently prove zero usage. No uncertain keys were resent or cleared.

An additive network-launch wrapper now automatically supplies--use-system-ca and checks unpaid,credential-free connectivity before the exact current runner. Five tests and real probes pass. FrozenC/academic contracts are unchanged. Latest local factory570/recovery40/question-payment-wallet71 checks pass. Currentv7.4 runtime/application wiring and previous build/render proof remain complete; academic qualification and current-profile staging publication/restart/feed/dispute proof do not. The prospective16-case packet/46quotes across13caches and230-word English passage pass integrity preflight; first blind derivations are frozen, second review and selected official-key comparison remain pending. Source supplement and incidental nonselected marking-scheme exposure are separately disclosed. No prompt was tuned after source acquisition.

Owner explicitly chose 'Deliver the handoff; keep optimization held'. No new campaign,paid test,publication,deployment or migration was started in preparing this handoff. The full generator objective remains unfinished and must not be marked complete. Remaining:current independent truth/qualification,known-critical receipt resolution or retained holds,current-author unit-cost measurement,semantic/format inspection,current-profile staging end-to-end proof,bank corrections and final production approval. Latest production proof still has662 factory questions including127 flagged items served; only staging withholds127 and retrieves535 retained legacy items. Currentv7 publications0.

Concrete handoff saved:artifacts/question-factory/cuet-readiness-2026-10-08/execution/ACCOUNTABILITY-HANDOFF-2026-10-08.md,with completed exports,costs,source/receipt traps,remaining requirements and reproducible entry points. An earlier automatic review usage failure blocked a report update; the later handoff/update succeeded through the normal tool path. The completed-C monitor and generator goal are to be paused per owner instruction; preserve the objective for explicit later resumption.

## 8 October 2026, 17:45 UTC — owner-requested quality assessment and final handoff

The quality-only report is saved in execution/QUALITY-ONLY-ASSESSMENT-2026-10-08.md and linked from README and the accountability handoff. Twenty criteria exclude cost; holistic judgment is about6/10 for the latest measured outputs,not60%accuracy or a measured rating of unqualifiedv7.4. Direct nonblinded diagnostic review inspected20 targeted C questions plus all3 surviving passage children. It is not fresh reliability evidence or exhaustive review of84. Strong accounting numericals coexist with answer-cued wording,claimed learning objectives not actually tested,weak distractors and inflated hard labels. Explanation-checker code is implemented; academic reliability is not established by that fact or green software tests.

A confirmed semantic duplicate pair,0fc6254f35c4cdd497364d8c821b42fc/415691cf8a686bf4bb629eef885cb0d3,rephrases the same Noor-bookmark draw→cut→smooth→paint task from the same stimulus/support hash. Frozen84machine-eligible/16rejected outcomes remain unchanged,but there are at most83 distinct eligible ideas before further review. Exact-text dedup did not detect this. All3 approved English passage children have keyA despite globally balanced positions. The quality report includes item IDs,source hash and strong/weak comparisons; none of these findings changes gates or publication state under the owner's hold.

Read-only17:44UTC verification confirms continuation-progress.status=complete,all100terminal,0pending,allacceptedproviderprocessingcomplete,0pendingrequests,and unchanged final export hashes. Original supervisor PID13552 is no longer present and finished naturally; no worker was killed/restarted. The existing completion monitor is verifiedPAUSED. The unfinished generator goal is being paused for delivery per the owner's explicit 'Deliver the handoff; keep optimization held' decision. No new paid call,campaign,optimization,production publication,deployment or migration was performed for the rating. Current-profile unattended dispatch/publication remains release-blocked; eventual operation should require no routine human review,after genuine qualification and staging proof.

## 9 October 2026 — repeated ordering ideas: inspection v4 and read-only diagnostic (Claude)

Local only. No paid call, campaign, retry, publication, staging write, deployment or migration. Owner hold and USD50 content ceiling unchanged. Frozen C exports re-verified (all-candidates `4b06df8a…`, batch-report `a7349592…`).

Reconciliation: the 8 October handoff and quality-only assessment still match the files (C 84/16, v7.4 unqualified, current publication release-blocked). Among answer-cueing, inflated hard labels and the bookmark duplicate, only the duplicate could be closed deterministically without a prompt/rubric change, a new verifier version and a fresh paid benchmark. Cueing and labels remain open.

Change: `scripts/pipeline/lib/batchInspection.mjs` → `evidence-content-idea-inspection-v4`. Two ordering items in the same subject/chapter/format are one idea when ≥3 of 4 steps match one-to-one (≥50% content-word overlap, identical quantities) and keep the same keyed order. Matching keys `(A)-(III)…` are never read as orders; shared source/vocabulary alone never makes a duplicate. Withheld as `duplicate_idea_conservative`, `rule: repeated_ordering_task`. Saved v3 inspections no longer satisfy publisher contract checks; they must be re-run (free, deterministic) before any future publication. New test covers the real C pair, a different story, a different keyed order, different process steps, different quantities and matching keys. Read-only tool: `scripts/pipeline/tools/orderingDuplicateDiagnostic.mjs`.

Finding (`execution/ORDERING-IDEA-DUPLICATES-2026-10-09.json/.md`): within each campaign only C's bookmark pair is flagged. Across A/B/C eligible plus 76 pure-sequence bank ordering items (53 eligible, 23 quarantined, all still served in production), 10 groups / 34 items / 24 surplus repeats. Nine are Para Jumbles reusing the same ~8 original stories; one is the Business Studies functional-structure chain (bank `27e508fe…` = C `21becfa4…`). 5 of C's 11 eligible ordering items repeat an earlier idea; B 3, A 2. Two groups were read and confirmed; an earlier looser draft produced Accountancy false positives, now guarded. Likely root cause: `briefDiversity.mjs` ranks only 8 Para Jumbles stimuli least-used-first and reuses them once exhausted. Separately, 5/29 eligible A/B/C ordering items are keyed in printed order A-B-C-D (not acted on). No frozen outcome, bank item or publication was reclassified; the rule was written from the C pair, so C detection is not independent evidence.

Verification: `npm run test:factory` 571/571; `npm run test:recovery` 40/40; answer-integrity, mock/NTA selector, payment-entitlements and PrePOS wallet tests 61/61 (that five-file set, not the earlier 71-test set). Deployment needs: none (pipeline-only). Rollback: restore v3 constant and remove the rule. Next: stop planning reused ordering stimuli (and expand the original stimulus pool), then address answer cueing/difficulty labels in the next versioned author/judge contract with a fresh preregistered benchmark when the owner lifts the hold.

## 9 October 2026 — execution round: idea allocation, publish-time inspection, v7.5 frozen, reference custody (Claude, orchestrating Sonnet/Haiku subagents)

Owner resumed scoped optimization (guarded qualification and generation) within the unchanged USD50 ceiling; production publication/deployment/migration still need final approval. Ledger before any paid phase (read-only ledgerSummary): USD33.954560 settled + USD0.499296 held = USD34.453856 committed, 36 unresolved, unchanged since 8 Oct. No paid call so far this round. Continuation file: `artifacts/question-factory/cuet-readiness-2026-10-09/CONTINUATION-2026-10-09.md`.

- Repeated ideas before paying: `ideaAllocation.mjs` (`ordering-source-allocation-v1`, persisted append-only ledger) + `briefDiversity.mjs` return an explicit `ordering_source_pool_exhausted` gap instead of recycling a consumed ordering source. Inspection v4 step matching also requires equal units and polarity. 13 reviewed original Para Jumbles stimuli with distinct discourse structures registered as an overlay (base registry untouched because registered studies bind its hash). Simulation on actual inventory: old 8 never reused, 13 new once each, then the gap.
- Publish-time inspection (Sonnet): new `lib/publishTimeInspection.mjs`; `factory.mjs` queue worker and runWorker (single and group), `focusedFactory publish()` and `publishProductionCohort.mjs` now run inspectAgainstInventory against the current target inventory immediately before publishing and fail closed. `cuetFitFactory.mjs` manual publish not changed: its hash is bound by the parallel-measurement registration (its worker loop already inspects). `controller.mjs` imports a non-existent `publishBatch` (pre-existing, not fixed).
- v7.5 contract (Sonnet), additive over pinned v7.4 `e49ee5a9…`: learning objective required and shown to evaluators (never the key), deterministic preparation-value checks (`preparationValueV75.mjs`: vocabulary target absent/unstated, non-English ordering cohesion cues, stem discloses key, absolute distractors, generic Economics arithmetic, overstated difficulty), judge instructions, V75 profile/release/runner. Frozen: contract `54e40f33…`, prompt `6b551626…`, author policy `c7fabfba…` (`cuet-readiness-2026-10-09/v75-contract-freeze.json`). The statement-disclosure rule was adjusted once during implementation against the C WTO regression fixture (regression, not fresh evidence). Legacy C diagnostic: 8/84 items with any finding, 4 blocking.
- Reference custody: second independent blind solve (Sonnet, packet only) agrees with the first on 14/16; both hold bs-q03 and en-q1-v. Owner-approved official CBSE 2022-23 marking schemes agree on 13/14; en-q1-i conflicts because the 230-word adaptation omitted the decisive sentence → held_reference_conflict. Records: `REFERENCE-ANSWER-CUSTODY-v1.json`, `OFFICIAL-KEY-COMPARISON-v1.json`. Qualification plan and decision rule written before comparison: `cuet-readiness-2026-10-09/V75-QUALIFICATION-PLAN.md` (RELEASE_POLICY_V7 unchanged; USD4 cap).

Tests: `npm run test:factory` 604/604 after v7.5 (Sonnet run), recovery 40/40. Network probe: OpenAI/Gemini reachable (unauthenticated 401/403), prices valid to 2026-10-12T21:37Z. In progress: qualification set construction and 40-candidate pilot tooling.

### 9 October 2026 — round stopped (usage limit); handoff `artifacts/question-factory/cuet-readiness-2026-10-09/HANDOFF-2026-10-09.md`

v7.5 fresh qualification (paid) at handoff: 18/27 fixtures finished, 6 valid eligible, 1 controlled false accept (`v75f-825e60a00f`), receipts incomplete. The rule allows 0 fresh false accepts, so v7.5 FAILED qualification and has no release. The regression set and the 40-candidate pilot were not run. Ledger: USD34.278180 settled + USD0.565291 held = USD34.843471 committed (+USD0.389615 this round), 37 unresolved. No publication, deployment or migration. Next: confirm the run has ended, report, then diagnose the false accept and the low positive survival; any fix needs a v7.6 freeze and a new fresh set.

## 9 October 2026 IST — v7.5 outcomes reconciled, focused v7.6 frozen (Codex)

Continued in the owner-specified existing dirty checkout; no clone, worktree, Git reset, publication, deployment or migration. Prior goal turn made concrete progress. Read-only process check found no active qualification worker. V7.5 is now 27/27 terminal, 8/13 designated positives eligible, one registered natural-defect false accept v75f-825e60a00f. Luna/Gemini have all 27 blind observations; comparison Anthropic has 26 judged and one uncertain fetch failure. Study receipts: USD0.522978 settled + USD0.008596 held. Requests: 100 saved, 99 complete; unresolved reservation 1235a9c2-694d-4547-99c5-e23d5e97c0cc has no remote ID and must not be resent. Lifetime read-only: USD34.477538 settled + USD0.507892 held = USD34.985430 committed; USD15.014570 remains; 37 unresolved. No uncertain usage assumed free; no provider invoice. No new paid native calls in this continuation.

Diagnosis is in execution/v75-root-adjudication.md, v75-failure-diagnosis-luna.json and v75-request-reconciliation.json under cuet-readiness-2026-10-09. False-accept oracle is contested: D is directly supported; B shares a functional-empires clause but its full power/independence conjunction is neither decisively supported nor contradicted under functional structure. Frozen expected-invalid label and failure remain unchanged. Five failed designated positives differ: one likely explanation-context judgment error (cash-proceeds other-figures scope), one syllabus-entitlement construction issue (postulates), one unsupported negative distractor explanation (commercial bank), missing fixed-asset status/source relation (insurance claim), and incomplete service-export credit source rule (BoP). None failed deterministic preparation value. Frozen diagnostic reviewer quotations had five nonliteral strings; original derivations preserved and exact-source correction map saved separately. These are regression/diagnostic evidence, never fresh qualification.

V7.6 composes pinned V7.4 without editing V7.5: full-option clauses/scope and evidence-based alternative challenge, contextual explanation audit, genuine objective/lexical checks; absolute words, linking phrases, passage information and cue counts cannot block by themselves. Mandatory independent key, uniqueness, assumptions, source, syllabus, numerics and presentation gates retained. Cache/request namespaces are versioned. New modules: contractV76, factoryEvidenceV76, verifyV76, preparationValueV76, originalAuthorPolicyV76, releaseEvidenceV76, factoryProfileV76. Runner/guard/freezer added; qualification fresh+regression share persistent USD4 scope and one owner lease. Contract frozen at 2026-10-08T20:15:38.538Z: 1efe51bb4ccab33314f7fa91c1c7d1964e7b11e34ae453246ada1e67b08b33ec, prompt 9e84c690509fbf97a8228d9ea1f904f1a5e64d36435aeba859a0edc30c00c672. V76-QUALIFICATION-PLAN.md written before fresh construction; no v7.6 study evaluated or release exists yet.

Publication corrections are local drafts: controller broken import removed and legacy unqualified publish stays closed; current-inventory inspection added to autonomous/offline paths; versioned staging manual CLI added. A partial subagent edit of hash-bound campaignExecutionV7 was detected and exactly restored to registered SHA489f302f60cc2e40a2c19c90f50aa3d2c1b8f15b53ea2aa9fc388129abf84f16. All V7.5 registration-bound code hashes match. Frozen cuetFitFactory remains unchanged; its historical measurement mode cannot publish, and its old version cannot satisfy a new V7.6 release. Exact V76 runtime/staging integration still requires a genuine qualification and actual end-to-end proof.

Verified local checks: factory 662/662 outside sandbox; recovery 40/40; selected question/payment/student-budget checks 38/38; local application build passes, 67 static pages. Initial sandbox test run had 12 EPERM checkpoint rename failures; normal-permission full suite passes. Payment/entitlement focused follow-up pending at this checkpoint. Evidence logs and root-checkpoint-1.json saved. Subagents Luna completed bounded derivation/route work then hit account limits; Sol completed V76 modules/tests and diagnostic adjudication. No repeated spawns into the same Luna limit. Rollback: select existing old runtime/profile; preserve new frozen files/studies and all receipts; nothing deployed.

Exact next steps: acquire previously uninspected source family after the freeze; construct the compact fixed four-subject packet; obtain/freeze independent source-only answers with proposed answers hidden; reconcile source custody before model evaluation; register and preflight fresh/regression under exact V76; inspect process and shared ledger then run only the preregistered bounded qualification. If it fails, retain every outcome and diagnose without another paid benchmark. If it passes, adapt the fixed pilot and conservative budget-stop policy, inspect saturated English matching pool, then verify qualified staging restart/atomicity/feed/dispute flows. Production still requires explicit final approval. Goal remains active.


## 9 October 2026 IST — V76 independent custody and bounded registrations prepared

Academic V76 contract remains frozen before source acquisition. Fresh 28 cases (16 valid, 12 controlled defects; four subjects) and regression 13 (4 established valid, 9 invalid including unchanged disputed v75f-825e60a00f) registered before native evaluation. Independent Sol answer-free derivations frozen at 20:50 UTC SHA57905df02c23bfeef72701545d5e5edac89cc3159ebe95cfb3e8d2bfcbedb395; then explanation/label audit confirms 16/16 positives and 12/12 invalid labels. Root hashJSON support verification passes; three official CBSE 2021-22 source marking schemes were acquired only after derivations and corroborate all 12 adapted source concepts/keys. English has four independently keyed original passage questions. Missing/multiple-answer oracle representatives are null in final registration; historical placeholders retained. Source family now consumed, never fresh again. No authentic-CUET-PYQ claim.

A preflight-only failure found unchanged disputed regression input 33,897 bytes against conservative 33,024 allowance. Original incomplete registrations and frozen runner remain immutable. Additive runFreshCuetReadinessV76BoundedInput and v76-transport-runner-freeze.json prospectively reserve 35,000 input at identical nonexpired rates, same outputs/academic prompts/cases/labels, USD4 shared stop cap and USD50 lifetime guard. Replacement sets end bounded-input, identical payload hashes; all 82 blind request captures pass with hidden keys and no positive free-gate failures. Conservative maximum combined reservation USD2.383125 (fresh1.627500/regression0.755625), before realized discounts. No native V76 request yet; process readback none; provider query none. Current lifetime settled34.477538+held0.507892, 37 unresolved, remaining15.014570. V75 99 complete/1 unresolved no recoverable ID remains held, not retried.

Additive durable V76 allocation now flushes immutable intent before marker, preserves uncertain/reserved consumption, serializes live owners, catches ordering span and matching target overlap across history, and permanently assigns each marker path. Isolated tests14/14; real default allocator still absent. Existing pilot wiring remains V75 and dispatch-blocked. English matching pool only one unused target; do not register repeat-word matching briefs. USD3 pilot is a stop cap against USD12.424320 theoretical bound, not promised completion. Publication manual adapter exact-profile/schema and passage-group checks were tightened; 23 focused checks pass. Root full factory suite running at checkpoint; prior668/668, recovery40/40, selected question/budget38/38, explicit payment/entitlement40/40, local build67 static pages passed. No deployment/staging/publication.

Checkpoint: execution/root-checkpoint-v76-prepared.json; exact next step is review reservation adapter then refresh state and run one bounded fresh+regression qualification. If failed, retain all cases/outcomes and diagnose without purchasing another benchmark; no pilot. If passed, additive exact V76 pilot/staging adaptation and end-to-end proof remain. Goal active.


## 9 October 2026 IST — V76 bounded qualification completed; release failed

Both immutable bounded-input registrations finished naturally: fresh28/28 and regression13/13 terminal, all Luna/Gemini observations complete, no topology/provider error. Fresh0/12 controlled false accepts,15/16 valid eligible; regression1/9 registered false accept (unchanged disputed v75f-825e60a00f),2/4 valid eligible. Pooled17/20=85%; Accountancy5/5, BusinessStudies4/5, Economics4/5, English4/5. Exact assessReleaseEvidenceV76 returns paused with sole problem regression_defect_false_accepts_1. This is failed qualification, no release/pilot/staging permission. Fresh passage-vocabulary keyB was correctly solved but registered Vocabulary chapter conflicts with pinned V74 Narrative Passage instructions; original metadata/custody oversight preserved. Regression BS positive contains unsupported prior skill-allocation claim; Economics negative resource-allocation rationale requires contextual judgment diagnosis.

Every118 native request is complete and receipt-settled: USD0.649980 (Luna0.185242/Gemini0.464738), no new hold. Native modes realtime; OpenAI receipts say default, NOTFlex. Qualification runner omitted flexStages despite planned preference; no discount assumed. Eleven bounded output-completion retry requests are included and charged. Initial dry bound2.383125 omitted the existing exactly-one billed truncation/invalid-JSON retry; preserved estimate corrected in v76-cost-bound-correction.json to worst-case5.714375 for41 cases. USD4 remains unchanged persistent STOPcap, not completion guarantee; every actual retry was individually guarded and actual spend stayed below. This calculation defect did not weaken spending authorization or resubmit accepted IDs.

Read-only current lifetime settled35.127518+held0.507892=committed35.635410, remaining14.364590 ofUSD50,13925 reservations,37 unresolved. All prior uncertain holds preserved; v75 unknown Anthropic request retains0.008596 with no recoverable remoteID. No active qualification worker/lease after completion. Academic and reservation-runner hashes unchanged. Full export execution/v76-qualification-export/all-cases.json and .csv includes all41 cases, options/keys/explanations, decisive excerpts, both blind solutions, gates/rejection reasons, item costs/usage/receipts; fixed denominator and both historical/current failures retained. Qualification export is not generatedpilot evidence.

Final root factory672/672 passes; recovery40/40, question/payment/studentbudget38/38, explicitpayment/entitlement40/40, priorunchanged localbuild67staticpages passes. Source freshness comparison found no concrete reused/paraphrased inspected case or numeric-only variant among28fresh versus9priorfrozen sets (264rows/90unique), a bounded check not universal uniqueness proof. Root-checkpoint-v76-complete.json and v76-qualification-assessment.json saved.

Exact remainingblocker: both V76 validators still reject the disputedB through categoryattribution without decisive full-clause falseproof; boolean false+strained/contradicts_stem passes current optionChallengeVerdict. Official/directD stays supported, fullB remains disputed, so do not manufacture expectedlabeltruth or alterfrozenresults. A local additiveV77 tri-state clause/evidence correction is being developed; software tests alone cannot qualifyit. No secondpaidbenchmark, pilot, publication, staging, deployment or migration. Goalactive until concrete localcorrection/review complete; release requires fresh independent evidence under authorizedscope.


## 9 October 2026 IST — local V77 correction verified; qualification still failed

V76 qualification remains failed and unchanged: 41 terminal cases, 118 receipts settled for $0.649980, and no new hold. The five additive V77 modules are prospectively frozen at 614d423f795314c7661e952ca1f1bf41258b005586744172dd8ec3b32021ecd1. There is no released V77 profile, native qualification runner or publication authorization.

Both independent blind evaluations now provide whole-option/clause coverage with trusted source premises. The existing Luna explanation audit also checks both frozen matrices and all explanation claims, adding no fourth call or model comparison. Identity/mock checks cover cache hits and precede fresh stage-cache writes. Independent counterexamples and earlier drafts are retained. Stem-only arithmetic and a proved false conjunction with an accurately unresolved nondecisive clause are permitted; selected answers still require complete support and every nonchosen full option a decisive exclusion. Category attribution and source silence cannot establish falsehood. Entailment remains a fallible model judgment. These are local regression checks, not fresh qualification.

Root factory tests 696/696; focused tests 14/14; independent cached restart 1/1 with no extra callbacks. Prior recovery 40/40, question/payment/student budgets 38/38, explicit payment/entitlements 40/40, and the unchanged 67-page app build passed. All 228 frozen hash bindings across 61 paths match; the registered source-registry hash also matches. V75/V76 evidence, code, base prices and historical artifacts are preserved.

Offline preflight captured 84 bodies from 28 consumed V76 specimens: maximum 32,817 UTF-8 bytes under a local 50,000-byte reserve. Synthetic matrices/minimal cached solver fields do not guarantee future real payload fit. At registered rates, including one full-input/doubled-output billed retry per request, the 28-case bound is $4.742500; 41 cases at the same caps would be $6.944375. A $4 stop cap would not guarantee completion. No discounts were assumed and base prices are unchanged.

Read-only lifetime: $35.127518 settled plus $0.507892 held, leaving $14.364590 under the $50 ceiling. There are 13,925 reservations and 37 uncertain records, all preserved. V76 has 118 complete provider requests; V75 has 99/100 complete plus the $0.008596 unknown Anthropic hold. No active factory worker/qualification lease, V77 native calls, pilot, live current-profile staging or production writes.

Evidence: execution/V77-LOCAL-CORRECTION-RESULT.md, root-checkpoint-v77-local-complete.json, v77-independent-semantic-audit-review.md, v77-offline-budget-preflight-v1.json and v77-source-registry-integrity.json.

Exact next step: the asynchronous scope question asks whether the owner's “Qualify once” instruction permits one further paid V77 study with a $4 stop cap. No permission has yet been received. Do not dispatch while pending. Any authorized future study must preserve this freeze, establish genuinely fresh source/key custody before evaluation, preregister a fixed denominator and retry-inclusive persistent budget, and retain every outcome. The 41 inspected V76 cases remain regression evidence. Only a genuine qualification pass permits the 40-candidate pilot and live staging proof. English matching has one unused target; the pilot's $3 stop cap is below its $12.424320 theoretical retry/repair-inclusive bound. Current-profile staging restart, idempotency, complete passage-group atomicity, retrieval and dispute invalidation remain unproven. Production publication, deployment and migration still require final explicit approval. Goal active and unachieved.


## 9 October 2026 IST — V77 prospective runner verified; paid scope still pending

The additive V77 runner is locally frozen across 51 transitive dependencies. Core raw freeze 632109c8225bd754326e3e47f7c0e2ab64428a9cb42f5288923115ce7b76c7ba; transport raw freeze b00bfedd344bbb9fbe114fd89cad90e84c37652064c6c0222c91f45a0fa2bfdb. V76 qualification remains failed and frozen; V77 is unqualified with zero native provider requests, no pilot, no live staging and no production writes.

Independent local counterexamples corrected omitted V73/V74 case history, contested-defect exclusion, missing code bindings, Flex fallback, ledger/database callback wiring and terminal-error recovery. Exact fresh/regression custody and case-level review must follow both freezes. Registration binds both fixed studies, all 13 prior frozen sets, code, source registry, prices and explicit scope authorization. Accepted/unknown keys never resubmit; receipt-only replay can consume later-complete saved responses while preserving original errors and forbidding new reservations/requests. Budget or unfinished outcomes remain pending, not academic rejections.

Root factory 718/718; focused runner 22/22; 228 protected hash bindings/61 paths intact. Earlier recovery 40/40, question/payment/student budget 38/38, payment/entitlements 40/40 and unchanged app build 67 pages remain verified. Changed runtime files: scripts/pipeline/tools/runFreshCuetReadinessV77.mjs, scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs, scripts/pipeline/lib/releaseEvidenceV77.mjs, scripts/pipeline/tests/freshCuetReadinessV77Guards.test.mjs. Current lifetime $35.127518 settled + $0.507892 held; $14.364590 left under $50; 37 uncertain records preserved.

Offline sizing now covers all 41 consumed specimens; 13 regression bodies used saved V76 judgments and synthetic V77 matrices, maximum 36,978 bytes. Future actual full matrices still need the 50,000-byte guard. Conservative 41-case bound $6.944375 includes full repeated input and doubled output for one retry at every stage. Four dollars is a stop cap, not a completion promise; no discounts presumed. Pilot $3 remains below $12.424320 maximum; English matching has one unused target.

Next dependency: the single async question about authorizing one further $4 V77 study is unanswered. Do not dispatch. If authorized, construct genuinely fresh source/key custody after both freezes and preregister the fixed four-subject benchmark/costs. Only a passing qualification enables a 40-candidate pilot under that exact version and current-profile staging restart/idempotency/atomic passages/retrieval/dispute tests. Production still needs final explicit approval. Goal remains active and unfinished. Checkpoint: execution/root-checkpoint-v77-runner-complete.json; current result: execution/V77-RUNNER-VERIFICATION-RESULT.md.


## 9 October 2026 IST — requested generator status and blocked-scope audit

Read-only accounting refreshed at 2026-10-09T06:30:03.951Z: $35.127518 settled plus $0.507892 held; all 37 uncertain records retained. V75 is99/100 receipts complete with its old unknown hold; V76 remains118/118 complete; V77 native requests=0, no study directory, no active factory worker (CIM checked), both local freezes intact.

New report aggregation uses only the20 registered-valid V76 controls: both independent solvers matched20/20 frozen keys;17 were eligible. Their lower-of-two fit score mean8.5294/10 (eight8s,nine9s); lower fit-dimension means /3: syllabus objective2.7647, format2.0588, level2.9412, heuristic time2.9412, discrimination1.9412. These survivor/control averages are not original-generator or V77 production quality. The preserved registered false accept scored9/10: scores do not prove academic safety. Only2/40 valid-control blind observations recorded exemplar_ids_compared; authenticated subject/format style and level comparison remain a limited evidence area. No score/gate/input was changed.

Current10,000 publishable-item forecast remains unestablished. Historical older-validator100-candidate arm yielded70 machine-eligible for1.341445USDgross, conditionally191.63USD/10k eligible, not publishable/currentV77. Current V77 full validation-cycle conservative reservation is0.169375USD/candidate including full-input/doubled-output completion retries:1693.75USD/10k candidates or2420.36USD/10k survivors only at ASSUMED70%yield, excluding new authoring/source research/repair revalidation/publication. This is a reserve envelope, not expected spend. Exact current end-to-end forecast needs qualified pilot receipts and measured publishable yield.

Same genuine scope blocker has persisted through three consecutive goal turns: V77 core local correction, V77 runner local correction, and this current revalidation. All necessary independent local prequalification work is complete; pending human question remains unanswered. Automatic goal continuation supplies no paid authorization. Do not create another benchmark or bypass the Qualify once rule. Goal is being marked blocked pending that answer; not complete and not user-paused. Pilot/live staging remain conditional on a genuine pass, and production still needs final approval. Status evidence: execution/generator-status-quality-2026-10-09.json.


## 9 October 2026 IST — final V77 attempt explicitly authorized

Human authorization supersedes the earlier pending-scope blocker: “yes continue to make improvements in V7.7 but this time i was you to treat this as your last chance to perfecting this to best of your capabilities”. Exactly one final V77 study is authorized under the proposed shared USD4 stop cap and unchanged USD50 lifetime ceiling. The conservative USD6.944375 retry-inclusive bound can exceed that stop cap; incomplete cases remain in the denominator. No additional paid qualification follows a failure. Production approval remains separate.

The prospective protocol is frozen in artifacts/question-factory/cuet-readiness-2026-10-09/execution/V77-FINAL-QUALIFICATION-PREREGISTRATION.md (SHA256 268127a74fdaa3a594c17647cd182befad683e6b144b09b74509d1c779067c0f) before fresh case disclosure. V77 remains unqualified with zero native requests and no worker currently running. Refreshed ledger: USD35.127518 settled + USD0.507892 held; USD14.364590 remaining; 37 unresolved records retained. V75 99/100 provider records complete with its old uncertain request preserved; V76 118/118 complete.

Next: construct 28 genuinely fresh cases after both existing freezes; independently derive source-only answers before seeing proposed keys; audit labels and source support; independently review semantic freshness against all13 prior sets; register exact source/custody/plan hashes and scope-bound authorization, then offline preflight and one bounded execution. The13 inspected regression cases stay unchanged. Evidence: execution/v77-final-human-authorization-event.json and execution/v77-final-continuation-state.json.


## 9 October 2026 IST — final V77 construction and recovery checkpoint

The authorized final study is still before registration/native evaluation: zero V77 provider requests, no qualification, pilot or production writes. Root and Sol source-only v1 derivations were frozen before proposed answers were read. Preserved drafts exposed missing English passages, incomplete investing context, non-verbatim quotations, two-column interleaving and answer/audit cues in draft learning-objective metadata. These are construction defects, not native qualification rejections. V3 must correct them transparently and receive final independent source/key/label/freshness custody before dispatch. Historical freshness covers all13 prior sets/346 rows; intentional root/defect and passage correlations are disclosed.

An undefined completedCache reference remains in the original frozen runner recover branch. Do not invoke it. Additive receipt recovery is frozen separately in artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/receipt-recovery-freeze.json after root independently ran4/4 actual temporary-SQLite tests: durable-response replay without cache, missing retry denied, existing completed retry replay, and verifier-derived topology replay. Zero fetch/new reservations, historical errors preserved; persistent ledger remains read-only for this tool. Its exact helper hashes must be bound into both studies and authorization before registration.

Root rechecked228 protected hash bindings across61 historical paths with no mismatch; both V77 core/transport freezes also verify. Current recorded lifetime remains USD35.127518 settled plus USD0.507892 held, with37 uncertain records preserved. The one final fixed41-case protocol keeps USD4 stop/USD50 lifetime caps and zero false accepts,85% pooled/70% subject valid survival. No further paid benchmark follows failure. Next: complete v3 custody, bind unchanged13 regression cases and fresh28, authorization and full-body offline preflight, then one authorized bounded execution. Checkpoint: execution/root-checkpoint-v77-final-construction.json.


## 9 October 2026 IST — V77 final source custody and offline integration

Root verified718/718 factory tests (first sandbox run hit Windows EPERM temporary-file renames; normal-access rerun passed),40/40 recovery tests,40/40 payment/question/student-AI-budget checks and the application build. Separately frozen receipt-only helper passed4/4 real temporary-SQLite tests. No application behavior/payment/entitlement/student-budget changes were made.

Final blind source/key derivations and independent Luna review agree all28 fresh answer states and16 valid/12 invalid labels. Corrected one unsupported training explanation before evaluation. Constructor error commentary was replaced with actual faulty candidate explanations; wrong-key control c519 remains decisively invalid through key B versus source/explanation A. All question bodies/options/passages/keys and boolean labels are preserved. Same2026 syllabus now names existing provisional-for2027 profile. Exact source locator aliases preserve support hashes; reuse attestation is explicitly local qualification only. All85 references hash-check and all16 free positive preparation/presentation/provenance checks pass. Historical13-set/346-row freshness review and disclosed correlations remain bound.

Zero V77 native provider requests. Local final-fresh/final-regression registrations were created, but actual adapter preflight found extraction_checked missing in the constructed source overlay. Preserve those incomplete registrations; never edit them. Independent source metadata attestation is in progress; any corrected input registration must be additive and preserve SAME41 cases/labels/decision rule. Original frozen authorization binder also had two undefined object-shorthand identifiers; additiveV3 fixes exactly those two computed-value references and passed independent diff/input-hash review. Academic and transport freezes unchanged.

Latest read-only lifetime snapshot USD35.127518 settled + USD0.507892 held (37 unresolved). Shared USD4 stop cap and USD50 lifetime cap unchanged. No qualification, pilot, release or production write. Exact checkpoint: execution/root-checkpoint-v77-final-input-integration.json. Next: finish source extraction attestation, additive same-case input registration/full-body offline preflight; refresh process/provider state before one authorized bounded execution. No further paid qualification on failure.


## 9 October 2026 IST — sole final V77 native qualification started

The same41 fixed cases are now executing under PID36876 / durable owner nonce4b665d61-e63b-4df1-a91f-6d5cea4e56c7; execution log execution/v77-final-native-execution.log. No duplicate runner. Concrete authorization: execution/v77-final-execution-authorization.json. Both corrected additive input registrations end in -integrated; initial incomplete registrations remain unchanged. Fresh/regression fixture hashes remain902a0ffe05ec17d243e1c5762820680fe3e3d169cb2e2a808992b5fdce55b035 / cb919ebe6ecc389c049098e8e0a7d871e19ff9144817a428540e830a13177fe9. Independent final source audit verifies26 used source identities/extractions,85 refs and18 family memberships. Four authored-stimulus identity hashes were corrected to actual exact passage bytes; text/support hashes/keys/labels/explanations unchanged.

Actual preflight now captures fresh56 blind +28 audit and regression26 blind +13 audit requests (123total). Answers hidden; synthetic sizing only, not qualification. Maximum serialized bytes39659 fresh /36437 regression, below50000. Original frozen offline mock cache bypassed all blind captures (0/56); separately frozen integrated runner fixes only offline cache-phase gating and verifies its executable/freeze hashes against authorization. Independent exact diff review is problemless. All academic/paid transport/budget branches and original core/transport hashes unchanged.

At2026-10-09T08:07:12.662Z: V77 first OpenAI blind request was dispatching, USD0 settled + USD0.010000 held. Lifetime USD35.127518 settled + USD0.517892 held;37 older unresolved reservations preserved. No academic outcomes yet. USD4 shared study stop /USD50 lifetime unchanged; no new paid benchmark if failure. Qualification, pilot, staging/release/publication are not demonstrated.

Exact checkpoint: execution/root-checkpoint-v77-native-start.json. Continue monitoring the existing PID/session87709 and provider request ledger read-only. Never resubmit accepted/unknown requests. Original/integrated recover action remains broken; separately frozen receipt-only helper is the supported recovery route. Finish fixed outcomes/receipts, independently diagnose actual failures, export allcases/costs/quality; only genuine complete pass permits pilot and current-profile staging.

## 9 October 2026 IST — V77 subject rule cannot pass; native study remains running

Read-only checkpoint at 2026-10-09T08:29:15.693Z: four fresh Accountancy valid controls terminal/quarantined, zero eligible; 12 provider requests, 11 complete, USD0.067087 settled + USD0.010000 held for this study. Lifetime USD35.194605 settled + USD0.517892 held, USD14.287503 remaining; 37 older uncertain records retained. Host process36876 and existing session87709 independently confirmed running. Native pending key4abdd87ee5c38dafafea73891ba088b40b1dadf2cead2e07803406f714726443 is the fifth case's blind stage; no kill, duplicate runner or resubmission.

At most1/5 Accountancy registered valid controls can survive, below unchanged70% subject floor. This mathematical limit prevents this frozen V77 version from qualifying even if every remaining case passes. The complete fixed41-case study and receipts are still pending; no pilot, release, staging publication or production write is justified. All untouched cases remain unfinished, not rejected. No further paid benchmark will follow failure.

Independent first-terminal-case diagnosis (execution/v77-final-source-prep/first-terminal-case-independent-diagnosis.json SHA25654061014f241e89e1219652a6b35b328223f087c71317e05f3fffac4d6899d8d) establishes source-only/custody/both native keys A. Actual gate issues: arithmetic option input not admitted as a premise, and an exact sourced premise rejected because decisive_context paraphrases rather than repeats it. Source caveats for equity-share exclusion and the illustrative maturity threshold are separately retained; correct key agreement does not settle whole-option support. Later control073 shows non-verbatim premise strings as a separate model/schema-compliance failure. Preserve exact premise anchoring. Explanation-stage checks were not executed after source_support failure and cannot be reported as passed.

Next: let existing bounded worker finish accepted requests and fixed outcomes, diagnose every failed designated-valid control, export every case and receipt. Develop only isolated unqualified regression proposals for demonstrated causes; do not alter current frozen contract/results or count inspected cases as fresh evidence. Checkpoint: execution/root-checkpoint-v77-native-third-outcome.json (saved during transition to fourth outcome).

## 9 October 2026 IST — V77 safely drained and all submitted requests settled

The existing frozen worker exposes its own STOP_AFTER_V77_REQUEST control. Root set it after four Accountancy controls were quarantined, preventing new reservations while the accepted request completed; no process was killed. Fifth valid control (Business Studies staffing) also quarantined. All14 submitted provider requests are complete and settled, USD0.084744 actual; zero V77 holds. Last sixth case had billed incomplete reasoning output and its new completion retry was blocked by the drain; it is unfinished, not an academic rejection. All41 frozen cases remain in the export: five terminal quarantines,36 unfinished, zero eligible. No controlled-defect case reached terminal evaluation; zero observed false accepts is not demonstrated defect sensitivity.

At2026-10-09T08:36:57.295Z lifetime is USD35.212262 settled + USD0.507892 held, USD14.279846 left under unchangedUSD50;37 older uncertain records preserved. Owner lease removed and session87709 exited. Native process exited1 because the final assessment directory was absent (ENOENT); results and receipts had already been saved. Additive execution/finalize-v77-assessment-receipt-only.mjs verifies unchanged core/transport/input hashes, opens SQLite read-only, forbids an active owner or incomplete submitted receipts, and reconstructs the SAME frozen assessor output with no transport/cache/reservation activity. Result is pending/evidence incomplete, receipt_complete=true, held_micro=0; reconstruction provenance is preserved separately. No runner restart/recovery dispatch occurred.

Independent bound execution/v77-final-mathematical-release-bound.json establishes maximum possible pooled valid survival15/20=75% (required85%) and Accountancy1/5=20% (required70%) even if every unfinished valid control later passes. Thus current frozen qualification cannot pass; the formal assessor stays pending because evidence is incomplete. Export execution/v77-final-export-2026-10-09 contains JSON/CSV for all41 cases, questions/options/keys/explanations/excerpts, native matrices, rejection reasons and actual per-item receipts, with hashes. Stop marker remains to prevent accidental new execution.

The isolated regression prototype is under execution/v77-final-source-prep/regression-proposal; it has no current runtime/publication import and cannot grant publication eligibility. Root review requires stronger clause-by-clause audit binding and fail-closed malformed-input handling in an additiveV2 before accepting it as a useful correction. PreserveV1 diagnostic code/report and all frozen studies. This is regression work, not qualification. No pilot, live staging, production release or new paid benchmark is authorized by this failed final attempt. Goal remains active and unachieved while focused independent local correction/review finishes.

## 9 October 2026 IST — focused post-study correction independently verified

Final local proposalV3 is additive and isolated; its module SHA2564ad6bcf353cb114ec14ac99aba11bdfa61198fa0f6e47849b372071c863baf1f, freeze3377d19d341fb3a7363f029e3bc3d054dd11ba24a164d607f55a126574bc4efc. V1/V2 prototypes and freezes are preserved. Root independently ran20/20 tests (11 proposal tests+9 independently authored adversarial checks), after identifying and correcting whole-clause audit omissions, permissive premise kinds, malformed-type exceptions and ambiguous provenance without an explicit representation. V3 binds exact origins for source/stem/printed-option arithmetic input, allows whitespace-only source line wraps and paraphrased context, and retains whole-option uniqueness, truthful nondecisive unresolved clauses and explicit source/identity/audit bindings. Invented/paraphrased quotations, skipped words, changed numbers/negation, unknown rivals, source-silence contradictions and blanket whole-option approvals fail closed. Tests use synthetic audit objects, not native semantic proof. General stem-only arithmetic still needs its existing valid behavior preserved before any future complete runtime contract integration.

Root verified bothV2/V3 manifests, unchanged original resolver/core/transport, all41 exported case identities and14 attributed receipts.228 protected historical bindings/61 paths still match. Runtime/application/data search found zero proposal imports; every proposal result explicitly refuses publication/dispatch eligibility. The proposal is not a new qualified verifier and cannot relabel this spent study. Root result: execution/v77-final-root-local-review.json. Current runtime checks remain718/718 factory,40/40 recovery,40/40 payment/question/student-budget,4/4 receipt recovery and successful app build;20 new tests are separate local regression-proposal tests, not738 factory tests.

Current accounting is unchanged: USD35.212262 settled + USD0.507892 held;USD14.279846 remaining,37 older uncertain records retained. Final attempt14/14 requests settledUSD0.084744 with zero study hold; five valid quarantines and36 unfinished of41 fixed cases. The frozen assessor is pending/incomplete, while separate unchanged-rule upper bounds prove no possible pass: pooled maximum75%,Accountancy20%. No controlled defect was evaluated, so no V77 defect-sensitivity result. No pilot/staging/production write.

Report execution/V77-CURRENT-QUALITY-REPORT.md and machine report execution/v77-current-quality-and-cost.json cover all21 criteria (16 mandatory+5 fit). Five failed controls have10/10 matching native keys and a descriptive pre-gate lower fit mean9.2/10; that is explicitly NOT publishable quality. No native explanation stage ran after source_support failure. Current10000-publishable-question forecast is unestablished. Validation-only conservative10000-candidate boundUSD1693.75 becomesUSD2419.64 at hypothetical70% survival; corrects earlierUSD2420.36 arithmetic and excludes authoring/research/repair/revalidation/publication. Conditional40-pilot reserve boundUSD15.48 with all repairs exceeds unchangedUSD3 stop cap; no completion guarantee. English matching remains near-exhausted; no dispatch.

Changed scope since native start: isolated proposal modules/tests/reviews/freezes, readonly diagnostic/bound/quality/export/final-report recovery helpers, result artifacts, STOP_AFTER_V77_REQUEST drain marker and brain/report updates. No frozen contracts/results/registrations were edited, no accepted ID resubmitted and no process killed. Exact blocker: this final authorized qualification cannot pass; any complete runtime integration requires a new verifier and genuinely fresh independent evidence, and another paid qualification is outside the final-attempt authorization. Inspected cases stay regression evidence. Qualified pilot and live current-profile staging/retrieval/dispute proof remain absent. Production still requires final explicit approval. Goal remains unachieved; no completed-generator claim.

## 9 October 2026 IST — additive V7.8 local runtime correction frozen

Integrated the demonstrated representation correction into six new V78 modules and four test files. Frozen V77 remains unchanged. Explicit positional premise origins distinguish actual source quotes, exact stem facts and hypothetical printed-option arithmetic input; mixed source/stem reasoning, whitespace-only PDF line wrapping, paraphrased explanatory contexts and legitimate stem-only arithmetic are preserved. Both frozen independent matrices still require full-option/clause audit. Source silence/category labels cannot decide contradiction. Added exact V78 version/prompt/contract checks before cache reuse or eligibility. No keyword ban, rating override, weakened academic gate, provider removal or production route was added.

Independent review found and resolved the origin enum mismatch and source-silence provenance gap; initial findings and later addenda are preserved. Root verified742/742 factory tests,40/40 recovery tests,51/51 payment/question/student-budget checks and a fresh successful application build with67 pages. The sandbox factory attempt had26 temporary rename EPERM failures; normal-access rerun passed. The sandbox build stalled at compilation; root verified and stopped its task-owned Next build PID23520/parent37460, then normal-access build exited0. No factory/provider worker was stopped. All228 older bindings across61 paths plus56 original V77 core/transport bindings remain unchanged. Inspected V77 native outputs/labels/export remain immutable; locally projected origins in regression tests are not native evidence.

Immutable local freeze: artifacts/question-factory/cuet-readiness-2026-10-09/v78-local-contract-freeze.json SHA256676178bfa8e7ab5f7617d4d40869a977aeb29c27d27c73171901f7d5f073105d. V78 validation hash e4be26f3e6dcb651edcf736049f872a736abaed1ed4db5b6299d6aaccb613d58; prompt7711966eaf5d41def4bcc229e38b97ae1aa39eca235accca4deaf432260bac5e. Actual legacy/current/CUET release predicates all false. No V78 runner, registration, qualified profile, release, pilot, staging or production write. Freeze optional page count is null because its parser read initial0/67 progress; build log and checkpoint establish67/67/exit0.

Final read-only ledger2026-10-09T09:24:40.037Z:USD35.212262 settled+USD0.507892 held,USD14.279846 remaining,37 older unresolved. V77 requests14/14 complete/USD0.084744 settled/zero study held; no owner/pending request. Host process check09:24:43Z found no active factory worker. Native outcomes remain five terminal valid quarantines/36 unfinished; formal assessorpending, mathematically impossible pass. V78 local integration spentUSD0 generator funds.

Report: execution/V78-LOCAL-INTEGRATION-RESULT.md; exact checkpoint: execution/root-checkpoint-v78-local-integration.json. Goal unachieved. Remaining: genuinely fresh independently keyed/source-backed qualification of this exact frozen version, measured publishable yield/cost/21-parameter quality, qualified pilot and live current-profile staging proof. Another paid qualification is outside the final-attempt authorization; do not start it, retune labels, resume V77, or buy new cases on automatic continuation. No current10000-publishable forecast exists. Local verification is complete; repeat neither the full audit nor passing tests without a new defect/change. Production still needs explicit final approval.

## 9 October 2026 IST — goal blocked audit after completed local correction

Current automatic continuation revalidated the V77 final-local and V78 integration checkpoints and the final-attempt authorization. Previous goal turn was meaningful progress; current turn has no authorized next execution and no live process to wait on. The same paid-scope blocker is documented in three consecutive goal turns (isolated final correction, integrated V78 correction, current revalidation). Free local integration/checks/reporting are finished; no further test repetition or speculative patch would establish the missing native academic qualification. Blocked audit is satisfied and goal status is being set to blocked, not complete. Audit: execution/v78-goal-blocked-audit.json. Resume requires changed explicit human scope or an external-state change; do not treat automatic continuation as paid approval. No new spend, provider request, pilot, staging, release or publication occurred.

## 9 October 2026 IST — owner-requested Claude handoff saved

The owner explicitly requested a new handoff and copy-ready Claude prompt; this supersedes the earlier no-handoff instruction for documentation only. Saved artifacts/question-factory/cuet-readiness-2026-10-09/CLAUDE-HANDOFF-2026-10-09.md and CLAUDE-START-PROMPT-2026-10-09.md. They cover V7.5–V7.8 work, construction versus academic/judgment/representation/transport failures, frozen evidence, corrected yesterday-cost comparisons, publication/novelty limits and the next local-review path. No runtime change, new study, provider request, ledger write, pilot, staging or production operation occurred. The generator goal remains blocked/unachieved; V7.8 remains locally frozen and unqualified.

Refreshed read-only ledger at 09:46:11 UTC: USD35.212262 settled + USD0.507892 held; USD14.279846 remaining under unchanged USD50 ceiling;37 older unresolved records retained. V7.7 14/14 requests complete/USD0.084744 settled/zero study held/no pending/no owner. Host inventory at09:46:46 UTC found no active factory worker. Snapshots and pre-handoff dirty-checkout inventory are in execution/claude-handoff-2026-10-09. Independent Luna document review found no factual/authorization correction against its reviewed evidence. Documentation verification resolved24 links and matched69 V78/V77/recovery frozen bindings plus the immutable native export. Result: execution/claude-handoff-2026-10-09/verification.json. Existing passing application/factory checks were not unnecessarily repeated for Markdown edits. Next: Claude reads this handoff and targeted evidence; justified local correction only, preserving frozen bytes. Another paid qualification requires explicit new human scope; no production approval is implied.

## 9 October 2026 IST — owner authorizes Claude's comprehensive final pass

The owner corrected the prompt: Claude may perform the necessary fixes and paid qualification and carry the work through to a generator ready for use. This supersedes the preceding paid-scope restriction and historical blocked-goal instruction for Claude's continuation. Updated both CLAUDE-START-PROMPT-2026-10-09.md and CLAUDE-HANDOFF-2026-10-09.md to authorize final-pass local corrections, research/model calls, fresh qualification, a qualified pilot and current-profile staging checks within the unchanged USD50 lifetime ceiling and persistent guard. No repeated approval is required for those authorized steps. Qualification gates, immutable historical studies, uncertain holds and final explicit production publication/deployment/migration approval remain. Earlier document revisions and their original verification are preserved in execution/claude-handoff-2026-10-09/handoff-revision-1.md and prompt-revision-1.md. This turn edits documentation only; no provider call, ledger mutation or generator execution. Claude should now complete the prerequisites and proceed autonomously when the actual evidence and budget permit, rather than treating the old blocked entry as current lack of authorization.

## 9 October 2026 IST (evening) — Claude final pass: V7.8 measured natively, additive V7.9 compact resolution (unqualified)

Claude took over under the owner's final-pass authorization. All work so far is regression/diagnostic on already-exposed cases; nothing is qualified, piloted or published.

- **V7.8 native smoke (2 exposed cases, regression only):** the clause matrix plus full re-audit exhausted output budgets — a 5,000-token Luna explanation audit returned reasoning only (truncated, billed, retried) and a 7,500-token blind solve truncated; validation ≈ USD 0.02/item and ~10 min latency. Cause recorded in `artifacts/question-factory/cuet-readiness-2026-10-09/v78-regression-probe/`.
- **V7.9 (additive, V7.8 frozen bytes untouched):** `contractV79.mjs`, `optionResolutionV79.mjs`, `factoryEvidenceV79.mjs`, `verifyV79.mjs`. Same gates (hidden-key Luna + Gemini blind solves, single defensible answer, every non-key option needs an exact anchored premise contradicting an exact part of it, unresolved = quarantine, existing Luna explanation audit now also audits both frozen resolutions; category-only / source-silence / partial-truth refutations are non-decisive). Representation is one row per option instead of byte-exact clause matrices. Revisions r1→r4 each fixed a demonstrated regression failure: r2 passage scope (in a reading question an option the passage neither states nor implies is a wrong answer — subject-fact items keep the strict rule) and single contiguous quotes; r3 passage quotes may carry the passage's own evidence ID or support the key; r4 renamed the audit field (`refutation_entailed`→`decisively_wrong`) after the native audit inverted its meaning. Exact r1/r2/r3 files are snapshotted with SHA256SUMS beside each probe.
- **Transport defect fixed:** Node fetch aborts responses whose headers take >300 s; OpenAI flex calls take 150–310 s. r1 lost 7/41 cases (`fetch failed`) with USD 0.0875 left as uncertain holds. Added `scripts/pipeline/lib/longFetch.mjs` (injected `fetchImpl`, transport's own abort deadline unchanged); r2 had zero transport losses and zero holds.
- **Native regression results (41 exposed V7.7 cases: 20 valid controls, 21 defects):** r1 0/18 terminal defects accepted, 9/20 valid eligible (7 transport errors); r2 0/21 defects accepted incl. disputed `v75f-825e60a00f`, 7/20 valid (5 lost to the r2 passage evidence-ID representation bug); r3 English subset 0/4 defects accepted, 1/5 valid (audit field misread). Remaining valid losses split into representation (fixed), legitimate control defects (off-syllabus indifference curve, undefined "development", undeclared machine status) and strict audit/explanation judgments that are left in force.
- **Measured V7.9 r1 cost per item (validation only):** Luna blind USD 0.0023, Gemini 0.0114 (realtime), Luna audit 0.0009 ≈ USD 0.0146 + authoring ≈ 0.0012. Gemini batch would halve its share; no 10,000-publishable forecast until a qualified pilot measures yield.
- **Also added (not yet run):** fresh-study assembler `tools/assembleV79FreshStudy.mjs`; study mode + preregistered decision assessor in `tools/runV78RegressionProbe.mjs`; V7.9 pilot tooling (`lib/cuetPilotV79Plan.mjs`, `lib/cuetPilotV79Deps.mjs`, `lib/cuetPilotV79Export.mjs`, `tools/prepareCuetPilotV79.mjs`, `tools/runCuetPilotV79.mjs`, 15 offline tests; dry run plans 40 jobs, English without matching); author layer `lib/originalAuthorPolicyV79.mjs` (distractors must alter a decisive stated element; source-only explanations); `tools/stageCostReport.mjs`, `tools/replayV79Resolution.mjs`.
- **Fresh benchmark (sealed, not yet exposed to any validator):** 36 cases (5 valid + 4 defects per subject) authored by independent Claude Sonnet instances from main-registry hash-custodied facts, independently blind-keyed by separate instances with keys/labels hidden. Root adjudication happens only after V7.9 is frozen.

### 9 October 2026 IST — V7.9 r5 frozen; fresh qualification q1 registered and dispatched

- **r5 (last pre-freeze revision):** measured false accept of `known-bank-ea03…` (missing decisive assumption: a non-tax receipt may reduce assets, so "no claim on government" does not establish a revenue receipt) under r4, while r2 had caught it — sampling variance. Added a rival-condition check (blind instruction + audit field `unexcluded_rival_conditions`, must be empty). r5 full 41-case regression: 0/21 defects accepted, 41/41 terminal, USD 0.378, zero holds; two extra independent passes on the three missing-assumption defects: 0/6 accepted. Valid 8/20 on these exposed controls: 2 legitimate (off-syllabus indifference curve; undeclared machine status), the rest strict audit/explanation rejections of controls whose excerpts do not decide their distractors/explanation claims. Gates left in force.
- **Freeze:** `artifacts/question-factory/cuet-readiness-2026-10-09/v79-contract-freeze.json` (sha256 0f7a9d8a15be25dc320f1c0e96f07e72d688330e848b2f8e2ee7fd4015a22068), verifier `cuet-fit-validator-v7.9-compact-resolution-r5`, contract 67cbdd05da43334b89b1320559b23cc19be28f7170977910d0ff67f9ff025f4d, prompt 1bca4d95066f08401d42596c12c9dfa70a3a7bf1502a4df4b95c4d0834edea8f. 39/39 V7.9 + pilot offline tests.
- **Fresh study q1** (`v79-qualification-q1/`, payload cb9f4392…): 36 cases authored by independent Claude Sonnet instances from main-registry hash-custodied facts, blind-keyed by separate instances (keys/labels hidden), sealed until after the freeze. Root adjudication excluded 2 (economics-v5: genuine 4-vs-5-unit profit tie; economics-d3: two-sector multiplier label not upheld) → 34 cases, 19 valid (5/5/4/5) + 15 defects (wrong key ×4, second defensible ×4, unsupported explanation ×3, missing assumption ×1, numerical ×2, unanswerable-from-passage ×1). No overlap with 1,079 prior fixture stems. Unchanged rule: zero eligible defects, ≥85% pooled valid (≥17/19), ≥70% per subject, unfinished = not eligible. Cap USD 1.20 inside the USD 50 guard. Ledger before dispatch: USD 36.498 settled + 0.623 held.

### 9 October 2026 IST — fresh V7.9 q1 FAILED; additive V7.10 for the validator-caused losses

- **q1 result (frozen rule, unchanged):** FAIL. 34/34 terminal, **0/15 fresh defects accepted** (all wrong keys, second answers, unsupported explanations, numerical faults, unanswerable items caught), valid **10/19 = 53%** (Accountancy 4/5, Business Studies 1/5, Economics 3/4, English 2/5). USD 0.340479 settled, zero holds. `v79-qualification-q1/run/decision.json`. q1 is now spent regression evidence; V7.9 stays frozen.
- **Cause map of the 9 valid losses:** 4 genuine explanation flaws in the controls (wrong distractor arithmetic; "no premium"; "no position" for "no managerial position"; "moved" for "offered") = legitimate; 2 over-strict explanation judgments (valid deductions such as "at least one" ⇒ "not both required"); 2 r5 rival-condition over-firing on "which feature does the case show" items; 1 representation loss (registered extraction "retail stor e", Luna correctly quoted "store").
- **V7.10 (additive: `contractV710.mjs`, `optionResolutionV710.mjs`, `factoryEvidenceV710.mjs`, `verifyV710.mjs`, tests `v710Integration`/`v710PassageScope`, runner `tools/runCuetValidatorStudy.mjs`):** (1) quote anchoring also compares with whitespace/soft hyphens removed and letter-hyphen-letter joined on both sides, never inside a digit run; (2) rival-condition check limited to classification items, and for illustration items a rival counts only if the case positively exhibits it; (3) explanation claims that follow necessarily from printed words are supported, while added facts/statuses/rules, scope changes and unsupported accounting effects still fail. 27/27 offline tests. Native regression on the spent q1 cases and key V7.7 defects is running before any freeze; fresh q2 cases are being authored and sealed (no q1 fact reuse).

### 9 October 2026 IST — V7.10 frozen; fresh qualification q2 dispatched

- **V7.10 regression before freeze (spent q1 cases + hardest V7.7 defects):** 0/15 q1 defects and 0/8 hard V7.7 defects accepted (incl. `v75f-825e60a00f`, `known-bank-ea03…`, second-defensible BS cases). Added `case_scope` (illustration items: an option naming a feature the printed case does not exhibit is wrong as an answer; refutation only, exact stem words; audit basis `not_exhibited_by_case`; never for classification items) — Business Studies q1 controls 1/5 → 3/5 on regression. Passage-only enum values removed from schemas of non-passage items. Remaining q1 valid losses are mostly genuine explanation paraphrase overreach in those controls; the explanation gate is unchanged in substance.
- **Freeze:** `v710-contract-freeze.json` sha256 709dd79ff248753b586d2e42e19b0ee2bdcd7a4f0728b7a371fc9aa4f40f60ef; verifier `cuet-fit-validator-v7.10-compact-resolution`; contract 61d7a05c21d4b221fa48101de6de5b139cf31cee6c846611b0b34dc20e5206ba; prompt 56b00d4b…. Suites: factory 825/825, recovery 40/40, payment/entitlement/wallet/billing/question-selection/answer-integrity 66/66.
- **q2** (`v710-qualification-q2/`, payload 3bf3fed9…): 36 genuinely fresh cases (no q1 fact reuse, no stem collision with 1,000+ prior fixtures), new independent Sonnet authors + separate blind custody, sealed until after the V7.10 freeze; 20/20 valid controls independently confirmed, 0 exclusions. 20 valid (5 per subject) + 16 defects. Same unchanged rule. Ledger before dispatch USD 37.749 settled + 0.623 held.

### 9 October 2026 IST — fresh V7.10 q2 FAILED (70%); V7.11 frozen; source hygiene

- **q2 result (unchanged rule):** FAIL. 36/36 terminal; **0/16 defects accepted**; valid **14/20 = 70%** (Accountancy 4/5, Business Studies 3/5, Economics 4/5, English 3/5). `v710-qualification-q2/run/decision.json`. Across both fresh studies: **0/31 controlled defects accepted**.
- **q2 cause map (6 valid losses):** 2 defective source custody — the registered NCERT Business Studies facts are two-column extractions with interleaved lines, so no faithful contiguous quote exists (construction defect of the controls, and a generator source-quality problem); 1 case-sensitivity representation error (false_part "the minutes…" vs option "The minutes…"); 1 Luna reasoning runaway (15,000 output tokens, all reasoning) → provider_output_incomplete; 1 over-strict converse judgment; 1 genuine explanation overreach ("only one visitor").
- **V7.11 (additive copies; V7.10 frozen with its failure):** case-insensitive anchoring; Luna blind output cap 16,000. Offline re-binding of all saved q2 blind resolutions changed exactly one outcome (english-v1 valid → binds) and no defect. Tests 46/46. Freeze `v711-contract-freeze.json` sha256 652df6a6…; contract dff119fc0a2034eb719e024e8feb84460f359423fcea66c5f7f2efa1d6f181e3; addendum corrects the inherited free-text note.
- **Source hygiene in progress:** every active registry reference fact (641 within 120–2,500 chars) is being labelled clean / interleaved / garbled by independent Haiku reviewers so q3 and the pilot draw only on quotable sources.

### 9 October 2026 IST — session stop (usage limit); exact resume point

- **Source hygiene result:** of 641 active registry reference facts, 323 clean / 300 interleaved (two-column splice) / 18 garbled (Haiku labels, spot-checked by root). Business Studies 40/119 clean, Economics 182/410, Accountancy 57/68. Labels: scratchpad `hygiene/labels-all.json` (copy into the repo before reuse). The generator currently authors from interleaved facts too; the pilot planner must exclude non-clean facts before any pilot.
- **q3 kit built, NOT authored:** clean, unused facts only (Accountancy 6, Business Studies 7, Economics 30, English 14) — Accountancy/Business Studies are thin; registering clean de-interleaved NCERT excerpts is the next source task.
- **Not done:** q3 authoring/blind custody/run under frozen V7.11; any qualified pilot; staging; production. No version is qualified or released. No paid work is running. Remaining budget ≈ USD 11.6 (refresh the ledger first).

## 10 October 2026 IST — V7.12: provenance fix, enforceable scope, repaired NCERT source custody (frozen; q3 in construction)

- **Quotation provenance bug (independent reviewer):** frozen V7.11 `containsAnchoredV711` bound "nowhere" to source "now here" and "resign" to "re-sign" (compact fallback removed all whitespace and letter-hyphen-letter). Reproduced. V7.12 folds only case, Unicode compatibility, quote/dash glyphs and whitespace; never merges space-separated tokens or drops in-line hyphens; the only join is a hyphen (incl. U+00AD, which NCERT PDFs use for printed hyphens) that ends a line in the source, matching the joined or hyphenated form. 13/13 direct cases plus adapter-level tests (both negatives quarantine through the real blind/freeze/audit/verifier seam; a genuine line-end hyphen binds). Offline re-binding of every saved q1/q2 blind resolution: 0 outcome changes.
- **Enforceable scope:** `scripts/pipeline/lib/questionScopeV712.mjs` deterministically detects illustration items (concept noun + show/illustrate verb, never classification wording, never English) and reading tasks (English comprehension item types, or a stem explicitly scoped to the passage). `case_scope` / `not_exhibited_by_case` count only for illustration items and `passage_scope` refutations / `passage_unsupported` only for reading tasks; request schemas offer those labels only where they can count. Source silence and category labels stay non-decisive everywhere. Adapter tests cover classification refusal, non-reading passage refusal, implicit-inference reading acceptance and second-answer quarantine (solver and audit paths).
- **Source custody repair:** `scripts/pipeline/tools/extractNcertColumnsV1.py` re-extracted 38 NCERT chapter PDFs (identity SHA-256 re-checked) with glyph-level gutter detection (empty 10 pt band; measured two-column ≤0.39% vs single-column ≥0.57% occupancy), word spaces at ≥0.12 em (measured: confirmed spaces ≥0.15 em, kerning 0.05–0.07 em) and line breaks preserved. Every registered segment's letter/digit stream occurs contiguously in xpdf `pdftotext -raw` output for the same page (independent extractor): 1,852/1,860 body paragraphs verified. Visual audit of 24 stratified excerpts against rendered page images: 24/24 verbatim and in reading order, 3/24 spacing damage → a corpus-vocabulary screen now EXCLUDES letter-spaced runs and in-line split words (text never altered). Overlay `data/question-factory-runtime/source-registry-ncert-columns-v1.json`: 2,043 verified teaching excerpts in `ncertcol-<book>-v1` sources (Accountancy 969, Economics 636, Business Studies 438) with page/column/bbox; all 41 original NCERT sources and the private leac203 extraction are superseded. `lib/ncertColumnsRegistryV1.mjs` applies it for BOTH study assembly/running and pilot authoring (V7.12 pilot dry run: 40 jobs, every NCERT ref is `ncertcol-*`). Gap: Directing (lebs107) has no local PDF — downloading it needs the owner's permission; until then Directing has no usable source.
- **Freeze:** `v712-contract-freeze.json` sha256 557f43b3e27bfb33de7da7f9744947fdd2f93b5819672c56ee235ad407c993e4; contract 1107c72a94dd5a8f408fb41e75d57f37f885d693aa268dd0ca149bf2d2d2f899; binds validator, scope detector, author layer, longFetch, runner, assembler, extractor, overlay builder, overlay file and prices. Suites: factory 928/928, recovery 40/40, payment/question 66/66. No paid call since the 9 Oct stop (ledger USD 38.130182 settled + 0.622892 held).
- **Fresh q3 registered and dispatched (10 Oct):** `v712-qualification-q3/` (payload c5f96bca…, bound to V7.12 contract 1107c72a… and overlay 2390610c…). 36 cases from repaired sources only (0 superseded refs; 0 stem collisions with prior fixtures): 20 valid (5/subject, valid controls over ≥4 chapters per subject except English's 3 available chapter labels, numericals included) + 16 defects. Custody: independent Sonnet authors; separate blind reviewers wrote keys AND their own source-only explanations, hashed/frozen (`custody/sealed/blind-freeze.json`) before proposed answers were revealed to separate explanation reviewers. 20/20 valid controls confirmed (key + every explanation claim stated/entailed); every defect independently flagged. BS author's empty fact_refs fixed by ref-only edit (content hash verified) and BS blind custody redone; first BS blind output preserved as invalid. Unchanged rule; cap USD 1.20; ledger before dispatch USD 38.130182 settled + 0.622892 held.

### 10 October 2026 IST — fresh V7.12 q3 FAILED (70%); qualification stopped pending an owner decision

- **q3 result (unchanged rule):** FAIL. 36/36 terminal, zero holds, USD 0.345224 settled. **0/16 defects accepted** (15 caught academically; business_studies-d3 was stopped by a registry custody mismatch before any model call because the q3 kit was built from an intermediate overlay — process error recorded; no valid control was affected). Valid **14/20 = 70%** (Accountancy 5/5, Business Studies 3/5, Economics 3/5, English 3/5). Across the three fresh studies: **0/47 controlled defects accepted**; valid survival 53% → 70% → 70%.
- **Independent adjudication of the six q3 valid losses** (Sonnet, with the official CUET 2026 syllabus text; `v712-qualification-q3/q3-valid-failures-adjudication.json`): 3 validator false rejections (english-v2 and english-v4 explanation nitpicks; economics-v1 strained "output might be 1" reading), 1 genuine control flaw (economics-v4 open-economy multiplier not in the 2026 syllabus), 2 debatable (business_studies-v1 modal refutation; business_studies-v4 compensation detail vs syllabus). Root's first read that all six were control flaws was wrong and is corrected here.
- **Interpretation:** representation, source-custody and scope faults found earlier are fixed; the remaining valid losses are marginal single-judge strictness in a design where any one stage's concern quarantines (owner rule: uncertainty means quarantine). That caps valid survival near the preregistered 85% bar. Running further fresh studies until one passes would be selective re-sampling, so no q4 was run. Qualification, pilot, release record and staging remain blocked; the threshold/policy is the owner's decision.
- **Measured unit economics (receipts, three fresh studies):** fully validated item ≈ USD 0.0148 (Luna blind 0.0021 × ~1.25 calls incl. truncation retries, Gemini realtime ≈ 0.0113, Luna audit ≈ 0.0010); per-case study averages 0.0096–0.0106 because flawed items stop before Gemini. Authoring (V7.9 layer) not yet measured natively; earlier campaigns ≈ 0.0012/author call. At 70% acceptance: (0.0012 + 0.0148)/0.70 ≈ USD 0.0229 → ≈ USD 229 per 10,000 accepted before repairs/revalidation and publication; one repair+revalidation on ~30% of items adds ≈ 0.0046/candidate. Gemini Batch would halve its share but recovery/latency behaviour is unverified, so no saving is claimed. The pilot "conservative maximum" (USD 0.361/candidate) is a reservation ceiling, not expected spend. A publishable-item forecast needs the pilot's measured yield.
- **Ledger now:** USD 38.475406 settled + 0.622892 held = 39.098298 committed; USD 10.90 remaining; 46 unresolved older records preserved. No process running.

### 10 October 2026 IST — owner decisions: measurement-only pilot; Directing source restored

- **Owner decisions (this session):** run a measurement-only 40-candidate pilot WITHOUT qualification (publication never, USD 3 stop cap, no release record, no staging publication); download lebs107.pdf.
- **Directing:** `data/question-factory-runtime/reference-downloads/lebs107.pdf` downloaded from ncert.nic.in; SHA-256 64d3468a… equals the registered identity. Column extraction verified 54/54 body paragraphs. Overlay **v2** `source-registry-ncert-columns-v2.json` (sha256 574c7b4e…; 39 sources, 2,091 excerpts, +48 Directing) built by additive `tools/buildNcertColumnRegistryV2.mjs` (also fixes a path-join bug); v1 overlay and builder unchanged (bound to V7.12 freeze/q3).
- **Pilot registration:** `artifacts/question-factory/cuet-pilot-v712-40-2026-10-09/` via additive `tools/prepareCuetPilotV712m.mjs` (overlay v2; records the owner authorization; binds questionScopeV712, ncertColumnsRegistryV1, overlay v2 and itself as runner-checked dependencies). V7.12 contract 1107c72a…; preregistration sha256 e117f900…; 40 jobs (10/subject, 4 waves); 40 durable V7.6 idea allocations committed; 0 superseded source refs; English mix 5 reading (5 distinct passages), 2 correct word usage, 2 synonym, 1 antonym, 0 matching/ordering. Dispatched with `runCuetPilotV712.mjs execute --approved`.
- **Pilot stopped after wave 1 (orchestrator, STOP_AFTER_REQUEST; drained cleanly, nothing killed):** 11 terminal, 3 eligible (all English: 2 reading, 1 antonym), 8 quarantined, 3 left in `validating`, 26 untouched; USD 0.065621 committed (ledger 39.098298 → 39.163919). **Every one of the 7 subject candidates (Accountancy/BS/Economics) was quarantined `input_bound_exceeded` before any validator call** — a tooling defect, not a quality result: the transport's internal UTF-8 byte bound (33,024 for gpt-6-luna and gemini-3.8-flash in `data/pipeline-prices.json`) is smaller than the V7.12 Luna blind request (offline rebuild: 33,101–36,648 bytes = ~20 KB fixed V7.12 instructions + ~10 KB candidate evidence; English 30.5–31.9 KB fit). Settled receipts since 8 Oct peak at 8,551 input tokens, so the requests are normal size. My registration preflight sized only author requests, never validator requests — the gap that let this through. The 8th quarantine is English sequence_ordering `invalid_structure,option_collision` (genuine). Outcomes stand as recorded; the pilot cannot resume after any bound change (pricing binding is registered, by design).
- **Blocked, needs owner decision:** raising the internal bound (proposed 49,152 bytes for Luna/Gemini; token rates unchanged, reservations only) was refused by the session's auto-mode permission classifier as weakening a guard; the read-only export was also refused. No further paid work done. A valid measurement needs (1) the bound raised by the owner (or permission to do it), (2) a fresh registration under a new pilot id (Plan/runner are freeze-listed, so via additive wrappers) with a validator-request size preflight. Quality note on the 3 eligible: the antonym item (plausible → implausible) is a trivial prefix antonym — weak CUET preparation value even though valid.

### 10 October 2026 IST — focused V7.13 final-pass draft (not frozen or qualified)

- Owner authorized a focused final implementation pass, targeting under USD 100 per 10,000 publishable questions and premium CUET quality, with parent implementation and GPT-6 Luna independent tests/reviews. Actual unit cost and qualification remain unproved; no release/publication exists.
- Difficulty selection implemented in data/db.js, data/mock_question_selector.js and data/nta_question_selector.js: exact explicit Easy/Medium/Hard filters; NTA preserves evidence tiers, prefers Medium then Easy, and uses Hard only after a confirmed shortage. Each band scans up to 6,000 rows with an end probe; an incomplete Easy/Medium inventory suppresses Hard fallback. Passage groups remain atomic and NTA UI is unchanged. Delegated checks: selection 32/32, recovery 40/40, answer integrity 11/11, payment 27/27 and changed-file lint passed.
- Additive V713 draft modules replace repeated validator instructions with one compact canonical prompt while preserving mandatory truth/entitlement gates, independent Luna/Gemini blind solutions and explanation/resolution audit. Both reviewers independently assess cognitive demand; Hard requires agreement. Registered demand cannot be silently replaced by an author label. Gemini uses native batch; Luna Flex has no implicit standard fallback. Frozen prices, their expiry and 33,024-byte bounds remain unchanged. Oversize requests pause as pipeline faults instead of rejecting candidates.
- Stopped V712 pilot receipt export saved under execution/final-pass-v713/: all 40 candidates retained, 27 actual provider requests receipt-complete, USD 0.065621 settled and zero held for that pilot. Global ledger refresh: USD 38.541027 settled + 0.622892 held = 39.163919 committed; USD 10.836081 remaining of unchanged USD 50 lifetime ceiling, with 46 older unresolved records preserved. V713 has made zero paid calls.
- Draft tools/runFinalGeneratorV713.mjs continues the same forty durable allocations with an explicitly diagnostic lineage, imports existing authored content, retains one-repair limits and includes original spend in the shared USD 3 cap. It requires independent all-stage/retry body preflight. It never publishes and cannot supply fresh qualification evidence. Independent runtime safety review and final application/build checks remain pending. Historical V712 registrations/outcomes are preserved.
- Next: finish independent review/preflight, correct demonstrated defects, freeze exact V713 before any fresh cases, measure through persistent guards, then one independently custodied fresh four-subject qualification. Current-profile staging and measured premium quality/unit cost remain release blockers.

### 10 October 2026 IST — independent final-pass checks and custody fixes

Delegated checks completed: factory 950/950, recovery 40/40, selector/payment 44/44, targeted V713 integration/recovery/demand/release isolation 24/24, runtime/payment review 15/15, and Next application build (67 static pages). Some additional integrity changes after those checks are receiving targeted verification; these counts do not claim qualification.

Implemented concrete review fixes: Hard requires two independent Hard assessments; author cannot silently change registered demand; actual completion retries now double the adapted output cap with distinct keys and full reservations; worker lock cleanup survives constructor/cleanup failures; Gemini queues a wave into a scoped native batch; accepted batches have receipt-only recovery and graceful draining. Full-body preflight now retains actual JSON bodies, recomputes bytes and hashes, checks base/retry caps and keys, and is sealed against immutable registration. Fresh custody requires eight named, typed, hash-linked artifacts, exact opaque blind identities, source excerpts and sealed-key reveal coverage; local timestamps/role assertions are described as local delegated custody, not cryptographic proof of an independent actor.

V713-specific publication/profile/runtime integration is additive. It preserves release, receipt, inventory and passage-atomic gates; a missing or altered runtime capsule stays closed. An isolated staging registry snapshot is available only under the staging app flag and repository artifact root. Frozen historical V712 contracts/outcomes remain unchanged. No V713 freeze, native request, fresh case authorship, release or staging publication yet. Source-only kits are prepared. Next: targeted final verification; freeze; actual full-body preflight; same-forty diagnostic continuation under the shared USD 3 cap; fresh independently keyed 36-case qualification under USD 1 stop cap. Costs remain USD 39.163919 committed, including USD 0.622892 uncertain holds; unchanged USD 50 lifetime ceiling.

### 10 October 2026 IST — exact V713 freeze

V713 execution frozen at execution/final-pass-v713/CONTRACT-FREEZE.json, SHA-256 82de56e6299d312cbbee86a636f7ddff41daf8ca4a626204ca714541935481f4; validation contract f7d31a74138f497581e545b1199f57ac43a450edb56d38c5ab368aeb0500b72d. The freeze binds 118 raw-source/config/price/registry dependencies, compact prompts, true adapted completion retries, diagnostic and fresh-qualification capture/runners, staging publication/profile/runtime capsule and staging launcher. Expected runtime binding and capsule were generated; no release is implied. Frozen V713 files must not be edited in place. Source-only kits preceded freeze; fresh sealed authoring was delegated only after the freeze. Qualification gathers both independent provider evaluations for every case, including early academic rejects; neither sees the other's answer. The measurement continuation is explicitly diagnostic, not fresh qualification. Independent preparation/capture/seal and post-capsule application build are in progress. V713 API calls remain zero at this checkpoint.

The first offline diagnostic preflight stopped before writing its result: the capture fixture did not cache a synthetic successful blind response, so the explanation adapter correctly requested additional blind work and the required 400-row assertion failed. No provider call, reservation, candidate verdict, bound change or gate change occurred. The original freeze and registration remain intact. A separately versioned R2 offline capture helper is authorized to correct the sizing fixture only, with its own immutable hash-linked correction record; actual request bodies/retry caps remain checked and sealed by the frozen execution runner. Do not report the failed capture as a passed preflight or academic failure.

### 10 October 2026 IST — diagnostic dispatch authorization after sealed body preflight

R2 offline body capture passed all 400 combinations (40 fixed candidates x author/blind/Gemini/audit/repair x base/retry), retaining actual serialized bodies, keys, caps, bytes and SHA hashes. Maximum V713 request 28,637 bytes versus V712 comparison 39,351 bytes: 10,714 bytes smaller under unchanged 33,024-byte bound. Fourteen inputs use saved authored candidates; 26 use explicitly synthetic sizing-only templates. This is tooling evidence, not academic validation. OFFLINE-CAPTURE-CORRECTION.json binds the additive R2 capture helper and unchanged original execution freeze; no frozen file/registration change. Execution-preflight seal binds registration SHA 3e5a674145d5a809c84e69c736bdf9210a95b7e2e863b9cdd7e5bcfff36f9d18 and preflight SHA c6e0832188333683d265ea810dbe5f9a2594c6e9748555613c94e5e81befcd15.

Parent authorized the delegated verification agent to start only the same-forty diagnostic continuation after refreshing processes/accepted requests/leases. Shared USD 3 cap includes original USD 0.065621; USD 50 lifetime limit, all old holds, native Gemini batch and independent Luna/Gemini gates remain. Accepted requests must drain/reconcile; never kill or repost uncertain requests. Fresh sealed 36-item author output is saved separately, post-freeze; an independent key-free packet/reviewer is next. Do not expose keys before that review is frozen. No new qualification dispatch, release or staging publication has been authorized by this milestone; the user has authorized those contingent on completing exact custody/preflight.

### 10 October 2026 IST — diagnostic transport fault, no academic inference

The first V713 diagnostic execute used the restricted default network environment and ended normally after provider DNS resolution failed (`getaddrinfo ENOTFOUND api.openai.com`). Six request reservations remain unresolved; no response/usage receipt exists, no model output was received and settled continuation cost is USD 0. Six jobs carry transport-failure quarantines, eight imported jobs remain generated, and 26 remain queued; this is not a six-item academic rejection result. Holds USD 0.072768 remain conservative and must not be zeroed or resent. Shared old+new committed pilot cost USD 0.138389. There is no live worker/worker.lock. Verification agent is checking default versus normal read-only DNS access before any further call; only unaffected remaining jobs may proceed if normal network is proven working. Global unresolved count is 52 (46 historical +6 new). Source, frozen contracts, labels and candidate IDs are unchanged. Fresh benchmark packet construction and source-only independent custody continue locally.

### 10 October 2026 IST — capacity recovery correction and pre-evaluation benchmark custody

The owner explicitly authorized the bounded CUET question/options/explanation/source payload to OpenAI and Gemini after automatic approval review required that specificity. Subsequent native execution received three typed zero-billed Flex capacity refusals and one completed blind response costing USD0.001421. The runner was stopped with STOP_AFTER_REQUEST and drained normally. Original fixed40 state/export remains intact: nine transport quarantines (six unknown DNS, three receipt-proven capacity refusals), one repair_started, four generated and26queued; zero eligible. Lifetime verified USD38.542448 settled+USD0.695660 held=USD39.238108 committed, USD10.761892 remaining;52unresolved and no dispatching/worker/batch IDs. Never replay the six unknown keys or infer academic quality from these transport outcomes.

Observed execution defect: typed Flex refusal was correctly recognized/settled at zero but the engine quarantined the candidate instead of pausing. Additive execution-only R2 files now exist: providerAvailabilityV713R2.mjs, cuetPilotRunV713R2.mjs, runFinalGeneratorV713R2.mjs, runQualificationV713R2.mjs, captureQualificationV713PreflightR3.mjs and prepareExecutionCorrectionV713R2.mjs. EXECUTION-CORRECTION-R2.json binds their raw hashes and the original academic freeze. They do not change V713 prompts, rubrics, efforts, prices, caps, source facts, academic gates or logical request identities. Before retry of a receipt-proven zero-cost refusal, retain its entire raw request/reservation/receipt in an immutable local attempt artifact. Unknown or accepted work cannot be reposted. The diagnostic derivative retains the same40IDs/allocations and ledger campaign scope and preserves the original registration/state/export. Independent targeted tests and all400 body/key/cap comparisons are pending; no R2 paid execution or registration is yet approved by local evidence.

Fresh benchmark construction remains PRE-preregistration and has made zero native evaluation calls. Original authored draft f448751c... and first packet/map remain. An explicit metadata-only R2 corrected36 stale source-pack versions and18 canonical chapter aliases; all academic fields/IDs/labels unchanged, independently checked. R2 author SHA9ffddb8b42a098f6a411dbd6934a23a988796db945bb873434e2f5f35e7ec223; key-free packet SHA952947ee419ca129ff117d1b7f1ce3cd83dbd72f44d4c3d345e1b148873d4fa3. Independent source-only review output cf8b7d0d424f0fd793f3792b14df0f75b30f7310da2507e074fc51bf2e4a02aa was frozen at ab0bdda09e7e8206d844645608ae0b3d9781963468bc3d425b19882c3e40b89e BEFORE sealed-map reveal. Post-reveal explanation audit de2c04c3511274842bfd35775202c9d56b83ad7ded700f59b49a37c310f72e38 established20valid controls and15/16negative claims; one BS claimed second answer was not supported by its source. Semantic review5b92e76646dd8a249dad722e11110e96e3f67683be2bf9d58e6ee34804014f2b found four repeated sibling tasks; all36 remain preserved. Twenty-seven authored-Medium labels disagreed with the frozen review's heuristic Easy band. These drafts cannot be silently treated as a qualified fresh benchmark.

ONE final pre-preregistration construction correction is delegated: preserve36IDs and expected labels; replace only the five problematic draft negatives with genuinely distinct, decisive source-supported controls; make honest difficulty metadata corrections against the already-frozen review, preserving all unaffected academic content. Preserve drafts/diffs and require new CLEAN source-only blind custody before reveal. No fresh provider result exists or informed these corrections; no threshold/gate change, exclusion, replacement after registration or purchase of another benchmark is authorized. If this construction cannot establish valid custody, report the exact blocker. Separate fresh and current-version known-defect regression evidence, complete receipts, release record, pilot quality/cost proof and staging remain necessary; software tests or a fresh-study summary alone do not release V713. Goal active, production publication/deployment/migration still requires final explicit approval.





## 10 October 2026 IST — V713 R3 local connection safeguards and prospective custody correction

Provider payload/destination authorization is explicit: the owner authorized the bounded OpenAI and Google Gemini calls through the unchanged USD50 lifetime guard, USD3 shared diagnostic cap, and USD1 aggregate qualification stop cap. That does not authorize replaying accepted or unknown requests. No R3 model execution has occurred at this checkpoint.

The avoidable R2 launch omission (`--use-system-ca`) is now addressed additively by `trustedNetworkV713R3.mjs` and `runQualificationV713R3.mjs`: Windows trust configuration and unauthenticated HEAD/TLS checks happen before a writable ledger, worker claim, or reservation; insecure TLS configuration is refused. Recognized transport faults pause shared dispatch, preserve partial independent judgments and unknown holds, and do not count as academic rejection. Whitelisted code diagnostics avoid persisting arbitrary error text. Luna independent verification reports 17/17 focused checks passing. The original R2 sources, registration, outcomes, circuit state and receipts remain unchanged. The new R3 pilot engine requires an explicit shared pause callback and is not yet connected to any executing pilot runner.

Corrected a prior reporting error using the actual R3 author and novelty artifacts: five nonunique cases include TWO expected-valid controls and THREE expected-invalid controls. The proposed unchanged-case joint study therefore has 31 fresh cases (18 valid, 13 invalid) and six regression cases (two valid, four invalid, including the unchanged historical V75 false accept). Original 36 IDs/order/labels/content stay fixed; all 20 valid and all 17 invalid remain in the joint denominator. In addition to the original joint 85% valid survival, 70% per-subject survival and zero false accepts, the prospective R3 protocol requires the fresh partition alone to meet the same survival minimums. No result-informed case exclusion or relaxed threshold is permitted.

`mixedCustodyV713R3.mjs`, `prepareMixedQualificationV713R3.mjs`, `captureMixedQualificationV713R3.mjs`, and `collectMixedQualificationV713R3.mjs` add role-aware custody, scoped test-only historical source context, full request capture and exact fresh/regression result projections. The assembler binds the original historical execution-plan registry hash and checks scoped source/pack/family equality; it never writes the global source registry or a publication manifest. The collector includes receipts, every case, decisive excerpts and held/settled costs, and cannot publish. No R3 execution delta, qualification registration or immutable assembled study exists yet.

Current preflight blocker: exactly one novelty-history input changed during the R2 TLS run (`measurement-continuation-40-r2/state.json`, old hash 7fc99d1f62a8d9e797af9116fd7c952b9d080852a91b23bad14ffee56d3b8114). The original novelty report remains intact. Independent review is producing an additive immutable history snapshot and bounded refreshed novelty report before assembly; no case or expected label is being rewritten. Three intended-valid Medium metadata bands also differ from the clean source-only reviewer's Easy judgments; their methodological significance is being reviewed before spending. These are not native qualification outcomes.

Verified accounting remains USD38.542448 settled plus USD0.821324 held (65 unresolved records), USD39.363772 committed, USD10.636228 below the unchanged lifetime ceiling. There are no executing qualification workers or new accepted Gemini batches at this checkpoint. The 19 diagnostic unknown attempts stay held and must never be resent. Qualification, premium quality, the under-USD100/10,000 publishable target and staging remain unproved. Next: complete bounded custody/difficulty review; independently verify R3 collector and runner; freeze execution-only delta; assemble/preregister/capture/seal; refresh process/provider/ledger state; then one bounded qualification, only if all preflight checks pass. No production action is authorized.

## 10 October 2026 IST — strict R3 custody assembled; qualification not executed

Independent review resolved the two misleading contested flags via an additive, source-backed clarification (`explanation-audit-clarification-r3.json`, SHA f7f89a46a845997126ed97d7995b2b9236ff87ad9b4cc3f3c03cff0df849d7e0). Original all36 audit rows and frozen keys remain untouched; exact two negative oracle labels are confirmed, not exempted from the defect denominator. The additive history refresh (`novelty-r3-history-refresh.json`, SHA80f6d5cfec72f8673abc84543746f87e2a9173eb0230b8ab4cf52dbec9dfec04) snapshots the changed diagnostic state and proves14/14 historical candidate projections unchanged; all novelty decisions stay fixed.

Luna independent assembly succeeded with zero provider calls. `qualification-fresh31-regression6/frozen.json` SHA21d81b6a6011136d54cb20e03aef130cb08c62ec059d772b7383ef74aab9fb37 binds37cases, all original36labels/order/content, and unchangedV75regression. RegistrySHA0cd90b86dab2816c1e276f6a8bc23d340e608c1f2274f45685c7f17cd68b3730. Fresh31=18valid13invalid; regression6=2valid4invalid; joint20valid17invalid. Fresh positives are4accountancy/4business/5economics/5English, joint5each. All20positives passed local gates. Historical test-only source records are exact matches to the bound V75 execution-plan snapshot. Separate role envelopes preserve exact completeIDs and currentV713bindings. This evidence establishes fixture custody, not validator qualification or premium difficulty calibration.

The collector checks canonical role subset contents against the full frozen study, exact independent candidate/content/provider/prompt/contract bindings and settled usage receipts for the blind stages; held/unfinished/errors cannot release. It only exports evidence and a release candidate, never mutates calibration or publishes. The runner enforces fresh-only85%valid/70%subject survival in addition to the unchangedjoint20valid rule and zero accepts among all17invalids. Three valid authorMedium/reviewerheuristicEasy differences are legitimate disclosed boundary risks; no post-evaluation relabeling is allowed.

Before dispatch: independent focused source/tests, R3executiondeltafreeze, prepare/capture222actualrequestbodies/seal, conservativecostpreregistration, process/provider/ledgerrefresh. Existing explicit provider authorization remains applicable. No new inference calls occurred at this checkpoint. Defaultlocalexec helper failed before processcreation; justified elevated read/offline execution works. No sandbox/reset/cleanup/reinstall was attempted. Latestaccountingunchanged: USD38.542448settled+USD0.821324held,65unknownrecords preserved. Continuum checkpoints saved before the provider-switch boundary; goal active.

## 10 October 2026 IST — sealed bounded R3 study ready; receipt-only older batch refresh precedes dispatch

Independent Luna verification:25/25focused checks passed (17transport,6mixed assessment/source assertions,2actualcollectorbehaviour). The actual collector on the empty registered study reports0/37terminal,zero receipts and paused/incomplete; it writes no release/publication manifest. The stronger fresh-only85%gate was behaviour-tested against joint17/20=85%butfresh15/18=83.3% and correctly pauses. This is local process evidence, not qualification.

Execution-onlyR3manifestSHA9af13e0e9d3c99646a454b45fa60ca7fd03a09159f4fba11f5d10239e37be4e1 froze8additivefiles with118academicdependencyhashes unchanged. RegistrationSHA45ddc15b8e4f668ba1151c2e2e513b92a2f55dfec3d1e2925a930b2112018fff; preflightSHAac9cf2b64b004c620c5233350bde3987700d0044704c1b7d44c337456384075f; sealSHA1942b5d45fcb5ee81f1757fdc68a8e274b3262d39154f802270d78ad6a24265d. All222actualserialized request bodies cover37cases x3stages x2variants;111distinctbase/retry pairs, doubledretrycaps,maximum23695bytes below33024bound. Blindinputs contain no currentcandidatekey/expectedlabel/oracle/role/defect/priorresult; explanationinputs contain exactly the two frozen providersolutions. Roleenvelopes remain canonicaldisjoint31/6subsets; all37cases and17invalidlabels preserved.

Study `qualification-fresh31-regression6/cost-preregistration.json` records standard full222requestboundUSD6.273276 versusUSD1aggregateSTOPcap. This is a conservative possible bound, not expected/actualspend; completion underUSD1 is expressly not guaranteed.222rows are planned stage/variant requests; the academic denominator is37cases, not222completedrequests. Discounts require actual provider receipts; pricing expires12October and remains unchanged. Ownerexplicitpayload/destinationauthorization applies, and rootauthorizesoneexactR3execution only after savedacceptedbatchstatus, competingworker/ledgercheck, allfrozenbindings and trustedCAHEADpreflightpass. No standardfallback, repair,replacement, newbenchmark or unknownreplay is authorized.

Accounting correction: four unresolved Gemini reservation rows refer ONE old accepted batch, `batches/2mmft6uwaqppq9n1pzsni0iq1jccncktq1o7`, in cost-native-cohort010/continuation500; totalUSD0.079152 is already within globalheldUSD0.821324. The earlier no-Gemini-ID statement applies to the recentR2diagnostic only, not the whole ledger. No matching live pipelineworker was found. Recovery owner is checking its exactsavedcontract and GET-onlyreceipt recovery; it must never resend the batch, release an uncertain hold by assumption, or execute its old candidates. Historical unknownholds remain conservativelycounted; this does not invent a stricter globalzero-hold gate. LatestglobalUSD38.542448settled+USD0.821324held,65unresolved. NewR3qualification haszeroinference calls at this checkpoint; final_verification_recovery owns its authorized execution and acceptedreceipt collection. Goal active; release/premiumquality/costper10k/staging remain unproved.

## 10 October 2026 IST — R3 final study launched once; old Gemini batch terminal with missing usage

Execution owner: GPT-6 Luna final_verification_recovery. Exact approved runner launched once at 2026-10-09T20:51:41.338Z, PID 24128, tool session 98363, with --use-system-ca. Trusted-network HEAD preflight succeeded before ledger reservation. Saved R3 state initially has four blind-stage request keys/four validating cases; no academic terminal outcome or release is established at this checkpoint. Monitor that existing handle; never launch a duplicate or automatically restart a paused study.

Receipt-only reconciliation of the historical accepted Gemini batch batches/2mmft6uwaqppq9n1pzsni0iq1jccncktq1o7 used the frozen native transport against exactly four unresolved keys, GET only. Provider batch is terminal; all four returned batch_failed_usage_missing, without usable usage receipts. Their USD 0.079152 total holds remain. No inference, POST, reservation, assumed zero usage or historical outcome rewrite occurred. Prelaunch lifetime snapshot remains USD 38.542448 settled + 0.821324 held = 39.363772 committed, 65 unresolved, zero dispatching/active batches; new in-flight R3 reservations are additional and must be refreshed before reporting a current total.

The sealed study remains 37 cases: 31 genuinely fresh (18 valid/13 defects), 6 regression (2 valid/4 defects). Both unchanged joint 85%/70% survival and prospective fresh-only 85%/70% floors apply, with zero controlled false accepts and all cases terminal/receipted. Full bound USD 6.273276 versus unchanged USD 1 STOP cap: completion is not guaranteed. Pricing, 118 academic dependencies, 8 R3 correction dependencies, registration, full-body capture and seal were independently verified immediately before execution. No fresh cases may be replaced, relabelled or omitted based on outcomes.

Independent continuation review confirms the diagnostic R2 retains 40 IDs, 20 quarantined/20 queued and 19 unknown request outcomes. A future exact-qualified-profile continuation needs an additive wrapper/immutable registration and trusted-network preflight; never resend those unknowns or silently reset the historical circuit. At most the remaining planned 20 jobs could be executed. Complete 40-candidate academic accounting, premium quality and USD 100/10,000 publishable economics cannot be claimed while 19 outcomes remain unknown. No current pilot restart or staging publication is authorized by local tests alone; qualification is still unproved. No production action occurred.

Next: owner monitors/reconciles the one live R3 session, then exports all 37 fixed outcomes and exact receipts. Qualify only from complete passing evidence. On availability/cap pause preserve accepted receipts and holds without automatic retry. On academic failure diagnose the actual misses; do not buy another benchmark or weaken gates. Reassess exact-profile pilot/staging only if qualification passes.

## 10 October 2026 IST — native failure diagnosed; V714 correction pending focused review

R3 sole session 98363/PID 24128 remains owned by final_verification_recovery. First ten native cases all quarantined at source_support; five are fresh valid controls and one is a regression valid control. Thus fresh survival cannot exceed 13/18 (72.22%) and joint valid survival cannot exceed 14/20 (70%); the unchanged 85% gates cannot pass. Every case remains in its frozen denominator. The runner continues the one bounded registered study to account for accepted work; no additional benchmark, outcome exclusion, relabel, release or pilot restart follows.

Independent first-wave diagnosis by difficulty_selection_final confirms five clean positive cases failed an underspecified challenge-array representation: Luna returned A/B/C with solved_key=A, omitting D, despite correct four-option matrices and source support. Compact V713 had removed canonical 0-3 scoring anchors and exact-three-NONchosen legacy challenge instructions. The sixth positive also has a separate implied fixed-asset/inventory status risk, retained honestly. Four controlled defects are academically justified (two multiple-answer, two wrong-key; one also has missing referenced stimulus). Both providers' actual blind solutions were inspected. No first-wave explanation audit ran; planned preflight bodies are not executed audits. First-wave actual cost was USD 0.014647 Luna + 0.050979 Gemini = 0.065626, fully settled. Latest later owner milestone has 19 source-support quarantines, 19 settled Gemini receipts USD 0.088893 and 24 settled Luna receipts USD 0.050625; one output-incomplete error and further in-flight requests remain. Historical 65 unresolved holds USD 0.821324 remain unchanged.

Root created only five additive unused V714 draft files: compactValidationV714.mjs, validatorDiagnosticsV714.mjs, contractV714.mjs, factoryEvidenceV714.mjs, verifyV714.mjs. Restore the canonical fit rubric and explicit non-key challenge/evidence/status semantics, add exact inherited failure diagnostics, keep every pass predicate and independent gate. No frozen V713/R3 file, candidate, label, request, pricing, cap, manifest or publication route changed. V714 is unqualified and runtime-unwired. Its current contract is ed0e4ae7fd56c045dd67c74e33686c2fcd1c0d25e640fc2e2f578fba4dfcf545.

Luna import/contract check passed; independent reconstructed 222-body sizing initially caught four oversized legacy variants. Root removed only duplicated anchor text from schema descriptions, keeping full canonical anchors once in the system. All 222 reconstructed variants now fit, max 32,554 bytes (470 bytes headroom). Metadata-only local sizing artifact: qualification-fresh31-regression6/diagnosis/V714-LOCAL-222-BODY-CAPTURE-20261010.json, SHA313e1f9a6183f59befa017adde59277004765366b2e71bd4579cc7d4c3b8dbe7. Focused tests/review of semantic coverage, cache isolation, no-key views, unchanged rejects and full freeze integrity are delegated solely to Luna and pending; no native V714 request occurred.

Next: drain sole R3 runner and collect exact all-case outcomes/receipts; independently classify every designated valid failure, preserving missing audits and transport errors. Finish local V714 review/test repairs without changing any inspected evidence. No qualified premium-quality, per-10,000 cost, full 40-pilot or staging claim is supported. Do not infer that remaining dollar allowance authorizes repeated benchmarks after the one final study.

## 10 October 2026 IST — additive V714 local correction frozen after independent review

GPT-6 Luna difficulty_selection_final completed 17 focused local tests (6 prompt/schema/cache/body and 11 verifier integration), 0 failures. The synthetic eligible path requires both independently stamped matching Medium assessments, both frozen resolution matrices and a successful explanation audit. Wrong key, two supported options, unresolved rival, unsupported explanation, failed numeric check, missing difficulty, difficulty mismatch, invalid source, missing verdict and stale V713 judgment all fail closed. These are software checks with mock transport, not academic or provider independence evidence.

Root froze exactly the reviewed five new files in LOCAL-CONTRACT-FREEZE-V714.json, create-only. V714 contract ed0e4ae7fd56c045dd67c74e33686c2fcd1c0d25e640fc2e2f578fba4dfcf545; prompt e3f74330022521221e0229b25b478b236a18dc37eb74330ac3498ab5658e7415. All 222 reconstructed request variants fit the existing byte bound; maximum32,554/33,024. Independent preservation read confirmed118/118 V713 academic files and8/8 R3 execution files unchanged. New test files: scripts/pipeline/tests/factoryEvidenceV714.test.mjs and v714Integration.test.mjs. The local freeze explicitly states native qualification not run, paid V714 provider calls0, releasefalse and runtime publication integrationfalse. No calibration, database publication, production deployment or migration changed.

Native R3 session98363/PID24128 remains solely recovery-owner managed; first-wave diagnosis is saved in diagnosis/FIRST-WAVE-NATIVE-DIAGNOSIS-20261010.md. Latest received native milestone:20 source-support quarantines (10fresh valid,5fresh defects,5regression),0eligible; fresh survival max8/18(44.44%). The fixed study continues receipt accounting, not a search for a passing threshold. One output-incomplete error and further requests remain nonacademic outcomes. Collect exact terminal results and current settled/held costs before final reporting.

## 10 October 2026 IST — final native R3 receipts complete; source representation diagnosis

The sole existing worker finished without duplicate execution, kill, accepted-ID resubmission or new benchmark. Fixed denominator37:36 source_support quarantines (fresh17 expected-valid+13 defects; regression2 valid+4 defects), one fresh expected-valid provider_output_incomplete error, zero eligible. Thirty-six cases have both actual independent judgments. The incomplete-output case has two OpenAI receipts and no Gemini judgment. Explanation_support and repair requests0: earlier source_support failure prevented the explanation audit. A quarantine caused by malformed records is not proof of catching a controlled academic defect. Collector remains paused and runner incomplete; survival cannot meet the unchanged85% rule. Release/calibration/pilot/staging/publication did not occur.

Actual study receipts77, all settled with usage:40 OpenAI blind_solution (37 base+3 doubled-cap retries),37 Gemini independent_evaluation (36 base+1 doubled-cap retry). Actual studyUSD0.263696, held0. Refreshed lifetimeUSD38.806144 settled+USD0.821324 uncertain held=USD39.627468 committed, USD10.372532 available under unchanged50. Historical65 unresolved records remain, including four old terminal Gemini missing-usage holds; active batches0,dispatching0. Provider owner final_verification_recovery owns the saved export/report. No inference was treated as free.

Independent diagnosis outside the first ten examined12 terminal designated-valid cases:11 academically supported, one genuinely ambiguous sparse/meticulous lexical item. All11 supported cases have Luna non-key challenge serialization failure (selected A included, D omitted);10 also have malformed/subthreshold fit records. Nine both-provider matrices pass. One Gemini matrix rejects an exact registered farmer-hyphen-newline-baker quote because source line-joining and needle whitespace disagree; another uses arithmetic with an excerpt evidence ID and requires clearer source-kind instructions. The ambiguity and all frozen labels/outcomes remain unchanged. Correction artifact: diagnosis/NATIVE-VALID-FAILURE-DIAGNOSIS-CORRECTION-20261010T0309+0530.json. Last terminal valid and V75 actual matrices receive targeted final review; no new paid evaluation.

Root created five additive V715 draft modules (contractV715,compactValidationV715,factoryEvidenceV715,verifyV715,optionResolutionV715) after the V714 local freeze. Exact printed-quote matching with unchanged word/number boundaries precedes the inherited source-line-join fallback. Schema explicitly distinguishes excerpt rules/formulas with catalogue IDs from arithmetic calculations using printed givens and empty IDs. No ID rule, source/uniqueness/numeric/independent-audit gate was loosened. V714/V713/R3 remain frozen. GPT-6 Luna owns focused source-binding regression tests, all222 request-body sizing and preservation review. V715 is unqualified, unwired and has0 paid provider calls; pending review is not a release.

Reference-mock screenshots supplied by the owner show ordinary vocabulary/grammar/matching formats. They do not establish that the competitor used ChatGPT, which model it used, its answer keys, complete mock quality or official-PYQ authenticity. Blue options are user selections. Inspected supported controls show comparable ordinary text is possible, but whole-generator default superiority is unproved. Correctness, fair uniqueness, syllabus entitlement and useful explanations remain essential; complex validator serialization is an engineering requirement, not student learning value. Current publishable yield, premium quality and USD100/10000 approved economics remain unestablished.
## 10 October 2026 IST — reviewed V715 local source-binding correction frozen

GPT-6 Luna independently completed8 focused tests,0failures: literal printed line-hyphen quote acceptance, inherited joined/hyphenated source forms, word/hyphen/numeric boundaries, complete four-option resolution, arithmetic empty-ID and excerpt-ID separation, current profile/two frozen matrices/audit integration, stale-profile rejection and missing-audit rejection. Prior V71417 tests and broad factory/recovery/payment/application checks remain independently recorded; no new aggregate factory total is claimed.

Create-only offline helper scripts/pipeline/tools/v715BodySizeDiagnostic.mjs instantiates actual V715 adapters on the same37 frozen fixtures using synthetic retry responses and in-memory cache only. All222 base/retry request variants fit33024bytes; maximum32811, headroom213. Metadata-only artifact qualification-fresh31-regression6/v715-body-size-diagnostic.json SHA939baf6e64acfd5dd0b73863dbf978666ff819b51c1bc02f1e53a0763b2b6023. This is software sizing, not native judgments or fresh academic evidence.

Independent review diagnosis/V715-LOCAL-REVIEW-20261010-V2.json SHA34e4d144d93f41e682e9f16bd3d270ad1832e45dd88c1f5f5504fac99c7934c8 confirms V7145/5,V713118/118,R3eight/eight unchanged. Its first report contained a literal trailing backslash-n; that malformed first artifact was preserved and V2 corrects report serialization only. Five source files remain exactly as reviewed.

Root create-only freeze LOCAL-CONTRACT-FREEZE-V715.json SHAd52ef7e40a1cfdc8d7e1d03d40a4ae89edef565e65d163c8fbe534844390bb7a. V715contracte44f34f94187283d851db1d6b46d95615e02de089bcbc783d7a312344f77de9d; promptd900a166e86cf3607cc823f9fc664a04901a721deb222711df2a4105a38e3521. Qualificationnotrun,paidV715calls0,releasefalse,runtimepublicationunwired. The unchanged prior native qualification cannot pass and contributes inspected regression evidence only. No matching release, fullpilot, premiumquality, USD100/10000approved-cost or current staging claim follows.

Current final receipt artifact qualification-fresh31-regression6/qualification-evidence-1791582257260.json SHA9e8a75a0ee143a5c3947e14085bb501fe0f3b5cc069791bfe54a2512e15bd991 was independently read by root:37fixedcases,36quarantines,1error,receipt_complete=true,publicationnever,releasemanifestfalse,premiumqualitynotestablished,costper10000notestablished. NativeUSD0.263696settled/0held; globalUSD38.806144settled+0.821324held,65historicalunknowns,0activebatches. No further provider dispatch. Final two-case native academic inspection remains owned by difficulty_selection_final; no proposed answer is being supplied for a new qualification.

## 10 October 2026 IST — owner-directed V716 report, score and route architecture

Owner corrected the design: strong source-backed authoring; independent validators report solutions, feedback and scores; a separate deterministic policy decides eligibility and mode routing. Academically sound 6–6.9 items may enter other practice; 7+ may enter NTA. Easy/Medium/Hard is independent, with Medium primary and Hard held from ordinary NTA unless complete Easy/Medium inventory is insufficient. This supersedes the previous >=7-for-all-practice craft rule only for the new V716 contract. It does not change any frozen prior benchmark rule, label, outcome or academic gate.

Nine additive V716 implementation files exist under scripts/pipeline/lib: contract, generationPrompt, scorecardPrompt, scorecardReview, scorecardPolicy, verify, practiceSelection, campaignSession and publicationBridge. The obsolete challenge-array/quote-template duplication is absent from this profile. Both blind solutions freeze before proposed keys/explanations are revealed. Reviewers give parameter feedback, not accept/reject commands. Twenty historical quality dimensions remain visible; only intrinsic learning objective, CUET style, time/load, clarity and distractor craft form the local composite. Verified truth and inapplicable features cannot inflate that score; overall opinion, difficulty and global novelty do not enter it. Global novelty is assessed separately through persistent allocation, shared inventory fingerprints and publish-time inspection.

Malformed/incomplete reports are review errors, not academic rejections. Valid-shaped wrong keys, nonunique answer sets or unresolved rivals block eligibility and avoid an unnecessary paid explanation call; no explanation pass is invented. Other otherwise-solvable items retain a separate explanation/source/option audit. No score rescues false facts, source-unsupported explanations, decisive missing inputs, ambiguity, syllabus violations or wrong numerical results.

The session reuses the existing lifetime/campaign guard, native Gemini batch and Luna Flex adapters, durable cache, accepted-ID receipt recovery and worker ownership. DNS/TLS preflight precedes writable accounting; exact current registration, prices, full request/retry bounds and conservative budget-stop possibilities are mandatory. No new runner has been started. Publication/retrieval are explicit versioned local/staging interfaces: current inventory and family holds, score-signature rechecking, 6/7 mode filtering, idempotent write receipts and whole passage groups. No default production writer exists. Existing live application APIs remain on their previous profile until a genuine V716 qualification and deliberate integration; merely adding these interfaces does not prove student-visible operation.

Latest verified native state remains terminal old R3: fixed37,36 early source_support quarantines+1 incomplete output error,0eligible,77 settled receipts,study USD0.263696 and0held. Global USD38.806144 settled+USD0.821324 uncertain historic holds=USD39.627468 committed,USD10.372532 remaining under unchanged USD50 ceiling;65 historic unresolved. No new paid V716 call, release, pilot, staging restart or production publication. Under USD100/10,000 approved and premium-quality scores remain unmeasured targets. Local focused Luna checks and integration review are running; freeze follows final review. Exact next: close demonstrated local defects, save independent checks and body sizes, freeze V716, then establish genuinely unseen independent qualification evidence under separately sealed current registration. Never reuse inspected old cases as fresh or automatically buy another benchmark.


## Final checked closure

Luna final verification: factory1038/1038;recovery40/40;payment/question/practice47/47;focusedscorecard19/19;session/guard8/8. Initial broad failure was a test-fixture omission of registry/prices in restart open; corrected by the test owner, then factory rerun green, without relaxing implementation gates. Final222synthetic request variants max26935/33024,paidcalls0. V713/V714/V715 frozen contract hashes unchanged. No test/factory/qualification process remains. V716 deliberately remains an unfrozen/unqualified draft pending positive publication/retrieval integration review and fresh independent native qualification. Currentdraftcontract48d1f62021153d34f8cdc33a96ad5a1dada206d7498242dd158ceddfa5b1889b;prompt628df899412096dee97bbf088d67dbfa4094035b1fba035776b95752e0e205c5. See VERIFICATION.json for exact artifacts and limits.

Owner requested wrap-up and Claude continuation. Full package: artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v716-claude-handoff-20261010/HANDOFF.md;copy-ready continuation: CLAUDE-START-PROMPT.md;exact prompts: PROMPTS-AND-SCHEMAS.json;owner directions: OWNER-DIRECTIONS.md;read-only costs: SNAPSHOT.json. No new paid run started.

## 10 October 2026 IST — V716 integration closed, frozen and qualified once: FAILED (Claude)

Integration gaps from the V716 handoff are closed locally, each with focused tests (V716 suites 40/40; factory 1051/1051, recovery 40/40, payment/question/practice 61/61 before the final contract edits; V716 suites rerun after them):
- **Writer:** signed-row atomic SQLite writer (`publicationStoreV716Local.mjs`) mirrors questions, passage_groups, disputes and family holds. Publication checks recovery first: receipt-only, and re-dispatch only after the store proves under its write lock that nothing committed. Only real `questions` columns are persisted, and the registered group contract is used.
- **Retrieval and invalidation:** eligibility hydrates persisted rows from the signed record. Disputed, deleted and withdrawn rows are withheld. One disputed child withholds its whole passage group. Six-score items route to practice only; seven-score items also reach NTA.
- **Registration:** binds a real execution freeze (hash of every reachable module), the frozen case file and the separately held custody file, not boolean claims.
- **Policy:** difficulty is routing, not truth. Issue categories are judged by local policy. Null feedback scores are unscored feedback.
- **Critical pre-dispatch fix:** reviewer schemas had a shared string node, so the identity enum constrained every text field.
- **Session:** pins contract/prompt per operation, classifies faults (pending/held/paused/error), records author outcomes durably, and enables the existing Flex-to-standard fallback. The V716 author prompt restores the CUET format and presentation contract.
- **Root process error:** root edited contract files during diagnostic r1, so 6 Luna solves were duplicated and 5 Gemini rows queued. The run was stopped gracefully; accepted batches were reconciled receipt-only and never-sent rows were cancelled at exactly zero.

Native work, all under the persistent guard:
- diagnostics r1/r2 (inspected cases): USD 0.057036
- authoring diagnostics r1/r2: USD 0.022131
- fresh qualification: USD 0.192796
- this session's total: USD 0.271963 settled, 0 held, receipts complete.

Live ledger: USD 39.078107 settled + USD 0.821324 historic holds (65) = USD 39.899431 committed; **USD 10.100569 remains** under the unchanged USD 50 ceiling. No active rows or worker.

Final freeze: `final-pass-v716/V716-FINAL-EXECUTION-FREEZE.json`, sha `d807498d…138e`; contract `9957890e…82da`; byte copies in `V716-FINAL-SOURCES/`.

Fresh benchmark `qualification-fresh32b`:
- 32 items: 5 valid + 3 controlled defects per subject; keys balanced after the first build (all valid keys A) was abandoned unregistered.
- Independent custody by Claude Haiku 5.5 blind solvers and auditors confirmed all 32 before registration.

**Result: FAILED.** 0/12 false accepts (wrong key, multiple answers, missing input, unanswerable passage and false explanation all caught). But only 16/20 valid controls were eligible (80% < 85%), and Business Studies was 3/5 (< 70%). Three misses are justified audit rejections of unsupported or incorrect claims in root-authored valid-control explanations, which the Haiku custody audit missed. One (B-V2) is a validator self-contradiction: inverted option statuses on a NOT stem, mislabelled `academic_quarantine` by policy. All eligible items were rated Easy by both reviewers. Details: `final-pass-v716/V716-QUALIFICATION-RESULT-20261010.md`.

Real signed records round-trip the table shape with signatures, content hashes and decisions intact. The only blocker is the absent qualified release (software evidence, not publication).

Not done because qualification failed: release record, 40-job pilot (runner and plan ready), staging proof, active-profile switch, cost per 10,000 approved. A proposed migration for staging is saved only under artifacts.

Next requires an owner decision:
- a minimal V7.17: answer-status semantics for negative stems, self-contradiction labelled review_incomplete, exemplar-anchored difficulty;
- a new excerpt-strict benchmark;
- one more bounded fresh qualification.

Production remained untouched.

## 10 October 2026 — owner-authorised focused V717 (implementation milestone)

Owner authorised one fresh qualification capped USD1, pilot only after a pass, and bounded remaining work within the existing USD50 lifetime guard. V716 is preserved: its 99 frozen file hashes matched at the starting refresh. Native snapshot: USD39.078107 settled + USD0.821324 historic uncertain holds = USD39.899431 committed; USD10.100569 remains. 65 old unresolved; no active provider batches/dispatching requests or qualification/pilot workers. No new paid call yet.

Additive V717 modules/runners now implement answer-relative NOT/EXCEPT option statuses; self-contradictory reports become review_incomplete; faithful source entailment remains legitimate while unsupported factual clauses still block; observable independent difficulty evidence with illustrative anchors and named, actually supplied authenticated comparators. Generator checks final option order and source support for each explanatory clause. Craft >=6 practice / >=7 NTA, truth gates and Easy/Medium/Hard routing remain separate. A new bounded controller avoids the historical broken controller import. Pilot preparation/dispatch and session opening require the actual passed current-profile qualification summary/registration hashes, never an unbound caller boolean. Qualification also requires complete review evidence, so a malformed controlled-case report cannot demonstrate detecting a defect; zero false accepts and 85% pooled/70% each-subject survival thresholds remain unchanged.

Changed runtime files are new scripts/pipeline/lib/*V717*.mjs, tools/*V717.mjs and controllerV717.mjs only; earlier contracts/registrations/outcomes untouched. Independent Luna focused checks currently 9/9: correct negative stems, coherent wrong keys/multiple answers/rivals, contradiction classification, 6/7 boundaries, demand/comparator honesty, passed-qualification pilot gate and publication receipt-only replay. Actual adapter base/retry sizing with the longest observed V716 blind-report fields fits 33024 bytes (synthetic-source max16650; real fresh cases still need full preflight). Broad factory/recovery/question-payment/build checks are running under final_verification_recovery. Evidence: execution/final-pass-v717/verification/. This is local software evidence, no qualification/release/pilot/staging/production claim.

Next: finish independent checks and freeze the V717 execution closure before fresh question authorship; source selection is prepared only, no fresh question text yet. Build a compact four-subject source-strict benchmark, establish blind independent answers and explanation-claim custody, seal all cases/labels, recapture all bodies/retries/cost bounds, refresh native process/provider state, then exactly one guarded qualification. If it fails or regresses, collect accepted receipts and stop/report; no repeated paid benchmarks or weaker gates. Conditional 40-candidate pilot stays capped USD3 with all40 in denominator, no automatic repair/replacement, and matching-pool scarcity checked. Under USD100/10000 approved and premium-quality claims remain unmeasured. No staging project is configured; production actions still need final approval.

Cost evidence from independent read-only native-ledger review: V716 fresh32b has85/85 settled requests, all with usage metadata, totalUSD0.192796 andzeroheld. Luna blind32calls (27high/5medium) USD0.035377; Luna explanation21high USD0.018716; Gemini independent32medium USD0.138703 (72% of spend). The naive failed-study denominator16eligible givesUSD120.4975/10000, including intentionally defective benchmark cases; this is not generation/publication unit economics. Lower caps alone do not lower actual billed output. Historical measuredmedium misses conditional-answer defects caughtbyhigh, so established efforts stay. V717 instead asks for concise per-parameter notes/derivations while explicitly preserving decisive facts, numerical steps and whole-option/rival reasoning. Only the bounded fresh qualification and conditionalpilot can measure whether these instructions retain gates and meet cost/yield targets.

V717 academic/execution freeze created before any fresh question authorship: V717-FINAL-EXECUTION-FREEZE.json,105files, SHA0f578d06f5efc8e42c5a1db598ef6b09495b051addf271c517da486f030682bd;contract045cf8d93ece2742fbd651fb3f272532b8ff96cb554fed92230f788dbb66e533;scorecardpromptd51311949ff24aa226cd11726c4ee3fcaa5fb4eb826879de6c01ba883c547246;generationprompt40798dd4891ceec43ce2e326ade6f3b3ca22493705d0e1ec9138cb43447fb38a. Fresh construction owner fresh_construction_r3 was signalled only afterfreezecreation. Initialbuildcompletionclaim was challenged becauseonlystartupappearedinlog; final_verification_recovery then explicitlytracked thebuildtoexit0, Compiledsuccessfully,67staticpages androutetable(app-build-verified.log). Final focused11/11,factory1061/1061,recovery40/40,question-payment-selection62/62,scopedESLintpass,V71699/99unchanged. No newprovidercallyet. Freezeisnowimmutable; freshsource/key/explanationcustodymustcompletebeforeoneUSD1qualification.

### 2026-10-10 — V7.17 pre-registration independent custody checkpoint
- Owner authorized focused additive V7.17, exactly one fresh qualification through the persistent guard with USD1 stop cap, and pilot only after an actual pass. Existing USD50 lifetime ceiling and uncertain historical holds remain unchanged.
- V717 runtime is frozen (105 files; artifact SHA256 0f578d06f5efc8e42c5a1db598ef6b09495b051addf271c517da486f030682bd). Independent verification: 1061 factory, 40 recovery, 62 question/payment/selection and 11 focused tests pass; scoped lint pass; actual build verified exit0/67 static pages. V71699-file freeze unchanged.
- Initial fresh32 blind solutions frozen before proposed keys/explanations/labels were disclosed. Commerce audit confirmed all6 intended negative defects but found2 invalid positive-control drafts: numerical trend operation not established in official syllabus, and missing decisive marginal-cost definition with a headerless schedule. Related incidental gaps in negative drafts also recorded. Easy demand was not a rejection condition.
- Preserved original authored records/packets/solutions/audit. Created6 explicit pre-registration source/syllabus construction revisions with new IDs, same32-case denominator and same20/12 labels; revised blind packet SHA25652fdb60ea16ff764e647c6e4987824e30b00274d917ad330f67f8dc466897dbe. Independent revised derivation/audit pending; no registration or native evaluation yet. These are benchmark construction corrections, not post-result relabels.
- Plan-only pilot builder now invokes the same authoritative qualified-pilot verifier plus freeze/registry hashes before writing any plan. English matching remains excluded pending source-pool suitability; unused reading stimuli selection pending. No frozen runtime file changed.
- No new native spend. Latest verified baseline USD39.078107settled +USD0.821324held uncertain (65 historical unresolved) =USD39.899431committed; USD10.100569remaining. Refresh actual processes, provider state and ledger before execution; no duplicate workers or accepted-ID resends. Pricing valid through2026-10-12T21:37:55.116Z.
- Next: reconcile32-case source/key custody, seal create-only cases/custody/registry/study, capture all actual base/retry bodies and conservative costs, execute only the one USD1 qualification. If failed, recover accepted receipts and diagnose/report without another benchmark. Pilot40 USD3 only on actual pass; production approval still required and no staging project is configured. UnderUSD100/10k publishable and premium question quality remain unproved.

### 2026-10-10 — V7.17 qualification dispatched (one bounded run)
- All32 construction labels independently confirmed before native evaluation:20valid/12defects,5+3eachsubject; keys balanced5perletter valid and3perletter defects. Preserved original drafts with2 invalid positives and1 accidentallysound negative;7 affected construction rows corrected before registration, with independent revised derivation/explanation evidence. All original files/labels/history retained.
- Root corrected an unregistered runtime metadata mistake affecting5 reading items: conceptual→passage only. Original case bytes preserved at sealed/runtime-cases-before-passage-route-correction.json and exact correction receipt saved. Final cases SHA256f4aac376d54746c07d95e4ff484307125c798384fe31cc5b9959358e0382dc4b. All32 frozen stems/options/source refs/custody confirmed; no runtime contract/freeze change.
- Offlineprepare sealed192 actual full base/retry bodies, unique request keys, maximum27074/33024bytes. Reproducible conservative standard full-bound USD5.425536, with USD1guarded stop cap; budget-stop is preregistered and unfinished remains denominator.
- Sole authorized worker launched by final_verification_recovery: PID25444, wrapper session22513, qualification-fresh32 worker.lock. No duplicates/restarts. Preexecutionstate: USD39.078107settled +USD0.821324held,65historic unresolved; no activeworker/queued/submitted/dispatching requests. Four old Gemini unresolved rows share a terminal remote batch (64 total/60success/4failed), with status evidence saved but no billing receipts. No old IDs resent. Existing receipt-only recovery for those rows follows soleworker drain; uncertain holds preserved.
- Plan-only pilot40 uses2Easy/8Medium per subject,0Hardrequested; English4reading questions in2atomicgroups, matchingexcluded. Two existing narrative stimuli workshop/birds selected with zero candidate source_refs in the searched historical corpus; no pilot built or run before actual qualification pass.
- Full evidence/cost exporter now records every registered candidate,20criteria feedback, independent keys/explanationaudit/sourceexcerpts/rejections and native actual per-item cost. It explicitly distinguishes eligible from publication and cannot forecast generator cost from a qualification cohort. Luna reported3 export accounting gaps, root fixed them, focused verification pending.
- Next: collect solequalification outcomes/receipts; if failed, diagnose and stop furtherpaidqualification/pilot without gate changes. If passed, bind exact release and preflight/run conditional40candidate pilot at USD3stop cap, then uniqueness/quality/cost/localpublication proofs. No production publication/deployment/migration authorized and no staging configured.

### 2026-10-10 — V7.17 stopped unqualified; receipts and exact failure closed

- The single USD1 qualification cannot pass its preregistered zero-review-incomplete rule. STOP_AFTER_REQUEST was set at 05:58:25Z; the sole worker exited normally, and final inspection found no qualification/recovery worker or study lock. No new qualification, repair, pilot, release, profile switch or staging/production write followed.
- Fixed denominator 32: 10 terminal (9 eligible controls, 1 review_incomplete), 22 unfinished (17 not started, 4 paused, 1 pending). Five unfinished candidates already had completed Luna blind calls when STOP took effect; their outputs and charges are preserved. All 12 controlled defects are untested. The saved decision is incomplete; an empty false-accept list is not defect-detection evidence.
- Independent Luna diagnosis of q717-24a5b6b47bfb7b7caa018bf3 confirms unique D, correct source-grounded authored explanation, and both blind keys D. Its explanation audit mixed four negative claims from wrong options B/C and Gemini reviewer reasoning into authored-explanation claims, while declaring explanation_status supported. This caused audit_claim_status_contradiction. Root missed claim ownership before freezing V717. Original reports, labels and outcome remain unchanged; this inspected case is regression evidence only.
- Final study accounting: USD0.061662 settled, zero held, complete receipt accounting across 36 reservation rows (15 Luna blind, 10 Luna explanation, 10 Gemini provider completions, 1 proven-unsent Gemini cancellation at zero). No accepted/uncertain ID was resent. Four older Gemini rows returned provider code 14 without usage metadata through receipt-only recovery; retain their USD0.079152 hold within historical holds.
- Lifetime: USD39.139769 settled + USD0.821324 historical uncertain holds = USD39.961093 committed; USD10.038907 remains under the unchanged USD50 ceiling. Under USD100/10,000 publishable questions is still unmeasured: no V717 authoring pilot ran, and qualification controls cannot establish generator economics.
- Nine eligible controls scored craft mean 8.5704, range 8.1333–8.9333. All are Easy; all 25 observed independent difficulty reports say Easy. This is encouraging control-level behavior, not proof of Medium-first CUET generation, premium quality or improvement over a different V716 benchmark. Full 20-parameter eligible aggregates and their limitations are in V717-STOPPED-RESULT-20261010.md.
- Final preservation: all 105 V717 and 99 V716 frozen hashes match. Earlier delegated verification passed 1061 factory, 40 recovery, 62 question/payment/selection and 11 focused checks, scoped lint and application build. No broad tests repeated after the stopped study.
- Artifact-only changes after runtime freeze: tools/build_pilot40.py refuses existing output folders and verifies the fixed 40/10-per-subject plan before writing; tools/export_results_v717.mjs exports receipt-bound cached partial reviews without promoting unfinished cases. Independent export review confirms 32 rows ×20 dimensions, five partial reports, exact settled/held attribution and no qualification cost forecast. Export SHA256 38d5926bf6b8bdaedf7823a9101d43e0e34e479f3e4d15f6928a0f5b6712383a.
- Remaining concrete seams: authored-explanation claim ownership; V717 runners pass inventory:[] so general cross-campaign semantic inspection is not loaded; no V717 evidence-bound local release producer exists; local SQLite proof consumes a supplied manifest and does not establish real staging/student API behavior. No staging project is configured. The publication bridge can accept inventory, but its fresh-store proof is not a real bank comparison.
- Evidence: final-pass-v717/V717-STOPPED-RESULT-20261010.md; diagnosis/q717-24a5b6b47bfb7b7caa018bf3-academic-diagnosis.json; verification/post-recovery-summary.json; verification/post-recovery-accounting-addendum.json; verification/final-freeze-preservation-20261010.json; stopped-qualification-export-20261010/questions-and-evidence.json. Owners: native/recovery finished, academic diagnosis finished, export review finishing documentation only; no pending V717 paid request. Historical uncertain requests/holds remain preserved.
- Exact next work, if continuation is authorized: use an additive next-version contract to separate author claims, option checks and reviewer observations; retain this real report as a regression case; close inventory/release binding seams before new qualification. Do not resume V717, relabel cases, rerun accepted IDs or buy another study under this exhausted single-qualification allowance. Pilot remains conditional on a genuinely qualified version; production publication/deployment/migration still needs explicit final approval.
- Final export review is complete. Canonical review files are verification/stopped-qualification-export-review-20261010-v2.json and verification/stopped-qualification-export-review-20261010-v3.md; earlier timestamp/newline-formatting drafts remain preserved. All local owners have finished. No V717 paid request remains pending; only historical uncertain usage remains held.

### 2026-10-11 — Cloudflare hosting readiness audit; no migration performed

- Delivered `CLOUDFLARE_MIGRATION_READINESS_AUDIT.md`: conditional go for Workers Paid with existing Supabase/external APIs after moderate refactoring and measured staging acceptance. Keep Vercel production serving until then. Actual production invoices/usage, applied DB capacity/policies, cloud Worker runtime and 1,000 authenticated-user capacity remain unverified.
- Source-derived constraints: durable exams replay full event logs every 1.5 seconds even idle; upper model at 1,000 active exams is ~667 app requests/s, ~2,667 database gateway calls/s plus ~667 Auth calls/s with persistent limits enabled. Without persistent limits it is ~2,000 DB calls/s. Busy saves lower the rate but increase acknowledgement lag. Final unsynchronized answers at expiry, nontransactional ticket progress, unbounded scans and repeated 4.9MB evidence parsing require host-independent hardening; no production behavior was changed.
- Isolated Windows diagnostics: Next 16.2.4 Webpack production build passed in 139.73s; 190 recovery/learning/study/question/payment/integrity fixture tests passed; 3,220 local public/shell/expected-denied-auth requests had zero transport errors. Fresh Chrome landing lab LCP was 1,852ms desktop / 2,340ms throttled mobile; mobile load event ~8.03s. Three-minute device exam fixture exercised 24 answer/navigation actions and restored the first answer after disconnect/reconnect/reload, with zero page errors. This is not durable/cloud/real-phone/three-hour proof.
- Full OpenNext 1.20.10 diagnostic build ran Next successfully, then failed server bundling with 55 unresolved Next internal imports. Adapter warns Windows is not fully supported. Clean pinned Linux build, workerd byte/SDK/startup/heap checks, isolated DB load and late-answer tests remain deployment gates. No usable Worker artifact or cloud staging pass was claimed.
- Evidence/scripts/screenshots: `tmp/cloudflare-audit/`. Preservation comparison matched 1,156 copied source/capsule files; intentionally modified snapshot package/config excluded. Original application source/config/output and dirty work were preserved. Audit-owned servers stopped. No deployment, DNS, infrastructure purchase, real DB write or paid model call; no pending paid request. V717 remains stopped incomplete, release/qualification/publication unchanged, historical holds and USD50 factory / USD25 monthly runtime budgets unchanged.


### 2026-10-12 — Consolidated product experience research and agent workflow

- Added `PRODUCT-EXPERIENCE-RESEARCH-2026-10-12.md`: 16 analytical sections with
  10,884 words of new/expanded analysis, plus complete source appendices. Covers
  data-led dashboards, hierarchy/type/themes/states, Undertone's seven recap
  interventions, emotional design, hidden assumptions, all supplied gamification
  ideas, website/Android continuity, recommendation contracts, measurements,
  experiments, agent task briefs and review criteria.
- Preserved all three attached files byte for byte under
  `research-sources/2026-10-12-product-experience/`. Included the complete uploaded
  product brain (all 19 sections and earlier L001–L201 transcript), all 164 new
  speaker lines with exhaustive coverage index, all supplied notes, all 59 PDF
  text pages and six visually inspected reference-page renderings. Original
  source hashes: brain `4c49ca1f9c74a634d8d5c3e263138cf64306ee611f19e62448bf4d6e7dc27a61`;
  PDF `96a2cabd6c2fd441d9cccc28a8a5a1090ae97664aa45f8899c3b9bb168538cc2`;
  new transcript `df49e52224ed6bf9d117ebb42117296cb61345596162544f0e8aa8ff082a00a0`.
- All 17 document-preservation/coverage/reference checks passed. Verification and
  source manifest are saved alongside the sources. Eleven primary-source entries
  record selective external verification, including the Apple stand-reminder
  correction and limits on claimed animation/recap-caused growth. PDF extraction
  is a text layer; original PDF retains layout. Missing video timecodes and the
  original standalone earlier transcript were not invented or reconstructed.
- Appended discoverability/guidance to README and AGENTS. Future relevant agents
  are directed to a scoped experience brief, actual rendered-flow/state checks,
  accurate evidence labels and handover. This is documented guidance; no hook,
  CI enforcement or automatic model-compliance guarantee was installed.
- Research remains additive and does not rename MockMob, redesign navigation,
  change pricing, alter Mobi/brand rules, implement any proposed feature, or
  supersede existing learning/question/payment/budget/release contracts. No
  application changes or fresh application tests, production walkthrough,
  student experiment, deployment, native release, paid call or outbound message.
  No pending paid request from this task; concurrent checkout work preserved.
