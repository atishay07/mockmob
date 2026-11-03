# CBSE source-keyed candidate set — 8 October 2026

## Custody result

CBSE’s official Class XII 2026–27 SQP page currently provides both the question papers and marking schemes for Accountancy, Business Studies, Economics, and English Core. I downloaded the eight PDFs from `cbseacademic.nic.in` and checked their local SHA-256 hashes. A metadata-only scan of the known question-source registry found no CBSE Academic SQP/marking-scheme entries, so these are new source families relative to that registry.

The private candidate set contains **32 objective questions: 8 per requested subject**, drawn from four official CBSE sample-paper families, with a corresponding official marking scheme for each paper. `questions-blinded.json` stores the stems and printed options without answer labels; `answer-key-custody.json` records the official marking-scheme answers separately. The keys have not been independently rederived. Please keep the key sidecar and marking-scheme PDFs away from a blind reviewer until the reviewer has frozen their initial judgments.

These are **CBSE sample questions, not CUET PYQs**. The 32 questions share only four question-paper families and are correlated within subject, topic, case, or passage. They are candidate academic references for later blind review, not evidence of CUET readiness, difficulty calibration, acceptance rate, or release eligibility. Topic labels point to areas also named in the locally registered CUET 2026 syllabus; that mapping still needs independent review against the CUET-fit contract.

The English SQP’s two reading passages exceed the CUET 2026 English syllabus’s 300-word passage limit (417 and 333 words as labelled in the source). For the eight English items, `questions-blinded.json` uses short paraphrased passages (100 words each) and preserves the original selected question stems and option order. These adapted-stimulus items require blind answer rederivation. The official marking-scheme answer is retained only as a later comparison. One additional English question (SQP Q2-II) is excluded: the CBSE marking scheme says transaction-value growth exceeds transaction-volume growth, but the paper’s figures yield about 205% versus 294%, respectively. The arithmetic check and exclusion are recorded in the key custody file.

## Subject/topic coverage for later review

| Subject | Questions | Candidate topic families |
|---|---:|---|
| Accountancy | 8 | Company share capital/business purchase; partnership reconstitution; dissolution |
| Business Studies | 8 | Management and organisation; business environment; consumer protection; business finance |
| Economics | 8 | Government budget; money and banking; Balance of Payments/foreign exchange; IED employment |
| English Core | 8 | Factual-passage inference/tone/main idea; case-based passage purpose/data/inference; correct-word selection |

`source-manifest.json` gives the official page, source URLs, local paths, page counts, and hashes. The 2026–27 paper and key PDFs are retained as private source custody. Do not publish or redistribute the PDFs or complete question text. No provider call, product/pipeline change, benchmark freeze, publication, or release decision was made.

## Current CUET reference

These candidate topical labels were compared with the locally registered CUET UG 2026 syllabus. For English, that syllabus lists factual, narrative, and literary comprehension passages up to 300 words, plus verbal ability including choosing the correct word. The 2026 syllabus is only a current proxy until the CUET UG 2027 syllabus is released.
