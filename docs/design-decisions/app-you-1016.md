# You and profile: area design, 16 Oct 2026

Status: **build-ready design for the You and Account builders. Owner sign-off pending** (section 13). Design only: no code was changed, nothing was committed, nothing was checked on a device.

Covers ledger items **L16 to L21** (`docs/brain/APP-OWNER-LEDGER-2026-10-16.md`). It also covers **L34 to L37** (motion, Mobi, spacing, subject art) as they apply to these screens, and the You half of **L06** (the study-day ring).

It works inside the IA lead's decisions (`docs/design-decisions/app-ia-1016.md`): D4 (You is the student's study), D5 (the avatar sheet is the account), section 6, the route map in section 8, and the ownership map in section 10. Where this file adds detail to a screen, the detail is decided here. Where it would change an IA decision, it does not; the request goes in section 12.

Evidence read:
- Code on `ui/phase2` (`wt-phase2/flutter_app`, working tree of 16 Oct, head 3887e786): `features/you/you_hub_screen.dart`, `you/hub/*`, `you/copy.dart`, `features/rhythm/logic/{tokens,milestone_tracks,milestone_progress}.dart`, `rhythm/data/bests.dart`, `rhythm/widgets/{medal,token_shelf,week_dial}.dart`, `rhythm/screens/{milestones_screen,bests_screen}.dart`, `rhythm/celebration/*`, `features/account_sheet/account_sheet.dart`, `features/notifications/logic/{pre_prompt_policy,pre_prompt_variants}.dart`, `core/models/{rhythm,attempt}.dart`, `core/motion/motion_tokens.g.dart`, `core/mascot/{mobi_acts,mobi_moments}.dart`, `core/settings/theme_cross_fade.dart`.
- Goldens: `test/golden/you/goldens/hub_night.png`, `hub_full_page_night.png`, `account_sheet/goldens/account_sheet_day.png`, `rhythm/goldens/milestones_list_night.png`.
- The owner's capture `scratchpad/dev/now1.png` (16 Oct 10:33, Day, Today). `v10-launch.png` and `v10-now.png` are not in that folder, so they were not seen.
- Research brain: `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (cited as R1 to R40) and `source-ledger/EVIDENCE_INDEX.csv` (T001 to T009, S010 to S018).
- Owner standing taste (memory): premium like HIGH, Revolut and Fampay with Duolingo-level character; Mobi at most once per screen and only at a real moment; never simplify by cutting; one primary action per screen; real numbers with denominators; Night and Day parity; 48 dp targets; plain copy.

Skills applied: ui-ux-standards (digest and done check), impeccable (Operate mode: scanability over expression), emil-design-eng (motion decisions). frontend-design, high-end-visual-design, redesign-existing-projects and design-taste-frontend were not loaded in this session. Their web defaults (gradients, glass, card grids) are overridden here by the owner's standards and R26 and R33 anyway.

---

## 0. The student, the job, the success test

**Who.** A Class 12 Commerce student on a 360 to 412 dp Android phone, studying late, often in the dark. They open You about once a week, usually right after a good or bad paper, to see whether their study is adding up.

**The job of You.** "Is my study going somewhere?" They want to see this week's study days against their goal, what they have earned, their best work, and a way to change their subjects.

**The job of the account sheet.** "Who am I signed in as, what do I have left, and where are the settings?" They want name and email, both credit balances, the theme switch and the settings rows, from any tab, in one tap.

**Success, measured on the emulator:**
1. At 360x800 the first screen of You shows study content only: the header, this week as "N of G study days", and the top of Badges. No plan, appearance or account content sits above study (L17).
2. At least 14 badges always show (16 once the server lists the two new ids). Each one is earned with a date, or "Not yet" with the exact condition. No guessed progress (L18).
3. While notifications are off, an invitation is visible on You and in the sheet, and it changes its wording each time it returns. It is never shown inside a paper (L19).
4. From any of the five tab roots, avatar, then theme: the theme switch is visible without scrolling and recolours the app in 250 ms (L20).
5. Subjects can be edited from You in 2 taps (L21).

---

## 1. Decisions at a glance

| # | Decision | Ledger | Evidence |
|---|---|---|---|
| Y1 | **You's order:** header, jump chips, This week, Badges, Personal bests, Across your mocks, My subjects (with an Aim row), then one Plan and credits row. Nothing is cut; section 10 lists every move. | L17 | R8, R10, S014 |
| Y2 | **Badges replace the 3-token shelf.** 16 badges on 4 paths. 9 come from the server's existing milestones, 5 are worked out on the phone from the complete attempts list, and 2 are new server ids that show only once the server lists them. Every badge is either earned with its date or "Not yet" with its exact condition. Progress is shown only where the phone holds a complete count. | L18 | R5, R9, R17, R29, T002 |
| Y3 | **Locked badges have no padlock.** A padlock reads as "pay to unlock" in an app with a Pro plan. "Not yet" is a faint coin, its engraving in ink, and the condition in words. | L18 | T005, R22 |
| Y4 | **Three personal bests:** best mock (marks out of the paper's total), longest run of weeks at your goal, and fastest right answer (seconds, with subject and date). Each comes from real records and has an honest empty state. | L18 | R9, R29 |
| Y5 | **The notifications invitation** is a strip on You under This week, and an "Off" row with a **Turn on** key in the sheet. The strip comes back after "Not now" on the existing gaps (2, 4, 7, then every 10 days). Each return uses the next of the six existing wordings. It never shows during a paper and never on the same day as the post-result sheet. | L19 | R22, T005, R14 |
| Y6 | **The sheet is the account:** identity, credits, the theme switch with the look row under it, then Name and sign-in, Notifications, Privacy, Help, Write to us, Sign out. Study days leaves the sheet (IA D5). | L16, L20 | R11, S016 |
| Y7 | **Subjects are edited from You** (the My subjects section's Edit, or any tile) and from Practice. Saving updates Practice, Today and You together, only after the server confirms. | L21 | R17, T002 |
| Y8 | **Mobi on You:** one Mobi, in the header, reading the real week once a day. He plays `proud` on the first visit after a badge lands. The badge sheet, the bests page and the account sheet have no full Mobi; the sheet keeps the 16 dp mark in the AI credits tile. | L35 | R31, S017 |

---

## 2. Screen A: the You tab (`/you`, shell branch 4)

### A.1 Job and primary action

**Job:** show how the student's study is going this week and over the season.

**Primary action:** none, by IA decision. You is a record to read; each block opens its own detail page. The one volt key that may appear is **Turn on** in the invitation strip, and only while reminders are off. It is a secondary action styled as a small volt pill, never a full-width key, so the screen still has no dominant call to action.

### A.2 Sections, top to bottom, with exact copy

All blocks sit on the 16 dp gutter (`MmSpace.gutter`). Sections are separated by `_HubSection` (32 dp of air, a hairline, 16 dp, the title in Bricolage 24, 12 dp). This is the existing rhythm from SPACING.md 3.1.

**1. Header (`TabRootHeader`)**
- Leading: the avatar (`AccountAvatar`, 40 dp disc in a 48 dp target). It opens the account sheet, the same as on the other four tab roots (IA D5; Shell owns the header).
- Title: `You`.
- Trailing: `PillKey` labelled **Edit** (TalkBack: "Edit your CUET plan"). It opens `/you/sheet`. The label is now always the short "Edit", so the 1.3x font branch is no longer needed.

**2. Hero (reworked `SheetCard`, called `YouHero` from here on)**
- Eyebrow, `type.small`, ink2: **CUET UG 2027, Commerce**. Built from the student target (year and stream). With no stream it reads "CUET UG 2027".
- Name at display size (Bricolage 40/44, tight), followed by the pencil key that opens the name sheet. With no name the line reads **Add your name** in ink2, with the pencil.
- Mobi, 72 dp, top right in the lamp light (`HubMobi`, section A.7).
- **Removed from the hero:** the email (it lives in the sheet), the course and colleges fields (they move to the Colleges tab, with an Aim row on You), and the subjects field (it moves to section 7).

**3. Jump chips (`_ChipsHeader`, pinned, 56 dp)**
- Labels: **Week**, **Badges**, **Bests**, **Mocks**, **Subjects**. TalkBack: "Jump to a section".
- They replace Plan, Look, Study, Alerts and Colleges. The tracking and jump logic stays as built.

**4. This week**
- Section title: **This week**. Trailing quiet key: **See rhythm**, which opens `/you/rhythm`.
- Row: the `WeekDial` (112 dp) on the left. On the right, a headline and a note:
  - Dial (L06 fix, part 2): `showWords: true`. The big numeral is the days studied this week. Under it, inside the ring, the words **of 4 study days**. The segments still number the goal. The numeral and the words are one Semantics node: "3 of 4 study days this week".
  - Headline (`type.title`), from the real week:
    - goal reached: **Goal reached this week**
    - 1 day short: **1 more study day reaches your goal**
    - N days short with enough days left: **N more study days reach your goal**
    - not reachable this week: **N days left this week**
    - paused: **Paused until 20 October**
    - nothing studied yet: **No study days yet this week**
  - Note (`type.small`, ink2): the run line, either **2 weeks at your goal in a row** or **Best run: 5 weeks**. These are the existing `runNote` and `weeksInRhythmText` strings.
- Weekday row: the `WeekField` bubbles M T W T F S S. A done day is filled, today has a ring, planned days are marked.
- Then `StudyDaysPanel`, three rows:
  - **Weekly goal** (trailing: **4 days a week**)
  - **Planned days** (the seven marks)
  - **Pause study days** (note: **Away for a while? Your run is kept.**)

**5. Notifications invitation strip (only while reminders are off; spec in section 5)**

**6. Badges**
- Section title **Badges**. Trailing quiet key **See all 16** (or "See all 14" while the server lists 14). It opens `/you/milestones`.
- Count line (`type.small`, ink2): **6 of 16 earned**. With 0 earned: **None earned yet**.
- Coin row: five slots of equal width across the 358 dp content width (71.6 dp each).
  - Each slot holds a 52 dp `Medal` with its name under it in 12 sp, at most 2 lines, centred.
  - The slots fill with the up to 3 newest earned badges (newest first), then the "next" badges in path order, until there are 5.
  - The whole slot is the target (71.6 x 96 dp). A tap opens the badge sheet (Screen C).
- Next line, one sentence under the row (`type.body`, ink):
  - countable: **Next: 10 scored sets. 6 of 10 so far.**, with a 4 dp progress bar under it
  - not countable: **Next: First repair. Lands when you finish your first repair.**
  - the "next" badge is the first not-yet badge of the path with the most earned, so the student's own momentum leads
- Receipt line, shown once in a session after backfill (section 3.5): **5 badges added from your past papers.** (ink2, with a quiet **See them** link).

**7. Personal bests**
- Section title **Personal bests**. Trailing quiet key **See all**, which opens `/you/bests`.
- Three stat rows, value first (R9). Each is a 64 dp row with the value in Bricolage 28 tabular figures on the left and the label and context on the right:

| Value | Label | Context line |
|---|---|---|
| **142 / 250** | Best full mock | Accountancy, 12 October |
| **5 weeks** | Longest run at your goal | Now: 2 weeks |
| **9 s** | Fastest right answer | Business Studies, 14 October |

- Each row opens `/you/bests`, scrolled to that best.

**8. Across your mocks**
- The server's title (the existing `_AcrossSection`, unchanged).
- Under it, one row: **Your repair record**, which opens `/review/record` (moved here from the old Progress section).

**9. My subjects**
- Section title **My subjects**. Trailing quiet key **Edit**, which opens `/you/subjects`.
- Subject strip: one tile per subject (up to 5), each with its object art at 56 dp (`SubjectArt`, L37) and its name in 13 sp. A tap on any tile also opens `/you/subjects`.
- Aim row (`YouRow`, target icon): title **Aim**, note **B.Com (Hons), 3 colleges**. It opens `/colleges` with `goBranch(3)`. With nothing set the note reads **Choose a course and colleges**.

**10. Plan and credits**
- One `YouRow` with the wallet icon. Title: **Free plan** (or **Pro until 12 January**). Note: **24 practice credits, 18 AI credits**. It opens `/you/credits`.
- There are no tiles here, so the sheet's tiles are not repeated (L17 acceptance).
- When the credit figures have not loaded, the note reads **Credits and history**.

There is no footer. The version moves to Help (Account area).

### A.3 Wireframe at 390 dp (first screen, 390x844; the 360x800 cut is marked)

```
|<-16->|<---------------- 358 dp content ---------------->|<-16->|
+--------------------------------------------------------------+
| (A)  You                                         [ Edit ]    |  header 48
|                                                              |
|  CUET UG 2027, Commerce                          .--.        |
|  Asha Verma  /                                  (Mobi)  72   |  hero
|                                                  '--'        |
|--------------------------------------------------------------|
| (Week) (Badges) (Bests) (Mocks) (Subjects)                   |  pinned chips 56
|--------------------------------------------------------------|
|  This week                                     See rhythm    |
|   .----.                                                     |
|  /  3   \   1 more study day reaches your goal               |
| | of 4   |  2 weeks at your goal in a row                    |
|  \study /                                                    |
|   '----'                                                     |
|   M    T    W    T    F    S    S                            |
|  (o)  (o)  ( )  (o)  [ ]  ( )  ( )                           |
|  Weekly goal                          4 days a week   >      |
|  Planned days                  M T W T F S S          >      |
|  Pause study days                                     >      |
|    Away for a while? Your run is kept.                       |
|  +--------------------------------------------------------+  |
|  | Reminders are off                         [ Turn on ]  |  |  strip (only while off)
|  | One nudge on your study days. Never in a paper.        |  |
|  |                                            Not now     |  |
|  +--------------------------------------------------------+  |
- - - - - - - - - - - - - - 360x800 first screen ends near here - -
|  ---------------------------------------------------------   |
|  Badges                                        See all 16    |
|  6 of 16 earned                                              |
|   (##)     (##)     (##)     (::)     (::)                   |
|  First    Clean    First     10      First                   |
|  full     set      repair   scored   week at                 |
|  mock                        sets    your goal               |
|  Next: 10 scored sets. 6 of 10 so far.                       |
|  [=============-----------]                                  |
+--------------------------------------------------------------+
|   Today   Practice  [Start]   Review   Colleges    You       |  bar 64
+--------------------------------------------------------------+
```
`(##)` is an earned brass coin. `(::)` is a not-yet coin.

### A.4 Wireframe at 390 dp (lower half)

```
|  ---------------------------------------------------------   |
|  Personal bests                                   See all    |
|  142 / 250   Best full mock                                  |
|              Accountancy, 12 October                    >    |
|  5 weeks     Longest run at your goal                        |
|              Now: 2 weeks                               >    |
|  9 s         Fastest right answer                            |
|              Business Studies, 14 October               >    |
|  ---------------------------------------------------------   |
|  Across your mocks            (server title)                 |
|  ...server block...                                          |
|  Your repair record                                     >    |
|  ---------------------------------------------------------   |
|  My subjects                                        Edit     |
|  [obj]     [obj]     [obj]     [obj]                         |
|  English   Accoun-   Business  Economics                     |
|            tancy     Studies                                 |
|  (o) Aim   B.Com (Hons), 3 colleges                     >    |
|  ---------------------------------------------------------   |
|  [w] Free plan                                               |
|      24 practice credits, 18 AI credits                 >    |
|                                                              |
|  (32 dp air + bar clearance)                                 |
```

### A.5 States

| State | What shows |
|---|---|
| **Loading (first open, nothing cached)** | The header and the hero name show at once (from auth). Mobi plays `loading`. This week: the existing `WeekSkeleton`. Badges: five ghost coins (0.24 opacity) with 2 skeleton lines under them. Bests: three skeleton rows (`Skeleton.line` 64 x 24 and 160 x 14). Across: the existing skeleton. Subjects come from auth or the target, so they never skeleton. Nothing jumps when data lands: every skeleton has the final height. |
| **Empty (account B, no papers)** | This week: **0 of 4 study days** and **No study days yet this week**; note **A study day is any day you finish a practice, a mock or a repair.** Badges: **None earned yet**, five not-yet coins (the first five in path order), next line **Next: First scored set. Lands when a set with 5 or more answers is scored.**, and a quiet key **Start a quick practice** that opens the Start sheet. Bests: one line **Your bests show after your first scored set.** and no rows. Across: the server's own sentence before the first timed mock. |
| **Sparse (one paper)** | Bests show only the rows they have. Best full mock: if the only paper is a set, the row reads **Best set: 38 / 50**, Accountancy quick practice, date. Longest run: **0 weeks**, context **Your first week at your goal starts the count**. Fastest right answer: shown only if a right answer has a timing. A row with nothing true to say is left off, never filled with a zero that means unknown. |
| **Error (a read failed, nothing cached)** | One retry per block, in the existing quiet pattern, so the page reads as one problem: the This week block shows the one pill **Try again** (`SheetWeek.failed`). Badges and Bests show **Could not load your badges.** or **Could not load your bests.** with a quiet **Try again**. A failed block keeps its height (no collapse) to avoid a layout jump. |
| **Offline (cached data)** | Under the hero, one `InlineBanner` (info tone): **Offline. Showing what was saved on this phone at 9:14 PM.** (the cache time, 12-hour). Everything renders from cache. Taps on Edit, subjects and the Turn on key still open their screens; those screens explain their own offline rules. |
| **Success (a badge landed since the last visit)** | The new coin sits in the first slot. It plays the landing (A.6). Mobi plays `proud` with the line **First full mock landed.** Only the newest new badge plays; others are already settled. |
| **Return (Back from a detail page)** | The scroll position is kept (`PageStorageKey('you-hub')`). The lit chip matches the section under the chips. The badges page shrinks back into the coin row (container transform, existing C4). |
| **Rhythm off (student hid study days)** | The This week block is replaced by one row, **Study days are off**, with the note **Turn them on to see your week here.** It opens `/you/rhythm`. Badges on the rhythm path still show. |
| **Signed out** | You is not reachable (the router redirect). Nothing to design. |

### A.6 Motion (each answers an action or shows state; tokens from `motion_tokens.g.dart`)

| What | Values | What it answers |
|---|---|---|
| Page entrance | Existing `MmStagger` route driver: step 45 ms, cap `staggerCap`, rise `enterRise`, 360 ms on `out` (0.23, 1, 0.32, 1). It runs on the first open of the tab in an app run only. A returning tab switch uses the 180 ms tab cross-fade and no stagger. | Where the blocks came from. Seen weekly, so it may be felt; never on every switch (emil: frequent means less motion). |
| Week dial on first view of the day | The ring segments draw in with `sweep` 700 ms on `sweep` (0.45, 0, 0.55, 1). The numeral rolls up with `numberRoll` 500 ms. It plays once per day, keyed by the date. | How much of the goal is done. |
| Coin press | Scale 0.96 over `press` 100 ms; release on `Springs.release`; selection haptic. | The tap was heard. |
| Coin to badge sheet | The coin flies into the sheet's 96 dp medal (`MmFlight`, `emphasized` 420 ms, arc at most 18 dp) while the sheet rises (`sheetIn` 420 ms). Close reverses in 340 ms. | Which badge this sheet is about (spatial continuity). |
| Badge landing (once per badge id, ever) | The coin settles from 0.92 on `Springs.celebrate`, and one light band crosses it in `milestone` 500 ms (the existing `Medal.animateLanding`). The name fades in after 120 ms. Celebrations Quiet: settle only, no light band. Off: drawn settled. | Something new was earned. This is the screen's one light event (T3). |
| Next-line progress bar | It fills from 0 to its value with `countUp` 720 ms on `out`, first view only. | How far along the next badge is. |
| Bests values | Figures roll with `numberRoll` 500 ms on first view of the day. Afterwards they are static. | Not decoration: it marks the numbers as live. |
| Jump chips | Scroll to the section: 420 ms on `glide`. Reduced motion jumps. | Where the section is. |
| Invitation strip | Enters with a size ease and fade, `card` 240 ms on `out`. It leaves (Not now, or reminders turned on) with a `SizeEase` collapse of 240 ms. On success it first shows the line "Reminders are on. Next: Tue 8:30 PM" for 2.4 s, then collapses. | The state changed. |
| Reduced motion (Android "Remove animations") | Every item above becomes a 120 ms `reducedFade` or nothing. Coins are drawn settled. The dial is drawn full. There is no flight; the sheet cross-fades. | |

Nothing on You loops. Nothing animates while it is off screen. Painters sit on `RepaintBoundary`.

### A.7 Mobi on You (L35)

One Mobi, 72 dp, in the hero's top right. He uses the existing `HubMobiReading` (`hub_mobi.dart`) once a day, with these acts (MobiEvent and acts from `mobi_moments.dart` and `mobi_acts.dart`):

| Real moment | Act | Line (typed in after the act lands; null is silent) |
|---|---|---|
| First You visit of the day, week ordinary | `hello` (wave) | none |
| Goal reached this week | `proud` (`MobiEvent.goalMet`) | **4 of 4 this week.** |
| 1 day short and days remain | `nudge` | **One more day gets you there.** |
| A badge landed since the last visit | `proud` (`MobiEvent.milestone`) | **First full mock landed.** (the badge's name) |
| After 11 PM | `sleepy` (`MobiEvent.lateNight`) | none |
| Data still loading | `loading` | none |
| A read failed | `oops` (`MobiEvent.setback`) | none |
| Any other visit that day | `idle` | none |

- Tapping Mobi plays the existing tap cycle.
- The badge moment wins over the week reading on the same visit, so he speaks once.
- Celebrations Off: idle only and no line.

### A.8 Night and Day

- Every colour comes from `context.mmColors`. There is no new colour.
- The brass coins are physical colours, identical in both themes (the `medal.dart` rule). Only the contact shadow changes: black 24% on Night, warm ink 12% on Day.
- A not-yet coin's ring and engraving use `ink3` on Night and `ink2` on Day. That keeps the 3:1 non-text contrast on the Day ground.
- The invitation strip is a flat `surface1` panel with a 1 dp `line` border. No glass, so Day has no grey wash (R26).
- The lamp `LightField` behind the hero stays at strength 0.9 Night and 0.5 Day (as today).

### A.9 Accessibility

- Every target is at least 48 dp: coin slots 71.6 x 96, rows 56 to 64, the chips 48.
- Focus order: avatar, Edit, Mobi (label "Mobi"), chips, then the sections in reading order.
- The dial is one node: "3 of 4 study days this week. 1 more study day reaches your goal."
- A coin's label: "First full mock, earned 6 September" or "Clean set, not yet. Every answer right in a scored set of 10 or more questions."
- At 1.3x font: the coin names wrap to 2 lines and then scale down (`FittedBox`, minimum 0.85). The bests value column grows; the label column wraps. The chips scroll horizontally (`ChipRail`, existing).
- Colour is never the only signal: earned versus not yet is also said in words in the sheet and in the semantics.

---

## 3. Badges (L18): the set, the rules, the data

### 3.1 Rules

1. **A badge is a fact.** It is earned only when a record proves it, and it shows the date of that record. The phone never estimates.
2. **Three sources:**
   - **S**, the server's milestone list (`GET /api/me/rhythm` `milestones[]`, existing ids)
   - **D**, worked out on the phone from the complete attempts list (`GET /api/attempts`, which is a full dump, as `milestone_progress.dart` already relies on), using server-scored attempts only (`selectionMeta.isServerScored`), each dated by that attempt's `completedAt`
   - **N**, a new server id that the app shows **only once the server's list contains that id**, earned or not, so it is never shown as falsely locked

   Where an id exists in both S and D, the server's date wins.
3. **Earned never un-earns.** D badges use thresholds that only grow, such as "4 different subjects", never "every subject on your sheet". An editable list could otherwise take a badge back.
4. **Progress only where it can be counted exactly:** the existing `milestoneProgress` (sessions_10, weeks_met_4) plus the new D counts (full_mocks_5, four_subjects). Repairs are never counted on the phone, because some repairs happen on the website.
5. **Not yet** shows the condition, not a lock. There is no "Pro" link anywhere near badges, and badges never use credits (T005, R22).
6. **One celebration per badge id, ever** (`CelebrationController`, kind `milestone`, stable id `badge:<id>`). It shows in the result scope after a paper (`CelebrationScope.result`), or as the You landing. It never shows inside a running paper or NTA mode.

### 3.2 The 16 badges

Paths are in shelf order. The glyph is the `Medal` engraving: a Lucide icon or numeral text.

| # | Id | Name | Earned when (condition copy, exact) | Src | Date | Glyph | Progress |
|---|---|---|---|---|---|---|---|
| **Papers** |
| 1 | `first_scored_session` | First scored set | Lands when a set with 5 or more answers is scored. | S | server | `1` | none |
| 2 | `first_full_mock` | First full mock | Lands when a 50-question full mock is scored. | S | server | `fileText` | none |
| 3 | `first_nta` | Exam-day rehearsal | Lands when you finish a paper in NTA mode. | D | that attempt | `monitor` | none |
| 4 | `sessions_10` | 10 scored sets | Lands with your 10th scored set of 5 or more answers. | S | server | `10` | yes, "6 of 10 so far" |
| 5 | `full_mocks_5` | 5 full mocks | Lands with your 5th scored full mock or NTA paper. | D | the 5th attempt | `5` | yes, "3 of 5 so far" |
| **Repairs** |
| 6 | `first_repair` | First repair | Lands when you finish your first repair. | S | server | `check` | none |
| 7 | `repairs_5` | 5 repairs | Lands with your 5th finished repair. | S | server | `5` | none (website repairs) |
| 8 | `repairs_10` | 10 repairs | Lands with your 10th finished repair. | S | server | `10` | none |
| 9 | `repairs_25` | 25 repairs | Lands with your 25th finished repair. | S | server | `25` | none |
| 10 | `first_hold` | It held | Lands when a mistake you repaired is answered right on a fresh question. | N | server | `shieldCheck` | none |
| **Weeks at your goal** |
| 11 | `first_week_met` | First week at your goal | Lands when a week reaches your goal. | S | server | `calendarCheck` | none |
| 12 | `weeks_met_4` | 4 weeks at your goal | Lands when a fourth week reaches its goal. They need not be in a row. | S | server | `4` | yes, existing |
| 13 | `run_weeks_3` | 3 weeks in a row | Lands when 3 weeks in a row reach your goal. | N | server | `repeat` | none |
| **Your best work** |
| 14 | `clean_set` | Clean set | Lands when every answer is right in a scored set of 10 or more questions. | D | that attempt | `circleCheckBig` | none |
| 15 | `four_subjects` | Four subjects | Lands when you have a scored set in 4 different subjects. | D | the attempt that made 4 | `layoutGrid` | yes, "2 of 4 subjects" |
| 16 | `new_best` | New best | Lands when you beat your own marks on the same kind of mock. | D | the beating attempt | `trendingUp` | none |

How the D badges are computed (a pure function, `deriveBadges(List<Attempt>)`, unit-tested):
- **`first_nta`:** the earliest attempt with `selectionMeta.mode == 'nta'`.
- **`full_mocks_5`:** sort attempts with mode `full` or `nta` by `completedAt`; take the 5th.
- **`clean_set`:** the earliest attempt with `total >= 10 && correct == total`.
- **`four_subjects`:** walk attempts oldest first, collecting distinct `subject`; take the attempt where the count reaches 4.
- **`new_best`:** group by `formatId` (non-empty only), oldest first, and track the running best of `correct*5 - wrong`. Take the earliest attempt that is strictly above an earlier attempt of the same format.

The badge sheet shows that attempt: "From your Accountancy full mock, 12 October: 152 of 250 (before: 142)".

### 3.3 Screen B: Badges page (`/you/milestones`, existing route, title changes)

**Job:** see every badge, what each needs, and the next one to go for.

**Primary action:** none on the page. Each not-yet badge's sheet carries its own action.

Sections, top to bottom:
1. App bar: back arrow, title **Badges**.
2. Summary (existing hero): numeral **6** in Bricolage 56 tabular, then **of 16 earned** in Bricolage 24 ink2. Under it, the strip of 16 small 20 dp coins (`Medal.plain`), grouped by path with 8 dp gaps. This replaces the "4 of 9 landed" hero and its 9 coins.
3. Four path sections. Each is the existing `MilestoneTrackCard` rail, extended to these paths:
   - **Papers** (5 steps), with **See your papers** opening `/review`
   - **Repairs** (5, or 4 until the server lists `first_hold`), with **See your repair record** opening `/review/record`
   - **Weeks at your goal** (3, or 2 until the server lists `run_weeks_3`), with **See your rhythm** opening `/you/rhythm`
   - **Your best work** (3), with **See your bests** opening `/you/bests`

   Each section has a header (44 dp brass token for the path, the path name, "2 of 5 earned"), then a rail of steps. Each step has a 44 dp medal, its name, and the date or the condition. The next step on each path is in full ink with a progress bar where countable; later steps are faint.
4. "Your best work" is not a sequence. Its three badges have no rail line between them, each shows its own condition, and none is labelled "next".
5. A step row is a 56 dp or taller target that opens the badge sheet.

Path token art:
- Papers: `MmArt.tokenFirstMock`
- Repairs: `MmArt.tokenFirstRepair`
- Weeks: `MmArt.tokenHeld`
- Your best work: a new **`token-best`** object (`obj` style brass, star-in-laurel). This is a request to Mobi and motion and art (section 12). Until it ships, use a `Medal` with `trendingUp` at 44 dp.

States:
- **Loading:** the existing skeleton.
- **Empty:** "0 of 16 earned", every rail visible with the first step of each path as next. The page line under the summary reads **Each badge is earned by something you do. Start with a scored set.**, with a quiet key **Start a quick practice**.
- **Complete:** the existing `trackComplete` line per path.
- **Error:** the existing error line with **Try again**.
- **Offline:** cached, with the same offline banner as You.
- **Just landed:** the existing landing moment (T3), with Mobi on the page once (existing).

Motion: as built (container transform from the You coin row, the landing ceremony). Rows stagger at 45 ms.

Wireframe at 390 dp:
```
+--------------------------------------------------------------+
|  <-  Badges                                                  |
|                                                              |
|  6  of 16 earned                                             |
|  (#)(#)( )(#)( )   (#)( )( )( )( )   (#)( )( )   (#)( )( )   |
|  ---------------------------------------------------------   |
|  [token] Papers                                              |
|          2 of 5 earned                                       |
|   (1)--  First scored set                                    |
|    |     1 September                                         |
|   (#)--  First full mock                                     |
|    |     6 September                                         |
|   (10)   10 scored sets                                      |
|    :     Lands with your 10th scored set of 5 or more        |
|    :     answers.                                            |
|    :     [==============--------]          6 of 10 so far    |
|   ( )    Exam-day rehearsal, after that                      |
|   ( )    5 full mocks, after that                            |
|  See your papers  >                                          |
|  ---------------------------------------------------------   |
|  [token] Repairs ...                                         |
```

### 3.4 Screen C: Badge sheet (`showMmSheet`, from any coin or step)

**Job:** what this badge means, when it was earned, or what earns it.

**Primary action:**
- **Not yet:** one key for the action that earns it, from the existing `stepAction*` words plus new ones:
  - papers: **Start a quick practice** (first set, 10 sets), **Start a full mock** (full mock, 5 full mocks), **Open NTA mode** (rehearsal)
  - repairs: **Open your mistakes**
  - weeks: **See your week**
  - clean set, four subjects: **Start a quick practice**
  - new best: **Start a full mock**
- **Earned:** **Done** (closes the sheet). When the source is a paper, a quiet link **Open that paper** goes to `/result/:attemptId`.

Layout, top to bottom:
1. Grab handle.
2. Medal at 96 dp, centred, with its landing played only if it is the fresh one.
3. Name, Bricolage 28, centred.
4. State line, centred, `type.small`: **Earned on 12 October** in ink (with a 12 dp brass dot), or **Not yet** in ink2.
5. Condition (`type.body`): the condition copy from 3.2.
6. Record line (earned D badges and server badges that have a source): **From your Accountancy full mock, 12 October: 152 of 250 (before: 142).** Server badges with no source say only the date.
7. Progress (not yet, countable): bar plus **6 of 10 so far**.
8. Path line (ink2): **Papers, step 3 of 5. Comes after First full mock.** (the existing `stepAfter`)
9. The key (full width, volt for not yet; quiet for Done).

No Mobi (the medal is the object; one per screen).

Back or a drag down closes. Opening another badge from the sheet is not possible: one sheet, no stacking.

Wireframe:
```
+--------------------------------------------------------------+
|                        ------                                |
|                       .------.                               |
|                      /  ( 10 ) \       96 dp medal            |
|                      \        /                              |
|                       '------'                               |
|                    10 scored sets                            |
|                       Not yet                                |
|  Lands with your 10th scored set of 5 or more answers.       |
|  [==================--------------]          6 of 10 so far  |
|  Papers, step 3 of 5. Comes after First full mock.           |
|  +--------------------------------------------------------+  |
|  |               Start a quick practice                   |  |
|  +--------------------------------------------------------+  |
+--------------------------------------------------------------+
```

### 3.5 Backfill (shipping to students who already did the work)

- On the first computation after this ships, every D badge already earned is marked seen in the celebration store **without** playing, so no one sees five ceremonies at once.
- You shows the one receipt line: **5 badges added from your past papers.** (the count is the real number), once, with **See them**.
- This uses the existing `CelebrationKind.milestoneReceipt` pattern.

### 3.6 Personal bests (`/you/bests`, existing route, extended)

**Job:** see my best work with its date and how far it is from now.

Sections, top to bottom:
1. App bar: **Personal bests**.
2. **Best mock** (existing `_BestHero` and `BestsList`, unchanged). This is marks out of the paper's total per comparable mock type, best and latest bars. With no mock but with sets, the hero shows the best set instead (same component, set formats).
3. **Longest run at your goal** (new block):
   - value **5 weeks** (hero figure)
   - context **Now: 2 weeks in a row. Goal: 4 study days a week.**
   - When the server sends `bestRunEndedWeek` (request in section 12), add **Ended the week of 21 September**. Until then no date is shown and no date is made up.
   - Source: `rhythm.bestRun`, `rhythm.weeksMetStreak`, `rhythm.daysGoal`.
4. **Fastest right answer** (new block):
   - value **9 s**
   - context **Business Studies, question 14, 14 October**, with a link **Open that question** to `/result/:attemptId` scrolled to the question
   - footnote, ink2: **Answers under 3 seconds are not counted.**
   - Source: the minimum `details[].timeMs` with `isCorrect == true` and `timeMs >= 3000`, over server-scored attempts whose `recovery.isUsable` is true, or whose `selectionMeta.recovery` is null (older papers keep their timing).
   - If no attempt carries timings, the block reads **No timed answers yet. Timings are kept from your next paper.**
   - If the attempts list rows do not carry `details` (to be confirmed by the builder against a live `/api/attempts` body: the parser reads it, the payload is unconfirmed), compute from cached attempt details only and say **From the papers opened on this phone.** This is an honest limit, never a guess.

Empty state (no scored attempts):
- the existing `bests_empty` page
- **Your bests show after your first scored set.**
- the key **Start a quick practice**

Motion:
- values roll on first view (500 ms)
- bars grow with `countUp` 720 ms on `out`
- reduced motion: static

No Mobi.

---

## 4. Screen D: the account sheet (avatar on all five tab roots) (L16, L20)

**Job:** who is signed in, what is left, and where the settings are.

**Primary action:** none dominant. The sheet is a menu. The volt **Turn on** key appears only while notifications are off.

Sections, top to bottom (the sheet keeps its existing structure; the changes are marked **new** or **moved**):
1. Grab handle.
2. Identity (`_Identity`, unchanged): 56 dp avatar disc, the name (`type.title`, 1 line), the email (`type.small` ink2), and the plan tag (**Free**, or **Pro** with **until 12 Jan** under it).
3. Caption **Credits**, then `CreditTiles` (unchanged):
   - **Practice credits 24**, "For mocks and practice sets"
   - **AI credits 18**, "For Ask Mobi and repair explanations", "Renews 1 November", with the 16 dp Mobi mark
   - each tile opens `/you/credits`
4. Caption **Appearance**, then `ThemeSwitch` (Night, Day, Match phone; unchanged). **New:** directly under it, a flat `YouRow`, **Glass, touch and celebrations**, with the note **How MockMob looks and feels on this phone**. It opens `/you/appearance` (moved from You).
5. Rows (`YouPanel` flat):
   - **Name, sign-in and plan**, opening `/you/account`
   - **Notifications**:
     - while off, the trailing area shows **Off** in ink2 and a volt 36 dp-high pill **Turn on** (its target is padded to 48 dp)
     - while on, the note reads **Next: Tue 8:30 PM** (from `nextReminderProvider`)
     - while blocked by Android, the note reads **Blocked in Android settings** and the pill reads **Open settings**
     - the row itself opens `/you/notifications`
   - **Privacy**, opening `/you/privacy`
   - **Help and about**, opening `/you/help` (which now holds the 4 FAQs and the version)
   - **Write to us** (note: the address; external)
   - **Study days is removed** (moved to You, IA D5)
6. **Sign out** (`SignOutKey`, which asks to confirm).

Wireframe at 390 dp (390x844; the sheet opens to its content height, at most 92% of the screen, and scrolls inside):
```
+--------------------------------------------------------------+
|                         ------                               |
|  (A)   Asha Verma                               [ Free ]     |
|        asha.verma@gmail.com                                  |
|                                                              |
|  Credits                                                     |
|  Practice credits     >   |  AI credits          (m)   >     |
|  24                       |  18                              |
|  For mocks and practice   |  For Ask Mobi and repair         |
|  sets                     |  explanations                    |
|                           |  Renews 1 November               |
|  Appearance                                                  |
|  ( * Night )(   Day   )( Match phone )                       |
|  [*] Glass, touch and celebrations                     >     |
|      How MockMob looks and feels on this phone               |
|  ---------------------------------------------------------   |
|  [u] Name, sign-in and plan                            >     |
|  [b] Notifications                Off   [ Turn on ]          |
|  [s] Privacy                                           >     |
|  [h] Help and about                                    >     |
|  [m] Write to us        support@mockmob.in             ^     |
|                                                              |
|  [               Sign out                ]                   |
+--------------------------------------------------------------+
```
At 360x800 the theme switch sits at about y 470 of the sheet, so it is visible without scrolling (L20).

States:
- **Credits loading:** the tiles show skeleton figures (existing `account_credits_unloaded`).
- **Credits error:** the tiles show **Not loaded** with a quiet **Try again**.
- **Offline:** the identity and switch work. The credits show cached figures with **Saved 9:14 PM** under them. The rows still open.
- **No name:** the email becomes the title line (existing).
- **Pro:** the tag reads **Pro**, with **until 12 Jan** under it.
- **Notifications row**, depending on state: off / on / blocked (above).
- **Return:** a row closes the sheet and pushes its page. Back returns to the same tab, and the sheet does not reopen (existing `_open`).

Interactions:
- drag down to close (existing `MmSheet`)
- Back closes the sheet first (L04 rule)
- the theme switch changes the theme at once (section 6)

Motion:
- the sheet rises with `sheetIn` 420 ms on `emphasized` and leaves in 240 ms
- rows: the existing `YouIconMotion` glyph reactions on press (hop, swing, tick, turn), 220 ms
- the Turn on pill: press scale 0.96 over 100 ms
- reduced motion: fade only

Mobi: only the 16 dp mark in the AI credits tile (IA section 3). No character.

Night and Day: the sheet ground is `surface1`; the hairlines are `line`; the plan tag outline is `line2`. The golden `account_sheet_day.png` already shows Day parity; keep it.

Accessibility:
- the sheet scopes the route ("Account")
- the Notifications row has two targets: the row, and the pill labelled "Turn on reminders"
- they never overlap; the pill sits outside the row's chevron area, and the row shows no chevron while the pill is visible

---

## 5. The notifications invitation (L19)

### 5.1 Where and when

| Place | Shows when | Can be dismissed | Comes back |
|---|---|---|---|
| **You strip** (under This week) | permission is not `granted`, or the app's reminders setting is off; the student is signed in; rhythm is visible | **Not now** | after 2, 4, 7, then every 10 days (`prePromptGapAfter`, with its own counter `youInviteAsks`) |
| **Sheet row** (Notifications) | the same | no (it is a settings row, so it simply states the setting) | always visible while off |
| **Post-result sheet** (existing `reminders_prompt_sheet.dart`) | `shouldOfferPrePrompt` with `PrePromptMoment.afterResult` | Not now | existing gaps |

Rules:
- **Never on the same calendar day as the post-result sheet.** Whichever asked today blocks the other until tomorrow. Shared key: `lastAnyInviteDay`.
- **Never in a paper.** The strip lives only on You, and the runner and NTA screens never host it (`PrePromptMoment.inSession` and `ntaMode` stay false).
- **No shame or loss framing** (T005, R22). "Not now" is a plain text key of the same weight as body text. There is no "No, I don't care about my marks".

### 5.2 Wording (the six existing variants, rotated; one per return)

The strip uses `prePromptVariantFor(youInviteAsks, studyTime:)` titles and lines. These are the existing `NotificationsCopy` strings, so the strip and the sheet speak with one voice. The first strip (ask 0) reads:
- Title: **Reminders are off**
- Line: **One nudge on your study days. Never in a paper.**

Later returns rotate through the study-time, repair, result-ready, weekly and optional wordings. The study-time wording names the student's real study time when it has one (`promptStudyLineAt('8:30 PM')`).

### 5.3 The key

| Permission state | Key label | Tap does |
|---|---|---|
| `notAsked` | **Turn on** | Android's own permission question. On allow: the reminders setting turns on with the student's study time (or the scheduler's existing default) and the scheduler runs. |
| `granted` but the app setting is off | **Turn on** | Turns the setting on. No system dialog. |
| `denied` (Android stopped asking) | **Open settings** | Opens MockMob's notification page in Android settings (`system_settings.dart`). The line reads **Android is blocking MockMob's notifications. Turn them on in Settings.** |
| `unavailable` | the strip is never shown | |

### 5.4 Strip states

- **Asking:** the key shows a 16 dp spinner, and the line stays.
- **Allowed:** the strip text cross-fades (200 ms) to **Reminders are on. Next: Tue 8:30 PM.** with a check glyph. After 2.4 s the strip collapses (240 ms). The sheet row now shows the next time.
- **Refused:** the strip stays with **Android said no. You can turn them on in Settings later.** and the key becomes **Open settings**. It counts as an ask (the gap starts).
- **Return from Android settings:** on app resume (`AppLifecycleState.resumed`) the app re-reads the permission. If it is granted, the strip goes to Allowed.
- **Offline:** works as normal (permission is local; the next reminder time is computed on the phone).

Strip wireframe at 390 dp (358 dp panel, 16 dp padding, radius `MmRadius.medium`):
```
|  +--------------------------------------------------------+  |
|  | [bell]  Reminders are off                  [ Turn on ] |  |
|  |         One nudge on your study days. Never in a       |  |
|  |         paper.                                         |  |
|  |                                             Not now    |  |
|  +--------------------------------------------------------+  |
```

No Mobi in the strip (he is already in the header).

The bell glyph plays the existing `YouIconMotion.swing` once when the strip first enters, and not on later visits that day.

---

## 6. Theme and settings (L20)

- **One switch, two homes,** and they are the same widget (`ThemeSwitch`): the sheet (primary, from any tab), and `/you/appearance` (which also holds glass, touch feedback and celebrations).
- The **Appearance block leaves the You tab** (IA D4). That removes the duplicate the owner saw above the study content.
- **Switching:** the theme changes at once with the existing `ThemeCrossFade` (snapshot fade of 250 ms on `glide`; instant under reduced motion). The switch's thumb slides on `Springs.toggle`. The choice persists (existing appearance settings) and survives a restart.
- The bar, the sheet itself, and any open page recolour together, because the whole app frame cross-fades.
- **Match phone** follows Android's dark setting live, while the app is open.

---

## 7. Screen E: Edit subjects (`/you/subjects`, existing) (L21)

**Job:** change which CUET subjects the student is preparing.

**Primary action:** **Save subjects** (volt, full width, pinned above the bar's clearance). It is disabled until something changes.

Reached from:
- You, My subjects, **Edit** (2 taps from a cold start: the You tab, then Edit)
- any subject tile on You
- Practice, **Edit subjects** (existing)

Sections, top to bottom (existing screen; changes noted):
1. App bar: back, **My subjects**.
2. Line: **Pick up to 5. Your practice, Today and You follow these.**
3. **Your subjects**, in a reorderable list (`subject_rows.dart`). Each row has 56 dp subject art (L37), the name, and a remove key (x, 48 dp) labelled "Remove Accountancy". Long-press and drag to reorder. The first is the default on Practice.
4. **Add a subject:** the catalog rows not chosen, each with **Add**. At 5 chosen, the add keys go quiet and the existing cap line (`EditCopy.subjectsCap`) shows, with its shake and Mobi `refused`.
5. The pinned **Save subjects** key.

States:
- **Saving:** a spinner in the key.
- **Saved:** only after the server confirms (R17). The rows settle, and a snackbar reads **Subjects saved. Practice, Today and You now use these 4.** Back returns to You with the strip updated.
- **Error:** an inline banner **Could not save. Your subjects are unchanged.** with **Try again**. Nothing else changes in the app.
- **Offline:** the key is disabled, with the line **You're offline. Subjects save when you're back online.**
- **Leaving with unsaved changes:** Back asks once: **Leave without saving?** with **Leave** and **Keep editing**.
- **Removed the Practice default:** the next subject becomes the default. This is Practice's `default_subject.dart` (request in section 12).

Mobi: the existing cap reaction only (`refused`), one per screen.

Motion:
- a removed row folds out (existing `fold_exit` 180 + 240 ms)
- an added row slides in with `card` 240 ms on `out`
- reorder lift: scale 1.02 with a shadow, on `Springs.snappy`

Wireframe:
```
+--------------------------------------------------------------+
|  <-  My subjects                                             |
|  Pick up to 5. Your practice, Today and You follow these.    |
|  Your subjects                                               |
|  [obj] English                                 =   (x)       |
|  [obj] Accountancy                             =   (x)       |
|  [obj] Business Studies                        =   (x)       |
|  [obj] Economics                               =   (x)       |
|  Add a subject                                               |
|  [obj] Mathematics                                 [ Add ]   |
|  [obj] General Test                                [ Add ]   |
|  ...                                                         |
|  +--------------------------------------------------------+  |
|  |                    Save subjects                       |  |
|  +--------------------------------------------------------+  |
```

---

## 8. Screen F: Edit sheet (`/you/sheet`, existing, narrowed)

- It holds the stage (Class 12 or drop year, exam year) and the study length.
- Course and colleges leave it (they live in Colleges, IA 6.1). Its course field becomes a row, **Course and colleges, in Colleges**, that opens `/colleges`.
- Subjects stay as a row that opens `/you/subjects`.
- Everything else is as built.

---

## 9. Mobi, motion, spacing, subject art on these screens (L34 to L37)

| Item | On these screens |
|---|---|
| **L34 motion** | Every motion is listed per screen above with token values. Each answers an action or shows state. Nothing loops. Nothing runs in a paper. All of it has a reduced-motion path. The new motions are the coin-to-sheet flight, the next-line bar, and the strip enter, collapse and success. Everything else reuses built motion. |
| **L35 Mobi** | At most one Mobi per screen: You has 1 (header), Badges has 1 (only at a landing, existing), Badge sheet 0, Bests 0, Account sheet 0 plus the 16 dp mark, Subjects 1 (cap reaction only). Acts are listed in A.7. The new `test/unit/mascot/mobi_moments_one_per_screen_test.dart` must include `you_hub`, `badge_sheet`, `bests` and `account_sheet` frames. |
| **L36 spacing** | 16 dp gutter, the `_HubSection` rhythm (32, hairline, 16, title, 12), rows of 56 to 64 dp, coin slots of 96 dp. One radius family (`MmRadius`). No card inside a card: the strip is the only panel on You. Night and Day: tokens only; brass is physical. |
| **L37 subject art** | My subjects tiles and the Subjects screen rows use `SubjectArt` (`obj-*.webp`) at 56 dp, never cropped, with initials as the fallback. Accountancy, Computer Science, Business Studies and Languages must read as their subject at 40 dp (the regeneration request stands with Mobi and art). |

---

## 10. Moves on You (nothing is cut)

| Block today (`you_hub_screen.dart`) | New home |
|---|---|
| Edit profile pill | **Edit** pill, same place, same target |
| Hero name and pencil | Hero (kept) |
| Hero email | Account sheet identity |
| Plan, Look, Study, Alerts, Colleges chips | Week, Badges, Bests, Mocks, Subjects |
| Plan and credits tiles, See history | Sheet tiles; one row at the bottom of You opening Credits (history is there) |
| Appearance card | Sheet switch and the Glass, touch and celebrations row |
| Study days (ring, week, goal, planned, pause) | You, This week (first block) |
| Notifications panel (reminders, quiet hours) | Sheet row (with the Off state and Turn on); quiet hours stays on `/you/notifications`; plus the You strip while off |
| My subjects and colleges | Subjects: You, My subjects. Course and colleges: Colleges tab, plus the You Aim row |
| Milestones shelf (3 tokens) | Badges (16), the coin row |
| Progress: Repair record row | You, under Across your mocks |
| Progress: Personal bests row | You, Personal bests block (3 rows) |
| Across your mocks | You (kept) |
| Account and privacy panel | Sheet rows |
| CUET tools | Colleges tab (IA) |
| Help FAQ and version | `/you/help` from the sheet |
| Expired work notice | You, under the hero (kept) |

---

## 11. Emulator acceptance (per ledger item)

Setup is the ledger's: `mockmob_budget`, accounts A (2 or more finished mocks, mistakes, a name, at least 1 week met) and B (fresh). Run every check in Night and Day, at 360x800 and 412x915, and once at 1.3x font. Take a screenshot at the end of each check.

**L16 Profile sheet**
1. On each of Today, Practice, Review, Colleges and You, tap the avatar at the top left. The same sheet opens each time.
2. It shows A's name and email, the **Free** or **Pro** tag, **Practice credits N** and **AI credits N** with "Renews <date>", and the Night, Day, Match phone switch.
3. The rows are **Glass, touch and celebrations**, **Name, sign-in and plan**, **Notifications**, **Privacy**, **Help and about**, **Write to us**, then **Sign out**. There is no Study days row.
4. Tap each row: its page opens, and Back returns to the same tab with the sheet closed.
5. Tap a credit tile: Credits opens with its history.
6. Sign out asks to confirm and then lands on sign-in.
7. Press Back with the sheet open: the sheet closes and the app stays.

**L17 You as the study hub**
1. Account A, You tab, at 360x800, without scrolling: the header (avatar, You, Edit), the hero (**CUET UG 2027, Commerce**, name, Mobi), the five chips, and **This week** with the dial reading "N of G study days" and its headline. The top of **Badges** (title or count line) shows at or near the fold.
2. Nothing from plan, credits, appearance or account is above Badges.
3. Scroll: Badges, Personal bests, Across your mocks (with Your repair record), My subjects (with Aim), then one Plan and credits row with no tiles.
4. Tap each chip: the page glides to that section and the chip lights.
5. Open any block's page and press Back: the same scroll position.
6. Account B: every block shows its empty words from A.5 and no error text.
7. Airplane mode after one load: the offline banner with the time, and the cached content.

**L18 Badges, milestones, personal bests**
1. Account A, You, Badges: a count line **N of 16 earned** (or of 14 while the server lists 14), and five coins.
2. Tap **See all**: 4 paths with 16 (or 14) badges in total. Each earned badge shows its date; each not-yet badge shows its condition, with no padlock anywhere.
3. A account with 6 scored sets: **10 scored sets** shows "6 of 10 so far" with a bar. **5 repairs** shows no count.
4. Tap a badge: the sheet shows the medal at 96 dp, the name, **Earned on <date>** or **Not yet**, the condition, the record line for a D badge (for example "From your Accountancy full mock, 12 October: 152 of 250 (before: 142)"), and one key.
5. Finish a quick practice with every answer right (10 questions) on a test account: the result shows the **Clean set** celebration once. You then shows it in the first slot, with Mobi `proud` and "Clean set landed." Open the result again: no second celebration.
6. Personal bests on You: **Best full mock** as marks out of the total with subject and date, **Longest run at your goal** in weeks with "Now: N weeks", and **Fastest right answer** in seconds with subject and date.
7. `/you/bests` shows the same three, with "Answers under 3 seconds are not counted."
8. Account B: **None earned yet**, a next line with the first condition, and the bests empty line.
9. First launch after an upgrade on account A: one line, **N badges added from your past papers.**, and no burst of celebrations.

**L19 Notifications invitation**
1. Account A with notifications off: You shows the strip under This week (**Reminders are off**, **Turn on**, **Not now**), and the sheet's Notifications row shows **Off** and **Turn on**.
2. Tap Turn on and allow: the strip reads "Reminders are on. Next: <day time>." and then collapses. The sheet row shows the next time. Force-stop and reopen: no strip.
3. Turn notifications off in Android settings and reopen: the strip is back.
4. Tap **Not now**: the strip collapses. Move the emulator date +1 day: no strip. +2 days: the strip returns with a different wording from the first.
5. Deny twice: the key reads **Open settings** and opens Android's page for MockMob. Allow there and return: the strip turns to the on state without a restart.
6. Finish a practice on a day the strip already showed: no post-result reminders sheet that day.
7. Start a full mock and an NTA paper: no invitation of any kind at any point in the paper.

**L20 Theme and settings**
1. From each tab root: avatar, and the theme switch is visible without scrolling at 360x800.
2. Tap Day, then Night: the whole app, including the bar and the open sheet, cross-fades in about 250 ms.
3. With "Remove animations" on, it changes instantly.
4. Force-stop and reopen: the choice is kept.
5. **Glass, touch and celebrations** opens the appearance page.
6. The You tab no longer has an Appearance section.

**L21 Edit subjects**
1. You, My subjects, Edit (or tap a subject tile): Subjects opens.
2. Remove one and add one: Save becomes active. At 5 subjects, adding a 6th is refused with the cap line (and Mobi's refusal).
3. Save: the snackbar "Subjects saved. Practice, Today and You now use these N." appears.
4. Back on You, the strip shows the new set. Practice's tiles show the new set, and its default is one of them. Today uses one of them.
5. Airplane mode: Save is disabled with the offline line.
6. Back with unsaved changes asks to confirm.

**L06 (You half)**
1. On A with 3 days studied and a goal of 4: You's dial shows the numeral **3** with **of 4 study days** inside the ring, 4 segments with 3 lit, and the headline **1 more study day reaches your goal**.
2. Change the goal to 5 through Weekly goal: the dial shows **3 of 5 study days**, and Today's This week tile agrees.

**L34 to L37 on these screens**
1. Record 30 s (`adb shell screenrecord`): open You, scroll, tap a coin (flight into the sheet), close it, open See all, back (shrink into the row), open the sheet from the avatar, switch the theme.
2. No snap, no blank frame, no jump. Janky frames under 5% (`dumpsys gfxinfo`).
3. Count Mobi per screen: You 1, Badges at most 1, badge sheet 0, bests 0, account sheet 0 characters.
4. Subject art reads as its subject at 56 dp.
5. Night and Day: no low-contrast text, no dark leftovers.

---

## 12. Requests to other areas

| To | Request |
|---|---|
| **Server / web owner** | (1) Add milestone ids `first_hold` (a repaired rule answered right on a fresh check) and `run_weeks_3` to `GET /api/me/rhythm` `milestones[]`, listed with `achievedAt: null` until earned. (2) Add `bestRunEndedWeek` (`YYYY-MM-DD`). (3) Confirm whether `GET /api/attempts` rows carry `details[].timeMs`. (4) The website's Progress page should show the same 16 badges with the same words (owner: app and website together, 14 Oct). |
| **Shell** | The avatar on the You header (as on every tab root). The bar's You icon is a person glyph, not the initial (IA 4.4). `/progress` goes to `/you` (IA 8.3). `/profile` opens You plus the sheet. |
| **Result** | Host the `CelebrationSlot` for result scope on the quick-practice result too, if it does not already. The full result hosts it (`full_result_screen.dart`). A clean set is usually a quick practice. |
| **Practice** | When the default subject is removed in Subjects, pick the first remaining (`data/default_subject.dart`). |
| **Colleges** | `/colleges` accepts being opened from You's Aim row (`goBranch(3)`); nothing else is needed. |
| **Mobi and motion / art** | A `token-best` brass object for the "Your best work" path. Add `you_hub`, `badge_sheet`, `bests` and `account_sheet` to the one-per-screen test. |
| **Account** (built by the Account builder from this design) | Section 4 sheet changes, the invitation widget and its policy (section 5), and the help page taking the FAQs and the version. |

---

## 13. Owner sign-off questions

1. The badge set: are the 16 in 3.2 right? In particular, should "New best", "Clean set" and "Four subjects" be badges, or should any be swapped out?
2. Should locked badges stay without a padlock (Y3), shown as a faint coin with the condition?
3. Fastest right answer ignores answers under 3 seconds. Is that the right floor?

---

## 14. Anti-slop and rubric notes (for the builders to fill with screenshots)

- **What the screen helps decide:** whether my study is adding up, and what to do next for the next badge.
- **What was removed without losing information:** the duplicate plan, credits and appearance blocks on You; the email on You; the course and colleges fields (they have one home in Colleges).
- **What could mislead:**
  - progress on uncountable badges (prevented: counts only where complete)
  - badges that look paid (prevented: no padlock)
  - "Saved" before the server confirms (prevented: R17)
  - an invitation in a paper (prevented)
- **Evidence:** R7, R8, R9, R10, R11, R17, R22, R26, R29, R31, R33; T002, T005; S014, S016, S017.
- **The 0/1/2 rubric and the 12-part test** are run by the builders on the goldens listed in section 15 and signed off by the owner.

---

## 15. Files to change

Paths are under `wt-phase2/flutter_app/`. Owners follow IA section 10.

**You area**
- `lib/features/you/you_hub_screen.dart`:
  - the new section order (A.2)
  - the chips Week, Badges, Bests, Mocks, Subjects
  - remove the Plan, Appearance, Notifications panel, Account, Tools and Help sections and `HubFooter`
  - add the invitation strip slot, `_BadgesSection`, `_BestsSection`, the My subjects section with the Aim row, and the plan row
  - a `PageStorageKey`
- `lib/features/you/hub/sheet_card.dart`: becomes `YouHero` (eyebrow, name, Mobi); drop the email, `TargetFields` and the subjects field from the hero.
- `lib/features/you/hub/hub_cards.dart`:
  - remove `PlanCreditsCard`, `AppearanceCard`, `AccountPanel`, `HelpPanel` and `ToolsPanel` from the hub
  - keep `StudyDaysPanel`
  - add `PlanCreditsRow`
  - `NotificationsPanel` moves to the sheet's row logic (Account)
- `lib/features/you/hub/hub_sections.dart`: the bests rows, the subjects strip and the Aim row.
- `lib/features/you/hub/hub_mobi.dart`: add the badge-landed reading (`proud` plus the name), with priority over the week.
- `lib/features/you/hub/sheet_fields.dart`: `WeekField` unchanged; the target fields leave the hub.
- `lib/features/you/copy.dart`, `edit_copy.dart`: the new strings in A.2, 3, 7 and 8; Edit is always short.
- `lib/features/you/sheet/sheet_editor_screen.dart`: course and colleges become a row to `/colleges`.
- `lib/features/you/subjects/subjects_screen.dart`, `subject_rows.dart`: the lead line, reorder, Save after server confirmation, offline, leave confirm.

**Rhythm (You area)**
- `lib/features/rhythm/logic/milestone_tracks.dart`: 4 tracks, 16 steps, the N-id gating, and the non-sequential "Your best work" path.
- `lib/features/rhythm/logic/tokens.dart`: replace the 3 tokens with badge definitions (id, name, condition, glyph, source, path).
- New `lib/features/rhythm/logic/derived_badges.dart`: `deriveBadges(List<Attempt>)`, the merge with the server dates, and the progress for `full_mocks_5` and `four_subjects`.
- `lib/features/rhythm/logic/milestone_progress.dart`: add the D counts.
- New `lib/features/rhythm/widgets/badge_row.dart`: the five-coin row and the next line (replaces `token_shelf.dart` on You; `token_shelf.dart` stays for any other caller or is deleted if none).
- New `lib/features/rhythm/screens/badge_sheet.dart`: Screen C.
- `lib/features/rhythm/screens/milestones_screen.dart`, `widgets/milestone_track_card.dart`: title **Badges**, the "N of 16 earned" hero, 4 paths, rows open the badge sheet.
- `lib/features/rhythm/screens/bests_screen.dart`, `data/bests.dart`: the longest run and fastest right answer blocks; new `logic/fastest_answer.dart`.
- `lib/features/rhythm/widgets/week_dial.dart`: You passes `showWords: true` ("of G study days").
- `lib/features/rhythm/celebration/celebration_event.dart`, `celebration_controller.dart`: `badge:<id>` events and silent backfill with one receipt.
- `lib/features/rhythm/copy.dart`: badge names, conditions, actions, the bests copy.

**Account area**
- `lib/features/account_sheet/account_sheet.dart`, `account_copy.dart`: remove the Study days row; add the Glass, touch and celebrations row; add the Notifications row states (Off with Turn on, next time, blocked with Open settings).
- New `lib/features/notifications/widgets/notifications_invite.dart`: the You strip (placed by You).
- `lib/features/notifications/logic/pre_prompt_policy.dart`: `youInviteAsks`, the shared `lastAnyInviteDay`, and the same-day exclusion.
- `lib/features/notifications/services/notification_providers.dart`: re-read the permission on resume; expose an invite state.
- `lib/features/you/help/help_screen.dart`, `faq.dart`: the 4 FAQs and the version (moved from the hub).

**Tests and goldens**
- `test/golden/you/`: `hub_*` re-recorded (top, full page, new, failed, loading, offline, invite, badge-landed), each at 390 Night and Day plus 360.
- `test/golden/rhythm/`: `badges_*` (list, empty, complete, sheet earned, sheet not yet), `bests_*` (with run and fastest), and the dial with words.
- `test/golden/account_sheet/`: `account_sheet_*` (off, on, blocked).
- `test/unit/rhythm/derived_badges_test.dart`, `fastest_answer_test.dart`, `milestone_tracks_test.dart` (16 ids, N gating, never un-earn).
- `test/unit/notifications/invite_policy_test.dart`: gaps, rotation, the same-day exclusion, never in a session.
- `test/unit/mascot/mobi_moments_one_per_screen_test.dart`: add the four frames.
