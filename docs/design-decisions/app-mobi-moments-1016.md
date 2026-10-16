# Design decisions: Mobi at real moments, one per screen (app, 16 Oct 2026)

Builder A3, branch `ui/phase2` (worktree `wt-phase2`). Answers design critic findings 16 and 21
(`mockmob-next/docs/brain/DESIGN-CRITIC-2026-10-16.md`). Follows
`mockmob-next/docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (not on this branch); rule numbers
below are AGENT_RULES numbers, evidence IDs are from its `source-ledger/EVIDENCE_INDEX.csv`.

## User task

A Class 12 student uses the app to find and repair lost marks. Mobi is the companion: he should be
there when something real happens to the student (an answer graded, a session finished, a save the
server confirmed, a load that failed), and never as decoration parked next to a number. The owner's
rule: at most one Mobi per screen, and only at a real moment; the largest instance wins, others
become the subject object or a 16 dp mark. Motion only answers an action or shows state, and
reduced motion is respected.

## How the app was audited (not by eye alone)

Every golden test (57 files, 1,065 frames, Night and Day) was run through a
throw-away comparator that, at the moment each golden is captured, walks the live widget tree and
counts every `MobiCharacter` (full body or head) and `MobiFigure` that is laid out and on screen,
with its size and position. The comparator lived in an untracked copy of the tests and was deleted
after the run; nothing of it is committed. Results are in "Audit result" below.

## What changed

| Screen | Before | After | Why |
| --- | --- | --- | --- |
| Saved questions (list) | A 44 dp Mobi sat resting beside the slot meter on every visit (critic 16, `saved_list`). | No Mobi on arrival. The first save the server confirms this visit (an Undo) brings him into the slot kept for him, with the event table's small nod. A confirmed removal is not a moment for him. The slot is kept from the start, so the meter never moves when he arrives. | Mobi with no reason (rule 31: motion needs a purpose; S017 on decoration without intent). The real moment, a server-acknowledged save, keeps its reaction. |
| Revise, end of a run | A 44 dp check ring drew itself in above "3 recalled, 1 come back tomorrow". No character at a session end. | Mobi (88 dp) stands where the ring was and plays one act from what the server graded: a cheer when every recall held, the small correct hop when most did, the "come on" lean when more came back than held. Quiet seats him (no hop); Off keeps the plain check ring. | A finished session is a real moment with no reaction (rule 31). Acts come from the shared moments table (`MobiEvent.sessionDone`, `answerRight`, `answerWrong`), the same as Learn's run end. |
| Onboarding, "Which CUET are you writing?" (step 1 of 7) | Two Mobis: the guide bar's (64 dp) and a 28 dp Mobi walking the road to the chosen exam window. Found by the audit, not in the critic's list. | The guide's Mobi is the one Mobi. The student's place on the road is the 16 dp mo mark, travelling to the window in the same 520 ms as the light. When it arrives, the guide's Mobi answers: the small correct hop at the May 2027 window, a look down the road to the mark at May 2028. | The largest instance wins; the smaller one becomes the 16 dp mark (owner's rule, critic 16). The reaction to the choice is kept, moved to the Mobi who is already there. |
| Revise, a graded recall | The line and the key only. | `FeedbackMobi` beside the server's line: `correct` for a right recall, `encourage` for a miss, 56 dp. Full celebrations only, at most once every 2.5 s, dropped past 130 percent text, never before the server answers. | A right or missed recall is the same moment as Learn's concept check, so it reacts the same way (rule 11: consistency). It uses its own rate gate (`revise:feedback`) so Learn and Revise do not starve each other. |

`FeedbackMobi` (`lib/features/learn/widgets/feedback_mobi.dart`) gained one optional argument,
`rateKey`; Learn's behaviour and gate are unchanged.

## What was checked and left as it is

- **Finding 16, the other screens.** The record (`record_full_pro`): the Ask row already carries a
  glyph, not a face, and the lead finding's 34 dp Mobi is the one Mobi (held by
  `insights_packet_f_test` and now by `mobi_moments_one_per_screen_test`). Ask (`ask_start`): the
  credit pill has a sparkle glyph and thread replies carry the 16 dp mo mark, one Mobi on the stage
  (held by `ask_faces_one_mobi_test`). Compass (`compass_full`): the compass is the hero's one
  object, no Mobi (commit 610bab23). These were fixed by earlier packets; the audit confirms them.
- **Finding 21, Learn.** The real moments already react: a concept check answered on this phone
  gets `FeedbackMobi` (correct or encourage), the end of a review or a lesson gets Mobi by mood
  (celebrate, cheer, encourage, a single card kept, or pointing at the cards to see again), the
  nothing-due card has Mobi reading or pointing at the key, and the cleared queue is proud once.
  The goldens the critic looked at (`run_choice_wrong`, `run_card_shown`) are the reopened and the
  reveal states, where no reaction is right. Learn's recall ratings (Forgot, Hard, Got it, Easy)
  deliberately get no Mobi: a happy hop for "Easy" and a lean for "Forgot" would reward a rating,
  and the keys exist so the student rates honestly (the same reason none of them is the volt key).
- **Repair, result, practice, rhythm, empty and error states**: each already reacts through its own
  Mobi (`RepairMobi`, the recap and result Mobis, `PracticeMobi`, the weekly goal's proud Mobi,
  `StateView`'s oops once per failure run). Today belongs to builder A1 and the result answer
  sheet and ledger to A2; not touched.

## Not done, and why

- **Critic 21, rating keys with "a tiny face each".** Four faces on four keys would be four Mobis
  (or emoji-like stand-ins) on one screen, against the one-Mobi rule; a colour step from coral to
  volt would nudge the honest rating. A recall-strength glyph (1 to 4 bars) would need a `leading`
  slot on non-option `KeyButton` variants in core; left for the core owner.
- **Critic 21, the due hero's subject object.** The study queue carries counts only, no subjects
  (`StudyQueueView`), so an object would claim a subject the app does not know (rule 5, rule 29).
  The card pile stays: it is a true picture of the count.
- **Critic 21, the long "Up next" reason and Critic 13's repair layout** are copy and layout, not
  character; out of this packet.

## Reduced motion, Celebrations, large text

Every Mobi here is a `MobiCharacter`, which holds his pose still under reduced motion. The Saved
arrival uses `MmEntrance` (instant under reduced motion). Revise's end follows the Celebrations
setting through `MobiRation.underLevel` (Quiet: seated; Off: the check ring). Per-answer reactions
show only under Full and are dropped past 130 percent text so the words never wrap around art.

## Evidence IDs

- S017, S018: decoration without intent reads as slop; character is kept only where it answers
  something real.
- S016 (WCAG 2.2): decorative Mobi stays out of the semantics tree; the line carries the meaning.
- S014: nothing important is hidden; the reaction never replaces the words.
- T002 / rule 17: nothing claims progress the server has not confirmed (the Saved nod waits for the
  server; the Revise end only follows graded answers).

## Audit result

1,065 frames counted (two `record_lower` frames could not be measured: the ledger card's Mobi has a
collapsed transform there; the record's one-Mobi rule is held by a widget test instead).

- More than one Mobi on a real screen: only the onboarding stage step (`stage_empty`,
  `stage_class12`, `large_text_stage`), fixed above.
- More than one on purpose: the mascot reference sheets (`mascot/*`: every act, faces, sizes) and
  three rhythm sample sheets that stack two independent cards in one frame (`returning_cards`,
  `celebration_moments`, `goal_editor`). These are component galleries, not screens.
- One Mobi with no reaction to anything: Saved (fixed above). The You screens (subjects, account,
  goal, appearance, help) each keep their one Mobi because each reacts to the student's own action
  (a subject capped or chosen, a goal set, a theme changed, a copy or mail confirmed or failed, a
  sign-out). The credits AI pool's 32 dp head marks the pool Ask Mobi spends from.
- A real moment with no reaction: the end of a Revise run and a graded Revise recall (fixed above).

## Verification

- Unit: `test/unit/mascot/mobi_moments_one_per_screen_test.dart` (Saved: no Mobi on arrival, one
  after a confirmed save, none after a confirmed removal, the meter does not move; the record shows
  one Mobi Night and Day; Revise: the act per graded run, Full, Quiet and Off, the per-answer Mobi
  and its absence under Quiet and Off) and the road tests in `test/unit/onboarding/live_motion_test.dart`
  (the mark travels, no Mobi on the road, the guide's Mobi answers once, reduced motion). The
  review, insights, onboarding, learn and mascot suites: 1,007 tests passed with `-j 1`.
- `flutter analyze` on every changed file: no issues.
- Goldens regenerated and opened, Night and Day: `review/revise_end`, `revise_right`,
  `revise_wrong`; `insights/saved_list`, `saved_removing`; `onboarding/stage_empty`,
  `stage_class12`, `large_text_stage`. The Revise golden test now starts each frame with fresh
  Mobi gates so the Night and Day twins cannot differ by run order.

## Anti-slop check (the parts this packet touches)

No new copy, pills, dots, glow, gradients, cards or arrows. Every motion added answers something
the server confirmed (a save, a graded recall, a finished run) or the student's own choice (the
road). Reduced motion is respected by the character and by `MmEntrance`. Nothing new floats over
content: the Saved slot and the Revise end slot are reserved, so nothing shifts. Rubric scoring is
left to the owner; this note lists what was verified, not a self-awarded score (rule 38).
