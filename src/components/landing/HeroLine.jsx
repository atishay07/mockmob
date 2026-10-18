"use client";

import { useSyncExternalStore } from 'react';
import { HeroMorph } from './HeroMorph';
import { HeroType } from './HeroType';

// Which changing line the hero shows (D115: option C, "select and type", stays off in production until the owner has
// seen it live). The page picks the mode on the server with heroMotionMode() (heroPhrases.mjs):
//   'v1'      the page mounts HeroMorph itself, exactly as released, and never this component.
//   'v2'      option C for everyone.
//   'preview' the live line, switching to option C after hydration when the address carries ?hero=v2. Only a preview
//             build gets this mode, so ?hero=v2 does nothing on production.
const noop = () => () => {};
const asksForV2 = () => {
  try { return new URLSearchParams(window.location.search).get('hero') === 'v2'; } catch { return false; }
};

export function HeroLine({ mode = 'v1' }) {
  const v2 = useSyncExternalStore(noop, () => mode === 'v2' || (mode === 'preview' && asksForV2()), () => mode === 'v2');
  return v2 ? <HeroType /> : <HeroMorph />;
}
