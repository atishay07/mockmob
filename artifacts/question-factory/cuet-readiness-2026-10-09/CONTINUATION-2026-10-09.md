# Generator execution round, 9 October 2026 — continuation checkpoint

Owner resumed scoped optimization (guarded qualification and generation) inside the unchanged USD 50 lifetime content ceiling. Production publication, deployment and migration still need final explicit approval. Workflow: Opus orchestrates; Sonnet subagents do heavy implementation; Haiku subagents do bounded tasks.

## Checkpoint 1 (milestone: repeated ideas prevented before paying) — no paid calls

Ledger (read-only `node scripts/pipeline/tools/ledgerSummary.mjs`): USD 33.954560 settled + USD 0.499296 held = USD 34.453856 committed; 36 unresolved; unchanged since 8 Oct. No provider invoice. No active factory workers (only MCP/browser node processes).

Changed/added:
- `scripts/pipeline/lib/batchInspection.mjs` — inspection v4; step matching now also requires equal units and polarity (negation). Tests: different units, negated steps, distinct procedures with shared vocabulary.
- `scripts/pipeline/lib/ideaAllocation.mjs` (new) — `ordering-source-allocation-v1`: one ordering idea per registered source; consumption derived from inventory + planned briefs + persisted append-only ledger `data/question-factory-runtime/idea-allocations.json` (created on first campaign allocation).
- `scripts/pipeline/lib/briefDiversity.mjs` — ordering briefs skip consumed sources; exhaustion returns `{state:'gap', gap:'ordering_source_pool_exhausted'}` (`isIdeaGap`); Para Jumbles accepts `mockmob-original-stimulus-(diverse|v2)-` ids.
- 13 new reviewed original Para Jumbles stimuli with distinct discourse structures (claim→example→implication, problem→consequence→lesson, concession, analogy, spatial, notice, etc.): `data/question-factory-runtime/original-parajumble-stimuli-2026-10-09.json` (1 draft rejected for inconsistency), registered as overlay `data/question-factory-runtime/original-stimuli-overlay-2026-10-09.json` by `scripts/pipeline/tools/registerOriginalStimuliOverlay.mjs`. Base `data/source_registry.json` deliberately untouched (registered studies bind its hash).
- Simulation against actual inventory (bank reassessment + A/B/C eligible): the 8 old stimuli are never reused; 13 new are allocated once each; the 14th request returns the explicit gap.

Reference-answer custody (v7.4 prospective 16-case packet): second independent blind solve by a Sonnet subagent (read only the blinded packet) → `ROOT-SECOND-BLIND-SOLVE-v1.json` sha256 04a9fd02…; first solve e4eceaf7…; agreement 14/16; both reviewers hold `bs-q03` and `en-q1-v` (multiple defensible answers). Record: `REFERENCE-ANSWER-CUSTODY-v1.json`. Official CBSE 2022-23 marking schemes downloaded with owner approval to `marking-schemes-v1/` (hashes recorded there); extraction in progress.

In progress (subagents): publish-time inspection enforcement on every publish route (audit found `factory.mjs` queue worker and `publishProductionCohort.mjs` lacked it); v7.5 author/judge contract (preparation-value checks); official-key extraction.

Next command after these land: `npm run test:factory` then freeze v7.5 (`node scripts/pipeline/tools/freezeContractV75.mjs`) before constructing the qualification set.

## Checkpoint 2 (before first paid phase) — v7.5 qualification

v7.5 frozen (contract 54e40f33…, prompt 6b551626…). Studies registered (`prepare`, unpaid): fresh `benchmark/v75-fresh-cbse2022-2026-10-09` (27 fixtures: 13 positives, 2 natural + 12 seeded defects; frozen.json sha256 29276dbb…), regression `benchmark/v75-known-critical-regression-2026-10-09` (12: 4 positives, 8 defects; frozen.json 8207e6e1…; one irrelevant goodwill reference removed from known-bank-5bde… to fit the input bound, learning objectives added — disclosed). Builder: `scripts/pipeline/tools/freezeV75QualificationSets.mjs`. Network launcher now allows the v7.5 runner and pilot runner. Ledger before dispatch: USD34.453856 committed. Plan cap USD4 (fresh + regression).

Commands (sequential, never concurrent on the ledger; never kill an in-flight run; rerunning `execute` resumes without resubmitting accepted keys):
node scripts/pipeline/tools/runFactoryWithNetworkPreflight.mjs scripts/pipeline/tools/runFreshCuetReadinessV75.mjs execute --approved --study-dir artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v75-fresh-cbse2022-2026-10-09
node scripts/pipeline/tools/runFactoryWithNetworkPreflight.mjs scripts/pipeline/tools/runFreshCuetReadinessV75.mjs execute --approved --study-dir artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v75-known-critical-regression-2026-10-09
node --use-system-ca scripts/pipeline/tools/runFreshCuetReadinessV75.mjs report --study-dir <dir>
