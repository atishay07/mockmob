# MockMob CTO loop (living document; update after every wave)

Owner, 15 Oct 2026 about 21:45 IST: "act as a CTO ... Keep on a self-improvement loop of: adding features; making them useful (that's the most important); refining the UI/UX, the motion, motion graphics design; improving the quality, fluidity, and better-looking mascot."

Sources this consolidates (his words win; read them when in doubt):
- the 93 owner messages of session 604ced81, 12-15 Oct (`mockmob-next/tmp/resume-2110/OWNER-MESSAGES-604ced81.md`);
- `OWNER-VISION-2026-10-15-PM.md`, with his standing goal and its checklist;
- `APP-UX-AUDIT-2026-10-15.md`, with 25 ranked findings;
- `HANDOFF-2026-10-15-EVENING.md`;
- the memory files `cto-mode-standing-goal`, `platform-focus-mobile-first`, `web-restructure-rejected`, `features-over-retesting`, `mockmob-design-direction`, `quality-bar-and-stop-rule` and `subagent-model-choice`.

## 1. The loop (every wave)

1. **Pick** from the queue (section 4): usefulness first, then what he named, then polish.
2. **Route.** Sonnet builds. Opus is used only for complex UI/UX, extreme motion graphics and polish. Haiku takes quick tasks under 5 minutes. Set effort explicitly on every agent. Planning stays in the main session.
3. **Build** on app and website together, on disjoint paths, continuing from the newest base. Never redo done work: check git log and the code first.
4. **Check once:**
   - analyze and the touched area's tests;
   - one web build;
   - goldens only where intended, opened and looked at.

   No emulator recordings unless he asks.
5. **Critique against his bar.** The main session asks for each change:
   - Is it useful? See the test below.
   - Is it richer than before, not plainer?
   - Is it balanced (not sparse, not over-gamified)?
   - Is it mobile-first on the landing?
   - Is it truthful?
   - Is it premium in motion?
6. **Ship what is safe:**
   - the website: merge, deploy, check Vercel;
   - the app: APK, then install on his phone if it is connected, and send the zip.
7. **Update** this file's status column and the brain checkpoint. Then go back to step 1. Stop only at about 95% usage, with a handoff.

**Usefulness test (the most important).** A feature ships only if it changes what a student does next:
- it gives a clear next action, one tap away;
- every number is from their own data or a cited source, with its denominator;
- a Class 12 student understands it in 3 seconds.

"Confusing" means improve the UI and the words. Never cut the feature.

## 2. The vision, consolidated (status as of 15 Oct 21:45 IST)

| # | Vision item (his words, short) | Status |
|---|---|---|
| V1 | The app is distinctive: "not just a copy of the website ... something more and the best out there" | ongoing |
| V2 | Premium feel like HIGH, Revolut and Fampay: glass, rich motion, generated imagery, "nothing but perfection" | ongoing |
| V3 | Mobi everywhere with emotions and actions, Duolingo-level; a better-looking mascot | partial: emotion kit and parity done; quality pass queued (Q6) |
| V4 | Motion graphics, fluidity, finish; judged in use, not static | ongoing |
| V5 | Balanced (crowded beats sparse; over-gamified is as bad as sparse); one spacing system; Night/Day parity | ongoing |
| V6 | Memorable post-mock moments (Undertone-style recap), supportive streaks, celebrations without pressure | done in the app (recap, milestones); web parity partial |
| V7 | Exciting, plain copy; no defensive sub-remarks or "illustrative" lines | done on the landing; app copy pass queued (Q3) |
| V8 | Mistake Lab is the USP, "10 times more useful"; insights no one else can give; SWOT after each mock | slices 1-3 live (slice 3 deployed 15 Oct about 23:00, main 3fc0095b); slice 4 building (wave N+1) |
| V9 | The website takes the app's clarity without being cut: landing mobile-first; arena desktop-first and phone-ready | v2 live; one gesture moves one step, footer sign-up, explanatory illustrations and the speed pass (41% fewer landing bytes) deployed 15 Oct about 23:00; arena pass 3 building |
| V10 | State-aware website: signed-in users go straight to the arena; content fits free, paid, new or returning | check in Q9 |
| V11 | Sign-in that just works (Google, email code, password, maybe phone) and stays signed in | Google and email fixed today; 403 insurance queued (Q1) |
| V12 | NTA mode exam-faithful on web and app; CUET-fit questions; prefer the newest questions | done (r5 live) |
| V13 | CUET tools (Compass, Combo, guide) integrated into the flow with hierarchy, not hidden | resuming (app tools packet); Q4 for the shared colleges list |
| V14 | You and Profile as a real hub: a top-bar avatar, findable light/dark, account settings, credits | wave 4a resuming; Q5 for the full hub |
| V15 | Ask Mobi integrated with credits; two credit names everywhere | wave 4a resuming; Q2 for the credits page and history |
| V16 | Stay on free plans until launch: usage fixes, fix 5, backups | fixes 1-4 live 21:10; fix 5 queued (Q8) |
| V17 | Minimal first-party analytics with consent (off for minors and unknown ages); quiet hours 11 pm-7 am | consent switch done; funnel queued (Q10) |
| V18 | Play Store release (14-day test) | owner steps pending |

