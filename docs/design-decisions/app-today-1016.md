# Today and the Road to May, 16 Oct 2026 (area design, build-ready)

Status: **decided for the Today builder; owner sign-off pending** (section 17). This is design only: no code changed, nothing committed, nothing checked on a device. It works inside the IA lead's decisions (`app-ia-1016.md`, D1 to D7 and section 10 ownership).

Ledger items owned here: **L01 to L07** (`docs/brain/APP-OWNER-LEDGER-2026-10-16.md`), plus **L34 to L37** as they apply to Today, and the **Today colleges card** (IA 5.2).

Evidence read:
- The ledger (all 39 items) and the IA file.
- `AGENT_RULES.md` (cited R7, R8 and so on) and `papers/ai-slop-independent.md` (12-part test, 0/1/2 rubric), plus the evidence IDs T001 to T009 and S010 to S018.
- The owner's standards skill (`ui-ux-standards`).
- Code on `ui/phase2` (read only):
  - `features/today/**`: `today_screen.dart`, `today_body.dart`, `road_section.dart`, `road_timeline.dart`, `road_board.dart` (widget and logic), `road_plan.dart`, `move_builder.dart`, `copy.dart`, `mobi_presence.dart`.
  - `features/rhythm/widgets/goal_editor.dart`, `week_dial.dart` and `rhythm_providers.dart` (`saveStudyDays`).
  - `core/auth/load_problem.dart`, the motion tokens (`motion_tokens.g.dart`, `springs.dart`, `scrub.dart`) and `core/mascot/mobi_acts.dart`.
- Goldens:
  - Today: `today_ready_full_night`, `today_road_night`, `today_error_night`, `today_offline_day`, `today_day_one_full_night`.
  - Rhythm: `goal_editor_night`.
- Owner capture: `scratchpad/dev/now1.png` (16 Oct 10:33, Day). `v10-launch.png` and `v10-now.png` are **not in that folder**, so I did not see them.

Two findings from the evidence shaped this design:

1. **`now1.png` contradicts itself.** The main card says "Could not reach MockMob just now", while the card directly under it ("Your record") shows his real numbers: 7 right, 14 wrong of 21. In code, the card fails when the plan read reports `recordUnavailable`, even if the attempts are in hand (`move_builder.dart:105`). The fetch bug itself is being fixed elsewhere. The design still has to stop a partial failure from looking like a total one (section 4.2).
2. **`goal_editor_night.png` shows L06 exactly.** The student picks 4 days, and the ring shows 4 segments with a big "0" and no words. The ring's number is this week's count, but it reads as the goal. The sheet also sits behind a second sheet (`road_board.dart:471-474`).

---

## 1. The job, the user, the success criterion

- **User:** a Class 12 Commerce student on a 360 to 412 dp Android phone with 2 to 4 GB of RAM, opening the app in the evening.
- **Today's job:** "What do I do with the time I have tonight, and am I on pace for May?"
- **Primary action (R7):** the hero's start key. There is one per state, named in section 4. No other control on Today is volt-filled.
- **Real data only:**
  - Attempts: live or cached.
  - The plan read.
  - Rhythm: the weekly goal, this week's counted days and the planned weekdays.
  - The road plan on the phone: the student's own exam date and mock target.
  - The calendar: `CuetCalendar`, with the expected window from 1 May, boards from 15 Feb to 5 Apr, and 2 sessions a week in boards weeks.
  - My colleges, through the tools public API.
  - Nothing predicts marks.
- **Success:**
  - (a) No account with papers ever sees an error card while its own record is on screen.
  - (b) The student changes the exam date, study days a week or the mock target by dragging on the road, sees every number update live, and the change is kept.
  - (c) The study-days sheet reads "3 of 4" unmistakably.
  - (d) No section appears or jumps in after the first second.
  - (e) The L01 to L07 emulator checks in section 13 pass in Night and Day, at 360 and 412, and at 1.3x text.

## 2. Decisions at a glance

| # | Decision | Items | Evidence |
|---|---|---|---|
| T1 | **A partial failure is never an error card.** The card fails only when no attempts are in hand at all (no live read and no cache). If the plan read fails but the attempts are there, Today builds tonight's move from the attempts. | L01 | R35, R8, S017 |
| T2 | **Each failure state names its cause in the card itself and keeps it current.** "Tried again at 10:41 PM. Still not loading." The 5-second snackbar is retired. Today also tries again on its own when the phone reconnects. | L01 | R35, R18 |
| T3 | **The Road to May is rebuilt around a week rail**: a horizontal strip with one column per week from this week to the exam week. Each column shows what that week holds (planned study days, planned mock, boards, registration). It scrolls sideways. The CUET flag at its end **drags to set the exam date**. | L05 | R9, R29, T004 |
| T4 | **Two tuners sit under the rail**: study days a week (a 7-stop drag strip, saved to the account) and full mocks before your date (a tick ruler, saved on the phone). Every change redraws the rail and the lead figure live. A change is saved on release, and the student sees "Saved" only after it is confirmed. | L05, L06 | R17, T002, T001 |
| T5 | **The four board tiles are retired. Their content moves into the road; nothing is cut** (moves ledger, 8.11). The stops list becomes three jump chips. | L05 | R33, R12 |
| T6 | **The study-days sheet is rebuilt:** one sheet with no ring. The number being chosen is the hero ("4 days a week"). This week's progress is a separate labelled line: "This week: 3 of 4 done". | L06 | R9, R29, S016 |
| T7 | **The road moves above Recent papers.** The lead-in pill names the number ("Road to May, 28 weeks"). | L07 | R8 |
| T8 | **Late arrivals have a reserved slot.** Every block above the fold that loads after the first paint has a slot of its final height reserved from the first frame. | L03 | R35 |
| T9 | **One Mobi in view at a time on Today**, and each appearance answers an event (section 11). | L35 | owner rule |

---

## 3. Today screen: order and layout

### 3.1 Sections, top to bottom (final order)

| # | Block | Widget (reuse or new) | Change |
|---|---|---|---|
| 1 | Header: avatar, date line or **status line**, greeting, header Mobi | `widgets/today_header.dart` (reuse) | Status line variants (4.4) |
| 2 | Week ledger: "1 of 4 study days", 7-day rail | `widgets/week_ledger.dart` (reuse) | None. Skeleton slot already reserved (`week_ledger_skeleton.dart`) |
| 3 | Hero: tonight's move or its state | `widgets/move_hero.dart`, `sealed_hero.dart`, `resume_hero.dart`, `today_skeleton.dart` | Failure layouts (4.3) |
| 4 | Also slots (when any) | `widgets/also_slots.dart` (reuse) | None |
| 5 | Lead-in pill, in the 32 dp gap | `MoreBelowSlot` in `today_body.dart` | New label (8.10) |
| 6 | Your record card (integrator slot) | `InsightsCard` (Review area) | Reserved slot (section 6) |
| 7 | Weekly ending and celebration | `WeeklyEndingSection` in `AnimatedSize` (reuse) | None |
| 8 | **The road to May** | `widgets/road_section.dart` (rebuilt), plus new `road_rail.dart`, `road_tuners.dart`, `road_readout.dart` | Section 8 |
| 9 | Recent papers | `widgets/sheet_section.dart` (reuse) | Moves below the road |
| 10 | **Your colleges card** | `widgets/college_ladder.dart`, renamed `colleges_card.dart` | Section 10. Replaces the ladder at the end of the road, and `ToolsQuietLink` |

Gaps: header to hero 16; section to section `MmSpace.group` (32) with the hairline and heading (unchanged); gutter 16. Bottom padding is the shell's bar clearance plus 32.

### 3.2 Wireframe, ready state, first screen (390 x 844, Night)

```
390 dp ----------------------------------------------
| (A)  Friday, 16 October                   [Mobi] |  header, Mobi 40 dp idle
|      Good evening, Asha                          |
|                                                  |
| 1 of 4 study days            3 more by Sunday >  |  week ledger (opens week)
|  M    T    W    T    F    S    S                 |
|  *----o----o----o---(O)---o----o                 |
|                                                  |
| .----------------------------------------------. |
| | Tonight's move                    .--------. | |  hero card
| | Accountancy                       | object | | |  object 104 dp, top at y20
| | 4   to repair                     '--------' | |
| |     tonight                                  | |
| | Every open mistake in Partnership            | |
| | fundamentals, from Mock 7 on 11 Oct.         | |
| | ... Show me                                  | |
| | [====== Start repair ======]  [ 15 min v ]   | |  the one volt key
| |          Choose something else               | |
| '----------------------------------------------' |
|           Road to May, 28 weeks  v               |  lead-in pill (24 tall, 48 hit)
| .----------------------------------------------. |
| | Your record                                  | |  integrator card (slot reserved)
|  ...                                             |
|[ Today  Practice  (Start)  Review  Colleges  You ]  bar (Shell area)
----------------------------------------------------
```

