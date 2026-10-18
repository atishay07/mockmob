# Swipe v2: the "Suggested for you" deck that teaches itself (D90, refines D51)

**Status:** this is a design spec and a mock-up. No app code was changed and nothing is committed. It refines the approved D51 stack (TODAY-SWIPE-1018.md); it does not rebuild it. It ships in v15.2, after the build and an Opus taste critic.

**His words, 18 Oct, 7:40 pm:**
- D90: "there were some issues with the swipe left and right thing ... take UI experience inspiration from apps like Tinder ... When a first-time user is entering, it won't know what cards actually do or what swipe left and swipe right mean, so you have to build the entire process into this."
- D89: every check is also a taste check, with actionable feedback.

**Mock files:** `tmp/design-1018/swipe-v2/`
- `swipe.html?state=f1..f7|returning|end|loading|offline&theme=night|day`
- `cap.mjs` and `board.mjs`: headless playwright-core, own temp profile, 390 x 844 at 2x.
- The tokens are copied from `flutter_app/lib/core/theme` (mm_colors, mm_type, the 24 dp panel radius), with the real art (`obj-*`, Mobi poses) and the bundled Bricolage and Hanken fonts. The data is illustrative, and every frame says so.

---

## 1. What is wrong with the build now (wt-v15-1 01dd7770, walk 1 captures in `tmp/app-walk-1018f/round1`)

| # | What a student sees | Capture | Why it fails him |
|---|---|---|---|
| W1 | A first-timer gets a card with no cue. The only teaching is a grey caption under the dots, "Swipe right to do it instead, left to skip", shown on two visits. Nothing ever *shows* the gesture. | 06-stack | Taste #4 ("it won't know what cards actually do") |
| W2 | "Do this instead" only makes sense if you remember the lead card, which is off screen above. The up arrow reads as "scroll up". | 06, 08b | It is two labels for one action ("Do this instead" on the button, the stamp, the semantics), and neither says what happens |
| W3 | Every card carries its own Skip and Do-this-instead row, so 44 dp of each card is buttons, and the buttons fly away with the card | 06, 08b | Unlike Tinder, the controls do not stay put, so they cannot mirror the drag |
| W4 | After a skip, a dead band about 120 dp tall sits between the dots and This week. The hint's held slot stays empty for the rest of the pass. | 08b | Slop list: dead bands |
| W5 | Two indicators say the same thing: "2 more after this" above the deck and page dots below it | 06 | Taste #7: one indicator, not two |
| W6 | Right swipe: the page jumps up to the lead card with no word about what happened, and there is no way back except finding the old move in the deck | 07a, 07b | No undo; the result is never confirmed |
| W7 | The end card says "That was all three for tonight" at any hour, and its links wrap as "Go through them again  or / see every way to practise" | 10 | Untrue in the morning; a dangling "or" |
| W8 | The cost line wraps to two lines ("Accountancy, 1 AI credit each, / about 10 min"), and a repair line reads "All two are from Quick 10" | 08b | Copy bug in `copy.dart:98`: n == 2 must read "Both are from" |
| W9 | The deck learns nothing. A card skipped every day comes back in the same place. | `suggested_deck.dart` DeckPass | D90 asks for a deck that adapts, like taste-learning apps |

## 2. What the best swipe products do, and what we take

The notes below are I-type (interpretation from using the products). No user-behaviour numbers are claimed.

| Product | What it does | Take / leave |
|---|---|---|
| **Tinder** | One card on a visible stack. LIKE and NOPE stamps fade in at the card's top corners in proportion to the drag. Round X and heart buttons sit *under* the stack and grow as you drag toward them. Rewind undoes the last swipe. The first run coaches the gesture on the first card. | **Take:** controls outside the card that mirror the drag; stamps tied to the drag; undo; first-run coaching. **Leave:** the dating meaning, and icon-only buttons (the owner rejects icon-only controls). |
| **Bumble** | Same mechanics; its first-time cards explain left and right in words before the real deck | **Take:** say each direction's meaning in plain words, once |
| **Hinge** | No swipe: an explicit X, and a like on one item | **Take:** buttons are a first-class path. Every swipe has a button that does exactly the same thing. |
| **Quizlet flashcards** | Swipe right "Know", left "Still learning"; a count on each side; the card tints while dragged; undo; an end summary with "Keep reviewing" | **Take:** the labels sit on the side they map to; the end offers "go again" |
| **Duolingo** | Never an ambiguous gesture; every action answers at once | **Take:** after every commit, say what happened (the confirmation bar) |
| **Headway / Blinkist** | Card stacks with a visible count of what is left | **Take:** one count of what is left, in the heading |
| **Taste onboarding** (Spotify and Apple Music artist picks, Google News "fewer stories like this") | Says what it will learn, keeps every choice reversible, and uses "fewer like this", never "never" | **Take:** "Not now" (never "never"); the deck sinks what you pass on, says so once, and nothing is hidden for good |
| **iOS Mail / Gmail** | Swipe a row and the action's label appears on the side you uncovered; "Archived. Undo" | **Take:** the undo bar after the one consequential action |

