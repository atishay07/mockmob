"use client";

// THE TOUR AS A DECK (18 Nov 2026). "More inside MockMob" is one pile of cards that the reader's own scroll deals.
//
// The owner, 18 Nov, of the sideways row of cards a finger had since 17 Nov: "we had a thing like the mistake lab, in which
// we had animated cards and scroll animation on them. Now we have these sliding cards, which are not good. They have no
// animation ... If they are touch-responsive, no one will be able to understand that they have to touch it." So the tour
// is a held story again, on every pointer, exactly as the Mistake Lab above it is (ScrollStory: the stage is sticky, a
// finger's scroll is the browser's own and settles on a tool, a mouse moves one tool a gesture), and nothing in it needs a
// sideways swipe or a tap to be seen:
//
//   THE PILE   Every tool is one card. The card on show lies on top; the tools already passed sit under it and show their
//              top edges, a step higher and a little smaller each, so the pile reads as a pile. The next tool's card rises
//              from the pile's foot over the one on show, following the scroll itself (a finger's drag moves it one to
//              one; a mouse's step eases it over about 400 ms), and lies flat as it lands. Only transform and opacity move,
//              one write per card per frame, and only while the page is moving through the tour.
//   THE SCREEN As a tool's card comes on, its product screen plays its short demo once (TourScreens: the rows line up, the
//              pick appears, the bars sweep) and rests. A reader may still tap a screen; nothing asks them to.
//   THE TABS   Five still tabs over the pile. The mark under them slides with the scroll, so the row always says where
//              the reader is; a tab moves the page to its tool.
//
// Reduced motion: the pile keeps its shape and the cards change without travel; no demo plays. Without script or
// IntersectionObserver the cards are a plain list, one under the other (r18-tour-deck.css).
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { DemoPlaybackContext, TOUR_SCREENS } from './TourScreens';
import ScrollStory from './ScrollStory';
import * as bus from './scrollBus.mjs';
import { deckPose, deckProgress, DECK_TAU } from './deckMotion.mjs';

const RAIL_ICON = 32;
function RailIcon({ name }) {
  if (typeof name !== 'string') return name;
  if (name === 'bell') {
    // eslint-disable-next-line @next/next/no-img-element -- a 10 KB pre-sized webp, no optimizer round trip for a 32 px mark
    return <img className="td__bell" src="/brand/mascot/ask-deskbell.webp" width={RAIL_ICON} height={29} alt="" decoding="async" loading="eager" fetchPriority="low" draggable={false} />;
  }
  return <BrandIcon name={name} size={RAIL_ICON} loading="eager" fetchPriority="low" />;
}

// A two-sentence title breaks between its sentences, never inside one.
function Sentences({ text }) {
  const parts = String(text).split(/(?<=[.?!])\s+(?=\S)/);
  if (parts.length < 2) return text;
  return parts.map((part, i) => <Fragment key={i}>{i ? ' ' : null}<span className="td__sentence">{part}</span></Fragment>);
}

// One tool's screen: mounted for the life of the deck, told when it is on stage (its demo restarts itself each time its
// card comes on: TourScreens useSequence). Memoised with its own context value, so a step re-renders two screens, not five.
const DeckScreen = memo(function DeckScreen({ Screen, active, reduced, play, epoch, sample }) {
  const value = useMemo(() => ({ active, reduced, paused: false, epoch, held: true }), [active, reduced, epoch]);
  return <DemoPlaybackContext.Provider value={value}><Screen play={play} sample={sample} /></DemoPlaybackContext.Provider>;
});

