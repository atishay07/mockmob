'use client';

// Doodle: the pen and the highlighter on MockMob's paper (18 Nov 2026, owner LK308).
//
//   <Doodle mark="circle">on time.</Doodle>
//   <Doodle mark="highlight" tone="volt">unlimited mocks.</Doodle>
//   <Doodle mark="underline" tone="pen" when={answered}>wrong</Doodle>
//
// The words stay ordinary text (read, selected and searched as before); the mark is an SVG drawn for their exact box
// (doodlePaths.mjs) and made the way a hand makes it: a stroke runs from its start to its end, a highlighter swipes left
// to right. A mark is drawn ONCE, when its words have come up to where a reader reads them (wholly in view and clear of
// the lowest quarter of the screen), or when `when` turns true. It never loops and never moves again.
//
// Marks: circle, underline, double, squiggle, strike, tick, cross (pen strokes) and highlight (a filled swipe behind the
// words). Tones: ink (the page's ink), brand (the brand-word colour), pen (the red of a marked mistake: only where the
// words are about a mistake), volt (the highlighter).
// Reduced motion: the mark is simply there. Without script the words stand unmarked (the mark is decoration).
//
// 19 Nov 2026 (owner LK317: the pencils and markers of the evening before looked "highly unprofessional"; the marks
// themselves stay, "a bit slower, more refined and more accurate with when they are showing up in the scroll"; and LK326:
// the page must not stutter):
//  - No drawing tool, no flick, no flourish: a mark is the stroke alone. Do not add one without his word.
//  - Each mark takes a hand's time for what it is (DRAW_MS: a loop about a second, a line about two thirds of one), on an
//    ease that starts like a hand and settles.
//  - It starts a beat after its words are in reading position, so a heading that is still arriving is never marked early.
//  - It costs the page nothing while the reader scrolls: the words' size comes from one shared ResizeObserver and the
//    moment from one shared IntersectionObserver (both report after the browser's own layout), so no mark ever asks the
//    browser to lay the page out again; a stroke's length is normalised (pathLength), so nothing measures it.
import { useEffect, useRef, useState } from 'react';
import { DRAW_MS, doodlePath, seedOf } from './doodlePaths.mjs';
import './doodle.css';

/** A beat between the words reaching reading position and the pen touching down, ms. */
export const TOUCH_DOWN_MS = 180;

// ---- where the reader reads: one observer for every mark on the page. A mark is told once and then forgotten.
let seen = null;
const waiting = new WeakMap();
function watchReading(node, fn) {
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
      // Wholly in view (0.9 of the box, for a phrase that kisses the edge) and above the lowest quarter of the window.
    }, { rootMargin: '0px 0px -25% 0px', threshold: 0.9 });
  }
  waiting.set(node, fn);
  seen.observe(node);
  return () => { waiting.delete(node); seen.unobserve(node); };
}

// ---- the words' own box: one observer for every mark. Its reports arrive after layout, so reading them is free.
let sized = null;
const sizeOf = new WeakMap();
function watchSize(node, fn) {
  if (typeof ResizeObserver === 'undefined') {
    const box = node.getBoundingClientRect();
    fn(box.width, box.height);
    return () => {};
  }
  if (!sized) {
    sized = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.borderBoxSize?.[0];
        sizeOf.get(entry.target)?.(box ? box.inlineSize : entry.contentRect.width, box ? box.blockSize : entry.contentRect.height);
      }
    });
  }
  sizeOf.set(node, fn);
  sized.observe(node);
  return () => { sizeOf.delete(node); sized.unobserve(node); };
}

const half = (n) => Math.round(n * 2) / 2;

