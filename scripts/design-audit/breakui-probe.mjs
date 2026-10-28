// Probe: list the widest-overflowing elements on one preview URL. node breakui-probe.mjs "<query>" [width]
import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const q = process.argv[2]; const w = Number(process.argv[3] || 390);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: w, height: 844 }, isMobile: w < 600, hasTouch: w < 600 })).newPage();
await p.goto(`http://localhost:3205/preview/arena?${q}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
await p.waitForFunction(() => !/Loading your|Checking/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(1000); await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } }); await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => {
  const vw = document.documentElement.clientWidth; const out = []; out.push({ vv: window.visualViewport.width, iw: window.innerWidth, bsw: document.body.scrollWidth });
  const path = (el) => { const a = []; for (let e = el; e && e !== document.body && a.length < 6; e = e.parentElement) a.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return a.join(' < '); };
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) out.push({ l: Math.round(r.left), r: Math.round(r.right), p: path(el), t: (el.textContent || '').trim().slice(0, 40) }); }
  return { vw, sw: document.documentElement.scrollWidth, out: out.slice(0, 25) };
}), null, 1));
await b.close();