function Deck({ slides, step, seq = 0, pinned, reduced, live, flow, goTo, samples }) {
  const rootRef = useRef(null);
  const pileRef = useRef(null);
  const inkRef = useRef(null);
  const [pageVisible, setPageVisible] = useState(true);
  const count = slides.length;
  const active = Math.min(step, count - 1);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // THE PILE FOLLOWS THE SCROLL. One read of the track's place per moved frame (the page's shared scroll read), eased
  // toward by a short time constant, then one transform and one opacity write per card. The loop sleeps as soon as the
  // pile has caught up, and listens only while the tour is within a screen of the window.
  useEffect(() => {
    const root = rootRef.current;
    const pile = pileRef.current;
    const track = root?.closest('.ss__track');
    const stage = root?.closest('.ss__stage');
    if (!pinned || !pile || !track || !stage) return undefined;
    const cards = [...pile.children];
    const shades = cards.map((card) => card.querySelector('.td__shade'));
    const ink = inkRef.current;
    let peek = 12;
    let hold = 1;
    let target = 0;
    let shown = 0;
    let frame = 0;
    let last = 0;
    const tau = reduced ? 0 : flow ? DECK_TAU.touch : DECK_TAU.mouse;

    const paint = (p) => {
      for (let i = 0; i < cards.length; i += 1) {
        const pose = deckPose(p - i, { peek, reduced });
        const card = cards[i];
        card.style.transform = pose.transform;
        card.style.opacity = pose.opacity;
        card.style.visibility = pose.hidden ? 'hidden' : 'visible';
        if (shades[i]) shades[i].style.opacity = pose.shade;
      }
      if (ink) ink.style.transform = `translate3d(${(p * 100).toFixed(2)}%, 0, 0)`;
    };
    const tick = (now) => {
      frame = 0;
      const dt = Math.min(64, Math.max(1, now - last));
      last = now;
      const k = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
      shown += (target - shown) * k;
      if (Math.abs(target - shown) < 0.002) shown = target;
      paint(shown);
      if (shown !== target) frame = window.requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame && shown !== target) { last = performance.now(); frame = window.requestAnimationFrame(tick); } };
    const measure = () => {
      hold = Math.max(1, track.offsetHeight - stage.offsetHeight);
      peek = parseFloat(getComputedStyle(pile).getPropertyValue('--td-peek')) || 12;
    };
    const read = () => {
      target = deckProgress(-track.getBoundingClientRect().top, hold, count, reduced);
      wake();
    };
    // The deck is measured and posed the first time it comes near the screen, never as the page wakes (owner LK326, 19 Nov
    // 2026). Its section is skipped by the browser until then (content-visibility), and asking a skipped section for a
    // height makes the browser lay the whole of it out on the spot: profiled, that one read was the hottest function of
    // ours at load, inside the single task that froze the page. The observer's report comes after the browser's own
    // layout, so the read is free there; the first report also snaps the pile to where the page already is.
    let posed = false;
    const arrive = () => {
      measure();
      read();
      if (!posed) { posed = true; shown = target; window.cancelAnimationFrame(frame); frame = 0; paint(shown); }
    };

    let off = null;
    const listen = (on) => {
      if (on && !off) off = bus.subscribe((s) => { if (s.resized) measure(); read(); });
      else if (!on && off) { off(); off = null; }
    };
    const near = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => { const on = entries[entries.length - 1].isIntersecting; listen(on); if (on) arrive(); }, { rootMargin: '100% 0px 100% 0px', threshold: 0 })
      : null;
    if (near) near.observe(track); else { arrive(); listen(true); }
    return () => {
      near?.disconnect();
      listen(false);
      window.cancelAnimationFrame(frame);
      for (const card of cards) { card.style.transform = ''; card.style.opacity = ''; card.style.visibility = ''; }
      for (const shade of shades) if (shade) shade.style.opacity = '';
      if (ink) ink.style.transform = '';
    };
  }, [pinned, reduced, flow, count]);

  // A demo plays while its card is on show, the tour is on screen and the page is in front; never under reduced motion.
  const running = live && pageVisible && !reduced && pinned;

  return (
    <div className="td" ref={rootRef} role="region" aria-roledescription="carousel" aria-label="Explore MockMob features" data-ss-end="">
      <ol className="td__tabs" aria-label="Feature chapters" style={{ '--td-n': count }}>
        <li className="td__ink" aria-hidden="true" ref={inkRef}><i /></li>
        {slides.map((slide, i) => (
          <li key={slide.id} className="td__tab-cell">
            <button type="button" className="td__tab" data-on={active === i ? 'true' : 'false'} aria-current={active === i ? 'step' : undefined} onClick={(event) => goTo(i, { instant: event.detail === 0 })}>
              <span className="td__ico" aria-hidden="true"><RailIcon name={slide.icon} /></span>
              <span className="td__word" data-long={slide.tab ? '' : undefined}>{slide.label}</span>
              {slide.tab ? <span className="td__word" data-short="">{slide.tab}</span> : null}
            </button>
          </li>
        ))}
      </ol>

      <div className="td__pile" ref={pileRef}>
        {slides.map((slide, i) => {
          const Screen = TOUR_SCREENS[slide.id];
          const on = pinned ? active === i : true;
          return (
            <article key={slide.id} className="td__card" data-ss-step={i} data-on={on ? 'true' : 'false'} aria-hidden={pinned && !on ? true : undefined} inert={pinned && !on ? true : undefined} aria-label={`${i + 1} of ${count}: ${slide.label}`}>
              <div className="td__copy">
                <h3 className="td__title"><Sentences text={slide.title} /></h3>
                <p className="td__body">{slide.body}</p>
                <p className="td__lede">{slide.lede || slide.line}</p>
                <p className="lp-sr">{slide.chip}</p>
                {slide.points?.length ? <ul className="td__points">{slide.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
                <Link href={slide.href} className="lp-link td__cta td__cta--wide">{slide.cta}</Link>
              </div>
              <div className="td__shot" data-cursor={on ? "Try it" : undefined}>
                <div className="td__room">
                  <div className="td__fit" data-ss-fit="0.62">
                    {Screen ? <DeckScreen Screen={Screen} active={on} reduced={reduced || !pinned} play={on && running} epoch={on ? seq : -1} sample={samples?.[slide.id] ?? null} /> : null}
                  </div>
                </div>
              </div>
              <Link href={slide.href} className="lp-link td__cta td__cta--phone">{slide.cta}</Link>
              <i className="td__shade" aria-hidden="true" />
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function TourDeck({ slides = [], samples = null }) {
  return <ScrollStory steps={slides.length} className="td-story" label="What is inside MockMob, tool by tool" Content={Deck} slides={slides} samples={samples} />;
}
