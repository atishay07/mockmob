# MockMob owner master ledger (living file: read it first, update it at every session end)

**Why this file exists.** The owner (18 Oct, 1:45 am): "I have to explain and give the same feedback again and again, so that should not happen."

His asks were spread over six dated ledgers, so agents missed items. This file is **the one list of what he has asked for that is not yet done**, grouped by surface, with his latest verdict.

**How to use it:**
- **Start of a session:** read this file. Then open the source files only for the rows you will work on.
- **New owner feedback:**
  1. Save his words verbatim in a dated `OWNER-FEEDBACK-<date>.md`, with a ledger and "(confirm)" flags on transcription guesses.
  2. Then fold every item into the rows here: update the row, or add one.
- **When something ships:** set its status, giving the release and sha. **DONE means verified on the live site or a walked APK**, not just merged.
- **When he rejects something:** set REJECTED, quote him, and add the lesson to "Never again" below.

**Status words:**
- **OPEN:** not started.
- **BUILT:** on a branch, not live.
- **LIVE-UNCHECKED:** live, but he has not looked.
- **DONE:** he accepted it, or it was verified live.
- **REJECTED:** he rejected what shipped; redo it.
- **DECIDE:** his decision is needed.

**Sources, newest first:**

| Prefix | File |
|---|---|
| D | `OWNER-FEEDBACK-2026-10-18-DAWN.md` (18 Oct 1:45 am, after R4) |
| N | `OWNER-FEEDBACK-2026-10-17-NIGHT.md` |
| F | `OWNER-FEEDBACK-2026-10-17.md` |
| W, L | `WEB-OWNER-LEDGER-2026-10-17.md` (web W-001-W-100, landing L-001-L-045) |
| App L | `APP-OWNER-LEDGER-2026-10-16.md` (L01-L39) |
| v15 | `V15-SPEC-2026-10-18.md` (the v13 walk findings) |

His full message history is in `tmp/owner-corpus` (286 messages).

---

## Never again (his rejections, each a rule)

1. **Refine, don't rebuild.**
   - 15 Oct: the web restructure was "a huge regression".
   - 17 Oct: the result redesign was "not acceptable at all".
   - 18 Oct: the Today redesign was "a huge regression".

   When he calls a screen confusing, keep its information and structure and refine the UI and interaction. Any replacement layout is shown to him as a mock-up before it ships.
2. **Never simplify by cutting.** Never remove "the good stuff" (mascot moments, the full analysis, rich cards) to reduce clutter. Reduce clutter by structure, not deletion.
3. **Nothing looks like a form.** Settings and plan surfaces are leading, interactive flows that take you to the next thing (D3).
4. **Night mode stays subtle.** No neon, no heavy glows or accents (D7). He loved the earlier Night.
5. **Motion must not degrade.** A changed animation is at least as good as the old one (D10 theme switcher, N5 segmented controls).
6. **No obvious disclaimers or filler lines** (W-093). No "41 subjects" (W-095). Copy tone is exciting and bold (M-006, 18 Oct), never false.
8. **Keep the badges** (D19, 18 Oct): refine them, never remove them.
7. **Only gpt-6-luna and Claude Haiku 5.5 run in the app or website** (W-098).

## Keep (he praised these; don't touch except for bugs)
- **Practice and Start:**
  - the Practice UI ("really refined, looks really good", D4);
  - the subjects loop ("perfect now");
  - the Start session sheet ("loved", N11).
- **Result:**
  - the answer sheet and overall summary (N16);
  - scores by session (N14);
  - the front of the result (marks, right/wrong, accuracy, blank; D16).
- **Elsewhere:**
  - the weak chapters content (N13);
  - Progress on phone (D19, except badges);
  - the R4 Today's cleanliness (D1; the layout itself is rejected);
  - the mobile web UI overall (D14);
  - Day mode (N10).

---

## Open items by surface (website unless marked)

### Today (web and app): **TOP PRIORITY, REJECTED in R4**

| Status | Item |
|---|---|
| REJECTED | **D1, D2:** R4 Today (main 9578ee66) is "a huge regression": clean, but not tangible, and it lacks the information. Go back to the R3 Today (5d0c46f2) information and structure and refine it. It must lead the student and be interactive, more than "start 10 minutes". Reorder; add more important things. **The main session designs it and shows the owner a mock-up first.** |
| OPEN | **N1 (still true for the R3 base):** the long road strip is hard to read (only a few weeks in focus), and the mock-count slider does nothing a student understands. Fix both inside the R3 structure. |
| OPEN | **D3:** the Change plan sheet is okay, but must never look like a form; it must be a leading, interactive flow. |
| OPEN | **W-042:** loads fast with no section arriving late; works for an account with history. |
| OPEN | **W-044:** a cue leads to the road below the fold. |
| BUILT, REJECTED design | **App v15 Today packet:** built the R4-style "Your road to CUET" card and Adjust plan sheet (V15-SPEC section 2) in wt-v15-today. **It follows the rejected design. Redo it per D1-D3 before v15 ships** (see NOW.md). |

