// Syllabus v2 (docs/brain/intel-1031/syllabus-verified.md): pins every ruling, the alias and retired handling, the
// serving filters in the shared selectors, the option filter, and a PGlite run of the migration, the re-tag hook and the undo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  CHAPTERS, CHAPTER_ALIASES, RETIRED_CHAPTERS, SPLIT_CHAPTERS, SUBJECT_OPTIONS, SYLLABUS_YEAR, SYLLABUS_SUBJECTS,
  chapterChip, chapterEntry, chapterKey, chaptersFor, filterServable, isServableQuestion, liveChapterRows, resolveChapter,
  sectionAllowed, slugChapter, storedNamesFor, unitsFor, variantForOption,
} from '../cuet_syllabus.js';
import {
  CANONICAL_SYLLABUS, TOP_SUBJECTS, canonicalChapterName, getCanonicalChapters, getCanonicalUnitForChapter, isValidTopSyllabusPair,
} from '../canonical_syllabus.js';
import { rankCandidates } from '../mock_question_selector.js';
import { pickFromFullPool, pickFromLightPool } from '../practice_pick.js';
import { qualityGateNtaQuestion } from '../nta_question_selector.js';
import { readablePracticeQuestions } from '../practice_library.js';
import { contentHash, contentHashMatch, contentHashMatches } from '../content_evidence.js';
import { ntaFitVerdict, ntaStoredFitTags } from '../nta_fit_scores.js';
import { sameChapter } from '../../scripts/pipeline/lib/factoryEvidence.mjs';
import { chapterUnits } from '../../src/app/(app)/dashboard/chapterGroups.mjs';
import { MERGE_RENAMES, migrationSql, undoSql } from '../../scripts/syllabus/build-syllabus-v2-sql.mjs';
import { retagProblems, retagSql } from '../../scripts/syllabus/retag-sql.mjs';

const live = (subject, name) => {
  const r = resolveChapter(subject, name);
  assert.ok(r && !r.retired, `${subject} / ${name} should be live`);
  return r;
};
const names = (subject, opts) => chaptersFor(subject, opts).map((c) => c.name);
const entry = (subject, name) => CHAPTERS.find((c) => c.subject === subject && c.name === name);

test('one source for the 15 top subjects, CUET 2026', () => {
  assert.equal(SYLLABUS_YEAR, 2026);
  assert.deepEqual([...SYLLABUS_SUBJECTS].sort(), [...TOP_SUBJECTS].sort());
  for (const c of CHAPTERS) {
    for (const field of ['key', 'subject', 'name', 'title', 'unit']) assert.ok(typeof c[field] === 'string' && c[field], `${c.key} ${field}`);
    assert.ok(Number.isInteger(c.unitOrder) && Number.isInteger(c.order));
    assert.ok([null, 'A1', 'B1', 'B2', 'A', 'AFS', 'CAS'].includes(c.section), `${c.key} section ${c.section}`);
    for (const flag of ['cuetOnly', 'cbseClass11', 'lightWeight']) assert.equal(typeof c[flag], 'boolean');
    if (c.ncert) assert.ok(c.ncert.book && 'code' in c.ncert && 'chapter' in c.ncert, c.key);
  }
});

test('every name is unique per subject and every key follows the shared rule', () => {
  for (const subject of SYLLABUS_SUBJECTS) {
    const list = CHAPTERS.filter((c) => c.subject === subject).map((c) => c.name);
    assert.equal(new Set(list).size, list.length, subject);
  }
  assert.equal(new Set(CHAPTERS.map((c) => c.key)).size, CHAPTERS.length);
  for (const c of CHAPTERS) assert.equal(c.key, `${c.subject}.${slugChapter(c.name)}`);
  assert.equal(chapterKey('business_studies', 'Nature & Significance of Management'), 'business_studies.nature-and-significance-of-management');
  assert.equal(slugChapter('  Human Geography — Nature & Scope '), 'human-geography-nature-and-scope');
  assert.equal(slugChapter("India's External Relations"), 'india-s-external-relations');
});

test('units are in CUET order and chapters in NCERT order inside each unit', () => {
  for (const subject of SYLLABUS_SUBJECTS) {
    const units = unitsFor(subject);
    assert.deepEqual(units.map((u) => u.unitOrder), units.map((_, i) => i + 1), subject);
    assert.equal(new Set(units.map((u) => u.unit)).size, units.length, `${subject} unit titles unique`);
    for (const u of units) {
      const numbered = u.chapters.filter((c) => c.ncert?.chapter && c.ncert.book === u.chapters[0].ncert?.book);
      for (let i = 1; i < numbered.length; i += 1) assert.ok(numbered[i].ncert.chapter >= numbered[i - 1].ncert.chapter, `${subject} ${u.unit}`);
    }
  }
  assert.deepEqual(unitsFor('business_studies').map((u) => u.unit), ['Nature and Significance of Management', 'Principles of Management', 'Business Environment', 'Planning', 'Organising', 'Staffing', 'Directing', 'Controlling', 'Business Finance', 'Financial Markets', 'Marketing', 'Consumer Protection']);
  assert.deepEqual(names('computer_science').slice(3, 12), ['Exception and File Handling in Python', 'File Handling', 'Stack', 'Queue', 'Sorting', 'Searching', 'Understanding Data', 'Data Communication', 'Security Aspects']);
});

