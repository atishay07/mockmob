# Measured optimization findings — 2026-10-08

Read-only analysis of the finished 100-candidate A/B arms and the saved C100/v73 summaries. No provider calls, paid evaluations, registrations, frozen-input edits, or live-worker changes were made. Costs below are gross committed amounts (settled actual plus bounded holds) unless stated otherwise. Reasoning tokens are a subset of output tokens and are not added to cost a second time.

## Evidence boundary

- A/B disposition and exact-ID cost attribution: `execution/saved-readiness-cost-comparison.json`, generated 2026-10-08T10:53:21.316Z. The report’s source hashes point to each arm’s `batch-report.json`, `receipts.json`, `all-candidates.json`, and preregistration/profile files. Both arms reached 100/100 terminal candidates; baseline had 66 eligible, improved 70. Eligibility is the measured machine gate, not proof of truth or human verification.
- C100 batch snapshot: `artifacts/question-factory/cuet-readiness-cost-source-c-100-2026-10-08/batch-report.json` and its `receipts.json`. The first values read earlier in the live write window were an older report snapshot. The later synchronized snapshot and exact-ID SQLite query reconcile; the timestamp correction below supersedes that earlier interpretation.
- Fresh v73: `benchmark/fresh-official-source-v73-model/run/summary.json` reported `execution_finished:false` at 2026-10-08T12:06:34.486Z. Its 41-result output was not inspected. The pending proof is a completed run with reconciled receipts, after which all 41 results can be checked for controlled false accepts, source-support rejections inconsistent with the saved solver reasons, unsupported explanation claims, and benchmark-construction mistakes. Until then none of those outcomes is asserted.

## A/B measured cost and yield

| Arm | Terminal / eligible | Settled | Held | Gross | Gross / eligible | Conditional gross / 10,000 eligible |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 100 / 66 | $1.216368 | $0.011628 | $1.227996 | $0.018606 | $186.06 |
| Improved | 100 / 70 | $1.177385 | $0.164060 | $1.341445 | $0.0191635 | $191.63 |

The 10,000-item amounts are conditional cohort arithmetic at unchanged mix and yield, not forecasts, invoices, or spend authority. The lowest measured A/B unit cost is baseline at about 1.861 cents per machine-eligible item. At that rate, 70 machine-eligible items would cost about $1.30242 gross; the improved arm actually cost $1.341445 for 70. For 10,000 attempted items, the improved arm’s observed gross rate is about $134.14 and its observed yield was 70%; the corresponding eligible-item rate is about $191.63 per 10,000. These are still machine-eligible counts, not independently verified questions.

The main settled-cost stages were:

| Arm | Stage/provider/model | Requests | Settled | Held | Input / output / reasoning tokens |
|---|---|---:|---:|---:|---:|
| Baseline | Independent evaluation / Gemini 3.8 Flash | 76 | $0.695155 | $0 | 318,608 / 121,645 / 44,329 |
| Baseline | Blind solution / GPT-6 Luna | 183 | $0.290605 | $0.011628 | 824,648 / 856,626 / 715,526 |
| Baseline | Authoring / GPT-6 Luna | 129 | $0.169692 | $0 | 452,705 / 509,943 / 451,786 |
| Baseline | Repair / GPT-6 Luna | 53 | $0.033516 | $0 | 147,285 / 93,920 / 79,130 |
| Baseline | Explanation support / GPT-6 Luna | 81 | $0.027400 | $0 | 185,767 / 53,564 / 38,496 |
| Improved | Independent evaluation / Gemini 3.8 Flash | 82 | $0.731709 | $0.083286 | 354,546 / 124,205 / 37,090 |
| Improved | Blind solution / GPT-6 Luna | 161 | $0.251198 | $0.070146 | 756,366 / 788,882 / 661,077 |
| Improved | Authoring / GPT-6 Luna | 121 | $0.148837 | $0.010628 | 463,871 / 455,066 / 402,597 |
| Improved | Explanation support / GPT-6 Luna | 80 | $0.028165 | $0 | 198,242 / 61,753 / 45,543 |
| Improved | Repair / GPT-6 Luna | 34 | $0.017476 | $0 | 94,045 / 46,345 / 37,676 |

