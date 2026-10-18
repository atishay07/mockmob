# Review led by weak chapters, and the result's depth layer, pass 1018 (D15-D18)

Design decision only: no product code changes. It covers the website and the app. Static and clickable mocks are in `mockmob-next/tmp/design-1018/review-result/`. Written 18 Oct 2026, after the owner's 1:45 am words (`docs/brain/OWNER-FEEDBACK-2026-10-18-DAWN.md`).

**Ledger items answered:**
- **Primary:** D18 (Review leads with weak chapters), D16 (one calm depth structure), D17 (the replay bar, or cut the replay), D15 (one action label per mistake).
- **Kept:** N13 (weak chapters good; one unified way), N14 (scores by session: keep), N16 (answer sheet and summary: keep), F17 (saved repairs open free; paper and 12-hour time on every mistake).
- **Retired:** N15 ("Chapters by marks left open" is not good) is replaced.

**This is a refinement, not a rebuild.** The result's front stays exactly as it is in R4 (main 9578ee66). Every block of the R4 depth layer is kept; it is moved into six named parts (section 5.3 maps each block). Review keeps its papers, Revise, rules and saved items. Its lead changes from "N questions to review / Open Accountancy" to the weak chapters, which is the owner's own idea.

Per "Pattern to stop", **nothing here ships until the owner has seen these mocks and said yes.**

---

## 1. His words

> "We have tried so many times to fix this stuff, but no result. Maybe, rather than review, in the review section, we can integrate the weak chapters somehow, because that's actually more useful." (D18)

> "From the front, it's easy to analyze 20 out of 50 marks, right/wrong accuracy, blank, all this is good. As soon as someone wants to go deep into something, there will be a lot of clutter." (D16)

> "I really like the bar and how we were going with it, but it's very compacted. It should be like, if there are just 10 questions, then show it according to 10 questions only... Even the 58-second replay timestamp, nothing useful am I seeing here, only just gray boxes going and going and going." (D17)

> "It is showing 5 mistakes. Then in 1 and 3, it is showing 'repair first', and then it is just showing 'repair in 1'... 'check it here'... overall, it is still a very confusing UI." (D15)

And the rule behind the earlier rejections: "I like the old UI better even though it was more complicated... You have just made it more basic and removed the good stuff" (N12, 17 Oct). Folding the analysis behind a link was part of what he rejected. So this design keeps every part visible by name, with its finding, and opens one at a time. Nothing hides behind a single "Full analysis" link.

## 2. What exists now (read, not assumed)

**Website result, R4** (`src/app/(app)/result/[id]/ResultPageClient.jsx` at 9578ee66). Its 390 and 1440 captures are in `mockmob copy/captures/r4-result/after2` and `after3`. Top to bottom:

1. **Front card** (`ResultHero` + `NextMove`):
   - Mobi, the receipt with 12-hour time, the score over 250;
   - the costliest-chapter line and its detail;
   - the key notice;
   - the four counts and the 44 px answer map;
   - "Do this next", the volt key, its value and cost, and the alternative.
2. **Mistake Lab, open:**
   - "You missed N marks. Here's where they went." with the ledger (group bar, seven groups, changes line, cohort line);
   - "Your N mistakes" (chips Repair first / Repair / Check it held..., Show all, blanks, totals);
   - **Find**: Replay (10-minute rows, a 50-hair mini map, chips, facts), Time and decisions, Every answer you changed, Your traps across mocks;
   - **Prove**: rule check, same mistakes later, fresh questions, across your mocks.
3. Mob row.
4. **SWOT** ("After this mock": Do these next, Strengths, Weaknesses, Opportunities, Threats).
5. Key re-check log and corrections.
6. **Answer by answer:** 50 rounded cards with filters.
7. Next paper and links.

On a phone, that is about 11 screens of scrolling, with the same mistakes appearing in four places.

**Website Review, R4** (`src/components/RecoveryOverview.jsx`, `view="review"`; capture `tmp/arena-1017d/review/base-m-dark-full.png`):
- "Review what mattered." / "8 questions to review, of 20 answered" / volt "Open Accountancy, 16 Oct";
- Revise and Your rules links;
- the record glimpse card (which the dock covers at 390);
- the score trend;
- "Your 2 sessions" figures and session rows;
- "Your next step: 10 questions".

The weak chapters live on another page (`/analytics`, "Chapters, by marks left open"; N13 good, N15 not good).

**LEARN-REVIEW-1017 (P-LR1, on hold).** It made Review a Mistakes page led by a next-move panel and a receipt strip, with mistakes by chapter below. Its Revise queue (wt-lr2) and Concepts (wt-lr3) are built. This decision **keeps** its chapter rows, the free answer sheet, F17 stamps, saved repairs and the one Revise row. It **changes the lead**: the weak chapters themselves lead, and each carries Practise (D18). The panel and the four-number strip are folded into the chapter and Saved repairs lines (section 4.6).

