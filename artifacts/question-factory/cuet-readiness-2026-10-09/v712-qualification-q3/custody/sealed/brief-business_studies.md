# Fresh CUET benchmark construction brief (author role, set 3)

You are constructing a small, fresh, independently checkable benchmark for an automated CUET UG (Commerce) question validator.
Subject: **business_studies**. Work ONLY from the supplied fact packet `C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v712-fresh/kit/business_studies-facts.json` (exact registered NCERT/original source excerpts).
Write your output to `C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v712-fresh/sealed/business_studies-authored.json` as JSON (schema below). Do not read any other project files except the two named here and the template.

## What to build
1. **5 VALID controls** — excellent, original CUET-style 4-option MCQs (Class XII, CUET UG 2024/2025 pattern).
   - Each must be answerable with exactly ONE defensible option using only the printed stem/passage plus the cited excerpt(s).
   - Every decisive fact, rule, number, status (e.g. paid/unpaid, premium, ratio, timing) must be printed in the stem or stated in a cited excerpt.
     Never rely on outside knowledge for the decisive step.
   - Each distractor must encode a plausible student misconception or calculation slip, and must be decisively FALSE per the stem/excerpt
     (a specific part of it contradicted by a quotable premise or arithmetic) — not merely "a different textbook category" or "not mentioned".
   - Vary format across the 5 (pick from: direct conceptual, numerical/calculation (accountancy/economics), statement/case application,
     assertion–reason style is NOT allowed; for English: reading comprehension on the given passage (fact, inference, vocabulary-in-context, tone/purpose)).
   - Mix difficulty honestly: ~2 easy (direct recall/recognition), ~3 medium (apply a rule / two linked steps). Label honestly.
   - Explanation: 2–4 concise sentences; every claim (including why each distractor is wrong) must be supported by the stem or a cited excerpt.
   - Explanation literalness: every explanation clause must be stated by, or follow necessarily from, the printed stem/passage/excerpt. Do not paraphrase in a way that changes scope ("offered" is not "moved"; "no managerial position" is not "no position"), do not add facts the stem does not print (e.g. "no premium is involved"), and when describing how a wrong numeric option arises, compute it exactly.
   - learning_objective: one official-syllabus objective that the question genuinely requires.
   - Spread over different facts/chapters: the 5 valid controls must use at least 4 different chapters, and (Accountancy/Economics) at least one must be a numerical calculation. Do not reuse one fact for more than 2 items. Do not copy any question from the template file. Write entirely new questions; do not reuse any question you may have seen before.
2. **4 DEFECT controls** — each a NEW, separate, otherwise-polished question (not a mutation of your valid five) that contains exactly ONE
   deliberate, real defect of the assigned category. The defect must actually be present in the item text (do not merely describe it):
   - d1 wrong_key: recorded key is wrong; the excerpt establishes a different option.
   - d2 second_defensible_option: a second option is also fully established by the excerpts (e.g. a case that fits two functions/principles equally), not just a textbook-category neighbour.
   - d3 unsupported_explanation: key correct but the explanation adds a factual claim not in the excerpts (or false).
   - d4 missing_decisive_assumption: the case omits a fact needed to choose between two options, so the key depends on an unstated assumption.
   For each defect, record `defect_evidence`: exactly where the defect is and why it makes the item unpublishable.

## Candidate JSON shape (per item; follow the template file `C:/Users/atish/AppData/Local/Temp/claude/C--Users-atish-Desktop-mockmob-copy-mockmob-copy/25c3edf2-b29c-4fc7-9e35-73be4428aee6/scratchpad/v712-fresh/kit/template-candidates.json` for field names)
```
{ "local_id": "<subject>-v<n> or <subject>-d<n>", "expected_valid": true|false, "defect_category": null|"<category>", "defect_evidence": null|"...",
  "candidate": { "subject": "business_studies", "chapter": "<exact chapter string from the fact>", "body": "<stem>", "passage_text": "<full passage for English RC, else empty string>",
    "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],
    "correct_answer": "A|B|C|D", "explanation": "...", "difficulty": "easy|medium|hard",
    "question_type": "conceptual_mcq|numerical_calculation|case_application|statement_selection|reading_comprehension",
    "route": "conceptual|numerical|passage", "learning_objective": {"syllabus_unit":"...","objective":"...","target_term":""},
    "fact_refs": ["F3", ...] } }
```
- For English reading comprehension, `passage_text` must be the COMPLETE passage text copied exactly from the fact, and route "passage".
- Vary the correct answer position (roughly balanced A–D).
- Options must be distinct, similar in length/style, no "all of the above"/"none of the above".

## Output file
`{"subject":"business_studies","items":[ ...9 items... ]}` — valid JSON only. Then reply with a 5-line summary (no item text).
