// The website's phone dock (NAV-1017 section 8, packet W1; owner feedback F12, F13 and L31), as the five places of the app
// (WEB-NAV-1019 option A, owner D114): Today, Practice, the Start key in the centre, Mob and You.
// Static checks always run. The DOM measurements run in headless Chrome against a running server:
//   DOCK_BASE_URL=http://localhost:3254 node --test data/tests/dock_alignment.test.mjs
// DOCK_CHROME=<file URL of a module exporting launch()> swaps the DevTools driver (cdp_chrome.mjs) for another headless driver
// with the same page interface, e.g. one built on playwright-core.
// (the /preview/arena fixtures need no account). Without DOCK_BASE_URL they are skipped, and say so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEASURE_DOCK, MEASURE_CLEARANCE, COUNT_VOLT_FILLS } from './dock_measure.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
// arenaNavigation.js imports through the app's '@/' alias, which plain Node does not know: load it with that one
// specifier pointed at the real file.
const navSource = read('src/lib/arenaNavigation.js').replace("'@/../data/capabilities'", `'${new URL('../capabilities.js', import.meta.url).href}'`);
const { MOBILE_STUDY_NAV, arenaNavigation, mobileNavigation, youSheetGroups, ASK_MOBI_NAV, PRACTICE_PAGES } = await import(`data:text/javascript,${encodeURIComponent(navSource)}`);
const layout = read('src/app/(app)/AppLayoutClient.jsx');
const startCss = read('src/components/start/start.css');
const arenaCss = read('src/app/(app)/arena.css');

test('the dock holds Today, Practice, the Start key, Mob and You; every other page is one tap away, nothing removed', () => {
  assert.deepEqual(MOBILE_STUDY_NAV.map((tab) => tab.label), ['Today', 'Practice', 'Mob']);
  assert.deepEqual(mobileNavigation({ mob: true }).map((tab) => tab.href ?? `/${tab.id}`), ['/today', '/dashboard', '/mob']);
  assert.deepEqual(mobileNavigation({ mob: false }).map((tab) => tab.label), ['Today', 'Practice'], 'the Mob is not drawn while it is off');
  // Every page the old dock and More sheet reached still has a link: in the sidebar's places, or on the You sheet (its head and groups).
  const sidebar = arenaNavigation(false, { mob: true }).flatMap((group) => group.items.map((item) => item.id));
  const sheet = youSheetGroups(false, { mob: true }).flatMap((group) => group.items.map((item) => item.id));
  for (const id of ['today', 'dashboard', 'learn', 'review', 'explore', 'saved', 'mob', 'leaderboard', 'progress', 'analytics', 'admission-compass', 'profile', 'wallet', 'help']) {
    assert.ok(sidebar.includes(id), `${id} is in the sidebar`);
  }
  assert.deepEqual(sheet, ['progress', 'analytics', 'admission-compass', 'wallet'], 'the You sheet lists the plan; the account head and Ask Mobi sit above it');
  assert.equal(ASK_MOBI_NAV.href, '/mentor');
  // Learn, Explore, Saved and Your papers moved into Practice's row of tabs on a phone, in this order.
  assert.deepEqual(PRACTICE_PAGES.map((tab) => tab.label), ['Practice', 'Your papers', 'Learn', 'Explore', 'Saved']);
  // The shell draws the capsule from those lists: the Start key as the third child, You (the sheet's opener) as the last.
  assert.match(layout, /const dockTabs = mobileNavigation\(\{ mob: mobOn \}\)/);
  assert.match(layout, /\{index === 2 \? <StartKey variant="bar" onOpen=\{\(\) => setMobileMenuOpen\(false\)\} \/> : null\}/);
  assert.match(layout, /<AppIcon name="account" size=\{24\} \/><span>You<\/span>/);
  // The You sheet: the account card (name, Show me around, Guide) heads it, Ask Mobi follows, the places come next and Night and
  // Day comes last, still below Ask Mobi (D6).
  assert.match(layout, /<Link href=\{previewLinks\?\.help \|\| '\/help'\} className="arena-sheet__help"[\s\S]{0,160}?>\s*<AppIcon name="help" \/> \{HELP_DOOR\.label\}/);
  assert.match(layout, /className="arena-sheet__lead arena-sheet__lead--ask"[\s\S]{0,1200}?\{sheetGroups\.map[\s\S]{0,700}?<AppearanceSwitch \/>/);
  // And Learn keeps a second home on the Practice page, while the lessons are on.
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /\{studyEnabled && <ConceptsPanel \/>\}/);
  assert.match(read('src/components/study/ConceptsPanel.jsx'), /<h2 id="pr-concepts">Concepts<\/h2>[\s\S]{0,900}href="\/learn"[^>]*>All concepts</);
  assert.match(read('src/app/(app)/dashboard/page.js'), /studyEnabled=\{process\.env\.STUDY_CONTENT_ENABLED === 'true'\}/);
});

