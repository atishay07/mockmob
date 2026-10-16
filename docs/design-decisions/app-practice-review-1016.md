# Practice and Review, build brief, 16 Oct 2026 (area designer: practice-review)

Status: **decided for the builders; owner sign-off pending** (section 12). Design only: no code was changed, nothing was committed, nothing was run on a device or emulator.

Covers ledger items **L08 to L15** (`docs/brain/APP-OWNER-LEDGER-2026-10-16.md`) and, for these screens, **L34 to L37**. It works inside the IA lead's decisions (`docs/design-decisions/app-ia-1016.md`): the six-slot bar, Practice as tab 1, Review as tab 3, one primary action per tab root (Practice: start the chosen mode; Review: repair tonight's mistake), Mobi at most once per screen, and the ownership map in its section 10.

Read for this brief (all on `ui/phase2`, `wt-phase2/flutter_app`, at 3887e786 plus the other agents' uncommitted edits):
- `lib/features/practice/practice_screen.dart`, `copy.dart`, `data/suggestion.dart`, `data/default_subject.dart`, `widgets/more_rows.dart`, `widgets/composer_ticket.dart`, `widgets/exam_sheet_start.dart`, `widgets/finish_stage.dart`.
- `lib/features/review/screens/review_screen.dart`, `copy.dart`, `widgets/mistake_view.dart`, `widgets/review_rows.dart`, `widgets/answer_sheet.dart`, `data/repair_run.dart`, `data/retry.dart`, `revise/revise_entry.dart`, `revise/revise_copy.dart`.
- `lib/features/result/full/full_result_screen.dart`, `full/swot_section.dart`.
- `lib/core/motion/motion_tokens.g.dart`, `lib/core/mascot/mobi_acts.dart`.
- `docs/design-decisions/ui-phase2-repair4.md`, `docs/brain/VISION-INVENTORY-2026-10-16.md` (rows A.9, D.5-2, and the CEO decision of 16 Oct 02:20), `docs/brain/CTO-LOOP.md`.
- Goldens opened: `practice/goldens/tab_new_day.png`, `tab_choose_concepts_night.png`, `exam_band_360_large_day.png`, `quick_start_deck_night.png`, `nta_start_mid_night.png`, `finish_settled_night.png`; `review/goldens/review_tab_full_night.png`, `review_tab_empty_day.png`.
- Owner capture `scratchpad/dev/now1.png` (Today, Day theme, 16 Oct 10:33). `v10-launch.png` and `v10-now.png` were **not in the folder**, so they were not seen.
- Rules: `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (cited as R7, R8 and so on), the evidence index (T001 to T009, S010 to S018), and the owner's UI standards (`AI OS/wiki/concepts/ui-ux-standards.md`, sections 8 and 13).

The other skills the task listed (impeccable, frontend-design, emil-design-eng, high-end-visual-design, redesign-existing-projects, design-taste-frontend) were **not loaded**, to save context. The owner's standards and AGENT_RULES were applied instead, since they win where the skills disagree.

---

## 0. The user, the job, the facts that drive the design

**The user.** A Class 12 Commerce student on a budget Android phone, studying for CUET UG 2027 in the evening. They have 10 to 40 minutes.

**Their two questions:**
- On Practice: "What do I practise, in which subject, and how long will it take?"
- On Review: "Where did I lose marks, and how do I win them back?"

**What the code shows, which the design has to answer:**

1. **L08: the hero and the tiles can name two different subjects.**
   - With no explicit pick, `practiceSuggestionProvider` follows the latest paper (`suggestPractice`, branch "no pick").
   - The tiles and the modes follow `defaultPracticeSubject`, which puts the account's saved subjects first.
   - For the owner's account, the subject line and the modes said English while the hero was built from another paper's subject. That is exactly his "first the top English subject, then a few modes, then subject selection".
   - Fix: **one subject state** that the strip, the hero and the modes all read (section 2.3).
2. **L12: what made the empty state show is fixed in data.** Commit 3887e786 ("plainBody calls got an empty body, so Today, Review and the college list failed for every account") is the most likely cause. dd5a1500 had already stopped an unreadable body from counting as "no record". The design still makes the empty state impossible unless the attempts read **succeeded and returned an empty list** (section 3.3).
3. **L14: "Review again".**
   - No control in the app is labelled "Review again".
   - The control that most closely does what the words say is Revise: "Questions you got wrong come back after 1, 3, 7 and 21 days". But `ReviseEntry` hides itself whenever the Revise read is unavailable, and Revise is built but **not live on the server**. A student who once saw it, or who expects it, finds nothing that works.
   - The other candidates are "Try it again" on a skipped row, "Try it again" on a result card, and "Try the same mistakes again" at a repair's end. All three depend on the attempts read that L01 and L12 broke.
   - Decision: build **one named control, "Review again"**: a re-practice of the mistakes the student has already repaired or read, with the key hidden until they answer. It runs from data already on the phone, so it works whether or not Revise is live (section 5).
4. **L13: the repair still starts by spending the credit and showing the key.**
   - `MistakeView` calls the repair as soon as a step opens. While it waits, the question shows without the key; then the key and the explanation land together.
   - Built so far: Check it held, Ask Mobi about Qn, the trap pattern and Revise.
   - Missing: **retry before the key**. The CEO decision of 16 Oct 02:20 and `VISION-INVENTORY` row 108 both list it as missing. This brief designs it (section 4).
5. **L15: the SWOT is built but sits near the bottom of the full result**, after up to eight sections (`full_result_screen.dart` lines 316 to 377), and the recap does not show it (D.5-2). `features/result/**` is "unchanged this round" in the IA ownership map, so the move is a request to that owner (section 10). Review gets its own surface for the SWOT's next step (section 3.2, block H2).

Evidence discipline: every non-obvious choice below carries a rule number or an evidence ID. Nothing here claims a test result, a conversion number or the owner's approval.

---

## 1. Decisions at a glance

| # | Decision | Items | Evidence |
|---|---|---|---|
| P1 | Practice reads top to bottom: **subject first** (the strip), then **Up next in [subject]** (the one lit start), then **Ways to practise** in one fixed hierarchy: Quick practice, By chapter, Smart practice, then the Exam conditions band (Full mock, NTA mode), then More, then Concepts. | L08 | R7, R8, R12 |
| P2 | One subject state. The default subject is the latest paper's subject when it is one of the student's subjects; otherwise the first saved subject. The hero always follows the selected tile, except for a session still open, which always leads. | L08, L11 | T001 (defaults from real context), R8 |
| P3 | Changing subject never rebuilds the modes: they stay in place and only their notes cross-fade. The hero cross-fades in place. | L08 | R31; L08 acceptance ("keep the modes in place") |
| P4 | The NTA and Smart gated notes say what the mode is first, then "Comes with Pro." The NTA panel stays sized from its grid. | L09 | R30, R36 |
| P5 | The start moments stay as built: the clock turns one lap on Full mock; the NTA sheet slides up and its stamp lands. Exact timings and acceptance are below. | L10 | R31 |
| R1 | Review hero: tonight's repair, with a specific key, "Repair 3 mistakes, 10 min". | L12 | R7, T003 |
| R2 | The empty state shows only when the attempts read succeeded and returned an empty list. New words: "Nothing to review yet." | L12 | R35, R17 |
| R3 | **Retry before the key:** each fresh repair opens on "Try it once more" with the old pick marked. "Check my answer" sends the retry with the paid call. The verdict comes in words, then the reason, the trap, Check it held and Ask Mobi. | L13 | R16, R18, R23, R24, T006, T008 |
| R4 | **Review again**, a new page at `/review/again`. Up to 10 repaired or read mistakes, each answered before its key shows, judged on the phone. Revise's due cards go first when Revise is live. One entry row on Review replaces the Revise row, and Practice's More list links to it too. | L14 | R10, R35, S014 |
| R5 | Review's History side opens with **"Next from Mock 2"**: the SWOT's top weakness and its first plan row, opening a filled-in practice setup. The full-result move is a request to the Result owner. | L15 | R8, MockMob overlay (next move with evidence) |
| M1 | Mobi, once per screen: Practice header (exists); Review header, as the face on the Ask Mobi pill (new); empty and all-clear states; the repair (new acts during the retry); the Review again verdict and end. No Mobi in the Start sheet's tiles, the start moments or the timed paper. | L35 | R31, S017 |

---

## 2. Practice tab (`/practice`)

### 2.1 Job and primary action
- **Job:** choose a subject, then how to practise it, and start.
- **Primary action:** the lit **Start** key in "Up next" (one volt key on the page, R7). The mode tiles are secondary: they open the confirm sheet or the chapter picker, and nothing starts on the tab itself. No cost is shown on this tab; costs stay on the confirm sheet (the existing rule in `copy.dart`).

### 2.2 Order, top to bottom, with exact copy

| # | Block | Copy | Widget (reuse or change) |
|---|---|---|---|
| A | Header | Avatar (opens the account sheet), title **"Practice"**, Mobi 44 dp trailing | `TabRootHeader` + `PracticeMobi` (reuse) |
| B | Notices (only when true) | Refresh failed: "We could not refresh Practice. Showing what was here before." with "Try again". Session open while offline: "Connect to start. Your downloaded reviews still work." Stale subjects: the existing banner. | `PlainNotice`, `StaleSubjectsBanner` (reuse) |
| C | Subject strip | Heading **"Practise in"**; action **"Edit subjects"**. Tiles: the subject object, the name, and "1,240 questions" as a caption under the name (from `countFor`); the last tile is **"More subjects"**. | `SectionHeading` + `SubjectTiles` (move to the top; add the count caption inside the tile) |
| D | Up next | Overline **"Up next in Accountancy"**, or **"Still open"** for a resume, or **"This one, then sleep"** after 11 PM. Title: the chapter, or "Your starting point", or "[Subject] practice" for a resume. Kicker: "Accountancy, one chapter" / "Accountancy, mixed chapters". Figure: **"10"** + "questions" (resume: "23 of 50"). Reason: "It cost you 18 marks in Mock 2." / "Your last paper was yesterday." / "No paper here yet. Ten questions will do." Key: **"Start 10 questions"** (resume: **"Resume"**). Quiet link **"Show me"** when the reason names a paper. | `SuggestionHero` with a new `compact: true` variant (section 2.6) |
| E | Ways to practise | Heading **"Ways to practise"** (22 sp section title) | `SectionHeading` (reuse) |
| E1 | Quick pair | **"Quick practice"**: "5 to 20 questions, your pick." **"By chapter"**: "Pick up to 12 chapters, then 5 to 20 questions." Quick practice leads (weighted). | `ChoiceDeck` `ChoiceRow.pair(weighted: true)` (reuse) |
| E2 | Smart practice | **"Smart practice"**: "Leans toward the chapters you miss. 10 to 20 questions." Gated: "Leans toward the chapters you miss. Comes with Pro." with the Pro tag | `ChoiceRow.wide` (reuse; one string changes) |
| E3 | Exam conditions band | Band title **"Exam conditions"**. **"Full mock"**: "50 questions, 60 minutes, timed like the exam." **"NTA mode"**: "The exam-day screen, as you will meet it on the day." Gated: "The exam-day screen. Comes with Pro." with the Pro tag | `ChoiceRow.band` + `ChoiceRow.pair` (reuse; one string changes) |
| F | More | Heading **"More ways in"**. Rows: **"Review again"**: "8 mistakes you repaired, answered before the key shows." (only when the set is 1 or more; section 5.1). **"Question stream"**: "Untimed. Answer, then see why." **"Admission Compass"**: "Which DU courses your subjects open, with the 2026 Round 1 cutoffs." It pushes `/tools/compass` (IA section 10). | `PracticeMoreRows` (change: add a row; rename "CUET tools") |
| G | Concepts | Unchanged | `ConceptsShelf` (reuse) |

**Removed as a separate row:** `_SubjectLine` ("In Accountancy, 1,240 questions"). With the strip directly above the hero, it repeats the selected tile. Its two facts are kept: the subject is in the hero's overline, and the count is in the selected tile's caption. Nothing a student can do is lost (the owner's "never cut" rule is about features).

**Copy rules kept:** sentence case, no middle dots, no arrows, no exclamation marks, 12-hour times, real numbers with units.

### 2.3 The one subject state (P2)
- `defaultPracticeSubject` (`data/default_subject.dart`), new order:
  1. The subject of the latest paper, **if it is in `saved`**.
  2. Then `saved`.
  3. Then onboarding.
  4. Then the latest paper's subject.
  5. Then the catalogue, then the launch list.

  The opening tile then matches what the record points to (T001: defaults from real context, visible and editable).
- `practiceSuggestionProvider`: pass `pickedSubject: tile` **always** (not only after an explicit pick), so every suggestion except `ResumeSuggestion` is about the selected tile. The old no-pick branch stays as the fallback for an unknown tile only.
- A `ResumeSuggestion` leads whatever the tile is. Its title names its own subject ("Accountancy practice"), so it never pretends to be about the selected tile. Tapping a tile does not hide it; the resume stays until finished or discarded.

### 2.4 Wireframe, 390 dp, account A, Night (first screen ends at about y 760 on a 390x844 phone; the bar covers 64 dp)

```
 y   0 |  status bar                                  |
    32 |  (A)  Practice                         [Mobi]|  A 48 dp
    96 |  Practise in                    Edit subjects|  C heading 28 dp
   124 | +----------+ +----------+ +--------+         |
       | | [object] | | [object] | |   +    |         |  tiles 112 x 132,
       | | *        | |          | |  More  |         |  lit tile lifts 4
       | |Accountancy| | English  | |subjects|         |
       | |1,240 qns | |  860 qns | |        |         |
   256 | +----------+ +----------+ +--------+         |
   280 | +------------------------------------------+ |
       | | Up next in Accountancy          [object] | |  D compact hero
       | | Partnership: admission                   | |  184 dp
       | | Accountancy, one chapter                 | |
       | | 10 questions                             | |
       | | It cost you 18 marks in Mock 2.  Show me | |
       | | [========= Start 10 questions =========] | |  volt key 52 dp
   464 | +------------------------------------------+ |
   488 |  Ways to practise                            |  E heading
   528 | +--------------------+ +-------------------+ |
       | | [bolt]             | | [book]            | |  E1 pair, 168 dp
       | | Quick practice     | | By chapter        | |  Quick weighted
       | | 5 to 20 questions, | | Pick up to 12     | |
       | | your pick.         | | chapters, then 5  | |
   696 | +--------------------+ +-------------------+ |
   712 | [o] Smart practice                         > |  E2 wide row 72 dp
       |     Leans toward the chapters you miss.      |
   784 |----------------------------------------------|
       |  Exam conditions                             |  E3 band
       | +--------------------+ +-------------------+ |
       | | [stopwatch]        | | [nta grid]   Pro  | |
       | | Full mock          | | NTA mode          | |  titles on one line
       | | 50 questions, 60   | | The exam-day      | |
       | | minutes, timed ... | | screen. Comes ... | |
       | +--------------------+ +-------------------+ |
       |----------------------------------------------|
       |  More ways in                                |  F
       |  [rotate] Review again                     > |
       |           8 mistakes you repaired, ...       |
       |  [layers] Question stream                  > |
       |  [compass] Admission Compass               > |
       |  Concepts                            See all |  G
```

At 360x800 the compact hero and the 132 dp tiles put the top of the Quick pair at about y 508 and its title at about y 600, inside the 680 dp above the bar. That meets L08's "first screen shows the subject choice and the first mode".

### 2.5 States

| State | What shows |
|---|---|
| Loading (catalogue not read) | Three tile skeletons in the strip (the shared shimmer), the hero's skeleton at its compact height, and the modes with their static notes (they need no data). Mobi `think`. Nothing jumps when data lands: same heights. |
| Loading (quotes for a new subject) | The modes keep their last facts (existing `_lastFull` / `_lastSmart` / `_lastNta`). Mobi `think` until the first quote answers. |
| No subjects chosen | The strip shows one wide tile, "Choose your subjects" (opens Edit subjects). The hero becomes "Your starting point" in the first catalogue subject, with the reason "Pick your subjects to make this yours." The modes show for that subject. |
| Sparse (no paper in this subject) | Hero: "Your starting point", "Accountancy, mixed chapters", "10 questions", "No paper here yet. Ten questions will do.", key "Start 10 questions" (a baseline quote when it is the student's first paper ever, existing `purpose=baseline`). |
| Resume | Hero overline "Still open", figure "23 of 50", reason "The clock ends at 9:40 PM." (mock) or "Pick up where you left off.", key "Resume". The offline notice shows only in this case (existing). |
| Offline | The hero key goes quiet and its line says "Connect to start." The tiles and modes stay readable and tappable; the confirm sheet says why it cannot start. |
| Error (pull failed) | Notice B with "Try again"; everything already shown stays (existing). |
| Success | Tile tap: the lamp tints, the tile lifts, the hero cross-fades, and Mobi looks at the tile, then nods once when the new hero lands. Mode tap: the confirm sheet (or the chapter picker, then the confirm sheet). |
| Return (back from a result or setup) | Scroll position kept (`PageStorageKey` on the list). The hero recomputes from the new attempt; if it changed, it cross-fades once and Mobi nods. No entrance replay. |
| Reselect the tab | Scrolls to the top (existing `tabReselectProvider`). |

### 2.6 Components and changes
- **`SuggestionHero`, compact variant** (`widgets/suggestion_hero.dart`): 184 dp at 390 width. The object shrinks to 88 dp, top right. The figure keeps the condensed numeral at 40 sp. The kicker and reason are one line each, ellipsis never allowed: at 1.3x text the reason wraps to 2 lines and the card grows; nothing is cut. Use the compact variant only on the Practice tab; any other caller keeps the full one.
- **`SubjectTiles`**: move it to block C. Add the count caption (11 sp, ink3, tabular figures) under the name; null count shows nothing (never "0"). Keep the selection animation the owner praised (15 Oct): the lift, the dot and the parallax lean. Height 132 dp; the strip still bleeds to the screen edge.
- **`ChoiceDeck`**: in `practice_screen.dart`, **remove the `ValueKey('quick-modes-$subject')` and `ValueKey('modes-$subject')` keys**, so a subject change no longer re-runs the deck entrance. In `choice_deck.dart`, a changed `note` cross-fades (`AnimatedSwitcher`, `Motion.ui` 200 ms, `Motion.glide` in, `Motion.exit` out, layout stack aligned top-left so the card height eases with `MmSizeEase` 240 ms). The two decks merge into one `ChoiceDeck` under "Ways to practise", with rows [pair(Quick, Chapter), wide(Smart), band(Exam: pair(Full, NTA))]. The page stagger slots become: header 0, strip 1, hero 2, heading 3, deck 4, more 5.
- **`PracticeMoreRows`**: heading "More ways in". Add `ReviewAgainRow` (imported from `features/review/again/` through its public `review_routes.dart` export; a read-only import, Review owns it). Change the Compass row to push `/tools/compass` (IA).
- **`_SubjectLine`**: delete it, and its test expectations (`PracticeCopy.subjectLine*` stay unused until removed in the same change).
- **Copy changes** (`copy.dart`): `chooseOwn` becomes `practiseIn = 'Practise in'`; add `waysHeading = 'Ways to practise'`; `moreHeading = 'More ways in'`; `toolsTitle = 'Admission Compass'`; `toolsNote = 'Which DU courses your subjects open, with the 2026 Round 1 cutoffs.'`; `suggestedOverline` becomes `upNextIn(subject) => 'Up next in $subject'`; `startKey` on the hero becomes `startCount(n) => 'Start $n questions'`; `smartGatedLine = 'Leans toward the chapters you miss. Comes with Pro.'`; `ntaGatedLine = 'The exam-day screen. Comes with Pro.'`.

### 2.7 Interactions and gestures
- Tile tap: select (haptic selection, existing). Long-press: nothing (no hidden actions).
- "More subjects": opens `showOtherSubjects`.
- Hero "Show me": opens the paper behind the reason (existing).
- Quick practice: confirm sheet with the length dial (5 to 20). By chapter: chapter picker, then confirm. Smart: confirm, or the Pro gate sheet with "Take Quick practice instead". Full mock: confirm. NTA: pushes the NTA instructions (`NtaRoutes.location(subject)`); gated NTA opens the Pro gate sheet with "Take a Full mock instead".
- Pull to refresh: the app's ring (existing `MmPullRefresh`).
- Horizontal swipe on the strip scrolls the tiles; the page's vertical scroll is never trapped.

### 2.8 Motion (what each motion answers)

| Motion | Answers | Values |
|---|---|---|
| Page entrance, once per app run | "The page is ready", in reading order | `MmStagger`, 45 ms step, 360 ms enter, rise 8 dp, `Motion.out`; slots as in 2.6 |
| Tile pick | "This subject is chosen" | Existing lift spring (`Springs` lift, 300 ms), dot fill, haptic selection |
| Lamp tint | "The room follows the subject" | 400 ms, `Motion.glide`, colour only (existing) |
| Hero swap | "The suggestion is now about this subject" | `AnimatedSwitcher` 240 ms (`Motion.card`), fade plus scale **0.96 to 1** (`Motion.out`). It replaces the old emblem's 0.6 `easeOutBack`, which the standards forbid (never from small scale). Height eases with `MmSizeEase` 240 ms. |
| Mode notes | "Same modes, new facts" | 200 ms cross-fade, no movement |
| Count caption | "A new count arrived" | `MmCountUp` from the last value (existing), never from 0 on first show |
| Reduced motion | | Every swap is a 120 ms fade (`Motion.reducedFade`); no lift, no lean, no scale |

### 2.9 Mobi on Practice (L35)
- **One Mobi:** the 44 dp header Mobi (`PracticeMobi`). He is not in the hero, the tiles or the modes.
- His acts, all from real events:
  - `wave` or `hello` once a day on first open (`MobiRation.greeting('practice')`, existing).
  - `think` while the catalogue or the first quote of a new subject is loading.
  - Looks at the tapped tile for 1.6 s (existing `_lookAtTile`).
  - **New:** `nod` once when the hero lands for a new subject or a new attempt. That is one call from the screen when the hero's subject or attempt id changes; no new act.
  - `oops` once if the pull fails.
- Tap on Mobi: his own tap cycle (existing).

### 2.10 Night and Day
- The tiles, hero and band use the existing surface roles (`surface_roles.dart`).
- The count caption is ink3 in both themes; check contrast against the Day tile (`#FFFDF7`-like ground) is at least 4.5:1, or use ink2 in Day.
- The lamp alpha is 0.16 Night and 0.11 Day (existing factors).
- Goldens: Night and Day at 360x800 and 412x915, and 1.3x text at 360.

### 2.11 Accessibility
- The strip is a radio group: each tile gets `Semantics(selected:, inMutuallyExclusiveGroup: true)` with the label "Accountancy, 1,240 questions, selected".
- The hero is one container: "Up next in Accountancy. Partnership: admission. 10 questions. It cost you 18 marks in Mock 2." Then the key "Start 10 questions".
- Focus order follows the visual order A to G.
- Every target is at least 48 dp (tiles 112x132, mode cards at least 168 dp tall, rows 72 dp).
- At 1.3x text: tile names may wrap to 2 lines (the tile grows to 148 dp); no ellipsis on titles; the exam band titles still share one line, because both cards take the taller card's height.

---

## 2B. Start sheet (`core/router/quick_start.dart`, content owned here; L09, L10)

- Content order is unchanged (IA section 3): resume (when open), tonight's move, Quick 10, Full mock with NTA mode, "Repair the next mistake", then **"Ask Mobi"** (`/ask`). The sheet's header Mobi is the one Mobi.
  - The golden `quick_start_deck_night.png` still shows **"Ask your record"**. The ledger says user text no longer has it. The builder must check the live string, use "Ask Mobi", and regenerate the golden.
- **NTA tile:**
  - Note: "The exam-day screen in Accountancy, as on the day." Gated note: "The exam-day screen. Comes with Pro."
  - `ntaPanel` keeps the grid-sized panel (`choice_glyphs.dart` `ntaCellRect`).
  - The Full mock and NTA titles sit on one line (the pair takes the taller card's height).
- Sheet motion: unchanged (sheet in 420 ms emphasized, out 240 ms). Mobi `hello` once per open, nothing else.

```
 +--------------------------------------------+
 |                  ------                    |
 | What's it going to be tonight?      [Mobi] |
 | +----------------------------------------+ |
 | | Quick 10                       [bolt]  | |
 | | 10 Accountancy questions, about    (>) | |
 | | 10 minutes.                            | |
 | +----------------------------------------+ |
 | +-------------------+ +------------------+ |
 | | [stopwatch]       | | [nta grid]       | |
 | | Full mock         | | NTA mode         | |
 | | 50 questions, 60  | | The exam-day     | |
 | | minutes, timed... | | screen in Acc... | |
 | +-------------------+ +------------------+ |
 | [check] Repair the next mistake          > |
 | [Mobi]  Ask Mobi                         > |
 +--------------------------------------------+
```

### Start moments (L10), as built, with their contract
- **Full mock:** after the server confirms, the stub tears (lift 160 ms `Motion.out`, then away 220 ms `Motion.exit`), and the stopwatch hand sweeps **one full turn in 700 ms** (`Motion.sweep`, `sweepCurve`) inside the existing hold. The paper's clock starts from the server's start time, never after the sweep. Haptic selection on tear.
- **NTA mode:** the exam sheet slides up and the "NTA" stamp settles (`ExamSheetStart.duration`, 420 ms) inside the same hold, then the instructions page.
- **Reduced motion:** a still frame of the landed state for 300 ms, then the runner.
- **Nothing animates inside the timed paper.**

---

## 2C. Quick practice and its finish (L11), as built

- **Contract:**
  - The confirm sheet's ticket names the subject (`ComposerTicket`) and the count from the dial.
  - The runner header names the same subject.
  - The question count equals the dial.
- **Finish:** `FinishStage`.
  - The answer bubbles ink in 40 ms apart (capped at 800 ms), and the figure is stamped with a medium haptic.
  - 160 ms after the landing, Mobi's reaction plays (`cheer`, `encourage` or `sleepy`, from `FinishReaction`), plus the success haptic for a good set.
  - Under reduced motion it shows the settled state.
- The owner's 13 Oct report (Business Studies became Accountancy) is guarded by `test/unit/practice/pick_and_start_test.dart`. P2 adds a guard: the hero's subject equals the selected tile's subject in every non-resume case (new unit test, section 11).

---

## 3. Review tab (`/review`)

### 3.1 Job and primary action
- **Job:** see where marks were lost and win them back, starting tonight.
- **Primary action:** **"Repair 3 mistakes, 10 min"** on tonight's card (R7; a specific CTA as in T003's spirit of showing value first).
- With nothing open, the primary action is **"Review again"** when the student has repaired or read at least one mistake; otherwise it is **"Start 10 questions"**.

### 3.2 Order, top to bottom, with exact copy

| # | Block | Copy | Widget |
|---|---|---|---|
| H | Header | Avatar, title **"Review"**, pill **"Ask Mobi"** with Mobi's 20 dp face in place of the chat icon. Offline: the header line "Offline. Showing what is saved on this phone." | `ReviewTabHeader` (`widgets/page_header.dart`; change the pill's leading glyph to `MobiCharacter` at 20 dp, `idle`, no bubble) |
| U | Unopened result (when one exists) | "Mock 7 was received. Your result is ready." / **"Open"** | `UnopenedResultRow` (reuse) |
| T | Tonight's repair | Overline "Tonight's repair, Accountancy"; title: the chapter; figure **"3"** + "mistakes"; line "From Mock 2. 1 more from earlier papers."; the bubbles Q1, Q11, Q31; quiet **"Show me"**; key **"Repair 3 mistakes, 10 min"** | `TonightCard` (`tonightKey` copy changes) |
| S | Switch | **"To repair"** / **"History"** | `MmSegmented` (reuse) |
| S1 | To repair side | "Mistakes to repair", caption "7 left to repair across 4 chapters"; progress "1 repaired, 8 found" with the bar; the chapter map (up to `tabChapterLimit`); **"See all 4 chapters"**; "Not attempted in Mock 2 (3)" (folded) with "See the answer" and "Try it again" per question | `SectionHeading`, `RepairsProgress`, `MistakeMap`, `FlushKey`, `NotAttemptedGroup` (reuse) |
| S2 | History side | **H2 (new) "Next from Mock 2"**: the SWOT's first weakness title (the server's words) and its first plan row, for example "Practise 10, Partnership: admission", with the key **"Set up"** (quiet, outlined) that opens the filled practice setup through `swotPracticeHref`. Shown only when the latest mock's detail has a visible SWOT. Then "Repair record" (2 entries, **"See your record"**), then "Past results" (5 rows, each with Replay) | New `NextFromMockBlock` (`review/widgets/next_from_mock.dart`); `RecordEntry`, `PastResultRow` (reuse) |
| L | Rows | **"Review again"**: "8 mistakes you repaired, answered before the key shows." (or, when Revise has due cards: "4 due today, 8 in all"). Then **"Where your marks go"**, **"Saved questions"**, **"Your rules"** | New `ReviewAgainRow` **replaces** `ReviseEntry` in this list; `ReviewInsightsRows`, `RulesEntry` (reuse) |

The rows sit below the switch, outside both sides, as today. Review again goes first because it is the only one that is an action, not a page to read.

### 3.3 States (L12)

The state comes from `reviewInputsProvider`'s attempts read, in this order:

| Read result | Shows |
|---|---|
| Still loading, nothing cached | `_ReviewSkeleton` (existing, same heights as the loaded tab). Header pill visible. |
| **Failed, nothing cached** | `ReviewStateView` error, title "Your record did not load", message: the named cause from `core/auth/load_problem.dart` (for example "The server did not answer in time." or "You are offline."), key **"Try again"**. Mobi `oops` once per failure run (existing). **Never the empty state.** |
| Failed or offline, cache present | The full tab from the cache. The header line says "Offline. Showing what is saved on this phone." (or "Could not refresh. Showing your saved record." when online). Pull to retry. |
| **Succeeded, list empty** | Empty state: the room scene with Mobi (existing art), title **"Nothing to review yet"**, message **"Finish one practice and every wrong answer comes here, sorted by chapter."**, key **"Start 10 questions"** (pushes `/practice/setup/quick?count=10`, not the Practice tab). Mobi `point` toward the key, once, 600 ms after arrival. |
| Papers, no open mistakes (sparse or all clear) | `_AllClear`: the figure is the repaired count; title "All repaired"; the key is **"Review again"** when the set is 1 or more, else **"Start 10 questions"**. Mobi `proud` (repaired count of 1 or more) or `read`. |
| Papers with open mistakes | The full order in 3.2. |
| Return from a repair | Changed chapters roll their count from the old value and carry one quiet mark (existing `reviewSeenProvider`). The hero re-lands with the next pick; if none is left, the All clear state cross-fades in (240 ms). |
| Pull to refresh | The app's ring; numbers roll from what they showed (existing). |

The "Your mistakes gather here" strings (`emptyTitle`, `emptyMessage`) are replaced; the owner heard them as odd (L12).

### 3.4 Wireframe, 390 dp, account A, Night

```
 y   0 | status bar                                   |
    32 | (R)  Review                  ( [m] Ask Mobi )|  H: Mobi face in pill
    96 | +------------------------------------------+ |
       | | Tonight's repair, Accountancy  [object]  | |  T
       | | Partnership: admission of                | |
       | | a partner                                | |
       | | 3 mistakes                               | |
       | | From Mock 2. 1 more from earlier papers. | |
       | | (x)Q1 (x)Q11 (x)Q31            Show me   | |
       | | [===== Repair 3 mistakes, 10 min =====]  | |  the one volt key
   392 | +------------------------------------------+ |
   416 | [  * To repair      |      o History       ] |  S
   472 |  Mistakes to repair                          |  S1
       |  7 left to repair across 4 chapters          |
       |  1 repaired, 8 found   [==][==][==][==][=]   |
       |  [obj] Partnership: admission         4      |
       |        Accountancy, Mock 2 and 1   to repair |
       |        [==---------]   1 of 5 repaired    v  |
       |  [obj] Accounting ratios              1      |
       |  ...                                         |
       |  See all 4 chapters                          |
       |  Not attempted in Mock 2 (3)              v  |
       |----------------------------------------------|
       |  [rotate] Review again                     > |  L
       |           8 mistakes you repaired, ...       |
       |  [bars]   Where your marks go              > |
       |  [mark]   Saved questions                  > |
       |  [book]   Your rules                       > |
```

History side (S2):

```
       |  Next from Mock 2                            |  H2
       |  Partnership: admission is where the most    |
       |  marks went (18 of 50 lost).                 |
       |  Practise 10, Partnership: admission  (Set up)|
       |----------------------------------------------|
       |  Repair record                               |
       |  Q11, Partnership ... Repaired yesterday     |
       |  Q3, Ratios ...       Read with the key ...  |
       |  See your record                             |
       |----------------------------------------------|
       |  Past results                                |
       |  Mock 2, Accountancy  27 of 50   Replay    > |
```

Empty state (account B):

```
       | (R)  Review                  ( [m] Ask Mobi )|
       |                                              |
       |      [ room scene, Mobi points at the key ]  |
       |                                              |
       |           Nothing to review yet              |
       |   Finish one practice and every wrong answer |
       |   comes here, sorted by chapter.             |
       |  [========== Start 10 questions ==========]  |
```

On the empty state the header pill's Mobi face is hidden: the scene's Mobi is the one per screen.

### 3.5 Motion on Review

| Motion | Answers | Values |
|---|---|---|
| Entrance, once | "Ready", in reading order | `MmStagger` (existing order: unopened, hero, map, below) |
| Hero figure | "This many to repair" | `MmCountUp` 720 ms from the last value |
| Switch | "Other side" | Existing `_SectionSwitch` overlap fade, 200 ms |
| Review again row appearing | "There is a set now" | `MmSizeEase` 240 ms, `Motion.out` (as `ReviseEntry` does today) |
| Empty-state Mobi | "Start here" | `point`, once, 600 ms after the first frame |
| Reduced motion | | Fades only, 120 ms |

### 3.6 Accessibility
- The pill reads "Ask Mobi" (the face is excluded from semantics).
- Tonight's card reads as one container plus its key: "Repair 3 mistakes, about 10 minutes".
- The switch is a tab group with selected state.
- Rows are at least 56 dp.
- The empty-state key is the first focus after the header.
- At 1.3x text the hero title wraps up to 3 lines and the card grows; the figure stays 1 line.

---

## 4. The repair as a learning loop (L13), `/review/repair/:attemptId/:questionId`

### 4.1 Job and primary action
- **Job:** win back one mistake so it holds in the next paper, not only see the key.
- The loop for each mistake has five beats:
  1. **Try it once more.**
  2. **Verdict in words.**
  3. **The reason and your trap.**
  4. **Check it held** (a fresh question, free).
  5. **Ask Mobi** (1 AI credit, said first).
- Built today: beats 3 to 5 (Repair v3 and v4).
- New: beats 1 and 2, plus the order of the screen around them.

### 4.2 Flow of one mistake

```
Entry (existing RepairEntryView: chapter, "3 mistakes", the thread, what it costs, "Begin")
  -> step 1: TRY (new)  -- pick -- "Check my answer" ------------+
          \-- quiet "Show the reason now" (no retry) ----------+ |
                                                               v v
  -> step 2: CHECKING: the verdict shows at once if the key is on the phone,
             else it waits with the explanation; Mobi thinks; the key holds its spinner
  -> step 3: EXPLAINED: verdict line, folded question with the key, the reason,
             "Your rule", "From your record" (trap), Check it held, Ask Mobi, marks line, Concepts, fine print
  -> "Next mistake" / "Finish"
```

**When the try step is skipped (opens straight on the explanation):**
- A repair opened again (`OutcomeExplained.reopened`, or status `stored`): its answer is already known.
- A set-aside question (key under check).
- "Read the key explanations" chosen at the entry (`keyOnly`): the try step **does** show, since it is free and the key is on the phone. The verdict comes from `detail.visibleKeyIndex`.

### 4.3 Step 1, Try (new), exact copy

```
 +----------------------------------------------+
 | <-   Partnership: admission     2 of 3   ... |  existing _TopBar (run track)
 |----------------------------------------------|
 | Question 11, Mock 2                          |  caption, ink2
 | Try it once more before the reason.          |  title 20 sp
 |                                              |
 | In the absence of an agreement, the new      |  QuestionPanel text,
 | partner's share of goodwill is ...           |  no key, no marks
 |                                              |
 | ( A ) Credited to old partners in sacri...   |  MmSelectRow 56 dp
 | ( B ) Credited to all partners equally       |  "Your pick in Mock 2" tag,
 |       Your pick in Mock 2                    |  ink3, letter struck
 | ( C ) Debited to the new partner's capital   |
 | ( D ) Carried to the revaluation account     |
 |                                              |
 |  [m] Mobi listens                            |  RepairMobi beside nothing:
 |                                              |  sits left of the hint line
 |----------------------------------------------|
 | [=========== Check my answer ============]   |  pinned KeyButton, disabled
 | The reason uses 1 AI credit. You have 43.    |  until a pick; fine print
 |            Show the reason now               |  KeyButton.quiet
 +----------------------------------------------+
```

- **Title:** "Try it once more before the reason."
- **The old pick:** the row keeps its letter bubble with a diagonal strike and the tag **"Your pick in Mock 2"** (ink3, 12 sp). It stays pickable: picking it again is a real answer.
- **Hint under the options** (before a pick): "Pick one. Your first answer here counts."
- **Primary:** **"Check my answer"**, disabled until a pick.
- **Cost line under the key:**
  - From the wallet the run already read (`EntryPlan`): "The reason uses 1 AI credit. You have 43."
  - Key-only run: "The key explanation is free."
  - Reopened repair: no line, since there is no try step.
  - Wallet unknown: no line, and the key still works. An unknown balance never shows as zero, the existing rule.
- **Quiet:** **"Show the reason now"**. It runs the same call with no retry pick and opens on the explanation with no verdict line.

### 4.4 Step 2 and 3, Verdict and reason, exact copy

The verdict line sits **first** under the folded question, with Mobi beside it (`RepairMobi`):

| Case | Verdict (title 18 sp, w600) | Sub-line (body, ink2) | Mobi act |
|---|---|---|---|
| Retry right | **"Right this time."** | "Here is why it holds." | `correct`, then `proud` |
| Retry wrong, same pick as before | **"Still B."** | "The key is C. Here is the trap." | `sympathy` |
| Retry wrong, a different pick | **"D this time. The key is C."** | "Here is why C." | `encourage` |
| "Show the reason now" | (no verdict line) | | `idea` when the reason lands |

- The rows mark in words, never in colour alone (the Repair v4 decision): "Key", "Your pick now", "Your pick in Mock 2", or "Your pick and the key".
- Under the verdict, the existing blocks keep their order: `WorkedExplanation` (the reason, "Your rule" when missed, "From your record" with the trap pattern), then `RepairFollowUp` (**"Ask Mobi about Q11"**, then **"Check it held"**), then `MarksLine`, `ConceptRow`, `RetryCard`, `RepairFinePrint`.
- **What "repaired" means does not change:** a mistake counts as repaired only on the server's `explained` or `stored`. The retry's right or wrong never changes the record. It is the student's own check and is stored on the phone with the repair (`repair_local`). It is also sent additively as `retry_pick` (the option index) in `POST /api/recovery/repair`; a server that ignores the field changes nothing (a request to the web owner, section 10).

**Verdict timing:**
- When `detail.visibleKeyIndex(questionId)` is on the phone, the verdict shows **at once** on "Check my answer". The reason loads under it with the existing wait line ("Writing the repair for Q11." and its 8 s and 45 s changes), so the wait is useful.
- When the key is not on the phone, the verdict and the reason land together.
- The verdict never contradicts the server: if the response's `keyIndex` differs from the phone's, the response wins. The verdict line is rebuilt with no motion, and the row tags follow.

### 4.5 States of the repair step

| State | Shows |
|---|---|
| Try, no pick | Options live, key disabled, hint line |
| Try, picked | Key enabled; the picked row lit (`MmSelectRow` selected) |
| Checking | Options lock (unpicked rows to 60% opacity over 160 ms, no taps). Verdict at once (key on the phone) or not. Wait line and skeleton. The key shows its spinner. |
| Explained | Section 4.4 |
| Failed, can retry (offline, timeout, 429, provider down) | The pick stays locked and visible; the verdict stays if it was local. Notice: the server's sentence or the existing one ("The explanation could not be made. Try again." / "You were not charged."). Key **"Try again"** resends the **same request id and the same retry pick** (the server charges once per id, existing). Quiet: "Next mistake". |
| Out of credits mid-run | The existing `OutcomeKeyReview(outOfCredits)` notice "Your explanation credits are used up. They renew on 1 November." The try step still runs; the verdict comes from the phone's key; the key explanation follows. |
| Not a mistake (server) | The step is removed quietly (existing). |
| Set aside | The existing notice; no try step. |
| Reopened | No try step; "Already repaired. Opening it again is free and changes nothing on your record." (existing `reopenLead`) |

### 4.6 Motion on the repair step

| Motion | Answers | Values |
|---|---|---|
| Option pick | "Chosen" | `MmSelectRow` (existing): fill 140 ms, haptic tick |
| Lock on check | "Your answer is in" | Unpicked rows to 0.6 opacity, 160 ms `Motion.out`; no movement |
| Question fold | "Now the reason leads" | Existing fold into one line plus `KeyReveal` ink, 260 ms |
| Verdict line | "Here is how you did" | Rise 8 dp + fade, 240 ms `Motion.out`; haptic light only when right; **no shake** for wrong (the student is learning, not failing a paper) |
| Explanation blocks | "The reason arrives" | Existing block-by-block arrival (45 ms stagger), first time only |
| Step change | "Next mistake" | Existing `_StepSwap` |
| Reduced motion | | Everything shows at once; the verdict is a 120 ms fade |

### 4.7 Mobi on the repair (one, `RepairMobi`)

`RepairMobi` is always the first child of the outcome area, so he keeps his state through the steps. New acts during the try step:
- `listen` while options are live.
- `think` while checking.
- The verdict acts in 4.4.
- `idea` when a no-verdict reason lands.

No other Mobi on this page. The entry view has none (its object is the subject emblem, existing).

### 4.8 Accessibility
- The options are a radio group, 56 dp rows, with the label "Option B, Credited to all partners equally, your pick in Mock 2".
- The verdict is a polite live region.
- "Check my answer" when disabled reads "Check my answer, pick an option first".
- The cost line is read after the key.
- Focus moves to the verdict when it appears.
- At 1.3x text, the options wrap and the pinned band grows; the band never covers the last option (its list has bottom padding equal to the band's measured height).

---

## 5. Review again (L14), new page `/review/again`

### 5.1 What it is
**The set:**
- Up to 10 mistakes the student has already repaired, or read with the key, that are **not open** (open ones belong to the repair).
- Order:
  1. Mistakes the student missed in their last Review again (stored on the phone).
  2. Then the oldest repair first.
- Built from `mistake_index.dart` and `repair_local`, with question text and keys from the cached attempt details. **It works offline** for every question whose detail is cached; others are left out of the set, never shown broken.

**Revise first when it is live:**
- When the Revise read (`reviseEntryProvider`) is available and has cards due today, the entry opens **Revise** (server-marked, existing `/review/revise`).
- Revise's end then offers **"Review again: 6 more you repaired"**, which opens this page.
- When Revise is unavailable or has nothing due, the entry opens this page directly.
- Either way the control always does something useful.

**The entry:**
- `ReviewAgainRow` is shown when the set has at least 1 question or Revise has a card due. It is never shown pointing at nothing.
- Places:
  - First of Review's rows (block L).
  - The All clear key (3.3).
  - Practice "More ways in" (2.2 F).
  - The repair ending as a quiet link under the existing keys: **"Review these again"** opens this page seeded with the run's repaired mistakes.

### 5.2 Order and copy

```
 +----------------------------------------------+
 | <-  Review again                     3 of 8  |  app bar; progress = answered
 |     [===========-------------------------]   |  real count, 8 segments
 |----------------------------------------------|
 | Partnership: admission, Q11 in Mock 2        |  caption ink2
 | Repaired 3 days ago                          |  caption ink3
 |                                              |
 | In the absence of an agreement, the new      |  question text
 | partner's share of goodwill is ...           |
 | ( A ) ...                                    |  MmSelectRow 56 dp
 | ( B ) ...                                    |  no "your pick" tag here:
 | ( C ) ...                                    |  this is a fresh try
 | ( D ) ...                                    |
 |                                              |
 |  -- after Check --                           |
 |  [Mobi] Right. This one held.                |  verdict, live region
 |  Your rule: Goodwill goes to the sacrificing |  the student's rule, when
 |  partners in their sacrificing ratio.        |  one is saved
 |  Why: (the key explanation from the paper)   |  free, from the detail
 |----------------------------------------------|
 | [================ Check ================]    |  pinned, disabled until pick
 +----------------------------------------------+   becomes "Next question",
                                                    then "See how it went"
```

- **Title:** "Review again". Progress: "3 of 8" plus a segmented bar of **answered** questions only (R17, T002: truthful progress).
- **Verdicts:**
  - Right: **"Right. This one held."** (Mobi `correct`).
  - Wrong: **"Not yet. The key is C."** (Mobi `encourage`), then the rule and the explanation, and a quiet **"Repair it again"**. That opens the stored repair (free, `reopenLead`), and Back returns here at the same question.
- **Keys:** **"Check"**, then **"Next question"**, then, on the last question, **"See how it went"**.
- **End:**
  - Figure **"6 of 8"**, line **"held"**.
  - Sub-line: "2 come back first next time." (only when some were missed).
  - Primary **"Back to Review"**; quiet **"Review again"** (a new set) when more remain.
  - Mobi: `proud` (6 or more of 8), `nod` (3 to 5), `encourage` (fewer).
  - No foil burst: that belongs to the repair ending's moment.
- **Nothing here is sent to the server or changes the repair record.** Missed questions are stored on the phone (`review_again_local`, keyed by question) only to order the next set. No line on the page says so: the owner rejects defensive filler (13 Oct). The behaviour is consistent, so nothing needs explaining.

### 5.3 States

| State | Shows |
|---|---|
| Building the set | Skeleton of one question (the shared shimmer), under 300 ms with a cache |
| Set empty (deep link with nothing to review) | `ReviewStateView` empty: "Nothing to review again yet", "Repair a mistake and it comes back here.", key **"See your mistakes"** (`/review`). Mobi `read`. |
| A question's detail missing mid-run | It is skipped silently and the count drops (the bar rescales), never a broken card |
| Offline | Works from the cache; no notice unless the set shrank: "Some questions need a connection. 5 are ready." |
| Back mid-run | Leaves; answers so far are kept on the phone; the next entry starts a new set (missed first) |
| Return from "Repair it again" | The same question, verdict shown, key "Next question" |

### 5.4 Files and reuse
- **New:** `lib/features/review/again/review_again_data.dart` (the set builder, pure and unit-tested), `review_again_screen.dart`, `review_again_entry.dart` (`ReviewAgainRow`), `review_again_copy.dart`, `review_again_local.dart` (the phone store, existing local-store pattern).
- **Reuse:**
  - `QuestionPanel` (`widgets/question_panel.dart`), `MarkedOption` (word tags), `MmSelectRow`, `KeyButton`, `MmSegmentedProgress` or `RepairsProgress`' bar (whichever the shared widgets barrel exports).
  - The answer logic of `AnswerSheetBody` (`tryFirst`): lift its judge-and-reveal into a shared `TryFirstController` in `review/widgets/try_first.dart`, used by the answer sheet, this page and the repair's try step. Three places, one behaviour.
- `revise/revise_entry.dart`: no longer placed on the tab; `ReviewAgainRow` reads `reviseEntryProvider` to decide where it opens and what its note says. Keep the file for one release, unreferenced, then delete it.

### 5.5 Motion and Mobi
- Verdict: as in 4.6 (240 ms rise and fade, haptic light when right).
- Next question: `_StepSwap`-style horizontal slide, 300 ms `Motion.glide`.
- End figure: `MmCountUp` 720 ms.
- **One Mobi:** in the verdict line (24 dp), and at the end (64 dp, the same instance moving is not required; the end is its own screen state).

### 5.6 The other "try again" controls (also L14)
- **Skipped row, "Try it again"** (`review_rows.dart`): it opens the answer sheet with `tryFirst: true` (existing). After the `TryFirstController` lift it shows the same verdict words as Review again. Offline with no cached detail, the sheet says "Connect to load this question." with "Try again", never a blank sheet.
- **Result card, "Try it again"** (`practice/widgets/result_question_card.dart`, Practice-owned): the same controller and words.
- **Repair ending, "Try the same mistakes again"** (`repair_ending_screen.dart`): unchanged behaviour (a fresh run over the still-open mistakes). It shows only when some of the run failed or could not be explained (existing). Add the quiet "Review these again" link (5.1) for the repaired ones.

---

## 6. SWOT (L15)

- **In Review (built here):** `NextFromMockBlock` on the History side (3.2 S2). It reads the latest **mock's** attempt detail `swot`:
  - shows its first item from Weaknesses (or Threats, when there are no Weaknesses), using the server's finished sentence with its denominator;
  - then `plan[0]` with **"Set up"**, through `swotPracticeHref` (`features/result/full/swot_section.dart`, a read-only import). It opens the setup with subject, chapter and count filled. Nothing starts and nothing is charged before the second tap there (existing contract).
  - Hidden for a practice set, `too_few`, `checks_pending`, or a missing read.
- **On the result (request to the Result owner, section 10):**
  - move `SwotSection` from after `AcrossMocksView` to **directly after the Mistake Lab ledger** (`whereSection`), so "what to do next" is the second thing on a mock's result;
  - add the top 2 SWOT items and `plan[0]` to the recap's last card (VISION-INVENTORY D.5-2).

---

## 7. Mobi and motion on these screens (L34 to L37)

| Screen | The one Mobi | Acts, each on a real event | None on |
|---|---|---|---|
| Practice tab | Header, 44 dp | `wave`/`hello` daily; `think` loading; look at tile; `nod` on new hero; `oops` on failed pull | Hero, tiles, modes |
| Start sheet | Header, 44 dp | `hello` per open | Tiles |
| Confirm / setup | none | | The ticket is the object |
| Start moments | none | | Clock and stamp are the moment |
| Runner (timed) | none | | Everything |
| Finish / practice result | `FinishStage` Mobi | `cheer`/`encourage`/`sleepy` from `FinishReaction` | |
| Review tab | Ask Mobi pill face, 20 dp (empty and All clear: the scene's Mobi instead, and the pill's face hides) | `idle`; `nudge` once when an unopened result appears | Hero, map |
| Repair | `RepairMobi` | `listen`, `think`, `correct`/`proud`, `sympathy`, `encourage`, `idea` | Entry view |
| Repair ending | Existing ending Mobi | pleased / ready (existing) | |
| Review again | Verdict and end | `correct`, `encourage`, `proud`, `nod` | |

- **One per screen:** add these screens to `test/unit/mascot/mobi_moments_one_per_screen_test.dart` (owned by Mobi and motion; a request, section 10): `practice_tab`, `review_tab_full`, `review_tab_empty`, `repair_try`, `repair_explained`, `review_again_question`, `review_again_end`. Each pumps the screen and expects `find.byType(MobiCharacter)` to match exactly one widget.
- **L34, motion judged in use:** every motion in sections 2.8, 3.5, 4.6 and 5.5 has a stated reason, uses the app's tokens (`motion_tokens.g.dart`), and has a reduced-motion form. No looping animation on any card. One authored entrance per page per app run.
- **L36, spacing and parity:**
  - Every block here uses `MmSpace.gutter` (16), `MmRhythm.group` between blocks and `MmRhythm.item` inside them. The Practice heading-to-tiles gap is `MmRhythm.item - SubjectTiles.liftRoom` (existing).
  - Night and Day goldens for every new state.
- **L37, subject art:** the strip and the hero use `SubjectEmblem`. A subject without art shows its initials, never another subject's object. Check Accountancy, Business Studies, English and Computer Science in the strip at 112 dp and in the hero at 88 dp.

---

## 8. Evidence and rules applied

- **R7 (one primary):** Practice has one volt key (the hero); Review has one (tonight's repair); the repair's try step has one ("Check my answer"), with "Show the reason now" quiet.
- **R8 (rank by the next decision):** subject before modes (the subject decides every mode's facts); the SWOT's next step on Review's History side.
- **R10 / S014 (do not hide frequent controls):** Review again gets a visible row in three places instead of a row that hides itself.
- **R16 (keep the user's work):** a failed repair keeps the retry pick and resends it with the same request id; Review again keeps answers through Back.
- **R17 / T002 (truthful progress):** Review again's bar counts answered questions only.
- **R18 (say what happens next):** the cost line under "Check my answer"; "Set up" opens the setup and starts nothing.
- **R23, R24, T006, T008, and the MockMob overlay (AI cost before the call):** the credit line is shown before the paid call; an unknown balance shows nothing; key-only says "free".
- **R31 (motion with a purpose):** every motion row names what it answers; reduced-motion forms are given.
- **R35 (every state):** the state tables in 2.5, 3.3, 4.5 and 5.3.
- **R36 / S016 (accessibility):** radio groups, live regions, 48 to 56 dp targets, focus order, 1.3x text.
- **T001 (defaults from real context):** the default subject comes from the latest paper.
- **T003 (value before the gate):** the empty state's key starts 10 questions directly.
- **S017 (decoration without intent):** each Mobi placement is tied to an event; none decorates.

**Anti-slop check (12 parts), as designed:**
1. Identity: the subject objects, Mobi and the volt key.
2. One primary action: yes, on all screens.
3. True content: server and phone data only.
4. First-scan hierarchy: subject, then up next, on Practice; tonight's repair on Review.
5. Composition: a vertical rhythm; grids only for the mode pair and the exam band, where comparison helps (R12).
6. Type by role.
7. Every state: section tables.
8. Accessible interaction: 8.
9. No pseudo-evidence: every reason names its paper.
10. Motion with a reason.
11. Leading metric and guardrail, proposed:
    - Practice: share of sessions started from the hero or a mode within 30 s of opening, guarded by the start-failure rate.
    - Repair: the share of retries right, against the share of Check it held passed, guarded by credits spent per repaired mistake.
    - Review again: sets finished, guarded by sets abandoned.

    None is instrumented yet; this needs the owner's say (R37).
12. "Better without it?" `_SubjectLine` was dropped for exactly this reason.

---

## 9. Emulator acceptance, per ledger item

**Setup:** the ledger's test setup (emulator `mockmob_budget`, accounts A and B, Night and Day, 360x800 and 412x915, 1.3x text once, a screenshot at the end of each check). Builders run these; this brief ran none.

**L08 Practice order**
1. Account A, cold start, tab Practice at 360x800. Without scrolling, the screen shows, in order: "Practise in" with the tiles, then "Up next in [subject]" with "Start 10 questions", and at least the top of the Quick practice card.
2. The lit tile, the hero's overline and the hero's object name the same subject. For A, that is the subject of A's latest paper.
3. Scroll: "Ways to practise", Quick practice and By chapter, Smart practice, "Exam conditions" with Full mock and NTA mode, "More ways in" (Review again, Question stream, Admission Compass), Concepts.
4. Tap the English tile: the hero cross-fades to English. The mode cards **do not re-enter** (no rise); only their notes change. Mobi looks at the tile, then nods once.
5. No mode sits above the strip. Repeat in Day and at 1.3x text: no clipped title, and the exam band titles share one line.

**L09 NTA tile**
1. Practice and the Start sheet, Night and Day, 360 and 412 wide, 1.3x text.
2. The three rows of NTA cells sit inside the pale panel, with a gap of at least 4 dp to its edge.
3. The title and note do not overlap the art. The Full mock and NTA titles share a baseline (screenshot ruler).
4. A gated account sees "The exam-day screen. Comes with Pro." and the Pro tag, inside the card.

**L10 Start moments**
1. Start a Full mock: after the server confirms, the stopwatch hand makes one full turn (about 0.7 s) and then the runner opens. The runner's clock shows the server's remaining time (it did not lose 0.7 s).
2. Start NTA mode: the exam sheet slides up and the NTA stamp lands, then the instructions page.
3. With Android "Remove animations" on: a still frame, no sweep.
4. Inside both papers nothing animates except the answer selection.

**L11 Quick practice honours subject and length**
1. Select Business Studies, Quick practice, set 5, Start. The ticket names Business Studies and 5; the runner header says Business Studies and "1 of 5".
2. Finish: the bubbles ink in, the figure stamps, and Mobi reacts.
3. The result lists 5 answers.
4. Back to Practice: the Business Studies tile is still lit, and the hero is about Business Studies.

**L12 Review**
1. Account A: the Review tab shows Tonight's repair with "Repair N mistakes, M min", the switch, and the chapter map. Never "Nothing to review yet" or "Your mistakes gather here".
2. History shows "Next from Mock N" (when the mock has a SWOT), the repair record and past results.
3. Account B: "Nothing to review yet", "Finish one practice and every wrong answer comes here, sorted by chapter.", and "Start 10 questions", which opens the Quick setup with 10.
4. Account A, airplane mode, force-stop, reopen: the tab shows the cached record with the header line "Offline. Showing what is saved on this phone."
5. Account A with the network blocked on first install (no cache): the error view names the cause and offers "Try again". It is not the empty state.

**L13 Repair as a learning loop**
1. Account A: Review, "Repair N mistakes". At the entry, the cost is stated. Begin.
2. The first screen says "Try it once more before the reason."; the old pick is tagged "Your pick in Mock N"; **no key is visible**; "Check my answer" is disabled; under it, "The reason uses 1 AI credit. You have N."
3. Pick the right option and tap Check: "Right this time." appears (at once when the key is cached), then the reason, "From your record" naming the trap, "Ask Mobi about Qn" (stating its cost) and "Check it held".
4. Next mistake: pick the old wrong option again; "Still B. The key is C." shows.
5. Open "Check it held": a fresh question, free; after answering it shows "Checked" or the miss (existing).
6. The account sheet's AI credits are lower by exactly the amount charged for the explained repairs.
7. Turn airplane mode on before Check: the pick stays, the notice says nothing was charged, and "Try again" after reconnecting works with no double charge.
8. Reopen a repaired mistake: no try step; "Already repaired..." and the explanation.

**L14 Review again**
1. Account A with at least 1 repaired mistake: Review shows the "Review again" row first under the switch area, with a count.
2. Tap it. Revise is not live, so it opens "Review again", "1 of N".
3. The key is hidden; pick, then Check: "Right. This one held." or "Not yet. The key is C." with the rule and the explanation.
4. Finish the set: "X of N held".
5. Repeat in airplane mode: the set builds from the cache and works.
6. Practice "More ways in", Review again: the same page.
7. Repair ending, "Review these again": the same page with that run's mistakes.
8. A skipped question's "Try it again" (Review, Not attempted) and a result card's "Try it again" each show the options with no key and then the verdict words.
9. If Revise is live with cards due: the row's note says "N due today" and opens Revise; Revise's end offers "Review again: N more you repaired".

**L15 SWOT**
1. Finish a full mock on account A. The Review tab's History side shows "Next from Mock N" with the server's weakness line and "Practise 10, [chapter]"; "Set up" opens the setup with subject, chapter and count filled, and nothing starts.
2. The result shows "After this mock" (where it is after the Result owner's move: right under where the marks went).

**L34 to L37 on these screens**
1. Record 60 s (`adb shell screenrecord`) covering: Practice open, a tile change, the Start sheet, a Full mock start, Review, a repair try and verdict, and Review again. No snap, blank frame or jump; `dumpsys gfxinfo` janky frames under 5%.
2. Count Mobis per screen against section 7: exactly one, none in the timed paper.
3. Day and Night: same gutter and group gaps.
4. Subject art: four weak subjects read as their subject in the strip.

---

## 10. Requests to other areas (they own the files)

| To | Request |
|---|---|
| **Shell** | Register `/review/again` as a **root** page (covers the bar; Back returns to the origin) in `routes.dart` and `router.dart`, using `reviewAgainScreen` exported from `review_routes.dart`. Map the website's `/recovery?again=1` (when the web adds it) in `action_router.dart`. |
| **Result** (unchanged this round in the IA; schedule next) | Move `SwotSection` to directly after `whereSection` in `full/full_result_screen.dart`. Recap last card: the top 2 SWOT items and `plan[0]` (D.5-2). |
| **Mobi and motion** | Add the seven screens in section 7 to `mobi_moments_one_per_screen_test.dart`. Confirm `listen`, `sympathy`, `point`, `nod`, `idea` and `correct` play well at 20 to 24 dp (the pill and the verdict line); if an act reads poorly that small, the area names its replacement. |
| **Web owner** | `POST /api/recovery/repair`: accept and store an optional `retry_pick` (option index), additive, ignored when absent. Add the same try-before-the-reason step to the website's `MistakeRepair`, and a "Review again" page, so app and web match (owner, 14 Oct: features land together). Decide one term for the paid reply ("written replies" against "AI replies"; carried from Repair v4). |
| **Practice to Review (same designer, two builders)** | Practice's More row imports `ReviewAgainRow` from Review's public export; Review imports `swotPracticeHref` from Result (read-only). |

---

## 11. Files to change

**Practice and Start** (`flutter_app/lib/features/practice/` unless noted)
- `practice_screen.dart`:
  - reorder to A to G;
  - one `ChoiceDeck` under "Ways to practise" with the subject keys removed;
  - stagger slots 0 to 5;
  - drop `_SubjectLine`;
  - Mobi `nod` on a hero change;
  - a `PageStorageKey` on the list.
- `data/default_subject.dart`: the latest paper's subject first when it is in `saved`.
- `data/suggestion.dart`: `pickedSubject` is the tile always (except resume).
- `copy.dart`: the strings in 2.6.
- `widgets/suggestion_hero.dart`: the `compact` variant; the hero swap at scale 0.96 to 1, 240 ms.
- `widgets/subject_tiles.dart`: the count caption; radio-group semantics.
- `widgets/choice_deck.dart`: note cross-fade, height ease, no re-entrance on a changed note.
- `widgets/more_rows.dart`: "More ways in", the Review again row, Compass to `/tools/compass`.
- `widgets/practice_mobi.dart`: expose `nod()` (or call `MobiController.play(MobiAct.nod)`).
- `widgets/result_question_card.dart`: use `TryFirstController` (from Review's export) for "Try it again".
- `lib/core/router/quick_start.dart`: "Ask Mobi" wording check, NTA gated note.
- Tests:
  - `test/unit/practice/practice_order_test.dart` (new: block order, the first screen at 360x800 shows the strip and the Quick card, notes change without re-entrance);
  - `test/unit/practice/subject_state_test.dart` (new: the hero subject equals the tile subject in every non-resume case; the default is the latest paper's subject);
  - goldens `test/golden/practice/tab_{new,resume,offline,chapter_late,choose_concepts}_{night,day}.png` regenerated, plus new `tab_order_360_{night,day}.png` and `tab_order_text130_{night,day}.png`;
  - `quick_start_deck_*` regenerated.

**Review** (`flutter_app/lib/features/review/` unless noted)
- `screens/review_screen.dart`:
  - empty only on a known-empty read;
  - the error view with the named cause;
  - the Review again row first in block L;
  - All clear's key;
  - History opens with `NextFromMockBlock`.
- `copy.dart`: the empty, error and hero-key strings; the try-step and verdict strings (4.3, 4.4).
- `widgets/page_header.dart`: the Mobi face in the Ask Mobi pill, hidden when the scene's Mobi shows.
- `widgets/review_state_view.dart`: the empty-state Mobi `point`.
- `widgets/tonight_card.dart`: key label "Repair N mistakes, M min".
- `widgets/mistake_view.dart`: the try step before the outcome; the verdict line first in the explained state; option lock.
- `widgets/retry_first.dart` (new): the try step's body (options, old-pick tag, hint, pinned key, cost line, quiet skip).
- `widgets/try_first.dart` (new): `TryFirstController`, shared with `answer_sheet.dart` and Review again.
- `widgets/answer_sheet.dart`: use `TryFirstController`; the offline line.
- `widgets/repair_mobi.dart`: the acts `listen`, `sympathy`, `encourage`, `idea` for the try and verdict.
- `widgets/next_from_mock.dart` (new): the SWOT next step on History.
- `data/repair_run.dart` and `data/repair_state.dart`: a `RetryStage` on `RepairStep` (pick, judged locally when the key is cached); `retryPick` stored with the acknowledgement; resent on retry with the same request id.
- `data/repair_api.dart`: the optional `retry_pick` in the body.
- `screens/repair_ending_screen.dart`: the quiet "Review these again".
- `again/review_again_data.dart`, `again/review_again_screen.dart`, `again/review_again_entry.dart`, `again/review_again_copy.dart`, `again/review_again_local.dart` (all new).
- `review_routes.dart`: export `reviewAgainScreen` and `ReviewAgainRow`.
- `revise/revise_entry.dart`: unplaced (kept one release).
- Tests:
  - `test/unit/review/review_again_set_test.dart` (the set rules, offline, order);
  - `test/unit/review/repair_try_step_test.dart` (skipped for reopened and set aside, verdict cases, lock, the same request id and pick on retry, the server key wins);
  - `test/unit/review/review_states_test.dart` (empty only on a known-empty read; error never shows empty);
  - new goldens at 390: `review/goldens/{repair_try_ready,repair_try_picked,repair_verdict_right,repair_verdict_still,review_again_question,review_again_verdict,review_again_end,review_tab_empty_v2,review_tab_history_next}_{night,day}.png`;
  - regenerate `review_tab_*` and `repair_explained*`.

**Not changed here:** `features/result/**` (request), `core/router/{routes,router,action_router}.dart` (Shell request), `core/mascot/**` (Mobi request).

---

## 12. Owner sign-off questions

1. **"Review again" (L14):** is it the re-practice of mistakes you already repaired (this design)? If you meant a different control, say which screen it was on.
2. **Practice order (L08):** "Practise in" (subjects), then "Up next", then the modes from quick to NTA. Is that the order you meant? And is "Interview mode" NTA mode?
3. **Retry before the key (L13):** the try step shows on every fresh repair. Should a student be able to turn it off, or is "Show the reason now" on each mistake enough?
4. **Cost wording:** "The reason uses 1 AI credit. You have 43." Do you want "credit" or "AI credit" on this line? (The account sheet uses "AI credits".)

## 13. Verification status
Nothing in this brief has been built, run, or seen on a device. The goldens and the one owner capture named at the top were opened to read the current screens; `v10-launch.png` and `v10-now.png` were not found.
