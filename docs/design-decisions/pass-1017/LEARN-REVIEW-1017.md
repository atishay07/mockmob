# Learn and Review, pass 1017 (F15): find, fix, keep, with one next move

Design decision for Review, Revise, the Mistake Lab's place, and Learn (Concepts), on the website and in the app. Decision document and static mocks only; the build comes after. Written 17 Oct 2026. Revised the same day after an independent critic scored the first pass 6.2: section 14 maps each of its 21 points to the change, and every number now comes from one fixture (section 9).

Owner ledger items answered: **F15** (primary), **F17** (saved repairs and the paper with its time), **F18** (features at their moment, paid value felt), F11 and F14 (one clear answer, one next move), F16 (keep what works, never cut), L12 (Review must reach the record and never show the wrong empty state), L13 (Repair worth paying for), L14 ("Review again"), L35 (one Mobi per screen). Evidence ids are from `docs/research/premium-ux-ui-2026-10/source-ledger/EVIDENCE_INDEX.csv`, rule numbers from its `AGENT_RULES.md`, and adoption items from `docs/brain/FEATURE-ADOPTION-2026-10-17.md` (FA-1 to FA-14).

---

## 1. The problem, in his words

From `docs/brain/OWNER-FEEDBACK-2026-10-17.md`, 17 Oct about 12:45 am and 1:20 am:

- F15: "The learn and review section I'm not even going to look at. I know there are many things which need refinement there, so I just don't want to get disappointed right now."
- F17: "In the review, when I go to review any wrong answer which I had just attempted, the things which I had already repaired... are getting lost. I have to repair it again and spend another credit... it should show the mock time and date when that was attempted in the review section."
- F18: "Overall, the UI/UX choices are still very confusing, even to me... Even last year, students were confused, and they didn't use 90% of the features because they didn't actually know what they were to do with this."
- F11 (his taste for this kind of screen): "The SWOT analysis repair thing is just too much and too confusing. This is coming from a person like me who already understands everything on the site."
- F14: "very cluttered, very confusing."

And from the 16 Oct ledger: L12 "Review is also showing me that we could include your mistakes" (the empty state on an account with papers) and "I couldn't reach my record"; L13 "We can't ask them to pay extra to just see the right answer"; L14 "Review Again is not working".

**The job of Review, in one line:** a student opens it and knows at once what is still costing them marks, what to do about it now, and that the mistakes they already fixed are staying fixed.

**The job of Learn, in one line:** when a student is missing the idea behind a mistake, the lesson for that idea is right there, at that moment, without them having to remember that a Learn section exists.

---

## 2. What exists now

### 2.1 Website (release branch `deploy/web-1017`, 97210ab0; live main c3b1e215)

Captured from the development fixtures in a temporary worktree of `deploy/web-1017` (`next dev --webpack -p 3263`, headless Chrome, stopped and removed after). Files in `tmp/design-1017/learn-review/live/`, named `live-{page}-{width}-{night|day}[-full].png`. Pages: `review`, `review-saved` (F17 state: Mock 3 with 2 repaired), `review-empty`, `review-error`, `review-loading`, `revise`, `revise-empty`, `rules`, `progress`, `lab-result` (the Mistake Lab on a full mock), `learn` (the `/preview/study` library), `lesson` (a lesson overview opened from the library), `run` (step 1 of that lesson). Every page at 390x844 and 1440x900 in Night and Day, plus a full-height Night capture at both widths: 74 files. The list is in section 13.1.

**Review** (`/review` → `src/components/RecoveryOverview.jsx`, `view="review"`), top to bottom:

