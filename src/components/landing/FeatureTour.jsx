"use client";

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { DemoPlaybackContext, TOUR_SCREENS } from './TourScreens';
import ScrollStory from './ScrollStory';
import { FLOW_QUERY } from './storyGesture.mjs';

// Wide screens show each tool's title, its paragraph and its points. A phone's held stage has one screen of height, so it
// shows the title alone under the screen (16 Nov 2026 night: "the tool's name and one sentence ... no second paragraph");
// the slide's own `lede` (homeCopy.mjs) stays in the page for screen readers (r16-tour-stack.css).
// The rail's icons are the lamp-lit desk objects (BrandIcon, LK73), drawn from 32 px so the object never turns to mush; Ask
// Mobi's is the brass desk bell. The chevron stays a plain line icon: controls are the interface's verbs.
// They load eagerly at low priority (R3-D5, LK105): the tab row is on screen the moment the tour is, so no icon may arrive
// after its tab.
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
// only the two screens whose state changed. `epoch` is the activation the screen on stage belongs to (ScrollStory's step
// count, R3-D5): off stage every screen gets the same -1, so a step still re-renders only two. `sample` is the public
// question a screen may open (the Mob's Fix it together, read on the server by page.js). A screen told `reduced` shows its
// finished frame and plays nothing (reduced motion, and every screen of a resting tour: see `still` below).
const TourScreen = memo(function TourScreen({ Screen, active, reduced, play, epoch, sample }) {
  const value = useMemo(() => ({ active, reduced, paused: false, epoch, held: true }), [active, reduced, epoch]);
  return <DemoPlaybackContext.Provider value={value}><Screen play={play} sample={sample} /></DemoPlaybackContext.Provider>;
});

