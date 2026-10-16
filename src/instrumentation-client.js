// Client instrumentation (Next runs this before hydration). One job: give every arena navigation its
// page transition. Next calls onRouterTransitionStart inside the navigation's React Transition, which
// is the one place a transition type can be added for links this file does not own (in-page links,
// router.push, the back button). The rule itself is src/lib/motion/placeTransition.js; the motion is
// drawn in motion-kit.css (PAGE TRANSITIONS) and played by the <ViewTransition> in AppLayoutClient.
import * as React from 'react';
import { navigationTypesFor } from '@/lib/motion/placeTransition';

// Read from a copy of the module at run time: a named read (React.addTransitionType) is checked against the stable
// React's export list by the production build and fails it, although the app's React carries one of the two names.
const reactApi = { ...React };
const addType = reactApi.addTransitionType || reactApi.unstable_addTransitionType;
let lastHref = typeof window === 'undefined' ? null : window.location.href;
let browserDrewBack = false;

if (typeof window !== 'undefined') {
  // A swipe back on iOS Safari (and Chrome's back preview) already slides the page: never add ours on top.
  window.addEventListener('popstate', (event) => { browserDrewBack = Boolean(event.hasUAVisualTransition); }, { capture: true });
}

export function onRouterTransitionStart(url, navigationType) {
  try {
    // Before a push the address bar still shows where the student is; on traverse it already shows where they go.
    const from = navigationType === 'traverse' ? lastHref : window.location.href;
    const to = new URL(url, window.location.href).href;
    lastHref = to;
    if (typeof addType !== 'function') return;
    if (navigationType === 'traverse' && browserDrewBack) { browserDrewBack = false; return; }
    const types = navigationTypesFor(from, to);
    if (!types.length) return;
    // Where the old page sat, so its picture leaves from where the student saw it (AppLayoutClient
    // measures the new page against this once it lands at its own scroll).
    document.documentElement.dataset.mmVtFromY = String(Math.round(window.scrollY));
    document.documentElement.dataset.mmVtNav = navigationType;
    for (const type of types) addType(type);
  } catch {
    // A transition is decoration: navigation must never fail because of it.
  }
}
