// Key cards' "Your part" picker: the tapped option stays selected through save and re-read, taps are ignored while in flight,
// a failed re-read keeps the page, and the preview's latency flag exists only in development.
//   node --test data/tests/keycards_option_choice.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INITIAL_CHOICE, canChoose, choiceReducer, finePrint, isBusy, rowEntrance, shownOption } from '../../src/components/keycards/optionChoice.js';
import { kcLagMs } from '../../src/app/preview/arena/previewRealDecks.js';

const run = (actions, from = INITIAL_CHOICE) => actions.reduce((s, a) => choiceReducer(s, typeof a === 'string' ? { type: a } : a), from);

test('the tapped option is the one shown from the tap until the new list has landed', () => {
  const saved = 'part1';
  assert.equal(shownOption(INITIAL_CHOICE, saved), 'part1');
  const steps = [{ type: 'tap', id: 'part2' }, 'saved'];
  let s = INITIAL_CHOICE;
  for (const a of steps) {
    s = run([a], s);
    assert.equal(shownOption(s, saved), 'part2', `after ${a.type || a}, still the tapped option while the data is old`);
    assert.ok(isBusy(s));
  }
  s = run(['refreshed'], s);
  assert.deepEqual(s, INITIAL_CHOICE);
  assert.equal(shownOption(s, 'part2'), 'part2', 'the landed data now says the same thing');
});

test('taps are ignored while a save or a re-read is in flight, and the option already chosen is never sent twice', () => {
  const saving = run([{ type: 'tap', id: 'part2' }]);
  assert.equal(canChoose(saving, 'part1', 'part1'), false, 'busy: even the other option is ignored');
  assert.equal(canChoose(saving, 'part2', 'part1'), false);
  assert.deepEqual(run([{ type: 'tap', id: 'part1' }], saving), saving, 'a tap in flight changes nothing');
  const refreshing = run(['saved'], saving);
  assert.equal(canChoose(refreshing, 'part1', 'part1'), false);
  assert.equal(canChoose(INITIAL_CHOICE, 'part1', 'part1'), false, 'the saved option is already chosen');
  assert.equal(canChoose(INITIAL_CHOICE, 'part2', 'part1'), true);
  assert.equal(canChoose(INITIAL_CHOICE, '', 'part1'), false);
  assert.equal(canChoose(INITIAL_CHOICE, 'part1', null), true, 'nothing saved yet: any choice is new');
});

test('a failed save puts the saved option back and allows another try', () => {
  const s = run([{ type: 'tap', id: 'part2' }, 'save-failed']);
  assert.equal(s.phase, 'save-failed');
  assert.equal(shownOption(s, 'part1'), 'part1');
  assert.equal(isBusy(s), false);
  assert.equal(canChoose(s, 'part2', 'part1'), true);
  assert.equal(finePrint({ phase: s.phase, saved: 'part1', word: 'part', all: 'both parts' }).kind, 'error');
});

test('a failed re-read after a saved choice keeps the tapped option, says so once, and Try again re-reads', () => {
  const s = run([{ type: 'tap', id: 'part2' }, 'saved', 'refresh-failed']);
  assert.equal(s.phase, 'stale');
  assert.equal(shownOption(s, 'part1'), 'part2', 'the choice was saved, so it stays selected while the old list shows');
  assert.equal(isBusy(s), false, 'the list is not dimmed for ever');
  const line = finePrint({ phase: s.phase, saved: 'part1', word: 'part', all: 'both parts' });
  assert.deepEqual(line, { kind: 'stale', text: 'Saved. The chapter list did not refresh.' });
  assert.equal(canChoose(s, 'part2', 'part1'), false, 'the choice is already saved: no second PUT');
  assert.equal(isBusy(run(['retry'], s)), true);
  assert.deepEqual(run(['retry', 'refreshed'], s), INITIAL_CHOICE);
  assert.equal(run(['retry', 'refresh-failed'], s).phase, 'stale');
});

test('events out of order change nothing', () => {
  assert.deepEqual(run(['saved']), INITIAL_CHOICE);
  assert.deepEqual(run(['refreshed']), INITIAL_CHOICE);
  assert.deepEqual(run(['retry']), INITIAL_CHOICE);
  assert.deepEqual(run(['refresh-failed']), INITIAL_CHOICE);
});

test('the fine print says what each state is, in sentence case, with no exclamation mark', () => {
  const lines = ['idle', 'saving', 'refreshing', 'stale', 'save-failed'].flatMap((phase) => [finePrint({ phase, saved: 'a', word: 'part', all: 'both parts' }), finePrint({ phase, saved: null, word: 'part', all: 'both parts' })]);
  for (const l of lines) assert.doesNotMatch(l.text, /!|·|—/, l.text);
  assert.match(finePrint({ phase: 'idle', saved: null, word: 'part', all: 'both parts' }).text, /Until then, both parts show\.$/);
  assert.match(finePrint({ phase: 'idle', saved: 'a', word: 'part', all: 'both parts' }).text, /^Only that part’s chapters/);
});

test('rows of the first draw rise; rows that arrive later only fade', () => {
  assert.equal(rowEntrance(false), 'rise');
  assert.equal(rowEntrance(true), 'fade');
});

test('the picker is wired to the logic: awaits the re-read, one busy group, no spinner overlay, reserved fine print', () => {
  const home = readFileSync(new URL('../../src/components/keycards/KeycardsHome.jsx', import.meta.url), 'utf8');
  assert.match(home, /await saveOption\(/);
  assert.match(home, /await refreshHome\(\)/);
  assert.match(home, /role="radiogroup"[^>]*aria-busy=/);
  assert.doesNotMatch(home, /refreshHome\(\); \}/, 'the re-read is never fire-and-forget');
  const css = readFileSync(new URL('../../src/components/keycards/keycards.css', import.meta.url), 'utf8');
  assert.match(css, /\.kc-opt__fine \{[^}]*min-height: 44px/);
  assert.match(css, /\.kc-units\[aria-busy='true'\] \{ opacity: 0\.55; \}/);
  assert.match(css, /\.kc-row\[data-enter='fade'\] \{ animation: kc-fade 180ms ease-out/);
  const api = readFileSync(new URL('../../src/components/keycards/api.js', import.meta.url), 'utf8');
  assert.match(api, /prev\.data \? prev : \{ state: 'error'/, 'a failed re-read keeps the body the page has');
});

test('&kclag= delays only the home read, caps at 5 s, and is 0 in a production build', () => {
  const home = new URL('http://localhost/api/keycards');
  const q = (s) => new URLSearchParams(s);
  assert.equal(kcLagMs(home, 'GET', q('kclag=1500')), 1500);
  assert.equal(kcLagMs(home, 'get', q('kclag=1500')), 1500);
  assert.equal(kcLagMs(home, 'GET', q('kclag=999999')), 5000);
  assert.equal(kcLagMs(home, 'GET', q('kclag=-5')), 0);
  assert.equal(kcLagMs(home, 'GET', q('kclag=abc')), 0);
  assert.equal(kcLagMs(home, 'GET', q('')), 0);
  assert.equal(kcLagMs(home, 'PUT', q('kclag=1500')), 0, 'the save is never delayed');
  assert.equal(kcLagMs(new URL('http://localhost/api/keycards/deck'), 'GET', q('kclag=1500')), 0);
  assert.equal(kcLagMs(home, 'GET', q('kclag=1500'), { NODE_ENV: 'production' }), 0);
  assert.equal(kcLagMs(home, 'GET', q('kclag=1500'), { NODE_ENV: 'development' }), 1500);
});
