# Offline CUET Batch Report

Route: Economics / Money & Banking
Quality mode: balanced
Generated at: 2026-10-02T08:02:57.989Z

## Counts
- Raw questions: 10
- Schema valid: 10
- Alignment pass: 10
- SelfCheck pass: 10
- Mini validator accepted: 10
- Strict validator accepted: 3
- Final accepted: 0
- Final rejected: 10

## Heuristic Screening
- Scoring method: deterministic_heuristic_screen
- Heuristic average score: 0
- Heuristic average exam quality: 0
- Heuristic average distractor quality: 0
- Heuristic average answer confidence: 0
- Note: Heuristic scores are local screening scores, not real validator scores.

## Real Validator Sample
- Status: missing
- Sample size: 0
- Accepted: n/a
- Rejected: n/a
- Average score: n/a
- Average distractor quality: n/a

## Top Rejection Reasons
- None

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
- Importable count: 0
- Inserted count: 0
- Blocked reasons: item_evidence_missing, no_publishable_item_evidence, write_flag_not_passed, dry_run_enabled