test('spec example: Financial Management under CUET unit Business Finance, NCERT Part 2 Ch 9', () => {
  const c = entry('business_studies', 'Financial Management');
  assert.equal(c.key, 'business_studies.financial-management');
  assert.equal(c.title, 'Financial Management');
  assert.equal(c.unit, 'Business Finance');
  assert.equal(c.unitOrder, 9);
  assert.equal(c.order, 1);
  assert.deepEqual({ book: c.ncert.book, code: c.ncert.code, chapter: c.ncert.chapter }, { book: 'Business Studies Part 2', code: 'lebs201', chapter: 9 });
  assert.equal(c.section, null);
});

test('rulings section 2: options for Mathematics, Computer Science and Accountancy, picked on the subject page', () => {
  assert.deepEqual(Object.keys(SUBJECT_OPTIONS).sort(), ['accountancy', 'computer_science', 'mathematics']);
  assert.equal(SUBJECT_OPTIONS.mathematics.default, 'B1');
  assert.equal(SUBJECT_OPTIONS.computer_science.default, 'B1');
  assert.equal(SUBJECT_OPTIONS.accountancy.default, 'AFS');
  // Maths: A1 common; the four B2-only chapters; Probability Distributions where the PDF puts it (A1, common).
  for (const n of ['Numbers, Quantification and Numerical Applications', 'Time Based Data', 'Inferential Statistics', 'Financial Mathematics']) assert.equal(entry('mathematics', n).section, 'B2', n);
  assert.equal(entry('mathematics', 'Probability Distributions').section, 'A1');
  assert.deepEqual(CHAPTERS.filter((c) => c.subject === 'mathematics' && c.section === 'B2').map((c) => c.name).sort(), ['Financial Mathematics', 'Inferential Statistics', 'Numbers, Quantification and Numerical Applications', 'Time Based Data']);
  const b1 = names('mathematics', { option: 'B1' });
  const b2 = names('mathematics', { option: 'B2' });
  assert.ok(b1.includes('Vector Algebra') && !b1.includes('Time Based Data') && b1.includes('Probability Distributions'));
  assert.ok(b2.includes('Time Based Data') && !b2.includes('Vector Algebra') && b2.includes('Matrices') && b2.includes('Probability Distributions'));
  // CS: Section A common.
  assert.ok(names('computer_science', { option: 'B2' }).includes('Database Concepts'));
  assert.ok(!names('computer_science', { option: 'B2' }).includes('Stack'));
  assert.ok(!names('computer_science', { option: 'B1' }).includes('Societal Impacts'));
  // Accountancy: CAS is the alternative to Analysis of Financial Statements.
  const afs = names('accountancy', { option: 'AFS' });
  const cas = names('accountancy', { option: 'CAS' });
  assert.ok(afs.includes('Cash Flow Statement') && !afs.includes('Computerized Accounting System'));
  assert.ok(cas.includes('Computerized Accounting System') && !cas.includes('Accounting Ratios') && cas.includes('Share Capital'));
  // No option: everything (unchanged behaviour); an option for a subject without options changes nothing.
  assert.equal(names('mathematics').length, CHAPTERS.filter((c) => c.subject === 'mathematics').length);
  assert.equal(sectionAllowed('physics', null, 'B1'), true);
  assert.equal(sectionAllowed('mathematics', 'B2', 'nonsense'), true);
  assert.equal(variantForOption('mathematics', 'B1'), 'core');
  assert.equal(variantForOption('mathematics', 'B2'), 'applied');
  assert.equal(variantForOption('computer_science', 'B1'), 'cs');
  assert.equal(variantForOption('computer_science', 'b2'), 'ip');
  assert.equal(variantForOption('accountancy', 'CAS'), null);
  assert.equal(variantForOption('mathematics', null), null);
});

