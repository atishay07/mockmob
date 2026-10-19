# The Mob, direction "The Arena" (key: arena)

## v2 (19 Oct 2026, evening): every fatal judge finding fixed

Mock-up: `mockup-v2.html` (same folder). PNGs: `mockmob-next/tmp/design-1019pm/mob-arena-v2/` (start with `CONTACT-SHEET.png`; 11 screens in Night and Day at 360 x 780 and deviceScaleFactor 2, `AVATARS-24_{night,day}.png`, `FRAMES-reveal_{night,day}.png` and 24 single frames in `frames/`). Nothing is built. v2 replaces sections 3 and 5 below wherever they disagree; the rest of this file is v1 and stays as the record.

### What changed, finding by finding
| Judge finding | v2 fix | Where |
|---|---|---|
| Trap card names who got it wrong and shows their heads (F4, Fatal 1) | Counts only, never names or faces. While the round is open the card reads "Question 4 is your Mob's trap. 3 of the 4 who have played picked the same wrong option. You left it blank." The option, the answer and the fix stay locked: "The answer and the fix open when the round closes at 9:12 AM, or as soon as all five of you have played." After the close: "3 of you picked B on question 4. The answer is C." and a four-segment bar, "1 of 4 fixed so far", with no faces. | S4b, S4c |
| S3 pace chip contradicts the track (F5, Fatal 2) | One table drives both: the second each person reached each question (`RACE` in the mock-up). The track draws each ghost at the question it had reached at this elapsed time; a ghost on your question sits just behind you if it arrived later and just in front if earlier. The chip compares your arrival at the current question with the nearest friend's: "9 s ahead of Riya" (Riya arrived at question 3 nine seconds after you and is drawn just behind you). Kabir, on question 4, arrived there first and is drawn ahead. Behind reads in neutral ink, never red. | S3 |
| "You came out on top" while a member can still play; headline lands before the reveal (Fatal 3) | While open: kicker "Marks so far", headline "You're on top so far, with 20 marks.", sub "One more of your Mob can still play until 9:12 AM." The headline is held (space reserved, no layout shift) until the counters settle together at 1380 ms and lands at 1400 ms with the cheer. "You came out on top" appears only after the close ("Final marks", "The round closed at 9:12 AM with 4 of 5 played."). | S4, S4c, frames |
| Smart skip claims it "saved a mark" (Fatal 6) | Facts only: "Smart skip. You left question 4 blank, and most of your Mob got it wrong." It shows only when the Mob's majority answer on that question was wrong. The sticker "Saved by a skip" is gone; it is now "Let's fix it". | S4b, S4c |
| Bomb glyph in stickers; Cap reads as a hate hood (Fatal 7) | Stickers redrawn: Respect is a medal, So close is a target with a near-miss dot, Let's fix it is a pencil; Rematch?, Teach me Q4 (bulb) and Next one is mine (flag) kept. Cap is now a graduation cap: a coloured block with a flat diamond board and a gold tassel, default blue, never white and never pointed. Line: "Dressed for results day, every day." Re-checked every glyph and silhouette for a minors' app: no weapons, fire, explosives, hoods, hand signs or skulls; the extras are a bulb, star, flag, leaf, headphones, paper crown and spark. | S4, S5, avatar sheet |
| Live presence drawn as if it exists (F1, Fatal 10) | The first build's no-presence states are the main design: no "here now" ring, no wave, no "Live, right now" option (S2 has one decision now: what to play). Presence appears on one frame only, S1L, labelled "Later, with live play". | S1, S2, S1L |
| R3: a lone member cannot play (Fatal 8) | Mob of one: "Your Mob is ready. Invite up to 4 friends to play rounds together. You can sit this week's paper now, on your own." plus a row "This week's Mob paper, 10 questions, closes Sunday 11:59 PM" with "Sit it". | S6a |
| Fan, Fortune and Cap weak as 24 dp heads | Fan: a pleated fan with a scalloped edge, alternating light and dark pleats and a rivet. Fortune: a teal four-flap fortune-teller with four coloured flap dots. Cap: as above. Peak gained a tent door so it no longer repeats Dart. The sheet now has a row of all 24 heads at 24 and 32 px. | avatar sheet |
| Smaller findings | Default "You" is Hex in violet, not green, so it never reads as Mobi. Kabir is Tab (a bookmark), not Peak, so two triangles never stand side by side. Moment rows carry names. S5 grid names every head, says which extra is picked ("One extra: Star") and locked heads are easier to see by Day. Keys are flat volt. The Rematch row no longer names Kabir twice. The sticker row fades at the edge to show it scrolls. | all |

