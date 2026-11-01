# Learn v2 fixtures (recorded)

Recorded from the web dev preview of the Learn v2 build, web commit 4bba8db6f (branch `web/1031-learn-v2`, folder
`wt-1031-learn-v2`), by:

```
bash tool/record_learn2_fixtures.sh 11011209     # from flutter_app, with the preview already running on port 3451
```

Every answer is the production service (`src/lib/server/learn.js`) over the preview's in-memory student
(`http://localhost:3451/preview/arena/realdeck?_to=/api/learn/<route>&...&_plan=&_student=&_s=app-rec-11011209`). Students: `commerce` (returning: due cards,
open mistakes from Mock 3 and Mock 4, an unfinished Admission of a Partner run) and `new` (nothing studied), each on Pro
and Free. Bodies are exactly as the server sent them, pretty-printed. `manifest.json` names the status, method, route,
query and request body of every file (FixtureLearnApi reads the status of the error files from it).

Files are named `<route>_<what>_<plan>[_<state>]`; `error_<status>_<code>` holds an error body. Not recordable from the
preview (Learn is always on there): `404 LEARN_OFF`, `409 QUESTION_CHANGED | QUESTION_HELD`; tests build those from
the contract (`API-CONTRACT.md`). `parity/` belongs to the stage packet and is not written by this script.

`answer_keys.json` is not a response: it is the key and explanation of every Accountancy question the runs above serve,
learnt by answering each once in a scratch student (`app-rec-<tag>-scratch`), so FixtureLearnApi can grade any choice.

