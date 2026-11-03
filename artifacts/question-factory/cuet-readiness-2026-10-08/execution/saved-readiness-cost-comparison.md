# Saved readiness campaign cost comparison

Captured 2026-10-08T10:53:21.316Z. Read-only SQLite transaction; no provider calls, ledger writes, or publication. Campaign IDs and per-request identity were reconciled against the saved 100-item exports.

## Status

- Baseline: 66/100 eligible and 100/100 terminal. Current read-only ledger cost: $1.227996 gross ($1.216368 settled + $0.011628 held). Its saved export at 2026-10-08T08:22:25.945Z reconciles exactly.
- Improved: 70 eligible in the saved outcome snapshot at 2026-10-08T08:22:28.014Z; 100/100 terminal, with 0 nonterminal. Current read-only ledger cost: $1.341445 gross ($1.177385 settled + $0.164060 held); the last saved export at 2026-10-08T08:22:28.014Z was 478 requests / $1.341445 gross. The bridge attributes 0 new reservations and $0.000000 subsequent gross cost.
- Final improved yield, A/B final comparison, and improved forecast: available after reconciliation.

## Exact scoped spend

| Arm | Stage | Provider | Model | Execution mode | Requests | Settled | Held | Gross committed | Input tokens | Output tokens | Reasoning subset |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | independent_evaluation | gemini | gemini-3.8-flash | realtime | 76 | $0.695155 | $0.000000 | $0.695155 | 318608 | 121645 | 44329 |
| baseline | blind_solution | openai | gpt-6-luna | realtime | 166 | $0.290605 | $0.011628 | $0.302233 | 824648 | 856626 | 715526 |
| baseline | authoring | openai | gpt-6-luna | realtime | 116 | $0.169692 | $0.000000 | $0.169692 | 452705 | 509943 | 451786 |
| baseline | repair | openai | gpt-6-luna | realtime | 51 | $0.033516 | $0.000000 | $0.033516 | 147285 | 93920 | 79130 |
| baseline | explanation_support | openai | gpt-6-luna | realtime | 74 | $0.027400 | $0.000000 | $0.027400 | 185767 | 53564 | 38496 |
| baseline | authoring | openai | gpt-6-luna | unknown_receipt_only | 13 | $0.000000 | $0.000000 | $0.000000 | 0 | 0 | 0 |
| baseline | blind_solution | openai | gpt-6-luna | unknown_receipt_only | 17 | $0.000000 | $0.000000 | $0.000000 | 0 | 0 | 0 |
| baseline | explanation_support | openai | gpt-6-luna | unknown_receipt_only | 7 | $0.000000 | $0.000000 | $0.000000 | 0 | 0 | 0 |
| baseline | repair | openai | gpt-6-luna | unknown_receipt_only | 2 | $0.000000 | $0.000000 | $0.000000 | 0 | 0 | 0 |
| improved | independent_evaluation | gemini | gemini-3.8-flash | realtime | 82 | $0.731709 | $0.083286 | $0.814995 | 354546 | 124205 | 37090 |
| improved | blind_solution | openai | gpt-6-luna | realtime | 153 | $0.251198 | $0.070146 | $0.321344 | 756366 | 788882 | 661077 |
| improved | authoring | openai | gpt-6-luna | realtime | 114 | $0.148837 | $0.010628 | $0.159465 | 463871 | 455066 | 402597 |
| improved | explanation_support | openai | gpt-6-luna | realtime | 79 | $0.028165 | $0.000000 | $0.028165 | 198242 | 61753 | 45543 |
| improved | repair | openai | gpt-6-luna | realtime | 34 | $0.017476 | $0.000000 | $0.017476 | 94045 | 46345 | 37676 |
| improved | authoring | openai | gpt-6-luna | unknown_receipt_only | 7 | $0.000000 | $0.000000 | $0.000000 | 0 | 0 | 0 |
| improved | blind_solution | openai | gpt-6-luna | unknown_receipt_only | 8 | $0.000000 | $0.000000 | $0.000000 | 0 | 0 | 0 |
| improved | explanation_support | openai | gpt-6-luna | unknown_receipt_only | 1 | $0.000000 | $0.000000 | $0.000000 | 0 | 0 | 0 |

Reasoning tokens are a subset of output tokens, not an additional cost category. Unsettled request holds are preserved at their maximum reserved/actual amount. Each saved receipt export reconciles request count and settled/held/gross totals exactly to its saved batch cost report. The current ledger view is bridged from that export through exact-ID new requests and any changed reservation settlements. Requests whose receipt lacks execution mode are isolated in an explicit unknown mode bucket; no mode is inferred.

## Denominator, repairs, and forecast

Both arms retain a fixed denominator of 100. Baseline repairs: 51 attempts across 51 items; directly attributed repair-stage gross cost $0.033516. Improved repairs: 34 attempts across 34 items; directly attributed repair-stage gross cost $0.017476. Other stages may include post-repair revalidation and are not mislabeled as initial-only spend.
Baseline 10,000-item conditional upper-bound: $186.06, computed from baseline gross committed spend including holds divided by completed eligible count. It is conditional on unchanged mix/yield and is not a settled invoice.
Improved-arm 10,000-item estimate: $191.63.

Format, difficulty, requested/actual answer positions, all 100 item states, exact fingerprints, and failure-code counts are in the JSON. Fingerprints are text-level diagnostics, not semantic uniqueness proof.

No publishing, release, or quality claim follows from machine eligibility.
