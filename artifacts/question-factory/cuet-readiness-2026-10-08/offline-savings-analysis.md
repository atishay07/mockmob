# Offline savings analysis: already-failed A items

Scope is limited to the six rejected candidates in frozen comparison A. No held-out fixtures were read, no model was called, and no question, key, source, evidence, assumption, or academic gate was changed. This identifies possible deterministic prevention of avoidable presentation/structure failures; it does not establish that any item is CUET-ready.

## Observed failures and costs

| Candidate | Failure | Requests / observed cost | Finding |
|---|---|---:|---|
| `be766fde7b94898b8a08176e26b8e698` | `option_label_prefix` | 1 / $0.001506 | Business Studies statement-selection options use parenthesized statement references, e.g. “(A) only”. Generic prefix lint treats this as an option label. |
| `23aad86aa8b8d827643ad917fe717cba` | `syllabus_mapping` (final; source/ambiguity concern preceded repair) | 4 / $0.004408 | English matching item still exceeded the recorded reading-load limit after repair (184 words vs 132). Not a formatting-only defect. |
| `6a36cd09ebd9dd30606310b808c0bc18` | `option_label_prefix` | 1 / $0.001557 | Accountancy statement-selection has an outer choice label plus inner statement letters; generic stripping leaves meaningful `(A) only` text flagged. |
| `6a83819c35e721b7bd45b902158dcefc` | `source_support` | 7 / $0.012332 | Economics national-income item failed support checks before and after repair. No meaning-preserving text transform identified. |
| `0ebfd4f94f7e63de4b2a4bbf82f2a700` | `orphan_passage` | 6 / $0.011301 | Repair selected route `passage` but left passage text empty; the local structural gate can detect this before another model evaluation. |
| `efe588a9ccafba0c25aef183f47bc628` | `repair_abstained` | 6 / $0.007398 | English para-jumble repair abstained on an ambiguity about event order. Do not infer or rewrite chronology. |

Together these six already-failed items account for **25 recorded request rows and $0.038502 observed spend**: authoring 9 requests / $0.013077; evaluation transport stage `blind_solution` 11 / $0.021732; repair 5 / $0.003693. The receipts tag evaluation calls as `blind_solution` even where the logical check was source support or syllabus mapping, so that stage label is transport-level, not a precise defect taxonomy. Zero-usage rows are included in request counts; dollars are receipt totals. These are observed costs only, not a forecast or per-item future savings estimate.

Across the 25 rows, recorded input/output usage totals 85,656 / 104,402 tokens. Referenced source excerpts total 15,598 text bytes across 13 refs. The two source-heavy failures account for substantial payloads: `be766...` has 4,119 excerpt bytes / 637 words; `6a36...` has 4,288 bytes / 730 words. Large payload is descriptive evidence, not proof of unnecessary context; do not trim evidence without a separate validated rule.

Repeated requests occurred on three items: `23aad...` (author 1, evaluation 2, repair 1), `6a838...` (author 2, evaluation 4, repair 1), `0ebfd...` (author 2, evaluation 3, repair 1), and `efe588...` (author 2, evaluation 2, repair 2). `6a838...` and `0ebfd...` each have authoring output records at the 6,500-token ceiling, consistent with a possible completion retry but the receipts do not retain stop reasons; treat this only as a diagnostic lead. No exact retry cause is proven by the saved receipt data.

## Candidate deterministic prevalidation changes

1. **Statement-selection presentation parser (test first).** For `statement_selection` only, parse every option against a strict full-string grammar for statement sets. If all four options parse and the set of referenced letters before/after is identical, rewrite the display to unambiguous text while preserving option order and all non-option fields. Examples from the failed items:

   - `be766...`: “(A) only” → “Statement A only”; “(B) and (C) only” → “Statements B and C only”.
   - `6a36...`: “(A) (B) and (D) only” → “Statements B and D only”; “(C) (A) only” → “Statement A only”.

   Require parser round-trip assertions for the exact statement-letter sets, plus tests that answer key, stem, explanation, assumptions, and source/evidence fields are byte-for-byte unchanged. Do not apply a generic leading-label strip: it can remove meaning. Do not change presentation or academic acceptance thresholds. This can only remove a specific lint false positive and let the normal CUET validation proceed; it cannot make the question academically pass.

2. **Prevent orphan route repairs.** In standalone repair where no passage text is available, constrain route repair so it cannot switch to `passage`, or reject/quarantine that route locally before scheduling another model evaluation. Do not synthesize passage content. `0ebfd...` demonstrates the failure shape, but any change should be tested against current contracts before use.

3. **Keep the remaining failures quarantined.** Syllabus/reading-load, source-support, and ambiguity/abstention defects have no identified deterministic correction that preserves meaning and evidence. Any retry policy or content change needs a separately preregistered comparison, not an assumption of savings.

No code or ledger was changed. Recommendations are for root review after frozen B completes and before any preregistered C implementation or paid validation.
