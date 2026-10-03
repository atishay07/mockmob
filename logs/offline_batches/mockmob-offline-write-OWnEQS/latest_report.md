# Offline CUET Batch Report

Route: Economics / Money & Banking
Quality mode: balanced
Generated at: 2026-05-09T17:45:54.488Z

## Counts
- Raw questions: 10
- Schema valid: 10
- Alignment pass: 10
- SelfCheck pass: 10
- Mini validator accepted: 10
- Strict validator accepted: 0
- Final accepted: 10
- Final rejected: 0

## Quality
- Average score: 9.1
- Average exam quality: 8.8
- Average distractor quality: 8.7
- Average answer confidence: 0.94

## Top Rejection Reasons
- None

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
- Importable count: 10
- Inserted count: 0
- Blocked reasons: OFFLINE_IMPORT_ALLOW_DB_WRITE_not_true, dry_run_enabled
