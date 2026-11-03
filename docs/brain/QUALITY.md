# Automated quality contract

No routine human review. Correctness and exam fit are separate decisions. Valid easy
or direct-recall questions are not rejected for lacking traps or conceptual depth.
Owner clarification (6 October): sound 7–8/10 practice is acceptable when only craft is
weak. Aim for excellent PYQ-faithful Class XII practice; wrong/uncertain keys, ambiguity,
missing conditions, unsupported explanations, syllabus mismatch and unreadable format
still block. Quality scores and model agreement do not establish truth.

## CUET-fit contract (cuet-fit-v1.2, 8 October 2026)

This replaces the earlier arbitrary 1–10 "craft" rating. The judge asks whether a question genuinely belongs in CUET:
official syllabus entitlement, authentic format, PYQ-calibrated level, relevant learning objective, time suitability and
exam-preparation value. Authenticated CUET 2024 questions are the calibration, supplied to the judge as exemplars (never with keys).
An original practice question needs no past-paper counterpart and is never labelled a PYQ.

Mandatory gates (binary, unchanged in substance): independently solved key with the proposed key hidden; exactly one defensible answer;
no decisive assumption missing; source/stimulus support for every fact, rule and explanation claim; syllabus entitlement; correct
numerics; complete passage/data; readable presentation. Craft or CUET-fit can pass only after every gate passes. One targeted repair
and revalidation at most; uncertainty is quarantined, never published.

What changed in the gates and why (each tied to a measured failure on the 1,000-candidate campaign):
* A decisive assumption blocks only if it is a concluded fact (`inferred_fact`), merely suggested (`implied_decisive`) or `missing`
  AND a different reasonable choice changes the key. Cohesion/pronoun references in ordering items (`text_reference`) do not block.
  A claimed convention must cite the exact selected source evidence; a general definition or convention cannot supply a missing case-specific value.
* Each option the solver did not choose gets an adversarial "strongest honest reading" check; a reasonable or standard-convention
  reading under which it is correct blocks (conditional answers, second defensible options).
* A chapter label that differs from the validator's inside the same official syllabus unit is a relabel, not a rejection
  (13 of 1,000 candidates were rejected for this). A different unit, or a chapter not covered by the cited sources, still rejects.
* Style notes (wording, option length, obviousness) are recorded and never block. Only the eight mandatory defect categories block.

CUET-fit criteria, each an integer 0–3 against written anchors (`data/cuet_fit_rubric.mjs`): syllabus objective, format
authenticity, level calibration against the PYQ exemplars (direct recall at PYQ level scores 3: easy is not poor), time suitability
and discrimination value. The 8 s + reading words/3.3 + 18 s per counted reasoning step calculation is a heuristic estimate, not
measured candidate timing or an NTA rule. Authenticated PYQ reading lengths are summarized by matching subject and question format
where examples exist; thin or missing samples are explicitly reported. The historical 132-word maximum from a mixed sample is
descriptive and never a universal rejection boundary. Discrimination is scored but never blocks alone. Pass requires syllabus objective
≥ 2, format ≥ 2, level ≥ 1, estimated time ≥ 2 (≤ 150 s) and a derived overall ≥ 7/10. The overall is computed, never chosen by a model.

Validator topology is measured, not assumed: a topology publishes only with a measured release in `data/calibration_manifest.json`
(`cuet_fit_releases`) under the preregistered rule in `artifacts/question-factory/cuet-fit-2026-10-07/PREREGISTRATION-study-2.md`.
No v7 topology is released yet (see STATUS 7 October). The legacy v6.2 contract and its 662 published records are untouched.

Routes: deterministic numerical/rule families; source-grounded conceptual items;
passage groups with linked child evidence. A numerical solver alone does not establish
wording, assumptions or syllabus fit. Freeform paraphrases need new semantic checks.

Ordering items that repeat >=3 matched steps (equal quantities) in the same keyed order are one idea, whatever
their labels (inspection v4, 9 October; the small Para Jumbles stimulus pool was being reused).

