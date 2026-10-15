// Builds the Gate A contact sheet (tmp/web-ia/gate-a/gate-a.html) and the overview PNG from the
// captures made by ia-1015-shots.mjs and the "before" captures in tmp/web-ia/shots.
//   node scripts/design-audit/ia-1015-sheet.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { LOGO_B } from '../../src/components/landing/logoB.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = 'C:/Users/atish/Desktop/mockmob copy/mockmob-next/tmp/web-ia';
const BEFORE = path.join(ROOT, 'shots');
const GATE = path.join(ROOT, 'gate-a');
const AFTER = path.join(GATE, 'shots');
const report = JSON.parse(await fs.readFile(path.join(GATE, 'report.json'), 'utf8').catch(() => '[]'));

// label, what to look at, before desktop, before phone, after job(s)
const SECTIONS = [
  ['First run', [
    ['Landing, first screen', 'One H1 that says what it is, the live sample beside it, two targets above the fold.', 'desktop-landing-1.png', 'new-phone-landing-1.jpg', 'landing-hero'],
    ['Landing, whole page', 'Seven sections instead of about twelve. Before: 15 desktop screens.', 'STACK:desktop-landing-', null, 'landing-full'],
    ['The 5-question sample, answered', 'The score, the chapter behind each answer, one "Save this and start free".', 'new-desktop-hero-demo-answered.jpg', null, 'sample-answered'],
    ['Sign up', '"Create your free account", one line of free facts, Google first.', 'desktop-signup.png', null, 'signup'],
    ['Log in', 'No "Welcome back" for a new visitor.', 'desktop-login.png', null, 'login'],
    ['Onboarding 1: subjects', 'One question per screen.', 'new-desktop-in-onboarding.jpg', 'new-phone-in-onboarding.jpg', 'onboarding-subjects'],
    ['Onboarding 2: study days', 'New step: days a week, default 4.', null, null, 'onboarding-days'],
    ['Today, first move', 'A new student sees one move with its time and cost.', 'new-desktop-in-today-first-run-empty.jpg', null, 'today-first'],
    ['Guide, stop 1', 'Four stops, opens once after the first repair.', 'new-desktop-in-guide-tour.jpg', null, 'guide-stop1'],
  ]],
  ['Navigation', [
    ['Sidebar and phone bar', 'Today, Practice, Start, Review, You. Labelled credit lines. Review badge = mistakes to repair.', 'new-desktop-in-today-1.jpg', 'new-phone-in-more-menu.jpg', 'nav-shell'],
    ['Start sheet', 'Start is an action: at most 5 rows, nothing spent on the first tap.', null, null, 'nav-start-sheet'],
    ['Start sheet, confirm line', 'The confirm line says size, time, marking and cost before Start.', null, null, 'nav-start-confirm'],
  ]],
  ['Today', [
    ['Today, mistakes to repair', 'One hero, one primary, "Something else instead" behind it.', 'new-desktop-in-today-1.jpg', 'new-phone-in-today-1.jpg', 'today-repair'],
    ['Today, result not opened', null, null, null, 'today-unopened'],
    ['Today, practise the weak chapter', null, null, null, 'today-practise'],
    ['Today, resume', null, null, null, 'today-resume'],
    ['Today, back after days away', null, null, null, 'today-stale'],
  ]],
  ['Practice', [
    ['Practice', 'Recommended start, then choose your own with the cost on every row.', 'new-desktop-in-practice-1.jpg', 'new-phone-in-practice-1.jpg', 'practice'],
    ['Practice from a "Do these next" link', 'The prefill opens the right setup; nothing is spent before Start.', null, null, 'practice-prefill'],
    ['Question stream (was Explore)', null, 'new-desktop-in-explore.jpg', 'new-phone-in-explore-1.jpg', 'question-stream'],
  ]],
  ['Review', [
    ['Review hub', 'Mistakes to repair, where your marks go, past results, saved, repair record.', 'new-desktop-in-review.jpg', 'new-phone-in-review-1.jpg', 'review'],
    ['Review, nothing yet', null, 'new-desktop-in-review-empty.jpg', null, 'review-empty'],
    ['Ask Mobi (was PrepOS)', 'Ask only, with its cost. No terminal panels.', 'new-desktop-in-prepos.jpg', 'new-phone-in-prepos-1.jpg', 'ask-mobi'],
    ['Your record (was Radar)', 'New header only; the visuals stay as the owner liked them.', 'new-desktop-in-radar-1.jpg', 'new-phone-in-radar-1.jpg', 'your-record'],
  ]],
  ['You', [
    ['You (new hub)', 'Your sheet, week and goal, plan, bests, tools, settings, community, help.', 'new-desktop-in-progress-1.jpg', 'new-phone-in-progress-1.jpg', 'you'],
    ['Account', 'Every old setting still reachable, plus Start on.', 'new-desktop-in-profile.jpg', 'new-phone-in-profile-1.jpg', 'account'],
    ['Leaderboard', 'Synthetic rows are off the top.', 'new-desktop-in-ranks.jpg', 'new-phone-in-ranks-1.jpg', 'leaderboard'],
  ]],
  ['Public pages', [
    ['Pricing', 'Plain numbers: credits, AI credits, what a repair costs.', 'desktop-pricing-1.png', 'new-phone-pricing-1.jpg', 'pricing'],
    ['Cutoff calculator', 'The tool first; the ladder, college starts and Pro aside moved here.', 'desktop-cutoff-1.png', 'new-phone-cutoff-1.jpg', 'cutoff-calculator'],
    ['Combo planner', null, 'new-desktop-combo-planner.jpg', null, 'combo-planner'],
  ]],
  ['Result and repair (Repair v3 owns these; captured, not edited)', [
    ['Result', 'The SWOT views arrive with the Repair v3 merge (IA9).', 'new-desktop-in-result-1.jpg', 'new-phone-in-result-1.jpg', 'result'],
    ['Repair, first mistake', null, 'new-desktop-in-recovery.jpg', 'new-phone-in-recovery.jpg', 'repair'],
    ['Test console (must not change)', null, 'new-desktop-in-test-console-quick.jpg', 'new-phone-in-test-1.jpg', 'test-console'],
  ]],
];

