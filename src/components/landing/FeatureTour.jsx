"use client";

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pause, Play } from 'lucide-react';
import { createDemoPlayback } from '@/../data/demo_playback.mjs';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { DemoPlaybackContext, TOUR_SCREENS } from './TourScreens';
import ScrollStory from './ScrollStory';
import { undrawn } from './undrawn';

export const TOUR_ADVANCE_MS = 4800;

// Phones show one sentence under each tool's title (wide screens show the paragraph and its points), so a phone never says
// less than a laptop. The sentence is the slide's own `lede` (homeCopy.mjs).
// The rail's icons are the lamp-lit desk objects (BrandIcon, LK73), 32 px so the object never turns to mush; Ask Mobi's is the
// brass desk bell. The chevrons and the play control stay plain line icons: controls are the interface's verbs.
// They load eagerly at low priority (R3-D5, LK105): lazy images inside a sideways scroller only start loading as the chip
// row scrolls them in, so on a first visit an icon arrived 24-44 ms after its chip was on screen.
const RAIL_ICON = 32;
function RailIcon({ name }) {
  if (typeof name !== 'string') return name; // a ready-made node (an older caller's line icon) is drawn as given
  if (name === 'bell') {
    // eslint-disable-next-line @next/next/no-img-element -- a 10 KB pre-sized webp, no optimizer round trip for a 32 px mark
    return <img className="ft__bell" src="/brand/mascot/ask-deskbell.webp" width={RAIL_ICON} height={29} alt="" decoding="async" loading="eager" fetchPriority="low" draggable={false} />;
  }
  return <BrandIcon name={name} size={RAIL_ICON} loading="eager" fetchPriority="low" />;
}
// A two-sentence title ("Picking five papers? Test the combination first.") breaks between its sentences, never inside
// one: each sentence is its own inline block (r10-lab-tour.css), so a narrow card wraps at the full stop. A one-sentence
// title is returned as it is.
function Sentences({ text }) {
  const parts = String(text).split(/(?<=[.?!])\s+(?=\S)/);
  if (parts.length < 2) return text;
  return parts.map((part, i) => <Fragment key={i}>{i ? ' ' : null}<span className="ft__sentence">{part}</span></Fragment>);
}

function TourVideo({ slide, playing }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) video.play()?.catch(() => {});
    else video.pause();
    return () => video.pause();
  }, [playing]);
  return <video ref={ref} src={slide.video} poster={slide.poster} muted loop playsInline preload="none" aria-label={slide.videoLabel || slide.title} />;
}

// One tool's product screen. It stays mounted for the life of the tour and restarts its demo itself when its tool comes
// back on stage (TourScreens useSequence), so a step changes a few attributes instead of rebuilding a screen (5 Nov
// perf: the old remount cost about 100 ms a step at 4x CPU). Memoised with its own context value, so a step re-renders
// only the two screens whose state changed. Unheld (the carousel without IntersectionObserver), the active screen is still
// keyed by `visit`, as before, so a chip press restarts its demo. `epoch` is the activation the screen on stage belongs
// to (ScrollStory's step count, R3-D5): off stage every screen gets the same -1, so a step still re-renders only two.
const TourScreen = memo(function TourScreen({ Screen, active, reduced, paused, play, epoch, held }) {
  const value = useMemo(() => ({ active, reduced, paused, epoch, held }), [active, reduced, paused, epoch, held]);
  return <DemoPlaybackContext.Provider value={value}><Screen play={play} /></DemoPlaybackContext.Provider>;
});

