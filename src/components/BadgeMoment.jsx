"use client";

// The moment a badge lands (lane "badges", 16 Nov 2026), where the student is: on the result of the paper that earned it
// (EarnedBadges.jsx) or on Today (TodayBadgeMoment below, for a repair, a week met or a fresh check that held). Only after the
// server's badge list dates it (lib/badgeShelf.js, lib/badgeMoment.js), once per badge on this device.
//
// What it is: the mark comes down onto the page (300 ms, ease-out; one still frame under Reduce motion or Celebrations off; a
// short fade under Quiet), then its name, the one true sentence of what the student did, what the next badge on that path
// needs, and the path's row with the new mark in its place. It is part of the page, never a layer over it: the page's own
// volt key stays where it was and stays reachable, and Close puts the moment away for good. It is remembered as seen once it
// has been on screen (mm:badge-seen:<id>, this device only, as before).
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { api } from '@/lib/fetcher';
import { useInView } from '@/lib/motion/useInView';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { haptic } from '@/lib/haptics';
import { BadgeStamp } from '@/components/Medal';
import { badgePathsFromApi, countEntries } from '@/lib/studyBadges';
import { markSeen } from '@/lib/badgeShelf';
import { freshEarned, markPaperLooked, mayBeOwed, momentOf } from '@/lib/badgeMoment';
import './study-badges.css';

const TILTS = ['-3deg', '4deg', '-1.5deg'];
const LAND_MS = 300;

// Badges already shown in this tab, so a blocked localStorage cannot bring a moment back on a client-side return.
export const shownThisTab = new Set();
export const tabKey = (s) => `${s.id}:${s.earnedAt}`;

export function storageOrNull() {
  try { return window.localStorage; } catch { return null; }
}

/** The path's marks, earned first, with the one just earned taking its place (drawn after the big mark lands). */
function PathStrip({ paths, entries, id }) {
  const path = paths.find((p) => p.steps.some((s) => s.id === id));
  if (!path) return null;
  const order = [...path.steps.filter((s) => s.status === 'earned'), ...path.steps.filter((s) => s.status !== 'earned')];
  const lead = order.find((s) => s.status === 'next');
  return (
    <div className="sb-moment__strip" aria-hidden="true">
      <span className="sb-moment__path">{path.title}, {path.earned} of {path.total}</span>
      <span className="sb-moment__marks">
        {order.map((s) => {
          const e = entries?.[s.id];
          const fraction = s.id === lead?.id && e && e.target > 0 && e.current > 0 && e.current < e.target ? e.current / e.target : null;
          return (
            <span key={s.id} className="sb-moment__slot" data-new={s.id === id ? 'true' : undefined}>
              <BadgeStamp id={s.id} status={s.status === 'earned' ? 'earned' : s.id === lead?.id ? 'next' : 'later'} size="md" fraction={fraction} />
            </span>
          );
        })}
      </span>
    </div>
  );
}

/**
 * The moment itself, from a board (paths, records, progress from badgePathsFromApi) and the earned steps to announce.
 * `onSeen` runs once the moment has been on screen; `where` names the page for the styles.
 */
