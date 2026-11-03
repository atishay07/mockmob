# Question generator handoff (8 Oct 2026)

Read first: `docs/brain/GENERATOR-OPERATING-RULES.md`, `docs/brain/QUALITY.md` (CUET-fit contract), the 8 Oct entry at the top of `docs/brain/STATUS.md`. This file is the long form. Detail lives in `REPORT.md`, `RUNBOOK.md`, `PREREGISTRATION-study-1/2/3.md` and `benchmark/` beside it.

## 1. Honest state

The generator is **not perfect and not released**. Do not claim otherwise.

- No v7 topology has a release in `data/calibration_manifest.json`, so no v7 content can reach students. `dual_blind` (Luna blind solve + Gemini blind solve + Luna explanation audit) **failed** the preregistered fresh release on v3: 1/47 planted defects accepted (limit 0), valid survival 0.769 (min 0.85), and 26 of 122 calls unusable (see 4).
- **v7 has never been run as a live generator.** No 100-candidate campaign was executed. We have no measured v7 yield, cost per usable question, or rejection mix. All v7 numbers are benchmark numbers on small author-keyed sets.
- Possible regressions I introduced (treat as real until disproved):
  - v7 is **stricter and more complex**: valid survival is 77% on fresh data, so yield and cost per usable question may be worse than the legacy pipeline (legacy: about USD 0.0085 gross per usable question in completed cohorts; conditional 10k about USD 96). v7 cost per usable question is unmeasured.
  - Many rubric rules, the 132-word reading cap, the effort policy and prompt changes were chosen after seeing v2/regression data. They are tuned-on, not validated. Only v3 was fresh, and it did not pass.
  - Validators are **inconsistent on the same defect class** (conditional answers): the same Economics question was rejected as the valid twin and accepted as the defect twin. That is noise, not a fix.
  - Benchmark fixtures are author-keyed (by me), small (61 + 76 + 123 + 42) and some defect labels are arguable. Zero false accepts on them still has a wide upper bound.
  - I left the 662 published questions un-reassessed under v7 (151/662 done). 136/662 (20.5%) exceed the 132-word reading load; they are published and served.
  - Gemini alone is lenient; dual has not been shown to catch more than Luna alone on benchmark defects. It is kept because the owner said not to remove validators.
- The legacy v6.2 contract (hash `d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399`) is untouched and still used by the cohort-010 collector.

## 2. What exists (source, tested, not deployed)

- Rubric `data/cuet_fit_rubric.mjs` (5 anchored 0-3 criteria; time = 8 s + words/3.3 + 18 s/step; reading cap 132 words = longest authentic non-passage PYQ).
- Evidence/release gate `data/cuet_fit_evidence.mjs`, routed from `data/evidence_registry.js`. Verifier `cuet-fit-validator-v7.1`, policy literal `cuet-llm-v3` (the saved publication RPC accepts only that).
- Pipeline: `scripts/pipeline/lib/{factoryEvidenceV7,verifyV7,cuetFit,authorIntegrityV7,contractV7,focusedBriefsV7,cuetFitBenchmark}.mjs`; tools in `scripts/pipeline/tools/` (`runCuetFitStudy`, `releaseCuetFitTopology`, `cuetFitFactory`, `prepareCuetFitCampaign`, `compareProviders`, `reassessApprovals`, `ledgerSummary`, etc.).
- Cost levers built: effort policy v1 (Luna blind `medium` only for English synonym/antonym/correct_word_usage/matching, else `high`; explanation `high`; Gemini `medium`), OpenAI flex tier (50%), waves of at most 10 with circuit breaker, option-label normalisation (186 of 360 historic paid repairs were label prefixes), tolerant verbatim-quote integrity (16/62 historic rejects would pass), credit exhaustion as retryable stop, Anthropic provider (Haiku 5.5, measurement-only).
- Tests: `generatorInvariants.test.mjs`, `cuetFitV7.test.mjs`, `creditExhaustion.test.mjs`, `factoryFailure.test.mjs` (22 pass in the first two, last run 8 Oct).

## 3. Research findings worth keeping

