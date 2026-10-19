# Practice, Colleges and the daily goal: mock-ups for the owner's pick (19 Oct PM, H1, H6, H7, H9)

Status: **mock-ups only (R8). Nothing is built in Flutter.** He picks; then a single owner builds each surface (R7).
Images: `tmp/design-1019pm/practice/` (360 x 780 dp at 2x, Night and Day; `*_full_*` are the whole Practice page; `sbs_*` put build 9 beside each option, R4).
Sources: his words in `docs/brain/OWNER-FEEDBACK-2026-10-19.md` (3:05 pm), PLAN-1019-PM section C, build 9 at `ui/v15.3-1019` 4472b373 (read-only), real tokens from `flutter_app/lib/core/theme` (mm_colors, mm_type, tokens; Bricolage and Hanken font files; the app's own art).

## His words (verbatim)
- H6: "Ways to practice should be on top of Next Chapter or whatever you are showing on top. That's higher priority."
- H7: "Your paper and learn section should not be hidden as it is in this UI right now. It seems like something extra. It should have some proper implementation in the UI."
- H9: "Admission compass: okay, looks good, but where is that college section now? I am unable to find it in the app. It's really important, and there is no clear-cut access to it or understanding how to access it."
- H1: "10, 20, 30 minutes is fine, and it perfectly goes with the UI also, but tastefully. Only if somehow you could implement a customized option also ... If someone wants to attempt 2 mocks a day and they want to take 2 hours, then we should not be stopping them".
- H5: "the bottom navbar is just awesome ... it's perfect." The bar is not touched in any option.

## What build 9 shows today (the baseline for R4)
- **Practice, top to bottom:** header with Ask Mobi; "Practise in" subject tiles; the next-chapter card ("Mixed chapters", Start 10 questions); Your papers row (only while mistakes wait); Learn row (only while lessons are published); Ask Mobi card; **Ways to practise** (Quick practice, By chapter, Smart practice row, Exam conditions: Full mock, NTA mode); bank line; **More ways in** (Your papers when no mistakes wait, Review again, Mob paper, Question stream, Admission Compass); Learn shelf. The modes start about 1.5 screens down (`G15_practice-top_fresh_night.png`: "Ways to practise" sits under the dock).
- **Colleges** has no door on the first screen of any tab: Today's "Your colleges" block is the last block on Today (after Road to CUET), and You reaches it only through "Aim" near the bottom. The Colleges screen itself (with Admission Compass) is good and stays.
- **Onboarding step 6 of 7** ("Pick a pace you can keep."): 10, 20, 30 minute bubbles; study days slider. The app also clamps saved minutes to 10, 20 or 30 (`onboarding/model/answers.dart:284`) and so does the server plan (`src/lib/server/learning.js:55`), so a longer goal needs those two clamps changed.
- Screens missing from the walk shots: You's top in Night (only Day, `s4-you-day.png`), and onboarding in Day (the theme switch only exists after sign-in). Those pairs are Night-only or Day-only in `sbs_*`.

**A finding about H8.** H8 was dropped as a dictation garble, but "Question stream" is a real label on build 9 (Practice > More ways in, "Untimed. Answer, then see why.", `insights/copy.dart:174`). He was very likely reading it. Every option renames it to **"Untimed questions"** with "One question at a time, with the reason after each answer." This needs his nod, because it touches an item he dropped.

---

## 1. Practice (H6 + H7): three options

All three keep every feature on the page (R3); Smart practice and NTA mode stay visible with the quiet Pro tag and the calm locked sheet (D101); nothing new costs credits.

| | A. Same tiles, new order | B. Every mode in one glance (**recommended**) | C. Three doors |
|---|---|---|---|
| Images | `practice-a_{night,day}.png`, `practice-a_full_*` | `practice-b_*`, `practice-b_full_*` | `practice-c_*`, `practice-c_full_*`, `practice-c-papers-tab_*` |
| Order | subjects, Ways to practise (build 9 tiles unchanged), Your papers and Learn as a pair of cards, Up next, Ask Mobi, More ways in | subjects, Ways to practise as compact tiles (all 5 modes above the dock at 360 x 780), Your papers card with the last papers, Learn card with the next lesson, Up next, Ask Mobi, More ways in | a "Practise / Your papers (12) / Learn" switch under the title; Practise shows subjects, modes, Up next, Ask Mobi, More ways in; the other two doors show those screens in place |
| First screen | subjects plus Quick practice and By chapter | subjects plus all five modes | the switch, subjects, two modes |
| R4 risk | none (tiles identical) | the mode tiles shrink from about 164 to 108 dp, so the glyphs are smaller (the art is kept) | a new navigation layer inside a tab; Your papers and Learn become in-place views |
| Build size | small (reorder plus one pair widget) | medium (compact tile variant, two rich cards) | large (Review and Learn as embedded views, state per door) |

**Recommendation: B.** It is the only option where a student sees every way to practise without scrolling, which is H6 taken literally ("on top ... higher priority"). Your papers and Learn become real cards with real content (the last two papers with scores, the next lesson and why), not rows, which answers H7's "it seems like something extra". C is the boldest and makes the two sections true peers of Practise, but it adds a second layer of tabs under a bar he called perfect, and it costs the most. If he wants zero visual change to the tiles, pick A.

### R2 lines (Practice)
- A: "Pick a subject and one of the ways to practise; my papers and a lesson are just below." Clear in 3 s: yes.
- B: "Pick a subject and tap a way to practise; under that are my papers and my next lesson." Clear in 3 s: yes.
- C: "This is my practice place; the switch shows my papers or lessons." Clear in 3 s: yes, but a first-timer may not notice the switch holds whole screens.

### Exact copy (R6), option B
- Section titles: "Practise in", "Ways to practise", "Exam conditions", "Up next in Accountancy", "More ways in".
- Tiles: "Quick practice / 5 to 20 questions"; "By chapter / Up to 12 chapters"; "Full mock / 50 questions, timed"; "NTA mode / Exam-day screen" with "Pro"; "Smart practice / Aims at the chapters you miss." with "Pro".
- Bank line (unchanged): "No fixed set of mocks. Each paper is built fresh from the 105 questions in Accountancy."
- Your papers card: title "Your papers", link "See all"; with papers: "2 papers so far, every answer kept. 12 mistakes are waiting to be repaired."; rows "Accountancy / Mixed chapters, today, 12:34 PM / 3 of 10 right"; key "Repair 12 mistakes". With no mistakes, the key is "See all your papers". Fresh account, no papers: "Every paper you sit is kept here, newest first, with its answers." and no key (the card stays; R3).
- Learn card: "Learn / Short lessons, picked from where your marks slip."; inset "Next lesson, about 6 minutes / Issue of shares at a premium / You lost marks on this in today's Accountancy paper."; keys "Open the lesson" and "All lessons". The lesson, its length and its reason come from `practicePanel(...)` (`learn.title`, `learn.pick.reason`). When the catalog is off or empty, the card is not drawn (build 9's rule: never a "not available" row). The lesson in the image is illustrative.
- More ways in: "Untimed questions / One question at a time, with the reason after each answer." (needs his nod, see H8 above); "Admission Compass / Which DU courses your subjects open, with the 2026 Round 1 cutoffs." The Mob paper and Review again rows stay where they are, under their present rules.

### Build spec, option B
- `features/practice/practice_screen.dart`: new sliver order: header, `SubjectTiles`, the "Ways to practise" block, `PracticePapersCard`, `PracticeLearnCard`, the "Up next" heading plus `SuggestionHero`, `AskMobiCard`, `PracticeMoreRows`, `ConceptsShelf`. Keep the `MmStaggerItem` indexes in the new order (one entrance, no new motion).
- `features/practice/widgets/mode_list.dart` and the tile widgets: add a `compact` variant: 108 dp tall, glyph 34 dp, title `cardTitle`, one line `caption` at 13.5; Smart practice as a full-width row tile (about 64 dp) under the exam pair. Pro tag and locked-sheet tap unchanged (D101). Check at text scale 1.3 and 1.6: the tile grows in height; titles never truncate.
- `features/practice/widgets/top_rows.dart`: `PracticeTopRows` becomes the two cards. `YourPapersRow.showsAtTop` is no longer needed (the card is always present); the counts come from the same `openRepairsProvider` and the papers list (the same numbers as Today's tile and the bar badge). The last two papers come from the Review data the Your papers screen already reads.
- `features/practice/widgets/more_rows.dart`: drop `_PapersHereWhenQuiet` (Your papers now has its card); keep Review again, the Mob row, the stream row (renamed) and Admission Compass.
- `features/insights/copy.dart:174-175, 200`: the rename, if he agrees.
- States: loading (keep the reserved card heights, skeleton after 400 ms as today), papers failed to load (the card says "Your papers could not load. Pull down to try again." and keeps the See all link), offline (show the cached counts).
- Motion: press scale 0.97 at 100 ms on tiles and cards (as today). No new loops.
- Tests: update the Practice order golden (fresh and heavy, 360, Night and Day), a widget test that all five mode tiles are inside the first 780 dp at text 1.0, and that a Free student's NTA and Smart taps still open the locked sheet.

---

## 2. Colleges (H9): three ways in, one recommended pair

| | A. Colleges card at the top of You (**recommended**) | B. "Your colleges" strip on Today (**recommended, with A**) | C. Colleges as the first tab on You |
|---|---|---|---|
| Images | `colleges-a-you-card_*` | `colleges-b-today-strip_*` | `colleges-c-you-first-tab_*` |
| What it is | a card under the name: top 3 colleges with the 2026 Round 1 cutoffs; keys "See all 5" (opens Colleges) and "Admission Compass" | one glass strip right under Today's greeting: "Your colleges / 5 picked. SRCC needed 924.3." It opens Colleges | "Colleges" first in You's chip row, showing all 5 and an Admission Compass row |
| Always visible? | first screen of You | first screen of Today | first screen of You, but only while that chip is chosen |

**Recommendation: A plus B.** A gives Colleges a permanent home where a student looks for "my things"; B keeps the goal in sight every day without moving Today's approved blocks (the existing "Your colleges" block at the bottom of Today stays). Both open the same Colleges screen, where Admission Compass already sits. C competes with the Week view he approved, so it is the fallback. "Aim" in You stays (R3); it is no longer the only way in.

### R2 lines
- A: "These are my colleges and the marks they needed; tap to see all of them or the Compass." Yes.
- B: "My colleges are one tap away; the top one needed 924.3." Yes.
- C: "My colleges are listed here." Yes, once the chip is chosen.

### Exact copy
- A: "Your colleges" / "5 colleges for B.Com (Hons). Each number is the lowest score that got in, 2026 Round 1." / rows with "of 1000" / keys "See all 5", "Admission Compass". No colleges yet: "Pick the colleges you want, and see the score each one needed last year." key "Pick colleges".
- B: "Your colleges" / "5 picked. SRCC needed 924.3." Uses the college that needs the most (the same rule as Today's block, G7). No colleges yet: "Pick your colleges / See the score each one needed last year." With a typed range (G18): "5 picked. 1 is safe and 3 are in reach." (the same sentence the estimate sheet prints).

### Build spec (A + B)
- `features/you/you_hub_screen.dart` (and `you/hub/hub_sections.dart`): insert `YouCollegesCard` after the name block, before the chip row. Data: the same provider `today/widgets/colleges_card.dart` reads (`CollegesCardInfo`), so the numbers match Today and the Colleges screen. Keys push `AppRoutes.colleges` and `AppRoutes.toolsCompass`. Names wrap; they never truncate.
- `features/today/screens/today_body.dart`: insert `TodayCollegesStrip` between the header and the hero card. 56 to 64 dp, glass surface like the header pill, one tap target. Keep the bottom "Your colleges" block.
- States: loading reserves the height; failed shows "Your colleges" with "Tap to open your list." (it still opens Colleges); no picks shows the empty copy above.
- Motion: none new; the strip joins Today's existing first-paint stagger as item 1 (the hero becomes 2).
- Tests: a golden for You top and Today top (fresh with 5 colleges and fresh with none, 360, Night and Day); a test that both doors push `/colleges` and Back returns to the tab.

---

## 3. Daily goal (H1): two options, plus where it changes later

Both keep 10, 20 and 30 exactly as they are. The label changes from "Each session" to **"Each study day"** because 1 or 2 hours reads as a day, not a session. Nothing is capped.

| | A. A fourth bubble, "More" (**recommended**) | B. A row for longer days |
|---|---|---|
| Images | `goal-a-step6_*` (default), `goal-a-more-sheet_*` (the sheet), `goal-a-step6-1hour_*` (after the pick) | `goal-b-step6-1hour_*` |
| How | a fourth bubble with a plus, "more". It opens a sheet: "1 hour, time for one full mock a day", "2 hours, two full mocks", "Your own" with minus and plus in 15-minute steps. After the pick, the bubble shows "1h" / "a mock a day" (or "2h", "1h 30"), filled volt | under the bubbles: "Or a longer day" with three chips, "1 hour / one full mock", "2 hours / two full mocks", "Your own / any length" |
| Fits his "tastefully" | yes: the row looks the same at a glance; the bigger choice is one tap away | visible to everyone, but it adds a second row of choices to a step he said already looks big |

**Recommendation: A.** He said the step "is bigger" and that 10/20/30 "perfectly goes with the UI". A keeps that row intact and makes "more" a fourth member of the same family; B shows more on screen to every student, which crowds the step.

**Smart-layer slot.** The one Mobi line under the bubbles is the slot (in A it replaces "Full mocks are in Practice whenever you want one."). In onboarding there is no history, so the line is fixed by the choice: 10 to 30 min: "Full mocks are in Practice whenever you want one. Tap More for an hour or longer."; 1 hour: "One hour fits a full mock, timed like the exam. You can change this any time in You."; 2 hours: "Two hours fits two full mocks. A short break between them helps."; 4 hours or more: "That is a long day. Short breaks keep it working." (a note, never a cap). After sign-in the other agent's smart layer owns this line (dashed slot in `goal-change-later-you_*`); its example in the image ("You usually practise about 40 minutes, mostly after 9 PM ...") is a placeholder and must only appear when the data says it.

**Where he changes it later.** You's "Weekly goal" row becomes **"Your goal"**, showing "1 hour a day, 4 days a week". It opens the goal sheet (`goal-change-later-you_*`): "Your daily goal / Today and your week strip count toward this.", the same four bubbles, the smart-layer slot, the study days stepper, and "Save my goal". The Rhythm page's goal entry opens the same sheet.

### R2 lines
- Step 6 (A): "Pick how long I study each day, or tap More for longer; then how many days." Yes.
- More sheet: "Choose 1 hour, 2 hours or my own length." Yes.
- Step 6 (B): "Pick a short time or a longer day, then days." Yes, but more to read.
- Goal sheet: "Change my daily time and days; Mobi suggests one from my record." Yes.

### Build spec (A)
- `features/onboarding/steps/rhythm_step.dart` `_MinuteBubbles`: 4 bubbles at 64 dp (they fit at 360 dp: 4 x 64 plus gaps); the fourth is `more` (hollow with a plus) or the chosen long value (filled). Haptic selection as today. The sheet is a new `GoalMoreSheet` (standard sheet, 32 dp top radius).
- `features/onboarding/model/answers.dart:284`: accept any multiple of 15 from 10 up (10, 20, 30 stay legal); keep 20 as the fallback only for non-numbers. `choices_copy.dart`: "Each study day", the four slot lines above, and `sessionsLine` already handles any minutes ("About 90 hours of practice before May").
- `features/you/hub/hub_cards.dart` `StudyDaysPanel` and `features/you/goal/goal_screen.dart`: the row and the sheet above.
- Server: `src/lib/server/learning.js:55` clamps the plan to 10/20/30. Keep the plan's guided session at 30 at most and treat anything longer as "a guided session plus a full mock" (1 hour) or "two full mocks" (2 hours), so the plan never invents a 2-hour lesson. The minutes also stay on the phone today (`sheet_sync.dart:60`: "worry and minutes have no endpoint"); the smart layer will need them on the server. That is a web change and a column: ask him before any production write.
- States: the sheet's minus key is disabled at 15 minutes with the reason in its label ("15 minutes is the shortest"); no upper limit.
- Motion: the bubble fill uses the existing ink-spread fill (Bubble with `inkOrigin`); the sheet uses the app's standard sheet rise. No new animation.
- Tests: goldens of step 6 at 360 x 640 and 360 x 800 (the short screen must not overlap Continue), with 20 chosen and with 1 hour chosen; a unit test that 60, 90 and 120 survive a save and reload.

---

## Not verified
- These are HTML mock-ups with the real tokens, fonts and art, not Flutter renders: the glass blur, grain and glyphs are close, not exact. The glyphs are redrawn, not the app's painters.
- Content is from the walk accounts (B.Com (Hons), SRCC 924.3 and the others from G7); the Learn lesson, the paper times and the smart-layer line are illustrative.
- Build 9 "before" shots are from the v15.3 acceptance walk (build 8/9); build 9's commits did not change the order of Practice, You or step 6, but copy may differ slightly.
- Nothing was walked on the emulator; no text-scale 1.3/1.6 renders were made of the options.
