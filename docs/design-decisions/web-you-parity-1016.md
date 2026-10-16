# Website parity for the You tab: badges and personal bests (16 Oct 2026)

Owner rule: every feature for the app and the website together. The app's You tab is being rebuilt with a 16-badge set, three personal bests and the week as "3 of 4 study days" (`docs/design-decisions/app-you-1016.md`, sections 3 and A.2). This note records the website half. Branch `web/parity-you-1016`.

## User task and success test

The student opens Progress to see how their study is going: which badges they hold and when, what each locked one needs, and their best marks, longest run and fastest right answer, each with a date or a denominator. Success: every figure is a real record, nothing shows earned without a date (or proof), nothing shows locked on a guess.

## Where it lives

The website's You surface is Progress (`/progress`, `RhythmCard`). The old "Three paths" block (9 steps) is replaced by the app's four paths and 16 badges, then Personal bests follows. Account (`/profile`) stays settings. Nothing is cut: the nine steps are all still badges, with the same dates.

## Shared rules (one module, node tests)

`src/lib/studyBadges.js` is a pure port of the app's `badges.dart`, `derived_badges.dart`, `milestone_tracks.dart`, `milestone_progress.dart`, `fastest_answer.dart` and `badge_record.dart`. `data/tests/study_badges.test.mjs` repeats the cases of the app's `derived_badges_test.dart`, so one set of attempts gives the same badges on both.

- Server milestones: 9 ids from `/api/me/rhythm`.
- Derived from the complete attempts list, server-scored only, each dated by its own `completedAt`: `first_nta`, `full_mocks_5`, `clean_set`, `four_subjects`, `new_best`. The server date wins where both exist.
- Server-event ids: `first_hold` (It held) and `run_weeks_3` (3 weeks in a row) are built by `web/revise-events-1016`, which also adds `GET /api/me/badges` (contract: `docs/design-decisions/badges-api-1016.md` on that branch). The page calls it first and takes its dates, words, counts and papers as the authority (`badgePathsFromApi`). A badge the server could not read this time (`unavailable`) is shown as "could not be checked just now", never as locked. Where that route is not there yet (this branch alone, before the merge) the page falls back to the same rules run over the student's papers: the two server-event ids are then shown locked with their exact condition, and `run_weeks_3` is shown earned, undated ("Earned. The date is not recorded yet."), only when the server's own `bestRun` already proves a run of 3: never falsely locked, never given a made-up date.

## Data path

- `GET /api/me/badges` (other branch): the 16 badges, authority when present. Also `bestRunEndedWeek`, which adds "Ended the week of 5 October" to the longest-run row while that run is over.
- `GET /api/me/study-record` (new here, read-only, no credits): runs the shared module over `Database.getAttempts` and returns one small body: derived badges, the paper behind each, counts toward the next ones, the fastest right answer and `computeBests`. The page never downloads every paper. It is the source of the personal bests and the per-type marks in both modes, and of the badges in the fallback.
- `GET /api/me/rhythm`: milestones, best run, weeks, time zone (`RhythmCard` already holds it).

Both badge reads are waited for together, so a badge is never drawn locked and flipped later.

## Decisions

| Decision | Why | Evidence |
|---|---|---|
| Every badge is a row with name, one true line and (earned derived ones) the paper it came from, with a link to that result | A badge is a fact; the source is shown, never invented | T002, S015 (truthful progress) |
| Locked badges say "Not yet." plus the exact condition; the first of a sequence says "Next." | The student sees what earns it without a lock icon or a Pro link; the app's own words | AGENT_RULES 8, 9 |
| A count ("6 of 10 so far", "2 of 4 subjects") and its 4 px bar only where the count is exact; repairs are never counted | The app's rule: no arc on a guess | AGENT_RULES 17 |
| While the papers load, a skeleton holds the block | Showing derived badges locked first and flipping them later would be false | AGENT_RULES 17, 35 |
| Personal bests are value-first rows (`142 / 250`, `5 weeks`, `9 s`) with the subject and date beside them, then best against latest per mock type with a tick for the latest | Numerals with units and context; comparison where simultaneous comparison is useful | AGENT_RULES 9, 12, 29 |
| A best that has no data is left off; "no timed answers yet" is said, not guessed | Honest empty states | AGENT_RULES 35 |
| The ring and the ribbon say "study days": "3 of 4 study days" | App parity (ledger L06) | |
| Two ruled columns (one on a phone), no boxes, no glow, no gradient, one accent; medals are circles with a numeral or a plain line icon | The Progress page is already open sections; PRODUCT/DESIGN slop list | ui-ux-standards 10 |
| Mobi does not appear in these blocks | One per screen; the week header already has him | |

## States covered

Loading (skeleton, `aria-busy`), error (message, Try again), no papers (all locked with their conditions, "Your bests show after your first scored set"), some earned, all earned, run proven but undated, bests without a mock (a set stands in), no timings (stated), device-scored papers (never counted). Reduced motion: bars are static. Keyboard: every link is a real link with a visible focus ring; no hidden controls.

## Verification

Run: `node --test` on `data/tests/study_badges.test.mjs` (27 cases, including the app's `derived_badges_test.dart` cases and the `/api/me/badges` contract), `rhythm_view`, `app_rhythm`, `recap`, `attempt_summary`; `npm run test:app` (357 pass before the badge-list addition, rerun after); eslint on every changed file.

Not done: the visual pass at 390 and 1440, Night and Day. Free RAM fell below 1 GB (about 20 agents) while the development server was compiling, so it was stopped and nothing was looked at. It is left to the batch gate. To look: `npx next dev --webpack`, open `/preview/arena?view=progress` (fixtures only; `&badges=none` for the empty case, `&data=empty` for no papers) and check `#badges` and `#bests`: medal and bar contrast in Day, the two columns at 760 px, the ring label "of 4 study days" at both ring sizes (132 px and the compact 92 px on Today).

## Open item

After `web/revise-events-1016` merges, the fallback path is dormant; keep it until the route has been live for a release. Production and staging were not touched. Fastest right answer reads each paper's own time trace (the figure the result page shows) and falls back to the saved per-answer time; on production almost every attempt is device-scored, so the row will say so until papers are server-scored.
