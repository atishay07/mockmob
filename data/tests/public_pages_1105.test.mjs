// The public pages' refinement, night of 5 Nov 2026 (packet R2-B; docs/design-decisions/web-1105-public.md).
// Source-level checks of what the critique found and fixed: the CTA rule (Sign up free and Log in lead, as on the home
// page, owner LK83/LK88), even lines (no "CUET" at a line end with "2027" on the next, text-wrap on every public page),
// the phone menu sheet's way in, the dock on the public pages, the footer on phones and the breadcrumb's rhythm.
// The rendered checks (360, 390, 1024, 1440, Night and Day, real Chrome) are in the design note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const NBSP = ' ';

test('keepTogether joins an exam name to its year or number, and leaves everything else alone', async () => {
  const { keepTogether } = await import(pathToFileURL(join(ROOT, 'src/lib/keepTogether.mjs')).href);
  assert.equal(keepTogether('Start your CUET 2027 practice.'), `Start your CUET${NBSP}2027 practice.`);
  assert.equal(keepTogether('from NTA’s CUET UG 2026 syllabus'), `from NTA’s CUET${NBSP}UG${NBSP}2026 syllabus`);
  assert.equal(keepTogether('Class 12 autumn, Round 3 and Paper 301'), `Class${NBSP}12 autumn, Round${NBSP}3 and Paper${NBSP}301`);
  assert.equal(keepTogether('CUET subjects'), 'CUET subjects', 'a CUET without a number is left as it is');
  assert.equal(keepTogether(null), null);
  assert.equal(keepTogether(42), 42);
});

test('the sign-up heading keeps "CUET 2027" on one line (it split at 390 and 1440)', () => {
  const shell = read('src/components/auth/AuthShell.jsx');
  assert.match(shell, /import \{ keepTogether \} from '@\/lib\/keepTogether\.mjs';/);
  assert.match(shell, /\{keepTogether\(title\)\}/, 'the title goes through keepTogether');
  assert.match(shell, /\{keepTogether\(lead\)\}/);
  assert.match(read('src/app/signup/SignupPageClient.jsx'), /'Start your CUET 2027 practice\.'/, 'the words are unchanged');
});

test('the guides and the subject pages join "CUET 2027" and "CUET UG 2026" in everything they draw', () => {
  const seo = read('src/components/SeoContentPage.jsx');
  for (const field of ['page.h1', 'page.intro', 'section.heading', 'paragraph', 'faq.question', 'faq.answer']) {
    assert.match(seo, new RegExp(`keepTogether\\(${field.replace('.', '\\.')}\\)`), `SeoContentPage: ${field}`);
  }
  const subject = read('src/components/subject/SubjectLandingPage.jsx');
  for (const field of ['hub.h1', 'hub.intro', 'faq.question', 'faq.answer', 'paragraph']) {
    assert.match(subject, new RegExp(`keepTogether\\(${field.replace('.', '\\.')}\\)`), `SubjectLandingPage: ${field}`);
  }
  assert.ok(subject.includes("NTA’s {keepTogether('CUET UG 2026')} syllabus"), "the syllabus line's literal is joined (an &nbsp; entity in JSX text ate the space before it)");
  assert.ok(read('src/components/MarketingFooter.jsx').includes("['CUET\\u00a02027 guide', '/cuet-2027']"), 'the footer link');
});

test('every public page breaks its lines evenly: paragraphs pretty, headings balanced (the landing keeps its own rule)', () => {
  const css = read('src/app/marketing.css');
  assert.match(css, /:where\(\.mm:not\(\.lp\)\) :where\(p, li, dd, blockquote, \.mm-faq__body\) \{ text-wrap-style: pretty; \}/);
  assert.match(css, /:where\(\.mm:not\(\.lp\)\) :where\(h1, h2, h3, h4, dt, summary, figcaption\) \{ text-wrap-style: balance; \}/);
});

test('the CTA rule on the public pages (LK83/LK88): the bar says "Sign up free" and "Log in", the auth pages offer the other door in the same words', () => {
  const nav = read('src/components/NavBar.jsx');
  assert.match(nav, /<Link href="\/signup" className="mm-btn mm-btn--secondary mm-nav__cta">\s*Sign up free\s*<\/Link>/, 'the bar\'s key stays the quiet secondary (one volt per screen)');
  assert.doesNotMatch(nav, />\s*Start free\s*</, 'no second wording for the same door');
  assert.match(nav, /pathname === '\/login' \? 'Sign up free' : 'Log in'/, 'on Log in the bar offers Sign up free; on Sign up, Log in');
  const card = read('src/components/ui/SignupCard.jsx');
  assert.match(card, /isLogin \? 'Sign up free' : 'Log in'/, 'the card\'s switch line says Sign up free');
  assert.doesNotMatch(card + nav, /Create an account/);
});

