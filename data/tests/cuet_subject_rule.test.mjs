// CUET UG allows at most five subjects, languages and the General Test included (NTA information bulletins
// 2025 and 2026). Every picker, server check and line of copy must use that one number.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUET_MAX_SUBJECTS, SUBJECT_RULE_NOTE, capSubjects, pickUpToLine } from '../../src/lib/cuetRules.mjs';
import { SUBJECT_CAP, pickedLine, pickedSlots } from '../../src/app/onboarding/firstRun.js';
import { SUBJECT_LIMIT, subjectCountLine } from '../../src/components/profile/accountModel.mjs';
import { MAX_SUBJECTS, startSubjects } from '../../src/components/start/startModel.mjs';
import { DEFAULT_MAX_PAPERS } from '../../src/lib/du/combos.js';
import { profilePatch } from '../../src/lib/server/profilePatch.js';

const SEVEN = ['english', 'economics', 'accountancy', 'business_studies', 'history', 'geography', 'physics'];

test('the rule is five in all', () => {
  assert.equal(CUET_MAX_SUBJECTS, 5);
  assert.deepEqual(capSubjects(SEVEN), SEVEN.slice(0, 5));
  assert.equal(pickUpToLine(), 'Pick up to 5.');
  assert.match(SUBJECT_RULE_NOTE, /five papers in all/);
  assert.match(SUBJECT_RULE_NOTE, /language or the General Test counts as one/);
  assert.match(SUBJECT_RULE_NOTE, /CUET UG 2026 limit/, 'the note names the cycle it is true for (N6)');
  assert.equal(SUBJECT_RULE_NOTE.split('. ').length, 1, 'one sentence on one line, no second disclaimer');
});

test('every picker and check shares the one number', () => {
  for (const n of [SUBJECT_CAP, SUBJECT_LIMIT, MAX_SUBJECTS, DEFAULT_MAX_PAPERS]) assert.equal(n, CUET_MAX_SUBJECTS);
  assert.equal(startSubjects(SEVEN).length, 5, 'the Start sheet never offers a sixth subject');
  assert.equal(pickedSlots(SEVEN).length, 5);
  assert.equal(pickedLine(5), '5 of 5 picked');
  assert.equal(subjectCountLine(5), '5 of 5 picked');
});

test('the server takes five subjects and refuses six, a language and the General Test included', () => {
  const five = ['english', 'hindi', 'accountancy', 'economics', 'general_test'];
  assert.deepEqual(profilePatch({ subjects: five }).patch, { subjects: five });
  assert.match(profilePatch({ subjects: [...five, 'history'] }).error, /up to 5/);
});

test('no source file hard-codes a different cap', () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.doesNotMatch(read('src/components/start/startModel.mjs'), /MAX_SUBJECTS\s*=\s*\d/);
  assert.doesNotMatch(read('src/lib/server/profilePatch.js'), /MAX_SUBJECTS\s*=\s*\d/);
  assert.doesNotMatch(read('src/components/ai/AIRivalArena.jsx'), /slice\(0, 5\)/);
  assert.doesNotMatch(read('src/services/ai-rival/createAIRivalBattle.js'), /subjects\.slice\(0, 5\)/);
  assert.match(read('src/app/cuet-2027/page.js'), /lets a candidate choose up to five subjects in all/);
});
