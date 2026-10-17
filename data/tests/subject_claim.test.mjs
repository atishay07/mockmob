// The subject claim (docs/brain/SUBJECT-COVERAGE-2026-10-17.md): "Full NTA-pattern mocks for the 15 subjects behind
// 19 of every 20 CUET papers". Held here: the 15 and the 19 of 20 agree with the code, no count of subjects includes
// the thin stored subjects or the four papers CUET dropped in 2025, those four are never offered (catalogue, profile,
// feeds, battles) though their rows stay, and no visible copy outside the landing carries the old claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAPER_SHARE, PUBLIC_SUBJECT_COUNT, RETIRED_SUBJECT_IDS, SUBJECT_CLAIM,
  coveredPublicSubjects, isRetiredSubject, retiredSubjectEntry, retiredSubjectsIn, withoutRetiredSubjects,
} from '../subject_claim.js';
import { CUET_ALLOWED_SUBJECTS, CUET_PUBLIC_ALLOWED_SUBJECTS, normalizeSubjectSelection } from '../cuet_controls.js';
import { SUBJECTS } from '../subjects.js';
import { resolveSubject } from '../subject_registry.js';
import { profilePatch } from '../../src/lib/server/profilePatch.js';
import { publicStatsView } from '../../src/lib/server/publicStats.js';
import { practiceBankSize } from '../../src/lib/practiceBank.mjs';
import { pricingSubjectLine, pricingBankLine } from '../../src/lib/paperCopy.mjs';
import { siteConfig } from '../../src/lib/seo.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

// A stored inventory shaped like production: every subject with a question has a count, the 15 offered ones large,
// the thin ones and the four dropped ones small. Internal ids ('gat' for the General Test).
function storedInventory() {
  const subjectCounts = {};
  for (const subject of SUBJECTS) subjectCounts[subject.id] = 12;
  for (const id of CUET_ALLOWED_SUBJECTS) subjectCounts[id] = 300;
  subjectCounts.entrepreneurship = 91; subjectCounts.teaching_aptitude = 80;
  subjectCounts.legal_studies = 77; subjectCounts.engineering_graphics = 66;
  return { state: 'available', bankSize: Object.values(subjectCounts).reduce((a, b) => a + b, 0), subjectCounts, checkedAt: '2026-10-17T00:00:00.000Z' };
}

test('the claim names the 15 offered subjects and the 19 of 20 share, and the code agrees', () => {
  assert.equal(PUBLIC_SUBJECT_COUNT, CUET_PUBLIC_ALLOWED_SUBJECTS.length);
  assert.equal(PUBLIC_SUBJECT_COUNT, CUET_ALLOWED_SUBJECTS.length);
  assert.equal(PUBLIC_SUBJECT_COUNT, 15);
  // 94.9% of 2026 paper registrations (93.9% in 2025) is 19 of every 20 either year.
  assert.equal(Math.round((PAPER_SHARE.percent / 100) * PAPER_SHARE.outOf), PAPER_SHARE.covered);
  assert.equal(Math.round((PAPER_SHARE.previousPercent / 100) * PAPER_SHARE.outOf), PAPER_SHARE.covered);
  assert.equal(SUBJECT_CLAIM.long, 'Full NTA-pattern mocks for the 15 subjects behind 19 of every 20 CUET papers');
  assert.equal(SUBJECT_CLAIM.short, 'The 15 subjects behind 19 of every 20 CUET papers');
  assert.equal(SUBJECT_CLAIM.withSource, `${SUBJECT_CLAIM.long} (2026 NTA data)`);
});

