# The logged-in web, critique then fix (5 Nov 2026, packet R2-C, branch web/1105-appweb)

## The task

The owner asked for an overall refinement of the website and app through the night (5 Nov, about 2:40 am; docs/brain/night-1105/SPEC.md).
Earlier tonight the Practice page at 1024 px had subject names running into each other and mode tiles' prices sitting on their
titles (fixed in practice.css, 5f2cdcdd7). This packet looked for the rest of that kind across the logged-in web and fixed what a
student would see, most visible first. Refine, never rebuild: no behaviour changed, nothing cut, logo and fonts kept.

The reader is a 16 or 17-year-old, often new to CBT, on a phone or a 1024-1366 px laptop (the common Indian laptop widths).

## How it was looked at

- **Views** (the preview harness, logged-in shell with demo data): today, dashboard (Practice), learn2, learn2-chapter, learn2-run,
  learn2-cards, learn2-feed, cards, deck, review, revise, progress, radar, compass, saved, wallet, profile, help, mob, rival, ranks,
  explore, onboarding, test (the MockMob runner and the NTA runner, `view=test&mode=quick|nta`). `/preview/arena/nta` needs the local
  e2e backend (port 3108) and shows only its loading frame without it; the NTA runner was looked at through `view=test&interface=nta`.
- **Sizes**: 360x640, 390x844, 768x1024, 1024x768, 1280x800, 1440x900, Night and Day (300 page loads per scan), plus 1366x768 where a
  band edge needed it.
- **Automated scan** (real Chrome, `tmp/night-1105/r2c/scanPage.js`): text overlapping text; text spilling out of its box; clipped
  text; sideways page scroll; tap targets under 44 px on touch sizes; contrast under AA; and, added midway, **text covered by
  another painted element on the same layer** (a hit test at the middle of every line at six scroll positions). Visually hidden
  text, aria-hidden twins, closed `<details>` content and collapsed panels are skipped.
- **Screenshots looked at**: first screens of every view at every size and theme, then contact sheets (2-4 screens) of every view
  at 390 Night, 1280 Night, 1024 Day and 1440 Day, and the runners at 390, 1024 and 1280 in both themes.
- **Real pointer**: the fixed controls clicked with CDP mouse and touch (below).

What the first scan found was mostly small; the screenshots found the rest. The covered-text check was added after the screenshots
showed a key sitting on a label that the text-on-text check could not see; on the old CSS it reports that exact fault, and after the
fix the whole matrix reports none.

## What was found, most visible first, and what changed

