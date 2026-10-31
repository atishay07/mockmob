// LK2, the "Your part" picker, against `next dev` with the real decks and a slow home read (&kclag=): frames before the tap,
// right after tapping the other part (mid re-read) and after the new list lands, at 390 and 1440, Night and Day. It also records
// every change of the selected part, the list's opacity and the first row's position, and which rows were kept, into <out>/lk2-trace.json.
//   node scripts/design-audit/keycards-1031-lk2-capture.mjs http://localhost:3441 tmp/lk-1031
//   PLAYWRIGHT_CORE=<path>  HEADLESS_SHELL=<path>  SIZES=390,1440  THEMES=dark,light  LAG=1500
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3441', out = 'tmp/lk-1031'] = process.argv.slice(2);
const themes = (process.env.THEMES || 'dark,light').split(',');
const sizeList = (process.env.SIZES || '390,1440').split(',').map(Number);
const lag = process.env.LAG || '1500';
const sizes = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
mkdirSync(out, { recursive: true });
const errors = [];
const traces = [];
const landed = () => document.querySelector('.kc-opt__fine')?.textContent.startsWith('Only that');
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const theme of themes) {
    for (const size of sizeList) {
      const ctx = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: size === 390 ? 2 : 1, hasTouch: size === 390, isMobile: size === 390, colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
      const page = await ctx.newPage();
      const tag = `${size}-${theme === 'dark' ? 'night' : 'day'}`;
      const puts = [];
      page.on('request', (r) => { if (r.method() === 'PUT' && r.url().includes('subject-options')) puts.push(r.postData()); });
      page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error' && !/Fixture endpoint|status of 40|favicon|DevTools/i.test(m.text())) errors.push(`${tag} console: ${m.text().slice(0, 200)}`); });
      await page.goto(`${base}/preview/arena?decks=real&view=cards&student=commerce&plan=pro&subject=accountancy&kclag=${lag}&kcs=lk2-${tag}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
      await page.waitForSelector('.kc-opt__btn', { timeout: 90000 });
      await page.waitForTimeout(1200);
      const radios = page.locator('.kc-opt__btn');
      const labels = await radios.allTextContents();
      // Setup: choose the first part and let its list land, so the next tap swaps one list for another.
      await radios.nth(0).click();
      await page.waitForFunction(landed, null, { timeout: 20000 });
      await page.waitForTimeout(1200);
      puts.length = 0;
      // The recorder: selected part, list opacity and busy flag, first row top, picker box height, and the rows that stay put.
      await page.evaluate(() => {
        document.querySelectorAll('.kc-row').forEach((r) => { r.__kept = true; });
        const t0 = performance.now();
        window.__trace = [];
        let last = '';
        const sample = () => {
          const checked = [...document.querySelectorAll('.kc-opt__btn')].map((b, i) => (b.getAttribute('aria-checked') === 'true' ? i : null)).filter((x) => x !== null).join('+') || 'none';
          const units = document.querySelector('#kc-units');
          const first = document.querySelector('.kc-row');
          const all = [...document.querySelectorAll('.kc-row')];
          const opt = document.querySelector('.kc-opt');
          const rec = {
            checked,
            busy: units?.getAttribute('aria-busy') === 'true',
            opacity: Number(getComputedStyle(units).opacity).toFixed(2),
            firstTop: first ? Math.round(first.getBoundingClientRect().top + window.scrollY) : null,
            optH: Math.round(opt.getBoundingClientRect().height),
            rows: all.length,
            kept: all.filter((r) => r.__kept).length,
            fine: document.querySelector('.kc-opt__fine')?.textContent || '',
            replaying: all.filter((r) => r.__kept && r.getAnimations().some((a) => a.playState === 'running')).length,
          };
          const key = JSON.stringify(rec);
          if (key !== last) { window.__trace.push({ t: Math.round(performance.now() - t0), ...rec }); last = key; }
          requestAnimationFrame(sample);
        };
        sample();
      });
      const shot = async (name) => { const f = join(out, `lk2-${name}-${tag}.png`); await page.screenshot({ path: f }); console.log('saved', f); };
      await page.locator('.kc-opt').evaluate((el) => window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 140)));
      await page.waitForTimeout(300);
      await shot('1-before');
      const other = await page.evaluate(() => [...document.querySelectorAll('.kc-opt__btn')].findIndex((b) => b.getAttribute('aria-checked') !== 'true'));
      await radios.nth(other).click();
      await page.waitForTimeout(250);
      await shot('2-after-tap');
      // A tap on the old part while the save and the re-read are in flight must do nothing.
      await radios.nth(other === 0 ? 1 : 0).click({ force: true });
      await page.waitForTimeout(700);
      await shot('3-mid-refetch');
      await page.waitForFunction(landed, null, { timeout: 20000 });
      await page.waitForTimeout(120);
      await shot('4-landing');
      await page.waitForTimeout(900);
      await shot('5-landed');
      const trace = await page.evaluate(() => window.__trace);
      const sel = [...new Set(trace.map((r) => r.checked))];
      const heights = [...new Set(trace.map((r) => r.optH))];
      const tops = [...new Set(trace.map((r) => r.firstTop))];
      const replay = Math.max(...trace.map((r) => r.replaying));
      traces.push({ tag, labels, other, selectedStates: sel, optHeights: heights, firstRowTops: tops, maxKeptRowsAnimating: replay, puts, trace });
      console.log(tag, '| selected over time:', sel.join(' > '), '| picker heights:', heights.join(','), '| first row tops:', tops.join(','), '| kept rows animating:', replay, '| PUTs:', puts.length);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(join(out, 'lk2-trace.json'), JSON.stringify(traces, null, 2));
if (errors.length) { console.log('ERRORS'); for (const e of errors) console.log(' ', e); process.exit(1); }
