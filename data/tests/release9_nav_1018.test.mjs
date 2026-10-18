// Release 9, packet "nav" (the 18 Oct audit of release 8, docs/brain/OWNER-MASTER-LEDGER.md): navigation, Practice, the runner,
// Colleges, Progress and the global chrome. Source-level checks that run in plain Node. The browser walk of the same fixes (390 and
// 1440, Night and Day, real pointer) is in tmp/r9-fixes/nav; set MM_PREVIEW_BASE=http://localhost:<port> to run the one-lime
// scan below against a preview server (it needs playwright-core and a headless Chrome, so it is skipped otherwise).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { HELP_DOOR, HELP_DOOR_ROWS, GUIDE_PAGE_TITLE, TOUR_LABEL } from '../../src/lib/helpDoor.mjs';
import { SUBJECT_RULE_NOTE, CUET_RULE_CYCLE } from '../../src/lib/cuetRules.mjs';
import { SHOW_AT, HIDE_AT } from '../../src/components/start/pagePrimary.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const layout = read('src/app/(app)/AppLayoutClient.jsx');
const arenaCss = stripComments(read('src/app/(app)/arena.css'));

// ---------------------------------------------------------------------------------------------------------------------
// D11 + N17: Help is Guide, and "Show me around" is a visible first row.
// ---------------------------------------------------------------------------------------------------------------------

test('D11: the nav row, the phone More sheet and the page all say Guide; the page is "Guide and questions"; the route stays /help', () => {
  assert.equal(HELP_DOOR.label, 'Guide');
  assert.equal(GUIDE_PAGE_TITLE, 'Guide and questions');
  const nav = read('src/lib/arenaNavigation.js');
  assert.match(nav, /item\('help', 'Guide', 'help'\)/, 'the sidebar row (its href is still /help)');
  assert.ok(nav.includes(`'${HELP_DOOR.label}'`), 'arenaNavigation.js (which imports nothing local) holds the same word as HELP_DOOR.label');
  assert.match(layout, /<AppIcon name="help" \/> \{HELP_DOOR\.label\}/, 'the More sheet row');
  assert.match(read('src/app/(app)/help/HelpPageClient.jsx'), /<ArenaHead title=\{GUIDE_PAGE_TITLE\}/);
  assert.match(read('src/app/(app)/help/page.js'), /title: 'Guide and questions \| MockMob'/);
  assert.ok(read('src/app/(app)/help/page.js').length > 0 && !/Help and FAQ/.test(read('src/app/(app)/help/page.js')));
  // The tour's last stop names the same place.
  const tour = read('src/lib/appTour.mjs');
  assert.match(tour, /title: 'Guide', target: \['nav-help', 'nav-more'\]/);
  assert.doesNotMatch(tour, /Help and FAQ has|Help and FAQ is under/);
});