const DECISIONS = [
  ['N1', 'Today first: a signed-in visit and sign-in land on Today; order Today, Practice, Start, Review, You. "Start on: Practice" stays as a setting.', 'Yes'],
  ['N2', 'The naming table (plan section 6), including the app renames: AI credits, Cutoff calculator, the Ask Mobi receipt line.', 'Yes'],
  ['N3', 'Keep the SWOT names as built: "After this mock", "Do these next", "SWOT for this mock".', 'Yes'],
  ['N4', 'Leaderboard and Contribute questions stay web only under You > Community; the synthetic rival leaves the top.', 'Yes'],
  ['N5', 'Retire Benchmarks (/rival). It stays unlinked; the route goes only on your word.', 'Yes'],
  ['N6', 'Two-step web onboarding (subjects, then days). Course and colleges come later via "Finish your sheet".', 'Yes'],
  ['N7', 'Bricolage, logo B and the 3D subject objects go on the website after this preview.', 'Yes, after this look'],
  ['N8', 'Hero copy A now. Your "Find, Repair, Prove" line returns once the fresh check is live.', 'A'],
  ['N9', '/features redirects to /#how-it-works instead of being rewritten.', 'Yes'],
];

const CHANGES = [
  'One structure, the same as the app: Today, Practice, Start, Review, You. 4 groups and 14 links are gone; the phone bar has 5 slots, no More sheet.',
  'Start is a sheet: at most 5 rows, each opens a confirm line with the cost. Nothing is spent on the first tap.',
  'Landing: a plain H1, the live sample beside it, 7 sections (about half the old height), no autoplay, no "being prepared" lines, 2 Mobi seats.',
  'First run: sample, sign up, subjects, days, Today\'s first move. "Welcome back" only for a returning visitor. Sign-in lands on Today.',
  'Today shows one move from one rule set (shared with the Start sheet and Practice), one primary button, the week, one finding.',
  'Practice: recommended start, cost on every row, "Comes with Pro" on locks; Feed the bank and saved to Radar removed. Old "Do these next" links still prefill.',
  'Review is the hub: mistakes to repair, where your marks go, past results, saved questions, repair record. PrepOS is now Ask Mobi.',
  'You is new: your sheet, week and goal, plan and credits, bests, CUET tools, settings (with Start on), community, help.',
  'Pricing in plain numbers; the calculator page takes over the DU blocks from the landing; PYQ page wording is honest.',
  'Names: Mistake Repair, Your record, Ask Mobi, Cutoff calculator, Question stream, Concepts, practice credits, AI credits.',
];

