# The home page's exam section on a monitor (5 Nov 2026, packet P3, decision D6; owner items LK91, LK92)

## The task

The owner liked the previous exam screen better, because he remembered it showing the real URL (LK91). He also said NTA
mode is not accurate now. He asked for desktop photos or a device mock-up in this section (LK92). Spec D6 asks for four
things:

- one component that keeps the MockMob / NTA switch;
- NTA mode faithful to the real NTA CBT screen, with its layout, colours, palette legend, buttons and an address bar;
- MockMob mode as our own screen;
- the screen inside a desktop device drawn in CSS in the Desk Light palette, scaled as a whole on phones, and no taller
  than today on phones (LK72).

The reader is a 16 or 17-year-old who may never have seen a CBT screen. The section has to show two things at a glance:
what the exam centre's screen looks like, and that MockMob can rehearse it. The answers and the clock must survive the
switch.

## What was found first

- **The retired comparator never had an address bar or a URL.** This is true of `git show 0b63fd9b7^:src/components/landing/ExamComparator.jsx`
  and of its CSS in `git show 07eed429c^:src/app/home-refinements.css`. Its bar read "NTA-style screen, English", or
  "MockMob Practice, English" in the other mode. So "as the old one had it" cannot be copied, and the URL had to be decided
  here (see below). The owner's line may also be a dictation slip for "valid UI". The monitor's address bar serves either
  reading.
