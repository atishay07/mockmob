# Offline CUET Batch Report

Route: Economics / Money & Banking
Quality mode: balanced
Generated at: 2026-05-09T19:01:37.834Z

## Counts
- Raw questions: 100
- Schema valid: 100
- Alignment pass: 100
- SelfCheck pass: 100
- Mini validator accepted: 94
- Strict validator accepted: 28
- Final accepted: 92
- Final rejected: 8

## Heuristic Screening
- Scoring method: deterministic_heuristic_screen
- Heuristic average score: 8.69
- Heuristic average exam quality: 8.38
- Heuristic average distractor quality: 8.31
- Heuristic average answer confidence: 0.925
- Note: Heuristic scores are local screening scores, not real validator scores.

## Real Validator Sample
- Status: completed
- Sample size: 20
- Accepted: 20
- Rejected: 0
- Average score: 0.863
- Average distractor quality: 0.758

## Top Rejection Reasons
- duplicate_within_batch: 6
- validator_not_accept: 2
- answer_confidence_below_0_85: 2
- score_below_7_5: 1
- balanced_score_floor_failed: 1

## Cost Estimate
- External LLM calls: 20
- Estimated USD: 0.016

## Import Recommendation
- Good enough to import: yes
- Reason: Heuristic screening passes and the real-validator sample is strong enough for review.
- Real import command: OFFLINE_IMPORT_ALLOW_DB_WRITE=true node scripts/pipeline/tools/importOfflineQuestionBatch.mjs --dir="data/offline_question_batches/economics_money_banking" --quality=balanced --write

## Dry Run / Import
- Dry run: yes
- DB duplicate count: 0
- Importable count: 92
- Inserted count: 0
- Blocked reasons: write_flag_not_passed, dry_run_enabled
