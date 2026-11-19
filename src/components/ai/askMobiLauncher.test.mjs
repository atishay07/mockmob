// node --test src/components/ai/askMobiLauncher.test.mjs
// Ask Mobi's desktop launcher and the wide dock (19 Nov 2026, owner: "On desktop ... the Ask Mobi, we can set as a quick-to-access
// chatbot on the right-hand side of the screen"): where the panel docks, what the launcher asks about, where it is never drawn,
// and source pins for the shell's one attribute and one variable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASK_MOBI_CLOSE_EVENT, ASK_MOBI_EVENT, DOCK_MIN_WIDTH, DOCK_WIDTH, LAUNCHER_MEDIA, PAGE_DOCK_MIN_WIDTH, closeAskMobi, drawerForm,
  launcherBlockedOn, launcherContext, openAskMobi,
} from './askMobi.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the form: everything docks from 1680 px; below it the launcher overlays and an in-page ask keeps its own rule', () => {
  assert.equal(DOCK_MIN_WIDTH, 1680);
  assert.equal(PAGE_DOCK_MIN_WIDTH, 1280);
  for (const w of [1680, 1920, 2048, 2560]) {
    assert.equal(drawerForm(w, { launcher: true }), 'dock', `launcher ${w}`);
    assert.equal(drawerForm(w), 'dock', `page ${w}`);
  }
  for (const w of [1100, 1366, 1440, 1679]) assert.equal(drawerForm(w, { launcher: true }), 'overlay', `launcher ${w}`);
  // An ask from inside a page (a repair, a result, Today, Practice) keeps what it did before 19 Nov below 1680 px.
  assert.equal(drawerForm(1440), 'dock');
  assert.equal(drawerForm(1280), 'dock');
  assert.equal(drawerForm(1279), 'overlay');
  assert.equal(drawerForm(768), 'overlay');
  assert.equal(drawerForm(767), 'sheet');
  assert.equal(drawerForm(390, { launcher: true }), 'sheet');
});

test('what the launcher asks about: Practice is about practice, every other page opens general, as /mentor starts', () => {
  assert.deepEqual(launcherContext('/dashboard'), { kind: 'practice', ref: null, label: null, number: null, chapter: null, lines: [] });
  assert.equal(launcherContext('/dashboard?subject=economics').kind, 'practice');
  for (const path of ['/today', '/progress', '/analytics', '/learn', '/wallet', '/result/abc', '']) assert.equal(launcherContext(path).kind, 'page', path);
});

test('never on the paper, a Mob game, onboarding or Ask Mobi\'s own page', () => {
  for (const path of ['/test', '/test?x=1', '/test/abc', '/mob/game/abc', '/onboarding', '/mentor', '/mentor?tab=ask']) assert.ok(launcherBlockedOn(path), path);
  for (const path of ['/today', '/dashboard', '/mob', '/mentorship', '/testing', '/learn']) assert.ok(!launcherBlockedOn(path), path);
});

test('the launcher opens through the one openAskMobi path, marked as the launcher, and closes through its own event', () => {
  const seen = [];
  const target = new EventTarget();
  target.addEventListener(ASK_MOBI_EVENT, (event) => { seen.push(event.detail); event.preventDefault(); });
  target.addEventListener(ASK_MOBI_CLOSE_EVENT, () => seen.push('close'));
  assert.equal(openAskMobi({ context: launcherContext('/today'), launcher: true }, target), true);
  assert.equal(seen[0].launcher, true);
  assert.equal(seen[0].context.kind, 'page');
  openAskMobi({ context: { kind: 'practice' } }, target);
  assert.equal(seen[1].launcher, false, 'an in-page ask is never the launcher');
  closeAskMobi(target);
  assert.equal(seen[2], 'close');
});

test('source pins: one attribute and one variable on the shell; the launcher only on a wide mouse window; no badge, no pulse', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /data-mobi-dock=\{mobiDocked && !isTestRoute \? 'open' : undefined\}/);
  assert.match(shell, /\{!isTestRoute && <AskMobiLauncher path=\{activePath\} \/>\}/);
  const css = read('src/components/ai/mobi-launch.css');
  const rules = code(css);
  assert.match(rules, /\.app-shell \{ --mobi-dock-w: 400px; \}/);
  assert.equal(DOCK_WIDTH, 400);
  assert.match(rules, /\.app-shell\[data-mobi-dock='open'\] \.app-main \{ margin-right: var\(--mobi-dock-w\); \}/);
  assert.doesNotMatch(rules, /100vw/);
  assert.ok(css.includes(`@media ${LAUNCHER_MEDIA}`), 'the launcher\'s media query is the module\'s');
  assert.doesNotMatch(rules, /@keyframes|animation|infinite/, 'nothing loops or pulses');
  const launcher = code(read('src/components/ai/AskMobiLauncher.jsx'));
  assert.doesNotMatch(launcher, /badge|count|setTimeout|setInterval/i, 'no badge, never opens by itself');
  assert.equal(launcher.match(/openAskMobi\(/g).length, 1, 'opened only by its press');
  assert.match(read('src/components/ai/AskMobiLauncher.jsx'), /aria-label="Ask Mobi"/);
  // The old 420 px padding is gone: one rule for every way the panel docks.
  assert.doesNotMatch(code(read('src/components/ai/ask-mobi.css')), /padding-right: 420px/);
  assert.match(read('src/components/ai/AssistantDrawer.jsx'), /return drawerForm\(width, \{ launcher \}\);/);
});
