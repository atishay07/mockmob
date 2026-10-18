// W-032, "Repair lets the student retry before seeing the key": the free "Try it again" step on the result's Your mistakes (release 8).
//   - the rules (retryEligible, retryGrade, retrySaid) and the words (RETRY_COPY), pure;
//   - a retry never calls a paid route, and the paid Repair is not mounted until the key has been revealed (source tests);
//   - the key is not in a sealed row's markup at all, and the opened sealed row shows the student's pick (rendered with the real
//     components, server side, the way data/tests/repair_wiring.test.mjs renders the repair);
//   - one component: Review's answer sheet and the result's mistakes use the same free steps, and the labels come from actionLabel.
// Run: node --test data/tests/retry_first.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACTION_LABELS, actionLabel } from '../repair_presentation.mjs';
import { RETRY_COPY, retryEligible, retryGrade, retrySaid } from '../retry_first.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');

// ---------- the rules ----------
const WRONG = { verdict: 'wrong', keyIndex: 2, optionCount: 4 };
const BLANK = { verdict: 'skipped', keyIndex: 0, optionCount: 4 };

test('a wrong answer and a blank open sealed when no repair exists and the key is known', () => {
  assert.equal(retryEligible(WRONG), true);
  assert.equal(retryEligible(BLANK), true, 'a blank is retried the same way (Try it again, free)');
  assert.equal(retryEligible({ ...WRONG, keyIndex: 0 }), true, 'the first option can be the key');
  assert.equal(retryEligible({ ...WRONG, keyIndex: 3 }), true, 'the last option can be the key');
});

test('everything else opens as before: right answers, saved repairs, repairs written, held keys, unknown keys', () => {
  assert.equal(retryEligible({ ...WRONG, verdict: 'correct' }), false, 'a right answer has nothing to retry');
  assert.equal(retryEligible({ ...WRONG, saved: true }), false, 'a saved repair opens free (F17)');
  for (const outcome of ['explained', 'stored', 'held_for_recheck', 'not_explained', 'corrected_key']) assert.equal(retryEligible({ ...WRONG, outcome }), false, outcome);
  assert.equal(retryEligible({ ...WRONG, hasReview: true }), false, 'a key under re-check or corrected');
  assert.equal(retryEligible({ ...WRONG, keyIndex: null }), false, 'a try cannot be marked without a key');
  assert.equal(retryEligible({ ...WRONG, keyIndex: 4 }), false, 'a key outside the options');
  assert.equal(retryEligible({ ...WRONG, keyIndex: -1 }), false);
  assert.equal(retryEligible({ ...WRONG, optionCount: 0 }), false);
  assert.equal(retryEligible({ ...WRONG, optionCount: 1, keyIndex: 0 }), false, 'one option is not a question');
  assert.equal(retryEligible({}), false);
  assert.equal(retryEligible(), false);
});

test('a try is marked against the key it was given, and only the right option is right', () => {
  assert.deepEqual(retryGrade(2, 2), { pick: 2, right: true });
  assert.deepEqual(retryGrade(0, 2), { pick: 0, right: false });
  assert.deepEqual(retryGrade(null, 2), { pick: null, right: false });
  assert.deepEqual(retryGrade(2, null), { pick: 2, right: false }, 'no key, no right');
  assert.deepEqual(retryGrade('2', 2), { pick: null, right: false }, 'only an option index counts');
});

test('what the page says after a try: "Got it this time." when right, the pick and the answer when not, and always that it is not recorded', () => {
  assert.deepEqual(retrySaid({ pick: 2, keyIndex: 2, right: true }), { lead: 'Got it this time.', rest: 'This try is not recorded.', right: true });
  assert.deepEqual(retrySaid({ pick: 1, keyIndex: 2, right: false }), { lead: 'Not B.', rest: 'The answer is C. This try is not recorded.', right: false });
  assert.deepEqual(retrySaid({ pick: 0, keyIndex: 3, right: false }), { lead: 'Not A.', rest: 'The answer is D. This try is not recorded.', right: false });
  assert.equal(retrySaid({ pick: null, keyIndex: 2, right: false }).lead, 'Not this one.');
});

