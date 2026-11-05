# Web R3-exam: the exam screen on phones (R3-D6, LK106), 5 Nov 2026

Branch web/r3-exam, from main 83925b982. Owner's words (5 Nov, about 10 am): "The entire mode screen and all that you have
done, I like it in the desktop version. If we could somehow integrate the mobile version also because this is just too
small to see on mobile. It's good as a reference point but if you can implement something tastefully again."

## The problem, measured

- Preparoo research B12 (tmp-night/r3-research/ALL.md): at 390 the #exam-experience text rendered at 4.1-4.5 px, 26 of its
  37 texts under 10 px; the question heading at 6.2 px.
- Re-measured before the change on this branch (tmp/r3/exam/before/report.json): smallest text 4.07 px at 390 and 3.72 px at
  360; every target inside the screen under 44 px (options 17 px tall, Previous 15 px, chips 14 px, NTA's Save & Next 12 px).

## Decisions

1. **The monitor stays exactly as it is from 761 px.** Its markup, its CSS and its 880 x 550 design-pixel screen are
   untouched; the tests pin D6's numbers (bezel padding, 16:10 glass, `--u: calc(100cqw / 880)`).
2. **Below 761 px, a phone of the monitor's material.** ExamDevice draws the monitor and a phone side by side in the DOM
   and CSS shows one. The phone is built only from the monitor's own tokens: the bezel's warm charcoal and hairline edge,
   the camera centred in the top bezel (as on the monitor), the stand's aluminium as the 1.5 px rim and the side keys, and
   the monitor's one soft shadow. No new colour, no gradient, no glass (test-pinned).
3. **A phone-native screen, not a miniature.** `--u` is 1 CSS px inside the phone, and every size the miniature drew under
   12 px or every target under 44 px is set again: question 19 px (NTA style 18 px in its Arial), options 16 px,
   nothing under 12 px, every target at least 44 px (options 52, bar keys 48, chips 44, NTA keys 44).
4. **The runner's own phone anatomy** (TestPageClient.jsx), so the preview never promises a screen the student does not
   get (T007, T009: show the real product):
   - MockMob: a slim header (Exit test, "Question 3 of 15" with its progress line, the timer), the chips, the state, Mark
     and Clear, the stem, the four options with press-and-hold strike-out, the strike note, and the runner's phone bar:
     Previous, Review (opens the drawer), Next (the volt key, as the runner's `is-primary`).
   - NTA style: NTA's header keeps the exam's name, the Question Paper icon and the Remaining Time; the section bar; the
     question with NTA's grey circle arrow and numbered radios; the runner's five NTA phone keys (Previous, Clear
     Response and Question Palette; Mark for Review & Next and Save & Next). NTA's palette, Arial, symbols and colours
     are the monitor's, unchanged.
5. **The header's details and the palette collapse into a drawer** (S014: progressive disclosure for secondary functions;
   the clock, the position and the answer keys stay on screen). MockMob's drawer: the attempt and subject (the header's
   title), the progress row, the four labelled counters, the 15 chips, the legend, Submit test and its read-back. NTA
   style's drawer is NTA's palette sheet: the candidate block and photo (folded from the header), the section summary with
   a count in each symbol, the section, the palette and Submit.
6. **The drawer behaves like a sheet** (S016): a named dialog, `inert` and hidden while shut, rising on transform only
   (280 ms in, 220 ms out, cubic-bezier(.32, .72, 0, 1)) over a dimmed paper (warm in Day); Escape, the close key, a
   chip or a tap on the dimmed paper shuts it; the focus moves to the close key and back to the opener. Reduce motion:
   no transform.
7. **One state, two drawings.** Both trees read ExamScreen's one state, so the switch beside the device keeps the
   answers, the marks, the strikes, the position and the clock across MockMob and NTA style (walked, below). The option
   buttons are one element list drawn by both. The demo clock watches the device root (the phone or the monitor,
   whichever shows), not the hidden screen.
8. **One fixed glass height per width band** (640 px from 375 px, 660 px below, where options wrap to two lines), so
   switching interfaces never moves the page.
9. **A fix found on the way:** on a phone a long press also fires the context menu, which toggled the strike back. The
   preview now guards it as the runner does (a flag set by the press, cleared by the next pointer down), and the phone's
   options set `-webkit-touch-callout: none`.

## Old rules this changes (tests updated, none deleted)

- examScreen.test.mjs: the D6 rule "a phone sees the same desktop screen, smaller" is replaced by R3-D6; the section
  budget at 390 goes from 700 px to 1,060 px (1,100 px at 360; 1,440 stays at 720 px), because a readable phone screen
  is taller than a 4 px miniature (measured 1,031 px at 390 and 1,051 px at 360). The switch check now reads
  `<ExamDevice ref={deviceRef} phone={phone}>`. Five new tests pin the phone: the material, the sizes, the targets, the
  drawer and the one state; the opt-in browser test also measures text and targets at 360 and 390.
- examPreviewParity.test.mjs: one new test holds the phone's anatomy and words to the runner's phone bar and sheet.
- landing.css: #exam-experience's contain-intrinsic-size re-measured: 981 px below 960 px (the phone at 390: 1,031 px with
  padding; it was 572 for the monitor), 615 px from 960 px (the monitor at 1440: 705 px with padding, unchanged).

## Verified

See the report for this packet: screenshots in tmp/r3/exam/ (v2 = the final captures; walk/ = the touch walk), with
text sizes and target sizes measured in the browser at 360x640 and 390x844, Night and Day, both interfaces.
