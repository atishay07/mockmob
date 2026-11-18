"use client";
// Your pace (Marks trend, lane insight 18 Nov 2026): CUET's own time a question (NTA mode's constants), then one row per timed
// paper on record, newest last and at most eight: its name and day, a bar of its median seconds a question against one pace
// line all rows share, and the figure at the right with "under pace" or "over pace" in words. A paper with no usable timing
// is not drawn; with none the block is one quiet line. No average of the medians, nothing predicted. Bars do not animate in.
// Fed only by GET /api/analytics insight.pace (src/lib/insight/pace.mjs). Free: the rows are Pro's (pricing, and the
// record's own Pro line for pace), so the block says so with the record's Pro row.
import { RefreshCw } from 'lucide-react';
import { ProLock } from '@/components/ai/RecordView';
import { CUET_PACE_SEC, FAILED, PACE_COPY, TRY_AGAIN, clock, dayLabel, paceScale, paceWord } from '@/lib/insight/words.mjs';

function PaceWait() {
  return (
    <div className="ypc-wait" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => <span key={i} className="skeleton ypc-wait__row" />)}
    </div>
  );
}

/**
 * status   the analytics read: 'loading' | 'error' | 'ready'
 * pace     insight.pace: { state: 'ready', paceSec, papers } | { state: 'locked', paceSec } | { state: 'error' }
 * papers   the papers on record: a Free student with none sees no Pro line here (the record's own Pro rows wait for a paper too)
 */
export default function YourPace({ status, pace, papers = 0, onRetry }) {
  if (status === 'ready' && pace?.state === 'locked' && !(papers > 0)) return null;
  const paceSec = Number(pace?.paceSec) || CUET_PACE_SEC;
  const rows = pace?.state === 'ready' && Array.isArray(pace.papers) ? pace.papers : [];
  const scale = paceScale(rows, paceSec);
  const failed = status === 'error' || (status === 'ready' && !['ready', 'locked'].includes(pace?.state));
  return (
    <section className="ins ypc" aria-labelledby="ypc-h">
      <h2 id="ypc-h" className="pp-h">{PACE_COPY.title}</h2>
      <p className="ins-sub">{PACE_COPY.sub(paceSec)}</p>
      {status === 'loading' ? <PaceWait /> : failed ? (
        <p className="ins-fail" role="status">{FAILED} <button type="button" onClick={onRetry}><RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />{TRY_AGAIN}</button></p>
      ) : pace.state === 'locked' ? (
        <ProLock what={PACE_COPY.locked} />
      ) : !rows.length ? (
        <p className="ins-quiet">{PACE_COPY.none}</p>
      ) : (
        <div className="ypc-chart" style={{ '--pace': paceSec / scale }}>
          {/* The shared line's own figure, over the bars' column. */}
          <div className="ypc-scale" aria-hidden="true"><span /><span className="ypc-scale__track"><b>{clock(paceSec)}</b></span><span /></div>
          <ol className="ypc-rows">
            {rows.map((r) => {
              const word = paceWord(r.medianSec, paceSec);
              return (
                <li key={r.id} data-pace={word.replace(' ', '-')}>
                  <span className="ypc-name"><b>{r.name}, {r.subjectName}</b><small>{dayLabel(r.at)}</small></span>
                  <span className="ypc-track" aria-hidden="true"><i style={{ '--w': Math.min(1, r.medianSec / scale) }} /></span>
                  <span className="ypc-fig"><b>{clock(r.medianSec)}<span className="sr-only"> a question</span></b><small>{word}</small></span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
