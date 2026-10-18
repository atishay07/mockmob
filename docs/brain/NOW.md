# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 19 Oct 2026, about 2:10 am IST, by session 604ced81 (main, Claude Opus 5.5, CEO/CTO).
- The owner tested v15.2 and release 10 and was NOT satisfied (G1-G33).
- He asked for planning only tonight (D102): record everything, decide, ask him, and hand off so nothing is unclear.
- Nothing is building now. Every agent is stopped. Staging sites 3101 and 3103 and relay 3102 are left running.

## Read first, completely, in this order
1. `docs/brain/OWNER-FEEDBACK-2026-10-19.md`: his words (verbatim) and the G1-G33 ledger, then his answers D101-D110.
2. **`docs/brain/PLAN-1019.md`: THE PLAN.**
   - Section 0: the rules R1-R8 that stop the loop.
   - Section 1: the decision, SPEC and DONE WHEN for every item.
   - Section 2: the order of work.
   - Section 3: answers to give him.
   - Section 4: the forensics, with the exact shas to restore from.
3. `tmp/feedback-1019/FORENSICS.md`: the evidence behind section 4.
4. The bottom of `OWNER-MASTER-LEDGER.md`: G1-G33 and the earlier D-items.
5. Memory: audience-teens-new-to-cbt (new), device-truth-testing, web-restructure-rejected, orchestrator-thinks-agents-do.

## Live now
- **Web:** www.mockmob.in = main 23a7c090 (release 10, 75ac3f23).
  - It has the one credits balance, the wallet, Pro nudges, the Play server (off), the Today taste fixes and the light attempts list.
  - Production migrations play_purchases, one_credits_balance and attempts_list_summary_fn are applied; STATUS has the md5s.
  - Flags WALLET_COMMERCE_OPEN, PLAY_BILLING_ENABLED and PERSISTENT_LIMITS_ENABLED are all OFF.
- **App:** v15.2 1.0.15+7 (ui/v15.2-1018 ab04b067, wt-v15-2), on his phone (V2413, 10BF370PA6002XR). The APK is at tmp/apk/mockmob-v15.2-ab04b067.apk.

## His decisions tonight (D101-D110), to build exactly
- **D101** Pro-only modes (NTA mode, Smart practice) are VISIBLE but locked in the app while PLAY_BILLING is off: a quiet Pro tag, a calm sheet, no price, no web link. Never hidden.
- **D102** Plan only tonight; a complete handoff.
- **D103** Colleges are ordered by last year's real closing marks for the course and category, with the number shown.
- **D104** Today shows "Your top 3 of N" plus "See all N".
- **D105** The app bar becomes Today, Practice, Start, Mob, You. Review moves into Practice as "Your papers".
- **D106** Your papers: the stats strip, a subject filter, papers newest first (a tap opens the result and answers), then Mistakes to repair by chapter.
- **D107** Web navigation: 2-3 MOCK-UPS for him to pick before anything moves.
- **D108** After Submit (app): restore the approved reveal or finish moment (68f63c11), then a completion line, the count-up and one next move.
- **D109** "I don't know my range": estimate after one full mock per subject of the student's set, with progress per subject; then the range and the colleges it reaches.
- **D110** Ask Mobi ("Ask now" / "Ask your record", big): MOCK-UP first.

## Next session: do this (PLAN-1019 section 2)
1. **Wave A (restore and fix, at once):**
   - A1: app shell and Practice;
   - A2: app Today, deck and onboarding;
   - A3: app result and Review;
   - A4: web restore (gradients, motion, Review, sign out, scroll cue);
   - A5: "I don't know my range".

   One owner per surface (R7). Every agent brief includes R1-R8 and the item specs word for word.
2. **Wave B (mock-ups, in parallel):** web navigation (2-3 options), Ask Mobi (2-3 options), homepage text motion. Send them to him; he picks; then Wave C builds.
3. **Checks:**
   - Fresh-account walk AND heavy-account walk (R1).
   - The 17-year-old note per screen (R2).
   - Regression side-by-side against the previous release (R4).
   - Motion frame sequences (R5).
   - One Opus verifier (2 rounds at most).
4. **Ship:** app v15.3 (APK, then install when he connects) and web release 11 (push, then STATUS).
5. **ONE message,** ending with "Things needed from you right now" or "Nothing needed from your side".

## Still open from before (not tonight's focus)
- **Release 10 LOWs:**
  - L2 Razorpay credit-pack refund clawback (needed before commerce opens);
  - L3 the wallet-state cache after an undo;
  - L4 the Pro offer from publicOffer();
  - L7 the NOT VALID split check in the undo.
- **His steps:** the Razorpay test-card run, then WALLET_COMMERCE_OPEN; the Play Console setup, then PLAY_BILLING_ENABLED; the PERSISTENT_LIMITS_ENABLED decision; W-044 (the glass-circle cue).
- **G26:** ask him which screen shows "5 questions ... Biology" on top. It may be the Practice session card's second line (58e05acb).

## Commands and facts
- **Flutter:** `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh <args>` from flutter_app.
  - NEVER run `flutter test` and `flutter build` at the same moment: the test run rewrites GeneratedPluginRegistrant and the build fails.
  - Release: `build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`.
  - adb: `source tool/android_env.sh` first; `adb -s 10BF370PA6002XR install -r <apk>` (main session only).
- **Emulator:** AVD mockmob_budget, `-memory 3072 -no-snapshot-save`, `adb -e`. Staging rig: tmp/rig-1016e/RIG-READY.md (3101 old rig, 3103 = release 9 + the Mob).
- **Web:** node_modules is a junction to mockmob-hotfix/node_modules (no playwright-core there; agents used the codex runtime copy). .env.local = PRODUCTION: preview fixtures only.
- **IDs:**
  - Vercel: prj_uSolddribHQDl1mM5AKxg3O9qCIu, team_V5PhMz9hqV42vblUMcvhYqoN.
  - Supabase: production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.
- **Rules:**
  - Headless only; never sign in as him.
  - Only gpt-6-luna and Claude Haiku 5.5 at runtime.
  - Production DB under his grant: save, dry-run on staging, undo, STATUS.
  - Check usage before waves; STOP POINTs at 95%.
  - Record his words verbatim in the same hour.
  - Opus for taste, numbers and money; Sonnet otherwise.

## Lessons from 18-19 Oct (keep)
- Never promise a time before the walk's issue count is known (D99).
- Start the verifier in parallel with the integrator's suites. One round plus a fixer, with the main session checking the fixes.
- When a base does not compile, fix it in the base before fanning out (three agents fixed plan_sheet.dart in parallel).
- A walk on a seeded account missed the fresh-account gaps. Fresh account first (R1).
