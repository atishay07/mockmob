# Mob v3: craft and truth judge (19 Oct 2026, evening)

Judge for the main session, before anything goes to Atishay. I judged craft and truth: motion from the recordings and frames, the anti-slop test and the 0/1/2 rubric from `docs/research/premium-ux-ui-2026-10/` (AGENT_RULES.md and papers/ai-slop-independent.md), honest numbers, safety for minors, Free against Pro, the ethics of the streaks, and what each piece costs in Flutter.

What I looked at: both specs (`design-live/MOB-V3-LIVE.md`, `design-arena/MOB-V3-ARENA.md`), `CHARACTER-WORLD.md`, the character `LEDGER.md`, all four contact sheets, single screens at full size (den, race, podium, Free and Pro), every frame strip in both `motion/` folders, the reduced-motion strips, and dense frame sheets I cut from the animated WebPs for the podium, the countdown and right/wrong (every 3rd frame, so a false frame cannot hide between the eight strip frames). I also rendered the 12 cut-outs at 24, 40 and 64 px. Nothing was built, run on a device, committed or deployed. I opened no browser.

## 1. Verdict in five lines

1. **Build Den Arena** as the base. It is the more premium, more truthful and better-finished pack: the den uses the app's own lamp-lit scene art, the podium keeps the true order on every frame, ties are handled, answers stay closed until the room closes, no one's Pro status shows, and no price appears inside the Mob.
2. **Graft from Den Live** the things it does better, above all the **ruler race with full-body characters walking along it**. That is the descendant of the S7 live-play screen Atishay called "cool", and Arena's lanes of small head tokens lose it. Also graft Live's visible "Skip" on the podium, the "so far" podium, the "Fix it together" answer sheet, the quiet den's real times and the WhatsApp invite card.
3. **Characters: style C** (lamp-lit folded paper) for the app, B only for marketing photos, A shelved. But tell him honestly that A, B and C are the same figures with a different finish, not three directions, and that the cast still has one expression system (the visor) and some colour collisions.
4. **Nothing is fatal to the direction**, but eight defects must be fixed before he sees it again (section 6). Two of them put a false number or a false order on screen for part of a second, which our truth rule does not allow.
5. **Scores:** Den Arena **8 / 10**, Den Live **7 / 10**, character world **7 / 10**.

## 2. Scores per area (0 to 10)

| Area | Den Live | Den Arena | Why the gap |
|---|---|---|---|
| Lobby (den, ready up) | 7 | 8.5 | Arena's den sits in the app's generated room (window, lamp, desk, shelf) and is the single best screen in either pack. Live's den is a drawn grid wall with a vector cone: it reads as v2 again. Live's ready-up with the sticker row is good. |
| Live play (countdown, race, feedback) | 7.5 | 7.5 | Live has the ruler with walking full-body characters (his S7), but four figures overlap at one number and the question cross-fade shows a double-exposed frame. Arena's lanes with OMR bubbles are clearer for 4 to 5 people and its stopwatch is gorgeous, but its head tokens clip, Dart and Naav heads are near twins, and its "3" is broken (section 4). |
| Results (podium, moments, fix) | 7 | 8 | Arena: order true at every frame, a tie shares a height, whole Mob shown. Live: the count-up shows the winner below second and third for about half a second. Live's "so far" state and Fix-it-together sheet are better. |
| Streak | 7 | 8.5 | Same rules (taken from the research). Arena's Mob-week moment with the needle is a real moment; Live's is a 1.4 s change on a dense screen and contradicts its own quest. |
| Free vs Pro | 6 | 7.5 | Both keep "only Pro starts games" and both are list-heavy. Live shows a price in the Mob and pairs it with "Nothing in the Mob is ever for sale". Live sells 6 lamp themes to Pro, a paid cosmetic. Arena hides who has Pro and leaves price to the paywall. |
| Characters (in use) | 7 | 7 | Same generated cast, one pose each, moved as still puppets. Arena gives Kandil a "late nights" line. |
| Motion | 6.5 | 7.5 | Both are rich and on the 600 ms beat with app curves. Live has more false frames (section 4). |
| Brand identity | 7.5 | 8.5 | Both pass the cover-the-logo test (paper, stamps, lamp, one volt, stationery). Arena's scene art carries it further; Live's flat vector envelope next to 3D figures is a seam. |
| **Overall** | **7** | **8** | |

