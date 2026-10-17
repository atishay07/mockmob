# Badges on the website: refine, never remove (web half of BADGES-REFINE-1018, D19)

Branch `web/badges-1018` (from `web/r6-community-1018`). The owner (18 Oct, about 3:50 am): keep the badges, refine the UI and function around them. All sixteen badges, the four paths and the Medal art stay. `src/lib/studyBadges.js` is the source of truth for ids, names and conditions (a test now holds the page and the server list `src/lib/server/badges.js` identical).

## What changed

| Spec section | Built |
|---|---|
| 1. A real home | Progress has a "Badges, 6 of 16" section after the record (before Concept checks), then Personal bests. It is no longer inside the week card (`RhythmCard` hands the week it read up with `onLoad`, so it is read once). A shelf of earned medals, newest first, then the next badge as a ghost medal (dashed, thin progress ring, one line such as "Repairs: 7 of 10. 3 more repairs."). Phones: "All badges" opens the four paths in a sheet. Desktop: the four paths follow inline, as before. |
| 2. A tap explains | Any medal or row opens its badge: a popover beside it on a desktop, a bottom sheet on a phone. Earned: when (day and 12-hour time), the paper it came from with "Open that paper", the next badge on the path with the exact count left, the path's action key. Not earned: the condition, the count so far with its denominator, the action key. Rows are one control (a stretched button on the name); the links inside stay their own. |
| 3. Earning feels like something, once | `EarnedBadges` on the result, right after the summary card: one compact row, "Badge earned" and the name, or "2 badges earned"; "See your badges" goes to `/progress#badges`. The medal reveals once (scale 0.85 to 1 and one light band across it, 600 ms, `cubic-bezier(0.23, 1, 0.32, 1)`; a 150 ms fade under reduced motion). Never a modal. Shown once per badge: `mm:badge-seen:<id>` holds the server's `earnedAt`; it is written when the row is on screen. |
| 4. Status labels | On this branch the Progress rows were already quiet text (no `pr-badge` there). Praise ("All correct") is now ink 2, warnings ("3 to review") stay warn text. The two `pr-badge` pills left in the app are not Progress: the Account plan pill and the Contribute submission status (hidden). |
| 5. Truth | Earned only with a real `earnedAt` (the one undated proof of "3 weeks in a row" says the date is not recorded). A failed read says so in one line with Try again; no count in the head then. Counts always carry their denominator. A badge the server could not read is never "not yet", never counted. No ranks, names, flames or padlocks. |

## Decisions and why
- **The ghost is the badge closest to done where an exact count exists**, else the first not earned in shelf order (a count of 0 is not "close", so a new student is shown "First scored set").
- **A result announces a badge only when it belongs to that paper:** the server's record names the paper, or (papers, weeks, best work) the badge is dated within two minutes of the paper; repairs are dated by the repair, so only a record could tie one. A result older than three days announces nothing.
- **The paper's own time is not said twice:** a badge dated by its paper already says that time on the "Earned" line.
- **Weeks at your goal** has no action key of its own in `studyBadges.js`; the sheet offers "Choose practice" (practice earns a study day). `BADGE_PATHS` is unchanged.
- **Evidence IDs:** T002 (progress only for completed steps: the shelf shows earned badges only, and a ghost is labelled "Next badge"). The rest is the owner's own direction (D19) and the owner's UI standards.

## Known gap (server, not changed here)
`getBadges` keeps its answer 5 minutes in memory (and the route `private, max-age=60`), so a badge a set has just earned can miss its result page until that cache expires. The row would then show on the next visit within three days. A one-line `forgetBadges(userId)` after an attempt is saved would close it.

## Verification (headless, preview fixtures)
Fixtures: `/preview/arena?view=progress&badges=none|some|all|unknown|error`; result `view=result&paper=avg&earned=one|two`.
390 and 1440, Night and Day: no badges yet, some, all, one unreadable, read failed; the detail sheet and popover; the All badges sheet; the earned row (one and two). Hit tests, 44 px targets, focus trap and return, Escape, outside click, scroll lock, reveal timing, reduced motion, once after reload.
