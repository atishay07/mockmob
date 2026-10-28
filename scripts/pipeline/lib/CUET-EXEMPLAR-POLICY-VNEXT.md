# CUET exemplar policy VNext draft

This is a prospective adapter only. `cuetExemplarPolicyVNext.mjs` is not imported by v7, does not change a prompt or validator, and cannot create eligibility or publication evidence.

For `provenance.kind === "original_practice"`, global authenticated CUET examples are optional. If exact subject and format comparators exist, the adapter may supply up to the requested bounded count as key-free views; if none exist, it reports `no_matching_optional_comparators` and permits the question to continue through the other mandatory checks. The question remains original practice and must not be represented as a PYQ.

All non-original provenance remains strict. In particular, `authentic_pyq` and `pyq_adapted` must resolve an exact `anchor_id` to a registry example whose source kind is `authentic_pyq`, whose final key was matched, and whose paper options were independently checked in order. Subject and question type must match. Missing or mismatched anchors fail this adapter check. The key and key-source details are stripped from the returned exemplar view so an answer-blind solver cannot see them.

## Numeric route and format diagnostic

The helper treats a numeric route, a numeric question format, or an explicit calculation prompt with a numeric literal as sufficient to require numeric checks. It also reports route/format disagreements for repair or quarantine review; it never rewrites either field and it never rejects a question by itself.

Diagnostic only: the spent source-keyed v6 fixture at `artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-full-v6-source-keyed/frozen.json` contains 16 expected-valid Business Studies cases. Their metadata cross-tab is:

| Route | Format | Count |
|---|---|---:|
| conceptual | conceptual_mcq | 6 |
| conceptual | case_application | 1 |
| conceptual | matching | 1 |
| conceptual | statement_mcq | 3 |
| conceptual | ordering_mcq | 1 |
| conceptual | direct_recall | 1 |
| numerical | conceptual_mcq | 2 |
| numerical | case_application | 1 |

All three numerical-route cases use a nonnumeric format and contain no numeric literal. Under the existing `needsNumericChecks` behavior, the route still requests numeric validation. This is a metadata consistency issue to surface prospectively, not evidence to tune ratings, relabel the old cases, or claim new benchmark validity. The spent fixture's judge outcomes and quality scores were not used in this analysis.

## Contract binding before any future use

Do not edit `contractV7.mjs`, the v7 evidence/verifier files, production topology, active registry, or any frozen benchmark to install this behavior. Before a campaign uses this adapter:

1. Freeze a new verifier version and include both `CUET_EXEMPLAR_POLICY_VNEXT` and `CUET_NUMERIC_ROUTE_POLICY_VNEXT` in the canonical validation-contract object. Bind that object to the complete parent contract hash with `bindCuetExemplarContractVNext`; persist the resulting contract hash in every request profile and signed evidence record.
2. Include the exact example-selection behavior, key-stripping view, route/format diagnostic, and exemplar source version/hash in that binding. A change to any of them requires another verifier/contract version.
3. Freeze a new disjoint benchmark only after the binding and thresholds are locked. Previously seen fixtures, including the v6 route audit above, may be software regression fixtures only; they are not fresh calibration or release evidence.
4. Keep every existing mandatory validator, source/key check, uncertainty gate, and measured release requirement. This draft itself grants no release or publication claim.
