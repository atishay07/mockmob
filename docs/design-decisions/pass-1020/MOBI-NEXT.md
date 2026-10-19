# Mobi next: what makes Ask Mobi smarter than any free chatbot (20 Oct 2026)

**Status:** a plan only. No code changed and no model called. Under D156 the CTO decides, so this is the build order, not a proposal for the owner to vote on.
**Owner's words it answers:** J4 (1:49 am, "Why would someone use Mobie over ChatGPT ... which they can use for free?") and D157 (2:14 am: keep a very good margin on AI credits; Pro does not make Mobi free; go deeper rather than do more per credit; use our data; surprise him; the website is the main product).
**Decisions it follows:** C-dec 3 and 3b (OWNER-MASTER-LEDGER.md). Where C-dec 3 and D157 disagree, D157 wins: every Mobi job costs credits on every plan.
**Read for this:** `ASK-MOBI-VALUE.md` (same folder), live main 48985a8d (Mobi v13 web: `src/services/mobi/*`, `src/components/ai/mobiJobs.mjs`, `data/mobi_fix.js`, `data/mobi_standing.js`, `data/mobi_tonight.js`, `src/services/mobi/doubtThread.js`), app `ui/v17-mobi` 096fa2db (STOP POINT) and `ui/v17-finish` 6fdfff26 (Mobi's read of the paper), the runtime guard migrations, `providerCore.js` and `creditPacks.mjs`.

---

## 0. In one minute

Version 13 fixed the price model: Mobi no longer charges for talking. The live web now has Where you stand and tonight's pack (both free, no model call), a doubt thread (1 credit: an answer, one follow-up and 2 verified CUET questions), and Fix it for good (1 credit: why your option looked right, 2 fresh checks, held). The app has Mobi's read of the paper on every finish.

What is still missing is the part no chatbot can copy: **Mobi working across many answers at once.** Today every paid job looks at one question or one doubt. A free chatbot can do one question too, if the student types it in. It can never see that the same trap caught a student in 5 of their last 8 papers, that they changed 3 right answers to wrong ones under time pressure, or that 38 of the marks between them and their college sit in two chapters. The next capabilities are the jobs that only exist because we hold the whole record, priced as deep finished work.

**Build next, in this order:** (1) Fix this paper, (2) Trap clinic, (3) Your road to your college (the week plan), (4) the doubt thread put on a context diet with bank grounding, so its margin holds. Then the free and Pro layers that feed them: crowd and Mob lines, the weak-spot mock, the pace coach, and Daily 5 with check-ins.

---

## 1. Ground rules for every capability below

### 1.1 What one credit earns, and the margin rule
- **The floor price of a credit:** Rs 49 for 300 on the web, which is Rs 0.163 a credit (Rs 0.16 after Razorpay's fee). Play is Rs 0.25 before Google's fee. Monthly free credits earn nothing, so their cost is held by the per-student caps, not by price.
- **Model prices (the guard's own rows):** gpt-6-luna and claude-haiku-5-5 are both USD 0.10 per million input tokens and USD 0.50 per million output tokens. USD 1 = Rs 88. So one call costs Rs (input tokens x 0.1 + output tokens x 0.5) x 88 / 1,000,000.
- **Measured on production (17 Oct):** a luna repair costs Rs 0.027 on average and Rs 0.042 at the worst.
- **The margin rule (new, CTO):** a paid job's model cost must stay at or under **20% of its credit price on average and 35% at the worst**, at the Rs 0.163 floor. Every job below states its token bounds, so the worst case is arithmetic, not hope.
- **Check of what is live against the rule:**
  - Fix it for good: Rs 0.027 average (17%) and Rs 0.042 worst (26%). It passes.
  - The doubt thread: about Rs 0.05 average (31%) and Rs 0.08 worst (49%), from STATUS 20 Oct 3:25 am. **It fails.** Capability 4 fixes it without raising the price.

### 1.2 Runtime budget
- The planning envelope is **USD 25 a month (Rs 2,200)**, the `student_ai` row in `runtime_ai_budget`. The 17 Oct note says the owner lifted the global ceiling, but this plan stays inside USD 25 anyway.
- The per-student caps stay as they are: Rs 2.50 a month on Free, Rs 5 on paid, plus USD 0.02 of headroom for each bought credit while a bought credit is paying.
- Only gpt-6-luna and claude-haiku-5-5 are used, through the existing `reserve_runtime_ai`. The full worst case is reserved before any call, and nothing is charged when a job fails.
- The budget check for a heavy month is in section 4.

### 1.3 Truth guards every job keeps
These are the existing rules, restated because every new job inherits them:
- **Figures come from the server.** Every figure is read from the record or the bank. A line that has no figure behind it is dropped, never filled in.
- **The model never sets the key.** It is told the verified key and cannot argue for another. A disputed key goes to the free blind check.
- **Questions come only from the verified bank,** through the publication gate that practice and Repair check already use. No question is ever generated at runtime.
- **Trap names come from the fixed list of 10 trap types** in `data/trap_atlas.js`. Free text that names a trap outside that list is dropped.
- **No predictions.** No admission chance and no rank. The score range is said "from your own practice, before NTA normalisation". These are the `RECORD_RULES`.
- **Every reply is checked against its schema** (`responseValidator`). A part that fails the check is left out and its credit is given back.
- **Crowd lines need 30 or more answers on the question.** Mob lines never show counts in a small Mob, which is the Mob v3 rule.

### 1.4 Copy rules (R6)
Copy is plain, whole sentences in his voice. There are no exclamation marks, emoji, em dashes, middle dots or hype. Every price is stated before the tap, using the existing `usesLine`, for example "This uses 4 credits. You have 61."

### 1.5 Where it lands
The website is built first, or together with the app (D157). The app follows on the same API. Each capability names its build size in agent-hours for one Sonnet builder: S is up to 3 h, M is 3 to 6 h, L is 6 to 12 h.

---

## 2. The capabilities, ranked by student value and margin

| # | Capability | Price | Model cost (avg / worst) | Cost share at Rs 0.163 | Size |
|---|---|---|---|---|---|
| 1 | Fix this paper | 1 credit a mistake, up to 8 | Rs 0.012 / 0.018 a mistake | 7% / 11% | L |
| 2 | Trap clinic | 2 credits | Rs 0.05 / 0.084 | 15% / 26% | M |
| 3 | Your road to your college (week plan) | Pro, no credits | Rs 0 | n/a | L |
| 4 | Doubt thread v2: context diet and bank grounding | 1 credit (as now) | Rs 0.03 / 0.055 | 18% / 34% | M |
| 5 | Crowd and Mob lines inside Fix and Review | Free | Rs 0 | n/a | S |
| 6 | The weak-spot mock | Practice price (Pro: included) | Rs 0 | n/a | M |
| 7 | Pace and nerve coach | Pro, no credits | Rs 0 | n/a | M |
| 8 | Daily 5 and Mobi checks in | Free | Rs 0 | n/a | M |
| 9 | Find it in the passage (Fix for passage questions) | 1 credit (Fix price) | Rs 0.035 / 0.055 | 21% / 34% | S |

The order is: the student value first, then the margin. Items 1, 2 and 9 are the new paid depth (D157). Items 3 and 7 make Pro worth paying for without making Mobi's jobs free. Items 5, 6 and 8 are free or practice-priced, and each feeds a paid job.

---

### 2.1 Fix this paper (1 credit a mistake, up to 8)

**Why it wins:** this is the job a chatbot cannot do at all. The student would have to paste 50 questions, their picks, the keys and their timings. Mobi already holds all of that the minute the paper ends.

**The moment:** this capability lives behind the "Fix these" key on Mobi's read of the paper. On the app that is `paper_read.dart` "marks within reach". On the web it is the SWOT panel's plan in `ResultPageClient.jsx`. Today that key opens single repairs one at a time.

**Data it uses:**
- the attempt's answers, the student's pick, the verified key and the time on each question (`attempts.details`, `paper_trace.js`);
- the marks each wrong answer cost under +5/-1;
- the trap of each wrong option (the atlas, or the format tag);
- the student's "Traps you meet" history;
- any repair already written for the same question and option;
- the verified bank for the re-sit.

**What Mobi does:**
1. It picks up to 8 wrong answers, ordered by marks recoverable, with repeated traps first.
2. It writes every repair in **one batched call**: for each mistake, the trap, why your option looked right, why the key is right, and a rule of 15 words or fewer.
3. It reads across the mistakes for the paper-level pattern. This part needs no model: it is grouping by trap, chapter and time.
4. It builds a **re-sit**: one fresh verified twin for each mistake (same chapter and concept, or the same trap tag), answered in a row and marked.
5. Each rule goes into Revise. Mobi comes back in 7 days to check whether each fix held.

**What the student sees** (on the web result page and the app finish, figures from the record):
> **Fix this paper**
> You lost 47 marks on this paper. Mobi can fix the 8 mistakes that cost the most, which is 40 of those marks.
> This uses 8 credits. You have 61.
> [Fix these 8]

After it runs:
> **What went wrong on this paper**
> 5 of your 8 mistakes came from one habit: you picked the option that was true in general but did not answer what the question asked.
> 3 of them were in Partnership, and you spent over 2 minutes on each.
>
> **Your 8 fixes** (each opens like Fix it for good: the trap, why your option looked right, why the key is right, the rule)
>
> **Now prove it**
> 8 new questions, one for each mistake. You have not seen any of them.
> [Start the re-sit]

After the re-sit:
> You got 6 of the 8 right. Those 6 fixes are holding, and Mobi checks them again on 27 October.
> The 2 you missed are in Revise. They come back tomorrow.

**Price:** 1 credit for each mistake fixed, shown before the tap, with a minimum of 3. With fewer than 3 mistakes, the key opens Fix it for good on each one. A mistake whose repair is already written (by this student, or cached for the same question and option) costs 0, and the price line says so: "2 of these are already fixed, so this uses 6 credits." The re-sit questions are part of the job, so they cost no practice credits.

**Model cost:**
- One luna call, with an input bound of 6,000 tokens and an output bound of 2,000.
- **The worst case is about Rs 0.14 a paper, Rs 0.018 a mistake (11%).** Typical use is about 4,000 in and 1,400 out, about Rs 0.097, or Rs 0.012 a mistake (7%).
- If the batch fails, it falls back once to claude-haiku-5-5 with the same bounds.
- Depth: each item stays as deep as a single Fix it for good, and the paper-level read and the re-sit are added on top. There is no discount, because the job is deeper, not cheaper (D157).

**Truth guard:**
- Each item in the batch is validated on its own. An item that fails falls back to the bank explanation, is marked "Mobi could not write this one, so it was not charged", and its credit is released.
- The pattern line is computed, never written by the model. It only appears when 3 or more mistakes share a trap or a chapter.
- A twin must pass the publication gate, must not have been seen by this student, and must not be passage-linked unless its passage is shown. If no twin exists for a mistake, the re-sit is shorter and says so.

**Build (L, web first):**
- `data/mobi_paper_fix.js`, pure: selection, ordering, pattern, price, held.
- `src/services/mobi/paperFix.js`: the batched call, per-item validation and the reservation for N credits with per-item release.
- A route, `POST /api/mobi/paper-fix`.
- The re-sit, on the `repairCheck` picker extended to N twins.
- The web result panel. Then the app's "Fix these" in `paper_read.dart`.
- Tests with fakes, as `mobi_doubt_thread.test.mjs` does.

---

### 2.2 Trap clinic: "Why do I keep falling for this?" (2 credits)

**Why it wins:** a single repair fixes one mistake. The clinic fixes the habit behind several. Only we know that a missed NOT or EXCEPT has caught this student 5 times in 9 chances across 4 subjects.

**The moment:** the clinic is offered in three places:
- "Traps you meet" (`GET /api/me/traps`), on any trap that has caught the student 3 or more times;
- the Fix this paper pattern line;
- the record door of Ask Mobi.

**Data it uses:**
- the student's caught instances of one trap type: at most 6, the most recent first, each with the stem, the student's pick and the key;
- the trap atlas and the format tags;
- the verified bank, filtered by that trap.

**What Mobi does:**
1. One call reads the 6 instances together. It names the shared step the student skips, and writes a **trap card**: how to spot this trap, and the 10-second check before answering.
2. A **trap hunt** follows: 6 unseen verified questions that set the same trap, answered and marked.
3. Mobi comes back in 7 days with a second, shorter hunt of 3 questions, so the student can see whether they now catch it.

**What the student sees:**
> **Trap clinic: the missed NOT**
> This trap has caught you 5 times in 9 chances, in Accountancy, Business Studies and English.
> In 4 of the 5 you chose an option that was true. The question asked for the one that was not.
>
> **Your 10-second check**
> Before you answer, find the word NOT or EXCEPT and say the question back to yourself with it.
>
> **Now hunt it**
> 6 new questions that set the same trap. Catch it in each one.
> This uses 2 credits. You have 59.

After the hunt:
> You caught it in 5 of 6. Last time you caught it in 1 of 4.
> Mobi sets 3 more on 27 October, to check that it stays caught.

**Price:** 2 credits. The hunt questions and the 7-day check are included.

**Model cost:**
- One luna call: input of 5,000 tokens or less (6 stems with options, the trap rule and the system prompt), output of 900 or less.
- **Worst case about Rs 0.084 (26% of 2 credits).** Typical use is about 3,500 in and 600 out, about Rs 0.057 (17%).
- No reasoning effort: the job writes from given facts, it does not solve.

**Truth guard:**
- The "caught 5 of 9" figure comes from `buildTrapsMeet`. The model is given the trap name and may not rename it.
- The "4 of the 5" claim must be backed by a per-instance tag that the model returns. The server counts the tags, and drops the line if the tags do not add up.
- Hunt questions carry the trap through the format tag (NOT or EXCEPT, assertion-reason, extreme words, which cover every question) or through a clean atlas row (`cleanAtlasRow`).
- A trap with fewer than 6 taggable unseen questions gets a shorter hunt, and the screen says how many.

**Build (M):**
- A trap filter on the practice picker. ASK-MOBI-VALUE 2.3 described it; it is not built.
- `data/mobi_clinic.js` and a route, `POST /api/mobi/clinic`.
- The web clinic sheet, launched from "Traps you meet". Then the app.

---

### 2.3 Your road to your college: the week plan (Pro, no credits, no model)

**Why it wins:** a chatbot can write a timetable. It cannot pick the questions, put each session in the app, see what got done and re-plan from the results. Where you stand (live) shows the gap. This turns the gap into seven days of work.

**Why Pro and not credits:** the plan makes no model call, so a credit price would be margin with nothing behind it. It is a Pro reason, in the same way practice without credits is. Mobi's paid jobs inside the plan still cost credits on Pro (D157).

**Data it uses:**
- Where you stand: the range, the gap to the closest college, and the chapters that close it (`data/mobi_standing.js`);
- chapters ranked by marks lost;
- Revise cards due and fixes due for their held check;
- the student's daily minutes (study goal);
- their next planned mock;
- `study_scheduler.mjs` and the plan actions.

**What the student sees** (the Ask Mobi record door under Where you stand, and Today's lead card each day):
> **Your road to Hindu College**
> Your practice puts you 52 marks below its 2026 Round 1 closing mark. This week works on the 31 of those marks that sit in Share Capital and Ratio Analysis.
>
> Mon: Share Capital, 12 questions, 15 minutes
> Tue: 2 fixes due for their check, and 5 Revise cards, 10 minutes
> Wed: Ratio Analysis trap hunt, 15 minutes
> Thu: Rest, or Daily 5
> Fri: Share Capital, 12 questions
> Sat: Accountancy full mock
> Sun: Mobi reads the week and plans the next one
>
> [Start today's session]

After a missed day:
> You missed Wednesday. Mobi moved the Ratio Analysis hunt to Thursday, so Saturday's mock stays where it is.

Free students see the first line and today's one move, and the week is shown but locked with "Pro plans the whole week to your college." This is D101: features are shown, never hidden.

**Truth guard:**
- Every gap and chapter figure comes from `buildStanding`. The plan is deterministic, so the same record gives the same plan, and it is tested.
- There are no promises such as "this will get you in". The line says what the week works on, not what it will win.
- With no college, it plans to the student's own weakest paper and says so.

**Build (L, web first):** `data/mobi_week.js`, pure, with tests; `GET /api/mobi/week`; the week list on `/mentor` under Where you stand; Today's lead card reads today's session; on the app, the reminder through `reminder_plan.dart`.

---

### 2.4 Doubt thread v2: the context diet and bank grounding (1 credit, as now)

**Why it is here:** this is the live job that fails the margin rule (worst case 49%). It is also the job closest to a free chatbot. Grounding makes it better than one, and the context diet makes its margin safe.

**What changes:**
1. **The diet.** A doubt sends only what it needs:
   - the student's lines for that chapter (right, wrong, the last 3 misses and their traps);
   - 2 verified bank explanations on the same chapter and concept;
   - the system prompt.

   It no longer sends the whole 12 KB student context. The opening reply is bounded to 2,500 tokens in and 600 out, and the follow-up to 1,200 in and 400 out.
2. **Grounding.** The answer may cite the 2 bank explanations by id, and it uses CUET's own conventions for the subject. The 2 check questions stay as they are.
3. **The student's own misses.** One line ties the doubt to the record when the record has it.
4. **A job cost ledger.** Every Mobi call's `request_key` carries its job type (`fix`, `paper_fix`, `clinic`, `thread`, `thread_followup`), so a weekly read-only SELECT on `runtime_ai_requests` gives the real cost of each job. **If the thread's 7-day average goes over Rs 0.033 (20%), the thread moves to 2 credits,** and the copy says that it includes 2 practice questions.

**What the student sees** (the same thread as today, with one new line at the top when the record has it):
> You have missed 3 of your 5 goodwill questions, all at the super-profit step. This answer starts there.

**Model cost:**
- **Worst case:** the opening reply is Rs 0.048 and the follow-up Rs 0.028, so a full thread is Rs 0.076. The follow-up is used in about 1 thread in 3 (to be measured). The working budget is about Rs 0.055 a thread at the worst (34%).
- **Typical:** about Rs 0.03 a thread (18%).

**Truth guard:**
- The "3 of 5" line comes from the chapter record, never from the model.
- Cited explanation ids must be among the 2 that were sent. Any other citation is removed.
- A doubt about a question the student sat routes to Fix it for good. Live code already does this for anchored doubts.

**Build (M):** a doubt-sized context builder beside `getStudentAIContext`; the bank explanation picker (it reuses the thread's chapter candidates); job tags on request keys; the measuring SELECT added as a weekly check in `scripts/learning/prepos-readiness.mjs`.

---

### 2.5 Crowd and Mob lines inside Fix and Review (free, no model)

**Why it wins:** this is the most human line in the product: "You are not the only one." It costs nothing to show, and it makes the paid fix feel aimed.

**Data it uses:**
- `question_option_stats`, shown only when 30 or more students answered the question;
- `mob_sittings` and `mob_traps` for the student's Mob.

**What the student sees:**
- In Fix it for good, under "why your option looked right":
  > 41% of students who answered this picked C, like you. It is the most common wrong answer on this question.
- After a Mob game:
  > Question 4 caught most of your Mob. You got it right. [Fix it together]
- In Review, on a question the student got right that most students missed:
  > Most students missed this one. You did not.

**Truth guard:** the percentage is computed from the stats row and rounded to a whole number. The line is left out below 30 answers or when the row is older than its `refreshed_at` rule allows. Mob lines say "most" and never a count when the Mob is small, and never name anyone.

**Build (S):** a crowd field on the repair response (`fixJob` in `data/mobi_fix.js`) and on the review answer sheet. The Mob line already exists in Mob v3 data; it gets a Mobi line on the podium.

**Honest limit:** with about 1,500 students on production, few questions pass 30 answers yet. The line grows with the user base. Mob lines work from day one.

---

### 2.6 The weak-spot mock: Mobi builds the paper you need (practice price; Pro included)

**Why it wins:** this is the USP (unlimited mocks from one bank) aimed by the record. A chatbot can only invent questions. Mobi assembles a real CUET-shaped paper from verified questions, weighted to where this student loses marks.

**Data it uses:**
- chapters ranked by marks lost;
- the student's traps;
- the CUET paper shape (50 questions, 60 minutes, +5/-1);
- the verified bank, with unseen questions only.

**What the student sees:**
> **A paper built from your weak spots**
> 50 new questions in Accountancy, 60 minutes, marked like CUET. 22 of them come from the 3 chapters where you lose the most marks, and 8 set the traps that catch you. The rest cover the syllabus as the real paper does.
> This uses 50 credits. You have 112. (Pro: included.)
> [Start the paper]

After it ends, Mobi's read of the paper compares it with the last full mock in the subject:
> Share Capital went from 2 of 6 to 5 of 6.

**Price:** the same as a full mock (50 credits, or included on Pro). The first-full-mock-free rule does not apply, because this is not the first mock. No model call.

**Truth guard:** the mix is stated, and the paper never claims to predict the real CUET paper. It follows the existing full-mock selector (`nta_question_selector.js`) with a weight on chapters, so the syllabus coverage rules still hold.

**Build (M):** a weight option on the full-mock selector; an entry point on Where you stand and on Mobi's read of the paper; the comparison line, which reuses the finish read.

---

### 2.7 Pace and nerve coach (Pro, no credits, no model)

**Why it wins:** no chatbot has the per-question time or the history of answer changes.

**Data it uses:** `Pace` (median time on wrong answers, share of time on wrong answers, the slowest questions), `ChangesSummary`, blanks, and `paper_trace.js`.

**What the student sees** (after a timed full mock, as a section of Mobi's read of the paper):
> You spent 14 of your 60 minutes on 9 questions you got wrong.
> You changed 5 answers. 3 went from right to wrong, which cost you 18 marks. When you are unsure, your first answer has been right more often than your second.
> You left 11 questions blank. Under +5 and -1 with four options, a blind guess is worth half a mark on average, and more when you can rule one option out.
> [A 10-question set at 70 seconds each]

**Truth guard:**
- Pace lines need 8 or more timed questions, as today.
- The "first answer right more often" line needs 5 or more changes across the student's papers, and is computed, not written.
- The guessing arithmetic is exact: 0.25 x 5 - 0.75 x 1 = 0.5. It is never advice to guess everything; it states the expected value.

**Build (M):** the pace section on the web result page and the app finish, from data already in the record; the paced Quick set at 70 seconds.

---

### 2.8 Daily 5 and Mobi checks in (free, no model)

**Why it wins:** this is the daily habit. It is also what makes "held" mean something: the fixes from capabilities 1, 2 and 9 come back here.

**Data it uses:** Revise cards due (at 1, 3, 7 and 21 days), repair rules, held checks due, and Learn recall cards in the weakest chapters.

**What the student sees:**
- In the notification and on Today:
  > 2 fixes are due for their check. It takes 2 minutes.
- In Daily 5:
  > 5 cards from your own rules and formulas. Each one leaves the deck once you get it right twice.
- When a fix has held:
  > Your Share Capital fix held at 7 days. One more check and it is yours.

**Truth guard:** each message names a real due item, or it is not sent. There is no generic "come back" and no AI-written push text.

**Build (M):** web: the Today card and `/revise`. App: local notifications through `repair_ready.dart` and `reminder_plan.dart` on the existing `check_due` channel. A Revise answer counts toward the Mob chain (`chain_daily`).

---

### 2.9 Find it in the passage: Fix it for good for passage questions (1 credit)

**Why it wins:** English and the reading-based papers lose marks to passage questions. The doubt thread leaves passage-linked questions out today. A chatbot needs the whole passage pasted in. Mobi has it, and can point at the exact sentence.

**What the student sees** (the Fix it for good order, with one new first step):
> **The line that answers it**
> "The committee did not reject the proposal; it postponed it."
> You picked B, "the proposal was rejected". The passage says it was postponed. The trap is a word that sounds close to the passage but changes its meaning.

**Price:** 1 credit, the same as Fix it for good.

**Model cost:** the passage adds up to 1,500 input tokens. The bound is 3,500 in and 700 out. **Worst case about Rs 0.062 (38%), typical about Rs 0.035 (21%).** The worst case is just over the 35% rule, so the passage is trimmed to the paragraph that holds the key's evidence plus one paragraph on each side. That keeps it at or under 3,000 in, which is Rs 0.057 (35%).

**Truth guard:** the quoted line must be an exact substring of the stored passage. If it is not, the quote block is dropped and the rest of the fix stands.

**Build (S):** a passage branch in `mistakeRepair.js` and the schema, the substring check, and the quote block in the fix view.

---

## 3. What NOT to build

1. **A general chat, or any price per message.** Talk is never the product. Every paid call belongs to a job with a result the student can count.
2. **Questions generated at runtime.** Every check, hunt, re-sit and mock question comes from the verified bank behind the publication gate. A made-up question is the one thing that would make Mobi worse than a chatbot.
3. **Free Mobi jobs on Pro, or "fair use" wording.** D157 overrides C-dec 3 item 2. Pro buys the plan, the pace coach, practice without credits and every mode; Mobi's paid jobs still cost credits.
4. **Admission chances, rank predictions or "you will get into".** Ranges and gaps from practice only, as the `RECORD_RULES` say.
5. **A bigger model, or higher per-student caps, to make answers feel smarter.** The intelligence is our data, not the model's size. The models stay gpt-6-luna and claude-haiku-5-5.
6. **Photo or voice doubts.** Reading a photo is the chatbot's own ground. It adds cost, and its keys cannot be verified. If students ask for it, the answer is to find the question in our bank, not to read the photo.
7. **AI-written debriefs or pushes for every student after every paper.** That cost grows with free users and buys nothing a computed line does not. Mobi's read of the paper stays computed. The one optional sentence call for a full mock stays optional, and only if the measured cost allows.
8. **Long tutoring threads (5 follow-ups).** One follow-up keeps the doubt thread inside the margin. A doubt that needs more becomes a new doubt, or a Fix if it is about a question the student sat.
9. **Naming or ranking friends by their weaknesses.** Mob lines say "most of your Mob" and never name anyone.
10. **A separate "Mobi" tab.** Mobi's jobs live where the moment is: the result page, Review, Traps you meet, Today and the record door. Ask Mobi keeps its two doors (D114).

**Copy debt found while reading (fix it with capability 4):** the homepage card in `src/app/page.js` (line 133) still says "AI replies use monthly credits: 50 on Free, 50 on Pro". That contradicts "Mobi never charges for talking". It should become "Mobi's jobs use credits: 50 free each month on Free and on Pro. Everything Mobi reads from your record is free." `data/tests/free_ai_wallet_50.test.mjs` pins the old line and must change with it.

---

## 4. The budget check (a heavy month, inside USD 25)

Assume a busy month after the closed test widens: about 3,000 monthly students, with heavier Mobi use than today's production shows.

| Job | Count a month | Worst cost each | Month at the worst |
|---|---|---|---|
| Fix it for good | 3,000 | Rs 0.042 | Rs 126 |
| Fix this paper | 600 papers | Rs 0.14 | Rs 84 |
| Trap clinic | 500 | Rs 0.084 | Rs 42 |
| Doubt thread v2 | 2,000 | Rs 0.076 | Rs 152 |
| Find it in the passage | 500 | Rs 0.057 | Rs 29 |
| Haiku fallbacks (assume 5% of calls, at the same price) | | | Rs 22 |
| **Total** | | | **about Rs 455 (USD 5.2), 21% of the USD 25 envelope** |

The free and Pro capabilities (3, 5, 6, 7 and 8) make no model call.

**Per student:**
- A heavy Pro student doing 4 Fix this paper runs (32 mistakes, Rs 0.56), 2 clinics (Rs 0.17), 30 fixes (Rs 1.26) and 10 threads (Rs 0.76) spends about Rs 2.75. That is inside the Rs 5 paid cap even before the bought-credit headroom.
- A free student's 50 monthly credits, all spent on fixes, cost at most Rs 2.10. That is inside the Rs 2.50 free cap.

**Revenue side:** at the Rs 0.163 floor, the paid jobs above bring in about 6 to 9 times their model cost.

---

## 5. Build order and owners (web first, then the app on the same API)

1. **Wave 1, in parallel:**
   - Fix this paper (L, web, then the app's "Fix these").
   - Doubt thread v2, with the job cost ledger and the homepage copy fix (M).
   - Crowd and Mob lines (S).
2. **Wave 2:**
   - Trap clinic, which needs the trap filter on the picker (M).
   - Find it in the passage (S).
   - Pace and nerve coach (M).
3. **Wave 3:**
   - Your road to your college, which needs the clinic's trap hunt and the weak-spot mock as session types (L).
   - The weak-spot mock (M).
   - Daily 5 and check-ins (M).

**Every wave must pass:**
- tests with fakes for every rule (charged once, released on failure, verified questions only, figures only from data);
- a headless walk at 390 and 1440, Night and Day, on preview fixtures (no sign-in);
- R2 lines for each new screen;
- a read-only cost check of `runtime_ai_requests` after the first real week.

**Before merging any app Mobi work:** `ui/v17-mobi` (096fa2db) ends on a STOP POINT whose last 3 files are a helper's unfinished edits. They are reviewed and their tests run first.

## 6. Not verified

- Batched-repair quality (8 repairs in one call) has not been measured. The first build runs 20 staging dry-runs (on staging onwkqxmjqjrhfbjjdydu only) and compares each item with a single repair before the batch goes live. If quality drops, the fallback is 2 batches of 4, at a worst case of about Rs 0.20 a paper, still 15% a mistake.
- Token bounds are design figures. The measured averages come from the 17 Oct repair measurement, and the job cost ledger in 2.4 replaces them with real figures.
- Whether a shared repair cache by question and option exists for every repair path was not checked line by line. Fix this paper prices a repeat at 0 only where a written repair is actually found.
- How many production questions pass 30 answers in `question_option_stats` was not queried (no production reads in this pass).
- The example figures in the copy (47 marks, 41%, Hindu College, 52 marks) are illustrations. The build reads every figure from the record, or leaves the line out.