v7.5 preparation-value checks (9 October, additive over v7.4, no correctness gate changed): every authored item must state one
official-syllabus learning objective, and free deterministic checks (`scripts/pipeline/lib/preparationValueV75.mjs`) then
block items whose answer does not need it: a lexical item that never uses its named target word, a non-English ordering item
solvable from linking words (This/That/Then/Following this), a stem that restates the keyed fact, and conspicuous absolute
distractors; printed-order keys and generic Economics arithmetic are cues only. A "hard" label with any finding, or fewer than
three reasoning steps, is overstated and quarantined (relabel, never raise); easy PYQ-level recall is never penalised and passage
information the item supplies is legitimate. The judge prompts score syllabus_objective and discrimination_value at most 1 for
wording-only or absolute-eliminable items and judge level from what the student must do. Campaign C and its diagnostics are
regression evidence, not v7.5 measurements; v7.5 quality is unmeasured until a fresh benchmark and release exist.
Order: schema -> duplicate/family checks -> source/solver evidence -> blind solution ->
alternative-answer challenge -> authenticated exam-pattern comparison -> publication.
Strong models author reusable specifications and families, not endless replacement batches.
Blind solvers cannot see generator answers/rationales. Citation existence is not entailment.
Manual seeds are never authentic PYQs. Keep extraction, permission, source and final-key versions.

Each content hash needs signed-by-process verification records, not client-supplied flags.
Only backend verification jobs may create records. Model agreement is not proof.
Missing checks, mock validators, stale hashes, blocked sources/families or contradictory
answers fail closed. States: draft, checked, eligible, published, quarantined.

## Cost
Absolute USD 50 lifetime content ceiling (owner, 4 Oct 2026; was $10). Reserve before calls,
reconcile actual usage, persist every request and block unresolved usage. No silent fallback
prices. Stop chapter after two zero-yield batches. One repair per candidate. Cache on content,
source and verifier versions. Track subscription/infrastructure separately.
SQLite ledger is for workers sharing one durable local filesystem; never run paid workers
on multiple machines or ephemeral serverless storage. Distributed dispatch stays disabled
until a shared transactional ledger is deployed. Do not delete/reset the ledger to resume.

## Calibration
Independent source/key fixtures separated by source/family into development and held-out sets.
Catch all known critical corruption fixtures. The shared strict-quality-v4 release
policy in data/question_factory_policy.mjs uses 85% overall valid survival, route
floors and 95% answered-key accuracy, with abstention reported separately. Historical
95% survival prose is superseded; no threshold changed in the 6 October final pass.
Previously observed/tuned fixtures are regression evidence, not an unseen benchmark.
Report sample sizes and per-category errors. Software-generated test fixtures are not
evidence of academic quality. Missing authoritative fixtures keeps publication disabled.

## Correction / rollback
Audit first; quarantine reversibly. Preserve snapshots/IDs. Changes invalidate checks.
Confirm corrections with new evidence, version them, recompute affected derived progress,
and notify affected users. Deployment rollback must never resurrect quarantined content.


V76 qualification retains mandatory independent keys, full-option uniqueness, decisive prerequisites, supported explanations, syllabus and numerical gates. Easy questions and supplied passage information are legitimate. Frozen V75 failures are regression evidence. The prospective compact fresh/regression studies require zero false accepts and unchanged 85% pooled/70% subject valid survival with every case and transport error in its denominator. Construction custody and passing software tests do not establish native qualification; see current STATUS and V76-QUALIFICATION-PLAN.md.


9 October 2026 IST local V77 milestone: independent option derivations plus existing explanation-stage audit of full exclusion claims, exact clause/source/identity bindings, and truthful nondecisive uncertainty. Root696factory tests pass. Structural binding is not semantic proof; V76 release still failed and V77 remains unqualified. See cuet-readiness-2026-10-09/execution/V77-LOCAL-CORRECTION-RESULT.md and immutable local freeze.


## 9 October 2026 IST — prospective V77 execution safeguards

V77 remains unqualified. Its local runner is frozen after independent counterexamples and 718 passing factory checks. Fresh/contested/boolean labels cannot be excluded from fixed-denominator release accounting; complete academic outcomes and settled receipts are separate requirements. Inspected sizing specimens are regression evidence only. See STATUS's latest V77 milestone and execution/V77-RUNNER-VERIFICATION-RESULT.md for current hashes, costs and exact blockers.


## 9 October 2026 IST — final V77 source-custody corrections before evaluation

Exact extraction identity alone does not establish a readable academic quotation: two-column streams can interleave unrelated clauses. Final decisive excerpts need coherent original reading order, headings that establish classifications, verified quote spans and enough premises for whole-option exclusions. Learning objectives sent to blind reviewers must name skills without providing answers or defect-audit cues. The official English list does not justify a universal grammar ban; the specific unsupported rule/objective mismatch is the defensible draft defect. All draft/exposure evidence is preserved; zero V77 native evaluations have occurred. See execution/v77-final-source-prep/ROOT-CONSTRUCTION-REVIEW-V1.md and latest STATUS checkpoint.


