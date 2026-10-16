'use client';

// Mobi for one real moment in a fixed slot (lib/mobiScreens.js says which moment earns which act):
//   <MomentMobi act="proud" size={52} fallback={<Icon />} alone label="Rule kept." />
// He stands at ease until the slot is on screen, then plays the act once, so a moment further down
// the page lands when the student reaches it, not while it is off screen. A once act leaves him
// standing (MobiReact). With `alone`, he plays only when no other Mobi is in view at that moment:
// the bigger Mobi already on screen wins and this slot keeps its `fallback` (an icon, or nothing).
// The slot keeps one size in every state, so nothing beside it moves. Decorative unless `label`
// is given; the moment is always said in words beside him. Celebrations and Reduce motion apply
// through MobiReact.

import { useEffect, useRef, useState } from 'react';
import MobiReact from './MobiReact';
import { useInView } from '@/lib/motion/useInView';
import { aloneInView } from '@/lib/mobiScreens';
import './moment-mobi.css';

export default function MomentMobi({ act, size = 56, fallback = null, alone = false, label, facing = 'right', className = '' }) {
  const [seenRef, seen] = useInView({ once: true, threshold: 0.6 });
  const nodeRef = useRef(null);
  const setRef = (node) => { nodeRef.current = node; seenRef(node); };
  // undefined until the slot has been seen; then whether he may show (decided once, on sight).
  const [shown, setShown] = useState(alone ? undefined : true);
  useEffect(() => {
    if (!alone || !seen || shown !== undefined) return;
    const own = nodeRef.current;
    const others = [...document.querySelectorAll('.mobi-react')].filter((el) => !own?.contains(el)).map((el) => el.getBoundingClientRect());
    queueMicrotask(() => setShown(aloneInView(others, window.innerHeight)));
  }, [alone, seen, shown]);

  const mobi = shown === true;
  return (
    <span ref={setRef} className={`moment-mobi ${className}`.trim()} data-shown={mobi ? 'true' : 'false'} style={{ '--moment-size': `${size}px` }}>
      {mobi ? <MobiReact act={seen ? act : 'idle'} size={size} facing={facing} label={label} /> : fallback}
    </span>
  );
}
