'use client';

import { useState, useSyncExternalStore } from 'react';
import { cleanUrl } from './cleanUrl';
import './app.css';

const KEY = 'mm_app_nudge_dismissed_at';
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

// NEXT_PUBLIC values are inlined at build time, so these must be literal property reads.
function configuredUrl() {
  const store = cleanUrl(process.env.NEXT_PUBLIC_PLAY_STORE_URL);
  if (store) return { href: store, label: 'Get it on Google Play', beta: false };
  const beta = cleanUrl(process.env.NEXT_PUBLIC_PLAY_TESTING_URL);
  if (beta) return { href: beta, label: 'Join the Android beta', beta: true };
  return null;
}

function recentlyDismissed() {
  try {
    const at = Number(window.localStorage.getItem(KEY));
    return Boolean(at) && Date.now() - at < DAYS_30;
  } catch {
    return false;
  }
}

const subscribe = () => () => {};
function eligibleNow() {
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && !/\bwv\b/i.test(ua) && !recentlyDismissed();
}

/**
 * Small inline prompt for value moments. Callers pass `show` only after a result or sample, never on
 * a first visit before any value. Renders only on Android browsers (not WebViews) with a URL configured.
 */
export function AppNudge({ show = false, className = '' }) {
  const [dismissed, setDismissed] = useState(false);
  const cta = configuredUrl();
  const eligible = useSyncExternalStore(subscribe, eligibleNow, () => false);
  const ready = eligible && !dismissed;

  if (!show || !cta || !ready) return null;

  function dismiss() {
    try { window.localStorage.setItem(KEY, String(Date.now())); } catch {}
    setDismissed(true);
  }

  return (
    <aside className={`app-nudge ${className}`.trim()} aria-label="MockMob Android app">
      <p className="app-nudge__text">{cta.beta ? 'MockMob has an Android beta with a next step for tonight, a result recap and offline review. It is a test version.' : 'Get tonight’s next step, a recap after each mock and offline review in the MockMob Android app.'}</p>
      <div className="app-nudge__actions">
        <a href={cta.href} className="mm-btn mm-btn--secondary" rel="noopener">{cta.label}</a>
        <button type="button" className="app-nudge__dismiss" onClick={dismiss}>Not now</button>
      </div>
    </aside>
  );
}

export default AppNudge;
