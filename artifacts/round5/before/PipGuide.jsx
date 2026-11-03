'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PipActor, pipAspect } from '@/components/brand/PipActor';

// Pip's perch handoff (scrollcraft/builds/mockmob-round4/BRIEF.md).
// Perches are server-rendered <MascotSeat station="…"> figures; their static pose is the
// no-JS and reduced-motion experience. When this guide runs, one Pip occupies one perch at a
// time (rendered into it, so it scrolls with the layout and costs nothing while resting).
// When another station takes the middle of the viewport, Pip travels there on a fixed flyer
// that re-reads the live target every frame, so scrolling mid-flight never causes a snap.
// Page components can ask for a reaction: window.dispatchEvent(new CustomEvent('pip:react',
// { detail: { station, mood } })). Pip only reacts where it is, and never while answering
// in the Arena (this component is marketing-only).

const BASE_H = 146;
const EYED = new Set(['greeting', 'pointing', 'encouraging']);
const REACTIONS = {
  celebrate: { pose: 'celebrating', motion: 'hop', ms: 1700 },
  encourage: { pose: 'encouraging', motion: 'nod', ms: 1900 },
  eureka: { pose: 'celebrating', motion: 'jump', ms: 1900 },
  nod: { pose: null, motion: 'nod', ms: 420 },
};

// Exact cubic-bezier curves (the shared motion tokens), solved per frame.
function bezier(x1, y1, x2, y2) {
  const a = (p1, p2) => 1 - 3 * p2 + 3 * p1, b = (p1, p2) => 3 * p2 - 6 * p1, c = (p1) => 3 * p1;
  const at = (t, p1, p2) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t, p1, p2) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  return (x) => {
    if (x <= 0 || x >= 1) return Math.min(1, Math.max(0, x));
    let t = x;
    for (let i = 0; i < 6; i += 1) { const s = slope(t, x1, x2); if (!s) break; t -= (at(t, x1, x2) - x) / s; }
    return at(Math.min(1, Math.max(0, t)), y1, y2);
  };
}
const EASE_IN_OUT = bezier(0.77, 0, 0.175, 1);
const EASE_OUT = bezier(0.23, 1, 0.32, 1);
const lerp = (a, b, t) => a + (b - a) * t;

function readStations() {
  return [...document.querySelectorAll('[data-pip-station]')].map((seat) => ({
    id: seat.dataset.pipStation,
    pose: seat.dataset.pipPose || 'greeting',
    art: seat.querySelector('.pip-seat__art'),
    zone: seat.closest('[data-pip-zone]') || seat.closest('section') || seat,
  })).filter((station) => station.art);
}

function actorRect(station, pose) {
  const r = station.art.getBoundingClientRect();
  const h = r.height;
  const w = h * pipAspect(pose);
  return { x: r.left + (r.width - w) / 2, y: r.top, h };
}