OpenAI receipts without attributable execution mode/usage are separately excluded from the stage token totals: 39 baseline and 16 improved requests. The report also counts 40 baseline and 26 improved provider-failure-or-unsettled requests. The 1 baseline and 10 improved unsettled requests account for the $0.011628 and $0.164060 holds; holds remain committed maxima, not settled charges. Improved holds are concentrated in Gemini evaluation ($0.083286), Luna blind solution ($0.070146), and authoring ($0.010628).

The A/B candidate failure-code counts are code occurrences and can overlap within an item. Baseline: 29 author-presentation option-label-prefix, 10 syllabus-mapping, 9 source-support, 4 duplicate lexical target, 4 option-label-prefix, 3 repair abstentions, 2 orphan passages, 1 numeric-solution, and 1 unresolved provider request. Improved: 9 unresolved provider requests, 7 source-support, 4 duplicate lexical target, 2 passage-group sibling, 2 orphan passage, 2 repair abstentions, 2 author-presentation prefix, 2 option-prefix, 2 syllabus-mapping, and 1 fetch failure.

No A/B disposition code explicitly records truncation. The normalized saved receipts have usage and request metadata but no response finish reason, so the artifacts cannot establish that no output was truncated. The saved cost report explicitly says non-repair-stage calls may include post-repair validation, with no persisted attempt identifier to split initial validation from revalidation. Repairs were directly attributed to 51 baseline items (51 attempts, $0.033516) and 34 improved items (34 attempts, $0.017476); do not label other validator costs as initial-only.

## C100 native Gemini versus realtime evidence

The refreshed C100 `batch-report.json` is timestamped 2026-10-08T11:59:36.482Z and records $0.383524 settled + $0.104110 held = $0.487634 gross across 219 requests. It is incomplete: 35 approved unique, 8 rejected, 57 pending, and 0 published. The 100 planned candidate identities remain fixed. The receipt export has 214 settled rows and 5 submitted rows; all five submitted holds are native Gemini evaluation reservations at $0.020822 each.

Within the reconciled exact-ID snapshot, the 42 Gemini 3.8 Flash **batch-mode** independent-evaluation receipts sum to $0.199393 settled, with 176,988 prompt, 43,424 candidate-output, and 27,512 thoughts tokens. That is $0.004747 per settled request. The five pending Gemini batch rows add $0.104110 held and are linked to provider batch `batches/mnv5w64olg6sj6grpxrilfa2vcqkhpv0f0pz`, whose five `provider_batches` records remain `submitted` without response records. For comparison, A/B **realtime** Gemini settled stage costs were $0.695155 / 76 = $0.009147 per request and $0.731709 / 82 = $0.008923 per request; the improved arm also has $0.083286 held. Native batch has a strong observed unit-cost signal, but the candidate mix and number of evaluations differ, and C is still incomplete. Do not extrapolate this signal to 10,000 items or use C's current yield as a final denominator.

The refreshed receipt export contains three true duplicate idempotency-key pairs. In each pair, one reservation ended with HTTP 429, `flex_unavailable` / `resource_unavailable` (`provider_http_429`), actual $0, and no `provider_requests` acceptance row; the receipt has a `req_...` error identity. The other has one completed provider request, a `resp_...` provider response ID, and settled usage. The three accepted responses are distinct: `resp_0681324f906f8cab016ac770e5258887d1b0fb94ba917d0f5f`, `resp_0cd65a83942c5ffa016ac770e56ae887d19865e5fafef03595`, and `resp_07a23a86b34c0404016ac77842e9f487d1887b930121f23248`. Their respective settled actuals are $0.002165, $0.001995, and $0.003702. These are pre-acceptance 429 attempts followed by accepted retries, not evidence of duplicate paid provider work. The five open Gemini batch rows have no per-request idempotency key yet; they are not duplicate-key rows.

