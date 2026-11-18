"use client";

import { useEffect, useRef } from 'react';

// A labelled disclosure that is closed on a phone and open from a given width (round 2 of 18 Nov 2026, lane home-b: the home
// page's pricing detail and the footer's link groups). Below `from` it is a native <details>: a 56 px summary row with a chevron,
// closed by default, reached and toggled by keyboard like any other. From `from` up it is simply open: the summary row steps
// aside (r19-home-b.css hides it at that width) and `head`, the same words as a plain heading, stands over the content, so a wide
// screen reads the detail as a section, not as a row to tap. The width rule lives in the sheet (::details-content is shown from
// that width), and this effect opens the element too, for browsers without ::details-content. Without script in such a browser
// the element stays closed, so the sheet keeps its summary row there until it is open (review, 18 Nov 2026: the detail was
// otherwise unreachable on a wide screen with script off). Nothing here animates; the
// sheet's height transition (the FAQ's own 260 ms ease-out) runs only when a reader toggles it on a phone.
export function Unfold({ summary, head = null, from, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !from || typeof window.matchMedia !== 'function') return undefined;
    const wide = window.matchMedia(`(min-width: ${from}px)`);
    // `byWidth`: this element was opened by the width, not by the reader.
    let byWidth = false;
    const widen = () => { if (!node.open) { node.open = true; byWidth = true; } };
    if (wide.matches) widen();
    // Crossing the line: open on the way up; on the way down, fold again only what the width (not the reader) had opened, so a
    // phone or tablet reader who opened it before turning the screen finds it still open when the screen turns back.
    const onChange = () => {
      if (wide.matches) widen();
      else if (byWidth) { node.open = false; byWidth = false; }
    };
    wide.addEventListener?.('change', onChange);
    return () => wide.removeEventListener?.('change', onChange);
  }, [from]);
  return (
    <details ref={ref} className={`lp-fold${className ? ` ${className}` : ''}`}>
      <summary className="lp-fold__sum">{summary}</summary>
      <div className="lp-fold__body">
        {head ? <div className="lp-fold__head">{head}</div> : null}
        {children}
      </div>
    </details>
  );
}

export default Unfold;
