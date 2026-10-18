# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 3:35 pm IST, by session 25ef3d95 (main, Claude Opus 5.5, CEO/CTO). The owner said "stop and prepare the handoff" with usage at 97% (it resets at about 4:10 pm).
- **Every workflow is stopped.**
- **Every worktree is committed.** The only partial work is the STOP POINT 77d51ba8 in wt-v15.
- **Reaped:** Flutter, Gradle, adb, the emulator and stray dev servers.
- **Left running on purpose:** staging site 3101, relay 3102, and the owner's release 8 preview on 3208.

**Read next, in this order:**
1. This file, completely.
2. `OWNER-MASTER-LEDGER.md`, newest sections at the bottom: D40-D62, the D50-D54 decisions, and the status at 3:35 pm.
3. `OWNER-FEEDBACK-2026-10-18-DAWN.md`: his own words, D1-D62. The last 4 sections are from today, 11:20 am to 12:50 pm.
4. `docs/design-decisions/pass-1018/TODAY-SWIPE-1018.md`: the approved D51 and D52 design.
5. The saved agent reports in `mockmob-next/tmp/resume-1018-1530/*-results.json`: one file per workflow, with every agent's full return.

> **INTERIM UPDATE, 18 Oct about 6:35 pm IST (session 604ced81; owner back since 6:10 pm; target: everything by 10:30 pm, D74).**
> **Owner asks since 4 pm:** D64-D74 in OWNER-FEEDBACK-2026-10-18-DAWN.md (end) and the ledger (bottom): skip W-099/W-046; credits per question; the Mob ON and tested; ship the final app + Mob + website; Play billing at Rs 149 on Play (Rs 99 web); 10:30 pm.
> **LIVE:** release 8 (main 00328e54 + STATUS eb5185ef).
> **Production DB, applied ahead of the R9 code (evidence in scratchpad status-r9-migrations.md; copy into the R9 STATUS):**
> - free_ai_wallet_50 (3:47 pm).
> - practice_credit_per_question (about 6:22 pm; spend_credits md5 911105fd; old actions unchanged).
> - 20261017100000_mob + 20261017190000_mob_fix_1017 (about 6:29 pm; 26 functions equal to staging; 15 tables RLS on; server-only).
> - The Mob is still invisible: MOB_ENABLED is not set on Vercel.
> **Website release 9:** wt-rel9 (deploy/web-1018-r9).
> - Part A at 5d9116f0 = perq + 4 audit-fix packets + leftovers.
> - Verify round 1 NO-GO on 2 MEDIUM (a free set priced "10 credits"; a /pricing FAQ "Rs 99 a month"). Fix round + re-verify running: workflow wf_7951d194-584.
> - NEXT: merge web/r9-mob-1018 (186bbb1b) into wt-rel9, but RESTORE data/evidence_registry.js to 00328e54 (the Mob branch carries a rig-only process.cwd() hack: verifier HIGH). Then run the suites and a focused verify. Then: Vercel env MOB_ENABLED=true (Production; leave PERSISTENT_LIMITS_ENABLED unset: it moves login limits too, a separate deliberate step). Then push wt-rel9 to main (fast-forward from 00328e54), check Vercel, smoke test, write STATUS (R9 + migrations).
> **Final app:** wt-v15-1 (ui/v15.1-1018) at ab8db172 = 1.0.15+6 (v15 walk fixes + per-question price display + richer Today + swipe stack; 6007 unit, 1675 goldens).
> - Walk r1 NO-GO: HIGH = "How many questions?" dead when the lead came from the Suggested stack; MEDIUM = the could-not-refresh line wraps at 360, Ask Mobi's cold first answer waits 20 s then says offline, Today's failure title is cut at 360.
> - Fix round + walk r2 + release APK: workflow wf_42449aec-c78.
> - THEN a short Mob + per-question walk against the staging site on 3103 (wt-rig-r9 d0d6d0fe = R9 + Mob with MOB_ENABLED=true; set `adb -e reverse tcp:3101 tcp:3103`, then restore `tcp:3101 tcp:3101`).
> - Then install on his phone (adb -s 10BF370PA6002XR install -r) and send.
> **Play billing (D73):** agents are running.
> - Server: wt-play-server, web/play-billing-1018 (verify + RTDN + play_purchases migration, flag PLAY_BILLING_ENABLED).
> - App: wt-play-app, ui/play-billing-1018 from ab8db172 (in_app_purchase, Get Pro sheet, flag PLAY_BILLING).
> - Then: an Opus check, a v15.2 merge (on top of the walked final app) and its APK; docs/brain/PLAY-BILLING-PLAN-1018.md for his Play Console steps.
> **Added 6:40-7:00 pm (owner D75-D81; all in the ledger):** Pro on Play Rs 150 FINAL; ONE credits balance; Pro nudges; first-session Upgrade pop-up. Agents running (Agent tool, background; each commits in its own worktree):
> - web/credits-core-1018 (wt-credits-core, Opus): one balance + one spend order + migration 20261018210000_one_credits_balance (staging only) + packs credits_10_50/29_150/49_300.
> - web/wallet-1018 (wt-wallet-web): /wallet + /api/wallet + order/verify behind WALLET_COMMERCE_OPEN + docs/brain/WALLET-RAZORPAY.md (the owner wires Razorpay himself today).
> - web/pro-nudge-1018 (wt-pro-nudge, Opus): nudges, the Upgrade sheet on Pro-feature taps, the first-session pop-up.
> - ui/play-billing-1018 (wt-play-app): billing + Get Pro sheet + one-balance wallet screen.
> - ui/pro-nudge-1018 (wt-pro-nudge-app): app nudges + first-session pop-up (only with PLAY_BILLING on: the store rule).
> - web/play-billing-1018 (wt-play-server): DONE ba5eef6e (46 tests; map being moved to the one-credits packs); plan docs/brain/PLAY-BILLING-PLAN-1018.md.
> - Release 10 = R9 + credits core + wallet + nudges + play server: integrate, verify, apply 20261018190000_play_purchases and 20261018210000_one_credits_balance on production (pre/post md5 checks, undo), push. Then a v15.2 app = final app + play-app + pro-nudge-app.
> **Usage:** 81% at 6:57 pm; the owner was asked to switch accounts now.

