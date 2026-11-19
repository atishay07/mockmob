"use client";

// Score by session, drawn as a line the student can scrub. The pointer (or a finger, or the arrow
// keys) snaps to a real session, and the chip says what that session scored and how it compares
// with the one before. Nothing between sessions is interpolated or implied: dots are sessions.
// Lane insight (18 Nov 2026): ruled at the score's own round values (every 25), and each session's dot is a key of its own
// (one tab stop for the chart; the arrow keys, Home and End move between dots), so a figure can be reached by focus as well
// as by a tap or the pointer. The pointer and a finger still scrub the whole plot.
// Wide lane (owner, 19 Nov 2026: "the insight platform thing can be made a bit more interactive"): the session under the
// pointer or the focus carries one small label at its dot (its score and its day), every dot is its own tab stop in order,
// and when the mouse leaves the plot (or the focus leaves it) the latest session is shown again, as it is at rest. A finger
// keeps today's behaviour: the session it last touched stays shown.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from '@/lib/motion';

const PAD = { l: 38, r: 24, t: 14, b: 26 }; // r leaves the last point and its date clear of the edge
const HEIGHT = 200;
/** The horizontal rules: the score's round values, 0 to 100 in steps of 25. */
export const TREND_TICKS = Object.freeze([0, 25, 50, 75, 100]);

const dayLabel = (at) => {
  const date = new Date(at);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
};

/** The small label at a dot: its score and its day ("44%", "17 Nov"); a session with no day says its place. */
export function trendTip(timeline, index) {
  const row = timeline[index];
  if (!row) return null;
  return { score: `${row.score}%`, when: dayLabel(row.at) || `Session ${index + 1}` };
}

/** The sentence for one session. Exported so the wording is tested in one place. */
export function trendLabel(timeline, index) {
  const row = timeline[index];
  if (!row) return '';
  const when = dayLabel(row.at);
  const head = `${row.score}%${when ? ` on ${when}` : ` in session ${index + 1}`}`;
  const tail = index === 0 ? 'your first session here' : (() => {
    const diff = row.score - timeline[index - 1].score;
    return diff === 0 ? 'the same as the session before' : `${Math.abs(diff)} ${diff > 0 ? 'up' : 'down'} on the session before`;
  })();
  return `${head}, ${tail}`;
}

