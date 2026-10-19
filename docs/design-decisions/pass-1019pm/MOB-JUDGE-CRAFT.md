# Mob directions: the craft and truth judge (19 Oct 2026 PM)

Judge: Opus subagent, for the owner's pick (R8). I read MOB-FACTS.md, MOB-DEN.md, MOB-ARENA.md and MOB-TRAIL.md in full, AGENT_RULES.md and the owner's UI standards (section 10 slop list, section 13 test and rubric). I looked at every PNG in `tmp/design-1019pm/mob-{den,arena,trail}/` in Night and Day, the three avatar sheets, every frame strip, and single frames where a strip was too small to judge (Trail S4 at 450 and 1250 ms, Den reveal at 600 ms). I did not open the mock-up HTML in a browser and did not run anything on the emulator, so the motion verdicts below come from the designers' browser frames only.

All numbers in the mock-ups are illustrative fixtures. I still checked whether each screen's numbers agree with each other, because a mock-up that lies to itself becomes a build that lies to students.

## Verdict

**The Den wins the first build.** It has the best characters by a clear margin, the clearest lobby, a results reveal with no false frame, and the most honest default for a Mob of one. It has two real privacy defects (the "practised today" default and the quest bar's per-member split, see F6), and I would fix both before he picks. **The Arena comes second.** Its game thinking is the sharpest: real CUET marks, counters that rise together, a quest counted only from Mob rounds, and practice days kept private by default. But its results screen names who got the trap wrong, and its characters are flat and generic. **The Trail comes third.** The idea of a shared path is lovely, but the screens are the weakest: volt is everywhere, the results reveal shows a false order, the trap numbers cannot be true, and the characters lose Mobi's arms.

| | The Den | The Arena | The Trail |
|---|---|---|---|
| Rubric, 12 dimensions, 0/1/2 (my score) | **17 of 24** | 14 of 24 | 12 of 24 |
| Designer's own score | 17 | 18 | 19 |
| Anti-slop test (pass / partial / fail of 12) | 7 / 4 / 1 | 6 / 4 / 2 | 5 / 4 / 3 |
| Characters (fit with Mobi and the app) | Best: textured paper, Mobi's visor, limbs and boots, Indian names | Consistent but flat geometry; the default Hex reads as Mobi | Crude flat SVG with no arms; half are animals |
| Motion (R5 from the frames) | Clean, settles by 2000 ms | Clean and true order, settles by 2000 ms | False interim order, squashed text, 3400 ms |
| First-build fit on existing tables | Good. The den scene costs the most UI time | Best. The quest and chain come from Mob tables only | Good. The trail path is M; the lanterns need new data |

## The rubric, dimension by dimension (my scores, not the designers')

| Dimension | Den | Arena | Trail | Why |
|---|---|---|---|---|
| Task fit | 2 | 2 | 2 | All three answer his ask: characters, 2 to 5 friends, flexible play and joining with a code. |
| Information architecture | 2 | 1 | 1 | Arena S1 stacks cast, chain, quest and action, and the "More ways to play" link sits against the bar. Trail S2 has four kinds of tile on one sheet, and "Sunday paper" renames a paper that is open all week. |
| Content truth | 1 | 1 | 0 | Den: "practised today" is on by default (F6) and live presence is drawn (F1). Arena: the S3 pace chip contradicts its own track (F5). Trail: in S4 "three of you picked B" is impossible with the scores shown, it claims CUET marking but ranks by count, and "4 friends" counts you (F2). |
| Readable hierarchy | 2 | 1 | 1 | Den S1 reads den, then line, then key. Arena S1 is dense. Trail S1 has at least six volt elements competing with the one volt key (trail ink, 30 and 60 chips, flag, the "You" tag, "3 of 4 sat", the key). |
| Visual specificity | 2 | 1 | 2 | Den's room and stationery folk could only be MockMob. Arena's oval floor and code-drawn heads are generic. The Trail's path concept is distinctive even though its art is crude. |
| Accessibility | 1 | 1 | 1 | Den: 9.5 px sticker labels, Night limbs dark on dark, and unlabeled icons for the extras in S5. Arena: S4b's "Everyone's moment" rows name nobody, so a head colour is the only signal (slop 14); its "So close" sticker is a bomb; locked heads in S5 Day are near invisible. Trail: legs invisible at Night, and locked tiles are black silhouettes. |
| Functional states | 1 | 1 | 1 | Each specifies most states in words and draws only a few. |
| Trust | 1 | 1 | 1 | Den: S6c leaks members' names before joining (F7), plus the Pip line (F8). Arena: S4 names who got it wrong and gives the answer while the round is still open (F4). Trail: lanterns are on by default (F6). |
| Intentional motion | 2 | 2 | 0 | See the motion section below. |
| Performance | 1 | 1 | 1 | None of the three is profiled. Den's scene is the heaviest, and Trail's 312 dp path scene comes next. |
| Responsive integrity | 1 | 1 | 1 | All were drawn at 360 dp only. |
| Instrumentation | 1 | 1 | 1 | Each names its metrics, but none has wired them. |
| **Total** | **17** | **14** | **12** | |

## Fatal or must-fix before the owner picks (blunt)

- **F1. All three draw live presence the first build cannot ship.** Den S1 ("Here"), S2 ("Kabir is here, so he plays live") and S3 ("Zoya is playing now", "Live"); Arena S1 ("Kabir is here now" with the floor ring) and S2 ("Live, right now"); Trail S2 ("Play now with Riya") and S3 (Riya's live dot). MOB-FACTS 2.5 says there is no Realtime and no push, and every spec agrees that the first build is async only. Arena's own spec even says the ring "is not drawn" until Realtime exists, yet its S1 draws it. If he picks from these screens, he picks a feeling that will not ship. **Each direction needs its S1, S2 and S3 redrawn in the async-only state before the pick.**
- **F2. Trail S4 lies to itself.** It shows "three of you picked B" on question 4, but Riya scored 5 of 5, and Kabir's only miss was a skip ("Skipped one instead of guessing"). That leaves at most two people (You and Aarav) who could have picked a wrong option. The screen also says sprints are "Marked like CUET: +5, -1", yet the podium ranks by right answers. Under CUET marks, Kabir (4 right and a skip, 20 marks) beats You (4 right and 1 wrong, 19 marks), but the two are drawn tied. The highlight that praises skipping means nothing under the scoring the screen actually shows.
- **F3. Trail's results reveal fails R5.** At 1250 ms the winner's volt plinth reads "0 of 5" while the others read 3, 2 and 2: the exact false-order bug Arena found and fixed. At 450 ms the "0 of 5" text is squashed vertically because the plinth scales from the floor with its label inside (slop 6: never scale content). The whole reveal runs to 3400 ms, well past momentT3 (2000 ms).
- **F4. Arena S4 names the people who got the trap wrong.** It reads "Riya, Meher and Kabir picked B on question 4. The answer is C." and S4b shows their three heads under "0 of 3 fixed so far". This breaks Arena's own M2 ("never names"), the aggregate-only trap rule (MOB-FACTS 2.4) and the both-share rule. It also states the correct answer while "One more of your Mob can still play until 9:12 AM", so friends can pass it on. Rewrite it in the Den's aggregate form ("3 of you picked B"), and hold the answer until the round closes or everyone has played.
- **F5. Arena S3 contradicts itself.** The chip says "9 s ahead of Riya", but Riya's ghost head is drawn a stop ahead of yours (on stop 4, while you are on stop 3), both before and after the redo. On the screen whose whole job is truthful pace, the two signals must agree.
- **F6. The privacy defaults in the Den and the Trail.** "Show that I practised today" (Den) and the lantern sharing (Trail) are on by default. AGENT_RULES 14 says: never preselect privacy-sensitive opt-ins. These users are 16 and 17, and DPDP consent for minors is still open (P12). The Den's quest bar is worse than it looks: "every question any member answers anywhere in the app counts", split into each member's colour, shows every friend's total practice volume for the week. The Trail admits its lanterns let friends work out who did not study. **Arena has the right model**: its quest and "played today" count only Mob rounds, which every member already sees, and practice days stay private unless switched on (default off). Graft it.
- **F7. Den S6c reveals members' names before you join.** Typing a code shows "Riya, Kabir and Zoya are in" with their characters. A code is forwarded on WhatsApp, so this hands three minors' first names to anyone who has it. Today's join screen shows only the inviter. Use the Trail's form: "Quiet Comets, Economics, 3 of 5 seats taken".
- **F8. Den Pip's line: "Keeps everyone's notes, and everyone's secrets."** In a social product for minors, "keeps secrets" is exactly the framing that child-safety guidance warns against. Rewrite it (for example, "Keeps everyone's notes in order").
- **F9. The characters must stay in Mobi's family and must never look like Mobi.** Trail's Folds drop Mobi's rubber-hose arms and mittens (most have only stubs, invisible at Night), and 9 of the 24 are animals (fox, owl, whale, rabbit, elephant, turtle, butterfly, tulip, frog), not exam paper. Arena's default "You" (Hex, green 9FBF4A, with an antenna, a visor and a 40 dp disc beside the lime "Ask Mobi" icon in S1, S6a and S6c) reads as Mobi himself, despite the spec's "lime is Mobi's alone". Arena's Dart and Peak are the same triangle.

## Smaller defects (cited by screen)

- **Den S3.** The Q1 to Q5 labels under the track are clipped (only the tops of the letters show). Ghost scores ("scored 4 of 5") are shown during play. They are real, but they add pressure mid-paper; show the pace only and keep the score for the results.
- **Den S4.** The tie is broken by speed ("You were 21 seconds faster"). CUET gives no marks for speed, so this teaches rushing. The Trail rule, where ties share a height, is kinder and truer. The gold rosette uses a colour that is not in the tokens. "Riya: one smart skip" asserts something it cannot know (see the smart-skip note below).
- **Den reaction frames.** The sticker lands between Riya and You (620 ms frame), so the target is ambiguous. It must land squarely on the friend it was sent to.
- **Den S1.** The flame on the "4 weeks in a row" pennant is Duolingo's loss-pressure idiom; use the Den's own paper pennant or a stamp. The five-at-a-table layout is untested (four are drawn, at 88 dp each).
- **Den S5.** The "One extra" icons (half circle, infinity, a hammer-like scarf) carry no words.
- **Den S6b.** The WhatsApp card copy "Accountancy on MockMob. Code K7P 2M9" is a clipped fragment (R6).
- **Arena S1.** Ishan's character touches the right screen edge, and the names sit at three different heights. The daily chain ("a day joins when two of you play") sets a daily cadence for minors; the weekly runs in the Den and Trail are calmer (T005 spirit). The key has a vertical lime gradient where the app's key is flat.
- **Arena S4.** The headline "You came out on top" lands at 150 ms, before any plinth rises, so the suspense of the podium is spent. That is acceptable as truth-first, but then drop the slow plinth stagger. The fourth sticker is cut at the edge, and the trap text runs under the sticky footer.
- **Arena S4b.** "Smart skip... That saved you a mark" claims a counterfactual.
- **Arena S5.** The 24 heads have no names in the grid, so a first-time student cannot tell which character is which (R2).
- **Trail S1.** "Economics, 4 friends" counts you, so it means 3 friends. "Sunday paper" names a paper that opens Monday and closes Sunday 11:59 PM (MOB-FACTS 1.4). The trail scene takes about 40% of the screen for a moon and hills.
- **Trail S2.** The two lit pips on the Sprint tile have no meaning. "Full mock together, sat this week" is ambiguous.
- **Trail S4.** "One fresh question on it on Wednesday" is wrong when the sprint is played on Tuesday night; say "in 2 days".
- **Trail S6a.** The trail runs behind the Mob name and the flag is clipped (admitted).
- **Trail S6c.** The join sheet is drawn over the "Start a Mob" page, which is the wrong context.
- **Smart skip in all three.** A skip "saves a mark" only against a guess that never happened. Use the Trail's factual wording ("Skipped one instead of guessing"), and show it only when the Mob's majority answer on that question was wrong, so the praise has a real basis.

## Motion (R5, from the designers' browser frames)

- **The Den is clean.** The stacks rise third, second, first, the characters land, and names and scores appear with them, so no frame shows a false order (checked at 600 ms: only Kabir's "3 of 5" is visible). Highlights, then the trap card, then the tray; it settles at 2000 ms. The lobby breathe is subtle, at the right level of life, and stops after 12 s. The reaction is let down only by its landing target.
- **The Arena is clean and the most rigorous.** The counters rise together, so the order is true at every frame (900 to 1200 ms checked, the only equal values being a momentary tie of 14 and 14). The plinths translate rather than scale, and it settles by 2000 ms. Idle stops 10 s after the last touch.
- **The Trail fails.** It shows a false interim order, squashed text, and a 3400 ms reveal. The lobby-enter ink draw (700 ms) is good.
- **None of the three is captured on the emulator yet.** All the frame strips come from browsers, so R5 sign-off stays open whichever direction wins.

## Build cost on the existing tables (MOB-FACTS section 6)

- **Common to all three (first build).** A `mob_members.avatar` column (plus colour, which exists, and an extra); rounds on `mob_extras` (a policy change: any member may open one, a 24-hour `closes_at`, and a different cap, which is his pricing call, D101); ghosts from `detail.t` (extra sittings need the column too); `mob_reactions` with a fixed enum; preset names; 6-character codes (a migration and his OK); QR. Each direction prices these at roughly M.
- **The Den.** The den scene is the costliest UI. Build it as a cached background picture (window, lamp, shelf and table) plus separate character painters, cap the idle loops, and lay out five seats at 360 dp before building. Its "practised today" flag and quest across all practice need new per-member data from `attempts` with a sharing switch, so swap in Arena's Mob-rounds-only rule and both become computable from existing tables.
- **The Arena.** The cheapest truthful set: the chain and quest come from sittings only. Race mode is a new runner mode (M).
- **The Trail.** The path is a PathMetrics position along a fixed curve (M). The lanterns need the same new per-member daily flag. Its spaced check (one fresh question two days later) reuses the Score Recovery check.

## The best ideas to graft onto the Den

From the Arena:
1. **Real CUET marks** (+5 / -1) on results and in the ghost race card ("+5 if right, -1 if wrong"), with counters that rise together. This is the clearest exam teaching of the three. Its below-zero headline copy is the right model for a poor result (R-081).
2. **Quest and "played today" from Mob rounds only, with practice days private by default** (the fix for F6). It also makes both computable today.
3. **The ghost race card** (Arena S3): a labelled card, 34 to 40 dp heads and a pace chip, once its contradiction (F5) is fixed. It is clearer than the Den's free-floating track.
4. "Answers show at the end, for everyone at once." and "One more of your Mob can still play until 9:12 AM." (it names no one).
5. **A Mob of one with the code, the QR and "Join with a code" on one screen** (Arena S6a), and the honest start copy "Your Mob sees your marks, and one switch keeps them private." (Arena S6c).
6. **A Mob setting "Show a podium"**, on by default, so the owner's P5 reversal can be undone by any Mob.
7. **Idle stops 10 s after the last touch**, and a tap wakes it.

From the Trail:
1. **Ties share a height** (no tie-break by speed).
2. **A delayed check**: fix now, then one fresh question 2 days later (not on a fixed weekday). That is the "check the fix holds" step of Score Recovery, and stronger than the Den's two check questions straight after.
3. "Your Mob got 15 of 20 right together." as the cooperative line above the podium.
4. **A join preview with no member names** (the fix for F7).
5. **Mobi on the trap card**, one real moment per screen (the Den removed Mobi everywhere).
6. "Skipped one instead of guessing" as the factual skip highlight.
7. The received-sticker chip at the top of the results ("Kabir: Teach me").

The Den's own ideas to keep: the paper folk (redraw Crane and Phirki as the Den admits, and keep Patang, Naav, Cutting, Kandil and Admit as the hero set), Fix it together, the shelf that never loses anything, Pace Mobi for a Mob of one, and Stump the Mob for later.

## The best screens

- The Den: S1 lobby, S4 results, S6b A Mob of one, and the avatar sheet (Night and Day).
- The Arena: S3 ghost race card (after F5), S6c Start a Mob, S6a A Mob of one.
- The Trail: S6c the join sheet (no names, rides the keyboard).

## Decisions the owner must make knowingly (all three directions)

Podiums inside a game reverse SOCIAL-SPEC P5 ("never ranked"). A practice-day signal reverses P6. A Mob streak touches T005; the weekly form, with no warning and the best run kept, is the safe one. 6-character codes need a migration. Letting any member open rounds changes the Free and Pro split for extra papers. Live play and push are L-cost and come later. His 19 Oct words invite these changes, but each one should be his explicit yes.
