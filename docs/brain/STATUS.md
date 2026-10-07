# Implementation status — latest update: 7 October 2026

## 7 October 2026 — owner-approved production release and cost optimization (ongoing)

- Update 06:00 UTC: two fixed 100-candidate cohorts are complete. Original: 50 approved/50 rejected/$0.515798; native cohort 002: 53 approved/47 rejected/$0.482092. All **103** newly approved items are published in staging and production database. Signed-in staging student retrieval verifies all 103 exact keys/options/explanations and two complete passage groups; no rejected item retrieved. Production student availability of new factory items still requires the pending owner signing-key entry; it is not counted as verified delivery.
- Production compatibility release **9bf60d0cf6e4faaf62ef12dfeae048d7fa90e6c7** is Ready (49-second Vercel build). Its actual public feed again returns existing library questions in all four subjects. Fixed a regression requiring screening receipts on every pre-existing row; existing holds and any failed/stale receipt still withhold a row, and modern factory evidence/provenance cannot use legacy compatibility. 313 factory, 35 recovery and 61 question/payment checks pass; production build passes.
- Atomic publication caught three individually approved children with differing chapter classifications in one registered passage. The publisher stopped correctly. Prepublication inspection now uses that same unchanged group contract and quarantines the entire affected group before RPCs. Three additional removals reduced native cohort 002 from 56 to 53; no forced repair, rewritten answer or score inflation.
- Cohort 004 authoring finished with 87 responses and 13 provider-confirmed invalid-schema failures: strict quote enums cannot contain newline characters. Failed requests remain in its denominator. New author contract v3 uses exact contiguous source spans without control characters. Existing accepted v2 bodies and idempotency keys are preserved byte for byte; no accepted ID is replaced. Regression tests cover both.
- At 05:59 UTC the actual lifetime ledger was $9.230111 committed, including pending validations and conservative holds. This is a dated snapshot, not a final cost or provider invoice. Cohorts 003–005 are still in progress. **500 registered candidates is not 500 approved questions.** The guarded worker continues toward 500 new usable publications; current-author-contract forecast remains unmeasured until complete cohorts exist. Content cap stays $50; student cap stays $25/IST month.

- Update 05:13 UTC: original 100 remains completed, 50 production database publications. Four fixed continuation cohorts (002–005) are processing; 500 registered candidates including the original is not 500 approved questions. Usable published staging remains 50. Current committed ledger total $8.727080 includes all conservative holds; global accounting is not fully settled and no invoice is obtained.
- Latest full pipeline suite: 295/295 pass; subsequently added economics tests 3/3 and checkpoint tests 3/3 pass. Legacy test fixtures now reflect the existing five-child contract, current passage limit, optional author metadata and required telemetry. Mandatory independent academic gates remain unchanged.
- Fixed stale undefined `forecast` references in signed-in checkpoint controls. Actual authenticated staging release_1000 and replay return success; an unfunded release_10000 returns 409. Pending new cohorts retain the completed original pilot and use completed cost measurements for checkpoint funding. Actual paginated student feed returns all 50 approved questions with exact keys/options/explanations/passages; rejected questions absent; monthly student-AI cap 25.
- New transport recovery collects output and error files, preserves failed usage receipts, and never resubmits saved IDs. Four failure-receipt tests and tested bounded scheduler concurrency/receipt-only continuation pass. New authoring constrains quote selection to actual excerpts; future briefs diversify cached source sections, 14 inspected dictionary definitions and 32 original fictional stimuli. Retrieved actual NCERT Directing columns and brief official NISM/SEBI market definitions are source material pending independent per-question entitlement/entailment, not academic certification.
- Consolidated denominator/cost export and paginated staging/production retrieval commands are implemented in docs/brain/QUESTION-FACTORY.md. Improved unit costs remain unmeasured until the new fixed cohorts finish. Production signing-key owner handoff remains pending; no final student-access or 500-question completion claim.

- Owner explicitly approved deployment of the 50-question subset and continued bounded generation toward at least 500 usable questions and a conditional 10,000-question forecast below $100. The $50 content ceiling remains unchanged; $70 was a scenario.
- Applied only the saved additive factory migration to production project isrxrxzjocewrdureyhp; transaction succeeded. Published 50 approved questions through atomic RPCs with current stored evidence valid. Production student retrieval remains unverified until the release and signing configuration are complete.
- Prepared isolated release 0d961f1f3833732b9a0b5c5db0de48f012312432 on current origin/main, preserving newer product features and the original dirty checkout. Release build passes; factory 107, recovery 35, question/payment 61 checks pass. Dynamic evidence JSON is explicitly included in serverless file tracing.
- Checkpoint budgeting now measures the requested 1,000/10,000 checkpoint against committed costs and retained holds; a $103 ten-thousand forecast cannot block an affordable 1,000 checkpoint. Persistent per-call enforcement stays $50. Two boundary/missing-measurement tests pass. Cross-cohort duplicates and atomic sibling withholding have two new tests.
- Next fixed cohort cost-native-cohort-002: 100 candidates, 25 each, actual staging coverage before = 50. All author IDs accepted once in batch_6ac5c5843ad88190b6c2b448588f11f9. Native batch pricing for generation, blind checks, repair and explanation auditing; academic contracts unchanged. It is pending and is not counted as a completed yield. Current conservative committed total $7.490159 includes $0.367300 pending cohort reservation and historical $0.011096 hold.
- Missing production signing secret: owner handoff requested for the existing CUET_EVIDENCE_SIGNING_KEY from .env.local into the prepared Vercel Production secret form. Browser credential-entry policy requires owner entry. No secret printed or sent in chat; independent batch work continues.

## 7 October 2026 — completed original live generator execution (staging history)

- Working pipeline: usable official-syllabus coverage → focused cached decisive excerpts → GPT-6 Luna generation → blinded Luna and independent Gemini checks → explanation audit → automatic inspection → atomic publication → refreshed coverage. Original practice does not require a PYQ anchor; authentic PYQ labels retain strict authentication. Sixteen mandatory gates among 19 criteria cannot be offset by craft scores; overall craft 7–10 may pass. At most one targeted repair.
- Finished all 100 preregistered candidates, 25 per subject, including all accepted provider requests and receipts. Unique approved: **50**; withheld: **50**. Approved counts: English 10, Accountancy 19, Business Studies 12, Economics 9. All 50 are newly published in separate staging and retrieved through the actual signed-in student API. Production publications/writes: **0**. No fixtures, historical passes or queued requests contribute to yield.
- Gross cohort usage cost: **$0.515798**, holds **$0**; gross cost per approved question **$0.01031596**. Fresh final benchmark $0.120406; all calibration/preparation attempts $0.422157; execution with preparation $0.937955. Lifetime settled $7.111763 plus saved historical 503 conservative hold $0.011096 = **$7.122859 committed** under unchanged $50 ceiling. Provider invoices were not obtained; the lifetime amount is not fully settled.
- Conditional marginal cost for 10,000 approved questions: $103.159600; conditional lifetime cost to that target: $109.766661. It does not fit $50–70 at measured yield/pricing. Remaining $50 capacity conditionally supports 4,156 additional approved questions (4,206 including these 50). $60 and $70 remain scenarios, not authorization. Reasoning, rejected outputs, independent checking and repair are included, with stage costs in REPORT.md.
- Fresh frozen benchmark: 12/12 valid retained, 0/12 controlled defects accepted; both independent blind providers 12/12 positive keys correct. Eighteen old regression examples withheld separately. The 12-defect sample gives a 22.09% one-sided 95% upper bound, not proof of perfect reliability. Live inspection caught model-passed missing financial-enterprise status, an unsupported clause generalization and uncertain step ordering, and withheld them before publication. Free duplicate/provenance guards also removed surplus items. Model agreement does not prove truth; no extra academic regeneration inflated yield.
- Staging project onwkqxmjqjrhfbjjdydu: 47 migrations dry-run then applied only to separate staging. Signed-in admin authorization/controls, worker restart preserving the original batch ID, idempotent publication, complete passage-group atomicity/rollback, actual student keys/options/explanations/full passages and dispute invalidation pass. Repeated publication retains exactly 50 rows and no new paid requests. Signed-in 10-question quick quotes are available for English, Accountancy and Business Studies; Economics correctly refuses because only nine exist. No complete 50-question subject paper is claimed.
- Fixed JSONB key-order changes invalidating signatures using canonical signing with legacy compatibility. Re-signed only matching staging evidence envelopes and retained originals; no key, explanation or provider-receipt edits. Fixed null answer-index fields overriding letter keys. The storage compatibility amendment preserves academic prompts/oracles/decisions; it was not labelled a new unseen paid benchmark. Progress writes now use 25-row chunks after a repeated 100-row write hit a statement timeout, and completed worker ticks do not republish.
- Current coverage: 50 usable unique questions across 32 of 51 official chapter cells. Format/difficulty/duplicates/branch and independent topic observations are exported. Ambiguous fine-topic tags leave gaps open. Accountancy financial-analysis/common and computerized alternatives remain separate. 2026 rules are provisional for 2027; English passages stay within 300 words.
- Final checks: **105 factory, 35 recovery, 84 learning, 54 question/payment, 7 discovery-feed tests pass**; final optimized production build passes with the two existing image dimension warnings. Rendered admin and actual student answer/passage screens inspected; screenshots saved in staging/. Separate student AI $25 per IST month, existing entitlements and historical receipts remain intact. No captured production payment verification is claimed.
- Staging worker is paused after completion. Runbook: docs/brain/QUESTION-FACTORY.md. Completed evidence and exports: artifacts/question-factory/execution-2026-10-07/REPORT.md, original-candidates.json, all-100.json/.csv, approved-records.json, rejected.json, receipts.json, coverage-after.json and staging/.
- Remaining external gates: owner approval for the prepared additive production migration, reviewed generator deployment and these 50 publications; and exact provider usage/billing confirmation for historical request req_b4d44cd7e2164c18bda70d533c3683d5. Organization usage API returned 403 and the provider billing page needs owner sign-in. Retain its full hold; valid bounded holds permit unrelated work. No production migration was applied. Earlier sections below are historical; 10/10-only requirements are superseded by the owner's 7–10 craft threshold.

## 7 October 2026 — premium factory implementation and explicit unresolved gates (Codex)

- Implemented frozen ledger-bound unseen-benchmark registration, prior-exposure rejection, current-syllabus/300-word preflight before paid preparation, guarded cache-only recovery, full campaign economics and an acceptance report. Added 14 NCERT reference documents and 21 anchor reference attachments; source foundation is not calibration proof.
- Fixed underscore exam blanks being falsely rejected as Markdown. Disabled oversized English and out-of-scope legacy generation anchors. Current verifier v5.6 enforces the owner's 10/10 craft floor; no blocking academic defect can be offset by a score. Earlier 7/10 admission is historical.
- Current source registry 55: English 1/7, Accountancy 9/15, Business Studies 4/12, Economics 5/17 tracked topic groups have active supported generation anchors. 32 gaps remain.
- OpenAI 503 returned no usage receipt: request req_b4d44cd7e2164c18bda70d533c3683d5; unresolved reservation $0.011096 remains held. Lifetime settled $6.172435, all holds $0.018283, available $43.809282 under unchanged $50 cap. No new paid calls after the unresolved response.
- Saved v5.4 probe: four candidate checks pending; four of six saved native batch IDs completed, two submitted. Receipt-only recovery does not resubmit accepted IDs. New premium contract requires renewed proof.
- Frozen v5.4 benchmark preserved: 31 positive observations (16 machine-eligible, 15 quarantined), seven completed negatives with zero accepts, six distinct pending fixtures. Six 335-word English items violate the current 300-word limit; no valid-difficult coverage. The fixture file is rejected by free preflight and cannot release current calibration.
- Historical v5.5 known-defect regression: 18/18 quarantined. Current v5.6: five completed free quarantines, thirteen uncached checks pending; no false accepts. Neither pending nor historical checks count as current release evidence.
- Supabase dashboard checked: mockmob has only production project isrxrxzjocewrdureyhp, no branches; Campusos has zero projects. No staging project exists. Production REST factory control lookup returned PGRST205/404. No production migration, deployment, publication or credentials changed.
- Verified 156 tests (76 factory, 35 recovery, 45 answer/selector/payment), targeted lint, final build, local preview HTTP 200 and browser coverage expansion; admin API unauthenticated HTTP 401. Signed-in admin/restart/atomic publication/dispute flow still requires separate staging. Existing build image-size warnings are unrelated.
- Evidence: artifacts/question-factory/implementation-2026-10-07/acceptance.json, first-frozen-benchmark-recovery-v54.json, staging-evidence.json and logs; regression campaign history preserves older contracts. No completed premium native-batch cohort supports 10,000 within $50–60. Keep generation/publication paused; do not reset unknown usage holds.


## 6 October 2026 (evening) — 100-candidate measurement cohort, independent audit and forecast (Claude)

Owner chose a measure-only run while calibration retention (80.6%) is below the 85% release floor. Nothing is
publishable: publication eligibility still requires the released manifest. Evidence: `artifacts/question-factory/quality-v5/`
(`results.json`, `cost-and-cohort-report.json`, `independent-audit.json`, `audit-export-*.txt`).

- Cohort (preregistered, 25 per subject, verifier v5.3): 100 planned, 96 generated, 58 machine-eligible, 0 published.
  Adaptations 52/84, authentic originals 6/16. By subject: English 7, Accountancy 13, Business Studies 17, Economics 21.
  58 distinct fingerprints; 36 anchor families; formats include matching, statement selection, assertion-reason,
  numerical and case items; difficulty 29 easy / 29 medium / 0 hard. Rejections: source support 15, repair abstained 13,
  evidence quote not in sources 4, syllabus/chapter 4, duplicate inventory 3, other 3.
- Independent audit (Claude subscription session, not publication evidence): 41 publish-ready, 8 acceptable but weak,
  7 defective, 2 duplicate ideas. Defect classes: self-labelled options, definition-phrase synonym options, an
  arguable assertion-reason, a flattened authentic list, near-duplicate ideas across anchors, weak distractors.
  New deterministic lint now rejects 5 of the 7 defects at zero model cost (tested).
- Cost: lifetime gross $5.73 of $50 (remaining $44.27); campaign window since top-up
  $2.57; cohort $1.13 = $0.0194 per machine-eligible item.
  Largest cohort stages: Luna blind checks, Gemini evaluation, authoring, blueprints. Google credit deductions unverified.
- Forecast: 10,000 at the measured real-time rate ≈ $200.12 lifetime; achievable with the remaining budget
  ≈ 2277 eligible. Batch pricing (ESTIMATE, not demonstrated): ≈ $102.92,
  ≈ 4554 eligible. Bulk spending stays paused: 10,000 within $50 is not met.
- Remaining gates: calibration retention release (or owner threshold decision); demonstrate batch execution;
  restore presentation of flattened authentic originals; cross-anchor idea deduplication; staging migration,
  authenticated worker/dashboard proof and atomic publication before any production step.
- Checks: factory 54, recovery 35, answer-integrity 6, NTA 22, question/payment 16 pass; targeted lint clean;
  production build passes.

## 6 October 2026 (afternoon) — Factory v5.3 gates: defect regression passed, calibration retention short; cohort not run (Claude)

Evidence: `artifacts/question-factory/quality-v5/` (every gate run archived in `history/`). No publication or site-database writes.

- Sources: approved NCERT leac102/103/202/206 downloaded once, extracted with `extractReferencePdf.py`
  (identity SHA-256, URL, syllabus version in `extraction-metadata.json`), registered via the reusable
  `registerReferenceSpans.mjs`. Every reference document carries source-backed chapter coverage.
  Generation-ready anchors 31 → 54 (Accountancy 24, Business Studies 15, Economics 12, English 3). Registry v50.
- Gates made consistent: one shared release predicate (`routeCalibrationReleased` / `factoryCalibrationReady`)
  now governs calibration, worker, publication eligibility and the ledger. Publication previously still
  applied the old 95% rules. v4+ receipts must positively carry `polish_gate: true`; academic-only
  calibration receipts are refused by publication (tested).
- Verifier v5.3: source-backed chapter rule (cited documents must cover the tag; evaluators agreeing
  elsewhere, or both leaving the unit, fail); unit-scoped syllabus and per-candidate excerpts (largest
  request 27.4k → 24.3k bytes); two independent Luna samples must both pass before Gemini is paid;
  decisive principle must be in the excerpts (journal-entry direction included); missing conditions fail.
- Correction: the 17 "fresh" fixtures were previously evaluated by v2.6/v3.0 and v4 was tuned on them; all
  calibration is a previously-observed regression check, not an unseen benchmark. Reclassifications
  (2 official items to known-bad; anchor q29 chapter metadata) are recorded in the fixture file.
- v5.3 result: audited-defect regression 0/18 accepted. Calibration retention 25/31 (80.6%) < 85%;
  numerical 2/3, passage 9/13 < 80%; keys 100% both models; 0/14 known-bad accepted. NOT released.
- Spend: lifetime ≈ $4.6 gross of $50; the 100-candidate cohort was not generated.
- Tests: factory 53 pass; targeted lint clean; production build passes. Multiline question rendering
  verified in the Arena preview (desktop and 375px, no overflow).

## 6 October 2026 — Question factory quality-v4: verifier released, generation blocked on OpenAI credits (Claude)

Owner direction: quality over yield (a 40% pass rate is acceptable once; passing items must be 10/10).
Evidence: `artifacts/question-factory/quality-v4/`. No publication, no site-database writes.

- Sources: 16 anchors gained exact NCERT spans (`scripts/pipeline/data/quality-v4-anchor-sources.json`,
  `prepareQualityV4.mjs`); generation-ready anchors 21 → 31. Registry v45. Input byte guard raised
  24,576 → 32,768 (rates unchanged). Missing chapters (Admission, Retirement, Debentures, Cash Flow,
  Staffing, Directing, Financial Markets, Consumer Protection) need NCERT PDFs the owner must approve downloading.
- Authoring `cuet-setter-v4.1`: Luna high, NTA setter rules, verbatim evidence quotes checked locally,
  deterministic presentation lint. New blueprint stage plans distinct excerpt-grounded items per anchor.
- Verifier `luna-gemini-cuET-v4.6`: academic gate plus a separate polish gate (both evaluators must score
  ≥9/10 with zero listed defects); unit-level chapter check, failed when both blind views reject the tag;
  claim-by-claim explanation audit; evaluation cache keyed on exact prompt text.
- Calibration (academic, polish off): 31 valid official items incl. 17 fresh held-out; v4.5 released with
  28/31 kept, keys 100% for both models, 0/14 known-bad accepted. Release policy `strict-quality-v4`
  (overall survival ≥85%, route ≥80%, answered key accuracy ≥95%, abstention ≤15%) replaces the 95%
  survival floor; owner may veto. Two official items moved to known-bad after written adjudication.
- Audited-defect regression: 17/18 rejected at v4.5; the circular-flow explanation was still accepted.
  v4.6 adds a rule against importing a textbook model's unstated assumptions; its rerun was interrupted.
- BLOCKER: OpenAI returned HTTP 429 credit_balance_exhausted. Four zero-cost holds reconciled; transport now
  settles credit refusals at $0. Content ledger: $3.161792 committed of $50. Gemini credits unverified.
