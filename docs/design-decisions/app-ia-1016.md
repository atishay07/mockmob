# App information architecture, 16 Oct 2026 (IA lead decisions)

Status: **decided for the area designers; owner sign-off pending** (section 11 lists what he must confirm). Design only. No code was changed for this file.

Scope: the Flutter app's global structure on `ui/phase2` (`wt-phase2/flutter_app`, read at the 16 Oct working tree). It covers the bottom bar, where the CUET tools live, what moves between the You tab and the profile sheet, the onboarding steps, the route map and which area owns which files. Each screen's own layout belongs to the area designers (section 10). They must work inside these decisions.

Ledger items resolved here: L16, L17, L22, L30, L31, L32, L39 (`docs/brain/APP-OWNER-LEDGER-2026-10-16.md`). Items touched: L19, L20, L24, L25, L26, L27, L35.

Evidence used:
- Owner research brain: `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md`, cited as R7, R8 and so on, plus the evidence IDs from `source-ledger/EVIDENCE_INDEX.csv`.
- The owner's ledger and his memory notes: the rejected web restructure (15 Oct), the design direction, and mobile-only.
- `APP-UX-AUDIT-2026-10-15.md` sections 3 and 4, and `VISION-INVENTORY-2026-10-16.md` (P1-9).
- The code: `lib/core/router/*`, `lib/core/widgets/bar/*`, `lib/core/theme/tokens.dart` (`MmBar`), `features/you/you_hub_screen.dart`, `features/account_sheet/*`, `features/tools/*`, `features/onboarding/model/deck.dart`.
- The website's arena navigation (`wt-batch/src/lib/arenaNavigation.js`, `src/app/(app)/*`).
- Goldens: `test/golden/core/goldens/bar_tabs_night.png`, `you/goldens/hub_full_page_night.png`, `account_sheet/goldens/account_sheet_night.png`, `tools/goldens/compass_full_night.png`.
- The owner's phone capture `scratchpad/dev/now1.png` (16 Oct 10:33, Day theme). `v10-launch.png` and `v10-now.png` were not in that folder, so they were not seen.

---

## 0. The user and the job

A Class 12 Commerce student preparing for CUET UG 2027 on a budget Android phone (360 to 412 dp wide, often 2 to 4 GB of RAM). Every week they do four things:
1. Decide what to study tonight (Today).
2. Practise or sit a mock (Practice and Start).
3. Win back marks from their mistakes (Review).
4. Check whether their marks are heading toward the colleges they want (today this is hidden in "CUET tools").

They also want to see their own study streak, badges and bests (You). Once in a while they manage their account: credits, plan, theme and sign-in (the avatar sheet).

Success criterion for this IA:
- Every one of those jobs is one tap from the bar.
- Every website arena feature the app has is at most 2 taps from a tab (L39).
- The bar's icons, labels and Start key share measured centre lines (L31).
- Nothing the student can do today is lost. Section 7 lists every move.

---

## 1. Decisions at a glance

| # | Decision | Ledger |
|---|---|---|
| D1 | The bar holds **six slots: Today, Practice, Start, Review, Colleges, You**. It has five destinations plus the Start action. | L31, L32, L22 |
| D2 | **Start stays in the third slot and becomes a slot like the tabs.** It has the same width and the same icon-over-label layout, on a volt pill the same size as the active lens. Alignment comes from the geometry, not from tuning by eye. | L31 |
| D3 | **New Colleges tab** (shell branch 3, `/colleges`). It holds My colleges, the Admission Compass, Check a score (the cutoff calculator), the Combo planner, the CUET 2027 guide and the previous-year papers guide. It replaces the `/tools` hub, which becomes a redirect. | L22, L23, L27, L32 |
| D4 | **You becomes the student's study.** In this order: this week's study days, badges and milestones, personal bests, across your mocks, subjects. Plan and credits shrink to one row at the bottom. Account, appearance, privacy and help leave You for the avatar sheet. | L17, L18 |
| D5 | **The avatar sheet is the account**, opened from the avatar at the top left of all five tab roots. It holds name, email and plan, both credit balances, the theme switch, and the account, notification, privacy, help, contact and sign-out rows. Study days leaves the sheet for You. | L16, L19, L20 |
| D6 | **Onboarding keeps its nine steps and its order.** The Aim step (course and colleges) writes the same My colleges list as the Colleges tab, uses the same search and limit, and drops the "stay on this phone" line. Accounts that never saw onboarding get the same Aim component as the Colleges tab's empty state. | L28, L30 |
| D7 | **The tool paths stay where they are** (`/tools/compass`, `/tools/combo`, `/tools/guide-2027`, `/tools/compass/:groupId`). They are root pages that cover the bar, so they can be pushed from any tab and Back returns to where the student was. Only `/tools` itself changes: it redirects to `/colleges`. | L22 acceptance |

---

## 2. Why six slots (alternatives considered)

