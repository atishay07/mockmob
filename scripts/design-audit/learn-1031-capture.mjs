// Learn v2 (the first slice, DESIGN-SPEC items 1-8): every screen at 390 and 1440 px, Night and Day, with the REAL decks, the
// Must-know overlay and the real preview questions, against `next dev` (the development preview's &decks=real source), never
// production data. Headless playwright-core with the chrome-headless-shell. One browser, one fresh in-memory student per shot
// (&kcs=). Clicks are real pointer events through playwright's locator.click. The preview's development note is hidden.
//   node scripts/design-audit/learn-1031-capture.mjs http://localhost:3451 tmp/learn-1031/final
//   PLAYWRIGHT_CORE=<path>  HEADLESS_SHELL=<path>  ONLY=<substrings>  THEMES=dark,light  SIZES=390,1440
// A run that logs problems (console errors, sideways spill, layout shift above 0.02, a covered primary key) prints them
// under ERRORS and exits 1; the captures are still written.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3451', out = 'tmp/learn-1031/final'] = process.argv.slice(2);
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const themes = (process.env.THEMES || 'dark,light').split(',');
const sizeList = (process.env.SIZES || '390,1440').split(',').map(Number);
mkdirSync(out, { recursive: true });

// The real preview questions: used only to know which option is the key, so a shot can show a right or a wrong answer on purpose.
const QUESTIONS = JSON.parse(readFileSync(new URL('../../data/fixtures/learn-preview-questions.json', import.meta.url), 'utf8')).questions;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const stripLetter = (s) => norm(s).replace(/^(Option\s+)?[A-F][.)]?\s+/i, '');
// Questions the run serves that are not in the fixture file (a mistake carried over from Mock 3): the key option learned from a first
// walk (the verdict marks it), so a shot can still choose right or wrong on purpose.
const LEARNED = [{ start: 'Under the fixed capital method', key: '(B), (A), (C), (D)' }];
// A fixture option is {key,text} or a bare string (the letter is its place in the list): the text of the key option, either way.
const keyTextOf = (f) => {
  const i = 'ABCDEF'.indexOf(f.correct_answer);
  const o = f.options.find((x) => x && x.key === f.correct_answer) || f.options[i];
  return stripLetter(typeof o === 'string' ? o : o?.text);
};
const fixtureFor = (body) => { const b = norm(body); return QUESTIONS.find((q) => norm(q.body) === b) || QUESTIONS.find((q) => b && norm(q.body).startsWith(b.slice(0, 60))) || null; };

const P = '/preview/arena?decks=real&';
const PRO = 'plan=pro&student=commerce';
const FREE = 'plan=free&student=commerce';
const C1 = 'accountancy.partnership-fundamentals';
const C2 = 'accountancy.admission-of-partner';
const wait = (page, ms) => page.waitForTimeout(ms);

