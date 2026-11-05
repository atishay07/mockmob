# The feature tour's step change (R3-D5, LK105), 5 Nov 2026

Owner, 5 Nov about 10 am: the "What's inside MockMob" walk "is still a bit glitchy in terms of animation and stuff that it
shows: sometimes it's not glitchy and sometimes it is." Spec: docs/brain/night-1105/SPEC-R3.md, R3-D5. Research:
tmp-night/r3-research/ALL.md, scrolltour P2-1..P2-5. Branch web/r3-tour (from main 83925b982).

## User task and success test

A student scrolls (or wheels) through the held tour, one tool per gesture. Success: every tool arrives empty and builds
in front of them. A finished screen never flashes first, a leaving screen never jumps to its finished state, and two
tools' text never sits on top of each other. On a slow phone the chip row keeps up with the step.

## What was wrong (measured, production build of main, real Chrome)

- **The flash (P2-1).** `useSequence` reset the demo with a setState during render (`if (active !== wasActive)`), inside
  ScrollStory's startTransition render. Each off-stage screen also got a settle timer (`setTimeout(setValue(settled))`).
  When the value was already settled, React bailed that update eagerly and parked it on DefaultLane. The transition
  render committed step 0, and the next DefaultLane render rebased it to the finished step. So data-ts-step went
  0, then finished, then 0 again as the playback restarted. This happened on 15-16 of 17 activations in every cell
  (390 touch and 1440 wheel, 1x and 4x CPU). At 1x it lasts a few ms, which is why it was only "sometimes" visible.
- **The leaving pop (P2-2).** An off-stage screen settled about 10 ms after it left, so a half-built Ask Mobi jumped to
  its full reply while still fading out. Seen as 2>7 at +11 ms (1x) and +106..126 ms (4x) at 1440.
- **Text through text (P2-3).** A symmetric 240 ms crossfade in one grid cell held both tools above 0.05 opacity for
  152 ms, the fainter at 0.48.
- **Late icons (P2-4).** The rail icons were lazy inside a sideways scroller, so on a cold 390 visit 7 frames (1x) and
  13 frames (4x) showed a chip with no icon yet.
- **Late chip row (P2-5).** At 4x the chip row started moving at a median of +191 ms after the step. The effect read
  offsetLeft and scrollWidth right after the commit, which forced a layout.

## Decisions

1. **An activation epoch replaces the render-phase reset.** ScrollStory's transition state is `{ step, seq }`. `seq`
   goes up by one on every step change and rides in the same `startTransition` as the step. The tour passes `seq` to
   the screen on stage as its `epoch`; off-stage screens all get -1, so a step still re-renders only two screens. The
   unheld carousel passes `visit`. `useSequence` keeps `{ epoch, value }`, and its playback emits `{ epoch, value }`.
   The rule lives in `tourSequence.mjs` (pure, unit-tested):
   - reduced motion: finished;
   - on stage and playing: this epoch's value, or the first frame until the playback has spoken;
   - held and off stage: frozen;
   - paused: frozen;
   - carousel and off stage: finished.

   There is no setState in render, no settle timer and no setState in an effect body (the repo's `react-hooks` lint
   rules hold).
2. **Off stage, held screens pause and never settle.** The playback exists only while the screen is on stage. A leaving
   screen fades out exactly as it was, and when it comes back it starts again from its first frame.
3. **A sequenced change, not a crossfade.**
   - Out: opacity to 0 in 120 ms with no movement.
   - In: waits 90 ms, then fades in over 200 ms and rises 0.6rem. It comes down from 0.6rem above when the reader goes
     back, which keeps the old past/future direction.
   - Off stage, a tool's transform snaps only after it is hidden (`transform 0s linear 120ms`).
   - Curves are the app's own tokens: out on `--mm-ease-exit`, in-opacity on `--mm-ease-glide`, the rise on
     `--mm-ease-out`. The spec said "ease-in" for the out. The owner's UI standards say never use a slow-start ease-in
     on UI, so the out uses the app's exit curve. It still accelerates, starts at slope 0.75 rather than 0, and gives
     the same overlap.
   - The in-opacity uses glide rather than `--mm-ease-out`. With `--mm-ease-out` the fainter tool would peak at 0.240,
     too close to the 0.25 gate. With glide it peaks at 0.205 (computed in the test from the shipped tokens).
   - Reduced motion: no movement and no overlap. The leaving tool goes at once and the arriving one fades in over 120 ms.
   - Custom properties `--ft-out`, `--ft-in`, `--ft-in-delay` and `--ft-rise` live on `.ft-story`.
