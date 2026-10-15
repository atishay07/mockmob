import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseExpiredAiCredits } from '../../src/services/credits/releaseExpired.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('the daily sweep asks the database to release up to 100 expired AI reservations and never throws', async () => {
  const seen = [];
  const db = { rpc: async (name, args) => { seen.push([name, args]); return { data: 3, error: null }; } };
  assert.deepEqual(await releaseExpiredAiCredits(db, 100), { ok: true, released: 3 });
  assert.deepEqual(seen, [['mm_ai_release_expired', { p_limit: 100 }]]);
  assert.deepEqual(await releaseExpiredAiCredits({ rpc: async () => ({ data: null, error: { message: 'no such function' } }) }), { ok: false, released: 0 });
  assert.deepEqual(await releaseExpiredAiCredits({ rpc: async () => { throw new Error('network'); } }), { ok: false, released: 0 });
  assert.deepEqual(await releaseExpiredAiCredits({ rpc: async () => ({ data: 0, error: null }) }), { ok: true, released: 0 });
});

test('the repair route allows 90 s (owner decision D1: Hobby with Fluid compute) and passes its start time on', () => {
  const route = read('src/app/api/recovery/repair/route.js');
  assert.match(route, /^export const maxDuration = 90;$/m);
  assert.match(route, /D1/);
  assert.match(route, /const startedAt = Date\.now\(\);/);
  assert.match(route, /repairMistake\(\{[^}]*startedAt \}\)/);
});

test('the existing daily cron route sweeps expired AI credits first, in its own guard, and reports the count', () => {
  const route = read('src/app/api/internal/finalise-sessions/route.js');
  assert.match(route, /import \{ releaseExpiredAiCredits \} from '@\/services\/credits\/releaseExpired';/);
  assert.match(route, /releaseExpiredAiCredits\(supabaseAdmin\(\), 100\)/);
  assert.ok(route.indexOf('releaseExpiredAiCredits(supabaseAdmin()') < route.indexOf('finaliseExpiredSessions('), 'the sweep runs before the finalisation, so a slow finalisation cannot starve it');
  assert.match(route, /aiCreditsReleased/);
  const cron = JSON.parse(read('vercel.json')).crons.map((c) => c.path);
  assert.ok(cron.includes('/api/internal/finalise-sessions'), 'the route is on a Vercel cron');
});

test('the OpenAI clients have a finite default timeout and every call passes the SDK `timeout` option', () => {
  const providers = read('src/services/ai/providers.js');
  assert.match(providers, /new OpenAI\(\{ apiKey, maxRetries: 0, timeout: DEFAULT_TIMEOUT_MS \}\)/);
  assert.match(providers, /DEFAULT_TIMEOUT_MS = [^;]*45_000/);
  const core = read('src/services/ai/providerCore.js');
  assert.match(core, /client\.chat\.completions\.create\(body, timeoutMs \? \{ timeout: timeoutMs \} : undefined\)/);
  assert.match(core, /client\.messages\.create\(body, timeoutMs \? \{ timeout: timeoutMs \} : undefined\)/);
});

test('Mistake Repair is wired to Luna first and Haiku 5.5 as the one fallback, with no model-routing change', () => {
  const service = read('src/services/recovery/mistakeRepair.js');
  assert.match(service, /REPAIR_ROUTE = Object\.freeze\(\{ provider: 'openai', model: process\.env\.AI_REPAIR_MODEL \|\| 'gpt-6-luna' \}\)/);
  assert.match(service, /REPAIR_EFFORT = Object\.freeze\(\{ repair: 'low', secondOpinion: 'high' \}\)/);
  assert.match(service, /provider: 'anthropic', model: process\.env\.AI_REPAIR_FALLBACK_MODEL \|\| 'claude-haiku-5-5', reasoningEffort: 'low'/);
  assert.match(service, /fallbackRoute: REPAIR_FALLBACK_ROUTE/);
  assert.doesNotMatch(service, /temperature/);
});

