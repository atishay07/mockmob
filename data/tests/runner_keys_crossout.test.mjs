// The test screen's keys and cross-out tool (18 Nov 2026, lane runner), driven through the real runner
// (src/app/(app)/test/TestPageClient.jsx, data/tests/runner_harness.mjs) as a student does: keys pressed, options clicked, the
// page reloaded, the paper sent. The rule over all of it: no answer is lost, changed or saved twice, and no paper is submitted,
// ended or left, through a key or the tool. MockMob style has both; NTA style (the exam hall's twin) has neither.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as h from './runner_harness.mjs';

// A device with a mouse and a keyboard: the runner shows the Keys key only where (hover: hover) and (pointer: fine) match.
const plainMedia = globalThis.matchMedia;
const withKeyboard = (query) => ({ ...plainMedia(query), matches: /reduce|min-width|hover: hover/.test(query) });
globalThis.matchMedia = withKeyboard;

const KEY = 'generation-keys-000001';
const CROSS = `mm:crossout:v1:g.${KEY}`;
const quick = (over = {}) => ({ mode: 'quick', questions: h.paper(5), durationMs: 600000, params: { generationKey: KEY }, ...over });
const option = (n) => h.find('.nta-option')[n];
const pressed = () => h.find('.nta-option').map((o) => o.getAttribute('aria-pressed') === 'true');
const struck = () => h.find('.nta-option').map((o) => o.getAttribute('class').includes('is-struck'));
const heading = () => h.text(h.one('.nta-paper-head h1'));
const draft = () => JSON.parse(localStorage.getItem(`mm:test:student-1:paper:g.${KEY}`));
const types = (events) => events.map((e) => e.type + (e.via ? `:${e.via}` : ''));
const slot = () => h.text(h.find('.nta-question-block.is-active .pr-slot')[0] || h.one('.pr-slot'));

test('keys: a letter or number chooses exactly as a click does, with focus on the option; held, modified or typed keys do nothing', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await h.advance(2000); await h.key('b');
  assert.deepEqual(pressed(), [false, true, false, false]);
  assert.equal(h.document.activeElement, option(1), 'the option chosen by key has focus, as a tap leaves it');
  assert.deepEqual(draft().answers, { q1: 1 });
  await h.advance(1000); await h.click(option(2));
  await h.advance(1000); await h.key('2');
  assert.deepEqual(types(draft().events), ['visit', 'answer', 'answer', 'answer'], 'one answer event each, key or click alike');
  assert.deepEqual(draft().events.filter((e) => e.type === 'answer').map((e) => e.answer), [1, 2, 1]);
  // A held key does not repeat; Ctrl, Alt or Meta held does nothing; a key typed in a field is the field's.
  await h.key('d', { repeat: true });
  await h.key('a', { ctrlKey: true }); await h.key('c', { altKey: true }); await h.key('d', { metaKey: true });
  const field = h.document.createElement('input'); h.document.body.appendChild(field);
  await h.fire(field, 'keydown', { key: 'a' });
  field.parentNode.removeChild(field);
  assert.deepEqual(pressed(), [false, true, false, false], 'still B');
  assert.equal(draft().events.filter((e) => e.type === 'answer').length, 3, 'and nothing recorded');
});

test('keys: N, P and the arrows move by page, never past either end; M marks; the last page\'s Next opens nothing', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await h.key('n'); assert.equal(heading(), 'Question 2');
  await h.key('ArrowRight'); assert.equal(heading(), 'Question 3');
  await h.key('p'); assert.equal(heading(), 'Question 2');
  await h.key('ArrowLeft'); assert.equal(heading(), 'Question 1');
  const before = draft().events.length;
  await h.key('p'); await h.key('ArrowLeft');
  assert.equal(heading(), 'Question 1');
  assert.equal(draft().events.length, before, 'nothing recorded at the first question');
  await h.key('m');
  assert.match(h.text(h.one('.nta-question-actions')), /Unmark/);
  assert.equal(draft().marked.q1, true);
  await h.key('M');
  assert.equal(draft().marked.q1, undefined, 'M again takes the mark off');
  // The last question: Next (the key) is no action, Enter is not taken, and nothing is submitted.
  await h.click(h.find('.nta-palette-chip').find((b) => h.text(b) === '5'));
  assert.equal(heading(), 'Question 5');
  for (const k of ['n', 'N', 'ArrowRight', 'Enter', ' ', 'Escape', 'x', 'x', '?', '?']) await h.key(k, k === '?' ? { shiftKey: true } : {});
  assert.equal(h.find('.pr-sheet').length, 0, 'no submit sheet from a key');
  assert.equal(s.submitted().length, 0, 'no submit from a key');
  assert.deepEqual(s.router.pushed, [], 'nothing left the page');
});

