"use client";
// Time and decisions, inside the Score Recovery Lab's Find step: the paper's pace, where the time went (the
// longest questions against the paper's time a question), the time split by verdict, and every answer change
// with its clock times and marks effect. Every sentence comes finished from data/time_decisions.js, the same
// words as the app. Each row opens its answer below, where the same question shows its own time and picks.
import { useState } from 'react';
import { TIME_COPY, TIME_RULES, signedMarks } from '@/../data/time_decisions';
import './time-decisions.css';

const verdictWord = (v) => TIME_COPY.verdict[v] || TIME_COPY.verdict.skipped;

// changesId: an id for "Every answer you changed", so the Lab's "See every change" can bring it into view.
// said: the basic ledger above already says the device record was not used, so it is not said twice.
export default function TimeDecisions({ read, onJump, changesId = null, said = false }) {
  const [allChanges, setAllChanges] = useState(false);
  if (!read) return null;
  if (said && read.state === 'inconsistent') return null;
  if (read.state !== 'ready') return <p className="srl-muted td-none">{read.message}</p>;
  const { summary, longest, changes, pace } = read;
  const max = longest[0]?.ms || 1;
  const paceAt = pace ? Math.min(100, (pace.perQuestionMs / max) * 100) : null;
  const lead = [summary.pace, summary.median].filter(Boolean).join(' ');
  const folds = changes.rows.length > TIME_RULES.changesShown + 1;
  const shownChanges = folds && !allChanges ? changes.rows.slice(0, TIME_RULES.changesShown) : changes.rows;
  return (
    <div className="td">
      {lead ? <p className="td-lead">{lead}</p> : null}

      {longest.length ? (
        <div className="td-block">
          <h4 className="td-h">{TIME_COPY.longestTitle}</h4>
          <ol className="td-long">
            {longest.map((l, i) => (
              <li key={l.number} style={{ '--i': i }}>
                <button type="button" className="td-long__row" onClick={() => onJump(l.number)}
                  aria-label={`Question ${l.number}, ${verdictWord(l.verdict)}, ${l.time}${l.ratioText ? `, ${l.ratioText}` : ''}. Open the answer.`}>
                  <span className="td-long__q">Q{l.number}</span>
                  <span className="td-long__track" aria-hidden="true">
                    <span className="td-long__fill" data-verdict={l.verdict} style={{ width: `${Math.max(2, (l.ms / max) * 100)}%` }} />
                    {paceAt !== null ? <span className="td-long__pace" style={{ left: `${paceAt}%` }} /> : null}
                  </span>
                  <span className="td-long__time">{l.time}</span>
                  <span className="td-long__meta">
                    <span data-verdict={l.verdict}>{verdictWord(l.verdict)}</span>
                    {l.ratioText ? <span>{l.ratioText}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {summary.longestNote ? <p className="srl-fine">{summary.longestNote}</p> : null}
        </div>
      ) : null}

      {summary.split ? <p className="td-split">{summary.split}</p> : null}

      <div className="td-block">
        <h4 className="td-h" id={changesId || undefined} tabIndex={changesId ? -1 : undefined} data-lab-anchor={changesId ? '' : undefined}>{TIME_COPY.changesTitle}</h4>
        {changes.lead ? <p>{changes.lead}</p> : null}
        {changes.parts.length > 1 ? (
          <ul className="td-parts">
            {changes.parts.map((p) => <li key={p.kind} data-kind={p.kind}>{p.text}</li>)}
          </ul>
        ) : null}
        {changes.rows.length ? (
          <ol className="td-changes">
            {shownChanges.map((r, i) => (
              <li key={r.qid} style={{ '--i': i }}>
                <button type="button" className="td-changes__row" onClick={() => onJump(r.number)}>
                  <span className="td-changes__q">Q{r.number}</span>
                  <span className="td-changes__text">{r.text}</span>
                  {r.net !== null ? (
                    <b className="td-changes__net" data-tone={r.net > 0 ? 'good' : r.net < 0 ? 'bad' : 'neutral'}
                      aria-label={r.net === 0 ? 'No change in marks' : `${r.net > 0 ? 'Gained' : 'Cost'} ${Math.abs(r.net)} marks`}>{signedMarks(r.net)}</b>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        {folds ? (
          <button type="button" className="td-more" aria-expanded={allChanges} onClick={() => setAllChanges((v) => !v)}>
            {allChanges ? TIME_COPY.showFewer : TIME_COPY.showAll(changes.rows.length)}
          </button>
        ) : null}
        {changes.held ? <p className="srl-fine">{changes.held}</p> : null}
        {changes.rows.length ? <p className="srl-fine">{TIME_COPY.clockNote}</p> : null}
      </div>
    </div>
  );
}
