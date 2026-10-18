# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 10:10 am IST, by session 604ced81 (main, Claude Opus 5.5, CEO/CTO), just before the owner's account switch at about 95% usage.

**Read next:** `OWNER-MASTER-LEDGER.md` (newest sections at the bottom), then `OWNER-FEEDBACK-2026-10-18-DAWN.md` (the last sections, D35-D39).

**The goal (owner, 9:15 am, D39):** the Play Store is parked. Deliver:
- **App:** v15 completely ready (all features, walked on the emulator, APK delivered).
- **Website:** "perfected", with every change he asked for and every change promised.

When both are published and checked, send him ONE message with the links, the APK and where to look. He then reviews and gives final feedback (D37).

## Live
- **www.mockmob.in = main 70c4598c = release 6** (Review/result 1018, Ask Mobi 1018, community hidden, Learn, web badges, fixes). READY, 0 errors.
- Release 5 (58bc53f6) shipped earlier.
- **Production migration** revise_cards_mode was applied at 4:50 am (STATUS in 70c4598c).

## In flight at 10:10 am (every agent commits as it goes; check each worktree's git log)

| Track | Worktree, branch | State | Next |
|---|---|---|---|
| **R7 web: the new Today** | wt-rel7, deploy/web-1018-r7, c46d1dcd and on | Verifier NO-GO on 1 HIGH: the Change plan receipt states a stale mock target (TodayPlanFlow.jsx). **A fix round is running** (H1, M1-M3, M5-M7, L4, L5; captures in tmp/fix-r7). | GO → push (fast-forward from 70c4598c) + STATUS. NO-GO → a fix round. |
| **R8 web fixes** | wt-r8-fixes, web/r8-fixes-1018 (from c46d1dcd) | W-078 /mentor Day contrast (LIVE bug), W-075 the dock Start goes quiet while the page primary is visible, W-079 targets, W-093 copy (Help "Five stops"), W-089 copying the design notes | Merge into R8 |
| **R8 adoption** | wt-r8-adopt, web/r8-adopt-1018 | W-064: the first-week path on Today; the "of the N you repaired, M did not come back" receipt | Merge into R8 |
| **R8 retry** | wt-r8-retry, web/r8-retry-1018 | W-032: "Try it again" before the key on the result | Merge into R8 |
| **Landing hero** | wt-land3, web/land3-1018 (83f8f821+) | Opus is building D38: the morphing third line, a coloured CUET 2027, Mobi alive, clean spacing, at most one Mobi per viewport, the "10:35 later" sample fix, the Mobi foot overlap. Dev server 3206 is live for the owner. | Merge into R8 |
| **R8 integration** | not started | | A new worktree from the R7 head after the R7 push: merge the 4 branches above, run the suites, an independent verifier, fix, push. |
| **App v15** | wt-v15, ui/v15-1018, 79aaca6d | All first-walk defects fixed (H1 UTC time, M1-M11) + the badges merge; 5681 unit, 1445 goldens; profile APK rebuilt | **The confirm walk is running** (notes in mockmob-next/tmp/app-walk-1018b/WALK.md) |
| **App Review D18** | wt-v15-review, ui/v15-review (from a417b827) | Port of the web Review "leads with weak chapters" | Merge into ui/v15-1018 |
| **App polish 2** | wt-v15-polish2, ui/v15-polish2 (from 79aaca6d) | Full-mock resume after a killed start (credits), the real reel length, Ask chip freshness, the runner scroll cue, Practice flicker, the Day shadow, copy, motion overlaps | Merge into ui/v15-1018 |
| **v15 release** | wt-v15 | | After the two merges: analyze, unit, goldens, a short walk of Review + polish, then the **release APK** (`--release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`). Copy it to mockmob-next/tmp/apk/mockmob-v15-<sha>.apk and send it to the owner. |

**Stopped:** the read-only audit workflow wf_7899c96b-147 (app ledger L01-L39, Compass data M-007, missed asks), stopped to save usage. Re-run it later with fresh agents (the script is in the session's workflows folder).

**Preview servers for the owner:**
- 3206 (landing, wt-land3) and 3207 (web Today, wt-today18).
- `.claude/launch.json` has "landing-1018" and "today-1018" (scratchpad devserve.mjs). The LAN address 192.168.1.8 works because allowedDevOrigins is set.

## Owner decisions still open
- W-099: merge Ask Mobi's "Your record" page with the Weak chapters page? (Merging cuts a page; ask.)
- W-046: what "Study day / week chapters" meant.
- The flat 10-credit line for 5/10/15/20 questions (app), to confirm.
- The Mob switch-on (needs the re-gate on staging first; wt-mobfix e89d4a35).
- Play Console account and upload key, and 12 testers for the 14-day closed test (parked).

## Rules that bit today
- **Stall alerts:** the stall watcher flags read-only verifiers and finished agents; check the capture folder or processes before acting.
- **Clean up leftovers:** reap leftover Flutter tests from stopped sessions (one held a lock slot).
- **Briefs must match approved docs:** a brief contradicting COMMUNITY-1018 had to be redone.
- **LAN previews:** need allowedDevOrigins (dev only) or the page never hydrates.
- **Temp files:** an agent deleted *.sh in the shared Temp folder; tell agents never to clean outside their worktree.
- **Usage:** 9 parallel agents burn about 30% an hour.