---

## 4. The main card's states (L01)

### 4.1 The state ladder (what the hero shows)

Evaluate top to bottom; the first match wins. `attemptsInHand` means `inputs.attempts != null`, whether the read was live or from the phone's cache.

| # | Condition | Hero | Primary | Secondary | Mobi (in hero, else header) |
|---|---|---|---|---|---|
| S1 | No data yet, read running, < 8 s | `TodaySkeleton` (after the existing 400 ms delay) | none | none | header Mobi `loading` |
| S2 | No data yet, read running, ≥ 8 s | Skeleton plus the line **"Still loading. Your connection looks slow."** under it | text key **"Try again"** (restarts the read) | none | header Mobi `loading` |
| S3 | A paper in progress | `ResumeHeroCard` (unchanged) | Continue | none | unchanged |
| S4 | An unopened sealed result | `SealedHeroCard` (unchanged) | Open | unchanged | unchanged |
| S5 | `attemptsInHand`, network on, every read fine | The move (unchanged: `MoveHero` from `buildMove`) | its start key | Choose something else | object art; header Mobi `idle` |
| S6 | **`attemptsInHand`, but the plan read failed or returned `recordUnavailable`** | **The move built from the attempts**, exactly as S5. **No error UI on the card.** | its start key | Choose something else | as S5 |
| S7 | `attemptsInHand` from the cache, **a refresh failed while online** | The move as S5, built from the cache | its start key (enabled; a start that fails is handled by the start flow) | Choose something else | as S5. The header status line says it (4.4) |
| S8 | `attemptsInHand` from the cache, **offline** | The move as S5. The key is disabled with **"Needs a connection to start."** above it (exists, `today_offline_day.png`) | disabled key | Choose something else | as S5. Status line "Updated 7:30 PM. You are offline." |
| S9 | **No attempts in hand and offline** | Failure card, offline variant (4.3) | **Try again** | none | hero Mobi: `oops` once, then `idle` |
| S10 | **No attempts in hand, online, the read failed** (busy, slow, refused, blocked, unreadable, device, unknown) | Failure card, named-cause variant (4.3) | **Try again** | **Practise anyway** (goes to `/practice`) | hero Mobi: `oops` once, then `idle` |
| S11 | Attempts read and empty (a new account) | The day-one move (unchanged, `today_day_one_full_night.png`) | Start now, 10 min | Sit a full mock instead | hero Mobi `talk` "Let's find your marks." |

Rule changes in `move_builder.dart`:
- `historyUnavailable` becomes `inputs.attempts == null && inputs.attemptsFailed`.
- The `plan.recordUnavailable` term is removed from that expression.
- When the plan read failed, `planReady` is false, so the existing client candidates decide the move (`MoveFacts.candidates`). A plan-only failure is logged (`debugPrint` plus the existing analytics error event), and the student never sees it.

### 4.2 Why S6 matters

`now1.png` shows a student with 21 answered questions being told "Could not reach MockMob" while his record is printed underneath. When the phone holds the attempts, the move it builds from them is real (R8, R24: the move is explained by the history it came from, and "Show me" still opens that paper). A suggestion built on the phone from real papers is better than a refusal.

### 4.3 Failure card layout (S9, S10)

The same `MoveHeroCard` shell, the same radius, padding 20 and lamp. The card is the same height as a move card, ±24 dp, so recovering does not jump the page.

```
.----------------------------------------------.
|  .------.                                    |
|  | Mobi |  Tonight's move did not load       |  title: type.stageLead, ink
|  | 72dp |                                    |
|  '------'                                    |
|  MockMob's server is busy right now.         |  body: type.body, ink2
|  Try again in a minute.                      |
|                                              |
|  Tried again at 10:41 PM. Still not loading. |  status: type.caption, ink3 (after 1st retry)
|                                              |
|  [============ Try again ============]       |  KeyButton, volt; spinner while running
|              Practise anyway                 |  text key (S10 only)
'----------------------------------------------'
```

Exact copy (`features/today/copy.dart`):

| Key | Text |
|---|---|
| `failTitle` | `Tonight's move did not load` |
| `failBody(problem)` | `${problem.sentence} ${problem.advice}`, for example "MockMob's server is busy right now. Try again in a minute." |
| `failOfflineTitle` | `You are offline` |
| `failOfflineBody` | `Tonight's move needs your record. It loads when you reconnect.` |
| `failOfflineWatch` | `Trying again as soon as you reconnect.` |
| `failTried(time)` | `Tried again at 10:41 PM. Still not loading.` (12-hour time, the same formatter the header's "Updated 7:30 PM" line uses) |
| `tryAgain` | `Try again` (exists) |
| `practiseAnyway` | `Practise anyway` |
| `stillLoading` | `Still loading. Your connection looks slow.` |

Retired strings: `unavailableTitle` ("Your earlier results are still there.") and `unavailableLine` ("Could not reach MockMob just now."). The general line is replaced by the named cause; `LoadProblem.unknown` still says something plain. The Mobi speech bubble is removed from the failure card: the title says it.

Behaviour:
- **Try again:**
  - The key shows `MmSpinner` in place of its label for at least 900 ms (the existing `_minTry`).
  - Then either the card swaps to the move (4.5) or the `failTried` line appears or updates. Its time changes, so a repeated tap visibly does something.
  - **No snackbar.** Delete `_sayIfStillFailing` in `today_screen.dart`.
- **Auto-retry:**
  - When connectivity goes from none to some (`networkStatusProvider` in `core/connectivity/connectivity_providers.dart`, which already feeds `TodayInputs.offline`), Today calls `todayActionsProvider.refresh()` once, with a 1 s debounce.
  - Also on `AppLifecycleListener.onResume` when the hero is S9 or S10.
- **Cause source:** `LoadProblem.of(attempts.error)`, with `LoadProblem.record` when the plan said `recordUnavailable` and there are no attempts. The existing `_sayIfStillFailing` logic moves into `TodayInputs.readProblem`.

### 4.4 Header status line (S7, S8)

The status line takes the date line's place in `today_header.dart`, on one line with ellipsis at 1.3x text, and keeps the row height.

| Case | Text | Tap |
|---|---|---|
| S8 offline with cache | `Updated 7:30 PM. You are offline.` (exists) | none |
| S7 refresh failed online | `Updated 7:30 PM. Could not refresh.` plus a trailing 16 dp `LucideIcons.rotateCw` | The whole line (48 dp tall hit area) runs Try again; the icon spins while it runs. If it fails again, the text becomes `Updated 7:30 PM. Tried 10:41 PM, still not loading.` |
| Back online and refreshed | The date line returns; the status cross-fades out over 200 ms | none |

### 4.5 Motion for the states

- **Skeleton to move, or failure to move:** the existing `MmOverlapSwitcher.rise` plus `MmSizeEase` (`Motion.card` 240 ms, `Motion.out`). It answers "the real card arrived".
- **A failure line updating:** the text cross-fades (`Motion.crossFade` 200 ms) and the time digits roll (`numberRoll`, shortened to 300 ms). It answers "your tap ran".
- **Mobi `oops`:** plays once per failure run (when S9 or S10 is entered, not on every retry). During a retry Mobi holds `loading`; on a failed retry he goes back to `idle` without another `oops`.
- **Recovery:** the header Mobi plays `nod` once, when the hero changes from S9 or S10 to S5.
- **Reduced motion:** a 120 ms fade only; Mobi shows static frames.

### 4.6 Night and Day

The failure card uses the move card's surface, with no red: a failed load is not the student's fault. Day: the title is ink and the body ink2 on `raised`, both 4.5:1 or better. The Try again key is volt in both themes with ink text (exists).

---

## 5. Hero spacing and art (L02, L37)

These values are measured; they are not tuned by eye. Builder files: `move_hero.dart`, `hero_stage.dart`, `number_block.dart`.

- Card padding is 20 on all sides.
- The object (or Mobi) box is 104 x 104, its top flush with the overline's top at y = 20 and its right edge at the card's right padding. The overline and subject title wrap to the left of the box (maximum width = card width − 40 − 104 − 12).
- The monumental number's top sits 8 dp below the subject title. The number and its two-line label bottom-align (exists).
- **The empty band rule:** between any two vertically adjacent text blocks, and between the object's bottom and the next text line, the gap is at least 8 and at most 24 dp (one line of body text). The widget test asserts it with `tester.getRect` on the keys `hero-object`, `hero-number`, `hero-meaning`.
- **Clipping:** the object is never clipped (`clipBehavior: Clip.none` on the stage; the lamp glow may bleed). Nothing touches the card's top edge: the object top is ≥ 20.
- **At 1.3x text:** the number block wraps under the object instead of beside it once `textScaler.scale(16) > 20`. The object stays 104 at the top right, and the overline and title keep their wrap width.
- **Subject art (L37):** `SubjectEmblem` at 104. A subject without art shows `SubjectPlate` initials and never another subject's object. Accountancy, Business Studies, Computer Science and English are the four the owner called weak; their regeneration is the Mobi and motion area's packet. Today only guarantees the fallback and the size.

---

## 6. Nothing arrives late (L03)

Rule: a block above the fold that arrives after the first paint gets a slot of its final height from frame one. A block below the fold may open with `AnimatedSize` (240 ms, `Motion.out`, aligned to the top).

| Block | Arrives | Treatment |
|---|---|---|
| Week ledger | Rhythm read | Exists: `WeekLedgerSkeleton` at the ledger's height |
| Hero | Attempts and plan | Exists: skeleton at the move card's height |
| Your record card | Insights read | **New:** while the Insights card's finding read is loading and the hero is not null, reserve a 168 dp `MmSkeleton` block (the card's single-finding height at 1x). If the read ends with no finding, the slot closes with `AnimatedSize` 240 ms; at that moment it is below the hero, and usually below the fold on 360x800. The Review area owns the card and exposes its loading state (R-R1); Today owns the slot (`today_body.dart`). |
| Weekly ending | Rhythm | Exists: `AnimatedSize` |
| Road | Calendar plus rhythm | Built from the calendar at once. The pips fill in when rhythm arrives (8.7), and the rail's height never changes |
| Colleges card | My colleges | Fixed-height skeleton (3 rows) until `myCollegesProvider.ready` |

