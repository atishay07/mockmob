'use client';

import { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Mascot } from './Mascot';
import MobiReact from './MobiReact';
import { useMobiGate } from '@/lib/mobiHooks';
import { greeting } from '@/lib/mobiRation';
import { useInView } from '@/lib/motion/useInView';

// One Mobi per screen. A screen that already has its Mobi wraps the rest in <OneMobi> and every
// companion below it keeps its words and drops the art.
const OneMobiContext = createContext(false);
export function OneMobi({ children }) {
  return <OneMobiContext.Provider value>{children}</OneMobiContext.Provider>;
}

const HELD_NOW = new Set(['think', 'loading', 'sleepy', 'sleep', 'rest', 'read', 'listen']);

// A companion that was handed an act greets the way the app's screens do: asleep or sleepy late at
// night, a hello the first time today, then he is just there. Asked once, after mount.
function EventCompanion({ act, size, mood, screen }) {
  const entrance = useMobiGate(() => greeting(screen, 'idle'), 'idle');
  // A moment lands when he is in view: below the fold on a phone (or pushed there when the page fills in) he stands at
  // ease until the student reaches him, so a hello or a proud is not spent off screen. Once it has played it is done.
  // Held states (a wait, sleep) show at once.
  const [seenRef, seen] = useInView({ once: false, threshold: 0.6 });
  // The student's real state (a plan loading, a fetch that failed) always beats the entrance.
  const wanted = act && act !== 'idle' ? act : entrance;
  const base = seen || HELD_NOW.has(wanted) ? wanted : 'idle';
  // A once act that has finished leaves him standing, not frozen in its pose, and stays done while it is still the
  // act he was handed, however often he scrolls in and out of view.
  const [doneFor, setDoneFor] = useState(null);
  if (doneFor && doneFor !== wanted) setDoneFor(null);
  const shown = doneFor === wanted ? 'idle' : base;
  return <span ref={seenRef} className="arena-companion__seen" style={{ display: 'inline-grid', placeItems: 'end center' }}><MobiReact act={shown} size={size} mood={base === 'sleepy' || base === 'sleep' ? 'sleepy' : mood} interactive onDone={(played) => { if (played === wanted) setDoneFor(wanted); }} /></span>;
}

/**
 * A quiet companion. All supplied facts belong to the parent server readout.
 * Pass `act` (see MobiReact) to let him do something; the Celebrations and Reduce motion settings
 * apply either way (the still art follows the Celebrations level through Mascot).
 * Pass `mobi={false}` (or sit inside <OneMobi>) when the screen already has its one Mobi.
 */
export default function ArenaCompanion({ pose = 'attentive', act, title = 'One step at a time.', children, compact = false, mobi = true, mood = 'calm' }) {
  const quiet = useContext(OneMobiContext) || !mobi;
  const path = usePathname() || 'screen';
  const size = compact ? 100 : 128;
  return <aside className={`arena-companion${compact ? ' arena-companion--compact' : ''}`} aria-label="Mobi, your study companion">
    {quiet ? null : <div className="arena-companion__art">{act ? <EventCompanion act={act} size={size} mood={mood} screen={path} /> : <Mascot pose={pose} />}</div>}
    <div><b>{title}</b>{children ? <p>{children}</p> : null}</div>
  </aside>;
}
