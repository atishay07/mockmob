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
//
// NOT IN USE (owner, 18 Nov 2026 about 10 pm, LK317: the pencils and markers looked "highly unprofessional ... revert back"):
// no page passes `pen` or `accent` any more; the marks are plain again. Do not turn these on without his word.
// More animated (18 Nov 2026, owner LK314: "Doodles look good. Some can be more animated"), for a page's few lead marks:
//   pen     a small pencil (a red pen on a mistake's mark, a marker on a highlight) rides the stroke's head while it is
//           made, at a hand's pace, then lifts away. With followScroll the reader's own scroll moves it.
//   accent  "spark": three short flicks off the words' corner once the mark has landed.
// Still drawn once, never looping; reduced motion shows the finished mark and no pen.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { subscribe } from '@/components/landing/scrollBus.mjs';
import { DRAW_MS, PEN_PACE, SPARK_MS, doodlePath, seedOf } from './doodlePaths.mjs';
import './doodle.css';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// One observer for every doodle on the page: a mark is drawn once its words are fully in view and above the lowest
// fifth of the window. Each entry is told once and then forgotten.
let seen = null;
let screenHeight = 0;
const waiting = new Map();
function readingObserver() {
  const height = window.innerHeight;
  if (seen && screenHeight === height) return;
  screenHeight = height;
  seen?.disconnect();
  seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.9) continue;
      const go = waiting.get(entry.target);
      waiting.delete(entry.target);
      seen.unobserve(entry.target);
      go?.();
    }
    if (!waiting.size) window.removeEventListener('resize', readingObserver);
  }, { rootMargin: `0px 0px -${Math.round(height * 0.25)}px 0px`, threshold: 0.9 });
  for (const node of waiting.keys()) seen.observe(node);
}

function watch(node, fn) {
  if (typeof IntersectionObserver === 'undefined') { fn(); return () => {}; }
  readingObserver();
  window.addEventListener('resize', readingObserver);
  waiting.set(node, fn);
  seen.observe(node);
  return () => {
    waiting.delete(node);
    seen.unobserve(node);
    if (!waiting.size) window.removeEventListener('resize', readingObserver);
  };
}

export default function Doodle({ mark = 'underline', tone = 'ink', when, followScroll = false, inkKey, pen = false, accent, delay = 0, as: Tag = 'span', className = '', style, children, ...rest }) {
  const hostRef = useRef(null);
  const [shape, setShape] = useState(null);
  const [drawn, setDrawn] = useState(false);
  const controlled = typeof when === 'boolean';
  const text = typeof children === 'string' ? children : '';

  // The mark is made for the words' own box, again whenever that box changes (a font arriving, a narrower window).
  useIsoLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !(drawn || when || followScroll)) return undefined;
    const seed = seedOf(`${mark}:${text || host.textContent}`);
    const measure = () => {
      const width = host.offsetWidth;
      const height = host.offsetHeight;
      if (!width || !height) return;
      const fontSize = parseFloat(getComputedStyle(host).fontSize) || 16;
      setShape((was) => (was && was.width === width && was.height === height && was.seed === seed && was.fontSize === fontSize ? was : {
        width, height, seed, fontSize, ...doodlePath(mark, { width, height, fontSize, seed }),
        sparks: accent === 'spark' ? doodlePath('spark', { width, height, fontSize, seed: seed + 7 }).strokes : [],
      }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [mark, text, accent, drawn, when, followScroll]);

  // Drawn when the reader reaches the words (or when told).
  useEffect(() => {
    if (controlled || followScroll) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    let timer = 0;
    const off = watch(host, () => { timer = window.setTimeout(() => setDrawn(true), delay); });
    return () => { off(); window.clearTimeout(timer); };
  }, [controlled, followScroll, delay]);

  // The shared page scroll read lets a heading's pen advance with the reader, then retire when the line is complete.
  useEffect(() => {
    if (!followScroll || !hostRef.current) return undefined;
    const host = hostRef.current;
    let off = null;
    let observer = null;
    const paint = ({ vh = window.innerHeight } = {}) => {
      const progress = Math.max(0, Math.min(1, (vh * 0.86 - host.getBoundingClientRect().top) / (vh * 0.30)));
      host.style.setProperty('--dd-scroll', progress.toFixed(3));
      if (progress === 1) {
        off?.();
        observer?.disconnect();
      }
      return progress;
    };
    const listen = () => { if (!off && paint() < 1) off = subscribe(paint); };
    if (typeof IntersectionObserver === 'undefined') {
      listen();
    } else {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) listen();
        else { off?.(); off = null; }
      });
      observer.observe(host);
    }
    return () => { off?.(); observer?.disconnect(); host.style.removeProperty('--dd-scroll'); };
  }, [followScroll]);

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
  const on = (controlled ? when : drawn) && primed;
  const strokes = shape?.strokes || [];
  // A mark made with the pen in view takes a hand's time, not a flash.
  const ms = pen ? Math.round((DRAW_MS[mark] || 400) * PEN_PACE) : (controlled ? 740 : 1000);
  // Several strokes share the mark's time, one after the other; the flicks of an accent come after the mark has landed.
  const each = strokes.length ? ms / strokes.length : ms;
  const sparks = shape?.sparks || [];
  const vars = { '--dd-ms': `${ms}ms`, '--dd-pen': shape ? `${shape.pen}px` : undefined, '--dd-delay': controlled ? `${delay}ms` : '0ms' };
  const penScale = shape ? Math.max(0.62, Math.min(1.1, shape.fontSize / 36)) : 1;

  return (
    <Tag ref={hostRef} className={`dd dd--${mark} ${className}`.trim()} data-tone={tone} data-drawn={on ? 'true' : 'false'} data-scroll-ink={followScroll || undefined} data-reink={inkKey != null || undefined} data-pen={pen || undefined} style={{ ...vars, ...style }} {...rest}>
      {children}
      {/* Night: a highlighter's words turn to the ink that reads on volt exactly where the swipe has reached, not all at once
          (a copy of the words, clipped with the swipe). The copy is generated content, not a second text node, so the
          heading's own text is said once to a search engine, a copy and a reader. */}
      {shape?.fill && text && inkKey == null ? <span className="dd__over" aria-hidden="true" data-text={text} /> : null}
      {shape ? (
        <svg className="dd__ink" aria-hidden="true" focusable="false" width={shape.width} height={shape.height} viewBox={`0 0 ${shape.width} ${shape.height}`}>
          {shape.fill ? <path key={inked} className="dd__fill" d={shape.fill} /> : null}
          {strokes.map((d, i) => <Stroke key={i} d={d} ms={each} delay={i * each} />)}
          {sparks.map((d, i) => <Stroke key={`s${i}`} d={d} ms={SPARK_MS} delay={ms + 60 + i * SPARK_MS * 0.6} spark />)}
        </svg>
      ) : null}
      {pen && shape ? (shape.fill
        ? <span className="dd__nib dd__nib--marker" aria-hidden="true"><Marker scale={penScale} /></span>
        : strokes.map((d, i) => (
          <span key={i} className="dd__nib" aria-hidden="true" style={{ offsetPath: `path("${d}")`, '--dd-stroke-ms': `${Math.round(each)}ms`, '--dd-stroke-delay': `${Math.round(i * each)}ms` }}>
            <Pencil scale={penScale} red={tone === 'pen' || tone === 'pen-dark'} />
          </span>
        ))) : null}
    </Tag>
  );
}

