# Explanation custody brief (independent reviewer; runs only AFTER blind derivations are frozen)

Input: `C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v712-fresh/explain/accountancy-explain-input.json` — items with the printed stem/passage/options, the PROPOSED key and explanation, the cited verbatim source excerpts,
and an independent blind reviewer's frozen key and source-only explanation. Write JSON to `C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v712-fresh/explain/accountancy-explain-output.json`. Read no other files.

For EACH item judge only from the printed material and the excerpts:
1. `key_agrees`: does the proposed key equal the single defensible answer? (true/false; say why if false)
2. `claims`: split the proposed explanation into its factual claims (including every claim about why a distractor is wrong). For each,
   label `stated` (printed in stem/passage/excerpt), `entailed` (follows necessarily from printed words or exact arithmetic),
   or `unsupported` (adds a fact/status/rule, broadens or changes scope — e.g. "offered" is not "moved" — or contradicts the material).
3. `explanation_supported`: true only if every claim is stated or entailed.
Be exact and fair: a correct paraphrase or a necessary deduction is fine; do not flag style. Output
`{"items":[{"local_id":"...","key_agrees":true,"claims":[{"claim":"...","label":"stated|entailed|unsupported","why":"..."}],"explanation_supported":true}]}`.
Reply with a 3-line summary only.
