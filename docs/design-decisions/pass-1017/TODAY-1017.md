# Today, website and app: one answer at a glance (pass 1017)

Status: **decided for the build round; owner sign-off pending** (section 13). Design only. No product code was changed. The mocks are static HTML at `tmp/design-1017/today/today.html`, and every capture listed in section 14 was opened and checked.

Owner items: **F14** (Today), with **F16** (keep what works, never cut), **F18** (students did not know what to do with the features), **F5** (controls must look pressable), **F11** (the sleeping Mobi confused him), **F2** (where Colleges lives), and the 16 Oct items **L01 to L07** and **L22**. This builds on `app-today-1016.md`, whose state ladder (S1 to S11), road rail, tuners and study-days sheet are already in v12. This document keeps all of them and changes what Today shows **first**, and where the rest lives.

Read for this pass:
- `docs/brain/OWNER-FEEDBACK-2026-10-17.md` (F1 to F18)
- `docs/brain/APP-OWNER-LEDGER-2026-10-16.md` (L01 to L39)
- `docs/design-decisions/app-ia-1016.md` and `app-today-1016.md`
- `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (cited as R1 to R40) and `papers/ai-slop-independent.md` (the 12-part test, the 0/1/2 rubric, and its CUET example)
- the evidence index (T001 to T009, S010 to S018)
- the owner memory notes: design direction, feedback 1017, unlimited mocks, web restructure rejected, research brain
- the skills: ui-ux-standards (its section 10 slop list wins every conflict), impeccable, frontend-design, emil-design-eng, high-end-visual-design, design-taste-frontend, redesign-existing-projects

The Continuum tools failed in this session (`brain.py start` returned an error), so the files above were read directly.

---

## 1. The problem, in the owner's words

- **F14 (17 Oct, website):** "This today section I never really liked: very cluttered, very confusing."
- **F18 (17 Oct):** "Even last year, students were confused, and they didn't use 90% of the features because they didn't actually know what they were to do with this."
- **F11 (17 Oct, result screen, the same disease):** "A student must see at once what happened and what to do next." On the sleeping Mobi: "feels a bit weird to me and is very confusing."
- **F5 (17 Oct):** cards that "feel like cards depicting information rather than buttons that I click."
- **F16 and the 15 Oct verdict:** "Never simplify by cutting features." Clarity comes from guidance, folding and moving, never from deleting.
- **L05 (13, 15 and 16 Oct):** the Road to May should be "interactive, editable", adjustable "directly in the scrolling ... in the timeline". It is on the keep list for this pass.
- **L07 (15 Oct):** the road sat too low.
- **L22 (15 and 16 Oct):** Compass and the colleges must not be "tucked inside a corner".

The task, restated: Today answers one question at a glance, **"what do I do now, and why"**, with one volt next move. Under it sit:
- the week (study days, "3 of 4");
- the Road to May as an editable strip;
- one colleges line.

Everything else is folded or moved to its home, and nothing is deleted.

## 2. What exists now

### 2.1 Captures of the current state (opened)

| What | File (under `tmp/design-1017/today/current/`) |
|---|---|
| Web Today, ready fixture, 390 Night and Day (full page) | `web-today-ready-390-night.png`, `web-today-ready-390-day.png` |
| Web Today, ready, 1440 Night and Day | `web-today-ready-1440-night.png`, `web-today-ready-1440-day.png` |
| Web Today, empty (day one), 390 Night | `web-today-empty-390-night.png` |
| App v12 on the emulator tonight: top, road, tuners | `app-walk-v12-today-top.png`, `app-walk-v12-today-road.png`, `app-walk-v12-today-tuners.png` (copied from `tmp/app-walk-1017/1A/`) |
| App goldens from the UX pass: ready full page, day one, returning (Night and Day) | `app-golden-today_*.png` (from `wt-appux2/flutter_app/test/golden/today/goldens/`) |

The web captures come from the preview fixture `/preview/arena?view=today`, served on port 3101 by the staging server. That server runs a build older than `wt-batch4b`: it has no Compass line, no first-timed-mock prompt and no Mob card. Those three blocks are inventoried from code below.

### 2.2 Website Today, block by block (`wt-batch4b` = live main; `wt-webux2` = the motion pass)

Page: `src/app/(app)/today/page.jsx`. The order is the order on screen.

| # | Block | File | What it says (ready fixture) |
|---|---|---|---|
| W1 | Page head: headline plus the date and a lede | `src/components/arena/ArenaHead.jsx` | "Preview, here is your next step." "Saturday, 17 October. Planned from your own practice record, one step at a time." |
| W2 | Plan card (hero) | `src/components/LearningNextAction.jsx`, styles `.na__*` in `src/app/(app)/arena.css` | Contents: a diagnosis headline ("Partnership Fundamentals is where most marks are open."); a "Tonight's plan" time segmented control (10/20/30 min, with the selected segment **volt-filled**); a why aside (subject object, "30 marks these misses were worth", a detail sentence, "See your full record"); "10 questions, about 10 minutes."; a **volt** "Start 10 practice questions"; links "Review your mistakes" and "Choose another subject"; a Mobi hello row inside the card ("Good morning. Tonight's plan is set from your last sessions.") |
| W3 | First timed mock prompt (live main only) | `src/components/timed/FirstTimedMock.jsx`, `useFirstTimedMock.js` | One line and a key, for students with sessions but no timed mock |
| W4 | This week | `src/components/RhythmCard.jsx` (compact) | A ring "3 of 4 days", seven day circles, "Today, Sat 17, counted", "See your weeks and milestones" |
| W5 | Mob card (webux2, behind `MOB_ENABLED`) | `src/components/mob/MobTodayCard.jsx` | The ring, "Your Mob", one key |
| W6 | Admission Compass line (live main only) | `src/components/du/TodayCompass.jsx` | "Admission Compass", the first of My colleges, an Open key |
| W7 | My colleges | `src/components/colleges/MyColleges.jsx` (`TodayColleges`) | 3 ranked rows of college plus course, "2 more on My colleges", Edit |
| W8 | Record glimpse | `src/components/ai/RecordGlimpse.jsx` | "Changing answers has been about even ..." and "Your last 6 Accountancy full mocks" (a line chart of 6 marks) |
| W9 | Install prompt | `src/components/InstallPractice.jsx` | "Keep practice close." Add to home screen |

Mobi moments on the web come from `src/lib/mobiScreens.js` and `mobiRation.js`: the first visit of the day, the week goal met, and a time chosen.

`/dashboard` is the Practice and Start menu. It shows no Today blocks: `LearningNextAction` and `RhythmCard` are used only on Today, Progress, Analytics and the recovery overview. The Start menu is a separate decision (F4 to F8, F12).

### 2.3 App Today, block by block (v12 = `wt-owner/flutter_app`; the UX pass = `wt-appux2/flutter_app`)

Layout: `lib/features/today/screens/today_body.dart` (lines 552 to 625).

| # | Block | Files (`lib/features/today/`) | What it says (golden `today_ready_full_night`, walk `upg-02-today`) |
|---|---|---|---|
| A1 | Header: avatar, date, greeting, header Mobi, status line | `widgets/today_header.dart`, `header_mobi.dart`, `copy.dart` (greeting) | "Saturday, 17 October", "Good evening, Asha". On the test account at 12:16 AM it read "Up late, app-e2e-student": the name field fell back to a handle |
| A2 | Week ledger | `widgets/week_ledger.dart`, `week_ledger_skeleton.dart` | "1 of 4 study days", "3 more by Sunday", a 7-day rail |
| A3 | Hero: tonight's move | `widgets/move_hero.dart`, `hero_stage.dart`, `number_block.dart`, `move_keys.dart`, `length_pill.dart`, `mobi_moment.dart`; states in `sealed_hero.dart`, `resume_hero.dart`, `today_skeleton.dart`; logic in `logic/move_builder.dart` | Contents: overline, subject, object or Mobi with a speech bubble ("Still up? One short move, then sleep." with a sleeping "z"), "4 to repair tonight", a why line with red dots and "Show me", a **volt** "Start repair", a "15 min" length pill, "Choose something else" |
| A4 | Also slots | `widgets/also_slots.dart` | A second open thing or another sealed result, one row each |
| A5 | Lead-in pill | `MoreBelowCue` in `today_body.dart` | "Road to May, 28 weeks" |
| A6 | Your record card | `InsightsCard` (Review area) through `today_routes.dart` | "Financial Markets is where the most marks are open", a second diagnosis that differs from the hero's "Planning" |
| A7 | Weekly ending | `screens/weekly_ending_page.dart`, `widgets/today_celebration.dart` | The week's close |
| A8 | The road to May | `widgets/road_section.dart`, `road_rail.dart`, `road_tuners.dart`, `road_board.dart` (sheets), `road_timeline.dart` (still present) | Contents: the lead figure "28 weeks to the expected CUET window, May 2027"; "98 study days at 4 a week, 2 in boards weeks."; the readout "This week: 1 of 4 study days done, 28 weeks to go"; the rail with a road Mobi; jump chips; the receipt; a pace strip with a **volt** selected stop; "Change days"; a mock ruler; "7 taken. Suggested: 14." |
| A9 | Mob card (appux2) | `today_routes.dart` (`roadFooter: MobTodayCard`) | Under the road, only while the student is in a Mob |
| A10 | Recent papers | `widgets/sheet_section.dart`, `paper_trend.dart` | A trend chart, then "Mock 7 ... 204 of 250, +33 on Mock 6" and 3 more rows |
| A11 | Your colleges | `widgets/colleges_card.dart` | A cutoff bar from 700 to 1000, then SRCC 924.3, Hindu 919.9 and Deshbandhu 763, each "of 1000", "Round 1 minimum, 2026, unreserved" |

The bar (6 slots, with a **volt** Start key) belongs to the shell, not to Today.

### 2.4 Why it reads as cluttered: the diagnosis

Counted on the captures above:

1. **Too many answers.** App Today answers six questions: what now, this week, May, my record, my papers, my colleges. Web Today answers six too: what now, this week, my Mob, my colleges, my record findings, my trend. R8 (rank by what helps the next decision) is not applied; every block has equal standing.
2. **The same fact, said several times.** On the app, "this week" appears four times: the ledger "1 of 4", the readout "1 of 4 study days done", the rail's This week column, and the pace strip's selected 4. The diagnosis appears twice, and the two disagree: the hero says Planning, the record card says Financial Markets. On the web, the diagnosis appears twice: the headline and the why aside.
3. **Settings shown as content.** The app opens the pace strip, the mock ruler, the jump chips and the receipt in full on the home screen. That makes Today read like a settings panel (S014: progressive disclosure is for secondary functions, and these are adjusted weekly at most).
4. **More than one volt per viewport.** App: the Start key, the bar's Start key, the volt pace pill, the volt flag and volt pips. Web: the volt time segment beside the volt Start key, plus the sidebar's volt "Start a session" at 1440. The owner's rule is one volt primary action per viewport.
5. **Mobi without a moment.** The sleeping Mobi with "Still up?" plays on every late visit. On the web, a hello row lives inside the plan card. The owner called the sleeping Mobi confusing (F11).
6. **Copy that explains the system** instead of the step ("Planned from your own practice record, one step at a time"; "Every miss waits in Review with its explanation"). Day one on the web also offers "Review your mistakes" when there are none.
7. **Information that looks like buttons and buttons that look like information.** The web "Review your mistakes" and "Choose another subject" are underlined text under a card; "Choose something else" is plain text. This is F5's complaint, on Today.

What works and is kept (F16): the app hero's composition (monumental number, lamp-lit object, one volt key), the 3D subject objects, the road rail and its drag-to-set date, the week dots, the state ladder S1 to S11, and the colleges data.

## 3. The decision

**Today becomes one move and one glance.**

1. **The move.** One card. It says what to do now (the subject, a big number with its meaning), says why from the student's own record in one sentence with its source, and offers one volt key. Two pressable secondary pills sit under it: **Change length** and **Something else**. Every other way into practice lives behind Something else, in the existing alternatives sheet.
2. **The glance.** One vertical group with no cards, separated by space and hairlines, reading as the student's position:
   - **This week:** "3 of 4 study days", seven day marks, and one line that ties the week to the move ("Tonight makes 4.").
   - **Road to May:** a strip with the whole road from this week to the exam visible at once. The CUET flag is draggable, and a week is tappable. Two value tokens ("4 a week", "14 full mocks") each open their tuner in place.
   - **Last paper:** one row that opens the paper.
   - **Your colleges:** one row with the first college and its 2026 Round 1 cutoff, which opens Colleges.
3. **Everything else moves to its home or folds into one of the above** (section 7 ledger). Nothing is deleted.

The layout differs by width:
- **At 412 and 390:** the move fills the first screen, and the week and the road's heading are visible above the bar.
- **At 1440:** the whole page fits in 900 px. The move and the two record rows are on the left (7 of 12 columns); the week and the road are on the right.

### Why (evidence)

- **One question, one primary action.** R7, and the research brain's own CUET example: "One current exam state, a clear last-result diagnosis, a single next-best-move recommendation grounded in actual attempt history, why it was suggested, and a direct entry to the recommended practice" (`papers/ai-slop-independent.md`).
- **Rank by the next decision.** R8. The move first; then the facts that change tonight's decision: is tonight a study day (week), am I on pace (road), how did the last paper go, where am I aiming (colleges).
- **Progressive disclosure for secondary controls, not for frequent ones.** R10, S014. The tuners are adjusted rarely, so they fold behind their values. The move's key and the road's flag are used often and stay out.
- **Every recommendation shows its history and confidence.** The AGENT_RULES MockMob overlay and R24. The why sentence names the paper, its date and the chapter, and "See why" opens the existing why sheet. With thin data the move is the baseline ("10 questions to your starting point"), never a fake plan.
- **Cards only where grouping means something.** R33 and slop item 3. The move is the one card. The glance is rows on the ground.
- **Value before label, units and denominators.** R9 and R29: "3 of 4", "204 of 250", "924.3 of 1000".
- **No shame, no loss threats.** T005 and R22. The returning student sees "A new week. Tonight counts.", never "You missed 4 days".
- **Pressable affordance.** F5. Secondary actions are 44 px outlined pills with icons, not underlined text.
- **Feature adoption (F18).** Today teaches each feature at the moment it is the right move: Repair, Check it held, a full mock, NTA mode, Compass. The move names the feature in its key ("Start repair") and says why in one line. The alternatives sheet lists the other moves, each with its reason. Students learn the product one real step at a time, not from a wall of blocks.

### Alternatives considered

| Option | What | Verdict |
|---|---|---|
| A | Keep every block and add section tabs on Today (Tonight / Week / Road / Record) | Rejected. It hides the week and the road behind taps (R10) and adds a control row. That is navigation inside a tab. |
| B | A horizontal card carousel for the secondary blocks | Rejected. Equal-weight swipe cards are the "five equal tiles" anti-pattern (the slop paper's CUET weak example); content off-screen is unseen. |
| C | Cut Today to the move only, and move week and road to You | Rejected. The owner asked for the week and the road on Today and called cutting a regression (15 Oct). The road is on his keep list. |
| **D** | **One move, one glance group; the rest moved or folded with a named home** | **Chosen.** It answers the one question, keeps every feature reachable in one tap, and fits the first screen on phones and the whole page at 1440. |

## 4. Spec

### 4.1 Order and measurements

Phone (app 412 x 915; web 390 x 844). The gutter is 16 on both.

| # | Block | Gap above | Notes |
|---|---|---|---|
| 0 | Web only: top bar (logo, credits, avatar), 60 tall, sticky | 0 | Exists (arena top bar). The header avatar is not repeated on the web |
| 1 | Header: date line (13 / 500, ink3), greeting (26 / BricolageHeadline 600) | 12 | App: the 40 dp avatar on the left opens the account sheet (L16). **No header Mobi on Today** |
| 2 | The move card | 0 (header bottom padding 18) | Radius 28, padding 20 (28 at 1440), surface `raised`, 1 px `line`, a 1 px volt-tinted top edge (Night) or volt-edge (Day). Its height is constant per state family: ±24 between states |
| 3 | This week | 32 | Heading row: "This week" (19 / BricolageHeadline) on the left; the figure "3 of 4" (BricolageCondensed 30, with "of" at 19 in ink2) and "study days" (14, ink2) on the right. Day marks 26 dp, row 14 below. Caption 8 below |
| 4 | Road to May | 28 | Heading row: "Road to May" on the left; "28" (BricolageCondensed 30) plus "weeks to CUET UG" on the right. Strip 118 tall, 12 below. Tokens 12 below |
| 5 | Rows: Last paper, Your colleges | 28 | A hairline above and between rows. Rows are at least 76 tall with a 48 hit area at full width. Label 13 ink3, title 16 / 600, sub 13.5 ink2. The figure on the right is BricolageCondensed 28, with its denominator 12 ink3 under it. A chevron at the end |
| | Bottom padding | | Bar clearance (app `MmBarInsets`; web dock 74) plus 32 |

Web 1440 (the arena shell: a 240 sidebar, a 64 top bar):
- The content area is 48 px padded, max 1200.
- The header greeting is 34.
- The grid is `1.25fr 1fr` with a 48 gap:
  - left: the move card (object 136, number 136), then the rows, 24 below;
  - right: This week, then the Road to May.
- All above 900 px in every state.
- The sidebar's "Start a session" becomes the **outlined** variant on Today (volt 1.5 px border, ink text), so the move key is the viewport's one volt. This is a request to the dock and nav owner (section 9).

### 4.2 The move card

Anatomy, top to bottom:
1. **Overline** (14 / 500, ink2), then the **subject** (23 / BricolageHeadline 600).
   - Art box on the right: 104 (app and web phone) or 136 (1440), its top 6 above the overline's top, never clipped (`Clip.none`).
   - The art is the subject's 3D object, or Mobi on a Mobi moment (section 4.6).
2. **Number block:** the number in BricolageCondensed 112 (136 at 1440), bottom-aligned with a 1 to 2 line label (21 / BricolageHeadline, max width 180, or 320 at 1440). It sits 18 above the art's bottom, so the object and the number interlock without an empty band. The 1016 L02 band rule stays: 8 to 24 dp between stacked blocks.
3. **Why:** one sentence (15.5 / 1.5, ink2, max 46ch) with its source, plus one inline link (600, underlined) that opens `/today/why/:id` (app) or the record (web).
4. **Key:** volt, 56 tall, radius 28, full width.
   - The label is the action, with the length in the same key at weight 500 and 78% opacity: "Start repair  15 min".
   - Press: scale 0.97, 120 ms.
5. **Two pills:** 44 tall, 1 px `line2` on `raised2`, an icon plus a label, equal width with a 10 gap.
   - **Change length** opens the length chooser (app `length_pill.dart` panel; web: the 10/20/30 options move here).
   - **Something else** opens the alternatives sheet (`/today/alternatives`; on the web, a sheet built from `plan.alternatives`).
   - On day one the second pill reads **Full mock instead**.

States: the 1016 ladder S1 to S11 (`app-today-1016.md` 4.1) is kept unchanged. Visible differences:

| State | Overline | Number and label | Why | Key | Pills | Art |
|---|---|---|---|---|---|---|
| Day one (S11) | Your first move | 10 / questions to your starting point | "Ten CUET-style Accountancy questions, marked +5 and −1. The result shows where your marks go, chapter by chapter." | Start now, 10 min | Change length; Full mock instead | Mobi greet (no bubble) |
| Ready with mistakes (S5, S6) | Tonight's move | 4 / mistakes to repair | "All four are from Mock 7 on 11 Oct, in Partnership fundamentals." **See why** | Start repair, 15 min | Change length; Something else | The subject object |
| Sparse (1 paper, fewer than 3 mistakes) | Tonight's move | 2 / mistakes to repair | "From your one paper so far, Quick 10 on 15 Oct. A full mock gives a fuller picture." **See why** | Start repair, 10 min | Change length; Full mock instead | Object |
| Returning (7 or more days since the last session) | Pick up where you left off | 3 / mistakes to repair first | "Your last paper was Mock 7 on 9 Oct. Its 6 mistakes are still here; these 3 cost the most." **See all 6** | Start repair, 10 min | Change length; Something else | Mobi greet (the returning moment) |
| Resume (S3) and sealed (S4) | unchanged (`resume_hero.dart`, `sealed_hero.dart`) | | | Continue / Open | | |
| Tonight done | Tonight's move | 4 / of 4 repaired tonight | "Partnership fundamentals is clear for now. A check in 3 days shows whether the fixes held." | Practise more | Open the repair; Something else | Object |
| Loading (S1, S2) | Skeleton at the card's resting height (406 app, 470 at 1440), shown after 400 ms; after 8 s the line "Still loading. Your connection looks slow." with Try again (exists) | | | | | |
| Failed with nothing in hand (S9, S10) | (no overline) title "Tonight's move did not load" | (none) | The named cause, plus "Your papers and mistakes are safe; Review still opens them." Then "Tried again at 8:41 PM. Still not loading." (caption) | Try again | Practise anyway | Mobi `oops` once |
| Offline with a cache (S8) | as Ready | | "Needs a connection to start." above the key | disabled | as Ready | |

Rules:
- The returning state is new to the move builder. It takes priority over S5 when `daysSinceLastSession >= 7` and there are open mistakes, and it chooses the 3 most costly. With no mistakes it offers "10 questions to warm up".
- The sparse rule: fewer than 3 answered papers adds the confidence clause to the why. This is the AGENT_RULES overlay: say when data is thin.
- The web's 10/20/30 segmented control leaves the card face for **Change length**, with the same three choices and the same `PUT /api/study/preferences` save. The card shows the chosen length in the key.

### 4.3 This week

- **Marks:** seven circles of 26 dp, labels Mon to Sun (12 / 600, ink3; today in ink).
  - counted: volt fill with an ink tick
  - planned: a 1.5 px `line2` outline
  - rest day: dashed
  - today: a 1.5 px ink ring offset by 3
  - days before the account existed: a short dash, never a miss
- **Figure:** "3 of 4 study days". `goal` is the server goal (`/api/me/rhythm` on the web; `rhythmProvider` on the app). The figure never shows the goal alone (L06).
- **Caption** (14, ink2, the key clause in ink 600). The first match wins:

| Case | Caption |
|---|---|
| Today is planned and not yet counted, and it would meet the goal | `Mon, Tue and Thu counted. Tonight makes 4.` |
| Today is planned and not counted (otherwise) | `Mon and Tue counted. Tonight counts.` |
| Goal met | `Goal met: 4 of 4 study days. Anything more this week is extra.` plus Mobi `cheer` 52 dp to its left, **once per week** (the existing `weekCheerKey`) |
| A new week after an absence | `A new week. Tonight counts.` |
| Day one | `Your week starts tonight. Tonight counts.` |
| No goal | `Pick how many days a week you study.` with a token **Set days** |
| Rhythm not read | The row keeps its height with skeleton marks; on failure, `Study days did not load.` and **Try again** |
| Paused | `Paused until Sun 18 Oct.` |

- **Tap:** the whole row opens the week (`/today/week` in the app; `/progress#week` on the web). The weekly ending card becomes this row's state on Sunday night and Monday: `Last week: 4 of 4. See your week`. The weekly ending page is unchanged.

