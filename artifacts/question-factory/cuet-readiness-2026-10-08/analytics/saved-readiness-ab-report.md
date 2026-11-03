# Saved CUET readiness A/B campaign analysis

Generated 2026-10-07T21:37:32.562Z. This is an offline analysis of saved campaign outputs only; no provider calls, live ledger reads, or diagnostic heldout fixtures were used.

## Comparison status

- A: baseline, partial, denominator 100; 37 unique machine-eligible, 10 quarantined jobs, 53 pending jobs.
- B: unstarted/incomplete (no candidate, result, or receipt artifacts saved); planned denominator 100.
- A/B comparison and forecasts: **not available**. Forecast remains null until B completes and receipts reconcile.

## A denominator and yield

All 100 preregistered candidates remain in the denominator. A is a saved partial snapshot as of 2026-10-07T21:36:43.798Z. Current machine-eligible yield is 37/100 (37%); this is a partial observation, not a completed yield estimate. Job states: {"eligible":37,"generated":7,"quarantined":10,"queued":43,"repaired":3}. Validation states: {"eligible":37,"missing_result":50,"quarantined":13}. Three repair-pending jobs already have quarantined repair results; batch status still counts them as pending.

Per-subject observed counts:

| Subject | n | Eligible | Quarantined jobs | Pending jobs | Current scoped cost |
|---|---:|---:|---:|---:|---:|
| english | 25 | 11 | 2 | 12 | $0.178596 |
| accountancy | 25 | 8 | 3 | 14 | $0.147346 |
| business_studies | 25 | 11 | 1 | 13 | $0.137554 |
| economics | 25 | 7 | 4 | 14 | $0.163027 |

Among the 37 current eligible candidates, answer positions are {"A":13,"B":7,"C":7,"D":10}; the planned positions across 100 are {"A":28,"B":24,"C":24,"D":24}. Per-subject observed eligibility is english 11/25, accountancy 8/25, business_studies 11/25, economics 7/25; 12–14 items per subject remain pending, so these are provisional differences only. The deterministic screen found 0 exact duplicate groups and 0 near-idea pairs among 57 produced candidates; this does not prove semantic distinctness. Formats, difficulty, source lengths, and all recorded failure reasons are in the JSON report.

## Scoped cost

The saved A receipts contain 257 distinct post-preregistration requests: $0.626523 settled, $0.000000 held, $0.626523 gross. These reconcile to the saved batch report. Provider usage receipts are not invoices. Independent Gemini evaluation is the largest observed stage at $0.384684 (61.4% of settled cost; 41 requests). Source material supplied to produced candidates is a median 531 words in total (p90 689); a future preregistered run could measure whether narrower, still sufficient excerpts reduce evaluation input without weakening source support. Cost-by-stage/model is in the JSON report.

## Avoidable-cost questions for the next preregistered iteration

- The cohort is 53% pending, so do not annualize or compare per-approved costs yet.
- Inspect repair-stage marginal spend and eligibility recovery before changing repair behavior.
- Repeated deterministic formatting failures may be prevented by a local precheck or clearer author instructions, while retaining failed attempts in the denominator.
- Keep 25 per subject for direct A/B comparability unless a different stratification is preregistered in advance.

The JSON retains exact receipt-level stage/model totals, all failure labels, candidate-level support lengths, and deterministic duplicate-risk pairs.