The newest saved v73 summary is still running: $0.682743 settled + $0.019506 held = $0.702249 gross at 2026-10-08T12:12:02.009Z, with `execution_finished:false`, `receipt_complete:false`, `release_evidence_complete:false`, zero publication writes, and release false. No all-41 correctness analysis is ready from that snapshot.

## Ranked changes to measure

1. **Keep Gemini independent evaluation and test native batch transport with exact receipt reconciliation.** The C receipt rows show $0.199393 for 42 Gemini batch evaluations versus $0.695155 for 76 and $0.731709 for 82 realtime evaluations in A/B. Keep the same Gemini model, prompt, candidate identities, evaluation criteria, and blocking threshold; vary transport only. The refreshed C report, receipt export, and exact-ID SQLite snapshot now reconcile. For a causal cost comparison, pair the same candidate identities and compare settled usage, holds, missing outputs, and eligibility; the current C cohort is incomplete and differs in evaluated count.
2. **Prevent mechanical option-label failures before paid evaluation.** The baseline recorded 29 author-presentation label-prefix failures versus 2 in the improved arm, alongside 4 and 2 additional option-prefix failures. Add a deterministic, semantics-preserving normalization/check before downstream model stages when each label is unambiguous. Keep duplicate, syllabus, source, and key checks unchanged; ambiguous formatting remains quarantined. Measure avoided paid downstream calls and eligibility separately from the raw label-failure reduction.
3. **Reduce Luna blind-solver prompt and answer-token waste while keeping Luna and the blind-solve gate.** Blind solution is the next major spend after Gemini: $0.302233 baseline and $0.321344 improved gross including holds. Reasoning occupies about 83.5% and 83.8% of output tokens respectively, but is already included in output usage. First test a compact, source-bounded evidence packet and concise structured solver response; retain enough rationale to prove the decisive rule and assumptions. Compare key agreement, source support, token totals, and false accepts on fixed cases before changing the production prompt or token ceiling.
4. **Give every validation attempt an immutable attempt ID and revalidation cause.** A/B reports cannot distinguish initial evaluation from post-repair rechecks. Persist stage attempt number, parent repair ID, triggering failure, finish reason, provider request ID, and receipt status. This will expose duplicate validations, truncated outputs, retries, and the cost of rechecking repaired items without weakening the Luna/Gemini/explanation gates. Unknown provider outcomes stay held and are not resubmitted automatically.
5. **Keep explanation support.** It costs only $0.027400 baseline and $0.028165 improved, and remains a separate evidence gate. Improve its context packing only after the stage/attempt ledger can show a safe reduction; do not remove the gate to chase unit cost.

## Measurable target

Use **gross committed dollars per machine-eligible item** as the near-term cost metric, with settled and held amounts reported beside it. The measured 100-item band is $0.018606–$0.0191635 per eligible item ($186.06–$191.63 per 10,000 eligible at unchanged mix/yield). Report the verified-question metric separately only when an independent ground-truth audit denominator exists; current A/B eligibility alone does not establish verified truth. Keep every attempted candidate in the yield denominator and report error, hold, and repair costs rather than hiding them.

## Live-write timestamp and exact-ID correction (read at 12:13 UTC)

The earlier C100 values were read from an 11:54:30.972Z report snapshot while the worker was still writing. The files later advanced together: `batch-report.json` has `at=2026-10-08T11:59:36.482Z` and mtime `11:59:36.542Z`; `receipts.json` has mtime `11:59:36.541Z`. Each file's size, hash, and mtime were unchanged before and after the grouped read at 12:12:21Z. Their refreshed totals agree with a read-only SQLite transaction at 12:13:03Z matched against all 100 campaign job IDs: 219 exact scoped request rows, 214 settled ($0.383524), and 5 submitted ($0.104110 held), total $0.487634. This expected asynchronous snapshot progression corrects the earlier mismatch wording; it is not evidence of ledger corruption.

