# Mob v3, direction "Den Arena" (19 Oct 2026, evening)

Opus design and motion pass for the owner's 4:38 pm and 4:42 pm notes: "a lot more premium, refined, and gamified, with animations more thought through", "motion graphics and the entire motion design play a crucial role", "give it a brand identity of Mockmob". Inputs: `../RESEARCH-GAME-SYSTEMS.md` (streaks, Free and Pro, live play), `../BRAND-MOTION-KIT.md` (brand and motion language), Den v2 and Arena v2 with both judges' notes, and the generated cast in `NEXT/tmp/design-1019pm/mob-v3/characters` (style C, see its `LEDGER.md`).

Nothing is built in Flutter, nothing is committed or deployed, and no paid call was made. All names and numbers are an illustrative fixture that agrees with itself on every screen.

## Files
- Prototype: `prototype.html` in this folder. It is clickable and self-contained (no network). Open it in Chrome. The side panel lists every screen and every moment. Primary keys walk the loop, and any tap skips a playing moment to its end in 200 ms. Use `?rm=1` (or the system setting) for reduced motion, and `?s=<screen>&m=<moment>` to deep-link. Assets load from `assets/`: `assets/art` holds the app's own art and the logo SVGs, and `assets/chars/<key>.webp` holds the cast, listed in `assets/chars/manifest.js`. To swap a character, replace the file. With no file, it falls back to the Den v2 paper folk in `assets/chars/fallback/`.
- Screens: `NEXT/tmp/design-1019pm/mob-v3/design-arena/`. There are 24 screens, each at 360 x 780 with deviceScaleFactor 2, in Night and Day (48 PNGs). Start with `CONTACT-SHEET.png`, then `CONTACT-SHEET-night.png` and `CONTACT-SHEET-day.png`.
- Motion: `NEXT/tmp/design-1019pm/mob-v3/design-arena/motion/`. Each of the 12 moments has:
  - a real-time `<moment>-night.webm`;
  - a 20 fps animated `<moment>-night.webp`;
  - `strip-<moment>-night.png` and `strip-<moment>-day.png`.

  Also in the folder:
  - Day animations for the podium and the reveal (`podium-day.webm/.webp`, `characterReveal-day.webm/.webp`);
  - reduced-motion strips (`strip-*-night-rm.png`, six moments) and `podium-night-rm.webm`;
  - `MOTION-SHEET-night.png`, all 12 strips stacked.
- How the video was made: Playwright's `recordVideo` needs Playwright's own ffmpeg build. That build is not on this PC, and downloading it needs the owner's permission. So each webm is a CDP screencast of the real-time playback, re-timed into VP9 by Chrome's own MediaRecorder. The measured playback matched the spec within 10 ms (podium 4805 ms for 4800, countdown 3004 ms for 3000). The animated WebP files and strips come from deterministic, seeked frames of the same timeline.

## 1. The concept
**The Den is home; every game is an arena on the same desk.** A Mob's home is a lamp-lit room (the app's own generated scene) where the four paper folk stand in the lamp's pool, the Mob's chain hangs on the wall as a stitched paper pennant, and the shelf holds what the Mob earned. When a game starts, the light changes and the desk becomes an arena: answer-sheet lanes with OMR bubbles for the race, a stopwatch for the 3, 2, 1, paper-stack plinths for the podium, a parcel that unfolds for an earned character, a seal that stamps a finished quest, and a needle that sews the week onto the pennant.

The brand comes from one sentence in the kit: *a lamp-lit exam desk where friends sit with folded paper, and the volt light goes on for whoever earned it.* Every screen uses at least three of these:
- paper (folk, pennant, plinths, parcel, chain links, stickers);
- stamps and seals (three-in-a-row stamp, quest seal, den stamps);
- lamp light (the light comes first in every moment);
- one volt light (the key, or the thing just earned);
- exam stationery as UI (OMR bubbles, stopwatch, desk bell, needle and thread).

There are no coins, gems, chests, rainbow confetti, hearts, ranks below third, red alarms, or shake on a wrong answer.

**Story (his 4:42 pm ask for "some storytelling"), kept light.** The world is *The Fold*: one endless strip of paper (unlimited mocks from one bank). Every mistake leaves a crease. When a Mob fixes one and the fix holds, a paper friend unfolds from it, and Mobi keeps one lamp on for anyone still working. The story lives in three places only:
- the names and one line per character;
- the pages a student earns at chain milestones ("Page 2 of The Fold: The lamp stays on");
- the unfold reveal, which is also the natural format for Reels.

No cutscenes, and no lore needed to read a screen.

