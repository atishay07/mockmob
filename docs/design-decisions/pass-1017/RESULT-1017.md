# Result screen, pass 1017 (F11): what happened, then one next move

Design decision for the result screen after a mock or a practice set, website and app. Decision document and static mocks only; the build comes after. Written 17 Oct 2026.

Owner ledger items answered: **F11** (primary), F16 (keep what works, never cut), F14's rule ("one clear answer and one next move") applied here, L13 (Repair must be worth paying for), L15 (SWOT after each mock), L35 (Mobi at real moments). Evidence ids are from `docs/research/premium-ux-ui-2026-10/source-ledger/EVIDENCE_INDEX.csv` and rule numbers from its `AGENT_RULES.md`.

---

## 1. The problem, in his words

From `docs/brain/OWNER-FEEDBACK-2026-10-17.md` (F11), 17 Oct about 12:45 am, after using the website result and the app result:

- "Mobby sleeping here feels a bit weird to me and is very confusing to me. I don't know how to even enter this or what exactly it is trying to do."
- "I'm still not sure if 'repair the mistake' is what it is adding as a useful thing."
- "Submission is there, and the add submission is there." (Ledger: the submission is shown twice.)
- "This one is okay: the 'check it held'."
- "I had only requested all these features, but the UI is just too cluttered on the result screen. The SWOT analysis repair thing is just too much and too confusing. This is coming from a person like me who already understands everything on the site."
- "If I see it from the student's point of view, they won't be able to figure out anything in this UI. What is going on, and what do they have to do?"

And the rules he gave around it: F16 "keep what works, never simplify by cutting features"; F14 "one clear answer and one next move"; L13 (14 to 16 Oct) "We can't ask them to pay extra to just see the right answer"; L15 (15 Oct) "after each mock, add a SWOT analysis".

**The job of this screen, in one line:** a student who has just finished a paper must see in one glance what happened, and must know the one thing to do next. Everything else stays, one tap away, under a name they can understand.

---

## 2. What exists now (mapped from the live state)

### 2.1 Website (`wt-batch4b`, live main)

Captured from the development fixture `/preview/arena?view=result&mock=full` (Accountancy full mock, 50 questions, 145 of 250), headless Chrome, `next dev --webpack -p 3240` in `wt-batch4b` (stopped after).

- Full page at 390 Night: `tmp/design-1017/result/live/live-web-390-night-full.png`: **13,528 px tall**, about 16 phone screens.
- Also: `live-web-390-night-first.png`, `live-web-390-day-first.png`, `live-web-1440-night-first.png`, `live-web-1440-night-full.png` (11,358 px), the opened repair with Check it held: `live-web-390-night-repair-panel.png`.

Blocks, top to bottom, with heights at 390 and their source:

| # | Block (as it reads) | Height at 390 | Source |
|---|---|---|---|
| 1 | Hero card: Mobi pip (sleepy with "zZ" from 11 PM to 5 AM), "Session complete, Accountancy, 50 questions, 46m 36s", **145 / 250 marks**, verdict line plus Mobi's line "Saved. Repair one mistake tomorrow.", four stat tiles (Right, Wrong, Blank, Accuracy), the 50-bubble answer strip, volt **"Repair Q42 first"** with "18 of 22 other students got it right." | 941 | `src/app/(app)/result/[id]/ResultPageClient.jsx` lines 290 to 323; `reaction.js` (`mobiReaction`, hour rule); `src/components/brand/MobiReact.jsx` |
| 2 | Mistake Lab head "You missed 105 marks. Here's where they went." and the marks ledger (groups: Right then changed, Crossed out the key, 2 minutes or more still lost, Wrong in under 20 seconds, Other wrong, Opened left blank, Under re-check), re-mark line, cohort line, How we counted | 1,134 | `src/components/ScoreRecoveryLab.jsx`, `src/components/result/MarksLedger.jsx` |
| 3 | First timed mock prompt or older-paper line | varies | `components/timed/FirstTimedMock.jsx`, `result/OlderPaper.jsx` |
| 4 | Step 1 **Find**: Replay (paper as a clock), Time and decisions, Where your time went, Every answer you changed, Your traps across mocks | 2,430 | `result/Replay.jsx`, `result/TimeDecisions.jsx`, `result/TrapsMeet.jsx` |
| 5 | Step 2 **Repair**: lesson link, what a repair is, "0 of 15 explanations ready", queue of 3 (+ Show all 15), volt **"Repair Q42"**, credit line, "Your rules (7)" | 731 | `ScoreRecoveryLab.jsx` `RepairQueue`, `components/study/MistakeLessonLink.jsx` |
| 6 | Step 3 **Prove**: rule check, Same mistakes later, Try 5 fresh questions | 803 | `result/RuleCheck.jsx`, `result/SameMistakesLater.jsx`, `Prove()` |
| 7 | Across your mocks (folded) | 93 | `result/AcrossMocks.jsx` |
| 8 | **After this mock**: Do these next (3 items, each with a volt-outline "Set up"), SWOT (Opportunities, Threats, Strengths) | 1,266 | `result/SwotPanel.jsx` |
| 9 | Answer keys we are re-checking; corrections notice | 177 | `components/recovery/KeyReviewLog.jsx` |
| 10 | **Answer by answer**: filters (All 50, Wrong 15, Blank 3, Right 32), 50 rows; an opened row holds How others answered, options tagged "Key at submission" / "Your pick, key at submission", trap tag, Your time and picks, Book explanation, **Repair this mistake (1 AI credit)**, the reader Mobi, Report a problem | 4,928 | `ResultPageClient.jsx` 337 to 445; `recovery/MistakeRepair.jsx`, `RepairCheck.jsx` (Check it held), `RepairAsk.jsx`, `result/OthersAnswered.jsx`, `result/TrapTag.jsx`, `brand/ReaderMobi.jsx` |
| 11 | Take another fresh paper (no cap; built from the live bank) | 226 | `ResultPageClient.jsx` 452 to 466, `src/lib/paperCopy.mjs` |
| 12 | Links: Your full record, All saved mistakes, Open weak chapters, Back to Practice | 96 | `ResultPageClient.jsx` 468 to 473 |

