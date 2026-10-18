// Where the reader is in the landing's held stories (SectionPosition.jsx), from one read of the window.
// All values are px from the window's top except vh.
//
// A held story pins its stage while the page scrolls through a tall track, so the section's heading has gone
// by long before the story ends and nothing on screen says which story this is. The position band names it.
//   before  the section's heading still reads below the band: the band stays out of the way
//   on      the heading has gone under the band and the story is still running: the band shows its name
//   past    the story has run (its track's end has come up the screen): the band leaves
// titleBottom: the heading's bottom. line: the band's bottom edge. end: the held track's bottom (hasTrack) or
// else the section's bottom.
export function positionPhase({ titleBottom, line, vh, end, hasTrack }) {
  if (titleBottom > line) return 'before';
  // At a story's last step the track's end rests on the window's bottom (rounded), so a few px of slack.
  const running = hasTrack ? end > vh - 4 : end > line + vh * 0.25;
  return running ? 'on' : 'past';
}

const clamp01 = (n) => (n > 0 ? (n < 1 ? n : 1) : 0); // never -0

// How far through the section the reader is, 0 to 1.
//   hasTrack  the held track's own top and height: the hold runs while the stage is pinned, from the track's top
//             at the window's top to its bottom at the window's bottom, so the rule is full on the last step.
//   otherwise the section's top and height: full when its bottom has come up to the window's bottom. A section
//             shorter than a screen would jump straight to full, so its run is never less than half its height.
export function positionProgress({ top, height, vh, line, hasTrack }) {
  if (!(height > 0)) return 0;
  if (hasTrack) {
    const hold = height - vh;
    return hold > 0 ? clamp01(-top / hold) : 0;
  }
  const run = Math.max(height - (vh - line), height / 2);
  return clamp01((line - top) / run);
}

// The section the band names, from one read of each section on screen (null for one that is not), in page order:
// { titleBottom, top, height, hasTrack } with top and height the held track's (hasTrack) or else the section's.
// The first that is on wins (stories do not overlap). index -1: the band leaves.
export function positionAt(reads, { line, vh }) {
  for (let index = 0; index < reads.length; index += 1) {
    const read = reads[index];
    if (!read) continue;
    const { titleBottom, top, height, hasTrack } = read;
    if (positionPhase({ titleBottom, line, vh, end: top + height, hasTrack }) === 'on') {
      return { index, progress: positionProgress({ top, height, vh, line, hasTrack }) };
    }
  }
  return { index: -1, progress: 0 };
}
