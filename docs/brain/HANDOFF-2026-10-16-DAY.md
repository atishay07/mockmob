# Handoff, 16 Oct 2026 about 12:30 IST (session 604ced81, Claude Opus 5.5 as CEO/CTO)

Read this whole file first, then CTO-LOOP.md, APP-OWNER-LEDGER-2026-10-16.md, and the memory index. Newest owner words win. Nothing here authorizes a push the gates below do not allow.

## 0. The owner's standing rules (his words and decisions, still in force)

**Role, pace and honesty:**
- Act as CEO and CTO. Keep looping with many parallel agents. He measures pace and expects 15-20 agents in parallel when usage allows.
- Give honest percentages. Never repeat an estimate without new evidence.
- Stop at about 95% usage with a handoff like this one.

**Routing** (memory subagent-model-choice):
- Sonnet does the heavy lifting.
- Opus only for complex UI/UX, motion and polish.
- Haiku only for quick, bounded tasks.
- Always set effort explicitly.

**Design:**
- Design agents load these skills: ui-ux-standards, impeccable, frontend-design, emil-design-eng, high-end-visual-design, redesign-existing-projects and design-taste-frontend.
- They follow his research brain: `docs/research/premium-ux-ui-2026-10/AGENT_RULES.md`. Cite evidence IDs, run the 12-part anti-slop test and the 0/1/2 rubric, and write a DESIGN_DECISIONS note per feature.
- Banned: eyebrow pills or dots, glow, gradient text, icon grids, nested cards, arrows on buttons, ALL-CAPS labels, hype copy.
- Mobi appears at most once per screen, and only at a real moment.
- Never simplify by cutting features; he calls that a regression.

**Deploy gates:**
- **Website:** every deploy needs the suites plus a visual critique at 390 and 1440, Night and Day, and an independent verifier pass.
- **Landing:** needs the owner's own look on a local server before launch.
- **App:** NEW RULE from today (memory device-truth-testing). App work is done only after an emulator walk with screenshots against the owner ledger: the upgrade path, keyboard open, scrolling, Night and Day. Goldens alone are never enough. This failure is why his v5/v6 issues survived to v10.

**Security and access:**
- Never drive his browser. Never sign in as him. Never create accounts.
- Use his phone (adb serial 10BF370PA6002XR) only when he says it is connected.
- The emulator gets at most 3 GB RAM. Agents use the project test account `app-e2e-student@example.com` on the local staging site only.

**Database:**
- Production DB work is allowed under his standing grant (14 Oct): save the migration, dry-run on staging, keep an undo file, add a STATUS.md entry.
- He gave a standing OK to hotfix crucial security issues.

**Focus:**
- Product only; marketing waits until January.
- Landing is mobile-first. The arena is desktop-first but must work on phones. The app is mobile only.

## 1. What is live in production now

- **mockmob.in = main 4db57fc5:**
  - Vercel READY, 0 runtime errors after deploy (dpl_DWnHXg8zQArzfPeEK533NjPiQMrT).
  - Batch 1 (09421b29):
    - Mistake Lab slice 4 web: trap tags, Traps you meet, Revise / Same mistakes later;
    - My colleges, Mobi rig v2 web, crash reports, names, Learn concept checks;
    - the arena de-slop;
    - fixes for 78 gate defects.
  - Batch 2 (4db57fc5):
    - Mistake Repair v4: Check it held (a fresh never-seen question, server-marked, no extra credit, first answer counts), "Ask Mobi about Qn" with its cost shown first, the Revise hand-off;
    - the older-paper Lab line, marked-for-review in the SWOT and plan;
    - the practice-progress chunking fix (Accountancy history above about 700 ids was silently ignored);
    - nta_question_index upkeep code, inert without the key and table;
    - the Rs 99 monthly switch, inert until `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` is set, with honest pricing copy ("one payment of ₹99, not a subscription");
    - the Pro modal moved above the app chrome.
  - vercel.json now has 2 crons. The nightly index rebuild rides on /api/internal/refresh-inventory.
