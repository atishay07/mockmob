# Scroll, the demo jump and the DU section (5 Nov 2026, packet P4: owner LK89, LK90, LK93)

Spec: `docs/brain/night-1105/SPEC.md`, decision D7. Branch `web/1105-scroll`. Every number here was measured on this
machine in real Chrome 151 (playwright-core, headless), against a production build of the branch (`next build --webpack`,
`next start -p 3534`) unless it says otherwise. Raw logs and traces: `tmp/night-1105/p4/` (git-ignored).

## What the owner said (5 Nov, about 2:40 am, summarized; verbatim on feat/app-and-web)

- LK89: wherever he clicks "Try a CUET question" it sometimes gets stuck in a scroll loop; when it does not, the landing
  is not clean ("just a white box, and then it highlights").
- LK90: the scroll is still a bit inconsistent; scrolling really fast, it can glitch out.
- LK93: the "Energy" (DU Eligibility) section loads a bit slowly.

## 1. The loop (LK89)

The scout's diagnosis (D7) held, line for line:

- `scrollBus.run()` checked the jump's arrival (`jumpFrame`) before it ran the subscribers. An instant jump arrives on its
  first frame, so `jumping()` was already false when `storyController.onFrame` read that frame.
- A tap ends with a touchend, and `onTouchEnd` set `lastRelease`, so for 3 s the controller treated any move as a fling.
- With both, the landing frame looked like a fling that crossed the near story's edge: the controller held the page on
  that story's last rest. DemoJump's two-frame correction jumped again, and the hold (cleared only in `settle()`) put
  it back. A tap made inside a hold also left a hold from `afterNativeTouch()` that no jump cleared.

Fix: the bus runs its subscribers first and checks the arrival after, so the landing frame still reads `jumping()` and
the next frame carries `landed`; every declared jump is announced (`onJump`), and the controller stands down on it (and
on a same-page link click and `hashchange`): no hold survives a jump and the tap is not a fling.

| Real Chrome, 390 x 844, a touch tap on a `#try-practice` link | before | after |
|---|---|---|
| from 40 px below the statement, the Lab, the tour, the Recovery Lab, and from Compass | 0 of 5 landed (dev server, the old bus and controller): each ended on the story's last rest (e.g. 3126 -> 2242, the statement's last step) | 5 of 5 on the card, 1 move, 0 frames away after landing (dev server, and again on the final production build) |

Locked by `src/components/landing/oneGestureJump.test.mjs` (the real bus and controller in a simulated browser: fails on
the old two files with `508 -> 6156 -> 508 -> 6156`, the loop), `runJump` in `oneGestureBench.mjs` and the opt-in real
Chrome test in `oneGesture.test.mjs`, and the source test in `data/tests/one_gesture_source_1104.test.mjs` (its old
`run()` assertion is updated to the new order: owner decision D7).

## 2. The arrival (LK89)

- The near-white 2 px outline ring on `.mm-drill` is gone. The card's own shell (`.lp-desk__card`) lifts instead: its
  shadow deepens and its border brightens to `--line-strong` in 180 ms, then both settle by 600 ms. Only the peak is
  written, so it starts and ends exactly on the card's resting shadow and border. No movement (the card hangs from the
  room; a translate would open a seam). Reduced motion keeps the border's brightening only.