test('rulings section 3: every off-syllabus chapter is retired, stored, never valid', () => {
  const expected = {
    economics: ['Infrastructure'],
    business_studies: ['Entrepreneurship Development'],
    physics: ['Communication Systems'],
    chemistry: ['Solid State', 'Surface Chemistry', 'Isolation of Elements', 'p-Block Elements', 'Polymers', 'Chemistry in Everyday Life'],
    biology: ['Reproduction in Organisms', 'Environmental Issues'],
    history: ['Kings & Chronicles', 'Partition'],
    political_science: ['Cold War Era', 'US Hegemony in World Politics', 'Rise of Popular Movements'],
    geography: ['Manufacturing Industries', 'Migration'],
    psychology: ['Psychology & Life', 'Developing Psychological Skills'],
    computer_science: ['Boolean Algebra', 'Python Revision', 'Functions', 'Interface Python with MySQL'],
  };
  assert.deepEqual(Object.fromEntries(Object.entries(RETIRED_CHAPTERS).map(([s, m]) => [s, Object.keys(m)])), expected);
  for (const [subject, list] of Object.entries(expected)) {
    for (const name of list) {
      assert.deepEqual(resolveChapter(subject, name), { retired: true, reason: 'not_in_cuet_2026', name });
      assert.equal(isValidTopSyllabusPair(subject, name), false, name);
      assert.ok(!getCanonicalChapters(subject).includes(name), name);
      assert.ok(!CHAPTERS.some((c) => c.subject === subject && c.name === name), name);
    }
  }
  // "and" spellings of a retired name are retired too.
  assert.equal(resolveChapter('history', 'Kings and Chronicles')?.retired, true);
  assert.equal(resolveChapter('psychology', 'Psychology and Life')?.retired, true);
});

test('rulings section 4: the audit was wrong here, these stay', () => {
  for (const [s, n] of [
    ['political_science', 'Alternative Centres of Power'], ['political_science', 'Democratic Upsurge and Coalition Politics'],
    ['political_science', 'Recent Issues and Challenges'], ['political_science', 'Era of One-Party Dominance'],
    ['economics', 'Indian Economy on the Eve of Independence'],
  ]) live(s, n);
  // CUET title leads, NCERT is the reference.
  const acp = entry('political_science', 'Alternative Centres of Power');
  assert.equal(acp.title, 'Alternative Centres of Power');
  assert.equal(acp.ncert.title, 'Contemporary Centres of Power');
  assert.equal(acp.ncert.chapter, 2);
  for (const n of ['Democratic Upsurge and Coalition Politics', 'Recent Issues and Challenges']) assert.equal(entry('political_science', n).ncert.title, 'Recent Developments in Indian Politics');
  assert.equal(resolveChapter('political_science', 'Recent Developments in Indian Politics'), null, 'shared NCERT title resolves to neither');
  assert.equal(entry('economics', 'Indian Economy on the Eve of Independence').lightWeight, true);
  // Geography: Resources and Development is the CUET unit with four NCERT chapters; the old tag waits for its re-tag.
  assert.deepEqual(unitsFor('geography').find((u) => u.unit === 'Resources and Development').chapters.map((c) => c.title),
    ['Land Resources and Agriculture', 'Water Resources', 'Mineral and Energy Resources', 'Planning and Sustainable Development in Indian Context']);
  assert.equal(resolveChapter('geography', 'Resources & Development'), null);
  assert.equal(isValidTopSyllabusPair('geography', 'Resources & Development'), false);
  assert.deepEqual(SPLIT_CHAPTERS.geography['Resources & Development'], ['Land Resources and Agriculture', 'Water Resources', 'Mineral and Energy Resources', 'Planning & Sustainable Development']);
});

