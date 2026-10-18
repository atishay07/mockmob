# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 7:15 pm IST, by session 604ced81 (main, Claude Opus 5.5, CEO/CTO). The owner said "Usage is now at 95%. We can start stopping things", then asked for this handoff.
- **Every agent and workflow is stopped.** Partial work is committed as STOP POINTs: wt-play-app 5ae50007, wt-credits-core 72d8550e, wt-pro-nudge-app a00ddfe1. Every other worktree is clean.
- **Reaped:** Flutter tests, Gradle, adb, the emulator, headless Chrome, agent dev servers.
- **Left running on purpose:**
  - Staging site 3101 (old rig code, wt-rig-site).
  - Relay 3102.
  - Staging site 3103 = release 9 part A + the Mob with MOB_ENABLED=true. Worktree wt-rig-r9, local merge d0d6d0fe; launcher `tmp/rig-1016e/stagingLocalApp.r9-3103.mjs`; listener PID 14616. Kill and relaunch it after R9 changes.

**Read next, in this order:**
1. This file, completely.
2. `OWNER-MASTER-LEDGER.md`: the bottom sections, from "Owner at about 3:55 pm" (D63) to "D84-D85", plus the CEO decisions C1-C5 and the release 8 audit reconciliation.
3. `OWNER-FEEDBACK-2026-10-18-DAWN.md`: his own words; the sections after 3:45 pm are tonight's D63-D85.
4. `docs/brain/PLAY-BILLING-PLAN-1018.md` (in branch web/play-billing-1018) and `docs/brain/WALLET-RAZORPAY.md` (in branch web/wallet-1018).
5. `tmp/ledger-audit-1018/results.json`: the release 8 audit, item by item.

## 1. The goal and the vision (his words, newest first)
**Tonight (D74, 6:25 pm):** "I want everything that you said to be done by 10:30", and run more in parallel. "Everything" means:
- **Website release 9:** the Mob ON (D66), per-question practice credits (D65), and his audited feedback fixed.
- **Final app:** his v15 phone fixes, the richer Today and swipe stack (v15.1), per-question prices and the Mob. Walked on the emulator, then a release APK installed on his phone.
- **Google Play billing (D71-D73, D75):** Pro at Rs 150 on Play vs Rs 99 on the web; credit packs on Play.
- **ONE credits balance** for everything (D78), with a wallet on web and app (D76).
- **Pro nudges everywhere,** an Upgrade sheet on any Pro feature, and a first-session pop-up after the first real action with personalised benefits (D79-D81), in persuasive marketing English (D84).
- **Then ONE message** with the links, the APKs and where to look, ending with "Things needed from you right now" or "Nothing needed from your side" (M-018).

**Vision:**
- MockMob for CUET UG 2027: unlimited mocks from one central bank (the USP), Score Recovery (find, repair, check the mistake), and Ask Mobi.
- Premium, refined, never generic: refine, don't rebuild; Night subtle; mock-ups before new layouts.
- Monetisation:
  - Pro Rs 99 on the web, Rs 150 on Google Play.
  - One credits balance: 50 free a month for everyone, plus packs.
  - Strong but truthful marketing copy.
- **Next phases after tonight:**
  - The Play Store launch: his Play Console steps and a 12-tester, 14-day closed test.
  - The Mob growing into a social circle (D22).
  - Learn and Review depth.
  - Higgsfield videos (storyboards in docs/brain, M-009).
  - The remaining audit items (section 6).

## 2. Live now (production)
**www.mockmob.in = main 00328e54 (release 8), then STATUS commit eb5185ef.**
- Vercel dpl_3THyGFBktbdxcAuwhfN2sLNsHmrT READY, 0 runtime errors.
- Release 8 carries: the D38 landing hero, D53 (the quiet AI line), D54 (Free AI wallet 50 a month), W-064 (the first-week path and repair receipt), W-032 (Try it again before the key), and the R8 fixes.

