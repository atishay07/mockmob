// A real-render check for the Mob's tap targets: every button, link, input, select and switch on /mob must measure at
// least 44 px in both directions in its own box (go/no-go check 17 Oct: "targets are 44 px" passed on CSS strings while the
// switches rendered 52 x 32). Drives headless Chrome over CDP (data/tests/cdp_chrome.mjs, temp profile deleted on exit)
// against a running dev server's fixture page, in Night and Day, at 390 and 1440, in each fixture state.
// Usage: node scripts/dev/mob-target-check.mjs http://localhost:3264
import { launch } from '../../data/tests/cdp_chrome.mjs';

const base = process.argv[2] || 'http://localhost:3264';
const STATES = ['ready', 'pro', 'notsat', 'two', 'private', 'blocked', 'alone', 'sample', 'locked'];
const SCAN = `(() => [...document.querySelectorAll('.mob-page :is(button, a[href], input:not([type=radio]):not([type=checkbox]), select, [role=switch], summary)')]
  .map((e) => { const b = e.getBoundingClientRect(); return { tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 36), label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28), w: Math.round(b.width), h: Math.round(b.height) }; })
  .filter((x) => x.w > 0 && x.h > 0 && (x.w < 44 || x.h < 44)))()`;

const chrome = await launch();
const failures = [];
try {
  for (const theme of ['dark', 'light']) for (const [w, h] of [[390, 844], [1440, 900]]) for (const state of STATES) {
    const page = await chrome.page({ width: w, height: h, theme, reducedMotion: true });
    try {
      await page.goto(`${base}/preview/arena?view=mob&mob=${state}`, '.mob-page .mob-card');
      await page.eval('new Promise((r) => setTimeout(r, 500))');
      for (const small of await page.eval(SCAN)) failures.push({ theme, w, state, ...small });
    } finally { await page.close(); }
  }
} finally { await chrome.close(); }
if (failures.length) { console.error(JSON.stringify(failures, null, 1)); process.exit(1); }
console.log(`ok: every Mob target is at least 44 x 44 (${STATES.length} states x 2 widths x 2 themes)`);
