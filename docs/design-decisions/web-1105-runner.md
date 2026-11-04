# The runner's NTA style is the home page's NTA screen (5 Nov 2026, packet web-1105-runner)

## The task

Tonight the home page's exam section got an NTA style that follows NTA's own CBT guidelines (web-1105-exam.md, decision D6). The
runner a Pro student actually sits (src/app/(app)/test/TestPageClient.jsx, nta-classic.css) still had the older NTA look: a blue
header with a progress bar, four rounded counters, letter-chip options under radio rings and sentence-case keys ("Save & next").
The owner's rule is that the promise on the home page matches what the student gets in the paper. This packet brings the runner's
NTA style (only the NTA interface; the MockMob interface is unchanged) to the preview's anatomy and words, keeps every behaviour
the runner has, and keeps it usable on a phone.

The reader is a 16 or 17-year-old rehearsing the CUET screen, often for the first time, on a laptop or a phone.

## The anatomy, from the preview (web-1105-exam.md; CUET (UG) 2025 Information Bulletin, Appendix V)

| Part | Preview (ExamScreen.jsx, NtaScreen) | Runner now (TestPageClient.jsx, renderClassic) |
| --- | --- | --- |
| Header | CUET (UG) in NTA's indigo, left | same |
| Top right | Question Paper icon, Candidate Name, Subject Name, Remaining Time (hh:mm:ss in an indigo pill), the grey profile card | same; the candidate's shown name (shownName), the row left out when the account has none; the Question Paper icon opens the whole paper |
| Top bar | the section (the subject), highlighted | same, with the Warnings n/3 pill at its far end |
| Question area | "Question n:", a grey circle arrow down, numbered radio options | same, plus the grey circle arrow up at the foot; both arrows scroll the question area |
| Keys | Mark for Review & Next, Clear Response, Save & Next | same words and colours, plus Previous (see below) |
| Palette | the section summary (a count in each of NTA's five symbols), the section bar, "Question Palette", the symbols, Submit | same |
| Fold | the > at the palette's left edge, a real disclosure | same (aria-expanded, aria-controls) |
| Clicking the chosen option again | clears it | clears it |
| Submit | reads back NTA's five counts | opens the same five counts as a summary, then Submit or Keep answering |

Every NTA word in the runner is a literal in one object (`NTA`, `NTA_LEGEND`), and examPreviewParity.test.mjs now holds them to
EXAM.nta in homeCopy.mjs exactly, case for case (it was case-insensitive while the runner said "Save & next"). Same words in the
same places is WCAG 2.2's consistent identification (S016).

## Decisions

1. **One screen, two sizes.**
   - From 1024 px the NTA screen is the viewport, as at the centre: the header, the section bar, then the question area and the
     palette side by side. The question area and the palette scroll on their own; the keys stay at the foot of the question area.
     In fullscreen (the exam space) nothing else is on screen.
   - Below 1024 px the paper stays in the page with NTA's header pinned (the Remaining Time always in view), the keys in a fixed
     bar (Previous, Clear Response, Question Palette; then Mark for Review & Next, Save & Next) and the palette in a sheet with
     NTA's section summary, the section bar, the symbols and Submit. The desktop anatomy does not fit 390 px without the
     question shrinking to a miniature, which is what the task allowed.
2. **NTA's status model on the keys.** NTA's guidelines say Save & Next saves the answer and Mark for Review & Next marks the
   question for review. Reading them as "the key you press decides the status", Save & Next now leaves the question unmarked;
   in NTA style it is the one way to take a mark off (the per-question Mark and Unmark buttons are MockMob's and stay in the
   MockMob interface). The preview's Save & Next does the same now (one line in ExamScreen.jsx), so the two still match.
   - Not changed: an answer is saved the moment it is chosen, in both interfaces. NTA's own rule ("you MUST click Save & Next
     to save") would change scoring and the server contract, so it is not rehearsed.
3. **Previous stays** in NTA style, beside Save & Next, as it was. The guidelines name three keys and the preview draws three;
   the runner had a Previous key and the owner's rule is to refine, not cut. The palette and the left arrow key also go back.
   If the owner wants exact parity, either the preview gains a Previous key or the runner drops it: one line each.
4. **Submit is NTA's section summary, in the page.** NTA style asked "Submit anyway?" with the browser's own dialog. It now opens
   a summary over the paper: the subject and the number of questions, the five counts in NTA's symbols, "After you submit, your
   answers cannot be changed.", then Keep answering (focused first) or Submit. It opens on every Submit, as NTA's does, not only
   when questions are left. Opening it is the same 'sheet' visit the old check recorded, closing it the plain visit, so the
   paper's record and the server contract are unchanged. A time-up or third-warning submit closes it.
5. **The Question Paper icon works.** It opens the whole paper (every question, numbered as NTA numbers them, passages once at
   their first question) in a dialog that closes with the X or Escape and gives focus back to the icon. Progressive disclosure
   (S014): the paper is one press away and never on screen unasked.
6. **Colours.** The five symbols take the preview's sampled colours and shapes, drawn on a ::before so a clipped shape never
   clips the focus or current-question ring. The red and the green are one step darker in the runner (#d03f00, #24820a) so their
   white numbers pass 4.5:1 (NTA's #e34501 and the preview's #2a9c06 are 4.1:1 and 3.6:1). The keys keep the runner's NTA purple
   and green; the time pill, the section bar and the section tab are NTA's indigo #4f4f8d. Light in both themes.
7. **MockMob's strip above the screen stays.** The sync note and the interface switch are MockMob's controls, not NTA's, so they
   keep the app's type and the switch's pill is neutral ink (it was the old NTA blue). On a phone the strip is tighter.
8. **Sizes.** Keys, options, the sheet's chips and the phone's arrows are at least 44 px. On a wide screen the grey arrows are
   36 px circles and the fold a 28 x 64 px tab: NTA's small parts, still above WCAG 2.2's 24 px floor (S016). The app's
   44 px floor for every button would have pushed the fold under the palette, so the fold and the arrows set their own.
9. **Passages.** On a wide screen a passage set reads as NTA's split screen: the passage on the left, its questions on the
   right. Each question of a set carries its own "Question n:". The engine serves no passage set today, so this was not seen in
   Chrome (see below).

## What was kept, and how it was checked

- Saving, the timer, the exam-space gate and its three warnings, the review marks and their events, the keyboard (1 to 4 answer,
  the arrows move, Escape closes NTA style's dialogs), the server contract (the same events and answers are sent), and the
  MockMob interface itself: runner_nta_ui.test.mjs still renders the real runner with and without capture and finds the page the
  same at every step of the submit, time-up and three-warnings paths; runner_capture.test.mjs still finds the same events.
- New tests in runner_nta_ui.test.mjs drive NTA style itself: the words and the anatomy, re-click to clear, Mark for Review &
  Next, Save & Next taking the mark off, Clear Response, the keyboard, the fold, the summary (nothing sent on Keep answering or
  Escape, one submit on its Submit, each look recorded as the sheet visit) and the Question Paper.
- The harness path (runner_harness.mjs NTA_PATHS.submit) presses NTA's capitals and confirms in the summary.
- The browser driver for the NTA end-to-end check (nta_e2e_driver.js) reads NTA style's section summary and hh:mm:ss time,
  confirms in the summary, and checks Save & Next taking a mark off where it checked Unmark.

## Trade-offs and open points

- Previous is the one visible difference from the preview (decision 3).
- The summary's sentence and its two keys are ours, in plain English; NTA's own submit screen words are not in the guidelines.
- The candidate's name is the account's shown name; a student with no shown name sees no Candidate Name row rather than a
  placeholder.
- The preview's symbol red and green are NTA's sampled colours; the runner's are a step darker (decision 6). Darkening the
  preview too would make the two identical; its test pins #e34501 today.

## Verification

- **Real Chrome** (playwright-core, headless, under the shared browser lock) on the preview harness, which renders the real runner
  without sign-in: `/preview/arena?view=test&subject=accountancy&mode=nta&interface=nta&plan=pro&generationKey=…` (the stub
  serves 50 questions). Every page was entered through the exam-space gate with a real click, so the shots are in fullscreen.
- **Shots** at 1440x900, 1280x800, 1024x768 and 390x844, Night and Day: tmp/night-1105/runner/v4/ (v1 to v3 are the rounds
  before; tmp is ignored by git). No page errors, nothing scrolls sideways at any size. The home page's NTA screen at 1440, 1024
  and 390 in both themes, for the side-by-side: tmp/night-1105/runner/v1/landing-*.png.
- **Walk** (tmp/night-1105/runner/walk.mjs; log and shots in tmp/night-1105/runner/walk3/): the mouse at 1440 (Day) and 1024
  (Night), touch at 390 (Night) and 360 (Day). Every press was hit-tested first. 72 checks pass, none fail:
  - answer, click the chosen option again (cleared), answer, Save & Next;
  - Mark for Review & Next with and without an answer (Marked for Review; Answered & Marked for Review);
  - Clear Response keeps the question open and clears it; a palette jump;
  - the section summary reads 46 / 1 / 1 / 1 / 1 after those steps;
  - the grey arrows; the fold (the question area widens to 1412 px at 1440) and back;
  - the Question Paper (50 questions; Escape closes it, focus returns to the icon);
  - Submit opens the summary with the same counts, focus on Keep answering, and Keep answering sends nothing;
  - the fold's focus ring (2 px indigo); key 3 answers;
  - on phones the sheet's summary and symbols, a chip jump that closes the sheet, Submit from the sheet, the Question Paper,
    and NTA's header and Remaining Time staying on top with a long question scrolled to its end.
  - Sizes: keys 44 px, the fold 28 x 64, palette chips 40 px tall; on phones the bar keys 44, options 48, arrows 44.
- **Tests**:
  - `npm run test:nta`: 234 pass, including the 4 new NTA-style tests and the unchanged capture-identity paths.
  - The landing exam tests and their neighbours (examPreviewParity, examScreen, homeHero, landingCopy, landingMobi,
    landing_checklist_1104, night_calm_1104, web_landing_health_1020) with runner_capture, fine_tune_scope,
    release9b_mob_merge_1018 and css_split: 165 pass, 0 fail, 12 checklist todos and 2 opt-in browser tests skipped as before.
  - `npx eslint` on every changed source file: clean.
- **Not done here**: no real phone or tablet; the passage split screen was not seen in Chrome (no passage set is served today;
  the e2e backend's ?e2ePassage=1 needs data/tests/nta_e2e_server.mjs on port 3108, not run); the browser e2e driver
  (nta_e2e_driver.js) was updated and syntax-checked but not run against that backend. Nothing was deployed.
