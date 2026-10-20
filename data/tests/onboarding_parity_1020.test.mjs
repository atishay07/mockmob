// Web onboarding parity with the app's version 13 (20 Oct): the five-subject cap with a clear reason and a swap, the course search with
// the subjects the course takes, the subject search with the papers not offered listed, and the name card that never shows an
// email prefix. Pure rules, then the page wiring, then the copy rules. Run: node --test data/tests/onboarding_parity_1020.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { courseFit, courseRuleSentence, joinWords, neededByEvery, selectionFromSubjects, subjectWord } from '../../src/lib/du/courseRule.mjs';
import { courseChoices, courseLine, offeredCourses } from '../../src/app/onboarding/courseChoice.mjs';
import { COMMON_SETS, SETS_LABEL, applySet, setMatches, setsFor } from '../../src/app/onboarding/commonSets.mjs';
import { capCopy, notYetSubjects, pickableSubjects, shortSubjectName, subjectMatches, swapLast } from '../../src/app/onboarding/subjectPick.mjs';
import { NAME_ASK, NAME_MAX, checkName, nameFieldValue, shouldAskName } from '../../src/lib/nameAsk.mjs';
import { shownFirstName, shownName } from '../../src/lib/displayName.mjs';
import { duSearch } from '../../src/lib/du/collegeSearch.mjs';
import { CUET_MAX_SUBJECTS } from '../../src/lib/cuetRules.mjs';
import { SUBJECTS } from '../../data/subjects.js';
import { toPublicSubjectId } from '../../data/cuet_controls.js';
import { resolveSubject } from '../../data/subject_registry.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const rules = JSON.parse(read('public/du/2026/index.json'));
const group = (id) => rules.groups.find((g) => g.id === id);
// What /api/subjects sends the page: every catalogue row with its public id and the registry's practice state.
const catalogue = SUBJECTS.map((s) => {
  const id = toPublicSubjectId(s.id);
  const r = resolveSubject(id);
  return { ...s, id, internalId: s.id, officialCode: r.code, officialName: r.officialName, practice: r.renamedFrom ? 'merged' : r.practice };
});

// ---- the five-subject cap: the reason and the swap ----------------------------------------------------------------------------
test('cap: the reason names the rule, the paper asked for and the pick that would make room', () => {
  assert.equal(CUET_MAX_SUBJECTS, 5);
  const copy = capCopy({ wantedName: 'Physics', lastName: 'Economics' });
  assert.equal(copy.title, 'Five is the most CUET allows');
  assert.match(copy.body, /CUET UG 2026 lets you take five papers in all/);
  assert.match(copy.body, /a language or the General Test counts as one/);
  assert.match(copy.body, /To add Physics, take one out first\./);
  assert.equal(copy.swap, 'Swap Economics for Physics');
  assert.equal(copy.keep, 'Keep my five');
});

test('cap: a swap makes the latest pick give way to the one asked for, and nothing else moves', () => {
  const five = ['english', 'accountancy', 'economics', 'business_studies', 'history'];
  assert.deepEqual(swapLast(five, 'physics'), ['english', 'accountancy', 'economics', 'business_studies', 'physics']);
  assert.deepEqual(five, ['english', 'accountancy', 'economics', 'business_studies', 'history'], 'the input is never changed');
  assert.deepEqual(swapLast(five, 'english'), five, 'a subject already picked is not swapped in again');
  assert.deepEqual(swapLast([], 'physics'), []);
  assert.deepEqual(swapLast(five, ''), five);
  assert.equal(swapLast(five, 'physics').length, CUET_MAX_SUBJECTS);
  assert.equal(shortSubjectName({ name: 'Mathematics / Applied Mathematics' }), 'Mathematics');
  assert.equal(shortSubjectName({ id: 'gat', name: 'General Test' }), 'General Test');
});

