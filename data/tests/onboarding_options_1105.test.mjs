// The section or part a school teaches, asked at web onboarding (LK94), and the Key card turn's lift (LK95).
//   node --test data/tests/onboarding_options_1105.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUBJECT_OPTIONS } from '../cuet_syllabus.js';
import { OPTION_ASKS, OPTIONS_LATER, optionsToSave, shownChoice, subjectsAsking } from '../../src/app/onboarding/optionChoices.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the onboarding asks match the syllabus options exactly (ids, labels, default, Section or Part)', () => {
  assert.deepEqual(Object.keys(OPTION_ASKS).sort(), Object.keys(SUBJECT_OPTIONS).sort());
  for (const [id, ask] of Object.entries(OPTION_ASKS)) {
    const real = SUBJECT_OPTIONS[id];
    assert.equal(ask.label, real.label);
    assert.equal(ask.default, real.default);
    assert.deepEqual(ask.choices.map((c) => [c.id, c.label]), real.choices.map((c) => [c.id, c.label]));
    for (const c of ask.choices) assert.ok(c.line.length > 10 && c.line.length < 90, `${id} ${c.id} has a one-line explanation`);
  }
  assert.equal(OPTIONS_LATER, 'You can change this later in Learn.');
});

test('the default is preselected, a tap wins, a saved choice shows when nothing was tapped', () => {
  assert.equal(shownChoice('accountancy'), 'AFS');
  assert.equal(shownChoice('mathematics', { saved: { mathematics: 'B2' } }), 'B2');
  assert.equal(shownChoice('mathematics', { saved: { mathematics: 'B2' }, touched: { mathematics: 'B1' } }), 'B1');
  assert.equal(shownChoice('mathematics', { saved: { mathematics: 'nonsense' } }), 'B1');
  assert.equal(shownChoice('physics'), null);
  assert.deepEqual(subjectsAsking(['physics', 'accountancy', 'mathematics']), ['accountancy', 'mathematics']);
});

test('a first run saves every picked choice, the default too; editing saves only touched or already-held ones', () => {
  const picks = ['physics', 'accountancy', 'computer_science'];
  assert.deepEqual(optionsToSave(picks), [{ subject: 'accountancy', option: 'AFS' }, { subject: 'computer_science', option: 'B1' }]);
  assert.deepEqual(optionsToSave(picks, { edit: true }), []);
  assert.deepEqual(optionsToSave(picks, { edit: true, touched: { accountancy: 'CAS' }, saved: { computer_science: 'B2' } }),
    [{ subject: 'accountancy', option: 'CAS' }, { subject: 'computer_science', option: 'B2' }]);
});

test('the client saves the options after the subjects save succeeds, in the first run and in edit', () => {
  const src = read('src/app/onboarding/OnboardingPageClient.jsx');
  const ok = src.indexOf('if (!response.ok) throw new Error(SUBJECTS_FAILED);');
  const save = src.indexOf('await saveChosenOptions(picks);');
  assert.ok(ok > 0 && save > ok, 'the options are written after the subjects response is checked');
  assert.ok(save < src.indexOf('if (edit) {', save), 'before the edit branch, so both flows save them');
  assert.match(src, /saveOption\(w\)/);
  assert.match(read('src/app/onboarding/OptionPicker.jsx'), /type="radio"/);
});

test('Learn reads a saved choice plainly: the server hint only says "Both parts" while nothing is chosen', () => {
  const src = read('src/lib/server/learn.js');
  assert.match(src, /chosen: S\.option, hint: S\.option \? "Only your part's chapters show here and in your practice\." : 'Both parts show until you choose\.'/);
});

test('the Key card turn lifts: --lift on the rotation own 340 ms curve, peak at 90 degrees, reduced motion unchanged', () => {
  for (const [file, curve] of [['src/components/learn2/stage/stage.css', '--st-ease'], ['src/components/learn2/run/run.css', '--lr-flight']]) {
    const css = read(file);
    assert.ok(css.includes(`transition: --lift 340ms var(${curve})`), `${file}: the lift runs on the turn's 340 ms curve`);
    assert.ok(css.includes(`transition: transform 340ms var(${curve})`), `${file}: the rotation itself is unchanged`);
    assert.ok(css.includes('--bump: calc(1 - abs(2 * var(--lift) - 1))'), `${file}: the bump peaks at the halfway point`);
    assert.ok(css.includes('scale: calc(1 + 0.03 * var(--bump))'), `${file}: about 1.03 at 90 degrees`);
    assert.ok(css.includes('scale: none'), `${file}: reduced motion takes no lift`);
  }
});
