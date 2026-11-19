"use client";
// Where your marks go (Marks trend, lane insight 18 Nov 2026): every mark the papers on record did not earn, as one bar split
// by what the record says caused it: wrong answers (the 5 a right answer gives and the 1 penalty) and questions left blank,
// each with its marks in words and figures beside a legend of shape and word. Pro, when replays exist, adds one line of the
// changed answers' net effect. No paper on record: the block is not drawn. The bar does not animate in.
// Fed only by GET /api/analytics insight.marks (src/lib/insight/marks.mjs).
// Wide lane (owner, 19 Nov 2026, "a bit more interactive"): each part of the bar is a stop of its own. A mouse over it, or the
// focus on it, shows its marks above it and lights its row in the legend; a mouse over a legend row lights its part of the bar.
// A finger keeps today's bar (a tap that focuses a part shows nothing new).
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { FAILED, MARKS_COPY, TRY_AGAIN, changesLine } from '@/lib/insight/words.mjs';

const PARTS = ['wrong', 'blank'];

/**
 * status   the analytics read: 'loading' | 'error' | 'ready'
 * marks    insight.marks: { state: 'ready', papers, wrong, blank, total, changes } | { state: 'none' } | { state: 'error' }
 */
export default function WhereMarksGo({ status, marks, onRetry }) {
  const [hot, setHot] = useState(null); // 'wrong' | 'blank' | null
  if (status === 'ready' && marks?.state === 'none') return null;
  const failed = status === 'error' || (status === 'ready' && marks?.state !== 'ready');
  const ready = status === 'ready' && !failed;
  const total = ready ? marks.total : 0;
  const change = ready ? changesLine(marks.changes, marks.papers) : null;
  return (
    <section className="ins wmg" aria-labelledby="wmg-h">
      <h2 id="wmg-h" className="pp-h">{MARKS_COPY.title}</h2>
      {ready ? <p className="ins-sub">{MARKS_COPY.sub(marks.papers)}</p> : null}
      {status === 'loading' ? <div className="wmg-wait" aria-hidden="true"><span className="skeleton wmg-wait__fig" /><span className="skeleton wmg-wait__bar" /><span className="skeleton wmg-wait__legend" /></div> : failed ? (
        <p className="ins-fail" role="status">{FAILED} <button type="button" onClick={onRetry}><RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />{TRY_AGAIN}</button></p>
      ) : (
        <>
          <p className="wmg-total"><b>{total}</b><span>{MARKS_COPY.total}</span></p>
          <div className="wmg-barwrap" data-hot={hot || undefined}>
            <div className="wmg-bar" role="group" aria-label={`${MARKS_COPY.wrong}: ${MARKS_COPY.marks(marks.wrong.marks)}. ${MARKS_COPY.blank}: ${MARKS_COPY.marks(marks.blank.marks)}. ${total} ${MARKS_COPY.total}.`}>
              {PARTS.map((k) => (marks[k].marks > 0 ? (
                <i
                  key={k}
                  data-k={k}
                  style={{ flexGrow: marks[k].marks }}
                  tabIndex={0}
                  role="img"
                  aria-label={`${k === 'wrong' ? MARKS_COPY.wrong : MARKS_COPY.blank}: ${MARKS_COPY.marks(marks[k].marks)}`}
                  onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHot(k); }}
                  onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHot(null); }}
                  onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setHot(k); }}
                  onBlur={() => setHot(null)}
                />
              ) : null))}
            </div>
            {/* The shown part's marks with its swatch, over the bar's end (the part itself is the one left at full strength). */}
            <div className="wmg-tips" aria-hidden="true">
              {PARTS.map((k) => (marks[k].marks > 0 ? <span key={k} data-k={k}><b>{MARKS_COPY.marks(marks[k].marks)}</b></span> : null))}
            </div>
          </div>
          <dl className="wmg-legend">
            {PARTS.map((k) => (
              <div key={k} data-k={k} data-hot={hot === k || undefined} onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHot(k); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHot(null); }}>
                <dt><i aria-hidden="true" />{k === 'wrong' ? MARKS_COPY.wrong : MARKS_COPY.blank}</dt>
                <dd><span>{k === 'wrong' ? MARKS_COPY.wrongCount(marks.wrong.count) : MARKS_COPY.blankCount(marks.blank.count)}</span><b>{MARKS_COPY.marks(marks[k].marks)}</b></dd>
              </div>
            ))}
          </dl>
          <p className="wmg-rule">{MARKS_COPY.rule}</p>
          {change ? <p className="wmg-change">{change}</p> : null}
        </>
      )}
    </section>
  );
}
