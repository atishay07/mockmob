# Forensics for owner feedback 19 Oct 2026 (G7, G12, G15, G17, G18, G22, G24-G31)

Read-only investigation, 19 Oct 2026. Web evidence is from main `23a7c090` (release 10) and earlier release tips
(`deploy/1015-night` 3fc0095b, `deploy/1016-batch` 77713336, `deploy/batch-1016d` bc099c53, `deploy/web-1017d` 9578ee66,
`deploy/web-1018-r5..r10`). App evidence is from `ui/v15.2-1018` ab04b067 in `wt-v15-2/flutter_app`.
Nothing was run in a browser or on a device; where a claim needs the owner's screenshot it says so.
Dates and times are IST as in git (MM-DD HH:MM).

## Verdict table

| Item | Kind | Cause in one line | Restore from |
|---|---|---|---|
| G28 gradients, textures, NTA button | TRUE REGRESSION (deliberate "de-slop" on 16 Oct, kept ever since) | `c9662f67` (10-16 03:25) and `09421b29` (10-16 08:44) deleted the NTA gradient row, the volt glow, edge lights and page glow; `706b1fe9` (10-18 16:41) removed the landing aurora | `c9662f67^` (06285f1a) or `deploy/1016-batch` 77713336 for the Practice and arena look |
| G29 sign out | DESIGN GAP (control exists and renders; placed away from the other sign-in actions); not a removal | `SignOutControl` is in the "Your name and sign-in" card; other-devices and delete are in a different grid at the foot | nothing to restore; move it |
| G31 animation feel | PARTLY REGRESSION | count-up 720 to 420 ms (`9d28148b`), one-stagger rewrite and new page transitions (`dbb80d00`), overshoot springs replaced (`48e30685`), glow and keycap press removed (`c9662f67`) | `deploy/1015-night` motion-kit.css |
| G25 Review top and order | TRUE REGRESSION (replaced by design) | `c7292e41` (10-18 02:49, release 6) replaced the page with "Where you lose marks"; receipt strip and tabs went | `ad381711` (10-17 18:18) |
| G24 Mob in Study | CHANGED BY DESIGN, now rejected | `f05fdffc` (10-18 03:20) dropped the Community header; the Mob moved into Study | `f05fdffc^` (0a7b35c6) arenaNavigation.js |
| G26 "5 questions ... Biology" on top | DESIGN GAP (confirm the surface with his screenshot) | session card's second line `pr-ticket__what`, from `58e05acb` (10-17 03:14) | n/a |
| G27 sideways cue | DESIGN GAP (never built) | the rail has an edge fade and mouse arrows only | n/a |
| G30 morphing text | NEW COMPONENT (not a regression) with a real timing gap | `HeroMorph` from `02d2558d` (10-18 11:18, release 8); first change 3.6 s after mount | n/a |
| G22 result moment | TRUE REGRESSION for practice sets; mocks still have the reveal | v13 `1178a9e7` (10-17 04:21) unmounted `FinishStage` (file still in the tree) | `68f63c11` practice_result_screen.dart, or re-mount `FinishStage` |
| G15 Practice modes | BUG (intent conflict) | `e3ca76be` (10-18 22:54) hides Smart and NTA tiles for a Free student while PLAY_BILLING is off | `e3ca76be^`, or show them locked |
| G12 Suggested deck | DESIGN GAP | deck is built only from record-based moves; a fresh account gets 2 cards at most | n/a |
| G7 first 3 colleges | DESIGN (stated in the UI but easy to miss) | `MyColleges.ladderSize = 3` | n/a |
| G18 range and goal check | BUG (two meanings of "clear") | headline counts only "clears" (low end reaches the cutoff); rows say "Within your range" | n/a |
| G17 Mob in the app | DESIGN GAP | the Mob page is `/you/mob`; the always-on entry is the sixth row of the You hub | n/a |

---

## G28: textures and gradients "gone", the NTA mode button, "feels like an older version"

What he saw. Practice and the arena chrome are flat. The NTA mode control used to be a raised tile with a volt gradient; now it is a plain tile with a text panel under it. Glow on primary keys,
edge lights on cards and the aurora wash behind the landing hero are gone.

