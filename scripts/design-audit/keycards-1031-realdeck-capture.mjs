// Key cards with the REAL decks (the development preview's &decks=real source, src/lib/server/keycardsPreview.js): every
// screen at 390 and 1440 px, Night and Day, against `next dev`, never production data. Headless playwright-core with its own
// temp profile; the preview's development note is hidden in the shots. Each shot is its own fresh in-memory student (&kcs=).
//   node scripts/design-audit/keycards-1031-realdeck-capture.mjs http://localhost:3431 tmp/walk-1031/realdeck
//   PLAYWRIGHT_CORE=<path>  HEADLESS_SHELL=<path>  ONLY=<substrings>  THEMES=dark,light  SIZES=390,1440  PERF=1
// PERF=1 also measures the longest decks (Pro, Read): time until every card is drawn, and long frames while scrolling
// through it, into <out>/perf.json.
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3431', out = 'tmp/walk-1031/realdeck'] = process.argv.slice(2);
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const themes = (process.env.THEMES || 'dark,light').split(',');
const sizeList = (process.env.SIZES || '390,1440').split(',').map(Number);
mkdirSync(out, { recursive: true });

const R = '/preview/arena?decks=real&';
const reveal = async (page) => { await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); };
const toTop = (sel) => async (page) => { await page.locator(sel).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90)); };
const scrollTo = (fraction) => async (page) => { await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), fraction); };

// The decks the brief names, each in Read, Study (front and answer) and Last look.
const DECKS = [
  ['ratios', 'accountancy.accounting-ratios'],
  ['entries', 'accountancy.admission-of-partner'],
  ['econ-long', 'economics.introduction-and-theory-of-consumer-behaviour'],
  ['bio', 'biology.molecular-basis-of-inheritance', 'science'],
  ['polsci', 'political_science.challenges-of-nation-building', 'science'],
  ['english', 'english.vocabulary'],
];
// The worst case of each subject: the longest front, the longest back, and Political Science's longest quote.
const WORST = [
  ['ac-front', 'accountancy.admission-of-partner', 'kc.accountancy.admission-of-partner.kl-capitals-proportionate'],
  ['ac-back', 'accountancy.partnership-fundamentals', 'kc.accountancy.partnership-fundamentals.list-deed-contents-all'],
  ['ac-entry', 'accountancy.debentures', 'entry'],
  ['bs-front', 'business_studies.financial-management', 'kc.business_studies.financial-management.term-optimum-capital-structure'],
  ['bs-back', 'business_studies.consumer-protection', 'kc.business_studies.consumer-protection.list-relief-list'],
  ['ec-front', 'economics.indian-economy-on-the-eve-of-independence', 'kc.economics.indian-economy-on-the-eve-of-independence.key-more-than-half-to-britain'],
  ['ec-back', 'economics.introduction-and-theory-of-consumer-behaviour', 'kc.economics.introduction-and-theory-of-consumer-behaviour.types-expenditure-elasticity'],
  ['bio-front', 'biology.organisms-and-populations', 'kc.biology.organisms-and-populations.kl-exp-vs-logistic', 'science'],
  ['bio-back', 'biology.biotechnology-principles-and-processes', 'kc.biology.biotechnology-principles-and-processes.list-alien-dna-methods', 'science'],
  ['ps-front', 'political_science.globalisation', 'kc.political_science.globalisation.key-imf-wto', 'science'],
  ['ps-back', 'political_science.international-organisations', 'kc.political_science.international-organisations.list-steps-2005', 'science'],
  ['ps-quote', 'political_science.challenges-of-nation-building', 'kc.political_science.challenges-of-nation-building.quote-gandhi-14-aug', 'science'],
  ['en-front', 'english.correct-word-usage', 'kc.english.correct-word-usage.rule-discuss-no-about'],
  ['en-back', 'english.correct-word-usage', 'kc.english.correct-word-usage.rule-as-well-as'],
];
const deckUrl = (key, { plan = 'pro', student = 'commerce', mode = null, first = null } = {}) => `${R}view=deck&student=${student}&plan=${plan}&chapter=${encodeURIComponent(key)}${mode ? `&mode=${mode}` : ''}${first ? `&kcfirst=${encodeURIComponent(first)}` : ''}`;