- Next after top-up: `node --use-system-ca scripts/pipeline/tools/qualityCampaign.mjs calibrate`, then
  `audit-regression`, `plan`, `generate`; then independent audit of every eligible item.
- Tests: factory 49, recovery 35, question/payment 16, answer-integrity 6, NTA 22 pass; targeted lint clean.
  Production build not rerun for this change set. Test runner question text now preserves line breaks.

## 4 October 2026 — Mobile refinement publication authorized (Codex)

The owner explicitly requested committing these changes to the live website. Publishing
the verified mobile refinement through `main` and the existing Git deployment integration.
Physical-device/background-tab acceptance and the inconsistent throttled LCP result remain
documented limitations, not completed checks. No database or environment changes are part
of this publication. Deployment completion is to be checked against the live domain.

## 4 October 2026 — Mobile refinement implemented locally (Codex)

Owner approved implementation and the public companion name **Mobi**. Detailed changes,
measurements and limits: `MOBILE-REFINEMENT-IMPLEMENTATION-2026-10-04.md`.

- Lab starts only when its content is readable. One clock pauses offscreen/hidden;
  manual steps pause and explicit Replay restarts. Compact phone controls and natural
  panel sizing; Mobi uses contained local reactions, preserving desktop travel.
- Phone hero/exam palette refined. Practice summary repaired at 320px (390px → 166px).
  Result Find shortened through disclosure (1247px → 399px at 390px). Light answer-state
  contrast corrected; navigation glass has opaque accessibility fallbacks.
- Arena header now sticks correctly. More opens without page jumps, scrolls between
  measured header/dock bounds, and restores opener focus on Escape. Final checks at
  320px, 390px with 200% text, and 844×390 landscape reached the last account action.
- Responsive matrix: 56 homepage/Practice/Result/quick-runner configurations across seven
  widths and both themes; no root overflow or page exceptions. Timing, reduced motion,
  text zoom, Mobi fallback, both NTA skins' answer/palette flows, public demo, theme
  persistence and free/error states verified in development fixtures. Result contrast
  scans had no flagged text. Evidence: `artifacts/mobile-refinement-2026-10-04/`.
- Lint/build passed. Recovery 35, learning 80, NTA/answer-integrity/payment 40: all 155
  tests passed without skips. Diff whitespace check passed. Build EPERM was resolved by
  approved filesystem access, with no cache deletion or configuration workaround.
- Isolated Slow 4G/4× CPU production samples: CLS 0; LCP 1.604–3.532s, so the 2.5s
  target is not consistently met. Physical Android/Safari, actual background-tab resume,
  assistive technology and real signed-in acceptance remain open. Local emulation does
  not establish hardware or production readiness. No paid model, migration or deploy.
- Preview: localhost:3010. Temporary production server 3011 stopped. Existing edits/
  untracked artifacts preserved. No commit or push; publication awaits device/performance
  acceptance and an explicit deployment decision.

## 4 October 2026 — Published mobile audit and Preparoo reference study (Codex)

Audit and plan only; no product behaviour or production changes. Plan:
`MOBILE-REFINEMENT-PLAN-2026-10-04.md`. Evidence: `artifacts/mobile-audit-2026-10-04/`.

- Live homepage: 390/1280px, both themes; Lab autoplay advances to Find while the replay
  has zero visible pixels on phones. The phone rail occupies 376px before the replay.
- Preparoo public reference: 390/1280px, wheel-scroll samples, phone illustration and
  backdrop-filter inventory. Observed mobile hero asset is WebP, plus PNG/SVG assets.
  Phone feature/explanation/preview hierarchy is the useful reference; no assets copied.
- Hydrated Arena fixtures: Practice, branded quick runner, Result at 320/390/430px,
  both themes, 18 captures. Zero document overflow/page exceptions. Narrow Practice
  cost text wraps nearly letter by letter; Result Find occupies 1247px at 390px.
  Light Result option letters produce two contrast flags (~2.75/2.82:1).
- Menu taps and Escape close verified at 320/390px. Public reduced motion shows a
  complete static replay and removes the floating guide. Initial unhydrated captures
  were rejected; localhost-origin retry restored fixture hydration without config edits.
- Next: playback readability gate + compact Lab + Practice summary + Result density/
  contrast, then phone-local mascot, previews/navigation and daylight depth. Mobi is
  a suggested name only, not an approved or implemented rename.
- Browser emulation is not physical-device proof. Real Android/Safari, screen reader,
  throttled production performance, both premium NTA skins and live signed-in workflows
  remain acceptance gates. No attempt, model call, checkout, migration or deploy ran.
  Only audit scripts/docs changed; product suites/build were not rerun. Local preview
  is running on port 3010. Existing untracked evidence directories were preserved.

## 5 October 2026 — Mistake Repair on GPT-6 Luna (Claude)

Owner chose GPT-6 Luna (USD 0.10 in / 0.50 out per 1M) for Mistake Repair: reasoning effort `low` for
the repair, `high` for the blind second opinion (`REPAIR_ROUTE`/`REPAIR_EFFORT` in
`src/services/recovery/mistakeRepair.js`; `AI_REPAIR_MODEL` overrides). `providers.js` now sends
`max_completion_tokens` + `reasoning_effort` (no temperature) to GPT-5/6/o-series and reserves budget
for hidden reasoning tokens. gpt-4o-mini remains the fallback. Price row inserted in production
`runtime_ai_prices` (owner instruction to ship now; file `20261005090000_runtime_ai_price_gpt6_luna.sql`).
Not verified: a live GPT-6 Luna call (the live eval run was blocked by the local permission
classifier). If Luna rejects a parameter, repairs fall back to gpt-4o-mini rather than failing.
Open: key disputes ("No repair for this one") still are not logged as evidence about the key; the
dispute flow designed on 5 October (soft flags, proposed key, student-was-right signal) is next.

## 4 October 2026 (late night) — Result page + Score Recovery Lab redesign after owner test (Claude)

Owner tried a 10-question quick practice (3 right, 7 wrong) and rated the Lab 5/10: no meaningful use,
weird "replay your decisions" slider, page too tall; wanted summary + Pip first, then the Lab, then
each answer with Mistake Repair. Done (see DESIGN.md "Score Recovery Lab"):
- `data/session_recovery.js` (new, pure): marks gap (6 per wrong, 5 per blank), chapters ranked by
  marks lost, per-question time from device events, factual observations. Tests:
  `data/tests/session_recovery.test.mjs` (added to `test:recovery`).
- `ResultPageClient.jsx` rewritten: summary hero with question strip → Lab → accordion answers.
  Removed from this page: ArenaHead, MistakeReplay, SessionReadout, the separate next-step block and
  the compact LearningNextAction (all duplicated the Lab). Components still exist for other pages.
- `ScoreRecoveryLab.jsx` rewritten as Find / Repair / Prove; slider replaced by a folded decision log.
- `MistakeRepair.jsx`: staged loading, two-card trap/why-wrong layout, "matched the key" check,
  auto-run when launched from the Lab queue, "Next mistake: Qn" chaining.
- `/preview/arena?view=result` fixture is now a realistic 10-question session scored by the real
  engine; `/preview/recovery` redirects there.
Verified: recovery 35, learning 80, nta 22, answer-integrity 6, du 19, payment/questions/PrepOS/repair
81 pass; lint clean; `next build` 62/62. Browser: desktop, 375px (no horizontal scroll), light theme,
Start repairing → Q2 repaired → Next mistake Q3 → Q4. Page height on the fixture fell from ~5.8k to ~3.6k px.
Second pass (owner: UI 9/10, clarity 7/10, "too much AI framing"): repair copy no longer narrates
the AI ("Why option C felt right", "Where it breaks", "Checked against the answer key"); server
held/not-explained messages rewritten the same way; sparkle icon replaced by a wrench; observations
are now tag + fact + consequence + one tip; step headers say what each step is for; mono uppercase
labels replaced with sentence case; motion added (score count-up, Pip entrance, strip stagger, bars
and chapter tracks grow when the Lab scrolls into view, repair cards stagger in; all off under reduced
motion). Owner approved commit and push to main.

## 4 October 2026 (night) — Score Recovery + AI unblocked and live in production DB (Claude)

Owner decisions in chat: names (marketing "Score Recovery", feature "Score Recovery Lab", action
"Mistake Repair"); student AI USD 25 per IST month; content generation USD 50 lifetime; AI migrations to
production "with my OK" (then explicit yes on the dry-run report); provider "whichever is best, make a
report" (AI-MODEL-REPORT-2026-10-04.md); OpenAI tonight because the Anthropic key is invalid.
Plan of record: PLAN-2026-10-04-NEXT-DAYS.md.

**Production database changes (owner-approved, applied via Supabase MCP):**
`runtime_ai_guard`, `prepos_credit_reservations`, `runtime_ai_monthly_cap` (new file
20261004120000). Dry run: reports/ai-migrations-dry-run-2026-10-04.json (PGlite rehearsal + production
precondition checks: no collisions, 879 wallets / 108 ledger rows untouched). Found and fixed before
applying: the ledger `reason` check would have rejected every reserve/release (all paid replies would
have failed); a single missing-usage response paused all student AI; prices expired after 30 days.
Verified after apply: cap 25, prices for claude-haiku-4-5, claude-sonnet-5-5, gpt-4.1-mini, gpt-4o-mini
(gpt-4o-mini added by SQL insert), all functions present, readiness script all green.

**Code:**
- `RELEASE_GATES.runtimeAi = true` (PrepOS replies + Mistake Repair); new `aiCommerce = false` keeps
  top-up checkout and charged Rival battles closed (order route, packs, pricing page, Rival).
- Anthropic provider in `src/services/ai/providers.js` (SDK retries off, per-model params: Sonnet 5.5
  without custom temperature / thinking off). `.env.local` routing: OpenAI gpt-4.1-mini fast+smart,
  gpt-4o-mini fallback (Claude routing documented for when the key is fixed).
- **Mistake Repair**: `data/mistake_repair.js` (eligibility, solve-then-explain prompt, blind second
  opinion, output validation incl. banned score/rank promises), `src/services/recovery/mistakeRepair.js`
  (1 PrepOS credit via reserve/commit/release; finished repair stored on the committed reservation and
  reopened free; dispute → blind check → question withheld exactly like a student report, credit
  released), `POST /api/recovery/repair`, `src/components/recovery/MistakeRepair.jsx` on result-page
  wrong answers with "Prove it: 5 fresh questions on this chapter".
- Budgets: AGENTS.md rewritten (limits are owner-set; do not invent stricter ones);
  `CONTENT_LIFETIME_CEILING_USD = 50` in budgetLedger.mjs; COST-POLICY, QUALITY, ROADMAP, README,
  PRODUCT, DECISION, IMPLEMENTATION, BACKLOG, LEARNING-DEPLOYMENT reconciled.

**Verification actually run** (logs: artifacts/ai-night-2026-10-04/):
- Live smoke through the production guard: gpt-4.1-mini ×2, gpt-4o-mini ×1 valid JSON, receipted
  (~$0.00007 each). Anthropic: 401 invalid key (booked conservatively, no pause).
- Live Mistake Repair eval on 10 real published bank questions: 10/10 solved = key, explained,
  $0.0038 total. Sample was all Accountancy (selection by ID order) — not representative.
- Tests: recovery 30/30, learning 80/80 (+5 Mistake Repair, +1 production-migration PGlite), nta 22/22,
  answer-integrity 6/6, du 19/19, payment 12/12, questions 9/9, recovery:validate; lint clean; build 62/62.
- Browser (preview fixture, localhost:3010): repair explained / withheld / out of credits / failure
  states, light theme; result page renders the panel only under wrong answers.
- Month-to-date runtime spend after all tests: ≈ $0.008 of $25.

**Deployed (owner chose "commit and push to main"):** `3c88f92` (all source/docs in the tree, incl.
the owner's and earlier agents' uncommitted work; untracked `artifacts/` 121 MB deliberately not committed).
**Incident:** that tree contained an earlier agent's www→apex redirect in next.config.mjs while Vercel
redirects apex→www, so production looped (50 redirects) for ~15–20 minutes. Hotfix `499475a` removed the
rule; site verified 200 at 01:03 IST on /, /pricing, /cuet-subject-combination, /api/stats; new
/api/recovery/repair and /api/ai/mentor/chat answer 401 signed out. Lesson: before pushing a dirty tree,
diff next.config/middleware against the deployed commit and probe redirects right after deploy. To make
the apex canonical, change Vercel's domain redirect first, then add the rule.
**Not done / gates:** Vercel `AI_*` env vars (code defaults to OpenAI gpt-4o-mini/gpt-4.1-mini, both
priced, so replies work if Vercel has OPENAI_API_KEY — unverified); signed-in production
check of a real PrepOS reply and repair; Anthropic key; learning/recovery migrations (triggers on live
`questions`) still unapplied; homepage/store copy not yet renamed to "Score Recovery"; AI purchases
closed; AI dispute quarantine relies on one model family tonight (both opinions from OpenAI).

Rollback: `update runtime_ai_budget set monthly_cap_usd=0` stops all student AI instantly; or set
`RELEASE_GATES.runtimeAi=false` / `PREPOS_MODEL_REPLIES_DISABLED=true`. Remove the repair route and
component to withdraw Mistake Repair. Wallets and ledger history are never rewritten.

## 4 October 2026 — Differentiator decision and first validation slice (Claude)

Decision: [DECISION-2026-10-03-DIFFERENTIATOR.md](DECISION-2026-10-03-DIFFERENTIATOR.md). Primary bet
"repair that holds", proven on one pathway before eight; trustworthy practice and goal-aware DU tools
support it. Rename to "Mistake Repair" proposed, **not applied** (owner decision). Brain reconciled:
README, PRODUCT.md, ROADMAP-2027 (amendment), IMPLEMENTATION-2027 (Stage 2), BACKLOG (ordered next).

Implemented (local source only; nothing deployed, migrated, seeded, purchased or sent to a model):
- Candidate pathway `data/recovery_candidates/sacrificing_gaining.{source,pathway}.json`: original
  wording, CUET UG 2026 Accountancy (301) Unit II locator with PDF SHA-256, 3 probes / 5 repair /
  6 checks, 14 families, hypotheses secure / direction_reversed / old_ratio_default / new_ratio_used,
  boundary checks (old ratio correct; unaffected partner). State `candidate`; manifest still
  `blocked_sources` with `pathways: []`. `source_registry.json` deliberately untouched (the paid
  worker treats an empty registry as a pause signal).
- Validator `data/pathway_validation.js` + `npm run recovery:validate`: exact-fraction recomputation of
  every key, matrix cell, derived ratio, unique key, option-text/claim binding, family disjointness,
  isomorphic scenarios, sources. 97/97. Corruption tests prove it fails on 13 seeded defects; it caught
  one real weakness during this work (swapped partner attribution passed), now fixed.
- Engine: no-gap diagnosis label; clearer feedback when repair ends; shared plan `primary.facts`
  (record vs rule) incl. immediate-check and upcoming-check states. Server digest now reuses
  `pathwayDigest` from the validator (same algorithm, one implementation).
- PrepOS: "Why this step" facts in the plan panel; free record reply appends the facts; model prompt
  states facts are authoritative (paid replies remain paused).
- Metrics `data/recovery_metrics.js` + read-only `scripts/learning/recovery-metrics.mjs`: completion,
  immediate/delayed/maintenance pass rates (Wilson, n), overdue and stalled attrition, defects,
  diagnosis counts, probe concordance, cost; groups < 5 suppressed; no decision < 30 episodes.
- Capability registry: `EVIDENCE_LEVELS`, `DIFFERENTIATORS`, `differentiatorClaimable()` (false for all).
- Dev-only fixture `/preview/arena?view=recovery&recovery=candidate[&net=lose-once][&clock=h]`: real
  recovery UI on the real engine, idempotent by request key; pathway read server-side in development
  only. Production build contains no candidate item IDs (grep of .next/static and .next/server: 0).

Verification actually run (logs in `artifacts/differentiator-2026-10-04/`):
- `npm.cmd run test:recovery` 30/30 (was 17; +13 candidate tests incl. PGlite storage),
  `test:learning` 74/74, `test:nta` 22/22, `test:answer-integrity` 6/6, `test:du` 19/19,
  payment_entitlements 12/12, mock selector + explore feed 9/9, `recovery:validate` passed.
- Candidate tests cover: per-hypothesis diagnosis/routing/timing (24h, 72h), secure path, conflicting
  probes → general repair, repeat exposure (seen family/question, failed checks consume families,
  exhaustion → blocked_content), interruption (stale submit rejected, expired check reopens repair),
  no key/matrix/claim leakage, concurrent start retries → one episode and one weekly allowance, refused
  start consumes nothing, second concept same week refused, idempotent response retry, answer
  correction → episode invalidated → counted as a defect.
- `npm.cmd run lint` clean; `npm.cmd run build` 61/61 pages.
- Browser (in-app pane, existing dev server on localhost:3010): start → probe 1 with response lost
  after commit → retry returned the committed state, 1 commit → probe 2 → supported old-ratio
  diagnosis, explanation, contrast → routed repair → hand-off to unassisted fresh check (4 commits for
  4 answers); conflicting probes → general explanation; PrepOS shows "Take your first fresh check"
  with record/rule facts; 320px: no overflow, 76px option targets; PrepOS facts contrast ≥ 9:1.
- Read-only metrics against the configured database: `learning_episodes` absent (PGRST205) → n = 0.
  The connected-learning migration is not applied there. Fixture report is labelled simulated.

Not done / gates: academic validation (independent Accountancy reviewer; one definition item flagged
for review); backend-signed evidence for the 14 items; staging migration + seeding + digest
registration; opted-in pilot flag (not built); scored fresh check through `/test` with real
sessions; real devices and screen readers; DPDP legal review (under-18 consent and telemetry before
~13 May 2027); owner decision on the rename; Testbook research (pages unavailable on 3 Oct).

Rollback: delete `data/recovery_candidates/`, `data/pathway_validation.js`, `data/recovery_metrics.js`,
`data/tests/recovery_pathway_candidate.test.mjs`, `data/tests/recoveryCohortFixture.mjs`,
`scripts/learning/{validate-pathway,recovery-metrics}.mjs`, the `candidates` key in
`data/recovery_pathways.json`, and the `recovery:validate`/test-list additions in package.json; revert the
small edits in learning_engine.js, capabilities.js, server/learning.js, MockMobAIHub.jsx, prepos.css,
mentor chat route, systemPrompt.js and the preview files. No data, credit, entitlement or payment path changed.


## 3 October 2026 — Owner round 2: motion, social proof, hero, Arena, Compass Pro, Combo Planner (Claude)

Owner decisions taken in chat this round: demos autoplay by default with an explicit pause; creators shown
with real follower numbers, ordered by reach; Compass gets Pro features (projection, college mapping); a new
USP feature; ₹99/month to be executed; live-site testimonials described by the owner as authenticated.

