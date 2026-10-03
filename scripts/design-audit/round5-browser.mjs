import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
export const out = 'artifacts/round5';
export async function browser() {
  return chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
}
export async function context(b, width = 1280, height = 860, options = {}) {
  const c = await b.newContext({ viewport: { width, height }, ...options });
  await c.addInitScript(() => {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.requestPointerLock = () => {};
  });
  return c;
}
export async function shot(p, name) {
  await fs.mkdir(`${out}/${name.split('/').slice(0,-1).join('/')}`, { recursive: true });
  await p.screenshot({ path: `${out}/${name}.png` });
}
if (process.argv.includes('--before')) {
  const b = await browser();
  for (const w of [1280, 390]) {
    const c = await context(b, w, 860); const p = await c.newPage();
    await p.goto('http://localhost:3000'); await p.waitForTimeout(1800);
    const stations = await p.locator('[data-pip-station]').evaluateAll(es => es.map(e => ({ id:e.dataset.pipStation, y:e.getBoundingClientRect().top + scrollY })));
    const samples = [];
    for (const s of [...stations, ...stations.slice().reverse()]) {
      await p.evaluate(y => scrollTo({top:y-180,behavior:'instant'}), s.y);
      await p.waitForTimeout(900);
      samples.push(await p.evaluate(() => ({y:scrollY,perch:document.documentElement.dataset.pipPerch,visible:document.documentElement.dataset.pipPerchVisible,flyer:!!document.querySelector('.pip-flyer')})));
      await shot(p,`before/${w}-${samples.length}-${s.id}`);
    }
    await fs.writeFile(`${out}/before/${w}.json`,JSON.stringify({stations,samples},null,2)); await c.close();
  }
  await b.close();
}

