"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PipActor } from '@/components/brand/PipActor';
import './shell.css';

// The guide (owner decision D16): Practice, Today and Review in plain words, then where everything
// else lives. It opens by itself once for a new member (no scored session yet, <html
// data-visitor-stage='first'>), is skippable, and never opens by itself again on this device.
// The Guide row in the account menu opens it any time.
export const TOUR_STEPS = [
  { title: 'Practice', target: 'nav-dashboard', body: 'Pick a subject and how many questions, then start a timed session. Every answer is marked on the server.' },
  { title: 'Today', target: 'nav-today', body: 'Your next useful step: what to practise now and what is due for another look.' },
  { title: 'Review', target: 'nav-review', body: 'Go back over the questions you missed, then check them again on fresh questions.' },
  { title: 'Everything else', target: ['nav-more', 'nav-tools'], body: 'Weak chapters, DU Compass, saved questions and the rest are under More. Your account is the circle at the top.' },
];
// Mobi guides the tour only (rare, so it may have character); it nods on each step.
const TOUR_POSES = ['greeting', 'encouraging', 'thinking', 'celebrating'];

// Scoped to the account. Without a signed-in user there is nothing to remember (and no tour).
const seenKey = (userId) => `mockmob_app_tour_seen_${userId}`;

function visibleTarget(targets) {
  for (const target of [].concat(targets)) {
    const node = [...document.querySelectorAll(`[data-tour="${target}"]`)].find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (node) return node;
  }
  return null;
}

export function useGuideTour({ userId, ready }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Once, for a new member, after the shell is on screen.
  useEffect(() => {
    if (!ready || !userId) return undefined;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      try {
        if (document.documentElement.dataset.visitorStage !== 'first') return;
        if (window.localStorage.getItem(seenKey(userId)) === 'true') return;
        window.localStorage.setItem(seenKey(userId), 'true');
      } catch { return; }
      setStep(0);
      setOpen(true);
    });
    return () => { alive = false; };
  }, [ready, userId]);

  const start = useCallback(() => { setStep(0); setOpen(true); }, []);
  const close = useCallback(() => {
    setOpen(false);
    setStep(0);
    if (!userId) return;
    try { window.localStorage.setItem(seenKey(userId), 'true'); } catch { /* storage is optional */ }
  }, [userId]);
  return useMemo(() => ({ open, step, setStep, start, close }), [open, step, start, close]);
}

export function GuideTour({ tour }) {
  const { open, step, setStep, close } = tour;
  const [rect, setRect] = useState(null);
  const headingRef = useRef(null);
  const returnRef = useRef(null);

  // Focus: the dialog takes focus when it opens (the step heading, so a screen reader reads the
  // step) and gives it back to whatever opened it when it closes. The page stays reachable behind
  // the veils (they are click-through), so the dialog is non-modal and does not trap Tab.
  useEffect(() => {
    if (!open) return undefined;
    returnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const back = returnRef.current;
      returnRef.current = null;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  useEffect(() => {
    if (!open) return undefined;
    let timer = 0;
    let frame = 0;
    // Measure only; scrolling happens once per step, so the guide never fights the student's scroll.
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = visibleTarget(TOUR_STEPS[step].target);
        if (!node) { setRect(null); return; }
        const box = node.getBoundingClientRect();
        const pad = 8;
        const cardWidth = Math.min(380, window.innerWidth - 32);
        const cardHeight = 250;
        const below = box.bottom + 18 + cardHeight < window.innerHeight;
        setRect({
          left: Math.max(8, box.left - pad),
          top: Math.max(8, box.top - pad),
          width: box.width + pad * 2,
          height: box.height + pad * 2,
          cardLeft: Math.min(Math.max(16, box.left), Math.max(16, window.innerWidth - cardWidth - 16)),
          cardTop: below ? box.bottom + 18 : Math.max(16, box.top - cardHeight - 18),
        });
      });
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    visibleTarget(TOUR_STEPS[step].target)?.scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'instant' : 'smooth' });
    timer = window.setTimeout(measure, reduce ? 0 : 220);
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, step, close]);

  if (!open) return null;
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  return (
    <div className="shell-tour" role="dialog" aria-modal="false" aria-labelledby="shell-tour-title">
      {rect ? (
        <>
          <div className="shell-tour__veil" style={{ left: 0, right: 0, top: 0, height: rect.top }} />
          <div className="shell-tour__veil" style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }} />
          <div className="shell-tour__veil" style={{ left: rect.left + rect.width, right: 0, top: rect.top, height: rect.height }} />
          <div className="shell-tour__veil" style={{ left: 0, right: 0, top: rect.top + rect.height, bottom: 0 }} />
          <div className="shell-tour__ring" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />
        </>
      ) : (
        <div className="shell-tour__veil" style={{ inset: 0 }} />
      )}
      <div className="shell-tour__card" style={rect ? { left: rect.cardLeft, top: rect.cardTop } : { left: 16, bottom: 16 }}>
        <div className="shell-tour__head">
          <span className="arena-tour-pip"><PipActor pose={TOUR_POSES[step] || 'greeting'} blink={step + 1} motion={step ? `nod-${step % 2}` : 'land-0'} /></span>
          <div className="shell-tour__heading">
            <p className="shell-tour__count">Step {step + 1} of {TOUR_STEPS.length}</p>
            <h2 id="shell-tour-title" ref={headingRef} tabIndex={-1}>{current.title}</h2>
          </div>
          <button type="button" className="shell-tour__close" onClick={close} aria-label="Close guide">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <p className="shell-tour__body">{current.body}</p>
        <div className="shell-tour__progress" aria-hidden="true">
          <span style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }} />
        </div>
        <div className="shell-tour__actions">
          <button type="button" className="shell-btn shell-btn--quiet" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>
          {last ? (
            <button type="button" className="shell-btn" onClick={close}>Finish</button>
          ) : (
            <button type="button" className="shell-btn" onClick={() => setStep((value) => Math.min(TOUR_STEPS.length - 1, value + 1))}>Next</button>
          )}
        </div>
      </div>
    </div>
  );
}
