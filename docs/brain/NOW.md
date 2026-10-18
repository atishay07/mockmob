# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 12:25 pm IST, by session 25ef3d95 (main, Claude Opus 5.5, CEO/CTO).

**Read next:** `OWNER-MASTER-LEDGER.md` (newest sections at the bottom), then the last section of `OWNER-FEEDBACK-2026-10-18-DAWN.md`, which holds his 12:15 pm words on v15 (D40-D57).

**The goal (owner, 9:15 am, D39):** the Play Store is parked. Deliver:
- **App:** v15 completely ready, now including his 12:15 pm feedback.
- **Website:** "perfected".

When both are published and checked, send him ONE message with the links, the APK and where to look (D37).

## Live
- **www.mockmob.in = main fc9e1f6b = release 7** (the new Today plus its fix round), pushed at about 1:10 pm after the verifier said GO. Vercel is READY, with 0 runtime errors at 1:20 pm. The STATUS entry is written together with release 8.
- The owner's phone (V2413, serial 10BF370PA6002XR, connected by USB) has v15 79aaca6d (1.0.15+3) installed. When the final APK is built, the main session installs it there with `adb -s 10BF370PA6002XR install -r`.

## In flight at 12:25 pm
A network drop at about 11:40 am killed 10 agents. Their commits and edits were kept, and two workflows relaunched every track.

**RELEASE 8 RE-VERIFIED GO at 00328e54 (2:25 pm)** in wt-rel8 (deploy/web-1018-r8). Fixed after the first verify: the landing hero Mobi flash over the headline on desktop (it was on live too), the Review row Repair now goes through the sealed retry, the Lab Cinema glow is gone (L-019), and the hero buttons show at 768 (L-013). The db verifier said GO; the migration is NOT applied yet. **Owner live preview: http://192.168.1.8:3208 (launch.json rel8-1018; port 3206 stopped).** On his OK: apply 20261018130000_free_ai_wallet_50 on production, then push 00328e54 to main (a fast-forward from fc9e1f6b), then check Vercel and write STATUS for releases 7 and 8. **Release 8: web-r8-1018** (wf_c433e7ef-d49, task wdwzaf5wf). It runs in wt-rel8 (deploy/web-1018-r8 from fc9e1f6b) and merges r8-fixes cb672f6b, r8-adopt dfc6797e, r8-retry f9fa1d82, land3 42b51dd3 and credits50 d8bc38d8. Three verifiers follow (pages, landing, db), then fix and re-verify. **Then:** the owner reviews live (D30); the main session applies the credits migration on production FIRST and pushes after.

**Workflow web-1218 (finished; R7 GO at fc9e1f6b):**

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
- **WEB DONE at about 1 pm: web/credits50-1018 at d8bc38d8** (wt-credits50).
  - Migration `supabase/migrations/20261018130000_free_ai_wallet_50.sql` plus its undo.
  - What it changes: consume syncs the allowance mid-month; reserve falls back to 50; the Free per-student cap goes from Rs 1 to Rs 2.50.
  - Staging dry-run passed, and the undo was proven.
  - Tests: billing 161/161, learning 357, recovery 556; app 595/596, the one failure being CRLF-only.
  - **Deploy order: apply the migration on production FIRST (under the grant, with STATUS), then push the R8 code.** The R8 verifier must review the migration SQL.
  - The global student-AI row is 1000000, the ceiling removed on 17 Oct; it is untouched.
  - Free practice: 100 credits at signup, no refill. Quick costs 10, a Full mock 50.
- **ui/v15-credits is MERGED into wt-v15 (06b6af85).** If the integrator has already started, it waits and merges after the integration instead.
- **Speed-up:** when the integrator commits the build bump, the main session builds the release APK in a separate worktree at that head while the walker walks.

**D50: DONE and MERGED into wt-v15 (959ba329 at 1:19 pm).** The checker said OK. The day-one line names the planner's first two chapters ("Start with ..."). The repo has no marks-per-chapter data, so it makes no claim about marks. **D50 (CTO decision): d50-length-1018** (wf_9e30dcc2-023, task wjsb1xkn5) builds in wt-v15-length (ui/v15-length).
- "How many questions?" offers 5/10/15/20 and a full mock.
- On day one, Weak chapters names the chapters with the most marks at stake.
- An independent checker reviews it. **The main session merges it into wt-v15 before the integrator** (ui/v15-credits is already merged, 06b6af85).

**v15.1 (approved 12:50 pm): v15-1-today-swipe** (wf_f3eaa161-76e, task wo26f9z62).
- **Build:** D52, the richer Today (wt-v15-today-rich), and D51, the Suggested stack (wt-v15-swipe), from 06b6af85. Each gets an Opus critic and fix loop, up to 2 rounds.
- **Then:** it waits for the final v15 APK, integrates in wt-v15-1 (ui/v15.1-1018), runs the full tests and a walk (screenshots in tmp/app-walk-1018d), and builds `tmp/apk/mockmob-v15.1-<sha>.apk`. Expected at about 5 pm.

**Usage:** 39% at 12:45 pm, resets at 4:10 pm. An account switch at about 95% is likely around 3 pm, and every workflow survives it only as commits. After a switch, relaunch from the worktrees.

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
