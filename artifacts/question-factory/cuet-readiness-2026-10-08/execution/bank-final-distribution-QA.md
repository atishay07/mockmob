# Bank final distribution QA

Read-only analysis of the frozen 662-item A-campaign export. The staging withholding journal records 127 completed receipts and 127 completed staging-job updates. The 536 machine-eligible rows include one sibling withheld to keep its passage group closed, leaving 535 retained machine-eligible rows. This does not mean published or release-ready.

Export SHA-256: 70934506d98a7383db64f0bf26a86809e03978d29b1bff79c851f26c6002bccb

Withholding plan SHA-256: 17a0c7474a500937f30c04fff9dd435c33328932e01d27969dfe63497acca662

Withholding journal SHA-256: d29fcf502ef2f1dcff0819ef805555419a2844c8d0ba1750856b3c20aa1421de

## Distribution

| Subject | Export total | Machine eligible | Quarantined | Withheld | Retained |
|---|---:|---:|---:|---:|---:|
| accountancy | 141 | 105 | 36 | 36 | 105 |
| business_studies | 183 | 162 | 21 | 21 | 162 |
| economics | 165 | 112 | 53 | 53 | 112 |
| english | 173 | 157 | 16 | 17 | 156 |

Formats and difficulty labels describe retained rows only; difficulty is the stored metadata label.
- **accountancy:** difficulty {"easy":47,"hard":13,"medium":45}; formats {"case_application":18,"conceptual_mcq":22,"matching":19,"numerical_calculation":12,"sequence_ordering":13,"statement_selection":21}.
- **business_studies:** difficulty {"easy":60,"hard":25,"medium":77}; formats {"case_application":32,"conceptual_mcq":35,"matching":35,"sequence_ordering":30,"statement_selection":30}.
- **economics:** difficulty {"easy":46,"hard":19,"medium":47}; formats {"case_application":20,"conceptual_mcq":23,"matching":17,"numerical_calculation":21,"sequence_ordering":10,"statement_selection":21}.
- **english:** difficulty {"easy":66,"hard":15,"medium":75}; formats {"antonym":22,"correct_word_usage":24,"matching":27,"reading_comprehension":30,"sequence_ordering":20,"synonym":33}.

## Fit, syllabus, and presentation checks

Recorded CUET-fit scores among retained rows: {"7":16,"8":172,"9":314,"10":33}. Minimum 7/10 appears on 16 items. All 535/535 retained items have a saved syllabus entitlement and successful chapter-mapping check, across 49 subject/chapter labels. These are validator records, not a separate official-syllabus audit.

The 16 lowest-fit items mostly lose points for discrimination: 14/16 have a discrimination rating of 0 or 1. Saved notes describe direct definition matching, explicit distractor exclusions, repeated clues, or overt ordering cues. This is a CUET-fit weakness and does not itself establish a wrong answer.

## Duplicates, keys, and reading length

Across all 662 rows there are 0 exact content-hash duplicate groups, 0 normalized-stem duplicate groups, and 0 exact stem/options/key duplicate groups. Retained key positions: {"A":163,"B":129,"C":125,"D":118} (A/B/C/D). Invalid retained key/option counts: 0; saved key or explanation gate exceptions: 0.

The export has 32 English items with a separate passage. All 32 meet the 300-word provisional 2026 baseline; none exceed it, and the longest observed passage is 132 words. The 132-word maximum is specific to this export, not a universal cap.

The saved [NTA/CUET UG 2026 English syllabus PDF](https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2025/12/20251227980877010.pdf) states on PDF page 2: “Reading Comprehension: literary passages, maximum 300 words.” The project applies 300 words as the user's mandated provisional 2026 baseline for this passage QA. Saved local copy: `artifacts/question-factory/cuet-readiness-2026-10-08/execution/independent-source-candidates/syllabus/cuet-2026-english-syllabus.pdf`; SHA-256 `a4f55dadbd9a0111c72ec0cf74732bbe1e35ef4b71d0f49526a35bf8e9e1a41d`; 231,641 bytes; 2 pages.

## Bounded correctness review

I inspected the actual question, options, key, explanation, and saved source/key rationale for all 16 retained items with fit score 7. No clear wrong-key or unsupported-explanation defect emerged, so this bounded pass recommends no additional staging hold. Saved agreement/source-support checks are evidence of recorded checks, not proof of correctness; the other 519 retained rows did not receive this manual spot review.

The Consumer Protection item 69a5f5b276d3756e0bab00ed790efa2a rules out all listed complainant categories in options B–D, so those choices can be eliminated without applying the definition. The English “concise” item b64d12e2ab797dcdc203ce7264b19de9 supplies its target definition and contrasts it with conspicuously opposite options. Both have low-discrimination fit concerns; no clear key error was found in either.

Fresh B-campaign results are excluded because that campaign is incomplete. No provider calls, database reads/writes, question edits, eligibility changes, or publication writes were made for this QA.
