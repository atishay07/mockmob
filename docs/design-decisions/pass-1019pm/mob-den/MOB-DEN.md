# The Den: a Mob direction (key: den)

## v2 (19 Oct 2026 PM, after both judges picked the Den to build first)

Mock-up: `mockup-v2.html` in this folder (self-contained: the app's own fonts are embedded, no network). PNGs: `NEXT/tmp/design-1019pm/mob-den-v2/` (start with `contact-sheet.png`; every screen at 360 x 780, deviceScaleFactor 2, Night and Day; `avatars-24-night.png`, `avatars-24-day.png`, `avatars-heads-24dp-40dp.png`; `strip-reveal-{night,day}.png` and `strip-lobby-{night,day}.png`, with single frames in `frames/`). Captured with headless playwright-core 1.62.1 on channel `chrome`; `mockmob-next/node_modules` has no playwright-core today, so the same package from the Codex runtime cache was used, and the browser was closed after each run. Nothing was built in Flutter and nothing was committed. **Where v2 and the v1 text below disagree, v2 wins.**

### One fixture, consistent everywhere
Monday 19 Oct. Chai Circle, Accountancy, 4 members in join order: Aarav (you, who started it), Riya, Kabir, Zoya. Riya opened a 5-question Goodwill sprint at 2:05 PM, open for 24 hours (until 2:05 PM tomorrow). Riya played at 2:10 PM, Kabir at 4:55 PM, Zoya at 6:30 PM, you at 8:40 PM. Answers: Q1 B, Q2 A, Q3 B, Q4 C, Q5 D.

| Player | Q1 to Q5 | Right, wrong, skipped | Marks | Seconds per question | Finish |
|---|---|---|---|---|---|
| Riya | right, right, right, skip, right | 4, 0, 1 | 20 | 38, 35, 44, 18, 29 | 2:44 |
| You | right, right, right, B (wrong), right | 4, 1, 0 | 19 | 30, 34, 41, 52, 17 | 2:54 |
| Kabir | right, right, right (changed), B (wrong), right | 4, 1, 0 | 19 | 26, 42, 55, 33, 31 | 3:07 |
| Zoya | wrong, right, right, B (wrong), right | 3, 2, 0 | 13 | 20, 25, 24, 35, 36 | 2:20 |

What this makes true on every screen: 15 of 20 right. The Q4 trap is 3 of 4 picking B (₹3,00,000) and nobody right, so the trap rule (3+ sitters, picked by 2+ and half+) holds, and 3 people missed it ("0 of 3 fixed so far"). At 1:12 into your run you are on question 3 (you arrived at 64 s), Kabir is on 3 (68 s), Riya on 2 (she reaches 3 at 73 s) and Zoya on 4 (69 s). The track draws exactly that, and the chip "4 s ahead of Kabir" comes from the same arrival times (it compares you with the friend who reached your question closest in time). The quest counts marks from Mob games only: 20 + 19 + 13 = 52 before you play, 71 after. The pennant shows 3 weeks, so Stamp (a 4-week streak) is still locked; the shelf shows 2 stamps, so Crane (fix 3 traps) is still locked. The mock-up checks the marks and the 15 of 20 in code.

### Fatal issues fixed
- **Scoring.** CUET marks (+5, -1, 0) are the only score: the podium labels ("20 marks"), the tie line ("You and Kabir tie on 19, so you share second."), the quest ("Earn 300 marks together in Mob games.") and the runner pill "+5 if right, -1 if wrong". Riya skipped Q4 and wins with 20; you guessed and lost a mark. The order and the skip lesson now agree. A game below zero adds nothing to the quest, so playing never sets the Mob back. There is no speed tie-break anywhere.
- **Smart skip.** Facts only: "Riya: skipped question 4 instead of guessing." It shows only when most of the Mob's answers on that question were wrong. Nothing claims a saved mark.
- **Symbols.** The Scarf extra (it read as a handgun) is replaced by **Bow**, a bow tie, drawn and labelled. Phirki's 4-blade pinwheel had hooked 4-fold rotation, which can read as a hate symbol at small sizes; it now has 6 curled blades. Topi is now a wide, printed newspaper hat, so it cannot read as a pointed hood. The streak flame (a loss idiom) is now a paper check. Every extra in S5 has a word under its icon. Checked again: the six stickers (thumb mitten, target, book, arrows, star, crumpled paper), all 24 bodies and the six extras.
- **Privacy.** "Played today" comes from Mob games only, drawn as an open paper on the table in front of Riya, Kabir and Zoya; nothing is drawn for anyone who has not played. Practice days are a separate switch, off by default (S8). The join preview shows only "Chai Circle, Accountancy" and "3 of 5 seats taken", with characters and no names.
- **No fake presence.** S1, S2 and S3 show the async first build: "You play first. Then your Mob has 24 hours, and each run shows up as it lands." Presence appears only on S7, tagged "Later, with live play. Not in the first build."
- **Mob of one (R3).** S6b keeps "This week's Mob paper: 10 questions, 10 minutes. You can sit it now; friends who join can too." with "Sit it". No line says games wait for a friend.
- **Pip** now "Keeps everyone's notes in order."
- **Quest bar** is one neutral fill, not split by member, and counts Mob-game marks only, so it shows nobody's practice volume.

### Grafts taken
- **Ghost race card** (S3) with the pace chip computed from the positions the track draws (neutral ink when behind, never red) and "Each friend shows where they were at this moment of their own run." Ghost scores are no longer shown during play.
- **Reveal** (S4). The plinths are paper stacks that slide up from behind the floor line, each offset by its own height on the same curve, so their heights stay in true proportion at every frame and nothing scales from 0. The tallest stack stays empty until Riya lands (the Den's suspense, kept). Marks count up together from one clock (numberRoll 500 ms on the out curve), so the order is true at every frame. Timeline: collective line 0 ms; stacks 120 to 540; Zoya lands at 560, you and Kabir together at 700 (a tie lands together), Riya at 880; counters 1000 to 1500; rosette 1500 (lamp amber, a token colour); tie line 1540; "Everyone's moment" rows from 1600, 45 ms apart, 240 ms each; footer 1700 (240 ms drawer). Settled by 2000 ms, as the frames show.
- **Everyone's moment**, with a head and a name on every row and a fixed rule order: 1 skipped a question most of the Mob got wrong, instead of guessing; 2 the only one to get a question right; 3 fastest right answer; 4 changed an answer to the right one; 5 quickest finish; 6 fixed last week's trap; fallback "Played all five." Each player gets the first rule that is true for them, and a rule with one winner goes to one person.
- **Trap progress as a count only**: "0 of 3 fixed so far" (S4b) and "1 of 3 passed today" with three unnamed segments (S4d).
- **Picker** (S2): Sprint is preselected, and its chapter defaults to the Mob's last unfixed trap, else the student's weakest chapter ("Admission of a partner", "Your weakest chapter so far", with "Change"). One tap starts it. The weekly Mob paper has its own row, no longer merged into "Full mock together".
- **Mob of one** (S6b): the code, the QR, "Invite on WhatsApp", the "Aarav saved you a seat in Chai Circle" card, "Copy the code" and "Join with a code" on one screen.
- **Create** (S6a): six name chips plus "Show six more" (no fake text field and no unlabelled die), and "Your Mob sees your marks, and one switch keeps them private."
- **Mobi's kit** on all 24: an antenna with a bulb in the character's own light paper tone, rubber-hose arms with mittens and thumbs, boots with a cuff, and the lamp rim on Night limbs. Lime stays Mobi's alone; the default "You" is Dart in teal.
- **Wednesday check** (S4b, S4d): fix it now with one fresh question, then one more on Wednesday (two days later, named by its weekday). The shelf stamp goes up only when all three pass Wednesday's check.
- "Your Mob got 15 of 20 right together." sits above the podium, and **ties share a height** (you and Kabir on equal stacks, both "2").
- **Received stickers as chips** ("Kabir: Teach me", "Zoya: Proud of us"). Stickers go to the whole Mob, so the landing target is never ambiguous, and labels are 13 px.
- **"Show a podium"** per Mob (S8), on by default. Off shows everyone's marks in join order with no places. The person who started the Mob can change it.
- **Idle loops stop 10 s after the last touch**; a touch, key or scroll restarts them, and reduced motion paints still frames.
- **S4c** (Zoya's view at 6:31 PM): "Riya is on top so far.", "One more of your Mob can still play until 2:05 PM tomorrow." (it names nobody), a dashed "Still to play" place, and the answers held until everyone has played or the game closes.

### Characters redrawn
Crane is now a side-view origami crane (a long neck with a bent beak, one swept-back wing and a low tail), so it reads as a bird, not as horns. Phirki has 6 curled blades round a hub. Pankha is a real pleated fan with a zigzag edge, alternating pleats, a brass rivet and a handle. Topi, Patang (its antenna leans left, so it never reads as a pink Mobi) and Dart (wing folds) were also adjusted. `avatars-heads-24dp-40dp.png` shows all 24 at 24 dp and 40 dp in both themes.

### Screens in v2
S1 the den (async), S2 picker, S3 ghost race, S4 results, S4b results scrolled (trap, Wednesday plan, quest at 71 of 300, stickers), S4c results while one more can play, S4d after the fix (Mobi's one moment), S5 character picker (all 24 above the key, locked ones visible), S6a start, S6b Mob of one, S6c join (Zoya's phone), S8 Mob settings, and S7 later, with live play.

### Needs his yes (each with my recommended default)
1. **Ranking inside a Mob game** (reverses P5). I recommend yes: inside one game only, in CUET marks, with ties sharing a place, no number for anyone below third, and the per-Mob "Show a podium" switch on by default. The weekly Mob paper stays cooperative.
2. **Showing who practised today** (reverses P6, and touches minors' consent, P12). I recommend the den shows only who played a Mob game today, which every member can already see. Practice days across the app stay behind "Show my practice days", off by default, and show days only, never how much.
3. **A weekly Mob streak** (T005). I recommend yes: weeks in a row in which the Mob finished its quest, with no warning or countdown ever. A missed week quietly starts a new run, and the best run stays on the shelf.
4. **6-character join codes** (8 today, so a migration). I recommend yes: Crockford letters, shown as "K7P 2M9", a 7-day life and the join limit of 10 an hour unchanged; 8-character codes keep working until they expire.
5. **Who may open extra rounds** (Pro only today, 3 a week; D101). I recommend any member, Free or Pro, up to 3 games a day per Mob, since games use bank questions and no AI. "Full mock together" stays Pro, visible and locked when billing is off. S2's caption "Your Mob can open 2 more games today." assumes this.

### Still weak in v2
- Ghost heads at 62% opacity are low contrast, most of all by Day; they need a contrast check.
- The idle breathe is so subtle that the lobby frame strip barely shows movement. That calm is on purpose, but it is untested on a device.
- Five members at the table, and long names, are still not drawn; only four are.
- All motion is checked in a browser only, not on the emulator (R5); 412 dp and large text are not checked.
- The 300-mark quest size and the sticker set are guesses to test with real students.

---

## v1 (kept as history)

Pass 1019 PM, one of three Opus directions for the owner's pick (R8). Mock-up: `mockup.html` in this folder (open it in a browser; tap a sticker on S4, tap a character on S5). PNGs: `NEXT/tmp/design-1019pm/mob-den/` (contact sheet `contact-sheet.png`, characters `avatars-24-night.png` / `avatars-24-day.png`, frame strips `strip-reveal-night.png`, `strip-lobby-night.png`, `strip-reaction-night.png`). All names and numbers in the mock-up are illustrative fixtures. Nothing is built in Flutter.

## The concept in two lines
Every Mob gets a home: a lamp-lit den where each friend is a paper character at the same table, and the room only ever shows what really happened (who practised today, who is here now, what the Mob earned).
You play together in short games that work whether friends are online now or later, and every game ends at the same place: the question the Mob missed most, fixed together.

Why a den: the owner asked for Duolingo clarity and delight, a 10/10 social game, and characters instead of photos. A room is the clearest possible picture of "my friends": you see them, at a glance, before you read a word. It also carries every social signal as an object (an open paper, a lit pennant, a stamp on the shelf), so the screen needs very little text. It belongs to MockMob because the characters are exam stationery and the lamp light is Mobi's own lamp light (`mobi_palette.dart` lamp pool `F2A93B`).

## The game loop
**A day (3 to 15 minutes).** Open the Mob tab and the den shows who practised today (an open paper with a lime check) and who is here now (a "Here" tag). The one big key is the most useful game for you right now: a friend's open challenge ("Play Riya's sprint"), else "Play with your Mob". Play a 5-question sprint or a 5- or 10-minute race. If a friend is here, they play live; everyone else gets 24 hours, and their run comes back as a ghost that moves at their real pace. Results: a paper-stack podium, one honest highlight for each person, then the question the Mob missed most with "Fix it together". React with a preset sticker. Rematch if you want.
**A week.** Monday a quest appears ("Answer 120 questions together"), sized to the Mob. Every question any member answers anywhere in the app counts, shown as a bar split by member colour. Finishing it unlocks a cosmetic for everyone and lights the week on the streak pennant. The weekly 10-question Mob paper (built today) stays as the Mob's shared fixed point inside "Full mock together". Sunday 11:59 PM IST the week closes; fixed traps go on the shelf as stamps.

## Mechanics
Asked for, and how the Den does them:
1. **The den lobby** (S1). Avatars, practised today, here now, streak pennant, quest, one key.
2. **Flexible play** (S2): Sprint (5 questions), Race (5 or 10 minutes), Custom (chapter and length), Full mock together (the weekly Mob paper or a full CUET mock), Rematch.
3. **Paper folk avatars** (S5): 24 original characters, colour and one extra; 4 earned by quests.
4. **Results with avatars** (S4): podium, highlights, "Fix it together", preset stickers, Rematch.
5. **Effortless join** (S6): preset name, WhatsApp card, 6-character code above the keyboard, QR for friends sitting together.

Proposed, not asked for (each: why it works for a 16-17-year-old preparing for CUET; how it stays true; how it stays safe):

| # | Mechanic | Why it works | Truth | Safety for minors |
|---|---|---|---|---|
| M1 | **Mixed play: live with whoever is here, 24 hours for the rest.** One game, no mode switch. The picker says it in one sentence: "Kabir is here, so he plays live with you. Riya and Zoya get 24 hours to play." | Teenagers' evenings do not line up (tuition, family, phones taken away). Waiting for everyone kills small groups; this never waits. | "Here" means the app is open on the Mob right now (presence heartbeat under 60 s). Nobody is ever shown as here from a guess. With no one here, the sentence says so and the game is simply a 24-hour challenge. | No chat in live play: only positions and preset stickers. |
| M2 | **Ghost runs.** Friends who played earlier race beside you as half-transparent markers, moving at the pace they actually answered. | It gives the thrill of a live race with friends who are asleep; it also teaches CUET pacing (you see that Riya spent 40 seconds on question 3). | Built from data the server already stores: `mob_sittings.detail.t` (seconds per question). Labelled "Played earlier" and "They move at the pace they really played." Ghost scores appear only after they finished. | Shows pace and score only, and only to Mob members who share answers (existing both-share rule). |
| M3 | **Fix it together** (the Mob's trap, made into a move). After results, the question the Mob missed most opens a shared repair: each person who missed it sees why, then gets 2 check questions; when everyone who missed it passes, a stamp goes on the den shelf. | It turns the social moment into Score Recovery (find, fix, check) and makes being wrong a group thing instead of a private shame. | Aggregate only: "3 of you picked ₹1,80,000". Uses the existing trap rule (3+ sitters, picked by 2+ and half+). The stamp appears only when the check questions are really passed. | Never names who got it wrong; counts only. |
| M4 | **Stump the Mob.** Once a week each member may drop one question they got wrong (from their own Review) into the Mob's next sprint. Results say "Kabir's stumper: 2 of you got it." When the dropper later gets it right on a check, it counts as fixed. | Your mistake becomes useful to friends; it is the kindest form of competition and it doubles practice on real weak spots. | Real bank questions only; no invented "hard question" labels; the count is real. | No text attached, only the question; the dropper's name is shown only inside the Mob. |
| M5 | **Lamp hour.** The Mob picks one study hour from fixed slots (for example 7 to 8 PM). One calm notification at the start; during the hour the den is likely full, so live play really happens. | Small groups only feel alive if they overlap; a shared hour concentrates the few friends you have. It is also a study habit. | Live presence is only promised inside the hour when people really open the app; the den never fakes a crowd. This also keeps realtime cost to one short window. | Fixed slots only, never after 10 PM, one notification a day across all Mobs, muted on exam days the student sets. |
| M6 | **The shelf: shared, permanent rewards.** Fixed traps become stamps; finished quests unlock a character for everyone; the shelf never loses anything. | Visible shared progress is what makes a group feel like a team. Rewards are cosmetic and can never be bought. | Every object maps to a real event (a quest finished, a trap fixed). Empty slots show as dashed outlines with what earns them. | No loss, ever (T005). |
| M7 | **Smart skip highlight.** Results can praise "no wrong answers, and one smart skip". | CUET marks +5 and -1; knowing when to skip is a real exam skill that most 17-year-olds never practise. | Computed from picks (blank = -1 in `picks`). Only shown when the skip really saved marks. | Positive only. |
| M8 | **Preset everything that could carry words:** Mob names from a fixed list with a shuffle (die icon), 6 preset stickers, preset highlights. | Fun names with no moderation burden. | Not data, just safe labels. | No free text beyond the first name (already 2 to 18 characters, validated). |
| M9 | **Pace Mobi for a Mob of one.** While you wait for friends, you can sprint against Mobi, who answers at the CUET pace (72 seconds a question: 50 questions in 60 minutes). | The empty state still has a game. | Mobi is plainly Mobi, never a fake person, and his pace is a stated rule, not a crowd average. | No social data at all. |

Deliberately not used: named nudges ("Riya is waiting for you"), countdown timers on the lobby, a cross-Mob league, a streak that threatens loss, free-text anything, read receipts.

## Screen by screen (exact copy, R6; R2 line for each)

### S1 Mob home, the den
Top to bottom: your character disc, Mob name with a switcher chevron ("Chai Circle", "Accountancy, 4 members"), Ask Mobi; the den (window shows the real time of day; streak pennant "4 weeks" / "in a row"; shelf with stamps and one dashed slot; four characters at the table; open paper with a lime check in front of everyone who practised today; names; "Here" tag under anyone present now); line "Riya and Kabir practised today."; challenge "Riya sent you a sprint" / "5 Accountancy questions. Riya and Kabir have played. Open until 8:40 PM tomorrow."; key **"Play Riya's sprint"**; text button "Start a different game"; quest card "This week's quest", "Answer 120 questions together.", "84 of 120", "Kandil unlocks for all of you", "Ends Sunday".
No open challenge: the key reads "Play with your Mob" and opens S2. Nobody practised today: the line is left out (never "0 practised"). Week closed: quest card says "This week's quest is done. A new one starts Monday."
R2: "My friends are here; Riya sent me a sprint, so I tap Play."

### S2 Play picker (sheet over the den)
"Play with your Mob"; presence box "Kabir is here, so he plays live with you. Riya and Zoya get 24 hours to play." (nobody here: "Nobody else is here right now, so this goes out as a 24-hour challenge."); rows with a radio: Sprint "5 questions, about 4 minutes."; Race "Most right answers in the time." with 5 minutes / 10 minutes; Custom "Choose a chapter and a length."; Full mock together "This week's paper or a full mock."; Rematch "Tuesday's race with Riya and Zoya."; key **"Start a 10-minute race"**; caption "Riya and Zoya can play until 8:40 PM tomorrow."
R2: "Pick a game. Kabir is here and plays live; the others get 24 hours. Start the race."

### S3 In play
Header "Riya's sprint", "Question 3 of 5", elapsed clock. Track: Q1 to Q5 with your character, live friends (lime "Live" tag), ghosts (half-transparent with a dashed shadow). Legend: "Zoya is playing now.", "Riya played at 2:10 PM and scored 4 of 5.", "Kabir played at 4:55 PM and scored 3 of 5.", "They move at the pace they really played." Then the question and four options. Keys: "Skip", **"Next question"**. No right or wrong is shown until results (same rule as mocks), so ghosts never spoil an answer.
R2: "Answer this question. Riya and Kabir played earlier; Zoya is playing right now."

### S4 Results
Header "Riya's sprint", "Everyone has played" (or "Zoya can still play until 8:40 PM tomorrow", and her place stays an empty outline). Podium of paper stacks (2, 1, 3), names and "4 of 5"; anyone below third stands on the floor with no position number. Tie line "You and Riya both got 4. You were 21 seconds faster." Highlights: "You: fastest right answer, in 11 seconds." "Riya: no wrong answers, and one smart skip." "Kabir: changed question 3, and got it right." "Zoya: the only one to get question 5." Card "The question your Mob missed most", "Question 4: 3 of you picked ₹1,80,000. See why together, then check it with 2 new questions.", key **"Fix it together"**, secondary "Rematch". Sticker tray "React": Nice one, So close, Teach me, Again?, Proud of us, Oof.
Ranking rule: only inside one game, only among the Mob, ties broken by time and said in words, everyone gets a highlight. The weekly Mob paper keeps today's cooperative ring (no ranks).
R2: "I came first on time. Now we fix question 4 together, or rematch."

### S5 Character picker
"Your character"; stage with the chosen character waving, name (headline) and its line; "Colour" (8 swatches); "One extra" (None, Headphones, Cap, Specs, Scarf, Star pin); "Characters" with "4 more come from Mob quests" and the grid (locked ones dimmed with a lock and named quest on tap); key **"Use Dart"**; caption "Only people in your Mobs see your character."
R2: "Pick who I am in the Mob, give it a colour and one extra, then tap Use."

### S6a Start a Mob
Den preview with you and four "Free seat" outlines; "Your Mob's name", the name ("Chai Circle") with a shuffle button; "Names come from our list, so every Mob name is kind. Shuffle for another."; "Subject you will play" chips; "You join as Aarav, playing Dart", "First names only. Change it any time.", "Change"; key **"Start Chai Circle"**; "Next, you can invite up to 4 friends."
R2: "Keep or shuffle the name, pick the subject, start."

### S6b A Mob of one (empty state)
"Chai Circle", "Accountancy, just you"; den with four free seats; "Save a seat for a friend"; "Play together once one friend joins. A Mob holds 2 to 5 friends."; preview of the WhatsApp card ("Aarav saved you a seat in Chai Circle", "Accountancy on MockMob. Code K7P 2M9"); "This is the card your friends see in WhatsApp."; key **"Invite on WhatsApp"**; "Show QR", "Copy code". (M9 adds a quiet row: "Sprint with Mobi while you wait.")
R2: "Nobody else is here yet. Send the WhatsApp invite."

### S6c Join with a code
"Join a Mob", "Scan QR"; "Type the 6-character code your friend sent."; six boxes (grouped 3 and 3); as soon as the code matches, a preview "Chai Circle, Accountancy", "Riya, Kabir and Zoya are in. 2 seats left."; key **"Join Chai Circle"**; "Sitting together? Tap Scan QR and point it at their screen." The whole block sits above the keyboard (268 dp keyboard; key ends at about y 470 on a 780 screen). Wrong code: "That code doesn't match a Mob. Check it with your friend." (a bad code and a block read the same, P10).
R2: "Type the code, check it is the right Mob, join."

## Motion spec (tokens from `motion_tokens.g.dart`; R5 frame plan)
| Moment | What moves and why | Duration and curve |
|---|---|---|
| Lobby at rest | Characters breathe (scaleY 1 to 1.028 from the feet, staggered by 900 ms) so the room feels inhabited; eyes blink on 5.2 s cycles; the pendant lamp sways 1.4 degrees; the lamp pool breathes 0.86 to 1; the "Here" dot pulses (presence only). Loops stop after 12 s without touch and under reduced motion. | breathe 3600 ms sweep (0.45,0,0.55,1) alternate; blink 5200 ms; sway 6400 ms sweep; pulse 1800 ms out (0.23,1,0.32,1) |
| Results reveal | Third, second, first stack grow from the floor (suspense ends on you or the winner), then each character drops onto its stack with a small settle, names and scores rise, the gold rosette pops on first, highlights stagger in, the trap card rises, the sticker tray docks. Tap anywhere skips to the end state. | stacks emphasized 420 ms (0.16,1,0.3,1) at 0/120/240 ms; characters 420 ms out with 2 px overshoot (under the 0.12 bounce cap) at 360/480/600/720 ms; rank numbers and names 260 ms; rosette iconPop 420 ms at 900 ms; tie line 360 ms at 1000 ms; highlights enter 360 ms at 1150 + 60 ms each; card at 1500 ms; tray drawer 360 ms (0.32,0.72,0,1) at 1700 ms; total 2060 ms (within momentT3 2000 plus the tray) |
| Reaction | The sticker lifts, arcs to the friend's character, lands tilted and settles like a slap-on sticker; a count appears if several. Haptic light tick on land. | 620 ms glide (0.15,0.5,0.5,1): scale 1.25 at 55 %, land 1.12 at 86 %, settle 0.92 |
| Choosing a character | The old one ducks out, the new one pops up and waves; name and line swap. | out 200 ms exit (0.4,0.3,0.8,0.6); in enter 360 ms emphasized; wave 1400 ms alternate |
Reduced motion: every end state is painted at once; information never lives in motion (ranks, scores and presence are all words too).
R5 frames captured in the browser (not yet on the emulator): reveal 12 frames at 0, 150, 300, 450, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000 ms; lobby 10 frames every 600 ms; reaction 7 frames to 620 ms. In the Flutter build, the same timestamps are captured on the emulator and compared with these strips.

## The paper folk: avatar design system
**Shape grammar taken from Mobi** (`APP/lib/core/mascot/`): Mobi is a square of paper folded into a tilted diamond with a dark visor, capsule eyes, an antenna, rubber-hose arms with mittens and stub legs with boots. His family keeps everything except the shape: each member is a different piece of exam stationery, folded. Rules: one flat paper body with soft (rounded, pillowy) corners; one fold or crease that shows how it was made; Mobi's visor (dark gradient, gloss band) with two capsule eyes and no mouth, so all expression lives in the eyes (open, smile, slant, lid, curious); limbs and boots in Mobi's soft black (`262421` by day, lifted to `4A453E` at Night so they read); one topper per character (bow, paperclip, string, tassel, steam). Lime belongs to Mobi alone, so the family never uses it.
**Palette**: the 8 Mob member colours, lifted into paper tones that read on both grounds (base, light, deep): rose FF8796, blue 7F98FF, violet BC93FF, teal 4CCBAE, amber F4B04A, sky 5FBEF2, coral EA9764, green A7C650. Same paper in Night and Day; only the light changes (Mobi's rule).
**Customisation**: any of the 8 colours, plus one extra: headphones, cap, specs, scarf, star pin, or none.
**The 24** (default colour; line):
1. Patang, kite (rose): Rises fastest when the wind is against it.
2. Dart, paper plane (teal): Answers first, then checks every answer twice.
3. Ticket (amber): Always the first one into the exam hall.
4. Dog-ear, page with a folded corner (sky): Folds a corner on every question that tricked them.
5. Pip, envelope with a letter (coral): Keeps everyone's notes, and everyone's secrets.
6. Naav, paper boat (blue): Stays steady when the paper gets rough.
7. Teller, folded fortune teller (green): Guesses wisely, never wildly.
8. Sticky, sticky note (amber): Remembers the formula so you don't have to.
9. Scroll (violet): Reads the whole passage. Then reads it again.
10. Pankha, pleated fan (blue): Cools the room down before a big mock.
11. Tara, folded star (rose): Saves the best for the hardest question.
12. Tag, label with a string (green): Knows which chapter every question comes from.
13. Tally, receipt (sky): Counts every mark, including the minus ones.
14. Ribbon, bookmark (rose): Always remembers where you stopped.
15. Hexa, origami cube (teal): Builds every answer one step at a time.
16. Cutting, chai cup (coral): Runs on chai and practice papers.
17. Hop, origami frog (teal): Jumps straight back after a wrong answer.
18. Ruled, notebook page (sky): Keeps neat working, even with a timer running.
19. Admit, admit card with the face in the photo box (blue): Already pictures exam day, and smiles about it.
20. Topi, paper hat (coral): Has a plan for every paper, and wears it.
21. Crane (violet, Mob quest: fix 3 Mob traps together): Folds it a hundred times until it is right.
22. Kandil, paper lantern (amber, Mob quest: answer 120 questions together in a week): Lights up the den on late nights.
23. Phirki, pinwheel (violet, Mob quest: play 5 Mob games in one week): Spins faster whenever the Mob plays.
24. Stamp, postage stamp (green, Mob quest: keep a 4-week Mob streak): Seals every fix with a check.
Quest characters, once earned, are kept for good, even if the student leaves the Mob.

## Truth and safety rules
- Only real events: practised today (any saved answer since midnight IST, only for members who leave "Show that I practised today" on; a member who turns it off is simply absent from the line, never shown as "not practised"); here now (heartbeat under 60 s); ghost pace and scores (stored seconds and picks, both-share rule); quest totals (real answered questions of members who share activity); shelf objects (real quest completions and passed check questions).
- Counts under the Mob size are fine because they are friends, but there are no cross-Mob numbers, no crowds, no "students online", no fake opponents. Pace Mobi is labelled as Mobi.
- The streak counts weeks in a row in which the Mob finished its quest. A missed week starts a new run quietly ("A new run starts Monday"); the best run stays on the shelf; nothing earned is ever removed. No countdowns on the lobby.
- Minors: first names only (existing 2-18 rule), characters instead of photos, preset names, stickers and highlights, no chat, no DMs, no free text, no contact access, report, leave and block stay exactly as built. Notifications: at most one Mob notification a day across all Mobs, none between 10 PM and 7 AM IST, none during a paper, none that name who has not played, no read receipts.
- Invites: the WhatsApp card carries only the inviter's first name, the Mob name, the subject and the code. Codes expire in 7 days as today.

## Build cost and order
| Piece | Cost | First build or later |
|---|---|---|
| Paper folk in Flutter (CustomPainter from the parametric spec, disc and full modes, idle) + `mob_members.avatar`, `avatar_colour`, `avatar_extra` | M | First |
| Den lobby S1 (scene, practised today flag with its switch, quest card) | M | First |
| Async play: Sprint, Race, Custom on `mob_extras` (open lengths 5/10/15/20, per-Mob weekly cap, who may create: policy) + runner time limit for Race | M | First |
| Ghost runs from `detail.t` | M | First |
| Results S4 (podium, highlights computed server-side, tie line) | M | First |
| Fix it together (reuse the trap + repair flow, stamp) | M | First |
| Preset stickers (`mob_reactions` with a fixed enum) | S | First |
| Weekly quest and week streak (computed from attempts and sittings) | M | First |
| Join: 6-character code (server change from 8, Crockford), WhatsApp share card image, QR show and scan | S to M | First (QR scan can follow) |
| Preset Mob names | S | First |
| Live presence and live play (Realtime channel authorised by the API, heartbeats, server-timed race) | L | Later |
| Lamp hour (needs the push sender) | L | Later |
| Stump the Mob | M | Later |
| Pace Mobi | S | Later |
| Web parity (`WEB/src/components/mob/*`) | M to L | After the app pick |
Until live play exists, S2's presence box reads "Everyone gets 24 hours to play." and every game is a challenge; the design already handles that state.

## Decisions this needs from the owner
1. Ranks inside a single Mob game (podium) reverse SOCIAL-SPEC P5 "never ranked"; the Den keeps the weekly paper cooperative. Yes or no.
2. "Practised today" is a new signal about each member (P6 never showed non-sitters). The Den shows only those who did, behind a per-member switch that is on by default. Yes or no, and default on or off.
3. A week streak (T005 forbids loss threats; the Den has no threats and keeps the best run). Yes or no.
4. Codes from 8 to 6 characters (32^6 is about 1.07 billion, still safe with the join rate limit of 10 an hour).
5. Live play and Lamp hour need Realtime and push (cost and a new channel); the first build can ship async only.

## Self-critique
**Redone after looking at my own PNGs.** S1: the characters sank behind the desk so only their eyes showed, the pennant used all caps, and the quest card was cut by the bar; fixed by lifting and resizing the cast, sentence-case pennant, one-line rows. S4: the sticker tray covered the "Fix it together" key (slop list item 1); fixed by single-line highlights and a shorter trap card, so the key sits fully above the tray; the rank numbers squashed while the stacks grew; moved out of the scaled group. A sticker read as a bomb; redrawn as a thumbs-up mitten, "So close" redrawn as a near-miss target. S3: markers overlapped and option D slid under the keys; re-spaced. S6a and S6b: your character overlapped the first free seat; re-spaced.

**12-part anti-slop test**
1. Identity without the logo: pass. The paper folk and the lamp-lit den could only be MockMob (Mobi's visor and lamp light, exam stationery, chai and admit cards).
2. One primary action: pass on every screen (S4: Fix it together over Rematch, reason: it is the Score Recovery step).
3. True content: partial. Every number has a defined real source, but the mock-up uses fixtures (labelled as such on the page).
4. Hierarchy at first scan: pass. Den, then the line, then the key.
5. Composition: pass at 360 dp (16 gutter, 4-point spacing); other widths not checked.
6. Typography by role: pass (Bricolage for titles and figures, Hanken for UI; no all caps).
7. Every state: partial. Empty Mob (S6b), nobody here, closed week, wrong code and someone still to play are specified; only S6b is drawn.
8. Accessible interaction: partial. 44 dp targets, words beside every colour signal ("Here", "Live", "Played earlier"), aria labels on scenes; but sticker labels are 9.5 px and ghost markers at 55 % opacity are low contrast.
9. No pseudo-evidence: pass by the rules above.
10. Motion with a reason: pass (presence, results order, a reaction landing, a choice).
11. Metric and guardrail: leading metric, share of Mobs with 2+ members who each play 2+ Mob games a week; guardrails, the existing stop rule (over 2 reports per 100 members, over 40 % leaving within 7 days) plus notification opt-outs.
12. What would be better without it: removed a separate "who is here" sentence (the den shows it), Mobi from the lobby (kept to one real moment), and the extra quest timer.

**12-dimension rubric (0/1/2)**: task fit 2, information architecture 2, content truth 1, readable hierarchy 2, visual specificity 2, accessibility 1, functional states 1, trust 2, intentional motion 1 (frame-checked in a browser, not yet on the emulator, R5), performance 1 (idle SVG loops unmeasured on low-end phones), responsive integrity 1 (360 dp only), instrumentation 1 (defined, not built). Total 17 of 24. It is an internal checklist, not proof (AGENT_RULES 38).

Evidence used: T005 (no loss threats, so no losable streak and no named nudges), T002 and S015 (progress only for completed work: the quest bar and the ring), T003 (value before the wall: the Mob of one still has Pace Mobi), S014 (progressive disclosure: one game expanded at a time in S2), S016 (consistent navigation: the bar stays as the owner approved, H5), T001 (visible editable defaults: the preset Mob name with shuffle).

## Honest weaknesses
- The den is an illustration, and illustrations are expensive to keep perfect in Flutter at 360 dp with five members and long names; five characters at the table is tight (88 dp each).
- Live play, the most game-like feeling, is the most expensive piece and will not be there at launch; with few Mobs, most play will be async ghosts.
- "Practised today" and in-game ranks reverse earlier privacy and no-rank decisions; they need his explicit yes.
- Some of the 24 characters read more strongly than others; Crane, Phirki and Pankha are the weakest silhouettes at disc size and need a second drawing pass by hand.
- Sticker words are small, and the sticker set is a first guess at what 17-year-olds would actually send; it should be tested with real students.
- The quest target (120 questions for 4 members) is a guess at a fair size and has to be calibrated from real activity.
- The motion was checked only in a browser, not on the emulator, and the idle loops cost battery.
