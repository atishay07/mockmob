"use client";

import { DemoPlaybackContext, TOUR_SCREENS } from '@/components/landing/TourScreens';

// One part's product screen on /features (19 Nov 2026, lane pub-c): the home tour's own screen (TourScreens.jsx), shown in its
// finished state. The tour's context is told `reduced`, so the screen rests on its last frame and plays nothing as the reader
// scrolls (tourSequence.mjs shownValue: reduced is finished). Its own controls still answer a tap, as on the home page.
const STILL = Object.freeze({ active: false, reduced: true, paused: false, epoch: 0, held: false });

export function FeatureScreen({ id }) {
  const Screen = TOUR_SCREENS[id];
  if (!Screen) return null;
  return (
    <DemoPlaybackContext.Provider value={STILL}>
      <Screen play={false} />
    </DemoPlaybackContext.Provider>
  );
}

export default FeatureScreen;
