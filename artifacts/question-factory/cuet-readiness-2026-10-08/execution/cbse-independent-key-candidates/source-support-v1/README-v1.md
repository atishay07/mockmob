# Source-support draft v1

This is a private, draft-only evidence layer for 64 CBSE sample-paper-derived candidates (16 each in Accountancy, Business Studies, Economics, and English Core). These are **not CUET PYQs**. The source families are eight official CBSE Class XII sample-paper families across 2025–26 and 2026–27; items within each paper are correlated.

The draft binds concise NCERT excerpts to page-map hashes/offsets and maps every item to the available official CUET UG 2026 syllabus. It does not establish 2027 syllabus entitlement, CUET fit/level/difficulty, answer uniqueness, or release readiness. Accountancy cases do not rely on the optional Unit V alternative. English answerability evidence is limited to the adapted candidate passage and requires independent key review.

## Coverage snapshot

- Denominator: 64; all items retained.
- Focused NCERT academic excerpt found: 37.
- English passage-bound cases pending key/answerability review: 15.
- Syllabus mapping: 58 explicit, 6 inferred.
- Source/legal gaps, partial support, wording/key disputes, and construction repairs are enumerated in `source-support-gap-register-v1.json`; none is treated as an academic rejection or removed from the denominator.
- Distractor explanations have not been checked claim by claim. Every rationale claim needs a separate source link or quarantine before freeze.

## Integrity and custody

- Candidate question inputs remain bound by the hashes in `source-support-draft-v1.json`; sealed gold/key files are not copied into this overlay.
- `validate_source_support_draft.py` verifies 64 unique IDs, question-view hashes, registered textbook PDF/extraction hashes, page-map hashes, quote offsets, English passage bindings, and syllabus-page quotations. Last run: **PASS, 0 integrity errors**.
- This subtask made no writes to `data/source_registry.json`; the bound hash is the shared working-tree snapshot, and Git status shows that file differs from HEAD. The scratch overlay is local and unapproved.
- CBSE PDFs are retained for private audit only; no redistribution license is claimed. NCERT use is limited to brief attributed local validation excerpts; no unrestricted republication claim is made.
- No model/provider calls, paid evaluation, pipeline changes, publication, or release decision occurred in this task.

## File hashes

- `source-support-draft-v1.json`: `067c35f7e5c05507133c69fcde417608361f278b2bea95d36838e5969363b156`
- `scratch-registry-overlay-draft-v1.json`: `5d37ee96eb67d8c2be8d82830c585cb8faeab47d6e7d2b15f6a1e40b21548c5d`
- `source-support-gap-register-v1.json`: `0b9c23123aa38eed713a927b23cb8fb9d7bf9e0c53df3f492966b1bbec7ee4da`