// ---- Session player drivers ---------------------------------------------------------------------------------------------
const runState = (page) => page.evaluate(() => {
  if (document.querySelector('[data-phase="end"] .lr-end__title, .lr-fan, .lr-lead')) return { k: 'end' };
  if (document.querySelector('.lr-round')) return { k: 'round' };
  if (document.querySelector('.lr-recapend')) return { k: 'recapEnd' };
  const q = document.querySelector('.lr-q');
  if (q) return { k: 'q', answered: Boolean(document.querySelector('.lr-verdict')), mistake: Boolean(q.querySelector('.lr-q__kind[data-mistake]')), body: q.querySelector('.lr-q__stem')?.textContent || '' };
  if (document.querySelector('.lr-card--lesson')) return { k: 'lesson' };
  if (document.querySelector('.kc-rate')) return { k: 'rate' };
  if (document.querySelector('.lr-card')) return { k: 'card' };
  return { k: 'none' };
});
const settleRun = async (page) => { await page.waitForFunction(() => !document.querySelector('.lr[data-leaving]'), null, { timeout: 8000 }).catch(() => {}); await wait(page, 280); };
// Pick the key option or a wrong one in the question on screen with a real click.
const answerQuestion = async (page, want, body) => {
  const f0 = fixtureFor(body);
  const learned = LEARNED.find((l) => norm(body).startsWith(l.start));
  const f = f0 || (learned ? { options: [{ key: 'K', text: learned.key }], correct_answer: 'K' } : null);
  const opts = await page.locator('.lr-opt').evaluateAll((els) => els.map((e) => e.querySelector('.lr-opt__text')?.textContent || ''));
  let idx = -1;
  if (f) {
    const keyText = keyTextOf(f);
    const keyAt = keyText ? opts.findIndex((t) => stripLetter(t) === keyText) : -1;
    if (keyAt >= 0) idx = want === 'right' ? keyAt : (keyAt === 0 ? 1 : 0);
  }
  if (idx < 0) idx = want === 'right' ? 0 : 1;
  await page.locator('.lr-opt').nth(idx).click();
  await page.waitForSelector('.lr-verdict', { timeout: 15000 });
  await wait(page, 700);
};
/** Play on until `stop(state)` is true. `policy(state, n)` is 'right' or 'wrong' for each question. */
const drive = async (page, stop, policy = () => 'right', max = 90) => {
  let nq = 0;
  for (let i = 0; i < max; i += 1) {
    const s = await runState(page);
    if (stop(s)) return s;
    if (s.k === 'end' || s.k === 'recapEnd') return s;
    if (s.k === 'q' && !s.answered) { await answerQuestion(page, policy(s, nq), s.body); nq += 1; continue; }
    if (s.k === 'round') { await page.locator('.lr-round .kc-btn--volt').click(); await wait(page, 300); continue; }
    if (s.k === 'rate') {
      await page.locator('.kc-rate__btn[data-rating="3"]').click();
      // The rating goes to the server first; the card flies after it answers. Wait for the keys to go and the flight to end.
      await page.waitForFunction(() => !document.querySelector('.kc-rate') && !document.querySelector('.lr[data-leaving]'), null, { timeout: 20000 });
      await settleRun(page); continue;
    }
    await page.locator('.lr-dock .kc-btn--volt').first().click();
    await wait(page, 450);
    await settleRun(page);
  }
  throw new Error(`the run did not reach the wanted state in ${max} steps`);
};
const toEnd = (page) => drive(page, (s) => s.k === 'end' || s.k === 'recapEnd');
const scrollPlayer = (page) => page.evaluate(() => { const el = document.querySelector('.lr'); if (el && el.scrollHeight > el.clientHeight + 4) { el.scrollTo(0, el.scrollHeight); return true; } return false; });

// ---- Explore's chapter filter (the lead card) -------------------------------------------------------------------------
const pickListbox = async (page, name, text) => {
  await page.getByRole('combobox', { name }).first().click();
  const option = page.getByRole('option', { name: text }).first();
  await option.waitFor({ state: 'visible', timeout: 20000 });
  await option.click();
  await wait(page, 500);
};

const runUrl = (chapter, min, kind = 'mix', extra = '') => `${P}view=learn2-run&${PRO}&chapter=${chapter}&min=${min}&kind=${kind}${extra}`;
const scrollTop = (page) => page.evaluate(() => window.scrollTo(0, 0));

