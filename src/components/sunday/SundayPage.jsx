"use client";
// The Sunday Mock page (/sunday): what it is, where this week stands, each of the student's subjects with its state and its key,
// last Sunday's results through the week, and the rules in plain words. Today's card, Practice's chip and the public page lead
// here; the den starts its own subject directly. One volt key at most: the start key when it is the page's one action.
// Every state is drawn: loading (the rows' frame), error (Try again), off, no subjects (a way to add them), each phase.
import Link from 'next/link';
import ArenaHead from '@/components/arena/ArenaHead';
import {
  ANSWERS_LABEL, SUNDAY_COPY, dateLabel, marksLine, openUntilLine, opensLine, resultHref, satLine, stateOf, subjectRow, timeLabel, windowLine,
} from '@/lib/sundayMock.mjs';
import { useSunday } from './useSunday';
import ClassBlock from '@/components/class/ClassBlock';
import './sunday.css';

const LEDE = 'One full paper in each of your subjects, the same paper for everyone, every Sunday from 10:00 AM to 10:00 PM. Free.';

function nowLine(d) {
  const st = stateOf(d);
  if (d.phase === 'open') return { title: `${openUntilLine(st)} today`, line: `${dateLabel(d.week)}. Each paper is 50 questions in 60 minutes, and one started by ${timeLabel(st.closesAt)} keeps all 60.` };
  // 10:00 to 11:05 PM: closed for new starts, papers already started run on, and the answers wait for the last of them.
  if (d.phase === 'closed' && !st.answersOpen) return { title: `Closed for new starts at ${timeLabel(st.closesAt)}`, line: `Papers already started run to the end of their 60 minutes. The answers open at ${timeLabel(st.answersAt)}.` };
  if (d.phase === 'closed') return { title: `Closed at ${timeLabel(st.closesAt)}`, line: `The answers are open. The next one: ${windowLine(d.next)}.` };
  return { title: opensLine(st), line: `It stays open until ${timeLabel(st.closesAt)}. A paper started by then keeps its full 60 minutes.` };
}

function Rows({ d }) {
  const rows = d.subjects.map((sub) => ({ sub, row: subjectRow(d, sub) }));
  const keyed = rows.filter((r) => r.row.key);
  return (
    <ul className="sun-list">
      {rows.map(({ sub, row }) => (
        <li key={sub.id}>
          <span className="sun-list__text"><b>{sub.name}</b><span>{row.line}</span></span>
          {row.key || row.link ? (
            <span className="sun-list__act">
              {row.key ? <Link className={keyed.length === 1 ? 'btn-volt md' : 'sun-key'} href={row.key.href} {...(keyed.length === 1 ? { 'data-page-primary': '' } : {})}>{row.key.label}</Link> : null}
              {row.link ? <Link className="sun-link" href={row.link.href}>{row.link.label}</Link> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function SundayPage() {
  const sunday = useSunday(true);
  const d = sunday.status === 'ready' ? sunday.data : null;
  let body;
  if (sunday.status === 'loading') {
    body = <div className="sun-skel" aria-busy="true" aria-label="Loading the Sunday Mock"><i /><i /><i /></div>;
  } else if (sunday.status === 'error') {
    body = (
      <div className="sun-state" role="alert">
        <p>{SUNDAY_COPY.loadFailed} Your papers and marks are safe.</p>
        <button type="button" className="sun-key" onClick={sunday.reload}>{SUNDAY_COPY.tryAgain}</button>
      </div>
    );
  } else if (sunday.status === 'off' || !d) {
    body = (
      <div className="sun-state">
        <p>The Sunday Mock is switched off for now. Practice is open as usual.</p>
        <Link className="sun-key" href="/dashboard">Go to Practice</Link>
      </div>
    );
  } else {
    const now = nowLine(d);
    body = (
      <>
        <p className="sun-now"><b>{now.title}</b><span>{now.line}</span></p>
        <section className="sun-subjects" aria-labelledby="sun-subjects-h">
          <h2 id="sun-subjects-h">Your subjects</h2>
          {d.subjects.length ? <Rows d={d} /> : (
            <div className="sun-state">
              <p>{SUNDAY_COPY.noSubjects}</p>
              <Link className="sun-key" href="/onboarding?edit=true">{SUNDAY_COPY.addSubjects}</Link>
            </div>
          )}
        </section>
        {/* Class leagues (16 Nov 2026): "Your class" rides on the Sunday Mock. Draws nothing while CLASS_LEAGUES_ENABLED is off. */}
        <ClassBlock />
        {d.previous?.subjects?.length ? (
          <section className="sun-last" aria-labelledby="sun-last-h">
            <h2 id="sun-last-h">{`Last Sunday, ${dateLabel(d.previous.week).replace(/^Sunday /, '')}`}</h2>
            <ul className="sun-list">
              {d.previous.subjects.map((sub) => (
                <li key={sub.id}>
                  <span className="sun-list__text"><b>{sub.name}</b><span>{`You sat it: ${marksLine(sub.marks)}.${satLine(sub.sat) ? ` ${satLine(sub.sat)}` : ''}`}</span></span>
                  <span className="sun-list__act"><Link className="sun-link" href={resultHref(sub.resultId)}>{SUNDAY_COPY.seeResult}</Link></span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="sun-rules" aria-labelledby="sun-rules-h">
          <h2 id="sun-rules-h">How it works</h2>
          <ul>
            <li>50 questions in 60 minutes, marked +5 for right and −1 for wrong, as a full CUET paper is.</li>
            <li>Everyone sitting a subject gets the same paper that Sunday.</li>
            <li>{SUNDAY_COPY.once}</li>
            <li>{SUNDAY_COPY.held}</li>
            <li>{`From ${ANSWERS_LABEL} you see how many sat the paper, and how many got each question right once 30 or more have sat it.`}</li>
            <li>In a Mob, your Mob sees whether you sat it, and your marks if you show your score.</li>
          </ul>
        </section>
      </>
    );
  }
  return (
    <div className="student-page sun-page">
      <ArenaHead title={SUNDAY_COPY.name} lede={LEDE} />
      {body}
    </div>
  );
}
