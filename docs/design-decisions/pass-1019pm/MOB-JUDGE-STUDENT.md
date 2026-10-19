# Mob directions judged as a first-time 17-year-old and as the owner (pass 1019 PM, R8)

Judge: Opus subagent, 19 Oct 2026. I read MOB-FACTS.md, MOB-DEN.md, MOB-ARENA.md and MOB-TRAIL.md in full. I looked at every screen PNG in Night and Day (Den 16, Arena 18 including S4b and the S3 version from before the redo, Trail 16), all three avatar sheets (Den in Night and Day, Arena in Night and Day, Trail's single sheet), every frame strip (Den: reveal, lobby and reaction; Arena: reveal and lobby, Night and Day; Trail: the S4 and S1 filmstrips), and single frames where a strip was too small to read (Trail S4 at 800 and 1250 ms, Arena reveal at 1050 ms, Den reveal at 600 ms). Nothing was built or run, and no browser was opened. Evidence IDs come from `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md`.

## Verdict

**The Den wins the first build. Score: Den 8.0, Arena 6.5, Trail 6.0 (out of 10).**

The Den is the only direction where a new student understands the Mob tab in one glance. They see their friends sitting at one table, who has practised, and one yellow key that says whose game is waiting (Den S1). It also has the best characters, the best invite line ("Aarav saved you a seat in Chai Circle", S6b), the most suspenseful reveal (the empty "1" stack fills last, frame at 600 ms) and the cleanest join screen (S6c). Two things are wrong with it: it ranks by right answers while it praises a "smart skip", and its picker (S2) is a plain list. Both are fixable by taking ideas from the other two directions (see "What to take from the others").

The Arena has the most game energy and the most CUET-true scoring (marks, +5 and -1). But as drawn it contains a lie (S3), shame (S4), a result announced before everyone has played (S4) and two symbols a school app cannot ship (the bomb stickers and the "Cap" character). The Trail has Duolingo's clearest metaphor and one excellent learning idea (the check on Wednesday). But its lobby is a decorated progress bar, it uses lime everywhere, its picker is the most confusing of the three, and its results data and reveal are wrong.

## Scorecard (0 to 10 each; the overall score is my judgement, not an average)

| Criterion | Den | Arena | Trail |
|---|---|---|---|
| Understood in 3 seconds (R2, AGENT_RULES 7) | 9 | 6 | 7 |
| Characters that carry emotion | 8 | 7 | 6 |
| Celebration that feels earned | 8 | 7 | 5 |
| Premium and alive, not 2010, not childish | 8 | 6 | 6 |
| Truth and safety as drawn (T002, T005, P6) | 6 | 3 | 4 |
| Would I bring my friends? | 9 | 7 | 7 |
| Buildable in the first, async-only build | 6 | 7 | 6 |
| **Overall** | **8.0** | **6.5** | **6.0** |

## R2: what a first-time student thinks each screen wants (3-second read)

### The Den
| Screen | First-timer's line | 3 s? |
|---|---|---|
| S1 lobby | "These are my friends at one table. Riya sent me a sprint, so I tap the yellow button." | Pass. The shelf stamps and the dashed slot are a mystery, but they are secondary. |
| S2 picker | "Pick a game, then press Start. Kabir plays live, and the others play later." | Pass. "Full mock together: This week's paper or a full mock." mixes up two different things. |
| S3 in play | "Answer the question. The little figures are my friends racing me." | Pass. The Q1 to Q5 labels under the track are clipped (Night and Day), and Zoya overlaps Kabir's ghost. |
| S4 results | "I came first. Now we fix question 4 together." | Pass for most students. A student who knows CUET marking will ask why they beat Riya, who had no wrong answers. |
| S5 character | "Pick who I am, choose a colour and one extra." | Pass. Only 8 of the 24 show above the fold, and no locked character is visible. |
| S6a start | "Name my Mob. Can I type here?" | Partial. The preset name sits in what looks like a text field, and the shuffle button is a die icon with no label. |
| S6b Mob of one | "Send the WhatsApp invite." | Pass. This is the best empty state of the three. |
| S6c join | "Type the code, check it is the right Mob, and join." | Pass. This is the best join screen of the three. |

### The Arena
| Screen | First-timer's line | 3 s? |
|---|---|---|
| S1 lobby | "This is my crew. There's a chain, a quest, and Riya's sprint is open." | Borderline. The cast, the chain, the quest, the card and a lime link fight for attention, and the key sits at 80% of the screen height. Ishan touches the right edge. |
| S2 picker | "I have to choose 'when' and then 'what'. What does 'Open the sprint for a day' mean?" | Borderline. There are two decisions, the key is jargon, and "Rematch: Kabir's 10-minute race, with Riya and Kabir" names Kabir twice. |
| S3 in play | "It says I'm 9 seconds ahead of Riya, but Riya is ahead of me on the track?" | **Fail.** The chip and the track contradict each other (see Fatal 2). |
| S4 results | "I won." | Pass, but it is false while "4 of 5 played" (Fatal 3). |
| S4b moments | "Fix question 4. Whose faces are these?" | Partial. The moment rows show heads with no names. |
| S5 character | "Pick a face." | Partial. The 24 heads have no names, and the extras "Bulb" (a dot) and "Flag" (a triangle) cannot be read. |
| S6 Mob of one | "Send this code or the WhatsApp link." | Pass. The QR sits right on the screen. |
| S6 join | "Type my friend's code." | Pass. |
| S6 start | "Pick a subject and go." | Pass. It has the most honest line of all three: "Your Mob sees your marks, and one switch keeps them private." |

### The Trail
| Screen | First-timer's line | 3 s? |
|---|---|---|
| S1 lobby | "A road to a flag. 'Walk 120 questions'? Then I play Riya's sprint." | Partial. The key is clear, but the metaphor takes more than 3 seconds. "Sunday paper" reads as a paper you can only sit on Sunday. |
| S2 picker | "Send a challenge or play now? If I send it, do I play it myself? What do the 2 lit dots mean?" | **Fail.** This is the most confusing screen in all three directions, with four kinds of tile on one sheet. |
| S3 in play | "Answer the question. Riya is ahead of me." | Pass. The markers are about 30 dp, which is small. |
| S4 results | "Riya won, and the button fixes the one we all got wrong." | Pass for the student, but the data on it is impossible (Fatal 4). |
| S5 character | "Pick my character." | Pass. |
| S6a start | "Tap a name I like, pick a subject, start." | Pass. Six visible name chips is the clearest naming of the three. The flag is clipped and the trail runs under the name. "Start the Quiet Comets" reads oddly aloud (R6). |
| S6b Mob of one | "Send the card on WhatsApp." | Pass. "Show QR code" repeats the QR that is already on the card. |
| S6c join | "Type the code. It found their Mob, so press Join." | Pass. The preview shows no member names, which is the safest of the three. |

## Fatal issues (each must be fixed before any build; none can be waived)

1. **Shame by name. Arena S4 and S4b say "Riya, Meher and Kabir picked B on question 4."** This breaks the aggregate-only trap rule (MOB-FACTS 2.4) and the designer's own M2 line. The heads with pending rings and "0 of 3 fixed so far" also show at a glance who has not fixed it yet (T005, P6). Use counts only, as the Den does: "3 of you picked ₹1,80,000."
2. **A lie in the runner. Arena S3 shows the chip "9 s ahead of Riya" while Riya's ghost stands on question 4 and you are on question 3.** The pace chip has to be computed from the same positions the track draws.
3. **A premature result. Arena S4 says "You came out on top, with 20 marks." beside "4 of 5 played", and one member can still play.** The headline also appears at 150 ms, before the plinths rise, which kills the suspense (FRAMES-reveal). Write "You're on top so far" while anyone can still play, and show the headline only after the reveal.
4. **Trail S4 has impossible data and a false interim order.** Kabir's one non-right answer is "Skipped one instead of guessing", Riya got 5 of 5, and only 5 of 20 answers were not right. So "three of you picked B on question 4" cannot be true. In the reveal at 1250 ms, the winner's lime plinth reads "0 of 5" while Kabir reads 3. That is the false-order defect the Arena already fixed, and the tallest lime plinth gives the winner away from 800 ms on (R5).
5. **The podium contradicts the CUET lesson (Den S4, Trail S4).** The Den ranks by right answers with time as the tie-break, so "You" (4 right and, by elimination, 1 wrong, which is 19 marks) beat Riya ("no wrong answers, and one smart skip", which is 20 marks). The game praises the skip and then ranks the guesser higher. The Trail says "Marked like CUET: +5, -1" in S2 and then scores "4 of 5" in S4. Use CUET marks as the one scoring unit, as the Arena does.
6. **A claim nobody can know. "Smart skip. ... That saved you a mark." (Arena S4b).** Whether a skip saved a mark depends on an answer the student never gave. Say only what the data shows: "You skipped question 4, the one most of your Mob got wrong." This applies to the "smart skip" rule in all three (AGENT_RULES 5, 17).
7. **Symbols a school app cannot ship.**
   - The Arena stickers "So close" and "Respect" use a bomb glyph.
   - The Arena character "Cap" is a white pointed hood with a dark eye slit, which reads as a hate-group hood at small sizes.
   - The "Scarf" extra in the Den S5 and Trail S5 reads as a handgun at button size.

   Redraw all of these before anyone outside the team sees them.
8. **Hiding a feature that works today (R3).** All three Mob-of-one screens say games start only when a friend joins. Today a lone member can sit the weekly paper ("Sit this week's paper", MOB-FACTS 1.2 item 5). Keep it (the Den's "Sprint with Mobi while you wait" can sit beside it).
9. **The privacy of "practised today" as drawn.**
   - **Trail S1** gives Aarav an unlit grey lantern beside "Riya, Kabir and you practised today". That names who did not practise in all but words.
   - **Den S1** shows an open paper only in front of the two who practised, so Zoya's absence is readable too.

   Both default the switch to on. This reverses P6 and touches minors' consent (DPDP, P12). It needs the owner's yes, the default off, and no per-person marker for those who did not practise.
10. **Live play is drawn as if it exists.** The "Here", "Live" and "Kabir is here now" labels, "Play now with Riya" and "Live, right now" all need Realtime, which does not exist (MOB-FACTS 2.5). They are fine as a design, but the first build must ship the no-presence states. Building them as drawn would be fake activity (T009).

Smaller copy and truth defects to fix on the way:
- **Trail.** "Sunday paper" is the wrong name for a paper that is open from Monday to Sunday. "Economics, 4 friends" counts you as a friend.
- **Den.** S2 merges the 10-question weekly paper into "Full mock together". S6c shows three members' first names to anyone holding a code; use the Trail's "3 of 5 seats taken" instead.
- **Fixtures.** Each direction's fixtures disagree with themselves: the Den has Kabir "here" in S1 and S2 but a ghost in S3, and the Arena scores in marks but its lobby chips say "4 of 5".

## The winner, and why the Den beats the others for a 17-year-old

- **One glance, one action.** S1 puts people first (the room), then one fact ("Riya and Kabir practised today."), then the key. The Arena puts four systems on one screen; the Trail gives 40% of the screen to a road.
- **Characters with a life.** The paper folk (Patang, Cutting the chai cup, Admit, Ticket, Naav) are the most polished and the most Indian-student of the three sheets. The Trail mixes in generic animals (an owl, which is Duolingo's own mascot, and a rabbit and a whale). The Arena's set is flatter and repeats triangles (Dart, Peak, Cap). One gap: the Den family has no antenna and almost no mittens or boots, so it is related to Mobi through the visor alone. Take the Arena's antenna, mitten and boot kit.
- **Celebration earned by suspense.** In the Den reveal, stacks 3 and 2 fill first and the empty "1" stack waits (strip at 600 ms). That is a real moment. The Arena gives the result away in the headline, and the Trail gives it away with the lime plinth.
- **Bringing friends.** "Aarav saved you a seat in Chai Circle" is the one invite line a teenager would actually forward. Den S6c is the fastest join of the three.
- **Premium, not childish.** The lamp light, the paper stacks and the warm ground fit the app's materials (Mobi's lamp `F2A93B`). The Arena's bombs and crowded cast read younger. The Trail's lime road and flag break "lime belongs to Mobi and the key" (Trail S1 and S4 use lime for the road, the flag, the milestones, the winner's plinth and "3 of 4 sat").
- **Build risk to manage.** A full illustrated room with five characters is expensive to keep crisp in Flutter. Build the den as one parametric stage (wall, window, lamp, table, shelf as painted layers) with the characters drawn by the same painter as the Folds. Profile it on a cheap phone before polish (AGENT_RULES 34).

## What to take from the others (in priority order)

1. **From the Arena, CUET marks as the only score.** Podium, highlights, tie line and quest all use marks (+5, -1, 0), and the runner shows a "+5 if right, -1 if wrong" pill (Arena S3, Trail S3). This makes the smart-skip lesson consistent (Fatal 5).
2. **From the Arena, the ghost-race card with a true pace chip.** Use the "Ghost race" header, the chip ("9 s ahead of Riya", neutral ink when behind, never red) and the line "Each friend shows where they were at this moment of their own run." Compute the chip from the positions the track draws (Fatal 2).
3. **From the Arena, the reveal rule "counters rise together".** Plinths translate up and never scale from 0, the bounce stays at most 0.12, and the result is settled by 2000 ms. Show the Den's tie sentence only after the counters settle.
4. **From the Trail, a check on Wednesday.** After "Fix it together", each student who missed the question gets one fresh question now and one on Wednesday. A shelf stamp only goes up after the delayed check passes. This is Score Recovery's "check the fix holds", done socially, and it is the best learning idea in the three directions.
5. **From the Trail, the collective line before the ranks.** Put "Your Mob got 15 of 20 right together" above the podium, and add the rule "ties share a height; tied players are never split".
6. **From the Arena, "Everyone's moment" with a fixed rule order** and the honest fallback "Played all five", with a name on every row.
7. **From the Arena, the trap progress as a count.** Show "0 of 3 fixed so far" with no faces and no names of who is pending (Fatal 1).
8. **From the Arena, the character kit.** Give the Den's paper folk Mobi's antenna, mittens and boots plus the lamp rim on Night limbs (Arena AVATARS sheet). Keep lime for Mobi alone, and do not let the default "You" be lime-green: in the Arena, Hex in green reads as Mobi in the header.
9. **From the Arena, the create screen's honest line** "Your Mob sees your marks, and one switch keeps them private." Also take the labelled "Roll again" button in place of the Den's unlabelled die icon.
10. **From the Arena, a picker with a preselected default.** Sprint comes preselected with its chapter set to the Mob's last trap or the student's weakest chapter, with "Change" beside it. That lets the Den's S2 be one tap from open to play.
11. **From the Trail, a safer join preview.** Show "Quiet Comets, Economics, 3 of 5 seats taken" with characters and no first names.
12. **From the Trail, six visible name chips** plus "Show six more", in place of a fake text field. The Arena's rest days are already matched by the Den's weekly streak, so keep the Den's weekly streak rather than the Arena's daily chain. A daily chain that needs two friends every day is a daily obligation for teenagers in tuition season (T005).
13. **From the Trail, the received sticker as a chip on the results** ("Kabir: Teach me"). "Teach me" is the most useful sticker in all three sets.
14. **From the Arena, the Mob of one with the code and QR on screen**, with the Den's "saved you a seat" card copy.

## Owner decisions to ask before the build (one list, collected from all three)

1. Allow a podium inside a single Mob game (this reverses P5)? The Arena also suggests a Mob setting, "Show a podium", on by default.
2. Allow a "practised today" signal? Recommended: an opt-in switch, default off, showing names of those who practised only, and no per-person marker for those who did not.
3. Allow a weekly Mob streak with no loss threat that keeps the best run (T005)?
4. Shorten codes from 8 to 6 characters (a migration)?
5. Let any member open sprints and races? Today only Pro makes extras, 3 a week, so this is a Free and Pro pricing call (D101).
6. Should the first build be async only (challenges with ghosts)? Live play, presence and push would come later, as L-size builds that need Realtime and FCM.

## Best screens to show him

Den S1 lobby (Night), Den S4 results with the empty-stack reveal, Den S6b "Save a seat for a friend", Den S6c join, Arena S3 ghost-race card (once the chip is fixed), Arena S4b "Everyone's moment", Arena S6 Mob of one with QR, Trail S6a name chips, and the Den avatar sheet (`avatars-24-night.png`).

## Limits of this judgement

- I judged from PNGs and frame strips rendered in a headless browser by the designers. No screen was walked on the emulator (R1, R5). No 412 dp, large-text, contrast or web 390/1440 check exists for any direction.
- The fixtures are illustrative, so the truth findings above concern the rules and copy the fixtures expose. They are not claims about real data.
- The scores are my judgement against the brief, not evidence of student behaviour (AGENT_RULES 38). Test the sticker set, the quest size and the character silhouettes with real 16 to 17-year-olds before polish.
