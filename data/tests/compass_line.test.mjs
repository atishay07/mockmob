// The Admission Compass line on Today: the count is the same one the Compass page shows, which subjects
// count follows the page's own priority, and the nearest college carries DU's published Round 1 cutoff.
// Run: node --test data/tests/compass_line.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateAll } from '../../src/lib/du/eligibility.js';
import { decodeSelection } from '../../src/lib/du/client.js';
import {
  compassState, countLine, cutoffLine, roundOneCutoff, startingList, toDuId, NO_SUBJECTS_LINE,
} from '../../src/lib/du/compassLine.mjs';

const root = path.resolve(import.meta.dirname, '../../public/du/2026');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'rules.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const offerings = (id) => JSON.parse(fs.readFileSync(path.join(root, 'offerings', `${id}.json`), 'utf8'));

const COMMERCE = ['english', 'accountancy', 'business_studies', 'economics'];
const countFor = (csv, data = rules) => evaluateAll(data.groups, decodeSelection(csv, data)).filter((r) => r.eligible).length;
const oneDecimal = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

test('the count is the eligibility engine over all 73 programmes', () => {
  const s = compassState({ rules, profile: COMMERCE });
  assert.equal(s.status, 'ready');
  assert.equal(s.total, 73);
  assert.equal(s.open, countFor(COMMERCE.join(',')));
  assert.ok(s.open > 0 && s.open < 73);
  assert.equal(countLine(s.open, s.total), `${s.open} of 73 DU programmes open to your subjects`);
});

test('rules.json and index.json give the same count (Today uses whichever is cached)', () => {
  assert.equal(compassState({ rules, profile: COMMERCE }).open, compassState({ rules: index, profile: COMMERCE }).open);
});

test('more subjects never open fewer programmes', () => {
  const some = compassState({ rules, profile: ['english', 'accountancy'] }).open;
  const more = compassState({ rules, profile: COMMERCE }).open;
  const most = compassState({ rules, profile: [...COMMERCE, 'mathematics', 'general_test'] }).open;
  assert.ok(some <= more && more <= most);
});

test('the aptitude test maps to the DU id, and an id DU does not list is ignored', () => {
  assert.equal(toDuId('general_test'), 'gat');
  assert.equal(toDuId('physics'), 'physics');
  const base = compassState({ rules, profile: COMMERCE }).open;
  assert.equal(compassState({ rules, profile: [...COMMERCE, 'teaching_aptitude'] }).open, base);
  assert.equal(compassState({ rules, profile: [...COMMERCE, 'general_test'] }).open, countFor([...COMMERCE, 'gat'].join(',')));
});

test('a student with no subjects is asked for them, not shown zero', () => {
  for (const profile of [[], undefined, null, ['teaching_aptitude']]) {
    assert.deepEqual(compassState({ rules, profile }), { status: 'no-subjects' });
  }
  assert.match(NO_SUBJECTS_LINE, /subjects/);
});

test('data that has not loaded is unavailable, never a number', () => {
  assert.equal(compassState({ rules: null, profile: COMMERCE }).status, 'unavailable');
  assert.equal(compassState({ rules: { groups: [] }, profile: COMMERCE }).status, 'unavailable');
});

test('a selection kept on this device wins over the profile, as on the Compass page', () => {
  assert.equal(startingList({ saved: { s: 'english,physics' }, profile: COMMERCE }), 'english,physics');
  assert.equal(startingList({ saved: { s: '' }, profile: COMMERCE }), COMMERCE.join(','));
  assert.equal(startingList({ saved: null, profile: ['general_test', 'english'] }), 'gat,english');
  const s = compassState({ rules, saved: { s: 'english,physics,chemistry,mathematics', c: 'OBC-NCL' }, profile: COMMERCE });
  assert.equal(s.open, countFor('english,physics,chemistry,mathematics'));
  assert.equal(s.category, 'OBC-NCL');
  assert.equal(compassState({ rules, profile: COMMERCE }).category, 'UR');
});

test('the nearest college carries its published 2026 Round 1 cutoff', () => {
  const com = offerings('b-com-hons');
  const srcc = com.rows.find((r) => r[0] === 'Shri Ram College of Commerce');
  const entry = { programmeId: 'b-com-hons', programme: 'B.Com. (Hons.)', college: 'Shri Ram College of Commerce' };
  const ur = roundOneCutoff(com, entry, 'UR');
  assert.deepEqual(ur, { cutoff: srcc[2][0], category: 'UR' });
  assert.equal(cutoffLine(ur), `2026 Round 1 cutoff ${oneDecimal(srcc[2][0])} for UR`);
  // A reserved category clears on the lower of its own cutoff and UR, the Compass rule.
  const sc = roundOneCutoff(com, entry, 'SC');
  assert.equal(sc.category, 'SC');
  assert.equal(sc.cutoff, Math.min(srcc[2][0], srcc[2][2]));
  // An unknown category falls back to Unreserved.
  assert.deepEqual(roundOneCutoff(com, entry, 'MADE-UP'), ur);
});

test('a college with no row or no Round 1 cutoff gives none, never a made-up number', () => {
  const com = offerings('b-com-hons');
  assert.equal(roundOneCutoff(com, { college: 'Not a DU college', programme: 'B.Com. (Hons.)' }, 'UR'), null);
  assert.equal(roundOneCutoff(null, { college: 'Shri Ram College of Commerce' }, 'UR'), null);
  const bare = { categories: ['UR'], rows: [['Some College', 'Some Programme', null, null, null]] };
  assert.equal(roundOneCutoff(bare, { college: 'Some College', programme: 'Some Programme' }, 'UR'), null);
});

test('with several rows for one college, the entry programme wins', () => {
  const data = {
    categories: ['UR'],
    rows: [['Hindu College', 'B.A. Programme (History + Pol. Sci.)', [610], null, null], ['Hindu College', 'B.A. Programme (Economics + Maths)', [700], null, null]],
  };
  assert.equal(roundOneCutoff(data, { college: 'Hindu College', programme: 'B.A. Programme (Economics + Maths)' }, 'UR').cutoff, 700);
  assert.equal(roundOneCutoff(data, { college: 'Hindu College', programme: 'unlisted' }, 'UR').cutoff, 610);
});
