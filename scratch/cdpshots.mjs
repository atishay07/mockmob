import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const out = 'scratch/shots'; mkdirSync(out, { recursive: true });
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const prof = process.env.TEMP + '/cdp-prof-' + Date.now();
const ch = spawn(exe, ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 30; i++) { try { ver = await (await fetch('http://127.0.0.1:9333/json/version')).json(); break; } catch { await sleep(500); } }
const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));

let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const cases = [['nta-plain', 'view=result&mock=nta'], ['nta-thin', 'view=result&mock=nta&bank=thin']];
for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
  for (const theme of ['dark', 'light']) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    if (globalThis.__src) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: globalThis.__src });
    globalThis.__src = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('mm:theme:v1','${theme}')}catch(e){}` })).result.identifier;
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    for (const [name, q] of cases) {
      
      await send('Page.navigate', { url: `http://localhost:3202/preview/arena?${q}&plan=free&data=ready` });
      for (let t = 0; t < 4; t++) {
        let ok = false;
        for (let i = 0; i < 20; i++) { await sleep(1000); if (await ev(`!!document.querySelector('.sw-plan')`)) { ok = true; break; } }
        if (ok) break;
        await send('Page.navigate', { url: `http://localhost:3202/preview/arena?${q}&plan=free&data=ready` });
      }
      await ev(`document.querySelector('.sw-plan')?.scrollIntoView({block:'start'})`); await sleep(1500);
      if (!(await ev("!!document.querySelector('.sw-plan')"))) console.log('BODY', String(await ev('document.body.innerText')).slice(0, 600));
      const text = await ev(`document.querySelector('.sw-plan')?.innerText || 'NO PLAN'`);
      console.log(name, tag, theme, '\n', String(text).replace(/\n+/g, ' | '));
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${out}/${name}-${tag}-${theme}.png`, Buffer.from(shot.result.data, 'base64'));
    }
  }
}
ws.close(); ch.kill();
