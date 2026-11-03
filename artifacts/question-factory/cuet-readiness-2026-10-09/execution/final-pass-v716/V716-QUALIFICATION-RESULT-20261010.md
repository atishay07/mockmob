# V716 fresh qualification — FAILED (10 October 2026 IST)

Study `qualification-fresh32b` (campaign `cuet-v716-qualification-fresh32b`). Frozen profile `cuet-fit-validator-v7.16-report-policy`:
- execution freeze `V716-FINAL-EXECUTION-FREEZE.json`, sha256 `d807498d6452914b2d932d52f20493c48ff72622d9aa99e9ab8dcff849b5138e` (99 files)
- contract `9957890e5f5d3426f11e927153b6ea10115c853301a88da7fa690d82e7e182da`
- scorecard prompt `0cd73e79c577e45ec92159d2f8e34ee898d5e5964642d22d778d1c0a77d3b740`
- generation prompt `77b963b303bb846e164f15f551cdd4843d28b2abe561b8e7e1b76141060df966`

Decision rule (preregistered, unchanged R3 thresholds): zero controlled defects eligible; expected-valid eligible ≥85% pooled and ≥70% in each subject; every case terminal; receipts complete. Publication: never.

## Result

| | Outcome |
|---|---|
| Controlled defects (12) | **12/12 rejected, 0 false accepts** |
| Expected-valid controls (20) | **16/20 eligible = 80%** (needs ≥85%) |
| Accountancy / Business Studies / Economics / English | 4/5 · **3/5 (60%, needs ≥70%)** · 4/5 · 5/5 |
| Terminal / review-incomplete | 32/32 / 0 |
| Cost | USD 0.192796 settled, 0 held, receipts complete (≈USD 0.006 per fully validated case) |

**Decision: failed.** No relabel, exclusion, repair, replacement or threshold change. The spent benchmark is now regression evidence.

Defect detection by class: wrong keys (4) were caught by both reviewers' independent keys. Multiple defensible answers (4) produced `uncertain` from both reviewers. The missing decisive input (1) and the passage-not-answerable item (1) were rejected at the key gate. False explanations (2) were caught by the explanation audit.

Eligible valid controls were all NTA band (composite 8.08–8.78). Both reviewers rated **all of them Easy**, including the 12 written as normal Medium CUET items.

## Diagnosis of the four valid misses

1. **A-V5 (Debentures, floating charge): justified rejection; benchmark construction error.** My explanation claimed "the debentures are not unsecured, because a charge has been created". The supplied excerpt says a floating charge may be created on unsecured debentures by default, so that claim is incorrect. Luna also questioned whether the fixed/floating charge distinction is in the supplied syllabus slice.
2. **E-V2 (legal tender): justified under the strict claim rule; construction error.** My explanation added "demand deposits have no intrinsic value", which the excerpt does not state (it says this of notes and coins). The audit also flagged "demand deposits are held in savings and current accounts". That is a legitimate inference from the excerpt, so the audit was slightly over-strict there.
3. **B-V3 (selection vs recruitment): justified under the strict claim rule; construction error.** My explanation said training and compensation "apply to employees after they join". The excerpt lists them as staffing functions but does not state their timing.
4. **B-V2 (elements of directing, a NOT stem): validator report self-contradiction.** Both reviewers solved B with `answer_set [B]`. Luna's per-option statuses marked the three listed elements `defensible` (statement truth) and B `not_answer`, the inverse of answer status for a negative stem. Local policy labelled this an academic rival (`academic_quarantine`); it is really an internally inconsistent review, the same class as V713's serialization failures.

So three misses come from benchmark construction (my valid-control explanations carried unsupported or incorrect claims, and the independent Haiku custody audit marked all three supported, so it was weaker than the V716 audit). One miss is a genuine validator-semantics failure. This does not rescue the study.

## What did work (evidence level: one fresh native study)

- Zero critical false accepts across all five defect classes, including explanation-only defects that need the audit.
- Every report was well formed; no review-incomplete outcomes; no transport or budget pause; receipts complete.
- The audit checks explanations claim by claim and is stricter than the independent custody audit.
- All 16 eligible real signed records persisted through the actual table shape. Signatures, content hashes and policy decisions all re-verified, and the only remaining blocker is the absent qualified release (`REAL-RECORD-PERSISTENCE-ROUNDTRIP.json`). This is software evidence, not publication.

## Not done, because qualification failed

No release record, 40-job pilot, staging restart or publication, active-profile switch, or cost-per-10,000-approved measurement. The pilot runner (`tools/runPilotV716.mjs`) and plan builder are ready. The authoring path was exercised natively on 3 jobs in diagnostic r2: 2 eligible, about USD 0.0067 per job all-in. That is too small a sample for a unit-cost claim.

## Proposed next correction (not implemented; needs owner decision and a new fresh benchmark)

1. Reviewer prompt: define each option's status as "defensible as the answer to the question as asked", with explicit NOT/EXCEPT handling, and require statuses to agree with `answer_set`.
2. Local policy: a report whose option statuses contradict its own `answer_set`/`solved_key` is review-incomplete (error), not an academic rival. Eligibility is unchanged (still not eligible); only the label is corrected.
3. Benchmark construction: valid-control explanations must make only excerpt-entailed claims, and the custody audit must apply the same claim-by-claim standard as the V716 audit.
4. Difficulty calibration: reviewers rate standard CUET items Easy (also seen in R3 and the diagnostics). Medium-first NTA selection would starve unless the review input carries authenticated exemplar anchors for Easy/Medium. This is a routing issue, not a truth issue.

The owner asked not to buy benchmark after benchmark, so no further paid qualification was started.
