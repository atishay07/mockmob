# The Folds: launch kit for Instagram and WhatsApp (20 Oct 2026)

For whoever posts for MockMob. The owner said the characters can drive social media (D129: give them a story that can carry marketing). Everything here uses art that already exists. Nothing new is generated.

Sources of truth, newest first:
- **Earn rules and shelf lines:** `src/lib/mob/folds.mjs` and `src/lib/mob/v3/denCopy.mjs` on live main. If this kit and the app ever disagree, the app wins, and this kit gets fixed.
- **Lore:** `docs/design-decisions/pass-1019pm/mob-v3/CHARACTER-WORLD.md`.
- **Motion:** `MOB-BUILD-SPEC-V3.md` section 5.6 (M7 is the podium, M9 is the reveal).
- **Safety for minors:** `MOB-BUILD-SPEC-V3.md` section 6.
- **Art:** `tmp/design-1019pm/mob-v3/characters/final/` (`FINAL-ART.md`), web copies in `public/mob/folds` and `public/mob/art`, and Mobi in `flutter_app/assets/art/mobi-*.webp`.

Voice for every line below: plain, kind and a little dry. No exclamation marks, no emoji, no hype words. Every claim must be something the app really does today. We laugh with the habit, never at the student.

---

## 1. The story (one paragraph)

There is one long strip of paper, and every mock on MockMob is cut from it. That is why the mocks never run out. Every mistake you make leaves a crease in that paper, and a crease left alone hardens into a trap: the same kind of question catches you again next week. But when you find the mistake, fix it, and the fix holds when it is checked again later, the crease smooths out and something small unfolds from it. They are called the Folds. Each one remembers the habit it came from, like rushing, second-guessing or losing marks to minus ones, and each one is still a little bit like that. That is why you will recognise yourself, and your friends, in them. Mobi was the first. He unfolded from the very first mistake anyone ever fixed, so he is the eldest. He knows every bend of the paper, and he is the one who shows you the way.

**Short lines for posts and bios:**
- "Every mistake you fix leaves something behind."
- "Meet the Folds. Each one was a mistake once."
- "Which Fold are you?"
- "Nobody can buy a Fold."

---

## 2. The cast: one profile line each

The CUET facts behind these lines, at the current pattern: +5 for a right answer, -1 for a wrong one, 0 for a skip, and 50 questions in 60 minutes (72 seconds a question). If NTA changes the pattern for 2027, update Dart and Tally first.

The "Earned by" column is word for word what the app's shelf says (`FOLD_RULES`). The "Folds" count is what the card corner shows: 1 means a starter, free to everyone; 2 means earned by you; 3 means earned with your Mob.

| Fold | What it is | The CUET habit | Profile line (for posts and bios) | Earned by | Folds | Best art to post |
|---|---|---|---|---|---|---|
| **Mobi** | lime folded diamond with an antenna | Knows where your marks slip and what to fix first. | "The eldest. Unfolded from the very first fixed mistake, and has been showing people the way ever since." | Never collected. He is always there. | none | `mobi-greet`, `mobi-point`, `mobi-cheer` |
| **Dart** | sky-blue paper plane with a stopwatch | Rushing. Answers first and reads the question second. | "Answers first, then learns to check. CUET gives you about 72 seconds a question. Dart is learning to use more than 20 of them." | Free to everyone. | 1 | idle (stopwatch), cheer |
| **Dog-ear** | blush notebook page, one corner flopped over an eye, pencil | Second-guessing. Changes B to C to B because the clock got loud. | "Learning to trust the first pick, and to change an answer only when it finds a real reason." | Free to everyone. | 1 | idle, think |
| **Hexa** | indigo paper box holding a little cube | Skipping steps in Maths and losing the sign on line three. | "Builds each answer step by step. One line at a time, and the sign stays where it was put." | Free to everyone. | 1 | cheer, idle |
| **Kandil** | amber paper lantern with a teal book | Showing up for revision on ordinary days, not only before a test. | "Keeps the desk lit for everyone. Shows up for revision on an ordinary Tuesday, which is the whole trick." | Free to everyone. | 1 | idle, cheer (both awake) |
| **Hop** | teal origami frog with a pink eraser | Letting one wrong answer spoil the next five. | "Bounces back after a wrong one. A minus one on question 12 stays on question 12." | Your Mob finishes its first weekly quest. | 3 | cheer, idle |
| **Crane** | violet origami crane with a paintbrush | Walking past the same trap question every week. | "Folds it until it is right. The question your Mob keeps missing is the one it goes back for." | Your Mob fixes 3 traps together. | 3 | idle, think |
| **Stamp** | cream postage stamp with a tick and an envelope | Calling a topic done before it has been checked again. | "Seals every fix that held. Nothing is done until it is right again on a later check." | Your Mob's chain reaches 4 weeks in a row. | 3 | cheer, idle |
| **Naav** | newsprint paper boat with an oar | Panicking in the last ten minutes. | "Steady in the last ten minutes. The clock gets louder and Naav keeps rowing." | Finish your first full-length mock. | 2 | idle (oar), cheer |
| **Tally** | coral receipt with a calculator | Not counting the minus marks. | "Counts the minus marks too. Knows a right answer pays 5 and a wrong one costs 1, and decides with both in mind." | Finish 3 Mob games with no minus marks. | 2 | think, idle |
| **Patang** | slim crimson kite with a spool and a bowed tail | Giving up on a subject after one bad mock. | "Rises against the wind. Its only rival is its own last score." | Beat your own best score in a subject's full mock. | 2 | idle, cheer |
| **Sticky** | sage sticky note with a paper clip | Relearning the same formula every week. | "Remembers the formula for you. Five fixes that held, and the formula stopped being a guess." | 5 fixes that held. | 2 | idle, think |
| **Cutting** | kraft-paper chai cup with a biscuit | Feeling it is over after a few days away. | "Knows a break is part of the plan. Three days away is a break, not the end of anything." | Come back after 3 or more days away. | 2 | idle (the wink), cheer |

