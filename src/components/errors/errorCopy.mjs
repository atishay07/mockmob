// What a student reads when a screen crashes (the error pages: src/app/error.js, src/app/global-error.js,
// src/app/(app)/error.js, src/app/(app)/test/error.js). One sentence of what happened, one of what is safe, one key that
// tries again and one quiet way out. Never an error text, a stack or a code: only Next's digest, as a reference support
// can look up in the server log.
export const ERROR_COPY = Object.freeze({
  heading: 'Something broke on our side.',
  line: 'Your account and your answers are safe. Try again, and if it keeps happening, tell us at support@mockmob.in.',
  retry: 'Try again',
  toToday: 'Go to Today',
  toHome: 'Go to the home page',
  // The test runner keeps a draft of the paper in this browser's storage after every change (TestPageClient.jsx, the draft
  // effect), so every answer the student saw on screen was saved before a later render could crash; "Reopen your paper"
  // mounts the runner again and it reads that draft back (data/session_draft.js resumableDraft).
  paperLine: 'Your answers so far are saved on this device.',
  paperRetry: 'Reopen your paper',
  toPractice: 'Go to Practice',
  referenceLabel: 'Reference',
});

export const SUPPORT_EMAIL = 'support@mockmob.in';

// Next's digest: a hash of a server error, sometimes followed by "@E<code>" (next/dist/lib/error-telemetry-utils.js).
// Only the hash is shown; anything that is not a short plain token is not shown at all.
export function referenceOf(error) {
  let digest = null;
  try { digest = error && typeof error === 'object' ? error.digest : null; } catch { digest = null; }
  if (typeof digest !== 'string') return null;
  const hash = digest.split('@')[0].trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(hash) ? hash : null;
}

// The support line's address as a mail link; the reference rides in the subject so the student types nothing.
export function supportHref(reference) {
  return reference ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Reference ${reference}`)}` : `mailto:${SUPPORT_EMAIL}`;
}

// A screen that failed to load its code after a new release (the old page asked for a file the new release no longer
// has) only recovers with a fresh load of the page; trying again in place would fail the same way.
export function needsFreshLoad(error) {
  try {
    const name = typeof error?.name === 'string' ? error.name : '';
    const message = typeof error?.message === 'string' ? error.message : '';
    return name === 'ChunkLoadError'
      || /Loading (?:CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
  } catch {
    return false;
  }
}

// The one way "Try again" works everywhere (Next 16.2 passes both reset and unstable_retry; see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md):
// - the code itself failed to load: a fresh page load, the only thing that helps;
// - the server failed (the error carries a digest): unstable_retry, which asks the server for the screen again and draws it;
// - the screen failed in the browser: reset, which draws it again at once with no network (a paper reopens from its saved
//   draft even offline; every signed-in page reads its own data again when it mounts).
export function tryAgain(error, { retry, reset, reload } = {}) {
  try {
    if (needsFreshLoad(error) && typeof reload === 'function') return reload();
    if (referenceOf(error) && typeof retry === 'function') return retry();
    if (typeof reset === 'function') return reset();
    if (typeof retry === 'function') return retry();
    if (typeof reload === 'function') return reload();
  } catch {
    try { if (typeof reload === 'function') reload(); } catch { /* nothing more to try */ }
  }
  return undefined;
}
