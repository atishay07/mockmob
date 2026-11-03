# Current execution report — 8 October 2026

Ledger capture: 12:47:36 UTC / 18:17:36 IST. Read-only accounting gives **$33.341848 settled + $0.504364 conservative holds = $33.846212 committed**, with **$16.153788 remaining** under the $50 lifetime content guard. Provider invoices have not been obtained; holds are not treated as zero. This supersedes the earlier dated owner checkpoint without deleting it.

## Actual batch economics

| Campaign | Fixed denominator | Eligible after recorded inspection | Rejected | Pending | Settled | Held | Gross committed |
|---|---:|---:|---:|---:|---:|---:|---:|
| A, baseline | 100 | 66 | 34 | 0 | $1.216368 | $0.011628 | $1.227996 |
| B, improved | 100 | 70 | 30 | 0 | $1.177385 | $0.164060 | $1.341445 |
| C, native-batch/source comparison, 12:40:55 UTC | 100 | 44 | 9 | 47 | $0.454032 | $0.104110 | $0.558142 |

A/B have completed candidate dispositions and preserve all failures. Their open receipt holds prevent a fully settled/provider-complete claim. C is still executing, with 53 terminal candidates and five native provider requests pending. Its partial yield and cost are not a final forecast. Eligible exports are not a current release or a certified-accuracy count; campaign counts cannot be added to the legacy bank without current qualification and duplicate inspection.

The expected $1–$2 cost per 100 candidates is already met by A/B. Their conditional marginal costs for 10,000 eligible items are **$186.06 / $191.63**, not money spent. At unchanged costs, 50% approval yield gives $200–$400 per 10,000 eligible items. To achieve $70 marginal cost at 50% yield requires $0.35 per 100 candidates. Earlier lifetime development spending is additional.

B increased eligible yield from 66 to 70 but worsened cost per eligible item from $0.018606 to $0.019164. Generation is only $0.159465 per 100; Gemini independent evaluation is $0.814995, Luna blind solving $0.321344, explanation support $0.028165, and direct repair $0.017476. Reasoning, failed calls, holds and repair-related validation are included. The recent two campaigns together cost $2.569441 gross; lifetime spending also includes earlier generation, bank reassessment and benchmark work.

Native Gemini shows an observed cost signal: 42 settled evaluations average $0.004747 versus approximately $0.009 for realtime evaluation. The cohort/call mix differs and C is unfinished, so neither a causal saving nor a completed 10,000-item forecast is claimed. No target within $50–$70 is demonstrated yet.

## Reliability and the 85% rule

The fresh v7.3 study finished at 12:16:32 UTC with all 41 paid cases and receipts complete: 22 designated positive controls, 19 independently reviewed defect controls, 12 eligible positives and zero accepted defect controls. All three providers completed 41 judgments without missing outcomes. Total settled cost is **$0.800698**, already included in lifetime spending. Haiku comparison cost $0.104207; it remains comparison-only. No questions or release manifest were published.

The 85% policy is retention of designated valid benchmark controls, not a required approval rate for generated candidates. Lower generated yield is acceptable when gross cost per verified usable item meets the objective. Correctness and evidence gates remain mandatory; no frozen labels or thresholds were changed.

The failed positive-control retention is not wholly model false rejection. Two cases have contradictory assumption flags despite resolved typed conditions and a supported key. Other cases contain genuine missing source support or unsupported explanation claims, including page/column metadata leaking into a student explanation. These findings require better evidence/explanation construction and a versioned consistency correction, followed by new independent evidence. Previously inspected cases become regression data. Detailed case evidence is in `MEASURED-OPTIMIZATION-FINDINGS-2026-10-08.md`.

## Working implementation and application evidence

The implemented path is deterministic coverage gaps → concise cached authoritative excerpts and optional CUET style exemplars → GPT-6 Luna authoring → blind Luna/Gemini solving and CUET-fit checks → independent Luna explanation support → at most one targeted repair and full revalidation → current signed evidence → atomic publication → usable coverage. Authentic PYQ provenance remains stricter. Haiku is outside publication decisions.

