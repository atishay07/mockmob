"use client";
// The Sunday Mock in the den (15 Nov 2026): this week's paper in the Mob's subject, sat together. Who in the Mob sat it and their
// marks, by the Mob's own privacy (every member sees who sat; a member's marks only when they show their score, your own
// always), "Not yet" for the others while it is open, and "Sit it" for you while it is open. After the close only the sitters.
// Before Sunday 10:00 AM: one line with the date and time. Off, or a failed read: nothing (the den keeps its own card).
// Every key here is quiet: the den's one volt stays its game card's.
import Link from 'next/link';
import { SUNDAY_COPY, dateLabel, marksLine, opensLine, resultHref, sundayPaperHref, timeLabel, windowLine } from '@/lib/sundayMock.mjs';
import { useSundayMob } from './useSunday';
import './sunday.css';

function stateOf(d) {
  return { phase: d.phase, dow: d.dow, week: d.week, opensAt: Date.parse(d.opensAt), closesAt: Date.parse(d.closesAt) };
}

export default function SundayDenBlock({ mobId }) {
  const sunday = useSundayMob(mobId);
  if (sunday.status === 'loading') return <section className="sun-den sun-den--wait" aria-hidden="true"><i /><i /></section>;
  const d = sunday.status === 'ready' ? sunday.data : null;
  if (!d || !d.available) return null;
  const st = stateOf(d);
  const you = d.you || {};
  const sat = (d.members || []).filter((m) => m.sat);
  const shown = st.phase === 'closed' ? sat : d.members || [];
  const when = st.phase === 'open' ? `Open until ${timeLabel(st.closesAt)}` : st.phase === 'closed' ? `Closed at ${timeLabel(st.closesAt)}` : windowLine(st.week);
  let line;
  if (st.phase === 'before') line = `${opensLine(st)}. Everyone in your Mob sits the same ${d.subjectName} paper: 50 questions, 60 minutes, free.`;
  else if (st.phase === 'open') line = `${sat.length} of ${(d.members || []).length} sat this week's ${d.subjectName} paper.`;
  else line = sat.length ? `${sat.length} of ${(d.members || []).length} sat it. The next one is on ${dateLabel(d.next)}.` : `Nobody in your Mob sat it this week. The next one is on ${dateLabel(d.next)}.`;
  const sitKey = st.phase === 'open' && (you.state === 'open' || you.state === 'started')
    ? <Link className="sun-key" href={sundayPaperHref(d.week, d.subject)}>{you.state === 'started' ? SUNDAY_COPY.resume : SUNDAY_COPY.sitIt}</Link>
    : null;
  const seeYours = you.resultId ? <Link className="sun-link" href={resultHref(you.resultId)}>{SUNDAY_COPY.seeResult}</Link> : null;
  return (
    <section className="sun-den" aria-labelledby="sun-den-h">
      <div className="sun-den__head">
        <h3 id="sun-den-h">{SUNDAY_COPY.name}</h3>
        <p className="sun-den__when">{when}</p>
      </div>
      <p className="sun-den__line">{line}</p>
      {st.phase !== 'before' && shown.length ? (
        <ul className="sun-den__list">
          {shown.map((m, i) => (
            <li key={`${m.name}-${i}`}>
              <span className="sun-den__disc" data-colour={m.colour} aria-hidden="true" />
              <span className="sun-den__name">{m.name}{m.you ? <span> (you)</span> : null}</span>
              {m.sat
                ? (m.marks ? <span className="sun-den__mark">{marksLine(m.marks)}</span> : <span className="sun-den__mark" data-quiet="">{SUNDAY_COPY.satPrivate}</span>)
                : <span className="sun-den__mark" data-quiet="">{SUNDAY_COPY.notYet}</span>}
            </li>
          ))}
        </ul>
      ) : null}
      {st.phase === 'open' && you.state === 'not_yours' ? <p className="sun-den__when">{`${d.subjectName} is not one of your subjects, so it is not in your Sunday Mock.`}</p> : null}
      {sitKey || seeYours ? <div className="sun-den__keys">{sitKey}{seeYours}</div> : null}
    </section>
  );
}
