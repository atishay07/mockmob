# Colleges, Compass and onboarding colleges: build brief, 16 Oct 2026

Status: **design decided, ready to build; owner sign-off pending** (section 13). Design only: no code was changed, nothing was committed, no device was used.

Area: **Colleges** (the "tools" area in the IA lead's ownership map, `app-ia-1016.md` section 10). It covers ledger items L22 to L27, plus L28 and L30 for onboarding, and L34 to L37 where they touch these screens (`docs/brain/APP-OWNER-LEDGER-2026-10-16.md`).

This brief works inside the IA decisions and does not reopen them: the six-slot bar, the `/colleges` tab in branch 3, `/colleges/cutoff`, the `/tools/*` paths kept as root pages, and the `/tools` redirect.

**Evidence used:**
- The IA file.
- The ledger (read in full).
- `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md`, cited below as R7, R13 and so on.
- Evidence IDs from the owner's research brain: T001 to T009 and S010 to S018.
- The code on `ui/phase2` (`wt-phase2/flutter_app`, working tree of 16 Oct):
  - `features/tools/**`
  - `features/onboarding/{steps/course_step.dart, widgets/college_ladder.dart, model/answers.dart, state/answers_controller.dart, copy.dart, data/du_catalog.dart}`
  - `core/widgets/mm_sheet.dart`, `core/models/my_colleges.dart`, `core/mascot/mobi_acts.dart`, `core/motion/motion_tokens.g.dart`
- Goldens:
  - `tools/goldens/{compass_full_night, compass_category_sheet_night, my_colleges_chooser_night, combo_full_day, hub_night, programme_bcom_night}.png`
  - `onboarding/goldens/course_ladder_night.png`
- The owner's capture `scratchpad/dev/now1.png`. `v10-launch.png` and `v10-now.png` were not in that folder, so they were not seen.

**Two corrections to the IA file's examples:**
- DU's allocation scores are **out of 1000**: four papers at 250 each (`ToolsCopy.scoreLabel`, `OnboardingCopy.ladderSupport`, `du_mock_score.dart`). The IA example "612 of 800" becomes "612 of 1000" everywhere.
- The IA example "Hansraj B.Com (Hons) closed at 645.3" mixes up a programme's lowest cutoff across all colleges (645.3) with Hansraj's own figure (907.5 in the onboarding golden). Rungs always show the college's own figure.

---

## 0. The student, the job, success

The student is a Class 12 Commerce student in October 2026. They have no CUET score, and many have no full mocks yet. They want to know two things: which DU courses their subjects open, and whether their marks are heading toward the colleges they want.

**Jobs, in order of frequency:**
1. See their colleges against where they stand (weekly).
2. Explore what their subjects open (Compass, now and then).
3. Fix their subject combination (Combo, once or twice a year).
4. Add or reorder colleges (rare, but it must never fail: L24, L25).

**Success criteria:**
- Compass, Combo, Check a score and the guides are each 2 taps from a cold start, and My colleges is 1 tap (L22).
- No screen asks for a score before it shows something useful (L26; R13, R15; T003).
- "bcom" finds B.Com. (Hons.), and the results stay above the keyboard (L24).
- Every key does something visible within 100 ms (L25).
- Onboarding writes the same list (L30).

---

## 1. Decisions at a glance

| # | Decision | Ledger |
|---|---|---|
| C1 | **One estimate model** replaces "your CUET score" everywhere in this area. It is a range of raw marks out of 1000 with a named source, in this priority order: (1) the student's latest full mocks; (2) the Compass Pro projection, when the account has it; (3) the student's own typed range. Without any of these, nothing is asked; the screens show cutoffs alone. The words "CSAS dashboard" and "your CUET score" leave the app. | L26, L23 |
| C2 | **One verdict per college:** Clears by N, Within your range, Needs N more, or No Round 1 seat for this category. It always uses real figures to one decimal and a denominator of 1000. | L23, L26 |
| C3 | **One search matcher** (`college_search.dart`), shared by the chooser, Compass, Combo and onboarding. It normalises punctuation and spacing, expands aliases (bcom, hons, eco, srcc and others), matches word prefixes, and allows one typo. | L24 |
| C4 | **The chooser is a keyboard-aware sheet** at a fixed 92% height. The search field is pinned and the results list sits above the keyboard. It opens straight on the student's course. | L24, L25 |
| C5 | **One college ladder component** (`AimLadder`) is used in the chooser, in onboarding's Aim step and in the Colleges empty state. Its limit is 8, and the first 3 are marked "On Today". | L30, D6 |
| C6 | **Colleges tab root:** My colleges with verdicts, the Compass card, the tools list, and sources. There is one primary action: **Choose your colleges** while the list is empty, otherwise **Open Compass**. | L22, L32 |
| C7 | **Compass rethought** as answer, then decide, then explore: the count, the category, then one move to open your best course, then the best options with your estimate band. "Where you stand" comes below them. The streams are folded rows that each say what is inside. | L23 |
| C8 | **Check a score** (`/colleges/cutoff`) is the estimate sheet in check mode. A typed number there is not saved as the estimate unless the student asks. | L22, L26 |
| C9 | **Combo is three steps with a progress header.** It prefills honestly from My colleges and the student's subjects. Once there is a result, the result comes first. Every "Keep" line gives its reason as real counts. The page has no empty tail. | L27 |
| C10 | **Mobi** appears at most once per screen, only to react to a real state, and never inside a sheet that sits over a screen where Mobi already shows. | L35 |

---

## 2. Shared pieces (build these first)

### 2.1 Estimate model: `lib/features/tools/estimate/estimate.dart` (pure)

```dart
enum EstimateSource { mocks, projection, typed }

class Estimate {
  final EstimateSource source;
  final double low;    // 0..1000
  final double high;   // >= low, 0..1000; low == high is a point
  final DateTime at;   // newest mock, projection time, or when typed
  final List<({String subject, int marks})> papers; // mocks only: 4 papers, each out of 250
  bool get isPoint => (high - low) < 0.05;
}

enum Verdict { clears, within, below, noSeat }

/// The verdict against one cutoff c (Round 1, 2026, for the category):
/// low >= c -> clears (by low - c); high >= c -> within; else below (by c - high);
/// a null cutoff -> noSeat.
({Verdict v, double by}) verdictFor(Estimate e, double? cutoff);
```

**Sources and how each range is built:**
- **mocks.** Extend `domain/du_mock_score.dart` with `duMockRange(attempts, selection)`. It keeps today's paper choice (the best language and the best three domain papers, from full 250-mark mocks).
  - For each chosen paper it takes up to its last 3 full mocks.
  - `low` is the sum of each paper's minimum, `high` the sum of each paper's maximum, and `latest` the sum of each paper's latest mock.
  - With one mock per paper, the result is a point.
  - It returns null under the same rule as today: at least one language and three domain papers are needed.
  - It also returns a `partial` value: which of the 4 paper slots have a full mock, and which subjects are still missing.
- **projection.** Taken from `CompassProSection`'s total range (`proRange(low, high)`), only when `compassProAccessProvider` is true and the projection covers all four papers (`proTotalComplete`).
- **typed.** Two fields in the sheet, From and To. To is optional, and leaving it empty makes a point. Both accept 0 to 1000 with one decimal, and the fields swap if To is lower than From.

**Priority.** A typed estimate wins only when the student typed it after the newest mock. When a newer mock lands, the strip says "Your new mock changed your estimate", and the source becomes mocks again. Otherwise the order is mocks, then projection.

**Storage.**
- `data/tools_store.dart` keeps `{source, low, high, at}` for the typed estimate, per user, on the phone.
- Mocks and projection are computed fresh each time and never stored.
- Migration: an existing `scoreText` that parses to a number becomes a typed point estimate with `at` set to the time of migration. Then `scoreText` is deleted.

**Provider.** `estimateProvider` in `estimate/estimate_providers.dart` returns an `EstimateView`: `{Estimate? estimate, MockPartial? partial, bool loading}`. Compass, Programme, the Colleges tab, Check a score and Today's colleges card all read this one provider.

**Category.** There is one category per student (`compass_controller` `category`), shown as a chip in every estimate surface.

**What counts as a match:**
- `CompassState.couldClear(group)` becomes `estimate == null || estimate.high >= lowestCutoff(group)`. This keeps the website's meaning ("could clear a round") and uses the top of the range.
- The best options sort first by the number of colleges where the verdict is `clears`, then by colleges within range, then by colleges in total.

**Never shown:** "CUET score", "CSAS", "predicted", "chance", or a percentage of admission. The estimate is always labelled with its source (R24, R29; T008: a variable figure is shown as an estimate or range, never as a fixed quote).

### 2.2 Search matcher: `lib/features/tools/my_colleges/college_search.dart` (pure)

```dart
String duNormalise(String s);            // lower, '&'->' and ', [.()\[\],'’/-] -> ' ', collapse spaces, trim
String duCompact(String s);              // duNormalise(s) without spaces
List<String> duQueryTokens(String q);    // normalise, split, expand aliases (below)
int? duMatchRank(String query, String candidate, {List<String> extra = const []});
  // null = no match; lower = better
List<T> duSearch<T>(String query, List<T> items, String Function(T) name,
    {List<String> Function(T)? extra, int Function(T)? weight});
```

**Ranks:**
- 0: the candidate's compact form starts with the query's compact form ("bcom" against "bcomhons").
- 1: the candidate's compact form contains the query's compact form.
- 2: every query token is a prefix of some candidate token (after aliases).
- 3: every query token of 5 or more characters is within 1 edit (Damerau) of some candidate token, or within 2 edits at 8 or more characters. Shorter tokens must still prefix-match.

Ties break on `weight` descending (programmes: colleges; colleges: none), then on the name A to Z. An empty query returns everything in the caller's order.

**Aliases** (whole query tokens, expanded before matching; one table, unit-tested):

| Typed | Means |
|---|---|
| bcom | b com |
| ba | b a |
| bsc | b sc |
| hons, honours, honors, h | hons |
| eco, econ, econs | economics |
| polsci, pol | political |
| psych, psy | psychology |
| eng | english |
| math, maths | mathematics |
| bms | bachelor of management studies |
| bba, fia | bba, financial investment analysis |
| srcc | shri ram college of commerce |
| lsr | lady shri ram college for women |
| kmc | kirori mal college |
| svc | sri venkateswara college |
| jmc | jesus and mary college |
| dcac | delhi college of arts and commerce |
| sggscc | shri guru gobind singh college of commerce |
| hrc | hansraj college |

**Programme candidates** use `DuGroup.name` plus the extras `id.replaceAll('-', ' ')` and `family`. **College candidates** use the college name plus its short name where the onboarding catalogue has one (`DuOffering.short`).

**Tests** (`test/unit/tools/college_search_test.dart`):
- These all return B.Com. (Hons.) first: "bcom", "BCOM", "b.com", "B Com", "b com", "bcom hons", "B.Com (H)", "bcom honours", "b-com".
- "eco" returns B.A. (Hons.) Economics and B.A. (Hons.) Business Economics.
- "pol sci" returns Political Science.
- "hansraj", "hans raj" and "hansrj" (a typo) all return Hansraj College.
- "srcc" returns Shri Ram College of Commerce.
- "zzz" returns nothing.

Every search field in the area uses this matcher: the chooser, Compass's programme search, the programme page's "Find a college", Combo's target search and onboarding's ladder filter. Today's plain `contains` calls (`my_colleges_sheet.dart:168, 204`, `compass_screen.dart:153`, `combo_screen.dart` `matches`) are replaced.

### 2.3 `CollegeRung`: `lib/features/tools/colleges/college_rung.dart`

One row of the student's list wherever it shows with verdicts: the Colleges tab, Today's card (Today reuses it through the export) and the list in the chooser sheet.

```
[1]  Hansraj College                          907.5
     B.Com. (Hons.)                     Round 1, 2026
     ── Needs 267.5 more ──────────────────────────
```

**Layout:**
- **Left:** `MyCollegeRank` ring, 24 dp, with its existing look. Ranks 1 to 3 get a filled volt ring and ink text: those are the colleges on Today.
- **Middle:** the college name (`labelLarge`, at most 2 lines, never ellipsised), then the programme (`caption`, `ink2`).
- **Right:** the cutoff figure (`figure` style, tabular, 20 sp) with "Round 1, 2026" under it (`caption`, `ink3`). The figure is the category's Round 1 minimum. If it is null, "No Round 1 seat" sits in the figure's place, in `ink2`.
- **Third line, only when an estimate exists:** the verdict as words with a 6 dp dot.
  - Clears by N: `goodText`, dot `good`.
  - Within your range: `accentText`, dot `accent`.
  - Needs N more: `ink2`, dot `ink3`.
  - The dot is never the only signal, because the words always carry the verdict.

**Semantics** (one node): "Choice 1, Hansraj College, B.Com. (Hons.). Round 1, 2026: 907.5 of 1000. Your estimate needs 267.5 more."

**Size:** at least 64 dp tall, or 72 dp with the verdict line. The whole row is the tap target; on the Colleges tab it opens that programme in Compass with the college highlighted (`/tools/compass/:groupId?college=<name>`).

### 2.4 `AimLadder`: `lib/features/tools/my_colleges/aim_ladder.dart`

One component for "choose colleges in one course". It replaces `onboarding/widgets/college_ladder.dart` as the thing the student touches; onboarding keeps its file as a thin adapter.

It is pure UI: the caller passes `rows` (a college, its short name and its Round 1 figure for the category, highest first), `picked` (an ordered list of college names), `onToggle(name) -> ToggleResult {added, removed, full}`, `limit` (8), `onTodayCount` (3), and `filter` (a query string, matched with 2.2).

**A row:**
- A rail bubble on the left. Empty means not picked; volt with the pick number means picked.
- The college name: `labelLarge` when picked, `ink2` when not.
- The figure on the right (tabular).
- Picks 1 to 3 carry a tiny "On Today" tag under the name (`caption`, `accentText`).
- The whole row is a 56 dp target. Tapping toggles the pick.

**The "full" state:** the row shakes with `MmShake` and the warn haptic. The live line under the ladder reads "8 is the most. Drop one to add another."

**Count line**, pinned above the ladder: "3 of 8 picked" (rolls on change).

**Picked rows always show**, even when filtered out or below "Show all". This keeps today's behaviour (`college_ladder.dart` "Picks always show").

**Default view:** the first 7 rows, then "Show all 55". With a filter, every match shows.

**Data sources:**
- **Onboarding:** the static catalogue `onboarding/data/du_catalog.dart` (six Commerce programmes, works offline, before sign-in).
- **Chooser:** `duOfferingsProvider(groupId)`. Rows come from `DuOfferings.seats`, using the Round 1 figure for the category, sorted high to low. Colleges with no figure go last, under "No Round 1 seat for Unreserved".

---

## 3. Screen A: Colleges tab root (`/colleges`, branch 3)

**Job:** "Are my marks heading to the colleges I want, and where do I go to find out more?"

**Primary action:** **Choose your colleges** while the list is empty, otherwise **Open Compass** (R7).

**File:** new `lib/features/tools/colleges/colleges_screen.dart`, exported as `collegesScreen` from `tools_routes.dart`.

### 3.1 Wireframe, 390 dp, account A (4 colleges, mocks present, Night)

```
┌──────────────────────────────────────────────┐
│ (O)  Colleges                                │  TabRootHeader: avatar opens the account sheet
│                                              │
│ My colleges                         Edit     │  ToolsHeading + quiet key
│ 4 of 8 · first 3 show on Today      [Mobi]   │  caption; Mobi 48 dp, right (3.4)
│ ┌──────────────────────────────────────────┐ │
│ │ Your estimate  588 to 640  of 1000   Change│ │  EstimateBar (compact); Change opens the sheet
│ │ From your latest full mocks · Unreserved │ │
│ └──────────────────────────────────────────┘ │
│ (1) Hansraj College                  907.5   │  CollegeRung ×4, divided by hairlines
│     B.Com. (Hons.)            Round 1, 2026  │
│     • Needs 267.5 more                       │
│ (2) Kirori Mal College               903.7   │
│     B.Com. (Hons.)            Round 1, 2026  │
│     • Needs 263.7 more                       │
│ (3) Shaheed Bhagat Singh College     862.0   │
│ (4) Delhi College of Arts and Commerce 845.2 │
│     + Add a college                          │  quiet row, opens the chooser
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Admission Compass              [compass] │ │  CompassCard (3.3)
│ │ 35 of 73                                 │ │
│ │ DU programmes open to your 4 subjects    │ │
│ │ ┌──────────────────────────────────────┐ │ │
│ │ │            Open Compass              │ │ │  KeyButton (volt, the primary)
│ │ └──────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ [≡] Check a score                         >  │  ToolsLinkRow ×5 in one ToolsPanel
│     See which colleges a score clears        │
│ [▦] Combo planner                         >  │
│     Find the papers that open your courses   │
│ [▤] CUET 2027 exam guide                  >  │
│     Expected dates and a month-by-month plan │
│ [□] Previous-year questions               ↗  │
│     How to practise with past papers.        │
│     Opens the website                        │
│ [▯] Official DU documents                 >  │
│     The Bulletin and the three round lists   │
│                                              │
│ DU data: 2026 admission rounds and the       │  ToolsNote
│ UG Bulletin 2026-27.                         │
│                                              │
│ [ Today  Practice  Start  Review  Colleges  You ]
└──────────────────────────────────────────────┘
```

At 360x800 the first screen must show the header, My colleges with the estimate and at least 2 rungs. The Compass card starts within one scroll.

### 3.2 Sections top to bottom, with exact copy

1. **Header:** `TabRootHeader(title: 'Colleges')` with the avatar. There is no lead line.
2. **My colleges.**
   - Heading "My colleges". Trailing quiet key "Edit" when the list has 1 or more colleges; it opens the sheet (screen B) in list mode.
   - Caption: `'${n} of 8 · first 3 show on Today'`. With fewer than 3 colleges it is just `'${n} of 8'`.
   - **EstimateBar** (`estimate/estimate_bar.dart`, compact variant), in one of four states:
     - **Estimate from mocks:** "Your estimate" + `"588 to 640"` (figure) + "of 1000". Second line: "From your latest full mocks · Unreserved". Trailing "Change".
     - **Typed:** second line "Typed by you · Unreserved".
     - **Projection:** second line "From your practice projection · Unreserved".
     - **Point:** `"612"` in place of the range.
   - **No estimate, partial mocks:** the bar is replaced by a one-line note in `ink2`: "Full mocks in 2 of the 4 papers DU counts. Economics and Business Studies still need one." A quiet key "Type an estimate" sits under it. No volt.
   - **No estimate and no mocks** (account B): "Your full mocks will show here against each college." The same quiet key "Type an estimate" sits under it.
   - **Rungs:** `CollegeRung` for every college on the list (up to 8). There is no "Show more", because 8 rows is the limit and fits.
   - "+ Add a college" quiet row when the list is not full. When it is full: "My colleges is full at 8. Remove one to add another." (existing `fullLine`).
3. **Compass card** (`colleges/compass_card.dart`):
   - Label "Admission Compass" with the brass compass object at 56 dp, right (reusing `compass_hero.dart`'s art widget at its small size).
   - Figure line `"35 of 73"`, then "DU programmes open to your 4 subjects", built from `ToolsCopy.todayCompassNote`'s data.
   - Key "Open Compass", which pushes `/tools/compass?from=colleges`.
   - **No subjects known:** the figure is hidden; the body reads "See which DU programmes your subjects open." and the key still says "Open Compass".
   - **Empty list:** the key becomes `KeyButton.secondary`, because the primary is then Choose your colleges.
4. **Tools list:** one `ToolsPanel` of `ToolsLinkRow`s, in this order. These replace the hub's rows (`hub/tools_hub_screen.dart`).

   | Row | Note | Opens |
   |---|---|---|
   | "Check a score" | "See which colleges a score clears" | `/colleges/cutoff` |
   | "Combo planner" | "Find the papers that open your courses" | `/tools/combo?from=colleges` |
   | "CUET 2027 exam guide" | "Expected dates and a month-by-month plan" | `/tools/guide-2027` |
   | "Previous-year questions" | "How to practise with past papers. Opens the website" | a Custom Tab; trailing icon is external link |
   | "Official DU documents" | "The Bulletin and the three round lists" | `showSourcesSheet` |

5. **Data line:** "DU data: 2026 admission rounds and the UG Bulletin 2026-27." (This replaces `ToolsCopy.dataLine`, so the word "CSAS" is gone.)
6. Bottom padding: bar height plus `MmRhythm.section`. There is no `SliverFillRemaining`.

### 3.3 States

| State | What shows |
|---|---|
| **Loading** (list read running, nothing on the phone) | My colleges shows `SkeletonGroup` with 3 rung skeletons (64 dp each) and the label "Loading your colleges". The Compass card shows its own skeleton figure. The tools list renders at once, because it needs no data. Mobi does `loading` only if the read takes more than 600 ms. |
| **Empty** (list read, 0 colleges) | See 3.5. |
| **Sparse** (1 or 2 colleges) | The rungs, then "+ Add a college". The caption is just "1 of 8". Nothing else changes, and no filler is added. |
| **Error** (no list on the phone) | `InlineBanner(error)` with "Your colleges did not load." and "Try again". The Compass card and tools still render. Mobi does `oops`. |
| **Offline with a copy** | `InlineBanner(offline)` with "You are offline. This is the list saved on this phone." The rungs come from the copy. Edit still opens the sheet, and changes say "You are offline, so that change was not saved." |
| **Offline, no DU data** | The rungs show without figures ("Figure loads when you're online" in `ink3`). The Compass card reads "Compass needs a connection the first time." with the key disabled and its reason as a tooltip. |
| **Signed out** | "Sign in to keep a list of colleges." with a `KeyButton` "Sign in" (`/sign-in`). The Compass card and tools work, because DU data is public. |
| **Success** (return from the sheet after adding) | The new rung grows in at its position (3.6). The count rolls. Mobi reacts per 3.4 only if the verdicts changed. |
| **Return** (switching back to the tab) | The scroll position is kept (`PageStorageKey('colleges')`). Nothing replays. Mobi stays still unless the data changed. |

### 3.4 Mobi on this screen (one Mobi, 48 dp, right of the My colleges caption)

| State | Act | When it plays |
|---|---|---|
| List loading for more than 600 ms | `loading` | While loading; settles to `idle` when the list lands |
| Empty | `point`, toward the Choose key, then held | Once per tab visit; idle breathing afterwards |
| Estimate exists and at least 1 of the student's colleges is "clears" or "within" | `proud` | Once per change of estimate or list, keyed on a hash of (estimate, list) stored in memory |
| Estimate exists and all are "below" | `encourage` | The same rule |
| Read failed | `oops` | Once |
| Colleges but no estimate | **No Mobi** | There is nothing to react to (L35: "never decoration") |

Mobi never speaks a line here, because the verdict words already say it. It is excluded from semantics (`ExcludeSemantics`), since the words carry the meaning.

### 3.5 Empty state wireframe (account B, or A before choosing)

```
│ My colleges                         [Mobi→]  │  Mobi points left-down at the key
│ Which colleges are you aiming for?           │  title style 20 sp
│ Pick a course, then the colleges you'd say   │  body, ink2
│ yes to. Each shows its lowest Round 1 score  │
│ from 2026.                                   │
│ ┌──────────────────────────────────────────┐ │
│ │         Choose your colleges             │ │  KeyButton volt (the primary)
│ └──────────────────────────────────────────┘ │
│ (B.Com. (Hons.)) (B.Com.) (Economics) (BMS) →│  course chip rail, horizontal scroll
```

- The chip rail lists the six onboarding courses by short name: B.Com. (Hons.), B.Com., B.A. (Hons.) Economics, Business Economics, BMS, BBA (FIA).
- A chip opens the chooser **straight on that course's ladder**.
- The key opens the chooser at the course the student gave in onboarding, if any (`answers.courseId`), otherwise at the programme list.
- Below this block come the Compass card (secondary key) and the tools list, as in 3.2.

### 3.6 Motion (Colleges tab)

| Motion | Spec | What it answers |
|---|---|---|
| First paint of the tab in a session | Sections rise 8 dp and fade in, `Motion.enterDuration` 360 ms, `Motion.out`, stagger 45 ms, at most 4 groups. Later visits: none. | "The page is here." Arrival, once. |
| A rung added | `SizeTransition` plus fade, 300 ms `Motion.glide`. The new rank ring inks from empty to filled over 200 ms. | Where the new college landed in the order |
| Count "4 of 8" | Rolling digit, `Motion.numberRoll` 500 ms | The change was counted |
| Estimate changed | Verdict numbers roll (500 ms). The verdict word cross-fades (200 ms). | What the new estimate changes |
| Press on a rung, row or card | Scale 0.98 over 100 ms (`press`), spring back in 140 ms (`release`). Selection haptic on keys only. | "Touched" |
| Reduced motion | All of the above become a 120 ms cross-fade (`reducedFade`); numbers jump; Mobi holds its still pose. | Same information, no movement |

### 3.7 Night and Day

- No new colours. Rungs sit on `ToolsPanel` (plain surface, hairlines), not cards (R33).
- The Compass card is the one raised surface: `ToolsCard`, as on the hub golden. Volt appears only on its key, on ranks 1 to 3 and on "within".
- In Day, `goodText` and `accentText` on the panel tint must reach 4.5:1. The critic checks this with the contrast script on `colleges_*_day.png`.

### 3.8 Accessibility

- The heading order is header, then "My colleges", then "Admission Compass", then the tools.
- The estimate bar is one node: "Your estimate, 588 to 640 out of 1000, from your latest full mocks, Unreserved. Change, button."
- At 1.3x text, college names wrap to 2 lines, figures never truncate, and the estimate bar wraps to 3 lines.
- At 1.5x and above (`kSheetFullPageTextScale`), sheets become pages. The tab itself is unchanged.
- Focus order follows the visual order. Every row is at least 48 dp tall.

---

## 4. Screen B: My colleges sheet (list mode and chooser mode), L24 and L25

**Job:** keep an ordered list of up to 8 colleges, and add one in under 10 seconds.

**Primary action:** in list mode, "Add a college"; in chooser mode, tapping a college row (each row is its own action, and there is no separate Save, because each change saves on the server when it is made).

**Files:** `my_colleges/my_colleges_sheet.dart` (rewritten), `my_colleges_body.dart`, `my_colleges_copy.dart`, and a new `my_colleges/chooser_sheet_layout.dart`.

### 4.1 Opening it (L25: Choose and Start must work)

There is one entry function, and every caller uses it (Today's card, the Colleges tab, Compass, programme rows, You's Aim row):

```dart
Future<void> showMyCollegesSheet(BuildContext context, {MyCollegesEntry entry = MyCollegesEntry.auto, String? programmeId});
// auto: list mode when the list has colleges, chooser otherwise.
// chooser + programmeId: straight to that programme's ladder.
```

- It **opens the sheet on the first frame** with the list's state as it stands, even while loading, so a tap always produces a sheet within 100 ms. It never pushes a tab and never shows "Could not load a suggestion".
- When the course is known (`programmeId`, else the first college's programme, else onboarding's `courseId`), the chooser opens on that course's ladder with a course chip "B.Com. (Hons.) · Change".

### 4.2 Keyboard-aware layout (the L24 fix)

- The sheet has a fixed height: `heightFactor: 0.92` in chooser mode. List mode has no fixed height (it fits its content, up to 680).
- **Structure:** a `Column` with:
  - **[handle]**
  - **[title row 48 dp:** back chevron 48x48, when chooser mode was entered from list mode or a course is open; the title "My colleges" in list mode, "Add a college" in chooser mode; trailing "Done" quiet key, which closes the sheet**]**
  - **[pinned:** course chip (chooser on a course), then the search field 52 dp, then the count line**]**
  - **[`Expanded` `ListView.builder`** of results**]**
- The whole column sits inside `Padding(bottom: MediaQuery.viewInsetsOf(context).bottom)`, and its height is `min(0.92 × H, H − viewInsets.bottom − topSafe − 8)`.
- The list therefore always ends at the top of the keyboard and resizes with the keyboard frame by frame. There is no extra animation.
- **The ListView has:**
  - `keyboardDismissBehavior: manual`, so it scrolls with the keyboard open.
  - `padding: EdgeInsets.only(bottom: MmSpace.s16)`.
  - On every query change, a jump to the top. The jump is not animated, so typing never lags.
- **Budget at 360x800 with the keyboard open** (keyboard about 300 dp): available height 800 − 300 − 24 (top safe) − 8 = 468. Fixed parts: handle 28 + title 48 + chip 40 + search 52 + count 24 = 192. That leaves **276 dp for results, which is 4 rows of 64 dp**. The acceptance asks for at least 3.
- **Autofocus:** the search field focuses when the chooser opens on the programme list. It does **not** focus when it opens on a course ladder: there the student sees the ladder first, and the keyboard would hide it. Tapping the field focuses it.
- **Needed from Shell:** `MmSheetScaffold` and `showMmSheet` must accept a `pinned` header slot and `resizeForKeyboard: true`, which switches the body from the scaffold's `SingleChildScrollView` to the caller's own `Expanded` list. Until Shell builds it, the chooser uses its own `chooser_sheet_layout.dart` inside `showModalBottomSheet` with the same glass and handle (section 11).

### 4.3 Wireframe, chooser on a course, keyboard closed (390 dp)

```
┌──────────────────────────────────────────────┐
│                  ────                        │
│ <   Add a college                     Done   │
│ (B.Com. (Hons.)  Change)  (Unreserved  v)    │  course chip + category chip
│ ┌──────────────────────────────────────────┐ │
│ │ ⌕  Find a college                        │ │  ToolsSearchField (matcher 2.2)
│ └──────────────────────────────────────────┘ │
│ 3 of 8 picked · first 3 show on Today        │  count line, rolls
│ ●1  Hindu College                     919.9  │  AimLadder rows; ● = picked (volt)
│     On Today                                 │
│ ○   Lady Shri Ram College for Women   912.5  │
│ ●2  Hansraj College                   907.5  │
│     On Today                                 │
│ ○   Kirori Mal College                903.7  │
│ ●3  Ramjas College                    895.6  │
│     On Today                                 │
│ ○   Sri Venkateswara College          891.5  │
│     Show all 55                              │
└──────────────────────────────────────────────┘
```

With an estimate, each row's figure gets a verdict line under the name ("Needs 267.5 more"). Without one, the row shows the figure only.

### 4.4 Chooser on the programme list (no course yet, or after "Change")

```
│ <   Add a college                     Done   │
│ ┌──────────────────────────────────────────┐ │
│ │ ⌕  bcom|                              ×  │ │  focused; keyboard open below
│ └──────────────────────────────────────────┘ │
│ 2 programmes                                 │  result count, live region
│ B.Com. (Hons.)                            >  │  matched part in ink, rest in ink2
│ 55 colleges · Round 1: 645.3 to 924.3        │
│ B.Com.                                    >  │
│ 44 colleges · Round 1: 609 to 889.8          │
╞══════════════ keyboard ══════════════════════╡
```

- Programme rows: the name (`labelLarge`, with the matched part highlighted in `ink`) and a note: `'${colleges} colleges · Round 1: ${low} to ${high}'` for the category.
- Programmes with no cutoffs are listed last, with the note "No CUET cutoff list published". Today those rows are hidden (`hasCutoffs` filter); now they show but cannot be added, so search never says "nothing" for a real programme.
- **Order with no query:** the student's course first, then the six Commerce programmes, then the rest A to Z. This replaces today's plain A to Z, which put B.A. (Hons.) Applied Psychology first (see the golden).
- Tapping a programme opens its ladder in place: a horizontal slide, 300 ms `glide`, with the chip showing the programme. Back returns to the list with the query kept.

### 4.5 List mode (Edit)

```
│                  ────                        │
│ My colleges                           Done   │
│ 4 of 8 · first 3 show on Today               │
│ (1) Hansraj College                ×   ≡     │  remove 48 dp, drag handle 48 dp
│     B.Com. (Hons.) · 907.5                   │
│ (2) Kirori Mal College             ×   ≡     │
│ (3) Shaheed Bhagat Singh College   ×   ≡     │
│ ─────────── On Today above this line ──────  │  hairline with caption, after rank 3
│ (4) Delhi College of Arts and Com. ×   ≡     │
│ ┌──────────────────────────────────────────┐ │
│ │            Add a college                 │ │  KeyButton (volt, primary of the sheet)
│ └──────────────────────────────────────────┘ │
```

- **Reorder:** `ReorderableListView` with a drag handle on the right. Long-pressing anywhere on the row also lifts it.
- **Accessibility actions** replace the up and down icon buttons, which were three 48 dp icons crowding each row: `Semantics(customSemanticsActions: {Move up, Move down, Remove})`.
- **Remove:** "×" removes at once, with a snackbar "Removed Hansraj College." and **Undo**, which re-adds it at the same position. There is no confirm dialog.
- **The "On Today" divider** sits after rank 3, so it shows what Today shows (R9).
- **Lede:** the long line "The same list on the website. Today shows your first 3, so put your top choices first." is retired. The divider and the caption say it in fewer words (L28 rule: no filler lines).

### 4.6 States (both modes)

| State | Copy and behaviour |
|---|---|
| Programmes loading | 5 skeleton rows of 64 dp, label "Loading programmes" |
| Programmes failed or offline | Existing `InlineBanner` copy (`programmesFailed`, `programmesOffline`) and "Try again", inside the list area. The search field stays usable for the cached catalogue, if any. |
| No match | "Nothing matches “bcmo”. Try the course's short name, like B.Com." in `ink3`. Under it, a quiet key "Search all colleges", which searches colleges of the student's course when one is set. |
| Adding (saving) | The row's plus becomes a 16 dp spinner. The row stays tappable for undo only after the server confirms (`view.busy`). |
| Saved | A tick morph (4.7). The count rolls. A selection haptic. |
| Save failed | The row reverts. The notice line (`MyCollegesNotice`) shows the existing copy (`offlineSave`, `saveFailed`, `signInAgain`, `slowDown`) as a live region pinned above the list, so the keyboard never hides it. |
| Full | The row shakes, with the warn haptic. "8 is the most. Drop one to add another." |
| Signed out | "Sign in to keep a list of colleges." with a "Sign in" key. The ladder is visible read-only (value before the gate, T003). |

### 4.7 Motion (sheet)

| Motion | Spec | Answers |
|---|---|---|
| Sheet in and out | Existing: 420 ms `emphasized` in, 240 ms `drawer` out | Opening and closing |
| Programme list to course ladder | Shared-axis X: out 90 ms fade with an 8% slide, in 300 ms `glide` | Going deeper in one flow, and back |
| Add | Plus becomes tick: rotate 90° and cross-fade over 200 ms (`ui`). The bubble fills volt and the pick number scales 0.6 to 1 on a spring over 240 ms (`card`). | "It is on your list, at this place" |
| Remove (list mode) | Row collapses: `SizeTransition` 240 ms `exit` plus a fade of 160 ms. Rows below slide up together. | Where it went |
| Drag | Lifted row scales to 1.02 with a soft shadow; neighbours slide 200 ms `out`. Light impact haptic on drop. | Order changing |
| Keyboard | No added animation; the sheet follows `viewInsets` each frame | The list stays in view |
| Reduced motion | 120 ms cross-fades; no scale or spring | |

**Mobi:** none in this sheet. It sits over the Colleges tab, Today or Compass, which already have their one Mobi or their hero object (C10).

---

## 5. Screen C: Your estimate sheet (and Check a score), L26

This sheet replaces `compass/category_score.dart`'s "Category and score" sheet and `score_sources.dart`.

**File:** new `estimate/estimate_sheet.dart`, with `mode: EstimateMode.estimate | EstimateMode.check`.
- **Estimate mode:** opened from "Change" or "Type an estimate" on any estimate bar. Title "Your estimate".
- **Check mode:** `/colleges/cutoff` (`collegesCutoffScreen`, an `MmSheetPage`), plus web `/cuet-cutoff-calculator`. Title "Check a score".

**Primary action:**
- Estimate mode: **Done** (saves; volt).
- Check mode: **See every programme**, which pushes `/tools/compass?score=<low>-<high>&category=<c>&from=colleges`. A secondary key, "Use as my estimate", saves the range as typed.

### 5.1 Wireframe, estimate mode, account A (mocks present)

```
┌──────────────────────────────────────────────┐
│                  ────                        │
│ Your estimate                                │
│ ( ◔ )  31 of 55  B.Com. (Hons.) colleges     │  live ring (existing _ClearStrip, retitled)
│        your range clears · 9 more within it  │
│ Category                                     │
│ (●Unreserved) (OBC) (SC) (ST) (EWS) (Other)  │  MmChip wrap
│                                              │
│ ◉ From your latest full mocks                │  radio row 56 dp
│   588 to 640 of 1000                         │  figure
│   English 152 · Accountancy 161 ·            │  caption: each paper of 250, latest mock
│   Business Studies 148 · Economics 151       │
│   Raw marks, out of 250 a paper. Your last   │  caption ink3, one line of truth
│   3 mocks in each paper set the range.       │
│ ○ Type your own                              │
│   ┌────────────┐  to  ┌────────────┐         │  shown only when selected
│   │ From  600  │      │ To  650    │         │  numeric, 0 to 1000
│   └────────────┘      └────────────┘         │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │                  Done                    │ │  footer (pinned)
│ └──────────────────────────────────────────┘ │
│              Clear my estimate               │  quiet, only for a typed estimate
└──────────────────────────────────────────────┘
```

- The ring line names the **student's own course**: the first college's programme, else the onboarding course, else the best option.
  - With 2 or more courses on My colleges, a chip row above the ring switches between them.
  - Copy: `'$clears of $total'` + `' ${programme} colleges'` / `'your range clears · $within more within it'`.
  - For a point estimate: `'your estimate clears'`.
  - With no estimate selected yet: the ring is empty, with "Type a range to see what it clears".
- **Projection** (Pro accounts): a third radio between mocks and typed, "From your practice projection", showing `'${low} to ${high} of 1000'`.
- **Partial mocks:** the mocks radio is disabled and shows "Full mocks in 2 of 4 papers. Economics and Business Studies still need one." with a quiet key "Practise Economics" (opens a practice start, subject filled).
- **No mocks:** the mocks radio is absent and "Type your own" is selected, with the fields empty. The sheet opens with **no keyboard**. The fields focus only on tap, so the ring and the category are seen first.
- **Copy that is removed:** "Your CUET score, out of 1000", "Use the score on your CSAS dashboard, or a target you are aiming for.", "Optional. Compass works without it…". Field labels instead: "From" and "To". Helper under the fields: "Out of 1000. A range is fine; most students aren't sure yet."
- **Validation:** if a field is not 0 to 1000, the error under it reads "Enter a number from 0 to 1000." Done stays enabled; tapping it with an error focuses the bad field and shakes it.
- **Keyboard:** this sheet must pad by `viewInsets` (it does today) and pin Done above the keyboard (`footer`).

### 5.2 Check mode differences

- **Title:** "Check a score".
- **Order:** category chips → the "Type your own" fields only (no source radios) → the result block (large).
- **Result block:**
  - "**31 of 55** B.Com. (Hons.) colleges" + "a score of 600 to 650 clears in Round 1, 2026 (Unreserved). 9 more are within the range."
  - Under it: "Your colleges: 1 of 4 clear" when the list has colleges.
  - The course chip row switches the programme.
- **Fields:** they prefill from the estimate when there is one, and the student can change them freely. Nothing is saved until "Use as my estimate".
- **Keys:** "See every programme" (primary) and "Use as my estimate" (secondary).
- **Web mapping:** `/cuet-cutoff-calculator?score=612` opens this sheet with 612 in From.

### 5.3 States

- **DU data loading:** the ring is a skeleton with "Loading DU cutoffs". The fields and chips work.
- **Offline, no data:** "Cutoffs load once with a connection, then stay on this phone." with "Try again".
- **Saved:** the sheet closes, and the bar on the screen beneath rolls its numbers.

### 5.4 Motion

| Motion | Spec | Answers |
|---|---|---|
| Ring (existing `_ClearStrip`) | Sweeps to the new fraction, 500 ms `out`. The count rolls. | What the typed range clears, live |
| Radio switch | The typed fields reveal through `SizeReveal`, 240 ms | The fields appear because they were chosen |
| Reduced motion | The ring jumps; 120 ms fade | |

**Mobi:** none. The ring is the moment, and the screen beneath has its own Mobi.

---

## 6. Screen D: Admission Compass, rethought (`/tools/compass`), L23 and L26

**The student's question:** "Which DU courses do my subjects open, and which of their colleges can my marks reach?"

**Primary action:** **Open {best course}**, which goes to the programme page of the student's course, or of the best option when no course is known. It is never "Add your expected score".

**Hierarchy:** **answer** (the count) → **set** (category) → **decide** (best options with your band) → **where you stand** → **open more** (unlocks) → **explore** (streams, folded) → **not open yet** → **my colleges here** → Pro → practise → links.

### 6.1 Wireframe, account A, Night, 390 dp

```
┌──────────────────────────────────────────────┐
│ <  Admission Compass                         │
│ Which DU courses do your subjects open?      │  lead (kept: it is the question)
│ ┌──────────────────────────────────────────┐ │
│ │ 35 of 73                       [compass] │ │  CompassHero, unchanged count + art
│ │ DU programmes open to these subjects     │ │
│ │ (English)(Accountancy)(Business St.)(Eco→│ │  ONE chip rail, horizontal scroll
│ │ ✎ Edit subjects                          │ │
│ └──────────────────────────────────────────┘ │
│ (●Unreserved) (OBC) (SC) (ST) (EWS) (Other)  │  category rail, inline (L26 acceptance)
│ ┌──────────────────────────────────────────┐ │
│ │      Open B.Com. (Hons.) colleges        │ │  _FirstMove: the primary (volt)
│ └──────────────────────────────────────────┘ │
│                                              │
│ Your best options                            │
│ Open to your subjects; your range clears     │
│ the most colleges first.                     │
│ B.Com. (Hons.)                     31 of 55 >│  ProgrammeRow(bar): "clears" count / colleges
│ ├──────[▓▓▓]────────────────────┤            │  CutoffBar 645.3–924.3 + estimate band
│ 645.3                         924.3          │
│ B.A. (Programme)                   48 of 54 >│
│ B.A. (Hons.) English               12 of 48 >│
│                                              │
│ Where you stand                              │
│ Your estimate  588 to 640  of 1000    Change │  EstimateBar (full)
│ From your latest full mocks                  │
│                                              │
│ Add one subject to open more                 │
│ (+ Mathematics +6) (+ General Aptitude +4) → │  unchanged rail
│                                              │
│ All 35 open to you                           │
│ ┌──────────────────────────┐ ┌────────────┐  │
│ │ ⌕ Search programmes      │ │ ⇅ Most     │  │  matcher 2.2; sort
│ └──────────────────────────┘ └────────────┘  │
│ Commerce & Economics          2 · top 55   v │  stream row, OPEN (student's stream)
│   B.Com. (Hons.)  Round 1: 645.3 to 924.3 55 │
│   B.Com.          Round 1: 609 to 889.8   44 │
│ Humanities & Social Sciences 26 · top 54   > │  folded: one row, count + largest
│ Science                       2 · top 2    > │
│ Languages                    ...           > │
│                                              │
│ Not open yet (38)                       Show │
│ My colleges here         4 of 8       Edit > │  one row (6.2.9)
│ ...Pro, Practise these subjects, links...    │
│ DU data: 2026 admission rounds and the UG    │
│ Bulletin 2026-27.                            │
└──────────────────────────────────────────────┘
```

### 6.2 Sections, changes against today's code (`compass_screen.dart` `_ready`)

1. **Hero** (`compass_hero.dart`): the count and art are kept. Subject chips become **one horizontal rail**, with the trailing chip fading at the edge. Today they wrap to 2 or 3 rows, which pushed the answer down. "Tap a subject to take it off." becomes a tooltip on a long-press of a chip, because the line was instruction text. "Checked against DU's 2026-27 subject rules" stays as the caption.
2. **Category rail** (new, inline): the `MmChip`s from `CategoryScorePanel` (the five main categories plus "Other quota", which opens its existing sheet). Changing it re-runs the verdicts. A replay key triggers `RankedReveal`, as today.
3. **First move** (`_FirstMove`): **always** "Open {programme} colleges", pushing `ToolsPaths.programme(id)`. The programme is the student's course when it is open to them, else `compassBestOptions(s).first`. If nothing is open, `_NoneOpen` takes this place, as today.
4. **Your best options:** top 3 (`_bestCount`), shown when 6 or more programmes are open, as today.
   - Note copy: with an estimate, "Open to your subjects; your range clears the most colleges first."; without one, "Open to your subjects, with the most colleges first."
   - Each `ProgrammeRow(bar: true)` gains:
     - an **estimate band** on `CutoffBar`: a volt band from low to high clamped to the bar's range, 8 dp tall, radius 4. A point estimate is a 3 dp tick. Outside the range, a chevron sits at the end with "Your estimate is below this range". `cutoff_bar.dart` gets `estimateLow` and `estimateHigh`.
     - a trailing figure: `'$clears of $colleges'` with the unit "clear" under it. Without an estimate: `$colleges` with "colleges", as today.
5. **Where you stand:** `EstimateBar` (full variant) **below** the best options, with the same states as 3.2.2. This replaces `CategoryScoreBar`; category now lives in the rail. Heading "Where you stand".
6. **Unlocks:** unchanged (`_Unlocks`).
7. **All N open to you:**
   - Search (matcher 2.2) and sort (unchanged three sorts).
   - The "Only where my estimate reaches a cutoff" switch replaces `onlyClearing` and shows only with an estimate.
   - **Each stream is a folded row**, `StreamFold` (new, `compass/stream_fold.dart`):
     - Title = the stream name.
     - Note: `'$n · top ${maxColleges}'`, meaning the count of programmes and the most colleges any of them has.
     - With an estimate, the note becomes `'$n · your range clears in $k'`.
   - **Open by default:** the stream of the student's course (Commerce & Economics for this audience), and every stream while a search is typed (rows that do not match hide).
   - Inside: today's rows and `_OtherProgrammes` fold, unchanged.
   - This answers "something nudging people to open it" (L23). Every folded row says what is inside, and the page is about 4 rows long instead of 35.
8. **Not open yet:** unchanged.
9. **My colleges here:** today's `MyCollegesSection` (a full editable list) becomes one `ToolsLinkRow`:
   - title "My colleges", note `'$n of 8 · ${clears} clear on your estimate'` (or `'$n of 8'`), trailing "Edit".
   - It opens screen B.
   - The list's full view is the Colleges tab; nothing is cut (moves table, 6.5).
10. **Compass Pro, Practise these subjects, links (Combo, sources), data line:** unchanged order. "Practise these subjects" rows use `SubjectEmblem` at 40 dp (L37 rule: the right object or initials, never another subject's object).

### 6.3 States

These keep today's widgets: `_SearchingLoad` (loading, with the compass searching in the hero corner), `ToolsLoadFailed` (error, offline), `_StaleBanner` (stale), `_NoneOpen` (none open), and the empty hero ("Start with your subjects").

**Changes:**
- **No subjects (empty hero):** the category rail and first move are hidden. The hero key "Choose subjects" is the primary.
- **Account B (no papers):** there is no estimate. The best options show colleges counts, and "Where you stand" shows "Your full mocks will show here against each college." with "Type an estimate". **No field is shown up front** (L26 acceptance).
- **Arrived with `?score=` from Check a score:** a dismissible line at the top reads "Showing a score of 600 to 650. This isn't saved as your estimate." with a quiet "Use as my estimate".

### 6.4 Motion

| Motion | Spec | Answers |
|---|---|---|
| Stream fold | `SizeTransition` 300 ms `glide`; the chevron rotates 180° over 200 ms; rows inside play `RankedReveal` (existing, 45 ms stagger, cap 6) | What is inside, revealed in place |
| Estimate band | Slides and resizes 300 ms `glide` when the estimate or category changes | Where your marks sit against this course |
| Category change | Figures roll 500 ms; rows replay (existing replay key) | The numbers changed for your category |
| Compass art | Existing settle when the count lands | The count is in |
| Reduced motion | No slide or rotation; 120 ms cross-fade | |

**Mobi:** none. The brass compass is the hero object (IA section 3; `compass_hero.dart` comment). This is held by `mobi_moments_one_per_screen_test`.

### 6.5 Moves on Compass (nothing is cut)

| Today | Now |
|---|---|
| "Add your expected score" as the volt primary | The estimate bar under the best options; the primary opens a course |
| Category and score sheet | Category: inline rail. Estimate: the estimate sheet (C). |
| Two to three rows of subject chips | One chip rail |
| 35 rows across all streams, open | Folded stream rows, the student's stream open, all streams open while searching |
| `MyCollegesSection` (full editable list) | One row into the sheet; the full list is the Colleges tab |
| "Use the score on your CSAS dashboard" | Removed (L26) |

---

## 7. Screen E: Programme page (`/tools/compass/:groupId`), L23

**Job:** "Which colleges of this course can I reach, and how do I add one?"

**Primary action:** none page-wide. Each college row's "Add to my colleges" is the action; that is a list page (R7 allows it with this reason).

**Changes to `programme_screen.dart` and `cutoff_table.dart`:**
1. **Under the title** ("B.Com. (Hons.)"; "Commerce & Economics. 55 colleges."):
   - The "Open to you" status pill is kept.
   - **New "Where you stand" line**, when an estimate exists: "Your estimate clears 31 of 55 colleges here. 9 more are within your range." Next to it sits Mobi at 40 dp (7.1).
   - Without an estimate: "Your full mocks will show here against each college." and a quiet "Type an estimate".
2. **Eligibility rules:** unchanged. The heading copy is unchanged ("DU's eligibility rules, checked against your subjects").
3. **Cutoffs:**
   - The heading "College cutoffs, CSAS 2026" becomes "College cutoffs, 2026 rounds".
   - The "Category: unreserved" line plus "Change" becomes the inline category rail (as in 6.2.2).
   - Search uses matcher 2.2.
   - The default sort is "Seats you clear first" when an estimate exists, otherwise "Highest first".
4. **College card** (existing): Round 1, Round 2 and Round 3 figures, plus:
   - a **verdict line** under the figures, on Round 1 ("Clears by 12.4" or the others);
   - "Add to my colleges" / "In My colleges" (existing `AddToMyCollegesKey`). Its press feedback is a tick morph, as in 4.7.
   - `?college=` from a rung scrolls that card into view and gives it a 1.2 s volt outline that fades. That answers "this is the one you tapped".
5. "Round I", "Round II" and "Round III" become "Round 1", "Round 2" and "Round 3" across the area (plain numerals).

### 7.1 Mobi on the programme page

There is one Mobi at 40 dp beside the "Where you stand" line, only when an estimate exists:
- `nod` once if 1 or more colleges clear;
- `think` if none clear but some are within the range;
- `encourage` if all are below.

There is no Mobi without an estimate. Each act plays once per (estimate, category) pair.

---

## 8. Screen F: Combo planner (`/tools/combo`), L27

**Job:** "Which CUET subjects should I put on the form to open the courses I want?"

**Primary action:** **See the courses and cutoffs** on the best combination (existing), which pushes Compass with that combination.

### 8.1 Structure

- **Progress header** (new `combo/combo_progress.dart`), pinned under the title as a sliver persistent header, 56 dp.
  - It shows three segments: **Targets · Subjects · Papers**. Each is filled volt when its step has a value, and the current step is outlined.
  - The caption gives the count: "Step 2 of 3: Subjects" or, when all are set, "All set. Tap a step to change it."
  - Tapping a segment scrolls to that step (summary mode) or opens it (step mode).
  - Progress is truthful: a segment fills only when the student or a real default set it, and the defaults say "From your colleges" or "From your sheet" (R17, T002; R13, T001).
- **Prefill** (`combo_controller.dart`, on first open when nothing is stored):
  - **Targets:** the distinct programmes on My colleges, up to 6.
  - **Subjects:** the student's sheet subjects (`DuSelection` from the sheet, as Compass seeds).
  - **Papers:** 5.
  - Each prefilled step shows its source tag ("From your colleges").
- **Mode A, step mode** (a step is missing):
  - The steps show in order, as today: targets chips and search, then subjects, then papers.
  - The missing step is expanded and the set steps are summary rows.
  - The results heading is hidden until the plan exists. Today the page shows "Your best combinations" with "Tick a few subjects…" and a long empty tail.
- **Mode B, result mode** (all three set):

```
┌──────────────────────────────────────────────┐
│ <  Combo planner                             │
│ [■ Targets][■ Subjects][■ Papers]            │  progress header (pinned)
│ All set. Tap a step to change it.            │
│                                              │
│ Your best combination              [Mobi]    │  Mobi 56 dp reaction (existing _Reaction)
│ These subjects open both of your targets.    │  ComboWords.reaction (existing)
│ ┌──────────────────────────────────────────┐ │
│ │ ● Best fit                     5 papers  │ │  ComboCard (existing)
│ │ 1 English  2 Accountancy  3 Business St. │ │
│ │ 4 Mathematics  5 General Aptitude Test   │ │
│ │ Your targets 2 of 2   All DU 48 of 73    │ │
│ │ ✓ Meets every target's subject rules.    │ │
│ │ [     See the courses and cutoffs      ] │ │  primary
│ └──────────────────────────────────────────┘ │
│ Keep these                                   │  new: reasons, one line each
│ Mathematics: without it, B.Com. (Hons.)      │
│ closes and 7 fewer DU programmes open.       │
│ English: without it, no programme opens:     │
│ every one needs a language.                  │
│ Other options (2)                         v  │  folded; opens Option 2, 3
│                                              │
│ Targets   B.Com. (Hons.), B.A. (Hons.) Eco.  │  summary rows, each 56 dp, Edit >
│           From your colleges          Edit > │
│ Subjects  6: English, Accountancy, Bu… Edit >│
│ Papers    5                           Edit > │
│ DU data: 2026 admission rounds and the UG    │
│ Bulletin 2026-27.                            │
└──────────────────────────────────────────────┘
```

**Summary rows:**
- **Edit Targets** opens a sheet with today's targets UI (quick chips plus search with matcher 2.2, limit 6).
- **Edit Subjects** opens the existing subject picker.
- **Edit Papers** opens a small sheet with the existing 3/4/5 `MmSegmented` and `PaperBubbles`.

Editing re-runs the plan. While it runs, the existing `_Checking` Mobi `loading` takes the result's place after 400 ms (existing), so Mobi stays one per screen.

**Keep reasons** (new pure `duKeepReasons(plan, catalog, selection)` in `domain/du_combos.dart`). For each subject in `result.keep`, it re-runs the best plan with that subject removed from the pool:
- If a target is lost: `'$subject: without it, ${firstLostTarget} closes and $d fewer DU programmes open.'`
- If no target is lost: `'$subject: without it, $d fewer DU programmes open.'`
- If nothing opens: `'$subject: without it, no programme opens: every one needs a language.'` (the language case), or `'…no combination reaches your targets.'`

This replaces `ToolsCopy.keep` ("Do not drop: … Every combination … uses them."), which gave no reason (L27).

**No empty tail:** `ToolsPage` bottom padding is the bar height plus 24, with no fill sliver. The golden `combo_full_day.png` shows about 420 dp of blank page under the data line; the new goldens must end within 24 dp of the data line plus the bar.

**States** (existing, kept): loading (`ToolsLoading`), error (`ToolsLoadFailed`), checking (Mobi), plan error (`InlineBanner`), target and pool limits (shake).

### 8.2 Motion

| Motion | Spec | Answers |
|---|---|---|
| Progress segment fill | 300 ms `glide` | A step got its value |
| Mode A to mode B | The steps collapse into summary rows (`SizeTransition` 300 ms) as the result card rises (existing `ComboReveal`) | The answer arrived; the inputs step aside |
| Keep reasons | Fade in 200 ms after the card, stagger 45 ms | Why these subjects matter |
| Reduced motion | Cross-fades | |

**Mobi:** existing, one at a time: `_Checking` (`loading`) while checking, `_Reaction` (`cheer`, `nudge` or `encourage`, from the real result) once a plan lands.

---

## 9. Screen G: Onboarding Aim step (course and colleges), L30 and L28

**Owner of the build:** the Onboarding area, using the Colleges area's `AimLadder` and matcher through their public exports (IA section 10).

**Job:** "Where do you want to get?", in under 20 seconds, and skippable.

**Primary action:** **Continue** (pinned).

### 9.1 Wireframe (ladder state, 390 dp)

```
┌──────────────────────────────────────────────┐
│ <   [Mobi]                                   │  guide bar (existing), Mobi says the arrive line
│ ●  ◉  ○  ○  ○  ○  ○                  2 of 7  │  truthful bubbles (existing)
│ Which colleges would you say yes to          │
│ tomorrow?                                    │
│ Lowest Round 1 score in 2026, out of 1000.   │  support (new copy)
│ (B.Com (Hons) ✎) (Showing unreserved v)      │  existing chips
│ ┌──────────────────────────────────────────┐ │
│ │ ⌕  Find a college                        │ │  NEW: matcher 2.2 filters the ladder
│ └──────────────────────────────────────────┘ │
│ 2 of 8 picked · first 3 show on Today        │  NEW count line
│ ●1 Shri Ram College of Commerce       924.3  │  AimLadder
│    On Today                                  │
│ ●2 Hindu College                      919.9  │
│    On Today                                  │
│ ○  Lady Shri Ram College for Women    912.5  │
│ ○  Hansraj College                    907.5  │
│ ○  Kirori Mal College                 903.7  │
│    Show all 55                               │  must clear the pinned key (9.3)
│ (Any college is fine)                        │
│ SRCC needed 924.3 of 1000 in Round 1, 2026.  │  engraved line (existing)
│ That's about 231 of 250 a paper.             │
│ ┌──────────────────────────────────────────┐ │
│ │               Continue                   │ │  pinned
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 9.2 Changes

- **Limit:**
  - `AnswersController.toggleCollege` limit goes from 3 to **8** (`MyColleges.maxColleges`).
  - `OnboardingAnswers.fromJson` changes `take(3)` to `take(8)`.
  - The deck version goes from 1 to **2** (IA section 9).
  - The ladder is `AimLadder` (2.4), with "On Today" on picks 1 to 3.
- **Search:** "Find a college" (matcher 2.2) filters the ladder. The field is not autofocused.
- **Copy:**

  | Item | Old | New |
  |---|---|---|
  | `ladderSupport` | "Round 1 minimum, 2026, out of 1000. Pick up to three." | "Lowest Round 1 score in 2026, out of 1000." |
  | `threeIsPlenty` | "Three is plenty. Drop one to swap it." | Replaced by "8 is the most. Drop one to add another." |
  | `notSureNote` | "Fine. The plan works without it." (filler) | "You can pick one later in Colleges." |
  | `savedWhat` | "…Course and colleges stay on this phone for now." | "Subjects, study days, your course and colleges are on your account." It shows only after the server confirms the colleges move (`_migrate` result), per R17 and T002. If the move fails: "Subjects and study days are on your account. Your colleges are still on this phone; they move when you're back online." |

- **Carry-over through sign-in** (T004, R16):
  - The picks are written to the server list by the existing `_migrate` path (`my_colleges_actions.dart` `_legacy`), with no change to the mapping (`course.offeringAt(name)`, then `MyCollege(programmeId: course.id, …)`).
  - The `movedKey` guard stays. A new account has no key yet, so its picks move.
- **Existing accounts** never see onboarding. They get the same `AimLadder` through the Colleges empty state and the chooser (3.5, 4.3), as IA D6 says.

### 9.3 Onboarding polish (L28), across all steps

These are the deltas only; the flow, order and look stay, because the owner called them "fine" (keep list).

1. **Ladder clipped by the key.** In `course_ladder_night.png`, "Show all 55" sits under the pinned Continue's fade. `StepLayout` must pad the scroll body's bottom by the pinned key's height plus `MmSpace.s24`, so the last control is fully visible when scrolled to the end. Check this on every step with a pinned key (stage, course, subjects, rhythm, plan).
2. **No filler or defensive lines.** Remove `notSureNote`'s "Fine…". Keep `stageSupport` "No dates to type. We work them out." (it tells the student what happens). Keep `categoryNote` "It only changes which figures you see." (it answers a worry and is not a disclaimer). A unit test greps `onboarding/copy.dart` and `tools/copy.dart` for these banned phrases: "not affiliated", "not a prediction", "CSAS dashboard", "stay on this phone for now", "ad or analytics companies", "Fine.".
3. **Welcome:** Mobi `hello`; no stock or AI picture (verify only).
4. **Truthful bubbles:** a skipped step's bubble shows as a ring with a dash, not filled. This is existing behaviour; the acceptance below re-checks it.
5. **Mobi on the Aim step** (guide bar, existing single Mobi): arrival line "Now, where you want to get." (existing). On the first pick, `nod`. On a refused pick (the 9th), `tilt`. There is no other act.

### 9.4 Motion

| Motion | Spec |
|---|---|
| Course grid to ladder | Existing `AnimatedSwitcher`, 300 ms `glide` |
| Pick | The bubble inks volt and the number scales 0.6 to 1 (240 ms spring). The engraved line re-engraves (existing `EngravedText`). |
| Filtering | Rows that do not match collapse in 200 ms, with no stagger, so typing stays smooth on 2 GB phones |
| Reduced motion | Fades only |

---

## 10. Mobi and motion across this area (L34 to L37)

### 10.1 Mobi map

| Screen | Mobi | Act and trigger |
|---|---|---|
| Colleges tab | 1, 48 dp | 3.4 |
| My colleges sheet | 0 | Sits over a screen that has one |
| Estimate and Check a score sheet | 0 | The ring is the moment |
| Compass | 0 | The brass compass is the hero object |
| Programme page | 1, 40 dp, only with an estimate | 7.1 |
| Combo | 1 at a time | `loading` while checking; `cheer`, `nudge` or `encourage` on the result |
| CUET 2027 guide | Unchanged | Not in scope |
| Onboarding Aim | 1 (guide bar) | Arrival line, `nod` on first pick, `tilt` on a refused pick |

**Test:** extend `test/unit/mascot/mobi_moments_one_per_screen_test.dart` (owned by Mobi and motion; requested in section 11) with `colleges_root`, `colleges_empty`, `programme_with_estimate` and `combo_result`, each asserting at most one `Mobi` widget.

### 10.2 Motion rules for this area (L34)

- Every motion above answers a state change: add, remove, reorder, estimate change, fold, or arrival. Nothing loops, and nothing animates while the student types except the result count.
- Durations come only from `Motion.*` tokens: 100 press, 140 release, 200 ui, 240 card, 300 glide, 360 enter, 420 sheet, 500 number roll. Curves come only from `glide`, `out`, `exit`, `emphasized` and `drawer`.
- Budget phones: no `BackdropFilter` is added (sheets keep the existing glass tier), lists are `ListView.builder`, and `RankedReveal` is capped at 6 rows.
- On the 2 GB emulator, `dumpsys gfxinfo` shows under 5% janky frames across the acceptance run.
- With reduced motion, every screen is fully usable, numbers still update, and Mobi shows still poses.

### 10.3 Spacing and parity (L36)

- Gutter `MmSpace.gutter`. Between sections `MmRhythm.section`; between a heading and its group `MmRhythm.item`; between groups `MmRhythm.group`.
- Rows: 56 to 72 dp. No nested cards: only the Compass card and the combo cards are raised, and rows sit in `ToolsPanel`s (R33).
- Night and Day goldens exist for every new state (section 12).

### 10.4 Subject art (L37)

Subject art appears on these screens only in Compass's "Practise these subjects" and the Combo subject list (as names, no art). `SubjectEmblem` at 40 dp must show the subject's own object, or its initials when it has none.

---

## 11. Requests to other areas (built by their owners)

| Area | Request |
|---|---|
| **Shell** | (1) Register `/colleges` (branch 3) → `collegesScreen` and `/colleges/cutoff` → `collegesCutoffScreen` (an `MmSheetPage` titled "Check a score"); `/tools` redirects to `/colleges`. (2) Add `MmSheetScaffold`/`showMmSheet` `pinned:` and `resizeForKeyboard:` (4.2). (3) `ActionRouter`: `/cuet-cutoff-calculator` (with `?score=`) maps to `/colleges/cutoff`. (4) Add `/tools/compass/:groupId?college=` to the route templates. |
| **Today** | The colleges card uses `CollegeRung` (verdict line included) and `estimateProvider`; "Choose colleges" calls `showMyCollegesSheet(context)`; "Open Compass" pushes `/tools/compass?from=today`; "See all in Colleges" calls `goBranch(3)`; remove `ToolsQuietLink`. |
| **Practice** | The More row "Admission Compass" pushes `/tools/compass?from=practice` (not `/tools`). |
| **You** | The Aim row ("Aim: B.Com. (Hons.), 3 colleges") calls `goBranch(3)`; remove `ToolsShelf` from the hub. |
| **Mobi and motion** | Add the four screens in 10.1 to the one-Mobi test. |
| **Onboarding** | Section 9 (files listed in 12). |

---

## 12. Acceptance on the emulator (per ledger item)

**Setup:** follow the ledger's "Test setup": `mockmob_budget`, 2 GB RAM, accounts A and B, Night and Day, 360x800 and 412x915, and once at 1.3x font. Take a screenshot at the end of each check.

**L22: tools are not hidden.**
1. Cold start A, then the bar's Colleges: the Colleges tab shows My colleges and the Compass card. That is **1 tap**.
2. Tap Open Compass: Compass opens. That is **2 taps**.
3. Back returns to Colleges at the same scroll position.
4. Cold start again: Today's colleges card, "Open Compass", gives Compass in 2 taps, and Back returns to Today.
5. Practice, More, Admission Compass: Compass, and Back returns to Practice.
6. From Colleges, each of Check a score, Combo planner and CUET 2027 guide is 2 taps from a cold start.
7. Account B, Today: Compass is named on the colleges card.

**L23: Compass hierarchy.**
1. A, Compass: the first screen at 360x800 shows the count "N of 73", one subject chip rail, the category rail and the volt key "Open B.Com. (Hons.) colleges". There is no score field and no "Add your expected score".
2. Scroll: "Your best options" (3 rows, each with a cutoff bar and the volt estimate band), then "Where you stand", then the unlocks.
3. "All 35 open to you": Commerce & Economics is open, and the other streams are single rows with a count and "top N".
4. Type "bcom" in search: the streams open to the matches only.
5. Tap B.Com. (Hons.): the programme page shows "Your estimate clears X of 55 colleges here".
6. On a college card, "Add to my colleges" becomes "In My colleges". The Colleges tab then lists it.
7. No two adjacent rows look identical: rows differ by figures, verdicts and folds.

**L24: search and keyboard.**
1. Colleges, Edit, Add a college, Change (programme list).
2. Type each of "bcom", "BCOM", "b.com", "B Com", "bcom hons": B.Com. (Hons.) is listed first and B.Com. second each time.
3. Type "eco": the Economics and Business Economics programmes show. Type "hansrj" in a B.Com. (Hons.) ladder: Hansraj College shows.
4. With the keyboard open at 360x800: the field and **at least 3 results** are visible above the keyboard.
5. Scroll the results with the keyboard still open: it works.
6. Close the keyboard: the list stays where it was, and the sheet grows back.
7. Add a college: the tick morph plays, and "N of 8" rises by 1.
8. Add up to 8, then try a 9th: the row shakes and the "8 is the most" line shows.

**L25: Choose and Start work.**
1. Account B, Today, "Choose colleges": a sheet opens within 100 ms (a screen recording frame check), on the programme list or on the onboarding course. It never opens the You tab or says "Could not load a suggestion".
2. Add 3: Today's ladder shows them in order with their figures.
3. Reopen: the 3 are ticked.
4. Airplane mode, then add: "You are offline, so that change was not saved." shows and the row reverts.
5. Add one from a Compass programme page: it shows on Today and on Colleges.
6. Every key in the sheet gives press feedback within 100 ms.

**L26: never ask for a score the student doesn't have.**
1. Account B, Compass: useful with no score (the count, best options, streams). "Where you stand" says "Your full mocks will show here against each college." No field is shown and the keyboard does not open.
2. Search the screen text: no "CSAS dashboard" and no "Your CUET score".
3. Account A, Compass: "Where you stand" shows "588 to 640 of 1000, From your latest full mocks" (real values from A's mocks).
4. Change: the estimate sheet with "From your latest full mocks" selected and the 4 papers listed out of 250.
5. Choose "Type your own" and enter 600 to 650: the ring updates live. Done: the bars and verdicts update across Compass, the programme page and Colleges.
6. Kill and reopen: the typed estimate is kept until a newer mock lands.
7. The category is the inline rail near the top.

**L27: Combo clear.**
1. Account A with colleges: Combo opens in result mode, with the progress header full and "From your colleges" on Targets.
2. The best combination card is the first thing below the header.
3. "Keep these" lines each give a reason with real counts.
4. Account B: step mode with Targets expanded and the header at "Step 1 of 3". Pick a target, then subjects: the result arrives and the steps fold into summary rows.
5. At 360x800 no empty band appears below the data line.

**L28: onboarding polish.**
1. Fresh install: welcome with Mobi greeting and no picture.
2. Walk every step: each skippable step skips; no disclaimer line anywhere; the banned-phrase test passes.
3. On every step, scroll to the end: the last control is fully above the pinned key.
4. The plan ends sealed, then the first move.

**L30: colleges in onboarding.**
1. Fresh install, then the course step: B.Com. (Hons.), then pick 4 colleges (the 4th has no "On Today" tag) and type "hans" to find Hansraj.
2. Finish and sign in as B: "Saved to your account." lists course and colleges.
3. Open Colleges: the 4 colleges in the same order. Today: the first 3.
4. Skip the step instead: Colleges shows the empty state with "Choose your colleges".
5. Account A with no colleges: the Colleges empty state shows the same ladder component when a course chip is tapped.

**L34 to L37 on these screens.**
1. Record 60 s (`adb shell screenrecord`): open Colleges, add and remove a college, open Compass, open a stream fold, change the category, open the estimate sheet and type a range, open Combo.
2. No snaps or blank frames; janky frames under 5%.
3. "Remove animations" on: everything is usable and the numbers update.
4. Mobi: Colleges shows one (or none when there is no estimate and the list is not empty); Compass none; the sheets none; the programme page one with an estimate.
5. Night and Day: the same gutters, and no low-contrast verdict text in Day.

**Goldens** (`test/golden/tools/`, Night and Day, 360 and 412):
- `colleges_full`, `colleges_empty`, `colleges_loading`, `colleges_error`, `colleges_offline`, `colleges_no_estimate`
- `chooser_programmes_query_bcom`, `chooser_course_ladder`, `chooser_keyboard_open` (with a simulated `viewInsets.bottom = 300`)
- `my_colleges_list_edit`
- `estimate_sheet_mocks`, `estimate_sheet_typed`, `estimate_sheet_partial`, `check_score_sheet`
- `compass_full` (re-baselined), `compass_no_estimate`, `compass_stream_folded`
- `programme_bcom_estimate`
- `combo_result_mode`, `combo_step_mode`
- `onboarding/course_ladder_search`, `onboarding/course_ladder_eight`
- each also at 1.3x text for `colleges_full`, `chooser_keyboard_open` and `compass_full`

**Unit tests** (`test/unit/tools/`): `college_search_test`, `estimate_verdict_test`, `du_mock_range_test`, `combo_keep_reasons_test`, `estimate_store_migration_test` (`scoreText` becomes a typed point), `banned_copy_test`.

---

## 13. Owner sign-off questions

1. **The estimate's default source is your latest full mocks**, as raw marks out of 1000, shown as a range across the last 3 mocks per paper. Is a range from mocks the right thing to set against cutoffs, rather than a single number?
2. **Combo prefills its targets from My colleges.** Is that right, or should Combo always start empty?
3. **Onboarding's limit rises from 3 to 8 colleges**, to match My colleges, with the first 3 marked "On Today". Is it OK for onboarding to take more than three?

## 14. Files to change

**Colleges area** (`flutter_app/lib/features/tools/`):
- New:
  - `colleges/colleges_screen.dart`, `colleges/colleges_copy.dart`, `colleges/college_rung.dart`, `colleges/compass_card.dart`
  - `estimate/estimate.dart`, `estimate/estimate_providers.dart`, `estimate/estimate_bar.dart`, `estimate/estimate_sheet.dart`
  - `my_colleges/college_search.dart`, `my_colleges/aim_ladder.dart`, `my_colleges/chooser_sheet_layout.dart`
  - `compass/stream_fold.dart`, `combo/combo_progress.dart`
- Changed:
  - `my_colleges/my_colleges_sheet.dart` (rewrite: modes, keyboard layout, matcher, ladder)
  - `my_colleges/my_colleges_body.dart` (drag reorder, remove with Undo, On Today divider)
  - `my_colleges/my_colleges_copy.dart`
  - `my_colleges/my_colleges_parts.dart` (`MyCollegesSection` becomes one row; `AddToMyCollegesKey` tick morph)
  - `compass/compass_screen.dart` (order, first move, category rail, stream folds, matcher, estimate)
  - `compass/compass_hero.dart` (one chip rail)
  - `compass/compass_controller.dart` (estimate in place of `scoreText`; `couldClear` on `estimate.high`)
  - `compass/category_score.dart` (retired; its chips move to a `CategoryRail` widget in `estimate/estimate_bar.dart`)
  - `compass/score_sources.dart` (retired)
  - `compass/cutoff_bar.dart` (estimate band)
  - `compass/programme_rows.dart` (clears of colleges)
  - `compass/programme_screen.dart` (Where you stand, Mobi, category rail, `?college=`)
  - `compass/cutoff_table.dart` (verdict line, matcher, default sort)
  - `combo/combo_screen.dart` (modes, summary rows, no tail), `combo/combo_controller.dart` (prefill), `combo/combo_results.dart` (keep reasons)
  - `domain/du_combos.dart` (`duKeepReasons`), `domain/du_mock_score.dart` (`duMockRange`, partial)
  - `data/tools_store.dart` (estimate storage and migration)
  - `copy.dart` (remove CSAS and score lines; Round 1 numerals; new data line; keep reasons)
  - `widgets/tools_page.dart` (`ToolsSearchField`: `focusNode`, `autofocus`)
  - `tools_routes.dart` (`collegesScreen`, `collegesCutoffScreen`, exports `CollegeRung`, `AimLadder`, `showMyCollegesSheet`, `estimateProvider`)
  - `tools_paths.dart` (colleges paths, header comment, `webAliases`)
  - `hub/tools_hub_screen.dart`, `hub/tools_shelf.dart` (retired once Shell, Today and You land)

**Onboarding area** (`flutter_app/lib/features/onboarding/`):
- `steps/course_step.dart` (search, count line, `AimLadder`)
- `widgets/college_ladder.dart` (becomes an adapter to `AimLadder`)
- `model/answers.dart` (8 colleges)
- `state/answers_controller.dart` (limit 8)
- `model/deck.dart` (version 2)
- `copy.dart` (9.2 lines)
- `screens/after_sign_in_sheet.dart` (saved line after server confirm)
- `widgets/step_layout.dart` (bottom padding under the pinned key)

**Other areas** (section 11): `core/widgets/mm_sheet.dart`, `core/router/{router,routes,action_router}.dart`, `features/today/**` (colleges card), `features/practice/widgets/more_rows.dart`, `features/you/you_hub_screen.dart`, `test/unit/mascot/mobi_moments_one_per_screen_test.dart`.

**Tests:** `test/unit/tools/*` (section 12) and `test/golden/tools/*`, `test/golden/onboarding/course_ladder_*`.

**Nothing here was built or checked on a device.** Before the done check, the area critic runs the 12-part anti-slop test and the 0/1/2 rubric on each changed screen, and records a `DESIGN_DECISIONS` note in the PR with the evidence IDs above (R39, R40).
