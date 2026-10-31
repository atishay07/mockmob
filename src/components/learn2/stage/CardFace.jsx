'use client';
// A Key card on the study stage (BUILD-1101 B1, A1 3.4, A8 3.2): it fits its words.
//   <CardFace card turned onTurn mustKnow refEl stamp extraKind />
//   - Both faces sit in one grid cell, so the card takes the taller face's height and the turn never jumps; at least the
//     band's min-height (phone clamp(300px, 46dvh, 380px), tablet 340, desktop 360/340/300 by height), at most the item area
//     minus the stamp line. A face taller than that scrolls inside, with a fade at its foot while more is below (A8 F5).
//   - Front: the kind line, the prompt sized by its length (s/m/l), and the source at the foot. No Must-know tag here:
//     feeds and runs serve Must-know cards first, so it would sit on nearly every card (LK13; it stays in the Cards view).
//   - Back: the kind line, the prompt repeated small (so a turned card still says what was asked), NCERT's line, the source,
//     and a "Turn back" text key.
//   - The card's content stays readable to a screen reader (no role=button over it, A8 F1); a transparent button over the
//     front turns it, and the action bar's "Turn over" does the same. The turn is 340 ms; reduced motion cross-fades.
//   - stamp: null | { text, bad } for the line under the card ("In Revise", "Not kept. Try again.").
import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { CardSource, NcertText } from '@/components/keycards/KeyCard';
import { cardFace, splitBlanks, sourceLine } from '@/components/keycards/kinds';
import { BookmarkFill } from './Stage';
import { backSize, frontSize, speakable } from './stageText.mjs';

function Front({ text }) {
  return splitBlanks(text).map((p, i) => (p.blank
    ? <span key={i} className="kc-gap" role="img" aria-label="blank" />
    : <span key={i} style={{ display: 'inline' }}>{p.text}</span>));
}

/** Watches a scroll box: `more` while content is below its foot. */
function useMore(ref, on) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !on) return undefined;
    const read = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    const frame = requestAnimationFrame(read);
    el.addEventListener('scroll', read, { passive: true });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el); }
    return () => { cancelAnimationFrame(frame); el.removeEventListener('scroll', read); ro?.disconnect(); };
  }, [ref, on]);
  return on && more;
}

export function CardFace({ card, turned = false, onTurn, refEl, stamp = null, extraKind = null }) {
  const { label, front } = cardFace(card);
  const source = sourceLine(card?.source);
  const backRef = useRef(null);
  const frontRef = useRef(null);
  const backMore = useMore(backRef, turned);
  const frontMore = useMore(frontRef, !turned);
  const id = useId();
  const kind = (
    <p className="st-kind">
      <span>{label}</span>
      {extraKind ? <span>{extraKind}</span> : null}
    </p>
  );
  return (
    <div className="st-cardbox">
      <div className="st-card" data-turned={turned || undefined} ref={refEl}>
        <div className="st-face st-face--front" ref={frontRef} aria-hidden={turned || undefined} inert={turned || undefined} data-more={frontMore || undefined}>
          {kind}
          <h2 className="st-front" data-size={frontSize(front)} id={`${id}-f`}><span><Front text={front} /></span></h2>
          {source ? <p className="st-foot"><BookOpen size={14} strokeWidth={2} aria-hidden="true" />{source}</p> : null}
          <span className="st-fade" aria-hidden="true" />
          <button type="button" className="st-card__hit" onClick={onTurn} aria-label={`Turn over: ${speakable(front)}`} aria-describedby={`${id}-f`} />
        </div>
        <div className="st-face st-face--back" ref={backRef} aria-hidden={!turned || undefined} inert={!turned || undefined}
          tabIndex={turned && backMore ? 0 : -1} role="region" aria-label="NCERT's line" data-more={backMore || undefined}
          onClick={(e) => { if (e.target.closest('a, button')) return; if (window.getSelection?.()?.toString()) return; onTurn?.(); }}>
          {kind}
          <p className="st-asked">{speakable(front).length ? <Front text={front} /> : null}</p>
          <div className="st-back" data-size={backSize(card?.back)}>
            <NcertText card={card} />
            <CardSource card={card} />
          </div>
          <div className="st-backfoot"><button type="button" className="st-textkey" onClick={(e) => { e.stopPropagation(); onTurn?.(); }}>Turn back</button></div>
          <span className="st-fade" aria-hidden="true" />
        </div>
      </div>
      <p className="st-stamp" data-bad={stamp?.bad || undefined} role={stamp?.bad ? 'alert' : undefined}>
        {stamp?.text ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} key={stamp.text}>{stamp.bad ? null : <BookmarkFill />}{stamp.text}</span> : null}
      </p>
    </div>
  );
}
