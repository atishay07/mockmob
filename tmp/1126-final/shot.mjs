// One viewport screenshot with a section at the top: node shot.mjs <selector> <name> <width> <height> [offset]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [sel, name, width = '390', height = '760', off = '70', url = 'http://localhost:3571/'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:/Users/atish/.cache/puppeteer/chrome/win64-151.0.7922.71/chrome-win64/chrome.exe', headless: true, args: ['--headless=new'] });
const phone = Number(width) < 800;
const page = await (await browser.newContext({ viewport: { width: Number(width), height: Number(height) }, hasTouch: phone, isMobile: phone })).newPage();
await page.goto(url, { waitUntil: 'load' });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
await w(7000);
await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel); await w(2500);
await page.evaluate(([s, o]) => { const r = document.querySelector(s).getBoundingClientRect(); window.scrollBy({ top: r.top - Number(o), behavior: 'instant' }); }, [sel, off]); await w(2000);
await page.screenshot({ path: `tmp/1126-final/${name}.png` });
await browser.close();
