// S3 (security audit 15 Nov 2026): the Mob display-name filter reads a name the way it looks (NFKC, look-alike letters,
// zero-width characters, stretched spellings) and knows the common Hindi profanities in Devanagari and in Latin, while
// ordinary Indian names that contain a blocked piece stay allowed. Pure functions only.
// Run: node --test data/tests/mob_names_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkName, nameBlocked, nameForMatch } from '../../src/lib/mob/model.mjs';
import { mobNameBlocklist } from '../../src/lib/mob/nameTerms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const json = JSON.parse(readFileSync(resolve(root, 'data/mob_name_blocklist.json'), 'utf8'));
const list = mobNameBlocklist(json);

test('S3 Devanagari profanity is refused (the audit\'s names first)', () => {
  for (const bad of ['चूतिया', 'रंडी', 'भोसड़ी', 'भोसडी', 'मादरचोद', 'बहनचोद', 'हरामी', 'कमीना', 'भड़वा', 'गांडू', 'गाँडू', 'लौड़ा', 'चूत', 'कुत्ता', 'राम चूतिया']) {
    assert.equal(checkName(bad, list).code, 'NAME_REFUSED', bad);
  }
});

test('S3 Latin profanity: transliterations, stretched spellings, look-alikes, styled letters, zero-width characters', () => {
  for (const bad of ['Lavde', 'Lawde', 'Chutiye', 'Bhosdike', 'Fuuck', 'Fuuuuck', 'Chuuutiya', 'Kuttaaa', 'Asss', 'Harami', 'Haraami', 'Kutta', 'Shit', 'Shitty', 'Bullshit',
    'Ѕех', 'Аdmin', 'Мobi', 'Fυck', 'ｆｕｃｋ', 'Fück', 'Gaand', 'Kamine']) {
    assert.equal(checkName(bad, list).code, 'NAME_REFUSED', bad);
  }
  // Zero-width characters never reach a stored name (NAME_INVALID), and the matcher strips them anyway.
  assert.equal(checkName('Fu​ck', list).code, 'NAME_INVALID');
  assert.equal(nameBlocked('Fu​ck', list), true);
  assert.equal(nameForMatch('Ѕех'), 'sex');
  assert.equal(nameForMatch('भोसड़ी'), nameForMatch('भोसडी'), 'nukta or not, the same word');
});

test('S3 ordinary names stay allowed, including ones with a blocked piece inside', () => {
  for (const ok of ['Shital', 'Kshitij', 'Shitanshu', 'Haramohan', 'Kuttan', 'Kuttiyamma', 'Kamini', 'Nigam', 'Fagun', 'Ashish', 'Bassi', 'Asif', 'Gandhali',
    'Randip', 'Rapeti Sai', 'Mobina', 'Dickson', 'Hitesh', 'Anna', 'Abbas', 'Riya', 'Aas Mohammad', 'Gandhi', 'Saasha',
    'अनन्या', 'शीतल', 'हरमोहन', 'कुट्टन', 'गांधी', 'रणधीर', 'कामिनी', 'Саша']) {
    assert.equal(checkName(ok, list).ok, true, ok);
  }
});

test('S3 the merge keeps every JSON term and moves only "shit" to whole words', () => {
  for (const t of json.contains.filter((x) => x !== 'shit')) assert.ok(list.contains.includes(t), t);
  for (const t of json.words) assert.ok(list.words.includes(t), t);
  assert.equal(list.contains.includes('shit'), false);
  assert.ok(list.words.includes('shit'));
  // The JSON list alone (as before) still refuses what it refused.
  for (const refused of ['MockMob Team', 'Admin', 'Mobi', 'Randi', 'Bhenchod', 'Official Riya', 'Mod Erator']) assert.equal(nameBlocked(refused, json), true, refused);
});