- **NTA's own description of the screen** is Appendix V, "Computer Based Test (CBT) Guidelines", of the CUET (UG) 2025
  Information Bulletin (a copy:
  assets.collegedunia.com/public/image/CUET_UG_2025_CBT_Guidelines_d56f5fd7786f3ac86475a8e3da67c03b.pdf). It states that:
  - the countdown timer is in the top right corner;
  - the candidate's Profile image is top right (it changes the language);
  - the Question Paper icon is top right;
  - sections are on the top bar, with the current one highlighted;
  - the Question Palette is on the right, with the section summary as a legend above it;
  - a ">" arrow at the palette's left collapses it, and "<" brings it back;
  - grey circle arrows navigate down and up the question area;
  - clicking the chosen option again deselects it;
  - the three keys are "Save & Next", "Mark for Review & Next" and "Clear Response".

  Its two legend images give the five symbols. The in-exam section summary (a count inside each symbol) has the trapezoid
  shapes, and the colours were sampled from that image: Not Answered #e34501, Answered #2db500, Marked for Review a purple
  circle (#5a2ca4 at its middle), and Not Visited grey #e7e7e7. Answered & Marked for Review is the purple circle with a
  small green badge. The bulletin's login and welcome screens use indigo #4f4f8d.
- **What the guidelines do not settle:** the colours of the three keys and the exact header layout. For those, the
  rehearsal follows the runner's own NTA style (src/app/(app)/test/nta-classic.css: green Save, purple Mark for Review), so
  the preview never promises a look the student does not get.

## Decisions

1. **One desktop monitor, drawn in CSS (ExamDevice.jsx, exam-device.css).**
   - Parts: a bezel with a chin and a camera dot, a 16:10 glass, a neck that tucks under the bezel and a foot.
   - Colours (Desk Light): a warm charcoal bezel in both themes, one step above the page in Night so its edge reads. The
     stand is warm aluminium in Day and warm graphite in Night.
   - Depth is one soft shadow under the bezel and one under the foot. No photo, no glare, no gradient.
   - Every length is a share of the device's width (cqw), so it is the same monitor at 1440 and at 360.
   - Rejected: a laptop. Its keyboard deck doubles the height on phones, and CUET is sat at a desktop in a centre.
   - Rejected: a photo. It cannot follow Night and Day, it is not crisp at every width, and the owner's rule is "nothing
     that looks fake".
2. **The screen scales as a whole.**
   - It is laid out at 880 x 550 design pixels, and `--u` is 1/880 of the glass (a size container).
   - All sizes are `calc(n * var(--u))`, so the text stays real text and stays crisp, with no transform and no script.
   - A phone sees the same desktop screen, smaller. The phone bar and the palette sheet of 4 Nov retire.
3. **The address bar shows where the screen really lives:** `mockmob.in/test?subject=accountancy&mode=quick` in MockMob,
   and `mockmob.in/test?subject=accountancy&mode=nta&interface=nta` in NTA style. These are the runner's own route and
   parameters (it reads `interface=nta`), so the NTA address is the one a Pro student opens.
   - Rejected: NTA's own domain (nta.ac.in or cuet.nta.nic.in) over our recreation. The exam itself has no public
     address: it runs in a locked browser at the centre. Putting a government agency's address on a MockMob screen would
     claim the screen is theirs. Both rules forbid that: the landing's truth rule, and its standing independence from
     NTA.
   - If the owner wants NTA's address anyway, it is one constant (`EXAM.address`) in homeCopy.mjs.
4. **NTA style is NTA's screen (NtaScreen in ExamScreen.jsx).** It has the guideline's anatomy listed above, in Arial,
   with numbered radio options drawn like the browser's own and NTA's capitals on the keys and the legend.
   - The palette's ">" is a real disclosure (aria-expanded) that folds the palette.
   - Clicking the chosen option again clears it.
   - There is no strike-out and there are no letter chips, because NTA has neither. MockMob's crossed-out options are
     kept and come back on switching.
   - The symbols are flat fills in NTA's sampled colours. The green is darkened to #2a9c06 so its white number holds;
     NTA's glossy sprites would be decorative gradients here.
   - Each shape is a `::before` behind the number, so a clipped shape never clips the focus or current-question ring.
   - The header holds "CUET (UG)" in NTA's indigo, then "Question Paper", then Candidate Name : Your Name, Subject Name
     and Remaining Time (hh:mm:ss), then the profile image as NTA's grey card with its pale silhouette.
5. **MockMob is our runner, as on 4 Nov**, at its desktop layout. It shows the saved note, the header with the progress
   and the timer, the chips, the Literata stem, the options with letter chips and the strike-out, Previous and Next, and
   the review panel with its word-labelled counters, chips, legend and the one volt Submit test. It follows Night and Day.
6. **The switch moves out of the screen.**
   - It is the visitor's control, not the exam's. It sits beside the monitor at full size (44 px) in the page's ink.
   - It only sets the mode: the answers, marks, strikes, position and clock are separate state, so all of them stay.
   - The screen cross-fades in 180 ms on a switch (opacity only, none under reduced motion).
   - The glass has a fixed aspect, so a switch never moves the page. The old screen grew 15 px at 1440 in NTA style.
7. **Layout.**
   - Phones: the head with Mobi, the line, the switch, the monitor, then the gate line.
   - From 1024 px: a left column holds the head, the line, the switch and the gate line (what NTA mode asks of you), with
     Mobi under them when he stays in the flow. The monitor is centred beside the column.

## Trade-offs and open points

- **On a phone the screen is a miniature.** At 390 px one design pixel is 0.39 px, so an option row is about 17 px tall
  and a chip about 14 px. The taps work (checked with touch input), but they are below the 44 px product target. The
  switch, the one control that matters on a phone, stays at 44 px. This follows D6 ("scales down as a whole"). If the owner
  wants the phone to answer comfortably, the next step is a tap-to-enlarge view, not a second layout.
- **The runner's own NTA style** (nta-classic.css: a blue header with a progress bar, rounded counters, sentence-case keys)
  is now less faithful than this preview. It is outside this packet. Bringing it to the same anatomy and the guideline's
  capitals would close the gap between the promise and the paper.
- Two things are conventional, not proven: the header order (exam name left, candidate block right) and the key colours.
  The guidelines name the parts and their corners, not every pixel.

## Verification

- Real Chrome (playwright-core), at 390x844, 1440x900, 360x740, 768x1024, 1024x768 and 1280x800, Night and Day, both
  interfaces. Screenshots are under tmp/night-1105/p3/ (before/, v1/, v2/, walk/; tmp is ignored by git).
- An interaction walk (tmp/night-1105/p3/interact.mjs) at 1440 with the mouse and at 390 with touch. Every press was
  hit-tested first, and every visible button in the screen was found uncovered. The walk checked these steps:
  - answer B in MockMob, and the clock starts;
  - switch to NTA style: question 3 is still answered, option 2 is chosen and the clock keeps running;
  - click option 2 again, and the answer clears;
  - Save & Next goes to question 4;
  - Mark for Review & Next marks 4 and goes to 5;
  - Submit reads back NTA's five counts;
  - the palette folds and unfolds;
  - chip 1 goes to question 1;
  - back in MockMob, the mark and the place are kept, and Submit test reads back;
  - the switch works from the keyboard with a visible ring.
  No page errors appeared. Nothing scrolls sideways at 360 px. Under reduced motion the screen does not fade.
- Section height: 920 to 622 px at 390, and 717 or 732 to 705 px at 1440, the same in both interfaces. Both are within the
  new budgets (700 and 720 px). `#exam-experience` reserves 572 px at 390 and 615 px at 1440 (landing.css), measured as
  the drawn content height.
- Tests changed with this decision:
  - examScreen.test.mjs: the switch outside the screen, NTA's anatomy and words, the monitor, the scale unit, the new
    height budgets, the phone bar and sheet retired, and the 44 px rule kept for the switch;
  - examPreviewParity.test.mjs: NTA's capitals are compared with the runner's words case-insensitively, the address is
    one the runner reads, and the retired Back and Palette phone labels are gone.

  The landing suites, the checklist and the health tests pass, and so does the night-calm suite over every landing file.
