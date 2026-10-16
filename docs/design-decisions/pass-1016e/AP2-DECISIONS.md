# AP-2 decisions: moments (pass 1016e)

Branch ui/ux-social-1016, built 16 Oct 2026 evening. Plan: APP-PASS.md, packet AP-2. Evidence IDs follow AGENT_RULES and ui-ux-standards.

| Item | What changed | Evidence | Proof |
|---|---|---|---|
| AP2-01 (M02) clock turn | `StopwatchSim`: 160 ms lead (dial fades in, hand holds on 12), then 700 ms turn on the sweep curve (0.45, 0, 0.55, 1). `PracticeComposerKeys.clockHold` = 920 ms (under the T2 cap of 1200). One selection haptic at the tear (was medium), `segmentTick` as the hand lands on 12. NTA holds 620 ms (420 ms sheet and stamp, then 200 ms). Reduced motion: the landed frame for 300 ms. The runner's clock counts down to the server's `endsAt`, so the hold costs no time. | Owner ledger "the clock doing a 360" (15 Oct); MOTION.md 1.2 T2; rule 31 | 5-frame goldens `mock_start_lap_{0,160,400,700,920}ms_{night,day}` (opened: dial in at 160, hand at 3 at 400, past 5 at 700, on 12 at 920, both themes); unit tests in `practice_start_moments_test.dart` |
| AP2-02 (M04) calm track | `TimingTrack(calm: s.isMock)`: in a timed mock an answered cell inks over 160 ms on Motion.out, no volt flood, no half or full sweep; the ring still glides. Practice keeps the spark and the sweeps. | MockMob overlay (no distraction in exams); standards s13 | `timing_track_test.dart`: no ticker 208 ms after an answer in a mock; practice still animates |
| AP2-03 (M12) finish dead band | Not built in this window. | | |
| AP2-04 (M08) Revise | The 1.06 lane pulse is gone. A 6 dp volt dot (olive rim on Day, `MmLight.particleFill` and `particleRim`) flies from the lane the card left to the lane it entered on a low arc, 280 ms on Motion.emphasized; the two counts roll (down on the from-lane, up on the to-lane, 300 ms); the to-lane's top edge inks a 2 dp line over 220 ms that fades after 600 ms. Reduced motion: counts change in place. Deviation: the dot starts at the from-lane, not the grade key, because the key sits in another subtree; the eye still follows the card between the boxes. | Rule 31; MOTION.md 1.2 T1; standards s8 R-153 | `revise_test.dart` and `revise_golden_test.dart` pass unchanged (rest frame unchanged) |
| AP2-05 (M10) sweep in Day | `LightSweep` reads `MmLight.sweepColor` (lamp-white 30% on Night, volt 14% on Day), the same 700 ms. The celebration pool bloom is drawn only where `MmLight.glows` (no lamp radial on Day). | MOTION.md 1.4; L36 Night/Day parity | `light_sweep_golden_test.dart` (if present in the commit) |
| AP2-06 (M21) answer map | Arrival is 800 ms: 420 ms ripple, then one ink2 ring (not two coral pulses) on the first wrong answer for 380 ms. The coral cross stays. | Standards s5 and s8; PRODUCT-EXPERIENCE (no punitive moments) | `answer_map_arrival_test.dart` |
| AP2-07 (M14) wobble | No `easeOutBack` left in `lib/features/practice`. The chapter count rolls (rises into place and fades in, no scale). | Standards s10 item 6, T-105 | `grep easeOutBack lib/features/practice` is empty; practice tests pass |
| AP2-08 (M22) haptics | The onboarding row-completion tick waits 260 ms (`OnboardingFlow.inkedTickDelay`) after the tap's tick, so the user feels tick, then tock. | MOTION.md 1.6 | onboarding unit tests pass |

## Not done, and why

- AP2-03 (finish bar filling with the ink, Mobi's gaze) and the switcher migration in `composer_ticket` and `finish_stage` were not built before the 11 pm cut.
- No emulator walk: this workflow had no emulator. Device proof (screenrecord at 0.25x, Night, Day, Remove animations) is still owed for every item.
