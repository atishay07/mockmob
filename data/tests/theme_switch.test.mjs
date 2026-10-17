// The light/dark switch at the top (owner D10, 18 Oct 2026): release 2 swapped its animation for two cross-fading icons
// on a white disc and the owner called it lower quality. These checks keep the restored pre-release-2 switch: the thumb
// is the sun itself and one inset shadow eclipses it into the crescent while it travels, the cloud sinks away, the
// stars arrive after the thumb lands, and both reduced-motion paths (device and the student's own switch) are instant.
//   node --test data/tests/theme_switch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = read('src/app/marketing-theme.css');
const jsx = read('src/components/ThemeToggle.jsx');
const rule = (selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `missing rule ${selector}`);
  return css.slice(at, css.indexOf('}', at) + 1);
};

test('the thumb is one element, with no icon glyphs to cross-fade', () => {
  assert.match(jsx, /<span className="mm-theme-toggle__thumb" \/>/);
  assert.doesNotMatch(jsx, /mm-theme-toggle__(sun|moon)/);
  assert.doesNotMatch(css, /mm-theme-toggle__(sun|moon)/);
});

test('sun to crescent is one interpolated inset shadow while the thumb travels and turns', () => {
  const day = rule('.mm-theme-toggle__thumb');
  const night = rule("html[data-theme='dark'] .mm-theme-toggle__thumb");
  assert.match(day, /background-color: #ffcb3a/);
  assert.match(day, /box-shadow: inset 0 0 0 0 #edf1df/);
  assert.match(day, /transform \.6s cubic-bezier\(\.34, 1\.4, \.5, 1\)/);
  assert.match(night, /background-color: transparent/);
  assert.match(night, /transform: translateX\(28px\) rotate\(-28deg\)/);
  assert.match(night, /box-shadow: inset -6px -2px 0 0 #edf1df/);
});

test('the day sky has its cloud, which sinks away at night; the stars land after the thumb', () => {
  assert.match(rule('.mm-theme-toggle__sky::after'), /background: #fff/);
  assert.match(rule("html[data-theme='dark'] .mm-theme-toggle__sky::after"), /opacity: 0; transform: translateY\(9px\)/);
  assert.match(rule("html[data-theme='dark'] .mm-theme-toggle__star:nth-child(1)"), /transition-delay: \.22s/);
});

test('no layout property animates (transform, colour and the shadow only) and the switch never changes size', () => {
  const thumb = rule('.mm-theme-toggle__thumb');
  const transitions = thumb.match(/transition: ([^;]+);/)[1].replace(/\([^)]*\)/g, '').split(',').map((part) => part.trim().split(' ')[0]);
  assert.deepEqual(transitions, ['transform', 'background-color', 'box-shadow', 'scale']);
  assert.match(rule('.mm-theme-toggle'), /width: 64px; height: 44px/);
});

test('reduced motion, from the device or from the student\'s own switch, changes it at once', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.mm-theme-toggle \*, \.mm-theme-toggle__sky::before, \.mm-theme-toggle__sky::after \{ transition: none !important; \} \}/);
  assert.match(css, /html\[data-motion='reduced'\] :is\(\.mm-theme-toggle \*, \.mm-theme-toggle__sky::before, \.mm-theme-toggle__sky::after\) \{ transition: none !important; \}/);
  assert.match(jsx, /getMobiPrefs\(\)\.reduced \|\| typeof document\.startViewTransition !== 'function'/);
});