test('keys: nothing under the submit sheet or the leave sheet; Escape there is the sheet\'s own', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await h.key('a');
  await h.click(h.one('.nta-submit-button', 'Submit test'));
  assert.equal(h.find('.pr-sheet').length, 1);
  for (const k of ['b', '3', 'n', 'p', 'm', 'x']) await h.key(k);
  await h.key('?', { shiftKey: true });
  assert.deepEqual(draft().answers, { q1: 0 }, 'the answer under the sheet is unchanged');
  assert.equal(h.find('.rk-panel').length, 0);
  await h.key('Escape');
  assert.equal(h.find('.pr-sheet').length, 0, 'the sheet\'s own Escape closed it');
  assert.equal(s.submitted().length, 0);
  // The leave sheet (the X) holds the keys too.
  await h.click(h.find('button').find((b) => b.getAttribute('aria-label') === 'Exit test'));
  assert.equal(h.find('.pr-sheet--exit').length, 1);
  await h.key('c'); await h.key('n');
  assert.deepEqual(draft().answers, { q1: 0 });
  assert.equal(heading(), 'Question 1');
  assert.deepEqual(s.router.pushed, []);
});

test('the Keys key: its list by a click or ?, Escape closes it, and its one-time hint goes for good once it is opened', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  const keys = h.one('.rk-keys');
  assert.equal(h.text(keys), 'Keys');
  assert.equal(h.text(h.one('.rk-hint')), 'Press ? for keys');
  assert.equal(keys.getAttribute('aria-expanded'), 'false');
  await h.click(keys);
  const panel = h.one('.rk-panel');
  assert.equal(h.text(h.one('.rk-panel h2')), 'Keys for this paper');
  assert.deepEqual(h.find('.rk-row dd').map((dd) => h.text(dd)), ['Choose an option', 'Next question', 'Previous question', 'Mark for review', 'Cross out options', 'Show or hide this list']);
  assert.equal(h.find('.rk-row')[0].querySelectorAll('kbd').length, 8, 'A B C D or 1 2 3 4');
  assert.equal(keys.getAttribute('aria-expanded'), 'true');
  assert.equal(keys.getAttribute('aria-controls'), panel.getAttribute('id'));
  assert.ok(h.one('.rk-hint').hasAttribute('data-gone'), 'the hint goes, its room kept');
  assert.equal(localStorage.getItem('mm:keysHint:v1'), '1');
  await h.key('Escape');
  assert.equal(h.find('.rk-panel').length, 0);
  await h.key('?', { shiftKey: true });
  assert.equal(h.find('.rk-panel').length, 1);
  await h.key('a'); // the list is not a modal: the keys still answer
  assert.deepEqual(pressed(), [true, false, false, false]);
  await h.key('?', { shiftKey: true });
  assert.equal(h.find('.rk-panel').length, 0);
  // A press outside closes it.
  await h.click(keys);
  await h.fire(h.document.body, 'pointerdown');
  assert.equal(h.find('.rk-panel').length, 0);
  await s.unmount({ keepStorage: true });
  // The next paper on this device carries no hint.
  const next = await h.mount(quick({ params: { generationKey: 'generation-keys-000002' } }));
  t.after(() => next.unmount());
  assert.equal(h.find('.rk-hint').length, 0);
  assert.equal(h.find('.rk-keys').length, 1);
});

