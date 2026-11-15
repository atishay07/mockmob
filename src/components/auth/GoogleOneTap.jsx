"use client";

// O7 (15 Nov 2026): Google One Tap on /signup and /login. Off until the owner sets NEXT_PUBLIC_GOOGLE_CLIENT_ID (his console
// steps are in the W3-A report and tmp/1115-prod/sec-auth.md "Login options"). Draws nothing itself and loads no script unless
// the switch is on, the browser is not an in-app one (Google refuses there) and the visitor is signed out (oneTapEnabled).
//
// When on: Google Identity Services shows its own prompt through the browser (FedCM). The ID token it returns signs in here
// (Supabase signInWithIdToken with the raw nonce; Google got the hash), then the page sends the student on exactly as after
// the email code. Any failure is silent: a blocked script, a closed prompt, a refused token. The card below still works.
import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { GSI_SRC, makeNonce, oneTapConfig, oneTapEnabled } from '@/lib/auth/oneTap.mjs';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const noSubscribe = () => () => {};
const readUa = () => window.navigator.userAgent || '';
const serverUa = () => '';

// One script per page load; a failed load is forgotten so a later mount may try again.
let gsiPromise = null;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('gsi_missing')));
      script.onerror = () => reject(new Error('gsi_failed'));
      document.head.appendChild(script);
    }).catch((cause) => {
      gsiPromise = null;
      throw cause;
    });
  }
  return gsiPromise;
}

// After the page has settled, so the prompt never competes with the first paint of the form.
function whenIdle() {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: 2000 });
    else setTimeout(resolve, 600);
  });
}

export default function GoogleOneTap({ context = 'signin' }) {
  const { status, signInWithGoogleIdToken } = useAuth();
  const ua = useSyncExternalStore(noSubscribe, readUa, serverUa);
  const enabled = oneTapEnabled({ clientId: CLIENT_ID, ua, status });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let prompted = false;
    (async () => {
      try {
        await whenIdle();
        if (cancelled) return;
        const google = await loadGsi();
        const { raw, hashed } = await makeNonce();
        if (cancelled) return;
        google.accounts.id.initialize({
          ...oneTapConfig({ clientId: CLIENT_ID, hashedNonce: hashed, context }),
          callback: (response) => {
            if (!response?.credential) return;
            // On success the auth provider confirms the profile and the page moves on; a refusal leaves the card as it was.
            signInWithGoogleIdToken(response.credential, raw).catch(() => {});
          },
        });
        google.accounts.id.prompt();
        prompted = true;
      } catch {
        // Silent: the card is the way in.
      }
    })();
    return () => {
      cancelled = true;
      if (prompted) {
        try { window.google?.accounts?.id?.cancel(); } catch { /* the prompt is already gone */ }
      }
    };
  }, [enabled, context, signInWithGoogleIdToken]);

  return null;
}
