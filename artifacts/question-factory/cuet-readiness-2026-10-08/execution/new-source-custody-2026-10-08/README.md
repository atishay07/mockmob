# New CUET source custody audit — 8 October 2026

This read-only audit found **zero newly qualified question-paper/final-key families** for 2025 or 2026. NTA has public final-key PDFs for both years, but those files carry question identifiers and answers rather than the stems/options needed for source-keyed benchmark items. NTA’s 2025 and 2026 challenge procedures instruct candidates to log in, then use “View Question Paper” for marked/recorded responses. No public, static official question text was established.

The existing source-keyed custody is 173 authenticated CUET UG 2024 questions across four paper families: 30 English, 45 Accountancy, 48 Business Studies and 50 Economics. Of those, 95 are previously exposed calibration exemplars, 42 non-exemplars are limited held-out Business Studies/Economics cases, and 36 non-exemplars are reserved English/Accountancy cases. They are all from one paper family per subject. The question papers are mirrors; reuse permission is owner-attested internally, with no independent licence verified.

The registered source registry is version 58. It contains four 2024 paper/final-key pairs and four official 2026 syllabus entries, but no 2025/2026 paper/final-key source pair. The frozen v4 diagnostic benchmark remains unevaluated and small: 194 records across 45 correlated roots, with ten valid roots per subject. Its release partition remains sealed. I checked only the freeze, README, filename and SHA-256; I did not open `release-sealed/cases.json`. I also did not open the official 42-case held-out item bodies.

Third-party 2025/2026 paper copies are advertised by several sites, including AglaSem, Collegedunia, Oswaal 360, Shiksha and Prepp. These are leads only: no reuse permission was found in the current workspace, and I did not match their question IDs or option IDs against the official keys. Some 2026 pages explicitly label their material memory-based. None is counted as an authenticated family. Public availability by itself does not establish permission to retain or reuse the paper text.

NTA’s `/Downloads` page is indexed with “Previous years Exam Papers” filters and QP/AK columns, but the live read-only request during this audit returned the generic NTA homepage and exposed no paper rows or links. Treat it as an unresolved official retrieval route to revisit; it did not qualify any family here.

The official 2026 final-key PDF contains question IDs and correct option IDs, which could support exact authentication if a permitted paper copy is obtained. The 2025 final-key PDF similarly supplies the key side of a match. But the official keys alone cannot establish question wording, options, booklet ordering, or subject-family independence.

## Official source records

- [NTA CUET UG 2025 final answer keys](https://nta.ac.in/Download/Notice/Notice_20250701201050.pdf)
- [NTA CUET UG 2025 answer-key challenge notice](https://www.nta.ac.in/Download/Notice/Notice_20250617191216.pdf)
- [NTA CUET UG 2025 document archive](https://cuet.nta.nic.in/document-category/2025-archive/page/2/)
- [NTA CUET UG 2026 final answer keys](https://www.nta.ac.in/Download/Notice/Notice_20260621191633.pdf)
- [NTA CUET UG 2026 challenge-procedure notice](https://www.nta.ac.in/Download/Notice/Notice_20260609150917.pdf)
- [NTA CUET UG documents page](https://cuet.nta.nic.in/documents/)
- [NTA previous-year downloads route](https://www.nta.ac.in/Downloads)

## What would unblock fresh four-subject custody

Obtain NTA-published static question papers or candidate-authorized exports with paper provenance and permission to retain and use them internally. For a third-party mirror, first record written reuse permission, then authenticate each selected question against NTA’s exact question ID and correct option ID/number. Store exam date, shift, subject, booklet/sequence locator, mirror URL, file hash, permission scope and key corrections. Keep source-paper families disjoint across development, regression and release partitions.

The full machine-readable evidence, including exact hashes and candidate-source statuses, is in `audit.json`. No new paper text was acquired, no sealed item content was opened, and no provider or paid-model call was made.
