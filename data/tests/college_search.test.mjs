// Run: node --test data/tests/college_search.test.mjs
// The website's college and programme search matcher; mirrors the app's college_search_test.dart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { duCompact, duMatches, duNormalise, duQueryTokens, duSearch } from '../../src/lib/du/collegeSearch.mjs';

const programmes = [
  ['B.A. (Hons.) Applied Psychology', 20],
  ['B.A. (Hons.) Business Economics', 10],
  ['B.A. (Hons.) Economics', 40],
  ['B.A. (Hons.) English', 48],
  ['B.A. (Hons.) Political Science', 50],
  ['B.A. (Programme)', 54],
  ['B.Com.', 44],
  ['B.Com. (Hons.)', 55],
  ['B.Sc. (Hons.) Home Science', 3],
  ['B.Sc. (Prog.) Life Science', 2],
  ['Bachelor of Business Administration (Financial Investment Analysis) BBA (FIA)', 1],
  ['Bachelor of Management Studies (BMS)', 6],
];
const find = (q) => duSearch(q, programmes, (p) => p[0], { weight: (p) => p[1] }).map((p) => p[0]);

test('every way of typing B.Com finds B.Com. (Hons.) first and B.Com. second', () => {
  for (const q of ['bcom', 'BCOM', 'b.com', 'B Com', 'b com', 'B.Com', 'b-com', 'Bcom']) {
    assert.deepEqual(find(q).slice(0, 2), ['B.Com. (Hons.)', 'B.Com.'], q);
  }
});

test('the honours spellings find B.Com. (Hons.) first', () => {
  for (const q of ['bcom hons', 'B.Com (H)', 'bcom honours', 'b com (hons)', 'BCOM HONS', 'bcom h', 'B.Com (Hons)', 'B.Com (Hons.)']) {
    assert.equal(find(q)[0], 'B.Com. (Hons.)', q);
  }
});

test('eco and econ find both Economics programmes, not B.Com', () => {
  for (const q of ['eco', 'econ', 'Econs']) {
    const r = find(q);
    assert.ok(r.includes('B.A. (Hons.) Economics') && r.includes('B.A. (Hons.) Business Economics'), q);
    assert.ok(!r.includes('B.Com. (Hons.)'), q);
  }
});

test('ba prog, ba hons and bsc prog find the right programmes', () => {
  assert.equal(find('ba prog')[0], 'B.A. (Programme)');
  assert.equal(find('b.a. programme')[0], 'B.A. (Programme)');
  assert.ok(find('bsc prog').includes('B.Sc. (Prog.) Life Science'));
  assert.ok(find('ba hons eco').includes('B.A. (Hons.) Economics'));
  assert.ok(!find('ba hons eco').includes('B.Com. (Hons.)'));
});

test('exact prefix ranks before a looser match', () => {
  const r = find('b.a. (hons) econ');
  assert.equal(r[0], 'B.A. (Hons.) Economics');
  assert.ok(r.indexOf('B.A. (Hons.) Business Economics') > 0);
  assert.equal(find('bba')[0], 'Bachelor of Business Administration (Financial Investment Analysis) BBA (FIA)');
});

test('pol sci finds Political Science; bms finds BMS', () => {
  assert.equal(find('pol sci')[0], 'B.A. (Hons.) Political Science');
  assert.equal(find('bms')[0], 'Bachelor of Management Studies (BMS)');
});

test('nonsense finds nothing; an empty query keeps the caller order', () => {
  assert.deepEqual(find('zzz'), []);
  assert.deepEqual(find('  '), programmes.map((p) => p[0]));
});

const colleges = [
  'Hansraj College', 'Hindu College', 'Kirori Mal College', 'Lady Shri Ram College for Women',
  'Shri Ram College of Commerce', 'Sri Venkateswara College',
];
const college = (q) => duSearch(q, colleges, (c) => c);

test('Hansraj by name, spaced and with a slip', () => {
  for (const q of ['hansraj', 'hans raj', 'hansrj', 'Hansraj', 'hnasraj']) assert.equal(college(q)[0], 'Hansraj College', q);
});

test('short names find their college', () => {
  assert.equal(college('srcc')[0], 'Shri Ram College of Commerce');
  assert.equal(college('lsr')[0], 'Lady Shri Ram College for Women');
  assert.equal(college('kmc')[0], 'Kirori Mal College');
  assert.equal(college('svc')[0], 'Sri Venkateswara College');
});

test('extra names and duMatches', () => {
  const rows = [['Hindu College', 'B.Com. (Hons.)']];
  assert.equal(duSearch('bcom', rows, (r) => r[0], { extra: (r) => [r[1]] }).length, 1);
  assert.equal(duMatches('b.com', 'Hindu College', ['B.Com. (Hons.)']), true);
  assert.equal(duMatches('zzz', 'Hindu College'), false);
});

test('normalising', () => {
  assert.equal(duNormalise('B.Com. (Hons.)'), 'b com hons');
  assert.equal(duCompact('B.Com. (Hons.)'), 'bcomhons');
  assert.equal(duNormalise('Commerce & Economics'), 'commerce and economics');
  assert.deepEqual(duQueryTokens('bcom honours'), ['b', 'com', 'hons']);
});

test('the real DU programme list: every B.Com spelling leads with B.Com.', () => {
  const idx = JSON.parse(readFileSync(new URL('../../public/du/2026/index.json', import.meta.url), 'utf8'));
  const top = (q) => duSearch(q, idx.groups, (g) => g.name, { weight: (g) => g.colleges }).map((g) => g.name);
  for (const q of ['BCOM', 'b.com', 'b com']) assert.deepEqual(top(q).slice(0, 2), ['B.Com. (Hons.)', 'B.Com.'], q);
  for (const q of ['bcom hons', 'B.Com (Hons)', 'b com (hons.)']) assert.equal(top(q)[0], 'B.Com. (Hons.)', q);
  const eco = duSearch('eco', idx.groups, (g) => g.name).map((g) => g.name);
  assert.ok(eco.includes('B.A. (Hons.) Economics'));
});
