"use client";
// The streak's two useful parts (19 Nov 2026), shared by Today, Progress, You, the sheet and the end of a practice set:
//   MadeLines  what the line has made ("142 questions answered in this streak.") and what it makes by CUET at today's rule,
//              the pace line only from 3 days in a row and only with the exam day Road to CUET shows.
//   KeepKey    while today does not count, the one key that keeps the line: today's Daily Five while it is still to play,
//              else today's practice set; with a day still open, the make-up's own count. Each counts by the server's rule.
//   StreakEarned  where the work ends (a practice result): "Today counts. 13 days in a row." with the week's line, the first
//              time this device sees today counted (the same once-a-day key as Today's block), today's piece swiping in.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { countedKey, countedLine, keepAction, paceLine, runLine, streakWeek } from '@/lib/streak/streakCopy.mjs';
import { StreakMobi } from './Streak';
import StreakLine from './StreakLine';
import { loadStreak, openStreakSheet, useStreak } from './useStreak';
import { useDailyToday, useExamDay, usePreviewHref } from './useStreakExtras';
import './streak-line.css';

/** The key that keeps the line, while today does not count. Holds its place (unseen) until the Daily Five's state is known. */
export function KeepKey({ body, className = '' }) {
  const open = Boolean(body && !body.today?.done);
  const daily = useDailyToday(open && !body?.makeUp?.day);
  const known = !open || Boolean(body?.makeUp?.day) || daily !== null;
  const action = keepAction(body, { daily: daily || 'played' });
  const href = usePreviewHref(action?.href || null);
  if (!action) return null;
  if (!known) return <span className={`btn-outline md stk-keep stk-keep--wait ${className}`.trim()} aria-hidden="true">{action.label}</span>;
  return <Link href={href} className={`btn-outline md mk-press stk-keep ${className}`.trim()} data-kind={action.kind}>{action.label}</Link>;
}

/** What the line has made, and what it makes by CUET (only where the exam day is known, from 3 days in a row). */
export function MadeLines({ body, userId, className = '', run = true }) {
  const today = body?.week?.[body.week.length - 1]?.day || null;
  const exam = useExamDay(body?.days >= 3 ? userId : null, today);
  const made = run ? runLine(body) : null;
  const pace = exam ? paceLine(body, { examDay: exam.examDay, own: exam.own, today }) : null;
  if (!made && !pace) return null;
  return <p className={`stk-made ${className}`.trim()}>{made ? <span>{made}</span> : null}{pace ? <span>{pace}</span> : null}</p>;
}

const istDay = (at) => { const t = typeof at === 'number' ? at : Date.parse(at); return Number.isFinite(t) ? new Date(t + 330 * 60_000).toISOString().slice(0, 10) : null; };

/** The earning moment at the end of a practice set: shown once a day, only for a set finished today that made today count. */
export function StreakEarned({ userId, completedAt }) {
  const { data: body } = useStreak(userId);
  const prefs = useMobiPrefs();
  const [shown, setShown] = useState(null);
  const [lit, setLit] = useState(true);
  // The set just finished: read the streak again so today's count includes it.
  useEffect(() => { if (userId) loadStreak(userId, { force: true }); }, [userId]);
  const todayKey = body?.week?.[body.week.length - 1]?.day || null;
  const done = Boolean(body?.today?.done);
  const finishedToday = Boolean(todayKey && istDay(completedAt) === todayKey);
  useEffect(() => {
    if (shown || !done || !finishedToday || body?.hidden) return undefined;
    let seen = true;
    try { seen = window.localStorage.getItem(countedKey(todayKey)) === '1'; if (!seen) window.localStorage.setItem(countedKey(todayKey), '1'); } catch { seen = true; }
    if (seen) return undefined;
    const fresh = prefs.celebrations !== 'off' && !prefs.reduced;
    const t = window.setTimeout(() => { setShown({ fresh }); if (fresh) setLit(false); }, 0);
    return () => window.clearTimeout(t);
  }, [shown, done, finishedToday, todayKey, body?.hidden, prefs.celebrations, prefs.reduced]);
  // Mobi lights as today's piece of the line lands.
  useEffect(() => {
    if (!shown?.fresh) return undefined;
    const l = window.setTimeout(() => setLit(true), 470);
    return () => window.clearTimeout(l);
  }, [shown]);
  const line = countedLine(body);
  if (!shown || !line) return null;
  return (
    <section className="stk-earned" aria-label="Daily streak" role="status">
      <button type="button" className="stk-earned__head" onClick={() => openStreakSheet()} aria-label={`${line} Opens your streak.`}>
        <StreakMobi lit={lit} size={36} />
        <span aria-hidden="true">{line}</span>
      </button>
      <StreakLine days={streakWeek(body)} fresh={shown.fresh} label="Your last 7 days" />
    </section>
  );
}