## 3. The design in one paragraph

The deck stays where D51 put it, under the lead card, with one card on top and two peeking. Each card now holds only what it is: its cost, its title, its evidence and its art, with the evidence line pinned to the foot. **The controls leave the card** and sit in one fixed row under the deck: **Not now** on the left, **Undo** in the middle, **Up next** on the right. As the card is dragged, the button on that side grows and lights, and a stamp with the same words lands on the card. On the first visit only:
- a one-line intro says what the cards are;
- the top card performs the gesture by itself, right and then left, with each stamp, button and coach line lit in turn;
- the student's first right swipe ends with a glass confirmation bar and Undo;
- the first left swipe says where the card went and what the deck will learn.

After that, the deck is just a deck.

### Changes from approved D51 (refine, not rebuild)

| D51 as built | v2 | Why |
|---|---|---|
| Skip and Do-this-instead buttons inside every card | One fixed row under the deck: Not now, Undo, Up next | The controls mirror the drag; each card gains 44 dp for evidence and art; the buttons do not fly away |
| "Do this instead" and "Skip" | **"Up next"** and **"Not now"** on the stamp, the button, the coach and the semantics | One label per action (taste #10). "Up next" is the lead card's own overline, so the word tells you where the card goes. "Not now" is what left truly means: the card is not gone. |
| A caption hint on two visits | A first run with an intro line, a demo by the card itself, coach lines, the let-go lines, and a confirmation after the first commit of each kind | Taste #4: a gesture is shown and coached the first time |
| Page dots plus a count | The count only | Taste #7, W5 |
| The hint's slot held empty for the pass | The coach line exists only on the first run; at rest, the row sits 12 dp under the peeks | W4 |
| No undo | Undo for the last swipe, in the row and in the confirmation bar | Tinder's rewind; a slip costs nothing |
| A skipped card flies off screen | A skipped card is seen tucking in behind the deck | "It waits at the back" is then literally visible |
| The deck never learns | Kinds you pass on often sit lower next time (section 6) | D90: decks that adapt |

**Kept exactly:**
- Right never starts a session and never spends a credit. The lead card's lime key starts it. This is the safeguard he approved.
- The 12 dp lock and the 0.5 slope against vertical scroll.
- A threshold of 30% of the width, or a fling.
- The x/20 lean.
- A card whose only action starts a session cannot be swiped right; its Up next button is the path.
- The end card with Mobi thinking.
- The skeleton.

## 4. What each direction means, in MockMob words

| | Right | Left |
|---|---|---|
| Name everywhere | **Up next** | **Not now** |
| What happens | The card moves into the lead card above and becomes today's lead ("Up next, your pick"). The old lead comes down into the deck marked "Suggested". | The card goes to the back of this pass. It is not deleted. "Go through them again" brings every card back. |
| What never happens | Nothing starts. No credit is spent. No paper opens. | Nothing is hidden for good. No "never show this". |
| Undo | Puts the old lead back and returns the card to the top of the deck | Brings the card back to the top |
| Tap on the card | The same as Up next (as D51) | |

## 5. The first run, step by step (frames `fr1` to `fr7`)

**"First run" means:** the first time the deck is at least 60% on screen, persisted in `today_deck_coach`. The coaching ends for good once the student has done both directions once, or after 3 visits, whichever comes first.

1. **Arrive (`fr1`).**
   - The heading reads "Suggested for you", and the count reads "4 cards".
   - Under the heading is one line, first run only: **"More ways to win back marks today, one card at a time."** It answers "what are these cards".
   - The coach line above the row reads **"Drag the card, or tap a button."**
   - Undo shows at 38% (disabled), holding its place so the row never shifts.
2. **The demo shows right (`fr2`).**
   - **When:** 600 ms after the deck is 60% visible and the page has been still for 300 ms.
   - **The card:** it glides 72 dp right with a 3.6° lean. "Up next" lands on it, top left. Its words dim to 0.6.
   - **The row:** the Up next button grows to 1.06 and lights.
   - **The coach line:** a right chip, then **"Right puts it up next, in the card above."**
   - **Haptics:** none, because the student did not act.
3. **The demo shows left (`fr3`).**
   - The card goes home, then 72 dp left, with the "Not now" stamp top right.
   - The Not now button lights.
   - The coach line: a left chip, then **"Left is not now. It waits at the back."**
   - The card goes home again. The coach returns to **"Drag the card, or tap a button."**
   - The whole demo takes about 2.2 s and runs once in the phone's life. Any touch stops it at once, and the card springs home.
4. **Your drag, right (`fr4`).**
   - The card follows the finger 1:1. The stamp grows with the drag. The words under it dim from 1 to 0.4 at the threshold. The Up next button grows with the drag.
   - At the threshold the card's edge turns accent (1.5 dp), a selection tick fires, and the coach line reads **"Let go: it goes up next"**.
5. **Let go, up next (`fr5`).**
   - The card flies up into the lead card. The page follows it, so the student sees where it went.
   - The lead card cross-fades to the new move, overline **"Up next, your pick, Accountancy"**.
   - A glass bar rises above the dock. It shows the card's object, **the card's title**, the line **"Up next, in the card above. Nothing starts until you tap Start."** (first time; afterwards **"Up next, in the card above."**) and **Undo**.
   - It holds for 5 s, pauses while touched, and leaves on the next action or scroll.
6. **Or your drag, left (`fr6`).** Like step 4, mirrored. The coach line reads **"Let go: it waits at the back"**.
7. **Let go, not now (`fr7`).**
   - The card slides out left and tucks in behind the deck. The next card is already on top.
   - The count reads "2 more after this". Undo lights.
   - First time only, the coach line reads: **"At the back now. / Cards you often pass on sit lower next time."** This line ships only with section 6 built.

**Why no separate intro card:** a tutorial card on top of the deck was considered. It delays the first real move. Its right swipe would also have to show "Up next" while making nothing up next, which is a stamp that lies. The real first card teaches better, because the student's first commit has a real, undoable result.

## 6. How the deck learns (truthfully: only what the code will do)

**New, small and local:** `DeckMemory` in `logic/suggested_deck.dart`, persisted through `PrefsStore` under the key `today_deck_memory`.

**What it stores:** for each card kind (`MoveChoice.key`, for example `weakest`, `revise`, `repair`, `mock`, `other:<subjectId>`), the IST days in the last 7 on which that kind was passed on (at most one per day) and the last day it was picked.

**The rule when building the deck:**
- The recommended move (the "Suggested" card) stays first. A kind passed on on **2 or more of the last 7 days**, and not picked since, **sinks to the end of the deck**. Sunk kinds keep their own order among themselves.
- Nothing is removed. The deck keeps its 4 cards, and sinking never pulls in a 5th.
- Picking a kind (Up next) clears its passes.
- **"Go through them again"** uses the order the pass started with.
- The memory is local to the phone. Nothing goes to the server.

**What we say:** only "Cards you often pass on sit lower next time", once, on the first left swipe. No "Mobi is learning your taste", no "personalised" badge (research rule: say personalised only where the logic truly is).

**Tests:**
- 2 passes on separate days sink a kind.
- 2 passes on one day do not.
- A pick clears the passes.
- After 7 days the kind returns to its place.
- The recommended card never moves.
- The deck size is unchanged.

## 7. Motion (values for the build; the app's Motion and Springs tokens)

| Moment | Value |
|---|---|
| Drag | 1:1. Lean x/20 degrees, clamped to ±12°. Lift −0.04·abs(x). Lock at 12 dp, slope 0.5 (unchanged) |
| Threshold | 30% of the deck width (107 dp at 358), or a fling of at least 700 dp/s toward an allowed side (`MmDragPolicy.commitVelocity`) |
| Stamp | Opacity min(1, 1.6p), where p = abs(x)/threshold. Scale 1.08 to 1.0. Rotation −8° (Up next) or +8° (Not now). BricolageTitle 20/28, 2.5 dp edge, 10 dp radius |
| Card words while dragged | Opacity 1 − 0.6p |
| Card edge at the threshold | 1.5 dp accent (Up next) or ink3 (Not now). It appears the moment the threshold is crossed, with no fade |
| Row button mirror | Scale 1 + 0.06p on the side dragged toward. At the threshold: accent border and volt wash (14% over raised2 in Night, 30% over raised in Day) |
| Cards behind | Depth d − p (unchanged). Peeks 12 and 22 dp. Scale 1 − 0.05·depth. A card behind shows its words only when depth is under 0.6 |
| Home, below the threshold | `Springs.smooth` (360 ms, bounce 0.12), carrying the release velocity |
| Up next commit | The flight takes 340 ms on `Motion.inOut`, scaling to 0.62 and fading over the last 60%. The page scrolls with it over 420 ms on `Motion.inOut`, only when the lead card's top is off screen. The lead card cross-fades (`fadeThroughOut` 90 ms, then `fadeThroughIn` 210 ms) and settles from 0.985 with `Springs.release`. **No edge light on the lead card** (Night stays subtle; tried in the mock and dropped) |
| Not now commit | The card slides to x = −0.62·width (240 ms, `Motion.out`), then tucks to the back slot (translate 22 dp, scale 0.90, opacity 0.45) over 200 ms, swapping behind at the midpoint. The next card has already risen |
| Undo | The reverse of the last commit, 300 ms. Undoing Up next flies the card back down from the lead card |
| Demo wiggle | Out 72 dp in 380 ms (`Motion.out`), hold 360 ms, home on `Springs.smooth`, a 160 ms gap, then the same to the left. About 2.2 s in all. Cancelled by any pointer down |
| Coach line swap | `MmOverlapSwitcher.fade`, 200 ms |
| Confirmation bar | In: 240 ms (`Motion.card`), from +16 dp and opacity 0. Out: 180 ms (`leave`). Holds 5 s, paused while touched |
| End card | Cross-fade 200 ms; the deck's height is held (unchanged) |

## 8. Haptics (the app's haptic grammar in `core/haptics`)

| Moment | Verb |
|---|---|
| A drag picked up (after the lock) | `gestureStart` (Android 11+, else nothing) |
| The threshold crossed, either way and back | `selection` (tick) |
| Up next committed | `light` (settle): a primary commit |
| Not now committed | `gestureEnd` only (it is a small action) |
| A button pressed | `selection` (MmPressable, as now) |
| Undo | `selection` |
| The demo wiggle, the confirmation bar, the end card | None: the student did not act |

## 9. Reduced motion

- **No demo wiggle.** The first-run coach line instead shows both meanings at once, as two lines with their chips: "Right puts it up next, in the card above." and "Left is not now. It waits at the back."
- The card still follows the finger, because that motion is the student's own. Stamps and button mirroring still track the drag.
- Commits swap at once with a 120 ms fade (`reducedFade`). The page jumps to the lead card with no animated scroll, and the confirmation bar fades in.
- Undo swaps at once.

## 10. Accessibility

- **The row is the path.** Each button is 48 dp tall, and the three are in focus order: card, Not now, Undo, Up next.
- **Card semantics:** "Card 1 of 4. Practise your weakest chapter. Accountancy, 10 questions. Partnership fundamentals: 15 of 63 missed, 75 marks open." The card also carries two custom actions, **"Up next"** and **"Not now"**, so TalkBack users can act from the card.
- **Button semantics:**
  - "Not now: Practise your weakest chapter. It waits at the back."
  - "Up next: Practise your weakest chapter. It moves into the card above. Nothing starts until you tap Start."
  - "Undo: brings back Practise your weakest chapter." Disabled: "Undo, nothing to undo yet."
- **Announcements after a commit** (`SemanticsService.announce`):
  - "Practise your weakest chapter is up next, in the card above."
  - "Not now. 2 more after this."
- The confirmation bar is a live region. Its Undo is focusable for its 5 s, and the timer pauses while it has focus.
- **Contrast:** stamps sit on an opaque raised fill; the Day accent uses accentText #526700.
- **At 1.3x text on a 360 dp phone:** the row keeps Not now and Up next. Undo shows its icon only, with the "Undo" label kept in semantics, so the row never wraps.
- Nothing depends on haptics or colour alone: every state change also has words.

## 11. Every state

| State | What shows | Frame |
|---|---|---|
| First visit | The intro line, the demo, coach lines, the confirmations (section 5) | fr1 to fr7 |
| Returning, at rest | Heading and count; the card; the row with Undo disabled; no coach line | st-returning |
| Returning, swipe never used (visits 2 and 3) | The same, plus one 24 dp nudge of the top card, right only, once per visit, with no words. Never after the first swipe | (described) |
| Mid-pass after a swipe | Count "N more after this"; Undo lit for the last action | fr7 |
| All passed on (end of pass) | The dashed end card: Mobi thinking, **"That's all four for today"**, **"The card above is still our pick for you."** (or **"Your pick is ready in the card above."** when the lead is the student's pick), and a link **"See every way to practise"**. The row becomes **Undo** and **Go through them again** | st-end |
| No alternatives (0 cards) | The block is replaced by the single link "See every way to practise" (as now) | (as built) |
| One card | No peeks; the count reads "Last of 1" | (as built) |
| Loading | The skeleton holds the heading, the card with its two peek bands, and the row, at their landed heights. Bars show only after 400 ms (as now) | st-loading |
| Offline | The deck works unchanged: picks, passes, undo and the bar are all local. Today shows its existing saved-copy line ("Not refreshed. Last loaded 5:48 PM."). Starting the lead follows the key's existing offline rules | st-offline |
| A pick while the lead card is in view | No scroll; the flight lands straight in it | (described) |
| A card that can only start a session | Its right drag resists (×0.35) and never stamps; its Up next button runs its action (as built) | (as built) |

## 12. Exact copy (`copy_suggested.dart`)

All copy is sentence case. No arrows in text, no middle dots, no exclamation marks, and every count says what it counts.

| Key | String |
|---|---|
| title | Suggested for you |
| countFirst(n) | {n} cards |
| moreAfter(more, of) | {more} more after this / Last of {of} (unchanged) |
| noneLeft | None left (unchanged) |
| intro (first run) | More ways to win back marks today, one card at a time. |
| coachIdle | Drag the card, or tap a button. |
| coachRight | Right puts it up next, in the card above. |
| coachLeft | Left is not now. It waits at the back. |
| letGoRight | Let go: it goes up next |
| letGoLeft | Let go: it waits at the back |
| letGoLast | Let go: that was the last one |
| learnedLeft (first left, needs DeckMemory) | At the back now. \n Cards you often pass on sit lower next time. |
| stampYes / buttonYes | Up next |
| stampNo / buttonNo | Not now |
| undo | Undo |
| barLineFirst | Up next, in the card above. Nothing starts until you tap Start. |
| barLine | Up next, in the card above. |
| allSeen(n) | That's all {word(n)} for today / That's the one for today |
| endOurPick | The card above is still our pick for you. |
| endYourPick | Your pick is ready in the card above. |
| again | Go through them again |
| everyWay | See every way to practise |
| semantics | As in section 10 |
| **Bug fix, `copy.dart:98`** | n == 2: "Both are from {when}, in {chapter}." (not "All two are") |

**Removed:** "Do this instead", "Skip", the old hint "Swipe right to do it instead, left to skip", "Let go: it moves into the card above, its key ready", "That was all {n} for tonight", and the dangling "or".

## 13. Build notes (for the Opus builder)

**Files:**
- `copy_suggested.dart`: the strings above.
- `logic/suggested_deck.dart`:
  - `DeckMemory` and the sink rule;
  - `DeckCoach` (first run: the demo shown, right done, left done, the visit count; it replaces `SuggestedHint`, and the old key is migrated as "taught" when it is at or above 2);
  - `DeckPass.undo()` with the last action.
- `widgets/suggested_stack.dart`:
  - the controls leave `_DeckCard` into a `_DeckControls` row that reads the drag value for its mirror;
  - `_DemoWiggle` driven by `_x`;
  - the tuck-to-back skip;
  - `_UpNextBar` (the app's SnackBar path, as `saved_screen.dart` uses for Undo, styled as glass chrome);
  - the coach line;
  - the dots removed.
- `screens/today_body.dart`: the undo of a pick (restore the previous lead choice) and the bar host.

**Goldens** at 360 and 412, Night and Day, and 1.3x text:
- fr1 (rest), fr2 (demo right, pinned at its peak), fr4 (threshold right), fr6 (threshold left), fr7;
- returning, end, loading;
- reduced-motion first run.

**Unit tests:**
- DeckMemory (section 6) and DeckCoach transitions;
- the undo of both kinds;
- a right swipe never calls a session start or a credit path (keep the existing safeguard test);
- the demo is cancelled by a pointer down.

**Emulator walk, the done check:**
- a fresh install: watch the demo and do one of each direction;
- vertical scroll starting on the card still scrolls;
- Undo from the bar and from the row;
- the end card at 9 am (it says "today");
- TalkBack custom actions;
- reduced motion;
- screenshots at each fr step against these frames.

**Estimate:** about 2 h for one Opus agent (gesture, motion and taste), plus about 30 min of goldens and the walk, run in parallel with a Sonnet agent for DeckMemory and the copy tests.

## 14. Taste self-check (D89), on the mock frames, in his format

These were found while looking at the captures, and fixed in the mock before this note was written:
- `[App > Today > deck, 390 Night, fr2] REFINE (fixed).` See: the 15 px stamp sat on top of the cost line and the title, and both read as a smudge. Fix: the stamp is now BricolageTitle 20 on an opaque fill, and the card's words dim to 0.4 at the threshold, so the decision reads first. Like in: Tinder's stamps.
- `[fr5, 390 Night] REFINE (fixed).` See: the lead card took a full 1.5 dp lime ring when it received the card, which was loud on Night. Fails #13 ("Night subtle"). Fix: the ring is dropped. The receive is a cross-fade plus a settle from 0.985, and the overline "Up next, your pick" says the rest.
- `[fr5] REFINE (fixed).` See: Mobi was in the bar while Mobi greets in the header, so two Mobis were on screen at once. Fix: the bar shows the moved card's own object, which also tells you which card went up.
- `[fr7, Revise card] REFINE (fixed).` See: a one-line card left a 70 dp hole under its title. Fix: the evidence line is pinned to the card's foot and the art is 104 x 88, so short cards look composed.
- `[fr7] REFINE (fixed).` See: the learning line wrapped to leave an orphan word ("time."). Fix: two deliberate lines.
- `[st-end] REFINE (fixed).` See: "Go through them again" used the same icon as Undo. Fix: a refresh icon.

Still to judge on the device: whether the 72 dp demo reads at 412 dp; whether the bar's 5 s is long enough for a first-timer to find Undo; the scroll-versus-drag feel with a real thumb.

**Slop list:**
- one lime key on screen (the lead's; the row is neutral and lights only while dragged);
- no glow added;
- no gradient beyond the existing light field;
- no ALL-CAPS, no kickers, no arrows in text, no icon-only control (except Undo's 1.3x fallback, which keeps its label in semantics);
- every count has its unit.

## 15. Capture index (`tmp/design-1018/swipe-v2/shots/`, each in `-night` and `-day`)
- `fr1-arrive`: the first visit at rest: the intro line, the coach line, the row.
- `fr2-demo-right`: the card performs right: the "Up next" stamp, Up next lit, the coach line.
- `fr3-demo-left`: the card performs left: the "Not now" stamp, Not now lit.
- `fr4-drag-right`: the student's drag past the threshold: the accent edge, "Let go: it goes up next".
- `fr5-up-next`: the lead card took the card; the glass bar with Undo.
- `fr6-drag-left`: the left drag past the threshold.
- `fr7-not-now`: the card at the back; "2 more after this"; Undo lit; the learning line.
- `st-returning`, `st-end`, `st-loading`, `st-offline`.
- `board-night.png`, `board-day.png`: all 11 frames side by side.

## 16. One question for the owner
"The swipe deck now names its two directions **Up next** (right, it goes into the card above, nothing starts) and **Not now** (left, it waits at the back), with the buttons under the deck the way Tinder does it, and a first-time demo where the card shows both swipes by itself. Build it as drawn?" **Recommend yes.**