test('cap: the page answers the sixth pick with the note in the bar, a swap key and a way to keep the five', () => {
  const page = read('src/app/onboarding/OnboardingPageClient.jsx');
  const css = read('src/app/onboarding/onboarding.css');
  assert.match(page, /setCapAsk\(id\);/, 'the sixth pick remembers which subject was asked for');
  assert.match(page, /const swapForCap = \(\) =>/);
  assert.match(page, /setSelected\(swapLast\(selected, capAsk\)\);/);
  assert.match(page, /className="ob-capnote" role="status"/);
  assert.match(page, /onClick=\{swapForCap\}/);
  assert.match(page, /onClick=\{\(\) => setCapAsk\(null\)\}>\{cap\.keep\}/);
  assert.ok(page.indexOf('className="ob-capnote"') > page.indexOf('<footer className="ob-bar">'), 'the reason sits in the fixed bar, beside the Next key');
  assert.match(css, /\.ob-capnote \{/);
  assert.match(css, /\.ob\[data-cap\] \.ob-main \{ padding-bottom:/, 'the list keeps room for the taller bar');
  // A removal or any other pick puts the note away.
  assert.equal((page.match(/setCapAsk\(null\)/g) || []).length >= 4, true);
});

// ---- subject search and the papers not offered ---------------------------------------------------------------------------------
test('subject search: a student finds a subject by the name they know it by, and by its CUET code', () => {
  const find = (q) => pickableSubjects(catalogue, q).map((s) => s.id);
  assert.ok(find('maths').includes('mathematics'));
  assert.ok(find('math').includes('mathematics'));
  assert.ok(find('bio').includes('biology'));
  assert.ok(find('cs').includes('computer_science'));
  assert.ok(find('bst').includes('business_studies'));
  assert.ok(find('political').includes('political_science'));
  assert.ok(find('309').includes('economics'), 'by CUET code');
  assert.deepEqual(find('zzzz'), []);
  assert.deepEqual(find('  '), pickableSubjects(catalogue).map((s) => s.id), 'an empty search keeps the whole list, in the catalogue order');
  assert.equal(subjectMatches({ name: 'Business Studies' }, 'busi stud'), true);
  assert.equal(subjectMatches({ name: 'Business Studies' }, 'studies busi'), true);
});

test('not offered: the CUET papers MockMob cannot practise are listed, split into languages and other papers, never hidden', () => {
  const all = notYetSubjects(catalogue);
  assert.ok(all.total >= 20, `the registry lists the unsupported papers (${all.total})`);
  const names = [...all.languages, ...all.papers].map((x) => x.name);
  for (const expected of ['Hindi', 'Tamil', 'Sanskrit', 'Agriculture', 'Anthropology']) assert.ok(names.some((n) => n.startsWith(expected)), expected);
  assert.ok(all.languages.every((x) => x.language) && all.papers.every((x) => !x.language));
  assert.ok(all.languages.some((x) => x.name === 'Hindi') && !all.papers.some((x) => x.name === 'Hindi'));
  assert.deepEqual(all.papers.map((x) => x.name), [...all.papers.map((x) => x.name)].sort((a, b) => a.localeCompare(b)));
  const none = new Set(pickableSubjects(catalogue).map((s) => s.id));
  for (const x of [...all.languages, ...all.papers]) assert.ok(!none.has(x.id), `${x.id} is not pickable`);
  assert.equal(notYetSubjects(catalogue, 'tamil').total, 1);
  assert.equal(notYetSubjects(catalogue, 'physics').total, 0, 'a subject MockMob offers is not in the not-yet list');
  assert.deepEqual(notYetSubjects(undefined), { languages: [], papers: [], total: 0 });
  // Retired papers (Legal Studies and the rest) and merged rows are not listed as options at all.
  assert.ok(!names.some((n) => /legal|teaching|entrepreneur|engineering graphics/i.test(n)));
});

// ---- the course search and the subjects a course takes -------------------------------------------------------------------------
test('course search: the six courses lead before anything is typed, then every course DU offers in a college is found', () => {
  const quick = courseChoices(rules, '', duSearch);
  assert.deepEqual(quick.map((g) => g.id), ['b-com-hons', 'b-com', 'b-a-hons-economics', 'bachelor-of-management-studies-bms', 'b-a-hons-business-economics', 'b-a-programme']);
  const find = (q) => courseChoices(rules, q, duSearch).map((g) => g.id);
  assert.equal(find('bcom')[0] === 'b-com' || find('bcom')[0] === 'b-com-hons', true);
  assert.ok(find('economics').includes('b-a-hons-economics'));
  assert.ok(find('bms').includes('bachelor-of-management-studies-bms'));
  assert.ok(find('physics').includes('b-sc-hons-physics'));
  assert.ok(find('polsci').includes('b-a-hons-political-science'));
  assert.deepEqual(find('qqqqqq'), []);
  assert.ok(find('b').length <= 8, 'a typed search shows at most eight');
  // A group with no Round 1 seats is never offered (the colleges step would have nothing to list).
  const offered = new Set(offeredCourses(rules).map((g) => g.id));
  assert.ok(!offered.has('b-a-hons-hindustani-music-percussion-tabla-pakhawaj'));
  assert.equal(courseChoices(null, 'bcom', duSearch).length, 0);
  assert.equal(courseLine(group('b-com-hons')), 'Commerce and Economics, 55 colleges');
  assert.equal(courseLine(null), '');
});

test('course rule: said in plain words from the Bulletin combinations, one full stop, no hype', () => {
  assert.equal(courseRuleSentence(group('b-com-hons'), rules), 'B.Com. (Hons.) needs a language, plus either Mathematics and any two other subjects, or Accountancy and any two other subjects.');
  assert.equal(courseRuleSentence(group('b-a-hons-economics'), rules), 'B.A. (Hons.) Economics needs a language, plus Mathematics and any two other subjects.');
  assert.equal(courseRuleSentence(group('bachelor-of-management-studies-bms'), rules), 'Bachelor of Management Studies (BMS) needs a language, plus Mathematics, one other subject and the General Test.');
  assert.equal(courseRuleSentence(group('b-sc-hons-physics'), rules), 'B.Sc. (Hons.) Physics needs a language, plus Physics, Chemistry and Mathematics.');
  assert.equal(courseRuleSentence(null, rules), null);
  assert.equal(courseRuleSentence({ id: 'x', name: 'X', eligibility: { combinations: [] } }, rules), null);
  for (const g of rules.groups) {
    const line = courseRuleSentence(g, rules);
    if (!line) continue;
    assert.ok(line.startsWith(g.name), g.id);
    assert.ok(line.endsWith('.') && !line.endsWith('..'), `${g.id}: one full stop`);
    assert.ok(!/[!—–]/.test(line), `${g.id}: no exclamation mark or dash`);
    assert.ok(!/undefined|NaN|\[object/.test(line), `${g.id}: ${line}`);
  }
});

test('course rule: a second and a third way read as "or one other combination", never "one of one"', () => {
  const geology = courseRuleSentence(group('b-sc-hons-geology'), rules);
  assert.match(geology, /, or one other combination\.$/);
  assert.doesNotMatch(courseRuleSentence(group('b-a-programme'), rules), /one of one/);
  assert.match(courseRuleSentence(group('b-a-hons-bengali'), rules), /, or one of two other combinations\.$/);
});

test('course rule: what every way of entering needs is marked on the tile, nothing else', () => {
  assert.deepEqual(neededByEvery(group('b-a-hons-economics')), ['mathematics']);
  assert.deepEqual(neededByEvery(group('b-com-hons')), [], 'Mathematics or Accountancy: neither is needed on its own');
  assert.deepEqual(neededByEvery(group('b-sc-hons-physics')).sort(), ['chemistry', 'mathematics', 'physics']);
  assert.deepEqual(neededByEvery(null), []);
});

test('course fit: the picks are checked against the course as they are made, in plain words', () => {
  const bcom = group('b-com-hons');
  assert.equal(courseFit(bcom, [], rules), null, 'nothing picked, nothing to say');
  assert.deepEqual(courseFit(bcom, ['english', 'accountancy', 'economics'], rules), { fits: false, line: 'To fit B.Com. (Hons.), add Mathematics.' }, 'the nearest way is named');
  assert.deepEqual(courseFit(bcom, ['english', 'accountancy', 'economics', 'business_studies'], rules), { fits: true, line: 'Your picks fit B.Com. (Hons.).' });
  assert.deepEqual(courseFit(group('b-com'), ['english', 'accountancy', 'economics', 'business_studies'], rules), { fits: true, line: 'Your picks fit B.Com.' }, 'a name that ends in a full stop is not closed twice');
  assert.equal(courseFit(group('b-com'), ['english'], rules).line, 'To fit B.Com., add one more subject and the General Test.', 'the nearest way: fewest papers still to add');
  assert.equal(courseFit(group('b-com'), ['english', 'accountancy', 'economics'], rules).line, 'To fit B.Com., add one more subject.');
  assert.equal(courseFit(group('bachelor-of-management-studies-bms'), ['english', 'mathematics', 'economics'], rules).line, 'To fit Bachelor of Management Studies (BMS), add the General Test.');
  // The General Test is the website's general_test id; Applied Mathematics counts as Mathematics.
  assert.equal(courseFit(group('bachelor-of-management-studies-bms'), ['english', 'applied_mathematics', 'economics', 'general_test'], rules).fits, true);
  assert.equal(courseFit(null, ['english'], rules), null);
});

test('course fit: ids the DU engine does not know are ignored, a language is not a domain', () => {
  assert.deepEqual(selectionFromSubjects(['english', 'general_test', 'applied_mathematics', 'hindi', 'made_up', 'english'], rules), { languages: ['english', 'hindi'].filter((id) => rules.languages.some((l) => l.id === id)), domains: ['mathematics'], gat: true });
  assert.deepEqual(selectionFromSubjects(undefined, rules), { languages: [], domains: [], gat: false });
  assert.equal(subjectWord('accountancy', rules), 'Accountancy');
  assert.equal(subjectWord('gat', rules), 'the General Test');
  assert.equal(joinWords(['A', 'B', 'C']), 'A, B and C');
  assert.equal(joinWords(['A, x', 'B', 'C']), 'A, x, B, and C');
  assert.equal(joinWords([]), '');
});

test('the page wires the course finder, the subject search, the not-yet list and hands the course to the colleges step', () => {
  const page = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(page, /<CourseFinder rules=\{rules\}/);
  assert.match(page, /pickableSubjects\(subjects, subjectQuery\)/);
  assert.match(page, /notYetSubjects\(subjects, subjectQuery\)/);
  assert.match(page, /<CollegePicker userId=\{user\?\.id\} initialCourseId=\{courseId\} \/>/);
  assert.match(page, /Needed for \{group\.name\}/);
  assert.match(page, /\{!edit && !presetMode \? \(\s*<CourseFinder/, 'editing subjects later is only the papers');
  assert.match(page, /useAboveKeyboard\(\);/, 'a search field is never left under the keyboard');
  assert.match(page, /data-du-search=""/);
  const finder = read('src/app/onboarding/CourseFinder.jsx');
  assert.match(finder, /courseRuleSentence\(group, rules\)/);
  assert.match(finder, /courseFit\(group, picked, rules\)/);
  assert.match(finder, /Which DU course are you aiming for\?/);
  assert.match(finder, /Optional/);
  const picker = read('src/components/colleges/CollegePicker.jsx');
  assert.match(picker, /initialCourseId = null/);
  assert.match(picker, /courses\.find\(\(g\) => g\.id === initialCourseId\)/);
});

// ---- common sets, one tap ------------------------------------------------------------------------------------------------------
test('common sets: three before a course; with a course only the sets that keep it open; a tap replaces, the same tap puts it away', () => {
  const available = pickableSubjects(catalogue).map((s) => s.id);
  assert.equal(SETS_LABEL, 'Common sets, one tap');
  assert.deepEqual(setsFor({ available }).map((s) => s.id), ['commerce', 'commerce-maths', 'commerce-test'], 'no course: the first three');
  assert.deepEqual(setsFor({ available, max: 1 }).map((s) => s.id), ['commerce']);
  const bms = setsFor({ group: group('bachelor-of-management-studies-bms'), rules, available });
  assert.deepEqual(bms.map((s) => s.id), ['maths-test'], 'BMS needs Maths and the General Test: only that set keeps it open');
  const econ = setsFor({ group: group('b-a-hons-economics'), rules, available });
  assert.deepEqual(econ.map((s) => s.id), ['commerce-maths', 'maths-test'], 'Economics (Hons.) needs Maths');
  assert.deepEqual(setsFor({ group: group('b-sc-hons-physics'), rules, available }), [], 'a science course gets none');
  assert.deepEqual(setsFor({ available: ['english'] }), [], 'a set MockMob cannot fully practise is never offered');
  for (const set of COMMON_SETS) assert.ok(set.subjects.length <= CUET_MAX_SUBJECTS, `${set.id} fits the five`);
  const [commerce, withMaths] = COMMON_SETS;
  assert.equal(setMatches(commerce, ['english', 'economics', 'business_studies', 'accountancy']), true, 'any order');
  assert.equal(setMatches(commerce, ['english', 'economics', 'business_studies']), false);
  assert.equal(setMatches(commerce, [...commerce.subjects, 'physics']), false);
  assert.deepEqual(applySet(commerce, ['physics']), ['accountancy', 'business_studies', 'economics', 'english']);
  assert.deepEqual(applySet(commerce, [...commerce.subjects]), []);
  assert.deepEqual(applySet(withMaths, [...commerce.subjects]), [...withMaths.subjects]);
  // The page offers them under the course, not while a search is typed, and not when only editing.
  const page = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(page, /const sets = !edit \? setsFor\(\{ group, rules, available:/);
  assert.match(page, /\{sets\.length > 0 && !searching && !presetMode \? \(/);
  assert.match(page, /onClick=\{\(\) => tapSet\(set\)\}/);
});

// ---- the name card: never an email prefix -----------------------------------------------------------------------------------
test('name: the email\'s prefix, a handle or nothing is not a name; a real name is (the app\'s I11 rule)', () => {
  const email = 'asha@example.com';
  assert.equal(shownName('asha', email), null, 'the prefix itself');
  assert.equal(shownName('Asha', email), 'Asha', 'a capital the email never had is a name the student typed');
  assert.equal(shownName('asha07', email), null);
  assert.equal(shownName('walk-r11-web-1019a', 'walk-r11-web-1019a@example.com'), null);
  assert.equal(shownName('', email), null);
  assert.equal(shownName(null, email), null);
  assert.equal(shownName('Asha Rao', email), 'Asha Rao');
  assert.equal(shownFirstName('Asha Rao', email), 'Asha');
  assert.equal(shownName('Anne-Marie', 'a@example.com'), 'Anne-Marie');
  assert.equal(shownName('anne-marie', 'anne-marie@example.com'), null);
});

test('name card: asks once, only while the account has no name worth showing', () => {
  const fresh = { id: 'u1', name: '', email: 'asha@example.com' };
  const legacy = { id: 'u2', name: 'asha', email: 'asha@example.com' };
  const named = { id: 'u3', name: 'Asha Rao', email: 'asha@example.com' };
  assert.equal(shouldAskName({ user: fresh }), true);
  assert.equal(shouldAskName({ user: legacy }), true, 'an older account that stored the prefix is asked too');
  assert.equal(shouldAskName({ user: named }), false);
  assert.equal(shouldAskName({ user: fresh, done: true }), false, 'saved or put away on this browser');
  assert.equal(shouldAskName({ user: fresh, status: 'loading' }), false);
  assert.equal(shouldAskName({ user: null }), false);
  assert.equal(shouldAskName({}), false);
});

test('name card: what is written is checked like the profile route, and the field never starts from the prefix', () => {
  assert.deepEqual(checkName('  Asha   Rao '), { ok: true, name: 'Asha Rao' });
  assert.deepEqual(checkName(''), { ok: false, error: 'Write a name first.' });
  assert.deepEqual(checkName('   '), { ok: false, error: 'Write a name first.' });
  assert.equal(checkName('a'.repeat(NAME_MAX + 1)).ok, false);
  assert.equal(checkName('a'.repeat(NAME_MAX)).ok, true);
  assert.equal(NAME_MAX, 80);
  assert.match(read('src/lib/server/profilePatch.js'), /name\.length > 80/, 'the same limit the server holds');
  assert.equal(nameFieldValue({ name: 'asha', email: 'asha@example.com' }), '', 'the prefix is not put in the field');
  assert.equal(nameFieldValue({ name: '', email: 'asha@example.com' }), '');
  assert.equal(nameFieldValue({ name: 'Asha Rao', email: 'asha@example.com' }), 'Asha Rao');
  assert.equal(nameFieldValue(null), '');
});

test('name card: Today asks under the greeting, Account starts from a real name, payment forms never prefill the prefix', () => {
  const today = read('src/app/(app)/today/page.jsx');
  assert.match(today, /import NameAsk from '@\/components\/profile\/NameAsk';/);
  assert.ok(today.indexOf('</header>') < today.indexOf('<NameAsk />') && today.indexOf('<NameAsk />') < today.indexOf('<div className="today-grid">'));
  const card = read('src/components/profile/NameAsk.jsx');
  assert.match(card, /shouldAskName\(\{ user, status, done: false \}\)/);
  assert.match(card, /method: 'PATCH'/);
  assert.match(card, /await refreshSession\(\{ silent: true \}\);/, 'the greeting reads the new name at once');
  assert.match(card, /NAME_ASK_KEY/);
  const profile = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.match(profile, /const shownOwn = nameFieldValue\(user\);/);
  assert.match(profile, /const currentName = draftName \?\? shownOwn;/);
  assert.doesNotMatch(profile, /draftName \?\? \(user\?\.name/, 'the field never starts from the stored name as is');
  assert.match(read('src/app/(app)/AppLayoutClient.jsx'), /<Avatar name=\{accountName \|\| user\?\.email\} size="sm" \/>/, 'no name: the initial of the email, not a question mark');
  for (const file of ['src/components/billing/RazorpayPaymentButton.jsx', 'src/components/billing/PrepOSCreditPurchaseButton.jsx', 'src/app/(app)/wallet/WalletPageClient.jsx']) {
    const source = read(file);
    assert.match(source, /shownName\(user\??\.name, user\??\.email\)/, file);
    assert.doesNotMatch(source, /name: user\??\.name( \|\| '')?[,\s}]/, `${file}: the stored name is not sent as is`);
  }
});

// ---- the words: sentence case, no exclamation marks, no em dashes, no hype ------------------------------------------------------
test('copy: every new line is plain, grammatical and quiet', () => {
  const lines = [
    ...Object.values(NAME_ASK),
    ...Object.values(capCopy({ wantedName: 'Physics', lastName: 'Economics' })),
    read('src/app/onboarding/subjectPick.mjs').match(/'[^'\n]{12,}'|`[^`\n]{12,}`/g)?.join(' ') || '',
  ].join('\n');
  assert.doesNotMatch(lines, /[!—–]/, 'no exclamation marks or dashes');
  assert.doesNotMatch(lines, /\b(amazing|awesome|supercharge|unlock|game-changer|ultimate|powerful)\b/i);
  const finder = read('src/app/onboarding/CourseFinder.jsx');
  const shown = finder.match(/>[^<>{}\n]{12,}</g) || [];
  for (const text of shown) assert.doesNotMatch(text, /[!—–]/, text);
  assert.match(NAME_ASK.note, /Your first name is enough/);
  assert.equal(NAME_ASK.title, 'What should Mobi call you?');
});
