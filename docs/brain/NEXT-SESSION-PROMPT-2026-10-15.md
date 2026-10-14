# Prompt for the next MockMob session (paste as the first message)

Continue MockMob from session cc0bf1af, which stopped near its usage limit on 15 Oct about 02:15 IST. Before changing anything:
1. Run continuum_start for project "mockmob". Read C:\Users\atish\Desktop\mockmob copy\mockmob-next\docs\brain\HANDOVER-2026-10-15-NIGHT.md fully, including every "Update" section.
2. Read the memory files quality-bar-and-stop-rule.md, mockmob-design-direction.md and disk-hygiene.md.
3. Check whether two workflows finished. If they were cut off, resume them with the Workflow tool and resumeFromRunId. Their scripts are in the session's workflows/scripts folder (mockmob-alive-and-refined, mockmob-app-phase-2-round3); copies of earlier scripts are in mockmob-next/tmp/workflows.
   - wf_ede58103-677 ("alive and refined": app builders plus app and web checks)
   - wf_1fb2ccb3-a45 (round 3: cold start and goldens)

Then, fast (the owner wants speed and many parallel agents; do not wait on full suites before building):
1. **App** (worktree C:\Users\atish\Desktop\mockmob copy\wt-phase2, branch ui/phase2):
   - Commit, then run whole analyze. Run unit tests in 3 batches. Regenerate the stale goldens (test/golden/art and any area the builders changed), and open the changed images.
   - Merge into feat/app-and-web (mockmob-next).
   - Build release APK v3 in mockmob-next/flutter_app: `bash tool/flutter_locked.sh build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`. If CMake says "Permission denied", delete build/.cxx and retry. Use MOCKMOB_FLUTTER_SLOTS=3 if both slots are busy.
   - Zip the APK (it is over the 30 MB phone limit) and send it to the owner with SendUserFile.
   - Record the profile demo on the emulator (AVD mockmob_budget, -memory 2048; stop the Gradle and Kotlin daemons first). Use flutter_app/tool/emu_rec.sh: `tapd "^Submit practice"`, not "^Submit". Send the owner a compressed clip.
   - Fix finding 28 (demo resume card count).
2. **Website** (worktree wt-web-refine, branch web/alive-1015): run the suites (test:recovery, test:learning, test:app, test:nta, test:auth, test:answer-integrity) and eslint. When green, push to main (deploys are allowed tonight), then check Vercel (project prj_uSolddribHQDl1mM5AKxg3O9qCIu, team team_V5PhMz9hqV42vblUMcvhYqoN) and the live site.
3. **Verify Mistake Repair on Luna:** the owner added OPENAI_API_KEY in Vercel; the redeploy was 6e4b64ed. Use the Supabase MCP (project isrxrxzjocewrdureyhp): runtime_ai_requests should show openai gpt-6-luna rows after a repair.
4. **Ask the owner:**
   - 6 duplicate Vercel projects named mockmob*: remove the extras?
   - What does the MOCK_AI env do in Production?
5. **App parity for web repair v2:** the app review area should match the web repair v2 screens (the audit's section 5, docs/brain/REPAIR-LAB-AUDIT-2026-10-14.md).

Rules:
- The owner's words win.
- The owner has granted standing database authority (Supabase MCP) and allowed deploys of tonight's work.
- No regressive changes; preview taste changes.
- Every feature is built the same on app and web.
- Keep the disk clean.
- Commit WIP often.
- Give honest progress with percentages.
- Stop only at about 97% usage, with a handover.
