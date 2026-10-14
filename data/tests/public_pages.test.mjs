import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderTokensCss } from '../../shared/build-tokens.mjs';
import tokens from '../../shared/tokens.json' with { type: 'json' };

// Web redesign W2.2: the public and SEO pages. These are source checks (no browser): the copy rules
// the owner set (no em dashes, no eyebrows, no trailing arrows, no gradient washes or caps costume),
// the tokens the new CSS reads, the member-aware actions, and the legal wording that must not change.

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const SECTION_DIRS = [
  'about', 'contact', 'privacy', 'terms', 'refunds', 'cuet', 'cuet-2027', 'cuet-cutoff-calculator', 'cuet-mock-test-free',
  'cuet-practice-tests-online', 'cuet-previous-year-questions', 'cuet-subject-combination', 'features', 'pricing',
];
const SHARED = [
  'src/components/SeoContentPage.jsx', 'src/components/PublicPage.jsx', 'src/components/PublicCta.jsx',
  'src/components/LegalPage.jsx', 'src/components/public-pages.css',
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(new URL(dir, root))) {
    const rel = `${dir}${name}`;
    if (statSync(new URL(rel, root)).isDirectory()) out.push(...walk(`${rel}/`));
    else out.push(rel);
  }
  return out;
}
const OWNED = [...SECTION_DIRS.flatMap((dir) => walk(`src/app/${dir}/`)), ...SHARED];
const SOURCE = OWNED.filter((file) => /\.(js|jsx)$/.test(file));
const STYLES = OWNED.filter((file) => file.endsWith('.css'));

test('the package owns the files it says it owns', () => {
  assert.ok(OWNED.length >= 20, `only ${OWNED.length} files found`);
  for (const file of ['src/app/pricing/prepos/page.js', 'src/app/cuet/[subject]/page.js', 'src/app/pricing/pricing.css']) {
    assert.ok(OWNED.includes(file), `${file} is not in the owned set`);
  }
});

test('no em dash and no middle-dot string in what a visitor reads', () => {
  for (const file of OWNED) {
    const text = read(file);
    assert.doesNotMatch(text, /—/, `${file} has an em dash`);
    assert.doesNotMatch(text, /[A-Za-z0-9₹)] · [A-Za-z0-9₹(]/, `${file} has a middle-dot meta string`);
  }
});