---

## 3. Ten captions (Instagram and WhatsApp)

Each one says which art to pair it with. Hashtags: at most three per post (for example `#CUET2027 #CUETUG`), and none on WhatsApp. Alt text for every image: the Fold's name, what it is and its pose, for example "Dart, a sky-blue paper plane with a stopwatch, standing ready."

1. **Launch** (Instagram carousel; WhatsApp Status). *Art:* group of 12 idles on the Night ground (from `sheets/cut-idle-charcoal`, rebuilt at 1080 from the masters), then one Fold per slide.
   > Every mistake you fix leaves something behind. Meet the Folds: twelve of them, plus Mobi, the eldest. Each one was a mistake once, until somebody fixed it and checked that the fix held. Which one are you?

2. **Dart** (Instagram post). *Art:* Dart idle, holding the stopwatch.
   > Dart answers first and reads the question second. CUET gives you about 72 seconds a question, and Dart uses 20. It is learning to check. Send this to your Dart.

3. **Dog-ear** (Instagram post; WhatsApp Status). *Art:* Dog-ear think.
   > B. No, C. Actually B. Dog-ear is learning one rule: change an answer when you find a reason, not when the clock gets loud.

4. **Tally** (Instagram carousel: the receipt, then the rule). *Art:* Tally think, with the calculator.
   > Plus 5 for right. Minus 1 for wrong. Zero for a skip. Tally reads the whole receipt before it answers. Finish 3 Mob games with no minus marks, and Tally unfolds on your shelf.

5. **Nobody can buy a Fold** (Instagram post; good as a pinned post). *Art:* the shelf screen from the app, or the 12 idles on the Day ground.
   > You can't buy a Fold. Not with Pro and not with credits. Every one is earned by something you actually did, and the rule is written on the shelf before you start. Free and Pro get exactly the same twelve.

6. **Hop and the Mob** (Instagram reel cover; WhatsApp group forward). *Art:* the parcel stills, then Hop cheer.
   > Hop doesn't come alone. When your Mob finishes its first weekly quest, everyone in it gets Hop at the same moment. Up to five of you, one quest a week, and nobody can break it alone.

7. **Cutting** (WhatsApp Status; Instagram Story). *Art:* Cutting idle, the wink.
   > Three days away is not the end of anything. Come back, and Cutting unfolds. A break is part of the plan.

8. **Naav** (Instagram post). *Art:* Naav idle, with the oar.
   > The last ten minutes are where marks go quiet. Naav stays steady to the end. Finish your first full-length mock, and yours unfolds.

9. **Patang** (Instagram post). *Art:* Patang idle.
   > Patang rises against the wind. Beat your own best score in a subject's full mock, and it unfolds. The only score it is racing is your last one.