test('cross out: the tool crosses out, the chosen answer is refused with a line, and no answer ever changes through it', async (t) => {
  const questions = h.paper(5); questions[0].correctIndex = 2;
  const s = await h.mount(quick({ questions }));
  t.after(() => s.unmount());
  await h.advance(2000); await h.click(option(1)); // B chosen
  const tool = h.one('.pr-cross');
  assert.equal(tool.getAttribute('aria-pressed'), 'false');
  assert.match(h.text(tool), /^Cross out/);
  await h.advance(1000); await h.click(tool);
  assert.equal(tool.getAttribute('aria-pressed'), 'true');
  assert.match(h.text(tool), /^Crossing out/);
  assert.equal(slot(), 'Tap an option to cross it out. Tap it again to bring it back.');
  await h.advance(1000); await h.click(option(2));
  await h.advance(1000); await h.click(option(3));
  assert.deepEqual(struck(), [false, false, true, true]);
  assert.ok(option(3).getAttribute('class').includes('is-striking'), 'only the one just crossed out draws its line');
  assert.ok(!option(2).getAttribute('class').includes('is-striking'));
  assert.match(h.text(option(2)), /^Option C, crossed out\./, 'a screen reader hears it crossed out');
  assert.deepEqual(pressed(), [false, true, false, false], 'B is still the answer');
  // The chosen option: refused, the answer stays, the page says why.
  await h.advance(1000); await h.click(option(1));
  assert.equal(slot(), 'That is your chosen answer. Choose another option first.');
  assert.deepEqual(pressed(), [false, true, false, false]);
  assert.deepEqual(struck(), [false, false, true, true]);
  assert.deepEqual(draft().answers, { q1: 1 });
  // Tap a crossed-out option again: it comes back (the tool is still on).
  await h.advance(1000); await h.click(option(3));
  assert.deepEqual(struck(), [false, false, true, false]);
  // Its own sessionStorage entry, keyed by the paper; never in the draft.
  assert.deepEqual(JSON.parse(sessionStorage.getItem(CROSS)), { v: 1, q: { q1: [2] } });
  assert.deepEqual(Object.keys(draft()).sort(), ['answers', 'claimedAt', 'endsAt', 'events', 'generationKey', 'idx', 'marked', 'owner', 'paper', 'pendingSubmission', 'questions', 'savedAt', 'selectionMeta', 'startedAt', 'v', 'visited']);
  assert.doesNotMatch(JSON.stringify(draft()), /crossout|struck|"q":\{/);
  // X turns the tool off; a crossed-out option can still be chosen, and choosing it brings it back (recorded before the answer).
  await h.key('x');
  assert.equal(tool.getAttribute('aria-pressed'), 'false');
  await h.advance(1000); await h.click(option(2));
  assert.deepEqual(pressed(), [false, false, true, false]);
  assert.deepEqual(struck(), [false, false, false, false]);
  assert.deepEqual(types(draft().events), ['visit', 'answer', 'strike', 'strike', 'strike', 'strike', 'answer'], 'C, D, D back, then C back just before its answer: the refusal and the tool record no answer');
  assert.equal(sessionStorage.getItem(CROSS), null, 'nothing left to keep: the entry goes');
});

test('cross out: the tool is off on every new page, letter keys follow it, and X works by key', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await h.key('x');
  assert.equal(h.one('.pr-cross').getAttribute('aria-pressed'), 'true');
  await h.key('a'); await h.key('4');
  assert.deepEqual(struck(), [true, false, false, true]);
  assert.deepEqual(pressed(), [false, false, false, false], 'no answer from a key while the tool is on');
  assert.equal(h.document.activeElement, option(3));
  await h.key('n');
  assert.equal(heading(), 'Question 2');
  assert.equal(h.one('.pr-cross').getAttribute('aria-pressed'), 'false', 'a new page starts with the tool off');
  await h.key('b');
  assert.deepEqual(pressed(), [false, true, false, false], 'so a letter chooses again');
  await h.key('p');
  assert.deepEqual(struck(), [true, false, false, true], 'question 1 keeps its marks');
  assert.ok(!option(0).getAttribute('class').includes('is-striking'), 'marks come back drawn, not drawn again');
  assert.deepEqual(draft().answers, { q2: 1 });
});

