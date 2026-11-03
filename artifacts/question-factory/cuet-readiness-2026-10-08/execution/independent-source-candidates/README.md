# Independent-source candidates — 8 October 2026

## Result

The public NTA route did not yield a new authenticated CUET UG 2025/2026 question-paper family. NTA publishes final-key PDFs, but those provide question identifiers and key numbers rather than the full stems/options. The 2026 and 2025 challenge instructions route candidates through login to “View Question Paper.” The official `/Downloads` route is indexed with year/exam/paper filters and QP/AK columns, but a live request to it redirects to the generic NTA home page and exposes no question-paper rows or filter results. No undocumented API was guessed or probed, and no login or candidate account was used.

I therefore assembled four limited, subject-specific NCERT source families for possible later calibration: one source chapter each for English, Accountancy, Business Studies, and Economics. The items in `candidate-items.json` are original, textbook-keyed examples; they are **not CUET PYQs**, do not have NTA question IDs or official final-key matches, and are not evidence of CUET difficulty, discrimination, or production readiness. Each family is a separate subject/chapter, but all use NCERT, so publisher and curriculum dependence remains. Four roots are far too few for a readiness claim.

## Candidate source families

| Subject | Source family and CUET 2026 topic | Source locator | Candidate count |
|---|---|---|---:|
| English | NCERT Flamingo, “The Last Lesson”; Reading Comprehension — literary passage | PDF page 4 (printed chapter page 3); 17-word source excerpt only | 1 |
| Accountancy | NCERT Company Accounts, “Accounting for Share Capital”; Unit IV — share capital | PDF page 4 (printed page 3) | 1 |
| Business Studies | NCERT Business Studies II, Chapter 9 “Financial Management”; Unit IX — Business Finance | PDF page 2 (printed page 216) | 1 |
| Economics | NCERT Introductory Microeconomics, Chapter 2 “Theory of Consumer Behaviour”; Course I — consumer behaviour | PDF page 2 | 1 |

This yields **4 candidate roots / 4 candidate items across 4 subjects**, not 150 fresh cases. The official 2026 syllabi match these topics. They are the latest locally registered CUET syllabus sources and are only a provisional proxy for CUET UG 2027 until NTA publishes that cycle’s syllabus.

## Integrity and rights

`source-manifest.json` records each official NCERT and NTA URL, local SHA-256, byte count, page count, syllabus locator, and reuse status. The downloaded PDFs are retained as local research evidence. NCERT ownership and redistribution permission were not independently established; keep these materials internal and obtain rights review before republishing source text. The English candidate embeds only a 17-word excerpt; the other candidates paraphrase or apply textbook definitions/formulae.

All item keys are supported by the cited NCERT source passage or formula. That establishes textbook correctness for these authored examples only; it does not establish official NTA key status or question quality. No sealed benchmark item bodies were opened, no provider calls were made, and no product/pipeline/benchmark fixtures or contracts were changed.

## Reproduce the source audit

The four NCERT chapter PDFs and four official CUET 2026 syllabus PDFs are in `sources/` and `syllabus/`. Recompute hashes with SHA-256 and compare them to `source-manifest.json`. NTA primary-source links and the retrieval result are listed in `source-manifest.json`.
