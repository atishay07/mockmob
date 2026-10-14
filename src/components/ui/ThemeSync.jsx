"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { resolveTheme, THEME_KEY, VISITOR_HINT_KEY } from '@/../shared/theme.mjs';

function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

// The boot script in <head> picks the theme on a full page load. Client navigations do not
// reload, so a student who signs in on a Light marketing page and moves into Practice would stay
// Light. This keeps the same rule on every route change: a saved choice wins and is never
// touched; otherwise the product and members get Night, strangers Light. Renders nothing.
export function ThemeSync() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    const saved = read(THEME_KEY);
    const next = resolveTheme({ saved, hint: read(VISITOR_HINT_KEY), pathname });
    if (root.dataset.theme === next) return;
    root.dataset.theme = next;
    window.dispatchEvent(new Event('mm-theme'));
  }, [pathname]);
  return null;
}
