'use client';

// The Mobi of the shared states (Skeleton.jsx): waiting, failed, refused, empty. The same rules as
// the app's StateView and MobiLoader:
//   waiting  nothing for the first 300 ms (the space is held, nothing jumps), then he steps in and
//            stands; only a wait past 2 s gets the loading act
//   failed   a shrug once per run (MobiRation.oopsRun, 90 s), calm on every failed retry
//   refused  a settled "no" (a limit, a locked item): one shrug, then he stands
//   empty    nothing yet: he reads (an all-clear passes act="rest")

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import MobiReact from '@/components/brand/MobiReact';
import { useMobiGate, useWaitStage } from '@/lib/mobiHooks';
import { oopsRun } from '@/lib/mobiRation';
import { mobiMoment } from '@/lib/mobiMoments';

export function WaitingMobi({ size = 74 }) {
  const stage = useWaitStage(true);
  const act = stage === 'long' ? mobiMoment('waitLong') : stage === 'wait' ? 'appear' : 'idle';
  return (
    <div className="pip-state" data-stage={stage} style={{ opacity: stage === 'none' ? 0 : 1, transition: 'opacity 180ms ease-out' }}>
      <MobiReact act={act} size={size} />
    </div>
  );
}

export function FailedMobi({ size = 74 }) {
  const path = usePathname() || 'page';
  const act = useMobiGate(() => (oopsRun(`error:${path}`) ? mobiMoment('setback') : 'idle'), 'idle');
  return <div className="pip-state"><MobiReact act={act} size={size} /></div>;
}

export function RefusedMobi({ size = 74 }) {
  const [act, setAct] = useState(mobiMoment('refused'));
  return <div className="pip-state"><MobiReact act={act} size={size} onDone={() => setAct('idle')} /></div>;
}

export function EmptyMobi({ size = 74, act = 'read' }) {
  return <div className="pip-state"><MobiReact act={act} size={size} /></div>;
}