// ---- The shots -----------------------------------------------------------------------------------------------------------
// name; url; wait (a selector); act (drives the page); hit (a primary control that must not be covered); full ('phone' = a full-page
// capture at 390); sizes / themes limit a shot; extra (more captures from the same page: [suffix, async fn]).
const SHOTS = [
  // 1. Learn home, Chapters
  { name: '01-home-pro-accountancy', url: `${P}view=learn2&${PRO}&subject=accountancy`, wait: '.lh-row', full: 'phone', hit: '.lh-row__link' },
  { name: '01-home-pro-economics', url: `${P}view=learn2&${PRO}&subject=economics`, wait: '.lh-row', full: 'phone' },
  { name: '01-home-new-free', url: `${P}view=learn2&plan=free&student=new`, wait: '.lh-row', full: 'phone', hit: '.lh-row__link' },
  // 2. Learn home, Find
  { name: '02-find-shelves-pro', url: `${P}view=learn2&${PRO}&subject=accountancy&lv=find`, wait: '.l2f-shelf', full: 'phone' },
  { name: '02-find-goodwill-pro', url: `${P}view=learn2&${PRO}&subject=accountancy&lv=find`, wait: '.l2f-search input',
    act: async (page) => {
      // Typed with real key events; a fill lost to a re-render is typed again.
      for (let i = 0; i < 4; i += 1) {
        const input = page.locator('.l2f-search input');
        await input.click(); await input.fill('');
        await page.keyboard.type('goodwill', { delay: 80 });
        await wait(page, 600);
        if ((await input.inputValue()) !== 'goodwill') continue;
        const ok = await page.waitForSelector('.l2f-results .l2c-row, .l2f-results .l2f-link', { timeout: 12000 }).then(() => true).catch(() => false);
        if (ok) break;
      }
      if ((await page.locator('.l2f-search input').inputValue()) !== 'goodwill') throw new Error('the search box did not keep the typed word');
      await page.waitForSelector('.l2f-results .l2c-row, .l2f-results .l2f-link', { timeout: 5000 });
      await wait(page, 700);
      await page.locator('.l2f-search').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
      await wait(page, 300);
    } },
  { name: '02-find-shelves-free', url: `${P}view=learn2&${FREE}&subject=accountancy&lv=find`, wait: '.l2f-shelf', full: 'phone' },
  // 3. Chapter page
  { name: '03-chapter-partnership-10-pro', url: `${P}view=learn2-chapter&${PRO}&chapter=${C1}&min=10`, wait: '.lc-pile:not(.lc-pile--skel)', full: 'phone', hit: '.lc-go__key' },
  { name: '03-chapter-admission-20-pro-lesson', url: `${P}view=learn2-chapter&${PRO}&chapter=${C2}&min=20`, wait: '.lc-pile:not(.lc-pile--skel)', full: 'phone', hit: '.lc-go__key' },
  { name: '03-chapter-partnership-10-free', url: `${P}view=learn2-chapter&${FREE}&chapter=${C1}&min=10`, wait: '.lc-pile:not(.lc-pile--skel)', full: 'phone', hit: '.lc-go__key' },
  { name: '03-chapter-pile-left-out', url: `${P}view=learn2-chapter&${PRO}&chapter=${C1}&min=10`, wait: '.lc-pile:not(.lc-pile--skel)', full: 'phone',
    act: async (page) => { await page.locator('.lc-pile__btn').nth(1).click(); await wait(page, 700); } },
  // 4. Session player
  { name: '04-run-card-front', url: runUrl(C1, 10), wait: '.lr-card', hit: '.lr-dock .kc-btn--volt' },
  { name: '04-run-card-revealed', url: runUrl(C1, 10), wait: '.lr-card', hit: '.kc-rate__btn[data-rating="3"]',
    act: async (page) => { await page.locator('.lr-dock .kc-btn--volt').click(); await page.waitForSelector('.kc-rate'); await wait(page, 500); } },
  { name: '04-run-gotit-flight', url: runUrl(C1, 10), wait: '.lr-card', fast: true,
    act: async (page) => {
      await page.locator('.lr-dock .kc-btn--volt').click(); await page.waitForSelector('.kc-rate'); await wait(page, 450);
      await page.locator('.kc-rate__btn[data-rating="3"]').click();
      await wait(page, 40);
    },
    extra: [['stamp', async (page) => { await wait(page, 150); }]] },
  { name: '04-run-mcq', url: runUrl(C1, 10), wait: '.lr-card', hit: '.lr-opt',
    act: async (page) => { await drive(page, (s) => s.k === 'q' && !s.answered); await wait(page, 500); } },
  { name: '04-run-wrong-line', url: runUrl(C1, 10), wait: '.lr-card',
    act: async (page) => { await drive(page, (s) => s.k === 'q' && s.answered, () => 'wrong'); await wait(page, 600); } },
  { name: '04-run-fixed-mistake', url: runUrl(C1, 10), wait: '.lr-card',
    act: async (page) => { await drive(page, (s) => s.k === 'q' && s.mistake && !s.answered); await answerQuestion(page, 'right', (await runState(page)).body); } },
  // 5. Session end
  { name: '05-run-end-pro', url: runUrl(C1, 10), wait: '.lr-card', act: async (page) => { await toEnd(page); await page.waitForSelector('.lr-end__title, .lr-fan', { timeout: 30000 }); await wait(page, 1600); } },
  { name: '05-run-end-free', url: `${P}view=learn2-run&${FREE}&chapter=${C1}&min=10&kind=mix`, wait: '.lr-card', act: async (page) => { await toEnd(page); await page.waitForSelector('.lr-end__title, .lr-fan', { timeout: 30000 }); await wait(page, 1600); } },
  // 6. Cards view and Quick recap
  { name: '06-cards-all-folded', url: `${P}view=learn2-cards&${PRO}&chapter=${C1}&f=all`, wait: '.l2c-row', hit: '.l2c-hit-area' },
  { name: '06-cards-row-open', url: `${P}view=learn2-cards&${PRO}&chapter=${C1}&f=all`, wait: '.l2c-row',
    act: async (page) => { await page.locator('.l2c-hit-area').nth(1).click(); await wait(page, 700); await page.locator('.l2c-row[data-open]').first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 96)); } },
  { name: '06-cards-answers-shown', url: `${P}view=learn2-cards&${PRO}&chapter=${C1}&f=all`, wait: '.l2c-row',
    act: async (page) => { await page.locator('.l2c-switch').first().click(); await wait(page, 700); } },
  { name: '06-cards-must-know', url: `${P}view=learn2-cards&${PRO}&chapter=${C1}&f=must`, wait: '.l2c-row', hit: '.l2c-keys .kc-btn' },
  { name: '06-cards-all-free', url: `${P}view=learn2-cards&${FREE}&chapter=${C1}&f=all`, wait: '.l2c-row' },
  { name: '06-quick-recap', url: `${P}view=learn2-cards&${PRO}&chapter=${C1}&f=must`, wait: '.l2c-row', hit: '.lr-dock .kc-btn--volt',
    act: async (page) => { await page.getByRole('link', { name: /Quick recap these/ }).first().click(); await page.waitForSelector('.lr[data-recap] .lr-card', { timeout: 60000 }); await wait(page, 900); },
    extra: [['next', async (page) => { await page.locator('.lr-dock .kc-btn--volt').click(); await wait(page, 700); }]] },
  // 7. Explore feed
  { name: '07-explore-lead-card', url: `${P}view=explore&${PRO}&study=on`, wait: '.ex-filters',
    act: async (page) => { await pickListbox(page, 'Chapter', /Partnership Fundamentals/); await page.waitForSelector('.l2x-lead', { timeout: 60000 }); await wait(page, 700); await page.locator('.l2x-lead').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120)); await wait(page, 300); } },
  { name: '07-feed-card-front', url: `${P}view=learn2-feed&${PRO}&study=on&chapter=${C2}&min=10`, wait: '.l2x-card', hit: '.l2x-keys .kc-btn--volt' },
  { name: '07-feed-card-revealed', url: `${P}view=learn2-feed&${PRO}&study=on&chapter=${C2}&min=10`, wait: '.l2x-card',
    act: async (page) => { await page.locator('.l2x-card').click(); await page.waitForSelector('.l2x-card[data-revealed]'); await wait(page, 700); } },
  { name: '07-feed-question', url: `${P}view=learn2-feed&${PRO}&study=on&chapter=${C2}&min=10`, wait: '.l2x-card', hit: '.l2x-opt',
    act: async (page) => { await feedToQuestion(page); await wait(page, 500); } },
  { name: '07-feed-question-wrong', url: `${P}view=learn2-feed&${PRO}&study=on&chapter=${C2}&min=10`, wait: '.l2x-card',
    act: async (page) => {
      await feedToQuestion(page);
      const body = await page.locator('.l2x-qbody').textContent();
      const f = fixtureFor(body);
      const opts = await page.locator('.l2x-opt .l2x-opt__t').allTextContents();
      const keyText = f ? keyTextOf(f) : '';
      const keyAt = keyText ? opts.findIndex((t) => stripLetter(t) === keyText) : -1;
      await page.locator('.l2x-opt').nth(keyAt === 0 ? 1 : 0).click();
      await page.waitForSelector('.l2x-result', { timeout: 15000 }); await wait(page, 900);
      await page.locator('.l2x-result').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200));
    } },
  // 8. Navigation
  { name: '08-nav-practice-tabs', url: `${P}view=dashboard&${PRO}&study=on`, wait: 'h1', sizes: [390],
    act: async (page) => { await wait(page, 1500); } },
  { name: '08-nav-sidebar-learn', url: `${P}view=learn2&${PRO}&subject=accountancy`, wait: '.lh-row', sizes: [1440] },
  { name: '08-nav-sidebar-practice', url: `${P}view=dashboard&${PRO}&study=on`, wait: 'h1', sizes: [1440], act: async (page) => { await wait(page, 1500); } },
  { name: '08-nav-start-sheet', url: `${P}view=dashboard&${PRO}&study=on`, wait: 'h1',
    act: async (page) => { await page.locator('.stk:visible').first().click(); await page.waitForSelector('dialog[open]', { timeout: 15000 }); await wait(page, 900); },
    // The sheet scrolls: the row added by A8 ("Learn a chapter", between By chapter and Smart practice) is below the first screen.
    extra: [['learn-row', async (page) => {
      await page.evaluate(() => {
        const dlg = document.querySelector('dialog[open]');
        const row = [...dlg.querySelectorAll('*')].find((e) => e.children.length < 6 && /Learn a chapter/.test(e.textContent || '') && (e.textContent || '').length < 160);
        if (row) row.scrollIntoView({ block: 'center' });
        else for (const el of dlg.querySelectorAll('*')) if (el.scrollHeight > el.clientHeight + 20) el.scrollTop = el.scrollHeight;
      });
      await wait(page, 600);
    }]] },
  { name: '08-nav-n1-alternate-sidebar', url: `${P}view=learn2&${PRO}&subject=accountancy&nav=n1`, wait: '.lh-row', sizes: [1440], themes: ['dark'] },
];

