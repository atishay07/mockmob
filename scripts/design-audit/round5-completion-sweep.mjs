import { browser, context } from './round5-browser.mjs';
import fs from 'node:fs/promises';
const cases = JSON.parse(await fs.readFile('artifacts/round4/sweep/sweep.json', 'utf8')).map(({ route, w, h, theme }) => ({ route, w, h, theme }));
const b = await browser(), results = [];
let cursor = 0;
async function worker() {
  while (cursor < cases.length) {
    const item = cases[cursor++];
    const fixture = item.route.startsWith('/preview/');
    const base = `http://localhost:${fixture ? 3010 : 3011}`;
    const c = await context(b, item.w, item.h, { hasTouch: item.w <= 1024, isMobile: item.w <= 600 });
    await c.addInitScript(theme => localStorage.setItem('mm:theme:v1', theme), item.theme);
    const p = await c.newPage(), errors = [];
    p.on('pageerror', error => errors.push(error.message));
    try {
      const response = await p.goto(base + item.route, { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(200);
      results.push({ ...item, fixture, status: response.status(), errors, ...await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, broken: [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.src) })) });
    } catch (error) { results.push({ ...item, fixture, error: error.message }); }
    await c.close();
    if (results.length % 100 === 0) console.log(`${results.length}/${cases.length}`);
  }
}
try { await Promise.all([worker(), worker(), worker(), worker()]); }
finally { await b.close(); await fs.writeFile('artifacts/round5-completion/sweep.json', JSON.stringify(results, null, 2)); }
const failed = results.filter(r => r.error || r.status >= 400 || r.errors.length || r.overflow > 0 || r.broken.length);
console.log(JSON.stringify({ loads: results.length, failed: failed.length }));
if (failed.length) process.exitCode = 1;
