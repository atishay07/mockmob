"use client";
import { useEffect, useState } from 'react';
import { useInView } from '@/lib/motion';

// What a lesson row's ring shows, from the real status: New (empty ring), In progress (an arc of the
// steps already done), Read (a full arc, recall still to do), Review due (a badge), Done (a tick).
function ringShape(u) {
  if (u.status === 'in_progress' && u.inProgress?.total) return { k: 'arc', f: Math.max(0, Math.min(1, (u.inProgress.step - 1) / u.inProgress.total)) };
  if (u.status === 'lock_in') return { k: 'read', f: 1 };
  if (u.status === 'due') return { k: 'due', f: 1, n: u.memory?.due || 0 };
  if (u.status === 'learned') return { k: 'done', f: 1 };
  return { k: 'new', f: 0 };
}

// The ring remembers what it showed last time in this browser, so it only plays its move when
// the lesson really changed since (after a run), and stays still otherwise.
const RING_KEY = 'mm:unit-ring:v1';
function readRing(id) {
  try { const map = JSON.parse(window.localStorage.getItem(RING_KEY) || '{}'); return map[id] || null; } catch { return null; }
}
function writeRing(id, shape) {
  try {
    const map = JSON.parse(window.localStorage.getItem(RING_KEY) || '{}');
    map[id] = { k: shape.k, f: shape.f };
    window.localStorage.setItem(RING_KEY, JSON.stringify(map));
  } catch { /* Without storage the ring just does not animate. */ }
}

export default function UnitRing({ unit }) {
  const shape = ringShape(unit);
  const [prev] = useState(() => (typeof window === 'undefined' ? null : readRing(unit.id)));
  const [ref, seen] = useInView({ threshold: 0.6 });
  const changed = Boolean(prev) && (prev.k !== shape.k || Math.abs((prev.f || 0) - shape.f) > 0.001);
  useEffect(() => { if (seen) writeRing(unit.id, shape); }, [seen, unit.id, shape.k, shape.f]); // eslint-disable-line react-hooks/exhaustive-deps
  const from = changed ? (prev.k === 'new' ? 0 : prev.f || 0) : shape.f;
  return <span ref={ref} className="sx-ring" data-k={shape.k} data-changed={changed && seen ? 'true' : undefined} role={shape.k === 'new' ? 'img' : undefined} aria-label={shape.k === 'new' ? 'Not started' : undefined} aria-hidden={shape.k === 'new' ? undefined : true}>
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
      <circle className="sx-ring__track" cx="18" cy="18" r="14" />
      {shape.k !== 'new' && shape.k !== 'done' ? <circle className="sx-ring__arc" cx="18" cy="18" r="14" pathLength="1" transform="rotate(-90 18 18)" style={{ '--to': shape.f, '--from': from }} /> : null}
      {shape.k === 'done' ? <><circle className="sx-ring__arc" cx="18" cy="18" r="14" pathLength="1" transform="rotate(-90 18 18)" style={{ '--to': 1, '--from': changed ? 0 : 1 }} /><path className="sx-ring__tick" d="M11.5 18.5l4.4 4.4 8.6-9.4" pathLength="1" /></> : null}
    </svg>
    {shape.k === 'due' && shape.n ? <i className="sx-ring__badge">{shape.n > 9 ? '9+' : shape.n}</i> : null}
  </span>;
}
