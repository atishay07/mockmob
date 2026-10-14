import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptionComparable as key } from '../option_compare.js';
import { verifyAnswerIntegrity } from '../answer_integrity.js';
import { qualityGateNtaQuestion } from '../nta_question_selector.js';

const same = (a, b) => assert.equal(key(a), key(b), `${a} and ${b} should be the same option`);
const differ = (a, b) => assert.notEqual(key(a), key(b), `${a} and ${b} should be different options`);

function mathRow(options, over = {}) {
  return {
    id: 'm1', subject: 'mathematics', chapter: 'Integrals', body: 'Evaluate the definite integral given in the question stem.',
    options: options.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: 'A',
    explanation: 'Worked through by the standard method, which gives the first option.', difficulty: 'medium', ...over,
  };
}

test('maths options that differ only in a symbol are different options', () => {
  differ('(e + 1)/2', '(e − 1)/2');
  differ('π/4', '4');
  differ('3π/4', 'π/4');
  differ('−π/4', 'π/4');
  differ('1/3', '−1/3');
  differ('x + 2y − 2 = 0', '2x + y − 2 = 0');
  differ('d²y/dx² + 4y = 0', 'd²y/dx² − 4y = 0');
  differ('√83', '83/2');
  differ('√83/2', '√83');
  differ('y = 3e^(x²)', 'y = 3e^(−x²)');
  differ('−eˣ/x + C', 'eˣ/x + C');
  differ('(1, 3)', '[1, 3]');
  differ('(1, 3)', '(−1, 3)');
  differ('≤ 3', '≥ 3');
  differ('α', 'β');
  differ('ENAME LIKE \'S%\'', 'ENAME LIKE \'%S\'');
  differ('ENAME LIKE \'S%\'', 'ENAME LIKE \'S_\'');
  differ('2³', '2²');
  differ('x₁', 'x₂');
  differ('0.5', '5');
  differ('∫x dx', 'x dx');
});

test('unicode minus and hyphen are alike; spacing and multiplication or division sign variants do not matter', () => {
  same('(e - 1)/2', '(e − 1)/2');
  same('x-y', 'x − y');
  same('-5', '−5');
  same('x  +  y', 'x+y');
  same('2×3', '2 * 3');
  same('6 ÷ 3', '6/3');
  same('e²', 'e^2');
  same('x ≤ 3', 'x <= 3');
  same('x≠ 3', 'x != 3');
  same('y = 3e^(x²)', 'y = 3e^(x^2)');
});

test('textual near-duplicates are still the same option: spacing, case, trailing punctuation, articles, hyphens', () => {
  same('The Golgi apparatus', 'golgi  apparatus.');
  same('An enzyme', 'the enzyme');
  same('Paris, France.', 'paris france');
  same('Co-ordinate bond', 'co ordinate bond');
  same('Rule of law!', 'rule of law');
  same('Profit & loss', 'profit and loss');
  same('Net   profit ratio ;', 'net profit ratio');
});

test('articles are not dropped where they carry meaning', () => {
  differ('a', 'the');
  differ('an', 'the');
  differ('Vitamin A', 'Vitamin');
  differ('Vitamin A', 'Vitamin B');
  differ('Hepatitis A', 'Hepatitis B');
});

test('answer guard: the wave-2 maths shapes no longer read as invalid or duplicate', () => {
  const sets = [
    ['(e + 1)/2', 'e − 1', '2(e − 1)', '(e − 1)/2'],
    ['3π/4', 'π/4', '−π/4', 'π/2'],
    ['1', '2/π', 'π/2', '0'],
    ['√83', '83/2', '√83/2', '√77/2'],
    ['1/3', '−1/3', '5/9', '1/9'],
    ['(1, 3)', '(−∞, 3)', '(−∞, 1) ∪ (3, ∞)', '(3, ∞)'],
    ['(1/2) ln|(x + 1)/(x − 1)| + C', '(1/2) ln|(x − 1)/(x + 1)| + C', 'ln|x² − 1| + C', '(1/2) ln|x² − 1| + C'],
    ['x + 2y − 2 = 0', '2x − y − 2 = 0', '2x + y − 2 = 0', '2x + y + 2 = 0'],
    ['SELECT Ename FROM EMP WHERE Ename LIKE \'%R\';', 'SELECT Ename FROM EMP WHERE Ename LIKE \'R%\';', 'SELECT Ename FROM EMP WHERE Ename LIKE \'R_\';', 'SELECT Ename FROM EMP WHERE Ename = \'R%\';'],
  ];
  for (const options of sets) {
    const result = verifyAnswerIntegrity(mathRow(options));
    assert.equal(result.reasons.includes('answer_guard_options_invalid'), false, `${options.join(' | ')} -> ${result.reasons}`);
    assert.equal(result.reasons.includes('answer_guard_near_duplicate_options'), false, `${options.join(' | ')} -> ${result.reasons}`);
    const gate = qualityGateNtaQuestion(mathRow(options), { subjectId: 'mathematics' });
    assert.equal(gate.reasons.includes('options_invalid'), false, `${options.join(' | ')} -> ${gate.reasons}`);
  }
});

test('answer guard: true duplicates, single-letter and placeholder options are still refused', () => {
  const cases = [
    [['The cell wall', 'cell wall.', 'Plasma membrane', 'Nucleus'], 'answer_guard_options_invalid'],
    [['Net  profit', 'net profit', 'Gross profit', 'Operating profit'], 'answer_guard_options_invalid'],
    [['(e − 1)/2', '(e - 1)/2', 'e', '1'], 'answer_guard_options_invalid'],
    [['A', 'B', 'C', 'D'], 'answer_guard_options_invalid'],
    [['a', 'the', 'an', 'no article is needed'], 'answer_guard_options_invalid'],
    [['Option A', 'Option B', 'Option C', 'Option D'], 'answer_guard_options_invalid'],
  ];
  for (const [options, reason] of cases) {
    const result = verifyAnswerIntegrity(mathRow(options));
    assert.ok(result.reasons.includes(reason), `${options.join(' | ')} -> ${result.reasons}`);
    const gate = qualityGateNtaQuestion(mathRow(options), { subjectId: 'mathematics' });
    assert.ok(gate.reasons.includes('options_invalid'), `${options.join(' | ')} -> ${gate.reasons}`);
  }
});

test('answer guard: a long prose near-duplicate that differs only by an article is still caught', () => {
  const options = ['The mitochondria is the site of aerobic respiration', 'Mitochondria is the site of aerobic respiration', 'Ribosomes synthesise proteins', 'Lysosomes digest waste'];
  const result = verifyAnswerIntegrity(mathRow(options, { subject: 'biology' }));
  assert.ok(result.reasons.includes('answer_guard_near_duplicate_options') || result.reasons.includes('answer_guard_options_invalid'), result.reasons.join(','));
});