10. **The paper never runs out** (Instagram post; landing tie-in). *Art:* Mobi point, on the Night ground.
    > Every mock on MockMob is cut from one long strip of paper. That is why you can sit as many as you want: they all come from one central bank, and the paper never runs out. Mobi knows every bend of it.

---

## 4. Five reels (8 to 15 seconds)

**How to make them:** record the real moments, never a mock-up.
- **Where to record:** the app's demo mode (`test/device_demo/demo_main.dart` on the emulator, which needs no sign-in) or the web Mob on the staging rig (3105, with the seeded `chai-*` test students).
- **What the footage may show:** demo or test names only. Never a real student, a real Mob or real marks.
- **Recording settings:** record at 60 fps. Export at 1080 × 1920. Keep the text out of the top 250 px and the bottom 400 px, where Instagram puts its own buttons.
- **Sound:** paper foley we record ourselves (a sheet folding, a seal popping, a lamp switch). No licensed or trending music with lyrics.
- **End card (every reel):** the wordmark, the line "Every mistake you fix leaves something behind.", and mockmob.in.

### Reel 1: The Unfold (10 s). The reveal, M9.
| Time | Shot | On-screen text |
|---|---|---|
| 0.0-1.2 | Close on the sealed parcel (`parcel-sealed`) in the lamp pool. It pulls back and wobbles twice. | "You fixed a mistake." |
| 1.2-2.4 | Warm light leaks from the seam, and the seal pops (`parcel-pop`). | "And the fix held." |
| 2.4-4.5 | The flaps open (`parcel-open`), and the Fold rises out of the parcel. Paper bits settle. | none |
| 4.5-7.0 | The Fold does its pose. The name engraves, then the line rises (for example, "Sticky. Remembers the formula for you."). | the app's own text |
| 7.0-10.0 | End card. | "Every mistake you fix leaves something behind." |

Make one version per Fold, so the series runs 12 posts. Never add rays, a sunburst, rarity colours or "rare drop" text.

### Reel 2: So far (12 s). The podium, M7.
| Time | Shot | On-screen text |
|---|---|---|
| 0.0-1.5 | The den. Five Folds stand in the lamp pool. | "Five friends. One paper." |
| 1.5-3.0 | The scrim falls and the lamp narrows. The collective line and the floor members appear together. | the app's collective line |
| 3.0-6.5 | Third, second and first place unfold. Each Fold drops and lands, and the marks roll up in true order. | none |
| 6.5-8.5 | First place: the foil sheen sweeps the plinth and the winner hops once. Hold on the "so far" label. | "It says 'so far' until everyone has played." |
| 8.5-12.0 | End card. | "Play papers with your friends. Marks only, never answers." |

Use a game that has already closed, so no answer of an open game is ever on screen.

### Reel 3: Which Fold are you? (15 s)
| Time | Shot | On-screen text |
|---|---|---|
| 0.0-1.0 | The Night ground, empty. | "Which Fold are you?" |
| 1.0-13.0 | Twelve hard cuts of 1 s each. Each idle springs in (a squash and stretch from the boots, done in the editor) and holds. | the name and its habit in four words: "Dart: answers too fast." "Dog-ear: changes it back." "Tally: counts the minus." "Cutting: needs a break." and so on |
| 13.0-15.0 | The 12 heads in a row, with Mobi in the middle. | "Send this to your Mob." |

The habit words must stay affectionate. Use "answers too fast", never "careless".

### Reel 4: Dart vs 72 seconds (9 s)
| Time | Shot | On-screen text |
|---|---|---|
| 0.0-2.0 | Dart idle, with the stopwatch in close-up. | "CUET: about 72 seconds a question." |
| 2.0-4.0 | A cut to Dart think. | "Dart: 20." |
| 4.0-6.5 | The app's real question screen with an option locked in (M4). Dart nods. | "Read it twice. Then lock in." |
| 6.5-9.0 | Dart cheer, then the end card. | none |

### Reel 5: A mistake, fixed (14 s). The product, end to end.
| Time | Shot | On-screen text |
|---|---|---|
| 0.0-2.5 | A wrong answer in a real paper, with the calm "Not this one" (the Fold tilts; it never looks sad). | "One mistake." |
| 2.5-5.5 | Score Recovery shows where the mark slipped, and the fix plays. | "Found. Fixed." |
| 5.5-8.0 | A later check: the same idea, answered right. | "Checked again. It held." |
| 8.0-11.5 | The reveal: the parcel opens and Sticky climbs out. | "Five fixes that held. Sticky unfolds." |
| 11.5-14.0 | End card. | none |