**App, v15** (`ui/v15-result`, a STOP POINT; goldens `full_top_night.png`, `replay_rest_night.png`):
- The result is a recap flow, then a full result screen with the analysis OPEN in a long stack.
- The volt is pinned at the foot.
- The replay is the same 10-minute clock as on the web, so it has the same "grey boxes" problem.
- Review (`ui/v13-review` and successors) groups by chapter with the lifeline connector.

## 3. The decision in four lines

1. **Review leads with Where you lose marks.** Chapters are ranked by marks lost across every paper. Each says "Lost 35 of the 80 marks on offer", with a bar. The open chapter carries **Practise 10 on this chapter** (the one volt) and lists its mistakes, each with one action. Below come Saved repairs, the Revise row, Your papers (scores by session), and Rules and Saved questions.
2. **The result's front is untouched.** Below it, **Your full analysis** is one index of six named parts:
   - Where your marks went;
   - Your mistakes;
   - Time and changes;
   - Did your rule hold;
   - After this mock;
   - Answer by answer.

   Each index row states what that part found, with a number. Exactly one part is open, below the index on phones and beside it at 1440. Every R4 block lives in exactly one part.
3. **The replay becomes one slot per question, sized to the paper.** Colour shows the result; height shows the time against the dashed even-pace line; a ring marks a changed answer. Play walks the real events with one plain caption ("20:40 Q22 changed D to A, a right answer made wrong"). It can collapse to one line. **A paper with nothing to replay says so in one sentence and draws nothing** (the 58-second case).
4. **One label per state, everywhere:**
   - **Repair**
   - **Check it held**
   - **See repair**
   - **Try it again**

   No "Repair first", "Repair in N" or "Check it here". Priority is shown by order, never by a label.

---

## 4. Review (web and app)

### 4.1 Order (same on both platforms)

1. **Title and one line:** "Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired." (There is no volt in the head.)
2. **Where you lose marks** (h2; "Most marks first" on the right). One sub-line: "Each chapter across Mock 3, Quick practice and Mock 2. Practise the chapter, then repair its mistakes one at a time."
   - **The top 5 chapters.** The first is open on arrival; one is open at a time. Then "See all 10 chapters" with the rest named and priced inline.
3. **Revise:** one quiet row. "8 due today. 5 questions back, 1 Check it held, 2 concept cards. About 7 minutes, free." It opens the wt-lr2 Revise run.
4. **Saved repairs** (h2; "9, each opens free"). Sub-line: "6 held on a new question, 1 slipped, 2 waiting for Check it held." Four rows, ordered slipped, then waiting, then held, then "Show all 9".
5. **Your papers** (scores by session, N14). The text pair "158 in Mock 3, Accountancy. Up 18 on 140 in Mock 2." (the trend line appears from the third paper; that rule is from LR-1017 5.7), then one row per paper with its object, name, 12-hour stamp, wrong and blank, and score over max.
6. **Also:** Your rules (7) and Saved questions (4), as quiet rows.

**Desktop (1440).** Two columns, 1.5fr and 1fr with a 56 px gap: the chapters on the left; Revise, Saved repairs, Your papers and Also in one sticky column on the right (top 84 px). **Phone (390, 412).** One column in the order above. The app draws the open chapter as its hero (section 4.5).

### 4.2 A chapter row

| Part | Content | Source |
|---|---|---|
| Object | the subject object, 48 px (the real `obj-*.v2` art) | `SubjectObject` |
| Name | chapter, semibold 16.5 | catalog |
| Marks | `−35` in bad ink, display numerals, with "marks" under it | `chapterRows()` |
| Line | "Lost **35 of the 80 marks** on offer, 16 questions in Mock 3 and Mock 2. 5 wrong, 1 left blank." | same |
| Bar | marks lost over marks on offer (35/80), wrong-fill on a hairline track, plus the open/close chevron | same |

- **Pricing** (it reconciles exactly):
  - marks on offer = 5 × the chapter's questions;
  - marks lost = 6 per wrong answer + 5 per blank;
  - so marks lost = on offer − scored.

  Questions whose key is held or corrected are left out (RESULT-1017 4.2). Ranking is by marks lost, then by more wrong answers, then by the newest paper.
- **The denominator is marks on offer, not "share of all lost".** The owner asked for real numbers with denominators. "35 of 80" also can't be read as a score.
- **Every number comes from one function**, `chapterRows(record)`, which also feeds the head line. In the fixture, the 10 chapters add up to the 220 marks of the head (`data.js` throws if they don't).

### 4.3 The open chapter

1. **Practise.** The open chapter's key is the volt: **"Practise 10 on this chapter"**, with "10 new questions, about 10 minutes. Uses 10 of your 40 credits." under it. This is the only lime fill in the content (A1's Start key is the accepted chrome fill). It follows whichever chapter is open, so there is always exactly one.
2. **"{n} mistakes to repair"**, newest first. One row per never-repaired wrong answer:
   - Q badge;
   - the stem's first line (never "Question 42");
   - "Mock 3, Fri 16 Oct, 9:40 PM" (F17);
   - "D yours / B answer" rings;
   - one action: **Repair**.

   Tapping the row opens the free answer sheet in place (LR-1017 5.5: Try it again with the key hidden, Show the answer). Repair is the paid step inside it.
