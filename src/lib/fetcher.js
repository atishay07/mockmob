/**
 * Thin fetch wrapper with consistent error handling + typing.
 * Throws an Error with the server's `error` field on non-2xx, so callers
 * can `try/catch` uniformly instead of handcrafting response checks.
 */
export async function api(path, init) {
  let res;
  try {
    res = await fetch(path, init);
  } catch (e) {
    // Network-level failure (offline, DNS, etc.)
    const err = new Error('Network error — check your connection');
    err.cause = e;
    err.kind = 'network';
    throw err;
  }

  const ct = res.headers.get('content-type') || '';
  let body = null;
  if (ct.includes('application/json')) {
    try { body = await res.json(); } catch { body = null; }
  } else {
    try { body = await res.text(); } catch { body = null; }
  }

  if (!res.ok) {
    const msg = (body && typeof body === 'object' && body.error) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

/** Convenience wrappers. */
export const apiGet  = (path) => api(path);
export const apiPost = (path, data) => api(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
export const apiPatch = (path, data) => api(path, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