The five submitted rows map through native request config to the same provider batch ID above, stage `independent_evaluation`, mode `batch`, and five distinct campaign candidate IDs. They have no response JSON yet, so their $0.104110 remains held. The three repeated idempotency keys each have one zero-actual HTTP 429 attempt without a `provider_requests` row and one separate completed request with usage and the exact `resp_...` IDs listed above. Thus the export shows three retry pairs, not seven duplicate-key pairs and not duplicate accepted provider identities. The five rows lacking a receipt-level idempotency key are the pending batch requests.

The v73 summary was checked again at 12:12:02.009Z. It still reports `execution_finished:false` for denominator 41, so the frozen result set remains uninspected; full case-level correctness and benchmark-construction analysis is pending completion.

## Completed fresh v73 model run — fixed 22/19 denominators

The completed summary at `benchmark/fresh-official-source-v73-model/run/summary.json` is timestamped 2026-10-08T12:16:32.261Z for run `fresh-official-source-v73-2026-10-08-model`; it reports `execution_finished:true`, `receipt_complete:true`, and `release_evidence_complete:true`. The frozen input and `results.json` preserve 22 `expected_valid:true` roots and 19 `expected_valid:false` controls. The final topology has 12 eligible valid roots, 10 quarantined valid roots, all 19 controls quarantined, and `controlled_false_accepts:[]`. No registered label or denominator was changed. The run made zero publication writes and has `release:false`.

All three providers completed 41/41 judgments with zero provider errors, guard blocks, missing rows, or other outcomes. Anthropic/Claude Haiku remains comparison-only: its comparison denominator is the 22 valid roots, observed 22/22, with 19 source-supported unique-key matches and 22 CUET-fit passes. It was not substituted for the Luna/Gemini topology.

### Read-only exact-ID cost attribution

I matched ledger `requests.receipt_json.candidate_id` to the run ID prefix plus each of the 41 frozen fixture IDs, inside a read-only SQLite transaction. The 165 matched requests sum exactly to the completed summary’s $0.800698 settled, $0 held, and $0.800698 gross; no C100 or other nearby run requests are included.

| Provider/stage | Requests / fixture IDs | Settled | Held | Input / output / reasoning tokens |
|---|---:|---:|---:|---:|
| Gemini 3.8 Flash — independent evaluation | 44 / 41 | $0.443255 | $0 | 159,313 / 42,662 / 43,672 |
| GPT-6 Luna — blind solution | 60 / 41 | $0.227035 | $0 | 258,340 / 408,263 / 364,815 |
| Claude Haiku 5.5 — independent comparison | 41 / 41 | $0.104207 | $0 | 356,500 / 137,081 / 0 |
| GPT-6 Luna — explanation support | 20 / 20 | $0.026201 | $0 | 39,948 / 42,396 / 36,648 |
| **Total** | **165 requests** | **$0.800698** | **$0** | **814,101 / 630,402 / 445,135** |

Gemini evaluation is 55.4% of run spend, Luna blind solving plus explanation support is $0.253236, and Haiku comparison is 13.0%. There are 19 more Luna blind-solution request rows than fixture IDs and 3 more Gemini evaluation rows than fixture IDs; these are observed call counts, not classified as retries or revalidation because the result does not persist a reason for each repeated stage attempt. The $0.800698 / 12 = $0.066725 per machine-eligible result is only a suite-level ratio: it includes 19 deliberate controls and the Haiku comparison and must not be presented as production cost per verified question. Reasoning tokens are already a subset of output tokens.

### Positive key and control results by provider

| Provider | Correct frozen key on 22 valid roots | Abstained | Wrong non-abstaining key | Correct original key on 3 wrong-key controls |
|---|---:|---:|---:|---:|
| GPT-6 Luna / OpenAI | 21 | 1 (`cbse24-ac-q01`) | 0 | 3/3 |
| Gemini 3.8 Flash | 22 | 0 | 0 | 3/3 |
| Claude Haiku 5.5 | 20 | 2 (`cbse24-ac-q08`, `cbse24-eng-q04`) | 0 | 3/3 |

All three solvers chose the source key on each registered wrong-key control—`cbse24-eng-q01--wrong_key` (A rather than altered D), `cbse24-ac-q01--wrong_key` (B rather than altered A), and `cbse24-eco-q06--wrong_key` (B rather than altered A). No provider echoed the deliberately changed candidate key. The abstentions are not counted as key errors; they align with the genuine ambiguity noted below.

