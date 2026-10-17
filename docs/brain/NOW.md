# NOW: MockMob current state (overwrite this file at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 4:05 am IST, by session 25ef3d95 (Claude Opus 5.5, main). Safe stop at 80% usage at the owner's request ("use it at 80%... stop everything safely... prepare the handoff and the prompt"). **Read next:** `OWNER-MASTER-LEDGER.md` (sections "Added 18 Oct 2:30-4:10 am" and "Added 18 Oct about 3:45-4 am"), then `OWNER-FEEDBACK-2026-10-18-DAWN.md` (his words, end sections: D25-D34), then `MISSED-ASKS-2026-10-18.md`.

## 1. Live
- **www.mockmob.in = main 9578ee66 (web release 4).** Nothing pushed this session. STATUS entries for R3, R4 and R5 still unwritten.
- **Production DB:** unchanged since 17 Oct. The Mob migration is NOT on production.
- **App:** v13 (1.0.13) is the last delivered APK.

## 2. The owner's mood and the most important facts
- At 4 am he viewed the landing branch live and called it **"so trash and a major regression"** (D32). **Do not ship web/land2-1015.** Keep only the held-story position indicator at the top (Mistake Lab, What's inside) and the top light/dark toggle, ported into the CURRENT live landing. Confirm the exact element with him first.
- He saw no visible change in release 5's dashboard (D33). Releases must make his asks visibly obvious, and say where to look.
- He reviews big pages live himself (D30): open the dev server in the app's browser pane (preview_start with the localhost URL) or give the LAN address (the PC is 192.168.1.8; the dev server binds all interfaces).
- Decisions earlier tonight (do not re-ask): A2 hold v15 for the new Today; mock-ups approved (TODAY, ASK-MOBI, REVIEW-RESULT, COMMUNITY-1018 in docs/design-decisions/pass-1018); D5 = Repairs; D6 = Ask Mobi; D26 Road to CUET shows due today / due this week / the goal; D27 Today must feel unique; D29 replace "Back from marking" with the truthful "Play your paper back" reel.

## 3. Stop point per track (all workflows stopped; every tree committed; dev servers, Chrome, Flutter, Gradle and the emulator stopped; still running on purpose: staging site 3101, relay 3102, adb; one unknown process still listens on 3306)

| Track | Worktree, branch | Head | State | Next |
|---|---|---|---|---|
| **Web release 5** | wt-ship17, deploy/web-1018-r5 | 9dce83f9 | All 6 items merged (Night D7/D12, theme D10, Help page + nav pulse D11/D13, Practice Repairs + Ask Mobi D5, result labels + bar D15/D17, Learn and Review F15 Revise/Concepts); suites were being fixed by the integrator; visual verifier never finished | Run the suites and an independent verifier (390/1440, Night/Day, per D item); **show him live first (D30, D33)**; then push with the STATUS entry for R3-R5 |
| **Landing** | wt-land2, web/land2-1015 | 48e7b057 | **Rejected (D32)** | New pass on the live landing: port the position indicator and the toggle only; start from his landing words (D31); show him live before shipping |
| **Today web** | wt-today18, web/today-1018 | fa55c354 (STOP) | Partial Opus build of TODAY-1018 + D26/D27 | Finish, critic, show him live |
| **Review/result web** | wt-r6-review, web/r6-review-1018 | b9a68e62 | REVIEW-RESULT-1018 mostly built | Finish replay/reel (D29), verify |
| **Ask Mobi web** | wt-r6-askmobi, web/r6-askmobi-1018 | 8615756f | Panel built (ASK-MOBI-1018) | Wire call sites; verify |
| **Community + D20 web** | wt-r6-community, web/r6-community-1018 | f05fdffc | Contributions hidden behind CONTRIBUTE_ENABLED; D20 in progress | Finish D20, verify |
| **Mob web/server** | wt-mobfix, web/mob-fix-1017 | e89d4a35 | The 5 gate defects fixed with tests | Re-run the go/no-go on staging; stays OFF |
| **v15 base** | wt-v15, ui/v15-1018 | 30a2b395 | v13 + v14 + polish + **result merged** (the integrator resolved the 3 conflicts; its full test run did not finish) | Run analyze, full unit, full goldens; then merge Today, Ask Mobi, reel |
| **v15 Today** | wt-v15-today2, ui/v15-today2 | c0558c6e (STOP) | Partial Opus build (TODAY-1018 app). Never use ui/v15-today (d4c75899, rejected design) | Finish, critic |
| **v15 Ask Mobi** | wt-v15-askmobi, ui/v15-askmobi | d07d90bb (STOP) | Partial | Finish |
| **v15 paper reel** | wt-v15-reel, ui/v15-reel | 61aa6d10 | DONE: PaperReel widget + Today card + result entry (27 tests) | Wire into Today after submission and the result (D29) |
| **Docs done** | docs/brain/PLAY-READINESS-V15.md, MISSED-ASKS-2026-10-18.md, docs/design-decisions/pass-1018/*.md | - | Done | Use |

## 4. Next steps, in order
1. Fold `MISSED-ASKS-2026-10-18.md` into the master ledger; ask him M-001 and M-006 with recommendations; adopt M-018 (end updates with "Things needed from you right now" / "Nothing needed from your side").
2. Release 5: suites, verifier, show him live, push (STATUS R3-R5).
3. Landing: port the two kept pieces into the live landing; show him live; ship only on his yes.
4. v15: test the merged base; finish Today, Ask Mobi; wire the reel and fix the three D28 Today bugs; emulator walk with screenshots; Opus critique; fix; confirm walk; release 1.0.15 APK + AAB.
5. Release 6 web: Today, Review/result (+ reel), Ask Mobi, community + D20; show him live; push.
6. Then: the Mob re-gate; badges/icons decision (BADGES-ICONS-1018); the D22 social names; Higgsfield.

## 5. Waiting on the owner
- M-001 (logo 3 s), M-006 ("exciting copy" vs no hype), confirm the D32 kept element, badges and icons, D22 names.
- Play Console account and upload key; the Anthropic key; the Avast HTTPS-scanning exception; 112 held questions; a Hindi reviewer; free first Repair.

## 6. Rules that bit
- Refine, never rebuild; mock-ups first; he reviews big pages live before shipping (D30).
- Never queue a fast item behind a slow one in one workflow (the landing check waited 40 minutes).
- Never SendMessage a running workflow agent; agents stop only their own processes; never chrome.exe directly; unlink node_modules junctions before worktree removal; dev servers with NODE_OPTIONS=--max-old-space-size=4096; keep C: at 100 GB+ (128 GB free now).
- Check usage before waves; his stop rule is about 80% when he says so (tonight) or 95-98% otherwise.