## 1. The goal (owner, D39 at 9:15 am, then D59 and D62)
The Play Store is parked.
- **App: the FINAL v15, complete.** That means:
  - every item of the "Not done yet" list;
  - his 12:15 pm phone feedback, D40-D57;
  - D50 and D54;
  - walked on the emulator, and a release APK delivered AND installed on his phone.
- **App v15.1:** the richer Today (D52) and the Suggested swipe stack (D51), which he approved at 12:50 pm.
- **Website:** "perfected", meaning release 8 live after his live look (D30).
- **Then ONE message:** when everything is shipped and checked, send him one message with the links, the APKs and where to look (D37). End every update with "Things needed from you right now:" or "Nothing needed from your side" (M-018).
- **Time:** at 12:30 pm he wanted the final app "in the next 1 to 2 hours". It is late, so move fast, but never skip the walk. That is his own device-truth rule.

## 2. Live now
- **www.mockmob.in = main fc9e1f6b = release 7.**
  - It contains the new Today, Road to CUET, and the Change plan receipt fixes (H1, M1-M3, M5-M7, L4, L5).
  - It was pushed at about 1:10 pm after an independent verifier said GO.
  - Vercel deployment dpl_FYgR76nTTSeX5uV4ShJed1u1Rq5A is READY, with 0 runtime errors at 1:20 pm.
  - STATUS.md for release 7 is NOT written yet. Write it together with release 8: wt-rel8 already has a release 8 STATUS section, so add release 7 there.
