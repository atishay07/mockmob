# Offline CUET Batch Report

Route: Economics / Money & Banking
Quality mode: balanced
Generated at: 2026-05-09T18:47:02.715Z

## Counts
- Raw questions: 10
- Schema valid: 10
- Alignment pass: 10
- SelfCheck pass: 6
- Mini validator accepted: 6
- Strict validator accepted: 2
- Final accepted: 6
- Final rejected: 4

## Heuristic Screening
- Scoring method: deterministic_heuristic_screen
- Heuristic average score: 8.78
- Heuristic average exam quality: 8.47
- Heuristic average distractor quality: 8.4
- Heuristic average answer confidence: 0.933
- Note: Heuristic scores are local screening scores, not real validator scores.

## Real Validator Sample
- Status: missing
- Sample size: 0
- Accepted: n/a
- Rejected: n/a
- Average score: n/a
- Average distractor quality: n/a

## Top Rejection Reasons
- non_cuet_pattern: 3
- weak_distractors: 1

## Cost Estimate
- External LLM calls: 0
- Estimated USD: 0

## Import Recommendation
- Good enough to import: no
- Reason: Do not import yet; heuristic acceptance or real-validator sample evidence is below the requested threshold.
- Real import command: OFFLINE_IMPORT_ALLOW_DB_WRITE=true node scripts/pipeline/tools/importOfflineQuestionBatch.mjs --dir="data/offline_question_batches/economics_money_banking" --quality=balanced --write

## Dry Run / Import
- Dry run: yes
- DB duplicate count: 0
- Importable count: 6
- Inserted count: 0
- Blocked reasons: write_flag_not_passed, dry_run_enabled
