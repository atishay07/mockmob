# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 19 Oct 2026, about 2:12 am IST, by the Autopilot session 6f206609 (fork of 25ef3d95; Claude Opus 5.5, CEO/CTO). The owner started Autopilot at 2:07 am; he is asleep.

**2:10 am:** the previous session ended and all 10 agents died within minutes, with no commits; only 2 uncommitted edits were left in wt-1019-a2a. All 10 were RELAUNCHED from their saved briefs (docs/brain/briefs-1019/01-10) with a RESUMED line, in the same worktrees. The disk clean-up (brief 11) had already finished.

**THE GOAL AND THE PLAN FOR TONIGHT'S UNATTENDED RUN: `docs/brain/AUTOPILOT-GOAL-1019.md`.** Read it completely first. It is the source of truth until 9:00 AM. It covers:
- what done means;
- the boundaries (no production deploy, no phone install, no sign-in as him);
- the sources;
- the state;
- steps 0-5;
- the rules R1-R8;
- the keep list;
- handoff discipline.

## Live (unchanged tonight)
- **Web:** www.mockmob.in = main 23a7c090 (release 10). Flags WALLET_COMMERCE_OPEN, PLAY_BILLING_ENABLED and PERSISTENT_LIMITS_ENABLED are OFF.
- **App:** v15.2 ab04b067 (1.0.15+7) on his phone (V2413, 10BF370PA6002XR).

## Running (relaunched about 2:10 am by the Autopilot session; exact briefs in `docs/brain/briefs-1019/`)
- **App owners:**
  - A1, shell and Practice: wt-1019-a1.
  - A2a, onboarding and colleges: wt-1019-a2a.
  - A2b, Today and the deck: wt-1019-a2b.
  - A3, result and Your papers: wt-1019-a3.
  - A5, the range: wt-1019-a5.
- **Web owners:**
  - A4a, polish restore: wt-1019-a4a.
  - A4b, sign out, Review, ticket and scroll cue: wt-1019-a4b.
- **Mock-ups:** B1 web nav, B2 Ask Mobi, B3 homepage motion. Output goes to tmp/design-1019/* and docs/design-decisions/pass-1019/*.
- **Done:** the disk clean-up. It freed 4.7 GB; 105 GB free.

**Integration branches (the main session merges into them):**
- App: ui/v15.3-1019 in wt-v15-3.
- Web: deploy/web-1019-r11 in wt-rel11.

## Owner decisions tonight
- **D111:** explain, then deliver autonomously beyond expectation.
- **D112:** if he is away when the mock-ups arrive, pick the designer's recommendation, build it, and tell him.

All earlier decisions are in OWNER-FEEDBACK-2026-10-19.md (D101-D110) and PLAN-1019.md.

## Next (the goal doc, steps 0-5)
1. Merge each owner when it finishes.
2. Pick and build the mock-ups (D112).
3. Fresh-account and heavy-account walks, the R2 line per screen, R4 side by side, R5 frames.
4. One Opus verifier per platform, 2 rounds at most.
5. The v15.3 release APK, and release 11 verified but NOT pushed (Autopilot rule).
6. Write MESSAGE-1019.md.

## Commands and facts
See AUTOPILOT-GOAL-1019.md section 2 and BRIEF-1019-COMMON.md. The IDs:
- Vercel: prj_uSolddribHQDl1mM5AKxg3O9qCIu, team_V5PhMz9hqV42vblUMcvhYqoN.
- Supabase: production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.

Staging rig: 3101 (old rig code), 3103 (release 9 + the Mob), relay 3102. Emulator use is serialised by the lock folder `C:\Users\atish\AppData\Local\Temp\mm-emu-lock`.
