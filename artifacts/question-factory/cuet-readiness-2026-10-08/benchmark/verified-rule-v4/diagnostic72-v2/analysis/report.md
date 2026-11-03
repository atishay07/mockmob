# Diagnostic72-v2: independent saved-run analysis

Captured 2026-10-07T22:00:52.938Z. This is a read-only analysis of the completed, already-observed payload. It does not certify a release and does not make another provider call.

## Outcome and denominator

The full denominator remains **72 fixtures**: 40 valid roots and 32 controlled defects. The runner produced 72 topology rows, but the run is **incomplete**: 214 of 216 expected blind judgments were returned and two Gemini responses were incomplete. Topology states were 35 eligible, 36 quarantined, and one error. Within those rows, 35/40 valid items were eligible; among the 39 unambiguous valid roots, 34 were eligible. The 32 controls yielded 31 quarantine verdicts and one provider/topology error. There were zero controlled false accepts among the 31 resolved control verdicts, not 32/32 resolved defect judgments. No question was published.

Valid eligibility by subject: accountancy 10/10, business_studies 9/10, economics 6/10, english 10/10.

## Raw model judgments

The independent key record has 40/40 agreement with the authored proposed and oracle keys, but AC-05 remains contested on whether the excerpt establishes a positive sufficient condition. The key counts below are agreement with the previously recorded first-pass keys, not proof of truth. All three providers matched those recorded keys on 40/40 valid roots and abstained on none.

| Provider | Output | Valid first-pass key match | Valid abstain | CUET-fit pass | Mean fit score | Valid condition failures |
|---|---:|---:|---:|---:|---:|---:|
| GPT-6 Luna | 72 judged; 0 errors | 40/40 (100%) | 0 | 40/40 (100%) | 8.475/10 | 5 |
| Gemini Flash | 70 judged; 2 errors | 40/40 (100%) | 0 | 40/40 (100%) | 9.775/10 | 0 |
| Claude Haiku 5.5 | 72 judged; 0 errors | 40/40 (100%) | 0 | 26/40 (65%) | 7.725/10 | 9 |

Gemini returned 70 judgments and two `provider_output_incomplete` errors (`business_studies-BS-01-unsupported-explanation` and `business_studies-BS-06-unsupported-explanation`). The second error left the topology row unresolved; the first item was already quarantined by an earlier stage.

Wrong-key controls: each provider solved the source key on all eight and disagreed with the mutated proposed key. Numerical controls: each solved all four correctly. All three flagged all eight overlapping-option controls; Luna abstained on one, Gemini and Haiku on seven each. On the single missing-condition control, Luna and Haiku blocked it; Gemini selected D and did not block it. Gemini and Haiku flagged all three syllabus-mismatch fixtures; Luna flagged two directly.

The blind judgments do not see the proposed explanation, so unsupported-explanation detection belongs to the later explanation-support stage. The full topology quarantined seven of eight: five failed that stage, two were stopped at source-support first, and one failed with the provider error.

## Pairwise blind agreement

| Pair | Shared rows | Key agreement, all rows | Key agreement, valid roots | Condition-status agreement |
|---|---:|---:|---:|---:|
| openai + gemini | 70 | 63/70 | 40/40 | 57/70 |
| openai + anthropic | 72 | 64/72 | 40/40 | 61/72 |
| gemini + anthropic | 70 | 66/70 | 40/40 | 49/70 |

On the 40 valid roots, every pair selected the same key 40/40, while condition acceptability agreed only 35/40 for Luna/Gemini, 34/40 for Luna/Haiku and 31/40 for Gemini/Haiku. Across controls the key-agreement rates fell to 23/30, 24/32 and 26/30 respectively, largely because overlap cases elicited abstentions. Agreement is supporting evidence from correlated models, not academic ground truth.

The actual `dual_blind` fusion used Luna as primary, Gemini as secondary and Luna for explanation support. It did not use Haiku. Its 35 eligible results reflect the intersection of all required gates, not just key agreement.

## Why the five valid items were rejected

All five were stopped at `source_support`. Three show a likely false rejection under the contract’s distinction between a sourced academic rule and a missing case-specific fact: EC-04, EC-07 and EC-09. Their NCERT excerpts directly state the intended answer; Luna labelled the rule itself `inferred_fact` and failed the conditions gate. Gemini marked the corresponding rule as a cited convention. The current gate appears to conflate a source-supported principle with an unstated case assumption.

BS-10 and EC-05 have correct, syllabus-supported underlying content, but their stems refer to a “cited passage” or “the text” while `passage_text` is empty. The failure details explicitly identify the absent referenced text. That is a real completeness problem in the frozen wording, although rewriting the stem as direct subject recall would preserve the concept and fit CUET. These are not out-of-syllabus or wrong-key findings. Full source excerpts and clause analysis are in `report.json`.

The V7 release-evidence policy is 85% overall valid survival and 70% minimum per subject. The diagnostic measures 35/40 (87.5%) including the contested root and 34/39 (87.2%) among unambiguous primary roots, both numerically above the overall floor; Economics is 6/10 (60%), below the subject floor. The 95% figure is answered-key accuracy in factory calibration, not valid survival. These diagnostic measurements do not constitute a release assessment: the run is incomplete, diagnostic-only, and lacks the paired fresh/regression release evidence.

