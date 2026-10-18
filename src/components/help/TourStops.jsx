"use client";
// How many stops the Guide has for this session (W-093). The shell reads the tour that will run (src/lib/appTour.mjs: Learn
// only while the lessons are on, the Mob only while the Mob is on) and hands the count down, so Help and FAQ never types a
// number into a sentence. No provider (a page drawn on its own) falls back to the full tour's count of the stops that always show.
import { createContext, useContext } from 'react';
import { tourSteps } from '@/lib/appTour.mjs';

const TourStopsContext = createContext(null);

export function TourStopsProvider({ count, children }) {
  return <TourStopsContext.Provider value={count}>{children}</TourStopsContext.Provider>;
}

export function useTourStops() {
  const count = useContext(TourStopsContext);
  return Number.isInteger(count) ? count : tourSteps().length;
}
