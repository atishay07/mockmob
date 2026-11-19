"use client";

// The ways into Search (lane palette, 18 Nov 2026).
//   <SearchKey />    the rail's quiet field-shaped key, right above Today: a search icon, "Search", and the key hint as two
//                    caps (Shift Shift on Windows, Linux and ChromeOS since 20 Nov: Shift tapped twice; ⌘ K on a Mac, read after
//                    mount; Shift Shift until then, so the server and the first render agree). aria-keyshortcuts lists the chords
//                    that work (searchShortcut); ARIA cannot express a double tap.
//   <SearchField />  the phone and tablet field (no rail there): full width, 44 px, no key hint. On the You page and at the top
//                    of the Start sheet. `onOpen` lets the Start sheet step aside first and hand Search the opener.
import { useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';
import { searchShortcut } from '@/lib/search/searchModel.mjs';
import { openSearch, useSearchState } from './searchStore';
import './search.css';

const noSubscription = () => () => {};
/** True on a Mac (read now; for event handlers). */
export const macNow = () => {
  try { return /mac/i.test(navigator.userAgentData?.platform || navigator.platform || ''); } catch { return false; }
};

/** True on a Mac, after mount; false on the server and in the first client render. */
export function useIsMac() {
  return useSyncExternalStore(noSubscription, macNow, () => false);
}

export function SearchKey() {
  const keys = searchShortcut({ mac: useIsMac() });
  const { open } = useSearchState();
  return (
    <button
      type="button"
      className="srch-key mk-press"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts={keys.aria}
      data-search-key=""
      onClick={(event) => openSearch({ opener: event.currentTarget })}
    >
      <Search className="srch-key__icon" size={17} strokeWidth={2} aria-hidden="true" />
      <span className="srch-key__word">Search</span>
      {/* Two caps: Shift Shift on Windows, Linux and ChromeOS (Shift tapped twice), ⌘ K on a Mac. */}
      <span className="srch-key__caps" aria-hidden="true">{keys.caps.map((cap, i) => <kbd key={`${i}-${cap}`}>{cap}</kbd>)}</span>
    </button>
  );
}

export function SearchField({ className = '', onOpen = null }) {
  const { open } = useSearchState();
  return (
    <button
      type="button"
      className={`srch-field mk-press ${className}`.trim()}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(event) => (onOpen ? onOpen(event) : openSearch({ opener: event.currentTarget }))}
    >
      <Search className="srch-field__icon" size={18} strokeWidth={2} aria-hidden="true" />
      <span className="srch-field__word">Search</span>
    </button>
  );
}
