# Design decisions: Mobi at real moments on the website (builder W1, 16 Oct 2026)

Branch deploy/batch-1016c (worktree wt-polish). Owner rule: Mobi at most once per screen, only at a real moment, with the rig's existing acts (rig v2, `data/mobi_rig.v2.json`); motion answers an action or shows state; reduced motion respected. Evidence IDs are from docs/research/premium-ux-ui-2026-10/source-ledger/EVIDENCE_INDEX.csv. Progress, Review and Radar belong to builder W2; the landing is not in scope; the repair check ("Check it held", `src/components/repair/RepairCheck.jsx`) is not on this branch and was not touched.

## The user task

A student finishes something on the arena (a Revise run, a rule choice, a mock's rule check, a week of study days) and wants to know, in one glance, that it counted. Mobi is the product's character; where he appears he should mean "this just happened", and where nothing happened he should not be there.

## Audit (every arena screen, ready, empty and error, at 390 x 844 Night, DOM count of `.mobi-react`)

| Screen | Before | Verdict |
|---|---|---|
| Practice (dashboard) | one companion, hello once a day, think while launching, oops on a refused start | kept |
| Session runner | submit sheet only (read, nod, point, tilt); none in a mock or NTA | kept |
| Result | hero reacts to the recap tone; reader Mobi on an opened answer (hero held still); repair Mobi | kept; rule kept had no reaction (fixed) |
| Today | companion: hello once a day, think, tilt, oops | week goal met had no reaction (fixed) |
| Revise | no Mobi at all: no reaction to a recalled or retired card, no ending, plain icon on failure | fixed |
| Rule book | no Mobi: no reaction to a confirmed choice, empty book and failed load were icon or text only | fixed |
| Recovery (Check one reasoning gap) | empty and error states had no figure | fixed |
| Explore, Saved, Ranks, My uploads, Compass, Learn, Onboarding | one Mobi per state, each tied to an answer, a save, an empty or failed state | kept |
| Account | two instances in the DOM, but the sheet one is hidden while Look and feel is on screen (lookMobiStore); never two in view | kept |
| Ask Mobi, Contribute, Rival | none | Rival result left for later (see open items) |

No screen showed two Mobis in view. The gaps were moments with no reaction.

## What was built

1. `src/lib/mobiScreens.js`: the moments map (`SCREEN_MOMENTS`, screen by moment to act) and the pure rules: `reviseAnswerAct`, `reviseEndAct` (the app's runMood), `ruleCheckAct`, `weekGoalAct`, `weekCheerKey`, `aloneInView`. Every act is one the rig already has (tested).
2. `src/components/brand/MomentMobi.jsx` (+ `moment-mobi.css`): one fixed slot that plays its act when it comes into view; with `alone` it plays only when no other Mobi is in view, otherwise the slot keeps its icon.
3. Revise (`ReviseRun.jsx`): a 52 px Mobi beside a graded answer: hop for right, lean for a miss, proud when the card leaves the rotation ("Right again. This one is done."). Celebrations Full only, one per 2.5 s, the same rule as Learn's FeedbackMobi. The end of a run: an 88 px Mobi in proportion to what was recalled (4 of 4 cheer, 0 of 4 encourage, all of 5 or more celebrate). Nothing due: one resting figure. Failed load: the shared FailedMobi (one shrug per run, calm on retries) replaces the error icon.
4. Rule book (`RuleBook.jsx`): one nod in "Your rule for your next mock" only after the server confirmed a choice made on this visit; a resting figure there while the book is empty; FailedMobi on a failed load.
5. Rule check on the result's Lab (`RuleCheck.jsx`): kept is proud, not kept a lean of encouragement, in place of the icon, when the check scrolls into view and only if the hero is off screen. Counted and not checked keep their icons.
6. Today (`today/page.jsx`, `LearningNextAction.jsx` `moment` prop): when the server says the week's goal is met, the companion is proud once per week on this device (the same `mm:rhythm-cheer:<week>` key the Progress week card writes, so a week is never cheered twice) and its title says "Week goal met: 4 of 4 study days."
7. `ArenaCompanion.jsx`: a companion's once act (hello, proud, oops) now waits until he is in view, so on a phone, where the plan pushes him below the fold, the moment is not spent off screen; once played it stays played. Held states (think, loading, sleep) show at once.
8. Recovery journey: FailedMobi on a failed load, a reading figure on "Nothing to review yet".

## Alternatives considered, and why not

- A toast or confetti for a retired card or a met week. Rejected: motion must answer the action in place (AGENT_RULES 31); a toast competes with the result line, and confetti is decoration with no state in it.
- Mobi on every Rule book row or always in the NowCard. Rejected: a standing figure with nothing happening is "Mobi with no reason"; he arrives only with the server's confirmation or as the empty state's one figure.
- A second, smaller Mobi in the rule check while the result hero is on screen. Rejected by the one-in-view rule: the largest wins and the slot keeps its icon (`aloneInView`, tested).
- Playing the week-goal cheer in the compact week card on Today. Rejected: the compact card has no Mobi by design (Today already has its companion), and the companion is the largest instance.
- Re-fetching nothing and reading the week from RhythmCard. Not done because RhythmCard is being edited by builder W2 in this worktree; Today makes one small extra GET to `/api/me/rhythm`. To fold into one read when the card is free.

## Evidence IDs

- T002 / S015 (honest progress): Mobi reacts only to what the server confirmed (a graded answer, a saved rule, a week the server called met). Nothing plays before the response, and a failure never shows success.
- S014 (progressive disclosure): the moments live inside the surfaces the student is already using (the result line, the end card, the rule card); no new panels.
- S016 (WCAG 2.2): Mobi is decorative where the words beside him say the same thing; the end line is a status region; no meaning is carried by motion alone; reduced motion draws his still pose (verified: `data-live="false"` under `prefers-reduced-motion: reduce`).
- S017 / S018 (slop is missing intent): every instance answers a named moment in `SCREEN_MOMENTS`; no idle mascots added for decoration.
- AGENT_RULES 9 and 29: the met-week title carries its denominator ("4 of 4 study days").

## States

| Surface | State | Behaviour | Verified |
|---|---|---|---|
| Revise card | right / missed / retired | correct / encourage / proud beside the line (Full only, 2.5 s gap) | real clicks, all four cards: correct, correct, correct, proud |
| Revise end | 4 of 4 / 0 of 4 | cheer / encourage, then standing | real clicks through the run |
| Revise | nothing due, failed | rest, one shrug then calm | `revise=empty`, `revise=down` |
| Rule book | confirmed choice, empty, failed | one nod (after the server), rest, shrug | real click on "Use in my next mock"; `data=empty`; `rules=down` |
| Result Lab | kept, not kept, hero in view | proud / encourage; icon stays when the hero is in view | `mock=full&rulecheck=kept`; 390 Day case kept the icon with the hero in view |
| Today | week met, first visit, below the fold | proud once per week; plays only when scrolled into view | `rhythm=met`, sampled acts after scrolling: proud |
| Recovery | no record, failed | read, shrug | `data=empty`, `data=error` |
| All | Celebrations Quiet / Off, Reduce motion | MobiReact's own mapping (nod / nothing / still pose) | reduced-motion run: `live=false`, still pose |

## Verification

- Captures at 390 x 844 and 1440 x 900, Night and Day, with real pointer clicks through the dev-only `/preview/arena` fixtures (own headless Chrome over CDP, dev server port 3180). Every capture was looked at. No horizontal overflow on any capture. Representative before/after pairs are in `docs/design-decisions/captures-web-mobi-1016/`.
- `node --test data/tests/mobi_moments.test.mjs`: 23 pass (9 new: the map, one per screen, and the one-in-view rule).
- `npm run test:app` 337 pass; `npm run test:learning` 277 pass; `npm run test:recovery` 281 pass.
- eslint clean on every touched file.

## Rubric (0/1/2, internal checklist; the owner signs off)

Task fit 2, information architecture 2, content truth 2, readable hierarchy 2, visual specificity 2, accessibility 1 (no screen-reader run), functional states 2, trust 2, intentional motion 2, performance 1 (one extra GET on Today), responsive integrity 2, instrumentation 0 (no event for moments yet).

## Open items

- Rival result (win, tie, loss) is a real result reveal with no Mobi; the screen is the legacy Rival layout and was not reachable through a fixture here.
- Contribute: a question saved for checks could earn a nod; not done.
- Under Reduce motion a companion's proud or hello (non-reaction acts) report done at once, so Today shows him standing rather than holding the proud pose; the title carries the moment. A MobiReact-level change, left to the rig owner.
- Fold Today's week read into RhythmCard's once W2's edits land.
