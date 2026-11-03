# E applied in the app (branch ui/1104-app-english)

4 Nov 2026. The APP side of `E-ENGLISH.md` (101 rows) is applied in `flutter_app/`, mirroring what the web pass did
(`E-APPLIED-WEB.md`, branch `web/1104-english`, 39e0b0478). Where the web adjusted or skipped a row, the app says the same. No
facts changed: counts, limits (10 card ratings, 5 new cards, 10-minute Free sessions), the order of returns and what Pro opens are as before.

## 1. Rows applied as written (app part)

1, 2, 3, 4, 7, 8, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 39, 40, 41, 42, 43, 44, 45, 46, 47, 54, 56, 57, 58, 60, 63,
64, 65, 67, 68, 69, 70, 71, 72, 73, 75, 76, 77, 78, 79, 80, 81, 83, 94, 101 (scope of 101 in section 5).

Twins of web rows that the table lists as Web only, applied because the app has the same line (and a parity test holds it):

- Row 12: `RunView.leadView` key "Start 10 minutes" is "Start · 10 min" (`run_math.json`, `runView.mjs leadView`).
- Row 28: `CoverModel.mixLineOf` ", all it has today" is ", that's all for today" (`cover_model.json`).
- Row 82: `KeyCardsCopy.reportFailed` takes the contraction ("The report didn't go through. Try again.").
- Row 26 also covers `CoverModel.keyLabelOf` ("Start · 10 min", on Explore's covers and Practice's Explore door).

## 2. Rows adjusted (the text differs from the "After", to say what the web says)

