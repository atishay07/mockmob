'use client';
// The end of a study session (A1 3.9, B2, B7 E; one form for the feed and the run):
//   <EndForm title done pile lines note keys loading error onRetry titleRef />
//     title     the chapter title (display 750); done the done line ("All 21 done in 9 min." / "You stopped at 8 of 21.")
//     pile      null | { count, cards: [card], line, none } -> the fan of up to four real card faces, "6 kept", the line
//     lines     [{ label, text }] hairline rows, in the order given
//     note      an extra quiet line (Free's limit), keys: the key column (lead volt first), as nodes
//     loading   the end at its final shape; error: { title, line } with Try again (A8 F10: never invented numbers)
//   Desktop (1200 and up): two columns inside 880 px; below that, one column at most 440 px.
//   <KeptFan cards open /> is exported for a screen that wants the fan alone.
import { useEffect, useState } from 'react';
import { cardFace } from '@/components/keycards/kinds';

export function KeptFan({ cards = [], open = true }) {
  const shown = cards.slice(0, 4);
  const mid = (shown.length - 1) / 2;
  return (
    <div className="st-pile__fan" data-open={open || undefined} aria-hidden="true">
      {shown.map((c, i) => (
        <span key={c.id || i} className="st-pile__card" style={{ '--r': `${(i - mid) * 7}deg`, '--x': `${(i - mid) * 26}px`, '--d': `${i * 40}ms`, zIndex: i }}>
          {i === shown.length - 1 ? (
            <>
              <span className="st-pile__k">{cardFace(c).label}</span>
              <span className="st-pile__f">{String(cardFace(c).front).replace(/_{3,}/g, '____')}</span>
            </>
          ) : <span className="st-pile__lines"><i /><i /><i /></span>}
        </span>
      ))}
    </div>
  );
}

export function EndForm({ title, done = null, pile = null, lines = [], note = null, keys = null, loading = false, error = null, onRetry, retryKeys = null, titleRef }) {
  // The fan opens as the end comes into view (one frame after it is drawn, so the cards travel).
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (loading || error) return undefined;
    const f = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => cancelAnimationFrame(f);
  }, [loading, error]);
  if (loading) {
    return (
      <div className="st-endskel" role="status" aria-label="Adding it up">
        <span className="skeleton" style={{ width: '60%', height: 32 }} />
        <span className="skeleton" style={{ width: '100%', height: 156 }} />
        <span className="skeleton" style={{ width: '100%', height: 44 }} />
        <span className="skeleton" style={{ width: '100%', height: 44 }} />
        <span className="skeleton" style={{ width: '100%', height: 52 }} />
        <span className="skeleton" style={{ width: '100%', height: 52 }} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="st-endform">
        <div className="st-endform__main">
          <h2 className="st-endform__title" ref={titleRef} tabIndex={-1}>{error.title}</h2>
          <p className="st-endform__note">{error.line}</p>
        </div>
        <div className="st-endform__keys">
          <button type="button" className="kc-btn kc-btn--volt" onClick={onRetry}>Try again</button>
          {retryKeys}
        </div>
      </div>
    );
  }
  return (
    <div className="st-endform">
      <div className="st-endform__main">
        <div>
          <h2 className="st-endform__title" ref={titleRef} tabIndex={-1}>{title}</h2>
          {done ? <p className="st-endform__done">{done}</p> : null}
        </div>
        {pile ? (
          pile.count ? (
            <div className="st-pile">
              <KeptFan cards={pile.cards || []} open={open} />
              <p className="st-pile__count"><b>{`${pile.count} kept`}</b>{pile.line ? <span>{pile.line}</span> : null}</p>
            </div>
          ) : pile.none ? <p className="st-endform__note">{pile.none}</p> : null
        ) : null}
        {lines.length ? <ul className="st-lines">{lines.map((l) => <li key={l.label}><b>{l.label}</b><span>{l.text}</span></li>)}</ul> : null}
      </div>
      <div className="st-endform__keys">
        {note}
        {keys}
      </div>
    </div>
  );
}
