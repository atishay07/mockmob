# Learn and Review, pass 1017 (F15): find, fix, keep, with one next move

Design decision for Review, Revise, the Mistake Lab's place, and Learn (Concepts), on the website and in the app. Decision document and static mocks only; the build comes after. Written 17 Oct 2026.

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
6. **No receipts.** Paid repairs and their checks are the product's proof of value (F18), but Review never says "6 of the 7 you checked on a new question held". The app's four-stage lifeline exists only inside the repair entry and one opened row.
7. **Learn is a destination students must remember.** It opens on a library in syllabus order with a paragraph explaining how Learn works. The link from a mistake to its lesson exists (`MistakeLessonLink`) but sits in the result's Repair step, 3,900 px down. Nothing on Review, on a mistake row, or in Practice's chapter list offers the lesson at the moment the student is missing the idea. (FA-8, FA-9; the Khanmigo lesson: the help must sit inside the work.)
8. **Copy that explains the system instead of the step** ("Each concept takes three steps…", "Lessons and recall keep ideas fresh. Marks come only from practice and mocks, so they are recorded separately; a recall rating schedules the next review and does not certify mastery.") and a contradiction: the web says Revise holds every wrong answer, the app's note says "Mistakes you repair come back".
9. **Empty states.** The web empty state is a scene plus "Nothing to review yet" with no sample of what will appear; the app's is good (example row, one key) and is the model. L12's wrong empty state on an account with papers is a load failure shown as empty; the states must differ.
10. **Slop on the web Learn page:** an arrow on the full-mock row, boxed "chips" for skill and minutes, icons on every line (`BookOpenText`, `Brain`, `Target`, `Timer`, `ChevronRight`). **In the app's Concepts** (`learn_tab_full_dark.png`): lessons sit in a rounded box inside the page (nested cards), every chapter summary has its own icon tile, and the hero is a gradient-filled card whose lime key is itself a gradient.
11. **Two denominators for the same paper.** The app's History says "18 of 50 marks lost here" (the chapter's share) right above "Mock 2, 205 of 250". A student reads 18 of 50 as a score. Marks lost are always stated as marks ("cost you 18 marks"), and "of 250" is kept for scores only.

What works and is kept (F16): the app's mistake-and-chapter structure, the lifeline Found / Repaired / Retested / Still right, the paper and 12-hour time on every row, "Opens free" for saved repairs, the repair entry's "What Repair gives you", the example-row empty state, the monumental number and lamp-lit object in the hero, Revise's honest "costs no credits, not in accuracy", the lesson engine (Learn, Lock it in, Apply), chapter summaries, the untaught-chapters fold, the Rule book, and the study preferences.

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

### 5.1 One word for one thing (both platforms)