Why and when (commits, by release).
- The last lit builds are `deploy/1015-night` (3fc0095b, 10-15 22:30) and `deploy/1016-batch` (77713336, 10-16 01:33). The NTA control was a button-card: `DashboardPageClient.jsx` at 3fc0095b line 470,
  `className="pr-tile pr-nta mk-rim"`, with the kicker "Closest to exam day" and the console picture; `9bb41032` (10-15 22:58) turned it into a picture tile on phones.
  Its gradient: `arena.css` at `c9662f67^` line 1318, `.app-shell .pr-nta { ... background: linear-gradient(135deg, var(--a-volt-wash), transparent 55%) ... }`;
  `practice.css` at `c9662f67^` lines 42, 125 (selected tile wash), 216 and 249 (`.pr-nta__more` gradient).
- `c9662f67` 10-16 03:25 "Arena de-slop A1: Today, Practice and the shared chrome" (first shipped in `deploy/batch-1016`). 14 gradient lines removed (arena.css 10, practice.css 4). Its own message:
  "a flat volt key everywhere (no glow, keycap edge or sheen on btn-volt) ... no edge lights on cards and sheets, no glow wash behind the page"; Practice "modes are one radio list ... NTA Mode's exam screen in its row from 1100 px".
  `.na__cta` also lost its lean-in and volt glow.
- `09421b29` 10-16 08:44 "Deploy gate fixes for batch-1016": 14 more gradient lines removed from `features/page.js` (8), `pricing/prepos/page.js` (5) and `start.css` (1); "Base buttons lose caps, tracking and glow"; "no icon tiles, nested cards ... kickers, colour dots".
- `06285f1a` 10-16 03:10 did the same on Account, Credits, Compass, Combo planner and Leaderboard.
- `fb73dccd` 10-17 18:38 (a STOP POINT commit, unchecked work): removed `PrepOSOrb.jsx` conic and radial gradients, two in `marketing-theme.css`, one in `AIRivalArena.jsx`, the theme toggle sky and two in `practice.css`.
- `89ed9905` 10-17 21:09 (STOP POINT): `hero-depth.css` glow removed. `41e47a59` 10-18 14:10: Lab Cinema glow blob removed (release 8). `706b1fe9` 10-18 16:41: "aurora wash removed (L-019)" in `landing.css`
  (`.lp-bg__aurora`, `.lp-close .lp-bg__aurora`), first in release 9 (`deploy/web-1018-r9`).
- Textures partly came back: grain and texture references in CSS went from 1 (1016) to 9 (web-1017d and later), for example `--pr-grain` on Practice (current `practice.css` lines 20 and 423).
  So today's Practice tiles do carry a radial wash and grain, but not the volt keycap, the glow or the NTA gradient.
- Counts of `gradient(` in CSS: 165 (1015-night), 167 (1016-batch), 150 (batch-1016d), 163 (web-1017d), 168 (r10). In JSX strings: 36, 38, 25, 20, 20. The CSS total never fell much, so the loss is
  concentrated in the arena chrome (arena.css), the NTA row, the landing glow and the orb. He is right that specific signature surfaces went.
- NTA control today (release 10): one of four `pr-tile` radios (`DashboardPageClient.jsx` about lines 607-640 at 23a7c090) with the NTA panel (`pr-nta__after`) under it; shape from `a0bd1768` (merge of web/start-1017, 10-17).
  The tile is pressable but has no NTA-specific gradient.

Restore. `c9662f67^` (06285f1a) for `arena.css` and `practice.css`; `77713336` (`deploy/1016-batch`) for the whole lit build. His taste notes say Night glow stays subtle, so restore the NTA gradient button and the
keycap volt key, not a page-wide glow.

---

## G29: no way to sign out of this browser

The control exists. `src/components/profile/SignOutControl.jsx` (title "Sign out of this browser", it opens a confirm with "Stay signed in" first) is rendered at `ProfilePageClient.jsx:295`, inside the card
`id="name"` titled "Your name and sign-in" (lines 268-296). It was added in `cf51d4d8` (10-15 13:49) and never removed: `git log -S"<SignOutControl"` shows only that commit; it is present in 1015-night, 1016-batch,
batch-1016d, web-1017d and r10, and `data/tests/you_account.test.mjs:139` asserts it. No condition hides it. Other routes: an icon-only "Sign out" button in `AppLayoutClient.jsx:413` (top bar, `arena-desktop-only`) and
`AppLayoutClient.jsx:462` (inside the phone More sheet); marketing `NavBar.jsx:187-194` has a text "Sign out".

