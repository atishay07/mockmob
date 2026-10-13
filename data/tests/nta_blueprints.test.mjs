// Internal consistency of data/nta_blueprints. It checks arithmetic and syllabus names only;
// it says nothing about whether the patterns match NTA (see docs/brain/NTA-PATTERN-SPEC.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } from '../cuet_controls.js';
import { getCanonicalSubject } from '../canonical_syllabus.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'nta_blueprints');
const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const index = read('index.json');
const sources = read('_sources.json').sources;
const typeDefs = read('_types.json').types;

const inRange = (range, label) => {
  assert.ok(range.min <= range.target && range.target <= range.max, `${label}: min ${range.min} <= target ${range.target} <= max ${range.max}`);
};

test('there is one blueprint per supported subject', () => {
  assert.deepEqual(Object.keys(index.subjects).sort(), [...CUET_PUBLIC_ALLOWED_SUBJECTS].sort());
});

for (const subject of CUET_PUBLIC_ALLOWED_SUBJECTS) {
  test(`${subject} blueprint is internally consistent`, () => {
    const bp = read(index.subjects[subject]);
    assert.equal(bp.subject, subject);
    assert.equal(bp.internalSubject, toInternalSubjectId(subject));
    assert.equal(bp.exam.totalQuestions, 50);
    assert.equal(bp.exam.durationMinutes, 60);
    assert.equal(bp.exam.attempt, 'all_compulsory');
    assert.deepEqual([bp.exam.marking.correct, bp.exam.marking.incorrect, bp.exam.marking.unanswered], [5, -1, 0]);

    const canonical = new Set((getCanonicalSubject(bp.internalSubject)?.units || []).flatMap((unit) => unit.chapters));
    const excluded = new Set(bp.excludedChapters.map((entry) => entry.name));
    for (const name of excluded) assert.ok(canonical.has(name), `${subject}: excluded chapter ${name} is a stored chapter name`);

    assert.equal(bp.variants.filter((variant) => variant.default).length, 1, `${subject}: exactly one default variant`);
    for (const variant of bp.variants) {
      const sectionTotal = variant.sections.reduce((sum, section) => sum + section.questions, 0);
      assert.equal(sectionTotal, 50, `${subject}/${variant.id}: sections add to 50`);
      let position = 1;
      for (const section of variant.sections) {
        assert.deepEqual(section.positions, [position, position + section.questions - 1], `${subject}/${variant.id}/${section.id}: positions`);
        position += section.questions;
        const unitTargets = section.units.reduce((sum, unit) => sum + unit.questions.target, 0);
        assert.equal(unitTargets, section.questions, `${subject}/${variant.id}/${section.id}: unit targets add to the section size`);
        assert.ok(section.units.reduce((sum, unit) => sum + unit.questions.min, 0) <= section.questions);
        assert.ok(section.units.reduce((sum, unit) => sum + unit.questions.max, 0) >= section.questions);
        for (const unit of section.units) {
          inRange(unit.questions, `${subject}/${unit.name}`);
          const chapterTargets = unit.chapters.reduce((sum, chapter) => sum + chapter.target, 0);
          assert.equal(chapterTargets, unit.questions.target, `${subject}/${unit.name}: chapter targets add to the unit target`);
          for (const chapter of unit.chapters) {
            inRange(chapter, `${subject}/${chapter.name}`);
            assert.ok(canonical.has(chapter.name), `${subject}: ${chapter.name} is a canonical chapter`);
            assert.ok(!excluded.has(chapter.name) || chapter.max === 0, `${subject}: excluded ${chapter.name} has max 0`);
            for (const alias of chapter.aliases || []) assert.ok(alias && alias !== chapter.name, `${subject}: alias ${alias} names another stored chapter`);
            if (chapter.subtypes) {
              const subtypeTargets = Object.values(chapter.subtypes).reduce((sum, range) => sum + range.target, 0);
              assert.equal(subtypeTargets, chapter.target, `${subject}/${chapter.name}: subtype targets add to the chapter target`);
            }
          }
        }
      }
    }

    for (const [type, range] of Object.entries(bp.typeQuotas)) {
      inRange(range, `${subject} type ${type}`);
      assert.ok(typeDefs[type], `${subject}: ${type} is defined in _types.json`);
    }
    const typeTargets = Object.values(bp.typeQuotas).reduce((sum, range) => sum + range.target, 0);
    assert.equal(typeTargets + bp.sets.questions.target, 50, `${subject}: standalone type targets + set questions = 50`);
    inRange(bp.sets.count, `${subject} set count`);
    inRange(bp.sets.size, `${subject} set size`);
    inRange(bp.sets.questions, `${subject} set questions`);
    assert.equal(bp.sets.count.target * bp.sets.size.target, bp.sets.questions.target, `${subject}: set count x size = set questions`);
    assert.equal(bp.sets.positions.length, bp.sets.count.target, `${subject}: one position range per target set`);
    for (const [first, last] of bp.sets.positions) assert.equal(last - first + 1, bp.sets.size.target);

    const difficulty = ['easy', 'medium', 'hard'].map((key) => bp.difficulty[key]);
    difficulty.forEach((range, i) => inRange(range, `${subject} difficulty ${i}`));
    assert.ok(Math.abs(difficulty.reduce((sum, range) => sum + range.target, 0) - 1) < 1e-9, `${subject}: difficulty targets add to 1`);

    for (const key of bp.sources) assert.ok(sources[key], `${subject}: source ${key} exists`);
    for (const level of Object.values(bp.evidence.confidence)) assert.match(level, /^(high|medium|low)/);
    assert.ok(bp.evidence.inferred.length > 0, `${subject}: inferred fields are listed`);
  });
}

test('type detection patterns compile', () => {
  for (const [type, def] of Object.entries(typeDefs)) for (const pattern of def.patterns || []) assert.doesNotThrow(() => new RegExp(pattern, 'i'), `${type}: ${pattern}`);
});

test('type patterns classify real 2025 NTA stems', () => {
  const order = read('_types.json').order;
  const classify = (stem) => order.find((type) => (typeDefs[type].patterns || []).some((pattern) => new RegExp(pattern, 'i').test(stem))) || 'single_mcq';
  assert.equal(classify('Match List-I with List-II. List-I List-II (A) Increase in demand (i) Increase in both'), 'match_the_following');
  assert.equal(classify('Arrange the following stages of oogenesis in correct sequence of their formation. (A) Secondary oocyte (B) Oogonium'), 'sequence_ordering');
  assert.equal(classify('Rearrange the following parts in the correct sequence to form a meaningful sentence: (A) patrons could enjoy'), 'sentence_rearrangement');
  assert.equal(classify('Which of the following statements are correct? (A) A solution which obeys Raoult\'s law (B) A solution which shows (C) Azeotropes (D) ... Choose the correct answer from the options given below: (1) (A), (B) and (C) only'), 'statement_based');
  assert.equal(classify('Select the word similar in meaning to the given word: Munificent'), 'synonym');
  assert.equal(classify('Select the word opposite in meaning to the given word: Sagacious'), 'antonym');
  assert.equal(classify('Choose the correct option to fill in the blank in the given sentence: The movie was so ________ that'), 'fill_in_blank');
  assert.equal(classify('Assertion (A): Induced current opposes the change. Reason (R): Energy is conserved.'), 'assertion_reason');
  assert.equal(classify('Vitamin B12 is a coordination compound of'), 'single_mcq');
});
