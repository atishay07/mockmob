# Design decisions: Repair v4 in the app (16 Oct 2026)

Branch `ui/phase2`. Follows `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (the copy on `mockmob-next`; it is not on this
branch). Rule 39 format. Rule numbers below are AGENT_RULES numbers. T006 and T008 are quoted from the website's note for the same
work (`docs/design-decisions/web-repair4-1016.md` on `web/repair4-1016`), which cites them as evidence for "no unbacked price"; they
are not independently re-checked here.

## User task

A student has just read why they got Q3 wrong. Two things follow, and the website already has both:

1. "Check it held": one fresh question they have not seen, marked by the server, with no extra credit. And, if the doubt is still
   open, "Ask Mobi about Q3" (1 AI credit, said before they go).
2. On a paper from before the full clock record, the Lab says honestly what that paper's record cannot show, and offers the one
   thing that fixes it: a timed mock of that subject. A paper that marked questions for review says what happened to them in the
   SWOT.

Server contract: branch `web/repair4-1016`, `data/tests/fixtures/repair4/contract_check_v1.json` (copied to
`flutter_app/test/fixtures/repair4/`), `data/mistake_lab.js` `lab.older`, `data/mock_swot.js` `marked_review`.

## What was built

| Piece | Where |
| --- | --- |
| `check` on the repair response, `RepairCheckInfo`; question, result, revise, pool models; `lab.older` | `lib/core/models/repair_check.dart`, `repair.dart`, `mistake_lab.dart` |
| Words, plans (what each server answer and failure means), `AskOffer` from the wallet | `lib/features/review/data/repair_check_logic.dart` |
| `GET` and `POST /api/recovery/check`, one controller per repaired mistake | `repair_check_api.dart`, `repair_check_controller.dart` |
| Ask Mobi link, "Check it held" and every state | `lib/features/review/widgets/repair_check_section.dart`, hooked in `mistake_view.dart` through `WorkedExplanation.follow` |
| Ask takes a handed-over question: `/ask?q=<attemptId>:<questionId>`, ask-context card, `questionRef` on the chat call | `lib/features/insights/data/ask_question.dart`, `ask_controller.dart`, `ask_screen.dart`, `widgets/ask_question_card.dart`, `action_router.dart` |
| Older-paper line and its one action | `lib/features/result/full/lab_older_note.dart` (under the ledger, and under the breakdown when there is no ledger) |
| Marked-for-review SWOT item | no code: the item is an ordinary server item (title, finished sentence, question numbers, plan row). Held by a fixture test |

Models read additively: unknown fields are ignored, a missing field is absent, a field that is not an object or a status the app
does not know is absent. No `check` field (an older server, a held repair, one not explained) draws nothing at all.

## Decisions

### 1. Ask Mobi sits before the check and is about the original mistake (rules 7, 8, 18, 24)
Order after the explanation and its rule: Ask Mobi about Q3, then Check it held, then "From your record". Ask names the mistake by
its number on the paper and says what Mobi sees ("Q3, your pick, the key and your rule, and nothing else about you"). It hands over
the mistake, never the check question: the ask-context and chat routes only know `attempt:question`, and a hand-off of the check
question would put the key of a question the student may not have answered behind a link. This is the website's decision (its
note, section 2), kept so the two agree. Trade-off: after missing the check there is no Mobi link for the check question; its key
and explanation are right there.

### 2. The price is only promised while it can be charged (rules 23, 24, overlay "explain AI credit costs", T006, T008)
From the AI wallet: available shows the link and "One written reply uses 1 AI credit. You have 43."; paused, no credits and
unreadable each show one line ("Written replies are paused right now. Nothing is charged." and its two siblings) and no link;
before the wallet is read the place is held at 48 dp with nothing in it, so nothing appears and is then taken back. A wallet read
that failed with nothing cached says "could not be read" instead of holding the place for ever (app-only: the app can fail to
read offline, the website cannot).

### 3. Ask takes the handed-over question; a record answer cannot discuss it (rules 18, 24, 35)
`/ask?q=...` opens a card, "About the mistake you repaired, <chapter>", with the question (160 characters from the server), "You
picked B.", "Your rule: ...". The server builds what Mobi sees; the app sends only the reference (`questionRef`) with every
message while the question is there, and sends nothing while it is still opening (a reply sent then would go without it and cost a
credit). While a question is handed over nothing is answered on the phone, the record's prompt tiles are not offered, the cost line
says "Uses 1 of your 9 AI credits" and never "record questions are free", the AI disclosure names the question, and Mobi does not
greet with his line about the record. When written replies cannot be bought the card says "Mobi cannot answer this question right
now. Nothing was charged." with one way out, "Ask about my record", which drops the question, and the composer goes (a greyed-out
composer for a question that cannot be asked is a dead end). Rejected: enabling the record path for a handed-over question; it
would answer a different question than the one the student arrived with. The web link `/mentor?tab=ask&q=` maps to the same place;
a reference that is not `<id>:<id>` is dropped. A message that was on its way when the app closed comes back with its question.

### 4. The pick is a radio group of 56 dp rows; the submit key is outlined (rules 7, 30, 36)
Rows are the app's `MmSelectRow` (letter bubble, 56 dp, radio and selected semantics, haptic tick), in the bank's own order (the
bank's explanations name option letters). Submit is outlined and the pinned "Next mistake" stays the screen's one filled key: with a
filled submit there were two lime keys competing in the frame (compared in the goldens while building; see below). Disabled until
a pick is made, with "Pick one option. Your first answer counts." beside it.

### 5. The answer says its verdict in words and tags rows in words (rules 16, 36; never colour alone)
The marked rows reuse the review's `MarkedOption` with a `word` override: "Key", "Your pick", "Your pick and the key" (a right
answer is one row). Then the verdict line (icon and words), the bank's explanation (when the bank has one), "Your rule" only when
missed, and the Revise line only when the server wrote cards ("This mistake comes back tomorrow." or "Both come back tomorrow:
this mistake and the question you just missed."). The day is worked out again from the due day in India time with the app's own
clock, so a stored answer opened days later does not still say "tomorrow". A stored answer opens on the verdict with "You answered
this check earlier. The first answer counts." and no submit key.

### 6. Failures keep the work (rule 35)
- Question could not be loaded (offline, slow, 429): plain words, "Nothing was charged.", Try again.
- None or unchecked: the server's reason in its own words; Try again only for `lookup_failed` and `check_unavailable`.
- Mark did not come back: the question and the pick stay, "We could not confirm the mark. Try again. Your answer is counted once.",
  the same request id is sent again (the server stores the first answer).
- Withdrawn question (`check_changed`): "That question was withdrawn before it was marked. Nothing was recorded.", the old rows are
  readable but stop taking taps and the pick is no longer lit, and the only action is "Get another question".
- Differs from the website: a 422 `invalid_pick` whose message says the question is not the one offered cannot be fixed by
  picking, so the way on is "Get another question" (the website offers a retry that would fail again). A plain "Pick one of the
  four options." stays a retry.

### 7. The older paper says one thing, honestly, once (rules 18, 24, 35)
Under the ledger, set apart by a hairline: a clock glyph and the server's one finished line, then one outlined key with the
server's label ("Take a timed mock to see your full Lab", or "another" for a paper from before the capture). No warning colour
(nothing is wrong with the student's work), no cause, no forecast. The key opens the practice setup for a full mock of that
subject, where the cost is shown before anything starts; its link is built from the action's own subject and mode, not from the
server's href. A paper with nothing missed still shows the note under the plain breakdown. The last two words of the label are
joined so a long label never leaves one word alone on a line.
Not done: with `older` present, the ledger's own fine line ("This earlier session was scored in your browser, so answer changes
and timings are not available...") and the older line say nearly the same thing in the `no_clock` case. Both are the server's
words and both are kept; the owner may want the server to drop one.

### 8. Marked for review in the SWOT
The item is already an ordinary SWOT item, so it appears where the server puts it: Opportunities for marked blanks, with its plan
row "Practise 20, timed" (Set up opens Quick setup for 20, cost shown before the second tap), Strengths or Weaknesses when all
answered, with the Q buttons. No code was needed; the three reads of the website's own sentences are held by a fixture
(`test/fixtures/swot_marked_review_v1.json`) and tests.

## Motion (rule 31)
Nothing new moves on its own. The answer's verdict, explanation and Revise line rise on the app's stagger once (not on a stored
answer); the Revise line has no motion of its own; the skeleton uses the app's skeleton. Reduced motion shows everything at once.

## Screenshots
New (no before): `flutter_app/test/golden/review/goldens/repair_check_{ready,picked,right,missed,none,paused_ask}_{night,day}.png`
(390 wide, the repair scrolled to Ask), `flutter_app/test/golden/insights/goldens/ask_question_{ready,paused}_{night,day}.png`,
`flutter_app/test/golden/result/goldens/lab_older_note_{night,day}.png`.
Changed (opened old against new, Night and Day): `lab_ledger_basic_{night,day}.png`: the basic ledger gains the hairline, the older
line and the outlined key under its fine line (the fixture now carries `older`).
During the work: the `picked` frame was compared with a filled submit and with the outlined one; the outlined one was kept (rule 7).

## Verification
- `flutter analyze`: no issues.
- Unit tests (`test/unit`, -j 1): 4715 passed in the full run. The one failure of that run (the older note's button label, which gained a no-break space after the run began) was fixed and the two affected files re-run: 38 of 38 pass. The `begin()` change that re-reads a none or failed check on reopen was made after the full run; the check widget tests (26) pass with it.
- Goldens (`test/golden`): 1063 of 1063 pass (18 of the frames are new here; the baseline handed to this work counted 1031, and the suite on this checkout counts 1063). Only the goldens named above were regenerated; every new or changed image was opened (Night and Day).
- New tests: `repair_check_model_test` (23: the contract fixture, every status and reason, planners, copy, Ask offer), `repair_check_widget_test` (26: absent field, order, every wallet state, loading, radio semantics and 48 dp rows, right, missed, no Revise, stale Revise day, stored answer, none, unchecked, load error, mark retry with the same request id, withdrawn), `ask_question_test` (23: reference, router, context, questionRef sent, nothing sent while opening, retry and interrupted restore keep the question, card states, blocked, drop, overflow at 360 and 1.3 text), `repair4_lab_older_test` (12: older model on the website's basic and none fixtures, the note, the full result, marked-for-review parse), and 3 marked-for-review cases in `swot_section_test`.
- Not exercised: a real device or emulator, TalkBack, a live server, the check inside a running exam (it only exists in Review).

## Unresolved assumptions
- The contract fixture is the website's; no live server was called. The wire shapes of `ask-context` (`pick.letter`, `hasKey`) are
  read from the website's component, since the contract fixture lists only question, subject, chapter, rule and cost.
- The ask link's server `askHref` is not followed: the app builds `/ask?q=` from the ids it already holds.
- No emulator or device (RAM): TalkBack was not run; semantics are asserted (radio group, selected, live regions), contrast is the
  app's tokens.
- "Written replies" is the website's wording; the Ask screen elsewhere says "AI replies". One term is the owner's call.
