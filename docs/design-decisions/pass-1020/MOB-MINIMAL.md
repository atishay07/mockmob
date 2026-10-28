# Mob V4: a clean Mob, easy to find and never overwhelming (20 Oct 2026, pass-1020, R8 mock-ups)

This file started as "the minimal Mob" (V3 of this pass). The owner approved that direction at 2:51 pm (D173) and asked for refinements, so this version is **Mob V4**. The V3 mock-ups are kept for comparison in `tmp/design-1020/mob-minimal/v3/`.

## Owner direction, newest first

- **D173 (2:51 pm).** Build the direction, with these changes:
  - Do **not** force fewer screens or one scroll. Several celebration screens after an achievement are fine. "Clean" means not hard to find and not overwhelming.
  - Results: version 12 had too much going on and V3 had too little. Use a short run of focused screens.
  - Refine how Mob hours is presented.
  - Think the Full mock together rule through ("maybe only people who are on the Pro plan together").
  - Keep **both** streaks visible in the Mob: the Mob's weekly one and the student's own daily one.
  - Where version 13 felt more refined, keep that refinement.
- **D171.** Mob hours: an opt-in weekly study clock, shown for his judgement and built only after his yes.
- **D170.** "Simple" means a clean presentation, not fewer features. Every approved feature stays.
- **D169.** Races and Full mock together are rows in the one Start a game sheet. Live is a Live / Anytime choice there.
- **D168.** The moat is experience: UI, UX and character motion. No app inside an app.
- **K9.** Even the owner could not tell what the Mob lets students do.

This pass is design and specification only. There is no app or web code, no commit and no deploy.

**The answer in one paragraph.** The den answers three questions at a glance:

- **who is here:** the Folds at the desk, with both streaks;
- **the one thing to do now:** one lit card;
- **where to start anything else:** the Start a game row, always in the same place.

Every format lives in one Start a game sheet, including the Full mock together rule. After a game, the student moves through a short run of focused, celebratory screens:

1. the podium;
2. everyone's moment;
3. Fix it together, when it is open;
4. each achievement as its own screen.

Only true screens appear. A typical game ends with two. The less frequent places sit one tap away in sheets: the week, your chain, the shelf, and settings.

---

## 1. Audit: the Mob as it is today (unchanged from V3)

**Sources:**

- **App:** `ui/v17-release` (`wt-1020-app-rel/flutter_app/lib/features/social/v3`), with the demo walk in `tmp/walk-1020/app-v13/r2`. A 36-shot contact sheet is in `mob-minimal/audit/`.
- **Website:** live main (`wt-1020-referrals`, head `024a889a` on top of `2ffaf29d`; `src/components/mob/v3` and `src/app/(app)/mob`).

Both were read from code and screenshots.

### 1.1 Counts

| | App (v17) | Website (main) |
| --- | --- | --- |
| **Full screens or pages** | **10**: den, no-Mob start (D0), join, game run, podium, moments, Fix it together, chains (You / Mob tabs), shelf, Mob settings | **5**: `/mob`, `/mob/chains`, `/mob/shelf`, `/mob/game/[id]` (run, podium, moments and fix views), `/join/[code]` |
| **Mob sheets and dialogs** | **14**: switcher, Start a Mob form, Fold chooser, Play with your Mob (P1), Start a game (P2), Pass the mic, Free and Pro, Exam pause days, Leave this run, Fold detail, member menu, report, change name or colour, confirm | **13** centred dialogs; no bottom sheets on the phone |
| **Overlays** | **2**: the moments overlay, the countdown | **7** |
| **Total surfaces** | **26** (30 with borrowed sheets) | **25**, plus `/leaderboard` in the Mob nav place |

### 1.2 What felt like an app inside an app

- **Chains.** It has its own header, You and Mob tabs, and a pause-days sheet.
- **Shelf.** It is a page with its own detail and change flows.
- **Mob settings.** It has nested sheets in the app, and is a long bottom section of `/mob` on the web.
- **Two start sheets.** "Play with your Mob" and "Start a game" both have Sprint tiles.
- **Inconsistent back.** Back is an X on two results screens and an arrow on a third.
- **The bar.** The shell's bottom bar vanishes on every pushed Mob screen, although a code comment says it stays.
- **Web only.** "Start another Mob" opens the old v2 form.

### 1.3 Duplicates

| Action | Entry points |
| --- | --- |
| Start a game | 4 or 5 |
| Weekly paper | 4 |
| Podium | 4 |
| Ask for a game | 3 |
| Chains | 3 |
| Step out | 2 |
| Invite | 2 separate systems. A Mob of 2 or more has no labelled invite in the app. |

### 1.4 What a first-time 16-year-old would not get in 3 seconds

1. Two streak numbers side by side, "13 days" and "3 weeks", with nothing saying whose each one is.
2. The lime Mobi icon, which reads as a logo rather than "Ask".
3. The pennant's stitches.
4. "1 more game is open", which opens a sheet that repeats the card above it.
5. Two start sheets.
6. "Runs so far: Riya, 3:44 AM ...", a list of timestamps.
7. Sprint and Your own round, which differ only by a number.
8. "51 of 60 questions": whose questions?
9. A full-screen personal chain interruption after a Mob game.
10. An unlabeled dashed seat.
11. A locked Full mock tile that does nothing.

