# Round 6 build spec (3 Nov 2026, about 1:45 pm IST): owner items LK50-LK53, plus round 5's second wave (LK37, LK39, LK41, LK43)

Owner's words: `C:\Users\atish\Desktop\mockmob copy\mockmob-next\docs\brain\OWNER-FEEDBACK-2026-10-31-LEARN.md`, sections "2 Nov 2026, about 10 am"
and "3 Nov 2026, about 1:30 pm" (read both, all of it). Round 5 spec: `C:\Users\atish\Desktop\mockmob copy\wt-1102-stage\docs\brain\learn-1031\r5\R5-SPEC.md`.
Live web: origin/main 2152e0b74 (round 5 first wave dc6e45561 + Maths formula cards). App base: branch ui/1101-learn-app at 06b65ff46 (1.0.19+17, what he has).

His standing rules for design work: refine, don't rebuild; never cut a feature; Night stays subtle; he judges a live prototype on his
phone, not screenshots; plain words, no hype. The owner's UI standards: `C:\Users\atish\Desktop\AI OS\wiki\concepts\ui-ux-standards.md`
(run its done check). The project's DESIGN.md and PRODUCT.md win over generic taste.

Every packet: its own worktree and branch; commit there; **never push, merge, deploy, or write to production**; no production sign-in.
Never remove a worktree or folder that contains a node_modules junction (delete the junction link first). Heavy Flutter commands only
through `bash tool/flutter_locked.sh` from flutter_app. The emulator (AVD mockmob_budget, 2 GB) is shared: take the lock folder
`%TMP%\mm-emu-lock` (mkdir; an `owner` file inside; remove it when done) before using it, and never leave it running. Web dev servers
only through `preview_start` with the named config, after writing your name into a free `C:\Users\atish\Desktop\mockmob copy\tmp-devslots\slot-1`
or `slot-2` file (none free: wait and retry); stop the server and delete the file when done. Kill only your own processes.

## App A: the stuck "Sending your answers" strip (LK50) — wt-1103-app-sending, branch ui/1103-sending
On his main account every app screen shows the live strip "Sending your answers · Computer Science mock" (`lib/core/widgets/bar/bar_live.dart`
BarSending). `barSendingInputProvider` (`lib/app_overrides.dart` ~85) shows it whenever the latest local session draft has `pendingSubmission`
and the phone is online. The submitter clears the flag only while the engine is alive and the window is open (`session_engine.dart` ~727
windowClosed, `session_submitter.dart` ~187); a draft whose window passed while the app was closed, or one the background token refresher gave
up on (`background_token_refresher.dart` ~49 "the caller keeps pendingSubmission and stops"), keeps it forever.
1. The strip shows only a submit that can still happen (pending, not window-closed, not rejected, now < endsAt + the submit grace, and a retry
   really scheduled or running).
2. On app start (and on resume), settle stale drafts: ask the server whether that session was received (find the existing endpoint the
   engine/result screens use). Received: clear the flag and let the normal result/marked path show. Not received and the window closed: mark
   it window-closed so the existing missed-submit copy shows, never "Sending". Offline: do nothing until online.
3. Tests that reproduce his state (draft pending, endsAt an hour ago, cold start; and the refresher-gave-up case), plus the settle paths.
4. Check whether the website has an equivalent stale state (read only; report).

## App B: round 5 on the app, and Explore in Practice (LK51) — wt-1103-app-r5-port, branch ui/1103-r5-port
1. Round 5 web changes the app must match (read the diff `git -C "C:\Users\atish\Desktop\mockmob copy\wt-1102-web" diff a16fbd62e dc6e45561 -- src data`):
   - Card items now carry `returns` words from the server: the run's grade keys get a second line ("Missed it / back tomorrow",
     "Got it / back in 3 days", "Easy / back in 2 weeks"), the stamp after a rating says "Back in 3 days", one coach line once per student
     ("Missed it brings a card back soonest. Easy sends it furthest away."). Same words as data/learn/words.js.
   - The stop sheet counts done by the server's rule (the place of the last item with an event), feed and run, so it matches the end.
   - A run over several chapters arrives headed "Revise" with no place: no "Chapter N of M", no chapter bar; Close goes to Learn home.
   - Fix 3: the chapter page's "Print sheet" row is named for what it opens in the app ("Must-know lines", its count as the note).
   - Re-record the fixtures that changed from the live web engine (tool/record_learn2_fixtures.sh, a web dev server on main), update the
     parity scripts and goldens; look at every changed golden.
