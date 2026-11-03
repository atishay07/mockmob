# v75-fresh-cbse2022-2026-10-09: preregistration

Frozen 2026-10-09T00:00:00.000Z, before any v7.5 evaluation of these fixtures. Written under `V75-QUALIFICATION-PLAN.md` (9 October 2026) and the frozen contract `v75-contract-freeze.json` (frozen 2026-10-08T19:14:52Z, validator `cuet-fit-validator-v7.5`, contract `54e40f33b9b4c578e92d3ef4011f67ff43bae1c02124b253e1c58474f8a26644`). Nothing in this study may change any v7.5 prompt, deterministic check, threshold or category after dispatch (operating rule 13): a failure is reported, not tuned around.

## Source and provenance
The 16-item CBSE Class XII 2022-23 sample-paper packet (`questions-blinded-v1.json`, sha256 65a1679f4a85b4c3ecba64dbe034c0cb91b4f9b5852bbdbcbbe3d4d3a55b5905), built for v7.4 on 8 October 2026 and never sent to any validator. Provenance label: `source_keyed_non_cuet`. These are not authenticated CUET PYQs; fixtures carry `provenance.kind = original_practice`.

## Denominator (27 fixtures)
| Role | Count | Accountancy | Business Studies | Economics | English |
|---|---|---|---|---|---|
| Valid positives (`expected_valid: true`) | 13 | 4 | 3 | 4 | 2 |
| Natural defects (`multiple_correct`) | 2 | 0 | 1 | 0 | 1 |
| Seeded controlled defects | 12 | 3 | 3 | 3 | 3 |

Held and excluded: `v74-cbse22-en-q1-i` (`held_reference_conflict`: both derivations chose B on the adapted passage, the official key maps to C on the original passage). It is not a fixture; it stays in the raw 16 denominator and is never forced to a key.

Positives: the 13 items where two independent blind derivations and the official CBSE marking-scheme comparison agree. Natural defects: `bs-q03` and `en-q1-v`, where both reviewers found more than one defensible answer. Seeded defects: exactly 12, three per subject, each a single objectively verifiable change to a clone of one valid positive. Categories: wrong_key 3, multiple_correct 2, numerical_fault 1, unsupported_explanation 3, out_of_syllabus 2, missing_assumptions 1.

## Decision rule (unchanged `RELEASE_POLICY_V7`, `cuet-fit-release-v2`, topology `dual_blind`)
- Fresh false accepts: at most 0 (every expected-invalid fixture, natural or seeded, counts). Regression false accepts: at most 0.
- Valid survival at least 0.85 overall and at least 0.70 per subject, pooled over this set and the regression set. Abstention, provider error and quarantine all count against survival.
- Cost cap: USD 4 for both sets together, enforced by the persistent ledger (reserve before every call; failed or uncertain calls stay held at their maximum).
- No threshold, validator, prompt or category changes after dispatch. A defect label may not be reclassified after the result; a spent set becomes regression evidence.
- Pooled per-subject valid denominators with the regression positives: Accountancy 5, Business Studies 4, Economics 5, English 3. English therefore needs all 3 to clear the 0.70 floor.

## Disclosures
The constructor read the 16 items, the supplied teaching excerpts, both blind derivations and the official marking-scheme comparison before constructing the fixtures; v7.5 was frozen earlier and nothing in it was derived from these items. No validator or provider has seen any fixture. An authoritative-source search incidentally returned an official Accountancy 2022-23 marking-scheme snippet for non-selected question 34 on 8 October (`incidental-exposure-disclosure-v1.json`); selected questions 27-30 keys were opened only for the comparison after both derivations. Source families are correlated: the four English items share one 230-word stimulus and seeded defects share a root with their positive. A zero-false-accept result is a measurement on this sample, not proof of perfect accuracy. Fixture ids are opaque so that an id cannot reveal a control; the mapping to source items is in `independent-key-custody.json`. Full construction decisions are in `frozen.json` `construction_disclosure`. No generation, repair, publication, bank write or source-registry mutation is involved.
