// node --test src/components/ai/askMobiLauncher.test.mjs
// Ask Mobi's chat box (20 Nov 2026, owner on a big screen: "this entire chatbot could just be, on the bottom, an opaque or
// glass-morphism kind of small chat box, which can then be expanded into a full page or window"): the page under it is never
// narrowed, what the bar asks about, where it is never drawn, one open path, no badge or pulse, and source pins for the window.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASK_MOBI_CLOSE_EVENT, ASK_MOBI_EVENT, LAUNCHER_MEDIA, WINDOW_MIN_WIDTH, closeAskMobi, drawerForm, launcherBlockedOn, launcherContext,
  openAskMobi,
} from './askMobi.mjs';
import * as askMobi from './askMobi.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the form: a floating window from 768 px, a phone sheet below; nothing ever docks beside the page', () => {
  assert.equal(WINDOW_MIN_WIDTH, 768);
  for (const w of [768, 1100, 1280, 1366, 1440, 1680, 1920, 2560]) assert.equal(drawerForm(w), 'window', `${w}`);
  for (const w of [390, 767]) assert.equal(drawerForm(w), 'sheet', `${w}`);
  for (const name of ['DOCK_MIN_WIDTH', 'PAGE_DOCK_MIN_WIDTH', 'DOCK_WIDTH']) assert.equal(askMobi[name], undefined, `${name} is gone with the dock`);
});

test('the page is never narrowed: no dock attribute, no dock width, no stacked form for a desktop', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.doesNotMatch(shell, /data-mobi-dock|useMobiDocked/);
  assert.match(shell, /\{!isTestRoute && <AskMobiLauncher path=\{activePath\} \/>\}/);
  for (const file of ['src/components/ai/mobi-launch.css', 'src/components/ai/ask-mobi.css']) {
    const rules = code(read(file));
    assert.doesNotMatch(rules, /mobi-dock|margin-right|data-mobi-form='dock'|amb-panel--dock/, `${file}: nothing narrows or restacks the page`);
    assert.doesNotMatch(rules, /!important/, `${file}: no !important`);
  }
  const host = code(read('src/components/ai/AskMobiHost.jsx'));
  // data-mobi-form is written for a phone's sheet only, so no page lays itself out by it on a screen 768 px and wider.
  assert.match(host, /if \(open && form === 'sheet'\) root\.setAttribute\('data-mobi-form', 'sheet'\); else root\.removeAttribute\('data-mobi-form'\);/);
  assert.doesNotMatch(code(read('src/components/ai/askMobiStore.js')), /useMobiDocked|dock/);
});

test('what the bar asks about: Practice is about practice, every other page opens general, as /mentor starts', () => {
  assert.deepEqual(launcherContext('/dashboard'), { kind: 'practice', ref: null, label: null, number: null, chapter: null, lines: [] });
  assert.equal(launcherContext('/dashboard?subject=economics').kind, 'practice');
  for (const path of ['/today', '/progress', '/analytics', '/learn', '/wallet', '/result/abc', '']) assert.equal(launcherContext(path).kind, 'page', path);
});

test('never on the paper, a Mob game, onboarding or Ask Mobi\'s own page', () => {
  for (const path of ['/test', '/test?x=1', '/test/abc', '/mob/game/abc', '/onboarding', '/mentor', '/mentor?tab=ask']) assert.ok(launcherBlockedOn(path), path);
  for (const path of ['/today', '/dashboard', '/mob', '/mentorship', '/testing', '/learn']) assert.ok(!launcherBlockedOn(path), path);
});

test('the bar opens through the one openAskMobi path, marked as the bar, and the host closes through its own event', () => {
  const seen = [];
  const target = new EventTarget();
  target.addEventListener(ASK_MOBI_EVENT, (event) => { seen.push(event.detail); event.preventDefault(); });
  target.addEventListener(ASK_MOBI_CLOSE_EVENT, () => seen.push('close'));
  assert.equal(openAskMobi({ context: launcherContext('/today'), launcher: true }, target), true);
  assert.equal(seen[0].launcher, true);
  assert.equal(seen[0].context.kind, 'page');
  openAskMobi({ context: { kind: 'practice' } }, target);
  assert.equal(seen[1].launcher, false, 'an in-page ask is never the bar');
  closeAskMobi(target);
  assert.equal(seen[2], 'close');
});