---

## 7. Back on Today (L04)

The Shell area owns `app_shell.dart` (IA section 10). Today changes nothing. Today's only requirement is that the road's drag gestures never consume Back, and that an open rail selection is not a "state" Back clears. The acceptance check is in section 13.

---

## 8. The Road to May, rebuilt (L05, L07, and the L06 entry point)

### 8.1 What the road answers

"How many weeks and study days do I have, what does each week hold, and what happens if I change my pace, my mock target or my date?" The owner asked three times for it to be interactive, editable and "adjustable directly in the scrolling". The answer is a road you scroll, with handles you drag on it.

### 8.2 Anatomy (top to bottom, countdown phase)

```
390 dp ----------------------------------------------
| The road to May                                  |  TodaySectionHeading (exists)
|                                                  |
| 28   weeks to CUET UG                            |  lead figure: countdownFigure + stageLead
|      expected from 1 May 2027                    |
| 98 study days at 4 a week, 2 in boards weeks.    |  body, ink2; number rolls live
|                                                  |
| This week: 3 of 4 study days done       Week >   |  readout (fixed, does not scroll)
| 28 weeks to go                                   |
|                                                  |
|        Registration ==========                   |  band lane 1 (label sticks to the left edge in view)
|                    Boards ==========             |  band lane 2
|  []                  []          []              |  planned mock marks
|  #    o    o    o    o    o    o    o  >>>       |  pips: up to 7 per column
|  #    o    o    o    o    o    o    o            |  (# = done, volt; o = planned)
|  #    o    o    o    o    o    o    o            |
|  o    o    o    o    o    o    o    o            |
| This 26   2    9   16   23   30   7              |  week start day; month name on the 1st week
| week Oct  Nov                       Dec    (fade)|  right edge fades: more to scroll
|                                                  |
| (Registration, in 15 weeks) (Boards, 17 wks) (CUET UG, 28 weeks)   jump chips (h-scroll if needed)
|                                                  |
| Study days a week                                |  tuner 1 label (labelLarge)
|  1    2    3   [ 4 ]   5    6    7              |  7-stop drag strip, 48 dp tall
| Mon, Tue, Thu, Sat.  Change days                 |  caption + link (opens sheet, section 9)
|                                                  |
| Full mocks before your date                 14   |  tuner 2 label + value
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |       |  tick ruler, centre needle, 48 dp
|                     ^                            |
| 7 taken, 7 to go: about one every 2 weeks.       |  caption; "7 taken" opens the mocks sheet
'--------------------------------------------------'
```

The exam end of the rail (scrolled right):

```
|   o    o    o  |  .---------.                    |
|   o    o    o  |  | CUET UG |  <- flag, volt pill, 48 x 48 grip
|   o    o    o  |  '----+----'
|   o    o    o  |       |                         |
|  12   19   26  |  1 May                          |
|      Apr       |  May                            |
```

### 8.3 The lead figure

