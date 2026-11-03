# v7.4 source preparation (source-only)

No new question or answer-key content was acquired for this plan. The source URLs identify follow-up routes; the exclusion manifest blocks source families already represented in the repository and any documents accidentally surfaced during this URL-discovery pass.

## Preferred CUET acquisition after the corrected verifier is frozen

Start with the official NTA 2023 archive and final-key URL in `source-url-inventory.json`. The final-key PDF is only a source locator here; do not open it until every selected question has an immutable, independently derived answer and the complete source/question set is frozen. The official archive shows a question-paper/recorded-response route, but this preparation pass did not establish a reusable complete paper variant paired to that key. Verify the question ID, date, shift, subject, medium, booklet/order, and final-key row after freeze. A notice page by itself is not a question source.

Target 16 positive roots, four per subject, spread across at least two independently identified exam-date/shift families per subject. Add eight deterministic, root-linked controls, two per subject, for a 24-fixture measurement target. Suitable controls must preserve the same source root and make one objectively verifiable defect, such as a changed key, duplicate option, broken decisive condition, or a numerically incorrect value. Report every selected and excluded item in the denominator; no forced answer for ambiguous keys, multiple-key rows, dropped items, or mismatched variants.

For English adaptations, freeze the exact source excerpt and adaptation, keep adapted text at or below 300 words, and independently re-establish the answer from the adapted text and options. Do not carry the source question's answer across an edit without solving the edited item again.

## If official CUET paper/key pairing is unavailable

Use `https://cbseacademic.nic.in/sqp_archive.html` only to find a new Class XII sample-paper/marking-scheme year after a metadata-only collision check against `exclusion-manifest.json`. Label every such case `source_keyed_non_cuet`; it cannot support an authenticated-CUET-PYQ claim. No unseen CBSE year has been selected by this preparation pass. The known 2023-24 through 2026-27 CBSE families are excluded.

## Existing tools to reuse after freeze

`prepareFreshSourceReviewPacketV4.mjs` already enforces the frozen v7.3 binding and the answer-blind independent-review sequence for its fixed CBSE-2024-25 path; it is not configurable for this new source set and must not be repointed at a frozen cohort. `extractOfficialKeys.py` parses local NTA 2025/2026 final-key PDFs, but those entire key documents are excluded from this proposed set and must not be reused for it. `runOfficialCuetReadinessStudy.mjs` is a separate v7.2 route and is not the v7.4 runner. No new acquisition tool or audit report is justified until a new official source pair is selected after freeze.

Current readiness: source discovery only; no acquisition, independent answer derivation, official-key comparison, paid evaluation, or release is authorized by this artifact.
