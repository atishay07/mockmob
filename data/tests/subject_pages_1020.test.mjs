// The public CUET subject pages (20 Oct 2026): every number true, every subject covered, the copy in the owner's voice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } from '../cuet_controls.js';
import { getCanonicalSubject } from '../canonical_syllabus.js';
import { subjectArt } from '../subject_art.mjs';
import {
  SUBJECT_PAGES, STREAMS, PAPER, syllabusUnits, syllabusChapterCount, subjectBank, bankLine, freshLine, commonFaqs, paperCode, subjectPage,
} from '../../src/lib/subjectPages.mjs';
import { publicStatsView } from '../../src/lib/server/publicStats.js';
import { SUBJECT_HUBS } from '../../src/lib/subjectHubs.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('one page for each of the 15 subjects Practice offers, and no other', () => {
  assert.deepEqual(SUBJECT_PAGES.map((p) => p.publicId).sort(), [...CUET_PUBLIC_ALLOWED_SUBJECTS].sort());
  for (const page of SUBJECT_PAGES) {
    assert.equal(page.id, toInternalSubjectId(page.publicId), `${page.slug} stores the internal id the inventory uses`);
    assert.match(page.slug, /^[a-z]+(-[a-z]+)*$/);
    assert.ok(STREAMS.includes(page.stream), page.slug);
    assert.ok(getCanonicalSubject(page.id), `${page.slug} has a syllabus`);
    assert.ok(subjectArt(page.slug), `${page.slug} has its object`);
    assert.match(String(paperCode(page)), /^\d{3}$/, `${page.slug} has an NTA paper code`);
  }
  assert.equal(new Set(SUBJECT_PAGES.map((p) => p.slug)).size, 15);
  assert.equal(subjectPage('nope'), null);
});

test('the syllabus leaves out the older "Existing coverage" units and prints duplicates once', () => {
  for (const page of SUBJECT_PAGES) {
    const units = syllabusUnits(page.id);
    assert.ok(units.length > 0, page.slug);
    for (const unit of units) assert.doesNotMatch(unit.name, /^existing/i, `${page.slug}: ${unit.name}`);
  }
  const acc = syllabusUnits('accountancy');
  const dissolution = acc.find((u) => u.name === 'Dissolution of Partnership Firm');
  assert.deepEqual(dissolution.chapters, [], 'a unit whose one chapter is its own name prints as the unit');
  assert.deepEqual([...dissolution.sources].sort(), ['Dissolution of Partnership', 'Dissolution of Partnership Firm']);
  const chem = syllabusUnits('chemistry');
  assert.ok(!chem.some((u) => u.sources.includes('Solid State')), 'chapters dropped from the 2026 list are not shown');
  assert.equal(syllabusChapterCount(syllabusUnits('economics')), 18);
});

test('bank counts come only from the stored inventory; unknown is null, never 0', () => {
  assert.equal(subjectBank(null, 'accountancy'), null);
  assert.equal(subjectBank({ state: 'unavailable' }, 'accountancy'), null);
  assert.equal(subjectBank({ state: 'available', subjectCounts: {} }, 'accountancy'), null, 'a subject with no stored count is unknown');
  const inventory = { state: 'available', checkedAt: '2026-10-19T21:57:18.688Z', subjectCounts: { accountancy: 1404, gat: 322 } };
  const bank = subjectBank(inventory, 'accountancy');
  assert.equal(bank.questions, 1404);
  assert.equal(bank.countedOn, '20 Oct', 'the day is the IST day');
  assert.equal(bank.units, null, 'without chapterCounts no unit is counted');
  assert.equal(bankLine(bank, 'Accountancy'), '1,404 Accountancy questions in the live bank, counted 20 Oct.');
  assert.equal(subjectBank(inventory, 'gat').questions, 322);
  assert.equal(bankLine(null, 'Accountancy'), null);
});