Implemented (local source only; nothing deployed, migrated, purchased or sent to a model):
- **Mistake Lab** no longer pauses under a passing cursor, a tap or the 35% visibility threshold; it pauses only
  fully offscreen, on keyboard focus, or by its button. Step descriptions share one fixed-height slot, removing the
  6-second layout shift that moved everything below on phones. Verified: steps advance while scrolling, rail
  height constant (376px at 390 wide).
- **Compass ladder** autoplays again by default as an eased, time-based rAF sweep (600–960, 11s); Pause/Play
  resumes from the visitor's score; filters no longer stop it; drag or quick score takes control.
- **Creators section** reframed "Trusted by CUET creators with 199K+ followers": counts read from public profiles on
  3 Oct 2026 (Garima Jain 25.2K + runs @du__club 161K; Rahul Thapa 13K; Prathna Jain 188), bios paraphrased from
  their own profiles, reel likes/comments where Instagram exposed them, sorted by reach, glass summary panel.
  Rahul's reel is marked Partner (his bio offers paid collaborations and the caption carries a discount code).
- **Hero**: CSS scroll-driven depth on the existing planes (aurora/grid/dots lag; drill card lifts on desktop
  only), a glass proof dock (199K+ creator reach, 73 DU programmes, 2 exam screens, 50 in 60), and a
  scroll-scrubbed statement. Progressive enhancement; reduced motion and unsupported browsers get the static page.
- **Compass Pro** (`data/compass_projection.js`, `/api/compass/pro`, `CompassPro.jsx`): per-paper practice
  projection out of 250 (attempt share × +5/−1 accuracy, Wilson range, ≥30 questions), four-paper total (one
  language + three strongest domain), personal DU shortlist (≤8 eligible programme+college targets, Rounds I–III
  in the chosen category, band position), next move (paper with most marks open + weakest ranked chapter).
  Pro enforced server-side; free sees a locked explainer. Labelled a projection, never a prediction or chance.
  No paid model call (runtime AI gate stays off). Advertised on landing, pricing and FAQ.
- **New USP: CUET Subject Combo Planner** (`/cuet-subject-combination`, `src/lib/du/combos.js`): targets + candidate
  subjects → every combination up to the paper limit checked with DU's own eligibility evaluator, ranked by targets
  met, programmes unlocked, fewer papers; "do not drop" subjects computed over all qualifying combinations; deep
  links into the calculator. Free, no signup. Promoted on landing, footer, CUET 2027 guide, sitemap.
- **Arena**: shared `ArenaHead`/`ArenaStats` (Practice's header and ruled stat strip); Today, Review, Progress
  rebuilt from a light "recovery-lab" slab into Arena pages; shared next-step card (full and compact); Radar's
  stray next-step moved under its header; Saved header; shared Empty/Error states restyled (no "// Error").

Not done, needs the owner:
- **₹99/month**: code is complete; creating the live Razorpay plan was blocked by the session's permission
  classifier. Create Plan (₹99, monthly, interval 1) in the Razorpay dashboard, set
  `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` in `.env.local` and Vercel production, redeploy. `publicOffer()` then flips
  every price surface. Run the LEARNING-DEPLOYMENT.md §A staging checks first.
- **Wall of Love**: not published. The July 2026 audit records the live-site quotes as fabricated and removed,
  and one is attributed to the owner. Publish only with written consent per quote; a founder quote must be
  labelled as such (ASCI/CCPA disclosure).

Verification: lint clean; build 56/56 (Edge Runtime warning unchanged); recovery 17/17, du 19/19 (+3 combos),
learning 74/74 (+5 compass projection), nta 22/22, answer-integrity 6/6, payment 12/12. Headless Chrome (CDP,
real input events): Mistake Lab and Compass autoplay timings; creators section 1280 dark / 390 light; hero
depth transforms at 400px scroll; statement word scrub; Compass Pro Pro/free/dark/light/390 with shortlist adds
and verdicts, contrast audit 0 failures; Today/Review/Progress/Radar/Saved fixtures; planner flow at 1280/390,
no overflow. Fixture APIs are stubs; real signed-in data, Instagram embeds on phones, real devices unverified.

Rollback: revert the files above; delete `src/app/cuet-subject-combination/`, `src/app/api/compass/pro/`,
`src/components/du/CompassPro.jsx`, `src/components/du/ComboPlanner.jsx`, `src/lib/du/combos.js`,
`data/compass_projection.js`, `src/components/arena/`, `src/app/hero-depth.css` and the two new tests.
No data, credit, entitlement or payment path changed.

## 3 October 2026 — Astra UI continuation: verification pass and confirmed fixes (Claude)

Local source only. No deployment, migration, checkout, paid generation, bank mutation or external message.
The PrepOS reservation migration remains unapplied. No image generated (none warranted).

Method: the in-app browser pane could not paint while occluded, so interaction checks ran in headless
Chrome driven over the DevTools protocol (scratch script, not committed) with real `Input.dispatch*`
mouse, touch and key events, `Emulation.setEmulatedMedia` for `prefers-reduced-motion` and colour
scheme, and touch emulation (`pointer: coarse`) below 900px. This is lab emulation, not real hardware.

Confirmed defects, each reproduced before fixing and re-checked after:
- **Signed-in Admission Compass, dark theme (high):** `du.css` reads marketing tokens defined only on
  `.mm`; inside the app shell they fell back to light ink (`#0a0a0a` on `#0b100e`, ~1.1:1 headings,
  buttons, notes), unset radii/shadows/`--volt-ink`. Bridged to `--a-*` tokens on `.app-shell .cmp`
  (`arena.css`). Light theme's active "All" chip was also unreadable; fixed by the same bridge.
- **Calculator sticky summary, light theme:** fixed night fill under theme ink (~1.1–1.6:1), public and
  signed-in, below 1100px. Now follows `--paper-raised`.
- **Calculator results at 320px:** implicit auto grid tracks (`.du-main`, `.du-list`) grew to card
  min-content, pushing cards 23–41px past the column. Pinned to `minmax(0, 1fr)`.
- **Wall of Love, 4 entries:** each lane held 2 cards, narrower than the lane, leaving an empty stretch
  every loop. Lanes now repeat hidden copies to at least 4 cards; duration scales per card (~16px/s).
  Accessible tree still lists each quote once. Removed `aria-pressed` beside a state-changing label.
- **Keyboard focus loss to `<body>`:** carousel arrow reaching its end (now `aria-disabled`, focus kept);
  activating an Instagram card (focus moves to "Open original"); demo drill after answering, Next and
  finish (focus moves to Next, first option, readout); Escape from the mobile nav sheet (returns to the
  menu button). Arrow group gained `role="group"` so its label is exposed. Nav `aria-controls` now set
  only while the sheet exists.
- **Mistake Lab, reduced motion:** tapping a question always snapped back to Q4 (effect re-ran on
  `picked`). Fixed. Score live region is quiet while the tour auto-plays.
- **Compass ladder:** UR/SC chips were 42x40 (now ≥44x44); "0 of 0 colleges" when a round/category has
  no published cutoff now says no cutoff was published for that cycle.
- **Narrow/zoomed phones:** below ~300px CSS width (≥125% zoom on a 360px phone) the menu button left the
  screen; hero title and dock CTA clipped at 200% text. Wordmark is visually hidden under 300px (still
  named), theme switch moves into the sheet under 240px, rotating hero phrase may wrap, phone title floor
  1.5rem, dock note yields under a 17rem container, dock spacer grows with text size and safe area.
  320px and wider are unchanged (measured).
- Touch tablets (761–1023px, `pointer: coarse`): NTA comparator's live palette cells 22x36 -> 49x44.
  Breadcrumb and stale-subject links raised to 44px targets.

Not changed after testing: MobileDock clearance at 320x640/740x360 (last footer line 41px above dock);
phone carousel arrows were already visible (44px) at 375/390, so code and notes agree.

Browser coverage actually exercised: homepage at 320, 390, 768, 1024, 1440, 1920 in dark and light
(no document overflow, no console errors, no broken images); 195px and 240/288px nav; 200% root font on
`/`, `/pricing`, calculator, `/cuet/english`; short landscape 740x360 and 568x320; full five-question demo
by touch and by keyboard only; comparator answer/review/switch preservation; Compass programme, category,
round, quick score, range keys and missing rows; Mistake Lab pause, step and tile selection in normal and
reduced motion; Wall fixtures 0/4/many incl. reduced motion at 320; Instagram arrows to both ends and
card activation (a real reel rendered); calculator alias search (BST, Accounts), score, share link,
reload persistence, Edit subjects; 20 public routes at 320 dark and 1280 light; `/preview/arena`
fixture views (free, Pro, inventory down, stale subjects, test, PrepOS plan/record/wallet, Compass,
Radar, Saved) at 320 and 1280. Computed-contrast audit (text vs nearest opaque surface) on home,
calculator, pricing and fixture views, both themes: remaining flags are the logotype dot (exempt) and
two probe false positives (gradient avatar, oklab launcher fill).

Verification: `npm.cmd run lint` clean; `npm.cmd run build` 55/55 pages, existing Edge Runtime warning;
`test:recovery` 17/17, `test:du` 16/16, `test:learning` 69/69, `test:nta` 22/22,
`test:answer-integrity` 6/6, `payment_entitlements` 12/12. `git diff --check` clean on edited files.

Still unverified: real phones (sticky hover, safe-area values, keyboard, 60fps), true browser page zoom
(root-font scaling and narrow viewports were used as proxies), screen readers, Instagram login walls,
signed-in persistence/entitlements/billing (`/preview/arena` is a stubbed fixture), creator permission
for the curated reels. Wall of Love stays hidden: no consented quotes exist.

Rollback boundary: revert the edits in `WallOfLove.jsx`, `CreatorReels.jsx`, `CompassLadder.jsx`,
`DemoDrill.jsx`, `MistakeLab.jsx`, `NavBar.jsx`, `Logo.jsx`, `social-proof.css`, `compass-ladder.css`,
`home-refinements.css`, `landing.css`, `globals.css` (crumbs, dock, nav-narrow, drill result),
`(app)/arena.css` (`.cmp` bridge, `.pr-alert a`) and `du/du.css` (`.du-sum`, `.du-main`, `.du-list`).
CSS/markup/focus only: no data, scoring, credit, entitlement or payment path changed.

## 3 October 2026 — Astra UI continuation handover (Codex)

The previous UI-refinement agent reached the usage limit during the final browser pass. A complete continuation prompt is saved at `docs/brain/CLAUDE-ASTRA-UI-CONTINUATION-2026-10-03.md`. This pass completed focused homepage, Compass, Mistake Lab, reveal, morph and historical-copy refinements, plus integrated social, authenticated-page and public-page work documented in the three `ASTRA-*-UI-NOTES.md` files. No image asset was generated because existing campus artwork and code-native product surfaces cover the meaningful visual needs.

Fresh verification: `npm.cmd run lint` passed with 0 errors and 0 warnings; `npm.cmd run build` passed with 55 generated pages and the existing Edge Runtime warning; `npm.cmd run test:recovery` 17/17; `npm.cmd run test:learning` 69/69; `npm.cmd run test:nta` 22/22; `npm.cmd run test:answer-integrity` 6/6; `npm.cmd run test:du` 16/16; `node --test data/tests/payment_entitlements.test.mjs` 12/12. Browser evidence covers homepage light/dark at 1440, homepage at 390 and compact 320 opening, Compass filters/keyboard/demo/missing-data state, Mistake Lab manual replay, and one real deferred Instagram embed. Wall fixtures, reduced motion, all route states, 200% zoom and real-device behavior remain unverified.

Open UI follow-ups: verify/fix phone carousel arrow visibility versus `ASTRA-SOCIAL-UI-NOTES.md`; inspect Wall fixtures and reduced motion; verify closed NavBar `aria-controls` target and MobileDock height at narrow/landscape sizes; complete route/theme/keyboard browser pass; preserve the honest empty public Wall. No production data, migration, checkout, deployment, paid generation or external communication was performed.

## 3 October 2026 — Astra UI handoff preparation (Codex)

Saved `ASTRA-UI-HANDOVER-2026-10-03.md`: current-source continuation prompt for
homepage refinement and remaining student-facing UI, Scroll Craft plus all 14
Emil Kowalski skill applicability, built-in image generation, and acceptance checks.
Read current contracts and Stage R/R2 notes; inspected the local homepage at phone
and desktop sizes, Compass, dark Instagram strip, and development-only Wall preview.
Confirmed the curated social strip is already present and public testimonials remain
hidden because the consented quote list is empty. No embeds activated in this pass.

No application code changed, no test/build suites rerun, no generation, migration,
checkout or deployment performed. This is prompt preparation, not UI completion.
Signed-in routes, all motion states and real-device behavior remain unverified here.
Rollback: remove the new handoff document and this entry; application source is unchanged.

## 2 October 2026 — Stage R2: original-site comparison, Compass, Radar, NTA, creators (Claude)

Local source only. Nothing deployed, migrated, purchased or sent to a model.

Compared with the live mockmob.in (read in the in-app browser): it had a Compass showcase with a cycling score card
and college labels, a Wall of love, a PrepOS section and a college marquee. Its Compass card showed "Reach / Moderate /
High" chances and a "score band predictor"; those claims are NOT reproduced (AGENTS.md: no admission probability, no
mock-to-CUET conversion). The three quotes on that site were not carried over.

Implemented:
- **Landing Compass ladder** (`CompassLadder.jsx`, `src/lib/du/showcase.js`): a score sweeps (or is dragged) across last
  year's real published Round I-III minimum allocation scores for 10 colleges in 4 programmes and 4 categories, from
  `public/du/2026`. About 10 KB shipped. It states a gap to a past cutoff only and links to the free eligibility tool.
- **Instagram strip** (`CreatorReels.jsx`, `src/lib/social.js`): 9:16 horizontal cards for the 3 creator reels and 3
  MockMob posts found on the public profile. Instagram's own embed loads only when a card is pressed. Edit the list in
  `src/lib/social.js` to add reels. Instagram's login wall blocks reading the feed, so entries are curated, not synced.
- **Wall of love** (`WallOfLove.jsx`, `src/lib/voices.js`): two opposing drifting rows (a grid under 4 voices), hidden when
  empty, only entries with `consent: true`. Dev-only prototype with labelled placeholders at `/preview/wall`. No
  testimonial is published.
- **Practice**: NTA Mode is a featured row (mini exam-console preview, chips, "Closest to exam day") with an exam-screen
  choice (MockMob / NTA style) for Pro and a free preview link for others. The grid is Quick, Full, Smart.
- **Admission Compass page** rebuilt as a product page: opens already ticked from the student's profile subjects
  (link, then saved choice, then profile), a three-step explainer, an honesty note, a bridge from the practice record
  ("Your practice says: ..."), and the sources. Calculator logic is unchanged apart from the seed prop.
- **Radar** rebuilt on the PrepOS record engine plus a theme-aware score trend (Chart.js reads Arena tokens and re-reads on
  theme change). Removed the invented composites ("Rank readiness", "Focus score"), the 1-4 axis radar chart, the
  non-functional "Ask Radar" box and the blurred paywall over made-up metrics.
- **Free vs Pro for the record**: free = marks ledger, top 3 chapters, findings, weekly summary; Pro = every ranked
  chapter, thin-chapter list, changed-answer and pace detail. Enforced in the record view and in Ask (server and client),
  and stated in the pricing page, landing page and PrepOS wallet copy.

Verification actually run: lint clean; `test:learning` 69/69 (adds landing_content 4: real-file cutoff match, embed
format, consent filter, Pro gating of Ask); recovery 17/17, du 16/16, nta 22/22, answer-integrity 6/6; build 55/55.
Browser: landing Compass ladder, reels (the embed loaded a real reel), Wall prototype, Practice with the NTA tile, Compass
page, Radar, at 1280 and 375 widths in light; no horizontal overflow.

Not verified: no signed-in session, so Radar/Compass/Practice used the dev preview with stubbed account APIs (real engines,
real DU data). Saved, Explore, Ranks, Contribute and My uploads were not touched this round. A dark-mode pass of the new
sections was not repeated. Creator names and handles come from the public profile page; the owner should confirm permission.

## 2 October 2026 — Stage R: Arena design language, PrepOS record and wallet, ₹99/month, landing (Claude)

Local source only. Nothing deployed, migrated, purchased, or sent to a model; no real wallet or ledger row was
read or written. Owner decisions taken this round: Pro is **₹99/month auto-renewing**; PrepOS model replies for a
small monthly allowance are **built but switched off** until the gates in LEARNING-DEPLOYMENT.md pass.

Implemented:
- **One icon language.** `src/components/ui/Glyph.jsx`: one lucide family at one stroke weight (`AppIcon`,
  `StatusIcon`, `SubjectIcon` for all 42 subject ids, `ModeIcon`) and two distinct credit coins (`CreditMark`:
  bolt = practice credits, orbit = PrepOS). Replaced the mixed nav icons, the star + "∞" credit pill, the
  38 decorative subject characters, and emoji/text glyphs (✅ ❌ 💡 🌵 ⚡ ★ ▲ ▼ ↻ ✓ ✗ ⚠) in Arena, uploads, feed
  cards, onboarding and votes. Remaining hits in `scripts/design-audit/glyph-audit.mjs` are the now-unused
  `glyph` data fields, a comment and a seed question.
- **Credit display fixed everywhere.** Pro now reads "Unlimited" (coin + word, not "∞" or "no credits") in the
  top bar, Practice, Account and the modal; free reads the number. A second chip shows the PrepOS wallet
  (unknown wallets show "—", never a number). Practice credits and PrepOS credits are always labelled apart.
- **Practice screen rebuilt** (`DashboardPageClient.jsx` + `.pr-*` in `arena.css`): two-column layout with a
  sticky session summary (a pinned launch bar on phones), subject and mode tiles with icons, official subject
  codes and entitlement badges, segmented controls, a Fine-tune disclosure, ruled stat strip, recent sessions
  with subject icons, status badges with icons. No inline `<style>`. Launcher no longer covers the Start button.