export function BadgeMomentView({ board, steps, onSeen, where = 'result' }) {
  const [closed, setClosed] = useState(false);
  const [ref, inView] = useInView({ threshold: 0.5 });
  const { reduced, celebrations, touch } = useMobiPrefs();
  const seen = useRef(false);
  const entries = useMemo(() => countEntries(board.progress), [board.progress]);
  const items = useMemo(() => steps.map((s) => momentOf(board.paths, board.records, s.id, entries)).filter(Boolean), [steps, board, entries]);
  const still = reduced || celebrations === 'off';
  const armed = inView || still;

  useEffect(() => {
    if (!inView || seen.current || !items.length) return undefined;
    seen.current = true;
    onSeen?.(steps);
    if (still || !touch) return undefined;
    const t = window.setTimeout(() => haptic('settle'), LAND_MS);
    return () => window.clearTimeout(t);
  }, [inView, items.length, onSeen, steps, still, touch]);

  if (closed || !items.length) return null;
  const one = items.length === 1 ? items[0] : null;
  const title = one ? one.name : `${items.length} badges earned`;
  return (
    <section ref={ref} className="sb-earned sb-moment" data-where={where} data-count={items.length} data-armed={armed ? 'true' : 'false'} data-still={still ? 'true' : undefined} role="status" aria-label={one ? `Badge earned: ${one.name}` : title}>
      <div className="sb-moment__stamps" aria-hidden="true">
        {items.slice(0, 3).map((m, i) => (
          <span key={m.id} className="sb-moment__stamp" style={{ '--sb-tilt': TILTS[i], '--sb-delay': `${i * 120}ms` }}>
            <BadgeStamp id={m.id} status="earned" size="hero" land />
          </span>
        ))}
      </div>
      <div className="sb-moment__words">
        <h2 className="sb-moment__title">{title}</h2>
        {one ? (
          <>
            <p className="sb-moment__did"><b>Badge earned.</b> {one.sentence}</p>
            {one.next ? <p className="sb-moment__next">{one.next}</p> : null}
          </>
        ) : (
          <ul className="sb-moment__list">
            {items.map((m) => <li key={m.id}><b>{m.name}.</b> {m.sentence}</li>)}
          </ul>
        )}
        <p className="sb-moment__acts"><Link className="sb-link sb-link--tap" href="/progress#badges">See your badges</Link></p>
      </div>
      <button type="button" className="sb-moment__close" aria-label="Close" onClick={() => setClosed(true)}><X size={18} strokeWidth={2} aria-hidden="true" /></button>
      {one ? <PathStrip paths={board.paths} entries={entries} id={one.id} /> : null}
    </section>
  );
}

/**
 * Today's mount: asks the server for the badge list only when something here suggests a badge may be waiting (a recent
 * milestone the week's read dates and this device has not shown, or a recent paper whose result did not get to look), then
 * shows the badges the server dates in the last three days that this device has not shown. Draws nothing otherwise, and
 * nothing while the page is still landing (`hold`), so it arrives with the page.
 */
export function TodayBadgeMoment({ rhythm, papers, hold = false }) {
  const [found, setFound] = useState(null); // { board, steps }
  const asked = useRef(false);
  const ready = rhythm?.status !== 'loading' && papers?.status !== 'loading';
  const milestones = rhythm?.data?.milestones;
  const items = papers?.data;

  useEffect(() => {
    if (!ready || asked.current) return undefined;
    const now = Date.now();
    const storage = storageOrNull();
    if (!mayBeOwed({ milestones, papers: items, now, storage })) return undefined;
    asked.current = true;
    let alive = true;
    const newest = (Array.isArray(items) ? items : []).filter((p) => p?.id).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]?.id || null;
    api('/api/me/badges').then((body) => {
      if (!alive) return;
      const board = badgePathsFromApi(body);
      if (!board) return;
      const steps = freshEarned(board.paths, Date.now(), storage).filter((s) => !shownThisTab.has(tabKey(s)));
      if (steps.length) setFound({ board, steps: steps.slice(-3), all: steps, newest });
      else markPaperLooked(storage, newest);
    }).catch(() => { /* Nothing here: the badge is on Progress either way. */ });
    return () => { alive = false; };
  }, [ready, milestones, items]);

  if (!found || hold) return null;
  // At most three are drawn (the newest); every one found is remembered as shown, so none is held back for another visit.
  const onSeen = () => {
    const storage = storageOrNull();
    markSeen(storage, found.all);
    found.all.forEach((s) => shownThisTab.add(tabKey(s)));
    markPaperLooked(storage, found.newest);
  };
  return <BadgeMomentView board={found.board} steps={found.steps} onSeen={onSeen} where="today" />;
}

export default BadgeMomentView;
