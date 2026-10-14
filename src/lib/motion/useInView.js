'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tells a component when it is on screen. Returns [ref, inView]; put ref on the element.
 *   once        stop watching after the first time it is seen (default true)
 *   rootMargin  grow or shrink the viewport (default '0px')
 *   threshold   how much must show (default 0.15)
 *   initial     what to report before the browser has said anything (default false). Without
 *               IntersectionObserver the answer is always true, so nothing stays hidden.
 */
export function useInView({ once = true, rootMargin = '0px', threshold = 0.15, initial = false } = {}) {
  const [inView, setInView] = useState(initial);
  const observerRef = useRef(null);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const ref = useCallback((node) => {
    disconnect();
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) {
        setInView(true);
        if (once) disconnect();
      } else if (!once) {
        setInView(false);
      }
    }, { rootMargin, threshold });
    observer.observe(node);
    observerRef.current = observer;
  }, [disconnect, once, rootMargin, threshold]);

  useEffect(() => disconnect, [disconnect]);
  return [ref, inView];
}
