# Today richer (D52), suggested cards (D51) and the 5/10/20 question (D50): app, pass 1018

**Status:** mock-up only. **His yes comes before any build** (owner rule: refine, never rebuild; mock-up first). No app code was changed (`lib/` untouched).

**Owner items:** D52, D51 and D50, from his words on v15 79aaca6d at about 12:15 pm on 18 Oct (`docs/brain/OWNER-FEEDBACK-2026-10-18-DAWN.md`, last section).

**Mock files:** `tmp/design-1018/v15-feedback/`
- `today.html`: the refined Today.
- `suggested.html`: the card stack. Add `?state=rest|right|left|end`.
- `compare.html`: Today from v8 to v15.
- `?theme=night|day` works on all three.

The mocks use the app's real tokens: the `mm_colors.dart` palette, the `mm_type.dart` roles with the bundled Bricolage and Hanken fonts, the 24 / 18 / 12 radii, and the accountancy light field. They also use the real art (`obj-*`, Mobi poses). The data is illustrative, and every frame says so.

**Captures** (`tmp/design-1018/v15-feedback/shots/`):
- Headless Chrome through playwright-core, with its own temp profile.
- 390 x 844 at 2x, in Night and Day.
- Every image was opened and looked at.

---

## D52. Today: what made the earlier versions feel cooler and fuller

He said: "up to Road to CUET is fine. But something better and more can be done, like for the weeks after ... I remember the homepage UI to be a lot better than what it is right now in the previous versions."

**Sources compared:**
- The Today goldens at each release commit in `wt-v15` history: v5 34046de9, v8 b0a61496, v10 9ccb7d0c (v10.1 fd3fca29 is pixel-identical), v12 f5d848bf, v13 e0939ad2 and v15 79aaca6d. They are extracted to `tmp/design-1018/v15-feedback/history/`.
- The emulator walks in `tmp/app-walk-1018` and `tmp/app-walk-1018b`.
- TODAY-1017, TODAY-NIGHT-1017 and TODAY-1018.

The board is `shots/d52-compare-versions.png`.

### What the earlier Today had, and where it went

| # | Element (v8 to v12) | Why it felt good | Fate | Now |
|---|---|---|---|---|
| 1 | **Mobi in the header**, top right, greeting pose | The app had a character on its home screen | Removed in v13 (fd5c353c "header without Mobi") | Gone. Mobi shows only on day one, in the card's art box |
| 2 | **Recent papers: a marks trend line** (last 6 mocks, newest point lit "204") and 4 paper rows with change arrows (+33 on Mock 6) | The one picture of progress; it moves after every paper | Left Today in v13 (672f9ce3: "recent papers ... leave Today"); now in Review History | Gone from Today. Only "Last paper" with one bar remains |
| 3 | **Road to May as a real timeline**: the big "28 weeks", a month axis Oct to May, a Now marker, a "15 weeks" ruler, Registration and Boards bands, a lime CUET UG flag, then a dated list (CUET registration, "Next", in 15 weeks; Class 12 boards; CUET UG) | It showed the weeks ahead at a glance, with real dates | v12 made it week columns; v13 a 13 px dot grid; N1 (17 Oct, 11 pm) called the strip "very confusing and very cluttered", so it became a text readout | Road to CUET is three text rows. The future is one sentence: "Next, in 15 weeks: registration ..." |
| 4 | **Hero as a moment**: the subject as a display headline ("Accountancy", Bricolage Headline), the giant 4, a lime edge light and a soft glow under the card | The first card felt like an event, not a form | The edge light went with "Night stays subtle" (TODAY-NIGHT-1017). The subject headline became the overline "Up next, Accountancy" in TODAY-1018 | He says this part is fine; kept as is |
| 5 | **Week chain at the top**: linked dots, a lime-tab "T" for today, a Counted/Planned/Rest legend, "1 of 4 study days / 3 more by Sunday" | Instant status before anything else | Moved under the card in v13 | Kept as This week (he says fine) |
| 6 | **"Your road" tiles** (v10): Expected exam date "1 May"; Full mocks taken "7", with an edit pencil | Two big, editable facts | Folded into Change plan | Covered by Road to CUET |
| 7 | **The length as a tactile segmented control** in the card (5 / 10 / 15 min, v5 to v8) | You could feel the choice | Became a pill in v10 | Pill (fine) |