3. **Foot**, plain sentences:
   - "1 left blank: Q47, Mock 3. Try it again, free."
   - "1 repaired: Q17 from Mock 2, which slipped on a new question tonight. It is in Saved repairs."
   - Then the cost once: "Each repair is 1 AI credit; you have 68. No charge if a repair cannot be written. Seeing the answer and trying again are free."
   - Then "Learn the idea first: {lesson}, 7-minute lesson", shown only when `lessonFor()` maps one.

Repaired mistakes are **not** repeated as rows under the chapter. They live in Saved repairs, so each list has one kind of row and one action. The chapter still counts them in its marks and names them in its foot. Nothing disappears.

### 4.4 Saved repairs and Revise

- **A Saved repairs row** has:
  - Q badge (ring colour = state: neutral waiting, good held, warn slipped);
  - chapter;
  - paper and 12-hour stamp;
  - a state line ("Slipped on a new question tonight, 8:55 PM. Back in Revise tomorrow." / "Repaired tonight, 8:30 PM. One new question shows whether it held." / "Held on a new question. Repaired Tue 13 Oct, 10:40 PM.");
  - one action: **Check it held** (waiting) or **See repair** (held or slipped).

  Every saved repair opens free (F17; never a paid repair again).
- **Revise is never the volt on Review.** It is the quiet row with its count, the same as LR-1017 5.3.

### 4.5 The app's voice

- **Same order, names, numbers and labels.**
- **The open chapter is the app's hero card:**
  - "You lose the most marks in";
  - the chapter in BricolageTitle;
  - the monumental BricolageCondensed **35** with "of 80 marks lost";
  - the lamp-lit object (no lamp wash);
  - "16 questions in Mock 3 and Mock 2: 5 wrong, 1 left blank.";
  - the bar;
  - the volt pill "Practise 10 on this chapter" and its cost line.
- **Directly under the hero:** "4 mistakes to repair" with the kept **lifeline connector**, the round state-coloured badges and raised "Repair" pills. Then the foot.
- Then "More chapters" (rows open on tap, the next becomes the hero), the Revise row, Saved repairs and Your papers. The glass capsule and the round lime Start key are unchanged (A1).

### 4.6 What moves where on Review (nothing is deleted)

| R4 / LR-1017 piece | Goes to |
|---|---|
| "Review what mattered." and lede | the title "Review" and the one-line marks sentence |
| "8 questions to review, of 20 answered" and the volt "Open Accountancy, 16 Oct" | the chapter list; the result is reached from Your papers rows. The volt becomes the open chapter's Practise |
| Revise link | the Revise row |
| Your rules link | Also: Your rules |
| Record glimpse card ("X is where the most marks are open") | it *is* the lead now (the first chapter); "See your full record" moves to the foot of Your papers |
| Score trend (N14) | Your papers: the text pair until 3 papers, then the trend line |
| "Your 2 sessions" figures and rows | Your papers rows (the same F17 stamp) |
| "Your next step: 10 questions" card | retired as a duplicate of the open chapter's Practise |
| LR-1017 next-move panel and its rule 3 key "Repair Q42" | each mistake's Repair; the result page keeps "Repair Q42" as its next move |
| LR-1017 receipt strip (Found, Repaired, Retested, Still right) | the head line ("9 are repaired") and the Saved repairs sub-line (held, slipped, waiting). The app's lifeline stages stay in the repair entry |
| `/analytics` "Chapters, by marks left open" (N15) | replaced by this list. `/analytics` keeps its trend and subjects and links here for chapters |

### 4.7 States

| State | Review |
|---|---|
| Ready | as drawn (`web-review-*`, `app-review-*`) |
| Another chapter open | that chapter takes the volt; the first closes (`web-review-other-*`) |
| One paper only | the same list from one paper; the line reads "in Mock 3" |
| Every mistake in a chapter repaired | "Nothing left to repair" in the list; Practise still leads ("Practise to prove it on new questions") |
| 0 credits | Practise still shows its price; under it, "You have 0 credits. They renew on {d Mon}." Repair says "1 AI credit, you have 0" inside the sheet |
| Empty (no paper) | LR-1017's lamp-lit room with Mobi, an example chapter row and "Start 10 questions" (kept) |
| Failed to load | LR-1017's failure state (never the empty state, L12) |
| Loading | skeletons of the head line and three chapter rows; no numbers |

