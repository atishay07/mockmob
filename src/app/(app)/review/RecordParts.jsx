"use client";

// Pieces shared by Review and Progress (web redesign W2.4): the record thread, the session list,
// the section frame and the loading skeleton. Styles: ./record.css (prefix rv-).
import { useState } from 'react';
import Link from 'next/link';
import { SubjectIcon } from '@/components/ui/Glyph';
import { plural, sessionLine, sessionTag, subjectName } from './reviewModel.mjs';
import './record.css';

/** A titled group. Spacing and a hairline hold it together; no card around it. */
export function RecordSection({ id, title, hint, children, action }) {
  return (
    <section className="rv-section" aria-labelledby={id}>
      <div className="rv-section__head">
        <h2 id={id}>{title}</h2>
        {hint ? <p>{hint}</p> : null}
        {action ? <div className="rv-section__action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The life of a mistake as four bubbles on one thread: Found, Repaired, Checked, Holds (D9).
 * Found is the wrong bubble; Repaired inks once the server has stored a repair; Checked and Holds
 * stay dashed while no fresh-check source exists. A stage that is unknown says so in words.
 */
export function StageThread({ thread, caption, label = 'Your mistakes, stage by stage' }) {
  const repairedLit = thread[1]?.state === 'count';
  return (
    <div className="rv-thread" data-repaired={repairedLit ? 'true' : undefined}>
      <ol className="rv-thread__stages" aria-label={label}>
        {thread.map((stage) => (
          <li key={stage.key} className="rv-stage" data-stage={stage.key} data-state={stage.state}>
            <span className="rv-stage__bubble" aria-hidden="true" />
            <span className="rv-stage__label">{stage.label}</span>
            {stage.value ? <span className="rv-stage__value">{stage.value}</span> : null}
            <span className="rv-stage__note">{stage.note}</span>
          </li>
        ))}
      </ol>
      {caption ? <p className="rv-thread__caption">{caption}</p> : null}
    </div>
  );
}

/** The saved sessions, newest first. Long lists open on request, never hidden for good. */
export function SessionList({ sessions, now, first = 8 }) {
  const [all, setAll] = useState(false);
  const shown = all ? sessions : sessions.slice(0, first);
  return (
    <>
      <ul className="rv-rows">
        {shown.map((s) => {
          const tag = sessionTag(s);
          return (
            <li key={s.id}>
              <Link className="rv-row" href={`/result/${encodeURIComponent(s.id)}`}>
                <span className="rv-row__icon" aria-hidden="true"><SubjectIcon id={s.subject} size={20} /></span>
                <span className="rv-row__main">
                  <b>{subjectName(s.subject)}</b>
                  <span>{sessionLine(s, now)}</span>
                </span>
                <span className="rv-tag" data-tone={tag.tone}>{tag.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {sessions.length > first ? (
        <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm rv-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          <span className="ui-btn__label">{all ? 'Show fewer sessions' : `Show all ${plural(sessions.length, 'session')}`}</span>
        </button>
      ) : null}
    </>
  );
}

/** A plain row for a check, a playbook entry or a repair. */
export function RecordRow({ title, lines = [], tag, tone }) {
  return (
    <li className="rv-item">
      <div className="rv-item__main">
        <b>{title}</b>
        {lines.filter(Boolean).map((line) => <span key={line}>{line}</span>)}
      </div>
      {tag ? <span className="rv-tag" data-tone={tone || 'quiet'}>{tag}</span> : null}
    </li>
  );
}

/** The page shape while the record loads: the thread, then rows. No invented progress. */
export function RecordSkeleton({ label, rows = 4, thread = true }) {
  return (
    <div className="rv-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {thread ? <div className="rv-skeleton__thread skeleton" aria-hidden="true" /> : null}
      <div className="rv-skeleton__rows" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => <div key={i} className="rv-skeleton__row skeleton" />)}
      </div>
    </div>
  );
}

/** True when a failed load looks like a lost connection rather than a server problem. */
export function looksOffline(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return error?.kind === 'network';
}