// One stroke of the pen: its own length is its dash, so it draws from its start to its end.
function Stroke({ d, ms, delay, spark = false }) {
  return <path pathLength="1" className={spark ? 'dd__stroke dd__stroke--spark' : 'dd__stroke'} d={d} data-ready="true" style={{ '--dd-len': 1, '--dd-stroke-ms': `${Math.round(ms)}ms`, '--dd-stroke-delay': `${Math.round(delay)}ms` }} />;
}

// The pencil that makes a mark: drawn with its point at the stroke's head, held the way a right hand holds it. Its lead is
// the mark's own ink; a mistake's mark is made with a red pen.
function Pencil({ scale, red }) {
  return (
    <svg className="dd__tool" width="1" height="1" focusable="false">
      <g transform={`rotate(-52) scale(${scale.toFixed(2)})`}>
        <path className="dd__tool-lead" d="M0 0L6 -2.6V2.6Z" />
        <path className="dd__tool-wood" d="M6 -2.6L13 -5V5L6 2.6Z" />
        <rect className={red ? 'dd__tool-body dd__tool-body--red' : 'dd__tool-body'} x="13" y="-5" width="22" height="10" />
        <path className="dd__tool-line" d="M13 -1.7H35M13 1.7H35" />
        <rect className="dd__tool-band" x="35" y="-5" width="4" height="10" />
        <rect className={red ? 'dd__tool-cap dd__tool-cap--red' : 'dd__tool-cap'} x="39" y="-5" width="6" height="10" rx="2.6" />
      </g>
    </svg>
  );
}

// The highlighter: a chisel tip in the swipe's own colour.
function Marker({ scale }) {
  return (
    <svg className="dd__tool" width="1" height="1" focusable="false">
      <g transform={`rotate(-62) scale(${scale.toFixed(2)})`}>
        <path className="dd__tool-tip" d="M0 -4.5L7 -6V6L0 2.5Z" />
        <path className="dd__tool-neck" d="M7 -6L12 -8V8L7 6Z" />
        <rect className="dd__tool-barrel" x="12" y="-8" width="26" height="16" rx="3" />
        <rect className="dd__tool-tip" x="17" y="-8" width="5" height="16" />
      </g>
    </svg>
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
