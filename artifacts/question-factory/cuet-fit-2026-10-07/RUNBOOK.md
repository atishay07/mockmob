# Runbook: finishing the measurement once OpenAI credit is available

Everything below is built, linted and unit-tested offline (`node --test scripts/pipeline/tests/cuetFitV7.test.mjs`, 15 tests). Every provider call goes through the persistent
budget guard (USD 50 lifetime ceiling, unchanged). Nothing here migrates production. PowerShell or Git Bash, from the repository root.

## 0. Confirm credit and the retained collector
```bash
node --use-system-ca scripts/pipeline/tools/probeProviderCredit.mjs
node scripts/pipeline/tools/acceptedBatchStatus.mjs
```
If the controller stopped on `credit_balance_exhausted`, confirm no controller or worker process remains (Windows process inventory), then resume the
same fixed campaign without resubmitting anything:
```bash
node --use-system-ca scripts/pipeline/tools/continueCoverageCohorts.mjs --staging --approved-production --realtime-checks
```
It will collect the 9 accepted authoring results of cohort 010, validate them under the legacy contract and publish. Requests refused for credit are retried with the same key.

## 1. Measure v7.1 on Luna (preregistered rule in PREREGISTRATION-study-2.md)
Gemini measurements already exist (tag v7.1). Add Luna and the explanation audits; replays are cached and cost almost nothing.
```bash
node --use-system-ca scripts/pipeline/tools/runCuetFitStudy.mjs evaluate --set v2 --tag v7.1 --providers openai --cap-usd 1
node --use-system-ca scripts/pipeline/tools/runCuetFitStudy.mjs evaluate --set regression --tag v7.1 --providers openai --cap-usd 1
node --use-system-ca scripts/pipeline/tools/runCuetFitStudy.mjs replay --set v2 --tag v7.1 --cap-usd 1
node --use-system-ca scripts/pipeline/tools/runCuetFitStudy.mjs replay --set regression --tag v7.1 --cap-usd 1
node scripts/pipeline/tools/releaseCuetFitTopology.mjs --topology single_luna --tag v7.1 --dry-run
```
Expected spend about USD 0.6. Release is automatic only when the rule passes: `node scripts/pipeline/tools/releaseCuetFitTopology.mjs --topology <id> --tag v7.1`.
If `single_luna` fails and `dual_blind` passes, release `dual_blind`; if neither passes, change the validator and measure on a NEW benchmark (benchmark 2 is then regression evidence).

## 2. Two preregistered batches (only after a release)
```bash
node scripts/pipeline/tools/prepareCuetFitCampaign.mjs cuet-fit-batch-a --staging --topology <released> --arm baseline
node --use-system-ca scripts/pipeline/tools/cuetFitFactory.mjs worker --staging --once --realtime-all --campaign-dir artifacts/question-factory/cuet-fit-batch-a
node scripts/pipeline/tools/prepareCuetFitCampaign.mjs cuet-fit-batch-b --staging --topology <released> --arm improved
node --use-system-ca scripts/pipeline/tools/cuetFitFactory.mjs worker --staging --once --realtime-all --campaign-dir artifacts/question-factory/cuet-fit-batch-b
```
Stop the legacy collector first (the factory lease is exclusive) and restart it afterwards. Each batch: 100 candidates from actual coverage gaps, every candidate,
repair, failure and cost retained, no regeneration. Compare `batch-report.json` (`rejection_by_stage`, yield, cost per approved, reading-load rejections). Add `--publish` only
for staging, and never to production without the owner's explicit approval and a deployment that contains `data/cuet_fit_evidence.mjs`.

## 3. Reassess the 662 approvals under the new contract
```bash
node --use-system-ca scripts/pipeline/tools/reassessApprovals.mjs --topology <released> --concurrency 8 --cap-usd 4
```
Writes `reassessment/reassessment-<topology>.jsonl`; it never edits or withholds anything. Expect about USD 1.2 (single Luna, realtime) to 6 (dual).

## 4. Deterministic audits (no cost, any time)
```bash
node scripts/pipeline/tools/analyzeBankCuetFit.mjs
node scripts/pipeline/tools/analyzeCuetFitHistory.mjs
node --experimental-sqlite scripts/pipeline/tools/ledgerSummary.mjs --since "2026-10-07 15:30:00"
```

## 5. Before any v7 question can reach students
Deploy the code containing `data/cuet_fit_evidence.mjs` and the `evidence_registry.js` router; confirm `data/calibration_manifest.json` carries the release in the deployed bundle
(`outputFileTracingIncludes` already lists the file); then run the staging and production retrieval checks of the continuation report. v7 records keep `policy_version = cuet-llm-v3`
because the saved publication RPC accepts only that literal; no database migration is needed or made.
