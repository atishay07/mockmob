// Writes <out>/index.md from <out>/index.json (the state learn-1101-audit-capture.mjs keeps).
//   node scripts/design-audit/learn-1101-audit-index.mjs tmp/learn-1101/audit [extra-notes.json]
// extra-notes.json (optional): { "notCaptured": ["..."], "observations": ["..."] } appended under their headings.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = resolve(process.argv[2] || 'tmp/learn-1101/audit');
const extra = process.argv[3] && existsSync(process.argv[3]) ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : {};
const s = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'));
const IGNORE = /Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|status of 401|favicon|Download the React DevTools/i;
const onDisk = new Set(readdirSync(OUT).filter((f) => f.endsWith('.png')));
const pngs = s.pngs.filter((p) => onDisk.has(p.file)).sort((a, b) => a.file.localeCompare(b.file));
const failedShots = [...onDisk].filter((f) => f.startsWith('ZZ-FAILED'));
const sizeNum = (x) => Number(String(x).split(' ')[0]);
const L = [];
const w = (x = '') => L.push(x);

w('# Learn v2 audit capture, 1 Nov 2026');
w();
w(`Build: wt-1031-learn-v2 (branch web/1031-learn-v2), development preview at http://localhost:3451 with the bundled real decks (&decks=real) and an in-memory student. Capture script: scripts/design-audit/learn-1101-audit-capture.mjs. Sizes: desktop 1440x900 and 1366x768 (scale 1, mouse), phone 390x844 and 360x780 (scale 2, touch, isMobile). Night for every shot, Day for the listed ones.`);
w(`PNG count: ${pngs.length} (plus ${failedShots.length} failure screenshots, named ZZ-FAILED-*, not counted).`);
w();
w('## 1. Captures (one line per PNG)');
w();
w('Format: file | URL (all start with /preview/arena?decks=real&study=on&, a &kcs= student key is added per run) | what it shows | size | theme');
w();
for (const p of pngs) w(`- ${p.file} | ${p.url.replace('/preview/arena?decks=real&study=on&', '')} | ${p.what} | ${p.size} | ${p.theme}`);
w();

