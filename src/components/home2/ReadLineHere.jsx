'use client';

// The live home's reading line, carried over (Revision 2 of the spec): the hairline along the site bar's bottom edge that fills
// as the reader goes down the page, with Mobi riding its head on a wide window (NavReadLine.jsx). NavBar draws it on "/" only,
// and this page leaves NavBar as it is, so here the same component is placed into the same bar once the page has woken.
import '@/app/marketing.css'; // reads the system's site bar (mm-nav)
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import NavReadLine from '@/components/progress/NavReadLine';

export default function ReadLineHere() {
  const [bar, setBar] = useState(null);
  useEffect(() => {
    const nav = document.querySelector('.mm-nav');
    if (nav && !nav.querySelector('.mm-nav__read')) setBar(nav);
  }, []);
  return bar ? createPortal(<NavReadLine />, bar) : null;
}