const SHOTS = [
  // /cards
  { name: 'home-commerce-free', url: `${R}view=cards&student=commerce&plan=free`, wait: '.kc-row', full: 'phone', hit: '.kc-row__link' },
  { name: 'home-commerce-pro', url: `${R}view=cards&student=commerce&plan=pro`, wait: '.kc-row', full: 'phone', hit: '.kc-today__key' },
  { name: 'home-commerce-pro-accountancy', url: `${R}view=cards&student=commerce&plan=pro&subject=accountancy`, wait: '.kc-opt', full: 'phone' },
  { name: 'home-commerce-pro-economics', url: `${R}view=cards&student=commerce&plan=pro&subject=economics`, wait: '.kc-row', full: 'phone' },
  { name: 'home-commerce-free-english', url: `${R}view=cards&student=commerce&plan=free&subject=english`, wait: '.kc-row', full: 'phone' },
  { name: 'home-science-free', url: `${R}view=cards&student=science&plan=free`, wait: '.kc-row', full: 'phone' },
  { name: 'home-science-pro-polsci', url: `${R}view=cards&student=science&plan=pro&subject=political_science`, wait: '.kc-row', full: 'phone' },
  { name: 'home-new-free', url: `${R}view=cards&student=new&plan=free`, wait: '.kc-row', full: 'phone' },
  // /cards/[chapter], the named decks
  ...DECKS.flatMap(([slug, key, student = 'commerce']) => [
    { name: `deck-${slug}-read-pro`, url: deckUrl(key, { student }), wait: '.kc-entry', hit: '.kc-seg__btn' },
    { name: `deck-${slug}-read-pro-mid`, url: deckUrl(key, { student }), wait: '.kc-entry', act: scrollTo(0.45) },
    { name: `deck-${slug}-read-free`, url: deckUrl(key, { student, plan: 'free' }), wait: '.kc-entry', full: 'phone' },
    { name: `deck-${slug}-study-front`, url: deckUrl(key, { student, mode: 'study' }), wait: '.kc-play', hit: '.kc-play__keys .kc-btn' },
    { name: `deck-${slug}-study-answer`, url: deckUrl(key, { student, mode: 'study' }), wait: '.kc-play', act: reveal, hit: '.kc-rate__btn' },
    { name: `deck-${slug}-last`, url: deckUrl(key, { student, mode: 'last' }), wait: '.kc-look' },
  ]),
  // The worst case of each subject, Pro: the card in Read (scrolled to it) and in Study with its answer shown.
  ...WORST.flatMap(([slug, key, id, student = 'commerce']) => (id === 'entry'
    ? [{ name: `worst-${slug}-read`, url: deckUrl(key), wait: '.kc-entry', act: async (page) => { const el = page.locator('.kc-entry', { hasText: 'Journal entry' }).first(); await el.evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY - 90)); } }]
    : [
      { name: `worst-${slug}-read`, url: deckUrl(key, { student, first: id }), wait: '.kc-entry' },
      { name: `worst-${slug}-study`, url: deckUrl(key, { student, first: id, mode: 'study' }), wait: '.kc-play', act: reveal },
    ])),
  // Revise playing real due cards
  { name: 'revise-head-pro', url: `${R}view=revise&plan=pro&revise=keycards`, wait: '.rvs-mix' },
  { name: 'revise-keycards-pro', url: `${R}view=revise&plan=pro&revise=keycards&source=keycards`, wait: '.kc-play', act: reveal, hit: '.kc-rate__btn' },
  { name: 'revise-keycards-free', url: `${R}view=revise&plan=free&revise=keycards&source=keycards`, wait: '.kc-play', act: reveal },
  { name: 'revise-keycards-science', url: `${R}view=revise&plan=pro&student=science&revise=keycards&source=keycards`, wait: '.kc-play', act: reveal },
  // The line you needed, with real linked cards (the paper's questions stand in for linked ones; fixture question text)
  ...['free', 'pro'].map((plan) => ({ name: `result-line-${plan}`, url: `${R}view=result&plan=${plan}`, wait: '#q-2', attached: true, act: async (page) => {
    const row = page.locator('#q-2');
    if (!(await row.isVisible())) await page.locator('button', { hasText: 'Your mistakes' }).first().click();
    await row.scrollIntoViewIfNeeded();
    if (!(await row.getAttribute('data-open'))) await row.locator('.rp-q__bar').click();
    const show = row.locator('button', { hasText: /show the answer/i }).first();
    if (await show.count()) await show.click();
    await page.waitForSelector('#q-2 .kc-line', { timeout: 20000 });
    await page.locator('#q-2 .kc-line').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140));
  } })),
  // States with real content: a CUET-only chapter with no cards yet, and the print sheet of the 165-card deck
  { name: 'deck-empty-real', url: deckUrl('business_studies.financial-markets'), wait: '.kc-quiet-state', sizes: [390, 1440] },
  { name: 'deck-ratios-print', url: deckUrl('accountancy.accounting-ratios'), wait: '.kc-entry', sizes: [1440], themes: ['dark'], print: true },
];

