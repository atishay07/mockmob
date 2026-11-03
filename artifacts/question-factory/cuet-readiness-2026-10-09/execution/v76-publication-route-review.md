# V76 publication route review — 9 October 2026

This is local software evidence. No provider call, staging import, publication, production write, deployment or actual V76 campaign qualification occurred. The academic V76 implementation, runner and frozen measurement worker were not edited.

## Current route coverage

| Route | Current boundary | V76 scope / limitations |
| --- | --- | --- |
| `scripts/pipeline/controller.mjs` | Legacy controller publication disabled with `legacy_controller_publication_disabled_use_qualified_factory`. | Closed; use qualified factory route. |
| `scripts/pipeline/factory.mjs` | Four single/group publish sites call `publishInspectedUnit`, reading the current bank. Profiled jobs retain version/profile dispatch and complete-group validation. | Current inventory inspection present; this review did not alter queue/profile dispatch or establish a live V76 worker deployment. |
| `scripts/pipeline/lib/offlineBatchFactory.mjs` | Offline imports call `publishInspectedUnit` with `readBankSnapshot` before publication. | Current bank checked; no live offline import tested here. |
| `scripts/pipeline/autonomous/worker.mjs` | Single and passage publication route through `publishAfterCurrentInspection` / `publishInspectedUnit`. | Current inventory check present; no live autonomous run tested here. |
| `scripts/pipeline/tools/focusedFactory.mjs` | Whole eligible campaign inspected with `inspectBeforeBulkPublish` before staging job/control writes and publication. | Legacy/manual route; does not provide the additive V76 settled-run adapter gate. Not a V76 qualification route. |
| `scripts/pipeline/tools/publishProductionCohort.mjs` | Whole approved campaign inspected against current production inventory before job/control writes. | Existing production route, outside this task's authorization; no new V76 approval or release inferred. |
| `scripts/pipeline/tools/cuetFitFactory.mjs` | Frozen, registered measurement worker/manual publish action calls `assertPublicationPolicy(profile)`; A/B registrations are measurement-only with `publication_policy: never`. | Kept byte-identical. Those registered arms fail closed for publication. Its legacy manual publish code is not retrofitted because its bytes are registration-bound. |
| `scripts/pipeline/tools/publishCuetFitCampaignV76.mjs` | Additive staging-only alternative. Exact `assertFactoryProfileV76`, campaign/report/settled-run binding and trusted candidate evidence checked before ledger access or target writes. Whole current inventory inspection precedes job/control writes; every single or full passage group is reinspected immediately before its publish callback. | Sole additive V76 manual staging adapter reviewed here. Hardcoded separate staging target and existing admin required. No real V76 campaign adapter artifact exists yet. |
| `scripts/pipeline/lib/cuetFitPublicationV76.mjs` | Shared exact qualification boundary. Helper inspects current bank before preparation and again before callback; cleanup runs even if preparation fails. | Helper tests inject academic eligibility solely for software lifecycle fixtures; CLI uses default trusted `evaluateEvidenceV7`. It does not turn benchmark rows into approved campaign candidates. |

## Fixed demonstrated defects

- Publication policy belongs to the campaign, not the exact V76 profile schema. The old helper demanded an extra profile field that the profile validator forbids; the replacement gate accepts an exact current profile.
- Missing/mismatched campaign IDs, stale registry/release/profile hashes, nonterminal/unsettled run flags, changed candidate payload and mismatched candidate counts fail before target preparation.
- Candidate ID, topology, verifier, contract and all three model-check prompt/version/contract stamps must match V76. Default trusted evidence inspection checks signature, content, mandatory stages, active registered source support, provenance and expiry. Unsigned test candidates fail the real gate.
- Complete passage groups are validated before any target preparation. Each CLI group publishes through one existing atomic group RPC callback; lone/incomplete children cannot publish.
- Staging control reads the complete existing row, enables temporarily and restores the prior values, including phase and timestamps. A failed enable is still restored. The old unconditional paused/disabled overwrite was removed.
- Preparation is inside cleanup's `try/finally`, so partial preparation cannot skip cleanup. Reinspection after preparation catches bank changes before the helper publication callback.

## Required future adapter artifact

A later genuinely qualified pilot exporter must produce `<campaign-directory>/publication-run-v76.json` with:

```json
{
  "execution_finished": true,
  "receipt_complete": true,
  "held_usd": 0,
  "campaign_id": "the-exact-registered-campaign-id",
  "profile_sha256": "the-exact-current-verification-profile-hash",
  "candidate_payload_hash": "hashJSON(approvedJobs.map(({id,candidate,result}) => ({id,candidate,result})))"
}
```

`approvedJobs` follows `all-candidates.json` order and includes only eligible/published jobs. The complete batch report must match campaign ID, registered denominator and approved count. CLI independently checks the saved full-batch inspection content hash, then reconciles the persistent ledger and requires accounting `ready` and `settled`. The adapter file alone cannot substitute for these checks, a current release, trusted candidate evidence or owner authorization. Benchmark `run/summary.json/results.json` is not a campaign settlement artifact.

## Verification and remaining limits

Command: `node --test scripts/pipeline/tests/cuetFitPublicationV76.test.mjs scripts/pipeline/tests/cuetFitPublicationRouteV76.test.mjs scripts/pipeline/tests/publishTimeInspection.test.mjs scripts/pipeline/tests/factoryProfileV76.test.mjs`.

Result: **23 passed, 0 failed**. Covers exact current V76 software gate, measurement/settlement/profile/payload/source rejection before inventory/writes, mandatory-check rejection, default unsigned-evidence rejection, duplicate withholding, incomplete passage groups, preparation failure cleanup, duplicate arrival after preparation and full control restoration after successful/failed enable. Existing tests confirm complete-group atomic inspection and frozen measurement-worker hash preservation.

No staging credentials were used. Happy-gate academic eligibility is deliberately mocked and cannot establish academic correctness, released calibration or real candidate qualification. No full campaign transaction is promised: passage-group RPCs are atomic, but earlier completed units/job imports can remain if a later unit fails. Current-bank inspection is not a database lock; concurrent writes between inspection and RPC still depend on existing RPC constraints. Snapshot restoration is not concurrency isolation against another control writer. Actual staging database schema/RPC compatibility, student retrieval and deployed runtime release remain unverified. No live staging is authorized until genuine qualification and root/owner approval.