test('rulings section 5: merges keep the stored name that holds the questions; the twin is an alias; NCERT wording is the title', () => {
  const merges = [
    ['accountancy', 'Dissolution of Partnership', 'Dissolution of Partnership Firm', 'Dissolution of Partnership Firm'],
    ['accountancy', 'Computerised Accounting System', 'Computerized Accounting System', 'Computerised Accounting System'],
    ['economics', 'National Income Accounting', 'National Income & Related Aggregates', 'Introduction and National Income Accounting'],
    ['economics', 'Determination of Income and Employment', 'Income Determination', 'Determination of Income and Employment'],
    ['business_studies', 'Business Finance', 'Financial Management', 'Financial Management'],
    ['business_studies', 'Marketing', 'Marketing Management', 'Marketing'],
    ['mathematics', 'Vectors', 'Vector Algebra', 'Vector Algebra'],
    ['physics', 'Electronic Devices', 'Semiconductor Electronics', 'Semiconductor Electronics: Materials, Devices and Simple Circuits'],
    ['chemistry', 'd and f Block Elements', 'd- and f-Block Elements', 'The d- and f-Block Elements'],
    ['computer_science', 'File Handling in Python', 'File Handling', 'File Handling in Python'],
    ['computer_science', 'MySQL', 'Structured Query Language', 'Structured Query Language (SQL)'],
    ['computer_science', 'Communication Technologies', 'Data Communication', 'Data Communication'],
    ['sociology', 'The Story of Indian Democracy', 'Story of Indian Democracy', 'The Constitution and Social Change'],
  ];
  for (const [subject, alias, name, title] of merges) {
    const r = live(subject, alias);
    assert.equal(r.name, name, alias);
    assert.equal(r.title, title, alias);
    assert.equal(isValidTopSyllabusPair(subject, alias), true, alias);
    assert.equal(canonicalChapterName(subject, alias), name, alias);
    assert.ok(!getCanonicalChapters(subject).includes(alias), `${alias} is not its own chapter`);
    assert.ok(storedNamesFor(subject, name).includes(alias), alias);
  }
  // NCERT CS XII titles.
  const cs = Object.fromEntries(CHAPTERS.filter((c) => c.subject === 'computer_science' && c.ncert?.book === 'Computer Science').map((c) => [c.ncert.chapter, c.ncert.title]));
  assert.deepEqual(cs, { 1: 'Exception Handling in Python', 2: 'File Handling in Python', 3: 'Stack', 4: 'Queue', 5: 'Sorting', 6: 'Searching', 7: 'Understanding Data', 8: 'Database Concepts', 9: 'Structured Query Language (SQL)', 10: 'Computer Networks', 11: 'Data Communication', 12: 'Security Aspects' });
  assert.deepEqual(SPLIT_CHAPTERS.computer_science['Data Structures'], ['Stack', 'Queue']);
  assert.equal(resolveChapter('computer_science', 'Data Structures'), null);
  // Sociology placements.
  assert.equal(entry('sociology', 'Story of Indian Democracy').unit, 'Social Change and the Polity');
  const market = entry('sociology', 'Market as a Social Institution');
  assert.equal(market.ncert.book, 'Indian Society');
  assert.equal(market.ncert.chapter, 4);
  assert.equal(entry('sociology', 'Mass Media & Communications').unit, 'New Arenas of Social Change');
  // Cosmetic "&" vs "and": only the title changes; the stored name stays.
  assert.equal(entry('business_studies', 'Nature & Significance of Management').title, 'Nature and Significance of Management');
  assert.equal(live('physics', 'Moving Charges and Magnetism').name, 'Moving Charges & Magnetism');
  // The merge list the migration applies is the alias map's.
  for (const [subject, from, to] of MERGE_RENAMES) assert.equal(CHAPTER_ALIASES[subject][from], to);
  assert.ok(!MERGE_RENAMES.some(([, from]) => from === 'Communication Technologies'), 'merge after review goes through the re-tag file');
});

test('rulings section 6: at most one chip, only where the rulings put one', () => {
  const chips = CHAPTERS.filter((c) => chapterChip(c)).map((c) => `${c.subject}:${c.name}:${chapterChip(c)}`).sort();
  assert.deepEqual(chips, [
    'computer_science:Queue:CUET only', 'computer_science:Searching:CUET only', 'computer_science:Security Aspects:CUET only',
    'computer_science:Sorting:CUET only', 'computer_science:Understanding Data:CUET only',
    'economics:Introduction & Theory of Consumer Behaviour:CBSE teaches this in Class 11', 'economics:Market Equilibrium & Simple Applications:CBSE teaches this in Class 11',
    'economics:Production & Costs:CBSE teaches this in Class 11', 'economics:Theory of Firms under Perfect Competition:CBSE teaches this in Class 11',
    'sociology:Globalisation & Social Change:CUET only', 'sociology:Market as a Social Institution:CUET only',
    'sociology:Mass Media & Communications:CUET only', 'sociology:Story of Indian Democracy:CUET only',
  ]);
  for (const c of CHAPTERS) assert.ok(!(c.cuetOnly && c.cbseClass11), c.key);
});

test('aliases and other spellings resolve; unknown names do not', () => {
  live('accountancy', 'Partnership');
  live('business_studies', 'Management');
  live('english', 'Grammar');
  live('gat', 'GK');
  assert.equal(live('general_test', 'Logical and Analytical Reasoning').name, 'Logical & Analytical Reasoning');
  assert.equal(live('english', 'Rearranging the Parts').name, 'Para Jumbles');
  assert.equal(live('history', 'An Imperial Capital: Vijayanagara').name, 'An Imperial Capital — Vijayanagara');
  assert.equal(live('chemistry', 'aldehydes ketones and carboxylic acids').name, 'Aldehydes, Ketones & Carboxylic Acids');
  assert.equal(resolveChapter('physics', 'Quantum Gravity'), null);
  assert.equal(resolveChapter('not_a_subject', 'Planning'), null);
  assert.equal(isValidTopSyllabusPair('physics', ''), false);
  assert.equal(getCanonicalUnitForChapter('physics', 'Electronic Devices')?.unit_name, 'Electronic Devices');
  assert.equal(chapterEntry('business_studies', 'Business Finance')?.name, 'Financial Management');
  assert.equal(sameChapter('Dissolution of Partnership', 'Dissolution of Partnership Firm'), true);
  assert.equal(sameChapter('MySQL', 'Structured Query Language', 'computer_science'), true);
  assert.equal(sameChapter('Partnership Fundamentals', 'Profit & Loss Appropriation Account'), false);
});

