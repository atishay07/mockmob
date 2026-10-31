// Study motion frames (LK5): a reveal and each rating (Got it, Easy, Missed) recorded frame by frame, plus the round's end,
// at 390 and 1440 px, Night and Day, and under reduced motion. The page's animations run at a tenth of their speed (CDP
// Animation.setPlaybackRate), so a screenshot every 400 ms is a frame every 40 ms of real motion.
//   node scripts/design-audit/keycards-1031-study-motion-frames.mjs http://localhost:3443 tmp/lk-1031/frames
//   SIZES=390,1440  THEMES=dark,light  REDUCED=0,1  STEPS=reveal,got,easy,missed,end  FRAMES=10
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3443', out = 'tmp/lk-1031/frames'] = process.argv.slice(2);
const themes = (process.env.THEMES || 'dark,light').split(',');
const sizeList = (process.env.SIZES || '390,1440').split(',').map(Number);
const reducedList = (process.env.REDUCED || '0,1').split(',').map((x) => x === '1');
const steps = (process.env.STEPS || 'reveal,got,easy,missed,end').split(',');
const FRAMES = Number(process.env.FRAMES || 10);
const SLOW = 0.1;
mkdirSync(out, { recursive: true });

const url = (s) => `/preview/arena?decks=real&view=deck&student=commerce&plan=pro&chapter=accountancy.accounting-ratios&mode=study&kcs=${encodeURIComponent(s)}`;
const sizes = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const errors = [];
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const reduced of reducedList) {
    for (const theme of themes) {
      for (const size of sizeList) {
        if (reduced && !(size === 390 && theme === 'dark') && process.env.ALL_REDUCED !== '1') continue;
        const tag = `${size}-${theme === 'dark' ? 'night' : 'day'}${reduced ? '-reduced' : ''}`;
        const ctx = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: 1, colorScheme: theme, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
        await page.goto(`${base}${url(`motion-${tag}-${Date.now()}`)}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
        await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
        await page.waitForSelector('.kc-play', { timeout: 120000 });
        await page.waitForTimeout(1200);
        await page.evaluate(() => window.scrollTo(0, 0));
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Animation.enable');
        const slow = (r) => cdp.send('Animation.setPlaybackRate', { playbackRate: r });
        const shoot = async (name, n = FRAMES) => {
          for (let i = 0; i < n; i += 1) {
            await page.screenshot({ path: join(out, `${tag}-${name}-${String(i).padStart(2, '0')}.png`) });
            await page.waitForTimeout(Math.max(0, 40 / SLOW - 120));
          }
        };
        const rateStep = async (name, key) => {
          if (!(await page.locator('.kc-rate').count())) { await slow(1); await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); await page.waitForTimeout(500); }
          await slow(SLOW);
          await page.keyboard.press(key);
          await shoot(name, FRAMES + 2);
          await slow(1);
          await page.waitForTimeout(600);
        };
        for (const step of steps) {
          if (step === 'reveal') { await slow(SLOW); await page.keyboard.press('Space'); await shoot('reveal'); await slow(1); await page.waitForTimeout(400); }
          if (step === 'got') await rateStep('got', '2');
          if (step === 'easy') await rateStep('easy', '3');
          if (step === 'missed') await rateStep('missed', '1');
          if (step === 'end') {
            await slow(1);
            for (let guard = 0; guard < 40; guard += 1) {
              const pos = await page.locator('.kc-play .kc-pos').first().textContent().catch(() => null);
              if (!pos) break;
              const last = /^20 of 20/.test(pos.trim());
              if (!(await page.locator('.kc-rate').count())) { await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); }
              await page.waitForTimeout(320);
              if (last) { await slow(SLOW); await page.keyboard.press('2'); await shoot('end', FRAMES + 4); await slow(1); break; }
              await page.keyboard.press('2');
              await page.waitForSelector('.kc-play__keys', { timeout: 10000 }).catch(() => {});
            }
          }
        }
        const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (spill > 1) errors.push(`${tag}: the page scrolls sideways by ${spill}px after the motion`);
        console.log('done', tag);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
if (errors.length) { console.log('ERRORS'); for (const e of errors) console.log(' ', e); process.exit(1); }