## 9 October 2026 IST — final benchmark explanations and actual input seam

A negative explanation control must actually assert its intended error; commentary saying an error is wrong does not instantiate the defect. Two constructor examples had this problem and were corrected before model evaluation, with drafts and exact changes retained. Independent final custody verifies16 positive explanations and12 decisive invalid candidates. Easy questions remain eligible when they test a meaningful entitled objective; linking words, source information and absolute phrasing alone are diagnostic, not automatic rejection.

Source quotation review and source-adapter eligibility are separate checks. Exact fact/support hashes and independent academic review passed, but the full adapter preflight exposed omitted extraction verification metadata. No native calls followed this failure; preserve existing incomplete registrations and supply verified additive metadata before execution. Original study labels, questions and mandatory gates remain unchanged.

## 9 October 2026 IST — actual V77 rejection diagnosis

The first four Accountancy controls quarantine at source_support despite matching independent keys. A representation error differs from an academic failure: exact source premises need not be repeated literally inside a separate explanatory context to remain anchored. Numeric facts printed inside an option may be hypothetical calculation inputs, never proof of the option's academic truth. Exact source quotes, complete clauses, independently derived keys and a separate semantic whole-option audit remain mandatory. Paraphrased or invented premise strings presented as exact quotations still fail binding. Source silence and category labels alone do not prove contradictions.

First cash-equivalent case has additional source caveats: supplied excerpt does not explicitly exclude equity shares and its maturity threshold is illustrative. These were not the terminal trigger, but they must remain in diagnosis rather than be erased by a formatting fix. Native fit scores9–10 do not compensate for failed mandatory checks. These inspected cases now support regression diagnosis only. Unexecuted explanation checks and unfinished cases are unknown, not passes or rejections. Frozen V77 cannot meet its Accountancy subject floor; study/accounting remain in progress.

## 9 October 2026 IST — final local correction and quality-report boundary

Submitted V77 accounting is now fully drained and settled (14/14,$0.084744,zero study hold). Fixed study remains incomplete: five valid quarantines,36 unfinished,zero controlled-defect terminal coverage. Formal assessor pending/incomplete and mathematical pass-rule failure are separate facts. Five controls' lower-of-two pre-gate fit mean9.2/10 is descriptive only; all failed mandatory source/matrix checks, so no publishable-item rating exists.21 parameter notes and per-case receipts are preserved in current reports.

The isolated final local proposal passes20 independent software tests, including explicit premise origins when source and stem/option text overlap, exact clause/whole-option audit binding, harmless line-wrap normalization, and fail-closed malformed inputs. Source and stem premises may be combined to apply a sourced rule; a printed option is a hypothetical arithmetic input and cannot prove its assertion. Source silence is not contradiction, an unresolved rival blocks uniqueness, and a nondecisive unresolved clause may coexist with a separately proved contradictory clause. Positive semantic audits in tests are synthetic; no model independence or truth claim follows. The proposal has no publication/runtime route. Any next integrated contract must retain all inherited mandatory gates, valid stem-only arithmetic and genuinely fresh qualification; current inspected evidence is regression only.

## 9 October 2026 IST — frozen V7.8 local correction, still unqualified

The tested correction is now additive V78 runtime code with explicit positional premise origins, whitespace-only anchoring and exact version/prompt/contract cache binding. Mandatory source/key/unique-answer/assumption/explanation/syllabus/numeric/boundary/passage gates remain, with existing preparation-value and21-parameter criteria. Full adapter tests cover both hidden independent blind inputs, their distinct frozen matrices, exactly one existing explanation audit, mandatory failures, numeric/passage failures, missing adapters and stale/missing/tampered cached evidence.742 factory/40 recovery/51 payment-question-budget tests and67-page build pass; all historical bindings and native export remain unchanged.

Five native V77 controls are inspected regression evidence only. A locally supplied origin projection confirms clean paraphrased contexts, exact source/stem mixtures and newline-only wrapping may bind; malformed shortened/ellipsis quotations remain blocked. It does not repair a model judgment, settle source caveats, relabel a frozen case or qualify V78. Synthetic audit fixtures cannot prove semantic entailment. Actual V78 release gates remainfalse and it has no native quality/yield/cost result. Ratings are permitted only after mandatory academic gates; five failed V77 controls'9.2/10 descriptive pre-gate mean is not publishable quality. No new paid study follows the failed final attempt without explicit new scope.

