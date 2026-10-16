import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = 'C:/Users/atish/Desktop/mockmob copy/wt-p-review/artifacts/review-f17-1017';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3257';
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-f17-'));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = [];
const note = (k, v) => { report.push({ k, v }); console.log(k, JSON.stringify(v)); };
try {
  for (const [w, h] of [[1440, 900]]) {
    for (const theme of ['dark', 'light']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600, deviceScaleFactor: 1 });
      await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch {} }, theme);
      const page = await ctx.newPage();
      const repairPosts = [];
      page.on('request', (r) => { if (r.url().includes('/api/recovery/repair') && r.method() === 'POST') repairPosts.push(r.postData()); });
      const tag = `${w}-${theme === 'dark' ? 'night' : 'day'}`;

      // Review list
      await page.goto(`${BASE}/preview/arena?view=review&saved=1`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.rv-session', { timeout: 60000 });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/review-${tag}.png` });
      note(`review ${tag} rows`, await page.$$eval('.rv-session', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim())));
      note(`review ${tag} lead`, await page.$eval('.rv-lead', (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => null));

      // Result with saved repairs
      await page.goto(`${BASE}/preview/arena?view=result&saved=1&repair=v3-stored`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#q-2', { timeout: 60000 });
      await page.waitForSelector('#q-2 .mr--done, #q-2 .mr-start', { timeout: 15000 });
      await page.waitForTimeout(900);
      const q2 = await page.$eval('#q-2', (e) => e.innerText.replace(/\s+/g, ' ').trim());
      note(`result ${tag} q2 has paid cost`, /1 AI credit|Repair this mistake/.test(q2));
      note(`result ${tag} q2 from`, /From Mock 3, Accountancy, 4 Oct, 11:30 pm/.test(q2));
      note(`result ${tag} q2 foot`, (q2.match(/Saved repair[^.]*\. No credit used\./) || [null])[0]);
      note(`result ${tag} posts after load`, repairPosts.length);
      await page.locator('#q-2').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' })); await page.evaluate(() => scrollBy(0, -90)); await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/result-q2-saved-${tag}.png` });

      // Real-pointer open of Q4 (saved), hit-tested; and Q3 (unsaved) shows the paid start with its paper line.
      for (const n of [4, 3]) {
        const bar = page.locator(`#q-${n} .rp-q__bar`);
        await bar.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(250);
        const box = await bar.boundingBox();
        const cx = box.x + box.width / 2; const cy = box.y + Math.min(box.height / 2, 30);
        const hit = await page.evaluate(([x, y, nn]) => { const el = document.elementFromPoint(x, y); return !!el?.closest(`#q-${nn} .rp-q__bar`); }, [cx, cy, n]);
        note(`result ${tag} q${n} hit-test`, hit);
        const open = await bar.getAttribute('aria-expanded');
        if (open !== 'true') await page.mouse.click(cx, cy);
        await page.waitForTimeout(1200);
        const txt = await page.$eval(`#q-${n}`, (e) => e.innerText.replace(/\s+/g, ' ').trim());
        note(`result ${tag} q${n}`, { paid: /1 AI credit/.test(txt), repairButton: /Repair this mistake/.test(txt), openSaved: /Open your saved repair/.test(txt), done: /Saved repair/.test(txt), from: /From Mock 3/.test(txt), posts: repairPosts.length });
        await page.locator(`#q-${n}`).evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' })); await page.evaluate(() => scrollBy(0, -90)); await page.waitForTimeout(250);
        await page.screenshot({ path: `${OUT}/result-q${n}-${tag}.png` });
      }
      // The hero names the first unrepaired mistake, never a saved one.
      note(`result ${tag} hero key`, await page.$eval('.rp-repair-key', (e) => e.innerText).catch(() => null));
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${OUT}/result-top-${tag}.png` });
      // The earlier-miss line.
      note(`result ${tag} earlier`, await page.$$eval('.mr-earlier__text', (els) => els.map((e) => e.innerText)));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  fs.rmSync(udd, { recursive: true, force: true });
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
}
