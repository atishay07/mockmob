# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 19 Oct 2026, about 2:15 am IST, by the Autopilot session 6f206609 (a fork of 25ef3d95; Claude Opus 5.5, CEO/CTO).

> **CORRECTION, 19 Oct about 2:15 am, by session 25ef3d95 (the original session):** the Autopilot fork (session 6f206609) wrote this file and NEXT-SESSION-PROMPT.md believing that the 10 agents had died. That is WRONG.
> - The fork inherited this conversation but not its running agents.
> - At 2:08-2:09 am it launched 10 DUPLICATE agents on the same worktrees. The owner stopped the Autopilot run at 2:09:44, and the fork stopped its duplicates within seconds (about 1 minute of reading, no code from them).
> - During its shutdown the fork killed about 22 processes, possibly test runs or dev servers of the original agents, which retry. It also committed the original A2a agent's 2 edits as STOP POINT 83ac6103 (harmless).
> - **The ORIGINAL 10 agents of session 25ef3d95 are ALIVE and working** (each transcript was written at 2:11 am).
> - **Rule from this:** never start Autopilot's "Continue a session" while the session it continues still has running agents. It forks and duplicates them. Use "New run in a project" with the AUTOPILOT-GOAL-1019.md goal, after the live session's agents are stopped with STOP POINTs.

- The owner STOPPED the Autopilot run at about 2:12 am and asked for this handoff.
- Every agent is stopped and every worktree is committed. Agent dev servers and Flutter leftovers were reaped.
- **Left running on purpose:**
  - staging site 3101 (old rig code), relay 3102, staging site 3103 (release 9 + the Mob);
  - the rig launcher (PID 6184).
- Something unrelated is listening on port 3306 (PID 8984). It is old; check it before killing it.

