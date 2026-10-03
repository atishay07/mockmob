'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribe = callback => {
  const display = window.matchMedia('(display-mode: standalone)');
  display.addEventListener('change', callback);
  window.addEventListener('appinstalled', callback);
  return () => {
    display.removeEventListener('change', callback);
    window.removeEventListener('appinstalled', callback);
  };
};
const environment = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  ? 'installed' : /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'browser';

export default function InstallPractice() {
  const device = useSyncExternalStore(subscribe, environment, () => 'browser');
  const [prompt, setPrompt] = useState(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const ready = event => { event.preventDefault(); setPrompt(event); };
    const done = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', done);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  if (device === 'installed' || (!prompt && device !== 'ios')) return null;
  const install = async () => {
    if (device === 'ios') { setHelp(value => !value); return; }
    if (!prompt || busy) return;
    setBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; }
    finally { setPrompt(null); setBusy(false); }
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
