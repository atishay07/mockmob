// O7 (15 Nov 2026): Google One Tap on /signup and /login, behind a switch that is off until the owner sets
// NEXT_PUBLIC_GOOGLE_CLIENT_ID. Pure, no React; src/components/auth/GoogleOneTap.jsx draws nothing and uses these.
//
// The nonce: Google puts the SHA-256 (hex) of the nonce it was given into the ID token, and Supabase hashes the raw nonce it
// receives in signInWithIdToken to compare (Supabase docs, "Google One Tap"). So Google gets the hash, Supabase the raw value.
import { isInAppBrowser } from '../../components/result/installOffer.mjs';

export const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** One Tap runs only with a client id, outside in-app browsers (Google refuses there) and for a signed-out visitor. */
export function oneTapEnabled({ clientId = '', ua = '', status = 'loading' } = {}) {
  if (!String(clientId || '').trim()) return false;
  if (isInAppBrowser(ua)) return false;
  return status === 'unauthenticated';
}

/** SHA-256 of a string as lower-case hex, with the browser's (or Node's) Web Crypto. */
export async function sha256Hex(text, subtle = globalThis.crypto?.subtle) {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A fresh random nonce (32 bytes, base64) and its hash: { raw } for Supabase, { hashed } for Google. */
export async function makeNonce(crypto = globalThis.crypto) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  return { raw, hashed: await sha256Hex(raw, crypto.subtle) };
}

/** The settings Google Identity Services is started with (google.accounts.id.initialize), callback aside. */
export function oneTapConfig({ clientId, hashedNonce, context = 'signin' }) {
  return {
    client_id: String(clientId).trim(),
    nonce: hashedNonce,
    // Chrome moved One Tap onto the browser's own sign-in prompt (FedCM); Google's migration guide asks for this.
    use_fedcm_for_prompt: true,
    itp_support: true,
    auto_select: false,
    cancel_on_tap_outside: true,
    context: context === 'signup' ? 'signup' : 'signin',
  };
}
