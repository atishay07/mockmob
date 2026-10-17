// The website's phone dock (NAV-1017 section 8, packet W1; owner feedback F12, F13 and L31).
// Static checks always run. The DOM measurements run in headless Chrome against a running server:
//   DOCK_BASE_URL=http://localhost:3254 node --test data/tests/dock_alignment.test.mjs
// (the /preview/arena fixtures need no account). Without DOCK_BASE_URL they are skipped, and say so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEASURE_DOCK, MEASURE_CLEARANCE, COUNT_VOLT_FILLS } from './dock_measure.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
// arenaNavigation.js imports through the app's '@/' alias, which plain Node does not know: load it with that one
// specifier pointed at the real file.
const navSource = read('src/lib/arenaNavigation.js').replace("'@/../data/capabilities'", `'${new URL('../capabilities.js', import.meta.url).href}'`);
const { MOBILE_STUDY_NAV, STUDY_NAV, arenaNavigation } = await import(`data:text/javascript,${encodeURIComponent(navSource)}`);
const layout = read('src/app/(app)/AppLayoutClient.jsx');
const startCss = read('src/components/start/start.css');
const arenaCss = read('src/app/(app)/arena.css');

test('the dock holds Today, Practice, Review and Colleges; Learn and Explore moved to More, nothing removed', () => {
  assert.deepEqual(MOBILE_STUDY_NAV.map((tab) => tab.label), ['Today', 'Practice', 'Review', 'Colleges']);
  const colleges = MOBILE_STUDY_NAV[3];
  assert.equal(colleges.id, 'admission-compass', 'Colleges is active on /admission-compass');
  assert.equal(colleges.href, '/admission-compass');
  const sheet = arenaNavigation(false).flatMap((group) => group.items.map((item) => item.id));
  for (const id of ['today', 'dashboard', 'learn', 'review', 'explore', 'saved', 'progress', 'admission-compass', 'mentor', 'profile']) {
    assert.ok(sheet.includes(id), `${id} is still listed in the More sheet`);
  }
  assert.ok(STUDY_NAV.some((tab) => tab.id === 'learn'), 'Learn stays in the Study group');
  // The More sheet lists the places that are not in the dock, so its Study group opens on Learn (NAV-1017 10, check 4);
  // the desktop sidebar still draws every group in full.
  // Account and Help and FAQ head the sheet (the name row, and a link beside the sign-out key) instead of sitting at its foot.
  assert.match(layout, /const sheetGroups = navGroups\.map\(\(group\) => \(\{ \.\.\.group, items: group\.items\.filter\(\(tab\) => !dockIds\.has\(tab\.id\) && !sheetHeadIds\.has\(tab\.id\)\) \}\)\)/);
  assert.match(layout, /const sheetHeadIds = new Set\(\['profile', 'help'\]\)/);
  assert.match(layout, /<Link href=\{previewLinks\?\.help \|\| '\/help'\} className="arena-sheet__help"[\s\S]{0,160}?>\s*<AppIcon name="help" \/> Help and FAQ/);
  assert.match(layout, /<AppearanceSwitch \/>\s*\{sheetGroups\.map/);
  const dockIds = new Set(MOBILE_STUDY_NAV.map((tab) => tab.id));
  const sheetStudy = STUDY_NAV.filter((tab) => !dockIds.has(tab.id)).map((tab) => tab.id);
  assert.deepEqual(sheetStudy, ['learn', 'explore', 'saved', 'progress']);
  // And Learn has a second home on the Practice page, while the lessons are on.
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /\{studyEnabled && \([\s\S]{0,200}<h2 id="pr-concepts">Concepts<\/h2>[\s\S]{0,300}href="\/learn"/);
  assert.match(read('src/app/(app)/dashboard/page.js'), /studyEnabled=\{process\.env\.STUDY_CONTENT_ENABLED === 'true'\}/);
});

test('the Start key is a sibling of the nav, so the nav keeps five tabs', () => {
  const dock = layout.slice(layout.indexOf('<div className="arena-dock">'), layout.indexOf('<StartSheetHost'));
  assert.match(dock, /<nav className="arena-bottomnav" aria-label="Quick study navigation">/);
  assert.ok(dock.indexOf('</nav>') < dock.indexOf('<StartKey variant="bar"'), 'the key comes after the nav closes');
  assert.match(layout, /document\.querySelector\('\.arena-dock'\)/, 'the More sheet measures the whole dock');
});

test('the dock key never follows page state (F12, NAV-1017 6.8)', () => {
  const rules = startCss.split('}').filter((rule) => rule.includes('stk--bar'));
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    assert.doesNotMatch(rule, /:has\(|data-shown|data-primary-shown|data-cta-shown|student-page--result|aria-expanded/, `no page-state selector on the dock key: ${rule.trim().slice(0, 120)}`);
  }
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

test('slot widths stay at or above 44 px at every phone width (NAV-1017 6.1 formula)', () => {
  for (const width of [320, 340, 360, 375, 390, 412, 480, 768]) {
    const narrow = width < 360;
    const gutter = narrow ? 8 : 16;
    const gap = narrow ? 6 : 8;
    const pad = narrow ? 3 : 4;
    const row = Math.min(width - 2 * gutter, 440);
    const slot = (row - 64 - gap - 2 * pad) / 5;
    assert.ok(slot >= 44, `${width}: slot ${slot.toFixed(1)}`);
  }
});

const BASE = process.env.DOCK_BASE_URL;
const view = (name, extra = '') => `${BASE}/preview/arena?view=${name}&plan=free&data=ready${extra}`;
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
// The dock is in the server HTML before React hydrates it; a click before then does nothing. Wait for React's props.
const HYDRATED = `(() => { const el = document.querySelector('.arena-dock nav button'); return Boolean(el && Object.keys(el).some((k) => k.startsWith('__reactProps'))); })()`;
const hydrate = async (page) => { const t0 = Date.now(); while (Date.now() - t0 < 30000 && !(await page.eval(HYDRATED))) await new Promise((r) => setTimeout(r, 150)); };

test('DOM measurement in headless Chrome', { skip: BASE ? false : 'set DOCK_BASE_URL to a running server to measure the dock' }, async (t) => {
  const { launch } = await import('./cdp_chrome.mjs');
  const chrome = await launch();
  try {
    const sizes = [[320, 700], [360, 800], [390, 844], [430, 932], [768, 1024]];
    for (const theme of ['dark', 'light']) {
      const page = await chrome.page({ width: 390, height: 844, theme });
      try {
        for (const [width, height] of sizes) {
          await page.viewport(width, height, 1);
          for (const [name, current] of [['dashboard', 'Practice'], ['today', 'Today'], ['review', 'Review'], ['compass', 'Colleges'], ['saved', null]]) {
            await t.test(`${theme} ${width}x${height} ${name}`, async () => {
              await page.goto(view(name), '.arena-dock nav a');
              await new Promise((r) => setTimeout(r, 250));
              const m = await page.eval(MEASURE_DOCK);
              assert.equal(m.shown, true);
              const narrow = width < 360;
              // 1. One icon line, one baseline, for the five places and the key.
              assert.equal(m.iconCentres.length, 6);
              for (const y of m.iconCentres) assert.ok(near(y, m.iconCentres[0]), `icon centres ${m.iconCentres.map((v) => v.toFixed(2))}`);
              for (const y of m.baselines) assert.ok(near(y, m.baselines[0]), `baselines ${m.baselines.map((v) => v.toFixed(2))}`);
              assert.ok(near(m.iconCentres[0] - m.nav.top, 23), `icon centre 23 px into the row (${(m.iconCentres[0] - m.nav.top).toFixed(2)})`);
              // 2. The key is the capsule's height, top and bottom, 64 round, 8 (6) px away.
              assert.ok(near(m.key.slot.top, m.nav.top) && near(m.key.slot.bottom, m.nav.bottom), 'key edges equal capsule edges');
              assert.ok(near(m.key.slot.width, 64) && near(m.key.slot.height, 64) && near(m.nav.height, 64));
              assert.ok(near(m.key.slot.left - m.nav.right, narrow ? 6 : 8), `gap ${(m.key.slot.left - m.nav.right).toFixed(2)}`);
              // 3. Nothing stands above the capsule; the row floats 12 px above the bottom edge.
              assert.ok(m.highest >= m.nav.top - 0.5, `highest ${m.highest} vs capsule top ${m.nav.top}`);
              assert.ok(near(height - m.nav.bottom, 12), `lift ${height - m.nav.bottom}`);
              assert.ok(near(m.key.slot.right, width - (narrow ? 8 : 16)) || width >= 472, 'right gutter');
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
                for (const other of m.slots.filter((s) => s !== active)) {
                  for (const part of [other.icon, other.label]) {
                    assert.ok(part.right <= m.lens.left || part.left >= m.lens.right, `lens clear of ${other.name}`);
                  }
                }
                assert.ok(near((m.lens.left + m.lens.right) / 2, (active.slot.left + active.slot.right) / 2), 'lens centred on its slot');
              } else {
                assert.equal(m.lens.opacity, 0, 'no place current, no lens');
              }
              // 6. A pointer at each place's centre lands on that place.
              assert.deepEqual(m.hits, [true, true, true, true, true, true]);
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
        await t.test(`${theme} the key never changes look with scroll or the session dock`, async () => {
          await page.viewport(390, 844, 1);
          await page.goto(view('dashboard'), '.arena-dock nav a');
          const looks = [];
          for (const y of [0, 400, 1200, 99999]) {
            await page.eval(`scrollTo({ top: ${y}, behavior: 'instant' })`);
            await new Promise((r) => setTimeout(r, 450));
            looks.push(await page.eval(`(() => { const s = getComputedStyle(document.querySelector('[data-start-key="bar"]')); return [s.backgroundColor, s.color, s.boxShadow].join('|'); })()`));
          }
          assert.equal(new Set(looks).size, 1, looks.join('\n'));
          assert.match(looks[0], /rgb\(210, 240, 0\)/, 'the volt key (A1)');
        });
        await t.test(`${theme} a real pointer on each tab goes to its place, and on the key opens the Start sheet`, async () => {
          await page.viewport(390, 844, 1);
          for (const [label, target] of [['Review', 'review'], ['Colleges', 'compass'], ['Today', 'today'], ['Practice', 'dashboard']]) {
            await page.goto(view(label === 'Practice' ? 'today' : 'dashboard'), '.arena-dock nav a');
            await hydrate(page);
            const at = await page.eval(`(() => { const a = [...document.querySelectorAll('.arena-dock nav a')].find((n) => n.textContent.trim() === ${JSON.stringify(label)}); const r = a.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: a.contains(document.elementFromPoint(x, y)) }; })()`);
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
        await t.test(`${theme} More rises from the dock and closes on Escape`, async () => {
          await page.viewport(390, 844, 1);
          await page.goto(view('dashboard'), '.arena-dock nav a');
          await hydrate(page);
          const at = await page.eval(`(() => { const b = [...document.querySelectorAll('.arena-dock nav button')].find((n) => n.textContent.trim() === 'More'); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: b.contains(document.elementFromPoint(x, y)) }; })()`);
          assert.equal(at.hit, true);
          await page.click(at.x, at.y);
          await page.waitFor('#arena-sheet');
          await new Promise((r) => setTimeout(r, 500));
          const sheet = await page.eval(`(() => { const s = document.getElementById('arena-sheet').getBoundingClientRect(); const d = document.querySelector('.arena-dock').getBoundingClientRect(); const lens = getComputedStyle(document.querySelector('.arena-bottomnav'), '::before').opacity; return { gap: d.top - s.bottom, top: s.top, lens: Number(lens) }; })()`);
          assert.ok(near(sheet.gap, 8, 1), `sheet sits 8 px above the dock (${sheet.gap})`);
          assert.ok(sheet.top >= 0);
          assert.equal(sheet.lens, 1, 'the lens moves to More');
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