For the 19 controlled defects, the final Luna/Gemini topology caught all 19. Direct provider outputs had a nonempty `blocking_defects` array on 13/19 Luna rows, 11/19 Gemini rows, and 13/19 Haiku rows. A nonempty-blocker count is not itself a per-provider false-accept rate; the complete control catch result is the topology’s 0/19 false accepts. The category breakdown below counts control rows with any provider blocker, not whether the blocker text exactly named the registered defect:

| Fixed control category (count) | Luna | Gemini | Haiku |
|---|---:|---:|---:|
| Wrong key (3) | 0 | 0 | 1 |
| Overlapping options (3) | 3 | 3 | 3 |
| Missing assumption (1) | 1 | 1 | 1 |
| Missing settlement value (1) | 1 | 1 | 1 |
| Missing provision amount (1) | 1 | 0 | 1 |
| Numerical fault (2) | 2 | 2 | 2 |
| Explanation arithmetic (1) | 1 | 0 | 0 |
| Unsupported explanation (2) | 0 | 0 | 0 |
| Incomplete passage (1) | 1 | 1 | 1 |
| Missing decisive paragraph (1) | 1 | 1 | 1 |
| Passage unanswerable (1) | 1 | 1 | 1 |
| Boundary explanation (1) | 0 | 0 | 0 |
| Out of syllabus (1) | 1 | 1 | 1 |

The separate Luna explanation-support stage quarantined all three explanation controls despite the general evaluator blocker gaps: `cbse24-eng-q03--unsupported_explanation` adds an unsupported “82% of Class XII students check phones every hour” statistic; `cbse24-eco-q02--unsupported_explanation` adds an unsupported “18% in 2025” outcome; and `cbse24-eco-q07--boundary_explanation` incorrectly says MPC must be strictly below 1 although the cited excerpt includes both 0 and 1. This supports retaining explanation support as an independent required stage.

### Source-gate false rejections versus genuine uncertainty

Two registered positive roots are strong gate false-rejection cases. The OpenAI/Luna `checks.source_support` record has `passed:false` and `conditions_ok:false` only alongside the contradictory scalar `missing_assumptions:true`; it also has the correct frozen key, `source_support:true`, `single_defensible_answer:true`, `decisive_principle_in_excerpts:true`, `reference_quotes_valid:true`, `evidence_selection_valid:true`, and `blocking_defects:[]`. Its own `answer_conditions[]` contains no `status:"missing"`, and the other two providers agree on key and source support.

- `cbse24-ac-q04`: frozen key A. The source check derives that the ₹20,000 provision covers the ₹15,000 bad debt and leaves ₹5,000, then states the two journal entries for A match the cited rule and example. Conditions are `explicit`, `explicit`, `inferred_fact`, `convention`, `explicit`; none is missing. Evidence IDs E1.1/E2.1 point to `fresh-v73-cbse24-ac-q04-excerpt-1` (hash `b720f75957194282cfc33100847bf0030c92ca611af5b8accda5943064cf5128`) and `...excerpt-2` (hash `a9913e93ac3763bb99607b204c96a7069f882a7c5a5ab314eaeed5f7d97c09a2`). Luna, Gemini, and Haiku all solve A and report source support true.
- `cbse24-bs-q03`: frozen key C. The source check says E1.1 supports the financial-planning uncertainty statement, E2.1 supports the capital-structure definition, and both are true while R does not explain A. Conditions are `convention`, `convention`, `inferred_fact`; none is missing. All three providers solve C, report source support true, and list no blocking defect. Evidence refs are `fresh-v73-cbse24-bs-q03-excerpt-1` (hash `a6b590c3097713c923878b0d71cb7dc98d2f0bb07016cda0885bf58852a46867`) and `...excerpt-2` (hash `623f088eb0dbeb45400715bd08ab24470bc147640f5849caaa76dd95099a22ef`).

