"use client";

// The browser's install offer, captured once for the whole tab (O6, 15 Nov 2026).
//
// Chrome fires beforeinstallprompt once per page load, as soon as the site can be installed. The signed-in site is one
// page load followed by in-app navigations, so a listener that only starts when the result (or Profile) mounts misses an
// event that already fired on Today or Practice. This module starts listening as soon as it is first imported in the
// browser and keeps the event for whichever card asks later. Import it from the app shell so it listens from the first
// screen; until then it listens from the first card that imports it.
//   useInstallPrompt()      { canPrompt, installed }: a captured offer is waiting / the browser said appinstalled
//   runInstallPrompt()      opens the browser's own install dialog once: 'accepted' | 'dismissed' | 'unavailable'
//   registerServiceWorker() /sw.js (the offline page), production only; safe to call from anywhere, any number of times
import { useSyncExternalStore } from 'react';

let deferred = null;
let installed = false;
let snapshot = { canPrompt: false, installed: false };
const listeners = new Set();
const SERVER = { canPrompt: false, installed: false };

function publish() {
  snapshot = { canPrompt: Boolean(deferred), installed };
  for (const listener of [...listeners]) listener();
}

export function captureInstallPrompt() {
  if (typeof window === 'undefined' || window.__mmInstallCapture) return;
  window.__mmInstallCapture = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    // Kept for the card's own key instead of the browser's mini bar.
    event.preventDefault();
    deferred = event;
    publish();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    publish();
  });
}

captureInstallPrompt();

function subscribe(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useInstallPrompt() {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER);
}

export async function runInstallPrompt() {
  const event = deferred;
  if (!event) return 'unavailable';
  // A captured offer opens its dialog once; it is spent whatever the answer.
  deferred = null;
  publish();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'unavailable';
  }
}

let registered = false;
export function registerServiceWorker() {
  if (registered || typeof window === 'undefined' || process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  registered = true;
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => { registered = false; });
}