// ---- Measurements ----
const M = s.measures || {};
const f = (v) => (v == null ? 'n/a' : v);
w('## 2. Measurements on the Explore feed');
w();
w('Method: a fresh in-memory student per measurement, feed of Admission of a Partner at 10 min (Pro). Wheel input is CDP Input.dispatchMouseEvent mouseWheel through playwright mouse.wheel, on the stage centre; it is a pixel-precise wheel, which can differ from a real notched mouse wheel or a laptop trackpad, so treat the wheel numbers as how Chromium handles this scroll-snap container, not as proof for every device. Phone swipes are synthetic touch events (no real finger fling).');
w();
for (const size of [1440, 1366]) {
  const m = M[`feed-${size}`];
  if (!m) { w(`### ${size}: not measured`); w(); continue; }
  w(`### Desktop ${m.size}`);
  w();
  const g = (x) => (x ? `scrollTop ${x.before.top} before, ${x.after1s.top} after 1 s (active item ${x.before.active} to ${x.after1s.active}), ${x.after2_5s.top} after 2.5 s; settled mid-way between items: ${x.after1s.midway || x.after2_5s.midway ? 'yes' : 'no'}; items moved: ${x.itemsMoved}; the gesture took ${x.gestureMs} ms` : 'n/a');
  w(`- (a1) one wheel event, deltaY 100: ${g(m.wheelSingle)}.`);
  w(`- (a2) trackpad-like burst, 6 events of deltaY 40 (${m.wheelBurst ? m.wheelBurst.gestureMs : 'n/a'} ms in total): ${g(m.wheelBurst)}.`);
  if (m.wheelThreeTicks) w(`- (a3) three wheel ticks of deltaY 100, 1.3 s apart: ${m.wheelThreeTicks.map((t, i) => `after tick ${i + 1}: scrollTop ${t.top}, item ${t.active}${t.midway ? ' (mid-way)' : ''}`).join('; ')}.`);
  if (m.wheelSingleEventThreshold) w(`- (a4) one single wheel event of larger size, items moved after 1.5 s: ${m.wheelSingleEventThreshold.map((t) => `deltaY ${t.singleEventDeltaY} moved ${t.itemsMoved} (scrollTop ${t.top}${t.midway ? ', mid-way' : ''})`).join('; ')}.`);
  if (m.wheelExtra) w(`- (a5) longer wheel bursts: ${m.wheelExtra.map((t) => `${t.events} x deltaY ${t.deltaY} (${t.totalPx} px, ${t.gestureMs} ms) moved ${t.itemsMoved} item(s), scrollTop ${t.top}${t.midway ? ' mid-way' : ''}`).join('; ')}.`);
  w(`- (b) keys, each pressed once on the page (not in a text field), 1.1 s wait: ${(m.keys || []).map((k) => `${k.key}: ${k.from} to ${k.to}${k.moved ? ' (moved)' : k.changed ? ' (state changed, did not move)' : ' (nothing happened)'}`).join('; ')}.`);
  if (m.arrowAfterBackdropClick) w(`- (b2) ArrowDown after a mouse click on the empty area left of the stage: item ${m.arrowAfterBackdropClick.from} to ${m.arrowAfterBackdropClick.to}.`);
  const own = (m.controlsCard || []).filter((c) => /^fx-/.test(c.cls));
  w(`- (c) visible control to go to the next or previous item: ${(m.controlsNavLike || []).length ? `yes: ${m.controlsNavLike.map((c) => c.label).join(', ')}` : 'none'}. Controls on top at the first card (feed layer only): ${own.map((c) => `${c.label.slice(0, 30)} [${c.cls}, ${c.w}x${c.h} at ${c.x},${c.y}]`).join('; ')}. Progress ticks: ${m.ticks ? `${m.ticks.count} ticks, ${m.ticks.tag}, clickable: ${m.ticks.clickable}` : 'n/a'}. Hint text on screen: ${(m.hint || []).map((h) => `"${h.text}"`).join(', ') || 'none'}.`);
  const st = m.stage; const sq = M[`stage-question-${size}`];
  if (st) { const c = st.parts['.fx-card']; const r = st.parts['.fx-rail']; const x1 = r ? r.x + r.w : c.x + c.w; w('- (d) stage width on the first card: the card is ' + f(c?.w) + ' px wide (' + (st.mainShare * 100).toFixed(1) + ' percent of the ' + st.vw + ' px viewport), at x ' + f(c?.x) + '; with the Keep and Chapter rail the stage runs x ' + f(c?.x) + ' to ' + x1 + ', ' + (x1 - c.x) + ' px or ' + (((x1 - c.x) / st.vw) * 100).toFixed(1) + ' percent of the viewport; empty left of it ' + c.x + ' px, empty right ' + (st.vw - x1) + ' px; the card is ' + f(c?.h) + ' px high in a ' + st.vh + ' px viewport.'); }
  if (sq) w(`- (d2) stage width on a question: ${f(sq.parts['.fx-q']?.w)} px wide (${sq.mainShare != null ? (sq.mainShare * 100).toFixed(1) : 'n/a'} percent of the viewport), x ${f(sq.parts['.fx-q']?.x)}.`);
  w();
}
for (const size of [390, 360]) {
  const m = M[`feed-${size}`];
  if (!m) { w(`### Phone ${size}: not measured`); w(); continue; }
  w(`### Phone ${m.size}`);
  w();
  const sw = (a) => (a || []).map((x) => `swipe ${x.swipe}: item ${x.from} to ${x.to} (${x.itemsMoved === 1 ? 'exactly one' : x.itemsMoved === 0 ? 'none, snapped back' : `${x.itemsMoved} items`}), scrollTop ${x.top}${x.midway ? ', mid-way' : ''}`).join('; ');
  w(`- (e) touch swipe up of 300 px, 12 touchmove steps 16 ms apart (about 190 ms, slow drag), three in a row: ${sw(m.swipe300px16msSteps)}.`);
  if (m.swipe300pxFlick40ms) w(`- (e2) the same 300 px as a quick flick, 6 steps 7 ms apart (about 40 ms): ${sw(m.swipe300pxFlick40ms)}.`);
  if (m.swipe300pxGesture800pxs) w(`- (e3) the same 300 px as the browser's own touch scroll gesture at 800 px/s: ${sw(m.swipe300pxGesture800pxs)}.`);
  const own = (m.controlsCard || []).filter((c) => /^fx-/.test(c.cls));
  w(`- Visible next or previous control: ${(m.controlsNavLike || []).length ? m.controlsNavLike.map((c) => c.label).join(', ') : 'none'}. Controls on top at the first card: ${own.map((c) => `${c.label.slice(0, 30)} [${c.w}x${c.h}]`).join('; ')}.`);
  const st = m.stage; const sq = M[`stage-question-${size}`];
  if (st) w(`- Stage: the card is ${f(st.parts['.fx-card']?.w)} px wide (${(st.mainShare * 100).toFixed(1)} percent of ${st.vw} px)${sq ? `; a question is ${f(sq.parts['.fx-q']?.w)} px wide (${sq.mainShare != null ? (sq.mainShare * 100).toFixed(1) : 'n/a'} percent)` : ''}.`);
  w();
}
// stage widths on all four sizes in one line
w('Stage width as a share of the viewport, all four sizes (card, then question): ' + [1440, 1366, 390, 360].map((z) => `${z}: ${M[`stage-card-${z}`] ? (M[`stage-card-${z}`].mainShare * 100).toFixed(1) : 'n/a'} percent, ${M[`stage-question-${z}`] && M[`stage-question-${z}`].mainShare != null ? (M[`stage-question-${z}`].mainShare * 100).toFixed(1) + ' percent' : 'n/a'}`).join('; ') + '.');
w();

