'use client';

// The rest of the page's pictures, fetched ahead in idle time (20 Nov 2026, owner LK353 "sometimes not loading things" and
// LK354, his idea of "some sort of a compulsory loading screen to load all the assets").
//
// A loading screen that makes every visitor wait was weighed and not built: this page's first visitors come from an ad on a
// phone, and each second before the first screen loses some of them. What his idea is FOR is kept: nothing further down
// should arrive blank. So once the first screen is up and the browser is idle, the pictures below it (they are marked lazy,
// so they would only be asked for as the reader nears them) are asked for now, ONE at a time, top to bottom, each after the
// one before it has arrived. A reader who scrolls at once still gets theirs first (a lazy picture near the screen loads by
// itself as before); a reader who looks at the first screen for a few seconds finds the rest already there.
//
// Never on Data Saver, never on a slow line (2G or 3G by the browser's own reading), never while the tab is hidden. It reads
// no layout and writes one attribute per picture. No picture is added or changed.
import { useEffect } from 'react';

/** How long after the page has loaded the first picture is asked for, and the pause between two, ms. */
export const WARM_AFTER_MS = 2500;
export const WARM_GAP_MS = 120;

export default function AssetWarm() {
  useEffect(() => {
    const line = navigator.connection;
    if (line && (line.saveData || /(^|-)2g$|^3g$/.test(String(line.effectiveType || '')))) return undefined;
    let timer = 0; let idle = 0; let stopped = false; let waiting = null;
    let list = null;
    const later = (fn, ms) => { timer = window.setTimeout(() => { if (window.requestIdleCallback) idle = window.requestIdleCallback(fn, { timeout: 1500 }); else fn(); }, ms); };
    const next = () => {
      if (stopped) return;
      if (document.hidden) { later(next, 1000); return; }
      if (!list) list = [...document.querySelectorAll('main img[loading="lazy"]')];
      let img = list.shift();
      while (img && (img.complete || !img.isConnected)) img = list.shift();
      if (!img) return;
      const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); waiting = null; later(next, WARM_GAP_MS); };
      waiting = { img, done };
      img.addEventListener('load', done); img.addEventListener('error', done);
      img.loading = 'eager';
    };
    const start = () => later(next, WARM_AFTER_MS);
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (idle && window.cancelIdleCallback) window.cancelIdleCallback(idle);
      window.removeEventListener('load', start);
      if (waiting) { waiting.img.removeEventListener('load', waiting.done); waiting.img.removeEventListener('error', waiting.done); }
    };
  }, []);
  return null;
}
