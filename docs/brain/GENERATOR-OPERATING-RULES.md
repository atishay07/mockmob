# Question generator: standing rules (owner, 7–8 October 2026)

These are invariants. Optimise cost and quality inside them; never by breaking them. `scripts/pipeline/tests/generatorInvariants.test.mjs`
fails if code drifts from the ones that can be checked mechanically. Update this file in the same change as any rule it describes.

1. **Validators are never removed to save money.** The only publishable topology is `dual_blind`: GPT-6 Luna blind solve (key hidden), Gemini blind solve,
   Luna explanation audit, plus the free deterministic checks. Single-validator topologies exist for measurement only (`PRODUCTION_TOPOLOGIES` in
   `data/cuet_fit_evidence.mjs`). Cost is reduced by tuning reasoning effort, batching mode, repair avoidance and yield, never by deleting a check.
2. **Effort is a measured, per-stage setting.** Luna is cheap; cost comes from reasoning tokens. Authoring stays `high` for now. Validation and explanation
   effort are set only from a frozen-benchmark measurement (no more false accepts than `high`, no worse valid survival) and are stamped into every signed
   record; a release binds the exact levels. Re-measure after any prompt change. Table and evidence: REPORT in `artifacts/question-factory/cuet-fit-2026-10-07/`.
3. **Waves of at most ten.** Campaigns are worked ten candidates at a time (`MAX_WAVE_SIZE`): each wave sees what the last one approved (avoidance), and two
   consecutive waves under 40% yield stop the campaign. The denominator, repairs, failures and costs stay in one fixed preregistered campaign; nothing is regenerated.
4. **No web search in the per-question loop.** It costs USD 10 per 1,000 calls plus content tokens (about ten Luna validations per call) and would feed
   non-authoritative facts into items whose every fact must be entailed by registered authoritative excerpts. Web search is allowed only for acquiring new
   authoritative sources for a coverage gap, outside the loop, and the source must then be registered with permission, version and locator.
5. **CUET fit is calibrated on authenticated PYQs.** Reading length is compared with matched subject/format examples where the sample supports it; the 132-word
   historical maximum is descriptive, never a universal NTA limit. Time uses a clearly labelled heuristic, not measured candidate timing. Missing or thin matched samples
   fall back to that estimate without claiming a word-limit failure. Claimed conventions must cite source evidence and cannot fill missing case-specific facts. The format and difficulty
   mix of a campaign follows `CUET_FORMAT_PLAN` in `focusedBriefsV7.mjs`; passages are complete groups (English ≤ 300 words); Accountancy alternatives stay separate;
   the 2026 baseline (50 questions, 60 minutes, +5/−1/0, 250) is provisional for 2027. Each new subject segment needs inventory before NTA mode can assemble it.
6. **Contract changes are versioned, never in place.** Files hashed by the legacy contract (`compactBenchmark.mjs` list) stay frozen while a registered cohort is
   incomplete; new behaviour lives in v7 files. A prompt, rubric or effort change creates a new verifier version and needs a fresh frozen benchmark; a benchmark that
   was read before the change is regression evidence, not fresh evidence.
7. **Uncertainty is quarantined.** No routine human review, no forced publication, one targeted repair at most. Model agreement and ratings are not truth.
8. **Money.** Reserve before every call; retries and failures count; USD 50 lifetime content ceiling (owner may change it, nobody else); student AI USD 25 per IST month.
   Exhausted provider credit stops the worker with candidates retained and the same request key is retried after top-up. Receipts and holds are not invoices.
9. **Production is never migrated or published implicitly.** v7 records keep `policy_version = cuet-llm-v3` (the saved publication RPC accepts only that literal).
   Student-facing publication of v7 content needs the owner's approval and a deployment containing `data/cuet_fit_evidence.mjs`.
10. **Record what happened.** Every change records tests, deployment needs, rollback and uncertainty in `STATUS.md`; measured limits are reported, never perfection.
11. **Providers are slots, not a roster to shrink.** Luna, Gemini and Claude Haiku 5.5 all stay wired and budget-guarded. `dual_blind` (Luna + Gemini) is the only publishable topology
    until another one passes the release rule on a fresh benchmark; Haiku topologies (`haiku_gemini`, `luna_haiku`) are measurement-only. Gemini has the owner's largest credit
    balance, so high-token work belongs to Gemini first. Gemini list price doubles on 1 Jan 2027: re-forecast then.
12. **Never kill a worker mid-flight.** A killed process leaves realtime requests unresolved; the guard refuses to resubmit them, they stay held at their maximum and the
    benchmark loses coverage. Stop workers by letting them drain (or with the worker's own stop path), never with a process kill.
13. **A failed release is reported, not tuned around.** The release rule is preregistered; a defect label may not be reclassified after the result, and a spent benchmark becomes regression evidence.