// ---- Loads and errors ----
w('## 3. Time to first meaningful content, console errors and failed requests, per page');
w();
w('Time is milliseconds from the start of page.goto to the first visible meaningful element (the covers, the chapter rows, the card, and so on) after a warm-up pass that loaded each route once, so the numbers are warm development-server timings, not production. "unexpected" console errors are those that are not the preview fixture noise (503, 418, 404, 402, 401 responses and the like). http = responses with status 400 or higher; failed = requests that never completed (aborted navigations count here).');
w();
w('Format: job size theme | load times (ms) | console errors (unexpected) | failed requests | http errors | CLS | sideways spill px | notes');
w();
const uniqErr = new Map(); const uniqFail = new Map(); const uniqHttp = new Map();
for (const p of [...s.pages].sort((a, b) => (a.job + a.size + a.theme).localeCompare(b.job + b.size + b.theme))) {
  const unexpected = p.errors.filter((e) => !IGNORE.test(e));
  for (const e of unexpected) uniqErr.set(e, (uniqErr.get(e) || 0) + 1);
  for (const e of p.failed) uniqFail.set(e, (uniqFail.get(e) || 0) + 1);
  for (const e of p.http) uniqHttp.set(e, (uniqHttp.get(e) || 0) + 1);
  w(`- ${p.job} ${p.size} ${p.theme === 'dark' ? 'night' : 'day'} | ${(p.loads || []).map((l) => l.ms).join(', ') || 'n/a'} | ${p.errors.length} (${unexpected.length}) | ${p.failed.length} | ${p.http.length} | ${p.cls} | ${p.spill} | ${(p.notes || []).join(' ; ') || '-'}`);
}
w();
const loads = s.pages.flatMap((p) => (p.loads || []).map((l) => ({ job: p.job, size: p.size, ms: l.ms })));
if (loads.length) {
  const byJob = new Map();
  for (const l of loads) { const k = l.job; const a = byJob.get(k) || []; a.push(l.ms); byJob.set(k, a); }
  w('Summary of load times by job (min / median / max, ms): ' + [...byJob.entries()].map(([k, a]) => { a.sort((x, y) => x - y); return `${k} ${a[0]} / ${a[Math.floor(a.length / 2)]} / ${a[a.length - 1]}`; }).join('; ') + '.');
  w();
}
w('Unexpected console errors (unique, with count):');
if (!uniqErr.size) w('- none');
for (const [e, n] of uniqErr) w(`- ${n} x ${e}`);
w();
w('Failed requests (unique, with count):');
if (!uniqFail.size) w('- none');
for (const [e, n] of uniqFail) w(`- ${n} x ${e}`);
w();
w('HTTP responses with status 400 or higher (unique, with count; 402 on Free is the designed limit):');
if (!uniqHttp.size) w('- none');
for (const [e, n] of uniqHttp) w(`- ${n} x ${e}`);
w();

// ---- Not captured ----
w('## 4. Anything not captured, and why');
w();
const nc = [...(s.failures || []).map((x) => `${x.job} at ${x.size} ${x.theme === 'dark' ? 'night' : 'day'}: ${x.message}`), ...(s.notes || []), ...(extra.notCaptured || [])];
if (!nc.length) w('- nothing missing');
for (const n of nc) w(`- ${n}`);
w();
if ((extra.observations || []).length) {
  w('## 5. Observations while capturing');
  w();
  for (const o of extra.observations) w(`- ${o}`);
  w();
}
w('## 6. Clean-up');
w();
for (const c of s.cleanup || []) w(`- ${c}`);
writeFileSync(join(OUT, 'index.md'), L.join('\n') + '\n');
console.log('wrote', join(OUT, 'index.md'), pngs.length, 'PNGs');