### Owner final-pass difficulty and cost requirements — 10 October 2026 IST

Easy means meaningful direct warm-up; Medium means normal CUET demand and is the primary NTA practice target; Hard means independently confirmed above-normal entitled reasoning for explicit Hard practice, with NTA fallback only after confirmed Easy/Medium shortage. Neither changed values nor length establishes a band. Difficulty never compensates for academic failure. The NTA UI is unchanged.

V713 is an additive unqualified draft. Its compact prompts retain source-supported factual explanation claims, unique independently solved keys, decisive assumptions, numerical correctness, syllabus entitlement and applicable option-refutation scope. Unsupported exclusivity is repaired in authoring, not exempted from truth checks. Historical inspected cases remain regression evidence. Under USD 100 per 10,000 publishable questions is an owner target, not a demonstrated cost; discounts require actual provider receipts and failed candidates remain in the denominator. No premium-quality or release claim follows local tests alone.

### 10 October 2026 IST — native V713 regression and additive V714 local correction

The sealed R3 native study cannot meet its unchanged survival rule: its first wave quarantined five of eighteen fresh valid controls, so at most 13/18 (72.22%) could survive, against required 16/18. First-wave six designated positives include one regression positive; four designated defect controls have actual multiple-answer or wrong-key defects. The formal all-case study is still running, and incomplete/error cases are not academic rejections. No V713 release exists.

Independent inspection confirmed a prompt-compaction regression. The whole inherited system was replaced without the canonical fit anchors or the separate option_challenges rule (exactly three non-chosen options). Luna emitted A/B/C challenge rows despite solving A, omitting D; its four-option resolution, source support, quoted evidence and unique-answer flags can all pass while the inherited challenge gate correctly fails. This is a schema-instruction failure, not proof that the question's sourced answer is wrong. Other ratings of zero with empty evidence reflect missing rubric guidance and cannot be averaged into a publishable quality claim. No first-wave explanation-support audit executed. The old-production-machine positive additionally retains an implied fixed-asset versus inventory prerequisite risk; its frozen wording/label/outcome is unchanged.

Unused additive V714 restores canonical 0-3 anchors, exact non-key challenge semantics, selected-evidence/convention field rules and useful underlying failure reasons. It preserves all inherited academic, source, unique-key, numeric, scope, independent-audit and difficulty gates, and never converts an old failure into a pass. Five new files are local only, unwired to publication, and require genuinely fresh qualification before release. Parent V713 and its frozen R3 dependencies are unchanged. Independent local reconstruction/import checks cover 222 planned body variants (maximum 32,554 bytes versus 33,024); this is structural regression evidence, not native V714 quality or cost evidence. Focused semantic/cache/false-accept checks remain in progress at this checkpoint. Draft V714 contract: ed0e4ae7fd56c045dd67c74e33686c2fcd1c0d25e640fc2e2f578fba4dfcf545.

V714 focused local verification is now17/17 green. Synthetic eligibility requires matching independent demand bands, exact current prompt/contract/version, both frozen matrices and a passing explanation audit; academic/source/assumption/numeric/ambiguity/stale-evidence failures remain closed. A create-only LOCAL-CONTRACT-FREEZE-V714.json preserves the tested draft. All118 V713 academic and8 R3 execution dependencies remain unchanged. No native V714 qualification, premium score, eligible yield, unit economics or publication follows these checks.

## 10 October 2026 IST — native final R3 failure is not a whole-bank quality score

Fixed37:36 source_support quarantines+1provider_output_incomplete error,0eligible;36 actual dual blind judgments,0 explanation audits. All77 accepted/retry request receipts settled, studyUSD0.263696 with0held. Collectorpaused/runnerincomplete; unchanged85% survival cannot pass. Several independently inspected sound controls were rejected for omitted non-chosen challenge/scoring semantics. Separately a literal line-hyphen excerpt binding defect and arithmetic source-kind mismatch were demonstrated; one expected-valid sparse/meticulous item is genuinely ambiguous. Do not relabel frozen evidence, count transport errors as academic rejections, treat early-gate quarantine as explanation sensitivity, or quote pre-gate craft scores as approved premium quality.

V714 local frozen correction17/17 software checks is unqualified. Five additive V715 draft files fix only exact printed-quote matching and source-kind instructions; targeted Luna review/body sizing is pending. No new native qualification/pilot/staging/publication or cost-per-approved demonstration follows. Owner reference screenshots confirm the need to admit useful straightforward practice; they provide neither authenticated PYQs nor a representative comparator sample. More checks do not establish better learning value; mandatory truth gates still precede craft ratings.

