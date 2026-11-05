// The owner's landing checklist, L-001..L-045 (mockmob-next/docs/brain/WEB-OWNER-LEDGER-2026-10-17.md), as tests (4 Nov 2026).
// One test per checkable row, named with the row id; rows only the live site or a human can judge are test.todo with the reason.
// Source-level and pure-module checks, no server and no browser: each test pins the owner's requirement (what must or must not
// be on the page), not how a component is built, so they stay true while the page is polished.
// The live walk (390 and 1440, Night and Day, real Chrome) covers the todo rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/ .*$/gm, '$1');
const stripJsx = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const code = (src) => stripJsx(stripComments(src));

// ---- the landing's own files: everything page.js reaches through imports (components, data, css) ----------------------
const EXT = ['', '.js', '.jsx', '.mjs', '.css', '/index.js', '/index.jsx'];
function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const e of EXT) { const p = base + e; if (existsSync(p) && !/\.(png|svg|webp|json)$/.test(p) && statSyncFile(p)) return p; }
  return null;
}
function statSyncFile(p) { try { return readFileSync(p) && true; } catch { return false; } }
const LANDING = (() => {
  const seen = new Set();
  const queue = [join(ROOT, 'src/app/page.js')];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (/\.css$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:import\s+(?:[^'"]*?from\s+)?|import\()\s*['"]([^'"]+)['"]/g)) {
      const dep = resolveImport(file, m[1]);
      if (dep && !seen.has(dep)) queue.push(dep);
    }
  }
  return [...seen];
})();
const rel = (f) => f.slice(ROOT.length + 1).replace(/\\/g, '/');
const LANDING_REL = LANDING.map(rel);
const isCode = (f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\.|\.generated\.|logoLetters/.test(f);
const LANDING_CODE = LANDING_REL.filter((f) => isCode(f) && f.startsWith('src/'));
// layout.js imports the shared theme and surface sheets for every page, the landing included.
const LANDING_CSS = [...new Set([...LANDING_REL.filter((f) => f.endsWith('.css')), 'src/app/marketing-theme.css', 'src/app/marketing.css'])];
// The shared chrome and the sample card are part of the landing page's surface even where the page imports them lazily.
const SURFACE = [...new Set([...LANDING_CODE.filter((f) => !f.startsWith('src/app/preview/')), 'src/components/NavBar.jsx', 'src/components/LandingActions.jsx', 'src/components/MobileDock.jsx', 'src/components/MarketingFooter.jsx', 'src/components/FooterStart.jsx'])].filter((f) => existsSync(join(ROOT, f)));
const sources = (files) => files.map((f) => `\n/* ${f} */\n${read(f)}`).join('\n');
const cssAll = stripComments(sources(LANDING_CSS));
const PAGE = read('src/app/page.js');
const PAGE_CODE = code(PAGE);
const SURFACE_CODE = code(sources(SURFACE));
const rules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const importMod = (relPath) => import(pathToFileURL(join(ROOT, relPath)).href);

const homeCopy = await importMod('src/components/landing/homeCopy.mjs');
const heroLines = await importMod('src/components/landing/heroLines.mjs');
const labStory = await importMod('src/components/landing/labStory.mjs');
const openingGate = await importMod('src/components/landing/openingGate.mjs');

// Every string the page's copy modules can say: the homeCopy exports (and the tour and the FAQs it builds) and the hero lines.
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}
const OFFERS = [
  { purchasable: 'monthly', monthly: { rupees: 99 }, oneTime: { rupees: 99, expires: '31 July 2027' } },
  { purchasable: 'oneTime', monthly: { rupees: 99 }, oneTime: { rupees: 99, expires: '31 July 2027' } },
];
const COPY = [
  ...strings(Object.entries(homeCopy).filter(([, v]) => typeof v !== 'function').map(([, v]) => v)),
  ...strings(homeCopy.buildTour({ studyLive: true, studyLessons: 4, studySubjects: 2, mobLive: true })),
  ...OFFERS.flatMap((offer) => strings(homeCopy.buildFaqs({ offer, mobLive: true }))),
  ...strings(homeCopy.freePlan({ newOffer: true, firstFullMockItem: 'x' })), ...strings(homeCopy.proPlan({ newOffer: true })),
  ...strings(homeCopy.pricingHead(OFFERS[0])), ...strings(homeCopy.pricingHead(OFFERS[1])),
  ...heroLines.HERO_LINES, ...heroLines.HERO_TYPED,
];
// The words written into JSX of the landing's own components (text between tags and in plain attributes), comments out.
const JSX_TEXT = SURFACE_CODE;
const RENDERED = [...COPY, ...[...JSX_TEXT.matchAll(/>([^<>{}]{3,})</g)].map((m) => m[1]), ...[...JSX_TEXT.matchAll(/(?:aria-label|label|title|note|caption|alt)=["']([^"']{3,})["']/g)].map((m) => m[1]), ...[...JSX_TEXT.matchAll(/'([A-Z][^'\n]{12,})'/g)].map((m) => m[1])];

test('the landing file set was found (guard for the tests below)', () => {
  for (const f of ['src/app/page.js', 'src/components/landing/HeroTyped.jsx', 'src/components/landing/OpeningMo.jsx', 'src/components/landing/ScrollStory.jsx', 'src/components/landing/Statement.jsx', 'src/components/landing/LabCinema.jsx', 'src/components/landing/FeatureTour.jsx']) {
    assert.ok(LANDING_REL.includes(f), `${f} must be reached from page.js`);
  }
  assert.ok(LANDING_CSS.length >= 8, `landing css found: ${LANDING_CSS.length}`);
  assert.ok(COPY.length > 60);
});

// ================================================================================================ L-001 .. L-003 (live only)
test.todo('L-001 the new landing is what www.mockmob.in/ serves in production, and every L item passes on the live URL (needs the live site and a deploy)');
test.todo('L-002 a critic round scores the shipped build at 88 or more and a verifier finds no truth defect (a human or critic judgement; the score report is a file, not source)');
test.todo('L-003 at 390 px every section is composed for the phone first and is at least as impressive as at 1440 px (visual judgement in real Chrome)');

// ================================================================================================ L-004 / L-005 nothing cut
test('L-004 the full feature showcase is still there: every section, the tour, the Lab, the exam screen, the shelf, Compass, DU, pricing, FAQ', () => {
  for (const id of ['try-practice', 'inside-the-lab', 'your-prep', 'score-recovery-lab', 'compass', 'du-eligibility', 'pricing', 'faq', 'on-instagram']) {
    assert.match(PAGE_CODE, new RegExp(`id="${id}"`), `section #${id} is on the page`);
  }
  assert.match(PAGE_CODE, /<ExamScreen\s*\/>/, 'the exam-day screen section is rendered');
  assert.match(read('src/components/landing/ExamScreen.jsx'), /id="exam-experience"/, 'it keeps its anchor');
  for (const part of ['FeatureTour', 'LabCinema', 'MistakeLab', 'Statement', 'CompassLadder', 'CreatorReels', 'LiveStatsBand', 'WallOfLove', 'EligibilityTeaser']) {
    assert.match(PAGE_CODE, new RegExp(`<${part}[\\s/>]`), `<${part} /> is rendered`);
  }
  assert.ok((PAGE_CODE.match(/<section\b/g) || []).length >= 10, 'about a dozen sections, not a short list');
  assert.doesNotMatch(PAGE_CODE, /<SubjectGrid/, 'no plain 15-subject list replaced the showcase');
});

test('L-005 the scroll stories, reveals, count-up and object life of the previous landing still exist and are used', () => {
  for (const f of ['src/components/landing/ScrollStory.jsx', 'src/components/landing/Reveal.jsx', 'src/components/landing/LiveStatsBand.jsx', 'src/components/brand/ObjectLife.jsx', 'src/components/landing/SectionPosition.jsx', 'src/components/brand/PipGuide.jsx']) {
    assert.ok(LANDING_REL.includes(f) || existsSync(join(ROOT, f)), `${f} exists`);
  }
  for (const story of ['FeatureTour', 'LabCinema', 'MistakeLab', 'Statement']) assert.match(read(`src/components/landing/${story}.jsx`), /ScrollStory|useScrollStory|storyController/, `${story} is a held scroll story`);
  assert.match(PAGE_CODE, /<Reveal[\s>]/, 'reveal entrances are kept');
  assert.match(PAGE_CODE, /<PipGuide\s*\/>/, 'the flying guide is kept');
  assert.match(PAGE_CODE, /objectStage|ObjectLife|shelf|SHELF/i, 'the shelf objects are kept');
});

// ================================================================================================ L-006 .. L-010 states and the bottom bar
// Owner decision LK83/LK88 (5 Nov 2026, SPEC night-1105 D1) supersedes the 4 Nov wording of L-006, L-008, L-009, L-010 and
// L-013 (and L-015's card-note link): sign up and log in lead, the five questions are the sample, the dock never relabels.
test('L-006 signed in, the guest CTA is not shown: the hero offers one key back in (the guest CTA is "Sign up free" since LK83)', async () => {
  const demo = await importMod('src/components/landing/demoSignal.mjs');
  const src = code(read('src/components/LandingActions.jsx'));
  assert.match(src, /isAuthenticated/, 'the hero actions read the signed-in state');
  assert.match(src, /const primary = isAuthenticated \? way\.home : way\.signup;/, 'signed in: the way back in; a guest: sign-up');
  assert.match(src, /if \(mode === 'primary' \|\| isAuthenticated\) \{/, 'signed in: one key, no "Try 5 questions first", no log-in line');
  for (const released of [false, true]) {
    const home = demo.wayIn({ signedIn: true, released }).home.label;
    assert.match(home, /^(Go to (Practice|the Arena)|Find my first gap)$/, 'a signed-in label names the way in');
    assert.doesNotMatch(home, /Sign up|Start free|Try/, 'never the guest CTA for someone who is already in');
  }
});

test('L-007 the hero CTA, the nav and the bottom bar each branch on the visitor state, and a signed-in student gets no sign-up or upsell', () => {
  for (const f of ['src/components/LandingActions.jsx', 'src/components/NavBar.jsx', 'src/components/MobileDock.jsx', 'src/components/landing/CloseActions.jsx']) {
    assert.match(read(f), /isAuthenticated/, `${f} branches on isAuthenticated`);
  }
  const nav = code(read('src/components/NavBar.jsx'));
  assert.match(nav, /isAuthenticated \?[\s\S]{0,200}\/dashboard[\s\S]{0,200}Go to Practice/, 'nav: signed in shows Go to Practice');
  // Night 1105 (R2-B): the bar says the home page's words too (LK83/LK88); it said Start free until then.
  assert.match(nav, /Sign up free/, 'nav: a guest gets Sign up free');
  const close = code(read('src/components/landing/CloseActions.jsx'));
  assert.match(close, /isAuthenticated \? homeHref : signupHref/, 'close band: sign up is not offered to a signed-in student');
});
test.todo('L-007 (paid) no paid upsell for a paid student: the landing is a static page that cannot read the plan, so a paid account needs a live walk');

test('L-008 the bottom bar (LK83/LK88): a guest gets two real keys, a ghost "Log in" and the volt "Sign up free"; signed in, one key; no linked text beside them', async () => {
  const demo = await importMod('src/components/landing/demoSignal.mjs');
  assert.match(PAGE_CODE, /<HeroDockGate>\s*<LandingDock \/>\s*<\/HeroDockGate>/, 'the landing mounts the state-aware dock');
  const landingDock = code(read('src/components/landing/LandingDock.jsx'));
  assert.doesNotMatch(landingDock, /<Link|lp-docklink|Try a CUET question/, 'no link of its own beside the keys and no sample key in the dock');
  assert.match(landingDock, /label=\{dock\.primary\.label\}[\s\S]*secondary=\{dock\.secondary\}/, 'both keys come from one resolved state (wayIn)');
  assert.deepEqual(JSON.parse(JSON.stringify(demo.wayIn({}).dock)), { primary: { href: '/signup', label: 'Sign up free' }, secondary: { href: '/login', label: 'Log in' } }, 'a guest');
  assert.equal(demo.wayIn({ signedIn: true }).dock.secondary, null, 'signed in: one key');
  assert.match(demo.wayIn({ signedIn: true }).dock.primary.label, /^(Go to (Practice|the Arena)|Find my first gap)$/, 'signed in: the key goes back in');
  const mobile = code(read('src/components/MobileDock.jsx'));
  assert.match(mobile, /href=\{resolvedHref\}/, 'the volt key\'s label and target come from one resolved state');
  assert.match(mobile, /<Link href=\{secondary\.href\} className="mm-btn mm-dock__ghost">/, 'the ghost key is a real link key');
  assert.match(mobile, /resolvedNote \? <p className="mm-dock__note">/, 'no empty note line');
});

test('L-009 (LK83/LK88) the dock and the close band say "Sign up free" before, during and after the five; the sample\'s own end state offers sign-up', async () => {
  const demo = await importMod('src/components/landing/demoSignal.mjs');
  assert.ok(demo.DEMO_ANSWERED_EVENT && typeof demo.subscribeDemoAnswered === 'function', 'the sample still publishes its signal (the hero key\'s weight, Mobi, the painted sheet)');
  demo.resetDemoSignal();
  const before = JSON.stringify(demo.wayIn({}));
  demo.sendDemoState('five', 5, null);
  assert.equal(JSON.stringify(demo.wayIn({})), before, 'all five answered changes no key');
  demo.resetDemoSignal();
  assert.equal(demo.wayIn({}).dock.primary.label, 'Sign up free');
  for (const f of ['src/components/landing/LandingDock.jsx', 'src/components/landing/CloseActions.jsx']) {
    assert.doesNotMatch(code(read(f)), /subscribeDemoState|demoFinished|Try a CUET question/, `${f} never relabels with the sample`);
  }
  assert.match(code(read('src/components/landing/CloseActions.jsx')), /way\.signup\.label/, 'the close band says Sign up free');
  assert.match(code(read('src/components/landing/DemoDrill.jsx')), /<Link href="\/signup" className="mm-btn mm-btn--primary">/, 'after the fifth answer the card itself offers sign-up');
});

test('L-010 (LK83/LK88) "Try 5 questions first" opens the sample, and sign-up and log-in are reachable from the bottom of the page', async () => {
  const demo = await importMod('src/components/landing/demoSignal.mjs');
  assert.deepEqual({ ...demo.SAMPLE }, { href: '/#try-practice', label: 'Try 5 questions first' }, 'the hero\'s second key points at the sample');
  assert.match(code(read('src/components/LandingActions.jsx')), /<Link href=\{SAMPLE\.href\} prefetch=\{false\}/);
  assert.match(PAGE_CODE, /<DemoJump\s*\/>/, 'DemoJump makes every same-page sample link land on the card');
  assert.match(PAGE_CODE, /id="try-practice"/, 'the sample has its anchor');
  const close = code(read('src/components/landing/CloseActions.jsx'));
  assert.match(close, /signupHref/, 'the close band offers sign up');
  assert.match(close, /way\.login\.href/, 'and log in');
  assert.equal(demo.wayIn({}).signup.href, '/signup');
  assert.equal(demo.wayIn({}).login.href, '/login');
  assert.match(code(read('src/components/MarketingFooter.jsx') + read('src/components/FooterStart.jsx')), /\/signup/, 'the footer offers sign up');
});

test.todo('L-011 at 390 px the bottom button is horizontally centred and does not float apart (needs layout: measure the dock key against the viewport centre in real Chrome; dock_alignment.test.mjs covers the shared dock)');

// ================================================================================================ L-012 .. L-015 top bar, conversion, hero, other subjects
test('L-012 the top bar logo goes home, its section links point at real anchors, and a state-aware conversion CTA sits in the bar', () => {
  assert.match(code(read('src/components/Logo.jsx')), /href = '\/'/, 'the logo defaults to /');
  assert.match(code(read('src/components/NavBar.jsx')), /<Logo[\s>]/, 'the bar draws it');
  const nav = code(read('src/components/NavBar.jsx'));
  const hashLinks = [...nav.matchAll(/href: '\/#([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(hashLinks.length >= 1);
  for (const id of hashLinks) assert.match(PAGE + sources(SURFACE), new RegExp(`id=["']${id}["']`), `nav link /#${id} has a target`);
  assert.match(nav, /Sign up free/);
  assert.match(nav, /Go to Practice/);
});

test('L-013 conversion paths (LK83/LK88): sign-up from the hero, the dock, the close band and the footer; log-in from the hero, the dock and the close band; the sample from the hero; no CTA is a dead link', async () => {
  const demo = await importMod('src/components/landing/demoSignal.mjs');
  const hero = PAGE_CODE.slice(PAGE_CODE.indexOf('className="lp-hero"'), PAGE_CODE.indexOf('<Statement'));
  const actions = code(read('src/components/LandingActions.jsx'));
  assert.match(actions, /way\.signup/, 'hero: sign-up');
  assert.match(actions, /way\.login\.href/, 'hero: log in');
  assert.match(actions, /SAMPLE\.href/, 'hero: the sample');
  assert.match(hero, /id="try-practice"/, 'the sample is in the hero');
  assert.deepEqual([demo.wayIn({}).signup.href, demo.wayIn({}).login.href, demo.SAMPLE.href], ['/signup', '/login', '/#try-practice']);
  assert.deepEqual([demo.wayIn({}).dock.secondary.href, demo.wayIn({}).dock.primary.href], ['/login', '/signup'], 'the dock: log in, then sign up');
  for (const route of ['src/app/signup', 'src/app/login']) assert.ok(existsSync(join(ROOT, route)), `${route} exists`);
  assert.match(PAGE_CODE, /<HeroDockGate>[\s\S]*<LandingDock/, 'the phone dock');
  assert.match(PAGE_CODE, /<CloseActions\s*\/>/, 'the close band');
  assert.match(PAGE_CODE, /<MarketingFooter/, 'the footer');
  // No dead anchors: every in-page #id link points at an id that exists in the landing's own markup.
  const ids = new Set([...(PAGE + sources(SURFACE)).matchAll(/\bid=["']([\w-]+)["']/g)].map((m) => m[1]));
  for (const m of (PAGE_CODE + sources(SURFACE_CODE ? SURFACE : [])).matchAll(/href=["']\/?#([\w-]+)["']/g)) assert.ok(ids.has(m[1]) || /^mbp-/.test(m[1]), `#${m[1]} has a target`);
  assert.doesNotMatch(PAGE_CODE, /href=["']#["']|href=["']["']|href=\{["']#["']\}/, 'no placeholder href');
});

test('L-014 the hero says its message at first glance (a short headline and one sentence, not a bombardment) and nothing else was removed', () => {
  const words = (s) => (String(s).match(/\S+/g) || []).length;
  const first = `${heroLines.HERO_SENTENCE} ${homeCopy.HERO_LEAD.strong}${homeCopy.HERO_LEAD.rest}`;
  assert.ok(words(first) <= 40, `headline plus lead is ${words(first)} words`);
  assert.match(PAGE_CODE, /<h1 className="lp-title"/, 'one h1');
  assert.equal((PAGE_CODE.match(/<h1\b/g) || []).length, 1);
  assert.match(PAGE_CODE, /<LandingActions\s*\/>/, 'one action pair');
});

test('L-015 a visitor whose subjects are not among the five samples has a clear path from the hero: its volt key is "Sign up free" (LK83/LK88: the card note lost its link)', async () => {
  const demo = await importMod('src/components/landing/demoSignal.mjs');
  const hero = PAGE_CODE.slice(PAGE_CODE.indexOf('className="lp-hero"'), PAGE_CODE.indexOf('<Statement'));
  assert.match(hero, /<LandingActions\s*\/>/);
  assert.equal(demo.wayIn({}).signup.label, 'Sign up free', 'the first key in the hero is sign-up, where a student picks their own subjects');
  assert.match(code(read('src/components/LandingActions.jsx')), /const primary = isAuthenticated \? way\.home : way\.signup;/);
  assert.match(hero, /<DemoDrill note="No sign-up for these five\." \/>/, 'the card\'s note is one even line, no link that wraps alone');
  assert.match(code(read('src/components/landing/DemoDrill.jsx')), /\{note\}/, 'and the card renders it under the options');
  assert.match(hero, /cuet-cutoff-calculator/, 'plus the free calculator that needs no subject match');
});

// ================================================================================================ L-016 .. L-018 hero headline
test('L-016 the headline types ONE pass and rests; it never loops, has no forever caret, is not glass and has no glow', () => {
  const typed = heroLines.HERO_TYPED;
  assert.ok(typed.length >= 1);
  assert.equal(heroLines.HERO_SLOT_PHRASES.at(-1), heroLines.HERO_LINES[2], 'it rests on the approved sentence');
  const src = code(read('src/components/landing/HeroTyped.jsx'));
  assert.doesNotMatch(src, /setInterval|while\s*\(\s*true|iteration-count:\s*infinite|\bloop\s*[:=]\s*true/, 'no loop');
  assert.match(src, /mm:hero-typed|requestAnimationFrame|setTimeout/, 'it is driven once');
  const plan = heroLines.typingPlan();
  assert.ok(plan && (Array.isArray(plan) ? plan.length : Object.keys(plan).length) > 0);
  const titleCss = rules(cssAll).filter((r) => /lp-title|lp-typed|lp-hero.*caret|hero-typed|lp-caret/.test(r.sel)).map((r) => r.body).join('\n');
  assert.doesNotMatch(titleCss, /backdrop-filter|box-shadow:\s*0 0|text-shadow|infinite/, 'no glass, no glow, no forever animation on the headline');
});

test('L-017 "CUET 2027." in the hero is the brand colour, not plain text', () => {
  assert.equal(heroLines.HERO_LINES[0], 'CUET 2027.');
  assert.match(PAGE_CODE, /className="lp-title__line lp-title__brand">\{HERO_LINES\[0\]\}/);
  const rule = rules(cssAll).filter((r) => /lp-title__brand/.test(r.sel) && /color\s*:/.test(r.body));
  assert.ok(rule.length > 0 && rule.every((r) => /--brand-word|--accent-text|#[0-9a-f]{6}/i.test(r.body)), 'it is coloured');
  assert.ok(!rule.some((r) => /color:\s*(var\(--ink\)|inherit)\s*;/.test(r.body)), 'not plain ink');
  // D2 (owner LK82, 5 Nov 2026): the brand volt itself, true volt in Night and the deep olive in Day, with set figures; never the
  // old lamp-lit #CDDD5A / #526700 (docs/design-decisions/web-1105-hero.md).
  const hero = rules(stripComments(read('src/app/hero-scene.css'))).filter((r) => /\.lp-hero \.lp-title__brand/.test(r.sel));
  assert.ok(hero.some((r) => !/light/.test(r.sel) && /color:\s*#d2f000/i.test(r.body)), 'Night: #D2F000');
  assert.ok(hero.some((r) => /data-theme='light'/.test(r.sel) && /color:\s*#3f5200/i.test(r.body)), 'Day: #3F5200');
  assert.ok(hero.some((r) => /font-variant-numeric:\s*lining-nums tabular-nums/.test(r.body)), 'lining, tabular figures');
  assert.doesNotMatch(hero.map((r) => r.body).join('\n'), /cddd5a|526700|--brand-word/i);
});

test('L-018 "CUET 2027" is not styled as, or made into, a button that only scrolls down', () => {
  assert.doesNotMatch(PAGE_CODE, /<(button|a|Link)\b[^>]*>\s*\{?(HERO_LINES\[0\]|'?CUET 2027)/, 'not inside a button or link');
  assert.doesNotMatch(PAGE_CODE, /lp-title__brand"[^>]*(onClick|href|role="button")/);
  const rule = rules(cssAll).filter((r) => /lp-title__brand/.test(r.sel)).map((r) => r.body).join('\n');
  assert.doesNotMatch(rule, /cursor:\s*pointer|border(-radius)?:\s*[1-9]|padding:\s*[^;]*[1-9]/, 'no button chrome');
});

// ================================================================================================ L-019 / L-020 no AI-slop effects
const VOLTISH = /(volt|accent|brand|lime|d2f000|c8ff|cddd5a|bfe|rgba?\(\s*(210|205|19\d|20\d)\s*,\s*2[0-4]\d)/i;
test('L-019 no glow around buttons or anything else: no coloured or zero-offset glow box-shadow, no drop-shadow glow, no text-shadow glow', () => {
  const offenders = [];
  for (const r of rules(cssAll)) {
    for (const m of r.body.matchAll(/(?:^|;|\s)(box-shadow|filter|text-shadow)\s*:\s*([^;]+)/g)) {
      const value = m[2];
      if (/^\s*(none|var\(--sh-\d\)|inherit|initial)\s*$/i.test(value)) continue;
      if (m[1] === 'filter' && !/drop-shadow/.test(value)) continue;
      const layers = value.split(/,(?![^(]*\))/);
      for (const layer of layers) {
        const toks = layer.trim().split(/\s+(?![^(]*\))/).filter((t) => !/^inset$/.test(t));
        const lens = [];
        for (const t of toks) { if (/^-?[\d.]+(px|rem|em)?$/.test(t)) lens.push(parseFloat(t)); else break; }
        const [x = 0, y = 0, blur = 0] = lens;
        const coloured = VOLTISH.test(layer);
        if (blur > 0 && coloured) offenders.push(`${r.sel} { ${m[1]}: ${layer.trim()} } (coloured blur)`);
        else if (blur > 0 && x === 0 && y === 0 && m[1] !== 'filter' && !/rgba?\(\s*0\s*,\s*0\s*,\s*0/.test(layer)) offenders.push(`${r.sel} { ${m[1]}: ${layer.trim()} } (zero-offset halo)`);
        else if (m[1] === 'filter' && blur > 0 && coloured) offenders.push(`${r.sel} { ${layer.trim()} }`);
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('L-019 no sheen sweep, no light running around an edge, no drifting glow blobs', () => {
  const keyframes = [...cssAll.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  // du-shimmer is the DU teaser's loading skeleton (four passes, then still), not a sheen on a control.
  const bad = keyframes.filter(([, name]) => name !== 'du-shimmer').filter(([, name, body]) => /sheen|shine|shimmer|glint|glow|aurora|blob|orbit|halo|conic|spin-border|border-run/i.test(name) || /conic-gradient|--angle|--sheen/.test(body));
  assert.deepEqual(bad.map((k) => k[1]), [], 'sheen, sweep or running-light keyframes');
  assert.doesNotMatch(cssAll, /conic-gradient\([^)]*(from var\(--|from calc)/, 'no rotating conic edge light');
  assert.doesNotMatch(cssAll, /@property\s+--(angle|sheen|spin)/, 'no animated gradient-angle property');
  const blur = rules(cssAll).filter((r) => /filter:\s*blur\(\s*(\d{2,}|[3-9])\d*px/.test(r.body) && /(blob|orb|aura|glow|aurora|spot|halo|lp-bg)/i.test(r.sel));
  assert.deepEqual(blur.map((r) => r.sel), [], 'no large blurred blobs');
  assert.doesNotMatch(code(sources(SURFACE)), /className="[^"]*\b(lp-sheen|btn-sheen|mm-sheen|lp-glow|btn-glow|lp-orb|lp-blob|lp-aurora)\b/);
});

test('L-019 no gradient text anywhere on the landing', () => {
  assert.doesNotMatch(cssAll, /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/i);
  assert.doesNotMatch(cssAll, /-webkit-text-fill-color\s*:\s*transparent/i);
});

test('L-020 no eyebrow pill or label with a dot (pulsing or static), no kicker above headings, no decorative icon row', () => {
  const markup = code(sources(SURFACE));
  assert.doesNotMatch(markup, /className="[^"]*\b(eyebrow|lp-eyebrow|mm-eyebrow|lp-kicker|mm-kicker|lp-pill|mm-pill|lp-chip-dot|pulse-dot|lp-dot|live-dot)\b[^"]*"/, 'no eyebrow, kicker, pill or dot element in landing markup');
  const css = rules(cssAll);
  const dotted = css.filter((r) => !/\.xs-/.test(r.sel)).filter((r) => /::before|::after/.test(r.sel) && /(eyebrow|kicker|pill|badge|chip)/.test(r.sel) && /border-radius:\s*(50%|999|9999)/.test(r.body) && /(width|height):\s*(\d(\.\d+)?px|0\.[3-6]r?em)/.test(r.body));
  assert.deepEqual(dotted.map((r) => r.sel), [], 'no dot drawn before a label');
  assert.doesNotMatch(cssAll, /@keyframes\s+[\w-]*(pulse|ping|blink-dot|live)[\w-]*/i, 'no pulsing dot keyframes');
  assert.doesNotMatch(markup, /<span className="[^"]*\bdot\b[^"]*"\s*(aria-hidden="true")?\s*\/>(?=[^<]{0,3}[A-Za-z])/, 'no dot span before a label');
});

// ================================================================================================ L-021 .. L-023 copy and positioning
test('L-021 the hero copy and Mobi render fully on every load: the copy is in source (server-rendered), the poster is server-drawn, nothing is fetched', () => {
  assert.ok(homeCopy.HERO_LEAD.strong.length > 10 && homeCopy.HERO_LEAD.rest.length > 10);
  assert.match(PAGE_CODE, /<b>\{HERO_LEAD\.strong\}<\/b>\{HERO_LEAD\.rest\}/);
  assert.match(PAGE_CODE, /<MobiPoster id="desk"/, 'Mobi has a server-rendered first frame');
  const heroFiles = ['src/components/landing/HeroMobi.jsx', 'src/components/landing/HeroTyped.jsx', 'src/components/landing/HeroRoom.jsx'].map((f) => code(read(f))).join('\n');
  assert.doesNotMatch(heroFiles, /fetch\(|\.json['"]\)|XMLHttpRequest/, 'no runtime copy file that can fail to load');
  assert.ok(heroLines.HERO_LINES.every((l) => l.length > 3));
  assert.match(code(read('src/components/landing/HeroTyped.jsx')), /HERO_LINES\[2\]|HERO_LINES/, 'the typed line has its server text');
});

test('L-022 no floating subtext lines "Built first for commerce", "CUET commerce" or "English" thrown around', () => {
  const all = COPY.join('\n') + PAGE_CODE;
  assert.doesNotMatch(all, /Built first for commerce/i);
  assert.doesNotMatch(PAGE_CODE, />\s*(CUET commerce|English)\s*</i, 'no bare subtext element');
  for (const s of COPY) assert.ok(!/^(CUET commerce|English)\.?$/i.test(s.trim()), `stray line: ${s}`);
});

test('L-023 commerce-first positioning is clear: the commerce subjects lead the shelf and the copy names Commerce', () => {
  const claim = read('data/subject_claim.js');
  assert.match(COPY.join(' ') + claim + PAGE_CODE, /commerce/i, 'the landing names Commerce');
  const shelf = PAGE_CODE.slice(PAGE_CODE.indexOf('const SHELF'), PAGE_CODE.indexOf('const MOB_LIVE'));
  for (const id of ['accountancy', 'business_studies', 'economics']) assert.match(shelf, new RegExp(`id: '${id}'`), `${id} is on the shelf`);
  assert.match(shelf, /id: 'english'/, 'English too');
});

// ================================================================================================ L-024 .. L-025 defensive fine print and anti-slop copy
const FINE_PRINT = /illustrative|not a prediction|not an? (admission )?prediction|example only|not affiliated|just a diagnostic|for illustration|sample data only|demo data/i;
test('L-024 no defensive fine print in the landing text ("illustrative", "not a prediction", "example only", "not affiliated", "just a diagnostic")', () => {
  const hits = RENDERED.filter((s) => FINE_PRINT.test(s));
  assert.deepEqual([...new Set(hits)], [], 'rendered landing text');
  const jsxHits = [];
  for (const f of SURFACE.filter((x) => !/ChapterReadout|ProductScreens|RecoveryPreview/.test(x) || LANDING_REL.includes(x))) {
    const body = code(read(f));
    for (const m of body.matchAll(/(["'`>])((?:(?!\1)[^\n])*?)(illustrative|not a prediction|example only|not affiliated|just a diagnostic)/gi)) jsxHits.push(`${f}: ${m[3]}`);
  }
  assert.deepEqual(jsxHits, [], 'strings in the components the page renders');
});

test('L-024 no defensive fine print on the other public pages either (terms, privacy, pricing, about, subject pages)', () => {
  const pages = ['src/app/terms/page.js', 'src/app/privacy/page.js', 'src/app/pricing/page.js', 'src/app/about/page.js', 'src/app/cuet-mock-test-free/page.js', 'src/app/cuet-cutoff-calculator/page.js', 'src/app/cuet-subject-combination/page.js', 'src/components/subject/SubjectLandingPage.jsx'].filter((f) => existsSync(join(ROOT, f)));
  const hits = [];
  for (const f of pages) for (const m of code(read(f)).matchAll(/not affiliated|just a diagnostic|not a prediction|example only|illustrative/gi)) hits.push(`${f}: ${m[0]}`);
  assert.deepEqual(hits, [], 'every public page, as the owner asked (12 Oct, 15 Oct)');
});

test('L-025 the copy reads like a person, not a template: no slop words, no middle dots, no exclamation marks, no "not just" contrasts, sentence case headings', () => {
  const text = COPY.join('\n');
  assert.doesNotMatch(text, /\b(seamless(ly)?|unlock|elevate|supercharge|game-?changer|revolutionary|cutting-edge|leverage|empower|next-level|delve|journey|world-class|state-of-the-art)\b/i);
  assert.doesNotMatch(text, /·|•/, 'no middle dots as separators');
  assert.doesNotMatch(text, /!/, 'no exclamation marks');
  assert.doesNotMatch(text, /\bnot just\b/i);
  for (const key of ['LAB_HEAD', 'TOUR_HEAD', 'RECOVERY_HEAD', 'COMPASS_HEAD', 'DU_HEAD', 'EXAM_HEAD', 'INSTAGRAM_HEAD', 'WALL_HEAD', 'FAQ_HEAD']) {
    const h2 = homeCopy[key].h2;
    assert.ok(!/\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+/.test(h2.replace(/MockMob|Mistake Lab|Score Recovery Lab|NTA/g, '')), `sentence case: ${h2}`);
  }
});
test.todo('L-025 one design theme matching the app and a 12-part anti-slop score toward 90 (a critic judgement; tmp/home-1104/slop holds the capture)');

// ================================================================================================ L-026 .. L-030 held stories
test('L-026 the Time / Changes / Repairs / What showcase pins and steps at 390 px exactly like desktop: it is a ScrollStory and no phone rule stacks it', () => {
  assert.match(code(read('src/components/landing/LabCinema.jsx')), /ScrollStory/);
  const css = stripComments(read('src/app/scroll-story.css'));
  const phone = [...css.matchAll(/@media[^{]*max-width:\s*(\d+)px[^{]*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  for (const [, , body] of phone) {
    for (const r of rules(body)) {
      if (/\.ss__stage/.test(r.sel)) assert.doesNotMatch(r.body, /position:\s*static/, `${r.sel}: stacked on a phone`);
      if (/\.ss__track/.test(r.sel)) assert.doesNotMatch(r.body, /height:\s*auto/, `${r.sel}: unpinned on a phone`);
    }
  }
  assert.doesNotMatch(stripComments(read('src/app/lab-cinema.css')), /@media[^{]*max-width[^{]*\{[^}]*\.ss__(track|stage)[^}]*(position:\s*static|height:\s*auto)/);
});

test('L-027 one gesture advances one slide: the gesture model commits at most one step per flick and swallows the follow-up; a wheel burst is one step', async () => {
  const g = await importMod('src/components/landing/storyGesture.mjs');
  assert.ok(g.LOCK_MS >= 300, `a step locks the next ${g.LOCK_MS} ms`);
  assert.ok([1, -1].includes(g.commitDirection(400, 3)) || g.commitDirection(400, 3) === 1, 'a fast long flick is one direction');
  assert.ok(Math.abs(g.commitDirection(900, 9)) <= 1, 'the commit is a direction (one step), never a distance');
  assert.equal(g.keyDirection('ArrowDown'), 1);
  assert.ok(existsSync(join(ROOT, 'src/components/landing/oneGesture.test.mjs')), 'the gesture matrix test exists');
  const ctrl = code(read('src/components/landing/storyController.mjs'));
  assert.match(ctrl, /goTo\(s,\s*(s\.\w+|[\w.]+)\s*[+-]\s*dir\)|step\s*\+\s*dir|\+ ?dir|dir \* 1/, 'a gesture moves the story by a direction, not by travelled distance');
});

test('L-028 "What\'s inside MockMob" is a held story that moves one slide per gesture (paced by the shared gesture lock, not by scroll distance)', () => {
  const tour = code(read('src/components/landing/FeatureTour.jsx'));
  assert.match(tour, /ScrollStory/);
  assert.ok(homeCopy.buildTour({ studyLive: true, studyLessons: 4, studySubjects: 2, mobLive: true }).length >= 6, 'its slides are all still there');
  const g = readFileSync(join(ROOT, 'src/components/landing/storyGesture.mjs'), 'utf8');
  assert.match(g, /LOCK_MS\s*=\s*(4\d\d|[5-9]\d\d)/, 'a step swallows the next 400 ms or more of input');
});
test.todo('L-028 a readable dwell per slide on the tour ("much slower than before"): a felt-speed judgement in real Chrome (scroll/RESULTS.md has the bench)');

test('L-029 the statement, the Mistake Lab, the tour and the Recovery Lab hold the screen and step their content, so one fast flick cannot skip them', () => {
  for (const f of ['Statement', 'LabCinema', 'FeatureTour', 'MistakeLab']) assert.match(code(read(`src/components/landing/${f}.jsx`)), /ScrollStory/, `${f} is a held story`);
  assert.match(PAGE_CODE, /<Statement\b/);
  assert.match(PAGE_CODE, /<MistakeLab\b/);
  assert.match(stripComments(read('src/app/scroll-story.css')), /position:\s*sticky/, 'held by a sticky stage');
});

test('L-030 the tour\'s name carries "MockMob" in the brand colour (green in Night, olive in Day), the heading is the tour\'s own and attaches to the next section', () => {
  assert.match(PAGE_CODE, /name: <>What’s inside <em>MockMob<\/em><\/>/, 'the position band names it with MockMob emphasised');
  assert.match(cssAll, /\.lp-pos__name em\s*\{[^}]*color:\s*var\(--brand-word\)/);
  assert.match(homeCopy.TOUR_HEAD.h2, /^What’s inside MockMob\.?$/);
  assert.match(PAGE_CODE, /id="your-prep"[\s\S]{0,400}<FeatureTour/, 'heading and tour are one section');
});

// ================================================================================================ L-031 .. L-032 phone composition
test.todo('L-031 at 390 px each screen fills the viewport with no dead space at the bottom and key content in the upper two thirds (layout: measure in real Chrome; landingPosition.test.mjs covers the story heights)');

test('L-032 Repair and SWOT scene text is short per scene so it can be set at a readable size on a phone', () => {
  const words = (s) => (String(s).match(/\S+/g) || []).length;
  for (const scene of homeCopy.LAB_SCENES) {
    assert.ok(words(`${scene.title} ${scene.body}`) <= homeCopy.COPY_BUDGET.step, `${scene.key}: ${words(`${scene.title} ${scene.body}`)} words`);
  }
  for (const step of homeCopy.RECOVERY_STEPS) assert.ok(words(step.body) <= homeCopy.COPY_BUDGET.step);
  const css = stripComments(read('src/app/lab-cinema.css'));
  const tiny = [...css.matchAll(/(?<![\w-])font-size:\s*([\d.]+)(px|rem)/g)].filter(([, n, u]) => (u === 'px' ? +n : +n * 16) < 11);
  assert.deepEqual(tiny.map((m) => m[0]), [], 'no text below 11 px in the Lab scenes');
});

// ================================================================================================ L-033 .. L-036 the Time / Lab demo
test('L-033 no demo question time above about 3 minutes and no 10 to 14 minute time on a question', () => {
  const longest = Math.max(...labStory.SESSION.map((r) => r.sec));
  assert.ok(longest <= 200, `longest sample question is ${longest} s (about 3 minutes at most; the row says "about 3 minutes")`);
  for (const r of labStory.SESSION.filter((x) => x.change)) {
    assert.ok(r.change.toAt - r.change.at <= 120, `question ${r.n}: second thought within two minutes of the first pick`);
    assert.ok(r.change.toAt - r.change.at <= r.sec, `question ${r.n}: the change happens inside its own visit`);
  }
  const typed = RENDERED.filter((s) => /\b1[0-4]:\d\d\b|\b1[0-4] min(ute)?s?\b/.test(s) && !/Exam|mock|paper|60/i.test(s));
  assert.deepEqual(typed, [], 'no hand-typed 10 to 14 minute values in the landing text');
  const facts = labStory.labStory();
  for (const row of labStory.longestQuestions()) assert.ok(parseInt(row.time, 10) < 4, `longest list shows ${row.time}`);
  assert.ok(facts);
});

test('L-034 time-per-question bars differ: some under and some over the pace line, with matching feedback text', () => {
  const rows = labStory.paceRows();
  const over = rows.filter((r) => r.over > 0);
  const under = rows.filter((r) => r.over === 0);
  assert.ok(over.length >= 2 && under.length >= 2, `${over.length} over, ${under.length} under`);
  assert.ok(new Set(rows.map((r) => Math.round(r.base * 100))).size >= 4, 'bars have different heights');
  const time = homeCopy.LAB_SCENES.find((s) => s.key === 'time');
  assert.match(`${time.body} ${time.take}`, /(over|ran over|pace)/i);
  assert.match(time.take, /(quick|under|right)/i, 'feedback names what the under-pace answers did');
});

test('L-035 the answer-change scene shows B (the first, right pick) kept as a green check, the path to D crossed out and D in red', () => {
  const changes = labStory.answerChanges();
  assert.ok(changes.some((c) => c.from === 'B' && c.to === 'D' && c.fromVerdict === 'right'), 'the B to D change is in the story');
  const scenes = sources(['src/components/landing/LabCinema.jsx', 'src/components/landing/TourScreens.jsx', 'src/components/landing/MistakeLab.jsx']).replace(/\/\*[\s\S]*?\*\//g, '');
  const css = stripComments(read('src/app/lab-cinema.css') + read('src/app/mistake-lab.css') + read('src/app/tour-screens.css'));
  assert.match(scenes + css, /line-through|strike|cross/i, 'a crossed-out path');
  assert.match(scenes, /Check|check/, 'a check mark');
  assert.match(css, /(--s-good|--right|--good|#1f9d55|var\(--ok\)|--mm-right|green)/i, 'right is green');
  assert.match(css, /(--s-bad|--wrong|--bad|--danger|var\(--err|red)/i, 'wrong is red');
});

test.todo('L-036 the Smart analysis and Replay graphics are self-explanatory and nothing in Replay is broken or meaningless (a human look at the live scenes)');

// ================================================================================================ L-037 .. L-039
test.todo('L-037 the 3D calculator behind the accountancy mock behaves identically at 1440 and 390 (a rendering check in real Chrome; the source has no separate phone-only variant to assert)');

test('L-038 the subject object shelf has the four launch subjects, big enough, and its motion is eased (cubic-bezier / ease), never linear snapping', () => {
  const shelf = PAGE_CODE.slice(PAGE_CODE.indexOf('const SHELF'), PAGE_CODE.indexOf('const MOB_LIVE'));
  for (const id of ['english', 'accountancy', 'business_studies', 'economics']) assert.match(shelf, new RegExp(`id: '${id}'`));
  const css = stripComments(read('src/app/home.css'));
  const shelfKeyframes = [...css.matchAll(/(?:\.lp-shelf[^{]*|\.lp-stmt[^{]*)\{[^}]*animation[^}]*\}/g)].map((m) => m[0]).join('\n');
  assert.match(css + shelfKeyframes, /cubic-bezier\(/, 'eased with a curve');
  assert.doesNotMatch(shelfKeyframes, /animation[^;]*\blinear\b(?![^;]*(marquee|infinite))/, 'no linear shelf motion');
  assert.match(css, /--shelf-obj:\s*[^;]*(vw|rem)/, 'the object size is a set variable');
});

test('L-039 Mobi is on the landing (hero, seats in the sections, the flying guide)', () => {
  assert.match(PAGE_CODE, /<HeroMobi\b/);
  assert.ok((PAGE_CODE.match(/<MascotSeat\b/g) || []).length >= 4, 'seats in the sections');
  assert.match(PAGE_CODE, /<PipGuide\s*\/>/);
  assert.match(PAGE_CODE, /<MobiPoseSprite\s*\/>/);
  assert.match(code(read('src/components/landing/HeroMobi.jsx')), /MobiReact/, 'the rigged Mobi');
});
test.todo('L-039 Mobi\'s homepage motion is visibly better than the 15 October version (purposeful and smooth: an owner judgement on the live page)');

// ================================================================================================ L-040 performance
test('L-040 animation cost is bounded: off-screen sections are skipped by the browser, story listeners are passive outside the held window, nothing animates layout, no forever loops except the marquee', () => {
  assert.match(cssAll, /content-visibility:\s*auto/, 'long sections use content-visibility');
  const offenders = [];
  for (const f of LANDING_CODE.filter((x) => !/ScrollStory|storyController|storyGesture|scrollBus|oneGestureBench/.test(x))) {
    for (const m of code(read(f)).matchAll(/addEventListener\(\s*['"](scroll|wheel|touchmove|touchstart)['"][^)]*\)/g)) {
      if (!/passive:\s*true/.test(m[0])) offenders.push(`${f}: ${m[0].slice(0, 70)}`);
    }
  }
  assert.deepEqual(offenders, [], 'non-passive scroll listeners outside the held stories');
  const layoutAnim = [...cssAll.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].filter(([, , b]) => /\b(width|height|top|left|margin[\w-]*|padding[\w-]*)\s*:/.test(b)).map((m) => m[1]);
  assert.deepEqual(layoutAnim.filter((n) => !/^(lp-unclip|mo-)/.test(n)), [], 'keyframes that animate layout properties');
});
test('L-040 a Mobi nobody can see does not tick: the hidden desktop flyer and the hidden seat rigs pause their breath (ship gate: 165 restyles a second on an idle hero at 1440 before)', () => {
  const css = stripComments(read('src/app/brand-pip.css'));
  // The breath rule sets the animation shorthand at (0,4,0); the flyer's pause must match it at (0,4,0) or more and come later.
  const breath = css.indexOf("[data-pip-guide] :is(.pip-rig__breath, .pip-actor[data-alive] .pip-art-direction)");
  const flyer = css.indexOf("[data-pip-guide] .pip-guide-flyer[data-pip-shown='false'] :is(.pip-actor, .pip-actor__float, .pip-art-direction, .pip-eye__ball)");
  assert.ok(breath > 0 && flyer > breath, 'the hidden flyer pause comes after the breath rule, at its specificity');
  assert.match(css, /\[data-pip-guide='on'\] \.pip-seat\[data-pip-station\] \.pip-seat__art > \.pip-rig :is\(\.pip-rig__breath, \.pip-eye__ball\),\s*\[data-pip-guide='on'\] \.pip-seat\[data-pip-station\] \.pip-seat__art > \.pip-rig \{ animation-play-state: paused; \}/, 'desktop seat rigs (hidden behind the flyer) are paused');
});
test.todo('L-040 a fast flick-scroll top to bottom shows no glitch, flicker or missed reveal, and a Lighthouse/perf trace shows the cost down (needs real Chrome and a trace)');

// ================================================================================================ L-041 the one central bank
test('L-041 the landing says plainly that every mock comes fresh from one live central bank with no cap on Pro, prominently but not as a banner, and never promises "never repeats"', () => {
  const faqText = OFFERS.flatMap((offer) => homeCopy.buildFaqs({ offer, mobLive: true })).map((f) => f.answer).join(' ');
  assert.match(faqText, /built fresh from one live question bank/i, 'one live bank, fresh mocks');
  assert.match(faqText, /Pro has no cap/i, 'no cap on Pro');
  assert.match(heroLines.HERO_TYPED.join(' '), /Fresh every time/i, 'it is in the headline sequence too');
  assert.match(PAGE_CODE, /<QuestionBankLine\b/, 'the live bank line sits in the hero');
  const everything = COPY.join('\n') + sources(SURFACE) + read('data/subject_claim.js');
  assert.doesNotMatch(everything, /never repeats?|never see(s)? the same|never (get|see) a repeat|zero repeats|no repeats/i);
  assert.doesNotMatch(PAGE_CODE, /className="[^"]*(banner|announce)/i, 'not a loud banner');
});

// ================================================================================================ L-042 .. L-045
test('L-042 what he approved is still there: Mobi, the time section, the approved line, logo B and its animations', () => {
  assert.equal(heroLines.HERO_LINES[2], 'Know what to fix.');
  assert.ok(homeCopy.LAB_SCENES.some((s) => s.key === 'time'), 'the time scene');
  assert.match(code(read('src/components/Logo.jsx')), /logo-b__dot/, 'logo B with its dot');
  assert.match(PAGE_CODE, /<HeroMobi\b/);
  assert.match(PAGE_CODE, /<OpeningMo\s*\/>/, 'the logo opening');
});

test('L-043 the logo opening uses logo B and lasts about 1.3 s per session (1.6 s on a first visit), is skippable, and never holds a student', () => {
  assert.ok(openingGate.OPENING_SHORT_MS >= 1200 && openingGate.OPENING_SHORT_MS <= 1400, `session opening ${openingGate.OPENING_SHORT_MS} ms`);
  assert.ok(openingGate.OPENING_FIRST_MS >= 1500 && openingGate.OPENING_FIRST_MS <= 1700, `first-visit opening ${openingGate.OPENING_FIRST_MS} ms`);
  assert.ok(openingGate.OPENING_FIRST_MS > openingGate.OPENING_SHORT_MS);
  for (const e of ['pointerdown', 'touchstart', 'wheel', 'keydown']) assert.ok(openingGate.OPENING_SKIP_EVENTS.includes(e), `${e} skips it`);
  const gate = openingGate.openingGate.toString();
  assert.match(gate, /prefers-reduced-motion/, 'reduced motion skips');
  assert.match(gate, /referrer/, 'coming back from inside the site skips');
  assert.match(gate, /sessionStorage/, 'once per session');
  assert.match(gate, /webdriver/, 'bots skip');
  const opening = read('src/components/landing/OpeningMo.jsx');
  assert.match(opening, /LOGO_DOT/, 'logo B keeps its dot in the opening');
  assert.match(code(read('src/app/opening.css')), /visibility:\s*hidden/, 'it ends hidden by itself, even if JS fails');
  assert.match(PAGE_CODE, /<OpeningMo\s*\/>/);
});

test('L-044 no Higgsfield or video scene is live on the landing; the scroll scenes are SVG/Mobi', () => {
  assert.doesNotMatch(sources(SURFACE) + PAGE, /higgsfield/i);
  assert.doesNotMatch(PAGE_CODE, /<video\b|\.mp4|\.webm/);
  const tour = homeCopy.buildTour({ studyLive: true, studyLessons: 4, studySubjects: 2, mobLive: true });
  assert.ok(tour.every((slide) => !slide.video), 'no tour slide carries a video file');
  assert.doesNotMatch(code(sources(SURFACE.filter((f) => !/FeatureTour/.test(f)))), /<video\b/, 'no video element outside the tour\'s optional slot');
});

test('L-045 the site promotes the Android app only where a real link exists: no placeholder or broken store badges', () => {
  const all = code(sources(SURFACE)) + PAGE_CODE;
  assert.doesNotMatch(all, /apps\.apple\.com|App Store badge|app-store-badge|appstore-badge|download on the app store/i, 'no App Store badge (there is no iOS app)');
  for (const m of all.matchAll(/https?:\/\/play\.google\.com[^"'`\s)$]*/g)) assert.match(m[0], /store\/apps\/details\?(id=[\w.]+|$)|store\/account\/subscriptions/, `a real Play link: ${m[0]}`);
  assert.doesNotMatch(all, /href=["']#["'][^>]*>\s*(Get it on|Download)/i, 'no placeholder store link');
  assert.doesNotMatch(all, /(play-badge|google-play-badge|get-it-on-google-play)\.(png|svg|webp)/i, 'no badge image without a live link');
});
