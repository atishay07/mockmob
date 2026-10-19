# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 20 Oct 2026, about 2:35 am IST, by session 801f0d1a (Claude Opus 5.5, CEO/CTO). The owner is asleep with FULL AUTONOMY for this session (D156: decide independently, no mock-ups or results to show, deploy when tests pass). His words are verbatim in `docs/brain/OWNER-FEEDBACK-2026-10-19.md` (to D157 and I1-I16, J1-J6). Decisions: `OWNER-MASTER-LEDGER.md` (C-dec 3 and 3b at the end).

## 1. Vision (stable)
CUET UG 2027 prep for 16-17-year-olds. USP: unlimited mocks from one central bank. Score Recovery (find, fix, check the fix holds); Ask Mobi; the Mob. Premium, alive, smart. **The website is the main product** (D157); the app follows. Version 13 is the closed-test first impression for 14-15 testers starting 20 Oct (D155): no bugs, exceed expectations.

## 2. Rules in force
R1-R8 (PLAN-1019 section 0). D150 build-and-look loop (agents capture visuals while building). D156 autonomy for this session. D157: Pro does NOT make Mobi free; credits bought mostly by Pro students; depth over volume; keep AI margins wide. Never sign in from a staging build (C1: it reached production; guard now in ui/v17-bugs). Production writes allowed this session only for the Mob v3 go-live (D152) and what the owner named.

## 3. Live now
- **Web:** main 58793f9c = Play subscriptions LIVE (PLAY_BILLING_ENABLED=true set by him; deploy dpl_F8qxHxpnXyZPqjCEAFrPrBbSnE9L; RTDN works). Production migration 20261019210000 applied 9:51 pm. Licence-tester purchase proven end to end (Pro, 4 renewals, 50-credit pack, refund+revoke). Stray test auth user chai-fresh@example.com deleted (D151).
- **Play Console:** listing uploaded (v11b text option A, feature graphic A, screenshot set 2 from Desktop\MockMob-store-listing\UPLOAD-THIS); internal testing has version 11 (link showed "Item not found": Google propagation; he used other routes); closed testing Alpha has version 11 IN REVIEW. Version 12 built (Desktop\MockMob-build-12) and SKIPPED by him (D154). Pro price shows Rs 150 (he set 150; D136 said 149; his call). Content rating (users interact: yes; purchases: yes) and Data safety (Purchase history) still need his update before Alpha review completes.

## 4. Version 13 in flight (all local, nothing pushed)
**App** base ui/v16-1020 2485e83e (= v12). Branches (each its own worktree wt-1020-*):
- done: ui/v17-bugs 6b659e43 (Ask Mobi ties, API origin guard C1, email App Link /app/login + verifyOTP, G13), ui/v17-mob-switch 449e8fde (MobRead v3Available/serverV3, MOB_V3_ENABLED default on), ui/v17-mob-art 9cc7e7dc (moments order, FINAL FOLDS art: idle/cheer/think, parcel, seal; shrug/wave fall back to idle), ui/v17-mob-den 6ea7f777 (H1/H2/H5/M1 etc.), ui/v17-mob-play e8a0d38e (H4 race, H6 podium, M2, M5), ui/v17-pro-page 6cb1c9d2 (full-screen Pro page /you/pro, owner J1/J2 applied).
- still working: ui/v17-wallet (owner J3: packs as Mobi answers/repairs), ui/v17-finish (SWOT-style paper read = Mobi's debrief + full-mock reveal), ui/v17-mobi + web/v13-mobi (Ask Mobi value per C-dec 3b: Where you stand, Fix it for good, doubt threads, mentor reads colleges).
- **Integrator** (Sonnet) building ui/v17-release in wt-1020-app-rel: merges bugs, mob-switch, mob-art, mob-den, mob-play, pro-page; full tests; demo-mode emulator walk; screenshots tmp/walk-1020/app-v13. Then wallet, finish, mobi to merge.
**Web** base web/1019pm-mob-v3 e2eb2462 (Mob v3 server + live main + v3Available). Branches: web/1020-fixes 55bcbad0 (app sign-in link page, assetlinks from ANDROID_CERT_SHA256, no email-prefix names), web/v13-mob-den 2e3cea79, web/v13-mob-play 8757518d, web/v13-money afea69dd (Pro page + Wallet, J1/J3). **Integrator** (Sonnet) building web/v13-release in wt-1020-web-rel (+ server folds.mjs colours); web/v13-mobi to merge after.

## 5. Next (in order, autonomous)
1. Finish merges (app ui/v17-release, web web/v13-release) incl. wallet, finish, mobi; full suites (app unit ~7k, web test:mob/billing/recovery/auth/app/subjects, next build --webpack).
2. Adversarial review per surface (Mob, money, finish, sign-in), fix wave.
3. GO LIVE (D152): pre-check prod; apply Mob v3 migrations 20261020100000 core, 100100 games, 100200 chains, 100300 realtime (files in wt-1019pm-mobsrv supabase/migrations, undo in supabase/undo); set MOB_V3_ENABLED=true in Vercel Production (MCP create_project_env; if blocked, note for owner); push web/v13-release to origin main (fast-forward from 58793f9c? it is a merge descendant: check `git merge-base --is-ancestor origin/main HEAD`); Vercel check; smoke (/, /mob, /pricing, /wallet, /api/mob 401). STATUS entry with undo.
4. Build version 13: bump to 1.0.16+13 (or 1.0.17+13), `bash tool/build_release_aab.sh --bump --sell` in the release worktree (copy MockMob-keys\key.properties to android\ if missing), APK too, emulator launch check, copy to Desktop\MockMob-build-13.
5. Folds shrug/wave: Codex account 2 resets 5:38 am (account 1 after 2:58 am); commands in tmp/design-1019pm/mob-v3/characters/final/FINAL-ART.md section 6; then `python tool/fold_manifest_final.py` in the app.
6. Morning summary to the owner: what is live, version 13 path, what he must do (upload v13 to closed testing, content rating + data safety, ANDROID_CERT_SHA256 = Play app-signing SHA-256 in Vercel for the email link).
7. Follow-ups: 150 vs 50 welcome credits (his decision); weekly Mob paper answer hold (C-dec 2 item 1); Mob live rooms (Phase B); Ask Mobi remaining capabilities (ASK-MOBI-VALUE.md); golden baseline drift (~110 stale goldens at base).

## 6. Commands and facts
Flutter: `MOCKMOB_FLUTTER_SLOTS=6 bash tool/flutter_locked.sh <args>` (slot max file %TEMP%\mockmob-flutter.lock.max = 6). Emulator lock %TEMP%\mm-emu-lock; AVD mockmob_budget -memory 3072; adb -e only; demo entry test/device_demo/demo_main.dart. Staging rig: 3104 (r11, shim 3114), 3105 (Mob v3 server, shim 3115), seed scripts/mob/seed-v3-staging.mjs (chai-* @example.com). Supabase prod isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu. Vercel prj_uSolddribHQDl1mM5AKxg3O9qCIu / team_V5PhMz9hqV42vblUMcvhYqoN (env listing may be blocked by the permission classifier). Upload key fingerprint SHA-256 62:AC:58:08:...:EC:47. Codex images: account 2 signed in now.
