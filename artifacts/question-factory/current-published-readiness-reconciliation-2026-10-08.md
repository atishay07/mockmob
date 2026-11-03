# Published-bank and current-readiness reconciliation

Read-only local-artifact reconciliation for the counts 665, 662, 575, and 535. No database, provider, publication, or ledger action was performed.

## Count reconciliation

- **662 distinct historical bank IDs:** the 001–009 native cohorts are `execution-2026-10-07` (50) plus `cost-native-cohort-002` through `009` (53, 72, 79, 71, 88, 78, 84, 87). Their saved `approved.json` files contain 662 rows and 662 distinct IDs, with no repeated IDs across these files. Cohort 010 is outside this historical publication set.
- **662 actually verified as published/retrievable:** the saved historical production/staging retrieval evidence verifies all 662 expected IDs, including the later 662/662 proof in `artifacts/question-factory/continuation-500/staging-retrieval.json`. The older production summaries contain per-cohort receipt arrays (some passage-level, so receipt-array length is not an item count); their `newly_inserted`/`previously_published` totals account for 662. The current staging status snapshot independently records 662 legacy IDs present and retrieved, with no missing IDs.
- **575 is an earlier dated production checkpoint, not a conflicting denominator.** The signed production retrieval in `docs/brain/STATUS.md` (14:12 UTC, 7 Oct) checked 575 newly approved IDs. The later 87-item cohort 009 publication raised the historical cohort total from 575 to 662; 575 + 87 = 662.
- **535 is the retained legacy student-feed count after reassessment withholding.** The completed 662-item v7.2 reassessment had 536 provisional eligible rows and 126 quarantined rows; atomic passage closure withheld one otherwise eligible sibling, giving 127 withheld and 535 retained/retrieved (662 − 127). The saved staging proof records 535/535 retained IDs, zero of the 127 withheld IDs served, and zero newly published v7 items.
- **665 is not supported by the local evidence reviewed.** The most recent saved staging inventory is 666 raw publication rows: 662 legacy-bank rows plus four additional publications outside the legacy ID set. It reports 662 usable factory publications. I found no saved report establishing 665 as distinct published IDs. Treat 665 as unverified unless a newer independent production snapshot establishes its denominator and scope.

## Current CUET-readiness status

The 535 available items are legacy retained inventory, not current-release-qualified questions. The 662-item reassessment is explicitly `cuet-fit-validator-v7.2`, says `publication: never`, and is not a release record. `data/calibration_manifest.json` is a legacy `cuet-llm-v3` / `luna-gemini-cuET-v6.2` release record; it does not establish a v7.3 or v7.4 release. The current v7 staging proof says `current_v7_release: false`, newly published `0`, and release requests were refused with `current_cuet_calibration_required`. Thus **the current qualified/released v7.3+ count evidenced here is zero**. The saved 536 provisional passes and the 535 retained feed count must not be reported as current CUET qualification.

The three current measured-campaign approved extracts reviewed were baseline (66), improved (70), and cost-source-C (53): **189 approved rows, 189 distinct IDs, zero ID overlap with one another or the 662-item historical bank, and no publication evidence.** Normalized exact comparisons across stem, options, key, explanation, passage and subject/chapter metadata found zero exact content duplicates within these three extracts or against the historical bank. This limited exact-duplicate check does not establish semantic novelty or CUET correctness. No cross-campaign count is summed into the published bank.

The staging proof is an actual legacy retrieval check, not an academic-quality study: 535 retained legacy questions were delivered after the withholding run; no current v7 question was published. No local evidence here supports saying that the existing bank as a whole meets the current CUET-fit contract. Current qualification remains blocked on a released current-version measured manifest and its gates.

## Evidence and hashes

- `artifacts/question-factory/cuet-readiness-2026-10-08/execution/reassessment/snapshot-20261008T060712941Z/summary.json`: complete, terminal 662/662, eligible 536, quarantined 126, pending 0; withholding plan would withhold 127 with atomic passage groups. SHA-256 `2420aac1af5c11bcfaa3c63d1911e0b95a467dd10d9e8b188f015a69d871602c`.
- `artifacts/question-factory/cuet-readiness-2026-10-08/staging/reassessment-retrieval-proof.json`: 662 denominator; 535 retained/retrieved; 127 withheld; zero current v7 release/publications. SHA-256 `d175944b3579ed59fe9db58f7c618d2c327db558d38b84a81e8716814cfb70a9`.
- `artifacts/question-factory/cuet-readiness-2026-10-08/staging/staging-status.json`: 666 current staging rows; 662 usable legacy rows; 4 additional rows; 662/662 legacy IDs retrieved. SHA-256 `52ba19f7294855029385314f6fa9e45681fd0a8b4d5091cad4816ac18892d629`.
- `artifacts/question-factory/continuation-500/staging-retrieval.json`: earlier historical 662/662 staging retrieval. SHA-256 `c4357263bf46335c761882d43aaadd3ed86e750d201fafadf380fe6e69c9c61d`.
- `artifacts/question-factory/cuet-readiness-2026-10-08/execution/bank-final-distribution-QA.md`: documents the one extra passage sibling in the 536→535 closure and exact-duplicate review. SHA-256 `6f17a679d4f983d01863764b46d2ddd330441c220d95fb1d51bfe94ec67ca28b`.

Limitation: the root separately checks live production. This note reports only the saved local artifacts and historical production receipts/retrieval proofs above; it does not certify today's live production count.
