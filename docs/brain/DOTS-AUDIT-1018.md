# Dots, pips and indicators audit (M-005), 18 Oct 2026

Read from code in the ledger-fixer worktree (ui/v15-ledger). Each row names the thing, where it is drawn, the value that drives it, and the verdict. "Real" means a live value from the student's own data; nothing here counts streaks, credits or "new" content.

| Indicator | Drawn in | Driven by | Verdict |
|---|---|---|---|
| Review count badge on the bar | `core/widgets/bar/bar_badges.dart` (`reviewCount`) | `barReviewCountProvider`, wired in `app_overrides.dart` to `reviewIndexProvider.tonight.items.length` (tonight's repair) | Real |
| Review dot on the bar | same (`reviewDot`) | a marked result whose capsule was dismissed (`barMarkedInputProvider` and `barDismissalsProvider`); hidden while the count shows | Real |
| You dot on the bar | same (`youDot`) | `barYouAttentionProvider`. Was never overridden, so it could not show. Now wired in `app_overrides.dart` to `syncStaleProvider` (`core/sync/sync_attention.dart`): true when a write has sat in the outbox for over 24 hours. Tested in `test/unit/core_data/sync_attention_test.dart` | Real, fixed in this pass |
| Colleges dot on the bar | same (`collegesDot`) | `barCollegesAttentionProvider`, never overridden. The spec ("a saved college's cutoff data changed, once per data release") needs a per-release record that does not exist: the DU files carry no release id and the app keeps no "seen" marker | Dead by default. Not wired in this pass because no honest source exists. Either build the release marker or delete the dot with the next bar change (the bar files belong to the icons packet) |
| Run pips (Learn run) | `features/learn/widgets/run_pips.dart` | `run.total` (items in the run) and `run.cursor` (items finished); the current pip is outlined | Real |
| Settling pips (run end) | same file, `SettlingPips` | the same two values, filled in order as the run ends | Real |
| Week strip circles | `core/widgets/week_strip.dart`, fed by `rhythm/logic/week_view.dart` | `rhythm.weekStart` and `rhythm.studyDayDates` from the server; today is located inside that week, never computed from a calendar guess | Real |
| Road glance pips (Today) | `features/today/widgets/road_glance.dart` `_Pips` | today's tasks done and left, days done against the weekly goal, mocks taken against the target; none are drawn when the target is unknown (`known`) | Real |
| Question strip (answer sheet and result) | `core/widgets/question_strip.dart` | one cell per question from the attempt: right, wrong, blank, changed, repaired | Real |
| Could-clear dot (Compass rows) | `features/tools/compass/programme_rows.dart` `CouldClearDot` | `couldClear(group)`: the student's score or estimate meets the programme's cutoff (the website's rule) | Real |
| Reel play dot | `features/paper_reel/widgets/reel_entries.dart` `_PlayDot` | not a status: a play glyph on a volt disc | Decoration by design |
| Onboarding guide bar | `features/onboarding/widgets/guide_bar.dart` | Back, Skip, Mobi and its speech bubble; it draws no progress dots or count, so nothing can be wrong | Nothing to audit (scaffold belongs to onboard-a) |
| Ask Mobi ink dots | `features/insights/widgets/ask_marks.dart` `InkDots` | a "thinking" animation while a reply is pending; it changes its words after 12 s (insights_robustness_test) | Honest wait cue, not a count |

Left open: the Colleges dot. Decide between building the release marker and removing the dot.