The owner's newest words:
- 15 Oct: "5 to 6 things", and "everything being useful is not".
- 16 Oct: the bar must be "perfectly aligned with the bubble ... especially the text".
- 16 Oct: the CUET tools are "not tucked inside a corner", and Compass is "quite important".
- 16 Oct: the You section should be study days, badges, milestones and personal bests, with plan items lower.
- 15 Oct (web Gate A): merging navigation into 5 places and cutting richness was "a huge regression".

| Option | What it is | Verdict |
|---|---|---|
| A | Keep 4 tabs and Start; add a Compass card to Today and a row to Practice. | **Rejected.** Fails L32's acceptance check ("Compass and My colleges must be one tap from the bar"). It is what he called "hidden below something" twice (L22, repeated). R10 and S014 say frequent or important controls are not hidden for minimalism. |
| B | Colleges replaces You, and You becomes the avatar page (the audit's section 4). | **Rejected.** On 16 Oct, after the audit, he asked for the You section to be improved as the study hub. He did not ask for it to go. The newest words win. It also removes a destination, which he read as a cut on the web. |
| C | Practice folds into the Start sheet: Start's half sheet is the quick lane, and dragging it up gives the full Practice page. That leaves 5 slots: Today, Review, Start, Colleges, You. | **Rejected.** It takes the Practice tab away, the tab whose order he is actively correcting (L08), and it repeats the "merged nav into 5 places" mistake. Practice and Start do overlap, but they serve different speeds: Start is "go now", Practice is "choose". |
| D | 5 tabs in one glass capsule, with Start as a separate round key at the trailing end. | **Fallback only.** The alignment is clean, but it moves Start away from the place both the app and the website's mobile bar use (`AppLayoutClient.jsx`, StartKey at index 2), and at 360 dp the tabs get narrower (48.8 dp) than in E. |
| **E** | **Six equal slots, with Start third and laid out like a tab.** | **Chosen.** It meets his 5-to-6 count with five real destinations. It keeps Start's position, muscle memory and website parity. It makes every icon and label share one centre line by construction (section 4). Each slot is at least 52 dp wide at 360 dp, above the 48 dp target. |

Why Start is not centred: with five destinations, Start cannot be centred without unequal tab widths. At 360 dp that would leave 42 dp tabs on one side, which fails the 48 dp target. Because Start now has exactly the same width, height and layout as a tab, nobody reads it as a centre bubble that drifted off-centre. It reads as one of six equal places that happens to be lit. S016 (consistent navigation and identification): the six slots behave identically except that Start is an action.

Order, left to right, follows the week's story: plan (Today), practise (Practice), go (Start), win marks back (Review), where the marks lead (Colleges), your study (You). Today stays first because Back from any tab returns to Today (`app_shell.dart` `_onBack`).

---

## 3. Destinations: what each tab answers

| Slot | Tab | The question it answers | Holds (top to bottom; layout is the area's call) | Used |
|---|---|---|---|---|
| 0 | **Today** `/today` | What do I do with tonight? | Tonight's move (hero), the week strip, Road to May, **Your colleges card** (new role, see 5.2), insights card | Daily |
| 1 | **Practice** `/practice` | What do I want to practise? | Subject choice first, then modes from shortest to longest (L08 proposal), Smart practice, the exam band, More (question stream, **Admission Compass row**), Concepts | Daily |
| 2 | **Start** (action) | Start something now | The quick start sheet, unchanged in content: resume, tonight's move, Quick practice 10, Full mock, NTA mode, Repair the next mistake. A drag up still opens it out of the key. | Daily |
| 3 | **Review** `/review` | Where did I lose marks, and how do I get them back? | To repair (tonight's repair, chapters), History, Your record (insights, the website's Radar), Saved, Rule book, Revise, Ask Mobi | After every paper |
| 4 | **Colleges** `/colleges` (new) | Are my marks heading to the colleges I want? | My colleges ladder, Admission Compass, Check a score, Combo planner, CUET 2027 guide, previous-year papers guide | Weekly |
| 5 | **You** `/you` | How is my study going? | Study days this week, badges and milestones, personal bests, across your mocks, my subjects, then one row for plan and credits | Weekly |

Account (not a tab) is the avatar at the top left of every tab root and opens the account sheet (section 6).

One primary action per tab root (R7):

| Tab | Primary action |
|---|---|
| Today | The hero's start key |
| Practice | Start the chosen mode |
| Review | Repair tonight's mistake |
| Colleges | **Choose your colleges** when the list is empty, otherwise **Open Admission Compass** |
| You | None by design. It is a record you read, and each block opens its detail page. |

Mobi on tab roots (L35, at most one per screen):

| Tab | Mobi |
|---|---|
| Today | In the hero (exists) |
| Practice | The subject or mode moment |
| Review | The repair or empty state |
| Colleges | **One Mobi**: in the empty state, pointing at the chooser. With colleges chosen, Mobi reacts to the ladder, cheering when the practice estimate clears a college and thinking while data loads. The Compass hero keeps its brass compass object and has no Mobi. |
| You | The header (exists) |

The account sheet keeps only the tiny Mobi in the AI credits tile.

---

## 4. Bar spec (L31, L32, L33)

Built on `docs/brain/ui-phase2/DOCK.md`. The geometry in this section replaces DOCK.md section 3.1. Glass (L33, sigma 24), the lens springs, scrubbing, the live capsule, collapse and the keyboard behaviour are unchanged.

### 4.1 Horizontal

| Measure | Rule | 360 dp | 393 dp | 412 dp | 472 dp and up |
|---|---|---|---|---|---|
| Side gutter | 16 dp (8 dp below 360) | 16 | 16 | 16 | auto |
| Bar width W | screen − 2 × gutter, at most 440 | 328 | 361 | 380 | 440 |
| Inner padding | 6 dp each side (`MmBar.pad`) | 6 | 6 | 6 | 6 |
| Slot width S | (W − 12) / 6, **all six equal** (Start included) | 52.67 | 58.17 | 61.33 | 71.33 |
| Lens and Start pill width | S − 4 | 48.67 | 54.17 | 57.33 | 67.33 |
| Slot centre x | 6 + S × (i + 0.5) | | | | |

On a 320 dp phone (8 dp gutter): W 304, S 48.67, so the hit area stays at least 48 dp. `MmBar.startSlot` and `startSlotNarrow` are retired; `BarGeometry.tabSlot` and `startSlot` both become S.

### 4.2 Vertical, expanded (bar 64 dp tall; y measured from the bar's top)

| Part | y | Centre |
|---|---|---|
| Lens and Start pill | 6 to 58 (52 tall, radius 26) | **32** |
| Icon box (24 × 24) | 11 to 35 | 23 |
| Gap | 35 to 39 (4) | |
| Label line box (11 sp, line height 14, weight 600, letter spacing 0) | 39 to 53 | 46 |
| Content group (icon + gap + label) | 11 to 53 (42 tall) | **32**, the same as the pill |

- **Start uses the same layout:** a 24 dp glyph at y 11 to 35 and the word "Start" (11 sp, weight 700, ink on volt) in the same label box at y 39 to 53. So Start's icon centre equals every tab's icon centre (23), its word sits on the same baseline as every tab label, and its pill has the same box as the lens. This fixes his "especially the text": today the word "Start" sits at the bar's centre (y 32) while tab labels sit at y 46 and icons at y 23 (`start_key.dart` `keyRect`; `mm_bar.dart` lines 800 to 805), and `now1.png` shows exactly that offset.
- Start's glyph is a rounded play triangle. It is not a bolt: the bolt mark is retired (logo decision, 13 and 15 Oct).
- **Resume:** the label slides "Start" to "Resume" in the same box; FittedBox scales it down if needed. No widening (`resumeWiden` is retired).
- **Lens versus Start:** the lens is a neutral glass tint (it is never volt); Start is always volt. The lens never lands on Start (unchanged scrub rule).

### 4.3 Vertical, compact (after scrolling down; bar 52 dp, bottom anchored, so its band is y 12 to 64 of the 64 dp box)

- Labels fade to 0 over 120 ms.
- Icons and Start's glyph translate +15 dp to centre on y 38.
- Lens and Start pill become 40 tall (y 18 to 58, centre 38).
- Everything still shares one centre line.
- With reduced motion: no translation; the compact state is reached by a cross-fade.

### 4.4 Text, icons, states

- Labels: Today, Practice, Start, Review, Colleges, You. Sentence case. **Never ellipsis or wrap.** Text scale is clamped at 1.2 (`withClampedTextScaling`); FittedBox scaleDown with a minimum of 0.85 keeps "Practice" and "Colleges" on one line. At 1.3× system font size, "Colleges" (about 41 dp at 11 sp) still fits the 48.67 dp pill.
- One label size for the whole bar at any width (the owner wants the labels aligned).
- Icons: one stroke family (`bar_icons.dart`); outline when inactive, filled when active.
  - New `BarIconKind.colleges`: a building with three columns. Its fill on selection is the same morph as the other icons.
  - **You's icon becomes a person outline and fill. It no longer shows the student's initial.** The initial belongs to the header avatar, which opens the account sheet; two initials on one screen would point to two different places (S016).
- Inactive label colour is `ink2`, active is `ink`. Both must reach 4.5:1 on the glass tint in Night and Day, on the low-quality glass tier too (flat tint).
- Badges: Review keeps its count; You keeps its dot ("needs your attention"); Colleges gets a dot only when a saved college's cutoff data changes (once per data release, cleared when the tab is opened). Badge position is unchanged (centre at icon right +2, icon top +1).
- Hit area: the whole slot (S × 64). Press feedback: scale 0.96 over 100 ms, with a spring on release. The selection click haptic is unchanged.
- TalkBack:
  - Tabs: "Colleges, tab 4 of 5". There are five destinations; Start is not counted.
  - Start: "Start. Opens quick start." (unchanged).
  - Ordinal sort keys follow the slots.

### 4.5 Acceptance (adds to L31's)

Golden `bar_six_*` at 360 and 412 in Night and Day, expanded and compact, plus a unit test on `BarGeometry`. The test asserts:
- (a) all six icon centres are on one y;
- (b) all six label boxes are on one y;
- (c) the Start pill's rect equals the lens rect at that slot;
- (d) the content group's centre equals the pill's centre (±0.5 dp);
- (e) the slot widths sum to W − 12.

Then the ruler check on the emulator at 360x800 and 412x915, as in L31.

---

## 5. Where the CUET tools live (L22, L23, L26, L27, L24, L25)

### 5.1 The Colleges tab root, top to bottom (the Colleges area designs the layout)

1. **Header:** the avatar (top left, the same on all tab roots) and the title "Colleges".
2. **My colleges.** The one shared list (up to 8, server-backed, `my_colleges_*`), shown as a ladder: college, course, the 2026 Round 1 cutoff for the student's category, and, when the student has papers, their practice estimate against it ("Your estimate 612 of 800; Hansraj B.Com (Hons) closed at 645.3"). Real numbers with denominators.
   - Empty state: the same course-and-colleges component as onboarding's Aim step (D6), with **Choose your colleges** as the primary action.
   - Edit opens the chooser sheet, which must have the L24 search and keyboard fixes.
3. **Admission Compass:** a hero card, for example "35 of 73 DU programmes open to your subjects". It opens `/tools/compass` and is the primary action once colleges are chosen.
4. **Tools:** a flat list of rows with one icon column and no card behind (the pattern of today's `ToolsFlatList`):
   - **Check a score** (the website's cutoff calculator): opens `/colleges/cutoff`.
   - **Combo planner:** `/tools/combo`.
   - **CUET 2027 guide:** `/tools/guide-2027`.
   - **Previous-year papers guide:** opens the website page in a Custom Tab, as it does now.
5. Sources line: the existing sources sheet.

No score is asked for anywhere on this tab before something useful is shown (L26; R13; T003, value before the gate). The score is optional, and "Use my practice estimate" comes first when the student has papers.

### 5.2 Reach in at most 2 taps (from a cold start on Today)

| Target | Path | Taps |
|---|---|---|
| My colleges (see) | Bar Colleges | 1 |
| My colleges (edit) | Bar Colleges, Edit (or Today's colleges card, Choose) | 2 |
| Admission Compass | Bar Colleges, Compass card. Also: Today's colleges card "Open Compass"; Practice, More, Admission Compass | 2 |
| Check a score (cutoff calculator) | Bar Colleges, Check a score | 2 |
| Combo planner | Bar Colleges, Combo planner; also Compass ↔ Combo through `?from=` (exists) | 2 |
| CUET 2027 guide | Bar Colleges, CUET 2027 guide | 2 |
| A programme's colleges | Bar Colleges, Compass, programme | 3 (a detail level, allowed) |

**Today's colleges card** (owned by Today) replaces both the quiet `ToolsQuietLink` under the road and the "Your colleges" block:
- With colleges: the top 3 of the ladder, plus "See all in Colleges", which goes to `/colleges`.
- Without colleges: "N of 73 DU programmes open to your subjects", with **Choose colleges** (opens the chooser sheet over Today; L25) and **Open Compass**.

This satisfies L22's rule that "a student who has never opened it sees it named on Today". The card sits after the road, so tonight's move stays first (R8).

**Back behaviour:** the Compass, Combo and guide pages are root pages (D7). Opened from Today, Practice or Colleges, they cover the bar, and Back returns to the tab they came from, at the same scroll position. Switching to the Colleges tab itself uses `goBranch(3)`; Back from there goes to Today (the existing back rule).

### 5.3 Check a score

`/colleges/cutoff` is a sheet in the Colleges branch:
- The category chip row comes first.
- The score field offers "Use my practice estimate (612)" first when the student has papers.
- The result reads as a count with a denominator, for example "612 clears B.Com (Hons) at 31 of 55 colleges (2026 Round 1, unreserved)".
- "See every programme" opens Compass with the score applied (`/tools/compass?score=612&category=UR`).

It is the same data and the same screen family as Compass (`compass_screen.dart` already folds the website's calculator into Compass). This is only an entry point, not a second calculator. The website path `/cuet-cutoff-calculator` maps here (section 8.3).

---

## 6. You and the account sheet (L16, L17, L18, L19, L20)

### 6.1 You tab (`/you`), top to bottom

1. **Header:** the avatar (opens the account sheet), the name, "CUET UG 2027, Commerce", and Mobi (exists). **Edit** opens `/you/sheet` (stage, target, subjects). The email is no longer shown here; it lives in the sheet.
2. **Pinned jump chips:** Week, Badges, Bests, Mocks, Subjects. These replace Plan, Look, Study and Alerts.
3. **This week:** the study-day ring as "3 of 4 study days", with the studied count and the goal both in words (fixes L06's missing denominator), the weekday row, the weekly goal, planned days and pause. One block; the week drawn on Today is not drawn again. Opens `/you/rhythm` and `/you/goal`.
   - **While notifications are off:** a one-line invitation strip under this block: "Reminders are off. Turn them on so study days don't slip." with a **Turn on** key (L19). It is a secondary action. When reminders are on, the strip is gone and the reminder time shows in the sheet.
4. **Badges and milestones:** the shelf, at least 8 badges with locked and earned states (L18). Opens `/you/milestones`.
5. **Personal bests:** best mock score out of the paper's total, longest run of study days, fastest pace, each with its date. Opens `/you/bests`.
6. **Across your mocks:** the block from the Mistake Lab's end, plus the repair record row.
7. **My subjects:** the subject strip, with Edit (`/you/subjects`).
   - One row **Aim: B.Com (Hons), 3 colleges** goes to `/colleges`. Course and colleges are edited only in Colleges, so they have one home.
8. **Plan and credits:** one compact row, "Free plan. 24 practice credits, 18 AI credits", opening `/you/credits`. No tiles, so the sheet's tiles are not duplicated (L17 acceptance).
9. Footer: none. The version moves to Help.

First screen at 360x800 (L17 acceptance): the header plus This week plus the top of Badges. No plan, appearance or account content appears above the study content.

### 6.2 Account sheet (avatar, all five tab roots)

1. Header: initials avatar, name, email, plan tag (Free, or Pro with "until 12 Jan").
2. **Credits:** two tiles, Practice credits N and AI credits N (with the renewal date). Each opens `/you/credits` with its history. Unchanged.
3. **Appearance:** Night, Day, Match phone, visible without scrolling (L20). Below it, a **More look settings** row opens `/you/appearance` (glass, touch feedback, celebrations; these moved here from You).
4. Rows:
   - Name, sign-in and plan (`/you/account`)
   - **Notifications** (`/you/notifications`). While off, the row's trailing text reads "Off" with a volt **Turn on** key, as L19 asks.
   - Privacy (`/you/privacy`)
   - Help and about (`/you/help`, which now holds the 4 FAQs that were on You, and the version)
   - Write to us
   - Sign out (asks to confirm)
5. **Study days leaves the sheet:** it is study, so it lives on You (it was in both).

Consistency (R11, S016): each setting has exactly one home, and the avatar opens the same sheet from every tab root.

---

## 7. Moves ledger: nothing is cut

Every block on today's You hub (`you_hub_screen.dart` section order) and on the account sheet, with its new home:

| Block today | Where it is today | New home |
|---|---|---|
| Name, email, Edit profile | You header | Name on the You header; email in the sheet; Edit opens the study sheet; name editing is in `/you/account` |
| Plan, Look, Study, Alerts chips | You | Replaced by Week, Badges, Bests, Mocks, Subjects |
| Plan and credits tiles | You (first) and sheet | Sheet tiles; one compact row at the bottom of You |
| Appearance and glass, touch, celebrations | You (second) and sheet | Sheet switch, plus the More look settings row in the sheet |
| Study days | You (third) and sheet row | You, first block |
| Notifications | You (fourth) and sheet row | Sheet row with an Off state, plus You's invitation strip while off |
| My subjects and colleges | You (fifth) | Subjects: You. Course and colleges: the Colleges tab (with an Aim row on You) |
| Milestones shelf | You (sixth) | You, second block |
| Progress (repair record, personal bests) | You (seventh) | Bests: You, third block. Repair record: You, Across your mocks |
| Across your mocks | You (eighth) | You, fourth block |
| Account and privacy | You (ninth) and sheet rows | Sheet rows only |
| CUET tools | You (tenth), Today quiet link, Practice More | Colleges tab, plus Today's colleges card and Practice More |
| Help FAQ (4 questions) and version | You (eleventh) | The Help page, from the sheet |
| `/tools` hub page | Pushed page | The Colleges tab root (the path redirects) |

---

## 8. Route map (go_router, `lib/core/router`)

Legend:
- **tab**: a tab root in the shell.
- **branch**: a page inside a branch, with the bar visible.
- **root**: a page on the root navigator that covers the bar; Back returns to the origin.
- **sheet**: an `MmSheetPage` on the root navigator.

### 8.1 Shell branches (new order)

| Branch | Slot | Path | Kind |
|---|---|---|---|
| 0 | 0 | `/today` | tab |
| 1 | 1 | `/practice` | tab |
| (none) | 2 | Start | action, opens the quick start sheet |
| 2 | 3 | `/review` | tab |
| 3 | 4 | **`/colleges`** | tab (**new**) |
| 4 | 5 | `/you` | tab (moved from branch 3) |

Code consequences:
- `AppRoutes.tabRoots = [today, practice, review, colleges, you]`
- `kBarTabs`: 5 entries
- `kBarSlots = 6`, `kStartSlot = 2`
- `slotToBranch`: 0→0, 1→1, 3→2, 4→3, 5→4
- `branchToSlot(b) = b < 2 ? b : b + 1` (the formula is unchanged)
- `barTabSemanticsLabel`: "of 5"; the You dot moves to branch 4
- In the shell, every `currentBranch == 3` that means You becomes `4`. Search for `branch == 3` in `mm_bar.dart`.

### 8.2 Full map

| Path | Kind | Under | Owner (section 10) |
|---|---|---|---|
| `/splash`, `/load-failed`, `/welcome` | root | | Onboarding |
| `/onboarding/subject`, `/onboarding/sample/*` (retired, they open onboarding) | root | | Onboarding |
| `/sign-in`, `/sign-in/code`, `/sign-in/password`, `/sign-in/forgot`, `/sign-in/phone` | root | | Onboarding |
| `/before-you-start` | sheet | | Onboarding |
| `/today` | tab | branch 0 | Today |
| `/today/why/:actionId`, `/today/week`, `/today/alternatives` | sheet | Today | Today |
| `/today/weekly-ending` | root | Today | Today |
| `/practice` | tab | branch 1 | Practice |
| `/practice/setup/:mode`, `/practice/start`, `/practice/result/:attemptId` | root | Practice | Practice |
| `/practice/stream` | root | Practice | Practice (screen file in insights, see 10) |
| `/exam/nta` | root | | Practice |
| `/review` | tab | branch 2 | Review |
| `/review/mistakes`, `/review/record`, `/review/insights`, `/review/saved` | branch | Review | Review |
| `/review/rules`, `/review/revise`, `/review/repair/:attemptId/:questionId`, `/review/repair/:attemptId/ending` | root | Review | Review |
| `/ask` | root | | Review |
| **`/colleges`** | **tab** | **branch 3** | **Colleges** |
| **`/colleges/cutoff`** (`?score=&category=`) | **sheet** | **Colleges** | **Colleges** |
| `/tools` | **redirect to `/colleges`** | | Shell |
| `/tools/compass` (`?from=&score=&category=`), `/tools/compass/:groupId`, `/tools/combo`, `/tools/guide-2027` | root (unchanged paths) | top level | Colleges |
| `/you` | tab | **branch 4** | You |
| `/you/goal`, `/you/rhythm`, `/you/milestones`, `/you/bests`, `/you/subjects`, `/you/sheet` | root | You | You |
| `/you/credits` | root | You | Account |
| `/you/account`, `/you/account/password`, `/you/account/phone`, `/you/delete`, `/you/privacy`, `/you/appearance`, `/you/help`, `/you/notifications` | root | You (paths kept; reached from the sheet) | Account |
| `/learn`, `/learn/:unitId`, `/learn/run/:runId`, `/learn/run/:runId/done`, `/learn/summary/:subject/:chapter` | root | | Learn (unchanged) |
| `/run/:sessionId`, `/run/:sessionId/submit` | root | | Runner (unchanged) |
| `/result/:attemptId`, `/result/:attemptId/sealed`, `/result/:attemptId/recap/:card` | root | | Result (unchanged) |
| `/permissions/notifications` | sheet | | Account |
| `/dashboard` | redirect to `/today` | | Shell |
| `/lab` (debug) | root | | Shell |

Notes:
- The `/you/*` paths of the account pages are not renamed, so links in notifications, widgets and tests keep working. Their entry point moves to the sheet.
- `AppRoutes.templates` gains `/colleges` and `/colleges/cutoff`.
- `isNativePath` and the route-completeness test must be updated.
- `tools_paths.dart`'s header comment ("reached from You and from a quiet link under Today's road") must be rewritten.

### 8.3 Website links (`action_router.dart` `ActionRouter.resolve`)

| Website path | Now | New |
|---|---|---|
| `/admission-compass` | `/tools/compass` | unchanged |
| `/cuet-cutoff-calculator` | `/tools/compass` | **`/colleges/cutoff`** |
| `/cuet-subject-combination` | `/tools/combo` | unchanged |
| `/cuet-2027` | `/tools/guide-2027` | unchanged |
| `/progress` | `/review` | **`/you`** (milestones and bests live on You; `/recovery` stays on `/review`) |
| `/profile` | `/you` | **`/you`, then the account sheet opens** (the website's Account page is the app's sheet) |
| `/learn` | native fallthrough | unchanged |
| `ToolsPaths.webAliases` | `/cuet-cutoff-calculator` → compass | update to `/colleges/cutoff` |

---

## 9. Onboarding steps (L28, L30)

The deck order is kept. The owner called this flow "fine" (13 Oct), and it is on the keep list. Steps (`features/onboarding/model/deck.dart`, version 1, becomes version 2 because of the change to Aim):

| # | Step id | Bubble | Skip | Change from today |
|---|---|---|---|---|
| (none) | welcome | (none) | (none) | None. Mobi greets; no stock or AI picture (L28). |
| 1 | stage | CUET | yes | None |
| 2 | course | Aim | yes | **Course, then colleges.** It writes the **same My colleges list** as the Colleges tab: the same model, the same search (the L24 fix: "bcom", "b.com", "B Com" and "eco" all match), the same limit of 8, with the first 3 shown on the ladder. "Any college is fine" stays. The line "stay on this phone for now" (`onboarding/copy.dart:231`) is removed: it is filler, and it is wrong once the list is saved to the account at the Save step (R16, T004). |
| 3 | subjects | Subjects | yes | The eligibility line names the chosen course: "Your 4 subjects open B.Com (Hons) at all 3 of your colleges" (real count, R29) |
| 4 | worry | Marks | yes | None |
| 5 | question | Try | conditional | None |
| 6 | rhythm | Pace | yes | None (study days, which also feed You) |
| 7 | plan | Plan | no | The sealed plan lists the colleges by name when there are some |
| 8 | save | Save | no | After sign-in, colleges move to the server list (exists: `_migrate`). "Saved" shows only after the server confirms (R17, T002). |
| 9 | firstMove | Start | conditional | None |

- Progress bubbles count only steps actually answered or skipped (R17, T002, S015).
- Existing accounts never see onboarding again. For them, the Colleges tab's empty state uses the same Aim component (D6). That lets the owner see the L30 work on his own account without signing up again.

L30 acceptance stands as written in the ledger. Add one check: open Colleges on account A with no colleges, and the same ladder component appears.

---

## 10. Ownership map (builders never edit another area's files)

**Rules:**
1. An area edits only the files listed for it here.
2. A change needed in another area's file goes into the requesting area's design doc, under "Requests to other areas", and is built by the owner of that file.
3. Route registration (`router.dart`, `routes.dart`) is done only by the Shell area. Each feature exposes its builders in its own `<feature>_routes.dart` (the existing pattern in `screens.dart`).
4. Goldens live in `test/golden/<area>/`. Unit tests live in `test/unit/<area>/`.

The `ui/phase2` tree has uncommitted edits by other agents: onboarding, review and revise, the saved screen, the Learn feedback Mobi, and the Mobi moments test. Builders must pull the newest state and keep those edits.

| Area | Owns (paths under `flutter_app/lib` unless noted) | Ledger items | Must not touch |
|---|---|---|---|
| **Shell and bar** (IA build) | `core/router/{router,routes,app_shell,action_router,router_redirect,transitions,screens,error_fallback}.dart`; `core/widgets/bar/**`; `core/theme/tokens.dart` (`MmBar` only); `core/widgets/tab_root_header.dart`; `core/widgets/account/account_avatar.dart`; `test/golden/core/bar_*`; router and bar tests | L04, L31, L32, L33, D1, D2, D7, section 8 | Any `features/**` screen body |
| **Today** | `features/today/**` (incl. `widgets/college_ladder.dart` for Today's card; it reads colleges only through `features/tools/data/my_colleges_actions.dart`'s public API) | L01 to L07, the Today colleges card (5.2), removing `ToolsQuietLink` from `today_routes.dart` | `features/tools/**` |
| **Practice and Start** | `features/practice/**`; `core/router/quick_start.dart` (the Start sheet's content; the Shell area owns how it opens); `features/insights/screens/stream*` only if the stream screen changes (coordinate with Review) | L08 to L11; the More row keeps Admission Compass and pushes `/tools/compass` (today it pushes `/tools`, which becomes a redirect; it must push Compass directly) | `core/router/` files other than `quick_start.dart` |
| **Review** | `features/review/**`, `features/insights/**` (record, saved, Ask) | L12 to L15, L38 | `features/practice/**` |
| **Colleges** | `features/tools/**`, including a new `features/tools/colleges/` (the `/colleges` tab root and the `/colleges/cutoff` sheet) exported as `collegesScreen` and `collegesCutoffScreen` from `tools_routes.dart`; `features/tools/my_colleges/**` and `data/**` (the shared list; Today, onboarding and You read it through `my_colleges_actions.dart`) | L22 to L27, section 5 | `features/today/**`, `features/onboarding/**` |
| **You** | `features/you/{you_hub_screen.dart,you_routes.dart,you_providers.dart,copy.dart,edit_copy.dart,hub/**,goal/**,sheet/**,subjects/**,widgets/**,data/**}`; `features/rhythm/**` (week dial, milestones, bests, badge tokens) | L06 (with Today: Today owns `road_board.dart`, You owns `rhythm/widgets/goal_editor.dart` and `week_dial.dart`), L17, L18, L21, and the L19 strip on You | `features/account_sheet/**`, `features/you/{account,privacy,help,appearance}/**` |
| **Account** | `features/account_sheet/**`, `features/credits/**`, `features/you/{account,privacy,help,appearance}/**`, `features/notifications/**` (including the L19 invitation widget, which the You area places) | L16, L19, L20, section 6.2 | `features/you/hub/**`, `features/rhythm/**` |
| **Onboarding and sign-in** | `features/onboarding/**`, `features/auth/**`, `features/account_access/**` | L28, L29, L30, section 9 (Aim uses Colleges' chooser and search through the public API; the shared search function lives in `features/tools/my_colleges/` and is owned by Colleges) | `features/tools/**` |
| **Mobi and motion** | `core/mascot/**`, `core/motion/**`, `test/unit/mascot/mobi_moments_one_per_screen_test.dart` | L34, L35, L36 (the system); each area places its own single Mobi | Any feature screen |
| Unchanged this round | `features/runner/**`, `features/result/**`, `features/learn/**` | (none) | (none) |

Shared files with one owner each:
- `core/widgets/widgets.dart` barrel and `core/theme/theme.dart`: Shell. Ask Shell for new shared widgets; feature-local widgets stay in the feature.
- `features/you/copy.dart` (`YouCopy`, also read by the sheet for the theme switch and sign-out words): You. The Account area adds words only to `AccountCopy`.

Order of building, so nothing collides:
1. Shell: the 6-slot bar; branch 3 `/colleges` with a placeholder `collegesScreen`; the `/tools` redirect; the action router changes.
2. Then in parallel: Colleges (tab root and cutoff sheet), You (reorder), Account (sheet), Today (colleges card), Practice (the More row's target), Onboarding (Aim on the shared list).

---

## 11. Website parity (L39): the arena's navigation against the app

The website's arena navigation (`wt-batch/src/lib/arenaNavigation.js`):
- Study: Today, Practice, Learn, Review, Explore, Saved, Progress
- Planning: Radar, Compass, Ask Mobi
- Community: Ranks, Contribute, My uploads
- Account

The mobile bottom bar shows Today, Practice, Start, Learn and Review.

| Website place | App equivalent | Taps from a tab | Status |
|---|---|---|---|
| Today | Today tab | 0 | Exists |
| Practice (`/dashboard`) | Practice tab | 0 | Exists |
| Learn | Practice, Concepts → `/learn`; also from a mistake | 2 | Exists |
| Review, Mistake Lab (`/recovery`) | Review tab and repair | 0 to 1 | Exists |
| Revise, Rule book | Review → `/review/revise`, `/review/rules` | 1 | Exists (Revise not live on the server) |
| Explore | Practice, More → `/practice/stream` | 1 | Exists |
| Saved | Review → `/review/saved` | 1 | Exists |
| Progress | **You tab** (milestones, bests) | 0 to 1 | Exists; link target changes (8.3) |
| Radar (`/analytics`) | Review → Your record (`/review/insights`) | 1 | Exists |
| Compass and cutoff calculator | **Colleges tab** → Compass, Check a score | 1 | Built by this IA |
| Combo planner (`/cuet-subject-combination`) | Colleges → Combo planner | 1 | Exists; moves |
| CUET 2027 guide, previous-year papers guide | Colleges → guides (PYQ stays a web page) | 1 | Exists; moves |
| Ask Mobi (`/mentor`) | Review → Ask, the Start sheet, a repair | 1 | Exists |
| Account (`/profile`) | Avatar → account sheet | 1 | Exists |
| Ranks, Contribute, My uploads, Rival | (none) | (none) | Deliberately not built (owner) |

Still missing (from the ledger's L39 list), with the area that owns each when the owner sets priorities. These are placements, not commitments to build now.

| Missing feature | Owning area |
|---|---|
| Repair record across devices | Review |
| Free exam-screen preview | Practice (on `/exam/nta`) |
| Guided first-run tour with Mobi | Today (first open after onboarding) |
| Lesson help with AI | Learn |
| Decision note to the playbook | Review (Rule book) |
| Fresh check on 2 new questions | Review (repair) |
| Cohort time lines | Result |
| Weekdays stored on the account | You and rhythm |
| Subject hubs and previous-year guides in the app | Practice (subject page) and Colleges (guides) |

Website follow-up, for the web owner and not built here: the owner wants features to land on the app and the website together (14 Oct). The arena's mobile bar should get the same order and slots (Today, Practice, Start, Review, Colleges, You), with Learn moving under Practice as it is in the app. The arena's desktop sidebar can keep its groups.

---

## 12. Owner sign-off questions

1. Six slots (Today, Practice, Start, Review, Colleges, You), with Start lit as the third slot. Is that the "5 to 6 useful things"? If he wants Start back in the exact centre, the fallback is option D (five tabs in one capsule with a separate Start key at the trailing end), with the trade-offs in section 2.
2. "Colleges" as the tab's name. The other candidates were "Admission" and "Compass". Students say "colleges", and the tab holds more than Compass.
3. Study days leaves the account sheet and lives only on You. Is that right?

## 13. Verification still owed (nothing here is verified on a device)

- [ ] Shell build: the section 4.5 geometry test and the goldens at 360 and 412, Night and Day, expanded and compact, at 1.3× font.
- [ ] Emulator ruler check (L31) at 360x800 and 412x915.
- [ ] L22 check from a cold start: Compass in 2 taps from Colleges, Today's card and Practice More; Back returns to the origin each time.
- [ ] L17 first-screen check on You at 360x800.
- [ ] The L16 sheet check from all five tab roots.
- [ ] The route-completeness test passes with `/colleges` and `/colleges/cutoff`; web links from 8.3 resolve.
- [ ] Anti-slop 12-part test and the 0/1/2 rubric on each changed screen by its area. The IA itself adds no decoration, no new glass and no new cards: the Colleges tools are a flat list (R33).
