# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 10:35 pm IST, by session 25ef3d95 (main, Claude Opus 5.5, CEO/CTO). The owner asked to stop at 96% usage and hand off.
- **Stopped:** every workflow.
- **Committed:** every worktree. The partial work is in two STOP POINTs: wt-v15-2 fae1d928 and wt-v15-taste c2e950ba.
- **Reaped:** agent leftovers.
- **Left running on purpose:**
  - staging site 3101 (old rig code), relay 3102;
  - staging site 3103 (release 9 part A + the Mob, MOB_ENABLED=true; wt-rig-r9; launcher `tmp/rig-1016e/stagingLocalApp.r9-3103.mjs`).

**Read next, in this order:**
1. This file, completely.
2. The bottom of `OWNER-MASTER-LEDGER.md` (D86-D97 and the 10:25 pm status).
3. `OWNER-FEEDBACK-2026-10-18-DAWN.md`, the sections after 7:20 pm: his own words tonight.
4. `mockmob-next/tmp/resume-1018-2230/`, which holds every agent report from tonight:
   - `FINAL-WALK-ISSUES.json`: the final app walk, 15 HIGH, 11 MEDIUM and 6 LOW, with screenshot names from `tmp/app-walk-1018g`;
   - `app-v15-2-final-results.json`: the merge report, the walk and the partial fix pass;
   - `taste-and-swipe-results.json`: the taste profile, the swipe v2 design, the 7 taste critics with about 170 items, the improvers and the swipe critics;
   - `tracks-c-h-results.json`: credits core, wallet, nudges, Play app, app nudges, with their checks and fixes;
   - `web-r9-final-results.json`: the release 9 verifier rounds.
5. `docs/brain/OWNER-TASTE-PROFILE.md` (section 0 governs) and `docs/design-decisions/pass-1018/SWIPE-V2-1018.md`.

## 1. The goal (his newest words win)
- **D96 (8:45 pm), the ONE goal:** the FINAL APP. Everything from these days goes into one build, then:
  1. merge everything;
  2. ONE final walk (done);
  3. ONE fix pass (partial: finish it);
  4. the release APK;
  5. install on his phone and send it.

  He verifies the rest by hand. "Skip the unnecessary checks." No second walk.
- **D95:** he connects his phone ONCE, for this final app (v15.2), and only when it is ready. 1.0.15+6 is skipped.
- **D97:** swipe v2 stays in the final build.
- **After the app:** release 10 (web), which is the one credits balance, the wallet, web Pro nudges, the Play billing server and the web taste fixes. Then ONE message with the links, the APK, where to look, and what he must do. End it with "Things needed from you right now" or "Nothing needed from your side".
- **Vision (unchanged):**
  - CUET UG 2027, with unlimited mocks from one central bank (the USP), Score Recovery and Ask Mobi.
  - Premium and refined: refine, never rebuild; Night subtle.
  - Pro is Rs 99 on the web and Rs 150 on Play. One credits balance: 50 free a month, plus packs at Rs 10/29/49 (Play Rs 15/45/75).
  - Persuasive but truthful copy.

## 2. Live now (production)
**www.mockmob.in = main 9b3661e8:** release 9 (2e45a92c), plus its STATUS commit.
- Vercel dpl_B8RemZJBcEvuc9CER6var7dFqr6Q is READY, with 0 runtime errors.
- Smoke test passed: /, /pricing ("1 credit a question"), /today, /review, /mob and /join all return 200; /api/mob returns 401 when signed out.
- **Release 9 =**
  - D65 per-question practice credits (5/10/15/20 questions cost 5/10/15/20 credits; a full mock 50);
  - the audit fixes (Today, Review/Result, nav, public);
  - the Mob ON (D66): Vercel env **MOB_ENABLED=true (Production)**, set at about 10:15 pm;
  - the Mob join fix (email-code accounts now pick a name first).
- **Production migrations applied today** (each with pre-checks, post-checks, a rolled-back dry run and an undo in supabase/undo):
  - free_ai_wallet_50;
  - practice_credit_per_question;
  - mob;
  - mob_fix_1017.

  STATUS 9b3661e8 holds the evidence.
- **NOT on production:**
  - migrations 20261018190000_play_purchases and 20261018210000_one_credits_balance;
  - Vercel env PLAY_BILLING_ENABLED, WALLET_COMMERCE_OPEN and PERSISTENT_LIMITS_ENABLED (the last is his decision).
- **His phone:** V2413, serial 10BF370PA6002XR. It has v15 79aaca6d (1.0.15+3), debug-signed, so `install -r` works. **Only the main session touches it, and only when he connects it for the final app.**

## 3. THE FINAL APP: exactly where it stopped (TOP PRIORITY)
**Worktree `C:\Users\atish\Desktop\mockmob copy\wt-v15-2`, branch ui/v15.2-1018, head fae1d928.** fae1d928 is a STOP POINT: 6 files of the fix pass's unchecked edits, on top of 3dbece85.

