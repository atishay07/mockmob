"use client";

// SectionPosition: where the reader is in the landing's held stories, and the way out of them.
//
//   <SectionPosition sections={[{ id: 'inside-the-lab', name: 'Inside the Mistake Lab' }, ...]} />
//
// A held story pins its stage while the page scrolls through a tall track, so by the middle of it the section's
// heading is far above and nothing on screen says where you are.
//
// PHONES (below 900 px, from 521 px tall): the bottom bar (R3-D4, owner LK103/LK104, 5 Nov 2026). "Why does the card,
// when scrolling down, snap to the entire bottom of the phone? ... below, like 10-20%, ... some sort of a blur or a
// loading indicator ... There should be a clear way to skip to the bottom or top." While a held story is live it takes
// the phone dock's slot: a progressive blur over the paper (the held card stops above it, scroll-story.css --ss-band),
// and one row: Top (back to the top of the page), the section's name with "2 of 4" over one segment per step, and Skip
// (to the next section). It follows the story's step, never the scroll position: one MutationObserver on the stories'
// data-live and data-step, so a phone does no per-frame work for it at all. Top and Skip go through pageJump.mjs (a
// declared jump: no story clamps it), which also gives the logo its way back to the top and the nav's Pricing pill its
// way down. The count is not live (no announcement on every swipe); the bar is a labelled group while it is on and
// nothing at all to assistive technology while it is off.
//
// WIDE WINDOWS (900 px and up): the band under the site bar, as before. Once a section's heading has gone under the
// band and its story is still running, the band slides in with the section's name (the same words as its heading) and a
// 2px rule along its bottom edge that fills with the hold; when the story has run, the band leaves. It is a position
// readout: no dot, no link, no action, and it never takes a tap. One rect read per frame, only while a named section is
// on screen, and only the sections on screen, from the page's one shared scroll read (scrollBus.mjs); state is written
// only when the band turns on or off or changes section; the rule is one transform write, eased over 220 ms.
//
// Motion is opacity and transform (section-position.css); reduced motion swaps instantly. Without JavaScript or
// IntersectionObserver neither shows and the page reads as it did.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpToLine } from 'lucide-react';
import { positionAt, stepCount, stepLabel } from './sectionPositionPhase.mjs';
import { installPageJumps, toTop } from './pageJump.mjs';
import * as bus from './scrollBus.mjs';
import '@/app/section-position.css';

const PHONE = '(max-width: 899px)';

// The next section with an id after a held section: where its Skip goes (the tour after the Lab, the Recovery Lab after
// the tour, then Compass or the DU calculator), with its heading's words for the link's accessible name.
function nextSection(host) {
  for (let node = host.nextElementSibling; node; node = node.nextElementSibling) {
    if (!node.id || node.hidden) continue;
    const name = node.querySelector('h2')?.textContent?.trim().replace(/\.$/, '') || '';
    return { id: node.id, name };
  }
  return null;
}

