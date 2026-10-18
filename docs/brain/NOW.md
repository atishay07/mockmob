# NOW: MockMob current state (overwrite at every handoff; git keeps the history)

**Last written:** 19 Oct 2026, about 3 am IST, by session 25ef3d95 (main, Claude Opus 5.5, CEO/CTO). Usage reached 90%. The owner asked for a safe stop and a complete handoff "so it has everything that it needs: every decision, vision, all of it".
- **Agents:** at about 2:55 am every agent was told to commit and report. After that the main session stopped the rest and committed STOP POINTs in every dirty worktree. Read each worktree's git log for the final head.
- **Integration branches:** nothing merged yet; both are untouched at their bases.
- **The next-session prompt is `docs/brain/NEXT-PROMPT-1019.md`.**

## 1. The vision (stable)
- **MockMob:** prep for CUET UG 2027, Commerce first.
  - The USP: **unlimited mocks from one central bank**.
  - Score Recovery: find, repair and check each mistake.
  - Ask Mobi.
  - The Mob: friends sit the same weekly paper.
  - One credits balance: 50 free a month plus packs. Pro is Rs 99 on the web and Rs 150 on Play.
  - Per-question prices.
- **Users (G23):** 16-17-year-olds, many new to mobile apps and to CBT. If the owner finds a screen confusing, they will too. A fresh account must be complete without Pro or payment. Nothing is hidden.
- **Taste:**
  - premium and alive (HIGH, Revolut, Fampay), Mobi alive, refined motion;
  - refine, never rebuild; Night stays subtle; mock-ups before new layouts;
  - **the marketing copy matters most (D114):** persuasive, plain, grammatical, true.
- **KEEP:** the app's UI direction and Today, the bigger base and its animation, the common subject sets and picks, the first onboarding screen, swipe v2, release 9's Mob, one balance, per-question prices.

## 2. Why the earlier rounds failed, and the rules (PLAN-1019 section 0, R1-R8, word for word in every brief)
**What went wrong:**
- seeded-account checks;
- hiding as a fix;
- no comparison with the previous release, so polish was lost silently;
- checklists over experience;
- late merges with no owner;
- unreviewed STOP POINT work in releases;
- deadline pressure;
- no voice check on copy.

**The rules:**
- **R1** fresh account first;
- **R2** the 17-year-old line on every screen;
- **R3** never hide to fix;
- **R4** a side by side against the previous release;
- **R5** motion checked as frame sequences;
- **R6** copy in his voice;
- **R7** one owner per surface, and early merges by the main session;
- **R8** mock-ups first.

## 3. Every decision (his words verbatim in OWNER-FEEDBACK-2026-10-19.md)
- **D101:** Pro-only modes (NTA, Smart practice) are VISIBLE but locked while PLAY_BILLING is off: a quiet Pro tag, a calm sheet, no price, no web link.
- **D103:** colleges are ordered by last year's real closing marks per course and category, with the number shown.
- **D104:** Today shows "Your top 3 of N" plus "See all N".
- **D105:** the app bar becomes Today, Practice, Start, Mob, You. Review moves into Practice as "Your papers".
- **D106:** Your papers holds the stats strip, a subject filter, papers newest first (a tap opens the result and answers), then Mistakes to repair by chapter.
- **D108:** after Submit, restore FinishStage (from 68f63c11), then a completion line, the count-up, one next move and "See this paper".
- **D109:** "I don't know my range": one full mock per subject of the student's set, with progress shown per subject, then the estimated range (with its spread) and the colleges it reaches.
- **D111:** explain, then deliver autonomously beyond his expectation.
- **D112:** if he is away, pick the designer's recommendation.
- **D113:** no Autopilot tonight. "Continue a session" FORKS the session and duplicates live agents. Use "New run in a project" with a goal file.
- **D114, his picks:**
  - **web navigation A** (the same five places as the app; he likes B's clarity too: revisit later);
  - **Ask Mobi B** (its own screen, two big doors: Ask now and Ask your record);
  - **homepage motion C** ("select and type"); he judges it LIVE;
  - **the marketing copy matters most.**
- **D115:**
  - **push release 11 live when it passes its verifier;**
  - **the homepage motion ships OFF behind its flag** until he has seen it live and said yes.
- **C-dec 1 (CTO):** **every student's first full mock in each subject is free** (one per subject, ever; a started free mock counts). Without it, a free student (about 90 credits, with a full mock costing 50) could never finish D109. It is reversible; tell him.
- **Open for him:**
  - G26: which screen showed "5 questions ... Biology" at the top? (Default: the web Practice card.)
  - G3: confirm the college search keyboard on HIS phone (it works on the emulator).
  - The hero's resting line: after one lap, rest on "No more guessing." (C3's choice) or on the last phrase.
  - Older: the Razorpay test-card run, then WALLET_COMMERCE_OPEN; Play Console, then PLAY_BILLING_ENABLED; the PERSISTENT_LIMITS_ENABLED decision; W-044.

