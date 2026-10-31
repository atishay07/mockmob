// LK6, the MockMob mark on every printed sheet: prints the Key cards chapter sheet (Pro), a lesson's "Print a summary" and the
// chapter summary to A4 PDF (printBackground on) from the development preview, into <out>/lk6-*.pdf. Also writes a rendered PNG
// Open the PDFs with a PDF reader (or render pages with pypdfium2).
//   node scripts/design-audit/keycards-1031-lk6-print.mjs http://localhost:3441 tmp/lk-1031
//   PLAYWRIGHT_CORE=<path>  HEADLESS_SHELL=<path>  ONLY=keycards,lesson,summary  NAME=Riya%20Sharma (the preview student's name)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3441', out = 'tmp/lk-1031'] = process.argv.slice(2);
const only = (process.env.ONLY || 'keycards,lesson,summary').split(',');
mkdirSync(out, { recursive: true });
const pilot = JSON.parse(readFileSync('data/study/pilot.json', 'utf8'));
const unit = pilot.units.find((u) => u.subject === 'accountancy' && u.blocks.filter((b) => b.type === 'reading').length >= 2) || pilot.units.find((u) => u.blocks.filter((b) => b.type === 'reading').length >= 2);
const chapterUnits = pilot.units.filter((u) => u.subject === unit.subject && u.chapter === unit.chapter);
const name = process.env.NAME ? `&name=${process.env.NAME}` : '';

const JOBS = {
  keycards: { file: 'lk6-keycards-sheet.pdf', url: `/preview/arena?decks=real&view=deck&student=commerce&plan=pro&chapter=accountancy.accounting-ratios&kcs=lk6-print${name}`, wait: '.kc-print' },
  lesson: { file: 'lk6-lesson-summary.pdf', url: `/preview/study?unit=${unit.id}`, wait: '.sx-print-only', nameless: true },
  summary: { file: 'lk6-chapter-summary.pdf', url: `/preview/arena?view=summary&subject=${unit.subject}&chapter=${encodeURIComponent(unit.chapter)}${name}`, wait: '.sx-summary__unit', route: true },
};
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const key of only) {
    const job = JOBS[key];
    if (!job) continue;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    await ctx.addInitScript(() => { try { localStorage.setItem('mm:theme:v1', 'light'); } catch { /* none */ } });
    const page = await ctx.newPage();
    if (job.route) {
      await page.route('**/api/study/summary*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ units: chapterUnits.map((u) => ({ id: u.id, title: u.title, version: u.version, sourceRefs: u.sourceRefs, blocks: u.blocks.filter((b) => b.type === 'reading') })) }) }));
    }
    await page.goto(`${base}${job.url}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector(job.wait, { state: 'attached', timeout: 120000 });
    await page.waitForTimeout(2500);
    // The arena preview also loads Key cards' print sheet CSS, which hides the app shell when printing; the chapter summary
    // page on its own does not load it, so undo that here (preview harness only).
    if (job.route) await page.addStyleTag({ content: '@media print { html body > .app-shell { display: block !important; } }' });
    // The mark must not change the screen: its parts take no room and show nothing.
    const screen = await page.evaluate(() => [...document.querySelectorAll('.pm, .pm-head')].map((el) => getComputedStyle(el).display));
    console.log(key, 'on screen the mark is', JSON.stringify(screen));
    const pdf = join(out, job.file);
    await page.pdf({ path: pdf, format: 'A4', printBackground: true });
    console.log('saved', pdf);
    await ctx.close();
  }
} finally {
  await browser.close();
}
