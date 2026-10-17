// What Concepts (the lesson library, /learn) and Practice's Concepts panel say, from the study catalog and Review's record
// (LEARN-REVIEW-1017 5.9 and 5.11, packet P-LR3). PURE: no I/O, no React, no clock. The catalog is GET /api/study/catalog
// ({ units, subjects, active, nextUnit, progress, queue }); the review is GET /api/me/review ({ state, chapters, reviseDue }),
// or null when there is none to read. Every number a surface prints comes from here, so the panel, the "Where you lose
// marks" rows and the "All chapters" rows agree (they all come from the same `chapters` of the review record).
//
//   conceptsPick({ catalog, review })                        the one lesson to read next: finish, mistakes, next, practise
//   loseMarks({ review, units, subject })                    chapters with open mistakes for one subject, with their lessons
//   allChapters({ subject, syllabus, units, review })        every syllabus chapter, in syllabus order, marks where open
//   searchConcepts(query, { units, subjects })               lessons and chapters matching a search, across subjects
//   recordLine(catalog)                                      "2 of 9 lessons read, 8 cards in Revise, 23 cards recalled"
//   lessonRow(unit)                                          what one lesson row shows (ring state, minutes or Read, line)
//   practicePanel({ catalog, review })                       the personalised Concepts panel on Practice
import { LOCK_IN_MINUTES, nameKey } from './lesson_map.mjs';

