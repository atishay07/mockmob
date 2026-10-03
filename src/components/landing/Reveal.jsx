"use client";

import { useEffect, useRef, useState } from 'react';

// Scroll choreography without an animation library. The wrapper flips
// data-in once it enters the viewport; all motion lives in CSS, keyed off that
// attribute, and only ever animates opacity and transform so nothing reflows.
// Reduced motion shows everything immediately. A <noscript> rule in the page
// keeps content visible without JavaScript.
export function Reveal({ as: Tag = 'div', className = '', delay = 0, threshold = 0.12, children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    // Reduced motion is handled in CSS (everything is visible, nothing
    // transitions). Without IntersectionObserver, show the content outright.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      node.dataset.in = 'true';
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref}
      className={`rv ${className}`}
      data-in={inView ? 'true' : 'false'}
      style={{ '--d': `${delay}ms` }}
      onFocusCapture={() => setInView(true)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
