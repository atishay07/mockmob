import { HomeFonts } from './HomeFonts';

// The hero's ambient layers are gone (4 Nov 2026, LK68, slop C6 and M7): no hairline grid, no dot matrix and no volt dots lit
// by the pointer. The pointer's job moved to Mobi's gaze (his eyes follow a fine pointer, MobiReact). The close band keeps its own
// static hairline grid and dots in neutral ink (page.js). This component draws nothing in the hero; it is kept so page.js
// stays valid until the integrator swaps it for <HomeFonts />, and it carries the home page's Literata preload.
export function HeroBackdrop() {
  return <HomeFonts />;
}

export default HeroBackdrop;
