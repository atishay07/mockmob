# v7.5 qualification plan (written before the benchmark is constructed)

Written 9 October 2026 by the coordinator before any v7.5 qualification fixture exists. The v7.5 contract must be frozen (`artifacts/question-factory/cuet-readiness-2026-10-09/v75-contract-freeze.json`) before this set is constructed. Nobody may change v7.5 prompts, deterministic checks or thresholds after construction starts; a failure is reported, not tuned around (operating rule 13).

## Fresh set: `v75-fresh-cbse2022-2026-10-09`

Roots: the 16-item CBSE Class XII 2022-23 sample-paper packet (`execution/v74-source-prep/acquisition-2022-23/questions-blinded-v1.json`). It was built for v7.4 on 8 October and has never been sent to any validator. Its construction predates v7.5, so v7.5 could not be tuned on it. Its provenance is `source_keyed_non_cuet`; it is not an authenticated CUET PYQ set.

- **Valid positives:** the 14 items where two independent blind derivations agree (`REFERENCE-ANSWER-CUSTODY-v1.json`). An item stays positive only if the official marking-scheme comparison also agrees. Disagreements are reported, retained and reclassified only under the rule written here: a marking-scheme disagreement makes that item `held_reference_conflict`, which is excluded from survival and counted in the denominator.
- **Natural defects:** `bs-q03` and `en-q1-v`. Both reviewers found more than one defensible answer. They are expected invalid, in category `multiple_correct`.
- **Controlled defects:** at least 2 per subject, root-linked, each with exactly one objectively verifiable defect. Together they must cover `wrong_key`, `multiple_correct` (overlapping options), `missing_assumptions`, `unsupported_explanation`, `out_of_syllabus` and `numerical_fault`.
- **Positive candidate fields:** each positive gets a student explanation and a `learning_objective`, both derived from the agreed derivations and the supplied excerpts. Neither is ever derived from validator output.

## Regression set

The existing v7.4 known-critical regression cases, re-evaluated under the v7.5 binding. They are regression evidence only (`previously_read`, `tuned_on`). Their accepted v7.4 request IDs and conservative holds stay untouched. v7.5 requests carry new v7.5-scoped keys, so no uncertain accepted key is resent.

## Preregistered decision rule (unchanged `RELEASE_POLICY_V7`, `cuet-fit-release-v2`)

- Topology `dual_blind`: Luna blind solve, Gemini independent evaluation, Luna explanation audit, plus deterministic checks, now including the v7.5 preparation-value checks.
- Fresh false accepts: at most 0. Regression false accepts: at most 0.
- Valid survival must be at least 0.85 overall and at least 0.70 per subject.
- Abstention and errors count against survival. No threshold, validator or category changes after dispatch.
- Cost cap: USD 4 for both sets. The persistent ledger reserves before every call, and failed or uncertain calls stay held at their maximum.

If the rule fails, no 40-candidate pilot is presented as publishable. A pilot may still be run as measurement only (`publication_policy=never`) if the failure diagnosis shows that it would produce useful evidence.
