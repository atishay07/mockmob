"use client";

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { DAILY_FIVE_SIZE, countdownDays, countdownParts, dayLabel, leafOf, msUntilNextDay, todayDaily, untilWords, weekOf } from '@/lib/dailyFive.mjs';
import './daily-parts.css';

// The Daily Five's own parts (16 Nov 2026; the owner: "It's not placed correctly as a proper clock. How do other websites do
// it?"). What a daily puzzle is made of, drawn once and used by the home page's block (DailyFiveRow.jsx) and by /daily
// (DailyFive.jsx): the calendar leaf (which day this is), the board (five tiles: open, right or missed), the clock (a real
// countdown to 12:00 am IST, when a new five opens) and the week (the last seven days, played or not). Marketing surface
// tokens only (.mm); no state of the Daily Five lives here.

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

/** The calendar leaf: the month over the day's number. The weekday is said in the text beside it. */
export function DailyLeaf({ date, size = 'm' }) {
  const leaf = date ? leafOf(date) : null;
  return (
    <span className="df-leaf" data-size={size} aria-hidden="true">
      <span className="df-leaf__month">{leaf ? leaf.month : ' '}</span>
      <span className="df-leaf__day">{leaf ? leaf.day : ' '}</span>
    </span>
  );
}

/**
 * The board: five tiles in question order. marks[i] is true (right), false (missed) or null (not answered); `current` rings
 * the question being answered; `reveal` lets the tiles arrive one after another (the moment the five are finished).
 */
export function DailyBoard({ marks = null, current = null, size = 'm', reveal = false, label }) {
  return (
    <p className="df-board" data-size={size} data-reveal={reveal ? 'true' : undefined} role="img" aria-label={label}>
      {Array.from({ length: DAILY_FIVE_SIZE }, (_, i) => {
        const mark = marks ? marks[i] : null;
        const state = mark === true ? 'right' : mark === false ? 'miss' : current === i ? 'now' : 'open';
        return (
          <span key={i} className="df-tile" data-state={state} style={reveal ? { '--df-i': i } : undefined}>
            {state === 'right' ? <Icon name="check" className="df-tile__icon" />
              : state === 'miss' ? <Icon name="x" className="df-tile__icon" />
                : <span className="df-tile__n">{i + 1}</span>}
          </span>
        );
      })}
    </p>
  );
}

/** What a board says to a screen reader. */
export function boardLabel(marks) {
  if (!marks || marks.every((m) => m === null || m === undefined)) return 'Five questions, none answered yet';
  return marks.map((m, i) => `question ${i + 1} ${m === true ? 'right' : m === false ? 'missed' : 'not answered'}`).join(', ');
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
 * The day, as the ink top of a tear-off desk calendar page: whether it is open (a lit dot and two words), the date large (the
 * day's number, the month in volt, the weekday) and a clock. The home page's blocks and /daily wear the same page.
 */
export function CalendarDay({ on = false, status, date, clock }) {
  const leaf = date ? leafOf(date) : null;
  return (
    <div className="df-day" aria-hidden="true">
      <p className="df-day__live" data-on={on ? 'true' : 'false'}><i />{status}</p>
      <div className="df-day__date">
        <b>{leaf ? leaf.day : '\u00a0'}</b>
        <span><em>{leaf ? leaf.month : '\u00a0'}</em><small>{date ? dayLabel(date).split(',')[0] : '\u00a0'}</small></span>
      </div>
      {clock}
    </div>
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