---

## 5. Result depth (web and app)

### 5.1 The front: untouched

The front stays exactly as R4 draws it:
- `ResultHero`: Mobi, the receipt, the score, the verdict and detail, the notice, the four counts and the 44 px answer map;
- `NextMove`: Do this next, the volt, the value, the cost and the alternative.

The app front stays as v15 draws it: the monumental score, the marks bar, Mobi with the finding, the "Why Q42 first" card, "Continue recap", and the pinned volt foot.

The mocks redraw the front only to show the depth below it in context (`web-result-front-*`, `app-result-front-*`).

### 5.2 Your full analysis: one index, six parts, one open

- **Title "Your full analysis"** (the app already uses it); one line: "Six parts, each with what it found. One opens at a time."
- **Index rows** (72-76 px, hairline-divided, no cards): the part's name (display semibold), its finding in one sentence with real numbers, and a short figure on the right (92 marks / 16 / 46m 36s / Held / 50).
  - The open row gets a neutral lit fill and a 3 px ink bar on its left edge. **Never lime.**
- **Phone (390, 412):** the index sits whole, then the open part below it.
  - The part's heading sticks under the top bar, with "All six parts" (it jumps back to the index).
  - Each part ends with "Next: {next part}".
  - Tapping an index row opens that part and scrolls its heading under the bar.
  - Default open: **Where your marks went**. The front's "Repair Q42" opens **Your mistakes** at Q42; an answer-map bubble opens Your mistakes for a wrong answer or blank, or Answer by answer for a right one.
- **Desktop (1440):** master and detail. The index (360 px) is sticky on the left; the open part sits on the right, with its own h3.
- **The selection lives in the URL** (`?part=time`), so Back returns to it and a link can open a part.
- **Why this is not the 17 Oct fold:**
  - every part is named on screen with what it found, so the information is visible at a glance;
  - one part is always open, never zero;
  - nothing sits behind a single link.

  If the owner still prefers several parts open at once, it is a one-line change (question 2).

### 5.3 Where every R4 block goes (nothing lost)

| Part | R4 blocks inside it, in R4's order |
|---|---|
| **Where your marks went** | Lab heading finding; ledger group bar; the seven ledger groups with Q chips and "See it in the replay"; changes line; first picks / final answers; cohort line with Q chips; How this is counted; key re-check log and corrections (as rows under "Under re-check or corrected") |
| **Your mistakes** | MistakeList in repair order: each row opens its answer body (How others answered, options, your time and picks, the book explanation, MistakeRepair with Check it held, the key notices, Report a problem); Show all; blanks row; RepairTotal; "Reopening a repair is free"; the lesson link; the repair run track and ending (unchanged) |
| **Time and changes** | the new Replay (section 6); Time and decisions (paper pace, median); Where your time went; time on right, wrong and blank; Every answer you changed; Your traps across mocks |
| **Did your rule hold** | Prove: the rule check with its meter; same mistakes later; prove it on fresh questions; across your mocks |
| **After this mock** | the SWOT under plain headings: Costing you, Working, Room to grow, Watch. Do these next, with outline keys. App: Scores by session (N14) sits here too |
| **Answer by answer** | the filters (All, Wrong, Blank, Right) and every answer. Rows become hairline rows instead of 50 rounded cards; the answer body is unchanged. App: the answer sheet (N16) heads this part |

The Mob row, the next fresh paper and the links stay after the depth, as now.

**Part findings (generated, never typed):**
- marks: the biggest ledger group;
- mistakes: the counts and the newest repair state;
- time: time used of the limit, plus the changes' net;
- rule: the rule-check verdict;
- after: the strongest threat line;
- answers: the counts.

### 5.4 Motion (purpose only; ease `cubic-bezier(0.23, 1, 0.32, 1)`)

- **Switching parts:**
  - the index fill slides to the new row (200 ms);
  - the old part fades out (120 ms) and the new one rises 8 px while fading in (200 ms);
  - on phones the heading scrolls under the bar (native smooth scroll; instant under reduced motion).
- **Press feedback:** scale 0.98 on index rows and 0.97 on keys (160 ms). The app uses the GLASS-1017 content press (0.96) and MmOverlapSwitcher for the part swap.
- **No other change in this layer:** the front's arrival sequence (count-up, ripple) and Mobi stay as R4. No loops, no glow.

---

## 6. Replay (D17)

### 6.1 What it draws