### Result (web and app)

| Status | Item |
|---|---|
| LIVE-UNCHECKED, partly REJECTED | **N12:** R4 restored the reveal and the full analysis; he says it is "back and better" but not what he wanted (D15). |
| OPEN | **D15:** one clear action per mistake. Today one screen mixes "Repair first", "Repair in 1" and "Check it here" for 5 mistakes; use one label and counts that agree. |
| OPEN | **D16:** the depth layer is cluttered; give it one calm structure. |
| OPEN | **D17:** the answer bar fits the mock's length (10 questions, then 10 slots), with expand and collapse. Replay is useless today ("grey boxes going and going"): show real events (answers, changes, skips, time per question) or cut it. |
| OPEN | **N15:** "Chapters by marks left open" is not good. R4 replaced it with "Where your marks went"; check it. |
| OPEN | **W-026/029/030:** layers, the SWOT with one-tap recommendations, a memorable reveal. |
| OPEN | **F11:** what Repair adds must be obvious; nothing shown twice. |
| OPEN (app) | **v15 walk findings 1, 4, 5:** the stem shows twice; stale credits after a set (10 credits for both 5 and 10 questions); the Repair chip doesn't start a repair. |

### Review, Repair and Learn

| Status | Item |
|---|---|
| OPEN | **D18:** "We have tried so many times to fix this stuff, but no result." His idea: Review leads with the **weak chapters** (marks lost by chapter, Practise), with mistakes under each. |
| OPEN | **F17, W-038:** a repaired mistake opens its saved repair (never a paid repair again). Each mistake shows its mock and its date and time (12-hour). |
| OPEN | **W-032, W-033:** Repair lets the student try again before seeing the key; it completes on staging with no error. |
| OPEN | **W-034, W-035:** Mistake Lab timing and the v4 dashboard. |
| OPEN | **D20, F15, W-040:** Learn needs a clear place in navigation and a real refinement pass. F15 Learn/Review work: Revise and Concepts are BUILT in wt-lr2 and wt-lr3; the Review part (P-LR1) is ON HOLD until he accepts the result. |
| OPEN (app) | **v15 finding 7:** the Review notice is duplicated, covers content, and its counts disagree. |

### Practice, Start, runner and NTA

| Status | Item |
|---|---|
| OPEN | **D5:** the Repairs [confirm] and Mobi entry points are missing from Practice ("no one will be able to see it ever"). |
| LIVE-UNCHECKED | **N2:** the blur is lighter. |
| LIVE-UNCHECKED | **N3:** the fine-tune copy. |
| LIVE-UNCHECKED | **N5:** one sliding indicator. |
| LIVE-UNCHECKED | **N7:** "CS/IP". |
| LIVE-UNCHECKED | **N8:** the NTA bar is continuous and the timer works. |
| LIVE-UNCHECKED | **N11:** spacing. |
| LIVE-UNCHECKED | **N6:** the five-subject cap (the picker note lacks a 2026 qualifier). |
| OPEN | **N4:** fine-tune "something better can be done" (an open design question). |
| OPEN | **F12:** the Quick practice Start button state flicker on scroll. |
| OPEN | **W-002/003/005/008/012:** remaining Start menu affordance items. |
| OPEN | **W-013:** the Practice cards' blue light and texture. |
| OPEN | **W-017/018:** the runner's top notice; no privacy filler line. |
| OPEN | **W-023:** NTA strike guard. |

### Ask Mobi

| Status | Item |
|---|---|
| REJECTED | **D6, D12, N9:** the R4 orb and panel: "very old", "too much clutter", "neon", "weird UI"; "only Your Record works"; it should not sit below the theme selector. **Needs a redesign brief from the main session (purpose, entry points, contents, placement) before building.** Also the R4 caveat: the panel is dark in Day mode. |
| OPEN | **W-060:** the cost is shown before each call; the balance updates. |

### Night mode, theme and icons

| Status | Item |
|---|---|
| REJECTED | **D7:** Night is now too highlighted and neon. Find what changed in the Night tokens, accents and glows between pre-R2 production and R4, and restore the subtle Night. |
| REJECTED | **D10:** the new light/dark switcher animation is worse than the old one; restore it. |
| OPEN | **D8, W-069:** icons (a consistent family; no odd glyphs). |
| OPEN | **W-075, W-076:** one volt key per viewport; the slop list (no glow, no gradient text, no nested cards). |
| OPEN | **W-078, W-079:** Night and Day parity; 44 px targets. |

### Navigation, sidebar and dock

