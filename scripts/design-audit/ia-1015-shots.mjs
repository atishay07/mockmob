// Gate A captures for the web IA restructure (tmp/web-ia/PLAN.md 8.1). Headless only: no window,
// no profile, no sign-in. Signed-in screens come from the dev-only /preview/arena fixtures.
//
//   node scripts/design-audit/ia-1015-shots.mjs [--only=name,name] [--video] [--no-shots]
//
// --video records the first run at phone width as an animated WebP (DevTools screencast).
// Needs the one dev server: node --use-system-ca node_modules/next/dist/bin/next dev --webpack -p 3107
import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.IA_BASE || 'http://localhost:3107';
const OUT = process.env.IA_OUT || 'C:/Users/atish/Desktop/mockmob copy/mockmob-next/tmp/web-ia/gate-a';
const SHOTS = path.join(OUT, 'shots');
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}`));
const only = arg('only')?.split('=')[1]?.split(',').filter(Boolean) || null;

const SIZES = [
  { id: 'phone', width: 375, height: 812 },
  { id: 'desktop', width: 1440, height: 900 },
];
const THEMES = ['dark', 'light'];
const pv = (q) => `/preview/arena?plan=free&${q}`;

async function answerSample(p) {
  const drill = p.locator('.mm-drill').first();
  await drill.scrollIntoViewIfNeeded();
  // Three right and two wrong, like the plan's "3 of 5" example (correct keys: 1, 1, 2, 2, 1).
  const picks = [1, 1, 2, 0, 0];
  for (let i = 0; i < 5; i += 1) {
    await p.locator('.mm-drill__option').nth(picks[i]).click();
    await p.waitForTimeout(250);
    const next = p.locator('.mm-drill__foot button');
    if (await next.count()) await next.first().click();
    await p.waitForTimeout(250);
  }
  await p.locator('.mm-drill__result').waitFor({ timeout: 8000 });
  await p.locator('.mm-drill').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(900);
}

async function openRepair(p) {
  const button = p.getByRole('button', { name: /Repair \d+ mistake|Start repair|Repair this mistake/i }).first();
  await button.waitFor({ timeout: 10000 });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await p.waitForTimeout(1600);
}

// name, path, options: full (full page), setup (after load), sizes (ids), wait (ms)
const JOBS = [
  // Navigation
  ['nav-shell', pv('view=shell&badge=4&move=repair')],
  ['nav-start-sheet', pv('view=start-sheet&move=repair')],
  ['nav-start-confirm', pv('view=start-sheet&move=repair&row=quick')],
  // Today
  ['today-first', pv('view=today&data=empty&rhythm=fresh')],
  ['today-unopened', pv('view=today&state=unopened')],
  ['today-repair', pv('view=today&state=repair')],
  ['today-practise', pv('view=today&state=practise')],
  ['today-resume', pv('view=today&state=resume')],
  ['today-stale', pv('view=today&state=stale')],
  ['guide-stop1', pv('view=guide&stop=0')],
  // First run and public
  ['landing-hero', '/'],
  ['landing-full', '/', { full: true }],
  ['sample-answered', '/', { setup: answerSample }],
  ['signup', '/signup'],
  ['login', '/login'],
  ['onboarding-subjects', pv('view=onboarding&step=subjects')],
  ['onboarding-days', pv('view=onboarding&step=days')],
  ['onboarding-subjects-art', pv('view=onboarding&step=subjects&brand=art,font')],
  // Practice
  ['practice', pv('view=practice')],
  ['practice-art', pv('view=practice&brand=art,font')],
  ['practice-prefill', pv('view=practice&subject=accountancy&mode=quick&count=10&chapter=Partnership+Fundamentals')],
  ['question-stream', pv('view=explore')],
  // Review
  ['review', pv('view=review')],
  ['review-empty', pv('view=review&state=empty')],
  ['ask-mobi', pv('view=prepos')],
  ['your-record', pv('view=radar')],
  // You
  ['you', pv('view=you')],
  ['account', pv('view=profile')],
  ['leaderboard', pv('view=ranks')],
  // Public pages
  ['pricing', '/pricing', { full: true }],
  ['cutoff-calculator', '/cuet-cutoff-calculator'],
  ['combo-planner', '/cuet-subject-combination'],
  // Result and repair (Repair v3 owns these files; captured, not edited)
  ['result', pv('view=result')],
  ['repair', pv('view=result'), { setup: openRepair }],
  ['test-console', pv('view=test&subject=accountancy&mode=quick&count=10&generationKey=preview-gate-a-0001')],
].map(([name, url, opts = {}]) => ({ name, url, ...opts }));

async function measure(p) {
  return p.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const roots = new Set();
    for (const el of document.querySelectorAll('.mobi-react, .pip-seat, img.pip-image')) {
      const root = el.closest('.mobi-react') || el.closest('.pip-seat') || el;
      if (visible(root)) roots.add(root);
    }
    const h1 = document.querySelector('h1')?.innerText?.trim() || null;
    // One Mobi per screen: count the ones inside the viewport (the page may hold more, a screen apart).
    const onScreen = [...roots].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }).length;
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      mobi: onScreen,
      mobiOnPage: roots.size,
      height: document.documentElement.scrollHeight,
      h1,
      theme: document.documentElement.dataset.theme || null,
    };
  });
}

async function run() {
  await fs.mkdir(SHOTS, { recursive: true });
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const report = [];
  try {
    if (!arg('no-shots')) {
      for (const theme of THEMES) {
        for (const size of SIZES) {
          for (const job of JOBS) {
            if (only && !only.includes(job.name)) continue;
            if (job.sizes && !job.sizes.includes(size.id)) continue;
            // A fresh context per capture: the preview shell writes a member hint to localStorage,
            // which would turn a later public page into the returning visitor's header.
            const c = await b.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
            await c.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch {} }, theme);
            const p = await c.newPage();
            const errors = [];
            p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
            p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
            const file = `${job.name}--${size.id}-${theme === 'dark' ? 'night' : 'day'}.jpg`;
            const entry = { job: job.name, size: size.id, theme, file };
            try {
              await p.goto(BASE + job.url, { waitUntil: 'load', timeout: 120000 });
              await p.evaluate(() => document.fonts?.ready);
              await p.waitForTimeout(job.wait || 1600);
              if (job.setup) await job.setup(p);
              Object.assign(entry, await measure(p));
              await p.screenshot({ path: path.join(SHOTS, file), type: 'jpeg', quality: 78, fullPage: !!job.full });
            } catch (e) {
              entry.failed = String(e.message).split('\n')[0].slice(0, 240);
            }
            entry.errors = errors.filter((x) => !/Download the React DevTools|favicon|\[Fast Refresh\]|HMR/.test(x)).slice(0, 5);
            report.push(entry);
            console.log(JSON.stringify(entry));
            await c.close();
          }
        }
      }
    }
    if (arg('video')) {
      // Playwright's recordVideo needs an ffmpeg download, so the motion is recorded from the
      // DevTools screencast instead (headless, same page) and written as an animated WebP.
      const dir = path.join(OUT, 'video');
      await fs.mkdir(dir, { recursive: true });
      const c = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
      await c.addInitScript(() => { try { localStorage.setItem('mm:theme:v1', 'dark'); } catch {} });
      const p = await c.newPage();
      const cdp = await c.newCDPSession(p);
      const frames = [];
      cdp.on('Page.screencastFrame', async (f) => {
        frames.push({ data: f.data, t: f.metadata.timestamp });
        try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
      });
      await p.goto(`${BASE}/`, { waitUntil: 'load', timeout: 120000 });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 375, maxHeight: 812, everyNthFrame: 1 });
      await p.waitForTimeout(1500);
      await answerSample(p);
      await p.waitForTimeout(1500);
      await p.locator('.mm-drill__actions a').first().click();
      await p.waitForURL(/signup/, { timeout: 30000 });
      await p.waitForTimeout(2200);
      await p.goto(BASE + pv('view=onboarding&step=subjects'), { waitUntil: 'load', timeout: 120000 });
      await p.waitForTimeout(1500);
      const picks = p.locator('[aria-pressed]');
      const n = Math.min(3, await picks.count());
      for (let i = 0; i < n; i += 1) { await picks.nth(i).click(); await p.waitForTimeout(400); }
      await p.getByRole('button', { name: /^Next$/ }).click();
      await p.waitForTimeout(2000);
      const save = p.getByRole('button', { name: /Save and continue/ });
      if (await save.count()) { await save.click(); await p.waitForTimeout(3000); }
      // Stay inside the preview: "Start now" opens the real Practice page, which needs a session.
      // Show the Start key instead, morphing into its sheet, and the Quick 10 confirm line.
      await p.waitForTimeout(1200);
      const key = p.getByRole('button', { name: /^Start$/ }).first();
      if (await key.count()) {
        await key.click(); await p.waitForTimeout(1600);
        const quick = p.getByRole('button', { name: /Quick 10/ }).first();
        if (await quick.count()) { await quick.click(); await p.waitForTimeout(2200); }
      }
      await cdp.send('Page.stopScreencast').catch(() => {});
      const endUrl = p.url();
      await c.close();
      // At most about 8 frames a second; each frame lasts until the next kept one.
      const kept = [];
      for (const f of frames) if (!kept.length || f.t - kept[kept.length - 1].t >= 0.12) kept.push(f);
      const delays = kept.map((f, i) => Math.round(Math.min(2500, ((kept[i + 1]?.t ?? f.t + 1.5) - f.t) * 1000)));
      const { createRequire } = await import('node:module');
      const sharp = createRequire(import.meta.url)('sharp');
      const inputs = await Promise.all(kept.map((f) => sharp(Buffer.from(f.data, 'base64')).resize({ width: 300 }).png().toBuffer()));
      const file = path.join(dir, 'first-run-phone.webp');
      await sharp(inputs, { join: { animated: true } }).webp({ quality: 55, delay: delays, loop: 0 }).toFile(file);
      const size = (await fs.stat(file)).size;
      report.push({ video: 'video/first-run-phone.webp', frames: kept.length, seconds: Math.round(delays.reduce((a, d) => a + d, 0) / 1000), bytes: size, endUrl });
      console.log(JSON.stringify(report[report.length - 1]));
    }
  } finally {
    const name = only ? 'report-partial.json' : arg('no-shots') ? 'report-video.json' : 'report.json';
    await fs.writeFile(path.join(OUT, name), JSON.stringify(report, null, 2));
    await b.close();
  }
}

await run();
