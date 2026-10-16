# Design decisions: landing, branch web/land2-1015

One file per branch (owner research brain, AGENT_RULES rule 39). Evidence IDs come from
docs/research/premium-ux-ui-2026-10/source-ledger/EVIDENCE_INDEX.csv.

## Round 2 fixer (16 Oct 2026), answering the land:critic-2 review (scored 82)

User task: a CUET 2027 student lands on mockmob.in, tries five questions with no account, understands what the
Mistake Lab and the rest of the product do, and decides whether to start free or pay once for Pro.

### What changed and why

| Defect (severity) | Decision | Evidence | Trade-off |
| --- | --- | --- | --- |
| Pricing intro set a monthly price against the one-time price (high) | The intro now says only what can be bought today: "Free keeps practice and your progress open. Pro is one payment of ₹99, not a subscription." The Pro card already gives the end date and the no-renew line. The FAQ answer no longer names a future monthly price. | T006, AGENT_RULES 19 and 21 | The upcoming monthly plan is not mentioned on the page until it exists |
| "Radar", "PrepOS" and "XP" in visible copy (owner rule; the critic missed it) | Tour tabs and copy now read "Weak chapters" and "Ask MockMob". The Pro list reads "Every chapter ranked, with pace and changed answers", leaderboard points replace XP, and the sample result says "A full mock shows which chapters to fix first." | S017 (names that mean something to a visitor) | App screens keep their internal names. Only the landing changed. |
| Mobi's feet under the bar on the phone sample result (medium) | No Mobi inside the sample card's result at any width. On desktop the card-top Mobi fades out (150 ms) whenever any of him is under the bar. | Slop list 1 (nothing floating over content) | The result loses a second, static Mobi. The phone dock and the card seat still react. |
| Desktop flyer parked over the FAQ (medium) | The flyer shows only once 60% of a seat is in the window. It rides the seat exactly (no clamped point between seats, no eased lag), so he is only ever standing on the close's seat. | Slop list 1 | He no longer drifts in ahead of the close. He appears already on the seat. |
| Content column off centre at 1280 to 1440 (medium) | Removed the dead right-hand "Mobi lane" padding. Nav, every section and the footer now share one centred 75rem column (80/80 at 1280, 123/123 at 1366, 160/160 at 1440, 325/325 at 1920). The nav key ends at the content's right edge. | S011 (one hierarchy, one grid) | none |
| Lab wheel trap on a continuous spin (medium) | ScrollStory still moves one step per gesture. Once a single unbroken wheel stream has pushed 1.5 screens past its step, the story lets go, as Escape does, and the beats show the remaining scenes as the page passes them. On phones, a contained inner screen (Repair) that reaches its end hands the stream to the story instead of swallowing it. | AGENT_RULES 31 (motion must not trap), slop list 17 | A very hard trackpad fling can now pass a scene unread. That is the reader's intent. |
| 1440 hero: empty band under the card, facts below the fold (medium) | Hero grid areas: copy and card share row 1 with their feet level (the card's foot meets the keys' edge). The small print runs on in row 2. The facts row is 1.75rem under it, across the full column, and peeks above the fold at 1440x900. Each fact is one line ("Two exam screens: MockMob or NTA style."). | S011 | On desktop the card grows upward when a subject is picked, because its foot is pinned. Answering never moves the question: the reason's room stays reserved on desktop. |
| Skeleton bars before an answer (medium) | Removed. One plain line: "Tap an answer to see why the key is right." The reason still rises in place on answer (mm-rise). Phones no longer reserve an empty band, so the card grows downward. | AGENT_RULES 17 (no fake progress), slop list 13 | none |
| Near-duplicate chapter rows on the result (low) | Missed chapters are grouped: "Partnership", with the topics in grey under it. Two sample labels were corrected to share the "Partnership:" prefix. | AGENT_RULES 9 | none |
| Unlit statement words about 1.5:1 on Day (low) | The unlit opacity is 0.42 on Night and 0.52 on Day, so the whole sentence stays readable mid-scroll. | S016 (WCAG 2.2) | The scrub's lit-against-unlit contrast is smaller, but still visible |
| Mock keys looked pressable (low) | Keys drawn inside product screens ("Set up", "Practise 5 on this chapter", "Start the 10") are accent outlines, never filled volt keys. | AGENT_RULES 27 and 30 | none |
| Instagram "690+ likes and comments" against "695 likes" (low) | The summary keeps only the follower and view floors. The likes stay on the creator's own row. MockMob's posts are named by day ("26 April", "28 April (1)", "28 April (2)"), and each has a distinct accessible name. | AGENT_RULES 5 (no invented counts) | none |
| 10 to 11 px legends and captions (low) | 12 px floor for legends, captions, the exam replica's note, legend and keys, and the Lab's pace and time labels. Letters inside dots and palette cell numbers stay small, by design. | S016 | Fluid heading sizes (66.78 px hero at 1440) are kept: they fit the lines and were not snapped |
| Nav key cramped at the top (low) | Compact 40 px face on a 2 px edge, centred on the bar (8 to 50 px in a 61 px bar). An invisible ::after keeps the 44 px target. Hover and focus no longer glow: a 1 px lift over a neutral shadow, and a focus outline. The dock's one-time glow pulse was removed. | Owner slop list (glow) | none |
| Phone lineup read as a 2 by 2 icon grid (low) | Below 960 px each paper is a hairline row: object, name, and the count set right in tabular figures. The held scene's rise still plays. | AGENT_RULES 12 (vertical rhythm for dense mobile content) | Smaller objects (72 px) on phones |
| Faint grid behind the hero (low) | Removed (type first, nothing ambient). | S017, S018 | none |

