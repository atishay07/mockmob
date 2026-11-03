# First terminal V77 case diagnosis

**Case:** v77f-ad344a8b5f2d — accountancy, Cash Flow Statement. The registered case is marked quarantined at source_support.

## Finding

I independently derived **A** from the supplied stem and source excerpts before checking proposed keys. Both native blind judges also returned A, marked it singly defensible, and marked source support true. Custody checked afterward also records A. This is not a transport failure or an academic wrong-key rejection. The local source-support gate fails because the option-resolution matrices do not satisfy the validator’s exact premise/context rules.

The decisive source excerpt says cash equivalents are readily convertible into known amounts of cash with insignificant value risk, and that they normally have a short maturity “of say, three months or less from the date of acquisition.” A’s two-month maturity and stated liquidity/risk characteristics fit that rule. The syllabus excerpt supports the accountancy objective but is not answer evidence. The source citation hashes and captured supporting spans are valid.

## Actual validator failures

- **OpenAI:** resolution_arithmetic_premises_required:A. The two-month value comes from the exact option text, and the threshold comes from cited E1.1. The validator only accepts arithmetic premises found in the question body or cited excerpts; the question body excludes options. Its additional decisive-context check requires a premise verbatim, while the context paraphrases the rule.
- **Gemini:** resolution_excerpt_premise_invalid:A. Its selected citation contains the cited maturity premise, but the generic decisive context does not repeat any premise verbatim.

Later matrix rows exhibit the same patterns: OpenAI uses option text as the numeric input for C and D, and its B excerpt premise is not in the cited text. Gemini’s B/C/D contexts also do not repeat their premises. These are representation/gate problems after the independently correct A solution; they are distinct from a factual source citation error.

## Remaining academic caveat

B is rejected using “no stated redemption date,” but the excerpt provided to the validators does not explicitly exclude equity shares. That absence means the option has not shown the required maturity; it should not be described as a source contradiction without a direct supporting statement. D’s four-month maturity is beyond the usual three-month example, but the source’s “normally” and “of say” wording is illustrative. The stem points to applying the stated test, yet the four-month distractor remains closer to the wording’s boundary than a clearly long maturity. Neither caveat caused this terminal quarantine.

For future unregistered regression tests, cover arithmetic using the selected option as input, exact premise anchoring in decisive context, and source-silence handling. For new item authoring, use directly evidenced distractor failures and avoid near-boundary options when the source states a normal or illustrative cutoff. No frozen files, registry, results, code, dispatch, or recovery state was changed.

## Bindings

- Results file SHA-256: cac37204b1ca696c598ba0405fae7554ec290ae0014aea939aa3b047ea090c9b
- Case record SHA-256: 5601eed500bb8ca02d74b0d53494a8427c21e05e1fd99058788a32db0b2845f5
- Case content hash: 09302eeddc917d36b8ffcc53897bef83d802368a39df471ae4146e007f3fa47f
- Contract digest: c884baa1137bc1aa24b524e861155f485dc52b305496dd2fbf2f4e46ade425e5 (validation contract 614d423f795314c7661e952ca1f1bf41258b005586744172dd8ec3b32021ecd1)
- Option-resolution validator SHA-256: 50bf87bb1fa981699f375ce247d778b53af144d410179d91a6a70b1a04452332

Full native matrices and predicate detail are preserved in the companion JSON artifact.
