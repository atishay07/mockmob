"use client";

import { useRef, useSyncExternalStore } from 'react';

const KEY = 'mm:theme:v1';
const subscribe = (notify) => {
  const sync = (event) => {
    if (event.key !== KEY) return;
    document.documentElement.dataset.theme = event.newValue === 'light' ? 'light' : 'dark';
    notify();
  };
  window.addEventListener('mm-theme', notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener('mm-theme', notify);
    window.removeEventListener('storage', sync);
  };
};
const snapshot = () => document.documentElement.dataset.theme !== 'light';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* Still works without storage. */ }
  window.dispatchEvent(new Event('mm-theme'));
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => true);
  const buttonRef = useRef(null);

  function toggle() {
    const theme = dark ? 'light' : 'dark';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof document.startViewTransition !== 'function') {
      applyTheme(theme);
      return;
    }
    // The new theme spreads outward from the switch. The browser cross-fades two
    // snapshots, so nothing on the page re-lays out during the reveal.
    const box = buttonRef.current?.getBoundingClientRect();
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

  return (
    <button ref={buttonRef} type="button" className="mm-theme-toggle" role="switch" aria-checked={dark}
      aria-label="Dark mode" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
      <span className="mm-theme-toggle__sky" aria-hidden="true">
        <i className="mm-theme-toggle__star" />
        <i className="mm-theme-toggle__star" />
        <i className="mm-theme-toggle__star" />
        <span className="mm-theme-toggle__thumb" />
      </span>
    </button>
  );
}
