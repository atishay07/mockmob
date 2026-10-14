"use client";
// Mobi in a fixed slot above the repair outcome. It reacts to what the server actually returned: thinking while the
// request runs, a slower loop once it is slow, a cheer only for a server-acknowledged repair, a wave for a reopened
// stored repair, an "oops" that turns into encouragement on a failure, and rest when there is nothing to explain.
// Decorative: every state is also said in text beside it, so it is hidden from assistive technology.
// The slot keeps its size in every state, so nothing below it moves when the mood changes.
import { useEffect, useState } from 'react';
import { Mascot } from '@/components/brand/Mascot';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { repairMood } from '@/../data/repair_presentation.mjs';

const POSE = { think: 'thinking', loading: 'thinking', correct: 'celebrating', hello: 'greeting', oops: 'attentive', encourage: 'encouraging', rest: 'idle' };

export default function RepairMobi({ status, slow = false }) {
  const prefs = useMobiPrefs();
  const [settled, setSettled] = useState({ status, at: 0 });
  const [nudge, setNudge] = useState(0);
  // "oops" lasts a beat, then becomes encouragement. The clock restarts whenever the status changes.
  useEffect(() => {
    if (status !== 'error' && status !== 'waiting') return undefined;
    const t = setTimeout(() => setSettled({ status, at: 1400 }), 1400);
    return () => { clearTimeout(t); setSettled({ status, at: 0 }); };
  }, [status]);
  const mood = repairMood(status, { slow, settledFor: settled.status === status ? settled.at : 0 });
  if (!mood) return null;
  // Under Celebrations Quiet or Off the cheer plays as a small nod; the pose stays truthful.
  const act = mood === 'correct' && !prefs.allow('celebrate') ? 'nod' : mood;
  return (
    <span className="mr-mobi" aria-hidden="true" data-mood={mood} data-act={act} data-nudge={nudge % 2} onClick={() => setNudge(n => n + 1)}>
      <span className="mr-mobi__body" key={`${mood}-${nudge}`}>
        <Mascot pose={POSE[mood]} alt="" />
      </span>
    </span>
  );
}