test('the canonical map for the 15 is rebuilt from CHAPTERS; the other subjects are untouched', () => {
  for (const subject of TOP_SUBJECTS) {
    const canonical = CANONICAL_SYLLABUS.find((s) => s.subject_id === subject);
    assert.deepEqual(canonical.units.map((u) => u.unit_name), unitsFor(subject).map((u) => u.unit), subject);
    assert.deepEqual(getCanonicalChapters(subject), names(subject), subject);
    assert.ok(!canonical.units.some((u) => /^Existing .* Coverage$/.test(u.unit_name)), subject);
  }
  assert.ok(CANONICAL_SYLLABUS.find((s) => s.subject_id === 'agriculture').units.some((u) => u.unit_name === 'Existing Agriculture Coverage'));
  assert.ok(getCanonicalChapters('applied_mathematics').includes('Financial Mathematics'));
  assert.equal(isValidTopSyllabusPair('agriculture', 'Horticulture'), false, 'not a top subject');
});

test('the priorities file uses live chapter names only', () => {
  const priorities = JSON.parse(readFileSync(new URL('../cuet_chapter_priorities.json', import.meta.url), 'utf8'));
  for (const [subject, list] of Object.entries(priorities)) {
    for (const name of list) assert.equal(resolveChapter(subject, name)?.name, name, `${subject}: ${name}`);
  }
});

// ---- Serving --------------------------------------------------------------------------------------------------

const row = (id, subject, chapter, extra = {}) => ({
  id, subject, chapter, body: `Question ${id} about ${chapter}?`, question: `Question ${id} about ${chapter}?`,
  options: [{ key: 'A', text: 'one' }, { key: 'B', text: 'two' }, { key: 'C', text: 'three' }, { key: 'D', text: 'four' }],
  correct_answer: 'A', correct_index: 0, difficulty: 'medium', score: 0, status: 'live', created_at: `2026-10-${String(10 + (id.length % 10)).padStart(2, '0')}T00:00:00Z`,
  ...extra,
});

test('isServableQuestion: retired chapters and is_cuet_syllabus=false never serve; options filter sections', () => {
  assert.equal(isServableQuestion(row('a', 'chemistry', 'Solid State')), false);
  assert.equal(isServableQuestion(row('b', 'chemistry', 'Solutions', { is_cuet_syllabus: false })), false);
  assert.equal(isServableQuestion(row('c', 'chemistry', 'Solutions')), true);
  assert.equal(isServableQuestion(row('d', 'chemistry', 'Solutions', { is_cuet_syllabus: null })), true);
  assert.equal(isServableQuestion(row('e', 'geography', 'Resources & Development')), true, 'a split waiting for re-tag is on-syllabus content');
  assert.equal(isServableQuestion(row('f', 'agriculture', 'Horticulture')), true, 'other subjects unchanged');
  assert.equal(isServableQuestion(row('g', 'mathematics', 'Time Based Data'), { option: 'B1' }), false);
  assert.equal(isServableQuestion(row('h', 'mathematics', 'Time Based Data'), { option: 'B2' }), true);
  assert.equal(isServableQuestion(row('i', 'mathematics', 'Matrices'), { option: 'B2' }), true);
  assert.equal(isServableQuestion(row('j', 'mathematics', 'Time Based Data')), true, 'no saved option: unchanged');
  assert.equal(isServableQuestion(row('k', 'accountancy', 'Computerised Accounting System'), { option: 'AFS' }), false, 'alias resolves before the section check');
  assert.deepEqual(filterServable([row('a', 'physics', 'Communication Systems'), row('b', 'physics', 'Atoms')]).map((r) => r.id), ['b']);
});

test('rankCandidates (practice and mock ranking) drops retired and flagged rows', () => {
  const ranked = rankCandidates([
    row('r1', 'biology', 'Environmental Issues'), row('r2', 'biology', 'Ecosystem'),
    row('r3', 'biology', 'Evolution', { is_cuet_syllabus: false }), row('r4', 'biology', 'Evolution'),
  ], { mode: { id: 'quick' } });
  assert.deepEqual(ranked.map((r) => r.id).sort(), ['r2', 'r4']);
  assert.deepEqual(rankCandidates([row('n1', 'history', 'Partition'), row('n2', 'history', 'Rebels & the Raj')], { mode: { id: 'nta' } }).map((r) => r.id), ['n2']);
});

const fakeDb = { from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }) };

function practiceSource(rows) {
  return {
    loadFullPool: async () => rows,
    loadLightPool: async () => ({ rows, managedIds: new Set() }),
    loadFullRows: async (ids) => rows.filter((r) => ids.includes(r.id)),
    attachPassages: async (list) => list,
    readable: (list) => readablePracticeQuestions(list, fakeDb),
    recentIds: async () => new Set(),
    userProgress: async () => new Map(),
    weakConcepts: async () => new Set(),
  };
}