test('unit counts sum the chapters each unit prints, including merged duplicates', () => {
  const units = syllabusUnits('accountancy');
  const inventory = {
    state: 'available', checkedAt: '2026-10-19T21:57:18.688Z', subjectCounts: { accountancy: 100 },
    chapterCounts: { accountancy: { 'Dissolution of Partnership': 3, 'Dissolution of Partnership Firm': 4, 'Share Capital': 10, 'Solid State': 99 } },
  };
  const bank = subjectBank(inventory, 'accountancy', units);
  assert.equal(bank.units.get('Dissolution of Partnership Firm'), 7);
  assert.equal(bank.units.get('Company Accounts: Accounting for Share and Debenture Capital'), 10);
  assert.equal(bank.units.get('Computerized Accounting System'), 0);
  assert.equal(bank.chaptersCovered, 2);
});

test('the daily count carries chapterCounts for the offered subjects, and /api/stats does not expose them', () => {
  const view = publicStatsView({ state: 'available', subjectCounts: { accountancy: 2 }, chapterCounts: { accountancy: { 'Share Capital': 2 } } });
  assert.ok(!('chapterCounts' in view));
  assert.match(read('data/inventory_count.js'), /chapterCounts/);
});

test('the paper and the marking are the CUET UG facts', () => {
  assert.deepEqual({ ...PAPER }, { questions: 50, minutes: 60, right: 5, wrong: -1, blank: 0 });
  const faqs = commonFaqs(SUBJECT_PAGES[2], null);
  assert.match(faqs[0].answer, /\+5/);
  assert.match(faqs[0].answer, /out of 250/);
});

test('every hub has its words, and the words follow the house rules', () => {
  assert.equal(SUBJECT_HUBS.length, 15);
  for (const hub of SUBJECT_HUBS) {
    for (const key of ['title', 'description', 'h1', 'intro']) assert.ok(hub[key], `${hub.slug} ${key}`);
    assert.ok(hub.essay?.heading && hub.essay.body.length >= 2, `${hub.slug} essay`);
    assert.ok(hub.faqs.length >= 2, `${hub.slug} faqs`);
    assert.ok(hub.description.length <= 170, `${hub.slug} description is ${hub.description.length} characters`);
    assert.ok(hub.title.includes(hub.name), `${hub.slug} title names the subject`);
    const words = [hub.title, hub.description, hub.h1, hub.intro, hub.essay.heading, ...hub.essay.body, ...hub.faqs.flatMap((f) => [f.question, f.answer]),
      freshLine({ questions: 10, countedOn: '20 Oct' }, hub.name), ...commonFaqs(hub, null).flatMap((f) => [f.question, f.answer])];
    for (const text of words) {
      assert.doesNotMatch(text, /!/, `${hub.slug}: no exclamation marks: ${text}`);
      assert.doesNotMatch(text, /—|·/, `${hub.slug}: no em dash or middle dot: ${text}`);
      assert.doesNotMatch(text, /\b(best|number one|guarantee|seamless|unleash|elevate)\b|#1/i, `${hub.slug}: no hype: ${text}`);
      if (/unlimited/i.test(text)) assert.match(text, /unlimited[^.]*with Pro/i, `${hub.slug}: unlimited only for Pro: ${text}`);
    }
  }
});

test('the sitemap and the footer reach every subject page and the index', () => {
  const sitemap = read('src/app/sitemap.js');
  assert.match(sitemap, /SUBJECT_HUBS\.map/);
  assert.match(sitemap, /absoluteUrl\('\/cuet'\)/);
  assert.match(read('src/components/MarketingFooter.jsx'), /'\/cuet'\]/);
  const page = read('src/app/cuet/[subject]/page.js');
  assert.match(page, /export const revalidate = 3600/);
  assert.match(page, /publicInventory\(\)/);
  assert.match(read('src/components/subject/SubjectLandingPage.jsx'), /faqJsonLd\(faqs\)/);
});
