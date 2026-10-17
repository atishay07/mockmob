// Captures of the phone dock (NAV-1017 W1) through the /preview/arena fixtures, Night and Day, in headless Chrome.
//   node scripts/design-audit/dock-1017-capture.mjs http://localhost:3254 <out dir>
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch } from '../../data/tests/cdp_chrome.mjs';

const [base = 'http://localhost:3254', out = 'tmp/dock-1017'] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (view) => `${base}/preview/arena?view=${view}&plan=free&data=ready`;
const chrome = await launch();
const written = [];
try {
  for (const theme of ['dark', 'light']) {
    const tag = theme === 'dark' ? 'night' : 'day';
    const page = await chrome.page({ width: 390, height: 844, scale: 2, theme, reducedMotion: false });
    try {
      for (const [w, h, sc] of [[390, 844, 2], [1440, 900, 1]]) {
        await page.viewport(w, h, sc);
        for (const view of ['dashboard', 'today', 'review', 'compass', 'saved', 'result']) {
          await page.goto(url(view), w < 1024 ? '.arena-dock nav a' : '.arena-sidebar');
          await sleep(1400);
          const file = join(out, `${view}-${w}-${tag}.png`);
          await writeFile(file, await page.shot());
          written.push(file);
          if (w < 1024 && view === 'dashboard') {
            for (const y of [700, 99999]) {
              await page.eval(`scrollTo({ top: ${y}, behavior: 'instant' })`);
              await sleep(900);
              const f = join(out, `${view}-${w}-${tag}-scroll${y > 9999 ? 'end' : y}.png`);
              await writeFile(f, await page.shot());
              written.push(f);
            }
          }
        }
      }
      // More open, and the narrow phone.
      await page.viewport(390, 844, 2);
      await page.goto(url('today'), '.arena-dock nav a');
      await sleep(900);
      const more = await page.eval(`(() => { const b = [...document.querySelectorAll('.arena-dock nav button')].find((n) => n.textContent.trim() === 'More'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; })()`);
      if (!more.hit) throw new Error('More is covered');
      await page.click(more.x, more.y);
      await sleep(900);
      let f = join(out, `more-390-${tag}.png`);
      await writeFile(f, await page.shot());
      written.push(f);
      await page.viewport(320, 700, 2);
      await page.goto(url('compass'), '.arena-dock nav a');
      await sleep(1200);
      f = join(out, `compass-320-${tag}.png`);
      await writeFile(f, await page.shot());
      written.push(f);
    } finally {
      await page.close();
    }
  }
} finally {
  await chrome.close();
}
console.log(written.join('\n'));