V715 local correction is now frozen after8 independent focused checks and222 adapter-body variants(max32811/33024). Contracte44f34f94187283d851db1d6b46d95615e02de089bcbc783d7a312344f77de9d, paidcalls0, unqualified/unreleased/runtimeunwired. See STATUS latest milestone for exact local-review/freeze artifacts and the incomplete failed native qualification; no new academic rating or approved-question unit-cost estimate is established.


## 10 October 2026 IST — owner-directed V716 report, score and route architecture

Owner corrected the design: strong source-backed authoring; independent validators report solutions, feedback and scores; a separate deterministic policy decides eligibility and mode routing. Academically sound 6–6.9 items may enter other practice; 7+ may enter NTA. Easy/Medium/Hard is independent, with Medium primary and Hard held from ordinary NTA unless complete Easy/Medium inventory is insufficient. This supersedes the previous >=7-for-all-practice craft rule only for the new V716 contract. It does not change any frozen prior benchmark rule, label, outcome or academic gate.

Nine additive V716 implementation files exist under scripts/pipeline/lib: contract, generationPrompt, scorecardPrompt, scorecardReview, scorecardPolicy, verify, practiceSelection, campaignSession and publicationBridge. The obsolete challenge-array/quote-template duplication is absent from this profile. Both blind solutions freeze before proposed keys/explanations are revealed. Reviewers give parameter feedback, not accept/reject commands. Twenty historical quality dimensions remain visible; only intrinsic learning objective, CUET style, time/load, clarity and distractor craft form the local composite. Verified truth and inapplicable features cannot inflate that score; overall opinion, difficulty and global novelty do not enter it. Global novelty is assessed separately through persistent allocation, shared inventory fingerprints and publish-time inspection.

Malformed/incomplete reports are review errors, not academic rejections. Valid-shaped wrong keys, nonunique answer sets or unresolved rivals block eligibility and avoid an unnecessary paid explanation call; no explanation pass is invented. Other otherwise-solvable items retain a separate explanation/source/option audit. No score rescues false facts, source-unsupported explanations, decisive missing inputs, ambiguity, syllabus violations or wrong numerical results.

The session reuses the existing lifetime/campaign guard, native Gemini batch and Luna Flex adapters, durable cache, accepted-ID receipt recovery and worker ownership. DNS/TLS preflight precedes writable accounting; exact current registration, prices, full request/retry bounds and conservative budget-stop possibilities are mandatory. No new runner has been started. Publication/retrieval are explicit versioned local/staging interfaces: current inventory and family holds, score-signature rechecking, 6/7 mode filtering, idempotent write receipts and whole passage groups. No default production writer exists. Existing live application APIs remain on their previous profile until a genuine V716 qualification and deliberate integration; merely adding these interfaces does not prove student-visible operation.

Latest verified native state remains terminal old R3: fixed37,36 early source_support quarantines+1 incomplete output error,0eligible,77 settled receipts,study USD0.263696 and0held. Global USD38.806144 settled+USD0.821324 uncertain historic holds=USD39.627468 committed,USD10.372532 remaining under unchanged USD50 ceiling;65 historic unresolved. No new paid V716 call, release, pilot, staging restart or production publication. Under USD100/10,000 approved and premium-quality scores remain unmeasured targets. Local focused Luna checks and integration review are running; freeze follows final review. Exact next: close demonstrated local defects, save independent checks and body sizes, freeze V716, then establish genuinely unseen independent qualification evidence under separately sealed current registration. Never reuse inspected old cases as fresh or automatically buy another benchmark.


## Final checked closure

Luna final verification: factory1038/1038;recovery40/40;payment/question/practice47/47;focusedscorecard19/19;session/guard8/8. Initial broad failure was a test-fixture omission of registry/prices in restart open; corrected by the test owner, then factory rerun green, without relaxing implementation gates. Final222synthetic request variants max26935/33024,paidcalls0. V713/V714/V715 frozen contract hashes unchanged. No test/factory/qualification process remains. V716 deliberately remains an unfrozen/unqualified draft pending positive publication/retrieval integration review and fresh independent native qualification. Currentdraftcontract48d1f62021153d34f8cdc33a96ad5a1dada206d7498242dd158ceddfa5b1889b;prompt628df899412096dee97bbf088d67dbfa4094035b1fba035776b95752e0e205c5. See VERIFICATION.json for exact artifacts and limits.
