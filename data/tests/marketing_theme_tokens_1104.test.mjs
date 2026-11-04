// Home spec 4 Nov 2026, packet P1 (decisions 8, 9 and 16): the Night and Day tokens of the marketing system, pinned.
// Night is the app's warm charcoal (mm_colors.dart, logo B #12110E) raised by surface, not by edges; Day is the app's cream.
// The brand words ("CUET 2027.", the tour's "MockMob") are the brand volt #D2F000 in Night and olive #3F5200 in Day (5 Nov, LK82/LK86).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `block ${selector} exists`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') { depth -= 1; if (depth === 0) return css.slice(open + 1, i); }
  }
  throw new Error(`block ${selector} is not closed`);
}
function props(text) {
  const out = {};
  for (const m of text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  return out;
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const saturation = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2; const d = mx - mn;
  return d === 0 ? 0 : (l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn));
};

const theme = stripComments(read('src/app/marketing-theme.css'));
const night = props(block(theme, "html[data-theme='dark'] .mm"));
const day = props(block(theme, "html[data-theme='light'] .mm"));

test('Night takes the app warm charcoal, raised by surface (decisions 8 and 9)', () => {
  assert.equal(night.paper, '#12110e');
  assert.equal(night['paper-raised'], '#1b1a16');
  assert.equal(night['paper-raised-2'], '#211f1a');
  assert.equal(night['paper-sunken'], '#0e0d0b');
  assert.equal(night.ink, '#f4f0e6');
  assert.equal(night['ink-2'], '#cfc8b9');
  assert.equal(night['ink-3'], '#a29b8c');
  assert.equal(night.line, 'rgba(244, 240, 230, 0.09)');
  assert.equal(night['line-strong'], 'rgba(244, 240, 230, 0.16)');
  assert.equal(night['surface-hover'], '#211f1a');
  assert.equal(night['focus-ring'], '#d2f000', 'a focus ring is functional, so it stays volt');
  assert.equal(night.tint, '244 240 230', 'warm hairline tint');
});

test('Night: links and labels are ink, no volt edge, no volt wash (C1, C2, C4)', () => {
  assert.equal(night['accent-text'], 'var(--ink)');
  assert.equal(night['accent-line'], 'var(--line-strong)');
  assert.equal(night['accent-wash'], 'transparent');
  assert.doesNotMatch(night['volt-soft'], /210|d2f000/i);
  assert.doesNotMatch(Object.values(night).join(' '), /210, ?240, ?0/, 'no volt rgba anywhere in the Night tokens');
});

test('the Night raised surfaces are told apart by surface: raised-2 is at least 1.15:1 over the paper (2 dp)', () => {
  const ratio = contrast(night['paper-raised-2'], night.paper);
  assert.ok(Math.round(ratio * 100) / 100 >= 1.15, `raised-2 over paper is ${ratio.toFixed(3)}`);
  assert.ok(contrast(night['paper-raised'], night.paper) > 1.07, 'raised over paper');
  assert.ok(contrast(night['paper-sunken'], night.paper) > 1.02 || lum(night['paper-sunken']) < lum(night.paper), 'sunken sits below the paper');
  assert.ok(contrast(night['ink-3'], night.paper) >= 6, 'ink-3 on the Night paper holds 6:1');
  assert.ok(contrast(night['ink-3'], night['paper-raised-2']) >= 5, 'ink-3 on raised-2 holds 5:1');
});

test('The brand words are the brand volt in Night (#D2F000) and olive in Day (#3F5200): one green on the page (owner LK82/LK86, 5 Nov)', () => {
  assert.equal(night['brand-word'], '#d2f000');
  assert.ok(contrast(night['brand-word'], night.paper) >= 7, 'brand word on the Night paper');
  assert.equal(day['brand-word'], '#3f5200');
  assert.ok(contrast(day['brand-word'], day.paper) >= 7, 'brand word on the Day paper');
  assert.equal(day['accent-text'], '#526700');
});

