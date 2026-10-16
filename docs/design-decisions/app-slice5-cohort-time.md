# Design decisions: Mistake Lab slice 5 (cohort time) in the app

Server contract: branch web/slice5-1016 (data/cohort_time.js, docs/design-decisions/web-slice5-1016.md). Evidence IDs are from docs/research/premium-ux-ui-2026-10.

## The user task

A student opens one answer on the result page and wants to know whether their time and second thoughts were ordinary for students who sat the same question, and where on the paper they were slow. Nothing new is asked of them; this is reading inside screens they already open.

## What the app now shows (each only when the server sends it)

1. Opened answer, under "How others answered" and the picks line: up to three lines from `others.lines` ("Students who got this right took a median of 19s (30 students).", "6 of 27 timed students changed their answer here. 4 of them moved off the key.", "9 of 30 students crossed out the key here."). Same 15 sp tabular body type as the picks line, in the second ink so the picks line stays first.
2. Ledger, in the cohort block under the "most other students got right" line and its chips: the `cohort.slow` sentence ("On 7 questions you took over twice as long as the students who got them right. You got 5 of the 7 right.") and its question chips. The fine line that states the 15-student basis already arrives in `cohort.fine` and is shown with the other fine lines.

Absent field means nothing: no placeholder, no zero, no empty row. The models read both fields additively; a build that never sees them is unchanged, and an older server sends neither.

## Decisions and evidence

- T002 (count only what is real): the app applies no gate of its own and invents no number. Every gate (30, 20, 20 students; 5 questions of 15) is the server's; the app shows finished sentences with their denominators.
- T008 (say what a number is): the sentences name their basis ("median", "timed students", "students"). The app does not shorten or rebuild them.
- S014 (progressive disclosure): the lines live inside the opened answer the student chose to open; the ledger finding is one sentence and chips.
- S016 / WCAG 2.2: text only, no colour-only meaning, no motion added; chips are the existing 44 dp buttons.
- AGENT_RULES 33 (cards group meaningful items): no new surface; the finding joins the existing cohort block.
- Numbers held to their words: the website uses `text-wrap: pretty`; Flutter has no equivalent, so `keepNumbersWithWords` joins a digit to the word after it with a no-break space at draw time (the phone capture first broke "(30 / students)"). The server's own no-break "4 of them" is kept as sent.
- Not added: no icon, badge, pill, glow, arrow, chart, rank or hype.

## States

| State | Behaviour | Proof |
|---|---|---|
| Server sends neither field (older server, gate not met) | As before | lab_cohort_time_test.dart, goldens `*_absent_*` |
| `others.lines` present | Lines under the picks line, server order | unit, `cohort_time_answer_lines_*` |
| `cohort.slow` present | Sentence and chips under the cohort line | unit (chip tap opens that answer), `cohort_time_ledger_lines_*` |
| `slow` without the cohort line, or without numbers | Sentence still shows; no chips when no numbers | unit |
| Wrong types, counts that do not add up | Lines of the wrong type dropped; the counts check still sets the whole read aside | unit |
| Keys off | Neither the picks line nor the time lines | unit |

## Verification

Fixtures are the website's own output (`buildMistakeLab` over `replay_full_input.json` with `fixtureCohortTime`, every gate met and one short), copied to test/fixtures/mistake_lab/contract_cohort_time_v1.json and contract_cohort_time_gated_v1.json. Goldens at 390 dp, Night and Day, for the opened answer and the ledger, lines present and absent (8 images), each opened and looked at after one critique round (the stranded "(30 / students)"). flutter analyze clean on the touched files; test/unit/result and the lab ledger, slice 4 and slice 5 goldens pass (428 tests). Not run on a device or emulator (no device by instruction).
