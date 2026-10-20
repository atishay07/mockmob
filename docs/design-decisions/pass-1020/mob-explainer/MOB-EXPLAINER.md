# The Mob explainer (20 Oct 2026, pass-1020, R8 prototype for the owner)

**What this is.** A 7-slide motion explainer that runs the first time a student taps **Start a Mob** or **Join with a code**, before the setup. It answers the owner's version 13 notes K2 and K8 (`docs/brain/OWNER-FEEDBACK-2026-10-19.md`, 20 Oct about 12:05 pm):
- "This doesn't even explain what exactly this thing is."
- "a full 6-7-slide proper explainer, not an onboarding flow, with motion graphics... If someone is skipping, there can be a skip button."
- "This has to be presented in a very cool and very fun manner."
- "make this so defensible that no one else can copy it."

Nothing here is built in Flutter or on the web yet. It is a prototype for the owner to see first (R8).

**Files.**

| What | Where |
| --- | --- |
| Clickable prototype (self-contained, 360 x 780, Night and Day, reduced motion) | `prototype.html` (this folder). Open it in Chrome. Tap, swipe or use the arrow keys. The controls beside the phone switch theme and motion and jump to any slide. |
| Prototype source, build and scripts | `tmp/design-1020/mob-explainer/src/` (`template.html`, `build.py`, `shots.cjs`, `clicktest.cjs`, `record.cjs`, `assemble.py`) |
| Recordings | `tmp/design-1020/mob-explainer/`, made by `record.cjs` and `assemble.py`. The WebM files are real-time captures over the Chrome DevTools screencast, encoded inside Chrome by MediaRecorder: Playwright's own video recorder needs an ffmpeg download that this machine does not have, so none was fetched. The files: `mob-explainer-night.webm` (Mob tab, Start a Mob, all 7 slides, the setup, the den, Mob settings), `mob-explainer-day.webm` (Join with a code, all 7 slides, the code screen, the den), `slide-<n>-<name>-night.webp` and `-day.webp` (one animated WebP per slide), `frame-strips-night.png` and `-day.png` (six timed moments per slide), `contact-sheet.png` (every slide and screen, Night above and Day below) |

---

## 1. When it shows

- **First Start or first Join.** The first time a student taps Start a Mob or Join with a code on the Mob tab (D0), the explainer opens as a full-screen route over the shell. It shows once per account per device: a local flag `mob.explainer.v1.seen` (Flutter `SharedPreferences`, web `localStorage`), set when the student reaches slide 7 or taps Skip. Raise the suffix to `v2` only when the Mob changes enough to show it again.
- **Joining from a friend's invite link** also shows it the first time. Slide 7 then leads with **Join Chai Circle** (the code is already filled), and Start your Mob becomes the second key.
- **Skip** is always visible on slides 1 to 6, top right. It goes straight to where the student was heading: the setup after Start, or the code screen after Join.
- **The last slide** has two keys: **Start your Mob** (volt) and **Join with a code**. The one the student came from is first.
- **Replay.** It can be watched again from:
  - a new row in Mob settings, "How the Mob works" with the line "Watch the 7 slides again";
  - the link "How the Mob works" under the two keys on D0.
  On a replay, slide 7 shows one key, "Back to your Mob", and Skip returns to the den.
- **Never during a run,** never over a moment (quest done, reveal), and never as a push.

## 2. The script (copy is final; every line is checked against the build in section 5)