const SUBJECT_IDS = ['english', 'accountancy', 'business_studies', 'economics'];
const NAMES = { english: 'English', accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const clean = (text) => String(text ?? '').replaceAll(' · ', ', ').replace(/\s+/g, ' ').trim();
// A catalog summary read as a sentence: a capital first, and a full stop.
const sentence = (text) => { const t = clean(text); return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t) ? '' : '.'}` : ''; };

/** The subject id for an id or a display name ("business_studies", "Business Studies"); null when it is neither. */
export function subjectId(value) {
  const key = nameKey(value);
  return SUBJECT_IDS.find((id) => nameKey(id) === key || nameKey(NAMES[id]) === key) || null;
}

const reviewReady = (review) => Boolean(review && review.state === 'ready' && Array.isArray(review.chapters));
const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));
const sameChapter = (a, b) => Boolean(a) && Boolean(b) && nameKey(a) === nameKey(b);

/** The catalog's lessons for one subject's chapter, in the order they are taught. */
export function chapterLessons(units, subject, chapter) {
  const id = subjectId(subject);
  return (Array.isArray(units) ? units : []).filter((u) => u && (!id || u.subject === id) && sameChapter(u.chapter, chapter)).sort(byOrder);
}

const startMinutes = (unit) => (unit && unit.estimatedMinutes !== null && Number.isFinite(Number(unit.estimatedMinutes)) ? (unit.read ? LOCK_IN_MINUTES : Number(unit.estimatedMinutes) + LOCK_IN_MINUTES) : null);
const dueToday = (review) => (reviewReady(review) && Number.isFinite(Number(review.reviseDue?.total)) ? Number(review.reviseDue.total) : 0);

/** The chapter rows that have an open cost, with the lessons for each (all subjects). */
function costlyChapters(review, units) {
  if (!reviewReady(review)) return [];
  return review.chapters.filter((c) => Number(c.marks) > 0).map((c) => {
    const subject = subjectId(c.subject) || subjectId(c.subjectName);
    return { row: c, subject, lessons: subject ? chapterLessons(units, subject, c.name) : [] };
  });
}

/**
 * The lesson to read next (5.9), the one volt of the Concepts page:
 *   1  an unfinished lesson ("Finish the lesson, step k of n")
 *   2  the unread lesson for the costliest chapter with open mistakes
 *   3  the next unread lesson the catalog recommends
 *   4  nothing to read: practise questions
 * Due cards are never the pick (they live in Revise). Returns { kind, unit, title, lead, reason, key, cost, href, run, minutes, chapter, open }.
 */
export function conceptsPick({ catalog, review = null } = {}) {
  const units = catalog?.units || [];
  const due = dueToday(review);
  const cost = (unit) => {
    const cards = Number(unit?.cardCount) || 0;
    if (!cards) return 'Free.';
    return `Free. ${cards === 1 ? 'Its card then joins' : `Its ${cards} cards then join`} Revise${due ? `, where ${due} ${due === 1 ? 'is' : 'are'} due today` : ''}.`;
  };
  const key = (unit) => `Start the lesson${startMinutes(unit) ? `, ${plural(startMinutes(unit), 'minute')}` : ''}`;
  const active = catalog?.active;
  if (active && active.mode === 'learn') {
    const unit = units.find((u) => u.id === active.unitId) || null;
    return {
      kind: 'finish', unit, title: unit?.title || active.title, lead: 'Finish this next.',
      reason: `You stopped at step ${active.step} of ${active.total}. Everything before it is saved.`,
      key: `Finish the lesson, step ${active.step} of ${active.total}`, cost: cost(unit), href: `/study/${active.id}`, run: null,
      minutes: Number(unit?.estimatedMinutes) || null, chapter: unit?.chapter || null, open: 0,
    };
  }
  for (const { row, lessons } of costlyChapters(review, units)) {
    const unit = lessons.find((u) => u.status === 'in_progress') || lessons.find((u) => !u.read);
    if (!unit) continue;
    const open = Number(row.openWrong) || 0;
    const blank = Number(row.blank) || 0;
    return {
      kind: 'mistakes', unit, title: unit.title, lead: 'Read this next.',
      reason: open ? `${open} of your open ${open === 1 ? 'mistake is' : 'mistakes are'} in its chapter, ${unit.chapter}.` : `${plural(blank, 'question')} you left blank ${blank === 1 ? 'is' : 'are'} in its chapter, ${unit.chapter}.`,
      key: key(unit), cost: cost(unit), href: `/learn/${encodeURIComponent(unit.id)}?from=${encodeURIComponent(`chapter:${unit.subject}:${unit.chapter}`)}`,
      run: { mode: 'learn', unitId: unit.id }, minutes: Number(unit.estimatedMinutes) || null, chapter: unit.chapter, open,
    };
  }
  const next = catalog?.nextUnit && units.find((u) => u.id === catalog.nextUnit.id);
  if (next) {
    const read = Number(catalog?.progress?.lessonsRead) || 0;
    return {
      kind: 'next', unit: next, title: next.title, lead: read ? 'Read this next.' : 'Start here.', reason: sentence(next.summary),
      key: key(next), cost: cost(next), href: `/learn/${encodeURIComponent(next.id)}`,
      run: { mode: 'learn', unitId: next.id }, minutes: Number(next.estimatedMinutes) || null, chapter: next.chapter, open: 0,
    };
  }
  return { kind: 'practise', unit: null, title: 'Every lesson is read', lead: '', reason: 'Nothing is waiting. Practise a chapter or take a mock to find what to study next.', key: 'Practise questions', cost: null, href: '/dashboard', run: null, minutes: null, chapter: null, open: 0 };
}

/** What one lesson row shows: its ring state, the time or "Read", and one line. */
export function lessonRow(unit) {
  const memoryDue = Number(unit?.memory?.due) || 0;
  const summary = clean(unit?.summary);
  const step = unit?.inProgress ? `In progress, step ${unit.inProgress.step} of ${unit.inProgress.total}` : null;
  const line = memoryDue ? `${plural(memoryDue, 'card')} due in Revise today` : step ? `${step}. ${summary}` : unit?.read ? summary : `New. ${summary}`;
  const trailing = unit?.read ? 'Read' : Number.isFinite(Number(unit?.estimatedMinutes)) && unit?.estimatedMinutes !== null ? `${unit.estimatedMinutes} min` : '';
  return { id: unit?.id, title: unit?.title, line, trailing, status: unit?.status || 'new', href: `/learn/${encodeURIComponent(unit?.id)}` };
}

const lessonsMeta = (lessons) => {
  const read = lessons.filter((u) => u.read).length;
  return `${plural(lessons.length, 'lesson')}${read ? `, ${read} read` : ''}`;
};

/** Chapters with an open cost for one subject, costliest first (the order of the review's own chapter rows). */
export function loseMarks({ review, units, subject }) {
  return costlyChapters(review, units).filter((c) => c.subject === subject).map(({ row, lessons }) => {
    const open = Number(row.openWrong) || 0;
    const blank = Number(row.blank) || 0;
    const head = [open ? `${open} open ${open === 1 ? 'mistake' : 'mistakes'}` : null, blank ? `${blank} ${blank === 1 ? 'blank' : 'blanks'}` : null].filter(Boolean).join(', ');
    return {
      id: row.id, name: lessons[0]?.chapter || row.name, marks: Number(row.marks) || 0, open, blank, lessons,
      meta: `${head}. ${lessons.length ? lessonsMeta(lessons) : 'No lesson yet. Practise the chapter'}`,
    };
  });
}

/** Every chapter of the syllabus for a subject, in syllabus order, with its open marks and its lessons. */
export function allChapters({ subject, syllabus, units, review }) {
  const open = new Map(costlyChapters(review, units).filter((c) => c.subject === subject).map((c) => [nameKey(c.row.name), c.row]));
  const chapters = (syllabus?.chapters || []).map((chapter) => {
    const lessons = chapterLessons(units, subject, chapter.title);
    const row = open.get(nameKey(chapter.title)) || null;
    return { id: chapter.id, name: chapter.title, marks: row ? Number(row.marks) || 0 : 0, lessons, meta: lessons.length ? lessonsMeta(lessons) : 'No lesson yet. Practice ready' };
  });
  const taught = chapters.filter((c) => c.lessons.length);
  const lessonCount = taught.reduce((sum, c) => sum + c.lessons.length, 0);
  return { chapters, lessonCount, taughtChapters: taught.length, head: `${plural(lessonCount, 'lesson')} in ${taught.length} of ${chapters.length}` };
}

/** Lessons and chapters that match a search, across the four subjects. A query under two characters matches nothing (null). */
export function searchConcepts(query, { units = [], subjects = [] } = {}) {
  const needle = nameKey(query);
  if (needle.length < 2) return null;
  const hit = (text) => nameKey(text).includes(needle);
  const lessons = units.filter((u) => hit(u.title) || hit(u.chapter) || hit(u.summary) || hit(u.skill)).sort(byOrder).slice(0, 30);
  const chapters = [];
  for (const group of subjects) {
    for (const chapter of group.chapters || []) {
      if (!hit(chapter.title)) continue;
      if (units.some((u) => u.subject === group.subject && sameChapter(u.chapter, chapter.title))) continue;
      chapters.push({ subject: group.subject, id: chapter.id, name: chapter.title });
    }
  }
  return { lessons, chapters: chapters.slice(0, 30) };
}

/** The study record as one line (side column at 1440, end of page on phones). */
export function recordLine(catalog) {
  const p = catalog?.progress || {};
  const read = Number(p.lessonsRead) || 0;
  const of = Number(p.lessonsAvailable) || 0;
  const cards = Number(p.cardsStarted) || 0;
  const recalled = Number(p.recallReviews) || 0;
  return { read, of, cards, recalled, text: `${read} of ${of} lessons read, ${plural(cards, 'card')} in Revise, ${plural(recalled, 'card')} recalled` };
}

/**
 * Practice's Concepts panel (5.11): "{lesson}, {m} min. {k} of your open mistakes are in its chapter." then "All concepts".
 * Without a record the panel names the lesson the library would open; with every lesson read it only points at the library.
 */
export function practicePanel({ catalog, review = null } = {}) {
  const pick = conceptsPick({ catalog, review });
  if (pick.kind === 'practise') return { kind: 'library', title: 'Concepts', line: 'Short lessons on the ideas behind your mistakes.', href: '/learn', lesson: null };
  const minutes = pick.minutes ? `, ${pick.minutes} min` : '';
  return {
    kind: pick.kind, title: `${pick.title}${minutes}`,
    line: pick.kind === 'mistakes' || pick.kind === 'finish' ? pick.reason : `${pick.lead} ${pick.reason}`.trim(),
    href: pick.href, lesson: pick.unit?.id || null,
  };
}
