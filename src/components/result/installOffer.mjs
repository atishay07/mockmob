// O6, the install offer after the first result (15 Nov 2026): when the result shows the home-screen card. Pure, no React.
//
// One dismissible card under the result's next move, offered on one result only: the first result this device shows the
// student (for a new student, their first finished set). It shows when the browser can install the site (Chrome captured
// beforeinstallprompt) or, on iPhone Safari, with the two steps in words. Never on a desktop, never inside an in-app
// browser (Instagram, Facebook: installing is impossible there), never once installed (display-mode: standalone), never
// again after Not now. What the device remembers: { offeredOn: attempt id, dismissedAt } in localStorage (INSTALL_KEY).

export const INSTALL_KEY = 'mm:install-offer:v1';

export const INSTALL_COPY = Object.freeze({
  title: 'Keep MockMob on your home screen',
  line: 'Opens like an app. Your papers and mistakes are one tap away.',
  key: 'Add to home screen',
  later: 'Not now',
  ios: 'In Safari, tap Share, then Add to Home Screen.',
});

// The same test the sign-up card uses (src/components/ui/SignupCard.jsx IN_APP_BROWSER_RE): Google sign-in and installing
// both fail inside these embedded browsers.
export const IN_APP_BROWSER_RE = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|WhatsApp|Snapchat|; wv\)/i;

export function isInAppBrowser(ua = '') {
  return IN_APP_BROWSER_RE.test(String(ua || ''));
}

/** iPhone or iPod Safari itself (not Chrome, Firefox or Edge on iOS, not an in-app view): the browser whose Share menu adds to the home screen. */
export function isIosSafari(ua = '') {
  const s = String(ua || '');
  if (!/iPhone|iPod/.test(s) || isInAppBrowser(s)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(s)) return false;
  return /Version\/[\d.]+.*Safari\//.test(s);
}

/** What the device remembered, from the stored string (anything unreadable is a fresh device). */
export function readRemembered(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object') return { offeredOn: null, dismissedAt: null };
    return { offeredOn: typeof value.offeredOn === 'string' && value.offeredOn ? value.offeredOn : null, dismissedAt: Number.isFinite(value.dismissedAt) ? value.dismissedAt : null };
  } catch {
    return { offeredOn: null, dismissedAt: null };
  }
}

/**
 * Which card to show on this result, or null.
 *   attemptId   the result on screen
 *   standalone  display-mode: standalone (or navigator.standalone): already installed
 *   installed   the browser said appinstalled in this session
 *   desktop     a desktop: 1024 px wide or more, or no touch screen (pointer: fine)
 *   ua          navigator.userAgent
 *   hasPrompt   a captured beforeinstallprompt is waiting
 *   remembered  readRemembered(...)
 * Returns { kind: 'prompt' } (the key opens the browser's install dialog) | { kind: 'ios' } (the two steps in words) | null.
 */
export function installOffer({ attemptId = null, standalone = false, installed = false, desktop = true, ua = '', hasPrompt = false, remembered = null } = {}) {
  if (!attemptId || standalone || installed || desktop || isInAppBrowser(ua)) return null;
  const memory = remembered || { offeredOn: null, dismissedAt: null };
  if (memory.dismissedAt) return null;
  if (memory.offeredOn && memory.offeredOn !== attemptId) return null;
  if (hasPrompt) return { kind: 'prompt' };
  if (isIosSafari(ua)) return { kind: 'ios' };
  return null;
}

/** What to store once the card has been shown on this result (the first one only). */
export function rememberOffered(remembered, attemptId) {
  const memory = remembered || { offeredOn: null, dismissedAt: null };
  return { offeredOn: memory.offeredOn || attemptId, dismissedAt: memory.dismissedAt || null };
}

/** What to store after Not now (or after the install dialog was answered either way). */
export function rememberDismissed(remembered, now = Date.now()) {
  const memory = remembered || { offeredOn: null, dismissedAt: null };
  return { offeredOn: memory.offeredOn, dismissedAt: now };
}
