'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MascotSeat } from '@/components/brand/Mascot';
import { PipActor } from '@/components/brand/PipActor';
import PipGuide from '@/components/brand/PipGuide';

// Three directions for the same brief: Pip travels with the visitor through the homepage
// journey (hero → Mistake Lab → Compass → exam preview → close).
//  Lane     axis: continuous presence. A fixed side lane, height scrubbed by scroll, pose by section.
//  Perches  axis: many Pips. Each station keeps its own Pip, which arrives when you do.
//  Handoff  axis: one travelling Pip. Lands on a perch, travels on handoff, reacts to events.
const VARIANTS = ['Lane', 'Perches', 'Handoff'];
const react = (station, mood) => window.dispatchEvent(new CustomEvent('pip:react', { detail: { station, mood } }));

function Page() {
  return (
    <main className="pj">
      <section className="pj-sec pj-hero" data-pip-zone>
        <div className="pj-wrap pj-row">
          <div><p className="pj-kicker">CUET UG 2027 · Commerce</p><h1>Practise the CUET question in front of you.</h1><p>Five sample questions, no signup. Then a recorded session and one honest next step.</p>
            <div className="pj-actions"><button type="button" onClick={() => react('hero', 'celebrate')}>Answer the sample (correct)</button><button type="button" onClick={() => react('hero', 'encourage')}>Answer the sample (wrong)</button></div></div>
          <MascotSeat station="hero" pose="greeting" label="Pip’s on your side." note="Even at 11pm." eager />
        </div>
        <div className="pj-wrap"><div className="pj-surface" style={{ height: 380 }}>Demo drill (illustrative stand-in)</div></div>
      </section>
      <section className="pj-sec" data-pip-zone>
        <div className="pj-wrap pj-row"><div><p className="pj-kicker">Mistake lab</p><h2>See exactly where your marks went.</h2><p>Replay the answer changes, slow questions and skips. Then pick one useful move.</p></div>
          <MascotSeat station="lab" pose="thinking" label="Find the leak." note="One step at a time." /></div>
        <div className="pj-wrap"><div className="pj-surface" style={{ height: 520 }}>Mistake Lab replay
          <div className="pj-actions"><button type="button" onClick={() => react('lab', 'nod')}>Step: find the leak</button><button type="button" onClick={() => react('lab', 'eureka')}>Step: one next move (peak)</button></div></div></div>
      </section>
      <section className="pj-sec" data-pip-zone>
        <div className="pj-wrap pj-row pj-row--reverse"><div><p className="pj-kicker">DU Compass</p><h2>Put your shortlist beside the numbers.</h2><p>Published 2026 DU cutoffs, by college, category and round. Context, not a promise.</p></div>
          <MascotSeat station="compass" pose="pointing" label="Check the source." note="Keep the goal in view." /></div>
        <div className="pj-wrap"><div className="pj-surface" style={{ height: 560 }}>Compass ladder (published cutoffs)</div></div>
      </section>
      <section className="pj-sec pj-quiet"><div className="pj-wrap"><h2>DU eligibility and colleges</h2><div className="pj-surface" style={{ height: 900 }}>Authored silence: Pip stays on the last perch</div></div></section>
      <section className="pj-sec" data-pip-zone>
        <div className="pj-wrap"><h2>Your practice space. Your exam-day rehearsal.</h2><div className="pj-surface" style={{ height: 520 }}>Exam preview console
          <div className="pj-actions"><button type="button" onClick={() => react('demo', 'nod')}>Answer one</button><button type="button" onClick={() => react('demo', 'celebrate')}>Finish all five</button></div></div>
          <div className="pj-row"><p>Answers and review flags stay when you switch.</p><MascotSeat station="demo" pose="idle" label="Try both screens." note="Your answers stay." /></div></div>
      </section>
      <section className="pj-sec pj-quiet"><div className="pj-wrap"><h2>Pricing and questions</h2><div className="pj-surface" style={{ height: 1100 }}>Authored silence</div></div></section>
      <section className="pj-sec pj-close" data-pip-zone><div className="pj-wrap pj-center"><MascotSeat station="close" pose="encouraging" label="See you in the Arena." note="Start small. Keep going." /><h2>Five questions. Then your next move.</h2><button type="button" className="pj-cta">Try a CUET question</button></div></section>
    </main>
  );
}