| Thing | Student-facing name | Never call it |
|---|---|---|
| The tab and page | **Review** | |
| Its two views | **Mistakes**, **Papers** | To repair, History, sessions |
| A wrong answer | **mistake** | question to review, miss, question to look at |
| The paid fix | **Repair** | Review, look at |
| A repaired mistake | **repaired** ("Opens free") | |
| The new question after a repair | **check on a new question**; result **Held** or **Slipped** | Retest (allowed only as the lifeline stage label "Retested") |
| All keep work (wrong answers back, repaired mistakes before the key, pending checks, lesson cards) | **Revise** | Review due cards, Review again, Lock in, cards due for review |
| Where marks went | **Where your marks go** (Review, across papers) and the result's own fold (RESULT-1017) | Mistake Lab, SWOT (internal names only) |
| Lessons and their library | **Concepts** (library), **lesson** (one) | Learn (route only), study, unit |
| Lifeline stages | **Found, Repaired, Retested, Still right** (the app's existing words) | |

"Learn" remains the lesson's first step ("Learn, 7 min") and the route `/learn`. The desktop sidebar label becomes Concepts.

### 5.2 Review, Mistakes view

**Web phone (390).** Single column, 16 px gutters, 132 px bottom padding for the dock.

```
Review                                   h1, 34 px display
[ Mistakes 21 open | Papers 3 ]          segmented, 48 px, max 420
┌ Do this next ───────────────────────┐  the one raised surface (18 px radius)
│ 8 due in Revise today  about 7 min  │  26 px display, the tail in ink-3
│ [ volt: Revise 8 now ]              │  54 px
│ 5 questions you got wrong come…     │  15 px ink-2, the lead in ink
│ Free. Never counted in your marks.  │  13.5 px ink-3
│ ( Repair Partnership instead )      │  outline pill, 40 px
└─────────────────────────────────────┘
30 Found | 9 Repaired | 7 Retested | 6 Still right    receipt strip, hairlines
6 of the 7 you checked on a new question held. Q17 slipped; back Tue, 21 Oct.
21 to repair                         126 marks      section head; marks in bad ink
Costliest chapter first. A wrong answer costs 6 marks…
(obj) Partnership: admission of a partner      −36
      Accountancy, Mock 3 and Mock 2
      [==      ] 1 of 7 repaired               (tap: opens questions)
   (42) Goodwill brought in cash…   [Repair]
        Mock 3, 16 Oct, 9:40 PM
   (17) Hidden goodwill…            [Back Tue, 21 Oct]
        Mock 2, 12 Oct, 10:42 PM. Repaired 13 Oct, opens free
   Learn the idea first
   Admission of a partner, 7-minute lesson, free
(obj) Issue of shares                          −24
…  See all 6 chapters
Also in Review
  9 repaired / Revise schedule / Your rules / Saved questions / Not attempted
```

**Web desktop (1440, sidebar 232).** Content 1,040 px max. Row one: the next-move panel (left, 1.1fr) and the receipt strip (right, 1fr, 34 px numerals), top-aligned. Below, two columns (1.55fr / 1fr): "21 to repair" with chapter rows as a four-column row (object, chapter and source, progress, marks), and "Also in Review" on the right. An opened chapter keeps its questions under the row.

**App (412 dp).** The same order in the app's voice: the hero keeps its composition (overline, BricolageTitle chapter or "Revise", monumental BricolageCondensed number, lamp-lit object, volt pill key, cost line under it). Segmented **Mistakes, 21 open / Papers, 3**. The Revise note card ("Open Revise / Got it") and the Lab note card are removed as cards; their sentences live in the hero rule and the receipt line. The receipt strip, "21 to repair" with chapter rows (unchanged widget, `−36` added in the trailing slot), quiet rows. Bounce scrolling (F3, `BouncingScrollPhysics`).

### 5.3 The next move (one rule, shared with Today and the result)

Review's head shows exactly one move, picked in this order. It uses the same builder as Today (web `/api/learning/plan`, app `move_builder.dart`) restricted to these kinds, so Today, the result and Review never disagree on one day.

| # | When | Move (volt label) | Why line | Cost line | Quiet alternative |
|---|---|---|---|---|---|
| 1 | A repair's check on a new question is pending and the repair is under 48 hours old | **Check Q42 held** | "You repaired Q42 yesterday. One new question on the same rule." | "Free." | "Revise {n} instead" when Revise is due |
| 2 | Revise has 1 or more due today | **Revise {n} now** | "{a} questions you got wrong come back, plus {b} check on a new question and {c} cards from the {chapter} lesson." (parts with 0 are left out) | "Free. Revise is never counted in your marks or accuracy." | "Repair {chapter} instead" |
| 3 | Open mistakes and AI credits at least 1 | **Repair {k} mistakes** (k = open in the costliest chapter, at most 6) | "Your costliest chapter. {k} wrong answers across {papers}. A repair asks you to try again first, then shows why your pick looked right, names the trap and checks it on a new question." | "1 AI credit a mistake. You have {N}. No charge if a repair cannot be written." | "Practise 10 on this chapter instead" |
| 4 | Open mistakes, 0 credits | **Practise 10 on {chapter}** | "{k} open mistakes here cost you {m} marks." | "Repairs use AI credits. You have 0. They renew on {date}." | "Learn the idea first" if a lesson exists |
| 5 | Nothing open, nothing due | **Take a fresh paper** | "Every mistake is repaired or back in Revise. A new paper finds what is next." | "{count} questions in the bank. {price line from paperCopy}." | none |

Rules: the volt is the viewport's one lime fill (`data-page-primary`; the dock and sidebar Start keys show their quiet glass or outlined variant while it is on screen, the same request Today made of the nav owner). On the app the hero key is the one volt; if the owner keeps the lime-filled Start key (A1), that is a second fill and is his call (question 3). The move's chapter is always the costliest by marks lost (wrong × 6), ties broken by the newest paper.

### 5.4 The receipt strip

Four numbers with labels under them, hairline-divided, no card: **Found** (all wrong answers on record), **Repaired** (mistakes with a saved repair), **Retested** (repaired mistakes whose check on a new question was answered), **Still right** (of those, answered right). One line under it, generated:

- With checks: "**{held} of the {checked} you checked on a new question held.**" then the newest slip: "{chapter}, Q{n} slipped; it is back in Revise on {weekday}, {d Mon}." or "Nothing slipped."
- With repairs but no checks yet: "{repaired} repaired. Each comes back as a new question to check it held."
- With no repairs: "None repaired yet. A repair explains why your pick looked right, then checks it." (no strip numbers but Found)

No percentages, no claims of cause, no improvement in marks (that belongs to the result's "You improved because" card, FA-14, and only with the tie stated). Source: the repair record (`repair-record`, the F17 data) and the check outcomes.

### 5.5 Mistakes by chapter

- One row per chapter with open or repaired mistakes, sorted by marks lost on open mistakes. Row: subject object (48), chapter name, marks `−36` (wrong × 6, bad ink, display numerals), source line "Accountancy, Mock 3 and Mock 2", progress "1 of 7 repaired" with a thin bar (good ink fill).
- Show the top 4 chapters, then "See all {n} chapters" with the remaining names.
- **Opened chapter:** each mistake as a row: Q badge, the stem's first line, the paper and the 12-hour time it was attempted ("Mock 3, 16 Oct, 9:40 PM", F17), and a stage pill:
  - **Repair** (open) → opens the repair entry for that one question (cost shown there before Begin);
  - **Repaired, opens free** → opens the saved repair, never a paid one (F17);
  - **Held** (good ink) → the saved repair with its check;
  - **Back {weekday}** (dashed) → in Revise, with its next date;
  - **Slipped** → saved repair plus "Back in Revise tomorrow".
- Under the questions: **"Learn the idea first"** with "{lesson}, {m}-minute lesson, free" when a published lesson maps to the chapter or the question's concept (`MistakeLessonLink` logic, moved here). Then on the app the existing "Repair {k} from {paper}" pills (outline, not volt).
- "Not attempted" (blanks) is a quiet row in Also in Review: "4 left blank in Mock 3. Not mistakes; open the answer or try one again."

### 5.6 Also in Review (quiet rows, hairline, whole row is the control)

1. **{n} repaired**: "Each one opens its saved repair, free. {held} held on a new question, {slipped} slipped." → the repaired list (was the app's Repair record in History).
2. **Revise schedule**: "{n} questions in rotation. They come back after 1, 3, 7 and 21 days." → Revise's schedule view with the four lanes (moved from Revise's head).
3. **Your rules**: "{n} rules from your repairs. For your next mock: {active rule}." → `/review/rules`.
4. **Saved questions**: "{n} saved".
5. **Not attempted**: as above.

### 5.7 Review, Papers view

- **Trend** per subject with 2 or more papers: points with their marks and "of 250", paper name and date under each; no area fill, no gridlines beyond the base line.
- **The record finding** (RecordGlimpse, moved here from Today on 17 Oct): one sentence priced in marks, with its source ("From your answer times in Mock 2 and Mock 3").
- **Your {n} papers**, newest first: object, "Mock 3, Accountancy", "16 Oct, 9:40 PM. 12 mistakes, 1 repaired", score "158 of 250". Opens the result.
- Right column at 1440 (below on phones): **Where your marks go** (across papers), **Your traps across mocks**, **Progress** (study days, concept checks, playbook).

### 5.8 Revise: one queue that keeps everything

Revise becomes the single keep run. It reads four sources in this order and plays them as one session with one progress line:

1. Wrong answers due today from `data/revise.js` (same question; checks memory);
2. Repaired mistakes due for **Review again** (same question, before the key) — the app's `review/again` run joins here;
3. Pending checks on a new question from repairs (`RepairCheck` items not yet answered);
4. Lesson recall cards due (`/api/study/runs` mode `recall`), only from lessons the student has read.

- Daily cap: the existing 5 or 10 a day applies to sources 1 and 2; checks are always included; cards add at most 5. The head says the total and the minutes ("8 due today, about 7 minutes") and the mix ("5 questions back, 1 check on a new question, 2 concept cards").
- Each card says what it is and where it came from, on one line above the stem: "A question you got wrong. Mock 2, 12 Oct, 10:42 PM. Cash flow statement" / "A new question on your Q42 rule" / "A card from Admission of a partner".
- After an answer, the existing per-source feedback (Revise's key and stored explanation; the check's Held or Slipped with Mobi's one cheer; the card's rating keys).
- The four box lanes fold into "How Revise schedules" (S014) on the run page and are the Revise schedule row in Review.
- Free, no attempts row, not in accuracy (unchanged; stated once at the foot).
- Routes: `/review/revise` is the run. `/learn?recall=due` and the app's `/review/again` stay working and open Revise filtered to that source (deep links never break).
- **Copy fix:** Revise holds every wrong answer (the web truth). The app note "Mistakes you repair come back" is wrong and goes.

### 5.9 Concepts (the library, `/learn`)

- Title **Concepts**; lede "Short lessons on the ideas behind your mistakes. Read one in 7 minutes, then it comes back as cards in Revise."
- **Read this next** (the one volt): unfinished lesson ("Finish {title}, step {k} of {n}") → the lesson for the costliest chapter with open mistakes → the next unread lesson in the student's first subject → when everything is read: "Practise questions". Why line names the mistakes ("6 of your open mistakes are in this chapter"). Due cards are never the hero here: one cost line says "{n} due in Revise today", linking Revise.
- **Search** chapters and lessons (one field, 48 px), then the subject switch (object plus name, 48 px, the unselected ones desaturated as on the Start menu).
- **Where you lose marks** (only with a record): chapters with open mistakes, by marks, each with its lessons (ring, title, minutes or Read, what it covers) or "No lesson yet; practise the chapter".
- **All {subject} chapters**: the syllabus order list, chapter summaries, and the untaught fold (unchanged content).
- Side column at 1440 (end of page on phones): the study record as one line of three numbers, **Study preferences** fold (unchanged), **Test it in a full mock** row (no arrow).
- On phones Concepts lives in the More sheet (NAV-1017) and its page marks **Practice** as the current dock tab, because its everyday door is Practice's Concepts panel; the back control returns to wherever the student came from.
- Removed as blocks, moved as words: the three-step paragraph (now on the lesson page only), the "Ready to test yourself?" row (now the quiet row above).

### 5.10 A lesson opened from a moment

The lesson page (`/learn/[id]`) reads `?from=` and shows where the student came from:

- `from=q:{attemptId}:{n}`: a bad-wash strip "You are here from Question 42, Mock 3. You picked D, the answer was B. This lesson covers the idea behind it: {one line from the lesson's objective}." Back link "Back to Question 42". The third step reads "Back to Question 42: repair it, or practise 10 on this chapter".
- `from=chapter:{subject}:{chapter}` (Practice, Review chapter row): "{k} open mistakes in this chapter."
- `from=today`: Today's why line.
- No `from`: the current page.

The three steps (Learn, Lock it in, Apply) stay; "Lock it in" now says "After that they come back in Revise with your mistakes."

### 5.11 Where Learn appears (the moments)

| Moment | Surface | What the student sees |
|---|---|---|
| A mistake whose chapter or concept has a lesson | Review opened chapter; result mistake row (opened); repair entry (after the reason) | "Learn the idea first" with title, minutes, free |
| A chapter | Practice chapter picker and fine-tune (START-1017), Review chapter row | a small "Lesson, 7 min" line on chapters that have one |
| Practice | the Concepts panel (web `DashboardPageClient.jsx` `pr-concepts`; app `concepts_shelf.dart`) | personalised: "Admission of a partner, 7 min. 6 of your open mistakes are here." then "All concepts" |
| Today | the move, when the costliest leak is a concept gap and a lesson exists (TODAY-1017 move kinds) | "Read the idea behind Partnership, 7 minutes" |
| Ask Mobi inside a question | the answer offers the lesson when one exists | "There is a 7-minute lesson on this" |
| The More sheet and the desktop sidebar | Concepts | the library |

### 5.12 How Review connects to the rest

- **Result (RESULT-1017):** the result's mistake rows are the same rows (same stage pills, same "opens free"). After a repair's check, the row says "Back in Revise on {day}". The result's fold "Your rule and proof it stuck" links Review's receipt. "All saved mistakes" in the result's links becomes "Your mistakes in Review".
- **Today (TODAY-1017):** one builder; Review's head and Today's move are the same move on the same day. Today's "Last paper" row opens Review, Papers.
- **Bar and dock badge (NAV-1017 keeps a Review count):** the badge is **Revise due today** (sources 1 to 4). Open mistakes are a backlog, not an alert, so they are not badged (HIG: badges for what needs attention now).
- **Practice:** the Concepts panel as in 5.11; "Practise 10 on this chapter" from Review opens chapter practice through setup (cost shown first).

### 5.13 App parity rules

1. Same order, same names (5.1), same next-move rule (5.3) from the same fixtures, same receipt numbers, same stage pills.
2. The app keeps its own voice: Bricolage Condensed numerals, the lamp-lit hero, pill keys, glass top-bar controls, bounce scrolling. The web keeps its hairline editorial list. Neither copies the other's chrome.
3. A paper or repair done on one platform is on the other's Review within one refresh (the F17 repair record is the shared source).
4. One Mobi at most per screen: Review head has none; Revise keeps its graded-answer reaction (one at a time); a held check shows the one cheer (RESULT-1017); empty and failure states keep their one figure.

### 5.14 States

| State | Review (web and app) | Revise | Concepts |
|---|---|---|---|
| Loading | Skeleton of the head panel, the strip and three rows (no figure, no copy that could be wrong) | Card skeleton | Hero and three rows skeleton |
| **Failed to load (L12)** | "Your mistakes did not load. {cause}. Your papers and repairs are safe." Try again; cached rows still show with "Saved on this phone at {time}" (app). **Never the empty state.** | "Revise did not load. Your schedule is safe." Try again | "Concepts did not load." Try again, Practise questions |
| Empty (no paper) | "Your mistakes will gather here." one line on what appears, an example row tagged Example, volt **Start 10 questions**, cost line | "Nothing to revise yet. Questions you get wrong come back here after 1, 3, 7 and 21 days." with "Start 10 questions" | Hero = first lesson in the first subject; no "Where you lose marks" |
| Papers, nothing open | Head rule 5; strip shows Found and Repaired; "Every mistake is repaired or back in Revise." | | |
| Revise done today | Head moves to the next rule; Revise row says "Done for today. {n} come back tomorrow." | End: "{right} recalled, {wrong} come back tomorrow." | |
| Zero credits | Head rule 4; stage pills "Repair" still open the entry, which says the balance and renewal | unchanged (free) | unchanged (free) |
| Offline (app) | Cached list with the saved time; Repair keys say "Repairs need a connection" | Cached cards answerable only if the key is cached; otherwise "Revise needs a connection" | Offline packs (existing) |
| Large text 1.3x | Chapter rows wrap the name to two lines; marks keep their column; strip numbers shrink to 26 px floor | | |

### 5.15 Motion

Purpose only (AGENT_RULES 31), ease `cubic-bezier(0.23, 1, 0.32, 1)`, reduced motion lands every change at once.

- **Arrival (first open of the day):** the strip's numbers count from the last-seen values to now, once (the existing `RollNumber`, 700 ms, ease-out cubic), only for numbers that changed; nothing else animates on arrival.
- **Segment switch:** the selected pill slides (220 ms); the content crossfades with 8 px rise (180 ms). App: the existing `MmOverlapSwitcher`.
- **Opening a chapter:** height and opacity, 240 ms; question rows stagger 30 ms, at most 6; the chevron rotates 180 ms. Press feedback on rows: scale 0.98 (web 160 ms; app the content-layer press from GLASS-1017: scale 0.96).
- **A stage change returning from a repair or a check:** the row's pill crossfades to its new label (200 ms), the chapter's progress bar grows (320 ms), and the strip's number ticks once. Never before the server confirms (truth rule).
- **Revise card:** the existing rise (180 ms) and the lane pulse move into the schedule view; the progress ticks fill (160 ms).
- **No loops, no glow, no ambient motion.**

### 5.16 Copy (final strings)

| Key | Text |
|---|---|
| review.title | Review |
| review.seg.mistakes | Mistakes {n} open (web) / Mistakes, {n} open (app) |
| review.seg.papers | Papers {n} |
| next.overline | Do this next |
| next.revise.title | {n} due in Revise today, about {m} minutes |
| next.revise.key | Revise {n} now |
| next.repair.key | Repair {k} mistakes |
| next.check.key | Check Q{n} held |
| next.practise.key | Practise 10 on {chapter} |
| next.fresh.key | Take a fresh paper |
| strip.labels | Found / Repaired / Retested / Still right |
| strip.line | {held} of the {checked} you checked on a new question held. |
| strip.slip | {chapter}, Q{n} slipped; it is back in Revise on {weekday}, {d Mon}. |
| repair.head | {n} to repair / {m} marks |
| repair.sub | Costliest chapter first. A wrong answer costs 6 marks: the 5 you missed and the 1 taken away. |
| row.progress | {k} of {n} repaired |
| pill | Repair / Repaired, opens free / Held / Slipped / Back {weekday} |
| lesson.link | Learn the idea first / {title}, {m}-minute lesson, free |
| empty.title | Your mistakes gather here (the app's existing string, now on both) |
| empty.cost | About 10 minutes, {subject}. Free on your plan. |
| empty.body | Every wrong answer lands here with its paper and the time you attempted it, priced in marks, costliest chapter first. You repair it once, and Revise brings it back until it sticks. |
| fail.title | Your mistakes did not load |
| revise.head | {n} due today, about {m} minutes. Same questions check memory; the new one checks the rule. |
| revise.kind.q | A question you got wrong. {paper}, {d Mon}, {h:mm AM}. {chapter} |
| revise.kind.check | A new question on your Q{n} rule |
| revise.kind.card | A card from {lesson} |
| revise.foot | Free. Not counted in your marks or accuracy. |
| concepts.title | Concepts |
| concepts.lede | Short lessons on the ideas behind your mistakes. Read one in 7 minutes, then it comes back as cards in Revise. |
| concepts.next | Read this next |
| lesson.from | You are here from Question {n}, {paper}. You picked {x}, the answer was {y}. |

---

## 6. What moves where (nothing is deleted)

| Today | Goes to |
|---|---|
| Web R1 head "Review what mattered." and lede | Title "Review" and the segmented control |
| Web R2 lead count and "Open {session}" volt | The next-move panel (rule 3 opens the repair for the costliest chapter, not a result page); "questions to review" → "mistakes to repair" |
| Web R3 milestone notes | The receipt line (first repair, first held check) |
| Web R4 Revise entry | The next move (rule 2) and the Revise schedule row |
| Web R4 Rules entry | Also in Review: Your rules |
| Web R5 RecordGlimpse and paper trend | Papers view |
| Web R6 figures (Sessions saved, Answered right %, Last session) | Papers view per paper; accuracy stays on each result; "Sessions saved" becomes "Papers {n}" in the segment |
| Web R6 session rows | Papers view rows (same F17 stamp) |
| Web R7 compact Today plan card | Retired from Review: the next move uses the same builder, so it was a duplicate |
| Web R8 Study record and "Review due cards" | Revise (cards join the queue); the record numbers move to Concepts' record line |
| Web Revise head lanes (Box 1 to 4) | "How Revise schedules" fold and the Revise schedule row |
| App Revise note card ("Open Revise / Got it") | Next move rule 2 and the Revise schedule row |
| App "Review again" row and run | Revise source 2; `/review/again` deep link opens Revise filtered |
| App History: Mistake Lab note card | Papers view: the newest paper row opens its result; "Where your marks go" row |
| App History: Next from Mock 2 | The next move (one builder) |
| App History: Repair record | Also in Review: {n} repaired |
| App History: Past results | Papers view |
| App "Not attempted in Mock 2 (3)" | Also in Review: Not attempted |
| App "Where your marks go", "Saved questions", "Your rules" rows | Unchanged (Also in Review on Mistakes; Where your marks go on Papers) |
| App pip strip "1 repaired, 8 found" | The receipt strip |
| Learn L1 lede and L3 three-step paragraph | Concepts lede (one line); the steps live on the lesson page |
| Learn L2 hero: due cards case | Revise (the hero never shows due cards); the line "{n} due in Revise today" stays |
| Learn L4 subject tabs | Subject switch under search |
| Learn L5 chapters | "Where you lose marks" (with a record) and "All {subject} chapters" |
| Learn L6 untaught fold | Unchanged inside All chapters |
| Learn L7 study record | Record line (side column at 1440) |
| Learn L8 "Ready to test yourself?" with arrow | Quiet row "Test it in a full mock" (no arrow) |
| Learn L9 preferences and weekly plan | Unchanged fold |
| `MistakeLessonLink` on the result's Repair step | Review's opened chapter, the result's opened mistake row, the repair entry |
| Practice Concepts panel "Open Learn" | Personalised panel (5.11) plus "All concepts" |
| App Concepts "12 cards due" hero and "Review due cards" | Revise; Concepts' hero is Read this next |

---

## 7. Build packets

Builders pull the newest branch state first and keep other agents' edits. Owner-visible packets are built with Opus.

**P-LR0, shared rules and fixtures (both platforms, first)**
- New `data/review_next_move.mjs`: `reviewMove({ mistakes, revise, checks, wallet, plan })` returning `{ kind, title, key, why, cost, alt, target }` exactly as 5.3; `receipt({ found, repaired, retested, held, slips })` returning the strip and its line as 5.4; `chapterRows(mistakes)` sorted by marks (wrong × 6).
- Fixtures `data/tests/fixtures/review_next_move/{check_pending,revise_due,repair,zero_credits,all_clear,empty,f17_repaired}.json` and `data/tests/review_next_move.test.mjs` (add to `npm run test:recovery`).
- Server: `GET /api/me/review` (new, read-only) joining attempts' wrong answers, the repair record (F17), check outcomes and Revise state into `{ mistakes[], receipt, reviseDue: { questions, again, checks, cards }, chapters[] }`. Reuses `src/lib/server/revise.js` and the repair-record read; no new table.
- Lesson map: `data/study/lesson_map.mjs` `lessonFor({ subject, chapter, conceptId })` from the catalog (the matching rule in `MistakeLessonLink.jsx`), shared by Review, result, repair entry and Practice.

**P-LR1, website Review (Opus)**
- `src/components/RecoveryOverview.jsx`: `view="review"` renders the new `ReviewPage`; `view="progress"` unchanged.
- New `src/components/review/ReviewPage.jsx` (segments, head, strip, list, quiet rows), `ReviewNextMove.jsx`, `ReceiptStrip.jsx`, `ChapterRows.jsx` (opened chapter, stage pills, lesson link), `PapersView.jsx` (trend, RecordGlimpse, paper rows, across-papers rows), `review-1017.css`.
- Keep and reuse: `SessionRow` stamp logic (`paperStamp`), `RollNumber`, `RecordGlimpse`, `ReviseEntry` text (for the schedule row), `RulesEntry`.
- Remove from Review only (components stay for Progress and Today): `LearningNextAction compact`, `StudyProgress review`.
- `data-page-primary` on the volt; segment state in the URL (`?view=papers`) so Back works.
- Preview: `src/app/preview/arena/ArenaPreviewClient.jsx` gains `/api/me/review` fixtures for every row of 5.3 (`?move=check|revise|repair|zero|clear`) and `?record=empty|down`.

**P-LR2, website Revise queue (Opus for the run page, Sonnet for the orchestrator)**
- `src/components/revise/ReviseRun.jsx`: one run over the four sources; head and mix line; per-card kind line; lanes into a `SmoothDetails` "How Revise schedules".
- New `src/components/revise/reviseQueue.js` (client orchestrator: fetches `/api/me/revise`, pending checks, due cards; plays them in order; posts each answer to its own endpoint).
- `src/app/(app)/learn/page.jsx`: `?recall=due` redirects to `/review/revise?source=cards`.
- `data/mistake_lab.copy.json` `revise.*` strings as 5.16.

**P-LR3, website Concepts (Opus)**
- `src/components/study/StudyLibrary.jsx`: title Concepts, Read this next rule, search, subject switch, Where you lose marks (from `/api/me/review` chapters), All chapters, side column; remove the arrow row and the flow paragraph (moved per section 6).
- `src/components/study/LessonOverview.jsx`: the `from` strip and back link; step copy.
- `src/components/study/MistakeLessonLink.jsx`: reads `lessonFor`; used by `ChapterRows`, the result row and the repair entry.
- `src/app/(app)/dashboard/DashboardPageClient.jsx` `pr-concepts`: personalised panel.
- `src/lib/arenaNavigation.js`: label "Concepts" for the learn item (route unchanged).
- `src/app/(app)/AppLayoutClient.jsx`: Review badge = Revise due today.

**P-LR4, app Review (Opus)**
- `lib/features/review/screens/review_screen.dart`: segments Mistakes / Papers; hero from the shared rule; receipt strip; Also in Review rows; remove the Revise note card and the Lab note card as cards (copy moved).
- New `lib/features/review/model/review_move.dart` (port of P-LR0, tested against the same JSON fixtures in `test/fixtures/review_next_move/`), `widgets/receipt_strip.dart`.
- `widgets/tonight_card.dart` (hero kinds: revise, check, repair, practise, fresh), `widgets/review_rows.dart` (marks in the trailing slot, stage pills, lesson link), `widgets/next_from_mock.dart` and `record_entry.dart` into Papers, `copy.dart` (5.16).
- `lib/features/review/again/*`: entry routes into Revise source 2; the screen stays for the deep link.
- Bar badge source: `core/nav` count reads Revise due.

**P-LR5, app Revise queue (Sonnet, Opus review)**
- `lib/features/review/revise/revise_screen.dart`, `revise_data.dart`: four sources, mix line, kind line, schedule fold; `revise_copy.dart` (and remove "Mistakes you repair come back").
- Learn recall runs callable as a Revise source (`features/learn/data` run API).

**P-LR6, app Concepts (Opus)**
- `lib/features/learn/screens/learn_screen.dart`: hero Read this next; search; Where you lose marks; due cards out of the hero (`widgets/due_card.dart` becomes the one-line link).
- `screens/unit_screen.dart`: the `from` strip.
- `features/practice/widgets/concepts_shelf.dart`: personalised.
- `features/review/widgets/review_rows.dart` and `features/result/...` mistake rows: lesson link.

**P-LR7, gate (after the above)**
- Web visual gate at 390x844 and 1440x900, Night and Day, every row of 5.3 and 5.14 from the preview fixtures; real-pointer clicks on the volt, a chapter, a stage pill, a segment, the lesson link; hit test that nothing covers the page.
- App goldens Night and Day at 412x915 for the same states plus 1.3x text; then the emulator walk (device-truth rule) on a test account with papers and repairs, never the owner's.

---

## 8. Acceptance checks

1. **One glance (390 and 412).** Open Review on an account with papers: without scrolling you can read the next move with its key, why line and cost, and the four receipt numbers. Pass if all are in the first viewport.
2. **One volt.** At any scroll position, count fully lime-filled controls: exactly one (the next-move key while visible).
3. **One word.** Search Review, Revise and Concepts text for "review due", "Review again", "questions to review", "Lock in new cards", "to look at": no match (except the tab name and the lifeline label "Retested").
4. **F17 on every row.** Every mistake row shows its paper and "{d Mon}, {h:mm AM/PM}". A repaired mistake's pill says "Repaired, opens free" and opens the saved repair; the wallet is unchanged.
5. **Next-move rules.** With the fixtures: check pending → "Check Q42 held"; Revise due → "Revise 8 now"; repair → "Repair 6 mistakes"; zero credits → "Practise 10 on Partnership"; all clear → "Take a fresh paper". Today's move on the same fixture names the same action. Unit tests pass on both platforms against the same JSON.
6. **Receipt truth.** The strip's four numbers equal the repair record and check outcomes for the test account; no percentage and no marks-gain claim appears.
7. **One Revise.** With 5 wrong answers due, 1 repaired mistake due again, 1 pending check and 2 due cards, Revise shows "9 due today" with the mix line, plays all nine in one run with one progress line, and each card's kind line names its source. `/learn?recall=due` and `/review/again` open Revise filtered and still work.
8. **Concepts at the moment.** Open a chapter in Review with a mapped lesson: "Learn the idea first" shows; tap it: the lesson page shows "You are here from Question 42, Mock 3…" and "Back to Question 42" returns to the opened chapter. Practice's Concepts panel names the same lesson with the open-mistake count.
9. **Empty versus failed (L12).** New account: the empty state with an Example row and "Start 10 questions". Account with papers and the read failing (`?record=down`): the failure state with Try again, never the empty state.
10. **Badge.** The Review badge equals Revise due today; it is absent when nothing is due, even with open mistakes.
11. **Nothing lost.** Every row in section 6 is reachable: Rules, Saved, Not attempted, repaired list, schedule lanes, RecordGlimpse, paper trend, past papers, study record, preferences, chapter summaries, untaught chapters, Progress.
12. **Parity.** Night and Day at 390, 1440 and 412: same order, names, numbers and rules; AA contrast for every text token.

---

## 9. Mocks (static, real tokens)

- `tmp/design-1017/learn-review/web.html` (tokens from `deploy/web-1017` `src/app/(app)/arena.css`, Bricolage Grotesque and Hanken Grotesk, the web's own subject objects from `public/art/subjects/`). States by `?s=`: `review` (Revise due), `repair` (nothing due; costliest chapter opened), `papers`, `empty`, `revise`, `learn` (Concepts), `lesson` (opened from Question 42).
- `tmp/design-1017/learn-review/app.html` (colours from `lib/core/theme/mm_colors.dart`, the app's own font cuts and `assets/art/obj-*.webp`, copied into `learn-review/assets/`). States: `review`, `open`, `revise`, `concepts`, `empty`. The bar is NAV-1017 option A (glass capsule plus the glass Start key).
- One consistent student across every mock: Mock 3 Accountancy 16 Oct 9:40 PM, 158 of 250 (34 right, 12 wrong, 4 blank); quick practice Business Studies 15 Oct 7:05 PM, 32 of 50 (7 right, 3 wrong); Mock 2 Accountancy 12 Oct 10:42 PM, 140 of 250 (31 right, 15 wrong, 4 blank). Found 30 = 12 + 3 + 15; open 21 = 30 − 9 repaired (1 in Mock 3, 8 in Mock 2); open marks 126 = 21 × 6; all marks lost to wrong answers 180 = 30 × 6, of which Partnership (7) and Issue of shares (4) hold 66; the changed-answers finding is 3 right answers changed to wrong = 18 marks; Revise holds 30 in rotation (Box 1: 14, Box 2: 8, Box 3: 5, Box 4: 3) with 8 due today (5 questions, 1 check, 2 cards). The chapter split (6, 4, 3, 3, 3, 2) and the lesson titles are illustrative, written for the mock, not product data.

Captures are listed in section 13.

---

## 10. Review against the owner's research brain

### 12-part anti-slop acceptance test (`papers/ai-slop-independent.md`)

| # | Part | Verdict |
|---|---|---|
| 1 | Product identity | Pass: CUET marking (a wrong answer costs 6), the repair-and-check loop, the lifeline in the app's own words, lamp-lit objects, Bricolage numerals, volt on Night Arena. |
| 2 | One primary action | Pass: one volt per viewport, chosen by stated rules (5.3); the alternative is an outline pill. |
| 3 | True content | Pass in the mocks (every number adds up, section 9); in the build every number comes from the attempts, the repair record, checks and Revise state. |
| 4 | Hierarchy | Pass as designed: move, receipt, mistakes by marks; to be confirmed with students. |
| 5 | Composition | Pass: 16 px gutters, 1,040 px desktop measure, two columns only where they hold different jobs. |
| 6 | Meaningful typography | Pass: display numerals for marks and counts, semibold for the finding, ink-3 for support, tabular numbers; no ALL-CAPS, no eyebrow pills. |
| 7 | Statefulness | Pass on paper (5.14), including failed versus empty (L12). |
| 8 | Accessible interaction | Designed: 44 to 54 px targets, words beside colours (marks with a minus, stage names in pills), reduced motion; verify in P-LR7. |
| 9 | No pseudo-evidence | Pass: no percentages of improvement, no cause claims, cohort lines only where the server sends them. |
| 10 | Motion rationale | Pass: count-up only for changed numbers, opening shows what opened, stage change after server confirmation. |
| 11 | Measured usability | Leading metric: share of Review opens followed within 60 seconds by a tap on the next-move key. Second: week-one students who complete one Revise run. Guardrail: Revise completion rate and repair refund rate must not fall; Concepts lesson starts from a mistake versus from the library. |
| 12 | Human critique | Applied: the session figures, the compact plan card, the second Revise card, "Review again" and the due-cards hero were each asked "what would be better without this here?" and moved, not deleted. |

### 0/1/2 rubric (internal checklist; the owner signs off)

| Dimension | Score | Note |
|---|---|---|
| Task fit | 1 | Built to the two jobs in section 1; validated only after P-LR7 and student sessions |
| Information architecture | 1 | Two views, one queue, nothing deleted; not yet used by a student |
| Content truth | 2 | Every figure has a named source; mock arithmetic checked |
| Readable hierarchy | 1 | Captures show it; real use pending |
| Visual specificity | 1 | Existing brand world; no new decoration |
| Accessibility | 1 | Specified; verify in P-LR7 |
| Functional states | 1 | All specified; to build |
| Trust | 2 | Costs before AI calls, "opens free", free Revise stated, no urgency |
| Intentional motion | 1 | Specified with values; judged in use |
| Performance | 1 | One new read replaces three (`/api/recovery`, `/api/me/revise`, `/api/study/catalog` on Review); measure |
| Responsive integrity | 1 | 390, 1440 and 412 mocked; build pending |
| Instrumentation | 0 | Metrics named; events not built (add with P-LR1 and P-LR4) |

---

## 11. Questions for the owner

1. **Revise absorbs Review again and Learn's due cards** into one daily queue (each card still says what it is). Is one queue right, or do you want lesson cards kept separate from mistakes?
2. **The order of the next move:** a pending check first, then Revise when anything is due, then the costliest repair. Should a big repair (for example 36 marks) come before a short free Revise?
3. **The lime Start key (A1)** you chose at 3:10 am makes two lime fills on Review, Today and Concepts (the page's key and the bar's key). Keep A1 everywhere, or let the key go glass while a page's own lime key is on screen?
4. **The name "Concepts"** for the lesson library on the website too (the app already uses it), with "Learn" kept as the lesson's first step. Agreed?
5. **The Review badge** counts what is due in Revise today, not open mistakes. Agreed?

---

## 12. Not decided here

The repair flow itself (retry before the key, the fresh check, L13) is RESULT-1017 and the v13 review branch; this decision only places its entry and its outcomes. Progress (`/progress`) is unchanged apart from losing nothing. The Mob, Colleges and Today are their own decisions.

---

## 13. Captures

Every capture below was opened and looked at.

### 13.1 Current website (`tmp/design-1017/learn-review/live/`)

Captured headless from a temporary worktree of `deploy/web-1017` (97210ab0) through the `/preview/arena` and `/preview/study` fixtures; the server was stopped and the worktree removed after. Each image was opened, the 390 and 1440 sets also on one contact sheet each.

- **review**: Review, ready: "Review what mattered.", the big "8 questions to review", volt to a result page, Revise and Rules link rows, record finding card, paper trend, session rows, compact next step. `live-review-1440-day.png`, `live-review-1440-night-full.png`, `live-review-1440-night.png`, `live-review-390-day.png`, `live-review-390-night-full.png`, `live-review-390-night.png`
- **review-saved**: F17 state: "6 questions to review"; the 2 repaired show only as a count on the Mock 3 session row. `live-review-saved-1440-day.png`, `live-review-saved-1440-night-full.png`, `live-review-saved-1440-night.png`, `live-review-saved-390-day.png`, `live-review-saved-390-night-full.png`, `live-review-saved-390-night.png`
- **review-empty**: New account: lamp-lit Mobi, "Nothing to review yet", "Choose practice" plus the compact plan button (three lime fills with the Start key). `live-review-empty-1440-day.png`, `live-review-empty-1440-night-full.png`, `live-review-empty-1440-night.png`, `live-review-empty-390-day.png`, `live-review-empty-390-night-full.png`, `live-review-empty-390-night.png`
- **review-error**: Record read failing: "Your record did not load", Try again (distinct from empty). `live-review-error-1440-day.png`, `live-review-error-1440-night-full.png`, `live-review-error-1440-night.png`, `live-review-error-390-day.png`, `live-review-error-390-night-full.png`, `live-review-error-390-night.png`
- **review-loading**: Loading: "Opening your saved record." with Mobi. `live-review-loading-1440-day.png`, `live-review-loading-1440-night-full.png`, `live-review-loading-1440-night.png`, `live-review-loading-390-day.png`, `live-review-loading-390-night-full.png`, `live-review-loading-390-night.png`
- **revise**: Revise run: head copy, 4 due, 5 or 10 a day, box counts, question 1 of 4. `live-revise-1440-day.png`, `live-revise-1440-night-full.png`, `live-revise-1440-night.png`, `live-revise-390-day.png`, `live-revise-390-night-full.png`, `live-revise-390-night.png`
- **revise-empty**: Revise with nothing due: Mobi note, "Back to Review". `live-revise-empty-1440-day.png`, `live-revise-empty-1440-night-full.png`, `live-revise-empty-1440-night.png`, `live-revise-empty-390-day.png`, `live-revise-empty-390-night-full.png`, `live-revise-empty-390-night.png`
- **rules**: Rule book: the rule for the next mock, rules from repairs and from paper habits. `live-rules-1440-day.png`, `live-rules-1440-night-full.png`, `live-rules-1440-night.png`, `live-rules-390-day.png`, `live-rules-390-night-full.png`, `live-rules-390-night.png`
- **progress**: Progress: study days ring, weekday dots, weekly bars, badges. `live-progress-1440-day.png`, `live-progress-1440-night-full.png`, `live-progress-1440-night.png`, `live-progress-390-day.png`, `live-progress-390-night-full.png`, `live-progress-390-night.png`
- **lab-result**: Result with the Mistake Lab: 145 of 250, ledger, "Do this next / Repair Q42". `live-lab-result-1440-day.png`, `live-lab-result-1440-night-full.png`, `live-lab-result-1440-night.png`, `live-lab-result-390-day.png`, `live-lab-result-390-night-full.png`, `live-lab-result-390-night.png`
- **learn**: Learn library: lede, "Start here" hero, three-step paragraph, subject tabs, chapters and lessons, untaught fold, record line, "Ready to test yourself?" row with an arrow, preferences. `live-learn-1440-day.png`, `live-learn-1440-night-full.png`, `live-learn-1440-night.png`, `live-learn-390-day.png`, `live-learn-390-night-full.png`, `live-learn-390-night.png`
- **lesson**: Lesson overview: boxed chips, title, "Start lesson, 5 min", "You'll be able to". `live-lesson-1440-day.png`, `live-lesson-1440-night.png`, `live-lesson-390-day.png`, `live-lesson-390-night.png`
- **run**: Lesson run, step 1 of 4: monospace step label, "Meet the words" cards, sticky volt. `live-run-1440-day.png`, `live-run-1440-night.png`, `live-run-390-day.png`, `live-run-390-night.png`

### 13.2 Current app (goldens, opened in place)

From `wt-v13-review/flutter_app/test/golden/` (branch `ui/v13-review`, 8fe53c87), copied for one place to look into `tmp/design-1017/learn-review/app-current/` and opened: `r390_tab_full_night.png`, `r390_tab_full_day.png`, `r390_tab_rows_open_night.png`, `r390_tab_history_night.png`, `r390_tab_empty_night.png`, `r390_repair_entry_night.png`, `r390_again_question_night.png`, `revise_card_night.png`, `revise_card_day.png`, `learn_tab_full_dark.png`, `learn_tab_full_light.png`, `unit_new_dark.png`, `run_lesson_block_dark.png`, `run_card_shown_dark.png`. The remaining review and learn goldens (repair, check, ending, again, Concepts states) stay in the branch; Day twins match their Night structure. Today's own goldens are TODAY-1017's.

### 13.3 Mocks (`tmp/design-1017/learn-review/captures/`)

- `web-review-390-night.png`, `web-review-390-day.png`, `web-review-1440-night.png`, `web-review-1440-day.png`: Mistakes view, Revise due: next move "Revise 8 now", receipt strip, chapters.
- `web-repair-390-night.png`, `web-repair-390-day.png`, `web-repair-1440-night.png`, `web-repair-1440-day.png`: Mistakes view, nothing due: next move "Repair 6 mistakes", costliest chapter opened with F17 rows and "Learn the idea first".
- `web-papers-390-night.png`, `web-papers-390-day.png`, `web-papers-1440-night.png`, `web-papers-1440-day.png`: Papers view: trend, record finding, three papers, across-papers rows.
- `web-empty-390-night.png`, `web-empty-390-day.png`, `web-empty-1440-night.png`, `web-empty-1440-day.png`: New account: what appears here, Example row, "Start 10 questions".
- `web-revise-390-night.png`, `web-revise-390-day.png`, `web-revise-1440-night.png`, `web-revise-1440-day.png`: Revise run: 8 due, the mix line, card 3 of 8 with its source line, schedule fold.
- `web-learn-390-night.png`, `web-learn-390-day.png`, `web-learn-1440-night.png`, `web-learn-1440-day.png`: Concepts: "Read this next", search, subject switch, Where you lose marks, all chapters.
- `web-lesson-390-night.png`, `web-lesson-390-day.png`, `web-lesson-1440-night.png`, `web-lesson-1440-day.png`: A lesson opened from Question 42 with the "You are here from" strip.
- Full pages: `web-repair-390-night-full.png`, `web-review-1440-night-full.png`, `web-learn-390-night-full.png`.
- `app-review-412-night.png`, `app-review-412-day.png`: Review with Revise due: hero "8 to revise", segments, receipt strip, chapters.
- `app-open-412-night.png`, `app-open-412-day.png`: Nothing due: hero "6 to repair" on the costliest chapter, chapter opened (Found, Back Tue, Opens free), lesson link.
- `app-revise-412-night.png`, `app-revise-412-day.png`: Revise run, card 3 of 8 with its source line.
- `app-concepts-412-night.png`, `app-concepts-412-day.png`: Concepts: Read this next, search, Where you lose marks.
- `app-empty-412-night.png`, `app-empty-412-day.png`: New account with the Example row.
- Full page: `app-open-412-night-full.png`.