Why he cannot find it.
(a) "Sign out of other devices" (`SignOutOtherDevices.jsx:39`) and "Delete account" are together in the last grid (`ProfilePageClient.jsx:314-318`; the `id="sign-in"` anchor is on the other-devices card), but "Sign out of this browser" sits in the
Name card, a different block. He reads two sign-in actions at the foot and stops.
(b) On a phone `account.css` lines 213-222 give `#name` `order: 7`, below the sheet, glance, colleges, goal, plan and credits.
(c) The top bar and More sheet use an unlabelled glyph.
(d) Before `cf51d4d8` there was no labelled sign out on the account page at all, so a plain "Sign out of this browser" did not disappear; it was added on 15 Oct and never moved.
Not verified in a browser at 390 and 1440; the code path is unconditional, so it should render for a signed-in student. Check that the page he searched was `/profile`.
Fix direction: no commit to restore. Put a labelled Sign out in the same block as the other-devices and delete cards, and add the word to the top bar and More sheet buttons.

---

## G31: animations "faster and less refined"

Tokens in `src/app/motion-kit.css` barely moved on main since 15 Oct (`--mm-dur-ui` 200, card 240, enter 360, emphasized 420 are identical in 1015-night, batch-1016d, web-1017d and r10). What did change (verified by diff):
- `9d28148b` 10-16 21:42: `--mm-dur-count-up` 720 ms to 420 ms (every number count-up 40 percent shorter).
- `dbb80d00` 10-16 22:46 "Pass 1016e WP-A: arena motion system" (first in `deploy/web-1017d`): `.mk-stagger` rewritten from "every child rises, 45 ms apart" to "one lead rises; the next two fade up 6 px at 60 and 120 ms; the rest fade together at 160 ms";
  a committed swipe from 180 ms ease-leave to 200 ms ease-out; new React `<ViewTransition>` page transitions with the frame held still (`AppLayoutClient.jsx`, `instrumentation-client.js`, `placeTransition.js`); small marks start from scale 0.6.
- `48e30685` 10-16 00:00 "Q11: the last 1.56 overshoots out of nav, arena, student pages ...": every `cubic-bezier(.34, 1.56, .64, 1)` 420 ms spring in `arena.css`, `onboarding.css`, `student-pages.css`, `nav-motion.css`, `saved.css`,
  `analytics.css`, `prepos.css`, `study.css` replaced by `--mm-spring-release` (566 ms, less overshoot). Pills, keys and the dock settle less bouncily.
- `c9662f67` removed the lean-in and glow on `.na__cta` and the keycap press edge.
- `5b2038f2` 10-16 00:11 (Mobi web port: 96 animation lines removed, 31 added).
- Landing hero: `MorphWord` (a word swap) replaced by letter-by-letter `HeroMorph` (`02d2558d`, see G30).
Old numbers: `deploy/1015-night` (3fc0095b) `src/app/motion-kit.css` (count-up 720, one stagger across all children, 1.56 overshoot springs).
Honest note: no commit made animations globally faster; the count-up and stagger changes, the calmer springs and the removal of glow together change the feel.

---

## G25: Review top and order ("Nothing left to repair", then questions, then chapters)

What he sees. Review (`src/components/review/ReviewChapters.jsx`, rendered when `body.lose.rows` exists, `ReviewPage.jsx:239`) opens with the title and one marks line, then "Where you lose marks"
(`ReviewChapters.jsx:182-186`) with the first chapter OPEN; if that chapter has nothing left to repair its panel header reads "Nothing left to repair" (`ReviewChapters.jsx:159`), then its repaired, blank and correct questions, then the other chapter bars.
No stat strip, no tabs.

When.
- `d8f8d50a` 10-16 11:05 "Arena pass 2": Review opened on one anchor ("questions to review, of questions answered") and the one session to open first.
- `ad381711` 10-17 18:18 "Review P-LR1": the Mistakes page with one next move (`ReviewNextMove`), `ReceiptStrip` (the core figures), chapters in marks, tabs Mistakes and Papers (`ReviewPage.jsx:170-250`); first in release 5 (`deploy/web-1018-r5`).
- `c7292e41` 10-18 02:49 "Review 1018 P-RR1: Review leads with where you lose marks (D18)" (first in release 6, shipped 10-18 07:17): routes to `ReviewChapters` and drops the next move, the receipt strip and the tabs; Papers became "Your papers" lower down.
  The old layout survives only as a fallback when `body.lose` is absent (`ReviewPage.jsx:240-262`). Follow-ups: `b9a68e62` (a fully repaired chapter leads with "Practise to prove it on new questions"), `6b6dc029` (10-18 16:38, "lost X of Y").
