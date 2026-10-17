# NOW: MockMob current state (overwrite this file at every handoff; git keeps the history)

**Last written:** 18 Oct 2026, about 2:00 am IST, by session 604ced81 (Claude Opus 5.5, main, acting as CEO/CTO).

**Read next:**
1. `OWNER-MASTER-LEDGER.md`: every open owner ask, by surface.
2. `OWNER-FEEDBACK-2026-10-18-DAWN.md`: his newest words.

This file is only the state, with what to do next.

---

## 1. Why the session stopped
- The 5-hour usage reached 94% at 1:50 am (it resets about 2:50 am). The owner said: "slowly and safely stop everything... prepare the final handoff along with the prompt".
- All three workflows were stopped mid-stage. Unfinished work was committed as **STOP POINT** commits; nothing is uncommitted.
- Leftover dev servers and Flutter tests were stopped. Still running on purpose: the staging rig on 3101, the USB relay on 3102 and the adb server.
- C: has 135 GB free; memory commit is 26 of 64 GB.

## 2. Live
- **www.mockmob.in = main 9578ee66 = website release 4.** Vercel dpl_APxT7dGMgtBCc6CehsWmXSwuJ7cn is READY, with **0 runtime errors in the last hour**.
- **Release history tonight** (each verified by an independent verifier before the push):

  | Release | main | Contents |
  |---|---|---|
  | R2 | 12997f5a | security, AI cap, ledger fixes, three production migrations |
  | R3 | 5d0c46f2 | Today plus nav fixes. **His preferred Today base (D1).** |
  | R4 | 9578ee66 | Today redesign (**REJECTED**, D1); result restore (better, not there yet, D15-D17); practice polish (**liked**, D4); Mobi orb (**REJECTED**, D6); five-subject cap |

- **The STATUS.md entry for R3 and R4 is not written yet.** Add it in the next website push. Facts: R3 verifier PASS; R4 verifier PASS with suites app 502, recovery 415, learning 357, auth 110, billing 153, nta 188, today 32, mob 45, subjects 30, du 42 and dock 74.
- **Production DB:** unchanged since the three migrations of 17 Oct (in STATUS 12997f5a). **The Mob migration is NOT on production.**
- **App:** v13 (1.0.13, e0939ad2) is the last delivered APK, at `tmp/apk/mockmob-v13-e0939ad2.apk`.

## 3. In flight (all stopped; each sits at a commit)

| Track | Worktree and branch | Head | State | Next |
|---|---|---|---|---|
| **v15 merge** | wt-v15, ui/v15-1018 | 76ee2e90 | v13 plus the 4 v14 branches; analyzer, unit tests and goldens green; versionName 1.0.15 | the base for integration |
| **v15 Today** | wt-v15-today, ui/v15-today | d4c75899 | Built to V15-SPEC section 2: the "Your road to CUET" card and the Adjust plan sheet. **That design mirrors the R4 Today he rejected (D1).** | **Don't integrate as is.** See decision A below. |
| **v15 result and Review** | wt-v15-result, ui/v15-result | c501ddd3 STOP POINT | Partial, unchecked (100 files). Built to V15-SPEC section 3. | Finish, then run analyzer, tests and goldens. Then check against D15-D17 (one action label per mistake; the bar sized to the mock; replay useful or cut). |
| **v15 polish** | wt-v15-polish, ui/v15-polish | 7c806823 STOP POINT | Partial, unchecked (76 files). V15-SPEC sections 4 and 5: stem twice, bottom pull, stale offline, credits, Repair chip, Review notice, account shift, small items. | Finish, then test. |
| **Landing** | wt-land2, web/land2-1015 | 48e7b057 | Checklists 1 and 2 and fixers 1 and 2 are done; fixer 2 fixed L-024 on /terms and /about; tests 92 of 92. Checklist 3 (the re-check) was stopped before its result. | Re-run the checklist on 48e7b057. If every L item passes with zero truth and zero high defects, the main session pushes it (memory landing-checklist-gate). |
| **The Mob** | wt-mobfix, web/mob-fix-1017 | 07ed5b3f STOP POINT | **Gate on staging: NO-GO, 8 of 10** (details below). The fix round was partial. | **On hold until the owner decides D21** (whether to suspend the community idea). |
| **F15 Revise** | wt-lr2, web/lr2-1017 | 24ca2081 | Built; verified at 390 and 1440, Night and Day | Goes into web release 5 after the main session checks it against D20 |
| **F15 Concepts** | wt-lr3, web/lr3-1017 | c075eda3 | Built | Same as Revise |
| **F15 Review (P-LR1)** | none | | On hold | His new idea, D18: Review leads with weak chapters. Design it with D18. |

**Mob gate defects (staging, wf_2f81582e-2f5):**
1. **Medium:** the member "..." menu button renders at 52×32 px, under the 44 px target. The unit test checks CSS strings, not the render.
2. **Medium:** the create limit of 3 a week equals the Pro cap of 3, so a Pro student who starts a 4th Mob gets "You started 3 Mobs in the last 7 days..." instead of the plan-limit message.
3. **Low-medium, privacy:** the per-question "picks" counts include members who opted out of sharing, so a hidden pick can be worked out in a small Mob.
4. **Low:** a failed join counts toward the 10 joins an hour.
5. **Low:** with MOB_ENABLED=false, /mob returns 200 with a not-found body instead of 404.