| Status | Item |
|---|---|
| OPEN | **D11:** the sidebar bottom (My Account, Help, theme): "Help" is the wrong word and the wrong place. If kept, it becomes its own page, not a scroll. |
| OPEN | **N17:** the guide section is more intuitive. |
| OPEN | **D13:** the phone bottom nav active pulse looks wrong on Practice ("text and line"). |
| OPEN | **F13, W-068:** the dock and Start placement. |
| OPEN | **W-070:** the "Arena" label is clear. |
| OPEN | **F2, W-067:** Colleges' home in navigation (researched; the same on web and app). |

### Progress, You and badges

| Status | Item |
|---|---|
| OPEN | **D9:** "Not much implemented". |
| OPEN | **D19 (clarified 3:50 am):** "badges are not incorporated properly but they look cool so keep them don't remove just refine the UI and functionality around them." Keep the badges; refine their presentation, placement and what earning one does. BADGES-ICONS-1018 option A (remove) is REJECTED. |
| OPEN | **W-053:** You leads with study days, badges, milestones and personal bests. |
| OPEN | **W-052:** the top-bar Profile shows name, email, credits and plan. |

### Colleges and Compass

| Status | Item |
|---|---|
| OPEN | **W-047, W-049:** colleges are picked inside onboarding. |
| OPEN | **W-050:** Compass is prominent. |
| OPEN | **W-051:** the cutoff calculator's "New" tag and green line. |

### Social: community, leaderboard and the Mob

| Status | Item |
|---|---|
| DECIDE | **D21:** maybe suspend the community idea and remove the community section (not final). Keep "Your standing". Don't delete anything until he decides. |
| OPEN | **D22 (name DECIDED 3:50 am: Mob; "community" retired):** a concept brief for a cooler, useful "social circle". Reference: an app he called "RPM" (leaderboard, aura, badges); he finds it cringe, so don't copy. |
| OPEN | **W-055:** the leaderboard is the richer earlier design. |
| BUILT | **The Mob:** web wt-mobfix c33d7f03 plus a fix round, 18 Oct; the app side is in v13/v15, off. **It switches on only at 10/10 after the gate** (the steps are in NOW.md). Square this with D21 first. |
| OPEN | **W-061, W-062:** the Mob on the main surfaces. |

### Pricing, auth, copy and whole-site items

| Status | Item |
|---|---|
| OPEN | **W-097:** the pricing visual upgrade. |
| OPEN | **W-057:** sign up and login improvement. |
| OPEN | **W-093/094/095:** copy truth and no filler. |
| OPEN | **W-064, F18:** guided entry points for every feature (adoption). |
| OPEN | **W-072/073/077/082/083/087:** the premium bar, motion, anti-slop, subject art, balance and detail sweeps. |
| OPEN | **W-085:** web and app parity. |
| DONE (audit) | **W-091:** re-audited on live R6 on 18 Oct (`W-REAUDIT-2026-10-18.md`): **71 PASS, 21 PARTIAL, 0 FAIL, 4 not testable, 4 superseded** (was 37/49/11). The open items are being fixed in R7/R8 (see the 9:50 am row below). |

### Landing

| Status | Item |
|---|---|
| BUILT, gate running | **L-003-L-045:** wf_b167ffb5-960, wt-land2. It ships on the fixed checklist: every L item passes, zero truth and zero high defects, each fix locked by a test. The score is advisory. |

### App (Flutter)

| Status | Item |
|---|---|
| BUILT, in progress | **v15 = the Play Store candidate** (`V15-SPEC-2026-10-18.md`). |
| OPEN | **F1:** the nav count and alignment. |
| OPEN | **F3:** the liquid-glass taste. |
| OPEN | **F9:** the fine-tune scope. |
| OPEN | **App L01-L39** (`APP-OWNER-LEDGER-2026-10-16.md`). |
| OPEN | **v15 walk findings 1-9.** |
| OPEN | **D-items carry over to the app:** Today D1-D3, result D15-D17, Review D18, Ask Mobi D6, Night D7. |
| OPEN | **Play Store readiness** (V15-SPEC section 7): the upload key and the Console are the owner's. |

---

### Added 18 Oct 2:30-4:10 am IST (session 25ef3d95; his words in OWNER-FEEDBACK-2026-10-18-DAWN.md, end sections)
| Id | Surface | Item | Status |
|---|---|---|---|
| A2 | App | Hold v15 for the new Today (decision A) | v15 waits for Today |
| D25 | Today (web, app) | Proceed with TODAY-1018 into v15 | building (web wt-today18, app wt-v15-today2) |
| D26 | Today | Road to CUET shows due today, due this week and the overall goal | building |
| D27 | Today | Must feel unique and premium in the final UI, not generic | building; critic checks |
| D5 | Practice | "Repo S" = Repairs (CTO decision; he could not confirm) | built in R5 (web/r5-practice-1018), not live |
| D6 | Ask Mobi | Confirmed = Ask Mobi; ASK-MOBI-1018 approved | web wt-r6-askmobi, app wt-v15-askmobi |
| D16-D18 | Review, result | REVIEW-RESULT-1018 approved | web wt-r6-review; app after v15-result |
| D21 | Community | Keep for now; hide contributions per COMMUNITY-1018 (approved) | web wt-r6-community (with D20) |
| D28 | Today (app) | "Back from marking": bugs seen on v13: greeting by hour ("Good evening" at 2:41 am), "Still refreshing" stuck, row under the bar | v15 integration |
| D29 | Today, result | Replace the fake "Back from marking" wait with a truthful reel: "Play your paper back, 20 s" (same engine as the D17 replay) | app widget wt-v15-reel; web in R6 replay |

