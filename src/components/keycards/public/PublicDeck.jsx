'use client';
// One chapter's free Key cards on the public site (/key-cards/<subject>/<chapter>). The card is the app's own: Learn's CardFace
// (src/components/learn2/stage/CardFace.jsx, the index card a student studies with, built on KeyCard.jsx's NcertText and
// CardSource and TexHtml for typeset formulas), with its turn, its paper and its reduced-motion cross-fade, unchanged.
//   - Every free card is in the server's HTML, front and back (CardFace draws both faces), stacked in one grid cell: the deck
//     is as tall as its tallest card from the first paint, so nothing below it moves when a card turns or the next one comes.
//   - "2 of 5" over the deck with the stage's ticks; Previous (quiet) beside it; one volt key under the card: Turn over, then
//     Next card, then Finish. A tap on the card turns it too (CardFace's own hit area); the back has "Turn back".
//   - After the last card: what the chapter still holds (the locked cards' kinds and their count, never their words) and ONE
//     volt key, "Sign up free to keep these cards", to the sign-up page with this chapter's deck in the app as `next`
//     (a signed-in visitor gets "Open this chapter in Key cards" instead).
//   - Nothing is saved and nothing is sent: a visitor's place lives in this component's state only. No rating, no schedule.
//   - Keyboard: every control is a button; Left and Right step through the cards while focus is in the deck. Focus follows the
//     card for a keyboard or screen-reader user (a turned face goes inert, so focus moves to the volt key). "Card 2 of 5" is
//     announced politely.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { CardFace } from '@/components/learn2/stage/CardFace';
import { isChemistry } from '@/components/learn2/stage/sciText.mjs';
import { ncertFont } from '@/components/keycards/ncertFont';
import { DECK_WORDS as W, cardOf, endLead, endTitle, lockedHead } from './publicDeckCopy.mjs';
import '@/components/keycards/keycards.css';
import '@/components/learn2/stage/stage.css';
import './public-deck.css';

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export default function PublicDeck({ cards = [], title = '', total = 0, locked = [], lockedCount = 0, signupHref = '/signup', appHref = '/cards' }) {
  const n = cards.length;
  const [at, setAt] = useState(0); // the card shown; n is the end
  const [turned, setTurned] = useState(() => cards.map(() => false));
  const [moved, setMoved] = useState(false); // no entrance on the first paint: the first card is simply there
  const { isAuthenticated } = useAuth();
  const headingId = useId();
  const root = useRef(null);
  const primary = useRef(null);
  const endHead = useRef(null);
  const slot = useRef(null);
  const keys = useRef(null);
  const focusTo = useRef(null); // 'primary' | 'end' | null, applied once the change is drawn
  const [float, setFloat] = useState(false);

  const done = at >= n;
  const isTurned = !done && turned[at];
  const holdsFocus = () => typeof document !== 'undefined' && Boolean(root.current?.contains(document.activeElement));

  // Phones: the key's bar at the screen's foot shows while a card is on screen and the key under it is below the fold.
  useEffect(() => {
    if (done) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const k = keys.current?.getBoundingClientRect();
      const s = slot.current?.getBoundingClientRect();
      if (!k || !s) return;
      const vh = window.innerHeight;
      setFloat(k.top > vh - 8 && s.top < vh - 160 && s.bottom > 120);
    };
    const later = () => { if (!raf) raf = requestAnimationFrame(measure); };
    later();
    window.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    return () => { window.removeEventListener('scroll', later); window.removeEventListener('resize', later); if (raf) cancelAnimationFrame(raf); };
  }, [done, at]);

  useEffect(() => {
    const want = focusTo.current;
    if (!want) return;
    focusTo.current = null;
    (want === 'end' ? endHead.current : primary.current)?.focus({ preventScroll: true });
  }, [at, turned]);

  const turn = useCallback((i) => {
    if (holdsFocus()) focusTo.current = 'primary';
    setTurned((list) => list.map((v, j) => (j === i ? !v : v)));
  }, []);

  const goTo = useCallback((i) => {
    const next = Math.max(0, Math.min(n, i));
    if (next === at) return;
    if (holdsFocus()) focusTo.current = next >= n ? 'end' : 'primary';
    setMoved(true);
    setAt(next);
  }, [at, n]);

  const onPrimary = () => {
    if (done) return;
    if (!turned[at]) turn(at);
    else goTo(at + 1);
  };

  const again = () => {
    if (holdsFocus()) focusTo.current = 'primary';
    setTurned(cards.map(() => false));
    setMoved(true);
    setAt(0);
  };

  const onKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    if (e.key === 'ArrowRight' && !done) { e.preventDefault(); goTo(at + 1); }
    else if (e.key === 'ArrowLeft' && at > 0) { e.preventDefault(); goTo(at - 1); }
  };

  if (!n) return null;

  const label = !isTurned ? W.turnOver : at === n - 1 ? W.finish : W.next;
  const said = done ? endTitle(n) : `${cardOf(at + 1, n)}${isTurned ? `. ${W.turned}.` : ''}`;
  const signedIn = Boolean(isAuthenticated);

  return (
    // Left and Right step through the deck while focus is inside it; every step is also a button.
    <section ref={root} className={`kcp kc ${ncertFont.variable}`} aria-labelledby={headingId} onKeyDown={onKeyDown} data-moved={moved || undefined} data-done={done || undefined}>
      <h2 className="sr-only" id={headingId}>{n === 1 ? `The free card from ${title}` : `The ${n} free cards from ${title}`}</h2>
      <p className="sr-only" aria-live="polite">{said}</p>

      <div className="kcp-top">
        <p className="kcp-pos" aria-hidden="true"><b>{Math.min(at + 1, n)}</b> of {n}</p>
        <button type="button" className="kc-btn kc-btn--quiet kcp-prev" onClick={() => goTo(at - 1)} disabled={at === 0} data-hide={at === 0 || undefined}>
          {W.previous}
        </button>
      </div>
      <div className="st-ticks kcp-ticks" aria-hidden="true">
        {cards.map((c, i) => <span key={c.id} className="st-seg" data-state={i < at || done ? 'done' : i === at ? 'now' : undefined}><i /></span>)}
      </div>

      <div className="kcp-slot" ref={slot}>
        {cards.map((card, i) => (
          <div key={card.id} className="kcp-card" data-now={(!done && i === at) || undefined} inert={done || i !== at || undefined} aria-hidden={done || i !== at || undefined}>
            <CardFace card={card} turned={turned[i]} onTurn={() => turn(i)} sci={isChemistry(card)} html={card.texHtml?.front || null} />
          </div>
        ))}
        {done ? (
          <div className="kcp-end">
            <h3 className="kcp-end__title" ref={endHead} tabIndex={-1}>{endTitle(n)}</h3>
            {lockedCount > 0 ? (
              <div className="kcp-end__locked">
                <p className="kcp-end__head"><Lock size={15} strokeWidth={2.2} aria-hidden="true" />{lockedHead(lockedCount)}</p>
                <ul className="kcp-kinds">
                  {locked.map((k) => <li key={k.kind}><span>{k.label}</span><b>{k.count}</b></li>)}
                </ul>
              </div>
            ) : null}
            <p className="kcp-end__lead">{endLead({ open: n, total, signedIn })}</p>
            <div className="kcp-end__keys">
              <Link href={signedIn ? appHref : signupHref} className="kc-btn kc-btn--volt kcp-end__go">{signedIn ? W.openApp : W.keepFree}</Link>
              <button type="button" className="kc-btn kc-btn--quiet" onClick={again}>{W.again}</button>
            </div>
          </div>
        ) : null}
      </div>

      {done ? null : (
        <div className="kcp-keys" ref={keys}>
          <button ref={primary} type="button" className="kc-btn kc-btn--volt kcp-primary" onClick={onPrimary}>{label}</button>
        </div>
      )}
      {/* The same key for a thumb (phones only, CSS): hidden from the keyboard and screen readers, who have the one above. */}
      {done ? null : (
        <div className="kcp-float" data-show={float || undefined} aria-hidden="true">
          <button type="button" tabIndex={-1} className="kc-btn kc-btn--volt kcp-primary" onPointerDown={(e) => e.preventDefault()} onClick={onPrimary}>{label}</button>
        </div>
      )}
    </section>
  );
}
