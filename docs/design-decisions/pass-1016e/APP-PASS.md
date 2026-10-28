# App pass 1016e: motion and UI/UX (Flutter app)

Written 16 Oct 2026 (evening) by the orchestrator-synthesizer. This is a plan. Nothing here is built, pushed or deployed.

## Inputs

- **Audits.**
  - App motion audit M01 to M25, read-only, on `wt-owner` at ab89f591 plus uncommitted v12 edits.
  - App UX audit A01 to A29. A29 was cut off in transit, so it is not planned here. Re-run that one item if it matters.
- **Rules.**
  - The owner's research brain: AGENT_RULES 1-40, the MockMob overlay and the 7 PR questions. The evidence IDs are T001-T009 and S010-S018. The T IDs cover onboarding, pricing and trust; for motion, the evidence is the rule numbers and the standards IDs below.
  - `ui-ux-standards.md`: s8 motion, s10 slop list, s13 research rules, with IDs R-153, R-155, T-024, T-103, T-105, A-006, R-047 and R-202.
- **MockMob docs.**
  - `docs/brain/MOTION.md`
  - `APP-OWNER-LEDGER-2026-10-16` (L01 to L36)
  - `DESIGN-CRITIC-2026-10-16`
  - `design-decisions/app-*-1016.md`
- **Owner taste (memory).**
  - Premium, like HIGH, Revolut and Fampay.
  - Motion beyond Duolingo, judged in use.
  - Mobi tasteful: at most once per screen, and only at real moments.
  - Never simplify by cutting.
  - One primary action.
  - Real numbers with denominators.
  - Night/Day parity.
  - 48 dp targets.
  - Plain copy and 12-hour times.

## Ground rules for every packet

1. **Branch base.** Each packet gets its own worktree, cut from `ui/owner-1016` at its current tip. It commits on its own branch, such as `ui/pass-1016e-ap1`, and merges only after the v12 builders' work is committed.
   - Flutter runs only through `MOCKMOB_FLUTTER_SLOTS=2 bash tool/flutter_locked.sh <args>`, one command at a time.
   - Never push or deploy, never touch production, and never sign in as the owner.
