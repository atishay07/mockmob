# Mob v3: Den Live

Design pass, 19 Oct 2026, evening. Direction "Den Live", built on the Den v2 S7 screen the owner liked ("looking good with live play ... It looks cool"). Inputs: `../RESEARCH-GAME-SYSTEMS.md`, `../BRAND-MOTION-KIT.md`, `../RESEARCH-CHARACTERS.md`, `../../MOB-FACTS.md`, Den v2 and Arena v2. Nothing here is built, committed or deployed.

- Prototype (clickable, real motion, Night and Day, reduced motion): `prototype.html` in this folder. Open it in Chrome. The left panel lists the ten signature moments and the 23 screens. Haptic and sound cues show bottom right while a moment plays.
- Screens as PNG (360 x 780 dp, scale 2, Night and Day) and the contact sheet: `mockmob-next/tmp/design-1019pm/mob-v3/design-live/`.
- Motion: `.../design-live/motion/`. Each moment has a real-time `.webm` (the phone with the haptic and sound cues beside it), an animated `.webp` (25 fps, seeked frame by frame, so it is exact) and a `-strip.png` with eight labelled key frames. Night for all ten; Day for enter, podium and reveal; reduced motion for the podium and the countdown.
- How the webm was made: Playwright's `recordVideo` needs Playwright's own ffmpeg build, which is not on this PC, and I did not download it. So each webm is a real-time capture through Chrome's DevTools screencast (about 60 frames a second of the live page, with its real timers), encoded to WebM by Chrome's MediaRecorder at the captured timestamps.
- Every name, mark and time is an illustrative fixture, kept consistent across screens (see the header of `prototype.html`).

