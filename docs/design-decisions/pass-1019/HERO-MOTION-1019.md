# G30: the homepage's changing line, three motion options (mock-up, 19 Oct 2026)

**Status:** MOCK-UP FOR THE OWNER'S PICK (R8). Nothing is built into the site and nothing is committed. The build waits for his pick (Wave C).
**Designer:** B3 (motion), 19 Oct.
**Base:** main 23a7c090 (release 10, live). The prototypes are snapshots of that page, so the fonts, sizes and colours are the real ones.

## What he said (G30, and G31 for the feel)
> "This morphing text on the homepage, firstly, is a very basic animation. Change it somehow. This timing animation should start after someone is done scrolling and the first screening gets attached. Then the timing animation should load, then change, and so on and so forth. I don't know why I feel like all the animations inside Mockmob have changed and feel, to me, faster..."

**The landing rules that bind this work:**
- **L-016:** the headline has a visibly changing word: a typed line or a crisp per-letter morph, not glass, no glow.
- **L-019:** no glow, no sheen, no light running round an edge, and no gradient text.

**The plan's spec (PLAN-1019 G30):**
- A refined transition of 400-600 ms, ease-out.
- The cycle starts only after the hero has settled (first paint done, no scroll for 1.2 s).
- It pauses while the student scrolls.
- Reduce motion shows one still line.

## What is wrong today (FORENSICS G30, confirmed)
- `HeroMorph.jsx` calls `schedule(MORPH.FIRST_MS)` on mount, so the first change fires **3.6 s after mount, on a timer**. The only gates are a hidden tab, Reduce motion, and an IntersectionObserver that checks the hero is in view at all.
- It never waits for scrolling to stop. It changes while the page is moving, and it changes again 2.6 s after the hero scrolls back into view.
- My probe screenshot of the live page, taken 2.5 s after the page was idle, already showed "Every mark traced.". The student never saw the first line settle.
- The effect itself: each letter rises 0.35em and fades, 20 ms apart, with a 360 ms entrance. Every letter does the same small move, which is why it reads as basic.

## The timing rule (the same for all three options)
| Value | ms | Meaning |
|---|---|---|
| ENTRANCE | 1000 | The hero's own entrance. The last `data-hero` rise ends about 960 ms after first paint (`landing.css:303`: 620 ms, 60 ms apart). |
| QUIET | 1200 | No scroll, wheel, touch or scroll key for this long means the page has settled. Page load counts as movement. |
| READ | 1800 | Once settled, the student gets the current line once more before it changes. |
| HOLD | 3000 | Each phrase holds this long after it lands, while the page stays still. Today's hold is 2600 ms, and he finds the motion too fast. |
| ROUNDS | 3 | After three full rounds (12 changes, about 50-75 s) it rests on "No more guessing.". Leaving the hero and coming back starts it again. |

**How the rule plays out:**
1. **Settled** when all of these hold:
   - the web fonts are ready (`document.fonts.ready`);
   - first paint plus ENTRANCE has passed;
   - the last scroll input plus QUIET has passed;
   - the changing line is fully on screen (IntersectionObserver at ratio 1.0);
   - the tab is visible.
