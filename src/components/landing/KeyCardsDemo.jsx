'use client';
// Key cards on the home page (R3-D10, owner LK112, 5 Nov 2026; research preparoo B7). Five real cards from the app's decks
// (keyCardsPicks.mjs reads them on the server and hands them in), played the way the app plays them: read the front, turn the
// card over (a 3D flip: 600 ms on cubic-bezier(.4,0,.2,1), perspective 1000 px, backface hidden; reduced motion fades), then
// rate it with the app's keys, each saying when the card would come back (FSRS, the app's words). The front is glass over the
// card's own subject object in its subject light (the brand art); the back is plain paper with the book line, as in the app.
// "1 / 5" with a progress bar above, dots below. After the fifth, an end card counts the ratings into "back tomorrow" rows,
// and the one key under the demo, "Sign up free to keep going", becomes the volt key (one volt key in view at a time).
// Nothing is saved: a guest's ratings stay on this page. A signed-in student gets "Open Key cards" and no upsell line.
//
// Renders two grid items (the demo and its foot) into page.js's section grid: the head is the page's own.
import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { isMotionReduced } from '@/lib/motion/draw';
import { wayIn } from './demoSignal.mjs';
import { CountUp, staggerStyle } from './LoadingKit';
import { BANK_WORDS, KEY_CARDS_WORDS as W, backRow, cardOf } from './keyCardsCopy.mjs';
import './key-cards.css';

const LEAVE_MS = 180; // the rated card steps aside before the next one rises in
const CARDS_ART = '/art/icons/keycards-192.webp'; // the Key cards desk object, beside the end card's title

// Is the keyboard (or a screen reader) inside the demo? Then focus follows the card; a pointer user's focus stays put.
const holdsFocus = (node) => typeof document !== 'undefined' && Boolean(node?.contains(document.activeElement));

// A front's blank ("____" in the deck) drawn as a short ruled gap, as the app draws it, and read as "blank".
function Gapped({ text }) {
  return String(text).split(/(_{3,})/).map((part, i) => (/^_{3,}$/.test(part)
    ? <span key={i} className="kc-demo__gap" role="img" aria-label="blank" />
    : <Fragment key={i}>{part}</Fragment>));
}

function Art({ art, className = 'kc-demo__art', sizes = '(max-width: 959px) 62vw, 300px' }) {
  if (!art) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized webp set (data/subject_art.mjs), no optimizer round trip
    <img className={className} src={art.src} srcSet={art.srcSet} sizes={sizes} width={art.width} height={art.height}
      alt="" decoding="async" loading="lazy" draggable={false} />
  );
}

