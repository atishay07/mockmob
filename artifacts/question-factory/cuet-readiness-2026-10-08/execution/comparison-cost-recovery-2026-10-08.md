# Comparison cost and receipt recovery — 2026-10-08

Evidence is current through `CURRENT-STATUS.json` at 2026-10-08 06:04:40Z; no matching live Node worker was present on the last CIM check. This report is read-only and no provider call, retry, ledger mutation, or publication occurred.

The comparison supervisor did not stop because of its CUET validator circuit breaker. Its persisted progress is stale at 00:11:37Z and records the improved arm at 31 eligible, 12 rejected, 57 pending. The improved-arm log ends with `measurement_lease_active_scope_conflict` while `FactoryStore.claim` tried to claim work; this is the concrete stop cause in the saved log. Later direct/resumed work advanced the arm to 50 terminal, so the progress file and campaign exports at 00:13Z must not be treated as current.

Latest authoritative campaign totals:

| Arm | Terminal | Eligible | Rejected | Pending | Settled | Held | Gross committed | Requests |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline v7.1 | 100/100 | 70 | 30 | 0 | $1.216368 | $0.011628 | $1.227996 | 522 |
| Improved v7.2 | 50/100 | 38 | 12 | 50 | $0.640851 | $0.130176 | $0.771027 | 262 |

`CURRENT-STATUS.json` is the trusted live aggregate. The last itemized B export is older (31/12/57, 235 requests, $0.558489 settled + $0.076905 held), so do not attribute its per-candidate rows to the later 50-terminal snapshot. Per-item spend for the 19 subsequent terminal candidates is not recoverable from that export alone; refresh from the durable candidate/request ledger after provider receipts are reconciled. The baseline itemized export is at 100 terminal and agrees with the current aggregate.

Four Gemini batch receipts remain unresolved on known native provider IDs; the improved-arm log repeatedly recorded `batch_failed_usage_missing` for those same IDs, while the current DB shows provider state `BATCH_STATE_SUCCEEDED` with a service-unavailable error payload. Each is an independent-evaluation candidate with a $0.019788 reservation. Query/reconcile those exact provider batch IDs and capture saved item usage; do not submit replacement jobs or convert missing usage to zero. Until resolved, all four holds remain committed.

Two additional reserved rows owned by dead PID 35812 are provably recoverable only as bounded maximum holds, not as successful completions: `fed280b0-17a0-48c7-9af5-350476c7da7d` ($0.011628) and `e16dbb42-ed3a-4027-8462-0ee8ff7299ce` ($0.041643), combined $0.053271. Added isolated recovery code recomputes the saved native-body/config/rate proof inside the write transaction and rejects any body/proof drift. Four focused tests pass. Parent has the apply command; it has not been run here.

The rest of the 27 unresolved requests are not evidence of zero billing. Preserve their existing conservative holds; reconcile only through exact native receipts matched to stored request IDs/config/body. No invoice was obtained. Current lifetime budget is $31.550584 settled + $0.366370 held = $31.916954 committed of $50, leaving $18.083046 headroom before any other new commitments. The bank reassessment is 661/662 terminal (536 eligible, 125 rejected, one provider error, one pending), with $6.267641 settled + $0.011628 held = $6.279269; publication remained disabled for that campaign.

Recommended recovery order: (1) re-read process inventory and current ledger/status; (2) apply only the reviewed two-row maximum-hold repair after the parent validates the generated plan; (3) reconcile the four known Gemini batch IDs and any other provider IDs without resubmission; (4) rebuild item-level costs from current durable candidate IDs and ledger joins; (5) resume B only after receipt/lease guards permit it. Gross committed costs include holds; held amounts are not invoices or confirmed provider charges.

## Refresh — 2026-10-08, 06:18 UTC

A metadata-only GET to the exact Gemini provider batch `batches/2mmft6uwaqppq9n1pzsni0iq1jccncktq1o7` returned HTTP 200, `BATCH_STATE_SUCCEEDED`, `done=true`, with 64 inline records. Sixty records have response usage metadata. The four target items (`90445a…`, `c37c…`, `ce6c…`, `ea6a…`) each have an item-level provider error code 14 and no response/usage metadata. Their reservations remain unresolved at $0.019788 each; do not infer zero usage from the batch's successful overall status. The provider emitted no item receipt for those four.

At this check, the improved campaign measurement lease was `released` with no owner. A live global factory worker lease belonged to PID 13072 while comparison driver PID 18956 was live; do not mutate/reconcile shared ledger rows until that run drains. The older `CURRENT-STATUS.json` snapshot remained timestamped 06:04:40Z, so campaign totals in this report are still that snapshot, not a post-resume measurement. No provider invoice was obtained.