4. **Rail icons load eagerly at low priority.** BrandIcon takes `loading` (default `lazy`, unchanged everywhere else)
   and `fetchPriority`. The tour passes `eager` and `low` for its ten 32 px objects and the desk bell.
5. **The chip row moves from cached places in the next frame.** Chip centres are measured in a ResizeObserver callback
   on the row and on every chip (layout is clean there), and again after `document.fonts.ready`. A step schedules one
   `requestAnimationFrame` from a layout effect and scrolls from the cache. There are no layout reads on a step.

## The gate (proof)

`src/components/landing/tourGateBench.mjs` runs real Chrome 151 with CDP touch and wheel input, under the shared
browser lock. It walks the tour:

- 9 steps forward at 1.7 s each;
- 2 steps back;
- 3 quick steps back and 3 quick steps forward across Ask Mobi.

Two recorders run during the walk:

- **A MutationObserver** (`attributeOldValue`, with commit order rebuilt per batch). On every activation data-ts-step
  must read 0 and never go down, and a leaving screen must not change while it is visible.
- **A per-frame opacity recorder**, stamped with the frame time. Both tools may be above 0.05 for under 30 ms, and
  the fainter must stay under 0.25.

Both runs used production builds (`next build --webpack`, then `next start`). The "before" build was this branch with
the five source files restored from 83925b982. Both runs used the same bench.

| run | data-ts-step not 0-then-climbing | leaving pops | overlap max | fainter max | chip row starts (median) | frames with an unloaded icon |
| --- | --- | --- | --- | --- | --- | --- |
| before 390 touch 1x | 16 of 17 | 0 | 152 ms | 0.482 | +37 ms | 7 |
| before 390 touch 4x | 16 of 17 | 0 | 152 ms | 0.481 | +191 ms | 13 |
| before 1440 wheel 1x | 15 of 17 | 2 | 152 ms | 0.482 | (no scroll at 1440) | 0 |
| before 1440 wheel 4x | 15 of 17 | 2 | 152 ms | 0.481 | (no scroll at 1440) | 0 |
| after 390 touch 1x | 0 of 17 | 0 | 16 ms | 0.199 | +42 ms | 0 |
| after 390 touch 4x | 0 of 17 | 0 | 23 ms | 0.201 | +128 ms | 0 |
| after 1440 wheel 1x | 0 of 17 | 0 | 17 ms | 0.193 | (no scroll at 1440) | 0 |
| after 1440 wheel 4x | 0 of 17 | 0 | 16 ms | 0.204 | (no scroll at 1440) | 0 |

Every gesture moved exactly one step in all eight runs. React's commit after the step (median) at 4x fell from 96 to
38 ms at 390 and from 46 to 40 ms at 1440. Raw data and logs are in `tmp/r3/r3-tour/` (gate-before/after .json and
.txt, gate-summary.txt), which is not committed.

Step-change sheets (screencast, dark, step 1 to 2) are in `tmp/r3/r3-tour/sheet-{before,after}-{390,1440}-step1to2.png`.

- **Before:** both tools are legible together from about +100 to +160 ms.
- **After at 390:** the leaving tool is gone before the new one rises.
- **After at 1440:** one sampled frame shows both, faint (the designed overlap of about 20 ms).

## Changed rules (tests updated, none deleted)

- `storyPredraw.test.mjs` used to pin `if (active !== wasActive)`, the render-phase reset. It now pins its absence and
  the `shownValue` rule.
- `landingMobi.test.mjs` used to pin the bare `<BrandIcon name={name} size={RAIL_ICON} />`. It now pins
  `loading="eager" fetchPriority="low"`.
- New: `tourGate.test.mjs` covers:
  - the value rule;
  - the analysis (a clean step passes, and the old flash, the leaving pop and the crossfade each fail);
  - the overlap computed from the shipped curve tokens;
  - the source pins;
  - an opt-in real-Chrome gate: `MM_TOUR_GATE=1 TOUR_GATE_URL=http://localhost:3584/`.

## Not changed

- The ScrollStory change is only `{ step, seq }` plus `seq` in the stage api. The R3-D4 bottom-band packet also edits
  ScrollStory and should merge cleanly around it.
- The chip row's start at 1x is about 5 ms later than before (one rAF). At 4x it is about 60 ms earlier.
- The 4x step frame is still long (a React transition render of two screens). runPerf was not re-run here.