**Staging leftovers:** the 'pro' invites are locked for 24 h; f cannot start a Mob for 7 days; u1 cannot join for an hour.

**Workflow scripts** (resume works only inside the session that ran them; a new session re-launches):
- Scripts: `docs/brain/workflows-1017*`, and the session folder `~/.claude/projects/C--Users-atish-Desktop-mockmob-copy/604ced81-.../subagents/workflows/`.
- Journals (each agent's actual result) are in the same folders.

## 4. Decisions waiting on the owner (ask at the start of the next session; one question each, with a recommendation)

**A. v15 and the Play Store date.** v15's Today follows the rejected design.

| Option | What it means |
|---|---|
| **A1 (recommended)** | Ship v15 to the Play Store with the v14 Today fixes only (the v13 Today plus "See why", "Something else" and honest counts). Leave out the v15 Today packet. The new Today comes in 1.0.16 after he approves a mock-up. Play review for a new app takes days anyway. |
| A2 | Hold v15 until the new Today is designed, approved and built. That adds about half a day and moves the 7-8 am target. |

**B. D21: community.** Suspend the community idea or keep it? That decides the Mob track and the D22 "social circle" brief.

**C. Transcription confirms:**
- D5: "Repo S" = Repairs?
- D6: "Ask section" = the Ask Mobi panel?

**D. Owner items:**
- the Play Console account and upload key;
- the Anthropic key;
- the Avast HTTPS-scanning exception (the 3 am TLS failure);
- 112 held questions; a Hindi reviewer; free first Repair.

## 5. Next steps, in order (the main session designs; agents build; Sonnet by default, Opus only where taste is the work)

**1. Start (about 15 min).**
- Read this file, then the ledger, then the memory index.
- Check usage.
- Ask the owner decisions A and B.

**2. Web release 5, the quick wins (about 2 h with parallel agents).**
- **D7 Night:** compare the Night tokens, accents and glows of the last pre-R2 production (the main parent of 12997f5a) with R4. Restore the subtle Night.
- **D10:** the theme switcher animation back to the old quality.
- **D13:** the phone bottom-nav pulse on Practice.
- **D11:** Help renamed and moved to its own page.
- **D5:** Repairs and Mobi entry points on Practice.
- **D15:** one action label per mistake; counts agree.
- **D17:** the bar sized to the mock length, with expand and collapse.
- **F15 Revise and Concepts** (wt-lr2, wt-lr3).
- **Gate:** suites, then a 390 and 1440, Night and Day check against each D item. Then the STATUS entry for R3-R5. Push.

**3. The new Today, web and app (D1-D3).**
- The main session writes the design, based on the R3 Today and refined. It must be interactive and leading; no form-like plan; reorder; more of the important information.
- Make a clickable mock-up and show the owner before building.
- After his yes: a web packet and an app packet in parallel (about 1½ h), verify, ship.

**4. Ask Mobi redesign (D6, D12).**
- The main session writes the brief: purpose, entry points, contents, placement, motion; no neon.
- Mock-up, then the owner, then build.

**5. Review and result depth (D16-D18).**
- Review leads with weak chapters (his idea).
- The depth layer gets one calm structure.
- Replay becomes useful or is cut.
- Mock-up first.

**6. v15 per decision A.**
- Finish the result and polish packets from their STOP POINTs (about 1 h).
- Integrate into ui/v15-1018 (about 45 min).
- Emulator walk against F, N, D (app) and L01-L39, plus one Opus critique (about 1½ h).
- One fix round (about 1 h), a confirm walk (about 45 min).
- Release APK and AAB 1.0.15 (about 30 min).
- Then the Play Store readiness list (V15-SPEC section 7).

**7. Landing:** re-run the checklist on 48e7b057, then the ship check, then push. This can run in parallel with step 2.

**8. After that:**
- the re-audit of every W item on live;
- badges D19; Learn's place in navigation D20;
- the Mob (after decision B);
- the D22 social-circle concept brief;
- Higgsfield.

## 6. Rules that bit tonight (in memory; repeated here because they cost hours)
- **Refine; don't rebuild.** Mock-ups first for any new layout (memory web-restructure-rejected).
- **Never SendMessage a running workflow agent.** It creates a duplicate.
- **Agents stop only processes they started.** Never run chrome.exe directly.
- **Before `git worktree remove`,** unlink any node_modules junction (`cmd /c rmdir <wt>\node_modules`); otherwise it deletes the shared install in mockmob-hotfix.
- **Dev servers** need `NODE_OPTIONS=--max-old-space-size=4096` (they grew to 6-11 GB without it).
- **Keep C: at 100 GB or more free.** Clean build output after every run.
- **Check usage before every wave.** At about 90%, stop starting new stages. At about 94-95%, stop and hand off.
- **Git push to main** may open a GitHub sign-in that the owner must answer.
