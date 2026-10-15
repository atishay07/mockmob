// The docking heading's phase (SectionHeading.jsx), from one read of the window. All values are px from
// the window's top except vh.
//   full     the heading as written
//   compact  the title has gone under the band: the band shows the heading's short form in its place; the sub
//            stays in the flow and slides on under the glass, so no empty band opens between heading and story
//   docked   the sub has gone under the band too: it fades there, out of sight
//   past     the section's held story has run (its track's end has come up the screen): the band leaves
// titleBottom: the title's bottom. restBottom: the bottom of what follows the title in the heading (its sub,
// else the title). line: the band's bottom edge.
// end: the held story's track bottom (hasTrack) or else the section's bottom.
export function headingPhase({ titleBottom, restBottom = titleBottom, line, vh, end, hasTrack }) {
  if (titleBottom <= line) {
    // At a story's last step the track's end rests on the window's bottom (rounded), so a few px of slack.
    const running = hasTrack ? end > vh - 4 : end > line + vh * 0.25;
    if (!running) return 'past';
    return restBottom <= line ? 'docked' : 'compact';
  }
  return 'full';
}