## Conditional-answer inconsistencies

The clearest inconsistency is EC-04/EC-07/EC-09: Luna marks a source-quoted definition/rule as an inferred fact, Gemini calls it a source-supported convention, and Haiku either accepts it or asks for the absent source. The tested conditional control AC-COND-CAPITAL-INTEREST shows a different split: Luna and Haiku detect missing deed/rate conditions; Gemini gives D and no blocker. AC-05 is the cautionary counterpart: all three call “deed mentions it” a convention, but the excerpt only says interest is not charged if the deed is silent. The positive converse is not explicit, so retain the earlier dispute. Haiku also flags missing guarantor details on AC-09 even though the item asks for the generic rule and the source supplies it.

## CUET-fit and retention

Raw valid-item CUET-fit pass counts were 40/40 for Luna (mean 8.475), 40/40 for Gemini (mean 9.775) and 26/40 for Haiku (mean 7.725). Luna/Gemini scores are anchored ratings, not truth. Haiku’s lower pass rate and nine valid condition failures signal that a Luna/Haiku fusion might quarantine more valid content; an end-to-end Haiku topology was not run, so no alternate eligible count is claimed. Against V7 release-evidence thresholds, the observed overall primary retention is 34/39 (87.2%), numerically above the 85% overall floor, while Economics is 6/10 (60%), below the 70% per-subject minimum. The 95% value is answered-key accuracy, not survival. This diagnostic does not establish a release pass: its provider judgments/topology are incomplete and it is not the required paired fresh-plus-regression evidence.

## Defect actions

| Controlled category | N | Quarantined | Error | Eligible | Topology reason counts |
|---|---:|---:|---:|---:|---|
| overlapping_options | 8 | 8 | 0 | 0 | option_collision 8 |
| unsupported_explanation | 8 | 7 | 1 | 0 | failed:explanation_support 5; failed:source_support 2; provider_output_incomplete 1 |
| wrong_key | 8 | 8 | 0 | 0 | blind_key_contradiction 6; failed:source_support 2 |
| missing_decisive_condition | 1 | 1 | 0 | 0 | failed:source_support 1 |
| syllabus_mismatch | 3 | 3 | 0 | 0 | failed:source_support 2; failed:syllabus_mapping 1 |
| numeric_error | 4 | 4 | 0 | 0 | blind_key_contradiction 4 |

This was a deliberately selected coverage set with correlated mutations; the zero false-accept observation cannot estimate a production false-accept rate. Some controls were stopped by an earlier gate, so rejection does not prove the targeted defect checker itself caught each one.

## Ledger cost

The read-only ledger scope `cuet-readiness-diagnostic72-v2:` contains 279 settled requests, complete receipts, $1.509084 settled, $0.000000 held. The $4.00 cap was not approached.

| Model | Requests | Input tokens | Output tokens | Settled cost |
|---|---:|---:|---:|---:|
| gpt-6-luna | 127 | 637,223 | 492,106 | $0.314802 |
| gemini-3.8-flash | 80 | 421,444 | 183,178 | $1.003032 |
| claude-haiku-5-5 | 72 | 796,292 | 223,174 | $0.191250 |

Saved pricing schemas were Luna $0.10/$0.50 per million input/output tokens, with cached input $0.01 and cache writes $0.125; Gemini Flash $0.75/$3.75; Haiku 5.5 $0.10/$0.50. Ledger receipts include reasoning tokens in provider-reported output usage and include incomplete responses and repeated requests. No provider invoice was present. Gemini’s first request per each of 72 candidates cost $0.833510; eight additional topology calls cost $0.169522. Haiku’s 72 raw judgments cost $0.191250. This is observed cost for these prompts, not a future topology cost forecast.

Haiku therefore showed a lower direct measurement-slot cost but no valid-key accuracy lift on this sample and a materially lower fit pass rate. Keep Luna and Gemini in the existing roles and Haiku measurement-only; this run does not justify adding Haiku to, or replacing a member of, the production topology.

## Limits and hashes

This payload has 40 valid roots (10 per subject), five release roots per subject, 45 roots across 72 rows, and source-family correlation (one NCERT partnership document for Accountancy and one staffing chapter for Business Studies). All results are now observed regression evidence. The 2026 NTA syllabus is provisional for 2027; solve time is heuristic rather than student timing. Independent key agreement does not establish CUET fit or source truth.

Frozen input hashes: frozen.json a4c8264ca35f12dd7ac3a99fb4cc982c3d1d520d77249dac6e398b71a973af9d; results.json cb6ff3e04b76e6ee93abf3f27d5155199874eadef58f0bbfefefd8e68f506388; summary.json 82267cd9f7bd454312e54c10b7beebc577b9e225b9c8a612f4eaa4414eb8a3e8; PREREGISTRATION.json 5247dafa03f01ca09dd232e678b03aaca49a8e291bd62b10180af04121ac4936. First-pass key record beff179bcb383a73b78bc1373e112e5517bf730bc325776a2cad1da23b174e13; key-audit report f165b602069a87ba550e929a6bbbea502468ac264af1c0c55ccdaa78e2c09323.