---

## 2. Mob V4 structure

### 2.1 Surfaces, before and after

The aim is no longer the fewest screens. It is that nothing is hard to find, nothing appears twice, and each screen has one job.

| | Before (app / web) | V4 (both) |
| --- | --- | --- |
| **Places in normal use** | den, picker, start sheet, run, podium, moments, fix, chains, chain interstitial (9, two of them duplicates) | **den → Start a game → game → results run → den** |
| **Full screens** | 10 / 5 | **10:** den, New Mob (explainer and setup, first time only), game (its ready phase is the lobby, including the full mock lobby), and the results run of 3 (podium, everyone's moment, Fix it together) plus 4 achievement screens (quest done, week stitched, a Fold earned, your streak milestone) |
| **Mob sheets** | 14 / 13 | **7:** Start a game, This week, Your chain, Shelf, Mob settings, Your Mobs, Invite |
| **Small confirmations** | inside the above | **3:** Leave this run, Report, Confirm (leave, block, remove) |
| **Overlays** | 2 / 7 | **0.** The achievements became real screens; the countdown is part of the game. |
| **Total** | **26 / 25** | **20.** The web keeps `/join/[code]` as the signed-out landing. |

**The count rose from V3's 14 on purpose (D173).** Celebrations are screens again, and the personal chain has a sheet in the Mob again. The duplicates are still gone: one start sheet, one invite, one way back.

### 2.2 Where every capability lives

| Capability | V4 home |
| --- | --- |
| Sprint, Race (5 or 10 minutes), Your own round (10, 15, 20), Full mock together | **Start a game** rows |
| Live / Anytime | **Start a game**, a segmented control at the top. Full mock is "Anytime only". The live lobby is the game's ready phase, and the den's Now card says who is in the room. |
| Weekly Mob paper | A den row while unplayed, and the last row of Start a game ("Already open"). Practice → More stays as a shortcut. |
| Rematch | **Everyone's moment** screen: "Rematch" opens Start a game prefilled (`rematchOf`) |
| Ask your Mob for a game | The den Now card, when your start is used |
| Pass the mic (Pro), chapter choice | Inline in **Start a game** |
| Free and Pro in the Mob | The allowance line in Start a game, the full mock rule in its row and in the lobby, and a section in **Mob settings** |
| **Mob weekly streak** (pennant) | Den stage pennant, plus the **Week stitched** screen, plus the **This week** sheet |
| **Personal daily streak** (chain) | Den header chip "14 days", which opens the **Your chain** sheet (rest passes, exam pause days, milestones). The same component also shows in You. **Streak milestone** screen at the end of the results run. |
| Weekly quest | Den "This week" panel, plus the **Quest done** screen, plus the This week sheet |
| Mob hours (D171, pending) | Den "This week" panel, a "studying" desk state on the stage, the This week sheet, the crown and ticks on **Week stitched**, and one switch in Mob settings |
| Folds, shelf, finishes, reveal | Den shelf row → **Shelf** sheet. The **A Fold earned** screen (parcel) |
| Stickers | **Everyone's moment** screen; stickers fly in on the den stage |
| Podium (on or off), members, names, privacy, leave | **Mob settings** sheet. Report and confirm stay as small sheets. |
| Fix it together and the Wednesday check | **Fix it together** screen in the results run once the game closes, and the den Now card ("Fix question 4 together", then on Wednesday "Take the check"). Doing it uses the game runner. |
| Invite | One **Invite** sheet from the labelled open seat, the Mob-of-one card, the empty-den row, and Mob settings |
| Switch Mob, start another, join with a code | **Your Mobs** sheet from the chevron by the Mob name |
| How the Mob works (explainer replay) | The no-Mob den and a Mob settings row |
| Ask Mobi | Off the den header only. It stays on Today and inside Fix it together. |

### 2.3 What version 13 did better, kept in V4 (D173 item 6)

- **The personal chain chip in the den header.** The ring icon and figure are kept, labelled "Your chain, 14 days in a row" for screen readers.
- **The paper pennant on the wall**, with its folded corner and stitches.
- **The ruler-tick divider inside the game card.** It now introduces "Kabir and Zoya have raced it" with their heads, in place of the list of timestamps.
- **The quest parcel icon** on the quest row (the real parcel art). It hints at the Fold the quest brings.
- **The full-screen streak milestone** with the arc of day tiles, the rest-day moon, today in volt, and Mobi cheering. Version 13's design is kept as screen 7 of the results run.
- **A full-screen, lamp-lit podium** before anything else.

---

## 3. The places, with copy

Copy rules:

- Plain, warm and grammatical.
- One obvious action per screen.
- No exclamation marks, emoji or arrows.
- Never use "lost", "behind" or "last".
- Numbers carry their units.

### 3.1 The den (`den-*`, `denfull-*`, `empty-*`, `emptyfull-*`)

1. **Header.**
   - The account disc on the left, for consistency with Today and You.
   - On the right: **the chain chip ("14 days", opens Your chain)** and the gear ("Mob settings").
   - The Mob name with a chevron (opens Your Mobs), and under it "Accountancy · 4 of 5 seats".
2. **Stage: who is here.**
   - The room and its lamp pool.
   - Members stand as Folds with their first names; open seats are labelled "Open seat".
   - **The pennant** on the wall shows the week number and one volt stitch per week. The latest stitch carries the top-hours crown.
   - **Studying now** (D171): the member's Fold stands on the desk by the paper, under the lit desk lamp. A tag reads "Riya is studying, since 3:52 PM". This is real presence only.
3. **The Now card: the one thing to do now.** It shows the first that applies:
   1. A live room you are not in.
   2. Fix it together is ready.
   3. The Wednesday check.
   4. An open game you have not played: "Riya opened a sprint" / "5 Accountancy questions. Race her run any time before 3:36 PM tomorrow." / a ruler line / "Kabir and Zoya have raced it" / **Play Riya's sprint**.
   5. The weekly paper is unplayed.
   6. You played and the game is still open: "See where you stand".
   7. Nothing played yet: "Nobody has played yet" / "Start the first game. Riya and Kabir race your run any time in the next 24 hours." / **Start a game**, with Mobi pointing.
   8. Your start is used: "Ask your Mob for a game" / **Send "Again?"**
   9. A Mob of one: "Save a seat for a friend" / **Invite on WhatsApp**.
4. **Rows.**
   - First, always: **"Start a game · Sprint, race, round or full mock"**.
   - Then other open games: "Kabir's full mock · Also open · until 4:12 PM tomorrow".
   - When Start a game is already the Now card, the first row becomes "Invite friends".
5. **The This week panel** (one card, tap → This week):
   - **This week's quest.** The parcel icon, "9 more stitches week 4", **51** of 60, and a 12-segment bar in member colours.
   - A ruler divider.
   - **Mob hours.** A lamp-coloured stopwatch, "Practice time, this week", **7 h 45 m** of 10 h, a calm 6 dp bar with quarter marks, and a row of Fold heads, each with their hours and first name ("3 h 10 m, Riya"). Members who opted out or have 0 minutes are not shown.
   - **When nobody shares:** "Off for everyone. Turn on "Show my study time" in Mob settings to share yours."
6. **Shelf row.** "Your shelf · 5 of 12 Folds · next: Patang, beat your best".

The den has the dock. The game and the results run are full screen on purpose, with an X.

### 3.2 Start a game (`sheet-*`: a Pro student choosing Full mock; `sheetlive-*`: a Free student, Live, a 10-minute race)

1. **Header.** "Start a game" / "Chai Circle · Accountancy".
2. **The choice.** **Anytime · 24 hours** | **Live · together now**, with one line under it:
   - **Anytime:** "Open for 24 hours. Everyone races the runs that came before theirs."
   - **Live:** "Everyone starts together on 3, 2, 1. Anyone who misses it can play it later."
   - **Today's lock notes stay:** Live for Free members (unless they hold a passed mic), and live hours of 6 AM to 11 PM.
3. **Rows** (radio, one line each; the selected row expands):
   - **Sprint** · 5 questions · about 5 minutes
   - **Race** · as many as you can in 5 or 10 minutes · chips: 5 minutes, 10 minutes
   - **Your own round** · 10, 15 or 20 questions · chips
   - **Full mock together** · 50 questions in 60 minutes · open 24 hours
4. **When Full mock is selected (Pro),** a rule box opens under the row:
   - "Everyone in Chai Circle can sit it within 24 hours, then you compare mark sheets."
   - "**Pro members sit it free.** Free members use their free first full mock in Accountancy, then 50 credits."
5. **For a Free student,** the Full mock row is dimmed with the tag "Pro starts it", and the line "Full mocks are Anytime only. A Pro friend starts one; you can still sit it."
6. **Covers.** "The whole of Accountancy · Change" (inline), or "The full Accountancy paper" for a full mock.
7. **Key.** "Start the sprint", "Start the race", "Start the round" or "Start the full mock". In Live: "Open the room for a 10-minute race".
8. **Allowance line.**
   - "1 start left this week. Everyone plays free."
   - "With Pro you can start as many games as you like."
   - "Your start this week is used. It comes back on Monday."
   - With Pro and mics left: the row "Pass the mic · 2 left this week".
9. **Last row.** "This week's Mob paper · Already open · 10 questions" / **Sit it**.

### 3.3 Full mock together: the rule (recommendation) and the lobby (`lobby-*`)

The options:

| Option | Who starts | Who sits, and for what | Verdict |
| --- | --- | --- | --- |
| A. Pro only, together | Pro | Pro only | No. It splits the Mob: Free friends see a game they cannot play. That is the opposite of a Mob, and it hides a feature. |
| C. What is built today (`wt-1020-mob-formats-srv`, `starts.mjs`) | Pro | Everyone, free (Mob papers cost no credits) | No. A Pro friend could start a free full mock for the whole Mob every day. That makes the 50-credit price meaningless and turns the Mob into a loophole. |
| D. Pro starts; Free get one free Mob full mock a week | Pro | Everyone; Free once a week free | No. A third full-mock price rule to explain, on top of first-free and 50 credits. |
| **B. Recommended** | **Pro members start it** (never the free weekly start, never a passed mic: as built) | **Anyone in the Mob sits it** within 24 hours. **Pro: free** (Pro already includes unlimited full mocks, per `/pricing`). **Free: their free first full mock in that subject, else 50 credits**, which is the same price a full mock has everywhere else. | **Yes.** No new price, no loophole, nobody left out. It gives Pro a real hosting reason (K8 "host your Mob"), and the price is shown before anyone taps. |

**Trade-offs of B:**

- **Starting a full mock reveals that the starter has Pro.** This is unavoidable under any Pro-start rule. The copy never says "Pro" next to a person's name.
- **A Free member short of credits sees** "50 credits. You have 30, so you need 20 more." and can still see the mark-sheet comparison when it closes. Proposed: "Your marks are not on it because you did not sit it."

**The lobby (the game's ready phase), top to bottom:**

1. The room band shows who sat it ("Kabir sat it"), who is sitting it now (the desk Fold, "Riya is sitting it now"), and who has not ("Zoya, not yet").
2. "Kabir's full mock" / "Accountancy · open until 4:12 PM tomorrow".
3. The facts row: **50** questions | **60** minutes | **+5 −1** marks each.
4. The paper card "For you":
   - **Free, first in the subject:** "For you: free" / "It is your first full mock in Accountancy, so it costs nothing."
   - **Credits:** "For you: 50 credits" / "You have 120 credits. Your free first full mock in Accountancy is used."
   - **Pro:** "For you: included with Pro."
5. A dashed rule, then the general rule in one sentence.
6. "Once you start, you have 60 minutes. When the game closes, everyone's mark sheets are compared section by section."
7. The key: **Sit the full mock** or **Sit it for 50 credits**, and "Not now".

**Server work:**

- Charge at the sit tap through the existing atomic credit RPCs and the existing first-full-mock rule (C-dec 1, `FIRST_FULL_MOCK_ENABLED`), with the same action as a normal full mock (D65).
- Quote the price through the existing quote route, so the lobby line is the server's number (`costLine`).
- Nothing is charged for opening the lobby.

### 3.4 After a game: the results run (`podium-*`, `moments-*`, `fix-*`, `quest-*`, `week-*`, `fold-*`, `streak-*`)

**Rules:**

- Each screen does one job and has one key.
- An X on every screen returns to the den.
- Step dots show the true length of this run. A typical game shows 2 dots; the mock-ups show the longest run, 7.
- **Skip** on the podium jumps its animation to the end in 200 ms. Any tap does the same on every celebration.
- Only true screens appear:
  - Fix it together appears only once the game has closed and its trap is chosen.
  - Each achievement appears only if this game earned it, with the server's acknowledgement.
- Achievements earned outside a game play the same screens the next time the den opens. They never appear mid-game.

**The screens:**

1. **Reveal and podium** (full screen, lamp-lit).
   - "Riya topped the sprint" ("Riya is on top so far" while open) / "Your Mob got 14 of 20 right together."
   - The blocks unfold third, second, first, and the Folds drop onto them.
   - Fourth stands on the floor.
   - "You came 3rd with 15 marks. Places can change until 3:36 PM tomorrow."
   - **Continue.**
2. **Everyone's moment.**
   - One true line per member, with their Fold in a fitting pose and their marks on the right.
   - "Send your Mob a sticker".
   - **Continue**, and "Rematch".
3. **Fix it together** (only once the game has closed).
   - "The question that caught most of your Mob. Fix it now and it stops costing marks."
   - The answer sheet: the question, who picked B, and C marked right.
   - The path: Now, Then, Wed 28 Oct, and "If 2 of you pass Wednesday's check, it is fixed for the whole Mob."
   - **Fix question 4 together**, and "Later".
4. **Quest done.**
   - The seal stamps.
   - "Chai Circle answered 60 of 60 questions this week, together."
   - The full member-coloured bar, and each member's head with their count.
   - "The parcel for this quest is on its way."
5. **Week stitched.**
   - The pennant sways in and the new stitch glows.
   - "Week 4, stitched" / "Four weeks in a row for Chai Circle. Nobody can break it alone."
   - The Mob hours card: "Riya studied the most: 6 h 20 m. Her crown goes on week 4's stitch."
   - Ticks for each member who met their own daily goal on 5 of 7 days.
6. **A Fold earned.**
   - The parcel pulls back, wobbles, pops and leaks light, and Hop climbs out and cheers.
   - "Hop joined your shelf" / "Bounces back after a wrong one. Your Mob's first quest brought Hop to everyone in Chai Circle."
   - **Continue**, and "Sit as Hop".
7. **Your streak milestone** (version 13's design).
   - "14 days in a row" / "You practised 13 of them and rested 1. It is your best run so far."
   - "Your chain counts every practice, in the Mob and out of it."
   - **Back to the den.**
   - It shows only on milestone days or best runs. On an ordinary day, the chain chip just ticks up on the den.

### 3.5 The sheets

- **This week:**
  - the pennant, large, with a crown per week;
  - the quest per member, "What filled it", "How it counts" and "Step out this week";
  - the milestone path;
  - Mob hours per member, with the daily-goal ticks;
  - a link to Your chain.
- **Your chain:**
  - the week of ticks;
  - rest passes and the "covered by a rest pass" note;
  - Exam pause days;
  - "Hide my chain";
  - "On the way" milestones.

  This is the same component as the Chain section in You.
- **Shelf:** "Yours" and "Still to earn" with true rules and counts. Finishes, Fold detail and "Sit as" expand inline.
- **Mob settings:**
  - Show a podium; Mob name; Resting this week; Share my marks in games.
  - **Show my study time to my Mob** (D171; off by default).
  - Sound (later).
  - Members, with Report, Leave and block, and Remove inline.
  - Change my name or colour; How the Mob works; Free and Pro in the Mob; Leave the Mob.
- **Your Mobs:** the list, "Start another Mob" and "Join with a code".
- **Invite:** the WhatsApp card, "Invite on WhatsApp", "Copy the code", and "Works for 7 days, for up to 4 friends."

### 3.6 Mob hours, refined (D173 item 1)

**V3 problem:** V3 put it as a text line under the Folds. The owner found it rough.

**V4 design:**

- **Den panel.**
  - A designed Mob hours block inside the This week panel, under the quest and divided by the brand's ruler ticks.
  - The figure: **7 h 45 m**, in condensed numerals with small units, "of 10 h".
  - A calm 6 dp lamp-coloured bar with quarter marks, without stripes or glow.
  - A row of Fold heads, each with their hours and name.
- **Stage.** The "studying" desk state, with "since 3:52 PM".
- **Week stitched screen.** The weekly crown and the daily-goal ticks.

**Never:**

- a rank below the top;
- a member with 0 minutes or opted out;
- "less" copy;
- a countdown.

**Minutes:** a question counts its real answer time, capped at 3 minutes. The week starts on Monday. The switch is off by default (minors' privacy).

**Open for the owner:**

- the target (proposed: 2 h 30 m per sharing member, so 10 h for four);
- the tick rule (proposed: own daily goal met on 5 of 7 days);
- whether hours count toward anything earned (proposed: no).

---

## 4. Character life and motion: the moat

Two rules:

1. **Characters move. Chrome confirms.** The chrome keeps the app tokens (press 100, card 240, enter 360, emphasized 420 ms, no bounce).
2. **Every character beat answers a real event.**

### 4.1 The Fold rig (app and web alike)

The layers, back to front:

1. **Travel**, with the shadow on the floor.
2. **Hop.**
3. **Squash**, about the boot pivot from `folds.json`.
4. **Breathe.**
5. **Pose stack** (idle, cheer, think, shrug, wave), cross-faded in 120 ms at a squash low point.
6. **Eye windows. New: the cheapest big win.**
   - Each eye box from `folds.json` becomes a clipped window, filled with the pose's `visorColour`, that redraws that eye from the same still.
   - Moving the window's content 1 to 2.5 dp is a **glance**.
   - Squashing it to 8% for 150 ms is a **blink** of the real eye shape.

**Flutter:**

- A per-eye `CustomPainter` that paints the visor patch, then `drawImageRect` with the offset or squash, on the cached `ui.Image`.
- One `AnimationController` per act, plus the existing idle `Ticker`.
- A `RepaintBoundary` per Fold.

**Web:**

- Nested `div`s with transforms. Each eye window is `overflow:hidden` and holds the still.
- CSS keyframes for loops and WAAPI for acts.
- Pose swaps must cross-fade; today they are hard swaps.

**Proof:** the mock-ups and both motion studies use exactly this rig (`foldEl` in `src/mock.html`).

### 4.2 The den: idle and life (`motion-folds-{night,day}.webp`, 11.6 s, `motion-strip-*.png`)

| Moment | What happens | Timing | Reduced motion |
| --- | --- | --- | --- |
| **Enter the den** | Light first, then each Fold rises 14 dp with about 6% overshoot, 90 ms apart. Name tags arrive with their Fold. | Light 0 to 420 ms; Folds at 200 + 90·i, 360 ms each | 120 ms cross-fade, still Folds |
| **Breathe** | scaleY 1 to 1.028 from the boots, offset 600 ms per member | 3600 ms cosine | Off |
| **Blink** | The real eye squashes to 8% | 150 ms, every 4 to 7 s, never in sync | Off |
| **Glance** | One Fold looks at a neighbour and back | 160 ms out, 0.7 to 1.2 s hold, 160 ms back; every 8 to 14 s, one at a time | Off |
| **Micro-act** | One Fold at a time does a 3° nod, a 1.6 s think, or a 2° prop fidget. All idle stops 12 s after the last touch, under an open sheet, and in a hidden tab. | Every 10 to 16 s | Off |
| **A friend joins** (real join only) | Two hops in from the edge, then a landing squash of 1.12/0.86 for 90 ms. The seat outline folds away, the name engraves, the others glance toward the newcomer, and the newcomer waves. "Zoya joined". | About 2.3 s | Cross-fade into the seat |
| **A reaction** (a result lands, a friend tops a game) | Everyone cheers 120 ms apart: anticipation squash, a 14 dp hop, the pose swap at the low point, back to idle by about 1.2 s | About 1.7 s for four | Pose swap only |
| **Studying now** (D171) | The desk lamp's bulb (150 ms), then its beam (300 ms), come on first. The Fold hops twice to the desk (500 ms each, scaling to 0.85 for depth), lands, and swaps to think. The tag rises. When study stops, the lamp dims over 600 ms and the Fold hops back. | About 1.7 s | The lamp fades; the Fold appears |
| **Answer feedback** (game) | Right: nod-hop and cheer. Wrong: a 6° tilt and shrug (never sad). No shake, no flash. | 420 ms | Pose swap only |
| **A friend finishing** | Their pennant rises in their member colour. No haptic for others. | 280 ms | 120 ms fade |

### 4.3 The results run (`results-sequence-{night,day}.webp`, about 18 s at 15 fps; `results-strip-*.png`)

| Screen | Motion | Timing | Reduced motion |
| --- | --- | --- | --- |
| **Podium** | The title rises 10 dp. The lamp narrows, then each block unfolds (scaleY from the floor, `emph` 420 ms) in the order third, second, first, about 600 ms apart. Each Fold drops 60 dp, squashes 1.08/0.88 for 90 ms and settles on `back`. Names fade under each block. First place (about 2.2 s): the lamp swells, the foil sheen sweeps, one cheer plus a 22 dp hop, and 26 paper bits. Fourth fades in on the floor. Your line at 3.0 s, the key at 3.2 s. | About 3.5 s (brand kit T4 ceiling is 6 s); Skip lands in 200 ms | Three 120 ms fades, 300 ms apart (order kept); no particles or sheen |
| **Everyone's moment** | Rows slide 12 dp and fade, 160 ms apart. Each Fold breathes. | About 1.0 s | Fade |
| **Fix it together** | The answer sheet rises 18 dp (`emph` 420 ms). Nothing else moves while the student reads. | 0.4 s | Fade |
| **Quest done** | The seal stamps from 1.4x to 1 with a 2° settle (`back` 520 ms). 18 paper bits, then the title and bar fade in. | About 1.3 s | Seal fades in |
| **Week stitched** | The pennant swings in from −4° to +2° and settles. The new stitch glows volt; the crown and ticks sit still. | About 1.3 s | Still |
| **A Fold earned** | Brand kit moment 9. The parcel pulls back to 0.94 (120 ms) and wobbles ±3° twice. The seal pops (the pop still), light leaks, the box opens (the open still). The Fold rises 70 dp on `back` (520 ms), swaps to cheer, and hops. The name and line fade in. | About 2.4 s | Cross-fade to the Fold |
| **Streak milestone** | The 15 day tiles pop in 50 ms apart (`back`). The figure stays put. Mobi cheers. | About 1.0 s | Tiles fade together |

**Haptics:** `light` on each podium landing, `medium` on first place and on the seal, `confirm` after the server acknowledges. There is no sound until an audio package is approved (brand kit section 5).

### 4.4 Art and tools

**Still needed (same image route, no paid API):**

1. **Stamp's wave**, the only pose missing out of 60. It falls back to idle with a ±3° sway.
2. **A desk lamp still**, lit and unlit, Night and Day. The mock-ups use a vector stand-in.
3. **Optional: a seated "study" pose.** The mock-ups use think, standing on the desk.
4. **Optional: a paper crown sticker.**

**No Rive or Lottie now.** Stills plus transforms plus eye windows cover all 12 Folds on-model. Revisit Rive only for Mobi as a fully rigged host.

---

## 5. Build list

Server work for races and full mocks is on the D167 tracks (`wt-1020-mob-formats-*`). Mob hours is built only after the owner's yes.

### App (Flutter, `lib/features/social/v3`)

1. **A1 Den header** (`den_screen.dart`, `den_stage.dart`):
   - Keep the chain chip; it opens the **Your chain** sheet.
   - Remove Ask Mobi.
   - The chevron always opens **Your Mobs**, and the gear opens the **Mob settings** sheet.
   - Label "Open seat"; it opens Invite.
2. **A2 Now card** (`den_cards.dart`, `logic/den_copy_state.dart`, `copy_v3.dart`):
   - One component with the 9-step ladder (3.1), the ruler divider and the raced heads.
   - One golden per step, Night and Day.
3. **A3 Den rows:**
   - Start a game first and always; then also-open rows.
   - Remove P1 `play_picker_sheet` and the "N more games", "More ways to play" and "Start a sprint" links.
4. **A4 This week panel and sheet:**
   - The panel shows the quest (parcel icon, segments) and Mob hours (after the yes).
   - The sheet is built from the chains Mob tab.
5. **A5 Your chain sheet:**
   - Extract the chains You tab, the rest passes and the pause days into one component, used by the den chip sheet and by You.
   - Delete the `ChainsScreen` route (redirect).
6. **A6 Shelf sheet:** port `shelf_screen.dart`, with detail and chooser inline.
7. **A7 Mob settings sheet:**
   - Port `mob_settings_v3_screen.dart`, with the member menu and edit-me inline.
   - Add How the Mob works, Free and Pro (P4 content), and the study-time switch (after the yes).
8. **A8 Start a game** (`start_game_sheet.dart`):
   - The four rows, Live / Anytime on top, and "Anytime only".
   - The Full mock rule box (Pro) and the "Pro starts it" state (Free).
   - Chapter and Pass the mic inline, the allowance line, the paper row, and `rematchOf`.
9. **A9 Game:**
   - One runner for every format.
   - The race variant (countdown, answered count).
   - The ready phase is the lobby: live, and **full mock lobby with the server's cost line**.
   - The run's end goes straight to the results run.
10. **A10 The results run:**
    - A `ResultsRun` route that builds its screen list from what is true: podium, then moments, then fix if closed, then earned achievements in order (quest, week, Fold, streak milestone).
    - Step dots, X to the den, Skip on the podium, and tap-to-finish on celebrations.
    - Reuse `PodiumScreen` and `MomentsScreen` content, the moment overlay's K1 to K4 timelines (now full screens), and the chain milestone screen from version 13.
    - Achievements earned outside a game play the same screens on the next den open.
11. **A11 Invite and Your Mobs sheets:**
    - One Invite sheet everywhere.
    - Your Mobs with Start another Mob (New Mob flow) and Join with a code.
    - `/join/:code` opens the den preview with this sheet.
12. **A12 Fold life** (`fold_puppet.dart`, `mob_fx.dart`):
    - Eye windows, the micro-act scheduler and its stop rules.
    - Wire think and wave.
    - The friend-join, reaction and sit-at-desk acts.
    - Frame-strip tests per 4.2 and 4.3.
13. **A13 Mob hours** (after the yes): the server opt-in, weekly aggregates, presence, the den panel, This week rows, the switch, the desk state, and the crown and ticks.
14. **A14 Full mock together charge** (server and app):
    - Rule B: charge at the sit tap through the atomic RPCs, with first-free per subject and the quote route.
    - Change today's "sits free" behaviour in the formats track.

### Web (`src/components/mob/v3`, `src/app/(app)/mob`)

1. **W1 Den** (`den/DenV3.jsx`, `src/lib/mob/v3/denCopy.mjs`):
   - The same header (keep the chain chip), the Now ladder, the rows, the This week panel and the shelf row.
   - Move the members and settings sections into sheets.
2. **W2 Sheets** (`den/DenSheets.jsx`, `MobDialog`):
   - Bottom sheets under 768 px.
   - Delete `PlayPicker`.
   - `StartGameSheet` as A8.
   - New sheets: This week, Your chain, Shelf, Mob settings, Your Mobs, Invite.
   - `/mob/chains` → `/mob?sheet=chain` (or `week` with `?tab=mob`), and `/mob/shelf` → `/mob?sheet=shelf`.
3. **W3 New Mob flow** for "Start another Mob", replacing the v2 `StartForm`.
4. **W4 Game and results run** (`v3/play/MobGame`):
   - `?view=run|results&step=n`.
   - The results run as A10, with the full mock lobby and the cost line, the race variant, real Rematch, and the live lobby (still behind `MOB_LIVE_ENABLED`).
5. **W5 Fold life** (`den/FoldFigure.jsx`, `play/PlayFold.jsx`):
   - One Fold component, with the 120 ms pose cross-fade and eye windows.
   - Set `data-idle='off'` after 12 s and on hidden tabs (today it never pauses).
   - The acts on WAAPI.
6. **W6 Nav (owner's call).** Move `/leaderboard` out of the Mob nav place.
7. **W7 Mob hours and the full mock charge**, as A13 and A14.

**Done check for builders:**

- An emulator walk for the app (RAM rule), and a real browser at 390 and 1440 px for the web, Night and Day.
- Screenshots against this doc and the mock-ups.
- A golden or Playwright shot per ladder step, sheet state and results-run screen.
- Reduced motion checked frame by frame on the den enter, a join, the podium and the parcel.

---

## 6. Design decisions, evidence and checks

**User's job:** a 16 or 17-year-old opens the Mob tab and, in 3 seconds, knows:

- who is here;
- the one thing to do now;
- where to start anything else.

After a game, they feel the result, see their friends, know the one thing to fix, and get each earned reward its own moment.

**Alternatives considered:**

- **V3, one results scroll:** rejected by the owner ("too little").
- **Version 12 and 13, separate podium, moments and fix pages with links between them:** "too much". It stacked screens without an order and with inconsistent back.
- **V4:** an ordered run of single-purpose screens that shows only true ones. Achievements become full screens, as the owner asked.
- **Full mock:** see the options table in 3.3.

**Evidence:**

- **S014:** progressive disclosure only for secondary things. Start a game, the weekly paper, invite and both streaks stay on the den.
- **S016:** consistent navigation, with one X back from every full screen and sheets that close by drag.
- **T002, S015:** truthful progress. The step dots count only the screens that will show, and the counts are real.
- **T001:** editable defaults from real context (the subject, the last trap's chapter).
- **T005:** no loss framing.
- **T006, T008:** prices shown in place and from the server, never a monthly-versus-one-time comparison.
- **S017:** intent over decoration.

**The 12-part anti-slop test:**

1. Identity with the logo hidden: paper Folds, the lamp, stamps, the pennant and the ruler. **Pass.**
2. One primary action per screen. **Pass.**
3. True content: the fixture comes from the app, the marks add up (Riya 20, Kabir 19, You 15, Zoya 13; 14 of 20 right), and Mob hours is a proposal. **Pass, with a note.**
4. Hierarchy. **Pass.**
5. Composition. **Pass.**
6. Type by role. **Pass.**
7. Every state: the 9 ladder states, empty, a Mob of one, and the free, credits and Pro lobby. **Partial:** loading and error are not mocked; they keep the existing skeleton and D6.
8. Accessibility: 44 dp targets, labels on the chip and step dots. **Partial:** no screen-reader pass on mock-ups.
9. No pseudo-evidence. **Pass.**
10. Motion with a reason. **Pass.**
11. Metric and guardrail. **Pass.**
12. Human critique: three rounds, listed below.

**Review rounds (each PNG and strip looked at with Read; the weakest fixed):**

1. **The den.** The pennant collided with the subtitle and then with the studying tag, so it moved twice. The Start a game row fell under the dock, so it now comes first.
2. **Mob hours.** The heads wrapped to two rows and the subtitles wrapped. It became a four-column head grid with figures and small units.
3. **Full mock rule.** The rule box was cramped inside the row; it is now full width. The Free tag "Anytime · Pro starts it" was too long; it now reads "Pro starts it".
4. **Podium.** Zoya was clipped at the right, and the Day lamp looked like a smear. The podium moved left and the Day cone was softened.
5. **A render bug.** The timeline engine overwrote `translateX(-50%)` on names that only fade, which shifted the podium names and motion tags. The engine now writes a transform only for nodes that move.
6. **Quest done.** Paper bits were frozen mid-air in the still. The still is now taken after they settle.
7. **The lobby.** The note collided with the key, so the stage was shortened.

**Rubric** (0/1/2; the owner signs off):

| Dimension | Score |
| --- | --- |
| Task fit | 2 |
| Information architecture | 2 |
| Content truth | 1 (Mob hours data source unverified) |
| Hierarchy | 2 |
| Visual specificity | 2 |
| Accessibility | 1 |
| States | 1 |
| Trust | 2 (prices shown in place) |
| Motion | 2 |
| Performance | 1 (headless Chrome only) |
| Responsive | 1 (360 dp only) |
| Instrumentation | 1 |

**Metric:** the share of den opens that end in a game, paper or fix within the session, and the time to the first Now-card tap. **Guardrails:**

- the Start a game dismiss rate;
- the share who reach the results run's last screen versus who tap X on screen 1;
- the weekly reach of the This week, Your chain and Shelf sheets.

**Not verified:**

- The mock-ups are HTML at 360 x 780 dp at 2x, in headless Chrome, with the shipped art and fonts.
- Device frame rates, the cost of the Flutter eye windows, the Mob hours data source and the full mock charge path are all untested.
- The times, marks, credit balances and hours are a fixture.

## 7. Files (`tmp/design-1020/mob-minimal/`)

**Mob V4 mock-ups, Night and Day:**

- `den-*` and `denfull-*` (full scroll);
- `empty-*` and `emptyfull-*`;
- `sheet-*` (Pro, Full mock) and `sheetlive-*` (Free, Live race);
- `lobby-*` (Night: first free; Day: 50 credits);
- `podium-*`, `moments-*`, `fix-*`;
- `quest-*`, `week-*`, `fold-*`, `streak-*`.

**Motion:**

- `results-sequence-{night,day}.webp` and `results-strip-{night,day}.png`: the results run;
- `motion-folds-{night,day}.webp` and `motion-strip-{night,day}.png`: the den's Folds (idle, a friend joining, a reaction, studying now).

**Sheets:**

- `contact-sheet-{night,day}.png`;
- `before-after-v13.png`.

**Other:**

- `v3/`: the earlier minimal mock-ups.
- `audit/`: the version 13 walk.

**Sources (`src/`):**

- `mock.html`: every screen on one seekable timeline (`?s=den|denfull|empty|emptyfull|sheet|sheetlive|lobby|podium|moments|fix|quest|week|fold|streak|motion&t=night|day[&anim=1]`). `mock-v3.html` is the earlier version.
- `v4block.js`: the V4 builders, spliced in.
- `shots.cjs`: `stills`, `motion` and `anim` modes, using playwright-core with channel chrome. It always closes the browser.
- `assemble.py`: `motion`, `v4` and `v4sheets`.
- `prep.py`.

The frames were deleted after assembly; rerun `shots.cjs` to make them again.
