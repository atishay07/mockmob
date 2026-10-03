# Offline CUET Batch Report

Route: Economics / Money & Banking
Quality mode: balanced
Generated at: 2026-05-09T17:41:26.680Z

## Counts
- Raw questions: 10
- Schema valid: 10
- Alignment pass: 10
- SelfCheck pass: 10
- Mini validator accepted: 0
- Strict validator accepted: 0
- Final accepted: 0
- Final rejected: 10

## Quality
- Average score: 0
- Average exam quality: 0
- Average distractor quality: 0
- Average answer confidence: 0

## Top Rejection Reasons
- validator_not_accept: 10
- score_below_7_5: 10
- exam_quality_below_7_0: 10
- distractor_quality_below_7_0: 10
- balanced_score_floor_failed: 10
- weak_distractors: 10

## Cost Estimate
- External LLM calls: 0
- Estimated USD: 0

## Import Recommendation
- Good enough to import: no
- Reason: Do not import yet; acceptance or quality target is below the requested threshold.
- Real import command: OFFLINE_IMPORT_ALLOW_DB_WRITE=true node scripts/pipeline/tools/importOfflineQuestionBatch.mjs --dir="data/offline_question_batches/economics_money_banking" --quality=balanced --write

## Dry Run / Import
- Dry run: yes
- DB duplicate count: 0
- Importable count: 0
- Inserted count: 0
- Blocked reasons: write_flag_not_passed, dry_run_enabled
