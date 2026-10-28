# Web pass 1016e: motion and UI/UX (website arena and public result pages)

Written 16 Oct 2026 (evening) by the orchestrator-synthesizer. This is a plan. Nothing is built, pushed or deployed.

## Inputs

- **Prior evidence.** No separate web audit reached this synthesis. The items below come from my own read-only inspection of `deploy/batch-1016c` at `733f61bb` in wt-polish, the newest arena code, plus:
  - the batch 3 critics' measured data (`tmp/1016c-gate/critic-A/report-jobs*.json`: blocked hit-tests, sub-44 px targets, overflow);
  - the landing critic round 6 (`tmp/landing-1016/critic-6/CRITIC-6.json`);
  - `docs/brain/RECONCILE-WEB-2026-10-16.md` (the open low items);
  - parity with the app motion audit (M-numbers).
- **Rules.** As in APP-PASS:
  - AGENT_RULES 1-40 with the T001-T009 and S010-S018 evidence IDs;
  - `ui-ux-standards` s8, s10 and s13;
  - `MOTION.md`;
  - owner taste (one primary action, real denominators, Night/Day parity, 44 px targets, plain copy, 12-hour times, never simplify by cutting).

## Ground rules

1. **Base.** Cut each packet's branch from `deploy/batch-1016c` at its tip, in a new worktree.
   - Batch 3 is the arena's newest state. If you cut from main instead, you would conflict with its RhythmCard, today and progress work.
   - Rebase onto main once batch 3 ships.
   - Do not touch wt-polish, wt-land2, wt-usp, wt-batch4 or wt-e2efix, or their ports: 3101, 3105, 3122, 3150, 3151 and 3160.
2. **Dev server and headless Chrome.**
   - Each packet runs its own dev server with `npx next dev --webpack -p <port>`: WP-A on 3171, WP-B on 3172, WP-C on 3173. Use `/preview/arena?...` fixtures. Never sign in as the owner. Never write to the production database.
   - Visual checks use the packet's own headless Chrome (puppeteer-core): 390x844 and 1440x900, Night and Day, plus 360 and 1024 for layout items. Never open a visible browser, and never use the chrome-devtools MCP.
   - Motion checks use CDP `Page.startScreencast` frames, or `page.screenshot` at a fixed 16 ms step after `Animation.setPlaybackRate(0.25)`.
3. **Next 16.2.4.** It is not the Next you know. Read `node_modules/next/dist/docs/` before code (AGENTS.md). `experimental.viewTransition: true` is documented for this version in `01-app/03-api-reference/05-config/01-next-config-js/viewTransition.md`.
4. **Disjoint files.**
   - No file appears in two packets.
   - The motion tokens (`shared/motion-tokens.json`, `src/lib/motion/tokens.g.js` and the generated `--mm-*` block at the top of `src/app/motion-kit.css`) change only in step T0 (below). Packets must not regenerate them.
   - `src/app/page.js` and the landing components belong to wt-land2 and are hand-offs only.
   - `DashboardPageClient.jsx`, `src/lib/arenaNavigation.js`, `/leaderboard` and `/api/leaderboard` belong to the social build (SOCIAL-SPEC slice 0).
5. **Keep as-is.**
   - The test runner's motion (`practice-run.css`: 240 ms hand-off, the NTA mode with no hand-off). `/test/**` never animates on navigation.
   - ThemeToggle's startViewTransition.
   - The Mobi moments shipped in batch 3.
   - Reduced motion through `data-motion='reduced'` (globals.css 4136-4152).
   - The `mk-press` sink.
   - The `mk-swap` overlap swap.
   - The `.mk-num` remembered-number ink.
6. **Per packet.**
   - A `DESIGN_DECISIONS` note at `docs/design-decisions/pass-1016e/WP<x>-DECISIONS.md` (AGENT_RULES 39).
   - `npm run lint` must be clean.
   - Run the touched suites (`npm run test:recovery`, plus `node --test` on any touched data tests).
   - `npx next build --webpack` must pass.
   - Before and after captures at the four sizes and both themes.
   - Run the 12-part anti-slop test and the 0/1/2 rubric.
   - Hit-test every new or changed control with `elementFromPoint` at its centre, plus a real `page.mouse.click` (standards s10 item 17).

## Step T0 (the orchestrator, one commit, before WP-A and AP-1 start): shared token