## 3. Running now (updated 15 Oct about 23:05 IST)

- **Deployed tonight:**
  - usage fixes 1-4 (3be06112);
  - fix 5 A5 (d9e290eb);
  - the landing one-gesture fix, footer, illustrations and speed pass, plus Mistake Lab slice 3 (3fc0095b).

  Vercel READY, 0 runtime errors.
- **App:** feat/app-and-web 649c973c (waves 3 and 4a, Lab slice 3 app, the 403 fix). Analyze clean. APK v9 building.
- **Wave N+1 (wf_85d004db-503):**
  - Mobi quality pass: Opus high app rig, then a Sonnet web port (wt-mobi);
  - Lab slice 4: Sonnet high core, web and app, plus truth review (wt-lab4);
  - credits page and history (wt-you) and the You hub (app), Sonnet high;
  - arena on phones pass 3, Sonnet high (wt-arena3);
  - then a web check and an app check (Sonnet medium).

## 4. Queue (in order; skip anything the running wave finished)

| Q | What | Why (usefulness or his words) | Routing |
|---|---|---|---|
| Q1 | **Done 15 Oct 22:10** (24665cac on ui/phase2): edge-firewall 403 and HTML responses are now retryable "blocked", never a refusal. P0-2 and P1-14 were already done in 7be2e9ec. Left: show the "blocked" line on the runner's submit-pending screen (features owner), and a server analytics event | A paper or a queued write must never be lost | Sonnet high |
| Q8b | NTA index (A6) in production, **only once publishing rebuilds it automatically**: a stale index silently drops newly published questions from NTA papers, which breaks "prefer the newest questions". Make the authored-publish step (or a daily cron) run nta-index-build for the touched subjects, then apply per RUNBOOK-NTA-QUESTION-INDEX-2026-10-15.md. Also decide on chunking _userProgress (Accountancy history is ignored above about 700 ids) | Egress at scale; newest questions kept | Sonnet high |
| Q2 | Credits: two names only; one Credits page with both balances, the renew date and a history list (new GET /api/me/credits/history); every spend line names its pool and total (P1-12, 13) | Students must see what they spend | Sonnet high, web plus app |
| Q3 | Copy and naming pass: Ask Mobi everywhere, Quick practice (10 questions), the audit's jargon list (P2-18, 19) | Plain words | Sonnet medium |
| Q4 | One "My colleges" list on the server, shared by Today, Compass and You; Choose opens the chooser; Compass hierarchy and score prefill (P1-5 to 9), if the tools packet left them | Tools in the flow, not hidden | Sonnet high |
| Q5 | You as a real hub (audit section 3: profile, plan and credits, appearance, notifications, study days, colleges, progress, sign-in, privacy, help with FAQ) | "Doing a bit less" | Sonnet high |
| Q6 | **Mobi quality pass:** a better-looking rig, more actions and emotions, smoother motion, the same Mobi on web (I3 web half) | V3, his explicit ask | Opus high (rig and motion) plus Sonnet medium (web port) |
| Q7 | **Mistake Lab slice 4:** the trap atlas, "same mistakes later" (spaced re-check), the key-quality loop | V8, the USP | Sonnet high; Opus only for its signature visual |
| Q8 | **A5 deployed 15 Oct about 22:15** (main d9e290eb): a slim session start, with picks identical to before; per start, about 8.3 MB becomes 3.5 MB for Accountancy and 6-7 MB becomes about 1.8 MB for the others; kill switch PRACTICE_SLIM_READ=off. A6 is held (see Q8b). Weekly backup: owner steps in the Q8 report (Supabase CLI dump with the DB URL in a user environment variable). Agents testing on staging: still to do | V16; before more testers | Sonnet high |
| Q9 | Website arena on phones, pass 3: Today's dropdowns, Review details, the critic leftovers in tmp/web-v2-pass2/critic-2; state-aware entry for signed-in users | V9, V10 | Sonnet high; Opus for motion polish |
| Q10 | Analytics funnel (server-side, consent-respecting) and app crash reporting | Know what breaks | Sonnet medium |
| Q11 | Web halves of motion language, living objects and sharp scenes, where the website lacks them | Parity, fluidity | Sonnet high; Opus for the object flight |
| Q12 | Bar blur 24 sigma with lighter tints; the capsule never covers the hero; the week strip skeleton (P2-20, 22, 24) | Finish | Haiku low or Sonnet low |

## 5. Owner items (ask only for these)

- Delete the 5 paused Vercel projects.
- Say whether students can reach Razorpay checkout today (this decides when to move to Vercel Pro).
- Play Store: the upload key, the Google client ID, Play Console.
- One Mistake Repair on the site, to verify the v3 cost.
