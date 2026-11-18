'use client';

// The hero's one mark (18 Nov 2026, owner LK308): the highlighter goes over the headline's middle line once the page is
// the reader's. On a first visit the opening still covers the page when this mounts, so the swipe waits for the opening's
// hand-off (the window event mm:opening, as HeroMobi's wave does); otherwise it comes a beat after the page appears.
import { useEffect, useState } from 'react';
import Doodle from '@/components/doodle/Doodle';

export default function HeroMark({ mark = 'highlight', tone = 'volt', delay = 420, children }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let timer = 0;
    const go = () => { timer = window.setTimeout(() => setOn(true), delay); };
    if (window.__mmOpening?.phase !== 'run') { go(); return () => window.clearTimeout(timer); }
    const onOpening = () => { window.removeEventListener('mm:opening', onOpening); go(); };
    window.addEventListener('mm:opening', onOpening);
    return () => { window.removeEventListener('mm:opening', onOpening); window.clearTimeout(timer); };
  }, [delay]);
  return <Doodle mark={mark} tone={tone} when={on}>{children}</Doodle>;
}