- **What.** In `shared/motion-tokens.json`, set `countUp` from 720 to 420 ms (app M15).
- **How.** Run `python tool/gen_motion_tokens.py`. Commit the JSON together with the three generated outputs: `flutter_app/lib/core/motion/motion_tokens.g.dart`, `src/lib/motion/tokens.g.js` and the motion-kit.css variable block.
- **Evidence.** Standards s8 [R-153]; MOTION.md 1.1.
- **Check.** Both token tests pass. `grep -n 'count-up' src/app/motion-kit.css` shows 420ms.
- **Note.** This step replaces APP-PASS AP1-05 as written. AP-1 does not regenerate.

---

## Packet WP-A: arena motion system

**Files (owned only here):**
- `src/app/(app)/AppLayoutClient.jsx`
- `next.config.mjs`
- `src/lib/motion/placeTransition.js`
- `src/lib/motion/useCountUp.js`
- `src/lib/motion/useSwipeCommit.js`
- `src/lib/motion/fold.js`
- `src/app/motion-kit.css`: the hand-written part only, below the generated block
- `src/app/(app)/student-pages.css`
- `src/components/brand/subject-object.css`
- `src/components/brand/SubjectObject.jsx`
- `src/components/study/study.css`
- `src/components/du/du.css`
- `src/app/onboarding/onboarding.css`
- `src/app/brand.css`
- `src/app/(app)/dashboard/practice.css`
- `src/components/ai/prepos.css`
- `src/components/ui/number-ticker.jsx`
- `src/components/ai/RecordGlimpse.jsx`
- `src/components/ai/RecordView.jsx`
- `src/components/profile/YourSheet.jsx`

**Model:** an Opus subagent for WA-01 (page transitions, which are complex motion), Sonnet high for the rest.

### WA-01: the arena's page transitions are drawn but never wired
- **Finding.**
  - `src/lib/motion/placeTransition.js` defines the app's router rules: places fade toward their side, deeper pages push and pop, a result rises, and `/test` never animates.
  - `motion-kit.css` 351-359 draws the classes.
  - Nothing uses them. `transitionTypesFor` is imported nowhere, `AppLayoutClient` has no `<ViewTransition>`, and `next.config.mjs` has no `viewTransition` flag. Every arena navigation is a hard cut, while the app has continuous navigation.
- **Change.**
  - Set `experimental.viewTransition: true`.
  - In `AppLayoutClient`, wrap `children` in `<ViewTransition {...VIEW_TRANSITION_PROPS}>`, imported from React per the Next 16.2.4 guide. Guard it the way `SubjectObject.jsx:31` already does. Pass `transitionTypes={transitionTypesFor(activePath, href)}` on the sidebar, dock and More sheet links.
  - Durations from the tokens:
    - place fade-through: 90 ms out, 210 ms in;
    - push: 300 ms on `--mm-ease-glide`;
    - pop: 220 ms;
    - rise: 360 ms on emphasized;
    - rise-back: 220 ms.
  - `/test/**` and any navigation into it get none.
  - Reduced motion (`data-motion='reduced'` or the media query): 120 ms cross-fade, no travel.
- **Evidence.** Rule 31 (continuity); rule 11 (S016 navigation consistency); MOTION.md 1.1 and C2; app and web parity (owner: Night/Day and app/web behave the same).
- **Acceptance.**
  - Screencast at 0.25x of Today to Practice, Practice to a result and back, and Review to Revise and back, at 390 and 1440, Night and Day. The direction matches the dock order, there is no white flash, and focus moves to the new `<main>` heading.
  - `/test` start shows no animation frame.
  - A unit test for `transitionTypesFor` covers place, push, pop, rise and the test exclusion.
  - Lighthouse INP is unchanged within 10 ms on `/today` (own headless run).

### WA-02 (parity with M15): count-ups start from zero and run up to 1.4 s
- **Finding.**
  - `RecordGlimpse` rolls `from: 0` over 900 ms.
  - `RecordView` takes 800 ms.
  - `YourSheet` rolls `from: 0` over 800 ms.
  - `number-ticker` takes 1400 ms.
  - Each re-mount replays the climb from 0.
- **Change.**
  - The default duration in `useCountUp` and `useCountUpState` becomes `--mm-dur-count-up` (420 ms after T0), on `--mm-ease-out`.
  - Remove the explicit `from: 0` and long durations in the four files.
  - The first ever view rolls from 0. Later views roll from the remembered value (`memoryKey`, which `useCountUpState` already supports). An unchanged value does not roll.
  - Reduced motion: the final value at once.