### Added 18 Oct about 3:45-4 am IST (his words in OWNER-FEEDBACK-2026-10-18-DAWN.md, last sections)
| Id | Surface | Item | Status |
|---|---|---|---|
| D30 | Landing, big pages | He reviews the landing live himself before any ship (local dev server or preview); screenshots are not enough | rule |
| D31 | Landing | The landing does not follow his instructions; the next pass starts from his own landing words, not critic scores | open |
| D32 | Landing | The landing branch (wt-land2 48e7b057) is a "major regression": do NOT ship it. Keep only (a) the held-story position indicator at the top (Mistake Lab, What's inside) (confirm the element) and (b) the top light/dark toggle; port those two into the CURRENT live landing | open |
| D33 | Website | Release 5 changes were not visible to him ("seems the same"); every release must make his asks visibly obvious and say where to look | rule |
| D34 | Process | Work until about 80% usage, then stop safely with the handoff and the prompt | done this session |
| M-001..M-027 | All | Missed asks from the 12-17 Oct corpus: `MISSED-ASKS-2026-10-18.md` (M-001 logo 3 s and M-006 "exciting copy" need his decision; M-018: end every update with "Things needed from you right now" or "Nothing needed from your side"; M-020: his stop rule is about 97-98% usage) | fold in next session |
| D19, D8 | Progress, icons | `BADGES-ICONS-1018.md`: recommend removing badges for a dated record with real numbers; one Lucide icon family, phone bar fixed | show him |

### Missed asks folded in, 18 Oct about 3:45 am IST (from `MISSED-ASKS-2026-10-18.md`; his words and code checks are there)
| Id | Surface | Item | Status |
|---|---|---|---|
| M-001 | App, brand opening | DECIDED 3:50 am: the full 3 s logo B opening on the FIRST launch after install only; later launches keep the short one (about 1.3 s) | OPEN (v15) |
| M-002 | App, copy | Unlimited mocks from one central bank, said truthfully and quietly in the app (onboarding, plan, credits) | OPEN |
| M-003 | App and web, NTA | A brief interruption of 3 s or less (the notification shade) is forgiven; a deliberate switch counts at once; three warnings, no other grace | OPEN (with W-023) |
| M-004 | Both | A feature-by-feature robustness walk: no crash, dead button or lost state | OPEN (the v15 walk and the live W re-audit) |
| M-005 | App | Every decorative dot or indicator carries real information or is reworked so it does | OPEN |
| M-006 | Copy | DECIDED 3:50 am: **exciting, bolder copy** (punchier, energetic) where disclaimers were removed, on the landing and in onboarding. Relaxes W-093's no-hype for tone only; truth rules still hold (no false claims, real numbers) | OPEN (copy pass) |
| M-007 | Compass data | Verify programmes, counts and cutoffs against the CSAS and DU sources; record the source and date | OPEN |
| M-008 | Content | His 10/10 question definition goes into the judge rubric (content runs only when he asks) | OPEN |
| M-009 | Landing, onboarding | Video or scroll-animation ideas: storyboards for the top two, he picks | OPEN (with Higgsfield) |
| M-010 | Backend | A migration so the repo matches production's removed AI ceiling; a rebuild must not restore the USD 25 cap | OPEN |
| M-011 | Ops | Delete the duplicate paused Vercel projects (he said six; the records name five). He clicks, or gives a fresh go-ahead | OPEN, his click |
| M-012 | App | The notification prompt returns on a cadence with varied wording | mostly DONE |
| M-013 | App | Study days readable offline | OPEN, low |
| M-027 | App | Answer once with evidence: is the low quality the emulator or the build? | OPEN |
| M-014, M-015, M-016 | Rules | No iOS until students ask; no cap on agent-written questions per paper; any new mascot or art reads as edtech, is original and is legally safe | RULE |

**Process rules from the missed asks** (apply to every session):
- **M-018:** every update to him ends with either **"Things needed from you right now:"** followed by the items, or **"Nothing needed from your side."**
- **M-021:** near a usage reset, with quota left, run the most parallel work. Watch for stalled agents throughout; the main session monitors them continuously.
- **M-023:** every next-session prompt has one goal and points to NOW.md and this ledger.
- **M-025:** never let one track eat hours while other open asks sit; app work runs in parallel with web work.
- **M-019:** while he sleeps, never block on a question; find a workaround.


### Status update, 18 Oct about 6:45 am IST (session 604ced81)
| Items | Status |
|---|---|
| D7/D12 (Night on Ask Mobi), D10 theme switch, D11 Help and FAQ page, D13 nav floor, D5 Practice Review and repair + Ask Mobi, D15/D17 (first pass), F15 Learn and Review, D20 the "Learn" name | **LIVE-UNCHECKED** in R5 (main 58bc53f6). Where to look: docs/brain/R5-WHERE-TO-LOOK.md |
| D15/D16/D17/D18/D29/F17 (Review/result 1018), D6/D12 (Ask Mobi 1018), COMMUNITY-1018 + D20, D19 badges (web) | **LIVE-UNCHECKED** in R6 (main 70c4598c, about 7:25 am) |
| D1-D3, D25-D28 (web Today 1018) | **BUILT**, wt-today18 d0486c12; waits for his live review (port 3207) |
| D32 landing | **BUILT**, wt-land3 f64cffe5 (position band only; the toggle was already live); waits for his live review (port 3206) |
| App: Today 1018 (D1-D3, D26-D29), Ask Mobi (D6), Play it back (D29), M-001 logo, D19 badges | **BUILT** in v15 (wt-v15 fecc6a73 + ui/v15-badges a85f0e50); emulator walk running |
| Production migration revise_cards_mode | Applied at 4:50 am (grant); STATUS text pending in the R6 push |

### Owner at about 8:40 am, 18 Oct
| Id | Item | Status |
|---|---|---|
| D35 | The web Today is "better now". Ship it on top of release 6 | OPEN (R7) |
| D36 | Ask Mobi redesign not seen (the preview was built on R4). On R7, the Today lead card carries Ask Mobi "Why this?"; release notes say where Ask Mobi is | OPEN (R7) |
| D38 | Landing HERO refinement: the morphing/typed changing line under "CUET 2027" (L-016), CUET 2027 coloured (L-017), not a fake button (L-018), clean spacing (L-014), the Mobi animation (L-004), no glow (L-019) | OPEN (Opus, wt-land3) |
| D37 | Finish and perfect everything, publish the final web and app versions, then tell him; he reviews both and gives final feedback | RULE / in progress |

### Re-audit follow-ups, 18 Oct about 9:50 am (all being built for R8 unless marked)
| W | Item | Where |
|---|---|---|
| W-041/W-042/W-077 (Today) | The new Today replaces R4's | R7 (verifying) |
| W-078 | /mentor "Your record" unreadable in Day (contrast 1.01): a LIVE bug | wt-r8-fixes |
| W-026/W-075 | Two lime keys on phones: the dock Start goes quiet while a page's own primary is visible (the same rule the desktop sidebar already uses) | wt-r8-fixes |
| W-079 | Sub-44 px spots (Practice fine-tune row, "See Q14", the Mob icon buttons; desktop sidebar rows if the rail still fits) | wt-r8-fixes |
| W-093 | Help "Five stops" vs the 8-stop tour; two disclaimer-tone lines (Learn, Progress) | wt-r8-fixes |
| W-089 | Copy the pass-1018 design notes into the repo | wt-r8-fixes |
| W-064 | The first-week path; the "of the 6 you repaired, 5 did not come back" receipt | wt-r8-adopt |
| W-032 | "Try it again" before the key on the result page | wt-r8-retry |
| W-074 | The landing shows two Mobis at once at 1440 | the landing hero agent (wt-land3) |
| W-085 | App parity: Review leads with weak chapters in v15 | wt-v15-review |
| W-061/W-062 | The Mob is off in production | by decision (gate first) |
| W-049 | Colleges are also addable outside onboarding | kept as edit paths (never cut); his call if he wants them gone |
| W-099 | /mentor "Your record" and the Weak chapters page repeat the same record | **DECIDE** (merging cuts a page; ask him) |
| W-033/W-058 | A live repair and sign-in persistence need a real signed-in walk | not testable from fixtures |
| W-046 | "Study day / week chapters" meaning | **ask him** |

### Owner on v15 (79aaca6d) on his phone, 18 Oct about 12:15 pm (D40-D57; his words at the end of OWNER-FEEDBACK-2026-10-18-DAWN.md)
| D | Item | Status / where |
|---|---|---|
| D40, D43, D44, D48 | Onboarding layout: content too high, too much space below; a clear Back button; adaptive Mobi and a sharper Mobi graphic, bigger on the plan screen | Building: ui/v15-onboard-a |
| D41, D42, D45, D46, D47, D49 | Courses (most chosen first, Bulletin combinations, full list); no default subjects for "Not sure yet"; marks step up to 3; a full-mocks line under 10/20/30; an interactive study-days step; usage data ON by default | Building: ui/v15-onboard-b |
| D53 | Ask Mobi answers at once; no "goes to an AI service" sheet | Building: ui/v15-askinstant (web parity in R8 fixes) |
| D56, D57 (+ D8) | Restore the Start key's lost character; the bar's frosted glass visible; one icon family | Building: ui/v15-icons |
| D51, D52 | Swipe suggestion cards; a richer Today (earlier versions felt cooler) | APPROVED 12:50 pm as v15.1 (TODAY-SWIPE-1018.md); building ui/v15-today-rich and ui/v15-swipe |
| D55 | Audit every recorded app ask against the build, then fix the gaps | Audit plus fixer: ui/v15-ledger |
| D50 | "5, 10, 20 only. No direction until you do a full mock" | CTO decision: 5/10/15/20 + full mock in "How many questions?", day-one direction from marks at stake; ui/v15-length into the final v15 |
| D54 | 50 free credits for free users | DECIDED 12:28 pm: yes (see the 11:21 am-12:30 pm section) |

### Owner 11:21 am-12:30 pm, 18 Oct (D58-D62, D54 decided; his words at the end of OWNER-FEEDBACK-2026-10-18-DAWN.md)
| D | Item | Status / where |
|---|---|---|
| D58, D61 | APK of the walked v15, on his phone | DONE 11:34-11:40 (mockmob-v15-79aaca6d.apk, 1.0.15+3) |
| D59 | The whole "Not done yet" list in the final v15: Review D18, polish 2, icons D8, M-001/2/3, the Mob (switch off), Learn and Review beyond D18 | Building in v15-final-1218 (asks done, 4a1b9b98) |
| D54 | Free AI wallet 10 -> 50 a month: server, website, app together | Building: web/credits50-1018 (wt-credits50) and ui/v15-credits (merged into v15 before the integrator) |
| D60, D62 | Max parallel, nothing stalled; final app in 1-2 hours; scan for anything broken | 17 agents running; chain and times in NOW.md |

### Status at 3:35 pm, 18 Oct (session 25ef3d95 handoff)
- **DONE, live:** release 7 (fc9e1f6b).
- **Verified GO, waiting for his live look:** release 8 (00328e54), which carries W-078, W-075, W-079, W-093, W-089, W-064, W-032, D38, D53 web and D54 web. The migration is not applied yet.
- **App:** D40-D50, D53, D56, D57, D8, M-001 and M-002 passed the emulator walk at 628f3612. D18 is blocked by the Review "316 of 310" HIGH (the fix is partial in 77d51ba8). D49 and M-003 are proven by test only.
- **D51 and D52:** built and critic-checked, in v15.1 wt-v15-1 (88cc6c5d); not walked yet.
- None of the app items is DONE until a walked APK is in his hands.

### Owner at about 3:55 pm, 18 Oct (session 604ced81)
| D | Item | Status |
|---|---|---|
| D63 | "Ship it": release 8 (asked about 3:45 pm) | DONE: migration applied on production (pre/post md5 checked, dry spend rolled back); main 00328e54 READY, 0 runtime errors; STATUS eb5185ef |

### Owner at about 4 pm, 18 Oct (D64-D68; his words at the end of OWNER-FEEDBACK-2026-10-18-DAWN.md)
| D | Item | Status |
|---|---|---|
| D64 | W-099 and W-046: skip | CLOSED by the owner |
| D65 | Practice credits = number of questions (5/10/15/20 -> 5/10/15/20; full mock 50 stays 50) on server, website, app | OPEN: building (R9 web + final app) |
| D66 | The Mob fully built, ON, tested (web and app) | OPEN: staging gate, production switch-on |
| D67 | Ship the final v15 (all his v15 fixes) + the Mob + the website with all his feedback | OPEN: R9 + final app |
| D68 | Within 1-2 hours of 4 pm | target 5-6 pm |

### CEO/CTO decisions while the owner is away (18 Oct from about 4:10 pm, D69)
| # | Decision | Why |
|---|---|---|
| C1 | One FINAL app build instead of two APKs: the v15 walk fixes + per-question prices + the richer Today and swipe stack (v15.1), one integration (1.0.15+6), one emulator walk, one release APK. The old two-walk workflow was stopped at 4:15 pm (the fixer's edits saved as STOP POINT 17ccad0f). | D67 asks for one shipment; one walk saves about 45 minutes of emulator time |
| C2 | Per-question practice prices (D65): Quick 1 credit a question (5/10/15/20); a 50-question full mock stays 50; Pro unchanged; every free allowance unchanged (today's included 10-question set, free first sets, the free 5-question recovery set, Mob papers); old 'attempt' (10) and 'attempt_full' (50) kept for old app builds; new per-count actions in the database. | His words; keeps old builds correct and the credit RPCs atomic |
| C3 | The Mob ships ON (D66) when its real staging gate passes and an independent verifier says GO: production migrations 20261017100000_mob and 20261017190000_mob_fix_1017 under the standing grant, then MOB_ENABLED=true on Vercel Production. The app's Mob is server-driven, so it appears in the app at the same moment. | His words "fully built, switched on, everything tested" |
| C4 | Release 9 (the Mob, credits per question, the audited website fixes) ships on suites + independent verifier GO without waiting for his live look. | His 4 pm "should now be shipped" and D69 |
| C5 | His phone gets the final APK when he is back and plugs it in (only the main session installs). | Nothing touches his phone without him |

### Audit reconciliation: website release 8 (live 00328e54), 18 Oct about 4:45 pm (read-only, 5 surface auditors; evidence in tmp/ledger-audit-1018/results.json and screenshots)
**Totals:** DONE 83, PARTIAL 31, NEEDS_DECISION 7, NOT_TESTABLE 1.

- **DONE (verified on release 8):** D1, D10, D12, D13, D15, D16, D17, D19, D2, D21, D26, D29, D3, D32, D35, D38, D5, D53, D54, F12, F13, F15, F17, F2, L-004, L-014, L-016, L-017, L-018, L-019, M-002, N1, N11, N12, N15, N2, N3, N5, N7, N8, N9, W-002, W-003, W-005, W-008, W-012, W-013, W-017, W-018, W-023, W-026, W-029, W-030, W-032, W-034, W-035, W-038, W-040, W-041, W-047, W-050, W-051, W-052, W-055, W-057, W-060, W-061, W-062, W-064, W-067, W-068, W-069, W-070, W-074, W-076, W-078, W-082, W-083, W-093, W-094, W-095, W-097
- **PARTIAL -> fixed in release 9 (wt-rel9, verifying; DONE only once live):** D28, W-042, W-044, D27 nits, F18, D18 and LOST-X-OF-Y, D15, F11 (one stem, one Repair), D6, D11 (Help -> Guide), N17 (Show me around), W-075, W-079, N6, D8 glyph, D7 badges in Night, M-006 (web onboarding), the /pricing/ai-credits false claim, the onboarding no-cap line, landing 'leaderboard' -> 'Your standing', one price framing, L-013 footer Help for guests, L-019 aurora removed, W-087 details.
- **Still open after release 9:** D25 and W-085 app halves (the final app build), W-033 (needs a signed-in repair walk), W-042 real-account timing, D31 (his landing verdict), W-072/W-073/W-077 (broad premium sweeps), D9 and W-053 (Progress order), M-007 (Compass source check), D20 (Learn one tap on phones is a dock change), D22 (Mob mechanics beyond M1).
- **Closed by the owner (D64):** W-099, W-046. **Decided (D65):** FLAT-10 -> 1 credit a question. **Open design question:** N4 (fine-tune).

### Owner at about 6:10 pm, 18 Oct (D70-D71)
| D | Item | Status |
|---|---|---|
| D70 | Full progress update; anything needed from him | Answered 6:20 pm: R9 and the final app in progress (times in chat); needs: account switch near 95% usage, phone plugged in for the install |
| D71 | Pro, credits and pricing inside the Play app; does Google take 30%; can Play prices be higher; any grey area | Answered 6:20 pm from Google's own pages: India today = 15% on the first USD 1M a year (enrol in the 15% tier) and 15% on auto-renewing subscriptions; 30% only above USD 1M for one-time products; new 10% rates reach the rest of the world by 30 Sep 2027; India User Choice Billing = own checkout beside Play's, fee 4 points lower, different prices allowed. No grey area (app and account removal risk). Recommended: ship web-purchase + app-unlock first (no fee), then Play Billing + User Choice Billing at the same Rs 99. OPEN: his go-ahead on that plan |

### Owner at about 6:25 pm, 18 Oct (D72-D74)
| D | Item | Status |
|---|---|---|
| D72 | Play price about Rs 50 above the web (not 115, not 199) | CTO decision: Pro Rs 149 on Google Play, Rs 99 on the web; prices set in Play Console, never in code; the app never shows the web price (anti-steering) |
| D73 | A plan for selling Pro and credits in the Play app, and build it | BUILDING 6:30 pm: server (wt-play-server, web/play-billing-1018: verify + RTDN + play_purchases migration, flag PLAY_BILLING_ENABLED) and app (wt-play-app, ui/play-billing-1018: in_app_purchase, Get Pro sheet, flag PLAY_BILLING); plan doc docs/brain/PLAY-BILLING-PLAN-1018.md; a real purchase needs his Play Console setup |
| D74 | Everything by 10:30 pm, more parallel agents | Chain in chat: R9 live ~7:30, final app ~8, Play billing built and checked ~9:30, v15.2 APK ~10:15, final message 10:30 |

### Owner at about 6:38 pm, 18 Oct (D75-D77)
| D | Item | Status |
|---|---|---|
| D75 | Pro on Google Play: Rs 150 FINAL (web stays Rs 99) | Recorded; set in Play Console; play-server plan doc updated |
| D76 | One credits wallet on web AND app (practice + AI credits, reload packs); build now, he wires Razorpay today | BUILDING 6:42 pm: web wt-wallet-web (web/wallet-1018: /wallet, /api/wallet, /api/wallet/order + verify, flag WALLET_COMMERCE_OPEN, note WALLET-RAZORPAY.md); app Wallet screen added to the Play billing app agent. Packs (CEO proposal, constants): AI Rs 10/50, Rs 20/150, Rs 50/400 (existing ids, labels renamed); practice NEW Rs 19/100, Rs 49/300; Play prices about 1.5x (AI 15/30/75, practice 29/75) for him to confirm |
| D77 | "No agent is running / stalled": stay on top, more parallel | 6:38 pm check: all 4 agents wrote within 1-5 min; 2 more agents added (wallet web, wallet app scope) |

### Owner at about 6:50 pm, 18 Oct (D78-D81)
| D | Item | Status |
|---|---|---|
| D78 | ONE credits balance for everything (no separate practice and AI wallets) | BUILDING 6:58 pm: core (Opus, wt-credits-core, web/credits-core-1018): one balance = this month's free 50 + held (ai bonus + users.credit_balance); one spend order (free, bought, held) for practice and AI; spend_credits and the AI reserve/consume functions take through one wallet function; no data moved; migration 20261018210000_one_credits_balance + undo; packs credits_10_50 (Rs 10), credits_29_150 (Rs 29), credits_49_300 (Rs 49). Wallet web/app and Play map redirected to one balance |
| D79-D80 | Pro nudges everywhere ("Get unlimited mocks", "No credits needed for practice with Pro"); any Pro feature tap opens "Upgrade to Pro" | BUILDING: web (Opus, wt-pro-nudge), app (wt-pro-nudge-app; app nudges only with Play billing on, the store rule) |
| D81 | First-session pop-up after the first real action (never on or right after onboarding), benefits personalised and true; once ever | BUILDING with D79-D80 |

### Owner at about 7:05 pm, 18 Oct (D82-D83)
| D | Item | Status |
|---|---|---|
| D82 | Packs approved: 50 credits Rs 10, 150 Rs 29, 300 Rs 49 (web); Play Rs 15 / 45 / 75; Pro Rs 150 on Play | DECIDED |
| D83 | Worst-case cost and margin of a Rs 10 / 50-credit pack | ANSWERED 7:10 pm from production runtime_ai_requests (gpt-6-luna avg USD 0.000299, max 0.000479, guard ceiling 0.00237 per reply; a Haiku-class reply about 0.00127). Found: the per-user AI cap would refuse bought credits; fix sent to the credits core agent. Recommendation: a hard output cap per reply, the default on gpt-6-luna |

### Owner at about 7:12 pm, 18 Oct (D84-D85)
| D | Item | Status |
|---|---|---|
| D84 | Nudge, paywall, Pro and pack copy in persuasive marketing English (not generic or flat); truth kept | Sent to the web and app nudge agents 7:14 pm |
| D85 | He switches accounts himself near 95% | RULE for tonight |

### Status at 7:15 pm, 18 Oct (session 604ced81 handoff, stopped at 95% usage)
- **DONE, live:** release 8 (00328e54); production migrations free_ai_wallet_50, practice_credit_per_question, mob + mob_fix (code not yet live for the last three).
- **Built, final checks pending:** release 9 (wt-rel9b 31c4dd21: audit fixes, per-question credits, the Mob); final app 1.0.15+6 (wt-v15-1 01dd7770, walk r1 fixes in); Play billing server (DONE, 9b6cd30b).
- **Mid-build:** one credits balance core (5c553d3a + STOP POINT), web wallet (6237ada2), web Pro nudges (b281ea9a), app billing + wallet (STOP POINT 5ae50007), app Pro nudges (STOP POINT a00ddfe1).
- None of D65, D66, D76, D78-D81 is DONE until live (web) or on a walked APK in his hands (app). Next steps: NOW.md section 4.

### Owner at about 7:20 pm, 18 Oct (D86; new account, session 25ef3d95)
| D | Item | Status |
|---|---|---|
| D86 | Tonight by 10:30 pm, in order: R9 (verify, MOB_ENABLED, push, STATUS); final app 1.0.15+6 (walk, APK, Mob + per-question walk on 3103, install, send); tracks C-H with tests and independent checks; release 10 + production migrations play_purchases and one_credits_balance; v15.2 walked, APK, installed; then ONE message | BUILDING 7:25 pm |

## Waiting on the owner (updated 18 Oct about 3:45 am)
- Answered 3:50 am: M-001 first launch 3 s; M-006 bolder copy; D19 keep badges, refine; D22 Mob.
- D32: confirm the kept landing element when he reviews the port live (wt-land3, port 3206).
- The icons (D8): the proposal is in BADGES-ICONS-1018; it ships with the next app nav change, unless he objects.
- Play Console account and upload key; Anthropic key; Avast HTTPS-scanning exception; 112 held questions; a Hindi reviewer; free first Repair; M-011 Vercel duplicates (his click).