test('cross out: right-click and Shift+click are shortcuts with the tool off; the browser menu never opens on an option', async (t) => {
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await h.advance(1000);
  const menu = new h.FakeEvent('contextmenu', { bubbles: true });
  await h.act(async () => { option(0).dispatchEvent(menu); });
  await h.settle();
  assert.equal(menu.defaultPrevented, true, 'no browser menu');
  await h.advance(1000); await h.fire(option(3), 'click', { shiftKey: true, detail: 1 });
  assert.deepEqual(struck(), [true, false, false, true]);
  assert.deepEqual(pressed(), [false, false, false, false], 'Shift+click crosses out, never chooses');
  await h.advance(1000); await h.click(option(0));
  assert.deepEqual(pressed(), [true, false, false, false], 'a plain click on a crossed-out option chooses it');
  assert.deepEqual(struck(), [false, false, false, true]);
  // The chosen option refuses the shortcut too, with the same line.
  await h.advance(1000); await h.fire(option(0), 'click', { shiftKey: true, detail: 1 });
  assert.equal(slot(), 'That is your chosen answer. Choose another option first.');
  assert.deepEqual(pressed(), [true, false, false, false]);
});

test('cross out: a reload of the same paper keeps the marks; the sent paper clears them; nothing of them is ever sent', async (t) => {
  const first = await h.mount(quick());
  let open = first;
  t.after(() => open.unmount());
  await h.advance(2000); await h.click(option(0));
  await h.click(h.one('.pr-cross'));
  await h.click(option(2)); await h.click(option(3));
  await first.unmount({ keepStorage: true });
  await h.advance(30000);
  const second = await h.mount(quick());
  open = second;
  assert.equal(second.requests.length, 0, 'resumed from this device');
  assert.deepEqual(pressed(), [true, false, false, false]);
  assert.deepEqual(struck(), [false, false, true, true], 'the marks are back after the reload');
  assert.ok(!option(2).getAttribute('class').includes('is-striking'), 'drawn at rest, not drawn again');
  assert.equal(h.one('.pr-cross').getAttribute('aria-pressed'), 'false', 'the tool itself starts off');
  await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  const [sent] = second.submitted();
  assert.deepEqual(Object.keys(sent.body).sort(), ['answers', 'client', 'endedBy', 'events', 'sessionId', 'sessionTicket']);
  assert.deepEqual(sent.body.answers, { q1: 0 });
  assert.doesNotMatch(JSON.stringify(sent.body), /crossout|struck|crossTool/);
  assert.equal(sessionStorage.getItem(CROSS), null, 'the paper is over: its marks go');
  assert.equal(localStorage.getItem('mm:keysHint:v1'), '1', 'and the keys hint has been seen on a whole paper');
});

test('cross out: another paper in the same tab starts clean and clears the old paper\'s entry', async (t) => {
  sessionStorage.setItem('mm:crossout:v1:g.generation-old-paper-01', JSON.stringify({ v: 1, q: { q1: [1, 2] } }));
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  assert.deepEqual(struck(), [false, false, false, false], 'q1 of another paper is not this paper\'s q1');
  assert.equal(sessionStorage.getItem('mm:crossout:v1:g.generation-old-paper-01'), null);
});

test('cross out works in memory when this tab\'s storage cannot be used, and the answers are untouched', async (t) => {
  const store = globalThis.sessionStorage;
  const blocked = () => { throw new Error('SecurityError: storage is blocked'); };
  for (const name of ['getItem', 'setItem', 'removeItem', 'key']) store[name] = blocked;
  Object.defineProperty(store, 'length', { get: blocked, configurable: true });
  t.after(() => { for (const name of ['getItem', 'setItem', 'removeItem', 'key']) delete store[name]; delete store.length; });
  const s = await h.mount(quick());
  t.after(() => s.unmount());
  await h.click(option(0));
  await h.click(h.one('.pr-cross'));
  await h.click(option(2)); await h.click(option(3));
  assert.deepEqual(struck(), [false, false, true, true], 'held in the page');
  assert.deepEqual(pressed(), [true, false, false, false]);
  await h.click(option(0));
  assert.equal(slot(), 'That is your chosen answer. Choose another option first.');
  await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  assert.deepEqual(s.submitted()[0].body.answers, { q1: 0 }, 'the paper is sent as answered');
});