test('no eyebrow, mono label, numbered badge, trailing arrow or exclamation in the page markup', () => {
  for (const file of SOURCE) {
    const text = read(file).replace(/^\s*(\/\/|\*).*$/gm, '');
    assert.doesNotMatch(text, /className="[^"]*\b(eyebrow|mono-label|display-lg|display-md)\b/, `${file} uses an old class`);
    assert.doesNotMatch(text, /\{'\/\/ /, `${file} renders a // kicker`);
    assert.doesNotMatch(text, /<Icon name="arrow"/, `${file} appends an arrow`);
    assert.doesNotMatch(text, />[^<>{}]*[A-Za-z]!\s*</, `${file} has an exclamation mark in text`);
    assert.doesNotMatch(text, /Join the Mob/, `${file} still says Join the Mob`);
  }
});

test('the new stylesheets have no caps costume, no gradient wash, no glass blur and no transition: all', () => {
  for (const file of STYLES.filter((f) => !f.includes('combo-planner'))) {
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(text, /text-transform:\s*uppercase/, `${file} sets caps`);
    assert.doesNotMatch(text, /(linear|radial|conic)-gradient/, `${file} has a gradient`);
    assert.doesNotMatch(text, /backdrop-filter/, `${file} blurs content (glass is for the header and dock only)`);
    assert.doesNotMatch(text, /transition:\s*all/, `${file} transitions all`);
  }
  const combo = read('src/app/cuet-subject-combination/combo-planner.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(combo, /gradient/);
  assert.doesNotMatch(combo, /cp-new/);
});

test('every var(--mm-*) the new stylesheets read is defined (an undefined one silently drops the declaration)', () => {
  const kit = read('src/components/ui/ui.css');
  const defined = new Set([...(renderTokensCss(tokens) + kit).matchAll(/(--mm-[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
  for (const file of STYLES) {
    const used = [...new Set([...read(file).matchAll(/var\((--mm-[a-zA-Z0-9-]+)/g)].map((m) => m[1]))];
    assert.deepEqual(used.filter((name) => !defined.has(name)), [], `${file} reads an undefined token`);
  }
});

test('the closing panel and the hero actions are member-aware, and the guest page stays the crawlable one', () => {
  const page = read('src/components/PublicPage.jsx');
  // Every variant is rendered and <html data-visitor> picks one: guest copy, member copy, member action.
  for (const klass of ['vs-guest-only', 'vs-member-only', 'vs-new-only', 'vs-returning-only', 'vs-hide-pro']) {
    assert.match(page, new RegExp(klass), `PublicPage lacks ${klass}`);
  }
  assert.match(page, /<MemberAction \/>/);
  const cta = read('src/components/PublicCta.jsx');
  assert.match(cta, /memberDockActions\(resume\)/);
  assert.match(cta, /useResumableTest/);
  // Pages that end in the panel or carry the member action.
  for (const file of ['src/components/SeoContentPage.jsx', 'src/app/about/page.js', 'src/app/features/page.js', 'src/app/cuet-cutoff-calculator/page.js', 'src/app/cuet-subject-combination/page.js']) {
    assert.match(read(file), /PageClose/, `${file} has no closing panel`);
  }
  assert.match(read('src/app/pricing/page.js'), /<MemberAction variant="secondary"/);
  // The old guest-only button on SEO pages ("Start a free mock") is gone from the article.
  assert.doesNotMatch(read('src/components/SeoContentPage.jsx'), /Start a free mock/);
});

test('sticky works on these pages: body is not a scroll container (the legacy overflow-x: hidden would stop it)', () => {
  const css = read('src/components/public-pages.css');
  assert.match(css, /html:has\(\.pp-hero\),\s*body:has\(\.pp-hero\)\s*\{\s*overflow-x:\s*clip;/);
  assert.match(css, /\.pp-toc\s*\{\s*display:\s*block;\s*position:\s*sticky;/);
});

test('the article keeps its structured data and gives every section an anchor', () => {
  const seo = read('src/components/SeoContentPage.jsx');
  for (const fn of ['breadcrumbJsonLd', 'faqJsonLd', 'courseJsonLd']) assert.match(seo, new RegExp(fn));
  assert.match(seo, /uniqueSlugs\(page\.sections\.map/);
  assert.match(seo, /<PageToc items=\{toc\}/);
  assert.match(seo, /summary>\{faq\.question\}/);
});

test('the three policies share one layout and keep their wording', () => {
  for (const [file, title] of [['privacy', 'Privacy policy'], ['terms', 'Terms of service'], ['refunds', 'Refund policy']]) {
    const text = read(`src/app/${file}/page.js`);
    assert.match(text, /<LegalPage/, `${file} does not use the shared layout`);
    assert.match(text, new RegExp(`title="${title}"`));
    assert.doesNotMatch(text, /<style>|legal-copy|container-narrow/, `${file} still carries its own layout`);
  }
  const squash = (text) => text.replace(/\s+/g, ' ');
  const privacy = squash(read('src/app/privacy/page.js'));
  assert.match(privacy, /We delete your account and study records within 30 days\. Payment records required by law are kept\./);
  assert.match(privacy, /withdrawing deletes what was collected\./);
  assert.match(privacy, /does not store full card, UPI, or bank credentials on our servers\./);
  assert.match(privacy, /\/account-deletion/);
  const terms = squash(read('src/app/terms/page.js'));
  assert.match(terms, /Current season access ends 31 July 2027\./);
  assert.match(terms, /not affiliated with NTA, DU, CUET, or any government exam body/);
  const refunds = squash(read('src/app/refunds/page.js'));
  assert.match(refunds, /MockMob does not allow refunds for completed payments/);
  assert.match(refunds, /ending 31 July 2027, with no auto-renewal/);
  assert.match(read('src/app/privacy/page.js'), /updated="12 October 2026"/);
  assert.match(read('src/app/terms/page.js'), /updated="2 October 2026"/);
  assert.match(read('src/app/refunds/page.js'), /updated="2 October 2026"/);
});

test('pricing facts are unchanged: the offer still comes from publicOffer and the buttons from the same component', () => {
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /publicOffer\(\)/);
  assert.match(pricing, /<RazorpayPaymentButton/);
  assert.match(pricing, /initialIsPremium=\{isCurrentUserPremium\}/);
  assert.match(pricing, /Unlimited access covers available content and reattempts\. It does not promise unlimited unique questions\./);
  assert.match(pricing, /RECOVERY_PACKAGING_ROWS/);
});

test('the DU tool pages no longer paint the aurora, grid and dots, and carry no kicker', () => {
  for (const file of ['src/app/cuet-cutoff-calculator/page.js', 'src/app/cuet-subject-combination/page.js']) {
    const text = read(file);
    assert.doesNotMatch(text, /lp-bg/, `${file} still paints the backdrop`);
    assert.doesNotMatch(text, /cp-new|New ·/, `${file} still has the kicker`);
    assert.match(text, /du-page\.css/, `${file} does not load the page stylesheet`);
  }
});

test('the contact page names each action and shows the address once, and the About page keeps the non-affiliation line', () => {
  const contact = read('src/app/contact/page.js');
  for (const label of ['Email support', 'Email about a payment', 'Report a question', 'Email about a partnership']) assert.match(contact, new RegExp(label));
  assert.doesNotMatch(contact, /Support replies within 24h/);
  const about = read('src/app/about/page.js').replace(/\s+/g, ' ');
  assert.match(about, /not affiliated with NTA, Delhi University, or any exam body/);
});

test('repeated headings get distinct anchors, and the removed claims stay removed', () => {
  const src = read('src/components/PublicPage.jsx');
  assert.match(src, /export function uniqueSlugs/);
  assert.match(read('src/components/LegalPage.jsx'), /uniqueSlugs\(sections\.map/);
  const features = read('src/app/features/page.js');
  assert.doesNotMatch(features, /Attack Economics|5 of 5 subjects/);
  const contact = read('src/app/contact/page.js');
  assert.doesNotMatch(contact, /evidence checks are complete|reply if there is a fit/);
  assert.doesNotMatch(read('src/app/about/page.js'), /Obsessively/);
});
