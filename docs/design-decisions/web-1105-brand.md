# Brand moments: the statement's green words, the opening, the typed line and Ask Mobi (5 Nov 2026)

Packet P2 of the night refinement (`docs/brain/night-1105/SPEC.md`, decisions D4 and D5; owner items LK86 and LK87).
Branch `web/1105-brand`. Not pushed, not deployed. Frames are in `web-1105-brand/` beside this note.

## The user task

A 16- or 17-year-old opens www.mockmob.in on a phone, often for the first time. The opening is the first thing they see.
The typed line is the second. The statement under the hero tells them what MockMob does. The Ask Mobi slide in the tour
shows what asking looks like. Each is a short moment. Each should feel finished and look like the real product. None
should hold the student up.

## D4: the statement's green words (LK86)

**Before.** On 4 Nov the accent words ("where", "tonight", "shortlist") became heavier ink with no colour ("accent is
weight, not colour"). The owner asked for the green back.

**After** (`src/app/hero-depth.css`, `src/components/landing/Statement.jsx`):

- **Colours.** Night uses true volt `#D2F000`, which is 14.5:1 on the `#12110E` paper. Day uses a deep olive `#3F5200`,
  which is 7.5:1 on the `#F3EFE6` paper (AA, close to AAA). Every other word stays ink. The colour is on the letters
  only, with no highlighter, glow or wash. The trailing comma stays ink, so the green sits on the word alone.
- **Weight.** The accent keeps the statement's own weight (650). A heavier word in green would emphasise twice.
- **Phone held story (4 steps).** An accent word arrives dim and in ink with its clause. 200 ms after its own fade it
  turns green (a 420 ms colour change). Stepping back removes the colour at once, together with the light.
- **Wide-window scrub.** An accent word fades in ink and turns green in the last third of its slice
  (`lp-word-accent`). The last accent is green before the section reaches the middle of the window.
- **Reduced motion, short phones, no scroll timeline.** The finished sentence shows with the words already green.
  Verified computed colours: `rgb(210, 240, 0)` in Night and `rgb(63, 82, 0)` in Day.
- **Where the token lives.** `--statement-accent` is set on `.lp-statement` only, so no other text can pick up volt
  through it. The night-calm rule ("volt is never a text colour") still holds everywhere else.

Frames:

- `statement-phone-before.jpg`: steps 0 to 3, Night, then Day step 3.
- `statement-phone-after.jpg`: steps 1 to 3, the lighting moment 140 ms after a step (the word is lit and still in ink),
  Day step 3, and reduced motion in Night and Day.
- `statement-desk-before.jpg` and `statement-desk-after.jpg`: the 1440 scrub at several scroll positions, Night and Day.

Test: `data/tests/statement_accent_1105.test.mjs` pins the new rule. No existing test was pinned to "accent is weight",
so no test was removed or loosened.

## D5: the opening, the typed line and Ask Mobi (LK87)

### How it was watched

- **Before.** Screencasts at 390x844 in real Chrome, sampled every 50 ms. Two sources:
  - the live site (www.mockmob.in, read-only, one visit);
  - the dev server, with a first visit forced (storage cleared, `navigator.webdriver` overridden).
- **After.** Real-speed replays of the opening on a fully loaded page, with an idle main thread. The replays covered:
  - a prompt paint;
  - a simulated 300 ms and 800 ms late paint;
  - Night and Day.

  First visits on the dev server were also checked end to end (`tmp/night-1105/p2/verify.mjs`).
- **Reference.** ug.preparoo.app, read-only, no sign-in, nothing clicked. Its screencast is kept only in the git-ignored
  `tmp/`; nothing of theirs is committed.

### What Preparoo does (reference, 5 Nov)

- **Opening.** Black until their page loads (about 2.9 s on this connection). The wordmark fades in over about 200 ms
  and holds about 0.6 s. It then flies to the header while a horizontal blinds wipe reveals the page (about 400 ms).
  The logo stays whole and lands as the header's own logo.
- **Typed line.** "Ace the ___" keeps its prefix. The exam name:
  - is deleted with backspace at about 100 ms a letter;
  - is followed by an empty pause of about 0.5 s;
  - is retyped at about 110 to 120 ms a letter, unevenly, and held about 2 s.

  Letters appear whole. A thin caret blinks while the line holds.

**What we took:**

- the logo lands as the bar's own logo;
- letters land whole;
- a resting caret blinks;
- the line is read before it changes.

**What we did not take:**

- the blinds wipe (a new effect for its own sake);
- their slower cadence and backspace delete, because our pass would grow beyond today's;
- their black screen before anything shows.

### The opening

**Finding 1: half the opening played unseen.** On the live site the page first painted 614 ms after the opening's
script ran: the main thread was busy from about 98 ms to 608 ms. The CSS timeline had started at the script, so:

- the blink (150 ms), the inked eye (320 to 520 ms) and the first 100 ms of the pull-back played behind a blank screen;
- a visitor joined with the camera already at 2.05x (`opening-before-live-390-night.jpg`);
- on a slower phone they would join later, or only see the hand-off.

The dev server showed the same at 935 ms.

**Fix** (`src/components/landing/openingGate.mjs`, `src/app/opening.css`):

- **The hold.** The layer holds its first pose ("mo" at 2.2x; `html[data-opening-hold]` pauses every part) until the
  browser reports the first contentful paint (`PerformanceObserver`, buffered).
- **The snaps.** The clock then starts from a rest pose chosen by how long the student has already waited
  (`OPENING_SNAPS`):
  - within 200 ms, from 0 (every beat);
  - within 450 ms, from 310 ms (blink done, eye still empty);
  - within 1.1 s, from 500 ms (eye inked, camera about to pull back);
  - later than that, the held splash dissolves where it stands in 160 ms (`html[data-opening-late]`), with no flight and
    no jump to another pose.
- **Every part jumps together.** All parts of the layer move to the chosen pose while still held, so nothing is seen to
  skip.
- **Fallbacks.** Without paint timing it starts at once, as before. If no paint is reported within 3 s, it starts anyway.
- **What a tap does.** A tap during the hold skips to the hand-off, as before.

**The trade-off, stated plainly.** The opening's own length is unchanged: 1,280 ms per session and 1,600 ms on a first
visit, with a 280 ms hand-off. When the first paint is late, the hero arrives later than before. Skipped beats never add
to the wait, so the cost is bounded:

| First paint (callback) | Before: hero at | Before: what was seen | After: hero at (first / session) |
| --- | --- | --- | --- |
| 620 ms (live desktop) | 1,600 / 1,280 ms | about 1.0 s / 0.7 s of a half-gone opening | 1,720 / 1,400 ms, with every beat after the eye inks (+120 ms) |
| 1,100 ms | 1,600 / 1,280 ms | only the word and its hand-off | 2,200 / 1,880 ms (+600 ms, the most it can add) |
| over 1,100 ms | the paint itself (opening already over) or its tail | nothing, or a flash of the hand-off | the splash dissolves: the hero 160 ms after the callback |

**Finding 2: the hand-off did not land.** The word thinned to grey while it flew and the ground stayed dark under it, so
the word vanished instead of becoming the bar logo (`handoff-before-live-390-night.jpg`). In a first fix the page opened
early, and the word then crossed "One mock." on a half-clear ground.

**Fix:**

- **The flight.** The word flies on a gentler start with a long soft landing: `cubic-bezier(0.32, 0.72, 0, 1)`, still
  280 ms.
- **Night.** The word stays whole all the way and lands on the bar logo, which is the same drawing in the same colours.
  The bar logo now waits hidden and appears on the landing, so there is never a second logo on screen. The ground opens
  once the word has cleared the headline (from 120 ms, 150 ms).
- **Day.** The bar's letters are ink, so the white word dissolves on the dark ground (100 to 220 ms). The cream page and
  the ink logo then come up together (150 to 280 ms). This replaced a cross-fade that left a white ghost over the ink
  logo (seen in the first Day replay).
- **A bug the 800 ms replay caught.** The bar logo's fallback and its landing shared one animation name. A changed delay
  then counted from the gate, not from the flip, and the logo showed early. Every rule now has its own name; the test
  pins this.

Frames:

- `opening-after-390-night.jpg`: the whole opening. The first row is the page before the replay starts.
- `handoff-after-390-night.jpg` and `handoff-after-390-day.jpg`: every delivered frame of the hand-off.
- `opening-after-late-paint-800ms.jpg` and `landing-after-late-paint-800ms-zoom.jpg`.
- `opening-after-late-paint-1300ms-dissolve.jpg`: past the last snap, the splash dissolves.

  A first version of this path cut to the hand-off instead. That added a 280 ms flight starting from a pose the student
  had never seen arrive; the dissolve replaced it.

### The typed line

**Findings from the 50 ms film** (`typed-before-390-night.jpg`):

- **A gap before the caret.** Each letter faded in over 60 ms while the caret had already moved past it, so frame after
  frame showed a gap or a grey letter at the leading edge ("Fresh every t|", "Every mark traced |").
- **A frozen caret.** The caret stayed solid and still through each 2.2 s hold.
- **No time to read.** The resting line "Know what to fix." was selected 100 ms after the opening ended, before it could
  be read.

**After** (`src/components/landing/heroLines.mjs`, `HeroTyped.jsx`, `opening.css`):

- **Letters.** Letters land whole as one text run, which also keeps the font's kerning. The pace is an even 46 ms a
  letter, plus 34 ms at each new word and 80 ms before the full stop.
- **Pauses.** The resting line holds 420 ms with its caret before the first select-back. Each phrase holds 1,700 ms.
- **The caret:**
  - it gives way to the selection;
  - it is solid while typing;
  - while a phrase holds it blinks like a text field's (solid for 530 ms, then three finite cycles, 50 ms fades);
  - after the final letter it blinks twice and leaves, as before;
  - it is still ink, never volt.
- **Length.** The pass is 7,600 ms to the last letter (was 7,606) and 9,350 ms with the caret's goodbye (was 9,356).

Frames: `typed-after-390-night.jpg` is every 100 ms of the film, from the caret's first frame.

### Ask Mobi in the tour

**Before** (`askmobi-before-390-night.jpg`). The question faded in like any list row. Three grey dots showed for 260 ms,
too short to register. The reply then appeared all at once. It read as a generic chat.

**After** (`src/components/landing/TourScreens.jsx` PrepOSScreen, `src/app/tour-screens.css`):

1. **60 ms.** The question is sent, rising from its tail corner (10 px and 0.94 to 1, 320 ms).
2. **300 ms.** Mobi reads your record. This is the real panel's own pending line, "Reading your record for tonight"
   (AskMobiPanel), and his eyes run along it.
3. **860 ms.** The reply opens around him where he already sits. The reading line and the reply's head share his inset,
   so he never jumps. The reply fades and grows 1.5 % from its top-left, with no rise.
4. **920, 975 and 1,030 ms.** The three steps line up on a 4 px rise.
5. **1,140 ms.** The quick replies come last.

The reply's room is reserved from the first frame, so nothing moves.

**A stated exception.** The screen takes about 1.4 s, not the tour's usual 600 ms, because the beat of reading is the
moment. The generic dots are gone because the product never shows them.

Frames:

- `askmobi-after-390-night.jpg` and `askmobi-after-1440-night.jpg`.
- `askmobi-after-reading-and-reply.jpg`: Mobi in the same place in both states.

## Verification (what was actually exercised)

- **Real Chrome at 390x844, dev server, first visits** (`verify.mjs`), Night and Day:
  - the opening ends in `done` and the layer is `display: none`;
  - `elementFromPoint` at five points returns page content (h1, hero copy, the bar logo's path, the room, the drill);
  - the bar logo's opacity is 1;
  - no page errors.
- **Paint and snap on first visits.** Night painted at 235 ms with the callback at 706 ms, so it started from 500.
  Day painted at 131 ms with the callback at 232 ms, so it started from 310.
- **A real CDP touch tap 300 ms into the opening.** The opening was cut and `done` came 412 ms after the tap.
  Hit-testing was then clean.
- **Reduced motion, Night and Day:**
  - no opening and no hold;
  - the typed line is static with no caret;
  - the statement is flat with its accents green.
- **Statement.** The 4 held steps were captured in Night and Day, with the lighting moment. The 1440 scrub was captured
  at five positions in Night and Day.
- **Ask Mobi.** Frames every 100 ms at 390 Night and 1440 Night. The tour's screens are always dark, so Day is the same.
- **Tests:**
  - `node --test src/components/landing/*.test.mjs data/tests/landing_checklist_1104.test.mjs
    data/tests/web_landing_health_1020.test.mjs data/tests/statement_accent_1105.test.mjs
    data/tests/marketing_theme_tokens_1104.test.mjs`;
  - `NIGHT_CALM_ALL=1 node --test data/tests/night_calm_1104.test.mjs`;
  - all pass, and eslint is clean on the changed files.
- **Tests updated to the new rules** (owner decision LK87):
  - `heroLines.test.mjs`: timing, one text run, the resting caret blinks;
  - `opening.test.mjs`: the flight curve, the ground timing, the fake environment gains `removeAttribute`, a clock and
    paint timing, plus four new LK87 tests.

**Not verified:**

- **A production build or a real phone.** The live-site film is the "before" on production. The "after" ran only on the
  dev server and in replays.
- **The 1.1 s dissolve path** is exercised by unit tests and a replay with a simulated 1.3 s paint, not on a slow
  phone.
- **The owner's own eye.**

## Anti-slop check and rubric (internal, 0/1/2)

**The 12-part test:**

- **Identity.** The opening is the app's own "mo"; the Ask Mobi line is the product's own words.
- **One primary action.** Unchanged, and the opening never blocks it: a tap skips it, and the layer ignores input from
  the hand-off on.
- **True content.** "Reading your record for tonight" is the real pending state. The plan rows are the existing
  illustrative values.
- **Hierarchy.** Green marks three words, not the sentence.
- **Motion with a reason.** Every movement shows a state: the paint, the landing, a selection, a resting caret, a sent
  message.
- **No glow, gradient text or sheen.** Nothing new loops. The resting caret blinks three finite cycles; the existing
  Mobi eye blink is unchanged.
- **Accessible.** AA contrast. Reduced motion keeps the same information with no movement. The typed slot stays
  aria-hidden, with the sentence in sr-only.

**Rubric scores:**

| Dimension | Score |
| --- | --- |
| Task fit | 2 |
| Content truth | 2 |
| Readable hierarchy | 2 |
| Visual specificity | 2 |
| Accessibility | 2 |
| Functional states (prompt, late and very late paint, tap, reduced motion; the very late one by replay only) | 2 |
| Trust | 2 |
| Intentional motion | 2 |
| Responsive integrity (390 and 1440 seen; 360 and 412 not filmed) | 1 |
| Performance (no main-thread work added per frame; the inline gate grew from 4.8 KB to 5.9 KB) | 1 |
| Instrumentation (not applicable) | 0 |

**Evidence.** Research rule 31 (motion needs a purpose) and rule 27 (show the real product, T007 and T009). S016
(reduced motion and contrast). Owner items LK86 and LK87.
