"use client";

// Mounts the one Start sheet for the signed-in shell. The keys (StartKey) open it through
// startStore; this host reads the student, works out the rows (useStartSheet) and renders the
// sheet while it is open. ?start=open|quick|full|nta on any signed-in page opens it on arrival
// (deep links and app shortcuts); the parameter is then dropped from the address.
import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import StartSheet from './StartSheet';
import { closeStart, openStart, startState, useStartState } from './startStore';
import { startRequestFromSearch } from './startModel.mjs';
import { useStartSheet } from './useStartSheet';
import './start.css';

/** The visible Start key for this layout (sidebar on desktop, bar key below 1024 px). */
function visibleKey() {
  return [...document.querySelectorAll('[data-start-key]')].find((n) => n.getClientRects().length > 0) || null;
}

function firstSegment(href) {
  return String(href || '').split(/[?#]/)[0].split('/').filter(Boolean)[0] || '';
}

export default function StartSheetHost({ previewLinks = null }) {
  const { user } = useAuth();
  const state = useStartState();
  const pathname = usePathname();
  const model = useStartSheet({ open: state.open, user });
  const lastPath = useRef(pathname);

  // ?start= on arrival opens the sheet once.
  useEffect(() => {
    const request = startRequestFromSearch(window.location.search);
    if (!request) return;
    const id = window.setTimeout(() => {
      openStart({ row: request.row, opener: visibleKey() });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('start');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      } catch { /* The address keeps the parameter; harmless. */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // A route change closes it (the row's link is already the feedback).
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (startState().open) closeStart();
  }, [pathname]);

  const returnFocus = useCallback(() => visibleKey(), []);
  const linkFor = useCallback((href) => (previewLinks ? previewLinks[firstSegment(href)] || href : href), [previewLinks]);

  if (!state.open) return null;
  return <StartSheet key={state.at} open model={model} initialRow={state.row} returnFocus={returnFocus} linkFor={linkFor} onClose={closeStart} />;
}