- **Evidence.** Standards s8 [R-153] ("never delay usable info"); MOTION.md 1.1 (a refresh rolls from the old value).
- **Acceptance.** A unit test of the hook (default 420, no roll when unchanged). The screencast of `/progress` and `/profile` second visits shows no climb from 0.

### WA-03 (parity with M05): ambient loops on resting screens
- **Finding.** Infinite loops on resting content:
  - `student-pages.css:231` `rc-breathe` (2.8 s, the open day dot on the week card);
  - `subject-object.css:121-125` (the float runs forever while on screen);
  - `study.css:321` `sx-stack-breathe` (4.2 s);
  - `du.css:1188` `du-shimmer` (a skeleton with no cap).
- **Change.**
  - `rc-breathe`: `animation-iteration-count: 3`, then rest. Re-arm once when today's dot becomes done (toggle `data-breathe` from RhythmCard's state, set via a CSS attribute only; RhythmCard itself belongs to WP-B, so WP-A ships the CSS hook and WP-B sets the attribute).
  - Subject object float: 2 cycles (`animation-iteration-count: 2`) ending at the rest pose. `SubjectObject.jsx` re-arms one cycle on `pointerenter`, on `focus`, or when it re-enters view after leaving it (it already observes `data-offscreen`).
  - `sx-stack-breathe`: 2 cycles.
  - `du-shimmer`: 4 sweeps, then still (the same rule as the app's MmSkeletonSwitcher).
  - Spinners on real waits (mr-spin, rvs-spin, rb-spin, mr-chk-spin) stay, because they report a live state.
- **Evidence.** MOTION.md 1.1; standards s8 and s10 item 6 [T-024]; R-047 and R-202 (budget phones in a browser).
- **Acceptance.**
  - After 20 s idle on `/today` at 390, `document.getAnimations().filter(a => a.playState === 'running')` holds only spinners or nothing.
  - Captures show the rest pose is the same frame as before.

### WA-04 (parity with M14): scale(0) and tiny-scale entrances
- **Finding.**
  - `du.css:1559` `du-clear-in` from `scale(0)`
  - `onboarding.css:152` `ob-disc` from 0.2
  - `brand.css:101` 0.2
  - `student-pages.css:298` `.pt__dot` from `scale(0)`
  - `practice.css:131` radio dot from `scale(0)`
  - `prepos.css:197, 201` from 0.4
- **Change.**
  - Entrances start at 0.95 with opacity 0, on `--mm-ease-out` over 200 ms.
  - Small marks (radio fill, plot dots, the ink disc) start at 0.6 with opacity 0, on `--mm-spring-icon-pop`.
  - Exits use `--mm-ease-exit` over 150 ms. Nothing uses ease-in.
- **Evidence.** Standards s8 and s10 item 6 [T-105, A-006].
- **Acceptance.** `grep -rnE 'scale\((0|0\.[0-5])\)' src --include=*.css` returns nothing except the landing (a wt-land2 hand-off). Captures of onboarding and DU at 0.25x.

### WA-05 (parity with M13): one stagger for everything
- **Finding.** `.mk-stagger > *` gives every child the same rise at a fixed step, the "identical fade-up on every section" pattern.
- **Change.**
  - `.mk-stagger > :nth-child(1)` rises 14 px over 360 ms on emphasized.
  - Children 2 and 3 fade up 6 px at 60 and 120 ms.
  - Child 4 and later fade in as one group (opacity only, 200 ms, from 160 ms).
  - Add `.mk-stagger--flat`, opacity only, for lists.
- **Evidence.** Standards s8 [T-024, T-112, T-114]; s13 anti-slop item 10.
- **Acceptance.** Screencast of `/review` and `/progress`: one lead rises and the rest arrive together.

### WA-06 (parity with M24): a swiped row hangs, then drops
- **Finding.** `motion-kit.css:252` commits a swipe on `--mm-ease-leave` (0.5, 0, 0.75, 0), a strong ease-in. It ignores the release speed.
- **Change.**
  - `useSwipeCommit` hands the release velocity to `spring.js` and continues the row off-screen on the lift spring (300 ms, bounce 0).
  - `fold.js` then folds the height over 200 ms on `--mm-ease-out`.
  - A tap-initiated removal uses `--mm-ease-out` over 200 ms.
- **Evidence.** Standards s8 [T-103]; apple-design (momentum).
- **Acceptance.** A unit test of the curve choice. Screencast of a Saved swipe at 390 with touch emulation: no pause after release.

---

## Packet WP-B: arena touch targets, overlaps, one primary action and Today copy

**Files (owned only here):**
- `src/app/(app)/arena.css`
- `src/components/start/StartKey.jsx`
- `src/components/start/start.css`
- `src/components/MobileDock.jsx`
- `src/components/RhythmCard.jsx`
- `src/components/LearningNextAction.jsx`
- `src/app/(app)/today/page.jsx`
- `src/components/colleges/MyColleges.jsx`
- `src/components/colleges/colleges.css`
- `src/app/(app)/progress/page.jsx`
- `src/app/(app)/progress/progress.css`
- `src/components/recovery/repair-run.css`
- `src/components/recovery/RunTrack.jsx`
- `src/components/pricing/PriceIncreaseCountdown.jsx`
- `data/tests/no_fake_urgency.test.mjs` (new)

Note: `MobileDock.jsx` conflicts between main and wt-land2 (RECONCILE-WEB section 1). Touch it only if WB-02 cannot be solved in `arena.css`. If you must touch it, tell the orchestrator first.

**Model:** Sonnet high.

### WB-01: the floating Start key covers the answer map on phones
- **Finding.** Critic A (`report-jobs2.json`, `report-jobs5.json`, `result-full-390-*`): answer-map buttons 21 to 30 are hit-blocked by `span.stk__disc` and the dock links at 390 in both themes. A floating control covers the controls (slop item 1).
- **Change.**
  - The result page has its own primary action, so hide the floating Start key on `/result/**`. Use `StartKey` with `hiddenOn={['/result']}`, reading the pathname.
  - Keep the dock.
  - Give the result's scroll container `scroll-padding-bottom: calc(var(--dock-h) + 16px + env(safe-area-inset-bottom))`.
- **Evidence.** Standards s10 items 1 and 17; AGENT_RULES 7 and 32 (a sticky CTA must not conceal content).
- **Acceptance.** At 390 and 360, Night and Day: `elementFromPoint` at each of the 50 bubble centres, after `scrollIntoView({block:'end'})`, returns the bubble. A real click opens its question.

### WB-02: the dock covers primary CTAs at the bottom of a page
- **Finding.** Critic A shows these blocked at 390 and 360: "Start 10 practice questions" (Today), "See your full record" (Today 360) and "Start" (Progress met week).
- **Change.**
  - `.app-shell main` gets `padding-bottom: calc(var(--dock-h, 64px) + 24px + env(safe-area-inset-bottom))` below 768 px.
  - Every primary CTA gets `scroll-margin-bottom` with the same value.
- **Evidence.** AGENT_RULES 32; standards s10 item 1.
- **Acceptance.** The same hit-test at the page end for each named CTA, at 360, 390 and 412.

### WB-03: the "Edit" link is 25 px wide
- **Finding.** Critic A, Today at 360, 390, 1024 and 1440: "Edit" is 25x44 (`MyColleges.jsx:58`, `.mc-link`).
- **Change.**
  - The text becomes "Edit colleges", so the purpose is clear out of context (rule 11).
  - Size: `min-width: 44px; min-height: 44px; padding-inline: 10px; display: inline-flex; align-items: center`.
- **Evidence.** S016 (WCAG 2.2 target size); AGENT_RULES 30 and 36; owner rule of 44 px.
- **Acceptance.** The target audit shows 0 sub-44 controls on `/today`.

### WB-04: the met week is told three times, and "Welcome back" twice
- **Finding.** RECONCILE-WEB lows.
  - On Today with a met week, `LearningNextAction` (`moment={weekGoal}`), `RhythmCard` (`quietMet`) and a Mobi line each announce the met week.
  - "Welcome back" appears twice on the returning path.
- **Change.**
  - `LearningNextAction` alone owns the met-week sentence.
  - `RhythmCard compact quietMet` shows only the ring and "4 of 4 study days", with no sentence.
  - Mobi's line moves into `LearningNextAction`'s one Mobi slot (one Mobi per screen).
  - "Welcome back" stays only in `RhythmCard`'s returning state.
  - WP-B sets `data-breathe` for WA-03 on the open day dot.
  - Count-ups: `RhythmCard` (900 ms from 0) and `LearningNextAction` (900 ms from 0) use the hook default and their memory key (as WA-02).
- **Evidence.** PR question 2; ledger L28 (no filler); MOTION.md 1.3; standards s8.
- **Acceptance.** `/preview/arena?view=today&data=met`: a text search finds the met sentence once and "Welcome back" at most once. Captures at 390 and 1440, Night and Day.

### WB-05: two lime Start keys in one viewport
- **Finding.** Progress met-week (critic-B `after-progress-met-labels-*`): the card's "Start" and the floating Start key are both volt.
- **Change.**
  - One volt per viewport. The in-card action becomes the outline button with a specific label: "Start 10 Accountancy questions", from the server's next move.
  - The floating key keeps the volt.
- **Evidence.** AGENT_RULES 7; standards s13 (specific CTAs, T003).
- **Acceptance.** A script counts `.btn-volt, .stk` elements in the viewport at each scroll stop. The count is 1 or less.

### WB-06: labels under 12 px
- **Finding.** `arena.css` 703, 809, 922, 1175, 1398 and 1423 are 11 or 11.5 px. `student-pages.css` 148 and 271 are the same, but that file belongs to WP-A, which applies the same change there.
- **Change.** 12 px minimum, line-height 1.3. Where a row then wraps at 360, let it wrap to 2 lines rather than shrink.
- **Evidence.** DESIGN-CRITIC #23 (12 px floor); AGENT_RULES 36 (text zoom).
- **Acceptance.** A computed-style sweep of visible text on `/dashboard`, `/progress` and `/today` at 360: nothing under 12 px except decorative tick numerals.

### WB-07: the NTA palette preview blinks forever
- **Finding.** `arena.css:1332`: `pr-nta-blink 5s infinite` on the Practice page's NTA console preview.
- **Change.** 2 cycles, then still. Reduced motion: none. It is a preview, not a live state.
- **Evidence.** Standards s10 item 6.
- **Acceptance.** After 12 s, the running animations on `/dashboard` hold no `pr-nta-blink`.

### WB-08: the sticky repair header is tall (verify first)
- **Finding.** A RECONCILE-WEB low. The batch 3 fixer touched `repair-run.css` (+23 lines).
- **Change.** If the header is still over 72 px at 390 with the run open, collapse it on scroll to one 48 px row: chapter, then "3 of 6", then the close control. The full header returns at the top.
- **Evidence.** AGENT_RULES 32; standards s3.
- **Acceptance.** Capture at 390 with the run scrolled: header height 56 px or less, and the question stem visible above the fold.

### WB-09: guard against fake urgency
- **Finding.** `src/components/pricing/PriceIncreaseCountdown.jsx` is a live price-increase countdown. Nothing imports it today.
- **Change.**
  - Do not delete it (it is not a feature cut, but the owner decides).
  - Add `data/tests/no_fake_urgency.test.mjs`. It fails if any file under `src/app` or `src/components` imports `PriceIncreaseCountdown`, or renders a countdown next to a price without a real dated source.
- **Evidence.** AGENT_RULES 21 and 22 (T005, T009).
- **Acceptance.** The test passes now, and fails on a planted import.

---

## Packet WP-C: Mistake Lab truth and hierarchy (server copy shared with the app)

**Files (owned only here):**
- `data/mistake_lab.copy.json`
- `data/mistake_lab.js`
- `data/tests/fixtures/mistake_lab/*.json`
- `data/tests/mistake_lab*.test.mjs`
- `src/components/ScoreRecoveryLab.jsx`
- `src/components/result/MarksLedger.jsx`
- `src/components/result/marks-ledger.css`
- `src/components/result/TimeDecisions.jsx`
- `src/components/result/time-decisions.css`
- `src/components/result/Replay.jsx`
- `src/components/result/replay.css`
- `src/components/result/OthersAnswered.jsx`
- `src/components/recovery/result.css`

The app (APP-PASS AP3-03 and AP3-04) renders the server strings this packet produces. Ship WP-C first, then AP-3 tests against WP-C's fixture.

**Model:** Sonnet high, then an Opus critic for WC-03.

### WC-01 (parity with A07): defensive method paragraphs
- **Finding.**
  - `mistake_lab.copy.json:102` (`fineReady`, "Time and picks come from your device's record...") and the cohort sentence at line 152 render as grey paragraphs that close the Lab.
  - The owner banned this sub-remark pattern on 15 Oct.
- **Change.**
  - Move the method sentences into a `method` block in the copy JSON, rendered in a disclosure: one 44 px row, "How this is counted", that opens in place over 200 ms with `mk-swap`.
  - Keep one in-flow truth line after the cohort line: "(answers from 10 or more students)".
  - The API sends `method` as its own field, so the app can show it in a sheet.
- **Evidence.** OWNER-VISION-2026-10-15-PM; DESIGN-CRITIC #8; AGENT_RULES 10 (S014).
- **Acceptance.**
  - A contract test that `method` is present and that the body copy has no method sentences.
  - A capture of the Lab end at 390: no paragraph block.

### WC-02 (parity with A08): changed-answer numbers that fight
- **Finding.** The "Right, then changed" row says 12 marks on 2 questions, and the box says "Changing answers cost 5 marks over 5 questions". "Your first picks, re-marked: 144" and "Your final answers: 139" have no denominator.
- **Change.** The builder emits one net object `{lost:{marks,questions}, won:{marks,questions}, net}` and the copy:
  - "Changing answers: lost 12 marks on 2, won back 7 on 3. Net cost 5 marks."
  - "First picks: 144 of 245. Final answers: 139 of 245 (1 question under re-check left out of both)."
  - The denominator is the paper's maximum minus re-check exclusions, from the server.
- **Evidence.** The owner's rule of real numbers with denominators; AGENT_RULES 9 and 29; standards s10 item 13.
- **Acceptance.** A fixture test that lost minus won equals net, and that both re-mark figures carry the same denominator. Captures in both themes.

### WC-03 (parity with A09 and A10): Lab hierarchy and targets on the web
- **Change.**
  - Hero: the missed marks at the result's display size (64 px at 1440, 48 px at 390, condensed, tabular) with "marks missed, of 250" at 16 px.
  - "Mistake Lab" becomes a 13 px ink-2 eyebrow (sentence case, not all caps).
  - The ledger bar grows to 12 px with 2 px gaps.
  - Clicking a segment scrolls to its row (300 ms, glide; instant under reduced motion) and lifts the segment 2 px.
  - Replay and question chips: 44 px minimum hit height.
  - `.rpl-chip` wraps inside 390. Critic A measured right edges at 430 and 614 px. Verify whether the batch 3 fixer's `replay.css` edit cured this.
- **Evidence.** AGENT_RULES 9, 25, 28, 30 and 36; S016; owner direction (HIGH and Revolut hierarchy).
- **Acceptance.**
  - The `wide` list is empty at 390, using the critic-A probe script reused from `tmp/1016c-gate`.
  - Every chip is 44 px or more.
  - A capture comparison before and after.

### WC-04 (parity with A11): arrows appended to link text
- **Change.** Remove `→`, `->` and chevrons appended to text in the Lab and result components this packet owns. Keep the direction cue in the press motion (`mk-press`).
  - Check `web/copy-1016` (unmerged; it did an arrow pass over 22 files) first. Cherry-pick its hunks for these files instead of redoing them.
- **Evidence.** Standards s10 item 11.
- **Acceptance.** `grep -rn '→\|->' src/components/result src/components/ScoreRecoveryLab.jsx` finds nothing in rendered strings.

---

## Hand-offs (not in a packet)

- **To wt-land2 (landing).** Do not edit these here.
  - `src/app/page.js:51` lists "Leaderboard". Lines 122-124 promise "Every mock earns points for accuracy and speed on the leaderboard". That conflicts with the leaderboard privacy fix (SOCIAL-SPEC slice 0) and with "no fake dashboards".
  - The wording becomes "Benchmarks: race a set target score against the clock" and drops the leaderboard promise.
  - A calm Mob section follows only after owner decision D-S1.
  - The landing's remaining items (page-load weight, critic round 7 verdict) stay with wt-land2.
- **To batch 3 (wt-polish).** None. This pass builds on its tip.

## Order and pace

1. T0, the token commit, about 10 min.
2. WP-A, WP-B and WP-C in parallel, on ports 3171, 3172 and 3173.
3. Merge WP-C first, because AP-3 depends on its fixture. Then WP-B, then WP-A last, because page transitions change the feel everywhere and need the final critique.
4. Gate per merge: the own-headless critique at 390 and 1440, Night and Day, and a hit-test sweep of every changed page. No deploy without the main session's go.