| # | Title | Body | On the stage | The one volt thing |
| --- | --- | --- | --- | --- |
| 1 | This is your Mob | You and up to 4 friends at one desk. Play quick games, see who tops it by CUET marks, and fix your Mob's most-missed question together. | The den (the app's room art). The lamp comes on, the Chai Circle pennant swings in, and Zoya (Kandil), Riya (Dog-ear), you (Dart) and Kabir (Hexa) hop into their seats. One open seat. | Your "You" tag |
| 2 | Everyone sits as a Fold | The Folds are paper friends. Each one was a mistake once, until someone fixed it. Mobi came from the very first fix, so he's the eldest. You start as one of these four. | An answer sheet under the lamp. B is picked in pencil, a crease runs across it, the right answer C is filled and ticked. The four corners fold in to a diamond, the diamond takes Mobi's lime and opens its eyes, and Mobi steps out. The four starters hop in beside him. | The fixing tick |
| 3 | Race your friends' real runs | Anyone in your Mob can open a 5-question game. It stays open for 24 hours, so you play when you're free and race their runs, timed question by question. No bots. **Coming soon.** Live rooms, where everyone starts on one 3, 2, 1. | Riya's sprint card. The ruler race: you on the ruler, Riya and Kabir as ghosts on the back rail, each moving at the second they really answered. The pace chip ("4 s ahead of Riya", "Level with Kabir"), the stopwatch, "Where everyone is. Never what they picked." and "Runs so far: Riya, 2:10 PM. Kabir, 4:55 PM." | Your flag at the finish |
| 4 | A smart skip can win | The podium goes by CUET marks: +5 if right, −1 if wrong, 0 if you skip. Kabir skipped the one he wasn't sure of and beat Riya by a mark. | A mark sheet fills question by question (Kabir 20, Riya 19, you 15). Kabir's skip (0) and Riya's wrong pick (−1) on question 4 are ringed. Then the podium unfolds third, second, first, the Folds drop onto it, and first place gets the lamp and the foil sheen. | The ring on Kabir's skip |
| 5 | Fix it together | When a game closes, the question that caught most of you becomes your Mob's to fix. See why, try a fresh one, and on Wednesday one more checks it held. If 2 of you pass, it's fixed. | The answer sheet: "Question 4 caught most of you.", your pencil pick struck, the right one filled, "Why it looked right." Mobi thinks at its side. The path: Now (ticked), then the calendar flips to Wednesday 28 Oct. Two heads get ticks, the seal stamps "Fixed together", "1 of 3 traps fixed. Crane comes at 3." with Crane's silhouette. | The seal |
| 6 | Stitch a week together | Answer 15 questions each in Mob games and papers, and the week is stitched onto your Mob's pennant. Nobody can break it alone. Your own chain needs 5 a day, and a rest pass covers a missed day. | The pennant hangs in the lamp light. The quest counts 51 to 60, the bar blooms and folds into the seal ("Quest done"). Only then the lamp brightens, a needle sews week 4 onto the pennant, 3 rolls to 4, and the four members' heads pop in around it. Below, your own chain: seven days with one moon, "Moon: a rest pass kept the chain." | The new stitch |
| 7 | Earned, never bought | Your Mob's first weekly quest brings Hop to everyone in it. The rest come from real things you do. None can be bought. | The parcel pulls back, wobbles twice, the seal pops, light leaks from the seam and Hop climbs out ("Bounces back after a wrong one."). The shelf: Crane (3 traps fixed together), Stamp (4 weeks in a row), Patang (beat your best), Sticky (5 fixes that held), each a true silhouette. | The Start your Mob key |

Copy rules held: plain, grammatical, no exclamation marks, emoji, arrows or hype words; no price and nobody's plan (spec 5.0); never "lost", "behind", "last" or "hurry" outside the pace chip, which is the app's own copy (`copy_v3.dart` `pace`). The fixture names, times and the sample question are the app's fixture (Chai Circle, Accountancy, spec 5.3). The sample question is right: 2 years' purchase of 30,000 is 60,000, and 45,000 is 1.5 years.

### The setup that follows (friendlier than a form)

Today D0a is one long sheet (name, subject, Fold, name, colour, note, key). The prototype splits the same fields into one question per screen, under a live den preview that changes as the student answers:

1. **Who will you be?** "Pick your Fold. You sit as it in every Mob, and you can earn more." Four starter cards (Fold, name, its line). Tap one: it lifts, and the Fold hops into the centre seat of the den and cheers. The key reads "Pick your Fold" until one is picked.
2. **Name your Mob.** "Names come from our list, so every Mob name is kind." Six name chips, "Show six more". The pennant on the den wall takes the name and sways.
3. **Pick the subject you'll play.** "A Mob plays in one of your CUET subjects. Every game in it uses that subject." The student's subjects, each with its subject object art; the first is selected (real context, editable: T001). The pennant gets the subject line.
4. **What should your Mob call you?** The name field starts on the student's first name (editable), "Only your Mob sees it. 2 to 18 letters.", the 8 colours (the den tag under the Fold takes the name and colour as they type and tap), "Your Mob sees your marks in games. One switch in Mob settings keeps them private." Key **Start Chai Circle**, with "Next, you can invite up to 4 friends." above it.

