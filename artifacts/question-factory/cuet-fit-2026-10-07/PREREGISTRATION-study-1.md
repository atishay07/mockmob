# Preregistration — validator-topology study 1 (written 7 Oct 2026, before any paid validation of these items)

## Question
Does one blinded validator, plus deterministic/source checks and a separate explanation audit, give adequate measured reliability for CUET questions, compared with the retained two-validator design? Does the anchored CUET-fit rubric (cuet-fit-v1) reject genuinely poor fits without rejecting authentic CUET items?

## Benchmark (fresh, frozen before validation)
Built by `scripts/pipeline/tools/buildCuetFitBenchmark.mjs` from `cuetFitBenchmarkItems.mjs`:
* 22 authored valid items (answers established by the author from exact registered excerpts and explicit arithmetic, independent of every generator and validator model).
* 76 controlled defects derived from those items or written separately: wrong key (22), unsupported explanation (20), multiple correct options (12), broken numerical (7), missing decisive assumption (7), out-of-syllabus (8).
* 4 valid-but-poor-CUET-fit items (author judgment: 2 trivial, 1 multi-step overlong, 1 peripheral trivia). Reported separately from correctness defects.
* 21 authentic CUET 2024 PYQs with NTA final-key-matched answers, reserved calibration anchors excluded. Their explanations are written by the production explanation path before freezing.
The payload hash is recorded in `frozen.json` before the first validator call. These items have never appeared in any earlier benchmark, regression set or validator input; previously inspected examples are not used as fresh evidence.

## Topologies (all use the identical prompt, rubric, schema and exemplars)
* `dual_blind`: GPT-6 Luna (high) blind solve + Gemini 3.8 Flash blind solve + Luna explanation audit.
* `single_luna`: Luna blind solve + Luna explanation audit.
* `single_gemini`: Gemini blind solve + Luna explanation audit.
Generation and validation stay separate; the proposed key is never shown to a solver. Deterministic checks (structure, presentation lint, provenance, duplicate, exact-quote integrity, evidence-ID validity) run in every topology.

## Endpoints
1. Critical false accepts: controlled defects approved, per category and overall, with one-sided 95% Clopper–Pearson upper bounds.
2. Valid survival: authored valid items and authentic PYQs separately (PYQs also by failing stage).
3. Poor-fit items approved.
4. Gross cost per candidate validated, from provider usage receipts at realtime rates, and the same token usage re-priced at published batch rates.

## Decision rule (fixed in advance)
A topology may replace `dual_blind` only if (a) it approves no more controlled defects than `dual_blind` on the same items, (b) its valid survival (authored + PYQ) is at least 85% and not more than 5 points below `dual_blind`, and (c) release still requires zero critical false accepts. Among qualifying topologies the cheapest is chosen. If no topology reaches zero false accepts, none is released and the shortfall is reported; gates are not relaxed to reach a number.

## Interpretation limits
Small n: a zero-failure result on 76 defects still has an upper bound of about 3.9% (95%). Model agreement is not truth, an author-keyed benchmark is not an academic validation, ratings are not accuracy, and defects constructed by one author are not the defects a generator will make. Prompt or rubric changes made after seeing these results make this benchmark a regression set for the changed version, which is then measured again on a separately authored fresh set.

## Spending
Study cap USD 3.00 above the existing ledger, enforced by the harness; the persistent budget guard (USD 50 lifetime ceiling) is unchanged and every call, retry and failure is counted.