Characters: the friends are the generated "Folds" cast from `tmp/design-1019pm/mob-v3/characters/cut` (style C, lamp-lit folded paper, Mobi's visor grammar), copied to `assets/chars/<name>.webp`. They load from files: replacing `assets/chars/patang.webp` replaces Riya's character on every screen and in every moment with no code change. If a webp is missing the page falls back to the Den v2 vector paper folk in `assets/chars/<theme>/<name>.png`. The invite card uses the cast's group image (`assets/art/group-desk.webp`). Mobi, the stopwatch, metronome, foil seal and tokens are the app's own art.

Fixture cast: You (Aarav) is Dart, sky; Riya is Patang, rose; Kabir is Naav, blue; Zoya is Cutting, coral. (The Den v2 fixture had You in teal and Zoya as Pip; the generated Dart is sky blue and no Pip was generated, so the member colours follow the art.)

---

## 1. The concept in one paragraph

The Mob is a lamp-lit exam desk where your friends sit with folded paper. When a friend is in, their character stands in the lamp's pool with a "Here" tag; when nobody is, the lamp is down and the den shows what really happened ("Played 4:10 PM"). A Pro friend switches the lamp on for everyone by opening a live room: you ready up, a three-beat metronome counts you in, and you race the same five questions along a paper ruler, watching where your friends are but never what they picked. The podium is by CUET marks and is revealed like a stage: the lamp narrows, three paper blocks unfold, characters drop and land, and the desk bell rings for first. If you missed the room you still race it for 24 hours against your friends' real recorded runs (ghosts). Everything you earn is earned, never bought: the weekly Mob pennant gains a stitch, a quest stamps a foil seal and sends a parcel, and the parcel unfolds into a new character for everyone's shelf.

Brand test (from the kit): cover the logo and the screen is still MockMob, because every Mob screen carries at least three of paper, stamps or seals, lamp light, the single volt light, and exam stationery (ruler, OMR bubbles, stopwatch, metronome, desk bell, paper clip).

## 2. The game loop

1. **Open.** A Pro member opens a live room (or uses a pass the mic). The den changes: lamp up, a ticket "Live, Riya's sprint" on the den page, "Here" tags on whoever is in.
2. **Ready.** Friends join the lobby, send preset stickers, and tap "I'm ready". It starts when everyone present is ready.
3. **Countdown.** Three beats on the server clock, then Go.
4. **Race.** Everyone answers the same frozen paper at their own pace. The ruler shows positions, never picks. Right and wrong are shown to you alone, calmly.
5. **A friend finishes.** Their pennant goes up; nobody sees their marks yet.
6. **Podium.** By CUET marks (+5, -1, 0), with a "so far" label while anyone can still play the 24-hour twin. Then everyone's moment (one true, kind fact each), "Fix it together" on the question that caught most of you, preset stickers, and a rematch (Pro starts it; Free asks with a "Rematch?" sticker).
7. **Async twin.** For 24 hours anyone who missed it races the room's real runs as ghosts.
8. **Week.** Every question answered fills the weekly quest. Finishing it extends the Mob chain (a stitch on the pennant), stamps the foil seal and sends a parcel; the parcel opens into a character.
9. **Fix holds.** On Wednesday each person gets one fresh question on the trap. When everyone passes, a stamp goes on the den shelf; the third stamp brings a character.

## 3. The streak system

Two chains, never one fragile number. Taken from `RESEARCH-GAME-SYSTEMS.md` section 2, unchanged in rules, designed here.

**Your chain (personal, daily, private).**
- A day counts when you answer 5 questions in any mode on the IST day. Today shows progress truthfully ("2/5").
- Drawn as paper checks with a volt flag, one per day; a rested day is a dashed link with a moon, labelled "Rest". No flame (a loss idiom).
- Rest passes are earned: one on day 3, then one per 7 days of chain, plus one per 3 mistakes fixed that pass the Wednesday check. You hold 2 (3 in the final stretch). A pass applies itself, and the next open says so: "Friday was covered on its own."
- Make it up, free on every plan: within 48 hours of a miss with no pass left, 10 questions today restore the chain. Once every 14 days.
- If it still breaks: "A new chain starts today. Your best is 23 days." The best never drops. No red, no sad Mobi, no push.
- Exam pause: up to 14 days a season, set by the student. "Hide streaks" turns the chain off entirely.
- Milestones: 3, 7, 14, 21, 30, 50, 75, 100, 150 days. The path shows the next one as "2 more days", never as a countdown to lose.
- Pro changes nothing about the chain.

**Your Mob's chain (weekly, shared, owned by the group).**
- A week counts when the Mob finishes the week's quest (Monday 12:00 AM to Sunday 11:59 PM IST).
- Drawn as a stitched paper pennant on the den wall: one volt stitch per week in a row, the number on the paper.
- The quest counts questions answered, not marks, so nobody is dead weight. The quest card lists what filled it by game ("Monday's Mob paper, 3 of you: 30"), never by person, so no member's small share is ever visible.
- Size is a guess to test: 15 per member. "Resting this week" resizes it quietly without naming anyone ("Sized for 4 of you").
- A Week pass every 4 chain weeks (hold 1, applies itself). Break copy: "A new chain starts this week. Your best is 6 weeks."
- No countdown, no Sunday warning, no "waiting on you", ever.

## 4. Free and Pro

The rules both plans live under: participation is free; safety (streaks, passes, blocking, reporting) is free; marks are equal; collectibles are earned, never bought; Free sees every Pro item locked and honest.

| | Free | Pro (₹99 web for the season, ₹150 on Play) |
|---|---|---|
| Play every game your Mob starts, live or within 24 hours | yes | yes |
| Join live rooms, race ghosts, race your own ghost | yes | yes |
| Study Room (shared timer, no marks) | can start (needs his yes) | can start, schedule |
| Ask for a game ("Play?" sticker), all stickers | yes | yes |
| Your chain, rest passes, make-up, exam pause | identical | identical |
| Characters and the shelf, earned by playing | identical | identical |
| **Start live games, races, your own round, rematches** | no (locked, with the reason) | yes |
| Full mock together (50 questions, 60 minutes) | no | yes |
| Pass the mic: let a Free friend host one game | receive | 2 a week to give (needs his yes) |
| Mob Insights: where your Mob's marks slip | one line a week | full |
| Past weeks and the season recap | 2 weeks | all season |
| Den lamp themes | 1 | 6 |
| Mobs you can create | 1 | 3 |

How it shows on screen: the Free play picker (screen 05) leads with what Free can do now ("Riya's live sprint ... Join"), lists the four Pro formats as readable rows with a lock and the single reason "Pro members start games. Everyone plays them free.", then three free things (own ghost, Study Room, Ask for a game). The comparison (screen 07) states the price plainly and ends with "Nothing in the Mob is ever for sale."

Needs his decision (from the research, still open): opening the start gate while billing is off (otherwise nobody can start a game at launch); the free first game per Mob; Pass the mic; Free starting a Study Room; lifting the "one Mob paper a week across all Mobs" Free limit.

## 5. Live and async rules

- Live is a shared start and shared presence, not a forced pace. Countdown from the server clock (`server_now`), then each person answers at their own pace on one frozen paper.
- Presence shows only real channel entries: "Here", "Host", "Ready". Never "N friends online" without presence.
- Broadcasts carry only an opaque member id, state and question index. Never names, marks or picks. Marks are written by the server; the podium shows what the server stored.
- Your own right or wrong shows to you at once in a live game; friends never see it. Explanations and the shared trap open for everyone when the window closes.
- The live room and its 24-hour async twin are one object. A ghost is a real recorded run, labelled with name and time, moving at its real pace. No bots, no synthetic rivals, no "AI opponent".
- When nobody is in: "You're the first one here", with race their runs now, ask for a live game, or wait for Mob Time.
- Results say who has played without naming who has not: "One more can play until 8:02 PM tomorrow, so places can still change."
- A dropped player rejoins within 60 seconds from stored picks. On a connection quota error: "Live is busy right now. Play now and your Mob can catch up."

## 6. Screens, with exact copy

Each line "R2" answers: what does a first-time student think this screen wants from them?

**01 The den, live** (Mob tab). Header "Chai Circle", "Accountancy, 4 of you", "Ask Mobi". Den: pennant "4 weeks", shelf with two stamps and an empty slot, lamp on; Zoya dimmed (not here), Riya "Host", Kabir "Here", You "Here". Ticket: "Live" dot, "Riya's sprint", "Opened 8:02 PM. 5 questions, about 4 minutes.", key "Join the room", "Anyone who misses it can play until 8:02 PM tomorrow." Row "This week ... 41 of 60". Bottom bar unchanged.
R2: "My friends are in a game right now and I should join it."

**02 The den, quiet.** Lamp down, window with the moon; friends dimmed with "Played 4:10 PM" and "Played 4:55 PM" under Riya and Kabir; You "Here". Ticket: "You're the first one here", "Riya's sprint is open until 4:10 PM tomorrow. Race Riya's and Kabir's runs now, at the pace they really played.", key "Race their runs", link "Ask for a live game", "Mob Time: Sun 8:00 PM".
R2: "Nobody's here, but I can still race what they did."

**03 Your chain.** "12" "days in a row", "Your best is 23 days.", Mobi cheering. "A day counts when you answer 5 questions, in any mode." Seven links Tue to Mon (Fri "Rest", Mon "2/5"). "1 of 2 rest passes", "Friday was covered on its own. The next pass comes on day 14." "On the way": 3 days, 7 days done, "2 more days" to 14, 21, 30. October calendar, "Rest days are dashed".
R2: "I've done 12 days, today needs 3 more questions, and a missed day isn't the end."

**04 This week together.** Big pennant "4 weeks in a row", the four members' discs. "Your Mob's chain grows each week you finish the quest together. Nobody can break it alone. Best run: 6 weeks." Quest card "This week's quest", "Answer 60 questions together by Sunday.", "41 of 60", bar, rows "Monday's Mob paper, 3 of you 30", "Riya's sprint, 2 of you 10", "Practice members chose to count 1". Dashed card with Kandil's true silhouette: "Kandil comes to all your shelves when this quest is done. Sized for 4 of you; it starts again Monday."
R2: "We need 19 more questions this week, together, and Kandil is the prize."

**05 Play picker, Free.** Sheet "Play with your Mob". "Open now": "Riya's live sprint", "5 questions. Kabir is in the room.", "Join". "Start a game" with a "Pro" tag: "Live sprint" (5 questions, everyone at once), "Live race" (5 or 10 minutes, as many as you can), "Your own round" (any chapter, 5 to 20 questions), "Full mock together" (50 questions in 60 minutes), each with a lock; "Pro members start games. Everyone plays them free." "Free for everyone": "Race your own ghost", "Study Room", "Ask for a game". Link "See what Pro adds".
R2: "I can join Riya's game now; starting my own needs Pro, and I can still do three things free."

**06 Start a game, Pro.** "Live now" / "Over 24 hours". "Live opens a room now. Anyone who misses it gets 24 hours, and the room's runs come back as ghosts." Formats Sprint, Race, Your own round, Full mock. "Goodwill: Where your Mob lost the most marks last week", "Change". "Pass the mic: Let a friend host one game. 2 left this week." "Only starting needs Pro. Everyone in your Mob plays free." Key "Open the room".
R2: "Pick a game and open the room for my friends."

**07 Free and Pro in the Mob.** "Free plays everything. Pro runs the room and sees deeper. Marks, timing and streak safety are the same for both." Table (section 4). "Pro is ₹99 on the web for the season, to 31 July 2027, or ₹150 on Google Play. Nothing in the Mob is ever for sale." Key "See Pro".
R2: "Free isn't a trial; Pro is about hosting and insight."

**08 Ready up.** "Riya's live sprint", "Goodwill, 5 questions", sound switch. Den: Riya and Kabir with "Ready" stamps, You "Here", an open seat; Kabir's "Good luck" sticker floating. "Send a sticker": "Good luck", "Let's go", "One sec", "Ready". "Everyone gets the same 5 questions and answers at their own pace. Friends see which question you're on, never what you picked." Key "I'm ready", "It starts when everyone here is ready."
R2: "Tap ready; nobody will see my answers."

**09 Countdown.** Friends' discs, a paper tile with "3", "2", "1", then a volt "Go", the metronome ticking, "Question 1 of 5 is coming".
R2: "It's starting; get ready."

**10 Live race.** "Riya's live sprint", "Live, 3 of you in the room", stopwatch "3:12". The ruler strip: characters standing over their question number, names above. "Where everyone is. Never what they picked." "Question 3 of 5", "+5 if right, -1 if wrong", the question, four options A to D. Keys "Skip", "Lock in".
R2: "Answer at my own pace; skipping is allowed and costs nothing."

**11 Right answer.** Option B in the good colour with a drawn tick. "+5 Right. The average profit is ₹55,000, and three years of it is ₹1,65,000." Key "Next question".
R2: "I got it, and I can see why."

**12 Wrong answer.** Option A marked with "-1" in quiet ink, C drawn right. "Not this one. It was C. ₹3,00,000 is the whole business. Take away ₹2,40,000 of capital and goodwill is ₹60,000." "Saved to fix later. Nobody else sees this answer." (under the ruler) No shake, no red flash, no sound buzz.
R2: "I missed one; nobody saw, and it's saved for later."

**13 A friend finishes.** Riya stands at the flag in her colour. "Riya finished all 5. Take your time." Question 5.
R2: "Riya is done, I'm not being rushed."

**14 Ghost race (24 hours).** "Riya's sprint", "Racing Riya's and Kabir's real runs". Ghosts are faded characters with dashed markers; legend "Riya, 4:10 PM", "Kabir, 4:55 PM"; "4 s ahead of Kabir".
R2: "I'm racing what my friends really did earlier."

**15 Podium.** "Riya's live sprint", "3 of you played live". "Riya is on top so far", "One more can play until 8:02 PM tomorrow, so places can still change." Blocks 2, 1, 3 (place told by numeral and fold marks, not metal colour), names and marks under: You 19, Riya 20, Kabir 14. "Together you got 11 of 15 right." Key "Fix question 4 together", link "Ask for a rematch".
R2: "Riya won this one for now; next, we fix the question we missed."

**16 Everyone's moment.** "Riya finished first, all 5 in 2:10." "You got question 3 right in 14 seconds." "Kabir skipped question 2 instead of guessing. That kept a mark." Ticket "Fix it together", "Question 4 caught 2 of you. Each of you gets one fresh question like it, then one more on Wednesday.", key "Fix question 4 together". "Send your Mob a sticker": "Nice one", "So close", "Teach me", "Rematch?". "Riya can start a rematch with new questions. Your "Rematch?" sticker asks her."
R2: "Everyone did something good; the one we got wrong we fix together, without names."

**17 Fix it together** (redone after review; the first version was three plain cards). Subtitle "2 of you, one trap". A lamp-lit answer sheet on the den wall: "Question 4", "Why it looked right", OMR bubbles with your pick A struck through in pencil and C filled, "₹36,000 at 12% is ₹3,00,000. That is the value of the whole business, not goodwill. Take away the capital employed, ₹2,40,000, and goodwill is ₹60,000." Mobi thinking beside it. A two-stop path: "Now. One fresh question like it, only for you." "Wednesday. One more, to check the fix holds." "The den shelf", "0 of 2 have passed": two earned stamps, a dashed third slot and Crane's silhouette; "When both of you pass on Wednesday, the third stamp goes up, and Crane comes to all your shelves." Key "Try a fresh question".
R2: "Do one question now; Wednesday checks it stuck, and then we all get Crane."

**18 Streak milestone.** An arc of 14 paper checks (one dashed with a moon), the last one volt. "14", "14 days in a row", "You practised 14 days in a row, with one rest day on 16 Oct." Stickers "A rest pass", "Story page 3". Mobi cheering. Keys "Share", "Back to the den".
R2: "Two weeks, and I earned a rest pass."

**19 Character reveal.** "Earned: your Mob fixed 3 traps together". Crane standing in the open parcel under the lamp. "Crane", "Folds it a hundred times until it is right." Keys "Share", "Put Crane on the shelf".
R2: "We earned a new character for doing something real."

**20 Your shelf.** "Earned by playing. Never sold." "Earned 2 of 6": Crane ("3 traps fixed together", "New"), Stamp ("A 4-week Mob chain"), Kandil locked as its true silhouette ("41 of 60 this week"). Second shelf: Hop ("5 Mob games in a week: 2 of 5"), Foil Dart ("10 fixes that held: 6 of 10"), Lamp Patang ("Top of 3 podiums: 1 of 3"). "8 more for everyone. Pick any of them as you." "The story so far: 3 of 12 pages. Each page comes from something you did."
R2: "These are earned by doing things, and each one says exactly how."

**21 Invite.** "Save a seat for a friend". "Your Mob's code K7P 2M9", QR, "Works for 7 days, for up to 4 friends.", "Copy the code", "Show QR". "What your friend sees in WhatsApp": the cast's lamp-lit group image with the lowercase wordmark, "Aarav saved you a seat in Chai Circle", "An Accountancy Mob on MockMob. Code K7P 2M9." Key "Invite on WhatsApp".
R2: "Send this to a friend; this is exactly what they'll see."

**22 Join with a code.** "Join a Mob", "Scan QR". "Type the 6-character code your friend sent." K7P 2M9 boxes. "Chai Circle", "Accountancy, 3 of 5 seats taken". "Aarav saved you a seat. Pick who you'll be:" five characters, name "Ishaan", "First name only". "MockMob never asks for your contacts. Only your Mob sees your name. You can leave any time." Key "Join Chai Circle".
R2: "Type the code, pick a character, join."

**23 A Mob of one.** "Accountancy, just you". Den with you and four open seats, "4 open seats". "It's just you for now", "Your den already works. Race your own ghost, keep your chain and sit this week's Mob paper. Friends join with your code." "K7P 2M9 Your code". Key "Invite a friend", link "Race your own ghost".
R2: "It already works alone; inviting makes it better."

## 7. Motion: the ten signature moments

Shared rules (from the kit): one clock, the Mob beat of 600 ms; every moment opens with a light change; characters get squash and bounce, chrome keeps the app's tokens; at most three things move at once; any tap skips to the end in 200 ms (the podium has a visible "Skip"); a result is shown only after the server acknowledged it. Curves are the app's tokens: glide (0.15, 0.5, 0.5, 1), out (0.23, 1, 0.32, 1), emphasized (0.16, 1, 0.3, 1), leave (0.5, 0, 0.75, 0), sweep (0.45, 0, 0.55, 1), inOut (0.77, 0, 0.175, 1); springs celebrate 520/0.22, iconPop 420/0.18, settle 420/0, snappy 220/0.

Reduced motion in the prototype and the build: movement is removed, opacity changes stay but take 120 ms, and their timing is kept, because order is information (podium places, countdown beats). No particles, no sheen, no squash, idle loops off.

| # | Moment | Timeline (ms) | Layers, back to front | Sound and haptic | Reduced motion | Flutter technique | Cost |
|---|---|---|---|---|---|---|---|
| 1 | Enter the den (T2) | 0-200 fade in (emphasized); 0-420 lamp cone grows from 55% height (glide), pool fades; 120-480 desk rises 14 dp (out); 200 + 90 per character: rise 14 dp and 0.92 to 1 (iconPop), shadow widens 60 ms later; 420 + 90 per tag: name tags rise; 700: "Here" tags engrave (280); 260 pennant swings in (celebrate); 300 ticket rises 14 dp; 700 on: idle breath 1200 ms per character, offset 120 ms, stops 10 s after the last touch | wall and grid, lamp cone and pool, desk, shadows, characters, tags, ticket | none | 120 ms cross-fade, still | A (implicit/explicit animations), C (still puppets), one `AnimationController` per den | M |
| 2 | Go live (T2) | 0-240 key press 0.96; 140-500 volt circle wipes out from the key (out); 440 lobby fades in under it; 500-800 wipe fades to 6% then out by 1500; 640 your character turns 4 degrees; each real joiner hops in (560: rise 36 dp past -18, land with squash 1.08/0.88, settle) and gets "Ready" engraved 360 later | picker, wipe layer, lobby, characters, stamps | light at release; selection plus woodblock per joiner | wipe becomes a 120 ms fade; joiners fade in | A, `ClipPath` with a circle radius tween, C for hops | M |
| 3 | Countdown (3 beats + Go) | scrim 0 to 72% across 1800 (glide); each numeral at 0, 600, 1200: stamp in 1.25 to 1 in 180 (out), hold, leave 140 to 0.92 (leave); tile and metronome tilt 1.5 and 5 degrees per beat (inOut); 1800 Go in volt, ring 0.6 to 1.6 in 420, four glints; 2400 question rises 14 dp (glide) | lobby under scrim, discs, tile, numeral, ring, metronome, question | selection plus stopwatch tick per beat; light plus bright woodblock on Go | numerals cross-fade in place, beats kept | A, B (`CustomPainter` ring and glints), server-clock `Ticker` | S |
| 4 | Answer lock-in (T1) | 100-340 option press 0.96, selected at 180; 520 Lock in press; 640 paper clip drops 8 dp in 140 (snappy), others dim to 60% (160); 640-880 your character nods 3 degrees; 900-1200 you step to the next number on the ruler (glide, small hop), the number fills | options, clip, ruler, characters | selection on tap; light plus woodblock on lock | clip appears, dim 120 ms, no nod or hop | A, B for the clip, C | S |
| 5 | Right and wrong (T1) | Right: 0-200 good tint; 120-570 tick draws (drawIn 450, out); 120-820 "+5" floats 12 dp and fades; 120-540 your character nod-hops; 380 one glint; 160 line rises. Wrong (from 1500): cross-fade to question 4; 1800 wrong tint and border; 1880 right option tint, 1920 tick draws; 1900 "-1" in quiet ink; 1820-2240 your character tilts 6 degrees and back; no shake, no flash | option, tick, delta, ruler character, line | right: light (live only), woodblock a whole tone up (to three, then reset); wrong: no haptic, soft pat | tint and tick in 120 ms; no float, no nod | A, B (`PathMetric` tick), C | S |
| 6 | A friend finishes (T1) | 100-400 their character walks to the flag (glide), 400-820 hops 8 dp; 380 flag cloth grows from the pole in their colour (iconPop 280); 560 "Riya finished all 5." engraves (280) | ruler, character, flag, note | no haptic; page-flip sound | flag fades in 120 ms | A, B, C | S |
| 7 | Podium reveal (T4, about 4.8 s) | 0-400 scrim to 35% and the cone narrows to 62% (emphasized); blocks unfold rotateX 90 to 0 in 420 (emphasized) at 400 (third), 1000 (second), 1600 (first); each character drops 60 dp in 240 (leave), lands with squash 1.08/0.88 for 90 ms, bounces 3 dp, settles by 340; 10 paper bits at each landing; name and marks rise and count up (countUp 720); numeral engraves 280 after landing. 2200 first place: warm light swells (500, emphasized), foil sheen sweeps the block (700, sweep), 40 paper bits and 8 glints over 1400; 2700 the winner hops once. 3500 title engraves (420); 4200 keys rise; 4200-4800 scrim clears | wall, cone and swell, scrim, blocks with sheen, shadows, characters, names, particles, title, keys | light per landing with a rising woodblock; medium plus the desk bell for first; confirm after the server ack | final standing fades in as three 120 ms fades 600 ms apart; no particles, no sheen | A, B (bits, glints), C, D (one fragment shader for the sheen, Lite tier uses a gradient mask), `Transform` with `Matrix4.rotationX` for the unfold | L |
| 8 | Streak extends (T3) | 0-180 pennant lifts 8 dp (out); 180-680 number rolls 4 to 5 (emphasized); 300-1100 a volt thread runs the stitched border and the new stitch draws (drawIn 450); 800-1400 pennant settles 1.03 to 1; 820 glints ride the stitch; 1100 caption engraves | pennant paper, border thread, stitches, number, glints | confirm after the ack; two bell notes | number cross-fades, stitch appears | A, B (`PathMetric` thread), C | S |
| 9 | Character reveal (T3, earned) | 0-700 lamp held narrow; 200-760 parcel gathers 0.94 then wobbles 3 degrees each way; 560-1460 light leaks from the seam (0 to 90 to 50%); 640 seal pops; 660 + 60 per flap: four flaps unfold in 420 (emphasized); 900-1520 the character rises 90 dp out of the parcel (celebrate) with 22 paper bits; 1000 shadow grows; 1200 glints; 1400 name engraves; 1620 line rises; 1900 keys rise | wall, cone, leak glow, parcel and flaps, shadow, character, name, particles, keys | light at gather; medium at open; one bell note at the name | parcel cross-fades to the character, 120 ms | A, B, C, E (an image sequence only if the flaps are rendered art; the prototype draws them as vector flaps) | M |
| 10 | Quest complete (T3) | 0-300 the last segment fills and the count rolls 41 to 60 (glide); 320 + 45 per segment: each lifts 1 dp and brightens; 700-960 the bar folds away (leave); 820-1340 the foil seal stamps in 1.4 to 1 with a 2 degree settle (celebrate); 1000 a ring of 12 glints; 1200 "Quest done" engraves; 1400 the parcel card lights: Kandil's silhouette fills with colour, "Kandil is on the way to your shelf" | card, bar segments, seal, glints, headline, parcel card | medium at the stamp, then confirm after the ack; the desk bell | bar fills and the seal fades in at 120 ms | A, B, C, image for the seal | M |

Small ones: press 0.96 on snappy; sticker send flies 24 dp and rises (360); switching Mobs fades through (90 and 210); idle breathing only inside the den.

New tokens this needs (as the kit proposed): `mob.beat` 600 ms, a T4 `momentShow` ceiling of 6000 ms for the podium only, `mob.squash` 1.08 x and 0.88 y for 90 ms. The prototype doubled the den roll-call stagger from 45 to 90 ms because 45 ms across four characters read as one lump; this needs the kit's sign-off.

## 8. Truth and safety rules (checked on every screen)

- Every number has a source row: chain days (attempts by IST day), rest and made-up days (ledger), quest (sum of answered questions), podium (server marks), presence (a live channel entry), "Played 4:10 PM" (a recorded run), "4 s ahead of Kabir" (the recorded run's per-question times).
- Nothing depends on crowds: no "students online", no percentages of all students, no counts of who owns a character outside the Mob.
- Nobody is named for a wrong answer: "Question 4 caught 2 of you". Moments are only good, true facts. Non-players are never named: "One more can play".
- No free text between users: stickers are a fixed list sent as an enum. No photos; first names only, 2 to 18 characters.
- No guilt or loss: no countdown on a chain, no "you lost", no "behind", no "last", no exclamation marks, no sad Mobi. Places below third are not shown.
- Collectibles are earned by deterministic, stated rules, never bought, never random, never traded. The parcel shows its real silhouette before it opens, so the reveal is a show, not a draw.
- Notifications: none new here; Mob Time is an opt-in local reminder inside existing quiet hours.
- Runtime AI: none in play. Explanations shown are the bank's.

## 9. Build cost per piece

S is up to a day, M two to four days, L a week or more, for one Flutter engineer who knows the app's motion layer. Server work is listed separately and is the bigger risk.

| Piece | Size | Technique |
|---|---|---|
| Den scene widget (wall, grid, lamp cone and pool, desk, characters, tags, pennant, shelf), live and quiet states | M | `Stack` of `RepaintBoundary` layers; cone and pool as `CustomPainter` with `RadialGradient`; character puppets from stills |
| Character puppet (still image + breathe, nod, hop, squash, drop) | S | `Transform` driven by one controller per den; shadow ellipse painter |
| Ruler race strip with walking characters and ghosts | M | `CustomPainter` ruler, positioned puppets, `AnimatedPositioned` per question |
| Lobby, stickers, ready stamps | M | existing sheet and key components; stickers as an enum and a painter |
| Countdown on the server clock | S | `Ticker` against `server_now`, stamp animations, ring painter |
| Answer feedback, clip, tick | S | existing option component plus `PathMetric` tick and clip painter |
| Podium reveal with sheen and particles | L | rotateX unfold, particle painter (cap 60), one fragment shader for sheen (Lite: gradient mask), staged timeline with skip |
| Pennant and streak extend | S | painter with `PathMetric` thread |
| Chain screen (links, path, calendar) | M | painters plus a grid; reads the chain ledger |
| Quest card and seal stamp | S | segmented bar painter, image seal, glints |
| Parcel reveal | M | vector flaps (painter) or an evicted image sequence; character rise |
| Shelf and locked silhouettes | S | `ColorFiltered` silhouettes of the same art, rules from the server |
| Invite card (share image) | S | render the den card off-screen to an image with the SVG wordmark |
| Join with code | S | existing join flow with a 6-character field |
| Play picker Free and Pro, comparison | S | existing list rows and sheet |
| Sound (about 15 clips, package, silent-mode check) | M | needs his nod and a package choice |
| Server: rooms on `mob_extras`, private Realtime channels and RLS, presence, ghost run storage, chain and pass ledgers, 6-character codes | L | per `RESEARCH-GAME-SYSTEMS.md` section 4.2 and 6; staging first |

## 10. Needs his yes

1. Opening the start gate while billing is off, the free first game per Mob, Pass the mic, and Free starting a Study Room.
2. Sound on by default during games (with a switch in the lobby), and the T4 podium tier.
3. Mobi once per moment inside the Mob (Mobi appears on the chain, milestone, fix and "Ask Mobi").
4. Quest size of 15 per member, a guess.
5. The 90 ms roll-call stagger in the den.

## 11. Honest weaknesses

- The generated cast has one pose per character. The prototype moves them as still puppets (rise, hop, squash, nod, tilt), so nobody blinks or changes expression. Each character needs at least rest, cheer, think and wave poses (and Crane a "rising" pose) for the hop, the podium and the reveal to feel fully alive.
- Wide characters (Patang with its tail, Naav, Hop) crowd each other at four across in the den; the den needs per-character widths or a staggered depth row when the cast is final.
- Phirki and Pip from Den v2 were not generated, so the shelf uses Hop and the variants as silhouettes of Dart and Patang.
- Sound is specified but not heard: the prototype shows cues as text.
- Timings are craft judgements from the kit, not measured from rivals, and frame rates are unverified on a low-end phone or the emulator.
- The quiet den depends on how often a real Mob is in the app together; with only a few active students today, most visits will see the quiet state first, which is why it leads to ghosts rather than a wait.

## 12. Review loop (what I looked at and redid)

I read every PNG and every frame strip with the image viewer and changed what failed:
- Weakest screen, redone: "Fix it together" (17) was three plain cards with no den, paper or stamp. It is now a lamp-lit answer sheet with the struck-through pick, a Now-to-Wednesday path, and the den shelf with the two earned stamps, the empty third slot and Crane's silhouette.
- Weakest motion, redone: "Quest complete" (10) stamped a 64 dp seal inside the 16 dp bar, under the "Quest done" headline. Now a lamp sweep crosses the full bar first, the card's contents step back, a 112 dp foil seal stamps over the whole card with a ring of glints and paper bits, and the parcel card lights with Kandil's colour.
- Also fixed after reading the frames: animation segments that overrode each other on the same element (the countdown numerals, the podium winner's drop, the parcel wobble) are now single timelines; paper bits no longer sit visible before their moment; the go-live volt wipe now washes off the lobby instead of covering it; the finishing friend raises their own pennant instead of a hidden flag; the podium names were outside the stage; the milestone chain read as teeth and is now paper checks.
- Characters: the generated cast replaced the vector paper folk once it arrived, on every screen and in every moment.