- Number: weeks to the exam date (the student's own date, or the start of the expected window). Under 7 days it counts days (existing `_Stat` rules in `road_section.dart`, kept).
- Unit line, expected date: `weeks to CUET UG` / `expected from 1 May 2027`.
- Unit line, own date: `weeks to your date` / `Sat 8 May 2027`.
- Study line: `98 study days at 4 a week, 2 in boards weeks.`
  - If no weekly goal is set: `Pick your study days below to count them.`
  - If no boards weeks are left before the date, the clause ", 2 in boards weeks" is dropped.
- Numbers roll when a tuner or the flag changes them: `numberRoll` 500 ms after a release, 200 ms while dragging.

### 8.4 The readout

Two lines, fixed above the rail. It describes the **selected week**, which is this week by default.

| Selected | Line 1 (labelLarge, ink) | Line 2 (caption, ink2) | Trailing |
|---|---|---|---|
| This week | `This week: 3 of 4 study days done` | `28 weeks to go` | `Week` with a chevron: opens `/today/week` (exists) |
| This week, paused | `This week: paused until Sun 18 Oct` | `28 weeks to go` | `Week` link |
| A future week | `Week of 9 Nov: 4 study days, mock 9 of 14` | `3 weeks from now` | none |
| A boards week | `Week of 22 Feb: 2 study days, Class 12 boards` | `Lighter for boards. 18 weeks from now.` | none |
| A registration week | Line 1 as above, plus `, registration expected` | as above | none |
| The exam week | `Week of 26 Apr: CUET UG expected from 1 May` | `28 weeks from now` | none |
| While dragging the flag | `Your date: Sat 8 May 2027` | `29 weeks, 101 study days at 4 a week` | none |

- The "mock 9 of 14" clause shows only when that week holds a planned mock.
- A study day count shows only when a goal exists.

### 8.5 The rail (`road_rail.dart`, new; replaces `road_timeline.dart`)

**Structure:**
- A horizontal `ListView.builder` with `itemExtent: 48` and one item per week, from the Monday of this week to the week containing the exam date. Physics: `ClampingScrollPhysics`, and no snapping while scrolling (free scrolling feels natural).
- The bands and the flag are painted on one overlay `CustomPainter` driven by the scroll offset, inside a `RepaintBoundary`.
- Canvas height is 152 dp at 1x text. Larger text adds `(scaler.scale(12) − 12) × 2` (two text rows), with text scale clamped at 1.3.

**Vertical layout** (y from the rail's top):

| Row | y | Content |
|---|---|---|
| Band lane 1 | 0 to 14 | Registration: a bar 6 dp tall at y 4, with the label (micro, 600 weight) left-aligned at the band's start, or pinned at x = 4 while the band runs off the left edge |
| Band lane 2 | 16 to 30 | Boards, the same style |
| Mock row | 34 to 46 | A 10 x 12 dp rounded "paper" mark centred in the column, on weeks with a planned mock |
| Pips | 50 to 122 | Up to 7 pips, each 8 x 8 with radius 2.5, 2 dp apart, bottom-aligned at 122. Count = the week's planned study days |
| Date row | 126 to 138 | The start day of the week ("26", "2", "9"), micro, ink3. This week shows `This` / `week` across two rows instead |
| Month row | 140 to 152 | The month name under the first week that starts in that month, micro 600, ink2 |

**Pips per week:**
- The planned count is `goal`. In a boards week (a week whose Monday falls on or after 15 Feb and before 5 Apr) it is `min(goal, 2)`, the same arithmetic as `sessionsUntil`.
- This week's column: `weekDone` pips are filled ("counted"); the remaining `max(goal − weekDone, 0)` are outlined ("planned"); days beyond the goal show as filled pips above the stack (the column can reach 7).
- With no goal, every column shows a single dashed pip, and the readout asks for a pace.
- **Pip styles** reuse the shared study-week mark (`StudyWeekDotPainter` in `core/widgets/week_strip.dart`), so the rail matches the week ledger at the top of the page:
  - counted: volt fill with a 1 dp ink edge
  - planned: `ink3` at 0.55 fill in Night and `ink3` at 0.35 in Day
  - paused: dashed grey

**Planned mocks:**
- `mocksLeft = target − taken`, spread evenly over the weeks after this one up to the week before the exam week.
- Boards weeks are skipped while there are enough other weeks. Otherwise boards weeks take the remainder, at most 1 a week.
- If `mocksLeft` is larger than the weeks available, weeks hold 2 marks, stacked 2 dp apart.
- The marks are labelled "planned" in semantics and the readout. Taken mocks are not drawn on the rail; the rail starts this week.

**The selected week:**
- A 1.5 dp `ink` ring on a 44 x 132 rounded column (radius 12), fading in over 160 ms.
- A tap on a column selects it, with a `selection` haptic. A tap on the selected This week column does nothing more; the readout's `Week` link opens the week.

**Edges and scroll cue:**
- The right edge fades over 32 dp (a `ShaderMask` from the ground colour to transparent) while more weeks lie beyond.
- The left edge fades only after scrolling.

**First-visit peek:**
- 600 ms after the rail first draws, once per install (prefs key `road_rail_peek_<userId>` in `rhythmPrefsStoreProvider`), the rail scrolls 56 dp to the right and back with `Springs.smooth`. It answers "this scrolls".
- No peek under reduced motion, or when everything fits.

**Very close to the date (≤ 21 days):** columns become days, not weeks. Each column is one day with one pip (planned or rest, from the planned weekdays) and the day number under it; readout line 1 becomes `Thu 22 Apr: study day`.

**Window phase (from 1 May):** the rail, tuners and chips are hidden and the existing window stat stays (`RoadPhase.window`, unchanged). The road has nothing left to plan.

### 8.6 The exam flag (drag to set the date)

**Look:** a volt pill 72 x 24 reading "CUET UG" (or "Your date" when it is the student's own), ink text 11 sp weight 700, with a 1.5 dp volt stem down to the pips' baseline. It sits on the exam column at the x of the date's weekday inside that week, so dragging it moves it by days.

**Grip:** 48 x 152, centred on the stem.
- `RawGestureDetector` with a `HorizontalDragGestureRecognizer`. Because it is deeper in the tree than the rail's `Scrollable`, it wins horizontal drags that start on it.
- Vertical drags on it are not claimed, so the page still scrolls.
- **No long-press gate:** the drag starts on touch slop.

**Drag:**
- The flag follows the finger 1:1 and snaps to whole days: 48 / 7 = 6.86 dp per day.
- Range: tomorrow to 30 June after the window (`latestExamDate`, exists).
- Crossing into a new week adds or removes a column at the rail's end. The column width animates from 0 to 48 over 180 ms with `Motion.out`; it is instant under reduced motion.
- **Edge auto-scroll:** when the finger is within 32 dp of the rail's visible left or right edge, the rail scrolls toward it at `(32 − distance) × 18 dp/s`.
- **Magnet:** within 2 days of the expected window start (1 May) the flag snaps to it, with a `selection` haptic and the label changing to "CUET UG".
- **Haptics:** a `selection` tick at each week boundary. No tick per day.
- **Live while dragging:** the readout shows the drag row (8.4), the lead figure's weeks and study days roll, and planned mock marks re-spread.

**On release:**
- The flag settles to its day with `Springs.settle`.
- `roadPlanProvider.setExamDate(day)` is called; it is a phone write that exists.
- When the write returns, the receipt under the chips reads `Your date: Sat 8 May. Saved on this phone.` with a link `Use the expected date`. The link calls `setExamDate(null)`, and the flag springs back to 1 May with `Springs.smooth`.
- If the write throws, the flag springs back and the receipt reads `Could not save your date. Try again.`

**Tap on the flag** (no drag): opens the existing `showExamDateSheet(context, board: b)`, which is the accessible alternative with day-precise pickers. Keep that sheet; it is in `road_board.dart` today.

**Semantics:** a slider named `Your exam date`, value `1 May 2027, 28 weeks away`, with increase and decrease actions of 1 week. A double tap opens the sheet.

### 8.7 Tuner 1: study days a week (`road_tuners.dart`, `PaceStrip`)

**Look:**
- A row 48 dp tall with 7 equal stops (`(contentWidth) / 7`: 51.1 dp at 390, 46.9 at 360; the hit area is the full 48 dp height and never under 46.9 wide, which is accepted because the whole strip is one drag surface).
- The digits 1 to 7 in `type.labelLarge`, `ink3`.
- The selected stop is a volt pill, 44 x 40 with radius 20, showing the digit in ink, weight 700. It is not a second primary: it is a selection fill, used the same way as the bar's active state and the existing chips' selected fill. In Day the pill is volt with an `ink` 1 dp edge.

**Gesture:** a tap on a stop selects it, and a horizontal drag slides the pill across stops (1:1, snapping to the nearest stop with `Springs.snappy` on release). Vertical drags pass to the page.

**Live while dragging** (before saving):
- Every visible rail column eases its pip count to the new value: pips scale 0 to 1 or 1 to 0 over 160 ms with `Motion.out`, staggered 12 ms from left to right, capped at 10 columns.
- The lead figure's study-day count rolls.
- The caption shows the weekdays the new count will use.

**Which weekdays:** `adjustPlan(current, n)` in the new `logic/plan_adjust.dart`, which is pure and unit-tested.
- Adding a day picks the rest day with the largest circular gap to its planned neighbours; ties go to the earlier weekday.
- Removing a day drops the planned day whose neighbours are closest together; ties go to the later weekday.
- With no current plan, it uses `spreadDays(n)`, which exists.
- This keeps the student's own picks wherever possible. The caption names the result, and **Change days** opens the sheet to pick them exactly.

**Commit:** on release, or 400 ms after a tap.
1. The caption becomes `Saving...` (with an ellipsis character) and the pill keeps its new position.
2. `RhythmActions.saveStudyDays(days)` is called (exists: the goal on the server, then the weekdays where an endpoint exists, then the phone).
3. When it confirms, the caption becomes `Saved. Mon, Tue, Thu, Sat.` and the road's Mobi plays `nod` (section 11). After 2.4 s the caption returns to its resting text: `Mon, Tue, Thu, Sat.  Change days`.
4. When it fails, the pill springs back to the old stop (`Springs.smooth`), the pips ease back, and the caption reads `${LoadProblem.sentence} Your days stay at 3.` followed by a `Try again` link. Nothing claims success before the server answers (R17, T002).

**Semantics:** a slider named `Study days a week`, value `4 days, Mon, Tue, Thu, Sat`, with increase and decrease actions. **Change days** is its own button.

**Rhythm off or unread:**
- The strip shows with no pill and the caption `Pick how many days a week you will study.`
- The rail shows dashed single pips.
- If rhythm failed to load, the strip is disabled (`ink3`, no pill) and the caption reads `Study days did not load. Pull to refresh.`

### 8.8 Tuner 2: full mocks before your date (`MockRuler`)

**Look:**
- Label row: `Full mocks before your date` on the left (labelLarge), the value on the right (`type.figureCompact`, tabular).
- The ruler is 48 dp tall: ticks every 10 dp for each value from 1 to 60, a long tick every 5 values with its number (micro, ink3), and a fixed centre needle 2 dp wide in `ink` (volt in Night).
- The values already taken (≤ `mocksTaken`) are drawn in ink2, which shows the target can't sensibly go below them, though it can.

**Gesture:**
- A horizontal drag or fling scrolls the ruler under the needle. It uses a `ListWheelScrollView`-like horizontal `ScrollView` with `FixedExtentScrollPhysics`-style snapping to 10 dp.
- A `selection` haptic at every 5.
- A tap on a tick scrolls to it (glide 300 ms).

**Live:** planned mock marks on the rail re-spread as the value changes; the caption updates.

**Commit:** on scroll end, `roadPlanProvider.setMockTarget(n)` (a phone write). When it returns, the caption shows `Saved on this phone.` for 2.4 s, then the resting caption.

**Captions:**
- With a target: `7 taken, 7 to go: about one every 2 weeks.`
  - The interval comes from `daysPerMock`: 1 to 9 days says "every N days", 10 or more says "every N weeks", rounded.
  - When the target is met: `14 taken. Target met.`
- No target yet: the ruler rests at the suggested value (`suggestedMockTarget`, exists), dimmed to 50%. The caption reads `7 taken. Suggested: 14, about one a fortnight. Move the ruler to set it.` The first scroll sets it (T001: a default that is visible, editable and backed by data).
- Record not read: the label row value is `-`, and the caption reads `Your mocks did not load yet.`

**"7 taken"** is a link (underlined, ink). It opens the existing `showMocksSheet` (last mock date and **Start a full mock**), so the mocks sheet's content is kept.

**Semantics:** a slider named `Full mocks before your date`, value `14, 7 taken`, with increase and decrease actions of 1.

### 8.9 Jump chips

- Three chips under the rail: `Registration, in 15 weeks`, `Boards, in 17 weeks`, `CUET UG, in 28 weeks`. They reuse `MmChip`, 36 tall with a 48 hit area, in a horizontal `ChipRail`.
- The next stop's chip uses the selected style (exists as "Next" today).
- A tap scrolls the rail so the stop's first week sits at x = 48 (glide 300 ms with `Motion.glide`) and selects that week.
- A stop that has passed (registration once it is over) drops its chip.

They carry everything the old vertical stops list said. A stop's full dates ("February to March 2027") show in the readout when its week is selected, and in the chip's semantics label.

### 8.10 The lead-in pill (L07)

- Kept as `MoreBelowCue`, with a new label: `Road to May, ${weeks} weeks` (or `${days} days` under a week).
- Shown while the road's top is below the first screen and the page has not been scrolled (exists).
- A tap glides to the road (`emphasized`, 420 ms) and ends with the road's heading 16 dp under the status bar.
- At 1.3x text it stays inside its 32 dp gap: the label is clamped to 1.2x and drops ", 28 weeks" if it would overflow.

### 8.11 Moves ledger: nothing is cut

| Before (the 15 Oct board) | Now |
|---|---|
| Expected exam date tile and its date sheet | The draggable flag, the lead figure, and the date sheet (a tap on the flag) |
| Full mocks taken tile and its sheet (target stepper, Start a full mock) | The mock ruler, planned marks on the rail, and "7 taken" opening the same sheet |
| Study days left tile and its sheet | The lead figure's study line. The two-sheet chain is gone; **Change days** opens the one study-days sheet |
| This week tile ("1 of 4") | The readout's default line (`This week: 3 of 4 study days done`) and This week's column. The `Week` link opens the week |
| The painted timeline (lanes, bracket, month ticks, Now tick) | The rail (bands, weeks, months, This week) |
| Stops list with distances and "Next" | The jump chips plus the readout |
| Long-press scrub with a date readout | A tap selects a week and the readout shows it, which is a bigger target than a scrub and works with TalkBack |
| Mobi walking onto Now | Mobi standing on This week (section 11) |
| `sessionsLine` (when there is no board) | The lead figure's study line |
| `CollegeLadder` at the road's end | The Your colleges card (section 10) |

### 8.12 Gestures and conflicts (one table)

| Touch starts on | Horizontal drag | Vertical drag | Tap | Long press |
|---|---|---|---|---|
| Rail column | Scrolls the rail | Scrolls the page | Selects the week | Nothing (the scrub is retired) |
| Flag grip | Moves the date | Scrolls the page | Opens the date sheet | Nothing |
| Pace strip | Slides the pill | Scrolls the page | Selects a stop | Nothing |
| Mock ruler | Scrolls the ruler | Scrolls the page | Goes to the tick | Nothing |
| Jump chip row | Scrolls the chips (when they overflow) | Scrolls the page | Jumps | Nothing |

- Pull to refresh (`MmPullRefresh`) is unaffected because it only claims vertical overscroll at the top.
- Android Back is never claimed by these controls.

### 8.13 Motion summary for the road

| Moment | What moves | Duration and curve | It answers |
|---|---|---|---|
| The road first comes into view (`TodayReveal`) | Columns grow from their baseline, staggered 18 ms for up to 10 visible columns; bands fade in; the flag drops 8 dp | 260 ms `Motion.out`; bands 200 ms; flag `Springs.settle` | "Here is the plan, week by week" |
| First-ever visit | The rail peeks 56 dp right and back | `Springs.smooth`, about 700 ms in total | "This scrolls" |
| Select a week | Ring fade-in; readout fade-through | 160 ms; 90 ms out and 210 ms in | "This week is now described" |
| Pace drag | The pill moves 1:1; pips scale in or out | snap `Springs.snappy`; pips 160 ms `Motion.out`, 12 ms stagger | "Every week changes with your pace" |
| Flag drag | The flag moves 1:1; end columns grow or shrink | columns 180 ms `Motion.out`; settle `Springs.settle` | "The road gets longer or shorter" |
| Mock ruler | The ruler scrolls; marks re-spread | marks cross-fade 160 ms | "Your mocks spread across the weeks" |
| Saved | The caption cross-fades; Mobi `nod` | 200 ms | "The server (or the phone) has it" |
| Save failed | The control springs back; the error caption appears | `Springs.smooth`, then 200 ms | "Nothing changed" |
| Jump chip | The rail glides | 300 ms `Motion.glide` | "That stop is here" |

Reduced motion: every duration becomes 0, or a 120 ms fade for text. No peek, no stagger, no flag drop. Drags still track the finger, because direct manipulation is not decoration (R31).

Performance on a 2 GB phone:
- At most about 9 columns are built.
- Pips are one `CustomPainter` per column inside a `RepaintBoundary`. Bands and the flag are one overlay painter repainted from a `ValueListenable` of the scroll offset.
- No `BackdropFilter` and no shadows on the rail.
- Target: under 5% janky frames in `dumpsys gfxinfo` during a 10 s drag.

### 8.14 Night and Day

- **Night:** pips planned `ink3` at 0.55, counted volt. The flag is volt with ink text. Bands use `raised2` fill and `ink2` labels. The needle is volt.
- **Day:** pips planned `ink3` at 0.35, counted volt with a 1 dp ink edge (as the week ledger). The flag is volt with ink text and a 1 dp ink edge. Bands use `raised2` and `ink2`. The needle is `ink`.
- Every text item on the road reaches 4.5:1 on `ground` in both themes. The micro labels (11 to 12 sp) use `ink2` or `ink3` only where the token passes. The builder checks with the existing contrast test helper in the goldens.

### 8.15 Data and logic (pure, tested)

New `features/today/logic/road_weeks.dart`:

```dart
class RoadWeek {
  final DateTime monday;          // student's local date
  final int planned;              // study days planned (0 when no goal)
  final int? done;                // this week only
  final bool boards, registration, exam;
  final int plannedMocks;         // 0, 1 or 2
  final bool paused;              // this week only
}

List<RoadWeek> buildRoadWeeks({
  required DateTime today,
  required DateTime examDate,
  required int? goal,
  required int? weekDone,
  required bool paused,
  required int? mocksLeft,
  required List<RoadStop> stops,
});
```

- The sum of `planned` over the weeks after this one, plus this week's remainder, must equal `sessionsUntil(today, examDate, daysPerWeek: goal)` as `RoadBoard.studyDaysLeft` uses it today. A unit test asserts that, so the lead figure and the pips can never disagree.
- `RoadBoard`, `buildRoadBoard`, `RoadPlan` and `RoadPlanStore` are kept as they are. The rail and the tuners read `RoadBoard` for their numbers.

### 8.16 Mobi on the road

See section 11. He keeps the existing presence rule (`TodayMobiPresence`): the road's Mobi is built only while the header Mobi is out of view.

---

## 9. The study-days sheet, rebuilt (L06)

**Ownership:**
- The Today builder changes every Today call site to open this one sheet directly. In `road_board.dart`, `_StudyDaysSheet` and `showStudyDaysSheet` are deleted.
- `features/rhythm/widgets/goal_editor.dart` and `rhythm/copy.dart` belong to the **You area** (IA section 10). This section is the spec they build to; it is listed under "Requests to other areas".

**Job:** "Pick the days I will study each week, and see what this week already holds."

**Primary action:** `Save 4 days a week`. The label carries the live count.

### 9.1 Layout (390 dp)

```
.------------------------------------------------.
|                   ----                         |  grabber
| Study days                                     |  sheet title (exists: RhythmCopy.daysTitle)
|                                                |
|  4   days a week                    [Mobi 56]  |  MonumentalNumber 64 + stageLead; Mobi listens
|      Rest on Wed, Fri and Sun.                 |  body, ink2
|                                                |
|  (Mon) (Tue) ( Wed ) (Thu) ( Fri ) (Sat) ( Sun )|  7 day toggles, each 48 x 56
|                                                |
|  [3 days] [4 days] [5 days] [Weekdays]          |  presets (exist)
|                                                |
|  This week: 3 of 4 done                        |  labelLarge, ink
|  [#][#][#][ ]   Mon, Tue and Thu counted.      |  4 mini pips (goal segments), caption
|                                                |
|  98 study days to 1 May at this pace.          |  caption, ink2 (from sessionsUntil)
|                                                |
|  [========= Save 4 days a week =========]      |  KeyButton, volt
'------------------------------------------------'
```

### 9.2 Rules

- **No ring in this sheet.** `WeekDial` stays on You and in the week sheet. There it must use `showWords: true`, so it always reads "3 / of 4 study days"; the You area checks this.
- **The big number is the goal being chosen.** It changes with every toggle and rolls with `numberRoll` (300 ms here).
- **"This week" is a labelled count with its denominator:** `This week: ${done} of ${goal} done`, where `goal` is the number currently chosen in the sheet, so it follows the choice. The pips are `goal` small segments, `done` of them filled.
  - Done more than the goal: `This week: 5 done. Goal met.`, with all pips filled and a volt underline under "Goal met".
  - Rhythm unread: the line is hidden; nothing is claimed.
- **One sheet.** It opens directly from the pace strip's **Change days**, the week sheet's change key, the week ledger's chevron menu (if any), the You tab and onboarding. Never a second sheet over a first.
- **Day toggles:** 48 x 56. Selected: volt fill, ink weekday label, weight 700. Rest: a dashed outline and `ink3`. The label is always the weekday name ("Mon"), never only a colour (R36). A `selection` haptic on each toggle. At least 1 day must stay selected: tapping the last one plays a 2 dp shake (120 ms) and shows the caption `Keep at least one day.`
- **Save:**
  1. The key shows a spinner.
  2. `saveStudyDays(days)` runs. The sheet stays open until the server confirms the goal.
  3. On success the receipt line takes the key's place: `Saved. 4 days a week.`, plus `studyDaysReceipt` when the weekdays stay on this phone (exists). Mobi plays `nod`, and the sheet closes after 700 ms. It returns the count (exists: `showMmSheet<int>`).
  4. On failure the key returns, and an error line above it reads `${LoadProblem.sentence} Your days stay at 3.` Nothing elsewhere changes.
- **Mobi:**
  - 56 dp, to the right of the number.
  - `listen` once the student starts choosing (exists: `_choosing`).
  - `think` when 6 or 7 days are chosen, with no bubble (the body line already says "Rest on Sunday." or "No rest day.").
  - `nod` on a confirmed save; `oops` on a failed save.
  - This is the only Mobi in the sheet.
- **Copy** (`rhythm/copy.dart`):
  - `daysChosen(n)`: `${n} days a week`, or `1 day a week`
  - `restOn(list)`: `Rest on Wed, Fri and Sun.`, or `No rest day.` at 7
  - `thisWeekOf(done, goal)`: `This week: 3 of 4 done`
  - `thisWeekMet(done)`: `This week: 5 done. Goal met.`
  - `countedOn(list)`: `Mon, Tue and Thu counted.`, or `Nothing counted yet this week.`
  - `paceLeft(n, date)`: `98 study days to 1 May at this pace.`
  - `saveDays(n)`: `Save 4 days a week`
  - `keepOne`: `Keep at least one day.`
  - Retired: `RhythmCopy` lines that say "The number of days is your goal, saved to your account. Which days stays on this phone." That is build talk and filler; the receipt says the truth after saving instead.

---

## 10. Your colleges card (IA 5.2, owned by Today)

It replaces `CollegeLadder` at the road's end and `ToolsQuietLink` (`today_routes.dart:17`). It sits after Recent papers as the last block. It reads only `my_colleges_actions.dart`'s public API and a count provider from Colleges (request R-C1).

**With colleges:**

```
 Your colleges                         See all >     heading + link (goes to /colleges)
 Hansraj, B.Com (Hons)                     645.3     2026 Round 1, your category
 SRCC, B.Com (Hons)                        668.0
 Kirori Mal, B.Com (Hons)                  637.5
 Round 1 closing scores, 2026, unreserved.           caption ink3
```

- Rows are 56 tall. A tap on a row opens Compass for that programme (`/tools/compass/:groupId?from=today`).
- No estimate is shown here (Colleges owns the estimate comparison).

**Without colleges:**

```
 Your colleges
 35 of 73 DU programmes open to your subjects.       body (from Colleges' count)
 [ Choose colleges ]        Open Compass              secondary key + text link
```

- **Choose colleges** opens `showMyCollegesSheet(adding: true)` over Today (exists, L25).
- **Open Compass** pushes `/tools/compass`.
- These are not volt: the hero keeps the page's one volt key (R7).

**States:**
- Loading: a 3-row skeleton.
- My colleges failed: `Your colleges did not load.` with `Try again`.
- Count unknown: `See which DU programmes your subjects open.`

---

## 11. Mobi and motion on Today (L34, L35, L36, L37)

### 11.1 Mobi: one in view at a time, each a real moment

| Where | When | Act | It answers |
|---|---|---|---|
| Header | Normal mood, data ready | `idle`. `hello` on tab reselect (exists) | Present, calm |
| Header | While the first read runs (S1, S2) | `loading` | "Getting your record" |
| Header | Recovery from S9 or S10 to a move | `nod` once | "Got it" |
| Hero | Day one (S11) | `talk` "Let's find your marks." (exists) | The first move |
| Hero | Returning or late night | `hello` or `sleepy` (exists) | The human moment |
| Hero | S9 or S10 failure | `oops` once per failure run; `loading` during Try again | "It did not load; I'm trying" |
| Road (only while the header Mobi is out of view) | Arrives on This week's column, 30 dp; walk-in once per app run (exists) | `walk`, then `idle` | Orientation: "you are here" |
| Road | A pace save in flight, then confirmed or failed | `loading`, then `nod` or `oops` | The save's truth |
| Road | Tap on Mobi | `point` at the next stop, with the caption `Registration, in 15 weeks` for 2.8 s (exists) | "What's next" |
| Study-days sheet | Choosing, a full week, a saved or failed save | `listen`, `think`, then `nod` or `oops` | Section 9 |

- Header and hero never both show a Mobi (exists: the header Mobi hides when the hero is a Mobi).
- No Mobi in the colleges card or on Recent papers.
- **Placement of the road's Mobi:** feet on the pips' baseline at the left of the This week column, never covering a pip. He is not built when the text scale is above 1.3 or ambient motion is off (`SubjectEmblem.idleEnabled`), which is the existing gate.

### 11.2 Motion judged in use (L34)

Today's motion list is closed: the page entrance (exists, 420 ms), the hero swap, the key pulse when the capsule returns (exists, 160 ms), the week ledger's pop (exists), the road (8.13), the sheet (9.2) and the state swaps (4.5). Nothing loops except Mobi's `idle` breathing and This week's breathing ring in the ledger (exists, off under reduced motion).

### 11.3 One spacing system and parity (L36)

- Only `MmSpace` and `MmRhythm` tokens: gutter 16, inner 12 or 16, group 32.
- The road's inner gaps:
  - heading to figure: 16
  - figure to readout: 20
  - readout to rail: 12
  - rail to chips: 12
  - chips to tuner 1: 24
  - tuner 1 to tuner 2: 24
  - tuner 2 to receipt: 8
- Every golden is run in Night and Day. Day uses `accentText` wherever Night uses volt for text.

### 11.4 Subject art (L37)

Section 5.

---

## 12. Accessibility

- **Targets:** the rail columns are 48 wide. Flag grip 48 x 152, pace stops ≥ 46.9 x 48 (the strip is also one drag surface), ruler 48 tall, chips 48 hit, day toggles 48 x 56, the status line 48 tall.
- **TalkBack order:** heading, figure, readout, rail (weeks as buttons: `Week of 9 Nov, 4 study days planned, planned mock, 3 weeks from now`), flag (slider), chips, pace (slider), Change days, mock ruler (slider), 7 taken (link).
- **Text scale:** rail labels are clamped at 1.3. The lead figure wraps. Tuner rows stay single-column. The hero follows section 5.
- **Reduced motion:** section 8.13 and 4.5.
- **Colour is never alone:** pips also differ by fill versus outline; bands carry text labels; the selected week has a ring, not only a tint.

---

## 13. Emulator acceptance steps (what the screen must show)

Setup is the ledger's: emulator `mockmob_budget` (2 GB RAM; check free RAM first), the newest debug build from `wt-phase2/flutter_app`, and test accounts **A** (2 or more finished mocks, open mistakes, a name) and **B** (fresh). Never the owner's account. Run each check in Night and Day, at 360x800 and 412x915, and once at 1.3x font size. Take a screenshot at the end of each check.

**L01: main card states**
1. A, network on, cold start: within 5 s the hero shows a subject, a number with its words, and the volt start key. No failure card. If the plan read is failing on that account, the card is still a move (S6). Check with logcat: a plan error is logged while the card shows a move.
2. B, cold start: the day-one card ("10 questions to your starting point", Start now, 10 min), no failure text.
3. A, then airplane mode, force-stop, reopen: the header line reads "Updated [time]. You are offline."; the card is the cached move with the key disabled and "Needs a connection to start." above it. Turn the network on: within about 2 s the line returns to the date with no tap, and the key enables.
4. Clear the app's data, sign in as A, turn airplane mode on before Today loads: the card reads "You are offline" / "Tonight's move needs your record. It loads when you reconnect." / "Trying again as soon as you reconnect." with Try again; Mobi shrugs once. Tap Try again: a spinner for about 1 s, then "Tried again at [time]. Still not loading." Tap again: the time changes. No snackbar appears. Turn the network on: the card rises into the move and the header Mobi nods.
5. A failing server: point the debug build at a stopped staging port (`adb reverse --remove tcp:3101`), clear data, open: the card reads "Tonight's move did not load" plus a named cause (for example "Something went wrong on the way. Try again in a moment." or "MockMob took too long to answer."), with Try again and Practise anyway. Practise anyway opens Practice.
6. In none of these states does the "Your record" card show data while the hero shows a failure.

**L02: spacing and art**
On A, Today, Night then Day, at both sizes:
- The object sits at the card's top right with its top level with "Tonight's move".
- No empty band taller than one text line inside the card.
- Nothing clipped, and nothing touching the card's top.

At 1.3x text, the number block sits under the object with no overlap. Repeat with B (the Mobi hero): the same rules.

**L03: no late sections**
On A, emulator network speed "gprs", cold start:
- From the first frame the week area shows its placeholder, the hero its skeleton, and the record card its reserved block.
- After data arrives nothing above the fold moves by more than 0 dp. Check with two screenshots, at 1 s and at 6 s: the top of the road pill is at the same y.
- Finish a quick practice and return to Today: no block appears without its opening animation.

**L04: Back**
- On Today press Back once: "Press back again to close", and the app stays.
- Press Back again within 2 s: the app closes.
- From Practice, Back goes to Today.
- With the study-days sheet open, Back closes the sheet only.
- With a rail week selected, Back behaves as on plain Today.
- During a flag drag, Back is not swallowed (the drag cancels and the flag springs back).

**L05: the adjustable road**
On A, scroll Today to the road.
1. The lead figure reads "[N] weeks to CUET UG / expected from 1 May 2027" and "[S] study days at [goal] a week, 2 in boards weeks."
2. Swipe the rail left: the weeks scroll and the months pass. Swipe vertically over the rail: the page scrolls, not the rail.
3. Tap a November week: the readout reads "Week of [d] Nov: [goal] study days" (plus ", mock x of y" if it holds one) and "[n] weeks from now".
4. Tap the "Boards" chip: the rail glides to February, and the readout says "2 study days, Class 12 boards".
5. Scroll to the end and drag the CUET UG flag right by a week: the flag follows the finger, the label becomes "Your date", the readout shows "Your date: [day] May 2027" and "[N+1] weeks, [S'] study days at [goal] a week", the lead figure's numbers roll, and a column is added. Release: "Your date: [d] May. Saved on this phone." Force-stop and reopen: the date is kept. Tap "Use the expected date": the flag springs back to 1 May.
6. Drag the pace strip from 4 to 5: every visible column gains a pip while dragging, the lead figure's study days rise, the caption names five days, then "Saving..." and then "Saved. Mon, Tue, Wed, Thu, Sat." Open You: Study days shows 5. Force-stop and reopen: still 5.
7. Scroll the mock ruler from the suggested value to 10: planned mock marks re-spread on the rail, and the caption reads "[t] taken, [10−t] to go: about one every [k] weeks." Force-stop and reopen: 10 is kept.
8. Airplane mode, pace 5 to 3: after release the pill springs back to 5, and the caption names the offline cause and "Your days stay at 5."
9. With "Remove animations" on, repeat 5 and 6: the same results with no animation.
10. TalkBack: swipe to the flag, then volume-key adjust (increase): the date moves 1 week and is announced.

**L06: the study-days sheet**
On A with 3 days counted this week, tap Today → road → **Change days**.
- Exactly one sheet opens.
- Pick Mon, Tue, Thu, Sat: the big number reads "4" and "days a week", and "This week: 3 of 4 done" shows 4 pips with 3 filled.
- Pick a 5th day: the line becomes "This week: 3 of 5 done".
- Back to 4, then Save: "Saved. 4 days a week.", Mobi nods, and the sheet closes.
- The pace strip shows 4, the readout shows "This week: 3 of 4 study days done", and the week ledger reads "3 of 4 study days". You shows 4.
- Force-stop and reopen: still 4.
- Airplane mode, change to 2 and Save: the error line shows, and 4 stays everywhere.

**L07: the lead-in**
On A at 360x800, Today:
- Under the hero, a pill "Road to May, [N] weeks" with a chevron.
- Tap it: the page glides until the road's heading is near the top.
- Scroll back up: the pill is gone for this visit.
- At 1.3x text it does not overlap the hero.

**L34 (Today):** run `adb shell screenrecord` for 60 s covering a cold start, the hero swap, scrolling to the road, a pace drag, a flag drag, opening and saving the study-days sheet, and Try again in S9. Every transition must be continuous. `adb shell dumpsys gfxinfo in.mockmob.app` must show under 5% janky frames.

**L35 (Today):** at every scroll position and in every state above, at most one Mobi is visible, and each one plays the act in section 11.1 for that event.

**L36 (Today):** Night and Day screenshots of the same state show the same gaps (16 / 32), with no low-contrast text in Day.

**L37 (Today):** Accountancy, Business Studies, Computer Science and English each appear in the hero: the object reads as its subject at 104 dp and is not cropped. A subject without art shows initials.

---

## 14. Tests and goldens the builder adds

Unit tests (`test/unit/today/`):
- `move_builder_partial_test.dart`: `recordUnavailable` with attempts present gives a move, not `historyUnavailable`. No attempts plus failed gives `historyUnavailable` with the named problem.
- `road_weeks_test.dart`:
  - Column count from this week to the exam week.
  - Boards weeks are capped at 2.
  - The sum of planned days equals `sessionsUntil` for goals 1 to 7 and three exam dates.
  - Mock spread: even, boards skipped, 2 per week on overflow.
  - Days mode at ≤ 21 days.
- `plan_adjust_test.dart`: add and remove for every set size, with stable ties.
- `retry_status_test.dart`: the `failTried` time updates per tap, and no snackbar is shown.

Widget tests:
- `road_rail_gesture_test.dart`:
  - A vertical drag over the rail scrolls the page.
  - A horizontal drag on the flag changes the date and saves on release.
  - A horizontal drag on the rail scrolls it and does not change the date.
  - Pace drag commit: the save is called once, and a failure springs back.
- `hero_spacing_test.dart`: the gap rules in section 5 at 360, 412 and 1.3x.

Goldens (`test/golden/today/`, Night and Day, 390 unless noted):
- `today_partial_plan_failed`
- `today_fail_offline_nocache`
- `today_fail_busy`
- `today_fail_tried`
- `today_refresh_failed_header`
- `today_road_rail`, also at 360 and at text 1.3
- `today_road_week_selected`
- `today_road_flag_dragging`
- `today_road_pace_saving`
- `today_road_save_failed`
- `today_road_no_goal`
- `today_road_days_mode`
- `today_colleges_card_some`
- `today_colleges_card_none`
- `study_days_sheet_open`, `study_days_sheet_met`, `study_days_sheet_failed` (You area: `test/golden/rhythm/`)

Retired goldens:
- `today_road_*` from the old painter: regenerated. `today_road_window_*` is kept.
- `today_error_*` is replaced by the `today_fail_*` goldens.
- `goal_editor_*` is replaced by `study_days_sheet_*`.

---

## 15. Anti-slop test and rubric (design stage; not verified on a device)

The 12-part test:

| # | Check | Verdict |
|---|---|---|
| 1 | Identity | The road is specific to CUET: boards weeks at 2, registration, the expected window, mocks against a target |
| 2 | One action | The hero key. The road's controls are selection controls, not calls to action |
| 3 | True content | All numbers come from the calendar, rhythm, the record and the student's own choices. "Expected" is on every date NTA has not set. Planned mocks are labelled planned |
| 4 | Hierarchy | Tonight's move first, then the road's figure |
| 5 | Composition | One 16 dp gutter and the gap table in 11.3 |
| 6 | Typography | Roles: countdownFigure, stageLead, labelLarge, body, caption, micro |
| 7 | States | Sections 4, 8.7, 8.8 and 9: loading, slow, empty, partial, error, offline, saving, saved, failed |
| 8 | Access | Section 12 |
| 9 | No pseudo-evidence | No predicted marks or chances. "Saved" appears only after the save returns |
| 10 | Motion rationale | Table 8.13 |
| 11 | Measured usability | Leading metric: the share of road visitors who change a tuner or the date at least once a week. Guardrail: pace changes undone within 24 h (a sign of confusion) |
| 12 | Human critique | The four tiles are removed as boxes but kept as functions; the stops list became chips. Nothing is decorative: the rail's Mobi has a job (you-are-here and save truth) |

Rubric (0/1/2), design stage only: every dimension is at most 1 until the emulator checks in section 13 pass. The owner signs off.

---

## 16. Requests to other areas (IA rule 2)

| Id | To | Request |
|---|---|---|
| R-Y1 | You | Rebuild `features/rhythm/widgets/goal_editor.dart` per section 9, with the strings in `rhythm/copy.dart`. Keep `showGoalEditor(context, initialDays, done)`'s signature, so Today's call sites stay simple. Make sure every `WeekDial` on You and in `week_sheet.dart` uses `showWords: true` at sizes ≥ 120. |
| R-Y2 | You | `RhythmActions.saveStudyDays` must throw on a failed server goal save before touching the phone plan, so a failure leaves "3" everywhere. It awaits in order today; confirm no partial write. |
| R-C1 | Colleges | Expose `compassOpenCountProvider` (`({int open, int total})?`) from `features/tools/data/` for the colleges card's "35 of 73". |
| R-C2 | Colleges | Delete `ToolsQuietLink` once Today stops using it (`today_routes.dart`). |
| R-R1 | Review | `InsightsCard` exposes whether its finding read is still loading (a public provider or a `ValueListenable<bool>` passed to Today), so Today can reserve the slot (section 6). |
| R-S1 | Shell | None. L04 behaviour stays in `app_shell.dart`. |
| R-M1 | Mobi and motion | None new. The acts used all exist (`loading`, `oops`, `nod`, `listen`, `think`, `point`, `walk`, `idle`, `hello`, `sleepy`, `talk`). |

---

## 17. Owner sign-off questions

1. Is the road you can scroll and drag (a week rail, a draggable CUET flag, and two tuners for days a week and mocks) the "adjustable in the scrolling" you meant?
2. The road moves above Recent papers. Agreed?
3. When the server's suggestion fails but your papers are on the phone, Today shows a move built from your papers with no error. Agreed?

---

## 18. Files to change

**Today area** (`wt-phase2/flutter_app/lib/features/today/`):

| File | Change |
|---|---|
| `logic/move_builder.dart` | The `historyUnavailable` rule (4.1); failure hero fields (title, body, status) |
| `logic/today_inputs.dart` | `readProblem` from attempts or plan (moved from the screen); `lastTriedAt`; `refreshFailed` (S7); `loadingSince` for S2 |
| `logic/today_model.dart` | `MoveHero` gains `failStatus` and `secondary` (nullable); `RoadModel` gains `weeks: List<RoadWeek>` |
| `logic/today_builder.dart` | Builds `RoadModel.weeks` with `buildRoadWeeks` |
| `logic/road_weeks.dart` | **New** (8.15) |
| `logic/plan_adjust.dart` | **New** (8.7) |
| `logic/road_board.dart` | Unchanged API; still feeds the numbers |
| `copy.dart` | New strings (4.3, 4.4, 8.3, 8.4, 8.6 to 8.10, 10); retire `unavailableTitle`, `unavailableLine` and the tile-only `board*` strings (keep those the sheets still use) |
| `screens/today_screen.dart` | Delete `_sayIfStillFailing` and the snackbar; set `lastTriedAt`; auto-retry on reconnect and resume (S9, S10) |
| `screens/today_body.dart` | New order (road before Recent papers); reserved insights slot; pill label; colleges card at the end; drop `roadFooter` |
| `widgets/today_header.dart` | Status line variants (4.4) with the tappable refresh |
| `widgets/today_skeleton.dart` | S2 slow line and Try again |
| `widgets/move_hero.dart` | Failure layout (4.3); spacing rules (5) |
| `widgets/hero_stage.dart` | Object box 104, top alignment, `Clip.none`, 1.3x wrap |
| `widgets/number_block.dart` | Spacing to the subject title (8 dp) |
| `widgets/road_section.dart` | Rebuilt (8.2) |
| `widgets/road_rail.dart` | **New**: the rail, overlay painter, flag grip, peek, days mode |
| `widgets/road_readout.dart` | **New** |
| `widgets/road_tuners.dart` | **New**: `PaceStrip`, `MockRuler`, the receipt line |
| `widgets/road_board.dart` | Remove `RoadBoardGrid`, `_Tile` and `_StudyDaysSheet` / `showStudyDaysSheet`; keep `showExamDateSheet` and `showMocksSheet` |
| `widgets/road_timeline.dart` | **Delete**, together with `RoadStops`, after `road_rail.dart` lands. Move `roadDistance` and `roadNextIndex` into `logic/road_weeks.dart` |
| `widgets/college_ladder.dart` | Rename to `widgets/colleges_card.dart` and rebuild per section 10 |
| `today_routes.dart` | Remove `roadFooter: ToolsQuietLink()` and its import |
| `data/road_plan.dart` | Add the `road_rail_peek` flag read and write |

**You area** (by request R-Y1, R-Y2): `features/rhythm/widgets/goal_editor.dart`, `features/rhythm/copy.dart`, `features/rhythm/screens/week_sheet.dart` (the `showWords` check), and `features/rhythm/data/rhythm_providers.dart` (the save order check).

**Colleges area** (R-C1, R-C2): `features/tools/data/` (count provider) and `features/tools/tools_routes.dart` (remove `ToolsQuietLink`).

**Review area** (R-R1): `features/insights/` (the card's public loading state).

**Tests:**
- `test/unit/today/move_builder_partial_test.dart`, `road_weeks_test.dart`, `plan_adjust_test.dart`, `retry_status_test.dart`
- `test/widget/today/road_rail_gesture_test.dart`, `hero_spacing_test.dart`
- New and regenerated goldens in `test/golden/today/` and `test/golden/rhythm/` (section 14)
- Update `test/golden/today/today_golden_test.dart` and `today_golden_support.dart` for the new fixtures (partial, failure variants, road states)
