'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, live. Before the browser answers (the server, the first paint) it is
 * `serverValue`, so the markup the server sends is the markup the first client render makes.
 */
export function useMedia(query, serverValue = false) {
  return useSyncExternalStore(
    (notify) => {
      let list;
      try { list = window.matchMedia(query); } catch { return () => {}; }
      list.addEventListener?.('change', notify);
      return () => list.removeEventListener?.('change', notify);
    },
    () => { try { return window.matchMedia(query).matches; } catch { return serverValue; } },
    () => serverValue,
  );
}
