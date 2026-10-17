// Headless captures over the DevTools protocol (no puppeteer): exact viewports below Chrome's 500 px window floor.
// Usage: node cap.mjs jobs.json   where jobs = [{ page, out, w, h, q, scroll, eval }]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const profile = mkdtempSync(join(tmpdir(), 'mm-cap-'));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(join(here, 'captures'), { recursive: true });

async function json(path) {
  for (let i = 0; i < 60; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}${path}`)).json(); } catch { await sleep(150); }
  }
  throw new Error('chrome did not start');
}

try {
  const targets = await json('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) for (const w of [...waiters]) if (w.method === m.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
  await send('Page.enable');
  for (const job of jobs) {
    if (only && !only.test(job.out)) continue;
    const mobile = job.w < 768;
    await send('Emulation.setDeviceMetricsOverride', { width: job.w, height: job.h, deviceScaleFactor: 1, mobile });
    const loaded = once('Page.loadEventFired');
    const url = `${pathToFileURL(join(here, job.page)).href}?${job.q || ''}`;
    await send('Page.navigate', { url });
    await loaded;
    await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true });
    await sleep(250);
    if (job.eval) await send('Runtime.evaluate', { expression: job.eval, awaitPromise: true });
    if (job.scroll != null) await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${job.scroll}); document.querySelector('[data-scroller]')?.scrollTo(0, ${job.scroll})` });
    await sleep(job.wait || 350);
    let shot;
    if (job.full) {
      const m = await send('Runtime.evaluate', { expression: 'Math.ceil(document.documentElement.scrollHeight)', returnByValue: true });
      const fh = m.result.result.value;
      await send('Emulation.setDeviceMetricsOverride', { width: job.w, height: fh, deviceScaleFactor: 1, mobile });
      await sleep(300);
      shot = await send('Page.captureScreenshot', { format: 'png' });
    } else shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(here, 'captures', `${job.out}.png`), Buffer.from(shot.result.data, 'base64'));
    console.log(job.out);
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file for a moment */ }
}
