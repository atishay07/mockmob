"use client";
// Whether the Mob is on for this session (MOB_ENABLED, read on the server in the (app) layout and handed down). Off, the
// website never asks /api/mob anything: no request, no 404 in the console, no database read. Default is off.
import { createContext, useContext } from 'react';

const MobFlagContext = createContext(false);

export function MobFlagProvider({ enabled = false, children }) {
  return <MobFlagContext.Provider value={Boolean(enabled)}>{children}</MobFlagContext.Provider>;
}

export const useMobEnabled = () => useContext(MobFlagContext);
