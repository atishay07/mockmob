# Mob V4 build spec for version 15 (20 Oct 2026, session b7e1b5da)

The design is `MOB-MINIMAL.md` (Mob V4, approved D174). This file fixes what changed since the mock-ups and splits the build into owners that never touch the same files.

## Decisions that override MOB-MINIMAL.md

1. **No free first full mock anywhere (D175).** Section 3.2 item 4 and section 3.3 (the "For you: free" card, "Your free first full mock in Accountancy is used") are void. The rule is:
   - A Pro member starts a Full mock together. Free members see the row dimmed with "Pro starts it" and a plain call to action to Pro (D174: "a clear CTA").
   - Anyone in the Mob sits it within 24 hours. Pro: included. Free: 50 credits, charged once at the sit tap through the existing full-mock charge path (server: `web/1020-mob-fulltogether-price`).
   - Rule box copy: "Everyone in {Mob} can sit it within 24 hours, then you compare mark sheets." / "Included with Pro. Free members sit it for 50 credits."
   - Lobby "For you" card: Pro "For you: included with Pro." Free with credits "For you: 50 credits" / "You have {n} credits." Free short of credits "50 credits. You have {n}, so you need {50-n} more." with two keys: "Add credits" and "Get Pro". The server's numbers are shown, never a client guess.
2. **Mob hours is approved (D174: "Mob bars, say yes ... implement it however you want").** Use the doc's proposals: target 2 h 30 m per sharing member (10 h for four); the week tick = own daily goal met on 5 of 7 days; hours earn nothing; the switch "Show my study time to my Mob" is OFF by default (minors' privacy); a question counts its real answer time capped at 3 minutes; week starts Monday (IST). Never a rank below the top, never a member with 0 minutes or opted out, no countdown, no "less" copy.
3. **Both streaks visible (D173 item 6):** the Mob's weekly pennant on the stage and the student's daily chain chip in the den header, each labelled so a first-timer knows whose it is ("Your chain, 14 days" / "Chai Circle, 4 weeks").
4. **Results are a short run of focused screens plus celebration screens (D173):** podium, everyone's moment, Fix it together (when closed), then each earned achievement as its own screen (quest done, week stitched, a Fold earned, streak milestone). Only true screens; step dots show the real length.
5. **Every approved feature stays (D170).** Nothing in V4 removes a capability; it moves it to the one place listed in MOB-MINIMAL.md 2.2.

## Owners (version 15 wave 2, after the v15 base and ui/1020-mob-formats are merged)

| Owner | Model | Scope (MOB-MINIMAL.md section 5) | Owns these files |
|---|---|---|---|
| V4-den | Opus | A1 header, A2 Now card ladder, A3 rows, A4 This week panel (incl. Mob hours block from fixtures), A11 Invite + Your Mobs sheets | `den_screen.dart`, `den_stage.dart`, `den_cards.dart`, `logic/den_copy_state.dart`, new `invite_sheet.dart`, `your_mobs_sheet.dart` |
| V4-sheets | Sonnet | A4 This week sheet, A5 Your chain sheet (shared with You), A6 Shelf sheet, A7 Mob settings sheet (incl. study-time switch, How the Mob works, Free and Pro) | new `*_sheet.dart` files, `chains_*`, `shelf_*`, `mob_settings_*`, You chain section |
| V4-results | Opus | A8 Start a game sheet finish (rule box, Free CTA), A9 lobby cost line, A10 ResultsRun, A12 Fold life (eye windows, micro-acts, join/reaction/desk acts, frame strips) | `start_game_sheet.dart`, `play/*`, `results_run*`, `podium*`, `moments*`, `fold_puppet.dart`, `mob_fx.dart` |
| Mob hours server | Sonnet | A13 server: opt-in column, weekly aggregate RPC, presence "studying now" from real practice, API in the den payload, migration with undo (not applied) | web `src/lib/server/mob*`, `supabase/migrations`, `docs/brain/APP-API-CONTRACT.md` |

`copy_v3.dart` is shared: each owner adds strings only in its own clearly marked section; the integrator resolves.

Every owner: demo-mode fixtures for every state (no server), goldens Night and Day at text scale 1.0 and 1.3, reduced motion, plain copy (no exclamation marks, emoji, arrows, hype), the build-and-look loop (capture visuals while building), full `flutter analyze` + unit via `tool/flutter_locked.sh`.

## Website (version 15 web, wave 3)

W1-W7 from MOB-MINIMAL.md, plus the Full mock together price UI and Mob hours, matching the app. Real browser checks at 390 and 1440 px, Night and Day. Deploy (D156) after suites pass, with MOB_FORMATS_ENABLED turned on only once the price enforcement is live and tested.