| Element | Rule |
|---|---|
| A slot per question | in paper order, **one slot per question of this paper** (10 for a 10-question set, 50 for a mock) |
| Sizing | `perRow = ceil(N / ceil(N × (minSlot + 2) / width))`, minSlot 12 px on phones and 16 px on desktop. 10 questions at 358 px: one row of 34 px slots. 50 at 358 px: two rows of 25. Rows are balanced, so a short last row never strands. No 10-minute rows, ever |
| Fill | result: right (good ink at 60%), wrong (bad ink), blank (dashed outline, no fill), held key (dotted, as the ledger) |
| Height | time on the question ÷ the paper's even pace, capped at 3×; the dashed line marks even pace (1×). A blank opened for 10 s is short; a 2m 40s wrong answer is tall |
| Ring | above the bar top when the answer was changed (warn ink) |
| Labels | Q numbers under every slot up to 12 slots a row; otherwise 1, every fifth, and the last |
| Selected | a lit column with a hairline frame; the detail line under the bar: "Q22 · Cash flow statement · 38s on it, even pace 1m 12s · picked D at 20:22, changed to A at 20:40 · wrong, −1" |
| Collapse | one line of result ticks, Q1 to QN ("Collapse" / "Expand all 50"). **Default is expanded at every length.** Collapse is the student's choice, remembered per device |

### 6.2 Play

- **Previous, Play and Next** (44 px). The clock shows the paper time and "of 46:36".
- Play walks the paper in about 12 s. Previous and Next step one **real event**:
  - a pick;
  - a change;
  - a blank left;
  - a return visit;
  - the submit.
- **Questions not yet reached are dimmed to 20%.** The current one is bold, and one caption line says the event in words: "20:40 Q22 changed D to A, a right answer made wrong". At rest, the caption reads: "46 of 50 answered in 46m 36s. First pass ended at 45:48, then 3 return visits."
- In play, a question's ring appears when its change happens (the mock shows rings for the whole paper; the build follows this rule).
- **Reduced motion:** Play steps event by event on each press instead of running; nothing slides.

### 6.3 The cut rule (the 58-second paper)

**Draw no replay** when the paper has fewer than 3 answer events, or was submitted in under 2 minutes, or has no usable trace. In its place:
- a bold line: "Nothing to replay on this paper.";
- one sentence: "You submitted after 58 seconds with 2 of 10 answered, so there is no pace or change to show. Your 2 answers and 8 blanks are in Answer by answer.";
- one link: "Take these 10 again, no time limit".

That ends "grey boxes going and going". The index row for Time and changes says the same in short ("58 seconds. Nothing to replay.").

### 6.4 Data

- **No new data is collected.** `data/paper_trace.js` already records visits, picks, changes, marks for review and time away.
- **`data/replay.js` gains:**
  - `perQuestion: [{ n, sec, result, changed, visits }]` (total seconds per question across visits, minus time away);
  - `events: [{ at, n, kind: pick|change|blank|back|end, from?, to?, effect? }]`;
  - `cut: null | { reason, line }` from the rule above;
  - all words from `data/mistake_lab.copy.json` (`replay.*`), shared with the app.
