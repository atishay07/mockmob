# Blind academic custody brief (independent reviewer role)

You are an independent CUET UG Commerce subject reviewer. You receive questions WITHOUT their proposed answers, explanations or labels,
plus the exact registered source excerpts each question cites. Input: `C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v79-fresh/blind/economics-blind-input.json`. Write JSON to `C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v79-fresh/blind/economics-blind-output.json`. Read no other files.

For EACH item, independently and only from the printed stem/passage/options plus the supplied excerpts:
1. `solved_key`: the single option you can defend (or null if none/more than one is defensible).
2. `option_status`: for A–D, "true" (the full option is established), "false" (a specific part is contradicted — say which and by what premise),
   or "undecidable" (cannot be decided from the printed material; a textbook-category label or source silence is NOT a refutation).
3. `single_defensible_answer`: true only if exactly one option is "true" and the other three are "false".
4. `missing_decisive_condition`: any fact/status the solver must assume that changes the answer (or null).
5. `numeric_check`: for calculations, your full working and result (or null).
6. `syllabus_fit`: is it a fair CUET UG (Class XII) question for the stated chapter? one line.
7. `quality_note`: one line on format/clarity/distractor plausibility.
Be strict and honest: do not force an answer. Output `{"items":[{"local_id":...,"solved_key":...,"option_status":{"A":{"status":"...","why":"..."},...},
"single_defensible_answer":...,"missing_decisive_condition":...,"numeric_check":...,"syllabus_fit":"...","quality_note":"..."}]}`.
Reply with a 3-line summary only.
