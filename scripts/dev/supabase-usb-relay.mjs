// Development helper: relays a test phone's Supabase auth calls to the STAGING project through
// the PC, for phones without their own internet. Pair with `adb reverse tcp:3102 tcp:3102` and a
// build whose SUPABASE_URL is http://localhost:3102. Listens on 127.0.0.1 only.
// Usage: node --use-system-ca scripts/dev/supabase-usb-relay.mjs
import { createServer } from 'node:http';

const target = 'https://onwkqxmjqjrhfbjjdydu.supabase.co';
const port = 3102;
const dropRequest = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const dropResponse = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection']);

createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !dropRequest.has(k)));
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
    const upstream = await fetch(target + req.url, { method: req.method, headers, body, redirect: 'manual' });
    const out = Buffer.from(await upstream.arrayBuffer());
    upstream.headers.forEach((value, key) => { if (!dropResponse.has(key)) res.setHeader(key, value); });
    res.writeHead(upstream.status).end(out);
    console.log(`${req.method} ${req.url.split('?')[0]} -> ${upstream.status}`);
  } catch (error) {
    console.error(`${req.method} ${req.url.split('?')[0]} failed: ${error.message}`);
    res.writeHead(502).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`Supabase staging relay on http://127.0.0.1:${port}`));
