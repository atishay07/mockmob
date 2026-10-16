# WP-C decisions: Mistake Lab truth and hierarchy (web pass 1016e, packet 3)

Written 16 Oct 2026 by the WP-C builder, in wt-webux2 (branch web/ux-social-1016). Plan: mockmob-next `docs/design-decisions/pass-1016e/WEB-PASS.md`, packet WP-C. AGENT_RULES 39.

## User task

A student has just finished a mock and opens the result. The Lab must answer one question first: how many marks did I miss, and where did they go? Then it gives one thing to do for each group. Method notes (how a number was counted) must not read as the Lab's closing paragraphs; the owner banned that pattern on 15 Oct (OWNER-VISION-2026-10-15-PM).

## What changed

| Item | Change | Evidence |
|---|---|---|
| WC-01 | Every method sentence moves into `lab.method` (`{ label: 'How this is counted', lines }`). This covers the device-record sentence, the re-mark method, cohort coverage, the cohort source dates and the slow-finding gate. The web shows them under one 44 px row that opens in place (200 ms, `--mm-ease-out`, grid-row growth, chevron turns). The cohort line keeps one in-flow truth clause: "Each had answers from 20 or more other students." | AGENT_RULES 10 (S014), 9; DESIGN-CRITIC #8 |
| WC-02 | The re-mark is one net object: `{ lost: { marks, questions }, won: { marks, questions }, net, max }`. Its sentences: "Changing answers: lost 12 marks on 2, won back 7 on 2. Net cost 5 marks." and "First picks: 151 of 245. Final answers: 146 of 245 (1 question under re-check left out of both)." There are single-sided and even forms, and every figure is pluralised (1 mark / n marks). | AGENT_RULES 9, 29; standards s10 item 13 |
| WC-03 | Hero: "Mistake Lab" becomes a 13 px ink-2 eyebrow in sentence case. Under it, the missed marks are the display numeral, with "marks missed, of 250" at 16 px (server `lab.hero`). A click on a bar segment opens its row, lifts the segment 2 px and glides the page to the row (300 ms, token glide curve; one jump under reduced motion; no scroll when the row is already in view). The replay chips wrap on phones instead of scrolling past the screen edge. | AGENT_RULES 9, 25, 28, 30, 31, 36 (S016) |
| WC-04 | Nothing to do. The packet's files have no appended arrows, and `web/copy-1016` touches none of them. | standards s10 item 11 |

## Decisions and trade-offs

1. **Hero size matches the result's own score, not "48 at 390".** The plan says "at the result's display size". The result hero is `clamp(44px, 7vw, 64px)`: 64 px at 1440 and 44 px at 390, and both were measured. A Lab numeral larger than the page's score at 390 would reverse the page's hierarchy, so the two share one scale.
2. **Truth clause: "20 or more", not "(answers from 10 or more students)".** The "most other students got it right" line has a gate of 20 students and a Wilson low bound over 50%. "10 or more" would be true but would understate the evidence behind the line.
3. **The legacy fields stay in the contract for apps before AP3-03.** These are `lab.fine` (ready), `cohort.fine` and `remark.fine`, with their old text. The installed app keeps working on a new server. The web reads them only through `lab.method`. The contract test checks the body fields: heading, hero, headline, groups, barLabel, remark text and scores, cohort line, truth and slow line. A basic paper's one state line ("...The split shows wrong and blank only.") stays in flow, because it describes this paper rather than a method.
4. **`lab.heading` is kept.** The app and older consumers still read it. The web shows the hero and uses the heading only when nothing was missed.
5. **The disclosure animates the grid row instead of using `mk-swap`.** `mk-swap` overlaps two layers to replace content, and here nothing is replaced. The open time and curve are the same as the plan's: 200 ms, ease-out.
6. **Segment clicks are a pointer shortcut.** The segments sit inside the bar's `role="img"`, which has the full accessible bar label. Each segment's row button is the keyboard and screen-reader path to the same place. Each segment's hit area grows to 32 px tall, staying inside the 14 px gaps around the bar.
7. **Glide scroll uses `behavior: 'instant'` per frame.** The page sets `scroll-behavior: smooth`, which would otherwise turn every frame into its own smooth scroll.

## Verification (own headless Chrome, shared dev server http://localhost:3181, real `page.mouse.click`)

Fixture: `/preview/arena?view=result&mock=full&cohort=time`. Script and captures: `tmp/1016e-wpc/` (`verify.mjs`, `report.json`, 31 PNGs).

| View | Hero / result score | Method row | Segment click | Chips | Wide / h-scroll | Console errors |
|---|---|---|---|---|---|---|
| 390 Night | 44 / 44 px | 44 px, hit, opens 0 to 227 px | held: glides 1219 to 1815 in about 250 ms, row top 96, open, lifted | 26 visible, all 44 px, all hit | 0 / 0 | 0 |
| 390 Night, reduced motion | 44 / 44 | opens at once | one jump to 1815 | as above | 0 / 0 | 0 |
| 390 Day | 44 / 44 | as Night | as Night | as above | 0 / 0 | 0 |
| 360 Night | 44 / 44 | 44 px, hit | glides, row top 96 | all 44, max right 316 | 0 / 0 | 0 |
| 1440 Night and Day | 64 / 64 | 44 px, hit | the row is already in view: no scroll, open, lifted | all 44, hit | 0 / 0 | 0 |

- Body text with the method panel closed: no method sentence in any view (`methodLeak: false`). The bar is 12 px with 2 px gaps.
- Before this change, critic A (`mockmob-next/tmp/1016c-gate/critic-A/report-jobs2.json`, result-full-390-dark) measured `button.rpl-chip r=430` and `r=614` on a 390 screen. After it, the wide list is empty at 390 and 360.
- `npm run lint`: clean. `npm run test:recovery`: 359/359. `npm run test:app`: 344/344. `npm run test:learning`: 302/302.
- The fixtures were regenerated with the four `scripts/mistake-lab/build-*fixtures.mjs` scripts. The content changed in contract_ready, basic, none, replay, replay_bst, replay_english, replay_nta and replay_time_up.
- **Not run:** `npx next build --webpack`. The shared dev server was using the tree, and RAM was 1.3 to 5 GB. The main session should build at the merge gate.

## Anti-slop check (12 parts) and the 0/1/2 rubric

| Area | Score | Note |
|---|---|---|
| One primary message | 2 | The numeral answers "how many". The ledger answers "where". |
| Real numbers with denominators | 2 | Missed of 250. Re-mark figures of 245, with the held question named. |
| No sub-remark paragraphs | 2 | The method sits behind one row. |
| Targets (44 px) | 2 | Measured on the method row and on every visible chip. |
| Motion has a purpose, with reduced motion | 2 | The glide links the segment to its row. The disclosure opens in place. Under reduced motion both happen at once. |
| Night/Day parity | 2 | Captures in both themes. |
| Copy plainness, no arrows | 2 | No arrows. Plain sentences. |
| No cards in cards | 2 | Unchanged ruled list. |
| Fake urgency or dashboards | 2 | None. |
| Phone overflow | 2 | The wide list is empty. |
| Hierarchy matches the result | 2 | The Lab and result numerals share one scale. |
| App parity | 1 | The server strings are ready. The app renders them in AP3-03/04. |

## Unresolved

- AP-3 (the app) must read `lab.method`, `lab.hero`, `remark.scores`, `remark.lost/won/net/max` and `cohort.truth`. Fixture: `data/tests/fixtures/mistake_lab/contract_ready_v1.json`.
- The legacy `fine` fields can be dropped once no installed app reads them. That is the owner's call after an app release.