export default function TrendScrub({ timeline, colors }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(300);
  const [picked, setPicked] = useState(null); // null means the latest session
  const [seenRef, seen] = useInView({ threshold: 0.3 });
  const count = timeline.length;
  const active = Math.max(0, Math.min(count - 1, picked ?? count - 1));
  const setActive = setPicked;

  useEffect(() => {
    const node = wrap.current;
    if (!node) return undefined;
    const read = () => setWidth(Math.max(200, Math.round(node.clientWidth)));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const innerW = width - PAD.l - PAD.r;
    const innerH = HEIGHT - PAD.t - PAD.b;
    const x = (i) => PAD.l + (count === 1 ? innerW / 2 : (innerW * i) / (count - 1));
    const y = (score) => PAD.t + innerH * (1 - Math.max(0, Math.min(100, score)) / 100);
    const points = timeline.map((row, i) => [x(i), y(row.score)]);
    return { x, y, points, innerW, innerH };
  }, [timeline, width, count]);

  const nearest = useCallback((clientX) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return null;
    const px = clientX - box.left;
    let best = 0;
    let bestDist = Infinity;
    geometry.points.forEach(([x], i) => { const d = Math.abs(x - px); if (d < bestDist) { bestDist = d; best = i; } });
    return best;
  }, [geometry]);

  // The mouse leaving the plot, or the focus leaving its dots, shows the latest session again (its rest state).
  const onLeave = (event) => { if (event.pointerType === 'mouse') setPicked(null); };
  const onBlur = (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPicked(null); };
  const onPointer = (event) => {
    if (event.pointerType === 'mouse' && event.type === 'pointerdown' && event.button !== 0) return;
    const i = nearest(event.clientX);
    if (i !== null) setActive(i);
  };
  // The arrow keys move between the dots and take the focus with them, so the focused dot is always the session shown.
  const go = (i) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setPicked(next);
    wrap.current?.querySelectorAll('.tr__pt')[next]?.focus();
  };
  const onKey = (event) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (event.key === 'Home') { event.preventDefault(); go(0); return; }
    if (event.key === 'End') { event.preventDefault(); go(count - 1); return; }
    if (!step) return;
    event.preventDefault();
    go(active + step);
  };

  const path = geometry.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const label = trendLabel(timeline, active);
  const tip = seen ? trendTip(timeline, active) : null;
  const [ax, ay] = geometry.points[active] || [0, 0];
  const diff = active > 0 ? timeline[active].score - timeline[active - 1].score : null;
  const ticks = TREND_TICKS;
  const every = Math.max(1, Math.ceil(count / 6));

  return (
    <div className="tr" ref={seenRef}>
      <div
        ref={wrap}
        className="tr__plot"
        style={{ height: HEIGHT }}
        role="group"
        aria-label="Score by session. Use the arrow keys to move between sessions."
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onKeyDown={onKey}
        onPointerLeave={onLeave}
        onBlur={onBlur}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={geometry.y(t)} y2={geometry.y(t)} stroke={colors.line} strokeWidth="1" />
              <text x={PAD.l - 8} y={geometry.y(t) + 4} textAnchor="end" fontSize="11" fill={colors.ink}>{t}%</text>
            </g>
          ))}
          {timeline.map((row, i) => (i % every === 0 || i === count - 1) ? (
            <text key={i} x={geometry.x(i)} y={HEIGHT - 6} textAnchor="middle" fontSize="11" fill={colors.ink}>{row.test}</text>
          ) : null)}
          <path d={path} pathLength="1" className={seen ? 'mk-draw' : undefined} style={{ '--mk-draw-ms': '900ms', opacity: seen ? 1 : 0 }} fill="none" stroke={colors.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <line className="tr__rule" x1={ax} x2={ax} y1={PAD.t} y2={HEIGHT - PAD.b} stroke={colors.accent} strokeWidth="1" opacity="0.45" />
          {geometry.points.map(([x, y], i) => (
            <circle key={i} className="tr__dot" data-active={i === active} cx={x} cy={y} r={i === active ? 6 : 3.2} fill={i === active ? colors.accent : 'transparent'} stroke={colors.accent} strokeWidth="2" style={{ opacity: seen ? 1 : 0, transitionDelay: seen ? `${Math.min(900, 120 + i * 60)}ms` : '0ms' }} />
          ))}
          <circle className="tr__halo" key={`halo-${active}`} cx={ax} cy={ay} r="6" fill="none" stroke={colors.accent} strokeWidth="2" />
        </svg>
        {/* One key per session over its dot: focus or a tap shows that session's figure. Only the shown one is in the tab
            order; the pointer passes through to the plot's scrub. */}
        {geometry.points.map(([x, y], i) => (
          <button
            key={i}
            type="button"
            className="tr__pt"
            style={{ left: x, top: y }}
            tabIndex={0}
            aria-pressed={i === active}
            aria-label={trendLabel(timeline, i)}
            onFocus={() => setPicked(i)}
            onClick={() => setPicked(i)}
          />
        ))}
        {tip ? (
          <span className="tr__tip" aria-hidden="true" data-side={ax > width - 72 ? 'end' : ax < 72 ? 'start' : undefined} data-below={ay < PAD.t + 44 ? '' : undefined} style={{ left: ax, top: ay }}>
            <b>{tip.score}</b><span>{tip.when}</span>
          </span>
        ) : null}
      </div>
      <p className="tr__chip" data-tone={diff === null ? 'flat' : diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'} key={active}>
        <b>{label}</b>
        {timeline[active]?.scoring === 'device' ? <i>Scored in your browser, before server scoring.</i> : null}
      </p>
    </div>
  );
}