test('a number or letter key past the question\'s options does nothing, in either style (an index the server refuses would stop the paper being sent)', async (t) => {
  const questions = h.paper(); questions[0].options = questions[0].options.slice(0, 3);
  const s = await h.mount({ mode: 'nta', questions, params: { interface: 'nta' } });
  t.after(() => s.unmount());
  await h.click(h.one('button', 'Continue in this window'));
  await h.key('4');
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed')), ['false', 'false', 'false']);
  await h.click(h.one('.nta-nav-button', 'Save & Next'));
  await h.click(h.one('button', 'MockMob'));
  await h.click(h.find('.nta-palette-chip').find((b) => h.text(b) === '1'));
  await h.key('d'); await h.key('4');
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed')), ['false', 'false', 'false']);
  await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  const [sent] = s.submitted();
  assert.deepEqual(sent.body.answers, {});
  assert.equal(sent.body.events.filter((e) => e.type === 'answer').length, 0);
});

test('after the paper ends nothing a key or the tool does changes anything', async (t) => {
  const s = await h.mount(quick({ durationMs: 60000 }));
  t.after(() => s.unmount());
  await h.advance(3000); await h.key('c');
  await h.advance(60000);
  assert.equal(s.submitted().length, 1, 'time up sent it once');
  for (const k of ['a', 'n', 'p', 'm', 'x']) await h.key(k);
  await h.key('?', { shiftKey: true });
  assert.equal(s.submitted().length, 1, 'still once');
  assert.deepEqual(s.submitted()[0].body.answers, { q1: 2 });
  assert.equal(h.find('.rk-panel').length, 0);
});

test('NTA style has neither: no Keys key, no cross-out tool or line, and MockMob\'s keys do nothing there', async (t) => {
  const s = await h.mount({ mode: 'nta', params: { interface: 'nta' } });
  t.after(() => s.unmount());
  await h.click(h.one('button', 'Continue in this window'));
  assert.equal(h.find('.rk-keys').length, 0);
  assert.equal(h.find('.rk-hint').length, 0);
  assert.equal(h.find('.pr-cross').length, 0);
  assert.equal(h.find('.pr-slot').length, 0);
  for (const k of ['x', 'a', 'b', 'n', 'm', 'p']) await h.key(k);
  await h.key('?', { shiftKey: true });
  assert.equal(h.find('.rk-panel').length, 0);
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed')), ['false', 'false', 'false', 'false']);
  assert.equal(h.text(h.one('.nta-n-qhead h1')), 'Question 1:');
  // The same NTA paper switched to MockMob style has both, and back in NTA style both are gone again.
  await h.click(h.one('button', 'MockMob'));
  assert.equal(h.find('.rk-keys').length, 1);
  assert.equal(h.find('.pr-cross').length, 1);
  await h.click(h.one('.pr-cross'));
  await h.click(h.one('button', 'NTA style'));
  assert.equal(h.find('.pr-cross').length, 0);
  assert.equal(h.find('.nta-option.is-struck').length, 0);
});

test('an NTA paper in MockMob style: under the integrity warning no key and no tool does anything', async (t) => {
  const s = await h.mount({ mode: 'nta' }); // interface=mockmob, the warning still up
  t.after(() => s.unmount());
  assert.ok(h.find('dialog.ei-dialog')[0]?.hasAttribute('open'), 'the guard\'s dialog is open');
  for (const k of ['a', 'x', 'n', 'm']) await h.key(k);
  await h.key('?', { shiftKey: true });
  assert.equal(h.find('.rk-panel').length, 0);
  assert.equal(h.text(h.one('.nta-paper-head h1')), 'Question 1');
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed')), ['false', 'false', 'false', 'false']);
  await h.click(h.one('button', 'Continue in this window'));
  await h.key('b');
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed')), ['false', 'true', 'false', 'false'], 'once the guard lets the paper go on, B by key');
  // NTA mode's rules say right-click is off: no right-click cross-out there; the tool is the way.
  await h.fire(option(2), 'contextmenu');
  assert.deepEqual(struck(), [false, false, false, false]);
  await h.click(h.one('.pr-cross'));
  await h.click(option(2));
  assert.deepEqual(struck(), [false, false, true, false]);
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed')), ['false', 'true', 'false', 'false']);
});

// ---- source pins --------------------------------------------------------------------------------------------------------
const RUNNER = readFileSync(path.join(h.ROOT, 'src', 'app', '(app)', 'test', 'TestPageClient.jsx'), 'utf8').replace(/\r\n/g, '\n');
const between = (from, to) => { const a = RUNNER.indexOf(from); const b = RUNNER.indexOf(to, a + from.length); assert.ok(a >= 0 && b > a, `${from} ... ${to}`); return RUNNER.slice(a, b); };

