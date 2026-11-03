# Cost and recovery check — 8 Oct 2026

Read-only check of `data/pipeline-budget.sqlite`, the saved v7 handoff/runbook/results, and configured prices. I did not start or stop a worker, construct the mutating ledger wrapper, retry a provider request, or change ledger state. The filtered process inventory found no `node`, `npm`, or `python` worker. An external OpenAI batch status GET could not be completed because `fetch` failed, so the provider-side state remains unconfirmed.

The ledger records $19.896716 settled and $0.234236 held or submitted. A safety bug was found: the old snapshot/reservation calculation used partial `actual` usage instead of the full reservation on non-settled rows. The baseline snapshot read $20.093129, undercounting by **$0.037823**. The corrected committed total is **$20.130952**, leaving **$29.869048** under the $50 cap. It has 16 unresolved reservations ($0.186554) and 9 submitted OpenAI batch reservations ($0.047682). No unresolved record lacks a maximum hold, but that check alone did not protect against this undercount. The fix now counts `max(reserved, actual)` for every non-settled row and only actual usage for settled rows.

The saved Oct 7 `ledger-summary.json` reports 8 unresolved and the same $20.130952 committed total. The current database reports 16 unresolved plus 9 submitted. The dollar total is unchanged because the movement concerns held/submitted entries; the count difference needs request-lineage reconciliation. Do not treat it as freed budget.

The recovery dependencies are:

- **Cohort 010:** OpenAI batch `batch_6ac6311aa79481909d9e257151b0078c` is still `submitted` in the local ledger for 9 accepted requests. Its provider state could not be checked. Poll this exact batch; when terminal, retrieve and match its outputs, then finish the same cohort-010 collector under the frozen legacy v6.2 contract. Do not resubmit. Its nine reservation IDs and $0.047682 total are in [cost-recovery.json](cost-recovery.json).
- **Gemini v3 batch:** `batches/2mmft6uwaqppq9n1pzsni0iq1jccncktq1o7` has 60 complete and 4 unresolved rows in the local batch ledger. Those four holds total $0.079152. Reconcile terminal state and exact per-item metadata before marking any request resolved. Do not retry the four.
- **Other Luna entries:** 12 unresolved GPT-6 Luna reservations total $0.107402. Match each existing dispatch record to an API receipt before settling or releasing a hold. The reservation IDs are in the JSON artifact.
- **No active local paid worker was observed.** The OpenAI provider batch might still be processing remotely; only its read-only status poll can settle that uncertainty.

The handoff's “26 of 122 unusable calls” and “21 v3 fixtures missing evaluation” are campaign-level results. Artifact snapshots disagree: final `results-v7.1-v3.json` has 61 evaluation records with 2 Luna unresolved errors and 1 incomplete Gemini output, while `evaluate-errors-v7.1.json` has 20 errors (11 Luna unresolved, 6 Gemini unresolved, 2 OpenAI fetch failures, and 1 incomplete Gemini output). This proves the records come from different run points; it does not establish that 26 calls equal 26 current reservations. Keep the 26-call unusable denominator in the study report and reconcile spend only through provider IDs, opaque item IDs and receipts.

Official pricing check:

- Google lists Gemini 3.8 Flash at $0.75 input/$3.75 output per million tokens through 31 Dec 2026, doubling to $1.50/$7.50 on 1 Jan 2027. Its Batch rates are half the standard rates, and double on the same date. This confirms the handoff's date and the 2x claim. The local prices manifest expires 12 Oct 2026, so reverify before later calls.
- Anthropic's official model page and announcement confirm Haiku 5.5 launched 7 Oct 2026 at $0.10/$0.50 per million tokens for prompts up to 100k tokens, with a 50% Batch discount. The local manifest correctly marks Haiku measurement-only; its shared price verification expires 12 Oct.
- OpenAI's official Luna model page lists $0.10/$0.50 standard input/output, $0.01 cached input, and $0.05/$0.25 Batch/Flex for short prompts. `data/pipeline-prices.json` points to official OpenAI sources and records a 6 Oct verification, expiring 12 Oct.

The largest historical gross-cost category is calibration: $11.214533 (56.4% of settled lifetime cost), versus $8.180133 candidate generation, $0.497353 reassessment, and $0.003858 unattributed. At the individual call level, Gemini realtime is the largest `dual_blind` call at approximately $0.0114/call, according to the handoff. Measure batch and cache savings and raise useful-question yield while retaining required validators.

Recommended hard subcaps for the current $29.869048 headroom: $8 for the independent v4 benchmark; $5 each for campaign A and B; $6 for bank reassessment; $5.869048 contingency and receipt reconciliation. These are ceilings, not spend targets. Do not release each next tranche until the preceding frozen denominator and gross cost are reconciled. Reverify prices before any dispatch after 12 Oct; the persistent $50 ceiling remains the controlling limit.

Official sources: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini 3.8 launch/pricing](https://ai.google.dev/gemini-api/docs/latest-model), [Haiku 5.5 overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [Anthropic launch announcement](https://www.anthropic.com/claude-haiku-5-5), [GPT-6 Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenAI pricing](https://developers.openai.com/api/docs/pricing).
