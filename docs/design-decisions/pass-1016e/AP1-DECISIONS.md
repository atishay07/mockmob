# AP-1 decisions: core motion system and Today motion (16 Oct 2026, 11 pm build)

Branch `ui/ux-social-1016`. Commits 26637f46, 9784153d, e1814c37 and the golden commit after them. There was no emulator in this run, so nothing here has been proven on a device yet (rule 34). Goldens only prove composition.

## Built

| Item | What changed | Evidence | Proof |
|---|---|---|---|
| AP1-01 (M03) | Container window: content opacity follows Interval(0.30, 0.80, glide) on the raw controller, and is held at 0 while the window is under 80% open. The page scales 0.94 to 1 about the origin's centre. Pop runs on Emphasized flipped (340 ms), so it decelerates into the card. | MOTION.md C4, C8; s10 item 1; rule 31 | `test/unit/core_ui/container_frames_test.dart` |
| AP1-02 (M09) | Tab switch is interruptible. Each switch snapshots the opacity and offset of every visible branch. Outgoing branches fade from that snapshot over the out share. A third branch fades instead of vanishing. A branch called back mid-fade continues from its current value. | MOTION.md 1.1 Robustness | `tab_switch_interrupt_test.dart`, plus the existing `tab_handover_test.dart` |
| AP1-04 (M13) | MmStagger default: the lead rises 14 dp over 360 ms on Emphasized. Items 1 and 2 fade up 6 dp at 60 and 120 ms. Items 3 and later arrive as one opacity-only group (200 ms from 160 ms, on Out). `MmStagger(rise: 8)` is set on Practice. Route-driven groups also merge from index 3. | s8 [T-024, T-112, T-114]; s13 item 10 | `stagger_lead_test.dart` |
| AP1-10 (M14 bar) | Bar badge arrives from 0.95 and clear, on Out over 200 ms. It no longer comes from 0.6 on a bouncing spring. | s8, s10 item 6 [T-105, A-006] | bar goldens unchanged at rest |
| AP1-11 (M16) | `overscroll: false` removed from Today and Practice. MmPullRefresh blocks only the leading indicator, so the bottom edge stretches and the top edge draws only the ring. | rule 30; MOTION.md C10 | |
| AP1-12 (M17) | `MmScroll.toTop`: past 1.5 viewports it jumps to 1 viewport, then glides 360 ms; otherwise it glides 300 ms, on Emphasized. Reduced motion jumps. Used on Today, Practice and Review. | MOTION.md 5 item 4; rule 11 (S016) | `scroll_to_top_test.dart` |
| AP1-13 (M18) | `MmSheetRoute` keeps Flutter's 1:1 drag and its close rules. A close that follows a drag runs on Springs.settle, seeded with the finger's release speed (a pointer listener outside the arena reads it). Keys and the scrim keep the drawer close. | MOTION.md C7; apple-design | `sheet_velocity_test.dart` |
| AP1-14 (M24) | FoldExit: slide and fade 200 ms on Out, then the fold 200 ms on Out. Motion.leave (ease-in) is retired here. The drag release already carries its velocity on Springs.lift (drag_commit), so that is verified with no change. | s8 [T-103] | existing primitives tests |
| AP1-16 (M23, timings) | Hero sweep: 600 ms band after a 300 ms wait (it was 1400 ms in total). Road Mobi walk: 1100 ms (from 1700). Road caption: 2000 ms (180 in, 1640 hold, 180 out). | s8; MOTION.md T2 cap | `today_open_frames` goldens regenerated and opened at Night and Day |

## Not built in this run (next)

- **AP1-03.** Predictive back. It needs the step-zero rig recording first.
- **AP1-05.** countUp. This is the orchestrator's T0.
- **AP1-06, AP1-07, AP1-08.** Idle loops and Mobi's settled tier. Each needs a device gfxinfo proof.
- **AP1-09.** Switcher migration and the lint.
- **AP1-10 v12 sites.** goal_editor, my_colleges_sheet, programme_rows, chip_flight and pop_on_select.
- **AP1-15.** Grouped blur.
- **AP1-16, the rest:**
  - removing TodayReveal from Recent papers and colleges;
  - starting the walk only with 60% of the road in view;
  - limiting the sweep to the first open of the day (it is still once per app run).

## Known test noise from other packets

When the full run happened, these failures came from other packets' work in the same worktree, not from AP-1 files:
- `test/golden/art/object_art_golden_test.dart` (about 2.9%), from the uncommitted `hybrid_sims.dart`.
- `test/unit/you/*`: MissingPluginException on getTemporaryDirectory.