async function img(file, width, quality = 62) {
  if (!file || !existsSync(file)) return null;
  const buf = await sharp(file).resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

async function stack(prefix, width) {
  const files = (await fs.readdir(BEFORE)).filter((f) => f.startsWith(prefix) && /^desktop-landing-\d+\.png$/.test(f))
    .sort((a, b) => Number(a.match(/(\d+)\.png$/)[1]) - Number(b.match(/(\d+)\.png$/)[1]));
  const h = Math.round(width * 900 / 1440);
  const parts = await Promise.all(files.map((f) => sharp(path.join(BEFORE, f)).resize({ width, height: h }).toBuffer()));
  const out = await sharp({ create: { width, height: h * parts.length, channels: 3, background: '#12110E' } })
    .composite(parts.map((input, i) => ({ input, top: i * h, left: 0 }))).webp({ quality: 55 }).toBuffer();
  return { src: `data:image/webp;base64,${out.toString('base64')}`, count: files.length };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const after = (job, size, theme) => path.join(AFTER, `${job}--${size}-${theme}.jpg`);
const fig = (src, cap, cls = '') => (src ? `<figure class="${cls}"><img loading="lazy" src="${src}" alt="${esc(cap)}"><figcaption>${esc(cap)}</figcaption></figure>` : '');

function checksFor(job) {
  const rows = report.filter((r) => r.job === job);
  if (!rows.length) return '';
  const bad = [];
  for (const r of rows) {
    const where = `${r.size} ${r.theme === 'dark' ? 'Night' : 'Day'}`;
    if (r.failed) bad.push(`${where}: capture failed`);
    if (r.overflowX > 0) bad.push(`${where}: ${r.overflowX}px sideways scroll`);
    if (r.mobi > 1 && !job.startsWith('landing-full')) bad.push(`${where}: ${r.mobi} Mobi`);
  }
  return bad.length ? `<p class="flag">${esc(bad.join('; '))}</p>` : '<p class="ok">No sideways scroll, at most one Mobi on screen, in Night and Day at both sizes.</p>';
}

let body = '';
for (const [group, items] of SECTIONS) {
  body += `<section><h2>${esc(group)}</h2>`;
  for (const [label, note, bDesk, bPhone, job] of items) {
    const full = job === 'landing-full' || job === 'pricing';
    const dw = full ? 520 : 720;
    let beforeHtml = '';
    if (bDesk?.startsWith('STACK:')) {
      const s = await stack(bDesk.slice(6), 360);
      beforeHtml = fig(s.src, `Before, production desktop (${s.count} screens)`, 'tall');
    } else {
      beforeHtml = fig(await img(bDesk && path.join(BEFORE, bDesk), dw), 'Before, desktop') + fig(await img(bPhone && path.join(BEFORE, bPhone), 260), 'Before, phone', 'phone');
    }
    const afterHtml = [
      fig(await img(after(job, 'desktop', 'night'), dw), 'After, desktop, Night'),
      fig(await img(after(job, 'desktop', 'day'), dw), 'After, desktop, Day'),
      fig(await img(after(job, 'phone', 'night'), 260), 'After, phone, Night', 'phone'),
      fig(await img(after(job, 'phone', 'day'), 260), 'After, phone, Day', 'phone'),
    ].join('');
    body += `<article><header><h3>${esc(label)}</h3>${note ? `<p>${esc(note)}</p>` : ''}${checksFor(job)}</header>
      <div class="pair"><div class="side before"><h4>Before</h4><div class="imgs">${beforeHtml || '<p class="none">New screen; there was no before.</p>'}</div></div>
      <div class="side after"><h4>After</h4><div class="imgs">${afterHtml}</div></div></div></article>`;
  }
  body += '</section>';
}

// Brand flags (N7, N8): logo B drawn from the shipped geometry, the hero lines as text.
const logoB = `<svg viewBox="${LOGO_B.viewBox}" role="img" aria-label="Logo B" class="logo-b"><path fill="currentColor" d="${LOGO_B.letters}"/><path fill="#D2F000" d="${LOGO_B.body}"/><path fill="#12110E" d="${LOGO_B.visor}"/><path fill="#F3EFE4" fill-rule="evenodd" d="${LOGO_B.eyes}"/></svg>`;
const brand = `<section><h2>Brand switches (off until your yes)</h2><article><header><h3>Display font and 3D subject objects</h3><p>Bricolage Grotesque and the app's photo-real objects, shown with the preview switch on. Left: off (today). Right: on.</p></header>
  <div class="pair"><div class="side before"><h4>Off</h4><div class="imgs">${fig(await img(after('practice', 'desktop', 'night'), 720), 'Practice, Gabarito, no objects')}${fig(await img(after('onboarding-subjects', 'phone', 'night'), 260), 'Onboarding, no objects', 'phone')}</div></div>
  <div class="side after"><h4>On</h4><div class="imgs">${fig(await img(after('practice-art', 'desktop', 'night'), 720), 'Practice, Bricolage and objects')}${fig(await img(after('practice-art', 'desktop', 'day'), 720), 'Practice, Bricolage and objects, Day')}${fig(await img(after('onboarding-subjects-art', 'phone', 'night'), 260), 'Onboarding with objects', 'phone')}${fig(await img(after('onboarding-subjects-art', 'phone', 'day'), 260), 'Onboarding with objects, Day', 'phone')}</div></div></div></article>
  <article><header><h3>Logo</h3><p>Today's bolt mark and logo B (Mobi as the second o), from the same geometry as the app.</p></header>
  <div class="logos"><div class="logo-tile night"><span class="bolt-mark"><b>&#9889;</b> MockMob<i>.</i></span>${logoB}</div><div class="logo-tile day"><span class="bolt-mark"><b>&#9889;</b> MockMob<i>.</i></span>${logoB}</div></div></article>
  <article><header><h3>Hero line (N8)</h3></header><div class="lines"><p><b>A, shipping now:</b> "CUET mocks that show where your marks went."</p><p><b>Your line, after the fresh check ships:</b> "Find the marks you're losing. Repair the mistake. Prove it on fresh questions."</p></div></article></section>`;

let video = '';
const vfile = path.join(GATE, 'video', 'first-run-phone.webm');
if (existsSync(vfile)) {
  const v = await fs.readFile(vfile);
  if (v.length < 4.5 * 1024 * 1024) video = `<section><h2>First run in motion (phone, Night)</h2><article><header><p>Landing, the sample answered, sign-up, subjects, days, Today's first move, Start. Recorded headless at 375 px.</p></header><video controls muted playsinline src="data:video/webm;base64,${v.toString('base64')}"></video></article></section>`;
}

const shotsOk = report.filter((r) => r.file && !r.failed).length;
const overflow = report.filter((r) => r.overflowX > 0).length;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Website restructure, Gate A</title>
<style>
:root{--bg:#F3EFE6;--panel:#FFFDF8;--ink:#12110E;--muted:#5d5a52;--line:#ddd6c8;--volt:#D2F000;--flag:#a3361f;--ok:#3d6b12}
@media (prefers-color-scheme: dark){:root{--bg:#12110E;--panel:#1B1A16;--ink:#F4F0E6;--muted:#aaa392;--line:#312E27;--flag:#ff8a6b;--ok:#c5e35a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1560px;margin:0 auto;padding:24px 16px 80px}h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:40px 0 12px;padding-top:16px;border-top:1px solid var(--line)}h3{font-size:16px;margin:0}h4{font-size:12px;margin:0 0 6px;color:var(--muted);font-weight:600}
.lead{color:var(--muted);margin:0 0 20px;max-width:80ch}.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}.card ol,.card ul{margin:0;padding-left:20px}.card li{margin:6px 0}.card li b{display:inline-block;min-width:28px}
.def{display:inline-block;background:var(--volt);color:#12110E;border-radius:6px;padding:0 6px;font-size:12px;font-weight:700;margin-left:6px}
article{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0}article header p{margin:4px 0 0;color:var(--muted)}
.flag{color:var(--flag)!important;font-weight:600}.ok{color:var(--ok)!important;font-size:13px}
.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px;margin-top:12px}.side{min-width:0}.imgs{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}
figure{margin:0;flex:1 1 300px;max-width:720px;min-width:0}figure.phone{flex:0 1 200px;max-width:220px}figure.tall{flex:0 1 360px}figure img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:8px}figcaption{font-size:12px;color:var(--muted);margin-top:4px}
.after figure img{border-color:color-mix(in srgb,var(--volt) 55%,var(--line))}.none{color:var(--muted);font-style:italic}
.logos{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}.logo-tile{flex:1 1 320px;border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:16px;align-items:flex-start}.logo-tile.night{background:#12110E;color:#F4F0E6}.logo-tile.day{background:#F3EFE6;color:#12110E;border:1px solid #ddd6c8}
.logo-b{height:34px;width:auto}.bolt-mark{font-weight:800;font-size:22px}.bolt-mark b{background:#D2F000;color:#000;border-radius:6px;padding:0 4px;font-size:16px}.bolt-mark i{color:#D2F000;font-style:normal}
.lines p{margin:8px 0}video{display:block;max-width:375px;width:100%;margin-top:12px;border-radius:12px;border:1px solid var(--line)}
@media (max-width:900px){.pair{grid-template-columns:1fr}}
</style></head><body><main>
<h1>Website restructure, Gate A</h1>
<p class="lead">Before and after for every place a new student meets. Before: production captures and the old local build (15 Oct). After: branch web/ia-1015, local dev server, signed-in screens from the preview fixtures (sample data, no account). ${shotsOk} after captures at 375 x 812 and 1440 x 900, Night and Day; ${overflow ? `${overflow} with sideways scroll` : 'none with sideways scroll'}. Nothing is pushed or deployed.</p>
<div class="grid">
<div class="card"><h3>Your 9 decisions (recommended default in green)</h3><ol>${DECISIONS.map(([id, text, def]) => `<li><b>${id}</b> ${esc(text)}<span class="def">${esc(def)}</span></li>`).join('')}</ol></div>
<div class="card"><h3>What changed</h3><ul>${CHANGES.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>
</div>
${body}
${brand}
${video}
</main></body></html>`;
await fs.writeFile(path.join(GATE, 'gate-a.html'), html);
console.log('gate-a.html', (Buffer.byteLength(html) / 1024 / 1024).toFixed(2), 'MB');

// Overview PNG: the 8 most important pairs, 1600 px wide.
const OVERVIEW = [
  ['Landing, first screen', path.join(BEFORE, 'desktop-landing-1.png'), after('landing-hero', 'desktop', 'night')],
  ['The sample, answered', path.join(BEFORE, 'new-desktop-hero-demo-answered.jpg'), after('sample-answered', 'desktop', 'night')],
  ['Sign up', path.join(BEFORE, 'desktop-signup.png'), after('signup', 'desktop', 'night')],
  ['Today, first move', path.join(BEFORE, 'new-desktop-in-today-first-run-empty.jpg'), after('today-first', 'desktop', 'night')],
  ['Navigation on a phone', path.join(BEFORE, 'new-phone-in-more-menu.jpg'), after('nav-start-sheet', 'phone', 'night')],
  ['Practice', path.join(BEFORE, 'new-desktop-in-practice-1.jpg'), after('practice', 'desktop', 'night')],
  ['Review', path.join(BEFORE, 'new-desktop-in-review.jpg'), after('review', 'desktop', 'night')],
  ['Pricing', path.join(BEFORE, 'desktop-pricing-1.png'), after('pricing', 'desktop', 'night')],
];
const W = 1600, PAD = 24, COL = (W - PAD * 3) / 2, BOX_H = 480, LABEL = 44;
const rowH = LABEL + BOX_H + PAD;
const comps = [];
const text = (s, size, weight = 700, fill = '#F4F0E6') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LABEL}"><text x="${PAD}" y="${LABEL - 14}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text></svg>`);
const tag = (s, x) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="28"><rect width="120" height="28" rx="6" fill="${s === 'After' ? '#D2F000' : '#312E27'}"/><text x="12" y="19" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" fill="${s === 'After' ? '#12110E' : '#F4F0E6'}">${s}</text></svg>`);
for (const [i, [label, b, a]] of OVERVIEW.entries()) {
  const top = PAD + 56 + i * rowH;
  comps.push({ input: text(label, 24), top, left: 0 });
  for (const [j, file] of [b, a].entries()) {
    if (!existsSync(file)) continue;
    const input = await sharp(file).resize({ width: Math.round(COL), height: BOX_H, fit: 'contain', background: '#1B1A16', position: 'top' }).toBuffer();
    const left = Math.round(PAD + j * (COL + PAD));
    comps.push({ input, top: top + LABEL, left });
    comps.push({ input: tag(j ? 'After' : 'Before'), top: top + LABEL + 10, left: left + 10 });
  }
}
const H = PAD + 56 + OVERVIEW.length * rowH;
comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="56"><text x="${PAD}" y="40" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="#F4F0E6">Website restructure, Gate A: the 8 most important pairs (Night)</text></svg>`), top: 0, left: 0 });
await sharp({ create: { width: W, height: H, channels: 3, background: '#12110E' } }).composite(comps).png({ compressionLevel: 9, palette: false }).toFile(path.join(GATE, 'gate-a-overview.png'));
console.log('gate-a-overview.png', W, 'x', H);