| File | Status | Request | Student | What it is |
|---|---|---|---|---|
| `subject_accountancy_pro.json` | 200 | GET /api/learn/subject?subject=accountancy | commerce, pro | Learn home, Accountancy: parts (Part 2 with its option), units, chapter rows, three suggestions (pickup, due, fix) |
| `subject_economics_pro.json` | 200 | GET /api/learn/subject?subject=economics | commerce, pro | Learn home, Economics |
| `subject_business_studies_pro.json` | 200 | GET /api/learn/subject?subject=business_studies | commerce, pro | Learn home, Business Studies |
| `subject_english_pro.json` | 200 | GET /api/learn/subject?subject=english | commerce, pro | Learn home, English (the subject note: cards written for MockMob) |
| `covers_accountancy_pro.json` | 200 | GET /api/learn/covers?subject=accountancy | commerce, pro | Explore covers: For you first, counts at 5, 10 and 20 min with hooks |
| `shelves_pro.json` | 200 | GET /api/learn/shelves?subject=accountancy | commerce, pro | The three shelf tiles: due (all and by subject), missed, in Revise, Must-know |
| `search_goodwill_pro.json` | 200 | GET /api/learn/search?subject=accountancy&q=goodwill | commerce, pro | Find: chapters, lessons and cards with match spans |
| `cards_aop_all_pro.json` | 200 | GET /api/learn/cards?chapter=accountancy.admission-of-partner&filter=all | commerce, pro | Cards view, Admission of a Partner, every card |
| `cards_aop_must_pro.json` | 200 | GET /api/learn/cards?chapter=accountancy.admission-of-partner&filter=must | commerce, pro | Cards view, Must-know filter |
| `cards_subject_due_pro.json` | 200 | GET /api/learn/cards?subject=accountancy&filter=due | commerce, pro | Find's shelf over the subject, cards due today |
| `preview_aop_5_pro.json` | 200 | POST /api/learn/runs/preview | commerce, pro | Chapter page at 5 min (resume row: the unfinished run) |
| `preview_aop_10_pro.json` | 200 | POST /api/learn/runs/preview | commerce, pro | Chapter page at 10 min |
| `preview_aop_20_pro.json` | 200 | POST /api/learn/runs/preview | commerce, pro | Chapter page at 20 min |
| `preview_aop_10_out_questions_pro.json` | 200 | POST /api/learn/runs/preview | commerce, pro | Chapter page, the Questions pile left out |
| `preview_pf_10_pro.json` | 200 | POST /api/learn/runs/preview | commerce, pro | Basic Concepts at 10 min: due cards and open mistakes |
| `preview_cpsr_20_pro.json` | 200 | POST /api/learn/runs/preview | commerce, pro | A short chapter at 20 min: shrink with addNext offered |
| `preview_cpsr_20_addnext_pro.json` | 200 | POST /api/learn/runs/preview | commerce, pro | The same with the next chapter added (added) |
| `error_404_chapter_not_found_preview.json` | 404 | POST /api/learn/runs/preview | commerce, pro | A chapter that is not there (preview) |
| `error_404_chapter_not_found_start.json` | 404 | POST /api/learn/runs | commerce, pro | A chapter that is not there (feed start) |
| `run_start_feed_aop_pro.json` | 200 | POST /api/learn/runs | commerce, pro | A 10-minute feed started from the For you cover |
| `keep_pro.json` | 200 | POST /api/learn/runs/:run/rate | commerce, pro | Keep on the feed's first card: it joins Revise as new |
| `answer_right_pro.json` | 200 | POST /api/learn/runs/:run/answer | commerce, pro | A right answer in the feed |
| `answer_wrong_pro.json` | 200 | POST /api/learn/runs/:run/answer | commerce, pro | A wrong answer in the feed: the line you needed and its card put back in |
| `run_get_feed_aop_pro.json` | 200 | GET /api/learn/runs/:run | commerce, pro | The feed read again (?run=): only the items not done, resumed { done, of } |
| `covers_accountancy_pro_open.json` | 200 | GET /api/learn/covers?subject=accountancy | commerce, pro | Covers with today's unfinished feed: resume and 'You stopped at' |
| `run_end_feed_aop_pro.json` | 200 | GET /api/learn/runs/:run/end | commerce, pro | The feed's end: done, the kept pile, lines, Another 10 minutes, next, dueOffer |
| `error_409_run_ended.json` | 409 | GET /api/learn/runs/:run | commerce, pro | The ended feed read again: RUN_ENDED with endHref |
| `error_404_run_not_found.json` | 404 | GET /api/learn/runs/:run | commerce, pro | A run that is not there |
| `run_start_mix_aop_resume_pro.json` | 200 | POST /api/learn/runs | commerce, pro | A mix start of Admission of a Partner picks up today's unfinished run |
| `run_start_mix_pf_pro.json` | 200 | POST /api/learn/runs | commerce, pro | A 10-minute mix of Basic Concepts: due and new cards, questions, open mistakes |
| `rate_missed_pro.json` | 200 | POST /api/learn/runs/:run/rate | commerce, pro | Missed: back later in this run (reinsert) |
| `rate_got_it_pro.json` | 200 | POST /api/learn/runs/:run/rate | commerce, pro | Got it: the card's return day |
| `rate_easy_pro.json` | 200 | POST /api/learn/runs/:run/rate | commerce, pro | Easy: the card's return day |
| `answer_mistake_fixed_pro.json` | 200 | POST /api/learn/runs/:run/answer | commerce, pro | An open mistake answered right: fixed, fixedText, the line collapsed |
| `run_end_mix_pf_pro.json` | 200 | GET /api/learn/runs/:run/end | commerce, pro | The mix's end: done, numbers, lines, the Revise pile, reviseCards, lead and options |
| `run_start_recap_pf_pro.json` | 200 | POST /api/learn/runs | commerce, pro | A quick recap of Basic Concepts (answers showing, nothing scheduled) |
| `run_start_cards_due_pro.json` | 200 | POST /api/learn/runs | commerce, pro | Revise these: the due suggestion's cards as a cards run |
| `subject_accountancy_free.json` | 200 | GET /api/learn/subject?subject=accountancy | commerce, free | Learn home on Free (freeNote) |
| `covers_accountancy_free.json` | 200 | GET /api/learn/covers?subject=accountancy | commerce, free | Covers on Free: 20 min composed as 10 (capped where it cuts) |
| `shelves_free.json` | 200 | GET /api/learn/shelves?subject=accountancy | commerce, free | Shelves on Free |
| `search_goodwill_free.json` | 200 | GET /api/learn/search?subject=accountancy&q=goodwill | commerce, free | Find on Free: locked cards |
| `cards_aop_all_free.json` | 200 | GET /api/learn/cards?chapter=accountancy.admission-of-partner&filter=all | commerce, free | Cards view on Free: locked rows and lockedCount |
| `cards_subject_due_free.json` | 200 | GET /api/learn/cards?subject=accountancy&filter=due | commerce, free | Find's due shelf on Free |
| `preview_aop_5_free.json` | 200 | POST /api/learn/runs/preview | commerce, free | Chapter page on Free at 5 min |
| `preview_aop_10_free.json` | 200 | POST /api/learn/runs/preview | commerce, free | Chapter page on Free at 10 min (freeSession not used) |
| `preview_aop_20_free.json` | 200 | POST /api/learn/runs/preview | commerce, free | Chapter page on Free at 20 min: composed at 10, capped |
| `run_start_feed_aop_free.json` | 200 | POST /api/learn/runs | commerce, free | A feed on Free (open cards only) |
| `keep_free.json` | 200 | POST /api/learn/runs/:run/rate | commerce, free | Keep on Free |
| `answer_free_claim.json` | 200 | POST /api/learn/runs/:run/answer | commerce, free | The first answered question on Free: it claims today's session |
| `error_402_free_session_used.json` | 402 | POST /api/learn/runs | commerce, free | A second feed on Free the same day: FREE_SESSION_USED with line, options and resume |
| `subject_accountancy_free_used.json` | 200 | GET /api/learn/subject?subject=accountancy | commerce, free | Learn home on Free after the day's session (free) |
| `covers_accountancy_free_used.json` | 200 | GET /api/learn/covers?subject=accountancy | commerce, free | Covers on Free after the day's session (free) |
| `preview_pf_10_free_used.json` | 200 | POST /api/learn/runs/preview | commerce, free | Chapter page on Free after the day's session: cards only, piles held |
| `run_start_mix_pf_free_cards_only.json` | 200 | POST /api/learn/runs | commerce, free | A mix on Free after the day's session: Key cards only (free) |
| `run_end_feed_aop_free.json` | 200 | GET /api/learn/runs/:run/end | commerce, free | The Free feed's end after the claim: free line, no Another 10 minutes |
| `subject_accountancy_new_pro.json` | 200 | GET /api/learn/subject?subject=accountancy | new, pro | Learn home for a new student (the feed suggestion) |
| `covers_accountancy_new_pro.json` | 200 | GET /api/learn/covers?subject=accountancy | new, pro | Covers for a new student |
| `shelves_new_pro.json` | 200 | GET /api/learn/shelves?subject=accountancy | new, pro | Shelves for a new student (all zero) |
| `preview_aop_10_new_pro.json` | 200 | POST /api/learn/runs/preview | new, pro | Chapter page on a first visit (firstVisit) |
| `run_start_feed_pf_new_pro.json` | 200 | POST /api/learn/runs | new, pro | A new student's first feed |
| `run_start_level_new_pro.json` | 200 | POST /api/learn/runs | new, pro | Find your level: questions from the first chapters |
| `run_start_mix_aop_20_new_pro.json` | 200 | POST /api/learn/runs | new, pro | A 20-minute mix with the chapter's lesson item |
| `subject_accountancy_new_free.json` | 200 | GET /api/learn/subject?subject=accountancy | new, free | Learn home for a new student on Free |
| `covers_accountancy_new_free.json` | 200 | GET /api/learn/covers?subject=accountancy | new, free | Covers for a new student on Free |
| `preview_aop_10_new_free.json` | 200 | POST /api/learn/runs/preview | new, free | Chapter page, first visit on Free |
