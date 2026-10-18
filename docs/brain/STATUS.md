## 18 October 2026, about 10:20 pm IST: website release 9 SHIPPED (main 2e45a92c), and the Mob is ON in production
- **Deploy:** main moved eb5185ef to 2e45a92c as a fast-forward. Vercel dpl_B8RemZJBcEvuc9CER6var7dFqr6Q is READY, aliased to www.mockmob.in, with 0 runtime errors in its first 20 minutes.
- **Vercel env:** MOB_ENABLED=true (Production) was set at about 10:15 pm, before the push. PERSISTENT_LIMITS_ENABLED was left unset on purpose; it is the owner's decision.
- **Smoke test (live):** /, /pricing, /today, /review, /mob, /join/<code> and /api/stats all return 200. /api/mob signed out returns 401 UNAUTHENTICATED (not the disabled error). /pricing says "1 credit a question".
- **Contents:**
  - Per-question practice credits (D65/C2): 5/10/15/20 questions cost 5/10/15/20 credits; a full mock costs 50; free allowances are unchanged; old builds keep attempt=10 and attempt_full=50.
  - The audit-fix packets: Today, Review/Result, nav and public.
  - The Mob (D66/C3).
- **Verification:** an independent Opus verifier ran 3 rounds with 2 fix rounds. Its final verdict: no HIGH, and 2 MEDIUM.
  - The join form showed a placeholder name and failed on the first Join tap. FIXED in 2e45a92c with tests.
  - W-044 (the Today cue is barely seen while scrolling at 390x844) is NOT claimed. The cue now sits in the page flow and never covers a control. W-044 stays OPEN for a decision.
  - Also fixed: the false line "You sat it in your other Mob".
- **Suites at 2e45a92c:** lint clean; test:mob 78/78; test:app 720/720; and at a14de0db: today 99, recovery 604 (+3 todo), learning 357, billing 215, auth 110, dock 31 (+1 skip), subjects 30. `next build --webpack` passes.
- **Production database: migrations applied today under the owner's standing grant.** Each had a pre-check, a post-check and a rolled-back dry run, and each has an undo file in supabase/undo.
  1. **20261018130000_free_ai_wallet_50**, about 3:47 pm.
     - The two AI wallet functions hash as the file; student_user_free reads 0.0284.
  2. **20261018170000_practice_credit_per_question**, about 6:22 pm.
     - spend_credits md5 went from 7decd1ff... (1535 chars) to 911105fd... (1666 chars); EXECUTE is granted only to postgres and service_role.
     - A rolled-back dry spend of 5+15+20+10+50 came to exactly 100, a replay was free, and 0 rows were left.
  3. **20261017100000_mob + 20261017190000_mob_fix_1017**, about 6:29 pm.
     - 26 functions have md5s equal to staging; 15 mob tables, all with RLS on; server roles only.
     - Undo runs in reverse order: the fix first, then the base.
- **Known open items (LOW):**
  - /mob?mob=<id> ignores the deep link to a second Mob.
  - "You both got the same question right" does not name the question.
  - W-044, described above.

## 18 October 2026 - ONE credits balance core (web/credits-core-1018; local, not pushed, not deployed; NOTHING applied to production; the migration IS applied on STAGING)

**Review fixes after the checker's round 1 (18 Oct, about 11:20 pm; commits 4431e42a and cdf2dcef over STOP POINT 6c23b11c, which was reviewed and kept).** The migration file changed, so the md5s in steps 4-6 below are superseded by the ones here.
- **(b) code and database ship together, guarded in code:** `oneBalanceLive()` (src/services/credits/aiWalletState.js) probes `public.mm_wallet_window` once (yes cached for the process, no cached one minute, any other error = old behaviour for that request). On a database without the migration the web keeps the OLD figures exactly (practice quote and /api/auth/me creditBalance = users.credit_balance, what the old spend_credits takes; AI wallet = free + bonus, what the old AI functions take). So the web may ship before the migration; the migration may NOT be undone while this code runs (undo order: code first).
- **(a) fields the live app reads, documented in src/services/credits/unifiedWallet.js:** one-balance database: /api/auth/me creditBalance and /api/ai/credits wallet.total = the one total, the amount any spend can take; old database: unchanged. /api/ai/context normalCreditBalance now stays users.credit_balance on both (the stop point had made it 0 on the old database). Ask Mobi's model gets one total with its parts and no second balance (creditsForModel.js).
- **(c) the per-user AI cap, decided:** only BOUGHT credits (ai_credit_wallets.bonus_credits; every Razorpay and Play pack is granted there) lift the owner's per-user cap, USD 0.02 per bought AI credit (`mm_bought_ai_credits_spent`, budget row `student_bought_credit`; the drafts' `mm_held_ai_credits_spent` / `student_held_credit` are dropped by the file). users.credit_balance credits are NOT bought: production holds 111,961 of them over 1,541 users (column default 100 = the signup grant, plus community rewards; no purchase ever went there). Under D78 they pay for AI like any credit, but under the owner's Rs 2.50 / Rs 5 cap, unchanged. Margin: production runtime_ai_requests (read-only): largest luna reservation USD 0.00237 (p99 0.00236, 9 rows), largest ever 0.002536, largest actual 0.00048; the largest the code can reserve is about 0.0045 a call, 2 calls a reply (MAX_PHYSICAL_CALLS), so 0.009. 0.02 covers that twice: a reply at the cap edge dispatches both calls, and so does the next one after a failed reply there (PGlite tests prove 0.005 and 0.01 fail those cases). Bought credits are spent before held ones, so a buyer is never refused by the cap while bought credits last.
- **Fixed in the stop point and kept:** mm_ai_reserve_credits records the wallet's synced period (a clock behind at a month edge can no longer turn free credits into bonus on release).
- **Checks (wt-credits-core at cdf2dcef):** eslint clean; test:billing 238/238 (now includes one_credits_balance 19 and one_balance_ship_together 4); test:learning 357/357; test:app 692 pass, 1 skipped, 0 fail; test:recovery 604 pass, 3 todo (known gaps), 0 fail.
- **Staging (onwkqxmjqjrhfbjjdydu), final file:** dry-run of the changed bodies in a DO block that raised (rolled back), then applied with apply_migration (`one_credits_balance_20261018210000_final`, then `one_credits_balance_20261018210000_bought_cap` = every statement of the final file, header comments trimmed; idempotent on an applied database). md5(prosrc) now EQUAL the file: spend_credits a2d71600fffe756b05443f4f4ca72967, mm_ai_consume_credits f43c5c1e8b3c2ef6acd93cc264c5e5d2, mm_ai_reserve_credits 01e87c89d18754a99d2b843ef23cad1d, mm_ai_release_credits 8313e28a7c5f1de0cde72b0772d450f8, reserve_runtime_ai 14e38c076490cc8f25f00570acd68786, mm_wallet_take ca977c2458db54d823908dc120ada860, mm_wallet_window c16763e69a3853d2a1a7d7853ae173f4, mm_bought_ai_credits_spent c728032bb35720b5c368518388e257e0; ACL postgres + service_role on all eight; runtime_ai_budget student_bought_credit 0.02, no student_held_credit row, no mm_held_ai_credits_spent.
- **Spend matrix on the final staging (rolled-back DO block, users dry1018c_*):** free 10 / bought 8 / held 20: a 5-set takes 5 free; a 10-set takes 5 free + 5 bought, parts {5,5,0}; its replay returns true with one row and no second debit; an AI reserve of 2 takes bought (bonusSpent 2), its replay is idempotent; a 5-set takes bought 1 + held 4; a full mock with 16 left returns false with nothing taken and no row; an AI reserve of 17 is refused, nothing taken; AI consume 1 from held, replay charges once (15 held left); bought AI credits this month = 2; at the cap: the student with bought spends dispatches two USD 0.0045 calls, a student with nothing is refused, a student with 100 held (signup) credits is refused by the cap and gets the reserved credit back (100). "MATRIX OK".
- **Undo dry-run on the final staging (the updated undo file, guard inline, DO block that raised):** the five bodies back to production exactly (consume c1ce92df, release 9c1d744b, reserve 499b44d1, reserve_runtime_ai f6026ff6, spend_credits 911105fd), ACL postgres + service_role, new functions left 0, budget rows left 0. Afterwards staging still holds the final migration (reserve_runtime_ai 14e38c07, 3 new functions, no dry rows).
- **Production (read-only, 11 pm):** the five functions still at the "before" md5s; mm_wallet_take / mm_wallet_window / mm_bought_ai_credits_spent absent; no parts / from_balance columns; no student_bought_credit row; 0 open AI reservations. Exact production steps: in the main session's notes for release 10.

**Owner (D78, 18 Oct 6:50 pm):** one credits balance for everything. Spend order: this month's free 50, then bought (ai_credit_wallets.bonus_credits), then held (users.credit_balance). 1 credit = 1 question or 1 Ask Mobi reply; a full mock 50. Database core in 5c553d3a (public.mm_wallet_take used by spend_credits and the AI reserve/consume; refunds per part; held credits raise the per-user AI cap; `src/services/credits/creditPacks.mjs`; PGlite tests `data/tests/one_credits_balance.test.mjs` 16/16; migration `supabase/migrations/20261018210000_one_credits_balance.sql`, undo `supabase/undo/20261018210000_one_credits_balance.undo.sql`).

**Web reads (11d0ef56, finishing STOP POINT 72d8550e, which was kept):** every balance read goes through `getUnifiedWallet` / `readAIWallet` (both read the wallet row and users.credit_balance together; either failing = unknown, never 0).
- `/api/auth/me` creditBalance = the one total (+ `credits` parts); `/api/practice/quote` prices against the one total; `/api/ai/credits` adds `credits`; `/api/me/review` aiCredits = practiceCredits = the one total.
- `/api/me/credits` adds `total {balance, freeLeft, freeAllowance, held, renewsOn, label}` (additive; practice.balance + ai.balance = total.balance, never counted twice) and each history line states the ONE balance after it, counted back across both ledgers; a line older than this IST month has no number (the free credits come back with no ledger row). The app contract fixture `contract_credits_v1.json` is unchanged.
- Account: one tile, one figure ("9 of your 50 free credits left this month; 50 more on 1 November. They are used first."), filters by kind (Practice / Ask Mobi and repairs). Top bar: ONE credits chip, opening the credits page. Ask Mobi's wallet line shows the total once anything is held.
- One name, "credits", in every student-facing line; sentences that claimed two separate balances rewritten (help answer, /pricing rows and Ask Mobi section, /pricing/ai-credits intro, /features, assistant knowledge). `PRACTICE_PRICE_LINE` = "1 credit a question. A 10-question set is 10, a full mock 50." The server contract labels in `src/lib/server/credits.js` stay ("Practice credits"/"AI credits", app parity).
- Fixtures regenerated: `data/tests/fixtures/review/expected.json` and `data/tests/fixtures/result_next_move/*.json` ("1 credit", "credits"). **The app copies under flutter_app/test/fixtures/{review,result_next_move} must be synced when the app takes the one balance.**
- `ai_cap_route_coverage`: a later migration may READ student_user_paid (reserve_runtime_ai); only an insert or update is a write. (This test failed at 5c553d3a.)

**Checks (worktree wt-credits-core):** eslint clean; test:billing 215/215; test:app 692/692; test:learning 357/357; test:recovery 604 pass, 3 todo, 0 fail; PGlite one_credits_balance 16/16; `next build --webpack` ok. Baseline at 5c553d3a: billing 215/215, app 686/686, learning 356 + 1 fail (the cap-coverage test above), recovery 604.

**Staging (onwkqxmjqjrhfbjjdydu), in order:**
1. **Compared with production (read-only pg_proc md5(prosrc)):** spend_credits equal (911105fda93f7c1dcd687b08dd7c1059). Staging DIFFERED on mm_ai_consume_credits c0b401769a58a563ccb7ee1879607a79 (no mid-month allowance sync; EXECUTE also granted to PUBLIC, anon, authenticated), mm_ai_reserve_credits 75c8ea15510925ca223c3f1061a82f96 (default allowance 10), mm_ai_release_credits 57047a2b5395072ec20c2e359f693a3c (CRLF + comments), reserve_runtime_ai 3df970caa84b7ec89a0344735cb52b29 (comments).
2. **Brought staging to production's bodies** (staging migration `staging_baseline_one_credits_prod_bodies`, bodies from the undo file, whose md5s equal production's) and production's grants on consume (service_role only). After: consume c1ce92df1577794e2e49a54d82a0fd42, reserve 499b44d19273c8901b11d65f0874e9fc, release 9c1d744b969d7e52c74d06e5537110f5, reserve_runtime_ai f6026ff6dde4b329e6f021dae3b51b7a, spend_credits 911105fd = production; ACL postgres + service_role on all five.
3. **Dry-run** (the whole migration plus the spend matrix inside one DO block that raises at the end): "DRYRUN OK (rolled back)". Afterwards mm_wallet_take/window/held absent, no parts column, no test users, spend_credits back to 911105fd.
4. **Applied for real** (staging migration `one_credits_balance_20261018210000`, the file body unchanged). md5(prosrc) now equal the repo file: spend_credits a2d71600fffe756b05443f4f4ca72967, mm_ai_consume_credits f43c5c1e8b3c2ef6acd93cc264c5e5d2, mm_ai_reserve_credits 0921e34189052ee6cd6ec6a3ab55f8e7, mm_ai_release_credits 8313e28a7c5f1de0cde72b0772d450f8, reserve_runtime_ai 69e3d0c2f4e48f3bce157df66aef3966, mm_wallet_take ca977c2458db54d823908dc120ada860, mm_wallet_window c16763e69a3853d2a1a7d7853ae173f4, mm_held_ai_credits_spent 15a785e33797d37c3202a37fb7620551; runtime_ai_budget student_held_credit 0.005; every function service_role only.
5. **Spend matrix on the applied staging** (test users dry1018_*, in a DO block that raises at the end, so they are rolled back). Free/bonus/held, u1 starting 50/30/100: a full mock 50 -> 0/30/100 parts {included 50}; an Ask Mobi reply (reserve 1) -> 0/29/100 (bonus); a 20-set -> 0/9/100; a 15-set -> 0/0/94 parts {bonus 9, balance 6}; AI consume 3 -> 0/0/91 (repeat idempotent); reserve 2 from held -> 0/0/89, release -> 0/0/91 (back to held), release the bonus reply -> 0/1/91 (back to bonus), repeat release idempotent; a repeated practice reference charges nothing; a full mock 50 across bonus 1 + held 49 -> 0/0/42; a student with no wallet row and nothing held: the free 50 pay one full mock, then a 5-set is refused with no row written, and a reply is refused; held AI credits spent this month = 3 (released ones excluded); per-user cap (staging student_user_free 0.0114): a student at the cap with no held spend is refused ("runtime user limit reached"), the one with 3 held credits spent dispatches; a new IST month: the free credits reset before the take -> 45/0/42. Result: "MATRIX OK".
6. **Undo dry-run** (the undo file, guard inline, in a DO block that raises at the end): md5s back to production exactly (consume c1ce92df, release 9c1d744b, reserve 499b44d1, reserve_runtime_ai f6026ff6, spend_credits 911105fd), new functions left 0, held row left 0, ACL postgres + service_role. Rolled back: staging still holds the applied migration (checked after).

**Not touched on staging (drift noted):** runtime_ai_budget caps (staging student_ai 25, student_user_free 0.0114, student_user_paid 0.1136 vs production 1000000 / 0.0284 / 0.0568), mm_ai_commit_credits, mm_ai_grant_bonus_credits, mm_ai_release_expired (bodies differ from production), runtime_ai_month_start (CRLF only), ai_credit_wallets column defaults (absent on staging).

**For the production step (release 10, not done here; superseded by the review-fixes block at the top of this entry for md5s and ship order):** pre-check the five md5s above equal production's "before" values; apply the migration; post-check the eight md5s; the undo is proven on staging. Code and database ship together (old code shows two numbers; new code on the old database shows the one total but AI cannot spend users.credit_balance). `public.mm_spend_credits_amount` (security definer, spends users.credit_balance only) has no caller (`src/services/credits/checkAndConsumeCredits.js` is unused); leave it or drop it in a later cleanup. For the D/E lanes: /pricing pack cards and PrepOSCreditPurchaseButton still describe the old 50/150/400 packs (renamed to "credits", prices unchanged); creditPacks.mjs is the catalog to point them at.

## 18 October 2026 - Web release 9 integrated (part A) (deploy/web-1018-r9, from live main 00328e54 = release 8; local, not pushed, not deployed; nothing applied to any database; the Mob packet web/r9-mob-1018 is NOT merged yet)

**Merged, --no-ff, in order:** web/r9-perq-1018 (dfc33d17), web/r9-today-1018 (106c8fb5), web/r9-review-1018 (0f5df84d), web/r9-nav-1018 (d88e7c5b), web/r9-public-1018 (77da5a35). Each STATUS section below is kept, newest packet on top of the older ones.

**Conflicts:** (1) `docs/brain/STATUS.md` in the today, review, nav and public merges: every section from every side kept. (2) public: `package.json` test:billing, test:auth and test:app lists: every test file from every side kept (practice_credit_per_question in test:billing, release9_nav and release9_public in test:app). /pricing and the landing merged without a conflict: perq's credit wording (`PRACTICE_PRICE_LINE`, "1 a question in Quick practice, 50 a Full mock") and public's one price framing ("Pro is ₹99 once, through 31 July 2027", "Your standing") both stand. (3) Semantic, not textual: release9_nav's plan-card test still asserted the old "Quick practice costs 10 practice credits" sentence; it now asserts perq's one price sentence.

**Leftovers fixed (test `data/tests/release9_integrate_1018.test.mjs`, in test:app):**
- Result's last link said "Open weak chapters" but opens /analytics, which is "Marks trend": it now says "See your marks trend".
- Practice at 1440 x 900: the session card's Start key sat at y=892 to 944 of 900 on first load and the price was stated about four times in the first fold. Now the price sits once on the mode tiles ("1 a question", "50 credits") plus the card's own Cost line; the line under the lede (`PRACTICE_PRICE_TAIL`), the card's "Your practice credits" row (the chip under the lede and the top bar already show it) and the amount in the "charged only after a complete set is built" note (`data/practice_quote.js`, now "You are charged only after a complete set is built.") are gone. Start is at y=810 to 862. No amount changed.
- Result said the key re-check three times: the notice under the score stays (with its jump); the "Answer keys we are re-checking" list (`KeyReviewLog`, no longer mounted) is gone from the Marks part; the ledger group "Under re-check or corrected" is now "Not sorted" (copy in `data/mistake_lab.copy.json`, fixtures contract_ready_v1 and contract_replay_v1 rebuilt, mistake_lab and result_parts tests updated). The marks arithmetic is unchanged. Still there, by design: each row's chip and the per-question notice, and the "(1 question under re-check left out of both)" footnote in Time and changes.
- Footer blurb: "tonight.The 15 subjects" had no space; fixed.

**Checks:** eslint src and data/tests clean; test:app 687 (686 pass, 1 skipped by design); test:today 99/99; test:recovery 607 (604 pass, 3 todo, 0 fail); test:learning 357/357; test:billing 202/202; test:auth 110/110; test:dock 32 (31 pass, 1 skipped by design, needs DOCK_BASE_URL); test:subjects 30/30; test:mob 45/45; `next build --webpack` ok (.next deleted). Visual: headless playwright-core on a dev server on 3250 (preview fixtures and public pages only, every non-GET aborted, stopped afterwards): Today, result, Review, Practice, the More sheet (390), /pricing, the landing (hero, Your standing plan, footer) at 390 and 1440, Night and Day; every screenshot opened: `mockmob-next/tmp/r9-integrate/`.

**Verifier fixes (after the first verify of part A; tests in practice_credit_per_question, release9_public, today_release8/9; no database touched, nothing pushed or deployed):**
- **MEDIUM, a free included set priced at "10 credits" (every surface now reads the allowance the way the quote does):** new pure `src/lib/dailySet.mjs` (states 'free' | 'priced' | 'unknown', `dailySetFromQuote`, `countHint`) and one shared, read-only, minute-cached read of `GET /api/practice/quote` for a Quick 10 (`src/lib/useDailySet.js`, `src/components/useMyDailySet.js`; forgotten when a set is launched). 'free' prints "Free: today's included set." (short "Free today") and no number or balance; 'unknown' (not read yet, read failed, quote blocked) prints no number ("Practice shows the price before it starts."); 'priced' (allowance off, or today's set used) prints the price as before. Surfaces: Practice count option for 10 (own Quick 10 quote first, else the shared read; unread shows no hint), Today's lead price line (moved to pure `src/lib/today/priceLine.mjs`; the lead also holds for the read, same 1.5 s cap), the Start sheet (`costLine`, hero and the Quick and By chapter rows), the result next move and Review (`nextMove`, `practiceCostLine`, new `chapterPracticeClause`, `reviewInput({dailySet})`), Review's empty state, Revise's empty state, Review's chapter row. 15, 20, a full mock and Pro never change; a caller that passes nothing keeps the shared fixture words ('priced'), so the app port and fixtures are unchanged. The Today reel builds the same move but renders no price, so it reads nothing. Production note: the allowance is off there today (0 rows in learning_allowances), so the quote says priced and "This set uses 10 practice credits" is still the true line until LEARNING_SESSIONS_ENABLED is on; with it on, every line says free. Seen (headless, preview fixtures, `?allowance=on`): Practice 390 Night and 1440 Day/Night ("Free today" under 10, Cost "Free: today's included set"), Today first week 1 and 3, the Start sheet at 390 Day and Night (hero and By chapter), the result (1440 Day, 390 Night), Review chapter row (1440 Night) and the empty Review (390, 1440), `inventory=down` (no number); without the flag they still say "10 credits" and "uses 10 practice credits". Screenshots: `tmp/r9-fixes/fixes2/`.
- **MEDIUM, /pricing FAQ said "Pro is ₹99 a month":** the non-monthly answer is now "Not yet. Today Pro is one payment of ₹99 for access through 31 July 2027, with no auto-renewal. A ₹99 monthly plan opens soon, and whoever pays now keeps the full term." (the FAQ JSON-LD reads the same string). Test: no "Pro is ₹N a month" outside a monthly branch.
- **LOW, credits modal:** a balance buys whole 5s (`quickQuestionsFor`: 37 credits = 35 questions); under 5 it says "Not enough for a 5-question set" with the title "Not enough practice credits" (0 stays "out of"); the label/value rows wrap instead of squeezing the label (390). Preview gained `?balance=N` for the free fixture user.
- **LOW, restart after the deploy:** `spendWithLegacyFallback` (data/practice_charge.js, used by the device-held start): on exactly "credit reference already used" for `attempt_5/10/15/20` it asks once with the legacy `attempt`; the reference then exists, so that call is recognised as the same spend (true) or refused again, never a second charge. Proved on PGlite with the real migration. The database function and its md5 are unchanged (the app-side option), so the deploy plan's md5s stand.
- **LOW, migration md5 on Windows checkouts:** `.gitattributes` now has `supabase/**/*.sql text eol=lf`; both files re-checked out as LF on disk: migration body md5 911105fda93f7c1dcd687b08dd7c1059 / 1666, undo 7decd1ff44f4456ed2552a9e19ed1157 / 1535 (test reads raw bytes). Other checkouts: `git checkout` the two files once after pulling the attribute, or apply from `git show HEAD:<path>`.
- **LOW, landing at 390:** the hero key steps down to secondary after the first sample answer at every width (was 960 px and up only); `DEMO_QUIET_QUERY` and the matchMedia gate are gone. Seen at 390 Day and Night after a real pointer tap on "Frank": Try five questions is secondary; the chosen chip and Next question are the lime in view.
- **Checks:** eslint src and data/tests clean; test:app 688 (687 pass, 1 skipped by design); test:billing 215/215; test:recovery 607 (604 pass, 3 todo, 0 fail); test:today 99/99; test:learning 357/357; test:auth 110/110; test:dock 32 (31 pass, 1 skipped by design); test:subjects 30/30; test:mob 45/45; `next build --webpack` ok (.next deleted). Dev server on 3261 (preview fixtures and public pages only, every non-GET aborted, 0 blocked), stopped afterwards.

## 18 October 2026 - Practice credits per question (branch web/r9-perq-1018, from live main 00328e54 = release 8; local, not pushed, not deployed; NOTHING applied to production, the migration IS applied on staging)

**Owner, 18 Oct about 4 pm (D65):** "5, 10, 15, 20, like as many questions, that many credits." On Free, Quick practice costs 1 practice credit a question: 5 = 5, 10 = 10, 15 = 15, 20 = 20. A full mock stays 50. Unchanged: Pro pays nothing; today's included 10-question set, the first set per subject (baseline), the full sample, the free 5-question recovery set, Mob papers; the starting 100; AI credits.

- **One helper** (`data/test_modes.js`): `practiceCreditCost(modeId, count)` and `practiceCreditAction(modeId, count)` (quick -> `attempt_<n>` for 5/10/15/20, full -> `attempt_full`, Pro modes 0/null, any other count null; the start paths already resolve a stray count to the 10-question default). Quick has `creditPerQuestion: 1` and no flat `creditCost`. Used by the quote (`practice_quote.js`), the charge (`practiceSessions.js`), recovery (`recoverySessions.js`), `db.spendCredits` whitelist, the dashboard, Today's price line, the Start model (`costLine(mode, {count})`), the credits modal, the result page's next move.
- **Database (the only place a spend is priced):** `public.spend_credits` maps `attempt_5/10/15/20` to 5/10/15/20; `attempt` stays 10, `attempt_full` 50, `generate` 10. `start_learning_session` and `start_recovery_session` only pass the action through, untouched. No refund or cancel path exists for practice spends (read the repo and production), so nothing needs to refund a different amount.
- **Migration (NOT applied on production):** `supabase/migrations/20261018170000_practice_credit_per_question.sql`, undo `supabase/undo/20261018170000_practice_credit_per_question.undo.sql`. Production before (read-only, 18 Oct): md5(prosrc) 7decd1ff44f4456ed2552a9e19ed1157, length 1535. After: 911105fda93f7c1dcd687b08dd7c1059, length 1666, proconfig search_path=public, pg_temp. The undo restores production's exact body (proved on PGlite: md5 and length equal).
- **Staging (onwkqxmjqjrhfbjjdydu):** dry run in a DO block that raised (rolled back; balance 390 afterwards, no leftover rows): spends 5, 10, 15, 20, full 50, old attempt 10, generate 10; attempt_7 refused; a retry charged once; a different action on one reference refused. Then applied for real; md5 911105fd..., length 1666. Staging's function differed from production before (md5 8ac89ba7..., no search_path, CRLF); it now equals what production will have after.
- **Copy:** one sentence from `src/lib/creditCopy.mjs` (`PRACTICE_PRICE_LINE`): "Practice credits: 1 a question. A 10-question set is 10, a full mock 50." Used in /pricing notes, plan terms and the comparison row ("1 credit a question"), Account > Plan, the help answer, the pricing FAQ; the dashboard header line and the Quick tile ("1 a question"); each count option shows its own cost (5, 10, 15, 20 credits; none on Pro); the credits modal ("1 practice credit a question", "N questions" left). The landing, /features and /pricing/ai-credits state no practice price, so they are unchanged.
- **Tests:** new `data/tests/practice_credit_per_question.test.mjs` (22, in test:billing; PGlite with the real migrations 0036 and later, the migration, the undo). Updated paper_copy and startModel tests. lint clean; test:app 653; test:today 87; test:recovery 586 pass, 3 todo; test:learning 357; test:billing 183; test:auth 110; test:subjects 30; test:mob 45; `next build --webpack` ok (.next deleted).
- **Visual:** headless playwright-core on a staging-keyed dev server on 3230 (stopped afterwards), preview fixtures; opened and checked dashboard 390 Night, 1440 Day and Night (count options with costs, cost line "15 practice credits", bar "15 min, 15 credits"), /pricing 1440 Day and 390 Night; text of /pricing and Help read at 390 and 1440, Night and Day. The Start sheet does not open in the preview, so its rows are covered by tests only; Today's preview shows the Revise lead (Free, no credits), so its set line is covered by tests only.
- **Known, not changed (fixed afterwards, see the release 9 verifier fixes):** Today and the Start sheet name a 10-question set as "uses 10 practice credits" even when today's included set is free (same as before). Old app builds keep sending `attempt` (10), which still works.
- **Deploy order:** apply the migration on production first (backward compatible: old code still sends `attempt`/`attempt_full`), then the code. Roll back = code first, then the undo.

## 18 October 2026 - Web release 9, Today packet (web/r9-today-1018, from live main 00328e54 = release 8; local, not pushed, not deployed; no data written)

Refinements only; nothing cut. Proof screenshots (headless playwright-core, own temp profile, dev preview fixtures on localhost:3241, every one opened): `mockmob-next/tmp/r9-fixes/today/`.

- **D28 (MEDIUM, greeting flash):** the hour and the date come only from the client (`useSyncExternalStore(..., () => null)`); new `greetingAt()` returns null for an unknown hour; both head lines keep their height and fade in (180 ms). The SSR HTML of `/preview/arena?view=today` holds no greeting (`ssr-preview-today.html`: h1 has only a screen-reader "Today"). At a fixed 2:41 am IST it reads "Hello" (`g-241am-m-dark.png`). Test: today_release9 D28 x2.
- **W-042 (lead before the glance column):** the lead also holds for the rhythm, road, goal and insights reads, under the same 1.5 s cap (`holdForPage`); skeleton heights now match the landed blocks (lead 600/540, week 255, road readout 240). Measured, polled every 30 ms: lead, This week, Road and Weak chapters land on the same tick at 390 and 1440 (was 240-400 ms apart). Test: today_release9 W-042.
- **W-044 (cue behind the dock):** the cue is a sticky pill 8 px above the dock's safe area (`bottom: calc(84px + env(safe-area-inset-bottom))`, 16 px from 1024 px). Without the fixture bar at scroll 0: 390x844 cue 716-760 vs dock 768-832; 390x932 cue 796-840 vs dock 856-920. Real pointer tap scrolls the week to the top and the cue fades (`cue-nobar-m-*.png`, `cue-nobar-m2-dark.png`, `cue-after-tap-m-dark.png`). Test: the cue offset equals dock bottom + height + 8 read from arena.css.
- **D27 nits:** Road's selected stop is a 2 px ink underline, no raised tile (`today-d-dark-full.png`); "Today already counts toward your week" is only in This week, Road says what is left ("Left: 5 Revise questions."); Road's This week prints This week's own count via `weekDays()` ("4 of 4 study days", the mock on its own line "and 1 of 1 full mock"; `fw7-m-dark-full.png`); the returning card's link is now "See all 6 mistakes" in the footer beside More ways to practise, "Why this?" alone in the reason (`returning-d-light.png`). Tests: today_release9 D27 x4.
- **F18 (path not readable, check day mislabelled):** the rail has day numbers under the marks and one line naming today's step and the next ("Tomorrow: A second subject.", "The last step of your first week."); the overline says "Day N of your first week" only when the card shows the day's step (`pathLeads`), else "Up next" with "Day 3 of 7: Weak chapters next." (`fw3-d-light.png`, `fw3check-m-light.png`, `fw7-d-light.png`). Tests: today_release9 F18 x2.
- **LOW (Why this? restated the card, counts disagreed with the chip):** `todayContext({ move, revise })` sends the reason, the move's chapter and which mistakes come back (Revise chapters, only when they add up to the card's count); the plan's fact lines are no longer sent. `todayAnswer()` builds the opening from the panel's own insights read (same as the "Your record" chip): wrong and blank of N over S sessions, the last miss date, the marks at stake of the record's open marks. Real pointer click (`whythis-d-dark.png`, `whythis-m-dark-fw3.png`). Tests: today_release9 x2, ask_mobi_entries and ask_mobi_panel updated.

**Files:** `src/app/(app)/today/page.jsx`; `src/components/today/{TodayMove,TodayRoad,TodayWeek,useToday}.jsx|js`, `today.css`; `src/lib/today/{firstWeek,greeting,move,week}.mjs`; `src/components/ai/askContexts.mjs` (Today part) and `src/components/ai/askSuggestions.mjs` (the today branch of `openingFor` only, outside the packet's list); `package.json` (test:today adds today_release9); tests: new `data/tests/today_release9.test.mjs`, updated wiring asserts in today_1017, today_release7, today_release8, ask_mobi_entries, ask_mobi_panel.

**Checks:** eslint src and data/tests clean; test:today 99/99; test:app 653/653; test:recovery 586 pass, 3 todo (known gaps, unchanged), 0 fail; test:learning 357/357; `next build --webpack` ok (.next deleted). Not measured: real-account timing on production (needs a signed-in production walk).

## 18 October 2026 - Web release 9, packet "review": result, Review and the reel (branch web/r9-review-1018, from live main 00328e54 = release 8; local, not pushed, not deployed; nothing written to any database)

**Items and proof** (screenshots in mockmob-next/tmp/r9-fixes/review/, 390 x 844 and 1440 x 900, Night and Day, real pointer clicks, 0 non-GET /api requests on every click):
- **D18 / LOST-X-OF-Y (HIGH):** `chapterRows()` never prints "lost X of Y" with X > Y. Every question wrong now reads "Lost 35 marks, 6 questions in Mock 3 and Mock 2. 5 wrong, 1 left blank." and the bar is full (share clamped to 1); lost == offer keeps "of N"; offer unknown says the marks alone. Test: release9_review_1018 (every-wrong, lost == offer, lost < offer, offer unknown, and a sweep of every wrong/blank mix to 8 questions). Seen: review-allwrong-1440-night.png, review-allwrong-390-day.png, review-allwrong-390-night.png, review-allwrong-1440-day.png (preview ?review=allwrong).
- **D15 counts that agree (HIGH):** the finding under the score is scoped to its chapter: "In Share Capital: 4 wrong and 1 left blank of its 6 questions." (and "In X: 1 right of its 10 questions, 6 wrong and 3 left blank."). Same sentence in the reel (it reads finding.detail) and Today's reel. "After this mock" prints once: the in-part SwotPanel no longer carries a second (screen-reader-only) title. The shared fixtures data/tests/fixtures/result_next_move/*.json carry the new sentence, so the app port must take the same words. Seen: result-hero-1440-day.png, hero-idle-390-night.png, reel-chapter-390-light.png.
- **F11 nothing shown twice (MEDIUM):** an opened Review mistake shows its stem once (the sheet leaves it out when the row prints the same words; a cut-short row stem keeps the full question in the sheet) and one Repair entry: the row's Repair goes while its sheet is open, the sheet's own "Repair Q42, 1 AI credit" stays (the audit's suggestion to hide the inner key would have left no paid path under W-032). ".:" join removed (cleanStem). Seen: review-open-390-light.png, review-open-390-dark.png, review-open-1440-dark.png, review-open-1440-light.png, review-answer-1440-dark.png.
- **LOW ledger:** "Where your marks went" no longer waits on a 14 px bar at threshold 1. IntersectionObserver cannot see a jump past the bar (no threshold crossed), so the panel asks on mount, scroll and resize: any part in view plays the split, a bar already above the viewport shows the final state, a closed part waits. Walked: jump past the bar gives data-split still and opacity 1 (was armed, opacity 0). Seen: ledger-past-bar-1440-dark.png, ledger-past-bar-390-light.png, ledger-scrolled-in-390-dark.png.
- **LOW reel:** the sheet lights without pauses, then the moments play by the clock (33:54, 48:56, 51:01; was 48:56, 51:01, 33:54); a ring is only on a listed moment; the chapter rings (Q12, 17, 22, 42, 47) carry "Ringed: 5 questions in Share Capital that lost marks." Seen: reel-moment-390-light.png, reel-chapter-1440-dark.png, reel-end-390-dark.png.
- **LOW hero Mobi:** rest renders as the wide-eyed idle on the web hero (src/components/result/heroAct.mjs); proud (happy eyes, sparkles) and encouraging render. Preview gained ?tone=first_mock|higher|lower|held. Seen: mobi-idle-zoom.png, mobi-first_mock-act.png, mobi-lower-act.png (before: hero-rest-390-night.png).
- **LOW fixtures:** previewReview saved repair says key B everywhere (was B then option C); previewFixtures fixtureAttempt completedAt is 25 minutes before now, so ?view=result&earned=one shows the Badge earned row (verified).

**Files outside the packet list (smallest change):** data/replay.js (reelScript order), data/result_next_move.mjs (costliestLine sentence), data/tests/fixtures/result_next_move/*.json, data/tests/replay_reel.test.mjs, data/tests/result_next_move.test.mjs and retry_first.test.mjs (one assertion each updated for the new code), src/app/preview/arena/ArenaPreviewClient.jsx (?tone= and saved-repair dates relative to the paper), package.json (release9 test wired into test:recovery).
**For the app port:** review_chapters.dart (lost > offer wording), the costliest sentence and the reel order should take the same words from the shared fixtures.

## 18 October 2026 - Website release 9, fix packet "nav" (branch web/r9-nav-1018, from live main 00328e54 = release 8; local, not pushed, not deployed; nothing applied to any database)

**Scope:** navigation, Practice, the runner, Colleges, Progress and the global chrome, from the read-only audit of release 8 (tmp/ledger-audit-1018/results.json) and the CEO decisions. Practice credit amounts and credit copy are untouched (the per-question agent owns them) and the Mob entry is not added here (the Mob agent does). Screenshots (390 x 844 and 1440 x 900, Night and Day, real pointer clicks where interaction is the fix): tmp/r9-fixes/nav/.

| Item | What changed | Proof |
|---|---|---|
| D11 + N17 | "Help" is "Guide" as a nav label (sidebar Account group, phone More sheet) and the page is "Guide and questions" (route stays /help; tab title and top bar follow). "Show me around" (the tour) is the first row of the More sheet card and a row under the sidebar Account group; both start the tour. The tour's last stop is named Guide. | more-390-night/day.png, sidebar-1440-night.png, guide-page-1440-night.png, tour-from-more-390-night.png, tour-from-sidebar-1440-night.png; release9_nav_1018 tests |
| Marks trend | /analytics nav label "Weak chapters" is "Marks trend" (sidebar, More sheet, assistant feature guide, the Colleges bridge link now says "See the chapters to work on in Review" and goes to /review). One line in the sheet column at 390 (row 48 px high, label 22.5 px). | more-390-night.png |
| D6 | The More-sheet Ask Mobi row is above the theme control (its own row under the account card, like Learn's row below it); Planning no longer lists it again; the sidebar keeps it in Planning. | more-390-night/day.png |
| W-075 / new MEDIUM | Colleges: signed in, "Go to Practice" is outlined (and "Open my chapter review" is quiet text, now pointing at /review); signed out the sticky "View courses" steps back while the page's closing lime key is on screen. The scan (data/tests/helpers/voltScan.mjs) found 2 keys on release 8 at 390 and 1440 and finds at most 1 now at every 100 px of scroll, 390 and 1440, Night and Day. | colleges-bottom-390-night.png, colleges-bottom-1440-day.png, scan-volt.mjs output; browser test in release9_nav_1018 (MM_PREVIEW_BASE) |
| New LOW (Practice bar + dock key) | pagePrimary.mjs: the dock key goes quiet at once when any of the page key shows (SHOW_AT 0.05, HIDE_AT 0.02; no settle on the way in), and a second thin observer watches the strip of page under the dock capsule, where a key rising from the bottom edge first peeks out. Only the return to lime waits the settle time. 20 px wheel steps through 480 to 960 px and back at 390: 0 frames with two lime keys in Night and Day (release 8: 2). | scan-practice-band.mjs; dock_primary_quiet tests (24) |
| W-079 | 44 px: Practice "Edit fine-tune" (54 x 44), chapter picker "Whole unit" (68 x 44), runner legend buttons (262 x 44), "Go to question" and Undo, Start sheet arrows (the hidden arrow no longer sits at 0.82 scale = 36 px; the disc is 44). | measured in shots3/4/5 scripts |
| New LOW | Runner notice reads "Saved on this device. Stay online to submit." ("Bank in review" is gone). | runner-1440-night.png, runner-390-day.png |
| N6 | The subject-cap note: "That is the CUET UG 2026 limit: five papers in all (a language or the General Test counts as one)." One sentence, built from CUET_RULE_CYCLE. | onboarding-subjects-390-night.png |
| D8 / New LOW | Ask Mobi row and the AI-credit chip: Orbit (read as a "not allowed" sign) is replaced by a sparkle, the Lucide Sparkles for the row and the same four-point sparkle inside the coin for the chip. | icons-topbar-night.png (3x), icons-sidebar-planning-day.png (3x) |
| New LOW | PlanCard: the "Free" / "Pro" pill is quiet meta text (there is one pill in PlanCard, not two; the other pr-badge is the Contribute submissions list on Practice, off while Contribute is off, outside this packet). | account-plan-1440-night.png |
| New LOW | Progress at 1440: earned badges appear in the shelf only; the four path lists keep next, locked and unknown rows and the header counts ("3 of 5"); a path with every badge earned says "All N earned". The phone's All badges sheet still lists everything. | progress-badges-1440-night/day.png (earned rows in lists: 0, shelf 6) |
| D7 | Night: an earned medal is a charcoal disc with a thin lime ring and a lime glyph (wash and line tokens, no fill, no glow); medal art unchanged; Day keeps the solid medal. | progress-badges-390-night.png, progress-badges-1440-night.png |

**Not changed on purpose (outside the packet):** the result page's "Open weak chapters" link still goes to /analytics under that old name (result files); the public footer still says Help; Account's "Help" section heading; Today's "Weak chapters" heading and the first-week step name; the Practice card's Start key at y=884 on a 1440 x 900 first load (audit LOW, not in this packet).

**Checks:** lint clean on every changed file; test:app 668 (667 pass, 1 skipped by design: the browser walk needs MM_PREVIEW_BASE); test:dock 32 (31 pass, 1 skipped by design); test:today 87; test:subjects 30; test:du 42; test:recovery 589 (586 pass, 3 todo); test:learning 357; test:billing 161; test:auth 110; test:nta 188; release9_nav_1018 run against a preview server (MM_PREVIEW_BASE=http://localhost:3243): 15 of 15 pass, including the one-lime scan at every 150 px of scroll on Colleges and Practice (390 and 1440, Night and Day). The scan found 2 lime keys on release 8's CutoffCalculator and finds 1 now. `next build --webpack` passes (exit 0; .next deleted after).

## 18 October 2026 - Website release 9, packet "public" (web/r9-public-1018, from live main 00328e54 = release 8; local, not pushed, not deployed; no database step)

Commits 706b1fe9, 164d26e3. Proof: data/tests/release9_public_1018.test.mjs (16 tests, in test:app and test:billing) and the headless walk in mockmob-next/tmp/r9-fixes/public (390 x 844 first, then 1440 x 900, Night and Day, reduced motion; real pointer on the sample answer and the footer Help; walk-*.json hold the read values).

- **MEDIUM truth, /pricing/ai-credits:** the closed branch now says "New top-ups are paused for now. Your monthly credits work, and credits you bought are kept." Replies are tied to runtimeAi, top-ups to aiCommerce (aiCreditsCopy.mjs); rules checked, none said replies. Proof: test "never says written replies are paused"; ai-credits-390-day.png, walk-pages.json pausedReplies false at 390/1440 Night/Day.
- **MEDIUM truth, onboarding step 1:** "...one live question bank: no cap on Pro, and on Free each one uses practice credits." Proof: test; onboarding-390-day-subjects-v2.png.
- **M-006, bolder onboarding:** "Your papers. Your mocks." / "Your papers, your call." / "How many days a week can you give?" / "Which colleges are you chasing?" with matching leads, all facts unchanged (5 subjects, 8 colleges, Skip = 4 days). Copy lives in paperCopy ONBOARDING_STEPS. Proof: test; onboarding-*-v2.png, onboarding-*-days.png, onboarding-*-colleges.png.
- **MEDIUM, landing "leaderboard" x3:** now "Your standing", "Benchmarks and your standing", "...toward your standing", "See your standing" (route /leaderboard unchanged). **LOW:** "The mob speaks." -> "Students, in their own words."; ArenaPreview "Students solved it in". Proof: tests.
- **MEDIUM (CEO decision), price framing:** checkout today charges pro_cuet_2027, Rs 99 once, access to 31 July 2027, no renewal (create-order + plans.js; monthly opens only with RAZORPAY_PLAN_ID_PRO_MONTHLY_99, unset). The /pricing H1 ("Pro is Rs 99 once, through 31 July 2027."), the Pro tag ("Rs 99 once"), the page title and the landing trust row now read priceHeadline / priceTag / priceLine (src/lib/payments/offer.js), so they switch together to "a month" when monthly opens. No price or plan changed. Proof: tests; pricing-390-night.png, pricing-1440-day-plans.png.
- **LOW, two lime keys after a sample answer:** at 960 px and up the hero key steps down to secondary after the first answer (demoSignal.mjs; phones keep it). Proof: walk-landing.json limeAfter = answer chip + "Next question" only; landing-1440-night-after-answer.png, landing-1440-day-after-answer.png.
- **LOW, tour chips clipped at 1440:** from 900 px the row wraps with no mask and tighter chips (all 9 in one row at 1440, none clipped); below 900 it snaps and fades 48 px. Proof: walk-landing.json tourChips clipped []; landing-1440-night-tour.png, landing-390-day-tour.png.
- **LOW, aurora wash (L-019):** .lp-bg__aurora removed from the hero and the close, with its rules and parallax; grid and dots kept. Proof: test; close-1440-night.png, close-390-day.png.
- **LOW (L-013), footer Help:** guests go to /#faq (the landing's public questions, scroll margin + HashSettle so it lands from any page), signed-in students to /help (FooterHelpLink). Proof: walk-help.json (8 real clicks, URL /#faq, heading under the nav); help-night-390-from_pricing.png.
- **LOW, auth repeats:** login card says how you get in ("Use Google, or get a one-time code by email. No password to remember."); signup card "Free to start. No card needed."; "stay signed in" once per page. Proof: test; login-1440-night.png, signup-390-day.png.

**Files outside the packet list (smallest change):** src/lib/payments/offer.js (two new helpers), src/components/ui/SignupCard.jsx (the auth card copy), src/components/LandingActions.jsx, src/app/home-refinements.css and src/app/marketing-theme.css (aurora rules), data/tests/billing_pay_gate_copy.test.mjs and pricing_copy_1017.test.mjs (old assertions for "a month" H1 and the old onboarding lead), package.json (test wiring).

**Checks:** lint clean; test:app 669; test:billing 177; test:subjects 30; test:auth 110; test:learning 357; test:today 87; test:recovery 586 pass, 3 todo; `next build --webpack` ok (.next deleted).

## 18 October 2026 - The Mob merged onto release 8 and gated on staging 10/10 (branch web/r9-mob-1018, from live main 00328e54; local, not pushed, not deployed; NOTHING applied to production)

**Merge:** web/mob-fix-1017 (e89d4a35: Mob web code, gate fixes 1 to 5, migration 20261017190000_mob_fix_1017 + undo) into release 8. Conflicts resolved by intent, every release 3-8 change and every Mob fix kept: package.json (test:app, test:mob list all six Mob suites: mob, mob_plans, mob_ui, mob_fix_1017, mob_render_size, mob_gate_1018), mob.css (both blocks), Practice (the release 8 PracticeMobChip stays; the old MobEntry row is dropped, it would have doubled it), Today (the release 8 TodayMob row stays; MobEntry stays only as the one-time invitation for a student in no Mob, with a new inviteOnly prop, so a member sees one Mob row, not two), Progress (MobTodayCard stays), Review (the Review page was rebuilt, so the Mob row now sits under Also in Review in ReviewChapters as a matching row). The nav item, the tour step and the page title now say Mob (not Your Mob). mob_fix_1017.test.mjs asserts the new wiring and that inviteOnly stays quiet for a member (a first draft of that guard had silently not applied; the gate caught the double row on Today and it is fixed and locked by the test).

**Staging database:** compared, not guessed. All 26 Mob and rate-limit functions have the same md5 of their body as the two repo migrations; all Mob tables have RLS on and no anon or authenticated grant; mobs.created_by, mob_members.share_moved_1017, show_score default true, mob_departures, mob_data_moves all there. Nothing needed applying. Staging Mob data and persistent_rate_limits were truncated before the run (test data only).

**The gate, on staging (Supabase onwkqxmjqjrhfbjjdydu), local server from this worktree through the staging launcher on port 3231 with MOB_ENABLED=true and PERSISTENT_LIMITS_ENABLED=true, test accounts mobtest-* only, headless playwright-core, two separate browser contexts:**
1. Plans and caps: Free starts one (MOB_LIMIT), Pro starts 3 and the 4th is MOB_LIMIT_PRO before the weekly create wait, four failed starts never use the weekly limit, the 4th start in a week is 429 with the real date in the sentence.
2. Invite, join, full, rejoin: 5 members, a 6th is MOB_FULL (join and lookup), eleven wrong codes still leave a real join through, leave, a spent link says expired and a new link fills the seat, rejoin.
3. The weekly paper: same 10 questions in the same order and options in both runners, clock 10:00, no credits charged (balances equal before, during, after, also after leave and rejoin), a second start is PAPER_ALREADY_SAT, the free claim outlives the membership across Mobs.
4. Side-by-side: free teaser, one free sample, trap only after the sample or Pro, sharing on by default and the opt-out hides score and picks, Pro full, extras (3 a week, free members sit them), history.
5. Nudges, reports, blocks, owner handover, remove (only the owner), removal is not a block.
6. Rate limits: create and join count successes only, invites 5 a day, reports 10 a day, reads 120 in 10 minutes, each 429 with Retry-After and the real wait.
7. Crafted requests: signed out 401, 4 KB body cap, non-boolean flag, no price in a body, no user id or email in any view, comparison or public lookup, PostgREST direct reads and rpc refused.
8. Screens at 390 x 844 and 1440 x 900, Night and Day: no Mob, start, create-limit error, invite dialog, join page (signed out, signed in, bad, full, paused), one member, waiting, all sat, shared and opted out, the trap, free sample, Pro full, extras dialog, member menu, report, remove, block, name, leave dialogs, error, loading, the two-context end to end (18 UI checks).
9. Entry points: sidebar and More sheet say Mob, Today row, Practice chip, Review row, Progress card, result row, privacy section.
10. Flag off and kill switch: with MOB_ENABLED unset every /mob and /join page and every /api/mob route is a real 404, no Mob link or word on Today, Practice, Review or Progress at 390 and 1440 in both themes, no request to /api/mob (33 checks); with MOB_INVITES_ENABLED=false invites and joins answer 503, members keep their Mob.
Counts: API gate 98 of 98, end to end 18 of 18, flag-off 33 of 33, kill switch 7 of 7 (one of them re-run with a fresh account because a daily invite limit had been used up on the first). Screenshots (opened): tmp/mob-gate-1018b (not committed).

**Suites:** lint clean; test:mob 71; test:app 679; test:today 87; test:recovery 586 pass, 3 todo; test:learning 357; test:auth 110; test:billing 161; next build --webpack ok (.next removed).

**App (wt-v15, read only):** every route, method, body and reply field in mob_repository.dart, mob_paper.dart and mob_models.dart matches the merged web API; the 9 JSON fixtures are byte-identical to data/tests/fixtures/mob; all 48 server error codes are known to the app. Only ALREADY_IN_MOB is unused (the server answers a view for a link to a Mob you are in).

**Findings (none blocks switch-on):** timer is re-issued from now when a started paper is reopened before submitting (same as ordinary practice); the runner heading for a Mob paper says Quick practice; a link has as many uses as seats when it was made, so after a leave it is spent and the owner makes a new one; the leave dialog says sittings leave with you, true at that moment, but a rejoin credits the saved result again (so no second paper); the web page ignores ?mob= (the switcher is not in the URL); the no-Mob line on the result page from SOCIAL-SPEC section 9 is not built; the Today invitation is covered by tests, not walked in a browser.

**Production plan (main session applies):** migrations 20261017100000_mob.sql then 20261017190000_mob_fix_1017.sql (production has no mob tables, persistent_rate_limits and take_rate_limit exist, users.id is text); env MOB_ENABLED=true, PERSISTENT_LIMITS_ENABLED=true (production has neither; without it the weekly create limit is per instance), optionally MOB_ID_SECRET; then redeploy. Undo: unset MOB_ENABLED and redeploy; schema undo files are in supabase/undo.

## 18 October 2026, about 4:05 pm IST - Website release 8 shipped (main 00328e54) and production migration 20261018130000_free_ai_wallet_50 applied (owner: "Ship it", about 3:55 pm)

**Order:** the migration first, under the owner's standing production grant, then the code (the code is backward compatible with the old database; "50 on Free" is true only with both).

**Migration on production (isrxrxzjocewrdureyhp), about 3:57 pm:**
- **Pre-check:** `runtime_ai_budget.student_user_free` = 0.0114; `md5(prosrc)` of `mm_ai_consume_credits` c0b40176... and `mm_ai_reserve_credits` 75c8ea15... equal the bodies in `supabase/undo/20261018130000_free_ai_wallet_50.undo.sql` (LF endings).
- **Applied:** `apply_migration free_ai_wallet_50`, the file's SQL unchanged.
- **Post-check:** the two bodies hash c1ce92df... and 499b44d1..., equal to the migration file's; `student_user_free` = 0.0284; the global `student_ai` row is untouched (1000000).
- **Dry spend (in a DO block that raises, so everything rolled back):** a real Free wallet stored at 10 (4 used, a May period) read 50 left at amount 0, then 49 after consuming 1, then 47 after reserving 2. Afterwards: 0 ledger rows and 0 reservations with the dry-run keys; 811 wallets still store 10 and sync to 50 on their next spend.
- **Undo:** `supabase/undo/20261018130000_free_ai_wallet_50.undo.sql` (roll the code back first).

**Code:** `git push origin 00328e54:refs/heads/main`, a fast-forward from fc9e1f6b (release 7). Contents are in the "Web release 8 integrated" entry below: W-078, W-075, W-079, W-093, W-089, W-064 (first-week path, repair receipt), W-032 (sealed mistake rows, Try it again before the key), the D38 landing hero, D53 (the quiet AI line), D54 (Free AI wallet 50), plus the post-verify fixes (desktop hero Mobi flash, Review Repair through the sealed sheet, Lab Cinema glow removed L-019, hero buttons at 761-899 px L-013). The independent re-verify said GO; the owner had the live preview from about 2:30 pm.

**Deploy:** Vercel dpl_3THyGFBktbdxcAuwhfN2sLNsHmrT READY at about 4 pm, aliased to www.mockmob.in. Runtime errors in the 20 minutes after: none. Smoke: /, /pricing, /pricing/ai-credits, /features, /today, /review, /help, /api/stats 200; an unknown path 404 (themed). Live /pricing reads "50 a month on Free"; no "10 AI credits" left.

## 18 October 2026, about 1:10 pm IST - Website release 7 shipped (main fc9e1f6b): the new Today, Road to CUET, the Change plan receipt fixes

**What:** deploy/web-1018-r7 (contents and conflict notes in "Web release 7 integrated" below), plus the verifier fix round for H1 (the Change plan receipt seeded a stale mock target), M1-M3, M5-M7, L4 and L5. The owner approved the new Today at 8:40 am ("the today page is better now").

**Checks:** independent verifier GO after the fix round. Vercel dpl_FYgR76nTTSeX5uV4ShJed1u1Rq5A READY, 0 runtime errors at 1:20 pm. Nothing was applied to any database.

## 18 October 2026 - Web release 8 integrated (deploy/web-1018-r8, from live main fc9e1f6b = release 7; local, not pushed, not deployed; nothing applied to any database)

**Merged, --no-ff, in order:** web/r8-fixes-1018 (cb672f6b), web/r8-adopt-1018 (dfc6797e), web/r8-retry-1018 (f9fa1d82), web/land3-1018 (42b51dd3), web/credits50-1018 (d8bc38d8). Every R7 fix is kept.

**Conflicts:** (1) adopt: `package.json` test:today lists both the R7 fixes test and the first-week tests; `today/page.jsx` imports keep R7 keepLength and readLength and add firstWeek. (2) retry: `package.json` test:recovery lists repair_receipt and retry_first; `ResultPageClient.jsx` reset effect keeps adopt's repair-record read for the receipt and adds setRetried. (3) credits50: `docs/brain/STATUS.md`, both sections kept. fixes and land3 merged clean.

**Also:** `test:app` now runs the landing hero, copy, Mobi and position tests (land3 added them but wired none).

**Checks:** lint clean; test:app 647; test:today 87; test:recovery 586 pass, 3 todo; test:learning 357; test:auth 110; test:billing 161; test:dock 28 pass, 1 skipped by design (needs DOCK_BASE_URL); `next build --webpack` ok.

**Gate before deploy:** the D54 migration `20261018130000_free_ai_wallet_50` must be applied on production first (code is backward compatible), then the code. Not applied here.

## 18 October 2026 - Free AI wallet 10 -> 50 a month (branch web/credits50-1018; local, not pushed, not deployed; NOTHING applied to production)

**Owner, 12:15 and 12:30 pm (D54):** free users get 50 AI credits a month (Pro stays 50 included); the server, the app and the website change together.

- **Code:** `AI_FREE_MONTHLY_CREDITS = 50`; `AI_FREE_BUDGET_INR_CAP = 2.5` (it said 5 but production enforced Rs 1; it now mirrors the database row). Every reader (api/ai/credits, getDailyUsage, wallet projection, the Ask Mobi composer line, the AI credits page) takes the constant, so they move together.
- **Copy:** /pricing (plan terms, free notes, Ask Mobi section), /features, landing Ask Mobi card, askSuggestions fallback. /pricing/ai-credits reads the constant. No text elsewhere (help, FAQ, terms, refunds, emails, data/*.json) stated the Free number.
- **Migration (NOT applied on production):** `supabase/migrations/20261018130000_free_ai_wallet_50.sql`, undo `supabase/undo/20261018130000_free_ai_wallet_50.undo.sql`. (1) `mm_ai_consume_credits` now syncs a wallet row's stored allowance to the one the server sends mid-month (mm_ai_reserve_credits already did), so a student who used 4 of 10 has 46 of 50 left with no one-time grant; before this, the app would have shown 46 while Ask Mobi chat still enforced the stored 10. (2) `mm_ai_reserve_credits` null-allowance fallback 10 -> 50. (3) `runtime_ai_budget.student_user_free` USD 0.0114 (Rs 1) -> 0.0284 (Rs 2.50). Pro 0.0568 and the global row untouched.
- **Cap evidence (production, SELECT-only, 18 Oct):** a reply settles at about USD 0.00029 (gpt-6-luna 9 requests avg 0.000299, max 0.000479; the 4 requests carrying a user id avg 0.000289) and each request is checked as spent + a reservation of about 0.00155. The old Rs 1 cap stops a free student after about 33-34 typical replies; 50 need about 0.0165; 50 at the observed maximum need about 0.0255; Rs 2.50 = 0.0284 covers both and a failed attempt or two.
- **Staging dry-run (onwkqxmjqjrhfbjjdydu):** migration applied by SQL, then in rolled-back blocks: stored 10 with 4 used + server 50 -> consume leaves 45 left, reserve 44; a new Free user spends exactly 50, the 51st is refused (insufficient_ai_credits); null allowance falls back to 50; a stale previous-month row resets to 49 left with 5 bonus kept; reserve_runtime_ai with the free tier: 34 typical replies before the old cap stopped, 80+ (loop limit) under the new cap, 57 at the highest cost seen. Then the undo was run: both function hashes equal production's pre-change hashes (cbd55d39..., bf56e49a...) and the free cap is back at 0.0114. Staging's two functions had drifted from production before (older consume body, anon/authenticated could execute it); they now hold production's bodies. No test rows left.
- **Deploy order:** apply the migration first (it is backward compatible with the old code: old code still sends 10, the new consume then syncs a row down to 10), then deploy the code. Roll back = code first, then the undo.
- **Global student-AI ceiling:** the task brief said USD 25 stays; production's `student_ai` row reads 1000000 (the owner removed the ceiling on 17 Oct, AGENTS.md). This work does not touch that row either way.
- **Practice credits (unchanged):** a new account starts with 100 practice credits (users.credit_balance default 100); Quick practice costs 10 (5 to 20 questions), Full mock 50; the daily login grant is switched off (grant_daily_login_credits returns false); +15 per approved contribution; no monthly refill. So a free student's 100 buys 10 Quick sessions, or 2 Full mocks, or a mix. Mob papers, Revise, Learn and the five-question baseline use no credits.
- **Checks:** test:billing 161/161 (includes the new data/tests/free_ai_wallet_50.test.mjs, 8 tests: constants, copy, wallet projection, the migration and its undo on PGlite); test:learning 357/357; test:recovery 556 tests, 0 fail (3 known-gap warnings); test:app 595/596, the one failure (release6_fixes_1018 'Review at 0 AI credits...') is a CRLF-checkout artefact in this worktree (its regex needs LF line endings; it passes in wt-rel7), not from this change; lint clean; `next build --webpack` ok; /pricing and /pricing/ai-credits at 390 and 1440, Night and Day: no horizontal overflow, the page text states 50 and nowhere 10.

## 18 October 2026 - Web release 8 adoption pieces: the chained first-week path and the after-the-mock repair receipt (web/r8-adopt-1018, from release 7 c46d1dcd; local, not pushed, not deployed; nothing applied to any database)

**Owner items:** W-064 and F18 (students did not use 90% of features because nothing led them); FEATURE-ADOPTION-2026-10-17 items 5 and 7.

**1. The first-week path** (`src/lib/today/firstWeek.mjs`, pure; wired in `page.jsx`, `TodayMove.jsx`):
- Seven steps, one a day, the doc's order: day 1 Find and fix (the 10-question starting set, then a Repair), 2 Revise, 3 practice aimed at the weakest chapter (smart practice on Pro), 4 a first set in a second subject, 5 the first full mock, 6 repair what that mock found, 7 Change plan.
- Clock: the first scored session (rhythm `first_scored_session`; the account start date is not among Today's reads, so it is not used). Nothing saved is day 1. After day 7, or when every step that applies is done, the path is gone.
- Done is read from data the page already holds: a saved session plus a Repair (or nothing left to repair); Revise used (asked today, or an active card above box 1); a second session; papers in two subjects; a saved full or NTA mock; a Repair on the newest mock; a date, mock target or study days saved. Unknown reads never tick and never lead.
- Today's step replaces the lead only while it is undone and the product can do it now. It never replaces a session waiting, a check, "Done for tonight" or a failed read. The regular move waits among the two choices; "More ways to practise" stays. A step passed stays a quiet open mark and is never nagged.
- The lead's overline says "Day 3 of your first week"; under it a rail of seven marks (done = ink disc with a tick, today = ink ring, passed = quiet ring, ahead = dot, not applicable = dash). No volt, no checklist, no labels; a screen reader hears one sentence. The day 7 key is a button that opens Change plan.
- The lead holds as loading, 1.5 s at most, while the reads that decide today's step are in flight, so it lands once.

**2. The receipt** (`data/repair_receipt.mjs`, pure; the result's summary card, and one line under Last paper on Today):
- Counts the student's saved repairs made before the paper (repair record, one per question). If a repaired question came up again on the paper: "Of the 6 mistakes you repaired, 2 came up again on this paper. You got both right." (nothing is said if none was right, and the chapter is never swapped in). Otherwise, repaired mistakes in chapters this paper asked about, answered at least twice (one lucky answer is not evidence of a chapter) and got none wrong: "Of the 6 mistakes you repaired, 4 are in chapters where you got nothing wrong on this paper." No line when there is no repair before the paper, the record did not load, nothing matches, or there is no good news. No cause and no marks claimed.
- The result page reads the repair record in parallel with the paper (the same read Today makes) and waits for it 0.5 s at most so the line is in the first paint.

**Preview fixtures (dev only):** `/preview/arena?view=today&firstweek=1..7` (a student on that day who followed the path to yesterday; real rhythm engine and scorer); `&receipt=chapter|question|none`; `?view=result&firstweek=6&attempt=fw-p5` opens the first full mock with the receipt.

**Tests:** `first_week_path.test.mjs` (16) and `today_release8.test.mjs` (6) in `test:today`; `repair_receipt.test.mjs` (11) in `test:recovery`.

**Checks:** today 75 pass; recovery 564 pass, 3 todo, 0 fail (was 553); learning 357; app 595 pass and 1 fail that is there before this work too (`release6_fixes_1018`, "Review at 0 AI credits", a CRLF-sensitive regex in a Windows checkout). eslint clean on every changed file. `npx next build --webpack` exit 0; `.next` deleted. Headless Chrome (playwright-core, own temp profile, own dev server on :3217, preview fixtures only, stopped): days 1 to 7 and the receipt in Night and Day at 390 and 1440, each capture looked at, a real pointer click opening Change plan from the day 7 key and swapping the lead on day 3, no horizontal overflow, no console errors; the rail fits at 320 and under reduced motion shows its ticks with no animation. Captures: `tmp/adopt/`.

**Known limits:** the day 3 step is "done" by a second saved session (the summary does not say which chapter a set was aimed at); Check it held is not used as a step because the repair record's `checkedState` is `not_available` on this codebase; the receipt's chapter rule is a proxy and says so in its own words (a chapter counts as clean only on two or more answers). Not measured: production timing and a real account's history.

## 18 October 2026 - Web release 7 integrated (deploy/web-1018-r7, from live main 70c4598c = release 6; local, not pushed, not deployed; nothing applied to any database)

**What it is:** the new Today (TODAY-1018, branch web/today-1018 at d0486c12; the owner at 8:40 am: "the today page is better now") merged onto release 6. Today files are the 1018 design; every R5 and R6 change in the shared files is kept (Help and FAQ with no Help door, "Learn", community hidden, the Ask Mobi panel and nav row, badges, not-found pages, the docked-panel rule that stacks Today's columns at 1280 to 1439).

**Conflicts and how they were resolved (by intent):**
- `src/app/(app)/today/page.jsx` and `src/components/today/TodayMove.jsx`: the 1018 versions won. R6's "Why this?" was re-attached to the new lead card (below).
- Auto-merged and checked: `package.json` (R6's suite lists plus `test:today` now with `today_release7.test.mjs`), `ArenaPreviewClient.jsx` (R6's preview routes kept, two fixture states added), `today.css` (R6's 44 px sentence-link rule kept).

**Owner items on the new Today:**
- **D36, "Why this?"**: AskMobiLink (ASK-MOBI-1018) is in the lead card's reason paragraph, right after the reason text, 68 x 45 px (hit-tested at the top, centre and bottom). It opens the Ask Mobi panel with the lead's reason answered free, and it follows the lead: a swapped card (tap a choice) asks about the swapped move. It takes the place of the "See why" link to the record page, so the card never has two ways to ask why.
- **D15 wording**: "mistakes to repair first" is now "mistakes to repair" (priority is order, never a label); in Weak chapters each mistake's one action is `actionLabel` from `data/repair_presentation.mjs`: Repair, Check it held, See repair, Try it again (`src/lib/today/mistakeAction.mjs`). The lead's key still reads "Start repair" with its minutes: it starts a run of several, not one question.
- **D29, "Play your paper back, 20 s"**: after a fresh submission (newest paper saved within 3 hours) Today shows a card once in the lead's place (`TodayReel.jsx`, `src/lib/today/paperReel.mjs`). It builds the reel with the result's own engine (`reelScript.mjs`, shared with the result page: same analysis, time read, costliest chapter and next move) from the cached attempt read that Last paper already makes. One volt key plays it in the result's own `PaperReel`; "Not now" is one tap. The card is marked seen once it has been on screen (last 20 attempt ids in localStorage `mm:today-reel:v1`), and Up next returns. A paper that cannot be read or has nothing answered hands the lead back at once. The seconds in the title come from the script (5, 10, 15, 20...).
- **D28, greeting**: Hello from midnight to 5 AM survives (the 1018 greeting.mjs, tested).

**Preview fixtures (dev only):** `/preview/arena?view=today&reel=fresh` (a new attempt every load, so the card shows every time) and `&reel=stable` (one attempt id: shows once, a reload brings Up next back); `&repaired=chapter` (weak chapter with one Check it held, one See repair, one Repair).

**Tests changed because the owner replaced the behaviour:** `today_1017.test.mjs` (two asserts: the label "mistakes to repair first" is now "mistakes to repair", D15); `ask_mobi_entries.test.mjs` (the page wiring regex now reads `todayContext({ move: lead, ... })`: the 1018 lead is named `lead`, not `move`; the entry, its label and its context are unchanged). New: `data/tests/today_release7.test.mjs` (9 tests).

**Checks (after the merge, in this worktree):**

| Suite | Result |
|---|---|
| recovery | 553 pass, 3 todo (known gaps), 0 fail |
| app | 596 |
| learning | 357 |
| auth | 110 |
| billing | 153 |
| nta | 188 |
| today | 53 (was 32; 9 new in today_release7) |
| mob | 45 |
| subjects | 30 |
| du | 42 |
| dock | 7 pass, 1 todo |
| community | 11 |
| study | 37 pass, 1 fail: the known wordnet LICENSE_UNAVAILABLE |

- eslint is clean on every changed file. `npx next build --webpack` exits 0; `.next` deleted.
- Headless Chrome (playwright-core, own dev server on :3117, preview fixtures only, stopped): "Why this?" hit-tested at 390 and 1440; its click opens the docked panel with the reason answered; docked at 1280, 1440 and 1920 with no horizontal overflow; the reel card at 390 and 1440 in both themes, the reel plays and closes and Up next returns, "Not now" returns Up next, `reel=stable` shows once and a reload brings Up next back; Weak chapters shows Check it held, See repair and Repair.

**Result page `?q=N` (coordinator decision, after the merge):** Today's "Repair this leak", the Weak chapters links and the reel's last key send `/result/{id}?q=N`. The result page now reads it once the paper is loaded and runs `jumpTo(N)`, the same path as a press on that question's bubble: Your mistakes (or the part that owns the row) opens, the row expands and scrolls into view with its Repair button, and focus lands on the row. It never passes `{ repair: true }`, so it never sets `autoRepair`: no paid repair can start from a URL (checked in the preview: no POST was made). A missing, non-numeric or out-of-range N does nothing. `src/components/result/questionParam.mjs`; `data/tests/result_question_param.test.mjs` (2 tests, in test:recovery) pins the parse and that the effect never reaches `setAutoRepair`. recovery is now 553 pass, 3 todo.

**Known gaps found while merging:**
- The working tree of this worktree has CRLF line endings (core.autocrlf), which breaks one regex in `release6_fixes_1018.test.mjs` (`practiseLine` match on `
`); the index is LF and the test passes on an LF checkout.


## 18 October 2026, about 7:25 am IST - Website release 6 shipped (deploy/web-1018-r6): Review and result 1018, Ask Mobi 1018, community and Learn, badges

**What shipped, by owner item (OWNER-FEEDBACK-2026-10-18-DAWN.md):**
- **Review and result:**
  - Review leads with weak chapters (D18).
  - One action label per mistake, and the counts agree (D15).
  - The analysis index is calm, with one part open at a time (D16).
  - The replay is sized to the paper; a paper with nothing to replay says so (D17).
  - "Play your paper back" reel (D29).
  - A saved repair opens free (F17).
- **Ask Mobi** is one panel opened in context, with no tabs, nothing under the theme switch, a real Day panel, and the cost shown before a paid ask (D6/D12).
- **Contribution features** are hidden behind CONTRIBUTE_ENABLED: /upload and /my-uploads show the calm paused page. Your standing is under Progress, and Learn is in the Study group (COMMUNITY-1018, D20).
- **Badges:** "Badges, n of 16" on Progress, tap to explain, and a one-time "Badge earned" row on the result (D19). `forgetBadges` runs after an attempt is saved.
- **Unknown URLs** get a themed not-found page.

**Merges onto R5 (58bc53f6):** web/r6-community-1018 (f9f28fba), web/r6-review-1018 (0b7ae8a4), web/r6-askmobi-1018 (d5287d3d), web/badges-1018 (9f897ef8).

**Checks:**
- Suites:

  | Suite | Result |
  |---|---|
  | recovery | 551 pass, 3 todo |
  | app | 596 |
  | learning | 357 |
  | today | 32 |
  | community | 11 |
  | auth | 110 |
  | billing | 153 |
  | nta | 188 |
  | mob | 45 |
  | subjects | 30 |
  | du | 42 |
  | dock | 7 (1 skipped) |
  | study | 37 of 38 (the known wordnet LICENSE_UNAVAILABLE) |

- eslint clean; next build --webpack exit 0.
- **Visual check:** an independent verifier (210 captures, 390/1440, Night and Day, real pointer clicks) gave NO-GO on 1 HIGH: the docked Ask Mobi broke the result at 1280-1366. A fix round (10 commits) fixed it and 8 MEDIUM/LOW items:
  - the layouts now use container queries;
  - the root not-found page;
  - the Time part says what the paper holds;
  - Progress CLS went from 0.198 to 0.006;
  - 44 px targets;
  - the Ask panel without lime;
  - the reel moments in clock order;
  - focus after Esc;
  - no duplicated heading.

  The fix round re-checked with ~50 captures at 1280/1366/1440 docked, Night and Day, with 0 mid-word breaks. The main session looked at the docked result and Review captures.
- **Practice zero-credit line:** left honest. Practice credits do not renew, so no renewal date is shown there.

**Approval:** the owner at about 4 am: "Push everything that passes".

## 18 October 2026, about 4:50 am IST - Production migration 20261017160000_revise_cards_mode applied (owner's standing grant)

- **Applied by:** the main session, through the migration tool as "revise_cards_mode", right after website release 5 (58bc53f6) was pushed. The code feature-detects the column.
- **Before:** staging dry run and apply on 17 Oct (evidence in the migration file). Undo at supabase/undo/20261017160000_revise_cards_mode.undo.sql.
- **Production pre-check:**
  - 27 rows; no mode column; no check constraint;
  - RLS on; 0 policies.
- **Production post-check:**
  - 27 rows, all with mode 'question'; 1 mode column;
  - the check is (mode = ANY (ARRAY['question','again']));
  - RLS on; 0 policies (service role only).

## 18 October 2026 - Web release 6 integrated (deploy/web-1018-r6, from live main 58bc53f6 = release 5; local, not pushed, not deployed; nothing applied to any database)

- Merged in order, each with the suites and eslint run after it: web/r6-community-1018 (CONTRIBUTE_ENABLED, no Community header, Your standing under Progress, Learn in the Study group, phone More marks), web/r6-review-1018 (D15, D16, D17, D18, D29, F17), web/r6-askmobi-1018 (one Ask Mobi panel and its entry points, ASK-MOBI-1018), then web/badges-1018 (BADGES-REFINE-1018: Badges as their own section of Progress after the record, a tap-to-explain sheet or popover, the earned row on the result).
- Badges: Progress keeps the record, then the study record, then "Badges, n of 16" and Personal bests (out of the week card), then the closing Your standing row. On the result the EarnedBadges row sits once, right after the summary and above the reel row and the analysis, on the review branch's structure. One server addition the badges branch left for the merge: the server keeps a student's badge list for 5 minutes, so forgetBadges(userId) now runs after an attempt is saved (PATCH /api/sessions on a finish, which /api/attempts POST re-exports, and the two GET routes that turn an expired session into a result when they finalised one); the earned row asks /api/me/badges with cache no-cache so the browser's own one-minute copy cannot hide the new badge. New test data/tests/badges_forget_1018.test.mjs (real badgesStore and real /api/sessions route over stubbed edges) is in test:app with badges_refine_1018.
- Conflicts were settled by intent, not by taking a side. The nav label stays "Learn" (D20). Release 5's Review badge on the dock and sidebar stays beside the community branch's tour filter and its More mark (data-within, which covers Learn, Explore, Saved, Progress, Account and Help). Release 5's removal of the Help door (D11) stands: the sidebar foot is the appearance row alone, Help and FAQ is its own page, and nothing about Mobi sits under the theme switch; the Help tour step no longer promises Ask Mobi there. The Help page keeps its "Help and FAQ" title and drops its Ask Mobi row.
- Practice has ONE Ask Mobi entry. Release 5's Repairs line under the subject shelf (D5) stays with its "Review and repair" key; its Ask Mobi key is now the Ask Mobi branch's AskMobiLink "Ask Mobi what to practise", with the weakest-chapter record line under it, and the separate row that branch drew (PracticeAskRow) is gone. The saved-repair hand-off the line used before is not used for the entry any more (repairsLine.mjs still computes it).
- The result keeps the review branch's D15/D16/D17/D18/D29 structure. Ask Mobi's two entries sit where they fit it: "Ask Mobi about this mock" under the ledger in Where your marks went, and "Ask Mobi about Q7" inside an opened mistake in Your mistakes, under the repair; once the repair holds its own ask the line is not drawn twice. Ask Mobi's retirement of the four-tab hub and AIMentorTerminal stands, and the four tests that read the old hub now read the panel.
- Tests: the union of all three sides. Contradictions settled for the newer approved design: mobi_help_door (no Help door, no orb, from release 5 and Ask Mobi), pricing_copy_1017 (Review is its own page from release 5; the finding is not repeated in the panel or the record page from Ask Mobi) and practice_repairs plus ask_mobi_entries (one Practice entry). test:app gains ask_mobi_panel and ask_mobi_entries; practice_repairs.test.mjs is not in any suite list (as in release 5) and passes when run on its own.

## 18 October 2026 - Web release 6, Review and result (REVIEW-RESULT-1018, owner D15, D17, D18, D29) finished on web/r6-review-1018 (local, not pushed, not deployed; nothing applied to any database)

- Built on the approved mock-up (docs/design-decisions/pass-1018/REVIEW-RESULT-1018.md). The front of the result (hero, next move, answer map) is untouched; the Review and the depth layer are the packets P-RR0 to P-RR3 plus what was missing:
  - D18: Review leads with where you lose marks (chapters priced as "Lost 35 of the 80 marks on offer"), the open chapter carries the one lime key "Practise 10 on this chapter" and its mistakes, each with one action; Saved repairs, Your papers, Revise and Also under it. A chapter named in the URL scrolls into view. /analytics keeps its trend and links to Review for chapters.
  - D15: actionLabel() in data/repair_presentation.mjs is the one source of Repair, Check it held, See repair and Try it again (Review's rows and the result's chips both ask it). The result's list now leads with the mistake the next move names (leadMistake(), read once at load, one line says why), so "Repair Q6" and the first row are the same question; a mistake that is already repaired opens its saved repair free (F17) and each mistake shows its paper and a 12-hour weekday stamp.
  - D17: the replay is one slot per question sized to the paper (10 questions draw 10 wide slots, 50 draw two rows of 25), with Play over the real events, Previous and Next, a detail line, Collapse remembered per device, and no replay at all on a paper with under 2 minutes or under 3 answer events (the 58-second case says so in one sentence). The per-answer strip is now the replay in miniature (this question's slot lit). Captions, detail words and the cut link come from data/mistake_lab.copy.json so the app can port them.
  - D16: Your full analysis is one index of six named parts, each with what it found, exactly one open, in the URL (?part=); the lit fill is one marker that slides to the open row.
  - D29: "Play your paper back, N s" (N from the script's own length, 20 for a mock): reelScript() in data/replay.js, the same engine as the replay, builds one timeline from the attempt record (sheet lights question by question as the score counts to the paper's own score, pauses on real moments such as "Q31: you changed a right answer to wrong. It cost 6 marks.", lands on the costliest chapter, ends on the one next move). The web opener is a quiet row under the front; Skip is one tap, Escape leaves, reduced motion opens settled with Next moment. Not wired into Today (another branch): mount ReelEntry/PaperReel there with autoplay and the same script.
- Tests: new replay_reel.test.mjs (12) and result_parts_1018.test.mjs (13: one label from one function, no "Repair first", "Repair in N" or "Check it here" on any result or Review surface, the six parts in order with every R4 block in its part, the front's props, the review states, saved repairs free, the key and the list lead agree), both in test:recovery. Results: recovery 554 (551 pass, 3 todo known gaps, 0 fail), learning 357, app 502, today 32, mob 45, auth 110, billing 153, study 37 of 38 (the same wordnet LICENSE_UNAVAILABLE failure as before, not from this work). eslint clean on all 26 changed files. No existing test was changed or weakened.
- Headless checks (playwright-core, temp profile, 390x844 and 1440x900, Night and Day, every image opened; /preview/arena fixtures, no sign-in, no production data): Review (student, other chapter, one paper, all repaired, zero credits, empty, down, loading, lower sections), Radar row, result (front, six parts, replay of 50, 10 and the 58-second cut), the reel (row, frames at 0.9 to 21.5 s, end card, reduced motion). Real-pointer walks: every index row, Next:, All six parts, Play, Pause, Next, Previous, a slot, Collapse, an answer-map bubble for a wrong and a right answer, a chapter, a mistake row (free sheet), a saved repair (no paid Repair offered), the reel's Skip and Play again, with hit-tests that nothing covers a control; one lime fill in the content at every step; no console errors. Captures: tmp/r6review/shots.
- Limits: Today's "mistakes to repair first" (src/lib/today/move.mjs) still says "first" and belongs to the Today branch; the cut replay's link says "Practise 10 more, no time limit" (a fresh set, not the same questions again, so "Take these 10 again" would be untrue); the app ports (review_chapters.dart, replay_model.dart, the reel) are not built.

## 18 October 2026 - Web release 6, sidebar items: community side hidden (COMMUNITY-1018) and Learn's place (D20) on web/r6-community-1018 (from web/r5-nav-1018; local, not pushed, not deployed; nothing applied to any database)

- CONTRIBUTE_ENABLED (default off; only the exact string true turns it on) hides Contribute and My uploads (sidebar group and Account rows), the Practice "Add a question" panel (and its /api/questions/mine read), the vote arrows (Explore cards and the runner) and the Explore footnote about votes. Routes, tables, files and the creator programme stay. /upload and /my-uploads answer the calm paused page while the flag is off, never a 404, as COMMUNITY-1018 says (ContributionsPaused, inside the app shell; the coordinator corrected an earlier brief that said not-found); a new src/app/(app)/not-found.js, which keeps the sidebar and dock, serves genuinely unknown routes; POST /api/questions/upload and GET /api/questions/mine answer 403 {code: contributions_paused} before any auth or database work. The vote API is left as it is (the app's vote arrows still call it). The flag reaches the browser through ContributeFlagProvider, as MobFlag does. The preview takes ?contribute=on.
- Sidebar: the Community header is gone. Your standing is a sub-link indented under Progress, listed beside Progress in the phone sheet; Account's group is headed Progress and keeps the Your standing row; Progress ends with a "Your standing" row. Your Mob (flag off by default) follows it in Study. With the flag on a Contribute group returns.
- No contribution promise left: Pricing's free-plan note no longer says an uploaded question adds 15 credits; the Terms description (page and seo.js) says practice questions, not community questions; seoPages.js says timed practice from one large CUET question bank. Terms and Privacy keep their community clauses while the upload API exists.
- Practice: with Add a question hidden, Concepts and Pro take the right column beside Recent sessions at 1024 px and up (CSS only), so the lower area stays two balanced columns.
- D20 Learn: the dock stays Today, Practice, Review, Colleges, More (a sixth slot is under 44 px at 375 px and Colleges was the owner's own call). Learn leads the More sheet in its own row (name and one line), is not listed twice, and has its own Guide stop. NEW this pass: (1) a lesson or recall run at /study/<id> keeps Learn as the current place (sidebar, header title), so a run reached from Progress no longer shows no place; (2) on a phone More is marked, with the lens under it, whenever the current place lives under More (Learn, Explore, Saved, Progress, Account, Help), so the dock never shows a screen with nothing current; (3) Progress's study record now leads to the Learn page itself ("Open Learn", with "N cards are due for review in Learn") instead of dropping into a card run; Review keeps its direct "Review due cards" button, Today's plan card is untouched. Learn stays in the desktop Study group between Practice and Review and shows only while STUDY_CONTENT_ENABLED is on. Not done (other owners' pages): Practice's Concepts panel is still at the bottom of the page, and Learn's own page refinement (F15).
- Preview fixtures (dev only): ?study=on carries through the preview's links and opens /preview/study for Learn, serves a study catalog for Progress's study record (?due=0 for none due), and view=not-found shows the not-found page, view=paused and view=paused-uploads show the paused page.
- Landing lines that say "leaderboard", for the landing track (NOT edited): src/app/page.js line 53 (the free plan list item "Leaderboard"), line 124 (kicker "Benchmarks and leaderboard"), line 126 (point "Every mock earns points for accuracy and speed on the leaderboard" and the button "See the leaderboard", href /leaderboard). In-app copy that still says leaderboard (not landing): the result page correction note and AnswerCorrectionNotice.
- Checks: eslint clean (whole repo); test:community 11, test:app 513, dock 7 pass 1 skipped (the DOM measurement launches chrome.exe directly, not run), subjects 30, today 32, mob 45, auth 110, learning 357, recovery 415 all pass. test:study has 1 failure, "the content gate quarantines changed arithmetic, unsourced vocabulary and unsupported reading keys" (WordNet LICENSE_UNAVAILABLE): its inputs (data/study, scripts/learning) are unchanged by this branch, so it is not from this work; not investigated further.
- Headless captures (playwright-core, 390x844 and 1440x900, Night and Day, all opened) in tmp/community/shots: Practice off and on (bottom), Explore off and on (0 and 12 vote rows, footnote 0 and 1), Account group off and on, Your standing with the sub-link current, Progress (study record, closing row), Learn with Learn current and More marked, the More sheet with the Learn row, the paused page (both titles) and the not-found page. Real pointer clicks: More opens the sheet, the Learn row and the Your standing links navigate and become current in the sidebar and (phone) under More; no horizontal scroll at 390, no console error.

## 18 October 2026, about 4:45 am IST - Website release 5 shipped (deploy/web-1018-r5, 09a620fa): the owner's dawn fixes

**Contents (owner items in OWNER-FEEDBACK-2026-10-18-DAWN.md):**
- Night mode is subtle again (D7/D12).
- The light/dark switcher animation is restored (D10).
- Help has moved to its own page, and the phone nav pulse is fixed (D11/D13).
- Practice has Repairs and Ask Mobi entry points (D5).
- The result uses one action label per mistake, and the answer bar is sized to the mock (D15/D17).
- Learn and Review: F15 Revise and Concepts.

**Checks:** recovery 509 pass / 3 todo / 0 fail, app 502, learning 357, auth 110, billing 153, nta 188, today 32, mob 45, subjects 30, du 42, dock 7 (1 skipped: it launches chrome.exe); eslint clean on the 66 changed files; next build --webpack exit 0. Independent visual check with before/after pictures at 390 and 1440, Night and Day: docs/brain/R5-WHERE-TO-LOOK.md. The main session renamed the nav item and page title from Concepts back to Learn (D20) and re-ran app 502, learning 357, dock 7 and eslint. The migration 20261017160000_revise_cards_mode stays on staging only for this push (the code feature-detects the column).

**Approval:** the owner said "Push everything that passes" at about 4 am.

**Nothing was applied to any database.**

## 18 October 2026, about 1:20 am IST - Website release 4 shipped (deploy/web-1017d, main 9578ee66): the owner's night feedback N1-N13

**Contents:**
- The Today redesign (N1). The owner later called it "a huge regression" (D1); the new Today is TODAY-1018.
- The result and Review restore (N12).
- Practice polish (N2/N3/N5/N7/N8/N11).
- The Mobi orb and guide (N9/N17). Later rejected (D6); the redesign is ASK-MOBI-1018.
- The five-subject cap (N6).

**Checks (independent verifier PASS):**

| Suite | Passed |
|---|---|
| app | 502 |
| recovery | 415 |
| learning | 357 |
| auth | 110 |
| billing | 153 |
| nta | 188 |
| today | 32 |
| mob | 45 |
| subjects | 30 |
| du | 42 |
| dock | 74 |

Vercel dpl_APxT7dGMgtBCc6CehsWmXSwuJ7cn was READY with 0 runtime errors in the hour after the push.

**Nothing was applied to any database.**

## 17 October 2026, about 11:55 pm IST - Website release 3 shipped (deploy/web-1017c, main 5d0c46f2): Today and nav fixes

**Contents:**
- Merged onto release 2 (12997f5a): web/fix-today-1017 (f69f8a86) and web/fix-nav-1017 (49dc3426).
- web/fix-result-1017 was left out, because its direction was rejected. It is kept as branch deploy/web-1017c-withresult.

**Checks:** independent verifier PASS. Vercel dpl_6qnQMMAKko4y82Ak65SbL3dqRdGg READY.

**Nothing was applied to any database.**

## 18 October 2026 - Web release 5 (deploy/web-1018-r5): checked and made reviewable (local, not pushed, not deployed; nothing applied to any database)

- Suites on the merged head (9dce83f9): test:recovery 512 tests, 509 pass, 0 fail, 3 todo (the next_move_parity known gaps); test:app 502/502; test:learning 357/357; test:auth 110/110; test:billing 153/153; test:nta 188/188; test:today 32/32; test:mob 45/45; test:subjects 30/30; test:du 42/42; test:dock 8 (7 pass, 1 skipped: the DOM measurement needs DOCK_BASE_URL). eslint clean on the 66 files changed since main 9578ee66. next build --webpack passes. No test was changed and no code was changed in this pass.
- Evidence for the owner's "seems the same" (D33): docs/brain/R5-WHERE-TO-LOOK.md, with 168 pictures in docs/brain/r5-where-to-look/ (390 x 844 and 1440 x 900, Day and Night; before = release 4 main 9578ee66 on a spare port, live www.mockmob.in for the landing; after = the branch on port 3205) and pixel-diff.json. Verdicts: D5, D10, D17 and F15 are clearly visible; D15 and D13 are small; D11 is partly visible (the Help page itself already existed in release 4); D7 is visible on Ask Mobi only (the Night colours elsewhere are the same as release 4); the 50-question summary bar is identical by design. Release 5 contains nothing for Today (D1 to D3), the Ask Mobi redesign (D6), icons (D8) or badges (D19).
- Notes: the sidebar and page now say Concepts where they said Learn (F15). The dev server on 3205 uses the production .env.local: do not sign in on it; the preview routes need no sign-in.

## 18 October 2026 - Web release 5, item lr: Learn and Review packets merged on web/r5-lr-1018 (from main 9578ee66; local, not pushed, not deployed; nothing applied to any database)

- Merged web/lr2-1017 (Revise queue, Review page P-LR1, Concepts base) and web/lr3-1017 (Concepts polish). Conflicts: AppLayoutClient (main's tour and Mobi gating kept, plus the Review badge and the More current on Concepts), RecoveryOverview (the Review view is now review/ReviewPage; main's small Review tweaks are superseded), STATUS.md (all entries kept).
- Checks: eslint clean; test:app 502, test:recovery 509 pass / 3 todo / 0 fail, test:learning 357, test:today 32, test:dock 5 (1 skipped), test:study 37 of 38 (the wordnet LICENSE_UNAVAILABLE failure, which also fails on the older main-line commit 12997f5a); next build --webpack passes.
- Headless captures (390x844 and 1440x900, Night and Day, every image opened): Review (Mistakes, an opened chapter, Papers, empty, down), Revise (ready, cards, empty, a full run played with real pointer clicks, end), Concepts (full, first visit, lesson, lesson opened from Q42), Practice's Concepts panel, the More sheet. No horizontal scroll, no console error from this work (the one 401 is /api/ai/credits, which the study preview does not stub).
- D20 status: see the return of this task. Concepts sits in the desktop sidebar (Study group) and in the phone More sheet only; its Practice panel is at the bottom of the page; the migration 20261017160000_revise_cards_mode is on staging only (code feature-detects the column).

## 17 October 2026, about 11:05 pm IST - Website release 2 shipped (deploy/web-1017b): security rounds 1 and 2, per-user AI cap on rival battles, owner-ledger fixes for Start/Practice/runner and pricing/help/copy

- Merged onto live f725a422: fix/security-1017d (creator API cut-down sale, exact creator-code match, a single report never unlists a question), fix/security-2-1017d (explore returns public fields only, upload is no longer an answer oracle, payout serialisation, server-only default privileges, mentor /local never stores client text as the assistant, deletion scrubs runtime_ai_requests, votes only on live questions), web/fix-aicap-1017 (W-098: rival start and submit reserve through the per-user cap), web/fix-start-1017 (owner ledger W-002, 003, 005, 008, 012, 013, 014, 017, 018, 023), web/fix-pricing-1017 (W-093 to W-099).
- Checks (independent verifier PASS): lint clean; app 498, recovery 415, learning 357, auth 109, billing 153, nta 188, today 28, mob 45, subjects 26; next build --webpack; headless smoke at 390 and 1440 in Night and Day with zero console errors and zero overflow.
- Production migrations applied by the main session under the owner's standing grant, each dry-run on staging first, with pre- and post-checks: 20261017200000_create_pending_payout_lock (advisory lock present), 20261017205000_account_deletion_runtime_ai_scrub (prefix match and {hash} present; applied before this code), 20261017210000_default_privileges_server_only (0 sequence grants to anon or authenticated; public default ACLs postgres and service_role only; supabase_admin step skipped on hosted Supabase). Undo files in supabase/undo. Not applied: 20261017100000_mob.sql (the Mob stays off).
- Open: 12-13 Oct migrations (app_preferences, session_finalisations, inventory_snapshots, nta_paper_shortfalls) are not on production under their own names; their callers must degrade safely (not traced). New functions meant for browser roles now need an explicit GRANT EXECUTE.

## 18 October 2026 - Learn and Review P-LR2 (web Revise queue) verified on web/lr2-1017 (local, not pushed, not deployed; nothing applied to production)

- Reviewed the P-LR2 commits against LEARN-REVIEW-1017 5.8 and acceptance 9 and 12: one run over four sources (questions, repaired mistakes as Review again, Check it held, concept cards), one card per question per day (the merge keeps the repaired mode, and the server's guarded card update answers a second try with not_due), the cap of 5 or 10 on questions only, checks always in, cards at most 5; the dock hidden on the whole /review/revise route (loading, empty, failed and end states too); the Review badge counts down only on the server's acknowledgement; /learn?recall=due and /review/again land on Revise filtered. No code change was needed in this pass.
- Visual check through /preview/arena?view=revise on port 3341 (headless Chrome, temp profile deleted, dev server stopped, .next-dev removed): ready, dedupe, cards, sparse, legacy, empty, done and down at 390x844 and 1440x900 in Night and Day. A full run was played with real pointer clicks: 8 due, 5 questions back, 1 Check it held, 2 concept cards; the sidebar count went 8 to 4 after four answers; the dock computes to display none at 390; no horizontal scroll; the 5 or 10 a day switch is hit-testable and remembered; the end reads "5 recalled" with the slipped check and the cards named. One lime fill in the content at every step (Next question, Start 10 questions, Back to Review); the sidebar Start key is the owner's accepted second fill.
- Checks: eslint clean (whole repo); test:recovery 509 pass, 0 fail, 3 todo (the next_move_parity known gaps); test:app 498, test:today 28, test:dock 5 pass 0 fail; test:study 37 of 38 (the wordnet LICENSE_UNAVAILABLE failure in study_content.test.mjs, not from this work). next build --webpack passes only with NODE_PATH pointing at mockmob-next/node_modules: the shared node_modules junction lacks @img/colour, so sharp cannot load for the webp blur images (an environment gap, not code); Turbopack refuses the node_modules junction.
- Limits: Revise minutes come from minutesFor (8 due is about 10 minutes; the design mock says 7). The Revise run keeps the web top bar (logo, credits, avatar), as the mock does; the spec line about the app bar stepping away is for the Flutter app. Changing the cap restarts the run on purpose, so the schedule fold closes. Review pages (P-LR1) are on hold and untouched.

## 17 October 2026 - Learn and Review P-LR0 (shared input, fixture, storage) on web/learn-review-1017 (from deploy/web-1017 f725a422; local, not pushed, not deployed)

- Built: data/review_input.mjs (Review's input to the one shared nextMove(), plus chapterRows, receipt, reviseDue, reviewBody), the design student and variants in data/tests/fixtures/review/ (student.json is the unchanged copy; scripts/gen_review_fixtures.mjs writes the variants and expected.json), GET /api/me/review (read-only, src/lib/server/review.js), data/study/lesson_map.mjs, migration 20261017160000_revise_cards_mode.sql with its undo.
- Staging only (onwkqxmjqjrhfbjjdydu): dry run rolled back clean, then applied; revise_cards 105 rows all 'question'. Production NOT migrated; the code feature-detects the column.
- Tests added to test:recovery: review_input, next_move_parity, review_api, lesson_map. Recovery 461 pass, 3 todo (below), 0 fail; today 28, egress 29, app 498 pass; lint clean. test:study has one failure that is not from this change (wordnet LICENSE_UNAVAILABLE in study_content.test.mjs).
- KNOWN GAPS (recorded as todo tests in next_move_parity.test.mjs, not faked): Today's repair key is a batch ("Start repair", the paper's result page, count of the newest paper), not "Repair Q42"; so Today cannot name Review's first target until the TODAY owner changes its wording (LEARN-REVIEW-1017 12 flag 2). Kind and the paper the key opens do agree.
- Other limits: the API has no cohort repair order, so its first repair is the lowest open number in the newest paper (Q38 in the design student, not the fixture's Q42) until a repairOrder is sent; Review prices open items while the result page prices all of a paper's wrong answers (same on one paper without repairs); the Revise minutes use data/revise.js minutesFor (8 due = about 10 minutes), the design mock says 7; the Review-again answer endpoint and the merged due list belong to P-LR2.

## 17 October 2026 - deploy/web-1017: wave 4 merged and the critic's defects fixed (local, not pushed, not deployed; nothing applied to any database)

- Merged content/wave4-1017 (the wave 4 rows in data/nta_agent_scores and data/nta_fit_scores, so the 200 live questions become NTA-eligible on deploy).
- Fixed all 17 critic defects (5 medium, 12 low). Also from the main session: the Practice session bar is opaque now, and the phone dock is denser (Night 0.94, Day 0.93), so no text behind either one is readable. CTO calls: the dock's Start key is unchanged (A1), and the bar's key says what it starts (Start 10 questions, Start full mock, Start NTA paper). The Start lamp is now a neutral warm light at 0.08. The preview takes ?study=on to show Learn in the More sheet; no production flag was changed.
- Checks: lint clean; app 498, recovery 415, learning 343, auth 109, billing 118, nta 188, today 28, mob 45, subjects 20, authored-publish 159 (155 pass, 4 skipped, 0 fail); next build --webpack passes. Headless captures at 390x844 and 1440x900, in Night and Day, with elementFromPoint hit tests before every click. Pages: Practice, Start sheet, Result (perfect, zero credits, an opened row, the repair strip), Review, Today (returning, the road, the dock), Mob (complete, two, pro) and the More sheet.
- Open: at 360 px the bar's mode name is cut short ("Quick pr…"), though the price still shows. STUDY_CONTENT_ENABLED in Vercel production was not checked; Learn has no phone entry while it is off.

## 17 October 2026, about 10:20 am IST - Authored wave 4 published on production (200 questions; mathematics 51, chemistry 42, general_test 39, biology 35, physics 33)

- Applied by Claude (session 25ef3d95) under the owner's standing database grant and his publish rule: only questions whose two quality judges average 8 or more AND whose fit median is 8 or more, after the full wave 1-2 process (coverage plan from select-only production SQL against the blueprints, Sonnet authors, a Sonnet audit per subject, 5 blind Haiku solvers with 4 of 5 on the key, 2 rubric judges, 3 fit judges, the acceptance rule, a Sonnet expert pass, a 3-solver blind re-solve of the one repair that changed solver-visible text). Hindi stays out.
- Plan `docs/brain/reports/authored-w4/plans/wave4-publish-plan-production-2026-10-17.json` (hash 813c724a6554f82a, 200 rows, 2 passage groups, no blockers); select-only dry runs on staging and production first. The main session re-checked all 200 rows against the final score entries before applying (0 failures).
- Inserted 200. Live after: biology 451, chemistry 466, gat 322, mathematics 383, physics 383. Restore file `docs/brain/reports/authored-publish/authored-publish-restore-2026-10-17T04-46-59-355Z.json` (undo: `--mode=restore --restore=<that file> --expect-project=isrxrxzjocewrdureyhp`); also `supabase/undo/20261017130000_authored_wave4_publish.undo.sql`.
- Held: 57 rows at 7-7.9; out: 22 (first-pass rule 20, including 8 general_test Current Affairs items the fit judges rated 6; one unaudited physics draft job never laid out).
- NTA mode: the rows show in practice now; they become NTA-eligible once the code carrying the merged score tables (this branch) is deployed.

## 17 October 2026 - Website release branch deploy/web-1017 assembled (from live main c3b1e215; local, not pushed, not deployed; nothing applied to any database)

- Merged with --no-ff, in order: web/live-fixes-1017, web/review-f17-1017, web/subjects-claim-1017, web/result-1017, web/start-1017, web/today-1017, web/dock-1017, web/mob-split-1017, content/wave3-1017. Conflicts: result (both branches had built the F17 saved repair: kept the lab.repaired ids and the savedRepairs map with the paper line), start and dock (package.json scripts; the phone dock key stays lime and fixed, the sidebar key follows the route through data-start-quiet, the Practice start bar rides --dock-h), mob split (MOB_ENABLED gate kept with the mobId lookup), wave 3 (STATUS only).
- Marketing: the Leaderboard feature is now Your standing on pricing and features (own rank among MockMob students, no other student's name). The landing page is another branch's.
- Tests: lint clean; app 498, recovery 415, learning 343, auth 109, billing 118, nta 188, du 42, subjects 20, today 28, mob 45, authored-publish 128 (123 pass, 4 skipped, 1 fails only on this Windows checkout: CRLF changes the bytes of tmp/authored-w3s raw files, whose manifest sha256 matches the committed LF blobs), dock 6 (5 pass, 1 skipped: needs a running server). next build --webpack passes.
- Migrations vs main: new 20261017150000_study_road_fields.sql (TODAY-1017 P0: exam_date and mock_target; undo file; dry-run on staging still to do); 20261017100000_mob.sql changed (Mob; must not reach production while Mob is off). Not applied anywhere.

## 17 October 2026, about 4:45 am IST - Website motion/UX pass shipped (deploy/ux-1017 onto main e192c59e)

- Ships web/ux-social-1016 (independent verifier PASS on its own base, 94c172e6) merged onto main e192c59e (42b0d75b), plus: stray log removed and *.log ignored (e5c4952e), the moderation Mob reports list and the result page's Mob row send no request while MOB_ENABLED is unset (5e41b296, 1240a925), data-page-primary on the two /leaderboard CTAs (7e26abc3).
- Ship verifier (session 25ef3d95): leaderboard privacy shape intact (401 signed out; only {you:{rank,of,tests,average}, window}), "Your standing" copy intact, providerCore allowlist is only gpt-6-luna and claude-haiku-5-5, reserve_runtime_ai called with 7 arguments. The Mob is off by code: every /api/mob route returns 404 MOB_DISABLED before auth or any DB call, /mob and /join call notFound(), no page or server component queries a mob table while the flag is unset.
- Checks: lint clean; test:app 474, recovery 374, learning 323, auth 109, billing 118 pass; motion tests 27 pass; next build --webpack passes. Headless smoke at 390x844 and 1440x900, Night and Day (Today, Practice, a result, Review, Progress, /leaderboard, Help, Pricing; 32 captures opened): 0 console or page errors, no horizontal scroll, 0 covered tap targets, one volt action per viewport.
- Migrations: none applied. The only new migration, 20261017100000_mob.sql, stays off production (Mob off).
- Open: marketing copy still lists "Leaderboard" as a feature (pricing, landing, features); the result page has 18 px of invisible overflow from an opacity-0 tooltip (html overflow hidden, cannot scroll).

## 17 October 2026 - Per-user AI cap, two-model allowlist, two-call ladder (branch fix/ai-user-cap-1017 from a2fe34b4; local, not pushed, not deployed; nothing applied to production)

- Migration `20261017120000_runtime_ai_user_cap.sql` (undo in supabase/undo): runtime_ai_requests.user_id and index; cap rows student_user_paid 0.1136 and student_user_free 0.0114 in runtime_ai_budget (USD per IST month, change with one UPDATE); reserve_runtime_ai takes p_user_id and p_user_tier, refuses with 'runtime user limit reached', and refuses any model but openai gpt-6-luna and anthropic claude-haiku-5-5 ('runtime model not allowed'). The global USD 25 check is untouched. Dry run on STAGING (onwkqxmjqjrhfbjjdydu): apply, proof in a rolled-back transaction, undo, apply again; staging is left migrated.
- Deploy order: apply the migration to production BEFORE the code (the old function has no p_user_id).
- Code: providerCore allowlist (an env override such as AI_LUNA_MODEL to another model is refused, logged, nothing called), at most 2 physical calls per action (the third Luna fallback after a failed JSON retry is gone), 'low' reasoning headroom 2,500 to 1,000, user_budget kind and the limit message, Ask Mobi context capped at 12 KB (src/services/ai/contextBudget.js), account deletion unlinks runtime_ai_requests.user_id.
- Tests: data/tests/ai_user_cap.test.mjs (in test:learning). Recovery 352, app 343, auth 109, billing 118, learning 323 pass.

## 17 October 2026, about 4:35 am IST - Authored wave 3 published on production (153 questions; chemistry 48, general_test 56, physics 49)

- Applied by Claude (session 25ef3d95) under the owner's standing database grant and his 17 Oct publish rule: only questions whose two quality judges average 8 or more AND whose fit median is 8 or more, after the full wave 1-2 process (5 blind Haiku solvers with 4 of 5 on the key, 2 rubric judges, 3 fit judges, the acceptance rule, a Sonnet expert pass, 3-solver blind re-solves of every repair that changed solver-visible text (16 of 16 held 3 of 3), a full fresh pass on 7 reworded rows). Hindi stays out.
- Plan `docs/brain/reports/authored-w3/plans/wave3-publish-plan-production-2026-10-17.json` (hash 4743921360457bd1, 153 rows, no blockers); the same plan dry-ran select-only on staging and production first. The main session re-checked all 153 rows against the score entries before applying (0 failures).
- Live after: chemistry 424, gat 283, physics 350. Restore file `docs/brain/reports/authored-publish/authored-publish-restore-2026-10-16T23-05-06-939Z.json` (undo: `--mode=restore --restore=<that file> --expect-project=isrxrxzjocewrdureyhp`); also `supabase/undo/20261017120000_authored_wave3_publish.undo.sql`.
- Held for a later decision: 55 rows at 7-7.9 (`wave3-held-7-2026-10-17.json`). Dropped: 11 by the expert pass (7 Electronic Devices items confirmed outside the 2026 Physics syllabus, Unit 9 quoted in expert/physics.json), 24 by the first-pass rule, 2 duplicates.
- NTA mode: the rows show in practice now; they become NTA-eligible once the code carrying the merged data/nta_agent_scores and data/nta_fit_scores is deployed (this branch merges into the next website release).
- Suites on content/wave3-1017: test:nta 188, test:authored-publish 124 (4 skipped; the CRLF failure is fixed), test:recovery 352.

## 17 October 2026, about 3 am IST - Authored wave 3 prepared (branch content/wave3-1017, local, not pushed; nothing published, no database written)

- 294 drafts (general_test 97, physics 74, chemistry 74, hindi 49; source claude-authored-2026-10-17-w3) passed one blind Haiku check each (6 rejected). A second checker (Opus) solved a stratified 45 and then the whole of gat-02, hin-02 and hin-01 (107 rows) without the key: no wrong key, but 7 of the 45 had a defect (15.6 percent), so 3 batches were re-checked in full. Defects, repairs and advisories: docs/brain/reports/authored-w3/wave3-audit-2026-10-17.json. Repairs (28 rows) are text-only: Hindi chapter names, one passage typo, two explanations, three listed-order keys.
- Wave 3 did NOT go through the wave 1 and 2 scoring: no 5 blind solvers, no two agent judges, no three CUET-fit judges, no expert pass, so no score entries exist and the NTA engine admits none of the 294. Verdict values on the rows are haiku_blind_verified (187) and opus_audited (107), not ready or repaired.
- Dry run against production (select-only): 294 rows (chemistry 74, gat 97, hindi 49, physics 74), 5 Hindi passage groups, 0 existing ids, no missing columns; the one blocker is the missing score entries.
- Hindi: blueprint data/nta_blueprints/hindi.json (from the 2026 Hindi 102 syllabus PDF, which lists only Reading Comprehension and Verbal Ability; Kavya Khand, Gadya Khand, Anuvad and Rachnatmak Lekhan are excluded). Registered in the engine and in index.json pendingSubjects; Hindi is still not a public subject, so no route serves it. Two engine gates were Latin-only and refused every Hindi passage and match item; fixed (danda counts as a full stop, verse kept in lines counts, सूची-II is read as List-II).
- Tests: test:nta 188, test:recovery 352, test:authored-publish 93 of 94 (the failing one, "merging wave 2 again reproduces the committed tables byte for byte", fails the same way on origin/main on Windows: CRLF against LF), authored_w3 15.

## 17 October 2026, about 12:25 am IST - Batch 1016d production migrations applied (before its deploy)

- Applied by Claude (session cc0bf1af) under the standing database grant, in this order, each with a pre-check and a post-check on production (isrxrxzjocewrdureyhp); each was dry-run on staging per the batch merge report and has an undo in supabase/undo:
  - 20261016170100_webhook_event_lease: webhook_events.claimed_at (pre 0, post 1).
  - 20261016110000_study_weekdays: study_goals.weekday_mask plus the 1-127 check (pre 0, post 1 and the constraint).
  - 20261016140000_ai_reply_report: public.ai_reply_reports, RLS on, anon and authenticated cannot select, service_role can insert.
  - 20261016120100_funnel_product_steps: users.funnel_seen, the widened funnel_daily step check (0 rows broke it), funnel_count_once (service_role only, anon cannot execute). FUNNEL_ENABLED stays off.
- Not re-applied (already live): 20261016141000 questions lockdown (anon select on public.questions is false), 160100, 170000, 170300, 170400, submit_rival_battle; 170200 is a no-op on production.
- Production records these by apply time, not by the repo file names; keep applying by SQL, never `supabase db push`.

## 16 October 2026 - Batch 1016d assembled (branch deploy/batch-1016d from main 8a0141ba; local, not pushed, not deployed; nothing applied to production)

- Merged with --no-ff: fix/security-1016, fix/security-2-1016, db/status-1016e, fix/health-1016, web/usp-mocks-1016, web/revise-events-1016, web/parity-you-1016, web/weekdays-1016, web/ai-report-1016, web/college-search-1016, web/compass-card-1016, web/timed-nudge-1016, web/help-faq-1016, web/copy-1016, web/rival-mobi-1016, web/funnel-calls-1016, web/auth-cache-1016, web/egress-1016, web/art-1016, play-f4, sec-tests. Held back: fix/feed-keys-1016 (until the new app ships), web/credit-rpc-1016 and the credit_consume_fast_path migration (dropped), web/egress-practice-1016 (WIP), the practice-verdict migration, the landing, unfinished wip branches and the rejected lineages.
- Production migrations still to apply, in order: 20261016110000_study_weekdays, 20261016120100_funnel_product_steps (renamed from 120000, which is question_option_stats), 20261016140000_ai_reply_report, 20261016170100_webhook_event_lease. 20261016170200_server_only_functions_drift is a no-op on production. Each was dry-run on staging (undo, apply, smoke) inside a transaction that was rolled back; staging is unchanged.
- Verification: lint clean; test:app 343, recovery 352, learning 307, nta 185, du 41, auth 97, answer-integrity 11, billing 118 all pass; next build --webpack passes. Not looked at in a browser: Today (Compass, timed nudge, colleges), Progress badges, Account weekdays, Rival result, Help and the device switch, Lab empty state, the briefcase art. The briefcase files from web/art-1016 needed their sizes, feet and alt text updated in data/subject_art.mjs and startModel.mjs (the branch left the stamp's numbers); feet are estimated, the owner's OK on the briefcase is still pending.

## 16 October 2026 - AI reply report (Play generative-AI blocker) (branch web/ai-report-1016, local, not pushed, not deployed, nothing applied to production)
- Cherry-picked ff230163 (POST /api/ai/mentor/report) and reworked it: signed in only (bearer or cookie), two per-student limits (10 a minute, 40 a day, persistent when PERSISTENT_LIMITS_ENABLED), reason from the app's four labels (stored as a code), reply capped at 1200, body capped at 8000, and the reply must be one the student received (assistant message with the charge reference `prepos:<user>:<requestId>`, else a committed credit operation). One row per student per request id; the Idempotency-Key header is ignored. Logic in `src/lib/server/aiReplyReport.js`, tests in `data/tests/ai_reply_report.test.mjs` (in test:app).
- Migration `20261016140000_ai_reply_report.sql` plus undo in supabase/undo. Dry-run on STAGING (onwkqxmjqjrhfbjjdydu): apply, verify (RLS on, no policy, no anon or authenticated read or write, service role can write), undo, apply again. Staging now has the table. Production not touched. Run it before deploying the route; the app's Report key stays hidden until `aiReplyReportLive` is true in a build.
- Account deletion deletes `ai_reply_reports`. `/privacy` (16 Oct) now names the question stream events seen, attempted and skip as required app interactions and the AI reply report; the Play data-safety draft (PLAY-RELEASE-2026-10-16.md section 4, branch app/play-prep-1016) matches.

## 16 October 2026 - NTA index rebuilt on production after the signature fix shipped (batch 3, 8a0141ba)

- The index was emptied at 14:55 after its rows failed the runtime signature check (verified_at signed as Z, read back as +00:00). The fix 35a078e3 shipped in batch 3 (main 8a0141ba, Vercel READY, 0 runtime errors).
- At about 10:05 pm IST, Claude (session 604ced81, standing grant) ran scripts/nta-index-build.mjs from the live code: dry run (english 173, accountancy 135, business_studies 181, economics 164 = 653 rows; slim reads 0.32-0.43 MB against 5.3-6.6 MB full), then --write --allow-production.
- Verified at once with the read-only scripts/nta-engine-run.mjs on production: 0 score_signature_invalid; accountancy, business_studies and economics build 3 of 3 papers with factory-scored questions eligible (769, 93, 137). English refuses a full NTA paper (34 too few questions), as it did on 13 Oct before any index: a content gap, not the index.
- Switch-off if ever needed: truncate public.nta_question_index (the runtime falls back to the full read).

## 16 October 2026 - Production database: health migrations applied (leaderboard function, least privilege for browser roles, pinned search_path, payments policy)

- From the production health audit (docs/brain/PROD-HEALTH-2026-10-16.md) and branch fix/health-1016 (verifier PASS at 18567057). Each was dry-run on staging by the health fixers (applied, checked, undone), with undo files in supabase/undo/.
- Applied by Claude (session 604ced81) under the standing grant at about 7:20 pm IST, in order: 20261016160100_leaderboard_group_by (mm_leaderboard(), service role only; live code still pages until fix/health-1016 ships, then uses it), 20261016170000_browser_roles_least_privilege (revoke anon/authenticated on RLS tables with no policy; revoke execute on 10 server-only functions), 20261016170300_function_search_path (17 functions pinned to public, pg_temp), 20261016170400_payments_policy_initplan (same rule, (select auth.uid()) form).
- Pre-check: mm_leaderboard missing; 23 RLS-no-policy tables open to the browser roles; 6 server-only functions executable by anon; 7 unpinned functions; payments policy per-row auth.uid(). Post-check: mm_leaderboard returns 794 rows and anon cannot execute it; 0 open tables; 0 anon-executable server functions; 0 unpinned; policy in the select form; service_role still reads attempts. Live smoke after: /, /pricing, /api/stats, /leaderboard, /api/leaderboard all 200.
- Undo, newest first: supabase/undo/20261016170400_payments_policy_initplan.undo.sql, 20261016170300_function_search_path.undo.sql, 20261016170000_browser_roles_least_privilege.undo.sql, 20261016160100_leaderboard_group_by.undo.sql (files on fix/health-1016).

## 16 October 2026 - Production database: missing submit_rival_battle applied (Rival submissions were failing closed)

- Found by the post-crash reconciliation: live code (src/services/ai-rival/scoreRivalBattle.js) calls rpc submit_rival_battle, but production never had the function (migration 20261002122000_rival_atomic_submission.sql was saved but not applied). Any Rival submission would have returned 503 battle_submission_temporarily_unavailable. No student was affected today: the last Rival battle was created 7 May 2026.
- Dry run on PRODUCTION inside a rolled-back transaction (staging has no Rival tables): create the function, insert a throwaway battle, submit two answers, replay the same submission. Result: first and replay calls return the same response, status submitted, 2 answer rows; after ROLLBACK no leftover rows and no function.
- Applied by Claude (session 604ced81) under the owner's standing database grant at about 6:15 pm IST, service role execute only. Undo: supabase/undo/20261002122000_rival_atomic_submission.undo.sql.

## 16 October 2026 - The Mob (social loop) server and website, SP-1 and SP-2 (branch web/ux-social-1016, local, not pushed, not deployed, NOT applied to production, MOB_ENABLED off)

Spec `mockmob-next/docs/design-decisions/pass-1016e/SOCIAL-SPEC.md`. App contract `mockmob-next/docs/design-decisions/pass-1016e/SOCIAL-APP-CONTRACT.json` (shapes, errors, limits, copy and the six fixture bodies). Design note `docs/design-decisions/web-mob-1016.md`. Nothing grants, spends or rewards credits; an invite tied to credits is left as TODO(owner D-S4).

- **Migration** `supabase/migrations/20261017100000_mob.sql` (9 tables, 14 functions, RLS on, service role only), undo `supabase/undo/20261017100000_mob.undo.sql`.
- **Staging (onwkqxmjqjrhfbjjdydu, execute_sql, no migration-history row):** applied, undone (0 tables, 0 functions), re-applied (9 tables, 14 functions, RLS on, anon and authenticated have no table or function grant). A smoke run inside one transaction that raised at the end (create, invite, lookup, 2 joins, already, sitting and its repeat, nudge count 2, seen, report, block, leave passes the owner role on, remove, last leave closes the Mob) left no rows. Then the real service over PostgREST (4 temporary staging users, fake question bank and practice start): create, invite, lookup, 3 joins, 3 starts, 3 sittings, the trap for a sitter and none for a non-sitter, show score, nudge and its repeat refused, nudge seen, report, non-owner remove refused, leave and block, blocked rejoin refused as an invalid code, owner leaves and the next member becomes owner; every row and the 4 users were deleted afterwards (all 9 tables at 0). **The migration stays applied on staging for the app walk.**
- **Account deletion:** the processor keeps the users row as a tombstone, so nothing cascaded and its fail-closed guard would have refused to delete any student in a Mob. `DELETION_STEPS` now names every mob_* table (tested on PGlite with the real processor).
- **Verification:** `data/tests/mob.test.mjs` 21 tests (now in `test:app`); `test:app` 344, `test:recovery` 359, `test:learning` 302, `test:auth` 52, all pass (run before the Today wiring and the mob test joined test:app). eslint clean on every touched file. On the shared dev server (3181) with one headless Chrome over CDP and real pointer clicks: `/preview/arena?view=mob` in 10 fixture states and `view=join` signed in, signed out and invalid, at 360, 390 and 1440, Night and Day, every control at least 44 px and the topmost element at its centre, no sideways scroll, no console error; member menu, report, Escape returns focus, nudge reply, show-score switch, invite dialog and start a Mob clicked; reduced motion leaves no animation. Captures: `mockmob-next/tmp/mob-web-1016`. With MOB_ENABLED unset the API answers 404 MOB_DISABLED; `/mob` renders the not-found page (HTTP 200 on the dev server because the arena layout streams first).
- **Not done / gates:** owner decisions D-S1 (minors), D-S2 (paper cost; built as a quick 10), D-S3/SP-0 (leaderboard privacy fix, not touched), D-S4 (invite rewards, not built); the Practice row, Review trap row and result-page line (other packets' files); the Mobi moment on Today; the /admin/funnel Mob block; the privacy page section (with the change that enables the flag); `next build --webpack` not run here (the shared dev server serves this worktree); applying to production.

## 16 October 2026 - Production database: slice 5 refresh v2 applied; first refresh filled 461 questions in 13 s

- Applied by Claude (session 604ced81) under the standing grant at about 11:10 IST: migration 20261016130000_question_option_stats_refresh_v2 (create or replace of refresh_question_option_stats; same signature, grants and results as v1, proven by the v1/v2 equality tests on PGlite; staging dry run 1.2 s at production size, then undone).
- First production refresh: 13 s; 461 questions, 13,877 first answers counted (the same 461 questions as the committed snapshot), 0 timed answers yet (no question has 10 or more timed first answers since the 15 Oct capture), so every cohort-time line stays hidden, as designed. refreshed_at 2026-10-16 05:40:41 UTC. The nightly pass on /api/internal/refresh-inventory keeps it current once batch 1016c ships.
- Undo: supabase/undo/20261016130000_question_option_stats_refresh_v2.undo.sql (restores v1), then the v1 undo drops the table and function.

## 16 October 2026 - Production database: slice 5 table question_option_stats applied; first refresh timed out, nothing written

- Applied by Claude (session 604ced81) under the owner's standing database grant at about 10:35 IST to production isrxrxzjocewrdureyhp: migration 20261016120000_question_option_stats (table question_option_stats, RLS on, service role only; function refresh_question_option_stats(), service role only). Staging dry run passed earlier (web/slice5-1016 13347c3e).
- The first `select public.refresh_question_option_stats()` on production hit the 2-minute statement timeout (57014) at production size (1,815 attempts, 35,067 answers). It runs in one transaction, so nothing was written: the table is empty and the website falls back to the committed snapshot of other students' picks exactly as before slice 5. The live code (09421b29) does not read the table yet.
- Next: an optimised function (migration 20261016130000_question_option_stats_refresh_v2, being written on web/slice5-1016 with v1/v2 equality and volume tests) replaces it before batch 1016c ships; then one manual refresh, and the nightly pass on /api/internal/refresh-inventory keeps it current.
- Undo: supabase/undo/20261016120000_question_option_stats.undo.sql (drops the function and the table; derived data only).

## 16 October 2026 - Mistake Lab v4 slice 5: cohort time (branch web/slice5-1016 from the 1016 batch merge c87407e0; local, not pushed, not deployed; NOT applied to production)

Spec `mockmob-next/tmp/mistake-lab-v4/SPEC.md` 4.13 and "Slice 5". The owner decision on shared anchor questions per NTA paper is deferred and not built.

- **Migration (not applied to production; needs the owner's standing database grant):** `supabase/migrations/20261016120000_question_option_stats.sql`, undo `supabase/undo/20261016120000_question_option_stats.undo.sql`. One table `question_option_stats` (one row per question; no user id, no attempt id; RLS on, no policy, service role only) and one function `refresh_question_option_stats()` (service role only, one advisory lock, idempotent, deletes rows of questions that stop passing the guards). First answers only (the 15 Oct export's own rule), the same truth guards as `scripts/cohort/question_picks.sql`, today's key by option-text hash, under 10 students no row. Time is the paper trace's one rule rebuilt in SQL (away time out, set and sheet pages, the 30-minute break only on records with no away data), used only for server-scored records that matched the answers and carry an end event, per question 2 s or more with no break. "Changed" is the ledger's own (`observed.answerChanges`); "moved off the key" is first pick on the key and final answer off it; strike data is a captured record from the web runner or holding a strike-out. The sorted whole-second right-answer times are stored (up to 1,000 a question) so the student's own time can be left out exactly. Columns: option picks, first-answer right count, timed counts and median and quartiles (right and wrong), changed, moved-off-key, strike basis, struck key, first and last first-answer dates, `counted_through`, `refreshed_at`.
- **Staging dry run (onwkqxmjqjrhfbjjdydu, via the Supabase MCP, production not touched):** the migration applied, the refresh ran twice on the real staging data (6 attempts: 0 rows, correct, nobody reaches 10), then a synthetic run inside one transaction that raised at the end to roll back (36 attempts of 12 captured students on 3 live questions): 3 rows with the exact medians, quartiles, changed, moved-off-key and struck counts I computed by hand; the rollback left 6 attempts and 0 stat rows; RLS on, anon and authenticated have no table or function grant; then the undo ran and the table and function are gone. Staging is back as it was (I used `execute_sql`, so no migration-history row was written).
- **Nightly refresh:** no cron added (`vercel.json` untouched). `/api/internal/refresh-inventory` now runs `refreshCohortStats` (`src/lib/server/cohortStats.js`) after the inventory work, within `min(120 s, 250 s minus time used)`, production only (`data/full_bank_guard.js`); a failure, a missing table or a timeout is a log line and a `cohortStats` field in the body and never changes the status (403, 409, 503 and 200 are the inventory's own). The inventory's own 409 (not production) still returns before it. When `web/ntaidx-1016` merges, its NTA index pass sits in the same route: keep both passes, the NTA index first, then the cohort table (a textual merge conflict, no logic conflict).
- **Read path:** `readCohortWithTime` (the attempt route's cohort reader). A table whose newest `refreshed_at` is at most 48 hours old is the source (its rows become a snapshot for the unchanged `cohortForAttempt`, so the guards and the student's own first-answer subtraction are the same code); a missing, empty or stale table, or any failed read, falls back to the committed snapshot exactly as before, with no time line. `data/cohort_time.js` leaves the student's own first answer out of the picks, the median (from the stored seconds), and the changed, moved-off and strike counts, using the same reliability rules as the SQL on the student's own record; if the student's own time is not among the stored times, nothing of theirs is taken out. Gates in `LAB_RULES` (30 timed right answers; 20 timed students; 20 with strike data; 5 slow questions each with 15 or more timed right answers; strictly more than twice the median; own record must have ended). Sentences in `data/mistake_lab.copy.json` (`cohort.time`); additive fields `others.lines` and `cohort.slow` (absent when no gate passes, so every existing contract file is byte for byte unchanged).
- **UI:** the lines are in the opened answer under "How others answered" (same class, the secondary ink after the first line, `text-wrap: pretty`) and the ledger finding is a second paragraph and chip row in the existing cohort block. No new decoration. Dev preview `/preview/arena?view=result&mock=full&cohort=time` (every gate met) and `&cohort=time-gated` (one short of each).
- **Verification:** `test:recovery` 272, `test:app` 328, `test:learning` 277, all pass. New `data/tests/cohort_time.test.mjs` (30: every gate at its boundary, forms, student left out, fallback over a fake client for missing, stale, empty and failing tables, refresh over a fake client for ok, skipped, missing, failed, thrown, timeout and not-production, the refresh run twice gives the same result, the Lab with every gate met and one short of each, no new cron) and `data/tests/cohort_time_sql.test.mjs` (11, on a real Postgres via PGlite: the migration, idempotent re-apply, the undo, privileges, first answers only, the under-10 gate, guards, the cutoff, idempotent refresh, a break, and the SQL's time, changed, moved-off and strike numbers equal to `ownContribution` over the five replay papers, including passage sets, the submit sheet and an NTA paper). Both are in `test:recovery`. eslint clean on every touched file. Captured on my own dev server (port 3170, stopped) with my own headless Chrome over CDP, real pointer clicks, at 390x844 and 1440x900, Night and Day, three fixture states, no sideways scroll and no console error: `mockmob-next/tmp/mistake-lab-v4/slice5-captures`. Design note: `docs/design-decisions/web-slice5-1016.md`.
- **Not done / gates:** applying the migration to production (owner's standing grant; run the refresh once afterwards and read `refreshed_at`); until enough papers carry the 15 Oct capture almost every line stays hidden, which is the intended behaviour; the Android app does not render the new fields yet; no instrumentation for the lines; the first production refresh has not been timed (the function is set to stop at 120 s and the route does not wait longer).

## 16 October 2026 - Monthly pay gate: visual and honest-money pass (branch web/pay-monthly-1016, local, not pushed, not deployed, nothing applied to production, no Razorpay call)
- Gate on a dev server (port 3160, webpack) with real pointer clicks, 390x844 and 1440x900, Night and Day, env unset and a fake plan id set in the process environment only. Findings, fixes and the evidence IDs are in `docs/design-decisions/web-pay-monthly-1016.md`.
- Fixed: the first-payment confirmation was lost after checkout; a pending payment re-offered Start Pro; the charge-on-start and renewal terms moved above the button; Account names the rupees and next payment, has a lapsed state, a retryable cancel and switches at once after a cancel; a failed payment with Pro off no longer offers a refused action; /refunds follows the plan setting; PrepOS, Radar and XP removed from /pricing; table labels, dead band and nested confirm card fixed.
- Verified: lint clean; test:app 268, test:auth 52, test:recovery 182, test:learning 277, test:billing 87 (11 new); `next build --webpack` passes (the default Turbopack build fails on the node_modules junction in this worktree). Not covered: real Razorpay modal, screen reader, reduced motion, real device.
- Open: the shared mobile dock arrow and price note (landing owner), "Open PrepOS" in the Account wallet strip, runbook Part 2 TEST run still to do.

## 16 October 2026 - Q8b finished: nta_question_index kept current by every publish path and the existing daily cron (branch web/ntaidx-1016, local, not pushed, not deployed, nothing applied to production)
- vercel.json is back to its two crons (finalise-sessions, refresh-inventory): the third entry added on 15 Oct is removed. The daily safety rebuild now runs inside `/api/internal/refresh-inventory`, after the inventory refresh, with a 250 s start deadline; `/api/internal/rebuild-nta-index` stays for manual runs (`?subject=`, `?force=1`). It rebuilds a subject only for `newer_questions`, `content_changed` (content-hash drift of an indexed question) or `max_age` (7 days), oldest first; a repeat run writes nothing; one log line per run (`describeNtaIndexRun`) and the outcome under `ntaIndex` in the response; an index failure never changes the inventory status code.
- Publish paths wired (`data/nta_index.js`): authored publish (already), `question-republish.mjs`, `question-hold.mjs --mode=restore`, `question-reorder.mjs` (keep-live apply, restore, release), and the factory/worker (`publishFactoryQuestion`, `publishFactoryGroup`, `publishQuestion`) through a throttled queue (at most one rebuild per subject per 30 minutes, flushed at batch ends; `NTA_INDEX_REBUILD=off`). Concurrent rebuilds of one subject are serialised with one follow-up run. Website routes (moderation, uploads, admin factory) publish no indexable question; a test pins that.
- `_userProgress` chunked (`data/practice_progress.js`, chunks of 100 ids, 4 in flight, partial failure flagged and logged): above about 700 ids the single `.in()` was refused and the history was silently ignored (Accountancy). `_weakConcepts` had the same cliff plus the 1000-row cap; it now pages and chunks. Decision: id chunks, not a per-subject scan, because that keeps the result identical for rows whose `subject` is null.
- Tests: new `nta_index_maintenance.test.mjs` (10, in test:nta), `practice_progress.test.mjs` (7, in test:app), `ntaIndexFakeDb.mjs` shared fake; vercel_config pins two crons. test:nta 180, test:recovery 182, test:app 275, test:factory 332, question-reorder 25 (1 skipped) pass; eslint clean on data, src/app/api, scripts/pipeline and the touched scripts. test:authored-publish 78 of 79 with the same one failure as before ("merging wave 2 again reproduces the committed tables byte for byte"; CRLF in the committed agent tables on this checkout, code this change does not touch).
- To switch on, the owner needs: apply migration `20261013190000_nta_question_index.sql`; set `CUET_EVIDENCE_SIGNING_KEY` in Vercel production and redeploy; run `scripts/nta-index-build.mjs --write --allow-production` once. See the runbook section "Switching it on".

## 16 October 2026 - Production database: five additive tables for the 1016 batch applied (trap_atlas, revise_cards, my_colleges, app_errors, funnel_daily)

- Why: the 1016 batch (deploy/batch-1016) reads and writes these tables: Mistake Lab slice 4 (trap atlas, Revise), My colleges (Today, Compass, Account), app crash reports, and the landing funnel. The live code (77713336) does not use them, so applying them before the deploy changes nothing for students.
- Applied by Claude (session 604ced81) under the owner's standing database grant (14 Oct), at about 04:20 IST, to production isrxrxzjocewrdureyhp, in this order: 20261015210000_trap_atlas, 20261015210100_revise_cards, 20261016090000_my_colleges, 20261016100000_app_errors, 20261015233000_funnel_daily. Each was dry-run on staging onwkqxmjqjrhfbjjdydu first by the batch merger, with a rolled-back smoke test. None of the five tables existed in production before.
- Verified after: all five tables have row level security on, no policies, and table grants only to postgres and service_role. The seven functions (record_trap_atlas, my_colleges_replace, my_colleges_add, my_colleges_remove, app_error_record, app_errors_top, funnel_increment) are executable only by postgres and service_role. No rows were written.
- Undo, newest first: supabase/undo/20261015233000_funnel_daily.undo.sql, 20261016100000_app_errors.undo.sql, 20261016090000_my_colleges.undo.sql, 20261015210100_revise_cards.undo.sql, 20261015210000_trap_atlas.undo.sql. Run the undo only after rolling the website back to a build that does not use the table.
- Still owner-gated: FUNNEL_ENABLED stays off until the owner sets it; nta_question_index (web/ntaidx-1016) is not applied.

## 15 October 2026 - Q8b: nta_question_index kept current (branch web/q8b-1015 from production 3fc0095b, local, not pushed, not deployed, no migration change, nothing applied to production)
- (a) `scripts/question-publish-authored.mjs` apply rebuilds the index rows of the touched subjects after a clean read-back (`data/nta_index.js` `rebuildNtaIndexForSubjects`; never fails the publish; skipped without the signing key or the table; `--no-index-rebuild`). (b) New daily cron `/api/internal/rebuild-nta-index` (vercel.json `0 22 * * *`): production only via `data/full_bank_guard.js`, existing CRON_SECRET or x-internal-secret check, rebuilds only subjects whose index is older than their newest live question, one subject read at a time, 240 s deadline, skips never-built subjects. (c) `data/nta_pool.js` falls back to the full read when the subject's index is older than its newest live question (`data/nta_index_freshness.js`: max verified_at against max created_at or live_at; a failed check also falls back; `timings.indexStale`). `scripts/nta-index-build.mjs` now uses the shared builder and stamps verified_at per subject. Runbook updated.
- Tests: new `data/tests/nta_index_fresh.test.mjs` (14, in test:nta), publish hook test in authored_publish, vercel_config now pins three crons. test:nta 169, test:recovery 182, test:app 235, answer-integrity 11, question-reorder 25 (1 skipped) pass; test:authored-publish 78 of 83 with 1 failure, "merging wave 2 again reproduces the committed tables byte for byte" (agent biology), in code this change does not touch. eslint clean on the changed files. Staging check (read only): the columns the check reads exist and accountancy's index (built 15 Oct 16:07) is newer than its newest question.
- Production gates unchanged: apply `20261013190000_nta_question_index.sql`, run the build with `--write --allow-production`, set CUET_EVIDENCE_SIGNING_KEY in Vercel production before the cron can rebuild.

## 15 October 2026 - Usage limits: A5 slim session start and A6 nta_question_index prepared (branch web/fix5-1015 from main 3be06112, local, not pushed, not deployed, migration NOT applied to production)

- A5 `data/practice_pick.js` (used by `Database.getQuestions` for Quick, Smart and Full; NTA mode and `data/nta_engine.js` are untouched): a session start reads the subject's questions WITHOUT the `evidence` and `provenance` columns (every other column, plus three json-path columns that place an evidence row), ranks and picks on those, then reads full rows only for the picks and the newest-N window the usage meta looks at. Evidence-managed rows (136-181 per Commerce subject, about 35-40 KB each, 65-75% of the bytes) are presumed eligible until their full record passes `readablePracticeQuestions`; rows that fail are dropped and the picks re-run (up to 8 rounds). Anything not provably identical (recency threshold straddling, empty after verification, too many rounds, any read error) falls back to the old whole-subject read, as does `PRACTICE_SLIM_READ=off`. The light pool is kept 5 minutes per server and subject (`PRACTICE_POOL_CACHE_MS`); the picks themselves are always re-read fresh and re-checked.
- Comparison test `data/tests/practice_pick_parity.test.mjs` (in `test:app`): before (whole-subject read) against after (slim read) over 6 generated subjects (legacy rows, signed eligible evidence rows, stale/bad-signature/changed/factory-looking rows), Quick, Smart and Full, with progress, recency, weak topics, holds, exclusions, chapters, difficulty, requireEvidence and passages: picks, order, tiers, usage meta, validation and every returned row are deep-equal; fallbacks are rare. Also run on real staging data (666 evidence rows, real signatures): identical picks for accountancy Quick 10, business_studies Full 50, english Smart 15, economics Quick 25.
- Bytes per start, production figures from SQL on 15 Oct (full read -> slim read, JSON bytes): Accountancy 8.3 MB -> about 3.5 MB (10 questions), Business Studies 7.4 -> about 1.7, Economics 7.1 -> about 1.8, English 6.2 -> about 1.7; a 50-question Full mock reads about 3 MB for the three smaller subjects and about 5 MB for Accountancy. With the 5-minute light pool warm, Business Studies Quick is about 0.8 MB. Real gain is roughly 3-5 times fewer bytes per start (not 10 times): every evidence row must be read to be verified, and the evidence rows are what most picks are. A further step would need the verified verdict stored per row.
- A6 `supabase/migrations/20261013190000_nta_question_index.sql` is unchanged; its undo is `supabase/undo/20261013190000_nta_question_index.undo.sql` (outside `migrations/` so the CLI never applies it); runbook `docs/brain/RUNBOOK-NTA-QUESTION-INDEX-2026-10-15.md`. Dry run on staging onwkqxmjqjrhfbjjdydu (15 Oct, owner's 14 Oct database grant): migration applied (RLS on, only service_role grants, 2 indexes), `scripts/nta-index-build.mjs` dry run then `--write` indexed english 156, accountancy 105, business_studies 162, economics 112 (all loaded rows verified; slim 0.25-0.39 MB against 4.2-5.9 MB full), `loadNtaPool` read source `index`, the undo dropped the table and NTA mode fell back to `full` at once, then the migration and index were put back on staging. Production was not touched: `nta_question_index` is absent there (checked), questions.id is text with a primary key, roles anon, authenticated and service_role exist.
- Verified 15 Oct: `test:recovery` 145, `test:nta` 155, `test:learning` 277, `test:app` 232 (new parity test), `test:auth` 50, `test:answer-integrity` 11, `test:factory` 332, all pass; `test:question-reorder` 25 of 26 (one skipped); eslint --max-warnings 0 clean on the changed files; `npm run build` 76 of 76 pages (turbopack root set to the parent folder for the junction, then edited back; not committed). Not caused by this change (data tables, no file of this branch touched): `test:authored-publish` fails "merging wave 2 again reproduces the committed tables byte for byte" (agent biology) and `test:study` fails the WordNet "LICENSE_UNAVAILABLE" check.
- Deploy gates: (1) deploy A5 after the owner OK; first practice start in each Commerce subject logs `[practice-pick] {"rounds":2,...}`; `[practice-pick] slim_fallback` or `slim_error` lines mean the old read ran (watch for them). Rollback: set `PRACTICE_SLIM_READ=off` in Vercel and redeploy, or redeploy the previous deployment. (2) A6 production apply is the orchestrator's: apply the migration, verify, then run the index build with `--write --allow-production` from a machine that has the production keys; until rows exist NTA keeps the full read (no behaviour change). (3) Open, owner decision: `Database._userProgress` sends every pool id in one `.in()` URL and swallows the error; on staging a 800-id list returns HTTP 400, so for pools of about 700 ids or more (Accountancy, 1,405) the student's history is silently ignored in ranking today. A5 keeps that behaviour identical on purpose; chunking the call (150 ids a time) would make Accountancy honour history and change its picks.

## 15 October 2026 - Usage limits: fixes A1 to A4 from USAGE-LIMITS-DIAGNOSIS-2026-10-15 (branch web/usage-fixes from main 48309076, local, not pushed, not deployed)

- A1 counts refresh once a day: `publicInventory` (home page, dashboard, practice quote, app) serves the stored `public_inventory_snapshot` row and never counts; the 15-minute `after()` refresh and the inline count on a missing or day-old row are gone. Only the daily cron (`/api/internal/refresh-inventory`, 21:30 UTC) recounts. A row older than 36 hours is still served, marked `stale: true`, with one `[inventory]` log line; with no usable row `/api/stats` answers its existing 503 `unavailable` (no-store) and the quote its existing `inventory_unknown` (nothing charged). A failed snapshot write now fails the cron instead of being ignored. Production row checked read-only on 15 Oct: present, `available`, 8,197 questions, refreshed 3 minutes earlier.
- A2 evidence files once per server: `sharedEligibilitySnapshot()` in `data/evidence_registry.js` parses `calibration_manifest.json` and `source_registry.json` once per instance (frozen, re-read only if a file's size or mtime changes, a failed read is never remembered) and is passed by answerReviews (result page), Mistake Repair, the learning plan (also its pathway registry read), `/api/sessions/[id]/check` and question moderation in `data/db.js`. Local measure: 50 checks 2,051 ms before, 17 ms after (about 40 ms for the one parse); about 11 MB of heap per instance. Verdicts equal a fresh read on 17 fixtures bound to the shipped files (one eligible, the rest covering every refusal kind).
- A3 `vercel.json` `"regions": ["sin1"]` (Singapore, AWS ap-southeast-1; the production Supabase project isrxrxzjocewrdureyhp is ap-southeast-1). Hobby allows one region; crons unchanged.
- A4 `data/full_bank_guard.js`: whole-bank reads (the inventory refresh, `Database.getAllQuestions`) run only when `VERCEL_ENV === 'production'`; anywhere else one `[full-bank-read] blocked` line and the cron route answers 409 `full_bank_read_blocked`. Local servers and agents get the stored counts. The admin factory dashboard's bank read is not guarded (local commissioning against staging uses it). Fix 5 (practice start selection) untouched; no .env file changed.
- Verified 15 Oct: `test:recovery` 145, `test:learning` 277, `test:app` 224, `test:auth` 50, `test:du` 19, all pass (new: evidence_shared_snapshot, inventory_snapshot rewritten, full_bank_guard, vercel_config; evidence_snapshot added to test:recovery); `test:nta` 154 of 155: the CPU-timed "2,000-question pool" test ran 3.0 to 4.1 s against a 3 s target with the machine at 100% CPU, and none of its 70 imported files changed. eslint clean on the 15 changed files. Production build (Turbopack, root pointed at the parent folder for the node_modules junction, then reverted) compiled, 76 of 76 pages.
- Deploy gates: owner OK to deploy. After deploy check (1) the first 21:30 UTC cron logs `[inventory] daily refresh stored N questions` (a 409 would mean `VERCEL_ENV` is not exposed to functions: Settings, Environment Variables, system variables), (2) the deployment shows `regions: ["sin1"]` and `/api/stats` answers 200, (3) Supabase gateway logs show no whole-bank `questions` reads outside the cron. Expected: about 25 of 26 daily whole-bank copies gone (about 1 GB a day of raw egress), per-question evidence parsing gone from result, repair, plan and check paths, and database round trips from about 220 ms to a few ms.

## 15 October 2026 - Website v2 deployed (branch web/v2-1015 to main)

- What: the live site made richer (owner rejected the cut-down restructure): logo B only, brand switch (Bricolage plus lamp-lit 3D subject objects), held scroll stories on phones and desktop (Lab, feature tour, Mistake Lab), the statement shelf, livelier Mobi, designed controls, the Start key and sheet, the account page, 2-step onboarding, Practice tiles with lit objects, arena phone polish, copy pass without hedges; Mistake Lab v4 slice 1 on the result page (marks ledger, first-pick re-mark, how others answered; cohort snapshot data/cohort/question_picks.v1.json, aggregates only).
- Checks before push: eslint clean on 47 changed files; test:app 213, learning 277, recovery 71, auth 50, nta 150, du 19; production build 76/76 pages; headless sweep at 360 and 1440 px with no sideways scroll and no console errors; two critic and fix rounds on phone and desktop captures (mockmob-next/tmp/web-v2-pass2).
- Not in this deploy: Mistake Lab slice 2 (capture, one time rule, Replay) stays on web/alive-1015 until its fixes pass.
- Rollback: redeploy the previous production deployment in Vercel (main was 11e30ec3).
## 15 October 2026 - Mistake Lab v4 slice 2: capture, one time rule, Replay, passage sets and the submit sheet, independently verified (branch web/alive-1015 and ui/phase2, local, not pushed, not deployed)

Spec `mockmob-next/tmp/mistake-lab-v4/SPEC.md` 4.5, 4.6, 6 and 8. Web commits 49760343, 5551d2e3, acb7bb0b, c7911899, 365f5211, 5a386558, dd7a45e9, 299a822f; app commits e4144e87, 8d8c07a5, c4cd5dac, 57aed8a9. No migration: `record_recovery_events` checks only seq and clock.

- Server: accepts end, away, back, strike and via on a visit (next, previous, palette, swipe, resume, set, sheet), keeps marks; `data/paper_trace.js` is the one time calculator for Time and decisions, the ledger, the Replay, the session read and PrepOS. Rule 5: a question shown with its passage set (via `set`) counts as opened, never as time. Rule 6: from a `sheet` visit (the submit sheet or the NTA submit check) to the next visit or answer, time is on no question. A time-up that reaches the server after `expires_at` keeps its end at the paper limit, only when every earlier event is already stored (`lateTimeUpEnd`); nothing is added to the session log.
- Web runner: capture is data only. A passage page records every other question of its set (via `set`) before the question in focus; the submit sheet and the NTA submit check record a `sheet` visit; strike parity with the app; the 5,000-event record keeps room for answers. App: the same capture, the submit page as a `sheet` visit, the practice result on the one time rule (`lib/core/domain/paper_trace.dart`, a port), and `OldServerFallbackApi`, which resends a refused save or submit with the event set an older server knows.
- Verified 15 Oct (independent check): `test:recovery` 138, `test:nta` 155, `test:learning` 277, `test:app` 147, all pass; eslint clean on the 27 changed files. `runner_nta_ui.test.mjs` is unchanged since c7911899 and the old-payload golden (`score_session_golden_v1.json`) since 49760343; both pass. 3,000 random old-format records through the 5a386558 modules and HEAD give identical trace, Time and decisions, ledger, PrepOS dwell and session read; the Replay differs only in the new denominators and in return-visit time that now leaves out time away. Time and decisions on the Business Studies and English passage fixtures matches a hand count (for example Q41 3m 10s, Q43 50s until the sheet at 49:40, Q45 and Q50 shown only). App: analyze clean apart from one warning in another session's uncommitted test edit; `test/unit/result`, `practice` and `runner` 836 pass; `test/golden/runner` and `result` 168 pass with the runner goldens untouched; the five replay contracts and inputs are byte-identical to the web's.
- Fixed in the check (299a822f): `onScreenQid` used `Array.prototype.findLast`, which Next.js does not polyfill, outside any try just before the NTA submit check; on a browser without it the Submit test button would have thrown. It is now a plain loop, and the sheet visit is recorded inside a try.
- Deploy gates: deploy this server before any APK built from ui/phase2 (the app's fallback is a safety net, not the plan: a server deployed in the middle of a paper whose app restarts before the submit can still meet EVENT_CONFLICT). `next build` was not run in this check (about 2.6 GB of RAM free); the Replay change in dd7a45e9 was not rendered in a browser.
- Open, owner decision: web passage records made before set visits existed still read their unanswered, never-focused sub-questions as never opened (no inference from passage group ids, so old payloads read exactly as before). Low: on the web a tab closed within a frame of an answer tap can leave the saved draft one answer behind its events (as before slice 2).

## 15 October 2026 - Time and decisions restored in the Lab, website and app (branch web/alive-1015 and ui/phase2, local, not pushed, not deployed)

What was lost: 236c49c6 replaced the Lab's "Replay your decisions" slider (every visit and pick with its time, and the net first-to-final marks effect) with a folded change log; 220e8d51 then hid the whole Find step (rushed-pick and changed-answer observations) on Full and NTA results once the SWOT was ready. Per-question time was left only as a bare "2m 41s" chip; nothing compared it with what the paper allows, and the app never showed time or when an answer changed (only "Answer changed").

- `data/time_decisions.js` (pure, free, no model): the paper's pace (durationMinutes, else the mode's limit in test_modes), per-question time from the device timeline (gaps over 30 minutes left out and said so; the last question on screen is "At least"), median over 10 or more timed questions, revisits, every pick with its paper-clock time and the gap since the previous one ("Picked B at 0:42. Changed to C at 1:55, 1m 13s later."), the marks effect of each question's changes and the paper's net, the time split by right, wrong and blank, and the 5 longest questions. Held or corrected questions keep their times and leave the marks effect. No cohort numbers: there is no cross-student time data yet.
- Website: the Lab's Find step is back on every result (1 Find, 2 Repair, 3 Prove). With the SWOT ready it shows only Time and decisions (no second chapter list); without it, chapters and observations first, then Time and decisions (the changed-answers observation is dropped there, the list replaces it). Each opened answer shows "Your time and picks"; its repair then leaves out its own change and time record lines so nothing repeats. The folded log keeps only the playbook note. `src/components/result/TimeDecisions.jsx`, `time-decisions.css`.
- App (ui/phase2, commit 3feab035): the same read ported line for line (`lib/features/result/model/time_decisions.dart`), a Time and decisions section after "Where the marks went" and "Your time and picks" in each answer. The app already records visit and answer events in every runner (practice, Full, NTA) through the session engine, so no recording change.
- Verified 15 Oct (Claude): eslint clean on the changed files; `test:recovery` 48 of 48 (with the new `time_decisions.test.mjs`), `test:learning` 274 of 274; a server render of TimeDecisions on a generated 50-question NTA paper (no undefined or NaN). App: analyze clean, result tests 47 of 47 (new time_decisions_test and time_section_test with the same fixture sentences). Not rendered in a browser or on a device (no dev server or emulator this run).

## 15 October 2026 - Mistake Repair v3 and the post-mock SWOT on the website (branch web/alive-1015, local, not pushed, not deployed)

Built from `mockmob-next/tmp/repair-v3/SPEC.md`. Nothing is migrated: trap type and prompt version live in `ai_credit_reservations.receipt`; the SWOT and the record lines are computed per request from rows the attempts route already reads.

- Repair v3 (server): `REPAIR_PROMPT_VERSION` (default 3; set `REPAIR_PROMPT_VERSION=1` to roll back to the v1 prompt and payload). The call gets a typed trap, why the key is right, optional contrast, one line for each option that is neither the pick nor the key (all or none), rule, memory hook and "another way" in one call and one credit, `maxTokens` 1400 (`providerCore.generateAIResponse` takes an optional `maxTokens`, clamped 200 to 2000, default unchanged). The model's "next step" is gone: "Do this next" is the real `Practise 5 on {chapter}` action. Every field is trimmed to a sentence end, checked for claims about the student and for contradicting the key, and a bad optional field is dropped, never the repair. Stored v3 responses also carry the `why_tempting` and `key_idea` aliases and `pattern`; stored v1 and v2 payloads come back without `version`.
- Trap pattern: `data/repair_pattern.js`. One line from the student's own typed repairs: in a chapter, at least 3 typed repairs with at least 2 sharing the trap; else in the subject, at least 5 with at least 3 sharing it and at least 30%; v1 and v2 repairs count in neither number. The line is dated from the earliest repair it counts, in India time ("Since 9 Oct, 2 of your 3 repairs in Goodwill had this trap."), so it is the whole count for that period; an untyped repair inside the period that could be in scope (a v1 rollback) or an undated counted repair gives no line. A failure or a read over 1.5 s gives `pattern: null`, never a failed repair.
- SWOT (free, no model): `data/attempt_ledger.js` (one set of per-chapter counts for the paper and the record), `data/mistake_insights.js` ("From your record" lines per wrong answer), `data/mock_swot.js` (four quadrants, "Do these next" plan of up to 3 rows, later lines). Full and NTA mocks only; practice attempts get `not_available`. `GET /api/attempts/[id]` gains `mistakeInsights` and `swot` (each in its own try/catch; `SWOT_ENABLED=off` omits `swot`). The Lab's Find step is left out only while the SWOT is `ready`.
- Web: `MistakeRepair.jsx` v3 layout and loading lines on real elapsed time, `SwotPanel.jsx`, `ScoreRecoveryLab.jsx` `hideFind`. Preview fixtures: `/preview/arena?view=result&mock=full|nta` (real SWOT over illustrative papers), `&repair=v3|v3-stored`, `&checks=unavailable`.
- Also fixed: the repair run track (`.rt__seg`) inherited the app shell's `min-width: 44px` on every button, so a run of 10 mistakes made the result page wider than a 375 px phone (found in the preview). The steps now share the row (`repair-run.css`).
- Verified 15 Oct (Claude, web integrator): `npm run lint` clean; `test:learning` 266 of 266, `test:recovery` 40, `test:app` 147, `test:nta` 150, `test:auth` 50, `test:answer-integrity` 11, all pass; `test:study` 21 of 22 (the known Windows CRLF failure in the content gate). `next build` passes (turbopack root temporarily pointed at the parent folder for the node_modules junction, then reverted). Dev preview on port 3109: Full mock shows the panel, the plan and the Q buttons; NTA mock shows the panel and no Mobi; quick practice shows no panel and keeps the three Lab steps; a v3 repair and a v1 repair both render; light and dark, 375 px and desktop; no console errors. The app's parse test (`swot_model_test.dart`, 19 tests) passes against this branch's `data/tests/fixtures/swot/contract_v1.json` with no model change.
- Truth review fixes (15 Oct, same branch): the pattern line above is dated; `claimsAboutStudent` also catches "You confused / may have confused / forgot / overlooked / missed / misread / ignored / rushed / assumed", "you were ..." and "your mistake was" (not "If you add ...", "If you were the buyer", "you were asked to", quoted option text, or the record's own "you missed this in Mock 2"); `cleanRepairText` turns "42!" at a sentence end into "42." and keeps "!" only as clear maths ("5! = 120", "n!/(r!(n-r)!)", "5! is 120"); SWOT counts carry denominators ("4 of 50 questions left blank", "7 of 50 questions were never opened", "2 of the 3 questions you had missed before were wrong again", m read from the attempts themselves); `untried` says what was checked ("have no answers in your last 4 Accountancy papers", N = the record's papers, and any paper in that span, device-scored included, removes a chapter); `mistakeInsights` is `{}` until the answer checks are ready. `findRepairTraps` now also reads `created_at`; its select was checked against production as SQL on 15 Oct (read only): `receipt` is jsonb, `receipt->'repair'->>'trap_type'`, `receipt->>'subject'` and `receipt->>'chapter'` resolve, the plan uses `ai_credit_reservations_user_idx`, and the 6 committed production repairs are all v1 (no trap, no subject), so no pattern line can show until v3 repairs exist. Tests: `test:learning` 272, `test:recovery` 40, `test:app` 147, all pass; eslint clean on the touched files.
- Not done: no live repair yet (about USD 0.0005 and 1 test credit; needs the owner's OK); the `findRepairTraps` select has not run through live PostgREST itself (the SQL equivalent has; a failure gives `pattern: null`); model output quality and field drop rates for v3 are unmeasured until a live call (spec D.3, watch 7 days after shipping); not deployed. `APP-API-CONTRACT.md` for the new fields is in `wt-phase2` (ui/phase2), not in this branch.

## 15 October 2026 - Production database: account takeover guard applied (migration 20261013150000_auth_unconfirmed_passwords), Mistake Repair verified live

- Why: /api/auth/email-login (live) calls public.auth_clear_unconfirmed_password, which did not exist in production; Vercel logged PGRST202 twice at about 09:00 IST on the owner's sign-in (sign-in itself worked, the call is best effort). The migration closes auth review H2: a password set through the public sign-up endpoint on an unconfirmed email would survive the student's later confirmation.
- Applied by Claude (session 604ced81) under the owner's standing database grant and security-hotfix OK: staging onwkqxmjqjrhfbjjdydu first, with a rolled-back test (RPC cleared 1 row case-insensitively, the trigger dropped a password set before confirmation, a confirmed account kept its password, only service_role can execute), then production isrxrxzjocewrdureyhp at about 09:35 IST. Verified after: 2 functions, 1 trigger on auth.users, anon cannot execute, service_role can.
- Effect: 97 of 1,639 accounts are unconfirmed and carry a password. Nothing changes for them until they request a code or confirm; then the pre-confirmation password is removed and they sign in with the code. Confirmed accounts are untouched.
- Undo: drop trigger if exists mm_drop_password_set_before_confirmation on auth.users; drop function if exists public.auth_drop_password_set_before_confirmation(); drop function if exists public.auth_clear_unconfirmed_password(text);
- Owner step still open: Supabase Authentication > Sign In / Providers > Email > Confirm email ON (cannot be checked by SQL).
- Mistake Repair verified live: 08:47 IST runtime_ai_requests row openai gpt-6-luna, stage primary, receipted, 480 in / 196 out tokens, USD 0.00015 (the owner's signed-in repair). The missing OPENAI_API_KEY root cause is closed.

## 15 October 2026 - Mistake Repair website client catches up with the server's failure codes (branch fix/repair-reliability, local, not pushed, not deployed)

`MistakeRepair.jsx` now sends through `data/repair_client.mjs`. (1) After any failure body with `charged: 0` the next attempt uses a fresh requestId (it used to reuse a released one, so the first retry hit `operation_released` and wasted a click); a timeout or dropped connection has no body, so it keeps the id and can never double charge. (2) The request is aborted after 95 s (the route budget is 90 s) with "This took too long. You were not charged.". (3) The server's own `message` is shown for every code (`provider_timeout`, `provider_unavailable`, `budget_reached`, `wallet_unavailable`, `paused`, `unusable_output`, `could_not_start`), never a generic line when one was sent. `budget_reached` and `paused` offer no retry button (trying again cannot help); the others do. Tests: `data/tests/repair_client.test.mjs` (in `test:learning`). The Flutter app has a matching change on ui/phase2 (not committed by this branch).

## 14 October 2026 - Mistake Repair reliability fixes (branch fix/repair-reliability, from deploy/nta-r5; local, not pushed, not deployed)

From `docs/brain/REPAIR-LAB-AUDIT-2026-10-14.md`. (1) The passage is now sent: the repair and blind prompts read `passageText` (snapshots) or `passage_text` (rows) and the passage title, before the question. (2) NTA shuffled options: key checks compare by option identity (option ids when both sides have them, else the comparable text with letter prefixes removed; `data/option_compare.js` `alignOptions` and `sameKeyOption`, with the snapshot's recorded `optionOrder` as the fallback when an option was also edited). `repairEligibility` no longer refuses a harmless shuffle as `key_changed`. `answerReview` (and so `readAnswerReviews`, `sessionCheck` and the repair refusal review) had the same bug, proved by failing tests first: a shuffled snapshot read as `content_changed` and the result page hid its key. It now reports `currentIndex` in the order the student saw. The one older test that pinned "a pure reorder is content_changed" now pins "edited options are content_changed". (3) Time (owner D1: Hobby with Fluid compute): `maxDuration = 90` on the repair route; per-call SDK timeouts (25 s main, 30 s blind), main work done by 45 s, everything by 78 s, worst case about 81 s; every OpenAI-compatible client has a 45 s default (`OPENAI_TIMEOUT_MS`) instead of the SDK's 10 minutes; a timeout releases the reservation. (4) Stuck credits: an open repair reservation that is expired or older than 150 s is released (`mm_ai_release_credits`, reason `expired`) and answers 409 `operation_released`; one that may still run answers 409 `in_progress` and blocks a second charge; a failed commit is retried once, then released; the daily cron `/api/internal/finalise-sessions` also calls `mm_ai_release_expired(100)`. (5) Visibility: failed provider calls keep status, code and type (receipt and result), the runtime guard's three stops keep their kind, one log line per failed repair (stage, code, kind, provider status and code, model, ms; no student data), new codes `provider_timeout` 504, `provider_unavailable` 503, `budget_reached` 503, `wallet_unavailable` 503 beside the existing ones. (6) The response filter blocks only claims about the student (predicted marks, scores, ranks, percentiles, cut-offs, admission chances, guaranteed gains), not the words rank, percentile, guarantees or "you will get x = 3". (D2) One fallback after a failed Luna call (timeout, quota or 429, 5xx, rejected parameter) to Anthropic `claude-haiku-5-5` at low effort, no temperature, only after the primary failed; the receipt records the provider and model that ran.

Not done, needs the owner: apply `supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql` (USD 0.10 / 0.50 per million, NOT APPLIED; until then the guard refuses the model and the fallback simply does not run); set `ANTHROPIC_API_KEY` in Vercel Production if absent; the one-time release of credits already stuck in production (D8, the owner runs it in the Supabase SQL editor; nothing was run against production). Web `repairRetryPolicy` and the app still reuse a released request id, so the first retry after a failure meets `operation_released` once; the app must map the new codes (the generic 5xx copy covers them meanwhile). Verification: `npm run test:recovery` 40 of 40, `test:learning` 161 of 161 (now includes the new provider, flow, failure-copy, wiring and Haiku-price tests), `test:app` 108 of 108, `test:nta` 150 of 150, `test:answer-integrity` 11 of 11, `test:auth` 50 of 50; a scratch smoke of the real SDKs with a faked fetch confirmed the Haiku wire body has no temperature or thinking and carries `output_config.effort: low`, and that a stalled Luna call times out through the SDK and falls back. No paid model was called.

## 14 October 2026 - Authored wave 2: General Test rows were planned under the wrong subject id, fixed before any publish (local, not pushed, not deployed, not published)

The wave-2 publish plan wrote the public subject `general_test` into `questions.subject`; the live bank stores General Test as `gat` (`data/cuet_controls.js`). Practice and NTA reads use `gat`, so the 77 General Test rows would have been invisible, and the dry run's `liveBefore` read 0 for `general_test`. `toQuestionRow` and `toPassageGroupRow` now store the internal id; every read of the target (live counts, lookalikes) uses it. The content hash covers `subject`, so the 77 General Test entries of `data/nta_agent_scores/general_test.json` and `data/nta_fit_scores/general_test.json` were merged again against the `gat` hash (hash fields only; no score, flag or other file changed). Wave 1 is unaffected (no alias; plan hash `39a4b051...` unchanged). New expected dry-run values: `summary.bySubject` gat 77 (not general_test 77), plan hash `73b630705530e07588c6eef2ba9857927d8faed9cabf0d118da065af679207c4`, candidates sha unchanged, 382 rows, 1 group, scores bound 382 of 382 (agent and fit), blockers none. Any plan file from before the fix (hash `89e4b3c6...`) is void. Tests: `test:authored-publish` 82, `test:nta` 150, `test:nta-e2e` 418, all pass. Not run: the online dry run, the apply, any deploy. Runbook: `docs/brain/RUNBOOK-PUBLISH-AUTHORED-W2-2026-10-14.md`, section 1 item 9.

## 14 October 2026 - Authored wave 2 prepared for a publish dry-run: 386 questions, agent and fit tables merged (local, not pushed, not deployed, not published)

Acceptance re-run with the re-run judge files (451 written, 400 accepted by the rule), the 10 reworded questions judged afresh (9 pass; `87c9264b` fails: all five fresh solvers answered A against a key of D that is right by computation, left out, not invented), expert verdicts and the spot-check applied, 27 questions reviewed by one reviewer (this pass) because they became accepted after the expert pass. Final set 386: Biology 53, Computer Science 74, English 55, General Test 77, Geography 55, Mathematics 65, Political Science 7. 31 drops with reasons in `docs/brain/reports/authored-w2/wave2-dropped-2026-10-14.json`; 12 of them are expert-repaired questions held until a 3-solver blind re-solve of the repaired text exists (none was run; no result invented). Wave-1 tooling made wave aware (source per wave, five more subjects, English verbal types, Geography case sets, a question that completes a wave-1 set, provenance per wave): the 55 wave-1 tests are unchanged and green, 20 wave-2 tests added. The agent and fit tables of the seven subjects carry the 386 entries (existing entries untouched). Offline engine check: 386 of 386 admitted, both new sets servable. Verification: test:authored-publish 75 of 75, test:nta 150 of 150, test:nta-e2e 418 of 418. Not run: the dry run against production, the apply, any deploy. Runbook with the commands and expected counts: `docs/brain/RUNBOOK-PUBLISH-AUTHORED-W2-2026-10-14.md`.

## 14 October 2026 - NTA engine r5.1: pre-deploy review fixes on deploy/nta-r5 (local, not pushed, not deployed)

Three fixes from the pre-deploy review, so one push carries them with r5. (1) Repeats never refuse a paper: holding back seen questions (earlier NTA papers, practice answers) left a student's second paper short on the 13 Oct export (General Test 46 to 44, Economics 45 to 44, both refused). When the seen-first build is refused for too few questions or passages, the engine builds again with repeats allowed and every gate, quota and structure check unchanged: 'relaxed' (a seen question gives way only to an equally useful new one), then 'none'. The notice says "N questions repeat from your earlier NTA papers"; structure.repeatFallback and crossPaper.repeatsAllowed record the builds. Gate verdicts are shared across the builds of one call, so the extra builds are cheap. Offline on the export (papers 1/2/3 for one student): General Test 46/46/45 (was 46/44 refused/44 refused), Economics 45/45/45 (was 45/44 refused/44 refused), Biology 46/45/46 (unchanged). Unsubmitted NTA sessions still count as earlier papers (their paper was on screen; the finaliser turns them into attempts after the deadline anyway). (2) Website refusal: a refusal the bank decides (detail.retryable false for no_scored_questions, no_passage_sets, too_few_questions) now shows "No NTA paper for <subject> yet", the engine's sentence, Start a Full Mock (direct for Premium, the dashboard set-up otherwise) and Back to dashboard, not "This did not load" with a futile Try again; a refused paper's notice no longer describes positions of a paper nobody sees ("Q12-21 are standalone instead"). (3) When no question can be placed, the sentence names the gate that kept most questions out (refusal.cause: quality, fit_not_judged, fit_below_bar, veto, syllabus, unscored), instead of always blaming quality. Also: .next-staging/ ignored by eslint; two lint false positives fixed; the NTA e2e fake now reads json paths (selection_meta->>mode), so the e2e second paper exercises the earlier-papers path. Verified: lint clean; test:nta 143, test:nta-e2e 418, test:recovery 40, test:app 108, test:auth 50, all pass; next build (Turbopack) passes; refusal panel and the second-paper notice driven in a browser through /preview/arena/nta with the local backend at 375 px and 1366 x 650, light and dark, links clicked with a pointer. Not run: the production engine run, any deploy.

## 14 October 2026 - CUET-fit gate merged into fix/nta-mode (engine r5), authored wave-1 entries in the agent and fit tables (local, not pushed, not deployed)

`wip/cuet-fit` merged with `--no-ff` (47e0880): engine r5 (fit gate, judges' stored type and chapter, newest-first) on top of r4.1, the holds, the listed-order reorder and the authored publish tooling. No textual conflicts; semantic ones fixed in the merge: the authored check passes the merged fit tables to the engine, `engine_type_guess` uses `heuristicNtaType`, and two e2e checks were adjusted (time-up sessions start as a fresh student's first paper; the leak check no longer trips on the Computer Science chapter "Stack"). Then `scripts/authored-scores-merge.mjs --mode=merge --repaired-text=admit` (d593e84): 475 entries added to six agent and six fit tables, no existing entry changed. Verified offline: `--mode=check --impact` 475 of 475 eligible through r5 with the merged tables, 11 of 12 English sets servable; offline publish dry run binds 475/475 in both tables, plan hash unchanged. Tests: test:nta 134, test:recovery 40, test:question-reorder 26, test:authored-publish 55, test:nta-e2e 418, all passing. No database, network or model used. Open gates: the owner's approval to publish (RUNBOOK-PUBLISH-AUTHORED-2026-10-14.md section 10) and to deploy r5, which changes NTA mode for every subject (General Test 46 questions, Mathematics refused, Biology served).

## 13 October 2026 - NTA engine r4.1: verification findings on r4 (branch fix/nta-mode, not deployed)

Fixed after the independent check of 2c6e5a1. (1) Option shuffle: the explanation remap now reads "Option B", "option is B", "option B gives ...", "the choice would be C" (capitalised word, a linking word between word and letter); a reference it still cannot rewrite ("option, as powers add, B ...") keeps the stored order instead of going stale (shuffleBlockers). (2) Blocking judge flags match whatever the spelling ("Wrong_Key", "factual error"). (3) Seed and demo rows: "seed_import", "demo_import", "seed 2026-04", "PYQ 2023 (seed)", "PYQ demo" are caught; ids must be exact UUIDs (a padded id is rejected). (4) The "mainly" gate no longer flags "5 items, 2 mainly for households" or "Vitamin A, B mainly ..." (a comma needs a bracketed label or a roman numeral). (5) Listed-order keys: numbered ("1. 2. 3. 4."), item-text keys in printed order and two-pair match keys are caught; a stem that prints its items out of alphabetical order is judged by the printed order; label ranges agree (P-T). (6) Difficulty: an id such as "constructor" is not a correction; the run report separates corrections in the file from corrections that change a loaded row. (7) Cross-paper: the earlier-papers read asks only for NTA attempts (a student with 40+ other attempts keeps every NTA paper in view), orders sessions newest first, and a failed read is recorded as structure.crossPaper.lookupFailed. (8) Test fixes: finding 2 no longer assumes the paper is otherwise eligible (the CUET-fit gate has its own fixtures); the concept guard test pins the 5-gram check; new tests for every phrasing above.

Not changed, on purpose. Trailing "mainly" ("Which factor is mainly?") and "mainly found in" cannot be told from real corruption by pattern; a false positive only removes one item, so the gate stays strict and the second form stays a known gap. A "seed-bank" source is excluded (conservative). Short stems (under 60 characters) are covered by the key-answer, concept-key and chapter guards, not the 5-gram guard; same_key_answer is not limited to one chapter, so pool sizes should be re-read after the next production run (not run here). Two-level difficulty corrections stay automatic by the policy in NTA-ENGINE-POLICIES.md. A fresh pool that can only give a closest paper is served as that shorter paper with its shortfall recorded, not topped up with repeats (owner may choose the other way). Without a shuffle key the engine falls back to a fixed key; both server paths (practiceSessions.js, recoverySessions.js) require a generation key of 12 or more characters, so this is an offline default only.

Mark for review and the clock, accurately. Marks are saved on the server only in durable mode (LEARNING_SESSIONS_ENABLED=true). In the default device-ticket mode they live in the saved draft and in the submitted event log, like answers, and are lost with the draft; they never affect the score. The device-ticket clock holds while the signed start receipt travels with the page address or the saved draft: a lost draft with the receipt still in the address keeps the original start, but a start without a receipt (a bookmarked address without it, or a relaunch from the dashboard, which mints a new generation key) is a new test with a new 60-minute clock. Making relaunch resume the old clock is a product decision, not made here.

Verification (HEAD plus these edits, in an isolated copy because the shared working tree carries uncommitted CUET-fit work whose gate rejects the old fixtures): test:nta 123 of 123, test:nta-e2e 481 of 481, test:recovery 40 of 40. Not run: the production engine run, any deploy.

## 13 October 2026 — NTA engine r4: the expert review's findings 1-4 and 6-9 (branch fix/nta-mode, not deployed)

Policies and details: docs/brain/NTA-ENGINE-POLICIES.md. (1) Options are served in a per-session order (seeded by the generation key and the question id) with the key, the A-D letters and explicit option references in the explanation remapped; the permutation rides on each row (nta_option_order) for the session's stored option layout; options that name other options, error-spotting parts and "No error" keep their order; stored letter prefixes are stripped first (data/option_text.js now also strips "A 36"). Offline on the 13 Oct export, paper 1 keys for Mathematics went from 37 A of 47 to 14/16/7/10, Physics 33 A of 50 to 11/14/14/11. (2) A blocking flag from either agent judge vetoes any source, factory included. (3) Non-UUID ids and seed or demo rows are never served. (4) Wording gate for the only-to-mainly corruption: catches all 34 held rows plus 12 more (ids for the owner's clean-up: tmp/nta-review-cleanup/CLEANUP-2026-10-13.md; no database write). (6) Concept guard without matching tags: rarity-weighted character 5-grams of the stem, the same short answer, and shared key concept phrases of either judge's tag; the stored objective tag is now the one both judges gave. (7) Difficulty: the stored label stands unless both judges put it two levels away (merge policy two_level_gap_only: 80 corrections, 1,267 one-level disagreements not applied). (8) Sequence and match keys in the listed order are kept out (63 live rows listed). (9) A student's next NTA paper leaves out earlier NTA papers' questions when the pool allows, otherwise falls back with the reason in structure.crossPaper; the production run script builds papers 2 and 3 that way. Refusals are worked out with a fixed seed so a retry reads the same sentence. Re-ran scripts/nta-pass-merge.mjs on the completed re-judge (618 result files, 0 missing, 0 invalid; 5,326 judged, 384 key disputes). Tests (HEAD plus these changes only, in an isolated copy, because the CUET-fit work was in progress in the shared tree): nta 122, nta-e2e 481, recovery 40, all pass. Not run: the production engine run (the orchestrator runs it). Offline on the export, paper 2 still repeats paper 1 for General Test (35 of 50) and Mathematics (20 of 47) because their pools cannot fill a paper without them; finding 5 (chapters) is the CUET-fit work.

## 13 October 2026 — NTA mode final end-to-end pass over all 15 subjects, three runner fixes (branch fix/nta-mode, not deployed)

Ran every suite on the merged branch: nta 95, nta-e2e 465 (as-is and promoted, 15 subjects each, one new per-subject step), recovery 39, answer-integrity 11, auth 33, du 19, learning 91, factory 332 all pass; study 21 of 22 (WordNet licence file absent, unrelated, as before). The production read (scripts/nta-engine-run.mjs) was not run. Browser drive: the site ran locally against the staging project (copy of stagingLocalApp.mjs on port 3107) with the dev-only page /preview/arena/nta and the local session backend (promoted mode); signed-in staging sessions are not possible for an agent. Every subject at 375 px and 1366 px, MockMob and NTA-style interface, light and dark: served subjects pass 23 of 23 runner checks (palette states, Save & next, Mark for review, Clear response, keyboard, Previous disabled on Q1), bulk answering of the whole paper matches the palette, submission scores exactly +5/-1/0 against the stored key, no horizontal scroll, no text under 4.5:1 in either theme. Passage text (a real 2,682 character English passage injected for layout) is visible at 375 px and 1366 px, contrast 8.6 light and 10.3 dark. Reload resumes answers, marks, current question and the running clock; the 15-second clock auto-submits and scores; an offline submit keeps the paper and the retry scores once.

Fixed: (1) live questions store each option with its own letter ("A  7/2", "B. Planning", "C) A-2, B-1"; 5 to 30 per subject, 14 of 15 subjects) so the runner and the result review showed the letter twice; data/option_text.js strips the marker for display only when every option carries its own letter in order, scoring and keys use the index. (2) NTA-style timer was 4.4:1 and the Marked palette chip 2.47:1 in both themes; darker timer backing and chip highlight. (3) the e2e driver compares option text through the same rule.

Not fixed (larger): (Superseded by the 13 Oct r4.1 entry above: marks are saved with a durable session and the device-ticket clock is kept by a signed start receipt, with the limits listed there.) 15 old seed questions (g1-g3, a1-a3, b1-b3, e1-e3, m1-m3) are live with source PYQ; as shipped (production scores plus the agent tables) NTA mode starts for General Test, Accountancy, Business Studies, Economics, Mathematics and Physics only; English (no passage sets) and Chemistry, Biology, History, Political Science, Geography, Psychology, Sociology, Computer Science refuse cleanly (too few fitting questions, 37 to 43 of 50 in the promoted run).

## 13 October 2026 — NTA mode end-to-end tests for all 15 subjects, three runner fixes (branch fix/nta-mode, not deployed)

New `npm run test:nta-e2e` (data/tests/nta_e2e_session.test.mjs, 390 checks, all pass) runs the real /api/sessions and /api/attempts handlers, practiceSessions, data/db.js, the pool read and the engine in plain Node over read-only production fixtures (`node --use-system-ca scripts/nta-fixture-export.mjs` writes tmp/nta-fixtures; select only, never committed). Only the Supabase client (in-memory, strict about selected columns and missing tables) and sign-in are stand-ins. Two data modes per subject: as-is (production scores) and promoted (synthetic signed scores where production has none, to exercise the session path; says nothing about quality). Per subject it checks the paper (45-50 unique live questions, four A-D options, key never sent to the browser, sealed snapshot key equals the bank key, passage sets whole), the 60-minute timer, replay, free student 402, difficulty override refused, variants, tampered or foreign ticket refused, submit scoring +5/-1/0 with exact counts and per-question verdicts, attempt and progress stored once, double submit, time-up (61 minutes in is scored, 63 refused), durable sessions (events, resume by key and by id, no timer restart, late answers not counted), and refusals (clean 422, sentence for the student, no session, no write, no charge). The real runner was driven in the built-in browser through a dev-only page, /preview/arena/nta, that sends only the two session endpoints to a local backend (data/tests/nta_e2e_server.mjs) running the same handlers; driver data/tests/nta_e2e_driver.js. Desktop 1366, tablet 768 and phone 375, both themes, NTA-style and MockMob interfaces: palette states, Save & next, Mark for review, Clear response, keyboard, reload resume, integrity strikes, time-up auto submit, offline submit and retry, whole-paper answer mapping checked against the stored key.

Result: as-is, Accountancy, Business Studies and Economics start and pass everything; English and the 11 unscored subjects refuse cleanly. Promoted, the session path passes for General Test, Accountancy, Business Studies, Economics, Mathematics (both variants), Physics, History, Political Science and Sociology; English, Chemistry, Biology, Geography, Psychology and Computer Science still refuse even with every live question scored 8 or more (no 200-300 word passages for English; 40-43 of 50 placed elsewhere because the bank has no match-the-following, sequence or statement items that fit; 15-34 questions per subject are typed as match-the-following but their options are not pairings). Scoring alone will not unlock those six; new questions of those types will.

Fixed in the runner (src/app/(app)/test/TestPageClient.jsx): a durable session resumed from the server restored a cleared answer as answered and showed every visited question as not visited; a free student starting NTA mode saw the raw code PREMIUM_REQUIRED; the "differs from the real paper" notice was open on phones and pushed the first question below the fold (now open only from 1024 px). Not fixed here (see the r4.1 entry for what later changed): the device-ticket clock and Mark for review gaps; 15 old seed questions (ids g1-g3, a1-a3, b1-b3, e1-e3, m1-m3) are live in production with source "PYQ 2023/2022/2024".

## 13 October 2026 — NTA agent pass: merge and engine source, r3 (branch fix/nta-mode, not deployed)

Agent scores are now a recorded third score source (agent_scored) next to factory evidence and the signed index. scripts/nta-pass-merge.mjs (offline, no database, no model) merges the two judges' result files from tmp/nta-pass/results into data/nta_agent_scores/<subject>.json with provenance: rubric version (nta-agent-rubric-1) and rubric hash, each judge's model and date, both scores, both blind answers, key agreement, flags, notes, objective tags, difficulty checks and per-subject agreement measures (mean absolute difference, within 1, Pearson r, key and tag agreement). Questions where either judge's blind answer differs from the key go to data/nta_key_disputes.json and are kept out of NTA mode whatever their source; objective tags go to data/nta_objectives.json (agent_questions; hand tags win); difficulty corrections where both judges agree go to data/nta_difficulty.json. data/nta_agent_scores.js checks provenance in code: the table must be calibrated (threshold mapping the owner's 8), the rubric version current, two different judges with model and date, both at or above the threshold, both blind answers on the key, no blocking flag, and the row's content hash unchanged; factory evidence always wins and is never rescued by an agent score. The pool loader adds only agent ids that already pass those checks, without the evidence column and only where the question has no factory evidence. scripts/nta-pass-export.mjs now also writes hashes.json (the content hash the engine computes). State: tmp/nta-pass does not exist (the export has not been run), 0 result files, 0 missing, calibration pending, so the agent source admits nothing and the read-only production run (docs/brain/NTA-ENGINE-RUN.md, engine r3) equals the factory-only run: Accountancy, Business Studies and Economics serve closest valid papers of 50 (3 of 3 starts), English refused (no passage sets), the other 11 subjects refused (no scored questions); 0 key disputes. Tests: nta 93 (6 new), recovery 39, answer-integrity 11, auth 33, du 19, learning 91, factory 332; study 21/22 (WordNet licence file absent, unrelated, as before); eslint clean on the changed files; webpack build passes. Next: run the export, the calibration judges and the comparison, write tmp/nta-pass/calibration.json, run the judges, merge, re-run the engine.

## 13 October 2026 — NTA engine review fixes, r2 (branch fix/nta-mode, not deployed)

Applied the CUET paper-setter review of 053d2a0 (no subject was ready: the same concept repeated in a paper, items that give their answer away, one broken item, one likely wrong key). New data/nta_item_checks.js. Structural gate: sequence options must order the stem's own items, match options must use List-I and List-II labels the stem shows, statement options must use its statement labels, and no item may print its options again inside the stem. Wording gate: stems that state the rule ("For this question...", "Use this rule", "terms defined here", "in the supplied sense"), cite "the stated condition" or "the excerpt", point at options ("options B-D"), narrate the order a sequence asks for, or order a book's modules; explanations that cite "the excerpt" or "the stem". NTA-only, reversible quarantine (data/nta_quarantine.json): Accountancy 40d8ffd9... (key pays capital in capital ratio; by the realisation-loss rule P gets Rs 1,65,000, no option) and Business Studies 24ff7d61... (sequence with match options). Same question in other words: stem + options or stem + key text at Jaccard 0.5, same chapter and concept-name overlap 0.5, same chapter and shared figures, English shared headword (quoted target, one-word key, short match entries), passage children with the same answer; passage children are no longer exempt. Learning-objective tags (data/nta_objectives.json, or nta_question_index.objective_tag) cap each objective at one per paper; only the 38 questions in the review's named clusters are tagged. Type counter: statement-based needs labelled statements and label-combination options (Both/Neither wording is a plain MCQ; roman and lower-case labels count). English passages must be 200-300 words with at least 4 distinct children. Numerical share follows the blueprint overlay (Accountancy at most 17, Economics at most 15). Scores fail closed: both judges and both blind solvers are required, and the unsigned quality_score column never admits a question. Pool read: supabase/migrations/20261013190000_nta_question_index.sql (saved, not applied) and scripts/nta-index-build.mjs (dry run by default) give signed slim index rows; the runtime reads them plus questions without evidence (0.27-0.36 MB instead of 5.3-6.6 MB), re-checks signature and content hash, falls back to the full read while the table is missing, and caches each subject's pool for 5 minutes. A spent read budget now returns a student sentence; a missing shortfall table costs one failed insert per process; the engine says "General Test".

Read-only production run (docs/brain/NTA-ENGINE-RUN.md): the review gates keep out English 11 of 149, Accountancy 20 of 127, Business Studies 26 of 145, Economics 20 of 130 questions at the bar. Accountancy, Business Studies and Economics serve closest valid papers of 50 (Accountancy now differs in chapter weightage; Business Studies and Economics have Q41-50 standalone); English is refused (no passage of 200-300 words; at 7.5 also refused); the other 11 subjects are refused (no scored questions). End to end 0.95-2.6 s cold, 0.39-0.47 s from the pool cache; assembly 11-57 ms. Five fresh papers per serving subject: 0 pairs at stem+options Jaccard 0.5, 0 repeated tags. Not fixed (owner decisions): concept tags for every eligible question, a signed per-item review record (hedges, trivial arithmetic labelled hard, difficulty), case sets for commerce subjects, English passages of 200-300 words and sentence-part rearrangement and idiom items, scoring the 11 unscored subjects, the dashboard variant picker (Applied Mathematics) and showing availability before Start. Tests: nta 87 (11 new), recovery 39, answer-integrity 11, auth 33, learning 91, mock selector and session recovery 9; webpack build passes. Deployment gates: both NTA migrations saved, not applied; the index build has not been run with --write anywhere.

## 13 October 2026 — NTA paper engine: score bar plus CUET blueprints (branch fix/nta-mode, not deployed)

NTA mode now starts from data/nta_engine.js instead of the evidence-certified pool. Eligibility: a score of NTA_MIN_SCORE (8) or more out of 10, read as the mean of the two factory judge scores in the signed evidence record (or quality_score x 10 if that column is ever filled), plus hard gates: the score record must be signed, name this question, match its current content hash and have both blind solvers on the stored key; answer-key guard; content gate; live and undeleted; no open key dispute; no family hold; chapter in the 2026 syllabus. Evidence expiry, source registry and calibration state no longer gate NTA, so the 5-6 November expiry does not empty it. Assembly follows data/nta_blueprints: section order, per-type quotas, whole passage or case sets at the blueprint's place, unit and chapter ranges, difficulty mix, no repeated family or near-duplicate stem, unseen questions first. A bank that cannot meet the blueprint gives either the closest valid paper (at least 45 questions) with the differences in plain sentences, or a refusal with the reason and a Full Mock suggestion; both are logged and, once supabase/migrations/20261013170000_nta_paper_shortfalls.sql is applied, stored for the content team. Read-only production run (docs/brain/NTA-ENGINE-RUN.md): Accountancy exact; Business Studies and Economics 50 questions with Q41-50 standalone because the bank has no case sets; English refused (1 complete passage set at the bar, 2 needed; at 7.5 it would serve); the other 11 subjects refused (no scored questions). End to end 0.9-3.4 s per paper, assembly 5-61 ms. Tests: nta 76 (29 new engine tests), recovery 39, answer-integrity 11, auth 33, learning 91, du 19, selector/session 22; study 21/22 (the WordNet licence file is absent in this worktree, unrelated); webpack build passes. Deployment gates: the shortfall migration is saved, not applied; the notice UI was not checked in a browser.

## 13 October 2026 — NTA mode paper pattern, NTA-style passage text, NTA mode on phones (branch fix/nta-mode, not deployed)

Root cause of the "passages and passages" English paper: the NTA selector (data/nta_question_selector.js, since 7dd32c3) had no paper pattern. It took every passage set in each quality tier before any standalone question and put them first. Since 0d961f1 (7 Oct) NTA reads only the evidence-certified pool, where English has 35 passage questions in 13 small sets, so a read-only rebuild from production gave questions 1 to 32 as passages. Commits e2a9dab and 52de7fe did not change eligibility. New data/nta_paper_pattern.js lays out each paper: English has 2 to 4 whole passage sets of at least 3 questions (8 to 20 questions), with the rest split across vocabulary, correct word usage, para jumbles and match the following (12/9/7/7, each capped at 1.5 times its share). Verbal blocks and passage sets alternate and the paper opens with vocabulary. Domain subjects go round-robin across syllabus chapters and follow syllabus order. A short bank gives fewer than 50 questions with a stated reason, so the session does not start; the paper is never padded with one question type. Production rebuild (read-only): English has 50 questions, 4 sets (15 questions), longest passage run 5. Accountancy, Business Studies and Economics have 50 each. The other 11 subjects have 0 evidence-certified questions, so NTA mode cannot start for them (unchanged since 0d961f1; changing that is an owner decision). NTA-style skin: it had pinned the dark-theme ink tokens on its light surface, which made passage text, the warnings pill, alerts and the palette close icon invisible. They are now dark ink in both themes. Below 1024 px, a fixed bar keeps Back, Clear response, Palette, Mark for review & next and Save & next on screen; the timer stays in the sticky header and the palette opens as a bottom sheet. Tests: nta 29, recovery 39, auth 33, answer-integrity 11, mock selector/ui/session 14; webpack build passes.

## 13 October 2026 — app backend release branch (release/app-backend), not deployed

Branch release/app-backend is origin/main (5f7d53e, sign-in reliability and inventory snapshot kept) plus only the backend the Android app (in.mockmob.app) calls, taken from feat/app-and-web f4451cd: /api/me/{consent,notification-prefs,devices,goal,rhythm,bests,repair-record,sample-import,delete}, /api/events, /api/attempts/summary, /api/sessions/[id]/check (off unless SESSION_CHECK_ENABLED=1), /api/assetlinks with the /.well-known/assetlinks.json rewrite, /api/internal/finalise-sessions with a daily cron, bearer auth on bookmarks, ai/credits, ai/usage, ai/mentor/history, learning/summary and the questions feed/vote/interact/explore routes, structured action fields (plan, quote, replay, repair), the result recap block, the server modules, data/db.js mode and formatId, 7 migrations, tests, the deletion processor script, and the Play-required /account-deletion page, privacy update and Profile usage-data and delete controls. Homepage, /app, landing, result QR and security headers were left out.

New here: the deadline finaliser never touches sessions that expired before 2026-10-13 00:00 UTC (SESSION_FINALISE_FROM overrides), so deploying it is not an implicit backfill; migration 20261013170000_app_service_role_grants.sql states the service-role grants the usage tables relied on from Supabase defaults; scripts/dev/production-app-sql.mjs builds ../PRODUCTION-app-backend-2026-10-13.sql (one transaction, preflight, idempotent, verification last) and dry-runs it.

Verified locally: test:recovery 39/39, test:auth 50/50, test:app 107/107 (plus app_bearer_routes in test:auth), test:learning 91/91; test:study 21/22 with the same content-gate failure on unchanged origin/main; next build --webpack passes. PGlite: the bundle applies on the replayable production history with and without the inventory snapshot table, applies a second time unchanged, 17/17 verification rows ok; the preflight stops it on a database without the recovery tables and nothing is created. Staging read-only check: every table, function and users.deleted_at present.

Deployment gates (owner): run PRODUCTION-app-backend-2026-10-13.sql in the production SQL editor first, then push release/app-backend to main; set ANDROID_CERT_SHA256 (Play App Signing and upload key SHA-256) in Vercel; CRON_SECRET must be set for both crons. Account deletions are fulfilled only when an operator runs scripts/ops/process-account-deletions.mjs within 30 days. 20261013150000_auth_unconfirmed_passwords.sql is still not applied anywhere and is not in this bundle.

## 7 October 2026, 14:22 UTC — 575 verified production retrievals and current accounting

Owner-corrected signing configuration redeployed as GnJ42mkLjHXgbwUs4SvPY6oSWgpD (c235606), Ready/Latest in 77 seconds. The actual production student check passed at 14:12:38: 575/575 unique new approved questions retrieved, ten complete passage groups, zero rejected IDs, unchanged USD 25 student-AI monthly cap. The authenticated rendered dashboard confirms 575 usable / 579 historical publication records, four withheld, and after a metadata-only accounting refresh shows USD 12.82 settled + USD 0.28 held and a USD 92.76 conditional lifetime forecast. That refresh preserves paused=true, phase=1000 and publication_enabled=false, and changes no questions, payments or student budgets; its receipts are in production-accounting-sync.json/.jsonl. Export refreshes now maintain this snapshot when production publication was explicitly authorized.

The retained ledger at 14:22:16 is USD 12.824160 settled + USD 0.276446 held = USD 13.100606 committed, 7,146 requests. Sixteen accepted candidates remain submitted; five historical/terminal-failure requests remain unresolved and retain their USD 0.090248 maximum holds. Provider invoices remain unavailable. Eight completed cohorts retain 800 candidates, 575 usable approvals and USD 4.860017 gross; the current author contract's three complete cohorts retain 300 candidates, 250 approvals and USD 2.108597 gross. Current overall craft distribution remains 233 seven, 341 eight, one nine, zero ten; this is a mixed bank, not a uniformly premium or perfect bank.

Stricter craft-filter scenarios retain all 800 completed candidates and their USD 4.860017 gross costs. Overall scores of at least eight select 342 questions, USD 0.014211 per selected question and a conditional lifetime 10,000 cost of USD 150.346349. Requiring an overall score of at least eight plus every individual craft subscore of at least seven selects 160, USD 0.030375 per selected question and USD 311.991652 conditional lifetime cost. These are observed rating filters, not accuracy or premium-quality proof. The mixed-bank USD 92.762624 forecast cannot substantiate a uniformly premium bank under USD 100. The automated report includes these distinctions and preserves all rejected and failed-call costs.

Staging repeated statement timeouts (57014) on large status upserts and snapshot reads. Sync writes now use byte-bounded chunks while preserving every evidence byte; full snapshot reads keep their usual pagination and retry a timed-out evidence-heavy page once at 100 rows with the same offset. Metadata errors and further failures still fail closed. Four targeted byte/boundary/error tests pass; full factory/snapshot tests 335, recovery 39, question/payment/wallet/ticket 65 pass, with the earlier application-learning 84 retained as dated evidence. Controller 59386 resumed the same accepted campaigns; no new cohort or paid evaluation was registered. Paid IDs, reservations and evidence gates remain intact. Production availability is established; the combined 1,000-candidate campaign is still incomplete while the last 16 provider candidates finish.

## 7 October 2026, 13:31 UTC — production signing key and request-scoped evidence checks

The owner saved CUET_EVIDENCE_SIGNING_KEY as a Vercel Production Secret. Redeployment 2S7jeLumVt3bf59yBrJ5JTUmmUXs of e9e1ffb is Ready (53 seconds). Public endpoints return 200; anonymous admin returns 401. The authenticated overview timed out at 30 and 90 seconds and remains unverified. It was reparsing approximately 4.85 MB of registry/calibration JSON per inventory row (9,821 production rows). The overview now binds one fresh registry/calibration snapshot per request; item signatures, content hashes, source versions, expiry, disputes and release predicates are still independently evaluated, with no cached item verdict. Real 575 approved records remain eligible in 0.297 seconds locally; sampled existing-path verdicts match. Factory plus snapshot safety tests pass 331, recovery 39, question/payment/wallet/ticket 65; the release build passes. Production retrieval is to be rerun after this optimization deploys. Native provider IDs, remaining 19 candidates, all costs/holds and the running controller remain intact. No new paid evaluations, production migrations or payment changes.

## 7 October 2026, 12:52 UTC — native Gemini failure receipts preserve holds without publication deadlock

The accepted 64-item Gemini validation batch succeeded at the provider level; 60 usage receipts settled and four item records reported native code 14, service unavailable, with no usage. The four $0.019788 reservations remain fully committed ($0.079152 total), and all four corresponding candidates are quarantined. The transport now retains each exact native metadata key, batch identity, terminal state and error record. Cohort accounting recognizes only matching terminal failures on quarantined items as bounded receipt holds, so unrelated approved questions can publish once their pending work finishes. A failed call with reported usage is charged for its candidate plus reasoning tokens; no service failure is assumed free. Missing/duplicate identities, a running batch, missing failure evidence, invalid bounds or an approved failed item still block publication.

The fix passed 28 targeted receipt/restart/identity/budget/publication tests, all 328 factory tests and the full release build. It was applied atomically after preserving the old files; the existing controller and active paid calls were left running. Actual SQLite proof at 12:51:38 UTC verifies all four native keys, terminal errors, unchanged full holds and quarantined item states. The academic generation/validation contract is unchanged; no repeated paid evaluation or accepted-ID resubmission was introduced. Two OpenAI batches and later repair-validation work remain pending; the controller must finish them before the combined campaign is called complete. Production signing-key entry and the historical 503 receipt remain external dependencies.

## 7 October 2026, 12:22 UTC — 575 actual staging retrievals and deployed currency correction

The signed-in staging student check at 12:15:53 UTC retrieved all 575 current approved questions: English 149, Accountancy 123, Business Studies 159 and Economics 144. Ten passage groups were complete; no rejected item was retrieved. The authenticated admin overview distinguishes 579 retained publication records from 575 currently usable factory items. Funded checkpoint replay, the unfunded 10,000 checkpoint rejection and the existing $25 student-AI monthly cap passed. This is actual API evidence; it does not replace a current rendered dashboard inspection.

The serving guard now preserves the sign in grouped rupee amounts, including Indian grouping, while rejecting mathematically equal options such as ₹3,00,000 and ₹300000. This corrected a false positive on one independently validated Economics item without changing its key, explanation or academic evidence. Fractional signed scalars are also covered. Question/selector/payment/wallet/ticket checks pass 65, factory 324, recovery 39 and the release build passes. Vercel shows production commit 4a9c002e7ce957d78715c409f0ec45f7d5ce3cca Ready/Latest, deployment Fr8c2aHmfwxtzqjXF1inXovKTdSm, 57 seconds. The frozen academic contract remains byte-identical to the release checkout: d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399.

The existing controller was restarted only after two independent child-empty checks to reload the guard. Restart evidence retains all 7,047 prior ledger requests and 2,438 stored accepted provider IDs, with zero missing IDs and no replay calls. The resumed controller reports 575 usable items and 83 pending candidates in the two already registered later cohorts; no further cohort was registered. Eight complete fixed cohorts preserve their entire 800-candidate denominator, 575 approvals and $4.860017 gross cost. At the dated 12:15:30 snapshot, lifetime settled usage is $12.521966, holds $1.378190, committed $13.900156; the conditional lifetime 10,000 forecast is $93.562174 across all completed cohorts and $93.394263 for all completed current-author-contract cohorts. Neither a uniformly premium bank nor a $50–70 forecast is established. These are usage receipts and conservative holds, not provider invoices.

Additional application/learning verification completed at 12:32 UTC: 84/84 existing tests pass. They exercise the production-shaped monthly AI budget migrations, conservative missing-usage accounting, duplicate dispatch suppression, credit reserve/commit/refund lifecycle and historical payment-plan resolution. These are local database and application checks, not a captured production payment or live student-provider claim. The report retains exact commands, test counts and log hashes in continuation-500/local-verification.json and includes them automatically in future exports.

Production student availability remains unverified while the owner-controlled CUET_EVIDENCE_SIGNING_KEY form awaits entry and submission; storage receipts and a Ready deployment do not establish availability. The browser credential rule requires the owner to complete that step. The historical OpenAI 503 request remains conservatively held at $0.011096; the read-only billing lookup encountered an authentication failure, and no zero-cost assumption or resubmission was made. The accepted native batches remain under the persistent controller for completion, export and final retrieval checks.

## 7 October 2026, 10:15 UTC — current usable admin counts and lifetime forecast

The actual staging check at 10:12:30 UTC passes 491/491 current approved questions, ten complete passage groups, and zero rejected items retrieved. The authenticated overview now separates 495 retained publication records from 491 currently usable factory questions. All four withheld historical publications remain stored and unavailable. The admin headline, subject counters and checkpoint gates use the intersection of current usable coverage with new factory publication IDs; unrelated legacy inventory cannot fill these checkpoints. The lifetime forecast includes existing committed spending and conservative holds once, rather than showing only marginal cost for 10k.

Four targeted count/forecast tests cover retained withholding, legacy exclusion, an insufficient 999-usable/1000-historical checkpoint, and absent cost evidence. Factory passes 324; the full release build passes. Recovery 39 and scoped question/payment/wallet/ticket 64 remain passing. At the dated aggregate snapshot 10:06:44 UTC, seven completed cohorts retain all 700 candidates, with 491 usable approvals and $4.128471 gross. Lifetime settled is $11.398041 and conservative reservations $0.782782, committed $12.180823. Conditional lifetime 10k is $92.135264 across all completed cohorts; uniform premium quality and a $50–70 fit are not established.

The accepted native batches are still processing (99/100, 98/100 and 0/7 in the latest direct read). Their output files are not available yet, so partial provider counters cannot be collected as completed questions or settled receipts. All accepted IDs remain retained; no paid regeneration or accepted-request resubmission was introduced. Production signing-key entry and the historical 503 billing receipt remain precise external dependencies.

## 7 October 2026, 10:04 UTC — unsupported antonym explanation withheld

The actual supplied dictionary span does not entail the generated rule that an antonym 'must oppose both qualities'. Both independent model checks and the explanation audit passed that unsupported claim. The publication inspection now rejects it automatically, and the already published item abb793b3de99185acb169170f420b335 has been withheld in both authorized environments with content, provider costs and prior publication history retained. This is an observed validator miss and dated regression evidence; it is not a fresh benchmark success or proof of general accuracy. The three duplicate passage children remain withheld. Cohort 007 now has 78 approvals and 22 rejections, preserving its full 100-candidate denominator and $0.681212 settled gross cost.

Inspection contract evidence-content-idea-inspection-v3 binds publication reuse to these current guards and unchanged content. The frozen academic model contract remains d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399. Factory passes 320 tests; recovery 39 and scoped answer/selector/payment/wallet/ticket checks 64 remain passing. Actual staging retrieval passed 492/492 at 09:55 before this additional withholding, so that proof is dated; the updated usable count must exclude this item. Remaining native requests are retained, and no fresh paid benchmark or uncontrolled regeneration was run.

## 7 October 2026, 09:50 UTC — actual novelty withholding and serving guard corrections

Vercel reports production 224e63a1ad3928f592f945d88be1b3ae351a7510 Ready (53 seconds). The retained seven completed cohorts originally approved 495 candidates. A new automatic passage-fact check found three children of the same passage group asking the same factual condition, despite differing concept labels. All three are now withheld in staging and approved production through retained dispute receipts; no content, publication receipt or spending record was erased. The local cohort retains the former publication history and now reports 79 approvals and 21 rejections. The strengthened prepublication check also withholds every sibling if a duplicate child fails. Numeric quantities, negations, different passages and genuinely distinct facts remain distinct in regression tests.

Two serving false positives were found from actual inventory: the guard collapsed +3.75 and -3.75, and treated vocabulary definitions containing 'true' as answer verdicts. Signed scalars now preserve value/sign, equivalent scalar options still collide, and truth assertions require an actual verdict. Independent key, support and explanation validation remain unchanged. The frozen academic contract is unaffected; no fresh paid benchmark was purchased.

Factory passes 319, recovery 39, and the scoped answer/selector/payment/wallet/ticket checks pass 64. The controller was stopped only after two child-empty checks, preserving accepted provider jobs; it resumed with the same persistent ledger. Remaining accepted cohorts 008–010 are still processing. The current count and lifetime figures are in artifacts/question-factory/continuation-500/REPORT.md; neither pending work nor historical duplicate publications count as delivery. Production student availability still needs the owner to save the prepared signing secret; OpenAI billing login returned an authentication error, and its historical 503 maximum reservation remains fully counted.

## 7 October 2026, 09:05 UTC — content-bound retrieval and automatic final evidence

The stronger real staging check passes 413/413 approved items across all four subjects, verifies actual passage-group IDs and nine complete groups, and finds no rejected questions in retrieval or storage. Its proof binds the complete exported content/evidence hash and the unchanged academic validation contract d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399. Anonymous/student admin denial, cross-origin rejection, funded checkpoint replay, unfunded 10k denial and the preserved $25 monthly student AI cap also pass. No paid model calls, emails or production data writes occur in these checks.

The final export now refreshes REPORT.md automatically. Once every registered candidate and accepted provider processing stage is terminal and the actual usable bank reaches 500, it runs one real staging retrieval and, under the existing production authorization, one real production retrieval. Attempts are persisted before dispatch; content, evidence, academic verification contract and retrieval-script content bind reuse. Interrupted/failed checks remain explicit rather than being presented as completion. After an external configuration fix, --refresh-final-evidence rechecks without generation or paid evaluations. This lets the persistent worker finish reviewable evidence if chat usage ends while native results are still pending.

The factory suite passes 317 tests. Recovery passes 39 and question/payment/ticket checks pass 67. Production submission fix 2e50d71 remains Ready; new production factory retrieval still needs owner submission of the prepared signing key. The fixed 1000-candidate campaign remains incomplete and its pending native requests are retained, not resubmitted or counted as delivered.

## 7 October 2026, 08:38 UTC — deployed submission fix and safe campaign restart

Production 2e50d719cf86e83dc6fc8fbab5fcfaef5f45f8a8 is Ready/Latest (50-second cloud build), verified on its exact Vercel overview. The expanded recovery command passes 39 tests. Actual full mocks for all four subjects and English quick practice pass the separate-staging launch/submission/replay check; every selected item is in the new approved bank.

The controller was restarted only after two inspections confirmed no active worker child. Its old process ended; no worker child or provider job was terminated. Actual restart evidence retains all 293 previous accepted provider IDs, zero missing IDs and all 6079 ledger requests. The resumed controller reports the current 413 usable questions rather than the old module's conservative undercount of 410. Accepted request IDs were not resubmitted.

Pending-capacity scheduling now waits for already accepted candidates or settled approvals that can fill the target before buying another cohort. This potential is an upper bound, not promised yield. Terminal receipt-only holds contribute no fictitious delivery capacity and remain fully committed; bounded unrelated work remains permitted. The new scheduling cases and existing budget/concurrency/recovery checks pass (17 targeted tests). The export report binds its coverage snapshot to its own inventory measurement so an older running controller cannot overwrite the report's count or topic contract.

The live campaign remains unfinished: six completed fixed cohorts, 600 candidates, 413 unique published questions; cohort 007 has 78 approvals, 17 rejected and five accepted requests pending, and cohorts 008–010 still await accepted authoring results. At 08:25:58 UTC, lifetime receipt-settled usage is $10.680328 and conservative holds $1.139486, committed $11.819814 under $50. Production student retrieval still requires owner entry/submission of the prepared signing key; provider invoices and the historical 503 usage remain unresolved. None of the queued work is counted as completed delivery.

## 7 October 2026, 08:20 UTC — actual full-paper submission repaired and verified

Production commit 66aef5f is Ready (50-second cloud build), including source families through fixed cohort 010. This does not establish new factory student retrieval: owner submission of the prepared Production CUET_EVIDENCE_SIGNING_KEY remains pending.

Actual separate-staging API launches exposed a real issue: 50 selected factory questions carried sufficient verification records to make the encrypted device-held session ticket exceed the 600k submission limit. New p2 tickets compress the complete server snapshot before AES-GCM encryption, retain an 8 MiB decompression bound and the existing 500k ticket ceiling, and keep valid p1 tickets readable. No academic evidence, keys, source records or historical receipts were dropped. Sealing still precedes charging; oversized sets fail before spend.

The corrected live staging check passed English quick practice and all four 50-question/60-minute full mocks, actual approved-question selection, four options, passage delivery, hidden timed-session keys, free replay and idempotent submissions. Synthetic unanswered attempts score zero; these are test records, not learner-gain or fresh academic reliability evidence. Failed initial checks remain in practice-launch-checks.json. The existing disposable student received a separately recorded 160-credit non-monetary staging fixture; production balances, entitlements, payment receipts and AI budgets remain untouched.

Verification: 35 existing recovery checks and 67 question/payment/ticket checks passed; the four new ticket checks cover exact large-snapshot recovery, legacy readability, authentication/tampering/ownership/expiry, and decompression limits. The complete release build passes. The new ticket suite is now included in test:recovery. Accepted generation requests continue under their original IDs; the 500 delivery target and final accounting remain unfinished.

# Implementation status — latest update: 7 October 2026

## 7 October 2026 — owner-approved production release and cost optimization (ongoing)

- Update 07:57 UTC: six completed fixed cohorts retain all 600 candidates: 413 approved, 187 withheld, gross cohort cost $3.447259. Actual signed-in staging retrieval at 07:51 verifies all 413 exact records (English 111, Accountancy 86, Business Studies 111, Economics 105), nine complete passage groups and zero rejected items. All 413 have production atomic storage receipts; new production student retrieval still needs the owner signing-key entry. The original fixed 100 remains 50 approved/50 rejected/$0.515798, not substituted by continuation yields.
- Release 9085d02849756710323abf3e702c633b4608dfcf is visibly Ready/Latest on www.mockmob.in after a same-commit clean rebuild (70 seconds). Initial Vercel restored-cache build failed in Turbopack Google-font module resolution; the uncached rebuild passed. Actual production feed preserves existing library access in all four subjects. Factory 315/315, recovery 35/35, question/payment 63/63 and production build pass; frozen academic contract remains d80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399.
- A repeated authenticated staging check hit the 30-second request timeout because controls downloaded/classified the full bank twice. Controls now retain the first inventory's explicit counts_snapshot_at, apply the same funding/evidence gates, then re-read actual database controls without a second whole-bank download. Live authenticated release/replay and all-413 retrieval pass, as do the subsequent build and recovery checks. No correctness gate or paid-model stage was removed.
- The local helper's IPv4-only binding did not match this host's localhost (::1) resolution. Helpers now bind only to localhost and the direct localhost health check returns 200. Existing browser error pages are additionally blocked by Browser Use's data-URL policy; no raw browser/security workaround was used. Current rendered admin recapture needs that browser page restored; earlier actual admin/student screenshots remain dated evidence.
- Cohorts 007–010 retain accepted IDs and fixed 100-candidate denominators. Pending authoring and independent batch checks are provider work, not completed questions. The live exclusive guarded controller continues; the $50 content cap and $25/IST-month student cap remain intact. Current exports and dated lifetime reservations/forecasts are in continuation-500/REPORT.md; no global settled-cost or invoice claim while the saved historical 503 remains held.

- Update 07:40 UTC: original fixed 100 and continuation cohorts 002–006 are academically complete (600 candidates; 413 approved, 187 withheld), with completed-cohort gross cost $3.447259. Publication of cohort 003 is still progressing; dated actual counts and receipts are in `artifacts/question-factory/continuation-500/REPORT.md`. Cohorts 007–009 retain their fixed denominators and accepted provider IDs; queued candidates are not counted as usable delivery.
- Actual signed-in staging retrieval at 07:27 verifies all then-published 253 exact keys/options/explanations, six complete passage groups and zero rejected items. Monthly student AI cap remains $25. Latest deployed commit fc060f2 is visibly Ready/Latest in Production (43-second Vercel build). New factory production student availability still requires the owner signing-key entry and current family registry deployment.
- Fixed a deterministic answer-guard false positive: the ordinary dictionary definition “understood in more than one way” was wrongly treated as a combined-answer choice. Combined-answer options remain withheld; two regressions pass. Independently validated academic content and keys were unchanged. Recovery 35/35 and question/payment 63/63 pass after this correction.
- English coverage now separates exact numbered/lettered official syllabus phrases instead of treating the whole PDF as a single unfillable topic; independent tag disagreement remains unclassified. Five official-topic regression checks pass. Aggregate exports now disclose all completed cohort economics alongside the predeclared current-author-contract subset and lower independent craft ratings; no partial or favorable-cohort selection.
- The first v3 authoring cohort completed 88/100 approvals for $0.695839, with overall scores 28 at 7 and 60 at 8. These are sound-to-ordinary practice ratings, not uniform premium or accuracy guarantees. Actual committed lifetime snapshots include all outstanding reservations and the historical $0.011096 OpenAI 503 hold; no provider invoice or globally settled-cost claim.

- Update 06:00 UTC: two fixed 100-candidate cohorts are complete. Original: 50 approved/50 rejected/$0.515798; native cohort 002: 53 approved/47 rejected/$0.482092. All **103** newly approved items are published in staging and production database. Signed-in staging student retrieval verifies all 103 exact keys/options/explanations and two complete passage groups; no rejected item retrieved. Production student availability of new factory items still requires the pending owner signing-key entry; it is not counted as verified delivery.
- Production compatibility release **9bf60d0cf6e4faaf62ef12dfeae048d7fa90e6c7** is Ready (49-second Vercel build). Its actual public feed again returns existing library questions in all four subjects. Fixed a regression requiring screening receipts on every pre-existing row; existing holds and any failed/stale receipt still withhold a row, and modern factory evidence/provenance cannot use legacy compatibility. 313 factory, 35 recovery and 61 question/payment checks pass; production build passes.
- Atomic publication caught three individually approved children with differing chapter classifications in one registered passage. The publisher stopped correctly. Prepublication inspection now uses that same unchanged group contract and quarantines the entire affected group before RPCs. Three additional removals reduced native cohort 002 from 56 to 53; no forced repair, rewritten answer or score inflation.
- Cohort 004 authoring finished with 87 responses and 13 provider-confirmed invalid-schema failures: strict quote enums cannot contain newline characters. Failed requests remain in its denominator. New author contract v3 uses exact contiguous source spans without control characters. Existing accepted v2 bodies and idempotency keys are preserved byte for byte; no accepted ID is replaced. Regression tests cover both.
- At 05:59 UTC the actual lifetime ledger was $9.230111 committed, including pending validations and conservative holds. This is a dated snapshot, not a final cost or provider invoice. Cohorts 003–005 are still in progress. **500 registered candidates is not 500 approved questions.** The guarded worker continues toward 500 new usable publications; current-author-contract forecast remains unmeasured until complete cohorts exist. Content cap stays $50; student cap stays $25/IST month.


## Earlier release record (retained)

# Implementation status — latest update: 5 October 2026

## 5 October 2026 — Source-linked study expansion and journey fixes

Implemented in the isolated `artifacts/study-suite/release` checkout; the original dirty
checkout and its unfinished owner edits are preserved. Existing Android/offline work is
retained. See `STUDY-CONTENT-WORKFLOW.md` for inexpensive expansion and correction rules.

- Current manifest: 21 lessons / 86 cards / 221 task variants; partial lesson coverage
  in 15 of 54 chapters, up from 8. Seven new concept packets cover Planning, Staffing,
  Directing, Money & Banking, Government Budget, Share Capital and Accounting Ratios.
  The preceding 14 lessons and 65 cards retain their exact canonical content hashes.
- Source-linked authoring compiles teaching, contrasts, concept maps, original checks,
  recall and printable material once. Strict PDF/digest reconciliation, independent
  arithmetic and packet/key checks passed with no quarantine. Skipping PDF checks cannot
  publish; same-version mutations fail. No paid content generation ran.
- Saved SQL and PGlite receipts preceded current-project inserts. Read-only live plan
  matched all 79 preceding rows; insert verification matches all 107 current unit/card
  rows. Share-capital title narrowed to the three stages actually taught through an
  immutable v2 correction, not an overwrite. Superseded v1 withdrawal follows deployment.
  No question-bank, attempt, entitlement or balance changes were made by the importer.
- Recall introduces new cards only after teaching. Corrected sessions link to current
  lessons. Mixed revision navigates directly and lists learned concepts within the
  20-concept limit. Results show all matched lessons. Student controls use large selection
  tiles, explicit assistance choices, specific next actions and reduced-motion-safe reveals.
- Session validation reads only its bound lesson IDs, with current publication and canonical
  hash checks retained. Catalog growth no longer increases records transferred on every
  Continue/answer request. No latency or field-CWV improvement is claimed without measurement.
- Owner-authorised chapter summaries return reading blocks only, record teaching
  exposure and do not certify completion. Browser print/PDF action and print CSS included.
- Optional one-credit tutor uses only the current published lesson or already revealed
  feedback, validated against owner, version, revision and item before credit reservation.
  Existing $25/IST-month runtime guard and 10/50 Free/Pro allowances retained. One owner QA
  explanation completed: one credit committed, provider receipt $0.00032835. Content
  generation spend remains $0. Same-step saved explanations can replay without a second
  charge. Removed the obsolete Demo Login provider; server-validated Supabase auth retained.
- Fresh verification: recovery 35, learning 80, study 22, payment/answer-integrity/NTA/UI
  45 — 182 distinct tests, all passed without skips. Lint and production build passed.
  Sandbox build stalled; the normal-filesystem build completed, with no config workaround.
  Canonical source/content validation and isolated import/correction dry runs passed.
- Browser preview completed a new Planning lesson, two keyboard checks and the transition
  into three recall cards. Real signed-in run saved and resumed step 2 after reload;
  the tutor returned a correct policy/procedure/rule explanation. Server-backed chapter
  summary loaded in both themes. Comparison/summary at 320/390/768/1024/1440 and short
  landscape: no document overflow; inspected controls at least 44px. These are owner QA
  and viewport-emulation checks, not student outcomes or physical-device performance.

Evidence: `artifacts/study-suite/v3/` and `artifacts/study-suite/coverage.json`.
Published as `86accc3` on `origin/main`. Vercel production deployment
`63WAusDST9US1pFBq9ZEhMMb4W42` is Ready (39s build), created 5 October at 02:06:43 IST.
Live public/auth checks passed: home/Learn/summary shell 200, anonymous catalog/summary
API 401, dev preview 404, Google-only auth providers and apex-to-www 307. Signed-in live
Learn showed 21 lessons and the new chapter entries; Pro mixed revision opened its saved
five-card run directly. The owner's corrected old run now links to the current vocabulary
lesson. The new Planning run resumes across localhost/production with the same saved step.
Share-capital v1 was quarantined after deployment; all 107 current hashes still match.
Rollback keeps records: revert the release commit or disable the existing independent
study flags and redeploy; no deletes.
New rows are ignored by the preceding release manifest. Remaining: 39 chapters without
lessons, deeper coverage within the 15 touched chapters, real-device/offline-pack checks,
screen reader/200% zoom/OS reduced motion, actual print output, field CWV, delayed unseen
question outcomes and Supabase CLI migration-history reconciliation. No full-coverage,
mastery or superiority claim is authorized by this source/self-study gate.

## 4 October 2026 — Mobile refinement publication authorized (Codex)

The owner explicitly requested committing these changes to the live website. Publishing
the verified mobile refinement through `main` and the existing Git deployment integration.
Physical-device/background-tab acceptance and the inconsistent throttled LCP result remain
documented limitations, not completed checks. No database or environment changes are part
of this publication. Deployment completion is to be checked against the live domain.

## 4 October 2026 — Mobile refinement implemented locally (Codex)

Owner approved implementation and the public companion name **Mobi**. Detailed changes,
measurements and limits: `MOBILE-REFINEMENT-IMPLEMENTATION-2026-10-04.md`.

- Lab starts only when its content is readable. One clock pauses offscreen/hidden;
  manual steps pause and explicit Replay restarts. Compact phone controls and natural
  panel sizing; Mobi uses contained local reactions, preserving desktop travel.
- Phone hero/exam palette refined. Practice summary repaired at 320px (390px → 166px).
  Result Find shortened through disclosure (1247px → 399px at 390px). Light answer-state
  contrast corrected; navigation glass has opaque accessibility fallbacks.
- Arena header now sticks correctly. More opens without page jumps, scrolls between
  measured header/dock bounds, and restores opener focus on Escape. Final checks at
  320px, 390px with 200% text, and 844×390 landscape reached the last account action.
- Responsive matrix: 56 homepage/Practice/Result/quick-runner configurations across seven
  widths and both themes; no root overflow or page exceptions. Timing, reduced motion,
  text zoom, Mobi fallback, both NTA skins' answer/palette flows, public demo, theme
  persistence and free/error states verified in development fixtures. Result contrast
  scans had no flagged text. Evidence: `artifacts/mobile-refinement-2026-10-04/`.
- Lint/build passed. Recovery 35, learning 80, NTA/answer-integrity/payment 40: all 155
  tests passed without skips. Diff whitespace check passed. Build EPERM was resolved by
  approved filesystem access, with no cache deletion or configuration workaround.
- Isolated Slow 4G/4× CPU production samples: CLS 0; LCP 1.604–3.532s, so the 2.5s
  target is not consistently met. Physical Android/Safari, actual background-tab resume,
  assistive technology and real signed-in acceptance remain open. Local emulation does
  not establish hardware or production readiness. No paid model, migration or deploy.
- Preview: localhost:3010. Temporary production server 3011 stopped. Existing edits/
  untracked artifacts preserved. No commit or push; publication awaits device/performance
  acceptance and an explicit deployment decision.

## 4 October 2026 — Published mobile audit and Preparoo reference study (Codex)

Audit and plan only; no product behaviour or production changes. Plan:
`MOBILE-REFINEMENT-PLAN-2026-10-04.md`. Evidence: `artifacts/mobile-audit-2026-10-04/`.

- Live homepage: 390/1280px, both themes; Lab autoplay advances to Find while the replay
  has zero visible pixels on phones. The phone rail occupies 376px before the replay.
- Preparoo public reference: 390/1280px, wheel-scroll samples, phone illustration and
  backdrop-filter inventory. Observed mobile hero asset is WebP, plus PNG/SVG assets.
  Phone feature/explanation/preview hierarchy is the useful reference; no assets copied.
- Hydrated Arena fixtures: Practice, branded quick runner, Result at 320/390/430px,
  both themes, 18 captures. Zero document overflow/page exceptions. Narrow Practice
  cost text wraps nearly letter by letter; Result Find occupies 1247px at 390px.
  Light Result option letters produce two contrast flags (~2.75/2.82:1).
- Menu taps and Escape close verified at 320/390px. Public reduced motion shows a
  complete static replay and removes the floating guide. Initial unhydrated captures
  were rejected; localhost-origin retry restored fixture hydration without config edits.
- Next: playback readability gate + compact Lab + Practice summary + Result density/
  contrast, then phone-local mascot, previews/navigation and daylight depth. Mobi is
  a suggested name only, not an approved or implemented rename.
- Browser emulation is not physical-device proof. Real Android/Safari, screen reader,
  throttled production performance, both premium NTA skins and live signed-in workflows
  remain acceptance gates. No attempt, model call, checkout, migration or deploy ran.
  Only audit scripts/docs changed; product suites/build were not rerun. Local preview
  is running on port 3010. Existing untracked evidence directories were preserved.

## 5 October 2026 — Mistake Repair on GPT-6 Luna (Claude)

Owner chose GPT-6 Luna (USD 0.10 in / 0.50 out per 1M) for Mistake Repair: reasoning effort `low` for
the repair, `high` for the blind second opinion (`REPAIR_ROUTE`/`REPAIR_EFFORT` in
`src/services/recovery/mistakeRepair.js`; `AI_REPAIR_MODEL` overrides). `providers.js` now sends
`max_completion_tokens` + `reasoning_effort` (no temperature) to GPT-5/6/o-series and reserves budget
for hidden reasoning tokens. gpt-4o-mini remains the fallback. Price row inserted in production
`runtime_ai_prices` (owner instruction to ship now; file `20261005090000_runtime_ai_price_gpt6_luna.sql`).
Not verified: a live GPT-6 Luna call (the live eval run was blocked by the local permission
classifier). If Luna rejects a parameter, repairs fall back to gpt-4o-mini rather than failing.
Open: key disputes ("No repair for this one") still are not logged as evidence about the key; the
dispute flow designed on 5 October (soft flags, proposed key, student-was-right signal) is next.

## 4 October 2026 (late night) — Result page + Score Recovery Lab redesign after owner test (Claude)

Owner tried a 10-question quick practice (3 right, 7 wrong) and rated the Lab 5/10: no meaningful use,
weird "replay your decisions" slider, page too tall; wanted summary + Pip first, then the Lab, then
each answer with Mistake Repair. Done (see DESIGN.md "Score Recovery Lab"):
- `data/session_recovery.js` (new, pure): marks gap (6 per wrong, 5 per blank), chapters ranked by
  marks lost, per-question time from device events, factual observations. Tests:
  `data/tests/session_recovery.test.mjs` (added to `test:recovery`).
- `ResultPageClient.jsx` rewritten: summary hero with question strip → Lab → accordion answers.
  Removed from this page: ArenaHead, MistakeReplay, SessionReadout, the separate next-step block and
  the compact LearningNextAction (all duplicated the Lab). Components still exist for other pages.
- `ScoreRecoveryLab.jsx` rewritten as Find / Repair / Prove; slider replaced by a folded decision log.
- `MistakeRepair.jsx`: staged loading, two-card trap/why-wrong layout, "matched the key" check,
  auto-run when launched from the Lab queue, "Next mistake: Qn" chaining.
- `/preview/arena?view=result` fixture is now a realistic 10-question session scored by the real
  engine; `/preview/recovery` redirects there.
Verified: recovery 35, learning 80, nta 22, answer-integrity 6, du 19, payment/questions/PrepOS/repair
81 pass; lint clean; `next build` 62/62. Browser: desktop, 375px (no horizontal scroll), light theme,
Start repairing → Q2 repaired → Next mistake Q3 → Q4. Page height on the fixture fell from ~5.8k to ~3.6k px.
Second pass (owner: UI 9/10, clarity 7/10, "too much AI framing"): repair copy no longer narrates
the AI ("Why option C felt right", "Where it breaks", "Checked against the answer key"); server
held/not-explained messages rewritten the same way; sparkle icon replaced by a wrench; observations
are now tag + fact + consequence + one tip; step headers say what each step is for; mono uppercase
labels replaced with sentence case; motion added (score count-up, Pip entrance, strip stagger, bars
and chapter tracks grow when the Lab scrolls into view, repair cards stagger in; all off under reduced
motion). Owner approved commit and push to main.

## 4 October 2026 (night) — Score Recovery + AI unblocked and live in production DB (Claude)

Owner decisions in chat: names (marketing "Score Recovery", feature "Score Recovery Lab", action
"Mistake Repair"); student AI USD 25 per IST month; content generation USD 50 lifetime; AI migrations to
production "with my OK" (then explicit yes on the dry-run report); provider "whichever is best, make a
report" (AI-MODEL-REPORT-2026-10-04.md); OpenAI tonight because the Anthropic key is invalid.
Plan of record: PLAN-2026-10-04-NEXT-DAYS.md.

**Production database changes (owner-approved, applied via Supabase MCP):**
`runtime_ai_guard`, `prepos_credit_reservations`, `runtime_ai_monthly_cap` (new file
20261004120000). Dry run: reports/ai-migrations-dry-run-2026-10-04.json (PGlite rehearsal + production
precondition checks: no collisions, 879 wallets / 108 ledger rows untouched). Found and fixed before
applying: the ledger `reason` check would have rejected every reserve/release (all paid replies would
have failed); a single missing-usage response paused all student AI; prices expired after 30 days.
Verified after apply: cap 25, prices for claude-haiku-4-5, claude-sonnet-5-5, gpt-4.1-mini, gpt-4o-mini
(gpt-4o-mini added by SQL insert), all functions present, readiness script all green.

**Code:**
- `RELEASE_GATES.runtimeAi = true` (PrepOS replies + Mistake Repair); new `aiCommerce = false` keeps
  top-up checkout and charged Rival battles closed (order route, packs, pricing page, Rival).
- Anthropic provider in `src/services/ai/providers.js` (SDK retries off, per-model params: Sonnet 5.5
  without custom temperature / thinking off). `.env.local` routing: OpenAI gpt-4.1-mini fast+smart,
  gpt-4o-mini fallback (Claude routing documented for when the key is fixed).
- **Mistake Repair**: `data/mistake_repair.js` (eligibility, solve-then-explain prompt, blind second
  opinion, output validation incl. banned score/rank promises), `src/services/recovery/mistakeRepair.js`
  (1 PrepOS credit via reserve/commit/release; finished repair stored on the committed reservation and
  reopened free; dispute → blind check → question withheld exactly like a student report, credit
  released), `POST /api/recovery/repair`, `src/components/recovery/MistakeRepair.jsx` on result-page
  wrong answers with "Prove it: 5 fresh questions on this chapter".
- Budgets: AGENTS.md rewritten (limits are owner-set; do not invent stricter ones);
  `CONTENT_LIFETIME_CEILING_USD = 50` in budgetLedger.mjs; COST-POLICY, QUALITY, ROADMAP, README,
  PRODUCT, DECISION, IMPLEMENTATION, BACKLOG, LEARNING-DEPLOYMENT reconciled.

**Verification actually run** (logs: artifacts/ai-night-2026-10-04/):
- Live smoke through the production guard: gpt-4.1-mini ×2, gpt-4o-mini ×1 valid JSON, receipted
  (~$0.00007 each). Anthropic: 401 invalid key (booked conservatively, no pause).
- Live Mistake Repair eval on 10 real published bank questions: 10/10 solved = key, explained,
  $0.0038 total. Sample was all Accountancy (selection by ID order) — not representative.
- Tests: recovery 30/30, learning 80/80 (+5 Mistake Repair, +1 production-migration PGlite), nta 22/22,
  answer-integrity 6/6, du 19/19, payment 12/12, questions 9/9, recovery:validate; lint clean; build 62/62.
- Browser (preview fixture, localhost:3010): repair explained / withheld / out of credits / failure
  states, light theme; result page renders the panel only under wrong answers.
- Month-to-date runtime spend after all tests: ≈ $0.008 of $25.

**Deployed (owner chose "commit and push to main"):** `3c88f92` (all source/docs in the tree, incl.
the owner's and earlier agents' uncommitted work; untracked `artifacts/` 121 MB deliberately not committed).
**Incident:** that tree contained an earlier agent's www→apex redirect in next.config.mjs while Vercel
redirects apex→www, so production looped (50 redirects) for ~15–20 minutes. Hotfix `499475a` removed the
rule; site verified 200 at 01:03 IST on /, /pricing, /cuet-subject-combination, /api/stats; new
/api/recovery/repair and /api/ai/mentor/chat answer 401 signed out. Lesson: before pushing a dirty tree,
diff next.config/middleware against the deployed commit and probe redirects right after deploy. To make
the apex canonical, change Vercel's domain redirect first, then add the rule.
**Not done / gates:** Vercel `AI_*` env vars (code defaults to OpenAI gpt-4o-mini/gpt-4.1-mini, both
priced, so replies work if Vercel has OPENAI_API_KEY — unverified); signed-in production
check of a real PrepOS reply and repair; Anthropic key; learning/recovery migrations (triggers on live
`questions`) still unapplied; homepage/store copy not yet renamed to "Score Recovery"; AI purchases
closed; AI dispute quarantine relies on one model family tonight (both opinions from OpenAI).

Rollback: `update runtime_ai_budget set monthly_cap_usd=0` stops all student AI instantly; or set
`RELEASE_GATES.runtimeAi=false` / `PREPOS_MODEL_REPLIES_DISABLED=true`. Remove the repair route and
component to withdraw Mistake Repair. Wallets and ledger history are never rewritten.

## 4 October 2026 — Differentiator decision and first validation slice (Claude)

Decision: [DECISION-2026-10-03-DIFFERENTIATOR.md](DECISION-2026-10-03-DIFFERENTIATOR.md). Primary bet
"repair that holds", proven on one pathway before eight; trustworthy practice and goal-aware DU tools
support it. Rename to "Mistake Repair" proposed, **not applied** (owner decision). Brain reconciled:
README, PRODUCT.md, ROADMAP-2027 (amendment), IMPLEMENTATION-2027 (Stage 2), BACKLOG (ordered next).

Implemented (local source only; nothing deployed, migrated, seeded, purchased or sent to a model):
- Candidate pathway `data/recovery_candidates/sacrificing_gaining.{source,pathway}.json`: original
  wording, CUET UG 2026 Accountancy (301) Unit II locator with PDF SHA-256, 3 probes / 5 repair /
  6 checks, 14 families, hypotheses secure / direction_reversed / old_ratio_default / new_ratio_used,
  boundary checks (old ratio correct; unaffected partner). State `candidate`; manifest still
  `blocked_sources` with `pathways: []`. `source_registry.json` deliberately untouched (the paid
  worker treats an empty registry as a pause signal).
- Validator `data/pathway_validation.js` + `npm run recovery:validate`: exact-fraction recomputation of
  every key, matrix cell, derived ratio, unique key, option-text/claim binding, family disjointness,
  isomorphic scenarios, sources. 97/97. Corruption tests prove it fails on 13 seeded defects; it caught
  one real weakness during this work (swapped partner attribution passed), now fixed.
- Engine: no-gap diagnosis label; clearer feedback when repair ends; shared plan `primary.facts`
  (record vs rule) incl. immediate-check and upcoming-check states. Server digest now reuses
  `pathwayDigest` from the validator (same algorithm, one implementation).
- PrepOS: "Why this step" facts in the plan panel; free record reply appends the facts; model prompt
  states facts are authoritative (paid replies remain paused).
- Metrics `data/recovery_metrics.js` + read-only `scripts/learning/recovery-metrics.mjs`: completion,
  immediate/delayed/maintenance pass rates (Wilson, n), overdue and stalled attrition, defects,
  diagnosis counts, probe concordance, cost; groups < 5 suppressed; no decision < 30 episodes.
- Capability registry: `EVIDENCE_LEVELS`, `DIFFERENTIATORS`, `differentiatorClaimable()` (false for all).
- Dev-only fixture `/preview/arena?view=recovery&recovery=candidate[&net=lose-once][&clock=h]`: real
  recovery UI on the real engine, idempotent by request key; pathway read server-side in development
  only. Production build contains no candidate item IDs (grep of .next/static and .next/server: 0).

Verification actually run (logs in `artifacts/differentiator-2026-10-04/`):
- `npm.cmd run test:recovery` 30/30 (was 17; +13 candidate tests incl. PGlite storage),
  `test:learning` 74/74, `test:nta` 22/22, `test:answer-integrity` 6/6, `test:du` 19/19,
  payment_entitlements 12/12, mock selector + explore feed 9/9, `recovery:validate` passed.
- Candidate tests cover: per-hypothesis diagnosis/routing/timing (24h, 72h), secure path, conflicting
  probes → general repair, repeat exposure (seen family/question, failed checks consume families,
  exhaustion → blocked_content), interruption (stale submit rejected, expired check reopens repair),
  no key/matrix/claim leakage, concurrent start retries → one episode and one weekly allowance, refused
  start consumes nothing, second concept same week refused, idempotent response retry, answer
  correction → episode invalidated → counted as a defect.
- `npm.cmd run lint` clean; `npm.cmd run build` 61/61 pages.
- Browser (in-app pane, existing dev server on localhost:3010): start → probe 1 with response lost
  after commit → retry returned the committed state, 1 commit → probe 2 → supported old-ratio
  diagnosis, explanation, contrast → routed repair → hand-off to unassisted fresh check (4 commits for
  4 answers); conflicting probes → general explanation; PrepOS shows "Take your first fresh check"
  with record/rule facts; 320px: no overflow, 76px option targets; PrepOS facts contrast ≥ 9:1.
- Read-only metrics against the configured database: `learning_episodes` absent (PGRST205) → n = 0.
  The connected-learning migration is not applied there. Fixture report is labelled simulated.

Not done / gates: academic validation (independent Accountancy reviewer; one definition item flagged
for review); backend-signed evidence for the 14 items; staging migration + seeding + digest
registration; opted-in pilot flag (not built); scored fresh check through `/test` with real
sessions; real devices and screen readers; DPDP legal review (under-18 consent and telemetry before
~13 May 2027); owner decision on the rename; Testbook research (pages unavailable on 3 Oct).

Rollback: delete `data/recovery_candidates/`, `data/pathway_validation.js`, `data/recovery_metrics.js`,
`data/tests/recovery_pathway_candidate.test.mjs`, `data/tests/recoveryCohortFixture.mjs`,
`scripts/learning/{validate-pathway,recovery-metrics}.mjs`, the `candidates` key in
`data/recovery_pathways.json`, and the `recovery:validate`/test-list additions in package.json; revert the
small edits in learning_engine.js, capabilities.js, server/learning.js, MockMobAIHub.jsx, prepos.css,
mentor chat route, systemPrompt.js and the preview files. No data, credit, entitlement or payment path changed.


## 3 October 2026 — Owner round 2: motion, social proof, hero, Arena, Compass Pro, Combo Planner (Claude)

Owner decisions taken in chat this round: demos autoplay by default with an explicit pause; creators shown
with real follower numbers, ordered by reach; Compass gets Pro features (projection, college mapping); a new
USP feature; ₹99/month to be executed; live-site testimonials described by the owner as authenticated.

Implemented (local source only; nothing deployed, migrated, purchased or sent to a model):
- **Mistake Lab** no longer pauses under a passing cursor, a tap or the 35% visibility threshold; it pauses only
  fully offscreen, on keyboard focus, or by its button. Step descriptions share one fixed-height slot, removing the
  6-second layout shift that moved everything below on phones. Verified: steps advance while scrolling, rail
  height constant (376px at 390 wide).
- **Compass ladder** autoplays again by default as an eased, time-based rAF sweep (600–960, 11s); Pause/Play
  resumes from the visitor's score; filters no longer stop it; drag or quick score takes control.
- **Creators section** reframed "Trusted by CUET creators with 199K+ followers": counts read from public profiles on
  3 Oct 2026 (Garima Jain 25.2K + runs @du__club 161K; Rahul Thapa 13K; Prathna Jain 188), bios paraphrased from
  their own profiles, reel likes/comments where Instagram exposed them, sorted by reach, glass summary panel.
  Rahul's reel is marked Partner (his bio offers paid collaborations and the caption carries a discount code).
- **Hero**: CSS scroll-driven depth on the existing planes (aurora/grid/dots lag; drill card lifts on desktop
  only), a glass proof dock (199K+ creator reach, 73 DU programmes, 2 exam screens, 50 in 60), and a
  scroll-scrubbed statement. Progressive enhancement; reduced motion and unsupported browsers get the static page.
- **Compass Pro** (`data/compass_projection.js`, `/api/compass/pro`, `CompassPro.jsx`): per-paper practice
  projection out of 250 (attempt share × +5/−1 accuracy, Wilson range, ≥30 questions), four-paper total (one
  language + three strongest domain), personal DU shortlist (≤8 eligible programme+college targets, Rounds I–III
  in the chosen category, band position), next move (paper with most marks open + weakest ranked chapter).
  Pro enforced server-side; free sees a locked explainer. Labelled a projection, never a prediction or chance.
  No paid model call (runtime AI gate stays off). Advertised on landing, pricing and FAQ.
- **New USP: CUET Subject Combo Planner** (`/cuet-subject-combination`, `src/lib/du/combos.js`): targets + candidate
  subjects → every combination up to the paper limit checked with DU's own eligibility evaluator, ranked by targets
  met, programmes unlocked, fewer papers; "do not drop" subjects computed over all qualifying combinations; deep
  links into the calculator. Free, no signup. Promoted on landing, footer, CUET 2027 guide, sitemap.
- **Arena**: shared `ArenaHead`/`ArenaStats` (Practice's header and ruled stat strip); Today, Review, Progress
  rebuilt from a light "recovery-lab" slab into Arena pages; shared next-step card (full and compact); Radar's
  stray next-step moved under its header; Saved header; shared Empty/Error states restyled (no "// Error").

Not done, needs the owner:
- **₹99/month**: code is complete; creating the live Razorpay plan was blocked by the session's permission
  classifier. Create Plan (₹99, monthly, interval 1) in the Razorpay dashboard, set
  `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` in `.env.local` and Vercel production, redeploy. `publicOffer()` then flips
  every price surface. Run the LEARNING-DEPLOYMENT.md §A staging checks first.
- **Wall of Love**: not published. The July 2026 audit records the live-site quotes as fabricated and removed,
  and one is attributed to the owner. Publish only with written consent per quote; a founder quote must be
  labelled as such (ASCI/CCPA disclosure).

Verification: lint clean; build 56/56 (Edge Runtime warning unchanged); recovery 17/17, du 19/19 (+3 combos),
learning 74/74 (+5 compass projection), nta 22/22, answer-integrity 6/6, payment 12/12. Headless Chrome (CDP,
real input events): Mistake Lab and Compass autoplay timings; creators section 1280 dark / 390 light; hero
depth transforms at 400px scroll; statement word scrub; Compass Pro Pro/free/dark/light/390 with shortlist adds
and verdicts, contrast audit 0 failures; Today/Review/Progress/Radar/Saved fixtures; planner flow at 1280/390,
no overflow. Fixture APIs are stubs; real signed-in data, Instagram embeds on phones, real devices unverified.

Rollback: revert the files above; delete `src/app/cuet-subject-combination/`, `src/app/api/compass/pro/`,
`src/components/du/CompassPro.jsx`, `src/components/du/ComboPlanner.jsx`, `src/lib/du/combos.js`,
`data/compass_projection.js`, `src/components/arena/`, `src/app/hero-depth.css` and the two new tests.
No data, credit, entitlement or payment path changed.

## 3 October 2026 — Astra UI continuation: verification pass and confirmed fixes (Claude)

Local source only. No deployment, migration, checkout, paid generation, bank mutation or external message.
The PrepOS reservation migration remains unapplied. No image generated (none warranted).

Method: the in-app browser pane could not paint while occluded, so interaction checks ran in headless
Chrome driven over the DevTools protocol (scratch script, not committed) with real `Input.dispatch*`
mouse, touch and key events, `Emulation.setEmulatedMedia` for `prefers-reduced-motion` and colour
scheme, and touch emulation (`pointer: coarse`) below 900px. This is lab emulation, not real hardware.

Confirmed defects, each reproduced before fixing and re-checked after:
- **Signed-in Admission Compass, dark theme (high):** `du.css` reads marketing tokens defined only on
  `.mm`; inside the app shell they fell back to light ink (`#0a0a0a` on `#0b100e`, ~1.1:1 headings,
  buttons, notes), unset radii/shadows/`--volt-ink`. Bridged to `--a-*` tokens on `.app-shell .cmp`
  (`arena.css`). Light theme's active "All" chip was also unreadable; fixed by the same bridge.
- **Calculator sticky summary, light theme:** fixed night fill under theme ink (~1.1–1.6:1), public and
  signed-in, below 1100px. Now follows `--paper-raised`.
- **Calculator results at 320px:** implicit auto grid tracks (`.du-main`, `.du-list`) grew to card
  min-content, pushing cards 23–41px past the column. Pinned to `minmax(0, 1fr)`.
- **Wall of Love, 4 entries:** each lane held 2 cards, narrower than the lane, leaving an empty stretch
  every loop. Lanes now repeat hidden copies to at least 4 cards; duration scales per card (~16px/s).
  Accessible tree still lists each quote once. Removed `aria-pressed` beside a state-changing label.
- **Keyboard focus loss to `<body>`:** carousel arrow reaching its end (now `aria-disabled`, focus kept);
  activating an Instagram card (focus moves to "Open original"); demo drill after answering, Next and
  finish (focus moves to Next, first option, readout); Escape from the mobile nav sheet (returns to the
  menu button). Arrow group gained `role="group"` so its label is exposed. Nav `aria-controls` now set
  only while the sheet exists.
- **Mistake Lab, reduced motion:** tapping a question always snapped back to Q4 (effect re-ran on
  `picked`). Fixed. Score live region is quiet while the tour auto-plays.
- **Compass ladder:** UR/SC chips were 42x40 (now ≥44x44); "0 of 0 colleges" when a round/category has
  no published cutoff now says no cutoff was published for that cycle.
- **Narrow/zoomed phones:** below ~300px CSS width (≥125% zoom on a 360px phone) the menu button left the
  screen; hero title and dock CTA clipped at 200% text. Wordmark is visually hidden under 300px (still
  named), theme switch moves into the sheet under 240px, rotating hero phrase may wrap, phone title floor
  1.5rem, dock note yields under a 17rem container, dock spacer grows with text size and safe area.
  320px and wider are unchanged (measured).
- Touch tablets (761–1023px, `pointer: coarse`): NTA comparator's live palette cells 22x36 -> 49x44.
  Breadcrumb and stale-subject links raised to 44px targets.

Not changed after testing: MobileDock clearance at 320x640/740x360 (last footer line 41px above dock);
phone carousel arrows were already visible (44px) at 375/390, so code and notes agree.

Browser coverage actually exercised: homepage at 320, 390, 768, 1024, 1440, 1920 in dark and light
(no document overflow, no console errors, no broken images); 195px and 240/288px nav; 200% root font on
`/`, `/pricing`, calculator, `/cuet/english`; short landscape 740x360 and 568x320; full five-question demo
by touch and by keyboard only; comparator answer/review/switch preservation; Compass programme, category,
round, quick score, range keys and missing rows; Mistake Lab pause, step and tile selection in normal and
reduced motion; Wall fixtures 0/4/many incl. reduced motion at 320; Instagram arrows to both ends and
card activation (a real reel rendered); calculator alias search (BST, Accounts), score, share link,
reload persistence, Edit subjects; 20 public routes at 320 dark and 1280 light; `/preview/arena`
fixture views (free, Pro, inventory down, stale subjects, test, PrepOS plan/record/wallet, Compass,
Radar, Saved) at 320 and 1280. Computed-contrast audit (text vs nearest opaque surface) on home,
calculator, pricing and fixture views, both themes: remaining flags are the logotype dot (exempt) and
two probe false positives (gradient avatar, oklab launcher fill).

Verification: `npm.cmd run lint` clean; `npm.cmd run build` 55/55 pages, existing Edge Runtime warning;
`test:recovery` 17/17, `test:du` 16/16, `test:learning` 69/69, `test:nta` 22/22,
`test:answer-integrity` 6/6, `payment_entitlements` 12/12. `git diff --check` clean on edited files.

Still unverified: real phones (sticky hover, safe-area values, keyboard, 60fps), true browser page zoom
(root-font scaling and narrow viewports were used as proxies), screen readers, Instagram login walls,
signed-in persistence/entitlements/billing (`/preview/arena` is a stubbed fixture), creator permission
for the curated reels. Wall of Love stays hidden: no consented quotes exist.

Rollback boundary: revert the edits in `WallOfLove.jsx`, `CreatorReels.jsx`, `CompassLadder.jsx`,
`DemoDrill.jsx`, `MistakeLab.jsx`, `NavBar.jsx`, `Logo.jsx`, `social-proof.css`, `compass-ladder.css`,
`home-refinements.css`, `landing.css`, `globals.css` (crumbs, dock, nav-narrow, drill result),
`(app)/arena.css` (`.cmp` bridge, `.pr-alert a`) and `du/du.css` (`.du-sum`, `.du-main`, `.du-list`).
CSS/markup/focus only: no data, scoring, credit, entitlement or payment path changed.

## 3 October 2026 — Astra UI continuation handover (Codex)

The previous UI-refinement agent reached the usage limit during the final browser pass. A complete continuation prompt is saved at `docs/brain/CLAUDE-ASTRA-UI-CONTINUATION-2026-10-03.md`. This pass completed focused homepage, Compass, Mistake Lab, reveal, morph and historical-copy refinements, plus integrated social, authenticated-page and public-page work documented in the three `ASTRA-*-UI-NOTES.md` files. No image asset was generated because existing campus artwork and code-native product surfaces cover the meaningful visual needs.

Fresh verification: `npm.cmd run lint` passed with 0 errors and 0 warnings; `npm.cmd run build` passed with 55 generated pages and the existing Edge Runtime warning; `npm.cmd run test:recovery` 17/17; `npm.cmd run test:learning` 69/69; `npm.cmd run test:nta` 22/22; `npm.cmd run test:answer-integrity` 6/6; `npm.cmd run test:du` 16/16; `node --test data/tests/payment_entitlements.test.mjs` 12/12. Browser evidence covers homepage light/dark at 1440, homepage at 390 and compact 320 opening, Compass filters/keyboard/demo/missing-data state, Mistake Lab manual replay, and one real deferred Instagram embed. Wall fixtures, reduced motion, all route states, 200% zoom and real-device behavior remain unverified.

Open UI follow-ups: verify/fix phone carousel arrow visibility versus `ASTRA-SOCIAL-UI-NOTES.md`; inspect Wall fixtures and reduced motion; verify closed NavBar `aria-controls` target and MobileDock height at narrow/landscape sizes; complete route/theme/keyboard browser pass; preserve the honest empty public Wall. No production data, migration, checkout, deployment, paid generation or external communication was performed.

## 3 October 2026 — Astra UI handoff preparation (Codex)

Saved `ASTRA-UI-HANDOVER-2026-10-03.md`: current-source continuation prompt for
homepage refinement and remaining student-facing UI, Scroll Craft plus all 14
Emil Kowalski skill applicability, built-in image generation, and acceptance checks.
Read current contracts and Stage R/R2 notes; inspected the local homepage at phone
and desktop sizes, Compass, dark Instagram strip, and development-only Wall preview.
Confirmed the curated social strip is already present and public testimonials remain
hidden because the consented quote list is empty. No embeds activated in this pass.

No application code changed, no test/build suites rerun, no generation, migration,
checkout or deployment performed. This is prompt preparation, not UI completion.
Signed-in routes, all motion states and real-device behavior remain unverified here.
Rollback: remove the new handoff document and this entry; application source is unchanged.

## 2 October 2026 — Stage R2: original-site comparison, Compass, Radar, NTA, creators (Claude)

Local source only. Nothing deployed, migrated, purchased or sent to a model.

Compared with the live mockmob.in (read in the in-app browser): it had a Compass showcase with a cycling score card
and college labels, a Wall of love, a PrepOS section and a college marquee. Its Compass card showed "Reach / Moderate /
High" chances and a "score band predictor"; those claims are NOT reproduced (AGENTS.md: no admission probability, no
mock-to-CUET conversion). The three quotes on that site were not carried over.

Implemented:
- **Landing Compass ladder** (`CompassLadder.jsx`, `src/lib/du/showcase.js`): a score sweeps (or is dragged) across last
  year's real published Round I-III minimum allocation scores for 10 colleges in 4 programmes and 4 categories, from
  `public/du/2026`. About 10 KB shipped. It states a gap to a past cutoff only and links to the free eligibility tool.
- **Instagram strip** (`CreatorReels.jsx`, `src/lib/social.js`): 9:16 horizontal cards for the 3 creator reels and 3
  MockMob posts found on the public profile. Instagram's own embed loads only when a card is pressed. Edit the list in
  `src/lib/social.js` to add reels. Instagram's login wall blocks reading the feed, so entries are curated, not synced.
- **Wall of love** (`WallOfLove.jsx`, `src/lib/voices.js`): two opposing drifting rows (a grid under 4 voices), hidden when
  empty, only entries with `consent: true`. Dev-only prototype with labelled placeholders at `/preview/wall`. No
  testimonial is published.
- **Practice**: NTA Mode is a featured row (mini exam-console preview, chips, "Closest to exam day") with an exam-screen
  choice (MockMob / NTA style) for Pro and a free preview link for others. The grid is Quick, Full, Smart.
- **Admission Compass page** rebuilt as a product page: opens already ticked from the student's profile subjects
  (link, then saved choice, then profile), a three-step explainer, an honesty note, a bridge from the practice record
  ("Your practice says: ..."), and the sources. Calculator logic is unchanged apart from the seed prop.
- **Radar** rebuilt on the PrepOS record engine plus a theme-aware score trend (Chart.js reads Arena tokens and re-reads on
  theme change). Removed the invented composites ("Rank readiness", "Focus score"), the 1-4 axis radar chart, the
  non-functional "Ask Radar" box and the blurred paywall over made-up metrics.
- **Free vs Pro for the record**: free = marks ledger, top 3 chapters, findings, weekly summary; Pro = every ranked
  chapter, thin-chapter list, changed-answer and pace detail. Enforced in the record view and in Ask (server and client),
  and stated in the pricing page, landing page and PrepOS wallet copy.

Verification actually run: lint clean; `test:learning` 69/69 (adds landing_content 4: real-file cutoff match, embed
format, consent filter, Pro gating of Ask); recovery 17/17, du 16/16, nta 22/22, answer-integrity 6/6; build 55/55.
Browser: landing Compass ladder, reels (the embed loaded a real reel), Wall prototype, Practice with the NTA tile, Compass
page, Radar, at 1280 and 375 widths in light; no horizontal overflow.

Not verified: no signed-in session, so Radar/Compass/Practice used the dev preview with stubbed account APIs (real engines,
real DU data). Saved, Explore, Ranks, Contribute and My uploads were not touched this round. A dark-mode pass of the new
sections was not repeated. Creator names and handles come from the public profile page; the owner should confirm permission.

## 2 October 2026 — Stage R: Arena design language, PrepOS record and wallet, ₹99/month, landing (Claude)

Local source only. Nothing deployed, migrated, purchased, or sent to a model; no real wallet or ledger row was
read or written. Owner decisions taken this round: Pro is **₹99/month auto-renewing**; PrepOS model replies for a
small monthly allowance are **built but switched off** until the gates in LEARNING-DEPLOYMENT.md pass.

Implemented:
- **One icon language.** `src/components/ui/Glyph.jsx`: one lucide family at one stroke weight (`AppIcon`,
  `StatusIcon`, `SubjectIcon` for all 42 subject ids, `ModeIcon`) and two distinct credit coins (`CreditMark`:
  bolt = practice credits, orbit = PrepOS). Replaced the mixed nav icons, the star + "∞" credit pill, the
  38 decorative subject characters, and emoji/text glyphs (✅ ❌ 💡 🌵 ⚡ ★ ▲ ▼ ↻ ✓ ✗ ⚠) in Arena, uploads, feed
  cards, onboarding and votes. Remaining hits in `scripts/design-audit/glyph-audit.mjs` are the now-unused
  `glyph` data fields, a comment and a seed question.
- **Credit display fixed everywhere.** Pro now reads "Unlimited" (coin + word, not "∞" or "no credits") in the
  top bar, Practice, Account and the modal; free reads the number. A second chip shows the PrepOS wallet
  (unknown wallets show "—", never a number). Practice credits and PrepOS credits are always labelled apart.
- **Practice screen rebuilt** (`DashboardPageClient.jsx` + `.pr-*` in `arena.css`): two-column layout with a
  sticky session summary (a pinned launch bar on phones), subject and mode tiles with icons, official subject
  codes and entitlement badges, segmented controls, a Fine-tune disclosure, ruled stat strip, recent sessions
  with subject icons, status badges with icons. No inline `<style>`. Launcher no longer covers the Start button.
- **₹99/month.** `pro_monthly_99` plan, `/create-monthly-subscription`, `/api/billing/cancel`, checkout in
  `RazorpayPaymentButton`, `PlanCard` on Account (renewal date, two-step cancel). `publicOffer()` is the single
  source for pricing page, landing page, Arena upsell, modal, SEO title and mobile dock. Closed until
  `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is set; until then the existing ₹99 one-time access stays the honest offer
  and copy says monthly "opens soon". When set, new one-time checkouts close; old orders keep verifying.
- **PrepOS record engine** (`data/prepos_insights.js`, free, no model): marks ledger (+5/−1, blanks), accuracy with a
  Wilson range, chapters ranked by marks left open only with ≥4 answered questions (thin chapters listed apart),
  difficulty split, pace from device events, answer changes counted both directions with the net, last-7-days vs
  previous week. Surfaces: PrepOS "Your record" tab, "Ask" answers record questions instantly and free, Today
  shows the top finding, the Result page shows "Where your marks went" for that session.
- **PrepOS wallet clarity.** Monthly meter ("38 of 50 left", reset date, no carry-over), purchased credits shown
  apart, plain list of what is always free and what costs 1 credit.
- **Model replies, gated.** Migration `20261002130000_prepos_credit_reservations.sql` (saved, NOT applied) adds the
  reserved→executing→committed|released lifecycle; `runModelReply` wraps the existing provider/runtime-budget
  guard; chat route answers record questions free, explains the plan while paused, and runs the lifecycle only
  when `RELEASE_GATES.runtimeAi` is true. Client keeps one request id per action and reuses it only after an
  unknown outcome.
- **Landing.** The section after the hero is now the interactive "Mistake lab" (`MistakeLab.jsx`, `mistake-lab.css`):
  four auto-advancing, tappable, pausable steps (replay → leak → one next move → fresh check later) on one
  labelled illustrative session, reduced-motion and keyboard safe; the recovery step shows its real release state.
  Sharper hero and section copy; offer-aware trust row, pricing block, FAQ and stats cell. NTA/MockMob comparison,
  scroll reveals and the rest were left untouched.

Verification actually run:
- `npm.cmd run lint` clean. `npm.cmd run build` 54/54 pages, new routes present.
- `test:learning` **65/65** (adds `monthly_billing` 5, `prepos_insights` 8, `prepos_reservations` 9 in real Postgres
  via PGlite, `prepos_model_reply` 9, plus the earlier quote/wallet suites). `test:recovery` 17/17, `test:nta` 22/22,
  `test:answer-integrity` 6/6, `test:du` 16/16, `payment_entitlements` 12/12, selection/offline 16/16.
- Reservation SQL cases proven: retry same key charges once; over-reserve refused; release restores included then
  bonus exactly and is idempotent; released key cannot be reused; commit final both ways; month rollover returns
  expired included credits as bonus; expiry sweep; ledger explains balance; service-role only. PGlite is one
  connection, so these prove arithmetic and idempotency, NOT multi-session lock contention.
- Browser (dev-only `/preview/arena`, stubbed account APIs built from the real pure engines, plus the real `/`
  and `/pricing`): Practice, PrepOS record/ask/wallet and landing at 320–1366 widths in light and dark; computed
  contrast audit (full text coverage) clean on Practice, PrepOS record and wallet (light), Practice (dark; one
  false positive: black on a volt gradient avatar), landing and pricing. No horizontal overflow. Unauthenticated
  boundary: new endpoints return 401.
- Lab auto-advance, pause, step taps, tile inspector exercised in the browser.

Not verified / known gaps:
- No real signed-in session: Account PlanCard, Result-page readout and Today glimpse are lint/build verified and use
  the same components as the verified previews, but were not rendered with live data. No real Razorpay checkout
  (test or live), no webhook replay, no model call, no real Android or screen-reader run.
- Research: 20 pages requested, 16 usable; far below the 300–400 requested. See DESIGN-REFERENCES.md.
- The Chart.js screens (Radar), Moderation, Saved and Explore were not re-skinned in this round.
- Account plan card forgets a requested cancellation across reloads; subscription is created with 24 cycles.

Next incomplete criteria: staging for the reservation migration + Razorpay test plan (LEARNING-DEPLOYMENT.md A/B);
signed-in two-theme pass of the remaining app routes; then Stage C (durable sessions) and Stage D (bank audit).

## 2 October 2026 — Claude handover execution, Stage A (Arena capability/theme truth)

Local source only. No deployment, migration, checkout, paid model call or content
generation. Existing user edits preserved. Checklist: `CLAUDE-WORKLOG.md`.

Implemented:
- `data/subject_registry.js`: versioned subject registry with official codes verified
  against the NTA CUET(UG)-2026 subject list (cuet.nta.nic.in, "Last Updated Sep 02,
  2026", checked 2 Oct 2026; provisional for 2027). Crosswalk keeps old IDs
  (`gat`→501, `applied_mathematics`→319; Engineering Graphics, Entrepreneurship, Legal
  Studies, Teaching Aptitude are not in the 2026 list → `retired`). Stored choices are
  never deleted; unsupported ones show a reason and cannot launch.
- `data/capabilities.js`: capability IDs/versions, inventory purposes (ordinary,
  recovery-eligible, original sample, verified historical — none claimed), and per-mode
  capabilities with entitlement copy that never ranks question quality.
- `data/practice_quote.js` + `GET /api/practice/quote`: read-only server launch quote
  (entitlement + expiry, allowance, credit cost, duration, inventory policy/count,
  reason, 60-second staleness, server-minted idempotency token). Unknown inventory or
  an unreadable allowance is unavailable, never free. Dashboard renders only this; the
  launch button is disabled unless the quote for the exact selection is launchable,
  re-checks a stale quote, and reuses the server token across retries.
- Dashboard copy: removed "Fast lane active", "highest-quality selection layer",
  "Upgrade for premium question quality", "Most Popular" badge and "unlock more premium
  mocks"; counts say "usable questions in the ordinary library" with unavailable state.
  Onboarding lists only practice-supported subjects and lets stale saved ones be removed.
- Today: the 10/20/30 choice now sets the session (`/dashboard?mode=quick&count=10|20`,
  30 min = 20 questions + 10 minutes review) and states the duration/charging contract.
- Arena theme: semantic `--a-*` tokens for dark (Night Arena, unchanged values) and an
  intentional light palette, scoped to `html:has(.app-shell)` so portals/toasts follow.
  Tailwind's variable-backed palette is remapped in light mode; volt-as-text becomes
  `--a-accent-text`. Theme switch added to the app top bar (≥640px) and mobile sheet,
  using the existing `mm:theme:v1` preference (set pre-paint by the root script). The
  pre-shell auth screen has a light variant. The NTA-style console pins its previous
  token values so it renders exactly as before in either Arena theme. PrepOS launcher
  stays a deliberate dark island.

Verification actually run:
- `npm.cmd run test:learning` 12/12 before adding the new file; new
  `data/tests/practice_quote.test.mjs` 10/10 (final suite totals are in Stage B below) (registry codes, stale/retired/unknown
  subjects, premium block, unknown/short/empty inventory, zero credits, included/used/
  unknown allowance, expiry, no quality ranking, minutes→session). `test:recovery` 17/17.
- `npm.cmd run lint`: clean. `npm.cmd run build`: first attempt failed fetching the Geist
  Mono Google Font (network); immediate retry compiled and generated 54/54 pages.
- Browser, dev-only `/preview/arena` (mock user, stubbed account APIs, quote built by the
  real `buildPracticeQuote`) on the owner's running dev server: computed-contrast audit of
  every visible text node (`scripts/design-audit/contrast-audit.js`) and overflow check.
  Dashboard light: 0 failures at 320/375/768/1024/1280/1920 after fixes; dark at 320 and
  1280: 0 (one false positive: black on volt-gradient avatar). Branded runner light 375:
  0; answer selection causes no layout shift (paper 598px before/after); selected border
  #6f8700 ≈3.9:1. NTA console in both Arena themes: unchanged conventional skin (only its
  existing orange "visited" chip, 4.4:1, which predates this change). Exercised states:
  stale saved subjects, inventory outage, insufficient inventory (15 > 12), Pro included
  with expiry, theme toggle click + persistence. No horizontal overflow at any width.

Not verified / remaining for Stage A:
- Signed-in routes other than the dashboard/runner harness (Today, Review, Progress,
  Radar, Account, Saved, Compass, PrepOS, Explore, Ranks, Upload, Result) were not
  rendered: no session in the built-in browser and no credentials may be entered. They
  inherit the token remap, but charts (Chart.js colours), page-specific inline styles
  (TestPageClient result states, MyUploads, Moderation, Upload, Analytics) still need a
  signed-in two-theme pass. Keyboard-only and screen-reader passes not done.
- Recovery-launch quotes (`purpose=baseline/full_sample`) are computed but not exposed in UI.
- Lead, not fixed: the root font is 15px, so Tailwind `min-h-11` renders 41.25px (17 uses
  outside PrepOS). New PrepOS controls use explicit 44px.

## 2 October 2026 — Stage B (PrepOS wallet safety and explanation layer)

Local source only. Paid PrepOS stays paused (`CAPABILITIES.optionalAi.state = 'paused'`).
No wallet balance, ledger row, payment or migration was changed; no model was called.

Implemented:
- `src/services/credits/aiWalletState.js` (pure): explicit wallet states `available`,
  `empty`, `paused`, `schema_unavailable`, `error`, with a safe message. An unreadable
  wallet has `known:false` and null balances — never a synthetic allowance or a spendable
  zero. Paused wallets still show real stored balances, not spendable. Central
  `isPaidUser` uses `effectivePremiumFromRow` (status / paid-through / legacy flag) at call
  time, so expired access stops counting.
- `aiCreditWallet.js`: `readAIWallet` is one select; it never inserts, resets or syncs
  (the monthly reset/allowance sync is projected and applied only inside the atomic RPC).
  `consumeDirectly`/`grantDirectly` and the swallowed ledger insert are deleted. Spend is
  RPC-only, requires a caller-stable operation key, and returns `prepos_paused` before any
  RPC while paused; a missing RPC fails closed (503). Grants for captured purchases still
  use the atomic grant RPC (historical orders and webhook/verify paths unchanged).
  Narrowed missing-function detection so real RPC errors are not treated as "missing".
- `consumeAIAllowance`: refuses while paused before reading or charging; uses the caller's
  operation key (Rival: `rival:<battleId>:<action>`), never `Date.now()`. Rival refuses a
  paid benchmark before creating a battle row while paused. Usage snapshot accepts a
  pre-read wallet and refuses charges unless the wallet is spendable.
- `GET /api/ai/credits`: one wallet read, `state`/`message`, practice credits labelled as a
  separate ledger, `checkout.open`, packs carry `status: 'paused'`.
- PrepOS hub rewritten as an explanation layer: "Next step" renders `/api/learning/plan`
  with the same 10/20/30 choices as Today; "Ask" answers product/credit/DU questions
  deterministically and sends plan questions to the existing no-charge server route;
  "Tools and wallet" shows the wallet state read-only with no pack buttons. Removed local
  missions/day plans/setup planner (20/45/60/90), benchmark entitlements, "GPT-4.1 mini"
  and "college and course direction" copy. DU wording now: published 2026 eligibility
  rules and Round I–III minimum allocation scores by category, historical only, no
  admission prediction or mock→CUET score conversion. Hub remounts per account.
- Retired unreferenced legacy `MockMobAssistant.jsx`, `AIAssistantDrawer.jsx`,
  `AIAssistantLauncher.jsx` (no importers; tracked in git) and a dead charge helper in
  `/api/ai/actions/execute`. `/pricing/prepos` shows the paused message, "—" for unknown
  figures and lists packs only when checkout is open. Rival shows "—" for unknown wallets.
- `scripts/learning/wallet-reconciliation.mjs`: read-only wallet↔ledger reconciliation
  (grants − bonus spends vs stored bonus; included spends this period vs stored usage;
  orphan ledgers). Offline `--fixture` or explicit `--remote-read`; never writes.
- PRODUCT.md lines promising fast lane, score-band estimate, college recommendations,
  peer review and live AI packs are marked superseded.

Verification actually run (all exit 0):
- `test:learning` **33/33** (includes `practice_quote` 10 and new `prepos_wallet` 11:
  expired/legacy entitlement, missing schema, read error, paused, stale period projection,
  unmaterialised wallet, client mapping of failed/legacy responses, narrow missing-function
  detection, source guards against direct writes/time-based keys, real
  `mm_ai_consume_credits` in PGlite: two consumes over balance → one succeeds, same-key
  retry charges once, ledger insert failure rolls back the balance; grant idempotency;
  reconciliation flags drift). PGlite runs on one connection, so "concurrent" consumes are
  serialised — this proves arithmetic/idempotency, not multi-session lock contention.
- `test:recovery` 17/17, `test:nta` 22/22, `test:answer-integrity` 6/6, `test:du` 16/16,
  `payment_entitlements` 12/12; payment + mock selector + practice filtering + offline
  batch (schema/dedup/alignment/generation/import) 24/24. `npm.cmd run lint` clean.
  `npm.cmd run build` 54/54 pages.
- Unauthenticated dev-server checks: `/api/practice/quote` 401 with unavailable state,
  `/api/ai/credits` 401, `/api/learning/plan` 401, `/api/subjects` 200.
- Browser (`/preview/arena?view=prepos`, stubbed APIs built from the real pure functions):
  plan at 375 light; paused wallet shows 68 / 38/50 / 30 with the required message and no
  pack buttons; `wallet=down` shows only "could not be read… Nothing has been charged";
  Ask answers for credits, DU chances and "what next" at 320 dark; keyboard focus ring on
  section tabs. Contrast audit was corrected mid-run (it had skipped oklch/oklab colours)
  and every Stage A/B view was re-run with full coverage: 0 failures except the known
  avatar false positive.

Remaining gates before any paid PrepOS reactivation (unchanged: stays paused):
1. Student-ledger reservation lifecycle (`reserved → executing → committed/released`)
   does not exist yet; only provider-side runtime reservations/receipts
   (`20261002121000_runtime_ai_guard.sql`). Provider timeout, unusable output and
   deterministic-fallback reversal tests cannot be written until that path exists.
2. Staging verification of `ai_credit_wallets`/`ai_credit_ledger` and both RPCs, then a
   `--remote-read` reconciliation run reviewed by the owner (not run; production data was
   not read).
3. Real multi-session concurrency test against staging Postgres.
4. Signed-in browser pass of `/mentor`, `/rival`, `/pricing/prepos` and account switching.

Next incomplete acceptance criterion: Stage A signed-in two-theme pass of the remaining
app routes, then Stage C (durable sessions/recovery integration) and Stage D (read-only bank
audit against the subject registry). Stage 1 explicit staging schema remains the release gate.

## Approved roadmap execution — source implementation, launch still gated

The complete product is **not released or definition-of-done complete**. Existing
user edits were preserved. No production/staging migration, quarantine application,
deployment, real checkout/refund or paid generation was performed in this run.
The content ceiling remains $2 calibration within $10 lifetime; runtime AI funding
has not been authorized. Current offer remains ₹99 through 31 July 2027.

Implemented local behavior:

- Central capability/release truth, versioned ₹299 plan and coordinated future copy;
  old ₹99 orders, access and offer amounts are retained. New sales remain gated.
- Bounded diagnosis, selected/general reasoning repair, independent numeric solvers,
  choice/numeric/evidence-span responses, fresh-family reservation and two delayed
  checks. Wrong/unanswered/expired checks reopen repair; repeats and assistance
  cannot certify understanding. No hidden keys/matrices/future questions in plans.
- Saved service-only owner/allowance/episode/observation/exposure transactions,
  durable sessions behind a switch, legacy ticket compatibility, revision/idempotency
  checks, account ownership and changed/held-content invalidation.
- Shared next action for Today/Radar/results/PrepOS; ordinary mistake Review and
  episode-based Progress; functional recovery forms/check launch in the existing shell.
  Decision replay distinguishes event effects and net changes. Experiments deferred.
- Compass now uses sourced DU rules/cutoffs; fictional chance/score predictor removed.
- Persistent request reservations/usage receipts and rate limiting saved in Postgres
  migrations. Unknown costs/funding block physical AI dispatch. Core plans/repairs
  have no paid model dependency. New AI top-ups/replies paused; wallets preserved.
- Rival duplicate/ownership guard and atomic completion SQL. Answer changes archive
  history and queue recomputation; comparable revalidated score derivation keeps
  original attempts intact. Edited/reordered answers cannot reinterpret old indexes.
- Shared practice eligibility for inventory, truthful zero/unavailable counts, public
  aggregate caching; current copy/legal/theme refinements and optional shorter guide.
  Open test-email sending is disabled by default and admin/rate limited if enabled.
- Roadmap authority, implementation checklist, local preflight and deployment/rollback
  instructions saved in the brain. Earlier pilot/count/store order is superseded.

Verification actually performed:

- `npm.cmd run test:recovery`: 17/17 passed.
- `npm.cmd run test:learning`: 12/12 passed. Includes isolated PGlite transactions
  for allowance concurrency, owner restrictions, response retries/CAS, original
  snapshot preservation, answer correction queues and family-hold invalidation;
  zero-funding/unknown-price/reservation/receipt/rate-limit behavior; Rival atomicity.
- Combined `node --test data/tests/*.test.mjs` plus recoverySafety, evidencePipeline,
  sourceAdapters, practiceModeFiltering and offlineBatchSchema/Dedup/Alignment/
  Generation/Import: **101/101 passed**. Includes NTA, answer integrity, mock selection,
  payment/entitlement, DU and offline import gates. Fixtures are software-only.
- `npm.cmd run lint` and `npm.cmd run build`: passed before the final HTTP boundary
  follow-up; final repeat results and HTTP checks are recorded below.
- `node scripts/learning/preflight.mjs`: sources 0, academic calibration paused,
  pathways 0, current price ₹99, ₹299 disabled. See reports/learning-preflight.json.
- Browser (local development server): homepage at 320px in both themes, keyboard
  Space theme toggle, pricing at 320px, honest count failure display and unreleased
  recovery notice. No horizontal overflow on inspected home/pricing. Recovery rendered
  its unavailable state with ordinary Practice/Review links; existing session resolved
  and GET /api/learning/plan returned 200. No new study attempt or payment initiated.
  One navigation timed out before its rendered state resolved; it was not treated
  as a completed flow until the DOM showed the actual unavailable state.
- Initial local production boundary pass: 8/9 expected statuses. Empty anonymous
  mentor payload returned 400 before authentication; auth/rate limiting moved before
  parsing/context work, with a bounded payload. Final repeat recorded below.
- No screen-reader, real Android, constrained-network, Lighthouse or field CWV
  result. Theme/320px inspection does not establish accessibility or device readiness.

Release gates and remaining implementation:

1. Explicit staging schema verification/application of saved migrations, including
   older interactions, bookmarks/progress, atomic credits and recovery foundations.
   Rival additionally requires the older db/migrations AI-overlay tables before its
   new submit service deploys. No source deployment should bypass this dependency.
2. Eight permitted/versioned, independently calibrated concept pathways with complete
   fresh inventory. Sources and academic benchmarks are empty; no academic accuracy,
   student learning gain or source-backed coverage is established by these tests.
3. Real authenticated baseline → investigation → repair → immediate → two delayed
   checks, resume/account-switch/concurrency/expiry/invalidation/exhaustion tests in
   staging. Audit legacy device-ticket wall-clock limitations; its telemetry cannot
   prove answer timing. Durable server checks enforce deadlines without grace answers.
4. Correction-queue worker, report-triggered evidence re-evaluation, payment
   reconciliation and cohort/cost/support reporting remain unfinished. Uncertain
   content stays withheld. Fresh timed decision experiments wait for the core loop.
5. Real staging captured checkout, old pending orders, new V2, signature/owner/amount,
   webhook retries and refund/revocation. Optional runtime wallet reservation/reversal
   and price/funding receipts remain gates; paid AI stays paused.
6. Android/accessibility/performance, season receipts and ≥70% contribution margin;
   opted-in cohort before public recovery/₹299. Do not sell planned features as live.

Next incomplete acceptance criterion: **Stage 1 explicit staging schema and real
authenticated session/owner flow**. Stage 2 cannot release until academic source and
calibration gates pass. See IMPLEMENTATION-2027.md for the dependency checklist and
LEARNING-DEPLOYMENT.md for switches, migration order and non-destructive rollback.

Final follow-up results:

- Final `npm.cmd run build`: exit 0; optimized Next 16.2.4 build completed. Existing
  edge-runtime/static-generation warning remains informational.
- Final standalone `npm.cmd run lint`: exit 0, no diagnostics. One preceding
  overlapping lint invocation ended exit 1 without diagnostic output; this was
  not called a pass. The separate repeat completed successfully.
- `node scripts/learning/http-check.mjs`: exit 0, **9/9** expected production-build
  authentication/unavailable statuses. Saved reports/learning-http-checks.json.
  Includes the corrected anonymous mentor 401, disabled email 404 and production
  preview 404s. No cookies, credentials, provider dispatch or payment was used.
- Temporary development and production inspection servers were stopped, browser
  viewport restored and temporary inspection tab closed. No deployment made.

## 2 October 2026 — roadmap gap audit and Claude handoff

This follow-up was documentation-only. No product source, database, migration,
entitlement, wallet balance, payment, content record or deployment was changed.
The existing user-owned development server was left running. The companion audit
`ROADMAP-GAP-AUDIT-2026-10-02.md` records the evidence; the copy-ready execution
contract is `CLAUDE-MASTER-HANDOVER.md`.

Confirmed current issues include the Arena app shell staying dark while the
marketing theme reports light, no Arena theme control, stale Fast lane and mixed
availability copy, inconsistent subject catalogs, PrepOS local planner/time
choices, and wallet degraded/fallback paths that can expose synthetic balances or
non-atomic direct consumption. These findings are release blockers or staging
work; they were not patched in this audit.

The Impeccable detector returned 95 heuristic advisories across Arena/dashboard/
PrepOS files (49 font-size, 28 color, 15 radius, plus grid/transition/easing).
They are retained as review leads in `reports/claude-handover-static-audit.json`,
not counted as confirmed defects. A read-only local browser check observed the
Arena computed dark shell under `data-theme="light"` and the 320px Today fallback.
No new mock, purchase, paid model call, migration or content generation occurred.

Next incomplete acceptance criterion remains the explicit staging schema and real
authenticated session/owner flow. The next Claude run must fix Arena/capability
truth and PrepOS wallet safety before enabling paid AI, then begin the authoritative
CUET syllabus registry and read-only question-bank audit. Existing prior test/build
numbers remain prior-run evidence and were not rerun in this documentation pass.
- `git diff --check` identified three trailing-space lines introduced while editing
  pricing; they were removed. Other existing user changes remain intact.

## Historical status — October 1 2026

This is a locally implemented foundation and redesigned recovery pilot journey,
NOT a completed production launch. No production migration, bank mutation, deploy,
paid content request, APK signing, store submission or real-device test was made.

| Milestone | Completion evidence | Remaining gate |
|---|---|---|
| Project brain | AGENTS, PRODUCT, DESIGN and brain specifications/architecture/quality/cost/benchmark/backlog | Keep updating actual results |
| Read-only inventory | 9,342 records; saved per-item report and 59-row quarantine dry run | Independent semantic checks, schema deployment before applying quarantine |
| Historical failure classification | Ten zero-candidate/zero-validator routes classified unknown | Request-level receipts needed to reconstruct old bills |
| Durable cost controls | Shared SQLite reservations, usage receipts, crash/concurrency/zero-yield/repair/cache tests | Verified prices, durable worker deployment; distributed ledger not implemented |
| Evidence publication | Signed hashes, source/family/version checks, blind solving, alternative challenges, route calibration; worker/offline importer integrated | Source registry/academic fixtures empty; source-backed model adapter configured but not executed; numerical family solvers not supplied |
| Practice/recovery backend | Server scoring, event replay, idempotency, ownership, credits, playbook/review queue, changed-evidence progress exclusion | Saved SQL needs staging/production setup; correction recomputation and fuller timing/review behavior pending |
| Web pilot UI | Immediate illustrative replay, separate pilot signup, observed/inferred results, four launch subjects; public reference notes | Remaining legacy screens, live authenticated content flow |
| Mobile beta source | Bundled React/Vite/Capacitor assets/fonts, OTP/bearer, native secure storage, cached reviews/drafts, reminders; Android project generated | Public environment config, signing, JDK/SDK, macOS/iOS, real-device QA and store review |

## Verification

- npm run test:recovery: 15 focused software regressions, including local Postgres
  transaction/owner/credit/idempotency/quarantine/passage rollback tests.
- Existing answer integrity, NTA selection, mock selection, payment/entitlement and
  offline batch suites: 52 tests. Academic fixture release remains unverified.
- Production web and mobile asset builds compile. Targeted edited React lint is clean.
- Production-mode HTTP checks reject unauthenticated/forged-token attempt, analytics,
  recovery, session and mobile reads/submissions with 401. The illustrative preview
  returns 404 in production. Saved results: artifacts/recovery/http-checks.json.
- Desktop/390px captures in artifacts/recovery; no horizontal overflow in inspected
  home/lab. Replay control is 44px. Public catalog references include >1,000 designs;
  no claim that 1,000 screens were individually inspected.
- Fresh Impeccable design review: initial disposition fix; all six material fixes
  resolved in one batch; final disposition ship. DESIGN and sidecar reconciled.

Artifacts are local evidence, not live app success. Lab screenshots contain clearly
labelled development-only illustrative data. Existing user edits/payment changes
were preserved. No independent academic accuracy or model-versus-human result exists.

## Next agent

Read brain README, BANK-AUDIT and BACKLOG. Verify live setup before claiming anything
deployed. Start with authenticated source/key extraction and development/held-out
fixtures; do not open paid generation on missing prices or empty references. Keep
the $2 calibration hold and $10 ceiling. Never reset the ledger or publish the old
Economics sample based on its heuristic grade. Follow BACKLOG in order.

## 2026-10-01 stabilisation and landing rebuild (Claude)

Done and verified locally (dev server, port 3100):
- Homepage was unstyled: ChatGPT's last pass shipped about 20 `cuet-*` classes with no CSS.
  `src/app/page.js` rebuilt on the existing `.mm` system plus `src/app/landing.css`
  (`.lp-*`): hero with playable five-question drill, subject keys, live stats band,
  Arena/Radar/Compass screens (static, labelled illustrative), steps, Score Recovery
  Lab replay, free vs Pro (₹99 once) comparison, FAQ, close. On phones the drill
  follows the lead directly; subject keys follow the drill.
- `/api/leaderboard` returned 500: `Database.getLeaderboard` put 512 user ids in one
  `.in()` filter (20 KB URL, HeadersOverflowError) and silently read only the first
  1000 of 1807 attempts. Now pages attempts and chunks user lookups by 100
  (`data/db.js`). Synthetic practice rivals remain labelled.
- `LiveStatsBand` fallback claimed "10,000+" questions; live bank is 6,963
  (`/api/stats`). Fallbacks are now "6,900+" and "40". Bank note reworded to
  "automated schema, duplicate and answer-key checks".
- `/login` and `/signup` still used legacy dark utility classes inside the paper
  world. Rebuilt with `AuthShell`, `auth.css` and a restyled `SignupCard` (auth
  logic unchanged: Google, email link, 8-digit OTP).
- Testimonials: no invented student quotes were added. `src/lib/voices.js` is an empty
  list; the landing section renders only when real, consented quotes are added.

Verification: `npm run lint` clean; `npm run build` passes, all routes; test:recovery
15/15, test:nta 22/22, test:answer-integrity 6/6, payment_entitlements 11/11.
Public routes and `/api/stats|subjects|leaderboard` return 200 locally; 390px and
1440px landing/auth captures show no horizontal overflow.

Not verified: any signed-in screen (dashboard, test, result, saved, profile, Compass,
PrepOS) was NOT visually checked this pass (no test credentials used); Quick Practice
submit/resume/idempotency from the handover; Razorpay checkout end to end; production.
Remaining legacy dark-style screens inside `(app)` still need the same audit.

## 2026-10-02 landing redesign round 2 (Claude)

Owner rejected the paper homepage as less polished than mockmob.in, prepium.in and
ug.preparoo.app. Rebuilt `/` as "Night Arena" (see DESIGN.md): layered grid/dot-matrix
backdrop with pointer-lit dots, hero stage (playable drill + Example chips), subject
marquee, live stats, wide/pair/wide/trio bento (Arena, Radar, PrepOS, Compass, three
small tiles), animated three-step section, Score Recovery Lab replay, live per-subject
counts, free vs Pro, FAQ, closing band. Restored FAQ + breadcrumb JSON-LD from the old page.

Root cause of the hover "shake": `DecodeWord` re-scrambled on hover and glyph widths
differ. Deleted; replaced by width-reserving `MorphWord`. Verified by measuring every
hero element's box before/after hovering the primary CTA: no movement (only the
decorative chips on their own loop). Drill height is constant before/after answering.

Verified in the browser at 320, 390, 820x1180, 1024x768, 1280x720, 1440x900,
3440x1440 and 844x390 landscape: no horizontal overflow at any size; hero balanced;
mobile nav works on dark. `npm run lint` clean; `npm run build` passes; test:recovery 15/15;
payment_entitlements 11/11.

Not verified: real-device performance on a budget Android (backdrop uses static CSS layers;
pointer layer is disabled on touch); reduced-motion behaviour was reviewed in CSS, not
exercised in a browser; Lighthouse not run; no screen-reader pass beyond the a11y tree.
`DynamicCompassPreview.jsx`, `ArenaPreview.jsx`, `RadarField.jsx` are now unused by `/`.

## 2026-10-02 free DU eligibility and cutoff calculator (Claude)

New public tool at `/cuet-cutoff-calculator` plus a landing-page teaser (`#du-eligibility`),
nav and footer links, a hero link, a Compass-tile link, a Radar-page link that pre-fills the
student's practised subjects, and a pointer from the Admission Compass page.

Data (all from four public DU documents, user-approved download of five PDFs, ~9.7 MB):
UG Bulletin of Information 2026-27, and the Round I, II, III minimum-allocation-score lists.
Pipeline in `scripts/du-csas/` (geometry-based PDF parsing, hard failure on ambiguity);
output is static JSON in `public/du/2026/` (no serverless function runs for the tool).

Verified:
- Cutoffs: S.NO contiguous (1,393 / 1,393 / 956), identical seat lists across Rounds I and II,
  Round III a subset, and the multiset of every parsed score equals the numbers printed in the
  PDFs: 17,316 cells (two whole-number cells in Round I located individually). One displayed
  value (Dyal Singh B.Com. (Hons.) Round I OBC-NCL 695.3) traced to the raw PDF coordinates.
- Eligibility: 73 Bulletin programmes, 149 combinations all parsed into typed slots, every
  combination satisfiable. Engine tested (`npm run test:du`, 12 tests) including language
  specific rules, GAT combinations, the "considered only if seats remain" combinations III/IV,
  and the UR-merit rule for reserved categories.
- `npm run lint` clean; `npm run build` passes (route prerendered static); test:recovery 15/15,
  test:nta 22/22, test:answer-integrity 6/6, payment_entitlements 11/11.
- Browser: desktop 1440/1024 and mobile 390 on the calculator and the landing teaser; no
  horizontal overflow; selection, URL sharing, expand-to-cutoffs, score status all exercised.

Also fixed: `html, body { overflow-x: hidden }` in globals.css made `<body>` a scroll container,
so `position: sticky` (including the site's own nav) never stuck. On marketing-system pages
(`.mm.lp`) it is now `overflow-x: clip`.

Not done / limits:
- Seat counts (Prepium shows them): the seat-matrix PDF is organised differently and was not
  parsed. Not shown rather than guessed.
- 5 Bulletin programmes (3 music, B.F.A., B.Sc. PE) have test-based merit and no CUET cutoff
  list; shown for eligibility only.
- 2026 data only. Add a 2025 cycle by adding a second dataset folder; the UI reads `meta`.
- No Lighthouse or real-device run. No screen-reader pass beyond the a11y tree and aria states.
- `src/lib/admissionCompass.js` (existing, untouched) still uses invented per-college "target"
  scores and category adjustments. It is clearly labelled as an estimate, but it should not be
  presented as cutoffs. The calculator is the source of real published numbers.

## 2026-10-02 calculator rework after owner feedback (Claude)

Owner reported the cutoff calculator "not updating live", no way to recheck, clunky UX, and that
subject mapping did not show that IP/Computer Science (and similar) are one CUET subject.

What I could and could not reproduce: scripted clicks always updated state, so I found no
single hard failure. I did demonstrate real defects that make live updates invisible or
unreliable for a person: a floating "N programmes unlocked" bar sat over the chip grid (scripted
`.click()` bypasses overlays, a finger does not), the results were far below a very long picker,
and the address bar was rewritten on every change. All three are removed.

Changes: two-pane layout from 1100px (sticky subjects pane, results beside it, live); below that a
sticky summary bar with the live count and Edit / View buttons; removable selected-subject tray;
full official subject names on chips plus a finder that maps aliases (IP, Informatics Practices,
Biotech, Book Keeping, Applied Maths...) to the one subject DU/NTA count; every programme card shows
the Bulletin's exact combinations with met / missing marks, and "Not eligible yet" rows open to the
same rules. The URL is read once on load and then cleaned; edits persist in localStorage; Share
builds the link on demand.

Accuracy check: B.Sc. (Hons.) Computer Science has two Bulletin combinations and BOTH require
Mathematics/Applied Mathematics, so a commerce student with only IP is not eligible. Tests added
(16 total in `npm run test:du`): that case, the Computer Science / IP equivalence, rule
explanations, alias search. Verified in the browser with a real click: adding Mathematics took
35 -> 41 programmes and made B.Sc. CS Honours and Economics Honours appear.

Note: Prepium lists Sanskrit under List B; the 2026 Bulletin's List B (22 subjects) does not,
so the tool follows the Bulletin. Lint, build, test:du 16/16, recovery 15/15, nta 22/22,
answer-integrity 6/6, payments 11/11. No real-device or screen-reader run.

## October 2, 2026 — homepage refinement and exam-interface comparison

Preserved the existing homepage and added a refined hero practice frame, persistent
animated light/dark switch, four original campus illustration cards, and an
interactive MockMob/NTA-style comparison. Premium NTA sessions now offer a
presentation switch on the same runner; the existing scoring, timing, entitlement
and credit logic is unchanged. College cards hand off a validated programme filter
to the existing DU calculator.

Verification: production build and ESLint pass; NTA 22/22, DU 16/16, recovery 15/15,
answer integrity 6/6, payment entitlements 11/11. Browser checks at desktop and
390px/320px confirm theme persistence, mobile menu, no horizontal document overflow,
preview answer/review/clear/reset state, and Commerce preset 35/73. Premium setup
link selects NTA Mode with 50 questions / 60 minutes without starting the mock.
New browser tab reported no console errors. Generated campus asset is 276 KB WebP.

No production deployment, migration, checkout or scored exam submission performed.
The real premium exam submission path with the classic skin remains a release check.
NTA style is a reference-based practice console, not a guarantee about the official
2027 UI. Source changes and their rollback boundary, reference survey, image prompt
and evidence are in HOMEPAGE-REFINEMENT-2026-10-02.md and artifacts/homepage/.

## October 2, 2026 (second pass) — repair, theme, Arena alignment (Claude)

Local source only. Nothing deployed, migrated, purchased or generated. Screenshots:
`artifacts/refinement-2026-10-02b/`.

Confirmed defects fixed (cause → fix):
- Radar/analytics was empty for every student: `/api/analytics` kept only `server_snapshot_v1`
  attempts (Score Recovery pilot, not launched) while practice writes `server_practice_v1`.
  Now counts the owner's practice; pre-server browser-scored attempts are included and labelled
  (owner decision). Recovery/progress evidence rules are unchanged. `data/attempt_scoring.js`.
- Submission could be rejected by clock skew: runner timed events as client `Date.now()` minus
  server `startedAt`; server rejects events later than its elapsed time + 2 s. Runner now times
  from receipt using only the server duration; `finishPractice` scores answers without the
  (discarded) event log if the log is malformed (`scorePracticeSubmission`). Answers still fully
  validated. Recovery-pilot `finishSession` is unchanged.
- Result page called every new practice attempt "historical… not scored from a server-held
  snapshot". Copy now distinguishes server-scored practice from older browser-scored attempts.
- Nav dropped Radar, Saved, Compass, PrepOS, Explore, Ranks, Contribute, My uploads (pages still
  existed; several are sold as Pro). Restored as a "Tools" group (owner decision). App tour pointed
  at nine missing nav targets; rewritten for the current nav.
- Light mode: subject-card hover was `#121712` behind `#172016` text (1.08:1); landing secondary
  button hover `#151a14` (1.05:1); dark mode on paper sub-pages: shared `.mm-btn--secondary:hover`
  was `#fff` behind near-white text (1.11:1); calculator/teaser lime, amber and pink text on paper
  (1.2–2:1). Cause: night-only literals in `landing.css`/`du.css`/`globals.css`. Fixed with theme
  roles (`--accent-text`, `--accent-line`, `--accent-wash`, `--tint`, `--surface-hover`,
  `--warn/bad/good-text`) defined per theme in `marketing-theme.css`; per-selector light patches removed.
- 900–1023 px: marketing nav labels wrapped onto two lines after the toggle was added. Text links
  now move into the menu below 1024 px; CTA and Log in stay. NTA-style "Mark for Review & Next" and
  "Clear response" were hidden at 761–1023 px; now visible below 1024 px.

Refinements: theme switch redesigned (sun/moon thumb, inset-shadow crescent, stars, spring travel,
press squash, circular View Transition reveal from the switch; instant under reduced motion or
without support). Hero practice bay restored (framed bay, lit slate card, deep shadow, skeleton
explanation) plus a two-card stack; status row and purpose rail kept. Campus cards pair as
landscape cards at 761–1023 px. Arena: scoped `src/app/(app)/arena.css` re-skins shell, dashboard,
shared app primitives and the branded runner; NTA-style console untouched apart from the
breakpoint fix. Dashboard copy and numbered setup steps; no logic change.

Verified locally:
- Tests: recovery 17/17 (2 new), NTA 22/22, DU 16/16, answer integrity 6/6, payments 11/11,
  mock selector + practice filtering + offline batch (pure) 13/13. Paid-model pipeline tests not run.
- `npm run lint` clean; `npm run build` passes. Production server: `/preview/arena` and
  `/preview/recovery` 404; unauthenticated `/api/analytics`, `/api/attempts`, PATCH `/api/sessions` 401.
- Browser: computed-state contrast audit of every hover/focus/pressed/selected/disabled rule on
  `/`, `/pricing`, `/cuet-cutoff-calculator`, `/login`, `/about`, `/cuet-2027`, `/features` in both
  themes; light homepage clean; calculator text (542 nodes) passes in light with results open.
  Real-pointer hovers checked in both themes. Toggle: click, Space, Enter, focus ring, aria-checked,
  persistence, reveal animation from the switch. No document overflow at 15 widths 320–1440.
  Drill answer causes no layout shift (stage 718 px before and after).
- Arena via `/preview/arena` (development-only, mock user, stubbed account APIs, no production
  writes): dashboard subject/mode/count selection, 50-credit gate disabled with top-up hint, launch
  URL; branded runner answer, mark, clear, navigate, submit; captured payload scored by the real
  `scorePracticeSubmission`; NTA-style console at 1366 and 900 px; mobile menu at 375 px.

Not verified / release checks:
- A real signed-in Quick Practice (start → submit → result → Radar) was approved by the owner but
  not run: the browser pane had no session and credentials cannot be entered for the owner.
- Live premium NTA submission with either interface; Razorpay checkout; production deploy.
- Reduced-motion paths reviewed in code, not emulated. No real-device, Lighthouse or screen-reader run.
- `/api/bookmarks` hides saved questions that fail the current quality gate, but the free-tier
  25-save limit still counts them (not changed).
- Other app pages (Compass, Radar, Saved, Profile…) inherit the re-skinned primitives but their
  page-specific layouts were not redesigned.

## 3 October 2026 — Round 4: restored craft, Pip guide, motion system, study loop (Claude)

Local source only. Nothing deployed, migrated, purchased, generated or sent. Full record:
`docs/brain/ROUND4-NOTES.md`; motion rules: `docs/brain/MOTION.md`; brief:
`scrollcraft/builds/mockmob-round4/BRIEF.md`; evidence: `artifacts/round4/`.

- Regressions fixed at their measured causes: comparator palette (44px min-width in 1fr tracks,
  5-column phone override with span-2 holes, lost NTA placeholder skin, clipped focus rings);
  Arena entry and exam-day card (round-3 blanket overrides; containers now fade, leaves rise, so the
  fixed phone dock is never re-anchored); exam-day clock now really counts down, offscreen-paused.
- Pip: one guide that hands off between five perches and reacts to page events (drill answer, Mistake
  Lab next move, exam preview answers). Chosen over two other built prototypes (archived). Static
  perches remain the no-JS/reduced-motion experience. No mascot motion in the timed runner.
- Study loop: Result ends with one next step from the PrepOS insights engine (no chapter named
  below its 4-answer ranking rule), plus Review, Saved, Radar, Back to Practice. Saved links back to
  Practice.
- Sweep: 760 loads (38 routes × 10 sizes × 2 themes): root overflow 0, console errors 0. Found and
  fixed a Practice panel cut off from 320–1440px (grid `auto` tracks) and six sub-44px controls.
- Verified: `npm run lint` clean; `npm run build` passes; recovery 17, DU 19, learning 74, NTA 22,
  answer-integrity 6, payments 12, Explore/contribution 8 = 158/158 pass (logs in
  `artifacts/round4/logs`). Reduced motion, 200% text, real-touch flows, light theme and contrast on
  new surfaces checked in Chrome. Lab perf (prod build, 390px, 4× CPU, Slow 4G): LCP 2.9–3.3s, CLS 0.
- Not verified / release checks: physical phones, screen reader, authenticated persistence and
  resume, live premium NTA submission, payments; LCP above target with cause not isolated.

## 3 October 2026 — Round 5: continuous Pip journey and Arena handover

Local implementation. Full evidence and limits: `docs/brain/ROUND5-NOTES.md`; scoped future
work: `docs/brain/ROUND5-NEXT-FEATURES.md`; artifacts: `artifacts/round5/`.

- Seven ordered perches with hysteresis replace the narrow observer band. One desktop actor
  carries through a reserved gutter; phone motion stays local and follows document scrolling.
  Reverse/fast crossings coalesce. Larger original art, pose fades and static reduced motion.
- Lab celebration waits for the visible next-move control and settled visible Pip. One peak
  per view. Today, Practice, Review and Saved gain calm companion states; recorded-session
  acknowledgment uses server data. PrepOS keeps its orb, voice and capability/credit wall.
- Three travel/PrepOS studies archived; temporary Round 5 route removed. One requested image
  concept generated; original six pose assets remain in product. Exact GPT Image 2.5 selection
  is unavailable through the tool, so no such model-version claim is made.
- Lint and production build pass. Recovery/DU/learning/NTA/answer-integrity/payment/Explore
  suites: 158 passed, plus two station-selection tests. 760 verified layout loads: 380 public
  production + 380 development fixtures; zero root overflow, pageerrors or failed loads.
  Reduced motion, quarter-interval reverse journeys and six 200%-text fixture views checked.
- Hero-animation ablation reproduced lower text LCP (phone 1.60–1.94s versus guide baseline
  2.27–3.64s). Removed only the measured lead paragraph's entrance animation; other entrances
  remain. Final production measurements and methodological limits are in ROUND5-NOTES.md.
- No deployment, production migration, bank writes, paid-content generation, outgoing email
  or checkout. Live authenticated persistence/resume, premium NTA submission, payments,
  physical devices and screen-reader acceptance remain release gates. Fixture counts and
  laboratory performance are not live account evidence or field Core Web Vitals.

## 3 October 2026 — owner-approved Round 5 follow-up and local-server recovery

Local implementation; full source map, evidence and limits: `docs/brain/ROUND5-COMPLETION.md`.
The owner subsequently approved implementing the remaining plan and restoring the site.

- Tonight's plan now uses the shared server plan and ties its recorded state to a current-day
  server-scored attempt. First-session/fresh-check milestones use real validated records.
  Thirty minutes includes ten minutes of review, which is not automatically marked done.
- Result offers evidence-gated, unseen-family five-question replay only when inventory permits;
  ownership/rate limits and launch checks remain authoritative. No generation or bank writes.
- Install/PWA support caches only three public fallback assets. Open-runner drafts preserve
  session identity, answers and deadline. Network submission freezes answers and supports
  bounded reconnect/reload without a new timer, debit or local score. Logout purges own drafts.
- Monthly cancellation now uses the installed Razorpay SDK's boolean argument and confirms
  rejected requests only through a matching terminal provider state. No provider operation ran;
  monthly activation remains gated because the plan ID is absent. One-time Pro access remains.
- Local dev restored at `http://localhost:3010/` with separate `.next-dev` output and disabled
  Turbopack development filesystem cache. The phone-blocking Next dev indicator is disabled.
  No reset/cache deletion/bulk revert. Earlier worker/cache/chunk failure logs are retained.
- Final build and lint passed; 172 automated tests passed, including question/payment/recovery
  contracts. 760 route/size/theme loads passed. New feature suite: 43 checks passed. Acceptance:
  37 forward/reverse wheel, clipped control/focus clearance, reduced-motion, 200%-text and iOS
  help checks passed. Rebuilt homepage: 20 size/theme checks passed; production PWA check passed.
  A concurrent autoplay timing run paused and failed; unchanged sequential rerun passed, both
  retained. Fixtures, browser touch and device emulation are not live persistence/hardware proof.
- Existing signed-in browser session inspected read-only: Today 20-minute plan → Practice setup,
  fixed-expiry Account, existing legacy Result and Review. No new attempt, score or debit.
  Opera/native-app access was unavailable; Gmail/OTP access was unnecessary and not performed.
- Remaining release gates: authenticated staging submission/resume and premium NTA with both
  skins, configured monthly plan plus sandbox billing/webhook evidence, physical Android/iPhone
  and screen reader. No deploy, migration, paid content generation, checkout or external message.

## 3 October 2026 — Pip intent and PrepOS refinement (Round 6)

Owner asked to preserve the good motion, make mascot actions contextual, reduce generic hero
details, strengthen PrepOS with its existing API/wallet and prepare next steps. Full handoff and
paste-ready Claude prompt: `CLAUDE-PIP-PREPOS-HANDOFF-2026-10-03.md`.

- Added one GPT-generated attentive pose with open eyes and relaxed arms. Removed sleep/wink
  defaults from scroll reading, pricing, comparison, Arena setup and loading. Original art stays.
- Pip points inward, including its static reduced-motion fallback. Single-face 140 ms entry
  replaces the overlapping-visors dissolve. Small scroll corrections retain the expression.
  Correct sample answers keep their hop; wrong answers receive an attentive nod. Keyboard
  answers trigger no mascot reaction. The Lab peak and mascot-free timed answering remain.
- Hero now states one fixed practice promise and leads with the actual five-question sample.
  PrepOS connects its next step with the record observation and an inspect/ask handoff.
- PrepOS Ask explicitly separates free record facts from optional one-credit model guidance.
  Source labels, receipts, wallet refresh, unknown-balance handling and same-ID retry are visible.
  Unresolved requests/conversations survive PrepOS section changes; late history cannot replace
  a new conversation. Effective paid expiry is recomputed using the shared entitlement rule.
  Explicit free requests cannot fall through to a paid model; new saved replies carry their source.
- Final build and lint passed. **172 existing automated tests passed** across recovery, question,
  payment, wallet, reservation, model lifecycle and other contracts. A final focused PrepOS rerun
  also passed all 26 tests. **147 browser report entries passed** at four widths and both themes:
  forward/reverse stations, inward pointing, one face, reduced motion, free/paid/unknown wallet
  states, lost-after-commit idempotent retry, keyboard/mouse reactions, wheel reversal and quiet
  companions with doubled root font size. Browser AI responses are labelled fixtures, not live
  model calls. Evidence and earlier failed test assumptions are retained in `artifacts/round6/`.
- Read-only configured Supabase check: wallet, ledger, reservation, runtime request and price
  tables answered. Funding table unavailable through the Data API (`PGRST205`); configured
  model prices not verified; available funding not established. Paid AI remains release-gated.
  Table readability does not establish RPC correctness or applied migration history. No migration
  was executed and no model/credit/budget call was made during this check.
- Public live PrepOS still shows its earlier public-guide/missions interface. That observation
  does not establish deployment of this checkout's guarded contracts. No outgoing email, paid
  educational generation, attempt/score fabrication, checkout or deploy. Port 3010 dev is left
  running; the temporary port 3011 production verification server is stopped.
- Next gates: resolve funding-table availability, verify actual schema/RPCs against saved SQL
  without blindly reapplying migrations, establish authorized runtime funding/current prices,
  reconcile wallets and run real staging concurrency/retry/release. Then consider activation.
  Durable client retry after reload/drawer closure, physical phones, screen reader and prior
  authenticated staging/payment acceptance remain unverified. This refinement preserves the
  retry ID across section changes only; it does not claim paid-request reload recovery.

## 5 October 2026 — Luna-only routing, shorter mobile home, light default, AI purchases

Source changes (not yet deployed; deploy needs `AI_LUNA_MODEL` optional and the Razorpay env below):
- **Model routing:** `src/services/ai/providers.js` now runs GPT-6 Luna only. `fast` tier = no reasoning, `smart` tier =
  low effort; callers that solve/generate questions pass `reasoningEffort` explicitly (medium+). Fallback is Luna, no
  reasoning. Question moderation (`src/lib/moderation/ai.js`) moved from a direct Claude call to the budget-guarded
  router, Luna at medium effort. `AI_FAST_MODEL`/`AI_SMART_MODEL`/`AI_FALLBACK_*` no longer route anywhere.
- **Homepage:** removed Subjects, Marquee, How-it-works, Proof band, mini tiles, Compass Pro box, college destinations;
  Instagram moved up under the statement; stats are now combined followers, reel views (owner-stated 100K+ floor,
  `REEL_VIEWS_FLOOR`) and recorded likes+comments. Product screens hidden under 700px. Mobile page 20.2k → 15.1k px.
- **Theme:** light is the default (`layout.js`); first-visit hint on the switch (`ThemeToggle hint`), shown once.
- **Payments:** `RELEASE_GATES.aiCommerce = true` (owner, 5 Oct); PrepOS top-up packs (₹10/50, ₹20/150, ₹50/400) now sell
  on `/pricing`. Monthly Pro ₹99 opens when `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is set; create it with
  `scripts/payments/create-razorpay-plan.mjs`. Pro keeps 50 PrepOS credits/month, Free 10.
- Verification: `test:learning` 80/80, `test:recovery` 35/35, payment + landing tests 16/16; browser checks on 375px.
- **Unresolved gates:** Razorpay keys + plan ID + webhook secret are empty in `.env.local`; no real captured top-up or
  subscription charge has been verified; Vercel env not updated.

### 5 October 2026 (later) — landing page restructure, feature tour
- Reverted the over-trimmed homepage: Compass Pro box, college destinations, stats band restored. Removed only the Subjects
  block (owner), the subject marquee and the three-step "how it works". Instagram stays where Subjects was.
- New `FeatureTour` (`src/components/landing/FeatureTour.jsx`, `src/app/feature-tour.css`): eight tools, one idea per slide,
  swipe on phones (scroll-snap), list + stage on desktop, autoplay with pause, only while on screen. Replaces the bento.
  Slides accept `video: '/demos/<id>.mp4'`; no recordings exist yet, so the animated screens play.
- Phone polish: glass header with progressive blur, floating glass dock, blur-in reveals (`.lp .rv`, reduced-motion safe).
- Reference studied: ug.preparoo.app (Webflow + GSAP; 7.1k px on mobile; one feature carousel, product mocks, sticky CTA).
- Tour v2 (same day): desktop is tool pills + a split stage (copy left, screen right); phones get equal-height cropped glass cards.
  Copy rewritten; Rival slide now says what it is (a fixed accuracy-and-pace target, not other students).
  `LiveStatsBand` drops a figure that fails to load instead of printing "Unavailable". Cause of the "unavailable" the owner saw:
  the preview dev server lacked `--use-system-ca` (TLS to Supabase failed); `.claude/launch.json` now uses it. Production unaffected.
- Tour v3 (same day): slides now use `TourScreens.jsx` + `tour-screens.css`, compact demo screens that play a scripted
  sequence each time their slide becomes active while the tour is on screen (timer ticks, options tapped, rows arriving,
  typing, bars filling), then hold the finished state; reduced motion shows the finished state. Nothing is cropped on phones.
  Verified frame by frame in a foreground Chrome (chrome-devtools) at 390x844 mobile and 1440x900: all 8 demos play and settle.
  Note: the desktop app's Browser pane throttles timers when hidden, so it is not reliable for checking motion.

## 4 October 2026 — UI/UX audit (audit-session date)

- Documentation-only audit saved to `docs/brain/UI-UX-AUDIT-2026-10-04.md`; raw evidence and screenshots in
  `artifacts/ui-ux-audit-2026-10-04/`. Independent visual and implementation reviewers completed before synthesis.
- Design health 26/40; technical health 14/20. Ten accepted groups: P0 0, P1 1, P2 8, P3 1. Highest priority:
  illustrative key agreement must not imply official correctness or explanation safety. Other priorities:
  phone journey/feature repetition, result mascot overlap and split percentage, touch/keyboard semantics.
- Homepage checked at widths 320/360/390/430/768/1024/1440/1920; all observed MockMob global widths fit.
  Public pages, 15 student fixture views, both themes, live home/signup and three live competitors sampled.
  Initial profile/test loading frames are not full-state verification. Incorrectly labelled initial desktop rows
  are retained as provenance and excluded; corrected 1440 measurements are the desktop evidence.
- Sampled answer feedback/focus, menu Escape, tour ArrowRight, timed palette, malformed email without sending,
  and long-name/empty/error fixtures. Contrast sampling had no eligible content-text failures within its limited
  coverage; gradients/animation and other unsupported cases were skipped. No whole-site WCAG certification.
- Detector ran once: 137 raw alerts, largely contextual advisories; no bulk theme/runner normalization warranted.
  Current aiCommerce=true supersedes the older closed-top-up assessment; target-size equivalent-control exception
  prevents declaring a definitive WCAG failure from dots alone. Both reconciliations are explicit in the report.
- No UI code changes, tests/builds, paid model calls, real attempts, migrations, auth completion, emails, payments or
  deploys performed. Existing dirty tree/dev server preserved. Audit tabs and temporary viewport overrides cleaned up.
- Open gates: real phone keyboards/safe areas, screen reader, 200% text zoom, full hover/focus/reduced-motion matrix,
  background interruption and budget-device/slow-network performance; authenticated persistence/payments/AI receipts.
  Live landing differs from local; this audit does not establish deployment of the new feature tour or configured AI.

### 4 October 2026 — owner-selected UI/UX implementation plan

- Saved `UI-UX-IMPLEMENTATION-PLAN-2026-10-04.md` and linked it from the brain README/audit.
  Owner retains official-key trust wording; wording-first audit priority is superseded for this sprint.
- Order: reproducible baseline → phone performance/composition → accessibility → student/error states
  → activation flow → final measurement and release evidence. Cosmetic detector cleanup, unused demos,
  arbitrary competitor page-height targets and blanket motion/feature removal are excluded/deferred.
- Current source review found held/not-explained repair outcomes enter the Result `repaired` set, which
  drives a Repaired badge. Plan requires fixture reproduction and separate handled/outcome states;
  no runtime reproduction or fix is claimed in this planning pass.
- Planning only: no UI edits, performance runs, tests, paid calls, migration or deployment performed.
  Performance acceptance separates controlled production-build traces from real-user Core Web Vitals.

### 4 October 2026 — UI/UX plan implementation

- Implemented phone hero/sample composition; tour carousel controls, inert slides, focus/manual pause,
  bounded pausable demo timelines, hidden/offscreen gating and 44px controls; official-key wording retained.
- Practice setup now precedes supplementary commentary/statistics and no longer waits for optional panel
  reads. Pending/unavailable counts are explicit; matching/expiry/idempotent server quote guards remain.
  Scoped load retry retains choices; phone summary exposes subject, mode, count, time, marking and cost.
- Result mascot height/entrance and metric units fixed; distinct explanation/held/unexplained outcomes,
  handled queue vs explanation progress, retained visited answer state across collapse/filter, and safe
  same-ID retry/in-progress/released handling. No scoring, wallet, model, budget or entitlement changes.
- DU category arrows/Home/End and clear focus fixed; editable phone/tablet fields 16px; key targets 44px;
  transform progress bars; one main in timed runner and PrepOS.
- Baseline/final production builds and final lint passed; 179 tests passed (35 recovery, 80 learning,
  59 payment/question/NTA/DU, 5 new UI state tests). Final key-route light 320/390/768/1440 and dark
  320/390/1440 matrices have zero horizontal overflow and no result mascot/metric overlap.
  Fixtures cover distinct repair outcomes, pending/error states and retained held panels. Browser
  checked DU keyboard, menu Escape focus return, sample feedback, tour freeze and one-main wrappers.
- Local production preview on 3020 checked public home, themes and sample; existing authenticated
  setup was read-only. Signup redirected to setup, so current-run native email validation is unverified.
  No new real session/paid repair/payment/signup completion, data migration or deploy performed.
- Several local inventory reads took 7.5-11s and had blocked setup; dependency removed and tested with
  never-resolving-statistics fixture. No device speedup, Core Web Vitals or field gains claimed.
- Full evidence/open gates: UI-UX-IMPLEMENTATION-RESULTS-2026-10-04.md and
  artifacts/ui-ux-implementation-2026-10-04/. Physical phone, screen reader, actual 200% zoom,
  reduced-motion browser/full contrast matrix, controlled throttled traces/field CWV, real transaction
  receipts and production deployment remain open. Measurements cannot be replaced with screenshots.
- Existing checkout changes retained. Diff check only reported the pre-existing ProductScreens.jsx EOF
  blank line. Do not bulk-reset/revert these files; review the scoped implementation hunks.

### 4 October 2026 — authorized UI production release preflight

- Owner requested publication of the UI changes. The staged release includes the reviewed landing/tour,
  mobile/accessibility, dashboard, result/repair presentation and DU refinements with their source dependencies.
- Existing AI-routing/moderation, aiCommerce enablement, pricing, payment scripts and corresponding
  backend-test edits are excluded and retained locally. This release does not activate new commerce,
  change model routing, migrate data or call a paid model.
- Exact staged source tree `7cfe2abf1d958767fb32f5bcd270560900cddd58` was exported independently:
  production build and lint passed, with 179/179 recovery/learning/payment/question/NTA/DU/UI-state tests.
  Evidence: `artifacts/ui-ux-release-2026-10-04/`. Shared dependency junction was rejected by Turbopack;
  the successful build used a real dependency copy. No application workaround was introduced.
- Push/Vercel readiness and live-domain/mobile/desktop smoke are pending at this preflight entry.
  Hardware, screen-reader, measured throttled performance/CWV and real transaction gates remain open.

### 4 October 2026 — UI release live verification

- Pushed `f70e385909ff454f10bf83e60d96a6883bb31c17` to `origin/main`. `Vercel – mockmob`
  reached success at `2026-10-04T12:50:34Z`; deployment:
  https://vercel.com/atishay07s-projects/mockmob/6VA6xyZTYuXB87urHXQLAgeusbAx.
- `https://www.mockmob.in/` serves the new tour, short hero lead and sample CTA with HTTP 200.
  Apex redirects once (307) to www, then 200. Calculator returns 200; no redirect loop.
- Live home light/dark checks at 320/390/1440px: no horizontal overflow, one main.
  Sample CANDID/Frank feedback works; selecting Mistake Repair pauses the tour with one active,
  seven inert slides and 44x44px controls. Live calculator at 390px: category ArrowRight selects
  and focuses OBC-NCL with one tab stop; clear empties search, restores focus, and input is 16px.
  No captured browser error logs in this smoke. Phone and desktop screenshots saved.
- Evidence: `artifacts/ui-ux-release-2026-10-04/{github-status.json,live-http.json,live-ui.json}`
  and build/test/lint logs. This post-deployment receipt is a local status update; deployed source
  and preflight documentation are in the release commit above.
- Existing unrelated AI/commerce/payment edits remain local. No production migration, paid model
  call, real attempt, purchase or signup completion was performed. Physical devices, screen reader,
  actual zoom, controlled performance/field CWV and real accounting receipts remain unresolved.

### 4 October 2026 — guided tour follow-up

- Owner rejected the phone dropdown and easily interrupted/slow feature playback after the UI
  publication. Rebuilt the tour as an automatic 4.8-second chapter sequence with shared progress,
  explicit Pause, a chapter strip and an Up next nudge. Normal vertical browsing no longer turns
  rotation off. Pointer navigation resumes its cycle; horizontal input holds briefly while settling.
- Preserved keyboard reading holds, explicit resume, reduced motion, inactive-slide isolation and
  hidden/offscreen suspension. Phone product panels fit without overhang; the sample dock steps
  aside during the tour. Nearby Mistake Lab stages also use 4.8 seconds. Official-key copy retained.
- Final isolated application source build and lint passed; nine relevant tests passed. Both-theme
  320/390/768/1024/1440 matrices have zero root overflow, no screen overhang and 44px controls.
  Browser observed auto progression/loopback, scrolling/navigation without sticky pause, explicit
  pause, and keyboard hold/resume. No measured wall-clock/FPS/device performance claim.
- See `TOUR-REFINEMENT-2026-10-04.md` and `artifacts/tour-refinement-2026-10-04/` for details.
  Production readiness/live smoke pending at this entry. Physical phones, screen reader and CWV
  gates remain open. Unrelated AI/commerce/payment edits retained locally; no migration/paid call.

### 4 October 2026 — connected preparation suite verified for rollout

- Implemented shared Today sequence, Learn, server-scheduled Recall, durable versioned runs/events,
  separate study progress, selected subjects/time, Pro weekly plans and custom mixed recall.
  Mobile Today/Practice/Learn/Review retains the other destinations through More. Active sessions
  and due checks replace their plan blocks; a persistent full-mock shortcut retains the existing
  quote/eligibility/credit path. Teaching/card exposure excludes those families from fresh checks.
- Owner explicitly authorized current Supabase project `isrxrxzjocewrdureyhp` with existing data.
  Saved migrations and isolated dry runs preceded SQL-editor application of score-recovery,
  connected-learning and study foundations; the published-version backlog follow-up also applied.
  The original transaction verified existing questions/attempts/credits/entitlements/credit receipts
  unchanged. Current service-role retry/scheduling/stale-revision smoke passed and rolled back all
  verification writes. CLI migration history remains unreconciled; do not blindly reapply pending SQL.
- Published two units and 23 cards: English twenty-word deck and sacrificing/gaining ratios.
  Canonical hashes and anonymous table denial verified against the current project. WordNet license
  preserved; NCERT formula/source reconciliation and exact arithmetic passed. This does not release
  formal recovery pathways or certify academic calibration, exam fit, mastery or score gains.
  Remaining four-subject coverage is visibly pending; offline packs and curriculum expansion remain.
- Clean isolated release excludes owner's unfinished pricing/provider/AI-evaluation/payment-script/
  landing edits. Lint and production build passed. 166 distinct tests passed: recovery 35, learning
  80, answer integrity 6, NTA 22, payment entitlements 12, study 11. Final plan changes passed study
  tests again; final mock/lesson links passed targeted lint and production rebuild. Complete local
  four-migration/import/retry/runtime dry run passed. Authenticated browser saved/resumed/completed
  the English lesson, persisted/reloaded a recall rating and saved/restored time preferences.
- No paid model calls. Existing Free/Pro prices, entitlements, atomic credit RPCs and AI allowances/
  persistent $50 generation and $25 monthly runtime guards unchanged. Only three independent study
  flags were saved as true in production on the domain-verified Vercel `mockmob` project.
  Publication/live verification pending at this entry; local build is not proof of deployment.
- See `STUDY-SUITE-2026-10-04.md` and local `artifacts/study-suite/` receipts. Real Android/keyboard,
  screen reader, actual 200% text/zoom/reduced-motion settings, field CWV and delayed unseen-question
  outcomes remain unverified. Rollback disables study flags and retains learning records.

### 4 October 2026 — preparation suite published

- Commit `a6a61cc276d9df36b43e4760c08df0dfe83802a3` is on `origin/main`.
  Domain-verified Vercel project `mockmob` deployment is Ready:
  https://vercel.com/atishay07s-projects/mockmob/FeimHt2rAGpA3qG4Eepoqfa43PNJ.
  Vercel showed 49 seconds and 23:21:17 IST on 4 October. Production flags are enabled.
- Live HTTP smoke passed: apex 307 once to www then 200; www and Learn 200; anonymous
  study catalog 401; dev-only study preview 404. Public Learn redirects signed-out users
  through existing authentication. Live signed-in browser check awaits owner Google sign-in;
  the Google chooser shows the existing account signed out. No credential was generated,
  transferred from localhost or changed to bypass login.
- Authenticated current-project readback passed: English lesson complete, recall cursor one
  after the first card, answer hidden on the next card, one persisted FSRS review whose due
  date matches the run receipt, and original twenty-minute preference restored. Actual
  owner QA records remain resumable; they are not student outcome evidence.
- Final authenticated release library and recall checks across 320/390/768/1024/1440 plus
  short landscape showed zero root overflow and no study buttons/links below 44px. Dark
  phone library also had no overflow. Full-mock shortcut selected the existing Full Mock
  and displayed its access quote without starting or charging a practice session.
- Evidence: `artifacts/study-suite/{production-release-receipt.json,production-deployed.png,
  live-http.json,authenticated-study-receipt.json,responsive-release-library.json,
  responsive-release-recall.json,phone-library-dark.png}`. This post-release receipt remains
  local; application source and pre-release verification status are already published.
- Original dirty checkout and unrelated owner edits remain intact; release checkout/branch is
  `artifacts/study-suite/release` / `codex/connected-study-suite`. Original local main still
  points at its prior commit; reconcile intentionally before later publishing owner edits.
  Full curriculum/offline packs, formal calibration, CLI migration-history reconciliation,
  physical-device/assistive-technology/200%-zoom and field performance/outcome gates remain open.


### 4 October 2026 — signed-in preparation-suite production smoke passed

- Owner completed normal Google sign-in. Live library rendered both English and Accountancy
  units, existing Pro access, the completed lesson and recall progress. The existing recall run
  resumed at card two. A live reveal was saved and survived page reload; its answer, optional
  pronunciation, linked lesson and four rating controls rendered correctly. No scored session,
  practice-credit charge, purchased-entitlement change or paid AI call was made.
- Actual live library viewport checks passed at 320/390/768/1024/1440 and short landscape.
  Revealed recall passed at 320/390/1440 and short landscape. Each measurement asserted actual
  width/height, zero root overflow and no study buttons/links below 44px. No error logs were
  captured in the final live test tab. Earlier viewport results that targeted the build-queue
  tab were discarded and replaced with these measurements; they are not release evidence.
- Evidence: `live-responsive-library.json`, `live-responsive-recall.json`, `live-phone-library.png`,
  `live-phone-recall.png` and updated `production-release-receipt.json` in `artifacts/study-suite/`.
  Physical-device, assistive-technology, actual zoom/reduced-motion, field performance and
  curriculum/calibration/offline/history-reconciliation gates listed above remain open.


- Final signed-in live Today showed the same resumable study run, twenty-minute preference and
  the 4/6/10-minute sequence plus full-mock shortcut. Temporary viewport overrides were reset.


### 5 October 2026 — Learn rebuilt as one connected loop; content v2 across four subjects

Owner feedback: "Even I cannot understand what Learn actually does." Diagnosis from the live/local walk-through:
Learn opened on "Start recall" before anything was taught; the English "lesson" taught the recall method and no
words; cards were bare dictionary definitions; lesson completion did not lead to recall or practice; starting a
second lesson silently resumed the first (the database resumes any active run of the same mode).

What changed (branch `codex/connected-study-suite`, on top of a6a61cc):
- One loop per concept, stated everywhere: **Learn (5–7 min) → Lock it in (2–3 min recall) → Apply (chapter
  practice with marks)**. Learn home gives one next action (continue / due review / recommended lesson, subjects
  rotated by fewest lessons read or by recent practice mistakes), then subject → chapter → concept with status,
  "practice available, lessons later" for untaught chapters, study record and mock shortcut.
- Lesson overview: objectives ("You'll be able to"), "How CUET asks this", three-step status, contents, sources.
- Lessons: idea, formula, method, worked example tables, common-mistake callouts, word sets with WordNet examples,
  numbered practice passages; quick checks with per-option "why that is wrong" feedback. Completion screen offers
  Lock it in (that lesson's cards), then Practise <chapter> (`/dashboard?subject&chapter&mode=quick&count=10`).
- Recall: one card = one memory with rotating task variants (meaning in context, gap fill/spelling, synonym or
  opposite; numeric/ratio calculations; scenario classification). Answers checked exactly (equivalent fractions,
  ratios in lowest terms, ₹/commas, British/US spelling from the source). After each card: when it returns.
  Summary lists remembered/forgot with next review, reread links and the Apply step.
- Server: `set_aside` transition closes an older active session (history kept, nothing introduced) when a
  different lesson or focused recall starts; same request resumes. Per-unit memory status, lock-in availability,
  explicit `DAILY_NEW_LIMIT_REACHED` / `NOTHING_DUE`. Unchanged: 5 new cards per IST day, >20 overdue pauses new
  cards, FSRS 5.4.2 defaults at 0.90, append-only events, revision checks, DB-enforced daily limit, RLS/grants.
- Today steps carry purpose, minutes and what "done" means; practice step links the recommended chapter.
  Result page Repair step links every mistaken chapter that has a lesson (count + minutes). Review/Progress
  study card reworded. Homepage tour gains a flag-gated Learn slide; its counts come from `release.json`.

Content v2 (released 14 units / 65 cards / 179 task variants; zero paid model calls):
| Subject | Units | Chapters with lessons |
| --- | --- | --- |
| English | 6 vocabulary sets (30 WordNet words; 10 new) + main idea + stated/inferred | Vocabulary, Factual Passage, Narrative Passage (3 of 7) |
| Accountancy | sacrificing/gaining ratios (v2), revaluation | Change in Profit Sharing Ratio, Admission of Partner (2 of 16) |
| Business Studies | delegation/decentralisation, planning/controlling | Organising, Controlling (2 of 13) |
| Economics | what GDP counts (final goods, value added, GVA/NVA, non-monetary), nominal/real/deflator | National Income & Related Aggregates (1 of 18) |
All eight concept blueprints now have teaching units. This is **not** full syllabus coverage and does not release
formal recovery pathways or assessment families.

Validation (`scripts/learning/validate-study-content.mjs --write --strict`): every number recomputed
independently; WordNet meanings/examples/synonyms/antonyms re-derived from hashed source lines (licence kept);
NCERT reconciliation phrases found on cited PDF pages (leac102 p.3,5,6,30,31; leac103 p.3; leec102 p.3,10,21,23;
lebs105 p.20,26; lebs108 p.5,6,8; PDFs downloaded with owner approval, sha256 in registry, git-ignored);
original reading passages checked for evidence/not-stated/key structure; family IDs disjoint from recovery
pathways. Tamper tests prove changed arithmetic, definitions, relations, reading keys and answer keys quarantine.

Production data (owner-authorised project isrxrxzjocewrdureyhp): phase 1 insert-only applied 5 Oct via
`scripts/learning/apply-study-content-v2.mjs insert` after the PGlite dry run
(`artifacts/study-suite/content-v2-import-dry-run-report.json`: idempotent, invisible to old code, changed
same-version content refused, supersede quarantines not deletes, stale run invalidated with event, unrelated
data unchanged). Receipt: 14/14 units, 65/65 cards present and hash-matched. Phase 2 (`supersede`, retires
english-vocabulary-01@1 and accountancy-sacrificing-gaining@1) runs only after the v2 deploy is live.

Verification (local, release checkout): tests recovery 35, learning 80, study 19, answer-integrity 6, NTA 22,
payment entitlements 12, landing/UI 9 — all pass; full lint clean; production build passes. Fixture walk-through
(dev-only `/preview/study`, real engine and scheduler) and **owner-signed-in walk-through on production data**
on localhost: revaluation lesson resumed at step 3 after reload; triple click advanced one step; stale second-tab
event returned 409 with server state unchanged; wrong choice explained; "₹3,000" accepted; completion → Lock in 5
cards → summary with next review times → reread link → practice opened with Accountancy / Admission of Partner
preselected and "Included" (nothing started or charged); different lesson set the earlier one aside, same lesson
resumed; Today led with the unfinished lesson. 320 px library/overview/lesson: zero overflow, no study targets
<44 px; wide comparison tables stack on phones. Both themes checked. These are owner QA records, not student
outcome evidence.

Still open: real budget Android with keyboard, physical screen reader, actual 200% zoom/OS reduced motion, field
Core Web Vitals, delayed unseen-question outcomes, comprehension testing with real students, offline packs
(print summary only), remaining chapters, CLI migration-history reconciliation. Device TTS pronunciation is
labelled as device voice; no licensed pronunciation source is bundled.

Rollback: set STUDY_CONTENT_ENABLED/STUDY_RECALL_ENABLED/STUDY_GUIDED_PLAN_ENABLED to false and redeploy (records
kept), or `git revert` the release commit and redeploy. If phase 2 has run and the old code is restored, set the
two v1 units back to `published` (no deletes are needed; v2 rows are ignored by the old release proof).

### 5 October 2026 — Learn v2 published

- Commit `78a627f` pushed to `origin/main`; www.mockmob.in served it about 80 s later. Live HTTP: home 200 with
  the flag-gated Learn tour slide, `/learn` 200, anonymous study catalog 401, dev preview 404.
- Content phase 2 applied after the deploy: english-vocabulary-01@1 and accountancy-sacrificing-gaining@1
  quarantined (v2 published); the correction trigger invalidated the 5 owner QA runs on v1, one event each; no
  deletes. Receipts: `artifacts/study-suite/v2/apply-{insert,supersede}-receipt.json`, `live-receipt.json`.
- Signed-in live check (owner Pro account, 375px): Learn led with the unfinished lesson and due cards; the
  lesson completed with check feedback and the daily new-card limit message; Organising practice linked.
- Local `main` in the original checkout still points at 6c5e05b with the owner's uncommitted work; it is now
  three commits behind `origin/main`. Reconcile deliberately before publishing those edits.

## 5 Oct 2026: Key Review + NTA integrity guard + Luna routing
- Key Review: when Mistake Repair's solve and blind second check both disagree with the key, the student sees an
  acknowledgement ("We may have got this one wrong") with who picked what, plus a result-page log of held keys.
  A reload shows the same panel via `question_under_review`. Marks are NOT changed automatically; copy says so.
  No migration, no extra model calls.
- NTA integrity guard: leaving the tab/window = strike; warnings 1-2 show an animated modal, strike 3 submits the
  session. Strikes persist across reload (`<session key>:integrity`); copy/paste/context menu blocked. Browser-side
  deterrent only: strikes are NOT sent to the server (attempt events accept only answer/visit), so there is no
  server-verified proctoring record.
- Also shipped: GPT-6 Luna-only model routing (providers.js, moderation/ai.js, live-eval scripts).
- Deliberately NOT shipped: AI top-up opening (RELEASE_GATES.aiCommerce, pricing pages) from the local tree; needs an explicit owner go-ahead and Razorpay keys.
- Verified: unit tests and eslint (see commit); preview walkthrough of both flows. Not verified: real multi-window/mobile
  app-switch behaviour, signed-in NTA run, live Luna calls.

## 6 Oct 2026: Key Review / NTA release verification
- Prepared an isolated normal checkout from 82d3341 (base origin/main 23ac1dd), preserving the owner's dirty main checkout.
- The handoff commit omitted seven new component/data/test files plus package.json and this status entry. Recovered these exact files from the handoff worktree; no AI commerce, pricing, artifacts, study-suite edits or migration included.
- Removed a duplicate question_under_review response handler; corrected the illustrative held-response fixture so both checks actually disagree with its key.
- Actual checks: npm run build passed with physical node_modules (Next.js 16.2.4 / Turbopack); eslint passed; test:learning 84/84, test:recovery 35/35, answer-integrity plus payment-entitlements 18/18 passed. No paid-model invocation or production-data migration performed.
- Earlier preview interaction evidence is from the handoff, not repeated in this release check. Browser-only strikes are not a server proctoring record. After reload, Key Review is returned on a repair request for the already-held question; the result-page log is rebuilt from those responses.
- Deployment is pending the non-forced main push and Vercel verification. Live Luna compatibility, signed-in NTA, real mobile/multi-window focus behaviour and captured AI top-up checkout remain unverified. AI top-up purchasing remains closed.
- Rollback: revert the feature commit and release-completion commit; no database rollback is needed.
### Production publication evidence (6 Oct 2026)
- Published 82d3341 plus completion commit d2e3f2b to GitHub main by non-forced fast-forward from 23ac1dd.
- GitHub check `Vercel – mockmob` succeeded for d2e3f2b. Production deployment 6868841235 succeeded at https://mockmob-9stt6no29-atishay07s-projects.vercel.app (Vercel dashboard: https://vercel.com/atishay07s-projects/mockmob/BXoio53KjaFuPBdUUJ49fc4Sqnxc).
- Post-deploy live checks: apex https://mockmob.in redirects to https://www.mockmob.in/ with final HTTP 200; www homepage and /pricing return 200; unsigned /test redirects to /signup with final 200. No redirect loop observed.
- These checks confirm production publication and public entry routes; they do not prove authenticated Key Review/NTA interactions, physical-device focus handling, live model compatibility or payment capture. Those gates remain as recorded above. Other duplicate Vercel projects attached to the repo are outside this live-domain release verification.

## 6 Oct 2026: corrective NTA fullscreen and answer-change audit
- Owner reported that fullscreen rehearsal and confirmed-key correction UX were incomplete. Audit and source-backed question findings: docs/brain/reports/KEY-REVIEW-NTA-CORRECTIVE-AUDIT-2026-10-06.md.
- NTA now requests actual fullscreen, requires re-entry after warnings, counts one absence once, persists strikes per session, submits on warning 3, removes the in-app Exit shortcut, locks answering behind native themed dialogs and exposes failed-submission retry. Browser/OS exits remain possible; unsupported browsers disclose a focus-only fallback. Timer deadlines are unchanged.
- Results now hydrate changed/held questions from current server records on reload. Confirmed corrections show an apology, corrected answer/explanation/source and separate marks adjustment; unverified changes do not claim correctness. Old snapshots/account/leaderboard scores remain intact. No paid model calls on reading corrections.
- Exact screenshot question is already D in production (dea6e298-269e-4b18-afd4-53c0b3be7cf5). Source-backed matching display receipt confirms D; pick B stays wrong, adjustment 0. No production data update or migration performed. The historical A-to-D change has no returned version-history receipt, so its timing/provenance is not claimed.
- Verified: learning 91/91, recovery 35/35, answer-integrity/payment-entitlements 18/18, eslint and production build. Isolated Chrome exercised real fullscreen entry/exits, warning progression, reload persistence, auto-submit, failure/retry, denial, and Quick Practice. Desktop/390px mobile compositions inspected; controlled visibility/blur events reached the real hook. JSON/screenshots retained locally in artifacts/corrective-checks/.
- Remaining: corrective deployment verification, signed-in production result/NTA, real OS/tab/window switching, physical phones, screen readers and live Luna. A real headless tab switch did not expose focus change; synthetic events are not hardware proof. Strikes remain browser-only. AI commerce stays closed; entitlements and atomic RPCs untouched.
- Rollback: revert the corrective code commit. No database rollback needed.

## 13 Oct 2026 - NTA session state (fix/nta-mode)
- Mark for review is now an event (`type: 'mark'`, `marked: true|false`) in the session log, saved like answers: durable sessions keep it on the server and rebuild it on resume (`progressFromEvents`, data/session_draft.js); the scored timeline never contains marks. Old local drafts add their marks to the log on first load.
- Device-ticket clock: the server signs the start time in a start receipt (`meta.startReceipt`, data/practice_ticket.js); the runner keeps it in the page address (`startReceipt`), and a start with the same key and the receipt returns the original start and deadline instead of a new clock. Past the 2-minute grace it answers SESSION_EXPIRED; a forged, edited or foreign receipt answers INVALID_START_RECEIPT. Limit: a start with no receipt is a new session (a first start or a new key), and a receipt lost with the address (other device) cannot be recovered; durable mode (LEARNING_SESSIONS_ENABLED=true) has no such limit.
- Option layout: the session stores `selection_meta.ntaOptionLayout` ({order, key, shuffled}) from the engine's `nta_option_order`; a paper whose remapped key does not point at the served option is refused before a session or a credit exists.
- Tests: data/tests/nta_session_state.test.mjs (test:nta), data/tests/nta_e2e_state.test.mjs (test:nta-e2e), plus a mark test in recovery.test.mjs.

### 2026-10-17 about 2:35 am IST - Per-user AI cap and two-model allowlist APPLIED on production

- Migration 20261017120000_runtime_ai_user_cap applied to production (isrxrxzjocewrdureyhp) under the standing grant, after a staging dry run and an independent verifier pass.
- Post-check: runtime_ai_requests.user_id exists; reserve_runtime_ai now takes 7 arguments; anon cannot execute it.
- Owner decision (17 Oct, 2:15 am): the paid cap is Rs 5 a month, so `update runtime_ai_budget set monthly_cap_usd=0.0568 where id='student_user_paid'` ran right after.
- Caps now: student_ai 25 (global, unchanged), student_user_paid 0.0568, student_user_free 0.0114.
- Undo: supabase/undo/20261017120000_runtime_ai_user_cap.undo.sql.

### 2026-10-14 13:43 IST — Authored wave 1 published to production (owner approved in chat)
- 475 questions and 12 passage groups inserted (source `claude-authored-2026-10-14`) with `scripts/question-publish-authored.mjs --mode=apply`; plan hash 39a4b051… and candidates sha 18b27c06… matched the runbook exactly; read-back: missing 0, notVisible 0, hashMismatch 0.
- Live before → after: chemistry 281→376, english 269→327, history 192→273, political_science 191→272, psychology 82→161, sociology 199→280.
- Visible in practice and full mock now. NOT in NTA mode until engine r5 (fix/nta-mode, not deployed) ships; not in Explore (no question_scores rows).
- Restore: `node --use-system-ca scripts/question-publish-authored.mjs --mode=restore --restore=docs/brain/reports/authored-publish/authored-publish-restore-2026-10-14T08-12-59-785Z.json --expect-project=isrxrxzjocewrdureyhp` (default hides; keeps attempt history).

### 2026-10-14 23:59 IST: production diagnosis via Supabase MCP, and one config row applied
- **Owner grant:** standing authority for MockMob database work (AI OS decisions log, 14 Oct).
- **Diagnosis (read only, production isrxrxzjocewrdureyhp):**
  - **Volume:** 11 Mistake Repairs in 14 days, by 2 accounts.
  - **4 Oct:** 5 of 7 explained, all on gpt-4.1-mini.
  - **Since the Luna-only deploy (5 Oct 21:01 UTC):** every repair (4 of 4) released as unusable_output within 0.7 to 2.4 s.
  - **No model call reached the runtime guard:** no runtime_ai_requests row exists after 4 Oct 20:25 UTC.
  - **Not the guard or budget:** the cap is fine ($0.011 of $25, not paused), no credits are stuck, and a rolled-back call to reserve_runtime_ai('openai','gpt-6-luna') returns dispatch true.
  - **Cause:** Vercel Production env. Either OPENAI_API_KEY is missing (getOpenAIClient returns null, giving provider_unavailable), or AI_REPAIR_MODEL names a model with no price row.
  - **Open:** the owner checks Vercel env. The fix branch's per-failure log line will name the cause once deployed.
- **Applied:** migration 20261014183050 runtime_ai_price_claude_haiku_5_5 (one config row; undo: `delete from public.runtime_ai_prices where provider='anthropic' and model='claude-haiku-5-5'`). This lets the Haiku 5.5 fallback in fix/repair-reliability run once deployed. No student data was changed.

### 2026-10-15 00:18 IST: authored wave 2 published to production (owner approved in chat)
- **Dry run:** plan hash 73b63070..., the same as the reviewed plan. 0 blockers, 0 warnings. 382 bound to both the agent and fit tables, 0 lookalikes.
- **Apply:** source claude-authored-2026-10-14-w2. 382 questions and 1 case-set group inserted, 0 missing, 0 not visible, 0 hash mismatches.
- **Live counts:**

  | Subject | Before | After |
  |---|---|---|
  | Biology | 360 | 416 |
  | Computer Science | 311 | 387 |
  | English | 327 | 382 |
  | General Test (gat) | 150 | 227 |
  | Geography | 179 | 223 |
  | Mathematics | 267 | 332 |
  | Political Science | 272 | 281 |

- **Restore file:** docs/brain/reports/authored-publish/authored-publish-restore-2026-10-14T18-48-05-150Z.json (`--mode=restore` hides wave 2 only).

### 2026-10-16 about 15:25 IST — NTA index: applied, built, rolled back (signature mismatch), fix in progress

- 14:00 IST: `nta_question_index` applied to production under the standing grant (RLS on, service role only) and built with `scripts/nta-index-build.mjs --write --allow-production`: 653 rows (english 173, accountancy 135, business_studies 181, economics 164). `CUET_EVIDENCE_SIGNING_KEY` was already in Vercel production; Vercel's own nightly snapshot verified the same 653 evidence records, so the keys match.
- The read-only `scripts/nta-engine-run.mjs` then showed every index row rejected as `score_signature_invalid`: Accountancy and Business Studies could not start an NTA paper, Economics fell to 45 questions.
- 14:55 IST: rolled back with `truncate public.nta_question_index` (the runbook's switch-off; the table stays). The engine run after it: Accountancy 3 of 3 papers (57 factory + 713 agent eligible), Business Studies 3 of 3 (56 + 71), Economics 3 of 3 at 50. English cannot start, as on 13 Oct (separate cause).
- Exposure: 0 attempts completed on production from 14:00 IST to 15:20 IST, and no NTA log lines from 14:33 (Hobby keeps 1 h), so most likely no student hit it.
- Cause (suspected, being proven on staging by branch fix/nta-index-sig-1016): `ntaIndexSignedBody` signs `verified_at` and `luna`/`gemini` as the builder holds them in JS, but PostgREST returns timestamptz as `+00:00` and numeric(4,2) rounded, so the canonical JSON differs. Tests used fakes that returned the builder's own values. Do not rebuild the index until that fix is deployed and the engine run shows `poolSource` index with 0 signature failures.

### 2026-10-16 about 13:50 IST — Security: the question bank closed to the public anon key (production)

- Found by the 16 Oct security review: `public.questions` kept Supabase's default grants for `anon` and `authenticated` plus the policy "anon read live questions", so anyone with the browser's public key could read all 8,196 live questions with answer keys, explanations, evidence and internal fields straight from PostgREST.
- Checked first that nothing needs it: every server read uses the service role (`src/lib/supabase.js`), the browser client and both apps use Supabase only for sign-in.
- Applied under the standing database grant: `supabase/migrations/20261016141000_questions_private_to_browser_roles.sql` (revoke all from anon and authenticated; service_role keeps all). Staging dry run first; undo `supabase/undo/20261016141000_questions_private_to_browser_roles.undo.sql`.
- Verified on production: grants now postgres and service_role only; `/rest/v1/questions` with the anon key answers 401 `permission denied for table questions`; with the service role 200; www.mockmob.in `/`, `/pricing`, `/api/stats` 200.
- Still open from the review: PERSISTENT_LIMITS_ENABLED (rate limits per instance), `/api/questions/feed` sends keys to signed-out callers (owner decision), revoke default grants on other RLS-only tables (defence in depth), the low items in the review.