test('D11: "Help" and "Help and FAQ" are no longer a nav label or page title in the signed-in shell', () => {
  for (const file of ['src/lib/arenaNavigation.js', 'src/lib/helpDoor.mjs', 'src/app/(app)/help/HelpPageClient.jsx']) {
    assert.doesNotMatch(read(file).replace(/\/\/.*$/gm, ''), /['"`>]Help( and FAQ)?['"`<]/, `${file} labels something Help`);
  }
  // Ten words or fewer, sentence case, no hype.
  for (const line of [HELP_DOOR.label, TOUR_LABEL, GUIDE_PAGE_TITLE]) assert.doesNotMatch(line, /[!→↗]|\b[A-Z]{3,}\b/);
});

test('N17: "Show me around" opens the tour from a visible first row in the More sheet and under the sidebar Account group', () => {
  assert.equal(TOUR_LABEL, 'Show me around');
  assert.equal(HELP_DOOR_ROWS[0].label, TOUR_LABEL, 'the Guide page keeps the same first row');
  assert.match(layout, /function startTour\(\) \{[\s\S]{0,120}setMobileMenuOpen\(false\);[\s\S]{0,80}setTourStep\(0\);[\s\S]{0,60}setTourOpen\(true\);/);
  // The More sheet: the tour row comes before the Guide row, both inside the account card at the head of the sheet.
  const sheet = layout.slice(layout.indexOf('id="arena-sheet"'));
  const tourAt = sheet.indexOf('onClick={startTour}');
  const guideAt = sheet.indexOf('{HELP_DOOR.label}');
  assert.ok(tourAt > 0 && guideAt > tourAt, 'Show me around is the first row of the sheet card, then Guide');
  assert.ok(tourAt < sheet.indexOf('<AppearanceSwitch />'), 'both rows sit above the theme control');
  // The sidebar: a row under the Account group.
  assert.match(layout, /group\.label === 'Account' && !isTestRoute \? \([\s\S]{0,200}onClick=\{startTour\}[\s\S]{0,200}\{TOUR_LABEL\}/);
  assert.match(arenaCss, /button\.arena-nav-link\s*\{[^}]*width:\s*100%/, 'the sidebar button looks like its neighbours');
});

// ---------------------------------------------------------------------------------------------------------------------
// Marks trend: the nav label matches the page (which says where the marks are going, and that weak chapters are in Review).
// ---------------------------------------------------------------------------------------------------------------------

test('the /analytics nav item is "Marks trend" in the sidebar and the More sheet, and fits one line', () => {
  const nav = read('src/lib/arenaNavigation.js');
  assert.match(nav, /item\('analytics', 'Marks trend', 'radar', '\/analytics'\)/);
  assert.doesNotMatch(nav, /Weak chapters/);
  assert.ok('Marks trend'.length <= 12, 'about 85 px at 15 px: one line in the sheet\'s half-width column at 390');
  // Everything that names the nav item agrees (the assistant's feature guide and the Colleges page's link).
  assert.match(read('src/components/ai/assistantKnowledge.js'), /name: 'Marks trend',\s*route: '\/analytics'/);
  assert.doesNotMatch(read('src/app/(app)/admission-compass/AdmissionCompassPageClient.jsx'), /Weak chapters/);
  assert.doesNotMatch(layout, /Weak chapters/);
  // The sheet's rows do not wrap: a nav row in the sheet is one line (ellipsis, never two lines).
  assert.match(arenaCss, /\.arena-sheet \.arena-nav-link\s*\{[^}]*min-height:\s*48px/);
});

// ---------------------------------------------------------------------------------------------------------------------
// D6: on a phone Ask Mobi is above the theme control.
// ---------------------------------------------------------------------------------------------------------------------

test('D6: in the phone More sheet the Ask Mobi row sits above the theme control, and Planning does not list it again', () => {
  const sheet = layout.slice(layout.indexOf('id="arena-sheet"'));
  const ask = sheet.indexOf('arena-sheet__lead--ask');
  const theme = sheet.indexOf('<AppearanceSwitch />');
  const groups = sheet.indexOf('{sheetGroups.map');
  assert.ok(ask > 0 && theme > ask, 'Ask Mobi is before the theme switch');
  assert.ok(groups > theme, 'the groups (Study, Planning) follow the theme switch');
  assert.match(layout, /const sheetHeadIds = new Set\(\['profile', 'help', 'learn', 'mentor'\]\)/, 'the sheet groups skip Ask Mobi');
  assert.match(sheet, /data-tour="nav-mentor"/, 'the tour and the in-place Ask Mobi still find the row');
  assert.match(sheet, /href=\{previewLinks\?\.mentor \|\| '\/mentor'\}/, 'it is still the ordinary /mentor link, intercepted into the panel by AskMobiHost');
  // The sidebar is unchanged: Ask Mobi stays in Planning (nothing is removed).
  assert.match(read('src/lib/arenaNavigation.js'), /item\('mentor', 'Ask Mobi', 'prepos'\)/);
});

// ---------------------------------------------------------------------------------------------------------------------
// W-075: one lime key on Colleges. W-075 (Practice): the bar and the dock key never share the screen.
// ---------------------------------------------------------------------------------------------------------------------

test('W-075: signed in, Go to Practice on Colleges is outlined, so the sidebar and dock Start keys are the only lime', () => {
  const calc = read('src/components/du/CutoffCalculator.jsx');
  assert.match(calc, /className=\{isAuthenticated \? 'mm-btn mm-btn--secondary' : 'mm-btn mm-btn--primary'\}/);
  assert.match(calc, /href=\{isAuthenticated \? '\/review' : '\/features'\} className=\{isAuthenticated \? 'mm-btn mm-btn--quiet' : 'mm-btn mm-btn--secondary'\}/);
  // Signed out, the sticky "View courses" steps back while the page's closing lime key is on screen.
  assert.match(calc, /data-primary=\{ctaInView \? undefined : ''\} data-phone-primary=\{ctaInView \? undefined : ''\}/);
  assert.match(calc, /<section className="du-cta" aria-labelledby="du-cta-title" ref=\{ctaRef\}>/);
});

test('W-075: the dock key goes quiet as soon as any of the page key is above the dock, with no settle time on the way in', () => {
  assert.ok(SHOW_AT <= 0.1, 'a sliver counts');
  assert.ok(HIDE_AT < SHOW_AT);
  const src = read('src/components/start/pagePrimary.mjs');
  assert.match(src, /if \(first \|\| wanted\) \{[\s\S]*?apply\(\); return; \}/, 'quiet is applied at once; only the return to lime is settled');
});

// ---------------------------------------------------------------------------------------------------------------------
// W-079: nothing under 44 px that the audit found.
// ---------------------------------------------------------------------------------------------------------------------

test('W-079: Edit fine-tune, Whole unit, the runner legend, the Start sheet arrows and the other small runner keys are 44 px', () => {
  assert.match(stripComments(read('src/app/(app)/dashboard/practice.css')), /\.pr-ticket__edit\s*\{[^}]*min-height:\s*44px[^}]*min-width:\s*44px/);
  assert.match(stripComments(read('src/app/(app)/dashboard/chapter-picker.css')), /\.cp-link\s*\{[^}]*min-height:\s*44px[^}]*min-width:\s*44px/);
  const run = stripComments(read('src/app/(app)/test/practice-run.css'));
  assert.match(run, /\.pr-legend button\s*\{[^}]*min-height:\s*44px/);
  assert.match(run, /\.pr-goto\s*\{[^}]*min-height:\s*44px/);
  assert.match(run, /\.pr-undo button\s*\{[^}]*min-height:\s*44px/);
  const start = stripComments(read('src/components/start/start.css'));
  assert.match(start, /\.st-rail__arrow\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/);
  assert.match(start, /\.st-rail__disc\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/, 'the drawn disc is the 44 px target too');
});

// ---------------------------------------------------------------------------------------------------------------------
// The runner notice, N6, D8, the plan card, Progress.
// ---------------------------------------------------------------------------------------------------------------------

test('the runner notice says what the student can do, with no build jargon ("Bank in review" is gone)', () => {
  const runner = read('src/app/(app)/test/TestPageClient.jsx');
  assert.doesNotMatch(runner, /Bank in review/);
  assert.match(runner, /'Saved on this device\. Stay online to submit\.'/);
});

test('N6: the subject cap note names its cycle in one line', () => {
  assert.equal(CUET_RULE_CYCLE, 2026);
  assert.equal(SUBJECT_RULE_NOTE, 'That is the CUET UG 2026 limit: five papers in all (a language or the General Test counts as one).');
  assert.doesNotMatch(SUBJECT_RULE_NOTE, /\n/);
  assert.doesNotMatch(SUBJECT_RULE_NOTE, /!/);
});

test('D8: Ask Mobi and the AI-credit chip use a sparkle, not the orbit that read as a "not allowed" sign', () => {
  const glyph = read('src/components/ui/Glyph.jsx');
  assert.doesNotMatch(glyph.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /\bOrbit\b/, 'no orbit icon');
  assert.match(glyph, /prepos: Sparkles,/);
  const mark = glyph.slice(glyph.indexOf('export function CreditMark'), glyph.indexOf('export function CreditAmount'));
  assert.doesNotMatch(mark, /<ellipse/, 'no orbit ring on the AI coin');
  assert.match(mark, /credit-mark__spark/);
  assert.match(mark, /<circle cx="12" cy="12" r="9\.25" \/>/, 'the coin stays the same size and family');
});

test('the plan card names the plan in quiet meta text, not a pr-badge pill (BADGES-REFINE section 4)', () => {
  const plan = read('src/components/billing/PlanCard.jsx');
  assert.doesNotMatch(plan, /pr-badge/);
  assert.match(plan, /<span className="plan-card__meta">\{pro \? 'Pro' : 'Free'\}<\/span>/);
  assert.match(arenaCss, /\.plan-card__meta\s*\{[^}]*color:\s*var\(--a-ink-2\)/);
  // The credit amounts and copy are another packet's (perq owns the wording): the plan card says the one price sentence.
  assert.match(plan, /Free uses practice credits\. \$\{PRACTICE_PRICE_LINE\}/);
});

test('Progress at 1440: the path lists under the shelf drop the earned rows (nothing shown twice) and keep next, locked and the counts', () => {
  const badges = read('src/components/StudyBadges.jsx');
  assert.match(badges, /<Paths paths=\{paths\} records=\{records\} progress=\{progress\} zone=\{zone\} armed=\{armed\} onOpen=\{openDetail\} hideEarned \/>/, 'the inline copy hides earned rows');
  assert.match(badges, /const steps = hideEarned \? path\.steps\.filter\(\(s\) => s\.status !== 'earned'\) : path\.steps;/);
  assert.match(badges, /<span>\{path\.earned\} of \{path\.total\}<\/span>/, 'the header keeps the count with its denominator');
  // The All badges sheet is the full view and still lists everything.
  assert.match(badges, /<Paths paths=\{paths\} records=\{records\} progress=\{progress\} zone=\{zone\} armed onOpen=\{onOpen\} \/>/);
});

test('D7: in Night an earned medal is a charcoal disc with a thin lime ring and a lime glyph; Day keeps the solid medal; no glow', () => {
  const css = stripComments(read('src/components/study-badges.css'));
  assert.match(css, /\.sb-medal\[data-status='earned'\]\s*\{\s*background:\s*var\(--volt\)/, 'the base (Day) medal is unchanged');
  const night = css.match(/html:not\(\[data-theme='light'\]\) \.sb-medal\[data-status='earned'\]\s*\{([^}]*)\}/);
  assert.ok(night, 'a Night-only rule');
  assert.match(night[1], /background:\s*var\(--a-volt-wash/);
  assert.match(night[1], /border-color:\s*var\(--a-volt-line/);
  assert.match(night[1], /color:\s*var\(--a-accent-text/);
  assert.doesNotMatch(night[1], /shadow|filter|gradient/);
  assert.doesNotMatch(css, /\.sb-medal[^{]*\{[^}]*box-shadow/, 'no glow on any medal');
});

// ---------------------------------------------------------------------------------------------------------------------
// Browser: one lime key in view (needs a preview server; MM_PREVIEW_BASE=http://localhost:3243).
// ---------------------------------------------------------------------------------------------------------------------

const base = process.env.MM_PREVIEW_BASE;
test('browser: Colleges and Practice hold at most one lime key in view at every scroll step (390 and 1440, Night and Day)', { skip: base ? false : 'set MM_PREVIEW_BASE to run against a preview server', timeout: 600000 }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  const { voltKeysInView } = await import('./helpers/voltScan.mjs');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const view of ['compass', 'dashboard']) {
      for (const [width, height] of [[390, 844], [1440, 900]]) {
        for (const theme of ['dark', 'light']) {
          const ctx = await browser.newContext({ viewport: { width, height } });
          await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
          await ctx.route('**/api/**', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()));
          const page = await ctx.newPage();
          await page.goto(`${base}/preview/arena?view=${view}&plan=free&data=ready`, { waitUntil: 'networkidle', timeout: 90000 });
          await page.waitForTimeout(1000);
          const total = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y <= total; y += 150) {
            await page.evaluate((yy) => window.scrollTo(0, yy), y);
            await page.waitForTimeout(350);
            const keys = await page.evaluate(voltKeysInView);
            assert.ok(keys.length <= 1, `${view} ${width} ${theme} at y=${y}: ${keys.length} lime keys in view: ${JSON.stringify(keys)}`);
          }
          await ctx.close();
        }
      }
    }
  } finally { await browser.close(); }
});