### 4.4 Road to May (the strip, editable)

The 1016 rail is kept as the **detail** view. Today shows the **whole road as one strip**: all weeks fit the width, so no sideways scroll is needed to see May.

**Strip geometry** (height 118; W = content width; N = weeks from this week's Monday to the exam week, inclusive; column width W / N, 13.1 at 380):

| Lane | y | Content |
|---|---|---|
| Flag | 0 to 26 | The CUET flag pill at the right: "CUET UG, 1 May" (or "Your date, 8 May"), 11.5 / 700. Night: ink fill and ground text. Day: ink fill. A 6-dot grip shows it can be dragged. A 2 px stem in `accent` runs down to the pips' baseline, centred on the exam column |
| Bands | 30 to 50 | The Registration tick (1.5 px `line2`, down to the pips) with its label right-aligned to the tick. The Boards band (4 px `line2` bar at y 47, label above it, left-aligned at its first week) |
| Pips | 56 to 98 | One column per week, pips 6 x 6 (radius 2) with a 2 gap, stacked from the bottom. Count = the planned days (2 in boards weeks). This week's counted pips are volt with a 1 px volt-edge. This week's column has a 1.5 px ink outline, radius 8 |
| Months | 102 to 118 | The month name centred under the first week starting in that month (11 / 600, ink3) |

**Value tokens** under the strip, as two lines:
- `98 study days at [4 a week ↕]`
- `[14 full mocks ↕] before your date, 7 taken` (day one: `, suggested`)

Each token is a 34 tall pressable chip: 1 px `line2` on `raised2`, radius 12, with an up-down glyph. It is a value you can change, and it looks like one (F5). The hit area is 44.

**Interaction** (all of it exists in v12 and is re-homed, nothing new is invented):

| Touch | Result |
|---|---|
| Drag the flag | Moves the exam date by days (the 1016 8.6 rules: snap to days, a magnet at 1 May, a haptic each week, the receipt "Your date: Sat 8 May. Saved." with "Use the expected date"). The strip's columns re-flow live, and "28 weeks" and "98 study days" roll |
| Tap the flag | Opens the date sheet (`showExamDateSheet`) |
| Tap a week column | Opens the detailed rail in place (it expands under the strip to the 48 dp columns of `road_rail.dart`, scrolled to that week, with the readout). A second tap on **Done** or on the strip folds it |
| Tap "4 a week" | Opens the pace tuner inline under the tokens (the 1016 `PaceStrip`, 7 stops). **The selected stop is an ink pill, not volt** (one-volt rule). Caption `Mon, Tue, Thu and Sat.` with **Change days** (opens the one study-days sheet, L06). It saves on release, exactly as 1016 8.7 (Saving, Saved, or springs back) |
| Tap "14 full mocks" | Opens the mock ruler inline (1016 8.8); "7 taken" opens the mocks sheet |
| Only one tuner is open at a time | Opening one closes the other |

**Phases:**
- Under 22 days to the date, the strip becomes days (one column per day, one pip each), per 1016 8.5.
- From 1 May (the window), the strip is replaced by the existing window stat.

**Late data:**
- The strip draws from the calendar at once.
- Pips fill when rhythm arrives, and the height never changes (L03).

### 4.5 Rows

**Last paper**
- Shows the most recent opened paper: `Mock 7, Accountancy`, sub `11 Oct, +33 on Mock 6`, figure `204 of 250`.
- A tap opens the result.
- Hidden when there is no paper. The row slot is below the fold on phones, so its absence never shifts anything above the fold.

**Your colleges**
- Shows the first of My colleges: `Shri Ram College of Commerce`, sub `B.Com (Hons), 2026 Round 1. 2 more saved.`, figure `924.3 of 1000`.
- A tap goes to the Colleges home (section 9).
- **No estimate and no chance** is shown here. The practice score and the DU score are different scales; Colleges owns that comparison (R29, slop item 13).
- Empty: `Pick up to 8 to see their 2026 cutoffs here` with a pill **Choose**. It opens the My colleges chooser over Today (exists, L25).
- Failed read: `Your colleges did not load.` with **Try again**.

### 4.6 Mobi on Today: at most one, at a real moment

| Moment | Where | Act |
|---|---|---|
| Day one (no papers) | The move card's art box | `greet` once per visit, then `idle` |
| Returning after 7 or more days | The move card's art box | `greet` once |
| Week goal met | The week caption, 52 dp | `cheer` once per week (`weekCheerKey`) |
| Failure S9 or S10 | The move card's art box | `oops` once per failure run; `loading` while Try again runs |
| Recovery to a move | (nothing new) | The card simply rises in |
| Mob ring complete (web, `mobRingAct`) | The week caption, as the goal-met slot, when no goal-met moment is showing | `cheer` once per Mob week |

Retired on Today:
- the header Mobi;
- the speech bubbles (the title carries the words);
- the late-night `sleepy` act and the "Still up?" line (F11 named the sleeping Mobi confusing);
- the daily web hello row;
- the road's walking Mobi. The rail's This week ring already says "you are here". The walk moves to the expanded rail only, when it is opened for the first time.

Exactly one Mobi can be in view at a time (L35).

### 4.7 Colour, type and theme

**Tokens:**
- App: `lib/core/theme/mm_colors.dart`. Night: ground #12110E, raised #1B1A16, ink #F4F0E6. Day: ground #F3EFE6, raised #FFFDF8, ink #17150F, accentText #526700.
- Web: `src/app/(app)/arena.css` (`--a-*`). Night: bg #0b100e, raised #131a16. Day: bg #f4f5f0, raised #fff, accent text #4f6400.
- Volt #D2F000, volt ink #0B1000.

**Volt on Today**, and only here:
- the move key (the one action fill);
- counted day marks and counted pips (data, small);
- the flag stem (Night volt, Day accent);
- the "+33" change figure as `accent` text.
- The bar's or dock's Start key is the glass variant with a volt glyph while Today is the root (request to the nav owner).

**Type:**
- BricolageCondensed 700 for the big figures;
- BricolageHeadline 600 for titles and headings;
- Hanken Grotesk 400 to 700 for body and labels;
- tabular numerals;
- sentence case, no all-caps eyebrows, no monospace labels.

**Day parity:**
- the flag is an ink pill;
- counted marks keep volt with a volt-edge ring;
- every text token is checked at 4.5:1 on `ground` and `raised` (`ink2` and `ink3` pass in both palettes above).

### 4.8 Motion

Purpose first (R31; emil): every movement answers an arrival or an action.

| Moment | What moves | Duration and curve | Reduced motion |
|---|---|---|---|
| Page entrance (first open per app run, or per web navigation) | Header fades; the card rises 12 and fades; then the glance rows rise 8 and fade, staggered 40 ms (at most 4) | Header 200 ms; card 320 ms; rows 240 ms; `cubic-bezier(0.23, 1, 0.32, 1)` (web `--ease-out`; app `Motion.out`) | A 120 ms fade, no rise, no stagger |
| Number lands | The big number counts up from the value remembered last time (`numberRoll`; web `useCountUpState` with a memory key) | 600 ms, ease-out | The final value |
| Skeleton to move, or failure to move | `MmOverlapSwitcher.rise` / the web cross-fade with a 2 px blur bridge | 240 ms | 120 ms fade |
| Key press | Scale 0.97 | 120 ms ease-out, release 160 ms | Unchanged (it is feedback, not travel) |
| Pills and tokens press | Scale 0.98, background to `raised2` plus 4% ink | 100 ms | Unchanged |
| Week mark counted (on return from a session) | The mark fills from the centre: scale 0.6 to 1 with opacity, and the tick draws | 220 ms ease-out, then the tick 160 ms | Fill appears at once |
| Week goal met | Mobi `cheer` (rig act) beside the caption | The rig's own timing, once per week | A static frame |
| Strip first in view | Columns grow from the baseline, staggered 8 ms left to right; the flag drops 6 and settles | 220 ms ease-out; flag `Springs.settle` (web: spring duration 0.45, bounce 0.15) | Appears at once |
| Flag drag | 1:1 with the finger; columns re-flow | Live; on release, settle with a spring | Drag still tracks; no settle |
| Token opens a tuner | Height 0fr to 1fr (web `grid-template-rows`; app `AnimatedSize`), content fades in 60 ms after | 240 ms ease-out / 160 ms | Instant open, 120 ms fade |
| Week column tap, rail expands | The strip column scales into the 48 dp rail column (shared element), the rail fades in | 300 ms `cubic-bezier(0.32, 0.72, 0, 1)` | Cross-fade 120 ms |
| Pace saved | The caption cross-fades to "Saved." | 200 ms | Same |

Nothing loops on Today except Mobi's rig idle breathing, which is off under reduced motion. No glow, no sheen.

Liquid-glass taste (F3) is confined to the bar and the sheets (the nav and glass decisions). Content on Today is never glass (slop item 9).

### 4.9 Accessibility

- **Order:** greeting, move (heading "Tonight's move: Accountancy, 4 mistakes to repair"), key, pills, week (one group with the label "This week, 3 of 4 study days; Monday counted, ..."), road (heading; then the strip as a group whose flag is a slider "Your exam date, 1 May 2027, 28 weeks away"; each week a button "Week of 9 Nov, 4 study days planned"), the tokens (buttons "Study days a week, 4" and "Full mocks before your date, 14, 7 taken"), then the rows (links).
- **Targets:** at least 44. The strip columns are narrower than 44 at 13 px, so tapping the strip anywhere opens the rail at the nearest week, and the rail has 48 dp columns. Screen readers get the 1016 rail semantics.
- **Text at 1.3x:** the number label wraps under the number, the art box keeps 104, and the tokens wrap to separate lines.
- **Colour is never alone:** counted marks have a tick; this week has an outline; bands have labels.

## 5. Copy (exact)

| Key | Text |
|---|---|
| Greeting | `Good morning, Asha` / `Good afternoon, Asha` / `Good evening, Asha`. 11 PM to 5 AM: `Good evening, Asha` (the "Up late" line retires). Returning after 7 or more days: `Welcome back, Asha`. With no first name, or a first name that is a handle (it contains a digit, `-`, `_`, `.`, or equals the email's local part): no name, `Good evening` |
| Date line | `Saturday, 17 October` |
| Web lede | Removed. The date sits on the line above the greeting, as on the app |
| Move overlines | `Tonight's move`, `Your first move`, `Pick up where you left off` |
| Move labels | `mistakes to repair`, `mistakes to repair first`, `questions to your starting point`, `of 4 repaired tonight` |
| Pills | `Change length`, `Something else`, `Full mock instead`, `Open the repair`, `Practise anyway` |
| Why links | `See why`, `See all 6` |
| Week | Section 4.3 table |
| Road heading | `Road to May` with `28 weeks to CUET UG` (or `to your date`) |
| Tokens | `98 study days at` [4 a week]; [14 full mocks] `before your date, 7 taken` / `, suggested` |
| Rows | `Last paper`; `Your colleges`; empty: `Pick up to 8 to see their 2026 cutoffs here`, key `Choose` |
| Failure | `Tonight's move did not load`; cause sentence from `LoadProblem`; `Your papers and mistakes are safe; Review still opens them.`; `Tried again at 8:41 PM. Still not loading.` |

Retired strings (moved to the homes in section 7 or dropped as filler, never as features):
- `Planned from your own practice record, one step at a time.`
- `Still up? One short move, then sleep.`
- `Every day still counts`
- `3 more by Sunday` (replaced by the caption that ties the week to tonight)
- `This week: 1 of 4 study days done` / `28 weeks to go` as the default readout (the readout now appears only when a week is selected in the expanded rail)

## 6. Where every number in the mocks comes from

All figures are the product's own fixtures and goldens, so the mocks invent nothing:

- **Accountancy, 4 to repair, Mock 7 on 11 Oct, Partnership fundamentals, 15 min:** as rendered in the app golden `today_ready_full_night.png` (test `test/golden/today/today_golden_test.dart`).
- **204 of 250, +33 on Mock 6:** the same golden's Recent papers.
- **3 of 4 study days (Mon, Tue, Thu counted; Sat planned):** the 1016 L06 acceptance account. The planned days Mon, Tue, Thu and Sat are from the v12 walk (`app-walk-v12-today-road.png`).
- **28 weeks, 98 study days at 4 a week, 2 in boards weeks, registration in 15 weeks, boards 15 Feb to 5 Apr, CUET from 1 May 2027:** v12 `CuetCalendar` (`road_board.dart`, the walk captures).
- **14 full mocks, 7 taken, suggested 14:** the v12 walk and golden.
- **Shri Ram College of Commerce, B.Com (Hons), 924.3 of 1000, 2026 Round 1, unreserved, 2 more:** golden `today_colleges_card_some_night`.
- **Returning:** the app golden `today_returning_*` ("Its 6 mistakes are still here", 3 in 10 min), with the last paper dated 9 Oct to make the absence 8 days.
- **Day one:** golden `today_day_one_full_night` ("10 questions to your starting point", "Start now, 10 min").

The date, Saturday 17 October 2026, is the real date of this pass.

## 7. What moves where (nothing is deleted)

| Block now | Where it goes | How the student still reaches it |
|---|---|---|
| W1 / A1 page head and lede | Header: date plus greeting. The lede is retired as filler | (none needed) |
| W2 time segmented control (10/20/30) | **Change length** pill on the move card (same options, same save) | One tap |
| W2 diagnosis headline ("... where most marks are open") | The move's why sentence. The full diagnosis is Review's **Your record** | See why |
| W2 why aside (object, "30 marks these misses were worth") | The object stays as the card's art. The marks figure and its sentence move to the why sheet (`/today/why`) and Review's Your record | See why |
| W2 "Review your mistakes", "Choose another subject" | **Something else** sheet (`plan.alternatives` rows: Repair a mistake, Another subject, Full mock, NTA mode, Check it held), each with a one-line reason | One tap |
| W2 Mobi hello row | Retired as a daily act. Mobi stays for real moments (4.6) | |
| W3 First timed mock prompt | A **move** the builder can choose (`useFirstTimedMock` becomes a move candidate: "Sit your first timed mock", key "Start a timed mock"), and always a row in Something else | The move or one tap |
| W4 / A2 week ring and ledger | **This week** row (marks plus "3 of 4"). The ring and the weeks ribbon stay on Progress (web) and You (app) | Tap the row |
| A7 weekly ending card | A state of the This week row on Sunday night and Monday, which opens the existing weekly ending page | Tap the row |
| W5 / A9 Mob card | The Mob's home (`/mob` on the web; the Mob entry on You in the app). On Today the Mob speaks through (a) the alternatives sheet row "Sit this week's Mob paper" while unsat, and (b) the once-a-week ring-complete Mobi moment | One tap |
| W6 Admission Compass line | The **Your colleges** row (empty state: Choose; with colleges: opens Colleges, where Compass is the hero) | One tap, or two to Compass |
| W7 / A11 My colleges list and cutoff bar | The **Your colleges** row shows the first college. The ladder and bar live in Colleges (IA 5.1) | One tap |
| W8 Record glimpse findings ("Changing answers ...") | Review's **Your record** (web `/mentor?tab=record` or Radar; app `/review/insights`) | See why, or the Review tab |
| W8 / A10 paper trend chart and Recent papers list | Review's History (web: the Review page head; app: Review's History side, with the trend chart moved to its top) | **Last paper** row, then Review |
| W9 Install prompt | The account menu (web) as **Add to home screen**, and the More sheet of the dock | Two taps |
| A3 header Mobi, speech bubble, sleepy act | Retired on Today (4.6) | |
| A4 Also slots | Kept: still under the card, one row each, only when present (a second open paper, another sealed result) | (unchanged) |
| A5 lead-in pill | Kept with its existing rule (shown only while the road's top is below the first screen). The road now sits right under the week, so it rarely shows | (unchanged) |
| A6 Your record card (a second diagnosis) | Review's Your record. Today's why names the chapter the move is built on, so the two never disagree on one screen | See why |
| A8 road: lead figure, study line | The Road heading figure plus the tokens line | On screen |
| A8 road: readout | Shown only in the expanded rail when a week is selected | Tap a week |
| A8 road: rail (48 dp columns), jump chips, receipt | The **expanded rail**, opened in place from the strip | Tap the strip |
| A8 road: pace strip, Change days | The **4 a week** token's inline tuner | One tap |
| A8 road: mock ruler, "7 taken" sheet | The **14 full mocks** token's inline tuner | One tap |
| A8 road: walking Mobi | The expanded rail's first opening | |

## 8. States, by persona (the three mocked)

| | Day one | Active, mistakes to repair | Returning after a week |
|---|---|---|---|
| Greeting | Good evening, Asha | Good evening, Asha | Welcome back, Asha |
| Move | 10 questions to your starting point; Mobi greet | 4 mistakes to repair; the object | 3 mistakes to repair first; Mobi greet |
| Key | Start now, 10 min | Start repair, 15 min | Start repair, 10 min |
| Week | 0 of 4; Mon to Fri are dashes (before the account existed); "Your week starts tonight." | 3 of 4; "Tonight makes 4." | 0 of 4, no misses shown; "A new week. Tonight counts." |
| Road | 28 weeks, 98 at 4, 14 mocks suggested | 28 weeks, 14 mocks, 7 taken | the same |
| Rows | Colleges empty with Choose (Last paper hidden) | Last paper; Colleges | Last paper (9 Oct); Colleges |

Also mocked (app 412, Night and Day): loading, failure, and tonight done with the week goal met.

## 9. Coordination

- **Colleges (F2, nav decision pending in `tmp/design-1017/nav/`).** Today keeps exactly **one row**, "Your colleges". Its target follows the nav decision:
  - if Colleges is a tab or a dock slot, the row switches to it;
  - if Colleges moves elsewhere, the row pushes the Colleges root page.
  - Today never shows the ladder, the cutoff bar or a Compass card again.
- **The bar and dock Start key (F13).** Today asks the nav owner for the glass Start variant (volt glyph, ink label) on Today, so the move key is the viewport's one volt. On the web at 1440, the sidebar "Start a session" uses the outlined variant on Today.
- **Result (F11).** The move after a finished paper is chosen by the same builder. The result screen's "next thing" and Today's move must name the same action (one engine: web `/api/learning/plan`, app `move_builder.dart`).
- **Review (F15, F17).** Review receives Your record, the paper trend and the findings (section 7). F17's "repaired already" state matters here: a move must never offer a paid repair of a mistake that already has a saved repair. The builder reads the repair record and offers **Check it held** instead.
- **Start menu (F4 to F9).** "Something else" opens Today's alternatives, not the Start menu. Any "Quick practice" row there honours fine-tune scope F9 by opening the Start menu's Quick practice.

## 10. Build packets

Each packet is one builder. Web and app land together (owner rule, 14 Oct).

### P0, server (both)
- **Files (`wt` web repo):** `src/lib/server/study.js`, `src/app/api/study/preferences/route.js`, and a new migration `supabase/migrations/<ts>_study_road_fields.sql`.
- **Change:** add `exam_date date null` and `mock_target smallint null` to the study preferences, so the road's date and mock target live on the account. Today they live on the phone only (`road_plan.dart` header), so the website cannot show the same road.
- **Rules:** save the migration and a dry-run report first; no implicit production migration (AGENTS.md). Until it is applied, the web shows the expected date and the suggested target with the tokens disabled and the caption "Set on the app for now".

### P1, web Today (`src/app/(app)/today/page.jsx` and components)
- `today/page.jsx`: the new order: header (date plus greeting, the `ArenaHead` lede removed on Today), `LearningNextAction`, then the new `TodayGlance`. At 1440 it uses a `.today-grid` with two columns.
- `LearningNextAction.jsx` (full form only; the compact form used by Progress and Analytics is unchanged):
  - the card face per 4.2;
  - the segmented control moves into a `ChangeLength` sheet;
  - `NextWhy` becomes one sentence plus link;
  - the alternatives become the `SomethingElse` sheet;
  - the companion row is removed in favour of the art-box Mobi per 4.6;
  - the returning and sparse states;
  - the first timed mock becomes a candidate.
- **New** `src/components/today/TodayGlance.jsx`, `TodayWeek.jsx`, `TodayRoad.jsx` (the strip plus the inline tuners plus the expanded rail), `TodayRows.jsx`, `today.css`.
- `RhythmCard.jsx`: export the week data hook (`useRhythm`) for `TodayWeek`. The card stays for Progress.
- `colleges/MyColleges.jsx`: export `useMyColleges` for the row. `TodayColleges` stays for Colleges and Profile.
- `du/TodayCompass.jsx`: no longer rendered on Today (Colleges renders it).
- `ai/RecordGlimpse.jsx`: moved to the Review page head (coordinate with the F15 Review owner).
- `mob/MobTodayCard.jsx`: rendered on `/mob` and Progress only. `mobRingAct` stays on Today.
- `InstallPractice.jsx`: moved into the account menu and the dock's More sheet.
- `src/lib/mobiScreens.js`: Today's moments are firstEver, returning, weekGoalMet and mobRing; drop `firstVisitToday` from Today.
- Preview fixture `src/app/preview/arena/ArenaPreviewClient.jsx`: `data=returning` and `data=sparse` fixtures, and `rhythm=` variants.

### P2, app Today (`flutter_app/lib/features/today/`)
- `screens/today_body.dart`: the new order: header, hero, also slots, **TodayGlance** (week, road strip, rows). The insights slot, the Recent papers section and the colleges card leave Today.
- `widgets/today_header.dart`, `header_mobi.dart`: no header Mobi on Today; the greeting rules (5).
- `copy.dart`: the strings in 5; retire `lateNight`, `Up late`, the readout defaults.
- `logic/move_builder.dart`, `today_builder.dart`, `today_model.dart`:
  - the returning state (7 or more days) and the sparse clause;
  - the done state;
  - `TodayMood.lateNight` no longer changes the art;
  - the move excludes already-repaired mistakes and offers Check it held (F17).
- `widgets/move_hero.dart`, `move_keys.dart`, `length_pill.dart`: the key with the length inside; the two pills.
- `widgets/week_ledger.dart`: becomes `TodayWeek` (the marks, the figure and the caption table in 4.3); the weekly-ending state.
- **New** `widgets/road_strip.dart`: the strip painter, flag grip and tokens. `road_section.dart` hosts the strip, with `road_rail.dart` and `road_tuners.dart` opened in place (`AnimatedSize`); the tuners' selected stop changes to an ink pill.
- `data/road_plan.dart`: read and write through P0 when it is live, keeping the phone store as the offline cache.
- **New** `widgets/today_rows.dart` (Last paper, Your colleges). `colleges_card.dart` moves to `features/tools/colleges/` for the Colleges root (Colleges area); `sheet_section.dart` and `paper_trend.dart` move to Review History (Review area).
- `today_routes.dart`: drop `InsightsCard` and the `MobTodayCard` footer from Today. The Mob entry goes to You (You area).
- **Tests:**
  - goldens `today_glance_{dayone,active,returning,done,loading,fail}_{night,day}`, `today_road_strip_{rest,pace_open,mocks_open,rail_open}`;
  - unit tests for the greeting handle rule, the returning and sparse selection, and the strip column maths (the sum of pips equals `sessionsUntil`, as in 1016 8.15).

### P3, homes that receive moved blocks
- **Review (web Review page, app `features/review/`):** Your record finding, the paper trend, Recent papers, and the F17 repaired state.
- **Colleges:** the ladder and cutoff bar, and TodayCompass.
- **You and Progress:** the week ring and ribbon, and the Mob entry.
- **Account menu:** Add to home screen.

Each receiving area writes its own placement. This document only fixes that they must exist **before** P1 and P2 remove the blocks from Today. The build order is P3, then P1 and P2 (that way, for one day, a block may appear in two places, but never in none).

## 11. Acceptance checks (a tester can run these)

Setup: web at 390 x 844 and 1440 x 900, Night and Day; app on the emulator at 412 x 915 (and 360 x 800), Night and Day, and once at 1.3x text. Accounts: A (2 or more papers with open mistakes), B (new), C (last session 7 or more days ago). Take a screenshot at the end of each check and compare it with section 14.

1. **One answer at a glance.**
   - On A, first screen at 390 and 412: the subject, the number with its words, the why sentence with its paper and date, and **one** volt filled control (the key).
   - Count volt fills in the viewport: exactly 1. The bar or dock Start is the glass variant.
   - At 1440, the whole page (the move, the week, the road, the rows) is visible without scrolling.
2. **Why is true.** Tap **See why**: the why sheet names the same paper, date and chapter as the sentence.
   - On a sparse account (1 paper), the sentence carries "From your one paper so far".
3. **Pressable.**
   - Change length opens the 10/15/20 or 10/20/30 choices.
   - Choosing 20 updates the key to "Start repair 20 min" after the save confirms (web: `PUT /api/study/preferences` 200). A failed save leaves 15 and says so.
   - Something else opens the alternatives, each with a reason.
4. **Week.** On A with Mon, Tue and Thu counted and Sat planned, the figure reads "3 of 4" and the caption "Tonight makes 4."
   - Finish a session, then return: the Sat mark fills with its tick (animated, or instant under reduced motion), the figure reads "4 of 4", Mobi cheers **once**, and a reload does not cheer again.
5. **Road strip.**
   - All weeks to May are visible without sideways scrolling.
   - Drag the CUET flag one week right: "28" becomes "29", the study days rise, and on release "Your date: Sat 8 May. Saved." shows.
   - Reload, or force-stop and reopen: the date is kept (P0 live: kept on the other platform too).
   - Tap "4 a week": the pace tuner opens in place with 4 as an ink pill. Choose 5: Saving..., then Saved. The week figure reads "3 of 5". A failure springs back to 4.
   - Tap a week: the 48 dp rail opens in place at that week, and the readout names it.
6. **Rows.**
   - Last paper opens Mock 7's result.
   - Your colleges opens Colleges.
   - On B, the colleges row says "Pick up to 8 ..." and Choose opens the chooser sheet over Today; adding SRCC shows it in the row within one refresh.
7. **States.**
   - Network off, no cache: "Tonight's move did not load", Try again, then "Tried again at [time]."; Practise anyway opens Practice.
   - Slow network: the skeleton holds the card's height, and nothing above the fold moves after data arrives (two screenshots, at 1 s and 6 s).
8. **Returning (C).** The greeting is "Welcome back"; the card is "3 mistakes to repair first" with Mobi greet; the week shows no missed days and reads "A new week. Tonight counts."
9. **Mobi.** At every scroll position and state, at most one Mobi is visible. No sleepy act after 11 PM.
10. **Nothing lost.** For each row of section 7, reach the block from a cold start on Today within the stated taps.
11. **Names.** An account whose name field is a handle (for example `app-e2e-student`) is greeted with "Good evening" and no name.
12. **Reduced motion** (web `prefers-reduced-motion`; Android "Remove animations"): no rise, stagger or count-up. Fades only. Drags still track the finger.

## 12. Anti-slop test and rubric (design stage)

| # | Check | Verdict |
|---|---|---|
| 1 | Identity | CUET-specific everywhere: boards weeks at 2, the registration tick, the expected 1 May window, +5/−1 marking, DU cutoffs out of 1000 |
| 2 | One action | The move key. Pills and tokens are secondary and outlined |
| 3 | True content | Every number comes from fixtures and goldens (section 6). "Expected" marks NTA dates not yet set. No estimate against cutoffs |
| 4 | Hierarchy | The move, then the week, the road and the rows; one card |
| 5 | Composition | One 16 gutter, a 32 / 28 group rhythm, a 2-column 1440 grid |
| 6 | Typography | Roles: condensed figures, headline titles, Hanken body and labels; no caps eyebrows, no mono labels |
| 7 | States | Loading, slow, empty (day one), sparse, error, offline, success (done), return, saving, saved, failed save |
| 8 | Access | Section 4.9 |
| 9 | No pseudo-evidence | No predicted marks, no streak-loss threats, "Saved" only after the server answers |
| 10 | Motion rationale | Table 4.8; nothing loops |
| 11 | Measured usability | Leading metric: the share of Today visits that tap the move key within 60 s. Guardrail: the share that open Something else and then leave without starting (confusion) |
| 12 | Human critique | Each removed block has a named home; the one decorative element (the lamp light) is the app's existing room, kept faint |

Rubric (0/1/2): every dimension is at most 1 until the checks in section 11 pass on real builds. The owner signs off.

Slop list (ui-ux-standards section 10) checked on the captures:
- no floating UI over content (the bar has bottom padding);
- no gradient text or decorative wash beyond the existing lamp light;
- no identical card grid;
- no build talk;
- every state is designed;
- no ALL-CAPS;
- no arrows appended to buttons (chevrons appear only at row ends);
- no glass on content;
- no fake numbers.

## 13. Owner sign-off questions

1. Today shows one move, then This week, the Road strip, Last paper and Your colleges, and everything else moves to Review, Colleges or You (section 7). Is that the "not cluttered, not confusing" Today you meant?
2. The Road to May shows the whole road as one strip, and you tap a value or a week to adjust. Is that "editable in the timeline", or should the detailed rail stay open by default?
3. The sleepy late-night Mobi retires on Today, as on the result screen. Agreed?
4. The road's exam date and mock target move from the phone to your account, so the website shows the same road (one migration). Agreed?

## 14. Captures (all opened and checked)

Folder `tmp/design-1017/today/captures/` (mock source: `tmp/design-1017/today/today.html`, with query `p=app|web`, `s=dayone|active|returning|loading|error|done`, `t=night|day`, `open=pace`):

- **App 412 x 915, first screen:**
  - `app-412-{dayone,active,returning}-{night,day}.png`
  - full page: `app-412-{dayone,active,returning}-full-{night,day}.png`
- **App states:**
  - `app-412-{loading,error,done}-{night,day}.png`
  - the pace tuner open: `app-412-active-pace-open-full-{night,day}.png`
- **Web 390 x 844:**
  - `web-390-{dayone,active,returning}-{night,day}.png`
  - full page: `web-390-{dayone,active,returning}-full-{night,day}.png`
- **Web 1440 x 900:**
  - `web-1440-{dayone,active,returning}-{night,day}.png`
  - the pace tuner open: `web-1440-active-pace-open-{night,day}.png`

The current state for comparison is in `tmp/design-1017/today/current/` (section 2.1).

**Limits of the mocks:**
- They are static: motion is specified, not shown.
- The bar and dock are drawn for context only; the nav decision owns them.
- The error-state Mobi uses the pointing art because no `oops` still was at hand; the build uses the rig's `oops` act.
