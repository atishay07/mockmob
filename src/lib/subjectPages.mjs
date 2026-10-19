// The public CUET subject pages (/cuet/<slug>): the facts each page prints, in one pure place so node --test can hold them.
//
// Truth rules (owner brief, 20 Oct 2026: "TRUE numbers only"):
//   * The syllabus is the NTA CUET UG 2026 list as MockMob stores it (data/canonical_syllabus.js). Its "Existing ... Coverage"
//     units hold older chapters that are not in the 2026 list, so they are never shown as syllabus.
//   * Question counts come only from the stored daily inventory (src/lib/server/inventory.js publicInventory): subjectCounts
//     for the subject total and, once the daily count has run with this release, chapterCounts for each unit. An unknown count
//     is left out, never printed as 0, and a count is printed with the day it was taken.
//   * The paper format and marking are the same for every CUET UG subject paper since 2025: 50 compulsory questions in
//     60 minutes, +5 for a right answer, -1 for a wrong one, 0 for a question left blank (data/nta_paper_pattern.js).
//   * "Unlimited" is said only of Pro (src/lib/paperCopy.mjs header): Free pays credits per paper, except the first full mock
//     in each subject while FIRST_FULL_MOCK_ON (data/first_full_mock.js).
// Sentence case; no "!", no em dash, no middle dot, no arrows.
import { getCanonicalSubject } from '../../data/canonical_syllabus.js';
import { officialSubjectCode } from '../../data/subject_registry.js';
import { FIRST_FULL_MOCK_ON } from '../../data/first_full_mock.js';

export const PAPER = Object.freeze({ questions: 50, minutes: 60, right: 5, wrong: -1, blank: 0 });

// The 15 subjects Practice offers (data/cuet_controls.js CUET_PUBLIC_ALLOWED_SUBJECTS), in the order a student meets them:
// the language and the General Test first, then commerce, science and humanities. `id` is the stored (internal) subject id
// the inventory and the syllabus use; `publicId` is the id Practice links with.
export const SUBJECT_PAGES = Object.freeze([
  { slug: 'english', id: 'english', publicId: 'english', name: 'English', stream: 'Language and General Test' },
  { slug: 'general-test', id: 'gat', publicId: 'general_test', name: 'General Test', stream: 'Language and General Test' },
  { slug: 'accountancy', id: 'accountancy', publicId: 'accountancy', name: 'Accountancy', stream: 'Commerce' },
  { slug: 'business-studies', id: 'business_studies', publicId: 'business_studies', name: 'Business Studies', stream: 'Commerce' },
  { slug: 'economics', id: 'economics', publicId: 'economics', name: 'Economics', stream: 'Commerce' },
  { slug: 'mathematics', id: 'mathematics', publicId: 'mathematics', name: 'Mathematics', stream: 'Science' },
  { slug: 'physics', id: 'physics', publicId: 'physics', name: 'Physics', stream: 'Science' },
  { slug: 'chemistry', id: 'chemistry', publicId: 'chemistry', name: 'Chemistry', stream: 'Science' },
  { slug: 'biology', id: 'biology', publicId: 'biology', name: 'Biology', stream: 'Science' },
  { slug: 'computer-science', id: 'computer_science', publicId: 'computer_science', name: 'Computer Science', stream: 'Science' },
  { slug: 'history', id: 'history', publicId: 'history', name: 'History', stream: 'Humanities' },
  { slug: 'political-science', id: 'political_science', publicId: 'political_science', name: 'Political Science', stream: 'Humanities' },
  { slug: 'geography', id: 'geography', publicId: 'geography', name: 'Geography', stream: 'Humanities' },
  { slug: 'psychology', id: 'psychology', publicId: 'psychology', name: 'Psychology', stream: 'Humanities' },
  { slug: 'sociology', id: 'sociology', publicId: 'sociology', name: 'Sociology', stream: 'Humanities' },
].map(Object.freeze));

export const STREAMS = Object.freeze(['Language and General Test', 'Commerce', 'Science', 'Humanities']);

export function subjectPage(slug) {
  return SUBJECT_PAGES.find((page) => page.slug === slug) || null;
}

/** The NTA paper code ("301") and its official label, from the subject registry. */
export function paperCode(page) {
  return officialSubjectCode(page?.publicId) || null;
}

// "Dual Nature of Radiation & Matter" names the unit "Dual Nature of Matter and Radiation": the same words in another order.
const sameWords = (a, b) => norm(a).split(' ').sort().join(' ') === norm(b).split(' ').sort().join(' ');
// The stored names keep their dashes ("An Imperial Capital — Vijayanagara"); the page prints a colon (house style: no dashes between clauses).
const printable = (name) => String(name).replace(/\s+[—–-]\s+/g, ': ');
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The 2026 syllabus units for a subject, ready to print: [{ name, chapters: [{ name, sources: [stored chapter names] }] }].
 * Leaves out the "Existing ... Coverage" units. A unit whose only chapter repeats the unit's own name prints as the unit
 * alone (chapters: []). A chapter whose name is the start of another chapter's name in the same unit ("Dissolution of
 * Partnership" and "Dissolution of Partnership Firm") prints once, under the longer name, and counts both.
 */