// THE TOUR: one stage, one tool on it at a time (ScrollStory holds the stage while the reader's scroll moves through the
// tools). Every reader gets this one form (16 Nov 2026 night; owner on his phone about the stack of five screens that
// replaced it for a few hours: "it's just a wastage of vertical space. I think the older one was better").
//   A mouse or a trackpad: one gesture, one tool (storyController.mjs). The demo of the tool on stage plays once and rests.
//   A finger (`flow`): the story is free (ScrollStory `free`): the page is the browser's own scroll, never landed,
//     steered or settled, and the tool on stage is the one whose beat is under the window's middle. Nothing plays by
//     itself: each screen is simply there in its finished frame, ready for a tap (TourScreens.jsx, tourTaps.mjs).
//   Unheld (reduced motion on a touch screen, or no IntersectionObserver): the same stage in the page's flow, the tabs
//     switching the tool in place.
// The tab row is still: five fixed tabs (r16-tour-stack.css on phones, r10-lab-tour.css from 900 px), never scrolled or
// moved by the page. A tab (and, from 900 px, Back and Up next) jumps the page to that tool's beat, so the scroll position
// and the tool on stage never disagree.
function TourStage({ slides, step, seq = 0, pinned, flow, reduced, goTo: storyGoTo, samples }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const active = Math.min(step, slides.length - 1);
  // A finger, or a stage that is not held: the screens rest on their finished frames and wait for a tap.
  const still = Boolean(flow) || !pinned;

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // The tour never wraps (R8 SEC-05): a wrap threw the reader about 4,900 px back to the first tool, or on to the last.
  // The first tool's Back is disabled and the last tool's Next is a link to the next section (below).
  const goTo = useCallback((index, { keyboard = false } = {}) => {
    if (index >= 0 && index < slides.length) storyGoTo(index, { instant: keyboard });
  }, [slides.length, storyGoTo]);

  useEffect(() => {
    const media = trackRef.current?.querySelector('[data-index="' + active + '"] .ft__media');
    if (!media || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting && entry.intersectionRatio >= .3), { threshold: [0, .3] });
    observer.observe(media);
    return () => observer.disconnect();
  }, [active]);

  // Demos play (held, for a mouse or a trackpad) while their tool is on stage; the scroll (not a timer) moves to the next tool.
  const running = onScreen && pageVisible && !reduced && !still;

  // The section after the tour (the next section with an id, named by its stamp or heading): where the last tool's Next
  // goes, the same place the bottom bar's Skip goes.
  const [after, setAfter] = useState(null);
  useEffect(() => {
    const host = rootRef.current?.closest('section[id]');
    for (let node = host?.nextElementSibling; node; node = node.nextElementSibling) {
      if (!node.id || node.hidden) continue;
      // A section may name itself (data-section-name): Key cards' heading is a whole sentence, too long for the key.
      const name = node.dataset.sectionName || (node.querySelector('.lp-stamp__name') || node.querySelector('h2'))?.textContent?.trim().replace(/\.$/, '');
      if (name) setAfter({ id: node.id, name });
      return;
    }
  }, []);
  const atStart = active === 0;
  const atEnd = Boolean(after) && active === slides.length - 1;
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

  const next = slides[(active + 1) % slides.length];

  return (
    <div className="ft" ref={rootRef} role="region" aria-roledescription="carousel" aria-label="Explore MockMob features" data-playing={running ? 'true' : 'false'} data-live={onScreen ? 'true' : 'false'}>
      {/* The tabs: one per tool, its desk object over its name. A tool with a shorter tab name (the Mob) carries both
          words; the sheets show one per width, so a phone reads "Mob" and a laptop "The Mob". */}
      <ul className="ft__list" aria-label="Feature chapters" style={{ '--ft-n': slides.length }}>
        {slides.map((slide, i) => <li key={slide.id} data-chapter={i}>
          <button type="button" className="ft__row" data-on={active === i ? 'true' : 'false'} aria-current={active === i ? 'step' : undefined} onClick={event => goTo(i, { keyboard: event.detail === 0 })}>
            <span className="ft__ico" aria-hidden="true" style={{ width: RAIL_ICON, height: RAIL_ICON }}><RailIcon name={slide.icon} /></span>
            <span className="ft__word" data-long={slide.tab ? '' : undefined}>{slide.label}</span>
            {slide.tab ? <span className="ft__word" data-short="">{slide.tab}</span> : null}
          </button>
        </li>)}
      </ul>

      <div className="ft__room">
        <div className="ft__stage" data-ss-fit="0.6" data-ss-end="">
          {/* The demos play once per tool and rest, so there is nothing to pause: the name stands alone (R11). Phones show
              the name in the tab row instead. */}
          <div className="ft__chrome">
            <div className="ft__chapter"><span className="lp-sr">{`Feature ${active + 1} of ${slides.length}`}</span><b>{slides[active]?.label}</b></div>
          </div>
          <div className="ft__progress" aria-hidden="true" style={{ gridTemplateColumns: 'repeat(' + slides.length + ', minmax(0, 1fr))' }}>
            {slides.map((slide, i) => <span key={slide.id} data-done={i < active ? 'true' : 'false'}>
              <i className="ss-fill" data-state={i < active ? 'done' : i === active ? 'on' : 'off'} style={{ '--ss-i': i }} />
            </span>)}
          </div>

          <div className="ft__track" ref={trackRef} aria-label="MockMob features">
            {slides.map((slide, i) => { const Screen = TOUR_SCREENS[slide.id]; const on = active === i; return (
              <div key={slide.id} className="ft__slide" role="group" aria-roledescription="slide" aria-label={(i + 1) + ' of ' + slides.length + ': ' + slide.label} aria-hidden={!on} inert={!on} data-index={i} data-active={on ? 'true' : 'false'} data-past={i < active ? 'true' : undefined}>
                <article className="ft__card">
                  <div className="ft__media">
                    {/* On a phone the screen is the part that gives way when the window is short: .ft__fit scales to fit
                        the shot's row (ScrollStory fitAll) and the words under it keep their size. From 900 px it never
                        scales (r16-tour-stack.css --ss-fit-min) and the whole stage is fitted instead, as before. */}
                    <div className="ft__shot">
                      <div className="ft__fit" data-ss-fit="0.6">
                        {slide.video ? <TourVideo slide={slide} playing={on && running} /> : Screen ? <TourScreen Screen={Screen} active={on} reduced={reduced || still} play={on && running} epoch={on ? seq : -1} sample={samples?.[slide.id] ?? null} /> : slide.screen}
                      </div>
                    </div>
                  </div>
                  <div className="ft__copy">
                    <h3 className="ft__title"><Sentences text={slide.title} /></h3>
                    <p className="ft__body">{slide.body}</p>
                    <p className="ft__lede">{slide.lede || slide.line}</p>
                    {/* The slide's one true line (its chip) is for screen readers now (LK71); on a phone the lede is too. */}
                    <p className="lp-sr">{slide.chip}</p>
                    {slide.points?.length ? <ul className="ft__points">{slide.points.map(point => <li key={point}>{point}</li>)}</ul> : null}
                    <Link href={slide.href} className="lp-link ft__cta">{slide.cta}</Link>
                  </div>
                </article>
              </div>
            ); })}
          </div>

          {/* Back and Up next (from 900 px; a phone has the tabs and no band under the card). */}
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

// Held wherever IntersectionObserver exists. On a touch screen the story is free (no landing, steering or settle: the
// page is the reader's scroll alone) and, under reduced motion, not held at all (holdCalm: the same stage, tabs switch the
// tool in place). A mouse or a trackpad keeps one gesture, one tool, reduced motion or not.
export default function FeatureTour({ slides = [], samples = null }) {
  return <ScrollStory steps={slides.length} className="ft-story ss--centre" label="What is inside MockMob, tool by tool" holdCalm={FLOW_QUERY} free Content={TourStage} slides={slides} samples={samples} />;
}
