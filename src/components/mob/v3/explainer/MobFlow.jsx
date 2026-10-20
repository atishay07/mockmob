"use client";
// One frame for the explainer and the setup that follows it, so going from slide 7 (or Skip) to the setup is a fade inside
// the same panel. The seen flag lives here (per account, per device: explainerModel.createSeenGate over localStorage);
// it is set on slide 7 or Skip (or an end key), never on Escape or a click outside the panel.
//   onClose(destination): 'd0' (Escape or Back on the setup's first step), 'join' (the code screen), 'invite' (the invite
//   page, its code filled), 'den' (a replay ends), 'created' (the server has the new Mob), 'subjects' (no subjects yet).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSeenGate, marksSeen } from './explainerModel.mjs';
import { ExplainerFrame } from './ExplainerFrame';
import { MobExplainer } from './MobExplainer';
import { MobSetup } from './MobSetup';
import { prefersReducedMotion } from './motion';

// One gate per page: a failed store still remembers this session's marks, so the explainer never loops.
const gate = createSeenGate(() => (typeof window === 'undefined' ? null : window.localStorage));
export const explainerSeen = (userId) => gate.seen(userId);
export const markExplainerSeen = (userId) => gate.mark(userId);

/**
 * mode: start | join | invite | replay. screen: where it opens ('explainer' or 'setup'). userId: whose flag.
 * subjects, suggestedName, seatFold, run, busy: for the setup; setupHere false: Start your Mob closes with 'setup' (the invite page
 * sends the student to /mob for it). reducedMotion: forced (the preview); else the system setting.
 */
export function MobFlow({ mode = 'start', screen: first = 'explainer', userId, mobName = null, billingOn = false, subjects = [], suggestedName = '', seatFold = null, run, busy,
  onClose, reducedMotion = null, startSlide = 0, setupInitial = null, onApi = null, setupHere = true }) {
  const [screen, setScreen] = useState(first);
  const [reduced] = useState(() => (reducedMotion == null ? prefersReducedMotion() : Boolean(reducedMotion)));
  const body = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const mark = useCallback(() => { if (userId) gate.mark(userId); }, [userId]);
  const leave = useCallback((dest, how) => {
    if (marksSeen(how)) mark();
    if (dest === 'setup') {
      if (!setupHere) { closeRef.current?.('setup'); return; }
      if (!subjects.length) { closeRef.current?.('subjects'); return; }
      setScreen('setup');
      return;
    }
    closeRef.current?.(dest);
  }, [mark, subjects.length, setupHere]);
  // the fade-through from the explainer to the setup (210 ms in), and focus on the setup's first question
  useEffect(() => {
    const el = body.current;
    if (!el || screen === first) return;
    el.animate([{ opacity: 0, transform: reduced ? 'none' : 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: reduced ? 120 : 210, easing: 'cubic-bezier(.23,1,.32,1)' });
    (el.querySelector('.mx-pane__title') || el.querySelector('button'))?.focus({ preventScroll: true });
  }, [screen, first, reduced]);
  return (
    <ExplainerFrame label={screen === 'explainer' ? 'How the Mob works' : 'Start a Mob'} onEscape={() => closeRef.current?.('d0')}>
      <div ref={body} key={screen} className="mx-abs" style={{ inset: 0 }} data-screen={screen}>
        {screen === 'explainer' ? (
          <MobExplainer mode={mode} mobName={mobName} billingOn={billingOn} reduced={reduced} startSlide={startSlide} onApi={onApi}
            onLast={mark} onLeave={leave} />
        ) : (
          <MobSetup subjects={subjects} suggestedName={suggestedName} seatFold={seatFold} run={run} busy={busy} reduced={reduced} initial={setupInitial}
            onExit={() => closeRef.current?.('d0')} onCreated={() => closeRef.current?.('created')} />
        )}
      </div>
    </ExplainerFrame>
  );
}

export default MobFlow;
