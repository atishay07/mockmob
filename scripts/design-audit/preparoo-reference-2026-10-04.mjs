// Observational audit of the owner's public design reference; no signup or writes.
import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
const out = 'artifacts/mobile-audit-2026-10-04';
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = [];
try {
  for (const width of [390, 1280]) {
    const c = await b.newContext({ viewport: { width, height: 844 }, isMobile: width === 390, hasTouch: width === 390 });
    const p = await c.newPage();
    const resources = [], errors = [];
    p.on('response', response => { const type = response.headers()['content-type'] || ''; if (/image|font|css/.test(type)) resources.push({ url: response.url(), type }); });
    p.on('pageerror', e => errors.push(e.message));
    await p.goto('https://ug.preparoo.app/', { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(1600);
    const headings = await p.locator('h1,h2,h3').evaluateAll(es => es.map(e => ({ text: e.textContent.trim().slice(0, 130), y: Math.round(e.getBoundingClientRect().top + scrollY) })));
    const initial = await p.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight, images: [...document.images].map(e => ({ src: e.currentSrc, width: e.width, height: e.height, naturalWidth: e.naturalWidth })), blur: [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).backdropFilter !== 'none').map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 160), filter: getComputedStyle(e).backdropFilter })).slice(0, 25) }));
    await p.screenshot({ path: `${out}/preparoo-${width}-hero.png` });
    const samples = [];
    // Wheel progression through the first feature section, sampled mid-scroll.
    for (let i = 0; i < 12; i++) {
      await p.mouse.wheel(0, 260); await p.waitForTimeout(350);
      if ([2, 5, 8, 11].includes(i)) {
        await p.screenshot({ path: `${out}/preparoo-${width}-scroll-${i}.png` });
        samples.push(await p.evaluate(() => ({ y: Math.round(scrollY), heading: [...document.querySelectorAll('h1,h2,h3')].filter(e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).map(e => e.textContent.trim()) })));
      }
    }
    for (const [i, heading] of headings.entries()) {
      if (!/Make the|Ask Preparoo|plan|Built|mock/i.test(heading.text) || i > 20) continue;
      await p.evaluate(y => scrollTo({ top: y - 100, behavior: 'instant' }), heading.y);
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${out}/preparoo-${width}-section-${i}.png` });
    }
    report.push({ url: p.url(), width, headings, initial, samples, resources, errors });
    console.log(`Preparoo ${width}: ${headings.length} headings, ${initial.blur.length} blur surfaces, ${initial.overflow}px root overflow`);
    await c.close();
  }
} finally { await fs.writeFile(`${out}/preparoo.json`, JSON.stringify(report, null, 2)); await b.close(); }