| # | Block (as it reads) | Source |
|---|---|---|
| R1 | Head: "Review what mattered." / "Open a session to see why each miss happened." | `ArenaHead` |
| R2 | Lead: a big count "N questions to review, of M answered", "Your newest session has K of its T questions to look at", volt **"Open Accountancy, 16 Oct"** (opens the result page) | `rv-lead` in `RecoveryOverview.jsx` |
| R3 | Milestone notes ("Your first session is on the record.") | `noteList` |
| R4 | Two underlined link rows: **Revise** ("4 questions to revise today, 7 questions in rotation, 2 recalled twice") and **Your rules** ("Your rules (7)" with the active rule) | `revise/ReviseEntry.jsx`, `rules/RulesEntry.jsx` |
| R5 | Record finding and paper trend (moved here from Today on 17 Oct) | `ai/RecordGlimpse.jsx` |
| R6 | "Your 3 sessions": three figures (Sessions saved, Answered right %, Last session), then one row per session: subject object, "Mock 3, 16 Oct, 9:40 pm", "34 of 50 correct, 2 repaired", accuracy bar, "N to review" / "All repaired" | `Figures`, `SessionRow` (F17 stamp from `data/repair_paper.mjs`) |
| R7 | A compact second next step (Today's plan card) | `LearningNextAction compact` |
| R8 | **Study record**: "12 cards are due for review", lessons-read ring, "Review due cards" / "Lock in new cards" button (renders only with study data, so it is absent from the arena fixture captures) | `study/StudyProgress.jsx` |

What the captures show beyond the table (live, `deploy/web-1017` fixtures):

- **Two lime fills in one viewport.** At 390 the page volt "Open Accountancy, 16 Oct" and the lime-filled dock Start key sit together; at 1440 the sidebar's lime "Start a session" key and the page volt do the same (`live-review-390-night.png`, `live-learn-1440-night-full.png`). The empty state has three: "Choose practice", the compact plan's "Start 10 practice questions" and the Start key (`live-review-empty-390-night.png`).
- **The error state already differs from the empty state on the web** ("Your record did not load ... Your saved sessions are safe", Try again; `live-review-error-*`), so L12 is now an app problem and a rule to keep, not a web bug.
- **The F17 fixture** (`live-review-saved-*`) shows "6 questions to review" with the repaired count only on the session row: a repaired mistake is not visible as a mistake anywhere on Review.
- **Revise's own head says the split out loud:** "Same question, so this checks memory. A check on new questions is separate." (`live-revise-390-day.png`), above Box lanes and a 5 or 10 a day switch, before the first question.
- **The lesson run** labels its step in a monospace "Step 1 of 4" with a lime "New words" eyebrow (`live-run-390-night.png`); the lesson overview stacks three boxed chips (subject, skill, minutes) above the title (`live-lesson-390-night.png`).
- **The Mistake Lab on a full mock** (`live-lab-result-*`) already leads with "Do this next / Repair Q42" (RESULT-1017 shape), which is the pattern Review's head adopts below.
- The study fixture has no due cards, so the recall run could not be reached on the web; the app goldens `run_card_*` cover it. The arena fixture's sidebar also omits Learn (the fixture builds its links from its own view list); `src/lib/arenaNavigation.js` has it in Study.

**Revise** (`/review/revise`, `revise/ReviseRun.jsx`): "N questions to revise today", four box lanes (Box 1 to Box 4, back after 1, 3, 7, 21 days), 5 or 10 a day, then one question at a time. It holds **every wrong answer** (`data/revise.js`), costs nothing and is outside accuracy.

**Rule book** (`/review/rules`, `rules/RuleBook.jsx`), **Progress** (`/progress`, the same component with `view="progress"`), **Mistake Lab** (on each result: `ScoreRecoveryLab.jsx`; its new shape is decided in RESULT-1017).

**Learn** (`/learn` → `study/StudyWorkspace.jsx` → `StudyLibrary.jsx`; `/learn/[id]` → `LessonOverview.jsx`; `/study/[id]` → `StudyRun.jsx`; `/learn/summary`):

| # | Block | Source |
|---|---|---|
| L1 | "Learn" and a lede explaining the product ("Learn one concept, lock it in from memory, then prove it…") | `StudyLibrary.jsx` |
| L2 | Hero with one volt: Finish your lesson / "12 cards are due for review" + Start review / Next lesson / Lock in new cards / You're up to date | `hero` in `StudyLibrary.jsx` |
| L3 | A paragraph explaining the three steps (Learn, Lock it in, Apply) | `sx-flow` |
| L4 | Subject tabs (4) with counts, a large subject object, "N lessons across K of M chapters" | `sx-tabs`, `sx-subject` |
| L5 | Chapters in syllabus order, each with lessons (ring, title, summary, minutes, recall cards, status) and Practise | `sx-chapter`, `UnitRing` |
| L6 | "N more chapters, practice available, lessons later" fold | `sx-untaught` |
| L7 | Study record figures and "See your marks in Progress" | `sx-record` |
| L8 | "Ready to test yourself?" row with an **arrow icon** | `sx-mock` |
| L9 | Study preferences and weekly plan fold (Pro: day-by-day plan, mixed revision) | `StudyPreferences` |

Learn is reached from the More sheet, the desktop sidebar, a "Concepts" panel on Practice ("Open Learn"), and `MistakeLessonLink` on the result's Repair step. On 17 Oct the phone dock moved Learn into More (NAV-1017).

### 2.2 App (v13 branches)

Goldens opened from `wt-v13-review/flutter_app/test/golden/` (branch `ui/v13-review`, 8fe53c87) and `learn/goldens/`; v12 device shots in `mockmob-next/tmp/app-walk-1017/1A/`. The ones this decision is built on:

| Golden | What it shows |
|---|---|
| `review/goldens/r390_tab_full_night.png` | Review: "Tonight's repair, Accountancy", **3 mistakes**, Q chips, volt "Repair 3 mistakes, 10 min"; segmented **To repair / History**; a **Revise** note card with "Open Revise / Got it"; "Mistakes to repair, 7 left across 4 chapters, 1 repaired, 8 found" with a pip strip; chapter rows (object, "1 of 5 repaired", count to repair); "Not attempted in Mock 2 (3)"; rows **Review again**, Where your marks go, Saved questions, Your rules |
| `review/goldens/r390_tab_rows_open_night.png` | An opened chapter: question rows with "Mock 2, 12 Oct, 10:42 PM" and a lifeline **Found → Repaired** ("Saved repair from 4 Oct, 11:08 PM. Opens free."), "Repair 3 from Mock 2", "Repair 1 from Mock 1" |
| `review/goldens/r390_tab_history_night.png` | History: a **Mistake Lab** note card, "Next from Mock 2" with Set up, **Repair record**, Past results with marks bars |
| `review/goldens/r390_repair_entry_night.png` | Repair entry: "What Repair gives you" (Try it again, The reason, A checked question), the four-stage line **Found, Repaired, Retested, Still right**, cost pinned over Begin |
| `review/goldens/r390_tab_empty_night.png` | Empty: lamp-lit scene with Mobi, "Nothing to review yet", an example row ("Question 4, Partnership, Example"), volt "Start 10 questions" |
| `review/goldens/revise_card_night.png` | Revise: "4 questions to revise today", 5 or 10 a day, **Box 1 to Box 4** lanes, the question |
| `review/goldens/r390_again_question_night.png`, `review_again_*` | **Review again**: a repaired mistake answered before the key shows (a separate run from Revise) |
| `learn/goldens/learn_tab_full_dark.png` | **Concepts**: "12 cards due" hero with volt "Review due cards", subjects with lessons, chapter summaries, untaught chapters |
| `learn/goldens/learn_tab_first_visit_dark.png`, `unit_new_dark.png`, `run_*`, `done_*` | Concepts first visit, a lesson page, the lesson and recall runs, their endings |

The app is already much closer to the target than the website: it is organised by mistake and chapter, shows the paper and the 12-hour time (F17), and has the four-stage lifeline. Concepts is reached from Practice (`practice/widgets/concepts_shelf.dart`, the setup screen and the confirm sheet), not from the bar.

### 2.3 Diagnosis: why Learn and Review confuse a student, and the owner

Read against the adoption research (Find, Fix, Keep; one next move per screen; features at their moment; receipts; empty states that teach; plain names priced in marks):

1. **The loop has no names a student can hold.** Find is "the Mistake Lab" on a result, "Where your marks go" in the app, "Review what mattered" on the web. Fix is "Repair", "to review", "to look at". Keep is spread over **four** separate mechanisms with four names: **Revise** (wrong answers back after 1, 3, 7, 21 days), **Review again** (a repaired mistake answered before the key), **Check it held / Retested** (a new question on the same rule), and **cards due for review** (Learn's recall cards). Each has its own count, its own page and its own run. A student cannot tell which one to do, and the owner said the result was confusing "even to me".
2. **"Review" means three things.** It is the tab; Learn's button says "Review due cards" (recall cards, not mistakes); the web lead says "questions to review" (mistakes); the app has "Review again" (a third run). The same word for different actions breaks consistent identification (S016, AGENT_RULES 11).
3. **The web Review is organised by session, not by mistake.** Its volt sends the student away to a result page to find the mistakes there. The mistakes from three papers never meet in one list, so the costliest chapter across papers is invisible, and F17's "repaired already" can only show as a count on a session row.
4. **More than one next move per screen.** Web Review: the lead volt, the Revise and Rules cards, the compact Today plan card and the Study record's "Review due cards" button are five competing calls. Web Learn: the hero volt plus "Review them" plus the full-mock row. App Review: the hero volt plus the Revise note's "Open Revise" plus "Review again". (AGENT_RULES 7; FA-2, FA-3.)
5. **Numbers that do not say what to do.** "72% answered right, 34 of 47 answers", "Sessions saved 3", "Last session 16 Oct", "12 cards in review", "41 recall answers", "Box 1: 4". None is priced in marks and none says what changed because of the work. The one number that matters, how many marks the open mistakes cost and how many repaired ones stayed fixed, is not on the page. (AGENT_RULES 9, 29; FA-5, FA-11.)
6. **No receipts.** Paid repairs and their checks are the product's proof of value (F18), but Review never says "6 of the 7 checks held". The app's four-stage lifeline exists only inside the repair entry and one opened row.
7. **Learn is a destination students must remember.** It opens on a library in syllabus order with a paragraph explaining how Learn works. The link from a mistake to its lesson exists (`MistakeLessonLink`) but sits in the result's Repair step, 3,900 px down. Nothing on Review, on a mistake row, or in Practice's chapter list offers the lesson at the moment the student is missing the idea. (FA-8, FA-9; the Khanmigo lesson: the help must sit inside the work.)
8. **Copy that explains the system instead of the step** ("Each concept takes three steps…", "Lessons and recall keep ideas fresh. Marks come only from practice and mocks, so they are recorded separately; a recall rating schedules the next review and does not certify mastery.") and a contradiction: the web says Revise holds every wrong answer, the app's note says "Mistakes you repair come back".
9. **Empty states.** The web empty state is a scene plus "Nothing to review yet" with no sample of what will appear; the app's is good (example row, one key) and is the model. L12's wrong empty state on an account with papers is a load failure shown as empty; the states must differ.
10. **Slop on the web Learn page:** an arrow on the full-mock row, boxed "chips" for skill and minutes, icons on every line (`BookOpenText`, `Brain`, `Target`, `Timer`, `ChevronRight`). **In the app's Concepts** (`learn_tab_full_dark.png`): lessons sit in a rounded box inside the page (nested cards), every chapter summary has its own icon tile, and the hero is a gradient-filled card whose lime key is itself a gradient.
11. **Two denominators for the same paper.** The app's History says "18 of 50 marks lost here" (the chapter's share) right above "Mock 2, 205 of 250". A student reads 18 of 50 as a score. Marks lost are always stated as marks ("cost you 18 marks"), and "of 250" is kept for scores only.

What works and is kept (F16): the app's mistake-and-chapter structure, the lifeline Found / Repaired / Retested / Still right and its connector line through an opened chapter, the hero's Q chips with "Show me", "Try it again" and the free answer sheet, the "Repair {k} from {paper}" pills, the paper and 12-hour time on every row, "Opens free" for saved repairs, the repair entry's "What Repair gives you", the lamp-lit room with Mobi and the example-row empty state, the monumental number and lamp-lit object in the hero, Revise's honest "costs no credits, not in accuracy", the lesson engine (Learn, Lock it in, Apply), chapter summaries, the untaught-chapters fold, the Rule book, and the study preferences.

---

## 3. Research (what the decision rests on)

- **FA-1, one loop: Find, Fix, Keep.** The Lab finds, Repair fixes, Revise keeps. The research lists Today, Practice, Mocks, Mistakes and Colleges as the top-level places; NAV-1017 already folded Mocks into Practice and the Start key, so Mistakes is Review. Everything else is reached from a moment, not a menu. [B/C]
- **FA-2, FA-3, AGENT_RULES 7 and 8:** one primary action per task screen, ranked by what helps the next decision.
- **FA-5, receipts:** "Held 1 of 1", "Of the 6 mistakes you repaired, 5 did not come back". Count only what can be tied to a repair; claim no cause (AGENT_RULES 5; the repo contract: "do not claim simulated marks are observed gains").
- **FA-8, FA-9, Khan Academy:** help that students must remember to open is not used; the tutor moved inside the practice problem. So the lesson appears on the mistake, the chapter and the Practice panel, not only in a library.
- **FA-10, NN/g empty states:** one line on what will appear, a button to the next action, a sample row.
- **FA-11, Embibe:** plain mistake names priced in marks.
- **S014 progressive disclosure:** secondary parts fold (Revise's schedule lanes, the rule book, saved questions); the frequent part (what to repair, what is due) stays open.
- **S016 WCAG 2.2 consistent identification:** one word for one thing across pages and platforms.
- **T002 / AGENT_RULES 17:** progress counts only completed steps (the lifeline counts real repairs and real checks).
- **AGENT_RULES 18, 19, 24 and the MockMob overlay:** state the credit cost before an AI call; say what a repair contains before the student pays.
- **Spaced retrieval (Roediger and Karpicke 2006, cited in FA):** keeping is a short daily retrieval session; one queue is easier to keep as a habit (FA-12: "one small daily habit with a clear definition").

---

## 4. Options, ranked

### 4.1 Review

| Rank | Option | For | Against |
|---|---|---|---|
| **1** | **A. One Mistakes page with the loop inside it.** Review has two views, **Mistakes** and **Papers**. Mistakes opens with one next move (chosen by a rule), a receipt strip (Found, Repaired, Retested, Still right), the open mistakes by chapter priced in marks, then quiet rows. All "keep" work is one **Revise** queue. | The loop is legible on one screen; one volt; F17 sits on every row; the receipt makes paid value visible; the app already has 80% of it | The website changes most (from session list to mistake list); one queue over three engines needs a small orchestrator |
| 2 | B. Three tabs named after the loop: **Fix / Keep / History** | Names the loop explicitly | Students must pick a tab before they know what to do; "Fix" and "Keep" are our words, not theirs; three tabs split the one next move; the owner rejected denser navigation on 15 Oct |
| 3 | C. Keep the web's session list and push everything into each result page | Least web work | Mistakes from different papers never meet; the costliest chapter across papers is invisible; F17 stays a count; Review remains a list of links |

### 4.2 Learn

| Rank | Option | For | Against |
|---|---|---|---|
| **1** | **A. Concepts at the moment of need.** The lesson appears on the mistake (a row in an opened chapter, the repair, the result), on the chapter (Practice's chapter list and fine-tune, Review's chapter rows), in Practice's Concepts panel (personalised), and as Today's move when a concept gap is the biggest leak. The library stays at `/learn`, renamed **Concepts** on both platforms, reordered by "Where you lose marks". | Matches FA-8, FA-9 and NAV-1017 (Learn left the dock); nothing deleted; the app already calls it Concepts | Needs a mistake-to-lesson map (concept or chapter) in more places |
| 2 | B. Learn as a destination with a better library | Simple to build | Students must remember to go there (Khanmigo pilot); NAV-1017 already moved it off the dock |
| 3 | C. Fold lessons into Repair (the repair is the lesson) | One flow | Loses free lessons for students without credits; cuts a feature; mixes paid and free content |

### 4.3 Decision

**Review: option A. Learn: option A.** In one sentence each:

- **Review is the Mistakes page:** one next move, a receipt of what held, every open mistake by chapter in marks, and one Revise queue that keeps everything.
- **Concepts come to the student:** the lesson for an idea is offered on the mistake, the chapter and the Practice panel, and the library is reordered by where marks are lost.

---

## 5. The exact spec

### 5.1 One word for one thing (both platforms, and the same words as RESULT-1017 and TODAY-1017)

| Thing | Student-facing name | Never call it |
|---|---|---|
| The tab and page | **Review** | |
| Its two views | **Mistakes**, **Papers** | To repair, History, sessions |
| A wrong answer | **mistake** | question to review, miss, question to look at |
| A blank | **left blank** ("not a mistake") | skipped mistake |
| The paid fix | **Repair** | Review, look at |
| A mistake with a saved repair | **repaired** ("opens free") | |
| The new question after a repair | **Check it held** (the owner's F11 "this one is okay"); outcomes **Held on a new question** and **Slipped on a new question**, exactly the RESULT-1017 chips | check on a new question, Retest (the word "Retested" survives only as the lifeline stage label) |
| All keep work (wrong answers back, repaired mistakes before the key, pending Check it held, lesson cards) | **Revise** | Review due cards, Review again, Lock in, cards due for review |
| Where marks went | **Where your marks go** (Review, across papers) and the result's own fold (RESULT-1017) | Mistake Lab, SWOT (internal names only) |
| Lessons and their library | **Concepts** (library), **lesson** (one) | Learn (route only), study, unit |
| Lifeline stages | **Found, Repaired, Retested, Still right** (the app's existing words) | |

"Learn" remains the lesson's first step ("Learn, 7 min") and the route `/learn`. The desktop sidebar label becomes Concepts.

### 5.2 Review, Mistakes view: order and layout

**One order on both platforms** (parity rule 1): title, the Mistakes / Papers control, the next-move panel, the receipt strip and its line, the Revise row, the open mistakes by chapter, Also in Review. The control comes first, so the panel belongs to Mistakes. **Papers has no next-move panel.**

**Web phone (390).** Single column, 16 px gutters, 132 px bottom padding for the dock.

```
[logo]                              40 AI credits  (P)   top bar; no page name in it (the H1 says it)
Review                                                  h1, 34 px display
[ Mistakes 22 open | Papers 3 ]                         segmented, 48 px, max 420
┌───────────────────────────────────────────┐           the one raised surface (18 px radius)
│ Admission of a partner                    │           title, 26 px display
│ Your costliest chapter: 35 marks lost in  │           one line of why, 15 px ink-2
│ Mock 3 and Mock 2. Q42 comes first.       │
│ [ volt: Repair Q42 ]                      │           54 px
│ A repair gives you why D looked right,…   │           RESULT's value line, said once
│ 1 AI credit. You have 40. No charge if…   │           RESULT's cost line, 13.5 px ink-3
│ ( Practise 10 on this chapter instead )   │           outline, 44 px
└───────────────────────────────────────────┘
30 Found | 9 Repaired | 7 Retested | 6 Still right      receipt strip, hairlines
6 of the 7 checks held. Q17 slipped tonight, so it is open again and back in Revise tomorrow, Sun 18 Oct.
Revise  8 due today                                   ›  the daily keep row (quiet, whole row a link)
22 open mistakes                        Costliest first
With 8 left blank, they cost you 172 marks across 3 papers. A wrong answer costs 6 marks, a blank 5.
(obj) Admission of a partner                     −35
      5 wrong, 1 left blank. Accountancy, Mock 3 and Mock 2
      [==      ] 2 of 7 repaired, 1 slipped               (tap: opens its questions)
(obj) Retirement and death of a partner          −29
(obj) Issue of shares                            −28
(obj) Cash flow statement                        −23
See all 7 chapters                                     ⌄
Also in Review: 9 repaired / Revise schedule / Your rules / Saved questions / Not attempted
```

The panel holds five things: title with its number, the key, one line of value, the cost, the alternative (critic point 12). The first viewport at 390 shows the panel, the four receipt numbers and the receipt line (acceptance 1).

**Web desktop (1440, sidebar 232).** Content 1,080 px max, two columns (1.3fr / 1fr, 56 px gap) with no holes: left, the panel and then the chapters; right, one sticky column (top 84 px) with the receipt strip, its line, the Revise row and Also in Review. The top bar carries only credits and the avatar.

**App (412 dp).** Same order in the app's voice: top bar (avatar, Review, Ask Mobi), the control "Mistakes, 22 open / Papers, 3", then the hero, which keeps its composition from the v13 goldens: the BricolageTitle chapter, the monumental BricolageCondensed number ("35" with "marks lost here"), the lamp-lit object, **the Q chips with "Show me"** (kept, critic point 6), the volt pill key, the value and cost lines, the alternative as a text link. Then the strip, the Revise row, chapter rows (unchanged widget, `−35` in the trailing slot), Also in Review. The Revise note card ("Open Revise / Got it") and the Lab note card leave as cards; their sentences live in the Revise row and the Papers view. Bounce scrolling where the app owns the scroll (F3).

### 5.3 The next move: RESULT-1017's rules, in RESULT-1017's order

Review does not have its own move builder. It calls the one pure function RESULT-1017 defines (packet S1, web `data/result_next_move.mjs` `nextMove()`, app port in the result feature), the same function Today's plan calls (TODAY-1017 section 8, "one engine"). Review adds only an input adapter, `reviewInput(record)`, that turns the cross-paper record into the function's input. On a record with one paper the adapter's output equals the result page's input, so the result, Today and Review return the same kind, target and key (acceptance 5).

**The rules, unchanged from RESULT-1017 4.3, in its order:**

| RESULT row | When (evaluated on Review's input) | Volt key | Line under the title | Under the key |
|---|---|---|---|---|
| 1 | Nothing missed on any paper | Set up a harder full mock | "Every question right. A harder paper finds what is left." | Price line from `paperCopy.mjs`; alt "Take another fresh paper" |
| 2 | Under 40 percent of answered questions right **on the newest paper**, or nothing answered | Practise 10 on this chapter | "{Chapter}: most answers in this chapter were wrong, so a chapter set comes before repairing single mistakes." | "Uses 10 practice credits. You have N."; alt "Or repair Q{n} first, 1 AI credit"; the chapter lesson link when one exists |
| 3 | A wrong answer can be repaired (open, no saved repair, key not held or corrected) and AI credits are 1 or more, or unknown | **Repair Q{n}**: the first in the server's repair order (`lab.repairOrder`) inside the costliest chapter; none there, the first overall | "Your costliest chapter: {m} marks lost in {papers}. Q{n} comes first." | RESULT's value line "A repair gives you why {X} looked right, the trap, one rule to keep, and a new question to check it held."; RESULT's cost line "1 AI credit. You have N. No charge if the repair cannot be written."; alt "Practise 10 on this chapter instead", or with 5 or fewer repairable left "All {N} repairs take about {M} minutes" |
| 4 | Every wrong answer has a saved repair and one or more Check it held are not taken | **Check Q{n} held** (free) | "You repaired {k} of {N}. One new question each shows whether the fix held." | "No extra credit." |
| 5 | Known 0 AI credits, every wrong answer held, or only blanks left | Practise 10 on this chapter | "Repairs use AI credits. You have 0. They renew on {d Mon}." | "Uses 10 practice credits. You have N."; alt "See your AI credits" |

**Pricing, unchanged from RESULT-1017 4.2:** a chapter's marks are 6 for each wrong answer and 5 for each blank, leaving out questions whose key is held or corrected. Review applies it to the **open** items across papers (open wrong answers, slipped ones, blanks). Ties: more wrong answers first, then the newest paper, then the earlier chapter in that paper; on one paper this is RESULT's tie rule.

Review-only wording, not new rules:
- `{chapter}` in a key renders as "this chapter" on Review because the panel title names the chapter directly above; the result page keeps the chapter's name.
- A slipped mistake is open but **not repairable**: its saved repair opens free (F17), so rule 3 skips it and its row offers the saved repair and Revise.

**Revise is never the volt on Review.** It is the first quiet row under the receipt ("Revise, 8 due today. 5 questions back, 1 Check it held, 2 concept cards. About 7 minutes, free."), it is the badge, and it is in Today's alternatives. That keeps Review's key identical to the result's and Today's. Question 2 asks the owner whether Revise should take the volt on days it is due; if he says yes, that rule goes into the shared function for all three pages at once, never into Review alone.

**The one-volt rule with A1.** The owner chose NAV-1017 option A1 at 3:10 am: the round Start key beside the glass capsule is filled lime. Its look is fixed (NAV-1017 6.8, F12): this decision asks nothing of the dock, the bar or the sidebar key, on any page or in any state. Inside the content, the next-move key is the only lime fill; the A1 key is chrome and is the owner's accepted second fill. Every other control on Review, Revise and Concepts is outline, raised or text.

### 5.4 The receipt strip

Four numbers with labels under them, hairline-divided, no card:
- **Found:** every wrong answer on record.
- **Repaired:** wrong answers with a saved repair, slipped ones included (it is a receipt of work done).
- **Retested:** repaired mistakes whose Check it held was answered.
- **Still right:** of those, answered right.

A slipped mistake counts in Repaired and Retested, not in Still right, and it is open again: it is back in the open count, priced again in its chapter, and keeps "Repaired {d Mon}, opens free".

One line under the strip, generated:
- With checks: "**{held} of the {checked} checks held.**", then the newest slip: "Q{n} slipped {tonight | on Ddd d Mon}, so it is open again and back in Revise {tomorrow, Ddd d Mon}." or "Nothing slipped."
- With repairs but no checks yet: "{repaired} repaired. Each one comes with a Check it held."
- With no repairs: "None repaired yet. A repair explains why your pick looked right, then checks it." (only Found is shown)

No percentages, no claims of cause, no gain in marks (that belongs to the result's "You improved because", FA-14, and only with the tie stated). Source: the repair record (`/api/me/repair-record`, the F17 data) and the check outcomes. Dates come from a date function in the student's time zone, never typed by hand (fixture check: 18 Oct 2026 is a Sunday, 21 Oct a Wednesday).

### 5.5 Mistakes by chapter

- **Head:** "{n} open mistakes" (h2) with "Costliest first" on the right; the sub-line in ink-2: "With {b} left blank, they cost you {m} marks across {p} papers. A wrong answer costs 6 marks, a blank 5." Marks never sit beside the word "repair" and are never a red display number in the head (critic point 8).
- **Chapter row:** subject object (48), chapter name, marks `−35` (bad ink, display numerals), source "5 wrong, 1 left blank. Accountancy, Mock 3 and Mock 2", progress "{k} of {n} repaired" with a thin bar (good ink), plus ", {s} slipped" when any slipped. Every number on the row comes from the same `chapterRows()` as the head and the panel.
- Show the top 4 chapters, then "See all {n} chapters" with the rest named with their marks.
- **Opened chapter:** one row per item: Q badge, the stem's first line (never "Question 42"), "{paper}, {d Mon}, {h:mm AM}" (F17), and a status pill on its own line, using RESULT-1017's chip words:

| State | Pill | Tapping the row |
|---|---|---|
| Open, repairable | Repair | Opens the free answer sheet (below); Repair is the paid step inside it |
| Repaired, Check it held not taken | Check it held | Opens the saved repair (free) with the check |
| Held | Held on a new question | Opens the saved repair (free); the meta line says the next Revise day |
| Slipped | Slipped on a new question (warn ink) | Opens the saved repair (free); meta "Repaired {d Mon}, opens free. Back in Revise tomorrow" |
| Left blank | Try it again, free | Opens the question with the key hidden |
| Key under re-check / corrected / no repair possible | as RESULT-1017 4.5 | as RESULT-1017 |

  Order inside a chapter: repairable in repair order, slipped, blanks, then repaired and held. The first 6 show, then "Show {k} more: Q6 and Q21, both held on a new question". Every item is listed; none disappears.
- **The free answer sheet (L13, critic point 6).** An open mistake never needs a credit to be understood. The sheet (web: in place under the row; app: the existing `answer_sheet.dart` bottom sheet) shows your pick and offers **Try it again** with the key hidden, and **Show the answer**: your pick, the correct answer, the book explanation. Both are free. **Repair Q{n}** sits inside it as the paid step with its credit. The app's hero chips (Q42, Q38, Q45, Q11, the chapter's repairable mistakes) and **Show me** open the same sheet at the first chip. The web mock shows the sheet before the answer is shown; the app mock shows it after.
- **Lifeline connector (app, kept):** the vertical line through the Q badges from `review_rows.dart` stays; badge rings take the state colour (bad open, warn slipped, dashed blank, good held).
- Under the rows: **"Learn the idea first"** with "{lesson}, {m}-minute lesson, free" (the `MistakeLessonLink` rule, via `lessonFor`). Then the per-paper keys, **"Repair {k} from {paper}"** on both platforms (outline on the web, the app's raised pill): they open the repair entry listing those questions with the total, "3 repairs, 3 AI credits. You have 40.", and run the repairs one at a time on the existing per-question endpoint, so each is charged only when written and a failure charges nothing (no new server batch). Slipped mistakes are never in them.
- **Not attempted** stays a quiet row in Also in Review: "{b} left blank in {papers}, {5b} marks not earned. Try any of them again, free."

### 5.6 Also in Review (quiet rows, hairline, whole row is the control)

1. **{n} repaired**: "Each opens its saved repair, free. {held} held, {slipped} slipped, {pending} waiting for Check it held." → the repaired list (was the app's Repair record in History).
2. **Revise schedule**: "{n} questions in rotation. They come back after 1, 3, 7 and 21 days." → the schedule view with the four lanes.
3. **Your rules**: "{n} rules from your repairs. For your next mock: {active rule}." → `/review/rules`.
4. **Saved questions**: "{n} saved".
5. **Not attempted**: as above.

### 5.7 Review, Papers view (no next-move panel)

- **Per subject with 2 papers:** a text pair, not a chart: "158 in Mock 3, 16 Oct" (display numeral) and "140 in Mock 2, 12 Oct. Up 18 marks. A trend line appears from your third mock." From 3 papers: the trend line with HTML labels and uniform scaling (no stretched SVG text).
- **The record finding** (RecordGlimpse, moved here from Today on 17 Oct): a plain semibold sentence priced in marks, its source in ink-3 under it. No coloured side stripe (critic point 15).
- **Your {n} papers**, newest first: object, "Mock 3, Accountancy", "16 Oct, 9:40 PM. 12 mistakes, 1 repaired", score "158 of 250". Opens the result.
- **Across your papers** (right column at 1440, below on phones): Where your marks go ("Admission and Retirement cost 76 of the 220 marks you lost across 3 papers."), Your traps across mocks, Progress.

### 5.8 Revise: one queue that keeps everything

Revise reads four sources and plays them as one session with one progress line:

1. Wrong answers due today (`data/revise.js`, same question; checks memory);
2. Repaired mistakes due for **Review again** (same question, key hidden): the app's `review/again` run joins here;
3. Pending **Check it held** from repairs, from the day after the repair (on the repair day the row offers it);
4. Lesson recall cards due, only from lessons the student has read.

- **One card per question per day (dedupe, critic point 9).** A question due in both source 1 and source 2 plays once, as Review again (key hidden), with one schedule update. A question due as a Check it held is a different question (a new one on the same rule), so it never collides. Unit fixture `revise_dedupe.json`: one question due in sources 1 and 2 gives one card and "due today" counts it once.
- **Where the state lives (critic point 9).** On the server, in the existing `revise_cards` table keyed by `(user_id, question_id)`. Review again becomes a `mode` on that row (`question` or `again`), so the key itself forbids duplicates; the app's phone-only `review_again_local.dart` set moves to the server and stays only as the offline cache. Both platforms read it through `/api/me/review` (summary) and `/api/me/revise` (the run), so a Revise answer on one device shows on the other within one refresh (parity rule 3). The migration is saved with a dry-run report first; production data is never migrated implicitly (AGENTS.md).
- Daily cap: the existing 5 or 10 a day applies to sources 1 and 2; Check it held is always included; cards add at most 5. Head: "{n} due today, about {m} minutes." (nothing more); mix line "5 questions back, 1 Check it held, 2 concept cards".
- Each card's kind line: "A question you got wrong. Mock 2, 12 Oct, 10:42 PM. Cash flow statement" / "Check it held: your Q{n} rule" / "A card from {lesson}".
- After an answer, the existing per-source feedback (Revise's key and stored explanation; the check's Held or Slipped with Mobi's one cheer; the card's rating keys).
- **In a run the dock and the app bar step away** (as test routes do): only the back control and "3 of 8". The Review badge drops by one as each answer is confirmed by the server (8 to 6 two cards in).
- The four box lanes fold into "How Revise schedules" (S014) and are the Revise schedule row in Review.
- Free, no attempts row, not in accuracy (unchanged; stated once at the foot).
- Routes: `/review/revise` is the run. `/learn?recall=due` and the app's `/review/again` stay working and open Revise filtered to that source.
- **Copy fix:** Revise holds every wrong answer (the web truth). The app note "Mistakes you repair come back" is wrong and goes.

### 5.9 Concepts (the library, `/learn`)

- Title **Concepts**; lede "Short lessons on the ideas behind your mistakes."
- **The panel (the one volt):** title = the lesson; line "Read this next. 5 of your open mistakes are in its chapter, {chapter}."; key "Start the lesson, {Learn + Lock it in} minutes"; cost "Free. Its 4 cards then join Revise, where {n} are due today." The pick: an unfinished lesson ("Finish {title}, step {k} of {n}"), then the unread lesson for the costliest chapter with open mistakes, then the next unread lesson in the first subject, then "Practise questions". Due cards are never the volt here.
- **Search** chapters and lessons (one field, 48 px), then the subject switch (object plus name, 48 px, the unselected ones desaturated as on the Start menu).
- **Where you lose marks** (only with a record): chapters with open mistakes by marks (the same `chapterRows()`), each with `−marks`, "{w} open mistakes, {b} blank", and its lessons (ring, title, minutes or Read, what it covers), or "No lesson yet. Practise the chapter".
- **All {subject} chapters:** **every** chapter in syllabus order (12 for Accountancy), the ones with open mistakes marked with their `−marks`, lessons per chapter or "No lesson yet. Practice ready"; chapter summaries open from each row; the untaught fold content stays inside it.
- Side column at 1440 (end of page on phones): the study record as one line ("2 of 9 lessons read, 8 cards in Revise, 23 cards recalled", all from the same fixture), **Study preferences** fold (unchanged), **Test it in a full mock** row (no arrow).
- **Where the tab highlight sits (critic point 17):** on the phone web dock Concepts lives in the More sheet (NAV-1017 8.2), so **More** is the current tab on Concepts and on a lesson; on desktop the sidebar marks Concepts. In the app Concepts is opened from Practice, so **Practice** is the current tab and the page has a back control.

### 5.10 A lesson opened from a moment

The lesson page (`/learn/[id]`) reads `?from=`:

- `from=q:{attemptId}:{n}`: a neutral hairline block (no wash, no box; red only on the pick, critic point 19): "**You are here from Question 42, Mock 3.** You picked D; the answer is B. This lesson covers the idea behind it: {one line from the lesson's objective}." Back link "Back to Question 42". Step 3 reads "Back to Question 42: repair it, or practise 10 on this chapter with marks."
- `from=chapter:{subject}:{chapter}` (Practice, Review chapter row): "{k} open mistakes in this chapter."
- `from=today`: Today's why line. No `from`: as now.
- The key states the time it covers: **"Start the lesson, 9 minutes"** = Learn 7 + Lock it in 2; Apply keeps its own "about 10 min, separate" (critic point 18). The lesson's subject and chapter sit under the title as a plain line, not as an eyebrow above it.

### 5.11 Where Learn appears (the moments)

| Moment | Surface | What the student sees |
|---|---|---|
| A mistake whose chapter or concept has a lesson | Review opened chapter; result mistake row (opened); repair entry (after the reason) | "Learn the idea first" with title, minutes, free |
| A chapter | Practice chapter picker and fine-tune (START-1017), Review chapter row | a small "Lesson, 7 min" line on chapters that have one |
| Practice | the Concepts panel (web `DashboardPageClient.jsx` `pr-concepts`; app `concepts_shelf.dart`) | personalised: "Goodwill and the new partner, 7 min. 5 of your open mistakes are in its chapter." then "All concepts" |
| Today | the move, when the costliest leak is a concept gap and a lesson exists (a TODAY-1017 move kind) | "Read the idea behind Admission of a partner, 9 minutes" |
| Ask Mobi inside a question | the answer offers the lesson when one exists | "There is a 7-minute lesson on this" |
| The More sheet and the desktop sidebar | Concepts | the library |

### 5.12 How Review connects to the rest

- **Result (RESULT-1017):** the same rows, chips and words ("Check it held", "Held on a new question", "Slipped on a new question", "opens free"). The same `nextMove`. "All saved mistakes" in the result's links becomes "Your mistakes in Review".
- **Today (TODAY-1017):** one engine; on the same day Review's key and Today's move name the same target. Today's "Last paper" row opens Review, Papers.
- **Bar and dock badge (NAV-1017 keeps a Review count):** the badge is **Revise due today** (sources 1 to 4). Open mistakes are a backlog, not an alert, so they are not badged (HIG: badges for what needs attention now). It drops as answers are confirmed.
- **Nav:** A1 as drawn by NAV-1017 (glass capsule of Today, Practice, Review, Colleges, You in the app; Today, Practice, Review, Colleges, More on the web phone dock; a separate round lime Start key; the lens is a neutral lit fill, never lime). Review asks nothing of the nav.
- **Practice:** the Concepts panel as in 5.11; "Practise 10 on this chapter" opens chapter practice through setup (cost shown first).

### 5.13 App parity rules

1. Same order (5.2), same names (5.1), same next-move function (5.3) on the same JSON fixtures, same receipt numbers, same chips.
2. The app keeps its own voice: Bricolage Condensed numerals, the lamp-lit hero with the subject object, the Q chips with Show me, the lifeline connector, pill keys, glass top-bar controls, bounce scrolling. The web keeps its hairline editorial list and its in-place answer sheet. Neither copies the other's chrome.
3. Deliberate differences, listed so a builder does not "fix" them: the app's hero carries the chips and the monumental number (the web panel does not); the app's alternative is a text link (the web's an outline key); the app's answer sheet is a bottom sheet (the web's opens in place); the app's per-paper keys are raised pills (the web's outline).
4. A paper, repair, check or Revise answer on one platform is on the other's Review within one refresh (5.8 storage; the F17 repair record).
5. One Mobi at most per screen: Review's Mistakes view has none; the empty state's lamp-lit room has its one Mobi; the failure state's room has its one Mobi (web); a held check shows the one cheer (RESULT-1017); Revise keeps its graded-answer reaction, one at a time.

### 5.14 States (each drawn state names its capture)

| State | Review (web and app) | Revise | Concepts |
|---|---|---|---|
| Ready | Rule 3 panel (`web-review-*`, `app-review-*`); chapter opened with the free answer sheet (`web-open-*`, `app-open-*`, `app-sheet-*`) | Card 3 of 8 (`web-revise-*`, `app-revise-*`) | `web-learn-*`, `app-concepts-*`; a lesson from Q42 `web-lesson-*` |
| Loading | Skeleton of the control, the panel, the strip and three rows (no figure, no copy that could be wrong) | Card skeleton | Panel and three rows skeleton |
| **Failed to load (L12)** | Web, nothing cached: the unreachable room with its Mobi, "Your mistakes did not load", the named cause, "Your papers and repairs are safe.", Try again, "Tried at 9:41 PM.", Practise anyway (`web-fail-*`). App, with a cache: the cached page under "Could not refresh. Saved at 9:12 PM. Try again" (`app-fail-*`). **Never the empty state.** | "Revise did not load. Your schedule is safe." Try again | "Concepts did not load." Try again, Practise questions |
| Offline (app) | The cached page under "You are offline. Saved on this phone at 9:12 PM."; the key disabled with "Repairs need a connection. Show me works offline." above it (`app-offline-*`) | Cached cards answerable only if the key is cached; otherwise "Revise needs a connection" | Offline packs (existing) |
| Zero AI credits | Rule 5: "Practise 10 on this chapter", "Repairs use AI credits. You have 0. They renew on 1 Nov.", practice credits, "See your AI credits" (`web-zero-*`, `app-zero-*`). Repair pills still open the answer sheet free; Repair inside says the balance | unchanged (free) | unchanged (free) |
| Empty (no paper) | The lamp-lit room with Mobi (kept, critic point 7), "Your mistakes gather here", one line, an Example row, volt "Start 10 questions", cost line (`web-empty-*`, `app-empty-*`) | "Nothing to revise yet. Questions you get wrong come back here after 1, 3, 7 and 21 days." with "Start 10 questions" | Panel = first lesson in the first subject; no "Where you lose marks" |
| Every wrong answer repaired, a check pending | Rule 4: "Check Q{n} held", free | the check is in today's queue | unchanged |
| Nothing open | Rule 5 (all held) or rule 1 (nothing missed); strip shows the receipts | | |
| Revise done today | Panel unchanged; the Revise row reads "Done for today. {n} come back tomorrow." | End: "{right} recalled, {wrong} come back tomorrow." | |
| Large text 1.3x | Chapter rows wrap the name to two lines; marks keep their column; strip numbers shrink to a 26 px floor; pills move under the stem (already their place) | | |

Specified but not drawn: loading, rule 4, nothing open, Revise done today, large text. They change one line or one key on a drawn screen; P-LR7 captures all of them from the preview fixtures.

### 5.15 Motion

Purpose only (AGENT_RULES 31), ease `cubic-bezier(0.23, 1, 0.32, 1)`, reduced motion lands every change at once.

- **Arrival (first open of the day):** the strip's numbers count from the last-seen values to now, once (the existing `RollNumber`, 700 ms, ease-out cubic), only for numbers that changed.
- **Segment switch:** the selected pill slides (220 ms); content crossfades with an 8 px rise (180 ms). App: the existing `MmOverlapSwitcher`.
- **Opening a chapter:** height and opacity 240 ms; rows stagger 30 ms, at most 6; the chevron rotates 180 ms. The web answer sheet opens in place the same way; the app sheet uses the GLASS-1017 sheet spring. Press feedback on rows: scale 0.98 (web 160 ms; app the content-layer press from GLASS-1017, 0.96).
- **A stage change after a repair or a check:** the pill crossfades to its new word (200 ms), the chapter bar grows (320 ms), the strip number ticks once. Never before the server confirms.
- **Revise card:** the existing rise (180 ms); progress ticks fill (160 ms); the badge count ticks down on confirmation.
- **No loops, no glow, no ambient motion.** The empty room keeps the website's existing SceneLife breathing only where it already runs, under reduced motion still.

### 5.16 Copy (final strings)

| Key | Text |
|---|---|
| review.title | Review |
| review.seg.mistakes | Mistakes {n} open (web) / Mistakes, {n} open (app) |
| review.seg.papers | Papers {n} (web) / Papers, {n} (app) |
| next.repair.title | {chapter} / Your costliest chapter: {m} marks lost in {papers}. Q{n} comes first. |
| next.repair.key | Repair Q{n} |
| next.repair.value | A repair gives you why {X} looked right, the trap, one rule to keep, and a new question to check it held. (RESULT-1017 4.4) |
| next.repair.cost | 1 AI credit. You have {N}. No charge if the repair cannot be written. (RESULT-1017 4.4) |
| next.repair.alt | Practise 10 on this chapter instead / All {N} repairs take about {M} minutes |
| next.check.key | Check Q{n} held |
| next.practise.key | Practise 10 on this chapter |
| next.zero.why | Repairs use AI credits. You have 0. They renew on {d Mon}. |
| next.fresh.key | Set up a harder full mock |
| strip.labels | Found / Repaired / Retested / Still right |
| strip.line | {held} of the {checked} checks held. |
| strip.slip | Q{n} slipped {when}, so it is open again and back in Revise {tomorrow, Ddd d Mon}. |
| revise.row | Revise {n} due today / {a} questions back, {c} Check it held, {k} concept cards. About {m} minutes, free. |
| mistakes.head | {n} open mistakes |
| mistakes.sub | With {b} left blank, they cost you {m} marks across {p} papers. A wrong answer costs 6 marks, a blank 5. |
| row.source | {w} wrong, {b} left blank. {subject}, {papers} |
| row.progress | {k} of {n} repaired[, {s} slipped] |
| pill | Repair / Check it held / Held on a new question / Slipped on a new question / Try it again, free |
| sheet.hidden | The answer stays hidden until you ask. Try it again first, or see the correct answer and the book explanation. Both are free. |
| sheet.keys | Try it again / Show the answer / Repair Q{n}, 1 AI credit |
| sheet.fine (app) | Seeing the answer and trying again are free. Repair adds why {X} looked right, the trap, one rule and a Check it held, for 1 AI credit. |
| chapter.paperkey | Repair {k} from {paper} |
| lesson.link | Learn the idea first / {title}, {m}-minute lesson, free |
| hero.showme (app) | Show me |
| empty.title | Your mistakes gather here |
| empty.body | Every wrong answer lands here with its paper and time, priced in marks. |
| empty.cost | About 10 minutes, {subject}. Free on your plan. |
| fail.title | Your mistakes did not load |
| fail.body | {cause}. Your papers and repairs are safe. |
| fail.cached (app) | Could not refresh. Saved at {h:mm AM}. Try again |
| offline (app) | You are offline. Saved on this phone at {h:mm AM}. / Repairs need a connection. Show me works offline. |
| revise.head | {n} due today, about {m} minutes. |
| revise.mix | {a} questions back / {c} Check it held / {k} concept cards |
| revise.kind.q | A question you got wrong. {paper}, {d Mon}, {h:mm AM}. {chapter} |
| revise.kind.check | Check it held: your Q{n} rule |
| revise.kind.card | A card from {lesson} |
| revise.foot | Free. Not counted in your marks or accuracy. |
| concepts.title | Concepts |
| concepts.lede | Short lessons on the ideas behind your mistakes. |
| concepts.next | Read this next. {k} of your open mistakes are in its chapter, {chapter}. |
| concepts.key | Start the lesson, {m} minutes |
| lesson.from | You are here from Question {n}, {paper}. You picked {x}; the answer is {y}. |

---

## 6. What moves where (nothing is deleted)

| Today | Goes to |
|---|---|
| Web R1 head "Review what mattered." and lede | Title "Review" and the segmented control |
| Web R2 lead count and "Open {session}" volt | The next-move panel (rule 3 opens the repair for the costliest chapter's first mistake, not a result page); "questions to review" → "open mistakes" |
| Web R3 milestone notes | The receipt line (first repair, first held check) |
| Web R4 Revise entry | The Revise row under the receipt, and the Revise schedule row |
| Web R4 Rules entry | Also in Review: Your rules |
| Web R5 RecordGlimpse and paper trend | Papers view (text pair until 3 papers, then the line) |
| Web R6 figures (Sessions saved, Answered right %, Last session) | Papers view per paper; accuracy stays on each result; "Sessions saved" becomes "Papers {n}" in the control |
| Web R6 session rows | Papers view rows (same F17 stamp) |
| Web R7 compact Today plan card | Retired from Review: the panel is the same engine's move, so it was a duplicate |
| Web R8 Study record and "Review due cards" | Revise (cards join the queue); the record numbers move to Concepts' record line |
| Web empty state's lamp-lit room with Mobi | **Kept**, above "Your mistakes gather here" |
| Web Revise head lanes (Box 1 to 4) | "How Revise schedules" fold and the Revise schedule row |
| App hero Q chips with "Show me" | **Kept** on the hero; they open the free answer sheet |
| App row "Try it again" and the answer sheet (`answer_sheet.dart`, `try_first.dart`) | **Kept** as the free answer sheet on every open mistake and blank |
| App lifeline connector in an opened chapter | **Kept**, with state-coloured badge rings |
| App "Repair {k} from {paper}" pills | **Kept**, now on the web too |
| App Revise note card ("Open Revise / Got it") | The Revise row and the Revise schedule row |
| App "Review again" row and run | Revise source 2; `/review/again` opens Revise filtered |
| App History: Mistake Lab note card | Papers view: the newest paper row opens its result; "Where your marks go" row |
| App History: Next from Mock 2 | The next-move panel (one engine) |
| App History: Repair record | Also in Review: {n} repaired |
| App History: Past results | Papers view |
| App "Not attempted in Mock 2 (3)" | Also in Review: Not attempted; blanks also listed in their chapter |
| App "Where your marks go", "Saved questions", "Your rules" rows | Unchanged (Also in Review on Mistakes; Where your marks go on Papers) |
| App pip strip "1 repaired, 8 found" | The receipt strip |
| App empty state's lamp-lit room with Mobi and Example row | **Kept**; the title becomes "Your mistakes gather here" |
| Learn L1 lede and L3 three-step paragraph | Concepts lede (one line); the steps live on the lesson page |
| Learn L2 hero: due cards case | Revise (the panel never shows due cards); the cost line says "{n} due in Revise today" |
| Learn L4 subject tabs | Subject switch under search |
| Learn L5 chapters | "Where you lose marks" (with a record) and "All {subject} chapters" (every chapter) |
| Learn L6 untaught fold | Inside All chapters, unchanged |
| Learn L7 study record | Record line (side column at 1440) |
| Learn L8 "Ready to test yourself?" with arrow | Quiet row "Test it in a full mock" (no arrow) |
| Learn L9 preferences and weekly plan | Unchanged fold |
| `MistakeLessonLink` on the result's Repair step | Review's opened chapter, the result's opened row, the repair entry |
| Practice Concepts panel "Open Learn" | Personalised panel (5.11) plus "All concepts" |
| App Concepts "12 cards due" hero and "Review due cards" | Revise; Concepts' panel is Read this next |

---

## 7. Build packets

Builders pull the newest branch state first and keep other agents' edits. Web paths are on the web release line (`deploy/web-1017`, the `wt-webux2` lineage); app paths on `ui/v13-review` and its successor. Owner-visible packets are built with Opus. **Order: RESULT-1017 S1 lands first (the shared `nextMove`), then P-LR0, then the rest.** Every packet ships with tests plus a visual critique at 390 and 1440 (and 412), Night and Day.

**P-LR0, shared input, fixture, storage (both platforms, first; Sonnet, Opus review)**
- **No new move builder.** New `data/review_input.mjs`: `reviewInput(record)` returns the input of RESULT's `nextMove()` for the open set across papers (5.3), plus `chapterRows(record)` (RESULT 4.2 pricing on open items, tie rule of 5.3) and `receipt(record)` (5.4, the slip rule included). App port `lib/features/review/model/review_input.dart`.
- **One fixture for everything:** copy `tmp/design-1017/learn-review/fixture.json` to `data/tests/fixtures/review/student.json` (and `flutter_app/test/fixtures/review/student.json`), plus variants `check_pending.json`, `zero_credits.json`, `all_held.json`, `one_paper.json`, `revise_dedupe.json`, `empty.json`, `record_down.json`. `tmp/design-1017/learn-review/check.mjs` is the reference arithmetic.
- **Cross-page test** `data/tests/next_move_parity.test.mjs` (in `npm run test:recovery`): on `one_paper.json`, the result's `nextMove(analysis)`, Today's plan move and Review's `nextMove(reviewInput())` return the same `kind`, `target` and `label`. On `student.json`: Review returns `repair`, target m3:42, "Repair Q42"; with 0 credits `practise`, "Practise 10 on this chapter". App: the same JSON through `review_input_test.dart`.
- **Server:** `GET /api/me/review` (new, read-only): `{ papers[], items[] (state, paper, at, chapter, stem first line), receipt, reviseDue: { questions, again, checks, cards }, chapters[] }`, joining attempts, the repair record (`src/lib/server/repairRecord.js`), check outcomes (`data/repair_check.js`) and `revise_cards` (`src/lib/server/revise.js`).
- **Storage:** migration (saved, with a dry-run report, not applied to production by the builder) adding `mode text not null default 'question'` to `revise_cards` and the server endpoint for Review again answers; the app's `features/review/again/review_again_local.dart` becomes the offline cache of that state.
- Lesson map: `data/study/lesson_map.mjs` `lessonFor({ subject, chapter, conceptId })` from the catalog (the rule in `src/components/study/MistakeLessonLink.jsx`), shared by Review, result, repair entry and Practice.

**P-LR1, website Review (Opus)**
- `src/components/RecoveryOverview.jsx`: `view="review"` renders the new `ReviewPage`; `view="progress"` unchanged.
- New `src/components/review/ReviewPage.jsx` (control, layout of 5.2 with the sticky right column at 1440), `ReviewNextMove.jsx` (renders `nextMove` output; no rules inside), `ReceiptStrip.jsx`, `ChapterRows.jsx` (opened chapter, pills, "Show {k} more", lesson link, per-paper keys), `AnswerSheet.jsx` (the free in-place sheet: Try it again with the key hidden, Show the answer with the book explanation, Repair inside; reuses `recovery/MistakeRepair.jsx` and `RepairCheck.jsx` for the paid part), `PapersView.jsx` (text pair, RecordGlimpse without the side stripe, paper rows, across-papers rows), `review-1017.css`.
- Per-paper repair: the repair entry lists the questions and the total; the client runs `data/repair_client.mjs` per question in order and stops on the first failure (charged only when written).
- Keep and reuse: `SessionRow` stamp logic (`paperStamp`), `RollNumber`, `RecordGlimpse`, `ReviseEntry` text, `RulesEntry`, `scenes/SceneVignette.jsx` (`nothingYet` for empty, `unreachable` for failure; one Mobi each).
- Remove from Review only (components stay for Progress and Today): `LearningNextAction compact`, `StudyProgress review`.
- `data-page-primary` on the panel key; **no change to the dock, the sidebar Start key or `start.css`** (NAV-1017 6.8). Control state in the URL (`?view=papers`).
- Preview: `src/app/preview/arena/ArenaPreviewClient.jsx` gains `/api/me/review` fixtures from P-LR0 (`?review=student|check|zero|held|empty|down`).

**P-LR2, website Revise queue (Opus for the run page, Sonnet for the queue)**
- `src/components/revise/ReviseRun.jsx`: one run over four sources; head and mix line; kind line; lanes into a `SmoothDetails` "How Revise schedules"; the run route hides the dock (`.arena-dock` not rendered on `/review/revise`, as on test routes); the badge decrements on each confirmed answer.
- `src/components/revise/useRevise.js` + new `reviseQueue.js` (ordering, the dedupe rule, one schedule update per question).
- `src/lib/server/revise.js` and `src/app/api/me/revise/route.js`, `answer/route.js`: the `mode` column and the merged due list.
- `src/app/(app)/learn/page.jsx`: `?recall=due` redirects to `/review/revise?source=cards`.
- `data/mistake_lab.copy.json` `revise.*` strings as 5.16.

**P-LR3, website Concepts (Opus)**
- `src/components/study/StudyLibrary.jsx`: title, panel rule, search, subject switch, Where you lose marks (from `/api/me/review` chapters), All chapters (every chapter), side column; remove the arrow row and the flow paragraph (moved per section 6).
- `src/components/study/LessonOverview.jsx`: the `from` block (neutral), back link, "Start the lesson, {Learn + Lock it in} minutes", step copy.
- `src/components/study/MistakeLessonLink.jsx`: reads `lessonFor`; used by `ChapterRows`, the result row and the repair entry.
- `src/app/(app)/dashboard/DashboardPageClient.jsx` `pr-concepts`: personalised panel.
- `src/lib/arenaNavigation.js`: label "Concepts" for the learn item; on phones the More tab is current on `/learn*` (route unchanged).
- `src/app/(app)/AppLayoutClient.jsx`: Review badge = Revise due today.

**P-LR4, app Review (Opus)**
- `lib/features/review/screens/review_screen.dart`: order of 5.2 (control first), Mistakes / Papers, Papers without the hero; remove the Revise note card and the Lab note card as cards.
- `model/review_input.dart` (P-LR0 port), `widgets/receipt_strip.dart` (new; replaces the pip strip in `life_row.dart`'s place on Review, `life_row.dart` stays for the repair entry).
- `widgets/tonight_card.dart`: the hero renders `nextMove` (repair, check, practise, fresh) with the chips and Show me; the alternative as a text link.
- `widgets/review_rows.dart`: stem first line, marks in the trailing slot, RESULT chip words, the lifeline connector with state rings, "Show {k} more", lesson link, per-paper pills (excluding slipped).
- `widgets/answer_sheet.dart`, `try_first.dart`: the free answer sheet from rows and from Show me; Repair inside as the paid step.
- `widgets/next_from_mock.dart`, `record_entry.dart` into Papers; `widgets/review_load_failure.dart`, `review_state_view.dart`: the cached-page failure and offline lines; empty keeps `StateScene.nothingYet` with its Mobi.
- `copy.dart` (5.16). Bar badge source: the nav count reads Revise due. **No change to `start_key.dart` or any bar file.**

**P-LR5, app Revise queue (Sonnet, Opus review)**
- `lib/features/review/revise/revise_screen.dart`, `revise_data.dart`, `revise_copy.dart`: four sources, mix line, kind line, schedule fold; the bar steps away in the run; remove "Mistakes you repair come back".
- `lib/features/review/again/*`: entry routes into Revise source 2; `review_again_local.dart` becomes the offline cache of the server state; the screen stays for the deep link.
- Learn recall runs callable as a Revise source (`features/learn/data` run API).

**P-LR6, app Concepts (Opus)**
- `lib/features/learn/screens/learn_screen.dart`: panel Read this next; search; Where you lose marks with marks; due cards out of the panel (`widgets/due_card.dart` becomes the one-line link); remove the nested lesson boxes and the icon tiles on chapter summaries (`lesson_list.dart`, `untaught_chapters.dart`).
- `screens/unit_screen.dart`: the `from` block.
- `features/practice/widgets/concepts_shelf.dart`: personalised.

**P-LR7, gate (after the above)**
- Web visual gate at 390x844 and 1440x900, Night and Day, every state of 5.14 from the preview fixtures; real-pointer clicks on the panel key, a chapter, a pill, the answer sheet's three keys, a segment, the lesson link, Revise; hit test that nothing covers the page; the cross-page test green.
- App goldens Night and Day at 412x915 for the same states plus 1.3x text; then the emulator walk (device-truth rule) on a test account with papers, repairs, a slip and Revise due, never the owner's account.

---

## 8. Acceptance checks

1. **One glance (390 and 412).** Open Review on an account with papers: without scrolling you read the panel (title with its marks, key, value line, cost) and the four receipt numbers with their line.
2. **One volt in the content.** At any scroll position, the only lime-filled control inside the page content is the panel's key (or the state's single key). The A1 Start key is the only other lime fill, and it looks the same on every page and in every state.
3. **One word.** Review, Revise and Concepts text has no "review due", "Review again" (except the deep-link route), "questions to review", "Lock in new cards", "to look at", "check on a new question". "Check it held" is the name everywhere.
4. **F17 on every row.** Every mistake row shows its paper and "{d Mon}, {h:mm AM/PM}". A repaired, held or slipped mistake opens its saved repair; the wallet is unchanged.
5. **Same move on three pages.** On `one_paper.json` the result, Today and Review name the same kind, target and key. On `student.json`: "Repair Q42"; with 0 credits "Practise 10 on this chapter"; on `check_pending.json` "Check Q{n} held". Unit tests pass on both platforms against the same JSON.
6. **Receipt truth.** The four numbers equal the repair record and check outcomes; a slipped mistake is in Repaired and Retested, not Still right, and is in the open count; no percentage and no marks-gain claim.
7. **Counts agree.** The control's "{n} open", the head, the chapter rows and the panel all come from `chapterRows()`; the chapter figures add up to the head's marks; every item of an opened chapter is listed or counted in "Show {k} more".
8. **Free answer (L13).** On an open mistake, Try it again (key hidden) and Show the answer (pick, key, book explanation) cost nothing; the wallet moves only on Repair, and only after the repair is written.
9. **One Revise.** With 5 wrong answers due, 1 repaired mistake due again, 1 pending Check it held and 2 due cards, Revise shows "9 due today" with the mix line and plays nine cards; with one question due in sources 1 and 2, it plays once. `/learn?recall=due` and `/review/again` open Revise filtered. An answer on the web shows on the app within one refresh.
10. **Concepts at the moment.** Open a chapter in Review with a mapped lesson: "Learn the idea first" shows; tap it: "You are here from Question 42, Mock 3…" and "Back to Question 42" returns to the opened chapter. Practice's Concepts panel names the same lesson with the open-mistake count.
11. **Empty versus failed (L12).** New account: the lamp-lit room with Mobi, an Example row and "Start 10 questions". Papers on record and the read failing: the failure state (web) or the cached page with "Could not refresh" (app), never the empty state.
12. **Badge.** The Review badge equals Revise due today, drops as answers are confirmed, and is absent when nothing is due, even with open mistakes.
13. **Nothing lost.** Every row in section 6 is reachable, including the Q chips, Show me, Try it again, the lifeline connector, the per-paper keys, Rules, Saved, Not attempted, the repaired list, schedule lanes, RecordGlimpse, the trend, past papers, the study record, preferences, chapter summaries, untaught chapters, Progress.
14. **Dates.** Every weekday shown matches its date (a unit test formats the fixture's dates).
15. **Parity.** Night and Day at 390, 1440 and 412: same order, names, numbers and rules; AA contrast for every text token.

---

## 9. Mocks (static, real tokens) and the one student

- `tmp/design-1017/learn-review/web.html` (tokens from `deploy/web-1017` `src/app/(app)/arena.css`, Bricolage Grotesque and Hanken Grotesk, the web's subject objects, header logo and scene rooms with the `idle` and `attentive` Mobi placed by the website's own anchor arithmetic). States by `?s=`: `review`, `open` (chapter opened, answer sheet), `papers`, `empty`, `fail`, `zero`, `revise`, `learn` (Concepts), `lesson` (from Question 42). `&theme=light` for Day.
- `tmp/design-1017/learn-review/app.html` (colours from `lib/core/theme/mm_colors.dart`, the app's font cuts and objects). States: `review`, `open`, `sheet`, `revise`, `concepts`, `empty`, `fail`, `offline`, `zero`.
- Both draw **NAV-1017 A1**: a glass capsule of five (app: Today, Practice, Review, Colleges, You; web phone: Today, Practice, Review, Colleges, More), a separate 64 px round lime Start key with a play glyph and "Start" in volt ink, a neutral lit lens; the desktop sidebar's Start key is the same constant lime fill. Nothing about them changes with the page.
- **One student, one file:** `tmp/design-1017/learn-review/fixture.json`. `node tmp/design-1017/learn-review/check.mjs` derives every number from it with RESULT's rules and fails on any string the mocks must or must not say. The student, now Sat 17 Oct 2026, 9:41 PM:
  - Mock 3 Accountancy, Fri 16 Oct, 9:40 PM: 34 right, 12 wrong, 4 blank, 158 of 250 (lost 92 = 12 × 6 + 4 × 5). Quick practice Business Studies, Thu 15 Oct, 7:05 PM: 7, 3, 0, 32 of 50. Mock 2 Accountancy, Mon 12 Oct, 10:42 PM: 31, 15, 4, 140 of 250 (lost 110). Lost across papers 220.
  - Found 30; Repaired 9 (Mock 3: Q29 tonight 8:30 PM; Mock 2: 8); Retested 7; Still right 6; Q17 (Mock 2, repaired Tue 13 Oct, 11:08 PM) slipped tonight at 8:55 PM, so it is open again and back in Revise tomorrow, Sun 18 Oct. Pending Check it held: Q29 (on its row tonight) and Q27 (in Revise today).
  - Open: 22 wrong (21 never repaired + Q17) and 8 blanks; 172 marks = 22 × 6 + 8 × 5 = 35 + 29 + 28 + 23 + 22 + 18 + 17 over seven chapters.
  - Costliest: Admission of a partner, 35 (5 wrong: Mock 3 Q42, Q38, Q45, Mock 2 Q11, Q17; 1 blank, Mock 3 Q47; Q6 and Q21 held). Repairable there: Q42, Q38, Q45 (Mock 3) and Q11 (Mock 2): the app chips, "Repair 3 from Mock 3", "Repair 1 from Mock 2". Newest paper 34 of 46 right (74 percent), credits 40: rule 3, "Repair Q42".
  - Revise: 30 in rotation (14, 8, 5, 3), 8 due today = 5 questions back + 1 Check it held (Q27) + 2 cards (Sacrificing and gaining ratio). Badge 8; 6 at card 3.
  - Concepts: 9 lessons (Accountancy 5 in 4 of 12 chapters, Business Studies 2, English 2, Economics 0), 2 read, 8 cards in Revise (2 × 4), 23 recalled.
  - The stems, lesson titles and chapter split are illustrative, written for the mock, not product data.

Captures are listed in section 13.

---

## 10. Review against the owner's research brain

### 12-part anti-slop acceptance test (`papers/ai-slop-independent.md`)

| # | Part | Verdict |
|---|---|---|
| 1 | Product identity | Pass: CUET marking in every figure, the repair and Check it held loop, the lifeline in the app's words, lamp-lit objects and rooms, Bricolage numerals, the A1 key, volt on Night Arena. |
| 2 | One primary action | Pass: one lime key in the content per screen, chosen by RESULT's rules; the A1 key is the owner's accepted chrome fill. |
| 3 | True content | Pass in the mocks: one fixture, checked by `check.mjs` (sums, weekdays, banned strings). In the build every number comes from attempts, the repair record, checks and `revise_cards`. |
| 4 | Hierarchy | Pass as designed: move, receipt, mistakes by marks; to be confirmed with students. |
| 5 | Composition | Pass: 16 px gutters, 1,080 px desktop measure, two columns with no holes (sticky right column). |
| 6 | Meaningful typography | Pass: display numerals for marks and counts, semibold for findings, ink-3 for support, tabular numbers; no ALL-CAPS, no eyebrows (the lesson's subject line now sits under its title). |
| 7 | Statefulness | Pass: ready, opened, free sheet, failure, offline, zero credits, empty drawn; loading, rule 4, nothing open, Revise done and large text specified. |
| 8 | Accessible interaction | Designed: 44 to 56 px targets, words beside colours (minus signs, pill words, "Your pick" and "Correct"), reduced motion; verify in P-LR7. |
| 9 | No pseudo-evidence | Pass: no improvement percentages, no cause claims; the marks head says what was lost, never what will be won back. |
| 10 | Motion rationale | Pass: count-up only for changed numbers, opening shows what opened, stage change after server confirmation. |
| 11 | Measured usability | Leading metric: share of Review opens followed within 60 seconds by a tap on the panel key. Second: share of open mistakes whose free answer sheet is opened before a repair. Guardrails: Revise completion, repair refund rate and Check it held held-rate must not fall; lesson starts from a mistake versus from the library. |
| 12 | Human critique | Applied twice: the first pass (session figures, plan card, second Revise card, Review again, due-cards hero moved), then the independent critic's 20 points (section 14). |

### 0/1/2 rubric (internal checklist; the owner signs off)

| Dimension | Score | Note |
|---|---|---|
| Task fit | 1 | Built to the two jobs in section 1; validated only after P-LR7 and student sessions |
| Information architecture | 1 | Two views, one queue, one engine with RESULT and Today; not yet used by a student |
| Content truth | 2 | One fixture, a checker, real weekdays, RESULT's pricing |
| Readable hierarchy | 1 | Panel down to five parts on the web; the app hero still carries seven (owner-kept chips) |
| Visual specificity | 1 | Existing brand world, A1 drawn; no new decoration |
| Accessibility | 1 | Specified; verify in P-LR7 |
| Functional states | 1 | Seven drawn, five specified |
| Trust | 2 | Free answer before any spend, costs before AI calls, totals on per-paper repairs, "opens free" |
| Intentional motion | 1 | Specified with values; judged in use |
| Performance | 1 | One new read replaces three on Review; measure |
| Responsive integrity | 1 | 390, 1440 and 412 mocked; build pending |
| Instrumentation | 0 | Metrics named; events not built (add with P-LR1 and P-LR4) |

---

## 11. Questions for the owner

1. **One Revise queue** holds wrong answers, Review again, Check it held and lesson cards (each card says what it is). Is one queue right, or should lesson cards stay separate?
2. **Revise and the key.** So that Review, the result and Today always name the same next move, Revise is a quiet row under the receipt and never the lime key. Should it take the key on days it is due (that would change the shared rule on all three pages)?
3. **Confirming A1 here** (`web-review-390-night.png`, `app-review-412-night.png`): the lime Start key you chose sits beside Review's one lime key. Both stay as drawn, and the Start key never changes look. Is that the look you want on Review, Revise and Concepts?
4. **The name "Concepts"** for the lesson library on the website too (the app already uses it), with "Learn" kept as a lesson's first step. Agreed?
5. **The Review badge** counts what is due in Revise today, not open mistakes. Agreed?

---

## 12. Not decided here, and cross-decision flags for the lead

- The repair flow itself (retry before the key, the reason, Check it held) is RESULT-1017 and the v13 review branch; this decision places its entry and its outcomes. Progress is unchanged. The Mob, Colleges and Today are their own decisions.
- **Flags (not edited here; this commit touches only this doc and its mocks):**
  1. TODAY-1017 4.2 and 9 still ask the nav owner for a glass or outlined Start key on Today, and RESULT-1017 section 3 ("Why") says "the dock's Start steps back" while the result's key shows. Both conflict with NAV-1017 6.8 and the owner's A1 choice; START-1017 4.5 makes the key route-dependent on Practice. Review follows NAV-1017 6.8 and asks for nothing.
  2. TODAY-1017's ready state repairs a batch ("4 mistakes to repair", "Start repair, 15 min"), while RESULT-1017 rule 3 repairs one question ("Repair Q{n}"). Review follows RESULT. For acceptance 5 to hold on Today, Today's key must name the same first target (for example "Start repair: Q42 first"); the TODAY owner should decide the wording.

---

## 13. Captures

Every capture below was opened and looked at.

### 13.1 Current website (`tmp/design-1017/learn-review/live/`, unchanged from the first pass)

Captured headless from a temporary worktree of `deploy/web-1017` (97210ab0) through the `/preview/arena` and `/preview/study` fixtures. Pages, each at 390x844 and 1440x900 in Night and Day plus full-height Night: `review`, `review-saved` (F17), `review-empty` (lamp-lit Mobi), `review-error`, `review-loading`, `revise`, `revise-empty`, `rules`, `progress`, `lab-result`, `learn`, `lesson`, `run` (74 files).

### 13.2 Current app (goldens, `tmp/design-1017/learn-review/app-current/`, unchanged)

From `wt-v13-review/flutter_app/test/golden/` (branch `ui/v13-review`, 8fe53c87): `r390_tab_full_night.png` and `_day` (hero with Q chips and Show me), `r390_tab_rows_open_night.png` (lifeline connector), `r390_tab_history_night.png`, `r390_tab_empty_night.png` (lamp-lit room with Mobi), `r390_repair_entry_night.png`, `r390_again_question_night.png`, `revise_card_night.png` and `_day`, `learn_tab_full_dark.png` and `_light`, `unit_new_dark.png`, `run_lesson_block_dark.png`, `run_card_shown_dark.png`.

### 13.3 Mocks (`tmp/design-1017/learn-review/captures/`, all recaptured on 17 Oct after the revision)

Headless Chrome (`--headless=new`, a temporary profile deleted after the run) driven over the DevTools protocol by `tmp/design-1017/learn-review/cap.mjs` with `jobs.json`; one Chrome at a time.

- Web, each at 390x844 and 1440x900, Night and Day (`web-{state}-{390|1440}-{night|day}.png`):
  - `review`: rule 3 panel "Repair Q42", strip, Revise row, chapters; 1440 with the sticky right column.
  - `open`: the chapter opened at its rows: Q42's free answer sheet (Try it again, Show the answer, Repair Q42, 1 AI credit), Repair pills, Q17 "Slipped on a new question", Q47 "Try it again, free", "Show 2 more", the lesson link, "Repair 3 from Mock 3" and "Repair 1 from Mock 2".
  - `papers`: text pair 158 and 140, plain finding, three papers, across-papers rows.
  - `empty`: the lamp-lit room with Mobi, Example row, "Start 10 questions".
  - `fail`: the unreachable room with Mobi, "Your mistakes did not load", Try again, Practise anyway.
  - `zero`: rule 5 "Practise 10 on this chapter", "0 AI credits".
  - `revise`: card 3 of 8, mix line with "Check it held", no dock at 390, badge 6 at 1440.
  - `learn`: Concepts panel "Start the lesson, 9 minutes", Where you lose marks with marks, More current on the phone dock.
  - `lesson`: from Question 42, neutral block, "Start the lesson, 9 minutes".
- Web full pages: `web-review-1440-night-full.png`, `web-open-390-night-full.png`, `web-learn-390-night-full.png` (all 12 Accountancy chapters).
- App, each at 412x915, Night and Day (`app-{state}-412-{night|day}.png`): `review`, `open` (lifeline connector, pills), `sheet` (free answer sheet, answer shown), `revise` (no bar), `concepts` (Practice current), `empty` (lamp-lit room with Mobi), `fail` (cached page, "Could not refresh"), `offline` (key disabled), `zero` (rule 5).
- App full page: `app-open-412-night-full.png`.

58 files. The first pass's `web-repair-*`, `app-review-*` and the rest were replaced, not kept beside them.

---

## 14. Revision after the independent critic (score 6.2)

| # | Critic point | Resolution |
|---|---|---|
| 1 (high) | Mocks drew NAV option A; 5.3 asked the dock and sidebar keys to go quiet; Q3 re-asked A1 | All mocks redrawn with A1 (lime round key, neutral lens, constant sidebar lime key). The quiet-key request is deleted; 5.3 restates the one-volt rule for A1. Q3 is now a confirmation pointing at the captures. |
| 2 (high) | Next-move order and pricing differed from RESULT; a second builder | 5.3 uses RESULT's `nextMove` and its rows in its order, RESULT's 6-a-wrong, 5-a-blank pricing; Review only adapts input. `review_next_move.mjs` is gone; a cross-page test is in P-LR0. TODAY's batch wording is flagged (12). |
| 3 (high) | Q42 repaired on one screen, open on the next | One fixture; Q42 is open everywhere and is rule 3's target. The pending check is Q27 (repaired 14 Oct) in Revise, and Q29 (repaired tonight) on its row. `check.mjs` bans the old strings. |
| 4 (high) | Q17 pill "Back Tue"; "Tue, 21 Oct" wrong; slip rule missing | Q17 shows "Slipped on a new question"; back in Revise tomorrow, Sun 18 Oct (checked by a date function). Slip rule in 5.4: open again, opens free, priced again, in Repaired and Retested, not Still right. |
| 5 (high) | "Repair 3 in this chapter" under "6 to repair"; 3 of 7 mistakes missing | All 8 items of the chapter are listed or counted ("Show 2 more"); per-paper keys "Repair 3 from Mock 3" and "Repair 1 from Mock 2" match the 4 chips; every count comes from `chapterRows()`. |
| 6 (high) | No free answer or Try it again; Q chips with Show me and the lifeline connector gone | Free answer sheet on every open mistake (web in place, app `answer_sheet.dart`), Repair inside as the paid step; app chips with Show me and the lifeline connector restored; section 6 and acceptance 8 and 13 cover them. |
| 7 | Lamp-lit Mobi empty scene cut | Restored on both platforms (one Mobi), body cut to one line. |
| 8 | "126 marks" read as winnable | Head "22 open mistakes"; sub-line in ink-2 "With 8 left blank, they cost you 172 marks across 3 papers"; every chapter row names its papers. |
| 9 | Revise merge without dedupe; storage unstated | Dedupe rule and fixture; state in `revise_cards` with a `mode` column, read by both platforms; Review again's phone-only store becomes a cache; migration saved with a dry run. |
| 10 | "Check it held" renamed | Restored everywhere, with RESULT's outcome chips. |
| 11 | One tap spent up to 6 credits; no web batch repair | Rule 3 is "Repair Q42", 1 credit. Per-paper keys open an entry with the total and run per-question repairs (no new server batch). |
| 12 | Hero with seven text elements | Web panel: five parts, RESULT's value line once; the Revise head is "8 due today, about 7 minutes." only. App hero keeps the owner's chips, so it has seven; noted in the rubric. |
| 13 | App and web orders differed; Papers hero unstated; app rows "Question 42"; no Concepts marks; no mix line | One order, control first; Papers has no panel; app rows show stems; app Concepts shows marks; app Revise shows the mix line; deliberate differences listed in 5.13. |
| 14 | No failure, offline, zero, Revise-done or nothing-open states | Failure (web, app), offline (app), zero credits (both) drawn; rule 4, nothing open, Revise done, loading and large text specified (5.14). |
| 15 | Gold side stripe; squashed 2-point chart | Plain finding; text pair until the third paper. |
| 16 | "All chapters" not all; lesson and card counts disagreed | Every chapter in syllabus order; 9 lessons, 2 read, 8 cards, from the fixture on both platforms. |
| 17 | Phone dock highlighted Practice on Concepts | More is current on the phone web; Practice in the app, where Concepts is opened from Practice, with a back control. |
| 18 | "7 minutes" key under a 19-minute plan | "Start the lesson, 9 minutes" (Learn plus Lock it in); Apply keeps its own time. |
| 19 | Red "You are here" box | A neutral hairline block; red only on the pick. |
| 20 | 230 px hole at 1440; top bar repeated "Review" | Sticky right column holds the strip, Revise and Also in Review; the top bar has no page name. |
| 21 | Badge stayed 8 in a run; dock on during Revise | Badge 6 at card 3 (confirmed answers); dock and app bar hidden in the run. |
