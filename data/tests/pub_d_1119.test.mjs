// Lane pub-d (19 Nov 2026): the four long guides (SeoContentPage.jsx: /cuet-mock-test-free, /cuet-practice-tests-online,
// /cuet-previous-year-questions, /cuet-2027) became an article you can scan, with the product in it. The guides' words are
// unchanged. These checks render the real component (swc, with the page chrome stubbed) from each page's own data and hold:
// the section ids (unique, stable, made from the headings), "On this page" (one in-page link per heading), every paragraph and
// every FAQ drawn as visible text (nothing folded but the FAQ answers, as before), the heading outline unchanged, the try band
// (once, after the second section, outlined, to /#try, in the home page's words), and the paper facts card read from the
// shared PAPER constants with the live bank line only when the count is known.
// The rendered looks (390, 360 and 1440, Day and Night, real Chrome, real taps) are in the lane's report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register, createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const load = (rel) => import(pathToFileURL(resolve(root, rel)).href);

const { GUIDE_FAQ_HEADING, TRY_AFTER, TRY_HREF, guideSections, slugify } = await load('src/lib/guideSections.mjs');
const { seoPages } = await load('src/lib/seoPages.js');
const { PAPER } = await load('src/lib/subjectPages.mjs');
const { TRY_HEAD } = await load('src/components/landing/homeCopy.mjs');
const { DESK_NOTE } = await load('src/components/landing/heroTaps.mjs');

// /cuet-2027 keeps its data inside its page file; read the literal from the source (it is plain data).
function pageFromSource(rel) {
  const src = read(rel);
  const start = src.indexOf('const page = {');
  const end = src.indexOf('\n};\n', start);
  assert.ok(start > 0 && end > start, `${rel}: the page literal`);
  return new Function(`return ${src.slice(start + 'const page = '.length, end + 2)}`)();
}
const PAGES = {
  'cuet-mock-test-free': seoPages.freeMockTest,
  'cuet-practice-tests-online': seoPages.practiceTests,
  'cuet-previous-year-questions': seoPages.previousYearQuestions,
  'cuet-2027': pageFromSource('src/app/cuet-2027/page.js'),
};

// ---- The real component, rendered --------------------------------------------------------------------------------------
const ROOT_URL = pathToFileURL(`${root}/`).href;
const reactUrl = pathToFileURL(createRequire(resolve(root, 'package.json')).resolve('react')).href;
const HOOKS = `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const ROOT = ${JSON.stringify(ROOT_URL)};
const REACT = ${JSON.stringify(reactUrl)};
const STUBS = {
  'next/link': "import React from '" + REACT + "'; export default function Link({ href, children, prefetch, ...rest }) { return React.createElement('a', { href, ...rest }, children); }",
  '@/components/NavBar': 'export function NavBar() { return null; }',
  '@/components/MarketingFooter': 'export function MarketingFooter() { return null; }',
  '@/components/PublicDock': 'export function PublicDock() { return null; }',
  '@/components/brand/SubjectObject': 'export function SubjectObject() { return null; }',
  '@/components/doodle/Doodle': 'export function Marked({ text }) { return text; }',
  '@/lib/server/inventory': 'export async function publicInventory() { return null; }',
  'lucide-react': 'export function ChevronRight() { return null; }',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier) && ours(context.parentURL)) return { url: 'stub:' + specifier, shortCircuit: true };
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
let loaded = null;
async function guide() {
  if (loaded) return loaded;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const [mod, React, server] = await Promise.all([load('src/components/SeoContentPage.jsx'), import('react'), import('react-dom/server')]);
  loaded = { ...mod, html: (props) => server.renderToStaticMarkup(React.createElement(mod.GuidePage, props)) };
  return loaded;
}
const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plain = (s) => decode(String(s)).replace(/[  ⁠]/g, ' ').replace(/\s+/g, ' ').trim();
const textOf = (html) => plain(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' '));
const h2s = (html) => [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => plain(m[1].replace(/<[^>]+>/g, '')));

// ---- Section ids ---------------------------------------------------------------------------------------------------------
test('section ids: made from the heading words, unique on each page, and pinned', () => {
  for (const [slug, page] of Object.entries(PAGES)) {
    const toc = guideSections(page);
    assert.equal(toc.length, page.sections.length + 1, `${slug}: one entry per section, then the questions`);
    assert.equal(new Set(toc.map((t) => t.id)).size, toc.length, `${slug}: unique ids`);
    toc.forEach((t, i) => {
      assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${slug}: ${t.id}`);
      assert.equal(t.id, slugify(t.heading), `${slug}: the id is the heading's own words`);
      assert.equal(t.heading, i < page.sections.length ? page.sections[i].heading : GUIDE_FAQ_HEADING);
      assert.equal(t.number, i < page.sections.length ? i + 1 : null);
    });
    assert.deepEqual(guideSections(page), toc, `${slug}: the same ids every time`);
  }
  // Pinned, so a link someone shares to a section keeps working (a heading's words changing is the only thing that moves one).
  assert.deepEqual(guideSections(PAGES['cuet-mock-test-free']).map((t) => t.id), [
    'why-free-cuet-mock-tests-matter', 'what-a-good-cuet-mock-test-should-include', 'how-to-use-mockmob-for-free-cuet-practice',
    'free-mock-test-strategy-for-cuet-ug-2027', 'frequently-asked-questions',
  ]);
  assert.deepEqual(guideSections(PAGES['cuet-2027']).map((t) => t.id), [
    'cuet-2027-expected-timeline', 'exam-pattern-use-the-latest-cycle-as-a-reference', 'choosing-your-five-subjects',
    'a-month-by-month-cuet-2027-plan', 'subject-wise-practice-lanes', 'frequently-asked-questions',
  ]);
  // Two headings with the same words would still get two ids.
  assert.deepEqual(guideSections({ sections: [{ heading: 'Plan' }, { heading: 'Plan!' }] }).map((t) => t.id), ['plan', 'plan-2', 'frequently-asked-questions']);
});

