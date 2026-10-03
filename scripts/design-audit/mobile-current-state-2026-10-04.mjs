// Read-only browser audit. Public production page + development-only Arena fixtures.
import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';

const out = 'artifacts/mobile-audit-2026-10-04';
await fs.mkdir(out, { recursive: true });
const contrastSource = await fs.readFile('scripts/design-audit/contrast-audit.js', 'utf8');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const fixtureOnly = process.argv.includes('--fixtures');
const report = fixtureOnly ? JSON.parse(await fs.readFile(`${out}/report.json`, 'utf8')) : { at: new Date().toISOString(), scope: 'Chrome emulation; no physical-device or live authenticated proof', pages: [], timing: [] };
if (fixtureOnly) report.pages = report.pages.filter(row => !row.fixture);
async function setup(width, theme, reduced = false) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.addInitScript(theme => { localStorage.setItem('mm:theme:v1', theme); }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return { context, page, errors };
}
async function state(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const e = document.querySelector(selector); if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), visiblePx: Math.max(0, Math.min(r.bottom, innerHeight - 90) - Math.max(r.top, 72)) };
    };
    return { y: Math.round(scrollY), theme: document.documentElement.dataset.theme, step: document.querySelector('.ml__steps [data-active="true"] .ml__label')?.textContent, revealed: document.querySelectorAll('.ml__tile:not(:disabled)').length, progress: getComputedStyle(document.querySelector('.ml__bar b') || document.body).animationPlayState, lab: rect('.ml'), rail: rect('.ml__rail'), stage: rect('.ml__stage'), guide: rect('.pip-guide-flyer'), perch: document.documentElement.dataset.pipPerch, guideVisible: document.documentElement.dataset.pipPerchVisible, overflow: document.documentElement.scrollWidth - innerWidth };
  });
}
try {
  for (const width of fixtureOnly ? [] : [390, 1280]) for (const theme of ['dark', 'light']) {
    const { context, page, errors } = await setup(width, theme);
    await page.goto('https://www.mockmob.in/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/live-${width}-${theme}-hero.png` });
    const row = { url: page.url(), width, theme, initial: await state(page), errors, shots: [] };
    const labY = await page.locator('.ml').evaluate(e => e.getBoundingClientRect().top + scrollY);
    await page.evaluate(y => scrollTo({ top: y - innerHeight + 130, behavior: 'instant' }), labY);
    await page.waitForTimeout(650);
    const before = await state(page);
    await page.screenshot({ path: `${out}/live-${width}-${theme}-lab-entry.png` });
    await page.waitForTimeout(6800);
    const after = await state(page);
    report.timing.push({ width, theme, scenario: 'Lab navigation edge visible, stage below viewport; 6.8 seconds reading', before, after });
    // A measured slow reading scroll through the rail, rather than jumping to the stage.
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 90); await page.waitForTimeout(450); }
    row.labAtArrival = await state(page);
    await page.screenshot({ path: `${out}/live-${width}-${theme}-lab-arrival.png` });
    for (const [name, selector] of [['lab', '.ml__stage'], ['exam', '.lp-exam'], ['compass', '.cl'], ['pricing', '#pricing']]) {
      if (!await page.locator(selector).count()) continue;
      await page.locator(selector).first().evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' }));
      await page.waitForTimeout(650);
      await page.screenshot({ path: `${out}/live-${width}-${theme}-${name}.png` });
      row.shots.push({ name, state: await state(page), contrast: await page.evaluate(contrastSource) });
    }
    report.pages.push(row); await context.close();
    console.log(`Public ${width} ${theme}: ${after.step}; stage visibility at timer advance ${after.stage.visiblePx}px`);
  }
  for (const width of [320, 390, 430]) for (const theme of ['dark', 'light']) for (const view of ['dashboard', 'test', 'result']) {
    const { context, page, errors } = await setup(width, theme);
    await page.bringToFront();
    const extra = view === 'test' ? '&subject=accountancy&mode=quick&count=5&generationKey=mobile-audit' : '';
    await page.goto(`http://localhost:3010/preview/arena?view=${view}&plan=pro${extra}`, { waitUntil: 'load', timeout: 60000 });
    const readySelector = view === 'test' ? '.nta-option' : view === 'result' ? '.rp-hero' : '.pr-head';
    let ready = true;
    try { await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 15000 }); }
    catch { ready = false; }
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/fixture-${width}-${theme}-${view}.png`, fullPage: view !== 'test' });
    const controls = await page.locator('button, a, input, select').evaluateAll(es => es.filter(e => {
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0 && !e.closest('[inert]');
    }).map(e => { const r = e.getBoundingClientRect(); return { text: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 60), width: Math.round(r.width), height: Math.round(r.height), hit: e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; }));
    report.pages.push({ url: page.url(), fixture: true, ready, width, theme, view, state: await state(page), contrast: await page.evaluate(contrastSource), controls, errors });
    console.log(`Fixture ${width} ${theme} ${view}: ready ${ready}, ${errors.length} errors`);
    await context.close();
  }
  const { context, page } = await setup(390, 'light', true);
  await page.goto('https://www.mockmob.in/', { waitUntil: 'load' });
  await page.locator('.ml__stage').evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' }));
  await page.waitForTimeout(1200);
  report.reduced = await state(page);
  await page.screenshot({ path: `${out}/live-390-light-reduced.png` });
  await context.close();
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