What the owner hit, located:

- **The sleeping Mobi** is `mobiReaction(attempt, { hour })` returning `sleepy` between 11 PM and 5 AM (`lib/mobiMoments.js` `recapReaction`). He tested at 12:22 to 12:45 am, so both platforms showed it. It is a figure with no action and no meaning on a result.
- **The submission said twice (or more):** "Session complete" in the eyebrow, "Saved." in Mobi's line, "Key at submission" on every option, "Submitted at 51:46" in the Replay; in the app "Practice finished. Recorded at 12:22 AM." under the score and a second submitted line under the recap link on a mock.
- **Repair's value is unclear:** the hero key says "Repair Q42 first" with a cohort line; what a repair actually gives (the reason, the trap, a rule, a fresh check) is only stated 3,900 px further down (Step 2 paragraph) and in the row's small print.
- **Too much at equal weight:** two volt keys for the same action (hero and Step 2), three volt-outline "Set up" keys in the SWOT, the volt-tinted "Repair this mistake" panel in each row, plus the dock's volt Start: five or more volt surfaces per scroll. Three Mobis (hero pip, reader Mobi on rows, Repair Mobi). Three separate "what to do next" lists (hero key, Repair queue, Do these next).

Note on `wt-webux2` (motion and UX pass about to ship): it adds the Lab hero numeral (`.srl-hero`, "105 marks missed, of 250"), the Mob paper row (`components/mob/MobResultRow.jsx`), and it **removes** block 11 (Take another fresh paper) and the First timed mock prompt. This decision keeps both (nothing is deleted; see section 6).

### 2.2 App (`wt-owner/flutter_app`, v12; `wt-appux2` is the UX pass)

Screens from tonight's walk: `tmp/app-walk-1017/1A/L11-16-result.png` (first frame, sleepy Mobi, "0 of 5" before the count), `L11-17-result-later.png`, `L14-1` to `L14-4` (scrolling), `L13-1-repair-open.png` (repair start), `L14-11-same-mistakes.png`.

Practice result, `/practice/result/:attemptId` (`lib/features/practice/practice_result_screen.dart`):

| Block | Source |
|---|---|
| Finish moment: "Business Studies practice", **3 of 5**, "3 right, 1 wrong, 1 not attempted", bubble card, Mobi with a speech bubble ("Most of this set is right…"), marks bar, "14 of 25 marks. 1 wrong answer cost 6 of the 11 marks you missed.", "Practice finished. Recorded at 12:22 AM." | `practice/widgets/finish_stage.dart`, `widgets/marks_bar.dart`, `result_states.dart` |
| Wrong answers (1): the full question, options, "Your answer", Save, Report; Not attempted (1); Correct (3) | `practice/widgets/result_list.dart`, `result_question_card.dart` |
| "What this set shows" (observations with Show me) | `ObservationsPanel` in the same screen |
| Prove card | `ProveCard` |
| Pinned foot: volt **"Repair 1 mistake"**, caption "Nature & Significance of Management, about 5 minutes.", "Finish for now" | `practice/widgets/result_foot.dart` |

Full mock result, `/result/:attemptId` after the recap cards (`lib/features/result/full/full_result_screen.dart`): top bar (paper name, Replay recap), recap link and submitted line, `summary_section.dart` (score and Mobi, `MobiPose.sleepy` late at night), `lab_ledger_section.dart` (where the marks went), `swot_section.dart`, `replay_section.dart`, `time_section.dart`, traps, first fix (`recap/first_fix_card.dart`), Prove rule check, Same mistakes later, Across your mocks, `answer_row.dart` answers with the reader Mobi. The sleepy rule lives in `features/result/model/recap_variant.dart` (`isLateNightHour`).

`wt-appux2` has uncommitted edits in `finish_stage.dart`, `marks_bar.dart`, `result_foot.dart` and `practice_result_screen.dart` (AP-2/AP-3 motion). The app packet below builds on top of them.

---

## 3. The decision

**One screen, four layers, in this order on both platforms and for both practice sets and mocks.**

1. **What happened**, in one glance: one receipt line, the score with its denominator, a marks bar, the counts, and the one thing that cost the most marks.
2. **One next move**: the only volt action in view, chosen by the rules in 4.3, with one line on why and, for Repair, one line on what the student gets before paying.
3. **The mistakes**: one list in repair order, each row with its own repair entry and its "Check it held" status inline.
4. **Everything else, folded and named**: Where the marks went, Your time and changed answers, After this mock (SWOT and plan), How others answered, Your rule and proof it stuck, Every answer. Then the next fresh paper and the links.

Nothing is removed. Every block in section 2 has a place in section 6.

### Why (with evidence)

- **One primary action per task screen** (AGENT_RULES 7). Today the same action has two volt keys and competes with three "Set up" keys and the dock Start. The new screen has one volt in any viewport, and the dock's Start steps back while it shows (the `data-page-primary` rule already in `wt-webux2` `AppLayoutClient.jsx` line 170).
- **Rank by what helps the next decision** (AGENT_RULES 8; the CUET example in `papers/ai-slop-independent.md`: "a clear last-result diagnosis, a single next-best-move recommendation grounded in actual attempt history, why it was suggested, and a direct entry"). The diagnosis is the costliest chapter, the move acts on it, and the why line names the evidence (the pick, how many others got it right).
- **Progressive disclosure for secondary parts, never for frequent ones** (AGENT_RULES 10, S014). The mistakes are the frequent part, so they stay open. The Lab's analyses, the SWOT and the replay are deep reads: folded, each with a one-line teaser that states its finding, so the fold is not a mystery door.
- **Value before the gate, honest terms before the spend** (T003, T007, T009; AGENT_RULES 18, 19, 24, MockMob overlay "explain credit costs before irreversible model calls"). Repair's value line says exactly what a repair contains before the key is pressed, with the cost and balance next to it and the existing no-charge promise.
- **Scan-friendly data: value before label, units and denominators** (AGENT_RULES 9, 29). "128 / 250 marks", "Share Capital cost 29 of the 122 marks you missed."
- **Cards only where they group meaning** (AGENT_RULES 33): only the next-move panel is a raised surface (it holds the one action). Mistakes and folds are hairline lists, not boxes.
- **Real proof, no invented numbers** (AGENT_RULES 5, 9 in the anti-slop test): every number on the screen comes from the attempt, the Lab contract or the wallet, and the mocks use one consistent paper per state (section 9).

