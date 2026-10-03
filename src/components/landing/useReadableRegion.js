'use client';

import { useEffect, useState } from 'react';

// Observe a bounded reading region, not an entire section that can span several screens.
// Hysteresis keeps a small scroll correction from repeatedly starting and stopping playback.
export function useReadableRegion(ref) {
  const [readable, setReadable] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let observer;
    let inView = false;
    const publish = () => setReadable(inView && !document.hidden);
    const chrome = [...document.querySelectorAll('.mm-nav, .mm-dock, .arena-topbar, .arena-bottomnav')];
    const measure = () => {
      let top = 12, bottom = 12;
      for (const element of chrome) {
        const box = element.getBoundingClientRect();
        if (!box.height || getComputedStyle(element).visibility === 'hidden') continue;
        if (box.top <= 12 && box.bottom > 0) top = Math.max(top, box.bottom + 12);
        if (box.bottom >= innerHeight - 12 && box.top < innerHeight && box.top > innerHeight / 2) bottom = Math.max(bottom, innerHeight - box.top + 12);
      }
      observer?.disconnect();
      if (typeof IntersectionObserver === 'undefined') { inView = true; publish(); return; }
      observer = new IntersectionObserver(([entry]) => {
        inView = entry.intersectionRatio >= (inView ? 0.55 : 0.8);
        publish();
      }, { rootMargin: `-${top}px 0px -${bottom}px 0px`, threshold: [0, 0.55, 0.8, 1] });
      observer.observe(node);
    };
    const resize = new ResizeObserver(measure);
    chrome.forEach(element => resize.observe(element));
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    document.addEventListener('visibilitychange', publish);
    return () => {
      observer?.disconnect(); resize.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', publish);
    };
  }, [ref]);
  return readable;
}