test('the words: the step label is actionLabel\'s, and nothing says what the owner removed or breaks the copy rules', () => {
  assert.equal(RETRY_COPY.try, ACTION_LABELS.again);
  assert.equal(RETRY_COPY.try, actionLabel('blank'), 'Try it again is the blank\'s one label everywhere');
  assert.equal(RETRY_COPY.show, 'Show the answer');
  assert.equal(RETRY_COPY.hidden, 'The answer stays hidden until you ask.');
  const lines = [
    ...Object.values(RETRY_COPY).filter((v) => typeof v === 'string'),
    RETRY_COPY.repairComes(7), RETRY_COPY.repairComes(null), RETRY_COPY.noExplanation(true), RETRY_COPY.noExplanation(false),
    ...[retrySaid({ pick: 1, keyIndex: 2, right: false }), retrySaid({ pick: 2, keyIndex: 2, right: true })].flatMap((s) => [s.lead, s.rest]),
  ];
  for (const line of lines) {
    assert.doesNotMatch(line, /repair first|repair in \d|check it here/i, line);
    assert.doesNotMatch(line, /[!—·]/, `no exclamation mark, em dash or middle dot: ${line}`);
    assert.doesNotMatch(line, /\b[A-Z]{4,}\b/, `no ALL-CAPS word: ${line}`);
  }
  assert.equal(RETRY_COPY.repairComes(7), 'Repair Q7 comes after, for 1 AI credit.');
  assert.equal(RETRY_COPY.repairComes(null), 'Repair comes after, for 1 AI credit.');
  assert.equal(RETRY_COPY.noExplanation(false), 'This question has no book explanation yet.', 'a blank has no repair to point at');
  assert.match(RETRY_COPY.noExplanation(true), /A repair writes why your pick looked right and why the key is right\.$/);
});

// ---------- a retry never calls a paid route ----------
const RETRY_FILES = ['data/retry_first.mjs', 'src/components/review/freeSteps.jsx', 'src/components/result/RetryFirst.jsx'];