**What v15 added (keep all of it):** Road to CUET with due today, this week and the goal; the two choices; Weak chapters; the Last paper bar; Repairs and Revise; Play it back; Ask Mobi.

**What makes v15 feel basic:**
- After the hero, almost everything is a text row at one or two sizes.
- There is no picture of progress (no trend).
- There is no picture of the future (no timeline).
- Mobi is absent.
- Weak chapters repeat the same "Practise" pill on every row (slop list item 3).
- The page is longer than v10 (3000 px against 1900 at 412 wide) but carries fewer visuals.

### The refined Today (mock: `shots/d52-today-*`)

Everything down to Road to CUET stays exactly as v15 (TODAY-1018). The one addition up there is Mobi back in the header. After Road to CUET, in order:

1. **Mobi back in the header** (46 dp, greeting pose, top right). Tap = Ask Mobi.
   - It never covers the greeting: the title keeps one line at 360 dp with the 46 dp Mobi (checked at 390; the build checks at 360 and 1.3x text).
   - Restores element 1.
2. **NEW: The weeks ahead.** A vertical timeline, in v10's dated-list form, which he never criticised. It is deliberately not a strip to decode (N1).
   - **Next week, 19 to 25 Oct:** "4 study days and Mock 8". Under it, the planned weekdays as chips, with the mock day filled, and the stopwatch object as a thumbnail.
   - **Week of 26 Oct:** "4 study days, 23 back in Revise" (from the Revise due dates).
   - **Week of 2 Nov:** "4 study days and Mock 9".
   - **"Then, at this pace":**
     - Mock 11, half your goal (early Dec);
     - registration expected to open (Mon 1 Feb, in 15 weeks);
     - Class 12 boards (mid-Feb to early Apr, the plan goes lighter, 2 study days a week);
     - **CUET UG, Sat 1 May**, with a lime pill: "27 weeks, 94 study days and 14 more full mocks between now and then".
   - A week row opens that week's plan (the Change plan sheet, scoped to the week).
   - This answers "the weeks after" with real dates and counts. Every figure comes from the plan, the Revise schedule and the expected dates already used by Road to CUET.
3. **Your marks**, v10's trend line, merged with Last paper so no block is added.
   - The last 6 full mocks in the move's subject, the newest point lit, and a dashed 200 reference.
   - The line under it: "204 on Mock 7, your best of six. +33 on Mock 6."
   - Then the v15 Last paper block, unchanged.
   - Restores element 2.
4. **Weak chapters as ordered bars.** Each row shows marks open, "15 of 63 missed" and a bar sized to the marks; the top bar is in the warning colour, the rest neutral.
   - The whole row is the tap target: it opens the chapter's mistakes and a 10-question set.
   - The three identical "Practise" pills go.
5. Repairs and Revise, then Your colleges: unchanged.

**Hold:**
- The hero's lime edge light stays off ("Night stays subtle").
- No glow is added, and no gradient beyond the app's existing lamp wash and subject light field.

**Motion (for the build):**
- The timeline's nodes draw top to bottom once on first open: 40 ms stagger, 220 ms ease-out, opacity plus 6 px.
- The trend line draws once, 600 ms, when it scrolls into view; the newest point pops from 0.95.
- Reduced motion: everything is in place at once.
- No loops.

**Data truth:**
- **Sparse cases:**
  - With fewer than 2 full mocks, Your marks shows only Last paper.
  - With no plan, The weeks ahead shows the milestones only.
  - Weeks with no planned days say "Rest week".
- **Figures and wording:**
  - A planned mock is "suggested", never promised.
  - Dates keep the word "expected".

### Recommendation (D52)
Build items 1-4. They give back the three things that made v8 to v12 feel alive (Mobi, a picture of progress, a picture of the future) without touching the part he approved, and without the decoded strip he rejected in N1.

The build is about 2 h for one Flutter agent (Opus for the timeline and chart, Sonnet for the rest), with goldens at 360 and 412, Night and Day, and 1.3x text, then an emulator walk.

---

## D51. "Suggested for you": a swipe card stack in place of the two choices and More ways to practise

He said: "What if we add something like suggested cards, and again slide left or right to continue them. Something like Tinder ... I'm not sure, I'm giving some random ideas."

### The design (mock: `shots/d51-stack-*`)