- `rows`, `rowSec` and the 10-minute "By 20:00: 20 of 50 answered" lines are retired from the drawing. Their one useful fact, "At 40:00 you had answered 37 of 50. Even pace gets to 33.", stays in Time and decisions as a sentence.
- **Away time** is not drawn as hatched gaps any more. It is said once in the rest caption when it exists ("Away from the paper twice, 5m 10s in all").
- **Time per question** (D17's ask) is the bar height plus the detail line; Where your time went keeps its top four list under the replay.

---

## 7. One label per state (D15), on the result, Review and the app

| State | Action label | State words (where shown) |
|---|---|---|
| Wrong, no saved repair, key not held | **Repair** | none needed |
| Repaired, Check it held not taken | **Check it held** | "Repaired {when}. One new question shows whether it held." |
| Repaired and checked | **See repair** (opens free) | "Held on a new question" or "Slipped on a new question {when}. Back in Revise tomorrow." |
| Blank | **Try it again** (free) | "{n} left blank" |
| Key under re-check / corrected | no action | "Key being re-checked" / "Key corrected" (as R4) |
| 0 AI credits, wrong | **Repair** (the sheet says "1 AI credit, you have 0") | none |

**Removed from every surface:**
- "Repair first" (`ResultPageClient.jsx` line 441, `statusOf` case `first`);
- Today's "mistakes to repair first" (`src/lib/today/move.mjs` lines 132 and 266). The owner of the Today decision should take the same rule;
- any "Repair in {n}" or "Check it here" strings.

The owner saw "Repair in 1" and "Check it here" on the phone. A string search of R4's web source does not find them as literals, so packet P-RR7 audits the rendered page and the app for any composed variant.

**The counts agree:** "Your N mistakes" = the wrong count in the front = the rows plus "Show the other k".

---

## 8. Build packets

Builders pull the newest branch state first and keep other agents' edits. The web base is main (6c5e05b6 or newer), on top of the R5 branches already in flight; **wt-r5-result is working on D15 and D17 now and must take this spec instead of its own guess**. The app base is `ui/v15-result`, then its successor. Owner-visible packets are built with Opus. **Nothing is built before the owner approves the mocks.**

**P-RR0, shared data (Sonnet, Opus review)**
- `data/review_chapters.mjs`: `chapterRows(record)` (section 4.2 pricing and ranking), `savedRepairs(record)` (order: slipped, waiting, held), `reviewLine(record)`. App port: `lib/features/review/model/review_chapters.dart`.
- `data/replay.js`: `perQuestion`, `events`, `cut` (section 6.4); copy in `data/mistake_lab.copy.json` `replay.*`. App port: `lib/features/result/model/replay_model.dart`.
- `data/repair_presentation.mjs`: `actionLabel(state)` as section 7, the one source both platforms test against.
- **Fixtures:** `data/tests/fixtures/review/student-1018.json` from `tmp/design-1018/review-result/data.js` (the same student), plus `one_paper`, `all_repaired_chapter`, `zero_credits` and `empty`. The replay fixtures are `paper50`, `paper10` and `paper58s` (the cut case).
- **Tests** (in `npm run test:recovery`):
  - chapter marks sum to the papers' lost marks;
  - lost = on offer − scored for every chapter;
  - ranking ties;
  - the replay perQuestion seconds sum to the paper time;
  - the cut rule;
  - `actionLabel` never returns "Repair first";
  - the app runs the same JSON.

**P-RR1, website Review (Opus)**
- `src/components/RecoveryOverview.jsx` `view="review"` renders the new `src/components/review/ReviewChapters.jsx` page. `view="progress"` is unchanged.
- New components:
  - `ChapterRow.jsx` (row, bar, open body, Practise key, mistake rows, foot);
  - `SavedRepairs.jsx`;
  - `PapersList.jsx` (the text pair, then TrendScrub from 3 papers, then rows with `paperStamp`);
  - `review-1018.css`.
- Reuse the free answer sheet from LR-1017 P-LR1 (`AnswerSheet.jsx`), `ReviseEntry` text, `RulesEntry` and `SceneVignette` for empty and failure.
- The open chapter goes in the URL (`?chapter=adm`). `data-page-primary` goes on the open chapter's Practise. **No change to the dock, the sidebar Start key or `start.css`.**
- `/analytics`: remove "Chapters, by marks left open" and add one row, "Your weak chapters are in Review", that links to `/review`. The trend and subjects stay.
- Preview fixtures: `src/app/preview/arena/ArenaPreviewClient.jsx` `?review=student1018|one|done|zero|empty|down`.

**P-RR2, website result depth (Opus)**
- `ResultPageClient.jsx`: the front block is unchanged byte for byte (ResultHero, NextMove, answer map).
- Below it, the new `src/components/result/AnalysisParts.jsx` (index and detail, `?part=`, sticky heading on phones, master-detail from 1024 px). Each part renders the existing components, moved and not rewritten:
  - **marks:** LabLedger, cohort, KeyReviewLog, corrections;
  - **mistakes:** MistakeList, RepairTotal, lesson;
  - **time:** the new Replay, LabTime minus the old replay, traps;
  - **rule:** LabProof;
  - **after:** SwotPanel with plain headings;
  - **answers:** filters and rows.
- `jumpTo` opens the part that owns the row first (wrong or blank goes to mistakes; right goes to answers), then scrolls.
- `statusOf`: drop the `first` case; labels come from `actionLabel`.
- `result-1017.css`: the hairline answer rows (no 50 cards). `result-parts.css` is new.

**P-RR3, website Replay (Opus)**
- `src/components/result/Replay.jsx` rewritten to section 6:
  - slots sized to N;
  - play over `events`;
  - collapse remembered per device (localStorage in try/catch);
  - the detail line;
  - the cut state.
- `QuestionStrip` (the per-answer mini strip) reads `perQuestion` and highlights its own slot.
- `replay.css` rewritten: transform and opacity only, 180-200 ms, reduced motion as section 6.2.

**P-RR4, app Review (Opus)**
- `lib/features/review/screens/review_screen.dart`: the order of 4.1.
- `widgets/tonight_card.dart` becomes the chapter hero (4.5).
- `widgets/review_rows.dart`: open-mistake rows with the lifeline and "Repair" pills; the foot sentences.
- `widgets/saved_repairs.dart` (new). Your papers from `record_entry.dart` and `next_from_mock.dart`.
- `copy.dart` strings as sections 4 and 7.
- **No change to `start_key.dart` or any bar file.**

**P-RR5, app result depth (Opus)**
- `lib/features/result/full/full_result_screen.dart`: the front is unchanged.
- `full_sections.dart` becomes `analysis_parts.dart`: index plus the open part, the sticky part heading inside the app's own scroll, "Next:" rows, MmOverlapSwitcher.
- Moves:
  - `lab_ledger_section.dart` goes into marks;
  - the mistake rows go into mistakes;
  - `replay_section.dart` and `time_section.dart` go into time;
  - rule check and same-mistakes-later go into rule;
  - `swot_section.dart` and TrendSection (scores by session) go into after;
  - `answer_map.dart` and the answer rows go into answers.
- The volt foot is unchanged.

**P-RR6, app Replay (Sonnet, Opus review)**
- `replay_section.dart` rewritten to section 6 (CustomPainter slots sized to N, play over events, collapse, cut). Goldens `replay_rest`, `replay_scrub` and `replay_cut`, plus `replay_10`.

**P-RR7, gate (after the above)**
- **Web:** 390x844 and 1440x900, Night and Day, every state in 4.7 and the three replay fixtures. Real-pointer clicks:
  - a chapter;
  - Practise;
  - a Repair row (the sheet opens free);
  - each index row;
  - "Next:";
  - Play, Previous and Next;
  - a slot;
  - Collapse.

  Hit-test that nothing covers the page. Audit for labels: no "Repair first", "Repair in", "Check it here", eyebrows or ALL-CAPS.
- **App:** goldens at 412x915, Night and Day, plus 1.3x text; then the emulator walk on a test account with 3 papers, repairs, a slip and Revise due (device-truth rule; never the owner's account).

---

## 9. Acceptance checks

1. **Weak chapters lead (D18).** Open Review at 390 or 412 on an account with papers. Without scrolling you read the marks line, the top chapter's name, "−35", "Lost 35 of the 80 marks on offer" and the Practise key.
2. **Counts agree.** The head's 220 equals the sum of every chapter's marks. Each chapter's wrong and blank counts equal its rows plus its foot. The front's "Wrong 12" equals Your mistakes' 12. Saved repairs' 9 equals held + slipped + waiting.
3. **One label (D15).** On the result, Review and the app, every mistake row shows exactly one of Repair / Check it held / See repair / Try it again (or no action for a held key). The audit finds no other wording.
4. **The front is unchanged (D16).** A pixel diff of the result's front at 390 and 1440, R4 against the build, differs only where the depth begins.
5. **One structure.** The six parts are named with their findings. Exactly one is open. Every R4 block is reachable inside the part listed in 5.3 (a checklist test walks them).
6. **Replay fits the paper (D17).** A 10-question paper draws 10 slots across the width; 50 draws two rows of 25 at 390. Collapse gives one line. Play steps only real events. The 58-second paper draws no replay and shows the one sentence.
7. **Free before paid.** Opening a mistake's sheet, trying again and seeing the answer cost nothing; the wallet moves only on Repair, after it is written. A saved repair opens free.
8. **One volt.** At any scroll position, the only lime fill inside the content is the open chapter's Practise (Review) or the front's next-move key (result); A1's Start key is the other.
9. **Night stays subtle (D7).** No glow, no wash, no neon. Accent text appears only on focus rings and the app's "Continue recap" link (as v15). Day mode is checked with the same captures.
10. **12-hour time and real weekdays** on every stamp (a unit test formats the fixture: 16 Oct 2026 is a Friday, 12 Oct a Monday).

---

## 10. Against the owner's research brain

**12-part anti-slop test:**

| # | Part | Verdict |
|---|---|---|
| 1 | Product identity | Pass: CUET marking in every figure, the subject objects, Mobi on the front only, the lifeline in the app |
| 2 | One primary action | Pass: one volt in the content per screen |
| 3 | True content | Pass in mocks: one student in `data.js`, whose arithmetic throws on any mismatch. Stems are illustrative |
| 4 | Hierarchy | Pass: marks first, then actions, then records |
| 5 | Composition | Pass: hairline lists, no nested cards (the only raised surfaces are the front card and the app hero), 16 px gutters, two columns without holes at 1440 |
| 6 | Typography | Pass: display numerals for marks, no eyebrows or ALL-CAPS, sentence case. The app's "You lose the most marks in" is a lead-in sentence above its title, not a tag |
| 7 | States | Ready, other chapter, cut replay and 10-question replay are drawn; empty, failure, zero credits and loading are specified (reusing LR-1017's drawn ones) |
| 8 | Accessibility | Designed: 44 px targets, words beside colour (−35, "Wrong", "Changed" in the key), reduced motion. Verify in P-RR7 |
| 9 | No pseudo-evidence | Pass: no recovered-marks claim; "marks lost" only |
| 10 | Motion rationale | Pass: a part swap shows what opened; play shows real events |
| 11 | Measured usability | Leading: the share of Review opens followed within 60 s by Practise or a Repair. Second: the share of result opens where a part other than the default is opened. Guardrail: repair starts per result must not fall |
| 12 | Human critique | One self-review pass on the captures (fixes: a phone indent that squeezed mistake stems, the desktop column order, a sleepy Mobi swapped for the attentive one, the index-then-detail layout on phones so all six names stay visible) |

**0/1/2 rubric:**

| Dimension | Score |
|---|---|
| Task fit | 1 (his idea, drawn; not yet seen by him) |
| Information architecture | 1 |
| Content truth | 2 |
| Readable hierarchy | 1 |
| Visual specificity | 1 |
| Accessibility | 1 |
| Functional states | 1 |
| Trust | 2 |
| Intentional motion | 1 |
| Performance | 1 (one review read; the replay draws N slots, not SVG rows) |
| Responsive integrity | 1 |
| Instrumentation | 0 |

Evidence ids: S014 (progressive disclosure: frequent parts open, rarer parts one tap away), S016 (one word for one thing), T002 (progress counts only completed steps), FA-1/FA-3/FA-11 (`FEATURE-ADOPTION-2026-10-17.md`: one loop, one primary action, plain names priced in marks).

---

## 11. Questions for the owner (one each, with my recommendation)

1. **Review's key.** The open chapter's key is "Practise 10 on this chapter", and each mistake has its own "Repair". Is Practise the right lead, or should the top chapter's key be "Repair Q42" (the first mistake) with Practise as the second? *Recommendation: Practise, as you said in D18.*
2. **One part open at a time.** The six parts are always listed with what each found, and one is open (below the list on the phone, beside it on the laptop). Do you want strictly one open, or should a student be able to open several? *Recommendation: one, so the page never grows back into the long stack.*
3. **The replay.** One slot per question, sized to the paper, with time shown by height and a play that names each pick and change; a paper with nothing to replay says so instead of drawing. Keep it like this, or cut the replay completely and keep only "Where your time went" and "Every answer you changed"? *Recommendation: keep, as drawn.*
4. **"Chapters, by marks left open"** on Weak chapters (`/analytics`) is replaced by this Review list, and that page keeps its score trend and subjects. Agreed? *Recommendation: yes; one place for chapters.*
5. **Labels.** Every mistake shows one of four actions, Repair, Check it held, See repair or Try it again, and nothing like "Repair first". Are these the words you want? *Recommendation: yes.*

---

## 12. Not decided here, and flags

- **Today** uses "mistakes to repair first" (`src/lib/today/move.mjs`). The Today pass-1018 decision should adopt section 7's labels.
- **wt-r5-result** (`web/r5-result-1018`) is building D15 and D17 for release 5 now. It should stop at the label fix (section 7) and the replay's cut rule. The full replay and the parts wait for the owner's yes on these mocks.
- **LR-1017's cross-page `nextMove` parity** (result, Today, Review naming the same key) no longer holds for Review, because Review leads with chapters (D18). The result and Today keep it.
- The repair flow itself, Revise (wt-lr2), Concepts (wt-lr3), the Mob row and Ask Mobi (D6) are their own decisions.

## 13. Captures (headless Chrome via playwright-core, own temp profile, deleted after; every capture opened and looked at)

All are in `tmp/design-1018/review-result/captures/`. Mocks: `web.html?s=review|result|mistakes|replay|replay10|replaycut[&theme=light][&open=ret][&part=...]` and `app.html?s=review|result|mistakes|replay|replay10`; data in `data.js`, the replay in `replay.js`, the capture script `cap.mjs`.

- **Web, each at 390x844 and 1440x900, Night and Day** (`{name}-{390|1440}-{night|day}.png`):
  - `web-review`: Review, the weak chapters leading, Admission of a partner open with the volt Practise and 4 Repair rows; 1440 with the sticky right column (Revise, Saved repairs, papers);
  - `web-review-other`: Retirement and death of a partner open; the volt moves to it;
  - `web-result-front`: the R4 front, unchanged;
  - `web-result-depth`: Your full analysis, six named parts, Where your marks went open (phone: index, then the part; 1440: master-detail);
  - `web-result-mistakes`: Your mistakes open with one label per state ("Repair", "Check it held" on Q29) and the label key;
  - `web-replay50`: the replay for the 50-question mock, two rows of 25 at 390, the clock at 20:40 on Q22's change, Q22 selected with its detail line, then Where your time went;
  - `web-replay10`: the same component on a 10-question paper, 10 wide slots;
  - `web-replaycut`: the 58-second paper, no replay, one sentence.
- **Web full pages:** `web-review-390-night-full.png`, `web-result-390-night-full.png`, `web-replay50-1440-night-full.png`.
- **App, 412x915, Night and Day** (`{name}-412-{night|day}.png`):
  - `app-review`: the chapter hero with 35 of 80, the volt Practise, the lifeline mistake rows, the capsule and lime Start;
  - `app-review-lower`: Saved repairs and Your papers;
  - `app-result-front`: the v15 front with the pinned volt;
  - `app-result-depth`: the six parts with marks open;
  - `app-result-mistakes`: Your mistakes with "Repair" and "Check it held";
  - `app-replay50` and `app-replay10`: the replay sized to 50 and to 10.

49 files.
