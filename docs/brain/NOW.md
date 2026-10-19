# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 19 Oct 2026, about 3 pm IST, by session 3e452b10 (Claude Opus 5.5, CEO/CTO, a FRESH session per the owner's 12 pm instruction). The owner is attended. His one message is `docs/brain/MESSAGE-1019.md`.

## 1. The vision (stable)
- **MockMob:** prep for CUET UG 2027, Commerce first. The USP: **unlimited mocks from one central bank**. Score Recovery (find, repair, check each mistake), Ask Mobi, the Mob (friends sit the same weekly paper). One credits balance (50 free a month plus packs); Pro is Rs 99 on the web and Rs 150 on Play; per-question prices.
- **Users (G23):** 16-17-year-olds, many new to apps and CBT. A fresh account must be complete without Pro or payment. Nothing is hidden.
- **Taste:** premium and alive (HIGH, Revolut, Fampay), Mobi alive, refined motion; refine, never rebuild; Night stays subtle; mock-ups before new layouts; **the marketing copy matters most (D114)**.

## 2. The rules (PLAN-1019 section 0; every brief carries them)
R1 fresh account first; R2 the 17-year-old line on every screen; R3 never hide to fix; R4 a side by side against the previous release; R5 motion as frame sequences; R6 copy in his voice; R7 one owner per surface, early merges by the main session; R8 mock-ups first.
**Cost rule (D118, 4e of the old NOW):** never continue a long conversation (Autopilot "Continue a session" or a 600k+ context) for real work; start a FRESH session from files. A fresh session finished release 11 and v15.3 today on about 30 points of one 5-hour window.

## 3. Decisions (his words verbatim in OWNER-FEEDBACK-2026-10-19.md)
- D101 Pro-only modes visible but locked while PLAY_BILLING is off. D103 colleges by real closing marks with the number. D104 "Your top 3 of N" + "See all N". D105 app bar Today, Practice, Start, Mob, You. D106 Practice > Your papers. D108 the moment after Submit. D109 "I don't know my range". D111/D112 deliver beyond expectation; designer's pick when he is away. D114 picks: web nav A, Ask Mobi B, hero C, copy matters most. D115 push release 11 after its verifier. D118 explain the Autopilot spike (in MESSAGE-1019).
- **D119 (1:50 pm):** hero too slow, something new every 2-3 s; try last year's "top 1%" melt. **D120 (2:30 pm):** he chose the faster typing hero (v2): published for everyone; install v15.3 on his phone.
- **C-dec 1 (CTO):** every student's first full mock in each subject is free (one per subject, ever). Kill switch FIRST_FULL_MOCK_ENABLED=false.

