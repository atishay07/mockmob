import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
const out = 'scratch/shots'; mkdirSync(out, { recursive: true });
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, headless: true });
const cases = [['nta-plain', 'view=result&mock=nta'], ['nta-thin', 'view=result&mock=nta&bank=thin']];
for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: 1 });
    for (const [name, q] of cases) {
      const page = await ctx.newPage();
      await page.goto(`http://localhost:3202/preview/arena?${q}&plan=free&data=ready`, { waitUntil: 'networkidle', timeout: 90000 }).catch((e) => console.log('goto', e.message));
      await page.waitForTimeout(2500);
      const sec = page.locator('.sw-plan').first();
      const found = await sec.count();
      if (found) { await sec.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500); }
      const text = found ? await page.locator('.sw-plan').first().innerText() : 'NO PLAN';
      console.log(name, tag, theme, '\n', text.replace(/\n+/g, ' | '));
      await page.screenshot({ path: `${out}/${name}-${tag}-${theme}.png`, fullPage: false });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
