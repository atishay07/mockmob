// Learn round 2, packet P1 (Learn home and roadmap): the after-shots of Learn home and Find against `next dev` (the development
// preview, decks=real), never production data. It only captures; it changes no product code.
//   node scripts/design-audit/learn-1101-r2-home-capture.mjs http://localhost:3481 tmp/learn-1101/r2-after/p1
//   ONLY=<job ids>  SIZES=390,1440  THEMES=dark,light
// States: a brand-new Free student; a returning Pro student (the seeded unfinished run ended first); the same student with the
// unfinished run; Free after the day's session (the seeded run ended, today's run answered once and ended); Find.
// ONE headless browser, held under the global lock C:\Users\atish\Desktop\mockmob copy\tmp-devslots\browser.lock (mkdir; stale
// after 10 minutes), removed at the end.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [BASE = 'http://localhost:3481', OUTARG = 'tmp/learn-1101/r2-after/p1'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = process.env.BROWSER_LOCK || 'C:/Users/atish/Desktop/mockmob copy/tmp-devslots/browser.lock';
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const sizes = (process.env.SIZES || '390,1440').split(',').map(Number);
const themes = (process.env.THEMES || 'dark,light').split(',');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZE = { 1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false }, 390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true } };
const P = '/preview/arena?decks=real&study=on&';

let beat = null;
async function takeLock() {
  for (let i = 0; i < 400; i += 1) {
    try { mkdirSync(LOCK); break; } catch {
      try { if (Date.now() - statSync(LOCK).mtimeMs > 10 * 60 * 1000) { rmSync(LOCK, { recursive: true, force: true }); continue; } } catch { /* gone */ }
      await sleep(5000);
    }
    if (i === 399) throw new Error('browser lock busy');
  }
  beat = setInterval(() => { try { const t = new Date(); utimesSync(LOCK, t, t); } catch { /* none */ } }, 20000);
}
const dropLock = () => { if (beat) clearInterval(beat); try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ } };

/** One preview API call inside the page (the realdeck forwarder's own address), for setting a student's state up. */
const api = (page, { plan, student, kcs }, to, { method = 'GET', body = null, query = {} } = {}) => page.evaluate(async ({ plan: pl, student: st, kcs: s, to: path, method: m, body: b, query: q }) => {
  const u = new URLSearchParams({ _to: path, _plan: pl, _student: st, _s: s, ...q });
  const res = await fetch(`/preview/arena/realdeck?${u}`, { method: m, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });
  return { status: res.status, body: await res.json().catch(() => null) };
}, { plan, student, kcs, to, method, body, query });