- **Luna effort:** medium is about equal to high at about 55% of the cost, except it missed conditional-answer defects that only high caught. Hence the policy above. Luna high truncates about 15% at the 7500-token output cap.
- **Gemini 3.8 Flash:** most of the owner's credit. Realtime about USD 0.0114 per medium call, the largest cost in `dual_blind`. Low effort was more lenient and caught no unique defect. Price doubles on 1 Jan 2027.
- **Claude Haiku 5.5** (`claude-haiku-5-5`, USD 0.10/0.50 per M tokens, batch half, 1M context, adaptive thinking via `output_config.effort`, same text is about 30% more tokens than Haiku 4.5, may return `stop_reason:"refusal"`): about USD 0.003 per validation call, strictness close to Luna, catches conditional-answer defects Gemini misses. On tuned-on sets: `luna_haiku` 1/84 defects accepted, valid 24/29; `haiku_gemini` 2/84, valid 25/29; `dual_blind` 0/84, valid 25/29. It has **not** been run on fresh data.
- **OpenAI web search** costs USD 10 per 1,000 calls plus content tokens; not suitable in the per-question loop (facts must be entailed by registered excerpts). Allowed only to acquire new authoritative sources, outside the loop.
- Deterministic bank audit: legacy 1-10 judge scores agree exactly with the new rubric on 10.1% (Spearman 0.21), so the old scores are not evidence of CUET fit. Matching questions have a median 144 reading words.
- Spend: USD 20.05 of the USD 50 lifetime ceiling committed (19.81 settled, 0.24 held, 8 unresolved holds). No invoices obtained; receipts and holds are not invoices.

## 4. Open problems and traps

- 26 v3 calls were left `provider_request_unresolved_do_not_resubmit` because I killed a worker mid-flight; held at maximum, never resubmit. 21 v3 fixtures have a missing evaluation. Never kill workers; drain them.
- Cohort 010 (legacy collector): 9 authoring requests accepted, OpenAI batch `batch_6ac631…` partially complete. Never resubmit; never edit files hashed by the legacy contract while it is incomplete.
- `data/pipeline-prices.json` expires 2026-10-12: re-verify prices first.
- Benchmarks read before a change are regression evidence. v1, v2, regression and v3 are all spent for effort-policy-v1.
- Production publication and migration need explicit owner approval and a deployment containing `data/cuet_fit_evidence.mjs`. Never print or commit keys from `.env.local`.

## 5. Path to the best achievable generator (ordered)

1. **Measure before polishing.** Run the two preregistered 100-candidate staging campaigns (baseline vs improved arm) with `prepareCuetFitCampaign.mjs` and `cuetFitFactory.mjs worker --staging --once --realtime-all`. Stop the legacy collector first only if cohort 010 is terminal. Report yield, cost per usable question, every rejection reason, repairs and failures in the denominator. This tells you whether v7 is better or worse than legacy. If worse, say so and decide whether to simplify.
2. **Build a larger independent benchmark (v4).** At least 150 items, keyed by someone other than the generator's author (authentic PYQs with official keys, plus defects from real published failures and audits), frozen and preregistered before any model sees it. Include "valid but unusual" items so false rejections are visible.
3. **Fix the validator inconsistency on conditional answers.** Add a deterministic or second-pass check that an answer holds under standard textbook assumptions, a rule for when an implicit simplification is acceptable CUET practice, and a clear label policy for arguable defects. Retest on v4 only.
4. **Decide the Haiku slot on v4.** Candidates: Haiku replacing Luna's blind slot (cross-family from the Luna author), or a third validator. Keep Gemini on the highest-token tasks (owner priority). Run it only on fresh data; no exploratory use of v4.
5. **Cut cost only where measured.** Flex tier, batch where latency allows, prompt caching, effort per stage, and repair avoidance. Never remove a validator (owner rule). Re-forecast after Gemini's 2027 price doubling.
6. **Fix the published bank.** Finish the 662 reassessment, then withhold or flag only through the existing atomic publication path, with a dry-run report first. Start with the 136 over-length items.
7. **Release only by rule.** `releaseCuetFitTopology.mjs --topology dual_blind --tag <v> --fresh v4` (dry-run first). Needs 0 fresh and 0 regression false accepts, valid survival at least 0.85 with each subject at least 0.70. After release, scale in steps of 1,000 with a human-free audit sample and keep all failures in the denominators.
8. **Accept the ceiling.** Model agreement is not truth. Report measured limits with confidence bounds; never claim perfect accuracy or uniformly premium quality.

## 6. Owner preferences to respect

Do not remove validators or Gemini/OpenAI. Batches of 10, time is not a constraint. Keep important findings in the project brain. Gemini holds the most credit. Real answers over reassurance: the owner has said the generator is not perfect and may have regressed.
