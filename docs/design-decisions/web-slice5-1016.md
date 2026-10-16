# Design decisions: Mistake Lab v4 slice 5, cohort time (branch web/slice5-1016)

Spec: tmp/mistake-lab-v4/SPEC.md 4.13 and "Slice 5". Evidence IDs are from docs/research/premium-ux-ui-2026-10/source-ledger/EVIDENCE_INDEX.csv.

## The user task

A student has just finished a mock and opened one answer. They want to know whether the time they spent, and the second thoughts they had, were ordinary for students who sat the same question, and where on the whole paper they were slow. Nothing here asks them to do anything. It is reading material inside the page they are already on.

## What was built

1. A nightly table of aggregates per question (`question_option_stats`) and the SQL function that rebuilds it. No user id is stored.
2. Four lines, each hidden until its own gate passes, every number with its denominator:
   - Opened answer: "Students who got this right took a median of 51s (34 students)." Gate: 30 timed right answers, the student left out.
   - Opened answer: "6 of 27 timed students changed their answer here. 4 of them moved off the key." Gate: 20 timed students.
   - Opened answer: "9 of 30 students crossed out the key here." Gate: 20 students with strike data.
   - Ledger: "On 7 questions you took over twice as long as the students who got them right. You got 5 of the 7 right." Gate: 5 such questions, each with 15 or more timed right answers, and the student's own record must have ended (reliable time).
3. When the table is missing, empty or older than 48 hours, nothing changes: the committed snapshot of other students' picks is read exactly as before and no time line appears.

## Alternatives considered, and why not

- A badge or a chart of the time distribution in the opened answer. Rejected: the question the student has is a single comparison, and a chart needs a sample the data does not have yet (8 timed papers on 15 Oct). A sentence with its denominator says as much and cannot imply precision it lacks (T002, T008: show real counts and label what they are).
- Showing every line from 10 students, as the picks line does. Rejected: a median over 10 is not a stable number, and a student reads "took a median of 51s" as fact. The gates (30, 20, 20, 5 questions of 15+) are the spec's; they are written as `LAB_RULES` and tested at the boundary (29 hides, 30 shows).
- A "faster than 70% of students" rank. Rejected: no rank was asked for, it needs the whole distribution per student, and it invites the comparison the spec avoids ("nothing here is a forecast, a cause or a rank").
- A new card for the ledger finding. Rejected: it sits in the existing cohort block beneath the "questions you lost were ones most other students got right" line, with the same question chips, so there is one cohort block and not two stacked surfaces (AGENT_RULES 33: cards group meaningful items).
- Subtracting the student by recomputing every number from raw attempts at read time. Rejected as too heavy for a result page. The table keeps the sorted whole-second times of the right answers (up to 1,000 per question) so the student's own time comes out of the median exactly, and the counts take one student off when the student's own first answer was counted.

## Visual decisions (existing type and spacing, no new decoration)

- The new lines are `ml-others__line`, the class the picks line already uses (14 px, tabular numerals). Only three CSS rules were added: the lines after the first take the secondary ink (`--a-ink-2`) so the picks line stays the headline of the block; `text-wrap: pretty` so a number is not stranded at the end of a line on a phone; and 10 px above the ledger finding.
- The ledger finding is a second paragraph and chip row in the existing cohort block. No icon, colour, badge, glow or arrow was added.
- No ALL-CAPS labels, eyebrows, pills, gradients or hype. Copy is plain: counts, a time, a denominator.

## Evidence IDs

