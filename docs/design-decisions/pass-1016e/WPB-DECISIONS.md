# WP-B decisions: arena touch targets, overlaps, one primary action, Today copy (pass 1016e)

Branch `web/ux-social-1016` in wt-webux2, built 16 Oct 2026 (night) on `8a0141ba`. Plan: `docs/design-decisions/pass-1016e/WEB-PASS.md` (packet WP-B). Nothing is pushed or deployed.

Evidence IDs are from `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (rules R1 to R40, T001 to T009, S010 to S018) and the owner's `ui-ux-standards` (s8, s10, s13).

## User task

A student on a phone opens Today, Progress or a result. They need to see the one thing to do next and reach every key without the tab bar or a second bright key getting in the way.

## What was measured first (before)

One headless Chrome reused across all pages, on the shared dev server :3181, at 360, 390, 412, 1024 and 1440, Night and Day. The probes are in `tmp/pass-1016e-wpb/probe*.mjs`. The captures and JSON are in `tmp/pass-1016e-wpb/before` and `tmp/pass-1016e-wpb/after`.

- **Result answer map (WB-01).** All 50 bubbles at 360 and 390, both themes, pass `elementFromPoint` after `scrollIntoView({block:'end'})`, and a real click lands. The batch 3 `scroll-padding-bottom: 100px` already cured the critic-A finding.
  - A gap remains on phones with a home indicator. The bar grows by `env(safe-area-inset-bottom)` (34 px on an iPhone), but the clearance did not grow with it. The Start disc then reaches about 118 px above the bottom edge, past the 100 px clearance.
- **Today CTAs (WB-02).** "Start 10 practice questions", "See your full record", "See your weeks and milestones" and "Edit" all hit-test clean at 360, 390, 412 and 1440.
- **"Edit" (WB-03).** Already 44 x 44 after the batch 3 fixer, but the word alone does not say what it edits.
- **Met week (WB-04).** Today with a met week: the met sentence appears once on the first visit (in the plan card's Mobi moment) and once on the second (in the week card). "Welcome back" appears once on the returning path on Today and on Progress. The copy rule already held; nothing to remove.
- **Two volt keys (WB-05).** Progress showed the card's volt "Start" with the volt Start key at every scroll stop, at all sizes. Today showed the plan's volt key with the volt Start key at every stop.
- **Labels under 12 px (WB-06).** `.pill`, `.badge`, the MockMob runner chips, `.pr-badge` ("In review" and others on Practice), `.cpro-paper__val small` and `.cpro-target__rounds dt` were 11 or 11.5 px. `.rc-step__label` is WP-A's file.
- **NTA preview blink (WB-07).** It ran forever.
- **Repair header (WB-08).** At 390 with the run open and scrolled, the sticky line is 45 px (`.rt__head`), and "Finish for now" hit-tests clean. That is under the 56 px bar, so no change was made.
- **Progress foot link.** "Change your study days" at 360 wrapped across two lines; its centre fell between the halves (blocked by `P.rc__foot`). At 390 it measured 136 x 17.

## Changes

| Item | Change | Evidence |
|---|---|---|
| WB-01 / WB-02 | `--dock-h: 84px` (the 64 px bar plus the Start disc standing 19 px above it). Below 1024 px: `scroll-padding-bottom: calc(var(--dock-h) + 16px + env(safe-area-inset-bottom))`; Practice's session dock adds 88 px; `main` gets `padding-bottom: calc(var(--dock-h) + 24px + env(safe-area-inset-bottom))`. No `scroll-margin-bottom` on the keys, because it would add to the scroller's padding (200 px). | R32; s10 items 1 and 17 |
| WB-01 (deviation) | On a result, the dock's Start key is **quieted, not hidden**: an outlined disc with an ink mark, exactly as Practice already does under its session dock. The plan called it a floating key, but it is the third of the dock's six places. Hiding it would reflow the bar and move the sliding pill on one page only. The overlap itself is solved by the clearance above. | R11 / S016 (navigation consistency); R7 |
| WB-03 | "Edit" becomes "Edit colleges". `padding-inline: 10px` with a matching negative end margin, so the word stays flush with the card edge, and `white-space: nowrap`. | R11, R30, R36; S016 |
| WB-04 | No copy change; the measurement shows the rule already holds. The count-ups are now on the token: `RhythmCard`'s ring had 900 ms from 0 on every mount; it is now `useCountUp(value, { from: 0, memoryKey: 'rc-week-days' })` (one memory shared by Today and Progress) and starts when in view, holding the remembered figure until then. `LearningNextAction`'s `Rolled` drops `duration: 900` and `MinutesRoll` drops `duration: 520`, so both use `durations.countUp` (420 ms after T0). | s8 [R-153]; MOTION.md 1.1 |
| WB-04 / WA-03 hook | `data-breathe='true'` goes on today's day when it has just turned counted (a study day counted since this device last saw the week) and is on screen. This matches WP-A's CSS contract (`rc-breathe-once`, one breath). It is verified: it is set once, then absent on the next visit. | MOTION.md 1.1; s10 item 6 |
| WB-05 | The compact next-step card (Progress, Review, Radar) always uses the **outline** key. Its label is the server's own step title ("Start 10 practice questions", "Take your fresh check"), not "Start". The line reads "Your next step: 10 questions, about 10 minutes." (`text-wrap: pretty`). The plan's example "Start 10 Accountancy questions" was not used: the server's ordinary-practice step names no subject, and the page must not invent one. | R7, R18; s13 (T003 specific CTAs); R5 |
| WB-05 (Today) | The same one-volt rule on Today. `LearningNextAction` marks the hero `data-cta-shown` while its plan key is on screen and clear of the tab bar (`useInView`, `once: false`, threshold 0.6, bottom margin -84 px). Then the dock's Start key (phones) or the sidebar key (1024 px and up) steps back to an outline. Elsewhere on the page, including the first phone viewport where the plan key sits below the fold, the Start key stays volt, so a volt action is always on screen. The disc changes colour over 200 ms and never moves. Reduced motion keeps only the colour change. | R7, R31 |
| WB-06 | Six rules in `arena.css` go to 12 px with line-height 1.3. Nothing is clipped at 360, and wrapping is allowed. | DESIGN-CRITIC #23; R36 |
| WB-07 | `pr-nta-blink` plays 2 cycles, then stops. Reduced motion shows no blink, under both the media query and `data-motion='reduced'`. | s10 item 6 |
| WB-08 | Verified only: 45 px, no change. | R32 |
| WB-09 | `data/tests/no_fake_urgency.test.mjs`. It fails if anything under `src/app` or `src/components` renders `PriceIncreaseCountdown`, or ticks a countdown beside a price with urgency words, without an `urgency-source: YYYY-MM-DD <who>` line. It proves itself on planted cases: an import, a require, a fake offer, a bad date, and a plain timer that must pass. The component is kept, because deleting it is the owner's call. | R21, R22; T005, T009 |
| Extra (same rule as WB-03) | Progress's "Change your study days" never breaks mid-link and gets a 44 px tall tap area through padding with an equal negative margin, so the sentence does not move. | S016; s10 item 17 |

## Alternatives considered

- **Hide the Start key on `/result`** (the plan). Rejected for navigation consistency (see WB-01 above).
- **Make Today's plan key outline instead of quieting the Start key.** Rejected. The plan key is the page's purpose; the Start key is shell chrome.
- **Quiet the Start key on Today at all times.** Rejected. At 360 and 390 the plan key is below the fold, so the first viewport would have had no volt action.
- **Add `scroll-margin-bottom` to every CTA** (the plan). Rejected, because it compounds with the scroller's padding.

## Trade-offs and assumptions

- The Start key's colour now depends on the page (Practice, Today, result). Practice set this precedent. Its shape and place never change.
- `--dock-h: 84px` assumes the bar row (5 + 54 + 5 px plus the border) and the disc's 15 px rise plus its 4 px ring. If the bar's height changes, update the variable.
- `MobileDock.jsx` was not touched.
- `package.json` is not WP-B's file, so the new test is not yet listed in a suite script. Run it with `node --test data/tests/no_fake_urgency.test.mjs`, or add it to `test:app` at merge.

## Verification (after)

- **Progress, met week.** Volt count is 1 or less at every scroll stop, at 360, 390, 412 and 1440, Night and Day. The card key is "Start 10 practice questions" (outline) and hit-tests clean. The foot link hit-tests clean at 360, and there are 0 sub-44 targets.
- **Today.**
  - **Volt colour.** Phones: the dock disc is volt (rgb 210 240 0) at the top, Night `rgb(19,26,22)` and Day `#fff` (quiet) with the plan key in view, and volt again at the page end. 1440: the sidebar key is transparent while the plan key shows and volt after scrolling past it.
  - **Start sheet.** A real click on the quiet key opens the Start sheet (display `flex`) on all four views.
  - **Other checks.** All four CTAs hit-test clean at 360, 390, 412 and 1440. 0 sub-44 targets, no text under 12 px, no horizontal scroll. "Edit colleges" is captured at 1440 Day.
