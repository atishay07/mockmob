# CUET readiness benchmark custody audit — 8 October 2026

## Locked claims and limits

This inventory is an internal validation resource, not a release qualification. It contains 173 unique CUET UG 2024 question records with four-option forms, single final-key matches, and a match to the subject/chapter map in the saved 2026 CUET syllabus. They come from four independent exam-paper families: one Book-A paper each for English, Accountancy, Business Studies, and Economics. The 173 questions are not 173 independent source families, and no source-family-disjoint split can make an adequately representative fresh four-subject release set from these four papers.

95 anchors were already designated calibration exemplars in `data/source_registry.json`. They are exposed development/regression material and must never count as fresh evidence. The remaining 78 anchors were not so designated. A limited held-out evaluation contains only the 42 non-exemplar Business Studies and Economics anchors. It supports a small two-subject evaluation only; it does not qualify a four-subject release, establish uniform reliability, or support claims of perfect accuracy. The other 36 non-exemplar English and Accountancy anchors are reserved and are not assigned to that evaluation.

The held-out 42 include 15 records carrying the pack's `easy` difficulty label, but that label was not independently assessed in the source pack. The official exam source itself establishes authentic CUET use; it does not establish a calibrated item-difficulty rating. Difficulty tags are metadata only. Format variety includes direct recall, concept identification, matching, sequencing, statement selection and case application. No new authored defect controls are included in the held-out fixture: the current independent source access supports the keyed valid cases, while existing controlled-defect material was previously seen or carries author-set labels. Report false-accept performance as unmeasured by this bundle.

The proposed benchmark loader fixtures are frozen by the hashes in `SHA256SUMS.txt`. Any change to rubric, prompts, topology, or effort after this lock consumes the 42-case held-out set as regression evidence. Do not reclassify defects after observing results. A later four-subject release study needs new permitted question-paper families and official final keys.

## Academic and source evidence

For each valid case, the official NTA final OMR key is the answer oracle, matched against a separately held question-paper copy and its booklet/question locator. The corresponding official NTA 2026 subject syllabus is the entitlement boundary used for 2027 preparation. It is provisional for the 2027 examination. Every anchor chapter matches the repository's canonical 2026 subject/chapter map.

The question papers are held as mirrors from InfinityLearn, AglaSem, CareerGuide and corroborating copies; they are not NTA-hosted paper files. Pack records mark owner-attested internal reuse permission, but no independent reuse licence was verified. The NTA final key and official syllabus documents are from NTA. Benchmark use is internal; do not publish these stems/options or claim the mirrors grant republication rights.

The 2025 and 2026 NTA final-key PDFs are available locally but do not contain question text. NTA's public challenge notices state that the question papers with recorded responses were displayed to candidates through the challenge flow. The official 2026 notice explicitly instructs candidates to log in to view the question paper; no static, public official question-paper source for those years was available through the read-only public audit. Do not use login bypasses, candidate credentials, prep-site mirrors, or answer-key/question-ID guesswork to expand this benchmark.

## Assignment

| Partition | Included material | Permitted interpretation |
| --- | --- | --- |
| Existing development/regression | 95 previously designated calibration exemplars, distributed across four subjects | Regression only; already exposed, not fresh. |
| Limited held-out evaluation | 42 non-exemplar BS/Economics anchors; item and source locators are individually frozen | Limited evidence for two subjects. Report subject counts and exact denominators. No fresh defect controls. |
| Reserved | 36 non-exemplar English/Accountancy anchors | Keep sealed for a future study decision; do not use as fresh four-subject evidence in this run. |

Existing controlled-defect material from prior benchmark versions remains regression-only. New controlled mutations, if added, must be labeled `authored_control`, include the exact mutation and base-family ID, cite the official source supporting the underlying fact/key, and be reported separately from authentic-PYQ valid cases. Do not count a mutation as an independent question/source family. Do not pad the held-out set with option permutations or clones.

## Reproduction

Run `node artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/build-custody-inventory.mjs` to regenerate the non-content custody inventory and `node artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/build-source-keyed-fixtures.mjs` to reproduce the loader-shaped fixtures from the frozen source registry. The fixtures contain text and answer labels and are hashed in `SHA256SUMS.txt`. Keep the held-out fixture file out of prompts, exploratory model calls and tuning until the preregistered evaluation is ready. Providers must receive only the prompt/input allowed by the benchmark policy; never reveal keys to blind solvers.

The parent workflow must record every case, rejection, abstention and defect count in the denominator. The held-out sample is small: report counts and uncertainty, do not overstate a low error count.

## Official public-access audit

- NTA CUET 2025 documents/archive: <https://cuet.nta.nic.in/document-category/2025-archive/page/2/> (lists the final answer key and the provisional answer-key/question-paper challenge notice).
- NTA CUET 2025 challenge notice: <https://www.nta.ac.in/Download/Notice/Notice_20250617191216.pdf> (says papers with recorded responses were hosted for candidates to challenge).
- NTA CUET 2026 documents: <https://cuet.nta.nic.in/documents/> (lists the final answer key and challenge notice).
- NTA CUET 2026 challenge procedure: <https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/06/20260609478040431.pdf> (steps 2–4 require candidate login, then select “View Question Paper”).

These official notices establish that answer-key challenge papers exist and describe candidate access; they do not expose reusable static paper text for this audit.
