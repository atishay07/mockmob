"use client";

// SectionPosition: the band under the site bar that names the held story the reader is in, with a rule that fills
// as the story runs.
//
//   <SectionPosition sections={[{ id: 'inside-the-lab', name: 'Inside the Mistake Lab' }, ...]} />
//
// A held story pins its stage while the page scrolls through a tall track, so by the middle of it the section's
// heading is far above and nothing on screen says where you are. Once a section's heading has gone under the band
// and its story is still running, the band slides in with the section's name (the same words as its heading) and a
// 2px rule along its bottom edge that fills with the hold. When the story has run, the band leaves, and it is back
// for the next one. Nothing else is on it: no dot, no link, no action, and it never takes a tap.
//
// The band is a position readout, so it is not a landmark and not live: no announcement while you scroll. It is
// a labelled group with the name as plain text, and it is out of the accessibility tree while it is off.
//
// One rect read per frame, only while a named section is on screen, and only the sections on screen. State is
// written only when the band turns on or off or changes section; the rule is one transform write. Motion is opacity
// and transform (section-position.css); reduced motion swaps instantly. Without JavaScript or IntersectionObserver
// the band never shows and the page reads as it did.
import { useEffect, useRef, useState } from 'react';
import { positionAt } from './sectionPositionPhase.mjs';
import '@/app/section-position.css';

export function SectionPosition({ sections }) {
  const dockRef = useRef(null);
  const ruleRef = useRef(null);
  // label stays on the last section shown while the band fades out, so its words never blank mid-exit.
  const [view, setView] = useState({ on: false, label: 0 });
  const key = sections.map((section) => section.id).join('|');

  useEffect(() => {
    const dock = dockRef.current;
    const rule = ruleRef.current;
    if (!dock || !rule || typeof IntersectionObserver === 'undefined') return undefined;
    const ids = key.split('|');
    const hosts = ids.map((id) => document.getElementById(id));
    if (hosts.some((host) => !host)) return undefined;
    const near = new Set(); // sections on screen
    let frame = 0;
    let listening = false;
    let line = 0; // the band's bottom edge, from the window's top (px)
    let lastIndex = -1;
    let lastProgress = -1;

    const measure = () => { line = (parseFloat(getComputedStyle(dock).top) || 0) + dock.offsetHeight; };
    const show = (index) => {
      setView((current) => {
        const on = index >= 0;
        const label = on ? index : current.label;
        return current.on === on && current.label === label ? current : { on, label };
      });
    };
    const read = () => {
      frame = 0;
      const vh = window.innerHeight;
      const reads = hosts.map((host, i) => {
        if (!near.has(i)) return null;
        const heading = host.querySelector('h2');
        const track = host.querySelector('.ss[data-pinned="true"] .ss__track');
        const box = (track || host).getBoundingClientRect();
        return { titleBottom: heading ? heading.getBoundingClientRect().bottom : box.top, top: box.top, height: box.height, hasTrack: !!track };
      });
      const { index, progress } = positionAt(reads, { line, vh });
      if (index >= 0 && (index !== lastIndex || Math.abs(progress - lastProgress) > 0.002)) {
        rule.style.transform = `scaleX(${progress.toFixed(3)})`;
        lastIndex = index;
        lastProgress = progress;
      }
      show(index);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    const onResize = () => { measure(); onScroll(); };
    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      if (on) { window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onResize); onResize(); }
      else { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); }
    };
    // Geometry is read only while a named section is on screen: until then it may be undrawn (content-visibility),
    // and reading it would lay out the whole held story. Leaving the last one, the band settles off once.
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = hosts.indexOf(entry.target);
        if (i < 0) continue;
        if (entry.isIntersecting) near.add(i); else near.delete(i);
      }
      const was = listening;
      listen(near.size > 0);
      if (!near.size && was) { cancelAnimationFrame(frame); frame = 0; show(-1); }
    }, { rootMargin: '0px', threshold: 0 });
    hosts.forEach((host) => watch.observe(host));
    return () => {
      watch.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
    };
  }, [key]);

  return (
    <div className="lp-pos" ref={dockRef} data-on={view.on ? 'true' : 'false'} role="group" aria-label="Where you are on this page">
      <div className="lp-pos__band">
        <div className="mm-wrap lp-pos__row">
          <p className="lp-pos__name">{sections[view.label]?.name}</p>
        </div>
        <i className="lp-pos__rule" ref={ruleRef} aria-hidden="true" />
      </div>
    </div>
  );
}

export default SectionPosition;