export function syllabusUnits(subjectId) {
  const subject = getCanonicalSubject(subjectId);
  if (!subject) return [];
  const units = [];
  for (const unit of subject.units) {
    if (/^existing\b/i.test(unit.unit_name)) continue;
    const merged = [];
    const names = unit.chapters;
    for (const chapter of names) {
      const longer = names.find((other) => other !== chapter && norm(other).startsWith(`${norm(chapter)} `));
      if (longer) continue;
      const sources = [chapter, ...names.filter((other) => other !== chapter && norm(chapter).startsWith(`${norm(other)} `))];
      merged.push({ name: printable(chapter), sources });
    }
    const single = merged.length === 1 && sameWords(merged[0].name, unit.unit_name.replace(/^section [a-z0-9]+:\s*/i, ''));
    units.push({ name: printable(unit.unit_name), chapters: single ? [] : merged, sources: merged.flatMap((c) => c.sources) });
  }
  return units;
}

/** How many chapters the printed syllabus has: a single-chapter unit counts as one. */
export function syllabusChapterCount(units) {
  return units.reduce((sum, unit) => sum + Math.max(1, unit.chapters.length), 0);
}

const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
export const fmt = (n) => Number(n).toLocaleString('en-IN');

/**
 * The bank facts for one subject from the stored inventory, or null when the counts are not known.
 * { questions, countedOn: '20 Oct', stale, units: Map(unit name -> count) | null, chaptersCovered: n | null }
 */
export function subjectBank(inventory, subjectId, units = syllabusUnits(subjectId)) {
  if (!inventory || inventory.state !== 'available' || !inventory.subjectCounts) return null;
  const raw = Number(inventory.subjectCounts[subjectId]);
  if (!Number.isFinite(raw) || raw < 0) return null;
  const at = Date.parse(inventory.checkedAt);
  const chapters = inventory.chapterCounts?.[subjectId];
  let unitCounts = null;
  let chaptersCovered = null;
  if (chapters && typeof chapters === 'object') {
    unitCounts = new Map();
    chaptersCovered = 0;
    for (const unit of units) {
      let unitTotal = 0;
      const groups = unit.chapters.length ? unit.chapters : [{ sources: unit.sources }];
      for (const group of groups) {
        const n = group.sources.reduce((sum, name) => sum + (Number(chapters[name]) > 0 ? Math.trunc(Number(chapters[name])) : 0), 0);
        if (n > 0) chaptersCovered += 1;
        unitTotal += n;
      }
      unitCounts.set(unit.name, unitTotal);
    }
  }
  return {
    questions: Math.trunc(raw),
    countedOn: Number.isFinite(at) ? DAY.format(new Date(at)) : null,
    stale: Boolean(inventory.stale),
    units: unitCounts,
    chaptersCovered,
  };
}

/** "1,404 Accountancy questions in the live bank, counted 20 Oct." or null. */
export function bankLine(bank, name) {
  if (!bank || bank.questions <= 0) return null;
  const when = bank.countedOn ? `, counted ${bank.countedOn}` : '';
  return `${fmt(bank.questions)} ${name} question${bank.questions === 1 ? '' : 's'} in the live bank${when}.`;
}

/** The free first full mock, said only while the rule is on. */
export const FIRST_FULL_FREE = FIRST_FULL_MOCK_ON;

/** The page's one action. */
export function primaryAction(name) {
  return FIRST_FULL_MOCK_ON ? `Take your first ${name} mock free` : `Start a free ${name} set`;
}

/** The fresh-paper sentence, with the subject's own count when it is known. */
export function freshLine(bank, name) {
  const pool = bank && bank.questions > 0 ? `the ${fmt(bank.questions)} ${name} questions in the bank` : `the live ${name} bank`;
  return `There is no fixed list of ${name} mocks to run out of. Each paper is built the moment you start it, from ${pool}, with questions you have not answered put first. Pro puts no cap on how many you take; on Free each paper uses credits${FIRST_FULL_MOCK_ON ? ', and your first full mock in each subject is free' : ''}.`;
}

/** The questions every subject page answers the same way, written from the rules above. */
export function commonFaqs(page, bank) {
  const n = page.name;
  const faqs = [
    {
      question: `How is the CUET ${n} paper marked?`,
      answer: `${PAPER.questions} questions in ${PAPER.minutes} minutes, all compulsory. A right answer is +${PAPER.right}, a wrong one is ${PAPER.wrong}, and a question left blank is ${PAPER.blank}, so the paper is out of ${PAPER.questions * PAPER.right}. MockMob marks every full mock the same way.`,
    },
    {
      question: `How many ${n} mocks can I take on MockMob?`,
      answer: `As many as you want. ${bank && bank.questions > 0 ? `The ${n} bank holds ${fmt(bank.questions)} checked questions${bank.countedOn ? ` (counted ${bank.countedOn})` : ''}, and each` : 'Each'} paper is built from it when you start, with questions you have not answered first. Pro has no cap. On Free, each paper uses credits. A long run of papers can bring back a question you have seen; NTA mode names any repeat on the paper.`,
    },
  ];
  if (FIRST_FULL_MOCK_ON) {
    faqs.push({
      question: `Is my first ${n} mock really free?`,
      answer: `Yes. On a free account your first full mock in each subject is free: ${PAPER.questions} questions, ${PAPER.minutes} minutes, marked the CUET way, with the same review of every miss after it. No card is needed to sign up.`,
    });
  }
  return faqs;
}
