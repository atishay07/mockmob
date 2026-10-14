import { useCallback, useEffect, useRef, useState } from 'react';
import { stanceAfter } from './mobiActs';

// Ask the homepage guide for a reaction. The guide queues it until Pip settles at
// the visible station. Pages without the guide (including the Arena) are inert.
export function pipReact(station, mood) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pip:react', { detail: { station, mood } }));
}

// Ask the Mobi of a page to do something (see MobiReact for the acts), from anywhere on that page:
//   mobiAct('onboarding', 'nod')                  play once
//   mobiAct('onboarding', 'read', { hold: 1800 }) hold, then stand at ease after 1.8 s
// The page's own Mobi listens with useMobiScope('onboarding'). Nothing happens if no Mobi listens.
export function mobiAct(scope, act, { hold = 0 } = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('mobi:act', { detail: { scope, act, hold } }));
}

// What he rests in after an act: a held act is its own stance, a once act leaves him standing (or
// pointing, after a nudge), and a nod, tilt or startle leaves him in whatever he was in.
function stanceFor(act, current) {
  const after = stanceAfter(act);
  // A wait is not somewhere he returns to: after a nod or a tilt on top of it he stands.
  return after === null ? (current === 'loading' ? 'idle' : current) : after;
}

/**
 * The state a page's Mobi needs. Use it like this (key restarts the same act):
 *   const mobi = useMobiScope('onboarding', 'hello');
 *   <MobiReact key={mobi.n} act={mobi.act} onDone={mobi.onDone} size={84} />
 * Once acts return to the stance he was in (standing, or a held act) by themselves, the way the
 * app does; held acts stay until the next mobiAct.
 */
export function useMobiScope(scope, initial = 'idle') {
  const [state, setState] = useState(() => ({ act: initial, n: 0, stance: stanceAfter(initial) || 'idle' }));
  const timer = useRef(0);
  useEffect(() => {
    const listen = (event) => {
      const detail = event.detail || {};
      if (detail.scope !== scope || !detail.act) return;
      window.clearTimeout(timer.current);
      setState((s) => ({ act: detail.act, n: s.n + 1, stance: stanceFor(detail.act, s.stance) }));
      if (detail.hold > 0) timer.current = window.setTimeout(() => setState((s) => ({ act: 'idle', n: s.n, stance: 'idle' })), detail.hold);
    };
    window.addEventListener('mobi:act', listen);
    return () => { window.removeEventListener('mobi:act', listen); window.clearTimeout(timer.current); };
  }, [scope]);
  const onDone = useCallback(() => setState((s) => (s.act === s.stance ? s : { ...s, act: s.stance })), []);
  return { act: state.act, n: state.n, onDone };
}