- **Where:**
  - The hero ends at its credit line. Its split footer (two choices) and "More ways to practise" leave the card.
  - A "Suggested for you" block follows, outside the card, so no card sits inside a card.
- **The stack:**
  - One card is on top. Two sit behind it at 0.95 and 0.90 scale, peeking 12 and 22 px below.
  - Top right of the block: "3 more after this", plus page dots.
  - Card order:
    1. Practise your weakest chapter;
    2. Revise what is due;
    3. Repair a mistake (another subject);
    4. A full mock.
  - The order comes from the same `pickChoices` ranking used today.
- **Each card:**
  - what it costs ("Free, about 10 min" / "Accountancy, 10 questions");
  - a title;
  - one line of evidence ("15 of 63 missed, 75 marks open");
  - the subject object or a Mobi pose;
  - two real buttons, **Skip** and **Do this instead**.
- **Gestures:**
  - **Right** (past 30% of the width or a fling): a "Do this instead" stamp, and on release the card **flies into the lead card above**. The lead card swaps live, as a tap does today, and the old move sits in the deck with "Suggested" on it.
  - **Left:** a "Skip" stamp, and the card goes to the back.
  - Tap = right.
  - The hint line "Swipe right to do it instead, left to skip" shows the first two times only.
  - Haptics: a selection tick at the threshold.
  - The card follows the finger with rotation of x/20 degrees. A spring returns it below the threshold. Horizontal drags lock after 12 px, so vertical scrolling still works.
- **End:** a dashed end card with thinking Mobi: "That was all four for tonight", with "Go through them again" and "see every way to practise" (the alternatives sheet).
- **Deliberate change from his words:** right swipe does **not** start a session. It makes the card the lead, and the lime key then starts it.
  - Why: repairs and AI moves spend credits ("Each repair uses 1 AI credit").
  - A swipe is easy to trigger by accident while scrolling, so it should never spend anything.
  - The key keeps the single primary action on the screen.
  - The start is still one tap away.

### Honest verdict: does it beat the current row?

| | Current row (two choices + More ways) | Card stack |
|---|---|---|
| Shows at once | 2 alternatives plus a link | 1, plus a count |
| Comparing options | Easy: side by side | Harder: one at a time |
| Room per option | About 170 px wide, the line truncates at 360 dp ("Practise your weakest" wraps to 4 lines, see `d52-today-fold1-*`) | Full width: a title, evidence and art fit |
| Delight / "unique" (D27, D56) | Plain | High: a physical object that answers the finger, in the app's object-world |
| Discoverability | Obvious | Needs the hint; the buttons make it work without gestures |
| Risk | None | Gesture conflicts with scroll (solved by the lock), and accidental actions (solved by "right = lead, not start") |
| Length of Today | Same | About 30 px longer (the stack sits outside the card) |

**Verdict:** it beats the row on room, evidence per option and feel, which is what he asked for when he called the app "basic" (D56). It loses on side-by-side comparison. That loss is small here, because the lead card already holds the recommended move and the deck is "what else". With the two safeguards (real buttons; right means "make it the lead", not "start"), it is better than the current row.

### Recommendation (D51)
Build it after his yes, with both safeguards.

If he prefers comparison over feel, the fallback is the current row with full-width cards in a horizontal scroll. The mock does not show that fallback; ask before drawing it.

The build is about 1.5 h for one Opus agent (gesture physics and taste), plus goldens for rest, right, left and end, plus an emulator walk for scroll-versus-swipe on a real touch screen.

---

## D50. The 5 / 10 / 20 question

His words: "in how many questions? 5, 10, 20 only. No direction until you do a full mock."

### Where 5 / 10 / 20 is offered (only one place)
The **Today lead card's length pill**, on practice moves. On day one that is "Find your starting point". It also covers a stale record ("Practise to refresh"), a thin record ("Check this skill") and "Practise another skill".

The pill reads "about 10 min". Tapping it opens a panel:
- The panel title is `TodayCopy.practiceLength = 'How many questions?'` (`flutter_app/lib/features/today/copy.dart:173`).
- Its rows are "5 questions", "10 questions" and "20 questions" (`TodayCopy.lengthWords`, `copy.dart:110`).
- The choices come from `final List<int> practiceChoices = [for (final c in const [5, 10, 20]) if (practiceCounts.contains(c)) c];` (`flutter_app/lib/features/today/logic/move_builder.dart:31`).
- The panel is drawn in `features/today/widgets/length_pill.dart` and opened from `move_hero.dart:201` and `:330`.

