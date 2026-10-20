// L-07b (20 Oct 2026): pages opened from the Android app (query from=app, remembered per tab in sessionStorage) show no way to
// buy. Google Play's Payments policy forbids steering app users to another payment method. The script is run for real in a
// small fake browser; the CSS, the marked links and the notice are checked as source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const layout = read('src/app/layout.js');
const css = read('src/app/app-view.css');

function appViewScript() {
  const m = layout.match(/__html: `(\(function\(\)\{var d=document\.documentElement,on=false;[^`]*)`/);
  assert.ok(m, 'the app view script is in the root layout');
  return m[1];
}

/** Runs the layout script against a fake page. storage: an object, or 'throws'. Returns { attr, stored, writes }. */
function runScript({ search = '', storage = {} } = {}) {
  const dataset = {};
  const writes = [];
  const sessionStorage = storage === 'throws'
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = v; writes.push([k, v]); } };
  vm.runInNewContext(appViewScript(), { document: { documentElement: { dataset }, get cookie() { throw new Error('no cookie'); }, set cookie(v) { throw new Error('no cookie'); } }, location: { search }, sessionStorage, URLSearchParams });
  return { attr: dataset.appView, stored: storage === 'throws' ? null : storage['mm:appView'] ?? null, writes };
}

test('the layout script marks <html> from ?from=app and remembers it for this tab only', () => {
  const first = runScript({ search: '?from=app' });
  assert.equal(first.attr, '1');
  assert.equal(first.stored, '1');
  // A later page in the same tab has no marker in its URL: the tab remembers.
  assert.equal(runScript({ search: '', storage: { 'mm:appView': '1' } }).attr, '1');
  // The marker can sit among other parameters.
  assert.equal(runScript({ search: '?x=1&from=app&y=2' }).attr, '1');
});

test('a normal visit is untouched: no marker, no key, nothing set, and nothing is written', () => {
  const plain = runScript({ search: '' });
  assert.equal(plain.attr, undefined);
  assert.deepEqual(plain.writes, []);
  assert.equal(runScript({ search: '?from=email' }).attr, undefined);
  assert.equal(runScript({ search: '?from=application' }).attr, undefined);
  assert.equal(runScript({ search: '?other=from=app' }).attr, undefined);
  assert.equal(runScript({ search: '', storage: { 'mm:appView': '0' } }).attr, undefined);
});

test('blocked storage never breaks the page: the marker still applies to the page that carries it', () => {
  assert.equal(runScript({ search: '?from=app', storage: 'throws' }).attr, '1');
  assert.equal(runScript({ search: '', storage: 'throws' }).attr, undefined);
});

test('no cookie is used anywhere: Custom Tabs share Chrome cookies, so one would hide pricing from the same student later', () => {
  // The fake page throws on any cookie access, so the runs above already prove the script does not touch one.
  for (const f of ['src/app/layout.js', 'src/app/app-view.css', 'src/components/AppViewNotice.jsx']) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /document\.cookie|cookies\(\)|Set-Cookie|NextResponse|redirect\(/, f);
  }
  assert.match(layout, /import "\.\/app-view\.css";/);
});

test('the CSS hides every commerce selector in the app view, and shows the notice only there', () => {
  assert.match(css, /\.app-view-notice \{ display: none; \}/);
  assert.match(css, /html\[data-app-view\] \.app-view-notice \{\s*display: block;/);
  const hide = css.slice(css.indexOf('html[data-app-view] [data-commerce],'), css.indexOf('}', css.indexOf('html[data-app-view] [data-commerce],')));
  for (const sel of ['[data-commerce]', '[data-commerce-page]', 'a[href^="/pricing"]', 'a[href^="/upgrade"]', 'a[href^="/checkout"]', 'a[href^="/wallet"]', 'a[href="/#pricing"]']) {
    assert.ok(hide.includes(sel), sel);
  }
  assert.match(hide, /display: none !important;/);
  // The wrapper that carries data-commerce-page in normal view adds no box.
  assert.match(css, /div\[data-commerce-page\] \{ display: contents; \}/);
  // The contract for the app is written in the stylesheet.
  assert.match(css, /from=app/);
  assert.match(css, /sessionStorage\['mm:appView'\]='1'/);
});

test('the nav, the footer and the dock mark their pricing links, and the buy buttons mark themselves', () => {
  assert.match(read('src/components/NavBar.jsx'), /\{ label: 'Pricing', href: '\/pricing', commerce: true \}/);
  assert.equal((read('src/components/NavBar.jsx').match(/data-commerce=\{link\.commerce \? '' : undefined\}/g) || []).length, 2, 'bar and menu sheet');
  const footer = read('src/components/MarketingFooter.jsx');
  assert.match(footer, /\['Pricing', '\/pricing', true\]/);
  assert.match(footer, /<li key=\{href\} data-commerce=\{commerce \? '' : undefined\}>/);
  assert.match(read('src/components/MobileDock.jsx'), /data-commerce=\{checkoutAware \? '' : undefined\}/);
  assert.match(read('src/components/SeoContentPage.jsx'), /className="mm-btn mm-btn--secondary" data-commerce=""/);
  assert.match(read('src/components/SeoContentPage.jsx'), /data-commerce=\{link\.href\.startsWith\('\/pricing'\) \? '' : undefined\}/);
  assert.match(read('src/components/billing/RazorpayPaymentButton.jsx'), /<div className="mm-checkout" data-commerce="">/);
  assert.match(read('src/components/billing/PrepOSCreditPurchaseButton.jsx'), /<div className=\{className\} data-commerce="">/);
  assert.match(read('src/app/page.js'), /<section className="lp-sec" id="pricing" data-commerce="">/);
});

test('the plan and payment pages swap their body for the notice, with no link to buy', () => {
  for (const f of ['src/app/pricing/page.js', 'src/app/pricing/ai-credits/page.js']) {
    const s = read(f);
    assert.match(s, /<AppViewNotice \/>\s+<main data-commerce-page>/, f);
  }
  assert.match(read('src/app/(app)/wallet/page.js'), /<AppViewNotice \/>\s+<div data-commerce-page>/);
  const notice = read('src/components/AppViewNotice.jsx');
  assert.match(notice, /<p>Plans and payments for the app are in the MockMob app\.<\/p>/);
  assert.doesNotMatch(notice.replace(/\/\/.*$/gm, ''), /<a\b|<Link\b|href=|onClick/);
});
