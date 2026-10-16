"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createDemoPlayback } from '@/../data/demo_playback.mjs';
import { DemoPlaybackContext, TOUR_SCREENS } from './TourScreens';
import ScrollStory from './ScrollStory';
import { undrawn } from './undrawn';
import { fitRowEnd, revealTab } from './tabScroll';

export const TOUR_ADVANCE_MS = 4800;

// Phones show one sentence under each tool's title (wide screens show the full paragraph and its points),
// so a phone never says less than a laptop. A slide's own `lede` wins.
const LEDE = {
  arena: 'A quick drill on a free evening, or a full 50-question, 60-minute mock on the real clock.',
  repair: 'Why your pick was tempting and where it breaks, written from the official key. No repair and no charge if the AI’s working disagrees.',
  learn: 'Short lessons with worked examples, then recall cards that come back before you forget.',
  replay: 'Every changed answer, every slow question and every skip, in the order it happened.',
  radar: 'Every miss traced back to its chapter, so tonight has one clear target.',
  prepos: 'Ask about your own record and get one next step, the same one Today shows you.',
  compass: 'Your score against the published 2026 DU cutoffs, by college, category and round.',
  combo: 'Pick your DU goals and see which five-paper combinations the 2026 rules keep open.',
  rival: 'A short timed run against a fixed target for accuracy and pace.',
};

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
// one tool per beat, its live demo playing while it is on stage. The index is a row of text tabs, each
// over a 2px rule that is the tour's progress (filled with the scroll when held, with the autoplay clock
// otherwise). Tabs, Previous and Next jump the page to that tool's beat, so the
// scroll position and the tool on stage never disagree. Without IntersectionObserver the old
// carousel returns: native swipes, timed autoplay with an explicit Pause, keyboard focus holds it.
function TourStage({ slides, elsewhere = [], step, pinned, reduced, goTo: storyGoTo }) {
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

  // Keep the current tab wholly in view, 24px clear of the row's edge, without moving the document's vertical
  // scroll (the row scrolls itself, only as far as it must; instant under reduced motion). The row's edges fade
  // only where more tabs wait beyond them.
  const [fade, setFade] = useState('none');
  const readFade = useCallback(() => {
    const nav = navRef.current;
    // Undrawn (content-visibility): the ResizeObserver below reads it once the section is drawn.
    if (!nav || undrawn(nav)) return;
    const more = nav.scrollWidth - nav.clientWidth;
    const start = nav.scrollLeft > 2;
    const end = more > 2 && nav.scrollLeft < more - 2;
    setFade(start && end ? 'both' : start ? 'start' : end ? 'end' : 'none');
    // The row shows only whole labels: it is masked from the first tab wholly in view to the last one, with an 8px
    // fade into the gap beyond, so a tab cut by either edge is hidden rather than shown as stray letters. Written
    // straight to the row's style on every scroll frame, so nothing re-renders.
    const box = nav.getBoundingClientRect();
    let left = Infinity;
    let right = -Infinity;
    for (const tab of nav.children) {
      const r = tab.getBoundingClientRect();
      if (r.left >= box.left - 0.5 && r.right <= box.right + 0.5) { left = Math.min(left, r.left); right = Math.max(right, r.right); }
    }
    const cutL = Number.isFinite(left) && start ? Math.max(0, left - box.left) : 0;
    const cutR = Number.isFinite(right) && end ? Math.max(0, box.right - right) : 0;
    nav.style.setProperty('--ft-cut-l', `${Math.round(cutL)}px`);
    nav.style.setProperty('--ft-cut-r', `${Math.round(cutR)}px`);
  }, []);
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector('[data-chapter="' + active + '"]');
    if (!nav || !item || undrawn(nav)) return;
    fitRowEnd(nav);
    revealTab(nav, active, { smooth: !reduced });
    readFade();
  }, [active, reduced, readFade]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const fit = () => { if (!undrawn(nav)) fitRowEnd(nav); readFade(); };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [readFade]);

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
  const playLabel = reduced ? 'Autoplay is off' : paused ? 'Play' : 'Pause';

  return (
    <div className="ft" role="region" aria-roledescription="carousel" aria-label="Explore MockMob features" data-playing={running ? 'true' : 'false'} data-live={onScreen ? 'true' : 'false'} data-keyboard={keyboardHold ? 'true' : 'false'}
      onPointerDownCapture={event => { if (!event.target.closest('.ft__play')) setKeyboardHold(false); }}
      onFocusCapture={event => { if (!pinned && !event.target.closest('.ft__play') && event.target.matches(':focus-visible')) setKeyboardHold(true); }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardHold(false); }}>
      {/* The index: one text tab per tool, no icons. The rule under each tab is the tour's progress. */}
      <ul className="ft__list" ref={navRef} aria-label="Feature chapters" data-fade={fade} onScroll={readFade}>
        {slides.map((slide, i) => <li key={slide.id} data-chapter={i}>
          <button type="button" className="ft__row" data-on={active === i ? 'true' : 'false'} aria-current={active === i ? 'step' : undefined} onClick={event => goTo(i, { keyboard: event.detail === 0 })}>
            <span>{slide.label}</span>
            <i className="ft__rule" aria-hidden="true" data-done={i < active ? 'true' : 'false'}>
              {pinned ? <i className="ss-fill" data-state={i < active ? 'done' : i === active ? 'on' : 'off'} style={{ '--ss-i': i }} /> : i === active ? <i ref={progressRef} key={visit} /> : null}
            </i>
          </button>
        </li>)}
      </ul>

      <div className="ft__room">
        <div className="ft__stage" data-ss-fit="0.6" data-ss-end="">

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
                      {slide.video ? <TourVideo slide={slide} playing={on && running} /> : Screen ? <DemoPlaybackContext.Provider key={on ? i + ':on:' + visit : String(i)} value={{ active: on, reduced, paused }}><Screen play={on && running} /></DemoPlaybackContext.Provider> : slide.screen}
                    </div>
                  </div>
                  <div className="ft__copy">
                    <h3 className="ft__title">{slide.title}</h3>
                    <p className="ft__body">{slide.body}</p>
                    <p className="ft__lede">{slide.lede || LEDE[slide.id] || slide.line}</p>
                    <p className="ft__summary">{slide.chip || slide.line}</p>
                    {slide.points?.length ? <ul className="ft__points">{slide.points.map(point => <li key={point}>{point}</li>)}</ul> : null}
                    <Link href={slide.href} className="ft__cta">{slide.cta}</Link>
                  </div>
                </article>
              </li>
            ); })}
          </ul>

          {/* Plain text controls: the demos' stop control (autoplay over 5 s needs one), then the way back and on. */}
          <div className="ft__controls">
            <button type="button" className="ft__play" aria-label={reduced ? 'Autoplay is off' : paused ? 'Play the demos' : 'Pause the demos'} disabled={reduced} onClick={() => { setPlaying(paused); setKeyboardHold(false); }}>{playLabel}</button>
            <button type="button" className="ft__arrow" onClick={event => goTo(active - 1, { keyboard: event.detail === 0 })} aria-label="Previous feature">Previous</button>
            <button type="button" className="ft__next" onClick={event => goTo(active + 1, { keyboard: event.detail === 0 })} aria-label={'Next feature: ' + next?.label}>Next: <b>{next?.label}</b></button>
          </div>
          {/* Desktop: the tools shown elsewhere on the page, as their own sentence under the controls. */}
          <Elsewhere links={elsewhere} className="ft__more--bar" />
        </div>
      </div>
    </div>
  );
}

