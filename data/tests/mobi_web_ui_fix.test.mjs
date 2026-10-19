// Mobi v13 on the website, "Fix it for good" (C-dec 3 and 3b, D157): Mistake Repair as Mobi's flagship job, reached from
// "Ask Mobi about Q7", priced before the tap ("Fix it for good · 1 credit", every plan). Your option, why it looked right
// with your own trap history, why the key is right, one rule, check 1 then check 2, then held (the server's words). The pure
// model, the wiring, and the real components rendered from fixtures (the repo's SWC loader, as repair_wiring.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register, createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FIX_COPY, heldFrom, heldView, historyLine, isFixJob, pickLines, showSecondCheck, slotHref, slotPayload,
} from '../../src/components/recovery/fixForGood.mjs';
import { standingView } from '../../src/components/ai/mobiJobs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const BANNED = /[!→←↗»]|Included in Pro|fair use|no credits on Pro/i;

const MOBI = {
  job: 'fix', price: 1, checks: 2,
  yourPick: { index: 1, text: 'Effect' }, key: { index: 3, text: 'Affect' },
  trap: { type: 'look_alike_term', phrase: 'A look-alike term' },
  history: { caught: 4, chances: 6, line: 'This trap has caught you 4 times in 6 chances.' },
  crowd: null, steps: ['trap', 'why_your_option', 'why_key', 'rule', 'check_1', 'check_2'],
};

test('the price is said before the tap, on every plan, and the key names the job', () => {
  assert.equal(FIX_COPY.startLabel, 'Fix it for good · 1 credit');
  assert.equal(FIX_COPY.askTitle(7), 'Ask Mobi about Q7');
  assert.equal(FIX_COPY.askTitle(null), 'Ask Mobi about this question');
  assert.equal(FIX_COPY.startAria(7), 'Fix it for good, 1 credit, for Q7', 'the accessible name starts with the visible words');
  assert.equal(FIX_COPY.startLine('B'), 'Why option B looked right, why the key is right and one rule to keep. Then 2 new questions to check the fix held.');
  assert.equal(FIX_COPY.check(2), 'Check 2 of 2');
  for (const v of Object.values(FIX_COPY)) assert.doesNotMatch(typeof v === 'function' ? v(3) : v, BANNED);
});

test('the job\'s own fields: your option and the key, and your trap history only with real counts behind it', () => {
  assert.equal(isFixJob({ mobi: MOBI }), true);
  assert.equal(isFixJob({ mobi: null }), false);
  assert.equal(isFixJob({}), false, 'an older payload renders as before');
  assert.deepEqual(pickLines(MOBI), { pick: { letter: 'B', text: 'Effect' }, key: { letter: 'D', text: 'Affect' } });
  assert.equal(pickLines({ ...MOBI, key: { index: 3, text: ' ' } }), null);
  assert.equal(historyLine(MOBI), 'This trap has caught you 4 times in 6 chances.');
  assert.equal(historyLine({ history: null }), null);
  assert.equal(historyLine({ history: { caught: 7, chances: 6, line: 'x' } }), null, 'caught never more than chances');
  assert.equal(historyLine({ history: { caught: 0, chances: 0, line: 'x' } }), null, 'no chance, no line');
});

test('check 1 then check 2 (slot 2), then held in the server\'s words; unknown stays unknown', () => {
  assert.equal(slotHref('a1', 'q1', 1), '/api/recovery/check?attemptId=a1&questionId=q1');
  assert.equal(slotHref('a1', 'q1', 2), '/api/recovery/check?attemptId=a1&questionId=q1&slot=2');
  const body = { attemptId: 'a', questionId: 'q', checkQuestionId: 'c', pick: 1, requestId: 'r'.repeat(16) };
  assert.deepEqual(slotPayload(body, 1), body, 'slot 1 is the existing request, unchanged');
  assert.deepEqual(slotPayload(body, 2), { ...body, slot: 2 });
  assert.deepEqual(heldFrom({ ok: true, held: true, heldLine: 'Both checks right. This fix is held. Revise brings it back in 3 days.' }), { held: true, line: 'Both checks right. This fix is held. Revise brings it back in 3 days.' });
  assert.deepEqual(heldFrom({ ok: true, result: { held: false } }), { held: false, line: null });
  assert.deepEqual(heldFrom({ ok: true, held: null, heldLine: null }), { held: null, line: null });
  assert.equal(heldView({ held: null, line: 'x' }), null, 'a check still open says nothing yet');
  assert.deepEqual(heldView({ held: true, line: 'Both checks right. This fix is held.' }), { held: true, title: 'Held', line: 'Both checks right. This fix is held.' });
  assert.equal(heldView({ held: false, line: null }).title, 'Not held yet');
  assert.equal(showSecondCheck({ fix: true, first: null }), false);
  assert.equal(showSecondCheck({ fix: true, first: { right: false } }), true, 'right or wrong, check 2 follows check 1');
  assert.equal(showSecondCheck({ fix: false, first: { right: true } }), false, 'an older payload keeps its one check');
});