## 4. Where every piece stands (about 3 am)
**Live, untouched tonight:**
- Web = main 23a7c090 (release 10).
- App = v15.2 ab04b067 (1.0.15+7), on his phone (V2413, 10BF370PA6002XR).

**Integration branches (empty):**
- App: `ui/v15.3-1019` in `wt-v15-3` (base ab04b067).
- Web: `deploy/web-1019-r11` in `wt-rel11` (base 23a7c090).

Every brief is in `docs/brain/briefs-1019/`.

| Brief | Owner and items | Branch, folder | State |
|---|---|---|---|
| 06 | A4a web polish: G28 (keycap volt key, card edge lights and washes, NTA tile gradient and outline in the 2x2 grid, the Start key light) and G31 (one motion token file shared with the app, count-up 720 ms, a calm 1% spring) | web/1019-a4a-polish, wt-1019-a4a, **25821e85** | **DONE and verified:** lint, test:app 756, today 120, recovery 604, build; R4 and R5 evidence in scratchpad/a4a. **MERGE FIRST.** Copy: the NTA kicker reads "The closest thing to exam day". Kept out on purpose: the page glow, the landing aurora (L-019), the PrepOS orb. |
| 07 | A4b web UX: G29 sign out, G25 Review stats and D106, G26 ticket, G27 scroll cue | web/1019-a4b-ux, wt-1019-a4b | 4 commits by 2:55 am; report pending or STOP POINT |
| 01 | A1 app shell and Practice: G11, G15/D101, G17/D105, G20 structure | ui/1019-a1-shell, wt-1019-a1 | big change (40 files), STOP POINT; review it first |
| 02 | A2a onboarding and colleges: G1, G3, G4, G5, G6/D103, G9 | ui/1019-a2a-onboard, wt-1019-a2a | 2 commits + STOP POINT |
| 03 | A2b Today and the deck: G7/D104, G12, G13 | ui/1019-a2b-today, wt-1019-a2b | 1 commit + STOP POINT |
| 04 | A3 result and Your papers: G22/D108, G20/D106 | ui/1019-a3-result, wt-1019-a3 | 2 commits + STOP POINT |
| 05 | A5 range: G18, G19/D109, C-dec 1 copy | ui/1019-a5-range, wt-1019-a5 | 3 commits + STOP POINT; next: the tools unit run, then range_1019 goldens |
| 16 | C2 Ask Mobi B (app) | ui/1019-c2-ask, wt-1019-c2, **99431022 WIP** | Code written, NOT compiled. **Next:** analyze; the `door` query in insights_routes; header buttons in Today, Practice and Mob (you_page.dart gets a `trailing` parameter); the Practice card replaces the "Ask Mobi what to practise" row in top_rows.dart; the waiting text "Writing a reply"; update 6 old tests; new tests and goldens; the walk. "Do I change answers too much?" is locked for Free (the app already treats it as Pro): accepted. |
| 15 | C1 web navigation A | web/1019-c1-nav, wt-1019-c1 | in progress, STOP POINT |
| 17 | C3 homepage motion C behind the flag | web/1019-c3-hero, wt-1019-c3, **1c0957af WIP** | The flag (production = the current hero; preview `?hero=v2`), the timing controller and the component are written. **NOT DONE:** the option C CSS in hero-motion.css (exact values in its report and the prototype's hm.css), the tests, lint, build, strips and video. Phrase change in V2 only: "Every mark traced." becomes "See the lost marks." |
| 18 | W5 first full mock per subject free (server) | web/1019-w5-firstmock, wt-1019-w5, **2cc8ff9e WIP** | **The rule is DONE in code:** data/first_full_mock.js and src/lib/server/firstFullMock.js; it writes a learning_allowances row `first_full_mock:<subject>` (the primary key is the lock); the quote gives creditCost 0 and freeReason "first_full_mock_free"; the line to show is "Free: your first full mock in this subject is on us." **NOT DONE:** its tests, the web copy (dashboard cost row and tile, the pricing Free list), the checks. |
| 12 | G16 fresh-account baseline walk of v15.2 (no code) | tmp/walk-1019/baseline-v15.2, BASELINE-FINDINGS.md | partial |
| 13 | Web baseline captures of release 10 (no code) | tmp/walk-1019/baseline-web-r10, BASELINE-WEB-FINDINGS.md | partial |

**Done docs:**
- web navigation (WEB-NAV-1019.md);
- Ask Mobi (ASK-MOBI-1019.md);
- hero motion (HERO-MOTION-1019.md);
- ACCEPTANCE-1019.md (46 blocks plus the walk order);
- the disk clean-up (105 GB free).

## 5. What the next session does (in order)
1. **Start-up:**
   - Read sections 1-4.
   - Check usage.
   - Check no agent of session 25ef3d95 is alive (subagent transcripts under `~/.claude/projects/C--Users-atish-Desktop-mockmob-copy/25ef3d95-*/subagents/` written within 15 minutes).
2. **Merge A4a into wt-rel11 now.** It is done and verified.
3. **Relaunch every unfinished owner** from its brief word for word, plus: "RESUMED: review your commits and the STOP POINT first; then finish every item to its DONE WHEN; the notes in NOW.md section 4 say where you stopped."
   - One agent per worktree. A1 first (the biggest change).
   - Never merge unreviewed STOP POINT work blindly.
4. **Merge each owner when it finishes (R7):**
   - app into wt-v15-3, with analyze and the area's unit tests after each merge; never run flutter test and flutter build together;
   - web into wt-rel11, with lint, test:app, test:today, test:recovery and the build after each merge.
5. **One Opus copy pass** over every new line in both integration branches (D114), with a before/after list.
6. **The checks, per ACCEPTANCE-1019.md (walk order at the end):**
   - app: a fresh-account walk, then a heavy one (emulator, 360 dp, Night and Day), against a staging site running release 11 code (the rig launcher pattern on port 3104);
   - the R2 line per screen;
   - R4 against tmp/walk-1019;
   - R5 frame sequences;
   - web at 390 and 1440, Night and Day;
   - one Opus verifier per platform, 2 rounds at most. The main session then decides.
7. **Ship:**
   - **Release 11:** push to main as a fast-forward from 23a7c090 when it passes (D115). The hero stays OFF; send him the preview `?hero=v2` link. Then check Vercel and write STATUS.
   - **v15.3:** the release APK into tmp/apk/mockmob-v15.3-<sha>.apk plus a zip. Install it ONLY when he connects his phone (`adb -s 10BF370PA6002XR install -r`; main session only).
8. **ONE message** (docs/brain/MESSAGE-1019.md):
   - per G item: what changed and where to look;
   - the picks;
   - C-dec 1;
   - the hero preview link;
   - what is left;
   - ending with "Things needed from you right now" or "Nothing needed from your side".

## 6. Commands and facts
- **Common brief:** docs/brain/BRIEF-1019-COMMON.md (bases, tools, the emulator lock `C:\Users\atish\AppData\Local\Temp\mm-emu-lock`, staging rig, what agents return).
- **Flutter:** `MOCKMOB_FLUTTER_SLOTS=4 bash tool/flutter_locked.sh <args>`. The release build is `build apk --release --target-platform android-arm64 --obfuscate --split-debug-info=build/symbols --dart-define-from-file=dart_defines/prod.json`.
- **Staging:**
  - 3101 (old rig), 3102 relay, 3103 (release 9 + the Mob);
  - tmp/rig-1016e/RIG-READY.md;
  - fresh accounts are NEW staging test students.
- **Web:**
  - node_modules is a junction;
  - .env.local = PRODUCTION (preview fixtures only);
  - one dev server per folder.
- **IDs:**
  - Vercel: prj_uSolddribHQDl1mM5AKxg3O9qCIu, team_V5PhMz9hqV42vblUMcvhYqoN.
  - Supabase: production isrxrxzjocewrdureyhp, staging onwkqxmjqjrhfbjjdydu.
- **Rules:**
  - headless only; never sign in as him;
  - only gpt-6-luna and Claude Haiku 5.5 at runtime;
  - production DB under his grant (save, dry-run on staging, undo, STATUS);
  - STOP POINTs at 95% usage;
  - his words verbatim within the hour;
  - never a ship time before the walk's issue count is known (D99).

## 7. Lessons from this night
- **Autopilot's "Continue a session"** forked this session and ran 10 duplicate agents; he stopped it at 2:09 am.
- **Usage:** 13-16 Opus agents burned about 88% of a 5-hour window in about 1 hour. Size waves to the account.
- **The acceptance checklist caught a real product gap** (the range finder was unaffordable) before the build. Write acceptance steps first.
- **Agents told to "commit and report"** at handoff leave usable WIP commits and exact continue-here notes. Prefer that over hard stops.

## 4b. FINAL heads at about 3:05 am (all agents stopped; these supersede section 4's states)
| Worktree | Head | Note |
|---|---|---|
| wt-1019-a1 | a07c9484 | STOP POINT over the A1 work. It was at "Now the Mob tab test". Review first. |
| wt-1019-a2a | 4d557855 | "Onboarding copy pass and item tests (G1, G4, G6, G9)". Next: run the item tests, the emulator check of G3, the report. |
| wt-1019-a2b | 8dac41bf | STOP POINT. It was adding the G13 tests. |
| wt-1019-a3 | f0a4f21e | STOP POINT. It was adding goldens for the finish moment and Your papers. |
| wt-1019-a5 | 1d99057c | G18 done in code (re-run test/unit/tools); G19 built. Next: range_1019 goldens, update the tools goldens, the emulator walk. Open: should the Today range card show by default on accounts with no range, or only on opt-in? |
| wt-1019-c2 | 99431022 | WIP: Ask Mobi B; next steps in section 4. |
| wt-1019-a4a | 25821e85 | **DONE**. Merge first. |
| wt-1019-a4b | 0b395873 | All 4 items done in code. Lint passes; the new tests pass (startModel 16, review_page 15). Next: run test:app, today, recovery, auth and the build, the final captures and R4 against 23a7c090, the R2 lines and the copy list. Open: the one-line marks comparison above the papers was removed (the strip shows it); the trend chart shows only for All subjects. |
| wt-1019-c1 | b7d71d72 | WIP: nav A built, unverified. Next: update the 7 old nav tests, a new web_nav_a_1019 test, sidebar compaction thresholds, trim the You sheet by 15 px (it scrolls at 390), the checks, the captures, a merge-tree check against a4a and a4b. "Practice" kept in place of "Practise". The Mobi door line is "He explains any answer." |
| wt-1019-c3 | 1c0957af | WIP: hero C behind the flag; the CSS and tests are NOT done (section 4). |
| wt-1019-w5 | 2cc8ff9e | WIP: the free first mock rule is done in code; tests and web copy are NOT done (section 4). |

**G16 baseline walk** (partial, Night only): `tmp/walk-1019/BASELINE-FINDINGS.md` has 39 findings (9 HIGH, 18 MEDIUM, 12 LOW), 23 of them NEW. **The NEW HIGHs to fix:**
1. **The staging OTP sign-in fails.** RESEND_API_KEY is blank on staging. The walker used a throwaway proxy (scratchpad). The rig needs a staging Resend key, or a documented test-login path.
2. **The Suggested deck disappears from Today after the first paper.** A2b must fix it.

**Also NEW (MEDIUM):**
- the name shows as the email prefix;
- "0 of 4 study days" after a paper;
- Google looks active before the age question;
- the fresh Weak chapters block has no action;
- the confusing after-sign-in deck line;
- the result's "proof it stuck" names an unrelated chapter;
- "credits" means two pools with no label, and the practice balance still read 100 after a 10-credit set (check the server);
- a Review chapter title breaks mid-word at 360;
- the empty Repair button leads to an empty Review;
- Ask Mobi is missing a full stop.

**G7 evidence:** picks 4 and 5 look dropped from the ACCOUNT (You says 3 colleges), not just hidden on Today.

**Web baseline:** captures of release 10 in tmp/walk-1019/baseline-web-r10 (partial; stopped at Practice).

## 4c. Session 604ced81, 19 Oct about 4:50 am (supersedes 4 and 4b where they differ)
**Paused for the usage window (86%; it resets at 7:30 am IST). Resume in this session; every owner is resumable with SendMessage.**

**Web: release 11 is fully integrated and green.** `deploy/web-1019-r11` in wt-rel11 is at **9c6b3338**, with A4a, A4b, C3, W5 and C1 merged.
- **Checks after the last merge:** lint 0; app 777; today 120; recovery 610; billing 344; dock 49; learning 357; mob 78; auth 110; 0 failures; `next build --webpack` OK.
- **NOT done yet:** the Opus copy pass, the W1/W2 browser walks, the verifier, push.

**App: v15.3 (`ui/v15.3-1019` in wt-v15-3) is at d299f5de,** with A5 and A2a merged; analyze is clean and tools, onboarding and You tests pass (764).
- **Not merged** (each at a reviewed STOP POINT, with "Continue here" in its report):
  - A1 a06513e2: code, tests and goldens done; the full unit run, profile APK and fresh walk remain.
  - A2b 3ad3df32: fresh walk done; heavy walk and Day screens remain.
  - A3 00e8b863: practice result moment and Your papers done on device; the full-mock reveal and the heavy filter remain.
  - C2 02e7adbe: built and tested; the article fix, full unit run and walk remain. Also restore the insights Pro rows hidden by e3ca76be (D101).

**Copy-pass notes:** tmp/feedback-1019/COPY-PASS-NOTES.md, plus:
- about 27 app lines still say "in Review" (they should say "Your papers");
- A3's key reads "See it in Your papers" (he said "See this paper"; ask him);
- the bar labels hide on scroll (NAV-1017 approved this; ask him).

**Infra:**
- mockmob-hotfix\node_modules lost its scoped packages at 2:55 am. Every web worktree now links mockmob-next\node_modules (the common brief was updated).
- The OTP shim is mockmob-next/tmp/rig-1016e/otp-shim.mjs (SHIM_TARGET/SHIM_PORT).
- About 120 to 290 app goldens were already stale at v15.2. Agents regenerated only their own; decide after the merges.

**For his morning message:** the 2026 data puts LSR (912.5) above Hansraj (907.5) for B.Com (Hons), so D103 shows that order with the numbers. Colleges 4 and 5 were never lost from the account (it was a You display cap of 3, now 8).