export default function KeyCardsDemo({ cards = [], keys = [], bank = null }) {
  const total = cards.length;
  const [at, setAt] = useState(0);
  const [turned, setTurned] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [ratings, setRatings] = useState([]);
  const { isAuthenticated } = useAuth();
  const way = wayIn({ signedIn: isAuthenticated, released: recoveryReleased() });
  const promptId = useId();

  const root = useRef(null);
  const answer = useRef(null);
  const turnKey = useRef(null);
  const endTitle = useRef(null);
  const timer = useRef(0);
  const focusAfter = useRef(null); // 'answer' | 'next' | null: where focus goes once the change is drawn (keyboard users only)

  const done = at >= total;
  const card = done ? null : cards[at];
  const shown = done ? total : at + 1;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Focus follows the card for a keyboard or screen-reader user (a pointer user's focus is left where it was).
  useEffect(() => {
    const want = focusAfter.current;
    if (!want) return;
    focusAfter.current = null;
    const target = want === 'answer' ? answer.current : done ? endTitle.current : turnKey.current;
    target?.focus({ preventScroll: true });
  }, [turned, at, done]);

  const turn = useCallback(() => {
    if (turned || leaving || done) return;
    if (holdsFocus(root.current)) focusAfter.current = 'answer';
    setTurned(true);
  }, [turned, leaving, done]);

  const rate = useCallback((rating) => {
    if (!turned || leaving || done) return;
    const keep = holdsFocus(root.current);
    setRatings((list) => [...list, rating]);
    const next = () => {
      if (keep) focusAfter.current = 'next';
      setAt((n) => n + 1);
      setTurned(false);
      setLeaving(false);
    };
    if (isMotionReduced()) { next(); return; }
    setLeaving(true);
    timer.current = window.setTimeout(next, LEAVE_MS);
  }, [turned, leaving, done]);

  const again = useCallback(() => {
    if (holdsFocus(root.current)) focusAfter.current = 'next';
    setRatings([]);
    setTurned(false);
    setLeaving(false);
    setAt(0);
  }, []);

  if (!total) return null;

  const rows = keys.map((key) => ({ ...key, count: ratings.filter((r) => r === key.rating).length })).filter((key) => key.count > 0);
  // The other subjects' art, fetched quietly ahead (lazy, off screen), so the next card's object is there when it rises.
  const ahead = [...new Map(cards.filter((c) => c.art && c.art.src !== card?.art?.src).map((c) => [c.art.src, c.art])).values()];

  return (
    <>
      <div className="kc-demo" ref={root}>
        <div className="kc-demo__top">
          <p className="kc-demo__count" aria-live="polite">
            <span aria-hidden="true">{shown} / {total}</span>
            <span className="kc-demo__sr">{cardOf(shown, total)}</span>
          </p>
          <span className="kc-demo__bar" aria-hidden="true"><span style={{ transform: `scaleX(${shown / total})` }} /></span>
        </div>

        <div className="kc-demo__scene" data-leave={leaving || undefined}>
          {card ? (
            <div key={`${card.id}-${at}`} className="kc-demo__arrive">
              <div className="kc-demo__card" data-turned={turned || undefined} data-subject={card.subject}
                style={card.art ? { '--kc-light-n': card.art.light.night, '--kc-light-d': card.art.light.day } : undefined}
                onClick={(e) => { if (!turned && !e.target.closest('button, a')) turn(); }}>
                <div className="kc-demo__face kc-demo__face--front" aria-hidden={turned || undefined}>
                  <Art art={card.art} />
                  <div className="kc-demo__glass">
                    <p className="kc-demo__head"><b>{card.subjectName}</b><span>{card.label}</span></p>
                    <p className="kc-demo__prompt" id={promptId}><Gapped text={card.front} /></p>
                    <p className="kc-demo__cue"><RotateCw size={14} strokeWidth={2.2} aria-hidden="true" />{W.turnCue}</p>
                  </div>
                </div>
                <div className="kc-demo__face kc-demo__face--back" aria-hidden={turned ? undefined : true}>
                  <p className="kc-demo__head"><b>{card.subjectName}</b><span>{card.label}</span></p>
                  <p className="kc-demo__asked"><Gapped text={card.front} /></p>
                  <p className="kc-demo__answer" ref={answer} tabIndex={-1}>{card.back}</p>
                  {card.note ? <p className="kc-demo__note">{card.noteLabel ? <b>{card.noteLabel}</b> : null}{card.note}</p> : null}
                  <p className="kc-demo__foot">
                    {card.source ? <span>{card.source}</span> : <span />}
                    {card.must ? <span className="kc-demo__must">{W.mustKnow}</span> : null}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div key="end" className="kc-demo__arrive">
              <div className="kc-demo__card kc-demo__card--end">
                <div className="kc-demo__face kc-demo__face--end">
                  <div className="kc-demo__end-head">
                    <p className="kc-demo__prompt" ref={endTitle} tabIndex={-1}>{W.doneTitle}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the 192 px Key cards icon file, drawn at 64 px */}
                    <img className="kc-demo__end-art" src={CARDS_ART} width={192} height={192} alt="" decoding="async" loading="lazy" draggable={false} />
                  </div>
                  <p className="kc-demo__lead">{isAuthenticated ? W.doneStudent : W.doneGuest}</p>
                  <ul className="kc-demo__rows lk-stagger">
                    {rows.map((row, i) => (
                      <li key={row.rating} style={staggerStyle(i)}><b>{row.label}</b><span>{backRow(row.count, row.when)}</span></li>
                    ))}
                  </ul>
                  <button type="button" className="kc-demo__again" onClick={again}>{W.again}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <ol className="kc-demo__pips" aria-hidden="true">
          {cards.map((c, i) => <li key={c.id} data-state={i < at ? 'done' : i === at ? 'now' : 'next'} />)}
        </ol>

        <div className="kc-demo__keys" data-show={done ? 'none' : turned ? 'rate' : 'turn'}>
          {done ? null : turned ? (
            <div className="kc-demo__rates" role="group" aria-label={W.ratingsLabel}>
              {keys.map((key) => (
                <button key={key.rating} type="button" className="kc-demo__rate" data-rating={key.rating} disabled={leaving} onClick={() => rate(key.rating)}>
                  <span className="kc-demo__rate-name">{key.label}</span>
                  <span className="kc-demo__rate-when">{key.when}</span>
                </button>
              ))}
            </div>
          ) : (
            <button type="button" ref={turnKey} className="mm-btn mm-btn--primary kc-demo__turn" onClick={turn} aria-describedby={promptId}>
              {W.turnOver}
            </button>
          )}
        </div>

        <span className="kc-demo__ahead" aria-hidden="true">
          {ahead.map((art) => <Art key={art.src} art={art} className="kc-demo__ahead-img" />)}
        </span>
      </div>

      <div className="kc-foot">
        {bank ? (
          <>
            <p className="kc-foot__bank">
              <b><CountUp value={bank.cards} /></b>{BANK_WORDS.across}<b><CountUp value={bank.subjects} /></b>{BANK_WORDS.subjects}
            </p>
            {isAuthenticated ? null : <p className="kc-foot__free">{BANK_WORDS.free(bank.taste)}</p>}
          </>
        ) : null}
        <Link href={isAuthenticated ? '/cards' : way.signup.href} className={done ? 'mm-btn mm-btn--primary' : 'mm-btn mm-btn--secondary'}>
          {isAuthenticated ? W.openCards : W.keepGoing}
        </Link>
      </div>
    </>
  );
}
