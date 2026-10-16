# Design decisions: arena pass 2 (Progress, Review with Revise and Rules, Radar)

Branch `deploy/batch-1016c` (worktree `wt-polish`), builder W2, 16 Oct 2026. Second pass on the three pages the deploy gate's critic scored 16 of 24 (`arena-core` group, journal `wf_59177b1b-ca6`). The fixer pass (`deploy-batch-1016.md`) already fixed the `.rv-empty` collision, names, icon tiles, the rule book's repeated buttons and several minors; this pass changes the information architecture and the anchors. Format per `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md` rule 39; evidence IDs from its source ledger. Nothing was removed: every figure, link, state and feature from before is still on the page, moved or composed.

## User tasks

- **Review:** "What do I still have to look at, and where do I start?" Then the way into Revise and the rule for the next mock, then the sessions themselves.
- **Progress:** "How is my week going, and what earns the next study day?" Then the longer record (weeks, milestones, sessions, checks, playbook).
- **Radar:** "Where are my marks going?" Marks first, then the trend, then what stands out and where to practise.

## What changed and why

### Review (`RecoveryOverview.jsx`, `recovery/overview.css`, `LearningNextAction.jsx`)
- **One anchor with its denominator.** A lead section: the count of questions to review set large (64 px phone, 88 px desktop), its heading "questions to review, of 20 answered", one line naming the session to start with ("Your newest session has 3 of its 10 questions to look at"), and the one volt action "Open Accountancy, 15 Oct" (the newest session that still has misses). The rolling count when new misses arrive is kept (RollNumber). Before, the page opened on a "Newest:" line and a four-figure strip with no lead. AGENT_RULES 7, 8, 9.
- **The ways in sit right under it.** "4 questions to revise today" and "Your rules (7)" moved from the foot of the page to directly after the lead (ruled rows, underlined titles). They were the only entry to Revise and Rules and sat below the practice card.
- **Facts said once.** The "Newest:" milestone line is not repeated on Review when the lead already opens that session (the critic's "same two facts three times"). The remaining three figures (sessions saved, answered right with "12 of 20 answers", last session) now head the session list as one ruled line of three; the "Questions to review" figure became the lead, so no number is lost.
- **One primary action.** The practice step ("Your next step: Start 10 practice questions") becomes a quiet ruled row with an outline Start when the lead already has the volt action (`quiet` prop on the compact LearningNextAction; Today and Radar are unchanged). With no misses left it stays the volt action.
- **States.** Empty Review keeps the composed Mobi scene with "Choose practice" as its only volt action (Mobi's one moment on the page); the practice step under it is quiet. Error and loading keep their designed alert and skeleton.

### Revise and Rules (`revise/revise.css`, `rules/rule-book.css`)
- **Revise:** the question no longer sits in a card holding option cards. The question is set on the page under a hairline; the options keep their edges because they are the controls; the answer result is ruled text, not a box.
- **Rules:** the chosen rule is the page's anchor, said at statement size (22 to 26 px) between hairlines, not in a lime-edged card. In the list the chosen rule is marked by a check and "Your rule for your next mock" in accent ink, not a tinted row and a pill. Empty and gate lines are ruled text, not dashed boxes.

### Progress (`progress/page.jsx`, `RecoveryOverview.jsx`, `RhythmCard.jsx`, `progress/progress.css`)
- **Reading order in the DOM, not by CSS `order`.** The header used to render after the rhythm card and be pulled up with `order: -2`, so screen readers met "Your study days" before the page's h1. Progress now renders inside RecoveryOverview in reading order: header, the week, the next step, then the record.
- **The week is the anchor, the next step follows it.** The ring ("3 of 4 days") and the day row lead; directly under them the next step (volt Start), so "1 more study day to meet your weekly goal" is followed by the action that earns it. RhythmCard's full form takes a `between` slot and splits into the week and "Your weeks and milestones"; the compact Today card is unchanged.
- **Weeks readable without a tap.** Each week is a labelled column that fills the row ("31 Aug" ... "This week"); the heading carries the count over its denominator, "Goal met in 1 of your 6 finished weeks" (the open week is excluded because it is still running). Over eight weeks on a phone only the first and current dates show; one to three weeks keep a set column width. The 390 px overlap of the old 12-column ribbon is gone.
- **Headings that say something.** "Three paths" is now "Milestones: 5 of 9 steps done". The record section is headed "Your record so far" with its source.
- **Mobi at most once.** Mobi's count line ("Two sessions saved. Eight questions to look at.") was a restating companion; its facts are now a plain ruled line in the record, "Eight questions to look at in Review / From two saved sessions. Open Review". Mobi appears only through the week's own moments (a fresh or met week), as before.

### Radar (`analytics/AnalyticsPageClient.jsx`, `ai/RecordView.jsx`, `analytics/TrendScrub.jsx`, `analytics/analytics.css`)
- **Marks lead.** "Across your mocks" moved from above the marks to after "What stands out", so the ledger (net marks +48, with right, wrong, blank and accuracy over 24 answered) is the first thing under the next step.
- **Trend after the marks on phones.** Below 1100 px the "Score by session" chart and "By subject" sit inside the record right after the marks (RecordView `afterLedger` slot), not as the last block after about 3,500 px. Above 1100 px they stay in the sticky right column. One layout is rendered at a time (`useSyncExternalStore` on the media query), so there is no duplicated markup.
- **The chart ran off the page.** `.tr__plot { padding-right: 10px }` fed its own width back into the ResizeObserver, so the SVG grew by 10 px a frame (3,440 px measured at 1440 against a 340 px column). The padding is gone and the plot's own right margin (PAD.r 24) keeps the last point and its date clear of the edge.
- **One Pro line.** On the free plan the two near-empty Pro rows ("Changed answers", "Pace") are one closing section, "Changed answers and pace", with the same facts and the same See Pro. Pro students see both sections as before. The Mentor record tab passes none of the new props and is unchanged.
- **Two definitions said.** By subject reads "3 sessions, mean session score 47%" and "50% of answers right" (the API's `avg` is the mean of session scores; `accuracy` is right answers over questions).
- **Empty Radar has one action.** The record's empty state no longer adds a second volt "Start a set" under the volt next step (`emptyAction={false}`); the Mobi scene and its words stay.
- **Ledger at phone width.** The two-column ruling was mirrored (the side rule sat on the left column); Right and Blank now sit flush left with the rule between the columns.

## Rubric (0/1/2, 12 dimensions; owner signs off)

| Page | Before (gate) | After (this pass) | What moved the score |
| --- | --- | --- | --- |
| Review (with Revise, Rules) | 16 | 21 | IA 2 (lead, then ways in, then sessions), hierarchy 2 (one anchor with denominator), specificity 2 (no card in card on Revise, no pill or tinted row on Rules), states 2, responsive 2. Accessibility, motion and instrumentation stay 1. |
| Progress | 16 | 21 | IA 2 (week, next step, record, in DOM order), truth 2 (met weeks over finished weeks, milestones over steps), hierarchy 2 (headings that say something), specificity 2 (labelled week columns, ruled record), responsive 2 (no ribbon overlap at 390). Accessibility, motion and instrumentation stay 1. |
| Radar | 16 | 20 | IA 2 (marks first, trend after marks on phones, one Pro line), truth 2 (average and accuracy defined; the two change counts already name their source), specificity 2, responsive 2 (chart no longer grows off the page). Accessibility, motion and instrumentation stay 1; hierarchy stays 1 until the page header and the full-width column match the other arena pages. |

12-part anti-slop test, after: identity pass; one primary action pass on all three (Review's lead, Progress's Start, Radar's Start); true content pass; first-scan hierarchy pass; composition pass (hairlines and whitespace, no card holding cards); type by role pass; states pass (ready, empty, error, sparse checked); interaction pass (real pointer clicks below); no pseudo-evidence pass; motion reason pass (ring count, week fill and chart draw answer arrival and respect reduced motion); one metric plus guardrail not assessable here; "what is better without this": the repeated "Newest" line and Mobi's restating line were folded into the anchor and the record.

## Evidence IDs
S014 (progressive disclosure: Pro detail folded into one line; secondary figures under the list, not above the action), S016 (WCAG 2.2: DOM reading order on Progress, 44 px targets kept, labels not only by colour, reduced motion), S015 (honest state: finished weeks only in the denominator; "too few" kept on the rule bands), S017 and S018 (cards, pills and tinted rows removed as defaults without intent), T005 and T009 (no urgency on the Pro line). AGENT_RULES 7, 8, 9, 12, 29, 31, 33, 35.

## Trade-offs
- Review's lead opens the newest session with misses, not the one with the most misses: students think in recency, and the session list beside it shows every count.
- The practice step on Review is quiet whenever a session has misses; a student who wants new practice still has it one row down and on the tab bar.
- Progress splits RhythmCard into two sections; anything styling `.rc` on Progress now also reaches `.rc--more` (handled in `progress.css`, including the result page's 40 px `.rc` column rule).
- The Radar phone layout depends on a media query read in the browser; until it answers (first client render) the side column renders in its desktop place, which is also where it renders when the record is loading or failed.

## Open assumptions
- `first_session` is the only milestone that only points at the newest session; others still show on Review.
- "Mean session score" is the right plain name for the analytics `avg` field.

## Screenshots
- Before: `mockmob-next/tmp/1016-gate/w2-pass2/before/` (28 captures: progress, review, rules, revise, radar ready at 390 and 1440 in Night and Day; empty states in Night). These used full-page capture, which in headless Chrome served stale frames for the animated chart; the critic's own set is in `tmp/1016-gate/arena-core/`.
- After: `mockmob-next/tmp/1016-gate/w2-pass2/after/` (scrolled viewport slices `-sN`): the same pages and states, plus `record=down` errors (390 Day, 1440 Night), `data=empty` Progress at 1440 Day, reduced motion (Progress 390 Day, Review 1440 Night) and the click checks `click-*`. Contact sheets (Night beside Day) in `w2-pass2/sheets/`.

## Verification
- Own headless Chrome over CDP on the shared dev server (port 3180, `/preview/arena`), 390x844 and 1440x900, Night and Day, every capture looked at. No horizontal overflow on any capture (scrollWidth equals clientWidth); no console errors.
- Real pointer clicks (mouse pressed and released at the element centre, element confirmed on top): Progress week column ("Week of 14 Sep: 1 of 4 days, goal not met"; 390 Day: "Week of 28 Sep: 4 of 4 days, goal met"); Radar chart dot ("41% in session 1, your first session here"; 390: "52% in session 2, 11 up on the session before"); Rules "Use in my next mock" (chosen rule replaced, one in-use mark, saved toast); Revise options at 390 and 1440 (graded result shown); Review lead button (href `/result/preview-a1`; preview intercepts navigation).
- Chart width measured after the fix: SVG 340 px in a 340 px column at 1440, 360 px at 390 (was 3,440 and 3,680).
- `npx eslint` on every changed JS file: clean. `npm run test:app` 337 of 337, `npm run test:recovery` 272 of 272, `npm run test:learning` 277 of 277.
- Not done: no real device, no Safari, no screen reader pass beyond DOM order; no build (shared RAM); loading states read from code, not captured.
