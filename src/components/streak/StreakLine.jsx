"use client";
// The streak's line (19 Nov 2026, owner: "streaks are only implemented if they are useful or integrated extremely well"): the
// wall-calendar rule (mark every day, do not break the line) drawn in this product's own hand. A row of day cells with ONE volt
// highlighter band behind every run of kept days, its outline the same hand-made swipe the home page headlines use
// (doodlePaths 'highlight', seeded by the run's first day so it never changes shape between visits). A rest pass keeps the band
// going, lighter and striped, with its moon; an exam pause day keeps the line as a thin dashed ink rule; a day without practice
// is a gap; today, not yet counted, wears a ring and the band's tip reaches into it by today's answers.
// The earning moment (`fresh`): today's piece of the band swipes in from the left once, 520 ms ease-out. Otherwise the line is
// simply there. Reduced motion: no swipe. The row is a list, each day with its own sentence; the drawing is aria-hidden.
// Sizes come from one ResizeObserver on the row (never per scroll frame), so the band always fits the cells it sits under.
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Moon } from 'lucide-react';
import { doodlePath, seedOf } from '@/components/doodle/doodlePaths.mjs';
import { lineRuns, tipShare } from '@/lib/streak/streakLine.mjs';
import './streak-line.css';

const same = (a, b) => a && b && a.w === b.w && a.h === b.h && a.cells.length === b.cells.length
  && a.cells.every((c, i) => c.x === b.cells[i].x && c.y === b.cells[i].y && c.w === b.cells[i].w && c.h === b.cells[i].h && c.nameX === b.cells[i].nameX && c.nameW === b.cells[i].nameW);

function nameOf(d, names) {
  if (names === 'date') return d.num;
  if (names === 'initial') return d.initial ?? (d.today ? 'Today' : d.name.slice(0, 1));
  return d.name;
}

/**
 * days: marks from streakWeek / streakDays / streakMonth ({ day, look, name, label, today, initial?, num? }).
 * progress: today's { answered, needed } while today has not counted (todayProgress), for the band's tip.
 * names: 'short' (Mon, Today), 'initial' (M, Today) or 'date' (19). cols: cells per row (a month wraps by 7); lead: blank cells first.
 */
export default function StreakLine({ days, progress = null, fresh = false, names = 'short', cols = null, lead = 0, label = 'Your last 7 days', size = 'md', className = '' }) {
  const rowRef = useRef(null);
  const [geo, setGeo] = useState(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sig = `${lead}:${names}:${(days || []).map((d) => `${d.day}${d.look}`).join('|')}`;
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const cells = [...row.querySelectorAll(':scope > li[data-day]')].map((li) => {
        const name = li.querySelector('.stk-band__name');
        return { x: li.offsetLeft, y: li.offsetTop, w: li.offsetWidth, h: li.offsetHeight, nameX: name ? li.offsetLeft + name.offsetLeft : 0, nameW: name ? name.offsetWidth : 0 };
      });
      const next = { w: row.offsetWidth, h: row.offsetHeight, cells };
      setGeo((prev) => (same(prev, next) ? prev : next));
    };
    // The observer's first call measures the row as it lands; later calls only when the row itself changes size.
    const ro = new ResizeObserver(() => { if (!frame) frame = window.requestAnimationFrame(measure); });
    ro.observe(row);
    return () => { ro.disconnect(); if (frame) window.cancelAnimationFrame(frame); };
  }, [sig]);

  const todayLook = days?.find((d) => d.today)?.look;
  const tip = todayLook === 'today' ? tipShare(progress) : 0;
  const drawn = useMemo(() => {
    if (!geo || geo.cells.length !== (days || []).length) return null;
    const runs = lineRuns(geo.cells.map((g, i) => ({ ...g, key: days[i].day, look: days[i].look, today: days[i].today })), { tip });
    return {
      ...runs,
      bands: runs.bands.map((b) => ({ ...b, d: doodlePath('highlight', { width: b.w, height: b.h, fontSize: b.h * 0.72, seed: seedOf(`streak:${b.key}`) }).fill })),
    };
  }, [geo, days, tip]);

  if (!days?.length) return null;
  return (
    <div className={`stk-band ${className}`.trim()} data-size={size} data-names={names} style={{ '--stk-cols': cols || days.length + lead }}>
      {drawn ? (
        <svg className="stk-band__ink" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true" focusable="false">
          <defs>
            <pattern id={`${uid}-rest`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" className="stk-band__rest-wash" />
              <rect width="2.4" height="7" className="stk-band__rest-stripe" />
            </pattern>
            {drawn.bands.map((b, i) => (
              <clipPath id={`${uid}-b${i}`} key={b.key}><path d={b.d} transform={`translate(${b.x} ${b.y})`} /></clipPath>
            ))}
          </defs>
          {drawn.bands.map((b, i) => (
            <g key={b.key} clipPath={`url(#${uid}-b${i})`}>
              {b.fills.map((f) => (
                <rect key={`${f.x}`} className="stk-band__fill" data-kind={f.kind} data-swipe={fresh && f.today && f.kind === 'solid' ? 'true' : undefined}
                  x={b.x + f.x} y={b.y} width={Math.max(0, f.w)} height={b.h} fill={f.kind === 'rest' ? `url(#${uid}-rest)` : undefined} />
              ))}
            </g>
          ))}
          {drawn.rules.map((r) => <line key={`${r.x1}-${r.y}`} className="stk-band__rule" x1={r.x1} x2={r.x2} y1={r.y} y2={r.y} />)}
        </svg>
      ) : null}
      <ol ref={rowRef} className="stk-band__row" aria-label={label}>
        {Array.from({ length: lead }, (_, i) => <li key={`lead${i}`} className="stk-band__cell" data-look="blank" aria-hidden="true" />)}
        {days.map((d) => (
          <li key={d.day} data-day={d.day} className="stk-band__cell" data-look={d.look} data-today={d.today || undefined} data-reach={d.today && tip > 0 ? 'true' : undefined}>
            <span className="stk-band__name" aria-hidden="true">{d.look === 'rested' ? <Moon className="stk-band__moon" size={11} strokeWidth={2.6} /> : null}{nameOf(d, names)}</span>
            <span className="sr-only">{d.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