### One fixture, consistent everywhere (illustrative)
Quiet Comets, Accountancy, 5 members: Riya (Dart, rose), Kabir (Tab, teal), You, Aanya (Hex, violet), Meher (Stub, amber), Ishan (Pip, blue). Riya opened a 5-question sprint on admission of a partner at 9:12 AM; it closes 9:12 AM tomorrow (the status bar reads 7:40 PM). Riya, Kabir and Meher played today; you play now; Ishan has not played and is never named as such.
- Marks (+5, -1, 0): You 20 (4 right, question 4 blank); Riya 19 (4 right, B on question 4); Meher 14 (3 right, B on question 4, one blank); Kabir 13 (3 right, B on question 4, one more wrong). The lobby chips show 19, 13 and 14; the podium shows 20, 19, 14 and Kabir on the floor with 13.
- The trap rule holds: 4 sitters, B picked by 3 (2 or more, and half or more). The answer is C.
- Ghost race at 108 s (timer 3:12 of 5:00): you reached question 3 at 82 s, Riya at 91 s, Kabir at 70 s (question 4 at 101 s, all five in 2:40, his "Quickest finish"), Meher is on question 2.
- Moments: Riya's fastest right answer is question 5 in 16 seconds (not question 1, which took her 41 seconds in the race table); Meher switched question 2 to the right answer.
- Week quest 96 of 150 = 30 + 25 + 20 + 15 + 6, Mob rounds only. Chain: 6 weeks.

### Screens in v2
S1 Lobby (no presence), S1L Lobby later with live play (labelled), S2 Play picker, S3 In play, S4 Results while open, S4b the same scrolled (trap locked), S4c Results after the close (trap open, fix started), S5 Your character, S6a A Mob of one, S6b Join with a code, S6c Start a Mob. Exact copy is in the mock-up; every line was read aloud for R6.

### Motion changes
The reveal still uses plinths that translate (never scale), counters that rise together, and settles by 2000 ms. New timings: kicker 0 to 300 ms; plinths 120/250/380; drops 420/550/680; counters 880 to 1380; names and stickers 1000; headline, cheer and footer 1400; flecks 1420 for 560 ms; received sticker 1560; rows 1500 to 1995. The frame strips show no false order (the counters pass a momentary 11 and 11 tie at 1000 ms, as in v1).