export default function PipGuide() {
  const [enabled, setEnabled] = useState(false);
  const [occupied, setOccupied] = useState(null);
  const [flying, setFlying] = useState(false);
  const [flightPose, setFlightPose] = useState('greeting');
  const [reaction, setReaction] = useState(null);
  const [motion, setMotion] = useState({ name: '', n: 0 });
  const [blink, setBlink] = useState(0);
  const stations = useRef(new Map());
  const flyerRef = useRef(null);
  const flight = useRef(null);
  const occupiedRef = useRef(null);
  const scrolled = useRef(false);
  const eurekaDone = useRef(false);
  const pending = useRef(null);
  const runReaction = useRef(() => {});

  const play = (name) => setMotion((m) => ({ name, n: m.n + 1 }));

  // Enable only with motion allowed; reduced motion keeps the static perches.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setEnabled(!query.matches && readStations().length > 0);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    scrolled.current = false;
    const onFirstScroll = () => { scrolled.current = true; };
    window.addEventListener('scroll', onFirstScroll, { passive: true, once: true });
    const list = readStations();
    stations.current = new Map(list.map((station) => [station.id, station]));
    const root = document.documentElement;

    function frame(now) {
      const f = flight.current;
      if (!f) return;
      const node = flyerRef.current;
      const p = Math.min(1, (now - f.t0) / f.dur);
      if (p >= 0.5 && !f.swapped) { f.swapped = true; f.pose = f.poseTo; setFlightPose(f.poseTo); }
      const to = actorRect(f.target, f.poseTo);
      const ex = EASE_IN_OUT(p);
      const ey = f.entering ? EASE_OUT(p) : ex;
      const x = lerp(f.start.x, to.x, ex);
      const y = lerp(f.start.y, to.y, ey) - f.lift * Math.sin(Math.PI * p);
      const h = lerp(f.start.h, to.h, ex);
      const s = h / BASE_H;
      const bw = BASE_H * pipAspect(f.pose);
      const lean = f.lean * Math.sin(Math.PI * p);
      f.now = { x, y, h };
      if (node) {
        node.style.transform = `translate3d(${(x - (bw / 2) * (1 - s)).toFixed(1)}px, ${(y - BASE_H * (1 - s)).toFixed(1)}px, 0) scale(${s.toFixed(4)}) rotate(${lean.toFixed(2)}deg)`;
        node.style.opacity = f.drop || f.entering ? String(Math.min(1, p * 2.6)) : '1';
      }
      if (p < 1) { f.raf = requestAnimationFrame(frame); return; }
      flight.current = null;
      occupiedRef.current = f.target.id;
      setOccupied(f.target);
      play('land');
      // Keep the flyer one more paint so the perch copy is already drawn underneath it.
      requestAnimationFrame(() => requestAnimationFrame(() => setFlying(false)));
      window.setTimeout(() => setBlink((b) => b + 1), 420);
    }

    function goTo(id) {
      const target = stations.current.get(id);
      if (!target || (occupiedRef.current === id && !flight.current)) return;
      if (flight.current?.target.id === id) return;
      const phone = window.matchMedia('(max-width: 760px)').matches;
      const fromStation = stations.current.get(occupiedRef.current);
      // First appearance before the visitor has scrolled: dock without ceremony (the static
      // pose was already there). Later first appearances drop in.
      if (!fromStation && !flight.current && !scrolled.current) {
        occupiedRef.current = id; setOccupied(target); return;
      }
      const vh = window.innerHeight;
      const to = actorRect(target, target.pose);
      let start = flight.current?.now || (fromStation ? actorRect(fromStation, fromStation.pose) : null);
      let entering = false;
      let drop = false;
      if (phone || !start) { start = { x: to.x, y: to.y - 32, h: to.h }; drop = true; }
      else if (start.y > vh + 20 || start.y + start.h < -20) {
        // The old perch is off screen, so a long crossing would mean nothing and would pass
        // over copy. Swoop in locally, from the side the visitor is scrolling from.
        const fromAbove = start.y < to.y;
        start = { x: to.x, y: to.y + (fromAbove ? -120 : 120), h: to.h };
        entering = true;
      }
      const dx = to.x - start.x, dy = to.y - start.y;
      const dist = Math.hypot(dx, dy);
      if (flight.current?.raf) cancelAnimationFrame(flight.current.raf);
      const poseFrom = flight.current?.pose || fromStation?.pose || target.pose;
      flight.current = {
        target, start, entering, drop,
        t0: performance.now(),
        // Development-only slow motion for frame-by-frame review (window.__pipSlow = 6).
        dur: (drop ? 460 : Math.min(900, Math.max(620, 520 + dist * 0.22))) * (process.env.NODE_ENV !== 'production' && window.__pipSlow ? window.__pipSlow : 1),
        lift: drop || entering ? 0 : Math.min(90, 26 + Math.abs(dy) * 0.05 + Math.abs(dx) * 0.05),
        lean: drop ? 0 : entering ? (dy > 0 ? -4 : 4) : Math.max(-8, Math.min(8, dx / 60)),
        pose: poseFrom, poseTo: target.pose, swapped: poseFrom === target.pose,
      };
      setReaction(null);
      pending.current = null;
      setFlightPose(poseFrom);
      setFlying(true);
      occupiedRef.current = null;
      setOccupied(null);
      flight.current.raf = requestAnimationFrame(frame);
    }

    // The station whose section crosses a thin band at the middle of the viewport leads.
    const byZone = new Map(list.map((station) => [station.zone, station.id]));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) goTo(byZone.get(entry.target));
    }, { rootMargin: '-46% 0px -46% 0px' });
    list.forEach((station) => observer.observe(station.zone));

    function onReact(event) {
      const { station, mood } = event.detail || {};
      const spec = REACTIONS[mood];
      if (!spec || station !== occupiedRef.current || flight.current) return;
      // A reaction to something the visitor did while Pip's perch was out of view is kept
      // briefly and played when the perch comes back on screen.
      if (root.dataset.pipPerchVisible === 'false') { if (mood !== 'nod') pending.current = { station, mood, at: performance.now() }; return; }
      if (mood === 'eureka') {
        if (eurekaDone.current) { play('nod'); return; }
        eurekaDone.current = true;
      }
      setReaction(spec.pose ? { pose: spec.pose, until: performance.now() + spec.ms } : null);
      play(spec.motion);
      if (spec.pose) window.setTimeout(() => setReaction((r) => (r && performance.now() >= r.until - 30 ? null : r)), spec.ms);
    }
    runReaction.current = (detail) => onReact({ detail });
    window.addEventListener('pip:react', onReact);
    root.dataset.pipGuide = 'on';
    return () => {
      observer.disconnect();
      window.removeEventListener('pip:react', onReact);
      window.removeEventListener('scroll', onFirstScroll);
      if (flight.current?.raf) cancelAnimationFrame(flight.current.raf);
      flight.current = null;
      delete root.dataset.pipGuide;
    };
  }, [enabled]);

  // Publish where Pip rests and whether that perch is on screen, so page components that
  // carry their own static Pip (the demo drill) can step aside: one Pip in view at a time.
  useEffect(() => {
    const root = document.documentElement;
    const art = occupied?.art;
    if (!enabled || !art) { delete root.dataset.pipPerch; delete root.dataset.pipPerchVisible; return undefined; }
    root.dataset.pipPerch = occupied.id;
    const observer = new IntersectionObserver(([entry]) => {
      root.dataset.pipPerchVisible = String(entry.isIntersecting);
      const queued = pending.current;
      if (entry.isIntersecting && queued) {
        pending.current = null;
        if (queued.station === occupied.id && performance.now() - queued.at < 10000) window.setTimeout(() => runReaction.current(queued), 240);
      }
    });
    observer.observe(art);
    return () => observer.disconnect();
  }, [enabled, occupied]);

  // A blink every few seconds while Pip rests on screen in an open-eyed pose.
  const restingPose = reaction?.pose || occupied?.pose;
  useEffect(() => {
    if (!enabled || !occupied || flying || !EYED.has(restingPose)) return undefined;
    let timer;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const r = occupied.art.getBoundingClientRect();
        if (r && r.bottom > 0 && r.top < window.innerHeight && document.visibilityState === 'visible') setBlink((b) => b + 1);
        schedule();
      }, 3400 + Math.random() * 3600);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [enabled, occupied, flying, restingPose]);

  if (!enabled) return null;
  const perch = occupied;
  const motionName = motion.name ? `${motion.name}-${motion.n % 2}` : '';
  return (
    <>
      {perch ? createPortal(<PipActor pose={restingPose} blink={blink} motion={motionName} className="pip-actor--perched" />, perch.art) : null}
      {flying ? createPortal(<span ref={flyerRef} className="pip-flyer" aria-hidden="true" style={{ '--pip-ar': pipAspect(flightPose) }}><PipActor pose={flightPose} /></span>, document.body) : null}
    </>
  );
}