test('practice_pick (full and slim paths) never picks a retired or flagged row, and honours the saved option', async () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => row(`m${i}`, 'mathematics', 'Matrices', { concept_id: `m${i}`, family_id: `fm${i}` })),
    ...Array.from({ length: 6 }, (_, i) => row(`t${i}`, 'mathematics', 'Time Based Data', { concept_id: `t${i}`, family_id: `ft${i}` })),
    ...Array.from({ length: 6 }, (_, i) => row(`x${i}`, 'mathematics', 'Integrals', { concept_id: `x${i}`, family_id: `fx${i}`, is_cuet_syllabus: false })),
  ];
  const mode = { id: 'quick', difficulty: { easy: 0.3, medium: 0.4, hard: 0.3 }, maxPerConcept: 2 };
  for (const pick of [pickFromFullPool, pickFromLightPool]) {
    const all = await pick(practiceSource(rows), { mode, targetCount: 12, opts: {} });
    assert.ok(all.selected.length > 0);
    assert.ok(all.selected.every((r) => !r.id.startsWith('x')), `${pick.name}: flagged rows never picked`);
    const b1 = await pick(practiceSource(rows), { mode, targetCount: 12, opts: { syllabusOption: 'B1' } });
    assert.ok(b1.selected.length > 0 && b1.selected.every((r) => r.id.startsWith('m')), `${pick.name}: B1 draws no B2 chapter`);
    const b2 = await pick(practiceSource(rows), { mode, targetCount: 12, opts: { syllabusOption: 'B2' } });
    assert.ok(b2.selected.some((r) => r.id.startsWith('t')), `${pick.name}: B2 draws its own chapters`);
  }
});

test('readablePracticeQuestions (feed, inventory, Mob counts) drops retired and flagged rows', async () => {
  const out = await readablePracticeQuestions([
    row('q1', 'economics', 'Infrastructure'), row('q2', 'economics', 'Rural Development'), row('q3', 'economics', 'Employment', { is_cuet_syllabus: false }),
  ], fakeDb);
  assert.deepEqual(out.map((r) => r.id), ['q2']);
});

test('the NTA gate refuses retired chapters and is_cuet_syllabus=false rows', () => {
  const ok = qualityGateNtaQuestion(row('n1', 'physics', 'Atoms', { body: 'Which of these describes the Bohr model of the hydrogen atom best?' }), { subjectId: 'physics' });
  assert.ok(!ok.reasons.includes('chapter_retired') && !ok.reasons.includes('off_syllabus'));
  const retired = qualityGateNtaQuestion(row('n2', 'physics', 'Communication Systems', { body: 'Which modulation is used by FM broadcast radio stations?' }), { subjectId: 'physics' });
  assert.ok(retired.reasons.includes('chapter_retired'));
  const flagged = qualityGateNtaQuestion(row('n3', 'physics', 'Atoms', { body: 'Which of these describes the Bohr model of the hydrogen atom best?', is_cuet_syllabus: false }), { subjectId: 'physics' });
  assert.ok(flagged.reasons.includes('off_syllabus'));
});

test('a merge rename keeps evidence and score hashes taken under the old label, and nothing else', () => {
  const before = row('h1', 'computer_science', 'MySQL', { explanation: 'SELECT reads rows.' });
  const hash = contentHash(before);
  const after = { ...before, chapter: 'Structured Query Language' };
  assert.notEqual(contentHash(after), hash);
  assert.equal(contentHashMatches(after, hash), true);
  assert.equal(contentHashMatches({ ...after, explanation: 'changed' }, hash), false);
  assert.equal(contentHashMatches({ ...before, chapter: 'Computer Networks' }, hash), false);
  assert.equal(contentHashMatches(after, null), false);
});

test('chapter lists drop retired chapters and show an alias once, as its live chapter', () => {
  const rows = [{ id: 1, name: 'Solid State' }, { id: 2, name: 'Solutions' }, { id: 3, name: 'd and f Block Elements' }, { id: 4, name: 'd- and f-Block Elements' }];
  assert.deepEqual(liveChapterRows('chemistry', rows).map((r) => [r.id, r.name, r.title]), [[2, 'Solutions', 'Solutions'], [3, 'd- and f-Block Elements', 'The d- and f-Block Elements']]);
  assert.deepEqual(liveChapterRows('agriculture', [{ name: 'Horticulture' }]), [{ name: 'Horticulture' }]);
  const picker = chapterUnits({ chapters: [{ name: 'Partition' }, { name: 'Rebels & the Raj' }, { name: 'Kings & Chronicles' }] }, 'history');
  assert.deepEqual(picker.units.flatMap((u) => u.chapters.map((c) => c.name)), ['Rebels & the Raj']);
  assert.equal(picker.units[0].chapters[0].title, 'Rebels and the Raj: The Revolt of 1857 and its Representations');
  const cs = chapterUnits({ chapters: [{ name: 'Data Structures' }, { name: 'MySQL' }, { name: 'Structured Query Language' }] }, 'computer_science');
  assert.deepEqual(cs.units.flatMap((u) => u.chapters.map((c) => c.name)), ['Structured Query Language']);
});

