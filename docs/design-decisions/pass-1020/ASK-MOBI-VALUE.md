# Ask Mobi: why a student would pick Mobi over free ChatGPT (20 Oct 2026)

**Answers:** J4, his words at about 1:49 am on 20 Oct: "The value that we are providing for 1 AI credit and what Mobie is providing, that's just not good enough. Why would someone use Mobie over ChatGPT or any AI chatbot which they can use for free? ... I had said this a week ago. Still, even in the latest version of Ask Mobie, it's not so useful."
**Status:** a proposal for him to decide. No code changed, nothing committed, no model called.
**Read for this:** the app's Ask Mobi code (`wt-v15-3/flutter_app/lib/features/insights`, v1.0.16+12 at 2485e83e), the website's `/mentor` and every `/api/ai/*` and `/api/recovery/*` route (`wt-1019pm-playsubs/src`), `data/compass_projection.js`, the trap atlas, ASK-MOBI-1019 (D110, D114), AI-COST-PER-USER-2026-10-17 and his feedback files from 17 to 20 Oct.

---

## 0. The answer in one minute

**Today Mobi sells the one thing ChatGPT does better, and ChatGPT gives it away free.** The paid door, "Ask now", is an empty box that explains a typed doubt. It runs on our smallest model and costs 1 credit a message. Its starters are textbook doubts ("Explain the sacrificing ratio in simple words") that any free chatbot answers as well or better. The free door, "Ask your record", gives correct answers, but it repeats in sentences what Review and the Weak chapters page already show. Then it stops. Neither door *does* anything after it talks.

**What ChatGPT can never have is our data, and the ability to act inside the app.** We know every answer the student gave, how long they took, and which answers they changed. We hold the exact question with its verified key, and the trap that the wrong option set. We know which option most students fell for, what the paper is worth under CUET marking, and the cut-offs of the student's own colleges. We know which mistakes they fixed, whether each fix held, and how their Mob did on the same paper. And we can hand them the next verified question. A chatbot sees only what a 17-year-old types into it, and they will never paste 50 questions with their timings.

**The fix: Mobi stops being a chat window and becomes the coach that works on your record and acts.** Mobi never charges for talking. It charges for a finished job, such as a mistake fixed and checked to hold, or a doubt settled and tested. Everything it can work out from your record is free and comes to you without being asked: after every paper, the night before a mock, and when a fix is due for its check.

**Build next:** (1) a 2-minute Mobi debrief after every paper, free; (2) "Fix it for good", where 1 credit buys a finished repair (why *your* option looked right, the check questions and the held checks), so Repair becomes Mobi's job; (3) "Where you stand and your week", the score band against your colleges' cut-offs plus a week plan that Today follows.

---

## 1. The honest answer to "why Mobi over free ChatGPT"

### 1.1 What a free chatbot does better (be honest about it)

- **It explains any concept, in any language, with endless follow-ups, at no cost.** It runs on a larger model than ours: every Ask Mobi reply runs on gpt-6-luna, capped at about 950 tokens.
- **It is already on the student's phone,** and they already trust it for homework.
- **So on "explain this topic", we lose.** That is exactly the work our paid door is built around today: `askNowBank` in `ask_doors.dart` is 25 generic textbook doubts, each marked "1 credit".

We should stop competing there. Generic explanation is a feature to include, never a product to sell.

### 1.2 What only MockMob has (the moat)

