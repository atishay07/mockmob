// Development helper: relays a test phone's Supabase auth calls to the STAGING project through
// the PC, for phones without their own internet. Pair with `adb reverse tcp:3102 tcp:3102` and a
// build whose SUPABASE_URL is http://localhost:3102. Listens on 127.0.0.1 only.
// Usage: node --use-system-ca scripts/dev/supabase-usb-relay.mjs
// RELAY_LOCAL_ADDRESS pins outgoing connections to one PC interface, for example the Wi-Fi
// address when the phone's USB tethering adds a preferred route that does not work.
import { createServer } from 'node:http';
import { request } from 'node:https';

const host = 'onwkqxmjqjrhfbjjdydu.supabase.co';
const port = 3102;
const localAddress = process.env.RELAY_LOCAL_ADDRESS || undefined;

createServer((req, res) => {
  const path = req.url.split('?')[0];
  const upstream = request(
    { host, path: req.url, method: req.method, headers: { ...req.headers, host }, localAddress, timeout: 20000 },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
      console.log(`${req.method} ${path} -> ${up.statusCode}`);
    },
  );
  upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
  upstream.on('error', (error) => {
    console.error(`${req.method} ${path} failed: ${error.message}`);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
}).listen(port, '127.0.0.1', () => console.log(`Supabase staging relay on http://127.0.0.1:${port}`));
