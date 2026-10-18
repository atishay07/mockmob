// Google Play Developer API access without a Google SDK (node_modules is shared, so no new dependency): the service
// account OAuth2 JWT flow with node:crypto (RS256) and fetch.
//   1. Sign a JWT { iss: client_email, scope, aud: token_uri, iat, exp } with the service account's private key.
//   2. POST it to the token endpoint (grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer) for an access token.
//   3. Cache the token in memory until shortly before it expires, then call androidpublisher v3 with it.
// Env: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the JSON key, raw or base64 of it), PLAY_PACKAGE_NAME (default in.mockmob.app).
// Everything that touches the network or the clock is injectable so node:test drives it with no network.
import { createSign } from 'node:crypto';

export const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
export const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
export const PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
export const DEFAULT_PACKAGE_NAME = 'in.mockmob.app';
const REFRESH_EARLY_MS = 60_000;
const JWT_LIFETIME_S = 3600;
const REQUEST_TIMEOUT_MS = 10_000;

/** Error with a stable code: purchase_not_found (404/410), purchase_invalid (400), play_forbidden (401/403), play_unavailable (everything else), play_not_configured. */
export class PlayApiError extends Error {
  constructor(code, message, status = null) {
    super(message || code);
    this.name = 'PlayApiError';
    this.code = code;
    this.status = status;
  }
}

export const b64url = (input) => Buffer.from(input).toString('base64url');

function decodeBase64(text) {
  try { return Buffer.from(text, 'base64').toString('utf8'); } catch { return ''; }
}

/** The service account key from the env value: raw JSON, or base64 of the JSON (easier to paste into a hosting dashboard). */
export function parseServiceAccount(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new PlayApiError('play_not_configured', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set');
  let json = null;
  for (const candidate of [text, decodeBase64(text)]) {
    try {
      json = JSON.parse(candidate);
      if (json && typeof json === 'object') break;
    } catch { json = null; }
  }
  const privateKey = typeof json?.private_key === 'string' ? json.private_key.replace(/\\n/g, '\n') : '';
  if (!json || typeof json.client_email !== 'string' || !json.client_email || !privateKey.includes('PRIVATE KEY')) {
    throw new PlayApiError('play_not_configured', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not a service account key');
  }
  return {
    clientEmail: json.client_email,
    privateKey,
    tokenUri: typeof json.token_uri === 'string' && json.token_uri ? json.token_uri : DEFAULT_TOKEN_URI,
  };
}

/** The RS256 JWT bearer assertion Google's token endpoint exchanges for an access token. */
export function signServiceAccountJwt({ clientEmail, privateKey, tokenUri = DEFAULT_TOKEN_URI, scope = PLAY_SCOPE, nowSec }) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: clientEmail, scope, aud: tokenUri, iat: nowSec, exp: nowSec + JWT_LIFETIME_S };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(input).end().sign(privateKey);
  return `${input}.${b64url(signature)}`;
}

function classify(status) {
  if (status === 404 || status === 410) return 'purchase_not_found';
  if (status === 400) return 'purchase_invalid';
  if (status === 401 || status === 403) return 'play_forbidden';
  return 'play_unavailable';
}

/**
 * A client for the three purchases.products calls the server needs, plus the token cache.
 * deps: { env, fetch, now } (all optional). Nothing is read from the env until the first call.
 */
export function createPlayClient({ env = process.env, fetch: fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let account = null;
  let cached = null; // { token, expiresAtMs }
  let inflight = null;

  const packageName = () => String(env.PLAY_PACKAGE_NAME || DEFAULT_PACKAGE_NAME).trim() || DEFAULT_PACKAGE_NAME;
  const timeout = () => (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined);

  async function fetchToken() {
    account = account || parseServiceAccount(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
    const assertion = signServiceAccountJwt({ ...account, nowSec: Math.floor(now() / 1000) });
    let res;
    try {
      res = await fetchImpl(account.tokenUri, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
        signal: timeout(),
      });
    } catch (error) {
      throw new PlayApiError('play_unavailable', `token request failed: ${error?.message || error}`);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok || typeof json?.access_token !== 'string') {
      throw new PlayApiError(res.status >= 500 ? 'play_unavailable' : 'play_forbidden', `token endpoint answered ${res.status}${json?.error ? ` ${json.error}` : ''}`, res.status);
    }
    const lifetimeMs = Math.max(60, Number(json.expires_in) || JWT_LIFETIME_S) * 1000;
    cached = { token: json.access_token, expiresAtMs: now() + lifetimeMs };
    return cached.token;
  }

  /** An access token, from memory while it is good for another minute. One refresh at a time. */
  async function accessToken({ forceRefresh = false } = {}) {
    if (!forceRefresh && cached && cached.expiresAtMs - REFRESH_EARLY_MS > now()) return cached.token;
    if (!inflight) inflight = fetchToken().finally(() => { inflight = null; });
    return inflight;
  }

  async function call(method, path, body) {
    const url = `${PLAY_API_BASE}/applications/${encodeURIComponent(packageName())}/${path}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await accessToken({ forceRefresh: attempt > 0 });
      let res;
      try {
        res = await fetchImpl(url, {
          method,
          headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: timeout(),
        });
      } catch (error) {
        throw new PlayApiError('play_unavailable', `${method} ${path} failed: ${error?.message || error}`);
      }
      if (res.status === 401 && attempt === 0) { cached = null; continue; } // an expired or revoked token: one fresh token, once
      const text = await res.text().catch(() => '');
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
      if (!res.ok) {
        throw new PlayApiError(classify(res.status), `${method} ${path} answered ${res.status}${json?.error?.message ? `: ${json.error.message}` : ''}`, res.status);
      }
      return json;
    }
    throw new PlayApiError('play_forbidden', 'Google rejected the access token twice', 401);
  }

  const tokenPath = (productId, purchaseToken) => `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  return {
    packageName,
    accessToken,
    /** purchases.products.get: the purchase as Google holds it. */
    getProduct: (productId, purchaseToken) => call('GET', tokenPath(productId, purchaseToken)),
    /** purchases.products.acknowledge: keeps a non-consumable purchase from being refunded after three days. */
    acknowledge: (productId, purchaseToken) => call('POST', `${tokenPath(productId, purchaseToken)}:acknowledge`, {}),
    /** purchases.products.consume: acknowledges and lets the student buy the product again. */
    consume: (productId, purchaseToken) => call('POST', `${tokenPath(productId, purchaseToken)}:consume`),
  };
}

let shared = null;
/** The process-wide client, so the token cache is shared across requests on one server instance. */
export function playClient() {
  if (!shared) shared = createPlayClient();
  return shared;
}