- T002: count only what is real. Every gate exists so that no line shows a number from too few students; a line with no data is absent, never "0" or a placeholder.
- T008: say what a number is. "median", "of 27 timed students" and "of 30 students" name the basis. The fine line under the ledger says each of the 7 questions has 15 or more timed right answers.
- S014: progressive disclosure for secondary information. The lines live inside the opened answer, which the student chooses to open; the ledger finding is one sentence plus chips.
- S016: WCAG 2.2 as the baseline. Text only, tabular numerals, no meaning carried by colour or motion; the chips are the existing buttons with "Go to question N" labels.
- AGENT_RULES 9 and 29: numerals with units and comparison context (seconds, students, the paper's own record).
- AGENT_RULES 35: states tested (below).

## States

| State | Behaviour | Proof |
|---|---|---|
| Table missing, empty, stale (over 48 h), or unreadable | Snapshot read as before, no time lines | cohort_time.test.mjs: four fallback tests |
| Fresh table, nothing for this paper | No question has a cohort; the older snapshot is not mixed in | test |
| Each gate one short | Line absent | gate tests at 29, 19, 19, 4 questions, 14 right answers |
| Exactly twice as long | Not "over twice", hidden | test |
| Held question, question with a break, under 2 s | Left out of the finding | test |
| Old record (no end event) | Ledger finding absent | test |
| Student's own first answer was counted | Taken out once, from the picks, the median and every count | test, and the SQL parity test |
| Zero, one and many forms | "None of the 20", "1 of 24 ... That student", "5 of 24" | test |

## Trade-offs and open assumptions

- Honest data volume: only attempts captured from 15 Oct onward carry an end event, so most lines will stay hidden until enough papers are taken. That is the intended behaviour ("when the volume exists"), not a defect.
- "Strike data" is read from the web runner (client platform web) or any attempt holding a strike-out. The app does not send strike-outs yet; when it does, its attempts count too.
- "Moved off the key" is a change that began on the key and ended on another option or a blank. If the owner prefers "ever left the key", it is one condition in the SQL and one in `ownContribution`.
- The leading metric is how often a student opens one of these lines and then changes the next answer they give on a timed question; there is no instrumentation yet (open item, same as slice 1).
- The owner decision about shared anchor questions per NTA paper is deferred and was not built.
- The Android app reads finished sentences from the server; `others.lines` and `cohort.slow` are additive fields, so an app build that ignores them is unaffected. Showing them there is a later slice.

## Anti-slop acceptance test (12 parts)

1. Identity with the logo hidden: unchanged page identity; this adds sentences only. 2. One primary action: none added. 3. True content: every number comes from the table or the student's own record; the fixtures are labelled illustrative and live only in the dev preview. 4. Hierarchy at first scan: the picks line first, the new lines in secondary ink below it. 5. Composition: same blocks, no new surface. 6. Typography by role: one existing class. 7. Every state: the table above. 8. Accessible interaction: native buttons, labels, no colour-only meaning. 9. No pseudo-evidence: gates, denominators, no ranks, no "most" without the existing Wilson gate. 10. Motion: none added. 11. One leading metric plus one guardrail: open (see above); the guardrail is that no line shows below its gate. 12. What would be better without this: the fine line under the ledger could be dropped; it is kept because it states the 15-student basis the finding stands on.

## 0/1/2 rubric (internal checklist; the owner signs off)

Task fit 2. Information architecture 2. Content truth 2. Readable hierarchy 2. Visual specificity 1 (deliberately plain). Accessibility 2 (contrast checked by eye in Night and Day; no new interactive element beyond the existing chips; no automated audit run). Functional states 2. Trust 2. Intentional motion 2 (none). Performance 2 (one extra read of one row per question, in batches of 120, only when the table is fresh; a stale or missing table costs one probe query). Responsive integrity 2. Instrumentation 0.

## Verification

- Captured on my own dev server (port 3170) with my own headless Chrome over CDP, real pointer clicks (the target was checked with `elementFromPoint` before every click), at 390x844 and 1440x900, Night and Day, for three fixture states: `&cohort=time` (every gate met), `&cohort=time-gated` (one short of each), and no param (the page as slice 4 left it). No sideways scroll and no console error in any of the 12 runs. Files: mockmob-next/tmp/mistake-lab-v4/slice5-captures (answer-q1, answer-q4, ledger and ledger-cohort for each run, plus report-*.json).
- Critique rounds: the first capture showed four lines of equal weight (a wall of ink), so the lines after the first moved to the secondary ink; the phone capture broke "(30 / students)" and "4 / of them" across lines, so `text-wrap: pretty` was added and the count in "{m} of them" is joined to "of" with a no-break space (re-captured at 390 in Night: both stay together); the ledger finding sat tight under the chips of the line above it, so it got 10 px.
- All 12 captures were re-taken after the last change. Tests: test:recovery 272, test:app 328, test:learning 277 pass. eslint clean on every touched file.
