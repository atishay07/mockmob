"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { getMobiPrefs, initMobiPrefs } from '@/lib/mobiPrefs';

const KEY = 'mm:theme:v1';
const MODE_KEY = 'mm:theme-mode:v1'; // 'system' when the student chose Match device; absent otherwise
const HINT_KEY = 'mm:theme-hint:v1';
const subscribe = (notify) => {
  const sync = (event) => {
    if (event.key !== KEY && event.key !== MODE_KEY) return;
    if (event.key === KEY) document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
    notify();
  };
  window.addEventListener('mm-theme', notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener('mm-theme', notify);
    window.removeEventListener('storage', sync);
  };
};
const snapshot = () => document.documentElement.dataset.theme === 'dark';

function readMode() {
  try { return localStorage.getItem(MODE_KEY) === 'system' ? 'system' : null; } catch { return null; }
}
const deviceTheme = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
};

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* Still works without storage. */ }
  window.dispatchEvent(new Event('mm-theme'));
}

/**
 * Changes the theme with the reveal that spreads from `origin` (an element; the switch or a tile).
 * `mode` is 'dark' (Night), 'light' (Daylight) or 'system' (Match device). Match device is stored
 * as a mode and resolved to dark or light here, so the first-paint script in layout.js (which only
 * knows dark and light) keeps working. The browser cross-fades two snapshots, so nothing re-lays
 * out during the reveal; reduced motion (the student's switch or the device) changes it at once.
 */
export function setThemeMode(mode, origin) {
  const theme = mode === 'system' ? deviceTheme() : mode === 'dark' ? 'dark' : 'light';
  try {
    if (mode === 'system') localStorage.setItem(MODE_KEY, 'system'); else localStorage.removeItem(MODE_KEY);
  } catch { /* The choice still applies until the page closes. */ }
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  if (theme === current) { applyTheme(theme); return; }
  if (getMobiPrefs().reduced || typeof document.startViewTransition !== 'function') {
    applyTheme(theme);
    return;
  }
  const box = origin?.getBoundingClientRect?.();
  const x = box ? box.left + box.width / 2 : window.innerWidth;
  const y = box ? box.top + box.height / 2 : 0;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  document.documentElement.dataset.themeSwitching = 'true';
  const transition = document.startViewTransition(() => applyTheme(theme));
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
  transition.finished.finally(() => { delete document.documentElement.dataset.themeSwitching; });
}

const modeSubscribe = (notify) => subscribe(notify);
const modeSnapshot = () => readMode() || (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/** 'dark' | 'light' | 'system': what the student chose (Night, Daylight, Match device). */
export function useThemeMode() {
  return useSyncExternalStore(modeSubscribe, modeSnapshot, () => 'light');
}

/** While Match device is chosen, follow the device's light and dark. Mount once per page. */
export function useDeviceThemeSync() {
  const mode = useThemeMode();
  useEffect(() => {
    if (mode !== 'system') return undefined;
    let query = null;
    try { query = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return undefined; }
    const follow = () => {
      const theme = query.matches ? 'dark' : 'light';
      if (document.documentElement.dataset.theme !== theme) applyTheme(theme);
    };
    follow();
    query.addEventListener?.('change', follow);
    return () => query.removeEventListener?.('change', follow);
  }, [mode]);
}

// Light is the default. A first-time visitor gets one quiet prompt pointing at the switch; it goes
// away on its own, on any press of the switch, and never returns once seen.
export function ThemeToggle({ hint = false }) {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  const buttonRef = useRef(null);
  useDeviceThemeSync();
  useEffect(() => { initMobiPrefs(); }, []); // the Reduce motion switch applies on every page that has a theme switch
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!hint) return undefined;
    let seen = true;
    try { seen = localStorage.getItem(HINT_KEY) === '1' || localStorage.getItem(KEY) !== null; } catch { seen = true; }
    if (seen) return undefined;
    const open = window.setTimeout(() => setShowHint(true), 1400);
    const close = window.setTimeout(() => dismissHint(), 9000);
    return () => { window.clearTimeout(open); window.clearTimeout(close); };
  }, [hint]);

  function dismissHint() {
    setShowHint(false);
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* Hint may repeat without storage. */ }
  }

  function toggle() {
    if (showHint) dismissHint();
    setThemeMode(dark ? 'light' : 'dark', buttonRef.current);
  }

  return (
    <button ref={buttonRef} type="button" className="mm-theme-toggle" role="switch" aria-checked={dark}
      aria-label="Dark mode" data-hint={showHint ? 'true' : undefined} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
      <span className="mm-theme-toggle__sky" aria-hidden="true">
        <i className="mm-theme-toggle__star" />
        <i className="mm-theme-toggle__star" />
        <i className="mm-theme-toggle__star" />
        <span className="mm-theme-toggle__thumb">
          {/* A plain sun (disc and eight rays) by day, a crescent by night: the two glyphs cross-fade on the thumb. */}
          <svg className="mm-theme-toggle__sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.35 5.35l1.85 1.85M16.8 16.8l1.85 1.85M5.35 18.65l1.85-1.85M16.8 7.2l1.85-1.85" />
          </svg>
          <svg className="mm-theme-toggle__moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" />
          </svg>
        </span>
      </span>
      {showHint ? <span className="mm-theme-hint" aria-hidden="true">Light or dark? <b>Your call</b></span> : null}
    </button>
  );
}
