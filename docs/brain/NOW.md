# NOW: MockMob current state (overwrite this file at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 6:45 am IST, by session 604ced81 (Claude Opus 5.5, main, CEO/CTO). The owner went to sleep at about 4 am.

**Read next:** `OWNER-MASTER-LEDGER.md` (the 3:45 am fold-in and the owner answers), then `OWNER-FEEDBACK-2026-10-18-DAWN.md` (the last sections).

## 1. Live
- **www.mockmob.in = main 58bc53f6 = website release 5.**
  - Vercel dpl_BKdqQn1PtzYWEPwER72gygLs5WKJ is READY, with 0 runtime errors; the main pages return 200.
  - What it contains:
    - Night subtle on Ask Mobi (D7/D12);
    - the eclipse theme switch (D10);
    - the Help and FAQ page, with no Help door (D11);
    - the nav fade floor (D13);
    - Practice "Review and repair" and Ask Mobi (D5);
    - result labels and the 10-slot bar (D15/D17);
    - the Learn and Review packets;
    - the "Learn" name (D20).
  - Owner guide: `docs/brain/R5-WHERE-TO-LOOK.md` in the release (pictures in `docs/brain/r5-where-to-look/`).
- **Production DB:** `20261017160000_revise_cards_mode` was applied at about 4:50 am under the standing grant.
  - Pre-check: 27 rows, no column. Post-check: 27 rows all 'question', the check constraint present, RLS on, 0 policies.
  - **The STATUS entry is pending:** the text is in the session scratchpad `status-pending.md`; add it to the release 6 push.
- **App:** v13 (1.0.13) is the last delivered APK.

## 2. The owner's decisions tonight (do not re-ask)
- **M-001:** a 3 s logo opening on the first launch only (built in v15, f006df6e).
- **M-006:** exciting, bolder copy, never false (not started: copy pass).
- **D19:** keep the badges and refine them (BADGES-REFINE-1018; web and app built).
- **D22:** the name is **Mob**.
- **4 am, overnight deploys:** "Push everything that passes". R5 and R6 ship when their suites and an independent visual check pass. **The landing and the new web Today wait for his live review.**

## 3. Tracks

| Track | Worktree, branch | Head | State | Next |
|---|---|---|---|---|
| **Web R6** | wt-rel6, deploy/web-1018-r6 | 34de061a and on | Integrated: community + Review/result + Ask Mobi + web badges; all suites green. The verifier said NO-GO on 1 HIGH: docked Ask Mobi broke the result at 1280-1366. The fix round is running (HIGH fixed at 34de061a; MEDIUM and LOW items in progress). | Fix report, then a spot re-check at 1280/1366/1440 docked, then push with the STATUS for R6 and the migration. |
| **Landing** | wt-land3, web/land3-1018 | f64cffe5 | Only the position band was ported (the toggle was already live). Dev server **3206** is up (LAN http://192.168.1.8:3206). | **The owner reviews it live.** Commit afa2cd73 (allowedDevOrigins) is dev-only: drop it before merging. |
| **Web Today** | wt-today18, web/today-1018 | d0486c12 | TODAY-1018 finished: D26 road (due today / this week / goal), D27 polish, greeting by hour, all states; tests green. Dev server **3207** (http://192.168.1.8:3207/preview/arena?view=today). | **The owner reviews it live.** Then merge onto the R6 base (expect conflicts with askmobi's Today "Why this?" line and R5's Today files). |
| **App v15** | wt-v15, ui/v15-1018 | fecc6a73 | Integrated: base + reel + Today 1018 + Ask Mobi + result Play it back + the M-001 logo; analyze clean, 5506 unit, 1417 goldens. Profile APK built (phone-relay defines). | The **emulator walk is running** (notes in mockmob-next/tmp/app-walk-1018/WALK.md). Then: merge ui/v15-badges (a85f0e50), a fix round, a confirm walk, the release APK + AAB 1.0.15 (prod defines, obfuscate). |
| **App badges** | wt-v15-badges, ui/v15-badges | a85f0e50 | Built: You badge home, badge sheet, earned row on the result; 61 new tests, 28 goldens | Merge into v15 with the fix round |
| **Mob** | wt-mobfix, web/mob-fix-1017 | e89d4a35 | The 5 gate defects are fixed; a re-gate is needed | Re-run the go/no-go on staging; stays OFF until 10/10 |

Walk findings so far (incomplete):
- **M-C:** the Repairs/Revise counts (98) disagree with the lead card ("10 of 98 due") and the Review badge.
- **M-D:** the Mob card shows on Today. The rig's staging site runs MOB_ENABLED=true, so check that the app hides it when the server says the Mob is off.
- **LOW:** a notice card repeats its title.

## 4. Next steps, in order
1. **R6:** finish the fixes, spot re-check, push. Add the STATUS entries (R6 and the migration).
2. **v15:** finish the walk, then one fix round (walk defects + merge badges), a confirm walk on the emulator, then the release build 1.0.15 (APK + AAB). Play signing needs the owner's upload key (PLAY-READINESS-V15.md).
3. **The owner's morning review** (live dev servers):
   - the landing (3206);
   - the web Today (3207);
   - R5 and R6 on mockmob.in, with the where-to-look lists.
4. **After his verdicts:** merge the web Today and the landing; the M-006 bolder copy pass (landing and onboarding); the Mob re-gate; the icons (D8, with the next app nav change); the D22 Mob concept brief.

## 5. Waiting on the owner
- His live review of the landing (and confirming the kept element, D32) and of the web Today.
- Play Console account and upload key; Anthropic key; Avast HTTPS-scanning exception; 112 held questions; a Hindi reviewer; free first Repair; M-011 Vercel duplicates (his click).

## 6. Rules that bit tonight
- **The stall watcher flags finished agents and read-only verifiers.** Check the process and the screenshot folder before acting.
- **A leftover Flutter test from a stopped session held a lock slot.** Reap leftovers at the start of every session.
- **Briefs must match the approved design docs.** One brief said "not-found" where COMMUNITY-1018 said a "paused" page, and it had to be redone.
