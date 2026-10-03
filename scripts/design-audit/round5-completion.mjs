import { browser, context } from './round5-browser.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = `http://localhost:${process.env.ROUND5_PORT || 3010}`;
const out = 'artifacts/round5-completion';
await fs.mkdir(out, { recursive: true });
const offlineOnly = process.argv.includes('--offline');
const b = await browser(), report = offlineOnly ? JSON.parse(await fs.readFile(`${out}/browser.json`, 'utf8')) : [];
try {
  // Autoplay, rather than a manually selected step, must produce one visible peak.
  for (const width of process.argv.includes('--states') || offlineOnly ? [] : [1280, 390]) {
    const c = await context(b, width, 860, { isMobile: width === 390, hasTouch: width === 390 });
    const p = await c.newPage(), errors = [];
    await p.bringToFront();
    p.on('pageerror', error => errors.push(error.message));
    await p.goto(base, { waitUntil: 'load' });
    await p.locator('[data-pip-station="lab"]').waitFor();
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.documentElement.dataset.pipGuide === 'on');
    await p.evaluate(() => {
      window.__peaks = [];
      new MutationObserver(() => {
        const motion = document.querySelector('.pip-guide-flyer .pip-actor')?.dataset.motion;
        if (motion?.startsWith('jump') && !window.__peaks.includes(motion)) window.__peaks.push(motion);
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-motion'] });
      const y = document.querySelector('[data-pip-station="lab"]').getBoundingClientRect().top + scrollY;
      scrollTo({ top: y - 150, behavior: 'instant' });
    });
    try { await p.waitForFunction(() => window.__peaks.length === 1, null, { timeout: 30000 }); }
    catch (error) {
      console.log(JSON.stringify(await p.evaluate(() => ({ width: innerWidth, y: scrollY, peaks: window.__peaks, station: document.documentElement.dataset.pipPerch, visible: document.documentElement.dataset.pipPerchVisible, move: document.querySelector('.ml')?.dataset.pipMove, step: document.querySelector('.ml__steps [data-active="true"]')?.textContent, moveTop: [...document.querySelectorAll('.ml__steps button')][2]?.getBoundingClientRect().top, bar: document.querySelector('.ml__bar b') ? getComputedStyle(document.querySelector('.ml__bar b')).animationPlayState : 'none' }))));
      await p.screenshot({ path: `${out}/failed-autoplay.png`, fullPage: true });
      throw error;
    }
    await p.screenshot({ path: `${out}/autoplay-${width}.png` });
    await p.mouse.wheel(0, 1700); await p.waitForTimeout(250);
    await p.mouse.wheel(0, -1700); await p.waitForTimeout(1000);
    assert.equal(await p.evaluate(() => window.__peaks.length), 1);
    report.push({ width, autoplayPeak: await p.evaluate(() => window.__peaks), errors });
    assert.deepEqual(errors, []);
    await c.close();
  }
  // Test new states with explicit development fixture data, never a user account.
  for (const width of offlineOnly ? [] : [320, 390, 768, 1024, 1280]) {
    for (const theme of ['dark', 'light']) {
      const errors = [];
      for (const [view, extra, text] of [['today', '&tonight=done', 'Tonight’s practice is recorded.'], ['result', '&replay=ready', 'Try five fresh questions'], ['result', '', 'Fresh verified questions are not ready yet.'], ['progress', '', 'Your first server-scored session is recorded.']]) {
        const c = await context(b, width, 860, { hasTouch: width <= 600, isMobile: width <= 600 });
        await c.addInitScript(theme => localStorage.setItem('mm:theme:v1', theme), theme);
        const p = await c.newPage();
        await p.bringToFront();
        p.on('pageerror', error => errors.push(error.stack || error.message));
        await p.goto(`${base}/preview/arena?view=${view}${extra}`, { waitUntil: 'load' });
        try { await p.getByText(text, { exact: true }).waitFor({ timeout: 30000 }); }
        catch (error) {
          console.log(JSON.stringify({ url: p.url(), errors, body: await p.locator('body').innerText() }));
          await p.screenshot({ path: `${out}/failed-state.png`, fullPage: true });
          throw error;
        }
        if (view === 'today') {
          await p.getByRole('button', { name: '20 min', exact: true }).click();
          await p.getByRole('heading', { name: 'Start 20 practice questions', exact: true }).waitFor();
        }
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.equal(overflow, 0, `${width} ${theme} ${view}`);
        await p.screenshot({ path: `${out}/${width}-${theme}-${view}${extra.replace(/[^a-z0-9]/gi, '_')}.png` });
        report.push({ width, theme, view, extra, overflow, fixture: true });
        await c.close();
      }
      assert.deepEqual(errors, []);
    }
  }
  const c = await context(b, 390, 844), p = await c.newPage();
  await p.bringToFront();
  p.on('dialog', dialog => dialog.accept());
  const url = `${base}/preview/arena?view=test&subject=accountancy&mode=quick&count=5&generationKey=round5-offline-fixture`;
  await p.goto(url, { waitUntil: 'load' });
  await p.locator('.nta-option').first().click();
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('mm:test:preview-user:')))));
  await p.evaluate(() => { window.__previewOfflineSubmission = true; });
  await p.getByRole('button', { name: 'Palette', exact: true }).click();
  await p.getByRole('dialog', { name: 'Question palette' }).getByRole('button', { name: 'Submit test', exact: true }).click();
  await p.getByText(/Waiting for server confirmation/).waitFor();
  assert.equal(await p.locator('.nta-option').first().isEnabled(), false);
  await p.screenshot({ path: `${out}/offline-pending.png` });
  // Simulate loss of connectivity, then reload the developer fixture while online
  // to prove identity/deadline/answer restore; this does not prove live submission.
  await c.setOffline(true);
  await c.setOffline(false);
  await p.reload({ waitUntil: 'load' });
  await p.getByText(/Waiting for server confirmation/).waitFor();
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('mm:test:preview-user:')))));
  assert.equal(after.selectionMeta.sessionId, before.selectionMeta.sessionId);
  assert.equal(after.endsAt, before.endsAt);
  assert.deepEqual(after.answers, before.answers);
  report.push({ offlineRestore: true, sameSession: true, sameDeadline: true, sameAnswers: true, fixture: true });
  await c.close();
} finally {
  await fs.writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2));
  await b.close();
}
console.log(JSON.stringify({ checks: report.length, passed: true }));
