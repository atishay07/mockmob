# Local option-resolution structural proposal

This is an isolated regression proposal. It is not imported by the frozen V77 resolver, verifier, registration, or publication routes. Its only accepted route is `local_regression_proposal`, and every result reports `publication_eligible: false` and `dispatch_eligible: false`.

The proposal keeps exact selected-source identity and complete option coverage. It binds premises to an exact excerpt, exact stem phrase, or exact printed option phrase. Printed option phrases can serve only as hypothetical arithmetic inputs; an independent semantic audit must still verify the complete assertion and every printed claim. The proposal removes the requirement that `decisive_context` repeat a premise verbatim, while retaining exact premise binding and a separately bound independent audit of all four options.

For PDF line wrapping, excerpt matching collapses whitespace only. It preserves all non-whitespace characters, word order, punctuation, numbers, and negation. It does not accept ellipses, omitted words, paraphrases, or changed values. Exact original source quote and locator remain attached to every selected evidence item.

## Bounded observed cases

Five terminal dual-judged controls were reviewed. Both providers agreed on each key and returned `source_support: true`:

| Case | Agreed key | Observed distinction |
| --- | --- | --- |
| `v77f-ad344a8b5f2d` | A | OpenAI's arithmetic premise uses the printed two-month option as an input; Gemini has an exact source premise but generic context. Source silence about B's redemption date stays unresolved. |
| `v77f-2105354e5de1` | B | Exact stem facts and source examples are combined; context paraphrase is separate from premise binding. Whether the old machine is a fixed asset still needs independent semantic judgment. |
| `v77f-662880a2c5fb` | B | Exact source premise, paraphrased decisive context. This is the clean context-echo regression. |
| `v77f-073bdc31e03c` | B | Gemini's premise paraphrases the investing-heading/source relationship. The authentic source span does not make that premise an exact quote, so it remains rejected. |
| `v77f-3546cbf8ea19` | A | OpenAI/Luna retains the source word sequence with PDF line-wrap whitespace removed; Gemini uses an ellipsis and omits words. Only the former binds after whitespace-only normalization. |

The sixth case, `v77f-c6d21440345d`, was `guard_blocked` in the captured snapshot and is excluded from judged-case findings; it is not recorded as rejected. The study denominator remains 41.

## Local tests

Six Node tests pass. They cover opt-in/publication isolation, a fully bound arithmetic proposal with independent audit, source silence as unresolved, forged evidence spans, incomplete option coverage, changed numbers, omitted words, changed negation, real matrices from the five bounded cases, whitespace-only line-wrap binding, and audit hash mismatches. The test suite makes no model or network calls.

Run with:

```powershell
node --test artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/regression-proposal/optionResolutionStructuralProposal.test.mjs
```

The exact packet, case-result digests, current resolver digest, proposal/test digests, contract binding, and full findings are recorded in [proposal-review.json](proposal-review.json).

This remains a local regression proposal only. It does not change V77 qualification behavior, establish academic truth by itself, or constitute release/publication evidence.
