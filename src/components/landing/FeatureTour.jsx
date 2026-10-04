"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { DemoPlaybackContext, TOUR_SCREENS } from './TourScreens';

// Every product area, one idea per screen. On a phone the slides are a native scroll-snap track
// (swipe, momentum and snapping come from the browser); on a wide screen the list on the left picks
// which slide fills the stage. It advances on its own and has an explicit pause control. It only
// advances while the tour is on screen, never scrolls the page, and stands still for reduced motion.
// Each slide's screen (TourScreens) plays a short demo whenever it becomes the active slide while the tour
// is on screen. A slide may carry a real screen recording (`video`) instead.
const ADVANCE_MS = 7000;

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

export default function FeatureTour({ slides = [] }) {
  const trackRef = useRef(null);
  const rootRef = useRef(null);
  const rotationIntent = useRef(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { setReduced(query.matches); if (query.matches) setPlaying(false); };
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  // Autoplay only while the tour is visible.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting && entry.intersectionRatio >= 0.2), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The slide nearest the track's start is the active one while swiping on a phone.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      const hit = entries.filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit) setActive(Number(hit.target.dataset.index));
    }, { root: track, threshold: [0.6, 0.85] });
    track.querySelectorAll('[data-index]').forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [slides.length]);

  const goTo = useCallback((index, { user = false } = {}) => {
    if (!slides.length) return;
    const next = (index + slides.length) % slides.length;
    if (user) setPlaying(false);
    setActive(next);
    const track = trackRef.current;
    const slide = track?.querySelector(`[data-index="${next}"]`);
    if (!track || !slide || track.scrollWidth <= track.clientWidth + 2) return;
    track.scrollTo({ left: slide.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft || '0'), behavior: reduced ? 'auto' : 'smooth' });
  }, [slides.length, reduced]);

  useEffect(() => {
    if (!playing || !onScreen || !pageVisible || reduced || slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      goTo(active + 1);
    }, ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [playing, onScreen, pageVisible, reduced, active, goTo, slides.length]);

  const noteTouch = () => setPlaying(false);
  const running = playing && onScreen && pageVisible && !reduced;

  return (
    <div className="ft" ref={rootRef} role="region" aria-roledescription="carousel" aria-label="Explore MockMob features" onFocusCapture={() => setPlaying(false)} data-playing={running ? 'true' : 'false'} data-live={onScreen ? 'true' : 'false'}>
      <div className="ft__aurora" aria-hidden="true" />
      <div className="ft__stage">
        <ul className="ft__track" ref={trackRef} onTouchStart={noteTouch} onPointerDown={noteTouch} onWheel={noteTouch} aria-label="MockMob features">
          {slides.map((slide, i) => { const Screen = TOUR_SCREENS[slide.id]; return (
            <li key={slide.id} className="ft__slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${slide.label}`} aria-hidden={active !== i} inert={active !== i} data-index={i} data-active={active === i ? 'true' : 'false'}>
              <article className="ft__card">
                <div className="ft__media">
                  <div className="ft__shot">
                    {slide.video ? (
                      <TourVideo slide={slide} playing={active === i && running} />
                    ) : Screen ? <DemoPlaybackContext.Provider value={{ active: active === i, reduced }}><Screen play={active === i && running} /></DemoPlaybackContext.Provider> : slide.screen}
                  </div>
                  {slide.chip ? <p className="ft__chip"><i aria-hidden="true" />{slide.chip}</p> : null}
                </div>
                <div className="ft__copy">
                  <p className="ft__kicker">{slide.kicker}</p>
                  <h3 className="ft__title">{slide.title}</h3>
                  <p className="ft__body">{slide.body}</p>
                  {slide.points?.length ? <ul className="ft__points">{slide.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
                  <div className="ft__foot">
                    <Link href={slide.href} className="lp-link ft__cta">{slide.cta}<ArrowRight size={16} aria-hidden="true" /></Link>
                    {slide.video ? null : <span className="ft__tag">Illustrative screen</span>}
                  </div>
                </div>
              </article>
            </li>
          ); })}
        </ul>

        <div className="ft__controls">
          <button type="button" className="ft__arrow" onClick={() => goTo(active - 1, { user: true })} aria-label="Previous feature"><ArrowLeft size={18} aria-hidden="true" /></button>
          <span className="ft__counter" aria-label={`Feature ${active + 1} of ${slides.length}`}>{active + 1} / {slides.length}</span>
          <button type="button" className="ft__arrow" onClick={() => goTo(active + 1, { user: true })} aria-label="Next feature"><ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" className="ft__play" onPointerDown={() => { rotationIntent.current = !playing; }} onPointerCancel={() => { rotationIntent.current = null; }} onBlur={() => { rotationIntent.current = null; }} onClick={() => { setPlaying(rotationIntent.current ?? !playing); rotationIntent.current = null; }} aria-label={playing ? 'Pause the tour' : 'Play the tour'} disabled={reduced}>
            {playing && !reduced ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          </button>
        </div>
        <label className="ft__choose"><span className="sr-only">Choose a feature</span><select aria-label="Choose a feature" value={active} onChange={e => goTo(Number(e.target.value), { user: true })}>{slides.map((slide, i) => <option key={slide.id} value={i}>{slide.label}</option>)}</select></label>
      </div>

      <ul className="ft__list" aria-label="All features">
        {slides.map((slide, i) => (
          <li key={slide.id}>
            <button type="button" className="ft__row" data-on={active === i ? 'true' : 'false'} onClick={() => goTo(i, { user: true })} aria-current={active === i ? 'true' : undefined}>
              <span className="ft__ico" aria-hidden="true">{slide.icon}</span>
              <span className="ft__rowtext"><b>{slide.label}</b><span>{slide.line}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
