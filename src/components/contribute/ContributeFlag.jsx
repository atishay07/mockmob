"use client";
// Whether the contribution features are on for this session (CONTRIBUTE_ENABLED, read on the server in the (app) layout and
// handed down, as MobFlag does for the Mob). Default is off: Contribute, My uploads, the Practice "Add a question" panel and
// the vote arrows are not drawn, and nothing asks /api/questions/mine for a list nobody can open.
import { createContext, useContext } from 'react';

const ContributeFlagContext = createContext(false);

export function ContributeFlagProvider({ enabled = false, children }) {
  return <ContributeFlagContext.Provider value={Boolean(enabled)}>{children}</ContributeFlagContext.Provider>;
}

export const useContributeEnabled = () => useContext(ContributeFlagContext);