### Needs his yes (each with my recommended default)
1. **Podiums and ranks inside a Mob** (reverses SOCIAL-SPEC P5). Recommended: yes, inside one Mob round only, ranked by CUET marks, ties share a height, "so far" while anyone can still play, never across Mobs, weeks or the platform. A Mob setting "Show a podium", on by default; with it off, results show each person's marks in join order. A member who keeps marks private is counted, never placed.
2. **The paper chain streak** (touches T005). Recommended: a weekly chain, as drawn in v2, not the v1 daily chain. A week joins when two of you play any Mob round that week. No loss copy, no countdown, no push about it; when it breaks the lobby says "A new chain starts this week. Your best is 6 weeks." and the best never drops.
3. **6-character codes** (a migration from today's 8). Recommended: yes, 6 Crockford characters shown as K7P-2M9, typed into six boxes; existing 8-character links keep working until they expire; the lookup rate limits stay.
4. **Who may open rounds** (pricing, D101). Recommended: any member may open a sprint, race or own round. Free members open up to 3 rounds a week across their Mobs; Pro members have no weekly cap (the existing 6 a day limit stays). Playing any round stays free for everyone, so a Free friend is never shut out of a round someone else opened. Full mock together follows whatever he decides for full mocks.

### Honest limits of v2
- Still browser mock-ups at 360 dp only; no emulator walk, 412 dp, large text or contrast check yet. The Flutter port must be captured on device against `FRAMES-reveal_*.png`.
- "See your answers" while the round is open shows the viewer their own answers, as the weekly paper does today, so a friend can still be told an answer privately. The app itself never broadcasts it before the close.
- Fortune and Fan are clearer but still code-drawn; a polish pass with Mobi's rig lighting is still advised, and the set should be tested with real 16 to 17-year-olds.
- The lobby is still the densest screen (cast, chain, quest and action). The key sits just above the bar at 360 x 780.

Designer: Opus, 19 Oct 2026 PM. One of three directions for R8; nothing here is built. Mock-up: `mockup.html` (same folder, self-contained, the app's own fonts and tokens). PNGs: `mockmob-next/tmp/design-1019pm/mob-arena/` (start with `CONTACT-SHEET.png`). All names, marks and times in the mock-up are illustrative.

## 0. The concept in two lines
Your Mob is a small crew of characters standing in one arena. Every round you play, from a 5-question sprint to a full mock, fills the arena with life, and the question your Mob missed most becomes a trap you beat together.

What makes it ours rather than Duolingo's: the game is CUET itself. Marks are real CUET marks (+5, -1), the best moments include a smart skip, and the "boss" is a real shared mistake that goes through Score Recovery (find, fix, check).

Sources read: MOB-FACTS.md (facts), his words in OWNER-FEEDBACK-2026-10-19.md from 3:05 pm (H11, D121, D122), AGENT_RULES.md and the anti-slop paper, the owner's UI standards, the v15.3 Mob screenshots (`G17_mob-*`, `G23_mob_*`). Evidence IDs below: T00x from the research brain, T-/R- ids from the UI standards.

## 1. The game loop

**A day (about 5 to 15 minutes).**
1. A student opens the Mob tab and sees the arena: five characters, who played today, the chain, the week quest, and one key. If a friend has opened a round, the key is that round ("Play Riya's sprint"). If not, it is "Start a round".
2. They play: a sprint (5 questions) or a race (5 or 10 minutes), alone in time but racing friends' ghosts.
3. The reveal: plinths rise, characters land, marks count up, everyone gets a true moment, and the trap appears.
4. "Fix question 4 together": a two-minute fix and one fresh twin question. The trap is beaten when every person who missed it gets their twin right.
5. A sticker, then out. The day's link joins the chain once two of you have played.

**A week.**
- Monday: the week quest appears (30 questions a member, so 150 for five, 60 for two). The Mob paper opens (exists today).
- During the week: rounds open and close (each open for a day), the quest bar fills in member colours, traps get fixed.
- Sunday 11:59 PM: the Mob paper closes; quest unlocks land (a character or an extra for everyone, cosmetic only).
- Monday: a calm week card in the lobby: "Last week: 214 questions, 3 traps beaten, a 12-day chain." No rank across Mobs.

## 2. Mechanics

His asks (all in): avatars instead of photos, Mobs of 2 to 5, flexible play (5 questions, 5 or 10 minutes, custom, full mock), effortless join, clarity and delight, 10/10.

Mechanics he did not ask for (the "think beyond" list). For each: why it works for a 16-17-year-old preparing for CUET, how it stays true, how it stays safe.

| # | Mechanic | Why it works | Truth | Safety for minors |
|---|---|---|---|---|
| M1 | **Ghost race** (S3). Async rounds show each friend's head on the track at the question they had reached at the same elapsed time in their own run, plus a pace chip ("9 s ahead of Riya"). | You get the thrill of a race without anyone needing to be online at the same time. At launch, with few Mobs, live play would rarely find two people at once, but ghosts always work. Pacing is a real CUET skill (50 questions in 60 minutes). | It uses the per-question seconds the server already stores (`mob_sittings.detail.t`). A ghost appears only when both of you share answers. If there is no data, there are no ghosts. | It shows no names beyond the Mob's first names, and nothing can be typed. |
| M2 | **Trap together** (S4). The question most of the Mob missed becomes a trap. Each person who missed it gets a two-minute fix and a fresh twin question. The trap is beaten when all of them get theirs right ("0 of 3 fixed so far"). | This ties the Mob to Score Recovery (find, fix, check). It turns a shared mistake into a team goal instead of shame, and students learn the trap rather than the answer. | It uses the existing trap rule (3+ sitters, the option picked by 2+ and by half or more). The check is a real answered question, never a tap on "I get it". | It is cooperative. It never names who has not fixed it yet in any notification. |
| M3 | **The paper chain** (S1). A day joins the chain when at least two of you play a Mob round. Each week has two rest days built in that never break it. | It gives the Duolingo pull he loves, but it belongs to the group and survives one busy friend. Teens with school and coaching need rest days. | It is computed from sittings with timestamps. When it breaks, the lobby says "A new chain starts today. Your best is 12 days." The best never drops. | There is no loss threat, no countdown, no "your chain is in danger" and no push about the chain (T005). |
| M4 | **Week quest with a contribution bar** (S1). One shared target, 30 questions a member, with the bar filled in each member's colour. A finished quest unlocks a character or an extra for all. | It is a goal small enough for a Mob of two and visible progress that everyone owns. Colour segments show who helped without ranking anyone. | Counts only questions answered in Mob rounds. The target scales with the real member count. | Rewards are cosmetic only, never credits or money, and there are no variable-ratio rewards. |
| M5 | **Everyone's moment** (S4). Each player gets one true highlight: smart skip, fastest right answer, good change, quickest finish, the only one to get a question right, or fixed last week's trap. | Every player, including the one with the lowest marks, gets a reason to come back. "Smart skip" teaches CUET negative marking (+5, -1) by celebrating a skip that saved a mark. | It is picked by rule from picks, seconds and changes, in a fixed priority. If no rule fits, the line reads "Played all five." Nothing is invented. | No "last place" label. The fourth player stands on the floor with their marks, not under a plinth labelled "4th". |
| M6 | **Die-cut stickers** (S4). Six preset stickers: Respect, So close, Rematch?, Teach me Q4, Saved by a skip, Next one is mine. One received sticker sits on your plinth. | It is the fun of reacting with no typing. "Teach me Q4" turns a sticker into a study request between friends. | A sticker is sent only after both people have played the round. | A fixed enum with no free text, a limit of 3 stickers per round per person, and blocked members cannot send. |
| M7 | **Friendly names by dice** (S6). The Mob name comes from a curated list ("Quiet Comets", "Margin Makers", "Night Ledgers"), with "Roll again". | Naming is fun and quick, and it gives the Mob an identity in the lobby header. | Not applicable. | There is no free text, so no slurs, no contact details and no grooming handles. |
| M8 | **Call your score** (proposed for later, not drawn). Before a sprint, each player can tap a guess (for example "4 of 5"). The results show "Called it" or "1 off". | It builds calibration, which is knowing what you know. That is how you decide when to skip under negative marking. | It compares the guess with the real result. | Optional. It is never shown in a notification. |
| M9 | **Huddle time** (later, with live play). The Mob votes for one preset evening time (6, 7, 8 or 9 PM). At that time, "Live, right now" lights up for whoever is there. | It makes live play real for small groups because they plan to be there. | "Here now" appears only from a live connection. | Each person gets one reminder on their own phone, and none during quiet hours (10 PM to 7 AM). |
| M10 | **Quest-unlocked characters** (S5). Six of the 24 characters and two extras unlock with Mob quests. | You can show a cosmetic that you earned together. | It is earned from the real quest state. | Never sold, and no money anywhere in the Mob. |
| M11 | **Rematch** (S2, S4). The same people and the same settings, with fresh questions. | It is the one-tap way to play again, which is what keeps a game alive. | It only uses new questions, never the same ones, so nobody can memorise them. | It goes only to the same Mob members. |

## 3. Screen-by-screen spec (360 x 780 dp, Night and Day)

Every line below is exact copy (R6: read aloud, full sentences, no exclamation marks, no arrows, 12-hour time, sentence case). Type roles are the app's: display BricolageHeadline 28/31, title BricolageTitle 22/27, subhead Hanken 17/22 bold, body 16/24, small 14/20, caption 13/18, figures BricolageCondensed with tabular numerals. One volt key per screen.

### S1 Lobby (tab root, bar visible)
- Header: your character's head (40, replaces today's initial disc, app-wide), "Quiet Comets" with a chevron (switches Mobs; it exists as `MobSwitcher`), "Accountancy, 5 of you", and "Ask Mobi" (kept, R3).
- Arena (160 dp): an oval floor with a dashed inner ring. The five characters stand in join order in a shallow arc; you stand in the middle. Each has a first name (yours reads "You" in the accent colour). Members who played a Mob round today get a small check before their name. A friend who is in the app now gets a pulsing ring on the floor (live data only; until Realtime exists this ring is not drawn).
- Line: "Riya and Kabir played today. Kabir is here now." (It names only the people who played, never anyone who has not, P6.)
- Chain row: "9-day chain", "Today's link is in." and the last seven days as links (filled = played together, dashed = rest day, outlined and filled = today).
- Quest: "Week quest", "96 of 150 questions", the segment bar in member colours with the crown at the end, "Reach 150 by Sunday and all five of you unlock the paper crown."
- Action card (the one dominant action): Riya's head, "Riya's sprint is open", "5 questions on admitting a partner", the score chips for those who played ("4 of 5", "3 of 5"), "Until 9:12 AM", and the key "Play Riya's sprint". Below it, the text button "More ways to play" (opens S2).
- States: when nothing is open, the card reads "No round is open right now." with the key "Start a round". If you already played every open round, it reads "You've played everything that's open. Start the next one." with the key "Start a round". When loading, there is a skeleton in the same frames. When the lobby fails, use the existing failure copy. When offline, use the existing strip, the cast stands still and shows yesterday's chain with "Last updated 6:10 PM".

### S2 Play picker (sheet over the lobby)
- "Play with your Mob", close.
- When: "Open for a day": "Friends play when they can. Scores arrive as they finish." (default, selected). "Live, right now": "Kabir is here now. Play at the same time." When nobody is here, this option is disabled and reads "Nobody else is here right now." Later, it can show "Your huddle is at 8 PM" (M9).
- "What to play":
  - Sprint (featured and selected): "5 questions, about 5 minutes"; "Chapter: Admission of a partner", "Change" (it defaults to the chapter where the Mob's last trap was, or the student's weakest chapter).
  - "Race the clock": "As many as you can", with a 5 min or 10 min switch.
  - "Your own round": "Pick the chapter and the length" (5, 10, 15 or 20 questions; the lengths already exist).
  - "This week's Mob paper": "10 questions, closes Sunday 11:59 PM" (exists today).
  - "Full mock together": "50 questions in 60 minutes, like the real paper".
  - "Rematch": "Kabir's 10-minute race, with Riya and Kabir".
- Footer: "It waits in your Mob's lobby until 7:40 PM tomorrow." and the key "Open the sprint for a day". In live mode the key reads "Start now with Kabir".
- Plan gate (R3, D101): if full mocks together are Pro, the row stays visible with a lock and "Pro"; with billing off it is visible and locked with the plain fact.

### S3 In play (runner; no bar; calm)
- Close, "Riya's sprint", timer chip "3:12".
- Ghost race card: "Ghost race", the pace chip "9 s ahead of Riya" (or "4 s behind Riya", in neutral ink, never red), and a five-stop track (done stops in volt, the current stop outlined). Your head is solid with a volt ring; friends are faded with dashed rings, at the stop they had reached at this elapsed time. Below: "Each friend shows where they were at this moment of their own run."
- "Question 3 of 5", "+5 if right, -1 if wrong". The question and four options; the selected option has a volt edge and a filled letter.
- Footer: "Answers show at the end, for everyone at once." with "Skip" and "Next question".
- Live variant (later): heads are solid, move when a friend answers (server events), and the line becomes "Everyone is playing now." No correctness is shown during play, in either mode.
- Never in the runner: stickers, Mobi, sounds, quest progress or upsells.

### S4 Results (reveal, then scroll)
- Close, "Riya's sprint", "4 of 5 played".
- Headline by case:
  - You top: "You came out on top, with 20 marks."
  - Tied: "You and Riya share the top, with 19 marks each."
  - Not top: "You scored 14 marks. Riya came out on top with 20."
  - Below zero: "You scored -2 marks. Two wrong answers cost more than the skips would have." (It is calm, with a next step, and never celebrates a bad outcome, R-081.)
- Sub: "One more of your Mob can still play until 9:12 AM." (No name.)
- Podium: three plinths in member tints with marks on the face ("20 marks"), names below, a fourth player on the floor with their marks. A Mob of two shows two plinths; a Mob of five shows three plinths plus two on the floor.
- Stickers row (horizontal scroll). A received sticker sits on your plinth.
- Trap card: "The one your Mob missed", "Riya, Meher and Kabir picked B on question 4. The answer is C. You skipped it.", the question stem, "Each of you gets a two-minute fix and one fresh question like it. The trap is beaten when all three get theirs right.", three heads with dashed check rings, and "0 of 3 fixed so far".
- "Everyone's moment": one row per player (see M5 for the exact lines).
- Sticky footer: the key "Fix question 4 together" and the secondary "Rematch". When there is no trap (fewer than 3 players, or no shared wrong option), the key becomes "Rematch" and the secondary becomes "See your answers".

### S5 Your character (pushed page)
- Back, "Your character".
- Preview on a small plinth (waving), the name ("Hex") and the personality line.
- "Colour": the eight Mob colours (the character's own paper colour comes first when it is not one of the eight).
- "One extra": None, Bulb, Star, Flag, Leaf, Headphones, Paper crown (locked), Spark (locked).
- "18 to pick now. 6 more unlock with Mob quests, never with money."
- A grid of the 24 heads (6 by 4). Locked ones are dimmed with a lock; tapping one gives a small shake and the toast "Kite unlocks when your Mob finishes a week quest."
- Key: "Use Hex".

### S6 Create and join
- **Start a Mob:** "Start a Mob for you and up to 4 friends." / "Play sprints, races and full mocks together. Your Mob sees your marks, and one switch keeps them private." (This is the truthful default: `show_score` is on today.) Then "Mob name" with "Quiet Comets" and "Roll again", "Names come from our list, so every Mob name is friendly.", "Subject" chips (your CUET subjects), and "You in the Mob" with "Aanya as Hex", "First name only. Your Mob never sees a photo." and "Change". Key: "Start the Mob".
- **A Mob of one:** you stand alone with four dashed "Open seat" outlines. "Your Mob is ready. Games start when one friend joins." Code card: "Your code", "K7P-2M9", "Friends next to you can scan it. The code works for 7 days.", with the QR. Key: "Invite on WhatsApp". Secondary: "Copy the code" and "Join with a code". Preview: "Your friend gets: Aanya invited you to Quiet Comets on MockMob. Tap to join, or use code K7P-2M9."
- **Join with a code:** the sheet rides the keyboard inset, so the boxes are never covered (H1/H10). "Join a friend's Mob", "Type the 6-character code from their invite.", six boxes with an auto dash after the third, "Letters and numbers only. Capitals are added for you.", "Scan" and "Find their Mob" (disabled until six characters). A wrong or blocked code reads the same: "That code doesn't open a Mob. Check it with your friend." (P10).
- Note: codes are 8 characters today (`mob_invites.code`). Six Crockford characters give about 887 million codes; with the existing lookup limits that is safe, but it is a migration and an owner call.

## 4. Motion spec (tokens from `motion_tokens.g.dart`; bounce at most 0.12 except Mobi and the bar)

| Moment | What moves and why | Duration and curve |
|---|---|---|
| Lobby open | The quest segments sweep to their values in join order (shows who helped). Today's link inks in. | Segments: 500 ms `out`, 45 ms stagger, start 120 ms. Link: ink 260 ms at 620 ms. |
| Lobby at rest | The characters breathe (scaleY 1 to 1.022), blink every 4.6 s with phases offset, and sway the antenna 4 degrees. The "here now" ring pulses. The point is that the Mob feels alive without anything demanding attention. | Breathe 3200 ms `sweep`. Blink 4.6 s. Sway 2800 ms. Pulse 1800 ms `out`. **Idle stops 10 s after the last touch** (battery, and the rule against endless component loops, T-112); a tap wakes it. Under reduced motion it is static. |
| Tap a character | A hop with a wave. Feedback that they are alive. | 420 ms, peak -10 dp at 40%, `cubic(.3,0,.3,1)`. |
| Results reveal | 1. Headline in. 2. Plinths rise from the floor (translate, never scale from 0) third, second, first. 3. Characters drop onto plinths with a 3 dp settle. 4. Marks count up **together** so the order is true at every frame (the first draft staggered them and showed a false interim order; fixed). 5. The top scorer's eyes turn happy, arms go up, they hop, and 8 paper flecks burst from the top plinth. 6. The received sticker pops. 7. Stickers, trap card, moments and footer rise in with a 45 ms stagger. | Headline 360 `out` at 0. Plinths 420 `emphasized` at 120/250/380. Drops 420 `out` at 420/550/680. Counters 500 `numberRoll` at 880. Cheer at 1180: arms and eyes 140, hop 460, flecks 900 `out`. Sticker 420 at 1700. Rows 360 `out` from 1000 to 1600. Settled by 2000 ms (momentT3). Reduced motion paints the end state. |
| Send a sticker | It presses (0.94), lifts with a 4 degree tilt, flies to the friend's character and sticks small. The arc shows where it went. | Press 240. Flight 620 `emphasized`. Fade after 900. |
| Choose a character | The old one shrinks and leaves (0.96, exit curve). The new one drops in with a 2 dp settle. The name and line cross-fade. A locked cell shakes 3 dp. | Exit 140 `exit`. Enter 360 `out`. Text 200. Shake 240. |
| Chain break (not drawn) | Nothing animates. The new chain's first link inks in the next time two people play. A loss must never be dramatised (T005). | Not applicable. |

**R5 frame plan.** In the browser: `frames/reveal_{night,day}_*.png` (12 frames from 0 to 2200 ms) and `frames/lobby_{night,day}_*.png` (10 frames from 1000 to 4600 ms), with contact strips `FRAMES-reveal_*.png` and `FRAMES-lobby_*.png`. On device (the emulator), the Flutter build must be captured at the same timestamps and compared side by side with these strips. It passes when no frame shows a false order, the plinths never scale from 0, the bounce is at most 0.12, and the reveal is settled by 2000 ms.

## 5. The avatar family: "The Folds"

**Shape grammar, taken from Mobi** (`mobi_geometry.dart`, `mobi_parts.dart`): every character is one piece of exam-desk paper, folded. The parts are:
1. A flat paper silhouette with Mobi's facet lighting: a light upper-left facet (white 13%), a darker lower-right fold (black 17%) and a crease line (white 32%).
2. Mobi's dark visor (`#1C1A17`, corner radius up to 13, a gloss band at 14%).
3. Cream eyes (`#FFFAEE`).
4. One antenna (a black stalk with a tip).
5. Black rubber-hose limbs with mittens and boots (Night limbs `#3A3631` with a warm lamp rim at 42%; Day `#262421`).

There is no mouth, nose or ears: expression lives in the eyes (capsule, slant, lid, dot, wide, tall, happy), exactly like Mobi. **Lime is Mobi's alone**, so the host always stands out.

**Palette.** The paper uses the 8 Mob member colours (blue `6E8BFF`, teal `3FC6A8`, amber `F2A93B`, rose `FF7A8A`, violet `B98CFF`, sky `56B8F0`, coral `E58E5A`, green `9FBF4A`) plus four natural papers (cream `EDE4D0`, kraft `C9A16E`, butter `F2D06B`, slate `9AA3B5`). Like Mobi, the art keeps the same colours in both themes and only the light changes. A member's chosen paper colour becomes their Mob colour (ring segment, quest segment, plinth tint).

**The 24** (unlocked unless marked Quest):

| Name | Paper object | Personality line |
|---|---|---|
| Pip | OMR answer bubble | Fills every bubble right to the edge. |
| Dart | paper plane | Finishes first, then goes back to check. |
| Tuck | envelope | Keeps every note sealed until results day. |
| Stub | admit ticket | Always saves a seat for a friend. |
| Kite (Quest) | kite | Climbs higher when the wind pushes back. |
| Prot | protractor | Measures twice and marks once. |
| Skiff | paper boat | Floats calmly through the longest passage. |
| Cue | index card | Flashes the one fact you need. |
| Tab | bookmark | Always knows exactly where you stopped. |
| Nova (Quest) | folded star | Shows up shining on result day. |
| Hex | honeycomb cell | Builds every answer one cell at a time. |
| Lumi (Quest) | paper lantern | Brings light to the darkest chapter. |
| Fortune (Quest) | paper fortune-teller | Picks a corner, then proves it. |
| Note | sticky note | Remembers what you were about to forget. |
| Rubs | eraser with sleeve | Treats every mistake as a first draft. |
| Peak | paper tent | Steady on the steepest page. |
| Loop | paper-chain link | Holds the Mob together. |
| Fan | paper fan | Keeps cool before a hard paper. |
| Cubo (Quest) | folded cube | Plays every round like a fresh roll. |
| Folio | folder | Files every chapter in the right place. |
| Cap (Quest) | newspaper hat | Captain of every rematch. |
| Zig | accordion fold | Bounces back from every crease. |
| Tag | luggage tag | Ready for any chapter, any time. |
| Ink | ink drop | Leaves a clear mark on every paper. |

**Customisation:** a colour (8) plus one extra (None, Bulb, Star, Flag, Leaf, Headphones; Paper crown and Spark unlock with quests). Nothing else, so every character stays recognisable as a 24 dp head.

**Poses:** at rest, here now (wave), top of the round (arms up, happy eyes).

**Build note:** the renderer is parametric. Each character is a polygon or path plus a visor box, an antenna point and a decoration function, so the Flutter port is one `CustomPainter` that reuses Mobi's limb code. A head crop gives the 24 to 48 dp heads. See `AVATARS-24_{night,day}.png`.

## 6. Truth and safety rules
1. Every number comes from Mob tables: sittings, picks, seconds, changes, extras and their sittings, reactions. Nothing is estimated, padded or seeded. With no data there is no element; a quiet line replaces it. Placeholders exist only in mock-ups, and are labelled.
2. "Played today" counts Mob rounds only. Practice elsewhere stays private unless a new per-member switch, "Show my practice days to my Mob" (default off), is turned on. **Owner decision.**
3. "Here now" and live play appear only from a real connection (Realtime presence). Until that exists, the first build shows neither, and "Live, right now" is not offered. The design never fakes either.
4. Ghosts and answer-level moments need both players sharing (`show_score` and the existing both-share rule for picks). A player who keeps answers private is counted, never named.
5. Names and copy never single out who has not played ("One more of your Mob can still play", not a name). There is no "waiting on you", no countdown and no loss threat (T005). Rank exists only inside the Mob, never across Mobs and never public. Owner decision: a Mob setting, "Show a podium", on by default.
6. Minors: first names only (2 to 18 letters, the existing rule); characters instead of photos; preset Mob names; preset stickers; no free text, chat, DMs, links or images; no contacts access; report, leave and block stay as built.
7. Notifications (when push exists): at most one Mob notification a day per person; none from 10 PM to 7 AM; none while any paper is open; one switch to mute. The content states facts only ("Riya opened a sprint. It is open until 9:12 AM.").
8. Money: no money, credits or Pro inside the Mob's game layer. Rewards are cosmetic and earned. Pro gates stay visible and locked when billing is off (D101).
9. Small numbers: the Mob works for two people (two plinths, a quest of 60, a chain that needs both). Nothing depends on many Mobs existing (only 4 students sat a paper in the last 30 days, per pass-1018).

## 7. R2, the 17-year-old test (what a first-time student thinks the screen wants)
- **S1 Lobby:** "That's my friends. Riya opened a sprint, so I should play it." (The key is the only volt element.)
- **S2 Picker:** "Choose now or later, then choose a game. Sprint is already picked, so I just press the button."
- **S3 In play:** "Answer this. I'm a bit ahead of Riya. Skipping is allowed."
- **S4 Results:** "I won. Three of us got question 4 wrong, so let's fix it together." (The sticky key says exactly that.)
- **S5 Character:** "Pick who I am. Tap one, choose a colour, then press Use."
- **S6 Mob of one:** "Send my friend this code or the WhatsApp link." Join: "Type the code my friend gave me."
- **S6 Start:** "Pick a subject and go; the name is already done."

## 8. Build cost and order (S = up to a day, M = 2 to 4 days, L = a week or more)

**First build, "the async arena"** (no Realtime, no push):

| Piece | Cost | Notes |
|---|---|---|
| Avatar family in Flutter (CustomPainter), plus `mob_members.avatar`, `colour` (exists) and `extra` columns, and `PATCH /me` | M | The art is client-side only. Also replaces the initial disc app-wide. |
| Lobby S1 from `GET /api/mob` plus new fields | M | Chain and quest computed on the server. |
| Rounds on `mob_extras` | M | Any member may open one (a policy change from Pro-only to make; the owner decides the Free limit), lengths 5/10/15/20, `closes_at` = +24 h, the cap raised from 3 a week. |
| Race mode (as many as you can in 5 or 10 minutes) | M | A new runner mode. The same question order for everyone. |
| Ghost race | S | Needs `detail.t` on extra sittings too (one column). |
| Results reveal, moments and podium | M | Moments are rule-based from picks, seconds and changes. |
| Trap together (fix plus twin check) | M | Reuses the Score Recovery fix and twin-question pick. |
| Stickers | S | `mob_reactions`: a fixed enum with a per-round cap. |
| Chain and week quest | S | Computed. Rest-day rule. Unlocks table. |
| Create with dice names, a 6-character code, QR show and scan | M | Includes a code migration and a scanner package. |
| Web parity | M | `WEB/src/components/mob/*` follows the pick. |

**Later:** live play with Realtime presence and server-timed questions (L); full mock together at 50 questions in 60 minutes (M if async on extras, L if live); huddle time (S, after live); push with a daily cap (L); call your score (S).

## 9. Self-critique (done on my own PNGs)

**Redone during the pass:**
- S1 v1 hid the dominant key under the bar. Fixed by tightening the stage and shortening the copy.
- S2 v1 let the lobby characters draw over the sheet (a stacking bug). Fixed.
- S4 v1 counted marks in a stagger that briefly showed a false order (Meher 13, you 2). Fixed: the counters rise together.
- Night limbs were invisible. A lamp rim was added, as on Mobi.
- **S3 was the weakest screen and was redone** (`S3_night_v1-before-redo.png` against `S3_night.png`): the faint 30 dp ghosts on a bare track became a "Ghost race" card with a true pace chip, 34 to 40 dp heads and a clear explanation line.

**12-part anti-slop test:**

| # | Check | Result |
|---|---|---|
| 1 | Identity with the logo hidden | Pass. Paper characters, volt key, CUET marks. |
| 2 | One primary action | Pass. S4 also has "Rematch", justified as the loop's second step, drawn outlined. |
| 3 | True content | Partial. It is labelled illustrative; "here now" and "played today" need new data. |
| 4 | Hierarchy at first scan | Pass. |
| 5 | Composition | Pass at 360 dp. Not checked at 412 dp or large text. |
| 6 | Typography by role | Pass. |
| 7 | Every state | Partial. Specified in text; only empty, disabled and keyboard states are drawn. |
| 8 | Accessible interaction | Partial. Ghost labels at 62% opacity and 11 dp names need a contrast check; colour is never the only signal (checks, names, text lines). |
| 9 | No pseudo-evidence | Pass. Every figure has a data source in section 6. |
| 10 | Motion with a reason | Pass. Idle stops after 10 s. |
| 11 | Metric and guardrail | Leading metric: Mob rounds played per member per week. Guardrails: the existing stop rule (reports over 2 per 100 members, leaves over 40% in 7 days) plus the share of members muting the Mob. |
| 12 | What would be better without | The dashed inner floor ring and the paper flecks are the two decorative items; both are kept because they carry the arena identity and the win moment. A sixth sticker could go. |

**Rubric (0/1/2):**

| Dimension | Score |
|---|---|
| Task fit | 2 |
| Information architecture | 2 |
| Content truth | 1 |
| Readable hierarchy | 2 |
| Visual specificity | 2 |
| Accessibility | 1 |
| Functional states | 1 |
| Trust | 2 |
| Intentional motion | 2 |
| Performance | 1 (24 painted characters on low-end phones is unmeasured) |
| Responsive integrity | 1 (360 dp only) |
| Instrumentation | 1 (metric named, not wired) |
| **Total** | **18 of 24** |

This is an internal checklist, not proof of quality; the owner signs off.

## 10. Honest weaknesses
- **It reverses older rules.** Podiums, ranks, a streak and named "played today" contradict SOCIAL-SPEC sections 11-12 (never ranked, no losable streak, no reactions). His 19 Oct words are newer, but he should decide them knowingly. The chain is designed so one person cannot lose it, and the podium is Mob-only and can be switched off.
- **The most exciting parts need infrastructure we do not have.** Live presence and racing need Realtime rooms (L), and pushes need FCM (L). The first build is async only. The ghost race is the honest stand-in, and it is good, but it is not the same as playing at the same moment.
- **Rounds on `mob_extras` change the Free and Pro split.** Today only Pro makes extras, with 3 a week. A game needs any member to open rounds, which is a pricing decision.
- **The 24 characters are drawn by code, not by an illustrator.** They are consistent and on-brand, but flatter than Mobi's rendered poses. Some (Fan, Fortune, Cap) read less clearly at 24 dp. A polish pass with the Mobi rig's lighting is advisable.
- **Contrast and large-text behaviour are untested,** and so are 412 dp and web 390/1440.
- **The lobby is dense** (cast, chain, quest and action on one screen). If he finds it busy, the quest can fold into the chain row.
- **The two remaining wins** (a Mob streak on Today and Mob callouts on the result screen) were left out to keep the rest of the app calm. They are worth a decision.