2. **v12 ownership.** The running v12 builders own every file that is dirty in `wt-owner`. That covers today (copy, logic, data, today_body, today_screen, move_hero, road_*, today_header, colleges_card), rhythm/**, tools/**, you/**, onboarding/**, account_sheet/**, credits/**, core/router/**, core/theme/tokens.dart, core/widgets/bar/bar_glass.dart and start_key.dart, practice/widgets (choice_deck, subject_tiles, suggestion_*), result/copy.dart, result/full/full_result_screen.dart, review/copy.dart, review/data/repair_run.dart, review/widgets/tonight_card.dart and rhythm/celebration/**.
   - A packet may edit one of these files only when the change is purely motion or token values (duration, curve, opacity schedule, colour token, haptic timing). The item must be marked **[v12 file, motion-only]**, and the edit lands as a rebase on top of the v12 commit that last touched the file, never under it.
   - Any other change to a v12 file is not in a packet. Those changes are listed under "Hand-offs to the v12 builders".
3. **Disjoint files.** No file appears in two packets. Shared files (the motion token JSON, the AnimatedSwitcher lint) have exactly one owner, named below.
4. **Keep as-is.** Keep everything the motion audit marked good. Nothing in a packet may change these:
   - the bar lens travel and Start pill;
   - the Start morph Interval(0.38, 0.78);
   - runner calm (LockFlight off in timed mocks, the 60 ms ghost fade, no haptic on Next or on a wrong answer, a timer that never pulses);
   - the token pipeline, Motion.of and Reduced motion, MmSizeEase, MmOverlapSwitcher and MmSkeletonSwitcher;
   - the celebration ladder and CelebrationMode;
   - MobiRation;
   - the haptic grammar (success only after a server ack);
   - container transform and MmFlight adoption;
   - the Today hero arrival;
   - ThemeCrossFade (250 ms);
   - MmPullRefresh and the 12 s "still" words;
   - glass auto-Lite;
   - the repair ending and the NTA stamp;
   - the submit "received" sequence;
   - the Practice subject tile selection (lift, dot, lean), which the owner praised on 15 Oct.
5. **Done means proven on the device** (device-truth memory, 16 Oct; AGENT_RULES 34 and 36).
   - Every item is done only after an emulator walk on the shared rig (`tmp/rig-1016e/RIG-READY.md`: emulator-5554, PROFILE build, staging). Use screenrecord, not stills alone.
   - Walk in Night, Day and Remove animations.
   - Goldens prove composition only.
   - Report emulator numbers as emulator numbers.
   - Do not stop the rig's servers. Keep the emulator at 3 GB, and only one builder installs on it at a time. Each install takes the `adb` lock file `tmp/rig-1016e/ADB.lock`, created and removed by the builder.
6. **Per packet.**
   - A `DESIGN_DECISIONS` note (AGENT_RULES 39) at `docs/design-decisions/pass-1016e/AP<n>-DECISIONS.md`.
   - `flutter analyze` must be clean.
   - Unit and golden tests for every touched area must pass.
   - Goldens at 360 and 412 dp, Night and Day, and text at 1.3x where type is touched.
   - Run the anti-slop 12-part test and the 0/1/2 rubric over the touched screens.

## Step zero (orchestrator, before any packet merges): M01, record the motion

- **Screen.** The whole app.
- **Change.** No code. Install the current `ui/owner-1016` PROFILE build on the rig, then record the MOTION.md s7 journeys with `adb shell screenrecord --bit-rate 8M`:
  1. cold start
  2. a tab switch each way
  3. the Start sheet
  4. a quick practice of 5, with Next and Previous mashed
  5. finish
  6. the result reveal and its 4 cards
  7. repair through to Check it held
  8. a Revise run
  9. Ask
  10. the You theme switch
  11. a pull refresh
  12. an error retry (rig: flip the relay off for 10 s)
  13. a partial predictive-back swipe on result, repair, the runner leave sheet and one push page (M19)
  14. a sheet released slowly, flicked fast, and half-dragged (M18)
- **Output.**
  - `ffmpeg -vf fps=30` contact sheets at 0.25x.
  - The janky-frame % from `adb shell dumpsys gfxinfo in.mockmob.app` after each journey.
  - Files go in `tmp/pass-1016e/motion-before/`. The same walk is repeated after each packet merges, into `motion-after-AP<n>/`.
- **Evidence.** AGENT_RULES 34, 36 and 38; ui-ux-standards s11 (R-096); ledger L34 acceptance.
- **Acceptance (pass for the whole pass).**
  - Janky frames under 5% per journey on the emulator.
  - No discontinuity visible at 0.25x.
  - Remove animations leaves every journey usable.
  - The owner gets the recordings, not stills.

---

## Packet AP-1: core motion system and Today motion

**Owner area:** `lib/core/motion/**`, `lib/core/router/transitions.dart` [v12, motion-only], `lib/core/art/subject_emblem.dart`, `lib/core/art/object_life.dart`, `lib/core/mascot/**`, `lib/core/widgets/mm_sheet.dart`, `lib/core/widgets/bar/mm_bar.dart` (the generated token files are not included: they change only in step T0), and the Today motion files: `today_body.dart` [v12, motion-only], `today_screen.dart` [v12, motion-only], `hero_stage.dart`, `today_reveal.dart`, `week_ledger.dart` and `road_timeline.dart` (clean files inside the v12 Today area, motion-only). Also `review/screens/review_screen.dart` and `practice/practice_screen.dart` (scroll edges and scroll-to-top only).

**Model:** an Opus subagent for M03 and M09 (route and branch motion), Sonnet high for the rest.

### AP1-01 (M03): container transform shows cut text, and pop snaps
- **Screen.** The 8 container routes: practice setup, start, practice result, repair, milestones, result, sealed result.
- **Change.** [v12 file, motion-only] In `MmContainerTransform._window`:
  - Drive page-content opacity from the raw controller with `Interval(0.30, 0.80, curve: Motion.glide)`. The raised fill alone carries 0 to 30%.
  - Scale the page child from 0.94 to 1.0 about the origin centre while it is clipped.
  - On pop, use `reverseCurve: Motion.emphasized.flipped`, so the window decelerates into the card over 340 ms.
- **Evidence.** MOTION.md C4 (content 35 to 80%) and C8 ("no text while the shape is under 80% of its final width"); standards s10 item 1; rule 31.
- **Files.** `lib/core/router/transitions.dart`, and new `test/golden/core/container_frames_golden_test.dart`.
- **Acceptance.**
  - A frame-sheet golden (0, 60, 140, 260, 420 ms) for the result route, Night and Day.
  - A test that walks frames and asserts that while the window width is under 80% of the screen, content opacity is 0.
  - On the rig at 0.25x, no glyph shows inside a half-grown window, and pop has no hold-then-snap.

### AP1-02 (M09): a tab switch during a switch flashes
- **Screen.** Shell tab switch.
- **Change.** [v12 file, motion-only] `FadingBranchContainer`:
  - Snapshot each branch's current opacity and offset when a switch starts.
  - The outgoing branch fades from its snapshot over the remaining fadeOut share.
  - An incoming branch that was mid-fade starts from its current opacity.
  - Any third branch that is still visible fades over 90 ms instead of going offstage.
- **Evidence.** MOTION.md 1.1 Robustness ("start from the current value, nothing queues"); emil-design-eng interruptibility.
- **Files.** `lib/core/router/transitions.dart`, and new `test/unit/core_ui/tab_switch_interrupt_test.dart`.
- **Acceptance.**
  - Test: pump a switch, advance 120 ms, switch again. No branch's opacity rises between consecutive frames except the incoming branch's.
  - Rig: tap Today, Practice, Review 150 ms apart. No flash at 0.25x.

### AP1-03 (M19): predictive back (verify first, then fix)
- **Screen.** Pushed pages with custom transitions.
- **Change.** If the step-zero recording shows a route that does not scrub with a partial back swipe:
  - Give it a PredictiveBack-aware builder that drives the same `MmContainerTransform` or `MmRiseTransition` from the gesture progress, with the window shrinking toward the origin rect.
  - Use `Springs.settle` on cancel.
  - If every route already scrubs, write "verified, no change" in the decisions note.
- **Evidence.** MOTION.md C2; rule 34.
- **Files.** `lib/core/router/transitions.dart` [v12, motion-only].
- **Acceptance.** A rig recording of a partial swipe and cancel on result, repair and one push page. It scrubs, then settles back.

### AP1-04 (M13): every screen arrives the same way
- **Screen.** All `MmStagger` adopters (You, Rhythm, Practice, Review, Mistakes, Learn, Saved, Tools, Colleges, Milestones, Bests, Record, Rule book, Notification settings).
- **Change.** Change `MmStagger`'s default so adopters need no edit:
  - Index 0 (the lead: hero, number or object) rises 14 dp on emphasized over 360 ms.
  - Indices 1 and 2 fade up 6 dp, at 60 ms and 120 ms.
  - Index 3 and later arrive as one group: opacity only, 200 ms, starting at 160 ms, with no per-row rise.
  - Add `MmStagger(rise: 8)` for the Practice tab, which app-practice-review-1016 s2.8 decided at 8 dp. That one-argument change is in `practice_screen.dart`, owned here.
- **Evidence.** Standards s8 [T-024, T-112, T-114]; s13 anti-slop item 10.
- **Files.** `lib/core/motion/entrance.dart`, `lib/features/practice/practice_screen.dart`, and `test/unit/core_ui/stagger_lead_test.dart`.
- **Acceptance.**
  - Unit test of offsets and opacity at 0, 60, 120, 160 and 360 ms.
  - Rig recordings of You and Review: one lead rises and the rest settle as a group.

### AP1-05 (M15): inline count-ups are slow
- **Screen.** Inline figures: practice tiles, suggestion card, mistake map, review status, ask wallet, compass, combo, onboarding colleges, You subjects, and the website's count-ups.
- **Change.**
  - In `shared/motion-tokens.json`, set `countUp` from 720 to 420 ms on `Motion.out`.
  - Regenerate the Dart and JS tokens and the CSS variable block.
  - A screen's lead number keeps MonumentalNumber at 500 ms.
  - A refresh rolls from the old value, never from 0 (already the rule).
- **Evidence.** Standards s8 durations [R-153]; MOTION.md 1.1.
- **Files.** `shared/motion-tokens.json`, `tool/gen_motion_tokens.py` (run only), `lib/core/motion/motion_tokens.g.dart`, `src/lib/motion/tokens.g.js`, and the generated variable block in `src/app/motion-kit.css`.
- **Who does it.** The orchestrator makes this change as step T0 (WEB-PASS.md), in one commit, before AP-1 and WP-A start. Neither packet regenerates the tokens. AP-1 only checks the result on the device.
- **Acceptance.**
  - The generated-token test passes in both trees.
  - `grep countUp` shows 420 in all three generated outputs.
  - On the rig, a pull refresh on Practice rolls its tile counts in under half a second.

### AP1-06 (M05 core): the hero object floats forever
- **Screen.** Today hero emblem, and any emblem of 96 dp or more.
- **Change.**
  - `SubjectEmblem._syncIdle`: run 2 float cycles (2 x 7.2 s), then hold the top-of-float pose.
  - Resume one cycle on touch, on a tilt, or when the emblem scrolls back into view after leaving it (MmScrollLean already reports this).
  - On the Practice tab, keep the float only on the chosen subject's tile (MOTION P2-5).
- **Evidence.** MOTION.md 1.1 ("nothing loops on a resting screen"); standards s10 item 6 [T-024]; R-047 and R-202.
- **Files.** `lib/core/art/subject_emblem.dart`, `lib/core/art/object_life.dart`, and `test/unit/core_ui/object_life_ration_test.dart`.
- **Acceptance.**
  - Test: after 15 s with no input, the ticker is inactive.
  - Rig: Today held idle for 60 s shows only Mobi alive after 15 s.

### AP1-07 (M05 Today): four loops on one resting screen
- **Screen.** Today, resting.
- **Change.** One ambient life per viewport, and that one is Mobi.
  - Week ring (`WeekLedger._syncBreathe`): 3 breaths (7.2 s) after the entrance, then rest. Replay once only when today's bubble inks from a server count.
  - `MoreBelowCue`: one bob, only after 4 s with no scroll, and never while Mobi's nudge is playing.
- **Evidence.** As AP1-06.
- **Files.** `lib/features/today/widgets/week_ledger.dart`, and `lib/features/today/screens/today_body.dart` [v12, motion-only: the MoreBelowCue schedule].
- **Acceptance.** On the rig, Today held idle for 60 s with `dumpsys gfxinfo`: raster idle at least 80% of the time from 15 s on (an emulator number). Golden unchanged at frame 0.

### AP1-08 (M06): Mobi never settles
- **Screen.** Every resting screen with Mobi.
- **Change.** Add a settled idle tier in `mobi_sim`:
  - After 10 s with no touch or scroll: no saccades, a breath every 6 to 8 s, a blink every 4 to 7 s.
  - After 30 s: a still pose, blinks only, with the ticker off between blinks.
  - Any touch or scroll returns him to normal idle.
  - The first 10 s on arrival keep the current breathing.
- **Evidence.** MOTION.md 1.3 and 1.7; ledger L35; R-047 and R-202.
- **Files.** `lib/core/mascot/mobi_rig_data.dart` (idle section), `lib/core/mascot/mobi_sim.dart`, `lib/core/mascot/mobi_character.dart`, and `test/unit/mascot/mobi_settled_idle_test.dart`.
- **Acceptance.**
  - Test: frames are scheduled at 35 s only during a blink.
  - Rig: Today idle 60 s with raster idle over 80% (emulator).
  - Mobi still visibly breathes in the first 10 s.

### AP1-09 (M11 core, and the lint): bare AnimatedSwitcher flashes on the dark ground
- **Screen.** Keyed swaps app-wide.
- **Change.**
  - Migrate to `MmOverlapSwitcher.fade` (labels and messages), `.rise` (new content) or `.axis` (wizard steps). Use MonumentalNumber where a number must roll.
  - Remove the `easeIn` switchOutCurves in `week_ledger.dart` (2 sites).
  - This packet migrates its own files (`week_ledger.dart`, `today_body.dart` [v12, motion-only], `road_timeline.dart`, `hero_stage.dart`).
  - After the v12 merge, it also migrates the other v12 sites, all motion-only: `road_section` (5), `rhythm_body` (4), `week_dial` (with its easeIn), `today_header`, `college_rung` and `onboarding_flow` (3).
  - It adds the lint test last, after AP-2 and AP-3 have merged their own migrations.
- **Evidence.** The MmOverlapSwitcher doc (summed opacity never under 0.7); standards s8 [T-103].
- **Files.** Those above, plus new `test/unit/core_ui/no_bare_switcher_test.dart`. The allow-list is in the test, owned here.
- **Acceptance.**
  - `grep -rn 'AnimatedSwitcher(' lib/features` returns only allow-listed files.
  - Goldens of the touched screens are unchanged at rest.
  - A rig recording of Today week changes at 0.25x shows no dip.

### AP1-10 (M14 core): overshoot entrances
- **Screen.** Bar badge, goal editor bubble, my colleges badge, compass rows, chip flight, pop on select.
- **Change.**
  - `mm_bar.dart:1083` badge: from 0.95 with opacity 0, on Motion.out over 200 ms (or `Springs.iconPop` on the bar only).
  - The rest, after the v12 merge, motion-only:
    - `goal_editor.dart:351` elasticOut becomes `Springs.toggle` (240 ms, bounce 0.14) from 0.9.
    - `my_colleges_sheet.dart:712` becomes 0.95 plus opacity, Motion.out 200 ms.
    - `programme_rows`, `chip_flight` and `pop_on_select`: easeOutBack becomes `Springs.smooth`, or Motion.out where nothing is ticked.
  - easeOutBack stays only for a T1 tick under 12% overshoot.
- **Evidence.** Standards s8 and s10 item 6 [T-105, A-006]; MOTION.md 1.1 (bounce at most 0.12, except the bar and Mobi).
- **Files.** `lib/core/widgets/bar/mm_bar.dart`, plus the four v12 tools and rhythm files above [v12, motion-only, after merge].
- **Acceptance.** `grep -rn 'elasticOut' lib/features` returns nothing. Bar badge golden frames at 0, 100 and 200 ms.

### AP1-11 (M16): Today and Practice edges feel dead
- **Screen.** Today and Practice scroll edges.
- **Change.**
  - Remove the two `overscroll: false` overrides.
  - In `MmPullRefresh`, on `OverscrollIndicatorNotification` with `leading == true`, call `notification.disallowIndicator()`. The trailing edge keeps the Android stretch.
- **Evidence.** mobile-native skill; rule 30; MOTION.md C10.
- **Files.** `lib/core/motion/pull_refresh.dart`, `today_body.dart:693` [v12, motion-only], `practice_screen.dart:249`.
- **Acceptance.** Rig: the bottom of Today stretches, and the top pull draws only the ring.

### AP1-12 (M17): three scroll-to-top behaviours
- **Screen.** Tab reselect.
- **Change.** New `MmScroll.toTop(controller)`:
  - Over 1.5 viewports: `jumpTo(1 viewport)`, then `animateTo(0)` over 360 ms on Motion.emphasized.
  - Otherwise: `animateTo(0)` over 300 ms on Motion.emphasized.
  - It never collapses the bar and never replays entrances.
  - Adopt it on Today, Review and Practice.
- **Evidence.** MOTION.md 5 item 4; apple-design; rule 11 (S016).
- **Files.** New `lib/core/motion/scroll_effects.dart`, `today_screen.dart:175-177` [v12, motion-only], `review_screen.dart:70`, `practice_screen.dart:182`.
- **Acceptance.** A unit test of the jump threshold. Rig: from the bottom of Today, a reselect lands at the top in about 360 ms with no blur.

### AP1-13 (M18): sheets ignore the finger's speed
- **Screen.** Every `MmSheet`.
- **Change.** Wrap the drag. On release:
  - The projected position is `value + velocity * 0.12 s`.
  - Run `Motion.spring(Springs.settle, value, target, velocity: dragVelocity / sheetHeight)` on the route controller, toward open or closed by that projection.
- **Evidence.** MOTION.md C7; apple-design; emil-design-eng.
- **Files.** `lib/core/widgets/mm_sheet.dart`, and `test/unit/core_ui/sheet_velocity_test.dart`.
- **Acceptance.** Rig recording of a slow drag, a fast flick from 20% open and a half drag. A flick closes from anywhere, and a slow release returns with its momentum.

### AP1-14 (M24): a swiped row hangs, then vanishes
- **Screen.** FoldExit, saved items and swipe removals.
- **Change.**
  - After a drag: continue with the release velocity on `Springs.lift` (300 ms, bounce 0) to off-screen, then fold the height over 200 ms on Motion.out.
  - A tap-initiated removal uses Motion.out over 200 ms.
  - Retire `Motion.leave` for UI exits.
- **Evidence.** Standards s8 [T-103]; MOTION.md MmDragCommit.
- **Files.** `lib/core/motion/fold_exit.dart`, `lib/core/motion/drag_commit.dart`.
- **Acceptance.** Rig: a Saved swipe-remove keeps moving after release with no pause. Unit test that the curve is not ease-in.

### AP1-15 (M20): three live blurs while Today scrolls
- **Screen.** Today top veil (Full glass).
- **Change.**
  - One `BackdropFilter.grouped` (sigma 10) inside the shell's BackdropGroup.
  - The soft lower edge comes from the existing tint gradient, not a second blur.
- **Evidence.** MOTION.md 1.7 (at most two live blurs, one group); R-047 and R-202.
- **Files.** `today_body.dart` (TodayTopVeil, lines 735-755) [v12, motion-only; a visual-effect value change].
- **Acceptance.** Rig: profile while scrolling Today, with raster p90 at or under 8 ms (emulator). Golden of the veil within tolerance in both themes.

### AP1-16 (A03 motion part, M23): Today keeps moving after it lands
- **Screen.** Today, whole page.
- **Change.**
  - Remove `TodayReveal` from Recent papers and the colleges card; they appear in place.
  - Hero light sweep (`hero_stage.dart`): 600 ms on Motion.sweep (from 1,400 ms), first open of the day only.
  - Road Mobi walk (`road_timeline.dart`):
    - 1100 ms (from 1700).
    - Start only when 60% or more of the road is in view, and never while the header Mobi is mid-act.
    - Caption 2000 ms in total (180 ms in, 1640 ms hold, 180 ms out).
- **Evidence.** Standards s8 (one authored load moment; up to 500 ms for a milestone); MOTION.md T2 cap; rule 31.
- **Files.** `today_body.dart` [v12, motion-only], `hero_stage.dart`, `today_reveal.dart`, `road_timeline.dart`.
- **Acceptance.** Rig recording of a Today cold start: one load moment, then stillness except Mobi. A second cold start the same day has no sweep.

---

## Packet AP-2: moments (practice start, runner, finish, result reveal, Revise, onboarding haptic)

**Owner area:** `lib/core/art/hybrid/hybrid_sims.dart`; `lib/features/practice/widgets/practice_composer.dart`, `composer_ticket.dart`, `finish_stage.dart`, `marks_bar.dart`, `practice_mobi.dart`, `chapter_picker.dart`, `get_panel.dart`, `result_states.dart`, `resume_sheet.dart`; `lib/features/runner/widgets/timing_track.dart`, `runner_layout.dart`; `lib/features/result/sheet/light_sweep.dart`; `lib/features/result/widgets/answer_map.dart`; `lib/features/review/revise/revise_screen.dart`; `lib/features/onboarding/widgets/choice_tile.dart`; `lib/features/rhythm/celebration/celebration_slot.dart` [v12, motion-only: colour tokens]; `lib/features/onboarding/screens/onboarding_flow.dart` [v12, motion-only: haptic timing]; and the golden and unit tests for these.

**Model:** an Opus subagent for AP2-01 and AP2-05 (the owner's explicit moments), Sonnet high for the rest.

### AP2-01 (M02): Full mock "the clock does a 360" is invisible
- **Screen.** Practice start, Full mock and NTA.
- **Change.**
  - `StopwatchSim.lapDuration`: 0.70 s on `Motion.sweepCurve` (0.45, 0, 0.55, 1).
  - The stopwatch fades in from 0.9 to 1 over the first 160 ms.
  - `PracticeComposer.tearHold` = 160 ms (lift) + 700 ms (lap) + 60 ms (rest) = 920 ms, which is under the T2 cap of 1200 ms. State in the code comment, and test, that the paper clock reads the server start time, so the hold costs the student no time.
  - Haptics: selection at the tear (replacing the medium at about line 487), and `segmentTick` when the hand reaches 12.
  - NTA: the stamp lands at 420 ms on `Springs.settle`, then holds 200 ms.
  - Reduced motion: the landed frame for 300 ms, then the runner.
- **Evidence.** Owner words in the ledger ("the clock doing a 360", 15 Oct 20:20); app-practice-review-1016 "Full mock"; MOTION.md 1.2 T2; rule 31.
- **Files.** `hybrid_sims.dart` (lapDuration, _lapEased), `practice_composer.dart`, `composer_ticket.dart`, `test/golden/practice/start_moments_golden_test.dart`.
- **Acceptance.**
  - A 5-frame golden sheet (0, 160, 400, 700, 920 ms), Night and Day.
  - A unit test that the runner's remaining time equals server end minus now, whatever the hold.
  - Rig at 0.25x: a full turn that lands at 12 before the runner appears. The owner sees this recording first.

### AP2-02 (M04): the timing track sparkles inside a timed mock
- **Screen.** Runner, timed Full mock and NTA.
- **Change.**
  - `TimingTrack(calm: s.isMock)` from `runner_layout.dart:243`.
  - When calm: a newly answered cell inks to its answered colour over 160 ms on Motion.out. No volt flood, no half or complete sweep.
  - The position ring still glides (360 ms spring).
  - Practice keeps the spark and sweeps.
- **Evidence.** MockMob overlay ("during exams avoid distraction"); standards s13 exams; ledger acceptance ("nothing animates inside the timed paper"); MOTION.md 4.6.
- **Files.** `timing_track.dart` (lines 173 and 175), `runner_layout.dart`, golden `motion_lock_in_mock_mid`.
- **Acceptance.**
  - The golden asserts no sweep-band pixels.
  - A widget test: in mock mode, no Ticker is active 200 ms after an answer, other than the ring's.
  - Rig recording of 10 answers in a full mock: the strip only inks.

### AP2-03 (M12): a dead band at the practice finish
- **Screen.** Practice result, 0 to 1200 ms.
- **Change.**
  - Each bubble that inks adds its marks segment to the bar on the same 40 ms cadence: volt for right, coral for the marks a wrong answer lost, ink3 for a blank. The bar is full when the figure stamps.
  - Mobi takes his "read" stance from 200 ms and his gaze follows the ink (`MobiController.glanceAtWidget`). His bubble types only after the stamp.
- **Evidence.** MOTION.md 4.7 and 1.1 (three channels); standards s3 and s8.
- **Files.** `finish_stage.dart`, `marks_bar.dart`, `practice_mobi.dart`, goldens `finish_400ms` and `finish_900ms`.
- **Acceptance.** The goldens at 400 and 900 ms show a partly filled bar and no empty band over 40 dp. Rig recording.

### AP2-04 (M08): Revise does not show where the card went
- **Screen.** Revise, the four box lanes.
- **Change.** On grade:
  - A 6 dp volt dot (`MmLight.particleFill`, olive rim on Day) flies from the grade key to the target lane over 280 ms on Motion.emphasized, along a low arc (the LockFlight pattern, no tail).
  - The from-lane count rolls down and the to-lane count rolls up (MonumentalNumber, 300 ms).
  - The to-lane's top edge inks a 2 dp volt line over 220 ms, which fades after 600 ms.
  - Remove the 1.06 pulse.
  - Haptic stays tick or confirm, after the server grade.
  - Reduced motion: counts change in place, no dot.
- **Evidence.** Rule 31; MOTION.md 1.2 T1; standards s8 [R-153].
- **Files.** `revise_screen.dart` (_Lanes and _Pulse, about lines 430-530).
- **Acceptance.** Frame goldens at 0, 140 and 280 ms. Rig recording of 3 grades: the eye can follow the dot.

### AP2-05 (M10): the result light sweep is invisible in Day
- **Screen.** Result reveal card 1 (a higher result) and the celebration pool bloom.
- **Change.**
  - `LightSweep` takes `MmLight.sweepColor(context)`: lamp-white at 30% on Night, volt at 14% on Day, the same 700 ms on Motion.sweepCurve.
  - The celebration pool bloom uses `MmLight.glows()` and `rimColor` (no lamp radial on Day).
  - Do not edit `mm_light.dart`; it belongs to AP-1.
- **Evidence.** MOTION.md 1.4 (P1-1); owner Night/Day parity (L36).
- **Files.** `light_sweep.dart`, `celebration_slot.dart` (about line 184) [v12, motion-only: colour token], new `_day` goldens for `card1_reveal`.
- **Acceptance.** The Day golden at 350 ms shows the sweep band. Rig recording of a higher result in Day.

### AP2-06 (M21): the answer map's arrival is long and alarming
- **Screen.** Full result, answer map.
- **Change.**
  - Ripple 420 ms (`Motion.drawIn`).
  - Then one ring on the first wrong bubble in ink2 (not coral), 380 ms.
  - Total 800 ms or less, once per result. The mistake keeps its static coral cross.
  - Reduced motion: static.
- **Evidence.** Standards s5 and s8; PRODUCT-EXPERIENCE (no punitive moments); MOTION.md P1-6.
- **Files.** `answer_map.dart`.
- **Acceptance.** A test that the total duration is at most 800 ms. Golden frames.

### AP2-07 (M14 practice): numbers that wobble
- **Screen.** Chapter picker count, plus the practice easeOutBack sites.
- **Change.**
  - The `chapter_picker.dart:113, 234` count becomes a MonumentalNumber roll (300 ms), with no scale.
  - `get_panel`, `result_states` and `resume_sheet`: easeOutBack becomes `Springs.smooth`, or Motion.out with no tick.
  - Migrate this packet's own bare AnimatedSwitchers (`composer_ticket` 3, `practice_start_screen` 2 if present in the owned list, `finish_stage`) to MmOverlapSwitcher (M11).
- **Evidence.** Standards s10 item 6 [T-105]; MOTION.md 1.1.
- **Files.** As listed.
- **Acceptance.** `grep easeOutBack lib/features/practice` returns nothing. Goldens of the picker at rest are unchanged.

### AP2-08 (M22): two haptic clicks in one frame
- **Screen.** Onboarding answers.
- **Change.**
  - The tap tick stays at 0 ms.
  - The "inked" tick moves to when the bubble's ink lands (260 ms after the tap), and fires only for a bubble that completes a row.
- **Evidence.** MOTION.md 1.6.
- **Files.** `choice_tile.dart:81`, `onboarding_flow.dart:291-295` [v12, motion-only: haptic timing], and the haptic counter test.
- **Acceptance.** The counter test shows 2 ticks 260 ms apart. On the rig, a row completion feels like tick then tock.

---

## Packet AP-3: truth, touch and hierarchy (result recap, Mistake Lab, runner sheets, start confirm)

**Owner area:** `lib/features/result/recap/**` (card_drag, card_page, record_card, record_parts, breakdown_card, first_fix_card); `lib/features/result/full/lab_ledger_section.dart`, `full_sections.dart`, `summary_section.dart`; `lib/core/models/mistake_lab.dart`; `lib/features/practice/practice_result_screen.dart`, `result_copy.dart`, `widgets/result_question_card.dart`, `widgets/confirm_sheet.dart`, `copy.dart`; `lib/features/runner/widgets/leave_sheet.dart`, `submit_sheet_card.dart`, `question_view.dart`, `runner_meta_row.dart`, `runner_message.dart`; `lib/features/runner/screens/submit_screen.dart`; `lib/features/runner/copy.dart`; `test/unit/result/recap_honesty_test.dart`.

`result/copy.dart` belongs to v12. AP-3 makes the string changes there (A06, A11) only in a second commit, after v12 merges that file. Until then, the widgets read the existing keys.

**Model:** Sonnet high. The Lab hierarchy (AP3-04) and the card drag (AP3-01) get an Opus review pass before merge.

### AP3-01 (A05): the recap card feels like it is on a rubber band
- **Screen.** Result recap, sideways swipe.
- **Change.**
  - Track 1:1 toward a card that exists (follow 1.0, no maxShift before commit).
  - Commit at 30% of card width (about 110 dp at 384), or on a flick of 500 px/s or more in the same direction.
  - Toward nothing, rubber-band at follow 0.15.
  - Release: the outgoing card runs on `Springs.smooth` (360 ms, bounce 0.12), seeded with the drag velocity.
  - Cancel: `Springs.snappy` (220 ms, bounce 0).
  - Keep the onThreshold tick.
- **Evidence.** Ledger L34; apple-design (1:1 tracking, velocity hand-off); rule 31.
- **Files.** `card_drag.dart`, `card_page.dart`.
- **Acceptance.** A unit test that a 72 dp drag moves the card 72 dp. A rig recording of a slow drag, a fast flick and a cancel.

### AP3-02 (A06, M07): the repair count is not explained; two Mobis can appear
- **Screen.** Recap card 4 and the practice result.
- **Change.**
  - When the repair count is lower than the wrong count, name the server reason in the same line. Card 4 reads "Admission of a partner: 3 of its 4 wrong answers. 1 key is under review." (or "1 is already repaired."). The practice result reads "Repair 2 mistakes. 1 key is under review, in Review." With no server reason, keep "The other 1 is in Review."
  - M07: when the result-scope moment has `mobiHop`, the card's RecapMobi steps out, mirroring `repair_ending_screen`'s guard.
- **Evidence.** DESIGN-CRITIC #6 and #16; the owner's rule of real numbers with denominators; AGENT_RULES 9, 17 and 29 (S017); MOTION.md 1.3 (one Mobi per screen).
- **Files.**
  - `record_card.dart` (lines 252-261), `practice/result_copy.dart`, `recap_honesty_test.dart`.
  - A case in `test/unit/mascot/mobi_moments_one_per_screen_test.dart`. This test file is not v12-owned; AP-3 owns it for this pass.
  - The `full_result_screen.dart` guard is a hand-off, H-07.
- **Acceptance.**
  - An honesty test asserts the reason clause whenever repairCount is less than wrongCount.
  - The one-Mobi test passes for a first-full-mock result.
  - Rig: the staging full mock (32 wrong) shows a consistent card 4.

### AP3-03 (A07, A08): Lab sub-remarks and numbers that fight
- **Screen.** Mistake Lab (full result).
- **Change.**
  - The three 12 sp method paragraphs become one 48 dp row, "How this is counted", which opens a sheet with the same sentences.
  - Keep one in-flow truth line only after the cohort line: "(answers from 10 or more students)".
  - Changed answers become one net line with its parts: "Changing answers: lost 12 marks on 2, won back 7 on 3. Net cost 5 marks."
  - Then: "First picks: 144 of 245. Final answers: 139 of 245 (1 question under re-check left out of both)."
  - The text comes from the server. The web packet WP-C changes `data/mistake_lab.copy.json` and the builder, so web and app match. AP-3 renders what the server sends and does not hard-code the sentences.
- **Evidence.** OWNER-VISION-2026-10-15-PM ("sub-remarks are not acceptable"); DESIGN-CRITIC #6 and #8; AGENT_RULES 9, 10 and 29 (S014); standards s10 item 13.
- **Files.** `lab_ledger_section.dart`, `core/models/mistake_lab.dart`.
- **Acceptance.**
  - A golden of `lab_ledger_ready` at 360 dp, Night and Day: no grey paragraph block, and the net line adds up.
  - A contract test against the WP-C fixture.

### AP3-04 (A09, A10): a flat Lab hierarchy and small chips
- **Screen.** Mistake Lab.
- **Change.**
  - Hero: "112" at the recap's display numeral (56 sp condensed), with "marks missed, of 250" at 16 sp. "Mistake Lab" becomes a 13 sp ink2 eyebrow.
  - The ledger bar grows from 8 to 12 dp with 2 dp gaps.
  - Tapping a segment glides to its row (300 ms, Motion.glide) and lifts the segment 2 dp. Keep the split motion: 120 ms lead, 180 ms per segment, 60 ms step.
  - Question chips: 48 dp hit height (visual 40 plus 4 on each side), 8 dp gaps, 14 sp tabular label.
- **Evidence.** AGENT_RULES 9, 25, 28, 30 and 36 (S016 target size); owner direction (HIGH and Revolut hierarchy).
- **Files.** `lab_ledger_section.dart`, `full_sections.dart`.
- **Acceptance.** A hit-rect test at 360 dp (every chip at least 48 dp). Golden at 1.3x text. Rig tap on a segment.

### AP3-05 (A11, A12, A13): arrows, a hole, and two dialects of one control
- **Screen.** Recap cards 2 to 4 and the full result summary.
- **Change.**
  - Drop appended arrows. Each link becomes a 48 dp text button in accentText with press scale 0.96 (100 ms): "See the wrong answers", "See the 6 questions", "Continue the recap (card 3 of 4)".
  - Card 4:
    - Pin the footer (chapter line, primary, "Choose something else").
    - Lay content from the top with 24 dp gaps.
    - Fill the freed space with the chapter's wrong-answer mini row from card 3 (40 dp bubbles).
    - If space is still short, the gap goes above the headline (40/60), never between controls.
  - Card 4's 5/10/15 segmented box becomes the Today LengthPill, imported from `features/today/widgets/length_pill.dart` and not moved. The panel motion: grow from 0.94 on Motion.emphasized over 200 ms, exit on Motion.exit.
- **Evidence.** Standards s10 item 11; DESIGN-CRITIC #5, #10 and #17; ledger L36; AGENT_RULES 28 and 30.
- **Files.** `breakdown_card.dart`, `first_fix_card.dart`, `summary_section.dart`, `record_card.dart`, `record_parts.dart`. The arrow strings in `result/copy.dart` change in the second commit, after v12.
- **Acceptance.** card4 goldens at 384x853, Night and Day: no empty band over 48 dp. `grep '→\|->' lib/features/result` returns nothing in strings. Rig.

### AP3-06 (A14): the same count three times
- **Screen.** Practice result.
- **Change.**
  - Mobi's bubble reacts instead of counting: "Most of this set is right. The reasons for the other 3 are below." (6 or more right), otherwise "The reasons are below."
  - Fold the finish line into the eyebrow ("Accountancy practice, Admission of a partner, finished").
  - "That is a good place to stop for tonight" moves under the CTA as the "Finish for now" line, late night only.
  - Drop the duplicate "Question 7" title in expanded rows.
- **Evidence.** DESIGN-CRITIC #25; PR question 2; ledger L28.
- **Files.** `practice_result_screen.dart`, `result_copy.dart`, `result_question_card.dart`.
- **Acceptance.** Goldens `result_mixed` and `finish_settled`. A test that the count appears once above the list.

### AP3-07 (A20 to A24): runner sheets in a timed paper
- **Screen.** Runner: leave sheet, submit sheet, after submit, stem size, save status.
- **Change.**
  - **A20.** Timed or NTA leave sheet: no Mobi. It shows the title, "The clock keeps running. You can continue until 11:42 PM." with a real end time, "Keep going" (primary) and "Leave the mock". Practice keeps Mobi.
  - **A21.** The submit grid legend has four 12 sp entries, each with its glyph and count ("Answered 45", "Not answered 3", "Marked, answered 1", "Marked, not answered 1"). The counts add up to the total, and the legend wraps to 2 lines at 360.
  - **A22.** "Your sheet is in" auto-advance: a 2 dp volt line fills along the bottom edge of "Open your sheet" over 2,800 ms (linear). Any touch cancels it, with a 120 ms fade. Reduced motion: no auto-advance.
  - **A23.** Stem sizes become 26 sp (100 characters or fewer), 22 sp (up to 200) and 19 sp (beyond), height 1.3, w600. Slack goes above the stem.
  - **A24.** Not saved: a 48 dp chip (refresh glyph, 13 sp "Not saved. Retry", amber outline). On success it swaps to "Saved" through MmOverlapSwitcher over 200 ms, with a light haptic after the server ack.
- **Evidence.** MockMob overlay (protect timer, persistence and submitted-state clarity; avoid distraction); ledger L35; AGENT_RULES 9, 29, 30 and 31; standards s10 item 14 (S016).
- **Files.** `leave_sheet.dart`, `submit_screen.dart`, `submit_sheet_card.dart`, `question_view.dart`, `runner_meta_row.dart`, `runner_message.dart`, `runner/copy.dart`.
- **Acceptance.**
  - A test that there is no MobiCharacter in the leave sheet when `session.isTimed`.
  - A legend sum test.
  - A test that touch cancels the hand-off.
  - A test of the 48 dp chip hit-rect.
  - Rig: a full mock on staging. The orchestrator confirms the staging top-up first, since the full mock costs 50 credits.

### AP3-08 (A25, A26, A27 sheet part): the start confirm sheet
- **Screen.** Start confirm (full mock and chapter).
- **Change.**
  - **A25.** Delete the orphan "Water, pencil, rough sheet." line (`PracticeCopy.sheetAside`).
  - **A26.** Locked difficulty for free students:
    - 60% ink, with a 12 dp lock after the word.
    - A tap does not select. It shakes the row 4 dp (`core/motion/shake.dart`, 220 ms) and swaps the helper to "Easy, Medium and Hard come with Pro."
    - No upsell CTA. Pro students see no lock.
  - **A27.** The cost line states exactly one truth, read from the quote's charge type: "Included with Pro", "Free today", or "50 credits. You have 120." only when credits are really spent. The Start sheet tile string is hand-off H-09.
- **Evidence.** DESIGN-CRITIC #12; L28; AGENT_RULES 19, 21, 22, 23 and 30 (T006, T008, T009); owner differentiator (unlimited mocks, truthful).
- **Files.** `confirm_sheet.dart`, `practice/copy.dart`.
- **Acceptance.** A unit test that the cost line equals the server quote's charge type for Pro, free-allowance and credits fixtures. Golden `confirm_mock` at 360, Night and Day.

---

## Hand-offs to the v12 builders (not in a packet, because they change v12 files beyond motion)

Send these to the wt-owner lead as a list. Each carries its audit ID and evidence.

- **H-01 (A01).** Road flag discoverability.
  - A two-beat tour, once per install in prefs: glide to the flag over 650 ms on emphasized, scale the flag 1.06 over 240 ms with a selectionClick, hold 500 ms, then glide back over 520 ms on Motion.out.
  - A one-time 13 sp hint, "Drag the CUET flag to set your date".
  - Files: `road_rail.dart`, `road_section.dart`, `today/copy.dart`. Evidence: L05; rules 10 and 31.
- **H-02 (A02).** Rail micro type rises from 11 to 12 sp. The rail grows from 152 to 160 dp, the rows from 26 to 28, and the flag to 48x44. Add goldens at 360, 412 and 1.3x. Evidence: DESIGN-CRITIC #23; rules 30 and 36.
- **H-03 (A04).** The Today error ladder (app-today-1016 4.1): no error UI when attempts are in hand; the in-card time; "Try again" and "Practise anyway"; Mobi oops once. Regenerate `today_error_*` and add the S6 and S10 goldens. Evidence: L01.
- **H-04 (A15, A16).** One dot per wrong answer, up to 5, then "+N"; never cap below the hero number. Drop the second "tonight".
- **H-05 (A17, A18).** One glide to the road (520 or 360 ms), with the road built ahead (cacheExtent 1200). Peek only on the first 2 visits (prefs). Flag settle on `Springs.snappy`, seeded with the velocity.
- **H-06 (A19).** Retire the board tiles and the read-only timeline from the tree, so each value has one editor ("This week: 3 of 4 study days done"). Evidence: L05 and L06.
- **H-07 (M07 full result).** Mirror the one-Mobi guard in `full_result_screen.dart` (lines 248-300).
- **H-08 (A28).** One name per mode: "Quick 10" where fixed at 10, "Quick practice" where the length is chosen, and "Repair the next mistake" everywhere. Sheet titles via `titleFor`. Files: `quick_start.dart`, `alternatives_sheet.dart`, `today/copy.dart`.
- **H-09 (A27 tile part).** The same cost string on the Start sheet tiles (`quick_start.dart`).
- **H-10 (A06 and A11 strings).** If v12 is still editing `result/copy.dart` when AP-3 is ready, the v12 lead applies AP-3's string list there instead.

## Owner decisions (ask; do not build)

- **D-A1 (M25).** Pull to refresh: should content follow the finger at 0.35 resistance up to 24 dp, with the ring drawing in the gap (option A), or stay as built (option B)? This is tagged [I] because it reverses MOTION.md C10. Show him two rig recordings.

## Order and pace

1. Step zero (M01) runs now on the rig, about 40 min.
2. AP-1, AP-2 and AP-3 start in parallel in three worktrees, since their files are disjoint. The items marked [v12, motion-only] wait in a second commit until the v12 commit lands.
3. Merge order: AP-2, then AP-3, then AP-1. AP-1 is last because it adds the switcher lint over everything.
4. After each merge: the step-zero walk again, plus a visual critique at 360 and 412, Night and Day (memory: every deploy passes tests and a visual critique).
