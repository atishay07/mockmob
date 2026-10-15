"use client";

// SectionHeading: a landing section's heading that docks as the reader scrolls into its held story.
//
//   <section className="lp-sec lp-sh-host" id="your-prep">
//     <SectionHeading titleId="your-prep-title" kicker="Mistake Lab" title={<>What’s inside <em>MockMob</em>.</>}
//       sub="Practice, repair, replay and the plan that ties them together." mini={<>What’s inside <em>MockMob</em></>} />
//     <div className="mm-wrap"><FeatureTour slides={TOUR} /></div>
//   </section>
//
// It renders two things, both direct children of the section:
//   1. A dock: a zero-height sticky line under the site bar holding a glass band with the heading's short
//      form (mini, the <em> in the brand green) and, on phones, the one action the bar above hides there.
//   2. The full heading (kicker, title, sub) in the page's flow, revealed like every heading on the page.
// The full heading reads whole wherever it rests below the band, so no empty band ever opens between it and
// the story. Once the title has gone under the band, it fades up and the band comes in (compact); the
// sub carries on in the flow and slides under the glass, fading there once it is wholly under (docked); the
// band leaves again once the section's held story has run (its track's end has come up the screen), and
// everything reverses on the way back. One rect read per
// frame, only while the section is on screen, and attributes are written only when the phase changes.
// Motion is opacity and transform (section-heading.css); reduced motion swaps instantly. Without
// JavaScript (or IntersectionObserver) the heading is a plain heading and the band never shows.
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { Reveal } from './Reveal';
import { headingPhase } from './sectionHeadingPhase.mjs';
import '@/app/section-heading.css';

export function SectionHeading({ titleId, kicker, title, sub, mini, aside, asideClassName = '', className = '' }) {
  const dockRef = useRef(null);
  const fullRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const { isAuthenticated } = useAuth();
  const released = recoveryReleased();
  const go = isAuthenticated
    ? { href: released ? '/recovery' : '/dashboard', text: 'Go to practice' }
    : { href: released ? '/signup?next=%2Frecovery' : '/signup', text: 'Start free' };

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
    <Reveal className={`lp-head lp-head--left ${className}`.trim()}>
      {kicker ? <p className="lp-kicker">{kicker}</p> : null}
      <h2 className="lp-h2" id={titleId} ref={titleRef}>{title}</h2>
      {sub ? <p className="lp-sub" ref={subRef}>{sub}</p> : null}
    </Reveal>
  );

  return (
    <>
      <div className="lp-sh__dock" ref={dockRef} data-on="false">
        <div className="lp-sh__band">
          <div className="mm-wrap lp-sh__row">
            <p className="lp-sh__mini" aria-hidden="true">{mini || title}</p>
            <Link href={go.href} className="lp-sh__go">{go.text}<ArrowRight size={16} aria-hidden="true" /></Link>
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
