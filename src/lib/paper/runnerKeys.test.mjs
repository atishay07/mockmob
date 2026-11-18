// node --test src/lib/paper/runnerKeys.test.mjs
// The runner's keys (18 Nov 2026, lane runner): every rule the brief gives a key, on the pure key map the runner dispatches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, CAP_NAMES, KEY_ROWS, isTypingTarget, keyAction } from './runnerKeys.mjs';

// A MockMob-style paper running, question 3 of 10 on screen (not the first page, not the last), nothing open.
const LIVE = Object.freeze({
  style: 'mockmob', started: true, loading: false, submitting: false, ended: false, dialogOpen: false, paletteOpen: false,
  keysOpen: false, keysUi: true, crossTool: false, optionCount: 4, canMark: true, atFirst: false, atLast: false,
});
const key = (k, more = {}) => ({ key: k, code: '', repeat: false, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, defaultPrevented: false, target: { tagName: 'BODY' }, ...more });
const run = (k, more = {}, state = {}) => keyAction(key(k, more), { ...LIVE, ...state });
const name = (k, more, state) => run(k, more, state)?.name ?? null;

test('A to D and 1 to 4 choose that option, upper or lower case', () => {
  ['a', 'b', 'c', 'd'].forEach((k, i) => assert.deepEqual(run(k), { name: 'choose', option: i }));
  ['A', 'B', 'C', 'D'].forEach((k, i) => assert.deepEqual(run(k), { name: 'choose', option: i }, 'Caps Lock on'));
  ['1', '2', '3', '4'].forEach((k, i) => assert.deepEqual(run(k, { code: `Digit${i + 1}` }), { name: 'choose', option: i }));
  assert.equal(run('5'), null, 'no fifth key');
  assert.equal(run('e'), null);
});

test('an option key answers only an option the question has (an index the server refuses would stop the paper being sent)', () => {
  assert.equal(run('d', {}, { optionCount: 3 }), null);
  assert.equal(run('4', {}, { optionCount: 3 }), null);
  assert.deepEqual(run('c', {}, { optionCount: 3 }), { name: 'choose', option: 2 });
  assert.equal(run('a', {}, { optionCount: 0 }), null, 'no question in focus');
  assert.equal(run('!', { code: 'Digit4', shiftKey: true }, { optionCount: 3 }), null);
});

test('→ or N is the next question, ← or P the previous one; never past the paper\'s ends', () => {
  for (const k of ['ArrowRight', 'n', 'N']) assert.equal(name(k), 'next');
  for (const k of ['ArrowLeft', 'p', 'P']) assert.equal(name(k), 'previous');
  for (const k of ['ArrowRight', 'n']) assert.equal(name(k, {}, { atLast: true }), null, 'on the last page Next is no key: the Next key there opens the submit sheet, a key never does');
  for (const k of ['ArrowLeft', 'p']) assert.equal(name(k, {}, { atFirst: true }), null);
});

test('M marks or unmarks, only where the screen has Mark; X turns the cross-out tool on or off; ? shows or hides the list', () => {
  assert.equal(name('m'), 'mark');
  assert.equal(name('M'), 'mark');
  assert.equal(name('m', {}, { canMark: false }), null);
  assert.equal(name('x'), 'tool');
  assert.equal(name('X'), 'tool');
  assert.equal(name('?', { shiftKey: true, code: 'Slash' }), 'keys');
  assert.equal(name('?', { shiftKey: true }, { keysOpen: true }), 'keys', '? again hides it');
  assert.equal(name('?', { shiftKey: true }, { keysUi: false }), null, 'no list on a device that does not show the Keys key');
});

test('Esc closes the keys list or the palette sheet, and nothing else', () => {
  assert.equal(name('Escape', {}, { keysOpen: true }), 'close-keys');
  assert.equal(name('Escape', {}, { paletteOpen: true }), 'close-palette');
  assert.equal(name('Escape', {}, { keysOpen: true, paletteOpen: true }), 'close-keys');
  assert.equal(name('Escape'), null, 'with nothing open it does nothing');
  assert.equal(name('Escape', {}, { keysOpen: true, dialogOpen: true }), null, 'a dialog over the paper keeps its own Escape');
});

test('while the keys list is open only ? and Esc answer: a key tried from the list never changes the answer or the page', () => {
  for (const k of ['a', 'B', '1', '4', 'n', 'ArrowRight', 'ArrowLeft', 'p', 'm', 'x', 'Enter', ' ']) {
    assert.equal(run(k, {}, { keysOpen: true }), null, `${k} with the list open`);
    assert.equal(run(k, {}, { keysOpen: true, crossTool: true }), null, `${k} with the list open and the tool on`);
  }
  assert.equal(run('#', { shiftKey: true, code: 'Digit3' }, { keysOpen: true }), null, 'no cross-out either');
  assert.equal(name('?', { shiftKey: true, code: 'Slash' }, { keysOpen: true }), 'keys', '? hides it');
  assert.equal(name('Escape', {}, { keysOpen: true }), 'close-keys');
  // Closed again, the same keys work.
  assert.deepEqual(run('a', {}, { keysOpen: false }), { name: 'choose', option: 0 });
});

test('while the tool is on, an option key crosses out instead of choosing; Shift with an option key crosses out too', () => {
  assert.deepEqual(run('b', {}, { crossTool: true }), { name: 'cross', option: 1 });
  assert.deepEqual(run('2', {}, { crossTool: true }), { name: 'cross', option: 1 });
  assert.deepEqual(run('B', { shiftKey: true, code: 'KeyB' }), { name: 'cross', option: 1 });
  // Shift with 1 to 5 crossed an option out before these keys; it still does (the key's place, as Shift turns 3 into #).
  assert.deepEqual(run('#', { shiftKey: true, code: 'Digit3' }), { name: 'cross', option: 2 });
  assert.deepEqual(run('%', { shiftKey: true, code: 'Digit5' }, { optionCount: 5 }), { name: 'cross', option: 4 });
  assert.equal(run('%', { shiftKey: true, code: 'Digit5' }), null, 'only an option the question has');
});