async function feedToQuestion(page) {
  for (let i = 0; i < 40; i += 1) {
    if (await page.locator('.l2x-opt').count()) return;
    const volt = page.locator('.l2x-keys .kc-btn--volt').first();
    const label = norm(await volt.textContent());
    if (/^Show answer/.test(label)) { await page.locator('.l2x-card').click(); await wait(page, 350); }
    await page.locator('.l2x-keys .kc-btn--volt').first().click();
    await wait(page, 450);
  }
  throw new Error('the feed showed no question in 40 items');
}

const sizes = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const errors = [];
const IGNORE = /Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|status of 401|favicon|Download the React DevTools/i;
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const theme of themes) {
    for (const size of sizeList) {
      const ctx = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: size === 390 ? 2 : 1, hasTouch: size === 390, isMobile: size === 390, colorScheme: theme });
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ }
        // Layout shift (no recent input) from the first paint on: the page may not move once it is drawn.
        window.__cls = 0;
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ }
      }, theme);
      for (const shot of SHOTS) {
        if (only.length && !only.some((o) => shot.name.includes(o))) continue;
        if (shot.sizes && !shot.sizes.includes(size)) continue;
        if (shot.themes && !shot.themes.includes(theme)) continue;
        const tag = `${shot.name} ${size} ${theme}`;
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${tag}: pageerror ${e.message.slice(0, 200)}`));
        page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`${tag} console: ${m.text().slice(0, 200)}`); });
        const stem = `${shot.name}-${size}-${theme === 'dark' ? 'night' : 'day'}`;
        const file = (suffix) => join(out, `${stem}${suffix ? `-${suffix}` : ''}.png`);
        const shoot = async (suffix, full) => {
          // A full-page capture would stamp the fixed dock into the middle of the page: hide it for those (the viewport shots keep it).
          if (full) await page.addStyleTag({ content: '[data-shot-hide] { visibility: hidden !important; }' }).then(() => page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (r.height < 200 && r.bottom >= innerHeight - 60 && r.width > 200) el.setAttribute('data-shot-hide', ''); } }));
          await page.screenshot({ path: file(suffix), fullPage: full });
          console.log('saved', file(suffix));
        };
        try {
          await page.goto(`${base}${shot.url}&kcs=${encodeURIComponent(`${shot.name}-${size}-${theme}`)}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
          await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
          await page.waitForSelector(shot.wait, { timeout: 120000, state: 'visible' });
          await wait(page, 1200);
          const clsBefore = await page.evaluate(() => window.__cls || 0);
          if (shot.act) await shot.act(page);
          if (!shot.fast) {
            await wait(page, 500);
            // Never photograph a loading state: every skeleton block must be gone (the credits pill and the data behind it too).
            const gone = await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), null, { timeout: 30000 }).then(() => true).catch(() => false);
            if (!gone) errors.push(`${tag}: still showing a skeleton after 30 s`);
            await wait(page, 400);
          }
          if (shot.hit) {
            const covered = await page.locator(shot.hit).first().evaluate((el) => {
              const r = el.getBoundingClientRect();
              if (r.bottom < 0 || r.top > innerHeight) return null;
              const at = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1));
              return at && (el === at || el.contains(at)) ? null : (at ? `${at.tagName}.${at.className}` : 'nothing');
            }).catch(() => 'missing');
            if (covered) errors.push(`${tag}: ${shot.hit} is covered by ${covered}`);
          }
          const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (spill > 1) errors.push(`${tag}: the page scrolls sideways by ${spill}px`);
          const cls = await page.evaluate(() => window.__cls || 0);
          if (cls - clsBefore > 0.02 || cls > 0.1) errors.push(`${tag}: layout shift ${cls.toFixed(3)} (after load ${(cls - clsBefore).toFixed(3)})`);
          const full = shot.full === true || (shot.full === 'phone' && size === 390);
          await shoot('', full);
          if (shot.name.startsWith('04-run-wrong') || shot.name.startsWith('04-run-fixed')) { if (await scrollPlayer(page)) { await wait(page, 300); await shoot('bottom', false); } }
          for (const [suffix, fn] of shot.extra || []) { await fn(page); await shoot(suffix, false); }
        } catch (e) {
          errors.push(`${tag}: ${e.message.split('\n')[0]}`);
          try { await page.screenshot({ path: file('FAILED') }); } catch { /* none */ }
        }
        await page.close();
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
if (errors.length) { console.log('ERRORS'); for (const e of errors) console.log(' ', e); process.exit(1); }