These cases point to a contract-consistency defect between the free boolean `missing_assumptions` and the typed `answer_conditions[]` / `conditions_ok` fields. Do not relabel or publish them post hoc; use the unchanged frozen results as regression evidence for a versioned predicate correction.

Two other source-stage rejections are not equivalent false positives and should stay quarantined. `cbse24-ac-q01` has an explicitly `missing` answer-changing condition—whether Anthony’s loss share counts as negative profit under the minimum guarantee—and option A is recorded as `reasonable_unstated`; its likely key B is not uniquely supported. `cbse24-ac-q08` has a genuine source gap: the excerpts show an asset taken over by a partner and partner loans paid in cash, but do not establish the entry when a partner’s asset settles a loan worth more than the asset’s book value. Haiku abstains and lists `missing_decisive_assumption` and `unsupported_fact_or_explanation`; the case must remain quarantined.

`cbse24-eng-q08` is a separate mapping-disagreement candidate, not a key error: all three solve D, all report `syllabus_entitlement:true` and `exam_fit:true`, and the stage has `source_mapped:true` with `covered:["Literary Passage"]`. It still fails `chapter_mapping.ok` because the frozen candidate chapter is `Literary Passage` while provider `syllabus_chapter` values are `Vocabulary`, `Literary Passage`, and `Vocabulary`. Keep the label frozen; decide the canonical English mapping from the official syllabus source before changing future mapping logic.

### Real explanation defects in positive-key roots

All five valid-key roots rejected at explanation support have correct keys; these are explanation gate failures, not false rejections of the underlying questions. The stage records specific unsupported claims and citations:

| Case | Exact unsupported claim / stage finding | Saved source references |
|---|---|---|
| `cbse24-bs-q05` | The distractor explanation claims the listed recruitment limitations establish increased security for existing employees; the excerpt supports dissatisfaction and reduced promotion prospects, not that inference. | `fresh-v73-cbse24-bs-q05-excerpt-1`, `...excerpt-2` |
| `cbse24-bs-q06` | “The technological-environment definition spans columns on physical page 8.” This is construction/layout metadata copied into the student explanation; the three source excerpts support the concept but not that physical-layout claim. | `fresh-v73-cbse24-bs-q06-excerpt-1`, `...excerpt-2`, `...excerpt-3` |
| `cbse24-bs-q07` | “Asserting oneself to obtain a fair deal is a separate consumer responsibility.” That extra responsibility is not supported by the cited quality-mark excerpt. | `fresh-v73-cbse24-bs-q07-excerpt-1` |
| `cbse24-eco-q03` | Three added claims about net production taxes and factor-cost/basic-price conversion exceed the single cited product-tax excerpt. | `fresh-v73-cbse24-eco-q03-excerpt-1` |
| `cbse24-eco-q06` | Added formulas for revenue deficit and primary deficit are not established by the cited fiscal-deficit excerpt or supplied values. | `fresh-v73-cbse24-eco-q06-excerpt-1` |

The BS6 page/column sentence is especially actionable: page/column locator data belongs in provenance metadata, never in the student-facing explanation. The other four failures show why distractor rebuttals and adjacent definitions should be included only when the item’s evidence pack supports them.

### Top two versioned changes to measure

1. **Make source-support predicates internally consistent and preserve conservative handling of real gaps.** Derive the missing-assumption gate from typed answer-condition statuses and named blocking defects, or fail closed under an explicit `validator_output_conflict` reason when the fields disagree; do not let an unbacked boolean silently overturn a fully resolved condition list. Add a canonical syllabus alias map only after checking the official mapping for the English vocabulary-in-passage case. Regression evidence: `cbse24-ac-q04` and `cbse24-bs-q03` for the contradictory flag; `cbse24-ac-q01` and `cbse24-ac-q08` must continue quarantining; `cbse24-eng-q08` stays held until the canonical source mapping is evidenced.
2. **Separate explanation prose from source-layout metadata and bind every factual distractor claim to cited support.** Keep page, column, crop, and extraction details in `source_refs`/locator fields, not `candidate.explanation`; omit distractor claims based only on absence of evidence unless the source pack establishes the correction. Keep the Luna explanation-support stage and its existing blocking behavior. Regression evidence: the five positive-key explanation failures above plus all three registered explanation controls; do not alter their frozen text or labels.

