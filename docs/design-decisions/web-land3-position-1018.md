# Landing: the position band and the Night/Day switch (18 Oct 2026)

Branch `web/land3-1018` (from live main `9578ee66`). Not pushed, not deployed.

## The owner's ask

After seeing the rejected landing branch `web/land2-1015` (18 Oct, about 4 am): "this is just so trash and a major regression... We can just keep maybe part of it... when we are going into something, inside Mistake Lab it's showing, and next it is showing what's inside [MockMob], like on top the state position. Only that part is good... Just one thing is good, which is that thing which is on the top and lighter, dark." So exactly two pieces come across, and nothing else from that branch: no copy, section, layout, art or motion.

## What was found on the rejected branch

| Piece | Where it lives there | Verdict |
| --- | --- | --- |
| The band that names the story you are in, with a progress rule | `SectionHeading.jsx` (the dock), `sectionHeadingPhase.mjs`, `section-heading.css` | Ported, as a standalone band. The heading rework around it is not ported. |
| The light and dark switch in the top bar | `ThemeToggle.jsx` in `NavBar.jsx` | The live landing already has this same component in the same place, and its current version is newer (sun and moon glyphs, 64 by 44 px target). Nothing to port; checked and locked by a test. |

Also left behind on purpose: the branch's Start key that rises into the bar (it moves the switch into the menu on phones) and its removal of the switch's first-visit hint.

## The band (`SectionPosition.jsx`, `section-position.css`, `sectionPositionPhase.mjs`)

- **Task.** A held story pins its stage, so by the middle of it the heading is far above. The band says which story this is and how far through it you are.
- **Names.** The words of the sections' own headings on the live page: "Inside the Mistake Lab", "What's inside MockMob" (MockMob in the accent, as the owner saw it), "Score Recovery Lab". Only the three held stories, because that is where the heading goes missing; in ordinary sections the heading is on screen.
- **Behaviour.** On once the section's heading has gone under the band and the story is still running; off when the story has run. A 2px rule fills with the hold and is full on the last step.
- **Look.** The bar's own paper, one hairline, one accent rule. No glow, no dot, no action. Sentence case. One type size (the display face at 1rem, 700).
- **Alternatives rejected.** Porting the whole docking-heading rework (it changes every heading and its motion); putting the name inside the site bar (no room beside the switch on phones); naming every section of the page (a permanent band with no job where the heading is already in view).
- **Under it.** The three stories start their stage under the band and tuck up by its height, so the gap from heading to story is the same as before. Measured: 89 px at 390 wide before and after for the Lab; wide windows move about 20 px because a centred stage splits the change.
- **States.** Off at the top, between stories and at the end. On. Reduced motion (both switches): instant swap, no travel. Reduced transparency: solid paper. Landscape phones under 521 px tall and print: hidden. Open menu: the menu sits over it. No JavaScript: never shown, the page reads as before.
- **Accessibility.** Not a link, not live, never takes a tap (`pointer-events: none`, checked with a hit-test). A labelled group with the name as text only while on; absent from the accessibility tree while off. The switch is a labelled `role="switch"`, reachable in two Tabs, toggled by Space and Enter, with a visible focus ring.
- **Performance.** One rect read per frame, only for sections on screen, only while one is; one style write for the rule, one state write when the band changes.

## Verification

Unit tests: `sectionPositionPhase.test.mjs` (maths) and `landingPosition.test.mjs` (page wiring, no action or live region, motion and print, the switch). Headless browser at 390 x 844 and 1440 x 900, Night and Day: the three stories mid-hold name the right section, the rule reads 0.5 at mid-hold, the switch changes the theme by pointer and keyboard with the band on, no console errors, nothing invisible over the page. Screenshots are in `tmp/land3/` (not committed). Not tested on a real phone.

## Open assumptions

- The owner's "lighter, dark" was read as the Night/Day switch. If he meant a different look for it, that is a new ask.
- The band could also name the later sections (Compass, DU eligibility, Pricing); left out because their headings are in view.
