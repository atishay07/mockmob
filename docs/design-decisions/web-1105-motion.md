# The app's motion on the logged-in web (R2-A, 5 Nov 2026 night)

Owner, LK95 (5 Nov, about 2:40 am): carry forward from the app "how to build UI exactly like the app, animations". Branch
`web/1105-motion` from main `7b47b4c90`. Three of the app's motions were missing on the web; this packet ports them, in
the order the orchestrator set, each checked against the app's own code in `wt-1105-app/flutter_app/lib` first.

## User task and success test

A 16-17-year-old finishes a set and lands on the result: the number they earned should arrive as a moment, the same one
the app gives, and then hold still so they can read it. From any signed-in page they press Start: the sheet should come
out of the key they pressed, so the eye never loses the thing it touched, and go back into it. Success: the motion is
the app's (same durations, curves and order), it never hides or delays the information, it costs nothing under reduced
motion, and focus and Escape behave exactly as before.

## What I found (app code, verified)

1. **Monumental number** (`core/widgets/monumental_number.dart`). Each digit has a fixed-width slot; a column of digits
   rolls up into it. First show: from 0 (a 0 arrives from 9). A change: each slot rolls on from the digit it showed,
   wrapping; an unchanged digit stays. Digit i starts `min(i x 8%, 40%)` of the roll late; every slot lands together at
   500 ms (`Motion.numberRoll`) on emphasized `(0.16, 1, 0.3, 1)`. Reduced motion: final value. With a memory key it
   remembers and inks a rise volt, a fall dim. The web had a count-up instead (`useCountUp`, 720 ms on glide).
2. **Finish stamp** (`features/practice/widgets/finish_ceremony.dart`, used by `finish_stage.dart`). Figure scale 1 to
   1.12 over 80 ms (ease-out), back to 1 at 240 ms (ease-in cubic), a settle to 0.985 and back by 420 ms. At the landing
   one ink ring spreads for 600 ms (ease-out cubic; line 5 to 0.8 dp; alpha 0.85 to 0), and 14 shards for a good set
   (70% right or more) on Celebrations Full. Quiet keeps the stamp without ring or shards; Off, reduced motion and a
   reopened result show the end at once. The web had nothing.