test('pin: no key path reaches the submit, the sheets or a way out of the paper', () => {
  const dispatch = between('// keys: dispatch.', '// keys: dispatch end');
  for (const word of ['submitTest', 'confirmAndSubmit', 'openReview', 'openNtaSummary', 'goNext', 'saveAndNext', 'markAndNext', 'leavePaper', 'setExitTo', 'setReviewOpen', 'setNtaSummaryOpen', 'router', 'stopPropagation']) {
    assert.ok(!dispatch.includes(word), `the key dispatch never calls ${word}`);
  }
  // It runs only what runnerKeys returns, and runnerKeys has no such action.
  assert.match(between('// MockMob style: src/lib/paper/runnerKeys.mjs says what a key does', '// keys: dispatch end'), /const action = keyAction\(event, \{[\s\S]*if \(!action\) return;\s*event\.preventDefault\(\);/);
  // The tool's own handlers never reach the answer except to bring an option back when it is chosen.
  const tool = between('const toggleStrike = useCallback(', '// A press on an option, by a tap').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['chooseAnswer', 'setAnswers', 'answersRef.current =', 'submitTest']) assert.ok(!tool.includes(word), `the cross-out never calls ${word}`);
});

test('pin: NTA style renders neither feature, and its keys are only the ones it had', () => {
  const classic = between('const renderNtaQuestion = (question, questionIndex) => {', '  return (\n    <div ref={fullscreenTarget}');
  for (const word of ['pr-cross', 'rk-keys', 'rk-panel', 'pr-slot', 'Strikethrough', 'KEY_ROWS', 'pressOption', 'toggleStrike', 'crossTool', 'is-struck']) {
    assert.ok(!classic.includes(word), `NTA style draws no ${word}`);
  }
  const ntaKeys = between('if (classicRef.current) {\n        if (!canAnswer()) return;', '        return;\n      }');
  assert.ok(!ntaKeys.includes('keyAction') && !ntaKeys.includes('toggleStrike') && !ntaKeys.includes('setKeysOpen'), 'NTA style gets none of MockMob\'s keys');
  assert.match(ntaKeys, /\/\^\[1-4\]\$\/\.test\(event\.key\)/, 'its 1 to 4 stay');
});

test('pin: the cross-out stays out of the answer draft and the submit', () => {
  const draftLiteral = between('    const draft = {\n      v: 2,', '    };');
  for (const word of ['struck', 'cross', 'Cross']) assert.ok(!draftLiteral.includes(word), `the draft holds no ${word}`);
  const submit = between('const submitTest = useCallback(async (reason) => {', 'const submitForStrikes');
  assert.ok(!/answers: [^\n]*struck|events: [^\n]*struck/.test(submit), 'the submit sends no cross-out');
  assert.match(submit, /try \{ if \(crossKey\) window\.sessionStorage\.removeItem\(crossKey\);[^\n]*\} catch \{\}/, 'the sent paper clears its own entry, in a try of its own');
  const crossModule = readFileSync(path.join(h.ROOT, 'src', 'lib', 'paper', 'crossOut.mjs'), 'utf8');
  assert.doesNotMatch(crossModule, /^\s*import\b/m, 'crossOut.mjs imports nothing, so not the draft module');
  assert.match(RUNNER, /import \{[^}]*\} from '@\/lib\/paper\/crossOut\.mjs';/);
});

test('pin: the integrity guard keeps its own listeners and is unchanged by the keys', () => {
  const guard = readFileSync(path.join(h.ROOT, 'src', 'components', 'arena', 'ExamIntegrityGuard.jsx'), 'utf8');
  assert.match(guard, /for \(const type of \['copy', 'cut', 'paste', 'contextmenu'\]\) document\.addEventListener\(type, stop\);/);
  assert.match(guard, /onCancel=\{event => event\.preventDefault\(\)\}/, 'Escape never closes a warning');
  // The MockMob key map is told when the guard holds the paper (canAnswer), and does nothing then.
  assert.match(between('const action = keyAction(event, {', '});'), /dialogOpen: !canAnswer\(\) \|\| reviewOpen \|\| !!exitTo \|\| ntaSummaryOpen \|\| paperViewOpen/);
});
