// Guards for fast scrolling on the landing: the motion that runs while the page scrolls (Reveal entrances and
// the held stories' CSS) animates only transform and opacity, so a fling never repaints or relayouts a section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '..', '..', 'app');
const css = fs.readdirSync(app).filter((name) => name.endsWith('.css')).map((name) => ({ name, text: fs.readFileSync(path.join(app, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

// Every `selector { declarations }` block whose selector matches, from every app stylesheet.
function blocks(match) {
  const found = [];
  for (const { name, text } of css) {
    for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (match(selector)) found.push({ name, selector: selector.trim(), body });
    }
  }
  return found;
}

const PAINT_OR_LAYOUT = /\b(filter|height|width|top|left|right|bottom|margin[a-z-]*|padding[a-z-]*|box-shadow|all)\b/;

test('reveal entrances animate transform and opacity only', () => {
  const reveal = blocks((selector) => /\.rv\b/.test(selector));
  assert.ok(reveal.length > 0, 'no .rv rules found');
  for (const { name, selector, body } of reveal) {
    const filter = body.match(/(?:^|;)\s*filter\s*:\s*([^;]+)/);
    assert.ok(!filter || filter[1].trim() === 'none', `${name}: ${selector} sets filter ${filter?.[1]}`);
    for (const [, value] of body.matchAll(/(?:^|;)\s*transition(?:-property)?\s*:\s*([^;]+)/g)) {
      assert.ok(!PAINT_OR_LAYOUT.test(value.replace(/var\([^)]*\)|calc\([^)]*\)/g, '')), `${name}: ${selector} transitions ${value.trim()}`);
    }
  }
});

test('a reveal reached at speed has a short, unstaggered entrance', () => {
  const snap = blocks((selector) => /\.rv\[data-snap="true"\]/.test(selector));
  assert.ok(snap.some(({ body }) => /transition-delay\s*:\s*0s/.test(body) && /transition-duration\s*:\s*0?\.\d+s/.test(body)));
});

test('held stories never animate layout', () => {
  const story = css.find(({ name }) => name === 'scroll-story.css');
  for (const [, value] of story.text.matchAll(/transition\s*:\s*([^;]+)/g)) {
    assert.ok(!PAINT_OR_LAYOUT.test(value.replace(/var\([^)]*\)|calc\([^)]*\)/g, '')), `scroll-story.css transitions ${value.trim()}`);
  }
});
