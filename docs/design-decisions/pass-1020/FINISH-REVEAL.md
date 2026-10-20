# The finish screen: the mark sheet reveal (20 Oct 2026, owner K7)

**What the owner said** (after using version 13): the finish screen "is now a bit more detailed, but still not up to the level of the desktop and not exactly showing all the information we want to show: 'Your paper is saved,' 'Your score,' and the animation that runs." He also wants "a proper reveal of the mark sheets animation" when someone submits.

**The student's task:** they have just handed in a paper. They want to know three things, in this order:
1. that it is saved;
2. what they scored;
3. where the marks went and what to do next.

The student is 16 or 17, often new to CBT and to negative marking.

## What the desktop shows (the bar to meet)
The source is `wt-1020-web-release2`, main 36492ed2. The desktop has no mark-sheet reveal.

- **Hero:**
  - a receipt ("Accountancy full mock. Recorded 9:41 PM, 46m 36s.");
  - the score in marks;
  - the costliest-chapter line;
  - tiles for right, wrong and blank, each with its marks;
  - accuracy "of answered";
  - the answer map with a ripple;
  - "Do this next".
- **Below the hero:** the reel, then the full analysis: where the marks went, the mistakes, time and changes, after this mock, and answer by answer.

The app now carries all of these on the phone, and adds the reveal.

## Decisions
- **One mark sheet for every paper type.** Practice (quick, chapter, smart) gets a sheet that mirrors the mock's card 1:
  - the score in marks;
  - the marks bar;
  - the CUET scheme printed on the paper;
  - the numbered answers;
  - the same tally component as the mock (`RevealTally`), with each count's marks.

  A student who sits both kinds of paper reads one object (rule 11, consistency).
- **"Your paper is saved." is the first thing on the screen, said only when it is true.**
  - A paper stamp (the Mob parcel's stamp art) lands on the sheet with a light haptic.
  - Before the server's acknowledgement is held on the phone, the head says "Your paper is marked." and shows no stamp. The standards say never to show success before the system confirms it.
  - On the full mock and NTA, the sealed sheet now says "Your paper is saved." / "Your marks are inside. Open it when you are ready."
- **The score is in marks, not questions right.** v13 led with "6 of 10" (questions). The owner asked for "Your score", and the desktop shows marks. The figure is "27 of 50 marks"; questions right live in the tally and the accuracy. The "Finish for now" card says marks too.
- **True at every frame.** While the bubbles ink, the tally counts what is inked, and the score is the sum of what is inked: +5, −1 or 0 for each answer. The marks bar fills from the same count. A bubble counts once it is half inked, as the grid draws it.
  - Practice and mock card 1 both follow this rule. On the mock, the figure and the meter no longer roll on their own clock.
  - A unit test checks every 16 ms frame of the marking.
- **Motion** (T2 moment, MOTION.md). About 2.8 s for ten questions:
  1. The sheet is set down and stamped, 520 ms.
  2. Ten bubbles ink at 85 ms each (850 ms; a short set gets at least 600 ms, a long one at most 1 s).
  3. The score is stamped with a medium haptic. A good set on Celebrations Full gets one ring and 14 shards.
  4. The marker circles the score.
  5. The facts, Mobi's line, Marks by chapter and Mobi's read rise in, 90 ms apart, on glide or ease-out.

  A tap anywhere lands the end in 200 ms. Reduced motion, Celebrations Off and a result opened again show the end at once. TalkBack hears the score once, when it lands.
- **Next steps after the score.** The pinned keys (the repair, Your papers, Finish for now) fade in when the moment ends, as the layers below do. "Repair Q4" never names a mistake before the sheet is marked.
- **The submit page is the hand-in beat, not a second finish** (owner: "instead of it, a proper reveal"). The sheet inks, Mobi hops and "Saved to your account at 2:13 PM." lands. After 1.2 s, not 2.8 s, the reveal opens. A touch still stops it, and reduced motion still waits for the key.
- **Nothing scrolls the score away.** The v13 follow scroll moved the page so the total landed low, and the head and the score left the screen. Now it only makes sure the tally is in view, which takes no scroll at 360 by 760 at normal text size.
- **The desktop's information, on the phone:**
  - the accuracy "right of the 9 you answered", and the time with the time a question when it was recorded;
  - **Marks by chapter** for papers with two or more chapters. Each chapter shows its marks of its maximum, a bar and its counts, with the costliest first. Ties keep paper order, so no tie is claimed as a win (I14).
  - Mobi's read keeps its tie sentence and leaves the table to Marks by chapter.
  - Next steps are unchanged: the repair key, Your papers, and Finish for now.
- **Thin data:**
  - A paper left blank says "0 of 50 marks", circled in ink. Its facts say "0 answered, of 10", and its chapters "0 of 25, 5 not attempted".
  - A five-question set gets 120 ms a bubble so the eye can follow it.
  - No time is shown when none was recorded.

## Evidence
- **Research IDs and agent rules:**
  - T002 (truthful progress: the counts follow the ink, never ahead of it);
  - rule 17 (no fake progress);
  - rule 29 (numbers with units and context: "of 50 marks", "of the 9 you answered");
  - rule 31 (motion shows a state change, with a reduced-motion path);
  - rule 7 (one primary action: the foot key, unchanged).
- **Owner ledger:** K7, D108, G22, I13, I14.

## Verification
- **Frame-sequence goldens:**
  - Practice: quick 5, quick 10 (mixed, poor, blank), quick 20 great, chapter 8 and chapter 10 (good, poor, blank), at 0, 300, 700, 1100, 1500, 1900 and 2400 ms. Also settled at 360 dp in Night and Day, the whole moment on a tall page, and a skip.
  - Full mock and NTA, in four bands: from the submit (sealed, the tap, the unfold, marking, adding, landed, circled).
- **Strips:** `mockmob-next/tmp/walk-1020/finish-reveal` (iter1 to iter3, and the v13 state in before/).
- **Device-truth walk:** the demo build (profile) on `mockmob_budget` at 720x1600 and 320 dpi, which is 360 dp. Screen recordings are cut into frame strips in `emu/`.
  - Practice, Night: a good paper (38 of 50, with the burst), a poor paper, and a paper left blank (0 of 50).
  - Practice, Day: everything right (50 of 50), and a poor paper (−2 of 50).
  - Full mock, Day, 30 of 50 answered: sealed "Your paper is saved.", the open, 90 of 250 circled, and card 2.
  - NTA, Day, 5 answered: sealed, the open, and the marking, with the tally and the figure agreeing at every frame, ending on 19 of 250.
  - `WALK-settled-contact.png` shows the settled ends.
- **What the walk changed:**
  - The submit page held "Your sheet is in." for 2.8 s before any reveal (the "instead of it" in the owner's words). It now hands off after 1.2 s.
  - The pinned "Repair Q4" key named a mistake before the sheet was marked. It now waits for the score.
  - A weak set's taller foot scrolled "Your paper is saved." off the top at 360 dp. The rules are now tighter and the follow scroll is 12 dp.

## Not done
- A per-answer time map on the practice sheet. The time fold below already has it.
- A percentile. The desktop has none either.
