"use client";
// The Sunday Mock on Today (15 Nov 2026): one card under Ask Mobi and the Daily Five, only when it has something to say
// (src/lib/sundayMock.mjs todayCard). Saturday: it opens tomorrow at 10:00 AM. Sunday in the window: open until 10:00 PM, with
// the start key (a quiet key: Today's one volt stays the lead card's). After the close: the result or the next Sunday. Monday:
// yesterday's result for a student who sat it. Nothing on other days, while it is off, or for a student with no subjects.
// It lands with the page (`hold`): on a Saturday or Sunday a read still out when the page lands shows the card's own frame, so
// the words arrive in place and nothing under it moves.
import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { istDow, todayCard } from '@/lib/sundayMock.mjs';
import { useSunday } from './useSunday';
import ClassTodayCard from '@/components/class/ClassTodayCard';
import './sunday.css';

const Mark = () => <span className="sun-mark" aria-hidden="true"><CalendarClock size={24} strokeWidth={1.6} /></span>;

function SundayCard({ hold = false }) {
  const sunday = useSunday(true);
  // The device's own IST weekday decides only whether to keep the card's place while the read is out; the words always come
  // from the server.
  const [dow] = useState(() => istDow(Date.now()));
  if (hold) return null;
  if (sunday.status === 'loading') {
    if (dow !== 6 && dow !== 0) return null;
    return (
      <div className="tsun tsun--wait" aria-hidden="true">
        <Mark />
        <span className="tsun__text"><i /><i /></span>
      </div>
    );
  }
  const card = sunday.status === 'ready' ? todayCard(sunday.data) : null;
  if (!card) return null;
  if (card.key) {
    return (
      <section className="tsun tsun--keyed" aria-labelledby="tsun-h">
        <Mark />
        <div className="tsun__text">
          <h2 id="tsun-h">{card.title}</h2>
          <p>{card.line}</p>
        </div>
        <Link className="sun-key" href={card.key.href}>{card.key.label}</Link>
      </section>
    );
  }
  return (
    <Link className="tsun" href={card.href}>
      <Mark />
      <span className="tsun__text"><b>{card.title}</b><span>{card.line}</span></span>
      <ChevronRight className="tsun__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

// Class leagues (16 Nov 2026): the class's card sits under this one (src/components/class/ClassTodayCard.jsx); it draws nothing
// while CLASS_LEAGUES_ENABLED is off.
export default function SundayTodayCard({ hold = false }) {
  return <><SundayCard hold={hold} /><ClassTodayCard hold={hold} /></>;
}