Shots 0.0-8.0 compress days of real use. The text has to say "later", so the reel never implies one fix unlocks Sticky.

---

## 5. WhatsApp sticker pack plan

**A preview is built from the existing art** (composited only, nothing generated):
- the 24 stickers are in `tmp/marketing-1020/stickers/`, at 19 to 30 KB each;
- the tray icon is `tray-mobi@96.png`, at 12 KB;
- on WhatsApp's dark and light chat grounds: `tmp/marketing-1020/sticker-pack-preview-dark.png` and `-light.png`;
- the script is reproducible: `tmp/marketing-1020/stickers.py` (crop the 1024 master, fit inside a 16 px margin, add a 10 px cream die-cut border with a soft shadow, and add a paper word slip tilted 3 degrees).

**Why the border matters:** the Folds' mittens and boots are charcoal and disappear on WhatsApp's dark chat background. The cream die-cut edge fixes that, and it reads as paper, which is the brand. This was checked on both grounds at chat size.

**Format (WhatsApp's sticker rules as published; recheck before export):**
- 512 × 512 WebP with a transparent background and a 16 px margin;
- a static sticker at most 100 KB; 3 to 30 stickers per pack;
- a tray icon of 96 × 96 PNG, at most 50 KB.

### Pack 1: "The Folds" (24 stickers, ready from today's art)
| # | Sticker | Word slip |
|---|---|---|
| 1 | Dart cheer | Let's go |
| 2 | Stamp cheer | Nice one |
| 3 | Hop think | So close |
| 4 | Sticky think | Teach me |
| 5 | Patang cheer | Again? |
| 6 | Kandil cheer | Good luck |
| 7 | Cutting idle (the wink) | One sec |
| 8 | Naav idle (oar) | Ready |
| 9-20 | Dart idle, Dog-ear idle, Hexa cheer, Kandil idle, Hop cheer, Crane idle, Stamp idle, Naav cheer, Tally think, Patang idle, Sticky idle, Cutting cheer | none |
| 21-23 | Mobi greet, Mobi point, Mobi cheer | none |
| 24 | The lime stamp seal with its tick | none ("done", without words) |

**How the words were chosen:** the eight are exactly the app's own sticker words (`STICKERS` in `denCopy.mjs`). A student who sends "So close" in WhatsApp sees the same words inside their Mob.

**Poses left out on purpose:**
- Patang think (its eyes picked up pupil notches);
- Crane cheer (the neck drifts into the old hat look);
- `mobi-sleepy` and `mobi-rest` (late-night framing; see section 6).

### Pack 2: "Not this one" (after shrug and wave are generated, FINAL-ART section 6)
Pack 2 has 24 stickers:
- 12 shrugs, with a slip on four of them: "Not this one", "Next one", "Fine", "Moving on";
- 12 waves, with a slip on four of them: "Hi", "Bye", "Back soon", "Here".

The shrug is calm and never sad (spec 5.2).

### Animated stickers (later)
Make them from the stills, with no new art. Use the same squash, breathe and blink the app does: the boot-pivot squash, plus a 120 ms visor blink drawn from the eye boxes in `folds.json`.

Animated WebP must stay under WhatsApp's limit for animated stickers (500 KB, at most 10 s). Start with three: Dart's lean-in, Hop's hop and the parcel opening.

### How it reaches students (the owner decides)
1. **First, no build needed:** send the pack to the beta testers' WhatsApp group as stickers through any sticker-maker app. Once one person has them, anyone can save a forwarded sticker to their favourites.
2. **Later:** an "Add to WhatsApp" button on the shelf in the Android app. This is WhatsApp's documented sticker-pack intent with a content provider, a small app feature, and it is not built yet.

---

## 6. What NOT to post

**Truth**
1. Never claim numbers we cannot show: no "thousands of students", "#1 CUET app", "boost your score by X", "guaranteed", rank promises, or NTA endorsement. Never post a testimonial, review or follower count that is not real.
2. Never use blanket exam advice that the maths does not support:
   - "Never guess" is wrong at +5/-1. A blind guess among four options is worth +0.5 marks on average, and more once you rule an option out. Tally's message is to know the price, not to never guess.
   - "Always trust your first instinct" is wrong too. Changing an answer for a real reason helps more often than it hurts. Dog-ear's message is to change it for a reason.
3. Never post anything the student cannot use yet:
   - The web Mob is live. The app's version 13 is in closed testing.
   - Shrug and wave do not exist yet.
   - The graph paper, glow ink and pencil-sketch finishes are not built (only Plain and Foil are).
   - Do not push "join with a code" links until the public `/join/<code>` page knows Mob v3 (a known leftover).
4. Never say a Fold can be lost, decays, dies or expires. Owned Folds are kept for good, even after leaving a Mob.

**Money and loot boxes**

5. Never put a price in a Fold post, and never say or imply that Pro or credits unlock a Fold. The truth: Free and Pro get the same twelve, and nothing in the Mob is for sale.
6. No loot-box idioms: no rays, no sunburst, no rarity colours, no "rare", "legendary", "mystery box", "drop", "collect them all", "limited time" or countdowns. The surprise is the look and the line, never whether you get something.

**Students (they are 16 and 17)**

7. Never mock a student, a habit or a result: no "Dart energy is why you failed", no "tag your dumb friend", and no ranking shame. The habit is the joke, never the person.
8. Never show a real student's name, face, photo, marks, Mob name, invite code or chat. Use demo or test data only, and never present demo marks as a real result.
9. No late-night or burnout framing: no "3 am grind", "all-nighter", "night owl", "up late", "midnight" or "burn the midnight oil". Do not use `mobi-sleepy` or `mobi-rest`. Kandil is awake, and Kandil "keeps the desk lit for everyone", never "for late nights".
10. No streak guilt: no "don't break your streak", "you missed 3 days" or "your Mob is waiting on you". Cutting's whole point is that a break is fine.
11. Never show who did not play, or a count of who got a question wrong. The Mob shows runs so far and "most of you", never "3 of 4".

**Art and brand**

12. No new AI-generated Folds, and no off-model art:
    - `characters/GROUP-mob-with-mobi.webp` is from before the final pass. Its green Fold is the old spiky draft, and its Kandil has sleepy lids. Do not post it until it is redone from the final idles.
    - `REVEAL-unfold.webp` shows a blank, nameless Fold. Use it only as a teaser of the reveal, never as a character.
    - Never stretch, recolour, upscale a 256 file or put a pupil in a visor. Post from the 1024 masters or the 512 files only.
13. No festival or religious tie-ins for Kandil or Patang (Diwali lanterns, the Sankranti kite) unless the owner decides it. The lore keeps them as plain shapes so they belong to everyone.
14. Do not borrow another brand's look or words: no "our Genmoji", no Labubu or Smiski comparisons, and no Apple-style glossy renders.
15. No emoji, no exclamation marks, no walls of hashtags (at most three) and no "unlock your potential" AI voice.

---

## 7. Launch order (two weeks, one post a day; reels go out on the days that feature the Mob)

| Day | Post |
|---|---|
| 1 | Caption 1 (Launch) and Reel 3 |
| 2-5 | The starters: Dart (caption 2 and Reel 4), Dog-ear (3), Hexa, Kandil. Captions for Hexa and Kandil come from their profile lines in section 2. |
| 6 | Caption 5 (Nobody can buy a Fold), pinned |
| 7 | Reel 1 (the Unfold) with Hop, and caption 6. The sticker pack goes to the testers' group. |
| 8-11 | Tally (4), Naav (8), Patang (9), Cutting (7) |
| 12 | Reel 2 (So far) |
| 13 | Reel 5 (A mistake, fixed) with Sticky |
| 14 | Caption 10 (The paper never runs out) and Crane and Stamp as "earned with your Mob" |

**Check before every post:**
- Is every claim true in the app today?
- Would a 17-year-old forward it to a friend without feeling mocked?
- Does it pass every item in section 6?
- Is the art from the final set?

## 8. Open for the owner
1. **The pronoun for the Folds.** The app says "him" for Hop in one line (`revealFact`) and "it" for the others. This kit uses "it" for every Fold and "he" for Mobi. Pick one.
2. **Festival posts** for Kandil and Patang: yes or no (section 6, item 13).
3. **The sticker route:** a sticker-maker app for the testers first, then an "Add to WhatsApp" button in the app.
4. **Hinglish versions** of the captions for WhatsApp: the kit is English-only until he says so.
