'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// "Looks best on a laptop" (owner, 9 Nov 2026, like klayprep.com's phone note): on a phone's first visit only, a small
// note under the nav for a few seconds, with a close key. Once seen it never comes back on that phone (localStorage;
// if storage is blocked it shows once per page load at most). Nothing else changes: the page works the same on a phone.
export const HINT_KEY = 'mm.deskhint.v1';
const SHOW_AFTER_MS = 2200;
const STAY_MS = 6500;

export function resetDesktopHint() {
  try { localStorage.removeItem(HINT_KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('mm-deskhint'));
}

export default function DesktopHint() {
  const [state, setState] = useState('off'); // off | on | leaving

  useEffect(() => {
    let showTimer = 0;
    let hideTimer = 0;
    const arm = () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      if (!window.matchMedia('(max-width: 759px)').matches) return;
      try {
        if (localStorage.getItem(HINT_KEY)) return;
        localStorage.setItem(HINT_KEY, '1');
      } catch { /* storage blocked: shown this once */ }
      showTimer = window.setTimeout(() => {
        setState('on');
        hideTimer = window.setTimeout(() => setState('leaving'), STAY_MS);
      }, SHOW_AFTER_MS);
    };
    arm();
    // The test link's "Show the laptop note again" (TestBar) re-arms it at once.
    const again = () => { setState('off'); arm(); };
    window.addEventListener('mm-deskhint', again);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.removeEventListener('mm-deskhint', again);
    };
  }, []);

  if (state === 'off') return null;
  return (
    <div className="lp-deskhint" role="status" data-state={state} onAnimationEnd={() => { if (state === 'leaving') setState('off'); }}>
      <span>Looks best on a laptop or desktop</span>
      <button type="button" className="lp-deskhint__close" onClick={() => setState('leaving')} aria-label="Close">
        <X size={16} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}