Actual implementation now includes a current-version profile pinned to each new job; an explicit database queue command; a fixed campaign denominator up to 100; ten-candidate waves; campaign and lifetime guards; scoped native submission; restart-persistent repair state; complete passage-group publication; lease checks before mutations; and recovery after an atomic group publication succeeds but queue-state updates interrupt. Legacy jobs do not fall into the new route. Raw contract sources are traced into Next deployment output; the server hashes those original sources rather than a transformed bundle. Missing/corrupt bindings fail closed without taking down the admin dashboard.

Final application build passed. The final factory suite passed **548/548** after the bounded inventory-filter change, and focused queue/transport tests passed 17/17. Runtime integrity/current-release tests passed 10/10. Existing recovery 40/40 and question/payment/wallet 61/61 checks passed during this implementation. The full-suite final result is recorded in `current-profiled-worker-factory-tests.log`. The original strict 979-locator source check was retained.

The initial live queue read failed before dispatch. Narrowing the query to profile-key presence and pages of 100 fixes the actual staging read while still exposing malformed and unknown-version profiles to quarantine. The real explicit staging queue command then exited successfully with zero current-profile jobs and zero paid calls. That is entry-path evidence, not a live current-version generation/publication demonstration.

Authenticated student retrieval returned **535 retained legacy questions**, zero of the 127 withheld items, and preserved the $25/month student AI cap. Of the 535, 519 have recorded fit scores 8–10; these ratings are not a correctness guarantee or current release. New v7 publications remain **zero**. Signed admin/anonymous/student authorization checks passed; current release requests are refused with unchanged controls. Renewed real dashboard rendering at 1440×1000 and 390×844 passed refresh, expanded coverage, zero page errors and no horizontal overflow. The inventory and dated-cost labels were clarified. No production publication, deployment or migration occurred.

The original completed-study transport was archived with an exact match to its pinned SHA after the scoped-flush safeguard changed current transport. Historical registration/results were not rebound or resumed.

## Completion and timeline

End-to-end delivery is roughly **65% complete**, a judgment of remaining work rather than an accuracy percentage. The software and local staging integration are mostly built; the measured reliable, affordable current release is not qualified. Earlier rolling three-to-four-hour release promises were unsupported, and too much execution time went into benchmark/source custody and integration before a complete cost-optimization loop was established.

Work remaining: finish C's accepted requests and all 100 dispositions; correct validator consistency and evidence/explanation construction; measure a new frozen current-format check without tuning on it; establish improved gross cost per independently verified usable question; run the current approved batch through staging atomic publication/retrieval and inspection; then obtain the required final production approval. Retained conservative holds permit unrelated bounded work, but final relevant cost cannot be called settled without missing provider usage.

At C's observed pace, its 47 remaining candidates imply several more hours, with native provider waits potentially longer. There is no defensible fixed final-release ETA while reliability qualification is failing. For planning, allow another working day for correction and measurement, potentially a second day with provider waiting; a failed new check would extend this. This is an estimate, not a release promise. No automatic completion or perfection claim is made.

## Reproducible local checks

Run from the repository root with its existing local/staging credentials:

```powershell
npm.cmd run test:factory
npm.cmd run test:recovery
node --test data/tests/v73_runtime_contract.test.mjs data/tests/factory_current_validation.test.mjs scripts/pipeline/tests/factoryProfileV73.test.mjs
npm.cmd run build
node --use-system-ca scripts/pipeline/factory.mjs worker --queue --staging --once
node --use-system-ca scripts/pipeline/tools/verifyReassessmentStagingVNext.mjs
node --use-system-ca scripts/pipeline/tools/checkCuetReadinessDashboard.mjs
node scripts/pipeline/tools/writeCuetReadinessStatus.mjs
```

The staging browser/retrieval checks require the isolated staging app at port 3101. New-profile enqueue is intentionally unavailable until the exact measured release exists. Do not restart or resubmit the separately active C supervisor merely to refresh a report.
