# MockMob question generator: CUET-fit contract, validator study and state (7 October 2026)

Status in one paragraph: the corrected CUET-fit contract, the single-validator pipeline, a fresh frozen benchmark, deterministic CUET-fit
audit of the 662 approved questions, and staging plus production retrieval checks for all 662 are done and verified. The measured
batches, the topology release and the reassessment of the 662 approvals under a model judge are NOT done: OpenAI returned
`credit_balance_exhausted` at 16:21 UTC and the owner chose not to add credit. Nothing below claims perfect accuracy or uniformly
premium quality. Costs are provider usage receipts and conservative holds, not invoices.

## 1. State verified before any spend (7 Oct)
| Item | Verified value |
| --- | --- |
| Unique approved questions with staging and production publication receipts | **662** (English 173, Accountancy 141, Business Studies 183, Economics 165); 4 more publication rows are automatically withheld (666 rows) |
| Actual student retrieval, staging (signed-in student) | **662/662**, 11 complete passage groups, 0 rejected IDs visible, student-AI cap USD 25 unchanged — this session |
| Actual student retrieval, production (public feed, https://www.mockmob.in) | **662/662**, same checks, 0 production writes, 0 emails — this session (previous proof covered 575) |
| Local evidence gate over all 666 production rows | 662 eligible, 4 `publication_disabled`; deployed admin overview reports 662 usable |
| Cohort 010 (legacy contract, untouched) | 76 eligible (not yet published), 15 rejected, 9 waiting on one OpenAI batch (`batch_6ac631…`, 5 of 9 complete, never resubmitted) |
| Lifetime ledger at start | settled 12.861233, holds 0.137930, committed 12.999163 (matches the brief) |
| Lifetime ledger now | settled **16.615046**, holds **0.137930**, committed **16.752976** of the unchanged USD 50 ceiling; 5 unresolved bounded holds retained; no invoice obtained |
| This session's spend | **USD 3.753813** settled (calibration and study only), 0 held, 0 candidate spend |

## 2. The corrected rubric (what changed and the evidence for it)
Contract text: `docs/brain/QUALITY.md`; code: `data/cuet_fit_rubric.mjs` (pure, shared with the student-facing gate).
* Replaced the model-chosen 1–10 craft score with five anchored 0–3 criteria (syllabus objective, format authenticity, level against
  PYQ exemplars, time, discrimination). The overall 1–10 is computed. Pass needs objective ≥ 2, format ≥ 2, level ≥ 1, derived time ≥ 2,
  overall ≥ 7. Easy direct recall at PYQ level scores 3. Discrimination is scored but never blocks alone.
* Evidence that the old rating was judge-dependent: on the 662 approved questions the two judges gave the same exact 7–10 score for only
  **10.1%** (Spearman 0.21); Luna gave 7 or 8 to 99.8%, Gemini gave 9 to 77.8%. (`bank-cuet-fit-findings.json`)
* Mandatory rejections kept: wrong/uncertain key, more than one defensible answer, missing decisive assumption, unsupported
  fact or explanation, syllabus mismatch, broken numerical, incomplete stimulus, unreadable presentation. One targeted repair at most; no routine human review.
* Gates corrected where the campaign showed over-rejection: "implied condition" had rejected 17 of 1,000 (mostly pronoun references in
  para jumbles and standard conventions); a chapter label that differs inside one syllabus unit rejected 13. Both are now precise
  (`text_reference`/`convention` do not block; `inferred_fact`, `implied_decisive`, `missing` block when a different reasonable choice changes the key; a same-unit relabel is accepted).
* New adversarial check: for each option the solver did not choose, state the strongest honest reading under which it is correct and
  classify it. This targets conditional answers and second defensible options.
* Time is derived (8 s + words/3.3 + 18 s per counted step). A model's step count undercounted a nine-operation 144-word item as five
  steps, so reading load above the longest authenticated non-passage PYQ (**132 words**; median 47, p95 116; n = 137) also fails.

## 3. CUET-fit findings on the existing approved bank (deterministic, authenticated-PYQ calibrated; no model call)
Files: `bank-cuet-fit-findings.json`, `bank-reading-load-flags.csv` (per-question flags for all 662).
* **Reading load:** 136 of 662 (20.5%) exceed the longest authenticated PYQ; median 99 words against 47. Matching items: 75 of 117 over, median 144 words. Case application: 31 of 97 over.
* **Format mix differs from CUET:** Business Studies PYQs are 62% direct identification or recall, the bank 25% conceptual plus 17% sequence plus 19% case. Economics PYQs are 46% direct recall, the bank has 15% numerical against 6%. Labels are the pipeline's strings mapped to families, so the comparison is approximate.
* **Difficulty labels:** model-labelled hard is 15% of the bank against 2% of PYQs; neither side is a measured item statistic.
* **Option-length cue:** the key is the strictly longest option in 26.4% of the bank (PYQs 18.1%; chance 25%); reading comprehension 46.9% (n = 32).
* These are fit risks, not correctness defects. They have not been shown to harm students and the 662 are unchanged. Withholding them is the owner's decision.
* A model-judged reassessment of the 662 under cuet-fit-v1.1 was **not run** (needs GPT-6 Luna; Gemini-only would repeat the leniency shown in §4).

## 4. Validator-topology study (frozen, preregistered; costs are receipts)
Preregistrations: `PREREGISTRATION-study-1.md`, `PREREGISTRATION-study-2.md`. Benchmark 1 (123 items, payload `6956d97a…`) and benchmark 2 (76 items, `f602ece2…`) are in `benchmark/`.
Study 1, contract v7.0, Luna and Gemini both measured:
| Topology | Valid survival (authored 22, PYQ 21) | Controlled defects approved (76) | Known audited defects approved (18) | Validation cost per candidate, realtime / batch-rate |
| --- | --- | --- | --- | --- |
| dual_blind | 18/22, 9/21 | 0 (95% upper bound 3.9%) | 4 | USD 0.0087 / 0.0043 |
| single_luna | 19/22, 9/21 | 0 (3.9%) | 4 (the same four) | USD 0.0018 / 0.0009 |
| single_gemini | 22/22, 12/21 | 0 (3.9%) | 8 refused by an OpenAI 429 mid-run, not valid | USD 0.0073 / 0.0037 |
Reading: the second validator caught nothing the single Luna validator missed on 94 defects, at about five times the cost. PYQ failures were
source-support and Luna-written-explanation failures (the anchors' excerpts do not entail the answers), not CUET-fit failures: the fit gate passed 20/21 (Luna) and 21/21 (Gemini) PYQs.
The four audited defects both topologies approved: two genuine conditional answers (a share-forfeiture stem that silently assumes no other instalment is unpaid; a forfeiture matching stem without the premium condition), one chapter-label difference and one AND/OR wording difference.
Study 2, contract v7.1, Gemini only (Luna unavailable): benchmark 2 valid 17/17; 0 of 50 clear fresh defects approved (95% upper bound 5.8%) — but a near-identical stem of the audited forfeiture conditional was approved (it is regression-derived and its pattern is named in the prompt, so it is not fresh evidence), 3 contested items were approved, and on the audited set Gemini approved 5 correctness defects plus the 2 contract-level ones. The same forfeiture defect was rejected in the audited stem and approved when one word of the stem differed, so the judgment is unstable at the margin. Gemini is lenient on source entailment (it solves from its own knowledge) and labelled the missing condition explicit. **Gemini alone is not adequate.**
Release: `single_gemini_full` is **paused** by the preregistered rule (6 regression false accepts). No topology has a Luna-measured v7.1 result, so **none is released**; `data/calibration_manifest.json` has no `cuet_fit_releases`; the v7 pipeline cannot publish.
What is supported: dual validation is not demonstrated necessary and costs about 5× more on this evidence; single Luna still approved 2 of 16 audited correctness defects under v7.0, so single Luna is not shown adequate either. The honest status is "unresolved until Luna measures v7.1".
Reported but not gating: 4–5 poor-fit items, rejected by 4 of 5 under Gemini (5 of 5 once the reading cap is applied, a post-hoc change disclosed in STATUS).

## 5. Failure patterns in the 1,000 retained candidates and what shipped
| Pattern (count) | Cause | Change |
| --- | --- | --- |
| 183+3 first-round failures were `option_label_prefix` (186 of 360 paid repairs) | authoring wrote "(A) …" in options; repair re-added it 21 times | deterministic label normalization before any paid check; authoring addendum |
| 62 `author_evidence_quote_not_in_sources` | 8 exact definitions under 25 characters, 4 exact spans joined by a line break, 4 with damaged extraction text where another quote is exact; the other 46 are cleaned or paraphrased text of damaged two-column extractions or not in the sources | tolerant verbatim classification (no paraphrase passes): 16 of the 62 would pass; the other 46 still reject; a validator still judges support |
| 41 OpenAI authoring requests rejected before inference | a schema bug (newlines in quote enums), fixed earlier | none needed; kept in denominators |
| 17 implied-condition + 13 chapter-label rejections | over-strict gates | contract changes in §2 |
| 4 Gemini batch failures held | batch service errors | realtime or single Luna removes the dependency |
| Credit exhaustion would have quarantined candidates permanently | a 429 refusal was stored as a permanent rejection and not treated as fatal | `credit_refused` is retryable, and credit exhaustion now stops the worker with candidates retained (tests added) |

## 6. Cost, usable count and the conditional 10,000 forecast
* Completed cohorts (900 candidates, all failures, repairs, reasoning and both validators): gross **USD 5.644987 for 662 approvals = USD 0.008527 per usable question**. Lifetime settled spend of USD 16.615 including every calibration and this session's study is USD 0.0251 per usable question; before this session it was USD 0.0194.
* Retained-contract conditional lifetime cost to 10,000 approvals: 16.753 + 9,338 × 0.008527 = **USD 96.4**. Under the authorized USD 50 ceiling, about 3,899 more approvals fit (4,561 in total). USD 60 and USD 70 are scenarios only.
* Scenarios built from the measured components (not measured end to end, and they assume the single-validator quality question resolves in its favour):
  S2 drop Gemini only: USD 0.00474 per usable, lifetime about **USD 61**. S3 S2 plus label repairs removed plus Luna validation at batch rates: USD 0.00319 per usable (same yield) or 0.00290 (yield 81%), lifetime **USD 44–47**. Whether a bank this cheap is also good enough is exactly what the unfinished measurement decides.
* Expect a new reading-load gate to reject about 20% of candidates under the baseline authoring prompt (matching items), unless the improved prompt shortens them.

## 7. Verification (logs in `verification/`)
Factory suite 353/353 (was 335; +18 new); recovery 39/39; question/payment/wallet/ticket 65/65; application-learning 84/84 when run serially (it showed 5 file-level timeouts when run concurrently with a live collector, a staging app and a production check, and passed each file alone); targeted lint clean on every new file (the repository-wide lint has 329 pre-existing errors in unrelated files); `next build` completes.
Staging: atomic group publication, idempotent replay, failed-group rollback and immediate dispute invalidation passed on the current schema; English quick and all four full-mock launches and submissions passed with new approved questions. The legacy `checkStagingApplication.mjs` passes its pause/resume steps but its last assertion still expects the original 100-job registry, so it is stale, not failing a gate. `checkFactoryRestart.mjs` kills the live worker and was deliberately not run; restart safety rests on the earlier controller restarts that retained all 2,452 accepted request IDs and on the new credit-retry test. Nothing was migrated in production.

## 8. Not done, and exactly why
1. Fixed 100-candidate batches A and B, the topology release, and the reassessment of the 662 approvals under a model judge: blocked by OpenAI credit (HTTP 429 `credit_balance_exhausted`, 16:21 UTC). No batch was started, so no yield or cost per usable under the new contract is claimed.
2. Cohort 010: 9 accepted authoring requests (5 of 9 complete at the provider) cannot be validated without Luna. The collector is retained; it now stops cleanly if it needs credit. Never resubmit.
3. Historical OpenAI 503 and four Gemini failure holds (USD 0.137930) need provider billing evidence; they stay committed.
4. Provider invoices unavailable. Student-AI and payments untouched.

## 9. Reproduce
See `RUNBOOK.md`. Core commands: `node --test scripts/pipeline/tests/cuetFitV7.test.mjs`; `node scripts/pipeline/tools/analyzeBankCuetFit.mjs`; `node scripts/pipeline/tools/analyzeCuetFitHistory.mjs`; `node --experimental-sqlite scripts/pipeline/tools/ledgerSummary.mjs --since "2026-10-07 15:30:00"`.
