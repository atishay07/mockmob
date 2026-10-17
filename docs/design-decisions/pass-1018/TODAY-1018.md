# The new Today, web and app (pass 1018)

**Status:** designed; **the owner's yes is needed before anyone builds it** (D2, and the "Pattern to stop" rule). Design only: no product code was changed.

**Mock:** `tmp/design-1018/today/` (clickable).
- `index.html` shows web 390, app 412 and web 1440 side by side, with State and Theme switches.
- `web.html` and `app.html` open on their own. Add `?state=active|dayone|returning|done|loading|error&theme=night|day` to pick a state and theme.
- The mock data is illustrative.
- The mock leaves out three R3 pieces that this spec keeps unchanged: the Mob row, the week-goal Mobi cheer and the weekly repair receipt.

**Owner items:** D1, D2, D3, N1, D5 (Today's half), D18 (the weak chapters tie), W-042, W-044 and F17.

**Read for this pass:**
- `OWNER-FEEDBACK-2026-10-18-DAWN.md`
- `OWNER-MASTER-LEDGER.md`
- `FEATURE-ADOPTION-2026-10-17.md`
- the memory notes web-restructure-rejected, mockmob-design-direction and owner-master-ledger
- the R3 Today at main `5d0c46f2` (`src/app/(app)/today/page.jsx` and `src/components/today/*`)
- the R4 diff to `9578ee66`
- the app's Today in `wt-v15/flutter_app/lib/features/today/`
- the skills ui-ux-standards (the slop list wins), impeccable and emil-design-eng
- the research rules (`docs/research/premium-ux-ui-2026-10/AGENT_RULES.md`, cited as R1-R40)

---

## 1. The decision in one paragraph

Today goes back to the **R3 Today's information and structure**. Nothing R3 showed is lost.

It keeps R4's cleanliness: the spacing, the type scale, the glance blocks sitting on the ground and not in boxes, and Night with no volt edge light. It fixes the two things N1 named inside that structure: **the long road strip** becomes one tappable summary, and **the mock slider** becomes a three-step guided sentence.

It then adds what D2 asked for. **Today leads, and it is interactive:**
- The lead card shows the recommended move with its reason and its value (the marks at stake and the minutes).
- **Two other moves sit in the same card as tappable choices. A tap swaps the lead card live.**
- The days of the week are tappable and show what was done and what is planned.
- The road opens Change plan.
- The weak chapters open to their own mistakes.

The order, top to bottom:
1. greeting and date;
2. Up next, with two choices;
3. This week;
4. Road to CUET;
5. Weak chapters;
6. Last paper;
7. Repairs and Revise;
8. Your colleges and Compass.

## 2. Why this and not another rebuild (the owner's words)

- **D1:** "Today is honestly a huge regression ... The thing that you had previous to this was good because it was something that just needed refinement in terms of UI and functionality."

  R4 changed only the road (`git diff 5d0c46f2 9578ee66` touches `TodayRoad.jsx`, `road.mjs`, `today.css` and the page header). The rest of R4 *is* R3. So this pass starts from R3 and keeps every R3 block (the inventory in 2.1).
- **D2:** "This Today section should lead and do more things, not just start every 10 minutes."

  The answer is the lead card's two choices, the tappable week and the expandable weak chapters, each with real numbers.
- **D3:** "It should never look like just a basic form ... always leading and interactive UI which leads you to the next thing."

  Change plan is one sentence with three answers, asked one at a time, and the outcome previews live (section 6.4).
- **N1** (still true for R3): the strip showed only a few weeks in focus, and the slider "does nothing a student understands".
  - The strip becomes **27 weeks to CUET UG** plus three readable facts.
  - The slider becomes three named choices and a stepper.
- **D7:** Night stays subtle.
  - R3's lead card had a volt inset edge (`inset 0 1px 0 rgba(210,240,0,.26)`); it is now a neutral 2.5% white edge.
  - Volt fills only the lead key and the counted day marks, with no glow anywhere.
  - The Arena tokens did not change between pre-R2, R3 and R4 (`arena.css` lines 15-50 hash the same), so the D7 neon is not in these tokens. It is the D7 web packet's job.

### 2.1 Every R3 block, and where it is now

| R3 block (file at 5d0c46f2) | New place |
|---|---|
| Head: date and greeting (`page.jsx`, `greeting.mjs`) | 1, unchanged |
| The move: overline, subject, subject object, big number, why, the volt key with its minutes, repair price (`TodayMove.jsx`) | 2, the lead card (unchanged anatomy) |
| Change length sheet (10/20/30) | 2: the "about 12 min" token opens the three lengths **inline** in the card (no sheet) |
| Something else sheet (`alternatives()`) | 2: the **two best alternatives are on the card** as choices; the full list stays behind "More ways to practise" (the same sheet) |
| Full mock instead / Open the session pills | 2: offered as choices when they are the best alternatives; the resume state is unchanged |
| TodayCue, "Your week and Road to May" (W-044) | Kept under the card on phones: "Your week, the road and weak chapters" |
| This week: 7 marks, "3 of 4 study days", caption, weekly receipt, week-goal Mobi (`TodayWeek.jsx`) | 3: the same marks, now **tappable**, with a day readout. Receipt and Mobi are kept (6.3). The link to Progress moves to the caption ("Your weeks"). |
| The Mob row (`TodayMob.jsx`) | Kept under This week, unchanged, behind MOB_ENABLED (and D21) |
| Road to May strip, drag flag, rail, tokens, mock slider, date sheet (`TodayRoad.jsx`) | 4: a summary that opens **Change plan**. The flag becomes step 1, the pace tuner step 2 and the slider step 3. The week-by-week rail is reachable from step 2 ("See every week", as in R4). |
| Last paper row (`TodayRows.jsx`) | 6: richer (right, wrong and blank, the biggest leak, Repair) |
| Your colleges row, subject-rules fit, "Plan for it" (`TodayRows.jsx`) | 8, unchanged data. The key reads "Open in Compass". |
| PrepOS top chapter (used only inside the move) | 5: Weak chapters, the top three |
| (none) | 7: Repairs and Revise counts (D5, Today's half) |

Nothing was deleted.

## 3. The blocks: data source, content, and what a tap does

All the reads below exist on the current site. Today already makes reads 1-8 in `useToday.js`, plus `useInsights` and `useMyColleges`. **Two small additions** are marked NEW.

| # | Block | Data (current APIs) | Shows | Tap |
|---|---|---|---|---|
| 1 | Greeting and date | `greeting.mjs` (hour, name, `rhythm.daysSinceLastActivity ≥ 7` = returning); the local date | "Sunday, 18 October"; "Good evening, Asha" or "Welcome back, Asha" | none |
| 2 | **Up next** (lead card) | `buildMove()` and `alternatives()` in `src/lib/today/move.mjs`, over `GET /api/learning/plan`, `/api/attempts/summary?limit=20`, `/api/me/rhythm`, `/api/me/revise`, `/api/me/timed-mock`, `/api/me/repair-record?limit=100`, and `/api/prepos/insights` (ranked[0]). NEW, pure: `move.stake` and `pickChoices()` (6.1). | Overline "Up next, Accountancy" (or "Up next, your pick"); title; the big number with its label; **value line: "24 marks they cost you" plus the "about 12 min" token**; why; the volt key with the minutes inside; the price line; **two choices**; "More ways to practise" | A choice swaps the lead (6.2). The token opens the lengths. The key starts the move. "More ways" opens the existing Something else sheet. |
| 2a | The phone cue (R3 TodayCue) | none | "Your week, the road and weak chapters", with a down chevron icon | Scrolls to This week. It fades once the week is on screen. Phones only. |
| 3 | **This week** | `rhythm` (`studyDayDates`, `daysGoal`, `weekStart`, `timeZone`, `metThisWeek`); `goal.weekdays`; `weekMarks()` and `weekCaption()` in `week.mjs`. Day readout: the papers of that local day (summary `completedAt`) and the repairs of that day (repair-record `at`), both already read. | "3 of 4 study days"; seven marks (done = volt tick; planned = ink ring; planned but passed = dashed ring; rest = dot; before day one = dash); the readout of the selected day (today by default); one caption | A day selects it; the readout swaps in place (6.3). The caption's "Your weeks" opens Progress. |
| 4 | **Road to CUET** | `GET /api/me/road`, `GET /api/me/goal`, `facts.mocks`; `roadFigures`, `sessionsUntil`, `nextMilestone`, `mockPace`, `suggestedMockTarget` and `mockChoices` (all in `road.mjs` since R4) | "27 weeks to CUET UG", "Expected from Sat 1 May 2027"; Full mocks "3 of 14", pace "one a fortnight", 14 small marks; Study days left "94 at 4 a week"; "Next, in 15 weeks: registration expected to open, Mon 1 Feb."; "Change plan" | **The whole block** opens Change plan (6.4). After a save, a receipt line shows under it. |
| 5 | **Weak chapters** | `/api/prepos/insights` → `chapters.ranked.slice(0, 3)` (`chapter`, `subjectName`, `wrong`, `skip`, `n`, `open`) and `insights.sessions`. NEW, pure, in `data/prepos_insights.js`: each ranked chapter carries `recent` (up to 3 `{attemptId, position, completedAt, outcome}`, open first, newest first). The stems load on the first expand from `GET /api/attempts/{id}` (it exists; the result page and the app's "Show me" use it). The repaired state comes from repair-record. | Subline "Where your marks go, from your last 9 papers". Each row: chapter, "Accountancy, 9 of 21 missed", **45 marks**, a Practise key | The row expands to its mistakes (6.5). Each mistake: "Repair" (open) or "See repair" plus "Repaired" (F17: never a paid repair again). "All 9 in Review" opens Review filtered to the chapter (D18). Practise opens the Start sheet prefilled with the subject and chapter. |
| 6 | **Last paper** | `papers[0]`: `correct`, `wrong`, `unattempted`, `marks`, `maxMarks`, `completedAt`, `formatId`. The delta is against the previous paper of the same format (the existing code). Biggest leak: `GET /api/attempts/{id}` → `computePrepOSInsights([attempt])` (the result page's own SessionReadout engine), chapter with the highest `open`, over ranked and thin. | "Accountancy full mock"; "Sat 17 Oct, 9:12 PM, +12 on the one before"; **124 of 250**; a right/wrong/blank bar with words ("27 right, 11 wrong, 12 blank, of 50"); "Biggest leak: Admission of a partner, 6 of your 23 misses (4 wrong, 2 blank)." | "Repair this leak" opens the result at that chapter's first open mistake. "Open the result" opens `/result/{id}`. |
| 7 | **Repairs and Revise** (D5) | Repairs: wrong answers on the read papers without a repair (`openMistakes()` per paper, the `repaired` map), plus repair-record rows whose state is repaired but not yet checked. Revise: `revise.due` (capped at 10 a day by the API). | Two tiles: "Repairs: **11** open; 2 repaired, ready to check on fresh questions", and "Revise: **6** due today; Free, about 8 min" | Repairs opens the Review repairs queue. Revise opens `/review/revise`. |
| 8 | **Your colleges and Compass** | `useCollegeRow` as in R3: `/api/me/colleges`, `loadOfferings`, `roundOneCutoff`, the subject-rules fit | "Shri Ram College of Commerce", "B.Com (Hons), 2026 Round 1, unreserved. 2 more saved.", the cutoff "of 1000", the rules line | The row opens Compass. "Open in Compass" opens `/admission-compass?course=…`. Empty state: "Choose colleges". |

**Truth rules held on every block:**
- Unknown is never zero: each block keeps its own read status (`useToday` already does).
- Every count has its denominator: "3 of 4", "9 of 21 missed", "124 of 250", "6 of your 23 misses", "3 of 14".
- `stake` is the record's own arithmetic (each wrong answer cost 5 not gained plus 1 taken). It is never a promise of marks to gain.
- Dates say "expected" until NTA publishes.
- Times use a 12-hour clock.

## 4. Layout

**Phone, website 390 and app 412.** One column in the order of section 1.
- The page gutter is 16 px, with 40 px between blocks.
- Only the lead card is a card (raised, a 1 px line, 28 px radius on the web, 24 on the app).
- This week, Weak chapters, Last paper and Your colleges sit on the ground, split by hairlines.
- Road to CUET and the two Repairs/Revise tiles are outlined surfaces, because the whole surface is the button (F5: pressable things look pressable).
- No card holds a card. The choices are a split footer of the lead card, not cards inside it.

**Desktop, website 1440.** Two columns, as in R3, so the order is preserved by role:
- **left (7 of 12):** Up next, Weak chapters, Last paper (the doing);
- **right (5 of 12):** This week, Road to CUET, Repairs and Revise, Your colleges (the glance).
- Max width 1120 px; a 40 px column gap; 44 px between blocks. The DOM order is 1-8 (phones use CSS `order`, as R3 did), so a screen reader reads the order of section 1.

**Type.**
- Website: Bricolage Grotesque for display, Hanken Grotesk for text. 34 px greeting on desktop and 28 on phones; 19 px section heads; the 112 px lead number; 56 px road weeks; 30-40 px figures.
- App: `MmType` roles (figureHero condensed 104, headline 28, title 22, Hanken 13-18).
- Every figure is `tabular-nums`. Labels are sentence case.

**Colour.**
- Website: the `--a-*` Arena tokens.
- App: `MmColors.dark` and `light`.
- One volt fill per viewport (the lead key). Volt also marks counted days, and appears as text on the word "Suggested" and on the current sentence step's underline.
- Wrong answers use `--a-bad-text` on the bar only, always with the words.

## 5. States

| State | When | What changes |
|---|---|---|
| **Day one** | `sessions === 0` | Lead: "Find your starting point", **10** questions, "Free. Your first set uses no credits." Choices: "Full mock instead (50 questions, 60 min)" and "Another subject". Week: days before today show a dash; caption "Your plan is 4 days a week. Today is the first." Road: "0 of 14, suggested"; the note "Set your date and days. It takes three taps." Weak chapters, Repairs and Revise: one teaching line each (no fake rows). Last paper: absent. Colleges: "Pick up to 8 colleges to see their 2026 cutoffs here." with Choose colleges. |
| **Active** | the default | As in section 3 (the mock's default). |
| **Returning** | away 7 days or more | Greeting "Welcome back, Asha". Lead: "Find your footing again", 10 warm-up questions. Choices: "Repair a mistake (11 open from 3 Oct)" and "Revise what is due (10 of 14 due today)". Week caption: "A new week starts with one session. Today can be day one of 4." No shaming, no streak loss shown. |
| **Done** | `move.id === 'done'` (`buildMove`, the plan's tonight session saved) | Lead: "Done for tonight", **24** minutes practised tonight, "Saved at 8:52 PM: 4 repairs and 6 Revise questions. Tomorrow starts with the 7 mistakes still open from Saturday." Key: "See tonight's repairs". The choices stay, for a student who wants more. Week: today ticked; "Goal met: 4 of 4 study days." Revise: "Nothing due. The next 3 come back Tuesday." |
| **Loading** | the first reads are on their way | Skeletons hold each block's resting height. The lead's skeleton shows after 400 ms. **The page lands in one piece** (W-042): the week, road, rows and Mob wait for the move, as R3's `hold` did. After 8 s: "Still loading. Your connection looks slow. Try again." Weak chapters and the leak line land later, into reserved height, so nothing moves. |
| **Error** | per read | Lead failed: "Tonight's move did not load", "Your papers and mistakes are safe; Review still opens them.", "Tried again at 7:41 PM. Still not loading.", Try again (the R3 copy). Other blocks still render from their own reads. A failed block says so in one line with Try again (for example "Your weak chapters did not load."). The week readout for today then says "Your move shows here once it loads." |
| **Offline** | `navigator.onLine === false` | The key is disabled with "Needs a connection to start." (R3). The choices still swap: the swap is local. |
| **Pro and Free** | | Only the price line changes ("Uses 10 credits. You have 120." or "Each repair uses 1 AI credit. You have 38."), with the cost shown before the press (W-060). |

## 6. Interactions and motion

Motion values, used throughout:
- ease-out `cubic-bezier(0.23, 1, 0.32, 1)`;
- in-out `cubic-bezier(0.77, 0, 0.175, 1)`;
- drawer `cubic-bezier(0.32, 0.72, 0, 1)`;
- transform and opacity only;
- reduced motion: every movement becomes an instant change or a 150 ms fade.

**Page load: the one authored moment.**
- The lead card rises 12 px in 320 ms.
- The other blocks rise 8 px in 260 ms, 40 ms apart.
- The counted days pop (scale 0.6 to 1, 220 ms, 30 ms apart), then their ticks draw (160 ms).
- The lead number counts up (the existing `useCountUp`, remembered so it does not replay on every visit).

### 6.1 Which two choices (NEW, pure: `pickChoices(move, alternatives)`)

The two highest-value alternatives that are a *different kind* from the lead, in this order of preference:
1. Repair (open mistakes);
2. Revise (due > 0);
3. Practise the weakest chapter (`top` exists);
4. Full mock (no mock in 14 days, or the first-week day 5-7 step);
5. Another subject / Quick practice.

Each choice carries a title and one value line with a number:
- "Revise what is due", "6 due, about 8 min";
- "Repair a mistake", "11 open from Saturday";
- "Practise your weakest", "Admission of a partner".

When the lead is a pick, the recommended move sits in the choices with the word **"Suggested"** above it, so the student can always go back.

### 6.2 The swap

Tapping a choice:
1. The lead body fades out with 2 px blur and 6 px of drop in 140 ms.
2. The content changes.
3. It fades back in over 200-260 ms.
4. The big number rolls from the old value to the new one (380 ms, ease-out cubic).
5. The two choices re-render with the previous lead among them.
6. The overline reads "Up next, your pick".
7. This week's readout for today updates live ("Up next: practise your weakest chapter, about 15 minutes").

Other rules:
- The swap writes nothing to the server. The pick is kept for the day in `sessionStorage` (`mm:today-pick:v1:<day>`), so a back navigation keeps it.
- The key is the one volt; the choices are plain buttons with a hover wash and a pressed wash.
- Under reduced motion it is an instant swap.

### 6.3 The week

- Each day is a 44-76 px button. The selection is **one indicator that slides** between days (`translateX`, 240 ms in-out, the N5 lesson), not seven boxes switching.
- The readout under the days swaps with a 4 px rise in 220 ms. It reads, for example:
  - "Thursday 15 Oct", then "Economics practice, 15 questions, 41 of 75, 6:20 PM";
  - today: "Up next: …";
  - a planned day with nothing saved: "No session saved that day. The week still counts any 4 days.";
  - a rest day: "A rest day in your plan. Anything you practise still counts."
- The week-goal Mobi cheer and the weekly repair receipt from R3 stay beside and under the caption, once per week per device. There is at most one Mobi on screen.
- **P1, NEW (server):** a Revise line in the day readout ("Revise, 5 questions, 4 held"). It needs Revise answers among the rhythm events. The mock shows it; v1 may ship with papers and repairs only.

### 6.4 Change plan: a guided sentence, never a form (D3)

Where it opens:
- phones: a bottom sheet (280 ms drawer curve in, 160 ms out);
- desktop: a centred 560 px dialog (scale 0.96 to 1, 220 ms);
- app: an `MmSheet` with a 32 dp top radius.

It is one sentence, with the three answers as underlined tokens: **"I sit CUET UG on [Sat 1 May, expected], study [4 days] a week, and take [14 full mocks] before it."**
- The current step's token is underlined in the accent colour.
- Tapping any token jumps to its step.
- Under the sentence, one question at a time slides in (12 px, 220 ms).
- A live preview (27 weeks / 94 study days / 11 mocks to go, one a fortnight) bumps each number that changes.

The steps:
1. **When do you sit CUET UG?** Two choices: "The expected start (Sat 1 May 2027. NTA has not published the 2027 dates yet.)" and "My own date (Once your admit card shows it.)". The second opens a May and June 2027 month view; the expected day is ringed. Saves to `PUT /api/me/road {examDate}`.
2. **Which days can you study?** Seven day toggles (the chosen weekdays, not just a count). Hint: "Board weeks, 15 Feb to 5 Apr, ease to 2 days. Any day you practise counts, planned or not." At least one day. Saves to `PUT /api/me/goal {weekdays, daysPerWeek}`. "See every week" opens the R4 rail.
3. **How many full mocks before your exam?**
   - "One a fortnight, 14 (Suggested. Steady practice alongside your chapters.)"
   - "One a week, 27"
   - "One a month, 7"
   - "Your own number" with − and + (never below taken + 1, never above 60)

   Saves to `PUT /api/me/road {mockTarget}`.

Saving and leading:
- Each answer saves when tapped: "Saving…", then **"Saved." only after the server answers**. On failure: "Not saved. Your date is unchanged." with Try again.
- After a saved answer on steps 1 and 2, the sheet **leads to the next step** 520 ms later. Back and Next remain.
- Step 3 ends on the volt **Done**. Closing leaves the road showing "Plan saved at 7:41 PM: 27 weeks, 4 days a week, 14 full mocks."

Before the road migration is applied, `onAccount` is false:
- the date and target tokens are read-only with "Set on the app for now" (R3 behaviour);
- the days step still saves.

### 6.5 Weak chapters

- The row toggles open with `grid-template-rows` 0fr to 1fr (240 ms); its plus icon turns to a cross (rotate 45°).
- The first open fetches the stems (`/api/attempts/{id}`, at most 2 papers). Meanwhile it shows 2 skeleton lines of the resting height.
- On phones the Practise key sits under the chapter name, so the name never squeezes to two lines.
- Each mistake shows "Q14, Accountancy full mock, Sat 17 Oct, 9:12 PM" and the full stem (questions are never truncated), plus one action:
  - **"Repair"** when open;
  - **"See repair"** with "Repaired" in green when it already has one (D15: one label per state, the same everywhere; F17).

### 6.6 Presses

- Keys and tiles: scale 0.97-0.99 on press (100-120 ms).
- Hover only behind `(hover: hover) and (pointer: fine)`.
- Focus: a 2 px accent ring on everything.
- The sheet focuses its title on open (not the close button), so no focus ring flashes on open.

## 7. Copy deck (exact strings, sentence case, no arrows, no exclamation marks)

| Where | Copy |
|---|---|
| Lead overline | "Up next, {Subject}" / "Up next, your pick, {Subject}" / "Today" (done) |
| Lead titles | "Repair your last paper" / "Revise what came back" / "Practise your weakest chapter" / "Find your starting point" / "Find your footing again" / "A full mock instead" / "Done for tonight" |
| Lead labels | "mistakes to repair" / "mistakes come back today" / "questions on {chapter}" / "questions to your starting point" / "questions to warm up" / "questions in 60 minutes" / "minutes practised tonight" |
| Value line | "{n} marks they cost you" / "{n} marks they cost you then" (Revise) / "{n} marks open there, over {p} papers" / token "about {m} min" |
| Lengths | "10 min, 3 mistakes" / "20 min, 6 mistakes" / "30 min, 9 mistakes" (from `fitMove`) |
| Keys | "Start repair" / "Start Revise" / "Start practice" / "Start" / "Start full mock" / "See tonight's repairs" / "Try again", each with "{m} min" inside |
| Price | "Each repair uses 1 AI credit. You have {n}." / "Uses 10 credits. You have {n}." / "Free. No credits." / "Free. Your first set uses no credits." |
| Choices | "Suggested" (above the recommended one) and "More ways to practise" |
| Cue | "Your week, the road and weak chapters" |
| Week | "This week", "{d} of {g} study days"; the captions in section 5; "{d} of {g} done. One more today meets your goal." |
| Road | "Road to CUET", "{w} weeks to CUET UG" / "to your date", "Expected from {day} 2027" / "Your date, {day} 2027", "Full mocks", "Study days left", "at {n} a week", "Next, in {w} weeks: {milestone}, {day}.", "Change plan" |
| Change plan | the sentence in 6.4; "When do you sit CUET UG?", "Which days can you study?", "How many full mocks before your exam?"; "Saving…", "Saved.", "Keep at least one day.", "Next", "Back", "Done" |
| Weak chapters | "Weak chapters", "Where your marks go, from your last {n} papers", "{s}, {m} of {n} missed", "marks", "Practise", "Repair", "See repair", "Repaired", "All {m} in Review"; day-one line in section 5 |
| Last paper | "Last paper", "{time}, +{d} on the one before", "{r} right, {w} wrong, {b} blank, of {n}", "Biggest leak: {chapter}, {k} of your {m} misses ({w} wrong, {b} blank).", "Repair this leak", "Open the result" |
| Repairs and Revise | "Repairs and Revise", "Repairs", "{n} open", "{k} repaired, ready to check on fresh questions", "Revise", "{n} due today", "Free, about {m} min" |
| Colleges | "Your colleges", "{programme}, 2026 Round 1, unreserved. {n} more saved.", "cutoff of 1000", the rules lines (R3 `fitLine`), "Open in Compass", "Choose colleges" |

## 8. Build packets (after the owner's yes; web and app in parallel, about 1½ h each)

### 8.1 Web packet (Opus for the lead card and Change plan, Sonnet for the rest)

**Start from the R3 files at `5d0c46f2`:** `git checkout 5d0c46f2 -- src/components/today src/lib/today "src/app/(app)/today"`. Then **port R4's road helpers** (`nextMilestone`, `mockPace`, `mockChoices`, `inWords`, `sessionsUntil`) from `9578ee66:src/lib/today/road.mjs`.

| File | Change |
|---|---|
| `src/app/(app)/today/page.jsx` | The order of section 4; the two columns on desktop; pass `pick` state; mount TodayWeak, TodayPaper, TodayQueue and TodayColleges |
| `src/components/today/TodayMove.jsx` | Value line with stake and the length token; lengths inline (drop the ChangeLength sheet); the choices footer; the swap (6.2); keep Something else behind "More ways to practise"; keep the failed and loading states |
| `src/lib/today/move.mjs` | `stake` on each move; NEW `pickChoices()`; tests for both |
| `src/components/today/TodayWeek.jsx`, `src/lib/today/week.mjs` | Tappable days, the sliding indicator, the readout (NEW `dayReadout({ day, papers, repairs, move })`); keep the receipt and the Mobi cheer |
| `src/components/today/TodayRoad.jsx` | The summary (section 3, row 4); the whole block is a button; the receipt |
| NEW `src/components/today/TodayPlanFlow.jsx` | Change plan (6.4) inside `TodaySheet`. Reuse R4's save handlers (`saveRoad`, `pickPace`, `commitMocks`) and the R4 rail. |
| NEW `src/components/today/TodayWeak.jsx` | Section 3, row 5, and 6.5 |
| `src/components/today/TodayRows.jsx` → split into NEW `TodayPaper.jsx`, `TodayQueue.jsx`, `TodayColleges.jsx` | Rows 6, 7 and 8 |
| `src/components/today/useToday.js` | A lazy `attempt(id)` read for the leak and the stems (cached per visit) |
| `data/prepos_insights.js` | NEW `recent` on each ranked chapter (pure, no new query) |
| `src/components/today/today.css` | From the mock's `today.css` (copy the token values; keep the `.app-shell` scoping); remove the volt inset edge |
| `src/components/today/TodayCue.jsx` | The new text; it targets `.week` |
| Tests | `data/tests/today_*.test.mjs` for `pickChoices`, stake, `dayReadout`, `recent`; the existing `npm run test:recovery` and the today suite (32). A 390 and 1440, Night and Day walk on every state of section 5, with real pointer clicks and a hit test (the mock's `cap.mjs` pattern). |

### 8.2 App packet (Flutter; Opus for the hero and sheet, Sonnet for the rest)

**Base it on `ui/v15-1018` (wt-v15, 76ee2e90), not on wt-v15-today:** that branch follows the rejected R4 design (NOW.md, decision A).

| File (`flutter_app/lib/features/today/`) | Change |
|---|---|
| `screens/today_body.dart` | The order of section 1. Drop the "Your sheet" and the R4-style road card from the body. The week moves above the road. |
| `widgets/move_hero.dart`, `move_keys.dart`, `length_pill.dart`, `number_block.dart` | The value line and length token; the choices footer (two `MmPressable` halves with a hairline); the swap with an `AnimatedSwitcher` (fade, 2 px blur, 140/240 ms) and a number roll; "More ways to practise" opens the existing `also_slots` sheet |
| `logic/move_builder.dart`, `today_model.dart` | `stake` and `pickChoices` (mirror the web functions and tests) |
| `widgets/today_week.dart`, `week_ledger.dart`, `logic/week_chip.dart` | Tappable days, a sliding indicator (`AnimatedAlign`, 240 ms), the readout; haptic `selectionClick` on a day |
| `widgets/road_section.dart` (replaces `road_board.dart`, `road_strip.dart`, `road_timeline.dart` and `road_tuners.dart` on Today; keep `road_rail.dart` for "See every week") | The summary; tapping opens NEW `widgets/plan_flow_sheet.dart` (6.4) |
| `logic/plan_adjust.dart`, `data/road_plan.dart` | The three saves. **Engineering check:** the app writes `examDate` and `mockTarget` through `/api/study/preferences`, the web through `/api/me/road`. Confirm they hit the same columns before shipping, or move the app to `/api/me/road`. |
| NEW `widgets/weak_chapters.dart` | Section 3, row 5, and 6.5 (stems via `/api/attempts/{id}`, which `today_providers.dart` already calls) |
| `widgets/today_rows.dart`, `paper_trend.dart`, `colleges_card.dart` | Last paper (with the bar and the leak), Repairs and Revise tiles, Colleges |
| Theme | `MmColors` and `MmType` only. The dock keeps its glass (the brief allows it). No `voltGlow` on Today. |
| Tests | Goldens for active, day one, returning, done, loading and error, in Night and Day, at 412; the plan sheet's steps 1-3; then the emulator walk (memory device-truth-testing) |

## 9. Checks run on this mock (and what they do and don't prove)

**Captures.** Headless Chrome through playwright-core (own temp profile, `channel: chrome`), 34 captures, **each one opened and looked at**.
- Every interaction capture was made with a **real pointer click at the element's centre after an `elementFromPoint` hit test**: the choice swap, the length token, a week day, a chapter, the road block, a mock choice and Done.
- The script also checks for **horizontal overflow** at every width.
- Final run: no issues. An earlier run flagged a week day under the app's fixed dock, because the script had scrolled it to the viewport's bottom edge. The script now centres each target before clicking, and the page pads 120 px for the dock.

**Defects found and fixed in the mock during review:**
- the subject line overlapped the big number at 390;
- the art squeezed the title on the app;
- the Try again icon was unsized;
- weak-chapter names wrapped beside the Practise key on phones (the key now sits under the name);
- the next milestone wrapped to four lines (now one sentence);
- the week readout claimed a move in the error state;
- day one showed past days as missed (now a neutral dash);
- the sheet opened with a focus ring on the close button;
- fixture stems looked truncated (now full questions).

**Slop list (section 10 of the standards):**
- No glow, neon, gradient text, eyebrow pills or dots, icon grids, nested cards, arrows on buttons, ALL-CAPS, emoji, hype or build talk.
- Nothing floats over content except the dock, which the page pads for.
- One volt per viewport.
- No surface looks like a form: Change plan is a sentence with tappable answers and a live outcome.

**12-part test:**
- (1) identity: the subject objects, volt and Bricolage, with the logo hidden;
- (2) one primary action;
- (3) true content: the fixture agrees with itself;
- (4) hierarchy;
- (5) composition;
- (6) type by role;
- (7) every state;
- (8) accessible interaction;
- (9) no pseudo-evidence: stake is the record's arithmetic;
- (10) motion with a reason;
- (11) one leading metric (the lead number) plus a guardrail (the denominators);
- (12) "better without": the cue is the weakest piece, kept for W-044.

**What this does not prove:** real-device performance, the real API shapes under load, and screen-reader output beyond the semantics in the markup. Those belong to the build's walk.

**Evidence and rules:**
- T001: defaults only from real context (the suggested mock target is arithmetic and is labelled "Suggested").
- T002: progress only for completed steps.
- S014: progressive disclosure for secondary things (the lengths, mistakes and the full move list), never for the primary one.
- S016: labels and selected state on the days and steps.
- R7: one main action.
- R9: value before label, with units.
- R12: a vertical rhythm on phones.
- R31: motion with a purpose and reduced motion.
- R33: cards only for meaningful groups.
- FEATURE-ADOPTION 2 (one hero, two quiet items), 5 (receipts) and 10 (empty states that teach).

## 10. Capture index (`tmp/design-1018/today/captures/`)

**Website 390** (`web-390-…`):
- `active-night`, `active-night-full`, `active-day-full`;
- `swap-revise-night`, `length-open-day`, `week-thu-night`, `chapter-open-night`;
- `plan-step1-night`, `plan-step1-own-day`, `plan-step2-night`, `plan-step3-day`, `plan-saved-night`;
- `dayone-night-full`, `returning-night`, `done-day`, `loading-night`, `error-night`.

**Website 1440** (`web-1440-…`):
- `active-night`, `active-day`, `active-night-full`;
- `plan-step3-night`, `plan-step2-day`;
- `dayone-day`.

**App 412** (`app-412-…`):
- `active-night`, `active-night-full`, `active-day-full`;
- `swap-practise-day`, `week-sat-night`;
- `plan-step1-night`, `plan-step2-day`, `plan-step3-night`;
- `dayone-night-full`, `done-day`, `loading-night`.

To re-capture: `node tmp/design-1018/today/cap.mjs [regex]`. The jobs are in `jobs.json`.

## 11. Questions for the owner (one each, with a recommendation)

1. **Build this Today on web and app as shown?** The order: greeting, Up next with two swappable choices, This week, Road to CUET, Weak chapters, Last paper, Repairs and Revise, Your colleges.

   *Recommendation: yes. It is the R3 Today with every block kept, refined, and made interactive.*
2. **Change plan leads automatically:** after each saved answer, the sheet moves to the next question by itself, with Back and Next still there. Keep that, or move only on Next?

   *Recommendation: lead automatically. That is the "leads you to the next thing" in D3.*
3. **v15 timing (NOW.md, decision A):** ship v15 to the Play Store with the v14 Today, and bring this Today in 1.0.16 after your yes?

   *Recommendation: yes (A1). Play review takes days anyway, and the wt-v15-today packet follows the rejected design.*
