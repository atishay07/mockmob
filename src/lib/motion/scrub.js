// Scrub arithmetic, the same as the app's mmScrubIndex / mmScrubX (lib/core/motion/scrub.dart):
// points spread evenly from the left edge to the right edge of a box (a road, a trend line, a
// ribbon), the first at 0 and the last at the full width. Pure, for useScrub and for tests.

/** The index x snaps to among `count` points across `width`; -1 when there are none. */
export function scrubIndex(x, width, count) {
  if (count <= 0) return -1;
  if (count === 1 || width <= 0) return 0;
  const t = Math.min(1, Math.max(0, x / width));
  return Math.min(count - 1, Math.max(0, Math.round(t * (count - 1))));
}

/** The x of point `index` among `count` points laid out as scrubIndex expects. */
export function scrubX(index, width, count) {
  if (count <= 1) return width / 2;
  return (width * Math.min(count - 1, Math.max(0, index))) / (count - 1);
}

/** The index a key moves to (arrows step, Page keys jump a tenth, Home and End go to the ends), or null for other keys. */
export function scrubKeyIndex(key, index, count) {
  if (count <= 0) return null;
  const at = index < 0 ? count - 1 : index;
  const page = Math.max(1, Math.round(count / 10));
  const to = {
    ArrowRight: at + 1, ArrowUp: at + 1, ArrowLeft: at - 1, ArrowDown: at - 1,
    PageUp: at + page, PageDown: at - page, Home: 0, End: count - 1,
  }[key];
  return to === undefined ? null : Math.min(count - 1, Math.max(0, to));
}