| What we hold | Where it lives today | What ChatGPT sees |
|---|---|---|
| **Every answer the student gave**: the option, right or wrong, time on the question, and every answer change (helped or hurt) | `attempts.details`, `selectionMeta.recovery` (timeline, `answerChanges`); `Pace` and `ChangesSummary` in the record | Nothing, unless the student retypes it |
| **The exact question with a verified key**, its passage and the bank explanation | `questions` (`correct_index`, `explanation`, `verification_state`, passage) | A student's paraphrase, and it often gets CUET keys wrong |
| **The trap each wrong option sets**, from a fixed list of 10 (partly true, the relation turned around, a missed NOT or EXCEPT, an extreme word...) | `trap_atlas` (question, option, trap type, repairs agreeing); `lab.traps` tags; "Traps you meet" (`GET /api/me/traps`) | Nothing |
| **The crowd**: how many students picked each option of the same question, and how long the right ones took | `question_option_stats` (per option counts, right-answer time, changes, strike-outs) | Nothing; it has never seen the question answered |
| **CUET marking and what a paper is worth**: +5 / −1, 250 a paper, a four-paper total out of 1000, with a Wilson range | `data/prepos_insights.js`, `data/compass_projection.js` (Compass Pro) | Arithmetic only, without the student's numbers |
| **The student's colleges and their cut-offs**: DU CSAS 2026 Round 1 closing marks for their course and category | `my_colleges`, the offerings file, `roundOneCutoff` | A guess from old news articles |
| **Repairs and held fixes**: the rule to keep from each mistake, whether the fresh "Check it held" question was right (held or slipped), and Revise cards that come back at 1, 3, 7 and 21 days | repair receipts in `ai_credit_reservations`, `/api/recovery/check`, `revise_cards`, `recovery_playbook` | Nothing |
| **An unlimited bank of unseen, verified questions** by subject, chapter, concept, PYQ anchor and trap (over 6,000 live, 18 Oct count) | the bank, Quick / Smart / chapter practice | It can only invent questions, unverified and not CUET-shaped |
| **The Mob**: friends on the same weekly paper, the trap that caught most of them, and Fix it together | the Mob v3 tables (`mob_traps`, games, podium) | Nothing |
| **A place in the student's day**: the result screen, Today, the notification shade | the app | It waits to be opened |

**The one-line pitch:** "ChatGPT knows CUET. Mobi knows *you* in CUET, and does something about it."

### 1.3 Where Mobi wastes the moat today (read from the code)

1. **The paid door is the commodity door.** "Ask now" sends a typed doubt to `POST /api/ai/mentor/chat` for 1 credit. The starters are generic. Only the first one uses the record ("Explain <weakest chapter> in simple words"), and even that is a textbook request.
2. **The free door describes and stops.** `answerFromInsights` matches keywords and returns a headline, a detail line and at most one link. These are the same figures as Review and the Weak chapters page (his W-099 said the two repeat each other). Nothing is built, scheduled or checked.
3. **"What should I revise tonight?" costs 1 credit for a paragraph.** Yet the app already holds the Revise cards due, the rules to keep from each repair, the traps that catch this student and their weakest chapter. It could hand over the actual 15-minute set, free.
4. **Mobi's model is blind to the best data.** The mentor context (`getStudentAIContext`) never reads the student's colleges: `targetRows` is hard-coded `[]` with a TODO, and `my_colleges` is not queried. The Compass summary is the first thing the 12 KB size cap drops. Apart from the saved repair rule on a question ask, traps, held fixes, crowd counts and the Mob never reach it.
5. **What the model suggests is thrown away.** The reply schema has `cards` and `actions`. The panel never renders cards, and model actions carry no route, so they are filtered out. A router for them exists (`POST /api/ai/actions/execute`), but nothing calls it. In practice, Mobi can only talk.
6. **The one AI feature that uses the moat does not wear Mobi's name.** Mistake Repair v3 reads the student's own wrong option, names the trap, says why it tempted and why the key is right, gives a rule, then serves a fresh unseen check question. That is the best thing we have, and it lives on a different screen called Repair. The student never learns that Mobi is the one who fixes mistakes.
7. **Mobi waits to be asked.** No debrief after a paper, no word the night before a mock, no nudge when a fix is due for its check. A first-time 17-year-old does not know what to ask a chatbot (G23).
8. **The price unit invites the wrong comparison.** One credit buys one practice question, or one chat message. Put side by side, a message that ChatGPT gives free loses to a question.

### 1.4 The rule this document proposes

> **Mobi never charges for talking. It charges for a finished job. Everything Mobi can work out from your record is free, and Mobi brings it to you.**

A "finished job" is something a student can count: a mistake fixed, explained another way, checked with fresh questions and checked again a week later; or a doubt settled and then tested with verified questions. Talk inside a job (the follow-ups) is included.

---

## 2. Eleven things Mobi should do

