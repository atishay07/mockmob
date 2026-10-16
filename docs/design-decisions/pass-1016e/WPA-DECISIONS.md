# WP-A decisions: arena motion system (web pass 1016e, packet 1)

Written 16 Oct 2026 by the WP-A builder, in wt-webux2 (branch web/ux-social-1016). Plan: mockmob-next `docs/design-decisions/pass-1016e/WEB-PASS.md`, step T0 and packet WP-A. AGENT_RULES 39.

## User task

A student moves round the arena (Today, Practice, Review, You, a result) many times a session, on a phone first. Each move should say where they went (sideways to another place, deeper, a result rising) without making them wait, and nothing should keep moving on a screen they are only reading. Numbers they have already seen should not climb from zero again. App and web should feel the same (owner: Night/Day and app/web parity).

## What changed

| Item | Change | Evidence |
|---|---|---|
| T0 | `countUp` 720 to 420 ms in `shared/motion-tokens.json`; motion-kit.css and tokens.g.js regenerated with `scripts/gen-motion-tokens.mjs`; the JSON hash in `src/lib/motion-tokens.test.mjs` re-pinned. Commit `9d28148b`. | standards s8 [R-153]; MOTION.md 1.1 |
| WA-01 | `experimental.viewTransition: true`. AppLayoutClient wraps the page in React `<ViewTransition {...VIEW_TRANSITION_PROPS}>` (guarded like SubjectObject: no React export, no wrapper). Every navigation gets its type from `placeTransition.js` through `src/instrumentation-client.js` (`onRouterTransitionStart`, which Next calls inside the navigation Transition). Place fade-through by dock order, push/pop for drill-ins, rise/rise-back for results, a fade for anything else, nothing on `/test/**`. The top bar, dock and sidebar are lifted out of the page's picture (`:active-view-transition-type`) so they never move. Focus goes to the new page's `<h1>` (or `<main>`). Reduced motion: the existing 120 ms cross-fade. | rule 31 (continuity), rule 11 (S016), rule 36; MOTION.md 1.1, C2 |
| WA-02 | `useCountUp` runs on the 420 ms token on ease-out (was emphasized). The rules live in a pure `countUpPlan.js` with a unit test. RecordGlimpse, YourSheet, RecordView and NumberTicker drop their 800-1400 ms durations; RecordGlimpse and YourSheet now pass a `memoryKey`, so the first view climbs from 0 and later views show the remembered figure (or roll from it when it changed). | standards s8 [R-153]; MOTION.md 1.1 |
| WA-03 | `rc-breathe` 3 breaths then rest, plus a `data-breathe='true'` hook for one more breath (WP-B sets it from RhythmCard). Arena subject objects float 2 cycles and end on the rest pose; ObjectLife breathes one more cycle on pointer arrival, focus, or coming back into view (fresh animation name, only when resting, so no jump). `sx-stack-breathe` 2 cycles. `du-shimmer` 4 sweeps. Spinners are untouched. | MOTION.md 1.1; standards s8, s10 item 6 [T-024]; R-047, R-202 |
| WA-04 | Small marks pop from 0.6 and opacity 0 on `--mm-spring-icon-pop`: the practice radio dot, the trend plot dots, the onboarding ink disc, the logo dot, the DU clear dot, the answer-sheet bubbles. The radio dot exit is 150 ms on `--mm-ease-exit`. The DU dot loses its 1.56 overshoot bezier. | standards s8, s10 item 6 [T-105, A-006] |
| WA-05 | `.mk-stagger`: the first child rises 14 px over 360 ms on emphasized; children 2 and 3 fade up 6 px at 60 and 120 ms; the rest fade in together from 160 ms. New `.mk-stagger--flat` (opacity only) for lists. | standards s8 [T-024, T-112, T-114]; s13 anti-slop item 10 |
| WA-06 | A committed swipe keeps the release velocity and carries on off the row on the lift spring (300 ms, bounce 0), sampled by the pure `swipeRelease.js` and played with the Web Animations API. Without WAAPI the fallback is 200 ms ease-out, never the ease-in. `foldExit` is 200 ms on ease-out. Reduced motion commits at once. | standards s8 [T-103]; apple-design (momentum) |
| WB-06 share | student-pages.css 148 and 274 (the leaderboard narrow-column numbers and the rhythm step labels): 12 px with line-height 1.3, as WP-B does in arena.css. | DESIGN-CRITIC #23; rule 36 |

## Decisions and trade-offs

