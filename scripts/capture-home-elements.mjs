// Captures the element tree of the rendered home page into data/tests/fixtures/home-elements.json, for the cascade
// test (data/tests/home_cascade_order.test.mjs, src/lib/cssCascade.mjs). Run it after the page gains or loses sections:
//
//   PLAYWRIGHT_CORE=<path to playwright-core> CHROME=<path to chrome.exe> node scripts/capture-home-elements.mjs [base]
//
// base defaults to http://127.0.0.1:3000 (a dev or production server of this checkout). It opens "/" at 390x844 and
// 1440x900, in Day and Night (and once with reduced motion), scrolls the whole page so every lazy section mounts, and keeps the page's element tree (tag,
// id, classes, attribute names; no values, no text), merged over every view: [tag, id, 'classes', parent row or -1, 'attrs'].
// playwright-core is not a dependency of this project; point PLAYWRIGHT_CORE at any copy (or install it globally).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/tests/fixtures/home-elements.json');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const base = process.argv[2] || 'http://127.0.0.1:3000';

function collect() {
  // Every element as [tag, id, 'classes', parent row, 'attribute names']: the page's tree, without values or text.
  const index = new Map();
  const rows = [];
  for (const el of document.querySelectorAll('*')) {
    index.set(el, rows.length);
    rows.push([el.localName.toLowerCase(), el.id, [...el.classList].sort().join(' '), el.parentElement ? index.get(el.parentElement) : -1, el.getAttributeNames().filter((n) => n !== 'class' && n !== 'id' && n !== 'style').sort().join(' ')]);
  }
  return rows;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true });
// One tree for every size, theme and scroll position: a node is kept once per (parent, tag, id, classes).
const keyOf = new Map();
const nodes = [];
const merge = (rows) => {
  const mine = [];
  for (const [t, id, c, parent, a] of rows) {
    const p = parent < 0 ? -1 : mine[parent];
    const key = `${p}|${t}|${id}|${c}`;
    if (!keyOf.has(key)) { keyOf.set(key, nodes.length); nodes.push([t, id, c, p, a]); }
    const node = nodes[keyOf.get(key)];
    if (a !== node[4]) node[4] = [...new Set([...node[4].split(' '), ...a.split(' ')])].filter(Boolean).sort().join(' ');
    mine.push(keyOf.get(key));
  }
};
try {
  // Phone and desktop in Day and Night, and a phone that asks for reduced motion (its own attributes and states).
  for (const [w, h, theme, reducedMotion] of [[390, 844, 'light', 'no-preference'], [390, 844, 'dark', 'no-preference'], [1440, 900, 'light', 'no-preference'], [1440, 900, 'dark', 'no-preference'], [390, 844, 'light', 'reduce']]) {
    {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, reducedMotion });
      await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); sessionStorage.setItem('mm:opening:v2', '1'); } catch { /* private mode */ } }, theme);
      const page = await ctx.newPage();
      await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 180000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y <= height; y += 600) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(150);
        merge(await page.evaluate(collect));
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(OUT, `${JSON.stringify(nodes).replace(/\],\[/g, '],\n[')}\n`);
console.log(`${nodes.length} elements -> ${path.relative(ROOT, OUT)}`);
