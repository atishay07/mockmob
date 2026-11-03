'use client';
// A Key card on the study stage (BUILD-1101 B1, A1 3.4, A8 3.2): it fits its words.
//   <CardFace card turned onTurn mustKnow refEl stamp extraKind html />
//   - Both faces sit in one grid cell, so the card takes the taller face's height and the turn never jumps; at least the
//     band's min-height (phone clamp(300px, 46dvh, 380px), tablet 340, desktop 360/340/300 by height), at most the item area
//     minus the stamp line. A face taller than that scrolls inside, with a fade at its foot while more is below (A8 F5).
//   - R3-SPEC L1: the kind line top-left (the menu top-right), the source pinned to the foot, the words centred between them
//     (auto margins: a face that does not fit is top-aligned and scrolls inside the card). Front sizes by length, phone 34 /
//     28 / 22 px, desktop 40 / 32 / 26 (60, 140, longer), line-height 1.15, balanced, no hyphen the card did not have.
//   - Front: the kind line, the prompt sized by its length (s/m/l), and the source at the foot. No Must-know tag here:
//     feeds and runs serve Must-know cards first, so it would sit on nearly every card (LK13; it stays in the Cards view).
//   - Back: the kind line, the prompt repeated small (so a turned card still says what was asked), NCERT's line, the source,
//     and a "Turn back" text key.
//   - The card's content stays readable to a screen reader (no role=button over it, A8 F1); a transparent button over the
//     front turns it, and the action bar's "Turn over" does the same. The turn is 340 ms; reduced motion cross-fades.
//   - stamp: null | { text, bad } for the line under the card ("In Revise" with a check, once the server has it).
//   - html: a typeset front (card.texHtml.front, mathematics and physics), drawn in the same element; the size and the spoken
//     label still come from the plain front.
//   - R6 Web D: the kind is a tab in its family's colour hanging from the card's top edge (kinds.js kindFamily, keycards.css),
//     the card's top hairline takes a trace of that colour, and the source is a quiet footer under a hairline.
//   - R8 (3 Nov, the owner's phone): an index card from a deck. Warm paper in Day, neutral charcoal in Night; the kind is a
//     header band across the card's top in its family's wash (stage.css); the back's words sit on faint ruled lines at the
//     reading pitch (the backblock's data-size picks the pitch); the feed's peek is the deck (the next card's band).
//   - sci: a chemistry card draws its front and back with real subscripts and superscripts (Sci.jsx; display only, R4).
import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { CardSource, NcertText } from '@/components/keycards/KeyCard';
import { TexHtml } from '@/components/keycards/TexHtml';
import { blankRuns, gapClass, cardFace, kindFamily, sourceLine } from '@/components/keycards/kinds';
import { backSize, frontSize, speakable } from './stageText.mjs';
import { SciFront, SciNcert } from './Sci';

function Front({ text, html = null }) {
  if (html) return <TexHtml html={html} />;
  return blankRuns(text).map((p, i) => (p.blank
    ? <span key={i} className="kc-gaprun">{p.lead}<span className={gapClass(p)} role="img" aria-label="blank" />{p.tail}</span>
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

export function CardFace({ card, turned = false, onTurn, refEl, stamp = null, extraKind = null, sci = false, html = null }) {
  const FrontText = sci ? SciFront : Front;
  const { label, front } = cardFace(card);
  const source = sourceLine(card?.source);
  const backRef = useRef(null);
  const frontRef = useRef(null);
  const backMore = useMore(backRef, turned);
  const frontMore = useMore(frontRef, !turned);
  const id = useId();
  const kind = (
    <p className="st-kind">
      <span className="kc-famtab">{label}</span>
      {extraKind ? <span className="st-kind__extra">{extraKind}</span> : null}
    </p>
  );
  return (
    <div className="st-cardbox" data-family={kindFamily(card?.kind)}>
      <div className="st-card" data-turned={turned || undefined} ref={refEl}>
        <div className="st-face st-face--front" ref={frontRef} aria-hidden={turned || undefined} inert={turned || undefined} data-more={frontMore || undefined}>
          {kind}
          <h2 className="st-front" data-size={frontSize(front)} id={`${id}-f`}><span><FrontText text={front} html={html} /></span></h2>
          {source ? <p className="st-foot"><BookOpen size={14} strokeWidth={2} aria-hidden="true" />{source}</p> : null}
          <span className="st-fade" aria-hidden="true" />
          <button type="button" className="st-card__hit" onClick={onTurn} aria-label={`Turn over: ${speakable(front)}`} aria-describedby={`${id}-f`} />
        </div>
        <div className="st-face st-face--back" ref={backRef} aria-hidden={!turned || undefined} inert={!turned || undefined}
          tabIndex={turned && backMore ? 0 : -1} role="region" aria-label="NCERT's line" data-more={backMore || undefined}
          onClick={(e) => { if (e.target.closest('a, button')) return; if (window.getSelection?.()?.toString()) return; onTurn?.(); }}>
          {kind}
          <div className="st-backblock" data-size={backSize(card?.back)}>
            <p className="st-asked">{speakable(front).length ? <FrontText text={front} html={html} /> : null}</p>
            <div className="st-back" data-size={backSize(card?.back)}>
              {sci ? <SciNcert card={card} /> : <NcertText card={card} />}
              <CardSource card={card} />
            </div>
          </div>
          <div className="st-backfoot"><button type="button" className="st-textkey" onClick={(e) => { e.stopPropagation(); onTurn?.(); }}>Turn back</button></div>
          <span className="st-fade" aria-hidden="true" />
        </div>
      </div>
      <p className="st-stamp" data-bad={stamp?.bad || undefined} role={stamp?.bad ? 'alert' : undefined}>
        {stamp?.text ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} key={stamp.text}>{stamp.bad ? null : <Check size={15} strokeWidth={2.6} aria-hidden="true" />}{stamp.text}</span> : null}
      </p>
    </div>
  );
}
