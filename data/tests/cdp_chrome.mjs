// A small headless Chrome driver over the DevTools protocol, for DOM-measurement tests and captures.
// No browser library is installed in this repo, so this speaks CDP over Node's built-in WebSocket (Node 22+).
// Chrome runs headless with its own temporary profile, which close() deletes; nothing touches a real profile.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export const chromePath = () => CHROME_PATHS.find((path) => existsSync(path)) || null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`)); else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method, ms = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.listeners.delete(fn); reject(new Error(`timeout waiting for ${method}`)); }, ms);
      const fn = (msg) => { if (msg.method === method) { clearTimeout(timer); this.listeners.delete(fn); resolve(msg.params); } };
      this.listeners.add(fn);
    });
  }
}

const connect = (url) => new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.addEventListener('open', () => resolve(ws), { once: true });
  ws.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)), { once: true });
});

export async function launch() {
  const exe = chromePath();
  if (!exe) throw new Error('Chrome not found (set CHROME_PATH)');
  const dir = await mkdtemp(join(tmpdir(), 'mm-cdp-'));
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync', '--hide-scrollbars', '--mute-audio',
    '--js-flags=--max-old-space-size=256', 'about:blank',
  ], { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 300 && !port; i += 1) {
    try { port = (await readFile(join(dir, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim() || null; } catch { /* not yet */ }
    if (!port) await sleep(100);
  }
  if (!port) { proc.kill(); throw new Error('Chrome did not start'); }
  const base = `http://127.0.0.1:${port}`;
  return {
    async page({ width, height, scale = 1, theme = 'dark', reducedMotion = true } = {}) {
      const target = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
      const ws = await connect(target.webSocketDebuggerUrl);
      const s = new Session(ws);
      await s.send('Page.enable');
      await s.send('Runtime.enable');
      await s.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('mm:theme:v1', ${JSON.stringify(theme)}); localStorage.setItem('mm:theme-hint:v1', '1'); } catch {}` });
      const page = {
        session: s,
        async viewport(w, h, sc = scale) {
          await s.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: sc, mobile: w < 768 });
          if (w < 768) await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
          else await s.send('Emulation.setTouchEmulationEnabled', { enabled: false });
        },
        async motion(reduce) {
          await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
        },
        async goto(url, ready = 'body') {
          const loaded = s.once('Page.loadEventFired', 60000);
          await s.send('Page.navigate', { url });
          await loaded;
          await page.waitFor(ready);
        },
        async eval(expression) {
          const res = await s.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
          return res.result.value;
        },
        async waitFor(selector, ms = 45000) {
          const t = Date.now();
          while (Date.now() - t < ms) {
            if (await page.eval(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return true;
            await sleep(150);
          }
          throw new Error(`timeout waiting for ${selector}`);
        },
        // A real pointer click at (x, y): press and release, as a student's mouse would.
        async click(x, y) {
          await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
          await s.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
          await s.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        },
        async key(key, code = key, keyCode = 0) {
          await s.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
          await s.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
        },
        async shot() {
          const { data } = await s.send('Page.captureScreenshot', { format: 'png' });
          return Buffer.from(data, 'base64');
        },
        async close() {
          try { await fetch(`${base}/json/close/${target.id}`); } catch { /* gone */ }
          try { ws.close(); } catch { /* gone */ }
        },
      };
      await page.viewport(width || 390, height || 844, scale);
      await page.motion(reducedMotion);
      return page;
    },
    async close() {
      try {
        const version = await (await fetch(`${base}/json/version`)).json();
        const ws = await connect(version.webSocketDebuggerUrl);
        ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
        await sleep(500);
      } catch { /* already closed */ }
      if (proc.exitCode === null) proc.kill();
      for (let i = 0; i < 20; i += 1) {
        try { await rm(dir, { recursive: true, force: true }); break; } catch { await sleep(250); }
      }
    },
  };
}