- **Production database:** unchanged today. The credits migration is NOT applied (see 3B).
- **His phone:**
  - A V2413 with adb serial **10BF370PA6002XR**.
  - It has v15 79aaca6d (1.0.15+3), debug-signed, so `adb -s 10BF370PA6002XR install -r <apk>` updates it.
  - Ask him to plug it in (USB debugging on) when an APK is ready.
  - Agents must NEVER touch it: emulator only, with `adb -e`.

## 3. Exactly where each track stopped

### A. FINAL v15: walk said NO-GO on 1 HIGH; the fixer was stopped mid-work
Worktree wt-v15, branch ui/v15-1018.

**Head:** 77d51ba8, a STOP POINT holding 12 files of partial, unchecked walk fixes. It sits on top of **628f3612** (1.0.15+4).

**What 628f3612 holds:** the walked v15 79aaca6d, plus every packet, merged by the integrator:

| Packet | What it carries |
|---|---|
| review | D18 |
| polish2 | polish round 2 |
| icons | D8, D57 (visible bar glass), D56 (Start key restored) |
| asks | M-001, M-002, M-003 |
| mob | the Mob, behind its flag |
| learn | P-LR5 and P-LR6 |
| onboard-a | D40, D43, D44, D48 |
| onboard-b | D41, D42, D45, D46, D47, D49 |
| askinstant | D53 |
| ledger | D55 fixes, including the M-007 DU verifier and M-005 dots |
| credits | D54 app copy (06b6af85) |
| length | D50 (959ba329) |

Integrator results: analyze clean, **5899 unit tests and 1607 goldens pass**.

**Walk results.** Screenshots are in `mockmob-next/tmp/app-walk-1018c`; the full JSON is in `tmp/resume-1018-1530/v15-final-1218-results.json`.
- **PASS:** D40, D41, D42, D43, D44-D48, D45, D46, D47, D50, D53, D57, D56, D8, M-001, M-002, Revise, Mob-off, and the WALK-1018b items.
- **HIGH, the one blocker:** Review > More chapters prints impossible numbers, for example "Lost 316 of the 310 marks on offer".
  - Why: marks lost counts 6 per wrong answer (the +5 forfeited plus the -1 penalty), but "on offer" counts 5 per question.
  - Fix: use "on offer + wrong answers" as the denominator, or drop "of N".
- **MEDIUM:**
  - (a) At 360 dp the Review offline line wraps to 2 lines and the hero jumps about 26 px. It also only appears after a failed pull, not when the radio drops.
  - (b) The onboarding "Add a subject" helper text wraps onto the card's bottom border and looks clipped.
  - (c) Today kept saying "Offline" for over 1 minute after reconnecting, when the drop happened on the Review tab.
  - (d) D49 default-on is proven by test only: the staging test account had withdrawn consent.
  - (e) M-003 (NTA is Pro-only) and the Learn concept cards (the staging catalog is off) were not exercised on the device. Tests cover them.

The STOP POINT 77d51ba8 holds the fixer's partial work on the HIGH and the mediums: the review_chapters model and its tests, the offline line, the subjects-step helper, and a reconnect refresh test. **It is unchecked.**

**NEXT:**
1. Finish or verify the fixes in 77d51ba8.
2. Run analyze, plus the review, today and onboarding unit tests and goldens.
3. Re-check only those items on the emulator.
4. Build the release APK.
5. Install it on his phone and send it.

The early release APK `tmp/apk/mockmob-v15-final-628f3612.apk` is NOT deliverable, because it carries the HIGH. Do not send it.

### B. Website release 8: RE-VERIFIED GO, waiting for his live look
Worktree wt-rel8, branch deploy/web-1018-r8, head **00328e54**.

**What it holds,** merged on top of release 7 (fc9e1f6b):

| Branch | Head | What it carries |
|---|---|---|
| r8-fixes | cb672f6b | W-078 (/mentor Day contrast), W-075 (dock Start goes quiet), W-079 (44 px targets), W-093 (Help count), W-089 (notes), D53 (the quiet AI line) |
| r8-adopt | dfc6797e | W-064: the first-week path and the repair receipt |
| r8-retry | f9fa1d82 | W-032: sealed mistake rows, with Try it again and Show the answer before the key |
| land3 | 42b51dd3 | the D38 hero |
| credits50 | d8bc38d8 | D54: Free AI wallet of 50 a month |

