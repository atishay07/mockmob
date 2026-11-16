// The chapter list Mobi names a brought mistake's chapter from (16 Nov 2026, lane web/1116-photo): MockMob's own syllabus
// (data/cuet_syllabus.js, "the single source for the 15 TOP_SUBJECTS' units and chapters"), by each chapter's stored `name`.
// That name is the one Practice takes: GET /api/chapters lists the chapters table through liveChapterRows (every row as its
// live syllabus name), and Practice keeps a link's ?chapter= only when it is one of those names (DashboardPageClient
// chaptersForMode). Review's "Practise 5 on this chapter" links with the same name.
//
// Server and tests only (the panel never needs the list): kept out of bringMistake.mjs so the syllabus never rides in Ask
// Mobi's client bundle. Pure.
import { chaptersFor } from '../../../data/cuet_syllabus.js';
import { toInternalSubjectId } from '../../../data/cuet_controls.js';

/** Every live chapter name of a subject (the student's stored subject id or the internal one), in syllabus order. */
export function mistakeChapters(subjectId) {
  if (typeof subjectId !== 'string' || !subjectId.trim()) return [];
  return chaptersFor(toInternalSubjectId(subjectId.trim())).map((chapter) => chapter.name);
}