## 2. The game loop
**A sitting (3 to 10 minutes).**
1. Open the Mob tab. The den shows who is in the Mob and, only from real data, who played the open game or is here now.
2. One key plays the most useful game: a friend's open sprint, or a live room when one is open.
3. Play it live (shared 3, 2, 1, lanes show where friends are, never what they picked) or later (ghosts of friends' real runs).
4. Results: the podium by CUET marks, everyone's moment, the question the Mob missed most with "Fix it together", a preset sticker, and "Ask for a rematch".
5. Every answered question feeds the weekly quest and your chain.

**A week.**
1. Monday a quest appears: answer 60 questions together in Mob games, sized 15 per member.
2. A parcel shows, in advance, the silhouette of the character inside, so nothing is a draw.
3. When the bar fills, the seal stamps, the parcel opens, and the needle sews a week onto the Mob's pennant.
4. The shelf keeps what you earn.

**A season.** Chain milestones give rest passes, pages of The Fold and foil editions. Mob chain milestones give den objects (desk bell at 4 weeks) and a character (Stamp at 8). Nothing can be bought.

Fixture (Thursday 22 Oct): Chai Circle, Accountancy.
- Aarav (you, Free, started the Mob), Riya (Pro), Kabir, Zoya.
- Riya's 5-question Goodwill sprint was opened at 2:05 PM, played by Riya (2:10 PM), Kabir (4:55 PM), Zoya (6:30 PM), and you (8:40 PM).
- Marks: Riya 20 (4 right, 1 skipped), you 19, Kabir 19 (4 right, 1 wrong), Zoya 13.
- Quest: Mob paper 37 + sprint 14 = 51 before you, 56 after you, 70 after Riya's live rematch (Riya 5, Kabir 5, you 4). The quest needed 60.
- Your chain: 14 days (13 practised, 1 rested on 14 Oct). The Mob chain goes from 3 weeks to 4.
- The prototype checks the marks, the quest sums and the ghost positions in code.

## 3. The streak system (from RESEARCH-GAME-SYSTEMS section 2, drawn)
Two chains. Never one fragile number.

**Your chain, in days** (screen S3, moment "streakMilestone"; private).
- A day counts at 5 answered questions, in any mode, by IST day.
- Rest passes are earned:
  - one as a gift on day 3, then one every 7 days;
  - one for every 3 fixes that pass the Wednesday check.
- You hold 2 (3 in the final stretch). A pass is used for you on a missed day. Pro changes nothing about passes.
- Make-up: within 48 hours of a miss with no pass left, 10 questions repair the chain. It is free on every plan, once every 14 days.
- Exam pause: up to 14 days that the student sets.
- "Hide my chain" switches it off.
- The calendar shows practised days (paper disc with a tick), the rested day (a moon in a dashed ring) and today (the volt disc).
- The milestone path: 3 rest pass, 7 rest pass, 14 page 2, 21 rest pass, 30 Foil Dart, then 50, 75, 100, 150.

**The Mob's chain, in weeks** (screens S4 and S19, moment "streakExtend"; owned by the group).
- A week is stitched when the Mob finishes the weekly quest.
- The quest counts questions answered, not marks, so a weaker member is never dead weight.
- A member can "Step out" for a week. The quest resizes, without naming anyone.
- The Mob earns a week pass every 4 weeks.
- Milestones: 2 den stamp, 4 desk bell, 8 Stamp joins the shelf, 12 lamp theme, 20 foil seal.
- A missed week quietly starts again, with the best run kept on show.
- Never: a countdown, a warning, a droop, a push, "waiting on you", or a daily pair streak.

## 4. Free and Pro (fair, visible, generous)
Rules both plans live under:
1. Participation is free.
2. Safety is free (chains, passes, make-up, blocking).
3. Marks are equal.
4. Collectibles are earned, never bought.
5. Free sees every Pro item, locked, with a one-line reason.

The Mob never shows who has Pro, because a friend's paid status is not other members' business. Copy says "Anyone in your Mob with Pro", never a name. S6 is drawn on Riya's phone, so it says so in a design note, not in the UI.

| | Free | Pro |
|---|---|---|
| Play every game anyone starts, as often as you like | yes | yes |
| Weekly Mob paper, in every Mob (proposal: lift today's "one a week across all Mobs") | yes | yes |
| Chain, rest passes, make-up, exam pause, milestones | same | same |
| Podium, marks, Fix it together, stickers, characters, shelf | same | same |
| Join 12 Mobs; start 1 Mob | yes | start 3 |
| Study room (shared 25-minute timer, no marks) | can start (needs his yes) | can start and schedule |
| Ask your Mob for a game (preset "Again?" sticker) | yes | yes |
| Start games: sprint, race, live room, your own round, rematch | locked, visible | yes |
| Full mock together, exam-hall rehearsal | locked, visible | yes |
| Mob insights, every week side by side with seconds, past weeks, season recap | last week only, one-line summary | full |
| Pass the mic: let a friend start one game, twice a week | receive | give |

Price is not shown in the Mob. "See Pro plans" opens the existing paywall, which owns the real price and terms. That also avoids the Rs 99 web versus Rs 150 Play wording problem.

**Needs his yes, with my recommended default:**
1. While billing is off, anyone may start games. Otherwise nobody can start one at launch. The research's billing-off dead end stands, and S5 assumes billing is on.
2. Study room startable by Free.
3. Pass the mic.
4. The first game of a new Mob is free to start.
5. Lift the one-paper-a-week Free limit.

## 5. Live and async rules
- **Live** is a shared server-clock start and shared presence, not a forced pace. Each lane shows a friend's question number only, with a pennant when they lock in or finish. It never shows what they picked or whether they were right.
- **Your own feedback (new rule, needs his yes).** In sprints and races you see right or wrong for yourself after you lock in, with +5 or -1. The correct option and the why stay closed until the room closes for everyone, so a friend who has not played cannot be handed the answer. The weekly Mob paper and exam-hall rehearsal show nothing until the end, as mocks do.
- **Three in a row** is celebrated once with a paper stamp. There is no counter that can break and be mourned.
- **Async:** every live room has a 24-hour twin, so "Play it later, until 8:52 PM tomorrow" is always offered. Friends who played earlier race beside you as ghosts at their real recorded pace, labelled with name and time. The pace chip compares your arrival at your current question with the nearest friend's ("4 s ahead of Kabir"). It flips truthfully during the ghost-race moment: you are 4 s behind on question 2 and 4 s ahead on question 3. There are no bots, and nobody is shown as here without a presence entry.
- **Results** open only when everyone has played or the window closes. Before that, the podium is labelled "so far" (Den v2 S4c rule, unchanged).
- **Build path:** private Supabase Realtime channel per room, with broadcasts that carry only memberId, state and question index. Marks stay in Postgres (research section 4.2). Live is cost L and is not in the first async build. The async loop, ghosts, podium, quest and chains all run on existing tables plus small additive ones.

## 6. Screens, exact copy, and the R2 line
R2: "What does a first-time student think this screen wants from them?" The bottom bar is the app's own (Today, Practice, Start, Mob, You), unchanged per the owner's H5.

**S1 The Den, quiet (8:40 PM).**
- Header: "Chai Circle", "Accountancy, 4 of you", a chain chip "13 days", and Ask Mobi.
- Den: pennant "3 weeks"; shelf with 2 stamps and a locked desk bell silhouette; You, Riya, Kabir, Zoya, with "Played" under the three who played the sprint.
- Card: "Riya opened a sprint", "5 Goodwill questions. Race the runs of Riya, Kabir and Zoya. Open until 2:05 PM tomorrow.", key **"Play Riya's sprint"**, link "More ways to play".
- Quest strip: "This week's quest", "51 of 60 questions", parcel.
- R2: "My friends played Riya's sprint; I tap the green key and race them."

**S2 The Den, a live room is open (8:52 PM).**
- "Here" tags on Riya and Kabir (presence only).
- Card: "Riya opened a live room", "A rematch with 5 new Goodwill questions. Riya and Kabir are in the room now.", key **"Join Riya's room"**, link "Play it later, until 8:52 PM tomorrow".
- Quest "56 of 60 questions"; chain chip "14 days".
- R2: "Two friends are in a room right now; I can join them, or play it later."

**S3 Chains, You (8:46 PM).**
- Tabs "You" and "Chai Circle"; "14 days in a row", "13 practised, 1 rested. Your best run."; seven paper links (today in volt).
- "2 rest passes, the most you can hold", "Miss a day and one is used for you. Earn one every 7 days, and one for every 3 fixes that hold."
- October calendar, "Moon: a rest pass kept the chain"; milestone path "Rest pass, Rest pass, Page 2, Rest pass, Foil Dart".
- Links "Exam pause days" and "Hide my chain".
- R2: "This is my run of days; missing one will not wipe it."

**S4 Chains, Chai Circle (8:46 PM).**
- Pennant "3 weeks"; "3 weeks in a row", "A week is stitched each time Chai Circle finishes the weekly quest together. Nobody can break it alone.", "Best run: 3 weeks".
- Card "This week's quest", "Ends Sunday 11:59 PM", "Answer 60 questions together in Mob games.", "56 of 60 answered", 12-segment bar, Kandil silhouette: "Kandil is folded in this week's parcel. Finish the quest and all four of you get him."
- "How it counts": "Every question answered in a Mob game or the Mob paper counts, right or wrong, so every answer helps. Sized for 4 of you: 15 each. Resting this week? Step out and the quest gets smaller, without your name."
- Path "Den stamp, Desk bell, Stamp joins, Lamp theme, Foil seal".
- R2: "Four more questions from any of us finishes the week, and Kandil comes out."

**S5 Play picker, Free member (sheet over the den).**
- "Play with your Mob"; "Free for everyone in the Mob":
  - Riya's sprint ("5 questions. Open until 2:05 PM tomorrow.", Play);
  - This week's Mob paper ("You sat it on Monday.", Answers);
  - Study room ("A shared 25-minute timer. No marks.", Start).
- "Start a new game" with a "Pro starts these" tag: "Anyone in your Mob with Pro can start one. Then everyone plays it free, as often as they like." Six locked tiles: Sprint, Race, Live room, Your own round, Full mock together, Rematch.
- Secondary key "Ask your Mob for a game"; link "What Pro adds".
- R2: "I can play Riya's game free now; starting my own needs Pro, and I can ask my Mob instead."

**S6 Start a game, Pro (Riya's phone; design note "Riya's phone. She has Pro.").**
- Tiles: Sprint "5 questions" (selected), Race "5 or 10 minutes", Your own round "5 to 20 questions", Full mock "50 in 60 minutes".
- "How your Mob plays it": "Live now" or "Anytime in 24 hours", with "Live starts everyone on one 3, 2, 1. Anyone who misses it gets the same questions for 24 hours."
- Rows: "Admission of a partner, The chapter of your Mob's last trap" (Change); "Exam-hall rehearsal, 20 questions in the real CBT layout"; "Pass the mic, Let a friend start one game. 2 left this week."
- Key **"Start a live sprint"**, "Everyone in Chai Circle plays it free. Marks count the same for all."
- R2: "Pick the game and how my friends play it, then start."

**S7 Free and Pro in the Mob.**
- "Pro never changes marks, chains or what you can earn. It adds hosting, and a closer look at where your Mob loses marks."
- "Free, always":
  - Play every game your Mob starts, as often as you like.
  - The weekly Mob paper, in every Mob you are in.
  - Your chain, rest passes and make-up days.
  - The podium, your marks and Fix it together.
  - Every character and sticker you earn.
  - Join 12 Mobs, start 1, and open a study room.
- "Pro adds":
  - Start games: sprints, races, live rooms, rematches.
  - Full mock together and exam-hall rehearsal.
  - Mob insights: where your Mob loses marks.
  - Every week side by side, past weeks and a recap.
  - Start 3 Mobs, and pass the mic to a friend.
- Key **"See Pro plans"**.
- R2: "Free already lets me play everything; Pro is for hosting and insight."

**S8 Live, ready up (8:52 PM).**
- Header "Riya's room", "Live sprint, 5 questions", Live, sound.
- Stage in the lamp pool: Riya ("Host") and Kabir with paper "Ready" tags, You, and an "Open seat".
- "Riya starts when everyone here is ready.", "Same 5 questions, same start. You see where friends are, never what they picked."
- "Room code K7P 2M9", "Send the code"; key **"I'm ready"**; "Anyone in Chai Circle who misses it can play until 8:52 PM tomorrow."
- R2: "Tap I'm ready; Riya starts it."

**S9 Live, 3, 2, 1, Go (8:53 PM).**
- The stopwatch art with a volt beat arc; numerals 3, 2, 1, then a volt "Go".
- Heads: Riya, Kabir, You. "Question 1 of 5 is next. +5 if right, -1 if wrong, 0 if you skip."
- R2: "Get ready, it is starting."

**S10 Live race, lock in (8:54 PM, 1:12).**
- Lanes for Riya (on question 4), Kabir ("Locked in", on question 3), and You (question 3). "Question 3 of 5", "+5 if right, -1 if wrong".
- "Average profit is ₹60,000, the normal rate of return 10% and capital employed ₹5,00,000. What is goodwill by capitalising super profit?" Options ₹50,000, ₹1,00,000, ₹6,00,000, ₹10,000. B is picked and clipped.
- Keys "Skip" and **"Lock in B"**, then "Locked in, checking".
- R2: "Pick one, lock it in; I can see Kabir locked in too."

**S11 Right, three in a row.**
- B turns good with a tick and "+5". The panel rises: a paper stamp "3 in a row", "Right. Three in a row.", "+5 marks. Your Mob only sees that you moved on."
- Key **"Next question"**.
- R2: "I got it, and three in a row; next."

**S11b Not this one.**
- Question 4: "A and B share profits 3:2. C joins for a 1/5 share, taken from A and B in their ratio. What is the new ratio?"
- A (3:2:1) is marked wrong with "-1". "Not this one.", "-1 mark. The right answer and why open for everyone when the room closes."
- Key **"Next question"**. No red flash, no shake, no buzz.
- R2: "Missed that one; I will see why at the end. Keep going."

**S12 A friend finishes (2:31).**
- Riya's lane fills in her colour, her pennant rises, "Finished".
- Toast: "Riya finished. 2 of you are still playing."
- Question 5 with the key disabled: "Pick an answer".
- R2: "Riya is done; I still have question 5."

**S13 Ghost race (8:41 PM, 1:12).**
- "Riya's sprint", "3 of you have played"; ghost lanes "Riya 2:10 PM", "Kabir 4:55 PM", "Zoya 6:30 PM", and "You Now".
- "Each friend is where they were at this second of their own run."; chip "4 s ahead of Kabir".
- Question 3: "Goodwill is 3 years' purchase of the average profit of ₹40,000, ₹50,000, ₹60,000 and ₹70,000. What is the goodwill?"
- Keys "Skip" and **"Lock in B"**.
- R2: "My friends played earlier; I am racing their real runs."

**S14 Podium (8:44 PM).**
- "Riya's sprint", "Everyone has played"; "Your Mob got 15 of 20 right together."
- Paper plinths 2, 1, 2 (a tie shares a height), with fold marks; You 19, Riya 20, Kabir 19 marks; Zoya stands on the floor with 13 marks and no numeral.
- "You and Kabir tie on 19, so you share second. Riya skipped question 4 instead of guessing, and stayed on 20."
- Chips: "Quest 56 of 60" and "Day 14 of your chain".
- Key **"See everyone's moment"**, plus the rematch icon ("Ask Riya for a rematch").
- R2: "Riya won on marks because she skipped instead of guessing; I tied second."

**S15 Results, everyone's moment.**
- Riya: "Skipped question 4, which most of you got wrong, instead of guessing."
- You: "Fastest right answer: question 5 in 17 seconds."
- Kabir: "Changed question 3 to the right answer."
- Zoya: "Quickest finish: all five in 2:20."
- Card "The question your Mob missed most", "On question 4, 3 of you picked ₹3,00,000. Nobody got it right this time."
  - Steps: "1. Now: See why, then one fresh question." and "2. Wednesday: One more checks the fix holds."
  - Progress: "0 of 3 fixed. A stamp for the den at 3."
- "Send your Mob a sticker": Nice one, So close, Teach me, Again?
- Key **"Fix question 4 together"**, plus rematch.
- R2: "We all fell for question 4; fix it now."

**S16 Milestone, 14 days.**
- Mobi cheering, seven links (today in volt), "14", "days in a row", "You practised 13 of them and rested 1. It is your best run so far."
- Page card: "Page 2 of The Fold, the Mob's story", "The lamp stays on", "Mobi keeps one lamp on for anyone still working."
- Key **"Read page 2"**, link "Back to the den".
- R2: "Two weeks straight; I unlocked a story page."

**S17 Character reveal.**
- "New on your shelf", "Kandil", "Lights up the den on late nights."
- "Chai Circle finished this week's quest, so all four of you get Kandil. Nobody can buy him."
- Key **"Make Kandil your character"**, link "See your shelf".
- R2: "We earned Kandil together; I can play as him."

**S18 Quest done (9:00 PM).**
- "Chai Circle", "Riya's rematch just closed"; the seal; "Quest done".
- "Chai Circle answered 70 questions this week. The quest needed 60, so week 4 of your chain is stitched."
- The four heads; parcel; key **"Open the parcel"**.
- R2: "We did the week together; open what we earned."

**S19 Week 4 stitched (9:01 PM).**
- "Chai Circle", "The Mob's chain"; the big pennant "4", "weeks in a row".
- "4 weeks in a row", "Chai Circle finished this week's quest together, so week 4 is stitched for all four of you."
- Heads; card "A desk bell for your den", "It stays on your den's shelf. At 8 weeks, Stamp joins everyone's shelf."
- Key **"Back to the den"**.
- R2: "Our weekly chain grew; the den got a bell."

**S20 Your shelf.**
- "Every one is earned. None can be bought."
- "Earned with your Mob, 1 of 3": Kandil (New, "This week's quest"); Crane locked, "Fix 3 Mob traps: 1 of 3"; Stamp locked, "8 Mob weeks in a row: 4 of 8".
- "Foil editions, from long runs, 0 of 2": "Foil Dart, 30 days in a row: 14 of 30" and "Foil Hop, 10 fixes that held: 6 of 10".
- "Pick any of these, any time", "You play as Dart": 9 starters plus Kandil.
- Key **"Make Kandil your character"**.
- R2: "Here is what I have and exactly how to earn the rest."

**S21 Start a Mob.**
- Den preview with you and 4 open seats.
- "Pick your Mob's name": Chai Circle, Quiet Comets, Margin Makers, Steady Kites, Ledger Club, Night Owls; "Names come from our list, so every Mob name is kind. Show six more".
- "Subject you will play": Accountancy, Business Studies, Economics.
- "You join as Aarav, playing Dart", "First names only. Change it any time."; "Your Mob sees your marks in games. One switch keeps them private."
- Key **"Start Chai Circle"**, "Next, you can invite up to 4 friends."
- R2: "Pick a name and subject, start."

**S22 Join with a code.**
- "Type the 6-character code your friend sent."; boxes K7P 2M9.
- Preview with silhouettes only (no names before joining, judge F7): "Chai Circle, Accountancy", "3 of 5 seats taken".
- Key **"Join Chai Circle"**; "Sitting together? Tap Scan QR and point it at their screen."
- R2: "Type the code, check it is the right Mob, join."

**S23 A Mob of one.**
- "Accountancy, just you"; den with 4 open seats; "Save a seat for a friend", "A Mob is 2 to 5 friends. Send the card; they tap it and take a seat."
- WhatsApp card: logo, "Aarav saved you a seat in Chai Circle", "Code K7P 2M9. Tap to join on MockMob."
- QR, "Your code K7P 2M9", "Works for 7 days. Friends next to you can scan the QR."
- Key **"Invite on WhatsApp"**, Copy; "This week's Mob paper. 10 questions, 10 minutes. Sit it now; friends who join can too." (Sit it).
- R2: "Send the invite; I can still sit this week's paper alone."

## 7. Motion spec per moment
Tokens are the app's own (`motion_tokens.g.dart`). Springs are simulated from (duration, bounce) as Flutter's `withDurationAndBounce` reads them:
- smooth 360/0.12, snappy 220/0, settle 420/0, iconPop 420/0.18, celebrate 520/0.22, release 300/0.1.
- Curves: glide (.15,.5,.5,1), out (.23,1,.32,1), emphasized (.16,1,.3,1), leave (.5,0,.75,0), sweep (.45,0,.55,1), drawer (.32,.72,0,1).
- The Mob beat is 600 ms.
- Every moment opens with a light change, moves at most three things at once, and is skippable in 200 ms.
- Reduced motion keeps information and order: 120 ms fades, no particles, no squash, no sheen.
- Particles are deterministic, capped at 60, with gravity and drag, and stop above any text (a per-burst floor).

Haptics and sound are the kit's (section 5). The prototype is silent; sound needs the owner's nod and an audio package.

| # | Moment | Timeline (ms) | Layers | Haptic / sound | Reduced motion |
|---|---|---|---|---|---|
| 1 | Enter the Den (T2 1100; idle after) | 0 dim 62%→0 and lamp pool 0.6→1 (glide 420); 120 room rises 14 dp (emph 360); 160 header and pennant swing (out 900); 200 + 45 per friend: rise 14 dp, scale .92→1 (iconPop), shadow settles; 420 name tags engrave; 420 card, 465 quest strip (emph 360); 700 idle breathe 1200 ms, offset 120 ms, stops 10 s after the last touch | room image, dim, lamp pool, pennant, figures and shadows, tags, card | none | 120 ms fade, still figures |
| 2 | Go live (T2 900 + hops) | 0 key .96 (snappy); 180 release (release spring); 180-540 volt wipe from the key (circle clip, out 360); figures turn 4° toward the centre; 540 the room swaps in under the wash; wash 100%→6%→0 by 2300; 900 + 600 per joiner: hop 560 ms with squash on landing, name, then a paper "Ready" | key, wash, room, figures, tags | light at release; selection per joiner; woodblock per joiner | 240 ms tint, no hop |
| 3 | Countdown (3000, on the beat) | beats at 0, 600, 1200: numeral stamps 1.25→1 (out 180), leaves .92 (leave 140); stopwatch tilts ±1.5° per beat; volt arc fills each beat; heads bob on the beat; scrim 0→45% across beats; 1800 "Go" pill stamps, ring burst plus 8 glints (420); 2300 stage exits; 2400 question rises 14 dp (glide 300) | scrim, lamp, stopwatch, arc, numerals, heads, canvas | selection on 3, 2, 1; light on Go; stopwatch ticks, bright woodblock | numerals cross-fade in place; the three beats stay (time is information) |
| 4 | Lock-in (T1 320) | 200 pick: option .96 and lip sinks 2 dp; 300 key turns on ("Lock in B"); 800 key press; 900 clip drops 8 dp (snappy 140), others dim to 60% (160), your token nods 3° (240); 1500 Kabir's pennant rises (iconPop) with "Locked in" | option, clip, key, lane token | selection on pick; light on lock; woodblock | clip appears, dim in 120 ms |
| 5 | Right, three in a row, then wrong (T1 560 each) | 0 option fills good (200); 120 tick draws (drawIn 450); 160 "+5" floats 12 dp and fades (700); 160 panel rises (drawer 360); 240 your token moves to the next bubble and nod-hops (420); 560 paper stamp "3 in a row" lands 1.4→1 with a 2° settle (celebrate 520), 8 glints; 1900 next question; 2400 wrong: option takes wrong surface and border (200), "-1" in ink2, token tilts 6° and back (420), panel rises | option, tick, mark, panel, stamp, lane | light on right (live only); nothing on wrong; rising woodblock up to three, soft pat on wrong | tint and tick in 120 ms; no float, no tilt |
| 6 | A friend finishing (T1 600) | 0 token glides to the flag (glide 300); 60 last bubble fills; 120 lane fills in their colour (glide 300); 240 token hop with squash (celebrate); 300 pennant rises from the pole (iconPop 280); 420 flag flutters (480); 500 toast slides in (glide 300); 8 paper bits | lane, token, pennant, toast | none (nothing buzzes for others); paper flip | pennant and toast fade 120 ms |
| 6b | Ghost race (async) | 12 s of the race shown in 2.4 s: every ghost moves at its recorded pace; tokens hop on arrival at a bubble; the pace chip recomputes each frame and pops when it changes | lanes, chip, clock | none | jumps to the current second |
| 7 | Podium reveal (T4 about 4800) | 0 scrim 35% and lamp narrows (emph 400); 120 collective line; 400 Zoya rises on the floor, marks roll 0→13; 1000 both second plinths unfold (rotateX 90→0, emph 420); 1300 You and Kabir drop 60 dp (220, accelerating), squash 1.08/.88 and settle (celebrate 520), paper bits stop at the floor; 1520 marks roll 13→19; 1960 "2" engraves; 2200 first plinth unfolds; 2600 Riya drops 70 dp; 2820 lamp swells, foil sheen sweeps (sweep 700), 40 bits and 8 glints; marks roll 19→20; 3100 "1" engraves; 3240 Riya hops; 3700 tie line; 4200 keys | scrim, lamp, plinths, figures, shadows, marks, canvas, text | light per landing, medium on first, confirm after the server ack; three rising woodblocks, then the bell | three 120 ms fades 300 ms apart (order is information) |
| 8 | Streak extends to week 4 (T3 about 2100; redone) | 0 lamp brightens and pennant lifts 8 dp with -1.5° (300); 180 numeral rolls 3→4 (numberRoll 500); 300 a needle sews the new stitch while it draws (drawIn 450, inOut), then the thread holes appear; 780 pennant settles: 1.03 scale with a decaying sway of 2.4°, -1.2° and 0.4° (900); 820 glints ride along the stitch; 900 title engraves; 1000 line; 1080 heads pop (iconPop, 45 ms stagger); 1300 reward card rises; 1520 desk bell rings (decaying wobble 600), glints; 1700 key | lamp, pennant, numeral, stitch, needle, text, heads, card, canvas | confirm after the ack; two bell notes | numeral cross-fades, stitch appears |
| 9 | Character reveal (T3 about 2000) | 0 scrim and lamp narrows (300); 300 parcel pulls back .94, then wobbles ±3° (440); 740 the seal pops; 760 four flaps unfold 60 ms apart (emph 420); light leaks and rays turn slowly (1300); 900 parcel body falls away; 1080 Kandil rises 40 dp (celebrate), shadow grows; 1000 glints and bits, floored above the name; 1400 "New on your shelf", name and line engrave (80 ms stagger); 1700 fact; 1800 keys | scrim, lamp, parcel, flaps, leak, rays, figure, text, canvas | light at pull-back, medium at open; a bell note | parcel cross-fades to the character in 120 ms |
| 10 | Quest complete (T3 1900) | 120 the count rolls 56→60 as the bar fills (600); 700 bar pulses 1.04; 760 segments bloom in order (lift 1 dp, volt glow, 22 ms steps); 1080 bar folds away; 1120 the seal stamps 1.4→1 with a 2° settle (celebrate), ring burst and 12 glints; 1160 "Quest done" engraves; 1260 line; 1300 heads pop; 1400 parcel arrives (celebrate); 1600 key | lamp, bar, seal, text, heads, parcel, canvas | medium at seal landing, confirm after the ack; bell | bar fills, seal fades in at 120 ms |
| 11 | Milestone, 14 days (T3 2000) | 0 lamp; 120 links drop in, 70 ms apart, today's link lands with celebrate; 600 "13" rolls to "14" with a 1.25 stamp; 820 Mobi pops (iconPop); 900 glints and bits, floored above the number; 1000 title and line; 1300 page card unfolds (rotateX 70→0, emph 420) | lamp, links, number, Mobi, text, card, canvas | confirm after the ack; bell | all fade in 120 ms |

## 8. Truth and safety rules (held on every screen)
- **Every number has a row.** Marks are CUET marks from the server. "Played" means a Mob game sitting. "Here" means a presence entry. Ghost positions come from `mob_sittings.detail.t`. The quest sums answered questions in Mob games and the paper. Chain days come from attempts by IST day. Counts under 3 sitters show no aggregate. Nothing relies on crowds. There are no bots.
- **Order is true at every frame.** On the podium, counters roll up from the mark of the place below and places appear third to first. I found and fixed a false order (the winner read 12 against 19) in my first pass.
- **Minors.**
  - No free text between users: stickers are a fixed preset set drawn locally.
  - No photos; first names only.
  - Nobody is named for a wrong answer: the trap is counts only.
  - The join preview shows no names.
  - Nobody's Pro status is shown.
  - Nothing names a member who has not played ("2 of you are still playing", "Anyone in Chai Circle who misses it").
- **No guilt.** No countdown on any chain, no droop, no loss copy, no shake or red flash on a wrong answer, no push. The chain chip shows the number only.
- **Collectibles** are earned by deterministic rules shown on the locked item, never bought, never random. The parcel shows the silhouette of what is inside before you open it.
- **One lit thing.** Volt is the key, or what was just earned: the new link, the new stitch, "Go". The "Ready" tags and the three-in-a-row stamp were moved from volt to paper so the key stays the only volt.
- **Copy:** plain, grammatical, warm, no exclamation marks, 12-hour IST.

## 9. Build cost and Flutter technique per piece
Techniques (kit section 8):
- A: implicit and explicit animations plus the app's springs.
- B: `CustomPainter`.
- C: a still raster plus a transform puppet.
- D: a fragment shader, Impeller only, at most one per moment.
- E: a one-shot image sequence.

| Piece | Cost | Technique |
|---|---|---|
| Den stage (scene image, figures in the lamp pool, tags, pennant, shelf) and Enter the Den | M | A + C (each figure a `Transform` with breathe and squash on its own `RepaintBoundary`); lamp pool a radial `DecoratedBox` |
| Cast as files: 12 characters, head crops, silhouettes | S | C; `Image.asset` with `colorFilter` for locked silhouettes; heads by `Alignment` crop |
| Chains screen (calendar, links, passes, path) | M | A + B (links and path painter); server: chain ledger and rest-pass ledger (additive migration) |
| Mob chain, quest card and resize rule | S | A + B (segment bar); quest sums from `mob_sittings` and extras |
| Play picker Free and Pro, plus the Free/Pro sheet | S | A; entitlements already exist |
| Async ghost race (lanes, chip) | M | B for lanes, A for tokens; data already stored (`detail.t`) |
| Live room: ready up, countdown, live lanes, friend finished | L | A + B; Supabase Realtime private channels, presence and broadcast, server clock; room columns on `mob_extras` |
| Answer feedback, lock-in, three-in-a-row stamp | S | A (springs), B (tick draw); feedback rule change in the runner |
| Podium reveal | M | A (plinth `Transform` with perspective, drops, squash) + B (particles) + D (foil sheen; Lite tier: a gradient mask) |
| Quest seal and parcel arrival | S | A + B; the seal is the app's `foil-seal.webp` |
| Character reveal (parcel unfold) | M | A (4 flaps as `Transform` with perspective) + B (rays and particles); E only if a generated unfold sequence is approved |
| Week stitched (needle and pennant) | S | B (stitch path with `PathMetric` extraction, needle along the path) + A |
| Shelf (earned, locked, foil) | S | A; deterministic unlock rules on the server |
| Stickers (preset) | S | `mob_reactions` enum table; drawn locally |
| Sound (about 15 clips) | M | new audio package (needs his nod); silent-mode check |
| Create, join (6-character code), Mob of one, WhatsApp card | S | A; code migration from 8 to 6 characters (old codes keep working) |

The first build (async loop) is about M + M + S + S + M + S + M + S + S. Live is the one L and can follow.

## 10. Needs the owner's yes
1. Billing-off start rule (recommend: anyone may start while billing is off).
2. Free can start a study room.
3. Pass the mic.
4. First game of a new Mob free to start.
5. Lift the Free one-paper-a-week limit.
6. Your own right or wrong after each locked answer in sprints and races, with the correct option held until the room closes.
7. Sound on by default inside games, and relaxing "Mobi once per screen" to "once per moment" inside the Mob (S16 shows Mobi).
8. The T4 tier (6000 ms ceiling) for the podium only.
9. The Fold as the story name, and its pages as chain rewards.
10. Quest size of 15 per member (a guess to test with students).

## 11. What I redid after looking at my own frames
- **Weakest screen: S8 ready up.** The first pass had figures crowded off-centre, a large empty band, and volt "Ready" pills competing with the volt key. I put the cast in the scene's lamp pool, spaced four slots, and made the tags paper.
- **Weakest motion: the streak extending.** It first played as a tiny stitch on a dense info screen, with a blank title for 800 ms. I rebuilt it as its own moment (S19): a large pennant, a needle that sews the week, a sway that settles, then the desk-bell reward.

Other fixes from the frames:
- the podium false order;
- characters semi-transparent mid-drop;
- shadows visible before the figures;
- the Go Live wash staying full volt;
- particles crossing text;
- the seal's overlaid "60" clashing with the art;
- Day scrims turning grey (now a warm ink dim);
- paper chain links invisible by Day.

## 12. Honest weaknesses
- Browser only. Nothing has run on the emulator or a low-end phone (R5 and the RAM rule are still to do), and 412 dp and large text are not checked.
- The webm files are a CDP screencast re-timed by Chrome's MediaRecorder, not Playwright's `recordVideo`, because its ffmpeg is missing and downloading it needs permission.
- No sound in the prototype.
- The cast is generated art used as stills. Pose and expression changes need more images per mood, or Rive later.
- Patang's diamond is close to Mobi's shape at 24 dp (the character ledger flags this).
- Hop reads a little like a cat to some people.
- The quest needs 60 for 4 members: a guess.
- S6 and S7 are list-heavy and the least "arena" of the set.
- Live (S8 to S12) depends on Realtime, so it is not in the first async build.
- The prototype's idle breathing is subtle and untested on a device.
