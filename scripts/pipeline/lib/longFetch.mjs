// fetch-compatible client for long provider calls (9 Oct 2026).
// Node's built-in fetch (undici) aborts any request whose response headers take longer than 300 s ("fetch failed",
// UND_ERR_HEADERS_TIMEOUT). Non-streaming OpenAI flex calls send no headers until finished and routinely take 150-310 s, so the
// V7.9 regression probe lost 5 of 41 cases this way, each leaving an uncertain hold. This client has no headers/body timeout of
// its own; the transport's AbortSignal (900 s for flex, 300 s otherwise) remains the only deadline. Injected via
// createFactoryTransport({fetchImpl}); factoryTransport.mjs itself is unchanged. FormData uploads fall back to global fetch.
import https from 'node:https';

export function longFetch(url, init = {}) {
  if (typeof FormData !== 'undefined' && init.body instanceof FormData) return fetch(url, init);
  return new Promise((resolve, reject) => {
    const signal = init.signal;
    if (signal?.aborted) return reject(signal.reason || new Error('aborted'));
    const target = new URL(url);
    if (target.protocol !== 'https:') return reject(new Error('long_fetch_https_only'));
    const headers = { ...(init.headers || {}) };
    const body = init.body == null ? null : Buffer.from(typeof init.body === 'string' ? init.body : init.body);
    if (body) headers['Content-Length'] = String(body.length);
    const req = https.request(target, { method: init.method || 'GET', headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const status = res.statusCode || 0, pairs = [];
        for (const [k, v] of Object.entries(res.headers)) for (const item of Array.isArray(v) ? v : [v]) if (item !== undefined) pairs.push([k, String(item)]);
        resolve(new Response([101, 204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers: pairs }));
      });
    });
    req.setTimeout(0);
    req.setNoDelay(true);
    req.on('socket', socket => socket.setKeepAlive(true, 30000));
    req.on('error', reject);
    signal?.addEventListener('abort', () => req.destroy(signal.reason || new Error('aborted')), { once: true });
    if (body) req.write(body);
    req.end();
  });
}