**Fixed after the first verify:**
- The desktop hero Mobi flashed over the headline. That flash is live today too.
- The Review row's Repair now goes through the sealed sheet.
- The Lab Cinema glow is removed (L-019).
- The hero buttons now show at 768 (L-013).

**Results:** test:app 653, today 87, recovery 586 (0 fail), learning 357, billing 161; the build is OK. The database verifier said GO.

**Owner preview, running:** http://192.168.1.8:3208 (LAN) or http://localhost:3208. It is launch.json "rel8-1018", served by session 604ced81's `scratchpad/devserve.mjs`. **He was asked "Ship release 8?" at about 2:30 pm and has NOT answered.**

**On his "ship it":**
1. **Apply the credits migration on production FIRST,** under his standing grant: Supabase MCP apply_migration, project isrxrxzjocewrdureyhp, file `supabase/migrations/20261018130000_free_ai_wallet_50.sql` in wt-rel8.
   - **Pre-check:** the student_user_free cap reads 0.0114, and the two functions' md5 hashes match the undo file.
   - **Post-check:** the cap reads 0.0284, and a dry spend works.
   - **Undo:** `supabase/undo/20261018130000_free_ai_wallet_50.undo.sql`.
2. Push: `git -C wt-rel8 push origin 00328e54:refs/heads/main`. It is a fast-forward from fc9e1f6b.
3. Check Vercel: READY, with no runtime errors.
4. Write STATUS for releases 7 and 8 and the migration, and push it.

**Order safety:** the code works with the old database, but "50 on Free" stays false until the migration is in.

### C. App v15.1: integrated, but on the wrong base
Worktree wt-v15-1, branch ui/v15.1-1018, head **88cc6c5d** (1.0.15+5).

**Built and critic-checked:**
- **D52** (ui/v15-today-rich, 98b7d3c2): Mobi in the header, The weeks ahead, Your marks, and the Weak chapters bars. Two Opus critic rounds, both fixed.
- **D51** (ui/v15-swipe, 426366c1): the Suggested stack. Swiping right makes the card the lead; it never starts a session or spends credits. Two Opus critic rounds, both fixed.

**The wrong base:** it was integrated on 628f3612, NOT on the walk-fixed v15, because the wait step saw the early APK. The merges and goldens are done: a3cc6ed8, f6aae99a, 24a01f0c and 88cc6c5d. Its full suites were not confirmed.

**NEXT, after A is fixed:**
1. In wt-v15-1, merge the fixed ui/v15-1018.
2. Run the full unit suite and goldens.
3. Walk it on the emulator, with screenshots in tmp/app-walk-1018d:
   - Mobi in the header;
   - The weeks ahead: real dates, with "suggested" and "expected";
   - the marks trend;
   - the weak-chapter bars;
   - the stack: right makes the lead without spending, left skips, tap works, the buttons work, vertical scrolling never swipes, the hint shows only twice, and the end card shows.
4. Fix what the walk finds.
5. Build the release APK as `tmp/apk/mockmob-v15.1-<sha>.apk`.
6. Install it on his phone.

## 4. Owner decisions
**Waiting:** "Ship release 8?", asked at about 2:30 pm.

**Decided today:**
- **D54:** 50 free AI credits a month.
- **D50:** "How many questions?" offers 5, 10, 15, 20 and a full mock. Day one reads "Start with <the first two chapters of the planner order>". The repo has no marks-per-chapter data, so it makes no marks claim.
- **D51 and D52:** build them as v15.1.
- **D45:** up to 3 picks.
- **D46:** keep 10/20/30, plus a line about full mocks.
- **D49:** usage data on by default for adults only. **Tell him** that India's DPDP Act treats a pre-ticked box as weak consent.