export function SectionPosition({ sections }) {
  const dockRef = useRef(null);
  const ruleRef = useRef(null);
  // label stays on the last section shown while the band fades out, so its words never blank mid-exit.
  const [view, setView] = useState({ on: false, label: 0 });
  // The bottom bar: the live story (index into sections), its step and step count, and where Skip goes. Like the band,
  // it keeps the last story's words while it fades out.
  const [bar, setBar] = useState({ on: false, index: 0, step: 0, steps: 0, next: null });
  const barRef = useRef(null);
  const key = sections.map((section) => section.id).join('|');

  // The logo (back to the top) and every shortcut link on the page (the bar's Skip, the nav's Pricing pill).
  useEffect(() => installPageJumps(), []);

  // A phone that says it has 4 GB of memory or less gets the paper gradient without the blur layers (the slow-phone
  // stutter work, 5 Nov): four backdrop filters are four extra passes on every frame the page moves under them. Written
  // straight on the bar (no state: it is known once, on mount).
  useEffect(() => {
    const memory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
    if (typeof memory === 'number' && memory <= 4 && barRef.current) barRef.current.dataset.lite = 'true';
  }, []);

  // ---- the bottom bar (phones)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const hosts = key.split('|').map((id) => document.getElementById(id));
    if (hosts.some((host) => !host)) return undefined;
    const roots = hosts.map((host) => host.querySelector('.ss'));
    const nexts = hosts.map(nextSection);
    const read = () => {
      const index = roots.findIndex((root) => root && root.dataset.pinned === 'true' && root.dataset.live === 'true');
      if (index < 0) { setBar((current) => (current.on ? { ...current, on: false } : current)); return; }
      const root = roots[index];
      const steps = stepCount(root.style.getPropertyValue('--ss-steps'), root.querySelectorAll('.ss__beat').length);
      const step = Math.max(0, Math.min(steps - 1, Number(root.dataset.step) || 0));
      setBar((current) => (current.on && current.index === index && current.step === step && current.steps === steps
        ? current
        : { on: true, index, step, steps, next: nexts[index] }));
    };
    const watch = new MutationObserver(read);
    roots.forEach((root) => root && watch.observe(root, { attributes: true, attributeFilter: ['data-live', 'data-step', 'data-pinned'] }));
    read();
    return () => watch.disconnect();
  }, [key]);

  // ---- the band under the site bar (wide windows)
  useEffect(() => {
    const dock = dockRef.current;
    const rule = ruleRef.current;
    if (!dock || !rule || typeof IntersectionObserver === 'undefined') return undefined;
    const ids = key.split('|');
    const hosts = ids.map((id) => document.getElementById(id));
    if (hosts.some((host) => !host)) return undefined;
    const phone = window.matchMedia(PHONE);
    const near = new Set(); // sections on screen
    let frame = 0;
    let listening = false;
    let unsubscribe = null;
    let line = 0; // the band's bottom edge, from the window's top (px)
    let lastIndex = -1;
    let lastProgress = -1;

    const calm = () => document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rule.style.transition = calm() ? 'none' : 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1)';
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
    // The shared read calls this once per frame while the page moves or resizes; it is already inside a frame.
    const onFrame = ({ resized }) => { if (resized) measure(); read(); };
    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      if (on) { unsubscribe = bus.subscribe(onFrame); measure(); if (!frame) frame = requestAnimationFrame(read); }
      else { unsubscribe?.(); unsubscribe = null; }
    };
    // Geometry is read only while a named section is on screen and the window is wide (phones have the bottom bar): until
    // then it may be undrawn (content-visibility), and reading it would lay out the whole held story. Leaving the last
    // one, the band settles off once.
    const sync = () => {
      const was = listening;
      listen(near.size > 0 && !phone.matches);
      if (was && !listening) { cancelAnimationFrame(frame); frame = 0; show(-1); }
    };
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = hosts.indexOf(entry.target);
        if (i < 0) continue;
        if (entry.isIntersecting) near.add(i); else near.delete(i);
      }
      sync();
    }, { rootMargin: '0px', threshold: 0 });
    hosts.forEach((host) => watch.observe(host));
    phone.addEventListener?.('change', sync);
    return () => {
      watch.disconnect();
      phone.removeEventListener?.('change', sync);
      listen(false);
      cancelAnimationFrame(frame);
    };
  }, [key]);

  const top = useCallback(() => { toTop(); }, []);
  const live = sections[bar.index];
  const segments = Array.from({ length: bar.steps }, (_, i) => i);

  return (
    <>
      <div className="lp-pos" ref={dockRef} data-on={view.on ? 'true' : 'false'} {...(view.on ? { role: 'group', 'aria-label': 'Where you are on this page' } : null)}>
        <div className="lp-pos__band">
          <div className="mm-wrap lp-pos__row">
            <p className="lp-pos__name">{sections[view.label]?.name}</p>
          </div>
          <i className="lp-pos__rule" ref={ruleRef} aria-hidden="true" />
        </div>
      </div>
      <div className="lp-bar" ref={barRef} data-on={bar.on ? 'true' : 'false'} {...(bar.on ? { role: 'group', 'aria-label': 'Where you are on this page' } : null)}>
        <div className="lp-bar__blur" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="mm-wrap lp-bar__row">
          <button type="button" className="lp-bar__top" onClick={top} aria-label="Back to the top">
            <ArrowUpToLine size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="lp-bar__where">
            <p className="lp-bar__name">{live?.name}</p>
            <p className="lp-bar__count">{stepLabel(bar.step, bar.steps)}</p>
            <span className="lp-bar__steps" aria-hidden="true" style={{ '--n': bar.steps || 1 }}>
              {segments.map((i) => <i key={i} data-on={i <= bar.step ? 'true' : 'false'} />)}
            </span>
          </div>
          {bar.next ? (
            <a className="lp-bar__skip" href={`#${bar.next.id}`} data-page-jump="">
              Skip{bar.next.name ? <span className="sr-only"> to {bar.next.name}</span> : null}
            </a>
          ) : null}
        </div>
      </div>
      {/* The veil a far shortcut jumps under (pageJump.mjs): the page's paper, under the site bar. */}
      <div className="lp-veil" aria-hidden="true" />
    </>
  );
}

export default SectionPosition;