Each one is a moment in a student's week, not a chat prompt. "Calls" means paid model calls. One gpt-6-luna call costs us about Rs 0.027 on average and Rs 0.042 at the measured worst (production `runtime_ai_requests`, USD 1 = Rs 88). "0 calls" means the work is arithmetic on data we already hold.

### 2.1 The 2-minute debrief, after every paper

- **The moment:** the result screen, the minute after a paper ends, when the student most wants to know "what happened?" (and G22 says this screen is weak on mobile).
- **What Mobi does:** it reads the paper and says, in four short lines:
  1. where the marks went: "You scored 138 of 250. You lost 47: 32 from 8 wrong answers, 15 from 3 blanks";
  2. the one cause that cost most: "4 of your 8 wrong answers fell for the same trap, a missed NOT or EXCEPT";
  3. time: "You spent 11 of your 60 minutes on 6 questions you got wrong";
  4. what changed since the last paper in this subject: "Ratio Analysis went from 2 of 6 to 5 of 6. That fix held".

  Then one key: **"Fix these 5"**, which opens a repair run on the five mistakes worth the most marks. No typing, no chat.
- **Why ChatGPT cannot:** it needs every answer with its time, the trap of each wrong option and the last paper. A student will not paste 50 questions with timings.
- **Cost and price:** **free.** The facts take 0 calls. For a full mock, one optional luna call turns them into Mobi's three sentences (about Rs 0.03); quick sets use the template only. A student who sits a paper a day costs under Rs 1 a month.
- **Build on:** the result recap that already exists (`features/result/recap`). Its card 2 shows where the marks went, card 3 gives one chapter to start with, and Mobi speaks one plain line on each card (`recap_mobi.dart`). Today Mobi's line there is a reaction. It should become the debrief. The data is there: `mockLostLines` and `observedChapterBreakdown` (already passed to `AskMobiContext.mock`), `readout()`, `lab.traps` tags, `Pace` and `ChangesSummary`, and the attempts list for "the last paper in this subject". The server's `autopsy` mode exists for the optional sentences.

### 2.2 "Fix it for good": why *your* option looked right

- **The moment:** in Review, on a wrong answer: "I still don't get why it isn't C."
- **What Mobi does:** a whole repair, as one job:
  1. names the trap your option set, from the fixed list;
  2. says why it tempted and where it breaks, then why the key is right;
  3. gives one line on each other option, and the idea explained another way;
  4. gives a rule to keep, 15 words or fewer;
  5. gives the crowd fact: "41% of students picked C too. It is the most common wrong answer on this question";
  6. hands over 2 fresh, unseen bank questions on the same idea, answered inline (today it is one: "Check it held");
  7. puts the rule into Revise, which brings it back at 1, 3, 7 and 21 days, and says when the fix has held.

  Follow-up questions about this question are included.
- **Why ChatGPT cannot:** it does not have the verified key (it will argue for the wrong option with confidence), the passage, the option this student picked, the crowd count, or a bank to check with. And it will never come back in a week to see whether the fix held.
- **Cost and price:** **1 credit for Free; included in Pro.** One luna call writes it, with a single Claude Haiku 5.5 fallback (1,400 tokens). The atlas and a shared cache per question and option make repeats close to free. Check questions take 0 calls. A key dispute runs a blind check that the student never pays for.
- **Build on:** it is Mistake Repair v3 (`/api/recovery/repair`, `data/mistake_repair.js`), `/api/recovery/check`, Revise, the trap atlas and `question_option_stats`. What is new is the crowd line, a second check question, the follow-ups inside the job, the Revise returns shown as Mobi's, and **the name: this is Mobi fixing your mistake**, reached from "Ask Mobi about Q7".

### 2.3 Trap hunt: a set built from your traps

- **The moment:** "I have 20 minutes", or Today's lead.
- **What Mobi does:** from "Traps you meet" ("A missed NOT or EXCEPT has caught you 4 times in 6 chances"), Mobi builds 10 unseen bank questions that set the same trap, in your subjects. Afterwards it says "You caught 3 of the 4 NOT questions this time. Last week you caught 1."
- **Why ChatGPT cannot:** it needs your trap history and a verified bank tagged by trap. Questions a chatbot makes up are unchecked and not CUET-shaped.
- **Cost and price:** **0 calls; building the set is free.** The questions cost the normal practice price (1 credit each on Free, none on Pro).
- **Build on:** `GET /api/me/traps`, `data/trap_atlas.js`, the format tags (NOT/EXCEPT, assertion-reason and extreme words come from the question format itself), and chapter practice with a new `trap` filter on the practice quote.