test('no claim string says 41, "every subject", a percentage of students, or uses a dash or hype', () => {
  for (const line of [SUBJECT_CLAIM.long, SUBJECT_CLAIM.short, SUBJECT_CLAIM.meta, SUBJECT_CLAIM.withSource, SUBJECT_CLAIM.source, pricingSubjectLine(), siteConfig.description]) {
    assert.doesNotMatch(line, /\b4[0-2]\b|every subject|all subjects|\d+% of (all )?students|[!—·→]|unlimited|best|#1/i, line);
  }
  assert.ok(siteConfig.description.startsWith(SUBJECT_CLAIM.meta));
  assert.match(pricingSubjectLine(), /^Full NTA-pattern mocks for the 15 subjects behind 19 of every 20 CUET papers \(2026 NTA data\)\.$/);
  assert.doesNotMatch(pricingBankLine(null), /\d/, 'the bank line itself still carries no number when the count is unknown');
});

test('a count of subjects counts only the public ones: 41 stored subjects with questions still read 15', () => {
  const inventory = storedInventory();
  const stored = Object.values(inventory.subjectCounts).filter((n) => Number(n) > 0).length;
  assert.ok(stored > 38, `the production-shaped fixture holds a question in ${stored} subjects, the old way of counting`);
  const view = publicStatsView(inventory);
  assert.equal(view.publicSubjectCount, 15);
  assert.deepEqual(Object.keys(view.subjectCounts).sort(), [...CUET_ALLOWED_SUBJECTS].sort());
  assert.equal(Object.values(view.subjectCounts).filter((n) => n > 0).length, 15, 'counting the exposed map the old way also reads 15');
  // The bank is the 15 offered subjects' questions, the same bank the pricing page quotes.
  assert.equal(view.bankSize, 15 * 300);
  assert.equal(view.bankSize, practiceBankSize(inventory));
  assert.notEqual(view.bankSize, inventory.bankSize);
  for (const id of RETIRED_SUBJECT_IDS) assert.ok(!(id in view.subjectCounts), `${id} is not in the public counts`);
  // An empty subject is not covered.
  assert.equal(publicStatsView({ ...inventory, subjectCounts: { ...inventory.subjectCounts, physics: 0 } }).publicSubjectCount, 14);
  // Everything else on the stored row passes through.
  assert.equal(view.checkedAt, inventory.checkedAt);
  assert.equal(view.state, 'available');
});

test('an unavailable inventory is never turned into a number', () => {
  const unavailable = { state: 'unavailable', reason: 'no_snapshot' };
  assert.equal(publicStatsView(unavailable), unavailable);
  assert.equal(publicStatsView(null), null);
  assert.equal(coveredPublicSubjects(null, CUET_ALLOWED_SUBJECTS), null);
  assert.equal(coveredPublicSubjects('x', CUET_ALLOWED_SUBJECTS), null);
  assert.equal(publicStatsView({ state: 'available', bankSize: 5, subjectCounts: {} }).publicSubjectCount, 0);
  assert.equal(publicStatsView({ state: 'available', bankSize: 5, subjectCounts: { gat: '12', english: -4, physics: 'x' } }).bankSize, 12);
});

test('the four papers CUET dropped in 2025 are known by any spelling and never in the 15', () => {
  assert.deepEqual([...RETIRED_SUBJECT_IDS].sort(), ['engineering_graphics', 'entrepreneurship', 'legal_studies', 'teaching_aptitude']);
  for (const spelling of ['teaching_aptitude', 'Teaching Aptitude', ' TEACHING-APTITUDE ', 'legal_studies', 'Engineering Graphics', 'entrepreneurship']) {
    assert.equal(isRetiredSubject(spelling), true, spelling);
  }
  for (const id of [...CUET_PUBLIC_ALLOWED_SUBJECTS, 'gat', 'hindi', 'agriculture', 'physical_education', '', null, undefined, 'constructor', '__proto__']) {
    assert.equal(isRetiredSubject(id), false, String(id));
  }
  for (const id of RETIRED_SUBJECT_IDS) {
    assert.ok(!CUET_PUBLIC_ALLOWED_SUBJECTS.includes(id));
    assert.ok(!CUET_ALLOWED_SUBJECTS.includes(id));
  }
});

test('the catalogue never offers them, and a practice start refuses them', () => {
  const offered = withoutRetiredSubjects(SUBJECTS);
  assert.equal(offered.length, SUBJECTS.length - 4);
  for (const id of RETIRED_SUBJECT_IDS) {
    assert.ok(SUBJECTS.some((s) => s.id === id), `${id} keeps its record`);
    assert.ok(!offered.some((s) => s.id === id), `${id} is not offered`);
    assert.equal(resolveSubject(id).practice, 'retired');
    assert.equal(resolveSubject(id).launch, false);
    // Practice start, quote, chapters and upload all run the subject through this check.
    const selection = normalizeSubjectSelection({ subject: id });
    assert.equal(selection.valid, false, id);
    assert.equal(selection.error, 'SUBJECT_NOT_SUPPORTED');
  }
  for (const id of CUET_PUBLIC_ALLOWED_SUBJECTS) assert.equal(normalizeSubjectSelection({ subject: id }).valid, true, id);
  assert.deepEqual(withoutRetiredSubjects(['english', 'teaching_aptitude', { id: 'legal_studies' }, { id: 'physics' }]), ['english', { id: 'physics' }]);
  assert.deepEqual(withoutRetiredSubjects(null), []);
});

test('a saved choice is hidden from the list but still named, with the reason, in a note', () => {
  assert.deepEqual(retiredSubjectsIn(['english', 'teaching_aptitude', 'Legal Studies', 'teaching_aptitude']), ['teaching_aptitude', 'legal_studies']);
  assert.deepEqual(retiredSubjectsIn(undefined), []);
  const entry = retiredSubjectEntry('teaching_aptitude');
  assert.equal(entry.name, 'Teaching Aptitude');
  assert.equal(entry.practice, 'retired');
  assert.match(entry.practiceReason, /CUET dropped this paper in 2025/);
  assert.doesNotMatch(entry.practiceReason, /[!—·→]/);
  assert.equal(retiredSubjectEntry('english'), null);
  assert.equal(retiredSubjectEntry(''), null);
});

test('a profile save can never add a dropped subject', () => {
  for (const id of RETIRED_SUBJECT_IDS) {
    assert.match(profilePatch({ subjects: ['english', id] }).error, /listed subjects/, id);
  }
  assert.deepEqual(profilePatch({ subjects: ['english', 'physics'] }).patch, { subjects: ['english', 'physics'] });
  assert.deepEqual(profilePatch({ subjects: ['general_test'] }).patch, { subjects: ['general_test'] });
});

test('every server path that takes a subject from a visitor is wired to the retired check', () => {
  const wired = {
    'src/app/api/subjects/route.js': /withoutRetiredSubjects\(SUBJECTS\)/,
    'src/app/api/stats/route.js': /publicStatsView\(inventory\)/,
    'src/app/api/questions/feed/route.js': /isRetiredSubject\(subject\)/,
    'src/app/api/questions/explore/route.js': /isRetiredSubject\(subject\)/,
    'src/services/ai-rival/createAIRivalBattle.js': /withoutRetiredSubjects\(/,
    'src/lib/server/profilePatch.js': /!isRetiredSubject\(id\)/,
    'data/db.js': /withoutRetiredSubjects\(r\.subjects\)/,
    'src/app/api/auth/me/route.js': /retiredSubjects: dbUser\.retiredSubjects/,
  };
  for (const [file, pattern] of Object.entries(wired)) assert.match(read(file), pattern, file);
  // Both user mappers hide the dropped subjects; only the full profile read names them (the session user stays least-privilege).
  assert.equal((read('data/db.js').match(/withoutRetiredSubjects\(r\.subjects\)/g) || []).length, 2);
  assert.equal((read('data/db.js').match(/retiredSubjectsIn\(r\.subjects\)/g) || []).length, 1);
  // Practice start and quote still go through the 15-subject allowlist.
  for (const file of ['src/app/api/practice/quote/route.js', 'src/app/api/questions/route.js', 'src/app/api/chapters/route.js', 'src/app/api/questions/upload/route.js']) {
    assert.match(read(file), /normalizeSubjectSelection|CUET_PUBLIC_ALLOWED|resolveSubject/, file);
  }
});

// Visible copy, metadata and structured data: no count of subjects that includes the thin or dropped ones.
// The landing page (src/app/page.js, src/components/landing) belongs to the landing branch and is checked there;
// it must read publicSubjectCount from /api/stats instead of counting subjectCounts itself.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

test('no visible copy outside the landing carries "41 subjects" or a count made from every stored subject', () => {
  const files = walk(resolve(root, 'src')).filter((file) => {
    const rel = relative(root, file).replace(/\\/g, '/');
    return !rel.startsWith('src/components/landing/') && rel !== 'src/app/page.js' && !rel.startsWith('src/app/preview/');
  });
  const oldClaim = /\b(4[0-2]|forty)\+?\s+(CUET\s+)?subjects\b|\b(all|every)\s+CUET\s+subjects\b|\ball\s+(4[0-2])\b|80%\s+of\s+(CUET\s+)?students/i;
  const stored = /Object\.values\([^)]*subjectCounts[^)]*\)\s*\.filter\([^)]*\)\s*\.length/;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(root, file).replace(/\\/g, '/');
    // ok(!test()) rather than doesNotMatch, so a failure prints the file, not the whole source.
    assert.ok(!oldClaim.test(text), `${rel} carries an old subject claim`);
    assert.ok(!stored.test(text), `${rel} counts subjects from every stored subject`);
  }
  assert.doesNotMatch(read('PRODUCT.md'), /\*\*42 CUET subjects\*\*/);
});
