"use client";
// Class leagues' switch on the page: CLASS_LEAGUES_ENABLED, read on the server (src/app/(app)/layout.js) and handed down, so
// while it is off no class surface mounts, fetches or draws anything, and every existing page is exactly as before (review,
// 16 Nov 2026). Outside a provider it reads off.
import { createContext, useContext } from 'react';

const ClassOn = createContext(false);

export function ClassLeagueSwitch({ on = false, children }) {
  return <ClassOn.Provider value={on === true}>{children}</ClassOn.Provider>;
}

export const useClassLeaguesOn = () => useContext(ClassOn);
