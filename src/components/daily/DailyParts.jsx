"use client";

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { countdownDays, countdownParts, msUntilNextDay, todayDaily, untilWords, weekOf } from '@/lib/dailyFive.mjs';
import './daily-parts.css';

// The Daily Five's own parts (16 Nov 2026; the owner: "It's not placed correctly as a proper clock. How do other websites do
// it?"): the clock (a real countdown to 12:00 am IST, when a new five opens; with days for the Sunday Mock's page) and the
// week (the last seven days, played or not), used by /daily (DailyFive.jsx) and /sunday-mock (SundayNext.jsx). 17 Nov 2026:
// the calendar leaf, the ink day band and the five tiles are gone (they read as a rival's); the five are answer bubbles now
// (DailyTeam.jsx OmrFive) and the day is an admit card. Marketing surface tokens only (.mm); no state of the Daily Five here.

/**
 * The wall clock: read once right after the first paint (the server has no clock, so it is null until then), then once a
 * second while `active`, and at once when the tab comes back.
 */
export function useDailyNow(active = true) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!active) return undefined;
    let id = 0;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      id = window.setTimeout(tick, 1000 - (t % 1000) + 4);
    };
    id = window.setTimeout(tick, 0);
    const back = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', back);
    return () => { window.clearTimeout(id); document.removeEventListener('visibilitychange', back); };
  }, [active]);
  return now;
}

/** True while the element is on screen (or near it), so a clock far down a long page does not tick for nobody. */
export function useOnScreen(ref, margin = '200px 0px') {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') { const t = window.setTimeout(() => setOn(true), 0); return () => window.clearTimeout(t); }
    const io = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return on;
}

/**
 * The clock's face: a label and HH:MM:SS. `ms` null draws the face without digits (before the first tick), same size.
 * `days` is for a wait longer than a day (the Sunday Mock): the days lead, and every pair carries its unit.
 */
export function DailyClock({ ms, label, size = 'm', units = false, days = false }) {
  const known = ms !== null && ms !== undefined;
  const parts = !known ? null : days ? countdownDays(ms) : countdownParts(ms);
  const named = units || days;
  const pair = (value, unit) => (
    <span className="df-clock__pair">
      <b>{parts ? value : '--'}</b>
      {named ? <small>{unit}</small> : null}
    </span>
  );
  const withDays = days && (!parts || parts.d !== '0');
  return (
    <p className="df-clock" data-size={size} data-days={days ? 'true' : undefined} role="timer" aria-label={known ? `${label} ${untilWords(ms)}` : label}>
      <span className="df-clock__label" aria-hidden="true">{label}</span>
      <span className="df-clock__digits" aria-hidden="true">
        {withDays ? <>{pair(parts?.d, parts?.d === '1' ? 'day' : 'days')}<i>:</i></> : null}
        {pair(parts?.h, 'hr')}<i>:</i>{pair(parts?.m, 'min')}<i>:</i>{pair(parts?.s, 'sec')}
      </span>
    </p>
  );
}

/**
 * The clock, ticking by itself (only this small part draws again each second): the wait until 12:00 am IST. `onNewDay`
 * is called once when the IST date moves past `date`, so the page can load the new five.
 */
export function NextFiveClock({ date, label, size = 'm', units = false, onNewDay }) {
  const ref = useRef(null);
  const on = useOnScreen(ref);
  const now = useDailyNow(on);
  const told = useRef(null);
  useEffect(() => {
    if (now === null || !date || !onNewDay) return;
    if (todayDaily(now).date !== date && told.current !== date) { told.current = date; onNewDay(); }
  }, [now, date, onNewDay]);
  return <span className="df-clock-live" ref={ref}><DailyClock ms={now === null ? null : msUntilNextDay(now)} label={label} size={size} units={units} /></span>;
}

/** The last seven days, oldest first: a letter and a dot each. Played is filled; today is ringed until it is played. */
export function DailyWeek({ days, today }) {
  const week = weekOf(days, today);
  if (!week.length) return <ol className="df-week" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <li key={i} className="df-week__day"><span className="df-week__letter">{' '}</span><span className="df-week__dot" /></li>)}</ol>;
  return (
    <ol className="df-week" aria-label="Your last seven days">
      {week.map((d) => (
        <li key={d.date} className="df-week__day" data-played={d.played ? 'true' : 'false'} data-today={d.today ? 'true' : undefined} data-before={d.before ? 'true' : undefined}>
          <span className="df-week__letter" aria-hidden="true">{d.letter}</span>
          <span className="df-week__dot" aria-hidden="true">{d.played ? <Icon name="check" className="df-week__icon" /> : null}</span>
          <span className="sr-only">{d.name}{d.today ? ', today' : ''}: {d.played ? 'played' : d.before ? 'before the Daily Five began' : d.today ? 'not played yet' : 'not played'}</span>
        </li>
      ))}
    </ol>
  );
}
