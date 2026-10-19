// The course search on the subjects step, as pure rules. The six courses most commerce students start from lead before anything is
// typed (the same six the colleges picker offers); a typed query searches every DU course that had seats in Round 1 of 2026.
export const COURSE_QUICK = Object.freeze(['b-com-hons', 'b-com', 'b-a-hons-economics', 'bachelor-of-management-studies-bms', 'b-a-hons-business-economics', 'b-a-programme']);

/** Courses DU actually offers in a college (some groups have no 2026 rows). */
export const offeredCourses = (rules) => (rules?.groups || []).filter((g) => g.offerings > 0);

/** What to list: the six when nothing is typed, else the best matches (at most eight), busiest course first among equals. `search` is duSearch. */
export function courseChoices(rules, query, search, { quick = COURSE_QUICK, limit = 8 } = {}) {
  const courses = offeredCourses(rules);
  if (!courses.length) return [];
  if (!String(query ?? '').trim()) return quick.map((id) => courses.find((g) => g.id === id)).filter(Boolean);
  return search(query, courses, (g) => g.name, { weight: (g) => g.offerings || 0 }).slice(0, limit);
}

/** "Commerce and Economics, 55 colleges" under the chosen course. */
export function courseLine(group) {
  if (!group) return '';
  const colleges = `${group.colleges} ${group.colleges === 1 ? 'college' : 'colleges'}`;
  return `${String(group.stream || '').replace('&', 'and')}, ${colleges}`.replace(/^, /, '');
}