### Verification (16 Oct 2026, my own headless Chrome over CDP on dev server :3122, real CDP pointer events, hit-tested)

- Sample drill at 390 Night, 390 Day and 1440 Day: Try 5 questions, then Accountancy, 5 answers, 5 Next presses and See your result. Every target was hit-tested. Result rows are grouped. No Mobi sits inside the card, and none shows under the bar.
- A continuous wheel spin (30 ticks of 1/30 page) passes the Lab and the tour at both widths. A gentle flick still moves one Lab step at a time (0 to 1 to 2 to 3).
- Flyer trace from the FAQ to the close at 1440, Night and Day: hidden until the seat is 60% in view, then exactly on the seat (flyer top equals seat top).
- Column gutters measured at 1280, 1366, 1440 and 1920: nav, main and footer are identical and symmetric.
- A rendered text scan at 390 and 1440 finds no PrepOS, Radar or XP in text, aria-label, title or alt.
- Captures are in mockmob-next/tmp/landing-1016/fix-2/: hero, drill, statement, pricing, Instagram, Lab SWOT, tour, the flyer, Compass at 1280, and full sweeps with contact sheets (sweep/night-390, sweep/day-1440).
- npm run test:app passed 256 of 256. The landing tests plus landing_content and sample_import passed 58 of 58. ESLint is clean on the touched JS.

Not run: a production build, a real device, and reduced motion (the changes keep the existing reduced-motion paths).

## Round 3 fixer (16 Oct 2026), answering the round 3 critic's defects

User task (unchanged): a CUET 2027 student lands on mockmob.in, tries five questions with no account, understands what
the Mistake Lab and the rest of the product do, and decides whether to start free or pay once for Pro.

### What changed and why