test('the re-tag file passes its checker, which refuses anything but live targets', () => {
  const file = JSON.parse(readFileSync(new URL('../syllabus/retag-2026-10-31.json', import.meta.url), 'utf8'));
  assert.deepEqual(retagProblems(file), []);
  assert.deepEqual(retagProblems([]), []);
  assert.deepEqual(retagProblems([{ id: 'q1', subject: 'computer_science', from: 'Data Structures', to: 'Stack', why: 'stack push and pop' }]), []);
  assert.ok(retagProblems([{ id: 'q1', subject: 'computer_science', from: 'Data Structures', to: 'MySQL', why: 'x' }]).length, 'an alias is not a target');
  assert.ok(retagProblems([{ id: 'q1', subject: 'chemistry', from: 'Polymers', to: 'Solid State', why: 'x' }]).length, 'a retired chapter is not a target');
  assert.ok(retagProblems({}).length);
  assert.match(retagSql([{ id: "q'1", subject: 's', from: 'a', to: 'b', why: 'w' }]), /apply_syllabus_retag\('\[\{"id":"q''1"/);
});

test("L12: the 85 re-tagged questions keep the hashes taken under the re-tag's old chapter, so they come back to NTA papers", () => {
  const moves = JSON.parse(readFileSync(new URL('../syllabus/retag-2026-10-31.json', import.meta.url), 'utf8'));
  assert.equal(moves.length, 85);
  for (const move of moves) {
    const before = row(move.id, move.subject, move.from, { explanation: `Why ${move.why}.` });
    const hash = contentHash(before);
    const after = { ...before, chapter: move.to };
    assert.notEqual(contentHash(after), hash);
    assert.equal(contentHashMatch(after, hash), 'retag', move.id);
  }
  const move = moves.find((m) => m.subject === 'biology');
  const before = row(move.id, move.subject, move.from);
  const hash = contentHash(before);
  const after = { ...before, chapter: move.to };
  assert.equal(contentHashMatches({ ...after, id: 'not-re-tagged' }, hash), false, 'only the re-tagged ids');
  assert.equal(contentHashMatches({ ...after, chapter: 'Biodiversity & Conservation' }, hash), false, 'only in the re-tag target');
  assert.equal(contentHashMatches({ ...after, explanation: 'changed' }, hash), false, 'any other change still fails');
  assert.equal(contentHashMatches({ ...after, subject: 'chemistry' }, hash), false);
  // The fit gate passes the content check; the judges' type stays, their old chapter and unit no longer place it.
  const fitScores = new Map([[move.id, { subject: move.subject, table: {}, entry: { question_id: move.id, content_hash: hash, cuet_type: 'single_mcq', unit: 'Reproduction', chapter: move.from } }]]);
  assert.equal(ntaFitVerdict(after, { fitScores }).reasons.includes('fit_question_changed'), false);
  assert.deepEqual(ntaStoredFitTags(after, { fitScores }), { type: 'single_mcq', unit: null, chapter: null });
  assert.deepEqual(ntaStoredFitTags(before, { fitScores }), { type: 'single_mcq', unit: 'Reproduction', chapter: move.from }, 'unchanged before the re-tag');
});

// ---- Migration ------------------------------------------------------------------------------------------------

test('the saved migration and undo are the generator output', () => {
  assert.equal(readFileSync(new URL('../../supabase/migrations/20261031130000_syllabus_v2.sql', import.meta.url), 'utf8'), migrationSql());
  assert.equal(readFileSync(new URL('../../supabase/undo/20261031130000_syllabus_v2.undo.sql', import.meta.url), 'utf8'), undoSql());
});

test('PGlite: migration, re-tag hook and undo round-trip', async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create table public.questions (id text primary key, subject text not null, chapter text not null, is_cuet_syllabus boolean);
    create table public.chapters (id text primary key, subject_id text not null, name text not null, sort_order int not null default 0, created_at timestamptz not null default now(), unit_id text, unique (subject_id, name));
    create table public.units (id text primary key, subject_id text not null, name text not null, sort_order int not null default 0, created_at timestamptz not null default now(), unique (subject_id, name));
    insert into public.units values ('chemistry__u1', 'chemistry', 'Solutions', 0), ('chemistry__u11', 'chemistry', 'Existing Chemistry Coverage', 10), ('computer_science__u1', 'computer_science', 'Section A: Database and Networks', 0);
    insert into public.chapters (id, subject_id, name, sort_order, unit_id) values
      ('chemistry__solutions', 'chemistry', 'Solutions', 0, 'chemistry__u1'),
      ('chemistry__solid_state', 'chemistry', 'Solid State', 1000, 'chemistry__u11'),
      ('computer_science__mysql', 'computer_science', 'MySQL', 1, 'computer_science__u1'),
      ('computer_science__structured_query_language', 'computer_science', 'Structured Query Language', 2, 'computer_science__u1'),
      ('computer_science__data_structures', 'computer_science', 'Data Structures', 104, null);
    insert into public.questions values
      ('q1', 'chemistry', 'Solid State', null), ('q2', 'chemistry', 'Solutions', true), ('q3', 'computer_science', 'MySQL', true),
      ('q4', 'computer_science', 'Data Structures', null), ('q5', 'economics', 'Infrastructure', true), ('q6', 'agriculture', 'Horticulture', null);
  `);
  const snapshot = async () => (await db.query('select id, chapter, is_cuet_syllabus from public.questions order by id')).rows;
  const original = await snapshot();
  await db.exec(migrationSql());

  const q = Object.fromEntries((await snapshot()).map((r) => [r.id, r]));
  assert.equal(q.q1.is_cuet_syllabus, false);
  assert.equal(q.q1.chapter, 'Solid State', 'retired rows keep their chapter');
  assert.equal(q.q5.is_cuet_syllabus, false);
  assert.equal(q.q2.is_cuet_syllabus, true);
  assert.equal(q.q3.chapter, 'Structured Query Language', 'section 5 merge renamed');
  assert.equal(q.q4.chapter, 'Data Structures', 'a split waits for the re-tag');
  assert.equal(q.q6.chapter, 'Horticulture');
  const changes = (await db.query('select question_id, kind from public.syllabus_v2_changes order by id')).rows;
  assert.deepEqual(changes.map((c) => `${c.question_id}:${c.kind}`).sort(), ['q1:retire', 'q3:merge', 'q5:retire']);

  const chapters = Object.fromEntries((await db.query('select c.id, c.name, c.retired_reason, c.chapter_key, c.title, c.section, u.name as unit from public.chapters c left join public.units u on u.id = c.unit_id')).rows.map((r) => [r.id, r]));
  assert.equal(chapters.chemistry__solutions.chapter_key, 'chemistry.solutions');
  assert.equal(chapters.chemistry__solutions.unit, 'Solutions');
  assert.equal(chapters.chemistry__solid_state.retired_reason, 'not_in_cuet_2026');
  assert.equal(chapters.chemistry__solid_state.unit, null);
  assert.equal(chapters.computer_science__mysql.retired_reason, 'merged');
  assert.equal(chapters.computer_science__data_structures.retired_reason, 'split_pending_retag');
  const sql = chapters.computer_science__structured_query_language;
  assert.deepEqual([sql.chapter_key, sql.title, sql.section, sql.unit], ['computer_science.structured-query-language', 'Structured Query Language (SQL)', 'A', 'Section A']);
  const liveCount = (await db.query('select count(*)::int as n from public.chapters where chapter_key is not null')).rows[0].n;
  assert.equal(liveCount, CHAPTERS.length, 'every live chapter has its row and key');

  // The re-tag hook: moves only from the stated chapter into a live chapter; a retired row gets its old flag back.
  const moved = (await db.query(`select public.apply_syllabus_retag($1::jsonb) as n`, [JSON.stringify([
    { id: 'q4', subject: 'computer_science', from: 'Data Structures', to: 'Stack' },
    { id: 'q5', subject: 'economics', from: 'Infrastructure', to: 'Indian Economy on the Eve of Independence' },
    { id: 'q2', subject: 'chemistry', from: 'Electrochemistry', to: 'Solutions' },
    { id: 'q1', subject: 'chemistry', from: 'Solid State', to: 'Polymers' },
  ])])).rows[0].n;
  assert.equal(moved, 2);
  const after = Object.fromEntries((await snapshot()).map((r) => [r.id, r]));
  assert.deepEqual([after.q4.chapter, after.q5.chapter, after.q5.is_cuet_syllabus], ['Stack', 'Indian Economy on the Eve of Independence', true]);
  assert.equal(after.q1.chapter, 'Solid State');

  await db.exec(undoSql());
  assert.deepEqual(await snapshot(), original);
  const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'chapters' order by column_name`)).rows.map((r) => r.column_name);
  assert.deepEqual(cols, ['created_at', 'id', 'name', 'sort_order', 'subject_id', 'unit_id']);
  assert.deepEqual((await db.query('select id, unit_id from public.chapters order by id')).rows, [
    { id: 'chemistry__solid_state', unit_id: 'chemistry__u11' }, { id: 'chemistry__solutions', unit_id: 'chemistry__u1' },
    { id: 'computer_science__data_structures', unit_id: null }, { id: 'computer_science__mysql', unit_id: 'computer_science__u1' },
    { id: 'computer_science__structured_query_language', unit_id: 'computer_science__u1' },
  ]);
  assert.deepEqual((await db.query('select id, sort_order from public.units order by id')).rows, [
    { id: 'chemistry__u1', sort_order: 0 }, { id: 'chemistry__u11', sort_order: 10 }, { id: 'computer_science__u1', sort_order: 0 },
  ]);
  await db.close();
});
