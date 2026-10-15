// Tiny client helper for the aggregate landing funnel. Call it from any client code:
//   import { trackFunnel } from '@/lib/funnel';
//   trackFunnel('sample_started');
// It sends only the step name, with navigator.sendBeacon, once per step per page load. It sets no
// cookie, reads no cookie, sends no id, and does nothing when the browser says Do Not Track or Global
// Privacy Control. Safe to call from render-adjacent code: it never throws and returns a boolean.
import { FUNNEL_PATH, isFunnelStep } from './funnelSteps.js';

// env is injectable so the helper can be tested without a browser.
export function createFunnelTracker(getEnv = () => globalThis) {
  const sent = new Set();
  return function trackFunnel(step) {
    try {
      if (!isFunnelStep(step) || sent.has(step)) return false;
      const env = getEnv();
      const nav = env?.navigator;
      if (!nav) return false; // server render or a non-browser runtime
      if (nav.doNotTrack === '1' || env.doNotTrack === '1' || nav.globalPrivacyControl === true) return false;
      sent.add(step); // mark first: a failed send must not become a retry loop
      const body = JSON.stringify({ step });
      if (typeof nav.sendBeacon === 'function') return nav.sendBeacon(FUNNEL_PATH, new Blob([body], { type: 'text/plain' })) === true;
      if (typeof env.fetch === 'function') {
        env.fetch(FUNNEL_PATH, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };
}

export const trackFunnel = createFunnelTracker();
