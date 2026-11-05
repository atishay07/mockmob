# UI R4, app (LK144, 20% share)

Owner, 5 Nov 2026 about 11:40 pm: more haptics, especially in the tutorial section of Mob; Explore and Learn feeds a little greener, not much.

## Haptics
Audit of the onboarding (Mobi guide) found nearly every touch already fires a haptic (ChoiceTile, KeyButton, chips, hold to seal, plan sheet). The gap was the deck's Back arrow in GuideBar: it now fires the selection haptic through MmPressable, so it respects the Touch feedback switch.

Fix stage (review): "the Mob tutorial" is the Mobi onboarding guide (the only first-run teaching flow; feature notes are inline, never a tour; SPEC-R4 says only "Haptics in the Mob tutorial and other missing places"). Every tap and gesture was listed:
- Back arrow: selection (added in the first pass, now pinned by a test, silent with Touch feedback off).
- Choice tiles, subject rows, chips, warm-up answer, rhythm slider (segment tick), plan sheet, seal (medium), sign-in age ask (light), first-move number: already fire.
- Swipe preview: the threshold crossing already ticked; added the drag verbs gestureStart when a finger takes the card and gestureEnd when it lets go (Android 11+, nothing on older phones, like Today's deck).
- Rejected: a buzz for the automatic demo nudge. taste_v15_test pins "no haptic for a demo" (an earlier decision), and an unprompted vibration is wrong.

## Brand green (existing tokens only)
- Explore pager ("2 of 14") uses colors.accentText (volt on Night, #526700 on Day).
- Feed/run progress ticks: finished segments use accentText instead of ink-2. Current fill was already volt.

- Fix stage, more visible touches: the chapter page eyebrow, the Learn home unit heading and the Explore "n chapters" count now use accentText. Still subtle; the cards and bodies stay ink.
- Night: finished ticks were the same volt as the filling segment, so they are accentText at 60% on Night (Day keeps #526700, already distinct).

## Tests
- stage_frame_test ticks pin changed to the new decision (done = accentText, dimmed on Night, not equal to the current fill).
- tutorial_haptics_r4_test: Back ticks once and not with the switch off; swipe preview plays gestureStart then gestureEnd; Night done tick differs from volt.
- Goldens under test/golden/learn and learn2 re-recorded; captures copied to tmp/r4 (chapter, home, explore, feed, Night and Day).
