"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { createDemoPlayback } from '@/../data/demo_playback.mjs';
import { DemoPlaybackContext, TOUR_SCREENS } from './TourScreens';
import ScrollStory from './ScrollStory';

export const TOUR_ADVANCE_MS = 4800;

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

// The feature tour holds the screen while the reader's scroll moves through the tools (ScrollStory):
// one tool per beat, its live demo playing while it is on stage, the chapter chips and the progress
// segments following the scroll. Chips, arrows and Next jump the page to that tool's beat, so the
// scroll position and the tool on stage never disagree. Without IntersectionObserver the old
// carousel returns: native swipes, timed autoplay with an explicit Pause, keyboard focus holds it.
function TourStage({ slides, step, pinned, reduced, goTo: storyGoTo }) {
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
    if (!track || !slide || track.scrollWidth <= track.clientWidth + 2) return;
    programmaticRef.current = true;
    track.scrollTo({ left: slide.offsetLeft, behavior: smooth && !reduced ? 'smooth' : 'auto' });
  }, [reduced]);

  // Keep the current chapter chip in view without moving the document's vertical scroll.
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector('[data-chapter="' + active + '"]');
    if (nav && item && nav.scrollWidth > nav.clientWidth + 2) nav.scrollTo({ left: item.offsetLeft - (nav.clientWidth - item.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [active, reduced]);

  const goTo = useCallback((index, { scroll = true, keyboard = false } = {}) => {
    if (!slides.length) return;
    const next = (index + slides.length) % slides.length;
    if (pinned) { storyGoTo(next, { instant: keyboard }); return; }
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

  const paused = !playing || keyboardHold;
  const next = slides[(active + 1) % slides.length];
  const status = reduced ? 'Explore' : paused ? 'Paused' : pinned ? 'Live demo' : 'Autoplay';

  return (
    <div className="ft" role="region" aria-roledescription="carousel" aria-label="Explore MockMob features" data-playing={running ? 'true' : 'false'} data-live={onScreen ? 'true' : 'false'} data-keyboard={keyboardHold ? 'true' : 'false'}
      onPointerDownCapture={event => { if (!event.target.closest('.ft__play')) setKeyboardHold(false); }}
      onFocusCapture={event => { if (!pinned && !event.target.closest('.ft__play') && event.target.matches(':focus-visible')) setKeyboardHold(true); }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardHold(false); }}>
      <ul className="ft__list" ref={navRef} aria-label="Feature chapters">
        {slides.map((slide, i) => <li key={slide.id} data-chapter={i}>
          <button type="button" className="ft__row" data-on={active === i ? 'true' : 'false'} aria-current={active === i ? 'step' : undefined} onClick={event => goTo(i, { keyboard: event.detail === 0 })}>
            <span className="ft__ico" aria-hidden="true">{slide.icon}</span><span>{slide.label}</span>
          </button>
        </li>)}
      </ul>

      <div className="ft__room">
        <div className="ft__stage" data-ss-fit="0.6">
          <div className="ft__chrome">
            <div className="ft__chapter"><span className="ft__counter">{String(active + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span><b>{slides[active]?.label}</b></div>
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

          <ul className="ft__track" ref={trackRef} aria-label="MockMob features" aria-live={paused ? 'polite' : 'off'} onScroll={readSwipe}
            onPointerDown={event => { programmaticRef.current = false; pointerRef.current = { x: event.clientX, y: event.clientY }; }}
            onPointerMove={event => { const start = pointerRef.current; if (!pinned && start && Math.abs(event.clientX - start.x) > 10 && Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y)) setInteracting(true); }}
            onPointerUp={() => { pointerRef.current = null; setInteracting(false); }} onPointerCancel={() => { pointerRef.current = null; setInteracting(false); }}
            onTouchStart={() => { programmaticRef.current = false; }}
            onWheel={event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) programmaticRef.current = false; }}>
            {slides.map((slide, i) => { const Screen = TOUR_SCREENS[slide.id]; const on = active === i; return (
              <li key={slide.id} className="ft__slide" role="group" aria-roledescription="slide" aria-label={(i + 1) + ' of ' + slides.length + ': ' + slide.label} aria-hidden={!on} inert={!on} data-index={i} data-active={on ? 'true' : 'false'} data-past={pinned && i < active ? 'true' : undefined}>
                <article className="ft__card">
                  <div className="ft__media">
                    <div className="ft__shot">
                      {slide.video ? <TourVideo slide={slide} playing={on && running} /> : Screen ? <DemoPlaybackContext.Provider key={on ? i + ':on:' + visit : String(i)} value={{ active: on, reduced }}><Screen play={on && running} /></DemoPlaybackContext.Provider> : slide.screen}
                    </div>
                  </div>
                  <div className="ft__copy">
                    <h3 className="ft__title">{slide.title}</h3>
                    <p className="ft__body">{slide.body}</p>
                    <p className="ft__summary">{slide.chip || slide.line}</p>
                    {slide.points?.length ? <ul className="ft__points">{slide.points.map(point => <li key={point}>{point}</li>)}</ul> : null}
                    <Link href={slide.href} className="lp-link ft__cta">{slide.cta}<ArrowRight size={16} aria-hidden="true" /></Link>
                  </div>
                </article>
              </li>
            ); })}
          </ul>

          <div className="ft__controls">
            <button type="button" className="ft__arrow" onClick={event => goTo(active - 1, { keyboard: event.detail === 0 })} aria-label="Previous feature"><ArrowLeft size={18} aria-hidden="true" /></button>
            <button type="button" className="ft__next" onClick={event => goTo(active + 1, { keyboard: event.detail === 0 })} aria-label={'Next feature: ' + next?.label}><span>Up next <b>{next?.label}</b></span><ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeatureTour({ slides = [] }) {
  return <ScrollStory steps={slides.length} className="ft-story" label="What is inside MockMob, tool by tool" Content={TourStage} slides={slides} />;
}