test('nothing with Ctrl, Alt or Meta held', () => {
  for (const mod of ['ctrlKey', 'altKey', 'metaKey']) {
    for (const k of ['a', '1', 'n', 'ArrowRight', 'p', 'm', 'x', '?', 'Escape']) assert.equal(run(k, { [mod]: true }, { keysOpen: true }), null, `${mod}+${k}`);
  }
});

test('nothing while typing in a field', () => {
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'textarea' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
    assert.equal(run('a', { target }), null);
    assert.equal(run('n', { target }), null);
    assert.equal(run('Escape', { target }, { keysOpen: true }), null);
  }
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false, 'a focused button is not a field: the keys work there');
  assert.equal(isTypingTarget(null), false);
});

test('nothing while a dialog or sheet is open: the submit or leave sheet, an integrity warning, the palette', () => {
  for (const k of ['a', '1', 'n', 'ArrowRight', 'ArrowLeft', 'p', 'm', 'x', '?']) {
    assert.equal(run(k, {}, { dialogOpen: true }), null, `${k} under a dialog`);
    assert.equal(run(k, {}, { paletteOpen: true }), null, `${k} under the palette sheet`);
  }
});

test('nothing before the paper has started, while it loads, while it is submitting or held, and after it has ended', () => {
  for (const state of [{ started: false }, { loading: true }, { submitting: true }, { ended: true }]) {
    for (const k of ['a', '1', 'n', 'ArrowRight', 'ArrowLeft', 'p', 'm', 'x', '?', 'Escape']) assert.equal(run(k, {}, { ...state, keysOpen: true }), null, `${k} with ${JSON.stringify(state)}`);
  }
});

test('a held key does not repeat, and a key another handler already took is left alone', () => {
  for (const k of ['a', '2', 'ArrowRight', 'n', 'm', 'x', '?', 'Escape']) {
    assert.equal(run(k, { repeat: true }, { keysOpen: true }), null, `held ${k}`);
    assert.equal(run(k, { defaultPrevented: true }, { keysOpen: true }), null, `taken ${k}`);
  }
});

test('Enter, Space and every other key keep their own meaning: none is taken', () => {
  for (const k of ['Enter', ' ', 'Tab', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageDown', 'Backspace', 's', 'q', 'F5']) assert.equal(run(k), null, k);
});

test('NTA style gets no key from this map at all: it is the exam hall\'s twin', () => {
  for (const k of ['a', '1', 'n', 'ArrowRight', 'ArrowLeft', 'p', 'm', 'x', '?', 'Escape']) assert.equal(run(k, {}, { style: 'nta', keysOpen: true, paletteOpen: true }), null);
  assert.equal(keyAction(null, LIVE), null);
  assert.equal(keyAction(key('a'), null), null);
});

test('no action can submit, end or leave the paper, or confirm anything', () => {
  assert.deepEqual([...ACTIONS], ['choose', 'cross', 'next', 'previous', 'mark', 'tool', 'keys', 'close-keys', 'close-palette']);
  // Every key on a keyboard, in every state, lands on one of those names or nothing.
  const keys = ['Enter', ' ', 'Escape', 'Tab', '?', ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'.split(''), 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
  for (const state of [{}, { atLast: true }, { atFirst: true }, { crossTool: true }, { keysOpen: true }, { paletteOpen: true }]) {
    for (const k of keys) for (const shiftKey of [false, true]) {
      const found = run(k, { shiftKey, code: /^[0-9]$/.test(k) ? `Digit${k}` : '' }, state);
      if (found) assert.ok(ACTIONS.includes(found.name), `${k} -> ${found.name}`);
    }
  }
  const source = readFileSync(new URL('./runnerKeys.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m, 'the key map reads nothing else');
  // Every action the code can return is named in one of two calls, and each name is one of the list above.
  const named = [...source.matchAll(/\bact\('([^']+)'/g), ...source.matchAll(/\boption\([^;]*?'(choose|cross)'/g), ...source.matchAll(/\? '([a-z-]+)' : '([a-z-]+)'/g)].flatMap((m) => m.slice(1));
  assert.ok(named.length >= 8);
  for (const n of named) assert.ok(ACTIONS.includes(n), `${n} is a listed action`);
});

test('the keys list: six rows in the brief\'s words, the glyph caps named for a screen reader', () => {
  assert.deepEqual(KEY_ROWS.map((row) => row.words), ['Choose an option', 'Next question', 'Previous question', 'Mark for review', 'Cross out options', 'Show or hide this list']);
  assert.deepEqual(KEY_ROWS[0].caps.map((group) => group.join(' ')), ['A B C D', '1 2 3 4']);
  assert.deepEqual(KEY_ROWS[1].caps.map((group) => group.join(' ')), ['→', 'N']);
  assert.deepEqual(KEY_ROWS[2].caps.map((group) => group.join(' ')), ['←', 'P']);
  assert.equal(CAP_NAMES['→'], 'Right arrow');
  assert.equal(CAP_NAMES['←'], 'Left arrow');
  // Each row's caps are keys this map answers.
  assert.equal(name('a'), 'choose'); assert.equal(name('n'), 'next'); assert.equal(name('p'), 'previous');
  assert.equal(name('m'), 'mark'); assert.equal(name('x'), 'tool'); assert.equal(name('?'), 'keys');
});
