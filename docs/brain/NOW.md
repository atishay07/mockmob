# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 19 Oct 2026, about 12:50 am IST, by session 604ced81 (main, Claude Opus 5.5, CEO/CTO), after the owner's D98-D100 ("finish it in this session").
- **Everything asked tonight is done:** release 10 is live, the final app v15.2 is installed on his phone, and the file has been sent.
- **Stopped:** every workflow and agent.
- **Left running on purpose:** staging sites 3101 and 3103 and relay 3102 (as before).

**Read next, in this order:**
1. This file.
2. The bottom of `OWNER-MASTER-LEDGER.md` (D98-D100 and the 12:50 am status).
3. `OWNER-FEEDBACK-2026-10-18-DAWN.md`, the sections from 10:40 pm on.
4. `docs/brain/STATUS.md` on main (23a7c090): the release 10 entry with every md5.

## 1. Goal and vision (unchanged)
- CUET UG 2027, with unlimited mocks from one central bank (the USP), Score Recovery and Ask Mobi.
- Premium and refined: refine, never rebuild; Night stays subtle.
- Pro is Rs 99 on the web and Rs 150 on Play.
- One credits balance: 50 free a month, plus packs at Rs 10/29/49 for 50/150/300 credits (Play: Rs 15/45/75).
- Copy is persuasive but truthful (D84).

## 2. Live now
**www.mockmob.in = main 23a7c090:** release 10 (75ac3f23) plus its STATUS commit. Vercel dpl_Hj8uNjjdG7hGe287MhU1UUBmf7ev is READY, with 0 runtime errors.

**Release 10 =**
- the one credits balance (spend order: free, then bought, then held);
- /wallet and GET /api/wallet;
- web Pro nudges, the Upgrade sheet and the first-session pop-up;
- the Play billing server (OFF);
- the Today taste fixes;
- GET /api/attempts?view=summary.

**Production migrations tonight:** play_purchases, one_credits_balance and attempts_list_summary_fn.
- Each was dry-run on staging first.
- Pre-check: production bodies = the undo files.
- Post-check: all 11 md5s = staging.
- Undo files are in supabase/undo.

**Flags, still OFF (the owner's call):**
- WALLET_COMMERCE_OPEN: after his Razorpay test-card run (WALLET-RAZORPAY.md section 6);
- PLAY_BILLING_ENABLED: after Play Console setup (PLAY-BILLING-PLAN-1018.md);
- PERSISTENT_LIMITS_ENABLED: untouched.

**His phone (V2413, 10BF370PA6002XR):** v15.2 1.0.15+7 (ab04b067), installed at about 12:47 am. The file is at mockmob-next/tmp/apk/mockmob-v15.2-ab04b067.apk (and .zip).

## 3. The final app v15.2 (ui/v15.2-1018 ab04b067, wt-v15-2)
**Contents:**
- v15 fixes D40-D62 and the richer Today;
- swipe v2 (D94);
- per-question prices;
- Play billing and Pro nudges behind PLAY_BILLING (OFF);
- the taste fixes;
- ONE fix pass over the final walk.

**The fix pass, by area** (branches ui/v152-numbers/today/mob/credits/onboard/words, all merged):
- **Numbers that agree:** This week readout, Road "X of Y", chapter figures (Review's record is the single source), repair counts and full-mock counts.
- **Start sheet and Today shell:** the Start sheet shows Today's lead and the account's subjects; Updated time; refresh keeps content; This week sheet.
- **The Mob and Pro wording:** seat ring; no Pro words with the flag off; NTA tile hidden; valid name prefill.
- **Credits:** one credits figure on a one-balance server; costs on the length sheet; chips; "AI credits" changed to "credits".
- **Onboarding and the deck:** onboarding answers win; stable subjects order; the save step reacts; deck art by kind; coach fade; truthful end card.

**Checks:** flutter analyze clean; the unit suite has 6,043 passing (1 stale string test, fixed). No goldens and no second walk (D96).

**Known, not fixed (tell him if asked):**
- Ask Mobi's chapter numbers come from server insights, so they can differ if the server counts differently from Review.
- The Review badge shows "9+" for heavy students.
- The FAQ still has the line "On Pro, practice is unlimited."
- The seat ring was not seen on a device.
- The "Ask Mobi needs 3 taps after refresh" LOW could not be reproduced.

## 4. Next (when he asks)
1. His hand check of v15.2 on the phone; fold his feedback into the ledger.
2. Release 10 LOWs:
   - L2 Razorpay credit-pack refund clawback (needed before commerce opens);
   - L3 the wallet-state cache after an undo;
   - L4 the Pro offer from publicOffer();
   - L7 the NOT VALID split check in the undo.
3. **W-044:** release 10 uses the glass-circle Today cue. He should confirm it on a phone.
4. The taste experiment (D93): the interim call stands (a lighter version: the taste lens inside the one walk and fix pass, a critic only on new features). Tonight's verifier and fix pass found real bugs; no separate critic loop ran.
5. Older items still open: the audit list (D25/W-085, W-033, W-042, D31, W-072/073/077, D9/W-053, M-007, D20, D22, N4) and the Mob LOWs (second-Mob deep link, "same question right" naming, timer re-issue, invite after leave).

## 5. What the owner must do
1. **Razorpay:** wire his keys, run the test-card check in WALLET-RAZORPAY.md section 6 on a preview deploy, then set WALLET_COMMERCE_OPEN=true.
2. **Play Console:**
   - payments profile;
   - the 15% tier;
   - products: pro_cuet_2027 at Rs 150, and credits_10_50 / 29_150 / 49_300 at Rs 15 / 45 / 75;
   - a service account;
   - RTDN through Pub/Sub;
   - licence testers;
   - an internal-testing upload.

   Then set PLAY_BILLING_ENABLED=true on Vercel and build the app with PLAY_BILLING on.
3. **PERSISTENT_LIMITS_ENABLED:** his decision. Recommendation: on, after a login-limit check on staging.
4. **W-044:** confirm or reject the glass-circle cue on Today.

## 6. Commands and facts
- **Flutter:** `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh <args>` from flutter_app.
  - **Never run `flutter test` and `flutter build` at the same moment.** The test run rewrites GeneratedPluginRegistrant with integration_test and the release build then fails (it bit at 12:23 am).
  - Release: `build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`.
- **adb:** it is not on the PATH: `source tool/android_env.sh` first. Phone install: `adb -s 10BF370PA6002XR install -r <apk>` (main session only).
- **Web:** node_modules is a junction to mockmob-hotfix/node_modules (it has no playwright-core; agents used the codex runtime copy). .env.local is PRODUCTION: preview fixtures only.
- **IDs:**
  - Vercel: prj_uSolddribHQDl1mM5AKxg3O9qCIu, team_V5PhMz9hqV42vblUMcvhYqoN.
  - Supabase: production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.
- **Usage:** tonight about 5 Opus fix agents plus 1 integrator plus 1 verifier plus 1 fixer used about 60-70% of a 5-hour window in about 2 hours.

## 7. Rules that bit tonight
- **The 10:30 pm promise was given before the final walk had run.** Never promise a time before the walk's issue count is known (D99).
- **Starting the verifier in parallel with the integrator's suites saved about 40 minutes.** Do that by default: one round plus a fixer, with the main session checking the fixes.
- **Three agents fixed the same broken file (plan_sheet.dart) in parallel.** When a base does not compile, fix it in the base before fanning out.