3. **Container transform** (`core/widgets/bar/morph_sheet_route.dart`, opened from `core/router/app_shell.dart`). The
   sheet's shape is a rounded rect clipped from the Start key's rect to the sheet's over 420 ms on `morphGrowCurve
   (0.3, 0.55, 0.2, 1)` (the code says this is deliberately softer than emphasized, so the shape is seen leaving the
   key). The key's volt stays put and dissolves by 30% (swelling 20%). Content fades in over 38% to 78%, scaling from
   0.94 about the key. Close: 280 ms on `(0.3, 0, 0.8, 0.15)`, content gone in the first 55%. Reduced: a fade.
   **The page behind does not recede in the app.** The shared token `transitions.sheet` has `recedeScale 0.97,
   recedeDim 0.35`, which is where the brief's "the page recedes" came from, but no app code reads it: the morph sheet
   dims the page with its barrier scrim only (`sheetScrim`). I matched the app (see Decisions).

## What I changed

- `src/lib/motion/RollNumber.jsx` (new) with `rollPlan.js` (pure): the app's roll as one small component. Tabular
  lining figures, one slot per digit (inline-block, so baselines and the unit beside it never move), the column clipped
  by `clip-path: inset(0)` only while rolling, transform-only Web Animations. `settle` keeps G31's rule (wait for two
  smooth frames, 900 ms at most) so the page's arrival never swallows the roll; while it waits the slots are empty, never
  a static "000". `memoryKey` gives the app's number memory and rise or fall ink (`.mk-num`), ready for the other
  monumental numbers. Reduced motion never rolls. React's development double effect arms the same roll (keyed per value).
- `src/lib/motion/stampFigure.js` with `stampPlan.js` (pure): the app's figure curve as keyframes (the lift and landing
  keep Flutter's own ease-out and ease-in-cubic as per-keyframe easings; the settle is sampled) and the ring.
- The result's score (`ResultHero.jsx`): the count-up is replaced by `<RollNumber run settle>`; the stamp is scheduled
  from the roll's own landing so the figure touches down as the last digit lands (stamp starts 260 ms into the 500 ms
  roll). The ring plays for a good set (70%+ right) on Celebrations Full and never in NTA mode; Quiet stamps without it;
  Off shows the score at once. `ResultPageClient` passes `celebrations` and `nta`.
- `src/components/recovery/result.css`: `.rp-hero__score span` became `.rp-hero__score > span`. The unit rule (18 px,
  ink 3) was reaching every span inside the figure and shrank the score to 18 px grey the moment it had inner spans
  (first film, frame f0300, before the fix).
- `StartSheet.jsx` with `morphPlan.mjs` (pure): the container transform for open and close (Escape, the close key, the
  scrim, a row). The shape is `clip-path: inset(... round ...)` from the key's rect and radius to the sheet's own; where
  the key is outside the sheet's box (the desktop sidebar key beside the panel), the sheet starts standing off by the
  difference (`translate`) and travels home on the same curve, so the shape still starts on the key; the key's volt is a
  small element at the origin that counter-travels, swells and dissolves. Content (`.st-grab`, `.st-body`) arrives as one,
  38% to 78%, from 0.94 about the key. The drop shadow is off while the clip is on and fades back in over 200 ms (the clip
  would cut it into a hard edge). The scrim now comes in over 420 ms on glide and leaves over 280 ms on the close curve.
  A swipe down still slides the sheet away from the finger; with no key on screen (a `?start=` link) it rises as before.
  Reduced motion: 120 ms fades (the reducedFade token; was 150 ms in).
- Focus (found while checking the morph, also present on main): about 125 ms after opening, when the plan arrived and the
  rows were laid out again, the focused row was blurred to `<body>` (traced with focusin/focusout, `tmp/night-1105/r2a`).
  A focusout guard now puts focus back on that row (or the sheet's first key) when it drops to nothing while the sheet is
  open; presses on the sheet's blank space are left alone. After the fix the active element after opening is the hero key.
- Tests: `data/tests/web_motion_1105.test.mjs` (new, in `test:dock`): the roll, stamp, ring and morph numbers against the
  app's, and the wiring. `data/tests/web_fixb_1019.test.mjs` G31 updated as a deliberate refinement: it pinned the
  result's `useCountUp` call; LK95 supersedes the count-up on the result score, and the test now pins the roll and keeps
  its settle-wait and no-private-rAF checks.

## Decisions

- **No page recede.** The brief asked for scale 0.97 and dim 0.35 on the page; the app does not do it (above), and on the
  web a transform on `#app-main` would re-anchor its fixed descendants (the grid backdrop, phone action bars) for as long as
  the sheet is open. The existing scrim (Night 58%, Day 30%) already dims more than 0.35. If the owner wants a recede it
  needs its own decision for the app too.
- **The ring is resized for the web, the shards are not ported.** The app's ring is 0.42 of the ink height about the
  centre, sized for a 112 sp figure. At the web's 44 to 64 px score it drew a small volt circle round the middle digit
  (film f0550 before the change), which read as a stray mark. The web's ring starts just outside the figure and spreads a
  quarter of the type size beyond it, on the app's curve, line and fade; it stays within the room above and below. The
  14 shards and bubbles on a figure this size would read as a toy (the owner rejected toy-like motion on 21 Oct).
- **Grow curve over emphasized for the shape.** The brief named emphasized; the app's code uses `morphGrowCurve` for the
  shape on purpose and emphasized's duration (420 ms). I followed the code.
- **Roll over count-up on the result.** G31 (19 Oct) restored a 720 ms count-up because the 420 ms ease-out roll of pass
  1016e read as rushed and the page's arrival swallowed it. This is a different motion (the app's per-digit roll), and it
  keeps G31's settle wait so it is seen from its first frame. It lands in 500 ms on emphasized, front-loaded like the app;
  if the owner finds it quick on his phone, the knob is `ROLL.ms` (the shared numberRoll token).

## Evidence and rubric