test('Day takes the app cream (proposal night, Day table)', () => {
  assert.equal(day.paper, '#f3efe6');
  assert.equal(day['paper-raised'], '#fffdf8');
  assert.equal(day['paper-sunken'], '#eae4d8');
  assert.equal(day.ink, '#1b1914');
  assert.equal(day['ink-2'], '#4a453b');
  assert.equal(day['ink-3'], '#6b6457');
  assert.equal(day.line, 'rgba(27, 25, 20, 0.10)');
  assert.equal(day['accent-line'], 'var(--line-strong)', 'no lime edges in Day either');
  assert.equal(day['accent-wash'], 'transparent');
  assert.ok(contrast(day['ink-3'], day.paper) >= 4.5, 'ink-3 on the Day paper');
  assert.ok(contrast(day['ink-3'], day['paper-sunken']) >= 4.5, 'ink-3 on the Day sunken surface');
  assert.ok(contrast(day['ink-2'], day.paper) >= 7, 'ink-2 on the Day paper');
});

test('the page and body ground follow the tokens in both themes', () => {
  assert.match(theme, /html\[data-theme='dark'\]:has\(\.mm\), html\[data-theme='dark'\] body:has\(\.mm\) \{ background: #12110e;/);
  assert.match(theme, /html\[data-theme='light'\]:has\(\.mm\), html\[data-theme='light'\] body:has\(\.mm\) \{ background: #f3efe6;/);
  const layout = read('src/app/layout.js');
  assert.match(layout, /themeColor: "#F3EFE6"/);
});

test('the landing fallback tokens (no theme attribute) equal the Night tokens, so a no-script load never shows the old green-black', () => {
  const landing = stripComments(read('src/app/landing.css'));
  const fallback = props(block(landing, '.mm.lp'));
  for (const key of ['paper', 'paper-raised', 'paper-raised-2', 'paper-sunken', 'ink', 'ink-2', 'ink-3', 'line', 'line-strong', 'accent-text', 'accent-line', 'accent-wash', 'brand-word', 'tint', 'surface-hover']) {
    assert.equal(fallback[key], night[key], `--${key} fallback equals Night`);
  }
  assert.match(landing, /html:has\(\.lp\) \{[^}]*background: #12110e;/);
  assert.match(landing, /body:has\(\.mm\.lp\) \{\s*background: #12110e;/);
  const marketing = props(block(stripComments(read('src/app/marketing.css')), '.mm'));
  assert.equal(marketing.paper, day.paper, 'the base .mm tokens are the Day cream');
  assert.equal(marketing.ink, day.ink);
  assert.equal(marketing['paper-raised'], day['paper-raised']);
});

test('the type ladder tokens (decision 16): Bricolage display, Hanken words, Literata 600 stems, no Geist Mono on the home page', () => {
  const landing = stripComments(read('src/app/landing.css'));
  const t = props(block(landing, '.mm.lp'));
  assert.equal(t['font-mono'], 'var(--font-display)', 'Geist Mono leaves the home page: its token is the display face under .lp');
  assert.match(t['font-stem'], /^var\(--font-literata, Georgia\), Georgia/);
  assert.equal(t['fw-stem'], '600');
  assert.equal(t['fw-display'], '800');
  assert.equal(t['fw-statement'], '650');
  assert.equal(t['fw-h2'], '750');
  assert.equal(t['fw-h3'], '700');
  assert.equal(t['fw-number'], '700');
  assert.equal(t['lh-display'], '0.98');
  assert.equal(t['lh-statement'], '1.12');
  assert.equal(t['lh-h2'], '1.04');
  assert.equal(t['lh-h3'], '1.15');
  assert.equal(t['lh-stem'], '1.32');
  assert.equal(t['lh-body'], '1.5');
  assert.equal(t['fs-small'], '0.875rem', 'the small floor on the home page is 14 px');
  // Sizes at the two reference widths: the ladder's 390 and 1440 columns, measured from the clamp()s (1 rem = 16 px).
  const px = (token, vw) => {
    const m = t[token].match(/^clamp\(([\d.]+)rem, ([\d.]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\)$/);
    assert.ok(m, `${token} is a clamp: ${t[token]}`);
    const [lo, base, slope, hi] = [m[1], m[2], m[3], m[4]].map(Number);
    return Math.min(hi * 16, Math.max(lo * 16, base * 16 + (slope / 100) * vw));
  };
  assert.equal(Math.round(px('fs-display', 390)), 44);
  assert.equal(Math.round(px('fs-display', 1440)), 84);
  assert.equal(Math.round(px('fs-statement', 390)), 30);
  assert.equal(Math.round(px('fs-statement', 1440)), 52);
  // Integration (4 Nov): the section h2 is 28 px on phones and the close 36/64 px, so the typed hero h1 (39.5 px at
  // 390, 36 at 360, 74 at 1440, sized so every phrase fits its line) stays the biggest type, at least 1.25x the h2.
  assert.equal(Math.round(px('fs-h2', 390)), 28);
  assert.equal(Math.round(px('fs-h2', 360)), 28);
  assert.equal(Math.round(px('fs-h2', 1440)), 52);
  assert.equal(Math.round(px('fs-h3', 390)), 20);
  assert.equal(Math.round(px('fs-h3', 1440)), 26);
  assert.equal(Math.round(px('fs-close', 390)), 36);
  assert.equal(Math.round(px('fs-close', 1440)), 64);
  assert.equal(Math.round(px('fs-stem', 390)), 20);
  assert.equal(Math.round(px('fs-stem', 1440)), 23);
  assert.equal(Math.round(px('fs-body', 390)), 16);
  assert.equal(Math.round(px('fs-body', 1440)), 18);
  assert.ok(px('fs-display', 1440) / px('fs-h2', 1440) > 1.5, 'the hero is well above the section h2 (84 over 52)');
});

test('home.css applies the ladder to the section heads, and stems use Literata 600', () => {
  const home = stripComments(read('src/app/home.css'));
  assert.match(home, /\.mm\.lp \.lp-h2 \{[^}]*font-size: var\(--fs-h2\);[^}]*font-weight: var\(--fw-h2\)/);
  assert.match(home, /\.mm\.lp \.lp-h2--xl \{[^}]*font-size: var\(--fs-close\)/);
  assert.match(home, /\.mm\.lp \.lp-h3 \{[^}]*font-size: var\(--fs-h3\)/);
  assert.match(home, /\.mm\.lp \.lp-statement__text \{ font-weight: var\(--fw-statement\)/);
  assert.match(home, /\.mm\.lp \.mm-drill__q \{[^}]*font-family: var\(--font-stem\)/);
  assert.match(stripComments(read('src/app/tour-screens.css')), /\.ts__q \{[^}]*600[^}]*var\(--font-stem/);
  assert.match(stripComments(read('src/app/lab-cinema.css')), /\.lcp-q__stem \{[^}]*var\(--font-stem/);
  for (const file of ['home', 'landing', 'feature-tour', 'tour-screens', 'compass-ladder', 'social-proof', 'lab-cinema', 'mistake-lab']) {
    assert.doesNotMatch(stripComments(read(`src/app/${file}.css`)), /var\(--font-mono[,)]|Geist Mono|monospace/, `${file}.css draws no mono face on the home page`);
  }
});

test('Literata is declared where only "/" imports it, with preload on (decision 16: preloaded on / only)', () => {
  const fonts = read('src/components/landing/HomeFonts.jsx');
  assert.match(fonts, /Literata-Variable\.woff2/);
  assert.match(fonts, /preload: true/);
  assert.match(fonts, /weight: '200 900'/);
  assert.doesNotMatch(read('src/app/layout.js'), /Literata-Variable|literata = localFont/, 'the root layout never preloads Literata for every route');
  assert.match(read('src/components/landing/HeroBackdrop.jsx'), /import \{ HomeFonts \} from '\.\/HomeFonts'/);
});

test('the two owner brand words keep the lamp-lit volt even though links and labels went to ink (L-017, L-030)', () => {
  assert.match(theme, /\.mm\.lp \.lp-title__brand \{ color: var\(--brand-word\); \}/);
  assert.match(theme, /\.mm\.lp \.lp-pos__name em \{ color: var\(--brand-word\); \}/);
});