### 2.4 Where you stand: score band against your colleges

- **The moment:** Sunday evening, after a full mock, or when the student adds a college.
- **What Mobi does:** it says what each paper would be worth if exam day went like their practice, as a range, totalled the way DU counts (one language plus three domain papers, out of 1000). It sets that against the 2026 Round 1 closing marks of the student's own colleges: "Your practice puts you at 610 to 680. Your first college closed at 712 for UR in 2026 Round 1. Your Accountancy paper has the most marks open: 61, and 38 of them are in Share Capital and Partnership."
- **Why ChatGPT cannot:** it has no record, no CUET paper arithmetic, and no cut-off for the student's course and category.
- **Cost and price:** **0 calls.** The band and the top college are **free** (it is the most motivating line in the app). The per-college gap and the marks open by chapter are **Pro**, which matches Compass Pro on the website today.
- **Honesty:** it is arithmetic on their own practice, never a prediction or an admission chance. It is said as a range, in raw marks before NTA normalisation, and `compass_projection.js` already says so. The no-prediction rules in `RECORD_RULES` stay.
- **Build on:** `data/compass_projection.js` (`projectPaper`, `projectTotal`, `compareToCutoff`, `nextMove`), `my_colleges` and `roundOneCutoff`. The app has the Colleges card and the Today strip; it needs the projection from an API (one new read) or a Dart port.

### 2.5 Your week: a plan to close the gap, that Today follows

- **The moment:** Sunday night or Monday morning; and any day the student missed.
- **What Mobi does:** it plans 7 days of short, concrete sessions from four inputs: the gap in 2.4, the chapters ranked by marks lost, the fixes and Revise cards falling due, and the student's daily minutes. For example: Mon, a 12-minute Share Capital trap hunt; Tue, 2 held checks and 5 Revise cards; Sat, the Accountancy full mock. It puts each day's session on Today's lead card and sets that day's reminder. When a day is missed or a paper goes badly, it re-plans and says what moved.
- **Why ChatGPT cannot:** it can write a generic timetable, but it cannot pick the questions, put the session in the app, see what got done, or re-plan from the results.
- **Cost and price:** 0 calls for the plan (the scheduler is deterministic, as `learningRecord` and `study_scheduler.mjs` already are). One optional luna call writes the "why this week" note. **Pro.** Free keeps today's one move, which Today already gives.
- **Build on:** the plan actions (`resume_session`, `fresh_check`, `repair`, `investigate`, `baseline`, `ordinary_practice`), Today's lead card, the study goal and the on-phone study log, and `reminder_plan` in notifications.

### 2.6 The night before a mock: tonight's last look

- **The moment:** the night before a full mock, a Mob game or the real CUET. Today this is "What should I revise tonight?" at 1 credit, which returns a paragraph.
- **What Mobi does:** a 15-minute pack in that subject:
  - the 5 rules you wrote down from your repairs;
  - the 3 traps that catch you most, with one example each;
  - the Revise cards that are due;
  - the 2 ideas from Learn you missed last time;
  - one timing line from your own pace ("You lose time on assertion-reason. Give each 75 seconds, then move on").

  It ends with "That's enough. Sleep."
- **Why ChatGPT cannot:** these are your own rules, traps and due cards.
- **Cost and price:** **0 calls, free.** This replaces a 1-credit paragraph with a better, free product.
- **Build on:** the repair `rule` field, `GET /api/me/traps`, Revise (`cap=5|10`), the Learn catalogue, and `Pace`.

### 2.7 Daily 5: your formulas and rules, quizzed