test('the phone menu sheet ends with the way in: a guest gets "Log in" and "Sign up free" as keys, a student "Go to Practice"', () => {
  const nav = read('src/components/NavBar.jsx');
  const sheet = nav.slice(nav.indexOf('id="mm-nav-sheet"'));
  assert.match(sheet, /className="mm-nav__sheet-keys"/);
  assert.match(sheet, /<Link href="\/login" onClick=\{closeMenu\} className="mm-btn mm-btn--secondary">\s*Log in\s*<\/Link>/);
  assert.match(sheet, /<Link href="\/signup" onClick=\{closeMenu\} className="mm-btn mm-btn--primary">\s*Sign up free\s*<\/Link>/);
  assert.match(sheet, /<Link href="\/dashboard" onClick=\{closeMenu\} className="mm-btn mm-btn--primary">\s*Go to Practice\s*<\/Link>/);
  const css = read('src/app/marketing.css');
  assert.match(css, /\.mm-nav__sheet \.mm-nav__sheet-keys \.mm-btn--primary \{[^}]*color: var\(--volt-ink\)/, 'the volt key keeps its dark ink inside the sheet');
});

test('the full bar of links needs about 1100 px: below 1120 the links live in the menu, so nothing is pushed off the right edge at 1024', () => {
  const css = read('src/app/marketing.css');
  assert.match(css, /@media \(min-width: 1120px\) \{\n  \.mm-nav__links \{/);
  assert.match(css, /@media \(min-width: 1120px\) \{\n  \.mm-nav__toggle \{\n    display: none;/);
});

test('the public pages\' phone dock is the home page\'s: a guest gets "Log in" and "Sign up free" (its true line inside), a student one key back in', () => {
  const dock = read('src/components/PublicDock.jsx');
  assert.match(dock, /useAuth\(\)/);
  // Round 4 (owner LK135, 5 Nov 2026): the home page's re-made bar, so the same "Sign up free" / "No card needed" key here.
  assert.match(dock, /label=\{isAuthenticated \? undefined : DOCK_GO\.label\}/);
  assert.match(dock, /sub=\{isAuthenticated \? null : DOCK_GO\.sub\}/);
  assert.match(dock, /secondary=\{isAuthenticated \? null : LOG_IN\}/);
  assert.match(dock, /hideAtFooter/, 'it leaves at the footer, as on the home page');
  for (const f of ['src/app/about/page.js', 'src/app/cuet/page.js', 'src/app/cuet-subject-combination/page.js', 'src/components/SeoContentPage.jsx', 'src/components/subject/SubjectLandingPage.jsx']) {
    const src = read(f);
    assert.match(src, /<PublicDock /, `${f} uses the public dock`);
    assert.doesNotMatch(src, /<MobileDock /, `${f}: no single "Sign up free" key`);
  }
  assert.doesNotMatch(read('src/app/cuet-subject-combination/page.js'), /Try a CUET question/, 'no sample key in the dock (LK83)');
  const css = read('src/app/marketing.css');
  // Every dock but the home page's (in .lp-dockgate): the combo planner borrows .lp, and its dock stacked "Log in" as bare
  // text over the key when these rules were scoped to .mm:not(.lp).
  assert.match(css, /:where\(:not\(\.lp-dockgate\)\) > \.mm-dock\[data-keys='2'\] \{/);
  assert.match(css, /:where\(:not\(\.lp-dockgate\)\) > \.mm-dock \.mm-dock__ghost \{/);
});

test('the footer on a phone: Subjects and Company side by side, the brand block and Product full width', () => {
  const css = read('src/app/marketing.css');
  assert.match(css, /@media \(max-width: 639px\) \{\n  \.mm-foot__cols \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test('the breadcrumb\'s separators sit evenly: the 44 px floor comes from padding, not a minimum width that leaves a gap after "Home"', () => {
  const css = read('src/app/marketing.css');
  assert.match(css, /\.mm nav\.mm-crumbs a \{ min-width: 0; padding-inline: 0\.375rem; margin-inline: -0\.375rem; \}/);
});
