# Repeated ordering ideas: inspection rule and read-only diagnostic

Prepared 9 October 2026. No paid call, campaign, publication, staging write or production change. Frozen campaign files are unchanged (C all-candidates `4b06df8a…`, batch-report `a7349592…` re-verified).

## Why this was chosen

The 8 October quality-only assessment confirmed one semantic duplicate in C: the Noor-bookmark para jumble, `0fc6254f…` / `415691cf…`. It shows a gap in the deterministic idea inspection (`evidence-content-idea-inspection-v3`). That inspection caught exact text, repeated passage facts and same-concept near-identical stems. It did not catch a relabelled, reworded ordering of the same steps that carried a different concept ID. Answer cueing and inflated "hard" labels are real too. Fixing them means changing the author or judge prompts or rubric, which needs a new verifier version and a fresh paid benchmark, and paid work is on hold. The duplicate gap could be closed locally and deterministically without weakening any gate.

## Change

`scripts/pipeline/lib/batchInspection.mjs` now uses contract `evidence-content-idea-inspection-v4`. Two ordering items in the same subject, chapter and format count as one idea when both of these hold:

- At least three of their four steps match one-to-one. Steps match when they share at least 50% of their content words and contain identical quantities.
- The matched steps appear in the same keyed order.

Matching keys such as `(A)-(III), (B)-(II)` never count as an ordering. A shared source or shared vocabulary alone never makes a duplicate. The later item is withheld as `duplicate_idea_conservative` with `rule: repeated_ordering_task`. Inspections saved under v3 no longer satisfy the publisher's contract check. Before any future publication they must be re-run, which is free, local and deterministic.

## Diagnostic: `ORDERING-IDEA-DUPLICATES-2026-10-09.json`

Scope: eligible items from A (66), B (70) and C (84), plus the 76 pure letter-sequence ordering items in the reassessed legacy bank (53 eligible and 23 quarantined under unreleased v7.2). All 76 of those bank items are still served in production.

- **Within each campaign:** only C's bookmark pair is flagged. A and B have none.
- **Across campaigns and the bank:** 10 groups contain 34 items, which is 24 surplus repeats. Nine groups are English Para Jumbles built on the same small set of original stories (Noor, Ravi, Tara, Aman, Jaya, the rehearsal, chairs and the title vote). The tenth is a Business Studies functional-structure causal chain that bank `27e508fe…` and C `21becfa4…` share.
- **C:** 5 of its 11 eligible ordering items repeat an earlier idea. They are `0fc6254f`, `415691cf`, `21becfa4`, `044040f0` and `e0369e7b`.
- **B and A:** B has 3 such items and A has 2.
- **Spot check:** I read the Organising pair and the title-vote pair; both are true duplicates. A first, looser draft also flagged two Accountancy matching pairs and two numerically different procedures. Those were false positives, so the matching-key and equal-quantity guards were added and covered by tests.

The likely root cause is in `briefDiversity.mjs`: Para Jumbles draws on only 8 registered original stimuli, ranked least-used first. Once every stimulus has been used, it reuses them, and each reuse can only produce the same ordering task.

A separate observation, not acted on: 5 of the 29 eligible ordering items in A, B and C are keyed in printed order (A-B-C-D). They are B `a16a9de0` and `9f9ab836`, and C `21becfa4`, `e836aa57` and `acb298a3`. Combined with cohesion cues ("That grouping…", "This emphasis…"), this lets a student solve the item without subject knowledge.

## Limits

The rule was written from the confirmed C pair, so detecting it in C is not independent evidence. The other flagged groups were read only partly. This report reclassifies no frozen outcome, bank item or publication. The rule is conservative: rephrased ideas that share fewer than three steps, or that use different quantities, still pass.
