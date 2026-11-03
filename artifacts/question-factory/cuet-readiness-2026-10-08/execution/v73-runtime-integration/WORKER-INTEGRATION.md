# Concrete worker integration plan and patch map

This extends the initial runtime proposal with a per-job path. It remains artifact-only: no academic contract, source registry, study artifact, runtime, or migration was changed.

## Binding constraints

Do not edit `data/cuet_fit_evidence.mjs`. It is part of the v7 parent contract and its change would invalidate `PARENT_CONTRACT_V7_HASH` as well as every current v7.3 contract hash. The release check belongs in a new `data/v73_runtime_evidence.mjs` adapter and the existing non-bound `data/evidence_registry.js` seam. Do not edit `factoryCore.mjs`: it is a parent-contract file too, so importing or changing its verifier dispatch would also invalidate the v7.3 parent hash. The worker can call the already-exported `validateFactoryCandidateV73` directly and continue using existing author and repair functions.

The existing `question_factory_jobs.generation_brief` JSONB column is present and does not need a migration. The profile is copied only onto newly planned jobs. A job without `generation_brief.validation_profile` remains on the existing legacy validator path. A present but malformed, unknown-version, or stale profile is rejected into `waiting` at a calibration gate; it never silently falls back to legacy.

## Intended end-to-end flow

1. An operator runs `node scripts/pipeline/factory.mjs profile-v73 <campaign-id> <profile.json>`. The command reads the current manifest and registry, requires the full released dual-blind v7.3 binding, and writes a frozen profile containing the complete expected binding and SHA-256 of the current release row. It makes no provider calls and changes no manifest.
2. After reviewing that profile, an authorized operator runs `node scripts/pipeline/factory.mjs enqueue-v73 <profile.json> [count]`. The command revalidates the profile against the current manifest, checks ordinary source readiness, and inserts newly planned jobs with the profile under the existing `generation_brief` JSONB field. Existing jobs and queued jobs are not rewritten.
3. Worker processing checks each job independently. Profiled v7.3 jobs must still match the exact v7.3 release, active registry version, profile hash, and contract hash. Unprofiled jobs use the legacy calibration predicate. This removes the global legacy-version blocker while retaining the same gate for every legacy job.
4. Authoring and repair continue through their current functions and prompts. Both initial validation and post-repair validation dispatch directly to `validateFactoryCandidateV73` for a pinned job. The returned signed record must repeat the profile verifier version and contract hash. Retry cache keys remain candidate-ID-scoped; a repair result is always revalidated by the selected verifier.
5. Before single or passage-group publication, the worker rechecks each job profile, requires one profile hash across a passage group, and calls the existing atomic publisher. That publisher's existing preparation path uses `publicationEligibility`; the new runtime adapter adds current v7.3 release-hash matching there. The database RPC remains the existing atomic insert and idempotency boundary.
6. Student retrieval already funnels through `publicationEligibility` in `data/evidence_registry.js`. The adapter rejects v7.3 records whenever the current released manifest row's validation-contract hash differs, the source-registry version differs, or the full v7.3 release predicate is false. Existing v6.2 and v7.2 evaluation is unchanged.

No stage-only SQL migration is required. The schema already stores `generation_brief` as JSONB. If a later implementation chooses a dedicated campaign foreign key instead, that must be a separate saved migration and dry-run report; it is outside this patch.

## Exact source changes to apply only after review

The worker patch artifact is consolidated in `runtime-integration.patch`. The required added module contract is:

```js
// scripts/pipeline/lib/factoryProfileV73.mjs
export function createFactoryProfileV73({ campaignId, manifest, registry });
export function assertFactoryProfileV73(profile, { manifest, registry });
export function pinNewJobsToFactoryProfileV73(jobs, profile);
```

`createFactoryProfileV73` and `assertFactoryProfileV73` must enforce the exact required profile keys; reject unknown keys and versions; verify profile self-hash; compare every field from `expectedReleaseBindingV73()`; verify profile source-registry version and full release-row SHA-256; and call `currentCuetCalibrationReadyVNext({ manifest, registry, binding: expectedReleaseBindingV73() })`. This means the helper does not invent a second release policy. `pinNewJobsToFactoryProfileV73` clones only new jobs, copies the immutable profile into `generation_brief.validation_profile`, and refuses to overwrite an existing pin.

`data/v73_runtime_evidence.mjs` exposes a pure `v73RuntimeEvidenceCurrent(record, {manifest, registry})` predicate. It allows the already-known v7.1/v7.2 validators through their existing generic release gate, rejects unknown `cuet-fit-validator-v7.*` versions, and for v7.3 requires `currentCuetCalibrationReadyVNext` with `expectedReleaseBindingV73()` and exact equality among record hash, profile/release binding hash, and current manifest release hash. `data/evidence_registry.js` calls this adapter after its existing generic `cuetFitReleased` gate and before `evaluateEvidenceV7`. This keeps student filtering and existing `prepareFactoryPublication` aligned without changing the bound academic contract.

In `factory.mjs`, profile creation and enqueue commands use only the existing local `read`/`save`, `planFactoryJobs`, source-readiness, and database insert mechanisms. The worker imports `validateFactoryCandidateV73`, removes the one global `factoryCalibrationReady(...)` block, and evaluates either the legacy predicate or `assertFactoryProfileV73` per job. Gate failures set `state: 'waiting'`, `stage: 'calibration_gate'`, record the reason, and continue with unrelated jobs. Both validator calls (before and after repair) go through the same profile-selected function. Before atomic single/group publish, it repeats the profile assertion and checks the candidate record binding; passage groups require identical profile hashes across siblings.

Add the new helper and runtime adapter to `next.config.mjs` tracing. No prompt, authoring, candidate, academic contract, pricing, source-registry, or budget code changes are allowed. Existing $50 lifetime generator guard and $25 monthly student-AI guard remain untouched.

## Bounded checks for a later implementation

```powershell
node --test scripts/pipeline/tests/factoryProfileV73.test.mjs
npm.cmd run test:factory -- --test-name-pattern "worker|publication|evidence|v73"
npm.cmd run test:recovery
```

The new test should cover exact-key profile acceptance, unknown/missing-field rejection, profile tampering, stale release-row hash, changed current validation-contract hash, registry-version drift, legacy jobs with no profile, pinned new-job immutability, mixed-profile group rejection, and `evaluationCacheKeyV73` separation by contract hash. A non-mutating SQL dry run is not needed because no migration is proposed.

After code application, verify build trace presence for both new runtime helpers and exercise `publicationEligibility` with a v7.3 record against (a) no release, (b) mismatched contract hash, and (c) matching current release. No provider calls are part of these checks. A live publish, deployment, or manifest release remains a separate owner-controlled action.

## Current blocker

The active C campaign remains frozen on v7.2 and its 24 profile-bound paths. The separate v7.3 fresh runner's 18 bound files also remain unchanged. The manifest currently has no v7.3 release; consequently profile creation, enqueue, worker validation, publication, and student eligibility all reject v7.3 until a measured current release exists. No study results or fresh outputs were read.
