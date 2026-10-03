import { browser, context } from './round5-browser.mjs';
import fs from 'node:fs/promises';
const b = await browser();
try {
  const c = await context(b, 1280, 860), p = await c.newPage();
  await p.bringToFront(); await p.goto('http://localhost:3011');
  await p.evaluate(() => document.fonts.ready);
  const y = await p.locator('[data-pip-station="pricing"]').evaluate(e => e.getBoundingClientRect().top + scrollY - 180);
  await p.mouse.wheel(0, y); await p.waitForTimeout(900);
  const state = await p.evaluate(() => {
    const actor = document.querySelector('.pip-guide-flyer').getBoundingClientRect();
    return { actor: actor.toJSON(), track: document.querySelector('.rl__track').getBoundingClientRect().toJSON(), controls: [...document.querySelectorAll('.rl__card')].map(e => {
      const r = e.getBoundingClientRect(), x = Math.max(r.left, actor.left), right = Math.min(r.right, actor.right), y = Math.max(r.top, actor.top), bottom = Math.min(r.bottom, actor.bottom);
      const hit = right > x && bottom > y ? document.elementFromPoint((x + right) / 2, (y + bottom) / 2) : null;
      return { rect: r.toJSON(), overlap: right > x && bottom > y, paintedHit: hit === e || e.contains(hit), hit: hit?.className };
    }) };
  });
  await fs.writeFile('artifacts/round5-completion/collision-probe.json', JSON.stringify(state, null, 2));
  await p.screenshot({ path: 'artifacts/round5-completion/collision-probe.png' });
  console.log(JSON.stringify(state));
} finally { await b.close(); }
