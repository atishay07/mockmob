# Final bounded independent V77 runner review

Review scope: revised additive runner/guards/release adapter and focused seam tests. No new study, authorization file, transport freeze, case, native request or provider call was created. First review and original probes are preserved.

**One concrete recovery blocker remains at review time:** recover-mode filter reads `JSON.parse(request_json).candidate_id`; native transport persists `{body, config}`, with scoped candidate identity under `config.candidate_id`. Thus actual V77 receipt rows are excluded from recovery output. Root was notified to patch the owned additive runner. This does not bypass native no-resubmit protection, but makes receipt-only recovery incomplete.

Resolved prior demonstrated defects:

- Thirteen required history paths now include all earlier V73/V74 exposure sets. Actual earlier V73 fixture relabeled as fresh is rejected. Missing history files fail closed. History hashes and per-fixture fingerprints are plan-bound, and independent semantic/number-only case review is separately required.
- Accepted contested fresh expected-invalid row now remains counted: independent complete/settled synthetic probe returns paused with `fresh_false_accepts:[hidden_defect]` and explicit contested/false-accept problems. Numeric release thresholds remain0/0/.85/.70.
- Closed51-file transport dependency freeze is required prospectively for study actions. Plans bind full dependency hashes, transport freeze, core raw freeze and semantic hash separately, history/source/prices/custody/case review. Default report permits no transport freeze yet and creates nothing. Root owns future freeze creation.
- Authorization now binds actual study payload/custody/source hashes, transport freeze and execution-plan hashes, prior to target plan/result/lease/DB mutations. Human provenance remains a user/session fact; a JSON flag alone is not authorization.
- Receipt completeness, no held cost and complete terminal rows/provider judgments are required before a released/paused academic qualification result. Incomplete evidence gives pending rather than classifying missing cases rejected.

Native transport seam independent probes:

1. Typed Flex refusal: exactly one mock native call with final `service_tier:flex` and `noFlex:true`; real durable key retained, rejected-before-inference state explicit, phase stops and pending reserve returns0. Hidden native Flex fallback disabled.
2. Timeout with persisted acceptance: one mock call, key/native acceptance state retained, dispatchState accepted, phase stops, unknown outcome receipt-only.
3. Complete cached receipt: forwards noFlex and materialized final body without a new wrapper reservation; completes without stopping. Accepted-key focused tests separately prove zero native calls on resume.

CompleteJSON doubled-output retry still reenters final-body sizing/shared/lifetime caps under a distinct durable request identity. No additional comparison/provider was added. Gemini remains realtime. Expanded audit bodies must contain both frozen matrices/schema and stay under50000 UTF-8 bytes at dispatch. Offline sizing uses explicitly synthetic matrices and is not academic qualification.

Verification: **18 focused tests passed,0 failed**. Default report succeeded with local-only/no-DB/no-study/no-provider status. Independent final probe artifact is `v77-runner-final-independent-probes.json`.

For the recursive `clean` concern, all41actual retained V76 terminal rows and saved evaluations were inspected: no truthy nested error/error_code fields were present. No concrete academic-quarantine misclassification was demonstrated in actual shapes. Pending-with-held-receipts currently leaves academic_assessment null and omits observed false-accept metrics; that is a reporting limitation, not evidence of a released result bypass. Root may preserve partial observed outcomes separately without treating them as completed qualification.

No native-ready claim is made. Actual registrations, fresh custody, final transport freeze, explicit paid user scope and provider completion remain outstanding.

## Final stable confirmation (2026-10-09)

The earlier text is preserved as the timestamped draft review. The recover filter now reads `config.candidate_id` with the historical top-level fallback. The production accepted-request callback passes `activeLedger.db`; the focused suite exercises a temporary real BudgetLedger. Completed/cache-backed forwarding occurs before the STOP guard. Report/recover bypass pricing expiry and recover opens the database read-only. Offline capture measures the final Flex body, and saved preflight capture keys must equal the expected complete stage/provider matrix. Prior-history and contested-case fixes remain present.

**19 focused tests passed, 0 failed.** Default report succeeded without opening a database. No provider calls were made. Runner SHA256 is `8a5bed57efcebfd7beeea8177b0d194d40495e4778efbb793ff9cbd074d4d3c4`; guards SHA256 is `578651ddaf90b003f39a40bd36971c9317f4ccf409b86b39eb70be77ce7ca2ec`. Release SHA256 observed during confirmation is `f58afb6b4e56e8b523ccff64cf353e361db753ee7297b997c99baf0050cbb7e2`, differing from the parent-supplied stable value; no claim is made that the three files form a final freeze. Exact hashes and independent skip probe are preserved in `v77-final-confirmation-probes.json`.

**Concrete outstanding recovery gap:** a saved outer case with `state:error,resume_safe:false` is skipped unconditionally, even after its exact native key becomes complete/cache-backed. A saved inner terminal evaluation returns `keep_terminal_error`. Read-only recover reports persisted response/cache availability but cannot consume it. Receipts are preserved, but an accepted outcome that later settles cannot rebuild its derived academic judgment through the current runner.

Smallest additive remedy: an explicit receipt-only consume mode can admit these terminal rows only against their exact recorded completed/cache-backed request identities, replay the ordinary adapters and mandatory verifier gates, and reject every request requiring a new reservation before native forwarding. Force cache-only/no-Flex-fallback transport and forbid network access. A missing next-stage receipt or JSON-retry identity stays pending. Preserve original terminal errors in immutable recovery history or a separate recovery result. This incurs zero new provider calls or spend; previous settled cost remains counted. Accepted/unknown requests remain receipt-only and may never be resubmitted. Parent owns any implementation; no runner edits were made in this review.

## Receipt-only recovery confirmation (2026-10-09)

The additive remedy is now implemented. **22 focused tests passed, 0 failed.** The new real temporary SQLite seam test verifies completed-cache replay, missing next-stage/complete-JSON-retry denial before native forwarding, zero newly reserved ledger rows and preserved prior error history. The native callback is mocked in this test; no provider calls occurred.

The actual runner wires `recover` to `recoveryOnly:true`, does not require paid authorization, does not load `.env.local`, and reads the already bound saved execution plans/preflights rather than generating a new preflight. Each forwarded recovery request carries `cacheOnly:true,noFlex:true`; the wrapper requires its exact generated durable key to have a complete provider row, persisted response and response cache, with no reservation needed. Missing stage/retry receipts are denied before native forwarding or budget checks. The inherited native transport returns a completed receipt/cache before reaching its provider path and rejects a cache-only miss before dispatch.

Recovered evaluation and topology replacements retain deep-copied original error records in `recovery_history`; unsuccessful recovery attempts retain the original evaluation error. Rebuilding a topology still invokes the ordinary V77 verifier. Full fixed-denominator judgments, terminal rows, settled receipts and no held cost remain mandatory for release; partial recovery remains pending. No concrete remaining blocker was found in this narrow recovery scope.

Recover uses a writable BudgetLedger, a phase lease and local derived result/history writes, including any ordinary saved-receipt reconciliation. It is a zero-new-reservation/network consume operation, not a read-only report. No full registered V77 CLI recovery was executed because no real V77 study registration exists; this conclusion combines actual wiring inspection with the focused temporary-ledger seam test. No academic core or integration code was edited by this reviewer.