**For comparison:**
- Practice's own Quick setup offers 5, 10, 15 and 20 (`practiceCounts`, `features/practice/model/practice_selection.dart:54`). So Today drops 15, and neither offers a full paper.
- The full mock exists on Today only as a separate choice: "Full mock instead", "50 questions, 60 min" (`copy_glance.dart` `choiceMock`, `choiceMockLine`), and in "More ways to practise".

**The day-one card copy** (`copy.dart:58`): "Ten CUET-style Accountancy questions, marked +5 and −1. The result shows where your marks go, chapter by chapter."

### Copy that says direction comes only after a paper
No string says "after a full mock" word for word. The closest strings:
- `GlanceCopy.weakDayOne` (`copy_glance.dart:229`): "Your weak chapters show here after your first paper: where the marks go, chapter by chapter."
- `TodayCopy.sparseOne` (`copy.dart:635`): "From your one paper so far, {source} on {date}. A full mock gives a fuller picture."
- `TodayCopy.thinLine` (`copy.dart:158`): "From one paper. Ten more questions sharpen this."
- Repairs and Revise on day one: "Wrong answers wait here, so each one gets a repair." and "Repaired questions come back here on their day." (`copy_glance.dart:264-265`, the empty tiles).
- Road to CUET on day one: "Overall goal, 0 of 14 full mocks".

### The precise question to ask him
"On Today's first card, 'How many questions?' offers only 5, 10 or 20. Did you mean:
- (a) add a full mock (50 questions) to that list;
- (b) add 15, so it matches Practice;
- (c) the plan and weak chapters say nothing useful until a paper is done, and you want direction from day one?"

**CTO lean, if he says "you judge":** (a) plus (c-lite).
- (a): the panel gains a fourth row, "Full mock, 50 questions, 60 min". It costs nothing to build and keeps the full mock one tap away.
- (c-lite): day one's Weak chapters line names the syllabus chapters with the most marks at stake, from the paper blueprint, until the first paper lands.

---

## Checks run, and what they prove
- **Rendered:** 16 captures (D52 fold 1, the weeks ahead, marks, and the full page; D51 rest, right, left and end), each in Night and Day, plus the version board. Each image was opened.
- **Fixes made after looking at the captures:**
  - a page overflow;
  - the greeting wrapping beside Mobi;
  - the volt marks on cream in Day: graphic marks now use a darker olive (#6E8A00) in Day, the lime stays on keys and pills;
  - neutral weak-chapter bars;
  - one mock count corrected ("half your goal" lands in early December, not January).
- **Slop list:** no nested cards; one lime key per screen; no glow added; no ALL-CAPS; no arrows in text; no middle dots; sentence case; 12-hour times; every count has its denominator.
- **What this does not prove:** real-device scrolling against swiping, 360 dp at 1.3x text, and performance. Those are build and emulator checks.

## Capture index (`tmp/design-1018/v15-feedback/shots/`)
- `d52-compare-versions.png`: v8, v10, v12, v13 and v15 side by side, with what arrived and what left.
- `d52-today-fold1-{night,day}.png`: the first screen. Mobi is back; the rest is unchanged v15.
- `d52-today-weeks-ahead-{night,day}.png`: the new timeline.
- `d52-today-marks-{night,day}.png`: the trend plus Last paper, and the Weak chapters bars.
- `d52-today-full-{night,day}.png`: the whole refined page (without the bar).
- `d51-stack-rest-{night,day}.png`: the stack at rest.
- `d51-stack-right-{night,day}.png`: mid-swipe right ("Do this instead").
- `d51-stack-left-{night,day}.png`: mid-swipe left ("Skip").
- `d51-stack-end-{night,day}.png`: the end of the deck.

## Questions for the owner (one each, with a recommendation)
1. **D52:** build The weeks ahead, Your marks and the Weak chapters bars after Road to CUET, with Mobi back in the header? **Recommend yes.**
2. **D51:** replace the two choices and "More ways to practise" with the Suggested card stack, where right means "make it the lead" (not "start")? **Recommend yes.**
3. **D50:** which did you mean: (a) a full mock in "How many questions?", (b) add 15, or (c) direction before the first paper? **Recommend (a) plus a light (c).**
