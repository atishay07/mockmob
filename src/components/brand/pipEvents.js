import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * The state a page's Mobi needs. Use it like this (key restarts the same act):
 *   const mobi = useMobiScope('onboarding', 'hello');
 *   <MobiReact key={mobi.n} act={mobi.act} onDone={mobi.onDone} size={84} />
 * Once acts return to standing by themselves; held acts stay until the next mobiAct.
 */
export function useMobiScope(scope, initial = 'idle') {
  const [state, setState] = useState({ act: initial, n: 0 });
  const timer = useRef(0);
  useEffect(() => {
    const listen = (event) => {
      const detail = event.detail || {};
      if (detail.scope !== scope || !detail.act) return;
      window.clearTimeout(timer.current);
      setState((s) => ({ act: detail.act, n: s.n + 1 }));
      if (detail.hold > 0) timer.current = window.setTimeout(() => setState((s) => ({ act: 'idle', n: s.n })), detail.hold);
    };
    window.addEventListener('mobi:act', listen);
    return () => { window.removeEventListener('mobi:act', listen); window.clearTimeout(timer.current); };
  }, [scope]);
  const onDone = useCallback(() => setState((s) => (s.act === 'idle' ? s : { act: 'idle', n: s.n })), []);
  return { act: state.act, n: state.n, onDone };
}