test('the bar: one button named Ask Mobi, only on a wide mouse window, glass with solid fallbacks; no badge, no pulse, no :has()', () => {
  const css = read('src/components/ai/mobi-launch.css');
  const rules = code(css);
  assert.ok(css.includes(`@media ${LAUNCHER_MEDIA}`), 'the bar\'s media query is the module\'s');
  assert.doesNotMatch(rules, /:has\(/, 'no :has() on the shell or the body');
  assert.doesNotMatch(rules, /infinite|alternate/, 'nothing loops or pulses');
  assert.match(rules, /width: 300px;\n {4}height: 48px;/);
  assert.match(rules, /right: var\(--mobi-bar-right, 24px\);\n {4}bottom: 20px;/);
  assert.match(rules, /backdrop-filter: blur\(22px\) saturate\(1\.4\)/);
  assert.match(rules, /html\[data-lite\] \.app-shell \.mobi-launch,\nhtml\[data-lite\] \.amb-panel--window \{ -webkit-backdrop-filter: none; backdrop-filter: none; background: var\(--a-raised\); \}/);
  assert.match(rules, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(rules, /\.app-shell\[data-layer-open\] \.mobi-launch \{ display: none; \}/, 'steps away under another dialog, from one shell attribute');
  const bar = read('src/components/ai/AskMobiLauncher.jsx');
  const barCode = code(bar);
  assert.doesNotMatch(barCode, /badge|count=|setTimeout|setInterval/i, 'no badge, never opens by itself');
  assert.equal(barCode.match(/openAskMobi\(/g).length, 1, 'opened only by its press');
  assert.match(bar, /aria-label="Ask Mobi"/);
  assert.match(bar, />Ask Mobi anything</);
  assert.match(barCode, /new MutationObserver/);
  assert.match(barCode, /toggleAttribute\('data-layer-open', on\)/);
  assert.doesNotMatch(barCode, /addEventListener\('scroll'/, 'no read per scroll');
});

test('the window: floats over the page with no scrim, larger is centred and modal, the conversation survives a size change', () => {
  const drawer = read('src/components/ai/AssistantDrawer.jsx');
  assert.match(drawer, /return drawerForm\(width\);/);
  assert.match(drawer, /const modal = form === 'sheet' \|\| large;/);
  assert.match(drawer, /aria-modal=\{modal \? 'true' : undefined\}/);
  assert.match(drawer, /onSize=\{form === 'window' \? setSize : null\}/);
  // The panel is keyed by the host's request, never by the size, so making it larger keeps the thread.
  assert.doesNotMatch(drawer, /key=\{size|key=\{`\$\{size/);
  assert.doesNotMatch(code(drawer), /getBoundingClientRect|addEventListener\('scroll'/, 'no layout read while open');
  const css = code(read('src/components/ai/mobi-launch.css'));
  assert.match(css, /width: min\(400px, calc\(100vw - 32px\)\);\n {2}height: min\(640px, calc\(100vh - 120px\)\);/);
  assert.match(css, /width: min\(960px, 92vw\);\n {2}height: min\(86vh, 900px\);/);
  assert.match(css, /background: color-mix\(in srgb, var\(--a-raised\) 94%, transparent\);/);
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  assert.match(panel, /aria-label=\{large \? 'Make smaller' : 'Make larger'\}/);
  assert.match(panel, /Open Ask Mobi&rsquo;s page/);
  assert.match(panel, /Ask Mobi’s page starts a new chat\./,'the link says truthfully that the page starts a new chat');
  assert.match(panel, /window\.sessionStorage\.setItem\(DRAFT_KEY, input\)/, 'a typed draft goes with the student');
  assert.match(read('src/components/ai/MentorRecordPage.jsx'), /window\.sessionStorage\.removeItem\(DRAFT_KEY\)/);
});