2. **First change** = settled + READ. On a page nobody touches, that is first paint + 3.0 s. If the student scrolls straight away, it is 3.0 s after they stop with the line back on screen.
3. **Next change** = landed + HOLD, as long as nothing has moved.
4. **Scrolling pauses the cycle.** Any scroll, wheel, touchstart, touchmove or scroll key cancels the pending change. Once the page is still for QUIET, the student gets READ again. So the line never changes under a moving page, and never changes at the moment it comes back into view.
5. **A change already in flight finishes.** It is never frozen mid-letter and never reversed; it lasts at most 1.6 s. The pause applies to the next one.
6. **Line partly off screen or tab hidden:** paused, with the same READ on return.
7. **Reduce motion** (the system setting or MockMob's own `data-motion="reduced"`): one still line, "No more guessing.", with no cycle and no caret. It is the same sentence that screen readers and search engines get (`HERO_SENTENCE`). If "the final line only" in the plan meant a different phrase, that is one constant to change.
8. **Mobi:** `pip:glance` still fires at the start of each change, and PipGuide still waits 2.6 s after Mobi lands before he looks. The first change at 3.0 s therefore lands after his wave, never in the middle of it.

**Measured on the prototype** (headless Chrome, real timers, `rules.mjs`; the full results are under "Verification" below):
- An untouched page changes **3.0 s after first contentful paint** (3014 ms for B, 3009 ms for C).
- **8 s of continuous scrolling:** no change. The next change comes 3009-3012 ms after the last scroll.
- **The line off screen and still for 6 s:** no change. The next change comes 2974-2981 ms after it is back.
- **Reduce motion:** no change in 7 s, and the line reads "No more guessing.".

## The three options
Every movement is a Web Animation in the prototype, so each one maps 1:1 onto CSS keyframes. At rest, each phrase is plain, kerned text: it is split into words or letters only while it changes, as today. All three keep zero layout shift: every phrase shares one grid cell, and the invisible copies hold the widest phrase. None of them uses glow, sheen or gradient text.

### A. Focus rise (per word, blur and rise)
- **Old words:** each lifts 0.12em, softens to blur(0.05em) and fades out. 280 ms on out-cubic `cubic-bezier(0.33, 1, 0.68, 1)`, 40 ms apart, left to right.
- **New words:** from 220 ms, 90 ms apart:
  - rise from 0.3em below, 620 ms on expo-out `cubic-bezier(0.16, 1, 0.3, 1)`;
  - blur(0.08em) to sharp in 420 ms on out-cubic;
  - fade in over 340 ms on out-cubic.
- **Duration:** about 1.0 s on paper for a three-word phrase; it looks settled by about 600 ms. The blur scales with the type: about 3 px on a phone and 6.5 px on a desktop at its peak, and 0 at rest.
- **Strengths:** soft and cinematic.
- **Weaknesses:**
  - The line is blurred while it moves, which is not "crisp" (L-016).
  - It is the most common "AI landing page" text effect of the last two years, the Framer-template blur-in.
  - It is the costliest to paint on a low-end phone: a filter on 80 px text, repainted every frame.
  - He rejected glass. A blur reads close to it.

### B. Mask rise (per word, soft-edged window)
- **The window:** each word sits in its own window, which is its own line hugging the glyphs.
  - Padding is 0.06em at the top and 0.15em at the bottom, with matching negative margins, so the line box does not change.
  - A one-tile, no-repeat mask feathers 0.06em at the top and 0.07em at the bottom, so a word at rest is never faded.
  - The mask does the clipping, not overflow, so the baseline never moves.
- **Old words:** each rolls up 1.3em out of its window. 420 ms on in-out-cubic `cubic-bezier(0.65, 0, 0.35, 1)`, 50 ms apart. Opacity is 1 until 20% of the run and 0 by 75%, so no half-word lingers at the edge.
- **New words:** from 200 ms, 80 ms apart:
  - rise from 1.1em below into place, 640 ms on expo-out;
  - fade in over 300 ms on out-cubic.
- **Duration:** 1.0 s on paper; it looks settled by about 560 ms.
- **Strengths:**
  - Crisp on every frame, with no blur.
  - It reads like a printed headline being rolled over, an editorial slot change in the manner of Apple product pages.
  - It is the cheapest to paint: transform and opacity on three spans under a still mask.
- **Weakness:** the words still rise. He has just called rising letters basic, and B could read as "the same thing, bigger".

### C. Select and type (precise caret)
- **0 to 320 ms, select:** the old line is selected from its end back to its start, as Shift+Home does. The highlight grows from the right edge with scaleX on out-quart `cubic-bezier(0.25, 1, 0.5, 1)`.
  - Night: volt at 24% (`rgba(210, 240, 0, 0.24)`). Day: olive at 20% (`rgba(124, 150, 20, 0.2)`).
  - Corner radius 0.06em.
  - The text keeps its ink colour, as a real selection does.
- **320 to 520 ms, a beat:** the selection holds, so the eye registers "this line is about to be replaced".
- **At 520 ms, replace:** the old line and its selection go together, the way the first keystroke replaces a selection.
- **Typing:** the new line is typed at a human rhythm:
  - 46 ms a letter, with a fixed jitter of 0, +9, -6, +12, -3, +5, -8, +10, -4, +7, -5, +3 ms;
  - +38 ms after a space and +110 ms before the full stop;
  - each letter fades in over 70 ms.
  - "Every mark traced." lands at about 1.6 s.
- **The caret:**
  - Shape: width max(2px, 0.055em), height 0.84em, top 0.1em, radius 1 px.
  - Colour: the brand colour (`--accent-text`: volt `#d2f000` on Night, olive `#526700` on Day). Solid, never glowing.
  - Path: it fades in at the old line's end over 100 ms, rides the selection's left edge on the selection's own curve, then jumps after each letter as it lands.
  - After the last letter: 420 ms later it blinks off 400 ms, on 500 ms, off 400 ms, on 160 ms, then fades out over 240 ms.
  - It is gone about 2.1 s after landing, inside the 3 s hold. No caret blinks during the hold, so nothing loops on screen (slop list item 6).
- **Strengths:**
  - It is the only option that is clearly a different kind of motion from today's.
  - It is the typed line he suggested himself on 15 Oct (L-016).
  - It carries MockMob's own idea: the line is selected and corrected, as the product finds the mistake and fixes it. With the logo covered, the hero still says MockMob.
  - It is crisp on every frame and cheap to paint (opacity per letter, one transform on the caret).
- **Weaknesses:**
  - A change takes about 1.6 s, not 0.6 s. It is the page's one authored moment, so the standards' cap of up to 500 ms for a milestone is exceeded on purpose. Each letter's own motion is 70 ms.
  - Typewriter effects can feel gimmicky when overused. The selection beat, the natural rhythm, the two blinks then gone, and the three-round rest are what keep it precise.

## Recommendation
**C, Select and type.** It answers "very basic, change it somehow" with something visibly new rather than a bigger version of the rise he rejected. It is the typed line he asked for in his own words, it stays crisp on every frame (L-016), it has no glow or sheen (L-019), and its story fits the product (selecting and correcting a line). Paired with the settle rule, the change happens only when the student is still and looking.

**If he wants something quieter and quicker, B, Mask rise, is the alternative.** It is crisp, premium and settles in about 0.6 s, but it is closer to what he called basic.

**A, Focus rise, is not recommended:**
- the blur is not crisp;
- it is the template effect;
- it is the heaviest on low-end phones.

**Evidence the recommendation rests on (taste section 0):**
- **His records:** L-016 (typed or crisp), L-019 (no glow or sheen), "very basic, change it", "unique, not basic".
- **The research:** AGENT_RULES 31 (motion needs a purpose and a reduced-motion path; nothing essential carried by motion alone); the anti-slop test, part 10 (motion with a reason); slop list item 6 (no infinite loops on components).
- **UI expertise:** an ease-out entrance; zero layout shift; no change while the page moves; interruptible by scroll without freezing mid-frame.

## Look here (the files)
All under `mockmob-next/tmp/design-1019/hero-motion/`.

**Compare sheets:**
- `compare-390-night.png`, `compare-390-day.png`, `compare-1440-night.png`, `compare-1440-day.png`
- Each shows the three options side by side at eight key moments of one change ("No more guessing." to "Every mark traced.").

**Frame strips:**
- `strips/<a|b|c>-<390|1440>-<dark|light>.png`: one change, a frame every 40 ms (12 strips).
- The single frames are in `frames/<option>-<size>-<theme>/tNNNN.png`. The 390 frames are 2x.

**Videos (WebM):** `video/option-<a|b|c>-<390|1440>-<night|day>.webm`
- 390 x 844 and 1440 x 900, about 20 s each, 12 files (VP8, 25 fps).
- **The script:**
  - load the page;
  - scroll down at 1.6 s (the cycle waits);
  - scroll back up at 3.0 s;
  - the page is still, then the first change;
  - the hold, then the second change;
  - scroll during the hold at 11.6 s (paused);
  - still again at 13.0 s, then the third change.
- A small "Mock-up note" bar at the bottom left says what the rule is doing at each moment. It is not part of the design.

**Prototypes:** `proto/option-a.html`, `option-b.html`, `option-c.html`.
- They are standalone, with the real page CSS, fonts and art copied in, and use one engine (`proto/hm-engine.js`) with styles in `proto/hm.css`.
- Query parameters: `?theme=light`, `?hud=1` for the note, `?manual=1` for no auto cycle, `?motion=reduced`.
- Serve the folder over HTTP to view them (`python -m http.server` in `proto/`).

## Build notes for Wave C (after his pick)
- **`heroPhrases.mjs`:**
  - Replace `MORPH.FIRST_MS` and `HOLD_MS` with the RULE values above.
  - Add a pure `nextChangeAt({ t0, lastInput, landedAt, needRead })` and, for C, a pure `typingSchedule(phrase)` that returns each letter's time and the land time.
  - Extend `mayMorph` with `settled` and `fullyInView`.
  - Unit-test all of them in `heroPhrases.test.mjs`: the settle gate, the pause on input, READ after a scroll, the rest after three rounds, and Reduce motion keeping phrase 0.
- **`HeroMorph.jsx`:**
  - Replace `schedule(MORPH.FIRST_MS)` with the settle controller: passive scroll, wheel, touchstart and touchmove listeners, scroll keys, an IntersectionObserver at threshold 1.0 on `.lp-morph`, `document.fonts.ready`, and first paint taken from a double rAF.
  - Keep: the screen-reader sentence, the invisible sizing copies, plain text at rest, and the `pip:glance` dispatch at the start of each change.
- **For C:**
  - Letters get `style={{ '--t': ms }}` and the CSS `animation: hm-letter 70ms ease-out var(--t) both`.
  - The selection is one span with a scaleX keyframe.
  - The caret is one span positioned by the Web Animations API from measured letter edges (`getBoundingClientRect` after layout), as in `hm-engine.js`. It is measured again on resize, and on a font swap via `document.fonts.ready`.
- **For B:** the `.hm-m` window CSS goes into `hero-motion.css` as is, including `mask-repeat: no-repeat`. Without it, Chrome tiles the gradient and the leaving word shows above its window: that was my first prototype bug, caught in the strips.
- **Done check (R5):**
  - frame strips at 390 and 1440, Night and Day, from the built page, compared against these strips;
  - a video of the settle and pause script;
  - a hard reload five times (L-021);
  - CLS stays 0.
- **Accessibility gap (carried over from today's build):** WCAG 2.2.2 (Pause, Stop, Hide) asks for a way to stop auto-updating content that runs longer than 5 s. The three-round rest and MockMob's own Reduce motion setting limit it, but neither is a control beside the line. If he wants it fully covered, pause while the pointer is over the headline or focus is inside the hero, and point at the existing motion setting from the footer.

## G31: global motion values I would restore (from FORENSICS G31, checked against git)
His words: animations "feel faster" and "not as refined and polished as they were". The motion tokens themselves barely moved since `deploy/1015-night` (3fc0095b):
- UI 200 ms, card 240 ms, enter 360 ms, emphasized 420 ms;
- `--mm-ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)` and `--mm-ease-emphasized` is `cubic-bezier(0.16, 1, 0.3, 1)`.

What changed is below. Each row says whether to restore it.

| # | What | Then (1015-night) | Now (r10) | Commit | Restore? |
|---|---|---|---|---|---|
| 1 | Number count-up (web) | `--mm-dur-count-up: 720ms` | 420 ms | 9d28148b (16 Oct 21:42, "app M15, standards R-153") | **YES, 720 ms.** The app never took the change: its token is still `countUp: 720` in v15.2 (`shared/motion-tokens.json:29`, `motion_tokens.g.dart:36`). So restoring it also re-aligns web and app. Change it through `scripts/gen-motion-tokens.mjs` and re-pin the token test hash. |
| 2 | List entrance (`.mk-stagger`) | every child rises (`mk-rise`, 360 ms emphasized), 45 ms apart, capped at 8 (the last starts at 315 ms) | the lead rises; children 2 and 3 fade up 6 px at 60 and 120 ms; all the rest fade together at 160 ms | dbb80d00 (16 Oct 22:46, "arena motion system") | **YES, per-child 45 ms rise.** "The first box arrives before the second box" (N5) is about order, and the 1015 version gives every row its own beat. Use `:nth-child(1..8)` delays of (n-1) x 45 ms, so it does not depend on JSX setting `--i`. Keep `.mk-stagger--flat` for long lists. |
| 3 | Key press: the volt keycap | `.btn-volt` a hard 3 px bottom edge (`0 3px 0 #9db400`), lifted `translateY(-3px)`, flush when pressed; 150 ms `--a-ease` | a flat volt key | c9662f67 (16 Oct 03:25, "de-slop A1") | **YES for the edge and the press travel; NO for the glow.** Restore the `0 3px 0` edge and the -3 px to 0 press. Drop the `0 10px 24px -12px rgba(210,240,0,.55)` volt shadow and the hover glow (L-019). On release use the existing calm spring: `transform var(--mm-press-lift-dur) var(--mm-press-lift)` (445 ms, a small overshoot). |
| 4 | Practice tiles: the press | a press sinks on `--mm-spring-snappy` (449 ms) and lets go on `--mm-press-lift` (445 ms) | removed with the tile grid | c9662f67 | **YES** on whatever rows replaced the tiles (subject shelf, mode list). This is the "calm spring on keys". |
| 5 | The Start key on the next step (`.na__cta`) | leans in 1 px on hover; `scale(0.965)` on press at 90 ms, springs back | flat | c9662f67 | **YES for the lean and the press; NO for the volt glow shadow** (L-019). |
| 6 | "Overshoot springs calmed" | `cubic-bezier(.34, 1.56, .64, 1)` at 420 ms, named only as a **fallback** in `var(--mk-spring, ...)` | `var(--mk-spring)` at `--mm-spring-release-dur` (566 ms) | 48e30685 (16 Oct 00:00) | **NO restore needed.** FORENSICS overstates this one. `--mk-spring` was already defined as `var(--mm-spring-release)` in `motion-kit.css:187` on 1015-night, and `motion-kit.css` loads globally (`globals.css:2`), so the 1.56 fallback never ran. The commit made those moves **longer** (420 to 566 ms) on the same curve, not faster. |
| 7 | Page transitions (`<ViewTransition>`) and the swipe commit (180 ms ease-in to 200 ms ease-out with fling) | none, and 180 ms ease-leave | added | dbb80d00 | **KEEP.** These add continuity, and an ease-in commit was a slop item. Check the page transition's duration against the 1015 feel on device before deciding. |
| 8 | Landing hero line | `MorphWord`, a word swap every 2800 ms | the letter rise, first change 3.6 s after mount | 02d2558d | **Replace with this pass (C or B) and its settle rule.** |

**One source:** after the restore, `shared/motion-tokens.json` stays the single source for web and app (`scripts/gen-motion-tokens.mjs` writes `motion-kit.css` and `tokens.g.js`; the app has its generated `motion_tokens.g.dart`). Rows 2-5 are CSS rules, not tokens, and live in `motion-kit.css` and `arena.css`. Before each restore, check the ledger for a newer owner decision.

## Verification (what I actually ran)
- Snapshot of the live landing from a dev server on 23a7c090 (port 3233, worktree `wt-b3-hero`, branch `design/hero-motion-1019`, no commits). The markup, the two page stylesheets, 24 font and art files, and the hero Mobi art were copied into `proto/`.
- **Frame strips:** the animations were paused and seeked to each 40 ms step, so the timing is exact, not sampled. I opened and checked A, B and C at 1440 Night, B at 390 Night, C at 390 Day, A at 390 Day, and the four compare sheets.
- **Two defects caught in the strips and fixed:**
  1. B's mask tiled vertically, so leaving words showed over the line above. Fixed with `mask-repeat: no-repeat` and a window that hugs the glyphs.
  2. C showed one frame of the caret ahead of the old line before the replace. The replace now happens 1 ms earlier.
- **One refinement to A:** the old line's blur overlapped the new words and read as muddy. The old line now fades in 280 ms, and the new words start at 220 ms.
- **Videos:** recorded with Playwright `recordVideo` (VP8 WebM, 25 fps). I opened a contact sheet of the B 390 Night video and checked the settle, the pause and the HUD states.
- **Two rule fixes made during the test:**
  1. "First paint" is now the later of two frames after boot and the browser's own `first-contentful-paint` entry. Before this, a slow stylesheet made the first change come 2.4 s after paint instead of 3.0 s.
  2. A scroll during a change keeps READ owed, and a phrase always gets its full HOLD after it lands.
- **The rule test (`rules.mjs`, final run):**

| Case | B (mask rise) | C (select and type) |
|---|---|---|
| Untouched page: first change after first contentful paint | 3014 ms | 3009 ms |
| Scrolling for 8 s: changes while scrolling | 0 | 0 |
| ...then the next change after the last scroll | 3009 ms | 3012 ms |
| Line off screen, still, 6 s: changes | 0 | 0 |
| ...next change after it is back | 2974 ms | 2981 ms |
| Reduce motion, 7 s: changes / line shown | 0 / "No more guessing." | 0 / "No more guessing." |
| Scroll 150 ms into a change: does it land cleanly, and when is the next change? | yes, no leftover layer; 3.53 s later (= its 3 s hold) | yes, no leftover layer; 4.10 s later (= its 3 s hold after a 1.6 s change) |

**Change times in the 12 videos** (ms from navigation; scrolls at 1.6 and 3.0 s, then at 11.6 and 13.0 s):
- A and B: about 6.3, 10.3 and 16.3 s.
- C: about 6.3, 10.9 and 16.3 s. C's second change comes later because its first change takes 1.6 s to land.
- In C's videos, the scroll at 11.6 s falls during the second change. That change finishes and the next one waits, which shows rule 5.
- The videos were recorded before the two rule fixes above. Neither fix changes these timings: both scrolls end long after first paint, and the mid-change scroll ends after the hold.

**Not covered:**
- No emulator or real-phone frame sequence: this is web, and the brief asked for Playwright.
- No blind owner check yet.
- Outside the headline, the prototypes are frozen snapshots. Mobi's flight, the sample card's state and similar parts replay their CSS entrance only, because the page's JavaScript is not running.