**THE GOAL AND THE PLAN ARE UNCHANGED:** `docs/brain/AUTOPILOT-GOAL-1019.md` (goal, boundaries, steps 0-5), on top of `docs/brain/PLAN-1019.md` (rules R1-R8, every item's SPEC and DONE WHEN). Read both completely. The exact agent briefs are in `docs/brain/briefs-1019/01-11`. Relaunch from them word for word.

## Live (unchanged)
- **Web:** www.mockmob.in = main 23a7c090 (release 10). The flags WALLET_COMMERCE_OPEN, PLAY_BILLING_ENABLED and PERSISTENT_LIMITS_ENABLED are OFF.
- **App:** v15.2 ab04b067 (1.0.15+7) is on his phone (V2413, 10BF370PA6002XR).

## Where each agent was cut off (all built nothing usable yet; the time between launch and stop was only minutes)
Two launches, each killed early:
- The first, at about 2:05 am in session 25ef3d95, died when that session ended.
- The second, at about 2:10 am in the Autopilot session, was stopped at the owner's request at about 2:12 am.

| # | Owner | Worktree, branch | Head | State |
|---|---|---|---|---|
| 01 | A1 app shell and Practice (G11, G15/D101, G17/D105, G20 move) | wt-1019-a1, ui/1019-a1-shell | ab04b067 | Nothing done (it had only read its brief). Relaunch from brief 01. |
| 02 | A2a onboarding and colleges (G1, G3, G4, G5, G6/D103, G9) | wt-1019-a2a, ui/1019-a2a-onboard | **83ac6103** = STOP POINT | Partial and UNCHECKED: du_2026_data.dart (22 lines), make_onboarding_du.py (11 lines), and a new test/unit/onboarding/college_search_keyboard_test.dart (136 lines, G3). The relaunched agent reviews it first. |
| 03 | A2b Today and the deck (G7/D104, G12, G13) | wt-1019-a2b, ui/1019-a2b-today | ab04b067 | Nothing done. Relaunch from brief 03. |
| 04 | A3 result and Your papers (G22/D108, G20/D106) | wt-1019-a3, ui/1019-a3-result | ab04b067 | Nothing done. Relaunch from brief 04. |
| 05 | A5 range (G18, G19/D109) | wt-1019-a5, ui/1019-a5-range | ab04b067 | Nothing done. Relaunch from brief 05. |
| 06 | A4a web polish restore (G28, G31) | wt-1019-a4a, web/1019-a4a-polish | 23a7c090 | Nothing committed. It had set up a "before" worktree, wt-1019-a4a-before (detached at 77713336, the deploy/1016-batch lit build), for R4. Reuse it. |
| 07 | A4b web UX (G29, G25/D106, G26, G27) | wt-1019-a4b, web/1019-a4b-ux | 23a7c090 | Nothing committed. It had set up wt-1019-a4b-base (detached at 23a7c090) for R4. Reuse it. |
| 08 | B1 web navigation mock-ups (G24/D107) | helper worktree wt-b1-webnav (detached 23a7c090); output tmp/design-1019/web-nav | n/a | 11 working files in tmp/design-1019/web-nav/work. No doc, no boards yet. |
| 09 | B2 Ask Mobi mock-ups (G21/D110) | output tmp/design-1019/ask-mobi | n/a | Only Mobi pose assets exported (ask-mobi/src/assets, 22 PNGs). No mock-ups yet. |
| 10 | B3 homepage text motion (G30, G31 notes) | helper worktree wt-b3-hero (branch design/hero-motion-1019 at 23a7c090); output tmp/design-1019/hero-motion | n/a | Prototype assets copied (hero-motion/proto/assets: fonts and images). No options, strips or videos yet. |
| 11 | Disk clean-up (Haiku) | n/a | n/a | DONE: it freed 4.7 GB; C: has about 105 GB free. |

**Integration branches:** both untouched, nothing merged.
- App: ui/v15.3-1019 in wt-v15-3, at ab04b067.
- Web: deploy/web-1019-r11 in wt-rel11, at 23a7c090.

## Owner decisions tonight
D101-D110 are in OWNER-FEEDBACK-2026-10-19.md and PLAN-1019.md.
- **D111:** explain what happened, ask only what is needed, then deliver autonomously beyond expectation.
- **D112:** if he is away when the mock-ups arrive, pick the designer's recommendation, build it, and tell him.

## Next (exactly the goal doc's steps 0-5)
1. **Relaunch all 10 agents** from `docs/brain/briefs-1019/01-10`, each with the line "RESUMED: continue from the commits already in your worktree; review any uncommitted edits first". For 02, add: "review STOP POINT 83ac6103 first".
2. **Merge each owner early** into wt-v15-3 or wt-rel11.
3. **Wave B:** send the boards to him and pick the recommended option (D112). Then **Wave C** builds them.
4. **Walks:**
   - a fresh account and a heavy account;
   - the R2 line on every screen;
   - R4 side by side with v15.2 and release 10;
   - R5 frame sequences.
5. **One Opus verifier per platform,** 2 rounds at most.
6. **Ship:**
   - **v15.3:** the release APK. He connects his phone; the main session installs it.
   - **Release 11:** verified. Push only with his say-so, or when he runs the session himself, since the Autopilot rule is never deploy.
7. **ONE message** in docs/brain/MESSAGE-1019.md.

## Things needed from you right now
- **Restart:** paste NEXT-PROMPT-1019.md (or the Autopilot goal) when you want the work to restart. It resumes from this table.
- **G26:** which screen shows "5 questions ... Biology" on top? The default is the website Practice session card.
- **Older items:**
  - the Razorpay test-card run, then WALLET_COMMERCE_OPEN;
  - Play Console setup, then PLAY_BILLING_ENABLED;
  - the PERSISTENT_LIMITS_ENABLED decision;
  - W-044.

## Commands and facts
AUTOPILOT-GOAL-1019.md section 2 and BRIEF-1019-COMMON.md cover the boundaries, tools and the emulator lock (`C:\Users\atish\AppData\Local\Temp\mm-emu-lock`; not held now).
- **IDs:**
  - Vercel: prj_uSolddribHQDl1mM5AKxg3O9qCIu, team_V5PhMz9hqV42vblUMcvhYqoN.
  - Supabase: production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.
- **A watcher for silent agents:** mockmob-next/tmp/autopilot-1019/agentwatch.mjs. Run it with the session's tasks folder as the argument.

## Live status at about 2:40 am (session 25ef3d95; the owner may switch accounts any minute)
**Done:**
- B1 web nav: pick A.
- B2 Ask Mobi: pick B.
- B3 hero motion: pick C.

  All picked under D112 and recorded at the end of OWNER-FEEDBACK-2026-10-19.md, with the board images sent to the owner.
- Acceptance checklist: docs/brain/ACCEPTANCE-1019.md (46 blocks; walk order at the end).
- Disk clean-up.
- CTO decision C-dec 1: the first full mock in each subject is free.

**Running** (if the account switch kills them, relaunch each from its brief in docs/brain/briefs-1019/ with a RESUMED line; never duplicate a live one: first check its transcript mtime under ~/.claude/projects/C--Users-atish-Desktop-mockmob-copy/25ef3d95-*/subagents/):

| Brief | Agent |
|---|---|
| 01 | A1 shell and Practice |
| 02 | A2a onboarding and colleges |
| 03 | A2b Today and deck |
| 04 | A3 result and Your papers |
| 05 | A5 range (told about C-dec 1) |
| 06 | A4a web polish (first commit in) |
| 07 | A4b web UX |
| 12 | G16 fresh-account baseline walk (v15.2) |
| 13 | web baseline captures |
| 15 | C1 web nav A |
| 16 | C2 Ask Mobi B (app) |
| 17 | C3 hero motion C |
| 18 | W5 first full mock free (server) |

**Next:**
1. Merge each owner when it finishes (app into wt-v15-3, web into wt-rel11).
2. The final walks per ACCEPTANCE-1019.md.
3. One Opus verifier per platform.
4. The v15.3 APK; release 11.
5. MESSAGE-1019.md.
