"use client";

// Score by session, drawn as a line the student can scrub. The pointer (or a finger, or the arrow
// keys) snaps to a real session, and the chip says what that session scored and how it compares
// with the one before. Nothing between sessions is interpolated or implied: dots are sessions.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from '@/lib/motion';

const PAD = { l: 38, r: 24, t: 14, b: 26 }; // r leaves the last point and its date clear of the edge
const HEIGHT = 200;

const dayLabel = (at) => {
  const date = new Date(at);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
};

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

  const onPointer = (event) => {
    if (event.pointerType === 'mouse' && event.type === 'pointerdown' && event.button !== 0) return;
    const i = nearest(event.clientX);
    if (i !== null) setActive(i);
  };
  const onKey = (event) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (event.key === 'Home') { event.preventDefault(); setActive(0); return; }
    if (event.key === 'End') { event.preventDefault(); setActive(count - 1); return; }
    if (!step) return;
    event.preventDefault();
    setPicked(Math.max(0, Math.min(count - 1, active + step)));
  };

  const path = geometry.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const label = trendLabel(timeline, active);
  const [ax, ay] = geometry.points[active] || [0, 0];
  const diff = active > 0 ? timeline[active].score - timeline[active - 1].score : null;
  const ticks = [0, 50, 100];
  const every = Math.max(1, Math.ceil(count / 6));

  return (
    <div className="tr" ref={seenRef}>
      <div
        ref={wrap}
        className="tr__plot"
        style={{ height: HEIGHT }}
        role="slider"
        tabIndex={0}
        aria-label="Score by session. Use the arrow keys to move between sessions."
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={active + 1}
        aria-valuetext={label}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onKeyDown={onKey}
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
      </div>
      <p className="tr__chip" data-tone={diff === null ? 'flat' : diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'} key={active}>
        <b>{label}</b>
        {timeline[active]?.scoring === 'device' ? <i>Scored in your browser, before server scoring.</i> : null}
      </p>
    </div>
  );
}