- **7, empty title**: "Nothing here yet" (the web's wording for `RunCopy.emptyTitle`), not "Nothing to line up here yet" and not a "session" form.
- **18**: `HomeModel.marksText` is "35 marks" ("1 mark"), the sort is "Most marks left"; no "+35" (the web's choice). The figure is not drawn on a
  row in the app either (the model and its parity test only).
- **55**: `ChapterCopy.stale` is "We couldn't update the plan. You're seeing the last one." (the web's adjusted line, not "the length").
- **61**: the "Chapter sheet" / "with your name on it" words are in `ChapterModel.shelfView` with `webSheet: true`, the path the parity test holds.
  The app's own page (`webSheet: false`) keeps its round 5 words, "Must-know lines" and "12 lines" (LK45 fix 3): the app shares, it does not print.
- **78**: `reportWaiting` reads "Saved on this phone. It'll be sent when you're back online." (the row's After for both lines).
- **Row 43's apostrophe**: `KeyCardsCopy.proLine`, the Pro nudge's Key cards line and `lineMatched` use the typographic ’ as the web's
  `PRO_LINE`/`LineYouNeeded` do; the other new lines use the straight '.

## 3. Rows not applied

- **89 (skipped, as on the web)**: "Holding" and "Holding, fading" stay (pinned by KEYCARDS-BUILD-SPEC, and the labels come from the server).
- **59 (no change)**: the app already says "Fills your 10 min" and "Chapter 6, fills your 10 min" (`chapter_piles.dart`).
- **62 (no change, as the row says)**: "Share chapter sheet" stays.
- **Web only, no app twin**: 5, 6, 9, 10, 11 (the offer's lines come from the server), 31 to 38, 48 to 53 (server `compose.js` lines),
  66, 74, 84 to 88, 90 to 93, 95 to 100.

## 4. Shared lines mirrored (the web's words, the app's twin)

| Shared line (web) | App twin | Held by |
|---|---|---|
| `WORDS.coachRatings` | `LearnWords.coachRatings` (the coach line under the keys) | `words.json` parity |
| `reviseQuestions(n)`: "Revise 5 questions" | `LearnWords.reviseQuestions` | `words.json` parity |
| `missedWords(...)`: "in this session, then tomorrow" | `LearnWords.missedWords` | `words.json` parity |
| `FREE_CAPPED` | `LearnFreeWords.capped` (`ExploreCopy.freeCapped`) | `words.json` parity |
| `FREE_REST_PRO`, `progressLabel` | `StageEndModel.freeRestPro`, `progressLabel` | `stage_text.json` parity |
| `CHECKPOINT_LINE`, `keptLine` | `FeedModel.checkpointLine`, `keptLine` (and the unused quiet line) | `feed_model.json` parity |
| `IN_RUN` / the server stamp | shown as the server sends it (`LearnWords.backStamp` builds "Back tomorrow") | server |
| `compose.js` `NOTE`, `RATINGS_USED`, `shrinkText` | server lines; `ChapterModel.ratingsUsedLine` and its matcher take the new server text | `chapter_model.json` parity |
| `kinds.js` `RATINGS` "Missed it", `PRO_LINE`, `limitCopy` | `KeyCardsCopy.missed`, `proLine`, `reviewCapTitle`, `reviewsLeft` | `english_pass_test.dart` |
| `homeModel.mjs` verdict, sort, `marksText` | `HomeModel.verdictText`, `sorts`, `marksText` (and the pill's split at the comma) | `home_model.json` parity |
| `coverModel.js` key and mix line | `CoverModel.keyLabelOf`, `mixLineOf` | `cover_model.json` parity |
| `chapterModel.mjs` pile line, sheet row, first-visit line | `ChapterModel.pileView`, `shelfView`, `firstVisitLine` | `chapter_model.json` parity |
| `runView.mjs` `leadView` | `RunView.leadView` | `run_math.json` parity |
| `proNudge.mjs` Key cards line | `ProNudgeCopy` Key cards sheet line (`pro_nudge/copy.dart`) | `english_pass_test.dart` |
| `revise` `SEND_FAILED` | `ReviseCopy.sendFailed` | `revise_test.dart` |

Beyond the named lines (the same rule and word): `RunCopy.stageLabel` ("... session" for a screen reader), the "added to this session" label on the
next-chapter pile, `ChapterCopy.loading` ("Getting this chapter ready"), the question's verdict "Not quite. The answer is B." (the long spoken
form with the option text stays for screen readers), the verdict pill on a roadmap row ("Needs work, from your papers": the pill now splits at the
first comma), `FeedCopy.freeDoneShort` (now `LearnFreeWords.doneHeadline`, one sentence everywhere).

One layout change the new words needed: "Missed it" did not fit on one line in a Key cards rating key at 360 dp ("Missed" and "it" on two
lines, with 24 dp of side room in each key). `KeyButton` and `KeyButtonFace` take an optional `horizontalPadding` (null keeps every other key as it
was), and the three Key cards rating keys use 8 dp.

## 5. Row 101 (contractions) scope

Applied to the app's "did not load / could not / was not saved / was not added / did not go through" lines in `learn2/**` (home, cards, chapter,
explore, feed, run), `keycards/keycards_copy.dart`, `review/revise/revise_copy.dart` (`sendFailed`) and the feed's "Could not add/save". About 25
lines. Not applied: Learn v1 (`features/learn`, the fallback when Learn v2 is off: "We could not load Learn" and others), Mob, payments, Today,
profile, billing, the result and review pages, Google Play lines in `pro_nudge/copy.dart` ("We could not reach Google Play."). A separate pass if wanted.

## 6. Parity

- `tool/learn2_parity/*.mjs` now take `LEARN2_WEB_COMMIT` and `LEARN2_WEB_NAME` from the environment for the label they write (no other change); the web
  folder is still `LEARN2_WEB`. The cases were regenerated from an export of `web/1104-english` (39e0b0478): `words.json`, `cards_shared.json`,
  `chapter_model.json`, `cover_model.json`, `feed_model.json`, `home_model.json`, `run_math.json`, `stage_text.json`.
- Two web changes that are not English (the R7 W "Suggested:" cover prefix and the `cardKind` tab on a cover's hook card) are in that web commit but
  were NOT ported to the app, so `cover_model.json` keeps "For you:" and drops `cardKind` (done on the regenerated file: 8 prefixes, 420 fields). Nothing
  else was edited by hand.
- `test/unit/keycards/support/display_parity.json` (`blank_runs.mjs`) was regenerated once and put back: its only differences were newer card
  decks on the web, not words.
- The recorded server answers (`test/fixtures/learn2/*.json`, from the web preview at 4b5f67e34) are not re-recorded (they need the preview server).
  They still hold the old server lines ("Back in this run, then tomorrow", "Free sessions are up to 10 minutes. Pro has any length.",
  "1 kept. They are first in Revise.", "keeps them on a schedule"); the app shows server lines as they come, so those change on the phone when the web
  server (`learn.js`, `compose.js`, `stamps.js`) with the same pass is deployed. The tests that pin those recorded lines still pass and are unchanged.
- `learn_words_parity_test.dart`, `feed_model_parity_test.dart`, `home_model_parity_test.dart`, `chapter_model_parity_test.dart`,
  `cover_model_parity_test.dart`, `run_math_parity_test.dart`, `stage_text_parity_test.dart`, `cards_shared_parity_test.dart`: green.

## 7. Tests and goldens

- New: `test/unit/learn2/english_pass_test.dart` pins the app-only rows, the shared lines, "no run / lined up" in the student-facing copy and the middle dot rule.
- Updated expected strings (wording I changed on purpose): `chapter_model_test`, `chapter_page_test`, `find_panel_test`, `cover_model_test`,
  `cover_model_parity_test`, `explore_screen_test`, `feed_controller_test`, `feed_screen_test`, `learn_home_test`, `learn2_pill_test`,
  `run_controller_test`, `run_screen_test`, `question_view_test`, `end_form_test`, `stage_frame_test`, `stage_states_test`, `revise_test`,
  `keycards_widgets_test` (a "no reviews left" check now says "ratings left"), `learn_cards_golden_test` (a finder).
- Goldens re-recorded because only text changed (or a line wrapped because of it): 96 images, Night and Day each: 32 in `golden/keycards` (16 kc_* shots),
  4 in `learn2/cards` (find_results_free, view_empty_filter), 4 in `chapter` (error, offline), 24 in `explore` (every cover: the key reads
  "Start · 10 min"), 4 in `feed` (error, wrong line), 4 in `home` (error, pro_returning_412), 16 in `run` (card revealed, card revealed at text 1.3, error,
  lesson, recap, round, stop sheet, wrong line), 4 in `stage` (wrong line, read) and 4 in `practice` (the Explore door, text 1 and 1.3). Looked at after recording: Explore, Practice's Explore door at text 1.3, the run at text 1.3, Find with the locked line, Key cards'
  Study (the three keys), the Revise cap, Key cards offline and the chapter page offline: nothing cut or overflowing.
- Not re-recorded (already failing before this change, with layout drift of their own): `chapter_first_visit`, `chapter_free_20_capped`,
  `chapter_pile_left_out`, `chapter_resume` and `pro_returning_chapters`, `pro_returning_part_switch`, `pro_returning_sorted` (Night and Day). They also
  carry some of the new words; re-record them when their own drift is fixed.
- `feed_this_feed_sheet_day` is in the re-recorded list too: it differed by 13 pixels of 1 level, which is the feed's new verdict line ("Not quite. The answer is B.") seen
  through the sheet's scrim. Night did not change.

## 8. Found, not changed

- `HomeModel.coverageLine` ("31 of 46 cards seen · 4 of 10 questions tried") and `findRows` ("9 cards · about 2 min") use the dot as a list separator
  (the web's `coverageLine` is the same, section 7 of `E-APPLIED-WEB.md`; held by `home_model.json`).
- `ChapterModel.dueWords` still turns an old server's "Revise first: 46 due" into "46 due cards"; the new server line already says "due cards".
- Learn v1 (`features/learn`) says "run" in places (its own screens, behind the Learn v2 switch).
- `CoverPlayGlyph` (a play triangle) still draws before "Start · 10 min" on a cover; the word is "Start" now, the glyph was not in the table.

## 9. Checks

- `flutter analyze`: no issues.
- Full `flutter test --concurrency=4` (once, after the last code change): 12,368 passed, 127 failed. **No non-golden failure.** The 127 are golden
  images: 14 are the Learn v2 goldens that already failed before this pass (`chapter_first_visit`, `chapter_free_20_capped`, `chapter_pile_left_out`,
  `chapter_resume`, `pro_returning_chapters`, `pro_returning_part_switch`, `pro_returning_sorted`, Night and Day: measured before any edit), 1 is
  `feed_this_feed_sheet_day` (text under the scrim; re-recorded after the run, and the feed and cards golden files pass again), and 112 are in
  areas this pass does not touch (`tools` 32, `onboarding` 39, `credits` 10, `account_sheet` 10, `rhythm` 10, `art_scenes` 4, `today` 2 (the card says
  "Saved 21 days ago" where the image says 5: a date drift), `result` 2, `core/start_v13` 2, `billing` 1). The full suite was not run a second time
  after that last re-record.
- Before any edit, the focused baseline (`unit/learn2`, `unit/keycards`, `unit/learn`, `golden/learn2`, `golden/keycards`, `golden/learn`): 1,905 passed,
  14 failed (the 14 goldens above). After: the unit folders `learn2`, `keycards`, `review`, `pro_nudge`: 0 failed.
