// The rules of the two frames that advance by themselves on /home-next (spec HOME-NEXT-SPEC-2026-11-20, sections 3 and 5;
// the owner's own ask, LK360, which overrides the 16 Nov "nothing self-moving" rule for these two frames only).
//
// Pure, so node --test holds them (data/tests/home_next_1120.test.mjs); useAutoplay.js applies them in the browser.
//   * A row holds for its own demo, HOLD_MS.min to HOLD_MS.max (Revision 2 of the spec, LK192: "increasing the time of each,
//     making it less jumpy"), then advances, and only while all of these hold: the page has hydrated, motion is not reduced
//     (neither prefers-reduced-motion nor html[data-motion='reduced']), the section is on screen, the tab is visible, and
//     no reader is holding it. Under reduced motion it never runs: the rows are a plain list, the first one shown.
//   * The clock is the thin line filling on the active row: one CSS animation of transform, paused whenever the rule above
//     says no, and its end moves to the next row. No frame loop, no interval.
//   * A tap or click on a row jumps there and holds: a mouse until the pointer leaves the section, a keyboard until focus
//     leaves it, a finger for TOUCH_HOLD_MS (the one timer). Releasing starts the line of the row on show from empty.

export const HOLD_MS = Object.freeze({ min: 6000, max: 8000, usual: 7000 });
export const TOUCH_HOLD_MS = 8000;

/** How long a row holds before the next: its own `ms`, kept inside HOLD_MS. */
export function holdFor(item) {
  const ms = Number(item?.ms);
  return Number.isFinite(ms) ? Math.min(HOLD_MS.max, Math.max(HOLD_MS.min, ms)) : HOLD_MS.usual;
}

/** True only when the frame may advance by itself. */
export function autoplayRuns({ ready = false, reduced = true, onScreen = false, visible = false, held = true } = {}) {
  return Boolean(ready && !reduced && onScreen && visible && !held);
}

/** The row after `index`, wrapping to the first. */
export const nextIndex = (index, count) => (count > 0 ? (index + 1) % count : 0);

/** Where a key moves the selection in a tab list of `count` rows, or null for any other key. */
export function keyStep(key, index, count) {
  if (count <= 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** How a click was made: 'keyboard' (no pointer), else the pointer it came from ('mouse' for a mouse, 'touch' otherwise). */
export function holdKind(detail, pointerType) {
  if (detail === 0) return 'keyboard';
  return pointerType === 'mouse' ? 'mouse' : 'touch';
}

/** Is motion reduced for this reader? The system setting or the app's own switch (src/lib/mobiPrefs.js, html[data-motion]). */
export function motionReduced(win = globalThis.window) {
  if (!win) return true;
  try {
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  } catch { /* an old browser: fall through */ }
  return win.document?.documentElement?.dataset?.motion === 'reduced';
}
