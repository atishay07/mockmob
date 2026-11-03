# Preregistration — validator study 2, contract cuet-fit-v1.1 / validator v7.1 (written 7 Oct 2026, before any v2 benchmark result was seen)

## Why a second study
Study 1 (v7.0) found: (a) 0 of 76 controlled defects approved by any topology, but 4 of 18 earlier-audited defects approved (two real conditional-answer misses, one chapter-label difference, one AND/OR wording difference); (b) model-estimated solve time put a nine-step calculation at 70–85 s; (c) `discrimination_value = 0` blocked two valid easy items on its own; (d) authentic PYQs failed on source support and on Luna-written explanations, not on CUET fit, so they cannot measure over-rejection by the fit rubric. The contract was changed (v1.1: derived time, non-blocking discrimination, `inferred_fact` status, adversarial per-option alternative-reading check). Study 1 items are therefore regression evidence for v7.1, not fresh evidence.

## Fresh benchmark 2
`scripts/pipeline/tools/cuetFitBenchmarkItemsV2.mjs`, 76 items, authored after reading study 1, never validated before freeze (`frozen-v2.json`, payload hash f602ece2…): 17 authored valid; 54 controlled defects (wrong key 17, second defensible option 10, plausible embedded unsupported claim 9, conditional answer 3, broken numerical 2, wrong explanation arithmetic 2, stem narrower than the textbook definition 1, a stem whose assumption contradicts the key 1, passage-unanswerable 1, out of syllabus 8); 5 supported but poor-CUET-fit items (author judgment). Three defects are labelled **contested** in advance because a textbook default or convention could legitimately supply the missing condition (`acc-collection-period:conditional_answer`, `eco-multiplier-assumption:conditional_answer`, `eco-capital-receipt:stem_wording`); they are measured and reported but are outside the primary false-accept denominator.

## Regression suite (tuned-on, not fresh)
The 24 study-1 regression-benchmark items and the 18 manually audited defects. Pre-registered classification of the audited defects: **contract-level disagreements** (not correctness defects under cuet-fit-v1.1): `e539e791…` (chapter label inside one syllabus unit) and `2681477c…` (stem says “and” where the textbook says “or”, answer unchanged). The other 16 are treated as correctness defects.

## Topologies (same prompt, schema, exemplars)
`dual_blind`, `single_luna`, `single_gemini`, `single_gemini_full` (Gemini also audits explanations). Generation stays GPT-6 Luna in every case.

## Release rule (fixed now; nothing relaxed afterwards)
A topology is released only if ALL hold: (1) 0 approved among the non-contested v2 defects; (2) 0 approved among the 12 regression-benchmark defects and among the 16 audited correctness defects; (3) valid survival ≥ 85% over v2 authored-valid plus regression valid items, with no subject below 70%; (4) the cuet-fit prompt hash and verifier version recorded in the release equal the code that will run. The cheapest qualifying topology is chosen. Poor-fit and contested outcomes are reported, never used to tune. If no topology qualifies, none is released.

## Interpretation limits
Zero observed false accepts among about 50 defects has a 95% upper bound of about 6%. The benchmark is author-keyed; defects built by one author are not the defects a generator makes; contested labels are judgment. Passing it does not establish perfect accuracy or uniformly premium quality.

## Spending
Study cap USD 3.0, enforced by the harness above the persistent ledger. OpenAI credit was exhausted at 16:21 UTC on 7 Oct (HTTP 429 `credit_balance_exhausted`); no Luna measurement of v7.1 exists until the owner adds credit. Gemini measurements proceed independently.