## 3. The 0/1/2 rubric and the 12-part anti-slop test

Rubric (0 missing, 1 partly done, 2 validated). I gave 2 only where I could verify it in the frames. Nothing has been checked on a phone, the emulator or with a student, so performance, responsive integrity and instrumentation are 0 for both.

| Dimension | Live | Arena |
|---|---|---|
| Task fit | 1 | 1 |
| Information architecture (one primary action) | 2 | 2 |
| Content truth | 0 (false-order podium frames; chain goes to 5 weeks at 41 of 60) | 1 (quest bar says 60 of 60 when 70 were answered) |
| Readable hierarchy | 2 | 2 |
| Visual specificity | 2 | 2 |
| Accessibility | 1 (visible Skip, reduced motion kept) | 1 (reduced motion kept; header text over the bright scene by Day is low contrast; large text unchecked) |
| Functional states | 1 (quiet den, Mob of one, quota copy in the spec only) | 1 (quiet den, Mob of one; no drop, reconnect, host-left or offline screens drawn) |
| Trust | 1 (price and "never for sale" together) | 2 |
| Intentional motion | 1 | 1 |
| Performance | 0 | 0 |
| Responsive integrity (412 dp, 5 members, large text) | 0 | 0 |
| Instrumentation | 0 | 0 |
| **Total of 24** | **11** | **13** |

