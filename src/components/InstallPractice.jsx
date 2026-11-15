'use client';

// The home-screen offer. Two places:
//   Profile (no placement): the compact card as before, whenever the browser can install the site or on iPhone.
//   The result (placement="result", O6, 15 Nov 2026): one card under the next move, on the first result this device shows
//     the student, only on a phone, never inside an in-app browser, never once installed, never again after Not now
//     (src/components/result/installOffer.mjs holds the rules and the words).
// The browser's offer is captured for the whole tab by src/lib/installPrompt.js (Chrome fires it once per page load, often
// before this card mounts). The service worker (/sw.js, the offline page) is registered from wherever this card mounts.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { registerServiceWorker, runInstallPrompt, useInstallPrompt } from '@/lib/installPrompt';
import { INSTALL_COPY, INSTALL_KEY, installOffer, readRemembered, rememberDismissed, rememberOffered } from '@/components/result/installOffer.mjs';

const subscribe = callback => {
  const display = window.matchMedia('(display-mode: standalone)');
  const wide = window.matchMedia('(min-width: 1024px), (pointer: fine)');
  display.addEventListener('change', callback);
  wide.addEventListener('change', callback);
  window.addEventListener('appinstalled', callback);
  return () => {
    display.removeEventListener('change', callback);
    wide.removeEventListener('change', callback);
    window.removeEventListener('appinstalled', callback);
  };
};
const environment = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  ? 'installed' : /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'browser';
// For the result card: the device facts the rules read, as one string so the store compares by value.
const deviceFacts = () => JSON.stringify({
  standalone: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  desktop: window.matchMedia('(min-width: 1024px), (pointer: fine)').matches,
  ua: navigator.userAgent || '',
});
const SERVER_FACTS = JSON.stringify({ standalone: false, desktop: true, ua: '' });

function readMemory() {
  try { return readRemembered(window.localStorage.getItem(INSTALL_KEY)); } catch { return readRemembered(null); }
}
function writeMemory(value) {
  try { window.localStorage.setItem(INSTALL_KEY, JSON.stringify(value)); } catch { /* private mode: the card may show again, nothing breaks */ }
}

function ProfileCard() {
  const device = useSyncExternalStore(subscribe, environment, () => 'browser');
  const { canPrompt } = useInstallPrompt();
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  if (device === 'installed' || (!canPrompt && device !== 'ios')) return null;
  const install = async () => {
    if (device === 'ios') { setHelp(value => !value); return; }
    if (!canPrompt || busy) return;
    setBusy(true);
    try { await runInstallPrompt(); } finally { setBusy(false); }
  };
  return <aside className="na na--compact na--install" aria-label="Install MockMob">
    <div className="na__body">
      <b className="na__title">Keep practice close.</b>
      <p className="na__reason">Add MockMob to your home screen. Reconnect to reopen your record or submit a session.</p>
      {help ? <p role="status">In Safari, open Share, then choose Add to Home Screen.</p> : null}
    </div>
    <button type="button" className="pr-link" disabled={busy} onClick={install}>Add to home screen</button>
  </aside>;
}

function ResultCard({ attemptId }) {
  const facts = JSON.parse(useSyncExternalStore(subscribe, deviceFacts, () => SERVER_FACTS));
  const { canPrompt, installed } = useInstallPrompt();
  // What the device remembered, read once on the client (null until then, so the server and the first paint agree: no card).
  const [memory, setMemory] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMemory(readMemory()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const offer = memory ? installOffer({ attemptId, standalone: facts.standalone, installed, desktop: facts.desktop, ua: facts.ua, hasPrompt: canPrompt, remembered: memory }) : null;
  // Shown on this result: remembered, so no other result offers it again.
  useEffect(() => {
    if (!offer || !memory || memory.offeredOn === attemptId) return;
    const next = rememberOffered(memory, attemptId);
    writeMemory(next);
  }, [offer, memory, attemptId]);
  if (!offer) return null;
  const dismiss = () => {
    const next = rememberDismissed({ ...readMemory(), offeredOn: readMemory().offeredOn || attemptId });
    writeMemory(next);
    setMemory(next);
  };
  const install = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runInstallPrompt();
      // Answered either way in the browser's own dialog: the offer is spent, so the card goes for good.
      dismiss();
    } finally { setBusy(false); }
  };
  return (
    <aside className="rx-install" aria-labelledby="rx-install-title">
      {/* eslint-disable-next-line @next/next/no-img-element -- the 44 px home-screen icon itself, a static PWA file */}
      <img className="rx-install__icon" src="/pwa/icon-192.png" alt="" width="44" height="44" decoding="async" />
      <div className="rx-install__body">
        <h2 id="rx-install-title" className="rx-install__title">{INSTALL_COPY.title}</h2>
        <p className="rx-install__line">{INSTALL_COPY.line}</p>
        {offer.kind === 'ios' ? <p className="rx-install__steps">{INSTALL_COPY.ios}</p> : null}
        <div className="rx-install__keys">
          {offer.kind === 'prompt' ? <button type="button" className="btn-outline md rx-install__go mk-press" disabled={busy} aria-busy={busy || undefined} onClick={install}>{INSTALL_COPY.key}</button> : null}
          <button type="button" className="rx-install__later" onClick={dismiss}>{INSTALL_COPY.later}</button>
        </div>
      </div>
    </aside>
  );
}

export default function InstallPractice({ placement = 'profile', attemptId = null }) {
  useEffect(() => { registerServiceWorker(); }, []);
  return placement === 'result' ? <ResultCard attemptId={attemptId} /> : <ProfileCard />;
}
