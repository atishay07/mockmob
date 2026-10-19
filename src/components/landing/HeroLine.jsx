"use client";

import { Suspense, lazy, useSyncExternalStore } from 'react';
import { HeroMorph } from './HeroMorph';
import { asksForHeroV2, asksForHeroV3 } from './heroPhrases.mjs';

// Which changing line the hero shows (D115: option C, "select and type", ships OFF; the owner sees it live on the
// production site through ?hero=v2 before it is switched on; D119: ?hero=v3 is last year's melt on today's line, also
// preview only). The page picks the mode on the server with heroMotionMode() (heroPhrases.mjs):
//   'preview' (the default) the released line, served exactly as before. After hydration, an address carrying
//             ?hero=v2 swaps in option C and ?hero=v3 the melt. All start on "No more guessing.", so the swap shows
//             nothing.
//   'v2'      option C for everyone, served with the page.
//   'v1'      the page mounts HeroMorph itself and never this component.
// Option C and the melt are their own chunks (lazy): a visitor without the address never downloads their code.
const HeroType = lazy(() => import('./HeroType').then((m) => ({ default: m.HeroType })));
const HeroMelt = lazy(() => import('./HeroMelt').then((m) => ({ default: m.HeroMelt })));
const noop = () => () => {};

export function HeroLine({ mode = 'preview' }) {
  const pick = useSyncExternalStore(
    noop,
    () => (asksForHeroV3(window.location.search) ? 'v3' : mode === 'v2' || (mode === 'preview' && asksForHeroV2(window.location.search)) ? 'v2' : ''),
    () => (mode === 'v2' ? 'v2' : ''),
  );
  if (!pick) return <HeroMorph />;
  const Line = pick === 'v3' ? HeroMelt : HeroType;
  return (
    <Suspense fallback={<HeroMorph />}>
      <Line />
    </Suspense>
  );
}
