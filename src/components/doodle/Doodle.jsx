'use client';

// Doodle: the pen and the highlighter on MockMob's paper (18 Nov 2026, owner LK308).
//
//   <Doodle mark="circle">on time.</Doodle>
//   <Doodle mark="highlight" tone="volt">unlimited mocks.</Doodle>
//   <Doodle mark="underline" tone="pen" when={answered}>wrong</Doodle>
//
// The words stay ordinary text (read, selected and searched as before); the mark is an SVG drawn for their exact box
// (doodlePaths.mjs) and made the way a hand makes it: a stroke runs from its start to its end, a highlighter swipes left
// to right. A mark is drawn ONCE, when its words have come up into the reader's view (well clear of the screen's foot,
// so a reader scrolling sees the pen move), or when `when` turns true. It never loops and never moves again.
//
// Marks: circle, underline, double, squiggle, strike, spark, tick, cross (pen strokes) and highlight (a filled swipe
// behind the words). Tones: ink (the page's ink), brand (the brand-word colour), pen (the red of a marked mistake: only
// where the words are about a mistake), volt (the highlighter).
// Reduced motion: the mark is simply there. Without script the words stand unmarked (the mark is decoration).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DRAW_MS, doodlePath, seedOf } from './doodlePaths.mjs';
import './doodle.css';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// One observer for every doodle on the page: a mark is drawn once its words are fully in view and above the lowest
// fifth of the window. Each entry is told once and then forgotten.
let seen = null;
const waiting = new Map();
function watch(node, fn) {
  if (typeof IntersectionObserver === 'undefined') { fn(); return () => {}; }
  if (!seen) {
    seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const go = waiting.get(entry.target);
        waiting.delete(entry.target);
        seen.unobserve(entry.target);
        go?.();
      }
    }, { rootMargin: '0px 0px -20% 0px', threshold: 0.9 });
  }
  waiting.set(node, fn);
  seen.observe(node);
  return () => { waiting.delete(node); seen.unobserve(node); };
}

export default function Doodle({ mark = 'underline', tone = 'ink', when, delay = 0, as: Tag = 'span', className = '', children, ...rest }) {
  const hostRef = useRef(null);
  const [shape, setShape] = useState(null);
  const [drawn, setDrawn] = useState(false);
  const controlled = typeof when === 'boolean';
  const text = typeof children === 'string' ? children : '';

  // The mark is made for the words' own box, again whenever that box changes (a font arriving, a narrower window).
  useIsoLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const seed = seedOf(`${mark}:${text || host.textContent}`);
    const measure = () => {
      const width = host.offsetWidth;
      const height = host.offsetHeight;
      if (!width || !height) return;
      const fontSize = parseFloat(getComputedStyle(host).fontSize) || 16;
      setShape((was) => (was && was.width === width && was.height === height ? was : { width, height, ...doodlePath(mark, { width, height, fontSize, seed }) }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [mark, text]);

  // Drawn when the reader reaches the words (or when told).
  useEffect(() => {
    if (controlled) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    let timer = 0;
    const off = watch(host, () => { timer = window.setTimeout(() => setDrawn(true), delay); });
    return () => { off(); window.clearTimeout(timer); };
  }, [controlled, delay]);

  // A mark is drawn only once its undrawn state has been on screen for a frame: a mark told to draw as it mounts (a tick
  // on the answer just chosen) still runs from its start instead of appearing whole.
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    if (!shape) return undefined;
    let b = 0;
    const a = window.requestAnimationFrame(() => { b = window.requestAnimationFrame(() => setPrimed(true)); });
    return () => { window.cancelAnimationFrame(a); window.cancelAnimationFrame(b); };
  }, [shape]);
  const on = (controlled ? when : drawn) && primed;
  const strokes = shape?.strokes || [];
  const ms = DRAW_MS[mark] || 400;
  // Several strokes share the mark's time, one after the other.
  const each = strokes.length ? ms / strokes.length : ms;

  return (
    <Tag ref={hostRef} className={`dd dd--${mark} ${className}`.trim()} data-tone={tone} data-drawn={on ? 'true' : 'false'} {...rest}>
      {children}
      {shape ? (
        <svg className="dd__ink" aria-hidden="true" focusable="false" width={shape.width} height={shape.height} viewBox={`0 0 ${shape.width} ${shape.height}`} style={{ '--dd-ms': `${ms}ms`, '--dd-pen': `${shape.pen}px`, '--dd-delay': controlled ? `${delay}ms` : '0ms' }}>
          {shape.fill ? <path className="dd__fill" d={shape.fill} /> : null}
          {strokes.map((d, i) => <Stroke key={i} d={d} ms={each} delay={i * each} />)}
        </svg>
      ) : null}
    </Tag>
  );
}

// One stroke of the pen: its own length is its dash, so it draws from its start to its end.
function Stroke({ d, ms, delay }) {
  const ref = useRef(null);
  const [length, setLength] = useState(0);
  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    try { setLength(Math.ceil(node.getTotalLength()) + 1); } catch { setLength(0); }
  }, [d]);
  return <path ref={ref} className="dd__stroke" d={d} data-ready={length ? 'true' : 'false'} style={{ '--dd-len': length, '--dd-stroke-ms': `${Math.round(ms)}ms`, '--dd-stroke-delay': `${Math.round(delay)}ms` }} />;
}

/**
 * A sentence with some of its words marked:
 *   <Marked text="Every mark, traced back to a moment." marks={[['a moment.', { mark: 'squiggle' }]]} />
 * The sentence stays one string in the page's copy; each phrase is found once, in order, and wrapped. A phrase that is
 * not in the sentence is skipped (the words win over the marks).
 */
export function Marked({ text, marks = [] }) {
  const out = [];
  let rest = String(text);
  let key = 0;
  for (const [phrase, props] of marks) {
    const at = rest.indexOf(phrase);
    if (at < 0) continue;
    if (at > 0) out.push(rest.slice(0, at));
    out.push(<Doodle key={key} {...props}>{phrase}</Doodle>);
    key += 1;
    rest = rest.slice(at + phrase.length);
  }
  if (rest) out.push(rest);
  return out;
}
