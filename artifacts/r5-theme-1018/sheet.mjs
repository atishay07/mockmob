import { createRequire } from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const dir = process.argv[2];
const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-sheet-'));
const ctx = await chromium.launchPersistentContext(profile, { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, viewport: { width: 1500, height: 300 } });
const page = await ctx.newPage();
for (const run of report.runs) {
  const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`;
  const cells = run.frames.map(({ f, ms }) => `<figure><img class="t" src="${img(f)}"><figcaption>${ms} ms</figcaption></figure>`).join('');
  const pages = run.frames.map(({ f, ms }, i) => i % 3 === 0 ? `<figure><img class="p" src="${img(f.replace(`${run.tag}-f`, `${run.tag}-page-f`))}"><figcaption>${ms} ms</figcaption></figure>` : '').join('');
  await page.setContent(`<html><body style="margin:0;padding:10px;background:#9a9a9a;font:12px system-ui"><style>h3{margin:6px 0}.row{display:flex;flex-wrap:wrap;gap:4px}figure{margin:0;text-align:center;background:#fff;padding:3px}img.t{width:150px;display:block}img.p{width:${run.tag.startsWith('390') ? 160 : 230}px;display:block}</style><h3>${report.label} ${run.tag}: the switch, frozen and stepped (animation ms)</h3><div class="row">${cells}</div><h3>the page reveal at the same moments</h3><div class="row">${pages}</div></body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `SHEET-${run.tag}.png`), fullPage: true });
}
await ctx.close(); fs.rmSync(profile, { recursive: true, force: true });
