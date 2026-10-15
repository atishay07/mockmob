"use client";

// SectionHeading: a landing section's heading that docks as the reader scrolls into its held story.
//
//   <section className="lp-sec lp-sh-host" id="inside-the-lab">
//     <SectionHeading titleId="inside-the-lab-title" name="Mistake Lab." title="Every mark, traced back to a moment."
//       sub="A score tells you how it went..." mini="Mistake Lab" />
//     <LabCinema />
//   </section>
//
// Nothing labels the heading from above. The section's name is the h2's first clause (name, in --ink) and the
// promise its second (title, in --ink-3, the same size and weight); a heading without a name is one clause in
// --ink. The lede follows at the page's lede size. (kicker is the old name of name and still works.)
// It renders two things, both direct children of the section:
//   1. A dock: a zero-height sticky line under the site bar holding a glass band with the heading's short
//      form (mini; an <em> in it is the one brand word in green) and a 2px rule along its bottom edge that
//      fills with the held story's progress (section-heading.css). Nothing else on it: no dot, no action.
//   2. The full heading (name, title, sub) in the page's flow. Text never fades in: it is simply there.
// The full heading reads whole wherever it rests below the band, so no empty band ever opens between it and
// the story. Once the title has gone under the band, it fades up and the band comes in (compact); the
// sub carries on in the flow and slides under the glass, fading there once it is wholly under (docked); the
// band leaves again once the section's held story has run (its track's end has come up the screen), and
// everything reverses on the way back. One rect read per
// frame, only while the section is on screen, and attributes are written only when the phase changes.
// Motion is opacity and transform (section-heading.css); reduced motion swaps instantly. Without
// JavaScript (or IntersectionObserver) the heading is a plain heading and the band never shows.
import { useEffect, useRef } from 'react';
import { headingPhase } from './sectionHeadingPhase.mjs';
import '@/app/section-heading.css';

export function SectionHeading({ titleId, name, kicker, title, sub, mini, aside, asideClassName = '', className = '' }) {
  const dockRef = useRef(null);
  const fullRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const lead = name ?? kicker;

  useEffect(() => {
    const dock = dockRef.current;
    const full = fullRef.current;
    const head = titleRef.current;
    const subLine = subRef.current;
    const section = dock?.parentElement;
    if (!dock || !full || !head || !section || typeof IntersectionObserver === 'undefined') return undefined;
    let frame = 0;
    let listening = false;
    let phase = '';
    let line = 0; // the band's bottom edge, from the window's top (px)

    const measure = () => {
      const band = dock.firstElementChild;
      line = (parseFloat(getComputedStyle(dock).top) || 0) + (band ? band.offsetHeight : 0);
    };
    const write = (next) => {
      if (next === phase) return;
      phase = next;
      full.dataset.sh = next;
      dock.dataset.on = next === 'compact' || next === 'docked' ? 'true' : 'false';
    };
    const read = () => {
      frame = 0;
      const vh = window.innerHeight;
      const title = head.getBoundingClientRect();
      // The held story's track when there is one, else the section: the band stays while it holds.
      const track = section.querySelector('.ss[data-pinned="true"] .ss__track');
      write(headingPhase({
        titleBottom: title.bottom, restBottom: subLine ? subLine.getBoundingClientRect().bottom : title.bottom,
        line, vh, end: (track || section).getBoundingClientRect().bottom, hasTrack: !!track,
      }));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    const onResize = () => { measure(); onScroll(); };
    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      if (on) { window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onResize); onResize(); }
      else { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); }
    };
    // Geometry is read only while the section is on screen: until then it may be undrawn (content-visibility),
    // and reading it would lay out the whole held story. Leaving, it settles its state once (full below, past above).
    const near = new IntersectionObserver((entries) => {
      const on = entries[entries.length - 1].isIntersecting;
      const was = listening;
      listen(on);
      if (!on && was) { cancelAnimationFrame(frame); frame = 0; read(); }
    }, { rootMargin: '0px', threshold: 0 });
    near.observe(section);
    return () => {
      near.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
      delete full.dataset.sh;
      delete dock.dataset.on;
    };
  }, []);

  const heading = (
    <div className={`lp-head lp-head--left ${className}`.trim()}>
      <h2 className="lp-h2" id={titleId} ref={titleRef}>
        {lead ? <><span className="lp-h2__name">{lead}</span>{' '}<span className="lp-h2__rest">{title}</span></> : title}
      </h2>
      {sub ? <p className="lp-sub" ref={subRef}>{sub}</p> : null}
    </div>
  );

  return (
    <>
      <div className="lp-sh__dock" ref={dockRef} data-on="false">
        <div className="lp-sh__band">
          <div className="mm-wrap lp-sh__row">
            <p className="lp-sh__mini" aria-hidden="true">{mini || lead || title}</p>
          </div>
        </div>
      </div>
      <div className="mm-wrap lp-sh__full" ref={fullRef}>
        {aside ? <div className={`lp-guide-head ${asideClassName}`.trim()}>{heading}{aside}</div> : heading}
      </div>
    </>
  );
}

export default SectionHeading;