// Lane: one fixed Pip in a side lane, its height scrubbed by progress through the active section.
function Lane() {
  const ref = useRef(null);
  const [pose, setPose] = useState('greeting');
  useEffect(() => {
    // Phones have no room for a lane: the static perches stay.
    if (window.matchMedia('(max-width: 760px)').matches) return undefined;
    document.documentElement.dataset.pipGuide = 'on';
    const seats = [...document.querySelectorAll('[data-pip-station]')].map((seat) => ({ pose: seat.dataset.pipPose, zone: seat.closest('section') }));
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      const active = seats.find(({ zone }) => { const r = zone.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
      if (!active || !ref.current) return;
      const r = active.zone.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      ref.current.style.transform = `translate3d(0, ${(window.innerHeight * (0.16 + p * 0.5)).toFixed(1)}px, 0)`;
      setPose(active.pose);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); delete document.documentElement.dataset.pipGuide; };
  }, []);
  return <div ref={ref} className="pj-lane"><PipActor pose={pose} /></div>;
}

// Perches: every station has its own Pip, which arrives from the scroll direction each time.
function Perches() {
  useEffect(() => {
    let lastY = window.scrollY;
    const observer = new IntersectionObserver((entries) => {
      const down = window.scrollY >= lastY; lastY = window.scrollY;
      for (const entry of entries) {
        const art = entry.target.querySelector('.pip-image');
        if (!entry.isIntersecting || !art) continue;
        art.animate([{ opacity: 0, transform: `translate3d(0, ${down ? 36 : -36}px, 0) rotate(${down ? 4 : -4}deg)` }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      }
    }, { threshold: 0.6 });
    document.querySelectorAll('[data-pip-station] .pip-seat__art').forEach((art) => observer.observe(art));
    return () => observer.disconnect();
  }, []);
  return null;
}

export default function PipJourneyLab() {
  const [current, setCurrent] = useState(2);
  const [mount, setMount] = useState(0);
  const pickerRef = useRef(null);
  const highlightRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    const v = parseInt(new URLSearchParams(window.location.search).get('v'), 10);
    if (v >= 1 && v <= VARIANTS.length) setCurrent(v - 1);
    requestAnimationFrame(() => requestAnimationFrame(() => pickerRef.current?.setAttribute('data-ready', '')));
  }, []);
  useLayoutEffect(() => {
    const move = () => { const el = itemRefs.current[current]; if (!el || !highlightRef.current) return; highlightRef.current.style.width = `${el.offsetWidth}px`; highlightRef.current.style.transform = `translateX(${el.offsetLeft}px)`; };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [current]);
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) choose(num - 1);
      else if (e.key === 'ArrowRight') choose((current + 1) % VARIANTS.length);
      else if (e.key === 'ArrowLeft') choose((current - 1 + VARIANTS.length) % VARIANTS.length);
      else if (e.key === 'r' || e.key === 'R') setMount((m) => m + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  function choose(i) {
    setCurrent(i); setMount((m) => m + 1);
    const url = new URL(window.location.href); url.searchParams.set('v', String(i + 1)); window.history.replaceState(null, '', url);
  }

  const Variant = [Lane, Perches, PipGuide][current];
  return (
    <div className="mm pj-root">
      <Page />
      <Variant key={`${current}-${mount}`} />
      <nav className="proto-picker" aria-label="Prototype variants" ref={pickerRef}>
        <span className="proto-picker-highlight" aria-hidden="true" ref={highlightRef} />
        {VARIANTS.map((name, i) => <button key={name} ref={(el) => { itemRefs.current[i] = el; }} className="proto-picker-item" data-active={i === current ? '' : undefined} aria-current={i === current ? 'true' : undefined} onClick={() => choose(i)}>{name}</button>)}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={() => setMount((m) => m + 1)}>↻</button>
      </nav>
    </div>
  );
}