| Defect (severity) | Decision | Evidence | Trade-off |
| --- | --- | --- | --- |
| Held stories swallowed scroll: a 2,400px stream moved only 1,050 to 1,150px, and a fling 52 to 82% (high) | ScrollStory is now scroll-linked. Nothing cancels a wheel, a swipe or a key, and there is no momentum hush, cooldown or Escape release. The step on stage is the beat crossing the window's middle. Once the page has been still for 160ms, it settles onto the step already on stage, but only forward in the reader's direction and only within 0.35 of a step's gap. It never pulls the page back, never runs under reduced motion, and any input cancels it. Phone holds are shorter: the Lab is 4 x 0.70 screens (was 0.76). | AGENT_RULES 31 (motion must not trap), slop list 17 | A reader can now rest between two resting places. Each scene is whole on screen, so nothing is half-drawn. |
| Full repair: the header printed over the words, and three wheel ticks moved the story on to SWOT (medium) | The repair screen is clipped at the header's foot, so its words pass under the header. The short form now fits like every other scene (scale at least 0.8) and does not scroll. Only the full repair scrolls inside the screen, and that scroll chains on to the page. While the full repair is open, the story keeps the Repair scene (a new `pause` in ScrollStory) until the reader closes it or the page leaves the story. The key is 52px before scaling, so it stays a 44px target. | S016 (WCAG 2.2 target size), slop list 1 | none |
| The Compass sweep overwrote a drag (medium) | The sweep plays once per visit, when the score block is 60% in view, and lasts 1.1s (780 to 650 and back to 780). Native capture listeners on the whole ladder end it for good on the first pointerdown, touchstart, keydown, input or focusin. A value moved before hydration is kept. Leaving the view mid-sweep rests it on 780. | AGENT_RULES 31, slop list 6 | The sweep is shorter and shows less of the ladder's range |
| "Weak chapters after one mock" listed four subjects in whole percentages (medium) | Retitled "Weak chapters across your last mocks". Each row shows its count right, for example "5 of 13", and the bar is drawn from the same fraction. | AGENT_RULES 9 and 29 (units and denominators), slop list 13 (false precision) | none |
| Tab labels were cut mid-word at the row edges (medium) | A shared `tabScroll.js`: the chosen tab scrolls only as far as it must, and the row's left edge lands in the 24px gap before a tab, which is exactly the width of the fade. The row's end is padded so that a fully scrolled row also stops in a gap. The Compass programme row now runs the ladder's full width, with all four programmes on one line at 1440, and fades only at an edge with more names beyond it. | S016 (consistent identification), S011 | A little blank space can follow the last tab |
| Every heading used "Name. Grey clause." (medium) | Headlines are plain and in one ink everywhere except the close. The hero h1 is one ink too. Product names moved into the lede: "The Mistake Lab shows why...", "The Score Recovery Lab replays...", "Slide a score in DU Compass...", "Compass Pro turns...", "In the Combo Planner...". The docked bar still names the Lab. | S017, S018 (deliberate hierarchy over a template) | none |
| Too many volt keys (medium) | Volt stays on Start free and on Pro in pricing. "Check my subjects", "See programmes and past cutoffs" and the exam's "See Pro" are now secondary keys. | AGENT_RULES 7 (one main action) | none |
| MockMob's exam screen looked like the NTA one (low) | The app's own MockMob screen really has a palette (TestPageClient), so the preview keeps it. It now uses MockMob's labels ("Mark for review", "Clear", "Next", "Questions"), and NTA style keeps its long forms. The copy names what really differs: calmer colours, plain labels, and striking out options. | AGENT_RULES 24 and 27 | The preview is still about 1.3 screens tall on a phone |
| What Free includes was unclear (low) | "100 practice credits to start: a Quick Practice uses 10, a Full Mock 50". The figures come from the credit_balance default (migration 0011) and test_modes.js. The daily grant is off (migration 0027), so no refill is claimed. The Lab says "The SWOT is free and uses no credits". | T006, T007, AGENT_RULES 19 | none |
| "22 / 50" had no unit, and Recovery counted up from 0 (low) | The header now reads "22 / 50 marks". The Recovery result is printed whole from the start; only the tiles deal in. | AGENT_RULES 9, slop list 13 | none |
| The lineup objects bobbed forever (low) | The idle float's slot is now `none` on phones too, and the lineup's float and shadow loops are off at every width. Only the scroll-linked rise and the exit remain. | AGENT_RULES 31, slop list 6 | none |
| 17 type sizes at 1440, including the fluid 29.43, 51.2 and 66.78px (low) | Type sizes now step through the scale instead of scaling fluidly. The hero h1 steps 40, 48, 56 and 64px, --t-display 40, 56 and 72px, and the turning line 24 and 30px. Palette, strip and clock-dot numerals are 12px. A rendered scan finds 14 sizes at 1440 and 11 at 390, all on the scale. | S011 | none |
| Phone nav key 40px tall, dock visible under the menu, translucent dock (low) | The phone key's face is 44px. With the menu open, the dock steps aside and the bar's key hides, so the menu's own key is the only Start free on screen. The dock is opaque. | S016, slop list 1 | none |
| Desktop nav key popped in on scroll (low) | The key is in the bar from first paint, and its right edge meets the content column (1280 at 1440). | S011 | Start free shows twice on the first desktop screen (in the bar and the hero), as on most product sites |
| Post labels used "(1)" and "(2)" and wrapped at 1440, and the phone footer was a 1,400px column (low) | The posts read "26 April", "28 April" and "28 April, later", ordered by the id in each shortcode, on one line under the row's words. The phone footer sets its link groups two to a row. | S016 | none |
| "CUET 2027" in volt above the h1 (low) | Removed from the h1. The year now runs on in the lead: "...keeps your DU shortlist in sight, all the way to CUET 2027." | Owner slop list (a kicker above a heading) | The h1 no longer carries the exam name; the page title and meta still do |