## 4. Where everything stands (19 Oct about 3 pm)
**Web: LIVE.** Release 11 on www.mockmob.in since 1:44 pm (main a0eb6abe), STATUS bbb676c5, hero previews 37935066, **hero v2 ON for everyone 9fd48201** (HERO_MOTION_V2_DEFAULT = true; HERO_MOTION_V2=0 brings back the old line). Rollback point: Vercel dpl_4EH82tptRMfagc6npWiwBSFeLbQh (release 10). No migration; no env change. Verifier round 1 GO; round 2 part A GO, part B NO-GO (badge, Free-ask charge) fixed by fixer D; main session restored the credit tick and caught a creditCount() shadowing bug before the push. Suites at a0eb6abe all green except test:study's wordnet licence gap (environment, also on release 10). Production smoke: every key page 200, no runtime errors.
- Integration branch `deploy/web-1019-r11` in wt-rel11 == main 4af47969 (9fd48201 + the STATUS entry).
- ?hero=v3 (last year's melt) still works as a preview; not chosen.

**App: v15.3.** Integration `ui/v15.3-1019` in wt-v15-3.
- **On his phone:** build 8 (1.0.15+8, 818f594b), installed 2:45 pm (`tmp/apk/mockmob-v15.3-818f594b.apk`). It lacks the walk fixes.
- **Final candidate:** build 9 (1.0.15+9, **4472b373**) = 818f594b + the acceptance walk fixes (ui/v153-walkfix 8d40d48a): H1 Join-with-a-code keyboard, the Repair Qn key restored (R4), M2 NTA Pro tag per subject, M5 accept move without page scroll, M1 Welcome bubble, M6 no email-prefix names, M3 result Try again restarts the read, LOWs. Release APK `tmp/apk/mockmob-v15.3-4472b373.apk` (39.8 MB) + zip + symbols; full unit run **6,672 passed, 0 failed** (`C:\Users\atish\Desktop\mockmob copy\v153-final-unit-4472b373.log`). **Install it the next time he connects:** `adb -s 10BF370PA6002XR install -r <apk>` (main session only).
- Walk report: `tmp/walk-1019/APP-ACCEPTANCE-V153.md` (G1-G23 scoreboard, R2 lines, defects). NOT walked on a device yet: build 9's fixes, a full mock's sealed sheet and reveal, the range estimate end to end (G19), G13 frames after the fix.
- Ask Mobi's credits footer is a fifth of a 360x640 screen (M4): nothing overlaps; a slimmer footer needs a mock-up first (R8).

**Staging:** 3101/3102/3103/3104 servers run; 3104 = release 11 at 3ae564a6. **The staging Supabase (onwkqxmjqjrhfbjjdydu) refuses SQL connections since about 1:45 pm** (connection timeout) while reporting ACTIVE_HEALTHY: check it first; the device walk needs it. OTP shim: `tmp/rig-1016e/otp-shim.mjs` (SHIM_TARGET=3104 SHIM_PORT=3114). After any emulator use restore `adb -e reverse tcp:3101 tcp:3101` (the walker could not).

## 5. Next (in order)
**NEW (3:15 pm): his feedback on build 8 (H1-H12, verbatim in OWNER-FEEDBACK-2026-10-19.md) is planned in `docs/brain/PLAN-1019-PM.md`: A Play billing (his priority 1), B the Mob 10/10 with mock-ups first, C Practice/Colleges/daily goal. The next FRESH session starts from `docs/brain/NEXT-PROMPT-1019-PM.md` and that plan (his answers to the six questions are in it, D121). Do not start sessions or waves on an account short of usage; he decides when.** A billing session was started by mistake at 3:14 pm and stopped within a minute (it changed nothing; check `git status` in wt-v15-3 and wt-rel11).

1. When he connects: install build 9 (4472b373) and confirm versionCode 9.
2. When staging answers: one emulator session on build 9: H1 join sheet, Repair Qn, NTA tag across subjects, accept frames (G13), a full mock's sealed sheet and reveal (G22), "I don't know my range" estimate (G19), Compass 900-920, a fresh first full mock free with the balance unchanged.
3. Ask Mobi footer mock-up (2 options at 360 dp) for him.
4. Known LOWs: durable-sessions free race (fix before LEARNING_SESSIONS_ENABLED); Colleges' two lit cards; test:study wordnet licence in a clean install.
5. Older, his: Razorpay test-card run -> WALLET_COMMERCE_OPEN; Play Console -> PLAY_BILLING_ENABLED; PERSISTENT_LIMITS_ENABLED; staging RESEND_API_KEY; delete ~5 GB of agent scratch (C: ~93 GB free).

## 6. Commands and facts
- Common brief: docs/brain/BRIEF-1019-COMMON.md (now includes the junction-safe worktree removal rule: `cmd /c rmdir <wt>\node_modules` FIRST).
- Flutter: `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh <args>`; release build `build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`; never flutter test and build in one worktree at once (use two worktrees at the same sha).
- Web: node_modules is a junction to mockmob-next\node_modules, installed today from release 11's lockfile (`npm ci --prefer-offline`; restore recipe in memory agent-swarm-resource-hygiene). Preview pages (/preview/...) exist only under `next dev`. Headless Chrome via playwright-core with `channel: 'chrome'`.
- IDs: Vercel prj_uSolddribHQDl1mM5AKxg3O9qCIu, team_V5PhMz9hqV42vblUMcvhYqoN. Supabase production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.
- Practice on the web is /dashboard; the account page is /profile (/practice and /account never existed).

## 7. Lessons from today
- A fresh session from files is enough; keep the main context lean and agents on Sonnet unless taste or money needs Opus.
- The shared node_modules was wiped a third time by a worktree removal following its junction; the rule is now in the common brief.
- Tests missed a variable shadowing an imported function (creditCount); a real render in a dev server and reading the diff caught it. Render-check every component change before a push.
- A verifier's own suggestion (the "8 to revise" badge) broke the layout: measure any copy change that widens a nav element.
