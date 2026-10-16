# AP-3 design decisions (pass 1016e, app): truth, touch and hierarchy

Built 16 Oct 2026, evening, on `ui/ux-social-1016` (wt-appux2). Plan: `docs/design-decisions/pass-1016e/APP-PASS.md`, packet AP-3. Nothing pushed or deployed. No emulator walk was run in this workflow (the brief rules out the emulator), so every item below is proven by unit tests and goldens only. Device truth is still owed (rule 34, device-truth memory).

## Built

### AP3-01 (A05): the recap card is in the hand
- **User task.** Move between recap cards 2 to 4 by swiping sideways.
- **Before.** The card followed the finger at 0.35 and stopped at 96 dp, so it felt like it was on a rubber band. The next card then rose from below, at an angle to the gesture.
- **Change** (`card_drag.dart`, `recap_flow.dart`):
  - Toward a card that exists, the card follows the finger 1:1 with no cap.
  - The drag commits past 30% of the card's width, or on a flick of 500 px/s or more in the same direction.
  - The thrown card leaves on `Springs.smooth`, seeded with the finger's velocity. The next card comes in from the opposite side, 56 dp out, on the emphasized curve.
  - Short of the commit, the card goes home on `Springs.snappy`, also seeded with the velocity.
  - Toward nothing, the card rubber-bands at 0.15, up to 48 dp.
  - The threshold tick stays.
  - Under reduced motion the card does not follow and is not thrown; the commit still turns it.
  - The switcher now decides incoming or outgoing live and keeps one widget shape (opacity over a transform) in every state, so a card is never rebuilt when its transition ends or turns. This also restores the "leaving card sinks back" branch, which was never reached before.
- **Evidence.** Ledger L34; apple-design (1:1 tracking, velocity hand-off); AGENT_RULES 31.
- **Tests.**
  - A 72 dp drag moves the card 72 dp, and a short drag springs back to exactly 0 (`recap_reactions_test`).
  - The commit and flick rules (`recap_reactions_test`).
  - `recap_flow_test`, including the drag turn and spring back.

### AP3-04 (A09): the Lab head is a number
- **Change** (`lab_ledger_section.dart`, `full_sections.dart`):
  - "112" at 56 sp condensed (the recap's numeral), with "marks missed, of 250" at 16 sp ink2 beside it, then the rest of the server's heading ("Here's where they went.").
  - The numeral counts up with the bar's split (in the first 60% of it), so the number and the bar arrive as one thing.
  - The count is said once; TalkBack reads the server's full heading sentence.
  - Without full marks, or if the heading does not lead with the count, the old heading line stays, so nothing is lost.
- **Tapping a segment** now glides its row into view (300 ms, `Motion.glide`, only as far as needed).
- **Already met at the base:** the 12 dp bar with 2 dp gaps, the 2 dp lift, and chips at 48 dp hit height (40 visual plus 4 on each side) with 8 dp visual gaps.
- **Evidence.** AGENT_RULES 9, 25, 28 and 29 (numerals with units and a denominator); owner direction (HIGH and Revolut hierarchy).
- **Tests.**
  - `headingRest` cases.
  - The 56 sp numeral, the denominator, the count said once, and the semantics label.
  - Goldens `lab_ledger_ready` at 360, and the new `lab_ledger_ready_390`, Night and Day. All four were opened and checked.

### AP3-07 A20: a timed mock's leave sheet is plain
- **Change** (`leave_sheet.dart`, `runner/copy.dart`):
  - No Mobi in a timed mock.
  - The body reads "The clock keeps running. You can continue until 11:42 PM." with the real end time.
  - The keys are "Keep going" (primary) and "Leave the mock".
  - A practice keeps Mobi.
- **Evidence.** MockMob overlay (protect the timer, avoid distraction); AGENT_RULES 7 and 31.
- **Tests.**
  - `leave_sheet_test` covers both cases.
  - `leave_guard` goldens regenerated at Night and Day; Night was opened and checked.

### AP3-07 A22: the hand-off is visible and stoppable
- **Change** (`submit_screen.dart`):
  - Once the server holds the sheet, a 2 dp volt line fills under "Open your sheet" over 2,800 ms, linear.
  - Any touch stops the auto-advance, and the line fades out in 120 ms. The page then waits for the key.
  - Under reduced motion there is no auto-advance and no line.
  - NTA mode is unchanged.
- **Evidence.** AGENT_RULES 31 (no essential information conveyed only by motion: the key is still there); MockMob overlay (submitted-state clarity).
- **Test.** `runner_flow_test`, "the hand-off line fills under the key, and a touch stops it".

## Not built in this packet, and why
- **AP3-02 (repair count reason).** No per-paper server reason field exists on the app model yet ("1 key is under review"). The existing fallback, "The other N is in Review", stays. Needs the server field first. The M07 one-Mobi guard is also not done.
- **AP3-03 (one "How this is counted" row, net line).** Waits on WP-C's server copy (`mistake_lab.copy.json`).
- **AP3-05 (arrows to text buttons, card 4 layout, LengthPill).** The arrow is in `result/widgets/evidence_link.dart`, which is outside AP-3's file list. Card 4 layout and the LengthPill were not reached.
- **AP3-06 (practice result counts).** The Mobi bubble and the eyebrow live in `finish_stage.dart`, which is outside AP-3's file list.
- **AP3-07 A21, A23 and A24.** A24's chip lives in `save_glyph.dart`, which is outside the list. A23 (stem sizes) would restate every runner golden; it was left for a run with time to review them.
- **AP3-08 (confirm sheet).** The aside line and the difficulty picker live in `composer_parts.dart` and `practice_composer.dart`, which are outside AP-3's list (AP-2 or v12 territory).

## Rubric (0/1/2) over touched screens
- **Recap swipe.**
  - Purpose: 2.
  - Continuity: 2.
  - Reduced motion: 2.
  - Device proof: 0 (not walked).
- **Lab head.**
  - Hierarchy: 2.
  - Numbers with units and denominators: 2.
  - Night/Day parity: 2.
  - Device proof: 0.
- **Leave sheet (timed).**
  - One primary action: 2.
  - Distraction: 2.
- **Submit hand-off.**
  - Clarity: 2.
  - Control: 2.
  - Device proof: 0.

## Open
- Golden failures seen in the shared worktree that are not from AP-3's files: `sealed_unfold*` and `card4_first_*`. The worktree carries other builders' uncommitted edits (`light_sweep.dart`, `celebration_slot.dart`, and others). These goldens are left for their owners.
