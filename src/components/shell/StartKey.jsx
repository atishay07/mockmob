"use client";

// The Start key: an action, not a page (plan 2.1). It opens the Start sheet, which grows out of it.
// Volt is the only action colour; the key carries the word Start and no glyph (DOCK.md 3.1).
export default function StartKey({ variant = 'sidebar', open = false, onOpen }) {
  return (
    <button
      type="button"
      className={`sh-start sh-start--${variant}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="start-sheet"
      data-tour="nav-start"
      onClick={(event) => onOpen?.(event.currentTarget)}
    >
      <span className="sh-start__word">Start</span>
    </button>
  );
}
