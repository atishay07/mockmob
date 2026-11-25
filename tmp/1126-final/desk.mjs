import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const out = 'tmp/1126-final/desk'; mkdirSync(out, { recursive: true });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: 'C:/Users/atish/.cache/puppeteer/chrome/win64-151.0.7922.71/chrome-win64/chrome.exe', headless: true, args: ['--headless=new'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(process.argv[2] || 'http://localhost:3571/', { waitUntil: 'load' }); await w(8000);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < total + 1500; y += 700) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await w(300); }
const full = await page.evaluate(() => document.documentElement.scrollHeight);
let i = 0;
for (let y = 0; y < full; y += 820) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await w(900); await page.screenshot({ path: `${out}/d-${String(i).padStart(2, '0')}.png` }); i += 1; }
console.log('desktop screens', i, 'page', full);
await browser.close();
