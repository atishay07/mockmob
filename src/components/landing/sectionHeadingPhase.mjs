// The docking heading's phase (SectionHeading.jsx), from one read of the window. All values are px from
// the window's top except vh.
//   full     the heading as written
//   lift     its top has risen past liftAt of the window: the sub fades
//   compact  the title is half under the band: the band shows the heading's short form
//   past     the section's held story has run (its track's end has come up the screen): the band leaves
// titleBottom, titleHeight: the title's box. fullTop: the heading block's top. line: the band's bottom edge.
// end: the held story's track bottom (hasTrack) or else the section's bottom.
export const LIFT_AT = 0.3;

export function headingPhase({ titleBottom, titleHeight, fullTop, line, vh, end, hasTrack, liftAt = LIFT_AT }) {
  if (titleBottom - titleHeight / 2 < line) {
    // At a story's last step the track's end rests on the window's bottom (rounded), so a few px of slack.
    const running = hasTrack ? end > vh - 4 : end > line + vh * 0.25;
    return running ? 'compact' : 'past';
  }
  return fullTop < vh * liftAt ? 'lift' : 'full';
}
