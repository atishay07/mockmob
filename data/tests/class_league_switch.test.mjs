// Class leagues' switch on the page (review, 16 Nov 2026): with CLASS_LEAGUES_ENABLED off, the app layout hands down `false`
// (src/components/class/ClassSwitch.jsx), and every class surface mounted on an existing page (the Sunday Mock page's block,
// Today's card, a Sunday result's line, the Mob page's entry) renders nothing and never reaches a read: no hook that fetches
// is called at all. Rendered with the real components (JSX compiled by the Next.js SWC binding, as data/tests/repair_wiring
// does); the module that fetches is replaced by one that records every call, and global fetch records too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT_URL = pathToFileURL(`${root}/`).href;
const reactUrl = pathToFileURL(createRequire(resolve(root, 'package.json')).resolve('react')).href;
const RECORDER = `
const calls = { push: (name) => (globalThis.__classCalls ||= []).push(name) };
const note = (name) => () => { calls.push(name); return undefined; };
export function useClassLeague() { calls.push('useClassLeague'); return { status: 'loading', data: null, reload() {}, accept() {} }; }
export function useClassWeek() { calls.push('useClassWeek'); return null; }
export function useClassLookup() { calls.push('useClassLookup'); return { status: 'loading', data: null, retry() {} }; }
export async function classFetch() { calls.push('classFetch'); return { ok: false, status: 0 }; }
export async function classWrite() { calls.push('classWrite'); return { ok: false, status: 0 }; }
export const forgetClass = note('forgetClass');
export const rememberClassCode = note('rememberClassCode');
export const forgetClassCode = note('forgetClassCode');
export function pendingClassCode() { calls.push('pendingClassCode'); return null; }
`;
const HOOKS = `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const ROOT = ${JSON.stringify(ROOT_URL)};
const REACT = ${JSON.stringify(reactUrl)};
const STUBS = {
  'next/link': "import React from '" + REACT + "'; export default function Link({ href, children, prefetch, ...rest }) { return React.createElement('a', { href, ...rest }, children); }",
  './useClassLeague': ${JSON.stringify(RECORDER)},
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (specifier.endsWith('.css')) return { url: 'stub:css', shortCircuit: true };
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
let swc = null;
export async function load(url, context, next) {
  if (url === 'stub:css') return { format: 'module', source: 'export default null;', shortCircuit: true };
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  if (url.endsWith('.jsx')) {
    if (!swc) { swc = createRequire(new URL('package.json', ROOT))('next/dist/build/swc'); await swc.loadBindings?.(); }
    const file = fileURLToPath(url);
    const out = await swc.transform(await readFile(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' } });
    return { format: 'module', source: out.code, shortCircuit: true };
  }
  return next(url, context);
}
`;

let kit = null;
async function load() {
  if (kit) return kit;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const at = (p) => import(pathToFileURL(resolve(root, p)).href);
  const [React, server, sw, block, today, entry, line] = await Promise.all([
    import('react'), import('react-dom/server'), at('src/components/class/ClassSwitch.jsx'), at('src/components/class/ClassBlock.jsx'),
    at('src/components/class/ClassTodayCard.jsx'), at('src/components/class/ClassMobEntry.jsx'), at('src/components/class/ClassResultLine.jsx'),
  ]);
  kit = { React, server, Switch: sw.ClassLeagueSwitch, surfaces: { ClassBlock: [block.default, {}], ClassTodayCard: [today.default, {}], ClassMobEntry: [entry.default, {}], ClassResultLine: [line.default, { week: '2026-11-22', subject: 'accountancy' }] } };
  return kit;
}

function render({ React, server, Switch }, Component, props, on) {
  globalThis.__classCalls = [];
  const fetches = [];
  const real = globalThis.fetch;
  globalThis.fetch = (...args) => { fetches.push(String(args[0])); return Promise.reject(new Error('no fetch in this test')); };
  try {
    const el = React.createElement(Component, props);
    const html = server.renderToStaticMarkup(on === undefined ? el : React.createElement(Switch, { on }, el));
    return { html, calls: [...globalThis.__classCalls], fetches };
  } finally { globalThis.fetch = real; }
}

test('switched off (and outside any switch), every class surface renders nothing and calls no hook that reads', async () => {
  const k = await load();
  for (const [name, [Component, props]] of Object.entries(k.surfaces)) {
    for (const on of [false, undefined]) {
      const r = render(k, Component, props, on);
      assert.equal(r.html, '', `${name} draws nothing (${on === undefined ? 'no switch' : 'off'})`);
      assert.deepEqual(r.calls, [], `${name} reaches no read (${on === undefined ? 'no switch' : 'off'})`);
      assert.deepEqual(r.fetches, [], `${name} fetches nothing`);
    }
  }
});

test('switched on, the same surfaces do mount and ask for their read (the switch is what stops them)', async () => {
  const k = await load();
  const block = render(k, ...k.surfaces.ClassBlock, true);
  assert.match(block.html, /cls cls--wait/, 'the block draws its loading frame');
  assert.ok(block.calls.includes('useClassLeague'));
  assert.ok(render(k, ...k.surfaces.ClassMobEntry, true).calls.includes('useClassLeague'));
  assert.ok(render(k, ...k.surfaces.ClassTodayCard, true).calls.includes('useClassLeague'));
  assert.ok(render(k, ...k.surfaces.ClassResultLine, true).calls.includes('useClassWeek'));
});

test('the switch comes from the server: the app layout reads CLASS_LEAGUES_ENABLED and hands it down; the preview defaults off', () => {
  const layout = readFileSync(resolve(root, 'src/app/(app)/layout.js'), 'utf8');
  assert.match(layout, /<ClassLeagueSwitch on=\{classLeaguesEnabled\(\)\}>\{children\}<\/ClassLeagueSwitch>/);
  assert.match(layout, /await connection\(\);/, 'read on every request, not at build');
  const preview = readFileSync(resolve(root, 'src/app/preview/arena/ArenaPreviewClient.jsx'), 'utf8');
  assert.match(preview, /<ClassLeagueSwitch on=\{Boolean\(params\.get\('class'\)\) && params\.get\('class'\) !== 'off'\}>/);
  const hook = readFileSync(resolve(root, 'src/components/class/useClassLeague.js'), 'utf8');
  assert.match(hook, /return prev\?\.status === 'ready' \? prev : \{ status: 'off', data: null \};/, 'a failed read draws nothing new');
});
