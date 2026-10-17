// The Mob's tap targets, measured in a real render (go/no-go check 18 Oct: the 44 px test read CSS strings while a 52 x 32
// box shipped in the member row). This loads the real stylesheets the Mob page draws with (motion-kit.css for the site
// switch, controls.css for the switch row, mob.css), renders the same markup the components write, and measures each
// target's own box in headless Chrome (playwright-core, its own temporary profile), at 390 and 1440, in Night and Day.
// A source check pins the markup to the components, so a change there that this fixture does not follow fails here.
// The full page, every fixture state, with the member menu opened by a real click: scripts/dev/mob-target-check.mjs.
// Run: node --test data/tests/mob_render_size.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const PW = process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const canRender = existsSync(PW) && CHROME.some((p) => existsSync(p));

const page = read('src/components/mob/MobPage.jsx');
const switchSrc = read('src/components/ui/Switch.jsx');
const toggleSrc = read('src/components/ui/controls/ToggleRow.jsx');

test('the fixture follows the components: member menu button, switch row and switch markup', () => {
  assert.match(page, /<li key=\{m\.memberId\} className="mob-member">/);
  assert.match(page, /<button type="button" className="mob-icon" aria-label=\{`More for \$\{m\.name\}`\} onClick=\{\(\) => setMember\(m\)\}><Ellipsis size=\{18\}/);
  assert.match(page, /className="pr ov mob-page"/);
  assert.match(page, /<div className="mob-menu">/);
  assert.match(page, /className="mob-menu__item"/);
  assert.match(toggleSrc, /<label className=\{`ctl-toggle \$\{className\}`\.trim\(\)\}/);
  assert.match(switchSrc, /role="switch"[^>]*className=\{`mk-switch \$\{className\}`\.trim\(\)\}/);
  assert.match(switchSrc, /<svg className="mk-switch__tick" viewBox="0 0 52 32"/);
  assert.match(switchSrc, /<span className="mk-switch__thumb" \/>/);
});

const icon = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1"/></svg>';
const sw = (on) => `<button type="button" role="switch" aria-checked="${on}" class="mk-switch" aria-label="s"><svg class="mk-switch__tick" viewBox="0 0 52 32" aria-hidden="true"><path d="M11 16.5 L14.8 20.2 L21 12.6"/></svg><span class="mk-switch__thumb"></span></button>`;
const row = (on, label, hint) => `<label class="ctl-toggle" data-on="${on}"><span class="ctl-toggle__text"><span class="ctl-toggle__label">${label}</span><small>${hint}</small></span>${sw(on)}</label>`;
const html = (theme) => `<!doctype html><html data-theme="${theme}"><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${read('src/app/motion-kit.css')}</style><style>${read('src/components/ui/controls/controls.css')}</style><style>${read('src/components/mob/mob.css')}</style>
<style>body { margin: 0; padding: 16px; font-family: sans-serif; }</style></head><body>
<section class="pr ov mob-page"><div class="mob-card mob-plain">
  <ol class="mob-members">
    <li class="mob-member"><span class="mob-disc" data-colour="volt" aria-hidden="true">R</span><span class="mob-member__name"><b>Riya</b><span>You</span></span><span class="mob-icon mob-icon--spacer" aria-hidden="true"></span></li>
    <li class="mob-member"><span class="mob-disc" data-colour="sky" aria-hidden="true">A</span><span class="mob-member__name"><b>Asha Raghunathan Venkatesh</b></span><span class="mob-member__state"><span class="mob-score">38 of 50</span></span><button type="button" class="mob-icon" aria-label="More for Asha">${icon}</button></li>
    <li class="mob-member"><span class="mob-disc" data-colour="rose" aria-hidden="true">K</span><span class="mob-member__name"><b>Kabir</b></span><button type="button" class="mob-icon" aria-label="More for Kabir">${icon}</button></li>
  </ol>
  ${row(true, 'Show my score to my Mob', 'Your Mob sees your score.')}
  ${row(false, 'Mute nudges', 'You will not see Sit it with me notes.')}
  <div class="mob-menu"><button type="button" class="mob-menu__item">Report</button><button type="button" class="mob-menu__item">Leave and block</button></div>
</div></section></body></html>`;

test('every Mob target measures 44 x 44 or more in its own box: the member "..." button, both switches, the menu items', { skip: canRender ? false : 'no playwright-core or Chrome on this machine' }, async () => {
  const { chromium } = await import(pathToFileURL(PW).href);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const theme of ['dark', 'light']) for (const width of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const p = await ctx.newPage();
      await p.setContent(html(theme));
      const boxes = await p.evaluate(() => [...document.querySelectorAll('.mob-page :is(button, [role=switch])')].map((e) => {
        const b = e.getBoundingClientRect();
        const rail = e.matches('.mk-switch') ? getComputedStyle(e, '::before') : null;
        return { label: e.getAttribute('aria-label') || e.textContent.trim(), cls: e.className, w: b.width, h: b.height, rail: rail ? [rail.width, rail.height] : null };
      }));
      assert.equal(boxes.filter((b) => /^More for/.test(b.label)).length, 2, 'both member menu buttons rendered');
      assert.equal(boxes.filter((b) => b.cls.includes('mk-switch')).length, 2, 'both switches rendered');
      for (const b of boxes) {
        assert.ok(b.w >= 44 && b.h >= 44, `${theme} ${width}: "${b.label}" (${b.cls}) is ${b.w} x ${b.h}, under 44`);
        // The switch keeps its look: the rail is still drawn 52 x 32 inside the 44 px box.
        if (b.rail) assert.deepEqual(b.rail, ['52px', '32px'], `${theme} ${width}: the switch rail moved`);
      }
      // The member "..." button is exactly the 44 x 44 icon target, not stretched by the row.
      for (const b of boxes.filter((x) => /^More for/.test(x.label))) assert.deepEqual([b.w, b.h], [44, 44]);
      await ctx.close();
    }
  } finally { await browser.close(); }
});