// The tools this page already shows in their own sections (the Lab's Repair scene, DU Compass, the Combo Planner)
// are not drawn a second time in the tour. They are named under it as links to where they live, so the tour stays
// an index of everything without repeating a demo. DemoJump glides the page there; a link into a held story names
// its scene (data-ss-step), so the Repair link lands on the Lab's Repair, not its first scene.
function Elsewhere({ links, className }) {
  if (!links.length) return null;
  const at = (slide) => (
    <a href={slide.elsewhere.href} className="ft__away" data-ss-step={slide.elsewhere.step}>{slide.label}</a>
  );
  const above = links.filter((slide) => slide.elsewhere.above);
  const below = links.filter((slide) => !slide.elsewhere.above);
  const list = (items) => items.map((slide, i) => <span key={slide.id}>{i > 0 ? (i === items.length - 1 ? ' and the ' : ', ') : ''}{at(slide)}</span>);
  return (
    <p className={'ft__more ' + className}>
      Also on this page:{' '}
      {above.length ? <>{list(above)} in the Lab above{below.length ? '; ' : '.'}</> : null}
      {below.length ? <>{list(below)}, further down.</> : null}
    </p>
  );
}

export default function FeatureTour({ slides = [] }) {
  const scenes = slides.filter((slide) => !slide.elsewhere);
  const links = slides.filter((slide) => slide.elsewhere);
  return (
    <>
      <ScrollStory steps={scenes.length} className="ft-story ss--centre" label="What is inside MockMob, tool by tool" Content={TourStage} slides={scenes} elsewhere={links} />
      <Elsewhere links={links} className="ft__more--after" />
    </>
  );
}
