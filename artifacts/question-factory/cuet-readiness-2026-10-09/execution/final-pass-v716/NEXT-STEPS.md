# V716 continuation — exact state and commands (10 October 2026 IST)

State: V716 is frozen (`V716-FINAL-EXECUTION-FREEZE.json`, sha d807498d…138e). It **failed** its one fresh qualification (`qualification-fresh32b`; see `V716-QUALIFICATION-RESULT-20261010.md`). It is not released, not wired into student APIs, and has no pilot. Ledger: USD 10.100569 remains under USD 50; 65 historic holds (USD 0.821324); no active rows.

Ready but deliberately not run (each needs a qualified profile first):
- 40-job pilot: `python -X utf8 artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v716/tools/build_pilot40.py <freeze> <dir>` (the builder is also described in STATUS), then
  `node scripts/pipeline/tools/runPilotV716.mjs prepare <dir>` and `node --use-system-ca scripts/pipeline/tools/runPilotV716.mjs execute <dir> --approved` (cap USD 3, waves of 10, stop after two consecutive waves under 40%).
- Local publication proof on qualified outputs: `node scripts/pipeline/tools/proveLocalPublicationV716.mjs <campaign-dir> <release-manifest> <out-dir>`.
- Staging/production: `PROPOSED-MIGRATION-v716-publication-units.sql`, a proposal only. Needs owner approval and a staging project; none is configured here.

Operational rules learned this pass:
- Never edit any file in the freeze closure while a paid run is active. The session pins the contract and the runner re-checks the freeze before every wave, so drift now pauses instead of re-keying.
- Launch paid runners with `node --use-system-ca` (trusted Windows CA gate).
- Receipt-only recovery and exact-zero cancellation of never-sent queued rows: `node --use-system-ca scripts/pipeline/tools/recoverReceiptsV716.mjs <campaign-id> [--cancel-unsent]`.
- Valid-control explanations must make only excerpt-entailed claims. The V716 audit is stricter than a Haiku custody audit, so check explanations claim by claim when building a benchmark.

Owner decision needed: whether to authorise a minimal V7.17 (answer-status semantics for NOT/EXCEPT stems; self-contradictory reports labelled review_incomplete; exemplar-anchored difficulty), a new excerpt-strict fresh benchmark, and one more bounded qualification (about USD 0.2 actual; USD 1 STOP cap).
