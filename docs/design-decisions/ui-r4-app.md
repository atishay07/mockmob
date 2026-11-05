# UI R4, app (LK144, 20% share)

Owner, 5 Nov 2026 about 11:40 pm: more haptics, especially in the tutorial section of Mob; Explore and Learn feeds a little greener, not much.

## Haptics
Audit of the onboarding (Mobi guide) found nearly every touch already fires a haptic (ChoiceTile, KeyButton, chips, hold to seal, plan sheet). The gap was the deck's Back arrow in GuideBar: it now fires the selection haptic through MmPressable, so it respects the Touch feedback switch.

## Brand green (existing tokens only)
- Explore pager ("2 of 14") uses colors.accentText (volt on Night, #526700 on Day).
- Feed/run progress ticks: finished segments use accentText instead of ink-2. Current fill was already volt.

## Tests
- stage_frame_test ticks pin changed to the new decision (done segments = accentText).
- 74 goldens re-recorded (explore, feed, run, stage, day and night); viewed feed_question_day and explore_second_cover_night.
- flutter analyze clean. unit learn2 + onboarding and golden learn2 pass.
