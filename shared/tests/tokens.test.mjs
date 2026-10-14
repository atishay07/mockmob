import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { renderTokensCss, readTokens, TOKENS_CSS, kebab, fluidSize, typeRole } from '../build-tokens.mjs';
import {
  resolveTheme, resolveGlass, isProductPath, savedTheme, THEME_BOOT_SCRIPT, THEME_KEY, GLASS_KEY,
  VISITOR_HINT_KEY, PRODUCT_ROUTES,
} from '../theme.mjs';
import { VISITOR_KEY } from '../../data/visitor_state.mjs';

const tokens = readTokens();

// ---------- generated CSS ----------

test('shared/tokens.css matches shared/tokens.json (run node shared/build-tokens.mjs)', () => {
  const onDisk = readFileSync(TOKENS_CSS, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk, renderTokensCss(tokens));
});

test('both palettes define the same roles', () => {
  assert.deepEqual(Object.keys(tokens.color.night), Object.keys(tokens.color.day));
  assert.deepEqual(Object.keys(tokens.shadow.night), Object.keys(tokens.shadow.day));
});

test('every colour is #RRGGBB or #RRGGBBAA', () => {
  for (const group of ['brand', 'night', 'day']) {
    for (const [name, value] of Object.entries(tokens.color[group])) {
      assert.match(value, /^#[0-9A-F]{6}([0-9A-F]{2})?$/, `${group}.${name}`);
    }
  }
});

test('Night Sheet anchors match the app (flutter_app/lib/core/theme/mm_colors.dart)', () => {
  assert.equal(tokens.color.night.ground, '#12110E');
  assert.equal(tokens.color.night.raised, '#1B1A16');
  assert.equal(tokens.color.night.raised2, '#25231E');
  assert.equal(tokens.color.night.line, '#312E27');
  assert.equal(tokens.color.night.ink, '#F4F0E6');
  assert.equal(tokens.color.day.ground, '#F3EFE6');
  assert.equal(tokens.color.brand.volt, '#D2F000');
  assert.equal(tokens.color.brand.voltInk, '#0B1000');
});

test('kebab names', () => {
  assert.equal(kebab('raised2'), 'raised-2');
  assert.equal(kebab('lineStrong'), 'line-strong');
  assert.equal(kebab('ink3'), 'ink-3');
  assert.equal(kebab('figureHero'), 'figure-hero');
});

test('fluid sizes clamp between the phone size and the web maximum', () => {
  assert.equal(fluidSize(16), '16px');
  assert.equal(fluidSize(36, 36), '36px');
  const css = fluidSize(36, 72);
  assert.match(css, /^clamp\(36px, .+px \+ .+vw, 72px\)$/);
  // At 375px wide the middle term is the phone size, at 1280px the maximum.
  const [, intercept, vw] = css.match(/clamp\(36px, (-?[\d.]+)px \+ ([\d.]+)vw/).map(Number);
  assert.ok(Math.abs(intercept + vw * 3.75 - 36) < 0.05);
  assert.ok(Math.abs(intercept + vw * 12.8 - 72) < 0.05);
});

test('type roles carry the app scale, with tight tracking on display only', () => {
  const moment = typeRole(tokens.type.moment);
  assert.equal(moment.line, '1.056');
  assert.equal(moment.tracking, '-0.025em');
  assert.equal(typeRole(tokens.type.body).tracking, '0');
  for (const [name, role] of Object.entries(tokens.type)) {
    if (name.startsWith('$')) continue;
    if (role.font === 'body') assert.ok(role.tracking >= -0.5, `${name}: never tighten small text`);
    assert.ok(role.size >= 12, `${name}: 12px floor`);
  }
  const css = renderTokensCss(tokens);
  assert.match(css, /\.type-figure-hero \{[^}]*font-stretch: 75%;[^}]*tabular-nums/);
  assert.match(css, /\.type-body \{[^}]*font-family: var\(--mm-font-body\)/);
});

test('roles switch with data-theme; Night is the default', () => {
  const css = renderTokensCss(tokens);
  assert.match(css, /:root,\n\[data-theme='dark'\],\n\.mm-night \{\n {2}--mm-ground: var\(--mm-night-ground\);/);
  assert.match(css, /\[data-theme='light'\],\n\.mm-day \{\n {2}--mm-ground: var\(--mm-day-ground\);/);
  assert.match(css, /--mm-font-display: var\(--font-bricolage\), system-ui, sans-serif;/);
});

// ---------- contrast (WCAG 2.2 AA for text roles) ----------

function channel(hex, i) {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const luminance = (hex) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('reading text holds 4.5:1 on ground and raised in both themes', () => {
  for (const theme of ['night', 'day']) {
    const c = tokens.color[theme];
    for (const role of ['ink', 'ink2', 'ink3', 'accentText', 'badText', 'warnText', 'goodText']) {
      for (const surface of ['ground', 'raised']) {
        const ratio = contrast(c[role], c[surface]);
        assert.ok(ratio >= 4.5, `${theme} ${role} on ${surface}: ${ratio.toFixed(2)}`);
      }
    }
    assert.ok(contrast(c.wrongText, c.wrongSurface) >= 4.5, `${theme} wrong text on wrong surface`);
    assert.ok(contrast(c.focusRing, c.ground) >= 3, `${theme} focus ring is visible (3:1)`);
  }
  assert.ok(contrast(tokens.color.brand.voltInk, tokens.color.brand.volt) >= 7, 'volt ink on volt');
});

// ---------- theme and glass resolution ----------

test('a saved choice always wins', () => {
  assert.equal(resolveTheme({ saved: 'light', pathname: '/dashboard', hint: '{"kind":"member"}' }), 'light');
  assert.equal(resolveTheme({ saved: 'dark', pathname: '/' }), 'dark');
});

test('without a choice: Night for the product and for members, Light for strangers', () => {
  assert.equal(resolveTheme({ pathname: '/dashboard' }), 'dark');
  assert.equal(resolveTheme({ pathname: '/today?x=1' }), 'dark');
  assert.equal(resolveTheme({ pathname: '/result/abc' }), 'dark');
  assert.equal(resolveTheme({ pathname: '/onboarding' }), 'dark');
  assert.equal(resolveTheme({ pathname: '/', hint: '{"kind":"member","plan":"free"}' }), 'dark');
  assert.equal(resolveTheme({ pathname: '/cuet-cutoff-calculator', hint: { kind: 'member' } }), 'dark');
  assert.equal(resolveTheme({ pathname: '/' }), 'light');
  assert.equal(resolveTheme({ pathname: '/', hint: '{"kind":"returning"}' }), 'light');
  assert.equal(resolveTheme({ pathname: '/pricing' }), 'light');
  assert.equal(resolveTheme({ pathname: '/', saved: 'purple', hint: 'not json' }), 'light');
  assert.equal(resolveTheme(), 'light');
});

test('product routes are matched on the first segment only', () => {
  assert.equal(isProductPath('/dashboard/anything'), true);
  assert.equal(isProductPath('/dashboards'), false);
  assert.equal(isProductPath('/cuet-mock-test-free'), false);
  assert.equal(savedTheme('dark'), 'dark');
  assert.equal(savedTheme(null), null);
});

test('glass: saved choice, else lite on touch and full on a fine pointer', () => {
  assert.equal(resolveGlass({ saved: 'off', coarsePointer: false }), 'off');
  assert.equal(resolveGlass({ saved: 'full', coarsePointer: true }), 'full');
  assert.equal(resolveGlass({ coarsePointer: true }), 'lite');
  assert.equal(resolveGlass({ coarsePointer: false }), 'full');
  assert.equal(resolveGlass({ saved: 'sparkly' }), 'full');
});

test('the visitor hint key is the one data/visitor_state.mjs writes', () => {
  assert.equal(VISITOR_HINT_KEY, VISITOR_KEY);
});

// ---------- the inline boot script behaves like resolveTheme and never throws ----------

function runBoot({ storage = {}, pathname = '/', coarse = false, storageThrows = false } = {}) {
  const dataset = {};
  const metas = [{ content: '', setAttribute(name, value) { this[name] = value; } }];
  const context = {
    window: {
      get localStorage() {
        if (storageThrows) throw new Error('blocked');
        return { getItem: (k) => (k in storage ? storage[k] : null) };
      },
      matchMedia: (q) => ({ matches: q === '(pointer: coarse)' && coarse }),
    },
    location: { pathname },
    document: {
      documentElement: { dataset },
      readyState: 'complete',
      querySelectorAll: () => metas,
      addEventListener() {},
    },
    MutationObserver: class { observe() {} },
  };
  vm.runInNewContext(THEME_BOOT_SCRIPT, context);
  return { theme: dataset.theme, glass: dataset.glass, meta: metas[0].content };
}

test('boot script: same answers as resolveTheme and resolveGlass', () => {
  const cases = [
    { storage: {}, pathname: '/' },
    { storage: {}, pathname: '/dashboard' },
    { storage: { [THEME_KEY]: 'light' }, pathname: '/today' },
    { storage: { [THEME_KEY]: 'dark' }, pathname: '/' },
    { storage: { [VISITOR_HINT_KEY]: '{"kind":"member","plan":"pro"}' }, pathname: '/pricing' },
    { storage: { [VISITOR_HINT_KEY]: '{broken' }, pathname: '/' },
    { storage: { [GLASS_KEY]: 'off' }, pathname: '/', coarse: true },
    { storage: {}, pathname: '/', coarse: true },
  ];
  for (const c of cases) {
    const out = runBoot(c);
    assert.equal(out.theme, resolveTheme({ saved: c.storage[THEME_KEY], hint: c.storage[VISITOR_HINT_KEY], pathname: c.pathname }), JSON.stringify(c));
    assert.equal(out.glass, resolveGlass({ saved: c.storage[GLASS_KEY], coarsePointer: Boolean(c.coarse) }), JSON.stringify(c));
  }
});

test('boot script: blocked storage falls back to the route rule', () => {
  assert.deepEqual(runBoot({ storageThrows: true, pathname: '/review' }).theme, 'dark');
  assert.deepEqual(runBoot({ storageThrows: true, pathname: '/' }).theme, 'light');
});

test('boot script: browser chrome colour follows the theme', () => {
  assert.equal(runBoot({ pathname: '/dashboard' }).meta, '#12110E');
  assert.equal(runBoot({ pathname: '/' }).meta, '#F3EFE6');
});

test('the product route list matches src/app/(app) plus onboarding', async () => {
  const { readdirSync } = await import('node:fs');
  const dirs = readdirSync(new URL('../../src/app/(app)/', import.meta.url), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name);
  for (const dir of dirs) assert.ok(PRODUCT_ROUTES.includes(dir), `missing product route ${dir}`);
  assert.ok(PRODUCT_ROUTES.includes('onboarding'));
});
