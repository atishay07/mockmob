"use client";

import { Suspense, lazy, useSyncExternalStore } from 'react';
import { HeroMorph } from './HeroMorph';
import { asksForHeroV2 } from './heroPhrases.mjs';

// Which changing line the hero shows (D115: option C, "select and type", ships OFF; the owner sees it live on the
// production site through ?hero=v2 before it is switched on). The page picks the mode on the server with
// heroMotionMode() (heroPhrases.mjs):
//   'preview' (the default) the released line, served exactly as before. After hydration, an address carrying
//             ?hero=v2 swaps in option C. Both start on "No more guessing.", so the swap shows nothing.
//   'v2'      option C for everyone, served with the page.
//   'v1'      the page mounts HeroMorph itself and never this component.
// Option C is its own chunk (lazy): a visitor without ?hero=v2 never downloads its code.
const HeroType = lazy(() => import('./HeroType').then((m) => ({ default: m.HeroType })));
const noop = () => () => {};

export function HeroLine({ mode = 'preview' }) {
  const v2 = useSyncExternalStore(
    noop,
    () => mode === 'v2' || (mode === 'preview' && asksForHeroV2(window.location.search)),
    () => mode === 'v2',
  );
  if (!v2) return <HeroMorph />;
  return (
    <Suspense fallback={<HeroMorph />}>
      <HeroType />
    </Suspense>
  );
}