test('the Start key is the capsule’s centre slot, so the nav holds five slots and the key is never a current place', () => {
  const dock = layout.slice(layout.indexOf('<div className="arena-dock">'), layout.indexOf('<StartSheetHost'));
  assert.match(dock, /<nav className="arena-bottomnav" aria-label="Quick study navigation" data-slots=\{dockTabs\.length \+ 2\}>/);
  assert.ok(dock.indexOf('<StartKey variant="bar"') < dock.indexOf('</nav>'), 'the key is drawn inside the capsule');
  assert.match(layout, /document\.querySelector\('\.arena-dock'\)/, 'the You sheet measures the whole dock');
  // The key is an action, so the lens and the marks never rest on it: only places mark the capsule.
  const rules = arenaCss.slice(arenaCss.indexOf('html .app-shell .arena-bottomnav:has(> :nth-child(1)'), arenaCss.indexOf('html .app-shell .arena-bottomnav :is(a, button) {'));
  assert.doesNotMatch(rules, /nth-child\(3\)\[aria-expanded/);
});

test('the dock key follows no page state but one: whether the page’s own lime key is on screen (F12 kept, W-075)', () => {
  const rules = startCss.split('}').filter((rule) => rule.includes('stk--bar'));
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    assert.doesNotMatch(rule, /:has\(|data-shown|data-primary-shown|data-cta-shown|student-page--result|aria-expanded/, `no page-state selector on the dock key: ${rule.trim().slice(0, 120)}`);
  }
  // The one page-dependent look is the key's own data-quiet attribute (StartKey draws it from the shell's watch of the
  // page's lime key, pagePrimary.mjs). It changes colours only, so the box and the place the rows above measure are the same.
  const quiet = rules.filter((rule) => rule.includes('[data-quiet]'));
  assert.ok(quiet.length >= 2, 'the quiet look exists, for the key and its mark');
  for (const rule of quiet) assert.doesNotMatch(rule.slice(rule.lastIndexOf('{')), /\b(width|height|padding|margin|top|left|position|display|grid-template|border-radius)\s*:/, 'quiet changes colours only');
  assert.doesNotMatch(startCss, /stk__disc[^{]*\{[^}]*top:\s*-/, 'no disc rising out of the bar');
});

test('the lens is a neutral plate 4 px narrower than its slot, never volt', () => {
  const lens = arenaCss.slice(arenaCss.indexOf('html .app-shell .arena-bottomnav::before {'));
  const rule = lens.slice(0, lens.indexOf('}'));
  assert.match(rule, /width: calc\(\(100% - 2 \* var\(--dock-pad\)\) \/ 5 - 4px\)/);
  assert.match(rule, /height: 56px/);
  assert.doesNotMatch(rule, /volt|accent/);
});

test('the page ends at the dock: a fixed foot in the page colour, never volt, never catching a pointer (D13)', () => {
  const start = arenaCss.indexOf('html .app-shell .arena-dock::before {');
  assert.ok(start > 0, 'the dock has a foot');
  const rule = arenaCss.slice(start, arenaCss.indexOf('}', start));
  assert.match(rule, /position: fixed/);
  assert.match(rule, /z-index: -1/);
  assert.match(rule, /var\(--a-bg\)/, 'the page colour, not a colour of its own');
  assert.match(rule, /pointer-events: none/);
  assert.doesNotMatch(rule, /volt|accent|box-shadow/);
  // The foot reaches 40 px above the capsule, so it softens what runs under the dock instead of cutting it off.
  assert.match(rule, /12px \+ 64px \+ 40px/);
});

test('narrow phones set the words at 10 px so the lens never touches a letter (D13, measured at 360 and 375)', () => {
  const at = arenaCss.indexOf('@media (max-width: 379px)');
  assert.ok(at > 0);
  assert.match(arenaCss.slice(at, arenaCss.indexOf('}', at)), /--dock-label: 10px/);
});

test('slot widths stay at or above 44 px, and the 56 px key fits its centre slot, at every phone width (NAV-1017 6.1 formula)', () => {
  for (const width of [320, 340, 360, 375, 390, 412, 480, 768]) {
    const narrow = width < 360;
    const gutter = narrow ? 8 : 16;
    const gap = narrow ? 6 : 8;
    const pad = narrow ? 3 : 4;
    const row = Math.min(width - 2 * gutter, 440);
    const slot = (row - 2 * pad) / 5;
    assert.ok(slot >= 56, `${width}: slot ${slot.toFixed(1)} holds the 44 px rule and the 56 px key`);
    void gap;
  }
});

const BASE = process.env.DOCK_BASE_URL;
const view = (name, extra = '') => `${BASE}/preview/arena?view=${name}&plan=free&data=ready${extra}`;
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
// The dock is in the server HTML before React hydrates it; a click before then does nothing. Wait for React's props.
const HYDRATED = `(() => { const el = document.querySelector('.arena-dock nav button'); return Boolean(el && Object.keys(el).some((k) => k.startsWith('__reactProps'))); })()`;
const hydrate = async (page) => { const t0 = Date.now(); while (Date.now() - t0 < 30000 && !(await page.eval(HYDRATED))) await new Promise((r) => setTimeout(r, 150)); };

test('DOM measurement in headless Chrome', { skip: BASE ? false : 'set DOCK_BASE_URL to a running server to measure the dock' }, async (t) => {
  const { launch } = await import(process.env.DOCK_CHROME || './cdp_chrome.mjs');
  const chrome = await launch();
  try {
    const sizes = [[320, 700], [360, 800], [390, 844], [430, 932], [768, 1024]];
    for (const theme of ['dark', 'light']) {
      const page = await chrome.page({ width: 390, height: 844, theme });
      try {
        for (const [width, height] of sizes) {
          await page.viewport(width, height, 1);
          for (const [name, current] of [['dashboard', 'Practice'], ['today', 'Today'], ['review', 'Practice'], ['saved', 'Practice'], ['ranks', 'Mob'], ['compass', 'You'], ['wallet', 'You']]) {
            await t.test(`${theme} ${width}x${height} ${name}`, async () => {
              await page.goto(view(name), '.arena-dock nav a');
              await new Promise((r) => setTimeout(r, 250));
              const m = await page.eval(MEASURE_DOCK);
              assert.equal(m.shown, true);
              const narrow = width < 360;
              // 1. One icon line, one baseline, for the four places and the key in the centre.
              assert.equal(m.iconCentres.length, 5);
              for (const y of m.iconCentres) assert.ok(near(y, m.iconCentres[0]), `icon centres ${m.iconCentres.map((v) => v.toFixed(2))}`);
              for (const y of m.baselines) assert.ok(near(y, m.baselines[0]), `baselines ${m.baselines.map((v) => v.toFixed(2))}`);
              assert.ok(near(m.iconCentres[0] - m.nav.top, 23), `icon centre 23 px into the row (${(m.iconCentres[0] - m.nav.top).toFixed(2)})`);
              // 2. The key is a 56 px circle in the capsule's centre slot, 4 px in from the capsule's top and bottom.
              assert.equal(m.key.index, 2, 'the key is the third child of the capsule');
              assert.ok(near(m.key.slot.width, 56) && near(m.key.slot.height, 56) && near(m.nav.height, 64), `key ${m.key.slot.width}x${m.key.slot.height}`);
              assert.ok(near(m.key.slot.top - m.nav.top, 4) && near(m.nav.bottom - m.key.slot.bottom, 4), 'key 4 px from the capsule edges');
              assert.ok(near((m.key.slot.left + m.key.slot.right) / 2, (m.nav.left + m.nav.right) / 2, 1), 'the key is centred in the capsule');
              // 3. Nothing stands above the capsule; the row floats 12 px above the bottom edge.
              assert.ok(m.highest >= m.nav.top - 0.5, `highest ${m.highest} vs capsule top ${m.nav.top}`);
              assert.ok(near(height - m.nav.bottom, 12), `lift ${height - m.nav.bottom}`);
              assert.ok(near(m.nav.right, width - (narrow ? 8 : 16)) || width >= 472, 'right gutter');
              // 4. Slots: 44 px or wider, labels never wrap or spill out of their slot.
              for (const s of m.slots) {
                assert.ok(s.slot.width >= 44 - 0.01, `${s.name} slot ${s.slot.width}`);
                assert.ok(s.label.height <= 15, `${s.name} label on one line`);
                assert.ok(s.label.left >= s.slot.left - 0.5 && s.label.right <= s.slot.right + 0.5, `${s.name} label inside its slot`);
              }
              // 5. The lens frames the current place and never reaches into a neighbour's icon or word.
              const active = m.slots.find((s) => s.current);
              assert.equal(active?.name ?? null, current);
              if (active) {
                assert.equal(m.lens.opacity, 1);
                for (const part of [active.icon, active.label]) {
                  assert.ok(part.left >= m.lens.left + 0.5 && part.right <= m.lens.right - 0.5, `${active.name} inside the lens (${part.left.toFixed(1)}-${part.right.toFixed(1)} in ${m.lens.left.toFixed(1)}-${m.lens.right.toFixed(1)})`);
                }
                for (const other of [...m.slots.filter((s) => s !== active), m.key]) {
                  for (const part of [other.icon, other.label]) {
                    assert.ok(part.right <= m.lens.left || part.left >= m.lens.right, `lens clear of ${other.name}`);
                  }
                }
                assert.ok(near((m.lens.left + m.lens.right) / 2, (active.slot.left + active.slot.right) / 2), 'lens centred on its slot');
              } else {
                assert.equal(m.lens.opacity, 0, 'no place current, no lens');
              }
              // 6. A pointer at each place's centre lands on that place.
              assert.deepEqual(m.hits, [true, true, true, true, true]);
            });
          }
          await t.test(`${theme} ${width}x${height} content clears the dock`, async () => {
            for (const name of ['today', 'review', 'saved', 'compass']) {
              await page.goto(view(name), '.arena-dock nav a');
              await new Promise((r) => setTimeout(r, 400));
              const c = await page.eval(MEASURE_CLEARANCE);
              assert.ok(c.atEnd, `${name}: scrolled to the end`);
              assert.ok(c.mainBottom <= c.innerHeight + 1, `${name}: the page ends at the screen's bottom`);
              assert.ok(c.contentEnd <= c.dockTop - 8, `${name}: content ends at ${c.contentEnd.toFixed(1)}, dock top ${c.dockTop.toFixed(1)}`);
            }
          });
        }
        await t.test(`${theme} the key is lime until the session bar's own lime key is on screen, then quiet, the same way down and up (F12 kept, W-075)`, async () => {
          await page.viewport(390, 844, 1);
          await page.goto(view('dashboard'), '.arena-dock nav a');
          await hydrate(page);
          // The look of the dock key and how much of Practice's session-bar key is inside the band a student sees.
          const probe = `(() => {
            const key = document.querySelector('[data-start-key="bar"]'); const s = getComputedStyle(key);
            const bar = document.querySelector('.pr-bar__go'); const r = bar.getBoundingClientRect();
            const top = document.querySelector('.arena-topbar').getBoundingClientRect().height; const dock = document.querySelector('.arena-dock').getBoundingClientRect().top;
            const seen = Math.max(0, Math.min(r.bottom, dock) - Math.max(r.top, top)) / r.height;
            return { look: [s.backgroundColor, s.color, s.boxShadow].join('|'), quiet: key.hasAttribute('data-quiet'), seen, w: key.getBoundingClientRect().width, h: key.getBoundingClientRect().height };
          })()`;
          const down = new Map();
          const ys = [0, 400, 800, 1200, 99999];
          for (const y of ys) {
            await page.eval(`scrollTo({ top: ${y}, behavior: 'instant' })`);
            await new Promise((r) => setTimeout(r, 600));
            down.set(y, await page.eval(probe));
          }
          for (const y of [...ys].reverse()) {
            await page.eval(`scrollTo({ top: ${y}, behavior: 'instant' })`);
            await new Promise((r) => setTimeout(r, 600));
            const again = await page.eval(probe);
            const first = down.get(y);
            // A function of what is on screen, not of the direction or the history: the same look at the same place.
            assert.equal(again.quiet, first.quiet, `at ${y} the key is the same going down and coming back`);
            assert.equal(again.look, first.look, `at ${y} the look is the same going down and coming back`);
          }
          for (const [y, m] of down) {
            assert.ok(near(m.w, 56) && near(m.h, 56), `at ${y} the key keeps its 56 px box`);
            if (m.seen >= 0.5) assert.equal(m.quiet, true, `at ${y} the session bar's key is on screen, so the dock key is quiet`);
            if (m.seen <= 0.05) assert.equal(m.quiet, false, `at ${y} no session key is on screen, so the dock key is lime`);
          }
          const lime = [...down.values()].find((m) => !m.quiet);
          assert.ok(lime, 'the page has a place where the dock key is lime');
          assert.match(lime.look, /rgb\(210, 240, 0\)/, 'the volt key (A1) when the page has no key of its own on screen');
          assert.ok([...down.values()].some((m) => m.quiet), 'and a place where it is quiet');
        });
        await t.test(`${theme} a real pointer on each tab goes to its place, and on the key opens the Start sheet`, async () => {
          await page.viewport(390, 844, 1);
          for (const [label, target] of [['Today', 'today'], ['Practice', 'dashboard'], ['Mob', 'mob']]) {
            await page.goto(view(label === 'Practice' ? 'today' : 'dashboard'), '.arena-dock nav a');
            await hydrate(page);
            const at = await page.eval(`(() => { const a = [...document.querySelectorAll('.arena-dock nav a')].find((n) => n.querySelector('span')?.textContent.trim() === ${JSON.stringify(label)}); const r = a.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: a.contains(document.elementFromPoint(x, y)) }; })()`);
            assert.equal(at.hit, true, `${label} is not covered`);
            await page.click(at.x, at.y);
            const t0 = Date.now();
            while (Date.now() - t0 < 30000 && !(await page.eval(`location.search.includes('view=${target}&') && Boolean(document.querySelector('.arena-dock nav a[aria-current="page"]'))`))) await new Promise((r) => setTimeout(r, 200));
            assert.ok(await page.eval(`location.search.includes('view=${target}&')`), `${label} went to ${target}`);
            await new Promise((r) => setTimeout(r, 600));
            assert.equal(await page.eval(`document.querySelector('.arena-dock nav a[aria-current="page"] span')?.textContent.trim()`), label);
          }
          const key = await page.eval(`(() => { const k = document.querySelector('[data-start-key="bar"]'); const r = k.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: k.contains(document.elementFromPoint(x, y)) }; })()`);
          assert.equal(key.hit, true, 'the key is not covered');
          await page.click(key.x, key.y);
          await page.waitFor('#start-sheet[open]', 10000);
          await page.key('Escape', 'Escape', 27);
        });
        await t.test(`${theme} You rises from the dock and closes on Escape`, async () => {
          await page.viewport(390, 844, 1);
          await page.goto(view('dashboard'), '.arena-dock nav a');
          await hydrate(page);
          const at = await page.eval(`(() => { const b = [...document.querySelectorAll('.arena-dock nav button')].find((n) => n.textContent.trim() === 'You'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: b.contains(document.elementFromPoint(x, y)) }; })()`);
          assert.equal(at.hit, true);
          await page.click(at.x, at.y);
          await page.waitFor('#arena-sheet');
          await new Promise((r) => setTimeout(r, 500));
          const sheet = await page.eval(`(() => { const s = document.getElementById('arena-sheet').getBoundingClientRect(); const d = document.querySelector('.arena-dock').getBoundingClientRect(); const lens = getComputedStyle(document.querySelector('.arena-bottomnav'), '::before').opacity; return { gap: d.top - s.bottom, top: s.top, lens: Number(lens) }; })()`);
          assert.ok(near(sheet.gap, 8, 1), `sheet sits 8 px above the dock (${sheet.gap})`);
          assert.ok(sheet.top >= 0);
          assert.equal(sheet.lens, 1, 'the lens moves to You');
          await page.key('Escape', 'Escape', 27);
          await new Promise((r) => setTimeout(r, 300));
          assert.equal(await page.eval(`Boolean(document.getElementById('arena-sheet'))`), false);
        });
        await t.test(`${theme} desktop: the sidebar keeps its key, no dock, never two volt keys in one viewport`, async () => {
          await page.viewport(1440, 900, 1);
          for (const name of ['today', 'dashboard', 'review', 'result', 'compass']) {
            await page.goto(view(name), '.arena-sidebar [data-start-key="sidebar"]');
            await new Promise((r) => setTimeout(r, 900));
            assert.equal(await page.eval(`getComputedStyle(document.querySelector('.arena-dock')).display`), 'none');
            for (const y of [0, 600]) {
              await page.eval(`scrollTo({ top: ${y}, behavior: 'instant' })`);
              await new Promise((r) => setTimeout(r, 500));
              const fills = await page.eval(COUNT_VOLT_FILLS);
              assert.ok(fills.length <= 1, `${name} at ${y}: ${fills.length} volt keys: ${fills.join(' | ')}`);
            }
          }
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await chrome.close();
  }
});