### Mobi: none on the result, one real moment inside a repair

- **No Mobi in the first viewport and none on the rows.** The hero pip (with its sleepy late-night pose) and the reader Mobi are retired from the result. He asked for the sleeping Mobi to go, and a figure with no action at the top of a result is exactly what confused him (L35 says "at a real moment"; a result arriving is not Mobi's moment, it is the student's).
- **The one moment:** when a repair's "Check it held" comes back right, Mobi appears once inside that row, cheering, beside "Check it held: right" (`assets/art/mobi-cheer.webp` on the app; the `MobiReact` `cheer` act on the web). Only after the server marks the answer (never before acknowledgement), once per check, never in NTA mode, a still image under reduced motion. While a repair is being written, the existing Repair Mobi thinks in that panel (`RepairMobi.jsx`, `repairMood`); that is the same single Mobi on the screen, not a second one.
- **Where the other acts go (moved, not deleted):** the app's finish moment after "Finish for now" keeps its waving Mobi (`ResultClosing`, unchanged); the mock recap cards keep their Mobi (`recap/recap_mobi.dart`, unchanged); the sleepy act stays in the Mobi rig for Today and the night study reminder, just not on a result. The late-night line is kept as plain text in the next-move panel (4.6).

---

## 4. The exact spec

### 4.1 Layout