- Source of the rule: owner D18 ("rather than review, in the review section, we can integrate the weak chapters"), quoted in the header of `ReviewChapters.jsx`.

Restore. `ad381711` (`ReviewPage.jsx`, `ReceiptStrip`, `PapersView`), or `917dd56e` (`c7292e41^`). Better: keep `ReviewChapters` but put the receipt strip and a Papers entry above it, and do not auto-open a chapter whose header is "Nothing left to repair".
A subject chooser is in neither version (G20).

---

## G24: Mob inside Study, Planning inside Marks trend

`src/lib/arenaNavigation.js:21-22` at 23a7c090: Study = Today, Practice, Learn, Review, Explore, Saved, Progress, "Your standing" (sub item) and "Your Mob"; Planning = Marks trend, Colleges, Ask Mobi; Account = Account, Wallet, Guide.
History of the file:
- `deploy/1015-night`: Study / Planning (Radar, Compass, PrepOS) / Community (Ranks, Contribute, My uploads) / Account.
- `e49f347b` 10-16 22:50 added the Mob, inside the Community group (visible in `61f8e162` 10-17 03:14: Community = Your Mob, Your standing, Contribute, My uploads).
- `f05fdffc` 10-18 03:20 "Hide the contribution side behind CONTRIBUTE_ENABLED, drop the Community header, Your standing under Progress ..." put the Mob in the Study group (release 6, shipped 10-18 07:17). The Mob went on for everyone in release 9 (`2e45a92c`).
- `54dac689` 10-18 17:02 (release 9) renamed "Weak chapters" to "Marks trend"; the sidebar group header is still "Planning" over Marks trend, Colleges and Ask Mobi.
- The phone dock (`MOBILE_STUDY_NAV`, same file) is Today, Practice, Review, Colleges plus More; the Mob is only in the More sheet.
Restore reference: `f05fdffc^` (0a7b35c6), or `61f8e162`, for the Community group that held the Mob with Your standing. It was a deliberate IA decision (D20), not a bug; he now rejects it.

---

## G26: Practice subject selector shows "5 questions ... Biology" on top instead of the mode

The only such string on the Practice page is the session card (the "ticket"): `DashboardPageClient.jsx:711-712` at 23a7c090,
`<h2 className="pr-ticket__mode">{mode.label}</h2>` then `<p className="pr-ticket__what">{quoteCount} {subjectLabel} questions</p>` (for example "5 Biology questions").
From 1024 px `practice.css:44` puts the card at `grid-column: 2; grid-row: 1 / span 3` and `position: sticky; top: 84px` (line 333), so at 1440 it is the first thing in the right column and its line changes the moment a subject is picked.
On phones the same words are in the sticky bar (`pr-bar__text`, line 772): mode name, then "5 Q" and minutes.
Added by `58e05acb` 10-17 03:14 (a STOP POINT commit, "unchecked, the resumed agent reviews it"; in `deploy/web-1017b/c/d`). Before it (`deploy/batch-1016d`) the aside was `pr-summary` without this head.
Honest gap: I cannot tell from code which screen he looked at; confirm with his screenshot. Likely complaint: the first line of the card is a count and a subject, which he reads as an odd summary, while the thing he changes (the mode tiles) is two sections higher.

---

## G27: Start sheet subject selector needs a sideways cue

`src/components/start/StartSheet.jsx:319-341` (`.st-rail`): the chip row has an edge fade and, for a mouse only, two arrow discs (`tabIndex={-1} aria-hidden`); touch relies on native scroll and the fade.
`start.css:251-270` defines the fade (`--st-fade-l/r`, 40 px). `useSubjectRail.js` has no first-view peek or nudge (a search for peek, nudge and hint finds nothing). The Practice page shelf is the same (`practice.css:65-66`, 64 px mask).
History: `6848916c` 10-15 16:33 (wheel, drag, arrows), `df7cf860` 10-17 18:37. Never built; recorded OPEN at `OWNER-MASTER-LEDGER.md:503`. A gap, not a regression.

---

## G30: homepage morphing text

- Component: `src/components/landing/HeroMorph.jsx`, timing in `heroPhrases.mjs`, motion in `src/app/hero-motion.css`, rendered at `src/app/page.js:169`.
- Added by `02d2558d` 10-18 11:18 (a STOP POINT commit; first in release 8, `deploy/web-1018-r8` eb5185ef), replacing `MorphWord.jsx` (a word swap on a 2800 ms interval, the version in 1015-night through web-1017d).
- Timing (`heroPhrases.mjs`, `MORPH`): letter stagger 20 ms, out 240 ms, in 360 ms after 120 ms, change 480 ms, hold 2600 ms, first change 3600 ms after mount (`FIRST_MS`).
  `HeroMorph.jsx` calls `schedule(MORPH.FIRST_MS)` in the mount effect, so the first change is on a timer from page load, not from "the first screen has settled". The only gates are an `IntersectionObserver` (hero in view),
  `document.hidden` and Reduce motion. It never waits for scrolling to stop, the hero Mobi to land, or the first screen's entrance to finish.
