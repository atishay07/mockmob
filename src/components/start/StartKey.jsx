"use client";

// The Start key: an action, not a page. It opens the Start sheet, which grows out of it.
//   variant 'sidebar'  a full-width volt key under the logo (from 1024 px)
//   variant 'bar'      a 56 px round volt key in the centre of the phone and tablet dock's tab capsule (Today, Practice,
//                      Start, Mob, You; WEB-NAV-1019 option A): its play mark and word sit on the tabs' icon and label
//                      lines. Lime when the page has no key of its own on screen; while the page's own volt key is in
//                      view it draws data-quiet (a raised disc, an ink word) so a phone never holds two lime fills
//                      (W-075). Same box and place either way, and it opens the sheet either way.
// Volt is the one action colour; the key carries the word Start with a play mark.
import { openStart, useStartState } from './startStore';
import { useStartQuiet } from './startQuietStore';
import './start.css';

function PlayMark({ size = 14 }) {
  return (
    <svg className="stk__mark" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5 3.4v9.2c0 .5.55.8.97.53l7.1-4.6a.63.63 0 0 0 0-1.06l-7.1-4.6A.63.63 0 0 0 5 3.4Z" fill="currentColor" />
    </svg>
  );
}

export default function StartKey({ variant = 'sidebar', onOpen = null }) {
  const { open } = useStartState();
  const quiet = useStartQuiet();
  const press = (event) => {
    onOpen?.();
    openStart({ opener: event.currentTarget });
  };
  return (
    <button
      type="button"
      className={`stk stk--${variant} mk-press`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? 'start-sheet' : undefined}
      data-start-key={variant}
      data-quiet={variant === 'bar' && quiet ? '' : undefined}
      data-tour="nav-start"
      onClick={press}
    >
      {variant === 'bar' ? (
        <>
          <span className="stk__disc"><PlayMark size={22} /></span>
          <span className="stk__word">Start</span>
        </>
      ) : (
        <>
          <span className="stk__disc"><PlayMark size={13} /></span>
          <span className="stk__word">Start a session</span>
        </>
      )}
    </button>
  );
}
