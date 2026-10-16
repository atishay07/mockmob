"use client";
// The Mob's one shared ring (SOCIAL-SPEC 7): one segment per member, filled in join order as members sit. It only ever
// fills: nothing empties, nothing is ranked, and the unfilled seats carry no name (P6). Motion (motion-kit tokens):
// a sitter who is new since this device last looked inks once, 220 ms each with a 60 ms step on --mm-ease-out; a ring
// that has just completed settles once (1, 1.03, 1 over 420 ms). Reduced motion: the same fill, drawn at once.
import { useEffect, useState } from 'react';
import { initialOf, ringLine } from '@/lib/mob/model.mjs';

const GAP_DEG = 7;
const R = 50;
const C = 60;
const polar = (deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + R * Math.cos(a), C + R * Math.sin(a)];
};
function arc(start, end) {
  const [x1, y1] = polar(start);
  const [x2, y2] = polar(end);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const seenKey = (week) => `mockmob_mob_seen_${week}`;
function readSeen(week) {
  try { const v = Number(window.localStorage.getItem(seenKey(week))); return Number.isInteger(v) && v >= 0 ? v : 0; } catch { return null; }
}
function writeSeen(week, n) {
  try { window.localStorage.setItem(seenKey(week), String(n)); } catch { /* the ring inks again next time on this device */ }
}

/**
 * How many of the filled segments this device had already seen. Read once when the ring first renders (the ring only
 * renders on the client, after the Mob's data arrives), so a fresh segment never paints filled and then jumps back.
 */
function useSeen(week, sat) {
  const [first] = useState(() => (typeof window === 'undefined' ? sat : readSeen(week) ?? sat));
  useEffect(() => { if (week) writeSeen(week, sat); }, [week, sat]);
  return Math.min(first, sat);
}

export function MobRing({ size, sat, week, compact = false, members = [] }) {
  const n = Math.max(1, size || 1);
  const filled = Math.max(0, Math.min(n, sat || 0));
  const seen = useSeen(week, filled);
  const step = 360 / n;
  const gap = n === 1 ? 0 : GAP_DEG;
  const complete = n >= 2 && filled === n;
  const settle = complete && seen < n;
  const sitters = members.filter((m) => m.sat);
  return (
    <div className={`mob-ring${compact ? ' mob-ring--compact' : ''}`} data-settle={settle || undefined}>
      <svg viewBox="0 0 120 120" className="mob-ring__svg" role="img" aria-label={ringLine(filled, n)}>
        {Array.from({ length: n }, (_, i) => {
          const start = i * step + gap / 2;
          const end = (i + 1) * step - gap / 2;
          const d = n === 1 ? 'M 60 10 A 50 50 0 1 1 59.99 10' : arc(start, end);
          const on = i < filled;
          const fresh = on && i >= seen;
          return (
            <g key={i}>
              <path d={d} className="mob-ring__seat" pathLength="1" />
              {on ? <path d={d} className={`mob-ring__fill${fresh ? ' mob-ring__fill--ink' : ''}`} pathLength="1" style={fresh ? { '--mob-ink-delay': `${(i - seen) * 60}ms` } : undefined} /> : null}
            </g>
          );
        })}
      </svg>
      <div className="mob-ring__count" aria-hidden="true">
        <b>{filled} of {n}</b>
        <span>sat this week</span>
      </div>
      {!compact && sitters.length ? (
        <ul className="mob-ring__who" aria-label="Sat this week">
          {sitters.map((m) => (
            <li key={m.memberId}><span className="mob-disc" data-colour={m.colour} aria-hidden="true">{initialOf(m.name)}</span><span className="sr-only">{m.you ? `${m.name} (you)` : m.name}</span></li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default MobRing;
