'use client';

// The route progress bar (owner, 16 Nov 2026): a 2 px line at the very top of every page, public and signed-in, while a
// page navigation is pending. Mounted once in the root layout. The timing is routeProgressModel.mjs (shows only after 120 ms,
// trickles toward 90 %, completes and fades in 200 ms on arrival, stops by itself at 10 s); the drawing is
// route-progress.css. It is decorative for assistive tech (aria-hidden): the router's own announcer reads the new page.
//
// What starts it:
//   - a click on a same-origin link to another page (routeProgressModel.mjs linkStartsNavigation says which);
//   - the back and forward buttons, when the address they restore is another page;
//   - startRouteProgress() (routeProgressBus.mjs) before a slow router.push, and the router's own start hook once
//     src/instrumentation-client.js calls routerTransitionStarted.
// What ends it: the path or the query on screen changes (usePathname, useSearchParams), a page restored from the
// back-forward cache, or the 10 s safety stop.
//
// A link whose click the page takes over (preventDefault) is a doubt: the router may be loading the page, or the page may
// have done something else with the click. Until the router hook is wired, such a click still starts the bar, but when the
// 120 ms are up it shows only if no dialog, sheet or Ask Mobi panel opened meanwhile, and the link is still on the page or
// sat in a sheet or menu that closed on the way out (a link that swapped its own part of the page, like "Read the chapter"
// in a deck, is gone by then and never shows the bar).

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { linkStartsNavigation, pageKey } from './routeProgressModel.mjs';
import { attachRouteProgress, finishRouteProgress, resetRouteProgress, routerHooked, startRouteProgress } from './routeProgressBus.mjs';
import './route-progress.css';

const OPEN_LAYERS = 'dialog[open], [role="dialog"], [aria-modal="true"], .amb-panel';
const SHEETS = 'dialog, [role="dialog"], [aria-modal="true"], .mm-nav__sheet, [role="menu"]';

// The page on screen, so the back button can tell a page change from a #fragment.
let landedKey = '';

function Arrival() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  useEffect(() => {
    landedKey = pageKey(window.location.href);
    finishRouteProgress();
  }, [pathname, search]);
  return null;
}

function linkOf(anchor) {
  const raw = anchor.getAttribute('href');
  let href = '';
  try { href = new URL(raw, window.location.href).href; } catch { href = ''; }
  return {
    href,
    target: anchor.getAttribute('target'),
    download: anchor.hasAttribute('download'),
    optOut: anchor.hasAttribute('data-no-route-progress'),
    disabled: anchor.getAttribute('aria-disabled') === 'true' || anchor.getAttribute('aria-busy') === 'true',
    popup: anchor.hasAttribute('aria-haspopup') || anchor.hasAttribute('aria-controls') || anchor.getAttribute('role') === 'button',
  };
}

export default function RouteProgress() {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    const bar = root?.firstElementChild;
    if (!root || !bar) return undefined;
    landedKey = pageKey(window.location.href);

    const render = (phase) => {
      if (phase === 'run') {
        bar.style.removeProperty('transform');
        root.dataset.phase = 'idle';
        void bar.offsetWidth; // restart the trickle from its start
        root.dataset.phase = 'run';
        return;
      }
      if (phase === 'done') {
        // Complete from wherever the trickle has got to: hold its present scale, then run to the full width.
        const now = window.getComputedStyle(bar).transform;
        bar.style.transform = now && now !== 'none' ? now : 'scaleX(0.08)';
        root.dataset.phase = 'done';
        void bar.offsetWidth;
        bar.style.transform = 'scaleX(1)';
        return;
      }
      root.dataset.phase = 'idle';
      bar.style.removeProperty('transform');
    };
    const detach = attachRouteProgress(render);

    // One click, two looks: before the page's own handlers (which link, which page) and after them (did the page keep
    // the click for itself).
    let candidate = null;
    const before = (event) => {
      candidate = null;
      const anchor = event.target && typeof event.target.closest === 'function' ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      if (!linkStartsNavigation(event, linkOf(anchor), window.location.href)) return;
      candidate = { event, anchor, inSheet: Boolean(anchor.closest(SHEETS)), layers: document.querySelectorAll(OPEN_LAYERS).length };
    };
    const after = (event) => {
      const c = candidate;
      candidate = null;
      if (!c || c.event !== event) return;
      // Not taken over: the browser loads the page itself (a plain link). The bar runs until this page unloads.
      if (!event.defaultPrevented) { startRouteProgress(); return; }
      // Taken over by the router or by the page. With the router hook wired the hook has already started it if it was a
      // navigation; without it, a doubt (see the head of this file).
      if (routerHooked()) return;
      startRouteProgress({
        confirm: () => document.visibilityState !== 'hidden'
          && document.querySelectorAll(OPEN_LAYERS).length <= c.layers
          && (c.anchor.isConnected || c.inSheet),
      });
    };
    const onPop = () => {
      if (pageKey(window.location.href) !== landedKey) startRouteProgress();
    };
    const onShow = (event) => { if (event.persisted) resetRouteProgress(); };

    window.addEventListener('click', before, true);
    window.addEventListener('click', after);
    window.addEventListener('popstate', onPop);
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('click', before, true);
      window.removeEventListener('click', after);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pageshow', onShow);
      detach();
    };
  }, []);

  return (
    <>
      <div ref={ref} className="mm-rp" data-phase="idle" aria-hidden="true">
        <div className="mm-rp__bar" />
      </div>
      <Suspense fallback={null}>
        <Arrival />
      </Suspense>
    </>
  );
}
