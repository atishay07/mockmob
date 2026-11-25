'use client';

// A part of the home page that phones do not get (owner, 26 Nov 2026: "the website is a lot cluttered ... people on phones
// might be facing this a bit more"; the council's verdict, tmp/council/2026-11-26-landing/verdict.md). The server sends it,
// so a wide screen paints it at once and a search engine reads it; a stylesheet rule hides it under 720 px from the first
// paint (the caller's own class, r19-home-b.css), and this takes it out of the page there, so a held story inside it never
// registers its scroll listeners on a phone. Nothing is measured: one media query, read once and on change.
import { useEffect, useState } from 'react';

export const WIDE_QUERY = '(min-width: 720px)';

export function OnlyWide({ children }) {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(WIDE_QUERY);
    const read = () => setWide(list.matches);
    read();
    list.addEventListener('change', read);
    return () => list.removeEventListener('change', read);
  }, []);
  return wide ? children : null;
}

export default OnlyWide;
