"use client";
// Mobi in a fixed slot beside the repair. He is the shared MobiReact (the same art, acts, marks and
// settings as everywhere else); this file only decides which act the repair state earns, the same
// table as the app's RepairMobi:
//   thinking while the request runs, a slower loop once it is slow, one "correct" for a repair the
//   server acknowledged (once per mistake, never again on a rebuild or a return), a wave for a
//   reopened stored repair, a shrug that turns into encouragement after a failure, and rest when
//   there is nothing to explain.
// Decorative: every state is also said in text beside him, so he is hidden from assistive technology.
// The slot keeps its size in every state, so nothing below it moves. Celebrations Off hides him; the
// words carry the same facts. Only the mistake on screen shows him, so there is one Mobi at a time.
import { useEffect, useRef, useState } from 'react';
import MobiReact from '@/components/brand/MobiReact';
import { SPEC } from '@/components/brand/mobiActs';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { repairMood } from '@/../data/repair_presentation.mjs';
import { REPAIR_MOBI_MOOD, cheerGate, repairAct, tapAct } from './repairRun';

const OOPS_HOLD_MS = 1400;
const TAP_WINDOW_MS = 900;

export default function RepairMobi({ status, slow = false, stepKey = '', visible = true }) {
  const prefs = useMobiPrefs();
  // "oops" lasts a beat, then becomes encouragement. The clock restarts whenever the status changes.
  const [settled, setSettled] = useState({ status, at: 0 });
  useEffect(() => {
    if (status !== 'error' && status !== 'waiting') return undefined;
    const t = setTimeout(() => setSettled({ status, at: OOPS_HOLD_MS }), OOPS_HOLD_MS);
    return () => { clearTimeout(t); setSettled({ status, at: 0 }); };
  }, [status]);
  const mood = repairMood(status, { slow, settledFor: settled.status === status ? settled.at : 0 });

  // Once per mistake: the page remembers that this mistake was celebrated, so a rebuild, folding the row or
  // coming back to it shows him standing, not celebrating again. `fresh` is what the page knew when this
  // instance appeared; the claim is made once the repair is on screen.
  const [fresh] = useState(() => !cheerGate.has(stepKey));
  useEffect(() => { if (mood === 'correct') cheerGate.claim(stepKey); }, [mood, stepKey]);
  const cheered = mood === 'correct' && !fresh;
  const earned = repairAct(mood, { cheered });

  // A once act plays and then he stands again (the pose is held for the act's length under Reduce motion).
  const [held, setHeld] = useState(null);
  useEffect(() => {
    const spec = earned ? SPEC[earned] : null;
    if (!spec || spec.held) return undefined;
    const t = setTimeout(() => setHeld(earned), spec.ms);
    return () => clearTimeout(t);
  }, [earned]);
  const base = earned && held === earned && !SPEC[earned]?.held ? 'idle' : earned;

  // A tap answers with a small nod; three quick taps a tilt, or a cheer once a repair is acknowledged.
  const [play, setPlay] = useState(null);
  const taps = useRef({ n: 0, at: 0 });
  useEffect(() => {
    if (!play) return undefined;
    const t = setTimeout(() => setPlay(null), SPEC[play.act]?.ms || 700);
    return () => clearTimeout(t);
  }, [play]);
  function onTap() {
    const now = Date.now();
    taps.current = now - taps.current.at <= TAP_WINDOW_MS ? { n: taps.current.n + 1, at: now } : { n: 1, at: now };
    const act = tapAct({ taps: taps.current.n, acknowledged: status === 'explained' || status === 'stored' });
    setPlay((p) => ({ act, n: (p?.n || 0) + 1 }));
  }

  if (!mood || !visible || prefs.celebrations === 'off') return null;
  const act = play ? play.act : base;
  return (
    <span className="mr-mobi" aria-hidden="true" data-mood={mood} data-act={act} onClick={onTap}>
      <MobiReact key={play ? `play-${play.n}` : 'base'} act={act} size={72} mood={REPAIR_MOBI_MOOD[mood] || 'calm'} />
    </span>
  );
}
