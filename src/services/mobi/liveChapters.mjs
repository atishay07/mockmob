// The chapter names Practice will actually keep from a ?chapter= link (review of lane web/1116-photo, 16 Nov 2026).
//
// Practice reads GET /api/chapters (src/app/api/chapters/route.js): the `chapters` table rows of the subject, through
// liveChapterRows (retired and split chapters dropped, an alias shown once as its live name), or, when the table has none for
// the subject, data/subjects.js's static list through the same liveChapterRows. It keeps a link's chapter only when that exact
// name is in what it read (DashboardPageClient, chaptersForMode). So a chapter Mobi named from the syllabus
// (mistakeChapters.mjs) is shown as "Practise 10 <chapter> questions" only when it is also in this live list; otherwise the
// next step is the subject's link, as before.
//
// Read-only (one select of names), cached per subject for a short time, and injected through src/services/mobi/mistakeDeps.js,
// so the tests give it a fake. A failed read is never cached and never guessed: the caller drops the chapter.
import { liveChapterRows } from '../../../data/cuet_syllabus.js';
import { getSubjectById } from '../../../data/subjects.js';
import { normalizeSubjectSelection } from '../../../data/cuet_controls.js';

export const LIVE_CHAPTERS_TTL_MS = 5 * 60_000;

/**
 * The live chapter names of a subject, read as GET /api/chapters reads them. `db` is a Supabase client (supabaseAdmin() in
 * mistakeDeps; a fake in the tests). -> Set of names | null (not a subject Practice serves). Throws when the read fails.
 */
export async function readLiveChapterNames(db, subjectId) {
  const selection = normalizeSubjectSelection({ subject: subjectId });
  if (!selection.valid) return null;
  const internal = selection.internalSubject;
  const { data, error } = await db.from('chapters').select('name').eq('subject_id', internal);
  if (error) throw Object.assign(new Error('live_chapters_read_failed'), { code: error.code || null });
  const rows = liveChapterRows(internal, Array.isArray(data) ? data : []);
  if (rows.length) return new Set(rows.map((row) => row.name).filter(Boolean));
  // The route's static fallback when the table has no rows for the subject.
  const subject = getSubjectById(internal);
  return new Set(subject ? liveChapterRows(internal, subject.chapters.map((name) => ({ name }))).map((row) => row.name) : []);
}

/**
 * A cached reader: `read(subjectId)` -> Set | null, kept per subject for `ttlMs`. A read that throws is not cached and throws
 * again to the caller (who then drops the chapter).
 */
export function createLiveChapters({ read, ttlMs = LIVE_CHAPTERS_TTL_MS, now = () => Date.now() } = {}) {
  const cache = new Map();
  return async (subjectId) => {
    const key = String(subjectId || '');
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.names;
    const names = await read(key);
    cache.set(key, { names, at: now() });
    return names;
  };
}

/** True when Practice would keep `chapter` for this subject: the live list was read and has that exact name. */
export function practiceKeeps(names, chapter) {
  return typeof chapter === 'string' && names instanceof Set && names.has(chapter);
}