Anti-slop test: both pass 1 (identity), 2 (one primary action), 4 (hierarchy), 5 (composition), 6 (type roles) and 9 (no invented crowds, no bots, every ghost is a real run). Both are partial on 3 (true content, see the defects), 7 (states), 8 (accessibility) and 10 (motion rationale: the full-screen volt flash and Arena's sunburst rays explain nothing). Both fail 11: neither names a leading metric and a guardrail. I suggest: leading metric, the share of Mobs with 2 or more members who play at least one Mob game a week; guardrails, the existing stop rule (over 2 reports per 100 members, or over 40% leaving within 7 days) plus Mob-reminder opt-outs. Test 12 (what would be better without this?): remove Arena's light rays on the reveal and Live's grid wall.

## 4. Motion: what the frames show

Both packs use the app's curves and springs, the 600 ms Mob beat, a light change to open each moment, at most three movers, tap to skip, and reduced motion that keeps order (podium places, countdown beats) with 120 ms fades. The real-time webm files are a CDP screencast, not Playwright `recordVideo`; Arena measured 4805 ms against 4800 for the podium, so timing is credible. Frame rate on a phone is unknown.

**Good, keep:**
- Arena podium (4.55 s): Zoya's count, then both seconds unfold and drop together with squash, marks roll up from the place below, then the first plinth and Riya, with the foil sweep. I checked 26 frames: the order is true in every one. The tie is shown honestly.
- Arena week stitched: lamp, pennant lift, number roll, needle sews the stitch, decaying sway, desk bell. This is the streak moment the owner asked for.
- Arena countdown on the stopwatch art with the volt arc: the best "brand" moment in either pack, once the numeral bug is fixed.
- Arena ghost race: the pace chip flips truthfully from "4 s behind Kabir" to "4 s ahead of Kabir" at real recorded pace.
- Live reveal: the parcel gathers, wobbles, light leaks, flaps open, Crane rises. Calm and earned-feeling, no rays.
- Live ready-up hops with "Ready" stamps on the beat; Live's visible "Skip" pill on the podium (better than "tap anywhere" for students new to apps).

**False or weak frames found:**
1. **Live podium, false order (truth defect).** Frames 38 to 59 (about 1.5 to 2.4 s): You reads 3 and then 10 marks while third-placed Kabir shows 14; Riya reads 3, 11 and 15 while You show 19. For half a second the winner is shown below the people she beat. Arena found and fixed this exact bug; Live did not. Fix: roll each count up from the mark of the place below, as Arena does.
2. **Arena countdown, broken numeral.** In the 3 beat (frames 0 to 2 and the 450 ms strip frame) the "3" renders as a mangled blob, the 3-to-2 and 2-to-1 changes overlap two numerals at half opacity, and the stopwatch's brass pivot sits on top of the digit (also visible on the static S9). Fix: one numeral at a time on its own layer above the dial art, with the pivot masked or drawn under it.
3. **Both: Go live fills the whole screen with 100% volt** (Live 240 to 400 ms, Arena about 400 ms). On Night this is a hard lime flash. It is one flash, so it is not a seizure-threshold problem, but it is harsh, it is not "Night stays subtle", and it carries no information. Fix: stop the circle wipe at about 40% coverage and let the lamp light do the rest, or tint at 20 to 30%.
4. **Live right-to-wrong cross-fade** (about 1520 ms): both questions and both option sets are visible at once, a double exposure of text. Fix: fade out, then in (Arena cuts cleanly).
5. **Live enter-the-den, frame 0:** the whole phone is black, including the bottom bar. Entering the Mob tab must keep the shell; only the den content should come in.
6. **Live podium, ghost drop:** You is semi-transparent mid-drop (frame 35) and a faint Riya shape shows above the stage before her turn (frame 32). Arena fixed both.
7. **Live countdown, dead tile:** at 1800 ms the tile is empty with only a ring for about 120 ms between "1" and "Go". Live Day countdown uses a grey scrim (the Day grey that Arena fixed to a warm ink dim).
8. **Live Mob streak moment:** the pennant goes 4 to 5 weeks while the quest card under it still reads 41 of 60. A chain cannot extend before the quest is done. In the quest-complete moment the pennant then stays at 4. The two moments contradict each other, and the stitch is too small to read.
9. **Arena quest complete:** the count rolls 56, 58, 60 and stops at "60 of 60 answered", then the text says 70 were answered. Roll to 70 ("70 answered, the quest needed 60").
10. **Arena reveal:** the parcel turns into a full-screen sunburst with rays. That is the loot-box opening idiom. Our rule is that nothing looks like gambling; the silhouette was shown in advance, so the show is honest, but the rays should go. Keep the warm leak (as Live does).
11. **Type-on clips:** Live shows "Hos" (for Host) and Arena "4 weeks in" as frames. Acceptable as a wipe, but engrave whole words, not letters.

**Reduced motion:** both keep order and information. Live's reduced podium still runs 5.2 s; Arena's runs about 1 s. Arena's is right; nobody who asked for less motion should wait five seconds.

## 5. Truth, safety and fairness

**Truth (held in both).** No crowds, no bots, presence only from a channel entry, ghosts are real runs with name and time, "so far" while the 24-hour twin is open (Live draws it; Arena specifies it but draws only "Everyone has played"). Marks are CUET marks. Arena's fixture is checked in code and adds up (Riya 20, You 19, Kabir 19, Zoya 13, 15 of 20 right). Live's adds up too (19, 20, 14; 11 of 15).

**Answer leak in Live.** Live screens 11 and 12 show the right option and the full explanation the moment you lock in, and 15 to 17 open "Fix it together" with the full working while "one more can play until 8:02 PM tomorrow". That hands the answer to anyone who will tell the friend who has not played (on WhatsApp, if not in the app), and it contradicts Live's own section 5 ("Explanations and the shared trap open for everyone when the window closes"). Arena's rule is right: your own right or wrong after you lock in, the correct option and the why held until the room closes, and the fix opens only then.

**Who has not played is visible in both dens.** Both put a "Played" tag under each friend who played; the friend without one is, by elimination, the one who has not (Zoya in Live 02; You in Arena S1, harmless there, but it works for anyone). MOB-FACTS P6 and the copy rules say non-sitters are never shown. Fix: show the played runs as their own row ("Riya, 4:10 PM. Kabir, 4:55 PM.") or tag nobody.

**Small-group arithmetic names people.** Arena S15: "On question 4, 3 of you picked ₹3,00,000. Nobody got it right" next to "Riya skipped question 4" tells a 4-person Mob that each of the other three got it wrong. Live: "Question 4 caught 2 of you" in a 3-player room where Riya's 20 shows she had no wrong answer names Kabir and You. The existing trap rule needs 3 sitters, a pick by 2 or more and by half or more, and pass-1018 says counts under 5 are not shown. Use "Question 4 caught most of you" when a count would identify someone, and never pair a trap count with a named skip.

**Last place.** Arena reveals Zoya first, alone in the dark, for about one second before anyone else appears, then keeps her on the floor with her marks. The intent (everyone counted, no fourth numeral) is good; the solo spotlight is the one moment in either pack that can feel like being shown up. Bring her in with the collective line, or together with the seconds.

**Kandil.** Arena's reveal line is "Lights up the den on late nights", and the art rubs a sleepy eye. CHARACTER-WORLD itself says Kandil must never be tied to studying late at night, because that rewards the wrong habit in minors. Change the line ("Keeps the desk lit for everyone") and prefer a calm, awake idle pose.

**Coins.** The ledger rejected a reveal because its seal "reads as a lime coin". Arena's quest seal is a large lime-gold foil disc, and both den shelves hold two round gold-lime tokens. They are the app's own art, but in a game they read as coins. Make the seal square or scalloped paper, as the redone reveal art does.

**Free and Pro.** Both keep his rule that only Pro starts games, show every locked item with one reason, and make play, marks, chains, passes, characters and safety identical. That is a clear and generous split. Issues:
- Live puts "₹99 on the web ... ₹150 on Google Play" inside the Mob, which MOB-FACTS bans ("no price" in Mob copy; Pro is named only when Play billing is on), then says "Nothing in the Mob is ever for sale". Drop the price; say "Nothing you earn in the Mob is for sale."
- Live's "Den lamp themes: 1 vs 6" is a paid cosmetic. Arena earns a lamp theme at 12 Mob weeks. Keep cosmetics earned.
- Arena S7 states "The weekly Mob paper, in every Mob you are in" as a Free fact, but today Free gets one paper a week across all Mobs; that is a proposal needing his yes, so the screen must not state it yet.
- The billing-off dead end is real in both: with billing off nobody can start a game at launch, so the Mob would have the weekly paper and nothing to play. This is the most important decision to put to him; both agents recommend "anyone may start while billing is off". I agree.
- Pro benefits are thin on the "exclusive" side he asked for: start games, full mock together, deeper insights, more Mobs, past weeks. That is honest and enough, but say so plainly rather than adding paid cosmetics.

**Streak ethics.** Both are sound and ahead of most apps: two chains (private days, shared weeks), rest passes earned and applied by themselves, a free make-up within 48 hours, exam pause, "Hide my chain", best run kept, no flame, no countdown, no sad Mobi, no push, Pro changes nothing, the Mob quest counts questions answered, not marks, and resizes without naming anyone. Two cautions: Live's quest card lists "Monday's Mob paper, 3 of you", which in a 4-person Mob says one did not sit; list by game without the "of you" count when it identifies someone. And the 15-per-member quest size is a guess; test it with real students.

**No free text, no photos, first names only, stickers as a fixed enum, join preview without names (Arena)**: held in both.

## 6. Must fix before he sees it again

1. Live podium count-up shows the winner below second and third (frames 38 to 59). Count up from the place below.
2. Arena countdown "3" is a mangled glyph, numerals overlap at each change, and the pivot covers the digit.
3. Live shows the correct answer and the full explanation during a game whose 24-hour twin is still open, and opens Fix it together while one more can still play. Hold them until the window closes (Arena's rule).
4. Live's Mob chain extends to 5 weeks while the quest reads 41 of 60, and its quest moment leaves the pennant at 4.
5. Live shows a price inside the Mob next to "Nothing in the Mob is ever for sale".
6. Both dens let you infer who has not played from the missing "Played" tag; both trap lines identify who was wrong in a small Mob.
7. Arena's Kandil line "Lights up the den on late nights" contradicts the character world's own rule for minors.
8. Both: the 100% full-screen volt flash on Go live; Arena's sunburst rays on the reveal; Arena's quest counter stops at 60 when 70 were answered.

And one decision, not a defect: the billing-off rule. Without it, nobody can start a game at launch.

## 7. Characters

**What is strong.** The cast is the best brand asset this pass produced. Every Fold shares Mobi's visor, white capsule eyes, charcoal mittens and boots, so the family reads as one; each is an Indian student's desk object (chai cutting glass, kandil, patang, naav, receipt, sticky note) with a CUET habit attached; the group shot on the exam desk with the lamp is ready for a poster. The lore (a fixed mistake unfolds into a Fold, so every character is a mistake with a face) is the product promise as a story, which is exactly the storytelling he asked for, and the earn rules are deterministic and printed on the locked item. Free and Pro get the same collection. Good.

**What is weak.**
- **The A/B/C comparison is not a real choice.** A is C with gloss, B is C on a base. He said the first pass "captured something else" than what Gen Z likes; this pass answers with one look in three finishes. Tell him that plainly, and if he wants a real alternative, the honest second direction is a flatter, chat-size sticker drawing of the same cast (Genmoji's real lesson, readability), not more gloss.
- **One expression system.** With a visor and no mouth, the only expressions are two dots, two arcs and a lowered lid. Gen Z character culture (Smiski, Labubu, Sanrio) leans on expression and a bit of mischief. Before generating 55 poses, test 4 or 5 visor expressions (squint, wide, side-eye, sleepy, happy arcs) as one cheap overlay system that works on every Fold.
- **Colour collisions.** Hop (teal) and Hexa (teal-green) are one colour family; Dart (sky) and Naav (periwinkle) are both blue pointed shapes, and in Arena's race lanes their head tokens are near twins. Patang's kite echoes Mobi's diamond. Fix the palette so the starter four are four clearly different colours and shapes, and drop "recolour your own Fold" for build 1: recolouring a 3D raster needs per-character masks.
- **Hop reads as a cat.** Redo it, or swap the starter for a stronger silhouette from the reserve.
- **Small size.** Full-body figures at 24 px are specks (my 24/40/64 px render). Discs need generated or cropped head art, as the plan says; Crane's visor is the weakest.
- **Rules disagree across documents.** Kandil is "your first full mock" in CHARACTER-WORLD but the weekly Mob quest prize in both designs; Stamp is 4 Mob weeks in the world and Live, 8 in Arena; the world says "no silhouettes to tease" while both designs (rightly) show the real silhouette in the parcel; Foil Hop has two different rules. Pick one table before any build.
- **Neither prototype uses the generated reveal art.** Both draw a flat envelope; the generated `REVEAL-unfold.webp` (a folded paper parcel with a light-filled silhouette) is better and on-brand.

**Recommendation:** style C for the app and the cast, B for marketing and any future merch, A shelved. Before generating the 55 poses: fix the palette collisions, redo Hop, settle the earn table, and test the visor-expression overlay. Then generate idle and cheer first.

## 8. Cost to build in Flutter

Neither design needs Rive or Lottie for build 1. Everything is the app's own animation layer (implicit and explicit animations with the existing springs), `CustomPainter` (ruler, lanes, stitch thread with `PathMetric`, ticks, particles capped at 60), still images moved as puppets (rise, hop, squash, nod, breathe) and one fragment shader for the podium foil (Impeller only, with a gradient mask for low-end phones). Lottie would be a mistake: vector animation next to 3D paper raster is the same seam as Live's flat envelope.

| Piece | Size | Notes |
|---|---|---|
| Den stage with scene art, figures, tags, pennant, shelf; enter animation | M | One controller per den; each figure on its own `RepaintBoundary`; idle breathing stops 10 s after the last touch |
| Cast as files: idle and cheer, head crops, silhouettes | S | About 1.4 MB in the bundle, the rest downloaded the first time the Mob opens |
| Visor blink and expression overlay | S | One visor-coloured rect per eye from `folds.json`; this is what keeps us off Rive |
| Chains screens and Mob quest | M | Server: chain ledger and rest-pass ledger (additive migration) |
| Play picker Free and Pro, Free and Pro sheet | S | Entitlements exist |
| Async ghost race (ruler with full figures, graft from Live) | M | Data already stored (`mob_sittings.detail.t`) |
| Podium reveal | M to L | `Matrix4.rotationX` unfold, particles, one shader, count-up from the place below |
| Week stitched, quest seal, milestone | S each | Painters plus image seal |
| Parcel reveal | M | Build from 3 generated stills (sealed, seal popping, open) plus code light: an image sequence is not needed |
| Shelf, create, join (6-character code), Mob of one, WhatsApp card | S each | Code migration from 8 to 6 characters keeps old codes working |
| Sound, about 15 clips | M | New audio package and a silent-mode check; needs his nod |
| Live room: ready up, server-clock countdown, live lanes, friend finished | L | Supabase Realtime private channels, presence and broadcast carrying only member id, state and question index; reconnect within 60 s; the one large risk |

First async build (den, chains, quest, picker, ghost race, podium, reveal, shelf, create and join) is roughly three to four weeks for one engineer who knows the motion layer, plus the server ledgers. Live is a separate L after it. Rive is worth it later only for Mobi and the reveal if the still puppets with a visor blink feel dead on a real phone. Nothing here has run on the emulator; the den with four or five large rasters and idle loops must be checked on the low-RAM emulator before anyone calls it smooth.

## 9. What to build: Den Arena, with these grafts

From **Den Live**:
1. The **ruler race** with full-body characters walking along it (his S7). Fix the overlap: when two friends share a number, stagger them in depth (one slightly behind and smaller) instead of overlapping. Keep Arena's lanes only if a fifth member makes the ruler unreadable, and test that.
2. The visible **Skip** pill on the podium.
3. The **"so far" podium** ("Riya is on top so far. One more can play until 8:02 PM tomorrow, so places can still change.").
4. **Fix it together** as the lamp-lit answer sheet with the struck-through pick and the Now-to-Wednesday path (only after the window closes).
5. The quiet den's honesty: "You're the first one here" and real times, but as a row of runs, not tags under people.
6. The **WhatsApp invite card** built on the generated group shot, and the Free picker that leads with "Open now".
7. The personal chain's "2/5" today link and "Friday was covered on its own".

From the **character work**: the generated `REVEAL-unfold.webp` parcel in place of both envelopes; the group shot for the invite and the shelf header.

Keep from **Arena**: the scene-art den, answers held until the room closes, tie handling, the true count-up, the needle and pennant moment, the stopwatch countdown (after the numeral fix), no price and no Pro status in the Mob, the join preview without names.

## 10. For the main session to put to him

1. Billing off: let anyone start games until billing is on (recommended by both, and by me).
2. Show your own right or wrong after each locked answer, with the correct option and the why held until the room closes.
3. Free may start a study room and receive "Pass the mic"; the first game of a new Mob is free to start.
4. Sound on by default inside games, with the switch in the lobby.
5. Style C for the cast, and the honest note that A, B and C are finishes of one look.
6. The Fold as the story name, with chain-milestone pages.
7. Quest size of 15 questions per member, to be tested with students.