test('wiring: Review\'s key and the result\'s start say the job and its price; check 2 and held follow check 1', () => {
  const sheet = read('src/components/review/AnswerSheet.jsx');
  assert.match(sheet, /aria-label=\{FIX_COPY\.startAria\(item\.number\)\}>\{FIX_COPY\.startLabel\}<\/button>/);
  const repair = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(repair, /<p className="mr-ask-title">\{FIX_COPY\.askTitle\(number\)\}<\/p>/);
  assert.match(repair, /<b>\{FIX_COPY\.start\}<\/b>/);
  assert.match(repair, /showCheck && showSecondCheck\(\{ fix, first \}\) \? \(\s*<RepairCheck attemptId=\{attemptId\} questionId=\{questionId\} check=\{null\} slot=\{2\} of=\{2\}/);
  assert.ok(repair.indexOf('slot={2}') > repair.indexOf('check={state.check}'), 'check 2 after check 1');
  assert.ok(repair.indexOf('className="mr-held"') > repair.indexOf('slot={2}'), 'held after check 2');
  assert.ok(repair.indexOf('className="mr-held"') < repair.indexOf('mr-record'), 'all of it before "From your record"');
  const check = read('src/components/recovery/RepairCheck.jsx');
  assert.match(check, /const href = slot === 2 \? slotHref\(attemptId, questionId, 2\) : safeCheckHref/);
  assert.match(check, /submitCheck\(fetch, slotPayload\(\{ attemptId, questionId, checkQuestionId: open\.checkQuestionId, pick, requestId: requestId\.current \}, slot\)\)/);
  assert.match(check, /\{of \? FIX_COPY\.check\(slot\) : CHECK_COPY\.title\}/);
  const result = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(result, /if \(row\.verdict === 'wrong' && Number\.isInteger\(row\.d\?\.givenIndex\) && !sealedOf\(row\) && !repairOutcomes\[row\.q\.id\]\) return null;/,
    'an open, unfixed wrong answer has one "Ask Mobi about Q7": the fix itself');
});

// ---- The real components, rendered from fixtures ------------------------------------------------------------------------
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
  './RepairMobi': 'export default function RepairMobi() { return null; }',
  './KeyReviewNotice': 'export default function KeyReviewNotice() { return null; }',
  './AnswerCorrectionNotice': 'export default function AnswerCorrectionNotice() { return null; }',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
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
async function components() {
  if (loaded) return loaded;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const [{ RepairDone }, parts, React, server] = await Promise.all([
    import(pathToFileURL(resolve(root, 'src/components/recovery/MistakeRepair.jsx')).href),
    import(pathToFileURL(resolve(root, 'src/components/ai/MobiJobParts.jsx')).href),
    import('react'),
    import('react-dom/server'),
  ]);
  const html = (type, props) => server.renderToStaticMarkup(React.createElement(type, props));
  loaded = { RepairDone, ...parts, html };
  return loaded;
}
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const inOrder = (text, needles) => { let at = -1; for (const n of needles) { const i = text.indexOf(n, at + 1); assert.ok(i > at, `in order: ${n}`); at = i; } };

const V3 = {
  status: 'explained', charged: 1, wallet: { total: 43, state: 'ok' },
  repair: {
    version: 3, trap_type: 'look_alike_term', trap: 'Option B sounds like the key and is a real word.', why_wrong: 'Effect is a noun, so it cannot follow "will".',
    why_right: 'Affect is the verb meaning to influence.', others: [], rule: 'After "will", use the verb: affect.', memory_hook: null, another_way: null,
    generatedAt: '2026-10-20T09:12:03.000Z',
  },
};
const base = { chosen: 'B', answer: 'D', number: 7, scheme: 'cuet', folded: true, onToggleFold: () => {} };

test('render: a v13 fix reads your option and the key, why it looked right with your history, why the key is right, the rule', async () => {
  const { RepairDone, html } = await components();
  const text = textOf(html(RepairDone, { ...base, state: { ...V3, mobi: MOBI } }));
  inOrder(text, [
    'Your option', 'B Effect', 'The key', 'D Affect',
    'Why B looked right', V3.repair.trap, MOBI.history.line,
    'Where it breaks', V3.repair.why_wrong,
    'Why D is right', V3.repair.why_right,
    'Keep this', V3.repair.rule,
    '1 credit used. You have 43.',
  ]);
  // An older payload (no job) keeps its old layout: no option rows, no history line.
  const old = textOf(html(RepairDone, { ...base, state: V3 }));
  assert.doesNotMatch(old, /Your option|caught you/);
  assert.match(old, /Why B looked right/);
});

test('render: Where you stand from fixtures, ready with a college and with none, thin, and loading', async () => {
  const { StandingCard, html } = await components();
  const ready = {
    ok: true, status: 'ready', band: { low: 610, mid: 645, high: 680, max: 1000, count: 4, complete: true, papers: [] }, thin: [],
    colleges: [{ college: 'Shri Ram College of Commerce', programme: 'B.Com (Hons)', programmeId: 'srcc', cutoff: 712, category: 'UR', position: 'below', gap: 67 }],
    first: { college: 'Shri Ram College of Commerce', programme: 'B.Com (Hons)', programmeId: 'srcc', cutoff: 712, category: 'UR', position: 'below', gap: 67 },
    closeFastest: [{ subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Share Capital', marks: 38, wrong: 6, blank: 2 }],
    note: 'From your own practice, before NTA normalisation. Not a prediction.', links: { colleges: '/admission-compass' },
  };
  const out = html(StandingCard, { view: standingView({ phase: 'done', body: ready }) });
  inOrder(textOf(out), [
    'Where you stand', 'Free', 'Your practice puts you at 610 to 680 out of 1000.', '610 to 680', 'out of 1000, from your practice',
    'Shri Ram College of Commerce, B.Com (Hons)', 'Closed at 712 in 2026 Round 1, for the UR category.', 'You are 67 marks short of it at the middle of your range.',
    'What closes the gap fastest', 'Share Capital', '38 marks open',
    'From your own practice, before NTA normalisation. Not a prediction.',
  ]);
  assert.match(out, /href="\/test\?subject=accountancy&amp;mode=quick&amp;count=10&amp;chapter=Share\+Capital"/, 'each chapter links into its practice');
  assert.match(out, /class="mj-bar" aria-hidden="true"/, 'the bar is decoration; the words carry it');
  const none = textOf(html(StandingCard, { view: standingView({ phase: 'done', body: { ...ready, colleges: [], first: null } }) }));
  assert.match(none, /Add the colleges you want, and Mobi sets your range against their 2026 Round 1 closing marks\. Add your colleges/);
  const thin = textOf(html(StandingCard, { view: standingView({ phase: 'done', body: { ok: true, status: 'thin', band: null, thin: [{ subject: 'economics', name: 'Economics', needed: 18 }] } }) }));
  assert.match(thin, /Mobi gives a range once a paper has 30 questions answered or skipped\. Economics 18 more questions to go/);
  const wait = html(StandingCard, { view: standingView({ phase: 'loading' }) });
  assert.match(wait, /aria-busy="true"/);
  assert.match(textOf(wait), /Working out where you stand\./);
});

test('render: tonight\'s set and the 2 questions of a doubt, from fixtures', async () => {
  const { TonightBlock, DoubtChecks, html } = await components();
  const tonight = textOf(html(TonightBlock, {
    tonight: { chapters: [{ subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Share Capital', lost: 38 }], rules: ['Read NOT twice.'], traps: [{ phrase: 'A missed NOT or EXCEPT', caught: 4, chances: 6 }], reviseDue: 2, line: null },
    actions: [{ label: 'Open Revise', route: '/review/revise' }], onNavigate: () => {},
  }));
  inOrder(tonight, ['Chapters to look at', 'Share Capital', '38 marks lost', 'Your rules to keep', 'Read NOT twice.', 'Traps that catch you', 'A missed NOT or EXCEPT has caught you 4 times in 6 chances.', '2 Revise cards are due.', 'Open Revise']);
  const q = (id) => ({ checkQuestionId: id, subject: 'accountancy', chapter: 'Share Capital', question: `Which is right, ${id}?`, options: [0, 1, 2, 3].map((i) => ({ index: i, text: `Choice ${i}` })) });
  const checks = html(DoubtChecks, { threadId: 't1', checks: [q('a'), q('b')], subject: 'accountancy', chapter: 'Share Capital' });
  inOrder(textOf(checks), ['Test it on 2 real CUET questions', 'on Share Capital', 'Question 1 of 2', 'Which is right, a?', 'A Choice 0', 'Check my answer', 'Question 2 of 2', 'Which is right, b?']);
  assert.equal((checks.match(/type="radio"/g) || []).length, 8);
  const chips = textOf(html(DoubtChecks, { threadId: 't1', checks: [], note: 'Pick the chapter and Mobi adds 2 real CUET questions on it to test this.', subject: 'accountancy' }));
  assert.match(chips, /Pick the chapter and Mobi adds 2 real CUET questions on it to test this\. Pick the chapter Partnership Fundamentals/);
});