- **₹99/month.** `pro_monthly_99` plan, `/create-monthly-subscription`, `/api/billing/cancel`, checkout in
  `RazorpayPaymentButton`, `PlanCard` on Account (renewal date, two-step cancel). `publicOffer()` is the single
  source for pricing page, landing page, Arena upsell, modal, SEO title and mobile dock. Closed until
  `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is set; until then the existing ₹99 one-time access stays the honest offer
  and copy says monthly "opens soon". When set, new one-time checkouts close; old orders keep verifying.
- **PrepOS record engine** (`data/prepos_insights.js`, free, no model): marks ledger (+5/−1, blanks), accuracy with a
  Wilson range, chapters ranked by marks left open only with ≥4 answered questions (thin chapters listed apart),
  difficulty split, pace from device events, answer changes counted both directions with the net, last-7-days vs
  previous week. Surfaces: PrepOS "Your record" tab, "Ask" answers record questions instantly and free, Today
  shows the top finding, the Result page shows "Where your marks went" for that session.
- **PrepOS wallet clarity.** Monthly meter ("38 of 50 left", reset date, no carry-over), purchased credits shown
  apart, plain list of what is always free and what costs 1 credit.
- **Model replies, gated.** Migration `20261002130000_prepos_credit_reservations.sql` (saved, NOT applied) adds the
  reserved→executing→committed|released lifecycle; `runModelReply` wraps the existing provider/runtime-budget
  guard; chat route answers record questions free, explains the plan while paused, and runs the lifecycle only
  when `RELEASE_GATES.runtimeAi` is true. Client keeps one request id per action and reuses it only after an
  unknown outcome.
- **Landing.** The section after the hero is now the interactive "Mistake lab" (`MistakeLab.jsx`, `mistake-lab.css`):
  four auto-advancing, tappable, pausable steps (replay → leak → one next move → fresh check later) on one
  labelled illustrative session, reduced-motion and keyboard safe; the recovery step shows its real release state.
  Sharper hero and section copy; offer-aware trust row, pricing block, FAQ and stats cell. NTA/MockMob comparison,
  scroll reveals and the rest were left untouched.

Verification actually run:
- `npm.cmd run lint` clean. `npm.cmd run build` 54/54 pages, new routes present.
- `test:learning` **65/65** (adds `monthly_billing` 5, `prepos_insights` 8, `prepos_reservations` 9 in real Postgres
  via PGlite, `prepos_model_reply` 9, plus the earlier quote/wallet suites). `test:recovery` 17/17, `test:nta` 22/22,
  `test:answer-integrity` 6/6, `test:du` 16/16, `payment_entitlements` 12/12, selection/offline 16/16.
- Reservation SQL cases proven: retry same key charges once; over-reserve refused; release restores included then
  bonus exactly and is idempotent; released key cannot be reused; commit final both ways; month rollover returns
  expired included credits as bonus; expiry sweep; ledger explains balance; service-role only. PGlite is one
  connection, so these prove arithmetic and idempotency, NOT multi-session lock contention.
- Browser (dev-only `/preview/arena`, stubbed account APIs built from the real pure engines, plus the real `/`
  and `/pricing`): Practice, PrepOS record/ask/wallet and landing at 320–1366 widths in light and dark; computed
  contrast audit (full text coverage) clean on Practice, PrepOS record and wallet (light), Practice (dark; one
  false positive: black on a volt gradient avatar), landing and pricing. No horizontal overflow. Unauthenticated
  boundary: new endpoints return 401.
- Lab auto-advance, pause, step taps, tile inspector exercised in the browser.

Not verified / known gaps:
- No real signed-in session: Account PlanCard, Result-page readout and Today glimpse are lint/build verified and use
  the same components as the verified previews, but were not rendered with live data. No real Razorpay checkout
  (test or live), no webhook replay, no model call, no real Android or screen-reader run.
- Research: 20 pages requested, 16 usable; far below the 300–400 requested. See DESIGN-REFERENCES.md.
- The Chart.js screens (Radar), Moderation, Saved and Explore were not re-skinned in this round.
- Account plan card forgets a requested cancellation across reloads; subscription is created with 24 cycles.

Next incomplete criteria: staging for the reservation migration + Razorpay test plan (LEARNING-DEPLOYMENT.md A/B);
signed-in two-theme pass of the remaining app routes; then Stage C (durable sessions) and Stage D (bank audit).

## 2 October 2026 — Claude handover execution, Stage A (Arena capability/theme truth)

Local source only. No deployment, migration, checkout, paid model call or content
generation. Existing user edits preserved. Checklist: `CLAUDE-WORKLOG.md`.

Implemented:
- `data/subject_registry.js`: versioned subject registry with official codes verified
  against the NTA CUET(UG)-2026 subject list (cuet.nta.nic.in, "Last Updated Sep 02,
  2026", checked 2 Oct 2026; provisional for 2027). Crosswalk keeps old IDs
  (`gat`→501, `applied_mathematics`→319; Engineering Graphics, Entrepreneurship, Legal
  Studies, Teaching Aptitude are not in the 2026 list → `retired`). Stored choices are
  never deleted; unsupported ones show a reason and cannot launch.
- `data/capabilities.js`: capability IDs/versions, inventory purposes (ordinary,
  recovery-eligible, original sample, verified historical — none claimed), and per-mode
  capabilities with entitlement copy that never ranks question quality.
- `data/practice_quote.js` + `GET /api/practice/quote`: read-only server launch quote
  (entitlement + expiry, allowance, credit cost, duration, inventory policy/count,
  reason, 60-second staleness, server-minted idempotency token). Unknown inventory or
  an unreadable allowance is unavailable, never free. Dashboard renders only this; the
  launch button is disabled unless the quote for the exact selection is launchable,
  re-checks a stale quote, and reuses the server token across retries.
- Dashboard copy: removed "Fast lane active", "highest-quality selection layer",
  "Upgrade for premium question quality", "Most Popular" badge and "unlock more premium
  mocks"; counts say "usable questions in the ordinary library" with unavailable state.
  Onboarding lists only practice-supported subjects and lets stale saved ones be removed.
- Today: the 10/20/30 choice now sets the session (`/dashboard?mode=quick&count=10|20`,
  30 min = 20 questions + 10 minutes review) and states the duration/charging contract.
- Arena theme: semantic `--a-*` tokens for dark (Night Arena, unchanged values) and an
  intentional light palette, scoped to `html:has(.app-shell)` so portals/toasts follow.
  Tailwind's variable-backed palette is remapped in light mode; volt-as-text becomes
  `--a-accent-text`. Theme switch added to the app top bar (≥640px) and mobile sheet,
  using the existing `mm:theme:v1` preference (set pre-paint by the root script). The
  pre-shell auth screen has a light variant. The NTA-style console pins its previous
  token values so it renders exactly as before in either Arena theme. PrepOS launcher
  stays a deliberate dark island.

Verification actually run:
- `npm.cmd run test:learning` 12/12 before adding the new file; new
  `data/tests/practice_quote.test.mjs` 10/10 (final suite totals are in Stage B below) (registry codes, stale/retired/unknown
  subjects, premium block, unknown/short/empty inventory, zero credits, included/used/
  unknown allowance, expiry, no quality ranking, minutes→session). `test:recovery` 17/17.
- `npm.cmd run lint`: clean. `npm.cmd run build`: first attempt failed fetching the Geist
  Mono Google Font (network); immediate retry compiled and generated 54/54 pages.
- Browser, dev-only `/preview/arena` (mock user, stubbed account APIs, quote built by the
  real `buildPracticeQuote`) on the owner's running dev server: computed-contrast audit of
  every visible text node (`scripts/design-audit/contrast-audit.js`) and overflow check.
  Dashboard light: 0 failures at 320/375/768/1024/1280/1920 after fixes; dark at 320 and
  1280: 0 (one false positive: black on volt-gradient avatar). Branded runner light 375:
  0; answer selection causes no layout shift (paper 598px before/after); selected border
  #6f8700 ≈3.9:1. NTA console in both Arena themes: unchanged conventional skin (only its
  existing orange "visited" chip, 4.4:1, which predates this change). Exercised states:
  stale saved subjects, inventory outage, insufficient inventory (15 > 12), Pro included
  with expiry, theme toggle click + persistence. No horizontal overflow at any width.

Not verified / remaining for Stage A:
- Signed-in routes other than the dashboard/runner harness (Today, Review, Progress,
  Radar, Account, Saved, Compass, PrepOS, Explore, Ranks, Upload, Result) were not
  rendered: no session in the built-in browser and no credentials may be entered. They
  inherit the token remap, but charts (Chart.js colours), page-specific inline styles
  (TestPageClient result states, MyUploads, Moderation, Upload, Analytics) still need a
  signed-in two-theme pass. Keyboard-only and screen-reader passes not done.
- Recovery-launch quotes (`purpose=baseline/full_sample`) are computed but not exposed in UI.
- Lead, not fixed: the root font is 15px, so Tailwind `min-h-11` renders 41.25px (17 uses
  outside PrepOS). New PrepOS controls use explicit 44px.

## 2 October 2026 — Stage B (PrepOS wallet safety and explanation layer)

Local source only. Paid PrepOS stays paused (`CAPABILITIES.optionalAi.state = 'paused'`).
No wallet balance, ledger row, payment or migration was changed; no model was called.

Implemented:
- `src/services/credits/aiWalletState.js` (pure): explicit wallet states `available`,
  `empty`, `paused`, `schema_unavailable`, `error`, with a safe message. An unreadable
  wallet has `known:false` and null balances — never a synthetic allowance or a spendable
  zero. Paused wallets still show real stored balances, not spendable. Central
  `isPaidUser` uses `effectivePremiumFromRow` (status / paid-through / legacy flag) at call
  time, so expired access stops counting.
- `aiCreditWallet.js`: `readAIWallet` is one select; it never inserts, resets or syncs
  (the monthly reset/allowance sync is projected and applied only inside the atomic RPC).
  `consumeDirectly`/`grantDirectly` and the swallowed ledger insert are deleted. Spend is
  RPC-only, requires a caller-stable operation key, and returns `prepos_paused` before any
  RPC while paused; a missing RPC fails closed (503). Grants for captured purchases still
  use the atomic grant RPC (historical orders and webhook/verify paths unchanged).
  Narrowed missing-function detection so real RPC errors are not treated as "missing".
- `consumeAIAllowance`: refuses while paused before reading or charging; uses the caller's
  operation key (Rival: `rival:<battleId>:<action>`), never `Date.now()`. Rival refuses a
  paid benchmark before creating a battle row while paused. Usage snapshot accepts a
  pre-read wallet and refuses charges unless the wallet is spendable.
- `GET /api/ai/credits`: one wallet read, `state`/`message`, practice credits labelled as a
  separate ledger, `checkout.open`, packs carry `status: 'paused'`.
- PrepOS hub rewritten as an explanation layer: "Next step" renders `/api/learning/plan`
  with the same 10/20/30 choices as Today; "Ask" answers product/credit/DU questions
  deterministically and sends plan questions to the existing no-charge server route;
  "Tools and wallet" shows the wallet state read-only with no pack buttons. Removed local
  missions/day plans/setup planner (20/45/60/90), benchmark entitlements, "GPT-4.1 mini"
  and "college and course direction" copy. DU wording now: published 2026 eligibility
  rules and Round I–III minimum allocation scores by category, historical only, no
  admission prediction or mock→CUET score conversion. Hub remounts per account.
- Retired unreferenced legacy `MockMobAssistant.jsx`, `AIAssistantDrawer.jsx`,
  `AIAssistantLauncher.jsx` (no importers; tracked in git) and a dead charge helper in
  `/api/ai/actions/execute`. `/pricing/prepos` shows the paused message, "—" for unknown
  figures and lists packs only when checkout is open. Rival shows "—" for unknown wallets.
- `scripts/learning/wallet-reconciliation.mjs`: read-only wallet↔ledger reconciliation
  (grants − bonus spends vs stored bonus; included spends this period vs stored usage;
  orphan ledgers). Offline `--fixture` or explicit `--remote-read`; never writes.
- PRODUCT.md lines promising fast lane, score-band estimate, college recommendations,
  peer review and live AI packs are marked superseded.

Verification actually run (all exit 0):
- `test:learning` **33/33** (includes `practice_quote` 10 and new `prepos_wallet` 11:
  expired/legacy entitlement, missing schema, read error, paused, stale period projection,
  unmaterialised wallet, client mapping of failed/legacy responses, narrow missing-function
  detection, source guards against direct writes/time-based keys, real
  `mm_ai_consume_credits` in PGlite: two consumes over balance → one succeeds, same-key
  retry charges once, ledger insert failure rolls back the balance; grant idempotency;
  reconciliation flags drift). PGlite runs on one connection, so "concurrent" consumes are
  serialised — this proves arithmetic/idempotency, not multi-session lock contention.
- `test:recovery` 17/17, `test:nta` 22/22, `test:answer-integrity` 6/6, `test:du` 16/16,
  `payment_entitlements` 12/12; payment + mock selector + practice filtering + offline
  batch (schema/dedup/alignment/generation/import) 24/24. `npm.cmd run lint` clean.
  `npm.cmd run build` 54/54 pages.
- Unauthenticated dev-server checks: `/api/practice/quote` 401 with unavailable state,
  `/api/ai/credits` 401, `/api/learning/plan` 401, `/api/subjects` 200.
- Browser (`/preview/arena?view=prepos`, stubbed APIs built from the real pure functions):
  plan at 375 light; paused wallet shows 68 / 38/50 / 30 with the required message and no
  pack buttons; `wallet=down` shows only "could not be read… Nothing has been charged";
  Ask answers for credits, DU chances and "what next" at 320 dark; keyboard focus ring on
  section tabs. Contrast audit was corrected mid-run (it had skipped oklch/oklab colours)
  and every Stage A/B view was re-run with full coverage: 0 failures except the known
  avatar false positive.

Remaining gates before any paid PrepOS reactivation (unchanged: stays paused):
1. Student-ledger reservation lifecycle (`reserved → executing → committed/released`)
   does not exist yet; only provider-side runtime reservations/receipts
   (`20261002121000_runtime_ai_guard.sql`). Provider timeout, unusable output and
   deterministic-fallback reversal tests cannot be written until that path exists.
2. Staging verification of `ai_credit_wallets`/`ai_credit_ledger` and both RPCs, then a
   `--remote-read` reconciliation run reviewed by the owner (not run; production data was
   not read).
3. Real multi-session concurrency test against staging Postgres.
4. Signed-in browser pass of `/mentor`, `/rival`, `/pricing/prepos` and account switching.

Next incomplete acceptance criterion: Stage A signed-in two-theme pass of the remaining
app routes, then Stage C (durable sessions/recovery integration) and Stage D (read-only bank
audit against the subject registry). Stage 1 explicit staging schema remains the release gate.

## Approved roadmap execution — source implementation, launch still gated

The complete product is **not released or definition-of-done complete**. Existing
user edits were preserved. No production/staging migration, quarantine application,
deployment, real checkout/refund or paid generation was performed in this run.
The content ceiling remains $2 calibration within $10 lifetime; runtime AI funding
has not been authorized. Current offer remains ₹99 through 31 July 2027.

Implemented local behavior:

- Central capability/release truth, versioned ₹299 plan and coordinated future copy;
  old ₹99 orders, access and offer amounts are retained. New sales remain gated.
- Bounded diagnosis, selected/general reasoning repair, independent numeric solvers,
  choice/numeric/evidence-span responses, fresh-family reservation and two delayed
  checks. Wrong/unanswered/expired checks reopen repair; repeats and assistance
  cannot certify understanding. No hidden keys/matrices/future questions in plans.
- Saved service-only owner/allowance/episode/observation/exposure transactions,
  durable sessions behind a switch, legacy ticket compatibility, revision/idempotency
  checks, account ownership and changed/held-content invalidation.
- Shared next action for Today/Radar/results/PrepOS; ordinary mistake Review and
  episode-based Progress; functional recovery forms/check launch in the existing shell.
  Decision replay distinguishes event effects and net changes. Experiments deferred.
- Compass now uses sourced DU rules/cutoffs; fictional chance/score predictor removed.
- Persistent request reservations/usage receipts and rate limiting saved in Postgres
  migrations. Unknown costs/funding block physical AI dispatch. Core plans/repairs
  have no paid model dependency. New AI top-ups/replies paused; wallets preserved.
- Rival duplicate/ownership guard and atomic completion SQL. Answer changes archive
  history and queue recomputation; comparable revalidated score derivation keeps
  original attempts intact. Edited/reordered answers cannot reinterpret old indexes.
- Shared practice eligibility for inventory, truthful zero/unavailable counts, public
  aggregate caching; current copy/legal/theme refinements and optional shorter guide.
  Open test-email sending is disabled by default and admin/rate limited if enabled.
- Roadmap authority, implementation checklist, local preflight and deployment/rollback
  instructions saved in the brain. Earlier pilot/count/store order is superseded.

Verification actually performed:

- `npm.cmd run test:recovery`: 17/17 passed.
- `npm.cmd run test:learning`: 12/12 passed. Includes isolated PGlite transactions
  for allowance concurrency, owner restrictions, response retries/CAS, original
  snapshot preservation, answer correction queues and family-hold invalidation;
  zero-funding/unknown-price/reservation/receipt/rate-limit behavior; Rival atomicity.
- Combined `node --test data/tests/*.test.mjs` plus recoverySafety, evidencePipeline,
  sourceAdapters, practiceModeFiltering and offlineBatchSchema/Dedup/Alignment/
  Generation/Import: **101/101 passed**. Includes NTA, answer integrity, mock selection,
  payment/entitlement, DU and offline import gates. Fixtures are software-only.
- `npm.cmd run lint` and `npm.cmd run build`: passed before the final HTTP boundary
  follow-up; final repeat results and HTTP checks are recorded below.
- `node scripts/learning/preflight.mjs`: sources 0, academic calibration paused,
  pathways 0, current price ₹99, ₹299 disabled. See reports/learning-preflight.json.
- Browser (local development server): homepage at 320px in both themes, keyboard
  Space theme toggle, pricing at 320px, honest count failure display and unreleased
  recovery notice. No horizontal overflow on inspected home/pricing. Recovery rendered
  its unavailable state with ordinary Practice/Review links; existing session resolved
  and GET /api/learning/plan returned 200. No new study attempt or payment initiated.
  One navigation timed out before its rendered state resolved; it was not treated
  as a completed flow until the DOM showed the actual unavailable state.
- Initial local production boundary pass: 8/9 expected statuses. Empty anonymous
  mentor payload returned 400 before authentication; auth/rate limiting moved before
  parsing/context work, with a bounded payload. Final repeat recorded below.
- No screen-reader, real Android, constrained-network, Lighthouse or field CWV
  result. Theme/320px inspection does not establish accessibility or device readiness.

Release gates and remaining implementation:

1. Explicit staging schema verification/application of saved migrations, including
   older interactions, bookmarks/progress, atomic credits and recovery foundations.
   Rival additionally requires the older db/migrations AI-overlay tables before its
   new submit service deploys. No source deployment should bypass this dependency.
2. Eight permitted/versioned, independently calibrated concept pathways with complete
   fresh inventory. Sources and academic benchmarks are empty; no academic accuracy,
   student learning gain or source-backed coverage is established by these tests.
3. Real authenticated baseline → investigation → repair → immediate → two delayed
   checks, resume/account-switch/concurrency/expiry/invalidation/exhaustion tests in
   staging. Audit legacy device-ticket wall-clock limitations; its telemetry cannot
   prove answer timing. Durable server checks enforce deadlines without grace answers.
4. Correction-queue worker, report-triggered evidence re-evaluation, payment
   reconciliation and cohort/cost/support reporting remain unfinished. Uncertain
   content stays withheld. Fresh timed decision experiments wait for the core loop.
5. Real staging captured checkout, old pending orders, new V2, signature/owner/amount,
   webhook retries and refund/revocation. Optional runtime wallet reservation/reversal
   and price/funding receipts remain gates; paid AI stays paused.
6. Android/accessibility/performance, season receipts and ≥70% contribution margin;
   opted-in cohort before public recovery/₹299. Do not sell planned features as live.

Next incomplete acceptance criterion: **Stage 1 explicit staging schema and real
authenticated session/owner flow**. Stage 2 cannot release until academic source and
calibration gates pass. See IMPLEMENTATION-2027.md for the dependency checklist and
LEARNING-DEPLOYMENT.md for switches, migration order and non-destructive rollback.

Final follow-up results:

- Final `npm.cmd run build`: exit 0; optimized Next 16.2.4 build completed. Existing
  edge-runtime/static-generation warning remains informational.
- Final standalone `npm.cmd run lint`: exit 0, no diagnostics. One preceding
  overlapping lint invocation ended exit 1 without diagnostic output; this was
  not called a pass. The separate repeat completed successfully.
- `node scripts/learning/http-check.mjs`: exit 0, **9/9** expected production-build
  authentication/unavailable statuses. Saved reports/learning-http-checks.json.
  Includes the corrected anonymous mentor 401, disabled email 404 and production
  preview 404s. No cookies, credentials, provider dispatch or payment was used.
- Temporary development and production inspection servers were stopped, browser
  viewport restored and temporary inspection tab closed. No deployment made.

## 2 October 2026 — roadmap gap audit and Claude handoff

This follow-up was documentation-only. No product source, database, migration,
entitlement, wallet balance, payment, content record or deployment was changed.
The existing user-owned development server was left running. The companion audit
`ROADMAP-GAP-AUDIT-2026-10-02.md` records the evidence; the copy-ready execution
contract is `CLAUDE-MASTER-HANDOVER.md`.

Confirmed current issues include the Arena app shell staying dark while the
marketing theme reports light, no Arena theme control, stale Fast lane and mixed
availability copy, inconsistent subject catalogs, PrepOS local planner/time
choices, and wallet degraded/fallback paths that can expose synthetic balances or
non-atomic direct consumption. These findings are release blockers or staging
work; they were not patched in this audit.

The Impeccable detector returned 95 heuristic advisories across Arena/dashboard/
PrepOS files (49 font-size, 28 color, 15 radius, plus grid/transition/easing).
They are retained as review leads in `reports/claude-handover-static-audit.json`,
not counted as confirmed defects. A read-only local browser check observed the
Arena computed dark shell under `data-theme="light"` and the 320px Today fallback.
No new mock, purchase, paid model call, migration or content generation occurred.

Next incomplete acceptance criterion remains the explicit staging schema and real
authenticated session/owner flow. The next Claude run must fix Arena/capability
truth and PrepOS wallet safety before enabling paid AI, then begin the authoritative
CUET syllabus registry and read-only question-bank audit. Existing prior test/build
numbers remain prior-run evidence and were not rerun in this documentation pass.
- `git diff --check` identified three trailing-space lines introduced while editing
  pricing; they were removed. Other existing user changes remain intact.

## Historical status — October 1 2026

This is a locally implemented foundation and redesigned recovery pilot journey,
NOT a completed production launch. No production migration, bank mutation, deploy,
paid content request, APK signing, store submission or real-device test was made.

| Milestone | Completion evidence | Remaining gate |
|---|---|---|
| Project brain | AGENTS, PRODUCT, DESIGN and brain specifications/architecture/quality/cost/benchmark/backlog | Keep updating actual results |
| Read-only inventory | 9,342 records; saved per-item report and 59-row quarantine dry run | Independent semantic checks, schema deployment before applying quarantine |
| Historical failure classification | Ten zero-candidate/zero-validator routes classified unknown | Request-level receipts needed to reconstruct old bills |
| Durable cost controls | Shared SQLite reservations, usage receipts, crash/concurrency/zero-yield/repair/cache tests | Verified prices, durable worker deployment; distributed ledger not implemented |
| Evidence publication | Signed hashes, source/family/version checks, blind solving, alternative challenges, route calibration; worker/offline importer integrated | Source registry/academic fixtures empty; source-backed model adapter configured but not executed; numerical family solvers not supplied |
| Practice/recovery backend | Server scoring, event replay, idempotency, ownership, credits, playbook/review queue, changed-evidence progress exclusion | Saved SQL needs staging/production setup; correction recomputation and fuller timing/review behavior pending |
| Web pilot UI | Immediate illustrative replay, separate pilot signup, observed/inferred results, four launch subjects; public reference notes | Remaining legacy screens, live authenticated content flow |
| Mobile beta source | Bundled React/Vite/Capacitor assets/fonts, OTP/bearer, native secure storage, cached reviews/drafts, reminders; Android project generated | Public environment config, signing, JDK/SDK, macOS/iOS, real-device QA and store review |

## Verification

- npm run test:recovery: 15 focused software regressions, including local Postgres
  transaction/owner/credit/idempotency/quarantine/passage rollback tests.
- Existing answer integrity, NTA selection, mock selection, payment/entitlement and
  offline batch suites: 52 tests. Academic fixture release remains unverified.
- Production web and mobile asset builds compile. Targeted edited React lint is clean.
- Production-mode HTTP checks reject unauthenticated/forged-token attempt, analytics,
  recovery, session and mobile reads/submissions with 401. The illustrative preview
  returns 404 in production. Saved results: artifacts/recovery/http-checks.json.
- Desktop/390px captures in artifacts/recovery; no horizontal overflow in inspected
  home/lab. Replay control is 44px. Public catalog references include >1,000 designs;
  no claim that 1,000 screens were individually inspected.
- Fresh Impeccable design review: initial disposition fix; all six material fixes
  resolved in one batch; final disposition ship. DESIGN and sidecar reconciled.

Artifacts are local evidence, not live app success. Lab screenshots contain clearly
labelled development-only illustrative data. Existing user edits/payment changes
were preserved. No independent academic accuracy or model-versus-human result exists.

## Next agent

Read brain README, BANK-AUDIT and BACKLOG. Verify live setup before claiming anything
deployed. Start with authenticated source/key extraction and development/held-out
fixtures; do not open paid generation on missing prices or empty references. Keep
the $2 calibration hold and $10 ceiling. Never reset the ledger or publish the old
Economics sample based on its heuristic grade. Follow BACKLOG in order.

## 2026-10-01 stabilisation and landing rebuild (Claude)

Done and verified locally (dev server, port 3100):
- Homepage was unstyled: ChatGPT's last pass shipped about 20 `cuet-*` classes with no CSS.
  `src/app/page.js` rebuilt on the existing `.mm` system plus `src/app/landing.css`
  (`.lp-*`): hero with playable five-question drill, subject keys, live stats band,
  Arena/Radar/Compass screens (static, labelled illustrative), steps, Score Recovery
  Lab replay, free vs Pro (₹99 once) comparison, FAQ, close. On phones the drill
  follows the lead directly; subject keys follow the drill.
- `/api/leaderboard` returned 500: `Database.getLeaderboard` put 512 user ids in one
  `.in()` filter (20 KB URL, HeadersOverflowError) and silently read only the first
  1000 of 1807 attempts. Now pages attempts and chunks user lookups by 100
  (`data/db.js`). Synthetic practice rivals remain labelled.
- `LiveStatsBand` fallback claimed "10,000+" questions; live bank is 6,963
  (`/api/stats`). Fallbacks are now "6,900+" and "40". Bank note reworded to
  "automated schema, duplicate and answer-key checks".
- `/login` and `/signup` still used legacy dark utility classes inside the paper
  world. Rebuilt with `AuthShell`, `auth.css` and a restyled `SignupCard` (auth
  logic unchanged: Google, email link, 8-digit OTP).
- Testimonials: no invented student quotes were added. `src/lib/voices.js` is an empty
  list; the landing section renders only when real, consented quotes are added.

Verification: `npm run lint` clean; `npm run build` passes, all routes; test:recovery
15/15, test:nta 22/22, test:answer-integrity 6/6, payment_entitlements 11/11.
Public routes and `/api/stats|subjects|leaderboard` return 200 locally; 390px and
1440px landing/auth captures show no horizontal overflow.

Not verified: any signed-in screen (dashboard, test, result, saved, profile, Compass,
PrepOS) was NOT visually checked this pass (no test credentials used); Quick Practice
submit/resume/idempotency from the handover; Razorpay checkout end to end; production.
Remaining legacy dark-style screens inside `(app)` still need the same audit.

## 2026-10-02 landing redesign round 2 (Claude)

Owner rejected the paper homepage as less polished than mockmob.in, prepium.in and
ug.preparoo.app. Rebuilt `/` as "Night Arena" (see DESIGN.md): layered grid/dot-matrix
backdrop with pointer-lit dots, hero stage (playable drill + Example chips), subject
marquee, live stats, wide/pair/wide/trio bento (Arena, Radar, PrepOS, Compass, three
small tiles), animated three-step section, Score Recovery Lab replay, live per-subject
counts, free vs Pro, FAQ, closing band. Restored FAQ + breadcrumb JSON-LD from the old page.

Root cause of the hover "shake": `DecodeWord` re-scrambled on hover and glyph widths
differ. Deleted; replaced by width-reserving `MorphWord`. Verified by measuring every
hero element's box before/after hovering the primary CTA: no movement (only the
decorative chips on their own loop). Drill height is constant before/after answering.

Verified in the browser at 320, 390, 820x1180, 1024x768, 1280x720, 1440x900,
3440x1440 and 844x390 landscape: no horizontal overflow at any size; hero balanced;
mobile nav works on dark. `npm run lint` clean; `npm run build` passes; test:recovery 15/15;
payment_entitlements 11/11.

Not verified: real-device performance on a budget Android (backdrop uses static CSS layers;
pointer layer is disabled on touch); reduced-motion behaviour was reviewed in CSS, not
exercised in a browser; Lighthouse not run; no screen-reader pass beyond the a11y tree.
`DynamicCompassPreview.jsx`, `ArenaPreview.jsx`, `RadarField.jsx` are now unused by `/`.

## 2026-10-02 free DU eligibility and cutoff calculator (Claude)

New public tool at `/cuet-cutoff-calculator` plus a landing-page teaser (`#du-eligibility`),
nav and footer links, a hero link, a Compass-tile link, a Radar-page link that pre-fills the
student's practised subjects, and a pointer from the Admission Compass page.

Data (all from four public DU documents, user-approved download of five PDFs, ~9.7 MB):
UG Bulletin of Information 2026-27, and the Round I, II, III minimum-allocation-score lists.
Pipeline in `scripts/du-csas/` (geometry-based PDF parsing, hard failure on ambiguity);
output is static JSON in `public/du/2026/` (no serverless function runs for the tool).

Verified:
- Cutoffs: S.NO contiguous (1,393 / 1,393 / 956), identical seat lists across Rounds I and II,
  Round III a subset, and the multiset of every parsed score equals the numbers printed in the
  PDFs: 17,316 cells (two whole-number cells in Round I located individually). One displayed
  value (Dyal Singh B.Com. (Hons.) Round I OBC-NCL 695.3) traced to the raw PDF coordinates.
- Eligibility: 73 Bulletin programmes, 149 combinations all parsed into typed slots, every
  combination satisfiable. Engine tested (`npm run test:du`, 12 tests) including language
  specific rules, GAT combinations, the "considered only if seats remain" combinations III/IV,
  and the UR-merit rule for reserved categories.
- `npm run lint` clean; `npm run build` passes (route prerendered static); test:recovery 15/15,
  test:nta 22/22, test:answer-integrity 6/6, payment_entitlements 11/11.
- Browser: desktop 1440/1024 and mobile 390 on the calculator and the landing teaser; no
  horizontal overflow; selection, URL sharing, expand-to-cutoffs, score status all exercised.

Also fixed: `html, body { overflow-x: hidden }` in globals.css made `<body>` a scroll container,
so `position: sticky` (including the site's own nav) never stuck. On marketing-system pages
(`.mm.lp`) it is now `overflow-x: clip`.

Not done / limits:
- Seat counts (Prepium shows them): the seat-matrix PDF is organised differently and was not
  parsed. Not shown rather than guessed.
- 5 Bulletin programmes (3 music, B.F.A., B.Sc. PE) have test-based merit and no CUET cutoff
  list; shown for eligibility only.
- 2026 data only. Add a 2025 cycle by adding a second dataset folder; the UI reads `meta`.
- No Lighthouse or real-device run. No screen-reader pass beyond the a11y tree and aria states.
- `src/lib/admissionCompass.js` (existing, untouched) still uses invented per-college "target"
  scores and category adjustments. It is clearly labelled as an estimate, but it should not be
  presented as cutoffs. The calculator is the source of real published numbers.

## 2026-10-02 calculator rework after owner feedback (Claude)

Owner reported the cutoff calculator "not updating live", no way to recheck, clunky UX, and that
subject mapping did not show that IP/Computer Science (and similar) are one CUET subject.

What I could and could not reproduce: scripted clicks always updated state, so I found no
single hard failure. I did demonstrate real defects that make live updates invisible or
unreliable for a person: a floating "N programmes unlocked" bar sat over the chip grid (scripted
`.click()` bypasses overlays, a finger does not), the results were far below a very long picker,
and the address bar was rewritten on every change. All three are removed.

Changes: two-pane layout from 1100px (sticky subjects pane, results beside it, live); below that a
sticky summary bar with the live count and Edit / View buttons; removable selected-subject tray;
full official subject names on chips plus a finder that maps aliases (IP, Informatics Practices,
Biotech, Book Keeping, Applied Maths...) to the one subject DU/NTA count; every programme card shows
the Bulletin's exact combinations with met / missing marks, and "Not eligible yet" rows open to the
same rules. The URL is read once on load and then cleaned; edits persist in localStorage; Share
builds the link on demand.

Accuracy check: B.Sc. (Hons.) Computer Science has two Bulletin combinations and BOTH require
Mathematics/Applied Mathematics, so a commerce student with only IP is not eligible. Tests added
(16 total in `npm run test:du`): that case, the Computer Science / IP equivalence, rule
explanations, alias search. Verified in the browser with a real click: adding Mathematics took
35 -> 41 programmes and made B.Sc. CS Honours and Economics Honours appear.

Note: Prepium lists Sanskrit under List B; the 2026 Bulletin's List B (22 subjects) does not,
so the tool follows the Bulletin. Lint, build, test:du 16/16, recovery 15/15, nta 22/22,
answer-integrity 6/6, payments 11/11. No real-device or screen-reader run.

## October 2, 2026 — homepage refinement and exam-interface comparison

Preserved the existing homepage and added a refined hero practice frame, persistent
animated light/dark switch, four original campus illustration cards, and an
interactive MockMob/NTA-style comparison. Premium NTA sessions now offer a
presentation switch on the same runner; the existing scoring, timing, entitlement
and credit logic is unchanged. College cards hand off a validated programme filter
to the existing DU calculator.

Verification: production build and ESLint pass; NTA 22/22, DU 16/16, recovery 15/15,
answer integrity 6/6, payment entitlements 11/11. Browser checks at desktop and
390px/320px confirm theme persistence, mobile menu, no horizontal document overflow,
preview answer/review/clear/reset state, and Commerce preset 35/73. Premium setup
link selects NTA Mode with 50 questions / 60 minutes without starting the mock.
New browser tab reported no console errors. Generated campus asset is 276 KB WebP.

No production deployment, migration, checkout or scored exam submission performed.
The real premium exam submission path with the classic skin remains a release check.
NTA style is a reference-based practice console, not a guarantee about the official
2027 UI. Source changes and their rollback boundary, reference survey, image prompt
and evidence are in HOMEPAGE-REFINEMENT-2026-10-02.md and artifacts/homepage/.

## October 2, 2026 (second pass) — repair, theme, Arena alignment (Claude)

Local source only. Nothing deployed, migrated, purchased or generated. Screenshots:
`artifacts/refinement-2026-10-02b/`.

Confirmed defects fixed (cause → fix):
- Radar/analytics was empty for every student: `/api/analytics` kept only `server_snapshot_v1`
  attempts (Score Recovery pilot, not launched) while practice writes `server_practice_v1`.
  Now counts the owner's practice; pre-server browser-scored attempts are included and labelled
  (owner decision). Recovery/progress evidence rules are unchanged. `data/attempt_scoring.js`.
- Submission could be rejected by clock skew: runner timed events as client `Date.now()` minus
  server `startedAt`; server rejects events later than its elapsed time + 2 s. Runner now times
  from receipt using only the server duration; `finishPractice` scores answers without the
  (discarded) event log if the log is malformed (`scorePracticeSubmission`). Answers still fully
  validated. Recovery-pilot `finishSession` is unchanged.
- Result page called every new practice attempt "historical… not scored from a server-held
  snapshot". Copy now distinguishes server-scored practice from older browser-scored attempts.
- Nav dropped Radar, Saved, Compass, PrepOS, Explore, Ranks, Contribute, My uploads (pages still
  existed; several are sold as Pro). Restored as a "Tools" group (owner decision). App tour pointed
  at nine missing nav targets; rewritten for the current nav.
- Light mode: subject-card hover was `#121712` behind `#172016` text (1.08:1); landing secondary
  button hover `#151a14` (1.05:1); dark mode on paper sub-pages: shared `.mm-btn--secondary:hover`
  was `#fff` behind near-white text (1.11:1); calculator/teaser lime, amber and pink text on paper
  (1.2–2:1). Cause: night-only literals in `landing.css`/`du.css`/`globals.css`. Fixed with theme
  roles (`--accent-text`, `--accent-line`, `--accent-wash`, `--tint`, `--surface-hover`,
  `--warn/bad/good-text`) defined per theme in `marketing-theme.css`; per-selector light patches removed.
- 900–1023 px: marketing nav labels wrapped onto two lines after the toggle was added. Text links
  now move into the menu below 1024 px; CTA and Log in stay. NTA-style "Mark for Review & Next" and
  "Clear response" were hidden at 761–1023 px; now visible below 1024 px.

Refinements: theme switch redesigned (sun/moon thumb, inset-shadow crescent, stars, spring travel,
press squash, circular View Transition reveal from the switch; instant under reduced motion or
without support). Hero practice bay restored (framed bay, lit slate card, deep shadow, skeleton
explanation) plus a two-card stack; status row and purpose rail kept. Campus cards pair as
landscape cards at 761–1023 px. Arena: scoped `src/app/(app)/arena.css` re-skins shell, dashboard,
shared app primitives and the branded runner; NTA-style console untouched apart from the
breakpoint fix. Dashboard copy and numbered setup steps; no logic change.

Verified locally:
- Tests: recovery 17/17 (2 new), NTA 22/22, DU 16/16, answer integrity 6/6, payments 11/11,
  mock selector + practice filtering + offline batch (pure) 13/13. Paid-model pipeline tests not run.
- `npm run lint` clean; `npm run build` passes. Production server: `/preview/arena` and
  `/preview/recovery` 404; unauthenticated `/api/analytics`, `/api/attempts`, PATCH `/api/sessions` 401.
- Browser: computed-state contrast audit of every hover/focus/pressed/selected/disabled rule on
  `/`, `/pricing`, `/cuet-cutoff-calculator`, `/login`, `/about`, `/cuet-2027`, `/features` in both
  themes; light homepage clean; calculator text (542 nodes) passes in light with results open.
  Real-pointer hovers checked in both themes. Toggle: click, Space, Enter, focus ring, aria-checked,
  persistence, reveal animation from the switch. No document overflow at 15 widths 320–1440.
  Drill answer causes no layout shift (stage 718 px before and after).
- Arena via `/preview/arena` (development-only, mock user, stubbed account APIs, no production
  writes): dashboard subject/mode/count selection, 50-credit gate disabled with top-up hint, launch
  URL; branded runner answer, mark, clear, navigate, submit; captured payload scored by the real
  `scorePracticeSubmission`; NTA-style console at 1366 and 900 px; mobile menu at 375 px.

Not verified / release checks:
- A real signed-in Quick Practice (start → submit → result → Radar) was approved by the owner but
  not run: the browser pane had no session and credentials cannot be entered for the owner.
- Live premium NTA submission with either interface; Razorpay checkout; production deploy.
- Reduced-motion paths reviewed in code, not emulated. No real-device, Lighthouse or screen-reader run.
- `/api/bookmarks` hides saved questions that fail the current quality gate, but the free-tier
  25-save limit still counts them (not changed).
- Other app pages (Compass, Radar, Saved, Profile…) inherit the re-skinned primitives but their
  page-specific layouts were not redesigned.

## 3 October 2026 — Round 4: restored craft, Pip guide, motion system, study loop (Claude)

Local source only. Nothing deployed, migrated, purchased, generated or sent. Full record:
`docs/brain/ROUND4-NOTES.md`; motion rules: `docs/brain/MOTION.md`; brief:
`scrollcraft/builds/mockmob-round4/BRIEF.md`; evidence: `artifacts/round4/`.

- Regressions fixed at their measured causes: comparator palette (44px min-width in 1fr tracks,
  5-column phone override with span-2 holes, lost NTA placeholder skin, clipped focus rings);
  Arena entry and exam-day card (round-3 blanket overrides; containers now fade, leaves rise, so the
  fixed phone dock is never re-anchored); exam-day clock now really counts down, offscreen-paused.
- Pip: one guide that hands off between five perches and reacts to page events (drill answer, Mistake
  Lab next move, exam preview answers). Chosen over two other built prototypes (archived). Static
  perches remain the no-JS/reduced-motion experience. No mascot motion in the timed runner.
- Study loop: Result ends with one next step from the PrepOS insights engine (no chapter named
  below its 4-answer ranking rule), plus Review, Saved, Radar, Back to Practice. Saved links back to
  Practice.
- Sweep: 760 loads (38 routes × 10 sizes × 2 themes): root overflow 0, console errors 0. Found and
  fixed a Practice panel cut off from 320–1440px (grid `auto` tracks) and six sub-44px controls.
- Verified: `npm run lint` clean; `npm run build` passes; recovery 17, DU 19, learning 74, NTA 22,
  answer-integrity 6, payments 12, Explore/contribution 8 = 158/158 pass (logs in
  `artifacts/round4/logs`). Reduced motion, 200% text, real-touch flows, light theme and contrast on
  new surfaces checked in Chrome. Lab perf (prod build, 390px, 4× CPU, Slow 4G): LCP 2.9–3.3s, CLS 0.
- Not verified / release checks: physical phones, screen reader, authenticated persistence and
  resume, live premium NTA submission, payments; LCP above target with cause not isolated.

## 3 October 2026 — Round 5: continuous Pip journey and Arena handover

Local implementation. Full evidence and limits: `docs/brain/ROUND5-NOTES.md`; scoped future
work: `docs/brain/ROUND5-NEXT-FEATURES.md`; artifacts: `artifacts/round5/`.

- Seven ordered perches with hysteresis replace the narrow observer band. One desktop actor
  carries through a reserved gutter; phone motion stays local and follows document scrolling.
  Reverse/fast crossings coalesce. Larger original art, pose fades and static reduced motion.
- Lab celebration waits for the visible next-move control and settled visible Pip. One peak
  per view. Today, Practice, Review and Saved gain calm companion states; recorded-session
  acknowledgment uses server data. PrepOS keeps its orb, voice and capability/credit wall.
- Three travel/PrepOS studies archived; temporary Round 5 route removed. One requested image
  concept generated; original six pose assets remain in product. Exact GPT Image 2.5 selection
  is unavailable through the tool, so no such model-version claim is made.
- Lint and production build pass. Recovery/DU/learning/NTA/answer-integrity/payment/Explore
  suites: 158 passed, plus two station-selection tests. 760 verified layout loads: 380 public
  production + 380 development fixtures; zero root overflow, pageerrors or failed loads.
  Reduced motion, quarter-interval reverse journeys and six 200%-text fixture views checked.
- Hero-animation ablation reproduced lower text LCP (phone 1.60–1.94s versus guide baseline
  2.27–3.64s). Removed only the measured lead paragraph's entrance animation; other entrances
  remain. Final production measurements and methodological limits are in ROUND5-NOTES.md.
- No deployment, production migration, bank writes, paid-content generation, outgoing email
  or checkout. Live authenticated persistence/resume, premium NTA submission, payments,
  physical devices and screen-reader acceptance remain release gates. Fixture counts and
  laboratory performance are not live account evidence or field Core Web Vitals.

## 3 October 2026 — owner-approved Round 5 follow-up and local-server recovery

Local implementation; full source map, evidence and limits: `docs/brain/ROUND5-COMPLETION.md`.
The owner subsequently approved implementing the remaining plan and restoring the site.

- Tonight's plan now uses the shared server plan and ties its recorded state to a current-day
  server-scored attempt. First-session/fresh-check milestones use real validated records.
  Thirty minutes includes ten minutes of review, which is not automatically marked done.
- Result offers evidence-gated, unseen-family five-question replay only when inventory permits;
  ownership/rate limits and launch checks remain authoritative. No generation or bank writes.
- Install/PWA support caches only three public fallback assets. Open-runner drafts preserve
  session identity, answers and deadline. Network submission freezes answers and supports
  bounded reconnect/reload without a new timer, debit or local score. Logout purges own drafts.
- Monthly cancellation now uses the installed Razorpay SDK's boolean argument and confirms
  rejected requests only through a matching terminal provider state. No provider operation ran;
  monthly activation remains gated because the plan ID is absent. One-time Pro access remains.
- Local dev restored at `http://localhost:3010/` with separate `.next-dev` output and disabled
  Turbopack development filesystem cache. The phone-blocking Next dev indicator is disabled.
  No reset/cache deletion/bulk revert. Earlier worker/cache/chunk failure logs are retained.
- Final build and lint passed; 172 automated tests passed, including question/payment/recovery
  contracts. 760 route/size/theme loads passed. New feature suite: 43 checks passed. Acceptance:
  37 forward/reverse wheel, clipped control/focus clearance, reduced-motion, 200%-text and iOS
  help checks passed. Rebuilt homepage: 20 size/theme checks passed; production PWA check passed.
  A concurrent autoplay timing run paused and failed; unchanged sequential rerun passed, both
  retained. Fixtures, browser touch and device emulation are not live persistence/hardware proof.
- Existing signed-in browser session inspected read-only: Today 20-minute plan → Practice setup,
  fixed-expiry Account, existing legacy Result and Review. No new attempt, score or debit.
  Opera/native-app access was unavailable; Gmail/OTP access was unnecessary and not performed.
- Remaining release gates: authenticated staging submission/resume and premium NTA with both
  skins, configured monthly plan plus sandbox billing/webhook evidence, physical Android/iPhone
  and screen reader. No deploy, migration, paid content generation, checkout or external message.

## 3 October 2026 — Pip intent and PrepOS refinement (Round 6)

Owner asked to preserve the good motion, make mascot actions contextual, reduce generic hero
details, strengthen PrepOS with its existing API/wallet and prepare next steps. Full handoff and
paste-ready Claude prompt: `CLAUDE-PIP-PREPOS-HANDOFF-2026-10-03.md`.

- Added one GPT-generated attentive pose with open eyes and relaxed arms. Removed sleep/wink
  defaults from scroll reading, pricing, comparison, Arena setup and loading. Original art stays.
- Pip points inward, including its static reduced-motion fallback. Single-face 140 ms entry
  replaces the overlapping-visors dissolve. Small scroll corrections retain the expression.
  Correct sample answers keep their hop; wrong answers receive an attentive nod. Keyboard
  answers trigger no mascot reaction. The Lab peak and mascot-free timed answering remain.
- Hero now states one fixed practice promise and leads with the actual five-question sample.
  PrepOS connects its next step with the record observation and an inspect/ask handoff.
- PrepOS Ask explicitly separates free record facts from optional one-credit model guidance.
  Source labels, receipts, wallet refresh, unknown-balance handling and same-ID retry are visible.
  Unresolved requests/conversations survive PrepOS section changes; late history cannot replace
  a new conversation. Effective paid expiry is recomputed using the shared entitlement rule.
  Explicit free requests cannot fall through to a paid model; new saved replies carry their source.
- Final build and lint passed. **172 existing automated tests passed** across recovery, question,
  payment, wallet, reservation, model lifecycle and other contracts. A final focused PrepOS rerun
  also passed all 26 tests. **147 browser report entries passed** at four widths and both themes:
  forward/reverse stations, inward pointing, one face, reduced motion, free/paid/unknown wallet
  states, lost-after-commit idempotent retry, keyboard/mouse reactions, wheel reversal and quiet
  companions with doubled root font size. Browser AI responses are labelled fixtures, not live
  model calls. Evidence and earlier failed test assumptions are retained in `artifacts/round6/`.
- Read-only configured Supabase check: wallet, ledger, reservation, runtime request and price
  tables answered. Funding table unavailable through the Data API (`PGRST205`); configured
  model prices not verified; available funding not established. Paid AI remains release-gated.
  Table readability does not establish RPC correctness or applied migration history. No migration
  was executed and no model/credit/budget call was made during this check.
- Public live PrepOS still shows its earlier public-guide/missions interface. That observation
  does not establish deployment of this checkout's guarded contracts. No outgoing email, paid
  educational generation, attempt/score fabrication, checkout or deploy. Port 3010 dev is left
  running; the temporary port 3011 production verification server is stopped.
- Next gates: resolve funding-table availability, verify actual schema/RPCs against saved SQL
  without blindly reapplying migrations, establish authorized runtime funding/current prices,
  reconcile wallets and run real staging concurrency/retry/release. Then consider activation.
  Durable client retry after reload/drawer closure, physical phones, screen reader and prior
  authenticated staging/payment acceptance remain unverified. This refinement preserves the
  retry ID across section changes only; it does not claim paid-request reload recovery.

## 5 October 2026 — Luna-only routing, shorter mobile home, light default, AI purchases

Source changes (not yet deployed; deploy needs `AI_LUNA_MODEL` optional and the Razorpay env below):
- **Model routing:** `src/services/ai/providers.js` now runs GPT-6 Luna only. `fast` tier = no reasoning, `smart` tier =
  low effort; callers that solve/generate questions pass `reasoningEffort` explicitly (medium+). Fallback is Luna, no
  reasoning. Question moderation (`src/lib/moderation/ai.js`) moved from a direct Claude call to the budget-guarded
  router, Luna at medium effort. `AI_FAST_MODEL`/`AI_SMART_MODEL`/`AI_FALLBACK_*` no longer route anywhere.
- **Homepage:** removed Subjects, Marquee, How-it-works, Proof band, mini tiles, Compass Pro box, college destinations;
  Instagram moved up under the statement; stats are now combined followers, reel views (owner-stated 100K+ floor,
  `REEL_VIEWS_FLOOR`) and recorded likes+comments. Product screens hidden under 700px. Mobile page 20.2k → 15.1k px.
- **Theme:** light is the default (`layout.js`); first-visit hint on the switch (`ThemeToggle hint`), shown once.
- **Payments:** `RELEASE_GATES.aiCommerce = true` (owner, 5 Oct); PrepOS top-up packs (₹10/50, ₹20/150, ₹50/400) now sell
  on `/pricing`. Monthly Pro ₹99 opens when `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is set; create it with
  `scripts/payments/create-razorpay-plan.mjs`. Pro keeps 50 PrepOS credits/month, Free 10.
- Verification: `test:learning` 80/80, `test:recovery` 35/35, payment + landing tests 16/16; browser checks on 375px.
- **Unresolved gates:** Razorpay keys + plan ID + webhook secret are empty in `.env.local`; no real captured top-up or
  subscription charge has been verified; Vercel env not updated.

### 5 October 2026 (later) — landing page restructure, feature tour
- Reverted the over-trimmed homepage: Compass Pro box, college destinations, stats band restored. Removed only the Subjects
  block (owner), the subject marquee and the three-step "how it works". Instagram stays where Subjects was.
- New `FeatureTour` (`src/components/landing/FeatureTour.jsx`, `src/app/feature-tour.css`): eight tools, one idea per slide,
  swipe on phones (scroll-snap), list + stage on desktop, autoplay with pause, only while on screen. Replaces the bento.
  Slides accept `video: '/demos/<id>.mp4'`; no recordings exist yet, so the animated screens play.
- Phone polish: glass header with progressive blur, floating glass dock, blur-in reveals (`.lp .rv`, reduced-motion safe).
- Reference studied: ug.preparoo.app (Webflow + GSAP; 7.1k px on mobile; one feature carousel, product mocks, sticky CTA).
- Tour v2 (same day): desktop is tool pills + a split stage (copy left, screen right); phones get equal-height cropped glass cards.
  Copy rewritten; Rival slide now says what it is (a fixed accuracy-and-pace target, not other students).
  `LiveStatsBand` drops a figure that fails to load instead of printing "Unavailable". Cause of the "unavailable" the owner saw:
  the preview dev server lacked `--use-system-ca` (TLS to Supabase failed); `.claude/launch.json` now uses it. Production unaffected.
- Tour v3 (same day): slides now use `TourScreens.jsx` + `tour-screens.css`, compact demo screens that play a scripted
  sequence each time their slide becomes active while the tour is on screen (timer ticks, options tapped, rows arriving,
  typing, bars filling), then hold the finished state; reduced motion shows the finished state. Nothing is cropped on phones.
  Verified frame by frame in a foreground Chrome (chrome-devtools) at 390x844 mobile and 1440x900: all 8 demos play and settle.
  Note: the desktop app's Browser pane throttles timers when hidden, so it is not reliable for checking motion.

## 4 October 2026 — UI/UX audit (audit-session date)

- Documentation-only audit saved to `docs/brain/UI-UX-AUDIT-2026-10-04.md`; raw evidence and screenshots in
  `artifacts/ui-ux-audit-2026-10-04/`. Independent visual and implementation reviewers completed before synthesis.
- Design health 26/40; technical health 14/20. Ten accepted groups: P0 0, P1 1, P2 8, P3 1. Highest priority:
  illustrative key agreement must not imply official correctness or explanation safety. Other priorities:
  phone journey/feature repetition, result mascot overlap and split percentage, touch/keyboard semantics.
- Homepage checked at widths 320/360/390/430/768/1024/1440/1920; all observed MockMob global widths fit.
  Public pages, 15 student fixture views, both themes, live home/signup and three live competitors sampled.
  Initial profile/test loading frames are not full-state verification. Incorrectly labelled initial desktop rows
  are retained as provenance and excluded; corrected 1440 measurements are the desktop evidence.
- Sampled answer feedback/focus, menu Escape, tour ArrowRight, timed palette, malformed email without sending,
  and long-name/empty/error fixtures. Contrast sampling had no eligible content-text failures within its limited
  coverage; gradients/animation and other unsupported cases were skipped. No whole-site WCAG certification.
- Detector ran once: 137 raw alerts, largely contextual advisories; no bulk theme/runner normalization warranted.
  Current aiCommerce=true supersedes the older closed-top-up assessment; target-size equivalent-control exception
  prevents declaring a definitive WCAG failure from dots alone. Both reconciliations are explicit in the report.
- No UI code changes, tests/builds, paid model calls, real attempts, migrations, auth completion, emails, payments or
  deploys performed. Existing dirty tree/dev server preserved. Audit tabs and temporary viewport overrides cleaned up.
- Open gates: real phone keyboards/safe areas, screen reader, 200% text zoom, full hover/focus/reduced-motion matrix,
  background interruption and budget-device/slow-network performance; authenticated persistence/payments/AI receipts.
  Live landing differs from local; this audit does not establish deployment of the new feature tour or configured AI.

### 4 October 2026 — owner-selected UI/UX implementation plan

- Saved `UI-UX-IMPLEMENTATION-PLAN-2026-10-04.md` and linked it from the brain README/audit.
  Owner retains official-key trust wording; wording-first audit priority is superseded for this sprint.
- Order: reproducible baseline → phone performance/composition → accessibility → student/error states
  → activation flow → final measurement and release evidence. Cosmetic detector cleanup, unused demos,
  arbitrary competitor page-height targets and blanket motion/feature removal are excluded/deferred.
- Current source review found held/not-explained repair outcomes enter the Result `repaired` set, which
  drives a Repaired badge. Plan requires fixture reproduction and separate handled/outcome states;
  no runtime reproduction or fix is claimed in this planning pass.
- Planning only: no UI edits, performance runs, tests, paid calls, migration or deployment performed.
  Performance acceptance separates controlled production-build traces from real-user Core Web Vitals.

### 4 October 2026 — UI/UX plan implementation

- Implemented phone hero/sample composition; tour carousel controls, inert slides, focus/manual pause,
  bounded pausable demo timelines, hidden/offscreen gating and 44px controls; official-key wording retained.
- Practice setup now precedes supplementary commentary/statistics and no longer waits for optional panel
  reads. Pending/unavailable counts are explicit; matching/expiry/idempotent server quote guards remain.
  Scoped load retry retains choices; phone summary exposes subject, mode, count, time, marking and cost.
- Result mascot height/entrance and metric units fixed; distinct explanation/held/unexplained outcomes,
  handled queue vs explanation progress, retained visited answer state across collapse/filter, and safe
  same-ID retry/in-progress/released handling. No scoring, wallet, model, budget or entitlement changes.
- DU category arrows/Home/End and clear focus fixed; editable phone/tablet fields 16px; key targets 44px;
  transform progress bars; one main in timed runner and PrepOS.
- Baseline/final production builds and final lint passed; 179 tests passed (35 recovery, 80 learning,
  59 payment/question/NTA/DU, 5 new UI state tests). Final key-route light 320/390/768/1440 and dark
  320/390/1440 matrices have zero horizontal overflow and no result mascot/metric overlap.
  Fixtures cover distinct repair outcomes, pending/error states and retained held panels. Browser
  checked DU keyboard, menu Escape focus return, sample feedback, tour freeze and one-main wrappers.
- Local production preview on 3020 checked public home, themes and sample; existing authenticated
  setup was read-only. Signup redirected to setup, so current-run native email validation is unverified.
  No new real session/paid repair/payment/signup completion, data migration or deploy performed.
- Several local inventory reads took 7.5-11s and had blocked setup; dependency removed and tested with
  never-resolving-statistics fixture. No device speedup, Core Web Vitals or field gains claimed.
- Full evidence/open gates: UI-UX-IMPLEMENTATION-RESULTS-2026-10-04.md and
  artifacts/ui-ux-implementation-2026-10-04/. Physical phone, screen reader, actual 200% zoom,
  reduced-motion browser/full contrast matrix, controlled throttled traces/field CWV, real transaction
  receipts and production deployment remain open. Measurements cannot be replaced with screenshots.
- Existing checkout changes retained. Diff check only reported the pre-existing ProductScreens.jsx EOF
  blank line. Do not bulk-reset/revert these files; review the scoped implementation hunks.

### 4 October 2026 — authorized UI production release preflight

- Owner requested publication of the UI changes. The staged release includes the reviewed landing/tour,
  mobile/accessibility, dashboard, result/repair presentation and DU refinements with their source dependencies.
- Existing AI-routing/moderation, aiCommerce enablement, pricing, payment scripts and corresponding
  backend-test edits are excluded and retained locally. This release does not activate new commerce,
  change model routing, migrate data or call a paid model.
- Exact staged source tree `7cfe2abf1d958767fb32f5bcd270560900cddd58` was exported independently:
  production build and lint passed, with 179/179 recovery/learning/payment/question/NTA/DU/UI-state tests.
  Evidence: `artifacts/ui-ux-release-2026-10-04/`. Shared dependency junction was rejected by Turbopack;
  the successful build used a real dependency copy. No application workaround was introduced.
- Push/Vercel readiness and live-domain/mobile/desktop smoke are pending at this preflight entry.
  Hardware, screen-reader, measured throttled performance/CWV and real transaction gates remain open.

### 4 October 2026 — UI release live verification

- Pushed `f70e385909ff454f10bf83e60d96a6883bb31c17` to `origin/main`. `Vercel – mockmob`
  reached success at `2026-10-04T12:50:34Z`; deployment:
  https://vercel.com/atishay07s-projects/mockmob/6VA6xyZTYuXB87urHXQLAgeusbAx.
- `https://www.mockmob.in/` serves the new tour, short hero lead and sample CTA with HTTP 200.
  Apex redirects once (307) to www, then 200. Calculator returns 200; no redirect loop.
- Live home light/dark checks at 320/390/1440px: no horizontal overflow, one main.
  Sample CANDID/Frank feedback works; selecting Mistake Repair pauses the tour with one active,
  seven inert slides and 44x44px controls. Live calculator at 390px: category ArrowRight selects
  and focuses OBC-NCL with one tab stop; clear empties search, restores focus, and input is 16px.
  No captured browser error logs in this smoke. Phone and desktop screenshots saved.
- Evidence: `artifacts/ui-ux-release-2026-10-04/{github-status.json,live-http.json,live-ui.json}`
  and build/test/lint logs. This post-deployment receipt is a local status update; deployed source
  and preflight documentation are in the release commit above.
- Existing unrelated AI/commerce/payment edits remain local. No production migration, paid model
  call, real attempt, purchase or signup completion was performed. Physical devices, screen reader,
  actual zoom, controlled performance/field CWV and real accounting receipts remain unresolved.

### 4 October 2026 — guided tour follow-up

- Owner rejected the phone dropdown and easily interrupted/slow feature playback after the UI
  publication. Rebuilt the tour as an automatic 4.8-second chapter sequence with shared progress,
  explicit Pause, a chapter strip and an Up next nudge. Normal vertical browsing no longer turns
  rotation off. Pointer navigation resumes its cycle; horizontal input holds briefly while settling.
- Preserved keyboard reading holds, explicit resume, reduced motion, inactive-slide isolation and
  hidden/offscreen suspension. Phone product panels fit without overhang; the sample dock steps
  aside during the tour. Nearby Mistake Lab stages also use 4.8 seconds. Official-key copy retained.
- Final isolated application source build and lint passed; nine relevant tests passed. Both-theme
  320/390/768/1024/1440 matrices have zero root overflow, no screen overhang and 44px controls.
  Browser observed auto progression/loopback, scrolling/navigation without sticky pause, explicit
  pause, and keyboard hold/resume. No measured wall-clock/FPS/device performance claim.
- See `TOUR-REFINEMENT-2026-10-04.md` and `artifacts/tour-refinement-2026-10-04/` for details.
  Production readiness/live smoke pending at this entry. Physical phones, screen reader and CWV
  gates remain open. Unrelated AI/commerce/payment edits retained locally; no migration/paid call.

### 4 October 2026 — guided tour published

- Final commit `6c5e05b6562830fc2e12450a87846eb8c678f0c2` is on `origin/main`.
  `Vercel – mockmob` succeeded at `2026-10-04T14:16:25Z`; deployment:
  https://vercel.com/atishay07s-projects/mockmob/5LCkkWSUNNWQU3KoWt1BvLkDpYTd.
- Live www serves the new chapter strip, progress and Up next controls with HTTP 200.
  Apex redirects once (307) to www, then 200. The former feature dropdown is absent.
- Live phone playback advanced to another chapter after ordinary vertical scrolling.
  Fresh production tab checks confirmed actual 320/390/1440px viewports in light and dark:
  zero root overflow and no tour controls smaller than 44px. Desktop playback resumes when
  its media enters view. No captured browser error logs in the final smoke.
- Evidence: `artifacts/tour-refinement-2026-10-04/{github-status-final.json,live-http.json,
  live-responsive-final.json,live-phone-light.jpg,live-desktop-light.jpg}` and local build,
  lint, nine-test and responsive/motion observations. The final small phone-caption change
  passed targeted lint; the exact final commit passed Vercel's production build.
- This post-deployment receipt remains local. Unrelated AI/commerce/payment edits remain
  untouched and unpublished. No migration, paid call, signup or purchase was performed.
  Physical swipes/momentum, screen reader, actual browser zoom/reduced-motion settings,
  controlled CPU/network performance and field CWV remain unverified.

### 4 October 2026 — connected preparation suite verified for rollout

- Implemented shared Today sequence, Learn, server-scheduled Recall, durable versioned runs/events,
  separate study progress, selected subjects/time, Pro weekly plans and custom mixed recall.
  Mobile Today/Practice/Learn/Review retains the other destinations through More. Active sessions
  and due checks replace their plan blocks; a persistent full-mock shortcut retains the existing
  quote/eligibility/credit path. Teaching/card exposure excludes those families from fresh checks.
- Owner explicitly authorized current Supabase project `isrxrxzjocewrdureyhp` with existing data.
  Saved migrations and isolated dry runs preceded SQL-editor application of score-recovery,
  connected-learning and study foundations; the published-version backlog follow-up also applied.
  The original transaction verified existing questions/attempts/credits/entitlements/credit receipts
  unchanged. Current service-role retry/scheduling/stale-revision smoke passed and rolled back all
  verification writes. CLI migration history remains unreconciled; do not blindly reapply pending SQL.
- Published two units and 23 cards: English twenty-word deck and sacrificing/gaining ratios.
  Canonical hashes and anonymous table denial verified against the current project. WordNet license
  preserved; NCERT formula/source reconciliation and exact arithmetic passed. This does not release
  formal recovery pathways or certify academic calibration, exam fit, mastery or score gains.
  Remaining four-subject coverage is visibly pending; offline packs and curriculum expansion remain.
- Clean isolated release excludes owner's unfinished pricing/provider/AI-evaluation/payment-script/
  landing edits. Lint and production build passed. 166 distinct tests passed: recovery 35, learning
  80, answer integrity 6, NTA 22, payment entitlements 12, study 11. Final plan changes passed study
  tests again; final mock/lesson links passed targeted lint and production rebuild. Complete local
  four-migration/import/retry/runtime dry run passed. Authenticated browser saved/resumed/completed
  the English lesson, persisted/reloaded a recall rating and saved/restored time preferences.
- No paid model calls. Existing Free/Pro prices, entitlements, atomic credit RPCs and AI allowances/
  persistent $50 generation and $25 monthly runtime guards unchanged. Only three independent study
  flags were saved as true in production on the domain-verified Vercel `mockmob` project.
  Publication/live verification pending at this entry; local build is not proof of deployment.
- See `STUDY-SUITE-2026-10-04.md` and local `artifacts/study-suite/` receipts. Real Android/keyboard,
  screen reader, actual 200% text/zoom/reduced-motion settings, field CWV and delayed unseen-question
  outcomes remain unverified. Rollback disables study flags and retains learning records.


### 4 October 2026 — preparation suite published

- Commit `a6a61cc276d9df36b43e4760c08df0dfe83802a3` is on `origin/main`.
  Domain-verified Vercel project `mockmob` deployment is Ready:
  https://vercel.com/atishay07s-projects/mockmob/FeimHt2rAGpA3qG4Eepoqfa43PNJ.
  Vercel showed 49 seconds and 23:21:17 IST on 4 October. Production flags are enabled.
- Live HTTP smoke passed: apex 307 once to www then 200; www and Learn 200; anonymous
  study catalog 401; dev-only study preview 404. Public Learn redirects signed-out users
  through existing authentication. Live signed-in browser check awaits owner Google sign-in;
  the Google chooser shows the existing account signed out. No credential was generated,
  transferred from localhost or changed to bypass login.
- Authenticated current-project readback passed: English lesson complete, recall cursor one
  after the first card, answer hidden on the next card, one persisted FSRS review whose due
  date matches the run receipt, and original twenty-minute preference restored. Actual
  owner QA records remain resumable; they are not student outcome evidence.
- Final authenticated release library and recall checks across 320/390/768/1024/1440 plus
  short landscape showed zero root overflow and no study buttons/links below 44px. Dark
  phone library also had no overflow. Full-mock shortcut selected the existing Full Mock
  and displayed its access quote without starting or charging a practice session.
- Evidence: `artifacts/study-suite/{production-release-receipt.json,production-deployed.png,
  live-http.json,authenticated-study-receipt.json,responsive-release-library.json,
  responsive-release-recall.json,phone-library-dark.png}`. This post-release receipt remains
  local; application source and pre-release verification status are already published.
- Original dirty checkout and unrelated owner edits remain intact; release checkout/branch is
  `artifacts/study-suite/release` / `codex/connected-study-suite`. Original local main still
  points at its prior commit; reconcile intentionally before later publishing owner edits.
  Full curriculum/offline packs, formal calibration, CLI migration-history reconciliation,
  physical-device/assistive-technology/200%-zoom and field performance/outcome gates remain open.


### 4 October 2026 — signed-in preparation-suite production smoke passed

- Owner completed normal Google sign-in. Live library rendered both English and Accountancy
  units, existing Pro access, the completed lesson and recall progress. The existing recall run
  resumed at card two. A live reveal was saved and survived page reload; its answer, optional
  pronunciation, linked lesson and four rating controls rendered correctly. No scored session,
  practice-credit charge, purchased-entitlement change or paid AI call was made.
- Actual live library viewport checks passed at 320/390/768/1024/1440 and short landscape.
  Revealed recall passed at 320/390/1440 and short landscape. Each measurement asserted actual
  width/height, zero root overflow and no study buttons/links below 44px. No error logs were
  captured in the final live test tab. Earlier viewport results that targeted the build-queue
  tab were discarded and replaced with these measurements; they are not release evidence.
- Evidence: `live-responsive-library.json`, `live-responsive-recall.json`, `live-phone-library.png`,
  `live-phone-recall.png` and updated `production-release-receipt.json` in `artifacts/study-suite/`.
  Physical-device, assistive-technology, actual zoom/reduced-motion, field performance and
  curriculum/calibration/offline/history-reconciliation gates listed above remain open.


- Final signed-in live Today showed the same resumable study run, twenty-minute preference and
  the 4/6/10-minute sequence plus full-mock shortcut. Temporary viewport overrides were reset.

## 5 October 2026 — Published expansion and clearer study journey

Live implementation is in the isolated `artifacts/study-suite/release` checkout, published
through `86accc3` and `23ac1ddac20600865d94cd04843fdc36113e0a08` on `origin/main`.
The latter Vercel production deployment `628qJMZ5zB1ABCnb2iu1GiN4scG9` is Ready
(40s build; 02:21:12 IST). Original checkout remains at `6c5e05b` with owner edits preserved;
reconcile deliberately before publishing from this older checkout.

- Seven source-linked concept packets added: current 21 lessons / 86 cards / 221 variants,
  partial lessons in 15 of 54 chapters. Baseline 14 lessons/65 cards keep their exact hashes.
- Reusable compiler/source-validation workflow produces lessons, recall and summaries once;
  no paid content generation. Strict PDF/digest, arithmetic and key checks passed. Saved SQL
  and dry-run receipts preceded current-project inserts and immutable correction withdrawal.
- New cards require teaching; mixed revision opens its saved run; corrected sessions link
  to current content. Large selection tiles, explicit assistance buttons, specific next
  actions and optional one-credit lesson explanations improve the connected journey.
- One owner tutor QA call committed one credit, provider cost $0.00032835. Existing AI and
  wallet budget guards retained. Existing Android/offline work retained, not rebuilt.
- Recovery/learning/study/payment/integrity/NTA/UI: 182 distinct tests passed, plus lint,
  production build and live public/auth checks. Signed-in mixed revision, corrected-run
  navigation, saved lesson resume and Planning completion passed. Its daily cap correctly
  schedules three new cards tomorrow after five introductions today.

Detailed status/workflow/evidence are in the release checkout's `docs/brain/STATUS.md`,
`docs/brain/STUDY-CONTENT-WORKFLOW.md` and `artifacts/study-suite/v3/`.
Remaining: 39 chapter gaps and depth within touched chapters; actual Android/offline,
screen reader/OS zoom/reduced-motion, print output, field CWV and delayed outcome checks.
This is partial curriculum, not a claim of complete coverage or proven learning gains.


## 5 Oct 2026: Key Review + NTA integrity guard
- Key Review: when Mistake Repair's solve and blind second check both disagree with the key, the student now sees an
  acknowledgement ("We may have got this one wrong") with who picked what, plus a result-page log of held keys.
  A reload shows the same panel via `question_under_review`. Marks are NOT changed automatically; copy says so.
  Files: `src/components/recovery/KeyReview{Notice,Log}.jsx`, `data/repair_presentation.mjs`, `dispute` field in
  `src/services/recovery/mistakeRepair.js`. No migration, no extra model calls.
- NTA integrity guard: leaving the tab/window = strike; warnings 1-2 show an animated modal, strike 3 submits the
  session. Strikes persist across reload (`<session key>:integrity`), copy/paste/context menu blocked. Browser-side
  deterrent only: strikes are NOT sent to the server (attempt events accept only answer/visit), so there is no
  server-verified proctoring record. Files: `data/exam_integrity.mjs`, `src/components/arena/ExamIntegrityGuard.jsx`.
- Verified: `npm run test:learning` 84 pass (incl. new `exam_integrity_review.test.mjs`), eslint clean, preview
  walkthrough of both flows. Not verified: real multi-window/mobile app-switch behaviour, signed-in NTA run.

## 6 October 2026 — Subscription screening and Luna question factory

Implemented locally in this original checkout; owner edits preserved. No deployment,
production migration/data write, paid generation call or new question publication occurred.
The live study-suite changes described above must be reconciled before any release from
this older checkout (`6c5e05b`). Workflow: `docs/brain/QUESTION-FACTORY-RUNBOOK.md`.

- Legacy complete-bank read-only scan: **9,242** rows, **6,299 mechanically clear**,
  **2,943 with suspect signals**, 284 bundles of up to 20. Signals are not confirmed
  academic errors. Included desktop Luna medium screened one clear four-subject sample:
  15 no-issue-found, three suspect, two incomplete; ID/hash-validated locally, not imported
  to production and not upgraded to signed publication evidence. Additional API spend $0.
- Subscription bridge strips provider credentials, checks ChatGPT account/limits, refuses
  API login/purchased/unknown credits, and pauses without paid fallback. Codex CLI is not
  logged in here; the actual sample used a signed-in desktop agent. Claude remains optional.
- Source catalog contains four 2026 syllabus PDF hashes and official 2025/current 2026 final
  key PDFs. Target-subject provisional extraction: 4,366/4,033 rows, including 55/20
  excluded rows. 2025 position keys and 2026 official option IDs require distinct exact
  mappings. The current June 23 key is linked by the hashed official CUET homepage;
  the earlier June 21 download is recorded as superseded. None are authenticated complete
  paper anchors or permission to reuse. Source registry/calibration intentionally remain empty.
- New factory: Luna medium authoring, shared blind Luna high academic/numerical/boundary/
  exam checks, one Gemini medium independent evaluation, Luna medium explanation audit.
  Originals skip stem authoring; adapters require source-backed syllabus/patterns, distinct
  adaptations, complete passage groups, signed version-bound receipts and one persisted
  repair followed by full revalidation. Default paid Haiku/Sonnet/Sol routes retired.
- Native Responses/Gemini and asynchronous batch transports reserve before dispatch,
  count reasoning/tools/failures/retries, persist accepted IDs and reconcile uncertain
  usage without resubmission. One leased local worker is permanently bound to its persistent
  ledger identity. Lifetime content ceiling remains $50; historical spending is unreconciled,
  so the fresh ledger's recorded zero does not establish $50 available. Student $25/IST-month
  budget, atomic credits and entitlements retained.
- Protected admin dashboard shows coverage, staged/published counts, disputes/quarantine,
  actual spend/forecast and 200→1,000→10,000 controls. Publication stays paused on missing
  evidence or forecast shortfall; no approve-anyway control. Ordinary selectors put eligible
  factory evidence before prior verified evidence, then current screened/undisputed legacy.
  NTA/recovery remain evidence-gated; failed evidence-managed items cannot fall back.
  Mistake Repair disputes bind the reviewed content version and propagate holds.
- Verification: **186 distinct tests passed** (23 factory, 35 recovery, six answer-integrity,
  38 selector/NTA/payment, 84 learning/student-AI/wallet), targeted eslint and Next 16.2.4
  production build passed. Migration executes in isolated PGlite, with atomic passage rollback,
  stale screening rejection, permanent worker binding and service-only access checks.
  Desktop/mobile preview and chapter disclosure passed with no horizontal overflow at
  1440/390 widths; temporary viewport reset. Unauthenticated admin API GET/POST return 401,
  admin page redirects to login. Saved receipts: `artifacts/question-factory/verification.json`,
  `migration-dry-run.json`, test/build/lint logs and screenshots.

Remaining release gates: complete authenticated papers/keys/excerpts and reuse permission;
2027 syllabus revalidation when available; historical spend reconciliation; signing/author
setup; current prices; officially keyed disjoint calibration and live guarded provider proof;
actual 200-candidate pilot and cost/acceptance/Gemini-catch measurements. Migration
`20261005185759_question_factory.sql` is **unapplied**. PGlite is not Supabase staging proof;
capture authenticated staging import/repair/publication evidence before requesting production
migration approval under AGENTS.md. Stage legacy screening receipts before deploying stricter
fallback so ordinary practice does not become empty. Jev receives no integration or budget.

### 6 October 2026 — first pilot commissioning

- Owner requested 50–100 candidates; the pilot now defaults to **100, 25 per subject**,
  retaining complete passage groups and the same evidence gates. Saved, unapplied migration
  adds a balanced pilot target; local SQL dry run checks default 100 and rejects target 101.
- Local evidence signing secret and the existing content author are configured in ignored
  local environment only. No secrets printed/committed, production environment unchanged.
- Read-only provider preflight: Luna model and OpenAI batch listing both **200**;
  Gemini model and native batch listing both **400, invalid API key**. Worker/foundation
  dispatch checks this before paid work. Native Gemini transport handles raw REST nested
  inline output and both state enum forms; missing request identity remains unresolved.
- Dashboard now reports measured spending/tokens by stage, including reasoning in output,
  separately from open reservation holds. No generated, queued or published pilot questions;
  new generation requests/spend remain **0 / $0**. Historical spend remains unreconciled.
- Acquired official 2023 key (1,761 pages) and inspected a 39-page image-only English/General
  Test mirror. Neither of two visually sampled question IDs matches the full extracted key;
  mirror is not registered. Incomplete reconstructed 2025 PDFs were excluded. No reuse
  permission or complete four-subject source pack has been established; calibration paused.
- Current connected database schema inspected through read-only REST metadata; factory
  control table absent. No staging project has been supplied. No schema/data write, migration
  or deployment occurred. Production migration still requires staging evidence and owner
  approval under this repository's AGENTS.md, after concrete staging/dry-run results exist.
- Current change verification: **105 tests passed** (26 factory, 35 recovery, 44 question/
  selector/NTA/payment), targeted eslint clean, Next production build passed. Mobile/desktop
  preview shows target 100 with no horizontal overflow; viewport reset. These are software
  checks, not academic or live provider proof. See `artifacts/question-factory/commissioning.json`,
  supporting logs/screenshots, refreshed migration hash and provider/source reports.

Remaining commissioning gates: replace invalid Gemini key; establish historical content
spend; authenticated permitted sources; officially keyed development/held-out calibration;
staging migration and authenticated operation checks. Then dispatch the 100-candidate pilot,
measure actual usage, acceptance, independent catches and cost, and evaluate checkpoint
release. No claim of 10/10 academic quality or completed pilot is justified yet.

Owner follow-up during commissioning: local Gemini key updated; repeated read-only model
lookup and native batch listing now both **200**, with `batchGenerateContent` advertised.
The credential blocker is cleared; actual submission/completion remains untested. Owner
states paper reuse permission/access and asks to proceed without a document. Recorded as
an owner attestation (not independently verified licence proof), without relaxing paper/
key/extraction authentication. Historical spend remains unanswered; source authentication,
academic calibration and database staging/migration evidence remain outstanding. The owner
has no separate staging project. No production migration has been executed implicitly.


### 6 October 2026 — usage-limit resume and held-out model comparison

- Continued the existing dirty checkout. Audited 21 factory commissioning files plus related
  evidence, budget, selector and admin contracts. Git has 50 tracked changes and additional
  new files; this is not a clean 21-file repository diff. Owner changes were preserved.
  Audit hashes: artifacts/question-factory/resume-file-audit.json.
- The interrupted run had accepted 32 held-out Gemini batches per Flash-Lite model.
  Accepted IDs and holds survived, with no unresolved charge or recorded API quota failure.
  Reconciliation reused those jobs. Initial resumed network checks failed inside the sandbox;
  authorized guarded provider reconciliation succeeded outside it. No batch was resubmitted
  merely because the desktop session/usage ended.
- Restored Economics Q28–32's 918-character biocomposting passage from both complete
  saved publisher copies and inspected the rendered PDF page. All 200 ordered paper/key
  identities pass the audit. Four packs retain 173 authenticated canonical anchors;
  28 calibration anchors remain reserved. Generation reference coverage is now 19
  nonreserved anchors (English9, Accountancy4, BusinessStudies3, Economics3), not
  proof of 800 diverse accepted questions. Source registry version15 is active locally.
- The 21 keyed held-out items gave 21/21 correct answers for all three Gemini models.
  Flash3.8 accepted21/21 valid items and no tested defects. Flash-Lite3.1 accepted19/21
  valid items after exact-reference checks, accepted the orphan-passage fixture, and had
  two incomplete negative responses. Flash-Lite3.5 accepted21/21 valid items but accepted
  missing assumptions, an invalid numerical boundary and the orphan-passage fixture.
  False-citation hashes were rejected locally before dispatch. Explanation faults cannot
  be assessed by a blind evaluator that does not receive the author explanation.
  Default remains Gemini3.8Flash MEDIUM; no cheaper model promotion.
- Measured 32-request evaluation cost: Flash3.8 $0.085462; Flash-Lite3.1 $0.049104;
  Flash-Lite3.5 $0.050195. These are token-priced gross costs, not cost per published
  question or confirmed credit deductions. Full detailed model evidence: gemini-benchmark.json.
- Numerical questions inside passage groups now retain Luna numerical/boundary stages
  and Gemini numerical/boundary requirements. Requirements are bound to authenticated
  anchor metadata and signed evidence; changing question-type metadata invalidates checks.
  Future paper exports exclude a following group's stimulus from the preceding question
  excerpt. The frozen current comparison is retained rather than tuned into a passing score.
- Full academic calibration is PAUSED: four valid items currently fail source/passage
  evidence checks despite correct blind keys (EnglishQ11, AccountancyQ44/Q45, EconomicsQ37).
  25 accepted explanation checks remain pending. Eleven known-bad fixtures have already
  quarantined; the explanation-negative fixture awaits its audit. The known valid failures
  prevent the95% acceptance gate even if all remaining items pass. No pilot enqueue,
  authoring or publication: target800, actual0generated/0published.
- Gross settled content usage $0.319079; pending holds $0.038225; available after holds
  $49.642696 of the $50 lifetime ceiling at this receipt. Historical spend is the owner's
  best-known $0 estimate, not invoice-audited. Google credits are not counted as zero-cost
  usage until actual billing deductions confirm their application. StudentAI remains
  separately guarded at $25/ISTmonth.
- Verification:114 tests PASS (35factory,35recovery,44question/selector/NTA/payment),
  targeted eslint PASS, current Next production build PASS. Existing unrelated ProductScreens
  width/height warnings and a blank line at EOF remain preserved. The migration still passes
  isolated PGlite checks and remains unapplied. Fresh browser automation could not initialize
  its kernel assets on resume; earlier1440/390 screenshots are retained as prior proof.
  Results: artifacts/question-factory/resume-results.json and linked logs.

Remaining gates: reconcile pending explanation jobs without duplicate submissions; investigate
source/passage and citation-output failures through development examples and a fresh held-out
evaluation; require academic release before pilot generation. Frozen-set answer agreement
does not prove universal accuracy. No staging project or authenticated staging publication
evidence exists. No production migration, bank write, deploy or publication was performed;
these still require concrete staging evidence and explicit production approval under AGENTS.md.

### Final accepted-batch reconciliation, 6 Oct 2026 11:36 IST

Twenty-two of the 25 Luna explanation audits completed on their original accepted IDs.
Three remain pending (two development, one held-out). Current held-out pipeline results:
one eligible valid item, 19 valid rejections, one valid pending; all 12 controlled
negative fixtures are quarantined. Correct blind keys do not bypass evidence failures.
The completed audits identify official-key claims and publisher attributions missing
from the audit input as a recurring reason for rejection. Supply authenticated
provenance after blind solving and evaluate the revised contract on fresh held-out
material; retain this frozen result. No new pilot questions were generated.

Final saved ledger: $0.326466 gross settled, $0.004587 held, $49.668947 available after
holds under the $50 ceiling; zero unresolved usage. Promotional billing deductions
remain unverified. Final targeted lint and production build passed. The 114 distinct
factory/recovery/question/NTA/payment tests remain passing. Updated results, hashes and
runbook are saved. Full academic release, the three outstanding batch receipts and
staging/production migration evidence remain open.

### Completed 100-question commissioning, 6 Oct 2026

Current authoritative receipt: artifacts/question-factory/commissioning100-report.json.
The earlier paused/zero-generation entries above are historical observations, not the current state.

- Generated 100 actual question drafts, 25 per subject: 48 eligible, 52 quarantined,
  zero published. English 5/25 pass; Accountancy 15/25; Business Studies 11/25;
  Economics 17/25. All 100 have stems, four options and explanations; malformed
  keys/routes remain quarantined. Passing inventory contains 19 authenticated originals
  and 29 adaptations; nine numerical questions and one complete five-child passage
  group pass. Difficulty coverage in this run is easy/medium only.
- Fixed source-extraction contamination, quoted passage literals rejected by strict
  schemas, oversized explanation-audit context, and unsupported original explanations.
  Immutable source passages are attached locally. Explanation audits retain sources,
  source metadata, official anchor-key scope and blind reasoning. Original explanations
  receive one repair without editing the official question/options/key. All repairs
  require full content-version validation. No deterministic numerical receipt is fabricated.
- Source registry39 and verifier luna-gemini-cuET-v3.1 are current. Final held-out
  results: both blind evaluators 16/16 official keys; 16/16 valid items eligible;
  all 12 controlled negative fixtures quarantined. Development25 and held-out16
  valid items reserve distinct authenticated item/stimulus families. Previous failed
  cohorts remain archived; four fresh Business Studies items replaced a failed
  cohort after development fixes. This small, partly reused benchmark does not
  establish universal accuracy or independent validation on a new paper population.
- Standard direct commissioning cost $0.769063; token-reported portion $0.765205,
  plus $0.003858 conservatively debited for an HTTP400 whose original body was lost.
  Later typed schema rejections retain diagnostics and zero pre-inference usage;
  uncertain failures retain holds. Repairs, failures and rejected candidates count.
  Old accepted batches were reconciled on their saved IDs, with no resubmission.
  Lifetime accounted spend $1.419007; held/unresolved usage zero; available $48.580993.
  Google promotional deductions remain unverified; student AI retains its separate cap.
- Observed-token batch equivalent $0.382712; approximately $79.73 for 10,000 eligible
  at the observed yield. Assuming current eligible drafts later publish, remaining
  funds project about 6,093 additional eligible questions and a $30.77 shortfall
  to the target, excluding new source work. Bulk scaling stays paused. No budget
  increase or validation reduction occurred.
- Fifty-one repair entitlements were used. Eighteen incomplete model responses
  remain rejected; future repairs now use a strict key/route schema and 6,000
  output-token headroom while existing receipts retain their original contract
  and single-repair limit. That future configuration has regression coverage,
  but was not retroactively counted as a successful paid rerun.
- 125 tests PASS:42 factory,35 recovery,26 question/payment/integrity,22 NTA.
  Targeted lint and production build PASS. Original21 commissioning files plus
  six related/new files have refreshed hashes and syntax checks. Owner edits
  remain preserved. Completed worker restart: zero new requests, zero extra cost.
  All48 eligible drafts pass signature, evidence, complete-group and publication
  row/hash dry-run checks. No production database writes occurred.
- Local dashboard: http://localhost:3010/preview/question-factory. HTTP200 and
  server-rendered final totals verified; preview controls are disabled. Fresh
  authenticated browser interactions and production admin controls are unverified.
  Full report, all100 questions CSV, eligible-only JSON, restart check and row
  dry-run are saved under artifacts/question-factory/commissioning100-*.

Remaining gates: broaden supported anchor/chapter coverage, improve repetitive
adaptation yield and verify difficult-item generation; demonstrate authenticated
staging worker/admin/atomic publication with the saved migration and dry-run rows;
then request production migration approval. No staging project, migration, bank
publication, deployment or claim of 100% accuracy is implied by this local run.

### Independent quality audit and paused uplift, 6 October 2026

Current status: artifacts/question-factory/quality-uplift/FINAL-STATUS.md and
final-status.json. The earlier 48 passing drafts and ~$79.73 forecast above are
historical automated results, superseded for quality/release decisions by this audit.

- Independently reviewed all 48 frozen content hashes using included subscription
  review. All intended keys matched; 30 have no blocking defect found, 17 need
  corrections, and one lacks source/syllabus entitlement. This is not a perfection
  guarantee or a publication receipt. Economics includes overlapping answers and
  an AND/OR definition defect; Accountancy includes omitted conditions, mapping
  errors and OCR/format leakage; English includes lost emphasis, raw HTML and
  unsupported changed vocabulary. The eleven Business Studies items have no
  blocking academic defect found, subject to recorded qualifications.
- Implemented cuet-llm-v3 / luna-gemini-cuET-v3.2: separate chapter/topic and
  presentation receipts, exact task checks, academic quotes excluding paper stems,
  explicit assumptions/plain-text authoring, per-adaptation chapter selection,
  one durable completion retry, and campaign-specific queues and reports.
  Incomplete paid responses and the single permitted retry both count toward
  the persistent budget. Prior accepted batches remain bound to saved IDs.
- Registered source registry42: 31 exact scoped NCERT excerpts and 25 directly
  observed primary dictionary definitions. Disabled unsupported Economics q9,
  q24 and q49 for generation; disabled literal originals with missing conditions
  while retaining supported adaptation opportunities. Reserved calibration
  families remain reserved. Original commissioning artifacts remain frozen.
- Live stricter regression: 11/16 previously labelled valid fixtures eligible;
  Luna15/16 intended keys (one abstention), Gemini16/16; all12 controlled negative
  fixtures quarantined. Five valid-fixture failures concern word-choice/economic
  ambiguity, exact chapter taxonomy and a dissolution explanation reversing
  debit/credit direction. This is a previously observed benchmark, not a fresh
  unseen-paper accuracy claim. Reclassification/repair must preserve this result.
- Additional independent-audit challenges: 15/18 quarantine; three still pass
  automated checks (other-instalment payment assumption, direct journal-entry
  source entitlement, and overgeneralisation of a no-saving circular-flow model).
  Academic release FAILS. Current calibration is paused; the shared release guard
  requires the audit-challenge gate as well as the keyed benchmark, so a later
  calibration run alone cannot bypass the audit misses. No new pilot questions
  or production publication were performed. Neither >70% yield nor $60/10,000
  is measured or established.
- Content ledger: $1.616247 accounted, $0 held, $48.383753 remaining under the
  unchanged $50 lifetime ceiling; zero unresolved usage. This resumed live
  validation cost $0.197240. Google promotional deductions remain unverified.
  The separate student-AI budget and paid entitlements remain intact.
- 129 tests PASS:45 factory,35 recovery,49 question/payment/NTA. Targeted lint and
  production build PASS. Factory SQL remains saved and locally checked in PGlite;
  no production migration ran. Local preview HTTP200 shows the audit, failed gate,
  historical pass labels and withheld old forecast. Controls remain disabled;
  authenticated staging/admin/publication and device interactions are unverified.

Remaining: resolve the five fixture failures and three audit misses without
weakening quality, rerun both release checks, then run the separate preregistered
100-candidate cohort and measure yield/variety/full costs. Broader source/chapter
and difficult-item coverage plus authenticated staging/atomic publication remain
required before production approval. This task is NOT complete or production-ready.


### Final question-factory reconciliation and implementation pass — 6 October 2026

Owner clarification: excellent PYQ-faithful Class XII questions remain the aim;
sound 7–8/10 questions are acceptable when only craft is weak. Correct/unique keys,
explicit decisive assumptions, source entailment, explanation, syllabus and readable
CUET format remain mandatory. No routine human review is added.

- Read the entire supplied Claude log and reconciled its saved quality-v5 cohort
  against the persistent SQLite ledger. Contrary to the handoff's claim, the latest
  v5.3/$5.73 cohort had not been added to this main STATUS file. Frozen logs remain.
- Planned100/generated96/historical automated passes58. Claude's included-review
  record rates41 strong and8 weak. Item57's unseen-list wording is a blocking
  defect, so unchanged review-supported drafts are41+7=48. Original matching item51
  now displays its two lists correctly:49 potential usable drafts, including that
  display restoration awaiting renewed evidence. Seven need correction and two
  duplicate ideas do not count. Guaranteed10/10 count is unknown; published0.
  These are cross-checked historical review opinions, not fresh academic receipts.
- Current ledger: $5.731810 settled gross,
  $0.013556 held, $44.254634 remaining under
  the unchanged $50 lifetime ceiling. Additional committed spending in this pass
  is $0.014042; no new authoring. Google credits,
  provider invoices and subscription-plan consumption are not reconciled.
- Saved token partitions exposed omitted cache read/write prices. Future guarded
  requests now price those separately and reserve at the maximum input rate.
  Original settlements stay preserved: the read-only historical recomputation
  shows about $0.019 net overcount, not a large hidden charge. Accepted legacy
  batches enrich missing cache rates only from verified matching base prices;
  missing/invalid prices or usage remain held. No ledger reset/refund is inferred.
- Current reviewed-yield forecast is about $235 real-time / $120 assuming every
  cost halves, for10,000. Both include prior spending but omit new preparation/
  validation/staging cost and remain estimates. The $50–60 target is unproven;
  even the 5,000–7,000 claim is unsupported at this denominator.
- v5.4 separates optional craft notes from blocking defects, permits sound scores
  7–8 and retains dual Luna high checks, independent Gemini3.8 medium, source and
  explanation safeguards. v5.3 calibration is paused and cannot release v5.4.
  No thresholds in CALIBRATION_RELEASE were loosened. Current fixtures are
  previously observed/tuned regression evidence, not an unseen benchmark.
- Shared browser-safe presentation checks now run during authoring, validation
  and evidence serving, including saved/repaired rows and three-entry matching.
  Lists restore only at display time; stored stems/options/keys/hashes remain.
  Subject-wide blueprint skill/task IDs and avoidance context suppress exact
  repeated skills across anchors; semantic paraphrases are not guaranteed caught.
- Campaigns now support native --batch execution and resumable pending jobs;
  pending passage siblings do not quarantine the whole group prematurely.
  Seven frozen items form a no-authoring/no-repair/no-publication batch probe.
  Three known faults fail before paid dispatch. One real native batch completed
  and recorded usage; four items still await complete stage sequences, using
  saved provider IDs. This is not full batch throughput or quality proof.
- The local preview now shows latest reviewed counts/current saved ledger totals
  instead of stale commissioning data. Explicit en-IN number formatting fixes
  a browser-found hydration mismatch. Receipt loading was separated from React
  rendering after the previous expanded component caused ESLint memory failure;
  full targeted lint subsequently passes.
- 141 tests PASS:62 factory,35 recovery,6 answer-integrity,22 NTA,16 question/
  payment. Targeted lint and production build PASS. Existing image dimension
  warnings remain. Real local preview interactions at1440px and375px show both
  list columns, four choices, preserved selection, no horizontal overflow and
  no hydration errors. Headless local emulation is not physical-device proof.

Evidence: artifacts/question-factory/final-pass/REPORT.md, reconciliation-report.json,
review-supported-drafts.json, cache-price-audit.json, batch-probe.json, verification.json
and browser-check.json/screenshots. All older campaigns and owner edits are preserved.

Remaining, in execution order: reconcile/finish the saved probe IDs; verify revised
mandatory-negative regression and freeze genuinely unobserved keyed material; add
English comprehension/verbal anchors and the missing syllabus chapter sources;
measure a separately preregistered balanced batch cohort including every cost and
rejection; stage the saved SQL migration and inspect signed-in admin/worker restart/
atomic publication/dispute behavior; save staging/dry-run evidence before requesting
production migration approval. No staging project was created or migration applied,
no production bank writes/publication/deployment occurred, and paid entitlements,
atomic credits and the separate $25/IST-month student-AI cap remain intact.

This final pass improves implementation and measurement; it does NOT establish
end-to-end readiness, syllabus completeness, error-free content or10,000/$50–60.