async function endOpenRun(page, who) {
  const s = await api(page, who, '/api/learn/subject', { query: { subject: 'accountancy' } });
  const id = s.body?.roadmap?.key?.run?.resume;
  if (id) await api(page, who, `/api/learn/runs/${id}/end`);
  return s.body?.roadmap?.mode;
}
async function useFreeSession(page, who) {
  await endOpenRun(page, who);
  const r = (await api(page, who, '/api/learn/subject', { query: { subject: 'accountancy' } })).body.roadmap;
  const run = (await api(page, who, '/api/learn/runs', { method: 'POST', body: { ...r.key.run, requestKey: `cap-${who.kcs}`.slice(0, 90).replace(/[^A-Za-z0-9_-]/g, '-') } })).body;
  const q = run?.items?.find((i) => i.type === 'question');
  if (q) await api(page, who, `/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: q.id, choice: q.question.options[0].key } });
  if (run?.id) await api(page, who, `/api/learn/runs/${run.id}/end`);
}

const JOBS = [
  { id: 'home-new-free', plan: 'free', student: 'new', q: 'view=learn2&subject=accountancy', what: 'Learn home, a brand-new Free student (Accountancy)', full: true },
  { id: 'home-returning-pro', plan: 'pro', student: 'commerce', q: 'view=learn2&subject=accountancy', what: 'Learn home, a returning Pro student (the unfinished run ended): Today\'s 10 minutes', setup: endOpenRun, full: true },
  { id: 'home-unfinished', plan: 'pro', student: 'commerce', q: 'view=learn2&subject=accountancy', what: 'Learn home, a returning student with an unfinished run: Pick up' },
  { id: 'home-free-done', plan: 'free', student: 'commerce', q: 'view=learn2&subject=accountancy', what: 'Learn home, Free after the day\'s session', setup: useFreeSession },
  { id: 'find-new-free', plan: 'free', student: 'new', q: 'view=learn2&subject=accountancy&lv=find', what: 'Find (lv=find), a brand-new Free student' },
  { id: 'find-pro', plan: 'pro', student: 'commerce', q: 'view=learn2&subject=accountancy&lv=find', what: 'Find (lv=find), a returning Pro student' },
  { id: 'find-typed', plan: 'pro', student: 'commerce', q: 'view=learn2&subject=accountancy&q=goodwill', what: 'Find, "goodwill" typed (results)' },
];

const index = [];
await takeLock();
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const job of JOBS) {
    if (only.length && !only.some((o) => job.id.includes(o))) continue;
    for (const size of sizes) {
      for (const theme of themes) {
        const S = SIZE[size];
        const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
        await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
        page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools|status of 40[1-4]/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
        const kcs = `r2p1-${job.id}-${size}-${theme}-${Date.now() % 1e8}`;
        const who = { plan: job.plan, student: job.student, kcs };
        const url = `${P}plan=${job.plan}&student=${job.student}&${job.q}&kcs=${kcs}`;
        try {
          if (job.setup) {
            await page.goto(`${BASE}${P}plan=${job.plan}&student=${job.student}&view=today&kcs=${kcs}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
            await job.setup(page, who);
          }
          await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
          await page.addStyleTag({ content: '.arena-fixture-note, nextjs-portal { display: none !important; }' }).catch(() => {});
          await page.waitForSelector(job.id.startsWith('find') ? '.lh-find' : '.lh-hero:not(.lh-hero--skel), .lh-err', { timeout: 180000, state: 'visible' });
          await page.waitForTimeout(job.id === 'find-typed' ? 2500 : 1400);
          const name = theme === 'dark' ? 'night' : 'day';
          const file = `${job.id}-${size}-${name}.png`;
          await page.screenshot({ path: join(OUT, file) });
          index.push({ file, what: job.what, url, errors: [...errors] });
          if (job.full && size === 390) {
            const full = `${job.id}-full-${size}-${name}.png`;
            await page.screenshot({ path: join(OUT, full), fullPage: true });
            index.push({ file: full, what: `${job.what}, the full page`, url, errors: [] });
          }
          const spill = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          if (spill > 1) index[index.length - 1].errors.push(`horizontal spill ${spill}px`);
          process.stdout.write(`${file}${errors.length ? ` ERR ${errors.join(' | ')}` : ''}\n`);
        } catch (e) {
          index.push({ file: `${job.id}-${size}-${theme}`, what: job.what, url, errors: [`FAILED ${e.message.slice(0, 200)}`, ...errors] });
          process.stdout.write(`FAILED ${job.id} ${size} ${theme}: ${e.message.slice(0, 160)}\n`);
        }
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close().catch(() => {});
  dropLock();
  const md = ['# Learn round 2, P1 after-shots (Learn home and Find)', '', `Made by scripts/design-audit/learn-1101-r2-home-capture.mjs against \`next dev\` (${BASE}, decks=real). Night = dark, Day = light. Phones 390x844 at scale 2, desktop 1440x900.`, '', '| file | what | errors |', '| --- | --- | --- |',
    ...index.map((r) => `| ${r.file} | ${r.what} | ${r.errors.join('; ') || ''} |`)];
  writeFileSync(join(OUT, 'INDEX.md'), `${md.join('\n')}\n`);
}