1. **Types come from the router hook, not from each link.** The plan said to pass `transitionTypes` on the sidebar, dock and More-sheet links. That covers only those three, and the plan's own acceptance includes in-page moves (Practice to a result, Review to Revise) whose links live in files other packets own. `onRouterTransitionStart` in `instrumentation-client.js` runs inside Next's navigation Transition (verified in `next/dist/client/components/app-router-instance.js`). It is the one documented place where `addTransitionType` can reach every navigation: links, `router.push`, and the back button. One rule, one place. A swipe-back that the browser already animates (`popstate.hasUAVisualTransition`) gets no second animation.
2. **See-through pages.** In the app every page is opaque, so the page under a push dims beneath it. On the web the content sits on the live arena backdrop, and the first captures showed both pages' text on top of each other for about 150 ms. The leaving page now fades within the place switch's 119 ms on the exit curve, and the arriving page starts at its 64 ms. Each keeps its own travel: push 28 px, recede 6 px, rise 24 px from 0.97, pop back 28 px. These are overrides below the drawn classes, so the token-derived values (and their test) stay. Trade-off: on the web, push is a directional fade-through more than a card sliding over a card.
3. **The old picture leaves from where it was seen.** Next scrolls the new segment into view during the commit, before the browser takes the new picture. Measured: 218 px, then the shell's own scroll to top jumped it again after the animation. The shell now puts a forward navigation at the top in a layout effect, and offsets the old picture by `--mm-vt-from-y` (new scroll minus old). This avoids a flash of the old page's top and a jump at the end. The back button keeps the router's restored scroll.
4. **The frame is lifted only during arena navigations.** `view-transition-name` on the bar, dock and sidebar is set through `:root:active-view-transition-type(...)`. ThemeToggle's own root transition is unchanged.
5. **Heading focus draws no ring.** The `<h1>` gets `tabindex=-1` and focus after a navigation (first load and `/test` excluded; a page that put focus somewhere on purpose keeps it). It is not a control, so `#app-main h1[tabindex='-1']:focus { outline: none }`.
6. **The float stays alive on the landing.** The finite float is scoped to `.app-shell`. The landing shelf (wt-land2) keeps its living objects.
7. **ObjectLife.jsx was touched (not in the packet's list).** The plan put the re-arm in SubjectObject.jsx, saying it "already observes data-offscreen". That observer and the pointer listeners live in ObjectLife.jsx, a client file, while SubjectObject.jsx has no client code. The change is additive: one helper, the observer's re-entry branch, `pointerenter` and `focusin`. No packet lists ObjectLife.
8. **`.mk-stagger` has no consumer in the arena today.** The class is exported (`MK.stagger`) but no JSX uses it at `8a0141ba`. The primitive is fixed so the next user gets the one-lead pattern. The plan's "/review and /progress" screencast has nothing to show, and those pages are WP-B's or other owners' files.
9. **App copy of T0.** This checkout has no `flutter_app/`. The app's `shared/motion-tokens.json` and `motion_tokens.g.dart` (mockmob-next) still read 720. That is a hand-off to the app pass (AP-1), in the same one-line change. The web test now pins the new hash.

## Open assumptions

- Lighthouse INP on `/today` was not measured: it needs a signed-in production build. The transition adds no main-thread work beyond React's own commit. The added cost is the GPU snapshot of the content box.
- `:active-view-transition-type()` needs Chrome 125+ and Safari 18.2+. Elsewhere the frame is not lifted, and the content can draw over the dock for at most 300 ms.

## Verification (own headless Chrome, shared dev server http://localhost:3181, real `page.mouse.click` and CDP touch)

Captures and strips: mockmob-next `tmp/pass-1016e/wp-a/`. Motion was checked at 0.25x through CDP `Animation.setPlaybackRate`.

| Check | Result |
|---|---|
| Today to Practice, dock, 390 Night, scrolled 1400 px | `mm-place-fwd`; the old page leaves from where it was seen; the bar and dock stay still; focus moves to the new `<h1>` (`scroll-today-practice-strip.png`) |
| Practice to Review, dock, 390 Day | `mm-place-fwd`, dock hit-test true, focus `<h1>`, no white flash (`day390-place-strip.png`) |
| Today to Practice, sidebar, then rise to a result, 1440 Day | `mm-place-fwd` then `mm-rise`; the sidebar and bar stay still (`d1440l-all.png`) |
| Practice to a result and back, 1440 Night | `mm-rise` then `mm-rise-back` (`d1440d-all.png`) |
| Review to Revise and back, 390 Night | `mm-push` then `mm-pop` (back button); after the see-through fix, one overlapping frame instead of about four (`push390d-all.png`) |
| Into the runner (`view=test`) | no `startViewTransition` call, 0 view-transition animations |
| Reduced motion (media query) | type still set; the 120 ms cross-fade rules apply (token test) |
| Saved swipe, 390 touch | at release `fling` from -144 px; 45 ms later -372 px and opacity 0.01; then the fold; the row never comes back (`swipe390-strip.png`) |
| Practice mode radio, 390 Night and 1440 Day | hit-test true, real click sets `aria-pressed`, the dot is at scale 0.68 and opacity 0.79 at 60 ms, then 1 and 1 |
| Arena subject objects, 1440 Day, 15.5 s idle | 4 alive, 0 running animations; the pointer arriving starts `subj-obj-float-a` once |
| Today, 390 Night, 20 s idle | 0 running animations (this fixture has no open day and no live objects) |
| Statics: Today and Practice at 390 and 1440 in Night and Day, plus Progress at 390 Night | 0 horizontal scroll, 0 console errors, no `.rc-step__label` under 12 px |
| `npm run lint` | clean (whole tree) |
| `test:app`, `test:recovery`, `test:learning` | 344, 359 and 302 passed, 0 failed |
| `node --test src/lib/motion-tokens.test.mjs src/lib/motion/motion-pass-1016e.test.mjs` | 18 and 9 passed |
| `npx next build --webpack` | not run here. Free RAM fell to 0.1-0.9 GB several times during this run, and the dev server compiled both the config and the instrumentation file. It is left for the merge gate. |

### Anti-slop test (12 parts) and the 0/1/2 rubric

Motion only, no new surfaces.
- Motion with a reason (10): every transition says direction, and loops end. Score 2.
- One primary action (2): unchanged.
- True content (3): count-ups never invent a figure; the server value paints first. Score 2.
- Accessible interaction (8): focus goes to the heading, reduced motion is honoured, the 12 px floor holds. Score 2.
- What would be better without it (12): the leaving page's long dim. It was removed (decision 2).
- Performance: loops stop after 2 to 4 cycles, and no animation runs at rest on Today or Practice. INP was not measured. Score 1.
- Rubric: task fit 2, IA 2, content truth 2, hierarchy 2, visual specificity 1 (parity with the app, no new art), accessibility 2, states 2 (reduced, failure-return of a swiped row), trust 2, intentional motion 2, performance 1, responsive 2 (390, 1440), instrumentation 0 (none added).
