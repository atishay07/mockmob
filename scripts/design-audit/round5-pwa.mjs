import { browser, context } from './round5-browser.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://localhost:3011';
const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
assert.equal(manifest.start_url, '/today');
for (const icon of manifest.icons) assert.equal((await fetch(base + icon.src)).status, 200);
const sw = await fetch(`${base}/sw.js`);
assert.match(sw.headers.get('cache-control'), /no-cache/);
const b = await browser(), c = await context(b, 390, 844), p = await c.newPage();
try {
  await p.goto(base, { waitUntil: 'load' });
  await p.evaluate(async () => { await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }); await navigator.serviceWorker.ready; });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  await p.evaluate(() => fetch('/api/auth/me'));
  const assets = await p.evaluate(async () => { const cache = await caches.open('mockmob-public-fallback-v1'); return (await cache.keys()).map(r => new URL(r.url).pathname).sort(); });
  assert.deepEqual(assets, ['/offline.html', '/pwa/icon-192.png', '/pwa/icon-512.png']);
  await c.setOffline(true);
  const apiFailed = await p.evaluate(async () => { try { await fetch('/api/auth/me'); return false; } catch { return true; } });
  assert.equal(apiFailed, true);
  await p.goto(`${base}/today`, { waitUntil: 'load' });
  await p.getByRole('heading', { name: 'A connection is needed to reopen practice.' }).waitFor();
  await p.screenshot({ path: 'artifacts/round5-completion/pwa-offline.png' });
  await fs.writeFile('artifacts/round5-completion/pwa.json', JSON.stringify({ manifest: true, workerHeaders: true, assets, apiFailedOffline: apiFailed, navigationFallback: true, isolatedBrowser: true }, null, 2));
  console.log('PWA production manifest, headers, public-only cache, API isolation and offline navigation passed');
} finally { await c.close(); await b.close(); }