Then the den opens as a Mob of one (D5): the Fold cheers, the open seats pop in, "Save a seat for a friend", the invite card, Invite on WhatsApp, Copy the code, "Works for 7 days, for up to 4 friends."

**Join** keeps J1: six code boxes, then a preview with no names (the members' Fold silhouettes, "Chai Circle, Accountancy", "3 of 5 seats taken"), "Pick who you'll be", the name, the privacy line, **Join Chai Circle**. The den then opens with your Fold hopping into its seat.

The step dots show where the student is, never invented progress (T002). Back steps back; the back arrow on step 1 returns to D0.

## 3. Motion spec (for the Flutter and web builders)

Tokens are the app's (`shared/motion-tokens.json`, `motion_tokens.g.dart`): curves glide `(.15,.5,.5,1)`, emphasized `(.16,1,.3,1)`, out `(.23,1,.32,1)`, leave `(.5,0,.75,0)`, sweep `(.45,0,.55,1)`, inOut `(.77,0,.175,1)`; springs `celebrate` 520 ms bounce .22, `iconPop` 420 ms bounce .18, `smooth` 360 ms bounce .12 (Flutter `SpringDescription.withDurationAndBounce`; the web uses the same spring sampled into a CSS `linear()` curve). `mob.squash` 1.08 x 0.88 held 90 ms. Times below are ms from the moment the slide lands.

**Global.**
- **Slide change:** the track slides 420 ms on emphasized. A swipe follows the finger (a third of the pull at either end). On release, it goes on past 70 dp or a flick over 0.45 dp/ms, else it snaps back in 300 ms on out. A tap on the right two thirds goes on, the left third goes back; arrow keys on the web. The incoming slide builds as the track starts moving; the outgoing slide is held at its end state.
- **Text:** the title rises 14 dp and fades in at 140 (emphasized 360), the body at 220, the Coming soon line at 320.
- **Chrome:** the dots widen 6 to 20 dp (240). On slide 7, the Next key fades out and the two keys rise 12 dp (360, 80 delay).
- **Folds** (FoldPuppet, spec 5.2), each a stack of layers: travel, then shadow and enter, then hop, then squash at the boots, then breathe, then the pose stills plus eye covers.
  - Hop-in: rise from 36 dp below to 18 above (out), then land (leave), 440 total. The shadow grows 0.3 to 1. Squash lands at 430.
  - Pose changes cross-fade 120.
  - Idle: breathe 1 to 1.028 on the 3600 sweep, three times, then stop. Blinks are visor-coloured covers over the eye boxes from `folds.json`, 150 ms, every 4 to 7 s, seeded so no two blink together.
- **Particles:** paper bits are 4 to 8 dp rectangles with a fold line, under gravity and drag, floored at the stage floor; at most 26 in one burst. Glints are four-point stars, 520 ms. Brand kit 6 caps 60.
- **Reduced motion** (system setting or `Motion.reduced`): no track slide (a 120 fade), every move becomes a 120 fade at half the delay with the order kept, no squash, particles, sheen, loops or hops, and the ruler Folds jump between numbers. Information and order are the same. Checked frame by frame on slides 2, 4 and 7.
- **Haptics:** `selection` on each slide change and on every pick in the setup; `light` on Start your Mob, Join with a code and Start Chai Circle. Nothing else. Show moments in an explainer are not real events, so no `confirm`.
- **Sound:** none. There is no audio package yet (brand kit 5).

**Per slide** (layers back to front; the timeline; the reduced form).

1. **This is your Mob** (1.5 s of motion, then idle).
   - Layers: the room art, the lamp pool, the pennant, Fold shadows, Folds, tags, the bottom fade.
   - Timeline:
     - 0: the room goes from brightness 0.3 to 1 (glide 420). Light comes first.
     - 80: the lamp pool scales 0.55 to 1 (glide 420).
     - 160: the pennant swings in from −9°, then 2.4°, −1.2°, 0.4°, 0° (out 900).
     - 300 + 90 per Fold, left to right: the Folds hop in.
     - 700: the open seat pops (iconPop).
     - 720 + 90 per Fold: the name tags engrave (280).
     - 1250: your Fold waves.
     - 1300: idle starts.
   - Reduced: the room fades in at 0, the rest fades in order.
2. **Everyone sits as a Fold** (about 4.3 s).
   - Layers: graph paper, the lamp cone and shade, the sheet (base diamond plus four corner flaps), the tint and visor, Mobi, the bits, the starters, the tags.
   - Timeline:
     - 0: the cone opens 0.7 to 1 wide (glide 420).
     - 120: the sheet rises 22 dp and turns −4° to −1.5° (emphasized 420, out 600).
     - 420: the pencil pick pops.
     - 560: the dashed crease draws (inOut 360).
     - 900: C fills.
     - 980: the volt tick draws (inOut 420). 1180: 4 glints.
     - 1560, 1650, 1740, 1830: the four corners fold in. Each corner rotates 180° on its fold line with 520 perspective (emphasized 420); its face hides at 31% of the turn and its back shades 0.6 to 0.35.
     - 2220: the diamond shrinks to 0.64 and squares up (out 300).
     - 2300: it tints Mobi's lime (200).
     - 2440: the visor opens (scaleX 0.4 to 1, out 200).
     - 2640: the paper hands over to Mobi, who pops 0.7 to 1 (celebrate). The lamp flares 1.5x (700), with 18 bits and 6 glints.
     - 2950: "Mobi, the eldest" engraves.
     - 3000 + 90 per Fold: the starters hop in (Dog-ear, Hexa, Dart, Kandil).
     - 3400: Mobi sways ±3° (sweep 900).
   - Reduced: the sheet and its pick and tick fade in, then the sheet cross-fades to Mobi (750), then the starters and tags fade in.
3. **Race your friends' real runs** (about 6.0 s).
   - Layers: the game card, then the race panel (grid paper, lamp glow, legend, stopwatch, back rail, ruler and number cells, flag pole, ghost Folds, your Fold, your flag), then the caption, the pace chip and the runs line.
   - Timeline:
     - 80: the card rises. 180: the panel rises.
     - 700: the race starts. Prototype time is 23 ms per real second. Arrivals are the fixture's: you at 37, 88, 118, 149 and 186 s; Riya at 41, 79, 130, 151 and 190; Kabir at 52, 88, 121, 170 and 214.
     - On each arrival the Fold glides 300 to the next number with a 7 dp hop. Your number cell fills ink (out 240).
     - From your first answer, the pace chip shows after 320 ms and pops 1.08 only when its text changes. It uses the spec R4 formula, so it reads "4 s ahead of Riya", "Level with Kabir" and so on.
     - The stopwatch counts in m:ss and stops at your finish.
     - At your finish: squash, the cheer pose, and your volt flag unfurls (iconPop).
   - Reduced: the Folds jump between numbers, with no hops and no chip pops.
4. **A smart skip can win** (about 4.9 s).
   - Layers: the lamp, the floor, the plinths (paper, numeral, fold-count creases, name and marks), the Folds, the sheen, the bits, the mark sheet.
   - Timeline:
     - 0: the cone narrows from 1.35 (emphasized 420).
     - 120: the mark sheet rises.
     - From 280, the cells pop at 280 + 170 per question + 50 per row. The marks count with each cell: +5, −1 or 0.
     - 1420: Kabir's skip gets a volt ring, which pulses twice (sweep 600). 1480: Riya's −1 gets a ring.
     - Plinths unfold from 86° (emphasized 420): third at 2000, second at 2420, first at 2840.
     - Each Fold drops 60 dp (leave 240) 260 ms after its plinth, then squashes.
     - First place, from 2840 + 560: the cheer pose, the foil sheen sweeps the plinth (sweep 700), the lamp swells 1.6x, 26 bits, 6 glints, and one 12 dp hop.
   - Reduced: the plinths fade 300 ms apart, third, second, first (the order is information).
5. **Fix it together** (about 4.3 s).
   - Layers: the answer sheet (stem, OMR bubbles, the pencil pick, the strike, the filled answer, the why line), Mobi, then the path card (Now, the calendar leaf, the heads, the tick badges, the seal, "Fixed together", the progress line, Crane's silhouette).
   - Timeline:
     - 80: the sheet rises 18 dp. 380: the pencil pick. 640: the strike draws (260). 700: C fills. 900: the why line engraves.
     - 1100: Mobi slides in from the edge (celebrate).
     - 1300: the path card rises. 1550: the Now icon pops. 1650: its tick draws (380).
     - 2050: the leaf flips Sun 25 to Wed 28 (rotateX, leave 200 then out 400).
     - 2450 to 2650: the two heads and their ticks pop.
     - 2900: the seal stamps 1.4 to 1 with a 2° settle (celebrate), with volt glints.
     - 3150: "Fixed together" engraves. 3300: the progress line. 3350: Crane pops, then wiggles at 3700.
6. **Stitch a week together** (about 4.0 s).
   - Layers: the lamp glow, the pennant (rod, paper, number, word, felt band, stitches, needle), the four member heads (ringed in their member colours), the quest card (title, count, 12 segments, then the seal and Quest done), the chain card.
   - Timeline:
     - 0: the lamp glow opens behind the pennant (glide 420). 60: the pennant swings in.
     - 160: the quest card rises.
     - 500 to 1100: the count rolls 51 to 60, and segments 11 and 12 fill.
     - 1180: the bar pulses 1.04. From 1260: the segments bloom 22 ms apart (lift 1 dp, 28% volt glow).
     - 1620: the bar folds away (leave 200).
     - 1700: the seal stamps (celebrate), with 8 glints. 1900: "Quest done" engraves.
     - 2050: the lamp brightens 1.6x and settles at 1.2x (1400). 2150: the pennant lifts 8 dp and sways.
     - 2350: the needle rides the stitch path (offset path, 520) while the volt thread draws (inOut 450).
     - 2530: 3 rolls out. 2650: 4 rolls in (smooth).
     - 3000 + 45 per head: the four members' heads pop in around the pennant (iconPop), as in M8.
     - 3250 + 70 per day: the chain days drop in, the last one on celebrate. 3800: the moon legend.
   - The stitch never plays before Quest done (F13).
7. **Earned, never bought** (about 2.9 s).
   - Layers: the lamp, the leak glow, the parcel stills (sealed, pop, open), Hop clipped at the box rim, the bits, the name and line, the shelf plank, the silhouettes, the rule captions.
   - Timeline:
     - 0: the lamp narrows.
     - 420 to 1200: the parcel pulls back to 0.94, wobbles ±3° twice, then bursts to 1.05 and settles.
     - 880: the leak glows from the seam (0 to 1.1 to 0.6).
     - 1000: the still swaps from sealed to pop. 1100: it swaps to open.
     - 1180: Hop rises 96 dp out of the box (celebrate), with 22 bits, 6 glints and a lamp flare.
     - 1600: Hop squashes and "Hop" engraves. 1760: the line rises.
     - 2100: the shelf appears. 2200 + 90 per Fold: the silhouettes pop. 2300 + 90 per Fold: the captions.
   - No rays and no rarity colour (F6).

**Build notes.**
- **Flutter.** Add `MobExplainerScreen` under `lib/features/social/v3/screens/`, as a `PageView` with one `AnimationController` per slide (the prototype's timelines map one to one onto `Interval`s). Reuse the v3 widgets that exist:
  - `fold_puppet.dart`, `pennant.dart`, `ruler_race.dart`, `podium_stage.dart`, `parcel.dart`, `paper_particles.dart`, `quest_segments.dart`, `chain_strip.dart`, `mob_fx.dart`;
  - the art in `assets/art` and `assets/folds`.
  Copy goes into `copy_v3.dart` (`MobV3Copy.explainer*`). The flag goes in the Mob prefs. Add goldens of every slide's end frame at 360 and 412 dp, Night and Day, text scale 1.0 and 1.3, plus a frame strip per slide.
- **Web.** Add `src/components/mob/MobExplainer.jsx` on the same timelines. The prototype's engine is plain Web Animations with one delay per layer, so it ports directly.
- **Seekable by design.** Every layer is an animation with its own delay, so any frame can be rendered for tests. This is how the WebP and frame strips were made.

## 4. Why nobody can copy this (K8)

The explainer only shows things that need MockMob's own data, art or history. A rival can copy a leaderboard or a streak in a day. They cannot copy these:
1. **The Folds and their story.** These are 12 characters and Mobi, our own IP:
   - final art in five poses each (`characters/final`, `assets/folds`);
   - a world whose lore is the product promise: find the mistake, fix it, check the fix holds (CHARACTER-WORLD 1).
   Slide 2 turns a fixed mistake into Mobi on screen. That is the brand in one motion.
2. **Fix it together sits on Score Recovery.** It needs four things a rival does not have:
   - our checked CUET bank, with a same-chapter fresh question and its worked explanation;
   - the trap rule that finds the question that caught most of the Mob;
   - the Wednesday check;
   - the repair ledger: a right Wednesday check counts as a fix that held, the same as a student's own repair (`chain_fixes_held`), and it feeds rest passes and Sticky.
   Copying the screen gets nothing without the bank and the ledger.
3. **Ghost runs are real, server-timed runs.** Every arrival is `elapsed_ms` stamped by our server per answer. A ghost exists only when a friend really played. There is nothing to fake them with, and a new app starts with no runs.
4. **CUET marking teaches the real paper.** The podium runs on +5, −1, 0, so a smart skip can beat a guess. Generic quiz apps rank by speed or streaks.
5. **A Mob's shared history compounds.** Each Mob builds up:
   - stitched weeks and a best run that only rises (`mob_chain_best`);
   - den objects at 2, 4, 8, 12 and 20 weeks;
   - Folds earned together, kept forever.
   Leaving MockMob means leaving the pennant and the shelf.
6. **Live rooms are coming** on the same ruler and Folds, as one 3, 2, 1 for everyone, Mob-only. They are built behind a switch, so the explainer says "Coming soon" and nothing more.

## 5. Truth check: every claim, and where it is true

| Claim on screen | True in the build |
| --- | --- |
| You and up to 4 friends | A Mob is 2 to 5 (`MOB_FULL`: "it has 5 members, the most a Mob can have") |
| Podium by CUET marks; +5, −1, 0; ties share a place | `src/lib/mob/games.mjs` placeRuns (place = 1 + runs with strictly more marks); `copy_v3.dart` marksRule |
| Fix your Mob's most-missed question together | `computeTrap`: at least 3 finished runs; a wrong option picked by at least 2 and at least half; "caught most of you", never a count (F3) |
| Starters: one of four | `folds.mjs` STARTERS dart, dogear, hexa, kandil |
| Anyone in your Mob can open a 5-question game, open 24 hours | Sprint 5 (`games.mjs` COUNTS), async 24 h. With billing off anyone may start; with billing on, Free gets 1 start per Mob per week and Pro is unlimited (`starts.mjs`), so "can open" stays true |
| Race their runs, timed question by question; no bots | Ghosts are finished runs with `arrivalsMs` from `mob_game_answers.elapsed_ms`, "elapsed_ms is from server time only" (migration 100100); no picks or marks travel with a ghost |
| Live rooms: coming soon | Live code is merged, but `MOB_LIVE_ENABLED` is unset and migration `20261020100400_mob_v3_live` is not applied (waiting on the L-55 presence fix) |
| See why, a fresh one, Wednesday check, 2 pass = fixed | `games.js` freshQuestionId (same chapter, never one of the game's own); `checkWindow` (the next Wednesday 12:00 AM IST at least 48 h after close, until Sunday 11:59 PM); fixed when 2 or more answer the check right; Crane at 3 (`FIXED_FOR_CRANE`) |
| 15 questions each in Mob games and papers; stitched onto the pennant; nobody can break it alone | `quest.mjs` PER_MEMBER 15 (per member who has not stepped out; skips do not count); `copy_v3.dart` mobChainLine |
| Your own chain needs 5 a day; a rest pass covers a missed day | `src/lib/chain/chain.mjs` DAY_GOAL 5, PASS_MAX 2; any answered question counts (practice, Mob games, fixes) |
| Hop for the first weekly quest; the rest from real things; none can be bought | `checkUnlocks` (server); the spec 0.4 earn table; "Nothing you earn in the Mob is for sale." |
| Shelf rules: Crane 3 traps, Stamp 4 weeks, Patang beat your best, Sticky 5 fixes that held | `copy_v3.dart` foldRule and `checkUnlocks` |
| Setup and join fields, names list, notes | `copy_v3.dart` D0a and J1 strings, unchanged in meaning |

**What could not be made true, and how the copy stays honest.**
- **The trap atlas is not used for Fix it together.** The spec says the fresh and check questions come from the trap atlas (`trapForOption`). The server picks a same-chapter question from the bank instead, and the atlas only names traps on the weekly Mob paper. So no slide mentions the atlas; slide 5 says only "try a fresh one". Wiring `trapForOption` into `freshQuestionId` would make the stronger claim true.
- **Live rooms are not on,** so they are "Coming soon" and get no slide of their own.
- **The explainer itself, its seen flag, the "How the Mob works" row in Mob settings and the D0 link are new.** None of them is built yet.
- **The ghost race and podium numbers are a fixture,** as in the spec's examples. In the product the times and marks come from the server.
- **The setup preview shows the den changing as you answer.** That is new UI over the same fields; the server calls are unchanged.

## 6. Design decisions, evidence and checks

- **The user's job:** a 16 or 17-year-old who has never used a study group app taps Start a Mob and needs to know, in under a minute, what a Mob is, what they will do in it and why it is worth inviting friends. Then they set one up without a form.
- **Alternatives considered:**
  - A longer single page: rejected, because the owner asked for slides with motion.
  - An onboarding questionnaire: rejected, because he said "not an onboarding flow".
  - The current one-line lead: rejected; it is not enough (K2).
  - A carousel of screenshots: rejected, because it is static and reads as generic.
- **Evidence IDs:**
  - T001: the setup defaults come from real context (first subject, first name) and are visible and editable.
  - T002: the dots show position, never invented progress.
  - S014: progressive disclosure, with one question per setup screen.
  - S016: accessible controls (the carousel role, slide labels, a polite live region that reads each slide, 44 dp keys and Skip, visible focus, arrow keys).
- **The 12-part anti-slop test** (pass or note):
  1. Identity with the logo hidden: paper, lamp, Folds and stamps on every slide.
  2. One primary action per screen: Next, then the volt key on slide 7.
  3. True content: section 5.
  4. Hierarchy at first scan: the stage, the title, the body.
  5. Composition: one hero per beat.
  6. Type by role: Bricolage for titles and figures, Hanken for reading.
  7. States: first, skip, replay, join and reduced.
  8. Interaction: tap, swipe, keys, real-pointer tested.
  9. No pseudo-evidence: the fixture names are the spec's, and no crowd is claimed.
  10. Motion with a reason: each slide's motion is the mechanic itself.
  11. One leading metric plus one guardrail, suggested below.
  12. "What would be better without this?": the old ghost labels were removed (legend instead), the "Open seat" tag was kept, and no rays were added.
- **Review rounds (frames looked at with Read, weakest fixed each time):**
  1. Slide 5's option values collided with their bubbles. Slide 7's dots sat on the body text. The Coming soon box wrapped badly.
  2. Slide 2's folded sheet stayed square, because the base was not clipped to the diamond; it now folds into a true diamond and becomes Mobi. Slide 4's short plinth hid its own numeral.
  3. Slide 3: the ghosts disappeared behind your Fold. They now run on a back rail, higher and smaller, so all three runs read at once, with a legend in place of floating labels.
  4. Reduced motion: on slides 2, 4 and 7 a few items arrived before their parent; the order now matches the full version.
  5. Slide 6's climax was a 14 dp stitch with no lamp. It now has the lamp, larger stitches, and the Mob gathering around the pennant.
- **The 0/1/2 rubric (internal; the owner signs off):** all 2 except performance at 1 (checked only in desktop Chrome and headless at 360 x 780, not on a low-end phone) and instrumentation at 1 (the events below are proposed, not built).
- **The metric to watch once built:** of students who open the explainer, the share who finish setup or join within the session. Guardrails: the Skip rate per slide, and the time to the first Mob game.

**What was verified (20 Oct).**
- Headless Chrome (playwright-core 1.62.1, channel chrome) at 360 x 780, Night and Day, full and reduced motion, with every slide's frames looked at, including mid-motion.
- `clicktest.cjs`: 32 checks with real mouse events:
  - every point on the phone hits phone content (no invisible overlay), on the Mob tab, slides 1 and 7 and the den;
  - tap right and left, swipe both ways, a short slow drag snaps back, ArrowRight, Next to slide 7, Skip from Start, Join and a replay;
  - the setup's live pennant and name tag, Start Steady Kites to the den, Mob settings replay, the join sample code to the den, and the Day and Reduced switches;
  - no console errors.
- Not verified: a real Android phone, a low-end device, or text scale 1.3.