**Merged into it, in order:**
1. ui/v15.1-1018: v15 phone fixes D40-D62, the richer Today D52, the D51 stack v1, per-question price display, walk-1 fixes, and the clipping fixes fc2f0891.
2. ui/play-billing-1018 (0e840013): Play billing plus the one-balance Wallet screen, behind the PLAY_BILLING dart-define, which is OFF.
3. ui/pro-nudge-1018 (69938fad): the Pro nudges, the Upgrade sheet and the first-session pop-up. Shown only with PLAY_BILLING on.
4. ui/v15-taste: the taste fixes, merged up to 0506c021/a59963e7 and more.
5. ui/v15-swipe2 (34d8824b): **swipe v2 as approved** (D94). It covers Up next and Not now, the buttons under the deck, the first-time demo, undo, honest learning, and two Opus critic rounds.

**Version:** the build number was bumped by the integrator; versionName is 1.0.15. Unit suite: full suite green at merge time (see the merge report).

**Not merged yet:** ui/v15-taste commits after f70d087c (dec4e083, onboarding plan card, and STOP POINT c2e950ba). Merge them first.

**The final walk** (Opus, about 9:35-10:15 pm, on the emulator, 185+ screenshots in `mockmob-next/tmp/app-walk-1018g`) said NO-GO: 15 HIGH, 11 MEDIUM, 6 LOW. The full text is in `tmp/resume-1018-2230/FINAL-WALK-ISSUES.json`. Most HIGHs are numbers that disagree across screens, plus a few layout and truth items.

**Fixed by the fix pass before the stop** (its commits):
- 1f3ecd9c: the Up next bar no longer hides Start, and an Undo tap never lands on Start (HIGH 1).
- af24f29d: Revise lead minutes agree (HIGH 2).
- 9e69bf83: Revise counts name the round (HIGH 3).
- 728061c3: the Free plan line no longer makes the "nothing to run out of" promise.
- 3dbece85: Account sheet Sign out is quiet and no longer hides Notifications.
- fae1d928: partial work on more items (unchecked).

**Still to fix:** the rest of the 15 HIGH and 11 MEDIUM. Check each against the commits above:
- This week readout as a raw log;
- the Road "16 of 17 due";
- Share Capital figures disagreeing (Today/Review/Ask Mobi);
- repair counts 139/19/2;
- full-mock counts 5/13/8;
- AI credits "Not loaded";
- and the others in the JSON.

**NEXT, in order (about 1-1.5 h):**
1. Review STOP POINT fae1d928: keep the right parts, finish them.
2. Merge the newer ui/v15-taste commits.
3. ONE fix pass: every remaining HIGH and MEDIUM, and quick LOWs. Use Opus for taste and numbers.
4. Run flutter analyze clean, plus the unit tests of what changed. No golden suite, no second walk (D96).
5. Build the release APK: `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`, then `./gradlew --stop`. Copy it to `mockmob-next/tmp/apk/mockmob-v15.2-<sha>.apk` with a zip.
6. Tell him it is ready. When he connects, run `adb -s 10BF370PA6002XR install -r <apk>`, then send him the file.

**Server reality:**
- Production does not have /api/wallet yet. The wallet screens must fall back quietly to the current credits display; the integrator was told to do this, so verify it in code.
- With PLAY_BILLING off, there are no purchases, no web price, no nudges and no pop-up.
- The Mob and per-question prices work against live release 9.

## 4. Release 10 (web), after the app
| Track | Worktree, branch, head | State |
|---|---|---|
| C, the one credits balance core (money, Opus) | wt-credits-core, web/credits-core-1018, 6c23b11c | The checker's first round found issues; the fixer was stopped mid-work (STOP POINTs). Read tracks-c-h-results.json (C-core-build, C-core-check-1) for the staging state and the open items. Migration 20261018210000_one_credits_balance plus its undo. |
| D, web wallet | wt-wallet-web, web/wallet-1018, d491ba22 | Built, 2 check rounds plus fixes. On merge, take credits-core's creditPacks.mjs and unifiedWallet.js. The /api/wallet shape is documented in WALLET-RAZORPAY.md. |
| E, web Pro nudges (Opus copy) | wt-pro-nudge, web/pro-nudge-1018, 5216dee0 | 2 check rounds plus fixes. The 3 headline and 3 button options are in docs/brain/PRO-NUDGE-COPY-1018.md (in that branch). |
| F, Play billing server | wt-play-server, web/play-billing-1018, 9b6cd30b | DONE (45 tests). Migration 20261018190000_play_purchases plus its undo. |
| Web taste fixes | wt-r10-taste, web/r10-taste, 18f791be | About 20 commits on Today (cue, swap coach, rows, chevrons, copy). Built from the release 9 head of about 9 pm; merge onto main 9b3661e8. The re-check results are in the taste results file. |

**Release 10 plan:**
1. New worktree from main 9b3661e8. Merge C, D, E, F and r10-taste, then run the suites.
2. One Opus verifier covering money, truth and the taste items.
3. Production: the play_purchases migration (with the flag off) and one_credits_balance, each with a pre-check, post-check and undo.
4. Push, then STATUS.
5. Flags: WALLET_COMMERCE_OPEN only after his Razorpay wiring; PLAY_BILLING_ENABLED only after his Play Console setup.

