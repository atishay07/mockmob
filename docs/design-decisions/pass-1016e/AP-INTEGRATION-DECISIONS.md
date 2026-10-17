# App pass 1016e: integration pass (17 Oct 2026)

Branch ui/ux-social-1016 in wt-appux2. This note covers the integrator's work over AP-1, AP-2, AP-3 and the Mob (app side). Nothing here has been walked on a device: the emulator belongs to another track, so every item still needs its Night, Day and Remove-animations walk before it counts as done (device-truth rule, AGENT_RULES 34 and 36). Evidence IDs: AGENT_RULES 9, 28, 29, 30, 31; standards s8, s10; DESIGN-CRITIC #12, #25.

## Reviewed and kept
- dfd705b9 (the stop-point commit): one edit, `test/helpers/golden_harness.dart` overrides `mobRepositoryProvider` with an unread state, so the You hub renders without the Mob's database read. Complete and correct; kept.
- object_art goldens were stale, not broken: the Business Studies object is the open briefcase since ab89f591 (owner, 16 Oct), the masters still showed the stamp. Both images opened (hero Night: only the Business Studies tile differs). Regenerated.

## Built in this pass
- **AP2-03, the practice finish has no dead band.** The marks bar fills with the ink: each right bubble fills its share of the volt segment, each wrong one of the coral, each blank of the grey; the three segments keep their final places so nothing slides; full when the figure stamps. Mobi's eyes follow the newest bubble (every other one), come off the ink when the figure lands, his line still types after the stamp. Test: `marks_bar_ink_test.dart`.
- **AP3-08 A25.** The orphan "Water, pencil, rough sheet." line is gone.
- **AP3-08 A26.** Easy, Medium and Hard are drawn at 60% ink with a 12 dp lock after the word for a free student (segmented control and the 1.3x text chips). A tap does not select: the row shakes 4 dp (MmShake, 220 ms, its warn haptic) and the line under it swaps from "Balanced is the exam's own mix." to "Easy, Medium and Hard come with Pro." through MmOverlapSwitcher. No Pro tag, no upsell. A Pro student sees no lock.
- **AP3-08 A27** was already built and tested (`costLineFor` reads the quote's charge type).
- **AP3-05 A11.** Evidence links lose the appended arrow: text button in accentText, full ink while its sheet is up, the info mark stays only on "Why this?". The 0.96 press sink was already MmPressable's.
- **AP3-07 A21.** The submit legend has four 12 sp entries with glyph and count (Answered, Not answered, Marked answered, Marked not answered); the counts add up to the total.
- **AP3-06.** Mobi reacts instead of counting: "Most of this set is right. The reasons for the other 3 are below." at 6 in 10 or more right, otherwise "The reasons are below." The eyebrow now ends "finished" and the receipt under the figure is just "Recorded at 11:51 PM." The late-night "good place to stop" line moved under the pinned key (calm and good sets, late night only, once the moment has ended). The duplicate "Question 7" title in expanded rows does not exist in the code (header only); nothing to remove.

## Still open (with the reason)
- AP3-02: needs a server field for why the repair count is lower than the wrong count; the app has none. The one-Mobi guard on the full result is hand-off H-07.
- AP3-03: needs the web packet's mistake_lab copy (WP-C); not on the server yet.
- AP3-05 card 4: footer pin, mini row and the Today LengthPill need a visual pass with the emulator walk (the pill is bound to Today's DurationChoice model).
- AP3-07 A23 (stem sizes: touches every runner golden) and A24 (the 48 dp Not saved chip: `save_glyph.dart`).
- AP1: 03, 05 (token step), 06 to 09, 15, the rest of 10 and 16.
- AP2: the 5-frame goldens for AP2-04 (0, 140, 280 ms) and the runner-time test for AP2-01.
- The Mob: the paper starter hook, signed-out invite links, 1.3x goldens at 412.

## Integration check (17 Oct 2026, after the stop point)
2787be0a reviewed by area (segmented lock, difficulty picker, finish copy, marks bar ink, result foot, evidence link, submit legend): all kept, nothing reverted, nothing to finish. `flutter analyze` on the whole app: no issues. Full unit suite (-j 1, by folder): 5096 passed, 0 failed (the earlier session_store_test failure did not repeat; it is a timing test that failed under machine load). Full golden suite by folder: 1301 passed, 0 failed, no master changed (You hub, Today, router and the rest included); widget_test and device_demo: 1 passed. No emulator walk was done here (device-truth rule still applies to every item above).
