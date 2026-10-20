// W4 (V16): the web first run asks the subjects first with Commerce ticked and one big key. Pure rules, then the page wiring and the
// copy rules. Run: node --test data/tests/onboarding_preset_1021.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMMON_SETS, PRESET_ADDS, PRESET_BASE, PRESET_KEY, PRESET_LEAD, PRESET_OWN, PRESET_TITLE, presetAddLabel, presetAdds, presetAvailable,
} from '../../src/app/onboarding/commonSets.mjs';
import { SUBJECT_CAP } from '../../src/app/onboarding/firstRun.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const page = read('src/app/onboarding/OnboardingPageClient.jsx');
const css = read('src/app/onboarding/onboarding.css');

test('the preset is the same Commerce four the app and the first common set use', () => {
  assert.deepEqual([...PRESET_BASE], ['accountancy', 'business_studies', 'economics', 'english']);
  assert.deepEqual([...PRESET_BASE], [...COMMON_SETS[0].subjects]);
  assert.deepEqual([...PRESET_ADDS], ['mathematics', 'general_test']);
  assert.ok(PRESET_BASE.length <= SUBJECT_CAP);
  assert.ok(PRESET_BASE.length + 1 <= SUBJECT_CAP, 'one add always fits; the second meets the five-paper reason');
});

test('the preset shows only when MockMob can practise all four; adds only when it can practise them', () => {
  assert.equal(presetAvailable([...PRESET_BASE, 'physics']), true);
  assert.equal(presetAvailable(['accountancy', 'economics', 'english']), false);
  assert.equal(presetAvailable(), false);
  assert.deepEqual(presetAdds([...PRESET_BASE, 'mathematics']), ['mathematics']);
  assert.deepEqual(presetAdds([...PRESET_BASE]), []);
  assert.equal(presetAddLabel('Mathematics', false), 'Add Mathematics');
  assert.equal(presetAddLabel('Mathematics', true), 'Remove Mathematics');
});

test('the copy is plain: no exclamation mark, dash, arrow or emoji', () => {
  assert.equal(PRESET_TITLE, 'Most students take Commerce');
  assert.equal(PRESET_KEY, 'These are my subjects');
  assert.equal(PRESET_OWN, 'Pick my own');
  for (const text of [PRESET_TITLE, PRESET_LEAD, PRESET_KEY, PRESET_OWN]) assert.doesNotMatch(text, /[!—–→\u{1F300}-\u{1FAFF}]|lost|behind|last/iu, text);
});

test('the page wires the preset: stored choices, edit and Pick my own keep the grid; the save and the cap are the existing ones', () => {
  assert.match(page, /const presetMode = !edit && !ownPick && !savedThisVisit && savedSubjects === 0 && step === 'subjects'/);
  assert.match(page, /presetAvailable\(available\)/);
  // The key saves exactly the preset set through the same save as Next.
  assert.ok(page.includes('onClick={() => saveSubjects(presetPicks)}'));
  assert.ok(page.includes('const picks = Array.isArray(list) ? list : selected;') && page.includes('JSON.stringify({ subjects: picks })'));
  // The add chips use the cap-aware toggle, so a sixth paper is answered with the reason and a swap.
  assert.ok(page.includes('onClick={() => toggleSubject(id)}') && page.includes('capCopy({ wantedName'));
  // Pick my own starts the grid with nothing ticked.
  assert.match(page, /const pickOwn = \(\) => \{[\s\S]*?setOwnPick\(true\);\s*setSelected\(\[\]\);/);
  // One primary: the fixed bar steps aside on the preset, except to carry the five-paper reason.
  assert.ok(page.includes('{presetMode && !capShown ? null : ('));
  // Entry and stay logic, catalog states and the back link are untouched.
  assert.ok(page.includes('onboardingEntry({ status, savedSubjects, edit, inFlow: savedThisVisit || arrivedForDays })'));
  assert.ok(page.includes("catalogState === 'error' && step === 'subjects'") && page.includes('backToSubjects'));
});

test('the key is at least 44 px tall and the chips and adds are readable', () => {
  assert.match(css, /\.ob-preset__key \{[^}]*min-height: 52px/);
  assert.match(css, /\.ob-preset__add \{[^}]*min-height: 44px/);
  assert.match(css, /\.ob-preset__add:focus-visible \{ outline: 2px solid var\(--a-focus\)/);
});