## 5. The taste experiment (D89-D93): honest interim result
**The measurement:** the blind A/B evaluation was NOT run (stopped for usage). Run it later, or report this interim result.

**For it:**
- The 7 critics found about 170 items, including real bugs the function walks had missed:
  - Learn blank for 20 s;
  - numbers disagreeing across screens;
  - "AI credits Not loaded";
  - a false "nothing to run out of" line;
  - the static header Mobi;
  - two returned landing regressions (L-009 dock label, L-033 clock times);
  - the Ask Mobi canned repeat.
- The final walk independently confirmed several of them as HIGH.
- Swipe v2's design came straight from the D90 ask and passed two critic rounds.

**Against it:**
- It added about 1.5 h and many parallel branches.
- Merge complexity grew (the final merge took about 45 min).
- Improvers fixed only part of the list before the walk, so the walk re-found them.

**Interim call:** keep a LIGHTER version. Put the taste lens inside the one walk and the one fix pass, plus a critic only on genuinely new features (as with swipe v2). Do not keep a separate critic-improver loop on every surface. Tell him this, with the evidence above.

## 6. What the owner must do (put this in the final message)
1. Connect his phone (USB debugging) when the final app is ready: one install.
2. Wire Razorpay for the wallet (WALLET-RAZORPAY.md in web/wallet-1018); then we set WALLET_COMMERCE_OPEN=true.
3. Play Console setup (PLAY-BILLING-PLAN-1018.md):
   - payments profile;
   - the 15% tier;
   - products: pro_cuet_2027 at Rs 150, and credits_10_50 / 29_150 / 49_300 at Rs 15 / 45 / 75;
   - a service account with financial and orders access;
   - RTDN through Pub/Sub;
   - licence testers;
   - an internal-testing upload.
4. Decide PERSISTENT_LIMITS_ENABLED. Recommendation: on, after a login-limit check on staging.
5. W-044 (the Today cue barely seen while scrolling): a design decision. The web taste branch already re-shapes the cue.

## 7. Still open (beyond the app and release 10)
- **Audit list:** D25/W-085 (the app halves), W-033, W-042 timing, D31, W-072/W-073/W-077, D9/W-053, M-007, D20, D22, N4.
- **Mob LOWs:**
  - the deep link to a second Mob is ignored;
  - "same question right" does not name the question;
  - the timer is re-issued on reopen;
  - an invite is spent after a leave.

## 8. Commands and facts
- **Flutter:**
  - Always `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh <args>` from flutter_app; unit tests with -j 3; `./gradlew --stop` after builds.
  - dart_defines live in mockmob-next/flutter_app/dart_defines (git-ignored; copy them in).
  - Walks use a PROFILE build with phone-relay.json.
  - Release builds are debug-signed (there is no key.properties), so they match his phone.
- **Emulator:**
  - AVD mockmob_budget, `-memory 3072 -no-snapshot-save`, `adb -e` only.
  - The rig is documented in tmp/rig-1016e/RIG-READY.md (staging OTP for app-e2e-student@example.com).
  - For the Mob on staging: `adb -e reverse tcp:3101 tcp:3103`, then restore `tcp:3101 tcp:3101`.
  - Staging /api/attempts times out (5-12 s) tonight, so walks are slow.
- **Web:**
  - node_modules is a junction to mockmob-hotfix/node_modules.
  - .env.local (from wt-batch2) points at PRODUCTION, so use preview fixtures only.
  - `NODE_OPTIONS=--max-old-space-size=4096 npx next dev --webpack -p <port>`.
  - Next refuses a second dev server in the same folder: use a detached worktree per server.
- **IDs:**
  - Vercel: project prj_uSolddribHQDl1mM5AKxg3O9qCIu, team team_V5PhMz9hqV42vblUMcvhYqoN.
  - Supabase: production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.
- **The main session:** pushes, applies production migrations, sets Vercel env and installs on the phone.
- **Tools:** headless playwright-core only; never the chrome-devtools MCP or a visible browser. Only gpt-6-luna and Claude Haiku 5.5 at runtime.
- **Capacity:**
  - 16 threads and 32 GB. The CPU sat at 77-95% with about 16 agents; RAM went down to 6 GB free.
  - The disk has about 110 GB free (keep 100 or more).
  - Usage burned about 94% in 3 h with 12-16 agents (many on Opus).

## 9. Rules that bit tonight
- **The release 9 verifier ran 3 rounds (about 2.9 h).** Each round found new MEDIUMs. Cap at 2 rounds, and let the main session decide design calls (W-044) instead of looping.
- **The stall watcher (scratchpad stallwatch.mjs) needs the "Structured output provided successfully" tool_result counted as finished,** otherwise it raises false alarms.
- **Stopping a workflow kills every agent in it.** Separate fast and slow work into separate workflows so one can be stopped alone.
- **A wait step must check a unique marker, not a file name pattern.**
- **Merging many parallel branches costs real time.** Fewer, larger branches for the final build.