- **Production DB isrxrxzjocewrdureyhp, applied today under the grant, logged in STATUS.md with undo files:**
  - trap_atlas, revise_cards, my_colleges, app_errors, funnel_daily: all RLS on, service role only.
  - question_option_stats with refresh_question_option_stats v2 (slice 5). The v1 refresh timed out; v2 rebuilt the table in 13 s: 461 questions, 13,877 first answers, 0 timed answers so far, so every cohort-time line stays hidden by design. The nightly pass that keeps it fresh ships with batch 3.
- **NOT verified live:** Check it held, the receipt->check and receipt->offered PostgREST claims. Agents cannot sign in. The owner will take a fresh timed mock and do one repair. Watch Vercel runtime errors on /api/recovery/check after he does.

## 2. Work in flight at handoff (workflows die with this session; check each)

| What | Where (worktree, branch) | State at handoff | How to continue |
|---|---|---|---|
| **App owner-ledger build** (the main job) | `wt-owner`, `ui/owner-1016` (from ui/phase2 fd0da7d3) | Workflow wf_bdae83cd-a43: 8 builders were running in parallel (shell/bar plus 7 areas). Next stages: integrate, then emulator walk of L01-L39, then fix, then re-walk, then the release v12 APK | Check `git -C wt-owner log` and `status`; see which areas committed. The script is `C:\Users\atish\.claude\projects\C--Users-atish-Desktop-mockmob-copy-wt-owner\604ced81-3aa7-4deb-b42c-f324ca5f51e2\workflows\scripts\app-owner-build-1016-wf_14d6c73f-9d4.js` (keep LF line endings or the Workflow tool refuses it). Re-run only the missing area builders (each prompt is in the script), then the Integrate, Walk, Fix and Release stages |
| **Website batch 3 gate** | `wt-polish`, `deploy/batch-1016c` (main 09421b29 plus slice 5 b9aea401, refresh v2 e1c6ec1a, W1 Mobi moments web, W2 arena pass 2 d8f8d50a, STATUS 7a4fe44e/9b52448d) | Workflow wf_39d20212-193 web half: critics were running, then fixer-c (Opus), then verifier-c | Batch 3 branched from 09421b29, but main is now 4db57fc5. **Merge origin/main into deploy/batch-1016c first.** Known conflict: `src/app/api/internal/refresh-inventory/route.js`; keep both passes, NTA index first, then cohort stats. Then suites, `npx next build --webpack` and the visual gate (or the verifier's verdict if it finished), then push to main and verify Vercel |
| **APK v11** (intermediate) | `wt-phase2` ui/phase2 → `mockmob-next` feat/app-and-web | A4 agent in wf_39d20212-193: full tests, version bump, merge, release build to `mockmob-next/tmp/apk/mockmob-v11-*.apk` | If built, send it to the owner as "intermediate". v12 is the real target |
| **Landing** | `wt-land2`, `web/land2-1015` (HEAD ccf285c3 plus round-7 fixes) | Scores went 76, 82, 84, 87, 88, then 85 (round 6 found new truth defects). Workflow wf_33a37b2f-35b: fixer, then critic, up to rounds 7 and 8 | Read the last critic. If 90 or more, open http://localhost:3122 for the owner (dev server PID 33504, or `npx next dev --webpack -p 3122` in wt-land2) and **deploy only after his OK**: merge into main through a gate |

## 3. The app: what the owner wants (the ledger is the acceptance list)

- **Ledger:** `docs/brain/APP-OWNER-LEDGER-2026-10-16.md`. It has 39 items (L01-L39), 19 of them raised more than once and 10 not built when written. Each has emulator acceptance steps.
- **Design:** `docs/design-decisions/app-ia-1016.md` (IA; the ownership map is section 10), plus `app-today-1016.md`, `app-practice-review-1016.md`, `app-you-1016.md` and `app-tools-1016.md`.
- **Decisions in force (owner sign-off pending; defaults chosen):**
  1. **Bar:** 6 equal slots: Today, Practice, Start (third, lit pill), Review, Colleges, You. All icons, labels and the Start pill share one line.
  2. **Colleges tab:** My colleges, Admission Compass, the cutoff checker sheet, the Combo planner and the guides. Every tool is reachable in 2 taps or fewer. `/tools` redirects to `/colleges`.
  3. **You tab = the student's study:** the week as "3 of 4", 16 badges, personal bests, across your mocks, subjects. Plan and credits shrink to one row at the bottom.
  4. **Avatar sheet = the account:** name, email, plan, both credit balances, theme, notifications showing "Off" with Turn on, privacy, help, sign out.
  5. **Road to May:** a sideways strip of weeks you edit in place. The study-days ring says what it counts.
  6. **Practice:** subjects first, one "Up next" card, then Quick practice, By chapter, Smart practice, then Exam conditions (Full mock, NTA mode).
  7. **Colleges search:** normalises "BCOM", "B.Com", "b com" and "bcom hons", and stays keyboard-safe.
  8. **Onboarding:** includes adding colleges.
  9. **Notifications invite:** returns until notifications are on, and never appears inside a paper.
- **Owner answers today:** "Review again" meant the Review tab saying "We could not load your mistakes" (now fixed, see below). "Interview mode" = NTA mode.
- **Root-cause fix today (device-proven with a diagnostic build on his phone):** dio returns decoded JSON even with ResponseType.plain, so every `plainBody` call got an empty text. That broke the Today card ("Could not reach MockMob") for every account, the Review tab, and the DU college catalogue behind My colleges search.
  - Fixed in `core/api/api_client.dart` with test `test/unit/core_data/api_plain_body_test.dart`: fd3fca29 on feat/app-and-web, 3887e786 on ui/phase2.
  - v10.1 (v10 plus the fix) was sent to the owner: `tmp/apk/mockmob-v10.1-fd3fca29.zip`. Not device-verified after the fix; the phone was unplugged.
- **Also in the app since v10:**
  - 7501acf9: phase2b, My colleges, critic packets D and E;
  - a8252ca4: Repair v4 in the app;
  - 35d9fa49: slice 5 in the app;
  - dd5a1500: honest attempts failure states;
  - fd0da7d3: Mobi at real moments, one per screen;
  - 3a8968a1: the play-prep merge.
- **Emulator walk rig** (written in the build script):
  1. Wait for 4 GB of free RAM, then start the AVD with at most 3 GB (`-memory 3072`).
  2. Run the local staging site from `wt-batch` with `node scripts/pipeline/tools/stagingLocalApp.mjs` (port 3101), then `adb -e reverse tcp:3101 tcp:3101`.
  3. Build the debug APK with `--dart-define-from-file=dart_defines/phone.json` (package in.mockmob.app.debug).
  4. Sign in with the test-account code from `node --use-system-ca scripts/dev/staging-otp.mjs app-e2e-student@example.com`.
  5. Upgrade test: install a fd0da7d3 build first, then the new one with `install -r`.
  6. Downscale screenshots to 540 px and open every one.
- **Release command** (HANDOFF-2026-10-15-FULL section 5): in mockmob-next/flutter_app, `MOCKMOB_FLUTTER_SLOTS=3 bash tool/flutter_locked.sh build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`. Version bump script from play-prep: versionCode is still 1.

## 4. Owner items (tonight; reminder scheduled for 21:00 IST)

1. **Razorpay:** create the Rs 99 monthly plan in TEST mode first, then set `RAZORPAY_PLAN_ID_PRO_MONTHLY_99` in Vercel.
   - Webhook events: subscription.authenticated, activated, charged, pending, halted, paused, resumed, cancelled, completed, payment.captured, payment.failed.
   - Runbook: RUNBOOK-MONTHLY-BILLING-2026-10-16.md.
   - Decide the 6 lapsed-premium accounts.
   - Vercel Pro is needed when payments go live.
2. **Backup:** set `SUPABASE_DB_URL` (session pooler string) and install PostgreSQL client tools 17 or later. Runbook: RUNBOOK-WEEKLY-BACKUP-2026-10-16.md.
3. **Play:**
   - Create the developer account and run `tool\make_upload_key.ps1` with an agent.
   - Put the Web client ID in prod.json; add SHA-1 and SHA-256 after the first upload.
   - Recruit 12-20 testers.
   - Guide: PLAY-RELEASE-2026-10-16.md on wt-play.
4. **NTA index:** `CUET_EVIDENCE_SIGNING_KEY` in Vercel. After that, apply `20261013190000_nta_question_index.sql` under the grant and run `scripts/nta-index-build.mjs --write --allow-production` once.
5. **Funnel:** decide on `FUNNEL_ENABLED=true`.
6. **Testing he will do:**
   - a fresh timed mock plus one repair, which verifies Repair v4 live and fills the Lab;
   - his look at the landing on a local server;
   - the bar, tab-name and study-days sign-off questions (section 3).

## 5. Next steps, in order

1. Check the four in-flight items (section 2) and finish each.
2. **App:** finish the build, then integrate, then walk all 39 items on the emulator, then fix, then re-walk, then release v12.
   - Send v12 with a per-item list: item, pass or fail, screenshot path.
   - Install on his phone only when he says it is connected.
3. **Website batch 3:** merge main in first, then gate, then push.
4. **Landing:** reach 90 or more, then his local look, then a gated merge into main.
5. **Owner production steps** (section 4) once he has done his parts. Run the Razorpay TEST purchase per the runbook.
6. **Doubling down on the strengths:**
   - Get every tester through one timed mock. The Lab and the cohort time need volume; only 8 timed papers exist.
   - Make Repair v4 the hero of the landing and of the app's first run.
   - Keep honest numbers everywhere.
7. **Still open from the vision** (VISION-INVENTORY-2026-10-16.md):
   - anchor questions in NTA papers (owner decision, deferred);
   - landing calm-down Q13 (partly done by the de-slop rounds);
   - the Revise "It held" and "3 weeks in a row" badges need server events;
   - the website Rival result reveal has no Mobi yet;
   - the key-quality loop: apply only the 5 questions with the 20-pick gap after official key review (needs his decision).

## 6. Honest progress (16 Oct about 12:30)

- **Website:** about 85% live. Batch 3 and the landing remain.
- **Mistake Lab v4:** slices 1-4 and Repair v4 are live, and slice 5 has data but its code is in batch 3. About 90%.
- **App:** about 60% of what the owner expects. The core screens work after today's network fix, but the 39-item ledger (bar, Colleges tab, You, Road to May, Practice order, Compass) is mid-build and not device-verified.
- **Overall:** about 75% built, about 65% live.

## 7. Pitfalls learned today

- **Local builds:** run `npx next build --webpack` and `next dev --webpack`. Turbopack rejects the node_modules junction. Vercel builds normally.
- **Workflow scripts:** writing them with Python on Windows adds CRLF, and the Workflow tool then refuses the script ("control characters"). Write with newline='' or convert to LF.
- **Empty path lists:** `git checkout <rev> -- $EMPTY` with an empty list checks out the commit (detached HEAD). Guard path lists.
- **Crons:** Vercel allows 3 crons; batch 2 uses 2. Ride new nightly work on refresh-inventory.
- **Cohort SQL:** must be checked at production volume (1,815 attempts, 35k answers). v1 looked fine on tiny staging data and timed out on production.
- **Test fakes:** must mirror real content types. The plainBody bug hid because test fakes returned plain strings.
- **App walk:** test the upgrade path from the previous APK, not only fresh installs.
