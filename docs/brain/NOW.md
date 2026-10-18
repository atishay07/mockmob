# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 12:25 pm IST, by session 25ef3d95 (main, Claude Opus 5.5, CEO/CTO).

**Read next:** `OWNER-MASTER-LEDGER.md` (newest sections at the bottom), then the last section of `OWNER-FEEDBACK-2026-10-18-DAWN.md`, which holds his 12:15 pm words on v15 (D40-D57).

**The goal (owner, 9:15 am, D39):** the Play Store is parked. Deliver:
- **App:** v15 completely ready, now including his 12:15 pm feedback.
- **Website:** "perfected".

When both are published and checked, send him ONE message with the links, the APK and where to look (D37).

## Live
- **www.mockmob.in = main 70c4598c = release 6.** It is READY.
- The owner's phone (V2413, serial 10BF370PA6002XR, connected by USB) has v15 79aaca6d (1.0.15+3) installed. When the final APK is built, the main session installs it there with `adb -s 10BF370PA6002XR install -r`.

## In flight at 12:25 pm
A network drop at about 11:40 am killed 10 agents. Their commits and edits were kept, and two workflows relaunched every track.

**Workflow web-1218 (wf_7f182806-4da, task wdcvxxe87):**

| Item | Worktree | State |
|---|---|---|
| R7 fix | wt-rel7, at 81e467f4 plus uncommitted work | Being finished, then an independent verifier runs |
| R8 fixes | wt-r8-fixes, at b8766804 | Finishing; adds D53 web parity (Ask Mobi without the blocking AI sheet) |
| R8 retry | wt-r8-retry, at 453f9ae8 | Building W-032 |
| R8 adopt | wt-r8-adopt, at dfc6797e | Done |
| Landing hero | wt-land3, at 42b51dd3 | Done. The owner has preview 3206 (he reviews it live, D30) |

- **On an R7 GO:** the main session pushes deploy/web-1018-r7 to main (a fast-forward from 70c4598c), checks Vercel and writes STATUS.
- **Then R8 integration:** a new worktree from the R7 head merges r8-fixes, r8-adopt, r8-retry and land3; suites run, an independent verifier checks it, the owner sees it live, then it is pushed.

**Workflow v15-final-1218 (wf_57a36e4c-275, task w2sbl0z25):**
- **Build:** 10 packets run at once:
  - review (D18), polish2 (with the WALK.md 1018b items), icons (D8 plus D57 visible bar glass plus D56 restoring the Start key), mob and learn, all resumed;
  - new: onboard-a (D40/D43/D44/D48), onboard-b (D41/D42/D45/D46/D47/D49), askinstant (D53), and a ledger audit followed by a fixer (D55);
  - design (D51 swipe cards and D52 a richer Today: mock-ups only; plus finding the D50 screen).
- ui/v15-asks (4a1b9b98: M-001, M-002, M-003) is done.
- **Then:** the integrator merges everything into wt-v15 and runs the full suites, a walk on the emulator follows (screenshots in tmp/app-walk-1018c), a fixer handles what the walk finds, and the release APK goes to `tmp/apk/mockmob-v15-final-<sha>.apk`.

**D54 credits (approved 12:28 pm): the Free AI wallet goes from 10 to 50 a month.**
- **credits-web-1018** (wf_8a0722bb-80c, task wir0nm4ir) builds the server and website side in wt-credits50 (web/credits50-1018, from c46d1dcd). Staging dry-run only. It merges into R8. Any production database step is the main session's, under the grant.
- **credits-app-1018** (wf_b95e2cfe-c49, task wer8pk8ho) builds the app copy in wt-v15-credits (ui/v15-credits).
- **The main session merges ui/v15-credits into wt-v15 BEFORE the v15 integrator starts.** If the integrator has already started, it waits and merges after the integration instead.
- **Speed-up:** when the integrator commits the build bump, the main session builds the release APK in a separate worktree at that head while the walker walks.

## Owner decisions open
- **D50:** which screen he meant by "5, 10, 20 only, no direction until a full mock". The design agent is finding it.
- **D51/D52:** the swipe cards and the richer Today. Mock-ups are coming; nothing is built before he says yes.
- **D49:** usage data is ON by default, for adults only. India's DPDP Act treats a pre-ticked box as weak consent, so tell him that.
- Older ones still open: W-099, W-046, the flat 10-credit line, the Mob switch-on, Play Console (parked).

## Rules that bit today
- **Network drops kill every agent at once.** Agents commit as they go; after a drop, relaunch from the worktrees (check git status for uncommitted work).
- **Leftovers:** dead agents leave dev servers behind (ports 3214, 3402, 3404 had them). Reap them before relaunching.
- **Machine:** the PC has 32 GB of RAM (17 GB free at noon), and Flutter slots are now 4. The CPU is still the ceiling.
- **Usage:** 17% at 12:07 pm, and it resets at about 4:10 pm. 13 agents run at once.
