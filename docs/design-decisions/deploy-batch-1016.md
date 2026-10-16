# Design decisions: deploy gate fixes for deploy/batch-1016

Branch `deploy/batch-1016` (worktree `wt-batch`), 16 Oct 2026. One fixer pass over the gate's 1 blocker, 36 majors and 54 minors (arena core, account and Compass, Mistake Lab, public pages). Format per `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` rule 39; evidence IDs from `source-ledger/EVIDENCE_INDEX.csv` (T001-T009, S010-S018). Nothing was deleted to fix a defect: every feature, state and data path is still there.

## User tasks

- A student on Review, Progress and Revise reads what is left to look at and opens the next thing (session, Revise, Rules).
- A student on Practice picks a mode and starts, and sees the real price and what is missing when it cannot start.
- A student asks Mobi for the next step, or reads why that step was chosen.
- A student after a mock reads where the marks went and repairs one mistake.
- A free or Pro student checks DU programmes and cutoffs and their own shortlist.
- A visitor reads pricing, AI credits, features and contact pages and can tell what each thing is called.

## What changed and why

### Arena core
- **`.rv-empty` collision (major).** The Revise stylesheet is now namespaced `.rvs-*` (`revise.css`, `ReviseRun.jsx`, `ReviseEntry.jsx`); `overview.css` targets `.rvs-entry`. Review and Progress empty states are ruled rows again; Revise's empty, finished and failed cards have real padding. Review's empty state uses the full column, Mobi scene beside the copy from 900 px. The Revise primary button uses the volt fill in Day (the olive select tone read as a slab).
- **Names (2 majors).** Sidebar, More sheet, hub header, drawer and launcher say **Ask Mobi** (names decision: "Ask Mobi everywhere"). Radar and Compass carry a plain descriptor in navigation ("Radar, weak chapters", "Compass, DU cutoffs") until the owner closes D10. "saved to Radar" is now "saved to your record". Result link reads "Your full record".
- **Icon tiles and nested card (Across your mocks, Rules).** Tiles removed from the head and lines; on Radar it is a ruled section, not a card. "Your rules (7)" is an underlined text link with no tile (count label changed from "Your rules, 7", which read like a typo).
- **Rule book.** One action per row ("Use in my next mock" as a text link); Copy moved into a row menu (`…`). Rules are a ruled list, not cards; habit icon tiles gone; the lime kicker with icon above the chosen rule is now a plain heading. The Wilson interval sentence reads "Too few cases to be sure yet" under 20 cases, else "Likely between x% and y%".
- **Practice figures.** Each figure carries its denominator: "56% over 2 sessions, too few to read much into"; rank counts real students only ("#1 of 2 students listed", the practice rival excluded).
- **Practice cost truth.** A blocked Full mock shows "Cost: 50 practice credits" and the action becomes "Need 10 more credits" (links to options); access-locked modes say "Needs Pro". The rule block uses a hairline, not a 3 px lime side border (T-083).
- **Practice at 390 (three Starts).** The dock now rises only after the student has scrolled into the setup (past 360 px) and the session card is out of view, so the first screen has one Start (the tab bar's) and the dock and the card's button never show together (R7). The NTA thumbnail clock is a still 60:00 (R22) on a darker bar (contrast).
- **Saved.** Rows are ruled list rows: question first, options only after "Try it again", Practise and Remove inside the row, no vote pill (QuestionCard `variant="saved"`). Error text no longer concatenates the raw API string; first-save line says "Saved." Fixture rows carry `saved: true`.
- **Start a session sheet.** Kicker removed, card background flat, NTA "Pro" pill removed (the cost line already says "Needs Pro.").

### Account and Compass
- **Compass Pro cutoffs.** Per-programme load state: skeleton while loading, "Cutoffs did not load. Try again" on failure, "This college is not in DU's 2026 list for this programme" when the file has no row, and "Not listed / DU listed no cutoff for this category" only when the file loaded and the category is empty. The fixture now uses the real `b-com-hons` programme.
- **Projection.** Leads with the range at reading weight ("541 to 794 of 1000"), midpoint rounded to 25 and labelled; per-paper bars stay the anchor.
- **Compass free.** Calculator first; the 1-2-3 list folded into the lede; Compass Pro is one quiet row after the results (Pro students still see their projection and colleges above the tool). Note shortened; practice bridge flags a small sample.
- **Leaderboard.** Ranks and "Your place" count real students only; the practice rival is a labelled benchmark line under the table, not "1st place"; the duplicate top-three block is gone; one error sentence.
- **MobileDock** has no arrow. **Combo planner**: numerals removed, a sticky outcome bar ("2 combinations, best fit 4 papers", "View combinations") on phones and tablets, results named "Combination 2" (not "Option 2", which the calculator uses for eligibility rules), the calculator link underlined.

### Mistake Lab and Mobi
- Mono ALL-CAPS labels in the hub are sentence-case 13 px sans; base `.btn-volt` / `.btn-outline` lost uppercase, tracking and glow everywhere (the drawer lives outside `.app-shell`), so drawer, hub and public buttons agree.
- Build talk removed: plan copy reads "Recovery steps are not open yet"; the Product rule row and the server-facts sentence are gone; an empty first name gives "Here is your next step." The Mobi handover block was cut; tabs shortened ("AI credits"); the console card aligns with the title.
- **/recovery** has one heading and one action ("Recovery steps open soon." then "Review your mistakes"), a real empty state ("Nothing to review yet" with Start practice) and a real error state ("This page did not load", Try again, Open Review); no outer card.
- Arrows removed from Lab, repair, Same mistakes later, ledger do-lines, Rules and Revise entries, hub buttons and suggestions, correction source link.
- Lab: Find/Repair/Prove are plain headings between hairlines (no discs or rail); chapter rows, observations, rule check, Same mistakes later and ledger rows are ruled, not cards in a card; tile icons hidden.
- SWOT: no colour dots; a quadrant that only points to the ledger is left out.
- Side borders over 1 px: answer rows (verdict now tints the badge), observations, repair pull line (1 px), Ask notice (1 px border).

### Public
- **Blocker /pricing/prepos.** Replaced by `/pricing/ai-credits` (permanent redirect from the old address; links, checkout callback and tests updated). Plain page on marketing tokens: no orb, gradient, grey slabs or caps; signed-out visitors get one sentence and "Log in" instead of uncaptioned tiles; signed-in students get labelled figures. Contrast is the standard ink tokens (AA in Day and Night).
- Names: pricing, landing tour, signup, login card, about, subject hubs, privacy, terms and SEO metadata use "chapter review" and "Ask Mobi"; XP is "points".
- Cutoff calculator: "Round 3", "Round 1/2/3" columns, card header through `optionLabel()`; landing Compass ladder and tour caption too.
- /features rebuilt as a ruled list of the real product parts with one link each and one "Start free" (no eyebrows, orb, badges, numbered circles or sample numbers).
- Pricing table: sentence-case heads and group labels and mobile cell tags; "Full access" flag removed; 3 px inset rule replaced by bold row text; dock repeats the card's action ("Get access for Rs 99" to #plans); band above the cards tightened.
- /contact: one address, one "Email support", then a four-line "What to include" list.
- /coming-soon: "Enter preview", no arrow, no glow.
- SEO pages: arrows removed, headings sentence case, a "Start a free mock" action under the H1.

### Minors done
Review rows read as links (underlined titles), "Your rules (7)", Review drops the duplicate Mobi count, newest link names its target; Progress retitled "Your study days and checks."; Radar down-trend in neutral ink, idle scrub rule hidden, change counts name their source ("saved timed sessions"); Today's second "See your full record" removed and its error actions separated; Practice and Radar errors no longer show raw server text; ring caption floor 11 px; sidebar fits 900 px; More sheet is a text list; expired Pro shows "Your Pro access ended on 1 September 2026" on Practice and Account with "See Pro to renew"; Pro credits line carries the year; My colleges keeps keyboard focus (aria-disabled), confirms moves and removals in the live region and offers Undo; Compass placeholder "Find a subject"; theme hint hidden on pages with a sticky summary bar; dock hidden while the menu sheet is open; landing DU teaser count no longer sticky; repair tracker opaque; out-of-credits repair state offers Practise 5 and See your AI credits; Lab basic says the device-record line once; late-night Mobi line is a next step, not "Goodnight."; rules fixture for `data=empty` is an empty book; login explains its waiting button; signed-out calculator rows show "Sign in to save"; about H1 "Built for one exam: CUET."; landing plan strip casing; planner placeholder shortened.

### Not changed (and why)
- Radar: Pro rows not merged, chart not moved above the answer sheet on phones, "average vs accuracy" not redefined (needs a data-definition decision).
- Progress week ribbon labels; Saved/arena column widths; topbar chips still number-only (aria-labelled); theme switch not in the 390 topbar (it is 64x44 already).
- Account balances still shown in three places; weekly-goal fills; Compass "Add to my colleges" density; credits fixture stub.
- Replay chip clipping and sub-11 px SVG labels; repair chip grouping; held and not_kept fixture contradictions; ledger mono figures.
- Cutoff calculator mobile picker collapse and select width; login pitch order on phones; about band; /api/stats 503 in dev; landing hero items (landing branch).

## Evidence IDs
S016 (WCAG 2.2: contrast blocker, focus kept on reorder, 44 px targets, consistent names), S014 (Copy behind a row menu, options behind "Try it again"), T003 and T004 (value before the account wall: "Sign in to save" keeps the calculator choice), T005 and T009 (no ticking countdown on Practice, no urgency pills), T006 (pricing dock repeats the one real offer, no second competing action), T008 (projection shown as a range, not a precise midpoint), S015 (honest state: cost shown even when blocked; "Not listed" only for real data), S017 and S018 (icon tiles, nested cards, kickers, glow and caps removed as defaults without intent). AGENT_RULES 7, 9, 24, 33, 35.

## Trade-offs
- Removing the uppercase and glow from the base buttons changes every public page that used them; that is the intent (one button language), but the landing branch should be checked at merge.
- The Ask Mobi hub lost its Mobi handover block; Mobi remains as the orb and in the drawer.
- The practice dock now waits for 360 px of scroll; a student who never scrolls uses the card or the tab bar.
- Landing renames will conflict with the landing redesign branch (which already removed these names); keep that branch's version on merge.

## Open assumptions
- "Ask Mobi" is final for the assistant; Radar and Compass keep their names with descriptors until D10 closes; "chapter review" is the public stand-in for Radar.
- An end date with `isPremium` false means Pro has ended (the server clears `isPremium` at expiry).

## Screenshots
- Before: `mockmob-next/tmp/1016-gate/{arena-core,account-compass,mistake-lab,public}/` (gate captures).
- After: `mockmob-next/tmp/1016-gate/after/<screen>-<390|1440>-<night|day>.png`, 41 screens: review-empty, review-ready, progress-empty, progress-ready, revise-empty, review-rules, radar-ready, saved-ready, practice-ready, practice-fullmock-selected, practice-expired, practice-390-scrolled, today-ready, mobi-plan, mobi-drawer-plan, journey-ready, journey-empty, journey-down, chrome-start-session, chrome-more-sheet, chrome-sidebar, result-full, result-lab-basic, compass-free, compass-pro, leaderboard-ready, account-plan-expired, pricing-ai-credits, pricing-full, features-full, contact-full, coming-soon-full, signup-full, login-full, about-full, combo-filled, cutoff-calculator, mock-test-free, subject-accountancy, landing.

## Verification
- Headless Chrome over CDP against the wt-batch dev server on 3150 (preview fixtures for the arena), 390x844 and 1440x900, Night and Day, full-page. Looked at: Review empty and ready, Progress empty, Revise empty, Rules, Saved 390, Practice full mock and expired, Practice 390 scroll states (dock only when the card is away), Start sheet, More sheet, drawer, Radar, /recovery ready and error, Compass free and Pro (real cutoffs, failure state seen before the fixture fix), Leaderboard, AI credits, pricing, contact, combo planner, SEO page, landing. Redirect checked: `GET /pricing/prepos 308` then `/pricing/ai-credits 200`.
- `npm run lint` clean. Suites: test:app 328/328, test:recovery 231/231, test:learning 277/277, test:nta 169/169, test:du 19/19, test:auth 52/52, test:answer-integrity 11/11, test:study 37/38 (the failing case is the WordNet licence check: `data/study/sources/WORDNET-LICENSE.txt` is checked out with CRLF on Windows, so it no longer equals the stored licence text; untouched by this batch).
- `next build --webpack` passed (Turbopack refuses the symlinked node_modules in this worktree). Three small edits landed after the build (sidebar spacing, /recovery error heading, planner placeholder); lint and suites were rerun after them.

## Rubric (0/1/2, fixer's self-score after the pass; the owner signs off)
Task fit 2, information architecture 2, content truth 2, readable hierarchy 2, visual specificity 1, accessibility 2, functional states 2, trust 2, intentional motion 1, performance 1, responsive integrity 2, instrumentation 1. Total 20 of 24. The critics' own totals were not part of the fixer's input, so they are not restated here.