- **The moment:** on the bus, or 5 minutes before bed; a quiet daily notification.
- **What Mobi does:** 5 one-tap recall cards. They come from your own repair rules, the Learn ideas and formulas in your weakest chapters, and your calculation slips. They are spaced at 1, 3 and 7 days, and each card leaves the deck once you get it right twice.
- **Why ChatGPT cannot:** it does not know which rules you learned and which you are forgetting, and it cannot schedule or check over days.
- **Cost and price:** **0 calls, free.** This is the "come back every day" habit. It should count toward the Mob chain. Today `chain_daily` counts only papers, Mob game answers and Mob fix checks, so Revise answers would be one more source there.
- **Build on:** Revise (free, writes no attempt), the Learn recall cards, the repair rules, and `workmanager` with local notifications.

### 2.8 Ask now, grounded: a doubt settled, then tested

- **The moment:** "I don't get goodwill by super profit."
- **What Mobi does:** it answers in CUET terms, using our explanation and the student's own record where it has one ("You have missed 3 of 5 goodwill questions, all on the super-profit step"). Every answer ends with **2 verified bank questions on the same idea**, answered right there. Follow-ups inside the thread are included. If the doubt is about a question they sat, it becomes "Fix it for good" (2.2).
- **Why ChatGPT cannot:** ChatGPT can explain the idea, and we say so. It cannot test the student on verified CUET questions, tie the doubt to their misses, or remember it next week.
- **Cost and price:** **1 credit a thread** (the doubt plus up to 5 follow-ups and the 2 check questions) on Free; included in Pro. That is up to 6 luna calls, about Rs 0.16 at the most. Never 1 credit a message.
- **Build on:** the existing chat route, with `sessionId` as the thread, and the record's chapter lines in the context. The check questions come from the picker behind `/api/recovery/check`. Today that picker is tied to a repaired question; a doubt needs it to pick by chapter or concept.

### 2.9 You, your Mob and the crowd

- **The moment:** after a Mob game closes, on Sunday, or on any question in Review.
- **What Mobi does:** it shows, without naming anyone:
  - on a question: "Most students who got this wrong picked C, like you";
  - after a Mob game: "Question 4 caught most of your Mob. You got it." (the Mob v3 rule: no counts in a small Mob);
  - your chapters against your Mob's: "You lead your Mob in Partnership, and trail in Ratio Analysis."

  Each line comes with one key: "Fix it together" or "Hunt this trap".
