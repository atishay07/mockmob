# V716 native diagnostics (10 October 2026 IST) — inspected regression cases only

Not qualification or release evidence. Both diagnostics used only already-inspected R3 regression fixtures and ran under the persistent USD50 guard with diagnostic caps (USD0.6 and USD0.4, both under the USD3 diagnostic cap). Publication: never.

## Diagnostic r1 (`diagnostic-native-r1`, 6 cases: 4 valid, 2 controlled defects)

Native output quality (18 real reports: 12 Luna blind, 6 Gemini batch):
- Every report parsed, carried the exact candidate identity and content hash, four option rows and valid statuses. No malformed output, unlike V713.
- Valid controls: both reviewers solved all four correctly with clean option statuses.
- Controlled wrong key `f-90b386844e029292`: both reviewers solved A against stated C, so the key gate catches it.
- V75 category-overlap regression `v75f-825e60a00f`: Luna (both runs) returned `solved_key: uncertain`, `answer_set: [B, D]`, B `unresolved`, issue `unresolved_rival`. This is a genuine detection of the intended B/D defect. Gemini picked D only; the stricter report blocks under local policy.

Defects found and fixed before any freeze (each has a regression test):
1. **Shared schema node (critical, pre-dispatch).** `scorecardSchemaV716` reused one `{type:'string'}` object for every text field. Setting the identity enums mutated it, so every derivation, reason and note was constrained to the content hash. The planned-body capture caught this offline, before any paid request. Schemas are now independent per call. The frozen V713 builder does not use this pattern, so R3 is not affected.
2. **Mid-run contract drift (root process error).** The V716 contract hash is derived live from source files. Root edited V716 files (reviewer fixes) while the run was active. Retry attempts therefore computed new request keys, re-sent 6 Luna blind solves and queued 5 new Gemini rows. Root stopped the run gracefully (`STOP_AFTER_REQUEST`). The 6 accepted Gemini batches were reconciled receipt-only. The 5 queued rows were provably never dispatched (state `queued`, no provider id; flush claims `dispatching` before any send), so they were cancelled under the worker lock and settled at exactly zero (`tools/recoverReceiptsV716.mjs`). Fixes: the session now pins `contract_hash`/`prompt_hash` before every operation and stops on drift, and the runner re-verifies the whole execution freeze before every wave. Root will not edit code during paid runs.
3. **Policy over-strictness that would have rejected sound items.** Luna returns `null` for novelty feedback when no calibration anchors are supplied; any null on a non-N/A criterion was treated as an academic failure. Reviewers also mark `decisive_assumptions`/`boundary_cases` `not_applicable` when they genuinely do not arise. Null feedback scores are now unscored feedback. An unscored craft parameter makes the review incomplete (error), not rejected. Source support, syllabus entitlement, completeness, format and presentation can never be waived.

Cost r1: USD0.038133 settled, 0 held, receipts complete (includes the 6 duplicate Luna solves caused by item 2).

## Diagnostic r2 (`diagnostic-native-r2`, 3 valid cases, full path including explanation audit)

- All three reached `eligible`, NTA band, composites 8.6 / 8.8 / 8.07, difficulty easy (both reviewers). No re-dispatch: 9 requests total.
- The explanation audit is substantive: per-claim statements with calculation/excerpt basis and source IDs. It raised low novelty (an item close to the NCERT wheat-and-bread example) as an advisory `craft_suggestion`, which stayed feedback and did not block.
- Cost r2: USD0.018903 settled, 0 held, receipts complete. That is about USD0.0063 per fully validated valid case (Luna Flex blind + Gemini batch + Luna Flex audit).

## Limits

These are 9 inspected cases. They show format compliance and plausible behaviour, not reliability. Qualification needs the fresh, independently keyed, preregistered study. Diagnostic per-case cost does not include authoring, rejects, repairs or retries at pilot scale.

## Authoring diagnostics (3 jobs adapted from the R2 pilot plan: one accountancy numerical, one English reading pair as an atomic group)

- r1 (superseded): the V716 author prompt had replaced the setter rules wholesale, losing the presentation/format contract the local author lint enforces. A sound accountancy draft (guarantee-deficiency, key correct) was rejected for `option_label_prefix` ("A." labels). A transient OpenAI Flex 429 then paused the run, because the session had not enabled the transport's existing Flex→standard fallback. The refusal was recorded as `flex_unavailable` at zero cost. The never-sent Gemini row was cancelled at zero. USD 0.002006.
- Fixes: a compact CUET format/presentation contract (no option labels; Match List/statement/assertion-reason/ordering conventions; plain text; no unseen references) restored in the V716 author prompt, with the brief's mechanics (exact evidence quotes, empty passage_text, answer position) preserved. Flex fallback enabled. Author outcomes recorded durably in the session (`author_rejected` stays in the denominator).
- r2 (final contract): 2/3 eligible (composite 8.4 each, both routed Easy). One reading item was quarantined because Luna held a weak rival ("drill again needs a cable") as unresolved. Gemini resolved it; the key was right. Under the union-of-doubts rule this is a conservative yield loss, not a correctness problem. USD 0.020125 for 3 jobs (≈USD 0.0067 per job all-in).
