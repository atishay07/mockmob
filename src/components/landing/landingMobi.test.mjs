// node --test src/components/landing/landingMobi.test.mjs
// The landing's Mobi after the hero pass (D38, 18 Oct 2026): the hero's fly-in, idle, glance and reactions, his
// line never under his feet in the lane, and one Mobi in view (W-074). Source-level, so no server is needed; the
// headless walk (tmp/hero-1018) checks the same things on the running page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const GUIDE = read('../brand/PipGuide.jsx');
const ACTOR = read('../brand/PipActor.jsx');
const CSS = read('../../app/brand-pip.css');
const DRILL = read('DemoDrill.jsx');
const MORPH = read('HeroMorph.jsx');
const TYPE_LINE = read('HeroType.jsx');

test('the hero Mobi flies in on a short arc and settles, then floats and blinks, only at the hero', () => {
  assert.match(CSS, /@keyframes pip-fly-x \{[\s\S]*?scale\(1\.04\)[\s\S]*?100% \{ opacity: 1; transform: none; \}/);
  assert.match(CSS, /@keyframes pip-fly-y \{[\s\S]*?translate3d\(0, -12%, 0\)/, 'a low arc that stays under the site bar');
  assert.match(CSS, /\.pip-seat\[data-pip-station='hero'\]\[data-pip-enter\] \.pip-rig \{\n\s+animation: pip-fly-x 720ms 280ms both, pip-wave/);
  assert.match(CSS, /\.pip-actor\[data-motion\^='fly'\] \{ animation: pip-fly-x 720ms both; \}/);
  assert.match(GUIDE, /arriving\?\(s\.id==='hero'\?'fly-0':'arrive-0'\)/, 'the desktop guide flies in only at the hero');
  assert.match(CSS, /@keyframes pip-float \{ 0%, 100% \{ transform: translate3d\(0, 0, 0\); \} 50% \{ transform: translate3d\(0, -4px, 0\); \} \}/);
  assert.match(CSS, /pip-float 3\.2s/);
  assert.match(CSS, /:is\(\.pip-seat\[data-pip-station='hero'\], \.pip-actor\[data-station='hero'\]\) \.pip-eye__ball \{\n\s+animation: pip-eye-blink-hero 10s/);
  assert.match(ACTOR, /alive \? <span className="pip-actor__float">\{art\}<\/span> : art/);
});

test('each headline change makes him glance at it; a wrong sample answer tilts his head, a right one hops', () => {
  assert.match(MORPH, /new CustomEvent\('pip:glance'/);
  assert.match(TYPE_LINE, /new CustomEvent\('pip:glance'/, 'option C (behind its flag) asks for the same glance');
  assert.match(GUIDE, /window\.addEventListener\('pip:glance', glance\)/);
  assert.match(GUIDE, /window\.addEventListener\('pip:react',react\);window\.addEventListener\('pip:glance',glance\)/);
  assert.match(GUIDE, /rotate: `\$\{x < 0 \? -3 : 3\}deg`/, 'a dip of about 3 degrees toward the line');
  assert.match(GUIDE, /encourage: \{ pose: 'encouraging', motion: 'tilt'/);
  assert.match(GUIDE, /correct: \{ pose: 'celebrating', motion: 'hop'/);
  assert.match(CSS, /\.pip-actor\[data-motion\^='tilt'\] \{ animation: pip-tilt 900ms/);
  assert.match(DRILL, /data-verdict=\{picked === question\.correct \? 'right' : 'wrong'\}/);
  assert.match(DRILL, /<Mascot pose=\{picked === question\.correct \? 'celebrating' : 'encouraging'\} \/>/);
});

test('his eyes follow a mouse by under 3 px, and Reduce motion keeps him still', () => {
  assert.match(CSS, /translate: calc\(var\(--pip-look-x, 0\) \* var\(--pip-dir, 1\) \* 24%\) calc\(var\(--pip-look-y, 0\) \* 14%\);/);
  assert.match(GUIDE, /if \(event\.pointerType === 'touch' \|\| raf\) return;/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\n\s+\.pip-actor__float, \.mm-drill \.pip-drill-reaction > \.pip-image \{ animation: none !important; \}/);
  assert.match(GUIDE, /if \(media\.matches \|\| root0\.dataset\.motion === 'reduced'\) \{\n\s+const one = oneMobi\(/);
});

test('in the desktop lane his line never sits under his feet (the close band at 1440)', () => {
  assert.match(GUIDE, /const layoutTop=\(el\)=>\{let y=0;for\(let n=el;n;n=n\.offsetParent\)y\+=n\.offsetTop;return y;\};/);
  assert.match(GUIDE, /y:layoutTop\(s\.art\)/, 'the seat is read from layout, not from a box a Reveal still holds low');
  assert.match(GUIDE, /const off=wide && current\.y-y>8;/);
  assert.match(CSS, /\[data-pip-guide='on'\] \.pip-seat\[data-pip-away='true'\] figcaption \{ opacity: 0; \}/);
});

test('one Mobi in view (W-074)', () => {
  // Where another figure stands in for a seat, the seat's own is hidden outright, image included.
  assert.match(CSS, /\[data-pip-guide='on'\] \.pip-seat\[data-pip-station\] \.pip-seat__art > \.pip-rig \.pip-image,\n\.pip-seat\[data-pip-reacting='true'\] \.pip-seat__art > :is\(\.pip-image, \.pip-rig\),\n\.pip-seat\[data-pip-reacting='true'\] \.pip-seat__art > \.pip-rig \.pip-image \{ opacity: 0; visibility: hidden; \}/);
  // Phones and Reduce motion: the figure most on screen stays, any other yields.
  assert.match(GUIDE, /function oneMobi\(seats, \{ entered \}\)/);
  assert.match(GUIDE, /const one = oneMobi\(seats, \{ entered: true \}\);/);
  assert.match(GUIDE, /oneMobi\(\[\.\.\.document\.querySelectorAll\('\.pip-seat\[data-pip-station\]'\)\], \{ entered: false \}\)/);
  assert.match(GUIDE, /'\.pip-drill-reaction, \.pip-drill-result'/, 'the sample\'s own Mobi counts too');
  assert.match(GUIDE, /shown\[0\]\.area > held\.area \* 1\.15/, 'a challenger must be clearly bigger, so a slow scroll never flickers');
  assert.match(CSS, /\[data-pip-one\] \.pip-seat\[data-pip-yield\] \.pip-seat__art,/);
});
