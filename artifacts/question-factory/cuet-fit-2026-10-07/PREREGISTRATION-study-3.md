# Preregistration — study 3: dual_blind with effort-policy-v1 on a fresh benchmark (written 8 Oct 2026 before any v3 item was evaluated)

Owner rules in force: no validator is removed; cost is reduced by effort, flex tier, waves and avoiding repairs.

## What changed since study 2 and why a new fresh set is needed
Study 2's benchmark and the regression suite were read while choosing the effort policy (Luna medium only for English word-meaning formats, high elsewhere; Gemini medium; explanation audit high) and the reading-load cap, so they are tuned-on. With this policy the dual topology passes the study-2 rule on them (0 fresh and 0 regression false accepts, valid survival 86.2%); that is NOT release evidence. Benchmark 3 is authored after the policy was fixed and is the only fresh evidence for it.

## Benchmark 3 (`cuetFitBenchmarkItemsV3.mjs`, frozen as `frozen-v3.json` before evaluation)
61 items: 14 authored valid; 47 controlled defects: wrong key 14, second defensible option 11, plausible embedded unsupported claim 9, conditional answer 3 (alternative reading yields another listed option, no textbook default supplies the condition), broken numerical 3, wrong explanation arithmetic 2, passage-unanswerable 1, out of syllabus 4. No item is contested by construction.

## Release rule (fixed now)
`dual_blind` with effort-policy-v1 is released only if: (1) 0 of the 47 v3 defects are approved; (2) 0 of the 12 regression-benchmark defects and 0 of the 16 audited correctness defects are approved (contract-level: e539e791…, 2681477c…); (3) valid survival ≥ 85% over v3 valid plus regression valid items (26), no subject below 70%; (4) prompt hash, verifier version and effort policy equal the code that will run. Nothing is relaxed. If it fails, the failure patterns are fixed and a NEW fresh set is authored; v3 then becomes regression evidence.

## Interpretation
Zero false accepts among 47 has a 95% upper bound of about 6.1%. The set is author-keyed and small; model agreement is not truth. A release is permission to run the monitored batches, not a claim of perfection; batches keep a random audit sample and a circuit breaker.