test('the migration for the Haiku price row is saved, not applied, and prices it at 0.10 / 0.50', () => {
  const sql = read('supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /\('anthropic','claude-haiku-5-5',0\.10,0\.50,/);
});

// ---- Repair v3 on the web (build spec 15 Oct 2026, A.1 and A.8) ----
import { readdirSync, statSync } from 'node:fs';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test('no screen says "Checked against the answer key" any more, and the repair has no stage timer', () => {
  const hits = walk(resolve(root, 'src')).filter((f) => /\.(jsx?|mjs|css)$/.test(f) && readFileSync(f, 'utf8').includes('Checked against the answer key'));
  assert.deepEqual(hits, []);
  const panel = read('src/components/recovery/MistakeRepair.jsx');
  assert.doesNotMatch(panel, /\bSTAGES\b/);
  assert.doesNotMatch(panel, /setInterval/);
  assert.match(panel, /REPAIR_LOADING\.slowAfterMs/);
  assert.match(panel, /REPAIR_LOADING\.longAfterMs/);
  assert.match(panel, /insights = null/, 'the page passes "From your record" lines in');
});

test('the repair styles: no stage list, no coloured side rails on blocks, 44 px targets, reduced motion shows the final state', () => {
  const css = read('src/components/recovery/mistake-repair.css');
  assert.doesNotMatch(css, /\.mr-stages|\.mr-card\b/);
  assert.doesNotMatch(css, /border-left:\s*[3-9]px/, 'no thick coloured side borders');
  assert.match(css, /\.mr-contrast \{[^}]*border-left: 2px solid var\(--a-ink-3/, 'the contrast pull line sits on a 2 px ink rail');
  for (const sel of ['.mr-disclose', '.mr-textbtn']) assert.match(css, new RegExp(`\\${sel} \\{[^}]*min-height: 44px`), `${sel} is 44 px`);
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.match(motion, /\.mr--done\[data-fresh\] > \[data-stagger\] \{ animation: mr-rise 220ms[^}]*calc\(var\(--mr-i, 0\) \* 50ms\)/);
  assert.match(motion, /\.mr-rule\[data-stagger\] \{ animation: mr-rule-in 520ms/);
  assert.match(motion, /\.mr-another \.mr-reveal \{ animation: mr-expand 200ms/);
  assert.match(motion, /\.mr-others \.mr-reveal:not\(\[hidden\]\) \{ animation: mr-expand 180ms/);
  for (const rule of motion.split('\n').filter((l) => /animation:/.test(l) && !/^\s*@keyframes/.test(l)))
    assert.match(rule, /:root:not\(\[data-motion='reduced'\]\)/, `motion is gated: ${rule.trim().slice(0, 80)}`);
  assert.match(css, /@keyframes mr-rise \{ from \{ opacity: 0; transform: translateY\(8px\); \}/);
  assert.match(css, /@keyframes mr-rule-in \{[^}]*scale\(\.98\)/);
});

// Fixture payloads rendered to HTML with the real component. JSX is compiled with the Next.js SWC binding the
// project already ships; next/link and the Mobi and notice components are replaced by plain stubs.
const ROOT_URL = pathToFileURL(`${root}/`).href;
const reactUrl = pathToFileURL(createRequire(resolve(root, 'package.json')).resolve('react')).href;
const HOOKS = `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'node:fs';
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
let rendered = null;
async function renderer() {
  if (rendered) return rendered;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const [{ RepairDone }, React, server] = await Promise.all([
    import(pathToFileURL(resolve(root, 'src/components/recovery/MistakeRepair.jsx')).href),
    import('react'),
    import('react-dom/server'),
  ]);
  rendered = (props) => server.renderToStaticMarkup(React.createElement(RepairDone, props));
  return rendered;
}
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const order = (html, needles) => needles.map((n) => { const at = html.indexOf(n); assert.ok(at >= 0, `missing: ${n}`); return at; });

const V3_FULL = {
  status: 'explained', charged: 1, wallet: { total: 43, state: 'ok' },
  practiceHref: '/test?subject=english&mode=quick&count=5&chapter=Correct+Word+Usage&recoveryFrom=a1',
  practiceAction: { type: 'practice', subject: 'english', chapter: 'Correct Word Usage', mode: 'quick', count: 5, attemptId: 'a1' },
  pattern: { line: '2 of your 3 repaired mistakes in Correct Word Usage had the same trap: a look-alike term.', scope: 'chapter', k: 2, n: 3, trapType: 'look_alike_term' },
  repair: {
    version: 3, trap_type: 'look_alike_term',
    trap: 'Option B sounds like the key and is a real word.', why_wrong: 'Effect is a noun, so it cannot follow "will".',
    why_right: 'Affect is the verb meaning to influence.', contrast: 'If it said "have an ___ on", option B would fit. It says "will ___", so option D.',
    others: [{ index: 2, why: 'Infect is about disease.' }, { index: 0, why: 'Afflict is too strong for a rule.' }],
    rule: 'After "will", use the verb: affect.', memory_hook: 'Affect is the Action.', another_way: 'Affect is the push; effect is what it leaves behind.',
    why_tempting: 'Option B sounds like the key and is a real word.', key_idea: 'After "will", use the verb: affect.', model: 'gpt-6-luna', generatedAt: '2026-10-15T09:12:03.000Z',
  },
};
const INSIGHTS = { lines: [
  { kind: 'change', text: 'You first chose C here, then changed to B.' },
  { kind: 'time', text: '41s on this question. Your median in this paper was 55s over 48 timed questions.' },
] };
const base = { chosen: 'B', answer: 'D', number: 7, scheme: 'cuet', folded: true, onToggleFold: () => {} };
const next = { number: 4, go: () => {} };
const nextButton = null;

test('a v3 payload with every field renders blocks 1 to 12 in the A.1 order', async () => {
  const render = await renderer();
  const html = render({ ...base, state: V3_FULL, insights: INSIGHTS, next, nextButton });
  const text = textOf(html);
  order(text, [
    'Q7. Your pick B. Key D.', // 1
    'A look-alike term', 'Explained from the answer key (D).', // 2
    'Why B looked right', V3_FULL.repair.trap, // 3
    'Where it breaks', V3_FULL.repair.why_wrong, // 4
    'Why D is right', V3_FULL.repair.why_right, V3_FULL.repair.contrast, // 5
    'The other options (2)', 'A. Afflict is too strong for a rule.', 'C. Infect is about disease.', // 6, served order
    'Keep this', V3_FULL.repair.rule, 'To remember it: Affect is the Action.', // 7
    'Explain it another way', // 8
    'From your record', INSIGHTS.lines[0].text, INSIGHTS.lines[1].text, V3_FULL.pattern.line, // 9
    'This answer cost 6 marks in this session: 5 not earned and 1 penalty.', // 10
    'Do this next', 'Practise 5 on Correct Word Usage', // 11
    '1 credit used. 43 left.', // 12
  ]);
  assert.match(html, /data-version="3"/);
  assert.match(html, /data-fresh="true"/, 'a fresh repair carries the motion hook');
  assert.match(html, /class="mr-reveal"[^>]*hidden=""/, 'the other options start closed');
  assert.match(html, /aria-expanded="false"/);
  assert.ok(!text.includes('Another way to see it'), 'the second explanation waits behind its button');
  assert.ok(!text.includes(V3_FULL.repair.another_way));
  assert.doesNotMatch(text, /Checked against/);
  assert.doesNotMatch(text, /[!—·]/, 'no exclamation mark, em dash or middle dot');
  assert.equal((html.match(/class="mr-rule"/g) || []).length, 1, 'one raised surface');
  // Stored: same blocks, rendered at once, and the fine print says no credit was used.
  const stored = textOf(render({ ...base, state: { ...V3_FULL, status: 'stored', charged: 0, wallet: null }, insights: null }));
  assert.ok(stored.includes('Saved repair. No credit used.'));
  assert.doesNotMatch(render({ ...base, state: { ...V3_FULL, status: 'stored' } }), /data-fresh/);
});

test('a v3 payload without the optional fields renders no empty heading', async () => {
  const render = await renderer();
  const bare = { ...V3_FULL, pattern: null, repair: { version: 3, trap_type: 'other', trap: V3_FULL.repair.trap, why_wrong: V3_FULL.repair.why_wrong, why_right: V3_FULL.repair.why_right, others: [], rule: V3_FULL.repair.rule } };
  const html = render({ ...base, state: bare, insights: { lines: [] } });
  const text = textOf(html);
  for (const absent of ['The other options', 'To remember it', 'Explain it another way', 'Another way to see it', 'From your record'])
    assert.ok(!text.includes(absent), `no "${absent}" without its content`);
  assert.doesNotMatch(html, /mr-contrast/);
  assert.ok(text.includes('The trap in this option'), 'an "other" trap reads as neutral wording');
  for (const present of ['Why B looked right', 'Where it breaks', 'Why D is right', 'Keep this', 'Explained from the answer key (D).']) assert.ok(text.includes(present), present);
  // Every <h5> has text.
  for (const m of html.matchAll(/<h5[^>]*>(.*?)<\/h5>/g)) assert.ok(textOf(m[1]).length > 0, 'an empty heading');
  // The pattern line alone still makes "From your record".
  assert.ok(textOf(render({ ...base, state: { ...bare, pattern: V3_FULL.pattern }, insights: null })).includes('From your record'));
  // Without a chapter name the action keeps its old wording.
  assert.ok(textOf(render({ ...base, state: { ...bare, practiceAction: null } })).includes('Practise 5 on this chapter'));
});

test('a v1 payload renders the v1 layout: "Mistake Repair", three blocks and its own next step, nothing from v3', async () => {
  const render = await renderer();
  const v1 = { status: 'stored', charged: 0, practiceHref: '/test?x=1', repair: { why_tempting: 'The old ratio is the first ratio you see.', why_wrong: 'A new ratio is stated.', key_idea: 'Sacrifice is old share minus new share.', next_step: 'Redo it with shares over ten.' } };
  const html = render({ ...base, state: v1, insights: INSIGHTS });
  const text = textOf(html);
  order(text, ['Mistake Repair', 'Explained from the answer key (D).', 'Why B looked right', v1.repair.why_tempting, 'Where it breaks', v1.repair.why_wrong, 'Keep this', v1.repair.key_idea, 'Do this next', v1.repair.next_step]);
  assert.match(html, /data-version="1"/);
  for (const absent of ['Why D is right', 'The other options', 'Explain it another way', 'To remember it']) assert.ok(!text.includes(absent), absent);
  const v2 = { ...v1, repair: { trap_type: 'reversed', trap: 'It flips cause and effect.', why_wrong: 'The passage says the opposite.', another_way: 'Read it backwards.', contrast: 'If it said X, B would fit.', rule: 'Check the direction.' } };
  const v2text = textOf(render({ ...base, state: v2 }));
  order(v2text, ['The relation turned around', 'Why B looked right', 'Where it breaks', 'Another way to see it', 'Read it backwards.', 'Keep this', 'Check the direction.']);
  assert.ok(!v2text.includes('Explain it another way'), 'a v2 payload shows its second explanation inline, as before');
});