**Production database: applied today, all under his standing grant.** Pre-checks, post-checks and rolled-back dry runs were done; the undo files are in the repo.
1. **free_ai_wallet_50**, about 3:47 pm.
   - The two AI wallet functions now hash as the migration file; the student_user_free cap is 0.0284.
   - Undo: supabase/undo/20261018130000_free_ai_wallet_50.undo.sql.
2. **practice_credit_per_question**, about 6:22 pm.
   - Pre-check: spend_credits md5 7decd1ff..., length 1535. Post-check: md5 911105fd..., length 1666; EXECUTE only postgres and service_role.
   - Dry spend (rolled back): 5+15+20+10+50 = exactly 100; a replay charged nothing; 0 rows left.
   - Old actions keep their prices (attempt 10, attempt_full 50), so release 8's code is unaffected.
   - Undo: supabase/undo/20261018170000_practice_credit_per_question.undo.sql (roll back the code first).
3. **20261017100000_mob + 20261017190000_mob_fix_1017**, about 6:29 pm.
   - 26 functions with md5s equal to staging; 15 mob tables, all RLS on; server roles only.
   - The Mob is INVISIBLE until MOB_ENABLED=true on Vercel and the R9 code is deployed.
   - Undo in reverse order: the fix undo first, then the base undo.

**NOT on production yet:** 20261018190000_play_purchases (Play billing) and 20261018210000_one_credits_balance (the one balance). Neither is on staging yet either.

**Vercel env NOT set yet:**
- MOB_ENABLED.
- PLAY_BILLING_ENABLED and the Play vars.
- WALLET_COMMERCE_OPEN.
- PERSISTENT_LIMITS_ENABLED: deliberately deferred. It moves login rate limits to the database too, so it needs its own decision.

## 3. Owner decisions tonight (details in the ledger)
- **D63** Ship release 8: done.
- **D64** Skip W-099 and W-046.
- **D65** Practice credits = number of questions (5/10/15/20); a full mock 50.
- **D66** The Mob fully built, ON, tested.
- **D67-D68** Ship all of it.
- **D69** Decide autonomously while he is away (C1-C5 recorded).
- **D71-D73** Play billing plan. D72/D75: Pro **Rs 150 on Play (final)**, Rs 99 on the web; the app never shows the web price (anti-steering).
- **D76/D78** ONE credits balance and wallet. Spend order: this month's free 50 first, then bought (ai bonus), then held (users.credit_balance). 1 credit = 1 question or 1 Ask Mobi reply; a full mock is 50.
- **D82** Packs APPROVED:
  - credits_10_50 (Rs 10), credits_29_150 (Rs 29), credits_49_300 (Rs 49, featured).
  - Play prices Rs 15 / 45 / 75; Pro on Play Rs 150.
- **D83** Margin answer: gpt-6-luna about Rs 0.03 a reply typical and Rs 0.04 worst seen. Margins 74-84% on the packs. Keep credit-paid replies on luna with a hard reply-length cap. A deeper Haiku reply = 3 credits if ever offered. The per-user AI cap must not block bought credits: fixed in credits-core 5c553d3a, which raises the cap by held credits.
- **D79-D81, D84** Pro nudges, the Upgrade sheet, the first-session pop-up (after the first real action, never on or right after onboarding, once ever, personalised and true). Persuasive marketing English.
- **D85** He switches accounts himself near 95%.
- **Open with him:**
  - The PERSISTENT_LIMITS_ENABLED switch.
  - The Play Console steps (his).
  - The Razorpay wiring for the wallet (his, "today only").
  - Plugging in the phone for the APK.

## 4. Every track: where it stopped and what is next
### A. Website release 9: the merge is done, the final checks are not
- **wt-rel9 (deploy/web-1018-r9) = 74295941 = part A + verifier fixes.**
  - Part A = per-question credits (perq), the four audit-fix packets, and the leftovers.
  - Verify round 1 was NO-GO (2 MEDIUM); both were fixed in 74295941. Verify round 2 was STOPPED before finishing: re-run it.