- Focus goes to the card itself (DemoDrill's root, `tabIndex -1`, `role="group"`, no ring for this programmatic focus);
  the next Tab reaches answer A.
- DemoDrill's own `scrollIntoView` was `behavior: 'auto'`, which inherits `html { scroll-behavior: smooth }`: a glide.
  It is `'instant'` now.
- Where the card lands. D7 says target the card, not the whole desk. Two renders (390 x 844, 390 x 720, 360 x 640, Night
  and Day, and 1440 x 900; `tmp/night-1105/p4/shots/place-*`):
  - A, the card's top 12 px under the nav: a 12 px sliver of the room's painting showed under the nav, Mobi was off
    screen (he answers each pick from the room), and the card sat high with the hero links under it.
  - B, the card centred in the window under the nav, its top at least 12 px below it, the room above showing what that
    leaves: on 390 x 720 Mobi and his "Your first question. Go." bubble are in view, the card is whole, the dock is hidden.
  - B ships. It still places by the card (the desk's top is no longer what is aligned), and a card already wholly on
    screen does not move at all (the hero key at 1440, where the card is in the first screen).

## 3. Fast scrolling (LK90)

The hunt: `runFast` (touch, 390 x 844) and `runWheelFast` (wheel, 1440 x 900) in `oneGestureBench.mjs` trace every frame
(scrollY and each story's step) while a gesture runs and after it, and read the trace against the story's rule
(`readTrace`): an entry from outside must end on the first or last step, on its rest; a leave must leave; a step must be
one step. Faults counted per frame: a visible reversal (the page moving back to a place outside every hold), the page seen
outside the hold after it came in (the stage unpinning), a step flash (another step shown once inside the hold), a
re-entry, a skipped or repeated step. Flicks of 600, 1000 and 1600 px at 2500, 5000 and 8000 px/s (the statement: all
nine; the other stories: 2500 and 8000), entering from above and below, leaving from each edge, one step from inside;
wheel bursts of 10 notches 10 ms apart, 20 at 8 ms and 40 at 4 ms. A bench flick of 1600 px is longer than any real finger
travel on a phone; it is in the matrix because the spec asks for it.

Faults found (production build of this branch with the loop fix, before the fixes below):

| Fault | Where, with numbers | Cause |
|---|---|---|
| A fast swipe into a story skipped its first steps | Touch entries on the wrong step: statement 18 of 18 (from above it ended on step 1, 2 or 3; from below on 2, 1 or 0 instead of 3), Lab 6 of 12, tour 8 of 12, Recovery Lab 5 of 12. Up to 937 px into the hold before it was caught, and 213 to 631 frames per story showing a step other than the one it ended on | A finger that is still down was never clamped. The swipe dragged the page natively 240 to 900 px into the hold before it lifted, and the release (`afterNativeTouch`) held the nearest rest, not the edge it came in by. The statement's rests are only 248 px apart, so even a 600 px swipe skipped a step |
| The clamp held the page off the rest | Wheel at 1440: every burst into the tour was held at 5823 instead of 5780 (43 px), into the Recovery Lab at 12324 instead of 12124 (200 px). Touch at 390: the Recovery Lab's entries were held about 44 px off its first rest | Stale geometry. On the landing `<html>` is one window tall, so the controller's ResizeObserver on it never fired when the content changed. A centred story writes `--ss-slack` a frame after its section is first drawn; the negative margin moved its track (and every track below) by up to 200 px with nothing re-measuring (probe: `tmp/night-1105/p4/probe-ml-1440.log`) |
| A frame skipped by the shared read | Found by the simulated test, not seen in Chrome | The bus measured `dy` from its last read, so a held drag that came back to the same y read as no move and that frame skipped the subscribers |

Not faults (measured, left as they are):
- A fling held on an edge keeps running on the compositor for up to a second and is put back every frame (7 to 35 puts
  per cell). It happens inside the hold, where the stage is sticky, so it never shows; no step flashed in any cell after
  the fixes.
- A fast fling leaving one story is caught by the next story's first rest (the statement into the Lab). That is the
  rule: a fling never runs through a story.
- The rest of a wheel burst that was caught on an edge scrolls in and is put back (up to 34 puts of 100 px, inside the
  hold). Nothing shows, so the burst is not taken over.

Fixes (storyController.mjs, scrollBus.mjs):
- A finger that drags the page into another story's hold (it began outside every hold, or is leaving one) is held on the
  rest it came in by, while it is still down and after it lifts. Only against going further in: a finger that turns back
  out is free, and a drag that stops short of a story is never touched. `settle()` keeps that hold while the finger is
  down.
- The controller's ResizeObserver also watches `<body>`, which grows and shrinks with the content.
- The bus measures the next frame's move from where its subscribers left the page.

| Hunt (production build) | before | after |
|---|---|---|
| Touch, 390 x 844, all cells | 84 of 135 | 133 of 135 |
| Touch entries on the right step and rest | statement 0 of 18, Lab 6 of 12, tour 4 of 12, Recovery Lab 2 of 12 | 18 of 18 on the right step (2 read 3 px off, see below), 12 of 12, 12 of 12, 12 of 12 |
| Most a touch entry went into the hold before it was held | 848 to 937 px | 128 px (one frame of the fling), 159 px on the Recovery Lab |
| Frames showing a wrong step during touch entries | statement 631, Lab 222, tour 303, Recovery Lab 213 | 0 |
| Wheel, 1440 x 900, all cells | 39 of 45 | 45 of 45 |

The two statement cells left were read from the last recorded frame while the held fling was still decaying (1502 against
a rest of 1499); the bench now reads where the page ends after it has been still for 400 ms. The before count includes
the statement's nine leave-down cells, which the first version of `readTrace` counted as reversals: six were the Lab's own
clamp catching the fling (inside the Lab's hold, never visible) and three were the 1600 px drag carried into the Lab's
hold, the first fault above.

Regression check after the fixes: the LK69 matrix (`runMatrix`, now with an `enter-drag-600-2500-from-360-above` cell) on
all four stories at 390: 128 of 128; wheel, trackpad and keys (`runWheel`) at 1440 on the Lab, the tour and the Recovery
Lab: 27 of 27. The jump after all fixes: 390 5 of 5, 1440 4 of 4 (the statement is not held at 1440). The hero's own demo
key: at 390 the page lands with the card centred (y 481); at 1440 the card is already on screen and nothing moves; focus
on the card in both. Reduced motion: the jump lands, the arrival is `lp-arrive-calm`, no ring, the card is hit-testable.

Locked in node tests that always run: `oneGestureJump.test.mjs` (a fast drag from above and from below is held on the
edge rest, a finger held still keeps the hold, a finger turning back out is free, a drag that stops short is untouched)
and the source tests in `data/tests/one_gesture_source_1104.test.mjs` (the clamp rule's old assertion is updated to the
new one: owner decision D7, LK90).

## 4. The DU section (LK93)

- The calculator (EligibilityTeaser) is out of its `<Reveal>`: it is simply there when the reader arrives. Its heading
  still comes in (it enters the window first, so the order reads right while scrolling).
- Its section is drawn ahead while the page is idle (`storyPredraw.mjs`, `predraw(section)` called from the teaser),
  after the three stories.
- Phones: only section headings (`.rv.lp-head`) come in through the 6 px blur; big blocks are a 300 ms fade and rise
  with no blur (a blur on a block a screen tall is a full-size filter layer on every frame of the fade).

Measured at 390 x 844, 4x CPU, scrolling into the section at 1400 px/s after 14 s on the page (`du-timing.mjs`; the old
path re-created in the page: the teaser in a reveal with threshold 0.12 and the -8 % bottom margin, the 6 px blur and
800 ms):

| From the frame the calculator's top enters the window | before | after |
|---|---|---|
| Half visible | 410 ms | at once (the first frame it is in view) |
| Fully visible | 749 ms, when it was already 847 px into the window | at once, 50 px in |

The cold version of this run (1.5 s after load) is not a valid before/after (the re-created reveal was already shown on
its first frame), so only the warm numbers are given. Screens: `tmp/night-1105/p4/shots/du-*`.

## 5. Frames under load (runPerf: 22 swipes at 4x CPU, production build)

This PC was shared by six other packets (CPU 57 to 67 % busy), so each case was run more than once, and the old
controller was rebuilt into this branch for an A/B on the same machine state (the same build with the base
`scrollBus.mjs` and `storyController.mjs`).

| | frames over 100 ms (p95) |
|---|---|
| Warm, old controller | 0 (16.0 ms) |
| Warm, new controller | 9 (16.6), then 0 (16.0), 0 (15.9) |
| Cold, old controller | 5 (16.1), 3 (16.0) |
| Cold, new controller | 6 (16.1), 3 (16.0), 4 (16.0) |

The cold long frames are the same in both builds: two render-only frames of about 220 ms (no script in them) at y 985
and 1994, while the idle predraw draws the Lab and the tour between swipes, plus one or two near the tour. They are not
from this packet's code. The first warm run's nine came with script time inside the bus's frame under the heaviest load
and did not repeat in two more runs. Not verified: cold = 0 on a quiet machine (it was 0 on the LK81 base when that was
measured).

## Not done, not verified

- No view-transition cross-fade on the jump: with the card centred and the quiet lift the landing reads as an arrival,
  so the allowed cross-fade was not needed.
- The hero and dock keys themselves (Sign up, Log in, "Try 5 questions first") are another packet's; the jump was tested
  with the bench's own link and with the hero key this branch has today ("Try five questions").
- Real phones: everything here is headless Chrome with CDP touch and wheel input. A real Android fling may run on for a
  different time after a hold.
- A wheel burst caught on an edge is not taken over (its remaining notches scroll in and are put back inside the hold).
  Nothing showed; if a trackpad shows a shimmer at a story's edge, that is the next thing to change.