Research rules (AGENT_RULES, premium UX brain): 31 (motion has a purpose: continuity for the sheet, a state change for the
score; reduced motion defined; nothing is told by motion alone: the score is real text from the first paint for screen
readers), 36 and S016 (keyboard, focus order and reduced motion tested), 38 (nothing here is claimed proven because it
"feels premium": the owner judges it on his phone). Slop list: no `transition: all`, no ease-in on entrances (the close
accelerates, as the app's does), no scale(0) entrances, no infinite loops, no glow (the ring is a 600 ms line that fades),
nothing covers content at rest (the origin element has no size and no pointer events outside the morph).

## Before and after

| | Before (main 7b47b4c90) | After |
|---|---|---|
| Result score, first open | counts 0 to the score over 720 ms on glide (`useCountUp`) | each digit rolls into its slot (500 ms, emphasized, 40 ms apart), the figure lifts to 1.12 and lands with the last digit, then settles; a good set's ring spreads from the outline and fades by 1.1 s |
| Start sheet, phone | rises from the bottom on a spring; contents rise in reading order | grows out of the dock's Start key: the glass starts at 45% and thickens, the key's volt dissolves by 30%, the content arrives as one at 38-78% |
| Start sheet, 1024 px and up | scales 0.94 to 1 beside the sidebar, level with the key | the panel starts on the sidebar key, travels to its place while it grows, and gathers back into the key on close |
| Close (Esc, close key, scrim, row) | slides down (phone) or shrinks 0.96 (desktop) | 280 ms back into the key; a swipe still slides away |
| Reduced motion | 150 ms fade in, 120 ms out; score shown at once | 120 ms each way; score shown at once (unchanged) |

## Verification (what was actually exercised)

Dev server on port 3541 (webpack), real Chrome 151 headless through playwright-core under the shared browser lock, the
preview harness (`/preview/arena?view=result&paper=strong|avg`, `view=review`). Films seek the Web Animations started by
the action in 50 ms steps (25 ms early in the morph); frames and sheets are in `tmp/night-1105/r2a/<tag>/` (not committed).

- Result score at 390x844, 1024x768 and 1440x900, Night and Day: roll from 000 to 216 (frames 0-500), stamp 260-680 ms,
  ring 500-1100 ms on the strong paper (44 of 50 right); the average paper (128) rolls and stamps with no ring;
  Celebrations Quiet stamps with no ring; reduced motion: no roll, the score at once. Rest shots: "216 / 250 marks" on
  one baseline, unit unchanged. Found and fixed on the way: the unit rule shrinking the figure (above) and the ring
  crossing the middle digit (above).
- Start sheet at the same six size and theme pairs: a real pointer click on the visible key (bar key at 390, sidebar key at
  1024 and 1440), the open filmed, then Escape and the close filmed. In every pair: focus inside the sheet after it opened
  (on the hero key), a hit test inside the sheet lands on the sheet, the sheet closed, focus back on the Start key, and
  the centre of the page hit-tests to page content after the close (no layer left behind). Reduced motion at 390 Night:
  a 120 ms fade, no movement, same focus results.
- Found on the way and fixed: the desktop morph measured an already-moving sheet when React's development double effect
  ran it twice, so the panel did not start on the key; the morph now drops a running morph first and only the latest one
  clears its flag.
- Tests: `npm run test:dock` 63 pass (1 skipped, needs a server), `npm run test:app` 1009 pass, `npm run test:recovery`
  637 pass (3 todo), `npx eslint` on every changed file clean. `src/lib/motion/motion-pass-1016e.test.mjs` (in no npm
  script) has one failure on main as well: `onboarding.css` has a `scale(0...)` entrance; onboarding is not this packet's.

## Not verified, and risks

- **Not on a real phone, not on a production build.** The owner judges on his phone; these are headless dev-build films.
- **The shape's clip runs on the main thread.** A Chrome trace of the open shows every transform and opacity part of the
  morph composited and the `clip-path` animation not (`compositeFailed 8192`, unsupported property clip-path). In the
  dev build at 4x CPU the open had main-thread frames up to about 130 ms (React development mode while the sheet mounts
  and its plan arrives); the content always stays inside the shape, so a slow phone would see the shape's growth stutter,
  never cut text outside it. A compositor-only skin (a scaled shape with corner pieces) is the fix if the owner sees it.
- **Speed of the roll against G31.** It is the app's 500 ms; the owner's 19 Oct note said a 420 ms roll felt rushed.
- **Other monumental numbers** (Today's big number in `TodayMove`, You and Progress figures) still count up: they are not
  this packet's files. `RollNumber` takes a `memoryKey` with the app's rise and fall ink, so each is a one-line swap.
