// Authenticating a Pub/Sub push for Google Play Real-time Developer Notifications. No Next.js imports (node:test drives it).
//   1. A shared secret in the push URL (?token=...), compared in constant time with PLAY_RTDN_TOKEN. Required: with the env
//      var unset the endpoint stays closed.
//   2. Optionally (PLAY_RTDN_OIDC_AUDIENCE set) the Google-signed OIDC token Pub/Sub attaches when the push subscription has
//      "Enable authentication": Authorization: Bearer <JWT>, RS256, signed by a key in Google's published certificates,
//      iss accounts.google.com, aud equal to PLAY_RTDN_OIDC_AUDIENCE, not expired, email_verified, and (when
//      PLAY_RTDN_OIDC_EMAIL is set) the push service account's email. When the audience is set, this check is required too.
import { createVerify } from 'node:crypto';
import { sameSecret } from '../server/secretCompare.js';

export const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const CERT_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

const decodeJson = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/** Google's signing certificates by key id, cached for an hour. fetch and clock are injectable. */
export function createCertSource({ fetch: fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cache = null; // { certs, atMs }
  return async function certs({ refresh = false } = {}) {
    if (!refresh && cache && now() - cache.atMs < CERT_TTL_MS) return cache.certs;
    const res = await fetchImpl(GOOGLE_CERTS_URL, { signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(8000) : undefined });
    if (!res.ok) throw new Error(`certificate fetch answered ${res.status}`);
    const json = await res.json();
    if (!json || typeof json !== 'object') throw new Error('certificate fetch gave no certificates');
    cache = { certs: json, atMs: now() };
    return cache.certs;
  };
}

/** True when the JWT is a valid Google-signed Pub/Sub OIDC token for this audience. Never throws. */
export async function verifyPubSubOidc(token, { audience, email = null, certs, now = Date.now }) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || !audience) return false;
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
    let pem = (await certs())[header.kid];
    if (!pem) pem = (await certs({ refresh: true }))[header.kid]; // Google rotates keys: look once more
    if (!pem) return false;
    const signatureOk = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).end().verify(pem, Buffer.from(parts[2], 'base64url'));
    if (!signatureOk) return false;
    const nowS = Math.floor(now() / 1000);
    if (!ISSUERS.has(claims.iss)) return false;
    if (claims.aud !== audience) return false;
    if (!Number.isFinite(claims.exp) || claims.exp + CLOCK_SKEW_S < nowS) return false;
    if (Number.isFinite(claims.iat) && claims.iat - CLOCK_SKEW_S > nowS) return false;
    if (claims.email_verified !== true) return false;
    if (email && claims.email !== email) return false;
    return true;
  } catch { return false; }
}

/**
 * Is this push really from our Pub/Sub subscription? deps: { env, certs, now }.
 * Returns { ok: true } or { ok: false, reason }. The reason is for the log, never for the response body.
 */
export async function authenticatePush(request, { env = process.env, certs, now = Date.now } = {}) {
  const expected = env.PLAY_RTDN_TOKEN;
  if (!expected) return { ok: false, reason: 'token_not_configured' };
  let given = null;
  try { given = new URL(request.url).searchParams.get('token'); } catch { given = null; }
  if (!sameSecret(given, expected)) return { ok: false, reason: 'bad_token' };
  if (env.PLAY_RTDN_OIDC_AUDIENCE) {
    const header = request.headers.get('authorization') || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const ok = await verifyPubSubOidc(bearer, { audience: env.PLAY_RTDN_OIDC_AUDIENCE, email: env.PLAY_RTDN_OIDC_EMAIL || null, certs, now });
    if (!ok) return { ok: false, reason: 'bad_oidc' };
  }
  return { ok: true };
}