export default function Doodle({ mark = 'underline', tone = 'ink', when, inkKey, delay = 0, as: Tag = 'span', className = '', style, children, ...rest }) {
  const hostRef = useRef(null);
  const boxRef = useRef(null);       // { width, height, fontSize }: the words' box, as last reported
  const [reached, setReached] = useState(false);
  const [shape, setShape] = useState(null);
  const controlled = typeof when === 'boolean';
  const wanted = controlled ? when : reached;
  const wantedRef = useRef(wanted);
  const text = typeof children === 'string' ? children : '';

  // The mark's geometry from the box in hand; nothing here reads layout.
  const buildRef = useRef(null);
  buildRef.current = () => {
    const box = boxRef.current;
    const host = hostRef.current;
    if (!box || !host || !(box.width > 0) || !(box.height > 0)) return;
    const seed = seedOf(`${mark}:${text || host.textContent}`);
    setShape((was) => (was && was.width === box.width && was.height === box.height && was.seed === seed && was.fontSize === box.fontSize
      ? was
      : { ...box, seed, ...doodlePath(mark, { width: box.width, height: box.height, fontSize: box.fontSize, seed }) }));
  };

  // The words' box, kept as it changes (a font arriving, a narrower window). The mark is only made once it is wanted, so a
  // page of marks nobody has reached yet costs nothing.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    return watchSize(host, (width, height) => {
      // Asked for inside the observer's own report: styles are settled, so this read recalculates nothing.
      const fontSize = parseFloat(getComputedStyle(host).fontSize) || 16;
      boxRef.current = { width: half(width), height: half(height), fontSize };
      if (wantedRef.current) buildRef.current();
    });
  }, []);

  // Made when wanted (and again if the words or the kind of mark change).
  useEffect(() => {
    wantedRef.current = wanted;
    if (wanted) buildRef.current();
  }, [wanted, mark, text]);

  // An uncontrolled mark is wanted once the reader reaches the words, a beat later.
  useEffect(() => {
    if (controlled) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    let timer = 0;
    const off = watchReading(host, () => { timer = window.setTimeout(() => setReached(true), TOUCH_DOWN_MS + delay); });
    return () => { off(); window.clearTimeout(timer); };
  }, [controlled, delay]);

  // Let fast slider and keyboard changes settle before re-inking the new figure once.
  const [inked, setInked] = useState(inkKey);
  useEffect(() => {
    if (inkKey == null || inked === inkKey) return undefined;
    const timer = window.setTimeout(() => setInked(inkKey), 180);
    return () => window.clearTimeout(timer);
  }, [inkKey, inked]);

  // A mark is drawn only once its undrawn state has been on screen for a frame: a mark told to draw as it mounts (a tick
  // on the answer just chosen) still runs from its start instead of appearing whole.
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    if (!shape) return undefined;
    let b = 0;
    const a = window.requestAnimationFrame(() => { b = window.requestAnimationFrame(() => setPrimed(true)); });
    return () => { window.cancelAnimationFrame(a); window.cancelAnimationFrame(b); };
  }, [shape]);
  const on = wanted && primed;
  const strokes = shape?.strokes || [];
  const ms = DRAW_MS[mark] || 600;
  // Several strokes share the mark's time, one after the other.
  const each = strokes.length ? ms / strokes.length : ms;
  const vars = { '--dd-ms': `${ms}ms`, '--dd-pen': shape ? `${shape.pen}px` : undefined, '--dd-delay': controlled ? `${delay}ms` : '0ms' };

  return (
    <Tag ref={hostRef} className={`dd dd--${mark} ${className}`.trim()} data-tone={tone} data-drawn={on ? 'true' : 'false'} data-reink={inkKey != null || undefined} style={{ ...vars, ...style }} {...rest}>
      {children}
      {/* Night: a highlighter's words turn to the ink that reads on volt exactly where the swipe has reached, not all at once
          (a copy of the words, clipped with the swipe). The copy is generated content, not a second text node, so the
          heading's own text is said once to a search engine, a copy and a reader. */}
      {shape?.fill && text && inkKey == null ? <span className="dd__over" aria-hidden="true" data-text={text} /> : null}
      {shape ? (
        <svg className="dd__ink" aria-hidden="true" focusable="false" width={shape.width} height={shape.height} viewBox={`0 0 ${shape.width} ${shape.height}`}>
          {shape.fill ? <path key={inked} className="dd__fill" d={shape.fill} /> : null}
          {/* One stroke of the pen: its length is normalised to 1, so its dash draws it from its start to its end and
              nothing has to measure it. */}
          {strokes.map((d, i) => <path key={i} pathLength="1" className="dd__stroke" d={d} style={{ '--dd-stroke-ms': `${Math.round(each)}ms`, '--dd-stroke-delay': `${Math.round(i * each)}ms` }} />)}
        </svg>
      ) : null}
    </Tag>
  );
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