- **wt-rel9b (deploy/web-1018-r9b) = 31c4dd21 = 74295941 + the Mob** (web/r9-mob-1018 186bbb1b, gated 10/10 on staging).
  - data/evidence_registry.js was RESTORED (the Mob branch carried a rig-only process.cwd() hack: the verifier's HIGH), with a test against it.
  - Three Mob LOWs fixed: the runner says Mob paper, give-back only on RPC failure, an empty mob id gives 400.
  - Its suites and visual check were NOT confirmed (stopped).
- **NEXT:**
  1. In wt-rel9b: lint, test:mob/app/today/recovery/learning/billing/auth/dock/subjects, and `next build --webpack`.
  2. ONE independent Opus verifier over the whole R9 (money, truth, the Mob on and off, the audit items at 390/1440 Night/Day). Fix and re-verify.
  3. Set Vercel env MOB_ENABLED=true (Production).
  4. Push to main as a fast-forward from 00328e54: `git -C wt-rel9b push origin HEAD:refs/heads/main` after `git merge-base --is-ancestor origin/main HEAD`.
  5. Vercel READY and runtime errors.
  6. Smoke test: /, /pricing, /today, /review, /mob 200 signed-out redirect, /api/stats.
  7. STATUS: R9 + the 3 migrations above (copy the evidence from section 2).
- **Release 9 contents:** per-question practice prices; Today (one-piece landing, honest greeting, cue above the dock, path rail, one week count, a better "Why this?"); Review/Result (never "lost X of Y" with X > Y, chapter-scoped counts, one stem, one Repair, ledger reveal, reel order); nav (Guide, Marks trend, Show me around, Ask Mobi above the theme control, one lime key, 44 px, badges); public (AI credits truth, onboarding truth plus bolder copy, "Your standing", one price framing, aurora removed, tabs, footer Help for guests, auth copy); the Mob.

### B. The final app (1.0.15+6): one more walk, then the APK
**wt-v15-1 (ui/v15.1-1018) = 01dd7770.** It holds the v15 walk fixes, per-question price display, the richer Today (D52), the swipe stack (D51), and the walk round 1 fixes:
- af7616bc: HIGH, "How many questions?" from a Suggested-stack lead.
- 47a1b501: the failure title at 360.
- d6ef23fc: the could-not-refresh line on one line.
- 01dd7770: Ask Mobi's cold first answer, where slow is not offline.

Before them: analyze clean, 6007 unit tests, 1675 goldens. Walk round 1 PASSED: the HIGH 316/310 marks fix, offline line, onboarding helper, Today/Mobi/weeks/marks/bars, and the swipe rules.

**NEXT:**
1. Re-run the walk (round 2 was stopped) on the round 1 findings plus a regression pass. Screenshots go in tmp/app-walk-1018f/round2; the brief is in the workflow script app-final-1018 under the session's workflows folder.
2. Build the release APK: `--release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`. Save it as tmp/apk/mockmob-v15-final-<sha>.apk plus a zip.
3. Do a short walk of the Mob and real per-question prices against the 3103 staging site (R9 + Mob): `adb -e reverse tcp:3101 tcp:3103`, then restore `tcp:3101 tcp:3101`.
4. Install on his phone with `adb -s 10BF370PA6002XR install -r` (only the main session) and send the file.

### C. ONE credits balance core (web, Opus): built, not yet verified
**wt-credits-core (web/credits-core-1018) = 5c553d3a + STOP POINT 72d8550e.**
- 5c553d3a holds:
  - public.mm_wallet_take, with the spend order free, then ai bonus, then users.credit_balance, used by spend_credits and by the AI reserve and consume functions;
  - refunds per part;
  - held credits raising the per-user AI cap;
  - src/services/credits/creditPacks.mjs, the one pack catalog;
  - PGlite tests;
  - migration supabase/migrations/20261018210000_one_credits_balance.sql and its undo, with production md5s.
- 72d8550e: the partial JS reads (AppLayoutClient, api/ai/credits, auth/me, me/credits, practice/quote, AccountCredits, creditCopy, credits.js). Unchecked.
- NOT applied on staging (checked: mm_wallet_take absent).

**NEXT:**
1. Finish the JS reads to getUnifiedWallet (src/services/credits/unifiedWallet.js).
2. Run the suites.
3. Dry-run on staging in a rolled-back DO block, then apply on staging.
4. An independent Opus verifier: money correctness for about 900 students; the per-user cap; every spend path; the undo md5.

### D. Credits wallet, web: nearly done
**wt-wallet-web (web/wallet-1018) = 6237ada2.**
- /wallet page with one balance, the packs credits_10_50 / 29_150 / 49_300, a quiet Pro row and history.
- GET /api/wallet for web and app; POST /api/wallet/order and /api/wallet/verify behind WALLET_COMMERCE_OPEN (closed = "Top-ups open soon").
- docs/brain/WALLET-RAZORPAY.md tells the owner what to wire.
- It was at "build passes; STATUS and the final test run". Its creditPacks.mjs and unifiedWallet.js are stubs: on merge, TAKE credits-core's versions.

**NEXT:** final tests and STATUS.

### E. Pro nudges, web (Opus): wired, visual check unfinished
**wt-pro-nudge (web/pro-nudge-1018) = b281ea9a.**
- Rules and copy (D79-D81, D84); the Upgrade sheet; inline nudges in Practice, the Start sheet, result, Review, Credits and the credits chip; the onboarding first-session mark; preview fixtures; tests in test:app.
- It was viewing its screenshots (tmp/pro-nudge-web).

**NEXT:** finish the visual check at 390/1440 Night/Day, and get 3 headline options plus 3 button options for the owner.

### F. Play billing, server: DONE
**wt-play-server (web/play-billing-1018) = 9b6cd30b**, 45 tests.
- POST /api/billing/play/verify and /api/billing/play/rtdn behind PLAY_BILLING_ENABLED (404 when off).
- Service-account JWT on node:crypto (no new dependency).
- Migration 20261018190000_play_purchases with an undo.
- Product map: pro_cuet_2027 (acknowledge), credits_10_50 / 29_150 / 49_300 (consume, into ai bonus), legacy ai_credits_prepos_* accepted.
- Plan and owner steps: docs/brain/PLAY-BILLING-PLAN-1018.md.
- **On merge:** point its product map at creditPacks.mjs.

### G. Play billing, app: tests not finished
**wt-play-app (ui/play-billing-1018) = 64842472 + STOP POINT 5ae50007** (a plugin test).
- The PLAY_BILLING dart-define flag (default off); the in_app_purchase plugin; a billing controller where the server confirms before completing.
- A Get Pro sheet (it takes a reason and benefit lines).
- A one-balance Wallet screen on /you/credits.

**NEXT:** the full unit suite and goldens; adapt to the /api/wallet shape (D).

### H. Pro nudges, app: tests unfinished
**wt-pro-nudge-app (ui/pro-nudge-1018) = 49e64aca + STOP POINT a00ddfe1** (partial tests).
- Copy, rules, store and controller; benefit lines; the Upgrade sheet wired into every Pro gate; inline rows; the first-session host.
- Shown only with PLAY_BILLING on (the store rule).

**NEXT:** tests and goldens.

### I. The releases after that
- **Release 10 (web)** = R9 + C + D + E + F.
  - Integrate in a new worktree from the pushed R9 head and run the suites.
  - One Opus verifier.
  - Production in this order: play_purchases (flag off) and one_credits_balance, each with pre-checks, post-checks and an undo; then push; then the flags (WALLET_COMMERCE_OPEN only after his Razorpay wiring; PLAY_BILLING_ENABLED only after his Play Console setup).
- **v15.2 (app)** = B's walked head + G + H.
  - Merge, run the suites, walk, build the APK, install it.
  - With PLAY_BILLING off, the app shows the one-balance wallet with "Top-ups open soon" and no nudges.

## 5. What the owner must do (tell him in the final message)
1. Plug in his phone (USB debugging) for the APK install.
2. Wire Razorpay for the wallet (docs/brain/WALLET-RAZORPAY.md in web/wallet-1018), then say so, and we set WALLET_COMMERCE_OPEN=true.
3. Play Console (docs/brain/PLAY-BILLING-PLAN-1018.md):
   - payments profile;
   - the 15% service fee tier;
   - products pro_cuet_2027 at Rs 150 and credits_10_50 / 29_150 / 49_300 at Rs 15 / 45 / 75;
   - the service account with View financial data and Manage orders;
   - the Pub/Sub RTDN topic and push subscription;
   - licence testers;
   - an internal-testing upload.
4. Decide PERSISTENT_LIMITS_ENABLED. Recommendation: on, after a login-limit check on staging.

## 6. Still open after release 9 (from the audit; ledger section "Audit reconciliation")
- D25 and W-085 (the app halves).
- W-033 (a signed-in repair walk).
- W-042 timing on a real account.
- D31 (his landing verdict).
- W-072/W-073/W-077 (premium sweeps).
- D9 and W-053 (Progress order).
- M-007 (Compass sources).
- D20 (Learn one tap on phones).
- D22 (the Mob as a social circle).
- N4 (fine-tune).
- Mob LOWs: the timer re-issued on reopen; an invite spent after a leave; the leave copy; no deep link to a second Mob; the practice-result Mob line not built.

## 7. Commands and facts
**Flutter:**
- Always `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh <args>` from flutter_app; unit tests with -j 3; `./gradlew --stop` after builds.
- dart_defines live in mockmob-next/flutter_app/dart_defines (git-ignored; copy them in).
- Walks use a PROFILE build with phone-relay.json; never build --debug.

**Emulator:** AVD mockmob_budget, `-memory 3072 -no-snapshot-save`, `adb -e` only. The rig is in tmp/rig-1016e/RIG-READY.md (staging OTP sign-in, app-e2e-student@example.com).

**His phone:** V2413, serial 10BF370PA6002XR. It has v15 79aaca6d (1.0.15+3), debug-signed, so `install -r` works. Only the main session touches it.

**Web:**
- node_modules is a junction to mockmob-hotfix/node_modules (create it with PowerShell New-Item -ItemType Junction). Never npm install.
- .env.local comes from wt-batch2 and points at PRODUCTION: dev servers use preview fixtures only.
- Staging work uses .env.staging via the rig launchers.
- Dev server: `NODE_OPTIONS=--max-old-space-size=4096 npx next dev --webpack -p <port>`.

**IDs:**
- Vercel project prj_uSolddribHQDl1mM5AKxg3O9qCIu, team team_V5PhMz9hqV42vblUMcvhYqoN.
- Supabase production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.

**Process:**
- Headless playwright-core only (C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core). Never the chrome-devtools MCP or a visible browser.
- Only gpt-6-luna and Claude Haiku 5.5 run at runtime.
- The main session pushes, applies production migrations (or an agent under an exact brief with md5 checks), sets Vercel env, and installs on the phone.

**Capacity:** 16 threads and 32 GB; 9 GB of RAM was free with 11 agents. The real limits are the C: disk at 100% and the CPU. Usage burns about 30% an hour with 9-11 agents.

## 8. Rules that bit today
- A sed with an escaped backtick prefixed every line of NOW.md; use Python for text edits with backticks.
- PowerShell treats "$var:" as a drive: use ${var}.
- "Stalled" alerts and the owner's view of agents: always check the transcript mtimes before calling an agent stalled. All of them were active at 6:38 pm.
- Unchecked STOP POINT commits can carry rig-only hacks into release branches (evidence_registry.js). Diff every release against main for rig files.
- Production migrations of 50 KB+ go to an agent with exact pre/post checks (function md5 equal to staging), not hand-copied.
- Stopping a workflow kills its agents. Commit first, then relaunch from the git state; resume briefs must name the STOP POINT.