- Both complaints hold: the effect (letters rising) is basic, and the start is not tied to settling. Not a regression; the previous word swap was simpler.

---

## G22: the result after a paper, "reveal animation gone"

Two flows; only one regressed.
1. Full and NTA mocks. `runner_effects.dart:49-50`: `resultRouteFor` sends a mock to `AppRoutes.resultSealed` (the sealed sheet), then the 4-card recap (`/result/:id/recap/:card`, `lib/features/result/recap/*`), then the full result.
   `result_routes.dart` still builds `SealedResultScreen` and `RecapScreen`; alive in ab04b067. On the full result itself `RecapMobi` reveals beside the score (`full_result_screen.dart:433-450`) and `ResultHead` counts up on first open.
   Today's "Back from marking" (D28) was replaced by the paper reel (D29) in `83efa9ba` (10-18 04:59).
2. Quick, chapter and smart sets (his 10-question set). `runner_effects.dart:50` sends these to `AppRoutes.practiceResult`. Until v13 that screen played `FinishStage` (`lib/features/practice/widgets/finish_stage.dart`):
   the sheet inks in bubble by bubble, the figure counts up and is stamped with a medium haptic, a ring and 14 shards for a good set, then Mobi reacts and the success haptic follows, gated by the Celebrations setting.
   `1178a9e7` 10-17 04:21 "Result v13: shared layers ... and the practice result in four layers" replaced it with the shared `ResultHead` arrival (score counts up over 600 ms, the bar grows, the counts rise; "the arrival ends 520 ms in",
   `practice_result_screen.dart:307`) plus layers below. `FinishStage` and `FinishCeremony` remain in the tree but nothing mounts them (a search for `FinishStage(` in ab04b067 finds only its own file). No Mobi act, no stamp, no shards on a practice set.
   `9964e992` (10-17 04:28) also made the full result "no Mobi", later reversed by v15 (header of `full_result_screen.dart`, "the restore of N12").
Why it feels weak for 10 questions: ten bubbles are a short sheet, the arrival is a 520 ms number tick, and the page is a stack of layers (receipt, score, next move, folds) without a celebratory beat.
The web equivalent (N12) was "restored" in R4 and he called it "back and better" but not what he wanted (`OWNER-MASTER-LEDGER.md:89`).
Restore: re-mount `FinishStage` in `practice_result_screen.dart` as it was at `68f63c11` (the parent of `1178a9e7`), keeping the v13 layers under it (`onSettled` already exists to stage what appears below).

---

## G15: Practice shows no Smart and no NTA mode

Confirmed. `e3ca76be` (ui/v152-mob, 10-18 22:54, "Pro gates outside the Mob") changed `practice_screen.dart:211-220`:
`showNta = nta != null && quoteOffersMode(nta) && (!ntaGated || proOnSale)`, and the same for `showSmart`, where `proOnSale = ref.watch(proNudgesOnProvider)` is the PLAY_BILLING flag.
For a Free student the server quote marks NTA and Smart as `proGated`, so with PLAY_BILLING off both tiles are not drawn. Also hidden in the Start sheet and Today's alternatives sheet (same commit: `alternatives_sheet.dart`, `quick_start.dart`),
and the NTA gate offers a Full mock instead (`nta_instructions_screen.dart`). What he saw: Quick practice, By chapter and Full mock.
"Smart mock" never existed under that name: a history search for "Smart mock" in flutter_app, src and docs finds nothing. The modes are Quick practice, By chapter, Full mock, Smart practice (`practice/copy.dart:111`) and NTA mode.
Intent conflict: the commit's goal was no Pro tag where Pro cannot be bought; it removed the modes entirely, which makes a fresh account look incomplete (G16).
Restore: `e3ca76be^` for `practice_screen.dart`, or show the tiles locked with the plain line "not part of your plan" (the copy was added in the same commit: `planGateTitle`, `ntaGatedPlain`).

---

## G12: Suggested deck for a fresh account

