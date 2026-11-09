'use client';

import { useEffect, useState } from 'react';
import { resetDesktopHint } from './DesktopHint';

// The share link's test switches (owner, 9 Nov 2026: "add any other test features in both so that I can send that link to
// anyone, and people can also take others' opinions on which is better"). Only off the live site (any host that is not
// mockmob.in), so it never reaches students even if this code is merged. One row under the nav that scrolls away:
//   - Scrolling: Suggested (phones scroll freely, laptops hold each story) | Free everywhere | Held everywhere. It sets
//     html[data-scroll] (ScrollStory.jsx and the stylesheets read it) and is kept on this device.
//   - "Show the laptop note again" brings back the phone's first-visit note.
const LIVE_HOSTS = new Set(['mockmob.in', 'www.mockmob.in']);
export const SCROLL_KEY = 'mm.test.scroll';
const MODES = [
  { id: 'suggested', label: 'Suggested', note: 'Phones scroll freely. Laptops stop on each story.' },
  { id: 'free', label: 'Free', note: 'Nothing stops the page, on any screen.' },
  { id: 'held', label: 'Held', note: 'Each story stops the page until it is done, on any screen (like the live site on laptops).' },
];

export function applyScrollMode(mode) {
  const root = document.documentElement;
  if (mode === 'free' || mode === 'held') root.setAttribute('data-scroll', mode);
  else root.removeAttribute('data-scroll');
  window.dispatchEvent(new Event('mm-scroll'));
}

export default function TestBar() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState('suggested');

  useEffect(() => {
    if (LIVE_HOSTS.has(window.location.hostname)) return;
    let saved = 'suggested';
    try { saved = localStorage.getItem(SCROLL_KEY) || 'suggested'; } catch { /* storage blocked */ }
    applyScrollMode(saved);
    // Drawn on the next frame, after hydration (it exists only in the browser).
    const frame = requestAnimationFrame(() => { setShow(true); setMode(saved); });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!show) return null;
  const pick = (id) => {
    setMode(id);
    try { localStorage.setItem(SCROLL_KEY, id); } catch { /* storage blocked */ }
    applyScrollMode(id);
  };
  const current = MODES.find((m) => m.id === mode) || MODES[0];
  return (
    <aside className="lp-testbar" aria-label="Test version switches">
      <div className="mm-wrap lp-testbar__in">
        <p className="lp-testbar__title">Test version</p>
        <div className="lp-testbar__group">
          <span className="lp-testbar__label" id="lp-testbar-scroll">Scrolling</span>
          <div className="lp-testbar__seg" role="radiogroup" aria-labelledby="lp-testbar-scroll">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => pick(m.id)}>{m.label}</button>
            ))}
          </div>
        </div>
        <button type="button" className="lp-testbar__link" onClick={resetDesktopHint}>Show the phone note again</button>
        <p className="lp-testbar__note">{current.note}</p>
      </div>
    </aside>
  );
}