### Verification (16 Oct 2026, my own headless Chrome over CDP on dev server :3122, real CDP pointer and wheel events)

- Flings were measured with the round 3 critic's own `fling.mjs`. The Lab, the tour and Recovery each moved 100% of a 60 x 40px stream at 390 and 1440. An 8-tick fling moved 100%, or 101% where the settle carried the page forward. Compass and DU moved 98 to 100%. See `mockmob-next/tmp/landing-1016/fix-3/fling-results.txt`.
- Full repair at 390 Night: open, three wheel ticks first scroll the repair's own last 42px and then the page. The scene stays on Repair (aria-expanded=true), and nine ticks give the same result. Close hands the scroll back, and a 3,000px spin then leaves the story. Captures are in `repair-open-*.png`.
- Compass: a drag to 710 (390 Night) and to 707 (1440 Day) reads the same 3s later and after leaving and returning. The sweep, sampled every 150ms, runs 780 to 650 to 780 in about 1.1s. All four programme tabs were clicked, and the chosen tab was wholly in view each time.
- Tour tabs walked by wheel at 390: in every settled state, the left edge sits in a gap.
- Pointer run at 390 Night and 1440 Day (`pointer-run.log`, `run-*/`): 33 targets were hit-tested with elementFromPoint and all were "ok". There were 0 console errors.
- Menu at 390 Night and Day: the dock's opacity is 0, the bar's key is hidden, and the nav key is 44px tall.
- Section captures at 390 and 1440, Night and Day, are in `fix-3/` (`<width>-<theme>-NN-*.png`). A rendered text scan finds no PrepOS, Radar or XP.
- Reduced motion at 390 Day: all three stories move the full 3,000 of 3,000px and step through their scenes.
- npm run test:app passes 256 of 256. The landing tests (src/components/landing/*.test.mjs plus landing_content, mistake_lab, lab_loop and sample_import) pass 77 of 77. ESLint is clean on every touched JS file.

Not run: a production build, or a real touch device. Native touch momentum is not emulated by CDP, so it was not exercised; with no interception left, it is the browser's own.

## Round 4 fixer (16 Oct 2026), answering the round 4 critic's defects

User task (unchanged): a CUET 2027 student lands on mockmob.in, tries five questions with no account, understands what
the Mistake Lab and the rest of the product do, and decides whether to start free or pay once for Pro.

### What changed and why

| Defect (severity) | Decision | Evidence | Trade-off |
| --- | --- | --- | --- |
| The sample's result rendered above the window, under the bar (medium) | When the result mounts, the card's top glides to 16px under the bar (250ms ease-out, instant under reduced motion). It moves only when the top is hidden or sits low in the window. Focus still goes to the score. | AGENT_RULES 15 and 18 (value before the account wall, say what happens next), T003 | The page moves once, in answer to the reader's own press |
| Features demoed twice: DU Compass, Combo Planner and Mistake Repair appeared in the tour and in their own sections (medium) | The held tour now has only the tools shown nowhere else: Practice, Replay, Weak chapters, Ask MockMob and Benchmarks (plus Learn when study content is on). The other three are named as links to where they live: "Also on this page: Mistake Repair in the Lab above; DU Compass and the Combo Planner, further down." On desktop that line sits in the tour's control row, so it stays in view through the tour. On phones it follows the tour. The Repair link lands on the Lab's Repair scene (DemoJump reads `data-ss-step`), not on the Lab's first scene. Every section stays. | AGENT_RULES 8 (rank by what helps the next decision), S011 | Desktop loses three tour mock-ups, each a repeat of a demo that is richer in its own section. The phone page is 25,267px (was 27,290px). The tour at 390 is 4,138px, with 5 beats instead of 8. |
| Two volt Start free keys on screen at once on phones (medium) | While the dock is up (shown, no held story live, no menu, not yet at the close), the bar's key steps out in 150ms and the menu button stays. The key comes back with its 380ms rise when the dock leaves. | AGENT_RULES 7 (one main action) | The bar's key comes and goes as held stories take the screen |
| Tour tab row cut "Weak chapte" and "Ask" at the right edge (low) | The row shows only whole labels. It is masked from the first tab wholly in view to the last one, with an 8px fade into the gap beyond, so a cut tab is hidden. The mask is written on every row scroll and on each change of the active tab, and fitRowEnd also runs on each change. | S016 (consistent identification) | Later tabs stay hidden until the row scrolls to them. "Next: ..." names the next tool. |
| The page moved by itself after a stop: +19px in the Lab at 390, +152px in the tour at 1440 (low) | The settle is gone. ScrollStory never moves the page after a stop. Its only scroll of its own is the glide that a tab, Previous or Next asks for. | AGENT_RULES 31, slop list 17 | A reader can rest between two scenes, and each scene is whole wherever the page rests |
| The Lab's calculator bobbed forever (low) | The 7.2s float and its shadow loop are off inside the Lab section. The object keeps its scroll-linked move with the story. | Slop list 6 | Mobi's breath and blink are the only loops left, as a character |
| "Two exam screens: MockMob or NTA style" read as free (low) | The fact now reads "Two exam screens: MockMob, and NTA style with Pro." | T006, AGENT_RULES 19 | It runs to three lines on a 390 phone |
| The Compass sweep rested on 780, where nothing clears (low) | The sweep goes 900, 760, 900 and rests on 900. The honest summary line stays: "900 clears 5 of these 10 Round I UR cutoffs (CSAS 2026-27)". | AGENT_RULES 29 | none |
| "Fresh checks open soon." read like an unshipped feature (low) | The line now reads "In this sample, each check unlocks on its day." Recovery is still not released (capabilities `blocked_content`), so the line describes the sample and does not promise the feature. Once it is released, the line reads "Open for every repair you finish." | AGENT_RULES 24, T007 | none |
| 11px and 9.6px captions inside the tour devices, and 26x25px palette cells at 1440 (low) | Every caption inside the tour devices is at least 12px. At desktop the palette column is 336px, so its eight columns give 33x36px MockMob cells and 32x32px NTA cells. The NTA hit slop no longer reaches into the next cell. | S016 | The exam's question column is 46px narrower at desktop |
| AI credits were stated only in the tour, and the pricing keys reversed the page's weights (low) | Free lists "10 Ask MockMob credits a month" and Pro lists "50 Ask MockMob credits a month". These match the wallet's defaults: 10 in the reservation RPC, and 50 for paid in the wallet tests. In pricing, Start free is volt as it is everywhere else, and See Pro is the secondary key. | T006, T007, AGENT_RULES 7 | Pro's key is quieter, but its price is still the largest figure in the section |
| A 188-follower account sat beside 161K and 12.7K (low) | Creators with an audience come first, in follower order. Below them, a quiet "Shared by a student" sub-line and a lighter row (the name one step down, in the second ink) hold Prathna Jain, a Hansraj College student. Her follower count stays on her row. | AGENT_RULES 5 (no inflated proof) | none |
| Blank bands of 150 to 200px after the held stories on phones (low) | Phone sections (under 600px) now pad 64px above and 72px below (was 80 and 88). The tour now ends on its "Also on this page" line, so the gaps after the tour and after Compass Pro are one short band. The content-visibility size estimates were re-measured at 360, 390, 430, 960 and 1440 and updated. | AGENT_RULES 28 (whitespace separates ideas) | Sections sit closer together on phones than on tablets |

### Success metric and guardrails (AGENT_RULES 37)

- Primary measures:
  - Sample drill starts per landing visit (a subject picked in the hero sample).
  - Drill completion to signup (the result seen, then Start free pressed in the same session).
- Guardrails:
  - On phones, the median scroll depth still reaches the top of the pricing section.
  - The bounce rate on phones does not rise.
  - Start free presses from the dock and the bar together do not fall now that the bar's key steps aside.
- How to read it: compare the two weeks before and after the deploy, with phones and desktop counted apart. This branch adds no analytics events, so these numbers come from the existing ones. The owner decides whether those are enough.

### Verification (16 Oct 2026, my own headless Chrome over CDP on dev server :3122, real CDP pointer and wheel events)

- Drill result at 390 Night (Economics) and 390 Day (Accountancy), every press a pointer click: after "See your result", the card top moves from -1 to 77 in about 150ms (the bar ends at 61), so the score is the first thing under the bar. Captures: `fix-4/run-drill-*-390/01-result-as-landed.png`.
- Keys: I swept the whole page in 300px steps at 390 Night (83 stops), 390 Day (82) and 1440 Day (71). No stop shows the bar's key and the dock's key together. At Compass on a phone, only the dock's key shows (`check-*-390/dock-at-compass.png`).
- Tour: 40 wheel ticks walk all five scenes at 390 Night, 390 Day and 1440 Day. No tab is cut in any settled state (`check-*/tour-*.png`, `check.json`).
- Tour links: a pointer click on "Mistake Repair" lands on the Lab's Repair scene (`data-step` 2) at 390 Night and 1440 Day. "DU Compass" puts #compass 78px from the top at both widths. Every target was hit-tested.
- Drift: three stops (two in the Lab, one in the tour) keep the same scrollY for 1s afterwards at 390 Night, 390 Day and 1440 Day.
- Exam palette at 1440: NTA cells measure 32x32 and MockMob cells 33x36. I captured pricing, Instagram, Compass at 900 and the hero facts at 1440 Night and Day (`spots-night-1440/`, `run-links-day-1440/`).
- A rendered text scan at 390 and 1440 finds:
  - no PrepOS, Radar or XP;
  - no horizontal overflow;
  - 0 text nodes under 12px inside the tour devices;
  - no infinite animation inside the Lab (the only running loops are Mobi's breath and blink).
- Every run logged 0 console errors.
- npm run test:app passes 256 of 256. The landing tests pass 77 of 77 (src/components/landing/*.test.mjs plus landing_content, mistake_lab, lab_loop and sample_import). ESLint is clean on page.js and every landing component.

Not run: a production build and Lighthouse. Free memory was 1 to 3 GB while another agent's dev server was running, and a `next build` next to it could have taken that server down. Run `next build` and Lighthouse mobile once before the owner's review. No real touch device was used either.