const sizes = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const errors = [];
const perf = [];
const profile = mkdtempSync(join(tmpdir(), 'kc-real-'));
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const theme of themes) {
    for (const size of sizeList) {
      const ctx = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: size === 390 ? 2 : 1, hasTouch: size === 390, isMobile: size === 390, colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
      for (const shot of SHOTS) {
        if (only.length && !only.some((o) => shot.name.includes(o))) continue;
        if (shot.sizes && !shot.sizes.includes(size)) continue;
        if (shot.themes && !shot.themes.includes(theme)) continue;
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${shot.name} ${size} ${theme}: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error' && !/Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|status of 401|favicon|Download the React DevTools/i.test(m.text())) errors.push(`${shot.name} ${size} ${theme} console: ${m.text().slice(0, 200)}`); });
        const file = join(out, `${shot.name}-${size}-${theme === 'dark' ? 'night' : 'day'}.png`);
        try {
          await page.goto(`${base}${shot.url}&kcs=${encodeURIComponent(`${shot.name}-${size}-${theme}`)}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
          await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
          await page.waitForSelector(shot.wait, { timeout: 90000, state: shot.attached ? 'attached' : 'visible' });
          await page.waitForTimeout(1100);
          if (shot.act) await shot.act(page);
          await page.waitForTimeout(500);
          if (shot.hit) {
            const covered = await page.locator(shot.hit).first().evaluate((el) => {
              const r = el.getBoundingClientRect();
              if (r.bottom < 0 || r.top > innerHeight) return null;
              const at = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1));
              return at && (el === at || el.contains(at)) ? null : (at ? `${at.tagName}.${at.className}` : 'nothing');
            });
            if (covered) errors.push(`${shot.name} ${size} ${theme}: ${shot.hit} is covered by ${covered}`);
          }
          // Nothing may spill past the page's width (a long word, formula or entry line).
          const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (spill > 1) errors.push(`${shot.name} ${size} ${theme}: the page scrolls sideways by ${spill}px`);
          if (shot.print) await page.emulateMedia({ media: 'print' });
          const full = shot.full === true || (shot.full === 'phone' && size === 390);
          await page.screenshot({ path: file, fullPage: full || Boolean(shot.print) });
          console.log('saved', file);
        } catch (e) {
          errors.push(`${shot.name} ${size} ${theme}: ${e.message.split('\n')[0]}`);
          try { await page.screenshot({ path: file.replace('.png', '-FAILED.png') }); } catch { /* none */ }
        }
        await page.close();
      }
      // The longest decks (Pro, Read): every card drawn, then long frames while scrolling through.
      if (process.env.PERF === '1') {
        for (const [key, student] of [['accountancy.accounting-ratios', 'commerce'], ['biology.molecular-basis-of-inheritance', 'science'], ['english.vocabulary', 'commerce']]) {
          const page = await ctx.newPage();
          const t0 = Date.now();
          await page.goto(`${base}${deckUrl(key, { student })}&kcs=perf-${size}-${theme}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
          await page.waitForSelector('.kc-entry', { timeout: 90000 });
          const drawn = Date.now() - t0;
          const m = await page.evaluate(async () => {
            const entries = document.querySelectorAll('.kc-entry').length;
            const frames = [];
            let last = performance.now();
            const total = document.documentElement.scrollHeight - innerHeight;
            await new Promise((done) => {
              const start = performance.now();
              const step = (now) => {
                frames.push(now - last); last = now;
                const f = Math.min(1, (now - start) / 4000);
                window.scrollTo(0, total * f);
                if (f < 1) requestAnimationFrame(step); else done();
              };
              requestAnimationFrame(step);
            });
            const sorted = [...frames].sort((a, b) => a - b);
            return { entries, height: document.documentElement.scrollHeight, frames: frames.length, over50: frames.filter((x) => x > 50).length, p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0), nodes: document.getElementsByTagName('*').length };
          });
          perf.push({ key, size, theme, msToFirstCard: drawn, ...m });
          console.log('perf', key, size, theme, JSON.stringify(m), `${drawn} ms`);
          await page.close();
        }
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
if (perf.length) writeFileSync(join(out, 'perf.json'), JSON.stringify(perf, null, 2));
if (errors.length) { console.log('ERRORS'); for (const e of errors) console.log(' ', e); process.exit(1); }
