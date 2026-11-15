"use client";
// The Sunday Mock in the den (15 Nov 2026): this week's paper in the Mob's subject, sat together. By the den's rule F2
// (src/lib/mob/games.mjs: nothing counts or names a member who has not played) the strip lists only the members who sat it,
// with their marks when they show their score, and your own row whatever your state: "Not yet" and "Sit it" are yours alone
// (src/lib/sundayMock.mjs denStrip refuses another member's not-yet row even if one arrived). After the close only the sitters.
// Before Sunday 10:00 AM: one line with the date and time. Off, or a failed read: nothing (the den keeps its own card).
// Every key here is quiet: the den's one volt stays its game card's.
import Link from 'next/link';
import { SUNDAY_COPY, denStrip, marksLine, resultHref, stateOf, sundayPaperHref, timeLabel, windowLine } from '@/lib/sundayMock.mjs';
import { useSundayMob } from './useSunday';
import './sunday.css';

export default function SundayDenBlock({ mobId }) {
  const sunday = useSundayMob(mobId);
  if (sunday.status === 'loading') return <section className="sun-den sun-den--wait" aria-hidden="true"><i /><i /></section>;
  const d = sunday.status === 'ready' ? sunday.data : null;
  const strip = denStrip(d);
  if (!strip) return null;
  const st = stateOf(d);
  const you = d.you || {};
  const when = st.phase === 'open' ? `Open until ${timeLabel(st.closesAt)}` : st.phase === 'closed' ? `Closed at ${timeLabel(st.closesAt)}` : windowLine(st.week);
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
      <p className="sun-den__line">{strip.line}</p>
      {strip.rows.length ? (
        <ul className="sun-den__list">
          {strip.rows.map((m, i) => (
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
