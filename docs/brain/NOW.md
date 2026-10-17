# NOW: MockMob current state (overwrite this file at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 3:20 am IST, by session 25ef3d95 (Claude Opus 5.5, main, CEO/CTO). The owner is moving the work to another account before he sleeps. **Read next:** `OWNER-MASTER-LEDGER.md` (new section "Added 18 Oct 2:30-4:10 am"), then `OWNER-FEEDBACK-2026-10-18-DAWN.md` (his words; the end sections hold tonight's decisions, D25-D29).

## 1. Live
- **www.mockmob.in = main 9578ee66 (web release 4).** Nothing new pushed tonight yet. STATUS entries for R3, R4 and R5 still to write in the next push.
- **Production DB:** unchanged since 17 Oct. The Mob migration is NOT on production.
- **App:** v13 (1.0.13) is the last delivered APK; it is installed on the emulator (the owner watched it).

## 2. Owner decisions tonight (do not re-ask)
- **A2: hold v15 for the new Today.** v15 = new Today + result + polish + Ask Mobi + the paper reel.
- **Mock-ups approved:** TODAY-1018 (with D26 Road to CUET = due today / due this week / the goal; D27 feel unique), ASK-MOBI-1018, REVIEW-RESULT-1018, COMMUNITY-1018 (hide contributions behind CONTRIBUTE_ENABLED, keep Explore, the Mob, Your standing, creators). All in `docs/design-decisions/pass-1018/`, mocks in `tmp/design-1018/`.
- **D5 = Repairs** (CTO; he could not confirm). **D6 = Ask Mobi** (confirmed).
- **D28/D29:** the "Back from marking" card is fake (marking is instant). Replace it with a truthful reel, "Play your paper back, 20 s", built on the same engine as the D17 replay; fix the three v13 Today bugs (greeting by hour, stuck "Still refreshing", row under the bar).
- **He wants speed:** run focused parallel builds; he does not want stalls. CPU is the practical ceiling (about 12-15 heavy agents).

## 3. In flight at the handover (session 25ef3d95 workflows; run ids only resume in that session, so a new session relaunches from the worktrees)

| Track | Worktree, branch | Head | State | Next |
|---|---|---|---|---|
| **Web release 5** | wt-ship17, deploy/web-1018-r5 | 7ef0ba7a | All 6 items built and merged (night 4af8973a, theme c06d2a58, nav 0a7b35c6, practice cb7eaa15, result 3c00fcb9, lr a3a060dc); integrator was finishing suites; then the independent verifier | Verifier (suites + D7, D10, D11, D13, D5, D15, D16, D17, F15 at 390/1440 Night/Day), STATUS R3-R5, **main pushes** |
| **Landing** | wt-land2, web/land2-1015 | 48e7b057 | Checker 1 of the final loop running (L-001..L-045, zero truth, zero high) | Fix loop until SHIP, ship verifier (merge origin/main), **main pushes** (memory landing-checklist-gate) |
| **Today web** | wt-today18, web/today-1018 | 9b9b84dc (+12 dirty) | Opus build in progress; critic + fix follow | Into release 6 |
| **Review/result web** | wt-r6-review, web/r6-review-1018 | c7292e41 (+8 dirty) | Building (P-RR1 done) | Into release 6 |
| **Ask Mobi web** | wt-r6-askmobi, web/r6-askmobi-1018 | a7fc0f9a | Built (panel); finishing | Into release 6; wire call sites (Practice, result, Today "Why this?") |
| **Community + D20 web** | wt-r6-community, web/r6-community-1018 | 0a7b35c6 (+18 dirty) | Building | Into release 6 |
| **Mob web/server** | wt-mobfix, web/mob-fix-1017 | 286aa73b | 5 gate defects fixed with tests | Re-run the go/no-go on staging; stays OFF in production |
| **v15 base** | wt-v15, ui/v15-1018 | 6ffc3e59 | v13 + v14 + **polish merged** | Integrate the rest |
| **v15 result** | wt-v15-result, ui/v15-result | c56fc063 | DONE (D15-D17) | Merge into ui/v15-1018: **3 conflicts with polish** (main aborted a quick merge; the integrator resolves with tests) |
| **v15 Today** | wt-v15-today2, ui/v15-today2 | 76ee2e90 (+8 dirty) | Opus build in progress; critic + fix follow. Do NOT use ui/v15-today (d4c75899, the rejected R4 design) | Merge into v15 |
| **v15 Ask Mobi** | wt-v15-askmobi, ui/v15-askmobi | 5e162f98 (+3 dirty) | Building | Merge; wire call sites |
| **v15 paper reel** | wt-v15-reel, ui/v15-reel | 6ffc3e59 (agent just started; the fresh worktree shows many line-ending changes) | Standalone PaperReel widget + entry cards (D29) | Merge; wire on Today after submission and on the result |
| **Rig** | staging 3101, relay 3102, emulator | - | Emulator booted with v13 signed in to the test account | v15 walk |
| **Play readiness** | doc `docs/brain/PLAY-READINESS-V15.md` | - | Being written | Owner: upload key, Play Console |
| **Missed asks** | doc `docs/brain/MISSED-ASKS-2026-10-18.md` | - | Synthesizer running (finishes the 17 Oct corpus sweep) | Fold M-### into the master ledger |
| **Badges and icons** | `docs/design-decisions/pass-1018/BADGES-ICONS-1018.md` | - | Design + mocks running (D19, D8) | Show the owner |

Every agent commits as it goes; a stopped agent leaves its work in its worktree (commit any dirty tree as a STOP POINT before reusing it).

## 4. Next steps, in order (with honest times from about 3:20 am, if uninterrupted)
1. **Push release 5** after its verifier: about 4:15 am.
2. **Landing:** loop to SHIP, then push: about 4:30-5:30 am.
3. **v15:** finish Today, Ask Mobi and the reel packets (about 60-75 min); integrate all into ui/v15-1018 (result's 3 conflicts, D28 bugs, wire the reel and Ask Mobi; analyze, full unit, full goldens; about 60 min); emulator walk against F, N, D (app) and L01-L39 plus the D25-D29 items, with screenshots (60 min); Opus critique (20 min); fix round (45 min); confirm walk (40 min); release 1.0.15 APK + AAB (20 min). **v15 in his hands about 8-8:30 am.**
4. **Release 6 (web):** Today, Review/result, Ask Mobi (with call sites), community + D20, merged on top of release 5; verifier; push: about 6-6:30 am.
5. Then: the Mob re-gate; the app Review/result packet (REVIEW-RESULT-1018 app) for 1.0.16; fold the missed asks; badges/icons decision; Higgsfield.

## 5. Decisions or items waiting on the owner
- Badges and icons mock-ups (when ready); the D22 social-circle names (COMMUNITY-1018 has options).
- Play Console account and upload key; the Anthropic key; the Avast HTTPS-scanning exception; 112 held questions; a Hindi reviewer; free first Repair.

## 6. Rules that bit (repeated because they cost hours)
- Refine, never rebuild; mock-ups first. Never SendMessage a running workflow agent. Agents stop only their own processes; never chrome.exe directly. Unlink node_modules junctions before `git worktree remove`. Dev servers with NODE_OPTIONS=--max-old-space-size=4096. Keep C: at 100 GB+ free. Check usage before waves; stop at about 95% with STOP POINT commits. Never queue a fast item behind a slow one in the same workflow (tonight the landing check waited 40 min behind the v15 result packet).
