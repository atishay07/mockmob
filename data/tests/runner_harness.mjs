// A headless timed runner for node:test. It renders the real runner (src/app/(app)/test/TestPageClient.jsx) with
// React DOM into a small in-memory DOM, on a clock the test moves, so a test can act as a student does (tap an
// option, Next, the palette, a key, leaving the tab) and read what the page shows and what it sends.
//
// What is real: the runner, React and React DOM, the NTA integrity guard (src/components/arena/ExamIntegrityGuard.jsx),
// the icons and every data/ module the runner imports. JSX is compiled with the Next.js SWC binding the project
// already ships. What is stood in for: the network (`net`), sign-in, Next's router and link, CSS, and the Mobi, vote
// and state components (no part of the timed paper). The DOM is only what React DOM and the runner use; it has no
// layout, so sizes read as 0, and fullscreen is unsupported (the guard's "Continue in this window" path).
//
// Capture can be swapped out: mount({ capture: 'off' }) loads a second copy of the runner whose
// '@/lib/runnerCapture' records only what the runner recorded before slice 2 (visits without via, answers, marks).
import { register, createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_URL = pathToFileURL(`${ROOT}/`).href;
const RUNNER = pathToFileURL(path.join(ROOT, 'src', 'app', '(app)', 'test', 'TestPageClient.jsx')).href;

// ---- the clock ---------------------------------------------------------------------------------
export const clock = { now: Date.parse('2026-10-15T10:00:00.000Z') };
Date.now = () => clock.now;

// ---- a small DOM -------------------------------------------------------------------------------
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const listeners = new WeakMap();
function listen(target, type, fn, options) {
  if (!fn) return;
  const key = `${type}|${typeof options === 'boolean' ? options : !!options?.capture}`;
  const map = listeners.get(target) || new Map(); listeners.set(target, map);
  const list = map.get(key) || []; if (!list.includes(fn)) list.push(fn); map.set(key, list);
}
function unlisten(target, type, fn, options) {
  const list = listeners.get(target)?.get(`${type}|${typeof options === 'boolean' ? options : !!options?.capture}`);
  const at = list ? list.indexOf(fn) : -1; if (at >= 0) list.splice(at, 1);
}
function invoke(target, event, capture) {
  const list = listeners.get(target)?.get(`${event.type}|${capture}`);
  if (!list) return;
  event.currentTarget = target;
  for (const fn of [...list]) { if (typeof fn === 'function') fn.call(target, event); else fn?.handleEvent?.(event); if (event.stoppedNow) break; }
}
const windowTarget = {};
function dispatch(target, event) {
  event.target = target;
  const route = [];
  for (let node = target.parentNode; node; node = node.parentNode) route.push(node);
  if (target !== windowTarget) route.push(windowTarget);
  for (const node of [...route].reverse()) { event.eventPhase = 1; invoke(node, event, true); if (event.stopped) return !event.defaultPrevented; }
  event.eventPhase = 2; invoke(target, event, true); if (!event.stopped) invoke(target, event, false);
  if (event.bubbles) for (const node of route) { if (event.stopped) break; event.eventPhase = 3; invoke(node, event, false); }
  event.currentTarget = null;
  return !event.defaultPrevented;
}
export class FakeEvent {
  constructor(type, init = {}) {
    Object.assign(this, { bubbles: false, cancelable: true, button: 0, buttons: 0, clientX: 0, clientY: 0, detail: 0,
      shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, isPrimary: true, pointerId: 1, pointerType: 'mouse' }, init);
    this.type = type; this.defaultPrevented = false; this.timeStamp = clock.now; this.isTrusted = true;
    this.target = null; this.currentTarget = null; this.eventPhase = 0; this.stopped = false; this.stoppedNow = false;
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this.stopped = true; }
  stopImmediatePropagation() { this.stopped = true; this.stoppedNow = true; }
  getModifierState() { return false; }
}

class FakeNode {
  constructor(ownerDocument) { this.ownerDocument = ownerDocument; this.parentNode = null; this.childNodes = []; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get nextSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) + 1] ?? null : null; }
  get previousSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) - 1] ?? null : null; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get isConnected() { let n = this; while (n) { if (n.nodeType === 9) return true; n = n.parentNode; } return false; }
  appendChild(child) { child.parentNode?.removeChild(child); this.childNodes.push(child); child.parentNode = this; return child; }
  insertBefore(child, before) {
    if (!before) return this.appendChild(child);
    child.parentNode?.removeChild(child);
    this.childNodes.splice(this.childNodes.indexOf(before), 0, child); child.parentNode = this; return child;
  }
  removeChild(child) { const at = this.childNodes.indexOf(child); if (at >= 0) this.childNodes.splice(at, 1); child.parentNode = null; return child; }
  contains(other) { for (let n = other; n; n = n.parentNode) if (n === this) return true; return false; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(value) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = value === '' || value == null ? [] : [this.ownerDocument.createTextNode(String(value))];
    for (const c of this.childNodes) c.parentNode = this;
  }
  addEventListener(type, fn, options) { listen(this, type, fn, options); }
  removeEventListener(type, fn, options) { unlisten(this, type, fn, options); }
  dispatchEvent(event) { return dispatch(this, event); }
}
class FakeText extends FakeNode {
  constructor(ownerDocument, data) { super(ownerDocument); this.data = String(data); }
  get nodeType() { return 3; }
  get nodeName() { return '#text'; }
  get nodeValue() { return this.data; }
  set nodeValue(value) { this.data = String(value); }
  get textContent() { return this.data; }
  set textContent(value) { this.data = String(value); }
}
class FakeComment extends FakeText {
  get nodeType() { return 8; }
  get nodeName() { return '#comment'; }
  get textContent() { return ''; }
}
class FakeStyle {
  setProperty(name, value) { if (value === '' || value == null) delete this[name]; else this[name] = String(value); }
  removeProperty(name) { delete this[name]; }
  getPropertyValue(name) { return this[name] ?? ''; }
}
// Selectors the runner uses: a list of compounds (tag, .class, [attr], [attr="v"], :not(:disabled)), no combinators.
function compound(text) {
  const not = []; let rest = text.replace(/:not\(([^)]*)\)/g, (m, inner) => { not.push(inner); return ''; });
  const attrs = []; rest = rest.replace(/\[([\w-]+)(?:="([^"]*)")?\]/g, (m, name, value) => { attrs.push([name, value]); return ''; });
  const classes = []; rest = rest.replace(/\.([\w-]+)/g, (m, name) => { classes.push(name); return ''; });
  const tag = rest.trim().toLowerCase() || null;
  return (el) => el.nodeType === 1 && (!tag || el.localName === tag)
    && classes.every((c) => (el.getAttribute('class') || '').split(/\s+/).includes(c))
    && attrs.every(([n, v]) => el.hasAttribute(n) && (v === undefined || el.getAttribute(n) === v))
    && not.every((inner) => (inner === ':disabled' ? !el.hasAttribute('disabled') : !compound(inner)(el)));
}
// A descendant chain ("a b c"): the last compound matches the element, the others match ancestors in order.
function chain(text) {
  const steps = text.trim().split(/\s+/).map(compound);
  const own = steps.pop();
  return (el) => {
    if (!own(el)) return false;
    let node = el.parentNode;
    for (let i = steps.length - 1; i >= 0; i--) {
      while (node && !(node.nodeType === 1 && steps[i](node))) node = node.parentNode;
      if (!node) return false;
      node = node.parentNode;
    }
    return true;
  };
}
const matcher = (selector) => { const parts = selector.split(',').map(chain); return (el) => parts.some((p) => p(el)); };
function* descendants(node) { for (const c of node.childNodes) { if (c.nodeType === 1) { yield c; yield* descendants(c); } } }
class FakeElement extends FakeNode {
  constructor(ownerDocument, name, namespaceURI = HTML_NS) {
    super(ownerDocument);
    this.namespaceURI = namespaceURI; this.localName = namespaceURI === HTML_NS ? name.toLowerCase() : name;
    this.attrs = new Map(); this.style = new FakeStyle(); this.html = null;
    const el = this;
    this.dataset = new Proxy({}, {
      get: (t, key) => el.getAttribute(`data-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`) ?? undefined,
      set: (t, key, value) => { el.setAttribute(`data-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value); return true; },
    });
  }
  get nodeType() { return 1; }
  get tagName() { return this.namespaceURI === HTML_NS ? this.localName.toUpperCase() : this.localName; }
  get nodeName() { return this.tagName; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  setAttributeNS(ns, name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  removeAttributeNS(ns, name) { this.attrs.delete(name); }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  get id() { return this.getAttribute('id') || ''; }
  get className() { return this.getAttribute('class') || ''; }
  get tabIndex() { return Number(this.getAttribute('tabindex') ?? (['button', 'a', 'input'].includes(this.localName) ? 0 : -1)); }
  get open() { return this.hasAttribute('open'); }
  set open(value) { if (value) this.setAttribute('open', ''); else this.removeAttribute('open'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set innerHTML(value) { this.textContent = ''; this.html = String(value); }
  get innerHTML() { return this.html ?? ''; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }
  scrollIntoView() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  get offsetHeight() { return 0; }
  get offsetTop() { return 0; }
  get offsetWidth() { return 0; }
  get offsetLeft() { return 0; }
  matches(selector) { return matcher(selector)(this); }
  closest(selector) { const m = matcher(selector); for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (m(n)) return n; return null; }
  querySelectorAll(selector) { const m = matcher(selector); return [...descendants(this)].filter(m); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
class FakeDocument extends FakeNode {
  constructor() {
    super(null);
    this.ownerDocument = null;
    this.documentElement = this.appendChild(new FakeElement(this, 'html'));
    this.head = this.documentElement.appendChild(new FakeElement(this, 'head'));
    this.body = this.documentElement.appendChild(new FakeElement(this, 'body'));
    this.activeElement = this.body; this.hidden = false; this.focused = true;
    this.fullscreenElement = null; this.fullscreenEnabled = false;
  }
  get nodeType() { return 9; }
  get nodeName() { return '#document'; }
  get visibilityState() { return this.hidden ? 'hidden' : 'visible'; }
  get defaultView() { return globalThis; }
  hasFocus() { return this.focused; }
  createElement(name) { return new FakeElement(this, name); }
  createElementNS(ns, name) { return new FakeElement(this, name, ns); }
  createTextNode(data) { return new FakeText(this, data); }
  createComment(data) { return new FakeComment(this, data); }
  exitFullscreen() { return Promise.resolve(); }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }
  querySelector(selector) { return this.documentElement.querySelector(selector); }
}
class FakeStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

export const document = new FakeDocument();
const location = { url: new URL('https://mockmob.test/test') };
for (const key of ['href', 'search', 'pathname', 'origin', 'host']) Object.defineProperty(location, key, { get: () => location.url[key] });
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
define('window', globalThis);
define('self', globalThis);
define('document', document);
define('navigator', { onLine: true, userAgent: 'node', language: 'en-IN', vibrate() { return true; } });
define('location', location);
define('history', { replaceState(state, title, url) { if (url) location.url = new URL(String(url), location.url); }, pushState() {} });
define('localStorage', new FakeStorage());
define('sessionStorage', new FakeStorage());
define('matchMedia', (query) => ({ matches: /reduce|min-width/.test(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
define('getComputedStyle', () => ({ getPropertyValue: () => '' }));
define('confirm', () => true);
define('alert', () => {});
define('HTMLIFrameElement', class HTMLIFrameElement {});
define('HTMLElement', FakeElement);
define('Element', FakeElement);
define('Node', FakeNode);
define('Text', FakeText);
define('addEventListener', (type, fn, options) => listen(windowTarget, type, fn, options));
define('removeEventListener', (type, fn, options) => unlisten(windowTarget, type, fn, options));
define('dispatchEvent', (event) => dispatch(windowTarget, event));
define('IS_REACT_ACT_ENVIRONMENT', true);
windowTarget.parentNode = null;

// ---- module hooks: compile JSX, stand in for the network, sign-in, router and the components outside the paper ----
const reactUrl = pathToFileURL(createRequire(path.join(ROOT, 'package.json')).resolve('react')).href;
const HOOKS = `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const ROOT = ${JSON.stringify(ROOT_URL)};
const REACT = ${JSON.stringify(reactUrl)};
const none = 'export default function None() { return null; }';
const STUBS = {
  'next/navigation': 'export const useSearchParams = () => globalThis.__runner.params; export const useRouter = () => globalThis.__runner.router;',
  'next/link': "import React from '" + REACT + "'; export default function Link({ href, children, prefetch, ...rest }) { return React.createElement('a', { href, ...rest }, children); }",
  '@/components/AuthProvider': 'export const useAuth = () => globalThis.__runner.auth;',
  '@/lib/fetcher': 'export const api = (p, init) => globalThis.__runner.net(p, init); export const apiPost = (p, data) => globalThis.__runner.net(p, { method: "POST", body: JSON.stringify(data) }); export const apiGet = (p) => globalThis.__runner.net(p); export const apiPatch = (p, data) => globalThis.__runner.net(p, { method: "PATCH", body: JSON.stringify(data) });',
  '@/components/brand/ArenaCompanion': none,
  '@/components/brand/MobiReact': none,
  '@/components/questions/VoteControls': 'export function VoteControls() { return null; }',
  '@/components/ui/Skeleton': "import React from '" + REACT + "'; const s = (name) => (props) => React.createElement('div', { 'data-stub': name }, props.message || props.label || props.title || null); export const PageSpinner = s('spinner'); export const ErrorState = s('error'); export const NoticeState = s('notice'); export const Skeleton = s('skeleton');",
  '@/components/ui/Button': "import React from '" + REACT + "'; export function Button({ variant, ...props }) { return React.createElement('button', { type: 'button', ...props }); }",
  // Capture off: only what the runner recorded before slice 2. Visits carry no via; nothing else is recorded.
  'capture-off': 'export function nextEvent(events, clock, qid, type, value) { if (!clock || !clock.startedAt || events.length >= 5000 || !["answer", "visit", "mark"].includes(type)) return null; const prior = events.at(-1); return { seq: ((prior && prior.seq) || 0) + 1, qid, type, at: Math.max((prior && prior.at) || 0, clock.now - clock.startedAt), ...(type === "answer" ? { answer: value } : {}), ...(type === "mark" ? { marked: value === true } : {}) }; } export function onScreenQid(events, fallback) { return fallback; } export function endReason() { return null; } export function captureMeta() { return {}; } export function usePresenceCapture() {}',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (specifier === '@/lib/runnerCapture' && String(context.parentURL || '').includes('capture=off')) return { url: 'stub:capture-off', shortCircuit: true };
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (specifier.endsWith('.css')) return { url: 'stub:css', shortCircuit: true };
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL.split('?')[0]).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
let swc = null;
export async function load(url, context, next) {
  if (url === 'stub:css') return { format: 'module', source: 'export default null;', shortCircuit: true };
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  const clean = url.split('?')[0];
  if (clean.endsWith('.jsx')) {
    if (!swc) { swc = createRequire(new URL('package.json', ROOT))('next/dist/build/swc'); await swc.loadBindings?.(); }
    const file = fileURLToPath(clean);
    const out = await swc.transform(await readFile(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' } });
    return { format: 'module', source: out.code, shortCircuit: true };
  }
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
export const act = React.act;

// ---- timers on the test's clock (installed after React, whose scheduler keeps the real ones) ----
const timers = new Map(); let nextTimer = 1;
define('setTimeout', (fn, ms = 0, ...args) => { const id = nextTimer++; timers.set(id, { fn, args, at: clock.now + Math.max(0, Number(ms) || 0) }); return id; });
define('setInterval', (fn, ms = 0, ...args) => { const id = nextTimer++; const every = Math.max(1, Number(ms) || 0); timers.set(id, { fn, args, at: clock.now + every, every }); return id; });
define('clearTimeout', (id) => { timers.delete(id); });
define('clearInterval', (id) => { timers.delete(id); });
define('requestAnimationFrame', (fn) => globalThis.setTimeout(() => fn(clock.now), 16));
define('cancelAnimationFrame', (id) => timers.delete(id));

/** Let pending promises, effects and React work settle. */
export async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setImmediate(r)); });
}
/**
 * Move the clock forward, running every timer that falls due, in order. With { coarse: true } (a long wait, such as
 * most of an hour) a repeating timer runs once at its last due time before the next other timer, instead of at every
 * step: the runner's 250 ms clock tick only reads the time, so the page ends the wait exactly as it would.
 */
export async function advance(ms, { coarse = false } = {}) {
  const until = clock.now + ms;
  for (;;) {
    let due = null;
    for (const [id, t] of timers) if (t.at <= until && (!due || t.at < due[1].at || (t.at === due[1].at && id < due[0]))) due = [id, t];
    if (!due) break;
    const [id, t] = due;
    if (coarse && t.every) {
      let other = until;
      for (const [otherId, o] of timers) if (otherId !== id && o.at < other) other = o.at;
      if (other >= t.at) t.at += Math.floor((other - t.at) / t.every) * t.every;
    }
    clock.now = Math.max(clock.now, t.at);
    if (t.every) t.at += t.every; else timers.delete(id);
    await act(async () => { t.fn(...t.args); });
  }
  clock.now = until;
  await settle();
}

// ---- reading and acting ------------------------------------------------------------------------
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** The page as markup, attributes and styles in a stable order. */
export function serialize(node = document.body) {
  if (node.nodeType === 3) return escape(node.data);
  if (node.nodeType === 8) return '';
  const attrs = [...node.attrs].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ` ${k}="${escape(v)}"`).join('');
  const style = Object.entries(node.style).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join(';');
  return `<${node.localName}${attrs}${style ? ` style="${escape(style)}"` : ''}>${node.html ?? node.childNodes.map(serialize).join('')}</${node.localName}>`;
}
export const text = (node = document.body) => node.textContent.replace(/\s+/g, ' ').trim();
/** Every element matching the selector whose text includes `label` (case sensitive), in document order. */
export function find(selector, label) {
  return document.querySelectorAll(selector).filter((el) => label === undefined || text(el).includes(label));
}
export function one(selector, label) {
  const found = find(selector, label);
  if (!found.length) throw new Error(`nothing matches ${selector}${label === undefined ? '' : ` with "${label}"`}`);
  return found[0];
}
/** A pointer click as a browser delivers it: none on a disabled control. */
export async function click(el) {
  if (el.hasAttribute('disabled')) throw new Error(`disabled: ${text(el)}`);
  await act(async () => { el.dispatchEvent(new FakeEvent('click', { bubbles: true, detail: 1 })); });
  await settle();
}
export async function fire(el, type, init = {}) {
  await act(async () => { el.dispatchEvent(new FakeEvent(type, { bubbles: true, ...init })); });
  await settle();
}
export async function key(keyName, init = {}) {
  await fire(document.body, 'keydown', { key: keyName, code: init.code || '', ...init });
}
/**
 * Run `fn` with nothing rendered after it until the next settle(), as when a closing tab never paints again. React
 * is told this is not a test step, so the state updates it queues wait without a warning.
 */
export function withoutRender(fn) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  try { return fn(); } finally { globalThis.IS_REACT_ACT_ENVIRONMENT = true; }
}
/** The tab hidden (true) or shown again (false), as the browser reports it. */
export async function visibility(hidden) {
  document.hidden = hidden; document.focused = !hidden;
  await fire(document, 'visibilitychange', { bubbles: false });
}

// ---- a session -----------------------------------------------------------------------------------
export function paper(count = 6, { subject = 'accountancy' } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`, subject, chapter: i % 2 ? 'Partnership' : 'Ratios', difficulty: 'medium', correctIndex: i % 4,
    question: `Question ${i + 1} text`, body: `Question ${i + 1} text`,
    options: ['first', 'second', 'third', 'fourth'].map((t, j) => ({ key: 'ABCD'[j], text: `${t} ${i + 1}` })),
  }));
}

/**
 * Mount the runner for one session. `server` held sessions sync events with PUT /api/sessions; device-held sessions
 * (the default) carry a session ticket and send everything with the submit. Every request lands in `requests`.
 */
export async function mount({ mode = 'nta', questions = paper(), capture = 'on', storage = 'device', durationMs = 3600000, events = [], params = {} } = {}) {
  const startedAt = clock.now;
  const requests = [];
  const router = { pushed: [], push(url) { this.pushed.push(url); }, replace(url) { this.pushed.push(url); } };
  const search = new URLSearchParams({ subject: 'accountancy', mode, count: String(questions.length), generationKey: `generation-${capture}-${mode}-${startedAt}`, ...params });
  location.url = new URL(`https://mockmob.test/test?${search}`);
  globalThis.__runner = {
    params: search, router,
    auth: { user: { id: 'student-1', isPremium: true }, status: 'authenticated', refreshSession: refresh },
    // Every reply crosses the network as JSON, so the runner never holds the test's own objects.
    net: async (url, init = {}) => JSON.parse(JSON.stringify(await reply(url, init))),
  };
  async function reply(url, init) {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, method: init.method || 'GET', body, keepalive: init.keepalive === true });
    if (url === '/api/sessions' && init.method === 'POST') {
      const view = questions.map(({ correctIndex, ...q }) => q);
      const meta = { sessionId: 'session-1', mode, requestedCount: questions.length, ...(storage === 'device' ? { sessionTicket: 'ticket-1', storage: 'device' } : {}), ...(mode === 'nta' ? { ntaPaper: { status: 'closest', items: [] } } : {}) };
      return { id: 'session-1', startedAt: new Date(startedAt).toISOString(), expiresAt: new Date(startedAt + durationMs).toISOString(), serverNow: clock.now, state: 'active', questions: view, meta, events };
    }
    if (url === '/api/sessions' && init.method === 'PUT') return { acknowledgedSequence: body.events.at(-1)?.seq || 0 };
    if (url === '/api/attempts') return { id: 'attempt-1' };
    return {};
  }
  const href = `${RUNNER}?capture=${capture}`;
  const { default: TestPageClient } = await import(href);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(TestPageClient)); });
  await settle();
  return {
    container, requests, router, questions, startedAt, durationMs,
    html: () => serialize(container),
    submitted: () => requests.filter((r) => r.url === '/api/attempts'),
    synced: () => requests.filter((r) => r.url === '/api/sessions' && r.method === 'PUT'),
    /** The page closed. keepStorage leaves the saved draft, as a reload on the same device would find it. */
    async unmount({ keepStorage = false } = {}) {
      await act(async () => root.unmount()); container.parentNode?.removeChild(container); timers.clear();
      if (!keepStorage) { localStorage.clear(); sessionStorage.clear(); }
      document.hidden = false; document.focused = true;
    },
  };
}
async function refresh() { return null; }

