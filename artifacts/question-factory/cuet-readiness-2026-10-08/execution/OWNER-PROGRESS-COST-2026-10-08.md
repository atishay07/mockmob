# Owner progress and cost report — 8 October 2026

Snapshot: 11:57:27 UTC / 17:27:27 IST. A read-only SQLite transaction recorded $32.813934 settled plus $0.501512 conservative holds = $33.315446 committed, leaving $16.684554 under the unchanged $50 lifetime content ceiling. These are ledger values, not confirmed provider invoices. Holds are spending commitments; they are not discarded as zero.

| Registered campaign | Terminal candidates | Eligible after recorded inspection | Gross cost, including holds | Gross cost per eligible item |
| --- | ---: | ---: | ---: | ---: |
| A, baseline | 100/100 | 66 | $1.227996 | $0.018606 |
| B, improved | 100/100 | 70 | $1.341445 | $0.019164 |
| C, native-batch/source comparison, 11:54 UTC | 39/100 | 31; 8 rejected, 61 pending | $0.372337 in-flight | Not a final yield or forecast |

A and B retain every candidate and have final candidate dispositions, but their remaining receipt holds prevent calling gross costs settled or provider processing completely resolved. The current release has not approved these campaign exports for publication. C remains live; accepted IDs are not resubmitted.

The A/B forecast of $186.06–$191.63 for 10,000 eligible questions is a conditional marginal projection, not money already spent. It includes campaign holds, excludes prior development/calibration expenditure, and assumes unchanged mix and yield. The improved arm produced more eligible questions but has a worse cost per eligible item. No demonstrated cost improvement is claimed.

B stage costs: authoring $0.159465; Gemini independent evaluation $0.814995 (60.75% of gross); Luna blind solve $0.321344; explanation audit $0.028165; direct repair $0.017476. Revalidation can also occur in other stage buckets. Logged request counts include failures and zero-usage records; they are not all successful paid responses. Generation is already relatively inexpensive; independent evaluation and reasoning dominate the measured total.

At 50% yield, a $1–$2 campaign of 100 candidates costs $200–$400 per 10,000 eligible items. A $70 marginal target at 50% yield would require $0.35 per 100 candidates. Lower yield is acceptable; it increases unit cost rather than justifying weaker correctness gates.

The 85% rule is the registered benchmark's retention of independently designated valid controls, not a quota for approving generated candidates. Invalid controls must still be rejected. The current registered study will be reported under its frozen policy without retroactive changes. Owner clarification makes gross cost per verified usable question the optimization target; mandatory correctness and CUET-entitlement gates are unchanged.

Approximately 60–65% of end-to-end delivery is complete, as a judgment rather than an objectively measured percentage. Coverage/source retrieval, guarded model stages, persistent receipts, legacy staging correction and local software checks exist. Current release qualification, full C completion, cost improvement and current-version production integration/publication are incomplete. The last signed-in staging retrieval had 535 retained legacy questions, including 519 with recorded fit scores 8–10; scores do not establish correctness or current v7.3 release eligibility. Newly published v7 questions: zero.

The fresh v7.3 study has 41 paid cases (22 designated positives and 19 independently reviewed academic defects), with a separate false-authentic-PYQ local proof retained outside the paid denominator. Its 11:57:24 UTC snapshot is $0.350959 settled plus $0.020224 held = $0.371183 gross, already included in lifetime spending. It is incomplete and has no release/publication. Source-key custody is frozen before official-key comparison. An immutable 40-case historical semantic regression proposal is ready, with strict original-provenance outcomes reported separately; it is not fresh reliability evidence and has not been dispatched.

Time was spent on source/key reconstruction and fresh-versus-regression custody, preserving unfinished historical contracts and requests, native provider waits, and repeated integration work. Too much execution time went into benchmark setup before a complete live optimization loop was established. Earlier rolling 3–4-hour release estimates were unsupported. C completed 39 candidates in about 3 hours 22 minutes; extrapolating only that observed pace suggests roughly another 5–7 hours, with provider delays potentially longer. This is not a release deadline. A defensible final release ETA requires the current reliability result and executable runtime integration to be complete.

Concrete work left: drain the current fresh/C provider requests; report all candidates, defects and gross costs; resolve validator-versus-source-explanation failures without tuning the frozen study; finish and test per-job current-verifier routing and atomic publication/student filtering; run current-contract staging checks; obtain final production approval only after reviewable evidence. Current worker discovery: the normal worker command follows the fixed legacy campaign path, while the database queue loop needs an explicit new route. Patch artifacts are in preparation, not applied or released.

Evidence: `saved-readiness-cost-comparison.json`; `../../cuet-readiness-cost-source-c-100-2026-10-08/batch-report.json`; `../benchmark/fresh-official-source-v73-model/run/summary.json`; `../benchmark/v73-regression-semantic-view-final-2026-10-08/strict-selector-correction-proof.json`. No provider dispatch, publication, manifest change, or production migration was performed to write this report.
