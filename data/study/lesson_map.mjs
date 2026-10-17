// The lesson for an idea, at the moment a student is missing it (LEARN-REVIEW-1017 5.10, 5.11 and packet P-LR0). PURE: the
// catalog is handed in (GET /api/study/catalog: `units`, each { id, subject, chapter, conceptId, title, estimatedMinutes, read,
// inProgress, status, cardCount, order }), so Review, the result page, the repair entry and Practice's Concepts panel all ask
// the same question the same way. The rule is the one src/components/study/MistakeLessonLink.jsx already ran (a lesson whose
// chapter is the mistake's chapter, or whose concept is the mistake's concept), made a function with one tie-break, and never
// claims the lesson fixes the mistake: it names the idea behind it.
//
//   lessonFor({ subject, chapter, conceptId }, units)   the one lesson to offer, or null ("No lesson yet")
//   lessonsForChapters(subject, chapters, units)        Map(chapter name -> lesson | null), for a list of chapter rows
//   lessonHref(lesson, from)                            "/learn/{id}?from=q:{attemptId}:{n}" and the other two moments
//   parseFrom(value)                                    the lesson page reads `?from=` back: { kind: 'q' | 'chapter' | 'today', ... } or null

/** Minutes the "Lock it in" step takes: the low end of the lesson page's own "2–3 min". The key reads Learn plus this. */
export const LOCK_IN_MINUTES = 2;

// Names are compared the way a student reads them: "Admission of a partner" is "Admission of Partner", "Retirement & Death"
// is "Retirement and death", and the subject id business_studies is "Business Studies". Case, '&', '_', and the words
// a, an and the do not tell two chapters apart.
const norm = (value) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/_/g, ' ').replace(/\b(?:a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
/** The comparison key for a subject or chapter name (Concepts matches the student's papers to the catalog with it). */
export const nameKey = norm;
const rank = (unit) => (unit.inProgress || unit.status === 'in_progress' ? 0 : unit.read ? 2 : 1); // finish what is started, then unread, then read
const byRank = (a, b) => rank(a) - rank(b) || (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));

function view(unit, basis) {
  const minutes = Number.isFinite(Number(unit.estimatedMinutes)) && unit.estimatedMinutes !== null ? Number(unit.estimatedMinutes) : null;
  const read = Boolean(unit.read);
  return {
    id: unit.id, title: unit.title, subject: unit.subject, chapter: unit.chapter, conceptId: unit.conceptId ?? null,
    basis, read, status: unit.status ?? null, cards: Number(unit.cardCount) || 0,
    minutes, lockInMinutes: LOCK_IN_MINUTES,
    // "Start the lesson, 9 minutes": Learn plus Lock it in. A lesson already read starts at Lock it in.
    startMinutes: minutes === null ? null : read ? LOCK_IN_MINUTES : minutes + LOCK_IN_MINUTES,
    href: `/learn/${encodeURIComponent(unit.id)}`,
  };
}

/** The lesson for a mistake's concept, else for its chapter; null when the catalog has none. The subject must match when given. */
export function lessonFor({ subject = null, chapter = null, conceptId = null } = {}, units = []) {
  const list = (Array.isArray(units) ? units : []).filter((u) => u && u.id && (!subject || norm(u.subject) === norm(subject)));
  if (conceptId) {
    const byConcept = list.filter((u) => u.conceptId && u.conceptId === conceptId).sort(byRank)[0];
    if (byConcept) return view(byConcept, 'concept');
  }
  if (chapter) {
    const wanted = norm(chapter);
    const byChapter = list.filter((u) => norm(u.chapter) === wanted).sort(byRank)[0];
    if (byChapter) return view(byChapter, 'chapter');
  }
  return null;
}

/** Map(chapter name -> lesson | null) for one subject's chapters (Review's chapter rows, Practice's chapter list). */
export function lessonsForChapters(subject, chapters = [], units = []) {
  return new Map((chapters || []).map((c) => {
    const name = typeof c === 'string' ? c : c?.name ?? c?.chapter;
    return [name, lessonFor({ subject, chapter: name, conceptId: typeof c === 'object' ? c?.conceptId ?? null : null }, units)];
  }));
}

/**
 * The lesson link with where the student came from (5.10):
 *   { kind: 'q', attemptId, number }          "You are here from Question 42, Mock 3."
 *   { kind: 'chapter', subject, chapter }     "5 open mistakes in this chapter."
 *   { kind: 'today' }                         Today's why line
 *   none                                      as the library opens it
 */
export function lessonHref(lesson, from = null) {
  if (!lesson?.href) return null;
  if (!from) return lesson.href;
  if (from.kind === 'q' && from.attemptId && Number.isInteger(from.number)) return `${lesson.href}?${new URLSearchParams({ from: `q:${from.attemptId}:${from.number}` })}`;
  if (from.kind === 'chapter' && from.subject && from.chapter) return `${lesson.href}?${new URLSearchParams({ from: `chapter:${from.subject}:${from.chapter}` })}`;
  if (from.kind === 'today') return `${lesson.href}?${new URLSearchParams({ from: 'today' })}`;
  return lesson.href;
}

/** Reads `?from=` back. A chapter name may hold ':' (only the first two colons split). Anything else is null, never a guess. */
export function parseFrom(value) {
  const text = String(value ?? '');
  if (text === 'today') return { kind: 'today' };
  const q = /^q:([^:]+):(\d{1,3})$/.exec(text);
  if (q) return { kind: 'q', attemptId: q[1], number: Number(q[2]) };
  const c = /^chapter:([^:]+):(.+)$/.exec(text);
  if (c && c[2].trim()) return { kind: 'chapter', subject: c[1], chapter: c[2] };
  return null;
}