| # | Where, when | What a student saw (before, measured) | Fix | After (measured) |
| --- | --- | --- | --- | --- |
| 1 | Learn feed (Explore's chapter feeds), every laptop from about 900 to 1359 px | "Turn over" sat **33 px over "Chapter"** in the action bar: Previous with its "Up" chip, Revise later, Chapter and the 220 px step key needed about 640 px on a 600 px stage | stage.css, 768-1359 px only: Previous drops its "Up" chip (Up still works, the keys list says so), gaps 10 px, step key at least 196 px | 10 px between every key at 768-1359, also with the longest label "See how it went"; from 1360 the bar is 800 px and unchanged |
| 2 | Practice, 1280-1439 px | NTA mode's "The closest thing to exam day" ran **64 px (1280) / 21 px (1366) under "Needs Pro"**; "Quick practice", "Smart practice" and "NTA mode" broke onto two lines (the same fault as 5f2cdcdd7, one band up) | practice.css: one tile a row up to 1439 px, as 1024-1279 already is; the kicker gets `text-wrap: balance` (no "exam / day" at 390) | kicker clear of the price by 253 px at 1280; every name on one line; at 1440 the two-up tiles clear by 16 px as before |
| 3 | Your papers, right column, 1024-1365 px | Saved repairs' words had **102-120 px** beside the number and "Check it held", so three short lines broke into six to eight ("Admission of a / partner / Mock 2, Mon 12 / Oct, 10:42 PM") | review-1018.css: the column is a container; under 400 px the key goes under the words | words 227 px wide at 1024, 329 at 1280; every row three lines plus its key |
| 4 | Wallet, three credit packs, 760 px and up | "Best value" and "Save 3%" wrap at 1024-1279, so the **prices and the keys sat at three heights** across the row | wallet.css: the cards share rows (`grid-template-rows: subgrid`), titles held to the top | prices at one height, keys at one height (1024 and 1280) |
| 5 | Monospace as a costume (slop list #8) | The balance chip under "What are we practising?" (and Account's credits) in Geist Mono beside a top bar that draws the same number in display type; the MockMob runner's timer, "Question 1", option letters, palette and legend in Geist Mono while the home page's MockMob preview of the same screen uses no mono | arena.css: `.credit-amount__value` in the display face with tabular figures; inside the MockMob runner only, `--font-mono` points at the display face (NTA's screen keeps Arial, checked); timer, palette, legend tabular; Explore's option letters and vote score off mono | no visible monospace text left in any of the 25 views (checked by computed font on every text node) |
| 6 | MockMob runner, palette legend | The five states a student filters by were the smallest words on screen: **10 px, weight 800, tracked mono** | practice-run.css: 13 px body type, ink-2 | readable; rows still 44 px |
| 7 | Marks trend, the marks ledger | Right, Wrong and Blank figures sat **12-16 px lower** than Net marks and Accuracy (cells stretched, figures floated) | analytics.css: `align-content: start` | all five figures at one top (491 px at 1280) |
| 8 | Progress, Your study record | "0 cards in review" and "0 recall answers" rode **11 px above** "0 of 21 lessons read" beside its ring | study.css: the row centres on the ring | three centres at one line |
| 9 | Top bar account doors, every phone | Credits and You doors were **42 px** (the capsule's 1 px hairline) | arena.css: the doors reach over the hairline | 44 px; a tap on the capsule's top edge row opens Wallet |
| 10 | Key card menu (the "..." on a card), every size | **44 x 36 px** | keycards.css: 44 x 44 with a negative margin, card head unchanged | 44 x 44 |
| 11 | Key cards chips, Day | the counts beside "Must-know 5" at 70 % opacity were **3.9:1** | cards.css: the count is ink-3, not faded | 5.9:1 Day, 7:1 Night |
| 12 | Rival, the credits line | a middle dot between the two facts (slop list) that **dangled at the end of the first line** on phones | AIRivalArena.jsx, rival-reveal.css: the dot goes, the facts sit apart by space | one or two clean lines |
| 13 | Even lines in the app | "Counted as a study day. 1 more study day meets your / **4. Your weeks**" on Today at 390; single words left on last lines | arena.css: the home page's D3 rule carried into the app at zero specificity: paragraphs `text-wrap: pretty`, headings `balance`; NTA's console keeps default wrapping | no lone link or one-word last line seen in the 390 sheets |

## What was checked and left alone (with the reason)

- **The rail on short laptop windows** (1366x768 screens give about 650 px of window): the sidebar needs 889 px at its compact 38 px
  rows, so Ask Mobi's door is cut at the bottom until the rail scrolls. It scrolls (overflow auto) and the cut reads as "more below";
  shrinking 15 rows further would put them under 44 px. Left as designed (arena.css, "the rail simply scrolls").
- **Key cards on desktop say "Tap the card to turn it over"**: the words are the app's own (runView.test pins them for parity).
- **Middle dots in meta lines** ("8 cards · 2 min", "Continue · 5 min") are pinned Learn and Today copy across both apps; not a list
  of facts in a sentence. Left.
- **Your papers' right column is sticky and, at 1024, taller than the window**: its foot (Your rules, Your Mob, Saved questions)
  comes into view as the page ends. It was taller before this change (rows of six to eight lines); not made worse.
- Scan reports judged false: whole-row hit areas widened by `::after` (Key cards rows, Today's compact Practise pill), line-clamped
  card fronts, a selected segment's text over its own sliding thumb, and Day contrast readings taken mid colour transition (a real
  Day load reports none).

## Rules held by a test

`data/tests/appweb_refine_1105.test.mjs` (9 tests) holds each rule above. It is not yet wired into an `npm run` list, to keep this
branch's package.json untouched while other packets edit it: run it with `node --test data/tests/appweb_refine_1105.test.mjs`, or add
it to `test:app` when merging.

## Verification

- Scans: `tmp/night-1105/r2c/scan2/results.json` (before the later fixes, with the covered check), `scan3/results.json` (after):
  after, zero overlaps, zero covered lines, zero spills, no sideways scroll at any of the 6 sizes in either theme; the only reports
  left are the false ones listed above.
- Screenshots: `tmp/night-1105/r2c/before/` and `after/` (Practice tiles at 1280, the feed bar at 1024, Your papers at 1024-1366,
  the wallet packs, the ledger, the study record, the runner at 1280), contact sheets in `look/`, first screens in `scan/`, `scan2/`.
- Real pointer (CDP): at 1024 the middle of "Chapter" hit-tests to its own link and "Turn over" clicked turns the card ("Next"
  follows); at 390 the credits door is 105 x 44, its top edge row belongs to the door and a tap opens Wallet.
- Tests: test:app 1009 pass (2 skipped), test:learn 434, test:recovery 637 (its one known-gap todo unchanged), test:billing 453,
  test:nta 234, test:keycards-ui 40, test:dock 55, test:today 146, marketing tokens + examScreen 22, the new file 9; eslint clean on
  the changed JSX and the new test.

## Not done, not verified

- `/preview/arena/nta` itself (needs the e2e backend); the NTA runner was seen through `view=test&interface=nta` behind its
  fullscreen gate only, and its styling was left to tonight's runner packet.
- States behind interaction were not scanned (an opened card, an answered question in the feed, sheets and pop-overs, the end of a
  run); only first states and scrolled pages.
- Real phones and a production build were not used; the dev server (webpack) and headless Chrome only.
- The result page's score and the end-of-set arrival were not touched (another packet owns them).
