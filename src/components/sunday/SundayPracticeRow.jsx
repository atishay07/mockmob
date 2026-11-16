"use client";
// Practice's way to the Sunday Mock: one quiet chip under the head, opening the Sunday Mock page (where the subject is chosen).
// Only near the paper (owner, 16 Nov 2026): on Saturday a reminder that it is tomorrow, on Sunday that it opens today or is open,
// until the last start (practiceLine). Every other day, off, signed out, no subjects or a failed read: nothing at all, so
// Practice keeps no empty gap. The clock is the server's (the status's serverNow), run on by this device's own elapsed time and
// read again each minute, so a page left open on Saturday night turns into Sunday's line, and a phone set to the wrong day
// does not show the wrong one.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { practiceLine } from '@/lib/sundayMock.mjs';
import { useSunday } from './useSunday';
import './sunday.css';

/** The server's time now: its serverNow plus what has passed on this device since the status arrived; null until then. */
function useServerNow(serverNow, at) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!Number.isFinite(serverNow) || !Number.isFinite(at)) return undefined;
    const read = () => setNow(serverNow + (Date.now() - at));
    const t = window.setTimeout(read, 0);
    const id = window.setInterval(read, 60 * 1000);
    const back = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', back);
    return () => { window.clearTimeout(t); window.clearInterval(id); document.removeEventListener('visibilitychange', back); };
  }, [serverNow, at]);
  return now;
}

export default function SundayPracticeRow() {
  const sunday = useSunday(true);
  const ready = sunday.status === 'ready';
  const now = useServerNow(ready ? Number(sunday.data?.serverNow) : NaN, ready ? sunday.at : NaN);
  const row = ready && now !== null ? practiceLine(sunday.data, now) : null;
  if (!row) return null;
  return (
    <Link className="sun-chip" href="/sunday">
      <CalendarClock size={17} strokeWidth={1.75} aria-hidden="true" />
      <span><b>{row.title}</b> {row.line}</span>
    </Link>
  );
}