**Web, phone (390):** single column, 16 px gutters (the page's own `main` padding), 120 px bottom padding for the dock.

```
receipt line                                  13 px, ink-2
128 / 250 marks                               72 px display + 22 px ink-3
[==== scored ====|== wrong ==|// blank //]    10 px bar, 3 px gaps
■ 28 right  ■ 12 wrong  ▨ 10 blank             14 px, legend squares
Share Capital cost 29 of the 122 marks         18 px semibold, ink
you missed.  4 wrong and 1 left blank…         14 px, ink-3
(notice line if a key is under re-check)
┌ Do this next ─────────────────────────────┐ raised panel, 18 px radius
│ [ volt: Repair Q42 ]                      │ 54 px tall, full width
│ Share Capital. You picked D. 18 of 22…    │
│ ───────────────────────────────────────── │
│ A repair gives you why D looked right…    │ the value line
│ 1 AI credit. You have 68. No charge if…   │
│ Practise 10 on Share Capital instead      │ underlined text action
└───────────────────────────────────────────┘
Your 12 mistakes                       −72 marks
In repair order: …
(42) Share Capital                        −6
     Shares issued at a premium of ₹2…
     (D) yours (B) answer  18 of 22 got it right
     [Repair first]
… 4 rows, then "Show all 12", then "10 left blank, 50 marks not earned"
More from this paper
  Where the marks went / teaser            ⌄
  Your time and changed answers / teaser   ⌄
  After this mock: strengths, gaps and plan⌄  (full and NTA mocks only)
  How others answered / teaser             ⌄  (when the cohort read exists)
  Your rule and proof it stuck / teaser    ⌄
  Every answer, all 50 / 50-dot map        ⌄
Take another fresh paper (USP line, price, outline key)
links
```

The first viewport at 390 holds layers 1 and 2 completely, with the volt key above the fold (capture `web-390-avg-night.png`).

**Web, desktop (1440, sidebar 232):** content 1,040 px max, centred, 40/48 px padding. Row one is a two-column grid (1.25fr / 1fr, 56 px gap): what happened on the left (score at 112 px), the next-move panel on the right, top-aligned. So the two questions he asked, "what is going on" and "what do they have to do", sit side by side at one glance. Below, the mistakes run full width as a five-column row (badge, chapter and stem, your pick / answer / others, cost, status). The folds sit in two columns of rows. An opened mistake splits into options (left) and the repair (right).

**App (412 dp):** the same order. The volt key stays pinned in the foot (the app's thumb-reach pattern, `result_foot.dart`), with the cost line under it and "Finish for now" below. The in-content panel above the mistakes is titled with the reason ("Why Q42 first" / "Why this chapter first") and holds the why line, the value line and the alternative; it holds no button, so there is one volt on screen. Score in the app's own voice: BricolageCondensed, "128 of 250 marks". Back key and "Replay recap" (mocks) in the top bar. The list uses bounce scrolling where the app owns the scroll (F3, `BouncingScrollPhysics`).

### 4.2 Layer 1: what happened

- **Receipt (the only one):** "{Subject} {paper kind}. Recorded {12-hour time}, {duration}." Examples: "Accountancy full mock. Recorded 9:41 PM, 46m 36s." / "Business Studies practice. Recorded 12:22 AM, 2m 36s." The words "Session complete", "Saved." and "Practice finished" leave the screen. Option tags change from "Key at submission" to "Correct answer", and "Your pick, key at submission" to "Your pick, correct". The key-at-the-time wording stays only where a key was later corrected ("Corrected answer", existing `AnswerCorrectionNotice`). The Replay's "Submitted at 51:46" stays inside its fold (it is a clock event, not a receipt).
- **Score:** marks with the denominator, on every paper: "128 / 250 marks" (web), "128 of 250 marks" (app). A 5-question practice reads "14 / 25 marks". Reason: the costliest line and every row speak in marks, so the headline must too. The right-count stays in the counts line. Negative scores show the minus (existing).
- **Marks bar:** three segments in proportion to 250 (scored, lost to wrong answers = 6 x wrong, left on blanks = 5 x blank), legend squares in the counts line, so colour is never the only signal (S016). A negative score draws scored as 0.
- **The costliest thing (rule):**
  1. The chapter with the most marks lost, counted as 6 per wrong and 5 per blank, leaving out questions whose key is held or corrected. Ties: more wrong answers first, then the earlier chapter in the paper.
  2. Copy: "{Chapter} cost {m} of the {gap} marks you missed." Detail line: "{w} wrong and {b} left blank, of {n} questions." (or "1 right of 10: 6 wrong and 3 left blank." when right answers are under 20 percent of the chapter's questions).
  3. No chapter data (older record): the existing `verdictLine` ("15 wrong answers cost 90 of the 105 marks you missed.").
  4. Nothing missed: "Every question right." with no detail line.
  5. Why a chapter and not the Lab's behaviour headline ("3 wrong answers took under 20 seconds"): the chapter is what the next move acts on, so layer 1 and layer 2 read as one thought. The Lab's headline is not lost: it is the teaser of "Where the marks went", visible without opening it.
- **Key under re-check:** one line with a warning glyph, under the costliest line: "Q14's answer key is being re-checked. It is left out of repairs until the check ends. See Q14". The full list stays in "Where the marks went" (KeyReviewLog). Corrections ("We corrected an answer key…") show here as the same line, linking to the correction.

### 4.3 Layer 2: the next move (rules)

Computed by one pure function on each platform, tested against the same fixtures (packet S1).

| Order | When | Volt key | Why line | Under it |
|---|---|---|---|---|
| 1 | Nothing missed | "Set up a harder full mock" (practice set: "Practise 10 harder in {Subject}") | "Every question right. A harder paper finds what is left." | Price line from `paperCopy.mjs`; alt: "Take another fresh paper" |
| 2 | Under 40 percent of answered questions right, or nothing answered | "Practise 10 on {costliest chapter}" (nothing answered and no chapter: "Practise 10 in {Subject}") | "{Chapter}: most answers in this chapter were wrong, so a chapter set comes before repairing single mistakes." | "Uses 10 practice credits. You have N." (from `creditCopy.mjs`); alt: "Or repair Q{n} first, 1 AI credit" when a repair is possible; tertiary: the chapter lesson (`MistakeLessonLink`) when one exists |
| 3 | A wrong answer can be repaired (not held, not repaired yet) and AI credits are 1 or more, or unknown | "Repair Q{n}": the first in the server's repair order (`lab.repairOrder`) inside the costliest chapter; none there, the first overall | "{Chapter}. You picked {X}. {k} of {m} other students got it right." (the cohort part only when the server sends it) | The value line (4.4), the cost line, alt: "Practise 10 on {chapter} instead", or with 5 or fewer mistakes left "All {N} repairs take about {M} minutes" (`repairMinutes`) |
| 4 | Every wrong answer is repaired and one or more checks are not taken | "Check Q{n} held" (free, comes with the repair) | "You repaired {k} of {N}. One new question each shows whether the fix held." | "No extra credit." |
| 5 | Known 0 AI credits, all wrong answers held, or only blanks | "Practise 10 on {costliest chapter}" | as row 2, or "Repairs use AI credits. You have 0." | alt: "See your AI credits" |

Return visits recompute the move (a student who repaired Q42 sees "Repair Q12" next with "1 of 12 repaired" in the mistakes head). NTA results use the same rules.

### 4.4 Repair's value, in one line, before the student pays

- Web panel and app panel: **"A repair gives you why {X} looked right, the trap, one rule to keep, and a new question to check it held."**
- Cost line, right under the key: "1 AI credit. You have 68. No charge if the repair cannot be written." (existing `usesLine` plus the existing no-charge promise from `MistakeRepair.jsx`).
- When the server says no fresh check question is available for that chapter, the line drops its last clause ("…and one rule to keep.") so it never promises what will not come. This needs one boolean from the server per repair candidate (packet S1, `lab.repairOrder[i].checkReady`); until then the line names the check only when the Lab is `ready`.
- Inside each mistake row, the idle repair entry keeps its current sentence ("Why option D looked right, why the key is right and one rule to keep", `MistakeRepair.jsx` line 323) and gains "then a new question to check it held".
- The free part stays free and visible: the row shows your pick and the correct answer before any spend (L13 "can't ask them to pay extra to just see the right answer").

### 4.5 Layer 3: the mistakes

- **Heading:** "Your {N} mistakes" (h2) with "−{6N} marks" at the right; sub-line "In repair order: the ones most other students got right come first. Repaired ones say whether the fix held." Practice sets with no cohort: "In paper order." Once any are repaired the right side reads "{k} of {N} repaired".
- **Row (a button, 44 px minimum target):** red-ringed question number; chapter (15.5 px semibold); the stem, one line, ellipsis; facts: your pick and the answer as small lettered rings with the words "yours" and "answer" (colour is never alone); "{k} of {m} got it right" when the cohort read exists; cost "−6"; status chip.
- **Status chip states** (each from a real server state, never optimistic):

| State | Chip | Source |
|---|---|---|
| Not repaired, the volt's target | "Repair first" (volt-tinted outline, not a fill) | next-move rule |
| Not repaired | "Repair" | `repairOutcomes[qid]` empty |
| Writing | "Writing" with a small ring | `MistakeRepair` loading |
| Repaired, check not taken | "Check it held" (accent outline; opens the check in the row) | `explained` / `stored` plus `check` |
| Check right | "Held on a new question" with a tick (good colour) | `RepairCheck` result |
| Check wrong | "Slipped on a new question" (warn colour); the row says when it comes back in Revise | `RepairCheck` result plus `lab.prove.later` |
| Key under re-check | "Key being re-checked" (dashed) | `answerReviews` |
| No repair possible | "No repair, no charge" | `not_explained` |
| Key corrected | "Key corrected" | `answerReviews.state === 'corrected'` |

- **Opened row:** everything the opened answer row holds today, in this order: options (your pick, correct answer), trap tag under your pick, How others answered bars, Your time and picks, the repair (MistakeRepair, unchanged inside: the reason, where it breaks, why the key is right, the other options, Keep this, Explain it another way), then **Check it held** inline (RepairCheck, unchanged), then Ask Mobi about Q{n}, From your record, Do this next, Next mistake, Report a problem. The book explanation stays behind its disclosure.
- **Length:** the first 4 rows show; "Show all {N}" opens the rest in place. Blanks are one folded row: "{b} left blank, {5b} marks not earned", opening the blank rows (with "Try it again" where the app has it).
- Correct answers are not in this list. They live in "Every answer".

### 4.6 Layer 4: folded sections

One fold row each: title (16 px semibold), a teaser line that states the finding (13.5 px ink-3), a chevron. Folds whose content does not exist for this paper are not drawn (no empty folds).

| Fold | Teaser (real, from the server) | Holds |
|---|---|---|
| Where the marks went | the Lab headline (`lab.headline.text`), else the largest ledger group's line | MarksLedger (groups, re-mark, cohort block, How we counted), the older-paper line, KeyReviewLog list |
| Your time and changed answers | "Median {x} a question; the paper gives {y}. {n} answers changed, net {±m} marks." | Replay, Time and decisions, Where your time went, Every answer you changed, Your traps across mocks, the First timed mock prompt |
| After this mock: strengths, gaps and plan (full and NTA mocks) | first Threat or Opportunity line of the SWOT | SwotPanel: Do these next (keys become outline, not volt), SWOT |
| How others answered (when 10 or more other students) | "{n} questions you lost were ones most other students got right." | the cohort block from the ledger, a list of those questions linking to their rows |
| Your rule and proof it stuck | "Your rule: {rule}. Kept: {fact}." or "No rule chosen for this mock." | Prove: RuleCheck, Same mistakes later, Try 5 fresh questions; "Your rules (7)" link; Across your mocks |
| Every answer, all {N} | the 50-dot answer map (right, wrong, blank) | the answer strip (bubbles), filters (All, Wrong, Blank, Right), every row as today, with Report a problem |

Fold state is remembered per viewer (localStorage, wrapped in try/catch) so a student who keeps "Your time" open finds it open on the next result. A link into a fold (a Show me, a Q chip, "See it in the replay") opens that fold and scrolls to the target, as `jumpTo` does today.

**After the folds:** "Take another fresh paper" (kept, the USP line from `paperCopy.mjs`: built new from the live bank, no cap, price line, outline key) and the four links. If `wt-webux2` lands first, its removal of this block is reverted in packet W1. The Mob paper row (`MobResultRow`) sits directly under the mistakes, as a quiet row, when the attempt is a Mob paper.

**Late night (11 PM to 5 AM):** no figure. The next-move panel's cost line gains "It is late. One repair is enough for tonight." (a fact-free nudge, never a count-down).

### 4.7 States

| State | Web | App |
|---|---|---|
| Loading | Skeleton shaped like the layout: receipt line, a 72 px score block, the bar, two lines, the panel outline with a key-shaped block. Screen reader: "Loading your result". No Mobi, no spinner. | `ResultReading` keeps the finish moment's height; the reading Mobi is replaced by the same skeleton (no Mobi before the result exists). |
| Error | Existing: "This session did not load. Your recorded result is safe. Try again to see it." with Try again. | Existing `ResultLoadFailed`, said first, where the page opens. |
| Offline (app) | n/a | Cached result shows; the foot key reads "Repairs need a connection" (disabled) and the alt "Practise 10 on {chapter}" works when its questions are cached; otherwise says so plainly. |
| Lab not ready (checks pending, `lab` null) | Layers 1 to 3 from the client analysis; "Where the marks went" teaser: "Being counted. It is ready when the answer checks finish."; repairs work as today. | Same. |
| Empty (nothing answered) | "0 / 250 marks", "0 right, 0 wrong, 50 blank", "All 50 were left blank: 250 marks not earned." Next move row 2 (subject). Mistakes section reads "No answers to repair." | Same. |
| Sparse (5-question practice) | "14 / 25 marks"; the costliest chapter line; folds: Where the marks went (observations), Your time, Every answer. No SWOT, no others. | Same; the observations panel ("What this set shows") becomes the first fold. |
| Success (all right) | "Every question right." Next move row 1. Mistakes section: one line "No mistakes to repair." | Same. |
| Return (opened later) | No entrance motion; next move recomputed; rows show statuses; "{k} of {N} repaired". | Same; never replays the finish moment (existing rule). |
| NTA | No Mobi anywhere (existing rule); same hierarchy. | Same. |
| Key under re-check | Notice line in layer 1; row chip "Key being re-checked"; no charge. | Same. |

### 4.8 Motion

All curves `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out) unless named; only transform and opacity animate (grid-row expansion uses `grid-template-rows` on the web, `AnimatedSize` on the app).

| Moment | What moves | Duration and timing |
|---|---|---|
| Arrival, first open only | receipt and score fade in | 160 ms at 0 ms |
| | score counts up from 0 (existing `CountUp`, shortened from 750) | 600 ms from 0 ms |
| | bar segments grow from the left, scored then wrong then blank | 520 ms each, from 120 ms, 60 ms apart |
| | counts and costliest line rise 8 px and fade in | 240 ms at 420 ms |
| | next-move panel rises 12 px and fades in | 280 ms at 520 ms |
| | mistakes: the first row leads, the rest arrive as one group (the AP-1 stagger rule) | 220 ms at 640 ms and 700 ms |
| Reopen, or content arriving after the page is up | nothing moves | 0 |
| Volt press | scale 0.97 | 120 ms down, 200 ms back |
| Volt "Repair Q42" | scrolls to row Q42 (existing `jumpTo`), the row opens, the repair starts (`autoStart`) | native smooth scroll; row open as below |
| Row or fold opens | height 0fr to 1fr; content fades in 60 ms later; chevron turns 180 degrees | 260 ms; 180 ms; 200 ms |
| Row or fold closes | faster than it opened | 200 ms |
| Status chip changes (server acknowledged) | crossfade with a 2 px blur bridge | 200 ms |
| "Held on a new question" | the tick draws (stroke offset), then Mobi's cheer act plays once in that row | 320 ms, then about 600 ms |
| Dock Start steps back while the volt shows | colour and fill | 160 ms (existing) |
| App list overscroll | bounce (F3), where the app owns the scroll | platform physics |

**Reduced motion** (site setting `data-motion="reduced"`, OS setting, or app "Remove animations"): no count-up (final number at once), no rise or scale, no Mobi act (a still image), no tick draw; rows and folds open at once; opacity fades of 120 ms at most are kept so changes are still noticed.

### 4.9 Copy (final strings)

- Receipt: "Accountancy full mock. Recorded 9:41 PM, 46m 36s."
- Costliest: "Share Capital cost 29 of the 122 marks you missed." / "4 wrong and 1 left blank, of 6 questions."
- Panel label (web): "Do this next". App panel label: "Why Q42 first" / "Why this chapter first".
- Repair why: "Share Capital. You picked D. 18 of 22 other students got it right."
- Value: "A repair gives you why D looked right, the trap, one rule to keep, and a new question to check it held."
- Cost: "1 AI credit. You have 68. No charge if the repair cannot be written."
- Practise why: "Share Capital: most answers in this chapter were wrong, so a chapter set comes before repairing single mistakes."
- Mistakes: "Your 12 mistakes", "In repair order: the ones most other students got right come first. Repaired ones say whether the fix held.", "Show all 12", "10 left blank, 50 marks not earned".
- Section: "More from this paper".
- Check: "Check it held: right" / "A new Share Capital question you had not seen, answered right on the first try. Q42 comes back in Revise in 3 days." (the Revise day from `lab.prove.later`).
- No exclamation marks, no arrows on keys, no ALL-CAPS, sentence case, 12-hour time.

---

## 5. Mocks (static, real tokens) and captures

Files: `tmp/design-1017/result/web.html` (tokens from `wt-batch4b/src/app/(app)/arena.css`, Bricolage Grotesque and Hanken Grotesk as `layout.js` loads them) and `tmp/design-1017/result/app.html` (the app's own font cuts from `flutter_app/assets/fonts` and colours from `lib/core/theme/mm_colors.dart`). Query: `?s=weak|avg|strong&theme=dark|light`, `&open=1` for the repaired row.

The three papers (Accountancy full mock, 50 questions, +5 / −1; every number adds up: score = 5 x right − wrong; missed = 6 x wrong + 5 x blank):

| State | Right / wrong / blank | Score | Missed | Costliest | Next move (rule) |
|---|---|---|---|---|---|
| Weak | 8 / 22 / 20 | 18 / 250 | 232 | Share Capital, 51 | Practise 10 on Share Capital (27 percent of answered right, rule 2) |
| Average | 28 / 12 / 10 | 128 / 250 | 122 | Share Capital, 29 | Repair Q42 (rule 3) |
| Strong | 44 / 4 / 2 | 216 / 250 | 34 | Accounting Ratios, 12 | Repair Q31 (rule 3; alt "All 4 repairs take about 15 minutes") |

Chapter names, cohort lines (18 of 22, 21 of 26, 16 of 21), credits (40 practice, 68 AI) and the Lab and SWOT lines follow the website's own preview fixture (`data/tests/fixtures/mistake_lab/full_mock_*.json`, `previewMock.js`); the question stems are written for the mock.

Captures (all in `tmp/design-1017/result/captures/`, headless Chrome, opened and checked):

- Web 390x844, first viewport and full page: `web-390-{weak,avg,strong}-{night,day}.png`, `web-390-{weak,avg,strong}-{night,day}-full.png`
- Web 1440x900, first viewport and full page: `web-1440-{weak,avg,strong}-{night,day}.png`, `web-1440-{weak,avg,strong}-{night,day}-full.png`
- App 412x915: `app-412-{weak,avg,strong}-{night,day}.png`, scrolled to the list and folds: `app-412-avg-{night,day}-scrolled.png`
- Return state, the repaired row with Check it held and Mobi's one moment: `web-390-avg-{night,day}-repaired-row.png`, `web-1440-avg-{night,day}-repaired-row.png`
- Live state for comparison: `tmp/design-1017/result/live/*.png`

Full page heights at 390: live 13,528 px; new 2,690 px (average paper, everything folded; weak 2,536, strong 2,572). Nothing was removed to get there: the difference of about 10,800 px is behind six named folds and "Show all".

---

## 6. What moves where (nothing is deleted)

| Today | Goes to |
|---|---|
| Hero Mobi pip (all acts, sleepy at night) | Off the result. Acts stay in the rig for the recap cards, the finish moment and Today; the late-night line becomes plain text in the next-move panel |
| "Session complete…" eyebrow, "Saved." line, app "Practice finished. Recorded at…", the mock's second submitted line | One receipt line in layer 1 |
| Score, verdict line | Layer 1 (score with denominator; costliest line replaces the verdict, which stays as fallback) |
| Four stat tiles (Right, Wrong, Blank, Accuracy) | The counts line and the bar in layer 1; accuracy of answered moves to the "Where the marks went" teaser area and its first line |
| 50-bubble answer strip | "Every answer" fold (as the map at its head; a mini dot map is its teaser) |
| Hero "Repair Q42 first" and cohort line | The next-move volt and its why line (layer 2) |
| Mistake Lab head and marks ledger | Fold "Where the marks went" (its headline becomes the teaser; the `wt-webux2` Lab numeral moves in with it) |
| Find: Replay, Time and decisions, Every answer you changed, Your traps across mocks | Fold "Your time and changed answers" |
| Repair step: what a repair is, progress, queue, second volt key, credit total | Layer 2's value line and cost line; layer 3 (the queue becomes the mistakes list; progress becomes "{k} of {N} repaired"); the credit total line under "Show all" |
| Lesson link (`MistakeLessonLink`) | Next-move panel tertiary link in rule 2; else in the opened row's "Do this next" |
| "Your rules (7)" link | Fold "Your rule and proof it stuck" |
| Prove: rule check, Same mistakes later, Try 5 fresh | Fold "Your rule and proof it stuck" |
| Across your mocks | Fold "Your rule and proof it stuck" (last) |
| After this mock: Do these next and SWOT | Fold "After this mock: strengths, gaps and plan" (keys outline, not volt) |
| Answer keys we are re-checking, corrections | Notice line in layer 1, full list in "Where the marks went" |
| Answer by answer (wrong rows) | Layer 3 mistake rows (with everything their opened body held) |
| Answer by answer (all rows, filters) | Fold "Every answer" |
| Reader Mobi on opened rows | Off the result (one Mobi rule); the Repair Mobi inside an opened repair stays |
| First timed mock prompt (batch4b) | Fold "Your time and changed answers" |
| Take another fresh paper (batch4b; removed in webux2) | Kept after the folds |
| Mob paper row (webux2) | Under the mistakes, as a quiet row |
| Links row | Kept at the end |
| App: FinishStage Mobi and speech bubble | Off the result; the bubble's sentence becomes the costliest line; the waving Mobi stays in `ResultClosing` after "Finish for now" |
| App: Wrong answers / Not attempted / Correct groups | Mistakes list / blank fold row / "Every answer" fold |
| App: What this set shows, Prove card | Folds "Where the marks went" and "Your rule and proof it stuck" |
| App: foot "Repair 1 mistake" and chapter caption | Foot volt from the next-move rule; caption becomes the cost line |
| App full result: SummarySection Mobi, lab, SWOT, replay, time, first fix, prove, later, across, answers | Same mapping as the web rows above |

---

## 7. Build packets

Each packet is self-contained. Builders pull the newest branch state first and keep other agents' edits (`wt-appux2` has uncommitted result files).

**S1, shared rules and fixtures (both platforms, do first)**
- New `data/result_next_move.mjs`: `costliest(analysis)` and `nextMove({ analysis, lab, wallet, repairOutcomes, checks, mode })` returning `{ kind, label, why, value, cost, alt, target }`, exactly the tables in 4.2 and 4.3.
- New fixtures `data/tests/fixtures/result_next_move/{weak,avg,strong,perfect,blank,held,zero_credits,all_repaired,practice5}.json` with expected outputs; `data/tests/result_next_move.test.mjs` (node --test, add to `npm run test:recovery`).
- Server, optional but wanted: `lab.repairOrder[i].checkReady` (boolean) in `data/mistake_lab.js` so the value line never promises a check that will not come (4.4).

**W1, website result (owner-visible: build with Opus)**
- `src/app/(app)/result/[id]/ResultPageClient.jsx`: new order (layers 1 to 4); drop the hero `MobiReact` and `ReaderMobi`; one receipt; option tag copy; `data-page-primary` on the volt.
- New `src/components/result/ResultHead.jsx`, `NextMove.jsx`, `MistakeList.jsx` (rows, chips, Show all, blanks row), `Fold.jsx` (named fold with teaser, remembered state, deep-link open), `result-1017.css`.
- `src/components/ScoreRecoveryLab.jsx`: split into fold bodies (ledger body, time body, proof body); the Repair step's queue and second key are replaced by `MistakeList`; keep every child component unchanged.
- `src/components/result/SwotPanel.jsx`: render inside its fold; "Set up" keys outline.
- `src/components/recovery/MistakeRepair.jsx`: idle sentence gains "then a new question to check it held"; report the chip state up.
- `src/components/recovery/RepairCheck.jsx`: on a right answer acknowledged by the server, emit `held` so the row chip and Mobi's one cheer play.
- `src/app/(app)/result/[id]/reaction.js`: `mobiReaction` no longer used on the result (keep the export for any other caller); add the late-night line helper.
- `src/components/recovery/result.css`: retire `.rp-hero` pip, stat tiles and strip styles from the hero (strip styles move with the strip).
- Keep `rp-next` (revert the `wt-webux2` removal when merging) and place `MobResultRow`.
- Preview: `src/app/preview/arena/previewMock.js` gains `?paper=weak|avg|strong` fixtures matching section 5, so the visual gate can be rerun.

**A1, app result (owner-visible: build with Opus)**
- New `lib/features/result/model/next_move.dart` (port of S1, tested against the same JSON fixtures copied to `test/fixtures/result_next_move/`).
- New `lib/features/result/widgets/result_head.dart`, `next_move_panel.dart`, `mistake_row.dart`, `fold_section.dart`.
- `lib/features/practice/practice_result_screen.dart`, `widgets/finish_stage.dart` (no Mobi, no speech bubble; keep the count-up and bubble ink as the arrival), `widgets/result_list.dart`, `widgets/result_foot.dart` (key from the rule, cost caption), `copy.dart`.
- `lib/features/result/full/full_result_screen.dart`, `summary_section.dart` (no Mobi, no sleepy pose), `lab_ledger_section.dart`, `swot_section.dart`, `replay_section.dart`, `time_section.dart`, `answer_row.dart` into the fold structure; `lib/features/result/copy.dart`.
- `lib/features/review/widgets/repair_check_section.dart`: on a right check, the row chip and the one cheer (`mobi-cheer.webp`).
- `lib/features/result/model/recap_variant.dart`: the sleepy act stays for recap cards only; the full result no longer reads it.
- Scroll physics: bounce on the result list (F3).
- Goldens: Night and Day at 412x915 for weak, average, strong, return, and reduced motion; update `test/unit/practice/result_screen_test.dart` and `test/unit/result/phase2_robustness_test.dart`.

**G1, gate (after W1 and A1)**
- Web visual gate at 390x844 and 1440x900, Night and Day, three papers plus return and NTA, from the preview fixture; real-pointer clicks on the volt, a row, a fold, Show all; hit-test that nothing covers the page.
- Emulator walk on the app (device-truth rule): one practice set and one full mock on a real account, screenshots against F11 and this document.

---

## 8. Acceptance checks (a tester can run these)

1. **One glance.** Open a full mock result at 390x844 (web) and 412x915 (app). Without scrolling you can read: the receipt, the score with "/ 250 marks" (web) or "of 250 marks" (app), the bar, the counts, the costliest chapter line, and the volt key with its why line. Pass if all are in the first viewport.
2. **One volt.** At any scroll position on the web, count fully volt-filled controls in the viewport: exactly one (the next-move key while visible; otherwise the dock or sidebar Start). The SWOT's keys are outline. On the app, the only volt is the foot key.
3. **No sleeping Mobi.** Set the device clock to 12:30 AM and open a result: no Mobi anywhere in the first viewport or on any row; the panel shows "It is late. One repair is enough for tonight." Repeat at 3 PM: no Mobi in the first viewport.
4. **One receipt.** Search the result page text (first viewport and layers 1 to 3) for "submitted", "submission", "saved", "session complete", "practice finished": the only match is the receipt line "Recorded {time}". Options say "Correct answer", never "Key at submission".
5. **Repair's value before paying.** Before pressing the repair key, the screen states the four parts (why the pick looked right, the trap, one rule, a new question to check it held), the cost and the balance. Press it: the wallet drops by exactly 1 only after the explanation arrives; a repair that cannot be written charges nothing (existing promise).
6. **Next-move rules.** With the preview papers (S1 fixtures): weak shows "Practise 10 on Share Capital"; average "Repair Q42"; strong "Repair Q31"; perfect "Set up a harder full mock"; zero AI credits "Practise 10 on {chapter}" with "Repairs use AI credits. You have 0."; all repaired with checks pending "Check Q42 held". Unit tests pass on both platforms against the same fixtures.
7. **Check it held inline.** Repair Q42, answer its check right: the row chip becomes "Held on a new question" only after the server marks it; Mobi cheers once in that row; reopen the result: the chip is still there, Mobi does not play again. Answer wrong on another: "Slipped on a new question" with the Revise day.
8. **Nothing lost.** Open every fold and "Show all": the marks ledger groups, the Replay, Time and decisions, every changed answer, the traps, the SWOT with Do these next, the cohort block, the rule check, Same mistakes later, Try 5 fresh questions, Across your mocks, every answer with filters, Report a problem, Take another fresh paper and the four links are all present and work as before.
9. **Deep links.** Press a Q chip in "Where the marks went" and "See it in the replay": the right fold opens and the target scrolls into view with its focus ring.
10. **States.** Airplane mode (app): cached result shows and the key says repairs need a connection. Answer checks pending: the hero and mistakes work, the first fold says it is being counted. A 5-question practice: no SWOT fold, "14 / 25 marks". An all-blank paper: "0 / 250 marks" and a practise move. NTA: no Mobi at all.
11. **Motion.** First open from the runner: the arrival sequence finishes in under 1 second; reopen: nothing animates. With reduced motion on: the score shows final at once and nothing moves.
12. **Parity.** Night and Day at 390, 1440 and the app: same order, same copy, same rules; contrast AA for every text token (the tokens are the existing ones).

---

## 9. Review against the owner's research brain

### 12-part anti-slop acceptance test (`papers/ai-slop-independent.md`)

| # | Part | Verdict on this design |
|---|---|---|
| 1 | Product identity | Pass: CUET marking (+5 / −1, 6 marks per wrong answer), the repair-and-check loop, the volt on Night Arena, Bricolage numerals. Readable with the logo hidden. |
| 2 | One primary action | Pass: one volt per viewport, chosen by stated rules (4.3). |
| 3 | True content | Pass in the mocks (every number adds up); in the build every number comes from the attempt, the Lab, the wallet or the bank count. |
| 4 | Hierarchy | Pass as designed (score, costliest line, key); to be confirmed with real students, not asserted. |
| 5 | Composition | Pass: 16 px gutters, 1,040 px desktop measure, two-column hero only where comparison helps. |
| 6 | Meaningful typography | Pass: display numerals, semibold body for the finding, ink-3 for support; tabular numbers. |
| 7 | Statefulness | Pass on paper (4.7); the build must prove each. |
| 8 | Accessible interaction | Designed: 44 px rows and keys, legend words beside colours, reduced motion; to verify in G1. |
| 9 | No pseudo-evidence | Pass: no invented counts; cohort lines only when the server sends them (10 or more students). |
| 10 | Motion rationale | Pass: arrival orders the reading, row and fold motion shows what opened, the tick and Mobi mark a real outcome. |
| 11 | Measured usability | Leading metric: share of results where the student presses the next-move key within 60 seconds. Guardrail: "Check it held" right rate and repair refund rate must not fall. |
| 12 | Human critique | Applied: the stat tiles, the hero Mobi, the second repair key, the reader Mobi and the repeated receipts were each asked "what would be better without this?" and moved or merged. |

### 0/1/2 rubric (internal checklist; the owner signs off)

| Dimension | Score | Note |
|---|---|---|
| Task fit | 1 | Designed to the two questions he asked; validated only after G1 and a student test |
| Information architecture | 1 | Four layers, nothing deleted; not yet used by a student |
| Content truth | 2 | Every figure traced to a source in section 4 |
| Readable hierarchy | 1 | Captures show it; real use pending |
| Visual specificity | 1 | Existing brand world; no new decoration |
| Accessibility | 1 | Specified; verify in G1 |
| Functional states | 1 | All specified; to build |
| Trust | 2 | Cost and value before spend; no charge promise; no urgency |
| Intentional motion | 1 | Specified with values; judged in use |
| Performance | 1 | Lighter first paint (folds render lazily); measure in G1 |
| Responsive integrity | 1 | 390, 1440 and 412 mocked; build pending |
| Instrumentation | 0 | Metric and guardrail named; events not built (add with W1 and A1) |

---

## 10. Open questions for the owner

1. **Headline unit.** Marks with the denominator ("128 / 250 marks") on every paper, with the right-count in the line under it. The app's practice result today leads with "3 of 5". Keep marks everywhere?
2. **"Submission is there, and the add submission is there."** Read as the submitted or saved state being said in two or more places (eyebrow, Mobi line, "Key at submission" on options, the app's "Recorded at"). If he meant something else (for example the submit sheet before the result), that needs a separate fix.
3. **Weak-paper rule.** Under 40 percent of answered questions right, the volt is chapter practice, not a repair. Is 40 percent the right line?
4. **Late night.** A plain line ("It is late. One repair is enough for tonight.") in place of the sleeping figure, or nothing at all?
5. **Correct answers.** They move into the "Every answer" fold; a student who wants to read the explanations of questions they got right opens it there. Acceptable?