The highest v73 spend is Gemini independent evaluation at $0.443255, so a future cost experiment should retain Gemini and Luna gates while varying transport or prompt packing under exact per-ID accounting. This completed run used realtime Gemini; it does not measure a transport change. Haiku remains comparison-only, and none of these diagnostic results alone establishes a verified-question production cost or a release.

## Root-cause correction: AC04 / BS03 source-support holds (2026-10-08, post-completion)
The earlier completed-run note called these cases a contradiction between a positive solver derivation and scalar `missing_assumptions` / `conditions_ok` fields. That diagnosis was materially inaccurate: `factoryEvidenceV73.interpretEvaluation` computes both flags from the same deterministic `conditionVerdict(...)` result. It sets `missing_assumptions: !conditions.ok` and `conditions_ok: conditions.ok`; there is no independent model boolean overriding the condition list. The model did return `source_support:true` and positive reasons, but it simultaneously emitted key-changing `inferred_fact` conditions, which the current contract intentionally blocks. The deterministic interpretation is consistent with its current status taxonomy. This is therefore a prompt/schema classification and contract-semantics issue to assess prospectively, not an interpretation implementation bug or scalar-field inconsistency. Frozen results and labels remain unchanged.

- `cbse24-ac-q04` (Luna/OpenAI; key A): selected evidence IDs are `E1.1`, `E2.1`. Its condition `"The provision covers the full write-off, leaving ₹5,000 of provision."` is marked `inferred_fact`, `alters_key_if_changed:true`, no convention IDs. `conditionVerdict` blocks exactly this status (`BLOCKING_CONDITION_STATUSES` is `inferred_fact`, `implied_decisive`, `missing`), thus both `conditions_ok:false` and `missing_assumptions:true`. But this is a determinate arithmetic consequence of the stem’s explicit ₹20,000 provision and ₹15,000 bad debt, under the cited provision-adjustment rule, not an unstated case-specific amount/status. The solver reasons explicitly calculate the ₹5,000 remainder and cite `E1.1`/`E2.1`; the options and frozen explanation align. This is an overbroad `inferred_fact` classification for a derivation, not evidence of a genuinely missing assumption. Gemini and Haiku avoid the classification by representing the applicable accounting rules as supported conventions and pass the condition gate.
- `cbse24-bs-q03` (Luna/OpenAI; key C): selected IDs `E1.1`, `E2.1`. The solver marks `"The capital-structure definition does not explain the stated benefit of financial planning."` as `inferred_fact`, `alters_key_if_changed:true`, no convention IDs. This is the requested Assertion–Reason relation, derived by comparing the two source-supported statements; it is not a hidden case fact such as an absent value, timing, or status. `conditionVerdict` blocks it by status, producing the same paired flags. The saved reasons explicitly say E1.1 supports the assertion and E2.1 the definition, then derive C. Thus the outcome reflects a mismatch between the broad `inferred_fact` bucket and a supported reasoning conclusion; it does not show a missing source assumption. Gemini and Haiku describe the same supported propositions without a blocking inferred-fact condition.

Smallest safe prospective correction: refine the validator contract so a `key-changing derivation from explicit stem values or selected source evidence` has a separate, nonblocking status (with traceable input/evidence references), while `inferred_fact` remains blocking for key-changing case-specific facts that are concluded but not stated or established. Keep `implied_decisive` and `missing` blocking; keep the existing explicit missing-value controls (including AC01/AC08 and registered missing-provision controls) as required regressions. A versioned prompt/schema change should measure whether providers consistently distinguish (a) arithmetic/source-supported derivations, (b) ordinary semantic reasoning such as the BS03 explanation relation, and (c) genuinely unprovided assumptions before any gate behavior changes. Do not loosen the current gate by trusting `source_support:true`, `reasons`, or `missing_assumptions:false` alone, and do not change this frozen cohort’s labels/results.
