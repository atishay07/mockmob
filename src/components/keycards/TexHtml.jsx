'use client';
// A typeset formula as the server drew it (handoff-1102/MATHTEX-SPEC.md section 5). The HTML comes from
// data/keycards_tex.js on the server (servedTex: prose escaped, math through KaTeX with trust off and a forbidden-command
// check), so only KaTeX's stylesheet and fonts reach the browser, never its JS. KaTeX keeps a MathML copy for screen readers.
//   <TexHtml html as className id />    `as` the wrapper element (span by default); its class is "kc-tex" plus className
// A display formula wider than its line (NCERT's ratio of two worded counts, a long determinant) is set smaller until it
// fits, down to MIN_FIT of its size; past that it scrolls sideways inside its own line (keycards.css), never widening the card.
import { useLayoutEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';

const MIN_FIT = 0.6;

function fitDisplays(root) {
  for (const d of root.querySelectorAll('.katex-display')) {
    d.style.removeProperty('--kc-fit');
    // 2% under the exact ratio: KaTeX's struts and spacing do not all scale with the font size.
    if (d.scrollWidth - d.clientWidth > 1) d.style.setProperty('--kc-fit', Math.max(MIN_FIT, (d.clientWidth / d.scrollWidth) * 0.98).toFixed(3));
  }
}

export function TexHtml({ html, as: Tag = 'span', className = '', id }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.querySelector('.katex-display')) return undefined;
    fitDisplays(el);
    if (typeof ResizeObserver === 'undefined') return undefined;
    // Refit when the line's width changes (a turned phone, a resized window) and when a formula's own glyph runs (KaTeX's
    // inline-block .base boxes) change size: KaTeX's fonts start loading only once a formula is drawn, so the first measure
    // can be in the fallback face. The fit settles in one more pass (the same ratio is set again), so this does not loop.
    const ro = new ResizeObserver(() => fitDisplays(el));
    ro.observe(el.closest('.kc-ncert') || el.parentElement || el);
    for (const base of el.querySelectorAll('.katex-display .base')) ro.observe(base);
    return () => ro.disconnect();
  }, [html]);
  return <Tag ref={ref} className={`kc-tex ${className}`.trim()} id={id} dangerouslySetInnerHTML={{ __html: html }} />;
}