test('the retry, its words and its components never reach the server: no fetch, no API route, no repair, no wallet', () => {
  for (const file of RETRY_FILES) {
    const src = code(file);
    for (const banned of [/\bfetch\s*\(/, /\bapiPost\b/, /\bapiGet\b/, /\/api\//, /requestRepair/, /repair_client/, /MistakeRepair/, /useWalletSummary/, /AuthContext|useAuth/, /XMLHttpRequest/, /sendBeacon/, /\bWebSocket\b/, /localStorage|sessionStorage|indexedDB/]) {
      assert.doesNotMatch(src, banned, `${file} uses ${banned}`);
    }
    // Only these modules are imported, none of which can make a call.
    const imports = [...src.matchAll(/^import .*? from '([^']+)';?$/gm)].map((m) => m[1]);
    for (const spec of imports) assert.ok(['react', '@/../data/retry_first.mjs', '@/../data/option_text', '@/components/review/freeSteps', './repair_presentation.mjs', './stemText.mjs'].includes(spec) || spec.endsWith('.css'), `${file} imports ${spec}`);
  }
});

const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
const bodyAt = page.indexOf('const renderBody = (row) => {');
const renderBody = page.slice(bodyAt, page.indexOf('\n  };\n', bodyAt));

test('on the result, the sealed body is returned before the paid Repair is mounted, so a retry can never start one', () => {
  const sealedAt = renderBody.indexOf('if (sealedOf(row)) {');
  const repairAt = renderBody.indexOf('<MistakeRepair');
  assert.ok(sealedAt > 0 && repairAt > sealedAt, 'the sealed return comes first');
  const sealedBlock = renderBody.slice(sealedAt, renderBody.indexOf('\n    }\n', sealedAt));
  assert.ok(!sealedBlock.includes('MistakeRepair'), 'no repair in the sealed body');
  assert.match(sealedBlock, /<RetryFirst q=\{questionModel\(q, d\)\}/);
  // The two ways out of the sealed body only reveal; they call nothing else.
  assert.match(sealedBlock, /onTried=\{\(\{ pick, right \}\) => reveal\(row, \{ how: 'tried', pick, right \}\)\} onShow=\{\(\) => reveal\(row, \{ how: 'shown' \}\)\}/);
  const reveal = page.match(/const reveal = \(row, how\) => \{[\s\S]*?\n  \};/)[0];
  assert.match(reveal, /setRetried\(/);
  assert.doesNotMatch(reveal, /apiPost|apiGet|fetch\(|requestRepair|run\(|setStarted|noteStart|jumpTo/, 'reveal only reveals');
});

test('a Repair pressed on a sealed mistake opens the retry; the paid start waits for the student\'s own tap', () => {
  // The auto-start rule is unchanged for every row that is not sealed; a sealed row never mounts the repair, and revealing it drops a stale auto-start.
  assert.match(renderBody, /autoStart=\{autoRepair === q\.id \|\| savedIds\.has\(q\.id\)\}/);
  assert.match(page, /if \(autoRepair === row\.q\.id\) setAutoRepair\(null\);/);
  // The paid key is still the repair's own start button, with its cost line (MistakeRepair's RepairStart), mounted after the reveal.
  const repair = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(repair, /<RepairStart chosen=\{chosen\} number=\{number\} onStart=\{\(\) => \{ started\.current = true; run\(\); \}\} \/>/);
  assert.match(repair, /<RepairCost \/>/);
});

test('the key, the book explanation and the repair appear only after the student asked: the explanation opens, the status line leads', () => {
  assert.match(renderBody, /\{tried\?\.how === 'tried' \? <RetrySaid said=\{retrySaid\(\{ pick: tried\.pick, keyIndex: q\.correctIndex, right: tried\.right \}\)\} \/> : null\}/);
  assert.match(renderBody, /isWrong && !tried \? \(\s*<details className="rp-expl">/, 'an unasked wrong answer keeps its collapsed explanation; a revealed one opens it');
  assert.match(renderBody, /RETRY_COPY\.noExplanation\(isWrong && Number\.isInteger\(given\)\)/);
  // One Ask Mobi line per mistake: in the sealed body and in the revealed one it is the same single `foot`.
  assert.equal([...renderBody.matchAll(/askAbout\(row\)/g)].length, 1, 'askAbout is written once and shared');
  assert.equal([...renderBody.matchAll(/\{foot\}/g)].length, 2, 'both bodies end with it');
  assert.match(page, /hasExplanation\(repairOutcomes\[row\.q\.id\]\) \? null : askContextOf\(row\)/);
});

test("after a try the paper's own pick is \"Your first pick\", so it cannot be read as the try", () => {
  assert.equal(RETRY_COPY.firstPick, 'Your first pick');
  assert.match(renderBody, /: tried\?\.how === 'tried' \? RETRY_COPY\.firstPick : 'Your pick'/);
});

test('the page seals a mistake from real state: no saved repair, no repair outcome, no key review, a known key', () => {
  assert.match(page, /const sealedOf = \(row\) => !retried\[row\.q\.id\] && retryEligible\(\{/);
  assert.match(page, /saved: savedIds\.has\(row\.q\.id\), outcome: repairOutcomes\[row\.q\.id\] \|\| null, hasReview: Boolean\(answerReviews\[row\.q\.id\]\)/);
  assert.match(page, /keyIndex: row\.q\.correctIndex, optionCount: row\.q\.options\?\.length \|\| 0/);
  assert.match(page, /statusOf=\{statusOf\} sealedOf=\{sealedOf\}/);
  assert.match(page, /setRetried\(\{\}\)/, 'a new paper starts sealed again');
});

test('a blank has one label, Try it again, the same word Review and Today use; a wrong answer keeps Repair', () => {
  assert.match(page, /if \(row\.verdict === 'skipped'\) return sealedOf\(row\) \? \{ id: 'again', label: actionLabel\('blank'\) \} : null;/);
  assert.match(page, /return \{ id: 'repair', label: actionLabel\('open'\) \};/);
  assert.equal(actionLabel('blank'), 'Try it again');
  assert.equal(actionLabel('open'), 'Repair');
  // A held key is said before anything else, so a blank under re-check says so instead.
  assert.ok(page.indexOf("label: 'Key being re-checked'") < page.indexOf("if (row.verdict === 'skipped') return sealedOf"));
});

test('one component: Review\'s answer sheet and the result\'s mistakes use the same free steps', () => {
  const sheet = read('src/components/review/AnswerSheet.jsx');
  assert.match(sheet, /from '\.\/freeSteps'/);
  assert.doesNotMatch(sheet, /function TryAgain|function HiddenNote/, 'Review no longer carries its own copy');
  assert.match(sheet, /<FreeKeys mode=\{mode\}/);
  assert.match(sheet, /<HiddenNote \/>/);
  assert.match(sheet, /questionModel\(q,/);
  assert.match(read('src/components/result/RetryFirst.jsx'), /from '@\/components\/review\/freeSteps'/);
  assert.match(read('src/components/result/RetryFirst.jsx'), /<TryAgain q=\{q\} number=\{number\} showStem=\{false\} tagPick onPick=\{onTried\} onShow=\{onShow\} \/>/);
  // Review's own words survive the move, and its saved-repair rule is untouched (F17).
  assert.match(sheet, /const SAVED = new Set\(\['repaired', 'held', 'slipped'\]\)/);
  assert.match(sheet, /\{haveLine\(0\)\}\{aiRenewsLine\(wallet\)/);
});

test('the result\'s list hides the key from a sealed row: the key letter and the key text are not rendered', () => {
  const list = read('src/components/result/MistakeList.jsx');
  assert.match(list, /const keyText = open && !sealed && Number\.isInteger\(key\)/);
  assert.match(list, /\{Number\.isInteger\(key\) && !sealed \? <span className="rx-pick" data-kind="key">/);
  assert.match(list, /sealed=\{sealedOf\(r\)\}/);
  const css = read('src/components/result/result-1017.css');
  assert.match(css, /\.rx-row\[data-open\]\[data-sealed\] \.rx-row__opts \{ display: grid; \}/, 'the opened sealed row writes the pick out');
});

// ---------- the markup, rendered with the real components ----------
const ROOT_URL = pathToFileURL(`${root}/`).href;
const HOOKS = `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const ROOT = ${JSON.stringify(ROOT_URL)};
const STUBS = { '@/components/brand/MobiReact': 'export default function MobiReact() { return null; }' };
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
let kit = null;
async function load() {
  if (kit) return kit;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const at = (rel) => import(pathToFileURL(resolve(root, rel)).href);
  const [React, server, list, retry, steps] = await Promise.all([
    import('react'), import('react-dom/server'), at('src/components/result/MistakeList.jsx'), at('src/components/result/RetryFirst.jsx'), at('src/components/review/freeSteps.jsx'),
  ]);
  kit = {
    React,
    html: (type, props) => server.renderToStaticMarkup(React.createElement(type, props)),
    MistakeList: list.default, RetryFirst: retry.default, RetrySaid: retry.RetrySaid,
    TryAgain: steps.TryAgain, FreeKeys: steps.FreeKeys, HiddenNote: steps.HiddenNote, questionModel: steps.questionModel,
  };
  return kit;
}

// A paper's question the way analyseSession hands it over: Q2 is wrong (picked "Old ratio", key "Sacrificing ratio"), Q9 is blank.
const Q = (id, key = 2) => ({ id, question: 'Goodwill brought in by an incoming partner is shared by old partners in:', options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'], correctIndex: key, explanation: 'The sacrificing partners are compensated, so goodwill is shared in the sacrificing ratio.' });
const WRONG_ROW = { q: Q('fixture-q2'), d: { givenIndex: 1 }, verdict: 'wrong', number: 2, chapter: 'Partnership Fundamentals' };
const BLANK_ROW = { q: Q('fixture-q9'), d: null, verdict: 'skipped', number: 9, chapter: 'Partnership Fundamentals' };
const KEY_TEXT = 'Sacrificing ratio';
const listProps = (over = {}) => ({
  mistakes: [WRONG_ROW], blanks: [BLANK_ROW], openIds: new Set(['fixture-q2', 'fixture-q9']), onToggle() {}, statusOf: () => null, sealedOf: () => true, cohortOf: () => null,
  renderBody: () => null, visited: new Set(), showAll: false, onShowAll() {}, blanksOpen: true, onBlanks() {}, ...over,
});

test('a sealed row, closed or open, carries the student\'s pick and nothing about the key', async () => {
  const { html, MistakeList } = await load();
  const sealed = html(MistakeList, listProps());
  assert.match(sealed, /data-kind="mine"/, 'the pick is there');
  assert.doesNotMatch(sealed, /data-kind="key"/, 'no key letter on any row');
  assert.ok(!sealed.includes(KEY_TEXT), 'the key\'s text is not in the markup at all');
  assert.ok(!/Correct answer/.test(sealed), 'no "Correct answer" label either');
  assert.match(sealed, /data-sealed="true"/);
  assert.match(sealed, /Old ratio/, 'the opened sealed row writes the student\'s pick out');
  // Closed rows too.
  const closed = html(MistakeList, listProps({ openIds: new Set(), blanksOpen: false }));
  assert.doesNotMatch(closed, /data-kind="key"/);
  assert.ok(!closed.includes(KEY_TEXT));
  // The blank says it is blank, and offers no key either.
  assert.match(sealed, /left blank/);
});

test('once the key has been asked for, the row shows it as before: the key letter and "Correct answer"', async () => {
  const { html, MistakeList } = await load();
  const open = html(MistakeList, listProps({ sealedOf: () => false }));
  assert.match(open, /data-kind="key"/);
  assert.ok(open.includes(KEY_TEXT));
  assert.match(open, /Correct answer/);
  assert.doesNotMatch(open, /data-sealed/);
});

test('the sealed body offers Try it again and Show the answer, and says Repair comes after with its price; a blank has no repair to mention', async () => {
  const { html, RetryFirst, questionModel } = await load();
  const q = questionModel(WRONG_ROW.q, WRONG_ROW.d);
  const wrong = html(RetryFirst, { q, number: 2, repairable: true, onTried() {}, onShow() {} });
  assert.match(wrong, /<b>The answer stays hidden until you ask\.<\/b> Try it again first, or see the correct answer and the book explanation\. Both are free\./);
  const keys = [...wrong.matchAll(/<button[^>]*class="rvw-key[^"]*"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['Try it again', 'Show the answer'], 'Try it again first');
  assert.match(wrong, /Repair Q2 comes after, for 1 AI credit\./);
  assert.ok(!wrong.includes(KEY_TEXT) && !/Correct/.test(wrong), 'nothing about the key');
  assert.ok(!/Old ratio|New ratio/.test(wrong), 'the options wait for Try it again');
  assert.ok(!/mr-start|Repair this mistake/.test(wrong), 'no paid key while sealed');
  const blank = html(RetryFirst, { q: questionModel(BLANK_ROW.q, null), number: 9, repairable: false, onTried() {}, onShow() {} });
  assert.doesNotMatch(blank, /AI credit/);
  assert.match(blank, /Try it again/);
});

test('Try it again lists the options with the first pick tagged and no mark of the key; Review\'s own sheet keeps its stem and its multi-pick behaviour', async () => {
  const { html, TryAgain, questionModel } = await load();
  const q = questionModel(WRONG_ROW.q, WRONG_ROW.d);
  const once = html(TryAgain, { q, number: 2, onShow() {}, onPick() {}, showStem: false, tagPick: true });
  assert.equal([...once.matchAll(/<button type="button" class="rvw-opt/g)].length, 4);
  assert.equal([...once.matchAll(/<small>Your pick<\/small>/g)].length, 1);
  assert.match(once, /<i>B<\/i><span>Old ratio<small>Your pick<\/small><\/span>/, 'the tag sits on the option the student picked');
  assert.doesNotMatch(once, /data-k=|Correct|right/i, 'no option is marked before a pick');
  assert.ok(!once.includes('Goodwill brought in'), 'the stem is not repeated under the open row');
  assert.match(once, /Pick one\. Nothing is recorded and nothing is charged\./);
  // Review: the stem shows, no tag, and the old copy survives.
  const review = html(TryAgain, { q, number: 2, onShow() {} });
  assert.match(review, /rvw-try__stem">Goodwill brought in/);
  assert.doesNotMatch(review, /Your pick/);
});

test("Review's answer sheet keeps its exact markup through the move: the note, the keys in every mode and the first view of Try it again", async () => {
  const { React, html, FreeKeys, HiddenNote, TryAgain, questionModel } = await load();
  assert.equal(html(HiddenNote, {}), '<p class="rvw-sheet__note"><b>The answer stays hidden until you ask.</b> Try it again first, or see the correct answer and the book explanation. Both are free.</p>');
  const repair = React.createElement('button', { type: 'button', className: 'rvw-key mk-press' }, 'Repair Q', 2, ', 1 AI credit');
  const key = (label) => `<button type="button" class="rvw-key mk-press">${label}</button>`;
  const keys = (mode, extra = {}) => html(FreeKeys, { mode, onTry() {}, onShow() {}, ...extra });
  assert.equal(keys('hidden', { children: repair }), `<div class="rvw-sheet__keys">${key('Try it again')}${key('Show the answer')}${key('Repair Q2, 1 AI credit')}</div>`);
  assert.equal(keys('try', { children: repair }), `<div class="rvw-sheet__keys">${key('Show the answer')}${key('Repair Q2, 1 AI credit')}</div>`);
  assert.equal(keys('answer', { children: repair }), `<div class="rvw-sheet__keys">${key('Try it again')}${key('Repair Q2, 1 AI credit')}</div>`);
  assert.equal(keys('hidden', { showAnswer: false }), `<div class="rvw-sheet__keys">${key('Try it again')}</div>`, 'a key under re-check offers no answer');
  const q = questionModel(WRONG_ROW.q, WRONG_ROW.d);
  const opt = (letter, text) => `<li><button type="button" class="rvw-opt mk-press"><i>${letter}</i><span>${text}</span></button></li>`;
  assert.equal(html(TryAgain, { q, number: 2, onShow() {} }),
    '<div class="rvw-try"><p class="rvw-try__stem">Goodwill brought in by an incoming partner is shared by old partners in:</p>'
    + `<ul class="rvw-opts" aria-label="Options for question 2">${opt('A', 'New ratio')}${opt('B', 'Old ratio')}${opt('C', 'Sacrificing ratio')}${opt('D', 'Equal ratio')}</ul>`
    + '<p class="rvw-try__said" role="status" aria-live="polite">Pick one. Nothing is recorded and nothing is charged.</p></div>');
});

test('the question model reads the same shape for Review (from the paper) and for the result (from the row), with plain option text', async () => {
  const { questionModel } = await load();
  assert.deepEqual(questionModel(WRONG_ROW.q, WRONG_ROW.d), {
    id: 'fixture-q2', stem: WRONG_ROW.q.question, options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'], key: 2, given: 1, explanation: WRONG_ROW.q.explanation,
  });
  assert.equal(questionModel(BLANK_ROW.q, null).given, null, 'a blank has no pick');
  assert.equal(questionModel(WRONG_ROW.q, null, 'D').given, 3, 'a row\'s letter stands in when the paper\'s detail is not at hand');
  assert.equal(questionModel(null), null);
  // Options that carry their own letters are shown without them, as everywhere else on the page.
  const lettered = questionModel({ id: 'x', question: 'Q', options: ['A. one', 'B. two', 'C. three', 'D. four'], correctIndex: 1 });
  assert.deepEqual(lettered.options, ['one', 'two', 'three', 'four']);
});

test('what the try said is one line that takes the focus once', async () => {
  const { html, RetrySaid } = await load();
  const right = html(RetrySaid, { said: retrySaid({ pick: 2, keyIndex: 2, right: true }) });
  assert.equal(right, '<p class="rx-retry__said" tabindex="-1" data-k="right"><b>Got it this time.</b> This try is not recorded.</p>');
  const wrong = html(RetrySaid, { said: retrySaid({ pick: 1, keyIndex: 2, right: false }) });
  assert.equal(wrong, '<p class="rx-retry__said" tabindex="-1" data-k="wrong"><b>Not B.</b> The answer is C. This try is not recorded.</p>');
});

// ---------- the styles ----------
test('the free steps\' styles reach the result page, and the result adds no glow, gradient or accent fill', () => {
  const shared = read('src/components/review/review-1017.css');
  for (const selector of ['.rvw-key', '.rvw-opt', '.rvw-inline']) assert.match(shared, new RegExp(`\\.app-shell :is\\(\\.rvw, \\.rx\\) ${selector.replace('.', '\\.')}`), `${selector} applies under .rx`);
  const css = read('src/components/result/retry-first.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // The focus ring is the page's own (var(--a-focus) with its fallback); nothing else may carry the volt.
  assert.doesNotMatch(css.replaceAll('var(--a-focus, #d2f000)', ''), /gradient|box-shadow|text-shadow|backdrop-filter|#d2f000|--volt|--a-accent/i, 'no glow, wash or accent fill');
  // Every real animation sits behind the reduced-motion gates, on the same line (animation: none is how the sheet's own entrance is dropped).
  for (const rule of css.split('\n').filter((l) => /animation:\s*(?!none\b)\S/.test(l) && !/^\s*@keyframes/.test(l))) {
    assert.match(rule, /:root:not\(\[data-motion='reduced'\]\)/, `motion is gated: ${rule.trim().slice(0, 70)}`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*:root:not\(\[data-motion='reduced'\]\) \.rx-retry__said \{ animation: rx-retry-in 200ms/);
  assert.doesNotMatch(css, /transition:\s*all/);
});
