import { browser, context } from './round5-browser.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'artifacts/round5-completion', report = [];
const b = await browser();
try {
  for (const width of [390, 1280]) {
    const c = await context(b, width, 860, { isMobile: width === 390, hasTouch: width === 390 });
    const p = await c.newPage(); await p.bringToFront();
    await p.goto('http://localhost:3011', { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const stations = await p.locator('[data-pip-station]').evaluateAll(es => es.map(e => ({ id: e.dataset.pipStation, y: e.getBoundingClientRect().top + scrollY })));
    for (const direction of [1, -1]) {
      for (const station of direction === 1 ? stations : stations.slice().reverse()) {
        let target = Math.max(0, station.y - 180);
        for (let i = 0; i < 12; i++) {
          const delta = target - await p.evaluate(() => scrollY);
          if (Math.abs(delta) < 3) break;
          await p.mouse.wheel(0, Math.max(-450, Math.min(450, delta)));
          await p.waitForTimeout(80);
        }
        await p.waitForTimeout(300);
        const state = await p.evaluate(() => {
          const actor = document.querySelector('.pip-guide-flyer');
          const r = actor?.getBoundingClientRect();
          const visible = document.documentElement.dataset.pipPerchVisible === 'true';
          const collisions = visible && r ? [...document.querySelectorAll('button,a,input,select,summary')].filter(e => {
            const q = e.getBoundingClientRect();
            // A carousel card can have a rect outside its scrollport without being painted
            // there. Compare the actual clipped area, including a focus-ring allowance.
            let left = q.left - 5, right = q.right + 5, top = q.top - 5, bottom = q.bottom + 5;
            if (!q.width || !q.height || getComputedStyle(e).visibility === 'hidden') return false;
            for (let a = e.parentElement; a; a = a.parentElement) {
              const style = getComputedStyle(a), box = a.getBoundingClientRect();
              if (style.opacity === '0' || style.visibility === 'hidden') return false;
              if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
              if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
            }
            return right > left && bottom > top && left < r.right && right > r.left && top < r.bottom && bottom > r.top;
          }).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 80)) : [];
          return { active: document.documentElement.dataset.pipPerch, visible, collisions, overflow: document.documentElement.scrollWidth - innerWidth };
        });
        await p.screenshot({ path: `${out}/feel-${width}-${direction}-${station.id}.png` });
        assert.deepEqual(state.collisions, [], `${width} ${station.id}`);
        assert.equal(state.overflow, 0);
        report.push({ width, direction, requested: station.id, ...state });
      }
    }
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.waitForTimeout(150);
    assert.equal(await p.locator('.pip-guide-flyer').count(), 0);
    report.push({ width, reducedMotion: true, staticPerches: await p.locator('[data-pip-station]').count() });
    await c.close();
  }
  for (const width of [390, 1280]) {
    for (const view of ['today', 'result', 'progress']) {
      const c = await context(b, width, 860), p = await c.newPage(); await p.bringToFront();
      await p.goto(`http://localhost:3010/preview/arena?view=${view}&tonight=done&replay=ready`, { waitUntil: 'load' });
      await p.getByText(view === 'today' ? 'Tonight’s practice is recorded.' : view === 'result' ? 'Try five fresh questions' : 'Your first server-scored session is recorded.', { exact: true }).waitFor();
      await p.evaluate(() => { document.documentElement.style.fontSize = '200%'; document.body.style.fontSize = '200%'; });
      await p.waitForTimeout(150);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.equal(overflow, 0, `text 200% ${width} ${view}`);
      report.push({ width, view, text200: true, overflow, fixture: true });
      await p.screenshot({ path: `${out}/text200-${width}-${view}.png` }); await c.close();
    }
  }
  const c = await context(b, 390, 844, { hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  const p = await c.newPage(); await p.bringToFront();
  await p.goto('http://localhost:3010/preview/arena?view=today');
  const install = p.getByRole('button', { name: 'Add to home screen' });
  await install.waitFor();
  assert.ok((await install.boundingBox()).height >= 44);
  await install.click(); await p.getByText('In Safari, open Share, then choose Add to Home Screen.').waitFor();
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  report.push({ iosInstallHelp: true, touchTarget44: true, emulation: true });
  await p.screenshot({ path: `${out}/ios-install-help.png` }); await c.close();
} finally { await fs.writeFile(`${out}/acceptance.json`, JSON.stringify(report, null, 2)); await b.close(); }
console.log(JSON.stringify({ acceptanceChecks: report.length, passed: true }));