// ---- The rendered guide --------------------------------------------------------------------------------------------------
test('render: every paragraph and every FAQ of every guide is drawn as text, and "On this page" links each section', async () => {
  const { html } = await guide();
  for (const [slug, page] of Object.entries(PAGES)) {
    const out = html({ page, bank: null });
    const text = textOf(out);
    for (const section of page.sections) {
      assert.ok(text.includes(plain(section.heading)), `${slug}: heading ${section.heading}`);
      for (const p of section.body) assert.ok(text.includes(plain(p)), `${slug}: paragraph "${p.slice(0, 40)}"`);
      for (const link of section.links || []) assert.ok(out.includes(`href="${link.href}"`) && text.includes(plain(link.label)), `${slug}: link ${link.href}`);
      for (const chip of section.chips || []) assert.ok(text.includes(plain(chip)), `${slug}: chip ${chip}`);
    }
    for (const faq of page.faqs) {
      assert.ok(text.includes(plain(faq.question)) && text.includes(plain(faq.answer)), `${slug}: faq ${faq.question}`);
    }
    // Nothing is folded but the FAQ answers (closed, as before): one <details> per question, none open.
    assert.equal((out.match(/<details\b/g) || []).length, page.faqs.length, `${slug}: details only for the FAQ`);
    assert.doesNotMatch(out, /<details[^>]*\bopen\b/, `${slug}: every question starts closed`);
    assert.doesNotMatch(out, /<[^>]+\shidden(=|\s|>)|aria-hidden="true"[^>]*>[^<]*[a-z]{4}/i, `${slug}: no paragraph hidden`);
    // The heading outline is the guide's own: its sections, the questions, the close. Nothing new is a heading.
    assert.deepEqual(h2s(out), [...page.sections.map((s) => plain(s.heading)), GUIDE_FAQ_HEADING, 'Reading about it is not practice.'], `${slug}: h2 outline`);
    assert.equal((out.match(/<h1\b/g) || []).length, 1);
    // On this page: one chip per heading, in order, each to a section that exists.
    const toc = guideSections(page);
    const hrefs = [...out.matchAll(/class="gd-toc__chip" href="#([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, toc.map((t) => t.id), `${slug}: chips in order`);
    for (const id of hrefs) assert.equal((out.match(new RegExp(`<section[^>]* id="${id}"`, 'g')) || []).length, 1, `${slug}: #${id} is one section`);
    // Structured data unchanged: the FAQ JSON-LD still holds every question.
    const ld = out.match(new RegExp(`<script id="${page.slug}-faq-json-ld"[^>]*>([\\s\\S]*?)</script>`));
    assert.ok(ld, `${slug}: FAQ JSON-LD`);
    assert.equal(JSON.parse(ld[1]).mainEntity.length, page.faqs.length);
  }
});

test('render: one try band, after the second section, outlined, to /#try, in the home page\'s words', async () => {
  const { html } = await guide();
  assert.equal(TRY_HREF, '/#try');
  assert.equal(TRY_AFTER, 2);
  assert.equal(TRY_HEAD.h2, 'Try five CUET questions.');
  assert.equal(DESK_NOTE, 'Free, no sign-up. Every answer shows its reason.');
  for (const [slug, page] of Object.entries(PAGES)) {
    const out = html({ page, bank: null });
    assert.equal((out.match(/class="gd-try"/g) || []).length, 1, `${slug}: one band`);
    const band = out.slice(out.indexOf('class="gd-try"'), out.indexOf('</aside>', out.indexOf('class="gd-try"')));
    assert.match(band, /<a href="\/#try" class="mm-btn mm-btn--secondary gd-try__key">Try 5 questions first<\/a>/, `${slug}: the outlined key`);
    assert.ok(band.includes('Try five CUET questions.') && band.includes(DESK_NOTE), `${slug}: the words`);
    assert.ok(band.includes('mbposter-guide-'), `${slug}: the home page's Mobi still`);
    const toc = guideSections(page);
    const at = out.indexOf('class="gd-try"');
    assert.ok(out.indexOf(`id="${toc[1].id}"`) < at && at < out.indexOf(`id="${toc[2].id}"`), `${slug}: between sections 2 and 3`);
    // The page keeps one volt key at the top and the close's; the band adds none.
    assert.equal((out.match(/mm-btn--primary/g) || []).length, 2, `${slug}: volt keys`);
  }
});

test('the paper facts card reads the shared PAPER constants; the bank line is drawn only when the count is known', async () => {
  const src = read('src/components/SeoContentPage.jsx');
  assert.match(src, /import \{ PAPER, bankLine \} from '@\/lib\/subjectPages\.mjs';/);
  for (const expr of ['{PAPER.questions}', '{PAPER.minutes}', '+{PAPER.right}', "{String(PAPER.wrong).replace('-', '−')}"]) {
    assert.ok(src.includes(`<dd className="mm-measure">${expr}</dd>`), `the card reads ${expr}`);
  }
  assert.doesNotMatch(src.slice(src.indexOf('gd-facts'), src.indexOf('gd-toc')), /<dd className="mm-measure">[-+−]?\d/, 'no typed number');
  const { html, guideBank } = await guide();
  const page = PAGES['cuet-mock-test-free'];
  const facts = (out) => textOf(out.slice(out.indexOf('gd-facts'), out.indexOf('gd-toc')));
  const without = facts(html({ page, bank: null }));
  assert.ok(without.includes(`Questions ${PAPER.questions} Minutes ${PAPER.minutes} Right answer +${PAPER.right} Wrong answer −${Math.abs(PAPER.wrong)}`), without);
  assert.ok(without.includes(`out of ${PAPER.questions * PAPER.right}`));
  assert.doesNotMatch(without, /live bank/, 'unknown is not zero: no line');
  // The bank: summed over the subjects Practice offers, from the stored daily row only.
  assert.equal(guideBank(null), null);
  assert.equal(guideBank({ state: 'unavailable' }), null);
  assert.equal(guideBank({ state: 'available', subjectCounts: {}, checkedAt: '2026-11-18T01:00:00Z' }), null, 'no count, no line');
  const bank = guideBank({ state: 'available', subjectCounts: { english: 1200, accountancy: 800 }, checkedAt: '2026-11-18T01:00:00Z' });
  assert.deepEqual(bank, { questions: 2000, countedOn: '18 Nov' });
  assert.ok(facts(html({ page, bank })).includes('2,000 CUET questions in the live bank, counted 18 Nov.'));
  // The guide's route refreshes the count hourly, like the subject pages.
  for (const slug of Object.keys(PAGES)) assert.match(read(`src/app/${slug}/page.js`), /\nexport const revalidate = 3600;\n/, slug);
});
