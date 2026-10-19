// Website first-impression health, 20 Oct 2026 (web/1020-landing-health; report tmp/walk-1020/web-landing/REPORT.md).
// Each test locks one fix from the audit of / and /pricing so it cannot quietly come back. Source-level and pure, so
// no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalOrigin, CANONICAL_ORIGIN, DEFAULT_SHARE_IMAGE, seoMetadata, absoluteUrl } from '../../src/lib/seo.js';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('SEO: canonical, og:url, sitemap and robots name www, the host Vercel serves (the bare domain 307s to it)', () => {
  assert.equal(CANONICAL_ORIGIN, 'https://www.mockmob.in');
  assert.equal(canonicalOrigin(''), 'https://www.mockmob.in');
  assert.equal(canonicalOrigin(undefined), 'https://www.mockmob.in');
  assert.equal(canonicalOrigin('https://mockmob.in'), 'https://www.mockmob.in');
  assert.equal(canonicalOrigin('https://mockmob.in/'), 'https://www.mockmob.in');
  assert.equal(canonicalOrigin('https://www.mockmob.in/'), 'https://www.mockmob.in');
  // A preview or staging origin stays itself, so its canonical never points at production.
  assert.equal(canonicalOrigin('https://mockmob-git-x.vercel.app/'), 'https://mockmob-git-x.vercel.app');
  assert.equal(canonicalOrigin('not a url'), 'https://www.mockmob.in');
  if (!process.env.NEXT_PUBLIC_SITE_URL) assert.equal(absoluteUrl('/pricing'), 'https://www.mockmob.in/pricing');
});

test('SEO: every page built with seoMetadata shares with a picture, and a page may still bring its own', () => {
  const plain = seoMetadata({ title: 'T', description: 'D', path: '/pricing' });
  assert.deepEqual(plain.openGraph.images, [DEFAULT_SHARE_IMAGE]);
  assert.deepEqual(plain.twitter.images, [DEFAULT_SHARE_IMAGE]);
  assert.equal(DEFAULT_SHARE_IMAGE.url, '/opengraph-image');
  assert.equal(DEFAULT_SHARE_IMAGE.width, 1200);
  const own = seoMetadata({ title: 'T', description: 'D', path: '/x', images: [{ url: '/own.png' }] });
  assert.deepEqual(own.openGraph.images, [{ url: '/own.png' }]);
  // A segment with its own opengraph-image file opts out, or the config image would replace its card.
  const file = seoMetadata({ title: 'T', description: 'D', path: '/cuet/english', images: false });
  assert.equal(file.openGraph.images, undefined);
  assert.equal(file.twitter.images, undefined);
  assert.match(read('src/app/cuet/[subject]/page.js'), /images: false,/);
});

test('SEO: the share card speaks for the whole site (no "Commerce" only, no middle-dot meta) and says the USP truthfully', () => {
  const og = stripComments(read('src/app/opengraph-image.jsx'));
  assert.doesNotMatch(og, /·/);
  assert.doesNotMatch(og, /CUET UG 2027 · Commerce|Commerce practice/);
  assert.match(og, /Unlimited mocks on Pro, from one central question bank\./);
});

test('LCP: the headline\'s still lines share one box, so the typed line never becomes a late largest paint', () => {
  const page = read('src/app/page.js');
  assert.match(page, /lp-title__line--run lp-title__brand">\{HERO_LINES\[0\]\}<\/span>\{' '\}<br \/>/);
  assert.match(read('src/app/landing.css'), /\.lp-title__line--run \{\n\s+display: inline;\n\}/);
});

test('LCP: the hero bank line (a phone\'s largest text) rises but is never invisible on its first frame', () => {
  const css = read('src/app/landing.css');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n\s+\.lp-hero \.lp-bank\[data-hero\] \{ animation-name: lp-rise-move; \}/);
  const frames = css.match(/@keyframes lp-rise-move \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(frames, 'lp-rise-move exists');
  assert.doesNotMatch(frames, /opacity/);
});

test('a11y: the feature tour slides are groups inside a plain container, not list items with a group role', () => {
  const tour = read('src/components/landing/FeatureTour.jsx');
  assert.match(tour, /<div className="ft__track"/);
  assert.match(tour, /<div key=\{slide\.id\} className="ft__slide" role="group" aria-roledescription="slide"/);
  assert.doesNotMatch(tour, /<li[^>]*role="group"/);
});

test('a11y: the sample drill\'s progress pips carry their label on an image role', () => {
  assert.match(read('src/components/landing/DemoDrill.jsx'), /<span className="mm-drill__progress" role="img" aria-label=\{`Question \$\{index \+ 1\} of/);
});

test('a11y: no complementary landmark sits inside main on the landing exam preview or the pricing page', () => {
  assert.doesNotMatch(read('src/components/landing/ExamComparator.jsx'), /<aside className="lp-exam__palette"/);
  assert.doesNotMatch(read('src/app/pricing/page.js'), /<aside className="mm-plans__note"/);
});

test('a11y: /pricing headings step down in order (the Pro card under the h1 is an h2)', () => {
  const card = read('src/components/ui/PricingCard.jsx');
  assert.match(card, /headingLevel = 3,/);
  assert.match(card, /const Name = headingLevel === 2 \? 'h2' : 'h3';/);
  assert.match(read('src/app/pricing/page.js'), /<PricingCard\n\s+\{\.\.\.PRO_PLAN\}\n\s+headingLevel=\{2\}/);
});

test('truth: the Mob is on the landing tour, the FAQ and the pricing table only while it is live', () => {
  const page = read('src/app/page.js');
  assert.match(page, /const MOB_LIVE = process\.env\.MOB_ENABLED === 'true' && process\.env\.MOB_V3_ENABLED === 'true';/);
  assert.match(page, /\.\.\.\(MOB_LIVE \? \[\{ id: 'mob', label: 'The Mob'/);
  assert.match(page, /\.\.\.\(MOB_LIVE \? \[\{ question: 'What is the Mob\?'/);
  // Its claims are the Mob's own rules.
  assert.match(page, /Everyone gets the same five questions for 24 hours/);
  assert.match(read('src/lib/mob/v3/denCopy.mjs'), /Everyone gets the same questions for 24 hours and races the runs before them\./);
  assert.match(read('src/components/landing/TourScreens.jsx'), /\n {2}mob: MobScreen,\n/);
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /env\.MOB_ENABLED !== 'true' \|\| env\.MOB_V3_ENABLED !== 'true'\) return null;/);
  assert.match(pricing, /playBillingEnabled\(env\) \? 'One a week in each Mob' : 'As many as you like'/);
  assert.match(read('src/lib/mob/v3/denCopy.mjs'), /'One start a week in each Mob\.'/);
});

test('truth: the landing says a credit buys a whole Mobi job on every plan (C-dec 3/3b), never "AI replies"', () => {
  const page = stripComments(read('src/app/page.js'));
  assert.doesNotMatch(page, /AI replies use monthly credits/);
  assert.match(page, /One credit buys a whole Mobi job, a mistake fixed for good or a doubt answered and tested, and every plan gets 50 free credits a month/);
});
