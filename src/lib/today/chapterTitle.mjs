// R3 T5: a chapter on Today is named the way the syllabus (and the Learn roadmap) names it: "Goodwill: Nature and Valuation", not the
// stored name "Goodwill". PURE. The stored name still goes in links and queries; only what a student reads uses the title.
import { chaptersFor, resolveChapter } from '../../../data/cuet_syllabus.js';

/** The book's way of printing a title: "Retirement/Death of a Partner" is "Retirement and Death of a Partner" (as Learn's cleanTitle). */
const clean = (title) => String(title || '').replace(/\s*\/\s*/g, ' and ').replace(/\s+/g, ' ').trim();

/** The canonical syllabus title for a stored chapter name of a subject, or the name itself when the syllabus does not know it. */
export function chapterTitle(subject, chapter) {
  const name = String(chapter || '').trim();
  if (!name) return '';
  try {
    const hit = subject ? resolveChapter(subject, name) : null;
    if (hit && !hit.retired && hit.title) return clean(hit.title);
    // A short stored name that is the first words of exactly one chapter ("Goodwill" for "Goodwill Valuation") reads as that chapter.
    if (subject && !hit) {
      const lower = name.toLowerCase();
      const heads = chaptersFor(subject).filter((c) => [c.name, c.title].some((t) => { const x = String(t || '').toLowerCase(); return x.startsWith(`${lower} `) || x.startsWith(`${lower}:`); }));
      if (heads.length === 1 && heads[0].title) return clean(heads[0].title);
    }
  } catch { /* an unknown subject keeps the stored name */ }
  return clean(name);
}