2. LK51: Explore joins Practice as its fourth door, after Learn: Practice's switch reads "Practise | Papers | Learn | Explore" (web's
   "Papers"; the mistakes badge stays on Papers). The door shows Explore's covers and its Untimed questions entry inside the Practice page
   (no second back header). The "Chapter feeds" row in More ways in stays. Deep links /explore and /practice?door=explore land there.
   Fit at 360 dp and text 1.3 without wrapping a label mid-word.
3. Tests and goldens for all of it (Night, Day, 360 x 800, text 1.3).

## App C: a calmer, stronger Learn (LK52, LK53 first pass) — wt-1103-app-learn-calm, branch ui/1103-learn-calm
He: "the Learn section is still a bit cluttered ... the overall app ... can be a bit stronger and a bit more premium, something in the direction
of Duolingo". Scope of this pass: Learn home and the chapter page (and the stage's look only where B does not touch behaviour).
1. Audit Learn home and the chapter page at 360 x 800 on the emulator (demo build, Night and Day): count what is on screen, what repeats,
   what competes with the one main action. Write the audit and the plan into `docs/brain/learn-1031/r6/C-LEARN-CALM.md` first.
2. Refine, never cut: one clear hero (the offer) with confident type and Mobi, fewer lines per roadmap row (secondary facts quieter or on the
   chapter page), stronger rhythm and spacing, chips and pills that read as one family, press states that feel tactile. Duolingo direction
   means confident, warm, clear progress and reward; not cartoonish, not loud, Night subtle.
3. Build it for real on the branch; goldens updated and looked at; a demo APK the owner can sideload as the live prototype
   (`test/device_demo/demo_main.dart`, see tool/walk_learn2.sh l2_build) saved to `tmp/learn-app-1101/apk/demo-learn-calm.apk`.

## Web D: cards worth looking at, desktop that uses its space, a subtle Night (LK39, LK41, LK43) — wt-1103-web-cards, branch web/1103-cards
He: cards are "very boring", "everything is very scaled down ... so much white space ... on the desktop", "neon light around every card ...
a bit too much ... less of a very extreme neon AI slop look". Scope: the Learn v2 stage cards (feed and run), Explore covers, Cards view rows.
1. Before shots at 390 and 1440, Night and Day. Write the direction and the plan into `docs/brain/learn-1031/r6/D-CARDS.md` first.
2. Cards: give each card a presence (the kind as a clear coloured tab or edge from the existing palette, real typographic hierarchy, the source
   as a quiet footer, a subtle paper or grain surface if DESIGN.md allows), never decoration for its own sake. Night: remove the neon halo,
   keep one soft edge. Desktop: the stage and cards scale up to use 1440 (larger type and card, less dead gutter), phone unchanged in layout.
   The Key cards session added pre-rendered formula HTML to CardFace's Front (`card?.texHtml?.front`): keep that path working.
3. It ships only after his live look: keep it in its own commits, and leave a dev-server config name in your report.

## Web E: choose what goes in a run (LK37) — wt-1103-web-choices, branch web/1103-choices
He: "If I click on 'Directly Start 10 Minutes,' it's not letting me alter it ... there should be a toggle allowing me to choose the number of
key cards and questions and other stuff ... it can adapt to something like your mistakes".
1. Learn home's offer: its length can be changed in place (a tap on the minutes opens 5 / 10 / 20 / Other, as the chapter page has).
2. The chapter page: "What's in this run" as clear toggles with counts: Key cards, Questions, Your mistakes, the lesson (only what the chapter has),
   using the server's existing `leaveOut`/kind support; the run's minutes and the lined-up counts update live; at least one must stay on.
3. Server checks: every toggle combination composes a valid run (tests), Free rules unchanged.
4. Tests; look at 390 and 1440, Night and Day.