- **Why ChatGPT cannot:** it has no crowd and no friends' papers.
- **Cost and price:** **0 calls, free.** The Mob is the growth loop, and in Mob v3 marks, the podium and fixes are the same for Free and Pro.
- **Build on:** `question_option_stats` (option picks, median right and wrong time, changes; it needs 10 or more students a question), `mob_sittings` (each member's picks, seconds and changes, shared only with `show_score`), `mob_traps` and the podium. Show a crowd line only when 30 or more students have answered the question.
- **Honest limit:** with about 1,500 students and 35,000 answers on production (16 to 18 Oct), few questions pass 30 answers yet. The crowd line grows with the user base, and the Mob lines work from day one.

### 2.10 Pace and nerve coach: time, changed answers and blanks

- **The moment:** after a timed full mock.
- **What Mobi does:** it shows where the 60 minutes went and what that cost: "You spent 14 minutes on 9 questions you got wrong. Answer changes cost you 6 marks net: you changed right to wrong 3 times." It also covers blanks, in CUET's own arithmetic: "You left 11 blank. Under +5 / −1 with four options, even a blind guess is worth +0.5 on average, and when you can rule out one option it is worth more." Then one drill: a paced 10-question set with a 70-second clock.
- **Why ChatGPT cannot:** it has no per-question timing and no change history.
- **Cost and price:** 0 calls. **Pro** (pace and changed answers are already Pro in the record).
- **Build on:** `Pace` (`medianWrongSec`, `shareOnWrong`, `slowest`), `ChangesSummary`, the blank share and the ledger, and the paced Quick set (`/dashboard?mode=quick&count=10`).

### 2.11 Mobi checks in

- **The moment:** when a fix is due for its check, the morning of a planned mock, or day 3 without practice.
- **What Mobi does:** one small, specific job in the notification and on Today: "2 fixes are due for their check. 2 minutes." Or: "Your Share Capital fix held at 7 days. One more and it's yours." It never sends a generic "come back".
- **Why ChatGPT cannot:** it never speaks first, and it has nothing of yours to check.
- **Cost and price:** **0 calls, free.**
- **Build on:** `repair_ready.dart`, `evening_move.dart` and `reminder_plan.dart` in the app's local notifications (the repo has no push sender, and none is needed), the `check_due` and `weekly_plan` channels already in `notification_prefs`, and the Revise due days from 2.2.

### Summary

| # | Capability | Moment | Calls | Price | Exists to build on |
|---|---|---|---|---|---|
| 2.1 | 2-minute debrief | after every paper | 0, or 1 for a full mock | Free | result breakdown, readout, traps, pace |
| 2.2 | Fix it for good | a wrong answer in Review | 1 (cached repeats about 0) | 1 credit; Pro included | Repair v3, check, Revise, atlas, option stats |
| 2.3 | Trap hunt set | "I have 20 minutes" | 0 | Free to build; questions at practice price | `/api/me/traps`, atlas, practice |
| 2.4 | Where you stand | Sunday, after a mock | 0 | Band free; gap by chapter Pro | `compass_projection.js`, colleges |
| 2.5 | Your week | Sunday night, a missed day | 0, or 1 for the note | Pro | plan actions, Today, reminders |
| 2.6 | Tonight's last look | the night before | 0 | Free (replaces a 1-credit ask) | rules, traps, Revise, Learn |
| 2.7 | Daily 5 | the bus, bedtime | 0 | Free | Revise, Learn cards |
| 2.8 | Ask now, grounded | a doubt | up to 6 a thread | 1 credit a thread; Pro included | chat route, check |
| 2.9 | You, your Mob, the crowd | Review, after a game | 0 | Free | option stats, Mob v3 |
| 2.10 | Pace and nerve coach | after a timed mock | 0 | Pro | Pace, changes, ledger |
| 2.11 | Mobi checks in | a check is due | 0 | Free | local reminders |

Eight of the eleven need no model call at all. That is the point: Mobi's value is our data and our ability to act, not the size of the model.

---

## 3. How AI should be priced, so 1 credit always feels worth it

### 3.1 The numbers we work with

- **What a reply costs us:** a gpt-6-luna reply costs about Rs 0.027 on average and Rs 0.042 at the measured maximum.
- **What a credit sells for:** Rs 0.20 on the web (Rs 10 for 50) and Rs 0.30 on Play (Rs 15 for 50).
- **The caps:** the per-student caps of Rs 2.50 a month (Free) and Rs 5 (paid) allow about 90 and 185 average replies.
- **So cost is not the problem.** Perceived value is. The benchmark a student uses is the other thing a credit buys: **one practice question.**

### 3.2 The rule

| | What is in it | Why |
|---|---|---|
| **Free, always** (no credit) | Every answer from the record (today's free door). The debrief after every paper (2.1). Tonight's last look (2.6). Daily 5 (2.7). The score band and top college (2.4). Building a trap hunt set (2.3). The crowd and Mob lines (2.9). Check-ins (2.11). The verified key and book explanation of any question you sat. | These cost us 0 or 1 cheap call. They are the reasons to open the app daily, and they feed paid repairs and practice. |
| **1 credit = one finished job** | **Fix it for good** (2.2): trap, why it tempted, why the key is right, another way, a rule, 2 fresh check questions, follow-ups, and Revise until it holds. **A grounded doubt thread** (2.8): the answer, up to 5 follow-ups and 2 check questions. | A student can count what they got. One credit buys a question to practise, or **one mistake fixed for good: why you fell for it, 2 fresh questions to prove it, and Revise until it sticks.** Never "1 credit a message". |
| **Pro** (Rs 99 a month on the web, Rs 149 on Play) | No credits for Mobi jobs (fair use: 10 a day, inside the Rs 5 cap). Your week and re-plans (2.5). The college gap by chapter (2.4, which is Compass Pro today). The pace and nerve coach (2.10). Every chapter ranked. Plus everything Pro already has (practice without credits, every mode). | Pro becomes "Mobi coaches your whole season", not only "unlimited mocks". |
| **Never charged** | A failed or unusable reply. A key dispute. A repeat of a repair already written. A follow-up inside a job. | As today, plus the follow-ups. |

### 3.3 What changes from today

- **"What should I revise tonight?"** moves from 1 credit (a paragraph) to free (the last-look pack, 2.6).
- **"Ask now"** moves from 1 credit a message to 1 credit a thread, and every thread ends with 2 verified check questions.
- **Repair** stays at 1 credit, but it becomes Mobi's named job ("Fix it for good"). It now includes the follow-ups, the crowd line, a second check question and the Revise returns, all shown as Mobi's.
- **The projected total band and the top college** move from Compass Pro to free. The gap by college and by chapter stays Pro.
- **The unused `CREDIT_COSTS` entries of 3 credits** ("Deeper analysis costs 3 credits" on the pricing page) are dropped. The chat route already charges 1, so the copy is wrong today.
- **The credit line** on Ask Mobi says what a credit buys, not what it costs: "1 credit fixes a mistake for good, with 2 fresh questions to prove it. Everything from your record is free."
- **The Pro page** (his J1, "rudimentary") gets its strongest lines from here: "Mobi plans your week to your college", "Fix every mistake without credits", "See where your 60 minutes go".

### 3.4 The cost check (worst realistic month)

| Who | Use | Cost |
|---|---|---|
| A busy free student | 30 papers (the included daily set, and 2 full mocks), 8 repairs and 3 doubt threads | about 2 + 8 + 18 = 28 calls, about Rs 0.76 (cap Rs 2.50) |
| A heavy Pro student | 10 full-mock debriefs, 60 repairs, 20 threads at 6 messages each, and 4 week notes | about 10 + 60 + 120 + 4 = 194 calls, about Rs 5.2 |

The heavy Pro case touches the Rs 5 cap. Two things keep it within bounds: the cap refuses honestly and charges nothing, and cached repairs cost close to nothing. The fair-use line (10 jobs a day) covers the rest. **No model change and no higher cap is needed.** If he wants headroom, Rs 7 a month for paid students would cover even this case.

---

## 4. The top 3 to build next

All three are refinements of what exists, not rebuilds (his rule). Each goes through mock-ups first (R8): 360 and 412, Night and Day, fresh and heavy accounts, then his pick, then build on app and web together.

### 4.1 The 2-minute debrief after every paper (free)

**Spec:** The recap that follows the sealed-sheet reveal keeps its cards and its motion. What changes is what Mobi says on them: his single reaction line becomes the debrief, spread across cards 2 and 3 and shown again at the top of the full result. It gives four lines, each read from the attempt and left out when there is no figure:
- where the marks went (wrong, blank, penalty);
- the one biggest cause (a trap type repeated, a chapter, or time);
- time on wrong answers;
- what moved since the last paper in this subject.

For a full mock, one optional luna call writes the four lines as Mobi's three sentences under `RECORD_RULES`. If it fails, the template shows and nothing is charged. The card's one key, "Fix these 5", opens a repair run on the five wrong answers worth the most marks. The run is ordered so that a repeated trap comes first, and each repair says its price before the tap. A small "Ask Mobi about this paper" opens the existing sheet with the debrief already in it, so the student never starts from an empty box. The debrief is also saved, so "Why did I lose marks in my last paper?" on the record door returns it.

**Screens:** the app result recap and full result (`features/result/recap`, `recap_mobi.dart`, `first_fix_card.dart`, `full/full_result_screen.dart`; this answers G22's weak result screen); the Quick practice result (`practice_result_screen.dart`); the Ask Mobi sheet in mock context (`AskMobiContext.mock`, autopsy); the record door's "last paper" ask (`lastPaper()` in `ask_doors.dart`); Review's repair run; the web result page and `/mentor`.

### 4.2 Fix it for good: Repair becomes Mobi's job (1 credit, Pro included)

**Spec:** On any wrong answer, "Ask Mobi about Q7" opens the sheet with the free part already showing: your pick, the key, the book explanation, the trap tag if the atlas has one, and the crowd line ("Most students who got this wrong picked C, like you", shown only with 30 or more answers). The one paid key is **"Fix it for good · 1 credit"**, with **"Included in Pro"** for Pro students. It runs Repair v3 and shows it in Mobi's voice and in this order:
1. the trap;
2. why your option looked right;
3. why the key is right;
4. another way to see it;
5. a rule to keep;
6. two fresh check questions inline.

The student can then ask up to 5 follow-ups in the same sheet at no extra charge, using the existing `questionRef` context. The rule goes to Revise, whose due days (1, 3, 7 and 21) come back through "Mobi checks in" (2.11). When the fresh checks are right the fix is "held", as the record already counts it, and a Revise card that retires says the fix has stuck. A repeat of a fix already written is free. A dispute is free.

**Screens:** the Review answer sheet and its Ask Mobi sheet (`ask_sheet.dart`, question context); the repair screen and ending (`review/screens/repair_screen.dart`, `repair_ending_screen.dart`), retitled as Mobi's work; Revise; the Ask Mobi screen's "Ask now" door (a doubt about a question they sat routes here); the wallet credit line; the web Repair card, `RepairAsk` and the result page.

### 4.3 Where you stand, and your week (band free; gap and plan Pro)

**Spec:** The "Ask your record" door of Ask Mobi stops leading with a sentence and leads with the student's standing:
- the projected total band out of 1000;
- the closest of their colleges, with its 2026 Round 1 closing marks;
- the paper with the most marks open.

All of it comes from `compass_projection.js` through one new read (`GET /api/me/standing`, or the existing Compass data). It carries the line "From your own practice, before NTA normalisation. Not a prediction." Under it, Pro students see "Your week": 7 days of short sessions, from the gap, the ranked chapters, the due checks and Revise cards, and their daily minutes. Each day's session becomes Today's lead card with its reminder, and the week re-plans after a missed day or a new full mock. Free students see the band, the top college and today's one move, with the week visible but locked (D101). The mentor context finally reads `my_colleges` (the `targetRows` TODO), so a typed "Can I get into SRCC?" is answered from the real gap, never guessed.

**Screens:** the Ask Mobi screen's record door (`ask_doors.dart` and `widgets/ask_doors.dart`); Today's lead card and Colleges strip; the Colleges card on You; notifications (`reminder_plan.dart`); the web `/mentor` record door and `/admission-compass`; the Pro page ("Mobi plans your week to your college").

### What the Ask Mobi screen becomes (refined, not rebuilt)

The two doors he picked (D114) stay. What sits behind them changes:
- **Ask now:** "Ask any doubt. Mobi answers and tests you on 2 real CUET questions. 1 credit a doubt, follow-ups included."
- **Ask your record:** it leads with "Where you stand", then the jobs waiting today ("Your last paper, in 2 minutes", "2 fixes due for their check", "Tonight's last look"), then the existing record questions.

The empty box stops being the main thing on the screen.

---

## 5. Decisions for him

1. **The rule:** Mobi charges for finished jobs, never messages; everything from the record is free. Yes or no?
2. **"What should I revise tonight?"** becomes free (the last-look pack). Yes?
3. **Pro includes Mobi jobs** with no credits (fair use 10 a day). Yes, or keep Pro's 50 a month?
4. **Crowd lines** ("most students who got this wrong picked C") shown at 30 or more answers. Yes?
5. **The projected band and top college become free.** Today they are part of Compass Pro. Yes?
6. **Build order:** debrief, then Fix it for good, then Where you stand. Mock-ups of all three first. Yes?

## 6. Not verified

- No figure here was tested on a device. The example numbers (138 of 250, 610 to 680, 712, 41%) are illustrative; the build reads every figure from the record, or leaves the line out.
- Whether production `question_option_stats` has enough rows per question for crowd lines was not queried. Its first production refresh hit a timeout (STATUS, 16 Oct), and a fallback file covers 461 questions.
- Time per question is computed from device events (`data/paper_trace.js`). Papers before the 15 Oct runner carry thinner timing, so pace lines need 8 or more timed questions, as today.
- Trap tags from repairs exist only where some student has repaired that option. Tags from the question format (NOT/EXCEPT, assertion-reason, extreme words) cover every question.
- Whether the Rs 2.50 free cap (migration `20261018130000_free_ai_wallet_50.sql`) is applied on production was not checked.
- The cost figures come from the 17 Oct measurement of luna repairs; chat replies of 950 tokens may cost a little more.