// ---- the student's paths through an NTA paper (6 questions, one hour) ----------------------------
// Each step waits, acts, then the page is read. `snap(label)` is called after every step.
export const NTA_PATHS = {
  // Answer, Next, the palette, a mark, Previous, the arrow keys, a tab switch (warning 1), the NTA style
  // buttons, then Submit test.
  async submit(s, snap) {
    snap('loaded');
    await click(one('button', 'Continue in this window')); snap('entered');
    await advance(7000); await click(find('.nta-option')[1]); snap('answered q1');
    await advance(5000); await click(one('.nta-nav-button', 'Next')); snap('next');
    await advance(9000); await click(find('.nta-palette-chip').find((b) => text(b) === '4')); snap('palette 4');
    await advance(3000); await click(one('.nta-text-button', 'Mark')); snap('marked q4');
    await advance(4000); await click(one('.nta-nav-button', 'Previous')); snap('previous');
    await advance(6000); await key('ArrowRight'); snap('arrow right');
    await advance(2000); await key('3'); snap('key 3');
    await advance(5000); await visibility(true); snap('hidden');
    await advance(70000); await visibility(false); snap('back');
    await click(one('button', 'Continue in this window')); snap('continued');
    await advance(3000); await click(one('button', 'NTA style')); snap('classic');
    await advance(4000); await click(one('.nta-nav-button', 'Mark for review & next')); snap('mark and next');
    await advance(8000); await click(one('.nta-nav-button', 'Save & next')); snap('save and next');
    await advance(2000); await click(one('.nta-submit-button', 'Submit test')); snap('submitted');
  },
  // One answer, then the hour runs out on question 2.
  async timeUp(s, snap) {
    await click(one('button', 'Continue in this window'));
    await advance(30000); await click(find('.nta-option')[0]); snap('answered q1');
    await advance(10000); await click(one('.nta-nav-button', 'Next')); snap('on q2');
    await advance(s.durationMs - 40000 - 1000, { coarse: true }); snap('one second left');
    await advance(1500); snap('time up');
  },
  // Three tab switches: the third ends the paper and submits it.
  async strikes(s, snap) {
    await click(one('button', 'Continue in this window'));
    await advance(20000); await click(find('.nta-option')[2]); snap('answered q1');
    for (const n of [1, 2, 3]) {
      await advance(10000); await visibility(true); snap(`hidden ${n}`);
      await advance(15000); await visibility(false); snap(`back ${n}`);
      if (n < 3) { await click(one('button', 'Continue in this window')); snap(`continued ${n}`); }
    }
  },
};