- **Result.** All 50 bubbles hit-test clean at 360 and 390, Night and Day. The dock sits at the bottom edge (779 to 844 of 844), and bubble 30 ends 35 px above it. The dock key is quiet (Night `rgb(19,26,22)`, Day `#fff`), and the 1440 sidebar key is quiet.
- **Practice.** 0 text under 12 px at 360, 390 and 1440. After 12 s idle at 390 Day, no running animations.
- **Breathe hook.** On Today (390 Night) and Progress (1440 Day), with one counted day newer than the device's record, `data-breathe` is on "Today, Fri 16, counted", `rc-breathe-once` runs, and on the next visit it is absent.
- **Checks.**
  - `npm run lint`: clean.
  - `test:app`: 344/344. `test:recovery`: 359/359. `test:learning`: 302/302.
  - `node --test data/tests/no_fake_urgency.test.mjs data/tests/rhythm_view.test.mjs data/tests/my_colleges.test.mjs`: 33/33.
- **Not run.** `npx next build --webpack`. The shared dev server :3181 is serving this same worktree, and the PC is short of RAM: free memory fell to 250 to 700 MB during the run, while other agents were working. Build at merge.

## 12-part anti-slop test

1. **Identity.** Unchanged: MockMob's volt key, Mobi and the Night Arena tokens.
2. **One primary action.** Pass: one volt per viewport on Progress, Today and the result. The Practice exception was already documented.
3. **True content.** Pass: the card names the server's real step, and no subject is invented.
4. **Hierarchy.** Pass: the step sentence comes first, then the named key.
5. **Composition.** Pass: the clearances are derived from the bar's measured reach.
6. **Typography.** Pass: a 12 px floor, wrapping allowed.
7. **States.** Unchanged: loading, error and retry are kept in both cards.
8. **Accessible interaction.** Pass: 44 px targets, hit-tests and real clicks, reduced motion.
9. **No pseudo-evidence.** Pass: the urgency guard test.
10. **Motion rationale.** Pass: the colour hand-off answers the plan key appearing, and the breath answers a newly counted day.
11. **Measured usability.** Not instrumented in this packet. Proposed: plan-key starts per Today visit as the lead metric, with Start-sheet opens from Today as the guardrail.
12. **Human critique.** Nothing decorative was added.

## Rubric (0/1/2)

Task fit 2, IA 2, content truth 2, hierarchy 1, visual specificity 1, accessibility 2, states 1, trust 2, motion 2, performance 1, responsive 2, instrumentation 0.

- Hierarchy, states and performance score 1 because they are not validated on a device, and the build was not run.
- The owner signs off.