**A correction already made:** I once told him "AI stays inside a USD 25 monthly cap". That was wrong, and I corrected it in chat. The global ceiling row has been 1000000 since 17 Oct. Per-student caps apply: Free will be Rs 2.50 a month, Pro Rs 5.

**Still open, older:**
- W-099;
- W-046;
- the flat 10-credit practice line;
- the Mob switch-on (needs a staging re-gate; wt-mobfix e89d4a35);
- Play Console (parked).

## 5. Plan for the next session
In order; run steps in parallel where they are independent.
1. Call continuum_start and check usage. If he has not answered, ask "Ship release 8?". On yes, do 3B.
2. **Final v15, about 45-60 minutes:**
   - One Sonnet fixer at high effort, in wt-v15 from 77d51ba8, for the HIGH and mediums (a) to (c).
   - Then analyze, plus the targeted tests and goldens.
   - Then a short emulator re-check. The rig is in `tmp/rig-1016e/RIG-READY.md`: AVD mockmob_budget with -memory 3072, and adb -e.
   - Then the release APK. Install it on his phone.
3. **v15.1, about 1.5 hours after step 2:** merge the fixed v15 into wt-v15-1, run the full suites, walk, fix, build the release, and install it.
4. **The ONE final message:**
   - mockmob.in with release 8;
   - the v15 and v15.1 APKs, as zips sent with SendUserFile;
   - where to look;
   - the D49 note;
   - "Things needed from you right now".
5. Then the remaining ledger items, from his newest words.

## 6. Commands and facts
**Flutter:**
- Always run `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh <args>` from flutter_app.
- Unit tests use `-j 3`. Run `gradlew --stop` after builds.
- dart_defines are in `mockmob-next/flutter_app/dart_defines` (prod.json, phone-relay.json). Copy them; never commit them.
- **Release build:** `build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`. It takes about 6 minutes when the PC is quiet.
- There is no key.properties, so builds are debug-signed. They match the APK on his phone.
- Read the version with `<sdk>/build-tools/*/aapt.exe dump badging`.

**Web:**
- node_modules is a junction to mockmob-hotfix/node_modules. Unlink it with `cmd /c rmdir` before removing a worktree.
- .env.local comes from wt-batch2.
- Dev server: `NODE_OPTIONS=--max-old-space-size=4096 npx next dev --webpack`.
- Headless playwright-core lives at `C:\Users\atish\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright-core`.

**IDs:**
- Vercel: project prj_uSolddribHQDl1mM5AKxg3O9qCIu, team team_V5PhMz9hqV42vblUMcvhYqoN.
- Supabase: production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.

**Process:**
- The main session pushes. The classifier blocks pushes from subagents.
- **Machine:** 32 GB RAM and 16 threads. **The CPU is the ceiling:** with 17 agents it sat at 100%.
- **Usage:** about 35% an hour with 15 or more agents. Check usage before every wave, and stop at about 95% with STOP POINTs.
- **Git paths:** `git -C <wt> worktree add <relative path>` resolves the path inside <wt>. Always use ABSOLUTE paths.
- **Network drops:** a drop kills every agent at once, as at 11:40 am today. Agents commit as they go. Relaunch from the worktrees, check git status first, and reap dead dev servers.
- **Today's workflow scripts:** in `~/.claude/projects/C--Users-atish-Desktop-mockmob-copy*/25ef3d95-*/workflows/scripts/` (v15-final-1218, v15-1-today-swipe, web-r8-1018, credits-*, d50-length-1018). A new session cannot resume them by run ID; write fresh briefs from this file.

## 7. Rules that bit today
- **Stopping a workflow kills its running agents.** Make sure they have committed first.
- **A "wait for X" step must check the right thing.** The v15.1 wait matched my early APK file name, so it integrated on the pre-fix head. Use a unique marker.
- **Briefs must state facts, not stale beliefs.** One brief claimed a USD 25 cap, and the agent caught it.
- **Onboarding goldens changed:** the v15 integrator regenerated 92 onboarding goldens. The walk still passed onboarding visually.
