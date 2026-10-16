# Rival result reveal with one Mobi moment (web, 16 Oct 2026)

Branch `web/rival-mobi-1016`. Follows `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` (rule 39 format). Evidence IDs
(T00x, S0xx) are the research pack's; rules are quoted by number.

## User task

A student has just submitted a Rival benchmark (`/rival`, `AIRivalArena` `ResultScreen`; the result is drawn in place, there
is no separate result route). They want three answers in this order: did I beat it, by how much and where, what do I do now.
Before this change the whole result appeared at once, with no Mobi, an ALL-CAPS mono label on the score card and an
accuracy figure with no denominator.

## Decisions

1. **Reveal order is the numbers first.** Four parts land in a fixed order (`src/components/ai/rivalReveal.mjs`): the score
   (0 ms), the comparison (320 ms, three stats staggered 50 ms), Mobi's reaction (760 ms), the next move and its buttons
   (1060 ms). Every part enters once in 280 ms on the Arena's ease-out (`--a-ease`), opacity and an 8 px rise; the score
   settles from `scale(0.96)` instead of rising, because the eye is already there. The screen is in place by about 1.35 s.
   (Rule 8: rank by what helps the student decide next; rule 31: motion shows a state change.)
2. **Interruptible.** The parts are CSS transitions on a `data-in` attribute, not keyframes, so a tap or a key during the
   reveal lands everything at once and each part retargets from where it is. A part that has not landed is `inert`, so no
   button can be pressed or focused before it is visible.
3. **One Mobi, at the real moment, never over the numbers.** He is mounted only when his part lands (after the comparison),
   in a box reserved from the start beside the next move, so nothing shifts when he arrives and he never covers the score or
   the stats. The act answers the outcome the server returned: a win is `cheer` (happy), a loss is `encourage` (calm, the
   same beat the mock result page uses after a lower score), a dead heat is `tilt` (curious: a draw is a question, not a
   verdict). Each is a once act from the web rig v2 (`MobiReact`); when it ends he stands still, with no idle loop. An
   unknown outcome shows no Mobi. No other Mobi figure is drawn on this screen (the assistant launcher is the PrepOS orb).
4. **Settings.** Celebrations Quiet turns the win cheer into a nod; Off leaves him standing still. A loss or a draw is never a
   celebration, so the setting does not change them. Reduce motion (device or the student's own) draws every part in place
   and Mobi as the act's still frame.
5. **Night and Day.** The Rival console is a dark island in both themes (`arena.css` `.arena-dark-island`), so the reveal
   colours stay on Night Arena tokens and Mobi's light is pinned to Night; in Day the page around the console changes and
   the console does not.
6. **Real numbers with denominators.** "Your accuracy" now carries "7 of 10 answered right, 2 skipped" from the server's own
   counts, or nothing when the counts are missing (never an invented denominator). The benchmark is labelled a simulated
   benchmark; your time sits beside the benchmark's time. (Rule 29, rule 9.)
7. **Slop removed on the touched surface.** The score card's ALL-CAPS mono label and the "Benchmark result" mono eyebrow are
   now sentence-case text; "Next move" is a real heading; the stats are one list on a phone and three panels from 768 px,
   with no icon tiles. (Standards section 10.)

## Alternatives rejected

- Mobi in the score card, reacting as the score lands: puts him on the numbers and before the comparison.
- A looping idle Mobi after the act: a loop for show, against the brief.
- Keyframe stagger: restarts on interruption and cannot be landed with a tap.

## Preview

`/preview/arena?view=rival&battle=win|loss|tie` plays an illustrative benchmark end to end (labelled practice rival, fixed
illustrative scores, nothing scored or charged) so the reveal can be seen without a live benchmark.

## Verification

- `node --test data/tests/rival_reveal.test.mjs` (order, timings 150-350 ms per part, the acts are once acts and never held,
  Celebrations levels, the accuracy denominator) plus `rival_submission`, `mobi_rig`, `mobi_moments`: 40 of 40 pass. `npm run test:learning`: 307 of 307 pass.
- `npx eslint` on the changed files: clean.
- Not verified in a browser: the dev server on port 3190 was started with 3.1 GB free, but free RAM fell to under 1 GB while
  `/preview/arena` compiled and the headless Chrome was closed before the page loaded, so the server was stopped. The visual
  check (390x844 and 1440x900, Night and Day, frames during the reveal) is left to the batch gate.

## Unresolved

- The Rival shell above the result still has a mono ALL-CAPS "Daily pressure loop" pill; it is shared by every Rival screen
  and is outside this change.
