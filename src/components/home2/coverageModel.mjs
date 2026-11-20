// The coverage proof on /home-next (spec HOME-NEXT-SPEC-2026-11-20, section 6): for each of the 15 subjects Practice offers,
// the CUET UG 2026 syllabus chapter by chapter, and how many questions the live bank holds for each.
//
// Pure: no React, no browser, no database. page.js reads the stored daily inventory on the server (src/lib/server/inventory.js
// publicInventory, the same one small read the /cuet subject pages make) and hands it here.
//
// Truth rules (the subject pages' own, src/lib/subjectPages.mjs):
//   * The syllabus is syllabusUnits(): the NTA 2026 list as MockMob stores it, without the "Existing ... Coverage" units. A unit
//     printed without chapters counts as one chapter, as syllabusChapterCount() counts it.
//   * A chapter's count is the sum of inventory.chapterCounts[subject][name] over its stored names (unit.sources), exactly as
//     subjectBank() sums them, so the chapters with any question (`withAny`) always equal subjectBank().chaptersCovered (a
//     test holds them together).
//   * A chapter is COVERED only when the bank holds a set's worth of questions for it (COVER_MIN: the count a first practice
//     set runs, src/lib/firstSet.mjs, 10). One question is not coverage (Revision 2 of the spec).
//   * A subject's question count is subjectBank().questions (the stored subjectCounts); the page's total is publicStatsView()'s
//     bankSize, the same number /api/stats gives the home page's "questions in one live bank" line.
//   * A subject whose counts are unknown is left out, never shown as 0. With no usable inventory the model is null and the page
//     draws no coverage section at all.
//   * No previous-year-paper figure: the repo holds no mapping of past CUET papers to the bank (data/pyq_anchors holds
//     hand-written style seeds, source_quality "manual_seed"), so no such percentage can be computed and none is printed.
import { SUBJECT_PAGES, STREAMS, subjectBank, syllabusUnits } from '../../lib/subjectPages.mjs';
import { publicStatsView } from '../../lib/server/publicStats.js';
import { FIRST_SET_COUNT } from '../../lib/firstSet.mjs';

/** A chapter is covered at this many questions or more. */
export const COVER_MIN = FIRST_SET_COUNT;

const whole = (value) => (Number(value) > 0 ? Math.trunc(Number(value)) : 0);

/** One subject's chapters in syllabus order: [{ n, name, unit, count }], numbered from 1. */
export function subjectChapters(counts, units) {
  const rows = [];
  for (const unit of units) {
    const groups = unit.chapters.length ? unit.chapters : [{ name: unit.name, sources: unit.sources }];
    for (const group of groups) {
      const count = group.sources.reduce((sum, name) => sum + whole(counts?.[name]), 0);
      rows.push({ n: rows.length + 1, name: group.name, unit: unit.name, count });
    }
  }
  return rows;
}

/**
 * The model the coverage section draws, or null when the inventory cannot back it.
 * { subjects: [{ slug, id, name, stream, questions, covered, withAny, chapters: [{ n, name, unit, count }] }],
 *   streams: [stream names that hold a subject], totals: { covered, chapters, subjects, questions }, countedOn, stale }
 */
export function coverageModel(inventory) {
  if (!inventory || inventory.state !== 'available' || !inventory.subjectCounts || !inventory.chapterCounts) return null;
  const subjects = [];
  let countedOn = null;
  for (const page of SUBJECT_PAGES) {
    const units = syllabusUnits(page.id);
    const bank = subjectBank(inventory, page.id, units);
    const counts = inventory.chapterCounts[page.id];
    if (!bank || !units.length || !counts || typeof counts !== 'object') continue;
    const chapters = subjectChapters(counts, units);
    countedOn ||= bank.countedOn;
    subjects.push({
      slug: page.slug,
      id: page.id,
      name: page.name,
      stream: page.stream,
      questions: bank.questions,
      covered: chapters.filter((c) => c.count >= COVER_MIN).length,
      withAny: chapters.filter((c) => c.count > 0).length,
      chapters,
    });
  }
  if (!subjects.length) return null;
  const bankSize = publicStatsView(inventory)?.bankSize;
  return {
    subjects,
    streams: STREAMS.filter((stream) => subjects.some((s) => s.stream === stream)),
    totals: {
      covered: subjects.reduce((sum, s) => sum + s.covered, 0),
      chapters: subjects.reduce((sum, s) => sum + s.chapters.length, 0),
      subjects: subjects.length,
      questions: Number.isFinite(bankSize) && bankSize > 0 ? bankSize : subjects.reduce((sum, s) => sum + s.questions, 0),
    },
    countedOn,
    stale: Boolean(inventory.stale),
  };
}

/** The stream switch's short names (the full names stay the accessible ones). */
export const STREAM_SHORT = Object.freeze({
  'Language and General Test': 'English and GT',
  Commerce: 'Commerce',
  Science: 'Science',
  Humanities: 'Humanities',
});

/** The subject the section opens on: Accountancy, the subject of the page's own Lab example, when the bank holds it. */
export const OPENING_SUBJECT = 'accountancy';
