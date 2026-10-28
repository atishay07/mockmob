// Worst-case capture and break detector for /preview/arena (break-ui, 16 Oct 2026). Headless only, fixture routes only.
// node scripts/design-audit/breakui-1016.mjs <outDir> [filter]   (dev server on BASE, default http://localhost:3205)
import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:3205';
const out = process.argv[2];
const filter = process.argv[3] || '';
await fs.mkdir(out, { recursive: true });

const PAGES = {
  dashboard: 'view=dashboard',
  today: 'view=today',
  result: 'view=result',
  lab: 'view=result&mock=full',
  review: 'view=review',
  revise: 'view=revise',
  rules: 'view=rules',
  account: 'view=profile',
  compass: 'view=compass&plan=pro',
};
const SETS = {
  worst: 'worst=1',
  empty: 'data=empty&credits=0&papers=0',
  one: 'papers=1&name=one',
  huge: 'papers=500&credits=99999&plan=pro',
  hindi: 'name=hindi&chapter=hindi',
  zero: 'score=zero&credits=0',
  perfect: 'score=perfect&credits=99999',
  slow: 'net=slow&worst=1',
  fail: 'net=fail&worst=1',
};
const SIZES = [[390, 844], [1440, 900]];

const detector = () => {
  const bad = [];
  const vw = document.documentElement.clientWidth;
  const doc = document.documentElement;
  if (doc.scrollWidth > vw + 1) bad.push({ kind: 'page-x-scroll', detail: `${doc.scrollWidth} > ${vw}` });
  const text = document.body.innerText;
  for (const re of [/\bNaN\b/, /\bundefined\b/, /\[object /, /\bInfinity\b/, /\bnull\b/, /\b1 (papers|questions|chapters|credits|days|colleges|mocks)\b/, /\b0 (paper|question|chapter|credit|day|college|mock)\b(?!s)/]) {
    const m = text.match(re); if (m) bad.push({ kind: 'text', detail: m[0], ctx: text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, ' | ') });
  }
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.arena-fixture-note, .sr-only') || el.classList.contains('sr-only')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const label = `${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(' ').slice(0, 2).join('.')}`;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own && (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !el.title) {
      const k = 'clip:' + label; if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'clipped-text', detail: label, ctx: el.textContent.trim().slice(0, 60) }); }
    }
    if (own && cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && !el.title && !el.getAttribute('aria-label')) {
      const k = 'ell:' + label; if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'ellipsis-no-title', detail: label, ctx: el.textContent.trim().slice(0, 60) }); }
    }
    if (own && (r.right > vw + 1 || r.left < -1) && cs.position !== 'fixed') {
      const k = 'off:' + label; if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'off-screen', detail: label, ctx: `${Math.round(r.left)}..${Math.round(r.right)} ${el.textContent.trim().slice(0, 50)}` }); }
    }
    if (el.tagName === 'BUTTON' || el.tagName === 'A') {
      if (r.width > 0 && r.height > 0 && el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible') {
        const k = 'btn:' + label; if (!seen.has(k)) { seen.add(k); bad.push({ kind: 'control-clipped', detail: label, ctx: el.textContent.trim().slice(0, 50) }); }
      }
    }
  }
  return bad;
};

let browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const relaunch = async () => { contexts.clear(); await browser.close().catch(() => {}); browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true }); };
const report = [];
const contexts = new Map();
const tag = filter || 'all';
const EOL = String.fromCharCode(10);
const jobs = [];
for (const [pn, pq] of Object.entries(PAGES)) for (const [sn, sq] of Object.entries(SETS)) {
  if (['zero', 'perfect'].includes(sn) && !pn.startsWith('result')) continue;
  if (['zero', 'perfect'].includes(sn) && pn === 'lab') continue;
  jobs.push({ pn, sn, q: `${pq}&${sq}` });
}
const ctxFor = async (w, h, theme) => {
  const key = `${w}-${theme}`;
  if (!contexts.has(key)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch {} }, theme);
    contexts.set(key, ctx);
  }
  return contexts.get(key);
};
for (const job of jobs) {
  if (filter && !`${job.pn}-${job.sn}`.includes(filter)) continue;
  for (const [w, h] of SIZES) for (const theme of job.sn === 'worst' ? ['dark', 'light'] : [w === 390 ? 'dark' : 'light']) {
    const name = `${job.pn}-${job.sn}-${w}-${theme}`;
    let page;
    try {
      const ctx = await ctxFor(w, h, theme);
      page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
      await page.goto(`${BASE}/preview/arena?${job.q}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(1500);
      if (job.sn !== "slow") await page.waitForFunction(() => !document.querySelector("[aria-busy=true], [class*=skeleton], [class*=Skeleton]") && !/Loading your|Checking|Loading/.test(document.body.innerText), null, { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(900);
      const bad = await page.evaluate(detector);
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: job.sn !== 'huge', timeout: 60000 }).catch(async () => page.screenshot({ path: `${out}/${name}.png` }));
      report.push({ name, bad, errors });
      await fs.appendFile(`${out}/results-${tag}.jsonl`, JSON.stringify({ name, bad, errors }) + EOL);
      console.log(name, bad.length, errors.length);
    } catch (e) { report.push({ name, error: String(e.message).slice(0, 200) }); console.log(name, 'ERR', String(e.message).slice(0, 100)); await fs.appendFile(`${out}/results-${tag}.jsonl`, JSON.stringify({ name, error: String(e.message).slice(0, 200) }) + EOL); if (/crash|closed|Target/.test(String(e.message))) await relaunch(); }
    await page?.close().catch(() => {});
  }
}
await fs.writeFile(`${out}/report${filter ? '-' + filter : ''}.json`, JSON.stringify(report, null, 1));
await browser.close();