// The feature tour holds the screen while the reader's scroll moves through the tools (ScrollStory):
// one tool per beat, its live demo playing while it is on stage, the chapter chips and the progress
// segments following the scroll. Chips, arrows and Next jump the page to that tool's beat, so the
// scroll position and the tool on stage never disagree. Without IntersectionObserver the old
// carousel returns: native swipes, timed autoplay with an explicit Pause, keyboard focus holds it.
function TourStage({ slides, step, seq = 0, pinned, reduced, goTo: storyGoTo }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const navRef = useRef(null);
  const clockRef = useRef(null);
  const progressRef = useRef(null);
  const activeRef = useRef(0);
  const programmaticRef = useRef(false);
  const pointerRef = useRef(null);
  const scrollTimer = useRef(null);
  const [carousel, setCarousel] = useState(0);
  const [visit, setVisit] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [keyboardHold, setKeyboardHold] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const active = pinned ? Math.min(step, slides.length - 1) : carousel;

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const alignSlide = useCallback((index, smooth = false) => {
    const track = trackRef.current;
    const slide = track?.querySelector('[data-index="' + index + '"]');
    if (!track || !slide || undrawn(track) || track.scrollWidth <= track.clientWidth + 2) return;
    programmaticRef.current = true;
    track.scrollTo({ left: slide.offsetLeft, behavior: smooth && !reduced ? 'smooth' : 'auto' });
  }, [reduced]);

  // Keep the current chapter chip centred without moving the document's vertical scroll (the row scrolls
  // itself; instant under reduced motion). The row's edges fade only where more chips wait beyond them.
  const [fade, setFade] = useState('none');
  const chipsRef = useRef(null);
  const chapterRef = useRef(active);
  const railVisible = useRef(false);
  const readFade = useCallback(() => {
    const nav = navRef.current;
    if (!nav || !chipsRef.current) return;
    const { more } = chipsRef.current;
    const start = nav.scrollLeft > 2;
    const end = more > 2 && nav.scrollLeft < more - 2;
    setFade(start && end ? 'both' : start ? 'start' : end ? 'end' : 'none');
  }, []);
  // Where each chip centres, measured when the row or a chip changes size (a ResizeObserver callback, where layout is
  // already clean), never on a step: reading offsetLeft right after a step's commit forced a style and layout pass inside
  // the step's frame (28-34 ms of a 54-73 ms frame at 4x CPU), and the row started moving 128-192 ms late (R3-D5, P2-5).
  const measureChips = useCallback(() => {
    const nav = navRef.current;
    if (!nav || undrawn(nav)) { chipsRef.current = null; return null; }
    const items = [...nav.querySelectorAll('[data-chapter]')];
    chipsRef.current = { more: nav.scrollWidth - nav.clientWidth, at: items.map((item) => item.offsetLeft - (nav.clientWidth - item.offsetWidth) / 2) };
  }, []);
  const alignChapter = useCallback((index, smooth) => {
    const nav = navRef.current;
    const chips = chipsRef.current;
    if (!railVisible.current || !nav || !chips || chips.more <= 2 || !Number.isFinite(chips.at[index])) return;
    nav.scrollTo({ left: chips.at[index], behavior: smooth ? 'smooth' : 'instant' });
  }, []);
  // The step never measures the rail. The old cache-miss fallback forced the off-screen tour to lay out mid-swipe.
  useLayoutEffect(() => {
    chapterRef.current = active;
    if (!railVisible.current) return undefined;
    const frame = requestAnimationFrame(() => alignChapter(active, !reduced));
    return () => cancelAnimationFrame(frame);
  }, [active, reduced, alignChapter]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const read = () => {
      measureChips();
      alignChapter(chapterRef.current, false);
      readFade();
    };
    const view = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      railVisible.current = entry.isIntersecting;
      if (entry.isIntersecting) alignChapter(chapterRef.current, false);
    }) : null;
    railVisible.current = !view;
    view?.observe(nav);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(read) : null;
    observer?.observe(nav);
    nav.querySelectorAll('[data-chapter]').forEach((item) => observer?.observe(item));
    if (!observer) {
      read();
      window.addEventListener('resize', read);
    }
    return () => {
      view?.disconnect();
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', read);
    };
  }, [readFade, measureChips, alignChapter]);

  const goTo = useCallback((index, { scroll = true, keyboard = false } = {}) => {
    if (!slides.length) return;
    // Held, the tour never wraps (R8 SEC-05): a wrap threw the reader about 4,900 px back to the first tool, or on to the
    // last. The first tool's Prev is disabled and the last tool's Next is a link to the next section (below).
    if (pinned) { if (index >= 0 && index < slides.length) storyGoTo(index, { instant: keyboard }); return; }
    const next = (index + slides.length) % slides.length;
    const adjacent = Math.abs(next - activeRef.current) === 1;
    activeRef.current = next;
    setCarousel(next);
    setVisit(value => value + 1);
    setInteracting(false);
    if (scroll) alignSlide(next, adjacent && !keyboard);
  }, [slides.length, alignSlide, pinned, storyGoTo]);

  useEffect(() => {
    const media = trackRef.current?.querySelector('[data-index="' + active + '"] .ft__media');
    if (!media || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting && entry.intersectionRatio >= .3), { threshold: [0, .3] });
    observer.observe(media);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    const track = trackRef.current;
    if (pinned || !track || typeof ResizeObserver === 'undefined') return;
    let width = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width !== width) {
        width = entry.contentRect.width;
        alignSlide(activeRef.current);
      }
    });
    observer.observe(track);
    return () => { observer.disconnect(); window.clearTimeout(scrollTimer.current); };
  }, [alignSlide, pinned]);

  const readSwipe = () => {
    if (pinned || programmaticRef.current) return;
    setInteracting(true);
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      setInteracting(false);
      const track = trackRef.current;
      if (!track || programmaticRef.current) return;
      const items = [...track.querySelectorAll('[data-index]')];
      const nearest = items.reduce((best, item) => Math.abs(item.offsetLeft - track.scrollLeft) < Math.abs(best.offsetLeft - track.scrollLeft) ? item : best, items[0]);
      if (nearest && Number(nearest.dataset.index) !== activeRef.current) goTo(Number(nearest.dataset.index), { scroll: false });
    }, 120);
  };

  // Demos play while their tool is on stage; held, the scroll (not a timer) moves to the next tool.
  const running = playing && !keyboardHold && !interacting && onScreen && pageVisible && !reduced;

  useEffect(() => {
    if (pinned || slides.length < 2) return;
    const clock = createDemoPlayback([{ at: TOUR_ADVANCE_MS, value: (active + 1) % slides.length }], next => goTo(next));
    const progress = progressRef.current?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: TOUR_ADVANCE_MS, fill: 'forwards', easing: 'linear' });
    progress?.pause();
    clockRef.current = { clock, progress };
    return () => { clock.dispose(); progress?.cancel(); clockRef.current = null; };
  }, [active, visit, goTo, slides.length, pinned]);

  useEffect(() => {
    if (running) { clockRef.current?.clock.resume(); clockRef.current?.progress?.play(); }
    else { clockRef.current?.clock.pause(); clockRef.current?.progress?.pause(); }
  }, [running, active, visit]);

  // The section after the tour (the next section with an id, named by its stamp or heading): where the last tool's Next
  // goes while the tour is held, the same place the bottom bar's Skip goes.
  const [after, setAfter] = useState(null);
  useEffect(() => {
    const host = rootRef.current?.closest('section[id]');
    for (let node = host?.nextElementSibling; node; node = node.nextElementSibling) {
      if (!node.id || node.hidden) continue;
      const name = (node.querySelector('.lp-stamp__name') || node.querySelector('h2'))?.textContent?.trim().replace(/\.$/, '');
      if (name) setAfter({ id: node.id, name });
      return;
    }
  }, []);
  const atStart = pinned && active === 0;
  const atEnd = pinned && Boolean(after) && active === slides.length - 1;
  // R8 SEC-05 (revision): at the held tour's ends Next swaps between a button and a link. Keyboard focus follows the key
  // through the swap instead of dropping to <body>; activating the link hands focus to the next section's heading.
  const focusedNext = useRef(null);
  const onNextFocus = useCallback((event) => { focusedNext.current = event.currentTarget; }, []);
  const onNextBlur = useCallback((event) => {
    const el = event.currentTarget;
    if (event.relatedTarget) { focusedNext.current = null; return; }
    // Blur to nowhere: a swap (handled in the layout effect below) or a click on blank page; the latter forgets the key.
    requestAnimationFrame(() => { if (focusedNext.current === el && el.isConnected) focusedNext.current = null; });
  }, []);
  const onAfterLink = useCallback(() => {
    focusedNext.current = null;
    const heading = after && document.getElementById(after.id)?.querySelector('h2');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }, [after]);
  // Only when the focused key itself was swapped out (focus fell to <body>) does it move to the new key.
  useLayoutEffect(() => {
    const was = focusedNext.current;
    if (!was || was.isConnected) return;
    focusedNext.current = null;
    const focused = document.activeElement;
    if (focused && focused !== document.body) return;
    rootRef.current?.querySelector('.ft__next')?.focus({ preventScroll: true });
  }, [atEnd]);

  const paused = !playing || keyboardHold;
  const next = slides[(active + 1) % slides.length];
  const status = reduced ? 'Explore' : paused ? 'Paused' : pinned ? 'Live demo' : 'Autoplay';

  return (
    <div className="ft" ref={rootRef} role="region" aria-roledescription="carousel" aria-label="Explore MockMob features" data-playing={running ? 'true' : 'false'} data-live={onScreen ? 'true' : 'false'} data-keyboard={keyboardHold ? 'true' : 'false'}
      onPointerDownCapture={event => { if (!event.target.closest('.ft__play')) setKeyboardHold(false); }}
      onFocusCapture={event => { if (!pinned && !event.target.closest('.ft__play') && event.target.matches(':focus-visible')) setKeyboardHold(true); }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardHold(false); }}>
      <ul className="ft__list" ref={navRef} aria-label="Feature chapters" data-fade={fade} onScroll={readFade}>
        {slides.map((slide, i) => <li key={slide.id} data-chapter={i}>
          <button type="button" className="ft__row" data-on={active === i ? 'true' : 'false'} aria-current={active === i ? 'step' : undefined} onClick={event => goTo(i, { keyboard: event.detail === 0 })}>
            <span className="ft__ico" aria-hidden="true" style={{ width: RAIL_ICON, height: RAIL_ICON }}><RailIcon name={slide.icon} /></span><span>{slide.label}</span>
          </button>
        </li>)}
      </ul>

      <div className="ft__room">
        <div className="ft__stage" data-ss-fit="0.6" data-ss-end="">
          <div className="ft__chrome">
            <div className="ft__chapter"><span className="lp-sr">{`Feature ${active + 1} of ${slides.length}`}</span><b>{slides[active]?.label}</b></div>
            <span className="ft__status"><i aria-hidden="true" />{status}</span>
            <button type="button" className="ft__play" aria-label={paused ? 'Play the demos' : 'Pause the demos'} disabled={reduced} onClick={() => { setPlaying(paused); setKeyboardHold(false); }}>
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          </div>
          <div className="ft__progress" aria-hidden="true" style={{ gridTemplateColumns: 'repeat(' + slides.length + ', minmax(0, 1fr))' }}>
            {slides.map((slide, i) => <span key={slide.id} data-done={i < active ? 'true' : 'false'}>
              {pinned ? <i className="ss-fill" data-state={i < active ? 'done' : i === active ? 'on' : 'off'} style={{ '--ss-i': i }} /> : i === active ? <i ref={progressRef} key={visit} /> : null}
            </span>)}
          </div>

          <div className="ft__track" ref={trackRef} aria-label="MockMob features" aria-live={paused ? 'polite' : 'off'} onScroll={readSwipe}
            onPointerDown={event => { programmaticRef.current = false; pointerRef.current = { x: event.clientX, y: event.clientY }; }}
            onPointerMove={event => { const start = pointerRef.current; if (!pinned && start && Math.abs(event.clientX - start.x) > 10 && Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y)) setInteracting(true); }}
            onPointerUp={() => { pointerRef.current = null; setInteracting(false); }} onPointerCancel={() => { pointerRef.current = null; setInteracting(false); }}
            onTouchStart={() => { programmaticRef.current = false; }}
            onWheel={event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) programmaticRef.current = false; }}>
            {slides.map((slide, i) => { const Screen = TOUR_SCREENS[slide.id]; const on = active === i; return (
              <div key={slide.id} className="ft__slide" role="group" aria-roledescription="slide" aria-label={(i + 1) + ' of ' + slides.length + ': ' + slide.label} aria-hidden={!on} inert={!on} data-index={i} data-active={on ? 'true' : 'false'} data-past={pinned && i < active ? 'true' : undefined}>
                <article className="ft__card">
                  <div className="ft__media">
                    <div className="ft__shot">
                      {slide.video ? <TourVideo slide={slide} playing={on && running} /> : Screen ? <TourScreen key={pinned || !on ? 'still' : visit} Screen={Screen} active={on} reduced={reduced} paused={paused} play={on && running} epoch={on ? (pinned ? seq : visit) : -1} held={pinned} /> : slide.screen}
                    </div>
                  </div>
                  <div className="ft__copy">
                    <h3 className="ft__title"><Sentences text={slide.title} /></h3>
                    <p className="ft__body">{slide.body}</p>
                    <p className="ft__lede">{slide.lede || slide.line}</p>
                    {/* The slide's one true line (its chip) is for screen readers now: phones read the title and the lede, never a third sentence (LK71). */}
                    <p className="lp-sr">{slide.chip}</p>
                    {slide.points?.length ? <ul className="ft__points">{slide.points.map(point => <li key={point}>{point}</li>)}</ul> : null}
                    <Link href={slide.href} className="lp-link ft__cta">{slide.cta}</Link>
                  </div>
                </article>
              </div>
            ); })}
          </div>

          <div className="ft__controls">
            <button type="button" className="ft__arrow" aria-disabled={atStart || undefined} onClick={event => { if (atStart) return; goTo(active - 1, { keyboard: event.detail === 0 }); }} aria-label="Previous feature"><ArrowLeft size={18} aria-hidden="true" /></button>
            {atEnd
              ? <a className="ft__next" href={'#' + after.id} data-page-jump="" onClick={onAfterLink} onFocus={onNextFocus} onBlur={onNextBlur} aria-label={'Next section: ' + after.name}><span>Up next <b>{after.name}</b></span></a>
              : <button type="button" className="ft__next" onClick={event => goTo(active + 1, { keyboard: event.detail === 0 })} onFocus={onNextFocus} onBlur={onNextBlur} aria-label={'Next feature: ' + next?.label}><span>Up next <b>{next?.label}</b></span></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeatureTour({ slides = [] }) {
  return <ScrollStory steps={slides.length} className="ft-story ss--centre" label="What is inside MockMob, tool by tool" Content={TourStage} slides={slides} />;
}