`lib/features/today/logic/suggested_deck.dart` only formats cards. The cards come from `buildChoices` (`glance_builder.dart:108-150`), which tries five kinds in order with `limit = 4`:
`repair` (needs a basis paper), `revise` (needs repaired items), `weakest` (needs a weakest chapter from papers), `mock` (a full mock in the lead's or first subject, only if none in 14 days), `other` (another subject, `otherSubjectFor`, `move_builder.dart:846`).
A fresh account has no papers, so the first three return null and only `mock` and at most one `other` card can exist: 2 cards at most, 1 if the profile lists one subject or its subjects have not synced. (He saw one: English full mock.)
No card offers Quick practice, By chapter, Smart or NTA, and `e3ca76be` also removed the Pro ones from Today's alternatives. The end card ("All passed", `copy_suggested.dart:23`; "Go through them again", line 82) shows after one pass (`DeckPass.ended`), then "See every way to practice".
The weird clock is the stopwatch art on the full-mock card (`SuggestedArt.stopwatch`). An old account looks full because attempts exist, so repair, revise and weakest all resolve. The deck is from D51 / SWIPE-V2-1018 (10-18); `deckSize = 4`.
Fix: add record-free cards (Quick practice in the first subject, a chapter set, the second and third subject, Smart and NTA when allowed) so the deck reaches 3 or 4 for everyone.
Which of the two causes (one subject versus no sync) applied to his account needs a device trace.

---

## G7: only the first three colleges show on Today

By design, and said in some places. `lib/core/models/my_colleges.dart:62-80`: `maxColleges = 8`, `ladderSize = 3`, `ladder => colleges.take(3)`, `more` = the rest; Today's card reads it (header of `colleges_card.dart`: "the first three of My colleges").
Added by `f428d2ef` 10-16 04:11 ("My colleges in the app: one server list (up to 8) shared by Today, Compass and You"). Copy: `colleges_copy.dart:14, 71` "The first 3 show on Today"; onboarding marks the first three "On Today" (`college_ladder.dart:19`).
So yes, the first three picks (the first is the "dream pick", `today_profile.dart:44`). A student who picks 5 sees 2 missing. Fix: show all, or let the student choose which three.

---

## G18: "type your own range" and the goal check

`lib/features/tools/estimate/estimate_sheet.dart`: two fields, From and To, numeric only (`FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))`, `LengthLimitingTextInputFormatter(6)`, lines 534-535); `_typed` (lines 187-192) builds the estimate with low = min and high = max; a value over 1000 is invalid.
So "900 to 920" parses fine.
The disagreement is in the verdicts. `estimate.dart:47-52` `verdictFor`: "clears" when the LOW end reaches the cutoff, "within" when only the HIGH end does. The headline counts only clears (`estimate_sheet.dart:646-664, 692`;
copy `colleges_copy.dart:108`, "Your colleges: $n of $of clear"), while each row shows `verdictWords` "Within your range" (`estimate.dart:66`).
With 900-920 against four colleges whose cutoffs lie between 900 and 920, the headline is "0 of 4 clear" while the rows say "Within your range". A narrow range such as 910-920 seems to work because its low end clears more cutoffs.
Added in `f7b8f40d` 10-16 19:05 (Colleges area L22-L27). Fix: one definition: count clears plus within as "could clear" and say "2 clear, 2 within reach", or show both counts together.
G19 ("I don't know my range" from about 5 NTA mocks) is a feature; the estimate already has a mocks source (`EstimateSource.mocks`) that is the place to build on.

---

## G17: where the Mob lives in the app

The page is `/you/mob` (`mob_routes.dart:17`; `/mob` redirects there, `router.dart:374`). Entry points:
(1) the You hub row `MobHubRow` (`you_hub_screen.dart:373`, `MmStaggerItem(index: 5)`), the always-present one when the Mob is available;
(2) Today: `MobTodayBlock` (`today_body.dart:807`), which for a student in no Mob shows a one-time invitation only after a study week is met or 7 sessions are saved, for 7 days (`mob_entry.dart` `mobInviteMoment`, `mobInviteLife`), and for a member shows the Mob row;
(3) a row in Practice "More ways" (`more_rows.dart:34`) and in Review (`review_screen.dart:311`), each only when it has something true to say (`mobEntryFor` returns null otherwise).
A fresh account therefore finds the Mob only in the You hub, sixth item. Added by `1d550565` 10-16 22:08 and `e703da4e` 10-17 21:03. Design gap: no bottom-bar tab and no fresh-account entry on Today or Practice.
